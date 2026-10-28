/**
 * ShellMan effects (fx.js)
 * One small core for every optional visual effect:
 *   - a per-effect on/off store (localStorage "shellman_fx"), shared by Settings and the effects themselves
 *   - live telemetry (CPU, RAM, network, alert level) fed from the desktop poll
 *   - one fullscreen 2D overlay canvas for short-lived effects (beams, bursts), drawn only while something is alive
 *   - the living wallpaper (a WebGL fragment shader under the desktop icons)
 *   - materialize / dissolve for windows
 * Every effect checks ShellmanFX.on(name) at the moment it would run, so turning one off in Settings takes
 * effect immediately and an effect that is off costs nothing.
 */
(function () {
  'use strict';
  if (window.ShellmanFX) return;

  const KEY = 'shellman_fx';
  const NAMES = ['livewall', 'materialize', 'filefx', 'constellation', 'universe'];
  const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  // ---------- settings store ----------
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
  const defaults = () => { const d = { quality: 'full' }; NAMES.forEach(n => { d[n] = !reduceMotion(); }); return d; };
  let cfg = Object.assign(defaults(), read() || {});
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) {} };
  const emit = () => { try { window.dispatchEvent(new CustomEvent('shellman-fx-change', { detail: Object.assign({}, cfg) })); } catch (_) {} };

  const FX = {
    NAMES: NAMES,
    on: (name) => !!cfg[name],
    quality: () => (cfg.quality === 'light' ? 'light' : 'full'),
    get: () => Object.assign({}, cfg),
    set(name, value) { cfg[name] = name === 'quality' ? (value === 'light' ? 'light' : 'full') : !!value; save(); emit(); },
    reset() { cfg = defaults(); save(); emit(); },
    light: () => document.documentElement.getAttribute('data-theme') === 'light'
  };

  // ---------- telemetry ----------
  const T = { cpu: 0, mem: 0, net: 0, alert: 0 };           // targets
  const V = { cpu: 0, mem: 0, net: 0, alert: 0 };           // smoothed values shown by shaders
  let alertUntil = 0;
  FX.feed = function (m) {
    if (!m) return;
    if (typeof m.cpu === 'number') T.cpu = Math.max(0, Math.min(1, m.cpu / 100));
    if (m.memory && typeof m.memory.percent === 'number') T.mem = Math.max(0, Math.min(1, m.memory.percent / 100));
    if (m.network) {
      const b = (m.network.rx_rate || 0) + (m.network.tx_rate || 0);   // bytes per second
      T.net = Math.max(0, Math.min(1, Math.log10(1 + b) / 7));         // 10 MB/s is about 1
    }
    if (T.cpu > 0.9 || T.mem > 0.92) { T.alert = Math.max(T.alert, 0.7); alertUntil = Date.now() + 15000; }
  };
  FX.alert = function (severity) {
    if (severity === 'danger') { T.alert = 1; alertUntil = Date.now() + 60000; }
    else if (severity === 'success') { T.alert = 0; alertUntil = 0; }
  };
  FX.telemetry = () => Object.assign({}, V);

  // ---------- shared loop ----------
  const tasks = new Set();      // { fn(t,dt) -> keep? , fps }
  let raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    if (document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
    last = now;
    const k = 1 - Math.exp(-dt * 1.8);
    if (alertUntil && Date.now() > alertUntil) { T.alert = 0; alertUntil = 0; }
    V.cpu += (T.cpu - V.cpu) * k; V.mem += (T.mem - V.mem) * k; V.net += (T.net - V.net) * k; V.alert += (T.alert - V.alert) * k;
    tasks.forEach(t => {
      const gap = 1000 / (t.fps || 60);
      if (now - (t.at || 0) < gap - 2) return;
      const d = t.at ? Math.min(0.1, (now - t.at) / 1000) : 0.016;
      t.at = now;
      let keep = true;
      try { keep = t.fn(now / 1000, d) !== false; } catch (e) { console.warn('fx task failed', e); keep = false; }
      if (!keep) tasks.delete(t);
    });
    if (tasks.size) raf = requestAnimationFrame(frame);
  }
  FX.task = function (fn, fps) {
    const t = { fn: fn, fps: fps || 60, at: 0 };
    tasks.add(t);
    if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); }
    return () => tasks.delete(t);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && tasks.size && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  });

  // ---------- overlay canvas for short effects ----------
  let ov = null, octx = null;
  const parts = [];        // generic drawables: { draw(ctx,t,dt) -> keep? }
  let ovStop = null;
  function sizeOverlay() {
    if (!ov) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth, h = window.innerHeight;
    if (ov.width !== Math.round(w * dpr) || ov.height !== Math.round(h * dpr)) { ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr); }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function ovFrame(t, dt) {
    sizeOverlay();
    octx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      let keep = true;
      try { keep = parts[i](octx, t, dt) !== false; } catch (_) { keep = false; }
      if (!keep) parts.splice(i, 1);
    }
    if (!parts.length) { octx.clearRect(0, 0, window.innerWidth, window.innerHeight); ovStop = null; return false; }
  }
  FX.draw = function (drawFn) {
    if (!ov) {
      ov = document.createElement('canvas');
      ov.id = 'shellmanFxOverlay';
      ov.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99990;';
      document.body.appendChild(ov);
      octx = ov.getContext('2d');
    }
    parts.push(drawFn);
    if (!ovStop) ovStop = FX.task(ovFrame, 60);
  };

  const accent = () => (getComputedStyle(document.documentElement).getPropertyValue('--sm-accent') || '').trim() || '#38bdf8';
  FX.accent = accent;
  const ease = (x) => 1 - Math.pow(1 - x, 3);

  // square pixel burst (used by close-to-dock and delete)
  FX.burst = function (x, y, opts) {
    opts = opts || {};
    const n = opts.n || 26, life = opts.life || 0.7, col = opts.color || accent();
    const P = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 160;
      P.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, s: 2 + Math.random() * 3 });
    }
    let age = 0;
    FX.draw((c, t, dt) => {
      age += dt;
      const k = age / life;
      if (k >= 1) return false;
      c.fillStyle = col; c.globalAlpha = 1 - k;
      P.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); });
      c.globalAlpha = 1;
    });
  };

  // a bright dot that travels from one rectangle to another, trailing small squares (transfer beam)
  FX.beam = function (from, to, opts) {
    opts = opts || {};
    const col = opts.color || accent(), dur = (opts.ms || 900) / 1000;
    const a = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
    const b = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
    const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - Math.max(30, Math.abs(a.x - b.x) * 0.15);
    let age = 0;
    const at = (u) => ({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * b.y });
    FX.draw((c, t, dt) => {
      age += dt;
      const u = Math.min(1, age / dur);
      if (age > dur + 0.35) return false;
      const e = ease(u);
      c.fillStyle = col;
      for (let i = 0; i < 14; i++) {
        const uu = Math.max(0, e - i * 0.018);
        const p = at(uu);
        c.globalAlpha = (1 - i / 14) * (u >= 1 ? Math.max(0, 1 - (age - dur) / 0.35) : 1);
        const s = Math.max(1.5, 5 - i * 0.3);
        c.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      }
      c.globalAlpha = 1;
    });
  };

  // ---------- living wallpaper ----------
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = [
    'precision mediump float;',
    'uniform vec2 uRes;uniform float uT,uCpu,uMem,uNet,uAlert,uLight;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}',
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uRes;vec2 p=uv*vec2(uRes.x/uRes.y,1.)*2.4;',
    '  float sp=.025+uCpu*.32;float t=uT*sp;',
    '  vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-vec2(t,0.)));',
    '  float f=fbm(p+2.2*q);',
    '  float fog=smoothstep(.32,.92,f)*(.10+.62*uMem);',
    '  vec3 cool=mix(vec3(.10,.55,.80),vec3(.45,.30,.90),uCpu);',
    '  vec3 col=mix(cool,vec3(.95,.20,.28),uAlert);',
    '  float asp=uRes.x/uRes.y;',
    '  float d1=length((uv-vec2(.16,.10))*vec2(asp,1.));float d2=length((uv-vec2(.86,.92))*vec2(asp,1.));',
    '  float sw=2.+uNet*7.;',
    '  float r=sin(d1*26.-uT*sw)*exp(-d1*2.6)+sin(d2*26.-uT*sw*1.1)*exp(-d2*2.6);',
    '  r=max(r,0.)*uNet*.55;',
    '  float a=clamp(fog*.62+r*.5,0.,.62);',
    '  col=mix(col,vec3(.18,.28,.42),uLight);',
    '  a*=mix(1.,.38,uLight);',
    '  gl_FragColor=vec4(col*a,a);',
    '}'
  ].join('\n');

  let wall = null;
  function wallStart() {
    if (wall || !FX.on('livewall')) return;
    const env = document.getElementById('desktop');
    if (!env) return;
    const cv = document.createElement('canvas');
    cv.id = 'desktopFxWall';
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('fx shader:', gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uRes', 'uT', 'uCpu', 'uMem', 'uNet', 'uAlert', 'uLight'].forEach(k => { U[k] = gl.getUniformLocation(pr, k); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    env.insertBefore(cv, env.firstChild);
    let w = 0, h = 0, fine = 0;
    const stop = FX.task((t) => {
      if (!FX.on('livewall') || !cv.isConnected) { wallStop(); return false; }
      const q = FX.quality() === 'light' ? 0.3 : 0.5;
      const cw = Math.max(64, Math.round(cv.clientWidth * q)), ch = Math.max(64, Math.round(cv.clientHeight * q));
      if (cw !== w || ch !== h) { w = cw; h = ch; cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uT, t % 3600);
      gl.uniform1f(U.uCpu, V.cpu); gl.uniform1f(U.uMem, V.mem); gl.uniform1f(U.uNet, V.net); gl.uniform1f(U.uAlert, V.alert);
      gl.uniform1f(U.uLight, FX.light() ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }, FX.quality() === 'light' ? 20 : 30);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); wallStop(); });
    wall = { cv: cv, gl: gl, stop: stop };
  }
  function wallStop() {
    if (!wall) return;
    try { wall.stop(); } catch (_) {}
    try { const x = wall.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch (_) {}
    if (wall.cv.parentNode) wall.cv.parentNode.removeChild(wall.cv);
    wall = null;
  }
  FX.refreshWall = function () { if (FX.on('livewall')) { if (wall && !wall.cv.isConnected) wallStop(); wallStart(); } else wallStop(); };

  // ---------- windows: materialize on open, dissolve into the dock on close ----------
  FX.windowOpen = function (win) {
    if (!FX.on('materialize') || !win || !win.el || !win.el.animate) return;
    const el = win.el;
    const ov = document.createElement('div');
    ov.className = 'fx-decode';
    ov.innerHTML = '<i class="fx-decode-scan"></i><b class="fx-decode-bar"><em>$</em></b>';
    el.appendChild(ov);
    const dur = FX.quality() === 'light' ? 320 : 520;
    const ease = 'cubic-bezier(.25,.75,.25,1)';
    el.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: dur, easing: ease });
    ov.querySelector('.fx-decode-bar').animate([{ top: '0%' }, { top: '100%' }], { duration: dur, easing: ease, fill: 'forwards' });
    ov.querySelector('.fx-decode-scan').animate([{ opacity: 0.55 }, { opacity: 0.35, offset: 0.7 }, { opacity: 0 }], { duration: dur + 120, easing: 'linear', fill: 'forwards' });
    setTimeout(() => { if (ov.parentNode) ov.parentNode.removeChild(ov); }, dur + 160);
  };

  function dockTarget(win) {
    let t = document.querySelector('.dock-item[data-app="' + (win.appId || '') + '"]');
    if (!t || !t.getBoundingClientRect().width) t = win.taskbarPill && win.taskbarPill.getBoundingClientRect && win.taskbarPill;
    let r = t && t.getBoundingClientRect && t.getBoundingClientRect();
    if (!r || !r.width) r = { left: window.innerWidth / 2 - 20, top: window.innerHeight - 60, width: 40, height: 40 };
    return r;
  }
  // returns the number of milliseconds the window must stay in the DOM, or 0 when the effect is off
  FX.windowClose = function (win) {
    if (!FX.on('materialize') || !win || !win.el || !win.el.animate) return 0;
    const el = win.el, r = el.getBoundingClientRect();
    const tr = dockTarget(win);
    const dx = (tr.left + tr.width / 2) - (r.left + r.width / 2);
    const dy = (tr.top + tr.height / 2) - (r.top + r.height / 2);
    const dur = FX.quality() === 'light' ? 260 : 440;
    el.classList.add('closing-fx');
    el.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1, clipPath: 'inset(0 0 0% 0)', filter: 'none' },
      { transform: 'translate(' + dx * 0.25 + 'px,' + dy * 0.25 + 'px) scale(.82)', opacity: 1, clipPath: 'inset(0 0 12% 0)', filter: 'none', offset: 0.35 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.05)', opacity: 0, clipPath: 'inset(0 0 70% 0)', filter: 'blur(3px)' }
    ], { duration: dur, easing: 'cubic-bezier(.5,0,.75,.35)', fill: 'forwards' });
    setTimeout(() => FX.burst(tr.left + tr.width / 2, tr.top + tr.height / 2, { n: 18, life: 0.5 }), Math.round(dur * 0.8));
    return dur + 20;
  };


  // ---------- file manager effects ----------
  const files = FX.files = {};
  const appOf = (id) => document.getElementById('fapp_' + id);
  const vpOf = (id) => document.getElementById('vp_' + id);
  const rowsFor = (id, paths) => {
    const vp = vpOf(id); if (!vp) return [];
    const want = paths && paths.length ? new Set(paths) : null;
    return Array.from(vp.querySelectorAll('[data-path]')).filter(el => want ? want.has(el.getAttribute('data-path')) : el.classList.contains('selected'));
  };
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
  const dockRect = () => { const d = document.getElementById('desktopDock'); return d ? rectOf(d) : { left: window.innerWidth / 2 - 40, top: window.innerHeight - 70, width: 80, height: 50 }; };
  const listRect = (id) => { const v = vpOf(id) || appOf(id); return v ? rectOf(v) : { left: 200, top: 200, width: 300, height: 100 }; };

  // beam context for an SSE task: row -> destination, one beam per progress step
  files.beam = function (title, winId) {
    if (!FX.on('filefx')) return null;
    const t = String(title || '');
    const kind = /upload/i.test(t) ? 'up' : (/download|archive ready|creating archive/i.test(t) ? 'down' : 'in');
    const sel = rowsFor(winId)[0];
    const src0 = sel ? rectOf(sel) : null;
    let lastAt = 0, lastBytes = -1;
    const ends = () => {
      const L = listRect(winId), A = appOf(winId) ? rectOf(appOf(winId)) : L;
      const row = src0 || { left: L.left + 20, top: L.top + 20, width: Math.min(220, L.width), height: 24 };
      if (kind === 'up') return [dockRect(), { left: L.left + L.width / 2 - 20, top: L.top + 40, width: 40, height: 20 }];
      if (kind === 'down') return [row, dockRect()];
      return [row, { left: A.left + A.width / 2 - 30, top: A.top + 6, width: 60, height: 24 }];
    };
    return {
      tick(data) {
        const now = Date.now();
        if (!data || data.transferred === lastBytes || now - lastAt < 420) return;
        lastBytes = data.transferred; lastAt = now;
        const e = ends(); FX.beam(e[0], e[1], { ms: 760 });
      },
      done() { const e = ends(); FX.burst(e[1].left + e[1].width / 2, e[1].top + e[1].height / 2, { n: 22, life: 0.6 }); }
    };
  };
  // one beam for upload batches (upload does not use the SSE stream)
  files.pulse = function (winId, kind) {
    if (!FX.on('filefx')) return;
    const L = listRect(winId);
    FX.beam(dockRect(), { left: L.left + L.width / 2 - 20, top: L.top + 40, width: 40, height: 20 }, { ms: 760 });
  };

  // zoom into a folder (deeper) or out of it (up)
  files.depth = function (winId, deeper) {
    if (!FX.on('filefx')) return;
    const vp = vpOf(winId); if (!vp || !vp.animate) return;
    vp.animate([
      { transform: 'scale(' + (deeper ? 1.06 : 0.94) + ')', opacity: 0, filter: 'blur(3px)' },
      { transform: 'scale(1)', opacity: 1, filter: 'blur(0)' }
    ], { duration: FX.quality() === 'light' ? 200 : 340, easing: 'cubic-bezier(.2,.8,.2,1)' });
  };

  function ghostOf(winId, el) {
    const app = appOf(winId); if (!app) return null;
    const ar = app.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    const box = document.createElement('div');
    box.style.cssText = 'position:absolute;left:' + (r.left - ar.left) + 'px;top:' + (r.top - ar.top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px;pointer-events:none;z-index:40;';
    let n;
    if (el.tagName === 'TR') {
      const tb = document.createElement('tbody'), tr = el.cloneNode(true);
      const src = el.children, dst = tr.children;
      for (let i = 0; i < src.length && i < dst.length; i++) { dst[i].style.width = src[i].getBoundingClientRect().width + 'px'; dst[i].style.boxSizing = 'border-box'; }
      tb.appendChild(tr);
      n = document.createElement('table');
      n.style.cssText = 'width:' + r.width + 'px;border-collapse:collapse;table-layout:fixed;background:var(--bg-canvas)';
      n.appendChild(tb);
    } else { n = el.cloneNode(true); n.style.width = r.width + 'px'; n.style.height = r.height + 'px'; n.style.margin = '0'; }
    n.classList.remove('selected');
    app.appendChild(box);
    return { box: box, node: n, r: r };
  }

  // delete: the row is cut into strips that fall away
  files.shred = function (winId, paths) {
    if (!FX.on('filefx')) return;
    const N = FX.quality() === 'light' ? 6 : 12;
    rowsFor(winId, paths).slice(0, 12).forEach((el, k) => {
      const g = ghostOf(winId, el); if (!g) return;
      const w = g.r.width / N;
      for (let i = 0; i < N; i++) {
        const strip = document.createElement('div');
        strip.style.cssText = 'position:absolute;left:' + (i * w) + 'px;top:0;width:' + (w + 0.5) + 'px;height:100%;overflow:hidden;will-change:transform';
        const c = g.node.cloneNode(true); c.style.position = 'absolute'; c.style.left = (-i * w) + 'px'; c.style.top = '0';
        strip.appendChild(c); g.box.appendChild(strip);
        strip.animate([
          { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
          { transform: 'translateY(' + (50 + Math.random() * 110) + 'px) rotate(' + ((Math.random() - 0.5) * 22) + 'deg)', opacity: 0 }
        ], { duration: 620 + Math.random() * 240, delay: k * 40 + i * 16, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'both' });
      }
      setTimeout(() => { if (g.box.parentNode) g.box.parentNode.removeChild(g.box); }, 1400 + k * 40);
    });
  };

  // compress: rows fold up like paper and slide into the first row
  files.fold = function (winId, paths) {
    if (!FX.on('filefx')) return;
    const els = rowsFor(winId, paths).slice(0, 14); if (!els.length) return;
    const top = els[0].getBoundingClientRect().top;
    els.forEach((el, k) => {
      const g = ghostOf(winId, el); if (!g) return;
      g.box.appendChild(g.node);
      g.box.style.transformOrigin = '50% 0%';
      const dy = top - g.r.top;
      g.box.animate([
        { transform: 'perspective(600px) rotateX(0deg) translateY(0)', opacity: 1 },
        { transform: 'perspective(600px) rotateX(-80deg) translateY(0)', opacity: 0.95, offset: 0.5 },
        { transform: 'perspective(600px) rotateX(-80deg) translateY(' + dy + 'px) scale(.2,.4)', opacity: 0 }
      ], { duration: 760, delay: k * 45, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
      setTimeout(() => { if (g.box.parentNode) g.box.parentNode.removeChild(g.box); }, 1000 + k * 45);
    });
  };

  // ---------- running transfers (rsync / deploy), shown as comets in the Fleet constellation ----------
  const live = {};
  FX.transfers = () => Object.assign({}, live);
  FX.transfer = function (serverId, kind, dir, phase) {
    const id = Number(serverId); if (!id) return;
    if (phase === 'start') live[id] = { kind: kind, dir: dir || 'out' }; else delete live[id];
    try { window.dispatchEvent(new CustomEvent('shellman-fx-transfer', { detail: { server_id: id, kind: kind, dir: dir || 'out', phase: phase } })); } catch (_) {}
  };

  // ---------- lazy loader for the 3D library (vendored locally, only when a 3D view opens) ----------
  let threeP = null;
  FX.loadThree = function () {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threeP) return threeP;
    threeP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = '/static/vendor/three/three.min.js';
      // Monaco's AMD loader defines window.define, which makes Three's UMD wrapper register as a module instead of
      // setting window.THREE. Hide define while the script runs, then put it back.
      const amd = window.define, req = window.require;
      try { window.define = undefined; } catch (_) {}
      const restore = () => { try { window.define = amd; window.require = req; } catch (_) {} };
      s.onload = () => { restore(); res(window.THREE); };
      s.onerror = () => { restore(); threeP = null; rej(new Error('three.js failed to load')); };
      document.head.appendChild(s);
    });
    return threeP;
  };


  // ---------- Settings card (Appearance tab) ----------
  const LABELS = {
    livewall: ['Living wallpaper', 'A shader over the wallpaper: CPU sets the flow speed, RAM the fog, network traffic the ripples, a critical alert shifts the colour to red.'],
    materialize: ['Materialize windows', 'Windows resolve in with a scanline decode and dissolve into their dock icon when closed.'],
    filefx: ['File manager effects', 'Transfer beams, depth zoom when opening folders, shredding on delete, folding on compress.'],
    constellation: ['Fleet constellation', 'Adds a 3D view to Fleet & History: servers orbit by load, comets fly on rsync and deploys.'],
    universe: ['Process universe', 'Adds a view to the Task Manager: processes as bodies sized by CPU and RAM, with collapse on kill.']
  };
  FX.settingsCard = function () {
    const rows = NAMES.map(n => '<label class="fx-row"><span class="fx-txt"><b>' + LABELS[n][0] + '</b><small>' + LABELS[n][1] + '</small></span>' +
      '<input type="checkbox" class="fx-chk" data-fx="' + n + '"' + (cfg[n] ? ' checked' : '') + '></label>').join('');
    return '<div class="settings-card" id="fxCard" style="margin-bottom:1.25rem;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.25rem;flex-wrap:wrap;">' +
      '<div style="font-weight:700;font-size:.85rem;color:var(--text-primary);">Effects</div>' +
      '<div style="display:flex;gap:.4rem;align-items:center;font-size:.75rem;color:var(--text-muted);">Quality ' +
      '<select class="form-control" id="fxQuality" style="font-size:.75rem;padding:.25rem .5rem;width:auto;"><option value="full"' + (cfg.quality === 'full' ? ' selected' : '') + '>Full</option><option value="light"' + (cfg.quality === 'light' ? ' selected' : '') + '>Light (lower GPU use)</option></select>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="fxAllOn">All on</button><button type="button" class="btn btn-secondary btn-sm" id="fxAllOff">All off</button></div></div>' +
      '<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.6rem;">Every effect is optional and costs nothing while it is off. They pause when the tab is hidden.</div>' + rows + '</div>';
  };
  FX.bindSettings = function (root) {
    const card = root && root.querySelector('#fxCard');
    if (!card) return;
    const sync = () => card.querySelectorAll('.fx-chk').forEach(c => { c.checked = FX.on(c.dataset.fx); });
    card.querySelectorAll('.fx-chk').forEach(c => { c.onchange = () => FX.set(c.dataset.fx, c.checked); });
    const q = card.querySelector('#fxQuality'); if (q) q.onchange = () => { FX.set('quality', q.value); wallStop(); FX.refreshWall(); };
    card.querySelector('#fxAllOn').onclick = () => { NAMES.forEach(n => { cfg[n] = true; }); save(); emit(); sync(); };
    card.querySelector('#fxAllOff').onclick = () => { NAMES.forEach(n => { cfg[n] = false; }); save(); emit(); sync(); };
  };
  (function () {
    const st = document.createElement('style');
    st.textContent = '.fx-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.6rem 0;border-top:1px solid var(--sm-line,rgba(var(--wash),.12));cursor:pointer}' +
      '.fx-txt{display:flex;flex-direction:column;gap:2px}.fx-txt b{font-size:.82rem;font-weight:600;color:var(--text-primary)}.fx-txt small{font-size:.72rem;color:var(--text-muted);line-height:1.35}' +
      '#fxCard input.fx-chk{appearance:none!important;-webkit-appearance:none!important;flex:0 0 auto;width:38px!important;height:22px!important;min-height:0!important;padding:0!important;border-radius:11px!important;background:var(--sm-line-strong,rgba(var(--wash),.22))!important;position:relative;cursor:pointer;transition:background .15s;border:0!important;margin:0!important;box-shadow:none!important}' +
      '#fxCard input.fx-chk::after{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}' +
      '#fxCard input.fx-chk::before{display:none!important}' +
      '#fxCard input.fx-chk:checked{background:var(--sm-accent,#38bdf8)!important}#fxCard input.fx-chk:checked::after{transform:translateX(16px)}';
    document.head.appendChild(st);
  })();

  window.ShellmanFX = FX;
  window.addEventListener('shellman-fx-change', () => FX.refreshWall());
  window.addEventListener('shellman-theme', () => { /* shader reads the theme every frame */ });
  window.addEventListener('shellman-fx-alert', (e) => FX.alert(e.detail && e.detail.severity));
  const boot = () => { FX.refreshWall(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // the desktop may be built a moment after DOMContentLoaded
  setTimeout(boot, 1200);
})();
