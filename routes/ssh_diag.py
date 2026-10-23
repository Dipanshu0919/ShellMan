import time
import hashlib
import base64
import logging
from flask import Blueprint, jsonify
from routes.auth_helpers import login_required
from models.server import Server
from services.ssh_manager import ssh_manager

logger = logging.getLogger('shellman.ssh_diag')

ssh_diag_bp = Blueprint('ssh_diag', __name__)

@ssh_diag_bp.route('/api/servers/<int:server_id>/ssh/diagnostics', methods=['GET'])
@login_required
def get_ssh_diagnostics(server_id):
    server = Server.query.get_or_404(server_id)
    try:
        client = ssh_manager.get_client(server)
        transport = client.get_transport()

        if not transport or not transport.is_active():
            return jsonify({
                'success': False,
                'connected': False,
                'error': 'SSH transport is inactive or disconnected.'
            }), 200

        # Measure round trip latency (RTT) via global keepalive request or fallback echo
        t0 = time.perf_counter()
        latency_ms = 0.0
        try:
            # Paramiko global request waits for OpenSSH response
            transport.global_request("keepalive@openssh.com", wait=True)
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        except Exception:
            try:
                # Fast fallback: execute simple noop
                t0 = time.perf_counter()
                ssh_manager.execute(server, "true", timeout=5)
                latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            except Exception:
                latency_ms = -1.0

        if latency_ms < 0:
            rating = 'Unknown'
            color = '#94a3b8'
        elif latency_ms < 50:
            rating = 'Optimal'
            color = '#34d399'
        elif latency_ms < 120:
            rating = 'Good'
            color = '#38bdf8'
        elif latency_ms < 250:
            rating = 'Fair'
            color = '#fbbf24'
        else:
            rating = 'High Latency'
            color = '#f87171'

        # Cryptographic security negotiation details
        cipher = getattr(transport, 'remote_cipher', 'Unknown') or 'Unknown'
        local_cipher = getattr(transport, 'local_cipher', 'Unknown') or 'Unknown'
        kex = getattr(transport, 'kex_engine', None)
        kex_name = getattr(kex, 'name', str(kex)) if kex else 'Unknown'
        if hasattr(kex, '__class__'):
            kex_name = kex.__class__.__name__

        mac = getattr(transport, 'remote_mac', 'implicit') or 'implicit'
        if not mac or mac == 'None':
            mac = 'implicit (AEAD Authenticated Encryption)'

        server_banner = getattr(transport, 'remote_version', 'Unknown') or 'Unknown'
        client_banner = getattr(transport, 'local_version', 'Unknown') or 'Unknown'
        strict_kex = getattr(transport, 'agreed_on_strict_kex', False)

        # Host key & fingerprint
        host_key = transport.get_remote_server_key()
        host_key_type = host_key.get_name() if host_key else 'Unknown'
        host_key_bits = host_key.get_bits() if host_key and hasattr(host_key, 'get_bits') else None
        
        fingerprint = 'Unknown'
        if host_key:
            try:
                raw_bytes = host_key.asbytes()
                sha256_hash = hashlib.sha256(raw_bytes).digest()
                b64_fp = base64.b64encode(sha256_hash).decode('ascii').rstrip('=')
                fingerprint = f"SHA256:{b64_fp}"
            except Exception:
                fingerprint = host_key.get_fingerprint().hex()

        # Peer socket details
        peer_name = transport.getpeername()
        peer_ip = peer_name[0] if isinstance(peer_name, tuple) and len(peer_name) > 0 else server.host
        peer_port = peer_name[1] if isinstance(peer_name, tuple) and len(peer_name) > 1 else server.port

        # Channel & session statistics
        channels_count = len(getattr(transport, '_channels', {}))
        uptime_sec = 0.0
        with ssh_manager._client_lock:
            if server_id in ssh_manager._clients:
                _, created_at = ssh_manager._clients[server_id]
                uptime_sec = round(time.time() - created_at, 1)

        # Test SFTP availability
        sftp_ok = True
        try:
            _, sftp = ssh_manager.open_sftp(server)
            sftp.stat('.')
        except Exception:
            sftp_ok = False

        # Live Server Network Throughput
        from services.monitoring import SystemMonitor
        quick_m = SystemMonitor.get_quick_metrics(server)
        net_info = quick_m.get('network', {}) if isinstance(quick_m, dict) else {}

        return jsonify({
            'success': True,
            'connected': True,
            'server_id': server.id,
            'server_name': server.name,
            'username': server.username,
            'auth_type': server.auth_type,
            'peer_ip': peer_ip,
            'peer_port': peer_port,
            'latency_ms': latency_ms,
            'latency_rating': rating,
            'latency_color': color,
            'cipher': cipher,
            'local_cipher': local_cipher,
            'kex': kex_name,
            'mac': mac,
            'strict_kex': bool(strict_kex),
            'host_key_type': host_key_type,
            'host_key_bits': host_key_bits,
            'host_key_fingerprint': fingerprint,
            'server_banner': server_banner,
            'client_banner': client_banner,
            'channels_count': channels_count,
            'session_age_seconds': uptime_sec,
            'sftp_status': 'Operational' if sftp_ok else 'Degraded',
            'compression': getattr(transport, 'remote_compression', 'none') or 'none',
            'throughput': {
                'interface': net_info.get('interface', 'eth0'),
                'download_speed': net_info.get('rx_rate_human', '0 KB/s'),
                'upload_speed': net_info.get('tx_rate_human', '0 KB/s'),
                'total_download': net_info.get('rx_total_human', '0 B'),
                'total_upload': net_info.get('tx_total_human', '0 B'),
            }
        })
    except Exception as e:
        logger.error(f"Error gathering SSH diagnostics for server {server_id}: {e}")
        return jsonify({
            'success': False,
            'connected': False,
            'error': str(e)
        }), 500

