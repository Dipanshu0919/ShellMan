/**
 * ShellMan OS: Master Application Registry, Dock & Desktop Customizer (dock.js)
 * Enables complete end-user customization of pinned dock apps and desktop shortcuts.
 */

window.SHELLMAN_APPS = [
  {
    id: 'overview',
    title: 'System Overview',
    shortTitle: 'Overview',
    desc: 'Mission control telemetry: CPU, RAM, Disk, Load & Network',
    category: 'system',
    gradient: 'linear-gradient(135deg, #0284c7, #0d9488)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="7" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><rect x="3" y="14" width="18" height="7" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><circle cx="6.5" cy="6.5" r="1.2" fill="#38bdf8"/><circle cx="9.5" cy="6.5" r="1.2" fill="#34d399"/><circle cx="6.5" cy="17.5" r="1.2" fill="#38bdf8"/><circle cx="9.5" cy="17.5" r="1.2" fill="#34d399"/><path d="M15 6.5h3M15 17.5h3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'terminal',
    title: 'SSH Terminal (PTY)',
    shortTitle: 'Terminal',
    desc: 'Raw interactive xterm.js terminal emulator over SSH',
    category: 'core',
    gradient: 'linear-gradient(135deg, #090d16, #1e293b)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="3" fill="#090d16" stroke="#38bdf8" stroke-width="1.5"/><path d="M6.5 9l3.5 3-3.5 3" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="15" x2="16.5" y2="15" stroke="#34d399" stroke-width="2" stroke-linecap="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'files',
    title: 'File Manager (SFTP)',
    shortTitle: 'Files',
    desc: 'High-speed remote file explorer, drag & drop uploader',
    category: 'core',
    gradient: 'linear-gradient(135deg, #2563eb, #0284c7)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v2H3V6z" fill="rgba(255,255,255,0.35)"/><path d="M2.5 10h19l-1.5 9a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2l-1.5-9z" fill="#ffffff" fill-opacity="0.95"/><path d="M8 14h8M8 17h5" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'code',
    title: 'Code Workspace',
    shortTitle: 'Code Editor',
    desc: 'Full Monaco code IDE with remote folder tree & syntax highlights',
    category: 'core',
    gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><path d="M8.5 9.5L5.5 12l3 2.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 9.5l3 2.5-3 2.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="13" y1="8" x2="11" y2="16" stroke="#c084fc" stroke-width="1.8" stroke-linecap="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'docker',
    title: 'Docker & Containers',
    shortTitle: 'Docker',
    desc: 'Container orchestrator, live log streaming, start/stop/restart',
    category: 'containers',
    gradient: 'linear-gradient(135deg, #0284c7, #2563eb)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="3" height="3" fill="#ffffff"/><rect x="7" y="11" width="3" height="3" fill="#ffffff"/><rect x="11" y="11" width="3" height="3" fill="#ffffff"/><rect x="7" y="7" width="3" height="3" fill="#ffffff"/><rect x="11" y="7" width="3" height="3" fill="#ffffff"/><rect x="15" y="11" width="3" height="3" fill="#ffffff"/><path d="M2 14c1.5 4 5 6 10 6s9-3 10-6c-1-1-3-1-4 0-1.5 1.5-4 1-5 0-1.5-1.5-4-1-5 0-1.5 1-4 0-6 0z" stroke="#ffffff" stroke-width="1.8"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'database',
    title: 'Database Explorer & Backups',
    shortTitle: 'Database',
    desc: 'SQLite .db viewer, table schema, MySQL & Postgres dump backups',
    category: 'database',
    gradient: 'linear-gradient(135deg, #0d9488, #059669)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="5" rx="9" ry="3" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.8"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="#ffffff" stroke-width="1.8"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="#ffffff" stroke-width="1.8"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'firewall',
    title: 'Firewall & Shield (UFW)',
    shortTitle: 'Firewall',
    desc: 'UFW rule manager, port security, Fail2Ban live unban',
    category: 'security',
    gradient: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'ssh_diag',
    title: 'SSH Connection Diagnostics',
    shortTitle: 'SSH Diag',
    desc: 'SSH cipher suite, latency RTT ping, throughput, tunnel telemetry',
    category: 'security',
    gradient: 'linear-gradient(135deg, #4f46e5, #0ea5e9)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#ffffff" stroke-width="1.8"/><path d="M12 6v6l4 2" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/><path d="M2 12h3M19 12h3" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'processes',
    title: 'Task Manager (Processes)',
    shortTitle: 'Processes',
    desc: 'Active system processes, CPU/RAM usage, kill, renice',
    category: 'system',
    gradient: 'linear-gradient(135deg, #059669, #10b981)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><path d="M6 12h3l2-4 3 8 2-4h2" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'services',
    title: 'System Services (systemd)',
    shortTitle: 'Services',
    desc: 'systemctl daemon management: start, stop, restart, enable',
    category: 'system',
    gradient: 'linear-gradient(135deg, #ea580c, #f97316)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.5" fill="rgba(255,255,255,0.25)" stroke="#ffffff" stroke-width="1.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'logs',
    title: 'System Logs (journalctl)',
    shortTitle: 'Logs',
    desc: 'Real-time syslog streaming and journalctl filtering',
    category: 'system',
    gradient: 'linear-gradient(135deg, #e11d48, #c026d3)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><line x1="7.5" y1="7.5" x2="16.5" y2="7.5" stroke="#fcd34d" stroke-width="1.7" stroke-linecap="round"/><line x1="7.5" y1="12" x2="14.5" y2="12" stroke="#38bdf8" stroke-width="1.7" stroke-linecap="round"/><line x1="7.5" y1="16.5" x2="12" y2="16.5" stroke="#34d399" stroke-width="1.7" stroke-linecap="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'hardware',
    title: 'Hardware Architecture',
    shortTitle: 'Hardware',
    desc: 'CPU cores, RAM layout, storage block devices, lshw topology',
    category: 'system',
    gradient: 'linear-gradient(135deg, #7c3aed, #9333ea)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="#c084fc"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>',
    defaultDock: false,
    defaultDesktop: true
  },
  {
    id: 'network',
    title: 'Network & Netstat',
    shortTitle: 'Network',
    desc: 'Listening TCP/UDP ports, active socket telemetry, SYN flood detector',
    category: 'network',
    gradient: 'linear-gradient(135deg, #0284c7, #3b82f6)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="4" ry="9" stroke="#ffffff" stroke-width="1.5"/><line x1="3" y1="12" x2="21" y2="12" stroke="#38bdf8" stroke-width="1.5"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'nginx',
    title: 'Nginx Virtual Hosts',
    shortTitle: 'Nginx Hosts',
    desc: 'vHost reverse proxy manager, syntax check, live reload',
    category: 'web',
    gradient: 'linear-gradient(135deg, #059669, #0d9488)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><path d="M7 16V8l5 8V8M16 8v8" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'domains',
    title: 'Cloudflare Domains & DNS',
    shortTitle: 'Cloudflare',
    desc: 'DNS records, edge caching, 15-year Origin CA generation',
    category: 'web',
    gradient: 'linear-gradient(135deg, #d97706, #f59e0b)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ffffff" stroke-width="1.8"/><line x1="2" y1="12" x2="22" y2="12" stroke="#ffffff" stroke-width="1.8"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#ffffff" stroke-width="1.8"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'sync',
    title: 'File Sync (Rsync)',
    shortTitle: 'File Sync',
    desc: 'Agentless Rsync file synchronization over raw SSH',
    category: 'core',
    gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'cron',
    title: 'Cron Scheduler',
    shortTitle: 'Cron Jobs',
    desc: 'Visual cron expression generator & scheduled job runner',
    category: 'system',
    gradient: 'linear-gradient(135deg, #d97706, #f59e0b)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><polyline points="12 6 12 12 16 14" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'git',
    title: 'Git Deployment',
    shortTitle: 'Git Deploy',
    desc: '1-click remote git pull, branch switching, post-deploy triggers',
    category: 'web',
    gradient: 'linear-gradient(135deg, #e11d48, #f43f5e)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="18" cy="18" r="3" stroke="#ffffff" stroke-width="1.8"/><circle cx="6" cy="6" r="3" stroke="#ffffff" stroke-width="1.8"/><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12" stroke="#ffffff" stroke-width="1.8"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  },
  {
    id: 'settings',
    title: 'System Settings',
    shortTitle: 'Settings',
    desc: 'Server nodes, 2FA TOTP security, desktop wallpaper & preferences',
    category: 'system',
    gradient: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#ffffff" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    defaultDock: true,
    defaultDesktop: true
  }
];

/**
 * DesktopCustomizer: Manages persistence and UI for Desktop shortcuts and Dock pins.
 */
const DesktopCustomizer = {
  STORAGE_KEY_DESKTOP: 'shellman_desktop_apps',
  STORAGE_KEY_DOCK: 'shellman_dock_apps',
  STORAGE_KEY_DESKTOP_SIZE: 'shellman_desktop_icon_size',

  getAllApps() {
    return window.SHELLMAN_APPS || [];
  },

  getApp(appId) {
    return this.getAllApps().find(a => a.id === appId) || null;
  },

  getDesktopApps() {
    const raw = localStorage.getItem(this.STORAGE_KEY_DESKTOP);
    if (!raw) {
      return this.getAllApps().filter(a => a.defaultDesktop !== false);
    }
    try {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids) && ids.length > 0) {
        return ids.map(id => this.getApp(id)).filter(Boolean);
      }
    } catch (_) {}
    return this.getAllApps().filter(a => a.defaultDesktop !== false);
  },

  getDockApps() {
    const raw = localStorage.getItem(this.STORAGE_KEY_DOCK);
    if (!raw) {
      return this.getAllApps().filter(a => a.defaultDock !== false);
    }
    try {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids) && ids.length > 0) {
        return ids.map(id => this.getApp(id)).filter(Boolean);
      }
    } catch (_) {}
    return this.getAllApps().filter(a => a.defaultDock !== false);
  },

  isAppOnDesktop(appId) {
    return this.getDesktopApps().some(a => a.id === appId);
  },

  isAppInDock(appId) {
    return this.getDockApps().some(a => a.id === appId);
  },

  setDesktopApps(appIds) {
    localStorage.setItem(this.STORAGE_KEY_DESKTOP, JSON.stringify(appIds));
    this.applyChanges();
  },

  setDockApps(appIds) {
    localStorage.setItem(this.STORAGE_KEY_DOCK, JSON.stringify(appIds));
    this.applyChanges();
  },

  toggleDesktopApp(appId, enable) {
    const current = this.getDesktopApps().map(a => a.id);
    const set = new Set(current);
    if (enable) set.add(appId);
    else set.delete(appId);
    this.setDesktopApps(Array.from(set));
    if (typeof window.showToast === 'function') {
      window.showToast(`${enable ? 'Added to' : 'Removed from'} Desktop Shortcuts`, 'info');
    }
  },

  toggleDockApp(appId, enable) {
    const current = this.getDockApps().map(a => a.id);
    const set = new Set(current);
    if (enable) set.add(appId);
    else set.delete(appId);
    this.setDockApps(Array.from(set));
    if (typeof window.showToast === 'function') {
      window.showToast(`${enable ? 'Pinned to' : 'Unpinned from'} Floating Dock`, 'info');
    }
  },

  getDesktopIconSize() {
    return localStorage.getItem(this.STORAGE_KEY_DESKTOP_SIZE) || 'normal';
  },

  setDesktopIconSize(size) {
    if (!['compact', 'normal', 'large'].includes(size)) size = 'normal';
    localStorage.setItem(this.STORAGE_KEY_DESKTOP_SIZE, size);
    this.applyChanges();
    if (typeof window.showToast === 'function') {
      window.showToast(`Desktop icon size set to ${size}`, 'info');
    }
  },

  resetDefaults() {
    localStorage.removeItem(this.STORAGE_KEY_DESKTOP);
    localStorage.removeItem(this.STORAGE_KEY_DOCK);
    localStorage.removeItem(this.STORAGE_KEY_DESKTOP_SIZE);
    this.applyChanges();
    if (typeof window.showToast === 'function') {
      window.showToast('Desktop and Dock layout reset to default settings', 'info');
    }
  },

  applyChanges() {
    if (typeof window.renderDesktopIcons === 'function') {
      window.renderDesktopIcons();
    }
    if (window.DesktopDock && typeof window.DesktopDock.render === 'function') {
      window.DesktopDock.apps = this.getDockApps();
      window.DesktopDock.render();
      if (window.WindowManager) {
        window.DesktopDock.updateRunningIndicators(window.WindowManager.windows, window.WindowManager.activeWindowId);
      }
    }
  },

  openCustomizerModal() {
    const allApps = this.getAllApps();
    const currentSize = this.getDesktopIconSize();

    const overlay = document.createElement('div');
    overlay.className = 'desktop-modal-backdrop';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.76);
      backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center;
      z-index: 100000; padding: 1rem; font-family: var(--font-sans); color: var(--text-primary);
    `;

    overlay.innerHTML = `
      <div style="width: 100%; max-width: 720px; height: 600px; background: var(--bg-surface, #111827); border: 1px solid var(--border-color, #1f2937); border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85); display: flex; flex-direction: column; overflow: hidden;">
        <!-- Header -->
        <div style="height: 46px; padding: 0 1.1rem; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 0.55rem; font-weight: 700; font-size: 0.9rem; color: #f8fafc;">
            <svg style="width: 18px; height: 18px; color: var(--sm-accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <span>Customize Desktop Shortcuts &amp; Floating Dock</span>
          </div>
          <button class="btn btn-secondary btn-xs" id="customizerCloseBtn" style="padding: 0.15rem 0.45rem;">&times;</button>
        </div>

        <!-- Controls Toolbar: Icon Size & Bulk Actions -->
        <div style="padding: 0.65rem 1.1rem; border-bottom: 1px solid var(--border-subtle); background: rgba(0,0,0,0.22); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Desktop Icon Size:</span>
            <div style="display: flex; gap: 2px; background: var(--bg-canvas, #090d16); border: 1px solid var(--border-color, #1f2937); border-radius: 5px; padding: 2px;">
              <button class="btn btn-xs ${currentSize === 'compact' ? 'btn-primary' : 'btn-ghost'}" id="btnSizeCompact" style="font-size:0.7rem; padding:0.15rem 0.55rem;">Compact</button>
              <button class="btn btn-xs ${currentSize === 'normal' ? 'btn-primary' : 'btn-ghost'}" id="btnSizeNormal" style="font-size:0.7rem; padding:0.15rem 0.55rem;">Normal</button>
              <button class="btn btn-xs ${currentSize === 'large' ? 'btn-primary' : 'btn-ghost'}" id="btnSizeLarge" style="font-size:0.7rem; padding:0.15rem 0.55rem;">Large</button>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem;">
            <button class="btn btn-secondary btn-xs" id="btnSelectAllDesktop" style="font-size: 0.7rem;">Select All Desktop</button>
            <button class="btn btn-secondary btn-xs" id="btnSelectAllDock" style="font-size: 0.7rem;">Select All Dock</button>
            <button class="btn btn-secondary btn-xs" id="btnResetDefaults" style="font-size: 0.7rem; color: #ef4444;">Reset Layout</button>
          </div>
        </div>

        <!-- Search Bar -->
        <div style="padding: 0.45rem 1.1rem; border-bottom: 1px solid var(--border-subtle); background: rgba(0,0,0,0.12); flex-shrink: 0;">
          <div style="display: flex; align-items: center; background: var(--bg-canvas, #090d16); border: 1px solid var(--border-color, #1f2937); border-radius: 6px; padding: 0.2rem 0.55rem;">
            <svg style="width: 13px; height: 13px; color: #94a3b8; margin-right: 0.4rem; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="customizerSearchInput" placeholder="Filter applications by name or category..." style="width: 100%; background: transparent; border: none; outline: none; font-family: var(--font-sans); font-size: 0.78rem; color: #f8fafc;">
          </div>
        </div>

        <!-- Applications Table List -->
        <div id="customizerAppsList" style="flex: 1; overflow-y: auto; padding: 0.6rem 1.1rem; display: flex; flex-direction: column; gap: 4px;">
        </div>

        <!-- Footer -->
        <div style="padding: 0.65rem 1.1rem; border-top: 1px solid var(--border-subtle); background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
          <div style="font-size: 0.73rem; color: var(--text-muted);">
            Changes apply instantly and persist in your browser profile.
          </div>
          <button class="btn btn-primary btn-sm" id="customizerDoneBtn" style="font-weight: 600; padding: 0.35rem 1.1rem;">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const listEl = overlay.querySelector('#customizerAppsList');
    const searchInp = overlay.querySelector('#customizerSearchInput');
    const closeBtn = overlay.querySelector('#customizerCloseBtn');
    const doneBtn = overlay.querySelector('#customizerDoneBtn');

    const renderList = (filter = '') => {
      filter = (filter || '').toLowerCase().trim();
      const filtered = allApps.filter(app => {
        if (!filter) return true;
        return app.title.toLowerCase().includes(filter) ||
               app.shortTitle.toLowerCase().includes(filter) ||
               app.desc.toLowerCase().includes(filter) ||
               (app.category && app.category.toLowerCase().includes(filter));
      });

      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted); font-size:0.8rem;">No applications matching "${filter}"</div>`;
        return;
      }

      listEl.innerHTML = filtered.map(app => {
        const onDesktop = this.isAppOnDesktop(app.id);
        const inDock = this.isAppInDock(app.id);
        return `
          <div class="customizer-app-row" data-id="${app.id}" style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.75rem; border-radius:6px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); transition:background 0.15s;">
            <!-- Left: Icon & Details -->
            <div style="display:flex; align-items:center; gap:0.75rem; min-width:0; flex:1;">
              <div style="width:34px; height:34px; border-radius:8px; background:${app.gradient}; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 6px rgba(0,0,0,0.4);">
                <div style="width:18px; height:18px; display:flex; align-items:center; justify-content:center;">
                  ${app.icon}
                </div>
              </div>
              <div style="min-width:0; overflow:hidden;">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span style="font-weight:600; font-size:0.82rem; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${app.title}</span>
                  <span class="badge" style="font-size:0.62rem; text-transform:uppercase; background:rgba(255,255,255,0.06); color:var(--text-muted); padding:1px 4px;">${app.category}</span>
                </div>
                <div style="font-size:0.71rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${app.desc}</div>
              </div>
            </div>

            <!-- Right: Checkbox Toggles -->
            <div style="display:flex; align-items:center; gap:1.1rem; flex-shrink:0;">
              <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-size:0.75rem; user-select:none;">
                <input type="checkbox" class="chk-desktop" data-id="${app.id}" ${onDesktop ? 'checked' : ''} style="cursor:pointer; width:14px; height:14px; accent-color:color-mix(in srgb, var(--sm-accent) 78%, #000);">
                <span style="color:${onDesktop ? '#f8fafc' : 'var(--text-muted)'}; font-weight:${onDesktop ? '600' : '400'};">Desktop</span>
              </label>
              <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-size:0.75rem; user-select:none;">
                <input type="checkbox" class="chk-dock" data-id="${app.id}" ${inDock ? 'checked' : ''} style="cursor:pointer; width:14px; height:14px; accent-color:var(--sm-accent);">
                <span style="color:${inDock ? '#f8fafc' : 'var(--text-muted)'}; font-weight:${inDock ? '600' : '400'};">Dock</span>
              </label>
            </div>
          </div>
        `;
      }).join('');

      // Attach checkbox listeners
      listEl.querySelectorAll('.chk-desktop').forEach(chk => {
        chk.onchange = () => {
          this.toggleDesktopApp(chk.dataset.id, chk.checked);
          renderList(searchInp.value);
        };
      });

      listEl.querySelectorAll('.chk-dock').forEach(chk => {
        chk.onchange = () => {
          this.toggleDockApp(chk.dataset.id, chk.checked);
          renderList(searchInp.value);
        };
      });
    };

    renderList();

    searchInp.oninput = () => renderList(searchInp.value);

    // Icon Size Toggles
    const updateSizeButtons = (sz) => {
      overlay.querySelector('#btnSizeCompact').className = `btn btn-xs ${sz === 'compact' ? 'btn-primary' : 'btn-ghost'}`;
      overlay.querySelector('#btnSizeNormal').className = `btn btn-xs ${sz === 'normal' ? 'btn-primary' : 'btn-ghost'}`;
      overlay.querySelector('#btnSizeLarge').className = `btn btn-xs ${sz === 'large' ? 'btn-primary' : 'btn-ghost'}`;
    };

    overlay.querySelector('#btnSizeCompact').onclick = () => {
      this.setDesktopIconSize('compact');
      updateSizeButtons('compact');
    };
    overlay.querySelector('#btnSizeNormal').onclick = () => {
      this.setDesktopIconSize('normal');
      updateSizeButtons('normal');
    };
    overlay.querySelector('#btnSizeLarge').onclick = () => {
      this.setDesktopIconSize('large');
      updateSizeButtons('large');
    };

    // Bulk actions
    overlay.querySelector('#btnSelectAllDesktop').onclick = () => {
      this.setDesktopApps(allApps.map(a => a.id));
      renderList(searchInp.value);
    };
    overlay.querySelector('#btnSelectAllDock').onclick = () => {
      this.setDockApps(allApps.map(a => a.id));
      renderList(searchInp.value);
    };
    overlay.querySelector('#btnResetDefaults').onclick = () => {
      this.resetDefaults();
      updateSizeButtons('normal');
      renderList(searchInp.value);
    };

    const closeModal = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    closeBtn.onclick = closeModal;
    doneBtn.onclick = closeModal;
  }
};

