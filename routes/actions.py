import json
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, Response
from routes.auth_helpers import login_required
from models import db
from models.action import CustomAction
from models.server import Server
from services.action_service import ActionExecutionService

actions_bp = Blueprint('actions', __name__, url_prefix='/api/actions')

@actions_bp.route('', methods=['GET'])
@login_required
def list_actions():
    """List available custom and built-in actions with optional selection filtering."""
    server_id = request.args.get('server_id', type=int)
    target_type = request.args.get('target_type')  # 'files', 'folders', 'both', 'multiple'
    ext = (request.args.get('extension') or '').lower().lstrip('.')

    query = CustomAction.query

    # Filter by server scope: actions with server_id NULL apply to all servers
    if server_id:
        query = query.filter((CustomAction.server_id == None) | (CustomAction.server_id == server_id))

    actions = query.order_by(CustomAction.is_builtin.desc(), CustomAction.id.asc()).all()
    results = []

    for a in actions:
        # Check target_type compatibility
        if target_type:
            if a.target_type != 'both':
                if target_type == 'multiple' and a.target_type != 'multiple':
                    continue
                if target_type == 'files' and a.target_type not in ('files', 'both'):
                    continue
                if target_type == 'folders' and a.target_type not in ('folders', 'both'):
                    continue

        # Check file extension filter if configured on action
        if a.file_extensions and ext:
            allowed = [e.strip().lower() for e in a.file_extensions.split(',') if e.strip()]
            if allowed and ext not in allowed:
                continue

        results.append(a.to_dict())

    return jsonify({'success': True, 'actions': results})


@actions_bp.route('', methods=['POST'])
@login_required
def create_action():
    """Create a new custom action."""
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    command = (data.get('command') or '').strip()

    if not name:
        return jsonify({'success': False, 'error': 'Action name is required'}), 400
    if not command:
        return jsonify({'success': False, 'error': 'Command is required'}), 400

    target_type = data.get('target_type', 'both')
    if target_type not in ('files', 'folders', 'both', 'multiple'):
        target_type = 'both'

    output_target = data.get('output_target', 'panel')
    if output_target not in ('panel', 'terminal'):
        output_target = 'panel'

    action = CustomAction(
        name=name,
        description=(data.get('description') or '').strip(),
        icon=data.get('icon') or 'terminal',
        command=command,
        target_type=target_type,
        file_extensions=(data.get('file_extensions') or '').strip(),
        server_id=data.get('server_id') or None,
        output_target=output_target,
        require_confirm=bool(data.get('require_confirm', True)),
        timeout=max(5, min(int(data.get('timeout', 30)), 180)),
        is_builtin=False
    )

    db.session.add(action)
    db.session.commit()

    return jsonify({'success': True, 'action': action.to_dict()}), 201


@actions_bp.route('/<int:action_id>', methods=['PUT'])
@login_required
def update_action(action_id):
    """Update an existing custom action."""
    action = CustomAction.query.get_or_404(action_id)
    data = request.get_json() or {}

    if 'name' in data:
        name = data['name'].strip()
        if not name:
            return jsonify({'success': False, 'error': 'Name cannot be empty'}), 400
        action.name = name

    if 'command' in data:
        cmd = data['command'].strip()
        if not cmd:
            return jsonify({'success': False, 'error': 'Command cannot be empty'}), 400
        action.command = cmd

    if 'description' in data:
        action.description = data['description'].strip()
    if 'icon' in data:
        action.icon = data['icon']
    if 'target_type' in data and data['target_type'] in ('files', 'folders', 'both', 'multiple'):
        action.target_type = data['target_type']
    if 'file_extensions' in data:
        action.file_extensions = data['file_extensions'].strip()
    if 'server_id' in data:
        action.server_id = data['server_id'] or None
    if 'output_target' in data and data['output_target'] in ('panel', 'terminal'):
        action.output_target = data['output_target']
    if 'require_confirm' in data:
        action.require_confirm = bool(data['require_confirm'])
    if 'timeout' in data:
        action.timeout = max(5, min(int(data['timeout']), 180))

    db.session.commit()
    return jsonify({'success': True, 'action': action.to_dict()})


