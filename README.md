<p align="center">
  <img src="static/images/logo-horizontal.png" alt="ShellMan Logo" width="620">
</p>

<p align="center">
  <strong>The Agentless Linux Remote Infrastructure Workspace & Web Operating Environment</strong><br>
  <em>Manage all your Linux VPS, clouds, and bare-metal servers from your local machine with 0 MB resident RAM overhead.</em>
</p>

<p align="center">
  <a href="#the-story-why-shellman"><img src="https://img.shields.io/badge/Agent-0_MB_Overhead-0ea5e9?style=for-the-badge&logo=linux&logoColor=white" alt="Agentless"></a>
  <a href="#quick-start-guide"><img src="https://img.shields.io/badge/Python-3.9+-38bdf8?style=for-the-badge&logo=python&logoColor=white" alt="Python Version"></a>
  <a href="#2-real-interactive-ssh-pty-terminal"><img src="https://img.shields.io/badge/Terminal-xterm.js_%2B_PTY-10b981?style=for-the-badge&logo=gnometerminal&logoColor=white" alt="Terminal"></a>
  <a href="#3-sftp-file-manager-with-recursive-folder-drag-and-drop--custom-actions"><img src="https://img.shields.io/badge/Transport-SFTP_over_SSH-f59e0b?style=for-the-badge&logo=files&logoColor=white" alt="SFTP"></a>
  <a href="#6-real-time-task-manager--linux-process-control"><img src="https://img.shields.io/badge/Processes-POSIX_Control-34d399?style=for-the-badge&logo=htop&logoColor=white" alt="Processes"></a>
  <a href="#8-nginx-web-server-reverse-proxy-routing--certbot-ssl"><img src="https://img.shields.io/badge/Routing-Nginx_%2B_Certbot_SSL-059669?style=for-the-badge&logo=nginx&logoColor=white" alt="Nginx & Certbot"></a>
  <a href="#9-progressive-web-app-pwa-support"><img src="https://img.shields.io/badge/PWA-Installable-8b5cf6?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA Ready"></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-MIT-64748b?style=for-the-badge" alt="License"></a>
</p>

---

## The Story: Why ShellMan?

### Tired of Server Panels Eating Up Half Your VPS RAM?

Picture this: You spin up an affordable 1 GB or 2 GB Linux VPS for a project, database, or API service. You want an intuitive dashboard to monitor health, edit configuration files, inspect logs, and upload assets without typing twenty terminal commands for every minor change.

So you install a traditional server manager like cPanel, Plesk, Webmin, Cockpit, or aaPanel, and immediately encounter significant drawbacks:

- **Bloated Daemons Everywhere**: Node.js runtimes, heavy Python processes, background pollers, and custom web servers are installed directly onto your server.
- **400 MB to 800 MB RAM Consumed**: Before you have even deployed your application, half your server memory is consumed just running the management panel.
- **Expanded Attack Surfaces**: You are forced to expose non-standard inbound ports (`8080`, `2087`, `9090`) to the public internet, inviting port scanners and brute-force attempts.
- **Invasive Uninstalls**: Removing traditional panels often leaves behind stray packages, altered firewall rules, and broken system dependencies.

### The Solution: Run It On Your Machine

> **Why should your remote server waste compute running its own management UI when you have a powerful workstation in front of you?**

**ShellMan flips the architecture on its head.**

Instead of installing an invasive panel on remote servers, you run **ShellMan locally on your laptop, desktop, or private gateway**. ShellMan communicates with your Linux servers exclusively over standard, battle-tested **OpenSSH (Port 22) and SFTP**.

- **0 MB Persistent RAM on your servers**: Absolutely nothing is installed on your remote machines.
- **No background daemons**: No persistent monitoring daemons or cron jobs consuming remote CPU cycles.
- **No extra ports required**: If your server accepts standard SSH on port 22, ShellMan works out of the box.
- **Instant multi-node switching**: Manage staging boxes, production clusters, Raspberry Pis, and home labs from a single desktop interface.

Your remote servers dedicate **100% of their compute and memory to your workloads**.

---

## Technical Comparison: Traditional Panels vs. ShellMan

