import csv
import io
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request, Response

from models import db
from models.audit import AuditLog
from services.audit import audit, get_config, set_config, prune_now
from routes.auth_helpers import login_required

audit_bp = Blueprint('audit', __name__)


def _parse_dt(raw):
    """Parse an ISO date or datetime (UTC assumed when no zone) into a naive UTC datetime, or None."""
    raw = (raw or '').strip()
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
    except ValueError:
        return None
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _query():
    q = AuditLog.query
    action = (request.args.get('action') or '').strip()
    if action:
        q = q.filter(AuditLog.action.like(action.replace('%', '') + '%'))
    user = (request.args.get('user') or '').strip()
    if user:
        q = q.filter(AuditLog.username == user)
    text = (request.args.get('q') or '').strip()
    if text:
        like = f"%{text}%"
        q = q.filter(db.or_(AuditLog.username.like(like), AuditLog.ip.like(like),
                            AuditLog.target.like(like), AuditLog.detail.like(like),
                            AuditLog.action.like(like)))
    if request.args.get('failed') in ('1', 'true'):
        q = q.filter(AuditLog.ok.is_(False))
    start = _parse_dt(request.args.get('from'))
    end = _parse_dt(request.args.get('to'))
    if start:
        q = q.filter(AuditLog.ts >= start)
    if end:
        q = q.filter(AuditLog.ts <= end)
    return q.order_by(AuditLog.id.desc())


@audit_bp.route('/api/audit', methods=['GET'])
@login_required
def list_audit():
    limit = max(1, min(500, request.args.get('limit', 100, type=int)))
    offset = max(0, request.args.get('offset', 0, type=int))
    q = _query()
    total = q.count()
    rows = q.offset(offset).limit(limit).all()
    return jsonify({'success': True, 'total': total, 'items': [r.to_dict() for r in rows]})


@audit_bp.route('/api/audit/export', methods=['GET'])
@login_required
def export_audit():
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(['time_utc', 'user', 'ip', 'action', 'target', 'detail', 'ok'])
    for r in _query().limit(20000).all():
        d = r.to_dict()
        # Prefix formula starters so spreadsheets do not execute them.
        cells = [d['ts'], d['username'], d['ip'], d['action'], d['target'], d['detail'], 'ok' if d['ok'] else 'failed']
        w.writerow([("'" + c) if isinstance(c, str) and c[:1] in ('=', '+', '-', '@') else c for c in cells])
    name = f"shellman_audit_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(out.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': f'attachment; filename="{name}"'})


@audit_bp.route('/api/audit/meta', methods=['GET'])
@login_required
def audit_meta():
    """Retention settings plus what is stored now, for the settings card and filters."""
    total = AuditLog.query.count()
    first = AuditLog.query.order_by(AuditLog.ts).first()
    oldest = first.ts if first else None
    users = [r[0] for r in db.rows('SELECT DISTINCT username FROM audit_log WHERE username != \'\' ORDER BY username LIMIT 100') if r[0]]
    return jsonify({'success': True, 'config': get_config(fresh=True), 'total': total,
                    'oldest': oldest.replace(tzinfo=timezone.utc).isoformat() if oldest else None,
                    'users': users})


@audit_bp.route('/api/audit/settings', methods=['PUT'])
@login_required
def audit_settings():
    data = request.get_json(silent=True) or {}
    try:
        cfg = set_config(data)
    except ValueError as e:
        return jsonify({'success': False, 'error': str(e)}), 400
    removed = prune_now()
    audit('audit.settings', detail=f"keep {cfg['retention_days'] or 'forever'} days, max {cfg['max_rows'] or 'unlimited'} rows; removed {removed}")
    return jsonify({'success': True, 'config': cfg, 'removed': removed})


@audit_bp.route('/api/audit/purge', methods=['POST'])
@login_required
def audit_purge():
    """Delete entries by age or by date range. Body: {older_than_days: N} or {from, to} or {all: true}."""
    data = request.get_json(silent=True) or {}
    q = AuditLog.query
    if data.get('all') is True:
        label = 'all entries'
    elif data.get('older_than_days') is not None:
        try:
            days = int(data['older_than_days'])
        except (TypeError, ValueError):
            return jsonify({'success': False, 'error': 'older_than_days must be a number'}), 400
        if days < 0 or days > 36500:
            return jsonify({'success': False, 'error': 'older_than_days is out of range'}), 400
        q = q.filter(AuditLog.ts < datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days))
        label = f'older than {days} days'
    else:
        start, end = _parse_dt(data.get('from')), _parse_dt(data.get('to'))
        if not start and not end:
            return jsonify({'success': False, 'error': 'Choose a date range, an age, or all.'}), 400
        if start:
            q = q.filter(AuditLog.ts >= start)
        if end:
            q = q.filter(AuditLog.ts <= end)
        label = f"{data.get('from') or '…'} to {data.get('to') or '…'}"
    removed = q.delete()
    # Written after the delete so the purge itself stays on record.
    audit('audit.purge', detail=f'{label}; removed {removed}')
    return jsonify({'success': True, 'removed': removed})
