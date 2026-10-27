/**
 * ShellMan OS: Desktop Applications Module (apps.js)
 * Implements full-featured in-window applications: Terminal, Files, Code, Overview,
 * Processes, Services, Logs, Hardware, Network, and Nodes.
 */

const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
window.escapeHtml = escapeHtml;

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  if (!bytes || isNaN(bytes)) return '-';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
window.formatBytes = formatBytes;

// =========================================================================
// TERMINAL COLOR THEMES
// =========================================================================
const SHELLMAN_TERMINAL_THEMES = {
  shellman: {
    id: 'shellman',
    name: 'ShellMan Cyberpunk (Default)',
    background: '#090d16',
    foreground: '#f8fafc',
    cursor: '#38bdf8',
    cursorAccent: '#090d16',
    selectionBackground: 'rgba(56, 189, 248, 0.3)',
    black: '#1e293b', red: '#f43f5e', green: '#10b981', yellow: '#f59e0b',
    blue: '#38bdf8', magenta: '#d946ef', cyan: '#06b6d4', white: '#f8fafc',
    brightBlack: '#475569', brightRed: '#fb7185', brightGreen: '#34d399', brightYellow: '#fbbf24',
    brightBlue: '#60a5fa', brightMagenta: '#e879f9', brightCyan: '#22d3ee', brightWhite: '#ffffff'
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: 'rgba(68, 71, 90, 0.5)',
    black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c',
    blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
    brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
    brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
  },
  one_dark: {
    id: 'one_dark',
    name: 'One Dark',
    background: '#1e1e1e',
    foreground: '#abb2bf',
    cursor: '#528bff',
    cursorAccent: '#1e1e1e',
    selectionBackground: 'rgba(62, 68, 81, 0.5)',
    black: '#282c34', red: '#e06c75', green: '#98c379', yellow: '#e5c07b',
    blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#abb2bf',
    brightBlack: '#5c6370', brightRed: '#be5046', brightGreen: '#98c379', brightYellow: '#d19a66',
    brightBlue: '#61afef', brightMagenta: '#c678dd', brightCyan: '#56b6c2', brightWhite: '#ffffff'
  },
  nord: {
    id: 'nord',
    name: 'Nord Frost',
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#88c0d0',
    cursorAccent: '#2e3440',
    selectionBackground: 'rgba(136, 192, 208, 0.3)',
    black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
    blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
    brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4'
  },
  tokyo_night: {
    id: 'tokyo_night',
    name: 'Tokyo Night',
    background: '#1a1b26',
    foreground: '#a9b1d6',
    cursor: '#c0caf5',
    cursorAccent: '#1a1b26',
    selectionBackground: 'rgba(122, 162, 247, 0.3)',
    black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
    blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
    brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68',
    brightBlue: '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5'
  },
  catppuccin_mocha: {
    id: 'catppuccin_mocha',
    name: 'Catppuccin Mocha',
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    cursorAccent: '#1e1e2e',
    selectionBackground: 'rgba(203, 166, 247, 0.3)',
    black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
    blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
    brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
    brightBlue: '#89b4fa', brightMagenta: '#f5c2e7', brightCyan: '#94e2d5', brightWhite: '#a6adc8'
  },
  gruvbox_dark: {
    id: 'gruvbox_dark',
    name: 'Gruvbox Dark',
    background: '#282828',
    foreground: '#ebdbb2',
    cursor: '#ebdbb2',
    cursorAccent: '#282828',
    selectionBackground: 'rgba(254, 128, 25, 0.3)',
    black: '#282828', red: '#cc241d', green: '#98971a', yellow: '#d79921',
    blue: '#458588', magenta: '#b16286', cyan: '#689d6a', white: '#a89984',
    brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26', brightYellow: '#fabd2f',
    brightBlue: '#83a598', brightMagenta: '#d3869b', brightCyan: '#8ec07c', brightWhite: '#ebdbb2'
  },
  synthwave_84: {
    id: 'synthwave_84',
    name: "Synthwave '84",
    background: '#262335',
    foreground: '#f92aad',
    cursor: '#ff7edb',
    cursorAccent: '#262335',
    selectionBackground: 'rgba(255, 126, 219, 0.3)',
    black: '#1f1d2b', red: '#fe4450', green: '#72f1b8', yellow: '#fede5d',
    blue: '#03edf9', magenta: '#ff7edb', cyan: '#36f9f6', white: '#ffffff',
    brightBlack: '#614d85', brightRed: '#fe4450', brightGreen: '#72f1b8', brightYellow: '#fede5d',
    brightBlue: '#03edf9', brightMagenta: '#ff7edb', brightCyan: '#36f9f6', brightWhite: '#ffffff'
  },
  solarized_dark: {
    id: 'solarized_dark',
    name: 'Solarized Dark',
    background: '#002b36',
    foreground: '#839496',
    cursor: '#93a1a1',
    cursorAccent: '#002b36',
    selectionBackground: 'rgba(7, 54, 66, 0.6)',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#586e75', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
    brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3'
  },
  solarized_light: {
    id: 'solarized_light',
    name: 'Solarized Light',
    background: '#fdf6e3',
    foreground: '#657b83',
    cursor: '#586e75',
    cursorAccent: '#fdf6e3',
    selectionBackground: 'rgba(7, 54, 66, 0.15)',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#586e75', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
    brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3'
  },
  material_ocean: {
    id: 'material_ocean',
    name: 'Material Ocean',
    background: '#0f111a',
    foreground: '#8f93a2',
    cursor: '#ffcc00',
    cursorAccent: '#0f111a',
    selectionBackground: 'rgba(128, 203, 196, 0.25)',
    black: '#000000', red: '#ff5370', green: '#c3e88d', yellow: '#ffcb6b',
    blue: '#82aaff', magenta: '#c792ea', cyan: '#89ddff', white: '#ffffff',
    brightBlack: '#464b5d', brightRed: '#ff5370', brightGreen: '#c3e88d', brightYellow: '#ffcb6b',
    brightBlue: '#82aaff', brightMagenta: '#c792ea', brightCyan: '#89ddff', brightWhite: '#ffffff'
  },
  cobalt2: {
    id: 'cobalt2',
    name: 'Cobalt2',
    background: '#193549',
    foreground: '#ffffff',
    cursor: '#ffc600',
    cursorAccent: '#193549',
    selectionBackground: 'rgba(0, 136, 255, 0.4)',
    black: '#000000', red: '#ff0055', green: '#38de21', yellow: '#ffe50a',
    blue: '#1478db', magenta: '#ff0055', cyan: '#00c5c7', white: '#c7c7c7',
    brightBlack: '#686868', brightRed: '#f40e17', brightGreen: '#3bd01d', brightYellow: '#edc809',
    brightBlue: '#5555ff', brightMagenta: '#ff55ff', brightCyan: '#6ae3fa', brightWhite: '#feffff'
  },
  github_dark: {
    id: 'github_dark',
    name: 'GitHub Dark',
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    selectionBackground: 'rgba(56, 139, 253, 0.3)',
    black: '#161b22', red: '#ff7b72', green: '#3fb950', yellow: '#d29922',
    blue: '#58a6ff', magenta: '#bc8cff', cyan: '#39c5cf', white: '#b1bac4',
    brightBlack: '#6e7681', brightRed: '#ffa198', brightGreen: '#56d364', brightYellow: '#e3b341',
    brightBlue: '#79c0ff', brightMagenta: '#d2a8ff', brightCyan: '#56d4dd', brightWhite: '#f0f6fc'
  },
  night_owl: {
    id: 'night_owl',
    name: 'Night Owl',
    background: '#011627',
    foreground: '#d6deeb',
    cursor: '#7e57c2',
    cursorAccent: '#011627',
    selectionBackground: 'rgba(95, 126, 151, 0.35)',
    black: '#011627', red: '#ef5350', green: '#22da6e', yellow: '#addb67',
    blue: '#82aaff', magenta: '#c792ea', cyan: '#21c7a8', white: '#ffffff',
    brightBlack: '#575656', brightRed: '#ef5350', brightGreen: '#22da6e', brightYellow: '#ffeb95',
    brightBlue: '#82aaff', brightMagenta: '#c792ea', brightCyan: '#7fdbca', brightWhite: '#ffffff'
  },
  monokai: {
    id: 'monokai',
    name: 'Monokai Pro',
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    cursorAccent: '#272822',
    selectionBackground: 'rgba(73, 72, 62, 0.6)',
    black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#e6db74',
    blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
    brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e', brightYellow: '#e6db74',
    brightBlue: '#66d9ef', brightMagenta: '#ae81ff', brightCyan: '#a1efe4', brightWhite: '#f8f8f2'
  },
  matrix: {
    id: 'matrix',
    name: 'The Matrix Green',
    background: '#080c08',
    foreground: '#00ff66',
    cursor: '#00ff66',
    cursorAccent: '#080c08',
    selectionBackground: 'rgba(0, 255, 102, 0.3)',
    black: '#0d130e', red: '#e04040', green: '#00dd55', yellow: '#88ff00',
    blue: '#00ccaa', magenta: '#00ff66', cyan: '#55ffaa', white: '#aaffcc',
    brightBlack: '#142216', brightRed: '#ff6666', brightGreen: '#00ff66', brightYellow: '#bbff33',
    brightBlue: '#33ffcc', brightMagenta: '#00ff88', brightCyan: '#88ffcc', brightWhite: '#eeffee'
  }
};
window.SHELLMAN_TERMINAL_THEMES = SHELLMAN_TERMINAL_THEMES;
window.TERMINAL_THEMES = SHELLMAN_TERMINAL_THEMES;

