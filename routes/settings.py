import json
import secrets
from datetime import datetime, timezone
import pyotp
import qrcode
import qrcode.image.svg
from flask import Blueprint, render_template, request, flash, redirect, url_for, session, jsonify, Response
from models import db
from models.user import User
from models.server import Server
from models.action import CustomAction
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

# =========================================================================
# Two-Factor Authentication (TOTP) Endpoints
# =========================================================================

@settings_bp.route('/api/settings/2fa/status', methods=['GET'])
@login_required
def api_2fa_status():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'User not authenticated'}), 401
    return jsonify({
        'success': True,
        'enabled': bool(user.totp_enabled)
    })

@settings_bp.route('/api/settings/2fa/setup', methods=['POST'])
@login_required
def api_2fa_setup():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'User not authenticated'}), 401

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.username, issuer_name='ShellMan')

    # Generate vector SVG QR code (zero rasters, pure SVG)
    factory = qrcode.image.svg.SvgPathImage
    qr_img = qrcode.make(uri, image_factory=factory)
    svg_bytes = qr_img.to_string()
    svg_str = svg_bytes.decode('utf-8') if isinstance(svg_bytes, bytes) else str(svg_bytes)

    # Generate 8 recovery backup codes (e.g. "8C42-99EA")
    backup_codes = [f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(8)]

    # Store pending setup details in session
    session['pending_totp_secret'] = secret
    session['pending_backup_codes'] = backup_codes

    return jsonify({
        'success': True,
        'secret': secret,
        'uri': uri,
        'qr_svg': svg_str,
        'backup_codes': backup_codes
    })

@settings_bp.route('/api/settings/2fa/verify-enable', methods=['POST'])
@login_required
def api_2fa_verify_enable():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'User not authenticated'}), 401

    data = request.json or {}
    code = str(data.get('code', '')).strip().replace(' ', '').replace('-', '')
    secret = session.get('pending_totp_secret')
    backup_codes = session.get('pending_backup_codes') or []

    if not secret:
        return jsonify({'success': False, 'error': 'No 2FA configuration in progress. Please start setup again.'}), 400

    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        return jsonify({'success': False, 'error': 'Invalid 6-digit verification code. Please check your authenticator and try again.'}), 400

    user.enable_totp(secret, backup_codes)
    db.session.commit()

    session.pop('pending_totp_secret', None)
    session.pop('pending_backup_codes', None)

    return jsonify({
        'success': True,
        'message': 'Two-Factor Authentication is now enabled for your administrator account.'
    })

@settings_bp.route('/api/settings/2fa/disable', methods=['POST'])
@login_required
def api_2fa_disable():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'User not authenticated'}), 401

    data = request.json or {}
    password = data.get('password', '')

    if not user.check_password(password):
        return jsonify({'success': False, 'error': 'Incorrect password. Cannot disable 2FA.'}), 400

    user.disable_totp()
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Two-Factor Authentication has been successfully disabled.'
    })

@settings_bp.route('/api/settings/2fa/backup-codes', methods=['GET'])
@login_required
def api_2fa_get_backup_codes():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'User not authenticated'}), 401

    if not user.totp_enabled:
        return jsonify({'success': False, 'error': '2FA is not enabled.'}), 400

    codes = []
    if user.backup_codes:
        try:
            codes = json.loads(user.backup_codes)
        except Exception:
            codes = []

    # If no codes remain or none were initialized, generate 8 fresh ones
    if not codes:
        codes = [f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(8)]
        user.backup_codes = json.dumps(codes)
        db.session.commit()

    return jsonify({
        'success': True,
        'backup_codes': codes
    })

@settings_bp.route('/api/settings/2fa/regenerate-backup-codes', methods=['POST'])
@login_required
def api_2fa_regenerate_backup_codes():
    user = get_current_user()
    if not user:
        return jsonify({'success': False, 'error': 'User not authenticated'}), 401

    if not user.totp_enabled:
        return jsonify({'success': False, 'error': '2FA is not enabled.'}), 400

    codes = [f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}" for _ in range(8)]
    user.backup_codes = json.dumps(codes)
    db.session.commit()

    return jsonify({
        'success': True,
        'backup_codes': codes,
        'message': 'Fresh backup recovery codes generated successfully.'
    })

