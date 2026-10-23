import json
import logging
from typing import Dict, Any, List, Optional
from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.docker')

class DockerService:
    """
    Agentless Docker and Container Manager over standard SSH.
    Operates with 0 MB resident RAM on remote servers.
    """

    def get_status(self, server) -> Dict[str, Any]:
        """Checks if Docker daemon is installed, running, and retrieves system info."""
        cmd = (
            "if command -v docker >/dev/null 2>&1; then "
            "  if docker info >/dev/null 2>&1; then "
            "    echo 'STATUS:RUNNING'; "
            "    docker info --format '{{json .}}'; "
            "  else "
            "    echo 'STATUS:STOPPED_OR_NOPERM'; "
            "    docker version --format '{{json .}}' 2>/dev/null || true; "
            "  fi; "
            "else "
            "  echo 'STATUS:NOT_INSTALLED'; "
            "fi"
        )
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=12)
        lines = stdout.strip().splitlines()
        first_line = lines[0] if lines else ''

        if 'STATUS:NOT_INSTALLED' in first_line:
            return {
                'installed': False,
                'running': False,
                'message': 'Docker is not installed on this server.'
            }

        if 'STATUS:STOPPED_OR_NOPERM' in first_line:
            return {
                'installed': True,
                'running': False,
                'message': 'Docker is installed, but daemon is inactive or user lacks sudo/docker group permissions.'
            }

        # Parse Docker Info JSON
        json_str = '\n'.join(lines[1:])
        info = {}
        try:
            info = json.loads(json_str)
        except Exception:
            pass

        return {
            'installed': True,
            'running': True,
            'containers_total': info.get('Containers', 0),
            'containers_running': info.get('ContainersRunning', 0),
            'containers_paused': info.get('ContainersPaused', 0),
            'containers_stopped': info.get('ContainersStopped', 0),
            'images_count': info.get('Images', 0),
            'server_version': info.get('ServerVersion', 'Unknown'),
            'operating_system': info.get('OperatingSystem', ''),
            'arch': info.get('Architecture', ''),
            'cpus': info.get('NCPU', 0),
            'mem_total': info.get('MemTotal', 0),
            'driver': info.get('Driver', '')
        }

    def list_containers(self, server) -> List[Dict[str, Any]]:
        """Lists all running and stopped containers with metadata."""
        cmd = "docker ps -a --format '{{json .}}'"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
        if exit_code != 0:
            logger.warning(f"docker ps returned code {exit_code}: {stderr}")
            return []

        containers = []
        for line in stdout.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                # Normalize keys across Docker CLI versions
                c_id = item.get('ID') or item.get('Id') or ''
                names = item.get('Names') or item.get('Name') or ''
                image = item.get('Image') or ''
                status = item.get('Status') or ''
                state = item.get('State') or ''
                ports = item.get('Ports') or ''
                created = item.get('CreatedAt') or item.get('RunningFor') or ''
                size = item.get('Size') or ''

                if not state:
                    st_lower = status.lower()
                    if 'up' in st_lower:
                        state = 'running'
                    elif 'paused' in st_lower:
                        state = 'paused'
                    else:
                        state = 'exited'

                containers.append({
                    'id': c_id,
                    'short_id': c_id[:12] if c_id else '',
                    'name': names.lstrip('/'),
                    'image': image,
                    'status': status,
                    'state': state.lower(),
                    'ports': ports,
                    'created': created,
                    'size': size
                })
            except Exception as e:
                logger.debug(f"Failed to parse container line: {line} ({e})")
                continue

        return containers

    def get_container_stats(self, server) -> List[Dict[str, Any]]:
        """Retrieves non-streaming CPU, Memory, and Network I/O metrics for active containers."""
        cmd = "docker stats --no-stream --format '{{json .}}'"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=12)
        if exit_code != 0:
            return []

        stats = []
        for line in stdout.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                st = json.loads(line)
                stats.append({
                    'id': (st.get('ID') or '')[:12],
                    'name': (st.get('Name') or '').lstrip('/'),
                    'cpu_pct': st.get('CPUPerc', '0%'),
                    'mem_usage': st.get('MemUsage', '0B / 0B'),
                    'mem_pct': st.get('MemPerc', '0%'),
                    'net_io': st.get('NetIO', '0B / 0B'),
                    'block_io': st.get('BlockIO', '0B / 0B'),
                    'pids': st.get('PIDs', '0')
                })
            except Exception:
                continue
        return stats

    def container_action(self, server, container_id: str, action: str) -> Dict[str, Any]:
        """Executes start, stop, restart, pause, unpause, or delete on a container."""
        valid_actions = {
            'start': 'docker start',
            'stop': 'docker stop -t 10',
            'restart': 'docker restart -t 10',
            'pause': 'docker pause',
            'unpause': 'docker unpause',
            'delete': 'docker rm -f'
        }
        if action not in valid_actions:
            return {'success': False, 'error': f"Invalid container action '{action}'"}

        clean_id = container_id.strip().replace('"', '').replace(';', '').replace('&', '')
        cmd = f"{valid_actions[action]} {clean_id}"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=25)

        if exit_code == 0:
            return {
                'success': True,
                'message': f"Container action '{action}' executed successfully on {clean_id[:12]}.",
                'output': stdout.strip()
            }
        else:
            return {
                'success': False,
                'error': f"Failed to {action} container: {stderr.strip() or stdout.strip()}",
                'exit_code': exit_code
            }

    def get_container_logs(self, server, container_id: str, tail: int = 250) -> Dict[str, Any]:
        """Fetches the latest tailed log output for a container."""
        clean_id = container_id.strip().replace('"', '').replace(';', '').replace('&', '')
        tail_num = max(10, min(1000, tail))
        cmd = f"docker logs --tail {tail_num} --timestamps {clean_id} 2>&1"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
        return {
            'success': True,
            'container_id': clean_id,
            'logs': stdout + stderr,
            'lines_count': len(stdout.splitlines())
        }

    def list_compose_projects(self, server) -> List[Dict[str, Any]]:
        """Lists active Docker Compose projects."""
        cmd = "docker compose ls --format json 2>/dev/null || docker-compose ps --format json 2>/dev/null || true"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=10)
        if not stdout.strip():
            return []
        try:
            res = json.loads(stdout.strip())
            return res if isinstance(res, list) else [res]
        except Exception:
            return []

    def compose_action(self, server, work_dir: str, action: str, compose_file: Optional[str] = None) -> Dict[str, Any]:
        """Executes docker compose up -d --build, down, or restart in a given directory."""
        clean_dir = work_dir.strip().replace('"', '').replace(';', '')
        f_flag = f"-f {compose_file.strip()} " if compose_file else ""

        if action == 'up':
            cmd = f"cd \"{clean_dir}\" && (docker compose {f_flag}up -d --build 2>&1 || docker-compose {f_flag}up -d --build 2>&1)"
        elif action == 'down':
            cmd = f"cd \"{clean_dir}\" && (docker compose {f_flag}down 2>&1 || docker-compose {f_flag}down 2>&1)"
        elif action == 'restart':
            cmd = f"cd \"{clean_dir}\" && (docker compose {f_flag}restart 2>&1 || docker-compose {f_flag}restart 2>&1)"
        elif action == 'ps':
            cmd = f"cd \"{clean_dir}\" && (docker compose {f_flag}ps 2>&1 || docker-compose {f_flag}ps 2>&1)"
        else:
            return {'success': False, 'error': f"Unknown compose action '{action}'"}

        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=120)
        output = (stdout + stderr).strip()

        return {
            'success': exit_code == 0,
            'action': action,
            'work_dir': clean_dir,
            'output': output,
            'exit_code': exit_code
        }

docker_service = DockerService()

