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

        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'bar',
          fontSize: 14,
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
        const propsPanel = bodyEl.querySelector(`#propsPanel_${fileWinId}`);
        const propsContent = bodyEl.querySelector(`#propsContent_${fileWinId}`);
        const togglePropsBtn = bodyEl.querySelector(`#togglePropsBtn_${fileWinId}`);

        if (togglePropsBtn) {
          togglePropsBtn.onclick = () => {
            isPropsOpen = !isPropsOpen;
            if (propsPanel) propsPanel.style.display = isPropsOpen ? 'flex' : 'none';
            togglePropsBtn.classList.toggle('active', isPropsOpen);
          };
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

        const updatePropertiesPane = () => {
          if (!propsContent) return;
          const count = selectedPaths.size;

          if (count === 1) {
            const p = Array.from(selectedPaths)[0];
            const item = items.find(i => i.path === p);
            if (!item) return;

            const iconHtml = renderItemIcon(item, 44);
            const typeDesc = getTypeDescription(item);
            const isDir = !!item.is_dir;
            const isImg = isImage(item.name);
            const isArch = isArchive(item.name);

            propsContent.innerHTML = `
              <div style="display:flex; align-items:center; gap:0.75rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="width:44px; height:44px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  ${iconHtml}
                </div>
                <div style="min-width:0; flex:1;">
                  <div style="font-size:0.85rem; font-weight:700; color:#f8fafc; word-break:break-all; line-height:1.25;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                  <div style="font-size:0.72rem; color:#94a3b8; margin-top:2px;">${typeDesc}</div>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:0.5rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.73rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Path</span>
                  <span style="color:#94a3b8; font-family:var(--font-mono); font-size:0.7rem; word-break:break-all; text-align:right;" title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</span>
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
                  <span style="color:#cbd5e1; font-family:var(--font-mono);">${escapeHtml(item.owner || '-')}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Group</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono);">${escapeHtml(item.group || '-')}</span>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:0.35rem;">
                <div style="font-size:0.72rem; font-weight:700; color:#f1f5f9; margin-bottom:0.25rem;">Actions</div>
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

          } else if (count > 1) {
            // Multi-selection
            const selItems = items.filter(i => selectedPaths.has(i.path));
            const totalBytes = selItems.reduce((acc, cur) => acc + (cur.size || 0), 0);
            const formattedTotalSize = formatBytes(totalBytes);
            const selectedList = Array.from(selectedPaths);
            const hasArchives = selItems.some(i => isArchive(i.name));

            propsContent.innerHTML = `
              <div style="display:flex; align-items:center; gap:0.75rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="width:44px; height:44px; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:rgba(56,189,248,0.12); border-radius:8px;">
                  <svg style="width:26px; height:26px; color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <div style="min-width:0; flex:1;">
                  <div style="font-size:0.85rem; font-weight:700; color:#f8fafc;">${count} Items Selected</div>
                  <div style="font-size:0.72rem; color:#94a3b8; margin-top:2px;">Multiple Selection</div>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:0.5rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.73rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Selected</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono);">${count} items</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Total Size</span>
                  <span style="color:#cbd5e1; font-family:var(--font-mono);">${formattedTotalSize}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                  <span style="color:#64748b; flex-shrink:0; width:75px;">Folder</span>
                  <span style="color:#94a3b8; font-family:var(--font-mono); font-size:0.7rem; word-break:break-all; text-align:right;" title="${escapeHtml(currentPath)}">${escapeHtml(currentPath)}</span>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:0.35rem;">
                <div style="font-size:0.72rem; font-weight:700; color:#f1f5f9; margin-bottom:0.25rem;">Batch Actions</div>
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

          } else {
            // No selection -> Current folder properties
            const dirName = currentPath.split('/').filter(Boolean).pop() || '/';
            propsContent.innerHTML = `
              <div style="display:flex; align-items:center; gap:0.75rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="width:44px; height:44px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  ${renderItemIcon({ is_dir: true, name: dirName }, 44)}
                </div>
                <div style="min-width:0; flex:1;">
                  <div style="font-size:0.85rem; font-weight:700; color:#f8fafc; word-break:break-all; line-height:1.25;" title="${escapeHtml(dirName)}">${escapeHtml(dirName)}</div>
                  <div style="font-size:0.72rem; color:#94a3b8; margin-top:2px;">Current Directory</div>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:0.5rem; padding-bottom:0.75rem; border-bottom:1px solid rgba(255,255,255,0.08); font-size:0.73rem;">
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

              <div style="display:flex; flex-direction:column; gap:0.35rem;">
                <div style="font-size:0.72rem; font-weight:700; color:#f1f5f9; margin-bottom:0.25rem;">Directory Actions</div>
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
              <div style="color:var(--accent-rose); font-size:0.72rem; margin-top:0.6rem;">
                ⚠ Warning: This operation cannot be undone.
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

        const poll = async () => {
          if (!bodyEl.isConnected) { clearInterval(timer); return; }
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/metrics`);
            const res = await resp.json();
            if (res.online && res.metrics) {
              const m = res.metrics;
              const cpuEl = bodyEl.querySelector('#ov_cpu');
              const cpuBar = bodyEl.querySelector('#ov_cpubar');
              const loadEl = bodyEl.querySelector('#ov_load');
              if (cpuEl) cpuEl.textContent = m.cpu;
              if (cpuBar) cpuBar.style.width = `${m.cpu}%`;
              if (m.load && loadEl) loadEl.textContent = `Load: ${m.load.join(', ')}`;

              const memEl = bodyEl.querySelector('#ov_mem');
              const memBar = bodyEl.querySelector('#ov_membar');
              const memTxt = bodyEl.querySelector('#ov_memtxt');
              if (memEl) memEl.textContent = m.memory.percent;
              if (memBar) memBar.style.width = `${m.memory.percent}%`;
              if (memTxt) {
                const usedM = m.memory.used_formatted || formatBytes(m.memory.used);
                const totalM = m.memory.total_formatted || formatBytes(m.memory.total);
                memTxt.textContent = `Used: ${usedM} / ${totalM}`;
              }

              const diskEl = bodyEl.querySelector('#ov_disk');
              const diskBar = bodyEl.querySelector('#ov_diskbar');
              const diskTxt = bodyEl.querySelector('#ov_disktxt');
              if (diskEl) diskEl.textContent = m.disk.percent;
              if (diskBar) diskBar.style.width = `${m.disk.percent}%`;
              if (diskTxt) {
                const usedD = m.disk.used_formatted || formatBytes(m.disk.used);
                const totalD = m.disk.total_formatted || formatBytes(m.disk.total);
                diskTxt.textContent = `Used: ${usedD} / ${totalD}`;
              }

              const d = Math.floor(m.uptime / (3600*24));
              const h = Math.floor((m.uptime % (3600*24)) / 3600);
              const min = Math.floor((m.uptime % 3600) / 60);
              const upEl = bodyEl.querySelector('#ov_uptime');
              if (upEl) upEl.textContent = `${d}d ${h}h ${min}m`;

              // Partition Mounts
              const tbody = bodyEl.querySelector('#ov_mounts');
              if (tbody && m.disk.filesystems && m.disk.filesystems.length > 0) {
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
            }
          } catch (_) {}
        };

        poll();
        const timer = setInterval(poll, 2000);
        winObj.onClose = () => clearInterval(timer);
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
      width: 860,
      height: 520,
      minWidth: 460,
      minHeight: 280,
      contentHtml: `
        <div style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas);">
          <div style="height:36px; background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; padding:0 0.75rem;">
            <input type="text" id="procSearchInput" placeholder="Filter PID, user, command..." class="form-control" style="width:240px; padding:0.2rem 0.5rem; font-size:0.75rem;">
            <button class="btn btn-secondary btn-sm" id="procRefreshBtn">Refresh</button>
          </div>
          <div class="table-responsive" style="flex:1; overflow-y:auto;">
            <table class="table">
              <thead>
                <tr><th style="width:70px;">PID</th><th style="width:90px;">User</th><th style="width:70px;">CPU%</th><th style="width:70px;">MEM%</th><th style="width:60px;">Stat</th><th>Command</th><th style="width:110px; text-align:right;">Signals</th></tr>
              </thead>
              <tbody id="procTableBody">
                <tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">Loading processes...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        let procs = [];
        const tbody = bodyEl.querySelector('#procTableBody');
        const input = bodyEl.querySelector('#procSearchInput');

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
          const filtered = q ? list.filter(p => p.pid.toString().includes(q) || p.user.toLowerCase().includes(q) || p.comm.toLowerCase().includes(q) || p.args.toLowerCase().includes(q)) : list;
          if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No matching processes</td></tr>`;
            return;
          }
          tbody.innerHTML = filtered.map(p => `
            <tr>
              <td><code>${p.pid}</code></td>
              <td style="color:var(--text-secondary);">${p.user}</td>
              <td><strong>${p.cpu}%</strong></td>
              <td>${p.mem}%</td>
              <td><code>${p.stat}</code></td>
              <td style="font-family:var(--font-mono); font-size:0.75rem; max-width:350px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.args}</td>
              <td style="text-align:right;">
                <button class="btn btn-secondary btn-sm sig-btn" data-pid="${p.pid}" data-comm="${encodeURIComponent(p.comm)}" data-sig="SIGTERM">Term</button>
                <button class="btn btn-danger btn-sm sig-btn" data-pid="${p.pid}" data-comm="${encodeURIComponent(p.comm)}" data-sig="SIGKILL">Kill</button>
              </td>
            </tr>
          `).join('');
        };

        tbody.onclick = (e) => {
          const btn = e.target.closest('.sig-btn');
          if (btn) {
            const pid = btn.dataset.pid;
            const comm = decodeURIComponent(btn.dataset.comm);
            const sig = btn.dataset.sig;
            DesktopApps.killProcess(this.serverId, pid, sig, comm);
          }
        };

        input.oninput = () => render(procs);
        bodyEl.querySelector('#procRefreshBtn').onclick = fetchProcs;

        fetchProcs();
        const timer = setInterval(fetchProcs, 8000);
        winObj.onClose = () => clearInterval(timer);
      }
    });
  }

  async killProcess(serverId, pid, signal, comm) {
    if (!confirm(`Send ${signal} to PID ${pid} (${comm})?`)) return;
    try {
      const resp = await fetch(`/api/servers/${serverId}/processes/kill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, signal })
      });
      const res = await resp.json();
      if (window.showToast) window.showToast(res.message, res.success ? 'success' : 'error');
    } catch (e) {
      alert('Error: ' + e);
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
  // 11. SYSTEM SETTINGS APPLICATION (Server Nodes, Admin Credentials, Theme)
  // =========================================================================
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
                    <button type="button" class="btn btn-ghost btn-xs" id="mTogglePass_${setWinId}" style="position:absolute; right:4px; top:50%; transform:translateY(-50%); padding:2px 6px;">
                      👁
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
          contentPane.innerHTML = `
            <div>
              <h3 class="settings-section-title">Desktop Appearance</h3>
              <p class="settings-section-desc">Personalize wallpaper, accents, and visual desktop atmosphere.</p>

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
