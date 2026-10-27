import json
import secrets
from datetime import datetime, timezone
import pyotp
from flask import Blueprint, render_template, request, flash, redirect, url_for, session, jsonify, Response
from models import db
from models.user import User
from models.server import Server, encrypt_value
from models.action import CustomAction
from routes.auth_helpers import login_required, get_current_user
from security import password_problem, sensitive_throttle
from services.audit import audit

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
            elif not new_pw:
                flash('New password is required.', 'danger')
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

    tkey = f"pw:{user.id}"
    wait = sensitive_throttle.remaining(tkey)
    if wait:
        return jsonify({'success': False, 'error': f'Too many wrong attempts. Try again in {wait} seconds.'}), 429
    if not user.check_password(current_pw):
        sensitive_throttle.fail(tkey)
        audit('password.change_failed', target=user.username, detail='wrong current password', ok=False)
        return jsonify({'success': False, 'error': 'Current password is incorrect.'}), 400
    sensitive_throttle.reset(tkey)
    problem = password_problem(new_pw, user.username)
    if problem:
        return jsonify({'success': False, 'error': problem}), 400
    if new_pw != confirm_pw:
        return jsonify({'success': False, 'error': 'New passwords do not match.'}), 400
    if new_pw == current_pw:
        return jsonify({'success': False, 'error': 'New password must be different from the current one.'}), 400

    user.set_password(new_pw)
    user.bump_session_version()          # every other signed-in browser is logged out
    db.session.commit()
    session['sv'] = user.session_version  # keep this one
    audit('password.changed', target=user.username, detail='other sessions signed out')
    return jsonify({'success': True, 'message': 'Password updated. Other signed-in devices were signed out.'})

@settings_bp.route('/api/settings/logout-others', methods=['POST'])
@login_required
def api_logout_others():
    user = get_current_user()
    user.bump_session_version()
    db.session.commit()
    session['sv'] = user.session_version
    audit('session.logout_others', target=user.username)
    return jsonify({'success': True, 'message': 'All other devices were signed out.'})

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
    import qrcode  # imported on demand: pulls in Pillow, only needed while enabling 2FA
    import qrcode.image.svg
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
    audit('2fa.enabled', target=user.username)

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

    tkey = f"pw:{user.id}"
    wait = sensitive_throttle.remaining(tkey)
    if wait:
        return jsonify({'success': False, 'error': f'Too many wrong attempts. Try again in {wait} seconds.'}), 429
    if not user.check_password(password):
        sensitive_throttle.fail(tkey)
        audit('2fa.disable_failed', target=user.username, ok=False)
        return jsonify({'success': False, 'error': 'Incorrect password. Cannot disable 2FA.'}), 400
    sensitive_throttle.reset(tkey)

    user.disable_totp()
    user.bump_session_version()
    db.session.commit()
    session['sv'] = user.session_version
    audit('2fa.disabled', target=user.username)

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

    # Codes are stored Fernet-encrypted. (Parsing the raw column here used to fail silently and then
    # replace the real codes with new ones every time this endpoint was opened.)
    codes = user.raw_backup_codes

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
    user.backup_codes = encrypt_value(json.dumps(codes))
    db.session.commit()
    audit('2fa.backup_codes_regenerated', target=user.username)

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

    audit('settings.export', detail=f"{len(servers)} servers, {len(actions)} actions")
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
                    require_confirm=True,   # a command from a file is never trusted to run without asking
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
                existing.require_confirm = True
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
    audit('settings.import', detail=f"{imported_servers_count} servers, {imported_actions_count} actions")

    return jsonify({
        'success': True,
        'message': f'Settings restored: {imported_servers_count} new servers added, {imported_actions_count} custom actions configured.',
        'imported_servers': imported_servers_count,
        'imported_actions': imported_actions_count,
        'preferences': payload.get('preferences', {})
    })


# =========================================================================
# Full encrypted backup (includes credentials, protected by a passphrase)
# =========================================================================
import base64
import os as _os
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes as _hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

_KDF_ITER = 600_000


def _derive_fernet(passphrase: str, salt: bytes, iterations: int) -> Fernet:
    kdf = PBKDF2HMAC(algorithm=_hashes.SHA256(), length=32, salt=salt, iterations=iterations)
    return Fernet(base64.urlsafe_b64encode(kdf.derive(passphrase.encode('utf-8'))))


