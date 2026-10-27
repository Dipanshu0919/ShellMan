import json
from datetime import datetime, timezone
from models import db
from models.server import encrypt_value, decrypt_value

METRICS = ('cpu', 'mem', 'disk', 'swap', 'load', 'offline')
SEVERITIES = ('warning', 'critical')
CHANNEL_KINDS = ('telegram', 'slack', 'discord', 'webhook', 'email')

# Config keys that hold secrets per channel kind (never returned by the API, kept when left blank on edit).
SECRET_KEYS = {
    'telegram': ('bot_token',),
    'slack': ('url',),
    'discord': ('url',),
    'webhook': ('url', 'secret'),
    'email': ('password',),
}


def _utc(dt):
    return dt.replace(tzinfo=timezone.utc).isoformat() if dt else None


class AlertRule(db.Model):
    __tablename__ = 'alert_rules'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    server_id = db.Column(db.Integer, db.ForeignKey('servers.id', ondelete='CASCADE'), nullable=True)  # null = every server
    metric = db.Column(db.String(20), nullable=False)          # cpu | mem | disk | swap | load | offline
    threshold = db.Column(db.Float, default=90.0, nullable=False)   # percent (load: 1-min load average)
    duration_min = db.Column(db.Integer, default=5, nullable=False)   # must stay above this long before firing
    cooldown_min = db.Column(db.Integer, default=60, nullable=False)  # re-notify while still firing (0 = never)
    severity = db.Column(db.String(10), default='warning', nullable=False)
    enabled = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'server_id': self.server_id, 'metric': self.metric,
            'threshold': self.threshold, 'duration_min': self.duration_min, 'cooldown_min': self.cooldown_min,
            'severity': self.severity, 'enabled': bool(self.enabled), 'created_at': _utc(self.created_at),
        }


class AlertEvent(db.Model):
    """One incident: opens when a rule fires, closes (resolved_at) when the value recovers."""
    __tablename__ = 'alert_events'

    id = db.Column(db.Integer, primary_key=True)
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True, index=True)
    rule_id = db.Column(db.Integer, nullable=True, index=True)
    rule_name = db.Column(db.String(120), nullable=False)
    server_id = db.Column(db.Integer, nullable=True, index=True)
    server_name = db.Column(db.String(120), nullable=False)
    metric = db.Column(db.String(20), nullable=False)
    severity = db.Column(db.String(10), default='warning', nullable=False)
    value = db.Column(db.Float, nullable=True)
    peak = db.Column(db.Float, nullable=True)
    message = db.Column(db.Text, nullable=True)
    acknowledged = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            'id': self.id, 'started_at': _utc(self.started_at), 'resolved_at': _utc(self.resolved_at),
            'rule_id': self.rule_id, 'rule_name': self.rule_name, 'server_id': self.server_id,
            'server_name': self.server_name, 'metric': self.metric, 'severity': self.severity,
            'value': self.value, 'peak': self.peak, 'message': self.message or '',
            'acknowledged': bool(self.acknowledged), 'active': self.resolved_at is None,
        }


class AlertChannel(db.Model):
    __tablename__ = 'alert_channels'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    kind = db.Column(db.String(20), nullable=False)
    config_enc = db.Column(db.Text, nullable=True)            # Fernet encrypted JSON
    enabled = db.Column(db.Boolean, default=True, nullable=False)
    min_severity = db.Column(db.String(10), default='warning', nullable=False)   # 'critical' = only critical alerts
    last_status = db.Column(db.String(255), nullable=True)
    last_sent_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def config(self) -> dict:
        try:
            val = json.loads(decrypt_value(self.config_enc) or '{}')
            return val if isinstance(val, dict) else {}
        except Exception:
            return {}

    @config.setter
    def config(self, val: dict):
        self.config_enc = encrypt_value(json.dumps(val or {}))

    def to_dict(self):
        cfg = self.config
        secrets_ = SECRET_KEYS.get(self.kind, ())
        public = {k: v for k, v in cfg.items() if k not in secrets_}
        return {
            'id': self.id, 'name': self.name, 'kind': self.kind, 'enabled': bool(self.enabled),
            'min_severity': self.min_severity, 'config': public,
            'has_secret': {k: bool(cfg.get(k)) for k in secrets_},
            'last_status': self.last_status or '', 'last_sent_at': _utc(self.last_sent_at),
        }
