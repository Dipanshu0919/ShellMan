import base64
import hashlib
import os
import stat
from datetime import datetime, timezone
from cryptography.fernet import Fernet
from models import db

# Path to the per-install Fernet key file (instance/ is already created by config.py)
_BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
_INSTANCE_DIR = os.path.join(_BASE_DIR, 'instance')
_FERNET_KEY_PATH = os.path.join(_INSTANCE_DIR, '.fernet.key')


def _get_or_create_fernet_key() -> bytes:
    """
    Return a stable per-install Fernet key.

    Priority:
      1. SHELLMAN_FERNET_KEY env var (base64 urlsafe 32-byte key) — for CI / advanced users.
      2. instance/.fernet.key on disk (created with 0600 perms on first run).
      3. Generate a new random key and persist it.

    FIX: previously the key was derived from a hardcoded string in the repo
    ('shellman-secure-production-key-2026'), so anyone with the source could
    decrypt every server password. Now the key is random per install and
    never committed to the repository.
    """
    env_key = os.environ.get('SHELLMAN_FERNET_KEY')
    if env_key:
        try:
            key = env_key.encode('utf-8') if isinstance(env_key, str) else env_key
            # Validate by constructing a Fernet
            Fernet(key)
            return key
        except Exception:
            # Bad env key -> fall through to file-based
            pass

    os.makedirs(_INSTANCE_DIR, exist_ok=True)

    if os.path.exists(_FERNET_KEY_PATH):
        try:
            with open(_FERNET_KEY_PATH, 'rb') as f:
                key = f.read().strip()
            if key:
                Fernet(key)  # validate
                return key
        except Exception:
            # Corrupt key file -> do NOT silently regenerate (would orphan existing creds).
            raise RuntimeError(
                f"Fernet key file at {_FERNET_KEY_PATH} is unreadable or invalid. "
                "Restore it from backup, or delete it only if you accept that "
                "all stored server credentials must be re-entered."
            )

    # First run: generate a new random key and persist with 0600
    key = Fernet.generate_key()
    fd = os.open(_FERNET_KEY_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.write(fd, key)
    finally:
        os.close(fd)
    try:
        os.chmod(_FERNET_KEY_PATH, stat.S_IRUSR | stat.S_IWUSR)
    except Exception:
        pass
    return key


# Cache the key in-process so we don't re-read the file on every encrypt/decrypt
_FERNET_INSTANCE = None

def get_fernet() -> Fernet:
    global _FERNET_INSTANCE
    if _FERNET_INSTANCE is None:
        _FERNET_INSTANCE = Fernet(_get_or_create_fernet_key())
    return _FERNET_INSTANCE


def get_encryption_key() -> bytes:
    """Legacy helper retained for backward compat; returns the raw Fernet key."""
    return _get_or_create_fernet_key()


def encrypt_value(value: str) -> str:
    if not value:
        return ""
    return get_fernet().encrypt(value.encode('utf-8')).decode('utf-8')


def decrypt_value(token: str) -> str:
    if not token:
        return ""
    try:
        return get_fernet().decrypt(token.encode('utf-8')).decode('utf-8')
    except Exception:
        # Decryption failure (wrong key, corrupted token, or pre-migration data).
        # Return empty rather than raising so the UI can prompt for re-entry.
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

    # Kind of node: 'ssh' (normal server) or 'codespace' (GitHub Codespace reached through the `gh` CLI tunnel)
    kind = db.Column(db.String(20), default='ssh', nullable=True)
    codespace_name = db.Column(db.String(120), nullable=True)
    gh_token_enc = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def password(self) -> str:
        return decrypt_value(self.password_enc)

    @password.setter
    def password(self, val: str):
        self.password_enc = encrypt_value(val) if val else None

    @property
    def gh_token(self) -> str:
        return decrypt_value(self.gh_token_enc)

    @gh_token.setter
    def gh_token(self, val: str):
        self.gh_token_enc = encrypt_value(val) if val else None

    @property
    def is_codespace(self) -> bool:
        return (self.kind or 'ssh') == 'codespace'

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
            'kind': self.kind or 'ssh',
            'codespace_name': self.codespace_name,
            'has_gh_token': bool(self.gh_token_enc),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        return d