@settings_bp.route('/api/settings/export-full', methods=['POST'])
@login_required
def api_export_full():
    from models.git_deployment import GitDeployment
    from models.alert import AlertRule, AlertChannel
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    tkey = f"pw:{user.id}"
    wait = sensitive_throttle.remaining(tkey)
    if wait:
        return jsonify({'success': False, 'error': f'Too many wrong attempts. Try again in {wait} seconds.'}), 429
    if not user.check_password(data.get('password', '')):
        sensitive_throttle.fail(tkey)
        audit('settings.export_full_denied', ok=False, detail='wrong account password')
        return jsonify({'success': False, 'error': 'Account password is incorrect.'}), 403
    sensitive_throttle.reset(tkey)
    passphrase = data.get('passphrase', '')
    if len(passphrase) < 10:
        return jsonify({'success': False, 'error': 'Backup passphrase must be at least 10 characters.'}), 400

    servers = []
    for s in Server.query.order_by(Server.id).all():
        servers.append({
            'ref': s.id, 'name': s.name, 'host': s.host, 'port': s.port, 'username': s.username,
            'auth_type': s.auth_type, 'password': s.password, 'private_key': s.private_key,
            'passphrase': s.passphrase, 'last_workspace': s.last_workspace or '/',
        })
    deployments = [{
        'server_ref': d.server_id, 'name': d.name, 'repo_url': d.repo_url, 'target_path': d.target_path,
        'branch': d.branch, 'post_deploy_cmd': d.post_deploy_cmd or '', 'webhook_token': d.webhook_token,
    } for d in GitDeployment.query.all()]
    rules = [{**r.to_dict(), 'server_ref': r.server_id} for r in AlertRule.query.all()]
    channels = [{'name': c.name, 'kind': c.kind, 'enabled': c.enabled, 'min_severity': c.min_severity,
                 'config': c.config} for c in AlertChannel.query.all()]
    actions = [a.to_dict() for a in CustomAction.query.order_by(CustomAction.id).all()]
    inner = {
        'version': 1, 'exported_at': datetime.now(timezone.utc).isoformat(),
        'servers': servers, 'git_deployments': deployments, 'alert_rules': rules,
        'alert_channels': channels, 'actions': actions, 'preferences': data.get('preferences', {}),
    }
    salt = _os.urandom(16)
    token = _derive_fernet(passphrase, salt, _KDF_ITER).encrypt(json.dumps(inner).encode('utf-8')).decode('ascii')
    envelope = {
        'shellman_encrypted_backup': 1, 'kdf': 'pbkdf2-sha256', 'iterations': _KDF_ITER,
        'salt': base64.b64encode(salt).decode('ascii'), 'data': token,
    }
    audit('settings.export_full', detail=f"{len(servers)} servers with credentials, {len(channels)} channels")
    name = f"shellman_full_backup_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.smbak"
    return Response(json.dumps(envelope), mimetype='application/octet-stream',
                    headers={'Content-Disposition': f'attachment; filename="{name}"'})


