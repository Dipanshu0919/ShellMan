/**
 * ShellMan OS: Terminal Application (terminal.js)
 */

DesktopAppsController.prototype.launchTerminal = function (params = {}) {
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
    const savedThemeKey = localStorage.getItem('shellman_terminal_theme') || 'shellman';
    const activeTheme = SHELLMAN_TERMINAL_THEMES[savedThemeKey] || SHELLMAN_TERMINAL_THEMES.shellman;

    const fetch = RequestScope.next(); // requests of this window are cancelled when it closes
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
        <div class="terminal-app-container" style="height:100%; display:flex; flex-direction:column; background:${activeTheme.background};">
          <div class="terminal-toolbar" style="height:36px; background:#0f172a; border-bottom:1px solid #1e293b; display:flex; align-items:center; justify-content:space-between; padding:0 0.65rem;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span class="status-dot connected" id="dot_${termWinId}"></span>
              <span style="font-family:var(--font-mono); font-size:0.74rem; color:var(--text-secondary);" id="status_${termWinId}">PTY Active</span>
              ${initialPath ? `<span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--sm-accent); background:color-mix(in srgb, var(--sm-accent) 12%, transparent); border:1px solid color-mix(in srgb, var(--sm-accent) 20%, transparent); padding:1px 6px; border-radius:3px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(initialPath)}">${escapeHtml(folderName || initialPath)}</span>` : ''}
              <span style="color:var(--text-muted); font-size:0.7rem; font-family:var(--font-mono); margin-left:0.3rem;" id="dim_${termWinId}">80x24</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.3rem;">
              <div style="display:flex; align-items:center; gap:0.25rem; margin-right:0.2rem;">
                <span style="font-size:0.68rem; color:var(--text-muted); font-family:var(--font-mono);">Theme:</span>
                <select class="form-control" id="theme_${termWinId}" data-terminal-theme-select style="font-size:0.68rem; height:24px; padding:0 4px; background:#1e293b; color:#cbd5e1; border:1px solid rgba(255,255,255,0.1); border-radius:4px; outline:none; cursor:pointer;" title="Terminal Color Theme">
                  ${Object.values(SHELLMAN_TERMINAL_THEMES).map(t => `<option value="${t.id}" ${savedThemeKey === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>
              </div>
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
          <div id="screen_${termWinId}" style="flex:1; width:100%; height:100%; overflow:hidden; padding:4px; box-sizing:border-box; background:${activeTheme.background};"></div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const screenEl = bodyEl.querySelector(`#screen_${termWinId}`);
        const statusEl = bodyEl.querySelector(`#status_${termWinId}`);
        const dotEl = bodyEl.querySelector(`#dot_${termWinId}`);
        const dimEl = bodyEl.querySelector(`#dim_${termWinId}`);
        const themeSelect = bodyEl.querySelector(`#theme_${termWinId}`);

        if (themeSelect) {
          themeSelect.addEventListener('change', (e) => {
            applyShellmanTerminalTheme(e.target.value);
          });
        }

        const baseFontPx = parseFloat(localStorage.getItem('shellman_font_size') || '16');
        const term = new Terminal({
          cursorBlink: true,
          cursorStyle: 'bar',
          fontSize: Math.max(10, Math.round(14 * (baseFontPx / 16))),
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          theme: activeTheme,
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
};