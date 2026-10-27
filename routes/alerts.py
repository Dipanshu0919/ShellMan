from flask import Blueprint, jsonify, request

from models import db
from models.alert import AlertRule, AlertEvent, AlertChannel, METRICS, SEVERITIES, CHANNEL_KINDS, SECRET_KEYS
from models.server import Server
from routes.auth_helpers import login_required
from services import alerts as alert_service
from services.alerts import engine, PRESETS, check_url
from services.audit import audit

alerts_bp = Blueprint('alerts', __name__)


def _err(msg, code=400):
    return jsonify({'success': False, 'error': msg}), code


# ------------------------------------------------------------ overview / events
@alerts_bp.route('/api/alerts/summary', methods=['GET'])
@login_required
def summary():
    active = AlertEvent.query.filter(AlertEvent.resolved_at.is_(None)).order_by(AlertEvent.id.desc()).all()
    unacked = AlertEvent.query.filter_by(acknowledged=False).count()
    return jsonify({
        'success': True,
        'active': [e.to_dict() for e in active[:20]],
        'active_count': len(active),
        'unacknowledged': unacked,
        'critical': sum(1 for e in active if e.severity == 'critical'),
        'engine': engine.status(),
    })


@alerts_bp.route('/api/alerts/events', methods=['GET'])
@login_required
def list_events():
    limit = max(1, min(200, request.args.get('limit', 50, type=int)))
    q = AlertEvent.query
    state = request.args.get('state')
    if state == 'active':
        q = q.filter(AlertEvent.resolved_at.is_(None))
    elif state == 'resolved':
        q = q.filter(AlertEvent.resolved_at.isnot(None))
    rows = q.order_by(AlertEvent.id.desc()).limit(limit).all()
    return jsonify({'success': True, 'items': [e.to_dict() for e in rows]})


@alerts_bp.route('/api/alerts/events/<int:event_id>/ack', methods=['POST'])
@login_required
def ack_event(event_id):
    ev = db.session.get(AlertEvent, event_id)
    if not ev:
        return _err('Not found', 404)
    ev.acknowledged = True
    db.session.commit()
    return jsonify({'success': True})


@alerts_bp.route('/api/alerts/events/ack-all', methods=['POST'])
@login_required
def ack_all():
    AlertEvent.query.filter_by(acknowledged=False).update({'acknowledged': True})
    db.session.commit()
    return jsonify({'success': True})


@alerts_bp.route('/api/alerts/events/clear', methods=['POST'])
@login_required
def clear_resolved():
    n = AlertEvent.query.filter(AlertEvent.resolved_at.isnot(None)).delete(synchronize_session=False)
    db.session.commit()
    audit('alert.history_cleared', detail=f"{n} resolved incident(s)")
    return jsonify({'success': True, 'removed': n})


@alerts_bp.route('/api/alerts/check-now', methods=['POST'])
@login_required
def check_now():
    engine.check_now()
    return jsonify({'success': True, 'engine': engine.status()})


# ------------------------------------------------------------ rules
def _rule_from(data, rule=None):
    rule = rule or AlertRule()
    name = (data.get('name') or '').strip()
    metric = data.get('metric')
    if metric not in METRICS:
        raise ValueError('Unknown metric')
    sev = data.get('severity', 'warning')
    if sev not in SEVERITIES:
        raise ValueError('Severity must be warning or critical')
    try:
        threshold = float(data.get('threshold', 90))
        duration = int(data.get('duration_min', 5))
        cooldown = int(data.get('cooldown_min', 60))
    except (TypeError, ValueError):
        raise ValueError('Threshold, duration and cooldown must be numbers')
    if metric in ('cpu', 'mem', 'disk', 'swap') and not (1 <= threshold <= 100):
        raise ValueError('Percent thresholds must be between 1 and 100')
    if metric == 'load' and not (0 < threshold <= 1000):
        raise ValueError('Load threshold must be between 0 and 1000')
    if not (0 <= duration <= 1440):
        raise ValueError('Duration must be 0-1440 minutes')
    if not (0 <= cooldown <= 10080):
        raise ValueError('Cooldown must be 0-10080 minutes')
    sid = data.get('server_id')
    if sid in ('', None, 'all', 0, '0'):
        sid = None
    else:
        sid = int(sid)
        if not db.session.get(Server, sid):
            raise ValueError('Server not found')
    rule.name = name or f"{alert_service.METRIC_LABELS.get(metric, metric)} alert"
    rule.metric, rule.severity, rule.server_id = metric, sev, sid
    rule.threshold = 0 if metric == 'offline' else threshold
    rule.duration_min, rule.cooldown_min = duration, cooldown
    rule.enabled = bool(data.get('enabled', True))
    return rule


@alerts_bp.route('/api/alerts/rules', methods=['GET'])
@login_required
def list_rules():
    rules = AlertRule.query.order_by(AlertRule.id).all()
    return jsonify({'success': True, 'items': [r.to_dict() for r in rules], 'presets': PRESETS,
                    'metrics': list(METRICS)})


@alerts_bp.route('/api/alerts/rules', methods=['POST'])
@login_required
def create_rule():
    try:
        rule = _rule_from(request.get_json(silent=True) or {})
    except ValueError as e:
        return _err(str(e))
    db.session.add(rule)
    db.session.commit()
    audit('alert.rule_add', target=rule.name, detail=f"{rule.metric} >= {rule.threshold:g}")
    return jsonify({'success': True, 'rule': rule.to_dict()})


