/**
 * ShellMan: Process universe (procuniverse.js)
 * The Task Manager's process list drawn as a small universe on one 2D canvas.
 *   size   -> memory share (RAM %)
 *   colour -> CPU load (green, amber, red); busy processes also circle the centre faster
 *   Z      -> zombie: pale, drifts out to the rim
 *   T      -> stopped: frozen with a dashed ring
 *   kill   -> the body collapses inward and bursts (collapse(pid))
 * Hover shows details; clicking a body opens the Task Manager's own context menu for it.
 * Nothing is drawn in the light theme except flat shapes (no glow).
 */
(function () {
  'use strict';
  if (window.ShellmanProcUniverse) return;

  function mount(host, opts) {
    const FX = window.ShellmanFX;
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    host.appendChild(cv);
    const tip = document.createElement('div');
    tip.className = 'pu-tip'; tip.style.display = 'none';
    host.appendChild(tip);
    const ctx = cv.getContext('2d');
    const bodies = new Map();       // pid -> body
    const sparks = [];              // collapse particles
    const rings = [];               // collapse shockwaves
    let W = 10, H = 10, dpr = 1, hover = null, mx = -1, my = -1, dead = false, t0 = 0;

    const MAXN = 90;
    const lightTheme = () => FX.light();
    const pal = () => lightTheme()
      ? { ok: '#0f9d6e', warn: '#c27803', crit: '#d1243b', zomb: '#9aa3b5', text: '#1f2a3d', core: '#1d6fa5' }
      : { ok: '#34d399', warn: '#fbbf24', crit: '#f43f5e', zomb: '#8d97ab', text: '#e6ebf5', core: FX.accent() };

    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(10, host.clientWidth); H = Math.max(10, host.clientHeight);
      const w = Math.round(W * dpr), h = Math.round(H * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    }
    const ro = new ResizeObserver(size); ro.observe(host); size();

    function update(list) {
      if (dead) return;
      const top = (list || []).slice().sort((a, b) => ((b.cpu || 0) * 2 + (b.mem || 0)) - ((a.cpu || 0) * 2 + (a.mem || 0))).slice(0, MAXN);
      const seen = new Set();
      top.forEach(p => {
        seen.add(p.pid);
        let b = bodies.get(p.pid);
        const a = Math.random() * 6.283, d = Math.min(W, H) * (0.15 + Math.random() * 0.3);
        if (!b) { b = { pid: p.pid, x: W / 2 + Math.cos(a) * d, y: H / 2 + Math.sin(a) * d, vx: 0, vy: 0, r: 0, born: 1, ph: Math.random() * 6.283, ang: a }; bodies.set(p.pid, b); }
        b.p = p; b.gone = false;
        const st = String(p.stat || '').charAt(0);
        b.zombie = st === 'Z'; b.stopped = st === 'T' || st === 't';
        b.rT = Math.max(5, Math.min(46, 5 + Math.sqrt(Math.max(0, p.mem || 0)) * 8 + Math.sqrt(Math.max(0, p.cpu || 0)) * 1.2));
        b.cpu = Math.max(0, p.cpu || 0);
      });
      bodies.forEach((b, pid) => { if (!seen.has(pid) && !b.dying) { b.gone = true; b.rT = 0; } });
    }

    function collapse(pid) {
      const b = bodies.get(pid); if (!b || b.dying) return;
      b.dying = 0.0001;
    }

    function step(t, dt) {
      if (dead) return false;
      if (!host.isConnected) { destroy(); return false; }
      if (host.clientWidth < 20) return;
      const cx = W / 2, cy = H / 2, rim = Math.min(W, H) * 0.46;
      const P = pal(), light = lightTheme();
      const arr = Array.from(bodies.values());
      // forces
      for (let i = 0; i < arr.length; i++) {
        const b = arr[i];
        b.r += (b.rT - b.r) * Math.min(1, dt * 5);
        if (b.dying) continue;
        const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy) || 1;
        if (b.zombie) {
          const want = rim, f = (want - d) * 0.35;
          b.vx += dx / d * f * dt; b.vy += dy / d * f * dt;
          b.vx += -dy / d * 6 * dt; b.vy += dx / d * 6 * dt;       // slow drift along the rim
        } else {
          b.vx -= dx * 0.13 * dt; b.vy -= dy * 0.13 * dt;          // gravity
          if (!b.stopped) { const sw = 4 + Math.min(100, b.cpu) * 0.55; b.vx += -dy / d * sw * dt; b.vy += dx / d * sw * dt; }
        }
        for (let j = i + 1; j < arr.length; j++) {
          const o = arr[j]; if (o.dying) continue;
          const ex = o.x - b.x, ey = o.y - b.y, de = Math.hypot(ex, ey) || 0.01, min = b.r + o.r + 6;
          if (de < min) { const f = (min - de) * 6 * dt, nx = ex / de, ny = ey / de; b.vx -= nx * f; b.vy -= ny * f; o.vx += nx * f; o.vy += ny * f; }
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // sun
      ctx.fillStyle = P.core; ctx.globalAlpha = light ? 0.9 : 0.85;
      ctx.beginPath(); ctx.arc(cx, cy, 5 + Math.sin(t * 2) * 0.6, 0, 6.283); ctx.fill();
      ctx.globalAlpha = light ? 0.35 : 0.22; ctx.strokeStyle = P.core; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, rim, 0, 6.283); ctx.setLineDash([2, 7]); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // bodies
      arr.forEach(b => {
        const damp = Math.exp(-dt * 2.2);
        b.vx *= damp; b.vy *= damp; b.x += b.vx * dt; b.y += b.vy * dt;
        b.x = Math.max(b.r, Math.min(W - b.r, b.x)); b.y = Math.max(b.r, Math.min(H - b.r, b.y));
        if (b.dying) {
          b.dying += dt;
          const u = b.dying / 0.7;
          if (u < 0.4) {                                  // contract
            const k = 1 - u / 0.4;
            draw(b, P, Math.max(2, b.rT * (0.25 + 0.75 * k)), 1);
            ctx.globalAlpha = 0.5 * k; ctx.strokeStyle = P.crit; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.rT * (1 + 2.5 * (1 - k)), 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
          } else {
            if (!b.burst) {
              b.burst = true;
              rings.push({ x: b.x, y: b.y, r: b.rT, age: 0, c: P.crit });
              const n = light ? 14 : 28; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 50 + Math.random() * 190; sparks.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.4, age: 0, c: i % 3 ? P.crit : P.warn }); }
            }
            if (u >= 1) { bodies.delete(b.pid); }
          }
          return;
        }
        if (b.gone && b.r < 1.2) { bodies.delete(b.pid); return; }
        draw(b, P, b.r, b.zombie ? 0.45 + 0.15 * Math.sin(t * 2 + b.ph) : 1);
      });
      // shockwaves + sparks
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.age += dt; const u = r.age / 0.6;
        if (u >= 1) { rings.splice(i, 1); continue; }
        ctx.globalAlpha = (1 - u) * 0.8; ctx.strokeStyle = r.c; ctx.lineWidth = 3 * (1 - u) + 0.5;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r + u * r.r * 3.2, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.age += dt;
        if (s.age >= s.life) { sparks.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.96; s.vy *= 0.96;
        ctx.globalAlpha = 1 - s.age / s.life; ctx.fillStyle = s.c; ctx.fillRect(Math.round(s.x), Math.round(s.y), 3, 3);
      }
      ctx.globalAlpha = 1;
      // hover
      let h = null, hd = 1e9;
      if (mx >= 0) bodies.forEach(b => { if (b.dying) return; const d = Math.hypot(b.x - mx, b.y - my); if (d <= b.r + 5 && d < hd) { hd = d; h = b; } });
      if (h !== hover) {
        hover = h; cv.style.cursor = h ? 'pointer' : '';
        if (h) {
          const p = h.p || {};
          tip.innerHTML = '<b></b><span></span>';
          tip.firstChild.textContent = p.comm + '  ·  PID ' + p.pid;
          tip.lastChild.textContent = 'CPU ' + (p.cpu || 0) + '%  ·  RAM ' + (p.mem || 0) + '%  ·  ' + (p.user || '') + (h.zombie ? '  ·  zombie' : h.stopped ? '  ·  stopped' : '');
          tip.style.display = 'block';
        } else tip.style.display = 'none';
      }
      if (hover) { tip.style.left = Math.min(W - 230, mx + 14) + 'px'; tip.style.top = Math.min(H - 50, my + 14) + 'px'; }
    }

    function draw(b, P, r, alpha) {
      const col = b.zombie ? P.zomb : (b.cpu > 50 ? P.crit : b.cpu > 15 ? P.warn : P.ok);
      ctx.globalAlpha = alpha;
      if (!lightTheme() && !b.zombie && b.cpu > 8) {            // soft halo grows with CPU (dark theme only)
        const g = ctx.createRadialGradient(b.x, b.y, r * 0.6, b.x, b.y, r * (1.7 + Math.min(1.2, b.cpu / 60)));
        g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r * 3, 0, 6.283); ctx.fill();
      }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(1, r), 0, 6.283); ctx.fill();
      if (b.stopped) { ctx.strokeStyle = P.text; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(b.x, b.y, r + 4, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); }
      if (r > 16 && b.p) { ctx.fillStyle = lightTheme() ? '#fff' : '#06090f'; ctx.font = '600 10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let n = String(b.p.comm || ''); const room = r * 1.7; while (n.length > 2 && ctx.measureText(n).width > room) n = n.slice(0, -2) + '…'; if (ctx.measureText(n).width <= room) ctx.fillText(n, b.x, b.y); }
      ctx.globalAlpha = 1;
    }

    const rel = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointermove', (e) => { const p = rel(e); mx = p[0]; my = p[1]; });
    cv.addEventListener('pointerleave', () => { mx = my = -1; });
    const open = (e) => { const p = rel(e); mx = p[0]; my = p[1]; if (hover && hover.p && opts.onContext) { e.preventDefault(); opts.onContext(e.clientX, e.clientY, hover.p); } };
    cv.addEventListener('click', open);
    cv.addEventListener('contextmenu', open);

    const stop = FX.task(step, FX.quality() === 'full' ? 45 : 30);
    function destroy() {
      if (dead) return; dead = true;
      try { stop(); } catch (_) {}
      try { ro.disconnect(); } catch (_) {}
      if (cv.parentNode) cv.parentNode.removeChild(cv);
      if (tip.parentNode) tip.parentNode.removeChild(tip);
      bodies.clear();
    }
    return { update: update, collapse: collapse, destroy: destroy };
  }

  const st = document.createElement('style');
  st.textContent = '.pu-tip{position:absolute;pointer-events:none;z-index:5;background:var(--sm-inset,#0b0f17);border:1px solid var(--border-color,var(--sm-line-strong));border-radius:8px;padding:.4rem .6rem;display:flex;flex-direction:column;gap:2px;font-size:.72rem;color:var(--text-primary);max-width:320px}' +
    '.pu-tip b{font-size:.8rem}.pu-tip span{color:var(--text-muted);font-family:var(--font-mono,monospace)}';
  document.head.appendChild(st);
  window.ShellmanProcUniverse = { mount: mount };
})();
