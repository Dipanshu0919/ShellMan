from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from models.server import Server
from routes.auth_helpers import login_required
from services.command import LinuxCommandService

logs_bp = Blueprint('logs', __name__)

@logs_bp.route('/logs')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    service = request.args.get('service', '')
    return redirect(url_for('dashboard.index', server_id=server_id, app='logs', service=service))

@logs_bp.route('/api/servers/<int:server_id>/logs/fetch')
@login_required
def fetch_logs(server_id):
    server = Server.query.get_or_404(server_id)
    service_name = request.args.get('service', '').strip()
    lines = int(request.args.get('lines', 150))

    if service_name:
        content = LinuxCommandService.get_service_logs(server, service_name, lines)
    else:
        content = LinuxCommandService.get_system_logs(server, lines)

    return jsonify({'success': True, 'logs': content})
