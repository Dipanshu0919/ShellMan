import os
import logging


def _tune_malloc():
    """Make glibc hand freed memory back to the OS.

    Without this, one password hash (scrypt needs ~32 MB scratch space) or one large upload
    leaves tens of MB resident forever. Equivalent to MALLOC_MMAP_THRESHOLD_ / MALLOC_TRIM_THRESHOLD_.
    Harmless no-op on musl, macOS and Windows. Set SHELLMAN_MALLOC_TUNE=0 to skip.
    """
    if os.environ.get('SHELLMAN_MALLOC_TUNE', '1') == '0':
        return
    try:
        import ctypes
        libc = ctypes.CDLL('libc.so.6')
        libc.mallopt(-3, 64 * 1024)    # M_MMAP_THRESHOLD: big blocks use mmap and are returned on free
        libc.mallopt(-1, 128 * 1024)   # M_TRIM_THRESHOLD: trim the heap top aggressively
        libc.mallopt(-8, 2)            # M_ARENA_MAX: at most 2 per-thread arenas
    except Exception:
        pass


_tune_malloc()

from flask import Flask, redirect, url_for, request, jsonify, Request

Request.max_form_parts = None
# Form fields (not files, those spool to disk) are held in RAM: cap them instead of allowing unlimited memory.
Request.max_form_memory_size = int(os.environ.get('SHELLMAN_MAX_FORM_MB', '64')) * 1024 * 1024


from flask_sock import Sock

from config import Config
from models import db
from models.user import User
from models.server import Server
from models.action import CustomAction
from models.git_deployment import GitDeployment
from models.domain import CloudflareSetting, Domain
from models.audit import AuditLog
from models.alert import AlertRule, AlertEvent, AlertChannel
from models.timelimit import TimeLimit, ServerUsage
from models.metric_sample import MetricSample, AppSetting

# Initialize Flask-Sock
sock = Sock()

