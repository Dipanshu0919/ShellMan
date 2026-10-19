from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from models import db
from models.server import Server
from routes.auth_helpers import login_required
from services.sftp import SFTPService

workspace_bp = Blueprint('workspace', __name__)

@workspace_bp.route('/workspace')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    path = request.args.get('path', '')
    return redirect(url_for('dashboard.index', server_id=server_id, app='code', path=path))

@workspace_bp.route('/api/servers/<int:server_id>/workspace/set', methods=['POST'])
@login_required
def set_workspace(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    path = data.get('path', '').strip()
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400

    # Test directory existence
    norm_path = SFTPService._normalize_path(path, server)
    ok, res = SFTPService.list_dir(server, norm_path)
    if not ok:
        return jsonify({'success': False, 'error': f"Directory '{path}' could not be opened: {res}"}), 400

    server.last_workspace = norm_path
    db.session.commit()
    return jsonify({'success': True, 'path': norm_path})

@workspace_bp.route('/api/servers/<int:server_id>/workspace/tree')
@login_required
def tree(server_id):
    server = Server.query.get_or_404(server_id)
    path = request.args.get('path')
    if not path:
        path = server.last_workspace or ('/root' if server.username == 'root' else f'/home/{server.username}')

    norm_path = SFTPService._normalize_path(path, server)
    ok, res = SFTPService.list_dir(server, norm_path)
    if not ok:
        return jsonify({'success': False, 'error': res}), 400
    return jsonify({'success': True, 'data': res})

@workspace_bp.route('/api/servers/<int:server_id>/workspace/search-code')
@login_required
def search_code(server_id):
    server = Server.query.get_or_404(server_id)
    base_path = request.args.get('path')
    query = request.args.get('q', '').strip()
    file_pattern = request.args.get('pattern', '')
    if not base_path or not query:
        return jsonify({'success': False, 'error': 'Path and query required'}), 400

    ok, res = SFTPService.search_content(server, base_path, query, file_pattern)
    if not ok:
        return jsonify({'success': False, 'error': res}), 400
    return jsonify({'success': True, 'results': res})
