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

    # MySQL / MariaDB and PostgreSQL live in services/sqlserver_service.py

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
        elif db_type in ('mysql', 'postgres'):
            from services.sqlserver_service import MySql, Postgres, SAFE_USER_RE, SAFE_NAME_RE
            if not SAFE_NAME_RE.match(target) or not SAFE_USER_RE.match(user or ('root' if db_type == 'mysql' else 'postgres')):
                return {'success': False, 'error': 'The database or user name contains characters that are not allowed.'}
            import re as _re
            safe = _re.sub(r'[^A-Za-z0-9_.-]', '_', target)
            dump_file = f"/tmp/{'mysql' if db_type == 'mysql' else 'pg'}_{safe}_{ts}.sql.gz"
            if db_type == 'mysql':
                code, o, e = MySql.dump(server, target, user or 'root', password, dump_file)
            else:
                code, o, e = Postgres.dump(server, target, user or 'postgres', password, dump_file)
            if code != 0:
                return {'success': False, 'error': f"Dump failed: {(e or o).strip().splitlines()[0] if (e or o).strip() else 'unknown error'}"}
            parts = o.strip().split()
            size_info = parts[4] if len(parts) >= 5 else 'Unknown'
            return {'success': True, 'dump_file': dump_file, 'size': size_info,
                    'message': f"Successfully created compressed backup of {target} ({size_info})."}
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

