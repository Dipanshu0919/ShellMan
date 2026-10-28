/**
 * ShellMan: light / dark theme (theme.js)
 * Mode is "dark", "light" or "system" and lives in localStorage "shellman_theme". The page sets data-theme on <html>
 * before first paint (small inline script in each template); this file owns changes after that: the 3D sun/moon switch,
 * a circular reveal that grows from the switch, icons flipping in 3D, accent and editor colors following the mode.
 */
(function () {
  if (window.ShellmanTheme) return;
  const KEY = 'shellman_theme';
  const root = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stored = () => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'system' ? v : 'dark'; } catch (_) { return 'dark'; } };
  const resolve = (mode) => mode === 'system' ? (mq && mq.matches ? 'light' : 'dark') : mode;
  let mode = stored();

  const syncSwitches = (applied) => document.querySelectorAll('.sm-tt').forEach(b => {
    b.dataset.mode = applied; b.setAttribute('aria-checked', applied === 'light' ? 'true' : 'false');
    b.title = applied === 'light' ? 'Light mode. Click for dark' : 'Dark mode. Click for light';
  });

  // everything that is not plain CSS and must follow the mode
  const sideEffects = (applied) => {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', applied === 'light' ? '#e9edf4' : '#090b10');
    if (window.applyAccentColor) { try { window.applyAccentColor(localStorage.getItem('shellman_accent') || 'cyan'); } catch (_) {} }
    try { if (window.monaco && window.monaco.editor) window.monaco.editor.setTheme(applied === 'light' ? 'vs' : 'vs-dark'); } catch (_) {}
    syncSwitches(applied);
    try { window.dispatchEvent(new CustomEvent('shellman-theme', { detail: { theme: applied, mode } })); } catch (_) {}
  };

  const applyNow = (applied) => { root.setAttribute('data-theme', applied); sideEffects(applied); };

  // stagger index so the dock, icons and widgets flip one after another
  const tagFlip = () => {
    let i = 0;
    document.querySelectorAll('.dock-item, .desktop-icon, .widget-card').forEach(el => { el.style.setProperty('--i', String(i++ % 24)); });
  };

  let busy = false;
  const change = (nextMode, origin) => {
    const next = resolve(nextMode);
    const cur = root.getAttribute('data-theme');
    mode = nextMode;
    try { localStorage.setItem(KEY, mode); } catch (_) {}
    if (next === cur) { sideEffects(next); return; }
    if (busy) { applyNow(next); return; }
    if (reduced()) { applyNow(next); return; }

    let x = innerWidth / 2, y = innerHeight / 2;
    if (origin && origin.getBoundingClientRect) { const r = origin.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    busy = true;
    tagFlip(); root.classList.add('sm-flip');
    const done = () => { busy = false; setTimeout(() => root.classList.remove('sm-flip'), 1300); };

    if (document.startViewTransition) {
      const vt = document.startViewTransition(() => applyNow(next));
      vt.ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(() => {});
      vt.finished.then(done, done);
    } else {
      root.style.transition = 'background-color .5s ease, color .5s ease';
      applyNow(next);
      setTimeout(() => { root.style.transition = ''; }, 600);
      done();
    }
  };

  // ---- the switch -------------------------------------------------------------------------------------------------
  const switchHtml = () => `
    <span class="sm-tt-tilt">
      <span class="sm-tt-track"><svg class="sm-tt-ic sm-tt-ic-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="sm-tt-ic sm-tt-ic-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></span>
      <span class="sm-tt-knob"><span class="sm-tt-face sm-tt-sun"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></span><span class="sm-tt-face sm-tt-moon"><svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></span></span>
    </span>`;

  const build = () => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sm-tt'; b.setAttribute('role', 'switch'); b.setAttribute('aria-label', 'Light or dark mode');
    b.dataset.mode = root.getAttribute('data-theme') || 'dark';
    b.innerHTML = switchHtml();
    b.addEventListener('click', (e) => change(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', b));
    // the whole switch leans toward the pointer
    const tilt = b.querySelector('.sm-tt-tilt');
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width - .5), py = ((e.clientY - r.top) / r.height - .5);
      tilt.style.transform = `rotateX(${(-py * 22).toFixed(1)}deg) rotateY(${(px * 26).toFixed(1)}deg)`;
    });
    b.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
    return b;
  };

  const mount = () => {
    const slots = document.querySelectorAll('[data-theme-toggle]');
    slots.forEach(s => { if (!s.querySelector('.sm-tt')) s.appendChild(build()); });
    if (!slots.length && !document.querySelector('.sm-tt') && !document.getElementById('themeToggle')) {
      const f = document.createElement('div'); f.className = 'sm-tt-float'; f.appendChild(build()); document.body.appendChild(f);
    }
    syncSwitches(root.getAttribute('data-theme') || 'dark');
  };

  if (mq && mq.addEventListener) mq.addEventListener('change', () => { if (mode === 'system') applyNow(resolve('system')); });
  window.addEventListener('storage', (e) => { if (e.key === KEY) { mode = stored(); applyNow(resolve(mode)); } });

  window.ShellmanTheme = {
    get: () => root.getAttribute('data-theme') || 'dark',
    mode: () => mode,
    set: (m, origin) => change(m === 'light' || m === 'system' ? m : 'dark', origin),
    toggle: (origin) => change(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', origin),
    monacoTheme: () => (root.getAttribute('data-theme') === 'light' ? 'vs' : 'vs-dark'),
    mount
  };

  // first paint already set data-theme; make sure it agrees with the stored mode (system may have changed)
  const first = resolve(mode);
  if (root.getAttribute('data-theme') !== first) root.setAttribute('data-theme', first);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { mount(); sideEffects(first); });
  else { mount(); sideEffects(first); }
})();
