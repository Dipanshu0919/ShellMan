"""Multi-connection file download (like aria2c -x N), for the browser download route.

One SSH connection is limited by its own TCP window, cipher speed and per-connection throttling. This opens several
dedicated SSH connections, fetches different parts of the file at the same time (each part is read with SFTP
pipelining), and hands the parts to the browser in order. Memory use is bounded: workers never run more than
`LOOKAHEAD` parts ahead of the browser.

ShellMan itself sets no speed limit. Set SHELLMAN_DL_CONNECTIONS (1-16, default 16) to change the number of connections.
"""
import logging
import os
import threading
import time

import paramiko

from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.fastdl')

SEGMENT = 4 * 1024 * 1024            # size of one part
MIN_FAST = 8 * 1024 * 1024           # smaller files are not worth extra connections
WINDOW = 32 * 1024 * 1024            # SFTP channel window: lets the server keep sending without waiting for acks


def max_connections(server) -> int:
    try:
        n = int(os.environ.get('SHELLMAN_DL_CONNECTIONS', '16'))
    except ValueError:
        n = 16
    n = max(1, min(16, n))
    if (getattr(server, 'kind', None) or 'ssh') == 'codespace':
        n = min(n, 3)                 # every Codespace connection starts a `gh` process
    return n


def _open_dedicated(server):
    """A brand new SSH connection + SFTP channel with a large window. Caller closes both."""
    client = ssh_manager._create_client(server)
    try:
        sftp = paramiko.SFTPClient.from_transport(client.get_transport(), window_size=WINDOW, max_packet_size=32768)
        if sftp is None:
            sftp = client.open_sftp()
        return client, sftp
    except Exception:
        client.close()
        raise


def _read_part(f, offset, length):
    f.seek(offset)
    f.prefetch(offset + length)       # pipeline many read requests instead of one round trip per 32 KB
    buf = bytearray()
    while len(buf) < length:
        chunk = f.read(length - len(buf))
        if not chunk:
            raise IOError(f'Remote file ended early at byte {offset + len(buf)}')
        buf += chunk
    return bytes(buf)


def stream(server, path, start, length, connections=None, opener=None):
    """Yield bytes [start, start+length) of a remote file using several connections at once.

    `opener` (tests) returns (client, sftp) like _open_dedicated."""
    opener = opener or _open_dedicated
    parts = []
    off = start
    end = start + length
    while off < end:
        n = min(SEGMENT, end - off)
        parts.append((off, n))
        off += n
    workers = max(1, min(connections or max_connections(server), len(parts)))
    lookahead = workers * 2

    cond = threading.Condition()
    state = {'next_fetch': 0, 'next_yield': 0, 'error': None, 'stop': False}
    results = {}

    def connect(k):
        # sshd limits half-open logins (MaxStartups 10:30:100): stagger the start and retry so 16 connections don't trip it
        time.sleep(0.07 * k)
        for attempt in range(4):
            try:
                return opener(server)
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(0.4 * (attempt + 1))

    def worker(k=0):
        client = sftp = f = None
        try:
            client, sftp = connect(k)
            f = sftp.open(path, 'rb')
            while True:
                with cond:
                    while (not state['stop'] and state['next_fetch'] < len(parts)
                           and state['next_fetch'] - state['next_yield'] >= lookahead):
                        cond.wait(0.5)
                    if state['stop'] or state['next_fetch'] >= len(parts):
                        return
                    i = state['next_fetch']
                    state['next_fetch'] += 1
                po, pl = parts[i]
                try:
                    data = _read_part(f, po, pl)
                except Exception:
                    # one retry on a fresh connection (a dropped connection must not fail a multi-GB download)
                    try:
                        f.close(); sftp.close(); client.close()
                    except Exception:
                        pass
                    client, sftp = opener(server)
                    f = sftp.open(path, 'rb')
                    data = _read_part(f, po, pl)
                with cond:
                    results[i] = data
                    cond.notify_all()
        except Exception as e:
            logger.warning('fast download worker failed: %s', e)
            with cond:
                if state['error'] is None:
                    state['error'] = e
                cond.notify_all()
        finally:
            for c in (f, sftp, client):
                try:
                    if c is not None:
                        c.close()
                except Exception:
                    pass

    threads = [threading.Thread(target=worker, args=(k,), daemon=True, name=f'fastdl-{k}') for k in range(workers)]
    for t in threads:
        t.start()
    try:
        for i in range(len(parts)):
            with cond:
                while i not in results and state['error'] is None:
                    cond.wait(1.0)
                if i not in results:
                    raise state['error']
                data = results.pop(i)
                state['next_yield'] = i + 1
                cond.notify_all()
            yield data
    finally:
        with cond:
            state['stop'] = True
            results.clear()
            cond.notify_all()
        for t in threads:
            t.join(timeout=5)
