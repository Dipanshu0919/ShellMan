/**
 * ShellMan OS: Task Manager, System Telemetry & Services (taskmanager.js)
 */

DesktopAppsController.prototype.launchOverview = function (params = {}) {
    const fetch = RequestScope.next(); // requests of this window are cancelled when it closes
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
};


DesktopAppsController.prototype.launchProcesses = function (params = {}) {
    const fetch = RequestScope.next(); // requests of this window are cancelled when it closes
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
                <div style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.22rem 0.55rem; border-radius:4px; background:rgba(var(--wash),0.04); border:1px solid rgba(var(--wash),0.07);" title="Host CPU Usage">
                  <span style="color:var(--text-muted); font-size:0.68rem; font-weight:700;">CPU:</span>
                  <span id="procMetricCpuVal" style="color:var(--c-ok); font-weight:700; font-family:var(--font-mono); font-size:0.72rem;">--%</span>
                  <div style="width:32px; height:4px; background:rgba(var(--wash),0.1); border-radius:2px; overflow:hidden;">
                    <div id="procMetricCpuBar" style="width:0%; height:100%; background:#34d399; transition:width 0.3s ease;"></div>
                  </div>
                </div>

                <!-- RAM -->
                <div style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.22rem 0.55rem; border-radius:4px; background:rgba(var(--wash),0.04); border:1px solid rgba(var(--wash),0.07);" title="Total Host Memory Usage">
                  <span style="color:var(--text-muted); font-size:0.68rem; font-weight:700;">RAM:</span>
                  <span id="procMetricMemVal" style="color:var(--sm-accent); font-weight:700; font-family:var(--font-mono); font-size:0.72rem;">--%</span>
                  <div style="width:32px; height:4px; background:rgba(var(--wash),0.1); border-radius:2px; overflow:hidden;">
                    <div id="procMetricMemBar" style="width:0%; height:100%; background:var(--sm-accent); transition:width 0.3s ease;"></div>
                  </div>
                </div>

                <!-- Storage / Disk -->
                <div style="display:inline-flex; align-items:center; gap:0.35rem; padding:0.22rem 0.55rem; border-radius:4px; background:rgba(var(--wash),0.04); border:1px solid rgba(var(--wash),0.07);" title="Total Root Storage Usage">
                  <span style="color:var(--text-muted); font-size:0.68rem; font-weight:700;">Disk:</span>
                  <span id="procMetricDiskVal" style="color:var(--c-violet); font-weight:700; font-family:var(--font-mono); font-size:0.72rem;">--%</span>
                  <div style="width:32px; height:4px; background:rgba(var(--wash),0.1); border-radius:2px; overflow:hidden;">
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

              <button class="btn btn-secondary btn-xs" id="procUniBtn" style="padding:0.25rem 0.6rem; display:none;" title="Show processes as a small universe">Universe</button>
              <button class="btn btn-secondary btn-xs" id="procRefreshBtn" style="padding:0.25rem 0.6rem;">Refresh</button>
            </div>
          </div>
          <div class="table-responsive" style="flex:1; overflow-y:auto;">
            <table class="table" style="margin:0; width:100%; border-collapse:collapse; font-size:0.78rem;">
              <thead>
                <tr id="procTableHeadRow" style="position:sticky; top:0; background:var(--bg-system); z-index:2; border-bottom:1px solid var(--border-subtle); color:var(--text-muted); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.03em;"></tr>
              </thead>
              <tbody id="procTableBody">
                <tr style="border-bottom:1px solid rgba(var(--wash),0.05);"><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:45px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:65px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:38px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:38px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:55px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:55px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:35px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:160px;"></div></td></tr>
                <tr style="border-bottom:1px solid rgba(var(--wash),0.05);"><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:50px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:70px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:35px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:42px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:52px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:50px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:35px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:220px;"></div></td></tr>
                <tr style="border-bottom:1px solid rgba(var(--wash),0.05);"><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:48px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:60px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:40px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:35px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:58px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:56px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:35px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:130px;"></div></td></tr>
                <tr style="border-bottom:1px solid rgba(var(--wash),0.05);"><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:52px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:68px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:32px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:38px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:54px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:52px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:35px;"></div></td><td style="padding:9px 12px;"><div class="sm-skeleton sm-skeleton-text" style="width:190px;"></div></td></tr>
              </tbody>
            </table>
          </div>
          <div id="procUni" style="flex:1; position:relative; display:none; min-height:0; overflow:hidden;"></div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        let procs = [];
        let uni = null;
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
          if (!stat) return { label: 'Unknown', color: 'var(--sm-accent)', bg: 'rgba(148,163,184,0.14)', desc: 'Unknown state' };
          const s = String(stat).trim();
          const primary = s.charAt(0);
          let label = 'Unknown';
          let color = 'var(--sm-accent)';
          let bg = 'rgba(148,163,184,0.14)';
          let baseDesc = '';

          switch (primary) {
            case 'R':
              label = 'Running';
              color = 'var(--c-ok)';
              bg = 'rgba(52,211,153,0.14)';
              baseDesc = 'Running (actively executing instructions on CPU)';
              break;
            case 'S':
              label = 'Active';
              color = 'var(--c-ok)';
              bg = 'rgba(52,211,153,0.14)';
              baseDesc = 'Active and healthy (listening & waiting for incoming requests / I/O)';
              break;
            case 'D':
              label = 'Disk Wait';
              color = 'var(--c-warn)';
              bg = 'rgba(251,191,36,0.14)';
              baseDesc = 'Uninterruptible sleep (usually waiting for disk I/O)';
              break;
            case 'Z':
              label = 'Zombie';
              color = 'var(--c-bad)';
              bg = 'rgba(248,113,113,0.16)';
              baseDesc = 'Defunct / Zombie (terminated, waiting for parent to reap)';
              break;
            case 'T':
              label = 'Stopped';
              color = 'var(--c-warn)';
              bg = 'rgba(251,146,60,0.14)';
              baseDesc = 'Stopped by job control signal or SIGSTOP';
              break;
            case 't':
              label = 'Traced';
              color = 'var(--c-warn)';
              bg = 'rgba(251,146,60,0.14)';
              baseDesc = 'Stopped by debugger during code tracing';
              break;
            case 'I':
              label = 'Idle';
              color = 'var(--sm-accent)';
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
            if (ok && uni) uni.collapse(proc.pid);
            if (ok) fetchProcs();
          };
          menu.querySelector('#ctx_kill').onclick = async () => {
            hideCtxMenu();
            const ok = await DesktopApps.killProcess(this.serverId, proc.pid, 'SIGKILL', proc.comm);
            if (ok && uni) uni.collapse(proc.pid);
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
                th.style.color = 'var(--text-primary)';
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
            cpuVal.style.color = cpu > 80 ? 'var(--c-bad)' : (cpu > 50 ? 'var(--c-warn)' : 'var(--c-ok)');
          }
          if (cpuBar) {
            cpuBar.style.width = `${Math.min(100, Math.max(0, cpu))}%`;
            cpuBar.style.background = cpu > 80 ? 'var(--c-bad)' : (cpu > 50 ? 'var(--c-warn)' : 'var(--c-ok)');
          }

          const memVal = bodyEl.querySelector('#procMetricMemVal');
          const memBar = bodyEl.querySelector('#procMetricMemBar');
          if (memVal) {
            memVal.textContent = `${mem}%`;
            if (m.memory && m.memory.used_formatted && m.memory.total_formatted) {
              memVal.parentElement.title = `Total Host Memory Usage: ${m.memory.used_formatted} / ${m.memory.total_formatted}`;
            }
            memVal.style.color = mem > 85 ? 'var(--c-bad)' : (mem > 60 ? 'var(--c-warn)' : 'var(--c-teal)');
          }
          if (memBar) {
            memBar.style.width = `${Math.min(100, Math.max(0, mem))}%`;
            memBar.style.background = mem > 85 ? 'var(--c-bad)' : (mem > 60 ? 'var(--c-warn)' : 'var(--c-teal)');
          }

          const diskVal = bodyEl.querySelector('#procMetricDiskVal');
          const diskBar = bodyEl.querySelector('#procMetricDiskBar');
          if (diskVal) {
            diskVal.textContent = `${disk}%`;
            if (m.disk && m.disk.used_formatted && m.disk.total_formatted) {
              diskVal.parentElement.title = `Total Root Storage Usage: ${m.disk.used_formatted} / ${m.disk.total_formatted}`;
            }
            diskVal.style.color = disk > 90 ? 'var(--c-bad)' : (disk > 75 ? 'var(--c-warn)' : 'var(--c-violet)');
          }
          if (diskBar) {
            diskBar.style.width = `${Math.min(100, Math.max(0, disk))}%`;
            diskBar.style.background = disk > 90 ? 'var(--c-bad)' : (disk > 75 ? 'var(--c-warn)' : 'var(--c-violet)');
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
              if (uni) uni.update(procs);
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
            const cpuColor = p.cpu > 50 ? 'var(--c-bad)' : (p.cpu > 15 ? 'var(--c-warn)' : 'var(--c-ok)');
            const memColor = p.mem > 50 ? 'var(--c-bad)' : (p.mem > 20 ? 'var(--c-warn)' : 'inherit');
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
              cells.push(`<td style="padding:0.45rem 0.65rem; font-family:var(--font-mono); font-size:0.73rem; color:var(--sm-accent);" title="Resident Physical Memory (RSS): ${p.rss} KB">${rssDisplay}</td>`);
            }
            if (visibleCols.pss) {
              cells.push(`<td style="padding:0.45rem 0.65rem; font-family:var(--font-mono); font-size:0.73rem; color:var(--c-violet);" title="Proportional Set Size (PSS): ${p.pss !== null && p.pss !== undefined ? p.pss + ' KB' : 'Unavailable'}">${pssDisplay}</td>`);
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
              <tr data-pid="${p.pid}" style="border-bottom:1px solid rgba(var(--wash),0.04); cursor:context-menu;">
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

        // optional "Universe" view (effects setting)
        const uniBtn = bodyEl.querySelector('#procUniBtn');
        const uniBox = bodyEl.querySelector('#procUni');
        const tableBox = bodyEl.querySelector('.table-responsive');
        const uniOk = () => !!(window.ShellmanFX && window.ShellmanFX.on('universe') && window.ShellmanProcUniverse);
        const showUni = (on) => {
          if (on && uniOk()) {
            tableBox.style.display = 'none'; uniBox.style.display = 'block'; uniBtn.textContent = 'Table';
            if (!uni) { uni = window.ShellmanProcUniverse.mount(uniBox, { onContext: (x, y, p) => showProcContextMenu(x, y, p) }); uni.update(procs); }
          } else {
            if (uni) { uni.destroy(); uni = null; }
            tableBox.style.display = ''; uniBox.style.display = 'none'; uniBtn.textContent = 'Universe';
          }
        };
        const syncUniBtn = () => { uniBtn.style.display = uniOk() ? '' : 'none'; if (!uniOk() && uni) showUni(false); };
        uniBtn.onclick = () => showUni(!uni);
        window.addEventListener('shellman-fx-change', syncUniBtn);
        syncUniBtn();
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
          if (uni) { uni.destroy(); uni = null; }
          window.removeEventListener('shellman-fx-change', syncUniBtn);
          if (unsubProcMetrics) unsubProcMetrics();
          hideCtxMenu();
          document.removeEventListener('pointerdown', onDocPointerDown);
          document.removeEventListener('keydown', onDocKeyDown);
        };
      }
    });
};


