import base64
import os
import hashlib
from datetime import datetime, timezone
from cryptography.fernet import Fernet
from models import db

def get_encryption_key() -> bytes:
    """Generate or retrieve a stable key for encrypting credentials at rest."""
    secret = os.environ.get('SHELLMAN_SECRET_KEY') or 'shellman-secure-production-key-2026'
    key_material = hashlib.sha256(secret.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(key_material)

def encrypt_value(value: str) -> str:
    if not value:
        return ""
    f = Fernet(get_encryption_key())
    return f.encrypt(value.encode('utf-8')).decode('utf-8')

def decrypt_value(token: str) -> str:
    if not token:
        return ""
    try:
        f = Fernet(get_encryption_key())
        return f.decrypt(token.encode('utf-8')).decode('utf-8')
    except Exception:
        return ""

class Server(db.Model):
    __tablename__ = 'servers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    host = db.Column(db.String(255), nullable=False)
    port = db.Column(db.Integer, default=22, nullable=False)
    username = db.Column(db.String(100), nullable=False)
    auth_type = db.Column(db.String(20), default='password', nullable=False)  # 'password' or 'key'
    
    # Encrypted fields
    password_enc = db.Column(db.Text, nullable=True)
    private_key_enc = db.Column(db.Text, nullable=True)
    passphrase_enc = db.Column(db.Text, nullable=True)
    
    # Cached metadata from last inspection
    is_online = db.Column(db.Boolean, default=False)
    last_check = db.Column(db.DateTime, nullable=True)
    hostname_cache = db.Column(db.String(255), nullable=True)
    os_cache = db.Column(db.String(255), nullable=True)
    kernel_cache = db.Column(db.String(255), nullable=True)
    last_workspace = db.Column(db.String(512), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def password(self) -> str:
        return decrypt_value(self.password_enc)

    @password.setter
    def password(self, val: str):
        self.password_enc = encrypt_value(val) if val else None

    @property
    def private_key(self) -> str:
        return decrypt_value(self.private_key_enc)

    @private_key.setter
    def private_key(self, val: str):
        self.private_key_enc = encrypt_value(val) if val else None

    @property
    def passphrase(self) -> str:
        return decrypt_value(self.passphrase_enc)

    @passphrase.setter
    def passphrase(self, val: str):
        self.passphrase_enc = encrypt_value(val) if val else None

    def to_dict(self, include_sensitive=False):
        d = {
            'id': self.id,
            'name': self.name,
            'host': self.host,
            'port': self.port,
            'username': self.username,
            'auth_type': self.auth_type,
            'has_password': bool(self.password_enc),
            'has_key': bool(self.private_key_enc),
            'has_passphrase': bool(self.passphrase_enc),
            'is_online': self.is_online,
            'last_check': self.last_check.isoformat() if self.last_check else None,
            'hostname': self.hostname_cache or self.host,
            'os': self.os_cache or 'Linux',
            'kernel': self.kernel_cache or 'Unknown',
            'last_workspace': self.last_workspace,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        return d
