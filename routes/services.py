from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from models.server import Server
from routes.auth_helpers import login_required
from services.command import LinuxCommandService

services_bp = Blueprint('services', __name__)

@services_bp.route('/services')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    return redirect(url_for('dashboard.index', server_id=server_id, app='services'))

@services_bp.route('/api/servers/<int:server_id>/services/list')
@login_required
def list_services(server_id):
    server = Server.query.get_or_404(server_id)
    services = LinuxCommandService.list_services(server)
    return jsonify({'success': True, 'services': services})

@services_bp.route('/api/servers/<int:server_id>/services/action', methods=['POST'])
@login_required
def service_action(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    name = data.get('name')
    action = data.get('action')
    if not name or not action:
        return jsonify({'success': False, 'error': 'Name and action required'}), 400

    ok, msg = LinuxCommandService.manage_service(server, name, action)
    return jsonify({'success': ok, 'message': msg})
