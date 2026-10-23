import os
import logging
from flask import Blueprint, jsonify, request, send_file, Response
from routes.auth_helpers import login_required
from models.server import Server
from services.database_service import database_service
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
# MySQL / MariaDB Endpoints
# =============================================================================

@database_bp.route('/api/servers/<int:server_id>/database/mysql/status', methods=['GET'])
@login_required
def mysql_status(server_id):
    server = Server.query.get_or_404(server_id)
    res = database_service.mysql_status(server)
    return jsonify({'success': True, 'status': res})

@database_bp.route('/api/servers/<int:server_id>/database/mysql/databases', methods=['POST'])
@login_required
def mysql_databases(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    user = data.get('user', 'root')
    password = data.get('password', None)
    try:
        dbs = database_service.mysql_list_databases(server, user=user, password=password)
        return jsonify({'success': True, 'databases': dbs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@database_bp.route('/api/servers/<int:server_id>/database/mysql/tables', methods=['POST'])
@login_required
def mysql_tables(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    db_name = data.get('database', '').strip()
    user = data.get('user', 'root')
    password = data.get('password', None)
    if not db_name:
        return jsonify({'success': False, 'error': 'Database name is required.'}), 400
    tables = database_service.mysql_list_tables(server, db_name, user=user, password=password)
    return jsonify({'success': True, 'database': db_name, 'tables': tables})

@database_bp.route('/api/servers/<int:server_id>/database/mysql/query', methods=['POST'])
@login_required
def mysql_query(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    db_name = data.get('database', '').strip()
    query = data.get('query', '').strip()
    user = data.get('user', 'root')
    password = data.get('password', None)
    if not db_name or not query:
        return jsonify({'success': False, 'error': 'Database name and query are required.'}), 400
    res = database_service.mysql_query(server, db_name, query, user=user, password=password)
    return jsonify(res)

# =============================================================================
# PostgreSQL Endpoints
# =============================================================================

@database_bp.route('/api/servers/<int:server_id>/database/postgres/status', methods=['GET'])
@login_required
def postgres_status(server_id):
    server = Server.query.get_or_404(server_id)
    res = database_service.postgres_status(server)
    return jsonify({'success': True, 'status': res})

@database_bp.route('/api/servers/<int:server_id>/database/postgres/databases', methods=['GET'])
@login_required
def postgres_databases(server_id):
    server = Server.query.get_or_404(server_id)
    try:
        dbs = database_service.postgres_list_databases(server)
        return jsonify({'success': True, 'databases': dbs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@database_bp.route('/api/servers/<int:server_id>/database/postgres/tables', methods=['POST'])
@login_required
def postgres_tables(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    db_name = data.get('database', '').strip()
    if not db_name:
        return jsonify({'success': False, 'error': 'Database name is required.'}), 400
    tables = database_service.postgres_list_tables(server, db_name)
    return jsonify({'success': True, 'database': db_name, 'tables': tables})

@database_bp.route('/api/servers/<int:server_id>/database/postgres/query', methods=['POST'])
@login_required
def postgres_query(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    db_name = data.get('database', '').strip()
    query = data.get('query', '').strip()
    if not db_name or not query:
        return jsonify({'success': False, 'error': 'Database name and query are required.'}), 400
    res = database_service.postgres_query(server, db_name, query)
    return jsonify(res)

# =============================================================================
# 1-Click Backup / Dump Endpoint
# =============================================================================

@database_bp.route('/api/servers/<int:server_id>/database/dump', methods=['POST'])
@login_required
def dump_database(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    db_type = data.get('type', 'sqlite').strip().lower()
    target = data.get('target', '').strip()
    user = data.get('user', None)
    password = data.get('password', None)

    if not target:
        return jsonify({'success': False, 'error': 'Database name or path is required.'}), 400

    res = database_service.dump_database(server, db_type, target, user=user, password=password)
    return jsonify(res)
