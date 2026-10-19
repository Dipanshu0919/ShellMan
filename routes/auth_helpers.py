from functools import wraps
from flask import session, redirect, url_for, flash, jsonify, request
from models.user import User

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if User.query.count() == 0:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'SetupRequired', 'message': 'First-time setup required'}), 401
            return redirect(url_for('auth.setup'))

        if 'user_id' not in session:
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Unauthorized', 'message': 'Please log in to continue'}), 401
            return redirect(url_for('auth.login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

def get_current_user():
    if 'user_id' in session:
        return User.query.get(session['user_id'])
    return None
