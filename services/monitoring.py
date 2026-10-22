import re
import time
import threading
from typing import Dict, Any, List
from services.ssh_manager import ssh_manager

class SystemMonitor:
    """
    Parses standard Linux system metrics via raw SSH commands without any remote agent.
    Commands execute within milliseconds with negligible temporary footprint.
    """
    _metrics_cache: Dict[int, Dict[str, Any]] = {}
    _cache_lock = threading.Lock()
    CACHE_TTL = 1.2  # seconds

    @staticmethod
    def format_bytes(bytes_num: float) -> str:
        if bytes_num is None or bytes_num < 0:
            return "0 B"
        for unit in ['B', 'KB', 'MB', 'GB', 'TB', 'PB']:
            if bytes_num < 1024.0:
                if unit in ['B', 'KB']:
                    return f"{int(bytes_num)} {unit}"
                return f"{bytes_num:.2f} {unit}"
            bytes_num /= 1024.0
        return f"{bytes_num:.2f} EB"

    @staticmethod
    def get_quick_metrics(server, force: bool = False) -> Dict[str, Any]:
        """
        Gathers CPU, Memory, Swap, Disk, Uptime, and Load in a single ultra-fast SSH pipeline.
        Uses /proc/stat for instantaneous CPU calculation (~100ms) instead of heavy 'top' scans.
        Caches static OS/Kernel info to eliminate redundant command overhead.
        Atomic 1.8s TTL cache keeps all client widgets and windows 100% synchronized.
        """
        server_id = getattr(server, 'id', None)
        now = time.time()
        if not force and server_id:
            with SystemMonitor._cache_lock:
                cached = SystemMonitor._metrics_cache.get(server_id)
                if cached and (now - cached.get('timestamp', 0) < SystemMonitor.CACHE_TTL):
                    return cached['data']

        need_os = not getattr(server, 'os_cache', None) or not getattr(server, 'kernel_cache', None)

        os_subcmd = ""
        if need_os:
            os_subcmd = (
                "echo '---OS---'; "
                "uname -srm; "
                "cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME=' | cut -d= -f2- | tr -d '\"'; "
            )

        combined_script = (
            "echo '---CPU---'; "
            "if [ -f /proc/stat ]; then head -n1 /proc/stat; sleep 0.1; head -n1 /proc/stat; "
            "else top -bn1 2>/dev/null | grep -i 'cpu' | head -n1; fi; "
            "echo '---MEM---'; "
            "free -b; "
            "echo '---LOAD---'; "
            "cat /proc/loadavg; "
            "echo '---UPTIME---'; "
            "cat /proc/uptime; "
            "echo '---TIME---'; "
            "date +'%s %z %Z'; "
            "echo '---DISK---'; "
            "df -P -B1 -x tmpfs -x devtmpfs -x overlay -x squashfs -x iso9660 2>/dev/null; "
            + os_subcmd
        )

        code, stdout, stderr = ssh_manager.execute(server, combined_script, timeout=6)
        if code != 0 and not stdout:
            return {"error": f"Failed to execute command: {stderr.strip()}"}

        sections = {}
        curr_section = None
        for line in stdout.splitlines():
            if line.startswith('---') and line.endswith('---'):
                curr_section = line.strip('-')
                sections[curr_section] = []
            elif curr_section:
                sections[curr_section].append(line)

        # Parse CPU (Instantaneous ~100ms delta from /proc/stat)
        cpu_usage = 0.0
        cpu_lines = [l.strip() for l in sections.get('CPU', []) if l.strip()]
        if len(cpu_lines) >= 2 and cpu_lines[0].startswith('cpu ') and cpu_lines[1].startswith('cpu '):
            try:
                def parse_stat(l):
                    vals = [float(x) for x in l.split()[1:]]
                    idle = vals[3] + (vals[4] if len(vals) > 4 else 0.0)
                    return idle, sum(vals)
                i1, t1 = parse_stat(cpu_lines[0])
                i2, t2 = parse_stat(cpu_lines[1])
                dt = t2 - t1
                di = i2 - i1
                if dt > 0:
                    cpu_usage = max(0.0, min(100.0, round(100.0 * (1.0 - di / dt), 1)))
            except Exception:
                pass
        elif cpu_lines:
            cpu_match = re.search(r'([0-9.]+)\s*id', cpu_lines[0])
            if cpu_match:
                idle = float(cpu_match.group(1))
                cpu_usage = max(0.0, min(100.0, round(100.0 - idle, 1)))

        # Parse Mem & Swap
        mem_total = 0
        mem_used = 0
        swap_total = 0
        swap_used = 0
        for mline in sections.get('MEM', []):
            parts = mline.split()
            if len(parts) >= 3:
                if parts[0].lower().startswith('mem'):
                    mem_total = int(parts[1])
                    if len(parts) >= 7:
                        mem_avail = int(parts[6])
                        mem_used = mem_total - mem_avail
                    else:
                        mem_used = int(parts[2])
                elif parts[0].lower().startswith('swap'):
                    swap_total = int(parts[1])
                    swap_used = int(parts[2])

        mem_percent = round((mem_used / mem_total * 100), 1) if mem_total > 0 else 0
        swap_percent = round((swap_used / swap_total * 100), 1) if swap_total > 0 else 0

        # Parse Load Avg
        load_avg = [0.0, 0.0, 0.0]
        load_lines = sections.get('LOAD', [])
        if load_lines and load_lines[0].strip():
            parts = load_lines[0].strip().split()
            if len(parts) >= 3:
                load_avg = [float(parts[0]), float(parts[1]), float(parts[2])]

        # Parse Uptime
        uptime_sec = 0
        uptime_lines = sections.get('UPTIME', [])
        if uptime_lines and uptime_lines[0].strip():
            try:
                uptime_sec = int(float(uptime_lines[0].strip().split()[0]))
            except Exception:
                uptime_sec = 0

        # Parse Remote Server Time
        server_time = None
        time_lines = [l.strip() for l in sections.get('TIME', []) if l.strip()]
        if time_lines:
            tparts = time_lines[0].split()
            if len(tparts) >= 1:
                try:
                    s_epoch = int(tparts[0])
                    s_offset = tparts[1] if len(tparts) > 1 else "+0000"
                    s_tz = tparts[2] if len(tparts) > 2 else ""
                    server_time = {
                        'epoch': s_epoch,
                        'offset': s_offset,
                        'timezone': s_tz
                    }
                except (ValueError, IndexError):
                    pass

        # Parse Disk & Partition Mounts
        disks = []
        root_disk = None
        for dline in sections.get('DISK', []):
            if not dline.strip() or dline.startswith('Filesystem'):
                continue
            parts = dline.split()
            if len(parts) >= 6:
                try:
                    dev = parts[0]
                    total_b = int(parts[1])
                    used_b = int(parts[2])
                    avail_b = int(parts[3])
                    percent = int(parts[4].rstrip('%'))
                    mp = " ".join(parts[5:])

                    # Skip virtual/pseudo mount paths
                    if mp.startswith('/snap') or mp.startswith('/var/lib/docker'):
                        continue
                    if dev.startswith('/dev/loop') and mp != '/':
                        continue
                    if mp.startswith('/sys') or mp.startswith('/proc') or mp.startswith('/dev'):
                        continue

                    disk_item = {
                        'filesystem': dev,
                        'total': total_b,
                        'used': used_b,
                        'avail': avail_b,
                        'percent': percent,
                        'mount': mp,
                        'total_formatted': SystemMonitor.format_bytes(total_b),
                        'used_formatted': SystemMonitor.format_bytes(used_b),
                        'avail_formatted': SystemMonitor.format_bytes(avail_b)
                    }
                    disks.append(disk_item)
                    if mp == '/':
                        root_disk = disk_item
                except (ValueError, IndexError):
                    continue

        if root_disk:
            disk_total_all = root_disk['total']
            disk_used_all = root_disk['used']
            disk_percent = root_disk['percent']
        elif disks:
            disk_total_all = disks[0]['total']
            disk_used_all = disks[0]['used']
            disk_percent = disks[0]['percent']
        else:
            disk_total_all = 0
            disk_used_all = 0
            disk_percent = 0

        # OS and Kernel
        pretty_os = getattr(server, 'os_cache', None)
        uname = getattr(server, 'kernel_cache', None)
        if need_os:
            os_lines = sections.get('OS', [])
            uname = os_lines[0].strip() if len(os_lines) > 0 else (uname or "Linux")
            pretty_os = os_lines[1].strip() if len(os_lines) > 1 and os_lines[1].strip() else (uname or "Linux")

        metrics_result = {
            'cpu': cpu_usage,
            'memory': {
                'total': mem_total,
                'used': mem_used,
                'percent': mem_percent,
                'total_formatted': SystemMonitor.format_bytes(mem_total),
                'used_formatted': SystemMonitor.format_bytes(mem_used)
            },
            'swap': {
                'total': swap_total,
                'used': swap_used,
                'percent': swap_percent,
                'total_formatted': SystemMonitor.format_bytes(swap_total),
                'used_formatted': SystemMonitor.format_bytes(swap_used)
            },
            'load': load_avg,
            'uptime': uptime_sec,
            'server_time': server_time,
            'disk': {
                'total': disk_total_all,
                'used': disk_used_all,
                'percent': disk_percent,
                'total_formatted': SystemMonitor.format_bytes(disk_total_all),
                'used_formatted': SystemMonitor.format_bytes(disk_used_all),
                'filesystems': disks
            },
            'os': pretty_os,
            'kernel': uname
        }

        if server_id:
            with SystemMonitor._cache_lock:
                SystemMonitor._metrics_cache[server_id] = {
                    'timestamp': now,
                    'data': metrics_result
                }

        return metrics_result

    @staticmethod
    def get_system_details(server) -> Dict[str, Any]:
        """Deep hardware, OS and networking inspection."""
        script = (
            "echo '---HOSTNAME---'; hostname -f 2>/dev/null || hostname; "
            "echo '---CPUINFO---'; grep -m1 'model name' /proc/cpuinfo | cut -d: -f2; "
            "nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo; "
            "echo '---ARCH---'; uname -m; "
            "echo '---KERNEL---'; uname -r; "
            "echo '---IPS---'; ip -br addr 2>/dev/null || ifconfig -a 2>/dev/null; "
            "echo '---PUBLIC_IP---'; curl -s --max-time 2 https://api.ipify.org 2>/dev/null || echo 'N/A'"
        )
        _, stdout, _ = ssh_manager.execute(server, script, timeout=8)

        sections = {}
        curr_section = None
        for line in stdout.splitlines():
            if line.startswith('---') and line.endswith('---'):
                curr_section = line.strip('-')
                sections[curr_section] = []
            elif curr_section:
                sections[curr_section].append(line)

        hostname = sections.get('HOSTNAME', [''])[0].strip()
        cpu_lines = sections.get('CPUINFO', [''])
        cpu_model = cpu_lines[0].strip() if len(cpu_lines) > 0 else "Unknown CPU"
        cpu_cores = cpu_lines[1].strip() if len(cpu_lines) > 1 else "1"
        arch = sections.get('ARCH', [''])[0].strip()
        kernel = sections.get('KERNEL', [''])[0].strip()
        public_ip = sections.get('PUBLIC_IP', ['N/A'])[0].strip()

        # Parse private IP addresses from ip -br addr
        interfaces = []
        for line in sections.get('IPS', []):
            parts = line.split()
            if len(parts) >= 2:
                ifname = parts[0]
                status = parts[1]
                addrs = parts[2:] if len(parts) > 2 else []
                interfaces.append({
                    'name': ifname,
                    'status': status,
                    'addrs': [a.split('/')[0] for a in addrs]
                })

        return {
            'hostname': hostname,
            'cpu_model': cpu_model,
            'cpu_cores': cpu_cores,
            'arch': arch,
            'kernel': kernel,
            'public_ip': public_ip,
            'interfaces': interfaces
        }

    @staticmethod
    def get_network_info(server) -> Dict[str, Any]:
        """Retrieves network interface statistics, active listening ports, and live active socket connections for DDoS/debugging."""
        script = (
            "echo '---INTERFACES---'; "
            "ip -br -s link 2>/dev/null || cat /proc/net/dev; "
            "echo '---LISTEN_PORTS---'; "
            "ss -tulnp 2>/dev/null || netstat -tulnp 2>/dev/null; "
            "echo '---ACTIVE_CONNECTIONS---'; "
            "ss -tunap 2>/dev/null || netstat -tunap 2>/dev/null"
        )
        _, stdout, _ = ssh_manager.execute(server, script, timeout=10)

        sections = {}
        curr_section = None
        for line in stdout.splitlines():
            if line.startswith('---') and line.endswith('---'):
                curr_section = line.strip('-')
                sections[curr_section] = []
            elif curr_section:
                sections[curr_section].append(line)

        # 1. Parse listening ports
        ports = []
        for line in sections.get('LISTEN_PORTS', [])[1:]:
            line = line.strip()
            if not line or line.startswith('Netid') or line.startswith('Proto'):
                continue
            parts = line.split()
            if len(parts) >= 5:
                proto = parts[0]
                local_addr = parts[4] if parts[0] in ('tcp', 'udp') else parts[3]
                process = parts[-1] if len(parts) >= 6 and ('users:' in parts[-1] or '/' in parts[-1]) else 'System'
                ports.append({
                    'proto': proto,
                    'local_addr': local_addr,
                    'process': process.strip('users:(("").)')
                })

        # 2. Parse active socket connections (netstat / ss)
        connections = []
        state_counts: Dict[str, int] = {}
        ip_counts: Dict[str, Dict[str, Any]] = {}

        for line in sections.get('ACTIVE_CONNECTIONS', []):
            line = line.strip()
            if not line or line.startswith('Netid') or line.startswith('Proto') or 'Active Internet' in line:
                continue

            parts = line.split()
            if len(parts) < 5:
                continue

            proto = parts[0].lower()
            if not (proto.startswith('tcp') or proto.startswith('udp')):
                continue

            state = ''
            recv_q = '0'
            send_q = '0'
            local_addr = ''
            remote_addr = ''
            process = 'Unknown'

            # Detect ss output vs netstat output
            # ss: Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
            if len(parts) >= 6 and parts[1].upper() in ('ESTAB', 'ESTABLISHED', 'SYN-SENT', 'SYN-RECV', 'FIN-WAIT-1', 'FIN-WAIT-2', 'TIME-WAIT', 'CLOSE-WAIT', 'LAST-ACK', 'LISTEN', 'CLOSING', 'UNCONN'):
                state = parts[1].upper()
                if state == 'LISTEN':
                    continue  # Filter out listening sockets from active connections list
                recv_q = parts[2]
                send_q = parts[3]
                local_addr = parts[4]
                remote_addr = parts[5]
                if len(parts) >= 7:
                    process = ' '.join(parts[6:]).strip('users:(("").)')
            # netstat: Proto Recv-Q Send-Q Local Address Foreign Address State [PID/Program]
            elif len(parts) >= 6:
                recv_q = parts[1]
                send_q = parts[2]
                local_addr = parts[3]
                remote_addr = parts[4]
                state = parts[5].upper()
                if state == 'LISTEN':
                    continue
                if len(parts) >= 7:
                    process = parts[6]

            # Normalize state
            if state in ('ESTAB', 'ESTABLISHED'):
                state = 'ESTABLISHED'
            elif state in ('SYN-RECV', 'SYN_RECV'):
                state = 'SYN_RECV'
            elif state in ('TIME-WAIT', 'TIME_WAIT'):
                state = 'TIME_WAIT'
            elif state in ('CLOSE-WAIT', 'CLOSE_WAIT'):
                state = 'CLOSE_WAIT'

            # Extract remote IP and port
            remote_ip = ''
            remote_port = ''
            if ':' in remote_addr:
                r_parts = remote_addr.rsplit(':', 1)
                remote_ip = r_parts[0].strip('[]')
                remote_port = r_parts[1]
            else:
                remote_ip = remote_addr

            # Ignore wildcard or loopback only if requested, but keep external IPs
            if not remote_ip or remote_ip in ('0.0.0.0', '*', '::'):
                continue

            # Update stats
            state_counts[state] = state_counts.get(state, 0) + 1

            # Track DDoS / IP grouping
            if remote_ip not in ip_counts:
                ip_counts[remote_ip] = {
                    'ip': remote_ip,
                    'count': 0,
                    'states': {},
                    'sample_process': process
                }
            ip_counts[remote_ip]['count'] += 1
            ip_counts[remote_ip]['states'][state] = ip_counts[remote_ip]['states'].get(state, 0) + 1

            connections.append({
                'proto': proto.upper(),
                'state': state,
                'recv_q': recv_q,
                'send_q': send_q,
                'local_addr': local_addr,
                'remote_addr': remote_addr,
                'remote_ip': remote_ip,
                'remote_port': remote_port,
                'process': process
            })

        # Generate top remote IPs sorted by connection count descending
        top_remote_ips = sorted(ip_counts.values(), key=lambda x: x['count'], reverse=True)[:25]

        return {
            'raw_interfaces': '\n'.join(sections.get('INTERFACES', [])),
            'ports': ports,
            'connections': connections[:300],
            'total_connections': len(connections),
            'state_counts': state_counts,
            'top_remote_ips': top_remote_ips
        }
