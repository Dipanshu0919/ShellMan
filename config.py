import os
import secrets

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')
os.makedirs(INSTANCE_DIR, exist_ok=True)

# Values that shipped in docs / compose files / older releases. Never accepted as a real key.
_KNOWN_WEAK_KEYS = {
    'shellman-secure-production-key-2026',
    'replace-with-a-secure-secret-key-in-production',
    'generate-a-strong-secret-key-here',
    'changeme', 'secret', '',
}


def _load_secret_key() -> str:
    """SHELLMAN_SECRET_KEY if it is set to something strong, else a random key persisted in
    instance/.secret_key (0600). A key anyone can read in the source would let them forge a
    session cookie and log in as admin."""
    env = (os.environ.get('SHELLMAN_SECRET_KEY') or '').strip()
    if env and env.lower() not in _KNOWN_WEAK_KEYS and len(env) >= 16:
        return env
    path = os.path.join(INSTANCE_DIR, '.secret_key')
    try:
        with open(path, 'r') as f:
            key = f.read().strip()
        if len(key) >= 32:
            return key
    except OSError:
        pass
    key = secrets.token_hex(32)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(key)
    return key


class Config:
    SECRET_KEY = _load_secret_key()
    SESSION_COOKIE_SECURE = os.environ.get('SHELLMAN_COOKIE_SECURE', '0') == '1'
    SESSION_COOKIE_NAME = 'shellman_session'
    PERMANENT_SESSION_LIFETIME = int(os.environ.get('SHELLMAN_SESSION_HOURS', '24')) * 3600
    DATABASE_URI = os.environ.get('DATABASE_URL') or f'sqlite:///{os.path.join(INSTANCE_DIR, "shellman.db")}'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 2 * 1024 * 1024 * 1024))  # 2GB max file upload
    SSH_CONNECT_TIMEOUT = 10
    SSH_BANNER_TIMEOUT = 10
    SSH_IDLE_TIMEOUT = 1800  # 30 minutes
