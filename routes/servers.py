import re
from datetime import datetime, timezone
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from models import db
from models.server import Server
from routes.auth_helpers import login_required
from services.audit import audit
from services.ssh_manager import ssh_manager

servers_bp = Blueprint('servers', __name__)

_CS_NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$')


def _codespace_fields(data, server=None):
    """Validate the Codespace part of an add/edit request. Returns (name, token, error)."""
    name = (data.get('codespace_name') or (server.codespace_name if server else '') or '').strip()
    token = (data.get('gh_token') or '').strip()
    if not _CS_NAME.match(name):
        return None, None, 'Enter the Codespace name (for example "fluffy-space-garbanzo-abc123").'
    if not token and not (server and server.gh_token_enc):
        return None, None, 'A GitHub token with Codespaces access is required.'
    if token and (len(token) < 20 or any(c.isspace() for c in token)):
        return None, None, 'That does not look like a GitHub token.'
    return name, token, None

@servers_bp.route('/servers')
@login_required
def index():
    servers = Server.query.order_by(Server.id.desc()).all()
    return render_template('servers.html', servers=servers)

@servers_bp.route('/servers/add', methods=['GET', 'POST'])
@login_required
def add():
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        host = request.form.get('host', '').strip()
        port = int(request.form.get('port', 22))
        username = request.form.get('username', '').strip()
        auth_type = request.form.get('auth_type', 'password')
        password = request.form.get('password', '')
        private_key = request.form.get('private_key', '')
        passphrase = request.form.get('passphrase', '')

        if not name or not host or not username:
            flash('Name, host, and username are required.', 'danger')
            return render_template('server_form.html', action='add')

        server = Server(
            name=name,
            host=host,
            port=port,
            username=username,
            auth_type=auth_type
        )
        if auth_type == 'password':
            server.password = password
        else:
            server.private_key = private_key
            server.passphrase = passphrase

        db.session.add(server)
        db.session.commit()
        flash(f'Server "{name}" added successfully.', 'success')
        return redirect(url_for('servers.index'))

    return render_template('server_form.html', action='add', server=None)

@servers_bp.route('/servers/<int:server_id>/edit', methods=['GET', 'POST'])
@login_required
def edit(server_id):
    server = Server.query.get_or_404(server_id)
    if request.method == 'POST':
        server.name = request.form.get('name', '').strip()
        server.host = request.form.get('host', '').strip()
        server.port = int(request.form.get('port', 22))
        server.username = request.form.get('username', '').strip()
        auth_type = request.form.get('auth_type', 'password')
        server.auth_type = auth_type

        # Only update credentials if provided
        new_password = request.form.get('password', '')
        new_key = request.form.get('private_key', '')
        new_passphrase = request.form.get('passphrase', '')

        if auth_type == 'password' and new_password:
            server.password = new_password
        elif auth_type == 'key':
            if new_key:
                server.private_key = new_key
            if new_passphrase:
                server.passphrase = new_passphrase

        db.session.commit()
        # Invalidate cached SSH connection
        ssh_manager.disconnect(server.id)
        flash(f'Server "{server.name}" updated successfully.', 'success')
        return redirect(url_for('servers.index'))

    return render_template('server_form.html', action='edit', server=server)

@servers_bp.route('/servers/<int:server_id>/delete', methods=['POST'])
@login_required
def delete(server_id):
    server = Server.query.get_or_404(server_id)
    name = server.name
    ssh_manager.disconnect(server.id)
    db.session.delete(server)
    db.session.commit()
    flash(f'Server "{name}" was deleted.', 'info')
    return redirect(url_for('servers.index'))

@servers_bp.route('/api/servers/<int:server_id>/test', methods=['POST'])
@login_required
def test_connection(server_id):
    server = Server.query.get_or_404(server_id)
    ok, msg = ssh_manager.test_connection(server)
    server.is_online = ok
    server.last_check = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({'success': ok, 'message': msg})

@servers_bp.route('/api/servers/test-config', methods=['POST'])
@login_required
def test_temp_config():
    """Allows testing connection directly from the add/edit form before saving."""
    data = request.json or {}
    host = data.get('host', '').strip()
    port = int(data.get('port', 22))
    username = data.get('username', '').strip()
    auth_type = data.get('auth_type', 'password')
    password = data.get('password', '')
    private_key = data.get('private_key', '')
    passphrase = data.get('passphrase', '')

    temp_server = Server(
        id=999999,
        name='Temp',
        host=host,
        port=port,
        username=username,
        auth_type=auth_type
    )
    if auth_type == 'password':
        temp_server.password = password
    else:
        temp_server.private_key = private_key
        temp_server.passphrase = passphrase

    ok, msg = ssh_manager.test_connection(temp_server)
    return jsonify({'success': ok, 'message': msg})

@servers_bp.route('/api/servers/list', methods=['GET'])
@login_required
def api_servers_list():
    servers = Server.query.order_by(Server.id.asc()).all()
    return jsonify({
        'success': True,
        'servers': [s.to_dict() for s in servers]
    })

