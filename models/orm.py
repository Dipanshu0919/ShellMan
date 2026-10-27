"""Small SQLite data layer for ShellMan (standard library `sqlite3` only, no SQLAlchemy).

Why: SQLAlchemy plus Flask-SQLAlchemy cost about 20 MB of RAM at start-up. ShellMan only ever talks to one
SQLite file, so this module provides just what the app needs, with the same names the code already uses.

Quick tour
----------
Define a model::

    class Server(db.Model):
        __tablename__ = 'servers'
        id   = db.Column(db.Integer, primary_key=True)
        name = db.Column(db.String(120), nullable=False)

Read::

    Server.query.get(3)                                  # by primary key, or None
    Server.query.get_or_404(3)                           # 404 JSON/HTML error when missing
    Server.query.filter_by(host='1.2.3.4').first()
    Server.query.filter(Server.port > 22, Server.name.like('web%')).order_by(Server.id.desc()).limit(10).all()
    Server.query.count()

Write (nothing is saved until commit)::

    s = Server(name='web-1'); db.session.add(s); db.session.commit()
    s.name = 'web-2';         db.session.commit()          # changed fields are tracked automatically
    db.session.delete(s);     db.session.commit()

Bulk and raw SQL (parameters are always passed separately, never formatted into the string)::

    Alert.query.filter_by(acknowledged=False).update({'acknowledged': True})
    db.rows('SELECT DISTINCT username FROM audit_log LIMIT 100')    # list of sqlite3.Row
    db.scalar('SELECT COUNT(*) FROM audit_log WHERE ok = ?', (0,))
    db.isolated('INSERT INTO audit_log (...) VALUES (?, ?)', params)   # own connection, never touches the open transaction

Rules of the layer
------------------
* One SQLite connection per thread, opened on first use and kept for the life of the thread.
* One session per thread, cleared at the end of every request (`teardown_appcontext`) and by `db.session.remove()`.
* Writes happen in a `BEGIN IMMEDIATE` transaction so a second writer waits (busy timeout) instead of failing.
* Dates are stored as naive UTC text ("YYYY-MM-DD HH:MM:SS.ffffff"), the same format the old layer used, so
  existing databases open unchanged.
"""
import os
import re
import sqlite3
import threading
import weakref
from datetime import datetime, timezone

from werkzeug.exceptions import NotFound

BUSY_TIMEOUT_MS = 15000
CACHE_KB = 512

_IDENT = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')


# ---------------------------------------------------------------------------------------------------------------
# Column types
# ---------------------------------------------------------------------------------------------------------------
class _Type:
    ddl = 'TEXT'

    def to_db(self, v):
        return v

    def from_db(self, v):
        return v


class Integer(_Type):
    ddl = 'INTEGER'

    def to_db(self, v):
        return None if v is None else int(v)


class Float(_Type):
    ddl = 'FLOAT'

    def to_db(self, v):
        return None if v is None else float(v)


class String(_Type):
    def __init__(self, length=None):
        self.length = length
        self.ddl = f'VARCHAR({length})' if length else 'VARCHAR'


class Text(_Type):
    ddl = 'TEXT'


class Boolean(_Type):
    ddl = 'BOOLEAN'

    def to_db(self, v):
        return None if v is None else (1 if v else 0)

    def from_db(self, v):
        return None if v is None else bool(v)


