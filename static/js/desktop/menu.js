/**
 * ShellMan OS: Context Menu, Start Menu, Alt+Tab, and Command Palette (menu.js)
 */

class DesktopMenusController {
  constructor() {
    this.contextMenuEl = null;
    this.startMenuEl = null;
    this.altTabEl = null;
    this.cmdPaletteEl = null;
    this.altTabSelectionIndex = 0;
    this.isAltTabActive = false;
  }

  init() {
    this.contextMenuEl = document.getElementById('desktopContextMenu');
    this.startMenuEl = document.getElementById('startMenuPopup');
    this.altTabEl = document.getElementById('altTabSwitcher');
    this.cmdPaletteEl = document.getElementById('cmdPalette');

    // Close popups on outside click
    document.addEventListener('pointerdown', (e) => {
      if (this.contextMenuEl && !this.contextMenuEl.contains(e.target)) {
        this.contextMenuEl.classList.remove('open');
      }
      if (this.startMenuEl && !this.startMenuEl.contains(e.target) && !e.target.closest('#startMenuBtn')) {
        this.startMenuEl.classList.remove('open');
      }
      const srvMenu = document.getElementById('serverSelectorMenu');
      if (srvMenu && !srvMenu.contains(e.target) && !e.target.closest('#serverSelectorPill') && !e.target.closest('.widget-location-badge')) {
        srvMenu.style.display = 'none';
      }
    });

    // Global keyboard listener for Alt+Tab, Ctrl+K, Escape
    this.setupShortcuts();
  }

