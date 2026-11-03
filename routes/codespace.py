from datetime import timedelta
from flask import Blueprint, jsonify, request

from models import db
from models.server import Server
from models.timelimit import TimeLimit, ServerUsage
from models.github_token import GithubToken
from routes.auth_helpers import login_required
from services import codespace as cs
from services import quota
from services.audit import audit
from services.ssh_manager import ssh_manager

codespace_bp = Blueprint('codespace', __name__)


def resolve_token(raw):
    """A token typed by the user, or "saved:<id>" meaning one stored under a name. Returns the plain token or ''."""
    raw = (raw or '').strip()
    if raw.startswith('saved:'):
        try:
            row = GithubToken.query.get(int(raw[6:]))
        except ValueError:
            row = None
        return row.token if row else ''
    return raw


def _server(server_id):
    server = Server.query.get_or_404(server_id)
    if not server.is_codespace:
        return None
    return server


def _not_codespace():
    return jsonify({'success': False, 'error': 'This server is not a GitHub Codespace.'}), 400


def _overview(server):
    try:
        info = cs.get_state(server)
        err = ''
    except cs.CodespaceError as e:
        info, err = None, str(e)
    return {'success': True, 'codespace': info, 'error': err, 'quota': quota.status(server)}


@codespace_bp.route('/api/codespaces/discover', methods=['POST'])
@login_required
def discover():
    """List the Codespaces of a GitHub token so the user can pick one instead of typing its name."""
    token = resolve_token((request.get_json(silent=True) or {}).get('gh_token'))
    if len(token) < 20 or any(c.isspace() for c in token):
        return jsonify({'success': False, 'error': 'Paste a GitHub token first.'}), 400
    try:
        return jsonify({'success': True, 'codespaces': cs.list_codespaces(token)})
    except cs.CodespaceError as e:
        return jsonify({'success': False, 'error': str(e)}), 400


def _token_arg(data):
    token = resolve_token(data.get('gh_token'))
    if len(token) < 20 or any(c.isspace() for c in token):
        return None
    return token


@codespace_bp.route('/api/github-tokens', methods=['GET'])
@login_required
def tokens_list():
    rows = GithubToken.query.order_by(GithubToken.label).all()
    return jsonify({'success': True, 'tokens': [r.to_dict() for r in rows]})


@codespace_bp.route('/api/github-tokens', methods=['POST'])
@login_required
def tokens_add():
    """Save a token under a name. It is checked with GitHub first, which also tells us the account it belongs to."""
    data = request.get_json(silent=True) or {}
    token = (data.get('gh_token') or '').strip()
    label = (data.get('label') or '').strip()[:80]
    if len(token) < 20 or any(c.isspace() for c in token):
        return jsonify({'success': False, 'error': 'That does not look like a GitHub token.'}), 400
    try:
        login = (cs._request(token, 'GET', '/user') or {}).get('login') or ''
    except cs.CodespaceError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    label = label or login or 'GitHub token'
    if GithubToken.query.filter_by(label=label).first():
        return jsonify({'success': False, 'error': f'A saved token is already named "{label}". Pick another name.'}), 400
    row = GithubToken(label=label, login=login)
    row.token = token
    db.session.add(row)
    db.session.commit()
    audit('github_token.save', target=label, detail=f'account={login}')
    return jsonify({'success': True, 'token': row.to_dict()})


@codespace_bp.route('/api/github-tokens/<int:token_id>', methods=['DELETE'])
@login_required
def tokens_delete(token_id):
    row = GithubToken.query.get_or_404(token_id)
    label = row.label
    db.session.delete(row)
    db.session.commit()
    audit('github_token.delete', target=label)
    return jsonify({'success': True})


@codespace_bp.route('/api/codespaces/repos', methods=['POST'])
@login_required
def repos():
    data = request.get_json(silent=True) or {}
    token = _token_arg(data)
    if not token:
        return jsonify({'success': False, 'error': 'Paste a GitHub token first.'}), 400
    try:
        return jsonify({'success': True, 'repos': cs.list_repos(token, data.get('q'))})
    except cs.CodespaceError as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@codespace_bp.route('/api/codespaces/machines', methods=['POST'])
@login_required
def machines():
    data = request.get_json(silent=True) or {}
    token = _token_arg(data)
    if not token:
        return jsonify({'success': False, 'error': 'Paste a GitHub token first.'}), 400
    try:
        return jsonify({'success': True, 'machines': cs.list_machines(
            token, (data.get('repo') or '').strip(), (data.get('ref') or '').strip())})
    except cs.CodespaceError as e:
        return jsonify({'success': False, 'error': str(e)}), 400


@codespace_bp.route('/api/codespaces/create', methods=['POST'])
@login_required
def create_codespace():
    """Create a brand new Codespace in a repository. The caller then saves it as a server."""
    data = request.get_json(silent=True) or {}
    token = _token_arg(data)
    if not token:
        return jsonify({'success': False, 'error': 'Paste a GitHub token first.'}), 400
    try:
        info = cs.create(token, (data.get('repo') or '').strip(), (data.get('machine') or '').strip(),
                         (data.get('ref') or '').strip(), data.get('idle_timeout_minutes') or 30,
                         data.get('display_name') or '')
    except (cs.CodespaceError, ValueError) as e:
        return jsonify({'success': False, 'error': str(e) if isinstance(e, cs.CodespaceError)
                        else 'Idle timeout must be a number of minutes.'}), 400
    audit('codespace.create', target=info.get('name') or '', detail=f"{data.get('repo')} {data.get('machine')}")
    return jsonify({'success': True, 'codespace': info})