@ssh_diag_bp.route('/api/servers/<int:server_id>/ssh/benchmark', methods=['POST'])
@login_required
def benchmark_ssh_throughput(server_id):
    server = Server.query.get_or_404(server_id)
    try:
        chunk_size_bytes = 256 * 1024  # 256 KB test payload
        down_cmd = f"head -c {chunk_size_bytes} /dev/zero | base64"
        t0 = time.perf_counter()
        code, down_out, _ = ssh_manager.execute(server, down_cmd, timeout=8)
        down_duration_s = max(0.001, time.perf_counter() - t0)

        down_bytes = len(down_out.encode('utf-8'))
        down_speed_mbps = round((down_bytes / (1024 * 1024)) / down_duration_s, 2)
        down_speed_human = f"{down_speed_mbps:.1f} MB/s" if down_speed_mbps >= 1 else f"{round(down_speed_mbps * 1024):.0f} KB/s"

        payload = "0" * chunk_size_bytes
        up_cmd = "cat > /dev/null"
        t1 = time.perf_counter()
        client = ssh_manager.get_client(server)
        stdin, stdout, stderr = client.exec_command(up_cmd, timeout=8)
        stdin.write(payload)
        stdin.flush()
        stdin.close()
        stdout.channel.recv_exit_status()
        up_duration_s = max(0.001, time.perf_counter() - t1)

        up_speed_mbps = round((chunk_size_bytes / (1024 * 1024)) / up_duration_s, 2)
        up_speed_human = f"{up_speed_mbps:.1f} MB/s" if up_speed_mbps >= 1 else f"{round(up_speed_mbps * 1024):.0f} KB/s"

        return jsonify({
            'success': True,
            'download_speed': down_speed_human,
            'download_mbps': down_speed_mbps,
            'download_ms': round(down_duration_s * 1000, 1),
            'upload_speed': up_speed_human,
            'upload_mbps': up_speed_mbps,
            'upload_ms': round(up_duration_s * 1000, 1),
            'tested_bytes': chunk_size_bytes
        })
    except Exception as e:
        logger.error(f"Error executing SSH throughput benchmark for server {server_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
