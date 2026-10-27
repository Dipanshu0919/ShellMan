"""GitHub Codespaces support.

ShellMan reaches a Codespace the way the official `gh` CLI does: `gh codespace ssh --stdio` is used as the
SSH ProxyCommand, so everything else (terminal, files, monitoring, actions) works as with any SSH server.
State, start and stop use the GitHub REST API directly, with the token the user saved on the server entry.

A stopped Codespace is never woken by accident: `ensure_available()` refuses to connect unless it is running,
because `gh codespace ssh` would otherwise start it and start the billing clock.
"""
import json
import logging
import os
import shlex
import shutil
import subprocess
import tempfile
import threading
import re
import time
import urllib.error
import urllib.parse
import urllib.request

import paramiko

from config import INSTANCE_DIR

logger = logging.getLogger('shellman.codespace')

API = os.environ.get('SHELLMAN_GITHUB_API', 'https://api.github.com').rstrip('/')   # override for GitHub Enterprise
STATE_TTL = 20            # seconds a state answer is reused

_state_cache = {}         # server_id -> (time, info)
_config_cache = {}        # server_id -> (time, (proxy_cmd, key_path, user))
_lock = threading.Lock()


class CodespaceError(Exception):
    """Problem talking to GitHub or to the gh CLI (message is safe to show to the user)."""


class CodespaceStopped(CodespaceError):
    """The Codespace is not running; connecting would start it and use quota."""

    def __init__(self, message, state='Shutdown'):
        super().__init__(message)
        self.state = state


# ---------------------------------------------------------------- GitHub REST
def _request(token, method, path, body=None, timeout=20):
    if not token:
        raise CodespaceError('No GitHub token saved for this Codespace.')
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ShellMan',
        **({'Content-Type': 'application/json'} if data else {}),
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(2 * 1024 * 1024)
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        try:
            said = (json.loads(e.read(4096) or b'{}').get('message') or '').strip()[:300]
        except (ValueError, AttributeError, OSError):
            said = ''
        said = f' GitHub says: {said}' if said else ''
        if e.code in (401, 403):
            raise CodespaceError('GitHub refused this action. The token needs the "codespace" scope (classic token) or '
                                 'Codespaces read/write permission (fine-grained token); an organization or billing '
                                 'policy can also block it.' + said)
        if e.code == 404:
            raise CodespaceError('Not found on GitHub. Check the name or repository, and that the token can see it.' + said)
        raise CodespaceError(f'GitHub answered HTTP {e.code}.' + said)
    except (urllib.error.URLError, OSError) as e:
        raise CodespaceError(f'Could not reach GitHub: {getattr(e, "reason", e)}')


def _summary(cs):
    machine = cs.get('machine') or {}
    repo = cs.get('repository') or {}
    return {
        'name': cs.get('name'),
        'display_name': cs.get('display_name') or cs.get('name'),
        'state': cs.get('state') or 'Unknown',
        'available': cs.get('state') == 'Available',
        'cpus': int(machine.get('cpus') or 2),
        'machine': machine.get('display_name') or machine.get('name') or '',
        'repository': repo.get('full_name') or '',
        'idle_timeout_minutes': cs.get('idle_timeout_minutes'),
        'last_used_at': cs.get('last_used_at'),
    }


def list_codespaces(token):
    out = _request(token, 'GET', '/user/codespaces?per_page=50')
    return [_summary(c) for c in out.get('codespaces', [])]


_REPO_RE = re.compile(r'^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$')
_REF_RE = re.compile(r'^[A-Za-z0-9_./@-]{1,200}$')
_MACHINE_RE = re.compile(r'^[A-Za-z0-9_.-]{1,64}$')


def list_repos(token, query=''):
    """Repositories the token can create a Codespace in, most recently pushed first (optionally filtered)."""
    out = _request(token, 'GET', '/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member')
    query = (query or '').strip().lower()
    repos = [{'full_name': r.get('full_name'), 'private': bool(r.get('private')),
              'default_branch': r.get('default_branch') or 'main'}
             for r in (out if isinstance(out, list) else []) if r.get('full_name')]
    if query:
        repos = [r for r in repos if query in r['full_name'].lower()]
    return repos[:50]


def list_machines(token, repo, ref=''):
    """Machine sizes available for `repo` (cores, memory, disk)."""
    if not _REPO_RE.match(repo or ''):
        raise CodespaceError('Pick a repository first (owner/name).')
    path = f'/repos/{repo}/codespaces/machines'
    if ref:
        if not _REF_RE.match(ref):
            raise CodespaceError('That branch name is not valid.')
        path += '?ref=' + urllib.parse.quote(ref, safe='')
    out = _request(token, 'GET', path)
    return [{'name': m.get('name'), 'display_name': m.get('display_name') or m.get('name'),
             'cpus': int(m.get('cpus') or 0),
             'memory_gb': round((m.get('memory_in_bytes') or 0) / 1024 ** 3),
             'storage_gb': round((m.get('storage_in_bytes') or 0) / 1024 ** 3)}
            for m in out.get('machines', []) if m.get('name')]


def create(token, repo, machine, ref='', idle_timeout_minutes=30, display_name=''):
    """Create a new Codespace. It starts provisioning at once, which starts billing."""
    if not _REPO_RE.match(repo or ''):
        raise CodespaceError('Pick a repository first (owner/name).')
    if not _MACHINE_RE.match(machine or ''):
        raise CodespaceError('Pick a machine size.')
    body = {'machine': machine, 'idle_timeout_minutes': max(5, min(240, int(idle_timeout_minutes or 30)))}
    if ref:
        if not _REF_RE.match(ref):
            raise CodespaceError('That branch name is not valid.')
        body['ref'] = ref
    display_name = (display_name or '').strip()[:48]
    if display_name:
        body['display_name'] = display_name
    return _summary(_request(token, 'POST', f'/repos/{repo}/codespaces', body, timeout=90))


