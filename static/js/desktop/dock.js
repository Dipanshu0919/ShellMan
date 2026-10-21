/**
 * ShellMan OS: Floating Dock & Application Launcher (dock.js)
 */

const DesktopDock = {
  dockEl: null,
  isHandlingClick: false,
  apps: [
    {
      id: 'overview',
      title: 'System Overview',
      gradient: 'linear-gradient(135deg, #0284c7, #0d9488)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="7" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><rect x="3" y="14" width="18" height="7" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><circle cx="6.5" cy="6.5" r="1.2" fill="#38bdf8"/><circle cx="9.5" cy="6.5" r="1.2" fill="#34d399"/><circle cx="6.5" cy="17.5" r="1.2" fill="#38bdf8"/><circle cx="9.5" cy="17.5" r="1.2" fill="#34d399"/><path d="M15 6.5h3M15 17.5h3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>'
    },
    {
      id: 'terminal',
      title: 'SSH Terminal (PTY)',
      gradient: 'linear-gradient(135deg, #090d16, #1e293b)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="3" fill="#090d16" stroke="#38bdf8" stroke-width="1.5"/><path d="M6.5 9l3.5 3-3.5 3" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="15" x2="16.5" y2="15" stroke="#34d399" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'files',
      title: 'File Manager (SFTP)',
      gradient: 'linear-gradient(135deg, #2563eb, #0284c7)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v2H3V6z" fill="rgba(255,255,255,0.35)"/><path d="M2.5 10h19l-1.5 9a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2l-1.5-9z" fill="#ffffff" fill-opacity="0.95"/><path d="M8 14h8M8 17h5" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round"/></svg>'
    },
    {
      id: 'code',
      title: 'Code Workspace (Monaco)',
      gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><path d="M8.5 9.5L5.5 12l3 2.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 9.5l3 2.5-3 2.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="13" y1="8" x2="11" y2="16" stroke="#c084fc" stroke-width="1.8" stroke-linecap="round"/></svg>'
    },
    {
      id: 'processes',
      title: 'Task Manager (Processes)',
      gradient: 'linear-gradient(135deg, #059669, #10b981)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><path d="M6 12h3l2-4 3 8 2-4h2" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    },
    {
      id: 'services',
      title: 'System Services (systemd)',
      gradient: 'linear-gradient(135deg, #ea580c, #f97316)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.5" fill="rgba(255,255,255,0.25)" stroke="#ffffff" stroke-width="1.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'logs',
      title: 'System Logs (journalctl)',
      gradient: 'linear-gradient(135deg, #e11d48, #c026d3)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><line x1="7.5" y1="7.5" x2="16.5" y2="7.5" stroke="#fcd34d" stroke-width="1.7" stroke-linecap="round"/><line x1="7.5" y1="12" x2="14.5" y2="12" stroke="#38bdf8" stroke-width="1.7" stroke-linecap="round"/><line x1="7.5" y1="16.5" x2="12" y2="16.5" stroke="#34d399" stroke-width="1.7" stroke-linecap="round"/></svg>'
    },
    // {
    //   id: 'hardware',
    //   title: 'Hardware Architecture',
    //   gradient: 'linear-gradient(135deg, #7c3aed, #9333ea)',
    //   icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="#c084fc"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>'
    // },
    // {
    //   id: 'network',
    //   title: 'Network & Sockets',
    //   gradient: 'linear-gradient(135deg, #0284c7, #3b82f6)',
    //   icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="4" ry="9" stroke="#ffffff" stroke-width="1.5"/><line x1="3" y1="12" x2="21" y2="12" stroke="#38bdf8" stroke-width="1.5"/></svg>'
    // },
    {
      id: 'nginx',
      title: 'Nginx & Domains (Proxy & SSL)',
      gradient: 'linear-gradient(135deg, #059669, #0d9488)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><path d="M7 16V8l5 8V8M16 8v8" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    },
    {
      id: 'settings',
      title: 'System Settings',
      gradient: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#ffffff" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    },
    // {
    //   id: 'servers',
    //   title: 'Managed Nodes',
    //   gradient: 'linear-gradient(135deg, #e11d48, #be123c)',
    //   icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="6.5" rx="1.5" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><rect x="3" y="14.5" width="18" height="6.5" rx="1.5" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><circle cx="6.5" cy="6.2" r="1" fill="#ffffff"/><circle cx="6.5" cy="17.7" r="1" fill="#ffffff"/><line x1="10" y1="6.2" x2="18" y2="6.2" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/><line x1="10" y1="17.7" x2="18" y2="17.7" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/></svg>'
    // }
  ],

  init(dockEl) {
    this.dockEl = dockEl || document.getElementById('desktopDock');
    if (!this.dockEl) return;

    this.render();

    // Hook into WindowManager state changes to update running dots
    if (window.WindowManager) {
      window.WindowManager.onWindowStateChange = (windows, activeId) => {
        this.updateRunningIndicators(windows, activeId);
      };
    }
  },

  render() {
    if (!this.dockEl) return;
    this.dockEl.innerHTML = this.apps.map(app => `
      <div class="dock-item" data-app="${app.id}" data-tooltip="${app.title}" onclick="DesktopDock.handleDockClick('${app.id}')">
        <div class="dock-tile" style="background: ${app.gradient};">
          ${app.icon}
        </div>
        <span class="running-dot"></span>
      </div>
    `).join('');
  },

  updateRunningIndicators(windows, activeId) {
    if (!this.dockEl) return;
    const runningAppIds = new Set();
    let activeAppId = null;

    windows.forEach(win => {
      runningAppIds.add(win.appId);
      if (win.id === activeId) activeAppId = win.appId;
    });

    this.dockEl.querySelectorAll('.dock-item').forEach(item => {
      const appId = item.dataset.app;
      if (runningAppIds.has(appId)) {
        item.classList.add('running');
      } else {
        item.classList.remove('running');
      }

      if (appId === activeAppId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  },

  handleDockClick(appId) {
    if (this.isHandlingClick) return;
    this.isHandlingClick = true;
    setTimeout(() => { this.isHandlingClick = false; }, 280);

    if (!window.WindowManager) return;

    // Check if an open instance of appId exists
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
      // Launch new app instance
      if (window.DesktopApps && typeof window.DesktopApps.launch === 'function') {
        window.DesktopApps.launch(appId);
      }
    }
  }
};

window.DesktopDock = DesktopDock;

