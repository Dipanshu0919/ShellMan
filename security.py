"""
ShellMan security helpers: cross-site request checks, security headers, login throttling and
safe redirects. ShellMan holds SSH credentials for your servers, so these defaults are strict.

Environment switches
  SHELLMAN_TRUSTED_ORIGINS   comma separated extra origins/hosts allowed to call the API
                             (needed only when a proxy rewrites the Host header)
  SHELLMAN_TRUST_PROXY=1     use X-Forwarded-For for the client address (behind nginx etc.)
  SHELLMAN_COOKIE_SECURE=1   mark the session cookie Secure (set this when served over HTTPS)
"""
import os
import threading
import time
from urllib.parse import urlparse

from flask import request, jsonify, abort

SAFE_METHODS = {'GET', 'HEAD', 'OPTIONS'}


def _env_list(name):
    return [x.strip().lower() for x in (os.environ.get(name) or '').split(',') if x.strip()]


def client_ip():
    if os.environ.get('SHELLMAN_TRUST_PROXY') == '1':
        fwd = request.headers.get('X-Forwarded-For', '')
        if fwd:
            return fwd.split(',')[0].strip()
    return request.remote_addr or 'unknown'


def _allowed_hosts():
    hosts = {request.host.lower()}
    fwd = request.headers.get('X-Forwarded-Host')
    if fwd:
        hosts.add(fwd.split(',')[0].strip().lower())
    for extra in _env_list('SHELLMAN_TRUSTED_ORIGINS'):
        hosts.add(urlparse(extra).netloc.lower() if '://' in extra else extra)
    return hosts


def origin_allowed(req=None) -> bool:
    """True when the request does not come from another website.
    Browsers always send Origin (or at least Referer / Sec-Fetch-Site) on cross-site writes and on
    WebSocket handshakes. Requests with none of them (curl, GitHub webhooks) are not browser CSRF."""
    req = req or request
    site = (req.headers.get('Sec-Fetch-Site') or '').lower()
    if site == 'cross-site':
        origin = req.headers.get('Origin')
        if not origin:
            return False
    origin = req.headers.get('Origin') or req.headers.get('Referer')
    if not origin:
        return True
    if origin == 'null':
        return False
    return urlparse(origin).netloc.lower() in _allowed_hosts()


def safe_next(target, default):
    """Only same-site relative paths. Rejects //evil.com, /\\evil.com and absolute URLs."""
    if not target or not isinstance(target, str):
        return default
    if not target.startswith('/') or target.startswith('//') or target.startswith('/\\'):
        return default
    if '\\' in target or '\n' in target or '\r' in target:
        return default
    p = urlparse(target)
    if p.scheme or p.netloc:
        return default
    return target




def password_problem(password: str, username: str = '') -> str:
    """Return a reason when the password is unusable, or '' when it is acceptable. Only an empty password is refused; strength is the user's choice."""
    if not (password or ''):
        return 'Password is required.'
    return ''


class LoginThrottle:
    """Per-key failure counter with exponential lockout (in memory, resets on restart)."""

    def __init__(self, free_attempts=5, base_lock=30, max_lock=900):
        self.free = free_attempts
        self.base = base_lock
        self.max = max_lock
        self._lock = threading.Lock()
        self._state = {}   # key -> [fails, locked_until]

    def remaining(self, *keys) -> int:
        now = time.time()
        with self._lock:
            return max([0] + [int(self._state[k][1] - now) + 1 for k in keys
                              if k in self._state and self._state[k][1] > now])

    def fail(self, *keys):
        now = time.time()
        with self._lock:
            if len(self._state) > 5000:
                self._state = {k: v for k, v in self._state.items() if v[1] > now or v[0] >= self.free}
            for k in keys:
                fails, _ = self._state.get(k, [0, 0])
                fails += 1
                lock_until = 0
                if fails >= self.free:
                    lock_until = now + min(self.max, self.base * (2 ** (fails - self.free)))
                self._state[k] = [fails, lock_until]

    def reset(self, *keys):
        with self._lock:
            for k in keys:
                self._state.pop(k, None)


login_throttle = LoginThrottle()                                   # per IP + username
login_ip_throttle = LoginThrottle(free_attempts=30, base_lock=60)  # per IP (password spraying)
totp_throttle = LoginThrottle(free_attempts=5, base_lock=60, max_lock=1800)
sensitive_throttle = LoginThrottle(free_attempts=5, base_lock=60, max_lock=900)   # password re-checks inside a session


def init_security(app):
    @app.before_request
    def _block_cross_site_writes():
        if request.method in SAFE_METHODS:
            return None
        if origin_allowed():
            return None
        if request.path.startswith('/api/') or request.is_json:
            return jsonify({'success': False, 'error': 'Cross-site request blocked'}), 403
        abort(403)

    @app.after_request
    def _headers(resp):
        resp.headers.setdefault('X-Content-Type-Options', 'nosniff')
        resp.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
        resp.headers.setdefault('Referrer-Policy', 'same-origin')
        resp.headers.setdefault('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()')
        resp.headers.setdefault('Cross-Origin-Opener-Policy', 'same-origin')
        if request.path.startswith(('/login', '/setup', '/api/')) or request.path == '/':
            resp.headers.setdefault('Cache-Control', 'no-store')
        return resp