def get_state(server, fresh=False):
    """Current state of the Codespace saved on `server` (cached for a few seconds)."""
    now = time.time()
    with _lock:
        hit = _state_cache.get(server.id)
        if hit and not fresh and now - hit[0] < STATE_TTL:
            return hit[1]
    info = _summary(_request(server.gh_token, 'GET', f'/user/codespaces/{server.codespace_name}'))
    with _lock:
        _state_cache[server.id] = (time.time(), info)
    return info


def cached_state(server_id):
    """Last known state without any network call (None if never checked)."""
    with _lock:
        hit = _state_cache.get(server_id)
    return hit[1] if hit else None


def _forget(server_id):
    with _lock:
        _state_cache.pop(server_id, None)
        _config_cache.pop(server_id, None)


def start(server):
    _request(server.gh_token, 'POST', f'/user/codespaces/{server.codespace_name}/start', timeout=60)
    _forget(server.id)
    return get_state(server, fresh=True)


def stop(server):
    _request(server.gh_token, 'POST', f'/user/codespaces/{server.codespace_name}/stop', timeout=60)
    _forget(server.id)
    return get_state(server, fresh=True)


def ensure_available(server):
    """Raise CodespaceStopped unless the Codespace is running, so a connection attempt cannot wake it up."""
    info = get_state(server)
    if not info['available']:
        raise CodespaceStopped(
            f"Codespace is {info['state']}, not running. Press Start (it uses your GitHub quota) and connect again.",
            info['state'])
    from services import quota
    quota.check_may_run(server)
    return info


# ---------------------------------------------------------------- SSH through `gh`
def _gh_binary():
    path = shutil.which('gh')
    if not path:
        raise CodespaceError('The GitHub CLI (gh) is not installed on the ShellMan host. '
                             'Install it from https://cli.github.com or use the official ShellMan Docker image.')
    return path


def _gh_env(token):
    env = dict(os.environ)
    env.update(GH_TOKEN=token, GH_PROMPT_DISABLED='1', GH_NO_UPDATE_NOTIFIER='1', NO_COLOR='1')
    env.pop('GITHUB_TOKEN', None)
    return env


def _own_key():
    """A passphrase-free key made just for ShellMan's Codespace connections.

    Without it, gh falls back to the user's own ~/.ssh keys, and a key that has a passphrase makes gh ask for it on
    the terminal, which hangs a background service."""
    path = os.path.join(INSTANCE_DIR, 'codespace_ed25519')
    if os.path.exists(path) and os.path.exists(path + '.pub'):
        return path
    keygen = shutil.which('ssh-keygen')
    if not keygen:
        raise CodespaceError('The ShellMan host needs the OpenSSH client (ssh-keygen). '
                             'Install it, for example: sudo apt install openssh-client')
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    for stale in (path, path + '.pub'):
        try:
            os.remove(stale)
        except FileNotFoundError:
            pass
    done = subprocess.run([keygen, '-q', '-t', 'ed25519', '-N', '', '-C', 'shellman-codespaces', '-f', path],
                          stdin=subprocess.DEVNULL, capture_output=True, timeout=30, start_new_session=True)
    if done.returncode != 0 or not os.path.exists(path):
        raise CodespaceError('Could not create the ShellMan SSH key: ' + (done.stderr or b'').decode('utf-8', 'replace')[-200:])
    os.chmod(path, 0o600)
    return path


def ssh_params(server):
    """(proxy_command, identity_file, user) for the Codespace.

    The proxy command is the one `gh codespace ssh --config` prints, with ShellMan's own key. `--config` itself
    ignores a custom key and names ~/.ssh/codespaces.auto instead, which only exists after a manual first login,
    so the command is built here. The same key is used for `--stdio` (gh authorizes it on the Codespace) and for
    the SSH login, so the two always match."""
    key = _own_key()
    cmd = [_gh_binary(), 'codespace', 'ssh', '-c', server.codespace_name, '--stdio', '--', '-i', key]
    return (shlex.join(cmd), key, 'codespace')


class GhProxy(paramiko.ProxyCommand):
    """paramiko ProxyCommand that runs `gh ... --stdio` with the token in its environment (not on the command line)."""

    def __init__(self, command_line, env):
        self.cmd = shlex.split(command_line)
        self._err = tempfile.TemporaryFile()
        self.process = subprocess.Popen(self.cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=self._err, bufsize=0, env=env, start_new_session=True)
        self.timeout = None

    def stderr_tail(self):
        try:
            self._err.seek(0)
            return self._err.read(2000).decode('utf-8', 'replace').strip()
        except Exception:
            return ''

    def close(self):
        try:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
        except Exception:
            pass
        try:
            self._err.close()
        except Exception:
            pass


def open_ssh_client(server, client):
    """Connect `client` (a paramiko.SSHClient) to the Codespace of `server`. Returns the proxy so the caller can close it."""
    ensure_available(server)
    proxy_cmd, key_path, user = ssh_params(server)
    proxy = GhProxy(proxy_cmd, _gh_env(server.gh_token))
    try:
        client.connect(hostname=f'codespace-{server.codespace_name}', username=user, key_filename=key_path,
                       sock=proxy, timeout=30, banner_timeout=45, auth_timeout=30,
                       allow_agent=False, look_for_keys=False)
    except Exception as e:
        tail = proxy.stderr_tail()
        proxy.close()
        _forget(server.id)
        if tail:
            raise CodespaceError(f'{e} ({tail[:300]})')
        raise
    return proxy
