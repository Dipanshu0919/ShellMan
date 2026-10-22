import os
import re
import shlex
import tempfile
import subprocess
from flask import Blueprint, request, jsonify
from models.server import Server
from routes.auth_helpers import login_required
from services.ssh_manager import ssh_manager

sync_bp = Blueprint('sync', __name__)

SAFE_PATH_REGEX = re.compile(r'^[a-zA-Z0-9_\-./~* ]+$')

def sanitize_path(path: str) -> str:
    path = (path or '').strip()
    if not path:
        return ''
    # Prevent dangerous shell command injection
    for bad in [';', '&&', '||', '`', '$', '|', '>', '<', '\n', '\r']:
        if bad in path:
            return ''
    return path

def execute_rsync_operation(server, src: str, dst: str, is_local_remote: bool, is_dry_run: bool, opts: dict, excludes: list):
    delete_flag = '--delete' if opts.get('delete') else ''
    archive_flag = '-a' if opts.get('archive', True) else '-r'
    compress_flag = '-z' if opts.get('compress', True) else ''
    dry_flag = '-n' if is_dry_run else ''
    exclude_items = excludes if isinstance(excludes, list) else ['.git', 'node_modules', '__pycache__', '*.tmp']
    exclude_str = " ".join([f"--exclude={shlex.quote(ex.strip())}" for ex in exclude_items if ex.strip()])

    if not is_local_remote:
        # Server-to-Server Sync: Executed remotely via persistent SSH tunnel on remote host
        rsync_cmd = f"rsync {archive_flag} -v {compress_flag} {dry_flag} --stats {delete_flag} {exclude_str} {shlex.quote(src)} {shlex.quote(dst)}"
        code, stdout, stderr = ssh_manager.execute(server, rsync_cmd, timeout=120 if not is_dry_run else 30)
        return code, stdout or '', stderr or '', rsync_cmd

    # Local-to-Remote / Remote-to-Local: Executed on the host running ShellMan, tunneling to remote server
    temp_files_to_clean = []
    env = os.environ.copy()
    ssh_opts = f"ssh -p {server.port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15"

    try:
        if server.auth_type == 'key' and server.private_key:
            key_file = tempfile.NamedTemporaryFile(mode='w', delete=False)
            key_file.write(server.private_key)
            if not server.private_key.endswith('\n'):
                key_file.write('\n')
            key_file.flush()
            key_file.close()
            os.chmod(key_file.name, 0o600)
            temp_files_to_clean.append(key_file.name)
            ssh_opts += f" -i {shlex.quote(key_file.name)}"
        elif server.password:
            askpass_file = tempfile.NamedTemporaryFile(mode='w', delete=False)
            askpass_file.write(f"#!/bin/sh\ncat << 'EOF_PASS'\n{server.password}\nEOF_PASS\n")
            askpass_file.flush()
            askpass_file.close()
            os.chmod(askpass_file.name, 0o700)
            temp_files_to_clean.append(askpass_file.name)
            env['SSH_ASKPASS'] = askpass_file.name
            env['SSH_ASKPASS_REQUIRE'] = 'force'
            env['DISPLAY'] = ':0'

        cmd_tokens = ['rsync']
        if archive_flag: cmd_tokens.append(archive_flag)
        cmd_tokens.append('-v')
        if compress_flag: cmd_tokens.append(compress_flag)
        if dry_flag: cmd_tokens.append(dry_flag)
        cmd_tokens.append('--stats')
        if delete_flag: cmd_tokens.append(delete_flag)
        for ex in exclude_items:
            if ex.strip():
                cmd_tokens.append(f"--exclude={ex.strip()}")
        cmd_tokens.extend(['-e', ssh_opts, src, dst])

        proc = subprocess.Popen(
            cmd_tokens,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            start_new_session=True
        )
        stdout, stderr = proc.communicate(timeout=120 if not is_dry_run else 30)
        code = proc.returncode

        display_cmd = f"rsync {archive_flag} -v {compress_flag} {dry_flag} --stats {delete_flag} {exclude_str} -e 'ssh -p {server.port}' {src} {dst}"
        return code, stdout or '', stderr or '', display_cmd

    except subprocess.TimeoutExpired:
        if proc:
            proc.kill()
        return -1, '', 'Transfer timed out after sustained operation.', 'rsync'
    except Exception as e:
        return -1, '', str(e), 'rsync'
    finally:
        for fpath in temp_files_to_clean:
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
            except Exception:
                pass

def parse_rsync_stats(stdout: str):
    files_to_sync = []
    lines = (stdout or '').splitlines()
    in_file_list = False
    stats_started = False
    stats_data = {}

    for line in lines:
        line_s = line.strip()
        if not line_s:
            continue
        if 'sending incremental file list' in line_s or 'receiving incremental file list' in line_s:
            in_file_list = True
            continue
        if line_s.startswith('Number of files:'):
            in_file_list = False
            stats_started = True

        if in_file_list:
            if not line_s.endswith('/'):
                files_to_sync.append(line_s)
        elif stats_started:
            if ':' in line_s:
                k, v = line_s.split(':', 1)
                stats_data[k.strip().lower().replace(' ', '_')] = v.strip()

    return files_to_sync, stats_data

