import logging
from flask import Blueprint, jsonify, request
from routes.auth_helpers import login_required
from models.server import Server
from services.firewall_service import firewall_service

logger = logging.getLogger('shellman.routes.firewall')

firewall_bp = Blueprint('firewall', __name__)

@firewall_bp.route('/api/servers/<int:server_id>/firewall/status', methods=['GET'])
@login_required
def ufw_status(server_id):
    server = Server.query.get_or_404(server_id)
    try:
        res = firewall_service.get_ufw_status(server)
        return jsonify({'success': True, 'firewall': res})
    except Exception as e:
        logger.error(f"Error fetching firewall status for server {server_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@firewall_bp.route('/api/servers/<int:server_id>/firewall/toggle', methods=['POST'])
@login_required
def ufw_toggle(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    enable = bool(data.get('enable', True))
    try:
        res = firewall_service.toggle_ufw(server, enable=enable)
        return jsonify(res)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@firewall_bp.route('/api/servers/<int:server_id>/firewall/rule/add', methods=['POST'])
@login_required
def ufw_add_rule(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    rule_type = data.get('type', 'allow_port')
    target = data.get('target', '').strip()
    proto = data.get('proto', 'tcp')
    comment = data.get('comment', None)

    if not target:
        return jsonify({'success': False, 'error': 'Target port or IP is required.'}), 400

    try:
        res = firewall_service.add_rule(server, rule_type, target, proto=proto, comment=comment)
        status_code = 200 if res.get('success') else 400
        return jsonify(res), status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@firewall_bp.route('/api/servers/<int:server_id>/firewall/rule/delete', methods=['POST'])
@login_required
def ufw_delete_rule(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    rule_num = data.get('rule_number')
    if rule_num is None:
        return jsonify({'success': False, 'error': 'Rule number is required.'}), 400

    try:
        res = firewall_service.delete_rule(server, int(rule_num))
        status_code = 200 if res.get('success') else 400
        return jsonify(res), status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@firewall_bp.route('/api/servers/<int:server_id>/firewall/fail2ban/status', methods=['GET'])
@login_required
def fail2ban_status(server_id):
    server = Server.query.get_or_404(server_id)
    try:
        res = firewall_service.get_fail2ban_status(server)
        return jsonify({'success': True, 'fail2ban': res})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@firewall_bp.route('/api/servers/<int:server_id>/firewall/fail2ban/action', methods=['POST'])
@login_required
def fail2ban_action(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    action = data.get('action', 'unban').strip().lower()
    jail = data.get('jail', 'sshd').strip()
    ip = data.get('ip', '').strip()

    if not ip or not jail:
        return jsonify({'success': False, 'error': 'IP and jail name are required.'}), 400

    try:
        res = firewall_service.fail2ban_action(server, action, jail, ip)
        return jsonify(res)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@firewall_bp.route('/api/servers/<int:server_id>/firewall/ban-ip', methods=['POST'])
@login_required
def emergency_ban(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    ip = data.get('ip', '').strip()
    comment = data.get('comment', 'DDoS Block')

    if not ip:
        return jsonify({'success': False, 'error': 'IP address is required.'}), 400

    try:
        res = firewall_service.emergency_ban_ip(server, ip, comment=comment)
        status_code = 200 if res.get('success') else 400
        return jsonify(res), status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
