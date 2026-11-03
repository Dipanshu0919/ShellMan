/* ShellMan dropdowns: every <select> opens the same styled list as the repository picker, instead of the browser's own
   grey popup. The real <select> stays in place (so layout, value, disabled, form submit and onchange all keep working);
   we only replace the popup. Opt out with data-native, multi-selects and list boxes are left alone. */
(function () {
  'use strict';
  let list = null, owner = null, items = [], active = -1, typed = '', typedAt = 0;

  const eligible = (s) => s && s.tagName === 'SELECT' && !s.multiple && !(s.size > 1) && !s.disabled && !s.hasAttribute('data-native');

  function close() {
    if (!list) return;
    list.remove(); list = null;
    if (owner) { owner.classList.remove('sm-sel-open'); owner.setAttribute('aria-expanded', 'false'); }
    owner = null; items = []; active = -1;
  }

  function setActive(i, scroll) {
    if (!items.length) return;
    active = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((el, n) => el.classList.toggle('active', n === active));
    if (scroll !== false) items[active].scrollIntoView({ block: 'nearest' });
  }

  function choose(opt) {
    const s = owner;
    if (!s || !opt || opt.disabled) return;
    const changed = s.value !== opt.value || s.selectedIndex !== opt.index;
    s.selectedIndex = opt.index;
    close();
    s.focus({ preventScroll: true });
    if (changed) {
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function open(s) {
    close();
    owner = s;
    s.classList.add('sm-sel-open'); s.setAttribute('aria-expanded', 'true');
    list = document.createElement('div');
    list.className = 'sm-sel-list';
    list.setAttribute('role', 'listbox');
    items = [];
    const add = (opt, indent) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sm-combo-item sm-sel-item' + (opt.index === s.selectedIndex ? ' selected' : '');
      b.setAttribute('role', 'option'); b.disabled = opt.disabled;
      if (indent) b.style.paddingLeft = '1.1rem';
      b.innerHTML = '<span></span><i class="sm-sel-tick" aria-hidden="true"></i>';
      b.firstChild.textContent = opt.text;
      b.onmousemove = () => { const n = items.indexOf(b); if (n !== active) setActive(n, false); };
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); choose(opt); };
      b._opt = opt;
      list.appendChild(b);
      if (!opt.disabled) items.push(b);
    };
    Array.from(s.children).forEach((node) => {
      if (node.tagName === 'OPTGROUP') {
        const h = document.createElement('div'); h.className = 'sm-sel-group'; h.textContent = node.label; list.appendChild(h);
        Array.from(node.children).forEach((o) => add(o, true));
      } else if (node.tagName === 'OPTION') add(node, false);
    });
    if (!items.length) { list.innerHTML = '<div class="sm-combo-empty">No options</div>'; }

    const host = document.fullscreenElement || document.body;
    host.appendChild(list);
    const r = s.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth;
    list.style.minWidth = r.width + 'px';
    list.style.maxWidth = Math.min(420, vw - 16) + 'px';
    const lh = Math.min(list.scrollHeight + 10, 300);
    const below = vh - r.bottom - 10, above = r.top - 10;
    const up = below < Math.min(lh, 160) && above > below;      // not enough room below: open upwards
    list.style.maxHeight = Math.max(100, Math.min(300, up ? above : below)) + 'px';
    const left = Math.max(8, Math.min(vw - list.offsetWidth - 8, r.left));
    list.style.left = left + 'px';
    if (up) { list.style.bottom = (vh - r.top + 4) + 'px'; list.style.top = 'auto'; list.style.transformOrigin = 'bottom'; }
    else { list.style.top = (r.bottom + 4) + 'px'; }
    const cur = items.findIndex((el) => el._opt.index === s.selectedIndex);
    setActive(cur >= 0 ? cur : 0);
  }

  // open on click (the native popup is suppressed)
  document.addEventListener('mousedown', (e) => {
    if (list && list.contains(e.target)) return;
    const s = e.target.closest && e.target.closest('select');
    if (s && eligible(s)) {
      e.preventDefault();
      if (owner === s) { close(); return; }
      s.focus({ preventScroll: true });
      open(s);
      return;
    }
    close();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (list) {
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); const s = owner; close(); if (s) s.focus(); return; }
      if (k === 'ArrowDown') { e.preventDefault(); setActive(active + 1); return; }
      if (k === 'ArrowUp') { e.preventDefault(); setActive(active - 1); return; }
      if (k === 'Home') { e.preventDefault(); setActive(0); return; }
      if (k === 'End') { e.preventDefault(); setActive(items.length - 1); return; }
      if (k === 'Enter' || k === ' ') { e.preventDefault(); if (items[active]) choose(items[active]._opt); return; }
      if (k === 'Tab') { close(); return; }
      if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {         // type to jump
        const now = Date.now(); typed = (now - typedAt > 700 ? '' : typed) + k.toLowerCase(); typedAt = now;
        const hit = items.findIndex((el) => el._opt.text.trim().toLowerCase().startsWith(typed));
        if (hit >= 0) setActive(hit);
      }
      return;
    }
    const s = document.activeElement;
    if (s && eligible(s) && (e.key === 'Enter' || e.key === ' ' || (e.altKey && e.key === 'ArrowDown'))) {
      e.preventDefault(); open(s);
    }
  }, true);

  window.addEventListener('resize', close);
  window.addEventListener('blur', close);
  document.addEventListener('scroll', (e) => { if (list && !list.contains(e.target)) close(); }, true);
  document.addEventListener('wheel', (e) => { if (list && !list.contains(e.target)) close(); }, { passive: true, capture: true });

  window.ShellmanSelect = { close };
})();