window.DesktopCustomizer = DesktopCustomizer;

/**
 * DesktopDock: Main Floating Dock Controller
 */
const DesktopDock = {
  dockEl: null,
  isHandlingClick: false,
  apps: [],
  tempIds: [], // running apps that are not pinned (shown after the pinned apps)

  init(dockEl) {
    this.dockEl = dockEl || document.getElementById('desktopDock');
    if (!this.dockEl) return;
    this.wrapperEl = this.dockEl.closest('.desktop-dock-wrapper') || document.getElementById('dockWrapper');

    this.apps = DesktopCustomizer.getDockApps();
    this.render();

    // Restore saved dock visibility state
    if (localStorage.getItem('shellman_dock_hidden') === 'true' && this.wrapperEl) {
      this.wrapperEl.classList.add('dock-hidden');
    }

    this.initAutoHide();
    this.applyAutoHide();

    // Hook into WindowManager state changes to update running dots
    if (window.WindowManager) {
      window.WindowManager.onWindowStateChange = (windows, activeId) => {
        this.updateRunningIndicators(windows, activeId);
      };
    }
  },

  // ── Auto-hide: dock slides away while any visible window is maximized; hover the bottom
  //    edge to peek. Right-click the dock's hide button (or any dock icon) to turn it on/off.
  AUTOHIDE_KEY: 'shellman_dock_autohide',
  isAutoHide() { return localStorage.getItem(this.AUTOHIDE_KEY) === 'true'; },
  setAutoHide(on) {
    localStorage.setItem(this.AUTOHIDE_KEY, on ? 'true' : 'false');
    this.applyAutoHide();
    if (window.showToast) window.showToast(on ? 'Dock auto-hide: ON (hides when an app is maximized)' : 'Dock auto-hide: OFF', 'info', 2200);
  },
  applyAutoHide() {
    if (!this.wrapperEl) return;
    let full = false;
    const wm = window.WindowManager;
    if (this.isAutoHide() && wm && window.innerWidth > 720) {
      wm.windows.forEach(w => { if (w.isMaximized && !w.isMinimized && !w.isClosing) full = true; });
    }
    this.wrapperEl.classList.toggle('dock-autohide-active', full);
    if (!full) this.wrapperEl.classList.remove('dock-peek');
  },
  initAutoHide() {
    if (!this.wrapperEl || this._autoHideWired) return;
    this._autoHideWired = true;
    let hotspot = document.getElementById('dockHotspot');
    if (!hotspot) {
      hotspot = document.createElement('div');
      hotspot.id = 'dockHotspot';
      hotspot.className = 'dock-hotspot';
      this.wrapperEl.appendChild(hotspot);
    }
    let leaveTimer = null;
    const show = () => { clearTimeout(leaveTimer); if (this.wrapperEl.classList.contains('dock-autohide-active')) this.wrapperEl.classList.add('dock-peek'); };
    const hide = () => { clearTimeout(leaveTimer); leaveTimer = setTimeout(() => this.wrapperEl.classList.remove('dock-peek'), 450); };
    // The "Show Dock" tab stays visible while auto-hide has the dock tucked away.
    const trig = document.getElementById('dockPeekTrigger');
    if (trig) {
      trig.onclick = () => {
        if (this.wrapperEl.classList.contains('dock-hidden')) this.toggleHide(false);
        else { show(); hide(); }          // reveal now, tuck away again after the pointer leaves
      };
      trig.addEventListener('mouseenter', show);
      trig.addEventListener('mouseleave', hide);
    }
    hotspot.addEventListener('mouseenter', show);
    hotspot.addEventListener('mouseleave', hide);
    this.dockEl.addEventListener('mouseenter', show);
    this.dockEl.addEventListener('mouseleave', hide);
    window.addEventListener('resize', () => this.applyAutoHide());
  },
  autoHideMenuItem() {
    const on = this.isAutoHide();
    return {
      label: on ? 'Auto-hide: On' : 'Auto-hide: Off',
      icon: on
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="var(--sm-accent,#38bdf8)" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="4"/><polyline points="8 12.5 11 15.5 16 9"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>',
      action: () => DesktopDock.setAutoHide(!on)
    };
  },
  handleToggleContext(e) {
    e.preventDefault();
    e.stopPropagation();
    const items = [
      {
        label: 'Hide Dock now',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h16M12 4v11M8 11l4 4 4-4"/></svg>',
        action: () => DesktopDock.toggleHide(true)
      },
      this.autoHideMenuItem()
    ];
    if (window.DesktopMenus && typeof window.DesktopMenus.showCustomMenu === 'function') {
      window.DesktopMenus.showCustomMenu(e, items);
    }
  },

  toggleHide(forceState = null) {
    if (!this.wrapperEl) {
      this.wrapperEl = this.dockEl ? this.dockEl.closest('.desktop-dock-wrapper') : document.getElementById('dockWrapper');
    }
    if (!this.wrapperEl) return;

    const willHide = forceState !== null ? forceState : !this.wrapperEl.classList.contains('dock-hidden');
    this.wrapperEl.classList.toggle('dock-hidden', willHide);
    localStorage.setItem('shellman_dock_hidden', willHide ? 'true' : 'false');

    if (window.showToast) {
      window.showToast(willHide ? 'Dock minimized (Click bottom bar to restore)' : 'Dock visible', 'info', 1800);
    }
  },

  // App entry for any appId: registry app, or a generic fallback built from the window title.
  resolveApp(appId) {
    const app = DesktopCustomizer.getApp(appId);
    if (app) return app;
    let title = appId;
    if (window.WindowManager) {
      window.WindowManager.windows.forEach(w => { if (w.appId === appId && w.titleEl) title = w.titleEl.textContent || title; });
    }
    return {
      id: appId, title, shortTitle: title,
      gradient: 'linear-gradient(135deg, #334155, #1e293b)',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/></svg>'
    };
  },

  // Recompute running-but-unpinned apps from open windows. Returns true when the list changed.
  syncTemp(windows) {
    const pinned = new Set(this.apps.map(a => a.id));
    const running = [];
    if (windows) {
      windows.forEach(w => {
        if (!w.isClosing && w.appId && !pinned.has(w.appId) && !running.includes(w.appId)) running.push(w.appId);
      });
    }
    // keep existing order, append newcomers
    const next = this.tempIds.filter(id => running.includes(id)).concat(running.filter(id => !this.tempIds.includes(id)));
    const changed = next.join('|') !== this.tempIds.join('|');
    this.tempIds = next;
    return changed;
  },

  dockItemHtml(app, temp) {
    return `
      <div class="dock-item${temp ? ' dock-temp' : ''}" data-app="${app.id}" data-tooltip="${app.title}" onclick="DesktopDock.handleDockClick('${app.id}')" oncontextmenu="DesktopDock.handleContextMenu(event, '${app.id}')">
        <div class="dock-tile" style="background: ${app.gradient};">
          ${app.icon}
        </div>
        <span class="running-dot"></span>
      </div>
    `;
  },

  render() {
    if (!this.dockEl) return;
    this.apps = DesktopCustomizer.getDockApps();
    this.syncTemp(window.WindowManager ? window.WindowManager.windows : null);

    const pinnedHtml = this.apps.map(app => this.dockItemHtml(app, false)).join('');
    const tempHtml = this.tempIds.length
      ? '<div class="dock-sep dock-sep-temp"></div>' + this.tempIds.map(id => this.dockItemHtml(this.resolveApp(id), true)).join('')
      : '';
    const appsHtml = pinnedHtml + tempHtml;

    const toggleBtnHtml = `
      <div class="dock-sep"></div>
      <div class="dock-item dock-toggle-item" id="dockToggleBtn" data-tooltip="Hide Dock (right-click: auto-hide)" onclick="DesktopDock.toggleHide()" oncontextmenu="DesktopDock.handleToggleContext(event)" title="Hide Dock. Right-click for auto-hide">
        <div class="dock-tile dock-toggle-tile">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 20h16M12 4v11M8 11l4 4 4-4"/>
          </svg>
        </div>
      </div>
    `;

    this.dockEl.innerHTML = appsHtml + toggleBtnHtml + `<div class="dock-active-pill" id="dockActivePill"></div>`;

    if (window.WindowManager) {
      this.updateRunningIndicators(window.WindowManager.windows, window.WindowManager.activeWindowId);
    }
  },

  bounce(appId) {
    if (!this.dockEl) return;
    const item = this.dockEl.querySelector(`.dock-item[data-app="${appId}"]`);
    if (!item) return;
    item.classList.remove('bouncing');
    void item.offsetWidth; // force DOM reflow to restart animation
    item.classList.add('bouncing');
    setTimeout(() => {
      item.classList.remove('bouncing');
    }, 700);
  },

  handleContextMenu(e, appId) {
    e.preventDefault();
    e.stopPropagation();
    const app = this.resolveApp(appId);
    if (!app) return;
    const isOnDesktop = DesktopCustomizer.isAppOnDesktop(appId);
    const isPinned = DesktopCustomizer.isAppInDock(appId);
    const appWins = [];
    if (window.WindowManager) window.WindowManager.windows.forEach(w => { if (w.appId === appId && !w.isClosing) appWins.push(w); });
    const items = [
      { type: 'header', label: app.title, icon: app.icon, gradient: app.gradient },
      {
        label: `Open ${app.shortTitle || app.title}`,
        icon: app.icon,
        action: () => DesktopDock.handleDockClick(appId)
      },
      'separator',
      {
        label: isOnDesktop ? 'Remove from Desktop' : 'Add to Desktop',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
        action: () => DesktopCustomizer.toggleDesktopApp(appId, !isOnDesktop)
      },
      isPinned ? {
        label: 'Unpin from Dock',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
        action: () => DesktopCustomizer.toggleDockApp(appId, false)
      } : {
        label: 'Keep in Dock',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3-1-7z"/></svg>',
        action: () => DesktopCustomizer.toggleDockApp(appId, true)
      },
      ...(appWins.length ? [{
        label: appWins.length > 1 ? `Close all windows (${appWins.length})` : 'Close window',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 10l6 6M15 10l-6 6"/></svg>',
        action: () => appWins.forEach(w => window.WindowManager.closeWindow(w.id))
      }] : []),
      'separator',
      {
        label: 'Customize Desktop & Dock...',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
        action: () => DesktopCustomizer.openCustomizerModal()
      },
      {
        label: 'Hide Dock',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h16M12 4v11M8 11l4 4 4-4"/></svg>',
        action: () => DesktopDock.toggleHide(true)
      },
      DesktopDock.autoHideMenuItem()
    ];

    if (window.DesktopMenus && typeof window.DesktopMenus.showCustomMenu === 'function') {
      window.DesktopMenus.showCustomMenu(e, items);
    }
  },

  updateRunningIndicators(windows, activeId) {
    this.applyAutoHide();
    if (!this.dockEl) return;
    // an unpinned app opened or closed: rebuild the dock (render() calls us again)
    if (this.syncTemp(windows)) { this.render(); return; }
    const runningAppIds = new Set();
    const visibleAppIds = new Set();
    let activeAppId = null;

    windows.forEach(win => {
      if (win.isClosing) return;
      runningAppIds.add(win.appId);
      if (!win.isMinimized) visibleAppIds.add(win.appId);
      if (win.id === activeId && !win.isMinimized) activeAppId = win.appId;
    });

    let activeItem = null;
    this.dockEl.querySelectorAll('.dock-item[data-app]').forEach(item => {
      const appId = item.dataset.app;
      if (runningAppIds.has(appId)) {
        item.classList.add('running');
      } else {
        item.classList.remove('running');
      }
      // every window of this app is minimized
      item.classList.toggle('minimized', runningAppIds.has(appId) && !visibleAppIds.has(appId));

      if (appId === activeAppId) {
        item.classList.add('active');
        activeItem = item;
      } else {
        item.classList.remove('active');
      }
    });

    // Update sliding indicator pill under active app
    let pill = this.dockEl.querySelector('#dockActivePill');
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'dock-active-pill';
      pill.id = 'dockActivePill';
      this.dockEl.appendChild(pill);
    }
    if (activeItem) {
      const left = activeItem.offsetLeft + (activeItem.offsetWidth / 2) - 10;
      pill.style.opacity = '1';
      pill.style.transform = `translateX(${left}px)`;
    } else {
      pill.style.opacity = '0';
    }
  },

  handleDockClick(appId) {
    if (this.isHandlingClick) return;
    this.isHandlingClick = true;
    setTimeout(() => { this.isHandlingClick = false; }, 280);

    // Trigger lifelike dock bounce animation
    this.bounce(appId);

    if (!window.WindowManager) return;

    let existingWin = null;
    window.WindowManager.windows.forEach(w => {
      if (w.appId === appId && !existingWin) existingWin = w;
    });

    if (existingWin) {
      if (existingWin.isMinimized) {
        window.WindowManager.restoreWindow(existingWin.id);
        window.WindowManager.focusWindow(existingWin.id);
      } else if (window.WindowManager.activeWindowId === existingWin.id) {
        window.WindowManager.minimizeWindow(existingWin.id);
      } else {
        window.WindowManager.focusWindow(existingWin.id);
      }
    } else {
      if (window.DesktopApps && typeof window.DesktopApps.launch === 'function') {
        window.DesktopApps.launch(appId);
      }
    }
  }
};

window.DesktopDock = DesktopDock;