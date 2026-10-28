/**
 * ShellMan Request Manager (requests.js)
 *
 * One place that makes every operation cancellable so nothing can block the UI or the server:
 *
 *  - Every /api/ fetch gets an X-Request-Id and is tracked while in flight.
 *  - Closing a window aborts everything that window started (RequestScope).
 *  - Pressing X / Cancel / Esc on a dialog aborts everything that dialog started.
 *  - Anything running longer than 2s shows up in the "Running" panel with its own cancel button.
 *  - Aborting also tells the server (POST /api/tasks/<id>/cancel); the server kills the remote
 *    job and frees the per-server lock (see services/ssh_manager.py).
 *
 * Aborts that come from a window / dialog / the panel are silent: the pending promise never
 * settles, so the caller's error toasts do not fire for something the user cancelled.
 * An abort the caller asked for with its own AbortSignal still rejects with AbortError.
 */
(function () {
  if (window.RequestScope) return;

  const origFetch = window.fetch.bind(window);
  const MODAL_SEL = '.file-modal-backdrop,.desktop-modal-backdrop,.modal-overlay,.server-modal-backdrop,.cmd-palette-backdrop,.quick-open-overlay';
  const SLOW_MS = 2000;
  const inflight = new Map();   // id -> entry
  let seq = 0;
  let pendingScope = null;      // handed to the next WindowManager.createWindow()

  const sendCancel = (id) => {
    try {
      origFetch(`/api/tasks/${encodeURIComponent(id)}/cancel`, { method: 'POST', keepalive: true, credentials: 'same-origin' }).catch(() => {});
    } catch (_) {}
  };

  const isApi = (input) => {
    if (typeof input !== 'string') return false;
    try {
      const u = new URL(input, location.href);
      if (u.origin !== location.origin || !u.pathname.startsWith('/api/')) return false;
      return !/\/cancel$|\/progress$/.test(u.pathname);
    } catch (_) { return false; }
  };

  const label = (method, url) => {
    const p = new URL(url, location.href).pathname;
    const map = [
      [/batch-archive/, 'Compressing'], [/files\/extract/, 'Extracting'], [/files\/upload/, 'Uploading'],
      [/batch-copy/, 'Copying'], [/batch-move/, 'Moving'], [/batch-delete|files\/delete/, 'Deleting'],
      [/files\/search/, 'Searching files'], [/search-code/, 'Searching code'], [/files\/save/, 'Saving file'],
      [/files\/list/, 'Listing folder'], [/docker\/compose/, 'Docker Compose'], [/docker/, 'Docker'],
      [/nginx\/ssl/, 'SSL / Certbot'], [/nginx/, 'Nginx'], [/git\/clone/, 'Git clone'], [/git\/pull/, 'Git pull'],
      [/\/git\//, 'Git'], [/sync\/execute/, 'Rsync sync'], [/sync\//, 'Sync preview'], [/database/, 'Database'],
      [/firewall/, 'Firewall'], [/cron/, 'Cron'], [/ssh\/benchmark/, 'SSH benchmark'], [/ssh\//, 'SSH diagnostics'],
      [/logs/, 'Reading logs'], [/services/, 'Services'], [/processes/, 'Processes'], [/network/, 'Network'],
      [/\/test$/, 'Testing SSH'], [/domains/, 'Cloudflare'], [/power/, 'Power action'], [/settings/, 'Settings']
    ];
    for (const [re, name] of map) if (re.test(p)) return name;
    return `${method} ${p.split('/').slice(-2).join('/')}`;
  };

  // ── Who started a request? ───────────────────────────────────────────────
  const eventTarget = () => {
    const ev = window.event;
    return (ev && ev.target instanceof Element) ? ev.target : (document.activeElement instanceof Element ? document.activeElement : null);
  };
  const modalOf = (el) => (el && el.closest ? el.closest(MODAL_SEL) : null);
  const scopeOfEl = (el) => {
    try {
      const winEl = el && el.closest ? el.closest('.desktop-window') : null;
      if (!winEl || !window.WindowManager) return null;
      for (const w of window.WindowManager.windows.values()) if (w.el === winEl) return w.scope || null;
    } catch (_) {}
    return null;
  };

  // ── Tracked fetch ────────────────────────────────────────────────────────
  function trackedFetch(scope, input, init) {
    init = init || {};
    if (!isApi(input)) return origFetch(input, init);

    const el = eventTarget();
    scope = scope || scopeOfEl(el);
    if (scope && scope.aborted) return new Promise(() => {});   // window already closed: stay silent

    const id = 'rq_' + Date.now().toString(36) + '_' + (++seq);
    const ctl = new AbortController();
    const userSignal = init.signal;
    const entry = {
      id, ctl, scope, modal: modalOf(el), dead: false, started: Date.now(),
      label: label((init.method || 'GET').toUpperCase(), input)
    };

    if (userSignal) {
      if (userSignal.aborted) { ctl.abort(); sendCancel(id); }
      else userSignal.addEventListener('abort', () => { ctl.abort(); sendCancel(id); }, { once: true });
    }

    const headers = new Headers(init.headers || {});
    headers.set('X-Request-Id', id);
    inflight.set(id, entry);
    if (scope) scope.entries.add(entry);
    schedulePanel();

    return new Promise((resolve, reject) => {
      const done = () => { inflight.delete(id); if (scope) scope.entries.delete(entry); schedulePanel(); };
      origFetch(input, Object.assign({}, init, { headers, signal: ctl.signal })).then(
        (r) => { done(); if (!entry.dead) resolve(r); },
        (e) => { done(); if (!entry.dead) reject(e); }
      );
    });
  }

  function abortEntry(entry) {
    if (!entry || entry.dead) return;
    entry.dead = true;                 // silent: caller's promise never settles
    try { entry.ctl.abort(); } catch (_) {}
    sendCancel(entry.id);
    inflight.delete(entry.id);
    if (entry.scope) entry.scope.entries.delete(entry);
    schedulePanel();
  }

  window.fetch = function (input, init) { return trackedFetch(null, input, init); };

  // ── Scopes (one per window) ──────────────────────────────────────────────
  const RequestScope = {
    /** Call right before WindowManager.createWindow(): `const fetch = RequestScope.next();` */
    next() {
      const scope = { entries: new Set(), aborted: false };
      scope.fetch = (input, init) => trackedFetch(scope, input, init);
      pendingScope = scope;
      return scope.fetch;
    },
    takePending() { const s = pendingScope; pendingScope = null; return s; },
    discardPending() { pendingScope = null; },
    abortScope(scope) {
      if (!scope || scope.aborted) return;
      scope.aborted = true;
      Array.from(scope.entries).forEach(abortEntry);
    },
    abortModal(modalEl) {
      Array.from(inflight.values()).filter(e => e.modal === modalEl).forEach(abortEntry);
    },
    abortAll() { Array.from(inflight.values()).forEach(abortEntry); },
    cancelTask(taskId) { sendCancel(taskId); },
    inflight
  };
  window.RequestScope = RequestScope;

  // ── Dialog dismiss = cancel everything that dialog started ───────────────
  const isDismissControl = (t) => {
    if (!t) return false;
    const id = t.id || '';
    if (/^(mClose|mCancel)_/.test(id) || /close|cancel|dismiss/i.test(id)) return true;
    if (t.matches('.modal-close,.win-close,[data-dismiss],[aria-label="Close"],[aria-label="Cancel"],[data-action="cancel"],[data-action="close"]')) return true;
    const txt = (t.textContent || '').trim().toLowerCase();
    return ['×', '✕', 'x', 'cancel', 'close', 'dismiss'].includes(txt);
  };

  document.addEventListener('click', (e) => {
    const m = e.target instanceof Element ? e.target.closest(MODAL_SEL) : null;
    if (!m) return;
    const btn = e.target.closest('button,[role="button"],a,.win-btn');
    if (e.target === m || isDismissControl(btn)) RequestScope.abortModal(m);
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const all = document.querySelectorAll(MODAL_SEL);
    if (all.length) RequestScope.abortModal(all[all.length - 1]);
  }, true);

  // ── "Running" panel: anything slower than 2s gets a cancel button ────────
  let panel = null, timer = null;
  const css = `
    #smBusy{position:fixed;right:16px;bottom:calc(var(--sm-dock-h,88px) + 16px);z-index:99990;display:none;flex-direction:column;gap:6px;max-width:min(360px,calc(100vw - 32px));font-family:var(--font-sans,system-ui)}
    #smBusy .sm-busy-row{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 12px;background:rgba(var(--panel-rgb),.94);border:1px solid rgba(var(--wash),.12);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.55);backdrop-filter:blur(10px);color:var(--text-secondary);font-size:.74rem}
    #smBusy .sm-busy-dollar{font:700 .9rem/1 var(--font-mono,ui-monospace,monospace);color:var(--sm-accent,var(--c-teal));animation:smBusyBlink 1s steps(2) infinite}
    #smBusy .sm-busy-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #smBusy .sm-busy-time{font:600 .68rem/1 var(--font-mono,ui-monospace,monospace);color:var(--text-muted)}
    #smBusy button{border:0;background:rgba(var(--wash),.08);color:var(--text-secondary);width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:.95rem;line-height:1}
    #smBusy button:hover{background:#7f1d1d;color:#fff}
    #smBusy .sm-busy-all{align-self:flex-end;width:auto;padding:0 10px;height:24px;font-size:.7rem}
    @keyframes smBusyBlink{50%{opacity:.25}}
    @media (prefers-reduced-motion:reduce){#smBusy .sm-busy-dollar{animation:none}}`;

  const ensurePanel = () => {
    if (panel) return panel;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    panel = document.createElement('div');
    panel.id = 'smBusy';
    panel.setAttribute('role', 'status');
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.all) RequestScope.abortAll();
      else abortEntry(inflight.get(b.dataset.id));
    });
    document.body.appendChild(panel);
    return panel;
  };

  const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function paint() {
    timer = null;
    const now = Date.now();
    const slow = Array.from(inflight.values()).filter(e => now - e.started >= SLOW_MS);
    if (!slow.length) {
      if (panel) panel.style.display = 'none';
      if (inflight.size) timer = setTimeout(paint, 500);
      return;
    }
    ensurePanel();
    panel.style.display = 'flex';
    panel.innerHTML = slow.slice(0, 5).map(e =>
      `<div class="sm-busy-row"><span class="sm-busy-dollar">$</span><span class="sm-busy-name">${esc(e.label)}</span><span class="sm-busy-time">${Math.round((now - e.started) / 1000)}s</span><button type="button" data-id="${esc(e.id)}" title="Cancel" aria-label="Cancel ${esc(e.label)}">&times;</button></div>`
    ).join('') + (slow.length > 1 ? `<button type="button" class="sm-busy-all" data-all="1">Cancel all (${slow.length})</button>` : '');
    timer = setTimeout(paint, 1000);
  }
  function schedulePanel() {
    if (timer) return;
    timer = setTimeout(paint, 400);
  }
})();