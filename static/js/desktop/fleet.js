/**
 * ShellMan OS: Fleet & History (fleet.js)
 *  - Fleet: every server on one page with CPU, memory and disk (read from stored readings, no extra SSH).
 *  - History: CPU, memory and disk graphs for the last hour up to the last 30 days.
 */
DesktopAppsController.prototype.launchFleet = function (params = {}) {
  const existing = WindowManager.getWindowByAppId('fleet');
  if (existing) {
    if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
    WindowManager.focusWindow(existing.id);
    if (params.server_id && existing._showHistory) existing._showHistory(Number(params.server_id));
    return existing;
  }

  const id = 'fleet_' + Date.now();
  const isAdmin = !(window.DesktopConfig && window.DesktopConfig.userRole === 'viewer');
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (url, method = 'GET', body) => {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    try {
      const r = await window.fetch(url, opt);
      let j = {};
      try { j = await r.json(); } catch (_) {}
      if (!r.ok && !j.error) j.error = `HTTP ${r.status}`;
      return j;
    } catch (e) { return { success: false, error: String(e.message || e) }; }
  };
  const level = (v) => (v >= 90 ? 'crit' : v >= 75 ? 'warn' : 'ok');
  const ago = (s) => (s == null ? 'no data' : s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago');
  const COLORS = { cpu: '#38bdf8', mem: '#a78bfa', disk: '#fbbf24' };

  if (!document.getElementById('flStyle')) {
    const st = document.createElement('style');
    st.id = 'flStyle';
    st.textContent = `
      .fl{height:100%;display:flex;flex-direction:column;background:var(--bg-canvas,var(--sm-inset));color:var(--text-primary,var(--text-primary));font-size:.88rem}
      .fl-top{display:flex;align-items:center;gap:.5rem;padding:.65rem 1rem;border-bottom:1px solid var(--border-subtle,var(--sm-line-strong));background:var(--bg-surface,var(--sm-surface));flex-wrap:wrap}
      .fl-tab{padding:.4rem .95rem;border-radius:9px;border:1px solid transparent;background:transparent;color:var(--text-muted,var(--text-muted));cursor:pointer;font-weight:600;font-size:.86rem;font-family:inherit}
      .fl-tab.on{background:var(--sm-accent-soft,color-mix(in srgb, var(--sm-accent) 15%, var(--sm-surface)));color:var(--text-primary,var(--text-primary));border-color:var(--sm-accent-line,#1d5473)}
      .fl-live{display:inline-flex;align-items:center;gap:.4rem;font-size:.72rem;font-weight:700;letter-spacing:.06em;color:var(--sm-accent,var(--c-teal));margin-left:.4rem}
      .fl-live i{font:700 .95rem/1 var(--font-mono,ui-monospace,monospace);font-style:normal;animation:flPulse 1.4s ease-in-out infinite}
      .fl-live i::before{content:"$"}
      .fl-live.off{color:var(--c-warn)}.fl-live.off i{animation:none}
      @keyframes flPulse{0%,100%{opacity:1}50%{opacity:.3}}
      .fl-sum{margin-left:auto;font-size:.8rem;color:var(--text-muted,var(--text-muted))}
      .fl-body{flex:1;overflow:auto;padding:1rem}
      .fl-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1rem}
      .fl-stat{border:1px solid var(--border-subtle,var(--sm-line-strong));border-radius:12px;padding:.7rem .9rem;background:var(--bg-surface,var(--sm-surface))}
      .fl-stat b{display:block;font-size:1.55rem;line-height:1.1;font-weight:700;font-variant-numeric:tabular-nums}
      .fl-stat span{font-size:.72rem;color:var(--text-muted,var(--text-muted));text-transform:uppercase;letter-spacing:.06em}
      .fl-stat.bad b{color:var(--c-bad)}.fl-stat.good b{color:var(--c-ok)}
      .fl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:1rem}
      .fl-card{border:1px solid var(--border-subtle,var(--sm-line-strong));border-radius:14px;padding:1rem 1.1rem;background:var(--bg-surface,var(--sm-surface));cursor:pointer;transition:border-color .15s,transform .15s;display:flex;flex-direction:column;gap:.8rem}
      .fl-card:hover{border-color:var(--sm-accent,#38bdf8);transform:translateY(-1px)}
      .fl-card.crit{border-color:#7a2430}.fl-card.warn{border-color:color-mix(in srgb, var(--c-warn) 35%, transparent)}
      .fl-card.off{opacity:.78}
      .fl-head{display:flex;align-items:center;gap:.55rem}
      .fl-dot{flex:0 0 auto;display:inline-block;line-height:1}
      .fl-dot::after{content:"$";font:700 1rem/1 var(--font-mono,ui-monospace,monospace);color:var(--sm-accent,var(--c-teal))}
      .fl-dot.stale::after{color:var(--c-warn)}.fl-dot.off::after{color:var(--c-bad)}
      .fl-name{font-weight:700;font-size:1.02rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
      .fl-tag{font:700 .64rem/1 var(--font-mono,monospace);letter-spacing:.06em;padding:.24rem .45rem;border-radius:6px;border:1px solid var(--border-color,var(--sm-line-strong));color:var(--text-muted,var(--text-muted))}
      .fl-mets{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem}
      .fl-m small{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted,var(--text-muted));margin-bottom:.1rem}
      .fl-m b{display:block;font-size:1.5rem;line-height:1.15;font-weight:700;font-variant-numeric:tabular-nums}
      .fl-m b.warn{color:var(--c-warn)}.fl-m b.crit{color:var(--c-bad)}
      .fl-bar{height:6px;border-radius:4px;background:var(--border-subtle,var(--sm-line));overflow:hidden;margin-top:.4rem}
      .fl-bar i{display:block;height:100%;border-radius:4px;background:#34d399}
      .fl-bar i.warn{background:#fbbf24}.fl-bar i.crit{background:#ff5a67}
      .fl-spark{display:block;width:100%;height:46px}
      .fl-foot{display:flex;justify-content:space-between;font-size:.76rem;color:var(--text-muted,var(--text-muted))}
      .fl-down{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;min-height:64px;color:var(--text-muted,var(--text-muted));text-align:center;font-size:.84rem}
      .fl-down svg{opacity:.6}
      .fl-empty{padding:2.5rem 1rem;text-align:center;color:var(--text-muted,var(--text-muted));line-height:1.6;font-size:.9rem}
      .fl-warn{margin-bottom:.9rem;padding:.6rem .85rem;border:1px solid color-mix(in srgb, var(--c-warn) 35%, transparent);border-radius:10px;background:rgba(251,191,36,.08);color:var(--c-warn);font-size:.84rem}
      .fl-ctl{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.8rem}
      .fl-ctl select{min-width:200px;font-size:.86rem;padding:.4rem .6rem;min-height:36px}
      .fl-rg{display:inline-flex;border:1px solid var(--border-color,var(--sm-line-strong));border-radius:8px;overflow:hidden}
      .fl-rg button{background:transparent;border:0;color:var(--text-muted,var(--text-muted));padding:.4rem .8rem;font-weight:600;font-size:.82rem;font-family:inherit;cursor:pointer;border-right:1px solid var(--border-color,var(--sm-line-strong))}
      .fl-rg button:last-child{border-right:0}
      .fl-rg button.on{background:var(--sm-accent-soft,color-mix(in srgb, var(--sm-accent) 15%, var(--sm-surface)));color:var(--text-primary,var(--text-primary))}
      .fl-ch{border:1px solid var(--border-subtle,var(--sm-line-strong));border-radius:14px;padding:.8rem 1rem;margin-bottom:.9rem;background:var(--bg-surface,var(--sm-surface))}
      .fl-ch h4{margin:0 0 .4rem;font-size:.94rem;display:flex;justify-content:space-between;align-items:baseline}
      .fl-ch h4 small{font-weight:500;color:var(--text-muted,var(--text-muted));font-size:.78rem}
      .fl-svg{width:100%;height:auto;display:block;overflow:visible}
      .fl-tip{position:absolute;pointer-events:none;background:var(--sm-inset);border:1px solid var(--border-color,var(--sm-line-strong));border-radius:6px;padding:.25rem .45rem;font-size:.68rem;white-space:nowrap;z-index:5;display:none}
      .fl-set{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;font-size:.82rem;color:var(--text-muted,var(--text-muted));margin-top:.3rem}
      .fl-set input[type=number]{width:70px;font-size:.74rem;padding:.2rem .4rem;min-height:26px}
    `;
    document.head.appendChild(st);
  }

  let tab = 'fleet';
  let servers = [];           // from /api/fleet
  let histServer = null;
  let range = '24h';
  let fleetTimer = null;
  let bodyRef = null;

  let sparkN = 0;
  const spark = (vals, color) => {
    if (!vals || vals.length < 2) return '<div class="fl-foot" style="height:46px;align-items:center;justify-content:center">collecting a graph…</div>';
    const w = 200, h = 46, step = w / (vals.length - 1), gid = 'fls' + (++sparkN);
    const pts = vals.map((v, i) => [i * step, h - 3 - (Math.min(100, v) / 100) * (h - 6)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
    return `<svg class="fl-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${line}L${w},${h}L0,${h}Z" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  };

  // ----------------------------------------------------------------- Fleet tab
  const bar = (label, v) => {
    const n = Math.max(0, Math.min(100, Number(v) || 0));
    return `<div class="fl-m"><small>${label}</small><b class="${level(n) === 'ok' ? '' : level(n)}">${+n.toFixed(1)}<span style="font-size:.8rem;font-weight:600;opacity:.7">%</span></b><div class="fl-bar"><i class="${level(n)}" style="width:${n}%"></i></div></div>`;
  };

  const paintFleet = () => {
    const pane = bodyRef.querySelector('[data-pane]');
    const sum = bodyRef.querySelector('[data-sum]');
    if (!servers.length) {
      pane.innerHTML = '<div class="fl-empty">No servers yet. Add one in Settings, then come back.</div>';
      sum.textContent = '';
      return;
    }
    const state = (s) => {
      if (!s.sample) return s.online ? 'stale' : 'off';
      if (!s.online) return 'off';
      if (s.stale) return 'stale';
      const m = Math.max(s.sample.cpu, s.sample.mem, s.sample.disk);
      return m >= 90 ? 'crit' : m >= 75 ? 'warn' : 'ok';
    };
    const order = { off: 0, crit: 1, warn: 2, stale: 3, ok: 4 };
    const list = servers.slice().sort((a, b) => order[state(a)] - order[state(b)] || a.name.localeCompare(b.name));
    const attention = list.filter(s => ['off', 'crit', 'warn'].includes(state(s))).length;
    sum.textContent = `${list.length} server${list.length === 1 ? '' : 's'} · ${attention ? attention + ' need attention' : 'all healthy'}`;
    const noData = list.every(s => !s.sample);
    const live = list.filter(s => s.sample && s.online);
    const avg = (k) => (live.length ? Math.round(live.reduce((t, s) => t + s.sample[k], 0) / live.length) : null);
    const stat = (label, val, cls) => `<div class="fl-stat ${cls || ''}"><b>${val}</b><span>${label}</span></div>`;
    const down = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/><path d="M3 3l18 18"/></svg>';
    pane.innerHTML = (noData ? `<div class="fl-warn">No readings stored yet. ShellMan reads every server about once a minute in the background. ${fleetEngineOn === false ? 'The background engine is OFF (SHELLMAN_ALERTS=0), so nothing is recorded.' : 'Give it a minute.'}</div>` : '')
      + `<div class="fl-stats">${stat('Online', list.filter(s => s.online).length + ' / ' + list.length, 'good')}${stat('Average CPU', avg('cpu') == null ? '–' : avg('cpu') + '%')}${stat('Average RAM', avg('mem') == null ? '–' : avg('mem') + '%')}${stat('Need attention', attention, attention ? 'bad' : 'good')}</div>`
      + `<div class="fl-grid">${list.map(s => {
        const st = state(s), sm = s.sample;
        const showMets = sm && s.online;
        return `<div class="fl-card ${st === 'crit' ? 'crit' : st === 'off' ? 'crit off' : st === 'warn' ? 'warn' : ''}" data-id="${s.id}" title="Click for history graphs">
          <div class="fl-head"><span class="fl-dot ${st === 'off' ? 'off' : st === 'stale' ? 'stale' : ''}"></span>
            <span class="fl-name">${esc(s.name)}</span>${s.kind === 'codespace' ? '<span class="fl-tag">CODESPACE</span>' : ''}</div>
          ${showMets ? `<div class="fl-mets">${bar('CPU', sm.cpu)}${bar('RAM', sm.mem)}${bar('Disk', sm.disk)}</div>${spark(s.live && s.live.length > 8 ? s.live : s.spark, COLORS.cpu)}
            <div class="fl-foot"><span>${s.live && s.live.length > 8 ? 'CPU, live' : 'CPU, last hour'}</span><span>load ${sm.load} · ${esc(ago(sm.age))}</span></div>`
          : `<div class="fl-down">${s.online ? '' : down}<span>${s.online ? 'Waiting for the first reading…' : 'Not reachable, or stopped.'}</span></div>`}
        </div>`;
      }).join('')}</div>`;
    pane.querySelectorAll('.fl-card').forEach(c => { c.onclick = () => showHistory(Number(c.dataset.id)); });
  };

  // Fresh readings every few seconds while this tab is showing (stopped Codespaces are never contacted).
  const LIVE_MS = 2000;   // same pace as the desktop widget (the server keeps a 1.8 s shared cache)
  let liveBusy = false;
  // The server on the desktop widget: Fleet takes the very reading the widget and System Overview get, from the same broadcast.
  const tel = () => window.DesktopTelemetry;
  const telOwns = (sid) => !!(tel() && tel().serverId === sid && tel().lastMetrics && servers.some(x => x.id === sid && x.online));
  const applyTelemetry = (m) => {
    const T = tel();
    if (!bodyRef || tab !== 'fleet' || !T || !m || !m.memory || !m.disk) return;
    const s = servers.find(x => x.id === T.serverId);
    if (!s) return;
    s.online = true; s.stale = false;
    s.sample = { cpu: Number(m.cpu) || 0, mem: Number(m.memory.percent) || 0, disk: Number(m.disk.percent) || 0, load: (m.load || [0])[0], age: 0 };
    s.live = (s.live || []).concat([s.sample.cpu]).slice(-90);
    paintFleet();
  };
  let unsubTel = null;
  const setLive = (ok) => {
    const el = bodyRef && bodyRef.querySelector('[data-live]');
    if (!el) return;
    el.classList.toggle('off', !ok);
    el.lastChild.textContent = ok ? 'LIVE' : 'PAUSED';
  };
  const liveTick = async () => {
    if (liveBusy || !bodyRef || tab !== 'fleet' || document.hidden) { if (document.hidden) setLive(false); return; }
    liveBusy = true;
    const r = await api('/api/fleet/live');
    liveBusy = false;
    if (!bodyRef || tab !== 'fleet') return;
    if (!r.success) { setLive(false); return; }
    setLive(true);
    (r.servers || []).forEach(u => {
      const s = servers.find(x => x.id === u.id);
      if (!s) return;
      if (telOwns(u.id)) return;      // the desktop widget's own reading is used for this one (see applyTelemetry)
      s.online = u.online;
      if (u.online && u.sample) {
        s.sample = u.sample; s.stale = false;
        s.live = (s.live || []).concat([u.sample.cpu]).slice(-90);   // about the last 3 minutes
      } else if (!u.online) { s.stale = true; }
    });
    paintFleet();
  };

  let fleetEngineOn = null;
  const loadFleet = async () => {
    const r = await api('/api/fleet');
    if (!bodyRef || tab !== 'fleet') return;
    if (!r.success) { bodyRef.querySelector('[data-pane]').innerHTML = `<div class="fl-empty">${esc(r.error || 'Could not load')}</div>`; return; }
    servers = r.servers || [];
    fleetEngineOn = r.engine_running;
    paintFleet();
    liveTick();
  };

  // ----------------------------------------------------------------- History tab
  const fmtTime = (t, span) => {
    const d = new Date(t * 1000);
    return span > 2 * 86400 ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const chartHtml = (title, key, color, data) => {
    const pts = data.points || [];
    if (!pts.length) return `<div class="fl-ch"><h4>${title}</h4><div class="fl-empty" style="padding:1rem">No readings in this period yet.</div></div>`;
    const W = 640, H = 150, L = 30, R = 8, T = 8, B = 20;
    const t0 = data.from, t1 = data.to, X = (t) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
    const Y = (v) => T + (1 - Math.min(100, Math.max(0, v)) / 100) * (H - T - B);
    // break the line where readings are missing for more than ~3 buckets (server was off)
    const gap = data.bucket * 3 + 120;
    let d = '', area = '', prev = null;
    pts.forEach(p => {
      const x = X(p.t + data.bucket / 2).toFixed(1), y = Y(p[key]).toFixed(1);
      if (prev === null || p.t - prev > gap) { d += `M${x},${y}`; } else { d += `L${x},${y}`; }
      prev = p.t;
    });
    const first = X(pts[0].t + data.bucket / 2), last = X(pts[pts.length - 1].t + data.bucket / 2);
    area = d + `L${last.toFixed(1)},${Y(0)}L${first.toFixed(1)},${Y(0)}Z`;
    const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.07)"/><text x="${L - 5}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="#939db2">${v}</text>`).join('');
    const ticks = [0, 1, 2, 3, 4].map(i => {
      const t = t0 + ((t1 - t0) * i) / 4;
      return `<text x="${X(t)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" font-size="9" fill="#939db2">${fmtTime(t, data.span)}</text>`;
    }).join('');
    const vals = pts.map(p => p[key]);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length, max = Math.max(...vals);
    return `<div class="fl-ch" data-chart="${key}"><h4>${title}<small>now ${Math.round(vals[vals.length - 1])}% · average ${Math.round(avg)}% · highest ${Math.round(max)}%</small></h4>
      <div style="position:relative"><svg class="fl-svg" viewBox="0 0 ${W} ${H}">${grid}${ticks}
        <path d="${area}" fill="${color}" opacity=".12" stroke="none"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>
        <line class="hv" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.35)" style="display:none"/><circle class="hc" r="3.5" fill="${color}" style="display:none"/>
        <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/></svg><div class="fl-tip"></div></div></div>`;
  };

  const wireHover = (root, data) => {
    const pts = data.points;
    root.querySelectorAll('.fl-ch[data-chart]').forEach(box => {
      const key = box.dataset.chart, svg = box.querySelector('svg'), tip = box.querySelector('.fl-tip');
      const hv = svg.querySelector('.hv'), hc = svg.querySelector('.hc'), hit = svg.querySelector('.hit');
      const W = 640, L = 30, R = 8;
      hit.onmousemove = (e) => {
        const r = svg.getBoundingClientRect();
        const vx = ((e.clientX - r.left) / r.width) * W;
        const t = data.from + ((vx - L) / (W - L - R)) * (data.to - data.from);
        let best = pts[0];
        pts.forEach(p => { if (Math.abs(p.t + data.bucket / 2 - t) < Math.abs(best.t + data.bucket / 2 - t)) best = p; });
        const x = L + ((best.t + data.bucket / 2 - data.from) / (data.to - data.from)) * (W - L - R);
        const y = 8 + (1 - best[key] / 100) * (150 - 8 - 20);
        hv.setAttribute('x1', x); hv.setAttribute('x2', x); hc.setAttribute('cx', x); hc.setAttribute('cy', y);
        hv.style.display = hc.style.display = '';
        tip.style.display = 'block';
        tip.textContent = `${new Date(best.t * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}  ·  ${best[key]}%` + (key === 'cpu' ? `  (peak ${best.cpu_max}%)` : '');
        const px = (x / W) * r.width;
        tip.style.left = Math.min(Math.max(0, px - 60), r.width - 150) + 'px';
        tip.style.top = '-4px';
      };
      hit.onmouseleave = () => { hv.style.display = hc.style.display = 'none'; tip.style.display = 'none'; };
    });
  };

  const loadHistory = async () => {
    const pane = bodyRef.querySelector('[data-hist]');
    if (!pane || histServer == null) return;
    pane.innerHTML = '<div class="fl-empty">Loading…</div>';
    const r = await api(`/api/servers/${histServer}/history?range=${range}`);
    if (!bodyRef || tab !== 'history') return;
    if (!r.success) { pane.innerHTML = `<div class="fl-empty">${esc(r.error || 'Could not load')}</div>`; return; }
    const keepDays = (r.history && r.history.history_days) || 7;
    const clipped = r.span < ({ '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800, '30d': 2592000 }[range] || 0);
    pane.innerHTML = (r.history && !r.history.history_enabled ? '<div class="fl-warn">History recording is turned off.</div>' : '')
      + (clipped ? `<div class="fl-warn">Only the last ${keepDays} day(s) are kept, so the graph shows that much.</div>` : '')
      + chartHtml('CPU', 'cpu', COLORS.cpu, r) + chartHtml('Memory', 'mem', COLORS.mem, r) + chartHtml('Disk', 'disk', COLORS.disk, r);
    if ((r.points || []).length) wireHover(pane, r);
  };

  const paintHistoryShell = async () => {
    const pane = bodyRef.querySelector('[data-pane]');
    if (!servers.length) { const r = await api('/api/fleet'); servers = r.servers || []; fleetEngineOn = r.engine_running; }
    if (histServer == null && servers.length) histServer = servers[0].id;
    pane.innerHTML = `<div class="fl-ctl"><select class="form-control" data-srv>${servers.map(s => `<option value="${s.id}" ${s.id === histServer ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <div class="fl-rg">${['1h', '6h', '24h', '7d', '30d'].map(k => `<button data-r="${k}" class="${k === range ? 'on' : ''}">${k}</button>`).join('')}</div></div>
      <div data-hist></div>
      ${isAdmin ? `<div class="fl-set"><span>Keep history for</span><input class="form-control" type="number" min="1" max="90" data-days><span>days</span>
        <label style="display:inline-flex;align-items:center;gap:.3rem"><input type="checkbox" data-on> record</label>
        <button class="btn btn-secondary btn-xs" data-save>Save</button><button class="btn btn-secondary btn-xs" data-clear style="color:var(--c-bad)">Clear all history</button><span data-setmsg></span></div>` : ''}`;
    pane.querySelector('[data-srv]').onchange = (e) => { histServer = Number(e.target.value); loadHistory(); };
    pane.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { range = b.dataset.r; pane.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); loadHistory(); });
    if (isAdmin) {
      const cfg = await api('/api/history/settings');
      pane.querySelector('[data-days]').value = cfg.history_days || 7;
      pane.querySelector('[data-on]').checked = !!cfg.history_enabled;
      const msg = (t, ok) => { const e = pane.querySelector('[data-setmsg]'); e.textContent = t; e.style.color = ok ? 'var(--c-ok)' : 'var(--c-bad)'; };
      pane.querySelector('[data-save]').onclick = async () => {
        const r = await api('/api/history/settings', 'PUT', { history_days: pane.querySelector('[data-days]').value, history_enabled: pane.querySelector('[data-on]').checked ? 1 : 0 });
        msg(r.success ? 'Saved' : (r.error || 'Failed'), r.success); if (r.success) loadHistory();
      };
      pane.querySelector('[data-clear]').onclick = async () => {
        if (!confirm('Delete all stored history for every server? Graphs start again from now.')) return;
        const r = await api('/api/history/clear', 'POST', {});
        msg(r.success ? `Removed ${r.removed} readings` : (r.error || 'Failed'), r.success); if (r.success) loadHistory();
      };
    }
    loadHistory();
  };

  const setTab = (t) => {
    tab = t;
    bodyRef.querySelectorAll('.fl-tab').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    clearInterval(fleetTimer);
    const lv0 = bodyRef.querySelector('[data-live]'); if (lv0) lv0.style.display = '';
    if (t === 'fleet') {
      bodyRef.querySelector('[data-pane]').innerHTML = '<div class="fl-empty">Loading…</div>';
      loadFleet();
      fleetTimer = setInterval(liveTick, LIVE_MS);
    } else {
      bodyRef.querySelector('[data-sum]').textContent = '';
      const lv = bodyRef.querySelector('[data-live]'); if (lv) lv.style.display = 'none';   // History graphs are not live
      paintHistoryShell();
    }
  };
  const showHistory = (sid) => { if (sid) histServer = sid; setTab('history'); };

  const win = WindowManager.createWindow({
    appId: 'fleet',
    multiInstance: false,
    title: 'Fleet & History',
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#22d3ee" stroke-width="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#22d3ee" stroke-width="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#22d3ee" stroke-width="1.8"/><polyline points="14 19 17 15 20 17" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    width: 1040,
    height: 680,
    minWidth: 560,
    minHeight: 380,
    contentHtml: `<div class="fl" id="${id}">
      <div class="fl-top"><button class="fl-tab on" data-t="fleet">Fleet</button><button class="fl-tab" data-t="history">History</button><span class="fl-live" data-live title="Updates every 2 seconds, like the desktop widget"><i></i>LIVE</span><span class="fl-sum" data-sum></span></div>
      <div class="fl-body" data-body><div data-pane></div></div></div>`,
    onInit: (bodyEl) => {
      bodyRef = bodyEl.querySelector('#' + id);
      bodyRef.querySelectorAll('.fl-tab').forEach(b => { b.onclick = () => setTab(b.dataset.t); });
      if (tel() && tel().subscribe) unsubTel = tel().subscribe(applyTelemetry);
      if (params.server_id) showHistory(Number(params.server_id)); else setTab('fleet');
    },
    onClose: () => { clearInterval(fleetTimer); if (unsubTel) unsubTel(); bodyRef = null; }
  });
  if (win) win._showHistory = showHistory;
  return win;
};
