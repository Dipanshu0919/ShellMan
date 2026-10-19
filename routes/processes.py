from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from models.server import Server
from routes.auth_helpers import login_required
from services.command import LinuxCommandService

processes_bp = Blueprint('processes', __name__)

@processes_bp.route('/processes')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    return redirect(url_for('dashboard.index', server_id=server_id, app='processes'))

@processes_bp.route('/api/servers/<int:server_id>/processes/list')
@login_required
def list_processes(server_id):
    server = Server.query.get_or_404(server_id)
    processes = LinuxCommandService.list_processes(server)
    return jsonify({'success': True, 'processes': processes})

@processes_bp.route('/api/servers/<int:server_id>/processes/kill', methods=['POST'])
@login_required
def kill_process(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    pid = data.get('pid')
    signal = data.get('signal', 'SIGTERM')
    if not pid:
        return jsonify({'success': False, 'error': 'PID is required'}), 400

    ok, msg = LinuxCommandService.kill_process(server, int(pid), signal)
    return jsonify({'success': ok, 'message': msg})