| Metric / Feature | Traditional Panels (cPanel, Webmin, Cockpit) | ShellMan |
| :--- | :--- | :--- |
| **Agent / Daemon Required on Target** | Yes (Persistent resident daemon) | **None (100% Agentless)** |
| **Managed Server RAM Overhead** | 300 MB - 800 MB | **0 MB (Zero resident footprint)** |
| **Inbound Firewall Ports Needed** | Custom open ports (`8080`, `9090`, etc.) | **Standard OpenSSH (Port 22 only)** |
| **Multi-Node Fleet Control** | Often requires paid multi-server licenses | **Built-in instant node switcher** |
| **File Transfer Experience** | Basic single-file HTML uploaders | **Recursive folder Drag & Drop via SFTP** |
| **Web Server & SSL Automation** | Manual CLI certbot or complex vhost edits | **1-click Reverse Proxy Routing, Certbot SSL automation, & safe syntax validation with auto-rollback** |
| **Custom Automations** | Hardcoded menus or complex plugins | **Extensible Custom Actions with safe POSIX variable injection & 33+ vector SVGs** |
| **Process & Task Management** | Coarse CPU list or heavy background poller | **Agentless POSIX control (SIGTERM, SIGKILL, SIGSTOP, SIGCONT) with RSS & PSS memory metrics** |
| **Terminal Capability** | Simulated web console | **Real interactive PTY with xterm.js (vim, htop, tmux)** |
| **Code Editing** | Plain textarea or basic editor | **Full Monaco Editor (VS Code engine)** |
| **Interface Style** | Tab-heavy static web pages | **Fluid Multi-Window Web Desktop OS & PWA** |
| **Clean Exit** | Leaves packages, scripts, & config cruft | **Disconnect SSH and your server is completely untouched** |

---

## Visual Showcase

### 1. Modern Linux Desktop Operating Environment
> Atmospheric wallpaper, live system telemetry panel, application dock, and active connected node switcher with privacy IP masking.
<p align="center">
  <img src="docs/screenshots/desktop-overview.png" alt="ShellMan Desktop Environment" width="950">
</p>

### 2. Remote SFTP File Manager with Recursive Drag-and-Drop & Custom Actions
> Dual-pane remote file browser with directory tree navigation, persistent resizable properties panel, recursive folder drag-and-drop, and an extensible Custom Actions engine with safe parameter interpolation and live terminal handoff.
<p align="center">
  <img src="docs/screenshots/file-manager-sftp.png" alt="ShellMan SFTP File Manager" width="950">
</p>

### 3. Authentic Interactive SSH PTY Terminal
> Low-latency WebSockets streaming xterm.js PTY directly connected to remote Linux instances with full curses navigation.
<p align="center">
  <img src="docs/screenshots/terminal-window.png" alt="ShellMan SSH PTY Terminal" width="950">
</p>

### 4. Monaco Code Workspace (VS Code Engine)
> Full remote IDE with multi-tab workspace, folder tree explorer, syntax highlighting, and instant asynchronous SFTP save.
<p align="center">
  <img src="docs/screenshots/code-workspace.png" alt="ShellMan Monaco Code Workspace" width="950">
</p>

### 5. Node Fleet Management & Quick Server Onboarding
> System Settings modal for registering remote nodes with encrypted credentials, custom SSH ports, and instant connection testing.
<p align="center">
  <img src="docs/screenshots/settings-node-management.png" alt="ShellMan Server Node Management" width="950">
</p>

---

## Key Features

### 1. Multi-Window Desktop Workspace (Window Manager)
- **True Desktop Experience**: Open multiple applications side-by-side. Move, resize, minimize to dock, maximize, and cascade windows smoothly.
- **Interactive Application Dock**: Launch and switch between Overview, Terminal, File Manager, Code Workspace, Task Manager, Nginx & Domains Manager, Services, Logs, and Settings.
- **Central Node Switcher**: Seamlessly switch active servers with one click.
- **Privacy IP Masking Toggle**: Sensitive server IP addresses are masked by default (`20.219.2***:22`). Click the inline eye icon SVG to reveal or hide unmasked host endpoints instantly.
- **Persistent Preferences**: Wallpapers, window geometry, and privacy settings persist in local browser storage.

