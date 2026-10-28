/* ShellMan wallpapers: one per theme, picked from a list of up to 10 presets.
 * localStorage:
 *   shellman_wall_dark / shellman_wall_light  url used in that theme ('' = default)
 *   shellman_wall_presets                     [url, ...] the saved wallpapers, at most 10
 *   shellman_wallpaper                        legacy single wallpaper, used when a per-theme key is unset
 */
(function () {
  'use strict';
  const DEFAULT_URL = '/static/images/wallpaper-8k.jpg';
  const KEYS = { dark: 'shellman_wall_dark', light: 'shellman_wall_light' };
  const PRESETS = 'shellman_wall_presets';
  const OLD_HISTORY = 'shellman_wall_history';
  const MAX_PRESETS = 10;

  const get = (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
  const put = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (_) {} };

  const currentTheme = () => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

  const urlFor = (theme) => get(KEYS[theme]) || get('shellman_wallpaper') || DEFAULT_URL;

  // presets: the wallpapers the user keeps (uploads and URLs), at most MAX_PRESETS
  const readPresets = () => {
    try { const h = JSON.parse(get(PRESETS) || '[]'); return Array.isArray(h) ? h.filter(x => typeof x === 'string') : []; } catch (_) { return []; }
  };
  const presets = () => {
    let list = readPresets();
    if (!get(PRESETS) && get(OLD_HISTORY)) {          // one-time move from the old history list
      try { list = JSON.parse(get(OLD_HISTORY)).map(e => e && e.url).filter(Boolean).slice(0, MAX_PRESETS); } catch (_) { list = []; }
      put(PRESETS, JSON.stringify(list)); put(OLD_HISTORY, '');
    }
    return list;
  };
  const writePresets = (l) => put(PRESETS, JSON.stringify(l.slice(0, MAX_PRESETS)));

  const isVideo = (url) => /\.(mp4|m4v|mov|webm|ogv)(\?|#|$)/i.test(String(url || ''));
  const isAnimated = (url) => isVideo(url) || /\.gif(\?|#|$)/i.test(String(url || ''));

  // live (video) wallpaper layer: sits under every desktop element, the dark/light wash goes on top of it
  (function injectCss() {
    const st = document.createElement('style');
    st.textContent =
      '#desktop{isolation:isolate}' +
      '#desktopLiveWall{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;background:#06090f}' +
      '#desktopLiveWall video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
      '#desktopLiveWall::after{content:"";position:absolute;inset:0;background:var(--sm-wall-grad)}';
    document.head.appendChild(st);
  })();

  const reduceMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  function liveLayer(env, url) {
    let layer = document.getElementById('desktopLiveWall');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'desktopLiveWall';
      env.insertBefore(layer, env.firstChild);
    }
    let v = layer.querySelector('video');
    if (!v || v.getAttribute('data-src') !== url) {      // same video in both themes: keep it playing
      if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }
      v = document.createElement('video');
      v.muted = true; v.defaultMuted = true; v.loop = true; v.autoplay = !reduceMotion();
      v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('disablepictureinpicture', '');
      v.preload = 'auto'; v.setAttribute('data-src', url); v.src = url;
      layer.appendChild(v);
      if (!reduceMotion()) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
    }
  }
  function clearLive() {
    const layer = document.getElementById('desktopLiveWall');
    if (!layer) return;
    const v = layer.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    layer.remove();
  }
  // do not burn CPU/GPU while the tab is hidden
  document.addEventListener('visibilitychange', () => {
    const v = document.querySelector('#desktopLiveWall video');
    if (!v || reduceMotion()) return;
    if (document.hidden) v.pause(); else { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
  });

  // paint the wallpaper for the active theme
  function apply() {
    const url = urlFor(currentTheme());
    const env = document.getElementById('desktop');
    const ws = document.getElementById('desktopWorkspace');
    if (env && isVideo(url)) {
      env.classList.add('has-custom-wall');
      liveLayer(env, url);
      env.style.backgroundImage = 'none';
      env.style.backgroundColor = '#06090f';
    } else if (env) {
      clearLive();
      env.style.backgroundColor = '';
      env.classList.toggle('has-custom-wall', !/wallpaper-8k\.jpg$/.test(url));
      env.style.backgroundImage = 'var(--sm-wall-grad), url("' + url.replace(/"/g, '%22') + '")';
      env.style.backgroundSize = 'cover';
      env.style.backgroundPosition = 'center center';
      env.style.backgroundRepeat = 'no-repeat';
      env.style.backgroundAttachment = 'fixed';
    }
    if (ws) { ws.style.background = 'transparent'; ws.style.backgroundImage = 'none'; }
  }

  // target: 'dark' | 'light' | 'both'
  function assign(url, target) {
    url = String(url || '').trim() || DEFAULT_URL;
    (target === 'both' ? ['dark', 'light'] : [target === 'light' ? 'light' : 'dark']).forEach(m => put(KEYS[m], url));
    apply();
  }

  // add a wallpaper to the presets. Returns '' on success or the reason it was refused.
  function addPreset(url) {
    url = String(url || '').trim();
    if (!url || url === DEFAULT_URL) return '';
    const l = presets();
    if (l.includes(url)) return '';
    if (l.length >= MAX_PRESETS) return 'Preset limit reached (' + MAX_PRESETS + '). Delete one first.';
    l.push(url); writePresets(l);
    return '';
  }

  // delete a preset; a theme that was using it goes back to the default wallpaper
  function removePreset(url) {
    writePresets(presets().filter(u => u !== url));
    ['dark', 'light'].forEach(m => { if (get(KEYS[m]) === url) put(KEYS[m], DEFAULT_URL); });
    if (get('shellman_wallpaper') === url) put('shellman_wallpaper', '');
    apply();
  }

  window.ShellmanWallpaper = {
    DEFAULT_URL: DEFAULT_URL, isVideo: isVideo, isAnimated: isAnimated,
    apply: apply, assign: assign, presets: presets, addPreset: addPreset, removePreset: removePreset, MAX_PRESETS: MAX_PRESETS,
    urlFor: urlFor, current: () => ({ dark: urlFor('dark'), light: urlFor('light') })
  };

  window.addEventListener('shellman-theme', apply);
})();
