from flask import Blueprint, render_template, request, session, redirect, url_for
from models.server import Server
from models.user import User
from routes.auth_helpers import login_required
from services.terminal import TerminalSession
from security import origin_allowed
from routes.auth_helpers import session_is_valid
from services.audit import audit

terminal_bp = Blueprint('terminal', __name__)

@terminal_bp.route('/terminal')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    path = request.args.get('path', '')
    return redirect(url_for('dashboard.index', server_id=server_id, app='terminal', path=path))

def register_terminal_sock(sock):
    """Register WebSocket handler on the Flask-Sock instance."""
    @sock.route('/ws/terminal/<int:server_id>')
    def terminal_socket(ws, server_id):
        # Verify authenticated session in Flask context
        # Block cross-site WebSocket hijacking: a page on another origin must not drive a shell.
        if not origin_allowed():
            ws.send('{"type":"error","data":"Cross-origin connection refused\\r\\n"}')
            ws.close()
            return

        user_id = session.get('user_id')
        if not user_id or not session_is_valid():
            ws.send('{"type":"error","data":"Unauthorized: please log in\\r\\n"}')
            ws.close()
            return

        server = Server.query.get(server_id)
        if not server:
            ws.send('{"type":"error","data":"Server not found\\r\\n"}')
            ws.close()
            return

        try:
            raw_cols = int(request.args.get('cols', 80) or 80)
            cols = max(10, min(500, raw_cols)) if raw_cols > 0 else 80
        except (ValueError, TypeError):
            cols = 80

        try:
            raw_rows = int(request.args.get('rows', 24) or 24)
            rows = max(4, min(200, raw_rows)) if raw_rows > 0 else 24
        except (ValueError, TypeError):
            rows = 24

        raw_cwd = request.args.get('cwd') or request.args.get('path') or None
        cwd = raw_cwd.strip() if raw_cwd else None
        
        audit('terminal.open', target=server.name, detail=cwd or '')
        term_session = TerminalSession(ws, server, cols=cols, rows=rows, cwd=cwd, username=session.get('username', ''))
        term_session.start()

        try:
            while term_session.alive:
                data = ws.receive()
                if data is None:
                    break
                term_session.handle_client_message(data)
        except Exception:
            pass
        finally:
            term_session.close()
