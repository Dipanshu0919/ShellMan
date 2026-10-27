from datetime import datetime, timezone
from models import db


class AuditLog(db.Model):
    """Append-only record of security-relevant actions (logins, server changes, deletes, power...)."""
    __tablename__ = 'audit_log'

    id = db.Column(db.Integer, primary_key=True)
    ts = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    username = db.Column(db.String(80), nullable=True, index=True)
    ip = db.Column(db.String(64), nullable=True)
    action = db.Column(db.String(60), nullable=False, index=True)
    target = db.Column(db.String(255), nullable=True)
    detail = db.Column(db.Text, nullable=True)
    ok = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'ts': self.ts.replace(tzinfo=timezone.utc).isoformat() if self.ts else None,
            'username': self.username or '',
            'ip': self.ip or '',
            'action': self.action,
            'target': self.target or '',
            'detail': self.detail or '',
            'ok': bool(self.ok),
        }


class AuditConfig(db.Model):
    """Key/value settings for the audit log (retention days, row cap)."""
    __tablename__ = 'audit_config'

    key = db.Column(db.String(40), primary_key=True)
    value = db.Column(db.String(40), nullable=False, default='')
