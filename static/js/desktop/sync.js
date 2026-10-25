/**
 * ShellMan OS: Agentless Rsync File Synchronization (sync.js)
 */

DesktopAppsController.prototype.launchSync = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('sync');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      return existing;
    }

    const syncWinId = 'sync_' + Date.now();
    const defaultServerSrc = params.src || '/var/www/';
    const defaultServerDst = params.dst || '/var/backups/www/';
    const defaultLocalPath = params.local_path || '~/';
    const defaultRemotePath = params.remote_path || '/var/www/';

    return WindowManager.createWindow({
      appId: 'sync',
      multiInstance: false,
      title: `Agentless File Sync (Rsync) - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      width: 980,
      height: 640,
      minWidth: 720,
      minHeight: 460,
      contentHtml: `
        <div style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); color:var(--text-primary); font-family:var(--font-sans); position:relative; overflow:hidden;">
          <!-- Top Utility Toolbar -->
          <div style="height:38px; background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); padding:0 0.75rem; display:flex; align-items:center; justify-content:space-between; gap:0.5rem; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.35rem;">
              <button type="button" class="btn btn-secondary btn-xs sync-mode-tab active" id="tabLocalRemote_${syncWinId}" style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.25rem 0.6rem; font-weight:600; font-size:0.75rem; border-color:var(--sm-accent); color:var(--sm-accent); background:color-mix(in srgb, var(--sm-accent) 15%, transparent);">
                <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/><circle cx="12" cy="12" r="3"/></svg>
                Local &harr; Remote Sync
              </button>
              <button type="button" class="btn btn-secondary btn-xs sync-mode-tab" id="tabServerServer_${syncWinId}" style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.25rem 0.6rem; font-weight:600; font-size:0.75rem;">
                <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
                Server Backup &amp; Mirror
              </button>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="font-size:0.72rem; color:var(--text-muted);">Host: <code style="color:#cbd5e1; font-family:var(--font-mono);">${this.serverHost}</code></span>
              <button class="btn btn-secondary btn-xs" id="btnClearLog_${syncWinId}" style="padding:0.2rem 0.5rem; font-size:0.72rem;">Clear Output</button>
            </div>
          </div>

          <!-- Body: Two-column layout -->
          <div style="flex:1; display:flex; overflow:hidden;">
            <!-- Left Config Pane -->
            <div style="width:420px; min-width:360px; border-right:1px solid var(--border-subtle); padding:1rem; overflow-y:auto; display:flex; flex-direction:column; gap:0.85rem; background:rgba(0,0,0,0.15);">
              
              <!-- MODE 1: LOCAL <-> REMOTE CONTAINER -->
              <div id="paneLocalRemote_${syncWinId}" style="display:flex; flex-direction:column; gap:0.85rem;">
                <!-- Direction Toggle -->
                <div>
                  <label style="display:block; font-size:0.72rem; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:0.35rem; letter-spacing:0.04em;">Transfer Direction</label>
                  <div style="display:flex; gap:0.4rem;">
                    <button type="button" class="btn btn-secondary btn-xs sync-dir-btn active" id="btnDirPush_${syncWinId}" style="flex:1; display:inline-flex; align-items:center; justify-content:center; gap:0.4rem; padding:0.4rem 0.5rem; font-size:0.74rem; font-weight:600; border-color:var(--sm-accent); color:var(--sm-accent); background:color-mix(in srgb, var(--sm-accent) 15%, transparent);">
                      <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                      Push: Local &rarr; Server
                    </button>
                    <button type="button" class="btn btn-secondary btn-xs sync-dir-btn" id="btnDirPull_${syncWinId}" style="flex:1; display:inline-flex; align-items:center; justify-content:center; gap:0.4rem; padding:0.4rem 0.5rem; font-size:0.74rem; font-weight:600;">
                      <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                      Pull: Server &rarr; Local
                    </button>
                  </div>
                </div>

                <!-- Local Directory Input -->
                <div>
                  <label style="display:flex; align-items:center; justify-content:space-between; font-size:0.74rem; font-weight:700; color:#cbd5e1; margin-bottom:0.3rem;">
                    <span style="display:flex; align-items:center; gap:0.35rem;">
                      <svg style="width:13px;height:13px;color:var(--sm-accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                      <span id="lblLocal_${syncWinId}">Local Machine Directory (Source)</span>
                    </span>
                  </label>
                  <div style="display:flex; gap:0.4rem; margin-bottom:0.35rem;">
                    <input type="text" id="rsyncLocalPath_${syncWinId}" value="${defaultLocalPath}" class="form-control" style="flex:1; font-family:monospace; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="~/myproject/ or /home/user/code/">
                    <button type="button" class="btn btn-secondary btn-xs" id="btnBrowseLocal_${syncWinId}" style="display:inline-flex; align-items:center; gap:0.3rem; padding:0 0.65rem;" title="Browse Local Machine Folders">
                      <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      Browse...
                    </button>
                  </div>
                  <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                    <span style="font-size:0.68rem; color:var(--text-muted); align-self:center; margin-right:2px;">Quick:</span>
                    <button type="button" class="btn btn-secondary btn-xs preset-local" data-val="~/">${'~/'}</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-local" data-val="~/Projects/">~/Projects/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-local" data-val="~/Documents/">~/Documents/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-local" data-val="/tmp/sync/">/tmp/sync/</button>
                  </div>
                </div>

                <!-- Remote Directory Input with Browse Button -->
                <div>
                  <label style="display:flex; align-items:center; justify-content:space-between; font-size:0.74rem; font-weight:700; color:#cbd5e1; margin-bottom:0.3rem;">
                    <span style="display:flex; align-items:center; gap:0.35rem;">
                      <svg style="width:13px;height:13px;color:#34d399;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
                      <span id="lblRemote_${syncWinId}">Remote Server Directory (Destination)</span>
                    </span>
                  </label>
                  <div style="display:flex; gap:0.4rem; margin-bottom:0.35rem;">
                    <input type="text" id="rsyncRemotePath_${syncWinId}" value="${defaultRemotePath}" class="form-control" style="flex:1; font-family:monospace; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="/var/www/ or /opt/app/">
                    <button type="button" class="btn btn-secondary btn-xs" id="btnBrowseRemote_${syncWinId}" style="display:inline-flex; align-items:center; gap:0.3rem; padding:0 0.65rem;" title="Browse Server Folders">
                      <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      Browse...
                    </button>
                  </div>
                  <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                    <span style="font-size:0.68rem; color:var(--text-muted); align-self:center; margin-right:2px;">Quick:</span>
                    <button type="button" class="btn btn-secondary btn-xs preset-remote" data-val="/var/www/">/var/www/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-remote" data-val="/opt/">/opt/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-remote" data-val="/home/">/home/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-remote" data-val="/etc/">/etc/</button>
                  </div>
                </div>
              </div>

              <!-- MODE 2: SERVER BACKUP & MIRROR CONTAINER -->
              <div id="paneServerServer_${syncWinId}" style="display:none; flex-direction:column; gap:0.85rem;">
                <!-- Server Source Directory -->
                <div>
                  <label style="display:flex; align-items:center; justify-content:space-between; font-size:0.74rem; font-weight:700; color:#cbd5e1; margin-bottom:0.3rem;">
                    <span style="display:flex; align-items:center; gap:0.35rem;">
                      <svg style="width:13px;height:13px;color:var(--sm-accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      Source Directory on Server
                    </span>
                  </label>
                  <div style="display:flex; gap:0.4rem; margin-bottom:0.35rem;">
                    <input type="text" id="rsyncServerSrc_${syncWinId}" value="${defaultServerSrc}" class="form-control" style="flex:1; font-family:monospace; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="/var/www/">
                    <button type="button" class="btn btn-secondary btn-xs" id="btnBrowseServerSrc_${syncWinId}" style="display:inline-flex; align-items:center; gap:0.3rem; padding:0 0.65rem;" title="Browse Server Folders">
                      <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      Browse...
                    </button>
                  </div>
                  <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                    <span style="font-size:0.68rem; color:var(--text-muted); align-self:center; margin-right:2px;">Quick:</span>
                    <button type="button" class="btn btn-secondary btn-xs preset-server-src" data-val="/var/www/">/var/www/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-server-src" data-val="/home/">/home/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-server-src" data-val="/opt/">/opt/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-server-src" data-val="/etc/nginx/">/etc/nginx/</button>
                  </div>
                </div>

                <!-- Server Direction Divider -->
                <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; margin:0.1rem 0;">
                  <div style="flex:1; height:1px; background:var(--border-subtle);"></div>
                  <div style="padding:0.2rem 0.6rem; border-radius:12px; background:color-mix(in srgb, var(--sm-accent) 10%, transparent); border:1px solid color-mix(in srgb, var(--sm-accent) 25%, transparent); color:var(--sm-accent); display:flex; align-items:center; gap:0.35rem; font-weight:600; font-size:0.7rem;">
                    <span>Replicates to Target</span>
                    <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </div>
                  <div style="flex:1; height:1px; background:var(--border-subtle);"></div>
                </div>

                <!-- Server Destination Directory -->
                <div>
                  <label style="display:flex; align-items:center; justify-content:space-between; font-size:0.74rem; font-weight:700; color:#cbd5e1; margin-bottom:0.3rem;">
                    <span style="display:flex; align-items:center; gap:0.35rem;">
                      <svg style="width:13px;height:13px;color:#34d399;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      Destination Directory on Server
                    </span>
                  </label>
                  <div style="display:flex; gap:0.4rem; margin-bottom:0.35rem;">
                    <input type="text" id="rsyncServerDst_${syncWinId}" value="${defaultServerDst}" class="form-control" style="flex:1; font-family:monospace; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="/var/backups/www/">
                    <button type="button" class="btn btn-secondary btn-xs" id="btnBrowseServerDst_${syncWinId}" style="display:inline-flex; align-items:center; gap:0.3rem; padding:0 0.65rem;" title="Browse Server Folders">
                      <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                      Browse...
                    </button>
                  </div>
                  <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                    <span style="font-size:0.68rem; color:var(--text-muted); align-self:center; margin-right:2px;">Quick:</span>
                    <button type="button" class="btn btn-secondary btn-xs preset-server-dst" data-val="/var/backups/">/var/backups/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-server-dst" data-val="/opt/replica/">/opt/replica/</button>
                    <button type="button" class="btn btn-secondary btn-xs preset-server-dst" data-val="/tmp/sync-preview/">/tmp/sync-preview/</button>
                  </div>
                </div>
              </div>

              <!-- Options -->
              <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; padding:0.75rem;">
                <div style="font-size:0.74rem; font-weight:700; color:#cbd5e1; margin-bottom:0.45rem;">Transfer Options</div>
                <div style="display:flex; flex-direction:column; gap:0.45rem; font-size:0.75rem;">
                  <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                    <input type="checkbox" id="chkArchive_${syncWinId}" checked>
                    <span>Archive mode (<code style="color:var(--sm-accent);">-a</code>: preserve permissions &amp; dates)</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                    <input type="checkbox" id="chkCompress_${syncWinId}" checked>
                    <span>Compression (<code style="color:var(--sm-accent);">-z</code>: gzip transfer stream)</span>
                  </label>
                  <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                    <input type="checkbox" id="chkDelete_${syncWinId}">
                    <span style="color:#fca5a5;">Mirror Delete (<code style="color:#f87171;">--delete</code>: remove target files not in source)</span>
                  </label>
                </div>
              </div>

              <!-- Excludes -->
              <div>
                <label style="display:block; font-size:0.74rem; font-weight:700; color:#cbd5e1; margin-bottom:0.3rem;">Ignore / Exclude Patterns</label>
                <input type="text" id="rsyncExclude_${syncWinId}" value=".git, node_modules, __pycache__, *.tmp, .DS_Store" class="form-control" style="width:100%; font-size:0.75rem; padding:0.35rem 0.5rem;">
              </div>

              <!-- Action buttons -->
              <div style="display:flex; gap:0.5rem; margin-top:auto; padding-top:0.5rem;">
                <button type="button" class="btn btn-secondary btn-sm" id="btnDryRun_${syncWinId}" style="flex:1; display:flex; align-items:center; justify-content:center; gap:0.4rem;" title="Test and preview without changing files">
                  <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  Preview Changes
                </button>
                <button type="button" class="btn btn-primary btn-sm" id="btnExecSync_${syncWinId}" style="flex:1; display:flex; align-items:center; justify-content:center; gap:0.4rem; font-weight:600;">
                  <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                  Sync Now
                </button>
              </div>
            </div>

            <!-- Right Output Pane -->
            <div style="flex:1; display:flex; flex-direction:column; background:#0b111c; overflow:hidden;">
              <div style="background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border-subtle); padding:0.45rem 0.9rem; display:flex; align-items:center; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                  <span style="font-size:0.74rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">Sync Output</span>
                  <span id="syncStatusBadge_${syncWinId}" style="font-size:0.68rem; padding:0.12rem 0.45rem; border-radius:3px; background:rgba(255,255,255,0.05); color:#94a3b8; font-family:var(--font-mono);">IDLE</span>
                </div>
              </div>

              <!-- Terminal log display -->
              <div id="syncLogArea_${syncWinId}" style="flex:1; padding:0.85rem; font-family:monospace; font-size:0.8rem; line-height:1.45; overflow-y:auto; color:#cbd5e1; white-space:pre-wrap; word-break:break-all;">
Ready. Choose your sync mode and folders on the left, then click "Preview Changes" to inspect differences or "Sync Now" to start transferring.
              </div>
            </div>
          </div>
        </div>
      `,
      onInit: (bodyEl) => {
        let currentMode = 'local_remote'; // 'local_remote' | 'server_server'
        let currentDirection = 'push';    // 'push' | 'pull'

        // Mode tabs
        const tabLR = bodyEl.querySelector(`#tabLocalRemote_${syncWinId}`);
        const tabSS = bodyEl.querySelector(`#tabServerServer_${syncWinId}`);
        const paneLR = bodyEl.querySelector(`#paneLocalRemote_${syncWinId}`);
        const paneSS = bodyEl.querySelector(`#paneServerServer_${syncWinId}`);

        // Mode 1 inputs
        const btnPush = bodyEl.querySelector(`#btnDirPush_${syncWinId}`);
        const btnPull = bodyEl.querySelector(`#btnDirPull_${syncWinId}`);
        const localPathInp = bodyEl.querySelector(`#rsyncLocalPath_${syncWinId}`);
        const btnBrowseLocal = bodyEl.querySelector(`#btnBrowseLocal_${syncWinId}`);
        const remotePathInp = bodyEl.querySelector(`#rsyncRemotePath_${syncWinId}`);
        const btnBrowseRemote = bodyEl.querySelector(`#btnBrowseRemote_${syncWinId}`);
        const lblLocal = bodyEl.querySelector(`#lblLocal_${syncWinId}`);
        const lblRemote = bodyEl.querySelector(`#lblRemote_${syncWinId}`);

        // Mode 2 inputs
        const serverSrcInp = bodyEl.querySelector(`#rsyncServerSrc_${syncWinId}`);
        const serverDstInp = bodyEl.querySelector(`#rsyncServerDst_${syncWinId}`);
        const btnBrowseServerSrc = bodyEl.querySelector(`#btnBrowseServerSrc_${syncWinId}`);
        const btnBrowseServerDst = bodyEl.querySelector(`#btnBrowseServerDst_${syncWinId}`);

        // Common options
        const chkArch = bodyEl.querySelector(`#chkArchive_${syncWinId}`);
        const chkComp = bodyEl.querySelector(`#chkCompress_${syncWinId}`);
        const chkDel = bodyEl.querySelector(`#chkDelete_${syncWinId}`);
        const exclInp = bodyEl.querySelector(`#rsyncExclude_${syncWinId}`);

        // Buttons & Output
        const dryBtn = bodyEl.querySelector(`#btnDryRun_${syncWinId}`);
        const execBtn = bodyEl.querySelector(`#btnExecSync_${syncWinId}`);
        const logArea = bodyEl.querySelector(`#syncLogArea_${syncWinId}`);
        const badge = bodyEl.querySelector(`#syncStatusBadge_${syncWinId}`);
        const clearBtn = bodyEl.querySelector(`#btnClearLog_${syncWinId}`);

        // Switch Mode handler
        const switchMode = (mode) => {
          currentMode = mode;
          if (mode === 'local_remote') {
            tabLR.classList.add('active');
            tabLR.style.borderColor = '#38bdf8';
            tabLR.style.color = '#38bdf8';
            tabLR.style.background = 'rgba(2,132,199,0.15)';

            tabSS.classList.remove('active');
            tabSS.style.borderColor = 'var(--border-color)';
            tabSS.style.color = 'var(--text-secondary)';
            tabSS.style.background = 'transparent';

            paneLR.style.display = 'flex';
            paneSS.style.display = 'none';
          } else {
            tabSS.classList.add('active');
            tabSS.style.borderColor = '#38bdf8';
            tabSS.style.color = '#38bdf8';
            tabSS.style.background = 'rgba(2,132,199,0.15)';

            tabLR.classList.remove('active');
            tabLR.style.borderColor = 'var(--border-color)';
            tabLR.style.color = 'var(--text-secondary)';
            tabLR.style.background = 'transparent';

            paneSS.style.display = 'flex';
            paneLR.style.display = 'none';
          }
        };

        tabLR.onclick = () => switchMode('local_remote');
        tabSS.onclick = () => switchMode('server_server');

        // Switch Direction handler (Mode 1)
        const setDirection = (dir) => {
          currentDirection = dir;
          if (dir === 'push') {
            btnPush.classList.add('active');
            btnPush.style.borderColor = '#38bdf8';
            btnPush.style.color = '#38bdf8';
            btnPush.style.background = 'rgba(2,132,199,0.15)';

            btnPull.classList.remove('active');
            btnPull.style.borderColor = 'var(--border-color)';
            btnPull.style.color = 'var(--text-secondary)';
            btnPull.style.background = 'transparent';

            lblLocal.textContent = 'Local Machine Directory (Source)';
            lblRemote.textContent = 'Remote Server Directory (Destination)';
          } else {
            btnPull.classList.add('active');
            btnPull.style.borderColor = '#38bdf8';
            btnPull.style.color = '#38bdf8';
            btnPull.style.background = 'rgba(2,132,199,0.15)';

            btnPush.classList.remove('active');
            btnPush.style.borderColor = 'var(--border-color)';
            btnPush.style.color = 'var(--text-secondary)';
            btnPush.style.background = 'transparent';

            lblLocal.textContent = 'Local Machine Directory (Destination)';
            lblRemote.textContent = 'Remote Server Directory (Source)';
          }
        };

        btnPush.onclick = () => setDirection('push');
        btnPull.onclick = () => setDirection('pull');

        // Browse Directory Pickers
        if (btnBrowseLocal) {
          btnBrowseLocal.onclick = () => {
            this.showDirectoryPicker({
              isLocal: true,
              initialPath: localPathInp.value.trim() || '~/',
              title: `Select Local Machine Directory (${currentDirection === 'push' ? 'Source' : 'Destination'})`,
              onSelect: (selectedPath) => {
                localPathInp.value = selectedPath.endsWith('/') ? selectedPath : selectedPath + '/';
              }
            });
          };
        }

        if (btnBrowseRemote) {
          btnBrowseRemote.onclick = () => {
            this.showDirectoryPicker({
              serverId: this.serverId,
              initialPath: remotePathInp.value.trim() || '/',
              title: `Select Remote Server Directory (${currentDirection === 'push' ? 'Destination' : 'Source'})`,
              onSelect: (selectedPath) => {
                remotePathInp.value = selectedPath.endsWith('/') ? selectedPath : selectedPath + '/';
              }
            });
          };
        }

        if (btnBrowseServerSrc) {
          btnBrowseServerSrc.onclick = () => {
            this.showDirectoryPicker({
              serverId: this.serverId,
              initialPath: serverSrcInp.value.trim() || '/',
              title: 'Select Source Directory on Server',
              onSelect: (selectedPath) => {
                serverSrcInp.value = selectedPath.endsWith('/') ? selectedPath : selectedPath + '/';
              }
            });
          };
        }

        if (btnBrowseServerDst) {
          btnBrowseServerDst.onclick = () => {
            this.showDirectoryPicker({
              serverId: this.serverId,
              initialPath: serverDstInp.value.trim() || '/',
              title: 'Select Destination Directory on Server',
              onSelect: (selectedPath) => {
                serverDstInp.value = selectedPath.endsWith('/') ? selectedPath : selectedPath + '/';
              }
            });
          };
        }

        // Quick Presets
        bodyEl.querySelectorAll('.preset-local').forEach(b => {
          b.onclick = () => { localPathInp.value = b.dataset.val; };
        });
        bodyEl.querySelectorAll('.preset-remote').forEach(b => {
          b.onclick = () => { remotePathInp.value = b.dataset.val; };
        });
        bodyEl.querySelectorAll('.preset-server-src').forEach(b => {
          b.onclick = () => { serverSrcInp.value = b.dataset.val; };
        });
        bodyEl.querySelectorAll('.preset-server-dst').forEach(b => {
          b.onclick = () => { serverDstInp.value = b.dataset.val; };
        });

        // Clear output
        clearBtn.onclick = () => {
          logArea.textContent = 'Cleared.';
          badge.textContent = 'IDLE';
          badge.style.background = 'rgba(255,255,255,0.05)';
          badge.style.color = '#94a3b8';
        };

        // Construct request payload
        const buildPayload = () => {
          const excludes = exclInp.value.split(',').map(s => s.trim()).filter(Boolean);
          const options = {
            archive: chkArch.checked,
            compress: chkComp.checked,
            delete: chkDel.checked
          };

          if (currentMode === 'local_remote') {
            return {
              sync_mode: 'local_remote',
              direction: currentDirection,
              local_path: localPathInp.value.trim(),
              remote_path: remotePathInp.value.trim(),
              options,
              excludes
            };
          } else {
            return {
              sync_mode: 'server_server',
              src_path: serverSrcInp.value.trim(),
              dst_path: serverDstInp.value.trim(),
              options,
              excludes
            };
          }
        };

        // Dry Run Preview
        dryBtn.onclick = async () => {
          const payload = buildPayload();
          if (payload.sync_mode === 'local_remote') {
            if (!payload.local_path || !payload.remote_path) {
              if (window.showToast) window.showToast('Both Local and Remote Server paths are required.', 'warning');
              else DesktopModal.alert({ title: 'Paths Required', message: 'Both Local Directory and Remote Server Directory paths are required.', type: 'warning' });
              return;
            }
          } else {
            if (!payload.src_path || !payload.dst_path) {
              if (window.showToast) window.showToast('Both Source and Destination paths on server are required.', 'warning');
              else DesktopModal.alert({ title: 'Paths Required', message: 'Both Source and Destination Directory paths on server are required.', type: 'warning' });
              return;
            }
          }

          dryBtn.disabled = true;
          dryBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Previewing...`;
          badge.textContent = 'ANALYZING';
          badge.style.background = 'rgba(2,132,199,0.15)';
          badge.style.color = '#38bdf8';

          const targetDesc = payload.sync_mode === 'local_remote'
            ? (payload.direction === 'push' ? `[Local: ${payload.local_path}] -> [Remote: ${payload.remote_path}]` : `[Remote: ${payload.remote_path}] -> [Local: ${payload.local_path}]`)
            : `[Server: ${payload.src_path}] -> [Server: ${payload.dst_path}]`;

          logArea.textContent = `[Rsync Preview] Analyzing ${targetDesc}...\n`;

          try {
            const resp = await fetch(`/api/servers/${this.serverId}/sync/preview`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const res = await resp.json();
            if (res.success) {
              badge.textContent = 'PREVIEW OK';
              badge.style.background = 'rgba(16,185,129,0.15)';
              badge.style.color = '#34d399';

              let summary = `\nMode: ${payload.sync_mode === 'local_remote' ? `Local <-> Remote (${payload.direction.toUpperCase()})` : 'Server Backup & Mirror'}\n`;
              summary += `Command: ${res.command}\n`;
              summary += `\nFiles to Synchronize (${res.total_files_count}):\n`;
              if (res.files && res.files.length > 0) {
                summary += res.files.map(f => `  + ${f}`).join('\n') + '\n';
                if (res.total_files_count > res.files.length) {
                  summary += `  ... and ${res.total_files_count - res.files.length} more files.\n`;
                }
              } else {
                summary += `  (No modified or missing files. Directories are already in sync)\n`;
              }
              summary += `\nTransfer Statistics:\n`;
              for (const [k, v] of Object.entries(res.stats || {})) {
                summary += `  ${k.replace(/_/g, ' ')}: ${v}\n`;
              }
              logArea.textContent = summary;
              if (window.showToast) window.showToast(`Preview dry run completed: ${res.total_files_count} files evaluated`, 'info');
            } else {
              badge.textContent = 'ERROR';
              badge.style.background = 'rgba(239,68,68,0.15)';
              badge.style.color = '#f87171';
              logArea.textContent = `[Rsync Error]\n${res.error || res.raw_output || 'Unknown error occurred during preview.'}`;
            }
          } catch (e) {
            badge.textContent = 'FAILED';
            badge.style.background = 'rgba(239,68,68,0.15)';
            badge.style.color = '#f87171';
            logArea.textContent = `Network error during preview: ${e}`;
          } finally {
            dryBtn.disabled = false;
            dryBtn.innerHTML = `
              <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              Preview Changes
            `;
          }
        };

        // Execute Live Sync
        execBtn.onclick = async () => {
          const payload = buildPayload();
          if (payload.sync_mode === 'local_remote') {
            if (!payload.local_path || !payload.remote_path) {
              if (window.showToast) window.showToast('Both Local and Remote Server paths are required.', 'warning');
              else DesktopModal.alert({ title: 'Paths Required', message: 'Both Local Directory and Remote Server Directory paths are required.', type: 'warning' });
              return;
            }
          } else {
            if (!payload.src_path || !payload.dst_path) {
              if (window.showToast) window.showToast('Both Source and Destination paths on server are required.', 'warning');
              else DesktopModal.alert({ title: 'Paths Required', message: 'Both Source and Destination Directory paths on server are required.', type: 'warning' });
              return;
            }
          }

          const desc = payload.sync_mode === 'local_remote'
            ? (payload.direction === 'push' ? `Local "${payload.local_path}" -> Server "${payload.remote_path}"` : `Server "${payload.remote_path}" -> Local "${payload.local_path}"`)
            : `Server "${payload.src_path}" -> Server "${payload.dst_path}"`;

          const warnDelete = payload.options.delete ? '\n\nWARNING: Mirror Delete (--delete) is enabled. Extraneous destination files will be permanently erased.' : '';

          const ok = await DesktopModal.confirm({
            title: 'Execute Live Rsync Transfer',
            message: `Are you sure you want to execute live sync?\n\n${desc}${warnDelete}`,
            confirmText: 'Execute Sync',
            isDanger: payload.options.delete
          });
          if (!ok) {
            return;
          }

          execBtn.disabled = true;
          execBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Transferring...`;
          badge.textContent = 'SYNCING';
          badge.style.background = 'rgba(245,158,11,0.15)';
          badge.style.color = '#fbbf24';
          logArea.textContent = `[Live Rsync Transfer Started]\n${desc}\nExecuting rsync...\n`;

          try {
            const resp = await fetch(`/api/servers/${this.serverId}/sync/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const res = await resp.json();
            if (res.success) {
              badge.textContent = 'SUCCESS';
              badge.style.background = 'rgba(16,185,129,0.15)';
              badge.style.color = '#34d399';
              logArea.textContent = `[Live Sync Completed Successfully]\nCommand: ${res.command}\n\n${res.raw_output}`;
              if (window.showToast) window.showToast('Rsync transfer completed successfully!', 'success');
            } else {
              badge.textContent = 'FAILED';
              badge.style.background = 'rgba(239,68,68,0.15)';
              badge.style.color = '#f87171';
              logArea.textContent = `[Live Sync Failed - Exit Code ${res.exit_code}]\n\n${res.raw_output || res.error || 'Transfer failed.'}`;
            }
          } catch (e) {
            badge.textContent = 'FAILED';
            badge.style.background = 'rgba(239,68,68,0.15)';
            badge.style.color = '#f87171';
            logArea.textContent = `Network error during live sync: ${e}`;
          } finally {
            execBtn.disabled = false;
            execBtn.innerHTML = `
              <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
              Sync Now
            `;
          }
        };
      }
    });
};