  // --- Context Menu ---
  showContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!this.contextMenuEl) return;

    // Build dynamic wallpaper context menu with desktop and dock customization
    const currentSize = window.DesktopCustomizer ? window.DesktopCustomizer.getDesktopIconSize() : 'normal';
    const items = [
      {
        label: 'Customize Desktop & Dock...',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
        action: () => {
          if (window.DesktopCustomizer) window.DesktopCustomizer.openCustomizerModal();
        }
      },
      {
        label: `Icon Size: ${currentSize.charAt(0).toUpperCase() + currentSize.slice(1)}`,
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>',
        action: () => {
          const next = currentSize === 'normal' ? 'large' : (currentSize === 'large' ? 'compact' : 'normal');
          if (window.DesktopCustomizer) window.DesktopCustomizer.setDesktopIconSize(next);
        }
      },
      'separator',
      {
        label: 'New Terminal',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>',
        action: () => { if (window.DesktopApps) window.DesktopApps.launch('terminal'); }
      },
      {
        label: 'Open File Manager',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
        action: () => { if (window.DesktopApps) window.DesktopApps.launch('files'); }
      },
      {
        label: 'Code Workspace',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
        action: () => { if (window.DesktopApps) window.DesktopApps.launch('code'); }
      },
      'separator',
      {
        label: 'Cascade Windows',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="14" height="14" rx="2"></rect><path d="M7 21h14a2 2 0 0 0 2-2V7"></path></svg>',
        action: () => { if (window.WindowManager) window.WindowManager.cascadeWindows(); }
      },
      {
        label: 'Minimize All Windows',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="12" x2="20" y2="12"></line></svg>',
        action: () => { if (window.WindowManager) window.WindowManager.minimizeAll(); }
      },
      'separator',
      {
        label: 'Reset Layout to Defaults',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>',
        action: () => {
          if (window.DesktopCustomizer) window.DesktopCustomizer.resetDefaults();
        }
      },
      {
        label: 'System Settings',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"></path></svg>',
        action: () => { if (window.DesktopApps) window.DesktopApps.launch('settings'); }
      }
    ];

    this.showCustomMenu(e, items);
  }

  showCustomMenu(e, items) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!this.contextMenuEl || !Array.isArray(items)) return;

    this.contextMenuEl.innerHTML = items.map(item => {
      if (item === 'separator' || item.type === 'separator') {
        return '<div class="ctx-sep"></div>';
      }
      return `
        <div class="ctx-item ${item.danger ? 'text-danger' : ''}" style="${item.style || ''}">
          ${item.icon || ''}
          <span>${this.escapeHtml(item.label)}</span>
        </div>
      `;
    }).join('');

    const itemEls = this.contextMenuEl.querySelectorAll('.ctx-item');
    let realIdx = 0;
    items.forEach(item => {
      if (item === 'separator' || item.type === 'separator') return;
      const el = itemEls[realIdx++];
      if (el) {
        el.onclick = (ev) => {
          ev.stopPropagation();
          this.contextMenuEl.classList.remove('open');
          if (typeof item.action === 'function') item.action(ev);
        };
      }
    });

    const menuWidth = 230;
    const menuHeight = Math.min(420, items.length * 36 + 12);
    const clientX = e ? e.clientX : window.innerWidth / 2;
    const clientY = e ? e.clientY : window.innerHeight / 2;
    const posX = Math.min(window.innerWidth - menuWidth - 10, Math.max(10, clientX));
    const posY = Math.min(window.innerHeight - menuHeight - 10, Math.max(10, clientY));

    this.contextMenuEl.style.left = `${posX}px`;
    this.contextMenuEl.style.top = `${posY}px`;
    this.contextMenuEl.classList.add('open');
  }

  // --- Start Menu ---
  toggleStartMenu(e) {
    if (e) e.stopPropagation();
    if (!this.startMenuEl) return;
    this.startMenuEl.classList.toggle('open');
    if (this.startMenuEl.classList.contains('open')) {
      const search = this.startMenuEl.querySelector('#startSearchInput');
      if (search) {
        search.value = '';
        this.filterStartApps('');
        search.focus();
      }
    }
  }

  filterStartApps(query) {
    query = query.toLowerCase().trim();
    const items = this.startMenuEl.querySelectorAll('.ctx-item');
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      if (!query || text.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  // --- Alt+Tab Task Switcher ---
  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ctrl+K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openCommandPalette();
        return;
      }

      // Alt+Tab Task Switcher
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault();
        this.handleAltTabPress();
        return;
      }

      // Escape dismisses open modals
      if (e.key === 'Escape') {
        if (this.contextMenuEl) this.contextMenuEl.classList.remove('open');
        if (this.startMenuEl) this.startMenuEl.classList.remove('open');
        if (this.cmdPaletteEl) this.cmdPaletteEl.style.display = 'none';
      }
    });

    window.addEventListener('keyup', (e) => {
      // Releasing Alt while Alt+Tab is active confirms switch
      if (e.key === 'Alt' && this.isAltTabActive) {
        this.confirmAltTabSwitch();
      }
    });
  }

  handleAltTabPress() {
    const wins = Array.from(WindowManager.windows.values());
    if (wins.length === 0) return;

    if (!this.isAltTabActive) {
      this.isAltTabActive = true;
      this.altTabSelectionIndex = (wins.length > 1) ? 1 : 0;
      this.renderAltTab(wins);
      this.altTabEl.classList.add('open');
    } else {
      this.altTabSelectionIndex = (this.altTabSelectionIndex + 1) % wins.length;
      this.updateAltTabSelection(wins);
    }
  }

  renderAltTab(wins) {
    const grid = this.altTabEl.querySelector('#altTabGrid');
    if (!grid) return;

    grid.innerHTML = wins.map((win, idx) => `
      <div class="alt-tab-card ${idx === this.altTabSelectionIndex ? 'selected' : ''}" data-id="${win.id}">
        ${win.icon}
        <span class="alt-tab-card-title">${win.title}</span>
      </div>
    `).join('');
  }

  updateAltTabSelection(wins) {
    const cards = this.altTabEl.querySelectorAll('.alt-tab-card');
    cards.forEach((card, idx) => {
      if (idx === this.altTabSelectionIndex) card.classList.add('selected');
      else card.classList.remove('selected');
    });
  }

  confirmAltTabSwitch() {
    this.isAltTabActive = false;
    this.altTabEl.classList.remove('open');
    const wins = Array.from(WindowManager.windows.values());
    if (wins[this.altTabSelectionIndex]) {
      const targetId = wins[this.altTabSelectionIndex].id;
      WindowManager.focusWindow(targetId);
    }
  }

  // --- Command Palette ---
  openCommandPalette() {
    if (!this.cmdPaletteEl) return;
    this.cmdPaletteEl.style.display = 'flex';
    const input = this.cmdPaletteEl.querySelector('#cmdInput');
    if (input) {
      input.value = '';
      this._selectedIndex = 0;
      this._activeQuery = '';
      this.renderCommandResults('');
      input.focus();

      if (!input._hasPaletteNav) {
        input._hasPaletteNav = true;
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigatePalette(1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigatePalette(-1);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            this.execCommand(this._selectedIndex || 0);
          } else if (e.key === 'Escape') {
            this.closeCommandPalette();
          }
        });
      }
    }
  }

  closeCommandPalette() {
    if (this.cmdPaletteEl) this.cmdPaletteEl.style.display = 'none';
    if (this._fileSearchTimer) clearTimeout(this._fileSearchTimer);
  }

  navigatePalette(dir) {
    if (!this._currentCmds || this._currentCmds.length === 0) return;
    this._selectedIndex = Math.max(0, Math.min(this._currentCmds.length - 1, (this._selectedIndex || 0) + dir));
    const items = this.cmdPaletteEl.querySelectorAll('.cmd-item');
    items.forEach((item, idx) => {
      const isSel = idx === this._selectedIndex;
      item.classList.toggle('selected', isSel);
      if (isSel) item.scrollIntoView({ block: 'nearest' });
    });
  }

  renderCommandResults(query) {
    const rawQuery = (query || '').trim();
    const qLower = rawQuery.toLowerCase();
    this._activeQuery = rawQuery;
    this._selectedIndex = 0;

    const resultsContainer = this.cmdPaletteEl.querySelector('#cmdResults');
    if (!resultsContainer) return;

    const currentServerId = window.DesktopConfig ? window.DesktopConfig.serverId : null;
    const currentServerName = window.DesktopConfig ? window.DesktopConfig.serverName : 'Server';

    // 1. Applications & Window Actions
    const availableCommands = [
      { name: 'Terminal', desc: 'Open interactive SSH shell', action: () => DesktopApps.launch('terminal'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>' },
      { name: 'File Manager', desc: 'Browse, edit, and upload SFTP files', action: () => DesktopApps.launch('files'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>' },
      { name: 'Code Workspace', desc: 'Open Monaco remote IDE', action: () => DesktopApps.launch('code'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>' },
      { name: 'System Overview', desc: 'View live node telemetry & dials', action: () => DesktopApps.launch('overview'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>' },
      { name: 'Task Manager', desc: 'Manage Linux processes & signals', action: () => DesktopApps.launch('processes'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>' },
      { name: 'Systemd Services', desc: 'Start, stop, and restart units', action: () => DesktopApps.launch('services'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' },
      { name: 'System Logs', desc: 'Stream journalctl entries with syntax highlighter', action: () => DesktopApps.launch('logs'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>' },
      { name: 'Hardware Specs', desc: 'View CPU architecture & interfaces', action: () => DesktopApps.launch('hardware'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>' },
      { name: 'Network & Sockets', desc: 'Inspect listening ports and established connections', action: () => DesktopApps.launch('network'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg>' },
      { name: 'Firewall & Shield (UFW)', desc: 'Configure UFW packet filter rules, policies, and Fail2Ban security jails', action: () => DesktopApps.launch('firewall'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>' },
      { name: 'Docker & Containers', desc: 'Manage containers, inspect live stream logs, view metrics, and compose projects', action: () => DesktopApps.launch('docker'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="3" height="3"></rect><rect x="7" y="11" width="3" height="3"></rect><rect x="11" y="11" width="3" height="3"></rect><path d="M2 14c1.5 4 5 6 10 6s9-3 10-6"></path></svg>' },
      { name: 'Database & .db Explorer', desc: 'Inspect SQLite .db files, browse tables, run read-only queries, and export dumps', action: () => DesktopApps.launch('database'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>' },
      { name: 'SSH Session Diagnostics', desc: 'Measure live round-trip latency (RTT), cryptographic ciphers, and transport security', action: () => DesktopApps.launch('ssh_diag'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M12 6v6l4 2"></path></svg>' },
      { name: 'Nginx Virtual Hosts', desc: 'Reverse proxy routing, configuration editor, and Let\'s Encrypt SSL certificates', action: () => DesktopApps.launch('nginx'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M7 16V8l5 8V8M16 8v8"></path></svg>' },
      { name: 'Cloudflare Domains & DNS', desc: 'Connect Cloudflare API, manage zones, DNS records, nameservers, and server links', action: () => DesktopApps.launch('domains'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' },
      { name: 'File Sync (Rsync)', desc: 'Agentless remote directory sync and replication over SSH with dry-run preview', action: () => DesktopApps.launch('sync'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>' },
      { name: 'Cron Job Manager', desc: 'Manage, schedule, and test crontab entries with presets and execution test', action: () => DesktopApps.launch('cron'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' },
      { name: 'Git Deployment', desc: 'Link Git repositories, pull latest code, and configure deployment webhooks', action: () => DesktopApps.launch('git'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"></path></svg>' },
      { name: 'System Settings', desc: 'Manage remote servers, admin password, and desktop appearance', action: () => DesktopApps.launch('settings'), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>' },
      { name: 'Managed Servers', desc: 'Add, edit, test or delete server nodes', action: () => DesktopApps.launch('settings', { tab: 'servers' }), badge: 'App', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>' },
      { name: 'Install ShellMan App (PWA)', desc: 'Download website as standalone desktop operating app', action: () => PwaManager.promptInstall(), badge: 'PWA', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' },
      { name: 'Cascade Windows', desc: 'Neatly arrange all open windows', action: () => WindowManager.cascadeWindows(), badge: 'Action', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="16" height="16" rx="2"></rect><path d="M6 6h16v16H6z"></path></svg>' },
      { name: 'Minimize All', desc: 'Minimize all windows to desktop', action: () => WindowManager.minimizeAll(), badge: 'Action', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>' }
    ];

    const matchedCmds = availableCommands.filter(c => 
      !qLower || c.name.toLowerCase().includes(qLower) || c.desc.toLowerCase().includes(qLower)
    );

    // 2. Servers Search
    const matchedServers = [];
    if (window.DesktopServersList && Array.isArray(window.DesktopServersList)) {
      window.DesktopServersList.forEach(s => {
        if (!qLower || s.name.toLowerCase().includes(qLower) || s.host.toLowerCase().includes(qLower) || (s.username && s.username.toLowerCase().includes(qLower))) {
          matchedServers.push({
            name: s.name,
            desc: `Switch to ${s.username}@${s.host}:${s.port}`,
            action: () => { window.location.href = `/?server_id=${s.id}`; },
            badge: s.id === currentServerId ? 'Active Server' : 'Server',
            icon: `<svg viewBox="0 0 24 24" fill="none" stroke="${s.is_online ? '#34d399' : '#94a3b8'}" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`
          });
        }
      });
    }

    const initialCombined = [...matchedCmds, ...matchedServers];
    this._currentCmds = initialCombined;
    this.renderPaletteHtml(resultsContainer, initialCombined, rawQuery.length >= 2);

    // 3. Debounced Remote Files Search over SFTP
    if (this._fileSearchTimer) clearTimeout(this._fileSearchTimer);

    if (rawQuery.length >= 2 && currentServerId) {
      this._fileSearchTimer = setTimeout(async () => {
        try {
          const resp = await fetch(`/api/servers/${currentServerId}/files/search?q=${encodeURIComponent(rawQuery)}`);
          const data = await resp.json();
          if (data.success && Array.isArray(data.results) && this._activeQuery === rawQuery) {
            const fileCmds = data.results.map(f => ({
              name: f.name,
              desc: `${currentServerName}: ${f.path}`,
              action: () => {
                if (f.is_dir) {
                  DesktopApps.launch('files', { serverId: currentServerId, path: f.path });
                } else {
                  DesktopApps.launch('code', { serverId: currentServerId, path: f.path, isDir: false });
                }
              },
              badge: f.is_dir ? 'Remote Dir' : 'Remote File',
              icon: f.is_dir 
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'
            }));

            this._currentCmds = [...matchedCmds, ...matchedServers, ...fileCmds];
            this.renderPaletteHtml(resultsContainer, this._currentCmds, false);
          }
        } catch (_) {}
      }, 220);
    }
  }

  renderPaletteHtml(container, items, isSearchingFiles) {
    if (items.length === 0 && !isSearchingFiles) {
      container.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.8rem;">No matching apps, servers, or files</div>`;
      return;
    }

    let html = items.map((c, idx) => `
      <div class="cmd-item ${idx === (this._selectedIndex || 0) ? 'selected' : ''}" onclick="DesktopMenus.execCommand(${idx})">
        <span style="display:inline-flex; align-items:center; flex-shrink:0;">${c.icon || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"></polyline></svg>'}</span>
        <div style="min-width:0; overflow:hidden;">
          <div style="font-weight:600; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${this.escapeHtml(c.name)}</div>
          <div style="font-size:0.73rem; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${this.escapeHtml(c.desc)}</div>
        </div>
        <span class="cmd-badge" style="flex-shrink:0;">${this.escapeHtml(c.badge)}</span>
      </div>
    `).join('');

    if (isSearchingFiles) {
      html += `
        <div style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 0.8rem; font-size:0.72rem; color:var(--accent-cyan); border-top:1px solid rgba(255,255,255,0.06);">
          <svg style="width:13px; height:13px; animation:spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
          <span>Searching remote server files for "${this.escapeHtml(this._activeQuery)}"...</span>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  execCommand(index) {
    if (this._currentCmds) {
      const cmd = this._currentCmds[index];
      if (cmd && typeof cmd.action === 'function') {
        this.closeCommandPalette();
        cmd.action();
      }
    }
  }

  execCommand(index) {
    if (this._currentCmds) {
      const cmd = this._currentCmds[index];
      if (cmd && typeof cmd.action === 'function') {
        this.closeCommandPalette();
        cmd.action();
      }
    }
  }
}

const desktopMenusInstance = new DesktopMenusController();
window.DesktopMenusInstance = desktopMenusInstance;
window.DesktopMenus = desktopMenusInstance;
