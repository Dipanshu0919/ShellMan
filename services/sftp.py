import os
import stat
import io
import time
from typing import List, Dict, Any, Tuple
from services.ssh_manager import ssh_manager

def format_bytes(size: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if abs(size) < 1024.0:
            return f"{size:3.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"

class SFTPService:
    """
    Paramiko SFTP operations wrapper.
    Prevents path traversal and handles directory navigation, download, upload and editing.
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

        path = os.path.normpath(path)
        if not path.startswith("/"):
            path = "/" + path
        return path

    @classmethod
    def list_dir(cls, server, path: str = "/") -> Tuple[bool, Any]:
        """List contents of remote directory."""
        path = cls._normalize_path(path, server)
        try:
            _, sftp = ssh_manager.open_sftp(server)
            try:
                entries = sftp.listdir_attr(path)
            except IOError as e:
                # Might be a file or permission denied
                return False, f"Cannot open directory {path}: {str(e)}"

            items = []
            server_user = getattr(server, 'username', 'user') if server else 'user'
            for attr in entries:
                is_dir = stat.S_ISDIR(attr.st_mode)
                is_link = stat.S_ISLNK(attr.st_mode)
                mode_str = stat.filemode(attr.st_mode)
                item_path = os.path.normpath(os.path.join(path, attr.filename))
                
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

            # Sort: directories first, then alphabetical
            items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))

            parent_path = os.path.dirname(path) if path != '/' else None
            return True, {
                'current_path': path,
                'parent_path': parent_path,
                'items': items
            }
        except Exception as e:
            return False, f"SFTP error: {str(e)}"

    @classmethod
    def stat_item(cls, server, path: str) -> Tuple[bool, Any]:
        """Returns detailed stat metadata for a file or directory."""
        path = cls._normalize_path(path, server)
        server_user = getattr(server, 'username', 'user') if server else 'user'
        try:
            _, sftp = ssh_manager.open_sftp(server)
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
        """Reads file content for viewing/editing."""
        # FIX: pass server so '~' resolves against the actual SSH username
        file_path = cls._normalize_path(file_path, server)
        try:
            _, sftp = ssh_manager.open_sftp(server)
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
        """Writes content to a file via SFTP."""
        file_path = cls._normalize_path(file_path, server)
        try:
            _, sftp = ssh_manager.open_sftp(server)
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
            _, sftp = ssh_manager.open_sftp(server)
            with sftp.open(file_path, 'wx') as f:
                f.write(b"")
            return True, "File created"
        except Exception as e:
            return False, f"Failed to create file: {str(e)}"

    @classmethod
    def create_dir(cls, server, dir_path: str) -> Tuple[bool, str]:
        dir_path = cls._normalize_path(dir_path, server)
        try:
            _, sftp = ssh_manager.open_sftp(server)
            sftp.mkdir(dir_path)
            return True, "Directory created"
        except Exception as e:
            return False, f"Failed to create directory: {str(e)}"

    @classmethod
    def rename(cls, server, old_path: str, new_path: str) -> Tuple[bool, str]:
        old_path = cls._normalize_path(old_path, server)
        new_path = cls._normalize_path(new_path, server)
        try:
            _, sftp = ssh_manager.open_sftp(server)
            sftp.rename(old_path, new_path)
            return True, "Renamed successfully"
        except Exception:
            # Fallback to standard Linux mv command which handles POSIX renames reliably
            code, out, err = ssh_manager.execute(server, f"mv -- {shlex_quote(old_path)} {shlex_quote(new_path)}")
            if code == 0:
                return True, "Renamed successfully"
            return False, err or out or "Rename failed"

    @classmethod
    def delete(cls, server, path: str, is_dir: bool = False) -> Tuple[bool, str]:
        path = cls._normalize_path(path, server)
        if path == "/":
            return False, "Refusing to delete root directory"
        try:
            _, sftp = ssh_manager.open_sftp(server)
            if is_dir:
                # Use ssh command for recursive dir removal if needed, or rmdir
                # SFTP rmdir only works on empty dirs, so we can use rm -rf for non-empty
                code, out, err = ssh_manager.execute(server, f"rm -rf -- {shlex_quote(path)}")
                if code == 0:
                    return True, "Directory deleted"
                return False, err or out
            else:
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

        quoted = " ".join(shlex_quote(p) for p in clean_paths)
        code, out, err = ssh_manager.execute(server, f"rm -rf -- {quoted}")
        if code == 0:
            return True, f"Successfully deleted {len(clean_paths)} item(s)"
        return False, err or out or "Batch deletion failed"

    @classmethod
    def move_multiple(cls, server, paths: List[str], dest_dir: str) -> Tuple[bool, str]:
        if not paths:
            return False, "No items selected to move"
        dest_dir = cls._normalize_path(dest_dir, server)
        clean_paths = [cls._normalize_path(p, server) for p in paths]
        
        quoted_dest = shlex_quote(dest_dir)
        quoted_sources = " ".join(shlex_quote(p) for p in clean_paths)
        cmd = f"test -d {quoted_dest} && mv -t {quoted_dest} -- {quoted_sources}"
        code, out, err = ssh_manager.execute(server, cmd)
        if code == 0:
            return True, f"Successfully moved {len(clean_paths)} item(s) to {dest_dir}"
        return False, err or out or f"Failed to move items into destination {dest_dir}"

    @classmethod
    def copy_multiple(cls, server, paths: List[str], dest_dir: str) -> Tuple[bool, str]:
        if not paths:
            return False, "No items selected to copy"
        dest_dir = cls._normalize_path(dest_dir, server)
        clean_paths = [cls._normalize_path(p, server) for p in paths]
        
        quoted_dest = shlex_quote(dest_dir)
        quoted_sources = " ".join(shlex_quote(p) for p in clean_paths)
        cmd = f"test -d {quoted_dest} && cp -r --target-directory={quoted_dest} -- {quoted_sources}"
        code, out, err = ssh_manager.execute(server, cmd)
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
        quoted_sources = " ".join(shlex_quote(p) for p in clean_paths)
        cmd = f"chmod {rec_flag}{shlex_quote(mode)} -- {quoted_sources}"
        code, out, err = ssh_manager.execute(server, cmd)
        if code == 0:
            return True, f"Permissions set to {mode} for {len(clean_paths)} item(s)"
        return False, err or out or "Failed to change permissions"

    @classmethod
    def archive_multiple(cls, server, paths: List[str], dest_dir: str, archive_name: str) -> Tuple[bool, str]:
        if not paths:
            return False, "No items selected to archive"
        dest_dir = cls._normalize_path(dest_dir, server)
        clean_paths = [cls._normalize_path(p, server) for p in paths]
        if not archive_name or not archive_name.strip():
            archive_name = f"archive_{int(time.time())}.tar.gz"
        archive_name = archive_name.strip()
        archive_path = os.path.normpath(os.path.join(dest_dir, archive_name))

        base_dir = os.path.dirname(clean_paths[0])
        sources = " ".join(shlex_quote(os.path.basename(p)) for p in clean_paths)

        if archive_name.endswith('.zip'):
            cmd = f"cd {shlex_quote(base_dir)} && (zip -r {shlex_quote(archive_path)} {sources} 2>/dev/null || tar -czf {shlex_quote(archive_path + '.tar.gz')} {sources})"
        else:
            if not archive_name.endswith('.tar.gz') and not archive_name.endswith('.tgz') and not archive_name.endswith('.tar'):
                archive_name += '.tar.gz'
                archive_path += '.tar.gz'
            cmd = f"cd {shlex_quote(base_dir)} && tar -czf {shlex_quote(archive_path)} {sources}"

        code, out, err = ssh_manager.execute(server, cmd, timeout=30)
        if code == 0:
            return True, f"Created archive: {archive_name}"
        return False, err or out or "Failed to create archive"

    @classmethod
    def extract_archive(cls, server, archive_path: str, dest_dir: str = None) -> Tuple[bool, str]:
        archive_path = cls._normalize_path(archive_path, server)
        if not dest_dir:
            dest_dir = os.path.dirname(archive_path)
        dest_dir = cls._normalize_path(dest_dir, server)

        quoted_dest = shlex_quote(dest_dir)
        quoted_archive = shlex_quote(archive_path)

        lower_path = archive_path.lower()
        if lower_path.endswith('.zip'):
            cmd = f"test -d {quoted_dest} || mkdir -p {quoted_dest}; (which unzip >/dev/null && unzip -q -o {quoted_archive} -d {quoted_dest}) || python3 -c \"import zipfile; zipfile.ZipFile('{archive_path}').extractall('{dest_dir}')\""
        elif lower_path.endswith('.tar.gz') or lower_path.endswith('.tgz') or lower_path.endswith('.gz'):
            cmd = f"test -d {quoted_dest} || mkdir -p {quoted_dest}; tar -xzf {quoted_archive} -C {quoted_dest}"
        elif lower_path.endswith('.tar'):
            cmd = f"test -d {quoted_dest} || mkdir -p {quoted_dest}; tar -xf {quoted_archive} -C {quoted_dest}"
        else:
            return False, "Unsupported archive format (supports .zip, .tar.gz, .tgz, .tar, .gz)"

        code, out, err = ssh_manager.execute(server, cmd, timeout=60)
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
            code, _, _ = ssh_manager.execute(server, f"mkdir -p -- {shlex_quote(dir_path)}")
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
    def upload_file(cls, server, remote_dir: str, filename: str, file_stream, overwrite: bool = True, progress_callback = None) -> Tuple[bool, str]:
        remote_dir = cls._normalize_path(remote_dir, server)
        clean_rel = filename.lstrip('/\\')
        target_path = os.path.normpath(os.path.join(remote_dir, clean_rel))
        try:
            _, sftp = ssh_manager.open_sftp(server)
            target_dir = os.path.dirname(target_path)
            if target_dir and target_dir != remote_dir:
                cls._ensure_remote_dir(server, sftp, target_dir)

            if not overwrite:
                try:
                    sftp.stat(target_path)
                    return False, f"File '{filename}' already exists on remote server"
                except IOError:
                    pass  # File does not exist, safe to write

            # Pass progress_callback(transferred, total) into putfo
            sftp.putfo(file_stream, target_path, callback=progress_callback, confirm=False)
            return True, f"File {filename} uploaded successfully"
        except Exception as e:
            return False, f"Upload error: {str(e)}"

    @classmethod
    def download_file(cls, server, file_path: str):
        # FIX: pass server so '~' resolves against the actual SSH username
        file_path = cls._normalize_path(file_path, server)
        _, sftp = ssh_manager.open_sftp(server)
        return sftp.open(file_path, 'rb')

    @classmethod
    def search_files(cls, server, base_path: str, query: str) -> Tuple[bool, Any]:
        """Fast remote search using standard Linux find command with virtual filesystem pruning."""
        base_path = cls._normalize_path(base_path, server)
        if not query or not query.strip():
            return False, "Query cannot be empty"
        query = query.strip().replace("'", "").replace('"', "").replace(';', '')
        quoted_path = shlex_quote(base_path)

        if base_path == "/":
            cmd = f"find / \\( -path /proc -o -path /sys -o -path /dev -o -path /run -o -path '/var/lib/docker' -o -path '/var/lib/containerd' \\) -prune -o -maxdepth 6 -iname '*{query}*' -print 2>/dev/null | head -n 60"
        else:
            cmd = f"find {quoted_path} -maxdepth 6 -iname '*{query}*' 2>/dev/null | head -n 60"

        code, stdout, _ = ssh_manager.execute(server, cmd, timeout=7)
        
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
        """Fast remote code text search using grep."""
        base_path = cls._normalize_path(base_path, server)
        if not query or not query.strip():
            return False, "Query cannot be empty"

        safe_query = shlex_quote(query.strip())
        quoted_path = shlex_quote(base_path)
        
        # Build exclude flags for standard huge folders
        excludes = "--exclude-dir=.git --exclude-dir=node_modules --exclude-dir=venv --exclude-dir=.venv --exclude-dir=__pycache__ --exclude-dir=.cache"
        include_flag = f"--include='{file_pattern}'" if file_pattern and file_pattern.strip() else ""

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
    import shlex
    return shlex.quote(s)