# =========================================================================
# Export / Import Settings Endpoints
# =========================================================================

@settings_bp.route('/api/settings/export', methods=['GET', 'POST'])
@login_required
def api_export_settings():
    # Gather custom actions
    actions = [a.to_dict() for a in CustomAction.query.order_by(CustomAction.id).all()]

    # Gather servers sanitized (strictly WITHOUT password or private_key)
    servers = []
    for s in Server.query.order_by(Server.id).all():
        servers.append({
            'name': s.name,
            'host': s.host,
            'port': s.port,
            'username': s.username,
            'auth_type': s.auth_type,
            'last_workspace': s.last_workspace or '/'
        })

    # Collect UI preferences if client posted them
    preferences = {}
    if request.method == 'POST' and request.json:
        preferences = request.json.get('preferences', {})

    payload = {
        'shellman_backup_version': 1,
        'exported_at': datetime.now(timezone.utc).isoformat(),
        'notice': 'Sensitive credentials (passwords and private keys) are omitted for security. You will be prompted to re-enter them on connection.',
        'preferences': preferences,
        'servers': servers,
        'actions': actions
    }

    dumped = json.dumps(payload, indent=2)
    filename = f"shellman_backup_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"

    # If client requested JSON download directly via GET
    if request.args.get('download') == '1' or request.method == 'GET':
        return Response(
            dumped,
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )

    return jsonify({
        'success': True,
        'data': payload,
        'filename': filename
    })

@settings_bp.route('/api/settings/import', methods=['POST'])
@login_required
def api_import_settings():
    payload = None
    if 'file' in request.files:
        try:
            content = request.files['file'].read().decode('utf-8')
            payload = json.loads(content)
        except Exception as e:
            return jsonify({'success': False, 'error': f'Invalid JSON backup file: {e}'}), 400
    elif request.json:
        payload = request.json

    if not isinstance(payload, dict):
        return jsonify({'success': False, 'error': 'Invalid backup payload format.'}), 400

    imported_actions_count = 0
    imported_servers_count = 0

    # 1. Restore Custom Actions
    raw_actions = payload.get('actions', [])
    if isinstance(raw_actions, list):
        for act in raw_actions:
            name = act.get('name')
            cmd = act.get('command')
            if not name or not cmd:
                continue
            existing = CustomAction.query.filter_by(name=name).first()
            if not existing:
                new_act = CustomAction(
                    name=name,
                    description=act.get('description', ''),
                    icon=act.get('icon', 'terminal'),
                    command=cmd,
                    target_type=act.get('target_type', 'both'),
                    file_extensions=act.get('file_extensions', ''),
                    output_target=act.get('output_target', 'panel'),
                    require_confirm=bool(act.get('require_confirm', True)),
                    timeout=int(act.get('timeout', 30)),
                    is_builtin=bool(act.get('is_builtin', False))
                )
                db.session.add(new_act)
                imported_actions_count += 1
            else:
                existing.description = act.get('description', existing.description)
                existing.icon = act.get('icon', existing.icon)
                existing.command = cmd
                existing.target_type = act.get('target_type', existing.target_type)
                existing.file_extensions = act.get('file_extensions', existing.file_extensions)
                existing.output_target = act.get('output_target', existing.output_target)
                imported_actions_count += 1

    # 2. Restore Servers
    raw_servers = payload.get('servers', [])
    if isinstance(raw_servers, list):
        for s in raw_servers:
            host = s.get('host')
            username = s.get('username')
            if not host or not username:
                continue
            port = int(s.get('port', 22))
            name = s.get('name') or host
            auth_type = s.get('auth_type', 'password')
            last_workspace = s.get('last_workspace', '/')

            existing = Server.query.filter_by(host=host, port=port, username=username).first()
            if not existing:
                new_server = Server(
                    name=name,
                    host=host,
                    port=port,
                    username=username,
                    auth_type=auth_type,
                    last_workspace=last_workspace
                )
                db.session.add(new_server)
                imported_servers_count += 1
            else:
                existing.name = name
                existing.auth_type = auth_type
                existing.last_workspace = last_workspace

    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Settings restored: {imported_servers_count} new servers added, {imported_actions_count} custom actions configured.',
        'imported_servers': imported_servers_count,
        'imported_actions': imported_actions_count,
        'preferences': payload.get('preferences', {})
    })
