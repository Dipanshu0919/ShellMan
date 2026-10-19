import os
import logging
from flask import Flask, redirect, url_for
from flask_sock import Sock

from config import Config
from models import db
from models.user import User
from models.server import Server

# Initialize Flask-Sock
sock = Sock()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    sock.init_app(app)

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

    with app.app_context():
        db.create_all()
        # Auto-migrate SQLite columns if table already existed
        try:
            with db.engine.connect() as conn:
                res = conn.execute(db.text("PRAGMA table_info(servers)")).fetchall()
                cols = [r[1] for r in res]
                if 'last_workspace' not in cols and len(cols) > 0:
                    conn.execute(db.text("ALTER TABLE servers ADD COLUMN last_workspace VARCHAR(512)"))
                    conn.commit()
        except Exception:
            pass

        # Check if initial setup is needed
        if User.query.count() == 0:
            print("[ShellMan] No user accounts found. First-time setup wizard active at /setup")

    @app.template_filter('mask_ip')
    def mask_ip_filter(val):
        if not val:
            return ''
        s = str(val).strip()
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
        return dict(mask_ip=mask_ip_filter)

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