function applyShellmanTerminalTheme(themeKey) {
  const theme = SHELLMAN_TERMINAL_THEMES[themeKey] || SHELLMAN_TERMINAL_THEMES.shellman;
  localStorage.setItem('shellman_terminal_theme', themeKey);
  if (window._shellmanTerminals) {
    window._shellmanTerminals.forEach(term => {
      try {
        term.options.theme = theme;
        if (term.element) {
          const container = term.element.closest('.terminal-app-container') || term.element.parentElement;
          if (container) container.style.background = theme.background;
          term.element.style.background = theme.background;
        }
      } catch (_) {}
    });
  }
  document.querySelectorAll('[data-terminal-theme-select]').forEach(sel => {
    sel.value = themeKey;
  });
}
window.applyTerminalTheme = applyShellmanTerminalTheme;

class DesktopAppsController {
  constructor() {
    this.serverId = null;
    this.serverName = '';
    this.serverHost = '';
  }

  init(serverId, serverName, serverHost) {
    this.serverId = serverId;
    this.serverName = serverName || '';
    this.serverHost = serverHost || '';
  }

  launch(appId, params = {}) {
    if (window.DesktopDock && typeof window.DesktopDock.bounce === 'function') {
      window.DesktopDock.bounce(appId);
    }

    if (window.DesktopCustomizer && window.DesktopCustomizer.isViewer && window.DesktopCustomizer.isViewer()
        && !window.DesktopCustomizer.VIEWER_APPS.includes(appId)) {
      if (window.showToast) window.showToast('This is a read-only account. That app is not available.', 'warning');
      return;
    }

    if (!this.serverId && appId !== 'servers' && appId !== 'settings' && appId !== 'fleet' && appId !== 'history') {
      this.launchSettings({ tab: 'servers' });
      return;
    }

    switch (appId) {
      case 'terminal':
        return this.launchTerminal(params);
      case 'files':
        return this.launchFiles(params);
      case 'code':
        return this.launchCode(params);
      case 'overview':
        return this.launchOverview(params);
      case 'processes':
        return this.launchProcesses(params);
      case 'services':
        return this.launchServices(params);
      case 'logs':
        return this.launchLogs(params);
      case 'hardware':
        return this.launchHardware(params);
      case 'network':
        return this.launchNetwork(params);
      case 'nginx':
        return this.launchNginx(params);
      case 'sync':
      case 'rsync':
        return this.launchSync(params);
      case 'fleet':
      case 'history':
        return this.launchFleet(params);
      case 'cron':
        return this.launchCron(params);
      case 'git':
        return this.launchGit(params);
      case 'domains':
        return this.launchDomains(params);
      case 'ssh_diag':
      case 'diagnostics':
        return this.launchSshDiagnostics(params);
      case 'docker':
      case 'containers':
        return this.launchDocker(params);
      case 'database':
      case 'db':
        return this.launchDatabase(params);
      case 'firewall':
      case 'ufw':
        return this.launchFirewall(params);
      case 'servers':
        return this.launchSettings({ tab: 'servers' });
      case 'settings':
        return this.launchSettings(params);
      default:
        console.warn('Unknown app id:', appId);
    }
  }

