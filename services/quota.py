"""Time budgets ("this Codespace may run 20 hours per month") and the usage counting behind them.

How it works
------------
* `tick()` runs once per alert-engine interval. For every GitHub Codespace server it asks GitHub whether the
  Codespace is running and adds the elapsed minutes (and minutes x CPU cores, which is how GitHub bills) to the
  current UTC day in `server_usage`.
* A `TimeLimit` row turns that into a budget per day, week or month. At `warn_pct` ShellMan sends a notification
  through the alert channels; at 100% it can stop the Codespace (`action = 'stop'`) and refuses to start or connect
  until the next period or until the user adds time.
* The count is ShellMan's own estimate. It only counts while ShellMan runs. GitHub's bill is the real figure.
"""
import logging
import time
from datetime import date, datetime, timedelta, timezone

from models import db
from models.server import Server
from models.timelimit import TimeLimit, ServerUsage

logger = logging.getLogger('shellman.quota')

PERIODS = ('day', 'week', 'month')
MAX_GAP_MINUTES = 5.0           # a gap longer than this (ShellMan was down) is not counted as running time
_last_seen = {}                 # server_id -> monotonic time of the previous counted tick


def _today():
    return datetime.now(timezone.utc).date()


def period_start(period, today=None):
    today = today or _today()
    if period == 'day':
        return today
    if period == 'week':
        return today - timedelta(days=today.weekday())       # Monday
    return today.replace(day=1)


def period_key(period, today=None):
    start = period_start(period, today)
    return start.isoformat()


def period_end(period, today=None):
    """First day of the next period (when the counter resets)."""
    start = period_start(period, today)
    if period == 'day':
        return start + timedelta(days=1)
    if period == 'week':
        return start + timedelta(days=7)
    return (start.replace(day=28) + timedelta(days=4)).replace(day=1)


def get_limit(server_id):
    return TimeLimit.query.filter_by(server_id=server_id, kind='quota').first()


def usage_between(server_id, start: date, weighted: bool):
    rows = ServerUsage.query.filter(ServerUsage.server_id == server_id, ServerUsage.day >= start.isoformat()).all()
    return sum((r.core_minutes if weighted else r.minutes) or 0.0 for r in rows)


def effective_limit_minutes(limit: TimeLimit):
    bonus = limit.bonus_minutes if limit.bonus_period_key == period_key(limit.period) else 0
    return limit.limit_minutes + (bonus or 0)


def status(server):
    """Everything the UI needs about usage and budget for one server."""
    limit = get_limit(server.id)
    period = limit.period if limit else 'month'
    weighted = bool(limit.weight_by_cores) if limit else False
    start = period_start(period)
    used = usage_between(server.id, start, weighted)
    out = {
        'has_limit': bool(limit), 'enabled': bool(limit and limit.enabled), 'period': period, 'weighted': weighted,
        'used_minutes': round(used, 1), 'resets_on': period_end(period).isoformat(),
        'limit': limit.to_dict() if limit else None,
        'month_used_minutes': round(usage_between(server.id, period_start('month'), False), 1),
    }
    if limit:
        total = effective_limit_minutes(limit)
        out.update(limit_minutes=total, remaining_minutes=round(max(0.0, total - used), 1),
                   pct=round(100.0 * used / total, 1) if total else 100.0,
                   exceeded=used >= total, bonus_minutes=total - limit.limit_minutes)
    return out


def exceeded(server):
    limit = get_limit(server.id)
    if not limit or not limit.enabled or limit.action != 'stop':
        return False
    return usage_between(server.id, period_start(limit.period), bool(limit.weight_by_cores)) >= effective_limit_minutes(limit)


def check_may_run(server):
    """Raise CodespaceError when the budget is used up and the limit is set to enforce."""
    if exceeded(server):
        from services.codespace import CodespaceError
        st = status(server)
        raise CodespaceError(
            f"Time budget used up ({st['limit_minutes'] / 60:g} h per {st['period']}). "
            f"It resets on {st['resets_on']}, or add more time from the Codespace panel.")


