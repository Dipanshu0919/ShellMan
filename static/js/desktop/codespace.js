// GitHub Codespace panel: power (start/stop), time budget with remaining time, and daily usage.
// Opened from Settings → Servers ("Time & Power") or by clicking the chip at the bottom-left of the desktop.
(function () {
  'use strict';
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, k = 'info') => { if (window.showToast) window.showToast(m, k); };
  const api = async (url, method = 'GET', body) => {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let j = {};
    try { const r = await fetch(url, opt); try { j = await r.json(); } catch (_) {} if (!r.ok && !j.error) j.error = 'HTTP ' + r.status; }
    catch (e) { j = { success: false, error: String(e) }; }
    return j;
  };
  const hrs = (min) => (min / 60).toFixed(min >= 600 ? 0 : 1).replace(/\.0$/, '');
  const fmtLeft = (min) => {
    if (min == null) return '';
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  };
  const PERIOD = { day: 'day', week: 'week', month: 'month' };

  if (!document.getElementById('smCsCss')) {
    const st = document.createElement('style');
    st.id = 'smCsCss';
    st.textContent = `
      .cs-box{width:600px;max-width:94vw;max-height:calc(100% - 1.5rem);display:flex;flex-direction:column}
      .cs-body{padding:1rem 1.1rem;overflow:auto;display:flex;flex-direction:column;gap:1rem;font-size:.78rem;color:var(--text-secondary,#c3cad8)}
      .cs-card{border:1px solid var(--border-color,#2f374b);border-radius:10px;padding:.8rem .9rem;background:rgba(255,255,255,.02)}
      .cs-h{font-weight:700;font-size:.82rem;color:var(--text-primary,#f3f5f9);margin-bottom:.45rem;display:flex;justify-content:space-between;align-items:center;gap:.5rem}
      .cs-state{font:700 .66rem/1 var(--font-mono,monospace);padding:.25rem .5rem;border-radius:999px;border:1px solid currentColor;letter-spacing:.05em}
      .cs-on{color:#34d399}.cs-off{color:#94a3b8}.cs-mid{color:#fbbf24}.cs-bad{color:#ff5a67}
      .cs-bar{height:10px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;margin:.45rem 0}
      .cs-bar>i{display:block;height:100%;border-radius:6px;background:#34d399;transition:width .4s}
      .cs-bar.warn>i{background:#fbbf24}.cs-bar.full>i{background:#ff5a67}
      .cs-big{font-size:1.25rem;font-weight:700;color:var(--text-primary,#f3f5f9)}
      .cs-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
      .cs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.55rem;margin:.5rem 0}
      .cs-grid label{display:block;font-size:.68rem;color:var(--text-muted,#939db2);margin-bottom:.2rem}
      .cs-grid .form-control{font-size:.78rem;padding:.35rem .5rem;min-height:30px;width:100%}
      .cs-days{display:flex;align-items:flex-end;gap:2px;height:54px;margin-top:.4rem}
      .cs-days i{flex:1;min-width:3px;background:var(--sm-accent,#38bdf8);border-radius:2px 2px 0 0;opacity:.85}
      .cs-note{font-size:.7rem;color:var(--text-muted,#939db2);line-height:1.4}
      .cs-err{color:#ff8a93;font-size:.74rem;min-height:1em}
      .cs-chip{position:fixed;bottom:18px;left:62px;z-index:9000;height:34px;padding:0 .7rem;border-radius:10px;border:1px solid var(--border-color,#2f374b);background:rgba(15,20,32,.92);color:var(--text-primary,#f3f5f9);font:600 .72rem/1 var(--font-mono,monospace);display:none;align-items:center;gap:.45rem;cursor:pointer}
      .cs-chip:hover{border-color:var(--sm-accent,#38bdf8)}
      .cs-chip .dot{width:8px;height:8px;border-radius:50%;background:#94a3b8}
      .cs-chip.on .dot{background:#34d399}.cs-chip.warn .dot{background:#fbbf24}.cs-chip.full .dot{background:#ff5a67}
    `;
    document.head.appendChild(st);
  }

  const ShellmanCodespace = {
    async repos(token, q) { return api('/api/codespaces/repos', 'POST', { gh_token: token, q }); },
    async machines(token, repo, ref) { return api('/api/codespaces/machines', 'POST', { gh_token: token, repo, ref }); },
    async create(body) { return api('/api/codespaces/create', 'POST', body); },
    async discover(token) {
      return api('/api/codespaces/discover', 'POST', { gh_token: token });
    },

    // ------------------------------------------------------------------ panel
    async openPanel(serverId) {
      const back = document.createElement('div');
      back.className = 'file-modal-backdrop';
      back.innerHTML = `<div class="file-modal-box cs-box">
        <div class="file-modal-header" style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:700;font-size:.88rem;color:#f8fafc">GitHub Codespace: time &amp; power</span>
          <button class="win-btn win-close" data-x>×</button></div>
        <div class="cs-body" data-body><div class="cs-note">Loading…</div></div></div>`;
      document.body.appendChild(back);
      let timer = null;
      const close = () => { clearInterval(timer); back.remove(); this.refreshChip(); };
      back.querySelector('[data-x]').onclick = close;
      back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
      const body = back.querySelector('[data-body]');
      let editing = false;

      const load = async () => {
        const [o, u] = await Promise.all([api(`/api/servers/${serverId}/codespace`), api(`/api/servers/${serverId}/usage?days=31`)]);
        if (!back.isConnected || editing) return;
        this.paint(body, serverId, o, u.days || [], { reload: load, setEditing: (v) => { editing = v; }, close });
      };
      await load();
      timer = setInterval(load, 30000);
    },

    paint(body, serverId, o, days, ctl) {
      const cs = o.codespace, q = o.quota || {};
      const running = !!(cs && cs.available);
      const stateCls = running ? 'cs-on' : (cs && /Starting|Provisioning|Queued|ShuttingDown/.test(cs.state) ? 'cs-mid' : 'cs-off');
      const unit = q.weighted ? 'core-hours' : 'hours';
      let budget;
      if (q.has_limit) {
        const pct = Math.min(100, q.pct || 0);
        const cls = q.exceeded ? 'full' : (q.pct >= (q.limit.warn_pct || 80) ? 'warn' : '');
        budget = `<div class="cs-big">${q.exceeded ? 'Budget used up' : fmtLeft(q.remaining_minutes) + ' left'}</div>
          <div class="cs-bar ${cls}"><i style="width:${pct}%"></i></div>
          <div class="cs-row" style="justify-content:space-between"><span>${hrs(q.used_minutes)} of ${hrs(q.limit_minutes)} ${unit} used this ${PERIOD[q.period]} (${q.pct}%)</span><span class="cs-note">resets ${esc(q.resets_on)}</span></div>
          ${q.bonus_minutes ? `<div class="cs-note">Includes ${hrs(q.bonus_minutes)} extra hours you added.</div>` : ''}
          <div class="cs-row" style="margin-top:.55rem">
            <button class="btn btn-secondary btn-xs" data-ext="1">+1 hour</button>
            <button class="btn btn-secondary btn-xs" data-ext="2">+2 hours</button>
            <button class="btn btn-ghost btn-xs" data-edit>Edit budget</button>
            <button class="btn btn-ghost btn-xs" data-del style="color:#ff8a93">Remove</button></div>`;
      } else {
        budget = `<div class="cs-note">No time budget yet. ShellMan still counts running time (${hrs(q.month_used_minutes || 0)} h this month). Set a budget to see the time left and to stop the Codespace automatically.</div>
          <div class="cs-row" style="margin-top:.5rem"><button class="btn btn-primary btn-xs" data-edit>Set time budget</button></div>`;
      }
      const max = Math.max(1, ...days.map(d => d.minutes));
      const bars = days.length ? days.map(d => `<i title="${esc(d.day)}: ${hrs(d.minutes)} h" style="height:${Math.max(4, Math.round(100 * d.minutes / max))}%"></i>`).join('') : '';
      body.innerHTML = `
        <div class="cs-card">
          <div class="cs-h"><span>${cs ? esc(cs.display_name) : 'Codespace'}</span>${cs ? `<span class="cs-state ${stateCls}">${esc(cs.state.toUpperCase())}</span>` : ''}</div>
          ${cs ? `<div class="cs-note">${esc(cs.repository)} · ${cs.cpus} cores${cs.machine ? ' · ' + esc(cs.machine) : ''}${cs.idle_timeout_minutes ? ' · stops itself after ' + cs.idle_timeout_minutes + ' min idle' : ''}</div>` : ''}
          ${o.error ? `<div class="cs-err">${esc(o.error)}</div>` : ''}
          <div class="cs-row" style="margin-top:.6rem">
            ${running ? `<button class="btn btn-secondary btn-xs" data-stop>Stop</button>` : `<button class="btn btn-primary btn-xs" data-start ${cs ? '' : 'disabled'}>Start</button>`}
            <span class="cs-note">${running ? 'Running time is counted against your budget.' : 'Starting uses your GitHub quota. ShellMan never starts it on its own.'}</span>
          </div>
          <div class="cs-err" data-msg></div>
        </div>
        <div class="cs-card" data-budget><div class="cs-h"><span>Time budget</span></div>${budget}</div>
        <div class="cs-card"><div class="cs-h"><span>Last 31 days</span><span class="cs-note">${hrs(days.reduce((a, d) => a + d.minutes, 0))} h running</span></div>
          ${days.length ? `<div class="cs-days">${bars}</div>` : '<div class="cs-note">No usage recorded yet.</div>'}
          <div class="cs-note" style="margin-top:.5rem">Counted by ShellMan while it is running (checked every minute). GitHub's own billing page is the final number. Storage is billed separately and not included here.</div></div>`;

      const msg = (t) => { const e = body.querySelector('[data-msg]'); if (e) e.textContent = t || ''; };
      const act = async (btn, url, ok) => {
        btn.disabled = true; msg('');
        const r = await api(url, 'POST', {});
        if (r.success) { toast(ok, 'success'); await ctl.reload(); } else { msg(r.error || 'Failed'); btn.disabled = false; }
      };
      const st = body.querySelector('[data-start]'), sp = body.querySelector('[data-stop]');
      if (st) st.onclick = () => act(st, `/api/servers/${serverId}/codespace/start`, 'Codespace is starting. It can take a minute.');
      if (sp) sp.onclick = async () => {
        const ok = window.DesktopModal ? await DesktopModal.confirm({ title: 'Stop Codespace', message: 'Stop this Codespace now? Running terminals and processes in it will end.', confirmText: 'Stop', isDanger: true }) : confirm('Stop this Codespace?');
        if (ok) act(sp, `/api/servers/${serverId}/codespace/stop`, 'Codespace stopped.');
      };
      body.querySelectorAll('[data-ext]').forEach(b => b.onclick = async () => {
        const r = await api(`/api/servers/${serverId}/time-limit/extend`, 'POST', { hours: Number(b.dataset.ext) });
        if (r.success) { toast(`Added ${b.dataset.ext} hour(s) to this ${PERIOD[q.period]}.`, 'success'); ctl.reload(); } else msg(r.error);
      });
      const del = body.querySelector('[data-del]');
      if (del) del.onclick = async () => { const r = await api(`/api/servers/${serverId}/time-limit`, 'DELETE'); if (r.success) ctl.reload(); else msg(r.error); };
      const ed = body.querySelector('[data-edit]');
      if (ed) ed.onclick = () => this.paintForm(body, serverId, q, ctl);
    },

    paintForm(body, serverId, q, ctl) {
      ctl.setEditing(true);
      const l = q.limit || { period: 'month', limit_minutes: 1200, weight_by_cores: true, warn_pct: 80, action: 'stop', enabled: true };
      const holder = body.querySelector('[data-budget]');
      holder.innerHTML = `<div class="cs-h"><span>Time budget</span></div>
        <div class="cs-grid">
          <div><label>Hours allowed</label><input class="form-control" id="csH" type="number" min="0.1" step="0.5" value="${(l.limit_minutes / 60)}"></div>
          <div><label>Per</label><select class="form-control" id="csP"><option value="day">day</option><option value="week">week (Mon–Sun)</option><option value="month">month</option></select></div>
          <div><label>Warn me at (%)</label><input class="form-control" id="csW" type="number" min="1" max="100" value="${l.warn_pct}"></div>
          <div><label>When used up</label><select class="form-control" id="csA"><option value="stop">Stop the Codespace</option><option value="warn">Only notify me</option></select></div>
        </div>
        <label style="display:flex;gap:.4rem;align-items:flex-start;font-size:.76rem"><input type="checkbox" id="csC" ${l.weight_by_cores ? 'checked' : ''} style="margin-top:2px">
          <span>Count core-hours like GitHub does <span class="cs-note">(a 4-core Codespace running 1 hour = 4 core-hours). Untick to count plain hours.</span></span></label>
        <div class="cs-row" style="margin-top:.6rem"><button class="btn btn-primary btn-xs" id="csSave">Save budget</button><button class="btn btn-ghost btn-xs" id="csCancel">Cancel</button></div>
        <div class="cs-err" id="csErr"></div>
        <div class="cs-note">With "Stop", ShellMan stops the Codespace when the budget is reached and will not start or connect to it again until the period resets or you add time. This needs ShellMan's background checks to be on (they are by default).</div>`;
      holder.querySelector('#csP').value = l.period;
      holder.querySelector('#csA').value = l.action;
      holder.querySelector('#csCancel').onclick = () => { ctl.setEditing(false); ctl.reload(); };
      holder.querySelector('#csSave').onclick = async () => {
        const r = await api(`/api/servers/${serverId}/time-limit`, 'PUT', {
          limit_hours: holder.querySelector('#csH').value, period: holder.querySelector('#csP').value,
          warn_pct: holder.querySelector('#csW').value, action: holder.querySelector('#csA').value,
          weight_by_cores: holder.querySelector('#csC').checked, enabled: true });
        if (r.success) { ctl.setEditing(false); toast('Time budget saved.', 'success'); ctl.reload(); }
        else holder.querySelector('#csErr').textContent = r.error || 'Failed';
      };
    },

    // ------------------------------------------------------------------ chip (bottom-left, next to the bell)
    chip: null,
    async refreshChip() {
      const cfg = window.DesktopConfig || {};
      if (cfg.serverKind !== 'codespace' || !cfg.serverId) return;
      if (!this.chip) {
        this.chip = document.createElement('div');
        this.chip.className = 'cs-chip';
        this.chip.title = 'GitHub Codespace: time left, start and stop';
        this.chip.onclick = () => this.openPanel(cfg.serverId);
        document.body.appendChild(this.chip);
      }
      const o = await api(`/api/servers/${cfg.serverId}/codespace`);
      const cs = o.codespace, q = o.quota || {};
      let cls = '', text;
      if (!cs) text = 'Codespace: ' + (o.error ? 'check token' : '…');
      else if (!cs.available) text = 'Codespace ' + cs.state.toLowerCase() + ' · Start';
      else if (q.has_limit) { cls = q.exceeded ? 'full' : (q.pct >= (q.limit.warn_pct || 80) ? 'warn' : 'on'); text = q.exceeded ? 'Budget used up' : fmtLeft(q.remaining_minutes) + ' left'; }
      else { cls = 'on'; text = 'Codespace running'; }
      this.chip.className = 'cs-chip ' + cls;
      this.chip.style.display = 'flex';
      this.chip.innerHTML = `<span class="dot"></span>${esc(text)}`;
    },
    init() {
      const cfg = window.DesktopConfig || {};
      if (cfg.serverKind !== 'codespace') return;
      this.refreshChip();
      setInterval(() => this.refreshChip(), 60000);
    }
  };

  window.ShellmanCodespace = ShellmanCodespace;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ShellmanCodespace.init());
  else ShellmanCodespace.init();
})();