@actions_bp.route('/<int:action_id>', methods=['DELETE'])
@login_required
def delete_action(action_id):
    """Delete a custom action."""
    action = CustomAction.query.get_or_404(action_id)
    db.session.delete(action)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Action deleted successfully'})


@actions_bp.route('/<int:action_id>/preview', methods=['POST'])
@login_required
def preview_action(action_id):
    """Resolve action variables and return preview before execution."""
    action = CustomAction.query.get_or_404(action_id)
    data = request.get_json() or {}
    server_id = data.get('server_id')

    server = Server.query.get(server_id) if server_id else None
    if not server:
        return jsonify({'success': False, 'error': 'Valid target server is required'}), 400

    resolved = ActionExecutionService.resolve_variables(
        template=action.command,
        server=server,
        selected_path=data.get('selected_path', ''),
        selected_paths=data.get('selected_paths', []),
        current_dir=data.get('current_dir', '/')
    )

    return jsonify({
        'success': True,
        'action': action.to_dict(),
        'preview': resolved
    })


@actions_bp.route('/<int:action_id>/execute', methods=['POST'])
@login_required
def execute_action(action_id):
    """Execute custom action safely on the target host."""
    action = CustomAction.query.get_or_404(action_id)
    data = request.get_json() or {}
    server_id = data.get('server_id')

    server = Server.query.get(server_id) if server_id else None
    if not server:
        return jsonify({'success': False, 'error': 'Valid target server is required'}), 400

    result = ActionExecutionService.execute_action(
        server=server,
        action=action,
        selected_path=data.get('selected_path', ''),
        selected_paths=data.get('selected_paths', []),
        current_dir=data.get('current_dir', '/')
    )

    return jsonify({
        'success': result['success'],
        'action_name': action.name,
        'output_target': action.output_target,
        'result': result
    })


@actions_bp.route('/export', methods=['GET'])
@login_required
def export_actions():
    """Export all actions as a reusable JSON file."""
    actions = CustomAction.query.all()
    export_data = {
        'generator': 'ShellMan Custom Actions v1.0',
        'exported_at': datetime.now(timezone.utc).isoformat(),
        'actions': [
            {
                'name': a.name,
                'description': a.description,
                'icon': a.icon,
                'command': a.command,
                'target_type': a.target_type,
                'file_extensions': a.file_extensions,
                'output_target': a.output_target,
                'require_confirm': a.require_confirm,
                'timeout': a.timeout
            }
            for a in actions
        ]
    }
    return Response(
        json.dumps(export_data, indent=2),
        mimetype='application/json',
        headers={'Content-Disposition': 'attachment;filename=shellman-custom-actions.json'}
    )


@actions_bp.route('/import', methods=['POST'])
@login_required
def import_actions():
    """Import actions safely without auto-executing."""
    data = request.get_json() or {}
    action_list = data.get('actions', [])
    if not isinstance(action_list, list) or len(action_list) == 0:
        return jsonify({'success': False, 'error': 'No valid actions found in import payload'}), 400

    imported_count = 0
    for item in action_list:
        name = (item.get('name') or '').strip()
        command = (item.get('command') or '').strip()
        if not name or not command:
            continue

        act = CustomAction(
            name=name,
            description=(item.get('description') or '').strip(),
            icon=item.get('icon') or 'terminal',
            command=command,
            target_type=item.get('target_type') if item.get('target_type') in ('files', 'folders', 'both', 'multiple') else 'both',
            file_extensions=(item.get('file_extensions') or '').strip(),
            output_target=item.get('output_target') if item.get('output_target') in ('panel', 'terminal') else 'panel',
            require_confirm=True,  # Imported actions always require confirmation by default for security
            timeout=max(5, min(int(item.get('timeout', 30)), 180)),
            is_builtin=False
        )
        db.session.add(act)
        imported_count += 1

    db.session.commit()
    return jsonify({'success': True, 'imported_count': imported_count})
