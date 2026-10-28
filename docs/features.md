# Features

Every ShellMan feature in detail. The short version is in the [README](../README.md#features-at-a-glance).

<details>
<summary><strong>All sections</strong></summary>

1. [Multi-Window Desktop Workspace & Window Snapping](#desktop)
2. [Real Interactive SSH PTY Terminal](#terminal)
3. [SFTP File Manager with Recursive Folder Drag-and-Drop & Custom Actions](#file-manager)
4. [Monaco Code Workspace (VS Code Engine)](#code-workspace)
5. [Live Telemetry & Resource Hub](#telemetry)
6. [Real-Time Task Manager & Linux Process Control](#task-manager)
7. [System Services, Journalctl Logs & Live Viewer](#services-logs)
8. [Nginx Web Server, Reverse Proxy Routing & Certbot SSL](#nginx)
9. [Cloudflare Domains & Authoritative DNS Management](#cloudflare)
10. [Live Netstat & DDoS Socket Monitor](#netstat)
11. [Progressive Web App (PWA) Support](#pwa)
12. [Two-Factor Authentication (2FA / TOTP)](#two-factor)
13. [Configuration Backup & Migration (Export / Import)](#backup)
14. [Server Health Monitoring & Configurable Alerts](#health-alerts)
15. [Agentless File Sync (Rsync over SSH)](#file-sync)
16. [Cron Job Manager (Scheduler)](#cron)
17. [Git Continuous Deployment & Webhooks](#git-deploy)
18. [Docker & Container Manager](#docker)
19. [Database Explorer & Backups (SQLite .db Viewer, MySQL, PostgreSQL)](#databases)
20. [Firewall (UFW) & Fail2Ban Security Shield](#firewall)
21. [SSH Connection Diagnostics Dashboard ("The Secret Weapon")](#ssh-diagnostics)
22. [Desktop Customizer & Real Application Dock](#customizer)
23. [Appearance, Themes & Wallpaper](#appearance)
24. [Live Desktop Widgets & Responsive Layout](#widgets)
25. [Extra Editing & File Shortcuts](#editing-shortcuts)
26. [Server-Side Alerts & Notification Channels](#alert-channels)
27. [Audit Log](#audit-log)
28. [Encrypted Full Backup & Restore](#encrypted-backup)
29. [Lightweight SQLite Data Layer](#sqlite-layer)
30. [GitHub Codespaces & Time Budgets](#codespaces)
31. [Read-only Users (Viewer Accounts)](#viewer-accounts)
32. [Terminal Session Recording](#recordings)
33. [Fleet Dashboard & Metric History](#fleet)
34. [Fonts & Look Customization](#fonts)
35. [MySQL / MariaDB / PostgreSQL Viewers](#sql-viewers)
36. [Apache Web Server Manager](#apache)
37. [Light and Dark Theme](#theme)
38. [Wallpapers: one per theme, uploads and live wallpapers](#wallpapers)

</details>

> Other guides: [Deployment](deployment.md) · [Cloudflare](cloudflare.md) · [Security](security.md) · [Shortcuts](shortcuts.md)

---

<a id="desktop"></a>

## 1. Multi-Window Desktop Workspace & Window Snapping
- **True Desktop Experience**: Open multiple applications side-by-side. Move, resize, minimize to dock, maximize, and cascade windows smoothly.
- **Drag-and-Drop Aero Window Snapping**: Drag any window to the left or right edge of the screen to snap to 50% viewport width, or drag to the top edge to maximize. Displays a translucent glassmorphism snap preview overlay with smooth restore on drag release.
- **Interactive Application Dock**: Launch and switch between Overview, Terminal, File Manager, Code Workspace, Task Manager, Nginx & Domains Manager, Services, Logs, Rsync Sync, Cron Scheduler, Git Deployments, and Settings.
- **Central Node Switcher**: Seamlessly switch active servers with one click.
- **Unified Command Palette (Ctrl+K)**: Instant search across desktop apps, registered server nodes, and remote server files over SFTP. Typing a filename (e.g. `nginx.conf`) searches the host and opens it directly in Monaco Code Workspace.
- **Privacy IP Masking Toggle**: Sensitive server IP addresses are masked by default (`20.219.2***:22`). Click the inline eye icon SVG to reveal or hide unmasked host endpoints instantly.
- **Persistent Preferences**: Wallpapers, window geometry, and privacy settings persist in local browser storage.

---

<a id="terminal"></a>

## 2. Real Interactive SSH PTY Terminal
- **True Pseudo-Terminal (PTY)**: Backed by Paramiko `invoke_shell(term='xterm-256color')` streamed over low-latency WebSockets directly to `xterm.js`.
- **Multiple Color Themes**: Choose from 16 curated developer color schemes: **ShellMan Cyberpunk (Default)**, **Dracula**, **One Dark**, **Nord Frost**, **Tokyo Night**, **Catppuccin Mocha**, **Gruvbox Dark**, **Synthwave '84**, **Solarized Dark**, **Solarized Light**, **Material Ocean**, **Cobalt2**, **GitHub Dark**, **Night Owl**, **Monokai Pro**, and **The Matrix Green**. Switch themes on the fly from the terminal toolbar or globally in System Settings, automatically applying to all active terminals and integrated consoles.
- **Full Curses & Terminal App Support**: Effortlessly run `htop`, `vim`, `nano`, `tmux`, `less`, `tail -f`, and interactive REPLs with zero input lag.
- **Signal Handling**: Dedicated raw input interception handles <kbd>Ctrl</kbd>+<kbd>C</kbd>, <kbd>Ctrl</kbd>+<kbd>D</kbd>, <kbd>Ctrl</kbd>+<kbd>Z</kbd>, <kbd>Ctrl</kbd>+<kbd>L</kbd>, and arrow keys without browser collision.
- **Dynamic Viewport Auto-Fit**: Window resizes trigger real-time PTY terminal column and row recalculations via `fitAddon`.

---

<a id="file-manager"></a>

## 3. SFTP File Manager with Recursive Folder Drag-and-Drop & Custom Actions
- **Custom Actions Automation Engine**: Turn recurring shell commands into reusable remote buttons directly embedded in the file manager.
  - **Safe POSIX Parameter Substitution**: Variables are safely quoted and escaped to prevent command injection: `{{selected_path}}`, `{{selected_name}}`, `{{current_dir}}`, `{{selected_paths}}`, and `{{server_name}}`.
  - **Embedded Output Panel & Terminal Handoff**: Run actions with live status badges, exit code tracking, stdout/stderr output streaming, rerun button, and a 1-click terminal handoff to continue interactively.
  - **Confirmation Shield**: Optional confirmation dialog displaying the target server, selected remote paths, and exact command preview before execution.
  - **Extensive Vector Icon Library**: Searchable 3-column palette featuring 33+ clean vector SVG icons tailored for Linux administration (Deploy, Run, Shield, Lock, Key, Checksum, Archive, Logs, Database, Server, CPU, Cloud, Download, Upload, Restart, Trash, Wrench, Zap, Search, Alert, Code, Backup, Network, Health, Release, Git, Container, Web, Link, Config).
  - **Export & Import**: Share custom actions between servers and teammates via standardized JSON export/import.
- **Persistent Drag-to-Resize Properties Drawer**: An interactive vertical split handle allows dragging the right-side properties panel from 220px to 750px. Width persists in local storage across browser reloads. Double-click the handle to restore default width.
- **Recursive Folder Drag-and-Drop**: Drag entire directory hierarchies from your local workstation directly into the browser — ShellMan automatically creates remote folders recursively (`mkdir -p`) and uploads all nested files.
- **Target Folder Hover Detection**: Hover dropped files directly over a target folder row or grid tile to upload straight into that subdirectory.
- **File-Type Icons**: Every file shows an icon for its type in the list, grid and properties views: a document in the type's brand color with a label or glyph (the Python logo for `.py`, JS, TS, HTML, CSS, JSON, YAML, shell, PHP, Go, Rust, Java, C/C++, SQL, Markdown, PDF, Word/Excel/PowerPoint, images, video, audio, archives, packages, keys and certificates, binaries). Well-known names get their own icon too: `Dockerfile`, `docker-compose.yml`, `package.json`, `requirements.txt`, `.gitignore`, `README`, `LICENSE`, `Makefile`, `nginx.conf`, `.env`, SSH keys. Unknown types get a plain document. The mapping lives in `static/js/desktop/fileicons.js`.
- **Dual View Modes & Batch Operations**: Switch between a compact details list and a responsive thumbnail grid. Inspect permissions (`chmod`), ownership (`chown`), file sizes, and timestamps. Batch move, copy, compress (`.zip`/`.tar.gz`), and delete items.

---

<a id="code-workspace"></a>

## 4. Monaco Code Workspace (VS Code Engine)
- **Full-Fledged Editor**: Powered by Microsoft Monaco with syntax highlighting, bracket matching, line numbers, and multi-cursor support.
- **Local File Drag & Drop Integration**: Drag any file directly from your local desktop onto the editor viewport to immediately open it in an editable tab. Press <kbd>Ctrl</kbd>+<kbd>S</kbd> to save and upload it directly to the remote server workspace. Dragging files onto the left explorer tree immediately saves them to the active folder and refreshes the directory hierarchy.
- **Desktop-Grade Right-Click Context Menus**: Full context menu suite on explorer files and folders (New File, New Folder, Rename, Duplicate/Copy, Move with Remote Directory Picker, Open in Terminal, Download, Copy Absolute/Relative Path, Delete) and editor tabs (Close, Close Others, Close All, Save, Copy Path).
- **Broad Language Support**: Python, JavaScript, TypeScript, Shell Script, Dockerfile, Nginx config, JSON, YAML, HTML, CSS, SQL, and Markdown.
- **Integrated Terminal Panel**: Collapsible bottom PTY terminal panel synchronized with the active workspace directory for seamless test and build cycles.
- **Fast Remote Editing**: Hotkeys for Quick Open (<kbd>Ctrl</kbd>+<kbd>P</kbd>) and instant asynchronous SFTP remote save (<kbd>Ctrl</kbd>+<kbd>S</kbd>).

---

<a id="telemetry"></a>

## 5. Live Telemetry & Resource Hub
- **Hardware Telemetry**: Real-time dials for CPU usage %, RAM distribution (Used / Total), swap memory, and load averages (1m, 5m, 15m).
- **Disk Partition Mounts**: Visual usage meters for root (`/`), boot mounts, and external drives.
- **OS & Kernel Specs**: Linux distribution detection, kernel release, uptime counter, and CPU architecture.

---

<a id="task-manager"></a>

## 6. Real-Time Task Manager & Linux Process Control
- **Agentless Process Telemetry (0 MB Resident Daemon)**: Reads process statistics directly via standard OpenSSH using `/proc` and `ps -eo` inspection — requiring zero agent daemons or background workers on remote servers.
- **Multi-Metric Memory Footprint (RSS, PSS, VSZ & RAM%)**:
  - **RSS (Resident Set Size)**: Physical RAM allocated to the process.
  - **PSS (Proportional Set Size)**: Private memory plus proportional share of shared libraries (`/proc/[pid]/smaps_rollup`), revealing true individual memory weight.
  - **VSZ (Virtual Size)**: Total virtual memory address space.
  - **RAM%**: Formatted alongside exact memory footprint (e.g. `45.2 MB (2.3%)`).
- **Decoded Linux Process State Engine**: Automatically translates Linux `STAT` codes into human-readable states with color-coded badges and explanatory tooltips:
  - `Running` (`R`): Actively executing instructions on CPU.
  - `Active` (`S`): Healthy process sleeping and waiting for incoming events or network requests.
  - `Disk Wait` (`D`): Uninterruptible sleep awaiting disk or hardware I/O.
  - `Zombie` (`Z`): Defunct process terminated but not yet reaped by its parent.
  - `Stopped` (`T` / `t`): Paused by job control signals or an active debugger.
  - `Idle` (`I`): Idle kernel worker thread.
  - Modifiers: High priority (`<`), Nice low priority (`N`), Locked memory pages (`L`), Session leader (`s`), Multi-threaded (`l`), Foreground process (`+`).
- **Full POSIX Signal Dispatch**: Right-click or menu actions for instant signal delivery:
  - `SIGTERM (15)`: Request clean, graceful application shutdown.
  - `SIGKILL (-9)`: Immediate forced termination for unkillable or frozen tasks.
  - `SIGSTOP (19)`: Pause / freeze execution without losing process memory.
  - `SIGCONT (18)`: Resume paused execution.
  - Quick Copy: 1-click clipboard copy for PID and complete command line arguments.
- **Host Telemetry Bar**: Integrated header meters displaying live host-wide CPU %, RAM %, and root partition disk % with animated capacity bars.
- **Column Customization & Instant Filtering**: Select visible columns with localStorage persistence. Filter instantly across PID, username, command name, and argument flags. Sort columns ascending or descending with one click.

---

<a id="services-logs"></a>

## 7. System Services, Journalctl Logs & Live Viewer
- **Systemd Unit Control**: Inspect all service states (`active`, `running`, `failed`, `inactive`) with one-click Start, Stop, and Restart actions.
- **Regex Syntax Highlighting**: Journal and system logs are rendered with color-coded syntax formatting: errors (`red`), warnings (`amber`), notice/info (`cyan`), debug (`gray`), IPv4/IPv6 addresses (`blue`), and HTTP status codes.
- **Continuous Live View Streaming**: Real-time streaming toggle (`Live View: ON/OFF`) polls and streams incoming system log entries continuously into the terminal view without requiring manual refreshes or reopening the window.
- **Severity Counters & In-Log Filtering**: Live count pills for Total, Errors, Warnings, and Info lines, coupled with instant regex search filtering.

---

<a id="nginx"></a>

## 8. Nginx Web Server, Reverse Proxy Routing & Certbot SSL
- **Reverse Proxy Domain Routing**: Route public domains and subdomains to internal backend services and microservices running on local ports (Node.js, Python/Flask/FastAPI, Next.js, Go, or Docker containers).
- **Automated Let's Encrypt SSL via Certbot**: 1-click HTTPS certificate issuance and renewals via Certbot and the Certbot Nginx plugin, with automated HTTP-to-HTTPS redirect rule generation.
- **Virtual Host Manager**: Create, enable, disable, and delete virtual host configurations (`/etc/nginx/sites-available` and `/etc/nginx/sites-enabled`) with automated symlink management.
- **Safe Configuration Editor with Auto-Rollback**: Inspect and modify `/etc/nginx/nginx.conf` and site configs inside an embedded editor. Every save is pre-flight tested using `nginx -t`. If validation fails, changes are instantly rolled back to the backup copy to prevent service downtime.
- **Service Controls**: One-click configuration reload (`nginx -s reload`), service restart, syntax testing, and native package installer for Nginx and Certbot across Debian, Ubuntu, RHEL/CentOS, and Arch Linux.

---

<a id="cloudflare"></a>

## 9. Cloudflare Domains & Authoritative DNS Management
- **Operator-Level Cloudflare Integration**: Connect your personal Cloudflare account once using a minimum-privilege scoped API token. No SaaS multi-tenant overhead or third-party credential exposure.
- **Fernet Encrypted Secret Storage**: The Cloudflare API token is encrypted at rest using local per-installation Fernet keys (`0600` permissions) and is never transmitted in browser API responses, HTML, logs, or diagnostic outputs.
- **Unified Domain Dashboard**: View domain zones, Cloudflare activation state (`active`, `pending`, `error`), assigned authoritative nameservers, SSL/TLS encryption mode, DNSSEC status, and associated ShellMan server node.
- **Cloudflare Origin CA Certificate Generator (15-Year Validity)**:
  - Generates RSA 2048-bit private keys locally and signs standard PEM-encoded Certificate Signing Requests (CSR) with domain and wildcard Subject Alternative Names (SANs).
  - Issues official 15-year certificates via Cloudflare's `/certificates` API.
  - **1-Click Server Installation**: Deploys certificate and private key directly to `/etc/nginx/ssl/{domain}.crt` and `/etc/nginx/ssl/{domain}.key` via SSH, verifies permissions (`0644` / `0600`), and runs automated `nginx -t` syntax validation.
  - Completely eliminates 90-day Let's Encrypt renewal failures behind proxied domains.
- **1-Click Edge Cache Purge**: Instant **Purge Everything** for global cache invalidation upon deployments, or **Purge by URL / Prefix** to invalidate specific stylesheets, scripts, or assets.
- **Development Mode Toggle**: Temporarily bypasses Cloudflare edge cache for 3 hours with a live visual countdown timer, ensuring HTML, CSS, and JS edits in ShellMan's Monaco editor reflect immediately in the browser.
- **1-Click "Under Attack Mode"**: Enables Cloudflare edge JavaScript challenge during incoming floods or high `SYN_RECV` states detected in the Live Netstat/DDoS monitor, absorbing malicious traffic before it reaches origin server resources.
- **24-Hour Traffic Ticker & Telemetry**: Visual edge metrics showing Total Requests, Unique Visitors, Cached vs Uncached bandwidth, and Blocked Threat count.
- **Export RFC 1035 BIND Zone File**: 1-click download of all DNS records formatted in standard RFC 1035 / BIND format (`.txt`) for emergency offline backups or provider migrations.
- **Add Domain Workflow**: Add domains to Cloudflare with immediate retrieval of assigned nameservers, 1-click individual and bulk copy buttons, registrar update guidelines, and mail record disruption warnings.
- **Full DNS Record Manager**: Add, edit, search, and delete records across all major record types: `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `SRV`, and `CAA`.
  - **Cloudflare Proxy Toggle**: 1-click toggle for Cloudflare edge proxying (CDN, WAF, DDoS protection) on eligible record types (`A`, `AAAA`, `CNAME`).
  - **Granular TTL & Priority Controls**: Configure TTL from Automatic down to 1 minute, with priority inputs for `MX` and `SRV`.
- **Domain-to-Server Linkage**: Connect root `@` or subdomains directly to any ShellMan server IP.
  - **Private IP Guard**: Detects RFC 1918 / loopback / link-local addresses and warns if a private IP is about to be exposed publicly.
  - **DNS Conflict Detection**: Detects if an existing record points to a different IP and requires explicit confirmation before overwriting.
  - **Nginx & SSL Handoff**: 1-click transition to Nginx virtual host configuration and Origin CA HTTPS certificate provisioning.
- **Live Diagnostics & Reachability Probe**: Probes public DNS resolution, validates origin IP matching, checks HTTP/HTTPS status, and verifies SSL certificate presence.

---

<a id="netstat"></a>

## 10. Live Netstat & DDoS Socket Monitor
- **Interactive Active Socket Telemetry**: Displays all live TCP and UDP connections with protocol, connection state, local socket, remote foreign IP, and process/program names via standard `ss` / `netstat`.
- **DDoS Activity Leaderboard**: Automatically aggregates and ranks remote IP addresses by total concurrent socket count and SYN_RECV state, giving immediate visibility into traffic spikes, port scans, and SYN flood attacks.
- **State Breakdown**: Instant metric counters for Total Active, Established, SYN_RECV, and Time Wait sockets.
- **Interactive Filtering & Auto-Refresh**: Real-time search across IP, port, or process, state filter dropdown (`ESTABLISHED`, `SYN_RECV`, `TIME_WAIT`, `CLOSE_WAIT`), 1-click IP copy, and configurable live polling intervals (`3s`, `5s`, `10s`, or paused).

---

<a id="pwa"></a>

## 11. Progressive Web App (PWA) Support
- **Installable Desktop App**: Install ShellMan as a native desktop application in Chrome, Brave, Edge, or Safari with custom window controls overlay.
- **Distraction-Free**: Runs in standalone mode without browser tabs, address bars, or extension clutter.

---

<a id="two-factor"></a>

## 12. Two-Factor Authentication (2FA / TOTP)
- **Time-Based One-Time Passwords (TOTP)**: Protect master administrator access using standard authenticator apps (Google Authenticator, Authy, 1Password, Bitwarden).
- **Pure Vector QR Code**: High-contrast SVG QR barcode generated dynamically without raster image dependencies.
- **Emergency Recovery Backup Codes**: Generates 8 one-time alphanumeric backup recovery codes (`XXXX-XXXX`) during 2FA activation with a 1-click copy/download modal to prevent lockouts.
- **Dedicated Recovery Flow**: Login prompt includes an alternative "Use a backup code instead" option that validates single-use codes seamlessly with or without dashes.
- **Safe 2FA Deactivation**: Requires entering the current master administrator password to disable 2FA, preventing unauthorized deactivations.

---

<a id="backup"></a>

## 13. Configuration Backup & Migration (Export / Import)
- **Unified JSON Portability**: Export your complete ShellMan setup into a single portable `.json` archive.
- **Credential Sanitization**: Server nodes are exported with passwords and private keys stripped, making backups safe to share or store.
- **Seamless Restore**: Import restores custom automation actions, server nodes, and visual preferences (`theme`, `wallpaper`, `font-size`) across machines.

---

<a id="health-alerts"></a>

## 14. Server Health Monitoring & Configurable Alerts
- **Configurable Resource Thresholds**: Customize exact trigger thresholds for **CPU Utilization** (e.g. 60% to 95%) and **RAM Utilization** (e.g. 60% to 95%) with custom value inputs.
- **Sustained Duration Filter**: Set minimum duration (1 to 10 minutes) before an alert fires to eliminate false alarms from transient compilation or backup spikes.
- **Node Outage Detection**: Automatically alerts when a host fails 3 consecutive telemetry polls (~15s) and dispatches recovery notices upon reconnection.
- **Dual Delivery Channels**: Real-time glassmorphism in-app toast banners plus native OS push notifications via Web Notifications API / PWA. Includes a test alert dispatcher.

---

<a id="file-sync"></a>

## 15. Agentless File Sync (Rsync over SSH)
- **Dual Sync Engine**:
  - **Mode 1: Local &harr; Remote Sync**: Transfer and synchronize folders directly between your local workstation running ShellMan and the remote server over SSH:
    - **Push (`Local &rarr; Remote Server`)**: Uploads and synchronizes local project directories to remote server destinations.
    - **Pull (`Remote Server &rarr; Local`)**: Downloads and mirrors remote directories to your local machine.
    - **Zero-Dependency SSH Auth**: Uses POSIX `SSH_ASKPASS` and temporary key permissions (`chmod 0600`) — fully supporting both password and private key authentication without needing `sshpass`.
  - **Mode 2: Server Backup & Mirror**: Direct server-side directory replication (e.g., `/var/www/` &rarr; `/var/backups/www/`) executed entirely on the remote host via the persistent SSH session without pulling data over your local connection.
- **Interactive Directory Browser (Local & Remote)**: Built-in modal directory picker supporting both remote server SFTP and local workstation filesystems with breadcrumb navigation, double-click traversal, quick presets (`~/`, `~/Projects`, `~/Documents`, `/var/www/`, `/opt/`, `/etc/`), and real-time directory creation (`+ New Folder`).
- **Safe Dry-Run Preview (`-n`)**: Evaluates transfer operations beforehand, presenting the exact files to be synchronized, total files count, and byte statistics before applying changes.
- **Flexible Options**: Toggle Archive mode (`-a`), network stream compression (`-z`), and exact mirror deletion (`--delete`).
- **Exclude Pattern Filters**: Ignore build artifacts and cache folders (`.git`, `node_modules`, `__pycache__`, `*.tmp`, `.DS_Store`).
- **Live Output Stream**: Formatted terminal output pane with status badges (`IDLE`, `ANALYZING`, `PREVIEW OK`, `SYNCING`, `SUCCESS`, `FAILED`) and exit code tracking.

---

<a id="cron"></a>

## 16. Cron Job Manager (Scheduler)
- **Visual Crontab Manager**: Inspect, add, edit, toggle, and delete scheduled cron entries on remote servers without manual terminal editing.
- **Human-Readable Decoder**: Automatically translates raw cron syntax (`0 2 * * *`) into plain English descriptions ("Daily at 02:00").
- **Schedule Presets**: 1-click presets for Hourly, Daily, Weekly, Monthly, Every 5/15 Minutes, and System Startup (`@reboot`).
- **Immediate Execution Tester**: "Run Now" action executes any scheduled cron command in a subshell over SSH and displays stdout/stderr output immediately.
- **Native 38px Utility Toolbar**: Integrated live search filter, schedule badges, and clean vector SVG icons.

---

<a id="git-deploy"></a>

## 17. Git Continuous Deployment & Webhooks
- **Repository Linking**: Link Git repositories to any server directory with branch tracking (`main`, `master`, `staging`) and interactive SFTP Directory Picker support.
- **Live Git Inspection**: Inspect real-time branch status, remote origin URL, working tree clean/dirty state, and recent commit history (hash, author, relative time, message).
- **1-Click Pull Latest**: Pull updates and automatically execute post-deployment commands (e.g. `npm install && npm run build` or `systemctl reload nginx`).
- **Automated Deployment Webhooks**: Generates unique webhook URLs (`POST /api/deploy/webhook/<token>`) for GitHub and GitLab to automate deployment on `git push`.
- **Native 38px Utility Toolbar**: Filter across deployments, status badges, and deployment logs.

---

<a id="docker"></a>

## 18. Docker & Container Manager
- **100% Agentless Container Discovery**: Inspects Docker engine and active/stopped containers over standard SSH via `docker ps -a --format '{{json .}}'` with 0 MB resident RAM overhead.
- **Full Lifecycle Operations**: 1-click Start, Graceful Stop (`-t 10`), Restart, Pause, and Forced Remove (`rm -f`).
- **Live Container Log Streaming**: Tail and stream container logs directly into an interactive modal viewer with syntax formatting, timestamps, search filter, and clipboard copy.
- **Docker Compose Automation**: Execute `docker compose up -d --build`, `down`, and `restart` in remote directories with custom compose file paths.
- **Performance Telemetry**: Inspect non-streaming container CPU %, Memory usage, and Network I/O metrics on demand.

---

<a id="databases"></a>

## 19. Database Explorer & Backups (SQLite .db Viewer, MySQL, PostgreSQL)
- **Interactive SQLite .db / .sqlite File Viewer**:
  - Open and inspect any remote SQLite database file directly from the SFTP File Manager (double-click integration) or path input.
  - Automatic table schema viewer (`PRAGMA table_info`), primary key badges, and column data types.
  - Paginated row browser with responsive data grid.
  - Safe read-only SQL console: executes custom `SELECT`, `PRAGMA`, and `EXPLAIN` queries while blocking mutations (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`).
  - Auto-Discovery: 1-click scanner searches `/var/www`, `/home`, and `/opt` to locate SQLite database files automatically.
- **MySQL & MariaDB Explorer**: Connects via local Unix socket without exposing ports, browse databases and tables, and preview rows.
- **PostgreSQL Explorer**: Connects using peer authentication, lists active databases and public schema tables.
- **1-Click Compressed Dump Generator**: Creates compressed backups (`.db.gz` or `.sql.gz`) in `/tmp/` ready for immediate SFTP retrieval.

---

<a id="firewall"></a>

## 20. Firewall (UFW) & Fail2Ban Security Shield
- **Visual UFW Firewall Control**: Real-time status display (`Active` / `Inactive`), default traffic policy readout, and numbered rule table.
- **Rule Management**: Add allow/deny/limit rules for ports and specific IP addresses; delete rules with 1-click confirmation.
- **Fail2Ban Jail Inspector**: Queries active intrusion jails (e.g. `sshd`), lists currently banned malicious IPs, and offers 1-click unban.
- **DDoS Monitor Integration**: Connected directly with the Live Netstat & DDoS socket monitor. Click "Ban" next to any abusive foreign IP to immediately block it at firewall rule position 1 (`sudo ufw insert 1 deny from <ip> to any`).

---

<a id="ssh-diagnostics"></a>

## 21. SSH Connection Diagnostics Dashboard ("The Secret Weapon")
- **Encrypted Transport Verification**: Proves raw SSH transport authenticity directly in the UI.
- **Live Round-Trip Latency (RTT)**: High-precision ping measured in milliseconds via OpenSSH keepalive global requests without spawning shell subshells.
- **Cryptographic Cipher Breakdown**: Active symmetric bulk cipher (e.g., `chacha20-poly1305@openssh.com`, `aes256-gcm`), Key Exchange engine (`curve25519-sha256`), and MAC digest.
- **Strict KEX & Anti-Terrapin Verification**: Displays whether strict key exchange negotiation is active.
- **Host Key SHA-256 Fingerprint**: Instant fingerprint inspection and 1-click clipboard copy.
- **Socket & Protocol Banners**: Displays remote OpenSSH banner, client banner, socket endpoint, and SFTP subsystem pool status.

---

<a id="customizer"></a>

## 22. Desktop Customizer & Real Application Dock
- **Customize Desktop & Dock**: Right-click any desktop icon or dock item and choose *Customize Desktop & Dock...* to choose which of the 19 registered apps appear as desktop shortcuts and which are pinned to the dock. Reset to defaults at any time.
- **Running Apps Appear in the Dock**: An app that is open but not pinned shows up after a separator, like a native dock. Minimized apps stay there, dim, with a hollow running indicator. Click to restore, or right-click and choose **Keep in Dock** to pin it permanently.
- **Dock Context Menu**: Open, Add to / Remove from Desktop, Unpin from Dock, Close window (or Close all windows when several are open), Customize, and Hide Dock. The hidden state persists across reloads.
- **Desktop Icon Sizes**: Compact, Normal, or Large. Icons wrap into new columns instead of hiding, auto-scale to fit the free area beside the widgets, and show app names on up to two lines.
- **Hardware App**: CPU cores, RAM layout, storage block devices, and `lshw` topology. It is available as a desktop shortcut and can be pinned to the dock.

---

<a id="appearance"></a>

## 23. Appearance, Themes & Wallpaper
- **Accent Colors**: Cyan, Violet, Emerald, Rose, or Amber. The accent drives active windows, dock indicators, gauges, buttons, and the node prompt.
- **Font Scale**: A slider from 12 to 24 px with a live preview.
- **15 Terminal Themes**: ShellMan Cyberpunk, Dracula, One Dark, Nord Frost, Tokyo Night, Catppuccin Mocha, Gruvbox Dark, Solarized Dark and Light, Material Ocean, Cobalt2, GitHub Dark, Night Owl, Monokai Pro, and The Matrix Green. One setting applies to the SSH terminal and the Code Workspace terminal.
- **Wallpaper**: Up to 10 presets (uploads from your device, GIFs, short videos or URLs), each assignable to dark mode, light mode or both, on top of the built-in 8K wallpaper. See [Wallpapers](#wallpapers). The choice persists locally and is included in Backup & Export preferences.

---

<a id="widgets"></a>

## 24. Live Desktop Widgets & Responsive Layout
- **Widgets Panel**: Clock (with a server time zone label), live CPU, RAM, and disk gauges (click to open System Overview), and an uptime and platform card. All of it follows the active node.
- **`$` Prompt Node Switcher**: The active node is shown as a shell prompt (`$ Connected Node`, name, `user@host`). `$` is accent coloured when the node is reachable and grey when it is offline. Every status marker in the app uses the same `$`. Offline nodes are dimmed in the switcher list.
- **Adapts to Any Screen**: Layouts for ultrawide, laptop, tablet, and phone. On phones the widgets stack, the node pill centres, and the dock and icon grid stay usable. Pages outside the desktop (system bar and node modal) share the same design.
- **Installable & Persistent**: Window geometry, dock, icon size, accent, font scale, and terminal theme persist in browser storage.

---

<a id="editing-shortcuts"></a>

## 25. Extra Editing & File Shortcuts
- **Search in Files**: The Code Workspace has a sidebar search across the opened workspace folder (`/workspace/search-code`).
- **File Manager Keyboard Control**: Navigate, rename, and delete from the keyboard (see the shortcut table below).
- **Smart Compress (.zip / .tar.gz / .tar)**: The Compress dialog can skip everything listed in `.gitignore` (root and nested files), lets you untick individual files and folders with checkboxes, offers quick-exclude chips (`node_modules`, `.git`, `__pycache__`, `.venv`, `.env`, `*.log`, build folders, IDE folders), and accepts custom patterns. Works without git installed on the server.
- **Everything Is Cancellable**: Closing a window, or pressing ×, Cancel or Esc on any dialog, aborts every request it started and kills the matching job on the server (compress, copy, move, extract, rsync, git, docker, certbot, database queries and so on), so nothing keeps the SSH connection busy. Any operation running longer than 2 seconds appears in a **Running** panel with its own cancel button. Progress toasts have a × as well.
- **Batch Operations**: Archive, extract, copy, move, chmod, and delete several selected items in one action.

---

<a id="alert-channels"></a>

## 26. Server-Side Alerts & Notification Channels
- **Runs Without a Browser**: A background engine checks every node on a fixed interval (`SHELLMAN_ALERT_INTERVAL`, default 60 s), so alerts fire even when no ShellMan tab is open. Set `SHELLMAN_ALERTS=0` to disable it. A file lock (`.alerts.lock`) ensures only one gunicorn worker runs the engine.
- **Rules**: Presets for node offline, CPU, RAM, disk, load and more, each with a threshold, a sustained duration, a severity and a cooldown. An alert fires after consecutive breaches, resolves after two clean checks, and re-notifies only after the cooldown. Open incidents survive restarts.
- **Channels**: Telegram, Slack, Discord, generic webhook (optional HMAC signature in `X-ShellMan-Signature`) and email (SMTP). Every channel has a Test button. Secrets are stored encrypted and never returned to the browser.
- **Safe Outgoing Requests**: Webhook URLs must be http or https, link-local and cloud metadata addresses are blocked, and redirects are not followed.
- **In-App Bell**: A notification bell shows open incidents with acknowledge, acknowledge-all and clear actions.

---

<a id="audit-log"></a>

## 27. Audit Log
- **What Is Recorded**: Logins (success, failure, lockout, 2FA), password and 2FA changes, server add/edit/delete, terminal sessions, file writes and deletes, git and system actions, automation runs, backup export/import and alert changes. Each entry stores time, user, IP, action, target and result.
- **Viewer and Export**: Settings → Audit Log filters by action, user and result, and exports CSV (formula-injection safe).
- **Filters**: Search text, user, failures only, and a From/To date range with quick buttons (Today, 7 days, 30 days, All time). CSV export uses the same filters.
- **Retention**: Settings → Audit Log → Retention & cleanup sets how many days to keep (default 180) and a maximum entry count (default 20,000). 0 means no limit. Cleanup runs at startup, at least hourly while the log is written, and on Save. You can also delete by age, by the selected date range, or everything; the purge itself is recorded. Writing the log never breaks the action being logged.

---

<a id="encrypted-backup"></a>

## 28. Encrypted Full Backup & Restore
- **One File**: `Settings → Backup → Encrypted full backup` creates a `.smbak` file with servers (including saved passwords and keys), actions, alert rules and channels, and preferences.
- **Passphrase Encryption**: The file is encrypted with Fernet, using a key derived from your passphrase by PBKDF2-HMAC-SHA256 (600,000 iterations). Without the passphrase it cannot be read. A lost passphrase cannot be recovered.
- **Restore**: Import asks for the passphrase and merges into the current install. A wrong passphrase changes nothing. Imported actions always require confirmation before they run.

---

<a id="sqlite-layer"></a>

## 29. Lightweight SQLite Data Layer
- **Standard-library only**: ShellMan talks to SQLite through Python's built-in `sqlite3`, with a small data layer in `models/orm.py` instead of SQLAlchemy. This saves about 20 MB of RAM and two dependencies, and existing databases open unchanged (same tables, columns and date format).
- **Easy queries**: models read like before. `Server.query.get_or_404(3)`, `Server.query.filter_by(host=h).first()`, `AlertEvent.query.filter(AlertEvent.resolved_at.is_(None)).order_by(AlertEvent.id.desc()).all()`, `.count()`, `.update({...})`, `.delete()`. Changes to loaded objects are saved by `db.session.commit()`.
- **Raw SQL when needed**: `db.rows(sql, params)`, `db.scalar(sql, params)` and `db.isolated(sql, params)` (own connection, used by the audit log). Parameters are always passed separately, never formatted into the SQL text.
- **Safe under load**: one connection and one session per thread, writes use `BEGIN IMMEDIATE` with a 15 s busy timeout, and each request ends with a rollback of anything uncommitted.
- **Adding a model**: subclass `db.Model`, declare `db.Column(...)` fields and import it in `app.py`; `db.create_all()` creates the table. Adding a column to an existing table: call `db.add_column_if_missing(table, column, ddl)` in the start-up migration block.

---

<a id="codespaces"></a>

## 30. GitHub Codespaces & Time Budgets
- **Add a Codespace like a server**: in System Settings, Server Nodes, choose "GitHub Codespace", paste a GitHub token and press "Find my Codespaces" (or type the name). The token is stored encrypted and is only used to start, stop and connect. A classic token needs the `codespace` scope; a fine-grained token needs Codespaces read and write. Terminal, file manager, tasks, Docker and the other apps then work as on any SSH server.
- **Requirements**: the ShellMan host needs the GitHub CLI (`gh`) and the OpenSSH client (`ssh`, `ssh-keygen`); the Docker image installs both. The Codespace itself needs an SSH server (the default GitHub image has one; custom devcontainers need the `sshd` feature). Each open connection runs one `gh` process, which costs some extra memory.
- **Create a new Codespace**: in the add dialog press "+ Create a new Codespace", load your repos, choose a branch (optional), idle-stop time and machine size, then Create. ShellMan creates it through the GitHub API and fills in its name; press Create Server to save it. Creating starts the machine and billing at once, and the machine can take a few minutes to become available. A private repo may need the `repo` scope on a classic token.
- **SSH key**: ShellMan creates its own passphrase-free key at `instance/codespace_ed25519` the first time it connects and uses it for every Codespace, so your personal keys (even ones with a passphrase) are never used or prompted for. Keep `instance/` private and include it in your own file backups; the encrypted export does not contain this key, but ShellMan simply creates a new one if it is missing.
- **Never wakes a sleeping Codespace**: ShellMan checks the state through the GitHub API before every connection and refuses to connect while the Codespace is stopped, because `gh codespace ssh` would otherwise start it silently and burn your hours. Press Start in "Time & Power" when you want it running.
- **Time budget**: open "Time & Power" on a Codespace and set a limit in hours per day, week (starts Monday), month or in total (UTC). You see the time remaining in the panel and in a small chip at the bottom left of the desktop. ShellMan warns once at a chosen percentage (default 80%) through your alert channels, and at 100% it either stops the Codespace (action "Stop") or only notifies (action "Warn"). While the budget is used up, Start and new connections are refused.
- **Extensions**: "+1 hour" and "+2 hours" add extra time for the current period only; it does not carry into the next period.
- **Core-hours**: tick "count core-hours" to weigh time by the machine size (a 4-core Codespace running 1 hour uses 4 core-hours), which matches how GitHub bills.
- **Needs the alert engine**: usage is measured once a minute by the background alert engine, so do not set `SHELLMAN_ALERTS=0` if you use budgets. Gaps longer than 5 minutes (for example while ShellMan was off) are not counted.
- **It is an estimate**: ShellMan counts the time it sees the Codespace running. GitHub's own billing page is the final number, and storage is billed separately and is not included. Set the budget a little below your real limit.
- **Limits**: local to remote rsync (File Sync) is not available for Codespaces yet. A rebuilt Codespace gets a new host key; ShellMan does not pin Codespace host keys because the GitHub tunnel already authenticates the machine. `SHELLMAN_GITHUB_API` overrides the API address (for GitHub Enterprise or tests).

---

<a id="viewer-accounts"></a>

## 31. Read-only Users (Viewer Accounts)
- **Two roles**: an **Administrator** can do everything. A **Viewer** can only look: the dashboard, Fleet & History, system overview, processes, services, logs, network info, Docker lists and alerts. A viewer cannot open a terminal, read or change files, run commands, change firewall, cron, Nginx, Git, database or Cloudflare settings, add or edit servers, see the audit log or export backups.
- **Manage people**: Settings, Admin & Security, "People who can sign in". Add a person with a username, password and role, change a role, reset a password or delete an account. Changing a role or password signs that person out of every browser. ShellMan always keeps at least one administrator, and you cannot delete the account you are signed in with.
- **Closed by default**: every request from a viewer is checked in one place (`roles.py`) against a short allow-list, so a feature added later stays closed to viewers until you add it to that list on purpose. Viewers may still change their own password and manage their own 2FA.
- **Existing accounts stay administrators.** The new `role` column is added automatically when ShellMan starts.

---

<a id="recordings"></a>

## 32. Terminal Session Recording
- **What is saved**: each command a person types in the ShellMan terminal is written to the Audit Log as `terminal.command`, with who typed it, which server, the time and the person's IP. Each session also logs `terminal.open` and `terminal.close` (number of commands and length).
- **What is not saved**: the screen output is never stored, so secrets that programs print stay out. Text typed at a password prompt (sudo, ssh, mysql and similar) is replaced by `[hidden input]`, and values that look like secrets (`password=...`, `--token ...`, `-pSECRET`) are replaced by `***`.
- **Honest limits**: it records what was typed, so a line completed with Tab is marked `[Tab]` and a line taken from history with the arrow keys is marked `[history recall]`, because the final command is not visible from keystrokes alone. Text typed inside a full-screen program (vim, htop) is recorded as typed lines too.
- **Control**: turn it off or on under Audit Log, "Record typed terminal commands". The normal audit retention (days and maximum entries) applies, so recordings clean themselves up.

---

<a id="fleet"></a>

## 33. Fleet Dashboard & Metric History
- **Fleet**: one page with a card for every server showing CPU, memory and disk bars, load, a one-hour CPU sparkline and when it was last read. Cards that need attention (offline, or any value at 75% or more) sort first. Click a card to open its graphs.
- **History**: CPU, memory and disk graphs for the last 1 hour, 6 hours, 24 hours, 7 days or 30 days, with a hover tooltip. Gaps appear where a server was off or stopped.
- **No extra load**: the background alert engine already reads each server once per check, so history stores one reading per server per minute from the same read. The Fleet page and graphs read stored data and never open their own SSH connections. Stopped GitHub Codespaces are skipped and never woken.
- **Small and self-cleaning**: readings are plain SQLite rows (about 0.4 MB per server per week). By default 7 days are kept; administrators can choose 1 to 90 days, switch recording off or clear it in the History tab. Graphs are averaged into at most 240 points.
- **Needs the alert engine**: do not set `SHELLMAN_ALERTS=0` if you want Fleet and History to fill in. `SHELLMAN_ALERT_INTERVAL` (default 60 seconds) controls how often servers are read; history keeps at most one reading per minute.

---

<a id="fonts"></a>

## 34. Fonts & Look Customization
Settings > Appearance now has a **Fonts & Look** card. You can choose a different font for the interface, for headings and the clock, for the desktop widgets, for app windows, for desktop icons and the dock, and for code, paths and the terminal. Each list offers system fonts and popular web fonts, and an "Other font" option lets you type the name of any font installed on your computer. Web fonts are fetched from Google Fonts the first time you pick them. Three sliders change the size of the desktop widgets, the size of desktop icon labels and how round the corners are. Open terminals and the code editor switch font straight away. Everything is saved in your browser (and included in Backup & Export), and "Reset all to default" removes it again. The Rsync, Git Deployment, Docker Compose and SQLite pickers now start in `/home/` instead of `/var/www/`, and the Server Backup mirror defaults to `/home/backup/`.

---

<a id="sql-viewers"></a>

## 35. MySQL / MariaDB / PostgreSQL Viewers
The Database Explorer tabs for MySQL/MariaDB and PostgreSQL now talk to the backend like the SQLite one does. Pick a tab, enter the database user (and password if the server needs one), press Connect, then choose a database, browse tables and views, and run queries in the console (Ctrl+Enter). Results show up to 500 rows and can be exported as CSV. The user name is remembered in this browser; the password never is.

Queries are read-only, enforced twice: a statement checker refuses anything that is not SELECT, SHOW, DESCRIBE, EXPLAIN, WITH, TABLE or VALUES (and refuses several statements in one go, `INTO OUTFILE` and `LOAD_FILE`), and the database session itself is opened read-only. Passwords are passed through environment variables, never on the command line. If a plain login is refused, ShellMan retries as the local administrative account (socket authentication for MariaDB, the `postgres` user for PostgreSQL). Backups of both engines are written with mode 600. Every query and dump is recorded in the audit log. PostgreSQL needs `psql` 12 or newer on the server.

---

<a id="apache"></a>

## 36. Apache Web Server Manager
A new app next to Nginx for servers that run Apache (`apache2` on Debian and Ubuntu, `httpd` on RHEL, Fedora and Arch). It is not pinned to the dock by default; add it from the launcher or the start menu.
- **Sites:** lists every virtual host with its domains, ports, document root or proxy target and HTTPS state. Create a static site or a reverse proxy (the proxy modules are enabled for you), enable, disable or delete a site.
- **Config files:** edit `apache2.conf`, `ports.conf`, sites and conf snippets. Every save runs `apachectl configtest` first; a config that fails the test is rolled back so the sites stay up.
- **Modules:** enable or disable modules on Debian and Ubuntu (a change that breaks the config is undone). On RHEL the list is read-only.
- **Logs:** tail any file in the Apache log folder.
- **SSL:** issue a Let's Encrypt certificate with `certbot --apache` and turn on the HTTP to HTTPS redirect.
- **Service:** config test, reload, restart, start and stop. Changes are written to the audit log, and viewer accounts cannot use the app.

---

<a id="theme"></a>

## 37. Light and Dark Theme

A small switch sits next to the node selector on the desktop (and top right of the sign-in pages): a flat pill with a sliding disc that flips between a moon and a sun. Changing theme grows a circle of the new theme from the switch, and the dock, desktop icons and widgets flip over in 3D. Settings, Appearance also has Dark, Light and Match device. The choice is saved in this browser (`shellman_theme`) and applied before the first paint, so there is no flash.

Light mode is deliberately flat and quiet: white panels, hairline borders, no glass blur, no glow and no drop shadows. It has its own palette, accent shades, form controls (checkboxes, radios, range, date pickers, file buttons) and editor theme (Monaco switches between `vs` and `vs-dark`); terminals keep their own colors. The desktop wallpaper, its dark wash and the labels sitting on it are the same in both themes unless you assign a different wallpaper per theme ([Wallpapers](#wallpapers)). Animations are skipped when the system asks for reduced motion.

For developers: all theme colors are CSS variables. `static/css/light.css` holds the light values (`:root[data-theme="light"]`), `static/js/theme.js` the switch and the change animation. Use `var(--sm-*)` or `rgba(var(--wash), a)` / `rgba(var(--shade), a)` instead of hard-coded colors so both themes keep working.

---

<a id="wallpapers"></a>

## 38. Wallpapers: one per theme, uploads and live wallpapers

Settings, Appearance, Wallpaper holds up to 10 presets. Upload an image or a video from your device, or add a URL, and it becomes a preset; every preset has Dark, Light and Both buttons, so each theme can use its own wallpaper and you can change it at any time. Deleting a preset that a theme is using puts that theme back on the default wallpaper. Animated GIFs and short videos (MP4, WebM, MOV, OGV) play as a live wallpaper: they are muted, loop, and pause while the browser tab is hidden or when the system asks for reduced motion. Uploads are stored in `instance/wallpapers` under random names, only whitelisted image and video types are accepted (the file header must match its extension, and SVG is refused), images are limited to 40 MB and videos to 300 MB. Deleting an uploaded preset also deletes the file. Presets and the dark/light choice are stored in this browser (`shellman_wall_presets`, `shellman_wall_dark`, `shellman_wall_light`); uploaded files that are missing from a browser's presets reappear there while there is room. Only administrators can upload or delete; viewer accounts still see the wallpaper. Routes: `GET /wallpapers/<name>`, `GET /api/wallpapers`, `POST /api/wallpapers/upload`, `DELETE /api/wallpapers/<name>`. Code: `routes/wallpapers.py`, `static/js/desktop/wallpaper.js`, and the Appearance tab in `static/js/desktop/settings.js`.

<a id="effects"></a>

## 39. Effects and virtual desktops: living wallpaper, 3D fleet, process universe, 3D workspace switch

Settings, Appearance, Effects has one switch per effect, a Quality setting (Full or Light) and All on / All off buttons. An effect that is off costs nothing, every effect pauses while the browser tab is hidden, and all of them start switched off when the system asks for reduced motion. The choices are stored in this browser (`shellman_fx`).

- **Living wallpaper.** A WebGL fragment shader drawn over the wallpaper, at reduced resolution. CPU load sets the flow speed, RAM sets the fog density, network traffic sets the ripples, and a critical alert shifts the colour to red until it is resolved.
- **Materialize windows.** A window resolves in with a scanline decode led by a `$` bar, and dissolves into its dock icon when it is closed.
- **File manager effects.** A beam travels from the file row to its destination for each progress step of a transfer (the existing SSE stream), folders open with a depth zoom, deleted rows are shredded into strips, and compressed rows fold into the first row.
- **Fleet constellation.** A third tab in Fleet & History. ShellMan is the centre and each server is a body on its own orbit: CPU sets the orbit speed and the size, offline servers go dark, hovering shows CPU, RAM and disk, and clicking flies the camera to that server and opens its history. While an rsync or a Git deployment runs, a comet flies from the centre to that server. Three.js is vendored in `static/vendor/three` and loaded only when this tab opens.
- **Process universe.** A view in the Task Manager (the Universe button). Processes are bodies sized by RAM and coloured by CPU, busy ones circle faster, zombies drift to the rim, stopped processes get a dashed ring, and a killed process collapses and bursts. Click a body for the normal process menu.
- **3D workspace switch.** The desktop has virtual desktops (2 to 6, default 4). Each window lives on one workspace; the others are hidden, not closed. `Ctrl+Alt+Left/Right` switches, `Ctrl+Alt+1..9` jumps, `Ctrl+Alt+Shift+Left/Right` carries the active window along, and a right-click on a title bar offers Move to workspace. The pill at the top centre also switches. With the effect on, the windows turn as a 3D cube or a 3D slide (pick one in Settings); with it off the switch is instant. Opening an app that is already running on another workspace jumps to it.

In light mode every effect is flat: no glow and no shadow. Code: `static/js/desktop/fx.js` (switches, shader, window and file effects), `workspaces.js`, `fleet3d.js`, `procuniverse.js`.

