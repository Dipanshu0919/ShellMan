/**
 * ShellMan OS: Desktop Main Orchestrator (main.js)
 */

document.addEventListener('DOMContentLoaded', () => {
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

  // 4. Live Clock in System Bar & Desktop Widgets
  const clockEl = document.getElementById('desktopClock');
  const wgtTime = document.getElementById('wgtTime');
  const wgtSec = document.getElementById('wgtSec');
  const wgtDate = document.getElementById('wgtDate');

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
  };
  updateClock();
  setInterval(updateClock, 1000);

  // 5. Desktop Canvas Icons setup
  renderDesktopIcons();

  // 6. Micro-telemetry Polling
  if (serverId) {
    pollMicroTelemetry(serverId);
    setInterval(() => pollMicroTelemetry(serverId), 3000);
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

  const desktopShortcuts = [
    {
      id: 'terminal',
      title: 'SSH Terminal',
      gradient: 'linear-gradient(135deg, #090d16, #1e293b)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="3" fill="#090d16" stroke="#38bdf8" stroke-width="1.5"/><path d="M6.5 9l3.5 3-3.5 3" stroke="#22d3ee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="15" x2="16.5" y2="15" stroke="#34d399" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'files',
      title: 'Files (SFTP)',
      gradient: 'linear-gradient(135deg, #2563eb, #0284c7)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6a2 2 0 0 1 2-2h4.5l2 2H19a2 2 0 0 1 2 2v2H3V6z" fill="rgba(255,255,255,0.35)"/><path d="M2.5 10h19l-1.5 9a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2l-1.5-9z" fill="#ffffff" fill-opacity="0.95"/><path d="M8 14h8M8 17h5" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round"/></svg>'
    },
    {
      id: 'code',
      title: 'Code Workspace',
      gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><path d="M8.5 9.5L5.5 12l3 2.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 9.5l3 2.5-3 2.5" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="13" y1="8" x2="11" y2="16" stroke="#c084fc" stroke-width="1.8" stroke-linecap="round"/></svg>'
    },
    {
      id: 'overview',
      title: 'Overview',
      gradient: 'linear-gradient(135deg, #0284c7, #0d9488)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="7" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><rect x="3" y="14" width="18" height="7" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><circle cx="6.5" cy="6.5" r="1.2" fill="#38bdf8"/><circle cx="9.5" cy="6.5" r="1.2" fill="#34d399"/><circle cx="6.5" cy="17.5" r="1.2" fill="#38bdf8"/><circle cx="9.5" cy="17.5" r="1.2" fill="#34d399"/><path d="M15 6.5h3M15 17.5h3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>'
    },
    {
      id: 'processes',
      title: 'Processes',
      gradient: 'linear-gradient(135deg, #059669, #10b981)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><path d="M6 12h3l2-4 3 8 2-4h2" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    },
    {
      id: 'services',
      title: 'Services',
      gradient: 'linear-gradient(135deg, #ea580c, #f97316)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.5" fill="rgba(255,255,255,0.25)" stroke="#ffffff" stroke-width="1.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      id: 'logs',
      title: 'Logs',
      gradient: 'linear-gradient(135deg, #e11d48, #c026d3)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><line x1="7.5" y1="7.5" x2="16.5" y2="7.5" stroke="#fcd34d" stroke-width="1.7" stroke-linecap="round"/><line x1="7.5" y1="12" x2="14.5" y2="12" stroke="#38bdf8" stroke-width="1.7" stroke-linecap="round"/><line x1="7.5" y1="16.5" x2="12" y2="16.5" stroke="#34d399" stroke-width="1.7" stroke-linecap="round"/></svg>'
    },
    {
      id: 'hardware',
      title: 'Hardware',
      gradient: 'linear-gradient(135deg, #7c3aed, #9333ea)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2" fill="rgba(255,255,255,0.2)" stroke="#ffffff" stroke-width="1.5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="#c084fc"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/></svg>'
    },
    {
      id: 'network',
      title: 'Network',
      gradient: 'linear-gradient(135deg, #0284c7, #3b82f6)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="rgba(255,255,255,0.15)" stroke="#ffffff" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="4" ry="9" stroke="#ffffff" stroke-width="1.5"/><line x1="3" y1="12" x2="21" y2="12" stroke="#38bdf8" stroke-width="1.5"/></svg>'
    },
    {
      id: 'settings',
      title: 'Settings',
      gradient: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
      icon: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#ffffff" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    }
  ];

  container.innerHTML = desktopShortcuts.map(sc => `
    <div class="desktop-icon" data-app="${sc.id}" onclick="handleDesktopIconClick(this, '${sc.id}')">
      <div class="desktop-icon-tile" style="background: ${sc.gradient};">
        ${sc.icon}
      </div>
      <span class="desktop-icon-label">${sc.title}</span>
    </div>
  `).join('');
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

async function pollMicroTelemetry(serverId) {
  try {
    const resp = await fetch(`/api/servers/${serverId}/metrics`);
    const res = await resp.json();
    if (res.online && res.metrics) {
      const cpu = res.metrics.cpu !== undefined ? res.metrics.cpu : 0;
      const mem = res.metrics.memory ? res.metrics.memory.percent : 0;
      const disk = res.metrics.disk ? res.metrics.disk.percent : 0;

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
      if (wgtCpuLoad && res.metrics.load) {
        wgtCpuLoad.textContent = `Load: ${res.metrics.load.join(', ')}`;
      }

      const wgtMemVal = document.getElementById('wgtMemVal');
      const wgtMemBar = document.getElementById('wgtMemBar');
      const wgtMemDetail = document.getElementById('wgtMemDetail');
      if (wgtMemVal) wgtMemVal.textContent = `${mem}%`;
      if (wgtMemBar) wgtMemBar.style.width = `${mem}%`;
      if (wgtMemDetail && res.metrics.memory) {
        if (res.metrics.memory.used_formatted && res.metrics.memory.total_formatted) {
          wgtMemDetail.textContent = `${res.metrics.memory.used_formatted} / ${res.metrics.memory.total_formatted}`;
        } else {
          const usedGb = (res.metrics.memory.used / (1024 ** 3)).toFixed(1);
          const totalGb = (res.metrics.memory.total / (1024 ** 3)).toFixed(1);
          wgtMemDetail.textContent = `${usedGb} / ${totalGb} GB`;
        }
      }

      const wgtDiskVal = document.getElementById('wgtDiskVal');
      const wgtDiskBar = document.getElementById('wgtDiskBar');
      const wgtDiskDetail = document.getElementById('wgtDiskDetail');
      if (wgtDiskVal) wgtDiskVal.textContent = `${disk}%`;
      if (wgtDiskBar) wgtDiskBar.style.width = `${disk}%`;
      if (wgtDiskDetail && res.metrics.disk) {
        if (res.metrics.disk.used_formatted && res.metrics.disk.total_formatted) {
          wgtDiskDetail.textContent = `${res.metrics.disk.used_formatted} / ${res.metrics.disk.total_formatted} (/)`;
        } else {
          const usedGb = (res.metrics.disk.used / (1024 ** 3)).toFixed(1);
          const totalGb = (res.metrics.disk.total / (1024 ** 3)).toFixed(1);
          wgtDiskDetail.textContent = `${usedGb} / ${totalGb} GB (/)`;
        }
      }

      const wgtUptime = document.getElementById('wgtUptime');
      if (wgtUptime && res.metrics.uptime !== undefined) {
        const u = res.metrics.uptime;
        const days = Math.floor(u / 86400);
        const hours = Math.floor((u % 86400) / 3600);
        const mins = Math.floor((u % 3600) / 60);
        wgtUptime.textContent = days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`;
      }

      const wgtOs = document.getElementById('wgtOs');
      if (wgtOs && res.metrics.os) {
        wgtOs.textContent = res.metrics.os.length > 20 ? res.metrics.os.substring(0, 18) + '..' : res.metrics.os;
      }

      const topDot = document.getElementById('topServerDot');
      if (topDot) topDot.className = 'status-dot connected';
    } else {
      const topDot = document.getElementById('topServerDot');
      if (topDot) topDot.className = 'status-dot disconnected';
    }
  } catch (_) {}
}

function handleDesktopContextMenu(e) {
  if (e.target.closest('.desktop-window') || e.target.closest('.desktop-dock') || e.target.closest('.desktop-top-bar')) {
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


