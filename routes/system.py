from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from models.server import Server
from routes.auth_helpers import login_required
from services.audit import audit
from services.monitoring import SystemMonitor
from services.command import LinuxCommandService

system_bp = Blueprint('system', __name__)

@system_bp.route('/system')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    return redirect(url_for('dashboard.index', server_id=server_id, app='hardware'))

@system_bp.route('/api/servers/<int:server_id>/system/info')
@login_required
def system_info(server_id):
    server = Server.query.get_or_404(server_id)
    info = SystemMonitor.get_system_details(server)
    return jsonify({'success': True, 'data': info})

@system_bp.route('/api/servers/<int:server_id>/power', methods=['POST'])
@login_required
def power_action(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    action = data.get('action')
    if action not in ('reboot', 'shutdown'):
        return jsonify({'success': False, 'error': 'Invalid action'}), 400

    ok, msg = LinuxCommandService.server_power(server, action)
    audit(f'power.{action}', target=server.name, detail=msg if not ok else '', ok=ok)
    return jsonify({'success': ok, 'message': msg})
