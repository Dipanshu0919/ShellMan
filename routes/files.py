from flask import Blueprint, request, jsonify, Response, redirect, url_for, stream_with_context
from models.server import Server
from routes.auth_helpers import login_required
from services.audit import audit
from services.sftp import SFTPService
from services import fastdl
from services.progress_tracker import ProgressTracker
import time
import json
import os
import mimetypes

files_bp = Blueprint('files', __name__)

@files_bp.route('/files')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    path = request.args.get('path', '')
    return redirect(url_for('dashboard.index', server_id=server_id, app='files', path=path))

@files_bp.route('/api/servers/<int:server_id>/files/list')
@login_required
def list_files(server_id):
    server = Server.query.get_or_404(server_id)
    path = request.args.get('path', '/')
    ok, res = SFTPService.list_dir(server, path)
    if not ok:
        return jsonify({'success': False, 'error': res}), 400
    return jsonify({'success': True, 'data': res})

@files_bp.route('/api/servers/<int:server_id>/files/stat')
@login_required
def stat_file(server_id):
    server = Server.query.get_or_404(server_id)
    path = request.args.get('path')
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400
    ok, res = SFTPService.stat_item(server, path)
    if not ok:
        return jsonify({'success': False, 'error': res}), 400
    return jsonify({'success': True, 'data': res})

@files_bp.route('/api/servers/<int:server_id>/files/search')
@login_required
def search_files(server_id):
    server = Server.query.get_or_404(server_id)
    path = request.args.get('path', '/')
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'success': False, 'error': 'Query required'}), 400
    ok, res = SFTPService.search_files(server, path, query)
    if not ok:
        return jsonify({'success': False, 'error': res}), 400
    return jsonify({'success': True, 'results': res})

@files_bp.route('/api/servers/<int:server_id>/files/read')
@login_required
def read_file(server_id):
    server = Server.query.get_or_404(server_id)
    path = request.args.get('path')
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400
    ok, res = SFTPService.read_file(server, path)
    if not ok:
        return jsonify({'success': False, 'error': res}), 400
    return jsonify({'success': True, 'data': res})

