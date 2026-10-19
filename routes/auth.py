from datetime import datetime, timezone
from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from models import db
from models.user import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/setup', methods=['GET', 'POST'])
def setup():
    if User.query.count() > 0:
        flash('Administrator account is already configured. Please sign in.', 'info')
        return redirect(url_for('auth.login'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        if not username:
            flash('Administrator username is required.', 'danger')
            return render_template('setup.html', username=username)

        if len(username) < 3:
            flash('Username must be at least 3 characters long.', 'danger')
            return render_template('setup.html', username=username)

        if not password:
            flash('Password is required.', 'danger')
            return render_template('setup.html', username=username)

        if len(password) < 6:
            flash('Password must be at least 6 characters long.', 'danger')
            return render_template('setup.html', username=username)

        if password != confirm_password:
            flash('Passwords do not match. Please re-enter.', 'danger')
            return render_template('setup.html', username=username)

        admin = User(username=username)
        admin.set_password(password)
        admin.last_login = datetime.now(timezone.utc)
        db.session.add(admin)
        db.session.commit()

        session['user_id'] = admin.id
        session['username'] = admin.username
        flash(f'Administrator account "{admin.username}" created successfully. Welcome to ShellMan!', 'success')
        return redirect(url_for('dashboard.index'))

    return render_template('setup.html')

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

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            user.last_login = datetime.now(timezone.utc)
            db.session.commit()
            
            next_page = request.args.get('next')
            if next_page and next_page.startswith('/'):
                return redirect(next_page)
            return redirect(url_for('dashboard.index'))
        else:
            flash('Invalid username or password.', 'danger')

    return render_template('login.html')

@auth_bp.route('/logout', methods=['GET', 'POST'])
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))