logging.basicConfig(
    level=os.environ.get('SHELLMAN_LOG_LEVEL', 'INFO').upper(),
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
)
logger = logging.getLogger('shellman')


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    sock.init_app(app)

    from security import init_security
    init_security(app)
    from roles import init_roles
    init_roles(app)

    # Register blueprints
    from routes.auth import auth_bp
    from routes.dashboard import dashboard_bp
    from routes.servers import servers_bp
    from routes.terminal import terminal_bp, register_terminal_sock
    from routes.files import files_bp
    from routes.services import services_bp
    from routes.processes import processes_bp
    from routes.logs import logs_bp
    from routes.system import system_bp
    from routes.network import network_bp
    from routes.settings import settings_bp
    from routes.workspace import workspace_bp
    from routes.nginx import nginx_bp
    from routes.actions import actions_bp
    from routes.sync import sync_bp
    from routes.cron import cron_bp
    from routes.git import git_bp
    from routes.domains import domains_bp
    from routes.ssh_diag import ssh_diag_bp
    from routes.docker import docker_bp
    from routes.database import database_bp
    from routes.firewall import firewall_bp
    from routes.audit import audit_bp
    from routes.codespace import codespace_bp
    from routes.alerts import alerts_bp
    from routes.users import users_bp
    from routes.history import history_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(servers_bp)
    app.register_blueprint(terminal_bp)
    app.register_blueprint(workspace_bp)
    app.register_blueprint(files_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(processes_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(system_bp)
    app.register_blueprint(network_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(nginx_bp)
    app.register_blueprint(actions_bp)
    app.register_blueprint(sync_bp)
    app.register_blueprint(cron_bp)
    app.register_blueprint(git_bp)
    app.register_blueprint(domains_bp)
    app.register_blueprint(ssh_diag_bp)
    app.register_blueprint(docker_bp)
    app.register_blueprint(database_bp)
    app.register_blueprint(firewall_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(codespace_bp)
    app.register_blueprint(alerts_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(history_bp)

    # Register terminal websocket handler
    register_terminal_sock(sock)

    @app.route('/favicon.ico')
    def favicon():
        return app.send_static_file('icons/favicon.svg')

    @app.route('/manifest.json')
    @app.route('/manifest.webmanifest')
    def manifest():
        response = app.send_static_file('manifest.json')
        response.headers['Content-Type'] = 'application/manifest+json'
        return response

    @app.route('/sw.js')
    def service_worker():
        response = app.send_static_file('sw.js')
        response.headers['Content-Type'] = 'application/javascript'
        response.headers['Service-Worker-Allowed'] = '/'
        return response

    @app.errorhandler(413)
    def request_entity_too_large(error):
        if request.path.startswith('/api/'):
            return jsonify({
                'success': False,
                'error': 'Uploaded file/folder exceeds server maximum upload size limit (MAX_CONTENT_LENGTH).'
            }), 413
        return "<h1>413 Request Entity Too Large</h1>", 413

    with app.app_context():
        db.create_all()
        try:
            from services.audit import prune_now
            prune_now()  # apply audit-log retention at startup
        except Exception:
            pass
        # Auto-migrate SQLite columns if table already existed
        try:
            # Columns added after the first release: add them when an older database is opened.
            if db.columns_of('servers'):
                db.add_column_if_missing('servers', 'last_workspace', 'VARCHAR(512)')
                db.add_column_if_missing('servers', 'kind', "VARCHAR(20) DEFAULT 'ssh'")
                db.add_column_if_missing('servers', 'codespace_name', 'VARCHAR(120)')
                db.add_column_if_missing('servers', 'gh_token_enc', 'TEXT')
            if db.columns_of('users'):
                db.add_column_if_missing('users', 'role', "VARCHAR(20) DEFAULT 'admin' NOT NULL")
                db.add_column_if_missing('users', 'totp_secret', 'VARCHAR(64)')
                db.add_column_if_missing('users', 'totp_enabled', 'BOOLEAN DEFAULT 0 NOT NULL')
                db.add_column_if_missing('users', 'backup_codes', 'TEXT')
                db.add_column_if_missing('users', 'session_version', 'INTEGER DEFAULT 1 NOT NULL')
        except Exception:
            # FIX: don't swallow schema errors silently — log so startup failures are visible
            logger.exception("Schema auto-migration failed (non-fatal, continuing startup)")

        # Seed built-in custom actions if table is newly created
        try:
            CustomAction.seed_default_actions()
        except Exception as e:
            logger.exception("CustomAction seed error")
            print(f"[ShellMan] Action seed error: {e}")

        # Check if initial setup is needed
        if User.query.count() == 0:
            print("[ShellMan] No user accounts found. First-time setup wizard active at /setup")

    @app.template_filter('mask_ip')
    def mask_ip_filter(val):
        if not val:
            return ''
        s = str(val).strip()
        if s.startswith('codespace:'):
            return 'GitHub Codespace'
        if ':' in s and not s.startswith('['):
            parts = s.split(':', 1)
            host_part, port_part = parts[0], parts[1]
            if len(host_part) > 8:
                masked_host = host_part[:8] + '***'
            else:
                masked_host = host_part
            return f"{masked_host}:{port_part}"
        if len(s) > 8:
            return s[:8] + '***'
        return s

    @app.context_processor
    def inject_helpers():
        def static_v(filename):
            try:
                p = os.path.join(app.static_folder, filename)
                mtime = int(os.path.getmtime(p))
                return f"{url_for('static', filename=filename)}?v={mtime}"
            except Exception:
                return url_for('static', filename=filename)

        def endpoint_label(server):
            """Masked 'host:port' for SSH servers, 'GitHub Codespace <name>' for Codespaces."""
            if server is None:
                return ''
            if getattr(server, 'is_codespace', False):
                return f"GitHub Codespace {server.codespace_name}"
            return f"{mask_ip_filter(server.host)}:{server.port}"

        def user_role():
            try:
                from routes.auth_helpers import get_current_user
                u = get_current_user()
                return (u.role or 'admin') if u else 'admin'
            except Exception:
                return 'admin'
        return dict(mask_ip=mask_ip_filter, static_v=static_v, endpoint_label=endpoint_label, user_role=user_role)

    # Background alert engine (server-side checks + Telegram/Slack/Discord/webhook/e-mail notifications).
    if not app.config.get('TESTING'):
        try:
            from services.alerts import engine
            engine.start(app)
        except Exception:
            logger.exception("Alert engine failed to start")

    return app

app = create_app()

if __name__ == '__main__':
    # FIX: default bind is 127.0.0.1 (localhost only). ShellMan holds SSH
    # credentials to your servers — binding 0.0.0.0 by default would expose
    # it to the entire LAN. Set HOST=0.0.0.0 explicitly only on a trusted network.
    port = int(os.environ.get('PORT', 9874))
    host = os.environ.get('HOST', '127.0.0.1')
    app.run(host=host, port=port, debug=False)