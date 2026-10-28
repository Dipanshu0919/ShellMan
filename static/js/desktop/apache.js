/**
 * ShellMan: Apache manager (apache.js)
 * Sites, config editor, modules, logs and Let's Encrypt for apache2 (Debian/Ubuntu) and httpd (RHEL family).
 */
DesktopAppsController.prototype.launchApache = function (params = {}) {
  const existing = WindowManager.getWindowByAppId('apache');
  if (existing) {
    if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
    WindowManager.focusWindow(existing.id);
    return existing;
  }
  const id = 'apache_' + Date.now();
  const sid = this.serverId;
  const fetch = RequestScope.next();
  const esc = (s) => (window.escapeHtml ? window.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const api = (p) => `/api/servers/${sid}/apache/${p}`;
  const toast = (m, t) => { if (window.showToast) window.showToast(m, t || 'success'); };

  let st = null, sites = [], tab = params.tab || 'sites', editFile = '', dirty = false;

  const J = async (url, opt) => {
    try {
      const r = await fetch(url, opt);
      if ((r.headers.get('content-type') || '').includes('application/json')) return await r.json();
      const t = await r.text();
      return { success: false, message: `Server error (${r.status}) ${t.slice(0, 200)}` };
    } catch (e) { return { success: false, message: 'Request failed: ' + (e.message || e) }; }
  };
  const post = (url, body) => J(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });

  const TABS = [['sites', 'Sites'], ['editor', 'Config files'], ['modules', 'Modules'], ['logs', 'Logs'], ['ssl', 'SSL (Certbot)']];

  return WindowManager.createWindow({
    appId: 'apache',
    multiInstance: false,
    title: `Apache - ${this.serverName}`,
    icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" fill="rgba(220,38,38,0.2)" stroke="#ef4444" stroke-width="1.6"/><path d="M8 17c1-3 2-6 4-9 1 2 2.5 5 4 9M9.5 13.5h5" stroke="#fca5a5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    width: 960, height: 600, minWidth: 640, minHeight: 380,
    contentHtml: `
      <div id="ap_${id}" style="height:100%;display:flex;flex-direction:column;background:var(--bg-canvas);color:var(--text-primary);position:relative;overflow:hidden;">
        <div style="background:var(--bg-surface);border-bottom:1px solid var(--border-subtle);padding:.55rem .9rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
          <div style="display:flex;align-items:center;gap:.5rem;"><span class="status-dot disconnected" id="apDot_${id}"></span><span style="font-size:.78rem;font-weight:600;" id="apText_${id}">Checking Apache...</span></div>
          <div style="display:flex;gap:.4rem;">
            <button class="btn btn-secondary btn-xs" data-act="test">Config test</button>
            <button class="btn btn-secondary btn-xs" data-act="reload">Reload</button>
            <button class="btn btn-secondary btn-xs" data-act="restart">Restart</button>
            <button class="btn btn-secondary btn-xs" data-act="start">Start</button>
            <button class="btn btn-secondary btn-xs" data-act="stop">Stop</button>
            <button class="btn btn-ghost btn-xs" data-act="refresh" title="Refresh">&#8635;</button>
          </div>
        </div>
        <div id="apTabs_${id}" style="background:var(--bg-system);border-bottom:1px solid var(--border-subtle);display:flex;padding:0 .85rem;gap:.4rem;"></div>
        <div id="apBody_${id}" style="flex:1;overflow:auto;display:flex;flex-direction:column;"></div>
      </div>`,
    onInit: (bodyEl) => {
      const root = bodyEl.querySelector(`#ap_${id}`);
      const dot = root.querySelector(`#apDot_${id}`);
      const txt = root.querySelector(`#apText_${id}`);
      const tabsEl = root.querySelector(`#apTabs_${id}`);
      const pane = root.querySelector(`#apBody_${id}`);

      const showOutput = (title, text, ok) => {
        const m = document.createElement('div');
        m.style.cssText = 'position:absolute;inset:0;background:rgba(var(--shade),.75);display:flex;align-items:center;justify-content:center;z-index:110;padding:1rem;';
        m.innerHTML = `<div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;width:100%;max-width:620px;display:flex;flex-direction:column;overflow:hidden;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:.8rem 1.1rem;border-bottom:1px solid var(--border-subtle);">
            <h4 style="margin:0;font-size:.9rem;display:flex;align-items:center;gap:.45rem;"><span class="status-dot ${ok ? 'connected' : 'disconnected'}"></span>${esc(title)}</h4>
            <button class="btn btn-ghost btn-xs" data-x>&times;</button></div>
          <pre style="margin:0;padding:1rem;background:var(--sm-inset);max-height:55vh;overflow:auto;font-family:var(--font-mono);font-size:.75rem;line-height:1.55;color:${ok ? 'var(--c-ok)' : 'var(--c-bad)'};white-space:pre-wrap;word-break:break-all;">${esc(text || 'No output.')}</pre>
          <div style="display:flex;justify-content:flex-end;padding:.65rem 1.1rem;border-top:1px solid var(--border-subtle);"><button class="btn btn-secondary btn-sm" data-x>Close</button></div></div>`;
        root.appendChild(m);
        m.querySelectorAll('[data-x]').forEach(b => b.onclick = () => m.remove());
      };

      // ---------------------------------------------------------------- header
      const loadStatus = async () => {
        const r = await J(api('status'));
        if (!r.success) return;
        st = r.status;
        if (!st.installed) {
          dot.className = 'status-dot disconnected';
          txt.innerHTML = `Apache: <span style="color:var(--c-bad);">Not installed</span> <button class="btn btn-primary btn-xs" id="apInst_${id}" style="margin-left:6px;">Install Apache</button>`;
          txt.querySelector('button').onclick = () => install('apache');
        } else if (st.running) {
          dot.className = 'status-dot connected';
          txt.innerHTML = `Apache: <span style="color:var(--c-ok2);">Active</span> <span style="font-weight:400;color:var(--text-muted);font-size:.72rem;">${esc(st.version)} &middot; ${esc(st.service)}${st.cpanel ? ' &middot; cPanel' : ''}${st.config_ok ? '' : ' &middot; <span style="color:var(--c-warn);">config has errors</span>'}</span>`;
        } else {
          dot.className = 'status-dot disconnected';
          txt.innerHTML = `Apache: <span style="color:var(--c-warn);">Stopped</span> <span style="font-weight:400;color:var(--text-muted);font-size:.72rem;">${esc(st.version)}</span>`;
        }
      };

      const install = async (pkg) => {
        const ok = await DesktopModal.confirm({ title: 'Install ' + pkg, message: `Install ${pkg} on this server with the system package manager?`, confirmText: 'Install' });
        if (!ok) return;
        toast('Installing ' + pkg + '...', 'info');
        const r = await post(api('install'), { package: pkg });
        showOutput('Install ' + pkg, r.message, r.success);
        await loadStatus(); render();
      };

      root.querySelectorAll('[data-act]').forEach(b => {
        b.onclick = async () => {
          const a = b.dataset.act;
          if (a === 'refresh') { await loadStatus(); return render(); }
          if (a === 'stop' || a === 'restart') {
            const ok = await DesktopModal.confirm({ title: a === 'stop' ? 'Stop Apache' : 'Restart Apache', message: a === 'stop' ? 'All sites on this server go offline until Apache is started again.' : 'Restart drops open connections. Use Reload to avoid that.', confirmText: a === 'stop' ? 'Stop' : 'Restart' });
            if (!ok) return;
          }
          b.disabled = true;
          const r = await post(api('service'), { action: a });
          b.disabled = false;
          if (a === 'test') showOutput('Apache config test', r.message, r.success); else toast(r.message, r.success ? 'success' : 'error');
          if (!r.success && a !== 'test') showOutput('Apache ' + a + ' failed', r.message, false);
          await loadStatus();
        };
      });

      // ---------------------------------------------------------------- tabs
      const drawTabs = () => {
        tabsEl.innerHTML = TABS.map(([k, l]) => `<button data-tab="${k}" style="background:none;border:none;border-bottom:2px solid ${k === tab ? 'var(--c-bad)' : 'transparent'};color:${k === tab ? 'var(--text-primary)' : 'var(--text-secondary)'};font-weight:${k === tab ? 600 : 500};font-size:.78rem;padding:.55rem .75rem;cursor:pointer;">${l}</button>`).join('');
        tabsEl.querySelectorAll('button').forEach(b => b.onclick = async () => {
          if (tab === 'editor' && dirty && !(await DesktopModal.confirm({ title: 'Unsaved changes', message: 'Discard your edits?', confirmText: 'Discard' }))) return;
          dirty = false; tab = b.dataset.tab; render();
        });
      };
      const render = () => {
        drawTabs();
        if (st && !st.installed) { pane.innerHTML = '<div style="padding:3rem;text-align:center;color:var(--text-muted);">Apache is not installed on this server.</div>'; return; }
        ({ sites: renderSites, editor: renderEditor, modules: renderModules, logs: renderLogs, ssl: renderSsl }[tab] || renderSites)();
      };

      // ---------------------------------------------------------------- sites
      const renderSites = async () => {
        pane.innerHTML = `<div style="padding:.9rem;display:flex;flex-direction:column;gap:.7rem;height:100%;box-sizing:border-box;">
          <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;">
            <input class="form-control" id="apF_${id}" placeholder="Filter sites..." style="max-width:320px;font-size:.78rem;">
            <button class="btn btn-primary btn-sm" id="apAdd_${id}">+ Add site</button></div>
          <div id="apForm_${id}"></div>
          <div class="table-responsive" style="flex:1;overflow:auto;border:1px solid var(--border-subtle);border-radius:6px;background:var(--bg-surface);">
            <table class="table" style="margin:0;width:100%;font-size:.78rem;"><thead><tr style="color:var(--text-muted);font-size:.72rem;text-transform:uppercase;">
              <th style="padding:.6rem .75rem;text-align:left;">Site</th><th style="padding:.6rem .75rem;text-align:left;">Target</th><th style="padding:.6rem .75rem;text-align:left;">Ports</th><th style="padding:.6rem .75rem;text-align:left;">HTTPS</th><th style="padding:.6rem .75rem;text-align:center;">State</th><th style="padding:.6rem .75rem;text-align:right;">Actions</th></tr></thead>
              <tbody id="apRows_${id}"><tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">Loading...</td></tr></tbody></table></div></div>`;
        pane.querySelector(`#apF_${id}`).oninput = drawRows;
        pane.querySelector(`#apAdd_${id}`).onclick = showForm;
        const r = await J(api('sites'));
        sites = r.success ? r.sites : [];
        drawRows();
      };

      const drawRows = () => {
        const tb = pane.querySelector(`#apRows_${id}`); if (!tb) return;
        const q = (pane.querySelector(`#apF_${id}`).value || '').toLowerCase().trim();
        const list = sites.filter(s => !q || (s.name + ' ' + s.domains.join(' ') + ' ' + s.proxy + ' ' + s.root).toLowerCase().includes(q));
        if (!list.length) { tb.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--text-muted);">${q ? 'No match.' : 'No sites yet. Add one to serve a folder or proxy an app.'}</td></tr>`; return; }
        tb.innerHTML = list.map(s => {
          const target = !s.vhost ? 'config snippet (no virtual host)' : s.proxy ? `Proxy &rarr; ${esc(s.proxy)}` : (s.root ? `Static &rarr; ${esc(s.root)}` : (s.redirect ? `Redirect &rarr; ${esc(s.redirect)}` : '-'));
          return `<tr style="border-top:1px solid var(--border-subtle);">
            <td style="padding:.6rem .75rem;"><div style="font-weight:600;">${esc(s.domains.join(', ') || s.name)}</div><div style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-muted);">${esc(s.name)}</div></td>
            <td style="padding:.6rem .75rem;font-family:var(--font-mono);font-size:.72rem;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(s.proxy || s.root)}">${target}</td>
            <td style="padding:.6rem .75rem;font-family:var(--font-mono);font-size:.72rem;">${esc(s.ports.join(', ') || '-')}</td>
            <td style="padding:.6rem .75rem;">${s.vhost ? `<span class="status-dot ${s.ssl ? 'connected' : 'disconnected'}"></span> ${s.ssl ? 'HTTPS' : 'HTTP'}` : '-'}</td>
            <td style="padding:.6rem .75rem;text-align:center;"><button class="btn btn-xs ${s.enabled ? 'btn-secondary' : 'btn-ghost'}" data-tog="${esc(s.name)}" data-en="${!s.enabled}">${s.enabled ? '<span style="color:var(--c-ok2);">Enabled</span>' : 'Disabled'}</button></td>
            <td style="padding:.6rem .75rem;text-align:right;white-space:nowrap;"><button class="btn btn-secondary btn-xs" data-edit="${esc(s.name)}">Config</button> <button class="btn btn-danger btn-xs" data-del="${esc(s.name)}">Delete</button></td></tr>`;
        }).join('');
        const isDeb = st && st.flavor === 'debian';
        const rel = (n) => (isDeb ? 'sites-available/' : 'conf.d/') + n;
        tb.querySelectorAll('[data-tog]').forEach(b => b.onclick = async () => {
          b.disabled = true;
          const r = await post(api('site/toggle'), { name: b.dataset.tog, enable: b.dataset.en === 'true' });
          if (r.success) toast(r.message); else showOutput('Could not change site', r.message, false);
          renderSites();
        });
        tb.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { editFile = rel(b.dataset.edit); tab = 'editor'; render(); });
        tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          const ok = await DesktopModal.confirm({ title: 'Delete site', message: `Remove the config for ${b.dataset.del}? Website files are not touched.`, confirmText: 'Delete', type: 'danger' });
          if (!ok) return;
          const r = await post(api('site/delete'), { name: b.dataset.del });
          if (r.success) toast(r.message); else showOutput('Delete failed', r.message, false);
          renderSites();
        });
      };

      const showForm = () => {
        const f = pane.querySelector(`#apForm_${id}`);
        if (f.innerHTML) { f.innerHTML = ''; return; }
        f.innerHTML = `<div style="border:1px solid var(--border-subtle);border-radius:6px;background:var(--bg-surface);padding:.8rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.6rem;align-items:end;">
          <label style="font-size:.72rem;">Domain<input class="form-control" id="apD_${id}" placeholder="example.com" style="width:100%;font-size:.78rem;"></label>
          <label style="font-size:.72rem;">Type<select class="form-control" id="apT_${id}" style="width:100%;font-size:.78rem;"><option value="static">Static folder</option><option value="proxy">Reverse proxy</option></select></label>
          <label style="font-size:.72rem;" id="apLbl_${id}">Web root<input class="form-control" id="apV_${id}" placeholder="/var/www/example.com" style="width:100%;font-size:.78rem;"></label>
          <label style="font-size:.72rem;"><input type="checkbox" id="apW_${id}" checked> Also answer on www.</label>
          <div style="display:flex;gap:.4rem;"><button class="btn btn-primary btn-sm" id="apGo_${id}">Create</button><button class="btn btn-ghost btn-sm" id="apNo_${id}">Cancel</button></div></div>`;
        const t = f.querySelector(`#apT_${id}`), v = f.querySelector(`#apV_${id}`), l = f.querySelector(`#apLbl_${id}`);
        t.onchange = () => { l.firstChild.textContent = t.value === 'proxy' ? 'Proxy target' : 'Web root'; v.placeholder = t.value === 'proxy' ? 'http://127.0.0.1:3000' : '/var/www/example.com'; };
        f.querySelector(`#apNo_${id}`).onclick = () => { f.innerHTML = ''; };
        f.querySelector(`#apGo_${id}`).onclick = async (e) => {
          e.target.disabled = true;
          const body = { domain: f.querySelector(`#apD_${id}`).value, type: t.value, www: f.querySelector(`#apW_${id}`).checked };
          if (t.value === 'proxy') body.target = v.value; else body.root = v.value;
          const r = await post(api('site/create'), body);
          e.target.disabled = false;
          if (r.success) { toast(r.message); renderSites(); loadStatus(); } else showOutput('Could not create site', r.message, false);
        };
      };

      // ---------------------------------------------------------------- editor
      const renderEditor = async () => {
        pane.innerHTML = `<div style="padding:.9rem;display:flex;flex-direction:column;gap:.6rem;height:100%;box-sizing:border-box;">
          <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
            <select class="form-control" id="apFile_${id}" style="min-width:260px;font-size:.78rem;"><option value="">Choose a file...</option></select>
            <button class="btn btn-primary btn-sm" id="apSave_${id}" disabled>Save, test &amp; reload</button>
            <span style="font-size:.72rem;color:var(--text-muted);">A config that fails the test is rolled back.</span></div>
          <textarea id="apEd_${id}" spellcheck="false" style="flex:1;min-height:200px;width:100%;box-sizing:border-box;background:var(--sm-inset);color:var(--text-secondary);border:1px solid var(--border-subtle);border-radius:6px;padding:.7rem;font-family:var(--font-mono);font-size:.78rem;line-height:1.5;resize:none;" disabled></textarea></div>`;
        const sel = pane.querySelector(`#apFile_${id}`), ed = pane.querySelector(`#apEd_${id}`), save = pane.querySelector(`#apSave_${id}`);
        const r = await J(api('files'));
        const groups = {};
        (r.files || []).forEach(x => { (groups[x.group] = groups[x.group] || []).push(x.file); });
        sel.innerHTML = '<option value="">Choose a file...</option>' + Object.keys(groups).map(g => `<optgroup label="${esc(g)}">${groups[g].map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('')}</optgroup>`).join('');
        const open = async (f) => {
          if (!f) { ed.value = ''; ed.disabled = true; save.disabled = true; return; }
          const c = await J(api('config?file=' + encodeURIComponent(f)));
          if (!c.success) { showOutput('Could not open file', c.message, false); return; }
          ed.value = c.content; ed.disabled = false; save.disabled = false; dirty = false; editFile = f;
        };
        sel.onchange = async () => {
          if (dirty && !(await DesktopModal.confirm({ title: 'Unsaved changes', message: 'Discard your edits?', confirmText: 'Discard' }))) { sel.value = editFile; return; }
          open(sel.value);
        };
        ed.oninput = () => { dirty = true; };
        save.onclick = async () => {
          save.disabled = true;
          const s = await post(api('config/save'), { file: sel.value, content: ed.value });
          save.disabled = false;
          showOutput(s.success ? 'Saved' : 'Rejected, rolled back', s.message, s.success);
          if (s.success) dirty = false;
          loadStatus();
        };
        if (editFile) { sel.value = editFile; if (sel.value === editFile) open(editFile); }
      };

      // ---------------------------------------------------------------- modules
      const renderModules = async () => {
        pane.innerHTML = '<div style="padding:.9rem;color:var(--text-muted);">Loading modules...</div>';
        const r = await J(api('modules'));
        const mods = r.modules || [];
        pane.innerHTML = `<div style="padding:.9rem;display:flex;flex-direction:column;gap:.6rem;">
          <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;"><input class="form-control" id="apMF_${id}" placeholder="Filter modules..." style="max-width:260px;font-size:.78rem;">
          <span style="font-size:.72rem;color:var(--text-muted);">${r.can_toggle ? 'Toggle a module. A change that breaks the config is undone.' : 'Read only on this distro (the list comes from httpd -M).'}</span></div>
          <div id="apMods_${id}" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:.5rem;"></div></div>`;
        const grid = pane.querySelector(`#apMods_${id}`);
        const draw = () => {
          const q = pane.querySelector(`#apMF_${id}`).value.toLowerCase().trim();
          grid.innerHTML = mods.filter(m => !q || m.name.includes(q)).map(m => `<div style="border:1px solid var(--border-subtle);border-radius:6px;background:var(--bg-surface);padding:.5rem .65rem;display:flex;align-items:center;justify-content:space-between;gap:.4rem;">
            <span style="font-family:var(--font-mono);font-size:.74rem;"><span class="status-dot ${m.enabled ? 'connected' : 'disconnected'}"></span> ${esc(m.name)}</span>
            ${r.can_toggle ? `<button class="btn btn-xs ${m.enabled ? 'btn-secondary' : 'btn-ghost'}" data-m="${esc(m.name)}" data-en="${!m.enabled}">${m.enabled ? 'Disable' : 'Enable'}</button>` : ''}</div>`).join('') || '<div style="color:var(--text-muted);">No modules.</div>';
          grid.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => {
            b.disabled = true;
            const s = await post(api('module/toggle'), { name: b.dataset.m, enable: b.dataset.en === 'true' });
            if (s.success) toast(s.message); else showOutput('Module change failed', s.message, false);
            renderModules();
          });
        };
        pane.querySelector(`#apMF_${id}`).oninput = draw;
        draw();
      };

      // ---------------------------------------------------------------- logs
      const renderLogs = async () => {
        pane.innerHTML = `<div style="padding:.9rem;display:flex;flex-direction:column;gap:.6rem;height:100%;box-sizing:border-box;">
          <div style="display:flex;gap:.5rem;align-items:center;"><select class="form-control" id="apLog_${id}" style="min-width:240px;font-size:.78rem;"></select>
          <select class="form-control" id="apLn_${id}" style="font-size:.78rem;"><option>100</option><option selected>200</option><option>500</option><option>1000</option></select>
          <button class="btn btn-secondary btn-sm" id="apRef_${id}">Refresh</button></div>
          <pre id="apOut_${id}" style="flex:1;margin:0;min-height:200px;overflow:auto;background:var(--sm-inset);border:1px solid var(--border-subtle);border-radius:6px;padding:.7rem;font-family:var(--font-mono);font-size:.72rem;line-height:1.5;white-space:pre-wrap;word-break:break-all;color:var(--text-secondary);"></pre></div>`;
        const sel = pane.querySelector(`#apLog_${id}`), out = pane.querySelector(`#apOut_${id}`), ln = pane.querySelector(`#apLn_${id}`);
        const r = await J(api('logs'));
        const files = r.files || [];
        sel.innerHTML = files.map(f => `<option>${esc(f)}</option>`).join('') || '<option value="">No log files</option>';
        const load = async () => {
          if (!sel.value) { out.textContent = 'No log files found.'; return; }
          out.textContent = 'Loading...';
          const c = await J(api(`logs?file=${encodeURIComponent(sel.value)}&lines=${ln.value}`));
          out.textContent = c.success ? (c.content || '(empty)') : c.message;
          out.scrollTop = out.scrollHeight;
        };
        sel.onchange = load; ln.onchange = load; pane.querySelector(`#apRef_${id}`).onclick = load;
        load();
      };

      // ---------------------------------------------------------------- ssl
      const renderSsl = () => {
        const ok = st && st.certbot_installed && st.certbot_apache;
        pane.innerHTML = `<div style="padding:1rem;max-width:560px;display:flex;flex-direction:column;gap:.8rem;">
          <div><span class="status-dot ${ok ? 'connected' : 'disconnected'}"></span> Certbot: ${st && st.certbot_installed ? esc(st.certbot_version) : 'not installed'}${st && st.certbot_installed && !st.certbot_apache ? ' (Apache plugin missing)' : ''}
            ${ok ? '' : `<button class="btn btn-secondary btn-xs" id="apCb_${id}" style="margin-left:6px;">Install Certbot + Apache plugin</button>`}</div>
          <p style="margin:0;font-size:.78rem;color:var(--text-muted);">Gets a free Let's Encrypt certificate for a site that already exists, turns on HTTPS and redirects HTTP to it. The domain must already point at this server and port 80 must be open.</p>
          <select class="form-control" id="apSd_${id}" style="font-size:.78rem;"></select>
          <input class="form-control" id="apEm_${id}" placeholder="Contact email" style="font-size:.78rem;">
          <div><button class="btn btn-primary btn-sm" id="apIss_${id}" ${ok ? '' : 'disabled'}>Issue certificate</button></div></div>`;
        const cb = pane.querySelector(`#apCb_${id}`); if (cb) cb.onclick = () => install('certbot');
        const sel = pane.querySelector(`#apSd_${id}`);
        J(api('sites')).then(r => {
          const names = []; (r.sites || []).forEach(s => s.domains.forEach(d => { if (!d.startsWith('www.') && !names.includes(d)) names.push(d); }));
          sel.innerHTML = names.map(n => `<option>${esc(n)}</option>`).join('') || '<option value="">No sites with a ServerName</option>';
        });
        pane.querySelector(`#apIss_${id}`).onclick = async (e) => {
          e.target.disabled = true; toast('Requesting certificate...', 'info');
          const r = await post(api('ssl/issue'), { domain: sel.value, email: pane.querySelector(`#apEm_${id}`).value });
          e.target.disabled = false;
          showOutput(r.success ? 'Certificate issued' : 'Certificate failed', r.message, r.success);
          loadStatus();
        };
      };

      loadStatus().then(render);
    }
  });
};
