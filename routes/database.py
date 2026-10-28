import os
import logging
from flask import Blueprint, jsonify, request, send_file, Response
from routes.auth_helpers import login_required
from models.server import Server
from services.database_service import database_service
from services.audit import audit
from services.sqlserver_service import MySql, Postgres
from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.routes.database')

database_bp = Blueprint('database', __name__)

# =============================================================================
# SQLite Endpoints
# =============================================================================

@database_bp.route('/api/servers/<int:server_id>/database/sqlite/inspect', methods=['POST'])
@login_required
def sqlite_inspect(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    db_path = data.get('path', '').strip()
    if not db_path:
        return jsonify({'success': False, 'error': 'Database path is required.'}), 400
    res = database_service.inspect_sqlite(server, db_path)
    return jsonify(res)

@database_bp.route('/api/servers/<int:server_id>/database/sqlite/table', methods=['POST'])
@login_required
def sqlite_table(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    db_path = data.get('path', '').strip()
    table = data.get('table', '').strip()
    limit = data.get('limit', 100)
    offset = data.get('offset', 0)
    if not db_path or not table:
        return jsonify({'success': False, 'error': 'Path and table name are required.'}), 400
    res = database_service.get_sqlite_table_data(server, db_path, table, limit=limit, offset=offset)
    return jsonify(res)

@database_bp.route('/api/servers/<int:server_id>/database/sqlite/query', methods=['POST'])
@login_required
def sqlite_query(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    db_path = data.get('path', '').strip()
    query = data.get('query', '').strip()
    if not db_path or not query:
        return jsonify({'success': False, 'error': 'Path and query are required.'}), 400
    res = database_service.execute_sqlite_query(server, db_path, query)
    return jsonify(res)

@database_bp.route('/api/servers/<int:server_id>/database/sqlite/discover', methods=['GET'])
@login_required
def sqlite_discover(server_id):
    server = Server.query.get_or_404(server_id)
    search_path = request.args.get('path', None)
    files = database_service.find_sqlite_files(server, search_path=search_path)
    return jsonify({'success': True, 'files': files})

# =============================================================================
# MySQL / MariaDB and PostgreSQL endpoints (read-only viewer over SSH)
# =============================================================================

def _creds(default_user):
    data = request.get_json(silent=True) or {}
    user = (data.get('user') or default_user).strip()
    password = data.get('password') or None
    return data, user, password


def _engine(kind):
    return MySql if kind == 'mysql' else Postgres


@database_bp.route('/api/servers/<int:server_id>/database/<kind>/status', methods=['GET'])
@login_required
def sql_status(server_id, kind):
    if kind not in ('mysql', 'postgres'):
        return jsonify({'success': False, 'error': 'Unknown database type.'}), 404
    server = Server.query.get_or_404(server_id)
    return jsonify({'success': True, 'status': _engine(kind).status(server)})


@database_bp.route('/api/servers/<int:server_id>/database/<kind>/databases', methods=['POST', 'GET'])
@login_required
def sql_databases(server_id, kind):
    if kind not in ('mysql', 'postgres'):
        return jsonify({'success': False, 'error': 'Unknown database type.'}), 404
    server = Server.query.get_or_404(server_id)
    _, user, password = _creds('root' if kind == 'mysql' else 'postgres')
    res = _engine(kind).databases(server, user, password)
    return jsonify(res), (200 if res.get('success') else 400)


@database_bp.route('/api/servers/<int:server_id>/database/<kind>/tables', methods=['POST'])
@login_required
def sql_tables(server_id, kind):
    if kind not in ('mysql', 'postgres'):
        return jsonify({'success': False, 'error': 'Unknown database type.'}), 404
    server = Server.query.get_or_404(server_id)
    data, user, password = _creds('root' if kind == 'mysql' else 'postgres')
    db_name = (data.get('database') or '').strip()
    if not db_name:
        return jsonify({'success': False, 'error': 'Database name is required.'}), 400
    res = _engine(kind).tables(server, db_name, user, password)
    return jsonify(res), (200 if res.get('success') else 400)


@database_bp.route('/api/servers/<int:server_id>/database/<kind>/query', methods=['POST'])
@login_required
def sql_query(server_id, kind):
    if kind not in ('mysql', 'postgres'):
        return jsonify({'success': False, 'error': 'Unknown database type.'}), 404
    server = Server.query.get_or_404(server_id)
    data, user, password = _creds('root' if kind == 'mysql' else 'postgres')
    db_name = (data.get('database') or '').strip()
    query = (data.get('query') or '').strip()
    if not db_name or not query:
        return jsonify({'success': False, 'error': 'Database name and query are required.'}), 400
    res = _engine(kind).query(server, db_name, query, user, password)
    audit('database.query', target=f'{kind}:{db_name}', detail=query[:300], ok=bool(res.get('success')))
    return jsonify(res), (200 if res.get('success') else 400)


# =============================================================================
# 1-Click Backup / Dump Endpoint
# =============================================================================

@database_bp.route('/api/servers/<int:server_id>/database/dump', methods=['POST'])
@login_required
def dump_database(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.get_json(silent=True) or {}
    db_type = (data.get('type') or 'sqlite').strip().lower()
    target = (data.get('target') or '').strip()
    user = (data.get('user') or '').strip() or None
    password = data.get('password') or None

    if not target:
        return jsonify({'success': False, 'error': 'Database name or path is required.'}), 400

    res = database_service.dump_database(server, db_type, target, user=user, password=password)
    audit('database.dump', target=f'{db_type}:{target}', ok=bool(res.get('success')))
    return jsonify(res)