@codespace_bp.route('/api/servers/<int:server_id>/codespace', methods=['GET'])
@login_required
def overview(server_id):
    server = _server(server_id)
    return jsonify(_overview(server)) if server else _not_codespace()


@codespace_bp.route('/api/servers/<int:server_id>/codespace/start', methods=['POST'])
@login_required
def start(server_id):
    server = _server(server_id)
    if not server:
        return _not_codespace()
    try:
        quota.check_may_run(server)
        info = cs.start(server)
    except cs.CodespaceError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    audit('codespace.start', target=server.name)
    return jsonify({'success': True, 'codespace': info, 'quota': quota.status(server)})


@codespace_bp.route('/api/servers/<int:server_id>/codespace/stop', methods=['POST'])
@login_required
def stop(server_id):
    server = _server(server_id)
    if not server:
        return _not_codespace()
    try:
        ssh_manager.disconnect(server.id)
        info = cs.stop(server)
    except cs.CodespaceError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    audit('codespace.stop', target=server.name)
    return jsonify({'success': True, 'codespace': info, 'quota': quota.status(server)})


@codespace_bp.route('/api/servers/<int:server_id>/time-limit', methods=['GET'])
@login_required
def get_limit(server_id):
    server = _server(server_id)
    if not server:
        return _not_codespace()
    return jsonify({'success': True, 'quota': quota.status(server)})


@codespace_bp.route('/api/servers/<int:server_id>/time-limit', methods=['PUT'])
@login_required
def set_limit(server_id):
    server = _server(server_id)
    if not server:
        return _not_codespace()
    d = request.get_json(silent=True) or {}
    period = d.get('period', 'month')
    action = d.get('action', 'stop')
    try:
        hours = float(d.get('limit_hours'))
        warn = int(d.get('warn_pct', 80))
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'Hours and warning percent must be numbers.'}), 400
    if period not in quota.PERIODS or action not in ('stop', 'warn'):
        return jsonify({'success': False, 'error': 'Invalid period or action.'}), 400
    if not (0.1 <= hours <= 100000) or not (1 <= warn <= 100):
        return jsonify({'success': False, 'error': 'Hours must be at least 0.1 and the warning between 1 and 100%.'}), 400
    limit = quota.get_limit(server.id) or TimeLimit(server_id=server.id, kind='quota')
    limit.period, limit.action, limit.warn_pct = period, action, warn
    limit.limit_minutes = int(round(hours * 60))
    limit.weight_by_cores = bool(d.get('weight_by_cores', True))
    limit.enabled = bool(d.get('enabled', True))
    # A new budget starts a fresh warning cycle
    limit.warned_key = limit.stopped_key = None
    db.session.add(limit)
    db.session.commit()
    audit('quota.set', target=server.name, detail=f"{hours:g} h per {period}, action={action}, cores={limit.weight_by_cores}")
    return jsonify({'success': True, 'quota': quota.status(server)})


@codespace_bp.route('/api/servers/<int:server_id>/time-limit', methods=['DELETE'])
@login_required
def delete_limit(server_id):
    server = _server(server_id)
    if not server:
        return _not_codespace()
    TimeLimit.query.filter_by(server_id=server.id).delete()
    audit('quota.remove', target=server.name)
    return jsonify({'success': True, 'quota': quota.status(server)})


@codespace_bp.route('/api/servers/<int:server_id>/time-limit/extend', methods=['POST'])
@login_required
def extend_limit(server_id):
    server = _server(server_id)
    if not server:
        return _not_codespace()
    try:
        minutes = int(round(float((request.get_json(silent=True) or {}).get('hours', 1)) * 60))
        if not (1 <= minutes <= 24 * 60):
            raise ValueError
        quota.add_bonus(server, minutes)
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e) or 'Add between 1 minute and 24 hours.'}), 400
    audit('quota.extend', target=server.name, detail=f'+{minutes} min')
    return jsonify({'success': True, 'quota': quota.status(server)})


@codespace_bp.route('/api/servers/<int:server_id>/usage', methods=['GET'])
@login_required
def usage(server_id):
    server = _server(server_id)
    if not server:
        return _not_codespace()
    days = max(1, min(92, request.args.get('days', 31, type=int)))
    start = (quota._today() - timedelta(days=days - 1)).isoformat()
    rows = ServerUsage.query.filter(ServerUsage.server_id == server.id, ServerUsage.day >= start) \
        .order_by(ServerUsage.day).all()
    return jsonify({'success': True, 'days': [
        {'day': r.day, 'minutes': round(r.minutes or 0, 1), 'core_minutes': round(r.core_minutes or 0, 1)} for r in rows]})