  // =========================================================================
  // REUSABLE SFTP & LOCAL DIRECTORY PICKER DIALOG
  // =========================================================================
  showDirectoryPicker({ serverId, initialPath, title, isLocal = false, selectFiles = false, fileExtensions = null, onSelect }) {
    const sId = serverId || this.serverId;
    let currentPath = initialPath || (isLocal ? '~/' : '/');
    let selectedPath = currentPath;
    let isFileSelected = !selectFiles;
    const defaultTitle = selectFiles 
      ? (isLocal ? 'Select Local Machine File' : 'Select Server File')
      : (isLocal ? 'Select Local Machine Directory' : 'Select Server Directory');
    const dialogTitle = title || defaultTitle;
    const defaultPlaces = isLocal 
      ? ['~/', '~/Projects', '~/Documents', '~/Downloads', '~/Desktop', '/tmp', '/']
      : ['/', '/home', '/var', '/var/www', '/etc', '/opt', '/tmp'];

    const overlay = document.createElement('div');
    overlay.className = 'desktop-modal-backdrop';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 100000; padding: 1rem; font-family: var(--font-sans); color: var(--text-primary);
    `;

    overlay.innerHTML = `
      <div style="width: 100%; max-width: 660px; height: 530px; background: var(--bg-surface, #111827); border: 1px solid var(--border-color, #1f2937); border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); display: flex; flex-direction: column; overflow: hidden;">
        <!-- Header -->
        <div style="height: 42px; padding: 0 1rem; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02);">
          <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; font-size: 0.88rem; color: #f8fafc;">
            ${selectFiles
              ? '<svg style="width: 16px; height: 16px; color: #10b981;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>'
              : (isLocal
                ? '<svg style="width: 16px; height: 16px; color: var(--sm-accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
                : '<svg style="width: 16px; height: 16px; color: var(--sm-accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>')
            }
            <span>${dialogTitle}</span>
            <span style="font-size: 0.68rem; padding: 0.12rem 0.45rem; border-radius: 3px; font-weight:600; background: ${isLocal ? 'color-mix(in srgb, var(--sm-accent) 15%, transparent); color:var(--sm-accent);' : 'rgba(52,211,153,0.15); color:#34d399;'}">${isLocal ? 'Local Machine' : 'Remote Server'}</span>
            ${fileExtensions && fileExtensions.length ? `<span style="font-size:0.66rem; padding:0.1rem 0.4rem; border-radius:3px; background:rgba(16,185,129,0.15); color:#10b981; font-family:var(--font-mono);">${fileExtensions.join(', ')}</span>` : ''}
          </div>
          <button class="btn btn-secondary btn-xs" id="dpCloseBtn" style="padding: 0.15rem 0.45rem;">&times;</button>
        </div>

        <!-- Navigation Bar -->
        <div style="padding: 0.5rem 0.85rem; border-bottom: 1px solid var(--border-subtle); background: rgba(0,0,0,0.25); display: flex; align-items: center; gap: 0.45rem;">
          <button class="btn btn-secondary btn-xs" id="dpUpBtn" title="Go to Parent Folder" style="display: flex; align-items: center; gap: 3px; padding: 0.25rem 0.55rem;">
            <svg style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"></path></svg>
            Up
          </button>
          <div style="flex: 1; display: flex; align-items: center; background: var(--bg-canvas, #090d16); border: 1px solid var(--border-color, #1f2937); border-radius: 6px; padding: 0.15rem 0.5rem;">
            <svg style="width: 13px; height: 13px; color: #94a3b8; margin-right: 0.4rem; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <input type="text" id="dpPathInput" value="${currentPath}" style="width: 100%; background: transparent; border: none; outline: none; font-family: var(--font-mono); font-size: 0.78rem; color: #f8fafc;">
          </div>
          <button class="btn btn-secondary btn-xs" id="dpGoBtn" style="padding: 0.25rem 0.6rem;">Go</button>
          ${!selectFiles ? `
          <button class="btn btn-secondary btn-xs" id="dpNewFolderBtn" title="Create Folder Here" style="display: flex; align-items: center; gap: 3px; padding: 0.25rem 0.55rem;">
            <svg style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Folder
          </button>` : ''}
        </div>

        <!-- Quick location presets -->
        <div style="padding: 0.35rem 0.85rem; border-bottom: 1px solid var(--border-subtle); display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap; background: rgba(255,255,255,0.015);">
          <span style="font-size: 0.68rem; color: var(--text-muted); margin-right: 0.2rem;">Places:</span>
          ${defaultPlaces.map(p => `
            <button class="btn btn-secondary btn-xs dp-preset-btn" data-path="${p}" style="font-size: 0.68rem; padding: 0.12rem 0.45rem;">${p}</button>
          `).join('')}
        </div>

        <!-- Directory List View -->
        <div id="dpItemsList" style="flex: 1; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 2px;">
          <div style="text-align: center; padding: 3rem; color: var(--text-muted); font-size: 0.8rem;">
            Loading directories...
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 0.65rem 1rem; border-top: 1px solid var(--border-subtle); background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
          <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; color: var(--text-muted);">
            ${selectFiles ? 'Selected File:' : 'Selected Directory:'} <strong id="dpSelectedPathText" style="color: var(--sm-accent); font-family: var(--font-mono);">${selectedPath}</strong>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" id="dpCancelBtn">Cancel</button>
            <button class="btn btn-primary btn-sm" id="dpConfirmBtn" style="font-weight: 600;">${selectFiles ? 'Choose File' : 'Choose Directory'}</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let parentPath = isLocal ? null : '/';
    const listEl = overlay.querySelector('#dpItemsList');
    const pathInp = overlay.querySelector('#dpPathInput');
    const selText = overlay.querySelector('#dpSelectedPathText');
    const closeBtn = overlay.querySelector('#dpCloseBtn');
    const cancelBtn = overlay.querySelector('#dpCancelBtn');
    const confirmBtn = overlay.querySelector('#dpConfirmBtn');
    const upBtn = overlay.querySelector('#dpUpBtn');
    const goBtn = overlay.querySelector('#dpGoBtn');
    const newFolderBtn = overlay.querySelector('#dpNewFolderBtn');

    const closePicker = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    closeBtn.onclick = closePicker;
    cancelBtn.onclick = closePicker;

    confirmBtn.onclick = () => {
      if (selectFiles && !isFileSelected) {
        if (typeof window.showToast === 'function') {
          window.showToast('Please select a file to continue', 'warning');
        }
        return;
      }
      if (typeof onSelect === 'function') {
        onSelect(selectedPath);
      }
      closePicker();
    };

    const loadDirectory = async (dirPath) => {
      dirPath = (dirPath || (isLocal ? '~/' : '/')).trim();
      if (!dirPath) dirPath = isLocal ? '~/' : '/';
      currentPath = dirPath;
      if (!selectFiles) {
        selectedPath = dirPath;
        selText.textContent = selectedPath;
      }
      pathInp.value = currentPath;

      listEl.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted); font-size: 0.8rem;">
          <span class="spinner-border spinner-border-sm" style="width: 12px; height: 12px; margin-right: 6px;"></span>
          Listing files and folders in <code style="color: var(--sm-accent);">${currentPath}</code>...
        </div>
      `;

      try {
        const fetchUrl = isLocal
          ? `/api/sync/local-dirs?path=${encodeURIComponent(currentPath)}`
          : `/api/servers/${sId}/files/list?path=${encodeURIComponent(currentPath)}`;
        const resp = await fetch(fetchUrl);
        const res = await resp.json();
        if (!res.success) {
          listEl.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #f87171; font-size: 0.8rem;">
              Failed to load directory: ${res.error || 'Access denied'}
            </div>
          `;
          return;
        }

