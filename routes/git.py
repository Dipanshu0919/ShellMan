import shlex
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from models import db
from models.server import Server
from models.git_deployment import GitDeployment
from routes.auth_helpers import login_required
from services.ssh_manager import ssh_manager

git_bp = Blueprint('git', __name__)

def normalize_repo_url(url: str) -> str:
    url = (url or '').strip()
    if not url:
        return ''
    if not (url.startswith('http://') or url.startswith('https://') or url.startswith('git@') or url.startswith('ssh://')):
        url = f"https://{url}"
    return url

def build_deployment_script(target_path: str, repo_url: str, branch: str, post_cmd: str) -> str:
    q_path = shlex.quote(target_path)
    q_branch = shlex.quote(branch or 'main')
    normalized_url = normalize_repo_url(repo_url)
    q_url = shlex.quote(normalized_url)

    script = (
        f"if [ ! -d {q_path}/.git ]; then "
        f"  if [ ! -e {q_path} ] || [ -z \"$(ls -A {q_path} 2>/dev/null)\" ]; then "
        f"    echo '[ShellMan Git] Initializing clone from {normalized_url} (branch: {branch})...' && "
        f"    git clone -b {q_branch} {q_url} {q_path}; "
        f"  else "
        f"    echo '[ShellMan Git] Target folder contains existing files. Initializing Git repository...' && "
        f"    cd {q_path} && git init && "
        f"    (git remote remove origin 2>/dev/null || true) && "
        f"    git remote add origin {q_url} && "
        f"    git fetch origin {q_branch} && "
        f"    (git checkout -B {q_branch} origin/{q_branch} 2>/dev/null || git pull origin {q_branch}); "
        f"  fi; "
        f"else "
        f"  cd {q_path} && "
        f"  (git remote set-url origin {q_url} 2>/dev/null || true) && "
        f"  git fetch origin {q_branch} && "
        f"  git checkout {q_branch} && "
        f"  git pull origin {q_branch}; "
        f"fi"
    )
    if post_cmd:
        script += f" && cd {q_path} && {post_cmd}"
    return script

@git_bp.route('/api/servers/<int:server_id>/git/list', methods=['GET'])
@login_required
def list_deployments(server_id):
    server = Server.query.get_or_404(server_id)
    deployments = GitDeployment.query.filter_by(server_id=server.id).order_by(GitDeployment.id.desc()).all()
    return jsonify({
        'success': True,
        'deployments': [d.to_dict() for d in deployments]
    })

@git_bp.route('/api/servers/<int:server_id>/git/save', methods=['POST'])
@login_required
def save_deployment(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}

    dep_id = data.get('id')
    name = (data.get('name') or '').strip()
    repo_url = normalize_repo_url(data.get('repo_url') or '')
    target_path = (data.get('target_path') or '').strip()
    branch = (data.get('branch') or 'main').strip()
    post_deploy_cmd = (data.get('post_deploy_cmd') or '').strip()

    if not name or not repo_url or not target_path:
        return jsonify({'success': False, 'error': 'Project name, repository URL, and target directory are required.'}), 400

    if dep_id:
        dep = GitDeployment.query.filter_by(id=dep_id, server_id=server.id).first_or_404()
        dep.name = name
        dep.repo_url = repo_url
        dep.target_path = target_path
        dep.branch = branch
        dep.post_deploy_cmd = post_deploy_cmd
    else:
        dep = GitDeployment(
            server_id=server.id,
            name=name,
            repo_url=repo_url,
            target_path=target_path,
            branch=branch,
            post_deploy_cmd=post_deploy_cmd
        )
        db.session.add(dep)

    db.session.commit()
    return jsonify({'success': True, 'deployment': dep.to_dict()})

