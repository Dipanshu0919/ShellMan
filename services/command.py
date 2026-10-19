import re
import shlex
from typing import List, Dict, Any, Tuple
from services.ssh_manager import ssh_manager

# Whitelist safe systemd action verbs
VALID_SERVICE_ACTIONS = {'start', 'stop', 'restart', 'reload', 'enable', 'disable', 'status'}
SAFE_SERVICE_NAME_RE = re.compile(r'^[a-zA-Z0-9_\-@.]+$')

class LinuxCommandService:
    """
    Executes service, process, and log operations via SSH safely without shell injection.
    """

    @staticmethod
    def list_services(server) -> List[Dict[str, Any]]:
        """List systemd services via systemctl."""
        cmd = "systemctl list-units --type=service --all --no-pager --no-legend 2>/dev/null"
        code, stdout, _ = ssh_manager.execute(server, cmd, timeout=10)
        services = []
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 4)
            if len(parts) >= 4:
                unit = parts[0]
                load = parts[1]
                active = parts[2]
                sub = parts[3]
                desc = parts[4] if len(parts) > 4 else ""
                services.append({
                    'name': unit,
                    'load': load,
                    'active': active,
                    'sub': sub,
                    'is_running': (active == 'active' and sub == 'running'),
                    'description': desc
                })
        return services

    @staticmethod
    def manage_service(server, service_name: str, action: str) -> Tuple[bool, str]:
        """Control a service securely."""
        if action not in VALID_SERVICE_ACTIONS:
            return False, f"Invalid action: {action}"
        if not SAFE_SERVICE_NAME_RE.match(service_name):
            return False, "Invalid service name format"

        # Safely quote arguments
        quoted_service = shlex.quote(service_name)
        cmd = f"sudo -n systemctl {action} {quoted_service} 2>&1 || systemctl {action} {quoted_service} 2>&1"
        code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
        output = (stdout + stderr).strip()
        if code == 0:
            return True, output or f"Service {service_name} {action}ed successfully"
        return False, output or f"Command failed with exit code {code}"

    @staticmethod
    def get_service_logs(server, service_name: str, lines: int = 100) -> str:
        """Fetch recent journalctl logs for a service."""
        if not SAFE_SERVICE_NAME_RE.match(service_name):
            return "Invalid service name"
        lines = max(10, min(lines, 1000))
        quoted_service = shlex.quote(service_name)
        cmd = f"journalctl -u {quoted_service} -n {lines} --no-pager 2>/dev/null"
        _, stdout, stderr = ssh_manager.execute(server, cmd, timeout=10)
        return stdout or stderr or "No logs found."

    @staticmethod
    def get_system_logs(server, lines: int = 100) -> str:
        """Fetch general system journalctl logs."""
        lines = max(10, min(lines, 1000))
        cmd = f"journalctl -n {lines} --no-pager 2>/dev/null || tail -n {lines} /var/log/syslog 2>/dev/null || tail -n {lines} /var/log/messages 2>/dev/null"
        _, stdout, stderr = ssh_manager.execute(server, cmd, timeout=10)
        return stdout or stderr or "No system logs found."

    @staticmethod
    def list_processes(server) -> List[Dict[str, Any]]:
        """List running processes."""
        cmd = "ps -eo pid,user,%cpu,%mem,stat,comm,args --sort=-%cpu --no-headers | head -n 150"
        _, stdout, _ = ssh_manager.execute(server, cmd, timeout=8)
        processes = []
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 6)
            if len(parts) >= 6:
                try:
                    pid = int(parts[0])
                    user = parts[1]
                    cpu = float(parts[2])
                    mem = float(parts[3])
                    stat = parts[4]
                    comm = parts[5]
                    args = parts[6] if len(parts) > 6 else comm
                    processes.append({
                        'pid': pid,
                        'user': user,
                        'cpu': cpu,
                        'mem': mem,
                        'stat': stat,
                        'comm': comm,
                        'args': args
                    })
                except ValueError:
                    continue
        return processes

    @staticmethod
    def kill_process(server, pid: int, signal: str = 'SIGTERM') -> Tuple[bool, str]:
        """Safely send signals to a PID (SIGTERM or SIGKILL)."""
        if not isinstance(pid, int) or pid <= 1:
            return False, "Cannot signal system PID 1 or invalid PID"

        sig_flag = '-9' if signal.upper() in ('SIGKILL', '9', 'KILL') else '-15'
        cmd = f"kill {sig_flag} {pid} 2>&1 || sudo -n kill {sig_flag} {pid} 2>&1"
        code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=5)
        output = (stdout + stderr).strip()
        if code == 0:
            return True, f"Signal {signal} sent to PID {pid}"
        return False, output or f"Failed to signal PID {pid}"

    @staticmethod
    def server_power(server, action: str) -> Tuple[bool, str]:
        """Execute reboot or shutdown with confirmation verification."""
        if action not in ('reboot', 'shutdown'):
            return False, "Invalid power action"
        cmd = f"sudo -n {action} 2>&1 || {action} 2>&1"
        code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=5)
        output = (stdout + stderr).strip()
        return True, f"{action.capitalize()} command initiated: {output}"
