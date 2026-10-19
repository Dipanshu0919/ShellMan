from flask import Blueprint, render_template, request, jsonify, redirect, url_for
from models.server import Server
from routes.auth_helpers import login_required
from services.monitoring import SystemMonitor

network_bp = Blueprint('network', __name__)

@network_bp.route('/network')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    return redirect(url_for('dashboard.index', server_id=server_id, app='network'))

@network_bp.route('/api/servers/<int:server_id>/network/info')
@login_required
def network_info(server_id):
    server = Server.query.get_or_404(server_id)
    info = SystemMonitor.get_network_info(server)
    return jsonify({'success': True, 'data': info})
