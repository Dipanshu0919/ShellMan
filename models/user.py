import json
from datetime import datetime, timezone
import pyotp
from werkzeug.security import generate_password_hash, check_password_hash
from models import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = db.Column(db.DateTime, nullable=True)

    # Two-Factor Authentication (TOTP)
    totp_secret = db.Column(db.String(64), nullable=True)
    totp_enabled = db.Column(db.Boolean, default=False, nullable=False)
    backup_codes = db.Column(db.Text, nullable=True)  # JSON-encoded array of backup codes

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def enable_totp(self, secret: str, codes_list: list):
        self.totp_secret = secret
        self.totp_enabled = True
        self.backup_codes = json.dumps(codes_list)

    def disable_totp(self):
        self.totp_secret = None
        self.totp_enabled = False
        self.backup_codes = None

    def verify_totp(self, token: str) -> bool:
        if not self.totp_enabled or not self.totp_secret:
            return False
        clean_token = str(token).strip().replace(' ', '').replace('-', '')
        totp = pyotp.TOTP(self.totp_secret)
        # allow 1 step before and after (30s window drift)
        return bool(totp.verify(clean_token, valid_window=1))

    def verify_and_consume_backup_code(self, code: str) -> bool:
        if not self.totp_enabled or not self.backup_codes:
            return False
        try:
            codes = json.loads(self.backup_codes)
            if not isinstance(codes, list):
                return False
        except Exception:
            return False

        clean_code = str(code).strip().upper().replace(' ', '').replace('-', '')
        if not clean_code:
            return False

        for i, c in enumerate(codes):
            norm = str(c).strip().upper().replace(' ', '').replace('-', '')
            if norm == clean_code:
                codes.pop(i)
                self.backup_codes = json.dumps(codes)
                return True
        return False

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'totp_enabled': bool(self.totp_enabled),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }
