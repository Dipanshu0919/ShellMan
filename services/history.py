"""Metric history: one small reading per server per minute, kept for a few days.

The background alert engine already reads every server once per check, so history costs no extra connections.
Readings are plain rows in SQLite and are averaged into at most ~240 points when a graph asks for them, so a
week of data for ten servers stays well under 10 MB and a graph request touches very little memory.
"""
import logging
import threading
import time

from models import db

logger = logging.getLogger('shellman.history')

MIN_GAP_SECONDS = 55           # at most one stored reading per server per minute
PRUNE_EVERY_SECONDS = 3600
DEFAULTS = {'history_enabled': 1, 'history_days': 7}
LIMITS = {'history_enabled': (0, 1), 'history_days': (1, 90)}
RANGES = {'1h': 3600, '6h': 6 * 3600, '24h': 24 * 3600, '7d': 7 * 86400, '30d': 30 * 86400}
MAX_POINTS = 240

_lock = threading.Lock()
_last_saved = {}                # server_id -> unix seconds of the last stored reading
_cfg = {'at': 0.0, 'val': dict(DEFAULTS)}
_last_prune = 0.0
_index_ready = False


def ensure_index():
    global _index_ready
    if _index_ready:
        return
    try:
        db.isolated('CREATE INDEX IF NOT EXISTS ix_metric_samples_server_ts ON metric_samples (server_id, ts)')
        _index_ready = True
    except Exception as e:
        logger.debug(f'history index not created: {e}')


# ------------------------------------------------------------------ settings
def get_config(fresh=False):
    now = time.time()
    if not fresh and now - _cfg['at'] < 30:
        return dict(_cfg['val'])
    cfg = dict(DEFAULTS)
    try:
        for row in db.isolated("SELECT key, value FROM app_settings WHERE key LIKE 'history_%'").fetchall():
            if row['key'] in cfg:
                try:
                    cfg[row['key']] = int(row['value'])
                except (TypeError, ValueError):
                    pass
    except Exception as e:
        logger.debug(f'history config read failed: {e}')
    _cfg.update(at=now, val=cfg)
    return dict(cfg)


def set_config(values):
    clean = {}
    for k, (lo, hi) in LIMITS.items():
        if k not in values:
            continue
        try:
            n = int(values[k])
        except (TypeError, ValueError):
            raise ValueError(f'{k} must be a whole number')
        if n < lo or n > hi:
            raise ValueError(f'{k} must be between {lo} and {hi}')
        clean[k] = n
    for k, n in clean.items():
        db.isolated('INSERT INTO app_settings (key, value) VALUES (?, ?) '
                    'ON CONFLICT(key) DO UPDATE SET value = excluded.value', (k, str(n)))
    _cfg['at'] = 0.0
    return get_config(fresh=True)


def enabled():
    return bool(get_config()['history_enabled'])


# ------------------------------------------------------------------ writing
def _numbers(m):
    """CPU %, memory %, disk %, 1-minute load: the same fields the desktop widget and System Overview show
    (metrics['cpu'], ['memory']['percent'], ['disk']['percent']), so every screen agrees."""
    disk_d = m.get('disk') or {}
    disk = disk_d.get('percent')
    if disk is None:                      # older readings without a root figure: fullest filesystem
        fs = disk_d.get('filesystems') or []
        disk = max([float(d.get('percent') or 0) for d in fs] or [0])
    load = m.get('load') or [0]
    return (round(float(m.get('cpu') or 0), 1),
            round(float((m.get('memory') or {}).get('percent') or 0), 1),
            round(float(disk or 0), 1),
            round(float(load[0] or 0), 2))


def record(server_id, metrics):
    """Store one reading (skipped when history is off, the server answered with an error, or one was just stored)."""
    if not metrics or 'error' in metrics or not enabled():
        return False
    now = int(time.time())
    with _lock:
        if now - _last_saved.get(server_id, 0) < MIN_GAP_SECONDS:
            return False
        _last_saved[server_id] = now
    ensure_index()
    try:
        cpu, mem, disk, load1 = _numbers(metrics)
        db.isolated('INSERT INTO metric_samples (server_id, ts, cpu, mem, disk, load1) VALUES (?, ?, ?, ?, ?, ?)',
                    (server_id, now, cpu, mem, disk, load1))
    except Exception as e:
        logger.debug(f'history write failed: {e}')
        return False
    _maybe_prune()
    return True


def _maybe_prune():
    global _last_prune
    now = time.time()
    with _lock:
        if now - _last_prune < PRUNE_EVERY_SECONDS:
            return
        _last_prune = now
    prune()


def prune():
    """Drop readings older than the retention setting."""
    try:
        cutoff = int(time.time()) - get_config()['history_days'] * 86400
        return db.isolated('DELETE FROM metric_samples WHERE ts < ?', (cutoff,)).rowcount or 0
    except Exception as e:
        logger.debug(f'history prune failed: {e}')
        return 0


def forget_server(server_id):
    with _lock:
        _last_saved.pop(server_id, None)
    try:
        db.isolated('DELETE FROM metric_samples WHERE server_id = ?', (server_id,))
    except Exception:
        pass


# ------------------------------------------------------------------ reading
def series(server_id, range_key='24h'):
    """Averaged points for graphs: {'range', 'bucket', 'points': [{t, cpu, mem, disk, load, cpu_max}]}."""
    span = RANGES.get(range_key) or RANGES['24h']
    span = min(span, get_config()['history_days'] * 86400)
    now = int(time.time())
    bucket = max(60, span // MAX_POINTS)
    rows = db.isolated(
        'SELECT (ts / ?) * ? AS t, AVG(cpu) AS cpu, AVG(mem) AS mem, AVG(disk) AS disk, AVG(load1) AS load1, '
        'MAX(cpu) AS cpu_max, COUNT(*) AS n FROM metric_samples WHERE server_id = ? AND ts >= ? '
        'GROUP BY t ORDER BY t', (bucket, bucket, server_id, now - span)).fetchall()
    points = [{'t': r['t'], 'cpu': round(r['cpu'] or 0, 1), 'mem': round(r['mem'] or 0, 1),
               'disk': round(r['disk'] or 0, 1), 'load': round(r['load1'] or 0, 2),
               'cpu_max': round(r['cpu_max'] or 0, 1)} for r in rows]
    return {'range': range_key if range_key in RANGES else '24h', 'span': span, 'bucket': bucket,
            'from': now - span, 'to': now, 'points': points}


def fleet(servers):
    """Latest reading and a one-hour CPU sparkline for every server (read from stored samples, no SSH)."""
    now = int(time.time())
    out = []
    for s in servers:
        latest = db.isolated('SELECT ts, cpu, mem, disk, load1 FROM metric_samples WHERE server_id = ? '
                             'ORDER BY ts DESC LIMIT 1', (s.id,)).fetchone()
        spark = db.isolated('SELECT ts, cpu FROM metric_samples WHERE server_id = ? AND ts >= ? ORDER BY ts',
                            (s.id, now - 3600)).fetchall()
        age = (now - latest['ts']) if latest else None
        out.append({
            'id': s.id, 'name': s.name, 'kind': getattr(s, 'kind', None) or 'ssh',
            'online': bool(s.is_online),
            'sample': ({'cpu': latest['cpu'], 'mem': latest['mem'], 'disk': latest['disk'],
                        'load': latest['load1'], 'age': age} if latest else None),
            'stale': latest is None or age > 300,
            'spark': [round(r['cpu'] or 0) for r in spark][-60:],
        })
    return out
