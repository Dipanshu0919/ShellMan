"""Tailscale helpers: detect the CLI, list tailnet devices, build the `tailscale nc` proxy.

The machine running ShellMan must itself be on the tailnet (tailscale installed + logged in).
Tailnet hosts are then reached by name or 100.x address; no public port is needed on the target.
"""
import json
import re
import shlex
import shutil
import subprocess
import time

_HOST_RE = re.compile(r'^[A-Za-z0-9._\-:]+$')


def cli_path():
    return shutil.which('tailscale')


def safe_host(host: str) -> bool:
    return bool(host) and bool(_HOST_RE.match(host)) and not host.startswith('-')


def status():
    """Return {'installed','running','self','devices','error'}."""
    exe = cli_path()
    if not exe:
        return {'installed': False, 'running': False, 'devices': [], 'self': None,
                'error': 'tailscale CLI not found on the ShellMan host. Install it from tailscale.com/download and run `tailscale up`.'}
    try:
        p = subprocess.run([exe, 'status', '--json'], capture_output=True, text=True, timeout=8)
    except Exception as e:
        return {'installed': True, 'running': False, 'devices': [], 'self': None, 'error': str(e)}
    if p.returncode != 0 and not p.stdout.strip():
        return {'installed': True, 'running': False, 'devices': [], 'self': None,
                'error': (p.stderr or 'tailscale status failed').strip()[:300]}
    try:
        data = json.loads(p.stdout)
    except Exception:
        return {'installed': True, 'running': False, 'devices': [], 'self': None, 'error': 'Bad output from tailscale status.'}
    running = data.get('BackendState') == 'Running'

    def dev(n, is_self=False):
        dns = (n.get('DNSName') or '').rstrip('.')
        ips = n.get('TailscaleIPs') or []
        return {
            'name': n.get('HostName') or dns.split('.')[0],
            'dns': dns,
            'ip': next((i for i in ips if '.' in i), ips[0] if ips else ''),
            'os': n.get('OS') or '',
            'online': bool(n.get('Online')) or is_self,
            'self': is_self,
        }

    me = data.get('Self')
    devices = [dev(n) for n in (data.get('Peer') or {}).values()]
    devices.sort(key=lambda d: (not d['online'], d['name'].lower()))
    return {'installed': True, 'running': running, 'self': dev(me, True) if me else None,
            'devices': devices, 'error': None if running else 'Tailscale is installed but not running/logged in (`tailscale up`).'}


_self_cache = {'t': 0.0, 'ids': set()}


def is_self(host: str) -> bool:
    """True when `host` is this machine's own tailnet name/IP. `tailscale nc` cannot dial itself,
    so the caller connects to 127.0.0.1 instead."""
    now = time.time()
    if now - _self_cache['t'] > 60:
        me = status().get('self') or {}
        ids = {str(me.get(k) or '').lower() for k in ('name', 'dns', 'ip')} - {''}
        if me.get('dns'):
            ids.add(me['dns'].split('.')[0].lower())
        _self_cache.update(t=now, ids=ids)
    return host.lower().rstrip('.') in _self_cache['ids']


def proxy_for(host: str, port: int):
    """paramiko ProxyCommand tunnelling via the tailscale daemon, or None to connect directly
    (when the CLI is absent but the host's OS routes the tailnet, e.g. system-mode tailscaled)."""
    exe = cli_path()
    if not exe or not safe_host(host):
        return None
    import paramiko
    return paramiko.ProxyCommand(f'{shlex.quote(exe)} nc {host} {int(port)}')