@settings_bp.route('/api/settings/import-full', methods=['POST'])
@login_required
def api_import_full():
    from models.git_deployment import GitDeployment
    from models.alert import AlertRule, AlertChannel
    f = request.files.get('file')
    passphrase = request.form.get('passphrase', '')
    if not f:
        return jsonify({'success': False, 'error': 'Choose a backup file.'}), 400
    user = get_current_user()
    tkey = f"imp:{user.id}"
    wait = sensitive_throttle.remaining(tkey)
    if wait:
        return jsonify({'success': False, 'error': f'Too many wrong passphrases. Try again in {wait} seconds.'}), 429
    try:
        env = json.loads(f.read(64 * 1024 * 1024).decode('utf-8'))
        if env.get('shellman_encrypted_backup') != 1:
            raise ValueError('not a ShellMan encrypted backup')
        iters = int(env.get('iterations', _KDF_ITER))
        if not (100_000 <= iters <= 5_000_000):
            raise ValueError('bad iteration count')
        salt = base64.b64decode(env['salt'])
    except Exception:
        return jsonify({'success': False, 'error': 'This is not a valid ShellMan encrypted backup file.'}), 400
    try:
        inner = json.loads(_derive_fernet(passphrase, salt, iters).decrypt(env['data'].encode('ascii')).decode('utf-8'))
    except (InvalidToken, Exception):
        sensitive_throttle.fail(tkey)
        audit('settings.import_full_failed', ok=False, detail='wrong passphrase or damaged file')
        return jsonify({'success': False, 'error': 'Wrong passphrase, or the file is damaged.'}), 400
    sensitive_throttle.reset(tkey)

    ref_map = {}
    added = {'servers': 0, 'deployments': 0, 'rules': 0, 'channels': 0, 'actions': 0}
    for s in inner.get('servers', []):
        host, username = s.get('host'), s.get('username')
        if not host or not username:
            continue
        port = int(s.get('port', 22))
        existing = Server.query.filter_by(host=host, port=port, username=username).first()
        if existing:
            ref_map[s.get('ref')] = existing.id
            continue
        srv = Server(name=s.get('name') or host, host=host, port=port, username=username,
                     auth_type=s.get('auth_type', 'password'), last_workspace=s.get('last_workspace', '/'))
        srv.password = s.get('password') or ''
        srv.private_key = s.get('private_key') or ''
        srv.passphrase = s.get('passphrase') or ''
        db.session.add(srv)
        db.session.flush()
        ref_map[s.get('ref')] = srv.id
        added['servers'] += 1
    for d in inner.get('git_deployments', []):
        sid = ref_map.get(d.get('server_ref'))
        if not sid or GitDeployment.query.filter_by(server_id=sid, name=d.get('name')).first():
            continue
        tok = d.get('webhook_token')
        if tok and GitDeployment.query.filter_by(webhook_token=tok).first():
            tok = None
        dep = GitDeployment(server_id=sid, name=d.get('name', 'deployment'), repo_url=d.get('repo_url', ''),
                            target_path=d.get('target_path', ''), branch=d.get('branch') or 'main',
                            post_deploy_cmd=d.get('post_deploy_cmd') or '')
        if tok:
            dep.webhook_token = tok
        db.session.add(dep)
        added['deployments'] += 1
    for r in inner.get('alert_rules', []):
        sid = ref_map.get(r.get('server_ref')) if r.get('server_ref') else None
        if r.get('server_ref') and not sid:
            continue
        if AlertRule.query.filter_by(name=r.get('name'), metric=r.get('metric'), server_id=sid).first():
            continue
        db.session.add(AlertRule(name=r.get('name', 'rule'), metric=r.get('metric', 'cpu'), server_id=sid,
                                 threshold=float(r.get('threshold', 90)), duration_min=int(r.get('duration_min', 5)),
                                 cooldown_min=int(r.get('cooldown_min', 60)), severity=r.get('severity', 'warning'),
                                 enabled=bool(r.get('enabled', True))))
        added['rules'] += 1
    for c in inner.get('alert_channels', []):
        if AlertChannel.query.filter_by(name=c.get('name'), kind=c.get('kind')).first():
            continue
        ch = AlertChannel(name=c.get('name', 'channel'), kind=c.get('kind', 'webhook'),
                          enabled=bool(c.get('enabled', True)), min_severity=c.get('min_severity', 'warning'))
        ch.config = c.get('config') or {}
        db.session.add(ch)
        added['channels'] += 1
    for a in inner.get('actions', []):
        if not a.get('name') or not a.get('command') or CustomAction.query.filter_by(name=a['name']).first():
            continue
        db.session.add(CustomAction(
            name=a['name'], description=a.get('description', ''), icon=a.get('icon', 'terminal'), command=a['command'],
            target_type=a.get('target_type', 'both'), file_extensions=a.get('file_extensions', ''),
            output_target=a.get('output_target', 'panel'), require_confirm=True,
            timeout=int(a.get('timeout', 30)), is_builtin=False))
        added['actions'] += 1
    db.session.commit()
    audit('settings.import_full', detail=', '.join(f"{v} {k}" for k, v in added.items() if v) or 'nothing new')
    msg = 'Restored: ' + (', '.join(f"{v} {k}" for k, v in added.items() if v) or 'nothing new (everything already existed)') + '.'
    return jsonify({'success': True, 'message': msg, 'added': added, 'preferences': inner.get('preferences', {})})
