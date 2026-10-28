"""MySQL / MariaDB and PostgreSQL viewer over SSH (agentless).

Everything runs with the database's own command line client on the remote server, over its local socket or
127.0.0.1, so no database port has to be opened. Queries are strictly read-only: only one statement is accepted
(comments are removed first), only SELECT-like statements are allowed, and the session itself is read-only on the
database side as well, so a statement that slips past the checks still cannot change data.

Passwords are handed to the client in an environment variable (MYSQL_PWD / PGPASSWORD), never on the command line,
and are never written to logs or the audit trail.
"""
import csv
import io
import logging
import re
import shlex
import time
from typing import Any, Dict, List, Optional, Tuple

from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.sqlserver')

MAX_ROWS = 500
SAFE_USER_RE = re.compile(r'^[A-Za-z0-9_.@\-]{1,64}$')
SAFE_NAME_RE = re.compile(r'^[^\x00-\x1f\'"`\\;]{1,128}$')

MYSQL_FIRST = {'SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'WITH'}
PG_FIRST = {'SELECT', 'SHOW', 'EXPLAIN', 'WITH', 'TABLE', 'VALUES'}
_BLOCKED = re.compile(r'\bINTO\s+(OUTFILE|DUMPFILE)\b|\bLOAD_FILE\s*\(', re.I)

# What the clients print when the first attempt (as the SSH user) is not allowed in; we then retry with sudo.
_AUTH_HINTS = re.compile(
    r"access denied|can't connect|cannot connect|error 1045|error 2002|error 1698|"
    r"peer authentication failed|password authentication failed|role .* does not exist|"
    r"could not connect|fe_sendauth|no password supplied|permission denied", re.I)

MYSQL_PREFIX = ('B=$(command -v mysql || command -v mariadb) || '
                '{ echo "No mysql or mariadb command line client found on this server." >&2; exit 127; }; ')
PG_PREFIX = ('command -v psql >/dev/null 2>&1 || '
             '{ echo "No psql command line client found on this server." >&2; exit 127; }; '
             'if [ "$(id -u)" = 0 ] && command -v runuser >/dev/null 2>&1; then AS="runuser -u postgres --"; '
             'else AS="sudo -n -u postgres"; fi; ')


# --------------------------------------------------------------------------- query checks
def strip_comments_and_split(sql: str) -> Tuple[str, bool]:
    """Remove SQL comments and report whether more than one statement is present.

    Returns (cleaned single statement without a trailing semicolon, has_extra_statement).
    Quotes ('...', "...", `...`) are respected so a semicolon inside a string is fine.
    """
    out: List[str] = []
    i, n = 0, len(sql)
    quote = None
    extra = False
    seen_semicolon = False
    while i < n:
        c = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ''
        if quote:
            out.append(c)
            if c == '\\' and quote != '`' and i + 1 < n:      # backslash escape (MySQL strings)
                out.append(nxt)
                i += 2
                continue
            if c == quote:
                if nxt == quote:                                # doubled quote = escaped quote
                    out.append(nxt)
                    i += 2
                    continue
                quote = None
            i += 1
            continue
        if c in ("'", '"', '`'):
            if seen_semicolon:
                extra = True
            quote = c
            out.append(c)
            i += 1
            continue
        if c == '-' and nxt == '-' and (i + 2 >= n or sql[i + 2] in ' \t\r\n'):
            while i < n and sql[i] != '\n':
                i += 1
            out.append(' ')
            continue
        if c == '#':
            while i < n and sql[i] != '\n':
                i += 1
            out.append(' ')
            continue
        if c == '/' and nxt == '*':
            j = sql.find('*/', i + 2)
            i = n if j < 0 else j + 2
            out.append(' ')
            continue
        if c == ';':
            seen_semicolon = True
            i += 1
            continue
        if seen_semicolon and not c.isspace():
            extra = True
        if not seen_semicolon:
            out.append(c)
        i += 1
    if quote:
        extra = True                                           # unterminated string: refuse
    return ''.join(out).strip(), extra


def check_readonly(sql: str, allowed_first: set) -> Tuple[Optional[str], Optional[str]]:
    """(statement, None) when the query may run, or (None, reason)."""
    stmt, extra = strip_comments_and_split(sql or '')
    if not stmt:
        return None, 'Type a query first.'
    if extra:
        return None, 'Only one statement at a time is allowed.'
    first = re.split(r'[\s(]', stmt, 1)[0].upper()
    if first not in allowed_first:
        return None, 'Only read-only queries (' + ', '.join(sorted(allowed_first)) + ') are allowed.'
    if _BLOCKED.search(stmt):
        return None, 'Writing files from a query is not allowed.'
    return stmt, None


def unescape_mysql(v: str) -> str:
    """mysql --batch escapes tab, newline, backslash and NUL."""
    if '\\' not in v:
        return v
    return re.sub(r'\\([tn0\\r])', lambda m: {'t': '\t', 'n': '\n', '0': '\0', '\\': '\\', 'r': '\r'}[m.group(1)], v)


def _first_error(stderr: str, stdout: str = '') -> str:
    """The line of client output that names the problem (skips warnings and the dashed query echo)."""
    text = (stderr or '').strip() or (stdout or '').strip()
    lines = [l.strip() for l in text.splitlines()
             if l.strip() and 'Using a password on the command line' not in l and not set(l.strip()) <= {'-'}]
    for l in lines:
        if re.search(r'\berror\b|\bfatal\b|denied|failed|no such|not found|could not|can.t connect', l, re.I):
            return l
    return (lines[0] if lines else text) or 'The database did not answer.'


def _bad_user(user: str) -> Optional[str]:
    if not SAFE_USER_RE.match(user or ''):
        return 'The user name contains characters that are not allowed.'
    return None


def _bad_name(name: str) -> Optional[str]:
    if not SAFE_NAME_RE.match(name or ''):
        return 'The database name contains characters that are not allowed.'
    return None


# =========================================================================== MySQL / MariaDB
class MySql:
    @staticmethod
    def _argv(user: str, database: Optional[str], extra: str, readonly: bool = True) -> str:
        parts = ['-u', shlex.quote(user)]
        if database:
            parts += ['-D', shlex.quote(database)]
        parts += ['--batch', '--default-character-set=utf8mb4']
        if readonly:
            parts.append('--init-command=' + shlex.quote('SET SESSION TRANSACTION READ ONLY'))
        parts.append(extra)
        return ' '.join(parts)

    @classmethod
    def run(cls, server, user: str, password: Optional[str], database: Optional[str], extra: str,
            timeout: int = 15, tail: Optional[int] = None) -> Tuple[int, str, str]:
        """Run the client. Tries the SSH user first, then sudo (for socket logins) when no password was given."""
        env = f"MYSQL_PWD={shlex.quote(password)} " if password else ''
        argv = cls._argv(user, database, extra)
        pipe = f" | head -n {int(tail)}" if tail else ''
        cmd = f'{MYSQL_PREFIX}{env}"$B" {argv}{pipe}'
        code, out, err = ssh_manager.execute(server, cmd, timeout=timeout)
        if not out.strip() and not password and _AUTH_HINTS.search(err or ''):
            cmd2 = f'{MYSQL_PREFIX}sudo -n "$B" {argv}{pipe}'
            code2, out2, err2 = ssh_manager.execute(server, cmd2, timeout=timeout)
            if out2.strip() or code2 == 0:
                return code2, out2, err2
            if 'sudo' in (err2 or '').lower() and 'password' in (err2 or '').lower():
                err = (err or '') + '\n(sudo needs a password on this server)'
        return code, out, err

    @classmethod
    def status(cls, server) -> Dict[str, Any]:
        cmd = (
            'B=$(command -v mysql || command -v mariadb); '
            'echo "ACTIVE:$(systemctl is-active mysql mariadb mysqld 2>/dev/null | grep -c "^active")"; '
            'if [ -n "$B" ]; then "$B" --version 2>/dev/null; else echo NOCLIENT; fi'
        )
        code, out, err = ssh_manager.execute(server, cmd, timeout=8)
        lines = [l.strip() for l in out.splitlines() if l.strip()]
        active = bool(lines and lines[0].startswith('ACTIVE:') and lines[0] != 'ACTIVE:0')
        ver = lines[1] if len(lines) > 1 and lines[1] != 'NOCLIENT' else ''
        return {'installed': bool(ver), 'active': active, 'version': ver}

    @classmethod
    def databases(cls, server, user: str, password: Optional[str]) -> Dict[str, Any]:
        bad = _bad_user(user)
        if bad:
            return {'success': False, 'error': bad}
        code, out, err = cls.run(server, user, password, None, '-s --skip-column-names -e ' + shlex.quote('SHOW DATABASES'))
        if code != 0 and not out.strip():
            return {'success': False, 'error': _first_error(err, out)}
        hidden = {'information_schema', 'performance_schema', 'sys'}
        dbs = [unescape_mysql(l.strip()) for l in out.splitlines() if l.strip() and l.strip() not in hidden]
        return {'success': True, 'databases': dbs}

    @classmethod
    def tables(cls, server, database: str, user: str, password: Optional[str]) -> Dict[str, Any]:
        bad = _bad_user(user) or _bad_name(database)
        if bad:
            return {'success': False, 'error': bad}
        sql = ("SELECT TABLE_NAME, TABLE_TYPE, IFNULL(TABLE_ROWS, 0) FROM information_schema.TABLES "
               f"WHERE TABLE_SCHEMA = '{database}' ORDER BY TABLE_NAME")
        code, out, err = cls.run(server, user, password, None, '-s --skip-column-names -e ' + shlex.quote(sql))
        if code != 0 and not out.strip():
            return {'success': False, 'error': _first_error(err, out)}
        tables = []
        for line in out.splitlines():
            p = line.split('\t')
            if len(p) >= 2 and p[0]:
                tables.append({'name': unescape_mysql(p[0]), 'type': 'view' if 'VIEW' in p[1].upper() else 'table',
                               'rows': int(p[2]) if len(p) > 2 and p[2].isdigit() else None})
        return {'success': True, 'database': database, 'tables': tables}

    @classmethod
    def query(cls, server, database: Optional[str], sql: str, user: str, password: Optional[str]) -> Dict[str, Any]:
        bad = _bad_user(user) or (_bad_name(database) if database else None)
        if bad:
            return {'success': False, 'error': bad}
        stmt, why = check_readonly(sql, MYSQL_FIRST)
        if why:
            return {'success': False, 'error': why}
        t0 = time.time()
        code, out, err = cls.run(server, user, password, database, '-e ' + shlex.quote(stmt),
                                 timeout=30, tail=MAX_ROWS + 2)
        ms = int((time.time() - t0) * 1000)
        if not out.strip():
            if (err or '').strip() and 'Using a password' not in err:
                return {'success': False, 'error': _first_error(err)}
            return {'success': True, 'columns': [], 'rows': [], 'row_count': 0, 'elapsed_ms': ms, 'truncated': False}
        lines = out.split('\n')
        if lines and lines[-1] == '':
            lines.pop()
        columns = [unescape_mysql(c) for c in lines[0].split('\t')]
        rows = [[None if c == 'NULL' else unescape_mysql(c) for c in l.split('\t')] for l in lines[1:]]
        truncated = len(rows) > MAX_ROWS
        return {'success': True, 'columns': columns, 'rows': rows[:MAX_ROWS], 'row_count': min(len(rows), MAX_ROWS),
                'elapsed_ms': ms, 'truncated': truncated}

    @classmethod
    def dump(cls, server, database: str, user: str, password: Optional[str], dump_file: str) -> Tuple[int, str, str]:
        env = f"MYSQL_PWD={shlex.quote(password)} " if password else ''
        d = ('umask 077; B=$(command -v mysqldump || command -v mariadb-dump) || '
             '{ echo "No mysqldump or mariadb-dump found on this server." >&2; exit 127; }; ')
        args = f'-u {shlex.quote(user)} --single-transaction --routines {shlex.quote(database)}'
        return _dump_via_file(server, d, env + '"$B"', 'sudo -n "$B"', args, dump_file, not password)


# =========================================================================== PostgreSQL
class Postgres:
    @staticmethod
    def _base(user: str, database: Optional[str]) -> str:
        parts = ['psql', '-X', '-q', '-U', shlex.quote(user)]
        if database:
            parts += ['-d', shlex.quote(database)]
        return ' '.join(parts)

    @classmethod
    def run(cls, server, user: str, password: Optional[str], database: Optional[str], sql: str,
            timeout: int = 15, csv_out: bool = True, tail: Optional[int] = None) -> Tuple[int, str, str]:
        opts = "-c default_transaction_read_only=on -c statement_timeout=%d" % (timeout * 1000 - 1000)
        flags = ('--csv ' if csv_out else '-A -t ') + '-P null=NULL -c ' + shlex.quote(sql)
        pipe = f" | head -n {int(tail)}" if tail else ''
        base = cls._base(user, database)
        if password:
            cmd = f"{PG_PREFIX}PGOPTIONS={shlex.quote(opts)} PGPASSWORD={shlex.quote(password)} {base} -h 127.0.0.1 {flags}{pipe}"
            return ssh_manager.execute(server, cmd, timeout=timeout)
        cmd = f"{PG_PREFIX}PGOPTIONS={shlex.quote(opts)} {base} {flags}{pipe}"
        code, out, err = ssh_manager.execute(server, cmd, timeout=timeout)
        if not out.strip() and _AUTH_HINTS.search(err or ''):
            # peer authentication: run as the postgres operating system user
            cmd2 = f"{PG_PREFIX}$AS env PGOPTIONS={shlex.quote(opts)} {base} {flags}{pipe}"
            code2, out2, err2 = ssh_manager.execute(server, cmd2, timeout=timeout)
            if out2.strip() or code2 == 0:
                return code2, out2, err2
            if 'sudo' in (err2 or '').lower() and 'password' in (err2 or '').lower():
                err = (err or '') + '\n(sudo needs a password on this server)'
        return code, out, err

    @classmethod
    def status(cls, server) -> Dict[str, Any]:
        cmd = ('echo "ACTIVE:$(systemctl is-active postgresql 2>/dev/null | grep -c "^active")"; '
               'psql --version 2>/dev/null || echo NOCLIENT')
        code, out, err = ssh_manager.execute(server, cmd, timeout=8)
        lines = [l.strip() for l in out.splitlines() if l.strip()]
        active = bool(lines and lines[0].startswith('ACTIVE:') and lines[0] != 'ACTIVE:0')
        ver = lines[1] if len(lines) > 1 and lines[1] != 'NOCLIENT' else ''
        return {'installed': bool(ver), 'active': active, 'version': ver}

    @staticmethod
    def _parse_csv(out: str) -> Tuple[List[str], List[List[Optional[str]]]]:
        reader = csv.reader(io.StringIO(out))
        rows = [r for r in reader]
        if not rows:
            return [], []
        return rows[0], [[None if c == 'NULL' else c for c in r] for r in rows[1:]]

    @classmethod
    def databases(cls, server, user: str, password: Optional[str]) -> Dict[str, Any]:
        bad = _bad_user(user)
        if bad:
            return {'success': False, 'error': bad}
        code, out, err = cls.run(server, user, password, 'postgres',
                                 'SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY 1')
        if code != 0 and not out.strip():
            return {'success': False, 'error': _first_error(err, out)}
        _, rows = cls._parse_csv(out)
        return {'success': True, 'databases': [r[0] for r in rows if r and r[0]]}

    @classmethod
    def tables(cls, server, database: str, user: str, password: Optional[str]) -> Dict[str, Any]:
        bad = _bad_user(user) or _bad_name(database)
        if bad:
            return {'success': False, 'error': bad}
        sql = ("SELECT n.nspname, c.relname, c.relkind, GREATEST(c.reltuples, 0)::bigint FROM pg_class c "
               "JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','v','m','p','f') "
               "AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' "
               "ORDER BY 1, 2")
        code, out, err = cls.run(server, user, password, database, sql)
        if code != 0 and not out.strip():
            return {'success': False, 'error': _first_error(err, out)}
        _, rows = cls._parse_csv(out)
        tables = []
        for r in rows:
            if len(r) >= 3:
                tables.append({'schema': r[0], 'name': r[1], 'type': 'view' if r[2] in ('v', 'm') else 'table',
                               'rows': int(r[3]) if len(r) > 3 and (r[3] or '').lstrip('-').isdigit() else None})
        return {'success': True, 'database': database, 'tables': tables}

    @classmethod
    def query(cls, server, database: Optional[str], sql: str, user: str, password: Optional[str]) -> Dict[str, Any]:
        bad = _bad_user(user) or (_bad_name(database) if database else None)
        if bad:
            return {'success': False, 'error': bad}
        stmt, why = check_readonly(sql, PG_FIRST)
        if why:
            return {'success': False, 'error': why}
        t0 = time.time()
        code, out, err = cls.run(server, user, password, database or 'postgres', stmt, timeout=30, tail=5000)
        ms = int((time.time() - t0) * 1000)
        if not out.strip() and (err or '').strip() or (code != 0 and not out.strip()):
            msg = _first_error(err, out)
            if 'unrecognized option' in msg and 'csv' in msg:
                msg = 'This server has a PostgreSQL client older than 12, which cannot return results in CSV form.'
            return {'success': False, 'error': msg}
        columns, rows = cls._parse_csv(out)
        truncated = len(rows) > MAX_ROWS
        return {'success': True, 'columns': columns, 'rows': rows[:MAX_ROWS], 'row_count': min(len(rows), MAX_ROWS),
                'elapsed_ms': ms, 'truncated': truncated}

    @classmethod
    def dump(cls, server, database: str, user: str, password: Optional[str], dump_file: str) -> Tuple[int, str, str]:
        head = ('umask 077; command -v pg_dump >/dev/null 2>&1 || '
                '{ echo "No pg_dump found on this server." >&2; exit 127; }; ')
        if password:
            return _dump_via_file(server, head, f'PGPASSWORD={shlex.quote(password)} pg_dump -h 127.0.0.1', None,
                                  f'-U {shlex.quote(user)} {shlex.quote(database)}', dump_file, False)
        return _dump_via_file(server, head + PG_PREFIX, f'pg_dump', '$AS pg_dump',
                              f'-U {shlex.quote(user)} {shlex.quote(database)}', dump_file, True,
                              sudo_args=shlex.quote(database))


def _dump_via_file(server, head: str, plain: str, fallback: Optional[str], args: str, dump_file: str,
                   allow_fallback: bool, sudo_args: Optional[str] = None) -> Tuple[int, str, str]:
    """Write the dump to a .sql file first (so a failing dump is never mistaken for an empty success), then gzip it."""
    sql = dump_file[:-3] if dump_file.endswith('.gz') else dump_file + '.sql'
    q_sql, q_gz = shlex.quote(sql), shlex.quote(dump_file)
    finish = f'gzip -f {q_sql} && chmod 600 {q_gz} && ls -lh {q_gz}'

    def script(binary, a):
        return f'{head}{binary} {a} > {q_sql} && {finish} || {{ rc=$?; rm -f {q_sql} {q_gz}; exit $rc; }}'

    code, out, err = ssh_manager.execute(server, script(plain, args), timeout=180)
    if code != 0 and allow_fallback and fallback and _AUTH_HINTS.search(err or ''):
        code, out, err = ssh_manager.execute(server, script(fallback, sudo_args or args), timeout=180)
    return code, out, err