        currentPath = res.data.current_path || dirPath;
        parentPath = res.data.parent_path;
        if (!selectFiles) {
          selectedPath = currentPath;
          selText.textContent = selectedPath;
        }
        pathInp.value = currentPath;

        const allItems = res.data.items || [];
        const dirItems = allItems.filter(item => item.is_dir && item.name !== '.' && item.name !== '..');
        const fileItems = selectFiles ? allItems.filter(item => {
          if (item.is_dir) return false;
          if (!fileExtensions || !fileExtensions.length) return true;
          const lower = item.name.toLowerCase();
          return fileExtensions.some(ext => lower.endsWith(ext.toLowerCase()));
        }) : [];

        if (dirItems.length === 0 && fileItems.length === 0) {
          listEl.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.78rem;">
              <svg style="width: 28px; height: 28px; color: #475569; margin: 0 auto 0.5rem; display: block;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              No matching files or subdirectories inside this folder.<br>
              ${!selectFiles ? `Click <strong>"Choose Directory"</strong> below to select <code style="color: var(--sm-accent);">${currentPath}</code>.` : ''}
            </div>
          `;
          return;
        }

        let html = '';

        // Render Subdirectories
        dirItems.forEach(item => {
          html += `
            <div class="dp-folder-row" data-path="${item.path}" data-type="dir" style="display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.75rem; border-radius: 6px; cursor: pointer; transition: background 0.15s; font-size: 0.82rem; user-select: none;">
              <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0;">
                <svg style="width: 16px; height: 16px; color: var(--sm-accent); flex-shrink: 0;" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-1.5V9a3 3 0 0 0-3-3h-3.38a3 3 0 0 1-2.12-.88l-.7-.7A3 3 0 0 0 6.68 3.5H4.5A3 3 0 0 0 1.5 6.5v11.5a3 3 0 0 0 3 3h15z"/></svg>
                <span style="font-weight: 500; color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}/</span>
              </div>
              <span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">${item.permissions || 'directory'}</span>
            </div>
          `;
        });

        // Render Files (when selectFiles is true)
        fileItems.forEach(item => {
          const isDb = item.name.endsWith('.db') || item.name.endsWith('.sqlite') || item.name.endsWith('.sqlite3');
          html += `
            <div class="dp-folder-row dp-file-row" data-path="${item.path}" data-type="file" style="display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.75rem; border-radius: 6px; cursor: pointer; transition: background 0.15s; font-size: 0.82rem; user-select: none; border-left: 2px solid transparent;">
              <div style="display: flex; align-items: center; gap: 0.6rem; min-width: 0;">
                ${isDb
                  ? '<svg style="width: 16px; height: 16px; color: #10b981; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>'
                  : '<svg style="width: 16px; height: 16px; color: #94a3b8; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'
                }
                <span style="font-weight: 500; color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <span style="font-size: 0.7rem; color: var(--sm-accent); font-family: var(--font-mono);">${item.size_human || item.size || ''}</span>
                <span style="font-size: 0.68rem; color: var(--text-muted); font-family: var(--font-mono);">${item.permissions || 'file'}</span>
              </div>
            </div>
          `;
        });

        listEl.innerHTML = html;

        const rows = listEl.querySelectorAll('.dp-folder-row');
        rows.forEach(row => {
          row.onmouseenter = () => { if (!row.classList.contains('active')) row.style.background = 'rgba(255,255,255,0.05)'; };
          row.onmouseleave = () => { if (!row.classList.contains('active')) row.style.background = 'transparent'; };

          row.onclick = () => {
            rows.forEach(r => {
              r.classList.remove('active');
              r.style.background = 'transparent';
              r.style.borderLeftColor = 'transparent';
            });
            row.classList.add('active');
            row.style.background = 'rgba(2, 132, 199, 0.25)';
            row.style.borderLeftColor = '#38bdf8';
            selectedPath = row.dataset.path;
            selText.textContent = selectedPath;
            if (row.dataset.type === 'file') {
              isFileSelected = true;
            } else if (selectFiles) {
              isFileSelected = false;
            }
          };

          row.ondblclick = () => {
            if (row.dataset.type === 'dir') {
              loadDirectory(row.dataset.path);
            } else if (row.dataset.type === 'file') {
              selectedPath = row.dataset.path;
              isFileSelected = true;
              confirmBtn.click();
            }
          };
        });

      } catch (err) {
        listEl.innerHTML = `<div style="text-align: center; padding: 2rem; color: #f87171; font-size: 0.8rem;">Network error: ${err}</div>`;
      }
    };

    upBtn.onclick = () => {
      if (parentPath && parentPath !== currentPath) {
        loadDirectory(parentPath);
      }
    };

    goBtn.onclick = () => {
      loadDirectory(pathInp.value);
    };

    pathInp.onkeydown = (e) => {
      if (e.key === 'Enter') loadDirectory(pathInp.value);
    };

    overlay.querySelectorAll('.dp-preset-btn').forEach(b => {
      b.onclick = () => loadDirectory(b.dataset.path);
    });

    newFolderBtn.onclick = async () => {
      const folderName = await DesktopModal.prompt({
        title: 'Create Folder',
        message: `Create a new folder inside "${currentPath}":`,
        placeholder: 'folder-name'
      });
      if (!folderName || !folderName.trim()) return;
      const cleanName = folderName.trim().replace(/^\/+|\/+$/g, '');
      const newPath = (currentPath.endsWith('/') ? currentPath : currentPath + '/') + cleanName;
      try {
        const createUrl = isLocal
          ? `/api/sync/local-dirs/create`
          : `/api/servers/${sId}/files/create`;
        const createBody = isLocal
          ? { path: newPath }
          : { path: newPath, type: 'dir' };

        const cResp = await fetch(createUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createBody)
        });
        const cRes = await cResp.json();
        if (cRes.success) {
          loadDirectory(newPath);
        } else {
          DesktopModal.alert({ title: 'Folder Creation Failed', message: cRes.error || cRes.message || 'Error creating folder.', type: 'danger' });
        }
      } catch (e) {
        DesktopModal.alert({ title: 'Network Error', message: String(e), type: 'danger' });
      }
    };

    loadDirectory(currentPath);
  }

  // =========================================================================
  // 1. TERMINAL APPLICATION (Multi-Tab PTY SSH)
  // =========================================================================
  get TERMINAL_THEMES() {
    return SHELLMAN_TERMINAL_THEMES;
  }

  static get TERMINAL_THEMES() {
    return SHELLMAN_TERMINAL_THEMES;
  }

  applyTerminalTheme(themeKey) {
    applyShellmanTerminalTheme(themeKey);
  }

  static applyTerminalTheme(themeKey) {
    applyShellmanTerminalTheme(themeKey);
  }
}

window.DesktopAppsController = DesktopAppsController;
window.DesktopApps = new DesktopAppsController();
