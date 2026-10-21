from datetime import datetime, timezone
from flask import Blueprint, render_template, jsonify, request
from models import db
from models.server import Server
from routes.auth_helpers import login_required
from services.monitoring import SystemMonitor

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/')
@login_required
def index():
    servers = Server.query.all()
    selected_server_id = request.args.get('server_id', type=int)
    
    selected_server = None
    if selected_server_id:
        selected_server = Server.query.get(selected_server_id)
    if not selected_server and servers:
        selected_server = servers[0]

    initial_app = request.args.get('app', '')
    return render_template('dashboard.html', servers=servers, selected_server=selected_server, initial_app=initial_app)

@dashboard_bp.route('/api/servers/<int:server_id>/metrics')
@login_required
def server_metrics(server_id):
    force = request.args.get('force', 'false').lower() in ('1', 'true', 'yes')
    server = Server.query.get_or_404(server_id)
    metrics = SystemMonitor.get_quick_metrics(server, force=force)
    
    if 'error' in metrics:
        server.is_online = False
        db.session.commit()
        return jsonify({'online': False, 'error': metrics['error']})

    server.is_online = True
    server.last_check = datetime.now(timezone.utc)
    if metrics.get('os'):
        server.os_cache = metrics['os']
    if metrics.get('kernel'):
        server.kernel_cache = metrics['kernel']
    db.session.commit()

    return jsonify({
        'online': True,
        'metrics': metrics,
        'server': server.to_dict()
    })
