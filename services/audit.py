"""Audit trail helper. Never raises: a failed audit write must not break the action itself."""
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from flask import session, has_request_context

from models import db
from models.orm import DateTime

logger = logging.getLogger('shellman.audit')

DEFAULTS = {'retention_days': 180, 'max_rows': 20000}
LIMITS = {'retention_days': (0, 3650), 'max_rows': (0, 5000000)}  # 0 means "no limit"
PRUNE_EVERY_SECONDS = 3600
_DT = DateTime()
_counter = 0
_lock = threading.Lock()
_cfg_cache = {'at': 0.0, 'val': dict(DEFAULTS)}
_last_prune = 0.0


def get_config(fresh=False):
    """Retention settings: retention_days (0 = keep forever) and max_rows (0 = unlimited)."""
    now = time.time()
    if not fresh and now - _cfg_cache['at'] < 60:
        return dict(_cfg_cache['val'])
    cfg = dict(DEFAULTS)
    try:
        for row in db.isolated('SELECT key, value FROM audit_config').fetchall():
            if row['key'] in cfg:
                try:
                    cfg[row['key']] = int(row['value'])
                except (TypeError, ValueError):
                    pass
    except Exception as e:
        logger.debug(f"audit config read failed: {e}")
    _cfg_cache.update(at=now, val=cfg)
    return dict(cfg)


def set_config(values: dict):
    """Validate and save retention settings. Returns the saved config. Raises ValueError on bad input."""
    clean = {}
    for k, (lo, hi) in LIMITS.items():
        if k not in values:
            continue
        try:
            n = int(values[k])
        except (TypeError, ValueError):
            raise ValueError(f'{k} must be a whole number')
        if n < lo or n > hi:
            raise ValueError(f'{k} must be between {lo} and {hi} (0 = no limit)')
        clean[k] = n
    for k, n in clean.items():
        db.isolated('INSERT INTO audit_config (key, value) VALUES (?, ?) '
                    'ON CONFLICT(key) DO UPDATE SET value = excluded.value', (k, str(n)))
    _cfg_cache['at'] = 0.0
    return get_config(fresh=True)


def _ip():
    try:
        from security import client_ip
        return client_ip()
    except Exception:
        return ''


def audit(action: str, target: str = '', detail: str = '', ok: bool = True, username: str = None):
    """Record one event. Uses its own connection so it never commits the caller's pending work."""
    global _counter
    try:
        user = username
        ip = ''
        if has_request_context():
            user = user or session.get('username') or ''
            ip = _ip()
        row = {
            'ts': datetime.now(timezone.utc),
            'username': (user or '')[:80],
            'ip': ip[:64],
            'action': action[:60],
            'target': (target or '')[:255],
            'detail': (detail or '')[:2000],
            'ok': bool(ok),
        }
        db.isolated(
            'INSERT INTO audit_log (ts, username, ip, action, target, detail, ok) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (_DT.to_db(row['ts']), row['username'], row['ip'], row['action'], row['target'], row['detail'], 1 if row['ok'] else 0))
        with _lock:
            _counter += 1
            prune = _counter % 200 == 0 or time.time() - _last_prune > PRUNE_EVERY_SECONDS
        if prune:
            _prune()
    except Exception as e:
        logger.debug(f"audit write failed: {e}")


def _prune():
    """Apply the retention settings: drop rows older than retention_days, then trim to max_rows."""
    global _last_prune
    _last_prune = time.time()
    removed = 0
    try:
        cfg = get_config()
        if cfg['retention_days'] > 0:
            cutoff = datetime.now(timezone.utc) - timedelta(days=cfg['retention_days'])
            removed += db.isolated('DELETE FROM audit_log WHERE ts < ?', (_DT.to_db(cutoff),)).rowcount or 0
        cap = cfg['max_rows']
        if cap > 0:
            total = db.isolated('SELECT COUNT(*) FROM audit_log').fetchone()[0]
            if total > cap:
                row = db.isolated('SELECT id FROM audit_log ORDER BY id DESC LIMIT 1 OFFSET ?', (cap - 1,)).fetchone()
                if row:
                    removed += db.isolated('DELETE FROM audit_log WHERE id < ?', (row[0],)).rowcount or 0
    except Exception as e:
        logger.debug(f"audit prune failed: {e}")
    return removed


def prune_now():
    return _prune()