DesktopAppsController.prototype.killProcess = async function (serverId, pid, signal, comm) {
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

    const ok = await DesktopModal.confirm({
      title: 'Process Signal',
      message: confirmMsg,
      confirmText: 'Send Signal',
      isDanger: signal === 'SIGKILL'
    });
    if (!ok) return false;
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
        DesktopModal.alert({ title: 'Process Signal', message: res.message, type: res.success ? 'success' : 'danger' });
      }
      return res.success;
    } catch (e) {
      DesktopModal.alert({ title: 'Signal Error', message: 'Error signalling process: ' + e, type: 'danger' });
      return false;
    }
};


DesktopAppsController.prototype.launchServices = function (params = {}) {
    const fetch = RequestScope.next(); // requests of this window are cancelled when it closes
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
};


DesktopAppsController.prototype.svcAction = async function (serverId, name, action) {
    const ok = await DesktopModal.confirm({
      title: 'Service Control',
      message: `Apply ${action.toUpperCase()} to service "${name}"?`,
      confirmText: action.toUpperCase(),
      isDanger: action === 'stop'
    });
    if (!ok) return;
    try {
      const resp = await fetch(`/api/servers/${serverId}/services/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, action })
      });
      const res = await resp.json();
      if (window.showToast) window.showToast(res.message, res.success ? 'success' : 'error');
    } catch (e) {
      DesktopModal.alert({ title: 'Service Error', message: String(e), type: 'danger' });
    }
};


DesktopAppsController.prototype.launchLogs = function (params = {}) {
    const service = params.service || '';
    const logWinId = 'logs_' + Date.now();

    const fetch = RequestScope.next(); // requests of this window are cancelled when it closes
    return WindowManager.createWindow({
      appId: 'logs',
      multiInstance: false,
      title: `System Logs - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
      width: 920,
      height: 560,
      minWidth: 500,
      minHeight: 300,
      contentHtml: `
        <div style="height:100%; display:flex; flex-direction:column; background:var(--sm-inset);">
          <div style="background:var(--bg-system); border-bottom:1px solid var(--sm-line-strong); display:flex; align-items:center; justify-content:space-between; padding:0.4rem 0.75rem; flex-wrap:wrap; gap:0.45rem;">
            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <input type="text" id="logUnitInput_${logWinId}" placeholder="Unit (e.g. nginx, sshd)" class="form-control" style="width:140px; padding:0.25rem 0.5rem; font-size:0.75rem;" value="${service}">
              <select id="logLinesSelect_${logWinId}" class="form-control" style="width:90px; padding:0.25rem 0.4rem; font-size:0.72rem;">
                <option value="100">100 lines</option>
                <option value="250" selected>250 lines</option>
                <option value="500">500 lines</option>
                <option value="1000">1000 lines</option>
              </select>
              <button class="btn btn-primary btn-sm" id="logFetchBtn_${logWinId}">Fetch</button>
              
              <div style="width:1px; height:18px; background:rgba(var(--wash),0.1); margin:0 2px;"></div>

              <input type="text" id="logSearchInput_${logWinId}" placeholder="Filter in logs..." class="form-control" style="width:145px; padding:0.25rem 0.5rem; font-size:0.75rem;">

              <div style="display:flex; align-items:center; gap:3px;">
                <button class="btn btn-secondary btn-xs active log-lvl-btn" data-lvl="all" id="lvlAll_${logWinId}" style="padding:2px 7px; font-size:0.7rem;">All <span id="cntAll_${logWinId}">0</span></button>
                <button class="btn btn-secondary btn-xs log-lvl-btn" data-lvl="error" id="lvlErr_${logWinId}" style="padding:2px 7px; font-size:0.7rem; color:var(--c-bad);">Errors <span id="cntErr_${logWinId}">0</span></button>
                <button class="btn btn-secondary btn-xs log-lvl-btn" data-lvl="warn" id="lvlWarn_${logWinId}" style="padding:2px 7px; font-size:0.7rem; color:var(--c-warn);">Warn <span id="cntWarn_${logWinId}">0</span></button>
                <button class="btn btn-secondary btn-xs log-lvl-btn" data-lvl="info" id="lvlInfo_${logWinId}" style="padding:2px 7px; font-size:0.7rem; color:var(--sm-accent);">Info <span id="cntInfo_${logWinId}">0</span></button>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:0.35rem;">
              <button class="btn btn-secondary btn-xs" id="logLiveBtn_${logWinId}" style="padding:2px 8px; font-size:0.7rem; display:inline-flex; align-items:center; gap:5px;" title="Periodically poll for real-time journal updates">
                <span id="logLiveDot_${logWinId}" style="width:6px; height:6px; border-radius:50%; background:#10b981; display:none; box-shadow:0 0 8px #10b981;"></span>
                <span id="logLiveLabel_${logWinId}">Live View: OFF</span>
              </button>
              <button class="btn btn-secondary btn-xs" id="logAutoScrollBtn_${logWinId}" style="padding:2px 8px; font-size:0.7rem;">Scroll: ON</button>
              <button class="btn btn-ghost btn-xs" id="logCopyBtn_${logWinId}">Copy</button>
              <button class="btn btn-ghost btn-xs" id="logClearBtn_${logWinId}">Clear</button>
            </div>
          </div>

          <div id="logViewerContainer_${logWinId}" style="flex:1; overflow-y:auto; overflow-x:auto; padding:0.35rem 0; font-family:var(--font-mono); background:var(--sm-inset);">
            <div style="text-align:center; padding:2.5rem; color:var(--text-muted); font-size:0.8rem;">Ready to fetch journal logs...</div>
          </div>

          <div style="height:22px; background:var(--bg-system); border-top:1px solid rgba(var(--wash),0.06); display:flex; align-items:center; justify-content:space-between; padding:0 0.75rem; font-size:0.68rem; color:var(--sm-text-4); font-family:var(--font-mono);">
            <span id="logStatusText_${logWinId}">Ready</span>
            <span id="logStatsText_${logWinId}">0 lines</span>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const viewer = bodyEl.querySelector(`#logViewerContainer_${logWinId}`);
        const unitInput = bodyEl.querySelector(`#logUnitInput_${logWinId}`);
        const linesSelect = bodyEl.querySelector(`#logLinesSelect_${logWinId}`);
        const searchInput = bodyEl.querySelector(`#logSearchInput_${logWinId}`);
        const autoScrollBtn = bodyEl.querySelector(`#logAutoScrollBtn_${logWinId}`);
        const liveBtn = bodyEl.querySelector(`#logLiveBtn_${logWinId}`);
        const liveDot = bodyEl.querySelector(`#logLiveDot_${logWinId}`);
        const liveLabel = bodyEl.querySelector(`#logLiveLabel_${logWinId}`);
        const statusText = bodyEl.querySelector(`#logStatusText_${logWinId}`);
        const statsText = bodyEl.querySelector(`#logStatsText_${logWinId}`);
        const cntAll = bodyEl.querySelector(`#cntAll_${logWinId}`);
        const cntErr = bodyEl.querySelector(`#cntErr_${logWinId}`);
        const cntWarn = bodyEl.querySelector(`#cntWarn_${logWinId}`);
        const cntInfo = bodyEl.querySelector(`#cntInfo_${logWinId}`);

        let rawLogLines = [];
        let autoScroll = true;
        let isLive = false;
        let liveTimer = null;
        let activeLevel = 'all';

        const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const highlightLogLine = (line, query) => {
          let escaped = escapeHtml(line);

          // 1. IP Addresses (e.g. 192.168.1.1, 10.0.0.1:8080)
          escaped = escaped.replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::[0-9]{1,5})?\b/g, m => `<span class="log-token-ip">${m}</span>`);

          // 2. HTTP Status Codes
          escaped = escaped.replace(/\b(200|201|204)\b/g, m => `<span class="log-token-http-ok">${m}</span>`);
          escaped = escaped.replace(/\b(301|302|304)\b/g, m => `<span class="log-token-info">${m}</span>`);
          escaped = escaped.replace(/\b(400|401|403|404|405)\b/g, m => `<span class="log-token-http-warn">${m}</span>`);
          escaped = escaped.replace(/\b(500|502|503|504)\b/g, m => `<span class="log-token-http-err">${m}</span>`);

          // 3. Error Tokens
          escaped = escaped.replace(/\b(ERROR|FATAL|CRITICAL|FAIL|FAILED|FAILURE|ERR|EXCEPTION|PANIC)\b/gi, m => `<span class="log-token-error">${m}</span>`);

          // 4. Warning Tokens
          escaped = escaped.replace(/\b(WARN|WARNING)\b/gi, m => `<span class="log-token-warn">${m}</span>`);

          // 5. Info / Notice Tokens
          escaped = escaped.replace(/\b(INFO|NOTICE|SUCCESS)\b/gi, m => `<span class="log-token-info">${m}</span>`);

          // 6. Debug Tokens
          escaped = escaped.replace(/\b(DEBUG|TRACE)\b/gi, m => `<span class="log-token-debug">${m}</span>`);

          // 7. Search filter highlight if query is set
          if (query && query.trim()) {
            const qEsc = escapeHtml(query.trim());
            const regex = new RegExp(`(${qEsc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            escaped = escaped.replace(regex, `<span class="log-highlight-match">$1</span>`);
          }

          return escaped;
        };

        const renderLogs = () => {
          const q = (searchInput.value || '').trim().toLowerCase();

          let errCount = 0;
          let warnCount = 0;
          let infoCount = 0;

          const errRegex = /\b(ERROR|FATAL|CRITICAL|FAIL|FAILED|FAILURE|ERR|EXCEPTION|PANIC|500|502|503|504)\b/i;
          const warnRegex = /\b(WARN|WARNING|400|401|403|404)\b/i;
          const infoRegex = /\b(INFO|NOTICE|SUCCESS)\b/i;

          const filtered = [];

          rawLogLines.forEach((line, idx) => {
            const hasErr = errRegex.test(line);
            const hasWarn = warnRegex.test(line);
            const hasInfo = infoRegex.test(line);

            if (hasErr) errCount++;
            if (hasWarn) warnCount++;
            if (hasInfo) infoCount++;

            // Level filter match
            if (activeLevel === 'error' && !hasErr) return;
            if (activeLevel === 'warn' && !hasWarn) return;
            if (activeLevel === 'info' && !hasInfo) return;

            // Query filter match
            if (q && !line.toLowerCase().includes(q)) return;

            filtered.push({ line, num: idx + 1 });
          });

          cntAll.textContent = rawLogLines.length;
          cntErr.textContent = errCount;
          cntWarn.textContent = warnCount;
          cntInfo.textContent = infoCount;

          if (filtered.length === 0) {
            viewer.innerHTML = `<div style="text-align:center; padding:2.5rem; color:var(--text-muted); font-size:0.8rem;">No matching log entries found</div>`;
            statsText.textContent = `0 of ${rawLogLines.length} lines`;
            return;
          }

          const html = filtered.map(item => `
            <div class="log-line">
              <span class="log-line-num">${item.num}</span>
              <span class="log-line-content">${highlightLogLine(item.line, searchInput.value)}</span>
            </div>
          `).join('');

          viewer.innerHTML = html;
          statsText.textContent = `Showing ${filtered.length} of ${rawLogLines.length} lines`;

          if (autoScroll) {
            viewer.scrollTop = viewer.scrollHeight;
          }
        };

        const fetchLogs = async (silent = false) => {
          if (!silent) {
            statusText.textContent = 'Streaming journal logs...';
            viewer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.8rem;">Fetching journalctl logs...</div>`;
          }
          try {
            const u = unitInput.value.trim();
            const lines = linesSelect.value;
            const resp = await fetch(`/api/servers/${this.serverId}/logs/fetch?service=${encodeURIComponent(u)}&lines=${lines}`);
            const res = await resp.json();
            if (res.success) {
              const text = res.logs || '';
              rawLogLines = text.split('\n').filter(l => l.length > 0);
              statusText.textContent = `${isLive ? 'Live Streaming' : 'Synchronized'} at ${new Date().toLocaleTimeString()}`;
              renderLogs();
            } else if (!silent) {
              viewer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--c-bad); font-size:0.8rem;">Error: ${escapeHtml(res.error)}</div>`;
              statusText.textContent = 'Fetch failed';
            }
          } catch (e) {
            if (!silent) {
              viewer.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--c-bad); font-size:0.8rem;">Network error: ${escapeHtml(e.message)}</div>`;
              statusText.textContent = 'Network error';
            }
          }
        };

        // Level button switching
        bodyEl.querySelectorAll('.log-lvl-btn').forEach(btn => {
          btn.onclick = () => {
            bodyEl.querySelectorAll('.log-lvl-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeLevel = btn.dataset.lvl;
            renderLogs();
          };
        });

        // Search filtering
        searchInput.oninput = () => renderLogs();

        // Live View toggle
        if (liveBtn) {
          liveBtn.onclick = () => {
            isLive = !isLive;
            if (isLive) {
              liveBtn.className = 'btn btn-primary btn-xs';
              liveDot.style.display = 'inline-block';
              liveLabel.textContent = 'Live View: ON';
              fetchLogs(true);
              liveTimer = setInterval(() => { fetchLogs(true); }, 2500);
            } else {
              if (liveTimer) clearInterval(liveTimer);
              liveBtn.className = 'btn btn-secondary btn-xs';
              liveDot.style.display = 'none';
              liveLabel.textContent = 'Live View: OFF';
              statusText.textContent = `Paused at ${new Date().toLocaleTimeString()}`;
            }
          };
        }

        // Auto-scroll toggle
        autoScrollBtn.onclick = () => {
          autoScroll = !autoScroll;
          autoScrollBtn.textContent = `Scroll: ${autoScroll ? 'ON' : 'OFF'}`;
          autoScrollBtn.className = autoScroll ? 'btn btn-secondary btn-xs' : 'btn btn-ghost btn-xs';
          if (autoScroll) viewer.scrollTop = viewer.scrollHeight;
        };

        bodyEl.querySelector(`#logFetchBtn_${logWinId}`).onclick = () => fetchLogs(false);
        bodyEl.querySelector(`#logClearBtn_${logWinId}`).onclick = () => {
          rawLogLines = [];
          renderLogs();
        };
        bodyEl.querySelector(`#logCopyBtn_${logWinId}`).onclick = () => {
          navigator.clipboard.writeText(rawLogLines.join('\n')).then(() => {
            if (window.showToast) window.showToast('Raw logs copied to clipboard', 'success');
          });
        };

        if (winObj) {
          winObj.onClose = () => {
            if (liveTimer) clearInterval(liveTimer);
          };
        }

        fetchLogs(false);
      }
    });
};


