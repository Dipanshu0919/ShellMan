/**
 * ShellMan OS: Desktop Main Orchestrator (main.js)
 */

window.applyAccentColor = function(accentKey) {
  const acc = accentKey || 'cyan';
  localStorage.setItem('shellman_accent', acc);
  document.documentElement.setAttribute('data-accent', acc);
  const accents = {
    cyan: { primary: '#38bdf8', soft: 'rgba(56,189,248,0.15)', line: 'rgba(56,189,248,0.38)', ink: '#03131d' },
    violet: { primary: '#a78bfa', soft: 'rgba(167,139,250,0.16)', line: 'rgba(167,139,250,0.4)', ink: '#140d27' },
    emerald: { primary: '#34d399', soft: 'rgba(52,211,153,0.16)', line: 'rgba(52,211,153,0.4)', ink: '#021a11' },
    rose: { primary: '#fb7185', soft: 'rgba(251,113,133,0.16)', line: 'rgba(251,113,133,0.4)', ink: '#20040a' },
    amber: { primary: '#fbbf24', soft: 'rgba(251,191,36,0.16)', line: 'rgba(251,191,36,0.4)', ink: '#1f1402' }
  };
  const theme = accents[acc] || accents.cyan;
  const root = document.documentElement;
  root.style.setProperty('--accent-primary', theme.primary);
  root.style.setProperty('--accent-cyan', theme.primary);
  root.style.setProperty('--sm-accent', theme.primary);
  root.style.setProperty('--sm-accent-soft', theme.soft);
  root.style.setProperty('--sm-accent-line', theme.line);
  root.style.setProperty('--sm-accent-ink', theme.ink);
};

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved accent theme
  window.applyAccentColor(localStorage.getItem('shellman_accent') || 'cyan');

  // 1. Initialize Window Manager
  WindowManager.init(
    document.getElementById('windowsContainer'),
    document.getElementById('desktopTaskbar')
  );

  // 2. Initialize Dock & Menus
  DesktopDock.init(document.getElementById('desktopDock'));
  DesktopMenusInstance.init();

  // 3. Initialize Desktop Apps with Active Server
  const serverId = window.DesktopConfig ? window.DesktopConfig.serverId : null;
  const serverName = window.DesktopConfig ? window.DesktopConfig.serverName : '';
  DesktopApps.init(serverId, serverName);

  // Restore IP reveal preference
  if (localStorage.getItem('shellman_ip_revealed') === 'true') {
    updateIpMaskUI(true);
  }

  // Restore font size preference
  const savedFontSize = localStorage.getItem('shellman_font_size');
  if (savedFontSize) {
    const s = parseInt(savedFontSize, 10);
    if (!isNaN(s) && s >= 10 && s <= 32) {
      document.documentElement.style.fontSize = `${s}px`;
      document.documentElement.style.setProperty('--app-font-size', `${s}px`);
      document.documentElement.style.setProperty('--app-font-scale', (s / 16).toString());
    }
  }

  // 4. Live Clock in System Bar & Desktop Widgets (Synchronized to Remote SSH Host)
  const clockEl = document.getElementById('desktopClock');
  const wgtTime = document.getElementById('wgtTime');
  const wgtSec = document.getElementById('wgtSec');
  const wgtDate = document.getElementById('wgtDate');
  const wgtTz = document.getElementById('wgtTz');

  // Server time tracking variables
  let serverTimeOffsetMs = null;
  let serverTzName = '';
  let serverTzOffsetMinutes = 0;

  // Load custom wallpaper if saved in localStorage
  const savedWallpaper = localStorage.getItem('shellman_wallpaper');
  const desktopEnv = document.getElementById('desktop');
  const ws = document.getElementById('desktopWorkspace');
  if (savedWallpaper) {
    if (desktopEnv) {
      desktopEnv.style.backgroundImage = `linear-gradient(180deg, rgba(8, 12, 20, 0.42) 0%, rgba(6, 9, 15, 0.65) 100%), url("${savedWallpaper}")`;
      desktopEnv.style.backgroundSize = 'cover';
      desktopEnv.style.backgroundPosition = 'center center';
      desktopEnv.style.backgroundRepeat = 'no-repeat';
      desktopEnv.style.backgroundAttachment = 'fixed';
    }
    if (ws) {
      ws.style.background = 'transparent';
      ws.style.backgroundImage = 'none';
    }
  }

  const updateClock = () => {
    if (serverTimeOffsetMs !== null) {
      // Synchronized to remote SSH server time
      const currentServerUtcMs = Date.now() + serverTimeOffsetMs;
      const serverLocalMs = currentServerUtcMs + (serverTzOffsetMinutes * 60000);
      const d = new Date(serverLocalMs);

      const hours = String(d.getUTCHours()).padStart(2, '0');
      const mins = String(d.getUTCMinutes()).padStart(2, '0');
      const secs = String(d.getUTCSeconds()).padStart(2, '0');

      if (clockEl) clockEl.textContent = `${hours}:${mins}:${secs}`;
      if (wgtTime) wgtTime.textContent = `${hours}:${mins}`;
      if (wgtSec) wgtSec.textContent = secs;

      if (wgtDate) {
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        wgtDate.textContent = `${weekdays[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      }

      if (wgtTz) {
        wgtTz.textContent = serverTzName || 'HOST';
        wgtTz.style.display = 'inline-block';
        wgtTz.title = `Synchronized to Remote Host Time (${serverTzName || 'SSH Server'})`;
      }
    } else {
      // Fallback to local device time when no server telemetry is available yet
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (clockEl) clockEl.textContent = timeStr;

      if (wgtTime) {
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        wgtTime.textContent = `${hours}:${mins}`;
        if (wgtSec) wgtSec.textContent = secs;
      }
      if (wgtDate) {
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        wgtDate.textContent = now.toLocaleDateString(undefined, options);
      }
      if (wgtTz) wgtTz.style.display = 'none';
    }
  };
  updateClock();
  setInterval(updateClock, 1000);

  // 5. Desktop Canvas Icons setup
  renderDesktopIcons();

  // 6. Central Telemetry & Desktop Widgets
  DesktopTelemetry.subscribe(updateDesktopWidgets);
  if (serverId) {
    DesktopTelemetry.start(serverId);
  }

  // 7. Check if initial app requested explicitly via query parameter (e.g. ?app=files)
  const urlParams = new URLSearchParams(window.location.search);
  const initialApp = urlParams.get('app') || (window.DesktopConfig?.initialApp ? window.DesktopConfig.initialApp : null);
  if (initialApp && initialApp !== 'none' && initialApp !== '') {
    const initialPath = urlParams.get('path') || '';
    setTimeout(() => {
      DesktopApps.launch(initialApp, { path: initialPath });
      // Clean up URL so page reloads don't repeatedly force open this app
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname + (serverId ? `?server_id=${serverId}` : '');
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }, 200);
  }
});

let isLaunchingDesktopIcon = false;

function renderDesktopIcons() {
  const container = document.getElementById('desktopIcons');
  if (!container) return;

  const shortcuts = window.DesktopCustomizer 
    ? window.DesktopCustomizer.getDesktopApps() 
    : (window.SHELLMAN_APPS || []);

  const size = window.DesktopCustomizer 
    ? window.DesktopCustomizer.getDesktopIconSize() 
    : 'normal';

  container.className = `desktop-icons-container size-${size}`;

  container.innerHTML = shortcuts.map(sc => `
    <div class="desktop-icon" data-app="${sc.id}" onclick="handleDesktopIconClick(this, '${sc.id}')" oncontextmenu="handleDesktopIconContextMenu(event, '${sc.id}')">
      <div class="desktop-icon-tile" style="background: ${sc.gradient};">
        ${sc.icon}
      </div>
      <span class="desktop-icon-label">${sc.title}</span>
    </div>
  `).join('');
}

function handleDesktopIconContextMenu(e, appId) {
  e.preventDefault();
  e.stopPropagation();
  const app = window.DesktopCustomizer ? window.DesktopCustomizer.getApp(appId) : null;
  if (!app) return;
  const isPinned = window.DesktopCustomizer ? window.DesktopCustomizer.isAppInDock(appId) : true;
  const items = [
    {
      label: `Open ${app.shortTitle || app.title}`,
      icon: app.icon,
      action: () => DesktopApps.launch(appId)
    },
    'separator',
    {
      label: isPinned ? 'Unpin from Dock' : 'Pin to Dock',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="16" width="18" height="4" rx="1"></rect><circle cx="12" cy="10" r="4"></circle></svg>',
      action: () => {
        if (window.DesktopCustomizer) window.DesktopCustomizer.toggleDockApp(appId, !isPinned);
      }
    },
    {
      label: 'Remove from Desktop',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      action: () => {
        if (window.DesktopCustomizer) window.DesktopCustomizer.toggleDesktopApp(appId, false);
      }
    },
    'separator',
    {
      label: 'Customize Desktop & Dock...',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
      action: () => {
        if (window.DesktopCustomizer) window.DesktopCustomizer.openCustomizerModal();
      }
    }
  ];
  if (window.DesktopMenus && typeof window.DesktopMenus.showCustomMenu === 'function') {
    window.DesktopMenus.showCustomMenu(e, items);
  }
}

function handleDesktopIconClick(el, appId) {
  document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
  el.classList.add('selected');

  // Debounced single-click launch: opens or brings window to focus without duplicates
  if (isLaunchingDesktopIcon) return;
  isLaunchingDesktopIcon = true;
  setTimeout(() => { isLaunchingDesktopIcon = false; }, 300);

  DesktopApps.launch(appId);
}

// Centralized Telemetry Bus for Synchronized System Metrics
const ServerHealthAlerts = {
  states: {},
  getOrCreateState(serverId) {
    if (!this.states[serverId]) {
      this.states[serverId] = {
        failedConsecutivePolls: 0,
        highCpuStartTime: null,
        offlineAlertSent: false,
        lastCpuAlertSentAt: 0,
        highRamStartTime: null,
        lastRamAlertSentAt: 0
      };
    }
    return this.states[serverId];
  },
  triggerAlert(title, message, severity = 'warning') {
    // 1. In-App Desktop Toast
    const toastAllowed = localStorage.getItem('shellman_toast_alerts') !== 'false';
    if (toastAllowed && typeof window.showToast === 'function') {
      window.showToast(`${title}: ${message}`, severity);
    }

    // 2. OS / Browser Push Notification
    const pushAllowed = localStorage.getItem('shellman_push_alerts') !== 'false';
    if (pushAllowed && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`ShellMan: ${title}`, {
          body: message,
          icon: '/static/icons/icon-192.png'
        });
      } catch (e) {
        console.warn('Browser notification error:', e);
      }
    }
  },
  evaluate(serverId, serverName, isOnline, metrics) {
    if (!serverId) return;
    const state = this.getOrCreateState(serverId);

    if (!isOnline) {
      state.failedConsecutivePolls++;
      if (state.failedConsecutivePolls >= 3 && !state.offlineAlertSent) {
        state.offlineAlertSent = true;
        this.triggerAlert('Server Offline', `Host "${serverName}" is unreachable or offline!`, 'danger');
      }
    } else {
      if (state.offlineAlertSent) {
        this.triggerAlert('Server Restored', `Host "${serverName}" is back online and responding.`, 'success');
        state.offlineAlertSent = false;
      }
      state.failedConsecutivePolls = 0;

      // Configurable user thresholds
      const cpuThreshold = parseInt(localStorage.getItem('shellman_alert_cpu_threshold') || '90', 10);
      const ramThreshold = parseInt(localStorage.getItem('shellman_alert_ram_threshold') || '90', 10);
      const durationMins = parseInt(localStorage.getItem('shellman_alert_duration_mins') || '5', 10);
      const durationMs = Math.max(1, durationMins) * 60 * 1000;

      // 1. CPU Threshold Check
      const cpu = metrics && typeof metrics.cpu === 'number' ? metrics.cpu : 0;
      if (cpu >= cpuThreshold) {
        const now = Date.now();
        if (!state.highCpuStartTime) {
          state.highCpuStartTime = now;
        } else if (now - state.highCpuStartTime >= durationMs) {
          if (now - state.lastCpuAlertSentAt >= durationMs) {
            this.triggerAlert('High CPU Utilization', `Host "${serverName}" CPU has exceeded ${cpuThreshold}% for >${durationMins}m (${cpu}%).`, 'danger');
            state.lastCpuAlertSentAt = now;
          }
        }
      } else {
        state.highCpuStartTime = null;
      }

      // 2. RAM / Memory Threshold Check
      const ram = (metrics && metrics.memory && typeof metrics.memory.percent === 'number') ? metrics.memory.percent : 0;
      if (ram >= ramThreshold) {
        const now = Date.now();
        if (!state.highRamStartTime) {
          state.highRamStartTime = now;
        } else if (now - state.highRamStartTime >= durationMs) {
          if (now - state.lastRamAlertSentAt >= durationMs) {
            this.triggerAlert('High RAM Utilization', `Host "${serverName}" RAM usage has exceeded ${ramThreshold}% for >${durationMins}m (${ram}%).`, 'danger');
            state.lastRamAlertSentAt = now;
          }
        }
      } else {
        state.highRamStartTime = null;
      }
    }
  }
};
window.ServerHealthAlerts = ServerHealthAlerts;

const DesktopTelemetry = {
  serverId: null,
  subscribers: new Set(),
  lastMetrics: null,
  isPolling: false,
  _timer: null,

  subscribe(cb) {
    this.subscribers.add(cb);
    if (this.lastMetrics) {
      try { cb(this.lastMetrics); } catch (e) { console.error('DesktopTelemetry subscriber error:', e); }
    }
    return () => this.subscribers.delete(cb);
  },

  broadcast(metrics) {
    this.lastMetrics = metrics;
    this.subscribers.forEach(cb => {
      try { cb(metrics); } catch (e) { console.error('DesktopTelemetry subscriber error:', e); }
    });
  },

  async poll(force = false) {
    if (!this.serverId || (this.isPolling && !force)) return;
    this.isPolling = true;
    const srv = (window.DesktopServersList || []).find(s => s.id === this.serverId);
    const serverName = srv ? srv.name : `Server #${this.serverId}`;

    try {
      const url = `/api/servers/${this.serverId}/metrics` + (force ? '?force=1' : '');
      const resp = await fetch(url);
      const res = await resp.json();
      if (res.online && res.metrics) {
        this.broadcast(res.metrics);
        const topDot = document.getElementById('topServerDot');
        if (topDot) topDot.className = 'status-dot connected';
        ServerHealthAlerts.evaluate(this.serverId, serverName, true, res.metrics);
      } else {
        const topDot = document.getElementById('topServerDot');
        if (topDot) topDot.className = 'status-dot disconnected';
        ServerHealthAlerts.evaluate(this.serverId, serverName, false, null);
      }
    } catch (_) {
      ServerHealthAlerts.evaluate(this.serverId, serverName, false, null);
    }
    finally {
      this.isPolling = false;
    }
  },

  start(serverId) {
    this.serverId = serverId;
    if (!serverId) return;
    this.poll();
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.poll(), 2000);
  }
};
window.DesktopTelemetry = DesktopTelemetry;

