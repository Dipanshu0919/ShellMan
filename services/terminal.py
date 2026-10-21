import json
import logging
import threading
import time
from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.terminal')

class TerminalSession:
    """
    Bridges an interactive WebSocket client with a remote Paramiko SSH pseudo-terminal (PTY).
    Handles duplex communication, terminal resizing, and thread lifecycle.
    """

    def __init__(self, ws, server, cols=80, rows=24, term='xterm-256color', cwd=None):
        self.ws = ws
        self.server = server
        self.cols = cols
        self.rows = rows
        self.term = term
        self.cwd = cwd
        self.client = None
        self.channel = None
        self.alive = True
        self.thread = None

    def start(self):
        try:
            self.client, self.channel = ssh_manager.open_shell(
                self.server,
                term=self.term,
                width=self.cols,
                height=self.rows
            )
            # If a working directory is specified, navigate to it automatically
            if self.cwd and str(self.cwd).strip():
                def _send_cd():
                    import time, shlex
                    # Short delay to allow remote shell process to complete initial startup, motd, and readline init
                    time.sleep(0.3)
                    if self.alive and self.channel and not self.channel.closed:
                        target = str(self.cwd).strip()
                        if target.startswith('~/'):
                            rel = target[2:]
                            cmd = f'if [ -d "$HOME/{rel}" ]; then cd "$HOME/{rel}"; else cd "$(dirname "$HOME/{rel}")"; fi && clear\n'
                        elif target == '~':
                            cmd = 'cd "$HOME" && clear\n'
                        else:
                            quoted = shlex.quote(target)
                            cmd = f'if [ -d {quoted} ]; then cd {quoted}; else cd "$(dirname {quoted})"; fi && clear\n'
                        try:
                            self.channel.send(cmd.encode('utf-8'))
                        except Exception as err:
                            logger.debug(f"Failed to send initial cd command: {err}")

                threading.Thread(target=_send_cd, daemon=True).start()

            # Channel is non-blocking
            self.thread = threading.Thread(target=self._read_ssh_loop, daemon=True)
            self.thread.start()
        except Exception as e:
            logger.error(f"Failed to open PTY shell: {e}")
            try:
                self.ws.send(json.dumps({'type': 'error', 'data': f"SSH connection failed: {str(e)}\r\n"}))
            except Exception:
                pass
            self.close()

    def _read_ssh_loop(self):
        """
        Reads raw bytes from Paramiko channel and pushes to WebSocket.

        FIX: Paramiko Channels are not reliably selectable via select.select().
        Use recv_ready() polling with a short sleep instead. This avoids
        spurious wakeups and CPU spin while preserving low latency (~20ms).
        """
        try:
            while self.alive and self.channel and not self.channel.closed:
                if self.channel.recv_ready():
                    data = self.channel.recv(4096)
                    if not data:
                        break
                    try:
                        payload = json.dumps({'type': 'data', 'data': data.decode('utf-8', errors='replace')})
                        self.ws.send(payload)
                    except Exception as e:
                        logger.debug(f"WS send error: {e}")
                        break
                elif self.channel.exit_status_ready():
                    # Drain any final bytes before exiting
                    if not self.channel.recv_ready():
                        break
                else:
                    time.sleep(0.02)
        except Exception as e:
            logger.debug(f"SSH read loop terminated: {e}")
        finally:
            if self.alive:
                try:
                    self.ws.send(json.dumps({'type': 'closed', 'data': '\r\n[ShellMan session terminated]\r\n'}))
                except Exception:
                    pass
            self.close()

    def handle_client_message(self, message: str):
        """Processes message from WebSocket client (keystrokes, resize, ping)."""
        try:
            msg = json.loads(message)
            mtype = msg.get('type')

            if mtype == 'input':
                data = msg.get('data', '')
                if data and self.channel and not self.channel.closed:
                    self.channel.send(data.encode('utf-8'))

            elif mtype == 'resize':
                cols = int(msg.get('cols', 80))
                rows = int(msg.get('rows', 24))
                if self.channel and not self.channel.closed:
                    self.channel.resize_pty(width=cols, height=rows)
                    self.cols = cols
                    self.rows = rows

            elif mtype == 'ping':
                self.ws.send(json.dumps({'type': 'pong'}))

        except json.JSONDecodeError:
            # Fallback if raw text sent
            if self.channel and not self.channel.closed:
                self.channel.send(message.encode('utf-8'))
        except Exception as e:
            logger.error(f"Error handling WS message: {e}")

    def close(self):
        self.alive = False
        if self.channel:
            try:
                self.channel.close()
            except Exception:
                pass
            self.channel = None
        if self.client:
            try:
                self.client.close()
            except Exception:
                pass
            self.client = None