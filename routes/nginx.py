import logging
from flask import Blueprint, request, jsonify, redirect, url_for
from models.server import Server
from routes.auth_helpers import login_required
from services.nginx_service import NginxService

logger = logging.getLogger('shellman.nginx')
nginx_bp = Blueprint('nginx', __name__)

@nginx_bp.errorhandler(Exception)
def handle_nginx_error(e):
    logger.error(f"Nginx route unhandled error: {e}", exc_info=True)
    return jsonify({'success': False, 'message': f"Server error: {str(e)}"}), 500

@nginx_bp.route('/nginx')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    return redirect(url_for('dashboard.index', server_id=server_id, app='nginx'))

@nginx_bp.route('/api/servers/<int:server_id>/nginx/status')
@login_required
def status(server_id):
    server = Server.query.get_or_404(server_id)
    status_info = NginxService.check_status(server)
    return jsonify({'success': True, 'status': status_info})

@nginx_bp.route('/api/servers/<int:server_id>/nginx/sites')
@login_required
def list_sites(server_id):
    server = Server.query.get_or_404(server_id)
    sites = NginxService.list_sites(server)
    return jsonify({'success': True, 'sites': sites})

@nginx_bp.route('/api/servers/<int:server_id>/nginx/site/config')
@login_required
def get_config(server_id):
    server = Server.query.get_or_404(server_id)
    filename = request.args.get('file', '').strip()
    if not filename:
        return jsonify({'success': False, 'error': 'Filename is required'}), 400

    ok, content = NginxService.get_config_content(server, filename)
    if ok:
        return jsonify({'success': True, 'filename': filename, 'content': content})
    return jsonify({'success': False, 'error': content}), 400

@nginx_bp.route('/api/servers/<int:server_id>/nginx/site/save', methods=['POST'])
@login_required
def save_config(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    filename = data.get('filename', '').strip()
    content = data.get('content', '')

    if not filename:
        return jsonify({'success': False, 'error': 'Filename is required'}), 400

    ok, msg = NginxService.save_config_content(server, filename, content)
    return jsonify({'success': ok, 'message': msg}), (200 if ok else 400)

@nginx_bp.route('/api/servers/<int:server_id>/nginx/site/create', methods=['POST'])
@login_required
def create_site(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    domain = data.get('domain', '').strip()
    site_type = data.get('site_type', 'proxy').strip()
    port_or_url = data.get('port_or_url', '').strip()
    root_path = data.get('root_path', '').strip()
    enable_ssl = bool(data.get('enable_ssl', False))
    email = data.get('email', '').strip()

    if not domain:
        return jsonify({'success': False, 'error': 'Domain name is required'}), 400

    ok, msg = NginxService.create_site(
        server, domain=domain, site_type=site_type,
        port_or_url=port_or_url, root_path=root_path,
        enable_ssl=enable_ssl, email=email
    )
    return jsonify({'success': ok, 'message': msg}), (200 if ok else 400)

@nginx_bp.route('/api/servers/<int:server_id>/nginx/site/toggle', methods=['POST'])
@login_required
def toggle_site(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    filename = data.get('filename', '').strip()
    enable = bool(data.get('enable', True))

    if not filename:
        return jsonify({'success': False, 'error': 'Filename is required'}), 400

    ok, msg = NginxService.toggle_site(server, filename, enable)
    return jsonify({'success': ok, 'message': msg}), (200 if ok else 400)

@nginx_bp.route('/api/servers/<int:server_id>/nginx/site/delete', methods=['POST'])
@login_required
def delete_site(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    filename = data.get('filename', '').strip()

    if not filename:
        return jsonify({'success': False, 'error': 'Filename is required'}), 400

    ok, msg = NginxService.delete_site(server, filename)
    return jsonify({'success': ok, 'message': msg}), (200 if ok else 400)

@nginx_bp.route('/api/servers/<int:server_id>/nginx/action', methods=['POST'])
@login_required
def service_action(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    action = data.get('action', '').strip().lower()

    if not action:
        return jsonify({'success': False, 'error': 'Action is required'}), 400

    ok, msg = NginxService.manage_service(server, action)
    return jsonify({'success': ok, 'message': msg}), (200 if ok else 400)

@nginx_bp.route('/api/servers/<int:server_id>/nginx/ssl/certificates')
@login_required
def list_certificates(server_id):
    server = Server.query.get_or_404(server_id)
    certs = NginxService.list_certificates(server)
    return jsonify({'success': True, 'certificates': certs})

@nginx_bp.route('/api/servers/<int:server_id>/nginx/ssl/issue', methods=['POST'])
@login_required
def issue_ssl(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    domain = data.get('domain', '').strip()
    email = data.get('email', '').strip()

    if not domain or not email:
        return jsonify({'success': False, 'error': 'Domain and email are required for SSL'}), 400

    ok, msg = NginxService.issue_ssl(server, domain, email)
    return jsonify({'success': ok, 'message': msg}), (200 if ok else 400)

@nginx_bp.route('/api/servers/<int:server_id>/nginx/ssl/renew', methods=['POST'])
@login_required
def renew_ssl(server_id):
    try:
        server = Server.query.get_or_404(server_id)
        data = request.json or {}
        domain = data.get('domain', '').strip()
        force = bool(data.get('force', False))

        if domain:
            ok, msg = NginxService.renew_single_ssl(server, cert_name=domain, force=force)
        else:
            ok, msg = NginxService.renew_all_ssl(server, force=force)
        return jsonify({'success': ok, 'message': msg}), (200 if ok else 400)
    except Exception as e:
        logger.error(f"Error renewing SSL for server {server_id}: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f"Renewal exception: {str(e)}"}), 500

@nginx_bp.route('/api/servers/<int:server_id>/nginx/install', methods=['POST'])
@login_required
def install_software(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    package = data.get('package', '').strip().lower()

    if package not in ('nginx', 'certbot'):
        return jsonify({'success': False, 'error': 'Invalid package. Choose nginx or certbot'}), 400

    ok, msg = NginxService.install_software(server, package)
    return jsonify({'success': ok, 'message': msg}), (200 if ok else 400)