DesktopAppsController.prototype.launchHardware = function (params = {}) {
    const fetch = RequestScope.next(); // requests of this window are cancelled when it closes
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
};


DesktopAppsController.prototype.launchNetwork = function (params = {}) {
    const netWinId = 'net_' + Date.now();
    let currentTab = 'connections';
    let cachedData = null;
    let refreshTimer = null;

    const fetch = RequestScope.next(); // requests of this window are cancelled when it closes
    const winObj = WindowManager.createWindow({
      appId: 'network',
      multiInstance: false,
      title: `Network Sockets & DDoS Monitor - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg>',
      width: 880,
      height: 560,
      contentHtml: `
        <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-canvas); overflow:hidden;" id="netRoot_${netWinId}">
          <!-- Top Control Header -->
          <div style="display:flex; align-items:center; justify-content:space-between; padding:0.65rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(var(--wash),0.02); flex-shrink:0; gap:0.5rem; flex-wrap:wrap;">
            <div style="display:flex; gap:0.35rem; align-items:center;">
              <button class="btn btn-secondary btn-xs net-tab-btn active" data-tab="connections" id="tabConn_${netWinId}" style="font-size:0.75rem;">
                Active Connections
                <span class="badge" id="netConnCountBadge_${netWinId}" style="margin-left:4px; background:color-mix(in srgb, var(--sm-accent) 20%, transparent); color:var(--sm-accent);">--</span>
              </button>
              <button class="btn btn-ghost btn-xs net-tab-btn" data-tab="ports" id="tabPorts_${netWinId}" style="font-size:0.75rem;">
                Listening Ports
                <span class="badge" id="netPortsCountBadge_${netWinId}" style="margin-left:4px; background:rgba(var(--wash),0.08); color:var(--text-muted);">--</span>
              </button>
              <button class="btn btn-ghost btn-xs net-tab-btn" data-tab="interfaces" id="tabIfaces_${netWinId}" style="font-size:0.75rem;">
                Interfaces
              </button>
            </div>

            <div style="display:flex; align-items:center; gap:0.45rem;">
              <select id="netAutoRefresh_${netWinId}" class="form-control" style="font-size:0.72rem; padding:0.2rem 0.4rem; height:26px;">
                <option value="0">Auto-refresh: Off</option>
                <option value="3000">Auto: 3s</option>
                <option value="5000" selected>Auto: 5s</option>
                <option value="10000">Auto: 10s</option>
              </select>
              <button class="btn btn-secondary btn-xs" id="netRefreshBtn_${netWinId}" style="font-size:0.72rem; height:26px;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Refresh
              </button>
            </div>
          </div>

          <!-- Active Connections View -->
          <div id="viewConnections_${netWinId}" style="flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;">
            <!-- DDoS & Telemetry Stats Ticker -->
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.65rem; padding:0.75rem 1rem 0.45rem; background:rgba(var(--shade),0.15); flex-shrink:0;">
              <div style="background:rgba(var(--wash),0.03); border:1px solid var(--border-subtle); border-radius:6px; padding:0.45rem 0.65rem;">
                <div style="font-size:0.66rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Total Active Sockets</div>
                <div id="mStatTotal_${netWinId}" style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-top:2px;">--</div>
              </div>
              <div style="background:rgba(var(--wash),0.03); border:1px solid var(--border-subtle); border-radius:6px; padding:0.45rem 0.65rem;">
                <div style="font-size:0.66rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Established</div>
                <div id="mStatEstab_${netWinId}" style="font-size:1.15rem; font-weight:700; color:var(--c-ok); margin-top:2px;">--</div>
              </div>
              <div style="background:rgba(var(--wash),0.03); border:1px solid var(--border-subtle); border-radius:6px; padding:0.45rem 0.65rem;">
                <div style="font-size:0.66rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">SYN_RECV (SYN Flood)</div>
                <div id="mStatSyn_${netWinId}" style="font-size:1.15rem; font-weight:700; color:var(--sm-accent); margin-top:2px;">--</div>
              </div>
              <div style="background:rgba(var(--wash),0.03); border:1px solid var(--border-subtle); border-radius:6px; padding:0.45rem 0.65rem;">
                <div style="font-size:0.66rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Time Wait / Closed</div>
                <div id="mStatWait_${netWinId}" style="font-size:1.15rem; font-weight:700; color:var(--text-muted); margin-top:2px;">--</div>
              </div>
            </div>

            <!-- DDoS Top Connecting Remote IPs Leaderboard -->
            <div style="padding:0.45rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(var(--shade),0.1); flex-shrink:0; display:flex; align-items:center; gap:0.5rem; overflow-x:auto;" id="topIpsBar_${netWinId}">
              <span style="font-size:0.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; white-space:nowrap; letter-spacing:0.04em;">Top Remote IPs:</span>
              <div id="topIpsList_${netWinId}" style="display:flex; gap:0.35rem; align-items:center; flex-wrap:nowrap;">
                <span style="font-size:0.72rem; color:var(--text-muted);">Analyzing active remote IPs...</span>
              </div>
            </div>

            <!-- Search & Filter Bar -->
            <div style="padding:0.45rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:0.5rem; border-bottom:1px solid var(--border-subtle); flex-shrink:0;">
              <input type="text" id="netSearchInp_${netWinId}" placeholder="Search remote IP, port, process name..." class="form-control" style="font-size:0.74rem; padding:0.25rem 0.55rem; width:260px;">
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <select id="netStateFilter_${netWinId}" class="form-control" style="font-size:0.72rem; padding:0.2rem 0.4rem; height:26px;">
                  <option value="ALL">All States</option>
                  <option value="ESTABLISHED">ESTABLISHED</option>
                  <option value="SYN_RECV">SYN_RECV</option>
                  <option value="TIME_WAIT">TIME_WAIT</option>
                  <option value="CLOSE_WAIT">CLOSE_WAIT</option>
                </select>
                <button class="btn btn-ghost btn-xs" id="netClearFilter_${netWinId}" style="font-size:0.7rem;" title="Clear Filters">Reset</button>
              </div>
            </div>

            <!-- Connections Table -->
            <div style="flex:1; overflow-y:auto; min-height:0;">
              <table class="table" style="font-size:0.75rem; margin:0;">
                <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:2;">
                  <tr>
                    <th style="width:55px;">Proto</th>
                    <th style="width:110px;">State</th>
                    <th>Local Socket</th>
                    <th>Foreign Remote IP : Port</th>
                    <th style="width:80px;">Queue (R/S)</th>
                    <th>Service / Process</th>
                  </tr>
                </thead>
                <tbody id="netConnTbody_${netWinId}">
                  <tr><td colspan="6" style="text-align:center; padding:2.5rem; color:var(--text-muted);">Loading active sockets...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Listening Ports View -->
          <div id="viewPorts_${netWinId}" style="flex:1; display:none; flex-direction:column; min-height:0; overflow-y:auto;">
            <table class="table" style="font-size:0.75rem; margin:0;">
              <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:2;">
                <tr>
                  <th style="width:65px;">Proto</th>
                  <th>Local Address / Port</th>
                  <th>Bound Process / Program</th>
                </tr>
              </thead>
              <tbody id="netPortsTbody_${netWinId}">
                <tr><td colspan="3" style="text-align:center; padding:2.5rem; color:var(--text-muted);">Loading listening ports...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Interfaces View -->
          <div id="viewInterfaces_${netWinId}" style="flex:1; display:none; flex-direction:column; min-height:0; padding:1rem; overflow-y:auto;">
            <div style="font-size:0.74rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.4rem; text-transform:uppercase;">Network Interfaces &amp; Link Statistics</div>
            <pre id="netIfacesPre_${netWinId}" style="background:var(--bg-system); border:1px solid var(--border-subtle); border-radius:6px; padding:0.85rem; font-family:monospace; font-size:0.75rem; color:var(--text-muted); white-space:pre-wrap; line-height:1.45; margin:0;">Loading interface stats...</pre>
          </div>
        </div>
      `,
      onInit: async (bodyEl) => {
        const root = bodyEl.querySelector(`#netRoot_${netWinId}`);
        const viewConn = root.querySelector(`#viewConnections_${netWinId}`);
        const viewPorts = root.querySelector(`#viewPorts_${netWinId}`);
        const viewIfaces = root.querySelector(`#viewInterfaces_${netWinId}`);
        const searchInp = root.querySelector(`#netSearchInp_${netWinId}`);
        const stateSel = root.querySelector(`#netStateFilter_${netWinId}`);
        const autoSel = root.querySelector(`#netAutoRefresh_${netWinId}`);
        const refreshBtn = root.querySelector(`#netRefreshBtn_${netWinId}`);
        const clearBtn = root.querySelector(`#netClearFilter_${netWinId}`);

        const tabBtns = root.querySelectorAll('.net-tab-btn');
        tabBtns.forEach(btn => {
          btn.onclick = () => {
            tabBtns.forEach(b => {
              b.classList.remove('active', 'btn-secondary');
              b.classList.add('btn-ghost');
            });
            btn.classList.add('active', 'btn-secondary');
            btn.classList.remove('btn-ghost');
            currentTab = btn.dataset.tab;

            viewConn.style.display = currentTab === 'connections' ? 'flex' : 'none';
            viewPorts.style.display = currentTab === 'ports' ? 'flex' : 'none';
            viewIfaces.style.display = currentTab === 'interfaces' ? 'flex' : 'none';
          };
        });

        const getStateStyle = (st) => {
          if (st === 'ESTABLISHED') return 'background:rgba(16,185,129,0.15); color:var(--c-ok);';
          if (st === 'SYN_RECV') return 'background:rgba(239,68,68,0.25); color:var(--c-bad); font-weight:700;';
          if (st === 'TIME_WAIT') return 'background:rgba(148,163,184,0.15); color:var(--text-muted);';
          if (st === 'CLOSE_WAIT') return 'background:rgba(245,158,11,0.15); color:var(--c-warn);';
          return 'background:rgba(var(--wash),0.06); color:var(--text-secondary);';
        };

        const renderConnectionsList = () => {
          if (!cachedData) return;
          const tbody = root.querySelector(`#netConnTbody_${netWinId}`);
          const q = searchInp.value.toLowerCase().trim();
          const stateVal = stateSel.value;

          const conns = cachedData.connections || [];
          const filtered = conns.filter(c => {
            if (stateVal !== 'ALL' && c.state !== stateVal) return false;
            if (q) {
              const full = `${c.proto} ${c.state} ${c.local_addr} ${c.remote_addr} ${c.remote_ip} ${c.process}`.toLowerCase();
              if (!full.includes(q)) return false;
            }
            return true;
          });

          if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No active connections matching current criteria.</td></tr>`;
            return;
          }

          tbody.innerHTML = filtered.map(c => `
            <tr>
              <td><span class="badge" style="background:rgba(var(--wash),0.05); color:var(--text-muted); font-size:0.68rem;">${c.proto}</span></td>
              <td><span class="badge" style="${getStateStyle(c.state)}; font-size:0.68rem;">${c.state}</span></td>
              <td><code style="font-size:0.75rem;">${c.local_addr}</code></td>
              <td>
                <div style="display:flex; align-items:center; gap:0.35rem;">
                  <code style="font-size:0.75rem; color:var(--sm-accent);">${c.remote_addr}</code>
                  <button type="button" class="btn btn-ghost btn-xs btn-copy-ip" data-ip="${c.remote_ip}" style="padding:0 3px; font-size:0.65rem;" title="Copy IP">&copy;</button>
                  ${c.remote_ip && c.remote_ip !== '0.0.0.0' && c.remote_ip !== '127.0.0.1' && c.remote_ip !== '::1' && c.remote_ip !== '*' ? `
                    <button type="button" class="btn btn-ghost btn-xs btn-ban-ip" data-ip="${c.remote_ip}" style="padding:0 4px; font-size:0.65rem; color:var(--c-bad);" title="Block ${c.remote_ip} in Firewall">Ban</button>
                  ` : ''}
                </div>
              </td>
              <td style="font-size:0.72rem; font-family:monospace; color:var(--text-muted);">${c.recv_q} / ${c.send_q}</td>
              <td><span style="font-size:0.73rem; font-family:monospace; color:var(--text-secondary);">${c.process}</span></td>
            </tr>
          `).join('');

          tbody.querySelectorAll('.btn-copy-ip').forEach(btn => {
            btn.onclick = () => {
              navigator.clipboard.writeText(btn.dataset.ip);
              if (window.showToast) window.showToast(`Copied ${btn.dataset.ip}`, 'info');
            };
          });

          tbody.querySelectorAll('.btn-ban-ip').forEach(btn => {
            btn.onclick = () => {
              DesktopApps.launch('firewall', { ban_ip: btn.dataset.ip });
            };
          });
        };

        const fetchNetworkData = async () => {
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/network/info`);
            const res = await resp.json();
            if (!res.success) return;
            cachedData = res.data;

            // Counters
            const totalEl = root.querySelector(`#mStatTotal_${netWinId}`);
            const estabEl = root.querySelector(`#mStatEstab_${netWinId}`);
            const synEl = root.querySelector(`#mStatSyn_${netWinId}`);
            const waitEl = root.querySelector(`#mStatWait_${netWinId}`);
            const connBadge = root.querySelector(`#netConnCountBadge_${netWinId}`);
            const portBadge = root.querySelector(`#netPortsCountBadge_${netWinId}`);

            const total = cachedData.total_connections || 0;
            const estab = (cachedData.state_counts && cachedData.state_counts['ESTABLISHED']) || 0;
            const syn = (cachedData.state_counts && cachedData.state_counts['SYN_RECV']) || 0;
            const wait = (cachedData.state_counts && cachedData.state_counts['TIME_WAIT']) || 0;

            if (totalEl) totalEl.textContent = total;
            if (estabEl) estabEl.textContent = estab;
            if (synEl) {
              synEl.textContent = syn;
              synEl.style.color = syn > 10 ? 'var(--c-bad)' : 'var(--c-teal)';
            }
            if (waitEl) waitEl.textContent = wait;
            if (connBadge) connBadge.textContent = total;
            if (portBadge) portBadge.textContent = (cachedData.ports || []).length;

            // Render Top Remote IPs Leaderboard
            const topList = root.querySelector(`#topIpsList_${netWinId}`);
            if (topList) {
              const topIps = cachedData.top_remote_ips || [];
              if (topIps.length === 0) {
                topList.innerHTML = `<span style="font-size:0.72rem; color:var(--text-muted);">No external client connections</span>`;
              } else {
                topList.innerHTML = topIps.map(item => `
                  <div style="display:inline-flex; align-items:center; background:rgba(var(--wash),0.04); border:1px solid var(--border-subtle); border-radius:4px; padding:1px 3px;">
                    <button type="button" class="btn btn-ghost btn-xs btn-chip-ip" data-ip="${item.ip}" style="display:flex; align-items:center; gap:0.3rem; padding:0.12rem 0.35rem; font-size:0.7rem; white-space:nowrap; border:none;">
                      <span style="font-family:monospace; color:var(--text-primary);">${item.ip}</span>
                      <span class="badge" style="background:${item.count > 10 ? 'var(--c-bad)' : 'rgba(56,189,248,0.2)'}; color:${item.count > 10 ? '#fff' : 'var(--c-teal)'}; font-weight:700;">${item.count}</span>
                    </button>
                    <button type="button" class="btn btn-ghost btn-xs btn-ban-chip" data-ip="${item.ip}" title="Block ${item.ip} in Firewall" style="padding:0.1rem 0.3rem; font-size:0.65rem; color:var(--c-bad); border:none;">Ban</button>
                  </div>
                `).join('');

                topList.querySelectorAll('.btn-chip-ip').forEach(chip => {
                  chip.onclick = () => {
                    searchInp.value = chip.dataset.ip;
                    renderConnectionsList();
                  };
                });
                topList.querySelectorAll('.btn-ban-chip').forEach(btn => {
                  btn.onclick = () => {
                    DesktopApps.launch('firewall', { ban_ip: btn.dataset.ip });
                  };
                });
              }
            }

            renderConnectionsList();

            // Render Listening Ports
            const portsTbody = root.querySelector(`#netPortsTbody_${netWinId}`);
            if (portsTbody) {
              const ports = cachedData.ports || [];
              if (ports.length === 0) {
                portsTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No open listening sockets detected</td></tr>`;
              } else {
                portsTbody.innerHTML = ports.map(p => `
                  <tr>
                    <td><span class="badge" style="background:rgba(var(--wash),0.06); font-size:0.68rem;">${p.proto.toUpperCase()}</span></td>
                    <td><code style="font-size:0.75rem;">${p.local_addr}</code></td>
                    <td><span style="font-size:0.74rem; font-family:monospace;">${p.process}</span></td>
                  </tr>
                `).join('');
              }
            }

            // Render Interfaces
            const ifacesPre = root.querySelector(`#netIfacesPre_${netWinId}`);
            if (ifacesPre && cachedData.raw_interfaces) {
              ifacesPre.textContent = cachedData.raw_interfaces;
            }
          } catch (_) {}
        };

        searchInp.oninput = renderConnectionsList;
        stateSel.onchange = renderConnectionsList;
        clearBtn.onclick = () => {
          searchInp.value = '';
          stateSel.value = 'ALL';
          renderConnectionsList();
        };

        refreshBtn.onclick = fetchNetworkData;

        const setupTimer = () => {
          if (refreshTimer) clearInterval(refreshTimer);
          const ms = parseInt(autoSel.value, 10);
          if (ms > 0) {
            refreshTimer = setInterval(fetchNetworkData, ms);
          }
        };
        autoSel.onchange = setupTimer;

        // Initial fetch
        await fetchNetworkData();
        setupTimer();

        // Cleanup interval on window close
        winObj.onClose = () => {
          if (refreshTimer) clearInterval(refreshTimer);
        };
      }
    });

    return winObj;
};