@alerts_bp.route('/api/alerts/rules/presets', methods=['POST'])
@login_required
def add_presets():
    existing = {(r.metric, r.server_id) for r in AlertRule.query.all()}
    added = 0
    for p in PRESETS:
        if (p['metric'], None) in existing:
            continue
        db.session.add(AlertRule(server_id=None, enabled=True, **p))
        added += 1
    db.session.commit()
    audit('alert.rule_add', target='recommended rules', detail=f"{added} added")
    return jsonify({'success': True, 'added': added})


@alerts_bp.route('/api/alerts/rules/<int:rule_id>', methods=['PUT'])
@login_required
def update_rule(rule_id):
    rule = db.session.get(AlertRule, rule_id)
    if not rule:
        return _err('Not found', 404)
    try:
        _rule_from(request.get_json(silent=True) or {}, rule)
    except ValueError as e:
        return _err(str(e))
    db.session.commit()
    audit('alert.rule_edit', target=rule.name)
    return jsonify({'success': True, 'rule': rule.to_dict()})


@alerts_bp.route('/api/alerts/rules/<int:rule_id>', methods=['DELETE'])
@login_required
def delete_rule(rule_id):
    rule = db.session.get(AlertRule, rule_id)
    if not rule:
        return _err('Not found', 404)
    name = rule.name
    db.session.delete(rule)
    db.session.commit()
    audit('alert.rule_delete', target=name)
    return jsonify({'success': True})


# ------------------------------------------------------------ channels
def _channel_from(data, ch=None):
    kind = data.get('kind') if ch is None else ch.kind
    if kind not in CHANNEL_KINDS:
        raise ValueError('Unknown channel type')
    old = ch.config if ch else {}
    incoming = data.get('config') or {}
    if not isinstance(incoming, dict):
        raise ValueError('Invalid config')
    cfg = {}
    allowed = {
        'telegram': ('bot_token', 'chat_id'),
        'slack': ('url',),
        'discord': ('url',),
        'webhook': ('url', 'secret'),
        'email': ('host', 'port', 'security', 'username', 'password', 'from', 'to'),
    }[kind]
    for k in allowed:
        if k not in incoming:
            cfg[k] = old.get(k, '')      # field not sent (e.g. the on/off toggle): keep what is saved
            continue
        v = incoming.get(k)
        v = '' if v is None else str(v).strip()
        if k in SECRET_KEYS.get(kind, ()) and not v:
            v = old.get(k, '')            # blank secret on edit = keep the saved one
        cfg[k] = v
    if kind in ('slack', 'discord', 'webhook'):
        reason = check_url(cfg.get('url', ''))
        if reason:
            raise ValueError(reason)
    if kind == 'telegram' and (not cfg['bot_token'] or not cfg['chat_id']):
        raise ValueError('Telegram needs a bot token and a chat id')
    if kind == 'email':
        if not cfg['host'] or not cfg['to']:
            raise ValueError('E-mail needs an SMTP host and a recipient')
        try:
            int(cfg['port'] or 587)
        except ValueError:
            raise ValueError('SMTP port must be a number')
        if cfg['security'] not in ('starttls', 'ssl', 'none'):
            cfg['security'] = 'starttls'
    ch = ch or AlertChannel(kind=kind)
    ch.name = (data.get('name') or kind.title()).strip()[:120]
    ch.config = cfg
    ch.enabled = bool(data.get('enabled', True))
    ch.min_severity = 'critical' if data.get('min_severity') == 'critical' else 'warning'
    return ch


@alerts_bp.route('/api/alerts/channels', methods=['GET'])
@login_required
def list_channels():
    return jsonify({'success': True, 'items': [c.to_dict() for c in AlertChannel.query.order_by(AlertChannel.id)],
                    'kinds': list(CHANNEL_KINDS)})


@alerts_bp.route('/api/alerts/channels', methods=['POST'])
@login_required
def create_channel():
    try:
        ch = _channel_from(request.get_json(silent=True) or {})
    except ValueError as e:
        return _err(str(e))
    db.session.add(ch)
    db.session.commit()
    audit('alert.channel_add', target=f"{ch.name} ({ch.kind})")
    return jsonify({'success': True, 'channel': ch.to_dict()})


@alerts_bp.route('/api/alerts/channels/<int:ch_id>', methods=['PUT'])
@login_required
def update_channel(ch_id):
    ch = db.session.get(AlertChannel, ch_id)
    if not ch:
        return _err('Not found', 404)
    try:
        _channel_from(request.get_json(silent=True) or {}, ch)
    except ValueError as e:
        return _err(str(e))
    db.session.commit()
    audit('alert.channel_edit', target=f"{ch.name} ({ch.kind})")
    return jsonify({'success': True, 'channel': ch.to_dict()})


@alerts_bp.route('/api/alerts/channels/<int:ch_id>', methods=['DELETE'])
@login_required
def delete_channel(ch_id):
    ch = db.session.get(AlertChannel, ch_id)
    if not ch:
        return _err('Not found', 404)
    label = f"{ch.name} ({ch.kind})"
    db.session.delete(ch)
    db.session.commit()
    audit('alert.channel_delete', target=label)
    return jsonify({'success': True})


@alerts_bp.route('/api/alerts/channels/<int:ch_id>/test', methods=['POST'])
@login_required
def test_channel(ch_id):
    ch = db.session.get(AlertChannel, ch_id)
    if not ch:
        return _err('Not found', 404)
    err = alert_service.send_to_channel(
        ch, '[TEST] ShellMan alert channel', 'This is a test message from ShellMan. Alerts will arrive here.',
        {'state': 'test'})
    ch.last_status = ('failed: ' + err) if err else 'sent (test)'
    db.session.commit()
    audit('alert.channel_test', target=f"{ch.name} ({ch.kind})", detail=err, ok=not err)
    if err:
        return _err(err, 502)
    return jsonify({'success': True, 'message': 'Test message sent.'})
