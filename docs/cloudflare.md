# Cloudflare Integration Guide

ShellMan includes an operator-level Cloudflare Domain & DNS manager. The integration connects to your personal Cloudflare account once to manage zones, configure DNS records, and link domains to your servers.

## 1. Creating a Minimum-Privilege Scoped API Token
Do **not** use your Cloudflare Global API Key or an R2 storage token (`cfat_...`). Create a scoped User API Token with only the permissions ShellMan requires:

1. Log in to the [Cloudflare API Tokens Dashboard](https://dash.cloudflare.com/profile/api-tokens).
2. Click **Create Token** > select **Create Custom Token** > **Get started**.
3. Name your token (e.g. `ShellMan`).
4. Under **Permissions**, configure the following 5 entries:
   - `Account` > `Account Settings` > `Read` *(Required to identify your Cloudflare Account)*
   - `Zone` > `Zone Settings` > `Edit` *(Required for Under Attack Mode & Dev Mode)*
   - `Zone` > `Zone` > `Edit`
   - `Zone` > `SSL and Certificates` > `Edit` *(Required for 15-Year Origin CA Certificate Generator)*
   - `Zone` > `DNS` > `Edit`
5. Under **Account Resources**, select: `Include` > `All accounts` *(or your chosen account)*.
6. Under **Zone Resources**, select: `Include` > `All zones`.
7. Click **Continue to summary** > **Create Token**, and copy the generated token secret.

![Cloudflare Token Permissions Setup](../static/images/cloudflare-token-setup.png)

## 2. Connecting to ShellMan
1. Open the **Cloudflare Domains** app from the dock or launcher.
2. Click **Cloudflare Settings** (or the status pill in the top header).
3. Paste your scoped API token and click **Save & Connect**.
4. ShellMan verifies the token with Cloudflare, encrypts it at rest in `instance/shellman.db` using your local per-install Fernet key (`instance/.fernet.key`), and automatically syncs existing zones.
5. The connection is permanently stored in the local SQLite database across ShellMan restarts.

## 3. Adding Domains & Updating Nameservers
1. In the Domains app, click **+ Add Domain**.
2. Enter your registered root domain (e.g. `example.com` or `run.place`).
   > [!NOTE]
   > - **Apex Domain Requirement**: Cloudflare manages DNS zones at the root domain level (e.g. `run.place`), not individual subdomains (e.g. `dipanshu.run.place`). Subdomains are configured as `A`, `AAAA`, or `CNAME` records inside the domain's **DNS Records** tab.
   > - **Registrar Requirement**: ShellMan creates the DNS zone in Cloudflare but does not purchase or register domain ownership. You must already own the domain at a registrar (e.g. Namecheap, GoDaddy, Squarespace).
3. Copy the two assigned Cloudflare nameservers (e.g., `ns1.cloudflare.com` and `ns2.cloudflare.com`).
4. Log in to your domain registrar and update the nameserver settings from *Default* to *Custom Nameservers*.
5. Return to ShellMan and click **Check Nameservers Now**. Once verified, the status badge will update to **Active**.

## 4. Linking Domains to ShellMan Server Nodes
1. Click on your domain in the dashboard to open the **Domain Details** view.
2. Navigate to the **Server & Nginx Link** tab.
3. Select your target server node and specify your subdomain (`@` for root, or `api`, `app`).
4. ShellMan automatically detects the server's public IP address (and warns if a private RFC 1918 address is selected).
5. Choose whether to enable Cloudflare edge proxying (CDN & DDoS protection) or DNS-only.
6. Click **Apply & Create DNS A-Record**. If a conflicting record exists, ShellMan highlights the conflict and asks for confirmation before updating.
7. Click **Open Nginx Manager** to configure a virtual host and point SSL directives to your Cloudflare Origin certificate.

## 5. Generating & Installing 15-Year Origin CA Certificates
1. In the Domain Details view, navigate to the **SSL & Origin CA** tab.
2. Review the pre-populated hostnames (e.g., `example.com, *.example.com`).
3. Click **Generate 15-Year Certificate**. ShellMan generates an RSA 2048 private key locally, submits a signed CSR to Cloudflare, and receives the signed 15-year Origin CA certificate.
4. Select your target server node from the dropdown.
5. Click **Install to /etc/nginx/ssl on Server**. ShellMan transfers the certificate to `/etc/nginx/ssl/{domain}.crt` and key to `/etc/nginx/ssl/{domain}.key`, secures permissions (`0644`/`0600`), and executes `nginx -t` to verify configuration syntax.
6. Set **Cloudflare SSL/TLS Encryption Mode** to **Full (Strict)** to enable 100% end-to-end encrypted traffic between Cloudflare edge and your origin server.

Back to the [README](../README.md) · [Features](features.md#cloudflare)
