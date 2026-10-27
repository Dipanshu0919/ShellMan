from datetime import datetime, timezone
from models import db


class TimeLimit(db.Model):
    """A time budget for one server, for example "20 hours per month" on a GitHub Codespace.

    `kind` is 'quota' today (hours of running time per period); it is a column so other time rules
    (such as an allowed time window) can be added later without a new table.
    """
    __tablename__ = 'time_limits'

    id = db.Column(db.Integer, primary_key=True)
    server_id = db.Column(db.Integer, db.ForeignKey('servers.id'), nullable=False, index=True)
    kind = db.Column(db.String(20), default='quota', nullable=False)
    period = db.Column(db.String(10), default='month', nullable=False)     # day | week | month (UTC)
    limit_minutes = db.Column(db.Integer, default=1200, nullable=False)    # the budget, in minutes (or core-minutes)
    weight_by_cores = db.Column(db.Boolean, default=True, nullable=False)  # GitHub bills core-hours: 4 cores = 4x
    warn_pct = db.Column(db.Integer, default=80, nullable=False)
    action = db.Column(db.String(10), default='stop', nullable=False)      # stop | warn
    enabled = db.Column(db.Boolean, default=True, nullable=False)
    bonus_minutes = db.Column(db.Integer, default=0, nullable=False)       # "+1 hour" extensions, valid for one period
    bonus_period_key = db.Column(db.String(12), nullable=True)
    warned_key = db.Column(db.String(12), nullable=True)                   # period in which the warning was sent
    stopped_key = db.Column(db.String(12), nullable=True)                  # period in which the stop was announced
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id, 'server_id': self.server_id, 'kind': self.kind, 'period': self.period,
            'limit_minutes': self.limit_minutes, 'weight_by_cores': bool(self.weight_by_cores),
            'warn_pct': self.warn_pct, 'action': self.action, 'enabled': bool(self.enabled),
        }


class ServerUsage(db.Model):
    """Minutes a server was running on one UTC day. `core_minutes` is minutes multiplied by CPU cores."""
    __tablename__ = 'server_usage'

    id = db.Column(db.Integer, primary_key=True)
    server_id = db.Column(db.Integer, nullable=False, index=True)
    day = db.Column(db.String(10), nullable=False, index=True)             # YYYY-MM-DD
    minutes = db.Column(db.Float, default=0.0, nullable=False)
    core_minutes = db.Column(db.Float, default=0.0, nullable=False)
