import base64
import json
import socket
import urllib.request
import urllib.error
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, render_template, redirect, url_for, Response
from models import db
from models.domain import CloudflareSetting, Domain
from models.server import Server
from routes.auth_helpers import login_required
from services.ssh_manager import ssh_manager
from services.cloudflare_service import (
    CloudflareService,
    CloudflareAPIError,
    normalize_domain,
    is_valid_domain,
    is_private_or_reserved_ip,
    SUPPORTED_RECORD_TYPES,
    PROXIED_ELIGIBLE_TYPES
)
from services.nginx_service import NginxService

domains_bp = Blueprint('domains', __name__)


def get_cloudflare_service() -> CloudflareService:
    """Helper to retrieve CloudflareService instance using stored operator token."""
    setting = CloudflareSetting.query.first()
    if not setting or not setting.is_connected or not setting.get_token():
        raise CloudflareAPIError(
            "Cloudflare is not connected. Please connect your Cloudflare API token in Settings or the Domains app.",
            status_code=400
        )
    return CloudflareService(setting.get_token())


# Desktop launcher route
@domains_bp.route('/domains')
@login_required
def index():
    server_id = request.args.get('server_id', type=int)
    return redirect(url_for('dashboard.index', server_id=server_id, app='domains'))


# =========================================================================
# 1. Cloudflare Account Integration Endpoints
# =========================================================================

@domains_bp.route('/api/cloudflare/status', methods=['GET'])
@login_required
def get_cf_status():
    setting = CloudflareSetting.query.first()
    if not setting or not setting.is_connected:
        return jsonify({
            'success': True,
            'is_connected': False,
            'account': None
        })
    return jsonify({
        'success': True,
        'is_connected': True,
        'account': setting.to_dict()
    })


