"""Read-only accounts.

An administrator can do everything. A viewer may only look: dashboards, metrics, history, logs, processes,
services, network info, Docker lists and alerts. Everything else is refused here, in one place, before any
route runs, so a new feature is closed to viewers by default and has to be added to the list on purpose.
"""
import re

from flask import jsonify, redirect, request, session, url_for

from models import db
from models.user import User

_GET_OK = [re.compile(p) for p in (
    r'^/$',
    r'^/static/',
    r'^/wallpapers/[a-f0-9]{20}\.[a-z0-9]+$',
    r'^/(favicon\.ico|manifest\.json|manifest\.webmanifest|sw\.js)$',
    r'^/api/servers/list$',
    r'^/api/servers/\d+/(metrics|system/info|processes/list|services/list|network/info|logs/fetch)$',
    r'^/api/servers/\d+/docker/(containers|stats|status|compose/projects|logs/[^/]+)$',
    r'^/api/servers/\d+/(codespace|time-limit|usage|history)$',
    r'^/api/(fleet|fleet/live|history/settings)$',
    r'^/api/alerts/(summary|events|rules)$',
    r'^/api/settings/(profile|2fa/status)$',
)]
# A viewer may manage their own sign-in.
_POST_OK = [re.compile(p) for p in (
    r'^/logout$',
    r'^/api/settings/(change-password|logout-others)$',
    r'^/api/settings/2fa/(setup|verify-enable|disable|regenerate-backup-codes)$',
)]


def _viewer_may(method, path):
    rules = _GET_OK if method in ('GET', 'HEAD', 'OPTIONS') else _POST_OK
    if method in ('GET', 'HEAD', 'OPTIONS') and any(r.match(path) for r in _POST_OK):
        return True
    return any(r.match(path) for r in rules)


def init_roles(app):
    @app.before_request
    def _role_gate():
        uid = session.get('user_id')
        if not uid or request.path.startswith('/static/'):
            return None                       # not signed in: login_required deals with it
        user = db.session.get(User, uid)
        if user is None or user.is_admin:
            return None
        if _viewer_may(request.method, request.path):
            return None
        if request.path.startswith('/api/') or request.path.startswith('/ws/') or request.is_json:
            return jsonify({'success': False, 'error': 'Read-only account: this action is not allowed.',
                            'message': 'Read-only account'}), 403
        return redirect(url_for('dashboard.index'))
