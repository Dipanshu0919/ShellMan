import logging
from flask import Blueprint, jsonify, request
from routes.auth_helpers import login_required
from models.server import Server
from services.docker_service import docker_service

logger = logging.getLogger('shellman.routes.docker')

docker_bp = Blueprint('docker', __name__)

@docker_bp.route('/api/servers/<int:server_id>/docker/status', methods=['GET'])
@login_required
def docker_status(server_id):
    server = Server.query.get_or_404(server_id)
    try:
        status = docker_service.get_status(server)
        return jsonify({'success': True, 'status': status})
    except Exception as e:
        logger.error(f"Error fetching docker status for server {server_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@docker_bp.route('/api/servers/<int:server_id>/docker/containers', methods=['GET'])
@login_required
def docker_containers(server_id):
    server = Server.query.get_or_404(server_id)
    try:
        containers = docker_service.list_containers(server)
        return jsonify({'success': True, 'containers': containers, 'total': len(containers)})
    except Exception as e:
        logger.error(f"Error listing docker containers for server {server_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@docker_bp.route('/api/servers/<int:server_id>/docker/stats', methods=['GET'])
@login_required
def docker_stats(server_id):
    server = Server.query.get_or_404(server_id)
    try:
        stats = docker_service.get_container_stats(server)
        return jsonify({'success': True, 'stats': stats})
    except Exception as e:
        logger.error(f"Error fetching docker stats for server {server_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@docker_bp.route('/api/servers/<int:server_id>/docker/action', methods=['POST'])
@login_required
def docker_container_action(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    container_id = data.get('container_id', '').strip()
    action = data.get('action', '').strip().lower()

    if not container_id or not action:
        return jsonify({'success': False, 'error': 'container_id and action are required.'}), 400

    try:
        res = docker_service.container_action(server, container_id, action)
        status_code = 200 if res.get('success') else 400
        return jsonify(res), status_code
    except Exception as e:
        logger.error(f"Error executing docker action on server {server_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@docker_bp.route('/api/servers/<int:server_id>/docker/logs/<container_id>', methods=['GET'])
@login_required
def docker_logs(server_id, container_id):
    server = Server.query.get_or_404(server_id)
    tail = request.args.get('tail', default=250, type=int)
    try:
        logs_data = docker_service.get_container_logs(server, container_id, tail=tail)
        return jsonify(logs_data)
    except Exception as e:
        logger.error(f"Error retrieving logs for container {container_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@docker_bp.route('/api/servers/<int:server_id>/docker/compose/projects', methods=['GET'])
@login_required
def docker_compose_projects(server_id):
    server = Server.query.get_or_404(server_id)
    try:
        projects = docker_service.list_compose_projects(server)
        return jsonify({'success': True, 'projects': projects})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@docker_bp.route('/api/servers/<int:server_id>/docker/compose/action', methods=['POST'])
@login_required
def docker_compose_action(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    work_dir = data.get('work_dir', '').strip()
    action = data.get('action', 'up').strip().lower()
    compose_file = data.get('compose_file', None)

    if not work_dir:
        return jsonify({'success': False, 'error': 'work_dir is required for Compose operations.'}), 400

    try:
        res = docker_service.compose_action(server, work_dir, action, compose_file=compose_file)
        status_code = 200 if res.get('success') else 400
        return jsonify(res), status_code
    except Exception as e:
        logger.error(f"Error running compose action on server {server_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
