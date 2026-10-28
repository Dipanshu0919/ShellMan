/**
 * ShellMan: Fleet constellation (fleet3d.js)
 * A 3D view of the fleet. ShellMan is the sun in the middle; every server is a body on its own orbit.
 *   load      -> orbit speed and body size (CPU), so a busy server circles faster and looks bigger
 *   offline   -> the body goes dark and nearly stops
 *   click     -> the camera flies in to that server, then onOpen(id) shows its history
 *   rsync / git deploy -> a comet runs from the centre to that server for as long as the job runs
 * Three.js is loaded only when this view opens (ShellmanFX.loadThree). Everything is released on destroy().
 */
(function () {
  'use strict';
  if (window.ShellmanFleet3D) return;

  function mount(host, opts) {
    const FX = window.ShellmanFX;
    const out = { destroy() {}, update() {} };
    let dead = false;
    host.innerHTML = '<div class="fo-note">Loading the constellation…</div>';
    FX.loadThree().then(THREE => { if (!dead) start(THREE); }).catch((e) => { console.warn('fleet3d:', e && e.message); host.innerHTML = '<div class="fo-note">Could not load the 3D library.</div>'; });
    out.destroy = () => { dead = true; if (out._kill) out._kill(); };
    out.update = (servers, stateFn) => { out._pending = { servers, stateFn }; if (out._apply) out._apply(); };
    return out;

    function start(THREE) {
      host.innerHTML = '';
      const light = FX.light();
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;';
      host.appendChild(wrap);
      const cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      wrap.appendChild(cv);
      const labels = document.createElement('div');
      labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
      wrap.appendChild(labels);
      const tip = document.createElement('div');
      tip.className = 'fo-tip'; tip.style.display = 'none';
      wrap.appendChild(tip);

      let renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: FX.quality() === 'full', alpha: true, powerPreference: 'low-power' }); }
      catch (e) { console.warn('fleet3d renderer:', e && e.message); host.innerHTML = '<div class="fo-note">WebGL is not available in this browser.</div>'; return; }
      renderer.setClearColor(0x000000, 0);
      const dpr = Math.min(window.devicePixelRatio || 1, FX.quality() === 'full' ? 1.5 : 1);
      renderer.setPixelRatio(dpr);

      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
      const accent = new THREE.Color(FX.accent());
      const C = light
        ? { ok: new THREE.Color('#0f9d6e'), warn: new THREE.Color('#c27803'), crit: new THREE.Color('#d1243b'), off: new THREE.Color('#aab2c3'), ring: 0x8892a6, hub: new THREE.Color('#1d6fa5') }
        : { ok: new THREE.Color('#34d399'), warn: new THREE.Color('#fbbf24'), crit: new THREE.Color('#f43f5e'), off: new THREE.Color('#2a3140'), ring: 0x3b475c, hub: accent };
      const txt = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e6ebf5';

      // soft round sprite texture for glows and comet heads (dark theme only; light stays flat)
      const dot = document.createElement('canvas'); dot.width = dot.height = 64;
      const dg = dot.getContext('2d'), gr = dg.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      dg.fillStyle = gr; dg.fillRect(0, 0, 64, 64);
      const dotTex = new THREE.CanvasTexture(dot);
      const disposables = [dotTex];
      const track = (o) => { disposables.push(o); return o; };

      // stars
      if (!light) {
        const n = FX.quality() === 'full' ? 260 : 120, pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { const r = 40 + Math.random() * 40, a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1); pos[i * 3] = r * Math.sin(b) * Math.cos(a); pos[i * 3 + 1] = r * Math.cos(b); pos[i * 3 + 2] = r * Math.sin(b) * Math.sin(a); }
        const g = track(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const m = track(new THREE.PointsMaterial({ color: 0x9fb4d6, size: 0.18, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false }));
        scene.add(new THREE.Points(g, m));
      }

      // hub
      const hub = new THREE.Group(); scene.add(hub);
      const hubCore = new THREE.Mesh(track(new THREE.SphereGeometry(0.62, 24, 18)), track(new THREE.MeshBasicMaterial({ color: C.hub })));
      const hubCage = new THREE.LineSegments(track(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.05, 1))), track(new THREE.LineBasicMaterial({ color: C.hub, transparent: true, opacity: light ? 0.7 : 0.45 })));
      hub.add(hubCore, hubCage);
      if (!light) { const s = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: dotTex, color: C.hub, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }))); s.scale.set(4.6, 4.6, 1); hub.add(s); }
      const hubLab = addLabel('ShellMan', true);

      const bodies = new Map();    // server id -> body record
      let homeDist = 9;

      function addLabel(text, hubLabel) {
        const el = document.createElement('div');
        el.className = 'fo-lab' + (hubLabel ? ' hub' : '');
        el.style.color = txt;
        el.textContent = text;
        labels.appendChild(el);
        return el;
      }

      function makeBody(s, i) {
        const pivot = new THREE.Group();
        pivot.rotation.x = ((i % 5) - 2) * 0.11; pivot.rotation.z = (((i * 3) % 5) - 2) * 0.09;
        const R = 3.2 + i * 1.25;
        const pts = []; for (let k = 0; k < 96; k++) { const a = (k / 96) * 6.2832; pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); }
        const ring = new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(pts)), track(new THREE.LineBasicMaterial({ color: C.ring, transparent: true, opacity: light ? 0.55 : 0.4 })));
        pivot.add(ring);
        const mat = track(new THREE.MeshBasicMaterial({ color: C.ok }));
        const mesh = new THREE.Mesh(track(new THREE.SphereGeometry(1, 20, 14)), mat);
        const hit = new THREE.Mesh(track(new THREE.SphereGeometry(1, 8, 6)), track(new THREE.MeshBasicMaterial({ visible: false })));
        hit.scale.setScalar(2.4); mesh.add(hit); hit.userData.id = s.id;
        const holder = new THREE.Group(); holder.add(mesh); pivot.add(holder);
        let glow = null;
        if (!light) { glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: dotTex, color: C.ok, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }))); mesh.add(glow); }
        scene.add(pivot);
        const rec = { id: s.id, name: s.name, pivot, ring, holder, mesh, mat, glow, hit, R, ang: i * 2.399, size: 0.3, speed: 0.1, cpu: 0, mem: 0, disk: 0, state: 'ok', online: true, lab: addLabel(s.name), sizeT: 0.3, speedT: 0.1, dim: 1, dimT: 1, col: C.ok.clone() };
        return rec;
      }

      function apply() {
        const p = out._pending; if (!p) return;
        const list = p.servers || [];
        const keep = new Set(list.map(s => s.id));
        bodies.forEach((b, id) => { if (!keep.has(id)) { scene.remove(b.pivot); if (b.lab.parentNode) b.lab.parentNode.removeChild(b.lab); bodies.delete(id); } });
        list.forEach((s, i) => {
          let b = bodies.get(s.id);
          if (!b) { b = makeBody(s, i); bodies.set(s.id, b); }
          const st = p.stateFn ? p.stateFn(s) : 'ok';
          const sm = s.sample || { cpu: 0, mem: 0, disk: 0 };
          b.name = s.name; b.lab.firstChild && (b.lab.firstChild.nodeValue = s.name);
          b.state = st; b.online = !!s.online && st !== 'off';
          b.cpu = sm.cpu || 0; b.mem = sm.mem || 0; b.disk = sm.disk || 0;
          b.sizeT = b.online ? 0.26 + Math.min(100, b.cpu) / 100 * 0.42 : 0.22;
          b.speedT = b.online ? 0.09 + Math.min(100, b.cpu) / 100 * 0.95 : 0.015;
          b.dimT = b.online ? 1 : 0.35;
        });
        const maxR = 3.2 + Math.max(0, list.length - 1) * 1.25;
        homeDist = Math.max(8, maxR * 2.05);
      }
      out._apply = apply; apply();

      // ----- comets (rsync / deploy) -----
      const comets = new Map();   // server id -> { dir, nextAt, shots[] }
      function spawn(rec, dir) {
        const heads = [];
        const N = 14;
        for (let i = 0; i < N; i++) {
          const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: dotTex, color: dir === 'in' ? 0xfbbf24 : (light ? 0x1d6fa5 : 0x7dd3fc), transparent: true, depthWrite: false, blending: light ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: 0 })));
          scene.add(sp); heads.push(sp);
        }
        return { heads, t: 0, dur: 1.5, dir, rec, bow: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3) };
      }
      const flying = [];
      const wp = new THREE.Vector3(), a = new THREE.Vector3(), b2 = new THREE.Vector3(), m = new THREE.Vector3();
      function cometStep(c, dt) {
        c.t += dt; const u = Math.min(1, c.t / c.dur);
        c.rec.mesh.getWorldPosition(wp);
        const from = c.dir === 'in' ? wp : a.set(0, 0, 0), to = c.dir === 'in' ? a.set(0, 0, 0) : wp;
        const F = from.clone(), T = to.clone();
        const mid = F.clone().add(T).multiplyScalar(0.5).add(c.bow);
        c.heads.forEach((sp, i) => {
          const uu = Math.max(0, u - i * 0.022), e = 1 - Math.pow(1 - uu, 2.2);
          const q = F.clone().multiplyScalar((1 - e) * (1 - e)).add(mid.clone().multiplyScalar(2 * (1 - e) * e)).add(T.clone().multiplyScalar(e * e));
          sp.position.copy(q);
          const s = Math.max(0.12, 0.62 - i * 0.04) * (light ? 0.6 : 1);
          sp.scale.set(s, s, 1);
          sp.material.opacity = (u <= 0 || (uu <= 0 && i > 0) ? 0 : (1 - i / c.heads.length) * (u > 0.94 ? (1 - u) / 0.06 : 1));
        });
        if (u >= 1) { c.heads.forEach(sp => scene.remove(sp)); if (c.dir === 'out') c.rec.pulse = 1; return false; }
        return true;
      }
      function applyTransfers() {
        const T = FX.transfers ? FX.transfers() : {};
        Object.keys(T).forEach(id => { if (!comets.has(Number(id))) comets.set(Number(id), { dir: T[id].dir, nextAt: 0 }); });
      }
      const onTransfer = (e) => {
        const d = e.detail || {}; const id = Number(d.server_id); if (!id) return;
        if (d.phase === 'start') comets.set(id, { dir: d.dir || 'out', nextAt: 0 });
        else { comets.delete(id); const r = bodies.get(id); if (r) r.pulse = 1; }
      };
      window.addEventListener('shellman-fx-transfer', onTransfer);
      applyTransfers();

      // ----- interaction -----
      const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(-9, -9);
      let hover = null, down = null, fly = null, back = null, mx = 0, my = 0, hasPtr = false;
      cv.addEventListener('pointermove', (e) => {
        const r = cv.getBoundingClientRect();
        ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        mx = ptr.x; my = ptr.y; hasPtr = true;
        tip.style.left = Math.min(r.width - 170, e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
      });
      cv.addEventListener('pointerleave', () => { ptr.set(-9, -9); hasPtr = false; hover = null; tip.style.display = 'none'; cv.style.cursor = ''; });
      const pickAt = (e) => {
        const r = cv.getBoundingClientRect();
        ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ptr, cam);
        const hits = ray.intersectObjects(Array.from(bodies.values()).map(b => b.hit), false);
        return hits.length ? hits[0].object.userData.id : null;
      };
      cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, id: pickAt(e) }; });
      cv.addEventListener('pointerup', (e) => {
        if (!down || fly) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), pressed = down.id; down = null;
        if (moved > 5 || !pressed) return;
        const rec = bodies.get(pressed);
        if (!rec) return;
        rec.mesh.getWorldPosition(wp);
        fly = { id: rec.id, t: 0, dur: 1.0, from: cam.position.clone(), fromLook: new THREE.Vector3(0, 0, 0), opened: false };
        tip.style.display = 'none';
      });

      // ----- size + frame -----
      function resize() {
        const w = Math.max(10, wrap.clientWidth), h = Math.max(10, wrap.clientHeight);
        renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      }
      const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
      cam.position.set(0, homeDist * 0.5, homeDist);
      const look = new THREE.Vector3(), tgt = new THREE.Vector3(), home = new THREE.Vector3();
      const proj = new THREE.Vector3();
      let clock = 0, lastOpenAt = 0;

      function labelAt(el, v3, dy) {
        proj.copy(v3).project(cam);
        if (proj.z > 1) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.style.transform = 'translate(' + ((proj.x * 0.5 + 0.5) * wrap.clientWidth).toFixed(1) + 'px,' + ((-proj.y * 0.5 + 0.5) * wrap.clientHeight + dy).toFixed(1) + 'px) translate(-50%,0)';
      }

      const stopTask = FX.task((t, dt) => {
        if (dead) return false;
        if (!wrap.isConnected) { out._kill(); return false; }
        if (wrap.clientWidth < 20) return;
        clock += dt;
        const k = 1 - Math.exp(-dt * 4);
        hub.rotation.y += dt * 0.25; hubCage.rotation.x += dt * 0.12;
        // bodies
        bodies.forEach(b => {
          b.size += (b.sizeT - b.size) * k; b.speed += (b.speedT - b.speed) * k; b.dim += (b.dimT - b.dim) * k;
          b.ang += b.speed * dt;
          b.holder.position.set(Math.cos(b.ang) * b.R, 0, Math.sin(b.ang) * b.R);
          if (b.pulse) b.pulse = Math.max(0, b.pulse - dt * 1.6);
          const sc = b.size * (1 + (b.pulse || 0) * 0.5);
          b.mesh.scale.setScalar(sc);
          const target = b.online ? (b.state === 'crit' ? C.crit : b.state === 'warn' ? C.warn : C.ok) : C.off;
          b.col.lerp(target, k); b.mat.color.copy(b.col);
          if (b.glow) { b.glow.material.color.copy(b.col); b.glow.scale.setScalar(3.2 + (b.pulse || 0) * 2); b.glow.material.opacity = b.online ? (0.35 + Math.min(1, b.cpu / 100) * 0.45) : 0.05; }
          b.ring.material.opacity = (light ? 0.55 : 0.4) * (0.45 + 0.55 * b.dim);
          b.lab.style.opacity = b.online ? 1 : 0.5;
        });
        // comets
        comets.forEach((c, id) => {
          const rec = bodies.get(id); if (!rec) return;
          c.nextAt -= dt;
          if (c.nextAt <= 0) { flying.push(spawn(rec, c.dir)); c.nextAt = 1.25; }
        });
        for (let i = flying.length - 1; i >= 0; i--) if (!cometStep(flying[i], dt)) flying.splice(i, 1);
        // hover
        if (hasPtr && !fly) {
          ray.setFromCamera(ptr, cam);
          const hits = ray.intersectObjects(Array.from(bodies.values()).map(b => b.hit), false);
          const id = hits.length ? hits[0].object.userData.id : null;
          if (id !== hover) {
            hover = id; cv.style.cursor = id ? 'pointer' : '';
            if (id) {
              const b = bodies.get(id);
              tip.innerHTML = '<b></b><span></span>'; tip.firstChild.textContent = b.name;
              tip.lastChild.textContent = b.online ? ('CPU ' + Math.round(b.cpu) + '%  ·  RAM ' + Math.round(b.mem) + '%  ·  Disk ' + Math.round(b.disk) + '%') : 'Offline';
              tip.style.display = 'block';
            } else tip.style.display = 'none';
          }
        }
        // camera
        home.set(Math.sin(clock * 0.07) * homeDist * 0.16 + mx * 1.2, homeDist * 0.46 + my * 0.8, homeDist);
        if (fly) {
          fly.t += dt; const u = Math.min(1, fly.t / fly.dur), e = u * u * (3 - 2 * u);
          const rec = bodies.get(fly.id);
          if (rec) {
            rec.mesh.getWorldPosition(wp);
            const dir = wp.clone().normalize();
            tgt.copy(wp).addScaledVector(dir, 1.7).add(new THREE.Vector3(0, 0.7, 0));
            cam.position.lerpVectors(fly.from, tgt, e);
            look.lerpVectors(fly.fromLook, wp, e); cam.lookAt(look);
            host.style.setProperty('--fo-fade', String(Math.max(0, (u - 0.7) / 0.3)));
          }
          if (u >= 1 && !fly.opened) { fly.opened = true; lastOpenAt = clock; try { opts.onOpen && opts.onOpen(fly.id); } catch (_) {} }
          if (u >= 1 && clock - lastOpenAt > 0.5) { back = { t: 0, from: cam.position.clone() }; fly = null; host.style.setProperty('--fo-fade', '0'); }
        } else if (back) {
          back.t += dt; const u = Math.min(1, back.t / 0.8), e = u * u * (3 - 2 * u);
          cam.position.lerpVectors(back.from, home, e); look.set(0, 0, 0); cam.lookAt(look);
          if (u >= 1) back = null;
        } else {
          cam.position.lerp(home, 1 - Math.exp(-dt * 2)); look.set(0, 0, 0); cam.lookAt(look);
        }
        if (dead) return false;
        // labels
        bodies.forEach(b => { b.mesh.getWorldPosition(wp); wp.y += b.size + 0.2; labelAt(b.lab, wp, -18); });
        labelAt(hubLab, new THREE.Vector3(0, -1.25, 0), 4);
        renderer.render(scene, cam);
      }, FX.quality() === 'full' ? 45 : 30);

      out._state = () => ({ fly: fly && { t: fly.t, opened: fly.opened, id: fly.id }, hover: hover, back: !!back, clock: clock });
      window.ShellmanFleet3D.last = out;
      out._kill = () => {
        dead = true;
        try { stopTask(); } catch (_) {}
        window.removeEventListener('shellman-fx-transfer', onTransfer);
        try { ro.disconnect(); } catch (_) {}
        disposables.forEach(o => { try { o.dispose(); } catch (_) {} });
        try { renderer.dispose(); renderer.forceContextLoss(); } catch (_) {}
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        out._kill = null;
      };
    }
  }

  const st = document.createElement('style');
  st.textContent = '.fo-note{padding:2rem;text-align:center;color:var(--text-muted)}' +
    '.fo-lab{position:absolute;left:0;top:0;font:600 .72rem/1 var(--font-sans,system-ui);white-space:nowrap;pointer-events:none;will-change:transform}' +
    '.fo-lab.hub{font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.8}' +
    '.fo-tip{position:absolute;pointer-events:none;z-index:5;background:var(--sm-inset,#0b0f17);border:1px solid var(--border-color,var(--sm-line-strong));border-radius:8px;padding:.4rem .6rem;display:flex;flex-direction:column;gap:2px;font-size:.72rem;color:var(--text-primary)}' +
    '.fo-tip b{font-size:.8rem}.fo-tip span{color:var(--text-muted);font-family:var(--font-mono,monospace)}' +
    '[data-orbit]{position:relative}[data-orbit]::after{content:"";position:absolute;inset:0;pointer-events:none;background:var(--bg-canvas,#0b0f17);opacity:var(--fo-fade,0)}';
  document.head.appendChild(st);

  window.ShellmanFleet3D = { mount: mount };
})();
