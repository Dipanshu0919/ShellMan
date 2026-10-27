import json
import logging
import threading
import time
from services.ssh_manager import ssh_manager
from services.recorder import LineRecorder
from services.audit import audit, get_config as audit_config

logger = logging.getLogger('shellman.terminal')

class TerminalSession:
    """
    Bridges an interactive WebSocket client with a remote Paramiko SSH pseudo-terminal (PTY).
    Handles duplex communication, terminal resizing, and thread lifecycle.
    """

    def __init__(self, ws, server, cols=80, rows=24, term='xterm-256color', cwd=None, username=''):
        self.ws = ws
        self.server = server
        try:
            c = int(cols or 80)
            self.cols = max(10, min(500, c)) if c > 0 else 80
        except (ValueError, TypeError):
            self.cols = 80
        try:
            r = int(rows or 24)
            self.rows = max(4, min(200, r)) if r > 0 else 24
        except (ValueError, TypeError):
            self.rows = 24
        self.term = term
        self.cwd = cwd
        self.username = username or ''
        self.recorder = None
        self._closed_logged = False
        try:
            if audit_config().get('record_terminal', 1):
                self.recorder = LineRecorder(self._record_line)
        except Exception:
            self.recorder = None
        self.client = None
        self.channel = None
        self.alive = True
        self._send_lock = threading.Lock()
        self.thread = None

    def _record_line(self, text):
        audit('terminal.command', target=self.server.name, detail=text, username=self.username)

    def _send(self, payload):
        with self._send_lock:
            self.ws.send(payload)

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
                self._send(json.dumps({'type': 'error', 'data': f"SSH connection failed: {str(e)}\r\n"}))
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
                        text_out = data.decode('utf-8', errors='replace')
                        if self.recorder:
                            self.recorder.note_output(text_out)
                        payload = json.dumps({'type': 'data', 'data': text_out})
                        self._send(payload)
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
                    self._send(json.dumps({'type': 'closed', 'data': '\r\n[ShellMan session terminated]\r\n'}))
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
                    if self.recorder:
                        self.recorder.feed(data)
                    self.channel.send(data.encode('utf-8'))

            elif mtype == 'resize':
                try:
                    c = int(msg.get('cols', 80) or 80)
                    r = int(msg.get('rows', 24) or 24)
                    cols = max(10, min(500, c)) if c > 0 else 80
                    rows = max(4, min(200, r)) if r > 0 else 24
                except (ValueError, TypeError):
                    cols, rows = 80, 24
                if self.channel and not self.channel.closed:
                    try:
                        self.channel.resize_pty(width=cols, height=rows)
                        self.cols = cols
                        self.rows = rows
                    except Exception as err:
                        logger.debug(f"Failed to resize PTY: {err}")

            elif mtype == 'ping':
                self._send(json.dumps({'type': 'pong'}))

        except json.JSONDecodeError:
            # Fallback if raw text sent
            if self.channel and not self.channel.closed:
                self.channel.send(message.encode('utf-8'))
        except Exception as e:
            logger.error(f"Error handling WS message: {e}")

    def close(self):
        self.alive = False
        if self.recorder and not self._closed_logged:
            self._closed_logged = True
            audit('terminal.close', target=self.server.name,
                  detail=f'{self.recorder.count} command(s), {int(time.time() - self.recorder.started)} s',
                  username=self.username)
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