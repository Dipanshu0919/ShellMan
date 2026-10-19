import os
import secrets

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')
os.makedirs(INSTANCE_DIR, exist_ok=True)

class Config:
    SECRET_KEY = os.environ.get('SHELLMAN_SECRET_KEY') or 'shellman-secure-production-key-2026'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or f'sqlite:///{os.path.join(INSTANCE_DIR, "shellman.db")}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max file upload
    SSH_CONNECT_TIMEOUT = 10
    SSH_BANNER_TIMEOUT = 10
    SSH_IDLE_TIMEOUT = 1800  # 30 minutes
