from datetime import datetime, timezone
from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from sqlite3 import IntegrityError
from models import db
from models.user import User
import hmac
import os
from security import login_throttle, login_ip_throttle, totp_throttle, client_ip, safe_next, password_problem
from services.audit import audit

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/setup', methods=['GET', 'POST'])
def setup():
    if User.query.count() > 0:
        flash('Administrator account is already configured. Please sign in.', 'info')
        return redirect(url_for('auth.login'))

    # Optional: set SHELLMAN_SETUP_TOKEN so a stranger who finds a fresh instance cannot claim the admin account.
    setup_token = (os.environ.get('SHELLMAN_SETUP_TOKEN') or '').strip()

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        if setup_token and not hmac.compare_digest(request.form.get('setup_token', '').strip(), setup_token):
            audit('setup.denied', detail='wrong setup token', ok=False, username=username)
            flash('Setup token is missing or wrong.', 'danger')
            return render_template('setup.html', username=username, require_token=True), 403

        if not username:
            flash('Administrator username is required.', 'danger')
            return render_template('setup.html', username=username, require_token=bool(setup_token))

        if len(username) < 3:
            flash('Username must be at least 3 characters long.', 'danger')
            return render_template('setup.html', username=username, require_token=bool(setup_token))

        if not password:
            flash('Password is required.', 'danger')
            return render_template('setup.html', username=username, require_token=bool(setup_token))

        problem = password_problem(password, username)
        if problem:
            flash(problem, 'danger')
            return render_template('setup.html', username=username, require_token=bool(setup_token))

        if password != confirm_password:
            flash('Passwords do not match. Please re-enter.', 'danger')
            return render_template('setup.html', username=username, require_token=bool(setup_token))

        admin = User(username=username)
        admin.set_password(password)
        admin.last_login = datetime.now(timezone.utc)
        db.session.add(admin)
        try:
            db.session.commit()
        except IntegrityError:
            # FIX: two concurrent first-run POSTs can both pass count()==0;
            # the UNIQUE constraint on users.username rejects the second one.
            # Treat that as "already configured" instead of returning HTTP 500.
            db.session.rollback()
            flash('Administrator account is already configured. Please sign in.', 'info')
            return redirect(url_for('auth.login'))

        session.clear()
        session.permanent = True
        session['user_id'] = admin.id
        session['username'] = admin.username
        session['sv'] = admin.session_version
        audit('setup.complete', target=admin.username)
        flash(f'Administrator account "{admin.username}" created successfully. Welcome to ShellMan!', 'success')
        return redirect(url_for('dashboard.index'))

    return render_template('setup.html', require_token=bool(setup_token))

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if User.query.count() == 0:
        return redirect(url_for('auth.setup'))

    if 'user_id' in session:
        return redirect(url_for('dashboard.index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        if not username or not password:
            flash('Username and password are required.', 'danger')
            return render_template('login.html', username=username)

        ip = client_ip()
        ukey = f"u:{ip}:{username.lower()}"
        wait = max(login_throttle.remaining(ukey), login_ip_throttle.remaining(ip))
        if wait:
            audit('login.locked', target=username, detail=f'locked for {wait}s', ok=False, username=username)
            flash(f'Too many failed attempts. Try again in {wait} seconds.', 'danger')
            return render_template('login.html', username=username), 429

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            login_throttle.reset(ukey)
            if user.totp_enabled:
                session.clear()
                session['2fa_pending_user_id'] = user.id
                session['2fa_next_url'] = safe_next(request.args.get('next'), url_for('dashboard.index'))
                return redirect(url_for('auth.login_2fa'))

            session.clear()
            session.permanent = True
            session['user_id'] = user.id
            session['username'] = user.username
            session['sv'] = user.session_version
            user.last_login = datetime.now(timezone.utc)
            db.session.commit()
            audit('login.success', target=user.username)

            return redirect(safe_next(request.args.get('next'), url_for('dashboard.index')))
        else:
            login_throttle.fail(ukey)
            login_ip_throttle.fail(ip)
            audit('login.failed', target=username, ok=False, username=username)
            flash('Invalid username or password.', 'danger')

    return render_template('login.html')

@auth_bp.route('/login/2fa', methods=['GET', 'POST'])
def login_2fa():
    pending_user_id = session.get('2fa_pending_user_id')
    if not pending_user_id:
        return redirect(url_for('auth.login'))

    user = db.session.get(User, pending_user_id)
    if not user or not user.totp_enabled:
        session.pop('2fa_pending_user_id', None)
        return redirect(url_for('auth.login'))

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        tkeys = (f"t:{pending_user_id}", f"tip:{client_ip()}")
        wait = totp_throttle.remaining(*tkeys)
        if wait:
            flash(f'Too many wrong codes. Try again in {wait} seconds.', 'danger')
            return render_template('login_2fa.html', user=user), 429

        authenticated = False
        # 1. First test TOTP if the code is 6 numeric digits
        clean_num = code.replace(' ', '').replace('-', '')
        if len(clean_num) == 6 and clean_num.isdigit():
            authenticated = user.verify_totp(clean_num)

        # 2. If TOTP did not authenticate, check if code matches an unused backup recovery code
        if not authenticated:
            authenticated = user.verify_and_consume_backup_code(code)

        if authenticated:
            totp_throttle.reset(*tkeys)
            next_page = safe_next(session.get('2fa_next_url'), url_for('dashboard.index'))
            session.clear()
            session.permanent = True
            session['user_id'] = user.id
            session['username'] = user.username
            session['sv'] = user.session_version
            user.last_login = datetime.now(timezone.utc)
            db.session.commit()
            audit('login.success', target=user.username, detail='with 2FA')
            return redirect(next_page)
        else:
            totp_throttle.fail(*tkeys)
            audit('login.2fa_failed', target=user.username, ok=False, username=user.username)
            flash('Invalid 2FA code or backup code. Please try again.', 'danger')

    return render_template('login_2fa.html', user=user)

@auth_bp.route('/login/2fa/cancel', methods=['GET', 'POST'])
def login_2fa_cancel():
    session.pop('2fa_pending_user_id', None)
    session.pop('2fa_next_url', None)
    return redirect(url_for('auth.login'))

@auth_bp.route('/logout', methods=['GET', 'POST'])
def logout():
    if session.get('user_id'):
        audit('logout', target=session.get('username', ''))
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))