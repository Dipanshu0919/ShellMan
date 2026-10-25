/**
 * ShellMan OS: SFTP File Manager (filemanager.js)
 * Includes real-time SSE progress streaming for Upload, Download, Copy, Move & Archive.
 */

DesktopAppsController.prototype.launchFiles = function (params = {}) {
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

    // ─────────────────────────────────────────────────────────────
    // Universal SSE byte-progress streamer
    //    Opens /api/tasks/<task_id>/progress and updates a live
    //    toast with transferred / total bytes and percentage.
    // ─────────────────────────────────────────────────────────────
    function streamTaskProgress(taskId, title, successMsg, onComplete) {
      const toastId = 'sse_toast_' + Date.now();
      const toast = document.createElement('div');
      toast.id = toastId;
      toast.className = 'desktop-toast info';
      toast.style.cssText = 'flex-direction:column; align-items:flex-start; gap:6px; min-width:340px;';
      toast.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span style="font-weight:600; font-size:0.8rem; color:#f8fafc;">${title}</span>
          <span class="sse-percent" style="font-family:var(--font-mono); font-size:0.75rem; color:#38bdf8;">0%</span>
        </div>
        <div style="width:100%; height:5px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
          <div class="sse-bar" style="width:0%; height:100%; background:#0284c7; transition:width 0.2s ease;"></div>
        </div>
        <div class="sse-status" style="font-family:var(--font-mono); font-size:0.68rem; color:#94a3b8; width:100%; text-align:right;">Connecting...</div>
      `;
      const tc = document.getElementById('toastContainer');
      if (tc) tc.appendChild(toast);

      const eventSource = new EventSource(`/api/tasks/${taskId}/progress`);

      let lastTransferred = 0;
      let lastUpdateTime = Date.now();
      let stallShown = false;
      let stallCheck = setInterval(() => {
        if (Date.now() - lastUpdateTime > 4000 && toast.isConnected && !stallShown) {
          const statEl = toast.querySelector('.sse-status');
          if (statEl) {
            statEl.textContent += ' (waiting on remote server...)';
            statEl.style.color = '#f59e0b';
            stallShown = true;
          }
        }
      }, 1000);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'waiting') return;

          if (data.transferred !== lastTransferred) {
            lastTransferred = data.transferred;
            lastUpdateTime = Date.now();
            stallShown = false;
            const s = toast.querySelector('.sse-status');
            if (s) s.style.color = '#94a3b8';
          }

          const transferredMB = (data.transferred / 1048576).toFixed(2);
          const pctEl = toast.querySelector('.sse-percent');
          const barEl = toast.querySelector('.sse-bar');
          const statEl = toast.querySelector('.sse-status');

          if (data.total > 0) {
            const percent = Math.min(100, Math.round((data.transferred / data.total) * 100));
            const totalMB = (data.total / 1048576).toFixed(2);
            if (pctEl) pctEl.textContent = `${percent}%`;
            if (barEl) { barEl.style.width = `${percent}%`; barEl.style.opacity = '1'; }
            if (statEl && !stallShown) statEl.textContent = `${transferredMB} MB / ${totalMB} MB`;
          } else {
            // total unknown (e.g. compression): show real bytes written, no fake percent
            if (pctEl) pctEl.textContent = '…';
            if (barEl) { barEl.style.width = '100%'; barEl.style.opacity = '0.35'; }
            if (statEl && !stallShown) statEl.textContent = `${transferredMB} MB written`;
          }

          if (data.status === 'done') {
            clearInterval(stallCheck);
            eventSource.close();
            toast.className = 'desktop-toast success';
            toast.innerHTML = `<div style="font-weight:600; color:#34d399;">✓ ${successMsg || 'Completed successfully!'}</div>`;
            setTimeout(() => toast.remove(), 3000);
            if (onComplete) onComplete();
          } else if (data.status === 'error') {
            clearInterval(stallCheck);
            eventSource.close();
            toast.className = 'desktop-toast error';
            toast.innerHTML = `<div style="font-weight:600; color:#f87171;">✗ Failed: ${data.error || 'Unknown error'}</div>`;
            setTimeout(() => toast.remove(), 5000);
          }
        } catch (_) {}
      };

      eventSource.onerror = () => {
        clearInterval(stallCheck);
        eventSource.close();
        toast.remove();
      };
    }

    const startProgressToast = (taskId, title, successMsg, onComplete) => {
      streamTaskProgress(taskId, title, successMsg, onComplete);
    };

    const downloadFile = (filePath) => {
      window.location.href = `/api/servers/${this.serverId}/files/download?path=${encodeURIComponent(filePath)}`;
    };

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
                const ok = await DesktopModal.confirm({
                  title: 'Delete Custom Action',
                  message: `Are you sure you want to permanently delete custom action "${actionToEdit.name}"?`,
                  confirmText: 'Delete Action',
                  isDanger: true
                });
                if (!ok) return;
                try {
                  const resp = await fetch(`/api/actions/${actionToEdit.id}`, { method: 'DELETE' });
                  const res = await resp.json();
                  if (res.success) {
                    closeModal();
                    updatePropertiesPane();
                  } else {
                    DesktopModal.alert({ title: 'Delete Failed', message: res.error || 'Failed to delete action', type: 'danger' });
                  }
                } catch (e) {
                  DesktopModal.alert({ title: 'Delete Error', message: String(e.message || e), type: 'danger' });
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
              wire('propBtn_dl', () => downloadFile(item.path));
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
              DesktopModal.alert({ title: 'SFTP Error', message: res.error || 'Failed to list directory contents.', type: 'danger' });
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
            } else if (item && (item.name.endsWith('.db') || item.name.endsWith('.sqlite') || item.name.endsWith('.sqlite3'))) {
              DesktopApps.launch('database', { path });
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

        const clearSelection = () => {
          selectedPaths.clear();
          updateRowHighlights();
        };

        const clearBtn = bodyEl.querySelector(`#clearSelectBtn_${fileWinId}`);
        if (clearBtn) clearBtn.onclick = clearSelection;

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
                downloadFile(item.path);
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

        // ─────────────────────────────────────────────────
        // Copy / Move now uses SSE
        // ─────────────────────────────────────────────────
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
              const targetDir = destInp.value.trim();
              const errEl = modalEl.querySelector(`#copyMoveErr_${fileWinId}`);
              if (!targetDir) {
                errEl.style.display = 'block';
                errEl.textContent = 'Destination directory is required';
                return false;
              }

              const taskId = (isCopy ? 'copy_' : 'move_') + Date.now();
              startProgressToast(
                taskId,
                `${isCopy ? 'Copying' : 'Moving'} ${count} item(s)`,
                `${isCopy ? 'Copy' : 'Move'} complete!`,
                () => { loadDir(currentPath, false); clearSelection(); }
              );

              try {
                const endpoint = `/api/servers/${this.serverId}/files/batch-${action}`;
                const resp = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ paths, dest_dir: targetDir, task_id: taskId })
                });
                const res = await resp.json();
                if (!res.success) {
                  errEl.style.display = 'block';
                  errEl.textContent = res.error || `${isCopy ? 'Copy' : 'Move'} failed`;
                  return false;
                }
                return true;
              } catch (e) {
                errEl.style.display = 'block';
                errEl.textContent = 'Network error: ' + e;
                return false;
              }
            },
            isCopy ? 'Copy Here' : 'Move Here'
          );

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

        // ─────────────────────────────────────────────────
        // Compress uses SSE
        // ─────────────────────────────────────────────────
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
              const rawName = modalEl.querySelector(`#archiveNameInp_${fileWinId}`).value.trim();
              const fmt = modalEl.querySelector(`#archiveFmt_${fileWinId}`).value;
              if (!rawName) {
                const e = modalEl.querySelector(`#compressErr_${fileWinId}`);
                e.style.display = 'block';
                e.textContent = 'Archive name cannot be empty';
                return false;
              }
              const archiveFullName = rawName.endsWith(fmt) ? rawName : rawName + fmt;

              const taskId = 'zip_' + Date.now();
              startProgressToast(
                taskId,
                `Compressing into ${archiveFullName}`,
                `Archive created!`,
                () => { loadDir(currentPath, false); }
              );

              try {
                const resp = await fetch(`/api/servers/${this.serverId}/files/batch-archive`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    paths: paths,
                    dest_dir: currentPath,
                    archive_name: archiveFullName,
                    task_id: taskId
                  })
                });
                const res = await resp.json();
                if (!res.success) {
                  const e = modalEl.querySelector(`#compressErr_${fileWinId}`);
                  e.style.display = 'block';
                  e.textContent = res.error || 'Compression failed';
                  return false;
                }
                return true;
              } catch (e) {
                const el = modalEl.querySelector(`#compressErr_${fileWinId}`);
                el.style.display = 'block';
                el.textContent = 'Compression error: ' + e;
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
              DesktopModal.alert({ title: 'Extraction Failed', message: res.error || 'Failed to extract archive.', type: 'danger' });
            }
          } catch (e) {
            DesktopModal.alert({ title: 'Extraction Error', message: String(e), type: 'danger' });
          }
        };

        // Multi-Item Download as Archive (Section 10)
        const downloadItemsAsArchive = async (paths, archiveName = 'download.tar.gz') => {
          const taskId = 'dlzip_' + Date.now();
          startProgressToast(
            taskId,
            `Creating archive ${archiveName}`,
            `Archive ready, starting download...`,
            () => {
              const fullArchivePath = (currentPath === '/' ? '' : currentPath) + '/' + archiveName;
              downloadFile(fullArchivePath);
              loadDir(currentPath, false);
            }
          );

          try {
            const resp = await fetch(`/api/servers/${this.serverId}/files/batch-archive`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paths, dest_dir: currentPath, archive_name: archiveName, task_id: taskId })
            });
            const res = await resp.json();
            if (!res.success) {
              DesktopModal.alert({ title: 'Archive Error', message: res.error || 'Failed to create archive', type: 'danger' });
            }
          } catch (e) {
            DesktopModal.alert({ title: 'Archive Error', message: String(e), type: 'danger' });
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
          const totalSize = uploadItems.reduce((acc, it) => acc + (it.file.size || 0), 0);
          const taskId = 'upl_' + Date.now();

          // Show toast with real-time progress from server
          startProgressToast(
            taskId,
            `Uploading ${uploadItems.length} item(s) (${(totalSize / 1024 / 1024).toFixed(1)} MB)`,
            `Upload complete!`,
            () => loadDir(currentPath, false)
          );

          const formData = new FormData();
          formData.append('dest_dir', destDir);
          formData.append('overwrite', overwrite ? 'true' : 'false');
          formData.append('task_id', taskId);
          for (const it of uploadItems) {
            formData.append('files', it.file, it.file.name);
            formData.append('relative_paths', it.relativePath || it.file.name);
          }

          fetch(`/api/servers/${this.serverId}/files/upload`, {
            method: 'POST',
            body: formData
          }).then(r => r.json()).then(res => {
            if (!res.success) {
              DesktopModal.alert({ title: 'Upload Failed', message: res.error || 'Upload failed', type: 'danger' });
            }
          }).catch(err => {
            DesktopModal.alert({ title: 'Upload Error', message: String(err), type: 'danger' });
          });
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
};