class DateTime(_Type):
    ddl = 'DATETIME'
    _FMT = '%Y-%m-%d %H:%M:%S.%f'

    def to_db(self, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                v = v.astimezone(timezone.utc).replace(tzinfo=None)
            return v.strftime(self._FMT)
        return str(v)

    def from_db(self, v):
        if v is None or isinstance(v, datetime):
            return v
        try:
            return datetime.fromisoformat(str(v))
        except ValueError:
            return datetime.strptime(str(v), self._FMT)


def _as_type(t):
    return t() if isinstance(t, type) else t


class ForeignKey:
    def __init__(self, target, ondelete=None):
        self.table, self.column = target.split('.', 1)
        self.ondelete = ondelete


# ---------------------------------------------------------------------------------------------------------------
# SQL expressions: Server.port > 22, Server.name.like('x%'), (a == 1) | (b == 2)
# ---------------------------------------------------------------------------------------------------------------
class Expr:
    def __init__(self, sql, params=()):
        self.sql = sql
        self.params = list(params)

    def __and__(self, other):
        return Expr(f'({self.sql} AND {other.sql})', self.params + other.params)

    def __or__(self, other):
        return Expr(f'({self.sql} OR {other.sql})', self.params + other.params)

    def __invert__(self):
        return Expr(f'(NOT {self.sql})', self.params)


def and_(*exprs):
    out = exprs[0]
    for e in exprs[1:]:
        out = out & e
    return out


def or_(*exprs):
    out = exprs[0]
    for e in exprs[1:]:
        out = out | e
    return out


class Ordering:
    def __init__(self, column, direction):
        self.sql = f'{column.qname} {direction}'


class Column:
    """Declared as a class attribute; acts as the field on instances and as an expression builder on the class."""

    def __init__(self, type_, *extra, primary_key=False, nullable=True, unique=False, index=False,
                 default=None, onupdate=None, server_default=None):
        self.type = _as_type(type_)
        self.fk = next((e for e in extra if isinstance(e, ForeignKey)), None)
        self.primary_key = primary_key
        self.nullable = nullable and not primary_key
        self.unique = unique
        self.index = index
        self.default = default
        self.onupdate = onupdate
        self.server_default = server_default
        self.name = None
        self.table = None

    def __set_name__(self, owner, name):
        self.name = name

    @property
    def qname(self):
        return f'"{self.table}"."{self.name}"'

    # instance access ------------------------------------------------------------------------------------------
    def __get__(self, obj, owner=None):
        if obj is None:
            return self
        return obj.__dict__['_d'].get(self.name)

    def __set__(self, obj, value):
        data = obj.__dict__['_d']
        if obj.__dict__.get('_persisted') and data.get(self.name) != value:
            _session()._mark_dirty(obj)
        data[self.name] = value

    # expressions ------------------------------------------------------------------------------------------------
    def _cmp(self, op, v):
        return Expr(f'{self.qname} {op} ?', [self.type.to_db(v)])

    def __eq__(self, v):
        return self.is_(None) if v is None else self._cmp('=', v)

    def __ne__(self, v):
        return self.isnot(None) if v is None else self._cmp('!=', v)

    def __lt__(self, v):
        return self._cmp('<', v)

    def __le__(self, v):
        return self._cmp('<=', v)

    def __gt__(self, v):
        return self._cmp('>', v)

    def __ge__(self, v):
        return self._cmp('>=', v)

    __hash__ = object.__hash__

    def like(self, pattern):
        return Expr(f'{self.qname} LIKE ?', [pattern])

    def ilike(self, pattern):
        return Expr(f'LOWER({self.qname}) LIKE LOWER(?)', [pattern])

    def in_(self, values):
        values = [self.type.to_db(v) for v in values]
        if not values:
            return Expr('0')
        return Expr(f'{self.qname} IN ({",".join("?" * len(values))})', values)

    def is_(self, v):
        if v is None:
            return Expr(f'{self.qname} IS NULL')
        return Expr(f'{self.qname} = ?', [self.type.to_db(v)])

    def isnot(self, v):
        if v is None:
            return Expr(f'{self.qname} IS NOT NULL')
        return Expr(f'{self.qname} != ?', [self.type.to_db(v)])

    def asc(self):
        return Ordering(self, 'ASC')

    def desc(self):
        return Ordering(self, 'DESC')


# ---------------------------------------------------------------------------------------------------------------
# Relationships (many-to-one with an optional list on the other side)
# ---------------------------------------------------------------------------------------------------------------
class _Backref:
    def __init__(self, name, cascade=None, lazy=None):
        self.name = name
        self.cascade = cascade


def backref(name, cascade=None, lazy=None):
    return _Backref(name, cascade, lazy)


class Relationship:
    def __init__(self, target, backref=None):
        self.target_name = target
        self.backref = backref
        self.owner = None
        self.name = None
        self.fk_column = None

    def __set_name__(self, owner, name):
        self.owner, self.name = owner, name

    def _target(self):
        return _REGISTRY.get(self.target_name)

    def __get__(self, obj, owner=None):
        if obj is None:
            return self
        fk = obj.__dict__['_d'].get(self.fk_column.name)
        if fk is None:
            return None
        return self._target().query.get(fk)

    def __set__(self, obj, value):
        setattr(obj, self.fk_column.name, None if value is None else value.id)


class _ChildList:
    """`server.git_deployments`: the rows of the child table that point at this object."""

    def __init__(self, child_cls, fk_name, cascade):
        self.child_cls, self.fk_name, self.cascade = child_cls, fk_name, cascade

    def __get__(self, obj, owner=None):
        if obj is None:
            return self
        return self.child_cls.query.filter_by(**{self.fk_name: obj.id}).all()


_REGISTRY = {}
_PENDING_RELS = []


def _link_relationships():
    for rel in list(_PENDING_RELS):
        target = _REGISTRY.get(rel.target_name)
        if target is None:
            continue
        fk = next((c for c in rel.owner._columns if c.fk and c.fk.table == target.__tablename__), None)
        if fk is None:
            raise RuntimeError(f'No foreign key from {rel.owner.__name__} to {rel.target_name}')
        rel.fk_column = fk
        if rel.backref:
            cascade = 'delete' in (rel.backref.cascade or '')
            lst = _ChildList(rel.owner, fk.name, cascade)
            setattr(target, rel.backref.name, lst)
            target._children.append(lst)
        _PENDING_RELS.remove(rel)


# ---------------------------------------------------------------------------------------------------------------
# Connections and sessions (both thread-local)
# ---------------------------------------------------------------------------------------------------------------
_local = threading.local()
_config = {'path': None, 'uri': False}


def _connect():
    if not _config['path']:
        raise RuntimeError('Database is not configured: call db.init_app(app) first.')
    conn = sqlite3.connect(_config['path'], uri=_config['uri'], timeout=BUSY_TIMEOUT_MS / 1000.0,
                           isolation_level=None)  # autocommit; transactions are explicit (BEGIN IMMEDIATE ... COMMIT)
    conn.row_factory = sqlite3.Row
    conn.execute(f'PRAGMA busy_timeout={BUSY_TIMEOUT_MS}')
    conn.execute(f'PRAGMA cache_size=-{CACHE_KB}')
    conn.execute('PRAGMA mmap_size=0')
    return conn


def _conn():
    c = getattr(_local, 'conn', None)
    if c is None:
        c = _local.conn = _connect()
    return c


def _isolated_conn():
    c = getattr(_local, 'iso', None)
    if c is None:
        c = _local.iso = _connect()
    return c


def _session():
    s = getattr(_local, 'session', None)
    if s is None:
        s = _local.session = Session()
    return s


class Session:
    """Unit of work for one thread: tracks new, changed and deleted objects and writes them on commit()."""

    def __init__(self):
        self._new = []
        self._dirty = {}
        self._deleted = []
        self._identity = weakref.WeakValueDictionary()
        self._in_txn = False

    # transaction helpers ------------------------------------------------------------------------------------------
    def _begin(self):
        if not self._in_txn:
            _conn().execute('BEGIN IMMEDIATE')
            self._in_txn = True

    def _mark_dirty(self, obj):
        self._dirty[id(obj)] = obj

    def _remember(self, obj):
        self._identity[(type(obj), obj.id)] = obj

    # public API -----------------------------------------------------------------------------------------------------
    def add(self, obj):
        if not obj.__dict__.get('_persisted') and obj not in self._new:
            self._new.append(obj)

    def add_all(self, objs):
        for o in objs:
            self.add(o)

    def delete(self, obj):
        if obj in self._new:
            self._new.remove(obj)
            return
        if obj not in self._deleted:
            self._deleted.append(obj)

    def get(self, model, pk):
        return model.query.get(pk)

    def flush(self):
        if not (self._new or self._dirty or self._deleted):
            return
        try:
            self._begin()
            conn = _conn()
            for obj in self._new:
                obj._insert(conn)
                self._remember(obj)
            self._new = []
            for obj in list(self._dirty.values()):
                if obj not in self._deleted:
                    obj._update(conn)
            self._dirty = {}
            for obj in self._deleted:
                obj._delete(conn)
            self._deleted = []
        except Exception:
            self.rollback()
            raise

    def commit(self):
        self.flush()
        if self._in_txn:
            _conn().execute('COMMIT')
            self._in_txn = False
        self._identity.clear()

    def rollback(self):
        if self._in_txn:
            try:
                _conn().execute('ROLLBACK')
            except sqlite3.Error:
                pass
            self._in_txn = False
        self._new, self._deleted, self._dirty = [], [], {}
        self._identity.clear()

    def remove(self):
        self.rollback()

    def execute(self, sql, params=()):
        """Run raw SQL inside this session's connection (inside the open transaction, if any)."""
        self.flush()
        return _conn().execute(sql, params)


class _ScopedSession:
    """`db.session`: forwards every call to the current thread's Session."""

    def __getattr__(self, name):
        return getattr(_session(), name)


# ---------------------------------------------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------------------------------------------
class Query:
    def __init__(self, model):
        self.model = model
        self._where = []
        self._params = []
        self._order = []
        self._limit = None
        self._offset = None

    def _clone(self):
        q = Query(self.model)
        q._where, q._params, q._order = list(self._where), list(self._params), list(self._order)
        q._limit, q._offset = self._limit, self._offset
        return q

    # builders --------------------------------------------------------------------------------------------------------
    def filter(self, *exprs):
        q = self._clone()
        for e in exprs:
            q._where.append(e.sql)
            q._params.extend(e.params)
        return q

    def filter_by(self, **kw):
        cols = self.model._by_name
        exprs = []
        for k, v in kw.items():
            if k not in cols:
                raise AttributeError(f'{self.model.__name__} has no column {k!r}')
            exprs.append(cols[k] == v)
        return self.filter(*exprs)

    def order_by(self, *items):
        q = self._clone()
        for it in items:
            q._order.append(it.sql if isinstance(it, Ordering) else f'{it.qname} ASC')
        return q

    def limit(self, n):
        q = self._clone()
        q._limit = int(n)
        return q

    def offset(self, n):
        q = self._clone()
        q._offset = int(n)
        return q

    # SQL assembly -----------------------------------------------------------------------------------------------------
    def _where_sql(self):
        return (' WHERE ' + ' AND '.join(self._where)) if self._where else ''

    def _select(self, what):
        sql = f'SELECT {what} FROM "{self.model.__tablename__}"{self._where_sql()}'
        if self._order:
            sql += ' ORDER BY ' + ', '.join(self._order)
        if self._limit is not None or self._offset:
            sql += f' LIMIT {self._limit if self._limit is not None else -1}'
            if self._offset:
                sql += f' OFFSET {self._offset}'
        return sql

    # execution ---------------------------------------------------------------------------------------------------------
    def all(self):
        sess = _session()
        rows = sess.execute(self._select('*'), self._params).fetchall()
        return [self.model._from_row(r, sess) for r in rows]

    def __iter__(self):
        return iter(self.all())

    def first(self):
        rows = self.limit(1).all()
        return rows[0] if rows else None

    def first_or_404(self):
        obj = self.first()
        if obj is None:
            raise NotFound()
        return obj

    def get(self, pk):
        if pk is None:
            return None
        try:
            pk = int(pk)
        except (TypeError, ValueError):
            return None
        sess = _session()
        hit = sess._identity.get((self.model, pk))
        if hit is not None:
            return hit
        return self.filter_by(**{self.model._pk_name: pk}).first()

    def get_or_404(self, pk):
        obj = self.get(pk)
        if obj is None:
            raise NotFound()
        return obj

    def count(self):
        sess = _session()
        sql = f'SELECT COUNT(*) FROM "{self.model.__tablename__}"{self._where_sql()}'
        return sess.execute(sql, self._params).fetchone()[0]

    def update(self, values, synchronize_session=None):
        sets, params = [], []
        for k, v in values.items():
            col = self.model._by_name[k.name if isinstance(k, Column) else k]
            sets.append(f'"{col.name}" = ?')
            params.append(col.type.to_db(v))
        sess = _session()
        sess.flush()
        sql = f'UPDATE "{self.model.__tablename__}" SET {", ".join(sets)}{self._where_sql()}'
        return self._write(sess, sql, params + self._params)

    def delete(self, synchronize_session=None):
        sess = _session()
        sess.flush()
        sql = f'DELETE FROM "{self.model.__tablename__}"{self._where_sql()}'
        return self._write(sess, sql, self._params)

    @staticmethod
    def _write(sess, sql, params):
        # Inside an open transaction the change is committed by session.commit(); otherwise it is applied at once.
        if sess._in_txn:
            return _conn().execute(sql, params).rowcount
        conn = _conn()
        conn.execute('BEGIN IMMEDIATE')
        try:
            n = conn.execute(sql, params).rowcount
            conn.execute('COMMIT')
        except Exception:
            conn.execute('ROLLBACK')
            raise
        sess._identity.clear()
        return n


class _QueryProperty:
    def __get__(self, obj, owner):
        return Query(owner)


# ---------------------------------------------------------------------------------------------------------------
# Model base class
# ---------------------------------------------------------------------------------------------------------------
class Model:
    query = _QueryProperty()
    __tablename__ = None

    def __init_subclass__(cls, **kw):
        super().__init_subclass__(**kw)
        cols = []
        for klass in reversed(cls.__mro__):
            for name, val in vars(klass).items():
                if isinstance(val, Column) and not any(val is c for c in cols):
                    cols.append(val)
        cls._columns = cols
        cls._by_name = {c.name: c for c in cols}
        cls._children = []
        for c in cols:
            c.table = cls.__tablename__
        cls._pk_name = next(c for c in cols if c.primary_key).name
        _REGISTRY[cls.__name__] = cls
        for val in vars(cls).values():
            if isinstance(val, Relationship):
                _PENDING_RELS.append(val)
        _link_relationships()

    def __init__(self, **kw):
        self.__dict__['_d'] = {}
        self.__dict__['_persisted'] = False
        for k, v in kw.items():
            if k not in self._by_name and not hasattr(type(self), k):
                raise TypeError(f'{type(self).__name__} has no field {k!r}')
            setattr(self, k, v)

    @classmethod
    def _from_row(cls, row, sess):
        pk = row[cls._pk_name]
        hit = sess._identity.get((cls, pk))
        if hit is not None:
            return hit
        obj = cls.__new__(cls)
        obj.__dict__['_d'] = {c.name: c.type.from_db(row[c.name]) for c in cls._columns}
        obj.__dict__['_persisted'] = True
        sess._identity[(cls, pk)] = obj
        return obj

    # write operations (called by Session.flush) --------------------------------------------------------------------
    def _insert(self, conn):
        d = self.__dict__['_d']
        for c in self._columns:
            if d.get(c.name) is None and c.default is not None:
                d[c.name] = c.default() if callable(c.default) else c.default
        self._normalize(d)
        names = [c.name for c in self._columns if not (c.primary_key and d.get(c.name) is None)]
        sql = (f'INSERT INTO "{self.__tablename__}" ({", ".join(chr(34) + n + chr(34) for n in names)}) '
               f'VALUES ({", ".join("?" * len(names))})')
        cur = conn.execute(sql, [self._by_name[n].type.to_db(d.get(n)) for n in names])
        if d.get(self._pk_name) is None:
            d[self._pk_name] = cur.lastrowid
        self.__dict__['_persisted'] = True

    @classmethod
    def _normalize(cls, d):
        """Store datetimes the way they come back from the database (naive UTC) so values never change type after a save."""
        for c in cls._columns:
            if isinstance(c.type, DateTime) and d.get(c.name) is not None:
                d[c.name] = c.type.from_db(c.type.to_db(d[c.name]))

    def _update(self, conn):
        d = self.__dict__['_d']
        for c in self._columns:
            if c.onupdate is not None:
                d[c.name] = c.onupdate() if callable(c.onupdate) else c.onupdate
        self._normalize(d)
        cols = [c for c in self._columns if not c.primary_key]
        sql = (f'UPDATE "{self.__tablename__}" SET {", ".join(chr(34) + c.name + chr(34) + " = ?" for c in cols)} '
               f'WHERE "{self._pk_name}" = ?')
        conn.execute(sql, [c.type.to_db(d.get(c.name)) for c in cols] + [d[self._pk_name]])

    def _delete(self, conn):
        pk = self.__dict__['_d'][self._pk_name]
        for lst in self._children:
            if lst.cascade:
                conn.execute(f'DELETE FROM "{lst.child_cls.__tablename__}" WHERE "{lst.fk_name}" = ?', (pk,))
            else:
                conn.execute(f'UPDATE "{lst.child_cls.__tablename__}" SET "{lst.fk_name}" = NULL '
                             f'WHERE "{lst.fk_name}" = ?', (pk,))
        conn.execute(f'DELETE FROM "{self.__tablename__}" WHERE "{self._pk_name}" = ?', (pk,))
        self.__dict__['_persisted'] = False

    def __repr__(self):
        return f'<{type(self).__name__} {self.__dict__["_d"].get(self._pk_name)}>'


# ---------------------------------------------------------------------------------------------------------------
# The `db` object (same name and shape the application already imports)
# ---------------------------------------------------------------------------------------------------------------
def _db_path(uri, instance_path):
    if not uri.startswith('sqlite:///'):
        raise ValueError('ShellMan stores data in SQLite only: DATABASE_URL must start with sqlite:///')
    path = uri[len('sqlite:///'):]
    if path in ('', ':memory:'):
        return 'file:shellman_mem?mode=memory&cache=shared', True
    if not os.path.isabs(path):
        path = os.path.join(instance_path, path)
    return path, False


class Database:
    Model = Model
    Column = Column
    Integer, Float, String, Text, Boolean, DateTime = Integer, Float, String, Text, Boolean, DateTime
    ForeignKey = ForeignKey
    relationship = staticmethod(lambda target, backref=None: Relationship(target, backref))
    backref = staticmethod(backref)
    or_ = staticmethod(or_)
    and_ = staticmethod(and_)

    def __init__(self):
        self.session = _ScopedSession()

    # setup -------------------------------------------------------------------------------------------------------------
    def init_app(self, app):
        _config['path'], _config['uri'] = _db_path(app.config['DATABASE_URI'], app.instance_path)
        if not _config['uri']:
            os.makedirs(os.path.dirname(os.path.abspath(_config['path'])), exist_ok=True)
        app.teardown_appcontext(lambda exc=None: _session().remove())

    def create_all(self):
        """CREATE TABLE / INDEX IF NOT EXISTS for every model (existing tables are left alone)."""
        conn = _conn()
        for cls in list(_REGISTRY.values()):
            lines, fks = [], []
            for c in cls._columns:
                part = f'"{c.name}" {c.type.ddl}'
                if c.primary_key:
                    part += ' NOT NULL PRIMARY KEY'
                else:
                    if not c.nullable:
                        part += ' NOT NULL'
                    if c.server_default is not None:
                        part += f" DEFAULT {c.server_default!r}" if isinstance(c.server_default, str) else f' DEFAULT {c.server_default}'
                    if c.unique and not c.index:
                        part += ' UNIQUE'
                lines.append(part)
                if c.fk:
                    on = f' ON DELETE {c.fk.ondelete}' if c.fk.ondelete else ''
                    fks.append(f'FOREIGN KEY("{c.name}") REFERENCES "{c.fk.table}" ("{c.fk.column}"){on}')
            conn.execute(f'CREATE TABLE IF NOT EXISTS "{cls.__tablename__}" ({", ".join(lines + fks)})')
            for c in cls._columns:
                if c.index:
                    conn.execute(f'CREATE {"UNIQUE " if c.unique else ""}INDEX IF NOT EXISTS '
                                 f'"ix_{cls.__tablename__}_{c.name}" ON "{cls.__tablename__}" ("{c.name}")')

    # raw SQL helpers ---------------------------------------------------------------------------------------------------
    def execute(self, sql, params=()):
        """Run SQL on this thread's connection (inside the current transaction when one is open)."""
        return _session().execute(sql, params)

    def rows(self, sql, params=()):
        return self.execute(sql, params).fetchall()

    def scalar(self, sql, params=()):
        row = self.execute(sql, params).fetchone()
        return row[0] if row else None

    def isolated(self, sql, params=()):
        """Run one statement on a separate autocommit connection: never joins or commits the caller's transaction."""
        cur = _isolated_conn().execute(sql, params)
        return cur

    def columns_of(self, table):
        """Column names of an existing table (used by the start-up migrations)."""
        if not _IDENT.match(table):
            raise ValueError('bad table name')
        return [r['name'] for r in self.rows(f'PRAGMA table_info("{table}")')]

    def add_column_if_missing(self, table, column, ddl):
        if column not in self.columns_of(table):
            self.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {ddl}')
            return True
        return False
