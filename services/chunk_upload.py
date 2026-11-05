"""Parallel chunked upload: the browser sends big files in parts over several requests at once,
and each part is written at its own offset of the remote file over its own SSH connection.

Flow: init (creates the empty remote file) -> chunk x N (any order, in parallel) -> finish (verifies) or abort.
"""
import logging
import math
import os
import posixpath
import queue
import threading
import time
import uuid

import paramiko

from services.sftp import SFTPService
from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.chunk_upload')

WINDOW = 32 * 1024 * 1024
IDLE_SECONDS = 6 * 3600
_sessions = {}
_lock = threading.Lock()


class UploadError(Exception):
    pass


def _max_conns(server) -> int:
    try:
        n = int(os.environ.get('SHELLMAN_UPLOAD_CONNECTIONS', '16'))
    except ValueError:
        n = 16
    n = max(1, min(16, n))
    if (getattr(server, 'kind', None) or 'ssh') == 'codespace':
        n = min(n, 3)
    return n


class _Conn:
    """One SSH connection with an SFTP channel and the target file kept open."""

    def __init__(self, server, path):
        self.client = ssh_manager._create_client(server)
        sftp = paramiko.SFTPClient.from_transport(self.client.get_transport(), window_size=WINDOW, max_packet_size=32768)
        self.sftp = sftp if sftp is not None else self.client.open_sftp()
        self.fh = self.sftp.open(path, 'r+b')

    def close(self):
        for obj in (self.fh, self.sftp, self.client):
            try:
                obj.close()
            except Exception:
                pass


class _Own:
    """A private connection for init/finish/abort, so they never wait for the shared per-server SSH lock."""

    def __enter__(self):
        return self

    def __init__(self, server):
        self.client = ssh_manager._create_client(server)
        sftp = paramiko.SFTPClient.from_transport(self.client.get_transport(), window_size=WINDOW, max_packet_size=32768)
        self.sftp = sftp if sftp is not None else self.client.open_sftp()

    def mkdir_p(self, path):
        if not path or path == '/':
            return
        try:
            self.sftp.stat(path)
            return
        except IOError:
            pass
        import shlex
        _, out, _ = self.client.exec_command(f"mkdir -p -- {shlex.quote(path)}")
        out.channel.recv_exit_status()

    def __exit__(self, *a):
        for obj in (self.sftp, self.client):
            try:
                obj.close()
            except Exception:
                pass


class _Session:
    def __init__(self, server, path, size, chunk_size, overwrite):
        self.server, self.path, self.size = server, path, size
        self.chunk_size = chunk_size
        self.count = int(math.ceil(size / float(chunk_size))) if size else 0
        self.got = set()
        self.idle = queue.LifoQueue()
        self.made = 0
        self.max = _max_conns(server)
        self.lock = threading.Lock()
        self.touched = time.time()
        self.closed = False

    def take(self):
        while True:
            try:
                return self.idle.get_nowait()
            except queue.Empty:
                pass
            with self.lock:
                if self.made < self.max:
                    self.made += 1
                    make = True
                else:
                    make = False
            if make:
                try:
                    return _Conn(self.server, self.path)
                except Exception:
                    with self.lock:
                        self.made -= 1
                    raise
            try:
                return self.idle.get(timeout=1)
            except queue.Empty:
                if self.closed:
                    raise UploadError('Upload was closed')

    def give(self, conn):
        self.idle.put(conn)

    def close_all(self):
        self.closed = True
        while True:
            try:
                self.idle.get_nowait().close()
            except queue.Empty:
                break


def _gc():
    now = time.time()
    with _lock:
        dead = [k for k, s in _sessions.items() if now - s.touched > IDLE_SECONDS]
        for k in dead:
            s = _sessions.pop(k)
            s.close_all()


def _clean_rel(rel: str) -> str:
    parts = [p for p in (rel or '').replace('\\', '/').split('/') if p not in ('', '.')]
    if not parts or any(p == '..' for p in parts):
        raise UploadError('Invalid file name')
    return '/'.join(parts)


def init(server, dest_dir, rel_path, size, chunk_size, overwrite=True):
    _gc()
    size = int(size)
    chunk_size = int(chunk_size)
    if size < 0 or chunk_size < 64 * 1024 or chunk_size > 64 * 1024 * 1024:
        raise UploadError('Invalid size')
    dest_dir = SFTPService._normalize_path(dest_dir, server)
    target = posixpath.join(dest_dir, _clean_rel(rel_path))
    with _Own(server) as o:
        o.mkdir_p(posixpath.dirname(target))
        if not overwrite:
            try:
                o.sftp.stat(target)
                raise UploadError(f"File '{posixpath.basename(target)}' already exists on remote server")
            except IOError:
                pass
        with o.sftp.open(target, 'wb'):
            pass
    uid = uuid.uuid4().hex
    sess = _Session(server, target, size, chunk_size, overwrite)
    with _lock:
        _sessions[uid] = sess
    return uid, sess.count


def _get(uid):
    with _lock:
        s = _sessions.get(uid)
    if not s:
        raise UploadError('Unknown or expired upload')
    s.touched = time.time()
    return s


def write_chunk(uid, index, data: bytes):
    from services.s2s import Transfer
    s = _get(uid)
    index = int(index)
    if index < 0 or index >= s.count:
        raise UploadError('Chunk out of range')
    offset = index * s.chunk_size
    expect = min(s.chunk_size, s.size - offset)
    if len(data) != expect:
        raise UploadError(f'Chunk {index} has {len(data)} bytes, expected {expect}')
    conn = s.take()
    ok = False
    try:
        Transfer._write_at(conn.sftp, conn.fh, offset, data)
        ok = True
    finally:
        if ok:
            s.give(conn)
        else:
            conn.close()
            with s.lock:
                s.made -= 1
    with s.lock:
        s.got.add(index)


def finish(uid):
    s = _get(uid)
    missing = s.count - len(s.got)
    if missing:
        raise UploadError(f'{missing} part(s) missing')
    s.close_all()                       # closes files, flushing everything
    with _Own(s.server) as o:
        got = o.sftp.stat(s.path).st_size
    if got != s.size:
        raise UploadError(f'Size mismatch: expected {s.size}, got {got}')
    with _lock:
        _sessions.pop(uid, None)
    return s.path, s.size


def abort(uid):
    with _lock:
        s = _sessions.pop(uid, None)
    if not s:
        return
    s.close_all()
    try:
        with _Own(s.server) as o:
            o.sftp.remove(s.path)
    except Exception:
        pass
