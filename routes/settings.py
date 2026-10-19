from flask import Blueprint, render_template, request, flash, redirect, url_for, session, jsonify
from models import db
from models.user import User
from routes.auth_helpers import login_required, get_current_user

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/settings', methods=['GET', 'POST'])
@login_required
def index():
    user = get_current_user()
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'change_password':
            current_pw = request.form.get('current_password', '')
            new_pw = request.form.get('new_password', '')
            confirm_pw = request.form.get('confirm_password', '')

            if not user.check_password(current_pw):
                flash('Current password is incorrect.', 'danger')
            elif len(new_pw) < 6:
                flash('New password must be at least 6 characters.', 'danger')
            elif new_pw != confirm_pw:
                flash('New passwords do not match.', 'danger')
            else:
                user.set_password(new_pw)
                db.session.commit()
                flash('Password updated successfully.', 'success')

    return render_template('settings.html', user=user)

@settings_bp.route('/api/settings/profile', methods=['GET'])
@login_required
def api_profile():
    user = get_current_user()
    return jsonify({
        'success': True,
        'user': user.to_dict() if user else {}
    })

@settings_bp.route('/api/settings/change-password', methods=['POST'])
@login_required
def api_change_password():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'User not authenticated'}), 401

    data = request.json or {}
    current_pw = data.get('current_password', '')
    new_pw = data.get('new_password', '')
    confirm_pw = data.get('confirm_password', '')

    if not user.check_password(current_pw):
        return jsonify({'success': False, 'error': 'Current password is incorrect.'}), 400
    if len(new_pw) < 6:
        return jsonify({'success': False, 'error': 'New password must be at least 6 characters.'}), 400
    if new_pw != confirm_pw:
        return jsonify({'success': False, 'error': 'New passwords do not match.'}), 400

    user.set_password(new_pw)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Password updated successfully.'})
