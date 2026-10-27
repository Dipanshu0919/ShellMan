import re

from flask import Blueprint, jsonify, request, session

from models import db
from models.user import User
from routes.auth_helpers import login_required, get_current_user
from security import password_problem
from services.audit import audit

users_bp = Blueprint('users', __name__)

ROLES = ('admin', 'viewer')
_NAME_RE = re.compile(r'^[A-Za-z0-9_.@-]{3,80}$')


def _admin_only():
    me = get_current_user()
    if not me or not me.is_admin:
        return None, (jsonify({'success': False, 'error': 'Only an administrator can manage users.'}), 403)
    return me, None


def _admin_count():
    return User.query.filter_by(role='admin').count()


@users_bp.route('/api/users', methods=['GET'])
@login_required
def list_users():
    me, err = _admin_only()
    if err:
        return err
    users = User.query.order_by(User.id).all()
    return jsonify({'success': True, 'me': me.id, 'users': [u.to_dict() for u in users]})


@users_bp.route('/api/users', methods=['POST'])
@login_required
def add_user():
    me, err = _admin_only()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    role = (data.get('role') or 'viewer').strip()
    if not _NAME_RE.match(username):
        return jsonify({'success': False, 'error': 'Username needs 3 to 80 letters, digits or . _ @ -'}), 400
    if role not in ROLES:
        return jsonify({'success': False, 'error': 'Role must be admin or viewer.'}), 400
    problem = password_problem(password, username)
    if problem:
        return jsonify({'success': False, 'error': problem}), 400
    if User.query.filter(User.username == username).first():
        return jsonify({'success': False, 'error': 'That username already exists.'}), 400
    user = User(username=username, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    audit('user.create', target=username, detail=f'role {role}')
    return jsonify({'success': True, 'user': user.to_dict()})


@users_bp.route('/api/users/<int:user_id>', methods=['PUT'])
@login_required
def edit_user(user_id):
    me, err = _admin_only()
    if err:
        return err
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found.'}), 404
    data = request.get_json(silent=True) or {}
    changes = []
    if 'role' in data:
        role = (data.get('role') or '').strip()
        if role not in ROLES:
            return jsonify({'success': False, 'error': 'Role must be admin or viewer.'}), 400
        if role != user.role:
            if user.role == 'admin' and _admin_count() <= 1:
                return jsonify({'success': False, 'error': 'There must be at least one administrator.'}), 400
            user.role = role
            changes.append(f'role {role}')
    if data.get('password'):
        problem = password_problem(data['password'], user.username)
        if problem:
            return jsonify({'success': False, 'error': problem}), 400
        user.set_password(data['password'])
        changes.append('password reset')
    if not changes:
        return jsonify({'success': True, 'user': user.to_dict()})
    user.bump_session_version()          # their other sessions must sign in again to get the new rights
    db.session.commit()
    if user.id == session.get('user_id'):
        session['sv'] = user.session_version
    audit('user.update', target=user.username, detail=', '.join(changes))
    return jsonify({'success': True, 'user': user.to_dict()})


@users_bp.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    me, err = _admin_only()
    if err:
        return err
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found.'}), 404
    if user.id == me.id:
        return jsonify({'success': False, 'error': 'You cannot delete the account you are signed in with.'}), 400
    if user.role == 'admin' and _admin_count() <= 1:
        return jsonify({'success': False, 'error': 'There must be at least one administrator.'}), 400
    name = user.username
    db.session.delete(user)
    db.session.commit()
    audit('user.delete', target=name)
    return jsonify({'success': True})
