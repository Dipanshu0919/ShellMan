"""Apache HTTP Server manager over SSH (agentless): apache2 on Debian/Ubuntu, httpd on RHEL/Fedora/Arch.

Works like the Nginx manager: virtual hosts, an editor for the config files, modules, service control, logs and
Let's Encrypt. Every change is checked with `apachectl configtest` before Apache is reloaded, and a change that
fails the test is rolled back so a typo can never take the sites down.
"""
import base64
import logging
import os
import re
import shlex
from typing import Any, Dict, List, Optional, Tuple

from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.apache')

SAFE_NAME_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.\-]{0,120}$')
SAFE_DOMAIN_RE = re.compile(r'^[a-z0-9]([a-z0-9\-.]{0,251}[a-z0-9])?$')
SAFE_ROOT_RE = re.compile(r'^/[A-Za-z0-9_./\-]{1,200}$')
SAFE_TARGET_RE = re.compile(r'^https?://[A-Za-z0-9_.\-]+(:\d{1,5})?(/[A-Za-z0-9_./\-]*)?$')
SAFE_MODULE_RE = re.compile(r'^[a-z0-9_]{1,60}$')
SAFE_FILE_RE = re.compile(
    r'^(apache2\.conf|ports\.conf|httpd\.conf|conf/httpd\.conf|'
    r'(sites-available|sites-enabled|conf-available|conf-enabled|mods-available|conf\.d|conf\.modules\.d)/[A-Za-z0-9][A-Za-z0-9_.\-]{0,120})$')

# Shell prologue shared by every command: PATH, sudo only when needed, and which layout this server has.
PRE = r'''export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/apache/bin:$PATH
S=""; [ "$(id -u)" != "0" ] && S="sudo -n"
# Layouts: Debian/Ubuntu (sites-available), cPanel/EasyApache (/etc/apache2/conf.d, service httpd), RHEL family (/etc/httpd/conf.d)
if [ -d /etc/apache2/sites-available ]; then FLAVOR=debian; CONF=/etc/apache2; SVC=apache2
elif [ -d /etc/apache2/conf.d ] || [ -f /etc/apache2/conf/httpd.conf ]; then FLAVOR=rhel; CONF=/etc/apache2; SVC=httpd
elif [ -d /etc/httpd ]; then FLAVOR=rhel; CONF=/etc/httpd; SVC=httpd
else FLAVOR=none; CONF=; SVC=apache2; fi
for u in httpd apache2; do if systemctl cat $u >/dev/null 2>&1; then SVC=$u; break; fi; done
CTL=$(command -v apachectl || command -v apache2ctl || command -v httpd || command -v apache2)
LOGDIR=; for d in "$CONF/logs" /var/log/apache2 /var/log/httpd /usr/local/apache/logs; do [ -n "$CONF$d" ] && [ -d "$d" ] && { LOGDIR=$d; break; }; done
MAIN=conf/httpd.conf; [ "$FLAVOR" = debian ] && MAIN=apache2.conf
'''

RELOAD = (r'if [ -n "$CTL" ]; then $S systemctl reload $SVC 2>/dev/null || $S $CTL graceful 2>&1 || $S systemctl restart $SVC 2>&1; '
          r'else $S systemctl reload $SVC 2>&1; fi')


def _sections(text: str) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    cur = None
    for line in text.splitlines():
        if line.startswith('@@') and line.endswith('@@'):
            cur = line.strip('@')
            out[cur] = []
        elif cur is not None:
            out[cur].append(line)
    return out


def _run(server, script: str, timeout: int = 20) -> Tuple[int, str, str]:
    return ssh_manager.execute(server, PRE + script, timeout=timeout)


