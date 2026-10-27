import os
import shlex
import io
import time
import socket
import threading
import logging
import paramiko
from contextlib import contextmanager
from typing import Optional, Dict, Tuple

logger = logging.getLogger('shellman.ssh')

class SSHConnectionManager:
    """
    Thread-safe connection manager for persistent & on-demand SSH clients.
    Avoids reconnect overhead while enforcing timeouts and clean pool lifecycle.
    Also keeps ONE shared SFTP session per server (no channel leak per call).
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(SSHConnectionManager, cls).__new__(cls)
                cls._instance._clients: Dict[int, Tuple[paramiko.SSHClient, float]] = {}
                cls._instance._client_lock = threading.Lock()
                cls._instance._server_locks: Dict[int, threading.RLock] = {}
                cls._instance._sftp: Dict[int, Tuple[paramiko.SSHClient, paramiko.SFTPClient]] = {}
            return cls._instance

    def _get_server_lock(self, server_id: int) -> threading.RLock:
        with self._client_lock:
            if server_id not in self._server_locks:
                self._server_locks[server_id] = threading.RLock()
            return self._server_locks[server_id]

    # ── Host key pinning (trust on first use) ────────────────────────────────
    @staticmethod
    def _known_hosts_path() -> str:
        base = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
        d = os.path.join(base, 'instance')
        os.makedirs(d, exist_ok=True)
        return os.path.join(d, 'known_hosts')

    _hostkey_lock = threading.Lock()

    @staticmethod
    def _host_label(host: str, port: int) -> str:
        return host if int(port or 22) == 22 else f"[{host}]:{int(port)}"

    def _load_host_keys(self, client: paramiko.SSHClient):
        path = self._known_hosts_path()
        if os.path.exists(path):
            try:
                client.load_host_keys(path)
            except Exception as e:
                logger.warning(f"Could not read {path}: {e}")

    def _remember_host_key(self, client: paramiko.SSHClient):
        """Persist keys learned on first connect. A later key change is refused by paramiko."""
        path = self._known_hosts_path()
        with self._hostkey_lock:
            try:
                client.save_host_keys(path)
                os.chmod(path, 0o600)
            except Exception as e:
                logger.warning(f"Could not save host key to {path}: {e}")

    def forget_host_key(self, host: str, port: int = 22) -> bool:
        """Remove a pinned key (use after reinstalling a server, then reconnect to pin the new one)."""
        path = self._known_hosts_path()
        label = self._host_label(host, port)
        with self._hostkey_lock:
            hk = paramiko.HostKeys()
            if not os.path.exists(path):
                return False
            hk.load(path)
            if label not in hk:
                return False
            del hk[label]
            hk.save(path)
            return True

    def _create_client(self, server) -> paramiko.SSHClient:
        connect_kwargs = {
            'hostname': server.host,
            'port': server.port,
            'username': server.username,
            'timeout': 15,
            'banner_timeout': 30,
            'auth_timeout': 30,
            'allow_agent': False,
            'look_for_keys': False,
        }

        if server.auth_type == 'key' and server.private_key:
            pkey = None
            key_file = io.StringIO(server.private_key)
            passphrase = server.passphrase if server.passphrase else None

            # Attempt parsing common private key formats
            key_classes = [
                paramiko.RSAKey,
                paramiko.Ed25519Key,
                paramiko.ECDSAKey,
                paramiko.DSSKey
            ]
            last_err = None
            for key_cls in key_classes:
                key_file.seek(0)
                try:
                    pkey = key_cls.from_private_key(key_file, password=passphrase)
                    break
                except Exception as e:
                    last_err = e

            if pkey is None:
                raise ValueError(f"Failed to load SSH private key: {last_err}")
            connect_kwargs['pkey'] = pkey
        else:
            connect_kwargs['password'] = server.password

        # Attempt connection with resilience against transient SSH banner drops / connection resets
        for attempt in range(1, 3):
            client = paramiko.SSHClient()
            self._load_host_keys(client)
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())   # first sight only; changed keys are rejected
            try:
                client.connect(**connect_kwargs)
                self._remember_host_key(client)
                transport = client.get_transport()
                if transport:
                    transport.set_keepalive(15)
                return client
            except paramiko.BadHostKeyException:
                try:
                    client.close()
                except Exception:
                    pass
                raise paramiko.SSHException(
                    f"HOST KEY CHANGED for {server.host}:{server.port}. This can mean someone is intercepting "
                    f"the connection. If you reinstalled the server, forget the old key (POST "
                    f"/api/servers/{server.id}/forget-host-key) and connect again."
                )
            except (paramiko.SSHException, socket.error, EOFError, ConnectionResetError) as e:
                err_str = str(e).lower()
                is_transient = (
                    "banner" in err_str
                    or "connection reset" in err_str
                    or "reset by peer" in err_str
                    or "eof" in err_str
                    or "104" in err_str
                    or isinstance(e, (ConnectionResetError, EOFError))
                )
                try:
                    client.close()
                except Exception:
                    pass
                if attempt < 2 and is_transient:
                    logger.warning(
                        f"Transient SSH banner/reset error connecting to {server.host}:{server.port} "
                        f"(attempt {attempt}/2): {e}. Retrying in 0.6s..."
                    )
                    time.sleep(0.6)
                    continue
                raise

    def get_client(self, server, force_new: bool = False) -> paramiko.SSHClient:
        """Retrieve an active SSH client or create a new one."""
        with self._client_lock:
            if not force_new and server.id in self._clients:
                client, last_active = self._clients[server.id]
                # Check transport liveness
                transport = client.get_transport()
                if transport and transport.is_active():
                    self._clients[server.id] = (client, time.time())
                    return client
                else:
                    try:
                        client.close()
                    except Exception:
                        pass
                    del self._clients[server.id]
                    self._sftp.pop(server.id, None)

            # Connect new
            client = self._create_client(server)
            self._clients[server.id] = (client, time.time())
            self._sftp.pop(server.id, None)
            return client

    # A command can print gigabytes (cat of a big log, rsync -v of a huge tree). Keep the first part and drop the
    # rest so one command cannot exhaust the memory of the whole ShellMan process.
    MAX_OUTPUT_BYTES = int(os.environ.get('SHELLMAN_MAX_OUTPUT_MB', '16')) * 1024 * 1024
    _TRUNC_NOTE = b"\n[... output truncated by ShellMan to protect server memory ...]\n"

    @classmethod
    def _append_capped(cls, buf: bytearray, chunk: bytes):
        room = cls.MAX_OUTPUT_BYTES - len(buf)
        if room > 0:
            buf += chunk[:room]
            if len(chunk) > room:
                buf += cls._TRUNC_NOTE
        elif chunk and not buf.endswith(cls._TRUNC_NOTE):
            buf += cls._TRUNC_NOTE
        # beyond the cap the data is read and discarded so the remote command never blocks on a full pipe

    @classmethod
    def _read_capped(cls, stream) -> bytes:
        buf = bytearray()
        while True:
            chunk = stream.read(65536)
            if not chunk:
                break
            cls._append_capped(buf, chunk)
        return bytes(buf)

    def _run_cmd(self, client: paramiko.SSHClient, command: str, timeout: int, get_pty: bool,
                 cancel_check=None, on_cancel=None) -> Tuple[int, str, str]:
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout, get_pty=get_pty)
        try:
            if cancel_check is not None:
                # Cancellable mode: poll so a dismissed dialog can kill the remote job and
                # release the per-server lock instead of blocking every other request.
                chan = stdout.channel
                out_buf, err_buf = bytearray(), bytearray()
                deadline = time.time() + max(timeout, 3600)
                while not chan.exit_status_ready():
                    if chan.recv_ready():
                        self._append_capped(out_buf, chan.recv(65536))
                    if chan.recv_stderr_ready():
                        self._append_capped(err_buf, chan.recv_stderr(65536))
                    if cancel_check():
                        if on_cancel:
                            try: on_cancel(client)
                            except Exception: pass
                        return -2, "", "Cancelled"
                    if time.time() > deadline:
                        if on_cancel:
                            try: on_cancel(client)
                            except Exception: pass
                        return -1, "", "Command timed out"
                    time.sleep(0.15)
                exit_status = chan.recv_exit_status()
                self._append_capped(out_buf, self._read_capped(stdout))
                self._append_capped(err_buf, self._read_capped(stderr))
                return exit_status, out_buf.decode('utf-8', errors='replace'), err_buf.decode('utf-8', errors='replace')
            exit_status = stdout.channel.recv_exit_status()
            out_bytes = self._read_capped(stdout)
            err_bytes = self._read_capped(stderr)
            out_str = out_bytes.decode('utf-8', errors='replace')
            err_str = err_bytes.decode('utf-8', errors='replace')
            return exit_status, out_str, err_str
        finally:
            if stdin:
                try: stdin.close()
                except Exception: pass
            if stdout:
                try:
                    if stdout.channel:
                        stdout.channel.close()
                    stdout.close()
                except Exception: pass
            if stderr:
                try: stderr.close()
                except Exception: pass

    @staticmethod
    def _request_id():
        """Id the browser sent for the HTTP request being served (X-Request-Id), if any."""
        try:
            from flask import has_request_context, request
            if has_request_context():
                rid = request.headers.get('X-Request-Id', '')
                if rid and len(rid) <= 64 and all(c.isalnum() or c in '_-' for c in rid):
                    return rid
        except Exception:
            pass
        return None

    @staticmethod
    def marker_for(marker: str) -> str:
        return f"smreq:{marker}"

    @classmethod
    def mark_command(cls, command: str, marker: str) -> str:
        """Prefix a no-op that carries the marker, so the job can be found and killed later."""
        return f": {cls.marker_for(marker)}; {command}"

    @classmethod
    def kill_script(cls, marker: str) -> str:
        """Shell that kills every process (and its children) whose command line has the marker.
        The pattern is written so the killer's own command line does not match it."""
        m = cls.marker_for(marker)
        pat = m[:-1] + "[" + m[-1] + "]"
        return (
            "k(){ for c in $(pgrep -P $1 2>/dev/null); do k $c; done; kill -TERM $1 2>/dev/null; }; "
            f"for p in $(pgrep -f {shlex.quote(pat)} 2>/dev/null); do k $p; done"
        )

    def execute(self, server, command: str, timeout: int = 15, get_pty: bool = False,
                cancel_check=None, on_cancel=None, use_lock: bool = True) -> Tuple[int, str, str]:
        """
        Executes a command safely over SSH with channel lifecycle cleanup and concurrency locking.
        Cancellable: when the browser sends X-Request-Id and later calls /api/tasks/<id>/cancel
        (dialog closed, window closed, Cancel pressed) the remote job is killed, the per-server
        lock is released, and (-2, '', 'Cancelled') is returned.
        use_lock=False runs on its own SSH channel without waiting for the per-server lock, so a
        short read-only probe (ls/find) never queues behind, or blocks, other work on that server.
        Returns: (exit_status, stdout_str, stderr_str)
        """
        from services.progress_tracker import ProgressTracker
        rid = self._request_id()
        if rid:
            command = self.mark_command(command, rid)
            req_check = lambda: ProgressTracker.is_cancelled(rid)
            if cancel_check is None:
                cancel_check = req_check
            else:
                user_check = cancel_check
                cancel_check = lambda: user_check() or req_check()
            if on_cancel is None:
                kill = self.kill_script(rid)
                on_cancel = lambda client: client.exec_command(kill)

        lock = self._get_server_lock(server.id) if use_lock else None
        if lock is None:
            pass
        elif cancel_check is not None:
            # Wait for the server lock without blocking forever; give up if cancelled meanwhile.
            while not lock.acquire(timeout=0.2):
                if cancel_check():
                    return -2, "", "Cancelled"
        else:
            lock.acquire()
        try:
            try:
                client = self.get_client(server)
                try:
                    return self._run_cmd(client, command, timeout, get_pty, cancel_check, on_cancel)
                except Exception as e:
                    # If error might be due to stale connection, retry once with a fresh client
                    logger.warning(f"SSH exec error for server {server.id}, retrying with new connection: {e}")
                    self.disconnect(server.id)
                    time.sleep(0.5)
                    client = self.get_client(server, force_new=True)
                    return self._run_cmd(client, command, timeout, get_pty, cancel_check, on_cancel)
            except Exception as e:
                logger.error(f"SSH command execution failed completely for server {server.id}: {e}")
                return -1, "", f"SSH Connection / Execution Error: {str(e)}"
        finally:
            if lock is not None:
                lock.release()

    def open_shell(self, server, term: str = 'xterm-256color', width: int = 80, height: int = 24) -> Tuple[paramiko.SSHClient, paramiko.Channel]:
        """
        Opens a dedicated pseudo-terminal channel for interactive sessions.

        NOTE: This intentionally creates a DEDICATED SSHClient (via _create_client)
        rather than using the pooled get_client(). A PTY channel multiplexed on the
        same transport as exec_command traffic can interfere with concurrent
        commands, so terminal sessions are isolated. This also means
        disconnect(server_id) will not close terminal clients — terminal.py owns
        its client lifecycle and closes it in TerminalSession.close().

        NOTE: Uses a hand-packed SSH_MSG_CHANNEL_REQUEST 'pty-req' message to
        inject custom terminal modes (IXON=0, so Ctrl+S passes through to the
        remote shell instead of freezing output). Paramiko's public
        Channel.get_pty() does NOT accept a `modes` kwarg, so the hand-packed
        request is the only way to send custom modes without forking Paramiko.
        The three private internals used here (_event_pending,
        transport._send_user_message, _wait_for_event) have been stable across
        Paramiko 2.x / 3.x / 5.x. If you upgrade Paramiko across a major
        version, re-verify this method still works (run: open a terminal tab,
        confirm htop/vim/tmux render and arrow keys work).
        """
        client = self._create_client(server)
        transport = client.get_transport()
        if transport:
            transport.set_keepalive(15)
        channel = transport.open_session()

        # Terminal modes per RFC 4254 Section 8:
        # Opcode 53 = ECHO, 54 = ECHOE, 55 = ECHOK, 51 = ICANON, 50 = ISIG
        # Opcode 38 = IXON (0 = disable output flow control so Ctrl+S doesn't freeze terminal)
        # Opcode 0  = TTY_OP_END
        modes = bytes([
            53, 0, 0, 0, 1,  # ECHO = 1
            54, 0, 0, 0, 1,  # ECHOE = 1
            55, 0, 0, 0, 1,  # ECHOK = 1
            51, 0, 0, 0, 1,  # ICANON = 1
            50, 0, 0, 0, 1,  # ISIG = 1
            38, 0, 0, 0, 0,  # IXON = 0
            0                 # TTY_OP_END
        ])

        from paramiko.common import cMSG_CHANNEL_REQUEST
        from paramiko.message import Message

        m = Message()
        m.add_byte(cMSG_CHANNEL_REQUEST)
        m.add_int(channel.remote_chanid)
        m.add_string("pty-req")
        m.add_boolean(True)
        m.add_string(term)
        m.add_int(width)
        m.add_int(height)
        m.add_int(0)   # width_pixels
        m.add_int(0)   # height_pixels
        m.add_string(modes)
        channel._event_pending()
        transport._send_user_message(m)
        channel._wait_for_event()

        channel.invoke_shell()
        channel.settimeout(0.0)  # Non-blocking recv
        return client, channel

    def close_sftp(self, server_id: int):
        """Cleanly closes and purges any cached SFTP session for a server."""
        with self._client_lock:
            entry = self._sftp.pop(server_id, None)
            if entry:
                _, cached_sftp = entry
                try:
                    cached_sftp.close()
                except Exception:
                    pass

    def open_sftp(self, server, force_new: bool = False) -> Tuple[paramiko.SSHClient, paramiko.SFTPClient]:
        """
        Returns the pooled client plus ONE shared SFTP session per server.
        Thread-safe: validated channel health and sets non-hanging timeouts.
        """
        client = self.get_client(server)
        with self._client_lock:
            if force_new:
                self._sftp.pop(server.id, None)

            entry = self._sftp.get(server.id)
            if entry:
                cached_client, cached_sftp = entry
                try:
                    channel = cached_sftp.sock
                    alive = (
                        cached_client is client
                        and channel is not None
                        and not channel.closed
                        and channel.get_transport() is not None
                        and channel.get_transport().is_active()
                    )
                except Exception:
                    alive = False
                if alive:
                    return client, cached_sftp
                try:
                    cached_sftp.close()
                except Exception:
                    pass
                self._sftp.pop(server.id, None)

            sftp = client.open_sftp()
            try:
                if sftp.get_channel():
                    sftp.get_channel().settimeout(12.0)
            except Exception:
                pass
            self._sftp[server.id] = (client, sftp)
            return client, sftp

    @contextmanager
    def sftp_context(self, server):
        """
        Thread-safe context manager for SFTP operations on a server.
        Acquires the per-server lock to prevent packet interleaving and
        automatically closes the cached session on channel errors.
        """
        lock = self._get_server_lock(server.id)
        with lock:
            client, sftp = self.open_sftp(server)
            try:
                yield sftp
            except Exception as exc:
                err_str = str(exc).lower()
                if any(k in err_str for k in ('closed', 'eof', 'socket', 'transport', 'packet', 'broken pipe', 'not active')):
                    self.close_sftp(server.id)
                raise

    def disconnect(self, server_id: int):
        with self._client_lock:
            self._sftp.pop(server_id, None)
            if server_id in self._clients:
                client, _ = self._clients.pop(server_id)
                try:
                    client.close()
                except Exception:
                    pass

    def test_connection(self, server) -> Tuple[bool, str]:
        try:
            client = self._create_client(server)
            try:
                transport = client.get_transport()
                if transport and transport.is_active():
                    _, sys_info, _ = self._run_cmd(client, "uname -s -r -m", timeout=10, get_pty=False)
                    return True, f"Success! Remote host reports: {sys_info.strip()}"
                return False, "Failed to establish active SSH transport"
            finally:
                client.close()
        except socket.timeout:
            return False, "Connection timed out"
        except paramiko.AuthenticationException:
            return False, "SSH Authentication failed (incorrect password or private key)"
        except paramiko.SSHException as e:
            return False, f"SSH Protocol error: {str(e)}"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

# Global singleton
ssh_manager = SSHConnectionManager()