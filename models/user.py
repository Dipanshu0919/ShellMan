import json
import threading
import time
from datetime import datetime, timezone
import pyotp
from werkzeug.security import generate_password_hash, check_password_hash
from models import db
from models.server import encrypt_value, decrypt_value

_used_totp = {}
_used_lock = threading.Lock()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = db.Column(db.DateTime, nullable=True)

    # Two-Factor Authentication (TOTP) - Encrypted with local Fernet key
    totp_secret = db.Column(db.Text, nullable=True)
    totp_enabled = db.Column(db.Boolean, default=False, nullable=False)
    backup_codes = db.Column(db.Text, nullable=True)  # Fernet encrypted JSON-encoded array

    # 'admin' can do everything; 'viewer' can only look (metrics, logs, fleet, history). Existing accounts stay admin.
    role = db.Column(db.String(20), default='admin', nullable=False, server_default='admin')

    # Bumped on password change / 2FA change / "sign out other devices": older session cookies stop working
    session_version = db.Column(db.Integer, default=1, nullable=False, server_default='1')

    @property
    def is_admin(self) -> bool:
        return (self.role or 'admin') == 'admin'

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def bump_session_version(self):
        self.session_version = (self.session_version or 1) + 1

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    @property
    def raw_totp_secret(self) -> str:
        if not self.totp_secret:
            return ""
        dec = decrypt_value(self.totp_secret)
        return dec if dec else self.totp_secret

    @property
    def raw_backup_codes(self) -> list:
        if not self.backup_codes:
            return []
        dec = decrypt_value(self.backup_codes)
        raw_str = dec if dec else self.backup_codes
        try:
            val = json.loads(raw_str)
            return val if isinstance(val, list) else []
        except Exception:
            return []

    def enable_totp(self, secret: str, codes_list: list):
        self.totp_secret = encrypt_value(secret)
        self.totp_enabled = True
        self.backup_codes = encrypt_value(json.dumps(codes_list))

    def disable_totp(self):
        self.totp_secret = None
        self.totp_enabled = False
        self.backup_codes = None

    def verify_totp(self, token: str) -> bool:
        sec = self.raw_totp_secret
        if not self.totp_enabled or not sec:
            return False
        clean_token = str(token).strip().replace(' ', '').replace('-', '')
        totp = pyotp.TOTP(sec)
        # allow 1 step before and after (30s window drift)
        if not totp.verify(clean_token, valid_window=1):
            return False
        # A code that already worked must not work again inside its validity window (shoulder-surf / replay).
        now = time.time()
        key = (self.id, clean_token)
        with _used_lock:
            for k in [k for k, t in _used_totp.items() if now - t > 120]:
                _used_totp.pop(k, None)
            if key in _used_totp:
                return False
            _used_totp[key] = now
        return True

    def verify_and_consume_backup_code(self, code: str) -> bool:
        if not self.totp_enabled:
            return False
        codes = self.raw_backup_codes
        if not codes:
            return False

        clean_code = str(code).strip().upper().replace(' ', '').replace('-', '')
        if not clean_code:
            return False

        for i, c in enumerate(codes):
            norm = str(c).strip().upper().replace(' ', '').replace('-', '')
            if norm == clean_code:
                codes.pop(i)
                self.backup_codes = encrypt_value(json.dumps(codes))
                return True
        return False

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role or 'admin',
            'totp_enabled': bool(self.totp_enabled),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
