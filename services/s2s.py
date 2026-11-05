"""Server to server transfer of files and folders, as fast as the ShellMan host allows.

The data is relayed through ShellMan (so it works for any two servers, including Codespaces and Tailscale hosts,
and neither server needs credentials for the other). To keep it fast:

* Small files travel inside tar streams (`tar -c` on the source piped into `tar -x` on the destination), many files
  per stream, several streams at once. No per-file round trips.
* Big files are cut into parts. Several workers, each with its own SSH connection to both servers, read parts from
  the source (pipelined SFTP) and write them at the right offset of the destination file at the same time.

Progress is reported through ProgressTracker, so the file manager shows it like any other task.
"""
import logging
import math
import os
import posixpath
import queue
import shlex
import threading
import time

import paramiko

from services.progress_tracker import ProgressTracker
from services.sftp import SFTPService
from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.s2s')

SEGMENT = 4 * 1024 * 1024               # one part of a big file
BIG_FILE = 16 * 1024 * 1024             # files at least this big are split into parts
TAR_BATCH_BYTES = 128 * 1024 * 1024     # one tar stream carries about this much ...
TAR_BATCH_FILES = 20000                 # ... or this many files
WINDOW = 32 * 1024 * 1024
IO_CHUNK = 256 * 1024


class TransferError(Exception):
    pass


class Cancelled(Exception):
    pass


def max_workers(*servers) -> int:
    try:
        n = int(os.environ.get('SHELLMAN_XFER_CONNECTIONS', '16'))
    except ValueError:
        n = 16
    n = max(1, min(16, n))
    if any((getattr(s, 'kind', None) or 'ssh') == 'codespace' for s in servers):
        n = min(n, 3)
    return n


def _est_tar_bytes(size):
    """Bytes a file takes inside a tar stream: 512 byte header plus data padded to 512."""
    return 512 + int(math.ceil(size / 512.0)) * 512


def _run(client, cmd, stdin=None, limit=1 << 30):
    """Run a command, return (exit_code, stdout_bytes, stderr_text). Output is not truncated up to `limit`."""
    chan = client.get_transport().open_session()
    chan.exec_command(cmd)
    if stdin is not None:
        chan.sendall(stdin)
    chan.shutdown_write()
    out = bytearray()
    err = bytearray()
    while True:
        got = False
        if chan.recv_ready():
            d = chan.recv(65536)
            if d:
                out += d
                got = True
        if chan.recv_stderr_ready():
            d = chan.recv_stderr(65536)
            if d:
                err += d[:4096]
                got = True
        if len(out) > limit:
            chan.close()
            raise TransferError('Directory listing is too large.')
        if not got:
            if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
                break
            time.sleep(0.01)
    return chan.recv_exit_status(), bytes(out), err.decode('utf-8', 'replace')


class _Pipe:
    """Collects stderr of a channel in the background, so a full stderr buffer can never stall the stream."""

    def __init__(self, chan):
        self.chan = chan
        self.buf = bytearray()
        self.t = threading.Thread(target=self._pump, daemon=True)
        self.t.start()

    def _pump(self):
        try:
            while True:
                d = self.chan.recv_stderr(4096)
                if not d:
                    break
                if len(self.buf) < 8192:
                    self.buf += d
        except Exception:
            pass

    def text(self):
        self.t.join(timeout=2)
        return self.buf.decode('utf-8', 'replace').strip()


def _close_handles(handles):
    """Close open files first (flushes pipelined writes), then the SFTP channels."""
    for key in [k for k in handles if k not in ('s', 'd')]:
        for x in handles.pop(key):
            try:
                x.close()
            except Exception:
                pass
    for key in ('s', 'd'):
        x = handles.pop(key, None)
        if x is not None:
            try:
                x.close()
            except Exception:
                pass


