import os
import re
import time
import shlex
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from services.ssh_manager import ssh_manager

# Max execution output size: 512 KB
MAX_OUTPUT_BYTES = 512 * 1024

class ActionExecutionService:
    """
    Safely resolves, confirms, and executes Custom Actions over SSH.
    Guarantees no raw parameter concatenation, strict quoting with shlex.quote(),
    and environment variable isolation.
    """

    @staticmethod
    def resolve_variables(
        template: str,
        server,
        selected_path: str = "",
        selected_paths: Optional[List[str]] = None,
        current_dir: str = "/"
    ) -> Dict[str, Any]:
        """
        Parses template variables and safely quotes each value.
        Returns the resolved shell command and exported environment variables.
        """
        if selected_paths is None:
            selected_paths = [selected_path] if selected_path else []

        sel_name = os.path.basename(selected_path.rstrip('/')) if selected_path else ""
        cur_dir = current_dir or "/"

        # Safely quote every input parameter
        q_selected_path = shlex.quote(selected_path)
        q_selected_name = shlex.quote(sel_name)
        q_current_dir = shlex.quote(cur_dir)
        q_selected_paths = " ".join(shlex.quote(p) for p in selected_paths)
        q_server_name = shlex.quote(getattr(server, 'name', ''))
        q_server_host = shlex.quote(getattr(server, 'host', ''))

        # Token replacement dictionary
        replacements = {
            r'\{\{\s*selected_path\s*\}\}': q_selected_path,
            r'\{\{\s*selected_name\s*\}\}': q_selected_name,
            r'\{\{\s*current_dir\s*\}\}': q_current_dir,
            r'\{\{\s*selected_paths\s*\}\}': q_selected_paths,
            r'\{\{\s*server_name\s*\}\}': q_server_name,
            r'\{\{\s*server_host\s*\}\}': q_server_host,
        }

        resolved_cmd = template
        for pattern, safe_val in replacements.items():
            resolved_cmd = re.sub(pattern, safe_val, resolved_cmd)

        # Environmental bindings prefix
        env_prefix = (
            f"export SHELLMAN_SELECTED_PATH={q_selected_path}; "
            f"export SHELLMAN_SELECTED_NAME={q_selected_name}; "
            f"export SHELLMAN_CURRENT_DIR={q_current_dir}; "
            f"export SHELLMAN_SERVER_NAME={q_server_name}; "
            f"cd {q_current_dir} 2>/dev/null || true; "
        )

        full_executable_script = env_prefix + resolved_cmd

        return {
            'resolved_command': resolved_cmd,
            'full_executable_script': full_executable_script,
            'selected_path': selected_path,
            'selected_paths': selected_paths,
            'selected_name': sel_name,
            'current_dir': cur_dir,
            'server_name': getattr(server, 'name', ''),
            'server_host': getattr(server, 'host', '')
        }

    @staticmethod
    def execute_action(
        server,
        action,
        selected_path: str = "",
        selected_paths: Optional[List[str]] = None,
        current_dir: str = "/"
    ) -> Dict[str, Any]:
        """
        Executes the custom action on the target remote host via SSH.
        Returns execution outcome, exit code, stdout, stderr, and elapsed time.
        """
        resolved = ActionExecutionService.resolve_variables(
            template=action.command,
            server=server,
            selected_path=selected_path,
            selected_paths=selected_paths,
            current_dir=current_dir
        )

        timeout = max(5, min(int(action.timeout or 30), 180))
        start_time = time.time()

        try:
            code, stdout, stderr = ssh_manager.execute(
                server,
                resolved['full_executable_script'],
                timeout=timeout
            )
        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            return {
                'success': False,
                'exit_code': -1,
                'error': f"SSH Execution Error: {str(e)}",
                'stdout': '',
                'stderr': str(e),
                'duration_ms': elapsed_ms,
                'command_executed': resolved['resolved_command'],
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

        elapsed_ms = int((time.time() - start_time) * 1000)

        # Truncate output buffer if larger than MAX_OUTPUT_BYTES
        if len(stdout) > MAX_OUTPUT_BYTES:
            stdout = stdout[:MAX_OUTPUT_BYTES] + "\n... [Output truncated by ShellMan at 512 KB] ..."
        if len(stderr) > MAX_OUTPUT_BYTES:
            stderr = stderr[:MAX_OUTPUT_BYTES] + "\n... [Stderr truncated by ShellMan at 512 KB] ..."

        return {
            'success': (code == 0),
            'exit_code': code,
            'stdout': stdout,
            'stderr': stderr,
            'duration_ms': elapsed_ms,
            'command_executed': resolved['resolved_command'],
            'server_id': server.id,
            'server_name': server.name,
            'server_host': server.host,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }

