import base64
import shlex
from flask import Blueprint, request, jsonify
from models.server import Server
from routes.auth_helpers import login_required
from services.ssh_manager import ssh_manager

cron_bp = Blueprint('cron', __name__)

PRESET_DESCRIPTIONS = {
    '@reboot': 'Run once at system startup / reboot',
    '@yearly': 'Run once a year at midnight of Jan 1 (0 0 1 1 *)',
    '@annually': 'Run once a year at midnight of Jan 1 (0 0 1 1 *)',
    '@monthly': 'Run once a month at midnight of first day (0 0 1 * *)',
    '@weekly': 'Run once a week at midnight of Sunday (0 0 * * 0)',
    '@daily': 'Run once a day at midnight (0 0 * * *)',
    '@midnight': 'Run once a day at midnight (0 0 * * *)',
    '@hourly': 'Run once an hour at minute 0 (0 * * * *)',
    '* * * * *': 'Every minute',
    '*/5 * * * *': 'Every 5 minutes',
    '*/10 * * * *': 'Every 10 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '*/30 * * * *': 'Every 30 minutes',
    '0 * * * *': 'Hourly (at minute 0)',
    '0 0 * * *': 'Daily at midnight (00:00)',
    '0 12 * * *': 'Daily at noon (12:00)',
    '0 0 * * 0': 'Weekly on Sunday at midnight',
    '0 0 1 * *': 'Monthly on 1st day at midnight',
    '0 0 1 1 *': 'Yearly on Jan 1st at midnight'
}

def human_schedule(schedule_expr: str) -> str:
    expr = schedule_expr.strip()
    if expr in PRESET_DESCRIPTIONS:
        return PRESET_DESCRIPTIONS[expr]

    parts = expr.split()
    if len(parts) == 5:
        m, h, dom, mon, dow = parts
        if m.startswith('*/'):
            return f"Every {m[2:]} minutes"
        if h == '*' and m != '*':
            return f"Hourly at minute {m}"
        if dom == '*' and mon == '*' and dow == '*' and h != '*' and m != '*':
            return f"Daily at {h.zfill(2)}:{m.zfill(2)}"
        if dow != '*' and dom == '*' and mon == '*':
            return f"Weekly (day {dow}) at {h.zfill(2)}:{m.zfill(2)}"
        if dom != '*' and mon == '*':
            return f"Monthly (day {dom}) at {h.zfill(2)}:{m.zfill(2)}"
        return f"Schedule: {expr}"

    return expr

@cron_bp.route('/api/servers/<int:server_id>/cron/list', methods=['GET'])
@login_required
def list_cron_jobs(server_id):
    server = Server.query.get_or_404(server_id)
    code, stdout, stderr = ssh_manager.execute(server, "crontab -l 2>/dev/null || true", timeout=10)

    jobs = []
    lines = stdout.splitlines()

    for idx, raw_line in enumerate(lines):
        line = raw_line.strip()
        if not line:
            continue

        is_disabled = False
        active_line = line

        # Detect commented/disabled job
        if line.startswith('#'):
            clean = line.lstrip('#').strip()
            # check if the commented portion looks like a cron job (starts with @ or 5 fields)
            if clean.startswith('@') or (len(clean.split()) >= 6 and (clean.split()[0].isdigit() or '*' in clean.split()[0])):
                is_disabled = True
                active_line = clean
            else:
                # Regular comment
                continue

        # Parse schedule & command
        parts = active_line.split(None, 5) if not active_line.startswith('@') else active_line.split(None, 1)
        if active_line.startswith('@') and len(parts) >= 2:
            schedule = parts[0]
            cmd = parts[1]
        elif len(parts) == 6:
            schedule = " ".join(parts[:5])
            cmd = parts[5]
        else:
            continue

        jobs.append({
            'id': idx,
            'raw': raw_line,
            'schedule': schedule,
            'human': human_schedule(schedule),
            'command': cmd,
            'is_enabled': not is_disabled
        })

    return jsonify({
        'success': True,
        'jobs': jobs,
        'total': len(jobs)
    })

