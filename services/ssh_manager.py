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
            return cls._instance

    def _create_client(self, server) -> paramiko.SSHClient:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        connect_kwargs = {
            'hostname': server.host,
            'port': server.port,
            'username': server.username,
            'timeout': 10,
            'banner_timeout': 10,
            'auth_timeout': 10,
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

    def execute(self, server, command: str, timeout: int = 15, get_pty: bool = False) -> Tuple[int, str, str]:
        """
        Executes a command safely over SSH.
        Returns: (exit_status, stdout_str, stderr_str)
        """
        client = self.get_client(server)
        try:
            stdin, stdout, stderr = client.exec_command(command, timeout=timeout, get_pty=get_pty)
            exit_status = stdout.channel.recv_exit_status()
            out_bytes = stdout.read()
            err_bytes = stderr.read()
            out_str = out_bytes.decode('utf-8', errors='replace')
            err_str = err_bytes.decode('utf-8', errors='replace')
            return exit_status, out_str, err_str
        except Exception as e:
            # If error might be due to stale connection, retry once with a fresh client
            logger.warning(f"SSH exec error for server {server.id}, retrying with new connection: {e}")
            self.disconnect(server.id)
            client = self.get_client(server, force_new=True)
            stdin, stdout, stderr = client.exec_command(command, timeout=timeout, get_pty=get_pty)
            exit_status = stdout.channel.recv_exit_status()
            out_bytes = stdout.read()
            err_bytes = stderr.read()
            return exit_status, out_bytes.decode('utf-8', errors='replace'), err_bytes.decode('utf-8', errors='replace')

    def open_shell(self, server, term: str = 'xterm-256color', width: int = 80, height: int = 24) -> Tuple[paramiko.SSHClient, paramiko.Channel]:
        """
        Opens a dedicated pseudo-terminal channel for interactive sessions.
        Configures terminal modes according to RFC 4254 to disable IXON (software flow control),
        preventing Ctrl+S from freezing output transmission.
        """
        client = self._create_client(server)
        transport = client.get_transport()
        channel = transport.open_session()

        # Terminal modes according to RFC 4254:
        # opcode 53 = IXON (enable output flow control). Set to 0 (disabled).
        # opcode 0 = TTY_OP_END
        # Format: opcode (1 byte) + uint32 argument (4 bytes) + end opcode (1 byte)
        modes = bytes([53, 0, 0, 0, 0, 0])
        
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
        m.add_int(0)
        m.add_int(0)
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
            transport = client.get_transport()
            if transport and transport.is_active():
                stdin, stdout, stderr = client.exec_command("uname -s -r -m", timeout=5)
                sys_info = stdout.read().decode('utf-8', errors='replace').strip()
                client.close()
                return True, f"Success! Remote host reports: {sys_info}"
            client.close()
            return False, "Failed to establish active SSH transport"
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
