# Security Architecture

- **Zero-Agent Attack Surface**: Because no daemon runs on your managed server, there are no extra background listeners or open ports vulnerable to exploitation.
- **Two-Factor Authentication (TOTP)**: Master administrator accounts can be protected with standard 6-digit TOTP authenticator codes and single-use emergency backup recovery codes.
- **Password Manager Auto-Fill Standard**: Full compliance with W3C autocomplete standards (`username`, `current-password`, `new-password`, `one-time-code`) ensuring automated password management via 1Password, Bitwarden, KeePass, and browser vaults.
- **Fernet AES-128 Encryption**: Server passwords and SSH private keys are stored using symmetric authenticated encryption (`cryptography.fernet.Fernet`).
- **IP Masking**: Server IP addresses in the top node pill are masked to prevent accidental leakage during screen shares or streaming, with an interactive toggle button to unmask when needed.
- **Sanitized Backup Archives**: Settings and server configurations exported for portability are strictly scrubbed of passwords and private keys.
- **Path Traversal Protection**: All SFTP path parameters are strictly normalized and sanitized against directory traversal attacks (`../`).
- **Random Session Secret**: The Flask session key comes from `SHELLMAN_SECRET_KEY` or is generated per install and stored in `instance/.secret_key` (0600). Known example values from docs or older releases are rejected, so a session cookie cannot be forged from the source code.
- **Login Brute-Force Protection**: Failed password attempts are throttled per IP and username with exponential lockout (HTTP 429); wrong 2FA codes are throttled separately. Sessions are renewed on login and expire after 24 h of inactivity (`SHELLMAN_SESSION_HOURS`).
- **Password Policy and Session Invalidation**: There is no password strength rule: you choose your own password. Changing the password or disabling 2FA signs out every other session. `Settings → Security → Sign out other sessions` does it on demand.
- **First-Run Setup Token**: Set `SHELLMAN_SETUP_TOKEN` and the first-run page asks for it, so nobody who finds a fresh instance can claim the admin account.
- **2FA Hardening**: A TOTP code works once only (replay guard), 2FA disable and password change are rate limited, and backup codes are stored encrypted.
- **SSH Host Key Pinning (TOFU)**: The first connection to a node pins its host key in `instance/known_hosts`. A changed key is refused with a clear warning instead of being trusted silently. After reinstalling a server, call `POST /api/servers/<id>/forget-host-key` and reconnect.
- **Cross-Site Request Protection**: State-changing requests and the terminal WebSocket are rejected when `Origin` / `Sec-Fetch-Site` show they come from another website. Behind a proxy that rewrites `Host`, list your public origin in `SHELLMAN_TRUSTED_ORIGINS`.
- **Safe Redirects and Headers**: `next=` only accepts same-site paths. Responses carry `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` and `no-store` on login and API pages.
- **POST-only Deploy Webhooks**: Webhook tokens are compared in constant time, failures are rate limited, and GET is no longer accepted so the token does not end up in logs or browser history.
- **Localhost-only Docker Port**: `docker-compose.yml` publishes `127.0.0.1:9874` by default; put a TLS reverse proxy in front to expose it.
- **Safe Wallpaper Uploads**: Only whitelisted image and video types are accepted, the file header must match the extension, SVG is refused, names are random, files are served with `nosniff`, sizes are capped and at most 10 are kept. Uploading and deleting are admin-only and recorded in the Audit Log.
- **Key Authentication**: Full support for standard password authentication as well as RSA and Ed25519 OpenSSH private key pairs (with passphrase support).

Back to the [README](../README.md) · [Deployment](deployment.md)
