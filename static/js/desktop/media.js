/**
 * ShellMan OS: Media Player (media.js)
 * Audio, video and every image type, from the remote server (streamed over SFTP, seekable) or from this computer.
 * Image viewer, decoders and file kinds come from mediaviewer.js.
 */
(function () {
  'use strict';
  const PREF = 'shellman_media';
  const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF) || 'null') || {}; } catch (_) { return {}; } };
  const savePrefs = (p) => { try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (_) {} };

  if (!document.getElementById('mpStyles')) {
    const st = document.createElement('style');
    st.id = 'mpStyles';
    st.textContent = '' +
      '.mp{display:flex;height:100%;background:var(--bg-canvas);color:var(--text-primary);font-family:var(--font-sans);overflow:hidden;position:relative}' +
      '.mp-side{width:280px;flex:0 0 280px;display:flex;flex-direction:column;background:var(--bg-surface);border-right:1px solid var(--border-subtle);min-width:0;transition:margin .18s}' +
      '.mp.nosb .mp-side{margin-left:-280px}' +
      '.mp-side-h{padding:.55rem .6rem;display:flex;flex-direction:column;gap:.45rem;border-bottom:1px solid var(--border-subtle)}' +
      '.mp-row{display:flex;gap:.35rem;align-items:center}' +
      '.mp-path{flex:1;min-width:0;font:.7rem var(--font-mono,monospace);padding:.3rem .5rem}' +
      '.mp-chips{display:flex;gap:.25rem}.mp-chip{flex:1;padding:.22rem 0;border:1px solid var(--border-default);border-radius:999px;background:transparent;color:var(--text-muted);font-size:.68rem;font-weight:600;cursor:pointer}' +
      '.mp-chip.on{background:var(--sm-accent);border-color:var(--sm-accent);color:#04121f}' +
      '.mp-list{flex:1;overflow-y:auto;padding:.3rem}' +
      '.mp-it{display:flex;align-items:center;gap:.55rem;padding:.38rem .5rem;border-radius:8px;cursor:pointer;font-size:.76rem;min-width:0;position:relative}' +
      '.mp-it:hover{background:rgba(var(--wash),.07)}.mp-it.on{background:rgba(var(--wash),.1)}' +
      '.mp-it.on::before{content:"";position:absolute;left:0;top:7px;bottom:7px;width:3px;border-radius:3px;background:var(--sm-accent)}' +
      '.mp-it .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mp-it small{color:var(--text-muted);font:.64rem var(--font-mono,monospace);flex:0 0 auto}' +
      '.mp-it svg{flex:0 0 auto}' +
      '.mp-main{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--sm-inset,#0b1020)}' +
      '.mp-top{display:flex;align-items:center;gap:.4rem;padding:.4rem .6rem;background:var(--bg-surface);border-bottom:1px solid var(--border-subtle);min-height:40px}' +
      '.mp-title{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.2}.mp-title b{font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mp-title small{font:.64rem var(--font-mono,monospace);color:var(--text-muted)}' +
      '.mp-ib{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 7px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--text-secondary);cursor:pointer;font:600 .68rem var(--font-mono,monospace)}' +
      '.mp-ib:hover{background:rgba(var(--wash),.1);color:var(--text-primary)}.mp-ib.on{color:var(--sm-accent);border-color:color-mix(in srgb,var(--sm-accent) 45%,transparent)}.mp-ib svg{width:16px;height:16px}' +
      '.mp-ib:disabled{opacity:.35;cursor:default}' +
      '.mp-sel{height:28px;font-size:.7rem;padding:0 .3rem;border-radius:8px;background:transparent;color:var(--text-secondary);border:1px solid var(--border-default)}' +
      '.mp-stage{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;outline:none}' +
      '.mp-stage video{width:100%;height:100%;background:#000;object-fit:contain}' +
      '.mp-aud{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:1.5rem;min-width:0}' +
      '.mp-aud canvas{width:min(560px,100%);height:180px}' +
      '.mp-aud .t{font-size:1rem;font-weight:700;text-align:center;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mp-aud .s{font:.7rem var(--font-mono,monospace);color:var(--text-muted)}' +
      '.mp-aud audio{width:min(560px,100%)}' +
      '.mp-empty{display:flex;flex-direction:column;align-items:center;gap:.6rem;color:var(--text-muted);text-align:center;padding:1.5rem;font-size:.8rem}' +
      '.mp-empty svg{width:54px;height:54px;color:var(--sm-accent);opacity:.8}.mp-empty kbd{font:600 .66rem var(--font-mono,monospace);padding:2px 6px;border:1px solid var(--border-default);border-radius:5px}' +
      '.mp-err{display:flex;flex-direction:column;align-items:center;gap:.6rem;color:var(--accent-rose,#fb7185);font-size:.8rem;text-align:center;padding:1.5rem}' +
      '.mp.drop::after{content:"Drop to play";position:absolute;inset:8px;border:2px dashed var(--sm-accent);border-radius:12px;background:rgba(var(--panel-rgb),.8);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--sm-accent);z-index:50;pointer-events:none}' +
      '@media (max-width:760px){.mp-side{position:absolute;z-index:10;height:100%}.mp.nosb .mp-side{margin-left:-280px}}';
    document.head.appendChild(st);
  }

  const ICO = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM20 6v12L9.5 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM4 6v12l10.5-6z"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    side: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    pip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="12" width="8" height="6" rx="1" fill="currentColor"/></svg>',
    slide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    big: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>'
  };

  DesktopAppsController.prototype.launchMedia = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('media');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      if (params.path && existing._mediaOpen) existing._mediaOpen(params.path);
      return existing;
    }

    const M = window.ShellmanMedia;
    const sid = this.serverId;
    const fetch = RequestScope.next();
    const id = 'mp_' + Date.now();
    const prefs = loadPrefs();
    const state = {
      dir: null, items: [], filter: prefs.filter || 'all', queue: [], idx: -1,
      shuffle: !!prefs.shuffle, repeat: prefs.repeat || 'off', side: prefs.side !== false, slide: false,
      volume: typeof prefs.volume === 'number' ? prefs.volume : 1, rate: prefs.rate || 1, muted: !!prefs.muted
    };
    const hist = [];            // previously played queue indexes (for Previous while shuffling)
    let cur = null;             // { el, viewer, kind, stop() }
    let slideT = 0, audioCtx = null, raf = 0, blobs = [];
    const esc = M.esc;

    const iconFor = (name, dir) => (window.ShellmanFileIcons ? window.ShellmanFileIcons.render({ name, is_dir: !!dir }, 18) : '');

    const win = WindowManager.createWindow({
      appId: 'media',
      multiInstance: false,
      title: 'Media Player',
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="6" fill="#db2777"/><path d="M9.5 7.5v9l7-4.5z" fill="#fff"/></svg>',
      width: 1040, height: 640, minWidth: 520, minHeight: 360,
      contentHtml: `
        <div class="mp" id="${id}">
          <aside class="mp-side">
            <div class="mp-side-h">
              <div class="mp-row">
                <button class="mp-ib" data-a="up" title="Parent folder">${ICO.up}</button>
                <input class="form-control mp-path" data-a="path" spellcheck="false" placeholder="/path/to/media" title="Folder on the server (Enter to go)">
                <button class="mp-ib" data-a="local" title="Open files from this computer">${ICO.open}</button>
              </div>
              <div class="mp-chips">
                <button class="mp-chip" data-f="all">All</button><button class="mp-chip" data-f="video">Video</button><button class="mp-chip" data-f="audio">Audio</button><button class="mp-chip" data-f="image">Images</button>
              </div>
              <input type="file" data-a="file" multiple hidden accept="audio/*,video/*,image/*,.heic,.heif,.tif,.tiff,.mkv,.flac,.opus,.avif,.jxl">
            </div>
            <div class="mp-list" data-r="list"></div>
          </aside>
          <section class="mp-main">
            <div class="mp-top">
              <button class="mp-ib" data-a="side" title="Show / hide the file list">${ICO.side}</button>
              <div class="mp-title"><b data-r="title">Nothing playing</b><small data-r="sub">Pick a file from the list</small></div>
              <select class="mp-sel" data-a="rate" title="Playback speed" style="display:none">
                <option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option>
              </select>
              <button class="mp-ib" data-a="pip" title="Picture in picture" style="display:none">${ICO.pip}</button>
              <button class="mp-ib" data-a="slide" title="Slideshow (images)">${ICO.slide}</button>
              <button class="mp-ib" data-a="shuffle" title="Shuffle">${ICO.shuffle}</button>
              <button class="mp-ib" data-a="repeat" title="Repeat: off">${ICO.repeat}</button>
              <button class="mp-ib" data-a="prev" title="Previous (P)">${ICO.prev}</button>
              <button class="mp-ib" data-a="next" title="Next (N)">${ICO.next}</button>
              <a class="mp-ib" data-r="dl" title="Download" style="display:none;text-decoration:none">${ICO.dl}</a>
            </div>
            <div class="mp-stage" tabindex="0" data-r="stage"></div>
          </section>
        </div>`
    });
    win.onClose = () => { stopCurrent(); clearInterval(slideT); cancelAnimationFrame(raf); blobs.forEach(b => URL.revokeObjectURL(b.url)); try { if (audioCtx) audioCtx.close(); } catch (_) {} };

    const root = win.bodyEl.querySelector('#' + id);
    const $ = (s) => root.querySelector(s);
    const R = (n) => root.querySelector('[data-r="' + n + '"]');
    const stage = R('stage'), listEl = R('list'), pathEl = $('[data-a="path"]');

    // ---------- sidebar ----------
    const applyChrome = () => {
      root.classList.toggle('nosb', !state.side);
      root.querySelectorAll('.mp-chip').forEach(c => c.classList.toggle('on', c.dataset.f === state.filter));
      $('[data-a="shuffle"]').classList.toggle('on', state.shuffle);
      const rp = $('[data-a="repeat"]'); rp.classList.toggle('on', state.repeat !== 'off'); rp.title = 'Repeat: ' + state.repeat; rp.textContent = ''; rp.innerHTML = ICO.repeat + (state.repeat === 'one' ? '<span style="margin-left:2px">1</span>' : '');
      $('[data-a="slide"]').classList.toggle('on', state.slide);
    };
    const persist = () => savePrefs({ filter: state.filter, shuffle: state.shuffle, repeat: state.repeat, side: state.side, volume: state.volume, rate: state.rate, muted: state.muted });

    const mediaItems = () => state.items.filter(i => !i.is_dir && M.kind(i.name) && (state.filter === 'all' || M.kind(i.name) === state.filter));
    const renderList = () => {
      const folders = state.items.filter(i => i.is_dir);
      const media = mediaItems();
      let h = '';
      if (!sid) h = '<div class="mp-empty">No server selected.<br>Use the folder button to open files from this computer.</div>';
      else {
        folders.forEach(f => { h += '<div class="mp-it" data-dir="' + esc(f.path) + '">' + iconFor(f.name, true) + '<span class="n">' + esc(f.name) + '</span></div>'; });
        media.forEach(f => { const i = state.queue.findIndex(q => q.path === f.path); h += '<div class="mp-it' + (i === state.idx && i >= 0 ? ' on' : '') + '" data-file="' + esc(f.path) + '" title="' + esc(f.name) + '">' + iconFor(f.name) + '<span class="n">' + esc(f.name) + '</span><small>' + esc(f.size_formatted || '') + '</small></div>'; });
        if (!folders.length && !media.length) h = '<div class="mp-empty">No ' + (state.filter === 'all' ? 'media' : state.filter) + ' files here</div>';
      }
      listEl.innerHTML = h;
      const on = listEl.querySelector('.mp-it.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    };

    const loadDir = async (path, keepQueue) => {
      if (!sid) { renderList(); return; }
      listEl.innerHTML = '<div class="mp-empty"><span class="spinner-border spinner-border-sm"></span></div>';
      try {
        const r = await fetch('/api/servers/' + sid + '/files/list?path=' + encodeURIComponent(path || '~'));
        const j = await r.json();
        if (!j.success) { listEl.innerHTML = '<div class="mp-empty" style="color:var(--accent-rose)">' + esc(j.error || 'Could not open folder') + '</div>'; return; }
        state.dir = j.data.current_path; state.parent = j.data.parent_path; state.items = j.data.items || [];
        pathEl.value = state.dir;
        if (!keepQueue) {
          const curPath = state.queue[state.idx] && state.queue[state.idx].path;
          state.queue = mediaItems().map(i => ({ name: i.name, path: i.path, size: i.size, size_formatted: i.size_formatted }));
          state.idx = state.queue.findIndex(q => q.path === curPath);
        }
        renderList();
      } catch (e) { if (!e || e.name !== 'AbortError') listEl.innerHTML = '<div class="mp-empty" style="color:var(--accent-rose)">' + esc(e) + '</div>'; }
    };
    const rebuildQueue = () => {
      const curPath = state.queue[state.idx] && state.queue[state.idx].path;
      if (state.dir === null) return;                       // playing local files: the queue is the file list
      state.queue = mediaItems().map(i => ({ name: i.name, path: i.path, size: i.size, size_formatted: i.size_formatted }));
      state.idx = state.queue.findIndex(q => q.path === curPath);
    };

    // ---------- playback ----------
    function stopCurrent() {
      cancelAnimationFrame(raf);
      if (cur) {
        try { if (cur.viewer) cur.viewer.destroy(); } catch (_) {}
        try { if (cur.media) { cur.media.pause(); cur.media.removeAttribute('src'); cur.media.load(); } } catch (_) {}
        cur = null;
      }
      stage.innerHTML = '';
    }
    const setHead = (title, sub, entry) => {
      R('title').textContent = title; R('sub').textContent = sub || '';
      win.titleEl.textContent = title ? title + ' — Media Player' : 'Media Player';
      const dl = R('dl');
      if (entry && entry.dl) { dl.href = entry.dl; dl.style.display = ''; dl.setAttribute('download', entry.name); } else dl.style.display = 'none';
    };
    const showError = (entry, text) => {
      stage.innerHTML = '<div class="mp-err"><div>' + esc(text) + '</div>' + (entry.dl ? '<a class="btn btn-secondary btn-sm" href="' + esc(entry.dl) + '">Download file</a>' : '') + '<button class="btn btn-ghost btn-sm" data-a="next">Skip to next</button></div>';
    };
    const urlsFor = (entry) => entry.blob ? { src: entry.blob, dl: entry.blob } : { src: M.viewUrl(sid, entry.path), dl: M.downloadUrl(sid, entry.path) };
    const onEnded = () => {
      if (state.repeat === 'one' && cur && cur.media) { cur.media.currentTime = 0; cur.media.play().catch(() => {}); return; }
      next(true);
    };

    function play(i, fromHistory) {
      if (i < 0 || i >= state.queue.length) return;
      if (!fromHistory && state.idx >= 0 && state.idx !== i) hist.push(state.idx);
      state.idx = i;
      const entry = Object.assign({}, state.queue[i]); const u = urlsFor(entry); entry.dl = u.dl;
      stopCurrent();
      const kind = M.kind(entry.name);
      setHead(entry.name, (i + 1) + ' / ' + state.queue.length + (entry.size_formatted ? '  ·  ' + entry.size_formatted : ''), entry);
      $('[data-a="rate"]').style.display = (kind === 'video' || kind === 'audio') ? '' : 'none';
      $('[data-a="pip"]').style.display = kind === 'video' && document.pictureInPictureEnabled ? '' : 'none';
      renderList();
      if (kind === 'image') {
        const viewer = M.mountImage(stage, { url: u.src, name: entry.name, size: entry.size, bg: prefs.imgbg || 'dark' });
        cur = { kind, viewer }; viewer.focus();
        clearInterval(slideT);
        if (state.slide) slideT = setInterval(() => next(true), 4000);
      } else if (kind === 'video') {
        clearInterval(slideT);
        const v = document.createElement('video');
        v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'metadata'; v.src = u.src;
        v.volume = state.volume; v.muted = state.muted; v.playbackRate = state.rate;
        v.addEventListener('ended', onEnded);
        v.addEventListener('volumechange', () => { state.volume = v.volume; state.muted = v.muted; persist(); });
        v.addEventListener('ratechange', () => { state.rate = v.playbackRate; $('[data-a="rate"]').value = String(state.rate); persist(); });
        v.addEventListener('loadedmetadata', () => { v.playbackRate = state.rate; R('sub').textContent = (i + 1) + ' / ' + state.queue.length + '  ·  ' + v.videoWidth + '×' + v.videoHeight + '  ·  ' + fmtTime(v.duration) + (entry.size_formatted ? '  ·  ' + entry.size_formatted : ''); });
        v.addEventListener('error', () => { if (cur && cur.media === v) showError(entry, 'This browser cannot play this video (' + (M.extOf(entry.name) || 'unknown').toUpperCase() + ' or its codec). It can be downloaded and opened in a desktop player.'); });
        stage.appendChild(v); cur = { kind, media: v }; v.play().catch(() => {});
        stage.focus({ preventScroll: true });
      } else if (kind === 'audio') {
        clearInterval(slideT);
        const wrap = document.createElement('div'); wrap.className = 'mp-aud';
        wrap.innerHTML = '<canvas width="1120" height="360"></canvas><div class="t">' + esc(entry.name.replace(/\.[^.]+$/, '')) + '</div><div class="s">' + esc(M.extOf(entry.name).toUpperCase()) + (entry.size_formatted ? ' · ' + esc(entry.size_formatted) : '') + '</div>';
        const a = document.createElement('audio');
        a.controls = true; a.autoplay = true; a.preload = 'metadata'; a.src = u.src; a.volume = state.volume; a.muted = state.muted; a.playbackRate = state.rate;
        a.addEventListener('ended', onEnded);
        a.addEventListener('volumechange', () => { state.volume = a.volume; state.muted = a.muted; persist(); });
        a.addEventListener('ratechange', () => { state.rate = a.playbackRate; $('[data-a="rate"]').value = String(state.rate); persist(); });
        a.addEventListener('loadedmetadata', () => { a.playbackRate = state.rate; R('sub').textContent = (i + 1) + ' / ' + state.queue.length + '  ·  ' + fmtTime(a.duration) + (entry.size_formatted ? '  ·  ' + entry.size_formatted : ''); });
        a.addEventListener('error', () => { if (cur && cur.media === a) showError(entry, 'This browser cannot play this audio (' + (M.extOf(entry.name) || 'unknown').toUpperCase() + ').'); });
        wrap.appendChild(a); stage.appendChild(wrap); cur = { kind, media: a };
        visualize(a, wrap.querySelector('canvas'));
        a.play().catch(() => {});
        stage.focus({ preventScroll: true });
      } else {
        showError(entry, 'Not a media file.');
      }
      $('[data-a="rate"]').value = String(state.rate);
    }

    function next(auto) {
      if (!state.queue.length) return;
      let i;
      if (state.shuffle && state.queue.length > 1) { do { i = Math.floor(Math.random() * state.queue.length); } while (i === state.idx); }
      else { i = state.idx + 1; if (i >= state.queue.length) { if (state.repeat === 'all' || (!auto)) i = 0; else { if (auto) { if (cur && cur.media) cur.media.pause(); clearInterval(slideT); state.slide = false; applyChrome(); } return; } } }
      play(i);
    }
    function prev() {
      if (cur && cur.media && cur.media.currentTime > 3) { cur.media.currentTime = 0; return; }
      if (hist.length) { play(hist.pop(), true); return; }
      if (!state.queue.length) return;
      play((state.idx - 1 + state.queue.length) % state.queue.length, true);
    }
    const fmtTime = (s) => { if (!isFinite(s)) return '--:--'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0'); };

    function visualize(audio, canvas) {
      const g = canvas.getContext('2d');
      const css = getComputedStyle(root);
      let an = null, data = null;
      const connect = () => {
        if (an) return;
        try {
          audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
          const src = audioCtx.createMediaElementSource(audio);
          an = audioCtx.createAnalyser(); an.fftSize = 128; an.smoothingTimeConstant = 0.8;
          src.connect(an); an.connect(audioCtx.destination);
          data = new Uint8Array(an.frequencyBinCount);
        } catch (_) { an = null; }
      };
      audio.addEventListener('play', () => { connect(); try { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (_) {} });
      const N = 48; const tmp = new Float32Array(N);
      const draw = (t) => {
        if (!canvas.isConnected) return;
        const w = canvas.width, h = canvas.height;
        g.clearRect(0, 0, w, h);
        const col = (css.getPropertyValue('--sm-accent') || '#38bdf8').trim();
        const playing = !audio.paused && !audio.ended;
        if (an && playing) an.getByteFrequencyData(data);
        const bw = w / N;
        for (let i = 0; i < N; i++) {
          let v;
          if (an && playing) v = (data[Math.min(data.length - 1, Math.floor(i * data.length / N * 0.8))] || 0) / 255;
          else v = playing ? (0.25 + 0.2 * Math.sin(t / 260 + i * 0.5)) : 0.05;      // no analyser: gentle idle motion
          tmp[i] += (v - tmp[i]) * 0.35;
          const bh = Math.max(4, tmp[i] * h * 0.95);
          g.fillStyle = col; g.globalAlpha = 0.35 + tmp[i] * 0.65;
          const x = i * bw + bw * 0.18, ww = bw * 0.64, r = Math.min(ww / 2, 8);
          g.beginPath(); g.moveTo(x, h / 2 - bh / 2 + r); g.arcTo(x, h / 2 - bh / 2, x + ww, h / 2 - bh / 2, r); g.arcTo(x + ww, h / 2 - bh / 2, x + ww, h / 2 + bh / 2, r); g.arcTo(x + ww, h / 2 + bh / 2, x, h / 2 + bh / 2, r); g.arcTo(x, h / 2 + bh / 2, x, h / 2 - bh / 2, r); g.closePath(); g.fill();
        }
        g.globalAlpha = 1;
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    }

    // ---------- opening things ----------
    const openRemote = async (path) => {
      if (!sid) return;
      const dir = path.replace(/\/[^\/]*$/, '') || '/';
      if (dir !== state.dir) { await loadDir(dir, false); }
      let i = state.queue.findIndex(q => q.path === path);
      if (i < 0) { state.filter = 'all'; applyChrome(); rebuildQueue(); i = state.queue.findIndex(q => q.path === path); }
      if (i < 0) { state.queue.push({ name: path.split('/').pop(), path }); i = state.queue.length - 1; }
      play(i);
    };
    win._mediaOpen = openRemote;

    const addLocal = (files) => {
      const list = Array.from(files).filter(f => M.kind(f.name) || /^(audio|video|image)\//.test(f.type));
      if (!list.length) { if (window.showToast) window.showToast('No audio, video or image files in that selection', 'warning'); return; }
      const entries = list.map(f => { const url = URL.createObjectURL(f); const e = { name: f.name, path: 'local:' + f.name + ':' + f.size, size: f.size, size_formatted: M.fmtBytes(f.size), blob: url }; blobs.push({ url, entry: e, inQueue: true }); return e; });
      state.queue = entries; state.dir = null; state.items = []; pathEl.value = ''; hist.length = 0;
      listEl.innerHTML = entries.map((e, i) => '<div class="mp-it" data-q="' + i + '" title="' + esc(e.name) + '">' + iconFor(e.name) + '<span class="n">' + esc(e.name) + '</span><small>' + esc(e.size_formatted) + '</small></div>').join('');
      play(0);
      listEl.querySelectorAll('.mp-it')[0].classList.add('on');
    };

    // ---------- events ----------
    root.addEventListener('click', (e) => {
      const chip = e.target.closest('.mp-chip');
      if (chip) { state.filter = chip.dataset.f; applyChrome(); persist(); if (state.dir !== null) { rebuildQueue(); renderList(); } return; }
      const d = e.target.closest('[data-dir]'); if (d) { loadDir(d.dataset.dir, true); return; }
      const f = e.target.closest('[data-file]');
      if (f) { if (state.dir !== null) { rebuildQueue(); } const i = state.queue.findIndex(q => q.path === f.dataset.file); if (i >= 0) play(i); return; }
      const q = e.target.closest('[data-q]');
      if (q) { play(parseInt(q.dataset.q, 10)); listEl.querySelectorAll('.mp-it').forEach((el, n) => el.classList.toggle('on', n === state.idx)); return; }
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'up') { if (state.parent) loadDir(state.parent, true); }
      else if (a === 'local') $('[data-a="file"]').click();
      else if (a === 'side') { state.side = !state.side; applyChrome(); persist(); }
      else if (a === 'shuffle') { state.shuffle = !state.shuffle; applyChrome(); persist(); }
      else if (a === 'repeat') { state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off'; applyChrome(); persist(); }
      else if (a === 'next') next(false);
      else if (a === 'prev') prev();
      else if (a === 'pip') { const v = cur && cur.media; if (v && v.requestPictureInPicture) (document.pictureInPictureElement ? document.exitPictureInPicture() : v.requestPictureInPicture()).catch(() => {}); }
      else if (a === 'slide') { state.slide = !state.slide; applyChrome(); clearInterval(slideT); if (state.slide) { if (!(cur && cur.kind === 'image')) { const i = state.queue.findIndex(q => M.kind(q.name) === 'image'); if (i >= 0) play(i); } slideT = setInterval(() => next(true), 4000); } }
    });
    $('[data-a="file"]').addEventListener('change', (e) => { addLocal(e.target.files); e.target.value = ''; });
    $('[data-a="rate"]').addEventListener('change', (e) => { state.rate = parseFloat(e.target.value) || 1; if (cur && cur.media) cur.media.playbackRate = state.rate; persist(); });
    pathEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadDir(pathEl.value.trim() || '~', true); e.stopPropagation(); });
    pathEl.addEventListener('keyup', (e) => e.stopPropagation());

    // keyboard (stage focused): space, arrows, m, f, n, p
    stage.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const m = cur && cur.media; const k = e.key; let used = true;
      if (k === 'n' || k === 'N' || k === 'PageDown') next(false);
      else if (k === 'p' || k === 'P' || k === 'PageUp') prev();
      else if (m && (k === ' ' || k === 'k')) { m.paused ? m.play().catch(() => {}) : m.pause(); }
      else if (m && k === 'ArrowRight') m.currentTime = Math.min(m.duration || 1e9, m.currentTime + (e.shiftKey ? 30 : 5));
      else if (m && k === 'ArrowLeft') m.currentTime = Math.max(0, m.currentTime - (e.shiftKey ? 30 : 5));
      else if (m && k === 'ArrowUp') m.volume = Math.min(1, m.volume + 0.05);
      else if (m && k === 'ArrowDown') m.volume = Math.max(0, m.volume - 0.05);
      else if (m && (k === 'm' || k === 'M')) m.muted = !m.muted;
      else if (m && cur.kind === 'video' && (k === 'f' || k === 'F')) { document.fullscreenElement ? document.exitFullscreen() : m.requestFullscreen && m.requestFullscreen().catch(() => {}); }
      else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); }
    });

    // drag local files onto the window
    let dragDepth = 0;
    root.addEventListener('dragenter', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { dragDepth++; root.classList.add('drop'); e.preventDefault(); } });
    root.addEventListener('dragover', (e) => { if (root.classList.contains('drop')) e.preventDefault(); });
    root.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) root.classList.remove('drop'); });
    root.addEventListener('drop', (e) => { dragDepth = 0; root.classList.remove('drop'); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); addLocal(e.dataTransfer.files); } });

    // initial state
    stage.innerHTML = '<div class="mp-empty">' + ICO.big + '<b style="font-size:.95rem;color:var(--text-primary)">Media Player</b><span>Video, audio and images of any common type.<br>Pick a file on the left, or drop files from your computer here.</span><span><kbd>Space</kbd> play/pause &nbsp; <kbd>←</kbd><kbd>→</kbd> seek &nbsp; <kbd>N</kbd><kbd>P</kbd> next/previous &nbsp; <kbd>F</kbd> fullscreen</span></div>';
    applyChrome();
    if (params.path) openRemote(params.path); else loadDir(params.dir || '~', false);
    return win;
  };
})();
