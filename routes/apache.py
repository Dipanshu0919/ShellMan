import logging
from flask import Blueprint, request, jsonify
from models.server import Server
from routes.auth_helpers import login_required
from services.apache_service import ApacheService
from services.audit import audit

logger = logging.getLogger('shellman.apache')
apache_bp = Blueprint('apache', __name__)


@apache_bp.errorhandler(Exception)
def handle_apache_error(e):
    logger.error(f"Apache route unhandled error: {e}", exc_info=True)
    return jsonify({'success': False, 'message': f"Server error: {str(e)}"}), 500


def _server(server_id):
    return Server.query.get_or_404(server_id)


def _done(ok, msg, action=None, target=''):
    if action:
        audit(action, target=target, detail=msg[:300], ok=ok)
    return jsonify({'success': ok, 'message': msg}), (200 if ok else 400)


@apache_bp.route('/api/servers/<int:server_id>/apache/status')
@login_required
def status(server_id):
    return jsonify({'success': True, 'status': ApacheService.check_status(_server(server_id))})


@apache_bp.route('/api/servers/<int:server_id>/apache/sites')
@login_required
def sites(server_id):
    return jsonify(ApacheService.list_sites(_server(server_id)))


@apache_bp.route('/api/servers/<int:server_id>/apache/files')
@login_required
def files(server_id):
    return jsonify(ApacheService.list_files(_server(server_id)))


@apache_bp.route('/api/servers/<int:server_id>/apache/config')
@login_required
def get_config(server_id):
    name = request.args.get('file', '').strip()
    ok, content = ApacheService.get_config(_server(server_id), name)
    if ok:
        return jsonify({'success': True, 'file': name, 'content': content})
    return jsonify({'success': False, 'message': content}), 400


@apache_bp.route('/api/servers/<int:server_id>/apache/config/save', methods=['POST'])
@login_required
def save_config(server_id):
    d = request.get_json(silent=True) or {}
    name = (d.get('file') or '').strip()
    ok, msg = ApacheService.save_config(_server(server_id), name, d.get('content', ''))
    return _done(ok, msg, 'apache.config.save', name)


@apache_bp.route('/api/servers/<int:server_id>/apache/site/toggle', methods=['POST'])
@login_required
def toggle_site(server_id):
    d = request.get_json(silent=True) or {}
    name = (d.get('name') or '').strip()
    enable = bool(d.get('enable'))
    ok, msg = ApacheService.toggle_site(_server(server_id), name, enable)
    return _done(ok, msg, 'apache.site.enable' if enable else 'apache.site.disable', name)


@apache_bp.route('/api/servers/<int:server_id>/apache/site/create', methods=['POST'])
@login_required
def create_site(server_id):
    d = request.get_json(silent=True) or {}
    ok, msg = ApacheService.create_site(_server(server_id), d.get('domain', ''), d.get('type', ''),
                                        d.get('root', ''), d.get('target', ''), bool(d.get('www', True)))
    return _done(ok, msg, 'apache.site.create', (d.get('domain') or '')[:100])


@apache_bp.route('/api/servers/<int:server_id>/apache/site/delete', methods=['POST'])
@login_required
def delete_site(server_id):
    d = request.get_json(silent=True) or {}
    name = (d.get('name') or '').strip()
    ok, msg = ApacheService.delete_site(_server(server_id), name)
    return _done(ok, msg, 'apache.site.delete', name)


@apache_bp.route('/api/servers/<int:server_id>/apache/modules')
@login_required
def modules(server_id):
    return jsonify(ApacheService.list_modules(_server(server_id)))


@apache_bp.route('/api/servers/<int:server_id>/apache/module/toggle', methods=['POST'])
@login_required
def toggle_module(server_id):
    d = request.get_json(silent=True) or {}
    name = (d.get('name') or '').strip()
    enable = bool(d.get('enable'))
    ok, msg = ApacheService.toggle_module(_server(server_id), name, enable)
    return _done(ok, msg, 'apache.module.enable' if enable else 'apache.module.disable', name)


@apache_bp.route('/api/servers/<int:server_id>/apache/service', methods=['POST'])
@login_required
def service(server_id):
    d = request.get_json(silent=True) or {}
    action = (d.get('action') or '').strip()
    ok, msg = ApacheService.service(_server(server_id), action)
    return _done(ok, msg, None if action == 'test' else 'apache.' + action, 'apache')


@apache_bp.route('/api/servers/<int:server_id>/apache/logs')
@login_required
def logs(server_id):
    name = request.args.get('file', '').strip()
    server = _server(server_id)
    if not name:
        return jsonify(ApacheService.list_logs(server))
    ok, text = ApacheService.tail_log(server, name, request.args.get('lines', 200, type=int))
    if ok:
        return jsonify({'success': True, 'file': name, 'content': text})
    return jsonify({'success': False, 'message': text}), 400


@apache_bp.route('/api/servers/<int:server_id>/apache/ssl/issue', methods=['POST'])
@login_required
def ssl_issue(server_id):
    d = request.get_json(silent=True) or {}
    ok, msg = ApacheService.issue_ssl(_server(server_id), d.get('domain', ''), d.get('email', ''))
    return _done(ok, msg, 'apache.ssl.issue', (d.get('domain') or '')[:100])


@apache_bp.route('/api/servers/<int:server_id>/apache/install', methods=['POST'])
@login_required
def install(server_id):
    d = request.get_json(silent=True) or {}
    pkg = (d.get('package') or '').strip()
    ok, msg = ApacheService.install(_server(server_id), pkg)
    return _done(ok, msg, 'apache.install', pkg)