class _Job:
    __slots__ = ('kind', 'file', 'offset', 'length', 'names', 'parent', 'est')

    def __init__(self, kind, **kw):
        self.kind = kind
        for k in self.__slots__[1:]:
            setattr(self, k, kw.get(k))


class Transfer:
    def __init__(self, src, dst, paths, dest_dir, task_id, overwrite=True):
        self.src, self.dst = src, dst
        self.paths = paths
        self.dest_dir = SFTPService._normalize_path(dest_dir, dst)
        self.task_id = task_id
        self.overwrite = overwrite
        self.lock = threading.Lock()
        self.done = 0
        self.total = 0
        self.error = None
        self.stop = False
        self.files = 0
        self.big = {}            # idx -> dict(rel, size, mode, mtime, left, path)
        self.t0 = time.time()
        self._last_report = 0.0
        self._skip_flag = None

    # ------------------------------------------------------------------ helpers
    def _cancelled(self):
        return self.stop or ProgressTracker.is_cancelled(self.task_id)

    def _check(self):
        if self._cancelled():
            raise Cancelled()

    def _add(self, n):
        with self.lock:
            self.done += n
            now = time.time()
            if now - self._last_report > 0.15:
                self._last_report = now
                ProgressTracker.update(self.task_id, min(self.done, self.total), self.total)

    def _fail(self, e):
        with self.lock:
            if self.error is None and not isinstance(e, Cancelled):
                self.error = e
            self.stop = True

    def _connect(self, server, k=0):
        # stagger and retry: sshd refuses a burst of simultaneous logins (MaxStartups)
        time.sleep(0.07 * k)
        for attempt in range(4):
            try:
                return ssh_manager._create_client(server)
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(0.4 * (attempt + 1))

    @staticmethod
    def _sftp(client):
        s = paramiko.SFTPClient.from_transport(client.get_transport(), window_size=WINDOW, max_packet_size=32768)
        return s if s is not None else client.open_sftp()

    # ------------------------------------------------------------------ planning
    def _scan(self, client):
        """Return list of entries (rel, kind, size, mode, mtime) for every source path. rel starts with the item name."""
        entries = []
        sftp = self._sftp(client)
        try:
            for p in self.paths:
                p = SFTPService._normalize_path(p, self.src).rstrip('/') or '/'
                try:
                    st = sftp.lstat(p)
                except IOError:
                    raise TransferError(f'Source not found: {p}')
                parent, base = posixpath.split(p)
                parent = parent or '/'
                import stat as _st
                if not _st.S_ISDIR(st.st_mode):
                    kind = 'l' if _st.S_ISLNK(st.st_mode) else 'f'
                    entries.append((base, parent, kind, st.st_size, st.st_mode & 0o7777, st.st_mtime))
                    continue
                code, out, err = _run(
                    client,
                    f"cd {shlex.quote(parent)} && find {shlex.quote(base)} "
                    f"\\( -type d -o -type f -o -type l \\) -printf '%y\\t%s\\t%m\\t%T@\\t%p\\0'")
                if code != 0 and not out:
                    entries.extend(self._scan_sftp(sftp, p, parent, base))     # no GNU find on the source
                    continue
                for rec in out.split(b'\0'):
                    if not rec:
                        continue
                    y, s, m, t, rel = rec.decode('utf-8', 'surrogateescape').split('\t', 4)
                    entries.append((rel, parent, y, int(s), int(m, 8), float(t)))
        finally:
            try:
                sftp.close()
            except Exception:
                pass
        return entries

    def _scan_sftp(self, sftp, p, parent, base):
        import stat as _st
        out = [(base, parent, 'd', 0, 0o755, 0.0)]

        def walk(abs_dir, rel_dir):
            for a in sftp.listdir_attr(abs_dir):
                rel = rel_dir + '/' + a.filename
                if _st.S_ISDIR(a.st_mode):
                    out.append((rel, parent, 'd', 0, a.st_mode & 0o7777, a.st_mtime or 0.0))
                    walk(abs_dir + '/' + a.filename, rel)
                elif _st.S_ISLNK(a.st_mode):
                    out.append((rel, parent, 'l', a.st_size, a.st_mode & 0o7777, a.st_mtime or 0.0))
                elif _st.S_ISREG(a.st_mode):
                    out.append((rel, parent, 'f', a.st_size, a.st_mode & 0o7777, a.st_mtime or 0.0))
        walk(p, base)
        return out

    def _plan(self, src_client, dst_client):
        entries = self._scan(src_client)
        dirs = {self.dest_dir}
        small = {}                 # parent -> list of (rel, size)
        jobs = []
        total = 0
        for rel, parent, kind, size, mode, mtime in entries:
            self.files += 1 if kind != 'd' else 0
            if kind == 'd':
                dirs.add(posixpath.join(self.dest_dir, rel))
                continue
            dirs.add(posixpath.dirname(posixpath.join(self.dest_dir, rel)))
            if kind == 'f' and size >= BIG_FILE:
                idx = len(self.big)
                parts = int(math.ceil(size / float(SEGMENT)))
                self.big[idx] = {'rel': rel, 'parent': parent, 'size': size, 'mode': mode, 'mtime': mtime,
                                 'left': parts, 'path': posixpath.join(self.dest_dir, rel), 'skip': False}
                total += size
                for k in range(parts):
                    off = k * SEGMENT
                    jobs.append(_Job('seg', file=idx, offset=off, length=min(SEGMENT, size - off)))
            else:
                small.setdefault(parent, []).append((rel, size if kind == 'f' else 0))
        # create all destination folders in one command
        listing = b'\0'.join(d.encode('utf-8', 'surrogateescape') for d in sorted(dirs)) + b'\0'
        code, _, err = _run(dst_client, 'xargs -0 mkdir -p --', stdin=listing)
        if code != 0:
            raise TransferError(f'Cannot create destination folders: {err.strip()[:200] or "mkdir failed"}')
        # small files: tar batches
        for parent, items in small.items():
            batch, bytes_, est = [], 0, 0
            for rel, size in items:
                batch.append(rel)
                bytes_ += size
                est += _est_tar_bytes(size)
                if bytes_ >= TAR_BATCH_BYTES or len(batch) >= TAR_BATCH_FILES:
                    jobs.append(_Job('tar', names=batch, parent=parent, est=est))
                    total += est
                    batch, bytes_, est = [], 0, 0
            if batch:
                jobs.append(_Job('tar', names=batch, parent=parent, est=est))
                total += est
        # overwrite=False: decide per big file now (cheap stat)
        if not self.overwrite and self.big:
            sftp = self._sftp(dst_client)
            try:
                for idx, b in self.big.items():
                    try:
                        sftp.stat(b['path'])
                        b['skip'] = True
                    except IOError:
                        pass
            finally:
                sftp.close()
            skipped = {i for i, b in self.big.items() if b['skip']}
            total -= sum(self.big[i]['size'] for i in skipped)
            jobs = [j for j in jobs if not (j.kind == 'seg' and j.file in skipped)]
        # create (truncate) destination big files so workers can write parts at any offset
        if self.big:
            sftp = self._sftp(dst_client)
            try:
                for b in self.big.values():
                    if not b['skip']:
                        with sftp.open(b['path'], 'wb'):
                            pass
            finally:
                sftp.close()
        # biggest work first keeps all workers busy to the end
        jobs.sort(key=lambda j: -(j.length if j.kind == 'seg' else j.est))
        self.total = max(total, 0)
        ProgressTracker.update(self.task_id, 0, self.total)
        return jobs

    # ------------------------------------------------------------------ workers
    def _tar_flags(self, dst_client):
        if self.overwrite:
            return ''
        if self._skip_flag is None:
            code, out, _ = _run(dst_client, 'tar --help 2>&1 | grep -c -- --skip-old-files')
            self._skip_flag = '--skip-old-files' if out.strip() not in (b'', b'0') else '-k'
        return self._skip_flag

    def _do_tar(self, job, src_client, dst_client):
        src = src_client.get_transport().open_session()
        dst = dst_client.get_transport().open_session()
        src.exec_command(f"tar -C {shlex.quote(job.parent)} --no-recursion --null -T - -cf -")
        flags = self._tar_flags(dst_client)
        dst.exec_command(f"tar -C {shlex.quote(self.dest_dir)} -xpf - --no-same-owner {flags}")
        s_err, d_err = _Pipe(src), _Pipe(dst)
        try:
            src.sendall(b'\0'.join(n.encode('utf-8', 'surrogateescape') for n in job.names) + b'\0')
            src.shutdown_write()
            moved = 0
            while True:
                self._check()
                data = src.recv(IO_CHUNK)
                if not data:
                    break
                dst.sendall(data)
                moved += len(data)
                self._add(len(data))
            dst.shutdown_write()
            sc, dc = src.recv_exit_status(), dst.recv_exit_status()
        finally:
            for c in (src, dst):
                try:
                    c.close()
                except Exception:
                    pass
        if sc != 0:
            raise TransferError(f'Reading from the source failed: {s_err.text()[:200] or "tar exit " + str(sc)}')
        if dc not in (0,) and not (dc == 2 and not self.overwrite):
            raise TransferError(f'Writing to the destination failed: {d_err.text()[:200] or "tar exit " + str(dc)}')
        if moved < job.est:
            self._add(job.est - moved)          # tar padded less than the estimate: keep the bar honest

    @staticmethod
    def _write_at(sftp, f, offset, buf):
        """Send the whole part as back-to-back SFTP write requests, then collect every status reply."""
        from paramiko.sftp import CMD_WRITE, CMD_STATUS
        from paramiko.sftp_client import SFTPError
        from paramiko.sftp import int64
        step = f.MAX_REQUEST_SIZE
        mv = memoryview(buf)
        reqs = []
        for pos in range(0, len(buf), step):
            reqs.append(sftp._async_request(type(None), CMD_WRITE, f.handle, int64(offset + pos), bytes(mv[pos:pos + step])))
        for r in reqs:
            t, _msg = sftp._read_response(r)
            if t != CMD_STATUS:
                raise SFTPError('Expected status')

    def _do_seg(self, job, handles, sclient, dclient):
        b = self.big[job.file]
        if b['skip']:
            return
        if job.file not in handles:
            files = [k for k in handles if k not in ('s', 'd')]
            while len(files) >= 2:               # keep few files open per worker
                for h in handles.pop(files.pop(0)):
                    try:
                        h.close()
                    except Exception:
                        pass
            if 's' not in handles:
                handles['s'] = self._sftp(sclient)
                handles['d'] = self._sftp(dclient)
            sf = handles['s'].open(posixpath.join(b['parent'], b['rel']), 'rb')
            df = handles['d'].open(b['path'], 'r+b')
            df.set_pipelined(False)  # we pipeline by hand, see _write_at
            handles[job.file] = (sf, df)
        sf, df = handles[job.file]
        sf.seek(job.offset)
        sf.prefetch(job.offset + job.length)
        buf = bytearray()
        while len(buf) < job.length:
            self._check()
            chunk = sf.read(job.length - len(buf))
            if not chunk:
                raise TransferError(f'Source file ended early: {b["rel"]}')
            buf += chunk
        self._write_at(handles['d'], df, job.offset, buf)
        self._add(job.length)
        with self.lock:
            b['left'] -= 1
            finished = b['left'] == 0
        if finished:
            try:
                handles['d'].chmod(b['path'], b['mode'])
                handles['d'].utime(b['path'], (b['mtime'], b['mtime']))
            except Exception:
                pass

    def _worker(self, q, k):
        sclient = dclient = None
        handles = {}
        try:
            while not self._cancelled():
                try:
                    job = q.get_nowait()
                except queue.Empty:
                    return
                if sclient is None:
                    sclient = self._connect(self.src, k)
                    dclient = self._connect(self.dst, k)
                try:
                    if job.kind == 'tar':
                        self._do_tar(job, sclient, dclient)
                    else:
                        self._do_seg(job, handles, sclient, dclient)
                except (Cancelled, TransferError):
                    raise
                except Exception:
                    # a dropped connection must not fail a multi-GB transfer: reconnect once and redo the job
                    _close_handles(handles)
                    for c in (sclient, dclient):
                        try:
                            c.close()
                        except Exception:
                            pass
                    sclient = self._connect(self.src, k)
                    dclient = self._connect(self.dst, k)
                    if job.kind == 'tar':
                        self._do_tar(job, sclient, dclient)
                    else:
                        self._do_seg(job, handles, sclient, dclient)
        except BaseException as e:
            self._fail(e)
        finally:
            _close_handles(handles)
            for c in (sclient, dclient):
                try:
                    if c is not None:
                        c.close()
                except Exception:
                    pass

    # ------------------------------------------------------------------ run
    def run(self):
        src_client = dst_client = None
        try:
            src_client = self._connect(self.src)
            dst_client = self._connect(self.dst)
            jobs = self._plan(src_client, dst_client)
            q = queue.Queue()
            for j in jobs:
                q.put(j)
            n = max(1, min(max_workers(self.src, self.dst), len(jobs)))
            threads = [threading.Thread(target=self._worker, args=(q, k), daemon=True, name=f's2s-{k}') for k in range(n)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            if self._cancelled() and self.error is None:
                raise Cancelled()
            if self.error is not None:
                raise self.error
            self._verify(dst_client)
            secs = max(time.time() - self.t0, 0.001)
            ProgressTracker.update(self.task_id, self.total, self.total)
            logger.info('transfer %s -> %s: %d files, %d bytes in %.1fs', self.src.name, self.dst.name, self.files, self.done, secs)
            ProgressTracker.complete(self.task_id)
            return {'files': self.files, 'bytes': self.done, 'seconds': secs}
        except Cancelled:
            self._cleanup_partial(dst_client)
            ProgressTracker.request_cancel(self.task_id)
        except Exception as e:
            self._cleanup_partial(dst_client)
            logger.warning('transfer failed: %s', e)
            ProgressTracker.complete(self.task_id, error=str(e)[:300])
        finally:
            for c in (src_client, dst_client):
                try:
                    if c is not None:
                        c.close()
                except Exception:
                    pass

    def _verify(self, dst_client):
        if not self.big:
            return
        sftp = self._sftp(dst_client)
        try:
            for b in self.big.values():
                if b['skip']:
                    continue
                got = sftp.stat(b['path']).st_size
                if got != b['size']:
                    raise TransferError(f'Size mismatch for {b["rel"]}: expected {b["size"]}, got {got}')
        finally:
            sftp.close()

    def _cleanup_partial(self, dst_client):
        """Remove big files that were created but not finished, so a half file is never mistaken for a good one."""
        try:
            if dst_client is None:
                return
            sftp = self._sftp(dst_client)
            try:
                for b in self.big.values():
                    if not b['skip'] and b['left'] > 0:
                        try:
                            sftp.remove(b['path'])
                        except Exception:
                            pass
            finally:
                sftp.close()
        except Exception:
            pass


def start(src, dst, paths, dest_dir, task_id, overwrite=True):
    """Begin a transfer in the background; progress goes to ProgressTracker under `task_id`."""
    xfer = Transfer(src, dst, paths, dest_dir, task_id, overwrite)
    ProgressTracker.create_task(task_id, f'{src.name} -> {dst.name}', 0)
    threading.Thread(target=xfer.run, daemon=True, name='s2s-main').start()
    return xfer
