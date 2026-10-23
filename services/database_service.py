import json
import base64
import logging
import shlex
from typing import Dict, Any, List, Optional
from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.database')

class DatabaseService:
    """
    Agentless Database Explorer & Backup Manager.
    Supports SQLite (.db / .sqlite), MySQL/MariaDB, and PostgreSQL.
    Strictly read-only query execution to ensure zero data mutations.
    """

    # =========================================================================
    # SQLite (.db / .sqlite file viewer)
    # =========================================================================

    def inspect_sqlite(self, server, db_path: str) -> Dict[str, Any]:
        """Inspects an SQLite database file on the remote server and lists all tables."""
        clean_path = db_path.strip()
        b64_path = base64.b64encode(clean_path.encode('utf-8')).decode('ascii')

        py_script = (
            "import sqlite3, json, base64, os, sys\n"
            f"p = base64.b64decode('{b64_path}').decode('utf-8')\n"
            "if not os.path.exists(p):\n"
            "    print(json.dumps({'success': False, 'error': f'File not found: {p}'}))\n"
            "    sys.exit(0)\n"
            "size = os.path.getsize(p)\n"
            "try:\n"
            "    uri = f'file:{p}?mode=ro'\n"
            "    conn = sqlite3.connect(uri, uri=True, timeout=5)\n"
            "    cur = conn.cursor()\n"
            "    cur.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name\")\n"
            "    tables = [r[0] for r in cur.fetchall()]\n"
            "    cur.execute(\"SELECT sqlite_version()\")\n"
            "    ver = cur.fetchone()[0]\n"
            "    conn.close()\n"
            "    print(json.dumps({'success': True, 'path': p, 'size': size, 'sqlite_version': ver, 'tables': tables}))\n"
            "except Exception as e:\n"
            "    print(json.dumps({'success': False, 'error': str(e)}))\n"
        )
        b64_code = base64.b64encode(py_script.encode('utf-8')).decode('ascii')
        cmd = f"python3 -c \"import base64; exec(base64.b64decode('{b64_code}').decode('utf-8'))\""

        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=12)
        try:
            return json.loads(stdout.strip())
        except Exception:
            return {'success': False, 'error': stderr.strip() or stdout.strip() or 'Failed to inspect SQLite database.'}

    def get_sqlite_table_data(self, server, db_path: str, table_name: str, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """Fetches schema info, row count, and page of rows for an SQLite table."""
        clean_path = db_path.strip()
        clean_table = table_name.strip()
        b64_path = base64.b64encode(clean_path.encode('utf-8')).decode('ascii')
        b64_table = base64.b64encode(clean_table.encode('utf-8')).decode('ascii')
        lim = max(1, min(500, limit))
        off = max(0, offset)

        py_script = (
            "import sqlite3, json, base64, sys\n"
            f"p = base64.b64decode('{b64_path}').decode('utf-8')\n"
            f"tbl = base64.b64decode('{b64_table}').decode('utf-8')\n"
            "try:\n"
            "    uri = f'file:{p}?mode=ro'\n"
            "    conn = sqlite3.connect(uri, uri=True, timeout=5)\n"
            "    conn.row_factory = sqlite3.Row\n"
            "    cur = conn.cursor()\n"
            "    cur.execute(f'PRAGMA table_info(\"{tbl}\")')\n"
            "    columns = [{'cid': r[0], 'name': r[1], 'type': r[2], 'notnull': r[3], 'dflt_value': r[4], 'pk': r[5]} for r in cur.fetchall()]\n"
            "    cur.execute(f'SELECT count(*) FROM \"{tbl}\"')\n"
            "    total_rows = cur.fetchone()[0]\n"
            f"    cur.execute(f'SELECT * FROM \"{{tbl}}\" LIMIT {lim} OFFSET {off}')\n"
            "    rows = [list(r) for r in cur.fetchall()]\n"
            "    conn.close()\n"
            "    print(json.dumps({'success': True, 'table': tbl, 'columns': columns, 'total_rows': total_rows, 'limit': " + str(lim) + ", 'offset': " + str(off) + ", 'rows': rows}, default=str))\n"
            "except Exception as e:\n"
            "    print(json.dumps({'success': False, 'error': str(e)}))\n"
        )
        b64_code = base64.b64encode(py_script.encode('utf-8')).decode('ascii')
        cmd = f"python3 -c \"import base64; exec(base64.b64decode('{b64_code}').decode('utf-8'))\""

        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
        try:
            return json.loads(stdout.strip())
        except Exception:
            return {'success': False, 'error': stderr.strip() or stdout.strip()}

    def execute_sqlite_query(self, server, db_path: str, sql_query: str) -> Dict[str, Any]:
        """
        Executes a read-only query on an SQLite database.
        Enforces read-only mode and blocks data manipulation statements.
        """
        clean_path = db_path.strip()
        query = sql_query.strip()
        upper_q = query.upper()

        # Enforce read-only whitelist
        if not (upper_q.startswith('SELECT') or upper_q.startswith('EXPLAIN') or upper_q.startswith('PRAGMA')):
            return {'success': False, 'error': 'Only read-only queries (SELECT, EXPLAIN, PRAGMA) are allowed.'}

        forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'ATTACH', 'DETACH', 'VACUUM', 'REINDEX', 'REPLACE']
        for word in forbidden:
            # Check for forbidden keyword as a standalone token
            if f" {word} " in f" {upper_q} " or f";{word}" in upper_q:
                return {'success': False, 'error': f"Query contains forbidden mutation keyword '{word}'."}

        b64_path = base64.b64encode(clean_path.encode('utf-8')).decode('ascii')
        b64_sql = base64.b64encode(query.encode('utf-8')).decode('ascii')

        py_script = (
            "import sqlite3, json, base64, time\n"
            f"p = base64.b64decode('{b64_path}').decode('utf-8')\n"
            f"q = base64.b64decode('{b64_sql}').decode('utf-8')\n"
            "try:\n"
            "    uri = f'file:{p}?mode=ro'\n"
            "    conn = sqlite3.connect(uri, uri=True, timeout=8)\n"
            "    cur = conn.cursor()\n"
            "    t0 = time.perf_counter()\n"
            "    cur.execute(q)\n"
            "    cols = [d[0] for d in cur.description] if cur.description else []\n"
            "    rows = [list(r) for r in cur.fetchmany(250)]\n"
            "    elapsed = round((time.perf_counter() - t0) * 1000, 2)\n"
            "    conn.close()\n"
            "    print(json.dumps({'success': True, 'columns': cols, 'rows': rows, 'row_count': len(rows), 'elapsed_ms': elapsed}, default=str))\n"
            "except Exception as e:\n"
            "    print(json.dumps({'success': False, 'error': str(e)}))\n"
        )
        b64_code = base64.b64encode(py_script.encode('utf-8')).decode('ascii')
        cmd = f"python3 -c \"import base64; exec(base64.b64decode('{b64_code}').decode('utf-8'))\""

        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
        try:
            return json.loads(stdout.strip())
        except Exception:
            return {'success': False, 'error': stderr.strip() or stdout.strip()}

    def find_sqlite_files(self, server, search_path: Optional[str] = None) -> List[Dict[str, Any]]:
        """Finds SQLite database files in common directories (/var/www, /home, /opt, /etc, /tmp, /root)."""
        target = search_path.strip() if search_path else "/home /var/www /opt /tmp /root"
        cmd = (
            f"find {target} -maxdepth 6 -type f \\( -name \"*.db\" -o -name \"*.sqlite\" -o -name \"*.sqlite3\" \\) "
            "2>/dev/null | head -n 60"
        )
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=12)
        raw_paths = [p.strip() for p in stdout.strip().splitlines() if p.strip()]
        if not raw_paths:
            return []

        # Batch query file sizes and modification dates
        paths_quoted = ' '.join(f'"{p}"' for p in raw_paths[:60])
        size_cmd = f"ls -lh -d {paths_quoted} 2>/dev/null"
        _, size_out, _ = ssh_manager.execute(server, size_cmd, timeout=8)
        
        info_map = {}
        for s_line in size_out.strip().splitlines():
            parts = s_line.split()
            if len(parts) >= 9:
                f_size = parts[4]
                f_date = f"{parts[5]} {parts[6]} {parts[7]}"
                f_path = ' '.join(parts[8:])
                info_map[f_path] = {'size': f_size, 'date': f_date}

        found = []
        for p in raw_paths:
            meta = info_map.get(p, {})
            found.append({
                'path': p,
                'name': p.split('/')[-1],
                'size': meta.get('size', 'N/A'),
                'date': meta.get('date', '')
            })
        return found

    # =========================================================================
    # MySQL / MariaDB Explorer
    # =========================================================================

    def mysql_status(self, server) -> Dict[str, Any]:
        """Detects if MySQL / MariaDB service is active and accessible."""
        cmd = (
            "if systemctl is-active mysql >/dev/null 2>&1 || systemctl is-active mariadb >/dev/null 2>&1; then "
            "  echo 'ACTIVE'; "
            "  mysql --version 2>/dev/null || true; "
            "else "
            "  echo 'INACTIVE'; "
            "fi"
        )
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=6)
        lines = stdout.strip().splitlines()
        is_active = lines and lines[0] == 'ACTIVE'
        ver = lines[1] if len(lines) > 1 else ''
        return {
            'installed': bool(ver),
            'active': is_active,
            'version': ver
        }

    def mysql_list_databases(self, server, user: str = 'root', password: Optional[str] = None) -> List[str]:
        """Lists MySQL databases."""
        auth = f"-u {shlex.quote(user)}"
        if password:
            auth += f" -p{shlex.quote(password)}"
        cmd = f"sudo mysql {auth} -e 'SHOW DATABASES;' -s --skip-column-names 2>/dev/null || mysql {auth} -e 'SHOW DATABASES;' -s --skip-column-names 2>/dev/null"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=10)
        system_dbs = {'information_schema', 'performance_schema', 'sys'}
        dbs = []
        for line in stdout.strip().splitlines():
            d = line.strip()
            if d and d not in system_dbs:
                dbs.append(d)
        return dbs

    def mysql_list_tables(self, server, database: str, user: str = 'root', password: Optional[str] = None) -> List[str]:
        """Lists tables in a MySQL database."""
        auth = f"-u {shlex.quote(user)}"
        if password:
            auth += f" -p{shlex.quote(password)}"
        clean_db = shlex.quote(database)
        cmd = f"sudo mysql {auth} -D {clean_db} -e 'SHOW TABLES;' -s --skip-column-names 2>/dev/null || mysql {auth} -D {clean_db} -e 'SHOW TABLES;' -s --skip-column-names 2>/dev/null"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=10)
        return [l.strip() for l in stdout.strip().splitlines() if l.strip()]

    def mysql_query(self, server, database: str, query: str, user: str = 'root', password: Optional[str] = None) -> Dict[str, Any]:
        """Executes a read-only query on a MySQL database."""
        upper_q = query.strip().upper()
        if not (upper_q.startswith('SELECT') or upper_q.startswith('EXPLAIN') or upper_q.startswith('SHOW') or upper_q.startswith('DESCRIBE')):
            return {'success': False, 'error': 'Only read-only queries (SELECT, SHOW, DESCRIBE, EXPLAIN) are allowed.'}

        auth = f"-u {shlex.quote(user)}"
        if password:
            auth += f" -p{shlex.quote(password)}"
        clean_db = shlex.quote(database)
        clean_query = query.strip()
        if not clean_query.endswith(';'):
            clean_query += ';'

        cmd = f"sudo mysql {auth} -D {clean_db} -B -e {shlex.quote(clean_query)} 2>/dev/null || mysql {auth} -D {clean_db} -B -e {shlex.quote(clean_query)} 2>/dev/null"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)

        lines = stdout.strip().splitlines()
        if not lines:
            return {'success': True, 'columns': [], 'rows': [], 'row_count': 0}

        headers = lines[0].split('\t')
        rows = [l.split('\t') for l in lines[1:250]]
        return {
            'success': True,
            'columns': headers,
            'rows': rows,
            'row_count': len(rows)
        }

    # =========================================================================
    # PostgreSQL Explorer
    # =========================================================================

    def postgres_status(self, server) -> Dict[str, Any]:
        """Detects if PostgreSQL service is active."""
        cmd = (
            "if systemctl is-active postgresql >/dev/null 2>&1; then "
            "  echo 'ACTIVE'; "
            "  psql --version 2>/dev/null || true; "
            "else "
            "  echo 'INACTIVE'; "
            "fi"
        )
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=6)
        lines = stdout.strip().splitlines()
        is_active = lines and lines[0] == 'ACTIVE'
        ver = lines[1] if len(lines) > 1 else ''
        return {
            'installed': bool(ver),
            'active': is_active,
            'version': ver
        }

    def postgres_list_databases(self, server) -> List[str]:
        """Lists PostgreSQL databases via peer auth sudo -u postgres."""
        cmd = "sudo -u postgres psql -t -A -c \"SELECT datname FROM pg_database WHERE NOT datistemplate AND datname != 'postgres';\" 2>/dev/null || true"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=10)
        return [l.strip() for l in stdout.strip().splitlines() if l.strip()]

    def postgres_list_tables(self, server, database: str) -> List[str]:
        """Lists tables in a PostgreSQL database."""
        cmd = f"sudo -u postgres psql -d {shlex.quote(database)} -t -A -c \"SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;\" 2>/dev/null || true"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=10)
        return [l.strip() for l in stdout.strip().splitlines() if l.strip()]

    def postgres_query(self, server, database: str, query: str) -> Dict[str, Any]:
        """Executes a read-only query on PostgreSQL."""
        upper_q = query.strip().upper()
        if not (upper_q.startswith('SELECT') or upper_q.startswith('EXPLAIN')):
            return {'success': False, 'error': 'Only read-only queries (SELECT, EXPLAIN) are allowed.'}

        clean_db = shlex.quote(database)
        cmd = f"sudo -u postgres psql -d {clean_db} -A -F '\t' -c {shlex.quote(query)} 2>/dev/null || true"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
        lines = stdout.strip().splitlines()
        if not lines:
            return {'success': True, 'columns': [], 'rows': [], 'row_count': 0}

        headers = lines[0].split('\t')
        rows = []
        for l in lines[1:]:
            # psql outputs summary row like '(5 rows)'
            if l.startswith('(') and 'row' in l:
                break
            rows.append(l.split('\t'))
        return {
            'success': True,
            'columns': headers,
            'rows': rows[:250],
            'row_count': len(rows)
        }

    # =========================================================================
    # 1-Click Database Dump / Backup
    # =========================================================================

    def dump_database(self, server, db_type: str, db_name_or_path: str, user: Optional[str] = None, password: Optional[str] = None) -> Dict[str, Any]:
        """
        Creates a compressed database dump (.sql.gz or .db.gz) in /tmp/
        and returns the download path and size.
        """
        import time
        ts = int(time.time())
        target = db_name_or_path.strip()

        if db_type == 'sqlite':
            dump_file = f"/tmp/sqlite_{target.split('/')[-1]}_{ts}.db.gz"
            cmd = f"gzip -c {shlex.quote(target)} > {shlex.quote(dump_file)} && chmod 644 {shlex.quote(dump_file)} && ls -lh {shlex.quote(dump_file)}"
        elif db_type == 'mysql':
            dump_file = f"/tmp/mysql_{target}_{ts}.sql.gz"
            auth = f"-u {shlex.quote(user or 'root')}"
            if password:
                auth += f" -p{shlex.quote(password)}"
            cmd = f"(sudo mysqldump {auth} {shlex.quote(target)} 2>/dev/null || mysqldump {auth} {shlex.quote(target)} 2>/dev/null) | gzip -c > {shlex.quote(dump_file)} && chmod 644 {shlex.quote(dump_file)} && ls -lh {shlex.quote(dump_file)}"
        elif db_type == 'postgres':
            dump_file = f"/tmp/pg_{target}_{ts}.sql.gz"
            cmd = f"sudo -u postgres pg_dump {shlex.quote(target)} | gzip -c > {shlex.quote(dump_file)} && chmod 644 {shlex.quote(dump_file)} && ls -lh {shlex.quote(dump_file)}"
        else:
            return {'success': False, 'error': f"Unsupported database type '{db_type}'"}

        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=60)
        if exit_code != 0:
            return {'success': False, 'error': f"Dump failed: {stderr.strip() or stdout.strip()}"}

        size_info = stdout.strip().split()[4] if len(stdout.strip().split()) >= 5 else 'Unknown'
        return {
            'success': True,
            'dump_file': dump_file,
            'size': size_info,
            'message': f"Successfully created compressed backup of {target} ({size_info})."
        }

database_service = DatabaseService()

