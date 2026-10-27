import json
import re
import ipaddress
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, Tuple


CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"

# RFC compliant domain name regex
DOMAIN_REGEX = re.compile(
    r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$'
)

# Supported DNS record types
SUPPORTED_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']
PROXIED_ELIGIBLE_TYPES = ['A', 'AAAA', 'CNAME']


class CloudflareAPIError(Exception):
    def __init__(self, message: str, status_code: int = 500, errors: Optional[List[Dict[str, Any]]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.errors = errors or []


def normalize_domain(domain_input: str) -> str:
    """Sanitizes and normalizes user input into a canonical lower-case root domain or hostname."""
    if not domain_input:
        return ''
    d = domain_input.strip().lower()
    # Remove protocol prefix if entered
    if d.startswith('http://'):
        d = d[7:]
    elif d.startswith('https://'):
        d = d[8:]
    # Strip any port or URL path
    d = d.split('/')[0].split(':')[0].strip().rstrip('.')
    # Convert Internationalized Domain Names (IDN)
    try:
        d = d.encode('idna').decode('ascii')
    except Exception:
        pass
    return d


def is_valid_domain(domain: str) -> bool:
    """Validates domain format and length."""
    d = normalize_domain(domain)
    if not d or len(d) > 253:
        return False
    return bool(DOMAIN_REGEX.match(d))


def is_private_or_reserved_ip(ip_str: str) -> Tuple[bool, str]:
    """
    Checks if an IP address is a private, loopback, link-local, or reserved address.
    Returns (is_private, reason_text).
    """
    clean_ip = (ip_str or '').strip()
    try:
        obj = ipaddress.ip_address(clean_ip)
        if obj.is_private:
            return True, f"{clean_ip} is a private network address (RFC 1918/4193). It is not reachable by public internet clients."
        if obj.is_loopback:
            return True, f"{clean_ip} is a loopback address. It resolves only to the local machine."
        if obj.is_link_local:
            return True, f"{clean_ip} is a link-local address. It is not routable."
        if obj.is_reserved:
            return True, f"{clean_ip} is a reserved IP address."
        if obj.is_unspecified:
            return True, f"{clean_ip} is an unspecified address (0.0.0.0/::)."
        return False, "Public routable IP"
    except ValueError:
        return True, f"'{clean_ip}' is not a valid IPv4 or IPv6 address."


class CloudflareService:
    def __init__(self, api_token: str):
        self.api_token = (api_token or '').strip()

    def _redact(self, text: str) -> str:
        if self.api_token and self.api_token in text:
            return text.replace(self.api_token, '[REDACTED]')
        return text

    def _request(self, method: str, endpoint: str, payload: Optional[Dict[str, Any]] = None, timeout: int = 20, raw_text: bool = False) -> Any:
        if not self.api_token:
            raise CloudflareAPIError("No Cloudflare API token provided.", status_code=401)

        url = f"{CLOUDFLARE_API_BASE}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "ShellMan-Cloudflare-Manager/3.8"
        }

        data_bytes = None
        if payload is not None:
            data_bytes = json.dumps(payload).encode('utf-8')

        req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode('utf-8')
                if raw_text:
                    return raw
                result = json.loads(raw)
                if not result.get('success', False):
                    err_msg = self._extract_errors(result)
                    raise CloudflareAPIError(self._redact(err_msg), status_code=resp.status, errors=result.get('errors'))
                return result
        except urllib.error.HTTPError as e:
            status = e.code
            err_body = ''
            try:
                err_body = e.read().decode('utf-8')
                res = json.loads(err_body)
                err_msg = self._extract_errors(res)
            except Exception:
                err_msg = e.reason or f"HTTP {status}"

            err_msg = self._redact(err_msg)

            if status in (401, 403):
                custom_msg = (
                    "Cloudflare API Token error: The token is invalid, expired, or lacks the necessary scoped permissions. "
                    "Ensure your token includes: Zone.Zone:Read/Edit, Zone.DNS:Read/Edit, and Zone.SSL and Certificates:Edit."
                )
                raise CloudflareAPIError(f"{custom_msg} (Details: {err_msg})", status_code=status)
            elif status == 429:
                raise CloudflareAPIError("Cloudflare API rate limit reached. Please wait a moment before trying again.", status_code=429)

            raise CloudflareAPIError(err_msg, status_code=status)
        except urllib.error.URLError as e:
            raise CloudflareAPIError(f"Network error connecting to Cloudflare: {e.reason}", status_code=503)
        except json.JSONDecodeError:
            raise CloudflareAPIError("Invalid JSON response received from Cloudflare API.", status_code=502)
        except Exception as e:
            raise CloudflareAPIError(self._redact(str(e)), status_code=500)

    def _extract_errors(self, res: Dict[str, Any]) -> str:
        errors = res.get('errors', [])
        if errors and isinstance(errors, list):
            messages = []
            for err in errors:
                code = err.get('code')
                msg = err.get('message', 'Unknown error')
                if code:
                    messages.append(f"[{code}] {msg}")
                else:
                    messages.append(msg)
            return "; ".join(messages)
        messages = res.get('messages', [])
        if messages:
            return "; ".join(messages)
        return "Operation failed on Cloudflare API"

    # =========================================================================
    # Account & Token Verification
    # =========================================================================

    def verify_token(self) -> Dict[str, Any]:
        """
        Verifies the validity and active status of the API token.
        Returns: { 'valid': True, 'account_id': ..., 'account_name': ... }
        """
        res = self._request('GET', '/user/tokens/verify')
        data = res.get('result', {})
        status = data.get('status', '').lower()
        if status != 'active':
            raise CloudflareAPIError(f"Cloudflare token is {status}. An active token is required.", status_code=400)

        # Retrieve associated Cloudflare account ID
        accounts_res = self.get_accounts()
        account_id = None
        account_name = None
        if accounts_res and len(accounts_res) > 0:
            account_id = accounts_res[0].get('id')
            account_name = accounts_res[0].get('name')

        return {
            'valid': True,
            'token_id': data.get('id'),
            'status': status,
            'account_id': account_id,
            'account_name': account_name or 'Personal Account'
        }

    def get_accounts(self) -> List[Dict[str, Any]]:
        """Lists accessible Cloudflare accounts for the token."""
        try:
            res = self._request('GET', '/accounts?per_page=10')
            return res.get('result', [])
        except Exception:
            return []

    # =========================================================================
    # Zones (Domains)
    # =========================================================================

    def list_zones(self, page: int = 1, per_page: int = 50) -> List[Dict[str, Any]]:
        """Retrieves all zones (domains) associated with the Cloudflare account."""
        res = self._request('GET', f"/zones?page={page}&per_page={per_page}")
        return res.get('result', [])

    def get_zone(self, zone_id: str) -> Dict[str, Any]:
        """Fetches full zone details including authoritative nameservers and activation status."""
        res = self._request('GET', f"/zones/{zone_id}")
        return res.get('result', {})

    def create_zone(self, domain_name: str, account_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Adds a new domain to Cloudflare by creating a DNS zone.
        Does not purchase or register the domain at a registrar.
        """
        norm_name = normalize_domain(domain_name)
        if not is_valid_domain(norm_name):
            raise CloudflareAPIError(f"'{domain_name}' is not a valid domain name.", status_code=400)

        # If account_id is not specified, resolve from available accounts or existing zones
        if not account_id:
            accounts = self.get_accounts()
            if accounts:
                account_id = accounts[0].get('id')

        if not account_id:
            try:
                zones = self.list_zones(per_page=5)
                for z in zones:
                    acc = z.get('account', {})
                    if acc.get('id'):
                        account_id = acc.get('id')
                        break
            except Exception:
                pass

        if not account_id:
            raise CloudflareAPIError(
                "Could not identify a Cloudflare account for this token. "
                "Ensure your API token has Account > Account Settings > Read permission, "
                "or configure your Cloudflare Account ID.",
                status_code=400
            )

        payload = {
            "name": norm_name,
            "account": {"id": account_id},
            "type": "full",
            "jump_start": True
        }

        res = self._request('POST', '/zones', payload=payload)
        return res.get('result', {})

    def check_activation(self, zone_id: str) -> Dict[str, Any]:
        """Requests Cloudflare to re-check nameservers for zone activation."""
        res = self._request('PUT', f"/zones/{zone_id}/activation_check")
        return res.get('result', {})

    def get_zone_ssl_setting(self, zone_id: str) -> str:
        """Retrieves the active SSL/TLS encryption mode for the zone (off, flexible, full, strict)."""
        try:
            res = self._request('GET', f"/zones/{zone_id}/settings/ssl")
            return res.get('result', {}).get('value', 'unknown')
        except Exception:
            return 'unknown'

    def get_zone_dnssec(self, zone_id: str) -> str:
        """Retrieves DNSSEC status for the zone."""
        try:
            res = self._request('GET', f"/zones/{zone_id}/dnssec")
            return res.get('result', {}).get('status', 'unknown')
        except Exception:
            return 'unknown'

    def set_zone_ssl_setting(self, zone_id: str, mode: str) -> Dict[str, Any]:
        """Sets the SSL/TLS encryption mode for the zone (off, flexible, full, strict)."""
        clean_mode = (mode or '').strip().lower()
        if clean_mode not in ('off', 'flexible', 'full', 'strict'):
            raise CloudflareAPIError(f"Invalid SSL mode '{mode}'. Expected off, flexible, full, or strict.", status_code=400)
        res = self._request('PATCH', f"/zones/{zone_id}/settings/ssl", payload={"value": clean_mode})
        return res.get('result', {})

    def purge_cache(self, zone_id: str, purge_everything: bool = True, files: Optional[List[str]] = None) -> Dict[str, Any]:
        """Purges Cloudflare edge cache either completely or for specific asset URLs."""
        if purge_everything:
            payload = {"purge_everything": True}
        elif files and len(files) > 0:
            payload = {"files": files}
        else:
            raise CloudflareAPIError("Either purge_everything must be true or a list of URLs must be specified.", status_code=400)
        res = self._request('POST', f"/zones/{zone_id}/purge_cache", payload=payload)
        return res.get('result', {})

    def get_development_mode(self, zone_id: str) -> Dict[str, Any]:
        """Retrieves Cloudflare Development Mode status and remaining active seconds."""
        try:
            res = self._request('GET', f"/zones/{zone_id}/settings/development_mode")
            data = res.get('result', {})
            return {
                'enabled': data.get('value') == 'on',
                'time_remaining': int(data.get('time_remaining', 0))
            }
        except Exception:
            return {'enabled': False, 'time_remaining': 0}

    def set_development_mode(self, zone_id: str, enabled: bool) -> Dict[str, Any]:
        """Toggles Cloudflare Development Mode on or off."""
        val = "on" if enabled else "off"
        res = self._request('PATCH', f"/zones/{zone_id}/settings/development_mode", payload={"value": val})
        data = res.get('result', {})
        return {
            'enabled': data.get('value') == 'on',
            'time_remaining': int(data.get('time_remaining', 0))
        }

    def get_security_level(self, zone_id: str) -> Dict[str, Any]:
        """Retrieves active zone security level (under_attack, high, medium, low, essentially_off)."""
        try:
            res = self._request('GET', f"/zones/{zone_id}/settings/security_level")
            data = res.get('result', {})
            val = data.get('value', 'medium')
            return {
                'level': val,
                'is_under_attack': val == 'under_attack'
            }
        except Exception:
            return {'level': 'medium', 'is_under_attack': False}

    def set_security_level(self, zone_id: str, level: str) -> Dict[str, Any]:
        """Updates zone security level."""
        clean_level = (level or '').strip().lower()
        valid_levels = ('under_attack', 'high', 'medium', 'low', 'essentially_off')
        if clean_level not in valid_levels:
            raise CloudflareAPIError(f"Invalid security level '{level}'. Expected: {', '.join(valid_levels)}", status_code=400)
        res = self._request('PATCH', f"/zones/{zone_id}/settings/security_level", payload={"value": clean_level})
        data = res.get('result', {})
        val = data.get('value', clean_level)
        return {
            'level': val,
            'is_under_attack': val == 'under_attack'
        }

    def get_zone_analytics(self, zone_id: str) -> Dict[str, Any]:
        """Fetches 24-hour summary telemetry from Cloudflare dashboard analytics."""
        try:
            res = self._request('GET', f"/zones/{zone_id}/analytics/dashboard?since=-1440")
            result = res.get('result', {})
            totals = result.get('totals', {})

            requests_data = totals.get('requests', {})
            bandwidth_data = totals.get('bandwidth', {})
            threats_data = totals.get('threats', {})
            uniques_data = totals.get('uniques', {})

            total_req = int(requests_data.get('all', 0) or 0)
            cached_req = int(requests_data.get('cached', 0) or 0)
            uncached_req = int(requests_data.get('uncached', 0) or 0)

            total_bytes = int(bandwidth_data.get('all', 0) or 0)
            cached_bytes = int(bandwidth_data.get('cached', 0) or 0)

            threats_count = int(threats_data.get('all', 0) or 0)
            uniques_count = int(uniques_data.get('all', 0) or 0)

            cache_ratio = round((cached_req / total_req * 100), 1) if total_req > 0 else 0.0

            return {
                'total_requests': total_req,
                'cached_requests': cached_req,
                'uncached_requests': uncached_req,
                'cache_ratio_pct': cache_ratio,
                'total_bandwidth_bytes': total_bytes,
                'cached_bandwidth_bytes': cached_bytes,
                'threats_blocked': threats_count,
                'unique_visitors': uniques_count
            }
        except Exception:
            return {
                'total_requests': 0,
                'cached_requests': 0,
                'uncached_requests': 0,
                'cache_ratio_pct': 0.0,
                'total_bandwidth_bytes': 0,
                'cached_bandwidth_bytes': 0,
                'threats_blocked': 0,
                'unique_visitors': 0
            }

    def export_bind_zone(self, zone_id: str) -> str:
        """Downloads standard RFC 1035 BIND zone export file as text."""
        return self._request('GET', f"/zones/{zone_id}/dns_records/export", raw_text=True)

    def create_origin_ca_certificate(self, hostnames: List[str], validity_days: int = 5475) -> Dict[str, Any]:
        """
        Creates a free Cloudflare Origin CA certificate and private key (up to 15 years validity).
        Cloudflare's /certificates API requires a valid CSR in PEM format. We generate the RSA 2048
        private key locally, sign a CSR with the requested hostnames and SANs, submit it to Cloudflare,
        and return the Cloudflare-signed certificate alongside the matching private key.
        Requires SSL/Certificates write permissions.
        """
        if not hostnames or len(hostnames) == 0:
            raise CloudflareAPIError("At least one hostname is required for Origin CA certificates.", status_code=400)

        # Certificate libraries are imported on demand, they are only needed here.
        from cryptography import x509
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
        from cryptography.x509.oid import NameOID

        # 1. Generate RSA 2048 private key locally
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        private_key_pem = private_key.private_bytes(
            encoding=Encoding.PEM,
            format=PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=NoEncryption(),
        ).decode('utf-8')

        # 2. Build Subject and Subject Alternative Names (SAN)
        san_list = [x509.DNSName(h.strip()) for h in hostnames if h.strip()]
        primary_cn = hostnames[0].strip()

        csr_builder = x509.CertificateSigningRequestBuilder().subject_name(x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, primary_cn),
        ]))

        if san_list:
            csr_builder = csr_builder.add_extension(
                x509.SubjectAlternativeName(san_list),
                critical=False,
            )

        csr = csr_builder.sign(private_key, hashes.SHA256())
        csr_pem = csr.public_bytes(Encoding.PEM).decode('utf-8')

        # 3. Post CSR to Cloudflare API
        payload = {
            "hostnames": hostnames,
            "requested_validity": validity_days,
            "request_type": "origin-rsa",
            "csr": csr_pem
        }
        res = self._request('POST', '/certificates', payload=payload)
        result = res.get('result', {})
        result['private_key'] = private_key_pem
        return result

    # =========================================================================
    # DNS Records Management
    # =========================================================================

    def list_dns_records(self, zone_id: str, record_type: Optional[str] = None, name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Lists DNS records for a zone with optional type and name filters."""
        endpoint = f"/zones/{zone_id}/dns_records?per_page=100"
        if record_type:
            endpoint += f"&type={record_type.upper()}"
        if name:
            endpoint += f"&name={name.lower()}"
        res = self._request('GET', endpoint)
        return res.get('result', [])

    def create_dns_record(self, zone_id: str, record_data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a new DNS record with full type, TTL, priority, and proxy validation."""
        payload = self._validate_and_build_record_payload(record_data)
        res = self._request('POST', f"/zones/{zone_id}/dns_records", payload=payload)
        return res.get('result', {})

    def update_dns_record(self, zone_id: str, record_id: str, record_data: Dict[str, Any]) -> Dict[str, Any]:
        """Updates an existing DNS record."""
        payload = self._validate_and_build_record_payload(record_data)
        res = self._request('PUT', f"/zones/{zone_id}/dns_records/{record_id}", payload=payload)
        return res.get('result', {})

    def delete_dns_record(self, zone_id: str, record_id: str) -> Dict[str, Any]:
        """Deletes a DNS record."""
        res = self._request('DELETE', f"/zones/{zone_id}/dns_records/{record_id}")
        return res.get('result', {})

    def _validate_and_build_record_payload(self, data: Dict[str, Any]) -> Dict[str, Any]:
        rtype = (data.get('type') or 'A').strip().upper()
        if rtype not in SUPPORTED_RECORD_TYPES:
            raise CloudflareAPIError(f"Unsupported record type '{rtype}'. Supported: {', '.join(SUPPORTED_RECORD_TYPES)}", status_code=400)

        name = (data.get('name') or '@').strip()
        content = (data.get('content') or '').strip()
        if not content:
            raise CloudflareAPIError("Record content/value is required.", status_code=400)

        # Validate type-specific content
        if rtype == 'A':
            try:
                ip_obj = ipaddress.IPv4Address(content)
            except ValueError:
                raise CloudflareAPIError(f"'{content}' is not a valid IPv4 address for type A.", status_code=400)
        elif rtype == 'AAAA':
            try:
                ip_obj = ipaddress.IPv6Address(content)
            except ValueError:
                raise CloudflareAPIError(f"'{content}' is not a valid IPv6 address for type AAAA.", status_code=400)

        # Proxied status is only valid for A, AAAA, and CNAME
        is_proxied = bool(data.get('proxied', False)) and (rtype in PROXIED_ELIGIBLE_TYPES)

        # TTL: 1 = Automatic (default)
        ttl = int(data.get('ttl', 1))

        payload = {
            "type": rtype,
            "name": name,
            "content": content,
            "ttl": ttl,
            "proxied": is_proxied
        }

        # Priority for MX and SRV
        if rtype == 'MX':
            payload['priority'] = int(data.get('priority', 10))
        elif rtype == 'SRV' and 'priority' in data:
            payload['priority'] = int(data.get('priority', 10))

        # Optional comment
        if data.get('comment'):
            payload['comment'] = str(data['comment'])[:100]

        return payload

