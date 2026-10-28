"""Desktop wallpapers uploaded from the user's device (images, animated GIFs and short videos).

Files live in instance/wallpapers under random names. Only whitelisted image and video types are accepted,
and the first bytes of the file must match the type, so a renamed script or HTML page is refused. SVG is not
accepted on purpose: it can carry script.
"""
import logging
import mimetypes
import os
import re
import uuid

from flask import Blueprint, jsonify, request, send_from_directory

from config import INSTANCE_DIR
from routes.auth_helpers import login_required
from services.audit import audit

logger = logging.getLogger('shellman.wallpapers')
wallpaper_bp = Blueprint('wallpapers', __name__)

WALL_DIR = os.path.join(INSTANCE_DIR, 'wallpapers')
os.makedirs(WALL_DIR, exist_ok=True)

IMAGE_EXT = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'}
VIDEO_EXT = {'mp4', 'm4v', 'mov', 'webm', 'ogv'}
MAX_IMAGE = 40 * 1024 * 1024
MAX_VIDEO = 300 * 1024 * 1024
MAX_FILES = 10
NAME_RE = re.compile(r'^[a-f0-9]{20}\.(%s)$' % '|'.join(sorted(IMAGE_EXT | VIDEO_EXT)))


def _sniff_ok(ext, head):
    """True if the first bytes look like the claimed type."""
    if ext in ('jpg', 'jpeg'):
        return head[:3] == b'\xff\xd8\xff'
    if ext == 'png':
        return head[:8] == b'\x89PNG\r\n\x1a\n'
    if ext == 'gif':
        return head[:4] == b'GIF8'
    if ext == 'webp':
        return head[:4] == b'RIFF' and head[8:12] == b'WEBP'
    if ext == 'bmp':
        return head[:2] == b'BM'
    if ext == 'avif':
        return head[4:8] == b'ftyp'
    if ext in ('mp4', 'm4v', 'mov'):
        return head[4:8] == b'ftyp' or head[4:8] in (b'moov', b'mdat', b'free', b'wide')
    if ext == 'webm':
        return head[:4] == b'\x1a\x45\xdf\xa3'
    if ext == 'ogv':
        return head[:4] == b'OggS'
    return False


def _kind(name):
    return 'video' if name.rsplit('.', 1)[-1] in VIDEO_EXT else 'image'


def _item(name):
    p = os.path.join(WALL_DIR, name)
    st = os.stat(p)
    return {'name': name, 'url': '/wallpapers/' + name, 'kind': _kind(name),
            'size': st.st_size, 'ts': int(st.st_mtime * 1000)}


@wallpaper_bp.route('/wallpapers/<name>')
@login_required
def serve(name):
    if not NAME_RE.match(name):
        return jsonify({'success': False, 'error': 'Not found'}), 404
    resp = send_from_directory(WALL_DIR, name, conditional=True, mimetype=mimetypes.guess_type(name)[0],
                               max_age=86400)
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['Cache-Control'] = 'private, max-age=86400'
    return resp


@wallpaper_bp.route('/api/wallpapers')
@login_required
def listing():
    items = []
    for n in os.listdir(WALL_DIR):
        if NAME_RE.match(n):
            try:
                items.append(_item(n))
            except OSError:
                pass
    items.sort(key=lambda i: i['ts'], reverse=True)
    return jsonify({'success': True, 'items': items})


@wallpaper_bp.route('/api/wallpapers/upload', methods=['POST'])
@login_required
def upload():
    f = request.files.get('file')
    if not f or not f.filename:
        return jsonify({'success': False, 'error': 'No file chosen.'}), 400
    if sum(1 for n in os.listdir(WALL_DIR) if NAME_RE.match(n)) >= MAX_FILES:
        return jsonify({'success': False, 'error': 'Preset limit reached (%d). Delete one first.' % MAX_FILES}), 400
    ext = f.filename.rsplit('.', 1)[-1].lower() if '.' in f.filename else ''
    if ext not in IMAGE_EXT and ext not in VIDEO_EXT:
        return jsonify({'success': False, 'error': 'Unsupported type. Use JPG, PNG, WebP, GIF, AVIF, BMP, MP4, WebM, MOV or OGV.'}), 400
    head = f.stream.read(16)
    f.stream.seek(0)
    if not _sniff_ok(ext, head):
        return jsonify({'success': False, 'error': 'The file content does not match its extension.'}), 400
    name = uuid.uuid4().hex[:20] + '.' + ext
    final = os.path.join(WALL_DIR, name)
    tmp = final + '.part'
    limit = MAX_VIDEO if ext in VIDEO_EXT else MAX_IMAGE
    try:
        f.save(tmp)                                   # streamed to disk, not held in memory
        size = os.path.getsize(tmp)
        if size > limit:
            os.remove(tmp)
            return jsonify({'success': False, 'error': 'File too large (limit %d MB for %s).' % (limit // 1048576, _kind(name))}), 413
        os.replace(tmp, final)
    except Exception as e:
        logger.error('wallpaper upload failed: %s', e, exc_info=True)
        try:
            os.remove(tmp)
        except OSError:
            pass
        return jsonify({'success': False, 'error': 'Could not save the file.'}), 500
    audit('wallpaper_upload', target=name, detail='%s, %d KB' % (f.filename[:80], size // 1024))
    return jsonify({'success': True, 'item': _item(name)})


@wallpaper_bp.route('/api/wallpapers/<name>', methods=['DELETE'])
@login_required
def delete(name):
    if not NAME_RE.match(name):
        return jsonify({'success': False, 'error': 'Bad name.'}), 400
    p = os.path.join(WALL_DIR, name)
    if not os.path.isfile(p):
        return jsonify({'success': True})
    os.remove(p)
    audit('wallpaper_delete', target=name)
    return jsonify({'success': True})