@files_bp.route('/api/servers/<int:server_id>/files/save', methods=['POST'])
@login_required
def save_file(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    path = data.get('path')
    content = data.get('content', '')
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400
    ok, msg = SFTPService.write_file(server, path, content)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

@files_bp.route('/api/servers/<int:server_id>/files/create', methods=['POST'])
@login_required
def create_item(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    path = data.get('path')
    item_type = data.get('type', 'file')
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400
    if item_type == 'dir':
        ok, msg = SFTPService.create_dir(server, path)
    else:
        ok, msg = SFTPService.create_file(server, path)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

@files_bp.route('/api/servers/<int:server_id>/files/rename', methods=['POST'])
@login_required
def rename_item(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    old_path = data.get('old_path')
    new_path = data.get('new_path')
    if not old_path or not new_path:
        return jsonify({'success': False, 'error': 'Old and new paths required'}), 400
    ok, msg = SFTPService.rename(server, old_path, new_path)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

@files_bp.route('/api/servers/<int:server_id>/files/delete', methods=['POST'])
@login_required
def delete_item(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    path = data.get('path')
    is_dir = data.get('is_dir', False)
    if not path:
        return jsonify({'success': False, 'error': 'Path required'}), 400
    ok, msg = SFTPService.delete(server, path, is_dir=is_dir)
    audit('file.delete', target=f"{server.name}:{path}", detail='' if ok else msg, ok=ok)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

@files_bp.route('/api/servers/<int:server_id>/files/batch-delete', methods=['POST'])
@login_required
def batch_delete(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    paths = data.get('paths', [])
    if not paths or not isinstance(paths, list):
        return jsonify({'success': False, 'error': 'No items specified for deletion'}), 400
    ok, msg = SFTPService.delete_multiple(server, paths)
    audit('file.delete', target=f"{server.name}: {len(paths)} item(s)", detail=', '.join(str(x) for x in paths[:10]) + (' ...' if len(paths) > 10 else ''), ok=ok)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

@files_bp.route('/api/servers/<int:server_id>/files/batch-move', methods=['POST'])
@login_required
def batch_move(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    paths = data.get('paths', [])
    dest_dir = data.get('dest_dir')
    task_id = data.get('task_id')
    if not paths or not dest_dir:
        return jsonify({'success': False, 'error': 'Paths and destination directory are required'}), 400
    ok, msg = SFTPService.move_multiple(server, paths, dest_dir, task_id=task_id)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

@files_bp.route('/api/servers/<int:server_id>/files/batch-copy', methods=['POST'])
@login_required
def batch_copy(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    paths = data.get('paths', [])
    dest_dir = data.get('dest_dir')
    task_id = data.get('task_id')
    if not paths or not dest_dir:
        return jsonify({'success': False, 'error': 'Paths and destination directory are required'}), 400
    ok, msg = SFTPService.copy_multiple(server, paths, dest_dir, task_id=task_id)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

@files_bp.route('/api/servers/<int:server_id>/files/batch-chmod', methods=['POST'])
@login_required
def batch_chmod(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    paths = data.get('paths', [])
    mode = data.get('mode')
    recursive = data.get('recursive', False)
    if not paths or not mode:
        return jsonify({'success': False, 'error': 'Paths and permission mode are required'}), 400
    ok, msg = SFTPService.chmod_multiple(server, paths, mode, recursive=recursive)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

@files_bp.route('/api/servers/<int:server_id>/files/batch-archive', methods=['POST'])
@login_required
def batch_archive(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    paths = data.get('paths', [])
    dest_dir = data.get('dest_dir')
    archive_name = data.get('archive_name')
    task_id = data.get('task_id')
    exclude = data.get('exclude') or []
    use_gitignore = bool(data.get('use_gitignore'))
    if not isinstance(exclude, list):
        return jsonify({'success': False, 'error': 'exclude must be a list'}), 400
    if not paths or not dest_dir:
        return jsonify({'success': False, 'error': 'Paths and destination directory are required'}), 400
    ok, msg = SFTPService.archive_multiple(server, paths, dest_dir, archive_name, task_id=task_id,
                                           exclude=exclude, use_gitignore=use_gitignore)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

@files_bp.route('/api/servers/<int:server_id>/files/archive-options', methods=['POST'])
@login_required
def archive_options(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    paths = data.get('paths', [])
    ok, res = SFTPService.archive_options(server, paths, cancel_id=request.headers.get('X-Request-Id') or data.get('request_id'))
    if not ok:
        return jsonify({'success': False, 'error': res}), 400
    return jsonify({'success': True, **res})

@files_bp.route('/api/servers/<int:server_id>/files/archive-gitignore', methods=['POST'])
@login_required
def archive_gitignore(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    ok, res = SFTPService.archive_gitignore(server, data.get('paths', []), data.get('rels', []),
                                            cancel_id=request.headers.get('X-Request-Id') or data.get('request_id'))
    if not ok:
        return jsonify({'success': False, 'error': res}), 400
    return jsonify({'success': True, **res})

@files_bp.route('/api/servers/<int:server_id>/files/extract', methods=['POST'])
@login_required
def extract_archive(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    archive_path = data.get('archive_path')
    dest_dir = data.get('dest_dir')
    if not archive_path:
        return jsonify({'success': False, 'error': 'Archive path is required'}), 400
    ok, msg = SFTPService.extract_archive(server, archive_path, dest_dir)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

# ─────────────────────────────────────────────────────────────
# ★ REAL PROGRESS: SSE endpoint used by all frontend operations
# ─────────────────────────────────────────────────────────────
@files_bp.route('/api/tasks/<task_id>/cancel', methods=['POST'])
@login_required
def cancel_task(task_id):
    ProgressTracker.request_cancel(task_id)
    return jsonify({'success': True})

@files_bp.route('/api/tasks/<task_id>/progress')
@login_required
def stream_task_progress(task_id):
    """
    Real-time SSE endpoint streaming byte-accurate progress for
    uploads, copies, moves, archives, and any other tracked task.
    """
    def event_generator():
        last_payload = None
        start_time = time.time()

        while True:
            # Safety: hard 10 minute timeout per stream
            if time.time() - start_time > 600:
                break

            task = ProgressTracker.get(task_id)
            if task:
                current_payload = json.dumps(task)
                if current_payload != last_payload:
                    yield f"data: {current_payload}\n\n"
                    last_payload = current_payload

                if task['status'] in ('done', 'error', 'cancelled'):
                    ProgressTracker.cleanup(task_id)
                    break
            else:
                yield f"data: {json.dumps({'status': 'waiting', 'transferred': 0, 'total': 0})}\n\n"

            time.sleep(0.15)

    return Response(event_generator(), mimetype='text/event-stream')

@files_bp.route('/api/servers/<int:server_id>/files/upload', methods=['POST'])
@login_required
def upload_file(server_id):
    server = Server.query.get_or_404(server_id)
    dest_dir = request.form.get('dest_dir', '/')
    overwrite = request.form.get('overwrite', 'true').lower() in ('true', '1', 'yes')
    task_id = request.form.get('task_id')

    uploaded_files = request.files.getlist('files')
    if not uploaded_files and 'file' in request.files:
        uploaded_files = [request.files['file']]

    uploaded_files = [f for f in uploaded_files if f and f.filename]
    if not uploaded_files:
        return jsonify({'success': False, 'error': 'No files selected for upload'}), 400

    relative_paths = request.form.getlist('relative_paths')
    files_data = []
    for index, file in enumerate(uploaded_files):
        rel = relative_paths[index] if (relative_paths and index < len(relative_paths) and relative_paths[index]) else file.filename
        files_data.append((rel, file.stream))

    ok, uploaded_count, errors = SFTPService.upload_batch(
        server,
        dest_dir,
        files_data,
        overwrite=overwrite,
        task_id=task_id
    )

    if not ok and uploaded_count == 0:
        return jsonify({
            'success': False,
            'error': f"Upload failed: {'; '.join(errors[:5])}"
        }), 400

    return jsonify({
        'success': True,
        'message': f"Successfully uploaded {uploaded_count}/{len(files_data)} file(s)",
        'uploaded_count': uploaded_count,
        'errors': errors[:5] if errors else []
    })

# Types Python's mimetypes may not know (or maps wrongly) on a minimal host.
_EXTRA_MIME = {
    '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
    '.ogv': 'video/ogg', '.avi': 'video/x-msvideo', '.3gp': 'video/3gpp',
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.wav': 'audio/wav',
    '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.weba': 'audio/webm',
    '.avif': 'image/avif', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
    '.apng': 'image/apng', '.jfif': 'image/jpeg', '.jxl': 'image/jxl',
}

# Everything served by /view runs in a sandbox with no scripts: an SVG or HTML file that sits on a
# managed server must never execute in ShellMan's origin when opened directly.
_VIEW_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"


def _parse_range(header, size):
    """Parse a single 'bytes=a-b' range. Returns (start, end) inclusive, None for no range, False if unsatisfiable."""
    if not header or not header.startswith('bytes=') or size <= 0:
        return None
    spec = header[6:].split(',')[0].strip()
    if '-' not in spec:
        return None
    a, b = spec.split('-', 1)
    try:
        if a == '':                       # suffix range: last N bytes
            n = int(b)
            if n <= 0:
                return False
            return (max(0, size - n), size - 1)
        start = int(a)
        end = int(b) if b != '' else size - 1
    except ValueError:
        return None
    if start >= size or start > end:
        return False
    return (start, min(end, size - 1))


@files_bp.route('/api/servers/<int:server_id>/files/download')
@files_bp.route('/api/servers/<int:server_id>/files/view')
@login_required
def download_file(server_id):
    server = Server.query.get_or_404(server_id)
    path = request.args.get('path')
    if not path:
        return "Path required", 400

    try:
        remote_file = SFTPService.download_file(server, path)
        attr = remote_file.stat()
        file_size = attr.st_size

        filename = os.path.basename(path)
        ext = os.path.splitext(filename)[1].lower()
        mime = _EXTRA_MIME.get(ext) or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        is_view = request.args.get('inline') == '1' or request.path.endswith('/view')
        disposition = "inline" if is_view else f"attachment; filename=\"{filename}\""

        rng = _parse_range(request.headers.get('Range'), file_size)
        if rng is False:
            try:
                remote_file.close()
            except Exception:
                pass
            return Response(status=416, headers={"Content-Range": f"bytes */{file_size}"})
        start, end = rng if rng else (0, max(file_size - 1, 0))
        length = (end - start + 1) if file_size else 0

        # Big downloads: several SSH connections at once (like aria2c). Previews / media seeking keep one connection.
        use_fast = (not is_view) and length >= fastdl.MIN_FAST and fastdl.max_connections(server) > 1
        if use_fast:
            try:
                remote_file.close()
            except Exception:
                pass

        def generate():
            if use_fast:
                yield from fastdl.stream(server, SFTPService._normalize_path(path, server), start, length)
                return
            try:
                remote_file.seek(start)
                # read ahead: many requests in flight instead of one round trip per 32 KB (capped so memory stays small)
                remote_file.prefetch(min(start + length, start + 32 * 1024 * 1024))
                left = length
                while left > 0:
                    chunk = remote_file.read(min(1048576, left))
                    if not chunk:
                        break
                    left -= len(chunk)
                    yield chunk
            finally:
                try:
                    remote_file.close()
                except Exception:
                    pass

        headers = {
            "Content-Disposition": disposition,
            "Content-Length": str(length),   # enables the native browser download bar
            "Accept-Ranges": "bytes",        # lets <video>/<audio> seek
            "X-Content-Type-Options": "nosniff",
        }
        if is_view:
            headers["Content-Security-Policy"] = _VIEW_CSP
        if rng:
            headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        return Response(stream_with_context(generate()), status=206 if rng else 200, mimetype=mime, headers=headers)
    except Exception as e:
        return f"Download failed: {str(e)}", 400
