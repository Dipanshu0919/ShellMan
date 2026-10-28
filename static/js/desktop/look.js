/**
 * ShellMan: personal look (look.js)
 * Lets each person pick fonts for different parts of the desktop (interface, headings and clock, widgets,
 * apps, desktop icons and dock, code and terminal) plus a few sizes and the corner roundness.
 * Everything is stored in this browser (localStorage key "shellman_look") and applied through one <style> tag,
 * so "Reset" simply removes it again.
 */
(function () {
  if (window.ShellmanLook) return;
  const KEY = 'shellman_look';

  // name -> CSS stack. "google" fonts are loaded from Google Fonts the first time they are chosen.
  const SANS = [
    { id: 'default', name: 'Default (Inter)', stack: null },
    { id: 'system', name: 'System UI', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
    { id: 'inter', name: 'Inter', stack: "'Inter', system-ui, sans-serif", google: 'Inter:wght@400;500;600;700' },
    { id: 'roboto', name: 'Roboto', stack: "'Roboto', system-ui, sans-serif", google: 'Roboto:wght@400;500;700' },
    { id: 'opensans', name: 'Open Sans', stack: "'Open Sans', system-ui, sans-serif", google: 'Open+Sans:wght@400;600;700' },
    { id: 'lato', name: 'Lato', stack: "'Lato', system-ui, sans-serif", google: 'Lato:wght@400;700' },
    { id: 'poppins', name: 'Poppins', stack: "'Poppins', system-ui, sans-serif", google: 'Poppins:wght@400;500;600;700' },
    { id: 'montserrat', name: 'Montserrat', stack: "'Montserrat', system-ui, sans-serif", google: 'Montserrat:wght@400;500;600;700' },
    { id: 'nunito', name: 'Nunito', stack: "'Nunito', system-ui, sans-serif", google: 'Nunito:wght@400;600;700' },
    { id: 'worksans', name: 'Work Sans', stack: "'Work Sans', system-ui, sans-serif", google: 'Work+Sans:wght@400;500;600;700' },
    { id: 'spacegrotesk', name: 'Space Grotesk', stack: "'Space Grotesk', 'Inter', system-ui, sans-serif", google: 'Space+Grotesk:wght@500;600;700' },
    { id: 'plexsans', name: 'IBM Plex Sans', stack: "'IBM Plex Sans', system-ui, sans-serif", google: 'IBM+Plex+Sans:wght@400;500;600;700' },
    { id: 'segoe', name: 'Segoe UI / Helvetica', stack: "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif" },
    { id: 'verdana', name: 'Verdana', stack: "Verdana, Geneva, sans-serif" },
    { id: 'trebuchet', name: 'Trebuchet MS', stack: "'Trebuchet MS', Tahoma, sans-serif" },
    { id: 'georgia', name: 'Georgia (serif)', stack: "Georgia, 'Times New Roman', serif" },
    { id: 'mono', name: 'Monospace everywhere', stack: "var(--font-mono)" }
  ];
  const MONO = [
    { id: 'default', name: 'Default (JetBrains Mono)', stack: null },
    { id: 'system', name: 'System monospace', stack: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
    { id: 'jetbrains', name: 'JetBrains Mono', stack: "'JetBrains Mono', monospace", google: 'JetBrains+Mono:wght@400;500;700' },
    { id: 'firacode', name: 'Fira Code', stack: "'Fira Code', monospace", google: 'Fira+Code:wght@400;500;700' },
    { id: 'sourcecode', name: 'Source Code Pro', stack: "'Source Code Pro', monospace", google: 'Source+Code+Pro:wght@400;500;700' },
    { id: 'plexmono', name: 'IBM Plex Mono', stack: "'IBM Plex Mono', monospace", google: 'IBM+Plex+Mono:wght@400;500;700' },
    { id: 'robotomono', name: 'Roboto Mono', stack: "'Roboto Mono', monospace", google: 'Roboto+Mono:wght@400;500;700' },
    { id: 'ubuntumono', name: 'Ubuntu Mono', stack: "'Ubuntu Mono', monospace", google: 'Ubuntu+Mono:wght@400;700' },
    { id: 'consolas', name: 'Consolas / Menlo', stack: "Consolas, Menlo, 'Courier New', monospace" },
    { id: 'courier', name: 'Courier New', stack: "'Courier New', Courier, monospace" }
  ];

  // area -> { label, hint, list }
  const AREAS = {
    ui:       { label: 'Interface', hint: 'Buttons, menus, settings and everything not listed below.', list: SANS },
    heading:  { label: 'Headings & clock', hint: 'Big titles, the desktop clock and widget headings.', list: SANS },
    widgets:  { label: 'Desktop widgets', hint: 'The clock and system metrics panel on the right.', list: SANS },
    apps:     { label: 'App windows', hint: 'Text inside windows such as Task Manager, File Manager and Fleet. Code stays monospace.', list: SANS },
    icons:    { label: 'Desktop icons & dock', hint: 'Icon labels on the desktop and the dock name tooltips.', list: SANS },
    mono:     { label: 'Code, paths & terminal', hint: 'Terminals, the code editor, file paths and numbers shown in monospace.', list: MONO }
  };

  const DEFAULTS = { fonts: {}, custom: {}, widgetsScale: 100, iconLabel: 100, radius: 100 };

  const clean = (v) => {
    const o = { fonts: {}, custom: {}, widgetsScale: 100, iconLabel: 100, radius: 100 };
    if (!v || typeof v !== 'object') return o;
    Object.keys(AREAS).forEach(a => {
      if (v.fonts && typeof v.fonts[a] === 'string' && v.fonts[a]) o.fonts[a] = v.fonts[a].slice(0, 40);
      if (v.custom && typeof v.custom[a] === 'string' && v.custom[a].trim()) o.custom[a] = v.custom[a].replace(/[;{}<>\\]/g, '').trim().slice(0, 80);
    });
    const num = (x, lo, hi) => { const n = parseInt(x, 10); return isNaN(n) ? 100 : Math.min(hi, Math.max(lo, n)); };
    o.widgetsScale = num(v.widgetsScale, 70, 130);
    o.iconLabel = num(v.iconLabel, 70, 160);
    o.radius = num(v.radius, 0, 200);
    return o;
  };

  const load = () => {
    try { return clean(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (_) { return clean(null); }
  };
  let state = load();

  // The CSS stack for an area, or null for "leave it as it is".
  const stackFor = (area, st) => {
    st = st || state;
    const id = st.fonts[area];
    if (id === 'custom') {
      const c = st.custom[area];
      if (!c) return null;
      const quoted = c.split(',').map(x => x.trim()).filter(Boolean).map(x => (/^['"].*['"]$/.test(x) || /^(serif|sans-serif|monospace|system-ui|cursive|fantasy|ui-monospace)$/i.test(x)) ? x : `'${x.replace(/'/g, '')}'`);
      return quoted.length ? quoted.join(', ') + (area === 'mono' ? ', monospace' : ', sans-serif') : null;
    }
    const item = (AREAS[area].list || []).find(f => f.id === id);
    return item && item.stack ? item.stack : null;
  };

  const loadGoogle = (st) => {
    const need = [];
    Object.keys(AREAS).forEach(a => {
      const item = (AREAS[a].list || []).find(f => f.id === st.fonts[a]);
      if (item && item.google && !need.includes(item.google)) need.push(item.google);
    });
    need.forEach(fam => {
      const id = 'smFont_' + fam.replace(/[^a-z0-9]/gi, '');
      if (document.getElementById(id)) return;
      const l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
      document.head.appendChild(l);
    });
  };

  const css = (st) => {
    const r = [];
    const root = [];
    const ui = stackFor('ui', st), head = stackFor('heading', st), mono = stackFor('mono', st);
    if (ui) { root.push(`--font-sans:${ui}`); root.push(`--sm-font-sans:${ui}`); }
    if (head) root.push(`--sm-font-display:${head}`);
    if (mono) { root.push(`--font-mono:${mono}`); root.push(`--sm-font-mono:${mono}`); }
    if (st.radius !== 100) {
      const k = st.radius / 100;
      [['--radius-xs', 4], ['--radius-sm', 6], ['--radius-md', 10], ['--radius-lg', 14],
       ['--sm-r-xs', 8], ['--sm-r-sm', 10], ['--sm-r-md', 14], ['--sm-r-lg', 20], ['--sm-r-xl', 28]]
        .forEach(([n, px]) => root.push(`${n}:${Math.round(px * k)}px`));
    }
    if (root.length) r.push(`html:root{${root.join(';')}}`);
    if (ui) r.push(`body,button,input,select,textarea{font-family:${ui}}`);
    const w = stackFor('widgets', st);
    if (w) r.push(`#desktopWidgetsPanel,#desktopWidgetsPanel *:not(svg):not(svg *){font-family:${w} !important}`);
    const a = stackFor('apps', st);
    if (a) r.push(`.window-body{font-family:${a};--font-sans:${a}}`);
    const ic = stackFor('icons', st);
    if (ic) r.push(`.desktop-icon-label,.dock-tip,.dock-item[data-tooltip]{font-family:${ic} !important}`);
    if (st.widgetsScale !== 100) r.push(`#desktopWidgetsPanel{zoom:${(st.widgetsScale / 100).toFixed(2)}}`);
    if (st.iconLabel !== 100) r.push(`.desktop-icon-label{font-size:${(0.71 * st.iconLabel / 100).toFixed(3)}rem !important}`);
    return r.join('\n');
  };

  const applyTerminals = () => {
    const mono = stackFor('mono') || 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    if (window._shellmanTerminals) {
      window._shellmanTerminals.forEach(t => {
        try { t.options.fontFamily = mono; if (t._fitAddon) t._fitAddon.fit(); } catch (_) {}
      });
    }
    try {
      if (window.monaco && window.monaco.editor) window.monaco.editor.getEditors().forEach(e => e.updateOptions({ fontFamily: mono }));
    } catch (_) {}
  };

  const apply = () => {
    loadGoogle(state);
    let el = document.getElementById('smLook');
    const text = css(state);
    if (!text) { if (el) el.remove(); }
    else {
      if (!el) { el = document.createElement('style'); el.id = 'smLook'; document.head.appendChild(el); }
      el.textContent = text;
    }
    applyTerminals();
    // fonts finish loading a moment later: re-fit open terminals once they are ready
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyTerminals).catch(() => {});
  };

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };

  window.ShellmanLook = {
    AREAS,
    get: () => JSON.parse(JSON.stringify(state)),
    set(patch) {
      const next = JSON.parse(JSON.stringify(state));
      if (patch.fonts) Object.assign(next.fonts, patch.fonts);
      if (patch.custom) Object.assign(next.custom, patch.custom);
      ['widgetsScale', 'iconLabel', 'radius'].forEach(k => { if (patch[k] !== undefined) next[k] = patch[k]; });
      state = clean(next);
      save(); apply();
    },
    reset() { state = clean(null); try { localStorage.removeItem(KEY); } catch (_) {} apply(); },
    reload() { state = load(); apply(); },
    // used by terminals and the code editor when they are created
    monoStack: () => stackFor('mono') || 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    isDefault: () => !css(state)
  };

  apply();
})();