@sync_bp.route('/api/servers/<int:server_id>/sync/preview', methods=['POST'])
@login_required
def rsync_preview(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    sync_mode = data.get('sync_mode', 'server_server')

    if sync_mode == 'local_remote':
        direction = data.get('direction', 'push')
        local_path = sanitize_path(data.get('local_path', ''))
        remote_path = sanitize_path(data.get('remote_path', ''))
        if not local_path or not remote_path:
            return jsonify({'success': False, 'error': 'Both local and remote paths are required.'}), 400
        
        local_path = os.path.expanduser(local_path)
        if direction == 'push':
            src = local_path
            dst = f"{server.username}@{server.host}:{remote_path}"
        else:
            src = f"{server.username}@{server.host}:{remote_path}"
            dst = local_path
        is_local_remote = True
    else:
        src = sanitize_path(data.get('src_path', ''))
        dst = sanitize_path(data.get('dst_path', ''))
        if not src or not dst:
            return jsonify({'success': False, 'error': 'Both source and destination server paths are required.'}), 400
        is_local_remote = False

    code, stdout, stderr, cmd = execute_rsync_operation(
        server=server,
        src=src,
        dst=dst,
        is_local_remote=is_local_remote,
        is_dry_run=True,
        opts=data.get('options', {}),
        excludes=data.get('excludes', [])
    )

    files_to_sync, stats_data = parse_rsync_stats(stdout)
    output = (stdout + "\n" + stderr).strip()

    return jsonify({
        'success': code == 0,
        'command': cmd,
        'files': files_to_sync[:200],
        'total_files_count': len(files_to_sync),
        'stats': stats_data,
        'raw_output': output,
        'exit_code': code,
        'error': stderr if code != 0 else None
    })

@sync_bp.route('/api/servers/<int:server_id>/sync/execute', methods=['POST'])
@login_required
def rsync_execute(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    sync_mode = data.get('sync_mode', 'server_server')

    if sync_mode == 'local_remote':
        direction = data.get('direction', 'push')
        local_path = sanitize_path(data.get('local_path', ''))
        remote_path = sanitize_path(data.get('remote_path', ''))
        if not local_path or not remote_path:
            return jsonify({'success': False, 'error': 'Both local and remote paths are required.'}), 400
        
        local_path = os.path.expanduser(local_path)
        if direction == 'push':
            src = local_path
            dst = f"{server.username}@{server.host}:{remote_path}"
        else:
            src = f"{server.username}@{server.host}:{remote_path}"
            dst = local_path
        is_local_remote = True
    else:
        src = sanitize_path(data.get('src_path', ''))
        dst = sanitize_path(data.get('dst_path', ''))
        if not src or not dst:
            return jsonify({'success': False, 'error': 'Both source and destination server paths are required.'}), 400
        is_local_remote = False

    code, stdout, stderr, cmd = execute_rsync_operation(
        server=server,
        src=src,
        dst=dst,
        is_local_remote=is_local_remote,
        is_dry_run=False,
        opts=data.get('options', {}),
        excludes=data.get('excludes', [])
    )

    output = (stdout + "\n" + stderr).strip()

    return jsonify({
        'success': code == 0,
        'command': cmd,
        'raw_output': output,
        'exit_code': code,
        'error': stderr if code != 0 else None
    })

@sync_bp.route('/api/sync/local-dirs', methods=['GET'])
@login_required
def list_local_dirs():
    req_path = request.args.get('path', '~').strip()
    if not req_path:
        req_path = '~'
    expanded = os.path.expanduser(req_path)
    full_path = os.path.abspath(expanded)
    if not os.path.exists(full_path):
        full_path = os.path.expanduser('~')
    if not os.path.isdir(full_path):
        full_path = os.path.dirname(full_path)

    try:
        items = []
        with os.scandir(full_path) as entries:
            for entry in entries:
                try:
                    if entry.is_dir(follow_symlinks=False):
                        items.append({
                            'name': entry.name,
                            'path': entry.path,
                            'is_dir': True
                        })
                except (PermissionError, OSError):
                    continue
        
        # Sort folders alphabetically, regular folders first then dot folders
        items.sort(key=lambda x: (x['name'].startswith('.'), x['name'].lower()))
        parent_path = os.path.dirname(full_path)
        return jsonify({
            'success': True,
            'data': {
                'current_path': full_path,
                'parent_path': parent_path if parent_path != full_path else None,
                'items': items
            }
        })
    except PermissionError as e:
        return jsonify({'success': False, 'error': f'Permission denied: {e}'}), 403
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@sync_bp.route('/api/sync/local-dirs/create', methods=['POST'])
@login_required
def create_local_dir():
    data = request.json or {}
    path = data.get('path', '').strip()
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400
    expanded = os.path.expanduser(path)
    full_path = os.path.abspath(expanded)
    try:
        os.makedirs(full_path, exist_ok=True)
        return jsonify({'success': True, 'path': full_path})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400