@domains_bp.route('/api/cloudflare/connect', methods=['POST'])
@login_required
def connect_cf():
    data = request.json or {}
    api_token = (data.get('api_token') or '').strip()

    if not api_token:
        return jsonify({'success': False, 'error': 'Cloudflare API Token is required.'}), 400

    try:
        cf = CloudflareService(api_token)
        verify_data = cf.verify_token()

        setting = CloudflareSetting.query.first()
        if not setting:
            setting = CloudflareSetting(id=1)
            db.session.add(setting)

        setting.set_token(api_token)
        acc_id = (data.get('account_id') or '').strip() or verify_data.get('account_id')
        if not acc_id:
            try:
                zones = cf.list_zones(per_page=5)
                for z in zones:
                    if z.get('account', {}).get('id'):
                        acc_id = z['account']['id']
                        break
            except Exception:
                pass
        setting.account_id = acc_id
        setting.account_name = verify_data.get('account_name')
        setting.is_connected = True
        setting.last_verified_at = datetime.now(timezone.utc)
        db.session.commit()

        # Initial sync of zones from Cloudflare account
        try:
            zones = cf.list_zones(per_page=50)
            for z in zones:
                z_id = z.get('id')
                z_name = normalize_domain(z.get('name'))
                z_status = z.get('status', 'unknown')
                z_ns = z.get('name_servers', [])
                z_orig_ns = z.get('original_name_servers', [])

                dom = Domain.query.filter_by(zone_id=z_id).first()
                if not dom:
                    dom = Domain(zone_id=z_id, name=z_name)
                    db.session.add(dom)
                dom.name = z_name
                dom.status = z_status
                dom.set_nameservers(z_ns)
                dom.set_original_nameservers(z_orig_ns)
                dom.last_sync_at = datetime.now(timezone.utc)
            db.session.commit()
        except Exception:
            pass

        return jsonify({
            'success': True,
            'message': f"Connected to Cloudflare successfully! Verified account: {setting.account_name or 'Personal'}",
            'account': setting.to_dict()
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to connect: {str(e)}"}), 500


@domains_bp.route('/api/cloudflare/disconnect', methods=['POST'])
@login_required
def disconnect_cf():
    setting = CloudflareSetting.query.first()
    if setting:
        setting.set_token('')
        setting.is_connected = False
        db.session.commit()

    return jsonify({
        'success': True,
        'message': "Cloudflare disconnected successfully. Your existing remote zones and DNS records were preserved."
    })


@domains_bp.route('/api/cloudflare/test', methods=['POST'])
@login_required
def test_cf():
    try:
        cf = get_cloudflare_service()
        data = cf.verify_token()
        return jsonify({
            'success': True,
            'message': f"Cloudflare token is active and valid. Account: {data.get('account_name') or 'Default'}",
            'data': data
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =========================================================================
# 2. Domain Management Endpoints
# =========================================================================

@domains_bp.route('/api/domains', methods=['GET'])
@login_required
def list_domains():
    domains = Domain.query.order_by(Domain.name.asc()).all()
    setting = CloudflareSetting.query.first()
    is_connected = bool(setting and setting.is_connected)

    return jsonify({
        'success': True,
        'is_connected': is_connected,
        'domains': [d.to_dict() for d in domains]
    })


@domains_bp.route('/api/domains', methods=['POST'])
@login_required
def add_domain():
    data = request.json or {}
    raw_domain = data.get('domain', '')
    server_id = data.get('server_id')
    norm_name = normalize_domain(raw_domain)

    if not is_valid_domain(norm_name):
        return jsonify({'success': False, 'error': f"'{raw_domain}' is not a valid domain name."}), 400

    try:
        cf = get_cloudflare_service()
        setting = CloudflareSetting.query.first()
        acc_id = setting.account_id if setting and setting.account_id else None
        zone = cf.create_zone(norm_name, account_id=acc_id)

        z_id = zone.get('id')
        z_status = zone.get('status', 'pending')
        z_ns = zone.get('name_servers', [])
        z_orig_ns = zone.get('original_name_servers', [])

        dom = Domain.query.filter((Domain.zone_id == z_id) | (Domain.name == norm_name)).first()
        if not dom:
            dom = Domain(zone_id=z_id, name=norm_name)
            db.session.add(dom)

        dom.zone_id = z_id
        dom.name = norm_name
        dom.status = z_status
        dom.set_nameservers(z_ns)
        dom.set_original_nameservers(z_orig_ns)
        if server_id:
            dom.server_id = int(server_id)
        dom.last_sync_at = datetime.now(timezone.utc)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f"Domain '{norm_name}' added to Cloudflare! Please update your registrar nameservers to activate it.",
            'domain': dom.to_dict(),
            'nameservers': z_ns,
            'original_nameservers': z_orig_ns,
            'instructions': [
                f"1. Log in to your domain registrar where '{norm_name}' was registered (e.g., Namecheap, GoDaddy, Google/Squarespace).",
                f"2. Navigate to DNS Management or Nameserver settings for {norm_name}.",
                "3. Switch nameservers from Default/Registrar to Custom Nameservers.",
                f"4. Enter the assigned Cloudflare nameservers: {', '.join(z_ns)}.",
                "5. Save changes. Nameserver propagation typically takes between 5 minutes and 24 hours.",
                "Note: ShellMan does not register or purchase domains. Ownership remains with your registrar."
            ]
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': f"Error creating domain zone: {str(e)}"}), 500


@domains_bp.route('/api/domains/<zone_id>', methods=['GET'])
@login_required
def get_domain(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()

    # Optional live refresh of zone details from Cloudflare
    try:
        cf = get_cloudflare_service()
        z_info = cf.get_zone(zone_id)
        dom.status = z_info.get('status', dom.status)
        dom.set_nameservers(z_info.get('name_servers', dom.get_nameservers()))
        dom.ssl_mode = cf.get_zone_ssl_setting(zone_id)
        dom.dnssec_status = cf.get_zone_dnssec(zone_id)
        dom.last_sync_at = datetime.now(timezone.utc)
        db.session.commit()
    except Exception:
        pass

    return jsonify({
        'success': True,
        'domain': dom.to_dict()
    })


@domains_bp.route('/api/domains/<zone_id>/sync', methods=['POST'])
@login_required
def sync_domain(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    try:
        cf = get_cloudflare_service()
        z_info = cf.get_zone(zone_id)
        dom.status = z_info.get('status', dom.status)
        dom.set_nameservers(z_info.get('name_servers', dom.get_nameservers()))
        dom.set_original_nameservers(z_info.get('original_name_servers', dom.get_original_nameservers()))
        dom.ssl_mode = cf.get_zone_ssl_setting(zone_id)
        dom.dnssec_status = cf.get_zone_dnssec(zone_id)
        dom.last_sync_at = datetime.now(timezone.utc)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f"Domain '{dom.name}' synchronized successfully from Cloudflare.",
            'domain': dom.to_dict()
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/check-activation', methods=['POST'])
@login_required
def check_domain_activation(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    try:
        cf = get_cloudflare_service()
        cf.check_activation(zone_id)
        z_info = cf.get_zone(zone_id)
        dom.status = z_info.get('status', dom.status)
        dom.last_sync_at = datetime.now(timezone.utc)
        db.session.commit()

        msg = (
            f"Domain '{dom.name}' is now active on Cloudflare!"
            if dom.status == 'active'
            else f"Cloudflare has initiated a re-check for '{dom.name}'. Status is currently: {dom.status}."
        )

        return jsonify({
            'success': True,
            'message': msg,
            'status': dom.status,
            'domain': dom.to_dict()
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/associate-server', methods=['POST'])
@login_required
def associate_server(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    data = request.json or {}
    server_id = data.get('server_id')

    if server_id is None:
        dom.server_id = None
        db.session.commit()
        return jsonify({'success': True, 'message': f"Server unlinked from domain '{dom.name}'."})

    srv = Server.query.get(int(server_id))
    if not srv:
        return jsonify({'success': False, 'error': 'Selected server node not found.'}), 404

    dom.server_id = srv.id
    db.session.commit()
    return jsonify({
        'success': True,
        'message': f"Domain '{dom.name}' linked to server node '{srv.name}'.",
        'domain': dom.to_dict()
    })


@domains_bp.route('/api/domains/<zone_id>', methods=['DELETE'])
@login_required
def delete_domain(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    data = request.json or {}
    delete_from_cf = bool(data.get('delete_cloudflare_zone', False))

    name = dom.name
    try:
        if delete_from_cf:
            cf = get_cloudflare_service()
            cf._request('DELETE', f"/zones/{zone_id}")

        db.session.delete(dom)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f"Domain '{name}' removed from ShellMan" + (" and deleted from Cloudflare." if delete_from_cf else ".")
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =========================================================================
# 3. DNS Record Manager Endpoints
# =========================================================================

@domains_bp.route('/api/domains/<zone_id>/dns', methods=['GET'])
@login_required
def list_dns_records(zone_id):
    rtype = request.args.get('type')
    name = request.args.get('name')
    try:
        cf = get_cloudflare_service()
        records = cf.list_dns_records(zone_id, record_type=rtype, name=name)
        return jsonify({
            'success': True,
            'records': records,
            'count': len(records)
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/dns', methods=['POST'])
@login_required
def create_dns_record(zone_id):
    data = request.json or {}
    try:
        cf = get_cloudflare_service()
        record = cf.create_dns_record(zone_id, data)
        return jsonify({
            'success': True,
            'message': f"DNS record {record.get('type')} '{record.get('name')}' created successfully.",
            'record': record
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/dns/<record_id>', methods=['PUT'])
@login_required
def update_dns_record(zone_id, record_id):
    data = request.json or {}
    try:
        cf = get_cloudflare_service()
        record = cf.update_dns_record(zone_id, record_id, data)
        return jsonify({
            'success': True,
            'message': f"DNS record {record.get('type')} '{record.get('name')}' updated successfully.",
            'record': record
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/dns/<record_id>', methods=['DELETE'])
@login_required
def delete_dns_record(zone_id, record_id):
    try:
        cf = get_cloudflare_service()
        cf.delete_dns_record(zone_id, record_id)
        return jsonify({
            'success': True,
            'message': "DNS record deleted successfully."
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =========================================================================
# 4. Domain-to-Server Connection & Verification Endpoints
# =========================================================================

@domains_bp.route('/api/domains/<zone_id>/connect-server', methods=['POST'])
@login_required
def connect_server(zone_id):
    """
    Connects a domain or subdomain to a ShellMan server node by creating/updating the
    appropriate A record in Cloudflare, with conflict detection and private IP checks.
    """
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    data = request.json or {}

    server_id = data.get('server_id')
    subdomain = (data.get('subdomain') or '@').strip()
    proxied = bool(data.get('proxied', True))
    overwrite_conflict = bool(data.get('overwrite_conflict', False))

    if not server_id:
        return jsonify({'success': False, 'error': 'Target server node is required.'}), 400

    srv = Server.query.get_or_404(int(server_id))
    dest_ip = (data.get('destination_ip') or srv.host).strip()

    # Check for private or loopback IP
    is_priv, priv_reason = is_private_or_reserved_ip(dest_ip)
    if is_priv and not data.get('allow_private_ip'):
        return jsonify({
            'success': False,
            'is_private_ip': True,
            'error': f"Private IP Warning: {priv_reason} Public clients will be unable to access this domain. Check 'Allow Private IP' if using an internal intranet or VPN."
        }), 400

    # Calculate full DNS record name
    if subdomain in ('@', '', dom.name):
        record_name = dom.name
    else:
        # Strip domain if user typed full domain in subdomain field
        clean_sub = subdomain.rstrip('.').replace(f".{dom.name}", '')
        record_name = f"{clean_sub}.{dom.name}"

    try:
        cf = get_cloudflare_service()
        existing_records = cf.list_dns_records(zone_id, record_type='A', name=record_name)

        if existing_records and not overwrite_conflict:
            ex = existing_records[0]
            if ex.get('content') != dest_ip:
                return jsonify({
                    'success': False,
                    'conflict': True,
                    'record_id': ex.get('id'),
                    'current_content': ex.get('content'),
                    'target_content': dest_ip,
                    'record_name': record_name,
                    'message': f"Conflicting DNS record found: '{record_name}' already points to IP {ex.get('content')}. Do you want to overwrite it with {dest_ip}?"
                }), 409

        # Create or update A record
        if existing_records:
            rec = cf.update_dns_record(zone_id, existing_records[0]['id'], {
                'type': 'A',
                'name': record_name,
                'content': dest_ip,
                'proxied': proxied,
                'ttl': 1,
                'comment': f"Connected to ShellMan server: {srv.name}"
            })
            action_desc = "updated"
        else:
            rec = cf.create_dns_record(zone_id, {
                'type': 'A',
                'name': record_name,
                'content': dest_ip,
                'proxied': proxied,
                'ttl': 1,
                'comment': f"Connected to ShellMan server: {srv.name}"
            })
            action_desc = "created"

        # Update local domain-to-server link
        dom.server_id = srv.id
        db.session.commit()

        return jsonify({
            'success': True,
            'message': f"DNS record '{record_name}' {action_desc} pointing to {dest_ip} ({'Proxied' if proxied else 'DNS-only'}). Domain linked to '{srv.name}'.",
            'record': rec,
            'domain': dom.to_dict()
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/verify-live', methods=['POST'])
@login_required
def verify_live(zone_id):
    """
    Performs live DNS resolution and HTTP reachability checks with SSRF protection.
    """
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    data = request.json or {}
    hostname = (data.get('hostname') or dom.name).strip().lower()

    # SSRF protection: Ensure hostname belongs to this domain
    if not (hostname == dom.name or hostname.endswith(f".{dom.name}")):
        return jsonify({'success': False, 'error': f"Target hostname must belong to '{dom.name}'."}), 400

    results = {
        'hostname': hostname,
        'resolved_ips': [],
        'dns_matches_server': False,
        'server_ip': dom.server.host if dom.server else None,
        'http_status': None,
        'https_status': None,
        'ssl_detected': False,
        'diagnostics': []
    }

    # 1. DNS Resolution check
    try:
        addrinfo = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        resolved_ips = list(set([item[4][0] for item in addrinfo]))
        results['resolved_ips'] = resolved_ips

        if dom.server and dom.server.host in resolved_ips:
            results['dns_matches_server'] = True
            results['diagnostics'].append(f"DNS resolution matched server host IP: {dom.server.host}")
        elif dom.server:
            results['diagnostics'].append(f"DNS resolved to {resolved_ips}, server host is {dom.server.host} (Note: If Cloudflare Proxy is enabled, Cloudflare Anycast IPs are expected).")
    except Exception as e:
        results['diagnostics'].append(f"DNS lookup failed: {str(e)}")

    # 2. HTTP & HTTPS Reachability check
    for proto in ('https', 'http'):
        target_url = f"{proto}://{hostname}"
        try:
            req = urllib.request.Request(target_url, headers={'User-Agent': 'ShellMan-Domain-Diagnostic/3.6'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                if proto == 'https':
                    results['https_status'] = resp.status
                    results['ssl_detected'] = True
                else:
                    results['http_status'] = resp.status
        except urllib.error.HTTPError as e:
            if proto == 'https':
                results['https_status'] = e.code
                results['ssl_detected'] = True
            else:
                results['http_status'] = e.code
        except Exception as e:
            results['diagnostics'].append(f"{proto.upper()} reachability probe: {str(e)}")

    return jsonify({
        'success': True,
        'data': results
    })


# =========================================================================
# 5. Advanced Cloudflare Operations (Purge, Dev Mode, Under Attack, Analytics, BIND, Origin CA)
# =========================================================================

@domains_bp.route('/api/domains/<zone_id>/purge-cache', methods=['POST'])
@login_required
def purge_cache(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    data = request.json or {}
    purge_all = bool(data.get('purge_everything', True))
    raw_files = data.get('files', [])
    files = [f.strip() for f in raw_files if isinstance(f, str) and f.strip()] if not purge_all else None

    try:
        cf = get_cloudflare_service()
        res = cf.purge_cache(zone_id, purge_everything=purge_all, files=files)
        msg = "Purged entire Cloudflare edge cache successfully." if purge_all else f"Purged {len(files)} asset URL(s) from edge cache."
        return jsonify({'success': True, 'message': msg, 'result': res})
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/development-mode', methods=['GET', 'POST'])
@login_required
def dev_mode(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    cf = get_cloudflare_service()

    if request.method == 'GET':
        data = cf.get_development_mode(zone_id)
        return jsonify({'success': True, 'data': data})

    data = request.json or {}
    enabled = bool(data.get('enabled', False))
    try:
        res = cf.set_development_mode(zone_id, enabled)
        action_str = "enabled (active for 3 hours)" if enabled else "disabled"
        return jsonify({
            'success': True,
            'message': f"Development mode {action_str}.",
            'data': res
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/security-level', methods=['GET', 'POST'])
@login_required
def security_level(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    cf = get_cloudflare_service()

    if request.method == 'GET':
        data = cf.get_security_level(zone_id)
        return jsonify({'success': True, 'data': data})

    data = request.json or {}
    level = (data.get('level') or '').strip().lower()
    try:
        res = cf.set_security_level(zone_id, level)
        msg = "Under Attack Mode enabled! All visitors are being challenged at Cloudflare edge." if level == 'under_attack' else f"Security level set to {level}."
        return jsonify({
            'success': True,
            'message': msg,
            'data': res
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/ssl-mode', methods=['POST'])
@login_required
def set_ssl_mode(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    data = request.json or {}
    mode = (data.get('ssl_mode') or '').strip().lower()

    try:
        cf = get_cloudflare_service()
        res = cf.set_zone_ssl_setting(zone_id, mode)
        dom.ssl_mode = mode
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f"Cloudflare SSL/TLS encryption mode updated to '{mode}'.",
            'ssl_mode': mode
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/analytics', methods=['GET'])
@login_required
def domain_analytics(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    cf = get_cloudflare_service()
    analytics = cf.get_zone_analytics(zone_id)
    return jsonify({
        'success': True,
        'domain': dom.name,
        'analytics': analytics
    })


@domains_bp.route('/api/domains/<zone_id>/export-bind', methods=['GET'])
@login_required
def export_bind(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    try:
        cf = get_cloudflare_service()
        bind_content = cf.export_bind_zone(zone_id)
        filename = f"{dom.name}_bind_zone.txt"
        return Response(
            bind_content,
            mimetype="text/plain",
            headers={"Content-Disposition": f"attachment;filename={filename}"}
        )
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/origin-cert/generate', methods=['POST'])
@login_required
def generate_origin_cert(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    data = request.json or {}
    hostnames = data.get('hostnames') or [dom.name, f"*.{dom.name}"]
    validity_days = int(data.get('validity_days', 5475))  # Default 15 years

    try:
        cf = get_cloudflare_service()
        cert_data = cf.create_origin_ca_certificate(hostnames, validity_days=validity_days)
        return jsonify({
            'success': True,
            'message': f"15-Year Cloudflare Origin CA certificate generated for {', '.join(hostnames)}.",
            'certificate': cert_data.get('certificate'),
            'private_key': cert_data.get('private_key'),
            'expires_on': cert_data.get('expires_on'),
            'hostnames': cert_data.get('hostnames')
        })
    except CloudflareAPIError as e:
        return jsonify({'success': False, 'error': e.message}), e.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@domains_bp.route('/api/domains/<zone_id>/origin-cert/install', methods=['POST'])
@login_required
def install_origin_cert(zone_id):
    dom = Domain.query.filter_by(zone_id=zone_id).first_or_404()
    data = request.json or {}
    server_id = data.get('server_id') or (dom.server_id if dom.server else None)
    certificate = (data.get('certificate') or '').strip()
    private_key = (data.get('private_key') or '').strip()

    if not server_id:
        return jsonify({'success': False, 'error': 'A target ShellMan server must be selected.'}), 400
    if not certificate or not private_key:
        return jsonify({'success': False, 'error': 'Certificate and private key are required.'}), 400

    server = Server.query.get_or_404(server_id)
    clean_domain = dom.name.replace('/', '').replace('..', '')

    cert_b64 = base64.b64encode(certificate.encode('utf-8')).decode('ascii')
    key_b64 = base64.b64encode(private_key.encode('utf-8')).decode('ascii')

    cmd = (
        f"sudo mkdir -p /etc/nginx/ssl && "
        f"echo '{cert_b64}' | base64 -d | sudo tee /etc/nginx/ssl/{clean_domain}.crt > /dev/null && "
        f"echo '{key_b64}' | base64 -d | sudo tee /etc/nginx/ssl/{clean_domain}.key > /dev/null && "
        f"sudo chmod 644 /etc/nginx/ssl/{clean_domain}.crt && "
        f"sudo chmod 600 /etc/nginx/ssl/{clean_domain}.key && "
        f"sudo nginx -t 2>&1"
    )

    exit_code, stdout, stderr = ssh_manager.execute(server, cmd, timeout=15)
    output = stdout + stderr

    if exit_code != 0 and "syntax is ok" not in output:
        return jsonify({
            'success': False,
            'error': f"Installed certificates but Nginx configuration test returned an error: {output.strip()}",
            'cert_path': f"/etc/nginx/ssl/{clean_domain}.crt",
            'key_path': f"/etc/nginx/ssl/{clean_domain}.key"
        }), 400

    return jsonify({
        'success': True,
        'message': f"Installed Origin CA Certificate to /etc/nginx/ssl/{clean_domain}.crt and /etc/nginx/ssl/{clean_domain}.key on {server.name}. Nginx syntax test passed!",
        'cert_path': f"/etc/nginx/ssl/{clean_domain}.crt",
        'key_path': f"/etc/nginx/ssl/{clean_domain}.key"
    })
