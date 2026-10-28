/* ShellMan — virtual desktops ("workspaces") with an optional 3D cube / slide switch.
 *
 *  - Every window belongs to one workspace; windows of other workspaces are hidden, not destroyed.
 *  - Ctrl+Alt+Left/Right  switch      Ctrl+Alt+1..9  jump      Ctrl+Alt+Shift+Left/Right  carry the active window along
 *  - Right-click a window title bar -> "Move to workspace".  The pill at the top centre also switches.
 *  - The animation is the "workspace" effect (Settings -> Appearance -> Effects). Off = instant switch.
 *  - Settings: shellman_ws {count: 2..6, mode: 'cube' | 'slide'}
 */
(function () {
  'use strict';
  if (window.Workspaces) return;

  const KEY = 'shellman_ws';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (_) { return {}; } };
  const cfg = Object.assign({ count: 4, mode: 'cube' }, read());
  cfg.count = Math.min(6, Math.max(2, parseInt(cfg.count, 10) || 4));
  cfg.mode = cfg.mode === 'slide' ? 'slide' : 'cube';
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) {} };

  const WM = () => window.WindowManager;
  const FXon = () => !!(window.ShellmanFX && window.ShellmanFX.on('workspace'));
  const light = () => !!(window.ShellmanFX && window.ShellmanFX.quality() === 'light');

  let cur = 0;
  let running = null;      // { anims, done() } while a transition plays
  let pill = null, label = null, labelT = 0, menu = null;

  const wins = () => { const m = WM(); return m ? Array.from(m.windows.values()) : []; };
  const wsOf = (w) => Math.min(cfg.count - 1, Math.max(0, w.ws || 0));
  const onWs = (n) => wins().filter(w => wsOf(w) === n);

  // ---------------- visibility ----------------
  function applyVisibility() {
    wins().forEach(w => {
      w.ws = wsOf(w);
      w.el.classList.toggle('ws-hidden', w.ws !== cur);
    });
    renderPill();
  }

  function focusTop() {
    const m = WM(); if (!m) return;
    let best = null, z = -1;
    onWs(cur).forEach(w => {
      if (w.isMinimized || w.isClosing) return;
      const zi = parseInt(w.el.style.zIndex || 0, 10);
      if (zi > z) { z = zi; best = w; }
    });
    if (best) m.focusWindow(best.id); else m.unfocusAll();
  }

  function refit(list) {
    setTimeout(() => list.forEach(w => { if (typeof w.onResize === 'function' && !w.isMinimized) { try { w.onResize(w.el.offsetWidth, w.el.offsetHeight); } catch (_) {} } }), 60);
  }

  // ---------------- transition ----------------
  function finishRunning() { if (running) { const r = running; running = null; r.done(); } }

  function animate(from, to, dir) {
    const c = WM().container;
    const out = onWs(from).filter(w => !w.isMinimized);
    const inn = onWs(to).filter(w => !w.isMinimized);
    if (!c || !c.animate || (!out.length && !inn.length)) return false;

    const W = c.clientWidth || window.innerWidth, H = c.clientHeight || window.innerHeight;
    const dur = light() ? 380 : 640;
    const ease = 'cubic-bezier(.7,0,.25,1)';
    const mode = cfg.mode;
    const anims = [];
    const all = out.concat(inn);

    c.style.perspective = (mode === 'cube' ? 1900 : 1500) + 'px';
    c.style.overflow = 'hidden';
    inn.forEach(w => w.el.classList.remove('ws-hidden'));

    all.forEach(w => {
      const el = w.el;
      el.classList.add('ws-moving');
      if (mode === 'cube') el.style.transformOrigin = (W / 2 - el.offsetLeft) + 'px ' + (H / 2 - el.offsetTop) + 'px ' + (-W / 2) + 'px';
    });

    const play = (w, a, b) => { anims.push(w.el.animate([a, b], { duration: dur, easing: ease, fill: 'both' })); };

    if (mode === 'cube') {
      out.forEach(w => play(w, { rotate: '0 1 0 0deg', opacity: 1 }, { rotate: '0 1 0 ' + (-dir * 90) + 'deg', opacity: .25 }));
      inn.forEach(w => play(w, { rotate: '0 1 0 ' + (dir * 90) + 'deg', opacity: .25 }, { rotate: '0 1 0 0deg', opacity: 1 }));
    } else {
      out.forEach(w => play(w, { translate: '0 0 0', rotate: '0 1 0 0deg', scale: 1, opacity: 1 }, { translate: (-dir * W * .7) + 'px 0 -240px', rotate: '0 1 0 ' + (dir * 34) + 'deg', scale: .92, opacity: 0 }));
      inn.forEach(w => play(w, { translate: (dir * W * .7) + 'px 0 -240px', rotate: '0 1 0 ' + (-dir * 34) + 'deg', scale: .92, opacity: 0 }, { translate: '0 0 0', rotate: '0 1 0 0deg', scale: 1, opacity: 1 }));
    }

    const done = () => {
      anims.forEach(a => { try { a.cancel(); } catch (_) {} });
      all.forEach(w => { w.el.classList.remove('ws-moving'); w.el.style.transformOrigin = ''; });
      c.style.perspective = ''; c.style.overflow = '';
      applyVisibility();
      refit(inn);
    };
    running = { done };
    const last = anims[anims.length - 1];
    const fin = () => { if (running && running.done === done) { running = null; done(); focusTop(); } };
    if (last) { last.onfinish = fin; last.oncancel = () => {}; } else fin();
    return true;
  }

  function go(n, opts) {
    n = Math.min(cfg.count - 1, Math.max(0, n | 0));
    if (n === cur) { bump(); return false; }
    finishRunning();
    const from = cur, dir = n > from ? 1 : -1;
    cur = n;
    const reduce = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
    let played = false;
    if (FXon() && !reduce && !(opts && opts.instant)) played = animate(from, n, dir);
    if (!played) { applyVisibility(); focusTop(); refit(onWs(n)); }
    else renderPill();
    flash();
    try { window.dispatchEvent(new CustomEvent('shellman-workspace', { detail: { index: cur, count: cfg.count, from: from } })); } catch (_) {}
    return true;
  }

  function moveWindow(id, n, follow) {
    const m = WM(); const w = m && m.windows.get(id); if (!w) return;
    n = Math.min(cfg.count - 1, Math.max(0, n | 0));
    if (wsOf(w) === n) return;
    w.ws = n;
    if (follow) { go(n); } else { applyVisibility(); if (m.activeWindowId === id) focusTop(); }
    renderPill();
  }

  // ---------------- pill ----------------
  function buildPill() {
    const host = document.getElementById('desktopWorkspace') || document.body;
    pill = document.createElement('div');
    pill.id = 'wsPill'; pill.className = 'ws-pill';
    pill.setAttribute('role', 'tablist');
    host.appendChild(pill);
    pill.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ws]'); if (b) go(parseInt(b.dataset.ws, 10));
    });
    renderPill();
  }

  function renderPill() {
    if (!pill) return;
    let h = '';
    for (let i = 0; i < cfg.count; i++) {
      const n = onWs(i).length;
      h += '<button type="button" class="ws-dot' + (i === cur ? ' on' : '') + (n ? ' has' : '') + '" data-ws="' + i + '" title="Workspace ' + (i + 1) + (n ? ' · ' + n + ' window' + (n > 1 ? 's' : '') : ' · empty') + '" role="tab" aria-selected="' + (i === cur) + '"><span>' + (i + 1) + '</span></button>';
    }
    h += '<em class="ws-label" id="wsLabel"></em>';
    pill.innerHTML = h;
    label = pill.querySelector('#wsLabel');
  }

  function flash() {
    if (!pill || !label) return;
    label.textContent = 'Workspace ' + (cur + 1);
    pill.classList.add('show');
    clearTimeout(labelT);
    labelT = setTimeout(() => pill && pill.classList.remove('show'), 1300);
  }
  function bump() { if (!pill) return; pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }

  // ---------------- title-bar menu ----------------
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu(x, y, w) {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'ws-menu';
    let h = '<div class="ws-menu-h">Move to workspace</div>';
    for (let i = 0; i < cfg.count; i++) {
      h += '<button type="button" data-to="' + i + '"' + (wsOf(w) === i ? ' disabled' : '') + '><b>' + (i + 1) + '</b> Workspace ' + (i + 1) + (wsOf(w) === i ? ' (here)' : '') + '</button>';
    }
    menu.innerHTML = h;
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
    menu.style.top = Math.max(6, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-to]'); if (!b || b.disabled) return;
      const to = parseInt(b.dataset.to, 10); closeMenu(); moveWindow(w.id, to, false);
    });
  }
  document.addEventListener('contextmenu', (e) => {
    const bar = e.target.closest && e.target.closest('.window-titlebar, .desktop-window-header, .window-header');
    if (!bar) return;
    const winEl = bar.closest('.desktop-window'); if (!winEl) return;
    const w = wins().find(x => x.el === winEl); if (!w) return;
    e.preventDefault(); e.stopPropagation();
    openMenu(e.clientX, e.clientY, w);
  }, true);
  document.addEventListener('pointerdown', (e) => { if (menu && !menu.contains(e.target)) closeMenu(); }, true);
  window.addEventListener('blur', closeMenu);

  // ---------------- keyboard ----------------
  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !e.altKey || e.metaKey) return;
    let handled = true;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const d = e.key === 'ArrowRight' ? 1 : -1;
      if (e.shiftKey) {
        const m = WM(); const id = m && m.activeWindowId; const t = cur + d;
        if (id && t >= 0 && t < cfg.count) moveWindow(id, t, true); else bump();
      } else go(cur + d);
    } else if (/^Digit[1-9]$/.test(e.code)) {
      const i = parseInt(e.code.slice(5), 10) - 1;
      if (i < cfg.count) go(i);
    } else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // ---------------- settings rows (called by the Effects card) ----------------
  function settingsHtml() {
    return '<div class="fx-row" style="cursor:default;"><span class="fx-txt"><b>Virtual desktops</b><small>Workspaces hold their own windows. Ctrl+Alt+←/→ switches, Ctrl+Alt+Shift+←/→ carries the active window, right-click a title bar to move it.</small></span>' +
      '<span style="display:flex;gap:.4rem;flex:0 0 auto;">' +
      '<select class="form-control" id="wsCount" style="font-size:.75rem;padding:.25rem .5rem;width:auto;">' + [2, 3, 4, 5, 6].map(n => '<option value="' + n + '"' + (cfg.count === n ? ' selected' : '') + '>' + n + ' desktops</option>').join('') + '</select>' +
      '<select class="form-control" id="wsMode" style="font-size:.75rem;padding:.25rem .5rem;width:auto;"><option value="cube"' + (cfg.mode === 'cube' ? ' selected' : '') + '>3D cube</option><option value="slide"' + (cfg.mode === 'slide' ? ' selected' : '') + '>3D slide</option></select></span></div>';
  }
  function bindSettings(root) {
    const c = root.querySelector('#wsCount'), m = root.querySelector('#wsMode');
    if (c) c.onchange = () => { setCount(parseInt(c.value, 10)); };
    if (m) m.onchange = () => { cfg.mode = m.value === 'slide' ? 'slide' : 'cube'; save(); };
  }
  function setCount(n) {
    n = Math.min(6, Math.max(2, n | 0)); finishRunning();
    cfg.count = n; save();
    if (cur >= n) cur = n - 1;
    applyVisibility();
  }

  // ---------------- styles ----------------
  const st = document.createElement('style');
  st.textContent =
    '.desktop-window.ws-hidden{visibility:hidden!important;pointer-events:none!important}' +
    '.desktop-window.ws-moving{backface-visibility:hidden;pointer-events:none!important;will-change:transform,opacity}' +
    '.ws-pill{position:absolute;left:0;right:0;margin:0 auto;width:fit-content;top:10px;z-index:40;display:flex;align-items:center;gap:4px;padding:4px;border-radius:999px;background:rgba(var(--inset-rgb,15,23,42),.72);border:1px solid rgba(var(--wash,255,255,255),.12);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);opacity:.45;transition:opacity .2s}' +
    '.ws-pill:hover,.ws-pill.show{opacity:1}' +
    '.ws-dot{position:relative;width:24px;height:24px;border-radius:50%;border:0;padding:0;background:transparent;color:var(--text-muted);font:600 .68rem var(--font-mono,monospace);cursor:pointer;transition:background .15s,color .15s}' +
    '.ws-dot:hover{background:rgba(var(--wash,255,255,255),.12);color:var(--text-primary)}' +
    '.ws-dot.on{background:var(--sm-accent,#38bdf8);color:#04121f}' +
    '.ws-dot.has:not(.on)::after{content:"";position:absolute;left:50%;bottom:2px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--sm-accent,#38bdf8)}' +
    '.ws-label{font-style:normal;font-size:.7rem;color:var(--text-primary);max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .25s,padding .25s}' +
    '.ws-pill.show .ws-label{max-width:120px;padding:0 10px 0 6px}' +
    '.ws-pill.bump{animation:wsBump .28s}@keyframes wsBump{0%,100%{transform:none}30%{transform:translateX(-4px)}65%{transform:translateX(4px)}}' +
    '.ws-menu{position:fixed;z-index:100000;min-width:190px;padding:5px;border-radius:10px;background:rgba(var(--panel-rgb,15,23,42),.97);border:1px solid rgba(var(--wash,255,255,255),.14);box-shadow:0 12px 32px rgba(0,0,0,.45)}' +
    '.ws-menu-h{padding:5px 9px 6px;font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)}' +
    '.ws-menu button{display:flex;align-items:center;gap:8px;width:100%;padding:6px 9px;border:0;border-radius:6px;background:transparent;color:var(--text-primary);font-size:.78rem;text-align:left;cursor:pointer}' +
    '.ws-menu button b{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:rgba(var(--wash,255,255,255),.12);font:600 .65rem var(--font-mono,monospace)}' +
    '.ws-menu button:hover:not(:disabled){background:rgba(var(--wash,255,255,255),.1)}.ws-menu button:disabled{opacity:.45;cursor:default}' +
    '@media (prefers-reduced-motion:reduce){.ws-pill.bump{animation:none}}';
  document.head.appendChild(st);

  window.Workspaces = {
    get current() { return cur; },
    get count() { return cfg.count; },
    get mode() { return cfg.mode; },
    go, next: () => go(cur + 1), prev: () => go(cur - 1),
    moveWindow, setCount, settingsHtml, bindSettings, refresh: applyVisibility
  };

  const boot = () => { if (!pill) buildPill(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 800);
})();
