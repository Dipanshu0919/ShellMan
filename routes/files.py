from flask import Blueprint, request, jsonify, Response, redirect, url_for, stream_with_context
from models.server import Server
from routes.auth_helpers import login_required
from services.sftp import SFTPService
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
    if not paths or not dest_dir:
        return jsonify({'success': False, 'error': 'Paths and destination directory are required'}), 400
    ok, msg = SFTPService.archive_multiple(server, paths, dest_dir, archive_name, task_id=task_id)
    if not ok:
        return jsonify({'success': False, 'error': msg}), 400
    return jsonify({'success': True, 'message': msg})

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
    total_files = len(uploaded_files)
    uploaded_count = 0
    errors = []

    for index, file in enumerate(uploaded_files):
        rel_path = relative_paths[index] if (relative_paths and index < len(relative_paths) and relative_paths[index]) else file.filename

        ok, msg = SFTPService.upload_file(
            server,
            dest_dir,
            rel_path,
            file.stream,
            overwrite=overwrite,
            task_id=task_id if total_files == 1 else f"{task_id}_{index}"
        )
        if ok:
            uploaded_count += 1
        else:
            errors.append(f"{file.filename}: {msg}")

    all_ok = (len(errors) == 0)
    if not all_ok:
        return jsonify({
            'success': False,
            'error': f"Uploaded {uploaded_count}/{total_files} files. Issues: {'; '.join(errors)}"
        }), 400

    return jsonify({
        'success': True,
        'message': f"Successfully uploaded {uploaded_count} file(s)",
        'uploaded_count': uploaded_count
    })

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
        mime, _ = mimetypes.guess_type(filename)
        mime = mime or "application/octet-stream"
        is_inline = request.args.get('inline') == '1' or request.path.endswith('/view')
        disposition = "inline" if is_inline else f"attachment; filename=\"{filename}\""

        def generate():
            try:
                while True:
                    chunk = remote_file.read(65536)
                    if not chunk:
                        break
                    yield chunk
            finally:
                try:
                    remote_file.close()
                except Exception:
                    pass

        return Response(
            stream_with_context(generate()),
            mimetype=mime,
            headers={
                "Content-Disposition": disposition,
                "Content-Length": str(file_size)  # ← enables native browser download bar
            }
        )
    except Exception as e:
        return f"Download failed: {str(e)}", 400