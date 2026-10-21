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
    if (!this.serverId && appId !== 'servers' && appId !== 'settings') {
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
      case 'servers':
        return this.launchSettings({ tab: 'servers' });
      case 'settings':
        return this.launchSettings(params);
      default:
        console.warn('Unknown app id:', appId);
    }
  }

  // =========================================================================
  // 1. TERMINAL APPLICATION (Multi-Tab PTY SSH)
  // =========================================================================
  launchTerminal(params = {}) {
    if (!params.newWindow && !params.path && !params.cwd) {
      const existing = WindowManager.getWindowByAppId('terminal');
      if (existing) {
        if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
        WindowManager.focusWindow(existing.id);
        return existing;
      }
    }

    const termWinId = 'term_' + Date.now();
    const initialPath = params.path || params.cwd || '';
    const folderName = initialPath ? (initialPath.split('/').filter(Boolean).pop() || initialPath) : '';
    const title = params.title || (initialPath ? `Terminal: ${folderName}` : 'Terminal');

    return WindowManager.createWindow({
      appId: 'terminal',
      multiInstance: true,
      title: `${title} - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="#0f172a"/><polyline points="5 17 11 11 5 5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="13" y1="19" x2="19" stroke="#00f2fe" stroke-width="2" stroke-linecap="round"/></svg>',
      width: 840,
      height: 520,
      minWidth: 420,
      minHeight: 260,
      contentHtml: `
        <div class="terminal-app-container" style="height:100%; display:flex; flex-direction:column; background:#090d16;">
          <div class="terminal-toolbar" style="height:36px; background:#0f172a; border-bottom:1px solid #1e293b; display:flex; align-items:center; justify-content:space-between; padding:0 0.65rem;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span class="status-dot connected" id="dot_${termWinId}"></span>
              <span style="font-family:var(--font-mono); font-size:0.74rem; color:var(--text-secondary);" id="status_${termWinId}">PTY Active</span>
              ${initialPath ? `<span style="font-family:var(--font-mono); font-size:0.7rem; color:#38bdf8; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.2); padding:1px 6px; border-radius:3px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(initialPath)}">${escapeHtml(folderName || initialPath)}</span>` : ''}
              <span style="color:var(--text-muted); font-size:0.7rem; font-family:var(--font-mono); margin-left:0.3rem;" id="dim_${termWinId}">80x24</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.3rem;">
              <button class="btn btn-ghost btn-sm" id="newWin_${termWinId}" title="Open New Terminal Window">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                New
              </button>
              <button class="btn btn-ghost btn-sm" id="copy_${termWinId}" title="Copy Terminal Buffer">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy
              </button>
              <button class="btn btn-ghost btn-sm" id="clear_${termWinId}" title="Clear Screen">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                Clear
              </button>
              <button class="btn btn-ghost btn-sm" id="reconnect_${termWinId}" title="Reconnect Session">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Reconnect
              </button>
            </div>
          </div>
          <div id="screen_${termWinId}" style="flex:1; width:100%; height:100%; overflow:hidden; padding:4px; box-sizing:border-box;"></div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const screenEl = bodyEl.querySelector(`#screen_${termWinId}`);
        const statusEl = bodyEl.querySelector(`#status_${termWinId}`);
        const dotEl = bodyEl.querySelector(`#dot_${termWinId}`);
        const dimEl = bodyEl.querySelector(`#dim_${termWinId}`);

        const baseFontPx = parseFloat(localStorage.getItem('shellman_font_size') || '16');
        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'bar',
          fontSize: Math.max(10, Math.round(14 * (baseFontPx / 16))),
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          theme: {
            background: '#090d16',
            foreground: '#f8fafc',
            cursor: '#38bdf8',
            selectionBackground: 'rgba(56, 189, 248, 0.3)',
            black: '#1e293b', red: '#f43f5e', green: '#10b981', yellow: '#f59e0b',
            blue: '#3b82f6', magenta: '#d946ef', cyan: '#06b6d4', white: '#f8fafc'
          },
          allowProposedApi: true,
          scrollback: 5000,
          macOptionIsMeta: true
        });

        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term._fitAddon = fitAddon;
        window._shellmanTerminals = window._shellmanTerminals || new Set();
        window._shellmanTerminals.add(term);
        if (window.WebLinksAddon) term.loadAddon(new WebLinksAddon.WebLinksAddon());

        term.open(screenEl);

        let socket = null;

        const connectWS = () => {
          dotEl.className = 'status-dot';
          statusEl.textContent = 'Connecting...';
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          let url = `${protocol}//${window.location.host}/ws/terminal/${this.serverId}?cols=${term.cols || 80}&rows=${term.rows || 24}`;
          if (initialPath) {
            url += `&cwd=${encodeURIComponent(initialPath)}&path=${encodeURIComponent(initialPath)}`;
          }

          socket = new WebSocket(url);

          socket.onopen = () => {
            dotEl.className = 'status-dot connected';
            statusEl.textContent = 'PTY Active';
            sendResize();
            term.focus();
          };

          socket.onmessage = (evt) => {
            try {
              const msg = JSON.parse(evt.data);
              if (msg.type === 'data') term.write(msg.data);
              else if (msg.type === 'closed') {
                term.write(msg.data || '\r\n[Session Disconnected]\r\n');
                dotEl.className = 'status-dot disconnected';
                statusEl.textContent = 'Closed';
              }
            } catch (_) {
              term.write(evt.data);
            }
          };

          socket.onclose = () => {
            dotEl.className = 'status-dot disconnected';
            statusEl.textContent = 'Disconnected';
          };
          socket.onerror = () => {
            dotEl.className = 'status-dot disconnected';
            statusEl.textContent = 'Error';
          };
        };

        const sendResize = () => {
          if (!term) return;
          const cols = term.cols;
          const rows = term.rows;
          if (dimEl) dimEl.textContent = `${cols}x${rows}`;
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        };

        // Keyboard handler: traps Ctrl+C, Ctrl+V, Ctrl+S, Ctrl+D, Ctrl+Z, Ctrl+K
        term.attachCustomKeyEventHandler((e) => {
          if (e.ctrlKey && e.key.toLowerCase() === 'c' && term.hasSelection()) return true;
          if ((e.ctrlKey && e.key.toLowerCase() === 'v') || (e.shiftKey && e.key === 'Insert')) return true;
          if (e.ctrlKey && !e.altKey) {
            const key = e.key.toLowerCase();
            if (['s', 'w', 'o', 'f', 'p', 'd', 'j', 'k', 'r', 'n', 't', 'g', 'h'].includes(key)) {
              if (e.type === 'keydown') {
                e.preventDefault();
                e.stopPropagation();
                const code = key.charCodeAt(0) - 96;
                if (socket && socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({ type: 'input', data: String.fromCharCode(code) }));
                }
              }
              return false;
            }
          }
          return true;
        });

        term.onData((data) => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'input', data: data }));
          }
        });

        // Controls
        const newWinBtn = bodyEl.querySelector(`#newWin_${termWinId}`);
        if (newWinBtn) newWinBtn.onclick = () => DesktopApps.launch('terminal', { newWindow: true });
        bodyEl.querySelector(`#clear_${termWinId}`).onclick = () => term.clear();
        bodyEl.querySelector(`#copy_${termWinId}`).onclick = () => {
          const buffer = term.buffer.active;
          const lines = [];
          for (let i = 0; i < buffer.length; i++) lines.push(buffer.getLine(i).translateToString(true));
          navigator.clipboard.writeText(lines.join('\n')).then(() => {
            if (window.showToast) window.showToast('Terminal buffer copied', 'success');
          });
        };
        bodyEl.querySelector(`#reconnect_${termWinId}`).onclick = () => {
          if (socket) socket.close();
          term.reset();
          connectWS();
        };

        connectWS();

        setTimeout(() => {
          try { fitAddon.fit(); sendResize(); } catch (_) {}
        }, 120);

        winObj.onResize = () => {
          try { fitAddon.fit(); sendResize(); } catch (_) {}
        };

        winObj.onClose = () => {
          if (window._shellmanTerminals) window._shellmanTerminals.delete(term);
          if (socket) socket.close();
          term.dispose();
        };
      }
    });
  }

  // =========================================================================
  // 2. FILES APPLICATION (SFTP File Manager)
  // =========================================================================
  launchFiles(params = {}) {
    if (!params.path) {
      const existing = WindowManager.getWindowByAppId('files');
      if (existing) {
        if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
        WindowManager.focusWindow(existing.id);
        return existing;
      }
    }

    const fileWinId = 'files_' + Date.now();
    const initialDir = params.path || '/';

    return WindowManager.createWindow({
      appId: 'files',
      multiInstance: false,
      title: `File Manager - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="#0f172a"/><path d="M4 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" fill="#0ea5e9" opacity="0.3" stroke="#38bdf8" stroke-width="1.8"/><path d="M4 11h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z" fill="#0284c7" opacity="0.4"/></svg>',
      width: 960,
      height: 600,
      minWidth: 540,
      minHeight: 340,
      contentHtml: `
        <div class="files-app-container" id="fapp_${fileWinId}" style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); position:relative; overflow:hidden;">
          <!-- Top Navigation & Action Toolbar -->
          <header class="files-toolbar" style="height:40px; background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; padding:0 0.65rem; gap:0.5rem; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.3rem; flex:1; min-width:0;">
              <!-- History & Navigation -->
              <button class="btn btn-ghost btn-sm" id="backBtn_${fileWinId}" title="Back (Alt+Left)"><svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg></button>
              <button class="btn btn-ghost btn-sm" id="fwdBtn_${fileWinId}" title="Forward (Alt+Right)"><svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></button>
              <button class="btn btn-ghost btn-sm" id="upBtn_${fileWinId}" title="Up"><svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></button>
              <button class="btn btn-ghost btn-sm" id="refreshBtn_${fileWinId}" title="Refresh"><svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg></button>

              <!-- Breadcrumb / Editable Address Bar -->
              <div class="files-address-bar" id="addressWrap_${fileWinId}" style="display:flex; align-items:center; background:var(--bg-system); border:1px solid var(--border-subtle); border-radius:var(--radius-xs); padding:0.18rem 0.5rem; flex:1; max-width:440px; cursor:text; overflow:hidden;">
                <svg style="width:12px;height:12px;color:var(--text-muted);margin-right:0.35rem;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                <div class="breadcrumb" id="bc_${fileWinId}" style="flex:1; overflow-x:auto; white-space:nowrap; margin-bottom:0; font-size:0.75rem; scrollbar-width:none;">/</div>
                <input type="text" id="pathInput_${fileWinId}" class="form-control" style="display:none; flex:1; padding:0; height:18px; font-size:0.75rem; font-family:var(--font-mono); background:transparent; border:none; color:var(--text-primary); outline:none;" placeholder="/path/to/directory">
                <button class="btn btn-ghost btn-xs" id="editPathBtn_${fileWinId}" title="Edit Path" style="padding:0 3px; margin-left:4px;"><svg style="width:10px;height:10px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="14 2 18 6 7 17 3 17 3 13 14 2"></polygon></svg></button>
              </div>
            </div>

            <!-- Toolbar Actions & View Toggle -->
            <div style="display:flex; align-items:center; gap:0.35rem;">
              <input type="text" id="search_${fileWinId}" placeholder="Filter files..." class="form-control" style="width:115px; padding:0.2rem 0.4rem; font-size:0.73rem;">
              
              <button class="btn btn-ghost btn-sm" id="hiddenBtn_${fileWinId}" title="Toggle Hidden Files (.*)">.*</button>
              
              <!-- View Mode Toggle: List vs Grid -->
              <div style="display:inline-flex; border:1px solid var(--border-subtle); border-radius:var(--radius-xs); overflow:hidden;">
                <button class="btn btn-ghost btn-xs active" id="viewListBtn_${fileWinId}" title="List View" style="padding:4px 6px; border-radius:0;"><svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg></button>
                <button class="btn btn-ghost btn-xs" id="viewGridBtn_${fileWinId}" title="Grid View" style="padding:4px 6px; border-radius:0;"><svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></button>
              </div>

              <!-- Primary File Actions -->
              <button class="btn btn-primary btn-sm" id="uploadBtn_${fileWinId}" title="Upload Files">
                <svg style="width:12px;height:12px;margin-right:2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Upload File
              </button>
              <input type="file" id="fileInput_${fileWinId}" multiple style="display:none;">

              <button class="btn btn-secondary btn-sm" id="uploadFolderBtn_${fileWinId}" title="Upload Entire Folder from Laptop">
                <svg style="width:12px;height:12px;margin-right:2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><polyline points="12 11 12 17"></polyline><polyline points="9 14 12 11 15 14"></polyline></svg>
                Upload Folder
              </button>
              <input type="file" id="folderInput_${fileWinId}" webkitdirectory directory multiple style="display:none;">
              
              <button class="btn btn-secondary btn-sm" id="newFileBtn_${fileWinId}">+ File</button>
              <button class="btn btn-secondary btn-sm" id="newDirBtn_${fileWinId}">+ Folder</button>
              <button class="btn btn-secondary btn-sm" id="copyBtn_${fileWinId}" title="Copy Selected Items">
                <svg style="width:12px;height:12px;margin-right:2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy
              </button>
              <button class="btn btn-secondary btn-sm" id="moveBtn_${fileWinId}" title="Move Selected Items">
                <svg style="width:12px;height:12px;margin-right:2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                Move
              </button>
              <button class="btn btn-secondary btn-sm active" id="togglePropsBtn_${fileWinId}" title="Toggle Properties Panel" style="display:inline-flex; align-items:center; gap:0.35rem;">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <span>Properties</span>
              </button>
            </div>
          </header>

          <!-- Split Body: Places Sidebar + File Viewport + Properties Panel -->
          <div id="splitBody_${fileWinId}" style="display:flex; flex:1; overflow:hidden; position:relative;">
            <!-- Places Sidebar -->
            <aside class="files-places-sidebar" style="width:170px; background:var(--bg-surface); border-right:1px solid var(--border-subtle); display:flex; flex-direction:column; overflow-y:auto; flex-shrink:0;">
              <div class="places-section" style="padding:0.5rem 0.4rem;">
                <div class="places-title" style="font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); padding:0.25rem 0.5rem;">Favorites</div>
                <div class="places-item" data-path="~" style="display:flex; align-items:center; gap:0.45rem; padding:0.35rem 0.5rem; font-size:0.75rem; border-radius:var(--radius-xs); cursor:pointer; color:var(--text-secondary);"><svg style="width:13px;height:13px;color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>Home (~)</div>
                <div class="places-item" data-path="/" style="display:flex; align-items:center; gap:0.45rem; padding:0.35rem 0.5rem; font-size:0.75rem; border-radius:var(--radius-xs); cursor:pointer; color:var(--text-secondary);"><svg style="width:13px;height:13px;color:#94a3b8;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>Root (/)</div>
                <div class="places-item" data-path="/var/www" style="display:flex; align-items:center; gap:0.45rem; padding:0.35rem 0.5rem; font-size:0.75rem; border-radius:var(--radius-xs); cursor:pointer; color:var(--text-secondary);"><svg style="width:13px;height:13px;color:#10b981;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>Web (/var/www)</div>
                <div class="places-item" data-path="/etc" style="display:flex; align-items:center; gap:0.45rem; padding:0.35rem 0.5rem; font-size:0.75rem; border-radius:var(--radius-xs); cursor:pointer; color:var(--text-secondary);"><svg style="width:13px;height:13px;color:#f59e0b;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path></svg>Config (/etc)</div>
                <div class="places-item" data-path="/var/log" style="display:flex; align-items:center; gap:0.45rem; padding:0.35rem 0.5rem; font-size:0.75rem; border-radius:var(--radius-xs); cursor:pointer; color:var(--text-secondary);"><svg style="width:13px;height:13px;color:#a855f7;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg>Logs (/var/log)</div>
                <div class="places-item" data-path="/opt" style="display:flex; align-items:center; gap:0.45rem; padding:0.35rem 0.5rem; font-size:0.75rem; border-radius:var(--radius-xs); cursor:pointer; color:var(--text-secondary);"><svg style="width:13px;height:13px;color:#ec4899;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>Opt (/opt)</div>
                <div class="places-item" data-path="/tmp" style="display:flex; align-items:center; gap:0.45rem; padding:0.35rem 0.5rem; font-size:0.75rem; border-radius:var(--radius-xs); cursor:pointer; color:var(--text-secondary);"><svg style="width:13px;height:13px;color:#64748b;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>Temp (/tmp)</div>
              </div>
            </aside>

            <!-- Main File Viewport (List + Grid Container) -->
            <div class="files-viewport" id="vp_${fileWinId}" style="flex:1; overflow-y:auto; position:relative; background:var(--bg-canvas);">
              <!-- Drag and drop overlay -->
              <div id="dropOverlay_${fileWinId}" style="display:none; position:absolute; inset:0; background:rgba(14, 165, 233, 0.16); border:2px dashed #0284c7; z-index:40; align-items:center; justify-content:center; backdrop-filter:blur(3px); pointer-events:none;">
                <div style="background:var(--bg-surface); padding:1rem 2rem; border-radius:var(--radius-md); border:1px solid var(--border-active); font-weight:600; color:#38bdf8; display:flex; align-items:center; gap:0.6rem; box-shadow:0 12px 32px rgba(0,0,0,0.6);">
                  <svg style="width:22px;height:22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span id="dropOverlayText_${fileWinId}">Drop files or folders to upload here</span>
                </div>
              </div>

              <!-- List View Table -->
              <div id="listView_${fileWinId}" style="width:100%;">
                <table class="table" style="width:100%; border-collapse:collapse;">
                  <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:10; border-bottom:1px solid var(--border-subtle);">
                    <tr>
                      <th style="width:36px; text-align:center;"><input type="checkbox" id="selectAll_${fileWinId}"></th>
                      <th>Name</th>
                      <th style="width:120px;">Size</th>
                      <th style="width:170px;">Modified</th>
                    </tr>
                  </thead>
                  <tbody id="tb_${fileWinId}">
                    <tr><td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading remote files...</td></tr>
                  </tbody>
                </table>
              </div>

              <!-- Grid View Container -->
              <div id="gridView_${fileWinId}" style="display:none; padding:0.75rem; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:0.65rem;"></div>
            </div>

            <!-- Properties Resizer Handle -->
            <div class="files-props-resizer" id="propsResizer_${fileWinId}" title="Drag to resize properties panel (Double-click to reset)"></div>

            <!-- Properties Panel (Right-Side Drawer) -->
            <aside class="files-props-panel" id="propsPanel_${fileWinId}">
              <div id="propsContent_${fileWinId}" style="padding:0.9rem; display:flex; flex-direction:column; gap:0.9rem;">
                <!-- Populated dynamically when selecting an item -->
              </div>
            </aside>

            <!-- Multi-Selection Floating Action Bar -->
            <div id="actionBar_${fileWinId}" style="display:none; position:absolute; bottom:14px; left:50%; transform:translateX(-50%); background:rgba(14, 18, 28, 0.96); border:1px solid rgba(255, 255, 255, 0.16); box-shadow:0 12px 36px rgba(0,0,0,0.75); border-radius:var(--radius-md); padding:0.4rem 0.9rem; z-index:50; align-items:center; gap:0.55rem; backdrop-filter:blur(16px);">
              <span id="actionCount_${fileWinId}" style="font-size:0.75rem; font-weight:600; color:#f1f5f9;">0 selected</span>
              <div style="width:1px; height:16px; background:rgba(255,255,255,0.12);"></div>
              <button class="btn btn-secondary btn-sm" id="batchCopyBtn_${fileWinId}" title="Copy Selected Items">
                <svg style="width:12px;height:12px;margin-right:2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                Copy
              </button>
              <button class="btn btn-secondary btn-sm" id="batchMoveBtn_${fileWinId}" title="Move Selected Items">
                <svg style="width:12px;height:12px;margin-right:2px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                Move
              </button>
              <button class="btn btn-secondary btn-sm" id="batchCodeBtn_${fileWinId}" title="Open Selected in Code Workspace">
                <svg style="width:12px;height:12px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                Open in Code
              </button>
              <button class="btn btn-danger btn-sm" id="batchDeleteBtn_${fileWinId}" title="Delete Selected">
                <svg style="width:12px;height:12px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                Delete
              </button>
              <button class="btn btn-secondary btn-sm" id="batchExtractBtn_${fileWinId}" style="display:none;" title="Extract Archive">
                <svg style="width:12px;height:12px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline></svg>
                Extract Here
              </button>
              <button class="btn btn-ghost btn-xs" id="clearSelectBtn_${fileWinId}" title="Deselect All" style="color:var(--text-muted);">Clear</button>
            </div>
          </div>

          <!-- Bottom Status Bar & Progress Indicator -->
          <footer class="files-statusbar" style="height:26px; background:var(--bg-surface); border-top:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; padding:0 0.75rem; font-size:0.72rem; color:var(--text-muted); flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <span id="stCount_${fileWinId}">0 items</span>
              <span id="stSelected_${fileWinId}" style="color:var(--accent-primary); display:none;">0 selected</span>
            </div>
            <div id="uploadProgressBox_${fileWinId}" style="display:none; align-items:center; gap:0.5rem;">
              <span id="uploadStatusText_${fileWinId}" style="font-family:var(--font-mono); color:#38bdf8;">Uploading...</span>
              <div style="width:100px; height:6px; background:#1e293b; border-radius:3px; overflow:hidden;">
                <div id="uploadProgressBar_${fileWinId}" style="width:0%; height:100%; background:#0284c7; transition:width 0.2s;"></div>
              </div>
            </div>
            <span id="stPath_${fileWinId}" style="font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; max-width:320px; white-space:nowrap;">/</span>
          </footer>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        let currentPath = initialDir;
        let parentPath = null;
        let items = [];
        let showHidden = false;
        let viewMode = 'list'; // 'list' or 'grid'
        let selectedPaths = new Set();
        let historyBack = [];
        let historyFwd = [];
        let isPropsOpen = true;

        const getTypeDescription = (item) => {
          if (item.is_dir) return 'Folder';
          const name = item.name.toLowerCase();
          const ext = (name.split('.').pop() || '').toLowerCase();
          if (name.endsWith('.tar.gz') || ext === 'tgz') return 'Gzip Tarball';
          if (ext === 'zip') return 'ZIP Archive';
          if (['tar', 'gz', 'bz2', 'xz', 'rar', '7z'].includes(ext)) return 'Archive File';
          if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return `${ext.toUpperCase()} Image`;
          if (['js', 'jsx'].includes(ext)) return 'JavaScript File';
          if (['ts', 'tsx'].includes(ext)) return 'TypeScript File';
          if (ext === 'py') return 'Python Script';
          if (['sh', 'bash', 'zsh'].includes(ext)) return 'Shell Script';
          if (ext === 'json') return 'JSON Document';
          if (['yaml', 'yml'].includes(ext)) return 'YAML Configuration';
          if (ext === 'html') return 'HTML Document';
          if (ext === 'css') return 'CSS Stylesheet';
          if (ext === 'md') return 'Markdown Document';
          if (ext === 'txt') return 'Plain Text File';
          if (ext === 'log') return 'Log File';
          if (['conf', 'cfg', 'ini', 'service', 'env'].includes(ext)) return 'Configuration File';
          if (ext) return `${ext.toUpperCase()} File`;
          return 'File';
        };

        const tbody = bodyEl.querySelector(`#tb_${fileWinId}`);
        const gridView = bodyEl.querySelector(`#gridView_${fileWinId}`);
        const listView = bodyEl.querySelector(`#listView_${fileWinId}`);
        const bc = bodyEl.querySelector(`#bc_${fileWinId}`);
        const pathInput = bodyEl.querySelector(`#pathInput_${fileWinId}`);
        const addressWrap = bodyEl.querySelector(`#addressWrap_${fileWinId}`);
        const editPathBtn = bodyEl.querySelector(`#editPathBtn_${fileWinId}`);
        const stCount = bodyEl.querySelector(`#stCount_${fileWinId}`);
        const stSelected = bodyEl.querySelector(`#stSelected_${fileWinId}`);
        const stPath = bodyEl.querySelector(`#stPath_${fileWinId}`);
        const selectAllCb = bodyEl.querySelector(`#selectAll_${fileWinId}`);
        const actionBar = bodyEl.querySelector(`#actionBar_${fileWinId}`);
        const actionCount = bodyEl.querySelector(`#actionCount_${fileWinId}`);
        const batchExtractBtn = bodyEl.querySelector(`#batchExtractBtn_${fileWinId}`);
        const dropOverlay = bodyEl.querySelector(`#dropOverlay_${fileWinId}`);
        const dropOverlayText = bodyEl.querySelector(`#dropOverlayText_${fileWinId}`);
        const fileInput = bodyEl.querySelector(`#fileInput_${fileWinId}`);
        const folderInput = bodyEl.querySelector(`#folderInput_${fileWinId}`);
        const uploadFolderBtn = bodyEl.querySelector(`#uploadFolderBtn_${fileWinId}`);
        const splitBody = bodyEl.querySelector(`#splitBody_${fileWinId}`);
        const propsResizer = bodyEl.querySelector(`#propsResizer_${fileWinId}`);
        const propsPanel = bodyEl.querySelector(`#propsPanel_${fileWinId}`);
        const propsContent = bodyEl.querySelector(`#propsContent_${fileWinId}`);
        const togglePropsBtn = bodyEl.querySelector(`#togglePropsBtn_${fileWinId}`);

        if (togglePropsBtn) {
          togglePropsBtn.onclick = () => {
            isPropsOpen = !isPropsOpen;
            if (propsPanel) propsPanel.style.display = isPropsOpen ? 'flex' : 'none';
            if (propsResizer) propsResizer.style.display = isPropsOpen ? 'block' : 'none';
            togglePropsBtn.classList.toggle('active', isPropsOpen);
          };
        }

        // Properties panel width persistence & interactive drag resize
        const PROPS_WIDTH_STORAGE_KEY = 'shellman_files_props_width';
        const DEFAULT_PROPS_WIDTH = 285;
        const MIN_PROPS_WIDTH = 220;
        const MAX_PROPS_WIDTH = 750;

        const restorePropsWidth = () => {
          if (!propsPanel) return;
          const savedWidth = parseInt(localStorage.getItem(PROPS_WIDTH_STORAGE_KEY), 10);
          if (savedWidth && !isNaN(savedWidth) && savedWidth >= MIN_PROPS_WIDTH && savedWidth <= MAX_PROPS_WIDTH) {
            propsPanel.style.width = savedWidth + 'px';
          }
        };

        restorePropsWidth();

        if (propsResizer && propsPanel) {
          let isResizing = false;
          let startX = 0;
          let startW = 0;

          const onPointerMove = (e) => {
            if (!isResizing) return;
            const deltaX = startX - e.clientX; // Dragging left expands right-side panel
            const availableSpace = splitBody ? splitBody.offsetWidth - 220 : window.innerWidth - 300;
            const maxClamp = Math.min(MAX_PROPS_WIDTH, Math.max(MIN_PROPS_WIDTH, availableSpace));
            const newW = Math.max(MIN_PROPS_WIDTH, Math.min(maxClamp, Math.round(startW + deltaX)));
            propsPanel.style.width = newW + 'px';
          };

          const onPointerUp = (e) => {
            if (!isResizing) return;
            isResizing = false;
            propsResizer.classList.remove('is-resizing');
            if (e && e.pointerId) {
              try { propsResizer.releasePointerCapture(e.pointerId); } catch (_) {}
            }
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            const currentW = Math.round(propsPanel.getBoundingClientRect().width);
            if (currentW >= MIN_PROPS_WIDTH && currentW <= MAX_PROPS_WIDTH) {
              localStorage.setItem(PROPS_WIDTH_STORAGE_KEY, currentW.toString());
            }
          };

          propsResizer.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startW = propsPanel.getBoundingClientRect().width;
            propsResizer.classList.add('is-resizing');
            try { propsResizer.setPointerCapture(e.pointerId); } catch (_) {}
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerUp);
          });

          // Double click on splitter resets to default width (285px)
          propsResizer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            propsPanel.style.width = DEFAULT_PROPS_WIDTH + 'px';
            localStorage.setItem(PROPS_WIDTH_STORAGE_KEY, DEFAULT_PROPS_WIDTH.toString());
          });
        }

        // Two-tone icon generator based on file extension
        const renderItemIcon = (item, size = 18) => {
          if (item.is_dir) {
            return `<svg style="width:${size}px;height:${size}px;flex-shrink:0;" viewBox="0 0 24 24" fill="none"><path d="M3 6a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v2H3V6z" fill="#f59e0b" fill-opacity="0.35" stroke="#f59e0b" stroke-width="1.5"/><path d="M2.5 10h19l-1.5 9a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2l-1.5-9z" fill="#f59e0b" fill-opacity="0.9" stroke="#fbbf24" stroke-width="1.5"/></svg>`;
          }
          const ext = (item.name.split('.').pop() || '').toLowerCase();
          if (['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'rar', '7z'].includes(ext) || item.name.endsWith('.tar.gz')) {
            return `<svg style="width:${size}px;height:${size}px;flex-shrink:0;" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" fill="#e11d48" opacity="0.2" stroke="#f43f5e" stroke-width="1.8"/><circle cx="12" cy="11" r="2" fill="#fb7185"/><line x1="12" y1="2" x2="12" y2="8" stroke="#f43f5e" stroke-width="1.8" stroke-dasharray="2 1"/></svg>`;
          }
          if (['js', 'ts', 'jsx', 'tsx', 'py', 'sh', 'bash', 'json', 'yaml', 'yml', 'html', 'css', 'php', 'rb', 'go', 'rs', 'c', 'cpp', 'sql', 'env'].includes(ext)) {
            return `<svg style="width:${size}px;height:${size}px;flex-shrink:0;" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" fill="#4f46e5" opacity="0.25" stroke="#818cf8" stroke-width="1.8"/><polyline points="9 10 7 12 9 14" stroke="#a5b4fc" stroke-width="1.8" stroke-linecap="round"/><polyline points="15 10 17 12 15 14" stroke="#a5b4fc" stroke-width="1.8" stroke-linecap="round"/></svg>`;
          }
          if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
            return `<svg style="width:${size}px;height:${size}px;flex-shrink:0;" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" fill="#059669" opacity="0.25" stroke="#10b981" stroke-width="1.8"/><circle cx="9" cy="9" r="1.5" fill="#34d399"/><polyline points="5 17 10 12 14 16 17 13 19 15" stroke="#34d399" stroke-width="1.5"/></svg>`;
          }
          if (['md', 'txt', 'log', 'conf', 'cfg', 'ini', 'service', 'cnf'].includes(ext)) {
            return `<svg style="width:${size}px;height:${size}px;flex-shrink:0;" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" fill="#475569" opacity="0.25" stroke="#94a3b8" stroke-width="1.8"/><line x1="8" y1="8" x2="16" y2="8" stroke="#cbd5e1" stroke-width="1.5"/><line x1="8" y1="12" x2="16" y2="12" stroke="#cbd5e1" stroke-width="1.5"/><line x1="8" y1="16" x2="12" y2="16" stroke="#cbd5e1" stroke-width="1.5"/></svg>`;
          }
          return `<svg style="width:${size}px;height:${size}px;flex-shrink:0;" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2" fill="#334155" opacity="0.2" stroke="#64748b" stroke-width="1.8"/><polyline points="14 2 14 8 20 8" stroke="#64748b" stroke-width="1.5"/></svg>`;
        };

        const isArchive = (name) => {
          const l = name.toLowerCase();
          return l.endsWith('.zip') || l.endsWith('.tar.gz') || l.endsWith('.tgz') || l.endsWith('.tar') || l.endsWith('.gz');
        };

        const isImage = (name) => {
          const ext = (name.split('.').pop() || '').toLowerCase();
          return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff', 'avif'].includes(ext);
        };

        // =====================================================================
        // CUSTOM ACTIONS ENGINE & SYSTEM HELPERS
        // =====================================================================
        const getActionIconSvg = (icon) => {
          switch (icon) {
            case 'deploy':
              return `<svg style="width:15px;height:15px;color:#10b981;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;
            case 'play':
              return `<svg style="width:15px;height:15px;color:#22c55e;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
            case 'shield':
              return `<svg style="width:15px;height:15px;color:#a78bfa;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
            case 'lock':
              return `<svg style="width:15px;height:15px;color:#f59e0b;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
            case 'key':
              return `<svg style="width:15px;height:15px;color:#fbbf24;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-1.5 1.5L14 9l-3-3L3.5 13.5a5 5 0 1 0 7 7L18 13l2-2 1-5z"></path></svg>`;
            case 'checksum':
              return `<svg style="width:15px;height:15px;color:#eab308;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>`;
            case 'archive':
              return `<svg style="width:15px;height:15px;color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;
            case 'file-text':
              return `<svg style="width:15px;height:15px;color:#94a3b8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
            case 'file':
              return `<svg style="width:15px;height:15px;color:#64748b;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
            case 'folder':
              return `<svg style="width:15px;height:15px;color:#f59e0b;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
            case 'database':
              return `<svg style="width:15px;height:15px;color:#06b6d4;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`;
            case 'server':
              return `<svg style="width:15px;height:15px;color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>`;
            case 'cpu':
              return `<svg style="width:15px;height:15px;color:#f97316;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`;
            case 'cloud':
              return `<svg style="width:15px;height:15px;color:#60a5fa;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`;
            case 'download':
              return `<svg style="width:15px;height:15px;color:#10b981;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`;
            case 'upload':
              return `<svg style="width:15px;height:15px;color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`;
            case 'refresh':
              return `<svg style="width:15px;height:15px;color:#06b6d4;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
            case 'trash':
              return `<svg style="width:15px;height:15px;color:#ef4444;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>`;
            case 'wrench':
              return `<svg style="width:15px;height:15px;color:#94a3b8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`;
            case 'zap':
              return `<svg style="width:15px;height:15px;color:#eab308;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
            case 'search':
              return `<svg style="width:15px;height:15px;color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
            case 'bell':
              return `<svg style="width:15px;height:15px;color:#f59e0b;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
            case 'code':
              return `<svg style="width:15px;height:15px;color:#818cf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;
            case 'copy':
              return `<svg style="width:15px;height:15px;color:#60a5fa;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            case 'network':
              return `<svg style="width:15px;height:15px;color:#2dd4bf;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
            case 'activity':
              return `<svg style="width:15px;height:15px;color:#ec4899;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`;
            case 'tag':
              return `<svg style="width:15px;height:15px;color:#a855f7;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>`;
            case 'git':
              return `<svg style="width:15px;height:15px;color:#f97316;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="6" y1="9" x2="6" y2="15"></line><path d="M18 15a9 9 0 0 0-9-9"></path></svg>`;
            case 'docker':
              return `<svg style="width:15px;height:15px;color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M6 7V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3"></path><line x1="10" y1="11" x2="14" y2="11"></line></svg>`;
            case 'globe':
              return `<svg style="width:15px;height:15px;color:#3b82f6;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`;
            case 'link':
              return `<svg style="width:15px;height:15px;color:#14b8a6;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
            case 'settings':
              return `<svg style="width:15px;height:15px;color:#94a3b8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
            case 'terminal':
            default:
              return `<svg style="width:15px;height:15px;color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`;
          }
        };

        const showActionConfirmModal = (action, preview, targetPath, targetPaths) => {
          showModal(
            `Confirm Action: ${action.name}`,
            `
              <div style="font-size:0.78rem; display:flex; flex-direction:column; gap:0.75rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:0.4rem; border-bottom:1px solid rgba(255,255,255,0.08);">
                  <span style="color:var(--text-muted);">Target Server:</span>
                  <strong style="color:#38bdf8; font-family:var(--font-mono);">${escapeHtml(preview.server_name)} (${escapeHtml(preview.server_host)})</strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; padding-bottom:0.4rem; border-bottom:1px solid rgba(255,255,255,0.08);">
                  <span style="color:var(--text-muted); flex-shrink:0;">Selected Path:</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono); font-size:0.72rem; word-break:break-all; text-align:right;">${escapeHtml(targetPath)}</span>
                </div>
                <div>
                  <div style="color:var(--text-muted); font-size:0.72rem; margin-bottom:0.35rem;">Command Preview:</div>
                  <div style="background:#050810; border:1px solid rgba(56,189,248,0.25); border-radius:6px; padding:0.65rem; font-family:var(--font-mono); font-size:0.74rem; color:#38bdf8; white-space:pre-wrap; word-break:break-all; max-height:160px; overflow-y:auto;">${escapeHtml(preview.resolved_command)}</div>
                </div>
                <div style="font-size:0.7rem; color:var(--text-muted);">
                  This custom action will be executed securely on the remote host via your active SSH connection.
                </div>
              </div>
            `,
            async () => {
              runActionExecution(action, targetPath, targetPaths, preview.resolved_command);
              return true;
            },
            'Execute Action',
            false
          );
        };

        const showActionOutputModal = (action, targetPath, targetPaths, initialCmd = '') => {
          const appContainer = bodyEl.querySelector(`#fapp_${fileWinId}`);
          const backdrop = document.createElement('div');
          backdrop.className = 'file-modal-backdrop';
          const outModalId = 'actOut_' + Date.now();

          backdrop.innerHTML = `
            <div class="file-modal-box" style="max-width:88vw; width:720px; max-height:86vh; display:flex; flex-direction:column; overflow:hidden;">
              <div class="file-modal-header" style="display:flex; align-items:center; justify-content:space-between; padding:0.65rem 0.95rem; border-bottom:1px solid rgba(255,255,255,0.08); background:#111827;">
                <div style="display:flex; align-items:center; gap:0.6rem; min-width:0;">
                  <span style="font-weight:700; font-size:0.85rem; color:#f8fafc;">${escapeHtml(action.name)}</span>
                  <span id="stBadge_${outModalId}" style="font-size:0.68rem; font-weight:700; padding:2px 8px; border-radius:12px; background:rgba(56,189,248,0.15); color:#38bdf8;">Running...</span>
                  <span id="durBadge_${outModalId}" style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted);"></span>
                </div>
                <button class="win-btn win-close" id="closeBtn_${outModalId}">×</button>
              </div>
              <div style="padding:0.5rem 0.95rem; background:#0b101b; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.72rem; display:flex; justify-content:space-between; align-items:center;">
                <span id="cmdPreviewText_${outModalId}" style="color:var(--text-muted); font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:550px;">$ ${escapeHtml(initialCmd || action.command)}</span>
                <span style="color:#38bdf8; font-weight:600;">${escapeHtml(this.serverName)}</span>
              </div>
              <div style="flex:1; overflow:auto; padding:0.85rem; background:#050810; min-height:280px; max-height:calc(82vh - 120px);">
                <pre class="action-output-box" id="consoleEl_${outModalId}" style="margin:0; border:none; background:transparent; padding:0; min-height:100%; color:#cbd5e1;">Executing action on remote host via SSH...</pre>
              </div>
              <div class="file-modal-footer" style="display:flex; justify-content:space-between; align-items:center; padding:0.65rem 0.95rem; border-top:1px solid rgba(255,255,255,0.08); background:#0c1220;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <button class="btn btn-secondary btn-xs" id="copyBtn_${outModalId}" style="display:inline-flex; align-items:center; gap:4px;">
                    <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy Output
                  </button>
                  <button class="btn btn-secondary btn-xs" id="rerunBtn_${outModalId}" style="display:inline-flex; align-items:center; gap:4px;">
                    <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    Re-run
                  </button>
                  <button class="btn btn-ghost btn-xs" id="termHandoffBtn_${outModalId}" style="color:#38bdf8;">
                    Run in Terminal
                  </button>
                </div>
                <button class="btn btn-primary btn-sm" id="doneBtn_${outModalId}">Done</button>
              </div>
            </div>
          `;
          appContainer.appendChild(backdrop);

          const closeModal = () => { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
          backdrop.querySelector(`#closeBtn_${outModalId}`).onclick = closeModal;
          backdrop.querySelector(`#doneBtn_${outModalId}`).onclick = closeModal;

          const consoleEl = backdrop.querySelector(`#consoleEl_${outModalId}`);
          const stBadge = backdrop.querySelector(`#stBadge_${outModalId}`);
          const durBadge = backdrop.querySelector(`#durBadge_${outModalId}`);
          const cmdText = backdrop.querySelector(`#cmdPreviewText_${outModalId}`);
          let lastResult = null;

          const execute = async () => {
            stBadge.textContent = 'Running...';
            stBadge.style.background = 'rgba(56,189,248,0.15)';
            stBadge.style.color = '#38bdf8';
            durBadge.textContent = '';
            consoleEl.textContent = 'Executing action on remote host via SSH...';

            try {
              const resp = await fetch(`/api/actions/${action.id}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  server_id: this.serverId,
                  selected_path: targetPath,
                  selected_paths: targetPaths,
                  current_dir: currentPath
                })
              });
              const data = await resp.json();
              lastResult = data.result;

              if (lastResult) {
                if (lastResult.command_executed) {
                  cmdText.textContent = `$ ${lastResult.command_executed}`;
                }
                durBadge.textContent = `${lastResult.duration_ms} ms`;
                if (lastResult.success) {
                  stBadge.textContent = 'Exit 0 Success';
                  stBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                  stBadge.style.color = '#34d399';
                } else {
                  stBadge.textContent = `Exit ${lastResult.exit_code} Failed`;
                  stBadge.style.background = 'rgba(239, 68, 68, 0.15)';
                  stBadge.style.color = '#f87171';
                }

                let outText = '';
                if (lastResult.stdout) outText += lastResult.stdout;
                if (lastResult.stderr) {
                  outText += (outText ? '\n--- STDERR ---\n' : '') + lastResult.stderr;
                }
                if (!outText.trim()) outText = '(Action executed successfully with no output)';
                consoleEl.textContent = outText;
              } else {
                stBadge.textContent = 'Execution Error';
                stBadge.style.background = 'rgba(239, 68, 68, 0.15)';
                stBadge.style.color = '#f87171';
                consoleEl.textContent = data.error || 'Unknown execution error';
              }
            } catch (err) {
              stBadge.textContent = 'Network Error';
              stBadge.style.background = 'rgba(239, 68, 68, 0.15)';
              stBadge.style.color = '#f87171';
              consoleEl.textContent = `Failed to send request: ${err.message}`;
            }
          };

          backdrop.querySelector(`#copyBtn_${outModalId}`).onclick = () => {
            navigator.clipboard.writeText(consoleEl.textContent);
            const btn = backdrop.querySelector(`#copyBtn_${outModalId}`);
            const oldHtml = btn.innerHTML;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.innerHTML = oldHtml; }, 1500);
          };

          backdrop.querySelector(`#rerunBtn_${outModalId}`).onclick = execute;

          backdrop.querySelector(`#termHandoffBtn_${outModalId}`).onclick = () => {
            closeModal();
            const cmdToRun = (lastResult && lastResult.command_executed) ? lastResult.command_executed : action.command;
            DesktopApps.launch('terminal', { serverId: this.serverId, path: currentPath, command: cmdToRun, newWindow: true });
          };

          execute();
        };

        const runActionExecution = async (action, targetPath, targetPaths, resolvedCmd = '') => {
          if (action.output_target === 'terminal') {
            let cmdToRun = resolvedCmd;
            if (!cmdToRun) {
              try {
                const pResp = await fetch(`/api/actions/${action.id}/preview`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    server_id: this.serverId,
                    selected_path: targetPath,
                    selected_paths: targetPaths,
                    current_dir: currentPath
                  })
                });
                const pRes = await pResp.json();
                if (pRes.success && pRes.preview) {
                  cmdToRun = pRes.preview.resolved_command;
                }
              } catch (_) {}
            }
            DesktopApps.launch('terminal', { serverId: this.serverId, path: currentPath, command: cmdToRun || action.command, newWindow: true });
          } else {
            showActionOutputModal(action, targetPath, targetPaths, resolvedCmd);
          }
        };

        const showCustomActionBuilderModal = (actionToEdit = null) => {
          const appContainer = bodyEl.querySelector(`#fapp_${fileWinId}`);
          const backdrop = document.createElement('div');
          backdrop.className = 'file-modal-backdrop';
          const bModalId = 'actBld_' + Date.now();
          const isEdit = !!actionToEdit;

          const ACTION_ICONS = [
            { id: 'terminal', label: 'Terminal' },
            { id: 'deploy', label: 'Deploy' },
            { id: 'play', label: 'Run' },
            { id: 'shield', label: 'Shield' },
            { id: 'lock', label: 'Lock' },
            { id: 'key', label: 'Key' },
            { id: 'checksum', label: 'Checksum' },
            { id: 'archive', label: 'Archive' },
            { id: 'file-text', label: 'Logs' },
            { id: 'file', label: 'File' },
            { id: 'folder', label: 'Folder' },
            { id: 'database', label: 'Database' },
            { id: 'server', label: 'Server' },
            { id: 'cpu', label: 'CPU' },
            { id: 'cloud', label: 'Cloud' },
            { id: 'download', label: 'Download' },
            { id: 'upload', label: 'Upload' },
            { id: 'refresh', label: 'Restart' },
            { id: 'trash', label: 'Trash' },
            { id: 'wrench', label: 'Wrench' },
            { id: 'zap', label: 'Zap' },
            { id: 'search', label: 'Search' },
            { id: 'bell', label: 'Alert' },
            { id: 'code', label: 'Code' },
            { id: 'copy', label: 'Backup' },
            { id: 'network', label: 'Network' },
            { id: 'activity', label: 'Health' },
            { id: 'tag', label: 'Release' },
            { id: 'git', label: 'Git' },
            { id: 'docker', label: 'Container' },
            { id: 'globe', label: 'Web' },
            { id: 'link', label: 'Link' },
            { id: 'settings', label: 'Config' }
          ];
          const selectedIconId = (isEdit && actionToEdit.icon) ? actionToEdit.icon : 'terminal';
          const selectedIconObj = ACTION_ICONS.find(i => i.id === selectedIconId) || ACTION_ICONS[0];

          backdrop.innerHTML = `
            <div class="file-modal-box" style="max-width:88vw; width:620px; max-height:88vh; display:flex; flex-direction:column; overflow:hidden;">
              <div class="file-modal-header" style="display:flex; align-items:center; justify-content:space-between; padding:0.65rem 0.95rem; border-bottom:1px solid rgba(255,255,255,0.08); background:#111827;">
                <span style="font-weight:700; font-size:0.85rem; color:#f8fafc;">${isEdit ? 'Edit Custom Action' : 'Add Custom Action'}</span>
                <button class="win-btn win-close" id="bClose_${bModalId}">×</button>
              </div>
              <div class="file-modal-body" style="padding:1rem; overflow-y:auto; display:flex; flex-direction:column; gap:0.85rem; font-size:0.78rem;">
                <div>
                  <label style="display:block; margin-bottom:0.35rem; color:var(--text-muted); font-size:0.72rem; font-weight:600;">Action name</label>
                  <input type="text" id="bName_${bModalId}" class="form-control" placeholder="Deploy Website" value="${isEdit ? escapeHtml(actionToEdit.name) : ''}" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                </div>

                <div>
                  <label style="display:block; margin-bottom:0.35rem; color:var(--text-muted); font-size:0.72rem; font-weight:600;">Command to execute on the remote server</label>
                  <textarea id="bCmd_${bModalId}" class="form-control" rows="3" placeholder="bash ./deploy.sh" style="width:100%; font-family:var(--font-mono); font-size:0.76rem; padding:0.45rem 0.6rem; line-height:1.4; resize:vertical;">${isEdit ? escapeHtml(actionToEdit.command) : ''}</textarea>
                  <div style="margin-top:0.35rem; display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                    <span style="font-size:0.68rem; color:var(--text-muted);">Insert variable:</span>
                    <span class="custom-action-pill-var" data-vchip="{{selected_path}}" title="Full path of selected file or folder">{{selected_path}}</span>
                    <span class="custom-action-pill-var" data-vchip="{{selected_name}}" title="Filename/Basename only">{{selected_name}}</span>
                    <span class="custom-action-pill-var" data-vchip="{{current_dir}}" title="Current working directory">{{current_dir}}</span>
                    <span class="custom-action-pill-var" data-vchip="{{selected_paths}}" title="All selected paths">{{selected_paths}}</span>
                    <span class="custom-action-pill-var" data-vchip="{{server_name}}" title="Current server name">{{server_name}}</span>
                  </div>
                  <div style="font-size:0.68rem; color:var(--text-muted); margin-top:4px;">ShellMan safely quotes all parameters with POSIX escaping to prevent command injection.</div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                  <div>
                    <label style="display:block; margin-bottom:0.35rem; color:var(--text-muted); font-size:0.72rem; font-weight:600;">Description (optional)</label>
                    <input type="text" id="bDesc_${bModalId}" class="form-control" placeholder="Runs deployment script" value="${isEdit ? escapeHtml(actionToEdit.description || '') : ''}" style="width:100%; font-size:0.78rem; padding:0.35rem 0.55rem;">
                  </div>
                  <div style="position:relative;">
                    <label style="display:block; margin-bottom:0.35rem; color:var(--text-muted); font-size:0.72rem; font-weight:600;">Icon</label>
                    <button type="button" id="bIconTrigger_${bModalId}" class="form-control" style="width:100%; display:flex; align-items:center; justify-content:space-between; font-size:0.78rem; padding:0.35rem 0.55rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:6px; color:#f8fafc; cursor:pointer;">
                      <span style="display:flex; align-items:center; gap:0.45rem; min-width:0; overflow:hidden;">
                        <span id="bIconPreview_${bModalId}" style="display:flex; align-items:center; flex-shrink:0;">${getActionIconSvg(selectedIconObj.id)}</span>
                        <span id="bIconLabel_${bModalId}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${selectedIconObj.label}</span>
                      </span>
                      <svg style="width:12px; height:12px; color:#94a3b8; flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <input type="hidden" id="bIcon_${bModalId}" value="${selectedIconObj.id}">

                    <div id="bIconDropdown_${bModalId}" style="display:none; position:absolute; top:calc(100% + 4px); right:0; width:330px; background:#0b111e; border:1px solid rgba(255,255,255,0.16); border-radius:8px; box-shadow:0 14px 36px rgba(0,0,0,0.9); z-index:150; max-height:260px; overflow-y:auto; padding:8px;">
                      <div style="margin-bottom:6px;">
                        <input type="text" id="bIconSearch_${bModalId}" class="form-control" placeholder="Search 30+ icons..." style="width:100%; font-size:0.72rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px;">
                      </div>
                      <div id="bIconGrid_${bModalId}" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px;">
                        ${ACTION_ICONS.map(opt => `
                          <div class="custom-action-icon-opt" data-icon-val="${opt.id}" data-icon-label="${opt.label.toLowerCase()}" style="display:flex; align-items:center; gap:0.45rem; padding:0.38rem 0.5rem; border-radius:5px; cursor:pointer; font-size:0.73rem; color:#cbd5e1; border:1px solid ${opt.id === selectedIconObj.id ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.06)'}; ${opt.id === selectedIconObj.id ? 'background:rgba(56,189,248,0.15); color:#38bdf8;' : 'background:rgba(255,255,255,0.02);'}">
                            <span style="display:flex; align-items:center; flex-shrink:0;">${getActionIconSvg(opt.id)}</span>
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${opt.label}</span>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label style="display:block; margin-bottom:0.35rem; color:var(--text-muted); font-size:0.72rem; font-weight:600;">Available for</label>
                  <div style="display:flex; flex-direction:column; gap:0.3rem;">
                    <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;"><input type="radio" name="bTargetType_${bModalId}" value="files" ${isEdit && actionToEdit.target_type === 'files' ? 'checked' : ''}> Files only</label>
                    <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;"><input type="radio" name="bTargetType_${bModalId}" value="folders" ${isEdit && actionToEdit.target_type === 'folders' ? 'checked' : ''}> Folders only</label>
                    <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;"><input type="radio" name="bTargetType_${bModalId}" value="both" ${!isEdit || actionToEdit.target_type === 'both' ? 'checked' : ''}> Files and folders</label>
                    <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;"><input type="radio" name="bTargetType_${bModalId}" value="multiple" ${isEdit && actionToEdit.target_type === 'multiple' ? 'checked' : ''}> Multiple selected items</label>
                  </div>
                </div>

                <div>
                  <label style="display:block; margin-bottom:0.35rem; color:var(--text-muted); font-size:0.72rem; font-weight:600;">How should the result appear?</label>
                  <div style="display:flex; flex-direction:column; gap:0.3rem;">
                    <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;"><input type="radio" name="bOutTarget_${bModalId}" value="panel" ${!isEdit || actionToEdit.output_target === 'panel' ? 'checked' : ''}> Output panel inside ShellMan</label>
                    <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer;"><input type="radio" name="bOutTarget_${bModalId}" value="terminal" ${isEdit && actionToEdit.output_target === 'terminal' ? 'checked' : ''}> Run in terminal</label>
                  </div>
                </div>

                <div>
                  <label style="display:flex; align-items:center; gap:0.45rem; cursor:pointer; font-weight:600; color:#f8fafc;">
                    <input type="checkbox" id="bConfirm_${bModalId}" ${!isEdit || actionToEdit.require_confirm ? 'checked' : ''}> Ask for confirmation before running
                  </label>
                </div>

                <div id="bErr_${bModalId}" style="display:none; color:#ef4444; font-size:0.72rem;"></div>
              </div>
              <div class="file-modal-footer" style="display:flex; justify-content:space-between; align-items:center; padding:0.65rem 0.95rem; border-top:1px solid rgba(255,255,255,0.08); background:#0c1220;">
                <div>
                  ${isEdit ? `<button class="btn btn-danger btn-sm" id="bDelete_${bModalId}">Delete Action</button>` : ''}
                </div>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                  <button class="btn btn-ghost btn-sm" id="bCancel_${bModalId}">Cancel</button>
                  <button class="btn btn-primary btn-sm" id="bSave_${bModalId}">${isEdit ? 'Update Action' : 'Save Custom Action'}</button>
                </div>
              </div>
            </div>
          `;
          appContainer.appendChild(backdrop);

          const closeModal = () => { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
          backdrop.querySelector(`#bClose_${bModalId}`).onclick = closeModal;
          backdrop.querySelector(`#bCancel_${bModalId}`).onclick = closeModal;

          if (isEdit) {
            const delBtn = backdrop.querySelector(`#bDelete_${bModalId}`);
            if (delBtn) {
              delBtn.onclick = async () => {
                if (!confirm(`Are you sure you want to permanently delete custom action "${actionToEdit.name}"?`)) return;
                try {
                  const resp = await fetch(`/api/actions/${actionToEdit.id}`, { method: 'DELETE' });
                  const res = await resp.json();
                  if (res.success) {
                    closeModal();
                    updatePropertiesPane();
                  } else {
                    alert(res.error || 'Failed to delete action');
                  }
                } catch (e) {
                  alert(e.message);
                }
              };
            }
          }

          const iconTrigger = backdrop.querySelector(`#bIconTrigger_${bModalId}`);
          const iconDropdown = backdrop.querySelector(`#bIconDropdown_${bModalId}`);
          const iconSearch = backdrop.querySelector(`#bIconSearch_${bModalId}`);
          const iconHidden = backdrop.querySelector(`#bIcon_${bModalId}`);
          const iconPreview = backdrop.querySelector(`#bIconPreview_${bModalId}`);
          const iconLabel = backdrop.querySelector(`#bIconLabel_${bModalId}`);

          if (iconTrigger && iconDropdown) {
            iconTrigger.onclick = (e) => {
              e.stopPropagation();
              const isVisible = iconDropdown.style.display === 'block';
              iconDropdown.style.display = isVisible ? 'none' : 'block';
              if (!isVisible && iconSearch) {
                iconSearch.value = '';
                iconDropdown.querySelectorAll('.custom-action-icon-opt').forEach(el => { el.style.display = 'flex'; });
                setTimeout(() => iconSearch.focus(), 60);
              }
            };

            if (iconSearch) {
              iconSearch.onclick = (e) => e.stopPropagation();
              iconSearch.oninput = (e) => {
                const q = e.target.value.toLowerCase().trim();
                iconDropdown.querySelectorAll('.custom-action-icon-opt').forEach(el => {
                  const lbl = (el.dataset.iconLabel || '').toLowerCase();
                  const val = (el.dataset.iconVal || '').toLowerCase();
                  const match = !q || lbl.includes(q) || val.includes(q);
                  el.style.display = match ? 'flex' : 'none';
                });
              };
            }

            iconDropdown.querySelectorAll('.custom-action-icon-opt').forEach(optEl => {
              optEl.onclick = (e) => {
                e.stopPropagation();
                const chosenId = optEl.dataset.iconVal;
                const found = ACTION_ICONS.find(i => i.id === chosenId);
                if (found) {
                  iconHidden.value = found.id;
                  iconPreview.innerHTML = getActionIconSvg(found.id);
                  iconLabel.textContent = found.label;
                  iconDropdown.querySelectorAll('.custom-action-icon-opt').forEach(el => {
                    const isSelected = el.dataset.iconVal === chosenId;
                    el.style.background = isSelected ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.02)';
                    el.style.borderColor = isSelected ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.06)';
                    el.style.color = isSelected ? '#38bdf8' : '#cbd5e1';
                  });
                }
                iconDropdown.style.display = 'none';
              };
            });

            backdrop.addEventListener('click', (e) => {
              if (!iconTrigger.contains(e.target) && !iconDropdown.contains(e.target)) {
                iconDropdown.style.display = 'none';
              }
            });
          }

          const cmdArea = backdrop.querySelector(`#bCmd_${bModalId}`);
          backdrop.querySelectorAll('[data-vchip]').forEach(chip => {
            chip.onclick = () => {
              const v = chip.dataset.vchip;
              const start = cmdArea.selectionStart || cmdArea.value.length;
              const end = cmdArea.selectionEnd || cmdArea.value.length;
              cmdArea.value = cmdArea.value.substring(0, start) + v + cmdArea.value.substring(end);
              cmdArea.focus();
              cmdArea.selectionStart = cmdArea.selectionEnd = start + v.length;
            };
          });

          backdrop.querySelector(`#bSave_${bModalId}`).onclick = async () => {
            const name = backdrop.querySelector(`#bName_${bModalId}`).value.trim();
            const cmd = cmdArea.value.trim();
            const desc = backdrop.querySelector(`#bDesc_${bModalId}`).value.trim();
            const icon = backdrop.querySelector(`#bIcon_${bModalId}`).value;
            const targetType = backdrop.querySelector(`input[name="bTargetType_${bModalId}"]:checked`).value;
            const outputTarget = backdrop.querySelector(`input[name="bOutTarget_${bModalId}"]:checked`).value;
            const requireConfirm = backdrop.querySelector(`#bConfirm_${bModalId}`).checked;
            const errEl = backdrop.querySelector(`#bErr_${bModalId}`);

            if (!name) {
              errEl.style.display = 'block';
              errEl.textContent = 'Action name is required';
              return;
            }
            if (!cmd) {
              errEl.style.display = 'block';
              errEl.textContent = 'Command is required';
              return;
            }

            const payload = {
              name,
              command: cmd,
              description: desc,
              icon,
              target_type: targetType,
              output_target: outputTarget,
              require_confirm: requireConfirm,
              server_id: null
            };

            try {
              const url = isEdit ? `/api/actions/${actionToEdit.id}` : '/api/actions';
              const method = isEdit ? 'PUT' : 'POST';
              const resp = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const res = await resp.json();
              if (res.success) {
                closeModal();
                updatePropertiesPane();
              } else {
                errEl.style.display = 'block';
                errEl.textContent = res.error || 'Failed to save action';
              }
            } catch (e) {
              errEl.style.display = 'block';
              errEl.textContent = `Error: ${e.message}`;
            }
          };
        };

        const showImportModal = () => {
          showModal(
            'Import Custom Actions',
            `
              <div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem;">Paste exported ShellMan actions JSON payload below:</p>
                <textarea id="importPayloadInp" class="form-control" rows="6" placeholder='{ "actions": [ ... ] }' style="width:100%; font-family:var(--font-mono); font-size:0.75rem;"></textarea>
                <div id="importErr" style="display:none; color:#ef4444; font-size:0.72rem; margin-top:0.35rem;"></div>
              </div>
            `,
            async (modalEl) => {
              const raw = modalEl.querySelector('#importPayloadInp').value.trim();
              const errEl = modalEl.querySelector('#importErr');
              if (!raw) return false;
              try {
                const parsed = JSON.parse(raw);
                const resp = await fetch('/api/actions/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(parsed)
                });
                const res = await resp.json();
                if (res.success) {
                  updatePropertiesPane();
                  return true;
                } else {
                  errEl.style.display = 'block';
                  errEl.textContent = res.error || 'Import failed';
                  return false;
                }
              } catch (e) {
                errEl.style.display = 'block';
                errEl.textContent = 'Invalid JSON: ' + e.message;
                return false;
              }
            },
            'Import Actions'
          );
        };

        const loadCustomActions = async (targetType, extension, targetPath, targetPaths) => {
          const listEl = propsContent.querySelector(`#customActionsList_${fileWinId}`);
          if (!listEl) return;
          try {
            const url = `/api/actions?server_id=${this.serverId}&target_type=${targetType}&extension=${encodeURIComponent(extension || '')}`;
            const resp = await fetch(url);
            const res = await resp.json();
            if (res.success && res.actions) {
              if (res.actions.length === 0) {
                listEl.innerHTML = `<div style="font-size:0.7rem; color:var(--text-muted); padding:0.25rem 0;">No custom actions configured</div>`;
              } else {
                listEl.innerHTML = res.actions.map(act => {
                  let cardTheme = '';
                  if (act.icon === 'deploy') cardTheme = 'builtin-deploy';
                  else if (act.icon === 'shield') cardTheme = 'builtin-shield';
                  else if (act.icon === 'checksum') cardTheme = 'builtin-checksum';

                  return `
                    <div class="custom-action-card ${cardTheme}" data-action-id="${act.id}" title="${escapeHtml(act.description || act.name)}">
                      <div style="display:flex; align-items:center; gap:0.55rem; min-width:0; flex:1;">
                        <div class="custom-action-icon">${getActionIconSvg(act.icon)}</div>
                        <div style="min-width:0; flex:1;">
                          <div style="font-weight:700; font-size:0.78rem; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(act.name)}</div>
                          <div style="font-size:0.66rem; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:1px;">${escapeHtml(act.description || act.command)}</div>
                        </div>
                      </div>
                      <div style="display:flex; align-items:center; gap:0.35rem; flex-shrink:0;">
                        <button class="custom-action-del-btn" data-action-del="${act.id}" title="Delete ${escapeHtml(act.name)}">
                          <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                        </button>
                        <button class="custom-action-run-btn" data-action-run="${act.id}" title="Run ${escapeHtml(act.name)}">
                          <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 19 12 6 20 6 4"></polygon></svg>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('');

                const handleTrigger = (actId) => {
                  const act = res.actions.find(a => a.id === actId);
                  if (act) {
                    if (act.require_confirm) {
                      fetch(`/api/actions/${act.id}/preview`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          server_id: this.serverId,
                          selected_path: targetPath,
                          selected_paths: targetPaths,
                          current_dir: currentPath
                        })
                      })
                      .then(r => r.json())
                      .then(pRes => {
                        if (pRes.success && pRes.preview) {
                          showActionConfirmModal(act, pRes.preview, targetPath, targetPaths);
                        } else {
                          runActionExecution(act, targetPath, targetPaths);
                        }
                      })
                      .catch(() => runActionExecution(act, targetPath, targetPaths));
                    } else {
                      runActionExecution(act, targetPath, targetPaths);
                    }
                  }
                };

                listEl.querySelectorAll('[data-action-run]').forEach(btn => {
                  btn.onclick = (e) => {
                    e.stopPropagation();
                    handleTrigger(parseInt(btn.dataset.actionRun, 10));
                  };
                });

                listEl.querySelectorAll('[data-action-del]').forEach(btn => {
                  btn.onclick = (e) => {
                    e.stopPropagation();
                    const actId = parseInt(btn.dataset.actionDel, 10);
                    const act = res.actions.find(a => a.id === actId);
                    if (!act) return;

                    showModal(
                      `Delete Action: ${act.name}`,
                      `
                        <div style="font-size:0.78rem; color:#f1f5f9; display:flex; flex-direction:column; gap:0.5rem;">
                          <div>Are you sure you want to permanently delete the custom action <strong>${escapeHtml(act.name)}</strong>?</div>
                          <div style="background:#050810; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:0.55rem; font-family:var(--font-mono); font-size:0.72rem; color:#94a3b8; word-break:break-all;">
                            ${escapeHtml(act.command)}
                          </div>
                          <div style="color:var(--accent-rose); font-size:0.72rem; display:flex; align-items:center; gap:0.35rem; margin-top:0.25rem;">
                            <svg style="width:13px;height:13px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            <span>Warning: This operation cannot be undone.</span>
                          </div>
                          <div id="delActErr_${fileWinId}" style="display:none; color:var(--accent-rose); font-size:0.72rem; margin-top:0.3rem;"></div>
                        </div>
                      `,
                      async (modalEl) => {
                        const errEl = modalEl.querySelector(`#delActErr_${fileWinId}`);
                        try {
                          const resp = await fetch(`/api/actions/${act.id}`, { method: 'DELETE' });
                          const dRes = await resp.json();
                          if (dRes.success) {
                            loadCustomActions(targetType, extension, targetPath, targetPaths);
                            return true;
                          } else {
                            if (errEl) { errEl.textContent = dRes.error || 'Failed to delete action'; errEl.style.display = 'block'; }
                            return false;
                          }
                        } catch (err) {
                          if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
                          return false;
                        }
                      },
                      'Delete Action',
                      'btn-danger'
                    );
                  };
                });

                listEl.querySelectorAll('.custom-action-card').forEach(card => {
                  card.onclick = () => {
                    handleTrigger(parseInt(card.dataset.actionId, 10));
                  };
                });
              }
            }
          } catch (err) {
            if (listEl) listEl.innerHTML = `<div style="font-size:0.7rem; color:#ef4444;">Failed to load actions</div>`;
          }

          // Wire Add Custom Action & Export / Import
          const addBtn = propsContent.querySelector(`#addCustomActionBtn_${fileWinId}`);
          if (addBtn) addBtn.onclick = () => showCustomActionBuilderModal();

          const exportBtn = propsContent.querySelector(`#exportActionsBtn_${fileWinId}`);
          if (exportBtn) exportBtn.onclick = () => { window.location.href = '/api/actions/export'; };

          const importBtn = propsContent.querySelector(`#importActionsBtn_${fileWinId}`);
          if (importBtn) importBtn.onclick = () => showImportModal();
        };

        const updatePropertiesPane = () => {
          if (!propsContent) return;
          const count = selectedPaths.size;

          if (count === 1) {
            const p = Array.from(selectedPaths)[0];
            const item = items.find(i => i.path === p);
            if (!item) return;

            const iconHtml = renderItemIcon(item, 34);
            const typeDesc = getTypeDescription(item);
            const isDir = !!item.is_dir;
            const isImg = isImage(item.name);
            const isArch = isArchive(item.name);

            propsContent.innerHTML = `
              <div style="font-size:0.85rem; font-weight:700; color:#f8fafc; margin-bottom:0.75rem;">File Actions</div>
              
              <div class="file-action-selected-pill">
                <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1;">
                  <div style="width:34px; height:34px; border-radius:6px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${iconHtml}
                  </div>
                  <div style="min-width:0; flex:1;">
                    <div style="font-size:0.78rem; font-weight:700; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                    <div style="font-size:0.67rem; color:#94a3b8; font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.path)}</div>
                  </div>
                </div>
                <span class="file-action-selected-badge">Selected</span>
              </div>

              <div style="display:flex; flex-direction:column; gap:0.45rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.73rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Type</span>
                  <span style="color:#cbd5e1;">${typeDesc}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Size</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono);">${item.size_formatted || '-'}</span>
                </div>
                ${isDir ? `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Items</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono);" id="propsItemCount_${fileWinId}">${item.items_count !== undefined && item.items_count !== null ? `${item.items_count} items` : 'Loading...'}</span>
                </div>` : ''}
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Modified</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono); font-size:0.7rem;">${escapeHtml(item.mtime || '-')}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Permissions</span>
                  <span style="color:#38bdf8; font-family:var(--font-mono); font-size:0.7rem;">${escapeHtml(item.permissions || '-')}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Owner</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono);">${escapeHtml(item.owner || '-')} : ${escapeHtml(item.group || '-')}</span>
                </div>
              </div>

              <!-- Built-in Actions -->
              <div style="margin-top:0.75rem;">
                <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:0.35rem;">Built-in Actions</div>
                <div style="display:flex; flex-direction:column; gap:0.3rem;">
                  ${isDir ? `
                    <button class="props-action-btn" id="propBtn_open_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      <span>Open Folder</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_code_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                      <span>Open in Code</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_term_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                      <span>Open Terminal Here</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_compress_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                      <span>Compress (zip)</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_dl_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      <span>Download as Archive</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_copy_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      <span>Copy</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_move_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                      <span>Move</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_rename_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                      <span>Rename</span>
                    </button>
                    <button class="props-action-btn danger" id="propBtn_delete_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                      <span>Delete</span>
                    </button>
                  ` : `
                    ${isImg ? `
                      <button class="props-action-btn" id="propBtn_preview_${fileWinId}" style="color:#38bdf8;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <span>Preview Image</span>
                      </button>
                    ` : ''}
                    <button class="props-action-btn" id="propBtn_code_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                      <span>Open in Code</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_dl_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      <span>Download</span>
                    </button>
                    ${isArch ? `
                      <button class="props-action-btn" id="propBtn_extract_${fileWinId}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline></svg>
                        <span>Extract Here</span>
                      </button>
                    ` : ''}
                    <button class="props-action-btn" id="propBtn_compress_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                      <span>Compress (zip)</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_copy_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      <span>Copy</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_move_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                      <span>Move</span>
                    </button>
                    <button class="props-action-btn" id="propBtn_rename_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                      <span>Rename</span>
                    </button>
                    <button class="props-action-btn danger" id="propBtn_delete_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                      <span>Delete</span>
                    </button>
                  `}
                </div>
              </div>

              <!-- Custom Actions Section -->
              <div style="margin-top:1.1rem; padding-top:0.85rem; border-top:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">Custom Actions</div>
                  <div style="display:flex; gap:0.35rem;">
                    <button id="exportActionsBtn_${fileWinId}" class="btn-ghost btn-xs" title="Export actions to JSON" style="padding:1px 6px; font-size:0.65rem; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); border-radius:4px; cursor:pointer;">Export</button>
                    <button id="importActionsBtn_${fileWinId}" class="btn-ghost btn-xs" title="Import actions from JSON" style="padding:1px 6px; font-size:0.65rem; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); border-radius:4px; cursor:pointer;">Import</button>
                  </div>
                </div>
                <div id="customActionsList_${fileWinId}">
                  <div style="font-size:0.7rem; color:#64748b; padding:0.25rem 0;">Loading actions...</div>
                </div>
                <button class="add-custom-action-card" id="addCustomActionBtn_${fileWinId}" style="margin-top:0.4rem; width:100%;">
                  <div style="display:flex; align-items:center; gap:0.5rem; color:#38bdf8; font-size:0.75rem; font-weight:600;">
                    <svg style="width:14px; height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>+ Add Custom Action</span>
                  </div>
                </button>
              </div>
            `;

            // Asynchronously fetch folder item count if directory and not already cached
            if (isDir && item.items_count === undefined) {
              fetch(`/api/servers/${this.serverId}/files/stat?path=${encodeURIComponent(item.path)}`)
                .then(r => r.json())
                .then(res => {
                  if (res.success && res.data) {
                    item.items_count = res.data.items_count;
                    const countEl = propsContent.querySelector(`#propsItemCount_${fileWinId}`);
                    if (countEl) countEl.textContent = res.data.items_count !== null ? `${res.data.items_count} items` : '-';
                  }
                }).catch(() => {});
            }

            const wire = (id, fn) => {
              const btn = propsContent.querySelector(`#${id}_${fileWinId}`);
              if (btn) btn.onclick = fn;
            };

            if (isDir) {
              wire('propBtn_open', () => loadDir(item.path));
              wire('propBtn_code', () => DesktopApps.launch('code', { root: item.path, isDir: true }));
              wire('propBtn_term', () => DesktopApps.launch('terminal', { path: item.path, newWindow: true }));
              wire('propBtn_compress', () => showCompressModal([item.path], item.name));
              wire('propBtn_dl', () => downloadItemsAsArchive([item.path], item.name + '.tar.gz'));
              wire('propBtn_copy', () => showCopyMoveModal([item.path], 'copy'));
              wire('propBtn_move', () => showCopyMoveModal([item.path], 'move'));
              wire('propBtn_rename', () => showRenameModal(item));
              wire('propBtn_delete', () => showDeleteModal([item.path], true));
            } else {
              if (isImg) wire('propBtn_preview', () => showImagePreviewModal(item));
              wire('propBtn_code', () => DesktopApps.launch('code', { path: item.path, isDir: false }));
              wire('propBtn_dl', () => { window.location.href = `/api/servers/${this.serverId}/files/download?path=${encodeURIComponent(item.path)}`; });
              if (isArch) wire('propBtn_extract', () => extractArchive(item.path, currentPath));
              wire('propBtn_compress', () => showCompressModal([item.path], item.name));
              wire('propBtn_copy', () => showCopyMoveModal([item.path], 'copy'));
              wire('propBtn_move', () => showCopyMoveModal([item.path], 'move'));
              wire('propBtn_rename', () => showRenameModal(item));
              wire('propBtn_delete', () => showDeleteModal([item.path], false));
            }

            // Load Custom Actions matching this item
            const ext = isDir ? '' : (item.name.includes('.') ? item.name.split('.').pop() : '');
            loadCustomActions(isDir ? 'directory' : 'file', ext, item.path, [item.path]);

          } else if (count > 1) {
            // Multi-selection
            const selItems = items.filter(i => selectedPaths.has(i.path));
            const totalBytes = selItems.reduce((acc, cur) => acc + (cur.size || 0), 0);
            const formattedTotalSize = formatBytes(totalBytes);
            const selectedList = Array.from(selectedPaths);
            const hasArchives = selItems.some(i => isArchive(i.name));

            propsContent.innerHTML = `
              <div style="font-size:0.85rem; font-weight:700; color:#f8fafc; margin-bottom:0.75rem;">File Actions</div>

              <div class="file-action-selected-pill">
                <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1;">
                  <div style="width:34px; height:34px; border-radius:6px; background:rgba(56,189,248,0.12); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <svg style="width:18px; height:18px; color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  </div>
                  <div style="min-width:0; flex:1;">
                    <div style="font-size:0.78rem; font-weight:700; color:#f8fafc;">${count} Items Selected</div>
                    <div style="font-size:0.67rem; color:#94a3b8; font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(currentPath)}</div>
                  </div>
                </div>
                <span class="file-action-selected-badge">${count} items</span>
              </div>

              <div style="display:flex; flex-direction:column; gap:0.45rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.73rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Selected</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono);">${count} items</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Total Size</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono);">${formattedTotalSize}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Directory</span>
                  <span style="color:#94a3b8; font-family:var(--font-mono); font-size:0.7rem; word-break:break-all; text-align:right;" title="${escapeHtml(currentPath)}">${escapeHtml(currentPath)}</span>
                </div>
              </div>

              <!-- Batch Built-in Actions -->
              <div style="margin-top:0.75rem;">
                <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:0.35rem;">Batch Actions</div>
                <div style="display:flex; flex-direction:column; gap:0.3rem;">
                  <button class="props-action-btn" id="propBtn_batch_code_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                    <span>Open in Code</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_batch_copy_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>Copy (${count} items)...</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_batch_move_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                    <span>Move (${count} items)...</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_batch_compress_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                    <span>Compress (${count} items)</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_batch_dl_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>Download Archive</span>
                  </button>
                  ${hasArchives ? `
                    <button class="props-action-btn" id="propBtn_batch_extract_${fileWinId}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline></svg>
                      <span>Extract Archive(s)</span>
                    </button>
                  ` : ''}
                  <button class="props-action-btn danger" id="propBtn_batch_delete_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                    <span>Delete (${count} items)</span>
                  </button>
                </div>
              </div>

              <!-- Custom Actions Section -->
              <div style="margin-top:1.1rem; padding-top:0.85rem; border-top:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">Custom Actions</div>
                  <div style="display:flex; gap:0.35rem;">
                    <button id="exportActionsBtn_${fileWinId}" class="btn-ghost btn-xs" title="Export actions to JSON" style="padding:1px 6px; font-size:0.65rem; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); border-radius:4px; cursor:pointer;">Export</button>
                    <button id="importActionsBtn_${fileWinId}" class="btn-ghost btn-xs" title="Import actions from JSON" style="padding:1px 6px; font-size:0.65rem; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); border-radius:4px; cursor:pointer;">Import</button>
                  </div>
                </div>
                <div id="customActionsList_${fileWinId}">
                  <div style="font-size:0.7rem; color:#64748b; padding:0.25rem 0;">Loading actions...</div>
                </div>
                <button class="add-custom-action-card" id="addCustomActionBtn_${fileWinId}" style="margin-top:0.4rem; width:100%;">
                  <div style="display:flex; align-items:center; gap:0.5rem; color:#38bdf8; font-size:0.75rem; font-weight:600;">
                    <svg style="width:14px; height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>+ Add Custom Action</span>
                  </div>
                </button>
              </div>
            `;

            const wire = (id, fn) => {
              const btn = propsContent.querySelector(`#${id}_${fileWinId}`);
              if (btn) btn.onclick = fn;
            };

            wire('propBtn_batch_code', () => {
              const filesOnly = selItems.filter(i => !i.is_dir).map(i => i.path);
              const dirsOnly = selItems.filter(i => i.is_dir).map(i => i.path);
              if (dirsOnly.length > 0 && filesOnly.length === 0) DesktopApps.launch('code', { root: dirsOnly[0], isDir: true });
              else if (filesOnly.length > 0) DesktopApps.launch('code', { paths: filesOnly });
              else DesktopApps.launch('code', { paths: selectedList });
            });
            wire('propBtn_batch_copy', () => showCopyMoveModal(selectedList, 'copy'));
            wire('propBtn_batch_move', () => showCopyMoveModal(selectedList, 'move'));
            wire('propBtn_batch_compress', () => showCompressModal(selectedList, 'selection_archive'));
            wire('propBtn_batch_dl', () => downloadItemsAsArchive(selectedList, 'selected_files.tar.gz'));
            if (hasArchives) {
              wire('propBtn_batch_extract', () => {
                selItems.filter(i => isArchive(i.name)).forEach(i => extractArchive(i.path, currentPath));
              });
            }
            wire('propBtn_batch_delete', () => showDeleteModal(selectedList));

            // Load Custom Actions matching multiple files
            loadCustomActions('multiple', '', selectedList[0], selectedList);

          } else {
            // No selection -> Current folder properties
            const dirName = currentPath.split('/').filter(Boolean).pop() || '/';
            propsContent.innerHTML = `
              <div style="font-size:0.85rem; font-weight:700; color:#f8fafc; margin-bottom:0.75rem;">File Actions</div>

              <div class="file-action-selected-pill">
                <div style="display:flex; align-items:center; gap:0.6rem; min-width:0; flex:1;">
                  <div style="width:34px; height:34px; border-radius:6px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${renderItemIcon({ is_dir: true, name: dirName }, 34)}
                  </div>
                  <div style="min-width:0; flex:1;">
                    <div style="font-size:0.78rem; font-weight:700; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(dirName)}">${escapeHtml(dirName)}</div>
                    <div style="font-size:0.67rem; color:#94a3b8; font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(currentPath)}</div>
                  </div>
                </div>
                <span class="file-action-selected-badge">Current Dir</span>
              </div>

              <div style="display:flex; flex-direction:column; gap:0.45rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.73rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Path</span>
                  <span style="color:#94a3b8; font-family:var(--font-mono); font-size:0.7rem; word-break:break-all; text-align:right;" title="${escapeHtml(currentPath)}">${escapeHtml(currentPath)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Contents</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono);">${items.length} items</span>
                </div>
                ${parentPath ? `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Parent</span>
                  <span style="color:#94a3b8; font-family:var(--font-mono); font-size:0.7rem; word-break:break-all; text-align:right;">${escapeHtml(parentPath)}</span>
                </div>` : ''}
              </div>

              <!-- Directory Built-in Actions -->
              <div style="margin-top:0.75rem;">
                <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:0.35rem;">Directory Actions</div>
                <div style="display:flex; flex-direction:column; gap:0.3rem;">
                  <button class="props-action-btn" id="propBtn_cur_newfile_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                    <span>New File</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_cur_newdir_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                    <span>New Folder</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_cur_upload_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span>Upload Files Here</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_cur_upload_folder_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><polyline points="12 11 12 17"></polyline><polyline points="9 14 12 11 15 14"></polyline></svg>
                    <span>Upload Folder Here</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_cur_term_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                    <span>Open Terminal in Directory</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_cur_code_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                    <span>Open in Code Workspace</span>
                  </button>
                  <button class="props-action-btn" id="propBtn_cur_refresh_${fileWinId}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    <span>Refresh Directory</span>
                  </button>
                </div>
              </div>

              <!-- Custom Actions Section -->
              <div style="margin-top:1.1rem; padding-top:0.85rem; border-top:1px solid rgba(255,255,255,0.08);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <div style="font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8;">Custom Actions</div>
                  <div style="display:flex; gap:0.35rem;">
                    <button id="exportActionsBtn_${fileWinId}" class="btn-ghost btn-xs" title="Export actions to JSON" style="padding:1px 6px; font-size:0.65rem; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); border-radius:4px; cursor:pointer;">Export</button>
                    <button id="importActionsBtn_${fileWinId}" class="btn-ghost btn-xs" title="Import actions from JSON" style="padding:1px 6px; font-size:0.65rem; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); border-radius:4px; cursor:pointer;">Import</button>
                  </div>
                </div>
                <div id="customActionsList_${fileWinId}">
                  <div style="font-size:0.7rem; color:#64748b; padding:0.25rem 0;">Loading actions...</div>
                </div>
                <button class="add-custom-action-card" id="addCustomActionBtn_${fileWinId}" style="margin-top:0.4rem; width:100%;">
                  <div style="display:flex; align-items:center; gap:0.5rem; color:#38bdf8; font-size:0.75rem; font-weight:600;">
                    <svg style="width:14px; height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>+ Add Custom Action</span>
                  </div>
                </button>
              </div>
            `;

            const wire = (id, fn) => {
              const btn = propsContent.querySelector(`#${id}_${fileWinId}`);
              if (btn) btn.onclick = fn;
            };

            wire('propBtn_cur_newfile', () => showCreateItemModal('file'));
            wire('propBtn_cur_newdir', () => showCreateItemModal('dir'));
            wire('propBtn_cur_upload', () => fileInput.click());
            wire('propBtn_cur_upload_folder', () => folderInput.click());
            wire('propBtn_cur_term', () => DesktopApps.launch('terminal', { path: currentPath, newWindow: true }));
            wire('propBtn_cur_code', () => DesktopApps.launch('code', { root: currentPath, isDir: true }));
            wire('propBtn_cur_refresh', () => loadDir(currentPath, false));

            // Load Custom Actions matching current directory
            loadCustomActions('directory', '', currentPath, [currentPath]);
          }
        };

        const updateSelectionUI = () => {
          const count = selectedPaths.size;
          if (count > 0) {
            actionBar.style.display = 'flex';
            actionCount.textContent = `${count} selected`;
            stSelected.style.display = 'inline';
            stSelected.textContent = `${count} selected`;
            
            // Check if any selected item is an archive
            let hasArchive = false;
            for (const p of selectedPaths) {
              if (isArchive(p)) { hasArchive = true; break; }
            }
            batchExtractBtn.style.display = hasArchive ? 'inline-flex' : 'none';
          } else {
            actionBar.style.display = 'none';
            stSelected.style.display = 'none';
          }

          // Sync checkbox states
          bodyEl.querySelectorAll('input[data-item-cb]').forEach(cb => {
            cb.checked = selectedPaths.has(cb.dataset.path);
          });
          if (selectAllCb) {
            selectAllCb.checked = (items.length > 0 && selectedPaths.size === items.length);
          }

          updatePropertiesPane();
        };

        const loadDir = async (path, pushToHistory = true) => {
          try {
            if (pushToHistory && currentPath && currentPath !== path) {
              historyBack.push(currentPath);
              historyFwd = [];
            }
            selectedPaths.clear();
            updateSelectionUI();

            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);"><span class="spinner-border spinner-border-sm" style="margin-right:8px;"></span>Loading files...</td></tr>`;
            gridView.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">Loading files...</div>`;

            const resp = await fetch(`/api/servers/${this.serverId}/files/list?path=${encodeURIComponent(path)}`);
            const res = await resp.json();
            if (!res.success) {
              if (path !== '/') return loadDir('/', false);
              alert('SFTP Error: ' + res.error);
              return;
            }
            currentPath = res.data.current_path;
            parentPath = res.data.parent_path;
            items = res.data.items || [];
            stPath.textContent = currentPath;
            pathInput.value = currentPath;
            winObj.titleEl.textContent = `Files: ${currentPath} - ${this.serverName}`;

            bodyEl.querySelectorAll('.places-item').forEach(el => {
              el.classList.toggle('active', el.dataset.path === currentPath);
            });

            renderBreadcrumb(currentPath);
            renderViews();
            updatePropertiesPane();
          } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--accent-rose);">Error: ${e}</td></tr>`;
            gridView.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--accent-rose);">Error: ${e}</div>`;
          }
        };

        const renderBreadcrumb = (path) => {
          const parts = path.split('/').filter(p => p.length > 0);
          let html = `<span class="bc-segment" style="cursor:pointer; font-weight:700; color:var(--accent-primary);" data-path="/">/</span>`;
          let acc = '';
          for (let i = 0; i < parts.length; i++) {
            acc += '/' + parts[i];
            const t = acc;
            html += `<span style="color:var(--text-muted); margin:0 3px;">/</span><span class="bc-segment" style="cursor:pointer; color:var(--text-secondary);" data-path="${t}">${parts[i]}</span>`;
          }
          bc.innerHTML = html;
        };

        const renderViews = () => {
          const q = (bodyEl.querySelector(`#search_${fileWinId}`).value || '').toLowerCase().trim();
          let filtered = showHidden ? items : items.filter(i => !i.name.startsWith('.'));
          if (q) filtered = filtered.filter(i => i.name.toLowerCase().includes(q));

          stCount.textContent = `${filtered.length} items`;

          if (viewMode === 'list') {
            listView.style.display = 'block';
            gridView.style.display = 'none';

            if (filtered.length === 0) {
              tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:3rem; color:var(--text-muted);">Folder is empty</td></tr>`;
              return;
            }

            tbody.innerHTML = filtered.map(item => {
              const icon = renderItemIcon(item, 18);
              const checked = selectedPaths.has(item.path) ? 'checked' : '';

              return `
                <tr class="file-row ${selectedPaths.has(item.path) ? 'selected' : ''}" style="cursor:pointer; user-select:none;" data-path="${item.path}" data-is-dir="${item.is_dir}">
                  <td class="file-cb-cell" style="text-align:center; width:38px; cursor:pointer;">
                    <input type="checkbox" data-item-cb data-path="${item.path}" ${checked}>
                  </td>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.55rem; min-width:0;">
                      ${icon}
                      <span class="file-name-text" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.name)}</span>
                    </div>
                  </td>
                  <td><span class="file-size-text">${item.size_formatted}</span></td>
                  <td><span class="file-mtime-text">${item.mtime}</span></td>
                </tr>
              `;
            }).join('');
          } else {
            listView.style.display = 'none';
            gridView.style.display = 'grid';

            if (filtered.length === 0) {
              gridView.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">Folder is empty</div>`;
              return;
            }

            gridView.innerHTML = filtered.map(item => {
              const icon = renderItemIcon(item, 34);
              const isSel = selectedPaths.has(item.path);
              return `
                <div class="files-grid-item ${isSel ? 'selected' : ''}" data-path="${item.path}" data-is-dir="${item.is_dir}" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:0.75rem 0.5rem; border-radius:var(--radius-sm); border:1px solid ${isSel ? 'rgba(255, 255, 255, 0.2)' : 'transparent'}; background:${isSel ? 'rgba(255, 255, 255, 0.08)' : 'transparent'}; cursor:pointer; position:relative; user-select:none; transition:all 0.15s ease;">
                  <div class="files-grid-cb-wrap" style="position:absolute; top:4px; left:4px; padding:4px; cursor:pointer;">
                    <input type="checkbox" data-item-cb data-path="${item.path}" ${isSel ? 'checked' : ''}>
                  </div>
                  <div style="margin-bottom:0.4rem;">${icon}</div>
                  <div style="font-size:0.75rem; font-weight:500; color:var(--text-primary); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</div>
                  <div style="font-size:0.68rem; color:var(--text-muted); font-family:var(--font-mono);">${item.size_formatted}</div>
                </div>
              `;
            }).join('');
          }

          updateSelectionUI();
        };

        // Click & Selection Handling (Without destroying DOM elements)
        const updateRowHighlights = () => {
          bodyEl.querySelectorAll('.file-row, .files-grid-item').forEach(el => {
            const p = el.dataset.path;
            const isSel = selectedPaths.has(p);
            el.classList.toggle('selected', isSel);
            const cb = el.querySelector('input[data-item-cb]');
            if (cb) cb.checked = isSel;
          });
          updateSelectionUI();
        };

        const handleItemSelect = (path, isMulti) => {
          if (isMulti) {
            if (selectedPaths.has(path)) selectedPaths.delete(path);
            else selectedPaths.add(path);
          } else {
            selectedPaths.clear();
            selectedPaths.add(path);
          }
          updateRowHighlights();
        };

        // Checkbox change listener
        bodyEl.addEventListener('change', (e) => {
          const cb = e.target.closest('input[data-item-cb]');
          if (cb) {
            const p = cb.dataset.path;
            if (cb.checked) {
              selectedPaths.add(p);
            } else {
              selectedPaths.delete(p);
            }
            updateRowHighlights();
          }
        });

        bodyEl.addEventListener('click', (e) => {
          // 1. Checkbox click or Checkbox cell padding click
          const cb = e.target.closest('input[data-item-cb]');
          if (cb) {
            e.stopPropagation();
            const p = cb.dataset.path;
            if (cb.checked) {
              selectedPaths.add(p);
            } else {
              selectedPaths.delete(p);
            }
            updateRowHighlights();
            return;
          }

          const cbCell = e.target.closest('.file-cb-cell, .files-grid-cb-wrap');
          if (cbCell) {
            e.stopPropagation();
            const innerCb = cbCell.querySelector('input[data-item-cb]');
            if (innerCb) {
              innerCb.checked = !innerCb.checked;
              const p = innerCb.dataset.path;
              if (innerCb.checked) selectedPaths.add(p);
              else selectedPaths.delete(p);
              updateRowHighlights();
            }
            return;
          }

          // 2. Edit in Code Workspace
          const editBtn = e.target.closest('.edit-file-btn');
          if (editBtn) {
            e.stopPropagation();
            DesktopApps.launch('code', { path: editBtn.dataset.path, isDir: false });
            return;
          }

          // 3. Extract Archive
          const extractBtn = e.target.closest('.extract-btn');
          if (extractBtn) {
            e.stopPropagation();
            extractArchive(extractBtn.dataset.path, currentPath);
            return;
          }

          // 3b. Image Preview
          const prevImgBtn = e.target.closest('.preview-img-btn');
          if (prevImgBtn) {
            e.stopPropagation();
            const p = prevImgBtn.dataset.path;
            const item = items.find(i => i.path === p);
            if (item) showImagePreviewModal(item);
            return;
          }

          // 3c. Copy Item
          const copyItemBtn = e.target.closest('.copy-item-btn');
          if (copyItemBtn) {
            e.stopPropagation();
            showCopyMoveModal([copyItemBtn.dataset.path], 'copy');
            return;
          }

          // 3d. Move Item
          const moveItemBtn = e.target.closest('.move-item-btn');
          if (moveItemBtn) {
            e.stopPropagation();
            showCopyMoveModal([moveItemBtn.dataset.path], 'move');
            return;
          }

          // 4. Rename
          const renBtn = e.target.closest('.rename-item-btn');
          if (renBtn) {
            e.stopPropagation();
            const p = renBtn.dataset.path;
            const item = items.find(i => i.path === p);
            if (item) showRenameModal(item);
            return;
          }

          // 5. Delete
          const delBtn = e.target.closest('.del-item-btn');
          if (delBtn) {
            e.stopPropagation();
            showDeleteModal([delBtn.dataset.path], delBtn.dataset.dir === 'true');
            return;
          }

          // 6. Terminal Here
          const termBtn = e.target.closest('.term-here-btn');
          if (termBtn) {
            e.stopPropagation();
            DesktopApps.launch('terminal', { path: termBtn.dataset.path, newWindow: true });
            return;
          }

          // 7. Normal row or grid item selection
          const row = e.target.closest('.file-row, .files-grid-item');
          if (row && !e.target.closest('button, a, input')) {
            handleItemSelect(row.dataset.path, e.ctrlKey || e.metaKey || e.shiftKey);
          }
        });

        // Double click navigation / open
        const handleItemOpen = (path, isDir) => {
          if (isDir) {
            loadDir(path);
          } else {
            const item = items.find(i => i.path === path);
            if (item && isImage(item.name)) {
              showImagePreviewModal(item);
            } else {
              DesktopApps.launch('code', { path });
            }
          }
        };

        const vp = bodyEl.querySelector(`#vp_${fileWinId}`);

        vp.addEventListener('dblclick', (e) => {
          const row = e.target.closest('.file-row, .files-grid-item');
          if (!row) return;
          const isDir = row.dataset.isDir === 'true';
          const p = row.dataset.path;
          handleItemOpen(p, isDir);
        });

        // Keyboard Navigation inside File Manager
        bodyEl.addEventListener('keydown', (e) => {
          if (e.target.matches('input, textarea')) return;

          if (e.key === 'Enter') {
            if (selectedPaths.size === 1) {
              const p = Array.from(selectedPaths)[0];
              const item = items.find(i => i.path === p);
              if (item) handleItemOpen(item.path, item.is_dir);
            }
          } else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
            e.preventDefault();
            if (historyBack.length > 0) {
              historyFwd.push(currentPath);
              const prev = historyBack.pop();
              loadDir(prev, false);
            }
          } else if (e.altKey && e.key === 'ArrowUp') {
            e.preventDefault();
            if (parentPath) loadDir(parentPath);
          } else if (e.key === 'F2') {
            e.preventDefault();
            if (selectedPaths.size === 1) {
              const p = Array.from(selectedPaths)[0];
              const item = items.find(i => i.path === p);
              if (item) showRenameModal(item);
            }
          } else if (e.key === 'Delete') {
            e.preventDefault();
            if (selectedPaths.size > 0) showDeleteModal(Array.from(selectedPaths));
          }
        });

        // Breadcrumb clicks
        bc.onclick = (e) => {
          const seg = e.target.closest('.bc-segment');
          if (seg) loadDir(seg.dataset.path);
        };

        // Address Bar: Click to edit
        const enablePathInput = () => {
          bc.style.display = 'none';
          editPathBtn.style.display = 'none';
          pathInput.style.display = 'block';
          pathInput.value = currentPath;
          pathInput.focus();
          pathInput.select();
        };

        const disablePathInput = () => {
          pathInput.style.display = 'none';
          bc.style.display = 'flex';
          editPathBtn.style.display = 'inline-flex';
        };

        editPathBtn.onclick = enablePathInput;
        addressWrap.ondblclick = enablePathInput;

        pathInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const newP = pathInput.value.trim();
            disablePathInput();
            if (newP) loadDir(newP);
          } else if (e.key === 'Escape') {
            disablePathInput();
          }
        });

        pathInput.addEventListener('blur', disablePathInput);

        // History Back / Forward
        bodyEl.querySelector(`#backBtn_${fileWinId}`).onclick = () => {
          if (historyBack.length > 0) {
            historyFwd.push(currentPath);
            const prev = historyBack.pop();
            loadDir(prev, false);
          }
        };

        bodyEl.querySelector(`#fwdBtn_${fileWinId}`).onclick = () => {
          if (historyFwd.length > 0) {
            historyBack.push(currentPath);
            const next = historyFwd.pop();
            loadDir(next, false);
          }
        };

        bodyEl.querySelector(`#upBtn_${fileWinId}`).onclick = () => { if (parentPath) loadDir(parentPath); };
        bodyEl.querySelector(`#refreshBtn_${fileWinId}`).onclick = () => loadDir(currentPath, false);

        // Places Sidebar links
        bodyEl.querySelectorAll('.places-item').forEach(el => {
          el.onclick = () => loadDir(el.dataset.path);
        });

        // Hidden files & Search
        bodyEl.querySelector(`#hiddenBtn_${fileWinId}`).onclick = () => {
          showHidden = !showHidden;
          renderViews();
        };

        bodyEl.querySelector(`#search_${fileWinId}`).oninput = () => {
          renderViews();
        };

        // View Mode Toggle (List vs Grid)
        const vListBtn = bodyEl.querySelector(`#viewListBtn_${fileWinId}`);
        const vGridBtn = bodyEl.querySelector(`#viewGridBtn_${fileWinId}`);
        vListBtn.onclick = () => {
          viewMode = 'list';
          vListBtn.classList.add('active');
          vGridBtn.classList.remove('active');
          renderViews();
        };
        vGridBtn.onclick = () => {
          viewMode = 'grid';
          vGridBtn.classList.add('active');
          vListBtn.classList.remove('active');
          renderViews();
        };

        // Select All Checkbox
        if (selectAllCb) {
          selectAllCb.onchange = () => {
            if (selectAllCb.checked) {
              items.forEach(i => selectedPaths.add(i.path));
            } else {
              selectedPaths.clear();
            }
            updateRowHighlights();
          };
        }

        bodyEl.querySelector(`#clearSelectBtn_${fileWinId}`).onclick = () => {
          selectedPaths.clear();
          updateRowHighlights();
        };

        // Custom Context Menu Implementation (Replaces native browser menu inside File Manager)
        let activeCtxMenu = null;
        const hideContextMenu = () => {
          if (activeCtxMenu && activeCtxMenu.parentNode) {
            activeCtxMenu.parentNode.removeChild(activeCtxMenu);
          }
          activeCtxMenu = null;
        };

        document.addEventListener('pointerdown', (e) => {
          if (activeCtxMenu && !e.target.closest('.file-context-menu')) {
            hideContextMenu();
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') hideContextMenu();
        });

        const showContextMenu = (x, y, itemsHtml) => {
          hideContextMenu();
          const menu = document.createElement('div');
          menu.className = 'file-context-menu';
          menu.innerHTML = itemsHtml;
          document.body.appendChild(menu);
          activeCtxMenu = menu;

          // Clamped positioning so menu never clips off viewport edges
          const menuW = 205;
          const menuH = menu.offsetHeight || 260;
          const clampedX = Math.min(x, window.innerWidth - menuW - 12);
          const clampedY = Math.min(y, window.innerHeight - menuH - 12);
          menu.style.left = `${Math.max(10, clampedX)}px`;
          menu.style.top = `${Math.max(10, clampedY)}px`;
        };

        // Right-Click Context Menu Trigger on Viewport
        vp.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();

          const row = e.target.closest('.file-row, .files-grid-item');
          if (row) {
            const p = row.dataset.path;
            if (!selectedPaths.has(p)) {
              selectedPaths.clear();
              selectedPaths.add(p);
              updateRowHighlights();
            }

            // Case A: Multi-Selection Context Menu (> 1 items)
            if (selectedPaths.size > 1) {
              const selectedList = Array.from(selectedPaths);
              const selectedItems = items.filter(i => selectedPaths.has(i.path));
              const hasArchives = selectedItems.some(i => isArchive(i.name));
              const count = selectedPaths.size;

              showContextMenu(e.clientX, e.clientY, `
                <div class="file-context-header" style="padding: 0.35rem 0.65rem; font-size: 0.68rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.06);">
                  ${count} Items Selected
                </div>
                <div class="file-context-item" id="ctx_multi_code">
                  <svg viewBox="0 0 24 24" fill="none"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                  <span>Open in Code Workspace</span>
                </div>
                <div class="file-context-item" id="ctx_multi_copy">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy (${count} items)...</span>
                </div>
                <div class="file-context-item" id="ctx_multi_move">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                  <span>Move (${count} items)...</span>
                </div>
                <div class="file-context-item" id="ctx_multi_compress">
                  <svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                  <span>Compress (${count} items)</span>
                </div>
                <div class="file-context-item" id="ctx_multi_download">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <span>Download as Archive (${count} items)</span>
                </div>
                ${hasArchives ? `
                  <div class="file-context-item" id="ctx_multi_extract">
                    <svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline></svg>
                    <span>Extract Archive(s)</span>
                  </div>
                ` : ''}
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="ctx_multi_copy_paths">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy Paths</span>
                </div>
                <div class="file-context-item" id="ctx_multi_properties">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  <span>Properties</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item danger" id="ctx_multi_delete">
                  <svg viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                  <span>Delete (${count} items)</span>
                </div>
              `);

              activeCtxMenu.querySelector('#ctx_multi_code').onclick = () => {
                hideContextMenu();
                const filesOnly = selectedItems.filter(i => !i.is_dir).map(i => i.path);
                const dirsOnly = selectedItems.filter(i => i.is_dir).map(i => i.path);
                if (dirsOnly.length > 0 && filesOnly.length === 0) {
                  DesktopApps.launch('code', { root: dirsOnly[0], isDir: true });
                } else if (filesOnly.length > 0) {
                  DesktopApps.launch('code', { paths: filesOnly });
                }
              };
              activeCtxMenu.querySelector('#ctx_multi_copy').onclick = () => {
                hideContextMenu();
                showCopyMoveModal(selectedList, 'copy');
              };
              activeCtxMenu.querySelector('#ctx_multi_move').onclick = () => {
                hideContextMenu();
                showCopyMoveModal(selectedList, 'move');
              };
              activeCtxMenu.querySelector('#ctx_multi_compress').onclick = () => {
                hideContextMenu();
                showCompressModal(selectedList, 'selection_archive');
              };
              activeCtxMenu.querySelector('#ctx_multi_download').onclick = () => {
                hideContextMenu();
                downloadItemsAsArchive(selectedList, 'selected_files.tar.gz');
              };
              if (hasArchives) {
                activeCtxMenu.querySelector('#ctx_multi_extract').onclick = () => {
                  hideContextMenu();
                  selectedItems.filter(i => isArchive(i.name)).forEach(i => extractArchive(i.path, currentPath));
                };
              }
              activeCtxMenu.querySelector('#ctx_multi_copy_paths').onclick = () => {
                hideContextMenu();
                navigator.clipboard.writeText(selectedList.join('\n'));
                if (window.showToast) window.showToast(`Copied ${count} paths to clipboard`, 'info');
              };
              activeCtxMenu.querySelector('#ctx_multi_properties').onclick = () => {
                hideContextMenu();
                isPropsOpen = true;
                if (propsPanel) propsPanel.style.display = 'flex';
                if (togglePropsBtn) togglePropsBtn.classList.add('active');
                updatePropertiesPane();
              };
              activeCtxMenu.querySelector('#ctx_multi_delete').onclick = () => {
                hideContextMenu();
                showDeleteModal(selectedList);
              };
              return;
            }

            // Case B: Single Item Context Menu
            const item = items.find(i => i.path === p);
            if (!item) return;

            if (item.is_dir) {
              // Folder Context Menu
              showContextMenu(e.clientX, e.clientY, `
                <div class="file-context-item" id="ctx_open">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  <span>Open Folder</span>
                </div>
                <div class="file-context-item" id="ctx_code">
                  <svg viewBox="0 0 24 24" fill="none"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                  <span>Open in Code Workspace</span>
                </div>
                <div class="file-context-item" id="ctx_term">
                  <svg viewBox="0 0 24 24" fill="none"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                  <span>Open Terminal Here</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="ctx_copy_folder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy Folder...</span>
                </div>
                <div class="file-context-item" id="ctx_move_folder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                  <span>Move Folder...</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="ctx_upload">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span>Upload Here</span>
                </div>
                <div class="file-context-item" id="ctx_download_archive">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span>Download as Archive</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="ctx_rename">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                  <span>Rename</span>
                </div>
                <div class="file-context-item" id="ctx_compress">
                  <svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                  <span>Compress (Archive)</span>
                </div>
                <div class="file-context-item" id="ctx_copy_path">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy Path</span>
                </div>
                <div class="file-context-item" id="ctx_properties">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  <span>Properties</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item danger" id="ctx_delete">
                  <svg viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                  <span>Delete Folder</span>
                </div>
              `);

              activeCtxMenu.querySelector('#ctx_open').onclick = () => { hideContextMenu(); loadDir(item.path); };
              activeCtxMenu.querySelector('#ctx_code').onclick = () => { hideContextMenu(); DesktopApps.launch('code', { root: item.path, isDir: true }); };
              activeCtxMenu.querySelector('#ctx_term').onclick = () => { hideContextMenu(); DesktopApps.launch('terminal', { path: item.path, newWindow: true }); };
              activeCtxMenu.querySelector('#ctx_copy_folder').onclick = () => { hideContextMenu(); showCopyMoveModal([item.path], 'copy'); };
              activeCtxMenu.querySelector('#ctx_move_folder').onclick = () => { hideContextMenu(); showCopyMoveModal([item.path], 'move'); };
              activeCtxMenu.querySelector('#ctx_upload').onclick = () => { hideContextMenu(); fileInput.click(); };
              activeCtxMenu.querySelector('#ctx_download_archive').onclick = () => { hideContextMenu(); downloadItemsAsArchive([item.path], item.name + '.tar.gz'); };
              activeCtxMenu.querySelector('#ctx_rename').onclick = () => { hideContextMenu(); showRenameModal(item); };
              activeCtxMenu.querySelector('#ctx_compress').onclick = () => { hideContextMenu(); showCompressModal([item.path], item.name); };
              activeCtxMenu.querySelector('#ctx_copy_path').onclick = () => {
                hideContextMenu();
                navigator.clipboard.writeText(item.path);
                if (window.showToast) window.showToast('Copied path to clipboard', 'info');
              };
              activeCtxMenu.querySelector('#ctx_properties').onclick = () => {
                hideContextMenu();
                isPropsOpen = true;
                if (propsPanel) propsPanel.style.display = 'flex';
                if (togglePropsBtn) togglePropsBtn.classList.add('active');
                updatePropertiesPane();
              };
              activeCtxMenu.querySelector('#ctx_delete').onclick = () => {
                hideContextMenu();
                showDeleteModal([item.path], true);
              };
            } else {
              // File Context Menu
              const archive = isArchive(item.name);
              const image = isImage(item.name);
              showContextMenu(e.clientX, e.clientY, `
                ${image ? `
                  <div class="file-context-item" id="ctx_preview_image" style="color:#38bdf8; font-weight:600;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <span>Preview Image</span>
                  </div>
                ` : ''}
                <div class="file-context-item" id="ctx_edit">
                  <svg viewBox="0 0 24 24" fill="none"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                  <span>Open in Code Workspace</span>
                </div>
                <div class="file-context-item" id="ctx_download">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span>Download File</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="ctx_copy_file">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy File...</span>
                </div>
                <div class="file-context-item" id="ctx_move_file">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                  <span>Move File...</span>
                </div>
                ${archive ? `
                  <div class="file-context-item" id="ctx_extract_here">
                    <svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline></svg>
                    <span>Extract Here</span>
                  </div>
                  <div class="file-context-item" id="ctx_extract_folder">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    <span>Extract to Folder</span>
                  </div>
                ` : ''}
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="ctx_rename">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                  <span>Rename</span>
                </div>
                <div class="file-context-item" id="ctx_compress">
                  <svg viewBox="0 0 24 24" fill="none"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                  <span>Compress (Archive)</span>
                </div>
                <div class="file-context-item" id="ctx_copy_path">
                  <svg viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy Path</span>
                </div>
                <div class="file-context-item" id="ctx_properties">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  <span>Properties</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item danger" id="ctx_delete">
                  <svg viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                  <span>Delete File</span>
                </div>
              `);

              if (image) {
                activeCtxMenu.querySelector('#ctx_preview_image').onclick = () => {
                  hideContextMenu();
                  showImagePreviewModal(item);
                };
              }
              activeCtxMenu.querySelector('#ctx_edit').onclick = () => { hideContextMenu(); DesktopApps.launch('code', { path: item.path, isDir: false }); };
              activeCtxMenu.querySelector('#ctx_download').onclick = () => {
                hideContextMenu();
                window.location.href = `/api/servers/${this.serverId}/files/download?path=${encodeURIComponent(item.path)}`;
              };
              activeCtxMenu.querySelector('#ctx_copy_file').onclick = () => { hideContextMenu(); showCopyMoveModal([item.path], 'copy'); };
              activeCtxMenu.querySelector('#ctx_move_file').onclick = () => { hideContextMenu(); showCopyMoveModal([item.path], 'move'); };
              if (archive) {
                activeCtxMenu.querySelector('#ctx_extract_here').onclick = () => { hideContextMenu(); extractArchive(item.path, currentPath); };
                activeCtxMenu.querySelector('#ctx_extract_folder').onclick = () => {
                  hideContextMenu();
                  const folderName = item.name.replace(/\.(zip|tar\.gz|tgz|tar|gz)$/i, '');
                  const destFolder = (currentPath === '/' ? '' : currentPath) + '/' + folderName;
                  extractArchive(item.path, destFolder);
                };
              }
              activeCtxMenu.querySelector('#ctx_rename').onclick = () => { hideContextMenu(); showRenameModal(item); };
              activeCtxMenu.querySelector('#ctx_compress').onclick = () => { hideContextMenu(); showCompressModal([item.path], item.name); };
              activeCtxMenu.querySelector('#ctx_copy_path').onclick = () => {
                hideContextMenu();
                navigator.clipboard.writeText(item.path);
                if (window.showToast) window.showToast('Copied path to clipboard', 'info');
              };
              activeCtxMenu.querySelector('#ctx_properties').onclick = () => {
                hideContextMenu();
                isPropsOpen = true;
                if (propsPanel) propsPanel.style.display = 'flex';
                if (togglePropsBtn) togglePropsBtn.classList.add('active');
                updatePropertiesPane();
              };
              activeCtxMenu.querySelector('#ctx_delete').onclick = () => {
                hideContextMenu();
                showDeleteModal([item.path], false);
              };
            }
          } else {
            // Background Empty Space Context Menu
            showContextMenu(e.clientX, e.clientY, `
              <div class="file-context-item" id="ctx_bg_refresh">
                <svg viewBox="0 0 24 24" fill="none"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                <span>Refresh Directory</span>
              </div>
              <div class="file-context-separator"></div>
              <div class="file-context-item" id="ctx_bg_newfile">
                <svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                <span>New File</span>
              </div>
              <div class="file-context-item" id="ctx_bg_newdir">
                <svg viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                <span>New Folder</span>
              </div>
              <div class="file-context-item" id="ctx_bg_upload">
                <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <span>Upload Files Here</span>
              </div>
              <div class="file-context-separator"></div>
              <div class="file-context-item" id="ctx_bg_terminal">
                <svg viewBox="0 0 24 24" fill="none"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                <span>Open Terminal in Directory</span>
              </div>
              <div class="file-context-item" id="ctx_bg_hidden">
                <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path></svg>
                <span>${showHidden ? 'Hide Hidden Files' : 'Show Hidden Files'}</span>
              </div>
              <div class="file-context-separator"></div>
              <div class="file-context-item" id="ctx_bg_properties">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                <span>Folder Properties</span>
              </div>
            `);

            activeCtxMenu.querySelector('#ctx_bg_refresh').onclick = () => { hideContextMenu(); loadDir(currentPath, false); };
            activeCtxMenu.querySelector('#ctx_bg_newfile').onclick = () => { hideContextMenu(); showCreateItemModal('file'); };
            activeCtxMenu.querySelector('#ctx_bg_newdir').onclick = () => { hideContextMenu(); showCreateItemModal('dir'); };
            activeCtxMenu.querySelector('#ctx_bg_upload').onclick = () => { hideContextMenu(); fileInput.click(); };
            activeCtxMenu.querySelector('#ctx_bg_terminal').onclick = () => { hideContextMenu(); DesktopApps.launch('terminal', { path: currentPath, newWindow: true }); };
            activeCtxMenu.querySelector('#ctx_bg_hidden').onclick = () => {
              hideContextMenu();
              showHidden = !showHidden;
              renderViews();
            };
            activeCtxMenu.querySelector('#ctx_bg_properties').onclick = () => {
              hideContextMenu();
              isPropsOpen = true;
              if (propsPanel) propsPanel.style.display = 'flex';
              if (togglePropsBtn) togglePropsBtn.classList.add('active');
              updatePropertiesPane();
            };
          }
        });

        // Dedicated Modal Helper for File Manager
        const showModal = (title, bodyHtml, onConfirm, confirmText = 'Confirm', isDanger = false) => {
          const appContainer = bodyEl.querySelector(`#fapp_${fileWinId}`);
          const backdrop = document.createElement('div');
          backdrop.className = 'file-modal-backdrop';
          backdrop.innerHTML = `
            <div class="file-modal-box">
              <div class="file-modal-header">
                <span class="file-modal-title">${title}</span>
                <button class="win-btn win-close" id="mClose_${fileWinId}">×</button>
              </div>
              <div class="file-modal-body">${bodyHtml}</div>
              <div class="file-modal-footer">
                <button class="btn btn-ghost btn-sm" id="mCancel_${fileWinId}">Cancel</button>
                <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'} btn-sm" id="mConfirm_${fileWinId}">${confirmText}</button>
              </div>
            </div>
          `;
          appContainer.appendChild(backdrop);

          const closeModal = () => {
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          };

          backdrop.querySelector(`#mClose_${fileWinId}`).onclick = closeModal;
          backdrop.querySelector(`#mCancel_${fileWinId}`).onclick = closeModal;

          const confirmBtn = backdrop.querySelector(`#mConfirm_${fileWinId}`);
          confirmBtn.onclick = async () => {
            confirmBtn.disabled = true;
            const ok = await onConfirm(backdrop);
            if (ok !== false) closeModal();
            else confirmBtn.disabled = false;
          };

          backdrop.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
            else if (e.key === 'Enter') {
              e.preventDefault();
              confirmBtn.click();
            }
          });

          return { backdrop, closeModal };
        };

        // Image Preview Modal
        const showImagePreviewModal = (item) => {
          const appContainer = bodyEl.querySelector(`#fapp_${fileWinId}`);
          const backdrop = document.createElement('div');
          backdrop.className = 'file-modal-backdrop image-viewer-backdrop';
          const imgUrl = `/api/servers/${this.serverId}/files/view?path=${encodeURIComponent(item.path)}`;
          const downloadUrl = `/api/servers/${this.serverId}/files/download?path=${encodeURIComponent(item.path)}`;

          backdrop.innerHTML = `
            <div class="file-modal-box image-preview-modal-box" style="max-width:88vw; width:820px; max-height:88vh; display:flex; flex-direction:column; overflow:hidden;">
              <div class="file-modal-header" style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 0.9rem; border-bottom:1px solid rgba(255,255,255,0.08); background:#111827;">
                <div style="display:flex; align-items:center; gap:0.6rem; min-width:0;">
                  <svg style="width:16px;height:16px;color:#38bdf8;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span style="font-weight:600; font-size:0.82rem; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name.replace(/</g, '&lt;')}</span>
                  <span style="font-family:var(--font-mono); font-size:0.72rem; color:#94a3b8; background:rgba(255,255,255,0.06); padding:0.15rem 0.45rem; border-radius:4px;">${item.size_formatted}</span>
                  <span id="imgDimensions_${fileWinId}" style="font-family:var(--font-mono); font-size:0.72rem; color:#38bdf8; display:none; background:rgba(56,189,248,0.1); padding:0.15rem 0.45rem; border-radius:4px;"></span>
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <a href="${downloadUrl}" class="btn btn-ghost btn-xs" title="Download Image" style="display:inline-flex; align-items:center; gap:4px;">
                    <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="3" x2="12" y2="3"></line></svg>
                    Download
                  </a>
                  <button class="win-btn win-close" id="imgPrevClose_${fileWinId}" style="margin-left:0.3rem;">×</button>
                </div>
              </div>
              <div class="image-preview-viewport" style="flex:1; display:flex; align-items:center; justify-content:center; overflow:auto; padding:1.25rem; background:#070a12; min-height:360px; max-height:calc(85vh - 90px);">
                <div id="imgLoadingSpin_${fileWinId}" style="display:flex; flex-direction:column; align-items:center; gap:0.6rem; color:#94a3b8; font-size:0.78rem;">
                  <span class="spinner-border spinner-border-sm" style="width:24px; height:24px;"></span>
                  Loading image preview...
                </div>
                <img id="previewImgEl_${fileWinId}" src="${imgUrl}" style="display:none; max-width:100%; max-height:100%; object-fit:contain; border-radius:4px; box-shadow:0 8px 32px rgba(0,0,0,0.7);" alt="${item.name.replace(/"/g, '&quot;')}">
              </div>
              <div style="padding:0.45rem 0.9rem; background:#0b101b; border-top:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between; font-size:0.72rem; color:#64748b;">
                <span style="font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:550px;">${item.path}</span>
                <button class="btn btn-ghost btn-xs" id="imgPrevDone_${fileWinId}">Close</button>
              </div>
            </div>
          `;
          appContainer.appendChild(backdrop);

          const closeViewer = () => {
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
          };

          backdrop.querySelector(`#imgPrevClose_${fileWinId}`).onclick = closeViewer;
          backdrop.querySelector(`#imgPrevDone_${fileWinId}`).onclick = closeViewer;
          backdrop.onclick = (e) => {
            if (e.target === backdrop) closeViewer();
          };

          const escHandler = (e) => {
            if (e.key === 'Escape') {
              closeViewer();
              document.removeEventListener('keydown', escHandler);
            }
          };
          document.addEventListener('keydown', escHandler);

          const imgEl = backdrop.querySelector(`#previewImgEl_${fileWinId}`);
          const spinEl = backdrop.querySelector(`#imgLoadingSpin_${fileWinId}`);
          const dimEl = backdrop.querySelector(`#imgDimensions_${fileWinId}`);

          imgEl.onload = () => {
            spinEl.style.display = 'none';
            imgEl.style.display = 'block';
            if (imgEl.naturalWidth && imgEl.naturalHeight) {
              dimEl.style.display = 'inline';
              dimEl.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight}px`;
            }
          };

          imgEl.onerror = () => {
            spinEl.innerHTML = `<span style="color:var(--accent-rose);">Failed to load image preview.</span>`;
          };
        };

        // Copy / Move Modal Dialog
        const showCopyMoveModal = (paths, action = 'copy') => {
          if (!paths || paths.length === 0) {
            if (window.showToast) window.showToast('Please select one or more files or folders first', 'warning');
            return;
          }
          const isCopy = action === 'copy';
          const count = paths.length;
          const title = `${isCopy ? 'Copy' : 'Move'} ${count} Item${count > 1 ? 's' : ''}`;

          const { backdrop } = showModal(
            title,
            `
              <div>
                <p style="margin:0 0 0.5rem 0; color:#f1f5f9; font-size:0.78rem;">
                  Choose destination folder on remote server:
                </p>
                <div style="display:flex; gap:0.4rem; margin-bottom:0.5rem;">
                  <input type="text" id="destDirInp_${fileWinId}" class="form-control" value="${currentPath}" style="flex:1; font-size:0.8rem; padding:0.35rem 0.6rem;" placeholder="/remote/destination/path">
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:0.3rem; margin-bottom:0.75rem;">
                  <button type="button" class="btn btn-ghost btn-xs dest-chip" data-dir="${currentPath}" style="font-size:0.7rem; border:1px solid rgba(255,255,255,0.1);">Current (${currentPath})</button>
                  ${parentPath ? `<button type="button" class="btn btn-ghost btn-xs dest-chip" data-dir="${parentPath}" style="font-size:0.7rem; border:1px solid rgba(255,255,255,0.1);">Parent (${parentPath})</button>` : ''}
                  <button type="button" class="btn btn-ghost btn-xs dest-chip" data-dir="~" style="font-size:0.7rem; border:1px solid rgba(255,255,255,0.1);">Home (~)</button>
                  <button type="button" class="btn btn-ghost btn-xs dest-chip" data-dir="/var/www" style="font-size:0.7rem; border:1px solid rgba(255,255,255,0.1);">/var/www</button>
                  <button type="button" class="btn btn-ghost btn-xs dest-chip" data-dir="/tmp" style="font-size:0.7rem; border:1px solid rgba(255,255,255,0.1);">/tmp</button>
                </div>
                <div style="font-size:0.72rem; color:#94a3b8; margin-bottom:0.3rem;">Selected item${count > 1 ? 's' : ''} to ${action}:</div>
                <div style="max-height:110px; overflow-y:auto; background:rgba(0,0,0,0.3); border:1px solid var(--border-subtle); border-radius:var(--radius-xs); padding:0.4rem 0.6rem; font-family:var(--font-mono); font-size:0.72rem; color:#cbd5e1; display:flex; flex-direction:column; gap:0.2rem;">
                  ${paths.map(p => `<div>• ${p.split('/').pop().replace(/</g, '&lt;')}</div>`).join('')}
                </div>
                <div id="copyMoveErr_${fileWinId}" style="display:none; color:var(--accent-rose); font-size:0.72rem; margin-top:0.4rem; padding:0.3rem 0.5rem; background:rgba(244,63,94,0.1); border-radius:4px;"></div>
              </div>
            `,
            async (modalEl) => {
              const destInp = modalEl.querySelector(`#destDirInp_${fileWinId}`);
              const errEl = modalEl.querySelector(`#copyMoveErr_${fileWinId}`);
              const targetDir = destInp.value.trim();
              if (!targetDir) {
                errEl.style.display = 'block';
                errEl.textContent = 'Destination directory is required';
                return false;
              }

              if (window.showToast) window.showToast(`${isCopy ? 'Copying' : 'Moving'} ${count} item(s)...`, 'info');

              try {
                const endpoint = `/api/servers/${this.serverId}/files/batch-${action}`;
                const resp = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ paths, dest_dir: targetDir })
                });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(`Successfully ${isCopy ? 'copied' : 'moved'} ${count} item(s)`, 'success');
                  selectedPaths.clear();
                  loadDir(currentPath, false);
                  return true;
                } else {
                  errEl.style.display = 'block';
                  errEl.textContent = res.error || `${isCopy ? 'Copy' : 'Move'} operation failed`;
                  return false;
                }
              } catch (e) {
                errEl.style.display = 'block';
                errEl.textContent = 'Network error: ' + e;
                return false;
              }
            },
            isCopy ? 'Copy Here' : 'Move Here'
          );

          // Wire destination quick chips
          backdrop.querySelectorAll('.dest-chip').forEach(chip => {
            chip.onclick = () => {
              const inp = backdrop.querySelector(`#destDirInp_${fileWinId}`);
              if (inp) inp.value = chip.dataset.dir;
            };
          });

          setTimeout(() => {
            const inp = backdrop.querySelector(`#destDirInp_${fileWinId}`);
            if (inp) { inp.focus(); inp.select(); }
          }, 60);
        };

        // Rename Modal Dialog (Section 6)
        const showRenameModal = (item) => {
          const { backdrop } = showModal(
            `Rename ${item.is_dir ? 'Directory' : 'File'}`,
            `
              <div>
                <label style="display:block; margin-bottom:0.4rem; color:var(--text-secondary); font-size:0.75rem;">Enter new name for <strong>${item.name.replace(/</g, '&lt;')}</strong>:</label>
                <input type="text" id="renameInp_${fileWinId}" class="form-control" value="${item.name.replace(/"/g, '&quot;')}" style="width:100%; font-size:0.8rem; padding:0.35rem 0.6rem;">
                <div id="renameErr_${fileWinId}" style="display:none; color:var(--accent-rose); font-size:0.72rem; margin-top:0.4rem; padding:0.3rem 0.5rem; background:rgba(244,63,94,0.1); border-radius:4px;"></div>
              </div>
            `,
            async (modalEl) => {
              const inp = modalEl.querySelector(`#renameInp_${fileWinId}`);
              const errEl = modalEl.querySelector(`#renameErr_${fileWinId}`);
              const newName = inp.value.trim();
              if (!newName) {
                errEl.style.display = 'block';
                errEl.textContent = 'Name cannot be empty';
                return false;
              }
              if (newName === item.name) return true; // unchanged

              // Check for conflict with existing items in current directory
              if (items.some(i => i.name === newName && i.path !== item.path)) {
                errEl.style.display = 'block';
                errEl.textContent = `An item named "${newName}" already exists in this folder.`;
                return false;
              }

              const dir = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
              const newPath = (dir === '/' ? '' : dir) + '/' + newName;

              try {
                const resp = await fetch(`/api/servers/${this.serverId}/files/rename`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ old_path: item.path, new_path: newPath })
                });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(`Renamed to "${newName}"`, 'success');
                  loadDir(currentPath, false);
                  return true;
                } else {
                  errEl.style.display = 'block';
                  errEl.textContent = res.error || 'Rename failed on remote server';
                  return false;
                }
              } catch (e) {
                errEl.style.display = 'block';
                errEl.textContent = 'Network error: ' + e;
                return false;
              }
            },
            'Rename'
          );

          setTimeout(() => {
            const inp = backdrop.querySelector(`#renameInp_${fileWinId}`);
            if (inp) {
              inp.focus();
              const lastDot = item.name.lastIndexOf('.');
              if (!item.is_dir && lastDot > 0) inp.setSelectionRange(0, lastDot);
              else inp.select();
            }
          }, 60);
        };

        // Compress Modal Dialog (Section 8)
        const showCompressModal = (paths, defaultName) => {
          const baseName = (defaultName || 'archive').replace(/\.[^.]+$/, '');
          const { backdrop } = showModal(
            `Compress ${paths.length} item(s)`,
            `
              <div>
                <label style="display:block; margin-bottom:0.3rem; color:var(--text-secondary); font-size:0.75rem;">Archive name:</label>
                <div style="display:flex; gap:0.4rem;">
                  <input type="text" id="archiveNameInp_${fileWinId}" class="form-control" value="${baseName}" style="flex:1; font-size:0.8rem; padding:0.35rem 0.6rem;">
                  <select id="archiveFmt_${fileWinId}" class="form-control" style="width:110px; font-size:0.78rem;">
                    <option value=".tar.gz">.tar.gz</option>
                    <option value=".zip">.zip</option>
                    <option value=".tar">.tar</option>
                  </select>
                </div>
                <div id="compressErr_${fileWinId}" style="display:none; color:var(--accent-rose); font-size:0.72rem; margin-top:0.4rem;"></div>
              </div>
            `,
            async (modalEl) => {
              const nameInp = modalEl.querySelector(`#archiveNameInp_${fileWinId}`);
              const fmtSel = modalEl.querySelector(`#archiveFmt_${fileWinId}`);
              const errEl = modalEl.querySelector(`#compressErr_${fileWinId}`);
              const rawName = nameInp.value.trim();
              if (!rawName) {
                errEl.style.display = 'block';
                errEl.textContent = 'Archive name cannot be empty';
                return false;
              }
              const fmt = fmtSel.value;
              const archiveFullName = rawName.endsWith(fmt) ? rawName : rawName + fmt;

              if (window.showToast) window.showToast('Compressing on remote server...', 'info');

              try {
                const resp = await fetch(`/api/servers/${this.serverId}/files/batch-archive`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    paths: paths,
                    dest_dir: currentPath,
                    archive_name: archiveFullName
                  })
                });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(`Created archive: ${archiveFullName}`, 'success');
                  loadDir(currentPath, false);
                  return true;
                } else {
                  errEl.style.display = 'block';
                  errEl.textContent = res.error || 'Compression failed';
                  return false;
                }
              } catch (e) {
                errEl.style.display = 'block';
                errEl.textContent = 'Compression error: ' + e;
                return false;
              }
            },
            'Compress'
          );

          setTimeout(() => {
            const inp = backdrop.querySelector(`#archiveNameInp_${fileWinId}`);
            if (inp) { inp.focus(); inp.select(); }
          }, 60);
        };

        // Extract Archive Function (Section 8)
        const extractArchive = async (archivePath, destDir) => {
          const archiveName = archivePath.split('/').pop();
          if (window.showToast) window.showToast(`Extracting "${archiveName}"...`, 'info');
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/files/extract`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ archive_path: archivePath, dest_dir: destDir || currentPath })
            });
            const res = await resp.json();
            if (res.success) {
              if (window.showToast) window.showToast(`Extracted ${archiveName}`, 'success');
              loadDir(currentPath, false);
            } else {
              alert('Extraction failed: ' + res.error);
            }
          } catch (e) {
            alert('Extraction error: ' + e);
          }
        };

        // Multi-Item Download as Archive (Section 10)
        const downloadItemsAsArchive = async (paths, archiveName = 'download.tar.gz') => {
          if (window.showToast) window.showToast('Preparing download archive on server...', 'info');
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/files/batch-archive`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paths, dest_dir: currentPath, archive_name: archiveName })
            });
            const res = await resp.json();
            if (res.success) {
              const fullArchivePath = (currentPath === '/' ? '' : currentPath) + '/' + archiveName;
              window.location.href = `/api/servers/${this.serverId}/files/download?path=${encodeURIComponent(fullArchivePath)}`;
              loadDir(currentPath, false);
            } else {
              alert('Download archive creation failed: ' + res.error);
            }
          } catch (e) {
            alert('Download archive error: ' + e);
          }
        };

        // Delete Confirmation Modal Dialog (Single or Batch)
        const showDeleteModal = (paths, isDir = null) => {
          if (!paths || paths.length === 0) return;
          const count = paths.length;
          const isSingle = count === 1;
          const singleItem = isSingle ? items.find(i => i.path === paths[0]) : null;
          const singleIsDir = isDir !== null ? isDir : (singleItem ? singleItem.is_dir : false);
          const singleName = isSingle ? paths[0].split('/').pop() : '';

          const title = isSingle
            ? `Delete ${singleIsDir ? 'Directory' : 'File'}`
            : `Delete ${count} Items`;

          const bodyHtml = `
            <div>
              <p style="margin:0 0 0.5rem 0; color:#f1f5f9; font-size:0.78rem;">
                ${isSingle
                  ? `Are you sure you want to permanently delete <strong>${singleName.replace(/</g, '&lt;')}</strong>?`
                  : `Are you sure you want to permanently delete the following <strong>${count}</strong> selected items?`
                }
              </p>
              ${!isSingle ? `
                <div style="max-height:130px; overflow-y:auto; background:rgba(0,0,0,0.3); border:1px solid var(--border-subtle); border-radius:var(--radius-xs); padding:0.45rem 0.65rem; font-family:var(--font-mono); font-size:0.72rem; color:#cbd5e1; display:flex; flex-direction:column; gap:0.25rem;">
                  ${paths.map(p => `<div>• ${p.split('/').pop().replace(/</g, '&lt;')}</div>`).join('')}
                </div>
              ` : ''}
              <div style="color:var(--accent-rose); font-size:0.72rem; margin-top:0.6rem; display:flex; align-items:center; gap:0.35rem;">
                <svg style="width:13px;height:13px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <span>Warning: This operation cannot be undone.</span>
              </div>
              <div id="deleteErr_${fileWinId}" style="display:none; color:var(--accent-rose); font-size:0.72rem; margin-top:0.4rem; padding:0.3rem 0.5rem; background:rgba(244,63,94,0.1); border-radius:4px;"></div>
            </div>
          `;

          const { backdrop } = showModal(
            title,
            bodyHtml,
            async (modalEl) => {
              const errEl = modalEl.querySelector(`#deleteErr_${fileWinId}`);
              try {
                let resp, res;
                if (isSingle) {
                  resp = await fetch(`/api/servers/${this.serverId}/files/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: paths[0], is_dir: singleIsDir })
                  });
                } else {
                  resp = await fetch(`/api/servers/${this.serverId}/files/batch-delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paths: paths })
                  });
                }
                res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(`Deleted ${isSingle ? `"${singleName}"` : `${count} items`}`, 'info');
                  paths.forEach(p => selectedPaths.delete(p));
                  loadDir(currentPath, false);
                  return true;
                } else {
                  errEl.style.display = 'block';
                  errEl.textContent = res.error || 'Delete failed on remote server';
                  return false;
                }
              } catch (e) {
                errEl.style.display = 'block';
                errEl.textContent = 'Network or server error: ' + e;
                return false;
              }
            },
            'Delete Permanently',
            true
          );
        };

        bodyEl.querySelector(`#batchDeleteBtn_${fileWinId}`).onclick = () => showDeleteModal(Array.from(selectedPaths));
        const batchCodeBtn = bodyEl.querySelector(`#batchCodeBtn_${fileWinId}`);
        if (batchCodeBtn) {
          batchCodeBtn.onclick = () => {
            if (selectedPaths.size === 0) return;
            const selectedList = Array.from(selectedPaths);
            const filesOnly = items.filter(i => selectedPaths.has(i.path) && !i.is_dir).map(i => i.path);
            const dirsOnly = items.filter(i => selectedPaths.has(i.path) && i.is_dir).map(i => i.path);
            if (dirsOnly.length > 0 && filesOnly.length === 0) {
              DesktopApps.launch('code', { root: dirsOnly[0], isDir: true });
            } else if (filesOnly.length > 0) {
              DesktopApps.launch('code', { paths: filesOnly });
            } else {
              DesktopApps.launch('code', { paths: selectedList });
            }
          };
        }

        // Batch Extract Button
        batchExtractBtn.onclick = () => {
          for (const p of selectedPaths) {
            if (isArchive(p)) {
              extractArchive(p, currentPath);
              break;
            }
          }
        };

        // Create File / Folder Dialog Modals
        const showCreateItemModal = (type) => {
          const isDir = type === 'dir';
          const { backdrop } = showModal(
            isDir ? 'New Folder' : 'New File',
            `
              <div>
                <label style="display:block; margin-bottom:0.35rem; color:var(--text-secondary); font-size:0.75rem;">Enter name:</label>
                <input type="text" id="createInp_${fileWinId}" class="form-control" placeholder="${isDir ? 'folder_name' : 'new_file.txt'}" style="width:100%; font-size:0.8rem; padding:0.35rem 0.6rem;">
                <div id="createErr_${fileWinId}" style="display:none; color:var(--accent-rose); font-size:0.72rem; margin-top:0.4rem;"></div>
              </div>
            `,
            async (modalEl) => {
              const inp = modalEl.querySelector(`#createInp_${fileWinId}`);
              const errEl = modalEl.querySelector(`#createErr_${fileWinId}`);
              const name = inp.value.trim();
              if (!name) {
                errEl.style.display = 'block';
                errEl.textContent = 'Name cannot be empty';
                return false;
              }
              const fullPath = (currentPath === '/' ? '' : currentPath) + '/' + name;
              try {
                const resp = await fetch(`/api/servers/${this.serverId}/files/create`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: fullPath, type })
                });
                const res = await resp.json();
                if (res.success) {
                  loadDir(currentPath, false);
                  if (!isDir) DesktopApps.launch('code', { path: fullPath });
                  return true;
                } else {
                  errEl.style.display = 'block';
                  errEl.textContent = res.error || 'Creation failed';
                  return false;
                }
              } catch (e) {
                errEl.style.display = 'block';
                errEl.textContent = 'Error: ' + e;
                return false;
              }
            },
            'Create'
          );

          setTimeout(() => {
            const inp = backdrop.querySelector(`#createInp_${fileWinId}`);
            if (inp) inp.focus();
          }, 60);
        };

        bodyEl.querySelector(`#newFileBtn_${fileWinId}`).onclick = () => showCreateItemModal('file');
        bodyEl.querySelector(`#newDirBtn_${fileWinId}`).onclick = () => showCreateItemModal('dir');

        const copyBtn = bodyEl.querySelector(`#copyBtn_${fileWinId}`);
        if (copyBtn) {
          copyBtn.onclick = () => {
            const paths = selectedPaths.size > 0 ? Array.from(selectedPaths) : [];
            showCopyMoveModal(paths, 'copy');
          };
        }

        const moveBtn = bodyEl.querySelector(`#moveBtn_${fileWinId}`);
        if (moveBtn) {
          moveBtn.onclick = () => {
            const paths = selectedPaths.size > 0 ? Array.from(selectedPaths) : [];
            showCopyMoveModal(paths, 'move');
          };
        }

        const batchCopyBtn = bodyEl.querySelector(`#batchCopyBtn_${fileWinId}`);
        if (batchCopyBtn) {
          batchCopyBtn.onclick = () => showCopyMoveModal(Array.from(selectedPaths), 'copy');
        }

        const batchMoveBtn = bodyEl.querySelector(`#batchMoveBtn_${fileWinId}`);
        if (batchMoveBtn) {
          batchMoveBtn.onclick = () => showCopyMoveModal(Array.from(selectedPaths), 'move');
        }

        // (Single item action buttons delegated in primary bodyEl click handler)

        // Upload Handling with Interactive Conflict Modal (Section 9)
        const uploadBox = bodyEl.querySelector(`#uploadProgressBox_${fileWinId}`);
        const uploadBar = bodyEl.querySelector(`#uploadProgressBar_${fileWinId}`);
        const uploadStatus = bodyEl.querySelector(`#uploadStatusText_${fileWinId}`);

        const showUploadConflictModal = (conflicts, onChoice) => {
          const appContainer = bodyEl.querySelector(`#fapp_${fileWinId}`);
          const backdrop = document.createElement('div');
          backdrop.className = 'file-modal-backdrop';
          backdrop.innerHTML = `
            <div class="file-modal-box">
              <div class="file-modal-header">
                <span class="file-modal-title">File Conflict Notice</span>
                <button class="win-btn win-close" id="confClose">×</button>
              </div>
              <div class="file-modal-body">
                <p style="margin:0; font-size:0.78rem;">The following file(s) already exist in this folder:</p>
                <div style="max-height:120px; overflow-y:auto; background:rgba(0,0,0,0.3); padding:0.5rem; border-radius:var(--radius-xs); font-family:var(--font-mono); font-size:0.72rem; color:#38bdf8;">
                  ${conflicts.map(c => `<div>• ${c}</div>`).join('')}
                </div>
                <p style="margin:0; font-size:0.74rem; color:var(--text-muted);">How would you like to handle this conflict?</p>
              </div>
              <div class="file-modal-footer" style="flex-wrap:wrap;">
                <button class="btn btn-ghost btn-sm" id="confCancel">Cancel Upload</button>
                <button class="btn btn-secondary btn-sm" id="confSkip">Skip Conflicting</button>
                <button class="btn btn-primary btn-sm" id="confOverwrite">Overwrite All</button>
              </div>
            </div>
          `;
          appContainer.appendChild(backdrop);

          const close = () => { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
          backdrop.querySelector('#confClose').onclick = () => { close(); onChoice('cancel'); };
          backdrop.querySelector('#confCancel').onclick = () => { close(); onChoice('cancel'); };
          backdrop.querySelector('#confSkip').onclick = () => { close(); onChoice('skip'); };
          backdrop.querySelector('#confOverwrite').onclick = () => { close(); onChoice('overwrite'); };
        };

        // Helper to recursively extract files & directories from Drag & Drop DataTransfer
        const extractFilesFromDataTransfer = async (dataTransfer, targetDir) => {
          const results = [];
          const items = dataTransfer.items;

          const readAllEntries = async (reader) => {
            const all = [];
            while (true) {
              const batch = await new Promise((resolve) => {
                reader.readEntries((entries) => resolve(entries || []), () => resolve([]));
              });
              if (!batch || batch.length === 0) break;
              all.push(...batch);
            }
            return all;
          };

          const traverseEntry = async (entry, currentRelPath = '') => {
            if (!entry) return;
            const path = currentRelPath ? `${currentRelPath}/${entry.name}` : entry.name;
            if (entry.isFile) {
              try {
                const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
                results.push({ file, relativePath: path });
              } catch (err) {
                console.warn('Could not read file from entry:', entry.name, err);
              }
            } else if (entry.isDirectory) {
              try {
                const reader = entry.createReader();
                const entries = await readAllEntries(reader);
                if (entries.length === 0) {
                  // If it's an empty directory, create it on the remote server
                  const baseDir = targetDir || currentPath;
                  const fullEmptyPath = baseDir === '/' ? `/${path}` : `${baseDir.replace(/\/+$/, '')}/${path}`;
                  try {
                    await fetch(`/api/servers/${this.serverId}/files/mkdir`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ path: fullEmptyPath })
                    });
                  } catch (_) {}
                } else {
                  for (const child of entries) {
                    await traverseEntry(child, path);
                  }
                }
              } catch (err) {
                console.warn('Could not read directory entry:', entry.name, err);
              }
            }
          };

          if (items && items.length > 0 && items[0].webkitGetAsEntry) {
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                  await traverseEntry(entry, '');
                } else {
                  const f = item.getAsFile();
                  if (f) results.push({ file: f, relativePath: f.name });
                }
              }
            }
          } else if (dataTransfer.files && dataTransfer.files.length > 0) {
            for (const f of dataTransfer.files) {
              results.push({ file: f, relativePath: f.webkitRelativePath || f.name });
            }
          }

          return results;
        };

        const uploadFiles = async (fileList, destDir = currentPath) => {
          if (!fileList || fileList.length === 0) return;

          // Normalize input to an array of { file, relativePath }
          const itemsToUpload = [];
          if (Array.isArray(fileList) && fileList[0] && fileList[0].file) {
            itemsToUpload.push(...fileList);
          } else {
            for (const f of Array.from(fileList)) {
              itemsToUpload.push({
                file: f,
                relativePath: f.webkitRelativePath || f.name
              });
            }
          }

          if (itemsToUpload.length === 0) return;

          // Detect potential top-level conflicts if uploading to currentPath
          const conflicts = [];
          if (destDir === currentPath) {
            for (const it of itemsToUpload) {
              const topName = it.relativePath.split('/')[0];
              if (items.some(item => item.name === topName) && !conflicts.includes(topName)) {
                conflicts.push(topName);
              }
            }
          }

          if (conflicts.length > 0) {
            showUploadConflictModal(conflicts, (choice) => {
              if (choice === 'cancel') return;
              let finalFiles = itemsToUpload;
              let overwrite = (choice === 'overwrite');
              if (choice === 'skip') {
                finalFiles = itemsToUpload.filter(it => {
                  const topName = it.relativePath.split('/')[0];
                  return !conflicts.includes(topName);
                });
                if (finalFiles.length === 0) {
                  if (window.showToast) window.showToast('All items were skipped', 'info');
                  return;
                }
              }
              executeUpload(finalFiles, overwrite, destDir);
            });
          } else {
            executeUpload(itemsToUpload, true, destDir);
          }
        };

        const executeUpload = (uploadItems, overwrite, destDir = currentPath) => {
          uploadBox.style.display = 'flex';
          uploadBar.style.width = '0%';
          const destName = (destDir === currentPath) ? 'current directory' : (destDir.split('/').filter(Boolean).pop() || destDir);
          uploadStatus.textContent = `Uploading ${uploadItems.length} item(s) to ${destName}...`;

          const formData = new FormData();
          formData.append('dest_dir', destDir);
          formData.append('overwrite', overwrite ? 'true' : 'false');
          for (let i = 0; i < uploadItems.length; i++) {
            const it = uploadItems[i];
            formData.append('files', it.file, it.file.name);
            formData.append('relative_paths', it.relativePath || it.file.name);
          }

          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/servers/${this.serverId}/files/upload`, true);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              uploadBar.style.width = `${pct}%`;
              uploadStatus.textContent = `${pct}% (${(e.loaded / 1024 / 1024).toFixed(1)}MB / ${(e.total / 1024 / 1024).toFixed(1)}MB)`;
            }
          };

          xhr.onload = () => {
            uploadBar.style.width = '100%';
            uploadStatus.textContent = 'Upload complete!';
            setTimeout(() => { uploadBox.style.display = 'none'; }, 2000);

            if (xhr.status >= 200 && xhr.status < 300) {
              if (window.showToast) window.showToast(`Uploaded ${uploadItems.length} item(s) successfully`, 'success');
              loadDir(currentPath, false);
            } else {
              try {
                const res = JSON.parse(xhr.responseText);
                alert('Upload error: ' + (res.error || xhr.statusText));
              } catch (_) {
                alert('Upload failed: ' + xhr.statusText);
              }
            }
          };

          xhr.onerror = () => {
            uploadBox.style.display = 'none';
            alert('Upload network error');
          };

          xhr.send(formData);
        };

        // File and Folder picker triggers
        const uploadBtn = bodyEl.querySelector(`#uploadBtn_${fileWinId}`);
        if (uploadBtn) uploadBtn.onclick = () => fileInput.click();
        fileInput.onchange = () => {
          if (fileInput.files.length > 0) {
            uploadFiles(fileInput.files, currentPath);
            fileInput.value = '';
          }
        };

        if (uploadFolderBtn && folderInput) {
          uploadFolderBtn.onclick = () => folderInput.click();
          folderInput.onchange = () => {
            if (folderInput.files.length > 0) {
              uploadFiles(folderInput.files, currentPath);
              folderInput.value = '';
            }
          };
        }

        // Drag and drop onto File Manager with specific Folder Drop Target detection
        let currentDropTargetEl = null;
        let currentDropTargetDir = null;
        let dragCounter = 0;

        const setDropTarget = (targetEl, targetDir, label) => {
          if (currentDropTargetEl && currentDropTargetEl !== targetEl) {
            currentDropTargetEl.classList.remove('drop-target-folder');
          }
          currentDropTargetEl = targetEl;
          currentDropTargetDir = targetDir;
          if (currentDropTargetEl) {
            currentDropTargetEl.classList.add('drop-target-folder');
          }
          if (dropOverlayText) {
            if (targetDir && targetDir !== currentPath) {
              dropOverlayText.textContent = `Drop to upload into '${label || targetDir}'`;
            } else {
              dropOverlayText.textContent = `Drop files or folders to upload into '${currentPath}'`;
            }
          }
        };

        const clearDropTarget = () => {
          if (currentDropTargetEl) {
            currentDropTargetEl.classList.remove('drop-target-folder');
            currentDropTargetEl = null;
          }
          currentDropTargetDir = null;
        };

        const updateDropTargetFromEvent = (e) => {
          const folderEl = e.target.closest('.file-row[data-is-dir="true"], .files-grid-item[data-is-dir="true"], .places-item[data-path]');
          if (folderEl) {
            const targetPath = folderEl.dataset.path;
            const nameEl = folderEl.querySelector('.file-name-text');
            const folderName = nameEl ? nameEl.textContent.trim() : (targetPath.split('/').filter(Boolean).pop() || targetPath);
            setDropTarget(folderEl, targetPath, folderName);
          } else {
            setDropTarget(null, currentPath, currentPath);
          }
        };

        const dropContainer = splitBody || vp;

        dropContainer.addEventListener('dragenter', (e) => {
          e.preventDefault();
          dragCounter++;
          dropOverlay.style.display = 'flex';
          updateDropTargetFromEvent(e);
        });

        dropContainer.addEventListener('dragover', (e) => {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
          }
          updateDropTargetFromEvent(e);
        });

        dropContainer.addEventListener('dragleave', (e) => {
          e.preventDefault();
          dragCounter--;
          if (dragCounter <= 0) {
            dragCounter = 0;
            dropOverlay.style.display = 'none';
            clearDropTarget();
          }
        });

        dropContainer.addEventListener('drop', async (e) => {
          e.preventDefault();
          dragCounter = 0;
          dropOverlay.style.display = 'none';

          const destDir = currentDropTargetDir || currentPath;
          clearDropTarget();

          if (window.showToast) {
            const destLabel = (destDir === currentPath) ? 'current folder' : destDir.split('/').filter(Boolean).pop() || destDir;
            window.showToast(`Reading dropped items for ${destLabel}...`, 'info');
          }

          const extracted = await extractFilesFromDataTransfer(e.dataTransfer, destDir);
          if (extracted && extracted.length > 0) {
            uploadFiles(extracted, destDir);
          } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files, destDir);
          } else {
            if (window.showToast) window.showToast('No files found in dropped items', 'warning');
          }
        });

        loadDir(initialDir);
      }
    });
  }

  // =========================================================================
  // 3. CODE APPLICATION (Monaco Remote IDE)
  // =========================================================================
  launchCode(params = {}) {
    const existing = WindowManager.getWindowByAppId('code');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      if (params.root && existing._setRoot) {
        existing._setRoot(params.root);
      }
      if (params.isDir && params.path && existing._setRoot) {
        existing._setRoot(params.path);
      }
      if (params.paths && Array.isArray(params.paths) && existing._openFile) {
        params.paths.forEach(p => existing._openFile(p));
      } else if (params.path && !params.isDir && existing._openFile) {
        existing._openFile(params.path);
      }
      return existing;
    }

    const codeId = 'code_' + Date.now();
    let initialFiles = [];
    if (params.paths && Array.isArray(params.paths)) {
      initialFiles = params.paths;
    } else if (params.path && !params.isDir) {
      initialFiles = [params.path];
    }
    const initialRoot = params.root || (params.isDir && params.path ? params.path : '~');

    return WindowManager.createWindow({
      appId: 'code',
      multiInstance: false,
      title: `Code Workspace - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="#0f172a"/><polyline points="8 17 3 12 8 7" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16 7 21 12 16 17" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="14" y1="4" x2="10" y2="20" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/></svg>',
      width: 1080,
      height: 680,
      minWidth: 640,
      minHeight: 400,
      contentHtml: `
        <div class="code-workspace-app" id="capp_${codeId}" style="height:100%; display:flex; flex-direction:column; background:#141824; position:relative; overflow:hidden;">
          <!-- Top IDE Action Bar -->
          <header style="height:36px; background:#0e131f; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; padding:0 0.75rem; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span style="font-size:0.75rem; font-weight:600; color:#cbd5e1; display:flex; align-items:center; gap:0.4rem;">
                <svg style="width:14px;height:14px;color:#818cf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                Workspace:
              </span>
              <span id="wsRootLabel_${codeId}" style="font-family:var(--font-mono); font-size:0.74rem; color:#38bdf8; background:rgba(56,189,248,0.1); padding:0.15rem 0.5rem; border-radius:var(--radius-xs);">~</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-primary btn-sm" id="saveCodeBtn_${codeId}" title="Save File (Ctrl+S)">
                <svg style="width:12px;height:12px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Save
              </button>
              <button class="btn btn-secondary btn-sm" id="toggleTermBtn_${codeId}" title="Toggle Terminal (Ctrl+\`)">
                <svg style="width:12px;height:12px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                Terminal
              </button>
            </div>
          </header>

          <!-- Middle Split: Activity Bar + Sidebar + Main Editor -->
          <div style="display:flex; flex:1; overflow:hidden;">
            <!-- Left Activity Bar (44px) -->
            <div style="width:44px; background:#090d16; border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; align-items:center; padding:0.5rem 0; gap:0.5rem; flex-shrink:0;">
              <button class="btn btn-ghost btn-xs code-act-btn active" id="actExplorer_${codeId}" title="File Explorer" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs);">
                <svg style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              </button>
              <button class="btn btn-ghost btn-xs code-act-btn" id="actSearch_${codeId}" title="Search in Files" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs);">
                <svg style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </button>
              <div style="width:20px; height:1px; background:rgba(255,255,255,0.08); margin:0.2rem 0;"></div>
              <button class="btn btn-ghost btn-xs code-act-btn" id="actTerminal_${codeId}" title="Toggle Integrated Terminal" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs);">
                <svg style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
              </button>
              <button class="btn btn-ghost btn-xs code-act-btn" id="actRefresh_${codeId}" title="Refresh Explorer Tree" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs);">
                <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </button>
            </div>

            <!-- Left Sidebar (Explorer / Search) -->
            <aside class="code-sidebar" id="sidebar_${codeId}" style="width:230px; background:#0f1420; border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; flex-shrink:0;">
              <!-- Pane 1: File Explorer -->
              <div id="paneExplorer_${codeId}" style="display:flex; flex-direction:column; height:100%;">
                <div class="code-sidebar-header" style="height:32px; padding:0 0.65rem; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.68rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">
                  <span>Explorer</span>
                  <div style="display:flex; align-items:center; gap:0.2rem;">
                    <button class="btn btn-ghost btn-xs" id="treeNewFile_${codeId}" title="New File" style="padding:2px 4px;"><svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
                    <button class="btn btn-ghost btn-xs" id="treeNewDir_${codeId}" title="New Folder" style="padding:2px 4px;"><svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg></button>
                  </div>
                </div>
                <div id="treeContainer_${codeId}" class="code-sidebar-content" style="flex:1; overflow-y:auto; padding:0.25rem 0;">
                  <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.75rem;">Loading files...</div>
                </div>
              </div>

              <!-- Pane 2: Search in Files -->
              <div id="paneSearch_${codeId}" style="display:none; flex-direction:column; height:100%;">
                <div class="code-sidebar-header" style="height:32px; padding:0 0.65rem; display:flex; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.68rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">
                  <span>Search in Files</span>
                </div>
                <div style="padding:0.6rem; display:flex; flex-direction:column; gap:0.4rem; border-bottom:1px solid rgba(255,255,255,0.06);">
                  <div style="display:flex; gap:0.3rem;">
                    <input type="text" id="searchInp_${codeId}" placeholder="Search text..." class="form-control" style="font-size:0.75rem; padding:0.25rem 0.5rem; flex:1;">
                    <button class="btn btn-secondary btn-sm" id="searchExecBtn_${codeId}" style="padding:0 0.5rem;">Go</button>
                  </div>
                </div>
                <div id="searchResults_${codeId}" style="flex:1; overflow-y:auto; padding:0.4rem;">
                  <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.73rem;">Enter a query to search inside remote workspace files</div>
                </div>
              </div>
            </aside>

            <!-- Main Editor Area -->
            <div class="code-main-area" style="flex:1; display:flex; flex-direction:column; overflow:hidden; background:#1e1e1e;">
              <!-- Editor Tabs Bar -->
              <div class="code-tabs-bar" id="tabsBar_${codeId}" style="height:35px; background:#111520; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; overflow-x:auto; flex-shrink:0;">
                <div style="padding:0 1rem; color:var(--text-muted); font-size:0.73rem;">No file open</div>
              </div>

              <!-- Monaco / Fallback Container -->
              <div class="code-editor-viewport" id="editorViewport_${codeId}" style="flex:1; width:100%; height:100%; overflow:hidden; position:relative;">
                <div id="monaco_${codeId}" style="width:100%; height:100%; overflow:hidden;"></div>
                <textarea id="fallbackTxt_${codeId}" style="width:100%; height:100%; background:#1e1e1e; color:#f8fafc; font-family:var(--font-mono); font-size:0.88rem; border:none; padding:1rem; resize:none; outline:none; display:none;"></textarea>
              </div>

              <!-- Collapsible Bottom Terminal Panel -->
              <div class="code-terminal-panel" id="termPanel_${codeId}" style="height:170px; display:none; flex-direction:column; background:#090d16; border-top:1px solid rgba(56,189,248,0.25); flex-shrink:0;">
                <div class="code-term-header" style="height:28px; background:#0f1522; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; padding:0 0.65rem;">
                  <div style="display:flex; align-items:center; gap:0.4rem;">
                    <span class="status-dot connected"></span>
                    <span style="font-family:var(--font-mono); font-size:0.7rem; color:#cbd5e1; font-weight:600;">TERMINAL (PTY)</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:0.3rem;">
                    <button class="btn btn-ghost btn-xs" id="termClearBtn_${codeId}" title="Clear">Clear</button>
                    <button class="btn btn-ghost btn-xs" id="termCloseBtn_${codeId}" title="Close Terminal">×</button>
                  </div>
                </div>
                <div class="code-term-viewport" id="termScreen_${codeId}" style="flex:1; width:100%; height:100%; overflow:hidden; padding:4px;"></div>
              </div>

              <!-- Bottom Status Bar -->
              <footer class="code-statusbar" style="height:24px; background:#0d121c; border-top:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between; padding:0 0.75rem; font-size:0.68rem; color:#64748b; font-family:var(--font-mono); flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                  <span id="stFilePath_${codeId}" style="color:#94a3b8;">Ready</span>
                  <span id="stDirty_${codeId}" style="color:#38bdf8; display:none;">• Modified</span>
                </div>
                <div style="display:flex; align-items:center; gap:0.8rem;">
                  <span id="stCursor_${codeId}">Ln 1, Col 1</span>
                  <span>UTF-8</span>
                  <span id="stLang_${codeId}" style="color:#38bdf8; font-weight:500;">Plain Text</span>
                </div>
              </footer>
            </div>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        let currentWorkspaceRoot = '~';
        let editor = null;
        let isUsingFallback = false;
        let openTabs = new Map(); // path -> { model, dirty, lang, content }
        let activePath = null;
        let isTerminalOpen = false;
        let termSocket = null;
        let termInstance = null;
        let termFitAddon = null;

        const monacoContainer = bodyEl.querySelector(`#monaco_${codeId}`);
        const fallbackTxt = bodyEl.querySelector(`#fallbackTxt_${codeId}`);
        const tabsBar = bodyEl.querySelector(`#tabsBar_${codeId}`);
        const saveBtn = bodyEl.querySelector(`#saveCodeBtn_${codeId}`);
        const toggleTermBtn = bodyEl.querySelector(`#toggleTermBtn_${codeId}`);
        const termPanel = bodyEl.querySelector(`#termPanel_${codeId}`);
        const termScreen = bodyEl.querySelector(`#termScreen_${codeId}`);
        const termCloseBtn = bodyEl.querySelector(`#termCloseBtn_${codeId}`);
        const termClearBtn = bodyEl.querySelector(`#termClearBtn_${codeId}`);
        const treeContainer = bodyEl.querySelector(`#treeContainer_${codeId}`);
        const wsRootLabel = bodyEl.querySelector(`#wsRootLabel_${codeId}`);
        const stFilePath = bodyEl.querySelector(`#stFilePath_${codeId}`);
        const stDirty = bodyEl.querySelector(`#stDirty_${codeId}`);
        const stCursor = bodyEl.querySelector(`#stCursor_${codeId}`);
        const stLang = bodyEl.querySelector(`#stLang_${codeId}`);

        // Activity bar panes
        const actExplorer = bodyEl.querySelector(`#actExplorer_${codeId}`);
        const actSearch = bodyEl.querySelector(`#actSearch_${codeId}`);
        const actTerminal = bodyEl.querySelector(`#actTerminal_${codeId}`);
        const actRefresh = bodyEl.querySelector(`#actRefresh_${codeId}`);
        const paneExplorer = bodyEl.querySelector(`#paneExplorer_${codeId}`);
        const paneSearch = bodyEl.querySelector(`#paneSearch_${codeId}`);

        const searchInp = bodyEl.querySelector(`#searchInp_${codeId}`);
        const searchExecBtn = bodyEl.querySelector(`#searchExecBtn_${codeId}`);
        const searchResults = bodyEl.querySelector(`#searchResults_${codeId}`);

        // Language mapper
        const getLanguageFromPath = (fpath) => {
          const ext = (fpath.split('.').pop() || '').toLowerCase();
          const map = {
            js: 'javascript', mjs: 'javascript', cjs: 'javascript',
            ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
            py: 'python', sh: 'shell', bash: 'shell', zsh: 'shell',
            json: 'json', html: 'html', htm: 'html', css: 'css', scss: 'scss',
            yml: 'yaml', yaml: 'yaml', md: 'markdown', markdown: 'markdown',
            sql: 'sql', php: 'php', rb: 'ruby', go: 'go', rs: 'rust',
            c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', java: 'java',
            xml: 'xml', ini: 'ini', conf: 'ini'
          };
          return map[ext] || 'plaintext';
        };

        // Initialize Monaco Editor
        const initEditor = () => {
          if (window.monaco) {
            createMonaco();
          } else if (window.require) {
            window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
            window.require(['vs/editor/editor.main'], () => {
              createMonaco();
            }, () => {
              useFallback();
            });
          } else {
            useFallback();
          }
        };

        const createMonaco = () => {
          editor = monaco.editor.create(monacoContainer, {
            value: '// Remote Code Workspace\n// Select a file from the explorer tree on the left to edit\n',
            language: 'plaintext',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            minimap: { enabled: false } // MINIMAP STRICTLY DISABLED
          });

          editor.onDidChangeCursorPosition((e) => {
            if (stCursor) stCursor.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
          });

          if (initialFiles.length > 0) {
            initialFiles.forEach(fp => openFile(fp));
          }
        };

        const useFallback = () => {
          isUsingFallback = true;
          fallbackTxt.style.display = 'block';
          fallbackTxt.value = '// Remote Code Workspace\n// Select a file from the explorer tree to edit\n';
          if (initialFiles.length > 0) {
            initialFiles.forEach(fp => openFile(fp));
          }
        };

        // Tabs Bar Rendering
        const renderTabs = () => {
          if (openTabs.size === 0) {
            tabsBar.innerHTML = `<div style="padding:0 1rem; color:var(--text-muted); font-size:0.73rem;">No file open</div>`;
            stFilePath.textContent = 'Ready';
            stDirty.style.display = 'none';
            stLang.textContent = 'Plain Text';
            winObj.titleEl.textContent = `Code Workspace - ${this.serverName}`;
            return;
          }

          let html = '';
          for (const [fpath, tab] of openTabs.entries()) {
            const fileName = fpath.split('/').pop() || fpath;
            const isActive = fpath === activePath;
            html += `
              <div class="code-tab ${isActive ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}" data-path="${fpath}" style="height:100%; padding:0 0.75rem; display:inline-flex; align-items:center; gap:0.45rem; background:${isActive ? '#1e1e1e' : '#141926'}; border-right:1px solid rgba(255,255,255,0.06); border-top:2px solid ${isActive ? '#38bdf8' : 'transparent'}; color:${isActive ? '#ffffff' : '#94a3b8'}; font-size:0.74rem; cursor:pointer; user-select:none; white-space:nowrap;">
                <span>${fileName}</span>
                <span class="code-tab-dirty" style="width:6px; height:6px; border-radius:50%; background:#38bdf8; display:${tab.dirty ? 'inline-block' : 'none'};"></span>
                <span class="code-tab-close" data-close-path="${fpath}" style="font-size:12px; margin-left:2px; opacity:0.6; padding:0 2px; border-radius:2px;" title="Close">×</span>
              </div>
            `;
          }
          tabsBar.innerHTML = html;

          if (activePath && openTabs.has(activePath)) {
            const activeTab = openTabs.get(activePath);
            stFilePath.textContent = activePath;
            stDirty.style.display = activeTab.dirty ? 'inline' : 'none';
            stLang.textContent = activeTab.lang.toUpperCase();
            winObj.titleEl.textContent = `Code: ${activePath.split('/').pop()} - ${this.serverName}`;
          }
        };

        // Open File in Tab
        const openFile = async (fpath, lineToJump = null) => {
          try {
            if (openTabs.has(fpath)) {
              activePath = fpath;
              const tab = openTabs.get(fpath);
              if (editor && tab.model) {
                editor.setModel(tab.model);
              } else if (fallbackTxt) {
                fallbackTxt.value = tab.content;
              }
              if (lineToJump && editor) {
                editor.revealLineInCenter(lineToJump);
                editor.setPosition({ lineNumber: lineToJump, column: 1 });
              }
              renderTabs();
              return;
            }

            stFilePath.textContent = `Loading ${fpath}...`;
            const resp = await fetch(`/api/servers/${this.serverId}/files/read?path=${encodeURIComponent(fpath)}`);
            const res = await resp.json();
            if (!res.success) {
              alert('Could not open file: ' + res.error);
              stFilePath.textContent = 'Error opening file';
              return;
            }

            const content = res.data.content || '';
            const lang = getLanguageFromPath(fpath);
            let model = null;

            if (window.monaco && editor) {
              const uri = monaco.Uri.parse(`inmemory://remote/${fpath.replace(/^\//, '')}`);
              model = monaco.editor.getModel(uri);
              if (!model) {
                model = monaco.editor.createModel(content, lang, uri);
              } else {
                model.setValue(content);
              }
              model.onDidChangeContent(() => {
                const cur = openTabs.get(fpath);
                if (cur && !cur.dirty) {
                  cur.dirty = true;
                  renderTabs();
                }
              });
            }

            openTabs.set(fpath, { model, content, dirty: false, lang });
            activePath = fpath;

            if (editor && model) {
              editor.setModel(model);
              if (lineToJump) {
                editor.revealLineInCenter(lineToJump);
                editor.setPosition({ lineNumber: lineToJump, column: 1 });
              }
            } else if (fallbackTxt) {
              fallbackTxt.value = content;
            }

            renderTabs();
          } catch (e) {
            alert('File open error: ' + e);
          }
        };

        // Expose openFile to windowObj so Files app can call it
        winObj._openFile = openFile;

        // Close File Tab
        const closeFile = (fpath) => {
          const tab = openTabs.get(fpath);
          if (tab && tab.dirty) {
            if (!confirm(`"${fpath.split('/').pop()}" has unsaved changes. Close anyway?`)) return;
          }
          if (tab && tab.model) {
            tab.model.dispose();
          }
          openTabs.delete(fpath);

          if (activePath === fpath) {
            const keys = Array.from(openTabs.keys());
            if (keys.length > 0) {
              openFile(keys[keys.length - 1]);
            } else {
              activePath = null;
              if (editor) {
                editor.setModel(monaco.editor.createModel('// No file open', 'plaintext'));
              } else if (fallbackTxt) {
                fallbackTxt.value = '// No file open';
              }
              renderTabs();
            }
          } else {
            renderTabs();
          }
        };

        tabsBar.addEventListener('click', (e) => {
          const closeBtn = e.target.closest('.code-tab-close');
          if (closeBtn) {
            e.stopPropagation();
            closeFile(closeBtn.dataset.closePath);
            return;
          }
          const tabEl = e.target.closest('.code-tab');
          if (tabEl) {
            openFile(tabEl.dataset.path);
          }
        });

        // Save active file
        const saveActiveFile = async () => {
          if (!activePath) return;
          const tab = openTabs.get(activePath);
          if (!tab) return;

          const content = editor && tab.model ? tab.model.getValue() : fallbackTxt.value;
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';

          try {
            const resp = await fetch(`/api/servers/${this.serverId}/files/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: activePath, content })
            });
            const res = await resp.json();
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<svg style="width:12px;height:12px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save`;

            if (res.success) {
              tab.dirty = false;
              renderTabs();
              if (window.showToast) window.showToast(`Saved ${activePath.split('/').pop()}`, 'success');
            } else {
              alert('Save failed: ' + res.error);
            }
          } catch (e) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
            alert('Save error: ' + e);
          }
        };

        saveBtn.onclick = saveActiveFile;

        bodyEl.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            e.stopPropagation();
            saveActiveFile();
          } else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
            e.preventDefault();
            e.stopPropagation();
            toggleTerminal();
          }
        });

        // Remote Explorer Tree
        const loadTree = async (rootPath = '~') => {
          try {
            treeContainer.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.75rem;"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Loading remote files...</div>`;
            const resp = await fetch(`/api/servers/${this.serverId}/files/list?path=${encodeURIComponent(rootPath)}`);
            const res = await resp.json();
            if (!res.success) {
              treeContainer.innerHTML = `<div style="padding:1rem; color:var(--accent-rose); font-size:0.75rem;">Error loading tree: ${res.error}</div>`;
              return;
            }
            currentWorkspaceRoot = res.data.current_path;
            wsRootLabel.textContent = currentWorkspaceRoot;

            renderTreeNodes(treeContainer, res.data.items || [], 0);
          } catch (e) {
            treeContainer.innerHTML = `<div style="padding:1rem; color:var(--accent-rose); font-size:0.75rem;">Tree error: ${e}</div>`;
          }
        };

        const renderTreeNodes = (container, items, depth = 0) => {
          // Sort directories first, then alphabetical
          items.sort((a, b) => {
            if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
            return a.is_dir ? -1 : 1;
          });

          if (items.length === 0) {
            container.innerHTML = `<div style="padding:0.5rem 1rem; color:var(--text-muted); font-size:0.72rem;">Empty directory</div>`;
            return;
          }

          container.innerHTML = items.map(item => {
            const indent = depth * 14 + 8;
            const arrow = item.is_dir ? `<span class="code-tree-arrow" style="width:12px; height:12px; display:inline-flex; align-items:center; justify-content:center; color:#64748b; margin-right:2px; font-size:9px;">▶</span>` : `<span style="width:14px; display:inline-block;"></span>`;
            const icon = item.is_dir
              ? `<svg style="width:13px;height:13px;color:#38bdf8;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
              : `<svg style="width:13px;height:13px;color:#94a3b8;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>`;

            return `
              <div class="code-tree-node" style="user-select:none;">
                <div class="code-tree-item" data-path="${item.path}" data-is-dir="${item.is_dir}" style="display:flex; align-items:center; gap:0.35rem; padding:0.25rem 0.5rem 0.25rem ${indent}px; font-size:0.75rem; color:#cbd5e1; cursor:pointer; border-radius:var(--radius-xs);">
                  ${arrow}
                  ${icon}
                  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${item.name}</span>
                </div>
                ${item.is_dir ? `<div class="code-tree-children" data-child-for="${item.path}" style="display:none;"></div>` : ''}
              </div>
            `;
          }).join('');
        };

        // Tree interactions (expand/collapse directories or open files)
        treeContainer.addEventListener('click', async (e) => {
          const itemEl = e.target.closest('.code-tree-item');
          if (!itemEl) return;
          const p = itemEl.dataset.path;
          const isDir = itemEl.dataset.isDir === 'true';

          if (isDir) {
            const nodeEl = itemEl.closest('.code-tree-node');
            const childEl = nodeEl.querySelector(`.code-tree-children[data-child-for="${CSS.escape(p)}"]`);
            const arrowEl = itemEl.querySelector('.code-tree-arrow');
            if (childEl.style.display === 'none') {
              childEl.style.display = 'block';
              if (arrowEl) arrowEl.style.transform = 'rotate(90deg)';
              if (!childEl.hasChildNodes() || childEl.innerHTML === '') {
                childEl.innerHTML = `<div style="padding:0.25rem 1.5rem; color:var(--text-muted); font-size:0.7rem;">Loading...</div>`;
                const resp = await fetch(`/api/servers/${this.serverId}/files/list?path=${encodeURIComponent(p)}`);
                const res = await resp.json();
                if (res.success) {
                  const depth = (itemEl.style.paddingLeft ? parseInt(itemEl.style.paddingLeft, 10) : 8) / 14;
                  renderTreeNodes(childEl, res.data.items || [], depth);
                } else {
                  childEl.innerHTML = `<div style="padding:0.25rem 1.5rem; color:var(--accent-rose); font-size:0.7rem;">Error</div>`;
                }
              }
            } else {
              childEl.style.display = 'none';
              if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';
            }
          } else {
            openFile(p);
          }
        });

        // Tree new file / folder buttons
        bodyEl.querySelector(`#treeNewFile_${codeId}`).onclick = async () => {
          const name = prompt('Enter new file name:');
          if (!name) return;
          const fullPath = (currentWorkspaceRoot === '/' ? '' : currentWorkspaceRoot) + '/' + name.trim();
          const resp = await fetch(`/api/servers/${this.serverId}/files/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fullPath, type: 'file' })
          });
          const res = await resp.json();
          if (res.success) {
            loadTree(currentWorkspaceRoot);
            openFile(fullPath);
          } else {
            alert('Could not create file: ' + res.error);
          }
        };

        bodyEl.querySelector(`#treeNewDir_${codeId}`).onclick = async () => {
          const name = prompt('Enter new folder name:');
          if (!name) return;
          const fullPath = (currentWorkspaceRoot === '/' ? '' : currentWorkspaceRoot) + '/' + name.trim();
          const resp = await fetch(`/api/servers/${this.serverId}/files/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fullPath, type: 'dir' })
          });
          const res = await resp.json();
          if (res.success) {
            loadTree(currentWorkspaceRoot);
          } else {
            alert('Could not create directory: ' + res.error);
          }
        };

        // Activity bar actions
        actExplorer.onclick = () => {
          actExplorer.classList.add('active');
          actSearch.classList.remove('active');
          paneExplorer.style.display = 'flex';
          paneSearch.style.display = 'none';
        };

        actSearch.onclick = () => {
          actSearch.classList.add('active');
          actExplorer.classList.remove('active');
          paneSearch.style.display = 'flex';
          paneExplorer.style.display = 'none';
          searchInp.focus();
        };

        actRefresh.onclick = () => loadTree(currentWorkspaceRoot);

        // Search in Files
        const runSearch = async () => {
          const q = searchInp.value.trim();
          if (!q) return;
          searchResults.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.75rem;"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Searching...</div>`;
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/workspace/search-code?path=${encodeURIComponent(currentWorkspaceRoot)}&q=${encodeURIComponent(q)}`);
            const res = await resp.json();
            if (!res.success) {
              searchResults.innerHTML = `<div style="padding:1rem; color:var(--accent-rose); font-size:0.73rem;">Search error: ${res.error}</div>`;
              return;
            }
            const list = res.results || [];
            if (list.length === 0) {
              searchResults.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.73rem;">No matches found</div>`;
              return;
            }
            searchResults.innerHTML = list.map(item => `
              <div class="search-result-item" data-path="${item.file}" data-line="${item.line}" style="padding:0.35rem 0.5rem; border-radius:var(--radius-xs); cursor:pointer; margin-bottom:0.3rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.74rem; font-weight:600; color:#38bdf8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${item.file.split('/').pop()} <span style="color:var(--text-muted); font-size:0.68rem; font-weight:normal;">:${item.line}</span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-secondary); font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">
                  ${item.snippet || item.match || ''}
                </div>
              </div>
            `).join('');
          } catch (e) {
            searchResults.innerHTML = `<div style="padding:1rem; color:var(--accent-rose); font-size:0.73rem;">Search error: ${e}</div>`;
          }
        };

        searchExecBtn.onclick = runSearch;
        searchInp.onkeydown = (e) => { if (e.key === 'Enter') runSearch(); };

        searchResults.addEventListener('click', (e) => {
          const item = e.target.closest('.search-result-item');
          if (item) {
            openFile(item.dataset.path, parseInt(item.dataset.line, 10));
          }
        });

        // Integrated Bottom Terminal Panel
        const toggleTerminal = () => {
          isTerminalOpen = !isTerminalOpen;
          termPanel.style.display = isTerminalOpen ? 'flex' : 'none';
          if (isTerminalOpen) {
            if (!termInstance) {
              initIntegratedTerminal();
            } else {
              setTimeout(() => { if (termFitAddon) termFitAddon.fit(); }, 60);
            }
          }
        };

        toggleTermBtn.onclick = toggleTerminal;
        actTerminal.onclick = toggleTerminal;
        termCloseBtn.onclick = () => {
          isTerminalOpen = false;
          termPanel.style.display = 'none';
        };

        const initIntegratedTerminal = () => {
          termInstance = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 13,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            theme: {
              background: '#090d16',
              foreground: '#f8fafc',
              cursor: '#38bdf8',
              selectionBackground: 'rgba(56, 189, 248, 0.3)',
              black: '#1e293b', red: '#f43f5e', green: '#10b981', yellow: '#f59e0b',
              blue: '#3b82f6', magenta: '#d946ef', cyan: '#06b6d4', white: '#f8fafc'
            },
            scrollback: 2000
          });

          termFitAddon = new FitAddon.FitAddon();
          termInstance.loadAddon(termFitAddon);
          termInstance.open(termScreen);

          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          let url = `${protocol}//${window.location.host}/ws/terminal/${this.serverId}?cols=80&rows=12`;
          if (workspaceRoot) {
            url += `&cwd=${encodeURIComponent(workspaceRoot)}&path=${encodeURIComponent(workspaceRoot)}`;
          }
          termSocket = new WebSocket(url);

          termSocket.onopen = () => {
            termFitAddon.fit();
            termInstance.focus();
          };

          termSocket.onmessage = (evt) => {
            try {
              const msg = JSON.parse(evt.data);
              if (msg.type === 'data') termInstance.write(msg.data);
            } catch (_) {
              termInstance.write(evt.data);
            }
          };

          termInstance.onData((data) => {
            if (termSocket && termSocket.readyState === WebSocket.OPEN) {
              termSocket.send(JSON.stringify({ type: 'input', data }));
            }
          });

          termClearBtn.onclick = () => termInstance.clear();
          setTimeout(() => { termFitAddon.fit(); }, 150);
        };

        // Initialize IDE
        winObj._openFile = openFile;
        winObj._setRoot = (root) => { loadTree(root); };
        loadTree(initialRoot);
        initEditor();

        winObj.onResize = () => {
          if (editor) editor.layout();
          if (termFitAddon && isTerminalOpen) {
            try { termFitAddon.fit(); } catch (_) {}
          }
        };

        winObj.onClose = () => {
          if (termSocket) termSocket.close();
          if (termInstance) termInstance.dispose();
          for (const tab of openTabs.values()) {
            if (tab.model) tab.model.dispose();
          }
          if (editor) editor.dispose();
        };
      }
    });
  }

  // =========================================================================
  // 4. OVERVIEW APPLICATION (Mission Control Telemetry)
  // =========================================================================
  launchOverview(params = {}) {
    return WindowManager.createWindow({
      appId: 'overview',
      multiInstance: false,
      title: `System Overview - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>',
      width: 880,
      height: 560,
      minWidth: 480,
      minHeight: 320,
      contentHtml: `
        <div style="height:100%; overflow-y:auto; padding:1.25rem; display:flex; flex-direction:column; gap:1.25rem; background:var(--bg-canvas);">
          <!-- Telemetry Metric Cards -->
          <div class="metric-grid" style="margin-bottom:0;">
            <div class="metric-card">
              <div class="metric-title"><span>Processor Usage</span><svg style="width:14px;height:14px;color:var(--accent-blue);" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg></div>
              <div class="metric-value"><span id="ov_cpu">--</span>%</div>
              <div class="progress-bar-bg"><div id="ov_cpubar" class="progress-bar-fill fill-blue" style="width:0%;"></div></div>
              <div class="metric-sub" id="ov_load">Load: --, --, --</div>
            </div>
            <div class="metric-card">
              <div class="metric-title"><span>Memory (RAM)</span><svg style="width:14px;height:14px;color:var(--accent-emerald);" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 19v-3"></path></svg></div>
              <div class="metric-value"><span id="ov_mem">--</span>%</div>
              <div class="progress-bar-bg"><div id="ov_membar" class="progress-bar-fill fill-emerald" style="width:0%;"></div></div>
              <div class="metric-sub" id="ov_memtxt">Used: -- / --</div>
            </div>
            <div class="metric-card">
              <div class="metric-title"><span>Root Storage</span><svg style="width:14px;height:14px;color:var(--accent-amber);" viewBox="0 0 24 24" fill="none" stroke="currentColor"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse></svg></div>
              <div class="metric-value"><span id="ov_disk">--</span>%</div>
              <div class="progress-bar-bg"><div id="ov_diskbar" class="progress-bar-fill fill-amber" style="width:0%;"></div></div>
              <div class="metric-sub" id="ov_disktxt">Used: -- / --</div>
            </div>
            <div class="metric-card">
              <div class="metric-title"><span>Kernel Uptime</span><svg style="width:14px;height:14px;color:var(--accent-cyan);" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle></svg></div>
              <div class="metric-value" style="font-size:1.3rem;" id="ov_uptime">--</div>
              <div class="metric-sub">Sync: Active</div>
            </div>
          </div>

          <!-- Filesystems Mounts Table -->
          <div class="card" style="padding:0; overflow:hidden;">
            <div class="card-header" style="padding:0.65rem 1rem; border-bottom:1px solid var(--border-subtle); background:var(--bg-system);">
              <span class="card-title">Partition Mounts</span>
            </div>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr><th>Mount Point</th><th>Filesystem</th><th>Used</th><th>Available</th><th>Total</th><th>Usage</th></tr>
                </thead>
                <tbody id="ov_mounts">
                  <tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Polling telemetry...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const formatBytes = (bytes) => {
          if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 B';
          if (bytes < 1024) return bytes + ' B';
          const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
          let u = -1;
          let val = Number(bytes);
          do {
            val /= 1024;
            u++;
          } while (val >= 1024 && u < units.length - 1);
          return `${val.toFixed(val >= 100 ? 1 : 2)} ${units[u]}`;
        };

        const updateOverviewUI = (m) => {
          if (!bodyEl.isConnected || !m) return;
          const cpuEl = bodyEl.querySelector('#ov_cpu');
          const cpuBar = bodyEl.querySelector('#ov_cpubar');
          const loadEl = bodyEl.querySelector('#ov_load');
          if (cpuEl && m.cpu !== undefined) cpuEl.textContent = m.cpu;
          if (cpuBar && m.cpu !== undefined) cpuBar.style.width = `${m.cpu}%`;
          if (m.load && loadEl) loadEl.textContent = `Load: ${m.load.join(', ')}`;

          const memEl = bodyEl.querySelector('#ov_mem');
          const memBar = bodyEl.querySelector('#ov_membar');
          const memTxt = bodyEl.querySelector('#ov_memtxt');
          if (memEl && m.memory) memEl.textContent = m.memory.percent;
          if (memBar && m.memory) memBar.style.width = `${m.memory.percent}%`;
          if (memTxt && m.memory) {
            const usedM = m.memory.used_formatted || formatBytes(m.memory.used);
            const totalM = m.memory.total_formatted || formatBytes(m.memory.total);
            memTxt.textContent = `Used: ${usedM} / ${totalM}`;
          }

          const diskEl = bodyEl.querySelector('#ov_disk');
          const diskBar = bodyEl.querySelector('#ov_diskbar');
          const diskTxt = bodyEl.querySelector('#ov_disktxt');
          if (diskEl && m.disk) diskEl.textContent = m.disk.percent;
          if (diskBar && m.disk) diskBar.style.width = `${m.disk.percent}%`;
          if (diskTxt && m.disk) {
            const usedD = m.disk.used_formatted || formatBytes(m.disk.used);
            const totalD = m.disk.total_formatted || formatBytes(m.disk.total);
            diskTxt.textContent = `Used: ${usedD} / ${totalD}`;
          }

          if (m.uptime !== undefined) {
            const d = Math.floor(m.uptime / (3600*24));
            const h = Math.floor((m.uptime % (3600*24)) / 3600);
            const min = Math.floor((m.uptime % 3600) / 60);
            const upEl = bodyEl.querySelector('#ov_uptime');
            if (upEl) upEl.textContent = `${d}d ${h}h ${min}m`;
          }

          // Partition Mounts
          const tbody = bodyEl.querySelector('#ov_mounts');
          if (tbody && m.disk && m.disk.filesystems && m.disk.filesystems.length > 0) {
            tbody.innerHTML = m.disk.filesystems.map(fs => {
              const usedStr = fs.used_formatted || formatBytes(fs.used);
              const availStr = fs.avail_formatted || formatBytes(fs.avail);
              const totalStr = fs.total_formatted || formatBytes(fs.total);
              const pct = fs.percent || 0;
              return `
                <tr>
                  <td><strong style="color:var(--text-primary);">${fs.mount}</strong></td>
                  <td><code style="color:var(--accent-cyan);">${fs.filesystem}</code></td>
                  <td style="font-family:var(--font-mono);">${usedStr}</td>
                  <td style="font-family:var(--font-mono); color:var(--text-secondary);">${availStr}</td>
                  <td style="font-family:var(--font-mono); color:var(--text-muted);">${totalStr}</td>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.6rem; min-width:120px;">
                      <div class="progress-bar-bg" style="flex:1; height:6px;">
                        <div class="progress-bar-fill fill-blue" style="width:${pct}%;"></div>
                      </div>
                      <span style="font-family:var(--font-mono); font-size:0.75rem; min-width:32px; text-align:right;">${pct}%</span>
                    </div>
                  </td>
                </tr>
              `;
            }).join('');
          }
        };

        const unsubOverview = window.DesktopTelemetry ? window.DesktopTelemetry.subscribe(updateOverviewUI) : null;
        if (window.DesktopTelemetry) window.DesktopTelemetry.poll();

        winObj.onClose = () => {
          if (unsubOverview) unsubOverview();
        };
      }
    });
  }

  // =========================================================================
  // 5. PROCESSES (Task Manager)
  // =========================================================================
  launchProcesses(params = {}) {
    return WindowManager.createWindow({
      appId: 'processes',
      multiInstance: false,
      title: `Task Manager - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#34d399"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>',
      width: 960,
      height: 560,
      minWidth: 540,
      minHeight: 300,
      contentHtml: `
        <div style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas);">
          <div style="background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; padding:0.45rem 0.75rem; flex-wrap:wrap; gap:0.5rem; position:relative;">
            <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <input type="text" id="procSearchInput" placeholder="Filter PID, user, cmd..." class="form-control" style="width:170px; padding:0.25rem 0.5rem; font-size:0.75rem;">
              
              <!-- Total System Telemetry: CPU, RAM, Storage -->
              <div id="procSysMetrics" style="display:flex; align-items:center; gap:0.45rem;">
                <!-- CPU -->
                <div style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.22rem 0.55rem; border-radius:4px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);" title="Host CPU Usage">
                  <span style="color:var(--text-muted); font-size:0.68rem; font-weight:700;">CPU:</span>
                  <span id="procMetricCpuVal" style="color:#34d399; font-weight:700; font-family:var(--font-mono); font-size:0.72rem;">--%</span>
                  <div style="width:32px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                    <div id="procMetricCpuBar" style="width:0%; height:100%; background:#34d399; transition:width 0.3s ease;"></div>
                  </div>
                </div>

                <!-- RAM -->
                <div style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.22rem 0.55rem; border-radius:4px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);" title="Total Host Memory Usage">
                  <span style="color:var(--text-muted); font-size:0.68rem; font-weight:700;">RAM:</span>
                  <span id="procMetricMemVal" style="color:#38bdf8; font-weight:700; font-family:var(--font-mono); font-size:0.72rem;">--%</span>
                  <div style="width:32px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                    <div id="procMetricMemBar" style="width:0%; height:100%; background:#38bdf8; transition:width 0.3s ease;"></div>
                  </div>
                </div>

                <!-- Storage / Disk -->
                <div style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.22rem 0.55rem; border-radius:4px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);" title="Total Root Storage Usage">
                  <span style="color:var(--text-muted); font-size:0.68rem; font-weight:700;">Disk:</span>
                  <span id="procMetricDiskVal" style="color:#a78bfa; font-weight:700; font-family:var(--font-mono); font-size:0.72rem;">--%</span>
                  <div style="width:32px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                    <div id="procMetricDiskBar" style="width:0%; height:100%; background:#a78bfa; transition:width 0.3s ease;"></div>
                  </div>
                </div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:0.5rem; position:relative;">
              <span id="procCountBadge" style="font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">0 procs</span>
              
              <!-- Column Visibility Preferences Button & Popover -->
              <div style="position:relative;">
                <button class="btn btn-secondary btn-xs" id="procColsBtn" style="padding:0.25rem 0.55rem; display:inline-flex; align-items:center; gap:4px;" title="Choose which columns to show or hide">
                  <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/></svg>
                  <span>Columns &#9662;</span>
                </button>
                <div id="procColsPopover" class="proc-cols-popover" style="display:none;">
                  <div class="proc-cols-title">Visible Columns</div>
                  <div id="procColsList" style="display:flex; flex-direction:column; gap:2px;"></div>
                </div>
              </div>

              <button class="btn btn-secondary btn-xs" id="procRefreshBtn" style="padding:0.25rem 0.6rem;">Refresh</button>
            </div>
          </div>
          <div class="table-responsive" style="flex:1; overflow-y:auto;">
            <table class="table" style="margin:0; width:100%; border-collapse:collapse; font-size:0.78rem;">
              <thead>
                <tr id="procTableHeadRow" style="position:sticky; top:0; background:#0d131f; z-index:2; border-bottom:1px solid var(--border-subtle); color:var(--text-muted); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.03em;"></tr>
              </thead>
              <tbody id="procTableBody">
                <tr><td colspan="9" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading processes...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        let procs = [];
        let sortCol = 'cpu';
        let sortDir = 'desc';
        let activeCtxMenu = null;

        const tbody = bodyEl.querySelector('#procTableBody');
        const theadRow = bodyEl.querySelector('#procTableHeadRow');
        const input = bodyEl.querySelector('#procSearchInput');
        const countBadge = bodyEl.querySelector('#procCountBadge');
        const colsBtn = bodyEl.querySelector('#procColsBtn');
        const colsPopover = bodyEl.querySelector('#procColsPopover');
        const colsList = bodyEl.querySelector('#procColsList');

        // Column Definitions
        const ALL_COLS = [
          { id: 'pid', label: 'PID', width: '75px', default: true },
          { id: 'user', label: 'User', width: '110px', default: true },
          { id: 'cpu', label: 'CPU%', width: '75px', default: true },
          { id: 'mem', label: 'RAM%', width: '80px', title: 'Memory Usage %', default: true },
          { id: 'rss', label: 'RSS', width: '85px', title: 'Resident Set Size: physical RAM allocated', default: true },
          { id: 'pss', label: 'PSS', width: '85px', title: 'Proportional Set Size: private memory + proportional share of shared memory', default: true },
          { id: 'vsz', label: 'VSZ', width: '80px', title: 'Virtual Memory Size', default: false },
          { id: 'stat', label: 'Status', width: '115px', title: 'Process execution state', default: true },
          { id: 'comm', label: 'Command', width: 'auto', title: 'Process command and arguments', default: true }
        ];

        // Column preferences backed by localStorage
        let visibleCols = {};
        ALL_COLS.forEach(c => visibleCols[c.id] = c.default);
        try {
          const savedCols = localStorage.getItem('shellman_taskmgr_cols');
          if (savedCols) {
            const parsed = JSON.parse(savedCols);
            ALL_COLS.forEach(c => {
              if (parsed[c.id] !== undefined) visibleCols[c.id] = !!parsed[c.id];
            });
          }
        } catch (_) {}

        const saveColPrefs = () => {
          try {
            localStorage.setItem('shellman_taskmgr_cols', JSON.stringify(visibleCols));
          } catch (_) {}
        };

        const formatKb = (kb) => {
          if (kb === null || kb === undefined || isNaN(kb)) return '-';
          if (kb < 1024) return kb + ' KB';
          if (kb < 1024 * 1024) return (kb / 1024).toFixed(1) + ' MB';
          return (kb / (1024 * 1024)).toFixed(2) + ' GB';
        };

        const formatRam = (rssKb, memPct) => {
          const sizeStr = (rssKb !== null && rssKb !== undefined && !isNaN(rssKb)) ? formatKb(rssKb) : null;
          const pctStr = (memPct !== null && memPct !== undefined) ? `${memPct}%` : '0%';
          if (!sizeStr) return pctStr;
          return `${sizeStr} (${pctStr})`;
        };

        // Decodes Linux process STAT codes into human-readable states with colored badges and rich tooltips
        const parseProcessState = (stat) => {
          if (!stat) return { label: 'Unknown', color: '#94a3b8', bg: 'rgba(148,163,184,0.14)', desc: 'Unknown state' };
          const s = String(stat).trim();
          const primary = s.charAt(0);
          let label = 'Unknown';
          let color = '#94a3b8';
          let bg = 'rgba(148,163,184,0.14)';
          let baseDesc = '';

          switch (primary) {
            case 'R':
              label = 'Running';
              color = '#34d399';
              bg = 'rgba(52,211,153,0.14)';
              baseDesc = 'Running (actively executing instructions on CPU)';
              break;
            case 'S':
              label = 'Active';
              color = '#34d399';
              bg = 'rgba(52,211,153,0.14)';
              baseDesc = 'Active and healthy (listening & waiting for incoming requests / I/O)';
              break;
            case 'D':
              label = 'Disk Wait';
              color = '#fbbf24';
              bg = 'rgba(251,191,36,0.14)';
              baseDesc = 'Uninterruptible sleep (usually waiting for disk I/O)';
              break;
            case 'Z':
              label = 'Zombie';
              color = '#f87171';
              bg = 'rgba(248,113,113,0.16)';
              baseDesc = 'Defunct / Zombie (terminated, waiting for parent to reap)';
              break;
            case 'T':
              label = 'Stopped';
              color = '#fb923c';
              bg = 'rgba(251,146,60,0.14)';
              baseDesc = 'Stopped by job control signal or SIGSTOP';
              break;
            case 't':
              label = 'Traced';
              color = '#fb923c';
              bg = 'rgba(251,146,60,0.14)';
              baseDesc = 'Stopped by debugger during code tracing';
              break;
            case 'I':
              label = 'Idle';
              color = '#94a3b8';
              bg = 'rgba(148,163,184,0.12)';
              baseDesc = 'Idle kernel thread';
              break;
            default:
              label = s;
              baseDesc = `Status code: ${s}`;
          }

          const modifiers = [];
          for (let i = 1; i < s.length; i++) {
            const ch = s.charAt(i);
            if (ch === '<') modifiers.push('High priority');
            else if (ch === 'N') modifiers.push('Low priority (nice)');
            else if (ch === 'L') modifiers.push('Pages locked into memory');
            else if (ch === 's') modifiers.push('Session leader');
            else if (ch === 'l') modifiers.push('Multi-threaded');
            else if (ch === '+') modifiers.push('Foreground process');
          }

          const fullDesc = `Status: ${label} (${s})\n${baseDesc}` + (modifiers.length ? `\nAttributes: ${modifiers.join(', ')}` : '');
          return { label, color, bg, desc: fullDesc, raw: s };
        };

        // Context Menu Management
        const hideCtxMenu = () => {
          if (activeCtxMenu && activeCtxMenu.parentNode) {
            activeCtxMenu.parentNode.removeChild(activeCtxMenu);
          }
          activeCtxMenu = null;
        };

        const showProcContextMenu = (x, y, proc) => {
          hideCtxMenu();
          const st = parseProcessState(proc.stat);
          const menu = document.createElement('div');
          menu.className = 'proc-ctx-menu';
          menu.innerHTML = `
            <div class="proc-ctx-header">
              <div class="proc-ctx-title">
                <span>PID ${proc.pid} &bull; ${escapeHtml(proc.comm)}</span>
                <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.68rem; color:${st.color}; font-weight:600;">
                  <span style="width:6px; height:6px; border-radius:50%; background:${st.color};"></span>${escapeHtml(st.label)}
                </span>
              </div>
              <div class="proc-ctx-subtitle" title="${escapeHtml(proc.args || proc.comm)}">${escapeHtml(proc.args || proc.comm)}</div>
            </div>
            <button class="proc-ctx-item" id="ctx_term">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              <span>Terminate (SIGTERM)</span>
            </button>
            <button class="proc-ctx-item danger" id="ctx_kill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>Force Kill (SIGKILL)</span>
            </button>
            <button class="proc-ctx-item" id="ctx_stop">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              <span>Pause Process (SIGSTOP)</span>
            </button>
            <button class="proc-ctx-item" id="ctx_cont">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Resume Process (SIGCONT)</span>
            </button>
            <div class="proc-ctx-divider"></div>
            <button class="proc-ctx-item" id="ctx_copy_pid">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy PID</span>
            </button>
            <button class="proc-ctx-item" id="ctx_copy_cmd">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
              <span>Copy Command</span>
            </button>
          `;

          document.body.appendChild(menu);
          activeCtxMenu = menu;

          const menuW = 220;
          const menuH = menu.offsetHeight || 230;
          const clampedX = Math.min(x, window.innerWidth - menuW - 12);
          const clampedY = Math.min(y, window.innerHeight - menuH - 12);
          menu.style.left = `${Math.max(10, clampedX)}px`;
          menu.style.top = `${Math.max(10, clampedY)}px`;

          menu.querySelector('#ctx_term').onclick = async () => {
            hideCtxMenu();
            const ok = await DesktopApps.killProcess(this.serverId, proc.pid, 'SIGTERM', proc.comm);
            if (ok) fetchProcs();
          };
          menu.querySelector('#ctx_kill').onclick = async () => {
            hideCtxMenu();
            const ok = await DesktopApps.killProcess(this.serverId, proc.pid, 'SIGKILL', proc.comm);
            if (ok) fetchProcs();
          };
          menu.querySelector('#ctx_stop').onclick = async () => {
            hideCtxMenu();
            const ok = await DesktopApps.killProcess(this.serverId, proc.pid, 'SIGSTOP', proc.comm);
            if (ok) fetchProcs();
          };
          menu.querySelector('#ctx_cont').onclick = async () => {
            hideCtxMenu();
            const ok = await DesktopApps.killProcess(this.serverId, proc.pid, 'SIGCONT', proc.comm);
            if (ok) fetchProcs();
          };
          menu.querySelector('#ctx_copy_pid').onclick = () => {
            hideCtxMenu();
            navigator.clipboard.writeText(String(proc.pid));
            if (window.showToast) window.showToast(`PID ${proc.pid} copied to clipboard`, 'info');
          };
          menu.querySelector('#ctx_copy_cmd').onclick = () => {
            hideCtxMenu();
            navigator.clipboard.writeText(proc.args || proc.comm);
            if (window.showToast) window.showToast('Command copied to clipboard', 'info');
          };
        };

        const onDocPointerDown = (e) => {
          if (activeCtxMenu && !e.target.closest('.proc-ctx-menu')) hideCtxMenu();
          if (colsPopover && !colsPopover.contains(e.target) && !colsBtn.contains(e.target)) {
            colsPopover.style.display = 'none';
          }
        };

        const onDocKeyDown = (e) => {
          if (e.key === 'Escape') {
            hideCtxMenu();
            if (colsPopover) colsPopover.style.display = 'none';
          }
        };

        document.addEventListener('pointerdown', onDocPointerDown);
        document.addEventListener('keydown', onDocKeyDown);

        // Columns Visibility Popover Setup
        const renderColsPopover = () => {
          colsList.innerHTML = ALL_COLS.map(c => `
            <label class="proc-col-checkbox-label">
              <input type="checkbox" data-col="${c.id}" ${visibleCols[c.id] ? 'checked' : ''}>
              <span>${c.label}</span>
            </label>
          `).join('');

          colsList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.onchange = () => {
              visibleCols[chk.dataset.col] = chk.checked;
              saveColPrefs();
              renderHeaders();
              render(procs);
            };
          });
        };

        colsBtn.onclick = (e) => {
          e.stopPropagation();
          const isShown = colsPopover.style.display !== 'none';
          colsPopover.style.display = isShown ? 'none' : 'flex';
          if (!isShown) renderColsPopover();
        };

        const updateSortIndicators = () => {
          theadRow.querySelectorAll('th[data-col]').forEach(th => {
            const col = th.dataset.col;
            const span = th.querySelector('.sort-icon');
            if (span) {
              if (col === sortCol) {
                span.innerHTML = sortDir === 'asc'
                  ? `<svg style="width:7px; height:7px; margin-left:3px; vertical-align:1px; display:inline-block;" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`
                  : `<svg style="width:7px; height:7px; margin-left:3px; vertical-align:1px; display:inline-block;" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
                th.style.color = '#ffffff';
              } else {
                span.innerHTML = '';
                th.style.color = 'var(--text-muted)';
              }
            }
          });
        };

        const setSort = (col) => {
          if (sortCol === col) {
            sortDir = (sortDir === 'desc') ? 'asc' : 'desc';
          } else {
            sortCol = col;
            sortDir = ['cpu', 'mem', 'rss', 'pss', 'vsz'].includes(col) ? 'desc' : 'asc';
          }
          render(procs);
        };

        const renderHeaders = () => {
          theadRow.innerHTML = ALL_COLS.filter(c => visibleCols[c.id]).map(c => `
            <th style="width:${c.width}; cursor:pointer; user-select:none; padding:0.55rem 0.65rem;" data-col="${c.id}" ${c.title ? `title="${c.title}"` : ''}>
              ${c.label} <span class="sort-icon" id="sortIcon_${c.id}"></span>
            </th>
          `).join('');

          theadRow.querySelectorAll('th[data-col]').forEach(th => {
            th.onclick = () => setSort(th.dataset.col);
          });
          updateSortIndicators();
        };

        const updateProcMetrics = (m) => {
          if (!bodyEl.isConnected || !m) return;
          const cpu = m.cpu !== undefined ? m.cpu : 0;
          const mem = m.memory ? m.memory.percent : 0;
          const disk = m.disk ? m.disk.percent : 0;

          const cpuVal = bodyEl.querySelector('#procMetricCpuVal');
          const cpuBar = bodyEl.querySelector('#procMetricCpuBar');
          if (cpuVal) {
            cpuVal.textContent = `${cpu}%`;
            cpuVal.style.color = cpu > 80 ? '#ef4444' : (cpu > 50 ? '#f59e0b' : '#34d399');
          }
          if (cpuBar) {
            cpuBar.style.width = `${Math.min(100, Math.max(0, cpu))}%`;
            cpuBar.style.background = cpu > 80 ? '#ef4444' : (cpu > 50 ? '#f59e0b' : '#34d399');
          }

          const memVal = bodyEl.querySelector('#procMetricMemVal');
          const memBar = bodyEl.querySelector('#procMetricMemBar');
          if (memVal) {
            memVal.textContent = `${mem}%`;
            if (m.memory && m.memory.used_formatted && m.memory.total_formatted) {
              memVal.parentElement.title = `Total Host Memory Usage: ${m.memory.used_formatted} / ${m.memory.total_formatted}`;
            }
            memVal.style.color = mem > 85 ? '#ef4444' : (mem > 60 ? '#f59e0b' : '#38bdf8');
          }
          if (memBar) {
            memBar.style.width = `${Math.min(100, Math.max(0, mem))}%`;
            memBar.style.background = mem > 85 ? '#ef4444' : (mem > 60 ? '#f59e0b' : '#38bdf8');
          }

          const diskVal = bodyEl.querySelector('#procMetricDiskVal');
          const diskBar = bodyEl.querySelector('#procMetricDiskBar');
          if (diskVal) {
            diskVal.textContent = `${disk}%`;
            if (m.disk && m.disk.used_formatted && m.disk.total_formatted) {
              diskVal.parentElement.title = `Total Root Storage Usage: ${m.disk.used_formatted} / ${m.disk.total_formatted}`;
            }
            diskVal.style.color = disk > 90 ? '#ef4444' : (disk > 75 ? '#f59e0b' : '#a78bfa');
          }
          if (diskBar) {
            diskBar.style.width = `${Math.min(100, Math.max(0, disk))}%`;
            diskBar.style.background = disk > 90 ? '#ef4444' : (disk > 75 ? '#f59e0b' : '#a78bfa');
          }
        };

        const fetchProcs = async () => {
          if (!bodyEl.isConnected) { clearInterval(timer); return; }
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/processes/list`);
            const res = await resp.json();
            if (res.success) {
              procs = res.processes || [];
              render(procs);
            }
          } catch (_) {}
        };

        const render = (list) => {
          const q = input.value.toLowerCase().trim();
          let filtered = q ? list.filter(p => (
            p.pid.toString().includes(q) ||
            p.user.toLowerCase().includes(q) ||
            p.comm.toLowerCase().includes(q) ||
            (p.args && p.args.toLowerCase().includes(q))
          )) : list;

          // Multi-attribute sorting
          filtered = [...filtered].sort((a, b) => {
            let valA = a[sortCol];
            let valB = b[sortCol];
            if (['cpu', 'mem', 'rss', 'pss', 'vsz', 'pid'].includes(sortCol)) {
              valA = (valA === null || valA === undefined) ? -1 : Number(valA);
              valB = (valB === null || valB === undefined) ? -1 : Number(valB);
              return sortDir === 'asc' ? valA - valB : valB - valA;
            }
            valA = (valA || '').toString().toLowerCase();
            valB = (valB || '').toString().toLowerCase();
            return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          });

          if (countBadge) countBadge.textContent = `${filtered.length} / ${list.length} procs`;
          updateSortIndicators();

          const visibleCount = ALL_COLS.filter(c => visibleCols[c.id]).length;
          if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${visibleCount || 1}" style="text-align:center; padding:3rem; color:var(--text-muted);">No matching processes found</td></tr>`;
            return;
          }

          tbody.innerHTML = filtered.map(p => {
            const cpuColor = p.cpu > 50 ? '#ef4444' : (p.cpu > 15 ? '#f59e0b' : '#34d399');
            const memColor = p.mem > 50 ? '#ef4444' : (p.mem > 20 ? '#f59e0b' : 'inherit');
            const rssDisplay = formatKb(p.rss);
            const pssDisplay = (p.pss !== null && p.pss !== undefined) ? formatKb(p.pss) : '<span style="color:var(--text-muted);">-</span>';
            const vszDisplay = formatKb(p.vsz);
            const st = parseProcessState(p.stat);

            const cells = [];
            if (visibleCols.pid) {
              cells.push(`<td style="padding:0.45rem 0.65rem;"><code>${p.pid}</code></td>`);
            }
            if (visibleCols.user) {
              cells.push(`<td style="padding:0.45rem 0.65rem; color:var(--text-secondary); max-width:125px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;" title="${escapeHtml(p.user)}">${escapeHtml(p.user)}</td>`);
            }
            if (visibleCols.cpu) {
              cells.push(`<td style="padding:0.45rem 0.65rem;"><strong style="color:${cpuColor};">${p.cpu}%</strong></td>`);
            }
            if (visibleCols.mem) {
              cells.push(`<td style="padding:0.45rem 0.65rem; color:${memColor}; font-weight:600; font-family:var(--font-mono); font-size:0.75rem;" title="Physical RSS: ${rssDisplay}">${p.mem}%</td>`);
            }
            if (visibleCols.rss) {
              cells.push(`<td style="padding:0.45rem 0.65rem; font-family:var(--font-mono); font-size:0.73rem; color:#38bdf8;" title="Resident Physical Memory (RSS): ${p.rss} KB">${rssDisplay}</td>`);
            }
            if (visibleCols.pss) {
              cells.push(`<td style="padding:0.45rem 0.65rem; font-family:var(--font-mono); font-size:0.73rem; color:#a78bfa;" title="Proportional Set Size (PSS): ${p.pss !== null && p.pss !== undefined ? p.pss + ' KB' : 'Unavailable'}">${pssDisplay}</td>`);
            }
            if (visibleCols.vsz) {
              cells.push(`<td style="padding:0.45rem 0.65rem; font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted);" title="Virtual Memory Size: ${p.vsz} KB">${vszDisplay}</td>`);
            }
            if (visibleCols.stat) {
              cells.push(`
                <td style="padding:0.45rem 0.65rem;">
                  <span title="${escapeHtml(st.desc)}" style="display:inline-flex; align-items:center; gap:5px; padding:2px 7px; border-radius:12px; background:${st.bg}; color:${st.color}; font-size:0.71rem; font-weight:500; cursor:help;">
                    <span style="width:6px; height:6px; border-radius:50%; background:${st.color}; flex-shrink:0;"></span>
                    <span>${escapeHtml(st.label)}</span>
                  </span>
                </td>
              `);
            }
            if (visibleCols.comm) {
              cells.push(`<td style="padding:0.45rem 0.65rem; font-family:var(--font-mono); font-size:0.74rem; max-width:380px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(p.args || p.comm)}">${escapeHtml(p.args || p.comm)}</td>`);
            }

            return `
              <tr data-pid="${p.pid}" style="border-bottom:1px solid rgba(255,255,255,0.04); cursor:context-menu;">
                ${cells.join('')}
              </tr>
            `;
          }).join('');
        };

        // Wire right click context menu on process rows
        tbody.addEventListener('contextmenu', (e) => {
          const row = e.target.closest('tr[data-pid]');
          if (!row) return;
          e.preventDefault();
          e.stopPropagation();

          const pid = parseInt(row.dataset.pid, 10);
          const proc = procs.find(p => p.pid === pid);
          if (proc) {
            showProcContextMenu(e.clientX, e.clientY, proc);
          }
        });

        input.oninput = () => render(procs);
        bodyEl.querySelector('#procRefreshBtn').onclick = () => {
          fetchProcs();
          if (window.DesktopTelemetry) window.DesktopTelemetry.poll(true);
        };

        renderHeaders();
        fetchProcs();
        const unsubProcMetrics = window.DesktopTelemetry ? window.DesktopTelemetry.subscribe(updateProcMetrics) : null;
        if (window.DesktopTelemetry) window.DesktopTelemetry.poll();

        const timer = setInterval(() => {
          fetchProcs();
        }, 8000);
        winObj.onClose = () => {
          clearInterval(timer);
          if (unsubProcMetrics) unsubProcMetrics();
          hideCtxMenu();
          document.removeEventListener('pointerdown', onDocPointerDown);
          document.removeEventListener('keydown', onDocKeyDown);
        };
      }
    });
  }

  async killProcess(serverId, pid, signal, comm) {
    let confirmMsg = `Send ${signal} to PID ${pid} (${comm})?`;
    if (signal === 'SIGKILL') {
      confirmMsg = `FORCE KILL: Are you sure you want to terminate PID ${pid} (${comm}) immediately with SIGKILL (-9)?`;
    } else if (signal === 'SIGTERM') {
      confirmMsg = `Terminate PID ${pid} (${comm}) gracefully with SIGTERM (-15)?`;
    } else if (signal === 'SIGSTOP') {
      confirmMsg = `Pause execution of PID ${pid} (${comm}) with SIGSTOP (-19)?`;
    } else if (signal === 'SIGCONT') {
      confirmMsg = `Resume execution of PID ${pid} (${comm}) with SIGCONT (-18)?`;
    }

    if (!confirm(confirmMsg)) return false;
    try {
      const resp = await fetch(`/api/servers/${serverId}/processes/kill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, signal })
      });
      const res = await resp.json();
      if (window.showToast) {
        window.showToast(res.message, res.success ? 'success' : 'error');
      } else {
        alert(res.message);
      }
      return res.success;
    } catch (e) {
      alert('Error signalling process: ' + e);
      return false;
    }
  }

  // =========================================================================
  // 6. SERVICES (systemd)
  // =========================================================================
  launchServices(params = {}) {
    return WindowManager.createWindow({
      appId: 'services',
      multiInstance: false,
      title: `System Services - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
      width: 860,
      height: 520,
      minWidth: 460,
      minHeight: 280,
      contentHtml: `
        <div style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas);">
          <div style="height:36px; background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; padding:0 0.75rem;">
            <input type="text" id="svcSearchInput" placeholder="Filter unit or description..." class="form-control" style="width:240px; padding:0.2rem 0.5rem; font-size:0.75rem;">
            <button class="btn btn-secondary btn-sm" id="svcRefreshBtn">Refresh</button>
          </div>
          <div class="table-responsive" style="flex:1; overflow-y:auto;">
            <table class="table">
              <thead><tr><th style="width:90px;">Status</th><th style="width:220px;">Unit Name</th><th>Description</th><th style="width:170px; text-align:right;">Actions</th></tr></thead>
              <tbody id="svcTableBody"><tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading services...</td></tr></tbody>
            </table>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        let svcs = [];
        const tbody = bodyEl.querySelector('#svcTableBody');
        const input = bodyEl.querySelector('#svcSearchInput');

        const fetchSvcs = async () => {
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/services/list`);
            const res = await resp.json();
            if (res.success) {
              svcs = res.services || [];
              render(svcs);
            }
          } catch (_) {}
        };

        const render = (list) => {
          const q = input.value.toLowerCase().trim();
          const filtered = q ? list.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) : list;
          tbody.innerHTML = filtered.map(s => `
            <tr>
              <td>
                <span class="badge ${s.is_running ? 'badge-online' : 'badge-offline'}">
                  <span class="status-dot ${s.is_running ? 'connected' : 'disconnected'}"></span>
                  ${s.active}
                </span>
              </td>
              <td><strong>${s.name}</strong></td>
              <td style="color:var(--text-secondary); max-width:320px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${s.description}</td>
              <td style="text-align:right;">
                ${s.is_running ? `
                  <button class="btn btn-secondary btn-sm svc-act-btn" data-name="${s.name}" data-act="restart">Restart</button>
                  <button class="btn btn-danger btn-sm svc-act-btn" data-name="${s.name}" data-act="stop">Stop</button>
                ` : `
                  <button class="btn btn-primary btn-sm svc-act-btn" data-name="${s.name}" data-act="start">Start</button>
                `}
                <button class="btn btn-ghost btn-sm" onclick="DesktopApps.launch('logs', {service: '${s.name}'})">Logs</button>
              </td>
            </tr>
          `).join('');
        };

        tbody.onclick = (e) => {
          const btn = e.target.closest('.svc-act-btn');
          if (btn) {
            const name = btn.dataset.name;
            const act = btn.dataset.act;
            DesktopApps.svcAction(this.serverId, name, act);
          }
        };

        input.oninput = () => render(svcs);
        bodyEl.querySelector('#svcRefreshBtn').onclick = fetchSvcs;
        fetchSvcs();
      }
    });
  }

  async svcAction(serverId, name, action) {
    if (!confirm(`Apply ${action} to service ${name}?`)) return;
    try {
      const resp = await fetch(`/api/servers/${serverId}/services/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, action })
      });
      const res = await resp.json();
      if (window.showToast) window.showToast(res.message, res.success ? 'success' : 'error');
    } catch (e) {
      alert('Error: ' + e);
    }
  }

  // =========================================================================
  // 7. LOGS APPLICATION (journalctl)
  // =========================================================================
  launchLogs(params = {}) {
    const service = params.service || '';
    return WindowManager.createWindow({
      appId: 'logs',
      multiInstance: false,
      title: `System Logs - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
      width: 860,
      height: 520,
      minWidth: 460,
      minHeight: 280,
      contentHtml: `
        <div style="height:100%; display:flex; flex-direction:column; background:#090d16;">
          <div style="height:36px; background:#0f172a; border-bottom:1px solid #1e293b; display:flex; align-items:center; justify-content:space-between; padding:0 0.65rem;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <input type="text" id="logUnitInput" placeholder="Unit (e.g. ssh, nginx)" class="form-control" style="width:160px; padding:0.2rem 0.5rem; font-size:0.75rem;" value="${service}">
              <select id="logLinesSelect" class="form-control" style="width:90px; padding:0.2rem 0.4rem; font-size:0.72rem;">
                <option value="100">100 lines</option>
                <option value="250" selected>250 lines</option>
                <option value="500">500 lines</option>
              </select>
              <button class="btn btn-primary btn-sm" id="logFetchBtn">Fetch</button>
            </div>
            <div style="display:flex; align-items:center; gap:0.3rem;">
              <button class="btn btn-ghost btn-sm" id="logCopyBtn">Copy</button>
              <button class="btn btn-ghost btn-sm" id="logClearBtn">Clear</button>
            </div>
          </div>
          <pre id="logPre" style="flex:1; margin:0; padding:0.85rem 1rem; overflow-y:auto; font-family:var(--font-mono); font-size:0.78rem; color:#f8fafc; line-height:1.4; white-space:pre-wrap; word-break:break-all;"></pre>
        </div>
      `,
      onInit: (bodyEl) => {
        const pre = bodyEl.querySelector('#logPre');
        const unitInput = bodyEl.querySelector('#logUnitInput');
        const linesSelect = bodyEl.querySelector('#logLinesSelect');

        const fetchLogs = async () => {
          pre.textContent = 'Streaming journal logs...';
          try {
            const u = unitInput.value.trim();
            const lines = linesSelect.value;
            const resp = await fetch(`/api/servers/${this.serverId}/logs/fetch?service=${encodeURIComponent(u)}&lines=${lines}`);
            const res = await resp.json();
            if (res.success) {
              pre.textContent = res.logs || 'No entries.';
              pre.scrollTop = pre.scrollHeight;
            } else {
              pre.textContent = 'Error: ' + res.error;
            }
          } catch (e) {
            pre.textContent = 'Fetch error: ' + e;
          }
        };

        bodyEl.querySelector('#logFetchBtn').onclick = fetchLogs;
        bodyEl.querySelector('#logClearBtn').onclick = () => { pre.textContent = ''; };
        bodyEl.querySelector('#logCopyBtn').onclick = () => {
          navigator.clipboard.writeText(pre.textContent).then(() => {
            if (window.showToast) window.showToast('Logs copied to clipboard', 'success');
          });
        };

        fetchLogs();
      }
    });
  }

  // =========================================================================
  // 8. HARDWARE & 9. NETWORK & 10. SERVERS
  // =========================================================================
  launchHardware(params = {}) {
    return WindowManager.createWindow({
      appId: 'hardware',
      multiInstance: false,
      title: `Hardware Architecture - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#c084fc"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>',
      width: 760,
      height: 480,
      contentHtml: `
        <div style="height:100%; overflow-y:auto; padding:1.25rem; background:var(--bg-canvas);" id="hwBody">
          <div style="text-align:center; padding:2rem; color:var(--text-muted);">Fetching hardware telemetry...</div>
        </div>
      `,
      onInit: async (bodyEl) => {
        try {
          const resp = await fetch(`/api/servers/${this.serverId}/system/info`);
          const res = await resp.json();
          if (res.success) {
            const d = res.data;
            bodyEl.querySelector('#hwBody').innerHTML = `
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                <div class="card">
                  <div class="card-header"><span class="card-title">Processor & OS</span></div>
                  <table class="table">
                    <tr><td style="color:var(--text-muted);">Hostname</td><td><code>${d.hostname}</code></td></tr>
                    <tr><td style="color:var(--text-muted);">Architecture</td><td><code>${d.arch}</code></td></tr>
                    <tr><td style="color:var(--text-muted);">Kernel</td><td><code>${d.kernel}</code></td></tr>
                    <tr><td style="color:var(--text-muted);">CPU Cores</td><td><code>${d.cpu_cores}</code></td></tr>
                    <tr><td style="color:var(--text-muted);">CPU Model</td><td>${d.cpu_model}</td></tr>
                  </table>
                </div>
                <div class="card">
                  <div class="card-header"><span class="card-title">Addressing</span></div>
                  <table class="table">
                    <tr><td style="color:var(--text-muted);">Public IP</td><td><strong style="color:var(--accent-cyan);">${d.public_ip}</strong></td></tr>
                    <tr><td style="color:var(--text-muted);">SSH Endpoint</td><td><code>${this.serverHost}</code></td></tr>
                  </table>
                </div>
              </div>
              <div class="card">
                <div class="card-header"><span class="card-title">Network Interfaces</span></div>
                <table class="table">
                  <thead><tr><th>Interface</th><th>Status</th><th>IPs</th></tr></thead>
                  <tbody>${(d.interfaces || []).map(i => `<tr><td><code>${i.name}</code></td><td><span class="badge ${i.status === 'UP' ? 'badge-online' : 'badge-offline'}">${i.status}</span></td><td>${(i.addrs || []).join(', ')}</td></tr>`).join('')}</tbody>
                </table>
              </div>
            `;
          }
        } catch (_) {}
      }
    });
  }

  launchNetwork(params = {}) {
    return WindowManager.createWindow({
      appId: 'network',
      multiInstance: false,
      title: `Network Sockets & Ports - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg>',
      width: 760,
      height: 480,
      contentHtml: `
        <div style="height:100%; overflow-y:auto; padding:1.25rem; background:var(--bg-canvas);" id="netBody">
          <table class="table">
            <thead><tr><th>Proto</th><th>Local Address / Port</th><th>Process / Program</th></tr></thead>
            <tbody id="netTable"><tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--text-muted);">Checking open sockets...</td></tr></tbody>
          </table>
        </div>
      `,
      onInit: async (bodyEl) => {
        try {
          const resp = await fetch(`/api/servers/${this.serverId}/network/info`);
          const res = await resp.json();
          const tbody = bodyEl.querySelector('#netTable');
          if (res.success && res.data.ports) {
            tbody.innerHTML = res.data.ports.map(p => `
              <tr>
                <td><span class="badge badge-online">${p.proto.toUpperCase()}</span></td>
                <td><code>${p.local_addr}</code></td>
                <td><code>${p.process}</code></td>
              </tr>
            `).join('');
          } else {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--text-muted);">No open sockets found</td></tr>`;
          }
        } catch (_) {}
      }
    });
  }

  launchServers(params = {}) {
    return this.launchSettings({ tab: 'servers' });
  }

  // =========================================================================
  // 10. NGINX & DOMAINS (Reverse Proxy, Config Editor & Let's Encrypt SSL)
  // =========================================================================
  launchNginx(params = {}) {
    const existing = WindowManager.getWindowByAppId('nginx');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      if (params.tab && existing._switchTab) {
        existing._switchTab(params.tab, params);
      }
      return existing;
    }

    const ngxWinId = 'nginx_' + Date.now();
    let currentTab = params.tab || 'domains';
    let statusData = null;
    let sitesList = [];
    let certsList = [];
    let currentEditFile = params.file || '';
    let isFileDirty = false;

    return WindowManager.createWindow({
      appId: 'nginx',
      multiInstance: false,
      title: `Nginx & Domains (Proxy & SSL) - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="rgba(5,150,105,0.2)" stroke="#10b981" stroke-width="1.6"/><path d="M7 16V8l5 8V8M16 8v8" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      width: 960,
      height: 600,
      minWidth: 640,
      minHeight: 380,
      contentHtml: `
        <div class="nginx-app-container" id="nginxContainer_${ngxWinId}" style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); color:var(--text-primary); font-family:var(--font-sans); position:relative; overflow:hidden;">
          <!-- Top App Bar / Status Header -->
          <div style="background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); padding:0.55rem 0.9rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; z-index:10;">
            <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:0.4rem;" id="nginxStatusPill_${ngxWinId}">
                <span class="status-dot disconnected" id="nginxDot_${ngxWinId}"></span>
                <span style="font-size:0.78rem; font-weight:600;" id="nginxStatusText_${ngxWinId}">Checking Nginx...</span>
              </div>
              <span style="color:var(--border-subtle);">|</span>
              <div style="display:flex; align-items:center; gap:0.4rem;" id="certbotStatusPill_${ngxWinId}">
                <span class="status-dot disconnected" id="certbotDot_${ngxWinId}"></span>
                <span style="font-size:0.75rem; color:var(--text-secondary);" id="certbotStatusText_${ngxWinId}">Checking Certbot...</span>
              </div>
            </div>
            
            <!-- Quick Actions -->
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-secondary btn-xs" id="testNginxBtn_${ngxWinId}" title="Run nginx -t syntax verification">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                nginx -t
              </button>
              <button class="btn btn-secondary btn-xs" id="reloadNginxBtn_${ngxWinId}" title="Gracefully reload Nginx configuration">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Reload
              </button>
              <button class="btn btn-secondary btn-xs" id="restartNginxBtn_${ngxWinId}" title="Restart Nginx service">
                Restart
              </button>
              <button class="btn btn-ghost btn-xs" id="refreshAllBtn_${ngxWinId}" title="Refresh status and sites">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
              </button>
            </div>
          </div>

          <!-- Tab Bar Navigation -->
          <div style="background:#0b101b; border-bottom:1px solid var(--border-subtle); display:flex; padding:0 0.85rem; gap:0.4rem; align-items:center;">
            <button class="ngx-tab-nav-btn active" data-tab="domains" id="tabBtn_domains_${ngxWinId}" style="background:none; border:none; border-bottom:2px solid #10b981; color:#ffffff; font-weight:600; font-size:0.78rem; padding:0.55rem 0.75rem; cursor:pointer; display:flex; align-items:center; gap:0.45rem;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              Domains &amp; Reverse Proxy Routing
            </button>
            <button class="ngx-tab-nav-btn" data-tab="editor" id="tabBtn_editor_${ngxWinId}" style="background:none; border:none; border-bottom:2px solid transparent; color:var(--text-secondary); font-weight:500; font-size:0.78rem; padding:0.55rem 0.75rem; cursor:pointer; display:flex; align-items:center; gap:0.45rem;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              Config Files Editor
            </button>
            <button class="ngx-tab-nav-btn" data-tab="ssl" id="tabBtn_ssl_${ngxWinId}" style="background:none; border:none; border-bottom:2px solid transparent; color:var(--text-secondary); font-weight:500; font-size:0.78rem; padding:0.55rem 0.75rem; cursor:pointer; display:flex; align-items:center; gap:0.45rem;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              SSL Certificates (Certbot)
            </button>
          </div>

          <!-- Tab Content Area -->
          <div style="flex:1; overflow-y:auto; position:relative; display:flex; flex-direction:column;" id="tabContent_${ngxWinId}">
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const container = bodyEl.querySelector(`#nginxContainer_${ngxWinId}`);
        const contentPane = bodyEl.querySelector(`#tabContent_${ngxWinId}`);
        const ngxDot = bodyEl.querySelector(`#nginxDot_${ngxWinId}`);
        const ngxText = bodyEl.querySelector(`#nginxStatusText_${ngxWinId}`);
        const certDot = bodyEl.querySelector(`#certbotDot_${ngxWinId}`);
        const certText = bodyEl.querySelector(`#certbotStatusText_${ngxWinId}`);

        // Modal for displaying real Linux command and Certbot outputs
        const showCommandOutputModal = (title, outputText, isSuccess) => {
          const modalBackdrop = document.createElement('div');
          modalBackdrop.style.cssText = 'position:absolute; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:110; padding:1rem;';
          modalBackdrop.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; width:100%; max-width:620px; box-shadow:0 20px 40px rgba(0,0,0,0.65); display:flex; flex-direction:column; overflow:hidden;">
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.8rem 1.1rem; border-bottom:1px solid var(--border-subtle); background:#0c121e;">
                <h4 style="margin:0; font-size:0.92rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:0.45rem;">
                  <span class="status-dot ${isSuccess ? 'connected' : 'disconnected'}"></span>
                  ${escapeHtml(title)}
                </h4>
                <button type="button" class="btn btn-ghost btn-xs" id="closeCmdModalBtn_${ngxWinId}" style="padding:2px 6px;">&times;</button>
              </div>
              <div style="padding:1rem; background:#070b12; max-height:55vh; overflow-y:auto;">
                <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:0.4rem; font-family:var(--font-sans);">Server Command Execution Output:</div>
                <pre style="margin:0; font-family:'Fira Code', monospace; font-size:0.75rem; line-height:1.55; color:${isSuccess ? '#34d399' : '#f87171'}; white-space:pre-wrap; word-break:break-all;">${escapeHtml(outputText || 'Command executed with no output.')}</pre>
              </div>
              <div style="display:flex; justify-content:flex-end; padding:0.65rem 1.1rem; border-top:1px solid var(--border-subtle); background:#0c121e;">
                <button type="button" class="btn btn-secondary btn-sm" id="okCmdModalBtn_${ngxWinId}">Close</button>
              </div>
            </div>
          `;
          container.appendChild(modalBackdrop);
          const closeModal = () => { if (modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop); };
          modalBackdrop.querySelector(`#closeCmdModalBtn_${ngxWinId}`).onclick = closeModal;
          modalBackdrop.querySelector(`#okCmdModalBtn_${ngxWinId}`).onclick = closeModal;
        };

        // Safe JSON fetcher that never throws SyntaxError on HTML/500 errors
        const safeFetchJson = async (url, options = {}) => {
          try {
            const resp = await fetch(url, options);
            const contentType = resp.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              return await resp.json();
            }
            const text = await resp.text();
            return {
              success: false,
              message: text ? `Server Error (${resp.status}): ${text.substring(0, 300)}` : `Request failed (${resp.status})`
            };
          } catch (err) {
            return {
              success: false,
              message: `Network/Request Error: ${err.message || err}`
            };
          }
        };

        // 1. Fetch Status
        const fetchStatus = async () => {
          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/status`);
            if (res.success && res.status) {
              statusData = res.status;
              updateStatusHeader(statusData);
            }
          } catch (e) {
            console.error('Error fetching Nginx status:', e);
          }
        };

        const updateStatusHeader = (st) => {
          if (!st) return;
          if (st.nginx_installed) {
            if (st.nginx_running) {
              ngxDot.className = 'status-dot connected';
              const verDisplay = (st.nginx_version && !st.nginx_version.toLowerCase().includes('not found')) ? `(${escapeHtml(st.nginx_version)})` : '';
              ngxText.innerHTML = `Nginx: <span style="color:#10b981;">Active</span> <span style="font-weight:400;color:var(--text-muted);font-size:0.72rem;">${verDisplay}</span>`;
            } else {
              ngxDot.className = 'status-dot disconnected';
              ngxText.innerHTML = `Nginx: <span style="color:#f59e0b;">Inactive (Stopped)</span>`;
            }
          } else {
            ngxDot.className = 'status-dot disconnected';
            ngxText.innerHTML = `Nginx: <span style="color:#ef4444;">Not Installed</span> <button class="btn btn-primary btn-xs" id="hdrInstallNginx_${ngxWinId}" style="margin-left:6px;padding:1px 6px;font-size:0.68rem;">Install Nginx</button>`;
            const instBtn = bodyEl.querySelector(`#hdrInstallNginx_${ngxWinId}`);
            if (instBtn) instBtn.onclick = () => installSoftware('nginx');
          }

          if (st.certbot_installed) {
            certDot.className = 'status-dot connected';
            certText.innerHTML = `Certbot: <span style="color:#10b981;">Ready</span> <span style="font-weight:400;color:var(--text-muted);font-size:0.72rem;">(${escapeHtml(st.certbot_version)})</span>`;
          } else if (st.certbot_broken) {
            certDot.className = 'status-dot disconnected';
            certText.innerHTML = `Certbot: <span style="color:#ef4444;" title="${escapeHtml(st.certbot_error || 'Dependency conflict')}">Broken (OpenSSL Error)</span> <button class="btn btn-secondary btn-xs" id="hdrRepairCert_${ngxWinId}" style="margin-left:6px;padding:1px 6px;font-size:0.68rem;" title="Reinstall and repair Certbot OpenSSL dependencies">Repair Certbot</button>`;
            const repBtn = bodyEl.querySelector(`#hdrRepairCert_${ngxWinId}`);
            if (repBtn) repBtn.onclick = () => installSoftware('certbot');
          } else {
            certDot.className = 'status-dot disconnected';
            certText.innerHTML = `Certbot: <span style="color:var(--text-muted);">Not Installed</span> <button class="btn btn-secondary btn-xs" id="hdrInstallCert_${ngxWinId}" style="margin-left:6px;padding:1px 6px;font-size:0.68rem;">Install Certbot</button>`;
            const instBtn = bodyEl.querySelector(`#hdrInstallCert_${ngxWinId}`);
            if (instBtn) instBtn.onclick = () => installSoftware('certbot');
          }
        };

        // 2. Fetch Sites
        const fetchSites = async () => {
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/nginx/sites`);
            const res = await resp.json();
            if (res.success && res.sites) {
              sitesList = res.sites;
            }
          } catch (e) {
            console.error('Error fetching sites:', e);
          }
        };

        // 3. Fetch Certificates
        const fetchCertificates = async () => {
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/nginx/ssl/certificates`);
            const res = await resp.json();
            if (res.success && res.certificates) {
              certsList = res.certificates;
            }
          } catch (e) {
            console.error('Error fetching certificates:', e);
          }
        };

        // 4. Render Domains Tab
        const renderDomainsTab = async () => {
          contentPane.innerHTML = `
            <div style="padding:0.9rem; display:flex; flex-direction:column; height:100%; box-sizing:border-box;">
              <!-- Sub-header Toolbar -->
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.6rem; flex:1; max-width:440px;">
                  <div style="position:relative; flex:1;">
                    <input type="text" id="domainFilterInput_${ngxWinId}" placeholder="Filter domains, proxy targets, or configs..." class="form-control" style="width:100%; font-size:0.78rem; padding:0.35rem 0.6rem 0.35rem 1.85rem; box-sizing:border-box;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); color:var(--text-muted); pointer-events:none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  <button class="btn btn-secondary btn-sm" id="domainRefreshBtn_${ngxWinId}" title="Refresh site listings" style="padding:0.35rem 0.65rem;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                  </button>
                </div>
                <button class="btn btn-primary btn-sm" id="openAddDomainBtn_${ngxWinId}" style="display:flex; align-items:center; gap:0.4rem; padding:0.4rem 0.8rem; font-weight:600;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Domain / Reverse Proxy
                </button>
              </div>

              <!-- Sites Table Container -->
              <div class="table-responsive" style="flex:1; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:6px; background:var(--bg-surface);">
                <table class="table" style="margin:0; width:100%; border-collapse:collapse; font-size:0.78rem;">
                  <thead>
                    <tr style="background:#0d131f; border-bottom:1px solid var(--border-subtle); color:var(--text-muted); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.04em;">
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Domain / Server Name</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Routing Target</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Ports</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">SSL (HTTPS)</th>
                      <th style="padding:0.6rem 0.75rem; text-align:center; font-weight:600; width:90px;">Status</th>
                      <th style="padding:0.6rem 0.75rem; text-align:right; font-weight:600; width:190px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="sitesTableBody_${ngxWinId}">
                    <tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Loading domains &amp; routes...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          `;

          const addBtn = contentPane.querySelector(`#openAddDomainBtn_${ngxWinId}`);
          if (addBtn) addBtn.onclick = () => openAddDomainModal();

          const filterInput = contentPane.querySelector(`#domainFilterInput_${ngxWinId}`);
          if (filterInput) filterInput.oninput = () => renderSitesList();

          const refreshBtn = contentPane.querySelector(`#domainRefreshBtn_${ngxWinId}`);
          if (refreshBtn) refreshBtn.onclick = async () => {
            refreshBtn.disabled = true;
            await fetchSites();
            renderSitesList();
            refreshBtn.disabled = false;
          };

          await fetchSites();
          renderSitesList();
        };

        const renderSitesList = () => {
          const tbody = contentPane.querySelector(`#sitesTableBody_${ngxWinId}`);
          if (!tbody) return;

          const filterInput = contentPane.querySelector(`#domainFilterInput_${ngxWinId}`);
          const q = filterInput ? filterInput.value.toLowerCase().trim() : '';

          let filtered = sitesList;
          if (q) {
            filtered = sitesList.filter(s => {
              const names = (s.server_names || []).join(' ').toLowerCase();
              const target = (s.proxy_pass || s.root || '').toLowerCase();
              const fname = (s.filename || '').toLowerCase();
              return names.includes(q) || target.includes(q) || fname.includes(q);
            });
          }

          if (filtered.length === 0) {
            tbody.innerHTML = `
              <tr>
                <td colspan="6" style="text-align:center; padding:3.5rem 1.5rem;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:0.6rem; color:var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.3" style="color:var(--text-muted); opacity:0.6;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    <div style="font-weight:600; font-size:0.88rem; color:var(--text-primary);">${q ? 'No matching domains found' : 'No Domains or Proxy Routes Configured'}</div>
                    <div style="font-size:0.75rem; max-width:380px;">${q ? 'Try clearing your search query.' : 'Forward traffic from your domains to background apps running on specific ports (e.g. Node, Python, Docker) with automated SSL.'}</div>
                    ${!q ? `<button class="btn btn-primary btn-sm" id="emptyAddBtn_${ngxWinId}" style="margin-top:0.4rem;">Add Your First Domain / Reverse Proxy</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
            const emptyBtn = tbody.querySelector(`#emptyAddBtn_${ngxWinId}`);
            if (emptyBtn) emptyBtn.onclick = () => openAddDomainModal();
            return;
          }

          tbody.innerHTML = filtered.map(site => {
            const domainDisplay = (site.server_names && site.server_names.length > 0 && site.server_names[0] !== '_')
              ? site.server_names.join(', ')
              : (site.filename === 'default' ? 'Default Host (_)' : site.filename);

            const isProxy = site.site_type === 'proxy' || Boolean(site.proxy_pass);
            const targetBadge = isProxy
              ? `<span style="background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.22); padding:2px 7px; border-radius:4px; font-family:var(--font-mono); font-size:0.72rem; display:inline-block; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(site.proxy_pass)}">Proxy &rarr; ${escapeHtml(site.proxy_pass || 'Port Routing')}</span>`
              : `<span style="background:rgba(203,213,225,0.08); color:#cbd5e1; border:1px solid rgba(255,255,255,0.12); padding:2px 7px; border-radius:4px; font-family:var(--font-mono); font-size:0.72rem; display:inline-block; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(site.root)}">Static &rarr; ${escapeHtml(site.root || '/var/www')}</span>`;

            const portsBadges = (site.ports && site.ports.length > 0)
              ? site.ports.map(p => {
                  const isSslPort = (p === 443 || String(p).includes('443') || String(p).includes('ssl'));
                  return `<span style="background:${isSslPort ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.1)'}; color:${isSslPort ? '#34d399' : '#94a3b8'}; border:1px solid ${isSslPort ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.2)'}; padding:1px 5px; border-radius:3px; font-family:var(--font-mono); font-size:0.68rem; margin-right:3px;">${escapeHtml(p)}</span>`;
                }).join('')
              : '<span style="color:var(--text-muted);">-</span>';

            const sslCell = site.has_ssl
              ? `<span class="badge badge-online" style="display:inline-flex; align-items:center; gap:4px; font-size:0.7rem; padding:2px 6px;">
                   <span class="status-dot connected"></span> HTTPS
                 </span>`
              : `<div style="display:flex; align-items:center; gap:4px;">
                   <span class="badge badge-offline" style="display:inline-flex; align-items:center; gap:4px; font-size:0.7rem; padding:2px 6px;">
                     <span class="status-dot disconnected"></span> HTTP Only
                   </span>
                   <button class="btn btn-secondary btn-xs issue-ssl-btn" data-domain="${escapeHtml(site.server_names[0] || site.filename)}" title="Issue Let's Encrypt certificate" style="padding:1px 6px; font-size:0.68rem;">+ SSL</button>
                 </div>`;

            const statusToggle = site.is_conf_d
              ? `<span style="font-size:0.7rem; color:var(--text-muted);" title="File resides in conf.d/ (always loaded)">conf.d</span>`
              : `<button class="btn btn-xs toggle-site-btn ${site.enabled ? 'btn-secondary' : 'btn-ghost'}" data-file="${escapeHtml(site.filename)}" data-enable="${!site.enabled}" style="padding:2px 8px; font-size:0.7rem; min-width:64px;">
                   ${site.enabled ? '<span style="color:#10b981;">Enabled</span>' : '<span style="color:var(--text-muted);">Disabled</span>'}
                 </button>`;

            return `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:0.6rem 0.75rem;">
                  <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(domainDisplay)}</div>
                  <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted); margin-top:1px;">${escapeHtml(site.filename)}</div>
                </td>
                <td style="padding:0.6rem 0.75rem;">${targetBadge}</td>
                <td style="padding:0.6rem 0.75rem;">${portsBadges}</td>
                <td style="padding:0.6rem 0.75rem;">${sslCell}</td>
                <td style="padding:0.6rem 0.75rem; text-align:center;">${statusToggle}</td>
                <td style="padding:0.6rem 0.75rem; text-align:right;">
                  <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.35rem;">
                    <button class="btn btn-secondary btn-xs edit-config-btn" data-file="${escapeHtml(site.filename)}" title="Edit configuration file">
                      Config
                    </button>
                    <button class="btn btn-danger btn-xs delete-site-btn" data-file="${escapeHtml(site.filename)}" data-domain="${escapeHtml(domainDisplay)}" title="Delete site configuration">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('');

          // Wire row event listeners
          tbody.querySelectorAll('.toggle-site-btn').forEach(btn => {
            btn.onclick = async () => {
              const filename = btn.dataset.file;
              const enable = btn.dataset.enable === 'true';
              btn.disabled = true;
              try {
                const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/toggle`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename, enable })
                });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(res.message || 'Site toggled successfully', 'success');
                  await fetchSites();
                  renderSitesList();
                } else {
                  if (window.showToast) window.showToast(res.message || 'Failed to toggle site', 'error');
                }
              } catch (e) {
                alert('Error toggling site: ' + e);
              } finally {
                btn.disabled = false;
              }
            };
          });

          tbody.querySelectorAll('.edit-config-btn').forEach(btn => {
            btn.onclick = () => {
              const filename = btn.dataset.file;
              switchTab('editor', { file: filename });
            };
          });

          tbody.querySelectorAll('.issue-ssl-btn').forEach(btn => {
            btn.onclick = () => {
              const domain = btn.dataset.domain;
              openIssueSslModal(domain);
            };
          });

          tbody.querySelectorAll('.delete-site-btn').forEach(btn => {
            btn.onclick = async () => {
              const filename = btn.dataset.file;
              const domain = btn.dataset.domain;
              if (!confirm(`Are you sure you want to permanently delete the site configuration '${filename}' (${domain})?\n\nThis will remove the configuration and its enabled symlink.`)) {
                return;
              }
              btn.disabled = true;
              try {
                const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/delete`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename })
                });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(res.message || 'Site deleted successfully', 'success');
                  await fetchSites();
                  renderSitesList();
                } else {
                  if (window.showToast) window.showToast(res.message || 'Failed to delete site', 'error');
                }
              } catch (e) {
                alert('Error deleting site: ' + e);
              } finally {
                btn.disabled = false;
              }
            };
          });
        };

        // 5. Render Editor Tab
        const renderEditorTab = async (opts = {}) => {
          if (opts.file) {
            currentEditFile = opts.file;
          }

          contentPane.innerHTML = `
            <div style="display:flex; flex-direction:column; height:100%; box-sizing:border-box;">
              <!-- Editor Sub-bar -->
              <div style="background:#090d16; border-bottom:1px solid var(--border-subtle); padding:0.45rem 0.9rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                  <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Config File:</span>
                  <select class="form-control" id="editorFileSelect_${ngxWinId}" style="width:260px; font-size:0.78rem; padding:0.25rem 0.5rem; font-family:var(--font-mono);">
                    <option value="/etc/nginx/nginx.conf">/etc/nginx/nginx.conf (Main)</option>
                    ${sitesList.map(s => `
                      <option value="${escapeHtml(s.filename)}" ${s.filename === currentEditFile ? 'selected' : ''}>
                        ${escapeHtml(s.filename)} (${(s.server_names || []).slice(0, 1).join('') || 'site'})
                      </option>
                    `).join('')}
                  </select>
                  <button class="btn btn-ghost btn-xs" id="reloadEditorFileBtn_${ngxWinId}" title="Reload file from disk">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                  </button>
                </div>

                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <button class="btn btn-secondary btn-xs" id="editorTestBtn_${ngxWinId}" title="Test syntax on remote host without saving">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Test Syntax (nginx -t)
                  </button>
                  <button class="btn btn-primary btn-xs" id="editorSaveBtn_${ngxWinId}" style="display:flex; align-items:center; gap:4px; font-weight:600; padding:0.35rem 0.75rem;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Save &amp; Reload Nginx
                  </button>
                </div>
              </div>

              <!-- Main Code Surface -->
              <div style="flex:1; position:relative; display:flex; flex-direction:column; background:#070b12;">
                <textarea id="ngxCodeArea_${ngxWinId}" spellcheck="false" placeholder="Loading configuration..." style="flex:1; width:100%; border:none; outline:none; background:#070b12; color:#f8fafc; font-family:'Fira Code', 'Cascadia Code', monospace; font-size:0.8rem; line-height:1.55; padding:0.85rem; box-sizing:border-box; resize:none; white-space:pre;"></textarea>
              </div>

              <!-- Console Output Banner -->
              <div id="editorOutputBox_${ngxWinId}" style="display:none; background:#0d131f; border-top:1px solid var(--border-subtle); padding:0.5rem 0.85rem; font-family:var(--font-mono); font-size:0.72rem; max-height:120px; overflow-y:auto;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.25rem;">
                  <span id="editorOutputTitle_${ngxWinId}" style="font-weight:600; font-size:0.72rem;">Nginx Syntax Validation Result:</span>
                  <button type="button" class="btn btn-ghost btn-xs" id="closeEditorOutputBtn_${ngxWinId}" style="padding:0 4px; font-size:0.68rem;">Dismiss</button>
                </div>
                <pre id="editorOutputText_${ngxWinId}" style="margin:0; white-space:pre-wrap; word-break:break-all;"></pre>
              </div>
            </div>
          `;

          const fileSelect = contentPane.querySelector(`#editorFileSelect_${ngxWinId}`);
          const codeArea = contentPane.querySelector(`#ngxCodeArea_${ngxWinId}`);
          const saveBtn = contentPane.querySelector(`#editorSaveBtn_${ngxWinId}`);
          const testBtn = contentPane.querySelector(`#editorTestBtn_${ngxWinId}`);
          const reloadBtn = contentPane.querySelector(`#reloadEditorFileBtn_${ngxWinId}`);
          const outputBox = contentPane.querySelector(`#editorOutputBox_${ngxWinId}`);
          const outputTitle = contentPane.querySelector(`#editorOutputTitle_${ngxWinId}`);
          const outputText = contentPane.querySelector(`#editorOutputText_${ngxWinId}`);
          const closeOutputBtn = contentPane.querySelector(`#closeEditorOutputBtn_${ngxWinId}`);

          if (closeOutputBtn) {
            closeOutputBtn.onclick = () => { outputBox.style.display = 'none'; };
          }

          // Tab key handling in textarea
          codeArea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const s = codeArea.selectionStart;
              const end = codeArea.selectionEnd;
              codeArea.value = codeArea.value.substring(0, s) + '    ' + codeArea.value.substring(end);
              codeArea.selectionStart = codeArea.selectionEnd = s + 4;
            }
          });

          // Load file content
          const loadCurrentFile = async () => {
            const chosenFile = fileSelect.value;
            currentEditFile = chosenFile;
            codeArea.disabled = true;
            codeArea.value = `// Loading ${chosenFile}...`;
            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/config?file=${encodeURIComponent(chosenFile)}`);
              const res = await resp.json();
              if (res.success) {
                codeArea.value = res.content || '';
              } else {
                codeArea.value = `// Error loading file: ${res.error || 'Unknown error'}`;
              }
            } catch (e) {
              codeArea.value = `// Network error: ${e}`;
            } finally {
              codeArea.disabled = false;
            }
          };

          fileSelect.onchange = loadCurrentFile;
          reloadBtn.onclick = loadCurrentFile;

          testBtn.onclick = async () => {
            testBtn.disabled = true;
            testBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Testing...`;
            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test' })
              });
              const res = await resp.json();
              outputBox.style.display = 'block';
              if (res.success) {
                outputTitle.innerHTML = `<span style="color:#10b981;">&check; Syntax OK</span> - Nginx configuration test successful`;
                outputText.style.color = '#34d399';
                outputText.textContent = res.message || 'Syntax is ok, test is successful.';
              } else {
                outputTitle.innerHTML = `<span style="color:#ef4444;">&cross; Syntax Error</span> in configuration`;
                outputText.style.color = '#f87171';
                outputText.textContent = res.message || 'Syntax check failed';
              }
            } catch (e) {
              alert('Test error: ' + e);
            } finally {
              testBtn.disabled = false;
              testBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Test Syntax (nginx -t)`;
            }
          };

          saveBtn.onclick = async () => {
            const filename = fileSelect.value;
            const content = codeArea.value;
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Validating &amp; Saving...`;
            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, content })
              });
              const res = await resp.json();
              outputBox.style.display = 'block';
              if (res.success) {
                outputTitle.innerHTML = `<span style="color:#10b981;">&check; Saved &amp; Reloaded</span>`;
                outputText.style.color = '#34d399';
                outputText.textContent = res.message || 'Configuration saved and Nginx reloaded successfully.';
                if (window.showToast) window.showToast('Config saved and Nginx reloaded!', 'success');
              } else {
                outputTitle.innerHTML = `<span style="color:#ef4444;">&cross; Syntax Error - Save Rolled Back</span>`;
                outputText.style.color = '#f87171';
                outputText.textContent = res.message || 'Syntax check failed. Reverted to previous backup.';
                if (window.showToast) window.showToast('Syntax error! Rolled back to safe backup.', 'error');
              }
            } catch (e) {
              alert('Error saving configuration: ' + e);
            } finally {
              saveBtn.disabled = false;
              saveBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save &amp; Reload Nginx`;
            }
          };

          await loadCurrentFile();
        };

        // 6. Render SSL Certificates Tab
        const renderSslTab = async () => {
          contentPane.innerHTML = `
            <div style="padding:0.9rem; display:flex; flex-direction:column; height:100%; box-sizing:border-box;">
              <!-- Sub-bar -->
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
                <div>
                  <h3 style="margin:0; font-size:0.95rem; font-weight:600; color:var(--text-primary);">Let's Encrypt SSL Certificates</h3>
                  <p style="margin:2px 0 0 0; font-size:0.75rem; color:var(--text-secondary);">Automated zero-downtime certificate issuance and renewal via Certbot Nginx plugin.</p>
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <button class="btn btn-secondary btn-sm" id="renewAllSslBtn_${ngxWinId}" style="display:flex; align-items:center; gap:0.35rem; font-weight:500;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    Renew All Certificates
                  </button>
                  <button class="btn btn-primary btn-sm" id="issueNewCertBtn_${ngxWinId}" style="display:flex; align-items:center; gap:0.35rem; font-weight:600;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Issue New Certificate
                  </button>
                </div>
              </div>

              <!-- Certbot Not Installed Warning Banner -->
              <div id="certbotNotInstalledBox_${ngxWinId}" style="display:none; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); border-radius:6px; padding:0.75rem 1rem; margin-bottom:0.85rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span style="font-size:0.78rem; color:#fde68a;">Certbot is not installed on this server. Install it to manage SSL certificates.</span>
                  </div>
                  <button class="btn btn-primary btn-xs" id="installCertbotBannerBtn_${ngxWinId}" style="padding:0.3rem 0.7rem;">Install Certbot</button>
                </div>
              </div>

              <!-- Certificates Table -->
              <div class="table-responsive" style="flex:1; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:6px; background:var(--bg-surface);">
                <table class="table" style="margin:0; width:100%; border-collapse:collapse; font-size:0.78rem;">
                  <thead>
                    <tr style="background:#0d131f; border-bottom:1px solid var(--border-subtle); color:var(--text-muted); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.04em;">
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Certificate Name</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Covered Domains</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Expiry &amp; Validity</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Certificate Path</th>
                      <th style="padding:0.6rem 0.75rem; text-align:right; font-weight:600; width:120px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="certsTableBody_${ngxWinId}">
                    <tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Loading certificates...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          `;

          if (statusData && !statusData.certbot_installed) {
            const notInstBox = contentPane.querySelector(`#certbotNotInstalledBox_${ngxWinId}`);
            if (notInstBox) {
              notInstBox.style.display = 'block';
              if (statusData.certbot_broken) {
                const spanEl = notInstBox.querySelector('span');
                if (spanEl) spanEl.textContent = 'Certbot has a Python OpenSSL dependency conflict on this server. Click Repair Certbot to fix it.';
                const bBtn = notInstBox.querySelector(`#installCertbotBannerBtn_${ngxWinId}`);
                if (bBtn) bBtn.textContent = 'Repair Certbot';
              }
            }
            const instBtn = contentPane.querySelector(`#installCertbotBannerBtn_${ngxWinId}`);
            if (instBtn) instBtn.onclick = () => installSoftware('certbot');
          }

          const renewAllBtn = contentPane.querySelector(`#renewAllSslBtn_${ngxWinId}`);
          if (renewAllBtn) {
            renewAllBtn.onclick = async () => {
              const forceRenew = confirm("Force renewal for all certificates now?\n\n- Press OK for Force Renewal (--force-renewal: contacts Let's Encrypt to re-issue new 90-day certificates immediately).\n- Press Cancel to only renew certificates due for renewal (< 30 days left).");
              renewAllBtn.disabled = true;
              renewAllBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Renewing...`;
              try {
                const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/ssl/renew`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ force: forceRenew })
                });
                showCommandOutputModal(`Certbot SSL Renewal Result (${forceRenew ? 'Forced' : 'Standard'})`, res.message || 'Renewal complete.', res.success);
                if (res.success) {
                  if (window.showToast) window.showToast('Renewal command completed', 'success');
                  await fetchCertificates();
                  renderCertsList();
                } else {
                  if (window.showToast) window.showToast(res.message || 'Renewal failed', 'error');
                }
              } catch (e) {
                showCommandOutputModal('Renewal Error', String(e), false);
              } finally {
                renewAllBtn.disabled = false;
                renewAllBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Renew All Certificates`;
              }
            };
          }

          const issueNewBtn = contentPane.querySelector(`#issueNewCertBtn_${ngxWinId}`);
          if (issueNewBtn) {
            issueNewBtn.onclick = () => openIssueSslModal();
          }

          await fetchCertificates();
          renderCertsList();
        };

        const renderCertsList = () => {
          const tbody = contentPane.querySelector(`#certsTableBody_${ngxWinId}`);
          if (!tbody) return;

          if (certsList.length === 0) {
            tbody.innerHTML = `
              <tr>
                <td colspan="5" style="text-align:center; padding:3.5rem 1.5rem;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem; color:var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.3" style="color:var(--text-muted); opacity:0.6;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <div style="font-weight:600; font-size:0.88rem; color:var(--text-primary);">No Active Let's Encrypt Certificates</div>
                    <div style="font-size:0.75rem; max-width:380px;">Free 90-day SSL certificates issued via Certbot will be automatically monitored and listed here.</div>
                    <button class="btn btn-primary btn-sm" id="emptyCertBtn_${ngxWinId}" style="margin-top:0.4rem;">Issue New Certificate</button>
                  </div>
                </td>
              </tr>
            `;
            const emptyBtn = tbody.querySelector(`#emptyCertBtn_${ngxWinId}`);
            if (emptyBtn) emptyBtn.onclick = () => openIssueSslModal();
            return;
          }

          tbody.innerHTML = certsList.map(c => {
            const daysLeft = c.valid_days;
            let validityBadge = '';
            if (daysLeft !== null && daysLeft !== undefined) {
              if (daysLeft > 30) {
                validityBadge = `<span class="badge badge-online" style="font-size:0.7rem; padding:2px 6px;">${daysLeft} days remaining</span>`;
              } else if (daysLeft > 0) {
                validityBadge = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); font-size:0.7rem; padding:2px 6px;">${daysLeft} days left (Expiring soon)</span>`;
              } else {
                validityBadge = `<span class="badge badge-offline" style="font-size:0.7rem; padding:2px 6px;">Expired</span>`;
              }
            }

            const domainsBadges = (c.domains && c.domains.length > 0)
              ? c.domains.map(d => `<span style="background:rgba(56,189,248,0.1); color:#38bdf8; border:1px solid rgba(56,189,248,0.2); padding:1px 6px; border-radius:3px; font-family:var(--font-mono); font-size:0.7rem; margin-right:3px;">${escapeHtml(d)}</span>`).join('')
              : '<span style="color:var(--text-muted);">-</span>';

            return `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:0.6rem 0.75rem;">
                  <strong style="color:var(--text-primary);">${escapeHtml(c.name)}</strong>
                </td>
                <td style="padding:0.6rem 0.75rem;">${domainsBadges}</td>
                <td style="padding:0.6rem 0.75rem;">
                  <div>${validityBadge}</div>
                  <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(c.expiry || '')}</div>
                </td>
                <td style="padding:0.6rem 0.75rem;">
                  <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-secondary); max-width:220px; overflow:hidden; text-overflow:ellipsis; display:inline-block;" title="${escapeHtml(c.path || '')}">${escapeHtml(c.path || '-')}</span>
                </td>
                <td style="padding:0.6rem 0.75rem; text-align:right;">
                  <button class="btn btn-secondary btn-xs renew-cert-row-btn" data-certname="${escapeHtml(c.name)}" data-domain="${escapeHtml(c.domains[0] || c.name)}" title="Renew this certificate">
                    Renew
                  </button>
                </td>
              </tr>
            `;
          }).join('');

          tbody.querySelectorAll('.renew-cert-row-btn').forEach(btn => {
            btn.onclick = async () => {
              const certName = btn.dataset.certname || btn.dataset.domain;
              const forceRenew = confirm(`Renew certificate '${certName}' immediately via Let's Encrypt?\n\nThis will execute on your server:\nsudo certbot renew --cert-name ${certName} --force-renewal`);
              if (!forceRenew) return;

              btn.disabled = true;
              btn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;"></span>`;
              try {
                const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/ssl/renew`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ domain: certName, force: true })
                });
                showCommandOutputModal(`Certbot Renewal Output: ${certName}`, res.message || 'Renewal completed.', res.success);
                if (res.success) {
                  if (window.showToast) window.showToast(`Certificate '${certName}' renewed!`, 'success');
                  await fetchCertificates();
                  renderCertsList();
                } else {
                  if (window.showToast) window.showToast(res.message || 'Renewal failed', 'error');
                }
              } catch (e) {
                showCommandOutputModal(`Renewal Error: ${certName}`, String(e), false);
              } finally {
                btn.disabled = false;
                btn.textContent = 'Renew';
              }
            };
          });
        };

        // 7. Tab Switching
        const switchTab = (tab, opts = {}) => {
          currentTab = tab;
          bodyEl.querySelectorAll('.ngx-tab-nav-btn').forEach(b => {
            const isActive = (b.dataset.tab === tab);
            b.classList.toggle('active', isActive);
            b.style.borderBottomColor = isActive ? '#10b981' : 'transparent';
            b.style.color = isActive ? '#ffffff' : 'var(--text-secondary)';
            b.style.fontWeight = isActive ? '600' : '500';
          });

          if (tab === 'domains') renderDomainsTab();
          else if (tab === 'editor') renderEditorTab(opts);
          else if (tab === 'ssl') renderSslTab();
        };

        bodyEl.querySelectorAll('.ngx-tab-nav-btn').forEach(btn => {
          btn.onclick = () => switchTab(btn.dataset.tab);
        });

        winObj._switchTab = (tab, opts) => switchTab(tab, opts);

        // 8. Add Domain / Reverse Proxy Modal
        const openAddDomainModal = () => {
          const modalBackdrop = document.createElement('div');
          modalBackdrop.style.cssText = 'position:absolute; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:100; padding:1rem;';
          modalBackdrop.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; width:100%; max-width:520px; box-shadow:0 20px 40px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden;">
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1.1rem; border-bottom:1px solid var(--border-subtle); background:#0c121e;">
                <h4 style="margin:0; font-size:0.92rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:0.45rem;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg>
                  Add Domain / Reverse Proxy
                </h4>
                <button type="button" class="btn btn-ghost btn-xs" id="closeAddModalBtn_${ngxWinId}" style="padding:2px 6px;">&times;</button>
              </div>

              <div style="padding:1.1rem; display:flex; flex-direction:column; gap:0.9rem; max-height:75vh; overflow-y:auto;">
                <!-- Domain Name -->
                <div>
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Domain Name (FQDN) *</label>
                  <input type="text" class="form-control" id="mDomainName_${ngxWinId}" placeholder="e.g. app.yourdomain.com or mydomain.com" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box;">
                  <span style="font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:block;">Ensure your DNS A/AAAA record points to this server IP before obtaining SSL.</span>
                </div>

                <!-- Routing Type -->
                <div>
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.35rem; color:#cbd5e1;">Routing Target Type</label>
                  <div style="display:flex; gap:1.25rem; font-size:0.78rem;">
                    <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                      <input type="radio" name="mRouteType_${ngxWinId}" value="proxy" checked>
                      <span>Reverse Proxy (Port)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                      <input type="radio" name="mRouteType_${ngxWinId}" value="static">
                      <span>Static Directory</span>
                    </label>
                  </div>
                </div>

                <!-- Proxy Port Input -->
                <div id="mProxyBox_${ngxWinId}">
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Application Port / Internal Address *</label>
                  <input type="text" class="form-control" id="mProxyPort_${ngxWinId}" placeholder="e.g. 3000, 8080, or 127.0.0.1:5000" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box; font-family:var(--font-mono);">
                  <span style="font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:block;">Requests for this domain will be forwarded internally to this local port.</span>
                </div>

                <!-- Static Directory Input -->
                <div id="mStaticBox_${ngxWinId}" style="display:none;">
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Web Root Path *</label>
                  <input type="text" class="form-control" id="mStaticRoot_${ngxWinId}" placeholder="/var/www/my-domain" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box; font-family:var(--font-mono);">
                </div>

                <!-- Let's Encrypt Checkbox -->
                <div style="background:#0a0f1a; border:1px solid var(--border-subtle); border-radius:6px; padding:0.75rem;">
                  <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; font-size:0.78rem;">
                    <input type="checkbox" id="mEnableSsl_${ngxWinId}" style="margin-top:2px;">
                    <div>
                      <span style="font-weight:600; color:#34d399;">Obtain Free Let's Encrypt SSL Certificate</span>
                      <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:1px;">Automatically configures HTTPS with HTTP-to-HTTPS redirect.</div>
                    </div>
                  </label>

                  <div id="mEmailBox_${ngxWinId}" style="display:none; margin-top:0.6rem; padding-left:1.45rem;">
                    <label style="display:block; font-weight:600; font-size:0.74rem; margin-bottom:0.25rem; color:#cbd5e1;">Admin Email Address *</label>
                    <input type="email" class="form-control" id="mSslEmail_${ngxWinId}" placeholder="admin@yourdomain.com" style="width:100%; font-size:0.78rem; padding:0.35rem 0.55rem; box-sizing:border-box;">
                    <span style="font-size:0.68rem; color:var(--text-muted); margin-top:2px; display:block;">Required by Let's Encrypt for urgent security and renewal alerts.</span>
                  </div>
                </div>

                <div id="mAddStatus_${ngxWinId}" style="display:none; padding:0.5rem 0.75rem; border-radius:4px; font-size:0.74rem;"></div>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:0.4rem; padding:0.75rem 1.1rem; border-top:1px solid var(--border-subtle); background:#0c121e;">
                <button type="button" class="btn btn-ghost btn-sm" id="mCancelAddBtn_${ngxWinId}">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="mSubmitAddBtn_${ngxWinId}" style="font-weight:600;">Deploy Domain Route</button>
              </div>
            </div>
          `;
          container.appendChild(modalBackdrop);

          const closeModal = () => {
            if (modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop);
          };

          modalBackdrop.querySelector(`#closeAddModalBtn_${ngxWinId}`).onclick = closeModal;
          modalBackdrop.querySelector(`#mCancelAddBtn_${ngxWinId}`).onclick = closeModal;

          // Route type toggle
          const proxyBox = modalBackdrop.querySelector(`#mProxyBox_${ngxWinId}`);
          const staticBox = modalBackdrop.querySelector(`#mStaticBox_${ngxWinId}`);
          modalBackdrop.querySelectorAll(`input[name="mRouteType_${ngxWinId}"]`).forEach(r => {
            r.onchange = () => {
              proxyBox.style.display = (r.value === 'proxy') ? 'block' : 'none';
              staticBox.style.display = (r.value === 'static') ? 'block' : 'none';
            };
          });

          // SSL checkbox toggle
          const enableSslCb = modalBackdrop.querySelector(`#mEnableSsl_${ngxWinId}`);
          const emailBox = modalBackdrop.querySelector(`#mEmailBox_${ngxWinId}`);
          enableSslCb.onchange = () => {
            emailBox.style.display = enableSslCb.checked ? 'block' : 'none';
          };

          // Submit handler
          const submitBtn = modalBackdrop.querySelector(`#mSubmitAddBtn_${ngxWinId}`);
          const statusBox = modalBackdrop.querySelector(`#mAddStatus_${ngxWinId}`);

          submitBtn.onclick = async () => {
            const domain = modalBackdrop.querySelector(`#mDomainName_${ngxWinId}`).value.trim().toLowerCase();
            const routeType = modalBackdrop.querySelector(`input[name="mRouteType_${ngxWinId}"]:checked`).value;
            const portOrUrl = modalBackdrop.querySelector(`#mProxyPort_${ngxWinId}`).value.trim();
            const rootPath = modalBackdrop.querySelector(`#mStaticRoot_${ngxWinId}`).value.trim();
            const enableSsl = enableSslCb.checked;
            const email = modalBackdrop.querySelector(`#mSslEmail_${ngxWinId}`).value.trim();

            if (!domain) {
              alert('Please enter a valid domain name.');
              return;
            }

            if (routeType === 'proxy' && !portOrUrl) {
              alert('Please enter a proxy port or URL (e.g. 3000 or 127.0.0.1:3000).');
              return;
            }

            if (routeType === 'static' && !rootPath) {
              alert('Please enter a static web root path (e.g. /var/www/my-domain).');
              return;
            }

            if (enableSsl && !email) {
              alert('Please provide an email address for Let\'s Encrypt SSL registration.');
              return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;margin-right:5px;"></span>Deploying...`;
            statusBox.style.display = 'block';
            statusBox.style.background = 'rgba(56,189,248,0.1)';
            statusBox.style.color = '#38bdf8';
            statusBox.style.border = '1px solid rgba(56,189,248,0.2)';
            statusBox.textContent = enableSsl
              ? 'Creating Nginx configuration, testing syntax, and obtaining Let\'s Encrypt SSL certificate...'
              : 'Creating Nginx configuration and reloading service...';

            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  domain,
                  site_type: routeType,
                  port_or_url: portOrUrl,
                  root_path: rootPath,
                  enable_ssl: enableSsl,
                  email
                })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(`Domain '${domain}' deployed successfully!`, 'success');
                closeModal();
                await fetchSites();
                if (currentTab === 'domains') renderSitesList();
              } else {
                statusBox.style.background = 'rgba(239,68,68,0.1)';
                statusBox.style.color = '#f87171';
                statusBox.style.border = '1px solid rgba(239,68,68,0.25)';
                statusBox.textContent = `Deployment Failed: ${res.message || 'Unknown error'}`;
              }
            } catch (e) {
              statusBox.style.background = 'rgba(239,68,68,0.1)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = `Network error: ${e}`;
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Deploy Domain Route';
            }
          };
        };

        // 9. Issue SSL Modal
        const openIssueSslModal = (defaultDomain = '') => {
          const modalBackdrop = document.createElement('div');
          modalBackdrop.style.cssText = 'position:absolute; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:100; padding:1rem;';
          modalBackdrop.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; width:100%; max-width:480px; box-shadow:0 20px 40px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden;">
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1.1rem; border-bottom:1px solid var(--border-subtle); background:#0c121e;">
                <h4 style="margin:0; font-size:0.92rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:0.45rem;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Issue Let's Encrypt Certificate
                </h4>
                <button type="button" class="btn btn-ghost btn-xs" id="closeIssueModalBtn_${ngxWinId}" style="padding:2px 6px;">&times;</button>
              </div>

              <div style="padding:1.1rem; display:flex; flex-direction:column; gap:0.85rem;">
                <div>
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Domain Name *</label>
                  <input type="text" class="form-control" id="mSslDomain_${ngxWinId}" value="${escapeHtml(defaultDomain)}" placeholder="e.g. app.yourdomain.com" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box;">
                  <span style="font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:block;">Domain must resolve to this server IP address over port 80.</span>
                </div>

                <div>
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Admin Email Address *</label>
                  <input type="email" class="form-control" id="mIssueEmail_${ngxWinId}" placeholder="admin@yourdomain.com" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box;">
                </div>

                <div id="mIssueStatus_${ngxWinId}" style="display:none; padding:0.5rem 0.75rem; border-radius:4px; font-size:0.74rem;"></div>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:0.4rem; padding:0.75rem 1.1rem; border-top:1px solid var(--border-subtle); background:#0c121e;">
                <button type="button" class="btn btn-ghost btn-sm" id="mCancelIssueBtn_${ngxWinId}">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="mSubmitIssueBtn_${ngxWinId}" style="font-weight:600;">Issue Certificate</button>
              </div>
            </div>
          `;
          container.appendChild(modalBackdrop);

          const closeModal = () => {
            if (modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop);
          };

          modalBackdrop.querySelector(`#closeIssueModalBtn_${ngxWinId}`).onclick = closeModal;
          modalBackdrop.querySelector(`#mCancelIssueBtn_${ngxWinId}`).onclick = closeModal;

          const submitBtn = modalBackdrop.querySelector(`#mSubmitIssueBtn_${ngxWinId}`);
          const statusBox = modalBackdrop.querySelector(`#mIssueStatus_${ngxWinId}`);

          submitBtn.onclick = async () => {
            const domain = modalBackdrop.querySelector(`#mSslDomain_${ngxWinId}`).value.trim().toLowerCase();
            const email = modalBackdrop.querySelector(`#mIssueEmail_${ngxWinId}`).value.trim();

            if (!domain || !email) {
              alert('Both domain name and email address are required.');
              return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;margin-right:5px;"></span>Requesting SSL...`;
            statusBox.style.display = 'block';
            statusBox.style.background = 'rgba(56,189,248,0.1)';
            statusBox.style.color = '#38bdf8';
            statusBox.style.border = '1px solid rgba(56,189,248,0.2)';
            statusBox.textContent = 'Requesting certificate from Let\'s Encrypt and updating Nginx configuration...';

            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/ssl/issue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, email })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(`SSL Certificate for '${domain}' issued successfully!`, 'success');
                closeModal();
                await fetchSites();
                await fetchCertificates();
                if (currentTab === 'domains') renderSitesList();
                else if (currentTab === 'ssl') renderCertsList();
              } else {
                statusBox.style.background = 'rgba(239,68,68,0.1)';
                statusBox.style.color = '#f87171';
                statusBox.style.border = '1px solid rgba(239,68,68,0.25)';
                statusBox.textContent = `Certificate Error: ${res.message || 'Unknown error'}`;
              }
            } catch (e) {
              statusBox.style.background = 'rgba(239,68,68,0.1)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = `Network error: ${e}`;
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Issue Certificate';
            }
          };
        };

        // 10. Software Installer Helper
        const installSoftware = async (pkg) => {
          if (!confirm(`Install ${pkg} via server's native package manager now?`)) return;
          if (window.showToast) window.showToast(`Installing ${pkg} in background... Please wait.`, 'info');
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/nginx/install`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ package: pkg })
            });
            const res = await resp.json();
            if (res.success) {
              if (window.showToast) window.showToast(`${pkg} installed successfully!`, 'success');
              await fetchStatus();
              await fetchSites();
              if (currentTab === 'domains') renderSitesList();
              else if (currentTab === 'ssl') renderSslTab();
            } else {
              if (window.showToast) window.showToast(`Installation failed: ${res.message}`, 'error');
            }
          } catch (e) {
            alert('Install error: ' + e);
          }
        };

        // 11. Wire Top Header Quick Action Buttons
        const testBtn = bodyEl.querySelector(`#testNginxBtn_${ngxWinId}`);
        if (testBtn) {
          testBtn.onclick = async () => {
            testBtn.disabled = true;
            try {
              const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test' })
              });
              showCommandOutputModal('nginx -t (Configuration Test Output)', res.message || 'Syntax test complete.', res.success);
              if (res.success) {
                if (window.showToast) window.showToast('Nginx syntax is OK', 'success');
              } else {
                if (window.showToast) window.showToast('Nginx syntax error detected', 'error');
              }
            } catch (e) {
              showCommandOutputModal('Test Error', String(e), false);
            } finally {
              testBtn.disabled = false;
            }
          };
        }

        const reloadBtn = bodyEl.querySelector(`#reloadNginxBtn_${ngxWinId}`);
        if (reloadBtn) {
          reloadBtn.onclick = async () => {
            reloadBtn.disabled = true;
            try {
              const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reload' })
              });
              showCommandOutputModal('systemctl reload nginx (Live Process Verification)', res.message || 'Reload command finished.', res.success);
              if (res.success) {
                if (window.showToast) window.showToast('Nginx reloaded successfully', 'success');
              } else {
                if (window.showToast) window.showToast('Nginx reload failed: ' + res.message, 'error');
              }
            } catch (e) {
              showCommandOutputModal('Reload Error', String(e), false);
            } finally {
              reloadBtn.disabled = false;
              fetchStatus();
            }
          };
        }

        const restartBtn = bodyEl.querySelector(`#restartNginxBtn_${ngxWinId}`);
        if (restartBtn) {
          restartBtn.onclick = async () => {
            if (!confirm('Restart Nginx service now? Active web connections may momentarily disconnect.')) return;
            restartBtn.disabled = true;
            try {
              const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restart' })
              });
              showCommandOutputModal('systemctl restart nginx (Live Process Verification)', res.message || 'Restart command finished.', res.success);
              if (res.success) {
                if (window.showToast) window.showToast('Nginx restarted successfully', 'success');
              } else {
                if (window.showToast) window.showToast('Nginx restart failed: ' + res.message, 'error');
              }
            } catch (e) {
              showCommandOutputModal('Restart Error', String(e), false);
            } finally {
              restartBtn.disabled = false;
              fetchStatus();
            }
          };
        }

        const refreshAllBtn = bodyEl.querySelector(`#refreshAllBtn_${ngxWinId}`);
        if (refreshAllBtn) {
          refreshAllBtn.onclick = async () => {
            refreshAllBtn.disabled = true;
            await fetchStatus();
            await fetchSites();
            await fetchCertificates();
            if (currentTab === 'domains') renderSitesList();
            else if (currentTab === 'ssl') renderCertsList();
            refreshAllBtn.disabled = false;
            if (window.showToast) window.showToast('Nginx state refreshed', 'info');
          };
        }

        // Initialize state
        fetchStatus();
        fetchSites().then(() => {
          switchTab(currentTab, { file: currentEditFile });
        });
      }
    });
  }

  launchSettings(params = {}) {
    const existing = WindowManager.getWindowByAppId('settings');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      if (params.tab && existing._switchTab) {
        existing._switchTab(params.tab);
      }
      return existing;
    }

    const setWinId = 'settings_' + Date.now();
    let currentTab = params.tab || 'servers';
    let serversList = window.DesktopServersList ? [...window.DesktopServersList] : [];

    return WindowManager.createWindow({
      appId: 'settings',
      multiInstance: false,
      title: 'System Settings',
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.5" fill="rgba(56,189,248,0.2)" stroke="#38bdf8" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      width: 920,
      height: 600,
      minWidth: 720,
      minHeight: 460,
      contentHtml: `
        <div class="settings-app-container" id="settingsContainer_${setWinId}">
          <!-- Left Navigation Sidebar -->
          <nav class="settings-sidebar">
            <div class="settings-sidebar-header">System Settings</div>
            <div class="settings-nav-item active" data-tab="servers" id="tabNav_servers_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
              <span>Server Nodes</span>
            </div>
            <div class="settings-nav-item" data-tab="admin" id="tabNav_admin_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              <span>Admin & Security</span>
            </div>
            <div class="settings-nav-item" data-tab="appearance" id="tabNav_appearance_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"></path></svg>
              <span>Appearance</span>
            </div>
            <div class="settings-nav-item" data-tab="pwa" id="tabNav_pwa_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Desktop App (PWA)</span>
            </div>
            <div class="settings-nav-item" data-tab="about" id="tabNav_about_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span>About ShellMan</span>
            </div>
          </nav>

          <!-- Right Content Pane -->
          <div class="settings-content-pane" id="tabContent_${setWinId}">
            <!-- Content will be rendered dynamically -->
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const container = bodyEl.querySelector(`#settingsContainer_${setWinId}`);
        const contentPane = bodyEl.querySelector(`#tabContent_${setWinId}`);

        // Helper to load servers from API
        const loadServers = async () => {
          try {
            const resp = await fetch('/api/servers/list');
            const res = await resp.json();
            if (res.success && res.servers) {
              serversList = res.servers;
              window.DesktopServersList = res.servers;
            }
          } catch (_) {}
        };

        // Render Server Nodes Tab
        const renderServersTab = async () => {
          contentPane.innerHTML = `
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem;">
                <div>
                  <h3 class="settings-section-title">Server Nodes Management</h3>
                  <p class="settings-section-desc">Manage SSH credentials, ports, authentication keys, and remote VPS endpoints.</p>
                </div>
                <button class="btn btn-primary btn-sm" id="addNewServerBtn_${setWinId}" style="display:flex; align-items:center; gap:0.4rem;">
                  <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Server Node
                </button>
              </div>

              <div id="serversListContainer_${setWinId}">
                <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                  <span class="spinner-border spinner-border-sm" style="margin-right:8px;"></span>Loading servers...
                </div>
              </div>
            </div>
          `;

          await loadServers();

          const listContainer = contentPane.querySelector(`#serversListContainer_${setWinId}`);
          if (!serversList || serversList.length === 0) {
            listContainer.innerHTML = `
              <div class="settings-card" style="text-align:center; padding:3rem 1.5rem;">
                <svg style="width:48px;height:48px;color:#64748b;margin-bottom:0.75rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                <div style="font-size:0.95rem; font-weight:600; color:#cbd5e1; margin-bottom:0.3rem;">No Servers Configured</div>
                <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:1rem;">Add your first remote Linux VPS or dedicated server to begin managing it agentlessly.</p>
                <button class="btn btn-primary btn-sm" id="emptyAddServerBtn_${setWinId}">+ Add Your First Server</button>
              </div>
            `;
            const emptyBtn = listContainer.querySelector(`#emptyAddServerBtn_${setWinId}`);
            if (emptyBtn) emptyBtn.onclick = () => openServerModal();
          } else {
            listContainer.innerHTML = serversList.map(s => {
              const isCurrent = this.serverId && s.id === this.serverId;
              return `
                <div class="settings-server-row" data-server-id="${s.id}">
                  <div class="settings-server-info">
                    <span class="status-dot ${s.is_online ? 'connected' : 'disconnected'}" title="${s.is_online ? 'Online' : 'Offline'}"></span>
                    <div>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-weight:600; font-size:0.85rem; color:#f8fafc;">${escapeHtml(s.name)}</span>
                        ${isCurrent ? '<span style="font-size:0.68rem; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">ACTIVE NODE</span>' : ''}
                      </div>
                      <div style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                        <span>${escapeHtml(s.username)}@${escapeHtml(s.host)}:${s.port}</span>
                        <span style="margin:0 4px;">&bull;</span>
                        <span style="color:#94a3b8;">${s.auth_type === 'key' ? 'SSH Key' : 'Password'}</span>
                      </div>
                    </div>
                  </div>
                  <div class="settings-server-actions">
                    ${!isCurrent ? `
                      <a href="/?server_id=${s.id}" class="btn btn-ghost btn-xs" title="Switch to this node">
                        Switch
                      </a>
                    ` : ''}
                    <button class="btn btn-secondary btn-xs test-server-btn" data-id="${s.id}" title="Test SSH Connection">
                      Test SSH
                    </button>
                    <button class="btn btn-secondary btn-xs edit-server-btn" data-id="${s.id}" title="Edit Server Details">
                      Edit
                    </button>
                    <button class="btn btn-danger btn-xs del-server-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}" title="Delete Server">
                      Delete
                    </button>
                  </div>
                </div>
              `;
            }).join('');
          }

          // Wire Add Server button
          const addBtn = contentPane.querySelector(`#addNewServerBtn_${setWinId}`);
          if (addBtn) addBtn.onclick = () => openServerModal();

          // Wire row action buttons
          contentPane.querySelectorAll('.edit-server-btn').forEach(btn => {
            btn.onclick = () => {
              const id = parseInt(btn.dataset.id);
              const srv = serversList.find(s => s.id === id);
              if (srv) openServerModal(srv);
            };
          });

          contentPane.querySelectorAll('.test-server-btn').forEach(btn => {
            btn.onclick = async () => {
              const id = parseInt(btn.dataset.id);
              btn.disabled = true;
              btn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;"></span>`;
              try {
                const resp = await fetch(`/api/servers/${id}/test`, { method: 'POST' });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(`SSH Connection to node successful!`, 'success');
                  else alert('SSH Connection Successful!');
                } else {
                  if (window.showToast) window.showToast(`SSH Connection failed: ${res.message || 'Unknown error'}`, 'danger');
                  else alert(`Connection Failed: ${res.message}`);
                }
              } catch (e) {
                alert(`Test error: ${e}`);
              } finally {
                btn.disabled = false;
                btn.textContent = 'Test SSH';
                renderServersTab();
              }
            };
          });

          contentPane.querySelectorAll('.del-server-btn').forEach(btn => {
            btn.onclick = async () => {
              const id = parseInt(btn.dataset.id);
              const name = btn.dataset.name;
              if (confirm(`Are you sure you want to delete server node "${name}"? This action cannot be undone.`)) {
                try {
                  const resp = await fetch(`/api/servers/${id}/delete`, { method: 'POST' });
                  const res = await resp.json();
                  if (res.success) {
                    if (window.showToast) window.showToast(`Server "${name}" deleted.`, 'info');
                    if (this.serverId === id) {
                      window.location.href = '/';
                    } else {
                      renderServersTab();
                    }
                  } else {
                    alert(`Failed to delete: ${res.error || 'Server error'}`);
                  }
                } catch (e) {
                  alert(`Delete error: ${e}`);
                }
              }
            };
          });
        };

        // Server Add / Edit Modal Drawer
        const openServerModal = (serverToEdit = null) => {
          const isEdit = !!serverToEdit;
          const modalBackdrop = document.createElement('div');
          modalBackdrop.className = 'file-modal-backdrop';
          modalBackdrop.innerHTML = `
            <div class="file-modal-box" style="width:560px; max-width:92vw;">
              <div class="file-modal-header" style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.88rem; color:#f8fafc;">
                  ${isEdit ? `Edit Server Details: ${escapeHtml(serverToEdit.name)}` : 'Add New Server Node'}
                </span>
                <button class="win-btn win-close" id="srvMClose_${setWinId}">×</button>
              </div>
              <div class="file-modal-body" style="padding:1.1rem; display:flex; flex-direction:column; gap:0.85rem; font-size:0.78rem;">
                <div style="display:flex; gap:0.75rem;">
                  <div style="flex:2;">
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">Server Friendly Name *</label>
                    <input type="text" class="form-control" id="mSrvName_${setWinId}" value="${isEdit ? escapeHtml(serverToEdit.name) : ''}" placeholder="e.g. Production Web App" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>
                  <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">SSH Port *</label>
                    <input type="number" class="form-control" id="mSrvPort_${setWinId}" value="${isEdit ? serverToEdit.port : '22'}" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>
                </div>

                <div style="display:flex; gap:0.75rem;">
                  <div style="flex:2;">
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">Host / IP Address *</label>
                    <input type="text" class="form-control" id="mSrvHost_${setWinId}" value="${isEdit ? escapeHtml(serverToEdit.host) : ''}" placeholder="e.g. 20.198.72.44 or vps.example.com" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>
                  <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">Username *</label>
                    <input type="text" class="form-control" id="mSrvUser_${setWinId}" value="${isEdit ? escapeHtml(serverToEdit.username) : 'root'}" placeholder="root" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>
                </div>

                <div>
                  <label style="display:block; font-weight:600; margin-bottom:0.35rem; color:#cbd5e1;">Authentication Method</label>
                  <div style="display:flex; gap:1.25rem; align-items:center;">
                    <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                      <input type="radio" name="mAuthType_${setWinId}" value="password" ${(!isEdit || serverToEdit.auth_type === 'password') ? 'checked' : ''}>
                      <span>Password Authentication</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                      <input type="radio" name="mAuthType_${setWinId}" value="key" ${(isEdit && serverToEdit.auth_type === 'key') ? 'checked' : ''}>
                      <span>SSH Private Key</span>
                    </label>
                  </div>
                </div>

                <!-- Password Auth Fields -->
                <div id="mPasswordBox_${setWinId}" style="display:${(!isEdit || serverToEdit.auth_type === 'password') ? 'block' : 'none'};">
                  <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">
                    ${isEdit ? 'Password (leave blank to keep current)' : 'Password *'}
                  </label>
                  <div style="display:flex; position:relative;">
                    <input type="password" class="form-control" id="mSrvPassword_${setWinId}" placeholder="${isEdit ? '••••••••' : 'Enter SSH user password'}" style="width:100%; font-size:0.8rem; padding:0.4rem 2rem 0.4rem 0.6rem;">
                    <button type="button" class="btn btn-ghost btn-xs" id="mTogglePass_${setWinId}" style="position:absolute; right:4px; top:50%; transform:translateY(-50%); padding:2px 6px; display:flex; align-items:center;">
                      <svg style="width:14px;height:14px;color:#94a3b8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                  </div>
                </div>

                <!-- SSH Key Auth Fields -->
                <div id="mKeyBox_${setWinId}" style="display:${(isEdit && serverToEdit.auth_type === 'key') ? 'block' : 'none'};">
                  <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">
                    ${isEdit ? 'SSH Private Key (leave blank to keep current)' : 'SSH Private Key *'}
                  </label>
                  <textarea class="form-control" id="mSrvKey_${setWinId}" rows="4" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..." style="width:100%; font-family:var(--font-mono); font-size:0.72rem; padding:0.4rem 0.6rem;"></textarea>
                  
                  <label style="display:block; font-weight:600; margin-top:0.5rem; margin-bottom:0.25rem; color:#cbd5e1;">
                    Key Passphrase (optional)
                  </label>
                  <input type="password" class="form-control" id="mSrvPassphrase_${setWinId}" placeholder="Enter passphrase if key is encrypted" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                </div>

                <div id="mTestStatus_${setWinId}" style="display:none; padding:0.45rem 0.75rem; border-radius:4px; font-size:0.75rem;"></div>
              </div>
              <div class="file-modal-footer" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1.1rem; border-top:1px solid rgba(255,255,255,0.08);">
                <button type="button" class="btn btn-secondary btn-sm" id="mTestBtn_${setWinId}">
                  Test Connection
                </button>
                <div style="display:flex; gap:0.4rem;">
                  <button type="button" class="btn btn-ghost btn-sm" id="mCancelBtn_${setWinId}">Cancel</button>
                  <button type="button" class="btn btn-primary btn-sm" id="mSaveBtn_${setWinId}">
                    ${isEdit ? 'Save Changes' : 'Create Server'}
                  </button>
                </div>
              </div>
            </div>
          `;
          container.appendChild(modalBackdrop);

          const closeModal = () => {
            if (modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop);
          };

          modalBackdrop.querySelector(`#srvMClose_${setWinId}`).onclick = closeModal;
          modalBackdrop.querySelector(`#mCancelBtn_${setWinId}`).onclick = closeModal;

          // Toggle auth type radio
          const passBox = modalBackdrop.querySelector(`#mPasswordBox_${setWinId}`);
          const keyBox = modalBackdrop.querySelector(`#mKeyBox_${setWinId}`);
          modalBackdrop.querySelectorAll(`input[name="mAuthType_${setWinId}"]`).forEach(r => {
            r.onchange = () => {
              const isKey = r.value === 'key';
              passBox.style.display = isKey ? 'none' : 'block';
              keyBox.style.display = isKey ? 'block' : 'none';
            };
          });

          // Toggle password visibility
          const passInp = modalBackdrop.querySelector(`#mSrvPassword_${setWinId}`);
          const togBtn = modalBackdrop.querySelector(`#mTogglePass_${setWinId}`);
          togBtn.onclick = () => {
            passInp.type = passInp.type === 'password' ? 'text' : 'password';
          };

          const statusBox = modalBackdrop.querySelector(`#mTestStatus_${setWinId}`);

          // Test Connection button
          const testBtn = modalBackdrop.querySelector(`#mTestBtn_${setWinId}`);
          testBtn.onclick = async () => {
            testBtn.disabled = true;
            testBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Testing...`;
            statusBox.style.display = 'block';
            statusBox.style.background = 'rgba(56,189,248,0.1)';
            statusBox.style.color = '#38bdf8';
            statusBox.textContent = 'Connecting to remote SSH daemon...';

            const payload = {
              name: modalBackdrop.querySelector(`#mSrvName_${setWinId}`).value.trim(),
              host: modalBackdrop.querySelector(`#mSrvHost_${setWinId}`).value.trim(),
              port: parseInt(modalBackdrop.querySelector(`#mSrvPort_${setWinId}`).value) || 22,
              username: modalBackdrop.querySelector(`#mSrvUser_${setWinId}`).value.trim(),
              auth_type: modalBackdrop.querySelector(`input[name="mAuthType_${setWinId}"]:checked`).value,
              password: passInp.value,
              private_key: modalBackdrop.querySelector(`#mSrvKey_${setWinId}`).value,
              passphrase: modalBackdrop.querySelector(`#mSrvPassphrase_${setWinId}`).value
            };

            try {
              let resp, res;
              if (isEdit && !payload.password && !payload.private_key) {
                resp = await fetch(`/api/servers/${serverToEdit.id}/test`, { method: 'POST' });
              } else {
                resp = await fetch('/api/servers/test-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
              }
              res = await resp.json();
              if (res.success) {
                statusBox.style.background = 'rgba(16,185,129,0.12)';
                statusBox.style.color = '#34d399';
                statusBox.textContent = '✓ SSH Authentication Successful! Server is reachable.';
              } else {
                statusBox.style.background = 'rgba(239,68,68,0.12)';
                statusBox.style.color = '#f87171';
                statusBox.textContent = `✗ Connection Failed: ${res.message || 'Authentication error'}`;
              }
            } catch (e) {
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = `Error: ${e}`;
            } finally {
              testBtn.disabled = false;
              testBtn.textContent = 'Test Connection';
            }
          };

          // Save button
          const saveBtn = modalBackdrop.querySelector(`#mSaveBtn_${setWinId}`);
          saveBtn.onclick = async () => {
            const name = modalBackdrop.querySelector(`#mSrvName_${setWinId}`).value.trim();
            const host = modalBackdrop.querySelector(`#mSrvHost_${setWinId}`).value.trim();
            const port = parseInt(modalBackdrop.querySelector(`#mSrvPort_${setWinId}`).value) || 22;
            const username = modalBackdrop.querySelector(`#mSrvUser_${setWinId}`).value.trim();
            const auth_type = modalBackdrop.querySelector(`input[name="mAuthType_${setWinId}"]:checked`).value;
            const password = passInp.value;
            const private_key = modalBackdrop.querySelector(`#mSrvKey_${setWinId}`).value;
            const passphrase = modalBackdrop.querySelector(`#mSrvPassphrase_${setWinId}`).value;

            if (!name || !host || !username) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'Name, Host, and Username are required.';
              return;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Saving...`;

            try {
              const endpoint = isEdit ? `/api/servers/${serverToEdit.id}/edit` : '/api/servers/add';
              const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, host, port, username, auth_type, password, private_key, passphrase })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(`Server "${name}" ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
                closeModal();
                renderServersTab();
              } else {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(239,68,68,0.12)';
                statusBox.style.color = '#f87171';
                statusBox.textContent = res.error || 'Failed to save server.';
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Server';
              }
            } catch (e) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'Save error: ' + e;
              saveBtn.disabled = false;
              saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Server';
            }
          };
        };

        // Render Admin & Security Tab
        const renderAdminTab = async () => {
          contentPane.innerHTML = `
            <div>
              <h3 class="settings-section-title">Admin & Account Security</h3>
              <p class="settings-section-desc">Manage ShellMan master control credentials and access keys.</p>

              <!-- Profile Details Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="display:flex; align-items:center; gap:1rem;">
                  <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, #0284c7, #38bdf8); display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:700; font-size:1.2rem; flex-shrink:0;">
                    A
                  </div>
                  <div style="min-width:0; flex:1;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <span style="font-weight:700; font-size:0.95rem; color:#f8fafc;" id="adminUsername_${setWinId}">admin</span>
                      <span style="font-size:0.68rem; background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3); padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">SUPER ADMINISTRATOR</span>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">
                      Full privileges &bull; Interactive SSH, SFTP, and terminal execution
                    </div>
                  </div>
                </div>
              </div>

              <!-- Change Password Card -->
              <div class="settings-card">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.25rem;">Change Administrator Password</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem;">Update master credentials for this ShellMan management instance.</p>

                <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:440px;">
                  <div>
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; font-size:0.75rem; color:#cbd5e1;">Current Password *</label>
                    <input type="password" class="form-control" id="admCurPass_${setWinId}" placeholder="Enter current password" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>

                  <div>
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; font-size:0.75rem; color:#cbd5e1;">New Password (min 6 characters) *</label>
                    <input type="password" class="form-control" id="admNewPass_${setWinId}" placeholder="Enter new strong password" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>

                  <div>
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; font-size:0.75rem; color:#cbd5e1;">Confirm New Password *</label>
                    <input type="password" class="form-control" id="admConfPass_${setWinId}" placeholder="Confirm new password" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>

                  <div id="admPassStatus_${setWinId}" style="display:none; padding:0.45rem 0.75rem; border-radius:4px; font-size:0.75rem;"></div>

                  <div style="margin-top:0.35rem;">
                    <button class="btn btn-primary btn-sm" id="admSubmitPass_${setWinId}">
                      Update Master Password
                    </button>
                  </div>
                </div>
              </div>

              <!-- Session Termination -->
              <div class="settings-card" style="margin-top:1.25rem; display:flex; align-items:center; justify-content:space-between;">
                <div>
                  <div style="font-weight:600; font-size:0.82rem; color:#f8fafc;">Active Session</div>
                  <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Logged in via web session. End session and require authentication on next visit.</div>
                </div>
                <a href="/logout" class="btn btn-danger btn-sm" style="display:inline-flex; align-items:center; gap:0.4rem;">
                  <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  Log Out
                </a>
              </div>
            </div>
          `;

          // Fetch profile info
          try {
            const resp = await fetch('/api/settings/profile');
            const res = await resp.json();
            if (res.success && res.user && res.user.username) {
              const uEl = contentPane.querySelector(`#adminUsername_${setWinId}`);
              if (uEl) uEl.textContent = res.user.username;
            }
          } catch (_) {}

          // Password change handler
          const submitBtn = contentPane.querySelector(`#admSubmitPass_${setWinId}`);
          const curInp = contentPane.querySelector(`#admCurPass_${setWinId}`);
          const newInp = contentPane.querySelector(`#admNewPass_${setWinId}`);
          const confInp = contentPane.querySelector(`#admConfPass_${setWinId}`);
          const statusBox = contentPane.querySelector(`#admPassStatus_${setWinId}`);

          submitBtn.onclick = async () => {
            const current_password = curInp.value;
            const new_password = newInp.value;
            const confirm_password = confInp.value;

            if (!current_password) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'Current password is required.';
              return;
            }
            if (new_password.length < 6) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'New password must be at least 6 characters.';
              return;
            }
            if (new_password !== confirm_password) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'New passwords do not match.';
              return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Updating...`;

            try {
              const resp = await fetch('/api/settings/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password, new_password, confirm_password })
              });
              const res = await resp.json();
              if (res.success) {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(16,185,129,0.12)';
                statusBox.style.color = '#34d399';
                statusBox.textContent = '✓ Password updated successfully!';
                curInp.value = '';
                newInp.value = '';
                confInp.value = '';
                if (window.showToast) window.showToast('Password updated successfully', 'success');
              } else {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(239,68,68,0.12)';
                statusBox.style.color = '#f87171';
                statusBox.textContent = res.error || 'Failed to update password.';
              }
            } catch (e) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'Network error: ' + e;
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Update Master Password';
            }
          };
        };

        // Render Appearance Tab
        const renderAppearanceTab = () => {
          const currentFontPx = parseInt(localStorage.getItem('shellman_font_size') || '16', 10);
          const currentFontPct = Math.round((currentFontPx / 16) * 100);

          contentPane.innerHTML = `
            <div>
              <h3 class="settings-section-title">Desktop Appearance & Display</h3>
              <p class="settings-section-desc">Personalize system typography, font scale, wallpaper, and visual theme.</p>

              <!-- 1. System Font Size & UI Scale Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                  <div>
                    <div style="font-weight:700; font-size:0.88rem; color:#f8fafc;">System Font Size & Typography Scale</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                      Applies globally across all windows, Task Manager, File Manager, Nginx editor, headers, and menus.
                    </div>
                  </div>
                  <span id="fontScaleBadge_${setWinId}" style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700; padding:3px 10px; border-radius:12px; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">
                    ${currentFontPx}px (${currentFontPct}%${currentFontPx === 16 ? ' Default' : ''})
                  </span>
                </div>

                <!-- Quick Presets -->
                <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:1rem; flex-wrap:wrap;">
                  <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600; margin-right:4px;">Presets:</span>
                  <button class="btn ${currentFontPx === 13 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="13">Small (13px)</button>
                  <button class="btn ${currentFontPx === 14 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="14">Compact (14px)</button>
                  <button class="btn ${currentFontPx === 16 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="16">Default (16px)</button>
                  <button class="btn ${currentFontPx === 18 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="18">Medium (18px)</button>
                  <button class="btn ${currentFontPx === 20 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="20">Large (20px)</button>
                  <button class="btn ${currentFontPx === 22 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="22">Extra Large (22px)</button>
                </div>

                <!-- Range Slider -->
                <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1.25rem;">
                  <span style="font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">12px</span>
                  <input type="range" class="form-range" id="fontSizeSlider_${setWinId}" min="12" max="24" step="1" value="${currentFontPx}" style="flex:1; accent-color:#38bdf8; cursor:pointer;">
                  <span style="font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">24px</span>
                  <button class="btn btn-ghost btn-xs" id="resetFontBtn_${setWinId}" title="Reset to standard 16px font size">Reset</button>
                </div>

                <!-- Live Preview Box -->
                <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:0.85rem 1rem;">
                  <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); font-weight:700; margin-bottom:0.4rem;">Live Preview</div>
                  <div id="fontPreviewBox_${setWinId}" style="display:flex; flex-direction:column; gap:0.4rem;">
                    <div style="font-size:0.95rem; font-weight:700; color:#f8fafc;">Task Manager & App Window Header</div>
                    <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.45;">Process PID 1814781 (gunicorn) is active and running with 0% CPU and 9.6% RAM.</div>
                    <div style="display:flex; gap:0.5rem; align-items:center; margin-top:2px;">
                      <span style="display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:12px; background:rgba(52,211,153,0.14); color:#34d399; font-size:0.72rem; font-weight:600;">
                        <span style="width:6px; height:6px; border-radius:50%; background:#34d399;"></span>Active
                      </span>
                      <span style="font-family:var(--font-mono); font-size:0.72rem; color:#38bdf8;">/var/www/site/app.py</span>
                      <button class="btn btn-secondary btn-xs" style="pointer-events:none; padding:2px 8px;">Sample Button</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2. Preset Wallpapers -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.75rem;">Preset Wallpapers</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.85rem;">
                  <div class="wallpaper-card" data-url="/static/images/wallpaper.jpg" style="border:2px solid #38bdf8; border-radius:6px; overflow:hidden; cursor:pointer; background:#070b14;">
                    <div style="height:95px; background:url('/static/images/wallpaper.jpg') center/cover; position:relative;">
                      <span style="position:absolute; bottom:4px; left:4px; font-size:0.68rem; background:rgba(0,0,0,0.7); color:#f8fafc; padding:2px 6px; border-radius:3px;">Default Studio</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 3. Custom Wallpaper URL -->
              <div class="settings-card">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.35rem;">Custom Wallpaper URL</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.75rem;">Set an external image URL as your desktop background.</p>
                <div style="display:flex; gap:0.5rem;">
                  <input type="text" class="form-control" id="customWallUrl_${setWinId}" placeholder="https://images.unsplash.com/..." style="flex:1; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  <button class="btn btn-primary btn-sm" id="applyWallBtn_${setWinId}">Apply</button>
                  <button class="btn btn-ghost btn-sm" id="resetWallBtn_${setWinId}">Reset</button>
                </div>
              </div>
            </div>
          `;

          // Font scaling logic
          const applyFontSize = (size) => {
            const s = parseInt(size, 10) || 16;
            document.documentElement.style.fontSize = `${s}px`;
            document.documentElement.style.setProperty('--app-font-size', `${s}px`);
            document.documentElement.style.setProperty('--app-font-scale', (s / 16).toString());
            localStorage.setItem('shellman_font_size', s.toString());

            const badge = contentPane.querySelector(`#fontScaleBadge_${setWinId}`);
            if (badge) {
              const pct = Math.round((s / 16) * 100);
              badge.textContent = `${s}px (${pct}%${s === 16 ? ' Default' : ''})`;
            }

            const slider = contentPane.querySelector(`#fontSizeSlider_${setWinId}`);
            if (slider && parseInt(slider.value, 10) !== s) {
              slider.value = s;
            }

            contentPane.querySelectorAll('.font-preset-btn').forEach(btn => {
              const bSize = parseInt(btn.dataset.size, 10);
              btn.className = (bSize === s)
                ? 'btn btn-primary btn-xs font-preset-btn'
                : 'btn btn-secondary btn-xs font-preset-btn';
            });

            // Dynamically scale any open terminals
            if (window._shellmanTerminals) {
              window._shellmanTerminals.forEach(t => {
                try {
                  t.options.fontSize = Math.max(10, Math.round(14 * (s / 16)));
                  if (t._fitAddon) t._fitAddon.fit();
                } catch (_) {}
              });
            }
          };

          const slider = contentPane.querySelector(`#fontSizeSlider_${setWinId}`);
          if (slider) {
            slider.oninput = (e) => applyFontSize(e.target.value);
          }

          contentPane.querySelectorAll('.font-preset-btn').forEach(btn => {
            btn.onclick = () => applyFontSize(btn.dataset.size);
          });

          const resetFontBtn = contentPane.querySelector(`#resetFontBtn_${setWinId}`);
          if (resetFontBtn) {
            resetFontBtn.onclick = () => applyFontSize(16);
          }

          const applyWall = (url) => {
            const desktopEnv = document.getElementById('desktop');
            const ws = document.getElementById('desktopWorkspace');
            if (desktopEnv) {
              desktopEnv.style.backgroundImage = `linear-gradient(180deg, rgba(8, 12, 20, 0.42) 0%, rgba(6, 9, 15, 0.65) 100%), url("${url}")`;
              desktopEnv.style.backgroundSize = 'cover';
              desktopEnv.style.backgroundPosition = 'center center';
              desktopEnv.style.backgroundRepeat = 'no-repeat';
              desktopEnv.style.backgroundAttachment = 'fixed';
            }
            if (ws) {
              ws.style.background = 'transparent';
              ws.style.backgroundImage = 'none';
            }
            localStorage.setItem('shellman_wallpaper', url);
            if (window.showToast) window.showToast('Wallpaper applied', 'info');
          };

          contentPane.querySelectorAll('.wallpaper-card').forEach(c => {
            c.onclick = () => applyWall(c.dataset.url);
          });

          const applyBtn = contentPane.querySelector(`#applyWallBtn_${setWinId}`);
          const inp = contentPane.querySelector(`#customWallUrl_${setWinId}`);
          if (applyBtn && inp) {
            applyBtn.onclick = () => {
              const u = inp.value.trim();
              if (u) applyWall(u);
            };
          }

          const resetBtn = contentPane.querySelector(`#resetWallBtn_${setWinId}`);
          if (resetBtn) {
            resetBtn.onclick = () => applyWall('/static/images/wallpaper.jpg');
          }
        };

        // Render About Tab
        const renderAboutTab = () => {
          contentPane.innerHTML = `
            <div>
              <div class="settings-card" style="text-align:center; padding:2.5rem 1.5rem; margin-bottom:1.25rem;">
                <div style="width:72px; height:72px; margin:0 auto 1rem; filter: drop-shadow(0 10px 24px rgba(14, 165, 233, 0.45));">
                  <img src="/static/images/logo.png" alt="ShellMan Logo" style="width:100%; height:100%; object-fit:contain;">
                </div>
                <h2 style="font-size:1.4rem; font-weight:800; color:#f8fafc; margin-bottom:0.25rem; letter-spacing:0.04em;">SHELLMAN OS</h2>
                <div style="font-size:0.75rem; font-family:var(--font-mono); color:#38bdf8; margin-bottom:0.75rem;">Version 1.0.0 Production Release</div>
                <p style="font-size:0.8rem; color:var(--text-secondary); max-width:480px; margin:0 auto; line-height:1.5;">
                  Modern, agentless, high-performance Linux remote infrastructure desktop environment.
                </p>
              </div>

              <div class="settings-card">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.75rem;">Architecture Specs</div>
                <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.78rem;">
                  <div style="display:flex; justify-content:space-between; padding-bottom:0.35rem; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="color:var(--text-muted);">Managed VPS Overhead</span>
                    <span style="font-weight:600; color:#10b981;">0 MB Permanent RAM (Agentless)</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; padding-bottom:0.35rem; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="color:var(--text-muted);">Terminal Emulation</span>
                    <span style="font-family:var(--font-mono); color:#cbd5e1;">xterm.js + WebSocket PTY</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; padding-bottom:0.35rem; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="color:var(--text-muted);">File Transport</span>
                    <span style="font-family:var(--font-mono); color:#cbd5e1;">SFTP over SSH-2.0</span>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted);">Monaco IDE</span>
                    <span style="font-family:var(--font-mono); color:#cbd5e1;">VS Code Engine (v0.34.0)</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        };

        // Render Desktop App (PWA) Tab
        const renderPwaTab = () => {
          const isStandalone = window.PwaManager ? window.PwaManager.isStandalone : false;
          contentPane.innerHTML = `
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem;">
                <div>
                  <h3 class="settings-section-title">Desktop Application (PWA)</h3>
                  <p class="settings-section-desc">Download and install ShellMan as a standalone desktop app with native windowing and offline shell.</p>
                </div>
                <div>
                  <span class="pwa-badge ${isStandalone ? 'online' : 'ready'}">
                    ${isStandalone ? '● STANDALONE APP' : '● READY TO INSTALL'}
                  </span>
                </div>
              </div>

              <!-- Main Install Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
                  <div style="display:flex; align-items:center; gap:1rem;">
                    <div style="width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg, #0ea5e9, #6366f1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </div>
                    <div>
                      <div style="font-weight:700; font-size:0.95rem; color:#f8fafc;">ShellMan Desktop PWA</div>
                      <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                        ${isStandalone ? 'Currently running inside dedicated native application window.' : 'Install to desktop or dock for single-click launch without browser tabs.'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <button class="btn btn-primary" id="pwaTabInstallBtn_${setWinId}" style="display:inline-flex; align-items:center; gap:0.5rem; font-weight:600;">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      <span>${isStandalone ? 'Installed (Run Standalone)' : 'Install ShellMan to Desktop'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- PWA Benefits Grid -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.75rem;">Native Desktop Features</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem;">
                  <div class="pwa-feature-item">
                    <div class="pwa-feature-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>
                    </div>
                    <div>
                      <div style="font-weight:600; color:#f8fafc; font-size:0.8rem;">Dedicated Window</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">Runs in a clean, chromeless native window without browser address bars.</div>
                    </div>
                  </div>
                  <div class="pwa-feature-item">
                    <div class="pwa-feature-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                    </div>
                    <div>
                      <div style="font-weight:600; color:#f8fafc; font-size:0.8rem;">Instant Launch & Caching</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">Pre-cached assets and service worker boot the desktop instantaneously.</div>
                    </div>
                  </div>
                  <div class="pwa-feature-item">
                    <div class="pwa-feature-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8M6 16h12"></path></svg>
                    </div>
                    <div>
                      <div style="font-weight:600; color:#f8fafc; font-size:0.8rem;">Global OS Shortcuts</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">Use Ctrl+K, Alt+Tab, and Ctrl+W without browser hotkey interference.</div>
                    </div>
                  </div>
                  <div class="pwa-feature-item">
                    <div class="pwa-feature-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                    </div>
                    <div>
                      <div style="font-weight:600; color:#f8fafc; font-size:0.8rem;">App Launcher Shortcuts</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">Direct dock shortcuts to SSH Terminal, SFTP Files, and Code IDE.</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Manual Installation Guide Card -->
              <div class="settings-card">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.35rem;">Installation Instructions by Browser</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.75rem;">If the automatic install button is not supported by your browser, follow these steps:</p>
                <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.75rem; color:var(--text-secondary);">
                  <div>&bull; <strong>Chrome / Brave / Edge:</strong> Click the install icon in the URL bar (top right) or browser Menu &rarr; "Install ShellMan...".</div>
                  <div>&bull; <strong>Safari (macOS Sonoma+):</strong> Click "File" menu &rarr; "Add to Dock...".</div>
                  <div>&bull; <strong>iPhone / iPad Safari:</strong> Tap Share button &rarr; "Add to Home Screen".</div>
                  <div>&bull; <strong>Android Chrome:</strong> Tap three dots &rarr; "Install app" or "Add to Home screen".</div>
                </div>
              </div>
            </div>
          `;

          const installBtn = contentPane.querySelector(`#pwaTabInstallBtn_${setWinId}`);
          if (installBtn) {
            installBtn.onclick = () => {
              if (window.PwaManager) {
                window.PwaManager.promptInstall();
              }
            };
          }
        };

        const renderTab = (tab) => {
          currentTab = tab;
          bodyEl.querySelectorAll('.settings-nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
          });
          if (tab === 'servers') renderServersTab();
          else if (tab === 'admin') renderAdminTab();
          else if (tab === 'appearance') renderAppearanceTab();
          else if (tab === 'about') renderAboutTab();
          else if (tab === 'pwa') renderPwaTab();
        };

        // Tab click listeners
        bodyEl.querySelectorAll('.settings-nav-item').forEach(item => {
          item.onclick = () => renderTab(item.dataset.tab);
        });

        winObj._switchTab = (tab) => renderTab(tab);

        // Initial tab render
        renderTab(currentTab);
      }
    });
  }
}

window.DesktopApps = new DesktopAppsController();
