import re
import shlex
import logging
from typing import Dict, Any, List, Optional
from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.firewall')

class FirewallService:
    """
    Agentless Linux Firewall (UFW) and Fail2Ban Intrusion Defense Manager over SSH.
    """

    def get_ufw_status(self, server) -> Dict[str, Any]:
        """Parses numbered UFW status and default policies."""
        cmd = "sudo ufw status numbered 2>/dev/null || ufw status numbered 2>/dev/null"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=10)
        output = stdout.strip()

        if "Status: inactive" in output or not output:
            is_active = False
            rules = []
        elif "Status: active" in output:
            is_active = True
            rules = self._parse_ufw_numbered(output)
        else:
            # UFW might not be installed
            return {
                'installed': False,
                'active': False,
                'rules': [],
                'message': 'UFW is not installed or requires sudo privileges.'
            }

        # Check default policies
        policy_cmd = "sudo ufw status verbose 2>/dev/null | grep -i 'Default:' || true"
        _, p_stdout, _ = ssh_manager.execute(server, policy_cmd, timeout=5)
        default_policy = p_stdout.strip()

        return {
            'installed': True,
            'active': is_active,
            'default_policy': default_policy,
            'rules': rules,
            'total_rules': len(rules)
        }

    def _parse_ufw_numbered(self, output: str) -> List[Dict[str, Any]]:
        """Parses output of 'ufw status numbered' into structured rule items."""
        rules = []
        lines = output.splitlines()
        # Look for table header
        start_parsing = False
        for line in lines:
            if line.startswith('[') and ']' in line:
                start_parsing = True
            if not start_parsing:
                continue

            match = re.match(r'^\[\s*(\d+)\]\s+(.+?)\s{2,}(ALLOW IN|DENY IN|REJECT IN|ALLOW|DENY|REJECT|LIMIT IN|LIMIT)\s{2,}(.+)$', line.strip())
            if match:
                num = int(match.group(1))
                to_port = match.group(2).strip()
                action = match.group(3).strip()
                from_ip = match.group(4).strip()
                is_v6 = '(v6)' in to_port or '(v6)' in from_ip

                rules.append({
                    'num': num,
                    'to': to_port.replace('(v6)', '').strip(),
                    'action': action,
                    'from': from_ip.replace('(v6)', '').strip(),
                    'is_v6': is_v6,
                    'raw': line.strip()
                })
        return rules

    def toggle_ufw(self, server, enable: bool) -> Dict[str, Any]:
        """Enables or disables UFW firewall."""
        action = "enable" if enable else "disable"
        # --force prevents interactive prompt "Command may disrupt existing ssh connections."
        cmd = f"sudo ufw --force {action}"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
        return {
            'success': exit_code == 0,
            'action': action,
            'message': (stdout + stderr).strip()
        }

    def add_rule(self, server, rule_type: str, port_or_ip: str, proto: Optional[str] = None, comment: Optional[str] = None) -> Dict[str, Any]:
        """
        Adds a firewall rule:
        - rule_type: 'allow_port', 'deny_port', 'allow_ip', 'deny_ip', 'limit_port'
        """
        val = port_or_ip.strip()
        comment_part = f" comment {shlex.quote(comment[:32])}" if comment else ""

        if rule_type == 'allow_port':
            p_spec = f"{val}/{proto}" if proto and proto != 'all' else val
            cmd = f"sudo ufw allow {shlex.quote(p_spec)}{comment_part}"
        elif rule_type == 'deny_port':
            p_spec = f"{val}/{proto}" if proto and proto != 'all' else val
            cmd = f"sudo ufw deny {shlex.quote(p_spec)}{comment_part}"
        elif rule_type == 'limit_port':
            p_spec = f"{val}/{proto}" if proto and proto != 'all' else val
            cmd = f"sudo ufw limit {shlex.quote(p_spec)}{comment_part}"
        elif rule_type == 'allow_ip':
            cmd = f"sudo ufw allow from {shlex.quote(val)}{comment_part}"
        elif rule_type == 'deny_ip':
            # Insert at position 1 so it takes precedence over lower allow rules
            cmd = f"sudo ufw insert 1 deny from {shlex.quote(val)} to any{comment_part}"
        else:
            return {'success': False, 'error': f"Unknown rule type '{rule_type}'"}

        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=12)
        return {
            'success': exit_code == 0,
            'message': (stdout + stderr).strip(),
            'exit_code': exit_code
        }

    def delete_rule(self, server, rule_number: int) -> Dict[str, Any]:
        """Deletes a numbered rule using ufw --force delete <number>."""
        cmd = f"sudo ufw --force delete {int(rule_number)}"
        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=12)
        return {
            'success': exit_code == 0,
            'message': (stdout + stderr).strip(),
            'exit_code': exit_code
        }

    # =========================================================================
    # Fail2Ban Integration
    # =========================================================================

    def get_fail2ban_status(self, server) -> Dict[str, Any]:
        """Detects fail2ban service and queries active jails with banned IP list."""
        check_cmd = "if command -v fail2ban-client >/dev/null 2>&1; then sudo fail2ban-client status 2>/dev/null; else echo 'NOT_INSTALLED'; fi"
        exit_code, stdout, stderr = ssh_manager.execute(server, check_cmd, timeout=8)
        output = stdout.strip()

        if "NOT_INSTALLED" in output:
            return {
                'installed': False,
                'active': False,
                'jails': [],
                'banned_ips': [],
                'message': 'Fail2Ban is not installed.'
            }

        if "Number of jail:" not in output and "Jail list:" not in output:
            return {
                'installed': True,
                'active': False,
                'jails': [],
                'banned_ips': [],
                'message': 'Fail2Ban service is installed but inactive or requires root permissions.'
            }

        # Extract jail names
        jails = []
        jail_match = re.search(r'Jail list:\s*(.+)$', output, re.MULTILINE)
        if jail_match:
            raw_jails = jail_match.group(1).split(',')
            jails = [j.strip() for j in raw_jails if j.strip()]

        # Query each jail for banned IPs
        jail_details = []
        all_banned = []
        for jail in jails:
            j_cmd = f"sudo fail2ban-client status {shlex.quote(jail)} 2>/dev/null"
            _, j_out, _ = ssh_manager.execute(server, j_cmd, timeout=5)
            
            cur_banned = 0
            cur_match = re.search(r'Currently banned:\s*(\d+)', j_out)
            if cur_match:
                cur_banned = int(cur_match.group(1))

            tot_banned = 0
            tot_match = re.search(r'Total banned:\s*(\d+)', j_out)
            if tot_match:
                tot_banned = int(tot_match.group(1))

            banned_list = []
            ip_match = re.search(r'Banned IP list:\s*(.+)$', j_out, re.MULTILINE)
            if ip_match:
                raw_ips = ip_match.group(1).strip().split()
                banned_list = [ip.strip() for ip in raw_ips if ip.strip()]

            for ip in banned_list:
                all_banned.append({'ip': ip, 'jail': jail})

            jail_details.append({
                'name': jail,
                'currently_banned': cur_banned,
                'total_banned': tot_banned,
                'banned_ips': banned_list
            })

        return {
            'installed': True,
            'active': True,
            'jails': jail_details,
            'banned_ips': all_banned,
            'total_banned_now': len(all_banned)
        }

    def fail2ban_action(self, server, action: str, jail: str, ip: str) -> Dict[str, Any]:
        """Bans or unbans an IP in a specific Fail2Ban jail."""
        clean_jail = shlex.quote(jail.strip())
        clean_ip = shlex.quote(ip.strip())

        if action == 'unban':
            cmd = f"sudo fail2ban-client set {clean_jail} unbanip {clean_ip}"
        elif action == 'ban':
            cmd = f"sudo fail2ban-client set {clean_jail} banip {clean_ip}"
        else:
            return {'success': False, 'error': f"Unknown action '{action}'"}

        exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=8)
        return {
            'success': exit_code == 0,
            'message': (stdout + stderr).strip(),
            'action': action,
            'ip': ip,
            'jail': jail
        }

    # =========================================================================
    # 1-Click DDoS Emergency Ban
    # =========================================================================

    def emergency_ban_ip(self, server, ip: str, comment: Optional[str] = 'ShellMan DDoS Shield') -> Dict[str, Any]:
        """
        1-Click Ban: Inserts a high-priority UFW deny rule at position 1.
        Also attempts to ban in fail2ban sshd jail if available.
        """
        clean_ip = ip.strip()
        # Verify valid IP address format
        import ipaddress
        try:
            ipaddress.ip_address(clean_ip)
        except ValueError:
            return {'success': False, 'error': f"Invalid IP address '{clean_ip}'"}

        # Prevent accidental ban of loopback or private ranges if not intended
        ip_obj = ipaddress.ip_address(clean_ip)
        if ip_obj.is_loopback:
            return {'success': False, 'error': 'Cannot ban localhost / loopback address.'}

        # 1. Insert UFW rule at position 1
        res = self.add_rule(server, 'deny_ip', clean_ip, comment=comment or 'ShellMan DDoS')
        
        # 2. Also ban in fail2ban sshd if active
        fb_status = self.get_fail2ban_status(server)
        fb_res = None
        if fb_status.get('active'):
            jails = [j['name'] for j in fb_status.get('jails', [])]
            target_jail = 'sshd' if 'sshd' in jails else (jails[0] if jails else None)
            if target_jail:
                fb_res = self.fail2ban_action(server, 'ban', target_jail, clean_ip)

        return {
            'success': res.get('success', False),
            'ip': clean_ip,
            'ufw_result': res.get('message', ''),
            'fail2ban_result': fb_res.get('message', '') if fb_res else 'Fail2ban not active',
            'message': f"IP {clean_ip} has been denied and blocked at firewall rule position 1."
        }

firewall_service = FirewallService()

