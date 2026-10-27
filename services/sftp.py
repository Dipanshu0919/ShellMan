import os
import stat
import io
import shutil
import tempfile
import threading
import time
import shlex
import json
from typing import List, Dict, Any, Tuple

import logging
import paramiko

from services.ssh_manager import ssh_manager
from services.progress_tracker import ProgressTracker


logger = logging.getLogger('shellman.sftp')


def format_bytes(size: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(size) < 1024.0:
            return f"{size:3.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"

class SFTPService:
    """
    Paramiko SFTP operations wrapper with real byte-counting progress tracking.
    """

    @staticmethod
    def _normalize_path(path: str, server=None) -> str:
        if not path or not path.strip() or path in ('~', '~/'):
            if server:
                return '/root' if server.username == 'root' else f'/home/{server.username}'
            return '/'
        path = path.strip()
        if path.startswith('~/'):
            home = '/root' if (server and server.username == 'root') else f'/home/{server.username if server else "user"}'
            path = home + path[1:]
        elif path == '~':
            return '/root' if (server and server.username == 'root') else f'/home/{server.username if server else "user"}'

        # Eliminate consecutive slashes (e.g. //home -> /home) which POSIX normpath preserves
        import re
        path = re.sub(r'/+', '/', path)
        path = os.path.normpath(path)
        if not path.startswith("/"):
            path = "/" + path
        return path

    @classmethod
    def _get_remote_size(cls, server, paths: List[str]) -> int:
        """Returns total size in bytes of given paths using du -sb -c."""
        if not paths:
            return 0
        quoted = " ".join(shlex.quote(p) for p in paths)
        cmd = f"du -sb -c -- {quoted} 2>/dev/null | tail -n 1 | cut -f 1"
        code, stdout, _ = ssh_manager.execute(server, cmd, timeout=15)
        if code == 0 and stdout.strip().isdigit():
            return int(stdout.strip())
        return 0

    @classmethod
    def _list_dir_via_ssh(cls, server, path: str) -> Tuple[bool, Any]:
        """
        Robust fallback directory listing via SSH shell command when SFTP fails
        (e.g., permission boundaries, broken SFTP channel, symlinks, or special paths).
        """
        py_script = (
            "import os, stat, time, json, sys\n"
            "p = sys.argv[1]\n"
            "try:\n"
            "    entries = list(os.scandir(p))\n"
            "except Exception as e:\n"
            "    sys.exit(2)\n"
            "items = []\n"
            "for e in entries:\n"
            "    try:\n"
            "        st = e.stat(follow_symlinks=False)\n"
            "        is_dir = e.is_dir(follow_symlinks=True)\n"
            "        is_link = e.is_symlink()\n"
            "        mode_str = stat.filemode(st.st_mode)\n"
            "        mtime_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(st.st_mtime))\n"
            "        items.append({\n"
            "            'name': e.name,\n"
            "            'path': os.path.normpath(os.path.join(p, e.name)),\n"
            "            'is_dir': is_dir,\n"
            "            'is_link': is_link,\n"
            "            'size': st.st_size if not is_dir else None,\n"
            "            'size_formatted': '-' if is_dir else str(st.st_size),\n"
            "            'permissions': mode_str,\n"
            "            'mtime': mtime_str,\n"
            "            'owner': str(st.st_uid),\n"
            "            'group': str(st.st_gid)\n"
            "        })\n"
            "    except Exception:\n"
            "        pass\n"
            "items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))\n"
            "parent = os.path.dirname(p) if p != '/' else None\n"
            "print(json.dumps({'current_path': p, 'parent_path': parent, 'items': items}))\n"
        )
        quoted_path = shlex.quote(path)
        cmd = f"python3 -c {shlex.quote(py_script)} {quoted_path}"
        code, stdout, _ = ssh_manager.execute(server, cmd, timeout=12)
        if code == 0 and stdout.strip():
            try:
                data = json.loads(stdout.strip())
                for item in data.get('items', []):
                    if item.get('size') is not None:
                        item['size_formatted'] = format_bytes(item['size'])
                return True, data
            except Exception:
                pass

        # If python3 fails (or python3 is not available), fallback to standard POSIX ls
        ls_cmd = f"ls -la --time-style=+%Y-%m-%d\\ %H:%M:%S -- {quoted_path} 2>/dev/null || sudo -n ls -la --time-style=+%Y-%m-%d\\ %H:%M:%S -- {quoted_path} 2>/dev/null"
        code, stdout, _ = ssh_manager.execute(server, ls_cmd, timeout=12)
        if code == 0 and stdout.strip():
            items = []
            for line in stdout.strip().splitlines():
                parts = line.split()
                if len(parts) >= 8 and parts[0] != 'total':
                    perms = parts[0]
                    owner = parts[2]
                    group = parts[3]
                    size_str = parts[4]
                    date_str = f"{parts[5]} {parts[6]}"
                    name = " ".join(parts[7:])
                    if name in ('.', '..'):
                        continue
                    is_dir = perms.startswith('d')
                    is_link = perms.startswith('l')
                    clean_name = name.split(' -> ')[0] if is_link else name
                    item_path = os.path.normpath(os.path.join(path, clean_name))
                    try:
                        sz = int(size_str)
                    except ValueError:
                        sz = 0
                    items.append({
                        'name': clean_name,
                        'path': item_path,
                        'is_dir': is_dir,
                        'is_link': is_link,
                        'size': sz if not is_dir else None,
                        'size_formatted': format_bytes(sz) if not is_dir else '-',
                        'permissions': perms,
                        'mtime': date_str,
                        'owner': owner,
                        'group': group,
                    })
            items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
            parent_path = os.path.dirname(path) if path != '/' else None
            return True, {
                'current_path': path,
                'parent_path': parent_path,
                'items': items
            }

        return False, f"Cannot open directory {path}: Permission denied or directory not found"

    @classmethod
    def list_dir(cls, server, path: str = "/") -> Tuple[bool, Any]:
        path = cls._normalize_path(path, server)
        server_user = getattr(server, 'username', 'user') if server else 'user'
        try:
            with ssh_manager.sftp_context(server) as sftp:
                try:
                    entries = sftp.listdir_attr(path)
                except Exception as e:
                    logger.warning(f"SFTP listdir_attr failed on {path}: {e}, falling back to SSH shell")
                    return cls._list_dir_via_ssh(server, path)

                items = []
                for attr in entries:
                    is_dir = stat.S_ISDIR(attr.st_mode)
                    is_link = stat.S_ISLNK(attr.st_mode)
                    mode_str = stat.filemode(attr.st_mode)
                    item_path = os.path.normpath(os.path.join(path, attr.filename))

                    # If symlink, resolve whether it targets a directory
                    if is_link:
                        try:
                            target_st = sftp.stat(item_path)
                            if stat.S_ISDIR(target_st.st_mode):
                                is_dir = True
                        except Exception:
                            pass

                    mtime_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(attr.st_mtime))
                    owner_name = 'root' if attr.st_uid == 0 else server_user
                    group_name = 'root' if attr.st_gid == 0 else server_user

                    items.append({
                        'name': attr.filename,
                        'path': item_path,
                        'is_dir': is_dir,
                        'is_link': is_link,
                        'size': attr.st_size if not is_dir else None,
                        'size_formatted': format_bytes(attr.st_size) if not is_dir else '-',
                        'permissions': mode_str,
                        'mtime': mtime_str,
                        'owner': owner_name,
                        'group': group_name,
                    })

                items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
                parent_path = os.path.dirname(path) if path != '/' else None
                return True, {
                    'current_path': path,
                    'parent_path': parent_path,
                    'items': items
                }
        except Exception as e:
            logger.warning(f"SFTP context failed for {path}: {e}, falling back to SSH shell")
            return cls._list_dir_via_ssh(server, path)

    @classmethod
    def stat_item(cls, server, path: str) -> Tuple[bool, Any]:
        path = cls._normalize_path(path, server)
        server_user = getattr(server, 'username', 'user') if server else 'user'
        try:
            with ssh_manager.sftp_context(server) as sftp:
                attr = sftp.stat(path)
                is_dir = stat.S_ISDIR(attr.st_mode)
                is_link = stat.S_ISLNK(attr.st_mode)
                mode_str = stat.filemode(attr.st_mode)
                name = os.path.basename(path) or '/'
                mtime_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(attr.st_mtime))
                owner_name = 'root' if attr.st_uid == 0 else server_user
                group_name = 'root' if attr.st_gid == 0 else server_user

                items_count = None
                if is_dir:
                    try:
                        items_count = len(sftp.listdir(path))
                    except Exception:
                        items_count = None

                return True, {
                    'name': name,
                    'path': path,
                    'is_dir': is_dir,
                    'is_link': is_link,
                    'size': attr.st_size if not is_dir else None,
                    'size_formatted': format_bytes(attr.st_size) if not is_dir else '-',
                    'permissions': mode_str,
                    'mtime': mtime_str,
                    'owner': owner_name,
                    'group': group_name,
                    'items_count': items_count
                }
        except Exception as e:
            return False, f"Cannot stat {path}: {str(e)}"

    @classmethod
    def read_file(cls, server, file_path: str, max_bytes: int = 5 * 1024 * 1024) -> Tuple[bool, Any]:
        file_path = cls._normalize_path(file_path, server)
        try:
            with ssh_manager.sftp_context(server) as sftp:
                attr = sftp.stat(file_path)
                if stat.S_ISDIR(attr.st_mode):
                    return False, "Target is a directory, not a file"
                if attr.st_size > max_bytes:
                    return False, f"File size ({format_bytes(attr.st_size)}) exceeds editable limit (5MB)"

                with sftp.open(file_path, 'rb') as f:
                    content_bytes = f.read()

                try:
                    content_str = content_bytes.decode('utf-8')
                except UnicodeDecodeError:
                    content_str = content_bytes.decode('latin1', errors='replace')

                return True, {
                    'path': file_path,
                    'name': os.path.basename(file_path),
                    'size': attr.st_size,
                    'content': content_str,
                    'permissions': stat.filemode(attr.st_mode)
                }
        except Exception as e:
            return False, f"Read error: {str(e)}"

    @classmethod
    def write_file(cls, server, file_path: str, content: str) -> Tuple[bool, str]:
        file_path = cls._normalize_path(file_path, server)
        try:
            with ssh_manager.sftp_context(server) as sftp:
                content_bytes = content.encode('utf-8')
                with sftp.open(file_path, 'wb') as f:
                    f.write(content_bytes)
                return True, f"File saved successfully ({len(content_bytes)} bytes)"
        except Exception as e:
            return False, f"Write error: {str(e)}"

    @classmethod
    def create_file(cls, server, file_path: str) -> Tuple[bool, str]:
        file_path = cls._normalize_path(file_path, server)
        try:
            with ssh_manager.sftp_context(server) as sftp:
                with sftp.open(file_path, 'wx') as f:
                    f.write(b"")
                return True, "File created"
        except Exception as e:
            return False, f"Failed to create file: {str(e)}"

    @classmethod
    def create_dir(cls, server, dir_path: str) -> Tuple[bool, str]:
        dir_path = cls._normalize_path(dir_path, server)
        try:
            with ssh_manager.sftp_context(server) as sftp:
                sftp.mkdir(dir_path)
                return True, "Directory created"
        except Exception as e:
            return False, f"Failed to create directory: {str(e)}"

    @classmethod
    def rename(cls, server, old_path: str, new_path: str) -> Tuple[bool, str]:
        old_path = cls._normalize_path(old_path, server)
        new_path = cls._normalize_path(new_path, server)
        try:
            with ssh_manager.sftp_context(server) as sftp:
                sftp.rename(old_path, new_path)
                return True, "Renamed successfully"
        except Exception:
            code, out, err = ssh_manager.execute(server, f"mv -- {shlex.quote(old_path)} {shlex.quote(new_path)}")
            if code == 0:
                return True, "Renamed successfully"
            return False, err or out or "Rename failed"

    @classmethod
    def delete(cls, server, path: str, is_dir: bool = False) -> Tuple[bool, str]:
        path = cls._normalize_path(path, server)
        if path == "/":
            return False, "Refusing to delete root directory"
        try:
            if is_dir:
                code, out, err = ssh_manager.execute(server, f"rm -rf -- {shlex.quote(path)}")
                if code == 0:
                    return True, "Directory deleted"
                return False, err or out
            else:
                with ssh_manager.sftp_context(server) as sftp:
                    sftp.remove(path)
                    return True, "File deleted"
        except Exception as e:
            return False, f"Delete failed: {str(e)}"

    @classmethod
    def delete_multiple(cls, server, paths: List[str]) -> Tuple[bool, str]:
        if not paths:
            return False, "No items selected to delete"
        clean_paths = []
        for p in paths:
            norm = cls._normalize_path(p, server)
            if norm in ('/', '/root', '/home', '/bin', '/usr', '/etc', '/lib', '/boot', '/var'):
                return False, f"Refusing to delete protected system directory: {norm}"
            clean_paths.append(norm)

        quoted = " ".join(shlex.quote(p) for p in clean_paths)
        code, out, err = ssh_manager.execute(server, f"rm -rf -- {quoted}")
        if code == 0:
            return True, f"Successfully deleted {len(clean_paths)} item(s)"
        return False, err or out or "Batch deletion failed"

    @classmethod
    def _run_task_cmd(cls, server, cmd: str, timeout: int, task_id: str = None):
        """Run a command that can be cancelled through its progress task id."""
        if not task_id:
            return ssh_manager.execute(server, cmd, timeout=timeout)
        return ssh_manager.execute(
            server, ssh_manager.mark_command(cmd, task_id), timeout=timeout,
            cancel_check=lambda: ProgressTracker.is_cancelled(task_id),
            on_cancel=lambda client: client.exec_command(ssh_manager.kill_script(task_id)))

    @classmethod
    def move_multiple(cls, server, paths: List[str], dest_dir: str, task_id: str = None) -> Tuple[bool, str]:
        if not paths:
            return False, "No items selected to move"
        dest_dir = cls._normalize_path(dest_dir, server)
        clean_paths = [cls._normalize_path(p, server) for p in paths]

        total_size = cls._get_remote_size(server, clean_paths)
        if task_id:
            ProgressTracker.create_task(task_id, f"Moving {len(paths)} items", total_size)

        quoted_dest = shlex.quote(dest_dir)
        quoted_sources = " ".join(shlex.quote(p) for p in clean_paths)

        cmd = f"mv -t {quoted_dest} -- {quoted_sources} 2>&1"
        code, out, err = cls._run_task_cmd(server, cmd, 600, task_id)
        if code == -2 and task_id:
            ProgressTracker.cancel_done(task_id)
            return False, "Cancelled"

        if task_id:
            if code == 0:
                ProgressTracker.update(task_id, total_size, total_size)
                ProgressTracker.complete(task_id)
            else:
                ProgressTracker.complete(task_id, error=err or out or "Move failed")

        if code == 0:
            return True, f"Successfully moved {len(clean_paths)} item(s) to {dest_dir}"
        return False, err or out or f"Failed to move items into destination {dest_dir}"

    @classmethod
    def copy_multiple(cls, server, paths: List[str], dest_dir: str, task_id: str = None) -> Tuple[bool, str]:
        if not paths:
            return False, "No items selected to copy"
        dest_dir = cls._normalize_path(dest_dir, server)
        clean_paths = [cls._normalize_path(p, server) for p in paths]

        total_size = cls._get_remote_size(server, clean_paths)
        if task_id:
            ProgressTracker.create_task(task_id, f"Copying {len(paths)} items", total_size)

        quoted_dest = shlex.quote(dest_dir)
        quoted_sources = " ".join(shlex.quote(p) for p in clean_paths)

        cmd = (
            f"if command -v rsync >/dev/null 2>&1; then "
            f"rsync -a --info=progress2 -- {quoted_sources} {quoted_dest} 2>&1; "
            f"else cp -r --target-directory={quoted_dest} -- {quoted_sources} 2>&1; fi"
        )
        code, out, err = cls._run_task_cmd(server, cmd, 1800, task_id)
        if code == -2 and task_id:
            ProgressTracker.cancel_done(task_id)
            return False, "Cancelled"

        if task_id:
            if code == 0:
                ProgressTracker.update(task_id, total_size, total_size)
                ProgressTracker.complete(task_id)
            else:
                ProgressTracker.complete(task_id, error=err or out or "Copy failed")

        if code == 0:
            return True, f"Successfully copied {len(clean_paths)} item(s) to {dest_dir}"
        return False, err or out or f"Failed to copy items into destination {dest_dir}"

    @classmethod
    def chmod_multiple(cls, server, paths: List[str], mode: str, recursive: bool = False) -> Tuple[bool, str]:
        if not paths:
            return False, "No items selected"
        mode = mode.strip()
        if not mode.isalnum() or len(mode) not in (3, 4):
            return False, "Invalid permission mode (e.g. 644, 755)"
        clean_paths = [cls._normalize_path(p, server) for p in paths]
        rec_flag = "-R " if recursive else ""
        quoted_sources = " ".join(shlex.quote(p) for p in clean_paths)
        cmd = f"chmod {rec_flag}{shlex.quote(mode)} -- {quoted_sources}"
        code, out, err = ssh_manager.execute(server, cmd)
        if code == 0:
            return True, f"Permissions set to {mode} for {len(clean_paths)} item(s)"
        return False, err or out or "Failed to change permissions"

    # ── Archive exclusion helpers ─────────────────────────────────────────
    @staticmethod
    def _clean_excludes(patterns) -> List[str]:
        out = []
        for p in (patterns or []):
            if not isinstance(p, str):
                continue
            p = p.strip().replace('\\', '/')
            if not p or '\n' in p or '\0' in p or len(p) > 300 or p.startswith('..') or '/../' in p:
                continue
            p = p.lstrip('/')
            if p not in out:
                out.append(p)
        return out[:500]

    @staticmethod
    def _is_excluded(rel_path: str, excludes: List[str]) -> bool:
        """Same matching the zip/tar commands use: a pattern with no '/' matches any path
        component; a pattern with '/' matches a path prefix. '*' crosses '/' like tar and zip."""
        import fnmatch
        parts = [x for x in rel_path.strip('/').split('/') if x]
        for ex in excludes:
            ex = ex.rstrip('/')
            if not ex:
                continue
            anchored = '/' in ex
            for j in range(1, len(parts) + 1):
                if anchored:
                    if fnmatch.fnmatchcase('/'.join(parts[:j]), ex):
                        return True
                else:
                    for i in range(j):
                        if fnmatch.fnmatchcase('/'.join(parts[i:j]), ex):
                            return True
        return False

    @staticmethod
    def _parse_gitignore(text: str, rel_dir: str) -> Tuple[List[str], int]:
        """Convert .gitignore text to exclude patterns relative to the archive root."""
        out: List[str] = []
        skipped = 0
        for raw in text.splitlines():
            line = raw.rstrip()
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            if line.startswith('!'):
                skipped += 1
                continue
            line = line.strip()
            anchored = line.startswith('/') or ('/' in line.rstrip('/'))
            line = line.strip('/')
            if line.startswith('**/'):
                line = line[3:]
                anchored = '/' in line
            if not line:
                continue
            prefix = f"{rel_dir}/" if rel_dir and rel_dir != '.' else ''
            out.append(f"{prefix}{line}")
            if not anchored:
                out.append(f"{prefix}*/{line}")
        return out, skipped

    @classmethod
    def _gitignore_excludes(cls, server, clean_paths: List[str], max_files: int = 40, cancel_id: str = None, diag: Dict[str, Any] = None) -> Tuple[List[str], int, List[str]]:
        """Find .gitignore files inside the selected folders with ONE bounded `find` (heavy dirs
        pruned, depth-limited, timed out) and read them in the same command. No per-directory
        SFTP round trips and no per-server lock, so it is fast and never blocks other requests.
        Returns (patterns, skipped_negation_rules, gitignore_files_used)."""
        excludes: List[str] = []
        skipped = 0
        used: List[str] = []
        base_dir = os.path.dirname(clean_paths[0])
        quoted = " ".join(shlex.quote(p) for p in clean_paths)
        diag = diag if diag is not None else {}

        def run(cmd, timeout):
            try:
                code, out, err = ssh_manager.execute(server, cmd, timeout=timeout, use_lock=False)
            except Exception as e:
                diag['error'] = str(e)
                return None
            if code == -2:
                return None
            if code not in (0, 1, 124) and not out:
                diag['error'] = (err or '').strip()[:200] or f"exit {code}"
            return out

        # Step 1: list candidate .gitignore files. The top-level one is checked directly (cheap and
        # certain); the rest come from one bounded `find` with heavy folders pruned.
        list_cmd = (
            "T=''; command -v timeout >/dev/null 2>&1 && T='timeout 20'; "
            f"for d in {quoted}; do "
            "if [ -d \"$d\" ]; then "
            "[ -f \"$d/.gitignore\" ] && printf '%s\\n' \"$d/.gitignore\"; "
            "$T find \"$d\" -maxdepth 5 \\( -name node_modules -o -name .git -o -name .venv -o -name venv "
            "-o -name __pycache__ \\) -prune -o -name .gitignore -type f -print 2>/dev/null; "
            "fi; done"
        )
        out = run(list_cmd, 40)
        if out is None or ProgressTracker.is_cancelled(cancel_id):
            return [], 0, []
        files: List[str] = []
        for line in out.split('\n'):
            line = line.strip()
            if line.endswith('/.gitignore') and line not in files:
                files.append(line)
        files = files[:max_files]
        if not files:
            return [], 0, []

        # Step 2: read them all in one command.
        qfiles = " ".join(shlex.quote(f) for f in files)
        read_cmd = (
            f"for f in {qfiles}; do printf '@@SMFILE@@%s\\n' \"$f\"; "
            "head -c 524288 -- \"$f\" 2>/dev/null; printf '\\n'; done"
        )
        out = run(read_cmd, 30)
        if out is None or ProgressTracker.is_cancelled(cancel_id):
            return [], 0, []
        for chunk in out.split('@@SMFILE@@')[1:]:
            path, _, text = chunk.partition('\n')
            path = path.strip()
            rel_dir = os.path.relpath(os.path.dirname(path), base_dir).replace('\\', '/')
            used.append(os.path.join(rel_dir, '.gitignore'))
            ex, sk = cls._parse_gitignore(text, rel_dir)
            excludes += ex
            skipped += sk
        return cls._clean_excludes(excludes), skipped, used

    @classmethod
    def archive_options(cls, server, paths: List[str], cancel_id: str = None) -> Tuple[bool, Any]:
        """Fast listing for the Compress dialog: first-level children of every selected folder
        (one `find`, no lock, capped) and which folders have a top-level .gitignore.
        The recursive .gitignore search is separate and opt-in (archive_gitignore)."""
        if not paths:
            return False, "No items selected"
        clean_paths = [cls._normalize_path(p, server) for p in paths]
        base_dir = os.path.dirname(clean_paths[0])
        quoted = " ".join(shlex.quote(p) for p in clean_paths)
        script = (
            f"for p in {quoted}; do "
            "if [ -d \"$p\" ]; then printf 'D\\t%s\\n' \"$p\"; "
            "find \"$p\" -mindepth 1 -maxdepth 1 -printf '%y\\t%s\\t%f\\n' 2>/dev/null | head -n 400; "
            "elif [ -e \"$p\" ]; then printf 'F\\t%s\\n' \"$p\"; fi; done"
        )
        code, out, err = ssh_manager.execute(server, script, timeout=20, use_lock=False)
        if code == -2 or ProgressTracker.is_cancelled(cancel_id):
            ProgressTracker.clear_cancel(cancel_id)
            return False, "Cancelled"
        if code != 0 and not out:
            return False, f"Cannot read selection: {err.strip() or code}"
        groups: List[Dict[str, Any]] = []
        cur = None
        for line in out.split('\n'):
            if not line:
                continue
            parts = line.split('\t')
            if parts[0] in ('D', 'F') and len(parts) == 2:
                cur = {'name': os.path.basename(parts[1].rstrip('/')), 'path': parts[1], 'is_dir': parts[0] == 'D',
                       'children': [], 'truncated': False, 'has_gitignore': False}
                groups.append(cur)
            elif cur is not None and len(parts) >= 3:
                kind, size, name = parts[0], parts[1], '\t'.join(parts[2:])
                is_dir = kind == 'd'
                cur['children'].append({
                    'name': name, 'rel': f"{cur['name']}/{name}", 'is_dir': is_dir,
                    'size': 0 if is_dir else (int(size) if size.isdigit() else 0), 'gitignored': False,
                })
                if name == '.gitignore' and not is_dir:
                    cur['has_gitignore'] = True
        for g in groups:
            g['children'].sort(key=lambda c: (not c['is_dir'], c['name'].lower()))
            if len(g['children']) >= 400:
                g['truncated'] = True
        return True, {'groups': groups, 'base_dir': base_dir,
                      'has_gitignore': any(g['has_gitignore'] for g in groups)}

    @classmethod
    def archive_gitignore(cls, server, paths: List[str], rels: List[str] = None, cancel_id: str = None) -> Tuple[bool, Any]:
        """Opt-in .gitignore lookup. Returns the files used, rule count and which of `rels`
        (children shown in the dialog) the rules would skip."""
        if not paths:
            return False, "No items selected"
        clean_paths = [cls._normalize_path(p, server) for p in paths]
        diag: Dict[str, Any] = {}
        git_ex, skipped, used = cls._gitignore_excludes(server, clean_paths, cancel_id=cancel_id, diag=diag)
        if ProgressTracker.is_cancelled(cancel_id):
            ProgressTracker.clear_cancel(cancel_id)
            return False, "Cancelled"
        if diag.get('error') and not used:
            return False, f"Could not search for .gitignore: {diag['error']}"
        flagged = [r for r in (rels or [])[:5000] if cls._is_excluded(r, git_ex)]
        return True, {'gitignore_files': used, 'gitignore_rules': len(git_ex),
                      'skipped_negations': skipped, 'flagged': flagged}

    @classmethod
    def archive_multiple(cls, server, paths: List[str], dest_dir: str, archive_name: str, task_id: str = None,
                         exclude: List[str] = None, use_gitignore: bool = False) -> Tuple[bool, str]:
        if not paths:
            return False, "No items selected to archive"
        dest_dir = cls._normalize_path(dest_dir, server)
        clean_paths = [cls._normalize_path(p, server) for p in paths]
        if not archive_name or not archive_name.strip():
            archive_name = f"archive_{int(time.time())}.tar.gz"
        archive_name = archive_name.strip()
        archive_path = os.path.normpath(os.path.join(dest_dir, archive_name))

        if task_id:
            ProgressTracker.create_task(task_id, f"Compressing into {archive_name}")

        base_dir = os.path.dirname(clean_paths[0])
        sources = " ".join(shlex.quote(os.path.basename(p)) for p in clean_paths)

        # Exclusions: user checkboxes / patterns + optional .gitignore rules.
        excludes = cls._clean_excludes(exclude)
        git_note = ""
        if use_gitignore:
            git_ex, git_skipped, git_used = cls._gitignore_excludes(server, clean_paths, cancel_id=task_id)
            for g in git_ex:
                if g not in excludes:
                    excludes.append(g)
            if git_used:
                git_note = f" (.gitignore: {len(git_ex)} rules from {len(git_used)} file(s)" + (f", {git_skipped} '!' rules ignored)" if git_skipped else ")")
        # The archive itself must never end up inside itself.
        arc_rel = os.path.relpath(archive_path, base_dir)
        if not arc_rel.startswith('..'):
            excludes.append(arc_rel)

        tar_excl = " ".join(f"--exclude={shlex.quote(e)}" for e in excludes)
        zip_pats = []
        for e in excludes:
            e = e.rstrip('/')
            zip_pats += [e, e + '/*']
            if '/' not in e:
                zip_pats += ['*/' + e, '*/' + e + '/*']
        zip_excl = ("-x " + " ".join(shlex.quote(x) for x in zip_pats)) if zip_pats else ""
        py_excl = json.dumps(excludes)

        if archive_name.endswith('.zip'):
            # Real .zip only: use `zip` if installed, else a python3 zipfile script with DEFLATE
            # (note: `python3 -m zipfile -c` stores files UNCOMPRESSED, so we don't use it).
            qa = shlex.quote(archive_path)
            py_zip = (
                "import sys, os, zipfile, fnmatch, json\n"
                f"EX = json.loads({py_excl!r})\n"
                "def skip(rel):\n"
                "    parts = [x for x in rel.split('/') if x]\n"
                "    for ex in EX:\n"
                "        ex = ex.rstrip('/')\n"
                "        for j in range(1, len(parts) + 1):\n"
                "            if '/' in ex:\n"
                "                if fnmatch.fnmatchcase('/'.join(parts[:j]), ex): return True\n"
                "            else:\n"
                "                for i in range(j):\n"
                "                    if fnmatch.fnmatchcase('/'.join(parts[i:j]), ex): return True\n"
                "    return False\n"
                "out = sys.argv[1]\n"
                "with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as z:\n"
                "    for src in sys.argv[2:]:\n"
                "        if skip(src): continue\n"
                "        if os.path.isdir(src) and not os.path.islink(src):\n"
                "            z.write(src)\n"
                "            for r, ds, fs in os.walk(src):\n"
                "                ds[:] = [d for d in ds if not skip(os.path.join(r, d))]\n"
                "                for n in ds + fs:\n"
                "                    p = os.path.join(r, n)\n"
                "                    if skip(p): continue\n"
                "                    try:\n"
                "                        z.write(p)\n"
                "                    except OSError:\n"
                "                        pass\n"
                "        else:\n"
                "            z.write(src)\n"
            )
            cmd = (
                f"cd {shlex.quote(base_dir)} && rm -f {qa} && "
                f"if command -v zip >/dev/null 2>&1; then zip -qr {qa} {sources} {zip_excl}; "
                f"elif command -v python3 >/dev/null 2>&1; then python3 -c {shlex.quote(py_zip)} {qa} {sources}; "
                f"else echo 'Cannot create .zip: install zip (sudo apt install zip) or python3, or choose .tar.gz' >&2; exit 127; fi"
            )
        else:
            if not archive_name.endswith('.tar.gz') and not archive_name.endswith('.tgz') and not archive_name.endswith('.tar'):
                archive_name += '.tar.gz'
                archive_path += '.tar.gz'
            cmd = f"cd {shlex.quote(base_dir)} && tar {'-cf' if archive_name.endswith('.tar') else '-czf'} {shlex.quote(archive_path)} {tar_excl} {sources}"

        # tar/zip report no progress; watch the output folder and report the size of the
        # archive being written (real bytes, total unknown). zip writes to a temp file
        # ("zi" + random) in the destination folder and renames it at the end, so watch for
        # NEW files that either start with the archive name or look like a zip temp file.
        stop_watch = threading.Event()
        if task_id:
            def _watch_archive():
                base = os.path.basename(archive_path)
                while not stop_watch.is_set():
                    try:
                        with ssh_manager.sftp_context(server) as w_sftp:
                            best = 0
                            for a in w_sftp.listdir_attr(dest_dir):
                                n = a.filename
                                is_target = (n == base)
                                is_new_candidate = (n.startswith(base) or (n.startswith('zi') and len(n) <= 10))
                                if (is_target or is_new_candidate) and not stat.S_ISDIR(a.st_mode):
                                    best = max(best, a.st_size)
                            if best:
                                ProgressTracker.update(task_id, best)
                    except Exception:
                        pass
                    stop_watch.wait(0.5)
            threading.Thread(target=_watch_archive, daemon=True).start()

        def _kill_remote(client):
            # Stop the running tar/zip/python (its command line contains the archive path)
            # and remove the half-written archive.
            q = shlex.quote(archive_path)
            client.exec_command(f"pkill -f -- {q}; sleep 0.3; rm -f {q}")

        try:
            code, out, err = ssh_manager.execute(
                server, cmd, timeout=1800,
                cancel_check=(lambda: ProgressTracker.is_cancelled(task_id)) if task_id else None,
                on_cancel=_kill_remote)
        finally:
            stop_watch.set()

        if task_id and ProgressTracker.is_cancelled(task_id):
            ProgressTracker.clear_cancel(task_id)
            ProgressTracker.cancel_done(task_id)
            return False, "Cancelled"

        if task_id:
            if code == 0:
                ProgressTracker.complete(task_id)
            else:
                ProgressTracker.complete(task_id, error=err or out or "Compression failed")

        if code == 0:
            n_ex = len(excludes) - (0 if arc_rel.startswith('..') else 1)
            return True, f"Created archive: {archive_name}" + (f" ({n_ex} exclusion rule(s) applied)" if n_ex > 0 else "") + git_note
        return False, err or out or "Failed to create archive"

    @classmethod
    def extract_archive(cls, server, archive_path: str, dest_dir: str = None) -> Tuple[bool, str]:
        archive_path = cls._normalize_path(archive_path, server)
        if not dest_dir:
            dest_dir = os.path.dirname(archive_path)
        dest_dir = cls._normalize_path(dest_dir, server)

        quoted_dest = shlex.quote(dest_dir)
        quoted_archive = shlex.quote(archive_path)

        lower_path = archive_path.lower()
        if lower_path.endswith('.zip'):
            cmd = f"test -d {quoted_dest} || mkdir -p {quoted_dest}; (which unzip >/dev/null && unzip -q -o {quoted_archive} -d {quoted_dest}) || python3 -c \"import zipfile; zipfile.ZipFile('{archive_path}').extractall('{dest_dir}')\""
        elif lower_path.endswith('.tar.gz') or lower_path.endswith('.tgz') or lower_path.endswith('.gz'):
            cmd = f"test -d {quoted_dest} || mkdir -p {quoted_dest}; tar -xzf {quoted_archive} -C {quoted_dest}"
        elif lower_path.endswith('.tar'):
            cmd = f"test -d {quoted_dest} || mkdir -p {quoted_dest}; tar -xf {quoted_archive} -C {quoted_dest}"
        else:
            return False, "Unsupported archive format (supports .zip, .tar.gz, .tgz, .tar, .gz)"

        code, out, err = ssh_manager.execute(server, cmd, timeout=300)
        if code == 0:
            return True, f"Extracted {os.path.basename(archive_path)} to {dest_dir}"
        return False, err or out or "Failed to extract archive"

    @classmethod
    def _ensure_remote_dir(cls, server, sftp, dir_path: str):
        if not dir_path or dir_path == '/':
            return
        try:
            sftp.stat(dir_path)
            return
        except Exception:
            pass
        try:
            code, _, _ = ssh_manager.execute(server, f"mkdir -p -- {shlex.quote(dir_path)}")
            if code == 0:
                return
        except Exception:
            pass
        parts = [p for p in dir_path.split('/') if p]
        curr = ""
        for p in parts:
            curr += "/" + p
            try:
                sftp.stat(curr)
            except Exception:
                try:
                    sftp.mkdir(curr)
                except Exception:
                    pass

    @classmethod
    def _open_fast_sftp(cls, server):
        """
        Opens a DEDICATED SFTP channel with a large window for uploads.
        Caller must close it. Falls back to a plain client.open_sftp().
        """
        client = ssh_manager.get_client(server)
        try:
            transport = client.get_transport()
            fast = paramiko.SFTPClient.from_transport(
                transport,
                window_size=16 * 1024 * 1024,
                max_packet_size=32768,
            )
            if fast is not None:
                return fast, True
        except Exception:
            pass
        return client.open_sftp(), True

    @classmethod
    def _upload_batch_via_tar(
        cls,
        server,
        dest_dir: str,
        files_data: List[Tuple[str, Any]],
        overwrite: bool = True,
        task_id: str = None
    ) -> Tuple[bool, int, List[str]]:
        import tarfile

        dest_dir = cls._normalize_path(dest_dir, server)
        total_files = len(files_data)
        uploaded_count = 0
        errors = []

        lock = ssh_manager._get_server_lock(server.id)
        with lock:
            try:
                client = ssh_manager.get_client(server)
                transport = client.get_transport()
                if not transport or not transport.is_active():
                    client = ssh_manager.get_client(server, force_new=True)
                    transport = client.get_transport()

                quoted_dest = shlex.quote(dest_dir)
                tar_flags = "-xf - -C" if overwrite else "-xkf - -C"
                remote_cmd = f"mkdir -p -- {quoted_dest} && tar --no-same-owner {tar_flags} {quoted_dest}"

                session = transport.open_session(timeout=120)
                session.exec_command(remote_cmd)
                stdin = session.makefile('wb', 1024 * 1024)

                with tarfile.open(fileobj=stdin, mode='w|') as tar:
                    for rel_path, file_obj in files_data:
                        if task_id and ProgressTracker.is_cancelled(task_id):
                            errors.append("Cancelled")
                            break
                        try:
                            clean_rel = rel_path.lstrip('/\\').replace('\\', '/')
                            file_obj.seek(0, os.SEEK_END)
                            sz = file_obj.tell()
                            file_obj.seek(0)

                            ti = tarfile.TarInfo(name=clean_rel)
                            ti.size = sz
                            ti.mtime = int(time.time())
                            ti.mode = 0o644

                            tar.addfile(ti, file_obj)
                            uploaded_count += 1
                            if task_id:
                                ProgressTracker.update(task_id, uploaded_count, total_files)
                        except Exception as e:
                            errors.append(f"{rel_path}: {e}")

                stdin.close()
                exit_code = session.recv_exit_status()
                session.close()

                if exit_code != 0:
                    logger.warning(f"Tar stream returned exit code {exit_code}, falling back to SFTP batch")
                    for _, f_obj in files_data:
                        try:
                            f_obj.seek(0)
                        except Exception:
                            pass
                    return cls._upload_batch_via_sftp(server, dest_dir, files_data, overwrite, task_id)

                if task_id:
                    ProgressTracker.complete(task_id)

                return True, uploaded_count, errors

            except Exception as e:
                logger.warning(f"Tar stream failed ({e}), falling back to SFTP batch")
                for _, f_obj in files_data:
                    try:
                        f_obj.seek(0)
                    except Exception:
                        pass
                return cls._upload_batch_via_sftp(server, dest_dir, files_data, overwrite, task_id)

    @classmethod
    def _upload_batch_via_sftp(
        cls,
        server,
        dest_dir: str,
        files_data: List[Tuple[str, Any]],
        overwrite: bool = True,
        task_id: str = None
    ) -> Tuple[bool, int, List[str]]:
        dest_dir = cls._normalize_path(dest_dir, server)
        total_files = len(files_data)
        uploaded_count = 0
        errors = []
        known_dirs = {dest_dir}

        try:
            with ssh_manager.sftp_context(server) as sftp:
                try:
                    sftp.stat(dest_dir)
                except Exception:
                    cls._ensure_remote_dir(server, sftp, dest_dir)

                for rel_path, file_obj in files_data:
                    clean_rel = rel_path.lstrip('/\\')
                    target_path = os.path.normpath(os.path.join(dest_dir, clean_rel))
                    target_dir = os.path.dirname(target_path)

                    if target_dir and target_dir not in known_dirs:
                        parts = [p for p in target_dir.split('/') if p]
                        cur = ""
                        for part in parts:
                            cur += "/" + part
                            if cur not in known_dirs:
                                try:
                                    sftp.stat(cur)
                                except Exception:
                                    try:
                                        sftp.mkdir(cur)
                                    except Exception:
                                        pass
                                known_dirs.add(cur)

                    try:
                        if not overwrite:
                            try:
                                sftp.stat(target_path)
                                continue
                            except Exception:
                                pass

                        file_obj.seek(0, os.SEEK_END)
                        sz = file_obj.tell()
                        file_obj.seek(0)

                        sftp.putfo(file_obj, target_path, file_size=sz, confirm=False)
                        uploaded_count += 1
                        if task_id:
                            ProgressTracker.update(task_id, uploaded_count, total_files)
                    except Exception as e:
                        errors.append(f"{clean_rel}: {str(e)}")

        except Exception as exc:
            errors.append(f"SFTP session failure: {str(exc)}")

        if task_id:
            if errors:
                ProgressTracker.complete(task_id, error=f"{len(errors)} error(s)")
            else:
                ProgressTracker.complete(task_id)

        all_ok = (len(errors) == 0)
        return all_ok, uploaded_count, errors

    @classmethod
    def upload_batch(
        cls,
        server,
        dest_dir: str,
        files_data: List[Tuple[str, Any]],
        overwrite: bool = True,
        task_id: str = None
    ) -> Tuple[bool, int, List[str]]:
        dest_dir = cls._normalize_path(dest_dir, server)
        total_files = len(files_data)
        if total_files == 0:
            return True, 0, []

        if task_id:
            ProgressTracker.create_task(task_id, f"Uploading {total_files} file(s)", total_files)

        # For batches or any upload with nested subdirectories, use ultra-fast SSH Tar pipeline
        has_subdirs = any('/' in rel.lstrip('/\\') or '\\' in rel for rel, _ in files_data)
        if total_files > 1 or has_subdirs:
            return cls._upload_batch_via_tar(server, dest_dir, files_data, overwrite=overwrite, task_id=task_id)

        return cls._upload_batch_via_sftp(server, dest_dir, files_data, overwrite=overwrite, task_id=task_id)

    @classmethod
    def upload_file(cls, server, remote_dir: str, filename: str, file_stream, overwrite: bool = True, task_id: str = None) -> Tuple[bool, str]:
        remote_dir = cls._normalize_path(remote_dir, server)
        clean_rel = filename.lstrip('/\\')
        target_path = os.path.normpath(os.path.join(remote_dir, clean_rel))

        try:
            # Step 1: Drain uploaded file to a local temp file (1 MB buffer).
            fd, temp_path = tempfile.mkstemp(prefix='shellman_upl_')
            os.close(fd)

            t_drain = time.monotonic()
            with open(temp_path, 'wb') as tmp:
                shutil.copyfileobj(file_stream, tmp, length=1024 * 1024)
            drain_s = max(time.monotonic() - t_drain, 1e-6)

            # Real total: exact byte size of the local temp file.
            total_size = os.path.getsize(temp_path)
            logger.info(f"[upload] drain {total_size/1e6:.1f} MB in {drain_s:.1f}s ({total_size/1e6/drain_s:.2f} MB/s)")

            if task_id:
                ProgressTracker.create_task(task_id, f"Uploading {filename}", total_size)

            # Step 2: Background thread does the actual SFTP write.
            def _background_sftp_upload():
                sftp = None
                owns_channel = False
                try:
                    sftp, owns_channel = cls._open_fast_sftp(server)

                    target_dir = os.path.dirname(target_path)
                    if target_dir and target_dir != remote_dir:
                        cls._ensure_remote_dir(server, sftp, target_dir)

                    if not overwrite:
                        exists = True
                        try:
                            sftp.stat(target_path)
                        except IOError:
                            exists = False
                        if exists:
                            raise FileExistsError(f"File '{filename}' already exists on remote server")

                    # Throttled progress: always uses the real local size as total.
                    last_push = [0.0]

                    def progress_callback(transferred, _paramiko_total):
                        if not task_id:
                            return
                        if ProgressTracker.is_cancelled(task_id):
                            raise InterruptedError("Cancelled")
                        now = time.monotonic()
                        if transferred >= total_size or (now - last_push[0]) >= 0.25:
                            last_push[0] = now
                            ProgressTracker.update(task_id, min(transferred, total_size), total_size)

                    t_sftp = time.monotonic()
                    with open(temp_path, 'rb') as local_f:
                        sftp.putfo(
                            local_f,
                            target_path,
                            file_size=total_size,
                            callback=progress_callback,
                            confirm=False,
                        )

                    sftp_s = max(time.monotonic() - t_sftp, 1e-6)
                    logger.info(f"[upload] sftp {total_size/1e6:.1f} MB in {sftp_s:.1f}s ({total_size/1e6/sftp_s:.2f} MB/s)")

                    if task_id:
                        ProgressTracker.update(task_id, total_size, total_size)
                        ProgressTracker.complete(task_id)

                except InterruptedError:
                    if task_id:
                        ProgressTracker.cancel_done(task_id)
                        ProgressTracker.clear_cancel(task_id)
                    try:
                        if sftp is not None:
                            sftp.remove(target_path)
                    except Exception:
                        pass
                except Exception as e:
                    if task_id:
                        ProgressTracker.complete(task_id, error=str(e))
                finally:
                    if sftp is not None and owns_channel:
                        try:
                            sftp.close()
                        except Exception:
                            pass
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass

            threading.Thread(target=_background_sftp_upload, daemon=True).start()

            return True, f"File {filename} queued for upload"

        except Exception as e:
            if task_id:
                ProgressTracker.complete(task_id, error=str(e))
            return False, f"Upload error: {str(e)}"

    @classmethod
    def download_file(cls, server, file_path: str):
        file_path = cls._normalize_path(file_path, server)
        _, sftp = ssh_manager.open_sftp(server)
        return sftp.open(file_path, 'rb')

    @classmethod
    def search_files(cls, server, base_path: str, query: str) -> Tuple[bool, Any]:
        base_path = cls._normalize_path(base_path, server)
        if not query or not query.strip():
            return False, "Query cannot be empty"
        query = query.strip().replace("'", "").replace('"', "").replace(';', '')
        quoted_path = shlex.quote(base_path)
        cmd = f"find {quoted_path} -maxdepth 4 -iname '*{query}*' 2>/dev/null | head -n 100"
        code, stdout, _ = ssh_manager.execute(server, cmd, timeout=6)
        results = []
        for line in stdout.splitlines():
            line = line.strip()
            if line:
                is_dir = line.endswith('/') or False
                results.append({
                    'name': os.path.basename(line.rstrip('/')),
                    'path': line,
                    'is_dir': is_dir
                })
        return True, results

    @classmethod
    def search_content(cls, server, base_path: str, query: str, file_pattern: str = None) -> Tuple[bool, Any]:
        base_path = cls._normalize_path(base_path, server)
        if not query or not query.strip():
            return False, "Query cannot be empty"

        safe_query = shlex.quote(query.strip())
        quoted_path = shlex.quote(base_path)

        excludes = "--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=venv --exclude-dir=.venv --exclude-dir=__pycache__ --exclude-dir=.cache"
        include_flag = f"--include={shlex.quote(file_pattern)}" if file_pattern and file_pattern.strip() else ""

        cmd = f"grep -rnI {excludes} {include_flag} -m 50 {safe_query} {quoted_path} 2>/dev/null | head -n 100"
        code, stdout, _ = ssh_manager.execute(server, cmd, timeout=8)

        results = []
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split(':', 2)
            if len(parts) >= 3:
                fpath = parts[0]
                line_no = parts[1]
                match_text = parts[2]
                results.append({
                    'path': fpath,
                    'line': line_no,
                    'text': match_text.strip()
                })
        return True, results

def shlex_quote(s: str) -> str:
    return shlex.quote(s)