@servers_bp.route('/api/servers/<int:server_id>/details', methods=['GET'])
@login_required
def api_server_details(server_id):
    server = Server.query.get_or_404(server_id)
    return jsonify({
        'success': True,
        'server': server.to_dict()
    })

@servers_bp.route('/api/servers/add', methods=['POST'])
@login_required
def api_add_server():
    data = request.json or {}
    name = data.get('name', '').strip()
    host = data.get('host', '').strip()
    port = int(data.get('port', 22))
    username = data.get('username', '').strip()
    auth_type = data.get('auth_type', 'password')
    password = data.get('password', '')
    private_key = data.get('private_key', '')
    passphrase = data.get('passphrase', '')

    if data.get('kind') == 'codespace':
        if not name:
            return jsonify({'success': False, 'error': 'Name is required.'}), 400
        cs_name, token, err = _codespace_fields(data)
        if err:
            return jsonify({'success': False, 'error': err}), 400
        server = Server(name=name, host=f'codespace:{cs_name}', port=22, username='codespace',
                        auth_type='codespace', kind='codespace', codespace_name=cs_name)
        server.gh_token = token
        try:
            from services import codespace
            codespace.get_state(server, fresh=True)      # proves the name and token work before saving
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400
        db.session.add(server)
        db.session.commit()
        audit('server.add', target=f"{server.name} (GitHub Codespace {cs_name})", detail='kind=codespace')
        return jsonify({'success': True, 'server': server.to_dict()})

    if not name or not host or not username:
        return jsonify({'success': False, 'error': 'Name, host, and username are required.'}), 400

    server = Server(
        name=name,
        host=host,
        port=port,
        username=username,
        auth_type=auth_type
    )
    if auth_type == 'password':
        server.password = password
    else:
        server.private_key = private_key
        server.passphrase = passphrase

    db.session.add(server)
    db.session.commit()
    audit('server.add', target=f"{server.name} ({server.username}@{server.host}:{server.port})", detail=f"auth={auth_type}")
    return jsonify({'success': True, 'server': server.to_dict()})

@servers_bp.route('/api/servers/<int:server_id>/edit', methods=['POST'])
@login_required
def api_edit_server(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    name = data.get('name', '').strip()
    host = data.get('host', '').strip()
    port = int(data.get('port', 22))
    username = data.get('username', '').strip()
    auth_type = data.get('auth_type', server.auth_type)

    if server.is_codespace:
        if not name:
            return jsonify({'success': False, 'error': 'Name is required.'}), 400
        cs_name, token, err = _codespace_fields(data, server)
        if err:
            return jsonify({'success': False, 'error': err}), 400
        server.name = name
        server.codespace_name = cs_name
        server.host = f'codespace:{cs_name}'
        if token:
            server.gh_token = token
        db.session.commit()
        ssh_manager.disconnect(server.id)
        audit('server.edit', target=f"{server.name} (GitHub Codespace {cs_name})")
        return jsonify({'success': True, 'server': server.to_dict()})

    if not name or not host or not username:
        return jsonify({'success': False, 'error': 'Name, host, and username are required.'}), 400

    server.name = name
    server.host = host
    server.port = port
    server.username = username
    server.auth_type = auth_type

    new_password = data.get('password', '')
    new_key = data.get('private_key', '')
    new_passphrase = data.get('passphrase', '')

    if auth_type == 'password':
        if new_password:
            server.password = new_password
    elif auth_type == 'key':
        if new_key:
            server.private_key = new_key
        if new_passphrase:
            server.passphrase = new_passphrase

    db.session.commit()
    ssh_manager.disconnect(server.id)
    audit('server.edit', target=f"{server.name} ({server.username}@{server.host}:{server.port})")
    return jsonify({'success': True, 'server': server.to_dict()})

@servers_bp.route('/api/servers/<int:server_id>/delete', methods=['POST'])
@login_required
def api_delete_server(server_id):
    server = Server.query.get_or_404(server_id)
    name = server.name
    ssh_manager.disconnect(server.id)
    desc = f"{name} ({server.username}@{server.host}:{server.port})"
    from models.timelimit import TimeLimit, ServerUsage
    TimeLimit.query.filter_by(server_id=server.id).delete()
    ServerUsage.query.filter_by(server_id=server.id).delete()
    from services import history
    history.forget_server(server.id)
    db.session.delete(server)
    db.session.commit()
    audit('server.delete', target=desc)
    return jsonify({'success': True, 'message': f'Server "{name}" was deleted.'})

@servers_bp.route('/api/servers/<int:server_id>/forget-host-key', methods=['POST'])
@login_required
def forget_host_key(server_id):
    """Drop the pinned SSH host key (after a reinstall). The next connection pins the new key."""
    server = Server.query.get_or_404(server_id)
    removed = ssh_manager.forget_host_key(server.host, server.port)
    ssh_manager.disconnect(server.id)
    audit('server.forget_host_key', target=f"{server.host}:{server.port}", detail='SSH host key un-pinned')
    return jsonify({'success': True, 'removed': removed})
