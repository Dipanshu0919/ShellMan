import json
from datetime import datetime, timezone
from cryptography.fernet import Fernet
from models import db
from models.server import _get_or_create_fernet_key


class CloudflareSetting(db.Model):
    __tablename__ = 'cloudflare_settings'

    id = db.Column(db.Integer, primary_key=True)
    encrypted_token = db.Column(db.Text, nullable=True)
    account_id = db.Column(db.String(64), nullable=True)
    account_name = db.Column(db.String(128), nullable=True)
    is_connected = db.Column(db.Boolean, default=False, nullable=False)
    last_verified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def set_token(self, raw_token: str):
        if not raw_token or not raw_token.strip():
            self.encrypted_token = None
            self.is_connected = False
            return
        key = _get_or_create_fernet_key()
        f = Fernet(key)
        self.encrypted_token = f.encrypt(raw_token.strip().encode('utf-8')).decode('utf-8')
        self.is_connected = True

    def get_token(self) -> str:
        if not self.encrypted_token:
            return ''
        try:
            key = _get_or_create_fernet_key()
            f = Fernet(key)
            return f.decrypt(self.encrypted_token.encode('utf-8')).decode('utf-8')
        except Exception:
            return ''

    def to_dict(self):
        """Never expose token or encrypted_token in API responses or diagnostics."""
        return {
            'is_connected': bool(self.is_connected and self.encrypted_token),
            'account_id': self.account_id or '',
            'account_name': self.account_name or '',
            'last_verified_at': self.last_verified_at.isoformat() if self.last_verified_at else None
        }


class Domain(db.Model):
    __tablename__ = 'domains'

    id = db.Column(db.Integer, primary_key=True)
    zone_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), unique=True, nullable=False, index=True)
    status = db.Column(db.String(32), default='unknown', nullable=False)
    nameservers = db.Column(db.Text, default='[]')
    original_nameservers = db.Column(db.Text, default='[]')
    dnssec_status = db.Column(db.String(32), default='unknown')
    ssl_mode = db.Column(db.String(32), default='unknown')
    server_id = db.Column(db.Integer, db.ForeignKey('servers.id', ondelete='SET NULL'), nullable=True)
    last_sync_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    server = db.relationship('Server', backref=db.backref('associated_domains', lazy=True))

    def get_nameservers(self) -> list:
        try:
            return json.loads(self.nameservers) if self.nameservers else []
        except Exception:
            return []

    def set_nameservers(self, ns_list: list):
        self.nameservers = json.dumps(ns_list or [])

    def get_original_nameservers(self) -> list:
        try:
            return json.loads(self.original_nameservers) if self.original_nameservers else []
        except Exception:
            return []

    def set_original_nameservers(self, ns_list: list):
        self.original_nameservers = json.dumps(ns_list or [])

    def to_dict(self):
        return {
            'id': self.id,
            'zone_id': self.zone_id,
            'name': self.name,
            'status': self.status,
            'nameservers': self.get_nameservers(),
            'original_nameservers': self.get_original_nameservers(),
            'dnssec_status': self.dnssec_status or 'unknown',
            'ssl_mode': self.ssl_mode or 'unknown',
            'server_id': self.server_id,
            'server_name': self.server.name if self.server else None,
            'server_host': self.server.host if self.server else None,
            'last_sync_at': self.last_sync_at.isoformat() if self.last_sync_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