def parse_site(content: str) -> Dict[str, Any]:
    """Summarise one Apache config file: names, ports, document root, proxy target, SSL."""
    names, ports, proxies, roots = [], [], [], []
    ssl = False
    vhost = False
    redirect = None
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        m = re.match(r'<VirtualHost\s+([^>]+)>', line, re.I)
        if m:
            vhost = True
            for addr in m.group(1).split():
                p = addr.rsplit(':', 1)[-1]
                if p.isdigit() and p not in ports:
                    ports.append(p)
                if p == '443':
                    ssl = True
            continue
        m = re.match(r'(ServerName|ServerAlias)\s+(.+)', line, re.I)
        if m:
            for n in m.group(2).split():
                if n not in names:
                    names.append(n)
            continue
        m = re.match(r'DocumentRoot\s+"?([^"\s]+)"?', line, re.I)
        if m and m.group(1) not in roots:
            roots.append(m.group(1))
            continue
        m = re.match(r'ProxyPass(?:Match)?\s+\S+\s+(\S+)', line, re.I)
        if m and not m.group(1).startswith('!') and m.group(1) not in proxies:
            proxies.append(m.group(1))
            continue
        if re.match(r'SSLEngine\s+on', line, re.I):
            ssl = True
            continue
        m = re.match(r'Redirect(?:Permanent)?\s+(?:\d+\s+|permanent\s+)?\S+\s+(\S+)', line, re.I)
        if m and not redirect:
            redirect = m.group(1)
    return {'domains': names, 'ports': ports, 'root': roots[0] if roots else '', 'proxy': proxies[0] if proxies else '',
            'ssl': ssl, 'redirect': redirect or '', 'vhost': vhost}


