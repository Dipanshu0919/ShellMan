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
    const menuWidth = 210;
    const menuHeight = 280;
    const posX = Math.min(window.innerWidth - menuWidth - 10, e.clientX);
    const posY = Math.min(window.innerHeight - menuHeight - 10, e.clientY);

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
      this.renderCommandResults('');
      input.focus();
    }
  }

  closeCommandPalette() {
    if (this.cmdPaletteEl) this.cmdPaletteEl.style.display = 'none';
  }

  renderCommandResults(query) {
    query = (query || '').toLowerCase().trim();
    const resultsContainer = this.cmdPaletteEl.querySelector('#cmdResults');
    if (!resultsContainer) return;

    const availableCommands = [
      { name: 'Terminal', desc: 'Open interactive SSH shell', action: () => DesktopApps.launch('terminal'), badge: 'App' },
      { name: 'File Manager', desc: 'Browse, edit, and upload SFTP files', action: () => DesktopApps.launch('files'), badge: 'App' },
      { name: 'Code Workspace', desc: 'Open Monaco remote IDE', action: () => DesktopApps.launch('code'), badge: 'App' },
      { name: 'System Overview', desc: 'View live node telemetry & dials', action: () => DesktopApps.launch('overview'), badge: 'App' },
      { name: 'Task Manager', desc: 'Manage Linux processes & signals', action: () => DesktopApps.launch('processes'), badge: 'App' },
      { name: 'Systemd Services', desc: 'Start, stop, and restart units', action: () => DesktopApps.launch('services'), badge: 'App' },
      { name: 'System Logs', desc: 'Stream journalctl entries', action: () => DesktopApps.launch('logs'), badge: 'App' },
      { name: 'Hardware Specs', desc: 'View CPU architecture & interfaces', action: () => DesktopApps.launch('hardware'), badge: 'App' },
      { name: 'Network & Sockets', desc: 'Inspect listening ports', action: () => DesktopApps.launch('network'), badge: 'App' },
      { name: 'System Settings', desc: 'Manage remote servers, admin password, and desktop appearance', action: () => DesktopApps.launch('settings'), badge: 'App' },
      { name: 'Managed Servers', desc: 'Add, edit, test or delete server nodes', action: () => DesktopApps.launch('settings', { tab: 'servers' }), badge: 'App' },
      { name: 'Install ShellMan App (PWA)', desc: 'Download website as standalone desktop operating app', action: () => PwaManager.promptInstall(), badge: 'PWA' },
      { name: 'Cascade Windows', desc: 'Neatly arrange all open windows', action: () => WindowManager.cascadeWindows(), badge: 'Action' },
      { name: 'Minimize All', desc: 'Minimize all windows to desktop', action: () => WindowManager.minimizeAll(), badge: 'Action' }
    ];

    const matched = availableCommands.filter(c => 
      !query || c.name.toLowerCase().includes(query) || c.desc.toLowerCase().includes(query)
    );

    if (matched.length === 0) {
      resultsContainer.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.8rem;">No matching commands</div>`;
      return;
    }

    resultsContainer.innerHTML = matched.map((c, idx) => `
      <div class="cmd-item ${idx === 0 ? 'selected' : ''}" onclick="DesktopMenus.execCommand(${idx})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"></polyline></svg>
        <div>
          <div style="font-weight:600;color:var(--text-primary);">${c.name}</div>
          <div style="font-size:0.74rem;color:var(--text-muted);">${c.desc}</div>
        </div>
        <span class="cmd-badge">${c.badge}</span>
      </div>
    `).join('');

    this._currentCmds = matched;
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
