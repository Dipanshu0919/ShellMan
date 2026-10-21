import os
import re
import shlex
import base64
import logging
from typing import List, Dict, Any, Tuple, Optional
from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.nginx')

SAFE_DOMAIN_RE = re.compile(r'^[a-zA-Z0-9_\-\.\* ]+$')
SAFE_FILENAME_RE = re.compile(r'^[a-zA-Z0-9_\-\.]+$')

class NginxService:
    """
    Manages remote Nginx web server configurations, reverse proxy routing,
    and Certbot Let's Encrypt SSL certificates agentlessly over SSH.
    """

    @classmethod
    def check_status(cls, server) -> Dict[str, Any]:
        """
        Check if Nginx and Certbot are installed, active, and functioning.
        """
        # Single-pass check for nginx binary, version, service state, and certbot
        probe_cmd = (
            "export PATH=/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH; "
            "echo '---NGINX_WHICH---'; command -v nginx 2>/dev/null || which nginx 2>/dev/null || (test -x /usr/sbin/nginx && echo /usr/sbin/nginx) || true; "
            "echo '---NGINX_VER---'; (nginx -v 2>&1 || /usr/sbin/nginx -v 2>&1) || true; "
            "echo '---NGINX_STATUS---'; (systemctl is-active nginx 2>/dev/null || systemctl is-active nginx.service 2>/dev/null) || true; "
            "echo '---CERTBOT_WHICH---'; (sudo -n command -v certbot 2>/dev/null || command -v certbot 2>/dev/null || (test -x /snap/bin/certbot && echo /snap/bin/certbot) || (test -x /usr/bin/certbot && echo /usr/bin/certbot)) || true; "
            "echo '---CERTBOT_VER---'; (sudo -n certbot --version 2>&1 || sudo -n /snap/bin/certbot --version 2>&1 || sudo -n /usr/bin/certbot --version 2>&1 || certbot --version 2>&1) || true; "
            "echo '---NGINX_TEST---'; (sudo -n nginx -t 2>&1 || sudo -n /usr/sbin/nginx -t 2>&1 || nginx -t 2>&1 || /usr/sbin/nginx -t 2>&1) || true;"
        )
        code, stdout, _ = ssh_manager.execute(server, probe_cmd, timeout=12)

        sections = {}
        curr_key = None
        for line in stdout.splitlines():
            if line.startswith('---') and line.endswith('---'):
                curr_key = line.strip('-')
                sections[curr_key] = []
            elif curr_key:
                sections[curr_key].append(line)

        nginx_bin = "\n".join(sections.get('NGINX_WHICH', [])).strip()
        nginx_ver = "\n".join(sections.get('NGINX_VER', [])).strip()
        nginx_active = "\n".join(sections.get('NGINX_STATUS', [])).strip()
        certbot_bin = "\n".join(sections.get('CERTBOT_WHICH', [])).strip()
        certbot_ver = "\n".join(sections.get('CERTBOT_VER', [])).strip()
        nginx_test = "\n".join(sections.get('NGINX_TEST', [])).strip()

        is_running = (nginx_active == 'active')
        test_ok = ('syntax is ok' in nginx_test and 'test is successful' in nginx_test)

        # Clean Nginx version and presence
        clean_nginx_ver = ''
        for line in nginx_ver.splitlines():
            if 'nginx version:' in line.lower():
                clean_nginx_ver = line.split('nginx version:', 1)[1].strip()
                break
            elif 'nginx/' in line.lower() and 'not found' not in line.lower():
                clean_nginx_ver = line.strip()
                break

        is_nginx_installed = bool(
            (nginx_bin and 'nginx' in nginx_bin and 'not found' not in nginx_bin.lower()) or
            clean_nginx_ver or
            is_running
        )

        # Parse Certbot status & detect broken Python dependencies
        certbot_is_broken = False
        clean_certbot_ver = ''
        is_certbot_installed = False

        if certbot_bin and ('certbot' in certbot_bin) and ('not found' not in certbot_bin.lower()):
            if 'traceback' in certbot_ver.lower() or 'attributeerror' in certbot_ver.lower() or 'modulenotfounderror' in certbot_ver.lower():
                certbot_is_broken = True
                is_certbot_installed = False
                clean_certbot_ver = 'Broken (OpenSSL Error)'
            else:
                first_line = certbot_ver.splitlines()[0] if certbot_ver else ''
                if 'certbot' in first_line.lower():
                    is_certbot_installed = True
                    clean_certbot_ver = first_line.strip()
                else:
                    is_certbot_installed = True
                    clean_certbot_ver = first_line.strip() or 'Installed'

        return {
            'nginx_installed': is_nginx_installed,
            'nginx_running': is_running,
            'nginx_version': clean_nginx_ver or ('Installed' if is_nginx_installed else 'Not installed'),
            'nginx_test_ok': test_ok,
            'nginx_test_output': nginx_test,
            'certbot_installed': is_certbot_installed,
            'certbot_broken': certbot_is_broken,
            'certbot_version': clean_certbot_ver or ('Installed' if is_certbot_installed else 'Not installed'),
            'certbot_error': certbot_ver if certbot_is_broken else ''
        }

    @classmethod
    def list_sites(cls, server) -> List[Dict[str, Any]]:
        """
        List all configured sites from /etc/nginx/sites-available, sites-enabled, and conf.d.
        """
        script = r"""
python3 -c "
import os, re, json, glob

sites_avail = '/etc/nginx/sites-available'
sites_enab = '/etc/nginx/sites-enabled'
conf_d = '/etc/nginx/conf.d'

results = []
seen_files = set()

def parse_nginx_conf(filepath, is_enabled_override=None):
    if not os.path.isfile(filepath):
        return None
    try:
        with open(filepath, 'r', errors='replace') as f:
            content = f.read()
    except Exception:
        return None

    filename = os.path.basename(filepath)
    is_enabled = is_enabled_override
    if is_enabled is None:
        enabled_link = os.path.join(sites_enab, filename)
        is_enabled = os.path.exists(enabled_link) or filepath.startswith(conf_d)

    # Extract server_names
    server_names = []
    for m in re.finditer(r'server_name\s+([^;]+);', content):
        names = m.group(1).split()
        for n in names:
            if n and n != '_':
                server_names.append(n)

    # Extract listen ports
    ports = []
    has_ssl = False
    for m in re.finditer(r'listen\s+([^;]+);', content):
        val = m.group(1)
        if 'ssl' in val:
            has_ssl = True
        port_match = re.search(r'(\d+)', val)
        if port_match:
            p = int(port_match.group(1))
            if p not in ports:
                ports.append(p)

    if 'ssl_certificate' in content:
        has_ssl = True

    # Extract proxy_pass
    proxy_pass = None
    pm = re.search(r'proxy_pass\s+([^;]+);', content)
    if pm:
        proxy_pass = pm.group(1).strip()

    # Extract root
    root = None
    rm = re.search(r'root\s+([^;]+);', content)
    if rm:
        root = rm.group(1).strip()

    primary_domain = server_names[0] if server_names else filename.replace('.conf', '')

    site_type = 'proxy' if proxy_pass else ('static' if root else 'custom')

    return {
        'filename': filename,
        'path': filepath,
        'domain': primary_domain,
        'server_names': server_names,
        'ports': ports or [80],
        'has_ssl': has_ssl,
        'site_type': site_type,
        'proxy_pass': proxy_pass,
        'root': root,
        'enabled': is_enabled,
        'is_symlink': os.path.islink(filepath)
    }

# Check sites-available
if os.path.isdir(sites_avail):
    for f in os.listdir(sites_avail):
        p = os.path.join(sites_avail, f)
        parsed = parse_nginx_conf(p)
        if parsed:
            seen_files.add(f)
            results.append(parsed)

# Check conf.d
if os.path.isdir(conf_d):
    for f in os.listdir(conf_d):
        if f.endswith('.conf') and f not in seen_files:
            p = os.path.join(conf_d, f)
            parsed = parse_nginx_conf(p, is_enabled_override=True)
            if parsed:
                seen_files.add(f)
                results.append(parsed)

# Sort: enabled first, then domain
results.sort(key=lambda s: (not s['enabled'], s['domain']))
print(json.dumps(results))
" 2>/dev/null || echo "[]"
"""
        code, stdout, _ = ssh_manager.execute(server, script, timeout=12)
        import json
        try:
            sites = json.loads(stdout.strip() or "[]")
            return sites
        except Exception as e:
            logger.error(f"Failed to parse Nginx sites list: {e}")
            return []

    @classmethod
    def resolve_config_path(cls, filename: str) -> Tuple[bool, str]:
        """
        Validate and resolve a config filename or path strictly within /etc/nginx/.
        Returns (is_valid, resolved_path_or_error).
        """
        filename = filename.strip()
        if not filename:
            return False, "Filename cannot be empty"

        if filename in ('nginx.conf', '/etc/nginx/nginx.conf'):
            return True, '/etc/nginx/nginx.conf'

        # If full path was passed, ensure it is within /etc/nginx/
        if filename.startswith('/etc/nginx/'):
            clean = os.path.normpath(filename)
            allowed_prefixes = (
                '/etc/nginx/sites-available/',
                '/etc/nginx/sites-enabled/',
                '/etc/nginx/conf.d/',
                '/etc/nginx/'
            )
            if any(clean.startswith(prefix) for prefix in allowed_prefixes):
                base = os.path.basename(clean)
                if SAFE_FILENAME_RE.match(base):
                    return True, clean
            return False, "Invalid path: file must reside inside /etc/nginx/"

        # Simple filename (e.g. 'default' or 'example.com.conf')
        if not SAFE_FILENAME_RE.match(filename):
            return False, "Invalid filename format"

        return True, filename

    @classmethod
    def get_config_content(cls, server, filename: str) -> Tuple[bool, str]:
        """
        Retrieve raw configuration file content safely.
        """
        ok, res = cls.resolve_config_path(filename)
        if not ok:
            return False, res

        if res.startswith('/etc/nginx/'):
            path = res
        else:
            quoted_fn = shlex.quote(res)
            check_script = f"""
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
if [ -f "/etc/nginx/sites-available/{quoted_fn}" ]; then
    echo "/etc/nginx/sites-available/{quoted_fn}"
elif [ -f "/etc/nginx/conf.d/{quoted_fn}" ]; then
    echo "/etc/nginx/conf.d/{quoted_fn}"
elif [ -f "/etc/nginx/{quoted_fn}" ]; then
    echo "/etc/nginx/{quoted_fn}"
else
    echo "/etc/nginx/sites-available/{quoted_fn}"
fi
"""
            code, stdout, _ = ssh_manager.execute(server, check_script)
            path = stdout.strip() or f"/etc/nginx/sites-available/{res}"

        cmd = f'export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH; sudo -n cat {shlex.quote(path)} 2>/dev/null || cat {shlex.quote(path)} 2>/dev/null'
        code, stdout, stderr = ssh_manager.execute(server, cmd)
        if code == 0:
            return True, stdout
        return False, f"Could not read config file '{path}': {stderr or 'File not found'}"

    @classmethod
    def save_config_content(cls, server, filename: str, content: str) -> Tuple[bool, str]:
        """
        Save configuration, validate with nginx -t, and reload if valid.
        Rolls back to backup if syntax test fails.
        """
        ok, res = cls.resolve_config_path(filename)
        if not ok:
            return False, res

        if res.startswith('/etc/nginx/'):
            path = res
        else:
            quoted_fn = shlex.quote(res)
            check_script = f"""
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
if [ -f "/etc/nginx/conf.d/{quoted_fn}" ]; then
    echo "/etc/nginx/conf.d/{quoted_fn}"
else
    echo "/etc/nginx/sites-available/{quoted_fn}"
fi
"""
            code, stdout, _ = ssh_manager.execute(server, check_script)
            path = stdout.strip() or f"/etc/nginx/sites-available/{res}"

        b64_content = base64.b64encode(content.encode('utf-8')).decode('ascii')
        quoted_path = shlex.quote(path)

        # Atomic write with backup and rollback on test failure
        script = f"""
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
BAK="/tmp/nginx_bak_$(date +%s%N).conf"
sudo -n cp {quoted_path} "$BAK" 2>/dev/null || true

echo '{b64_content}' | base64 -d | sudo -n tee {quoted_path} > /dev/null

TEST_OUT=$(sudo -n nginx -t 2>&1 || sudo -n /usr/sbin/nginx -t 2>&1)
if [ $? -eq 0 ]; then
    sudo -n systemctl reload nginx 2>/dev/null || sudo -n nginx -s reload 2>/dev/null || sudo -n /usr/sbin/nginx -s reload 2>/dev/null || true
    rm -f "$BAK" 2>/dev/null
    echo "SUCCESS"
    echo "$TEST_OUT"
else
    # Rollback
    if [ -f "$BAK" ]; then
        sudo -n cp "$BAK" {quoted_path} 2>/dev/null
        rm -f "$BAK" 2>/dev/null
    fi
    echo "FAIL"
    echo "$TEST_OUT"
fi
"""
        code, stdout, stderr = ssh_manager.execute(server, script, timeout=15)
        lines = stdout.strip().splitlines()
        status = lines[0] if lines else "FAIL"
        test_msg = "\n".join(lines[1:]) if len(lines) > 1 else (stderr or stdout)

        if status == "SUCCESS":
            return True, f"Configuration saved and Nginx reloaded successfully!\n{test_msg}"
        return False, f"Nginx syntax test failed — changes were rolled back:\n{test_msg}"

    @classmethod
    def create_site(cls, server, domain: str, site_type: str,
                    port_or_url: str = '', root_path: str = '',
                    enable_ssl: bool = False, email: str = '') -> Tuple[bool, str]:
        """
        Create a new Nginx domain configuration (Reverse Proxy or Static Root).
        """
        domain = domain.strip().lower()
        if not domain or not SAFE_DOMAIN_RE.match(domain):
            return False, "Invalid domain name. Use valid domain characters (e.g. app.example.com)."

        # Domain alias calculation (e.g. example.com and www.example.com)
        server_names = [domain]
        if not domain.startswith('www.') and '.' in domain and not domain.count('.') > 1:
            server_names.append(f"www.{domain}")
        server_name_str = " ".join(server_names)

        filename = f"{domain}.conf"

        if site_type == 'proxy':
            port_str = str(port_or_url).strip()
            if not port_str:
                return False, "Target port or host is required for reverse proxy."
            
            # Format proxy destination
            if port_str.isdigit():
                proxy_target = f"http://127.0.0.1:{port_str}"
            elif port_str.startswith('http://') or port_str.startswith('https://'):
                proxy_target = port_str
            else:
                proxy_target = f"http://{port_str}"

            config_content = f"""# ========================================================
# Nginx Configuration for {domain} (Reverse Proxy)
# Managed by ShellMan Remote Infrastructure Workspace
# ========================================================

server {{
    listen 80;
    listen [::]:80;
    server_name {server_name_str};

    # Reverse Proxy to Application
    location / {{
        proxy_pass {proxy_target};
        proxy_http_version 1.1;
        
        # WebSockets & Connection Upgrades
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Real Client IP & Host headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 60s;
    }}

    # Custom Error Pages
    error_page 502 503 504 /50x.html;
    location = /50x.html {{
        root /usr/share/nginx/html;
    }}
}}
"""
        elif site_type == 'static':
            path = root_path.strip() or f"/var/www/{domain}"
            config_content = f"""# ========================================================
# Nginx Configuration for {domain} (Static Web Root)
# Managed by ShellMan Remote Infrastructure Workspace
# ========================================================

server {{
    listen 80;
    listen [::]:80;
    server_name {server_name_str};

    root {path};
    index index.html index.htm index.php;

    location / {{
        try_files $uri $uri/ =404;
    }}

    # Cache static asset extensions
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2)$ {{
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }}
}}
"""
        else:
            return False, f"Unknown site type: {site_type}"

        b64_content = base64.b64encode(config_content.encode('utf-8')).decode('ascii')
        quoted_domain = shlex.quote(domain)
        quoted_filename = shlex.quote(filename)

        # Write, symlink, test, reload
        script = f"""
# Ensure directories exist
sudo -n mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled 2>/dev/null

TARGET="/etc/nginx/sites-available/{quoted_filename}"
LINK="/etc/nginx/sites-enabled/{quoted_filename}"

# Write config file
echo '{b64_content}' | base64 -d | sudo -n tee "$TARGET" > /dev/null

# Create symlink
sudo -n ln -sf "$TARGET" "$LINK"

# Test configuration
TEST_OUT=$(sudo -n nginx -t 2>&1)
if [ $? -eq 0 ]; then
    sudo -n systemctl reload nginx 2>/dev/null || sudo -n nginx -s reload 2>/dev/null || true
    echo "SUCCESS"
    echo "$TEST_OUT"
else
    # Rollback on test failure
    sudo -n rm -f "$LINK" "$TARGET" 2>/dev/null
    echo "FAIL"
    echo "$TEST_OUT"
fi
"""
        code, stdout, stderr = ssh_manager.execute(server, script, timeout=15)
        lines = stdout.strip().splitlines()
        status = lines[0] if lines else "FAIL"
        test_msg = "\n".join(lines[1:]) if len(lines) > 1 else (stderr or stdout)

        if status != "SUCCESS":
            return False, f"Failed to create site. Nginx syntax test error:\n{test_msg}"

        # If static site, ensure root directory exists
        if site_type == 'static':
            static_dir = root_path.strip() or f"/var/www/{domain}"
            mkdir_cmd = f"sudo -n mkdir -p {shlex.quote(static_dir)} && test -f {shlex.quote(static_dir)}/index.html || echo '<h1>Welcome to {domain}</h1><p>Managed via ShellMan</p>' | sudo -n tee {shlex.quote(static_dir)}/index.html > /dev/null"
            ssh_manager.execute(server, mkdir_cmd)

        msg = f"Site for '{domain}' created and enabled successfully!"

        # Handle Certbot SSL if requested
        if enable_ssl and email:
            ssl_ok, ssl_msg = cls.issue_ssl(server, domain, email)
            if ssl_ok:
                msg += f" Let's Encrypt SSL certificate issued and HTTPS redirection enabled!"
            else:
                msg += f" (Note: HTTP is active, but SSL issuing failed: {ssl_msg}. Verify your domain DNS A record points to this server IP)."

        return True, msg

    @classmethod
    def toggle_site(cls, server, filename: str, enable: bool) -> Tuple[bool, str]:
        """
        Enable or disable a site by creating/removing symlink in /etc/nginx/sites-enabled.
        """
        if not SAFE_FILENAME_RE.match(filename):
            return False, "Invalid filename format"

        quoted_filename = shlex.quote(filename)
        if enable:
            script = f"""
TARGET="/etc/nginx/sites-available/{quoted_filename}"
LINK="/etc/nginx/sites-enabled/{quoted_filename}"

if [ ! -f "$TARGET" ]; then
    echo "FAIL: Source config not found in /etc/nginx/sites-available/"
    exit 1
fi

sudo -n ln -sf "$TARGET" "$LINK"
TEST_OUT=$(sudo -n nginx -t 2>&1)
if [ $? -eq 0 ]; then
    sudo -n systemctl reload nginx 2>/dev/null || sudo -n nginx -s reload 2>/dev/null || true
    echo "SUCCESS: Site enabled"
else
    sudo -n rm -f "$LINK" 2>/dev/null
    echo "FAIL: Nginx test failed, site was not enabled:\\n$TEST_OUT"
fi
"""
        else:
            script = f"""
LINK="/etc/nginx/sites-enabled/{quoted_filename}"
sudo -n rm -f "$LINK"
TEST_OUT=$(sudo -n nginx -t 2>&1)
if [ $? -eq 0 ]; then
    sudo -n systemctl reload nginx 2>/dev/null || sudo -n nginx -s reload 2>/dev/null || true
    echo "SUCCESS: Site disabled"
else
    echo "FAIL: Nginx test failed after disabling:\\n$TEST_OUT"
fi
"""
        code, stdout, stderr = ssh_manager.execute(server, script, timeout=12)
        out = stdout.strip()
        if out.startswith("SUCCESS"):
            return True, out.replace("SUCCESS: ", "")
        return False, out.replace("FAIL: ", "") or stderr

    @classmethod
    def delete_site(cls, server, filename: str) -> Tuple[bool, str]:
        """
        Permanently remove a site configuration file and its enabled symlink.
        """
        if not SAFE_FILENAME_RE.match(filename):
            return False, "Invalid filename format"

        quoted_filename = shlex.quote(filename)
        script = f"""
sudo -n rm -f "/etc/nginx/sites-enabled/{quoted_filename}"
sudo -n rm -f "/etc/nginx/sites-available/{quoted_filename}"
sudo -n rm -f "/etc/nginx/conf.d/{quoted_filename}"

TEST_OUT=$(sudo -n nginx -t 2>&1)
if [ $? -eq 0 ]; then
    sudo -n systemctl reload nginx 2>/dev/null || sudo -n nginx -s reload 2>/dev/null || true
    echo "SUCCESS"
else
    echo "WARN: Site removed, but Nginx syntax test reports an issue in other configs:\\n$TEST_OUT"
fi
"""
        code, stdout, stderr = ssh_manager.execute(server, script, timeout=12)
        return True, f"Site configuration '{filename}' deleted successfully."

    @classmethod
    def issue_ssl(cls, server, domain: str, email: str) -> Tuple[bool, str]:
        """
        Request Let's Encrypt certificate via Certbot with automatic Nginx configuration.
        """
        domain = domain.strip().lower()
        if not domain or not SAFE_DOMAIN_RE.match(domain):
            return False, "Invalid domain name."

        email = email.strip()
        if not email or '@' not in email:
            return False, "Valid contact email is required for Let's Encrypt registration."

        # Check certbot installation
        chk_code, _, _ = ssh_manager.execute(server, "export PATH=/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH; sudo -n certbot --version >/dev/null 2>&1 || test -x /usr/bin/certbot || test -x /snap/bin/certbot")
        if chk_code != 0:
            return False, "Certbot is not installed or accessible with sudo on this server."

        # Include www domain alias if appropriate
        domains = [domain]
        if not domain.startswith('www.') and '.' in domain and not domain.count('.') > 1:
            domains.append(f"www.{domain}")

        domain_args = " ".join([f"-d {shlex.quote(d)}" for d in domains])
        quoted_email = shlex.quote(email)

        cmd = (
            f"sudo -n certbot --nginx {domain_args} "
            f"--non-interactive --agree-tos -m {quoted_email} --redirect 2>&1"
        )
        code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=90)
        output = (stdout + "\n" + stderr).strip()

        if code == 0 and ('Congratulations!' in output or 'Successfully received certificate' in output or 'Certificate not yet due for renewal' in output):
            # Reload Nginx to activate changes
            ssh_manager.execute(server, "sudo -n systemctl reload nginx || sudo -n nginx -s reload")
            return True, "SSL Certificate issued and active with automatic HTTPS redirection!"
        
        return False, output or "Certbot execution failed. Verify that domain DNS points to this server IP."

    @classmethod
    def renew_all_ssl(cls, server, force: bool = False) -> Tuple[bool, str]:
        """
        Run certbot renew for all certificates.
        """
        try:
            force_flag = "--force-renewal" if force else ""
            cmd = f"""
export PATH=/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
sudo -n certbot renew {force_flag} --non-interactive --no-random-sleep-on-renew 2>&1
"""
            code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=180)
            output = (stdout + "\n" + stderr).strip()
            if code == 0:
                ssh_manager.execute(server, "sudo -n systemctl reload nginx 2>/dev/null || sudo -n nginx -s reload 2>/dev/null")
                return True, output or "Certbot renewal executed successfully."
            return False, output or f"Certbot renewal failed (code {code})"
        except Exception as e:
            logger.error(f"Error in renew_all_ssl: {e}")
            return False, f"Certbot renewal error: {str(e)}"

    @classmethod
    def renew_single_ssl(cls, server, cert_name: str, force: bool = True) -> Tuple[bool, str]:
        """
        Run certbot renew for a specific certificate name with force-renewal.
        """
        try:
            cert_name = cert_name.strip()
            force_flag = "--force-renewal" if force else ""
            quoted_cert = shlex.quote(cert_name)
            cmd = f"""
export PATH=/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
sudo -n certbot renew --cert-name {quoted_cert} {force_flag} --non-interactive --no-random-sleep-on-renew 2>&1
"""
            code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=120)
            output = (stdout + "\n" + stderr).strip()
            if code == 0:
                ssh_manager.execute(server, "sudo -n systemctl reload nginx 2>/dev/null || sudo -n nginx -s reload 2>/dev/null")
                return True, output or f"Certificate '{cert_name}' renewed successfully."
            return False, output or f"Failed to renew '{cert_name}' (code {code})"
        except Exception as e:
            logger.error(f"Error in renew_single_ssl: {e}")
            return False, f"Certbot renewal error: {str(e)}"

    @classmethod
    def list_certificates(cls, server) -> List[Dict[str, Any]]:
        """
        Parse certbot certificates output into structured data.
        """
        cmd = "export PATH=/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH; sudo -n certbot certificates 2>/dev/null || certbot certificates 2>/dev/null"
        code, stdout, _ = ssh_manager.execute(server, cmd, timeout=15)
        
        certs = []
        current = None

        for line in stdout.splitlines():
            line = line.strip()
            if line.startswith('Certificate Name:'):
                if current:
                    certs.append(current)
                name = line.split(':', 1)[1].strip()
                current = {'name': name, 'domains': [], 'expiry': '', 'valid_days': None, 'path': ''}
            elif current:
                if line.startswith('Domains:'):
                    current['domains'] = line.split(':', 1)[1].strip().split()
                elif line.startswith('Expiry Date:'):
                    # Expiry Date: 2026-11-20 14:22:10+00:00 (VALID: 89 days)
                    exp_val = line.split(':', 1)[1].strip()
                    current['expiry'] = exp_val
                    days_m = re.search(r'VALID:\s*(\d+)\s*days', exp_val)
                    if days_m:
                        current['valid_days'] = int(days_m.group(1))
                elif line.startswith('Certificate Path:'):
                    current['path'] = line.split(':', 1)[1].strip()

        if current:
            certs.append(current)

        return certs

    @classmethod
    def manage_service(cls, server, action: str) -> Tuple[bool, str]:
        """
        Perform service actions: test, reload, restart, start, stop.
        Fetches and returns the actual systemd status and PID verification.
        """
        valid_actions = {'test', 'reload', 'restart', 'start', 'stop'}
        if action not in valid_actions:
            return False, f"Invalid action: {action}"

        if action == 'test':
            cmd = "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH; sudo -n nginx -t 2>&1 || sudo -n /usr/sbin/nginx -t 2>&1 || nginx -t 2>&1"
            code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=10)
            output = (stdout + stderr).strip()
            return (code == 0), output

        cmd = f"""
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
sudo -n systemctl {action} nginx 2>&1 || sudo -n nginx -s {action} 2>&1
STATUS_CODE=$?
echo "---NGINX_ACTION_CODE---"
echo "$STATUS_CODE"
echo "---NGINX_SYSTEMD_STATUS---"
sudo -n systemctl status nginx --no-pager 2>&1 | head -n 7
"""
        code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
        
        sections = {}
        curr_key = None
        for line in stdout.splitlines():
            if line.startswith('---') and line.endswith('---'):
                curr_key = line.strip('-')
                sections[curr_key] = []
            elif curr_key:
                sections[curr_key].append(line)

        action_code = "\n".join(sections.get('NGINX_ACTION_CODE', ['0'])).strip()
        status_lines = "\n".join(sections.get('NGINX_SYSTEMD_STATUS', [])).strip()

        is_ok = (code == 0 and action_code in ('0', ''))
        result_msg = status_lines or (stdout + stderr).strip() or f"Nginx {action} executed"
        return is_ok, result_msg

    @classmethod
    def install_software(cls, server, package: str) -> Tuple[bool, str]:
        """
        Install or repair Nginx or Certbot via the server's native package manager.
        """
        if package == 'nginx':
            script = """
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
if which apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    sudo -n apt-get update -y && sudo -n apt-get install -y nginx
elif which dnf >/dev/null 2>&1; then
    sudo -n dnf install -y nginx
elif which yum >/dev/null 2>&1; then
    sudo -n yum install -y nginx
elif which pacman >/dev/null 2>&1; then
    sudo -n pacman -Sy --noconfirm nginx
else
    echo "No supported package manager found (apt, dnf, yum, pacman)"
    exit 1
fi
"""
        elif package == 'certbot':
            script = """
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH
if which apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    # Remove conflicting pip pyopenssl/cryptography packages that cause AttributeError in Certbot
    sudo -n pip3 uninstall -y pyopenssl cryptography 2>/dev/null || true
    sudo -n apt-get update -y && sudo -n apt-get install --reinstall -y certbot python3-certbot-nginx python3-openssl python3-cryptography
elif which dnf >/dev/null 2>&1; then
    sudo -n dnf install -y certbot python3-certbot-nginx
elif which yum >/dev/null 2>&1; then
    sudo -n yum install -y certbot python3-certbot-nginx
elif which pacman >/dev/null 2>&1; then
    sudo -n pacman -Sy --noconfirm certbot certbot-nginx
else
    echo "No supported package manager found (apt, dnf, yum, pacman)"
    exit 1
fi
"""
        else:
            return False, f"Unsupported package: {package}"

        code, stdout, stderr = ssh_manager.execute(server, script, timeout=120)
        output = (stdout + "\n" + stderr).strip()
        if code == 0:
            return True, f"{package.title()} installation completed successfully!"
        return False, f"Installation failed:\n{output[-500:]}"