### 2. Real Interactive SSH PTY Terminal
- **True Pseudo-Terminal (PTY)**: Backed by Paramiko `invoke_shell(term='xterm-256color')` streamed over low-latency WebSockets directly to `xterm.js`.
- **Full Curses & Terminal App Support**: Effortlessly run `htop`, `vim`, `nano`, `tmux`, `less`, `tail -f`, and interactive REPLs with zero input lag.
- **Signal Handling**: Dedicated raw input interception handles <kbd>Ctrl</kbd>+<kbd>C</kbd>, <kbd>Ctrl</kbd>+<kbd>D</kbd>, <kbd>Ctrl</kbd>+<kbd>Z</kbd>, <kbd>Ctrl</kbd>+<kbd>L</kbd>, and arrow keys without browser collision.
- **Dynamic Viewport Auto-Fit**: Window resizes trigger real-time PTY terminal column and row recalculations via `fitAddon`.

### 3. SFTP File Manager with Recursive Folder Drag-and-Drop & Custom Actions
- **Custom Actions Automation Engine**: Turn recurring shell commands into reusable remote buttons directly embedded in the file manager.
  - **Safe POSIX Parameter Substitution**: Variables are safely quoted and escaped to prevent command injection: `{{selected_path}}`, `{{selected_name}}`, `{{current_dir}}`, `{{selected_paths}}`, and `{{server_name}}`.
  - **Embedded Output Panel & Terminal Handoff**: Run actions with live status badges, exit code tracking, stdout/stderr output streaming, rerun button, and a 1-click terminal handoff to continue interactively.
  - **Confirmation Shield**: Optional confirmation dialog displaying the target server, selected remote paths, and exact command preview before execution.
  - **Extensive Vector Icon Library**: Searchable 3-column palette featuring 33+ clean vector SVG icons tailored for Linux administration (Deploy, Run, Shield, Lock, Key, Checksum, Archive, Logs, Database, Server, CPU, Cloud, Download, Upload, Restart, Trash, Wrench, Zap, Search, Alert, Code, Backup, Network, Health, Release, Git, Container, Web, Link, Config).
  - **Export & Import**: Share custom actions between servers and teammates via standardized JSON export/import.
- **Persistent Drag-to-Resize Properties Drawer**: An interactive vertical split handle allows dragging the right-side properties panel from 220px to 750px. Width persists in local storage across browser reloads. Double-click the handle to restore default width.
- **Recursive Folder Drag-and-Drop**: Drag entire directory hierarchies from your local workstation directly into the browser — ShellMan automatically creates remote folders recursively (`mkdir -p`) and uploads all nested files.
- **Target Folder Hover Detection**: Hover dropped files directly over a target folder row or grid tile to upload straight into that subdirectory.
- **Dual View Modes & Batch Operations**: Switch between a compact details list and a responsive thumbnail grid. Inspect permissions (`chmod`), ownership (`chown`), file sizes, and timestamps. Batch move, copy, compress (`.zip`/`.tar.gz`), and delete items.

### 4. Monaco Code Workspace (VS Code Engine)
- **Full-Fledged Editor**: Powered by Microsoft Monaco with syntax highlighting, bracket matching, line numbers, and multi-cursor support.
- **Broad Language Support**: Python, JavaScript, TypeScript, Shell Script, Dockerfile, Nginx config, JSON, YAML, HTML, CSS, SQL, and Markdown.
- **Fast Remote Editing**: Hotkeys for Quick Open (<kbd>Ctrl</kbd>+<kbd>P</kbd>) and instant asynchronous SFTP remote save (<kbd>Ctrl</kbd>+<kbd>S</kbd>).

### 5. Live Telemetry & Resource Hub
- **Hardware Telemetry**: Real-time dials for CPU usage %, RAM distribution (Used / Total), swap memory, and load averages (1m, 5m, 15m).
- **Disk Partition Mounts**: Visual usage meters for root (`/`), boot mounts, and external drives.
- **OS & Kernel Specs**: Linux distribution detection, kernel release, uptime counter, and CPU architecture.