def add_bonus(server, minutes):
    limit = get_limit(server.id)
    if not limit:
        raise ValueError('This server has no time limit.')
    key = period_key(limit.period)
    if limit.bonus_period_key != key:
        limit.bonus_minutes, limit.bonus_period_key = 0, key
    limit.bonus_minutes += int(minutes)
    # Allow a fresh warning/stop announcement in this period if the budget is extended past them.
    limit.stopped_key = None
    db.session.commit()


def _record(server_id, minutes, cpus):
    day = _today().isoformat()
    row = ServerUsage.query.filter_by(server_id=server_id, day=day).first()
    if not row:
        row = ServerUsage(server_id=server_id, day=day, minutes=0.0, core_minutes=0.0)
        db.session.add(row)
    row.minutes = (row.minutes or 0.0) + minutes
    row.core_minutes = (row.core_minutes or 0.0) + minutes * max(1, cpus)
    db.session.commit()


def _notify(app, server, severity, message):
    """Send a message through the alert channels (and keep it in the alert history)."""
    from models.alert import AlertEvent
    from services.alerts import notify_async
    now = datetime.now(timezone.utc)
    ev = AlertEvent(rule_id=None, rule_name='Time budget', server_id=server.id, server_name=server.name,
                    metric='quota', severity=severity, value=None, peak=None, message=message,
                    started_at=now, resolved_at=now, acknowledged=False)
    db.session.add(ev)
    db.session.commit()
    notify_async(app, ev.id, 'firing')
    try:
        from services.audit import audit
        audit('quota.' + ('stopped' if severity == 'critical' else 'warning'), target=server.name, detail=message,
              ok=False, username='quota')
    except Exception:
        pass


def tick(app, interval_seconds=60):
    """Count running time and apply limits for every Codespace server."""
    from services import codespace as cs
    servers = [s for s in Server.query.all() if s.is_codespace and s.gh_token_enc and s.codespace_name]
    now = time.monotonic()
    for server in servers:
        try:
            info = cs.get_state(server, fresh=True)
        except cs.CodespaceError as e:
            logger.debug('state check failed for %s: %s', server.name, e)
            _last_seen.pop(server.id, None)
            continue
        prev = _last_seen.get(server.id)
        if info['available']:
            _last_seen[server.id] = now
            if prev is not None:
                minutes = min((now - prev) / 60.0, MAX_GAP_MINUTES)
                if minutes > 0:
                    _record(server.id, minutes, info['cpus'])
        else:
            _last_seen.pop(server.id, None)
            continue
        _apply_limit(app, server, info)


def _apply_limit(app, server, info):
    from services import codespace as cs
    limit = get_limit(server.id)
    if not limit or not limit.enabled:
        return
    key = period_key(limit.period)
    total = effective_limit_minutes(limit)
    used = usage_between(server.id, period_start(limit.period), bool(limit.weight_by_cores))
    pct = 100.0 * used / total if total else 100.0
    unit = 'core-hours' if limit.weight_by_cores else 'hours'
    label = f"{used / 60:.1f} of {total / 60:g} {unit} this {limit.period}"

    if used >= total:
        if limit.action == 'stop':
            try:
                cs.stop(server)
                stopped = True
            except cs.CodespaceError as e:
                stopped = False
                logger.warning('could not stop %s: %s', server.name, e)
            if limit.stopped_key != key:
                limit.stopped_key = key
                db.session.commit()
                _notify(app, server, 'critical',
                        f"Time budget used up on {server.name}: {label}. "
                        + ("The Codespace was stopped." if stopped else "ShellMan could not stop it, please stop it yourself."))
        elif limit.stopped_key != key:
            limit.stopped_key = key
            db.session.commit()
            _notify(app, server, 'critical', f"Time budget reached on {server.name}: {label}.")
    elif pct >= limit.warn_pct and limit.warned_key != key:
        limit.warned_key = key
        db.session.commit()
        _notify(app, server, 'warning',
                f"{server.name} has used {pct:.0f}% of its time budget: {label}. "
                + ("It will be stopped at 100%." if limit.action == 'stop' else ""))
