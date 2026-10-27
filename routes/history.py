from flask import Blueprint, jsonify, request

from models import db
from models.server import Server
from routes.auth_helpers import login_required, get_current_user
from services import history
from services.audit import audit

history_bp = Blueprint('history', __name__)


@history_bp.route('/api/fleet', methods=['GET'])
@login_required
def fleet():
    """Every server's latest reading in one answer (from stored samples, no SSH)."""
    servers = Server.query.all()
    cfg = history.get_config()
    try:
        from services.alerts import engine
        engine_on = bool(engine.running)
    except Exception:
        engine_on = False
    return jsonify({'success': True, 'servers': history.fleet(servers), 'history': cfg, 'engine_running': engine_on})


@history_bp.route('/api/fleet/live', methods=['GET'])
@login_required
def fleet_live():
    """Fresh CPU, memory and disk for every server, read over SSH in parallel (a few seconds old at most).

    Stopped Codespaces are not contacted, so polling never wakes one or uses quota.
    """
    from concurrent.futures import ThreadPoolExecutor, wait
    from services.monitoring import SystemMonitor

    servers = Server.query.all()
    out, jobs = {}, {}

    def read(server):
        try:
            return SystemMonitor.latest_metrics(server)
        except Exception as e:
            return {'error': str(e)}

    todo = []
    for s in servers:
        if s.is_codespace:
            from services import codespace as _cs
            info = _cs.cached_state(s.id)
            if info is None or not info['available']:
                out[s.id] = {'id': s.id, 'online': False, 'sample': None}
                continue
        todo.append(s)

    pool = ThreadPoolExecutor(max_workers=min(8, max(1, len(todo))))
    try:
        for s in todo:
            jobs[pool.submit(read, s)] = s
        done, _ = wait(list(jobs), timeout=8)
        for f, s in jobs.items():
            m = f.result() if f in done else {'error': 'timed out'}
            if not m or 'error' in m:
                out[s.id] = {'id': s.id, 'online': False, 'sample': None}
                continue
            try:
                cpu, mem, disk, load1 = history._numbers(m)
            except Exception:
                out[s.id] = {'id': s.id, 'online': False, 'sample': None}
                continue
            history.record(s.id, m)
            out[s.id] = {'id': s.id, 'online': True,
                         'sample': {'cpu': cpu, 'mem': mem, 'disk': disk, 'load': load1, 'age': 0}}
    finally:
        pool.shutdown(wait=False)
    for s in servers:
        r = out.get(s.id)
        if r is not None and bool(s.is_online) != r['online'] and not (s.is_codespace and not r['online']):
            s.is_online = r['online']
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
    return jsonify({'success': True, 'servers': list(out.values())})


@history_bp.route('/api/servers/<int:server_id>/history', methods=['GET'])
@login_required
def server_history(server_id):
    Server.query.get_or_404(server_id)
    key = request.args.get('range', '24h')
    data = history.series(server_id, key)
    data['success'] = True
    data['history'] = history.get_config()
    return jsonify(data)


@history_bp.route('/api/history/settings', methods=['GET'])
@login_required
def settings_get():
    return jsonify({'success': True, **history.get_config(fresh=True)})


@history_bp.route('/api/history/settings', methods=['PUT'])
@login_required
def settings_put():
    user = get_current_user()
    if not user or not user.is_admin:
        return jsonify({'success': False, 'error': 'Only an administrator can change this.'}), 403
    try:
        cfg = history.set_config(request.get_json(silent=True) or {})
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    audit('history.settings', detail=f"keep {cfg['history_days']} days, {'on' if cfg['history_enabled'] else 'off'}")
    return jsonify({'success': True, **cfg})


@history_bp.route('/api/history/clear', methods=['POST'])
@login_required
def clear():
    user = get_current_user()
    if not user or not user.is_admin:
        return jsonify({'success': False, 'error': 'Only an administrator can change this.'}), 403
    removed = db.isolated('DELETE FROM metric_samples').rowcount or 0
    audit('history.clear', detail=f'{removed} readings')
    return jsonify({'success': True, 'removed': removed})
