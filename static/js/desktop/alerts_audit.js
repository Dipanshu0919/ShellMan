/**
 * ShellMan: server-side alerts UI, audit log viewer, session & encrypted-backup cards, and the bell.
 * Mounted into the Settings window (see settings.js) and into the desktop (bell).
 */
(function () {
  if (window.ShellmanAlertsUI) return;

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (url, method = 'GET', body) => {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(url, opt);
    let j = {};
    try { j = await r.json(); } catch (_) {}
    if (!r.ok && !j.error) j.error = `HTTP ${r.status}`;
    return j;
  };
  const toast = (m, k = 'info') => { if (window.showToast) window.showToast(m, k); };
  const ago = (iso) => {
    if (!iso) return '';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  };
  const when = (iso) => iso ? new Date(iso).toLocaleString() : '';
  const METRIC = { cpu: 'CPU %', mem: 'Memory %', disk: 'Disk %', swap: 'Swap %', load: 'Load (1 min)', offline: 'Server unreachable' };

  if (!document.getElementById('smAlertsCss')) {
    const st = document.createElement('style');
    st.id = 'smAlertsCss';
    st.textContent = `
      .sa-card{border:1px solid var(--border-color,#2f374b);border-radius:10px;padding:.9rem 1rem;margin-bottom:1.1rem;background:rgba(255,255,255,.02)}
      .sa-h{font-weight:700;font-size:.85rem;color:var(--text-primary,#f3f5f9);margin-bottom:.2rem;display:flex;align-items:center;justify-content:space-between;gap:.5rem}
      .sa-d{font-size:.74rem;color:var(--text-muted,#939db2);margin-bottom:.8rem;line-height:1.4}
      .sa-row{display:flex;align-items:center;gap:.6rem;padding:.5rem .6rem;border:1px solid var(--border-color,#2f374b);border-radius:8px;margin-bottom:.4rem;font-size:.78rem;color:var(--text-primary,#f3f5f9)}
      .sa-row .grow{flex:1;min-width:0}
      .sa-sub{font-size:.7rem;color:var(--text-muted,#939db2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .sa-pill{font:700 .62rem/1 var(--font-mono,monospace);letter-spacing:.05em;padding:.2rem .4rem;border-radius:5px;border:1px solid currentColor}
      .sa-crit{color:#ff5a67}.sa-warn{color:#fbbf24}.sa-ok{color:#34d399}.sa-mute{color:#939db2}
      .sa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.55rem;margin-bottom:.6rem}
      .sa-grid label{display:block;font-size:.68rem;color:var(--text-muted,#939db2);margin-bottom:.2rem}
      .sa-grid .form-control,.sa-card select.form-control,.sa-card input.form-control{font-size:.78rem;padding:.35rem .5rem;min-height:30px}
      .sa-btn{font-size:.72rem;padding:.25rem .6rem}
      .sa-empty{font-size:.76rem;color:var(--text-muted,#939db2);padding:.4rem 0}
      .sa-err{color:#ff8a93;font-size:.74rem;margin-top:.4rem;min-height:1em}
      .sa-tbl{width:100%;border-collapse:collapse;font-size:.74rem}
      .sa-tbl th{text-align:left;color:var(--text-muted,#939db2);font-weight:600;padding:.35rem .4rem;border-bottom:1px solid var(--border-color,#2f374b);position:sticky;top:0;background:var(--bg-surface,#151f32)}
      .sa-tbl td{padding:.35rem .4rem;border-bottom:1px solid rgba(255,255,255,.05);vertical-align:top;color:var(--text-primary,#f3f5f9)}
      .sa-scroll{max-height:46vh;overflow:auto;border:1px solid var(--border-color,#2f374b);border-radius:8px}
      .sa-bell{position:fixed;bottom:18px;left:18px;z-index:9000;width:34px;height:34px;border-radius:10px;border:1px solid var(--border-color,#2f374b);background:rgba(15,22,35,.82);color:#e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px)}
      .sa-bell:hover{border-color:var(--sm-accent,#38bdf8)}
      .sa-bell svg{width:16px;height:16px}
      .sa-bell .n{position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;border-radius:8px;background:#ff5a67;color:#fff;font:700 .6rem/16px var(--font-mono,monospace);text-align:center;padding:0 3px;display:none}
      .sa-bell.on .n{display:block}.sa-bell.warn .n{background:#fbbf24;color:#1b1300}
      .sa-pop{position:fixed;bottom:62px;left:18px;z-index:9001;width:min(360px,calc(100vw - 32px));max-height:60vh;overflow:auto;border:1px solid var(--border-color,#2f374b);border-radius:12px;background:var(--bg-surface,#151f32);box-shadow:0 18px 40px rgba(0,0,0,.55);padding:.7rem;display:none}
      .sa-pop.open{display:block}
    `;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------ Alerts page
  const ShellmanAlertsUI = {
    async mount(root) {
      root.innerHTML = `<div class="sa-card"><div class="sa-h">Background alerts <span class="sa-pill sa-mute" id="saEng">checking…</span></div>
        <div class="sa-d">ShellMan checks your servers on its own, even with no browser open, and sends a message when something stays wrong. Nothing is on until you add a rule and a channel.</div>
        <div id="saIncidents"></div></div>
        <div class="sa-card"><div class="sa-h">Rules <span><button class="btn btn-secondary sa-btn" id="saPreset">Add recommended rules</button></span></div>
        <div class="sa-d">A rule fires when the value stays at or above the limit for the chosen time, and resolves after two clean checks.</div>
        <div id="saRules"></div><div id="saRuleForm"></div></div>
        <div class="sa-card"><div class="sa-h">Notification channels</div>
        <div class="sa-d">Where alerts are sent. Secrets are stored encrypted and never shown again.</div>
        <div id="saChannels"></div><div id="saChanForm"></div></div>`;
      this.root = root;
      this.servers = ((await api('/api/servers/list')).servers) || [];
      root.querySelector('#saPreset').onclick = async () => {
        const r = await api('/api/alerts/rules/presets', 'POST', {});
        toast(r.success ? `${r.added} rule(s) added` : (r.error || 'Failed'), r.success ? 'success' : 'warning');
        this.loadRules();
      };
      this.loadIncidents(); this.loadRules(); this.loadChannels();
    },

    async loadIncidents() {
      const el = this.root.querySelector('#saIncidents'); if (!el) return;
      const [sum, ev] = await Promise.all([api('/api/alerts/summary'), api('/api/alerts/events?limit=15')]);
      const eng = this.root.querySelector('#saEng');
      if (eng && sum.engine) {
        eng.textContent = sum.engine.running ? `ENGINE ON · every ${sum.engine.interval}s` : 'ENGINE OFF';
        eng.className = 'sa-pill ' + (sum.engine.running ? 'sa-ok' : 'sa-crit');
      }
      const items = ev.items || [];
      el.innerHTML = (items.length ? items.map(e => `
        <div class="sa-row">
          <span class="sa-pill ${e.active ? (e.severity === 'critical' ? 'sa-crit' : 'sa-warn') : 'sa-ok'}">${e.active ? esc(e.severity.toUpperCase()) : 'RESOLVED'}</span>
          <div class="grow"><div>${esc(e.rule_name)} · ${esc(e.server_name)}</div>
            <div class="sa-sub" title="${esc(e.message)}">${esc(e.message)} · ${ago(e.started_at)}${e.resolved_at ? ' · resolved ' + ago(e.resolved_at) : ''}</div></div>
          ${e.acknowledged ? '' : `<button class="btn btn-secondary sa-btn" data-ack="${e.id}">Acknowledge</button>`}
        </div>`).join('') : '<div class="sa-empty">No incidents yet.</div>')
        + `<div style="display:flex;gap:.4rem;margin-top:.5rem"><button class="btn btn-secondary sa-btn" id="saNow">Check now</button>
           <button class="btn btn-secondary sa-btn" id="saAckAll">Acknowledge all</button>
           <button class="btn btn-secondary sa-btn" id="saClear">Clear resolved</button></div>`;
      el.querySelectorAll('[data-ack]').forEach(b => b.onclick = async () => { await api(`/api/alerts/events/${b.dataset.ack}/ack`, 'POST', {}); this.loadIncidents(); ShellmanBell.refresh(); });
      el.querySelector('#saNow').onclick = async () => { await api('/api/alerts/check-now', 'POST', {}); toast('Checking now…', 'info'); setTimeout(() => { this.loadIncidents(); ShellmanBell.refresh(); }, 4000); };
      el.querySelector('#saAckAll').onclick = async () => { await api('/api/alerts/events/ack-all', 'POST', {}); this.loadIncidents(); ShellmanBell.refresh(); };
      el.querySelector('#saClear').onclick = async () => { await api('/api/alerts/events/clear', 'POST', {}); this.loadIncidents(); };
    },

    async loadRules() {
      const el = this.root.querySelector('#saRules'); if (!el) return;
      const r = await api('/api/alerts/rules');
      this.rules = r.items || [];
      const sname = (id) => id ? ((this.servers.find(s => s.id === id) || {}).name || 'server ' + id) : 'All servers';
      el.innerHTML = (this.rules.length ? this.rules.map(x => `
        <div class="sa-row">
          <input type="checkbox" data-en="${x.id}" ${x.enabled ? 'checked' : ''} title="Enabled">
          <div class="grow"><div>${esc(x.name)} <span class="sa-pill ${x.severity === 'critical' ? 'sa-crit' : 'sa-warn'}">${esc(x.severity.toUpperCase())}</span></div>
            <div class="sa-sub">${esc(sname(x.server_id))} · ${esc(METRIC[x.metric] || x.metric)}${x.metric === 'offline' ? '' : ' ≥ ' + x.threshold} · for ${x.duration_min} min · repeat ${x.cooldown_min ? 'every ' + x.cooldown_min + ' min' : 'never'}</div></div>
          <button class="btn btn-secondary sa-btn" data-edit="${x.id}">Edit</button>
          <button class="btn btn-secondary sa-btn" data-del="${x.id}">Delete</button>
        </div>`).join('') : '<div class="sa-empty">No rules yet. Add the recommended set, or create your own.</div>')
        + '<button class="btn btn-primary sa-btn" id="saNewRule" style="margin-top:.4rem">+ New rule</button>';
      el.querySelectorAll('[data-en]').forEach(c => c.onchange = async () => {
        const x = this.rules.find(r => r.id == c.dataset.en);
        await api(`/api/alerts/rules/${x.id}`, 'PUT', Object.assign({}, x, { enabled: c.checked })); this.loadRules();
      });
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Delete this rule?')) return; await api(`/api/alerts/rules/${b.dataset.del}`, 'DELETE'); this.loadRules(); this.loadIncidents(); });
      el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.ruleForm(this.rules.find(r => r.id == b.dataset.edit)));
      el.querySelector('#saNewRule').onclick = () => this.ruleForm(null);
    },

    ruleForm(rule) {
      const f = this.root.querySelector('#saRuleForm');
      const r = rule || { name: '', metric: 'cpu', server_id: null, threshold: 90, duration_min: 5, cooldown_min: 60, severity: 'warning', enabled: true };
      f.innerHTML = `<div style="margin-top:.7rem;border-top:1px solid var(--border-color,#2f374b);padding-top:.7rem">
        <div class="sa-grid">
          <div><label>Name</label><input class="form-control" id="rfName" value="${esc(r.name)}" placeholder="High CPU"></div>
          <div><label>Watch</label><select class="form-control" id="rfMetric">${Object.keys(METRIC).map(k => `<option value="${k}" ${r.metric === k ? 'selected' : ''}>${METRIC[k]}</option>`).join('')}</select></div>
          <div><label>Server</label><select class="form-control" id="rfServer"><option value="">All servers</option>${this.servers.map(s => `<option value="${s.id}" ${r.server_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
          <div id="rfThrWrap"><label>At or above</label><input class="form-control" id="rfThr" type="number" min="1" step="any" value="${r.threshold}"></div>
          <div><label>For (minutes)</label><input class="form-control" id="rfDur" type="number" min="0" max="1440" value="${r.duration_min}"></div>
          <div><label>Repeat every (min, 0 = never)</label><input class="form-control" id="rfCool" type="number" min="0" value="${r.cooldown_min}"></div>
          <div><label>Severity</label><select class="form-control" id="rfSev"><option value="warning" ${r.severity === 'warning' ? 'selected' : ''}>Warning</option><option value="critical" ${r.severity === 'critical' ? 'selected' : ''}>Critical</option></select></div>
        </div>
        <button class="btn btn-primary sa-btn" id="rfSave">${rule ? 'Save rule' : 'Add rule'}</button>
        <button class="btn btn-secondary sa-btn" id="rfCancel">Cancel</button><div class="sa-err" id="rfErr"></div></div>`;
      const sync = () => { f.querySelector('#rfThrWrap').style.display = f.querySelector('#rfMetric').value === 'offline' ? 'none' : ''; };
      f.querySelector('#rfMetric').onchange = sync; sync();
      f.querySelector('#rfCancel').onclick = () => { f.innerHTML = ''; };
      f.querySelector('#rfSave').onclick = async () => {
        const body = {
          name: f.querySelector('#rfName').value, metric: f.querySelector('#rfMetric').value,
          server_id: f.querySelector('#rfServer').value || null, threshold: f.querySelector('#rfThr').value,
          duration_min: f.querySelector('#rfDur').value, cooldown_min: f.querySelector('#rfCool').value,
          severity: f.querySelector('#rfSev').value, enabled: rule ? rule.enabled : true
        };
        const res = rule ? await api(`/api/alerts/rules/${rule.id}`, 'PUT', body) : await api('/api/alerts/rules', 'POST', body);
        if (!res.success) { f.querySelector('#rfErr').textContent = res.error || 'Failed'; return; }
        f.innerHTML = ''; this.loadRules();
      };
    },

    async loadChannels() {
      const el = this.root.querySelector('#saChannels'); if (!el) return;
      const r = await api('/api/alerts/channels');
      this.channels = r.items || [];
      el.innerHTML = (this.channels.length ? this.channels.map(c => `
        <div class="sa-row">
          <input type="checkbox" data-cen="${c.id}" ${c.enabled ? 'checked' : ''} title="Enabled">
          <div class="grow"><div>${esc(c.name)} <span class="sa-pill sa-mute">${esc(c.kind.toUpperCase())}</span>${c.min_severity === 'critical' ? ' <span class="sa-pill sa-crit">CRITICAL ONLY</span>' : ''}</div>
            <div class="sa-sub">${c.last_status ? esc(c.last_status) + (c.last_sent_at ? ' · ' + ago(c.last_sent_at) : '') : 'never used'}</div></div>
          <button class="btn btn-secondary sa-btn" data-ctest="${c.id}">Send test</button>
          <button class="btn btn-secondary sa-btn" data-cedit="${c.id}">Edit</button>
          <button class="btn btn-secondary sa-btn" data-cdel="${c.id}">Delete</button>
        </div>`).join('') : '<div class="sa-empty">No channel yet. Incidents still show in the bell and the list above.</div>')
        + '<button class="btn btn-primary sa-btn" id="saNewChan" style="margin-top:.4rem">+ Add channel</button>';
      el.querySelectorAll('[data-cen]').forEach(c => c.onchange = async () => {
        const x = this.channels.find(r => r.id == c.dataset.cen);
        await api(`/api/alerts/channels/${x.id}`, 'PUT', { name: x.name, enabled: c.checked, min_severity: x.min_severity, config: {} }); this.loadChannels();
      });
      el.querySelectorAll('[data-ctest]').forEach(b => b.onclick = async () => {
        b.disabled = true; const r2 = await api(`/api/alerts/channels/${b.dataset.ctest}/test`, 'POST', {}); b.disabled = false;
        toast(r2.success ? 'Test message sent' : ('Test failed: ' + (r2.error || '')), r2.success ? 'success' : 'warning'); this.loadChannels();
      });
      el.querySelectorAll('[data-cdel]').forEach(b => b.onclick = async () => { if (!confirm('Delete this channel?')) return; await api(`/api/alerts/channels/${b.dataset.cdel}`, 'DELETE'); this.loadChannels(); });
      el.querySelectorAll('[data-cedit]').forEach(b => b.onclick = () => this.chanForm(this.channels.find(c => c.id == b.dataset.cedit)));
      el.querySelector('#saNewChan').onclick = () => this.chanForm(null);
    },

    chanForm(ch) {
      const f = this.root.querySelector('#saChanForm');
      const kind = ch ? ch.kind : 'telegram';
      const cfg = ch ? ch.config : {};
      const has = ch ? ch.has_secret : {};
      const fields = {
        telegram: [['bot_token', 'Bot token', 'password', true], ['chat_id', 'Chat id', 'text']],
        slack: [['url', 'Incoming webhook URL', 'password', true]],
        discord: [['url', 'Webhook URL', 'password', true]],
        webhook: [['url', 'URL', 'password', true], ['secret', 'Signing secret (optional, HMAC-SHA256)', 'password', true]],
        email: [['host', 'SMTP host', 'text'], ['port', 'Port', 'number'], ['security', 'Security (starttls / ssl / none)', 'text'], ['username', 'Username', 'text'], ['password', 'Password', 'password', true], ['from', 'From', 'text'], ['to', 'To (comma separated)', 'text']],
      };
      const draw = (k) => {
        f.innerHTML = `<div style="margin-top:.7rem;border-top:1px solid var(--border-color,#2f374b);padding-top:.7rem">
          <div class="sa-grid">
            <div><label>Name</label><input class="form-control" id="cfName" value="${esc(ch ? ch.name : '')}" placeholder="Ops channel"></div>
            <div><label>Type</label><select class="form-control" id="cfKind" ${ch ? 'disabled' : ''}>${['telegram', 'slack', 'discord', 'webhook', 'email'].map(x => `<option value="${x}" ${x === k ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
            <div><label>Send</label><select class="form-control" id="cfSev"><option value="warning">Warning and critical</option><option value="critical" ${ch && ch.min_severity === 'critical' ? 'selected' : ''}>Critical only</option></select></div>
          </div>
          <div class="sa-grid">${fields[k].map(([key, label, type, secret]) => `<div><label>${label}</label><input class="form-control" data-cf="${key}" type="${type}" autocomplete="off"
            value="${secret ? '' : esc(cfg[key] || (key === 'port' ? '587' : key === 'security' ? 'starttls' : ''))}" placeholder="${secret && has[key] ? 'saved, leave blank to keep' : ''}"></div>`).join('')}</div>
          <button class="btn btn-primary sa-btn" id="cfSave">${ch ? 'Save channel' : 'Add channel'}</button>
          <button class="btn btn-secondary sa-btn" id="cfCancel">Cancel</button><div class="sa-err" id="cfErr"></div></div>`;
        f.querySelector('#cfKind').onchange = (e) => draw(e.target.value);
        f.querySelector('#cfCancel').onclick = () => { f.innerHTML = ''; };
        f.querySelector('#cfSave').onclick = async () => {
          const config = {}; f.querySelectorAll('[data-cf]').forEach(i => { config[i.dataset.cf] = i.value; });
          const body = { name: f.querySelector('#cfName').value, kind: f.querySelector('#cfKind').value, min_severity: f.querySelector('#cfSev').value, enabled: ch ? ch.enabled : true, config };
          const res = ch ? await api(`/api/alerts/channels/${ch.id}`, 'PUT', body) : await api('/api/alerts/channels', 'POST', body);
          if (!res.success) { f.querySelector('#cfErr').textContent = res.error || 'Failed'; return; }
          f.innerHTML = ''; this.loadChannels();
        };
      };
      draw(kind);
    }
  };

  // ------------------------------------------------------------------ Audit log page
  const ShellmanAuditUI = {
    state: {},
    // datetime-local value (browser time) -> ISO UTC string for the API
    iso(v, endOfDay) {
      if (!v) return '';
      const d = new Date(v.length === 10 ? v + (endOfDay ? 'T23:59:59' : 'T00:00:00') : v);
      return isNaN(d) ? '' : d.toISOString();
    },
    fmtLocal(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; },
    qs(extra) {
      const s = this.state, p = new URLSearchParams();
      if (s.q) p.set('q', s.q);
      if (s.user) p.set('user', s.user);
      if (s.failed) p.set('failed', '1');
      const f = this.iso(s.from, false), t = this.iso(s.to, true);
      if (f) p.set('from', f);
      if (t) p.set('to', t);
      Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
      return p.toString();
    },
    async mount(root) {
      this.root = root; this.state = { offset: 0, q: '', user: '', failed: false, from: '', to: '' };
      root.innerHTML = `<div class="sa-card"><div class="sa-h">Audit log <span><a class="btn btn-secondary sa-btn" id="auExport" href="/api/audit/export">Export CSV</a></span></div>
        <div class="sa-d">Who signed in, changed servers or settings, deleted files, ran actions or opened a terminal. Export uses the filters below.</div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;align-items:flex-end">
          <input class="form-control" id="auQ" placeholder="Search user, IP, action, target…" style="flex:1;min-width:180px;font-size:.78rem">
          <select class="form-control" id="auUser" style="width:auto;font-size:.78rem"><option value="">All users</option></select>
          <label style="display:flex;align-items:center;gap:.35rem;font-size:.76rem;color:var(--text-secondary,#c3cad8)"><input type="checkbox" id="auFail"> Failures only</label>
        </div>
        <div style="display:flex;gap:.45rem;flex-wrap:wrap;margin-bottom:.6rem;align-items:flex-end">
          <div class="sa-grid" style="display:flex;gap:.45rem;margin:0">
            <div><label>From</label><input class="form-control" id="auFrom" type="date"></div>
            <div><label>To</label><input class="form-control" id="auTo" type="date"></div>
          </div>
          <button class="btn btn-secondary sa-btn" data-r="0">Today</button>
          <button class="btn btn-secondary sa-btn" data-r="7">7 days</button>
          <button class="btn btn-secondary sa-btn" data-r="30">30 days</button>
          <button class="btn btn-secondary sa-btn" data-r="">All time</button>
        </div>
        <div class="sa-scroll" id="auList"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.5rem"><span class="sa-sub" id="auCount"></span>
          <span><button class="btn btn-secondary sa-btn" id="auPrev">Newer</button> <button class="btn btn-secondary sa-btn" id="auNext">Older</button></span></div></div>
        <div class="sa-card" id="auKeep"></div>`;
      const R = (sel) => root.querySelector(sel);
      let t = null;
      const reload = () => { this.state.offset = 0; this.load(); };
      R('#auQ').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { this.state.q = e.target.value; reload(); }, 250); };
      R('#auUser').onchange = (e) => { this.state.user = e.target.value; reload(); };
      R('#auFail').onchange = (e) => { this.state.failed = e.target.checked; reload(); };
      R('#auFrom').onchange = (e) => { this.state.from = e.target.value; reload(); };
      R('#auTo').onchange = (e) => { this.state.to = e.target.value; reload(); };
      root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
        const v = b.dataset.r;
        if (v === '') { this.state.from = ''; this.state.to = ''; }
        else { const d = new Date(); this.state.to = this.fmtLocal(d); d.setDate(d.getDate() - Number(v)); this.state.from = this.fmtLocal(d); }
        R('#auFrom').value = this.state.from; R('#auTo').value = this.state.to; reload();
      });
      R('#auPrev').onclick = () => { this.state.offset = Math.max(0, this.state.offset - 100); this.load(); };
      R('#auNext').onclick = () => { this.state.offset += 100; this.load(); };
      this.loadMeta();
      this.load();
    },
    async loadMeta() {
      const m = await api('/api/audit/meta');
      if (!m || !m.success) return;
      const sel = this.root.querySelector('#auUser');
      if (sel) sel.innerHTML = '<option value="">All users</option>' + (m.users || []).map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
      this.paintKeep(m);
    },
    paintKeep(m) {
      const box = this.root.querySelector('#auKeep'); if (!box) return;
      const c = m.config || {};
      box.innerHTML = `<div class="sa-h">Retention &amp; cleanup</div>
        <div class="sa-d">Old entries are deleted automatically so the log cannot grow without limit. ${m.total || 0} entries stored${m.oldest ? ', oldest ' + esc(when(m.oldest)) : ''}. Use 0 for no limit.</div>
        <div class="sa-grid">
          <div><label>Delete entries older than (days)</label><input class="form-control" id="auDays" type="number" min="0" max="3650" value="${c.retention_days ?? 180}"></div>
          <div><label>Keep at most (entries)</label><input class="form-control" id="auMax" type="number" min="0" max="5000000" value="${c.max_rows ?? 20000}"></div>
        </div>
        <label style="display:flex;align-items:flex-start;gap:.5rem;margin:.1rem 0 .7rem;cursor:pointer;font-size:.76rem;color:var(--text-primary,#f3f5f9)">
          <input type="checkbox" id="auRecord" ${(c.record_terminal ?? 1) ? 'checked' : ''} style="margin-top:2px">
          <span><b>Record typed terminal commands.</b> Each command a person types in the terminal is saved here as "terminal.command", with who, which server and when. Screen output is never stored, and text typed at password prompts is replaced by [hidden input].</span>
        </label>
        <button class="btn btn-primary sa-btn" id="auSave">Save &amp; clean now</button>
        <hr style="border:0;border-top:1px solid var(--border-color,#2f374b);margin:.9rem 0">
        <div class="sa-sub" style="margin-bottom:.4rem">Delete manually (cannot be undone — export CSV first if you need a copy):</div>
        <div style="display:flex;gap:.45rem;flex-wrap:wrap;align-items:flex-end">
          <div><label class="sa-sub" style="display:block">Older than (days)</label><input class="form-control" id="auPurgeDays" type="number" min="0" placeholder="e.g. 30" style="width:110px;font-size:.78rem"></div>
          <button class="btn btn-secondary sa-btn" id="auPurgeAge">Delete older</button>
          <button class="btn btn-secondary sa-btn" id="auPurgeRange">Delete the From–To range above</button>
          <button class="btn btn-secondary sa-btn" id="auPurgeAll" style="color:#ff8a93">Delete everything</button>
        </div><div class="sa-err" id="auKeepMsg"></div>`;
      const msg = (t, ok) => { const e = box.querySelector('#auKeepMsg'); e.textContent = t; e.style.color = ok ? '#34d399' : '#ff8a93'; };
      const done = (r) => { if (r && r.success) { msg(`Removed ${r.removed} entries.`, true); this.state.offset = 0; this.load(); this.loadMeta(); } else msg((r && r.error) || 'Failed'); };
      box.querySelector('#auSave').onclick = async () => {
        done(await api('/api/audit/settings', 'PUT', { retention_days: box.querySelector('#auDays').value, max_rows: box.querySelector('#auMax').value, record_terminal: box.querySelector('#auRecord').checked ? 1 : 0 }));
      };
      box.querySelector('#auPurgeAge').onclick = async () => {
        const d = box.querySelector('#auPurgeDays').value;
        if (d === '') return msg('Enter a number of days.');
        if (confirm(`Delete all audit entries older than ${d} days?`)) done(await api('/api/audit/purge', 'POST', { older_than_days: Number(d) }));
      };
      box.querySelector('#auPurgeRange').onclick = async () => {
        const f = this.iso(this.state.from, false), t = this.iso(this.state.to, true);
        if (!f && !t) return msg('Pick a From and/or To date in the filters above first.');
        if (confirm(`Delete audit entries from ${this.state.from || 'the beginning'} to ${this.state.to || 'now'}?`)) done(await api('/api/audit/purge', 'POST', { from: f, to: t }));
      };
      box.querySelector('#auPurgeAll').onclick = async () => {
        if (confirm('Delete the ENTIRE audit log? This cannot be undone.')) done(await api('/api/audit/purge', 'POST', { all: true }));
      };
    },
    async load() {
      const s = this.state;
      const r = await api('/api/audit?' + this.qs({ limit: 100, offset: s.offset }));
      const list = this.root.querySelector('#auList'); if (!list) return;
      const rows = r.items || [];
      list.innerHTML = rows.length ? `<table class="sa-tbl"><thead><tr><th>Time</th><th>User</th><th>IP</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>${rows.map(x => `
        <tr><td style="white-space:nowrap">${esc(when(x.ts))}</td><td>${esc(x.username)}</td><td>${esc(x.ip)}</td>
        <td><span class="${x.ok ? 'sa-ok' : 'sa-crit'}">${esc(x.action)}</span></td><td>${esc(x.target)}</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table>`
        : '<div class="sa-empty" style="padding:.8rem">Nothing recorded for this filter.</div>';
      this.root.querySelector('#auCount').textContent = `${rows.length ? s.offset + 1 : 0}-${s.offset + rows.length} of ${r.total || 0}`;
      const ex = this.root.querySelector('#auExport'); if (ex) ex.href = '/api/audit/export?' + this.qs();
    }
  };

  // ------------------------------------------------------------------ Security extras (Admin tab) & encrypted backup (Backup tab)
  const ShellmanSecurityUI = {
    appendSessionCard(pane) {
      if (pane.querySelector('#saSessCard')) return;
      const d = document.createElement('div');
      d.className = 'sa-card'; d.id = 'saSessCard'; d.style.marginTop = '1.1rem';
      d.innerHTML = `<div class="sa-h">Signed-in devices</div><div class="sa-d">Signs every other browser out. This one stays signed in. Changing your password or turning off 2FA does this automatically.</div>
        <button class="btn btn-secondary sa-btn" id="saLogoutOthers">Sign out other devices</button>`;
      pane.appendChild(d);
      d.querySelector('#saLogoutOthers').onclick = async () => {
        const r = await api('/api/settings/logout-others', 'POST', {});
        toast(r.success ? r.message : (r.error || 'Failed'), r.success ? 'success' : 'warning');
      };
    },
    appendEncryptedBackup(pane) {
      if (pane.querySelector('#saEncBk')) return;
      const d = document.createElement('div');
      d.className = 'sa-card'; d.id = 'saEncBk'; d.style.marginTop = '1.1rem';
      d.innerHTML = `<div class="sa-h">Full encrypted backup</div>
        <div class="sa-d">Includes server passwords and SSH keys, Git deployments, alert rules and channels, and custom actions. Everything is encrypted with a passphrase you choose (PBKDF2 + AES). Without the passphrase the file cannot be opened, and ShellMan cannot recover it.</div>
        <div class="sa-grid">
          <div><label>Your account password</label><input class="form-control" id="ebPw" type="password" autocomplete="current-password"></div>
          <div><label>Backup passphrase (10+ characters)</label><input class="form-control" id="ebPass" type="password" autocomplete="new-password"></div>
        </div>
        <button class="btn btn-primary sa-btn" id="ebExport">Download encrypted backup</button>
        <hr style="border:0;border-top:1px solid var(--border-color,#2f374b);margin:.9rem 0">
        <div class="sa-sub" style="margin-bottom:.4rem">Restore from an encrypted backup (adds missing items, never deletes yours):</div>
        <div class="sa-grid"><div><label>Backup file</label><input class="form-control" id="ebFile" type="file" accept=".json,.smbak"></div>
          <div><label>Backup passphrase</label><input class="form-control" id="ebPass2" type="password" autocomplete="off"></div></div>
        <button class="btn btn-secondary sa-btn" id="ebImport">Restore</button><div class="sa-err" id="ebErr"></div>`;
      pane.appendChild(d);
      const err = (m, ok) => { const e = d.querySelector('#ebErr'); e.textContent = m; e.style.color = ok ? '#34d399' : '#ff8a93'; };
      d.querySelector('#ebExport').onclick = async () => {
        const r = await fetch('/api/settings/export-full', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: d.querySelector('#ebPw').value, passphrase: d.querySelector('#ebPass').value }) });
        if (!r.ok) { let j = {}; try { j = await r.json(); } catch (_) {} err(j.error || 'Export failed'); return; }
        const blob = await r.blob(); const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (r.headers.get('Content-Disposition') || '').split('filename=')[1]?.replace(/"/g, '') || 'shellman_full_backup.smbak';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        d.querySelector('#ebPass').value = ''; d.querySelector('#ebPw').value = ''; err('Backup downloaded. Keep the passphrase safe.', true);
      };
      d.querySelector('#ebImport').onclick = async () => {
        const file = d.querySelector('#ebFile').files[0];
        if (!file) { err('Choose a backup file first.'); return; }
        const fd = new FormData(); fd.append('file', file); fd.append('passphrase', d.querySelector('#ebPass2').value);
        const r = await fetch('/api/settings/import-full', { method: 'POST', body: fd });
        let j = {}; try { j = await r.json(); } catch (_) {}
        if (!j.success) { err(j.error || 'Restore failed'); return; }
        err(j.message, true); toast(j.message, 'success');
      };
    }
  };

  // ------------------------------------------------------------------ Bell
  const ShellmanBell = {
    last: new Set(), timer: null, el: null, pop: null,
    init() {
      if (this.el || !document.body) return;
      const b = document.createElement('button');
      b.className = 'sa-bell'; b.type = 'button'; b.title = 'Server alerts'; b.setAttribute('aria-label', 'Server alerts');
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg><span class="n"></span>';
      const p = document.createElement('div'); p.className = 'sa-pop';
      document.body.appendChild(b); document.body.appendChild(p);
      this.el = b; this.pop = p;
      b.onclick = (e) => { e.stopPropagation(); p.classList.toggle('open'); if (p.classList.contains('open')) this.refresh(); };
      document.addEventListener('click', (e) => { if (!p.contains(e.target) && e.target !== b) p.classList.remove('open'); });
      this.refresh();
      this.timer = setInterval(() => { if (!document.hidden) this.refresh(); }, 30000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
    },
    async refresh() {
      if (!this.el) return;
      let s; try { s = await api('/api/alerts/summary'); } catch (_) { return; }
      if (!s || !s.success) return;
      const n = s.unacknowledged || 0;
      this.el.classList.toggle('on', n > 0);
      this.el.classList.toggle('warn', n > 0 && !s.critical);
      this.el.querySelector('.n').textContent = n > 99 ? '99+' : n;
      const act = s.active || [];
      const fresh = act.filter(e => !this.last.has(e.id));
      if (this.last.size && fresh.length && localStorage.getItem('shellman_push_alerts') !== 'false' && 'Notification' in window && Notification.permission === 'granted') {
        fresh.forEach(e => { try { new Notification('ShellMan: ' + e.rule_name, { body: e.message, icon: '/static/icons/icon-192.png' }); } catch (_) {} });
      }
      this.last = new Set(act.map(e => e.id));
      this.pop.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem"><b style="font-size:.82rem;color:#f3f5f9">Alerts</b>
        <span><button class="btn btn-secondary sa-btn" id="smbAll">Acknowledge all</button> <button class="btn btn-secondary sa-btn" id="smbOpen">Open</button></span></div>`
        + (act.length ? act.map(e => `<div class="sa-row"><span class="sa-pill ${e.severity === 'critical' ? 'sa-crit' : 'sa-warn'}">${esc(e.severity.toUpperCase())}</span>
            <div class="grow"><div>${esc(e.rule_name)} · ${esc(e.server_name)}</div><div class="sa-sub" title="${esc(e.message)}">${esc(e.message)}</div></div></div>`).join('')
          : '<div class="sa-empty">All clear. No active alerts.</div>');
      this.pop.querySelector('#smbAll').onclick = async () => { await api('/api/alerts/events/ack-all', 'POST', {}); this.refresh(); };
      this.pop.querySelector('#smbOpen').onclick = () => { this.pop.classList.remove('open'); if (window.DesktopApps) DesktopApps.launch('settings', { tab: 'alerts' }); };
    }
  };

  window.ShellmanAlertsUI = ShellmanAlertsUI;
  window.ShellmanAuditUI = ShellmanAuditUI;
  window.ShellmanSecurityUI = ShellmanSecurityUI;
  window.ShellmanBell = ShellmanBell;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ShellmanBell.init());
  else ShellmanBell.init();
})();