### 6. Real-Time Task Manager & Linux Process Control
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

### 7. System Services & Journalctl Logs
- **Systemd Unit Control**: Inspect all service states (`active`, `running`, `failed`, `inactive`) with one-click Start, Stop, and Restart actions.
- **System & Journalctl Logs**: Stream journal logs in real-time with filtering by service unit and severity level.

### 8. Nginx Web Server, Reverse Proxy Routing & Certbot SSL
- **Reverse Proxy Domain Routing**: Route public domains and subdomains to internal backend services and microservices running on local ports (Node.js, Python/Flask/FastAPI, Next.js, Go, or Docker containers).
- **Automated Let's Encrypt SSL via Certbot**: 1-click HTTPS certificate issuance and renewals via Certbot and the Certbot Nginx plugin, with automated HTTP-to-HTTPS redirect rule generation.
- **Virtual Host Manager**: Create, enable, disable, and delete virtual host configurations (`/etc/nginx/sites-available` and `/etc/nginx/sites-enabled`) with automated symlink management.
- **Safe Configuration Editor with Auto-Rollback**: Inspect and modify `/etc/nginx/nginx.conf` and site configs inside an embedded editor. Every save is pre-flight tested using `nginx -t`. If validation fails, changes are instantly rolled back to the backup copy to prevent service downtime.
- **Service Controls**: One-click configuration reload (`nginx -s reload`), service restart, syntax testing, and native package installer for Nginx and Certbot across Debian, Ubuntu, RHEL/CentOS, and Arch Linux.

### 9. Progressive Web App (PWA) Support
- **Installable Desktop App**: Install ShellMan as a native desktop application in Chrome, Brave, Edge, or Safari with custom window controls overlay.
- **Distraction-Free**: Runs in standalone mode without browser tabs, address bars, or extension clutter.

---

## Quick Start Guide

### 1. Requirements
- **Python 3.9+**
- Standard Linux, macOS, or Windows (WSL recommended) environment

### 2. Installation

```bash
# 1. Clone the repository
git clone https://github.com/Dipanshu0919/ShellMan.git
cd ShellMan

# 2. Set up virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

### 3. Launch ShellMan

```bash
python3 app.py
```

Open your browser and navigate to:
```text
http://127.0.0.1:5000
```

### 4. Guided First-Time Setup Wizard (No Default Credentials)
> [!IMPORTANT]
> **ShellMan does not ship with insecure default passwords.**
> On your very first visit, you will automatically be directed to the **First-Time Setup Wizard** (`/setup`) where you create your master administrator username and secure password. Once created, the wizard locks permanently and launches you directly into your desktop environment.

---

## Security Architecture

- **Zero-Agent Attack Surface**: Because no daemon runs on your managed server, there are no extra background listeners or open ports vulnerable to exploitation.
- **Fernet AES-128 Encryption**: Server passwords and SSH private keys are stored using symmetric authenticated encryption (`cryptography.fernet.Fernet`).
- **IP Masking**: Server IP addresses in the top node pill are masked to prevent accidental leakage during screen shares or streaming, with an interactive toggle button to unmask when needed.
- **Path Traversal Protection**: All SFTP path parameters are strictly normalized and sanitized against directory traversal attacks (`../`).
- **Key Authentication**: Full support for standard password authentication as well as RSA and Ed25519 OpenSSH private key pairs (with passphrase support).

---

## Productivity Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>Tab</kbd> | Interactive Application Switcher |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Quick Command Palette & Server Search |
| <kbd>Ctrl</kbd> + <kbd>P</kbd> | File Search in Monaco Workspace |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Save File directly over SFTP |
| <kbd>Ctrl</kbd> + <kbd>C</kbd> | Piped directly to remote terminal (`SIGINT`) |
| <kbd>Ctrl</kbd> + <kbd>D</kbd> | Piped directly to remote terminal (`EOF`) |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Piped directly to remote terminal (`SIGTSTP`) |

---

## License

This project is licensed under the **MIT License**. Feel free to use, modify, and deploy it for personal use, team infrastructure, or enterprise fleets.