// --- Desktop Sparklines & Ring Gauges System ---
window.DesktopSparklines = {
  cpu: [],
  mem: [],
  net: [],

  updateSparkline(svgId, val, maxVal = 100) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const key = svgId.replace('wgt', '').replace('Sparkline', '').toLowerCase();
    const history = this[key] || [];
    history.push(Math.min(maxVal, Math.max(0, Number(val) || 0)));
    if (history.length > 16) history.shift();
    this[key] = history;

    const width = 100;
    const height = 24;
    const totalPoints = 16;
    const step = width / (totalPoints - 1);
    const startIdx = totalPoints - history.length;

    const points = history.map((v, i) => {
      const x = ((startIdx + i) * step).toFixed(1);
      const y = (height - (v / maxVal) * (height - 4) - 2).toFixed(1);
      return { x, y };
    });

    if (points.length < 2) return;

    const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    const lineEl = svg.querySelector('.sparkline-line');
    const areaEl = svg.querySelector('.sparkline-area');
    if (lineEl) lineEl.setAttribute('d', pathD);
    if (areaEl) areaEl.setAttribute('d', areaD);
  },

  updateRing(ringId, val) {
    const ring = document.getElementById(ringId);
    if (!ring) return;
    const radius = 14;
    const circ = 2 * Math.PI * radius; // ~87.96
    const pct = Math.min(100, Math.max(0, Number(val) || 0));
    const offset = circ - (pct / 100) * circ;
    ring.style.strokeDashoffset = offset.toFixed(2);
  },

  getLoadClass(val) {
    if (val >= 85) return 'load-crit';
    if (val >= 70) return 'load-warn';
    return 'load-normal';
  }
};

