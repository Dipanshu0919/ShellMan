/* ShellMan — shared media helpers: file kinds, an image viewer (zoom / pan / rotate / any format) and
 * decoders for formats browsers cannot show natively (TIFF, HEIC/HEIF).
 *
 *   ShellmanMedia.kind('a.mkv')                    -> 'video' | 'audio' | 'image' | null
 *   ShellmanMedia.viewUrl(serverId, path)          -> streamable URL (supports Range, so seeking works)
 *   ShellmanMedia.mountImage(host, { url, name, size, onInfo }) -> { destroy, fit, zoomTo, rotate, ... }
 *
 * Used by the Code Workspace (image tabs) and the Media Player app (media.js).
 */
(function () {
  'use strict';
  if (window.ShellmanMedia) return;

  const EXT = {
    image: 'png jpg jpeg jpe jfif pjpeg pjp gif svg svgz webp avif apng ico cur bmp dib tif tiff heic heif jxl',
    video: 'mp4 m4v webm ogv mkv mov avi 3gp 3g2 ts m2ts mts mpg mpeg wmv flv',
    audio: 'mp3 wav ogg oga opus m4a aac flac weba wma aiff aif mka amr'
  };
  const KIND = {};
  Object.keys(EXT).forEach(k => EXT[k].split(' ').forEach(e => { KIND[e] = k; }));
  const extOf = (n) => { const m = /\.([^.\/]+)$/.exec(String(n || '')); return m ? m[1].toLowerCase() : ''; };
  const kind = (name) => KIND[extOf(name)] || null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtBytes = (n) => { if (n == null || isNaN(n)) return ''; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; n = Number(n); while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return (i ? n.toFixed(n < 10 ? 1 : 0) : n) + ' ' + u[i]; };

  const viewUrl = (sid, path) => '/api/servers/' + sid + '/files/view?path=' + encodeURIComponent(path);
  const downloadUrl = (sid, path) => '/api/servers/' + sid + '/files/download?path=' + encodeURIComponent(path);

  // ---------- lazy decoders (Monaco's AMD loader must not see these UMD files) ----------
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise((res, rej) => {
      const amdDefine = window.define, amdRequire = window.require;
      try { window.define = undefined; window.require = undefined; } catch (_) {}
      const s = document.createElement('script');
      const restore = () => { try { window.define = amdDefine; window.require = amdRequire; } catch (_) {} };
      s.src = src; s.async = true;
      s.onload = () => { restore(); res(); };
      s.onerror = () => { restore(); delete loaded[src]; rej(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  const VENDOR = '/static/vendor/imgdec/';

  async function decodeTiff(buf) {
    await loadScript(VENDOR + 'pako_inflate.min.js');
    await loadScript(VENDOR + 'UTIF.js');
    const U = window.UTIF;
    if (!U) throw new Error('TIFF decoder unavailable');
    const ifds = U.decode(buf);
    if (!ifds.length) throw new Error('Empty TIFF');
    U.decodeImage(buf, ifds[0]);
    const rgba = U.toRGBA8(ifds[0]);
    const cv = document.createElement('canvas');
    cv.width = ifds[0].width; cv.height = ifds[0].height;
    cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer), cv.width, cv.height), 0, 0);
    return new Promise((r, j) => cv.toBlob(b => b ? r(b) : j(new Error('TIFF conversion failed')), 'image/png'));
  }
  async function decodeHeic(blob) {
    await loadScript(VENDOR + 'heic2any.min.js');
    if (!window.heic2any) throw new Error('HEIC decoder unavailable');
    try {
      const out = await window.heic2any({ blob, toType: 'image/png' });
      return Array.isArray(out) ? out[0] : out;
    } catch (e) {
      // a .heic file that is really a PNG/JPEG: the browser can show it as it is
      if (e && /already browser readable/i.test(String(e.message || e))) return new Blob([blob], { type: 'image/png' });
      throw e;
    }
  }

  /** Resolve a displayable <img> src for any image: native first, decoder for TIFF / HEIC. */
  async function imageSource(url, name, signal) {
    const e = extOf(name);
    if (e === 'tif' || e === 'tiff' || e === 'heic' || e === 'heif') {
      const r = await fetch(url, { signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = await r.arrayBuffer();
      const png = (e === 'tif' || e === 'tiff') ? await decodeTiff(buf) : await decodeHeic(new Blob([buf], { type: 'image/heic' }));
      const u = URL.createObjectURL(png);
      return { src: u, revoke: () => URL.revokeObjectURL(u) };
    }
    return { src: url, revoke: () => {} };
  }

  // ---------- image viewer ----------
  const CSS = '' +
    '.smv{position:relative;width:100%;height:100%;overflow:hidden;background:var(--smv-bg,#0b1020);touch-action:none;outline:none;user-select:none}' +
    '.smv[data-bg=light]{--smv-bg:#f1f5f9}.smv[data-bg=check]{--smv-bg:#fff;background-image:linear-gradient(45deg,#cbd5e1 25%,transparent 25%,transparent 75%,#cbd5e1 75%),linear-gradient(45deg,#cbd5e1 25%,transparent 25%,transparent 75%,#cbd5e1 75%);background-size:20px 20px;background-position:0 0,10px 10px}' +
    '.smv-img{position:absolute;left:50%;top:50%;transform-origin:50% 50%;max-width:none;max-height:none;cursor:grab;-webkit-user-drag:none;image-rendering:auto}' +
    '.smv.pan .smv-img{cursor:grabbing}.smv.px .smv-img{image-rendering:pixelated}' +
    '.smv-msg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;color:var(--text-muted,#94a3b8);font-size:.8rem;text-align:center;padding:1rem}' +
    '.smv-msg .smv-spin{width:26px;height:26px;border:3px solid rgba(148,163,184,.3);border-top-color:var(--sm-accent,#38bdf8);border-radius:50%;animation:smvSpin .8s linear infinite}@keyframes smvSpin{to{transform:rotate(360deg)}}' +
    '.smv-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:2px;padding:4px;border-radius:12px;background:rgba(var(--inset-rgb,15,23,42),.82);border:1px solid rgba(var(--wash,255,255,255),.14);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);opacity:.0;transition:opacity .18s;max-width:calc(100% - 16px);flex-wrap:wrap;justify-content:center}' +
    '.smv:hover .smv-bar,.smv:focus-within .smv-bar,.smv.touch .smv-bar{opacity:1}' +
    '.smv-bar button{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;padding:0 6px;border:0;border-radius:8px;background:transparent;color:var(--text-primary,#e2e8f0);font:600 .7rem var(--font-mono,monospace);cursor:pointer}' +
    '.smv-bar button:hover{background:rgba(var(--wash,255,255,255),.14)}.smv-bar button svg{width:15px;height:15px}' +
    '.smv-bar i{width:1px;height:16px;background:rgba(var(--wash,255,255,255),.18);margin:0 3px}' +
    '.smv-info{position:absolute;left:10px;top:8px;display:flex;gap:6px;flex-wrap:wrap;pointer-events:none}' +
    '.smv-info span{font:600 .66rem var(--font-mono,monospace);padding:2px 7px;border-radius:6px;background:rgba(var(--inset-rgb,15,23,42),.78);color:var(--text-secondary,#cbd5e1);border:1px solid rgba(var(--wash,255,255,255),.1)}';
  (function () { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); })();

  const I = {
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    rotL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6"/><path d="M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg>',
    rotR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>',
    bg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3l18 18" opacity=".0"/><path d="M12 3v18M3 12h18" opacity=".6"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
  };

  /**
   * opts: { url, name, size, downloadUrl, onInfo(info), bg: 'dark'|'light'|'check' }
   * Returns a controller. The viewer never throws; load problems are shown inside the viewer.
   */
  function mountImage(host, opts) {
    opts = opts || {};
    const root = document.createElement('div');
    root.className = 'smv'; root.tabIndex = 0;
    root.dataset.bg = opts.bg || 'dark';
    root.innerHTML =
      '<img class="smv-img" alt="" draggable="false" style="display:none">' +
      '<div class="smv-msg"><div class="smv-spin"></div><span>Loading image…</span></div>' +
      '<div class="smv-info"></div>' +
      '<div class="smv-bar">' +
      '<button data-a="out" title="Zoom out (-)">' + I.minus + '</button><button data-a="pct" title="Actual size (1)" style="min-width:52px">100%</button><button data-a="in" title="Zoom in (+)">' + I.plus + '</button>' +
      '<i></i><button data-a="fit" title="Fit to window (0)">' + I.fit + '</button>' +
      '<i></i><button data-a="rl" title="Rotate left (L)">' + I.rotL + '</button><button data-a="rr" title="Rotate right (R)">' + I.rotR + '</button>' +
      '<i></i><button data-a="bg" title="Background (B)">' + I.bg + '</button><button data-a="full" title="Fullscreen (F)">' + I.full + '</button>' +
      (opts.downloadUrl ? '<a data-a="dl" href="' + esc(opts.downloadUrl) + '" title="Download" style="display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;color:var(--text-primary,#e2e8f0);border-radius:8px">' + I.dl + '</a>' : '') +
      '</div>';
    host.appendChild(root);

    const img = root.querySelector('.smv-img'), msg = root.querySelector('.smv-msg'), infoEl = root.querySelector('.smv-info'), pctBtn = root.querySelector('[data-a=pct]');
    const S = { z: 1, x: 0, y: 0, rot: 0, fit: true, nw: 0, nh: 0 };
    let dead = false, src = null, abort = new AbortController(), ro = null;

    const box = () => ({ w: root.clientWidth || 1, h: root.clientHeight || 1 });
    const fitScale = () => {
      const b = box(); const sw = (S.rot % 180 ? S.nh : S.nw) || 1, sh = (S.rot % 180 ? S.nw : S.nh) || 1;
      return Math.min((b.w - 24) / sw, (b.h - 24) / sh, 1) || 1;       // never upscale past 100% when fitting
    };
    const apply = () => {
      if (!S.nw) return;
      if (S.fit) { S.z = fitScale(); S.x = 0; S.y = 0; }
      img.style.transform = 'translate(-50%,-50%) translate(' + S.x + 'px,' + S.y + 'px) rotate(' + S.rot + 'deg) scale(' + S.z + ')';
      pctBtn.textContent = Math.round(S.z * 100) + '%';
      root.classList.toggle('px', S.z >= 3);
    };
    const zoomAt = (k, cx, cy) => {
      const b = box(); const z2 = Math.min(40, Math.max(0.02, S.z * k)); const kk = z2 / S.z;
      const px = (cx == null ? b.w / 2 : cx) - b.w / 2, py = (cy == null ? b.h / 2 : cy) - b.h / 2;
      S.fit = false; S.x = px - (px - S.x) * kk; S.y = py - (py - S.y) * kk; S.z = z2; apply();
    };
    const setInfo = () => {
      const bits = [];
      if (S.nw) bits.push(S.nw + ' × ' + S.nh);
      if (opts.size != null) bits.push(typeof opts.size === 'number' ? fmtBytes(opts.size) : String(opts.size));
      const ext = extOf(opts.name); if (ext) bits.push(ext.toUpperCase());
      infoEl.innerHTML = bits.map(b => '<span>' + esc(b) + '</span>').join('');
      if (opts.onInfo) { try { opts.onInfo({ width: S.nw, height: S.nh, ext }); } catch (_) {} }
    };
    const fail = (text) => { msg.style.display = 'flex'; msg.innerHTML = '<span style="color:var(--accent-rose,#fb7185)">' + esc(text) + '</span>' + (opts.downloadUrl ? '<a href="' + esc(opts.downloadUrl) + '" class="btn btn-secondary btn-sm">Download file</a>' : ''); img.style.display = 'none'; };

    img.onload = () => {
      if (dead) return;
      S.nw = img.naturalWidth || 512; S.nh = img.naturalHeight || 512;       // SVG without intrinsic size
      img.style.width = S.nw + 'px'; img.style.height = S.nh + 'px';
      msg.style.display = 'none'; img.style.display = 'block';
      S.fit = true; S.rot = 0; apply(); setInfo();
    };
    img.onerror = () => { if (!dead) fail('This image could not be displayed' + (extOf(opts.name) ? ' (.' + extOf(opts.name) + ')' : '') + '. The file may be corrupt or use a format this browser cannot decode.'); };

    imageSource(opts.url, opts.name, abort.signal).then(r => { if (dead) { r.revoke(); return; } src = r; img.src = r.src; })
      .catch(e => { if (!dead && !(e && e.name === 'AbortError')) fail('Could not load image: ' + (e && e.message ? e.message : e)); });

    // wheel zoom + drag pan + double click
    root.addEventListener('wheel', (e) => { e.preventDefault(); const r = root.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    let drag = null;
    root.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.smv-bar') || e.button !== 0) return;
      if (e.pointerType === 'touch') root.classList.add('touch');
      root.focus({ preventScroll: true });
      drag = { sx: e.clientX, sy: e.clientY, x: S.x, y: S.y, moved: false }; root.setPointerCapture(e.pointerId); root.classList.add('pan');
    });
    root.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; if (drag.moved) { S.fit = false; S.x = drag.x + dx; S.y = drag.y + dy; apply(); } });
    const endDrag = () => { drag = null; root.classList.remove('pan'); };
    root.addEventListener('pointerup', endDrag); root.addEventListener('pointercancel', endDrag);
    root.addEventListener('dblclick', (e) => { if (e.target.closest('.smv-bar')) return; if (S.fit && S.z < 1) zoomTo(1, e); else api.fit(); });
    function zoomTo(z, e) { const r = root.getBoundingClientRect(); S.fit = false; const k = z / S.z; if (e) { zoomAt(k, e.clientX - r.left, e.clientY - r.top); } else { S.z = z; S.x = 0; S.y = 0; apply(); } }

    const rotate = (d) => { S.rot = ((S.rot + d) % 360 + 360) % 360; if (S.fit) apply(); else { apply(); } };
    const bgs = ['dark', 'light', 'check'];
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'in') zoomAt(1.25); else if (a === 'out') zoomAt(1 / 1.25);
      else if (a === 'pct') { S.fit = false; S.z = 1; S.x = 0; S.y = 0; apply(); }
      else if (a === 'fit') api.fit();
      else if (a === 'rl') rotate(-90); else if (a === 'rr') rotate(90);
      else if (a === 'bg') root.dataset.bg = bgs[(bgs.indexOf(root.dataset.bg) + 1) % bgs.length];
      else if (a === 'full') api.fullscreen();
    });
    root.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key; let used = true;
      if (k === '+' || k === '=') zoomAt(1.25); else if (k === '-' || k === '_') zoomAt(1 / 1.25);
      else if (k === '0') api.fit(); else if (k === '1') { S.fit = false; S.z = 1; S.x = 0; S.y = 0; apply(); }
      else if (k === 'r' || k === 'R') rotate(90); else if (k === 'l' || k === 'L') rotate(-90);
      else if (k === 'b' || k === 'B') root.dataset.bg = bgs[(bgs.indexOf(root.dataset.bg) + 1) % bgs.length];
      else if (k === 'f' || k === 'F') api.fullscreen();
      else if (k.indexOf('Arrow') === 0 && !S.fit) { const st = 40; if (k === 'ArrowLeft') S.x += st; if (k === 'ArrowRight') S.x -= st; if (k === 'ArrowUp') S.y += st; if (k === 'ArrowDown') S.y -= st; apply(); }
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    });
    if (window.ResizeObserver) { ro = new ResizeObserver(() => { if (!dead && S.fit) apply(); }); ro.observe(root); }

    const api = {
      el: root,
      fit() { S.fit = true; apply(); },
      zoomTo(z) { zoomTo(z); },
      rotate,
      fullscreen() { const el = root; if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); },
      focus() { try { root.focus({ preventScroll: true }); } catch (_) {} },
      refit() { if (S.fit) apply(); },
      destroy() { dead = true; try { abort.abort(); } catch (_) {} if (ro) ro.disconnect(); if (src) src.revoke(); img.removeAttribute('src'); root.remove(); }
    };
    return api;
  }

  window.ShellmanMedia = { kind, extOf, esc, fmtBytes, viewUrl, downloadUrl, mountImage, imageSource, loadScript, EXT };
})();