@git_bp.route('/api/servers/<int:server_id>/git/delete', methods=['POST'])
@login_required
def delete_deployment(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    dep_id = data.get('id')
    if not dep_id:
        return jsonify({'success': False, 'error': 'Deployment ID required.'}), 400

    dep = GitDeployment.query.filter_by(id=dep_id, server_id=server.id).first_or_404()
    db.session.delete(dep)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Deployment project deleted.'})

@git_bp.route('/api/servers/<int:server_id>/git/inspect', methods=['POST'])
@login_required
def inspect_git_repo(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    path = (data.get('target_path') or '').strip()
    if not path:
        return jsonify({'success': False, 'error': 'Target directory required.'}), 400

    q_path = shlex.quote(path)
    cmd = (
        f"if [ -d {q_path}/.git ]; then "
        f"cd {q_path} && "
        f"echo '---BRANCH---' && git rev-parse --abbrev-ref HEAD && "
        f"echo '---REMOTE---' && (git config --get remote.origin.url || echo '') && "
        f"echo '---COMMIT---' && git log -1 --pretty=format:'%h%x09%an%x09%ar%x09%s' && echo '' && "
        f"echo '---STATUS---' && git status -s && "
        f"echo '---BRANCHES---' && git branch --no-color; "
        f"else echo 'NOT_A_REPO'; fi"
    )

    code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
    if 'NOT_A_REPO' in stdout:
        return jsonify({
            'success': True,
            'is_git_repo': False,
            'message': f'Directory {path} is not an initialized Git repository.'
        })

    # Parse sections
    sections = {}
    current_sec = None
    sec_lines = []

    for line in stdout.splitlines():
        if line.startswith('---') and line.endswith('---'):
            if current_sec:
                sections[current_sec] = "\n".join(sec_lines).strip()
            current_sec = line.strip('-')
            sec_lines = []
        else:
            sec_lines.append(line)
    if current_sec:
        sections[current_sec] = "\n".join(sec_lines).strip()

    commit_parts = sections.get('COMMIT', '').split('\t')
    commit_info = {}
    if len(commit_parts) >= 4:
        commit_info = {
            'hash': commit_parts[0],
            'author': commit_parts[1],
            'relative_time': commit_parts[2],
            'message': commit_parts[3]
        }

    return jsonify({
        'success': True,
        'is_git_repo': True,
        'branch': sections.get('BRANCH', 'main'),
        'remote_url': sections.get('REMOTE', ''),
        'last_commit': commit_info,
        'status_summary': sections.get('STATUS', ''),
        'is_clean': len(sections.get('STATUS', '')) == 0,
        'branches': [b.strip().replace('* ', '') for b in sections.get('BRANCHES', '').splitlines() if b.strip()]
    })

@git_bp.route('/api/servers/<int:server_id>/git/pull', methods=['POST'])
@login_required
def pull_latest(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    dep_id = data.get('id')

    dep = None
    if dep_id:
        dep = GitDeployment.query.filter_by(id=dep_id, server_id=server.id).first()

    target_path = dep.target_path if dep else (data.get('target_path') or '').strip()
    branch = dep.branch if dep else (data.get('branch') or 'main').strip()
    post_cmd = dep.post_deploy_cmd if dep else (data.get('post_deploy_cmd') or '').strip()
    repo_url = normalize_repo_url(dep.repo_url if dep else data.get('repo_url'))

    if not target_path:
        return jsonify({'success': False, 'error': 'Target path required.'}), 400

    if dep and dep.repo_url != repo_url:
        dep.repo_url = repo_url
        db.session.commit()

    run_script = build_deployment_script(
        target_path=target_path,
        repo_url=repo_url,
        branch=branch,
        post_cmd=post_cmd
    )

    code, stdout, stderr = ssh_manager.execute(server, run_script, timeout=120)
    full_output = (stdout + stderr).strip()
    success = (code == 0)

    if dep:
        dep.last_status = 'success' if success else 'failed'
        dep.last_log = full_output
        dep.last_deployed_at = datetime.now(timezone.utc)
        db.session.commit()

    return jsonify({
        'success': success,
        'exit_code': code,
        'log': full_output,
        'error': stderr if not success else None
    })

@git_bp.route('/api/servers/<int:server_id>/git/clone', methods=['POST'])
@login_required
def clone_repo(server_id):
    server = Server.query.get_or_404(server_id)
    data = request.json or {}
    repo_url = (data.get('repo_url') or '').strip()
    target_path = (data.get('target_path') or '').strip()
    branch = (data.get('branch') or 'main').strip()

    if not repo_url or not target_path:
        return jsonify({'success': False, 'error': 'Repository URL and target path required.'}), 400

    q_url = shlex.quote(repo_url)
    q_path = shlex.quote(target_path)
    q_branch = shlex.quote(branch)

    clone_cmd = f"git clone -b {q_branch} {q_url} {q_path}"
    code, stdout, stderr = ssh_manager.execute(server, clone_cmd, timeout=120)
    full_output = (stdout + stderr).strip()

    return jsonify({
        'success': code == 0,
        'exit_code': code,
        'log': full_output,
        'error': stderr if code != 0 else None
    })

# Unauthenticated Webhook Receiver for GitHub/GitLab
@git_bp.route('/api/deploy/webhook/<token>', methods=['POST', 'GET'])
def trigger_webhook(token):
    dep = GitDeployment.query.filter_by(webhook_token=token).first()
    if not dep:
        return jsonify({'success': False, 'error': 'Invalid webhook deployment token.'}), 404

    server = Server.query.get(dep.server_id)
    if not server:
        return jsonify({'success': False, 'error': 'Host server node no longer exists.'}), 404

    repo_url = normalize_repo_url(dep.repo_url)
    if dep.repo_url != repo_url:
        dep.repo_url = repo_url
        db.session.commit()

    run_script = build_deployment_script(
        target_path=dep.target_path,
        repo_url=repo_url,
        branch=dep.branch,
        post_cmd=dep.post_deploy_cmd
    )

    code, stdout, stderr = ssh_manager.execute(server, run_script, timeout=120)
    full_output = (stdout + stderr).strip()
    success = (code == 0)

    dep.last_status = 'success' if success else 'failed'
    dep.last_log = full_output
    dep.last_deployed_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        'success': success,
        'message': f"Webhook deployment executed for '{dep.name}'. Status: {dep.last_status}",
        'exit_code': code,
        'log': full_output
    })

