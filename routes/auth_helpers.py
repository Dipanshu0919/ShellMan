from functools import wraps
from flask import session, redirect, url_for, flash, jsonify, request
from models import db
from models.user import User


def _unauthorized():
    if request.is_json or request.path.startswith('/api/'):
        return jsonify({'error': 'Unauthorized', 'message': 'Please log in to continue'}), 401
    return redirect(url_for('auth.login', next=request.full_path.rstrip('?') if request.method == 'GET' else None))


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if User.query.count() == 0:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'SetupRequired', 'message': 'First-time setup required'}), 401
            return redirect(url_for('auth.setup'))

        if 'user_id' not in session:
            return _unauthorized()

        # The account must still exist and the cookie must match the account's session version
        # (changed password / "sign out other devices" invalidates every older cookie).
        user = db.session.get(User, session['user_id'])
        if not user:
            session.clear()
            return _unauthorized()
        sv = session.get('sv')
        if sv is None:
            session['sv'] = user.session_version      # cookie from before this check existed
        elif sv != user.session_version:
            session.clear()
            return _unauthorized()
        return f(*args, **kwargs)
    return decorated_function


def get_current_user():
    if 'user_id' in session:
        return db.session.get(User, session['user_id'])
    return None


def session_is_valid() -> bool:
    """Same checks as login_required, for places that cannot use the decorator (WebSockets)."""
    uid = session.get('user_id')
    if not uid:
        return False
    user = db.session.get(User, uid)
    if not user:
        return False
    sv = session.get('sv')
    return sv is None or sv == user.session_version