@cron_bp.route('/api/servers/<int:server_id>/cron/save', methods=['POST'])
@login_required
def save_cron_job(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}

    schedule = (data.get('schedule') or '').strip()
    command = (data.get('command') or '').strip()
    entry_id = data.get('id')  # None for new, int for edit
    is_enabled = data.get('is_enabled', True)

    if not schedule or not command:
        return jsonify({'success': False, 'error': 'Schedule and command are required.'}), 400

    # Read current crontab
    code, stdout, _ = ssh_manager.execute(server, "crontab -l 2>/dev/null || true", timeout=10)
    lines = stdout.splitlines()

    line_content = f"{schedule} {command}"
    if not is_enabled:
        line_content = f"# {line_content}"

    if entry_id is not None and 0 <= int(entry_id) < len(lines):
        lines[int(entry_id)] = line_content
    else:
        lines.append(line_content)

    new_crontab = "\n".join(lines).strip() + "\n"
    b64 = base64.b64encode(new_crontab.encode('utf-8')).decode('utf-8')
    write_cmd = f"echo '{b64}' | base64 -d | crontab -"

    code, _, stderr = ssh_manager.execute(server, write_cmd, timeout=10)
    if code != 0:
        return jsonify({'success': False, 'error': f'Crontab installation failed: {stderr}'}), 400

    return jsonify({'success': True, 'message': 'Cron schedule saved successfully.'})

@cron_bp.route('/api/servers/<int:server_id>/cron/delete', methods=['POST'])
@login_required
def delete_cron_job(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    entry_id = data.get('id')

    if entry_id is None:
        return jsonify({'success': False, 'error': 'Entry ID required.'}), 400

    code, stdout, _ = ssh_manager.execute(server, "crontab -l 2>/dev/null || true", timeout=10)
    lines = stdout.splitlines()

    idx = int(entry_id)
    if 0 <= idx < len(lines):
        lines.pop(idx)
        new_crontab = "\n".join(lines).strip() + "\n"
        b64 = base64.b64encode(new_crontab.encode('utf-8')).decode('utf-8')
        write_cmd = f"echo '{b64}' | base64 -d | crontab -"
        code, _, stderr = ssh_manager.execute(server, write_cmd, timeout=10)
        if code != 0:
            return jsonify({'success': False, 'error': f'Delete failed: {stderr}'}), 400

    return jsonify({'success': True, 'message': 'Cron entry removed.'})

@cron_bp.route('/api/servers/<int:server_id>/cron/toggle', methods=['POST'])
@login_required
def toggle_cron_job(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    entry_id = data.get('id')

    if entry_id is None:
        return jsonify({'success': False, 'error': 'Entry ID required.'}), 400

    code, stdout, _ = ssh_manager.execute(server, "crontab -l 2>/dev/null || true", timeout=10)
    lines = stdout.splitlines()

    idx = int(entry_id)
    if 0 <= idx < len(lines):
        line = lines[idx].strip()
        if line.startswith('#'):
            # Enable it
            lines[idx] = line.lstrip('#').strip()
        else:
            # Disable it
            lines[idx] = f"# {line}"

        new_crontab = "\n".join(lines).strip() + "\n"
        b64 = base64.b64encode(new_crontab.encode('utf-8')).decode('utf-8')
        write_cmd = f"echo '{b64}' | base64 -d | crontab -"
        code, _, stderr = ssh_manager.execute(server, write_cmd, timeout=10)
        if code != 0:
            return jsonify({'success': False, 'error': f'Toggle failed: {stderr}'}), 400

    return jsonify({'success': True, 'message': 'Cron state toggled.'})

@cron_bp.route('/api/servers/<int:server_id>/cron/run-now', methods=['POST'])
@login_required
def run_cron_now(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    cmd = (data.get('command') or '').strip()

    if not cmd:
        return jsonify({'success': False, 'error': 'Command required.'}), 400

    # Execute inside a subshell to capture exit code and full standard output
    safe_run = f"bash -c {shlex.quote(cmd)}"
    code, stdout, stderr = ssh_manager.execute(server, safe_run, timeout=25)

    return jsonify({
        'success': code == 0,
        'exit_code': code,
        'stdout': stdout,
        'stderr': stderr,
        'output': (stdout + stderr).strip() or '(Command produced no output)'
    })

