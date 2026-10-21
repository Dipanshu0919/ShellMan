import io
import time
import socket
import threading
import logging
import paramiko
from typing import Optional, Dict, Tuple

logger = logging.getLogger('shellman.ssh')

class SSHConnectionManager:
    """
    Thread-safe connection manager for persistent & on-demand SSH clients.
    Avoids reconnect overhead while enforcing timeouts and clean pool lifecycle.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(SSHConnectionManager, cls).__new__(cls)
                cls._instance._clients: Dict[int, Tuple[paramiko.SSHClient, float]] = {}
                cls._instance._client_lock = threading.Lock()
                cls._instance._server_locks: Dict[int, threading.Lock] = {}
            return cls._instance

    def _get_server_lock(self, server_id: int) -> threading.Lock:
        with self._client_lock:
            if server_id not in self._server_locks:
                self._server_locks[server_id] = threading.Lock()
            return self._server_locks[server_id]

    def _create_client(self, server) -> paramiko.SSHClient:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

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

        client.connect(**connect_kwargs)
        transport = client.get_transport()
        if transport:
            transport.set_keepalive(15)
        return client

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

            # Connect new
            client = self._create_client(server)
            self._clients[server.id] = (client, time.time())
            return client

    def _run_cmd(self, client: paramiko.SSHClient, command: str, timeout: int, get_pty: bool) -> Tuple[int, str, str]:
        stdin, stdout, stderr = client.exec_command(command, timeout=timeout, get_pty=get_pty)
        try:
            exit_status = stdout.channel.recv_exit_status()
            out_bytes = stdout.read()
            err_bytes = stderr.read()
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

    def execute(self, server, command: str, timeout: int = 15, get_pty: bool = False) -> Tuple[int, str, str]:
        """
        Executes a command safely over SSH with channel lifecycle cleanup and concurrency locking.
        Returns: (exit_status, stdout_str, stderr_str)
        """
        lock = self._get_server_lock(server.id)
        with lock:
            try:
                client = self.get_client(server)
                try:
                    return self._run_cmd(client, command, timeout, get_pty)
                except Exception as e:
                    # If error might be due to stale connection, retry once with a fresh client
                    logger.warning(f"SSH exec error for server {server.id}, retrying with new connection: {e}")
                    self.disconnect(server.id)
                    time.sleep(0.5)
                    client = self.get_client(server, force_new=True)
                    return self._run_cmd(client, command, timeout, get_pty)
            except Exception as e:
                logger.error(f"SSH command execution failed completely for server {server.id}: {e}")
                return -1, "", f"SSH Connection / Execution Error: {str(e)}"

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
        # Opcode 53 = ECHO (1 = enable echoing of typed characters)
        # Opcode 54 = ECHOE (1 = visually erase character on backspace)
        # Opcode 55 = ECHOK (1 = kill character discards current line)
        # Opcode 51 = ICANON (1 = canonical line editing)
        # Opcode 50 = ISIG (1 = enable signals like INTR, QUIT, SUSP)
        # Opcode 38 = IXON (0 = disable output flow control so Ctrl+S doesn't freeze terminal)
        # Opcode 0  = TTY_OP_END
        # Format: opcode (1 byte) + uint32 argument (4 bytes, big-endian) ... + end opcode 0 (1 byte)
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

    def open_sftp(self, server) -> Tuple[paramiko.SSHClient, paramiko.SFTPClient]:
        """
        Opens an SFTP client session.
        """
        client = self.get_client(server)
        sftp = client.open_sftp()
        return client, sftp

    def disconnect(self, server_id: int):
        with self._client_lock:
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