function updateDesktopWidgets(metrics) {
  // Sync remote SSH server time
  if (metrics.server_time && metrics.server_time.epoch) {
    const serverEpochMs = metrics.server_time.epoch * 1000;
    serverTimeOffsetMs = serverEpochMs - Date.now();
    serverTzName = metrics.server_time.timezone || '';

    const offsetStr = metrics.server_time.offset || '';
    const sign = offsetStr.startsWith('-') ? -1 : 1;
    const cleanDigits = offsetStr.replace(/[^0-9]/g, '');
    if (cleanDigits.length >= 4) {
      const h = parseInt(cleanDigits.substring(0, 2), 10);
      const m = parseInt(cleanDigits.substring(2, 4), 10);
      serverTzOffsetMinutes = sign * (h * 60 + m);
    } else if (cleanDigits.length >= 2) {
      serverTzOffsetMinutes = sign * (parseInt(cleanDigits, 10) * 60);
    } else {
      serverTzOffsetMinutes = 0;
    }
  }

  const cpu = metrics.cpu !== undefined ? metrics.cpu : 0;
  const mem = metrics.memory ? metrics.memory.percent : 0;
  const disk = metrics.disk ? metrics.disk.percent : 0;

  // 1. Top bar micro telemetry
  const cpuBar = document.getElementById('microCpuBar');
  const cpuVal = document.getElementById('microCpuVal');
  const memBar = document.getElementById('microMemBar');
  const memVal = document.getElementById('microMemVal');

  if (cpuBar) cpuBar.style.width = `${cpu}%`;
  if (cpuVal) cpuVal.textContent = `${cpu}%`;
  if (memBar) memBar.style.width = `${mem}%`;
  if (memVal) memVal.textContent = `${mem}%`;

  // 2. Right-side Desktop System Widgets
  const wgtCpuVal = document.getElementById('wgtCpuVal');
  const wgtCpuBar = document.getElementById('wgtCpuBar');
  const wgtCpuLoad = document.getElementById('wgtCpuLoad');
  if (wgtCpuVal) wgtCpuVal.textContent = `${cpu}%`;
  if (wgtCpuBar) wgtCpuBar.style.width = `${cpu}%`;
  if (wgtCpuLoad && metrics.load) {
    wgtCpuLoad.textContent = `Load: ${metrics.load.join(', ')}`;
  }

  // Update CPU Ring & Sparkline + High-Load Status Color
  if (window.DesktopSparklines) {
    window.DesktopSparklines.updateRing('wgtCpuRing', cpu);
    window.DesktopSparklines.updateSparkline('wgtCpuSparkline', cpu, 100);
    const cpuClass = window.DesktopSparklines.getLoadClass(cpu);
    ['wgtCpuVal', 'wgtCpuRing', 'wgtCpuSparkline', 'wgtCpuBar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('load-normal', 'load-warn', 'load-crit');
        el.classList.add(cpuClass);
      }
    });
  }

  const wgtMemVal = document.getElementById('wgtMemVal');
  const wgtMemBar = document.getElementById('wgtMemBar');
  const wgtMemDetail = document.getElementById('wgtMemDetail');
  if (wgtMemVal) wgtMemVal.textContent = `${mem}%`;
  if (wgtMemBar) wgtMemBar.style.width = `${mem}%`;
  if (wgtMemDetail && metrics.memory) {
    if (metrics.memory.used_formatted && metrics.memory.total_formatted) {
      wgtMemDetail.textContent = `${metrics.memory.used_formatted} / ${metrics.memory.total_formatted}`;
    } else {
      const usedGb = (metrics.memory.used / (1024 ** 3)).toFixed(1);
      const totalGb = (metrics.memory.total / (1024 ** 3)).toFixed(1);
      wgtMemDetail.textContent = `${usedGb} / ${totalGb} GB`;
    }
  }

  // Update RAM Ring & Sparkline + High-Load Status Color
  if (window.DesktopSparklines) {
    window.DesktopSparklines.updateRing('wgtMemRing', mem);
    window.DesktopSparklines.updateSparkline('wgtMemSparkline', mem, 100);
    const memClass = window.DesktopSparklines.getLoadClass(mem);
    ['wgtMemVal', 'wgtMemRing', 'wgtMemSparkline', 'wgtMemBar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('load-normal', 'load-warn', 'load-crit');
        el.classList.add(memClass);
      }
    });
  }

  const wgtDiskVal = document.getElementById('wgtDiskVal');
  const wgtDiskBar = document.getElementById('wgtDiskBar');
  const wgtDiskDetail = document.getElementById('wgtDiskDetail');
  if (wgtDiskVal) wgtDiskVal.textContent = `${disk}%`;
  if (wgtDiskBar) wgtDiskBar.style.width = `${disk}%`;
  if (wgtDiskDetail && metrics.disk) {
    if (metrics.disk.used_formatted && metrics.disk.total_formatted) {
      wgtDiskDetail.textContent = `${metrics.disk.used_formatted} / ${metrics.disk.total_formatted} (/)`;
    } else {
      const usedGb = (metrics.disk.used / (1024 ** 3)).toFixed(1);
      const totalGb = (metrics.disk.total / (1024 ** 3)).toFixed(1);
      wgtDiskDetail.textContent = `${usedGb} / ${totalGb} GB (/)`;
    }
  }

  // Update Disk Ring
  if (window.DesktopSparklines) {
    window.DesktopSparklines.updateRing('wgtDiskRing', disk);
    const diskClass = window.DesktopSparklines.getLoadClass(disk);
    const dVal = document.getElementById('wgtDiskVal');
    const dRing = document.getElementById('wgtDiskRing');
    const dBar = document.getElementById('wgtDiskBar');
    [dVal, dRing, dBar].forEach(el => {
      if (el) {
        el.classList.remove('load-normal', 'load-warn', 'load-crit');
        el.classList.add(diskClass);
      }
    });
  }

  const wgtUptime = document.getElementById('wgtUptime');
  if (wgtUptime && metrics.uptime !== undefined) {
    const u = metrics.uptime;
    const days = Math.floor(u / 86400);
    const hours = Math.floor((u % 86400) / 3600);
    const mins = Math.floor((u % 3600) / 60);
    wgtUptime.textContent = days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`;
  }

  const wgtOs = document.getElementById('wgtOs');
  if (wgtOs && metrics.os) {
    wgtOs.textContent = metrics.os.length > 20 ? metrics.os.substring(0, 18) + '..' : metrics.os;
  }

  // Network Throughput (Upload & Download Speed + Sparkline)
  if (metrics.network) {
    const wgtNetRx = document.getElementById('wgtNetRx');
    const wgtNetTx = document.getElementById('wgtNetTx');
    const wgtNetIface = document.getElementById('wgtNetIface');
    if (wgtNetRx) wgtNetRx.textContent = metrics.network.rx_rate_human || '0 KB/s';
    if (wgtNetTx) wgtNetTx.textContent = metrics.network.tx_rate_human || '0 KB/s';
    if (wgtNetIface) wgtNetIface.textContent = metrics.network.interface || 'eth0';

    if (window.DesktopSparklines) {
      const rxRate = metrics.network.rx_rate || 0;
      const txRate = metrics.network.tx_rate || 0;
      const totalKb = (rxRate + txRate) / 1024;
      window.DesktopSparklines.updateSparkline('wgtNetSparkline', totalKb, 1024);
    }
  }
}

async function pollMicroTelemetry(serverId) {
  if (DesktopTelemetry.serverId !== serverId) {
    DesktopTelemetry.start(serverId);
  } else {
    DesktopTelemetry.poll(true);
  }
}

function handleDesktopContextMenu(e) {
  if (e.target.closest('.desktop-window') || e.target.closest('.desktop-dock') || e.target.closest('.desktop-top-bar')) {
    return;
  }
  const icon = e.target.closest('.desktop-icon');
  if (icon && icon.dataset.app) {
    handleDesktopIconContextMenu(e, icon.dataset.app);
    return;
  }
  DesktopMenusInstance.showContextMenu(e);
}

function toggleStartMenu(e) {
  DesktopMenusInstance.toggleStartMenu(e);
}

function toggleServerMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('serverSelectorMenu');
  if (menu) {
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
  }
}

function openCommandPalette() {
  DesktopMenusInstance.openCommandPalette();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}
window.toggleFullscreen = toggleFullscreen;

/**
 * IP Masking Toggle for Connected Node
 */
function updateIpMaskUI(isRevealed) {
  // Update desktop switcher host
  const topHost = document.getElementById('topServerHost');
  if (topHost) {
    const targetText = isRevealed ? topHost.getAttribute('data-unmasked') : topHost.getAttribute('data-masked');
    if (targetText) topHost.textContent = targetText;
  }

  // Update base topbar host if present
  const sysHost = document.getElementById('sysServerHost');
  if (sysHost) {
    const targetText = isRevealed ? sysHost.getAttribute('data-unmasked') : sysHost.getAttribute('data-masked');
    if (targetText) sysHost.textContent = targetText;
  }

  // Update all toggle buttons
  document.querySelectorAll('.ip-mask-toggle').forEach(btn => {
    btn.classList.toggle('active', isRevealed);
    btn.setAttribute('title', isRevealed ? 'Mask IP address' : 'Show full IP address');
    const openEye = btn.querySelector('.ip-eye-open');
    const closedEye = btn.querySelector('.ip-eye-closed');
    if (openEye) openEye.style.display = isRevealed ? 'none' : 'inline-block';
    if (closedEye) closedEye.style.display = isRevealed ? 'inline-block' : 'none';
  });

  // Update dropdown items
  document.querySelectorAll('.server-dropdown-host').forEach(el => {
    if (el.hasAttribute('data-unmasked') && el.hasAttribute('data-masked')) {
      el.textContent = isRevealed ? el.getAttribute('data-unmasked') : el.getAttribute('data-masked');
    }
  });

  // Update server modal items if present
  document.querySelectorAll('.server-modal-item-host').forEach(el => {
    if (el.hasAttribute('data-unmasked') && el.hasAttribute('data-masked')) {
      el.textContent = isRevealed ? el.getAttribute('data-unmasked') : el.getAttribute('data-masked');
    }
  });
}

function toggleDesktopIpMask(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const current = localStorage.getItem('shellman_ip_revealed') === 'true';
  const next = !current;
  localStorage.setItem('shellman_ip_revealed', next ? 'true' : 'false');
  updateIpMaskUI(next);
  if (typeof showToast === 'function') {
    showToast(next ? 'Full IP address revealed' : 'IP address masked', 'info');
  }
}
window.toggleDesktopIpMask = toggleDesktopIpMask;
window.updateIpMaskUI = updateIpMaskUI;