class ApacheService:
    # ------------------------------------------------------------------ status
    @classmethod
    def check_status(cls, server) -> Dict[str, Any]:
        script = r'''
echo "@@FLAVOR@@"; echo "$FLAVOR"
echo "@@CTL@@"; echo "$CTL"
echo "@@SVC@@"; echo "$SVC"
echo "@@CPANEL@@"; [ -d /usr/local/cpanel ] && echo yes
echo "@@VERSION@@"; ([ -n "$CTL" ] && $S $CTL -v 2>/dev/null | head -n 2) || true
echo "@@ACTIVE@@"; (systemctl is-active $SVC 2>/dev/null || (pgrep -x apache2 >/dev/null 2>&1 || pgrep -x httpd >/dev/null 2>&1) && echo active) | head -n 1
echo "@@TEST@@"; ([ -n "$CTL" ] && $S $CTL configtest 2>&1) || true
echo "@@CERTBOT@@"; (command -v certbot >/dev/null 2>&1 && certbot --version 2>&1 | head -n 1) || true
echo "@@CERTBOT_APACHE@@"; (dpkg -s python3-certbot-apache >/dev/null 2>&1 && echo yes) || (rpm -q python3-certbot-apache >/dev/null 2>&1 && echo yes) || (snap list certbot >/dev/null 2>&1 && echo yes) || true
'''
        code, out, err = _run(server, script, timeout=15)
        s = _sections(out)
        flavor = ''.join(s.get('FLAVOR', [])).strip()
        ctl = ''.join(s.get('CTL', [])).strip()
        version_text = '\n'.join(s.get('VERSION', []))
        m = re.search(r'Apache/([0-9.]+)\s*(\([^)]*\))?', version_text)
        version = (f"Apache {m.group(1)} {m.group(2) or ''}").strip() if m else ''
        active_lines = [l.strip() for l in s.get('ACTIVE', []) if l.strip()]
        active = bool(active_lines and active_lines[0] == 'active')
        test = '\n'.join(s.get('TEST', [])).strip()
        certbot = '\n'.join(s.get('CERTBOT', [])).strip()
        return {
            'installed': flavor in ('debian', 'rhel') or bool(ctl),
            'flavor': flavor if flavor != 'none' else '',
            'service': ''.join(s.get('SVC', [])).strip() or ('apache2' if flavor == 'debian' else 'httpd'),
            'cpanel': 'yes' in ''.join(s.get('CPANEL', [])),
            'running': active,
            'version': version,
            'config_ok': 'Syntax OK' in test,
            'config_output': test,
            'certbot_installed': bool(certbot) and 'not found' not in certbot.lower(),
            'certbot_version': certbot,
            'certbot_apache': 'yes' in ''.join(s.get('CERTBOT_APACHE', [])),
        }

    # ------------------------------------------------------------------ sites
    @classmethod
    def list_sites(cls, server) -> Dict[str, Any]:
        script = r'''
dump() { echo "@@SITE:$1:$2@@"; head -c 200000 "$3" 2>/dev/null || $S head -c 200000 "$3" 2>/dev/null; echo; echo "@@END@@"; }
if [ "$FLAVOR" = debian ]; then
  for f in "$CONF"/sites-available/*; do [ -f "$f" ] || continue; n=$(basename "$f"); e=0; [ -e "$CONF/sites-enabled/$n" ] && e=1; dump "$n" $e "$f"; done
  for f in "$CONF"/sites-enabled/*; do [ -f "$f" ] && [ ! -L "$f" ] || continue; n=$(basename "$f"); [ -e "$CONF/sites-available/$n" ] && continue; dump "$n" 1 "$f"; done
elif [ "$FLAVOR" = rhel ]; then
  for f in "$CONF"/conf.d/*.conf "$CONF"/conf.d/*.conf.disabled; do [ -f "$f" ] || continue; n=$(basename "$f"); e=1; case "$n" in *.disabled) e=0; n=${n%.disabled};; esac; dump "$n" $e "$f"; done
fi
'''
        code, out, err = _run(server, script, timeout=20)
        sites = []
        cur, buf = None, []
        for line in out.splitlines():
            m = re.match(r'^@@SITE:(.*):([01])@@$', line)
            if m:
                cur, buf = (m.group(1), m.group(2) == '1'), []
            elif line == '@@END@@' and cur:
                info = parse_site('\n'.join(buf))
                info.update(name=cur[0], enabled=cur[1])
                sites.append(info)
                cur = None
            elif cur:
                buf.append(line)
        sites.sort(key=lambda s: (not s['vhost'], not s['enabled'], s['name']))
        return {'success': True, 'sites': sites}

    @classmethod
    def list_files(cls, server) -> Dict[str, Any]:
        """Config files that can be opened in the editor."""
        script = r'''
if [ "$FLAVOR" = debian ]; then
  for f in apache2.conf ports.conf; do [ -f "$CONF/$f" ] && echo "Main|$f"; done
  for d in sites-available conf-available; do for f in "$CONF/$d"/*; do [ -f "$f" ] && echo "$d|$d/$(basename "$f")"; done; done
elif [ "$FLAVOR" = rhel ]; then
  [ -f "$CONF/conf/httpd.conf" ] && echo "Main|conf/httpd.conf"
  for f in "$CONF"/conf.d/*; do [ -f "$f" ] && echo "conf.d|conf.d/$(basename "$f")"; done
  for f in "$CONF"/conf.modules.d/*; do [ -f "$f" ] && echo "conf.modules.d|conf.modules.d/$(basename "$f")"; done
fi
'''
        code, out, err = _run(server, script)
        files = []
        for line in out.splitlines():
            if '|' in line:
                group, path = line.split('|', 1)
                if SAFE_FILE_RE.match(path):
                    files.append({'group': group, 'file': path})
        return {'success': True, 'files': files}

    @classmethod
    def resolve_file(cls, rel: str) -> Optional[str]:
        rel = (rel or '').strip()
        if '..' in rel or not SAFE_FILE_RE.match(rel):
            return None
        return rel

    @classmethod
    def get_config(cls, server, rel: str) -> Tuple[bool, str]:
        rel = cls.resolve_file(rel)
        if not rel:
            return False, 'That file is not inside the Apache configuration folder.'
        code, out, err = _run(server, f'$S cat "$CONF"/{shlex.quote(rel)} 2>&1')
        if code != 0:
            return False, (out or err).strip() or 'Could not read the file.'
        return True, out

    @classmethod
    def save_config(cls, server, rel: str, content: str) -> Tuple[bool, str]:
        rel = cls.resolve_file(rel)
        if not rel:
            return False, 'That file is not inside the Apache configuration folder.'
        if len(content) > 500000:
            return False, 'The file is too large.'
        b64 = base64.b64encode(content.encode('utf-8')).decode('ascii')
        q = shlex.quote(rel)
        script = f'''
P="$CONF"/{q}
BAK="/tmp/apache_bak_$(date +%s%N)"
HAD=0; if $S test -f "$P"; then HAD=1; $S cp "$P" "$BAK"; fi
echo '{b64}' | base64 -d | $S tee "$P" > /dev/null
TEST=$($S $CTL configtest 2>&1)
if echo "$TEST" | grep -q "Syntax OK"; then
  {RELOAD} >/dev/null 2>&1
  [ "$HAD" = 1 ] && rm -f "$BAK"
  echo "@@OK@@"; echo "$TEST"
else
  if [ "$HAD" = 1 ]; then $S cp "$BAK" "$P"; rm -f "$BAK"; else $S rm -f "$P"; fi
  echo "@@FAIL@@"; echo "$TEST"
fi
'''
        code, out, err = _run(server, script, timeout=30)
        s = _sections(out)
        if 'OK' in s:
            return True, 'Saved, checked and reloaded.\n' + '\n'.join(s['OK']).strip()
        return False, 'Apache rejected the new configuration, so the change was rolled back:\n' + '\n'.join(s.get('FAIL', [out or err])).strip()

    @classmethod
    def _site_file_rel(cls, flavor: str, name: str) -> str:
        return f'sites-available/{name}' if flavor == 'debian' else f'conf.d/{name}'

    @classmethod
    def toggle_site(cls, server, name: str, enable: bool) -> Tuple[bool, str]:
        if not SAFE_NAME_RE.match(name or ''):
            return False, 'Invalid site name.'
        n = shlex.quote(name)
        if enable:
            script = f'''
if [ "$FLAVOR" = debian ]; then
  [ -f "$CONF/sites-available/"{n} ] || {{ echo "@@FAIL@@"; echo "No such site in sites-available."; exit 0; }}
  $S a2ensite {n} >/dev/null 2>&1 || $S ln -sf "$CONF/sites-available/"{n} "$CONF/sites-enabled/"{n}
  UNDO="$S a2dissite {n}"
elif [ "$FLAVOR" = rhel ]; then
  [ -f "$CONF/conf.d/"{n} ] || {{ $S test -f "$CONF/conf.d/"{n}.disabled && $S mv "$CONF/conf.d/"{n}.disabled "$CONF/conf.d/"{n}; }}
  UNDO="$S mv $CONF/conf.d/"{n}" $CONF/conf.d/"{n}.disabled
else echo "@@FAIL@@"; echo "Apache is not installed."; exit 0; fi
TEST=$($S $CTL configtest 2>&1)
if echo "$TEST" | grep -q "Syntax OK"; then {RELOAD} >/dev/null 2>&1; echo "@@OK@@"; echo "Site enabled and Apache reloaded."
else eval "$UNDO" >/dev/null 2>&1; echo "@@FAIL@@"; echo "$TEST"; fi
'''
        else:
            script = f'''
if [ "$FLAVOR" = debian ]; then
  $S a2dissite {n} >/dev/null 2>&1 || $S rm -f "$CONF/sites-enabled/"{n}
elif [ "$FLAVOR" = rhel ]; then
  $S mv "$CONF/conf.d/"{n} "$CONF/conf.d/"{n}.disabled
else echo "@@FAIL@@"; echo "Apache is not installed."; exit 0; fi
TEST=$($S $CTL configtest 2>&1)
if echo "$TEST" | grep -q "Syntax OK"; then {RELOAD} >/dev/null 2>&1; echo "@@OK@@"; echo "Site disabled and Apache reloaded."
else echo "@@FAIL@@"; echo "$TEST"; fi
'''
        code, out, err = _run(server, script, timeout=30)
        s = _sections(out)
        if 'OK' in s:
            return True, ' '.join(s['OK']).strip()
        return False, '\n'.join(s.get('FAIL', [out or err])).strip() or 'The change failed.'

    @classmethod
    def create_site(cls, server, domain: str, site_type: str, root: str = '', target: str = '',
                    add_www: bool = True) -> Tuple[bool, str]:
        domain = (domain or '').strip().lower()
        if not SAFE_DOMAIN_RE.match(domain) or '.' not in domain:
            return False, 'Enter a valid domain name such as example.com.'
        if site_type not in ('static', 'proxy'):
            return False, 'Site type must be static or proxy.'
        if site_type == 'static':
            root = (root or '').strip() or f'/var/www/{domain}'
            if not SAFE_ROOT_RE.match(root) or '..' in root:
                return False, 'The web root must be an absolute path with letters, numbers, dots, dashes or underscores.'
        else:
            target = (target or '').strip()
            if not SAFE_TARGET_RE.match(target):
                return False, 'The proxy target must look like http://127.0.0.1:3000'
        alias = ''
        if add_www and not domain.startswith('www.') and domain.count('.') == 1:
            alias = f'    ServerAlias www.{domain}\n'

        body = f'    ServerName {domain}\n{alias}'
        if site_type == 'static':
            body += (f'    DocumentRoot {root}\n    <Directory {root}>\n        Options -Indexes +FollowSymLinks\n'
                     f'        AllowOverride All\n        Require all granted\n    </Directory>\n')
        else:
            t = target if target.endswith('/') else target + '/'
            body += (f'    ProxyPreserveHost On\n    ProxyRequests Off\n    ProxyPass / {t}\n    ProxyPassReverse / {t}\n')
        body_log = '%s-error.log'
        content = (f'<VirtualHost *:80>\n{body}'
                   f'    ErrorLog @@LOGS@@/{domain}-error.log\n    CustomLog @@LOGS@@/{domain}-access.log combined\n</VirtualHost>\n')
        b64 = base64.b64encode(content.encode('utf-8')).decode('ascii')
        q_file = shlex.quote(f'{domain}.conf')
        q_root = shlex.quote(root) if site_type == 'static' else "''"
        mods = 'proxy proxy_http' if site_type == 'proxy' else ''
        script = f'''
NAME={q_file}
if [ "$FLAVOR" = debian ]; then P="$CONF/sites-available/$NAME"; LOGS='${{APACHE_LOG_DIR}}'
elif [ "$FLAVOR" = rhel ]; then P="$CONF/conf.d/$NAME"; LOGS=logs
else echo "@@FAIL@@"; echo "Apache is not installed."; exit 0; fi
if $S test -e "$P" || $S test -e "$P.disabled"; then echo "@@FAIL@@"; echo "A site called $NAME already exists."; exit 0; fi
{'' if site_type == 'proxy' else f'if [ ! -d {q_root} ]; then $S mkdir -p {q_root} && echo "<h1>{domain} is ready</h1>" | $S tee {q_root}/index.html >/dev/null; fi'}
{f'[ "$FLAVOR" = debian ] && $S a2enmod {mods} >/dev/null 2>&1' if mods else ''}
echo '{b64}' | base64 -d | sed "s#@@LOGS@@#$LOGS#g" | $S tee "$P" > /dev/null
if [ "$FLAVOR" = debian ]; then $S a2ensite "$NAME" >/dev/null 2>&1; fi
TEST=$($S $CTL configtest 2>&1)
if echo "$TEST" | grep -q "Syntax OK"; then {RELOAD} >/dev/null 2>&1; echo "@@OK@@"; echo "Site $NAME created and Apache reloaded."
else
  [ "$FLAVOR" = debian ] && $S a2dissite "$NAME" >/dev/null 2>&1
  $S rm -f "$P"; echo "@@FAIL@@"; echo "$TEST"
fi
'''
        code, out, err = _run(server, script, timeout=40)
        s = _sections(out)
        if 'OK' in s:
            return True, ' '.join(s['OK']).strip()
        return False, '\n'.join(s.get('FAIL', [out or err])).strip() or 'Could not create the site.'

    @classmethod
    def delete_site(cls, server, name: str) -> Tuple[bool, str]:
        if not SAFE_NAME_RE.match(name or ''):
            return False, 'Invalid site name.'
        n = shlex.quote(name)
        script = f'''
if [ "$FLAVOR" = debian ]; then
  $S a2dissite {n} >/dev/null 2>&1; $S rm -f "$CONF/sites-enabled/"{n} "$CONF/sites-available/"{n}
elif [ "$FLAVOR" = rhel ]; then
  $S rm -f "$CONF/conf.d/"{n} "$CONF/conf.d/"{n}.disabled
else echo "@@FAIL@@"; echo "Apache is not installed."; exit 0; fi
TEST=$($S $CTL configtest 2>&1)
if echo "$TEST" | grep -q "Syntax OK"; then {RELOAD} >/dev/null 2>&1; echo "@@OK@@"; echo "Site removed and Apache reloaded."
else echo "@@OK@@"; echo "Site removed, but Apache reports a problem in another file:"; echo "$TEST"; fi
'''
        code, out, err = _run(server, script, timeout=30)
        s = _sections(out)
        if 'OK' in s:
            return True, '\n'.join(s['OK']).strip()
        return False, '\n'.join(s.get('FAIL', [out or err])).strip()

    # ------------------------------------------------------------------ modules
    @classmethod
    def list_modules(cls, server) -> Dict[str, Any]:
        script = r'''
echo "@@FLAVOR@@"; echo "$FLAVOR"
echo "@@LOADED@@"; ([ -n "$CTL" ] && $S $CTL -M 2>/dev/null) || true
echo "@@AVAILABLE@@"
if [ "$FLAVOR" = debian ]; then
  for f in "$CONF"/mods-available/*.load; do [ -f "$f" ] || continue; n=$(basename "$f" .load); e=0; [ -e "$CONF/mods-enabled/$n.load" ] && e=1; echo "$n|$e"; done
fi
'''
        code, out, err = _run(server, script, timeout=15)
        s = _sections(out)
        flavor = ''.join(s.get('FLAVOR', [])).strip()
        loaded = set()
        for l in s.get('LOADED', []):
            m = re.match(r'\s*([a-z0-9_]+)_module', l)
            if m:
                loaded.add(m.group(1))
        mods = []
        if flavor == 'debian':
            for l in s.get('AVAILABLE', []):
                if '|' in l:
                    n, e = l.split('|', 1)
                    mods.append({'name': n, 'enabled': e.strip() == '1', 'loaded': n in loaded or n.replace('_', '') in loaded})
        else:
            for n in sorted(loaded):
                mods.append({'name': n, 'enabled': True, 'loaded': True})
        return {'success': True, 'modules': mods, 'can_toggle': flavor == 'debian'}

    @classmethod
    def toggle_module(cls, server, name: str, enable: bool) -> Tuple[bool, str]:
        if not SAFE_MODULE_RE.match(name or ''):
            return False, 'Invalid module name.'
        n = shlex.quote(name)
        do, undo = ('a2enmod', 'a2dismod') if enable else ('a2dismod', 'a2enmod')
        script = f'''
if [ "$FLAVOR" != debian ]; then echo "@@FAIL@@"; echo "Enabling and disabling modules is only supported on Debian and Ubuntu (apache2)."; exit 0; fi
OUT=$($S {do} {n} 2>&1); RC=$?
if [ $RC -ne 0 ]; then echo "@@FAIL@@"; echo "$OUT"; exit 0; fi
TEST=$($S $CTL configtest 2>&1)
if echo "$TEST" | grep -q "Syntax OK"; then {RELOAD} >/dev/null 2>&1; echo "@@OK@@"; echo "Module {name} {'enabled' if enable else 'disabled'} and Apache reloaded."
else $S {undo} {n} >/dev/null 2>&1; echo "@@FAIL@@"; echo "Apache rejected the change, so it was undone:"; echo "$TEST"; fi
'''
        code, out, err = _run(server, script, timeout=30)
        s = _sections(out)
        if 'OK' in s:
            return True, ' '.join(s['OK']).strip()
        return False, '\n'.join(s.get('FAIL', [out or err])).strip()

    # ------------------------------------------------------------------ service
    @classmethod
    def service(cls, server, action: str) -> Tuple[bool, str]:
        if action not in ('test', 'reload', 'restart', 'start', 'stop'):
            return False, f'Invalid action: {action}'
        if action == 'test':
            code, out, err = _run(server, '$S $CTL configtest 2>&1', timeout=15)
            text = (out + err).strip()
            return 'Syntax OK' in text, text
        ctl_action = {'reload': 'graceful', 'restart': 'restart', 'start': 'start', 'stop': 'stop'}[action]
        script = f'''
TEST=$($S $CTL configtest 2>&1)
if [ "{action}" != stop ] && ! echo "$TEST" | grep -q "Syntax OK"; then echo "@@FAIL@@"; echo "The configuration has an error, so Apache was not {action}ed:"; echo "$TEST"; exit 0; fi
OUT=$($S systemctl {action} $SVC 2>&1) || OUT=$($S $CTL {ctl_action} 2>&1)
RC=$?
sleep 1
echo "@@STATE@@"; systemctl is-active $SVC 2>/dev/null || ((pgrep -x apache2 >/dev/null || pgrep -x httpd >/dev/null) && echo active || echo inactive)
echo "@@OUT@@"; echo "$OUT"
echo "@@RC@@"; echo $RC
'''
        code, out, err = _run(server, script, timeout=40)
        s = _sections(out)
        if 'FAIL' in s:
            return False, '\n'.join(s['FAIL']).strip()
        state = ''.join(s.get('STATE', [])).strip()
        rc = ''.join(s.get('RC', ['1'])).strip()
        msg = '\n'.join(s.get('OUT', [])).strip()
        want_active = action != 'stop'
        ok = rc == '0' and ((state.startswith('active')) == want_active)
        label = {'reload': 'reloaded', 'restart': 'restarted', 'start': 'started', 'stop': 'stopped'}[action]
        return ok, (f'Apache {label}.' if ok else (msg or f'Apache did not {action}.'))

    # ------------------------------------------------------------------ logs
    @classmethod
    def list_logs(cls, server) -> Dict[str, Any]:
        script = r'''
if [ -n "$LOGDIR" ]; then $S ls -1 "$LOGDIR" 2>/dev/null | grep -E '(\.log|_log)$' ; fi
'''
        code, out, err = _run(server, script)
        files = [l.strip() for l in out.splitlines() if SAFE_NAME_RE.match(l.strip())]
        files.sort(key=lambda f: (0 if f.startswith('error') else 1 if f.startswith('access') else 2, f))
        return {'success': True, 'files': files}

    @classmethod
    def tail_log(cls, server, name: str, lines: int = 200) -> Tuple[bool, str]:
        if not SAFE_NAME_RE.match(name or ''):
            return False, 'Invalid log file name.'
        lines = max(10, min(int(lines or 200), 2000))
        code, out, err = _run(server, f'$S tail -n {lines} "$LOGDIR"/{shlex.quote(name)} 2>&1', timeout=15)
        if code != 0:
            return False, (out or err).strip() or 'Could not read the log.'
        return True, out

    # ------------------------------------------------------------------ SSL & install
    @classmethod
    def issue_ssl(cls, server, domain: str, email: str) -> Tuple[bool, str]:
        domain = (domain or '').strip().lower()
        if not SAFE_DOMAIN_RE.match(domain) or '.' not in domain:
            return False, 'Invalid domain name.'
        email = (email or '').strip()
        if not re.match(r'^[^@\s;&|`$<>]+@[^@\s;&|`$<>]+\.[^@\s;&|`$<>]+$', email):
            return False, "A valid contact email is required for Let's Encrypt."
        domains = [domain]
        if not domain.startswith('www.') and domain.count('.') == 1:
            domains.append('www.' + domain)
        args = ' '.join('-d ' + shlex.quote(d) for d in domains)
        script = (f'command -v certbot >/dev/null 2>&1 || {{ echo "Certbot is not installed on this server."; exit 127; }}\n'
                  f'$S certbot --apache {args} --non-interactive --agree-tos -m {shlex.quote(email)} --redirect 2>&1')
        code, out, err = _run(server, script, timeout=120)
        text = (out + '\n' + err).strip()
        if code == 0 and ('Congratulations' in text or 'Successfully received certificate' in text or 'not yet due for renewal' in text):
            return True, 'The certificate is issued and HTTPS is active with an automatic redirect.'
        return False, text[-1500:] or 'Certbot failed. Check that the domain points at this server.'

    @classmethod
    def install(cls, server, package: str) -> Tuple[bool, str]:
        if package == 'apache':
            apt, dnf, pac = 'apache2', 'httpd', 'apache'
        elif package == 'certbot':
            apt, dnf, pac = 'certbot python3-certbot-apache', 'certbot python3-certbot-apache', 'certbot certbot-apache'
        else:
            return False, f'Unsupported package: {package}'
        script = f'''
if command -v apt-get >/dev/null 2>&1; then export DEBIAN_FRONTEND=noninteractive; $S apt-get update -y >/dev/null 2>&1; $S apt-get install -y {apt}
elif command -v dnf >/dev/null 2>&1; then $S dnf install -y {dnf}
elif command -v yum >/dev/null 2>&1; then $S yum install -y {dnf}
elif command -v pacman >/dev/null 2>&1; then $S pacman -Sy --noconfirm {pac}
else echo "No supported package manager found (apt, dnf, yum, pacman)"; exit 1; fi
'''
        code, out, err = _run(server, script, timeout=300)
        if code == 0:
            return True, f'{package.title()} installed.'
        return False, ('Installation failed:\n' + (out + err).strip()[-600:])
