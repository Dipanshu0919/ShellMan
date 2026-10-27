/**
 * ShellMan: people who can sign in (administrators and read-only viewers), shown in Settings > Admin & Security.
 * Also hides desktop entries a read-only account cannot use.
 */
(function () {
  if (window.ShellmanUsersUI) return;

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (url, method = 'GET', body) => {
    const opt = { method, headers: {} };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(url, opt);
    let j = {};
    try { j = await r.json(); } catch (_) {}
    if (!r.ok && !j.error) j.error = `HTTP ${r.status}`;
    return j;
  };
  const toast = (m, k = 'info') => { if (window.showToast) window.showToast(m, k); };
  const ago = (iso) => {
    if (!iso) return 'never';
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  };
  const ROLE_TEXT = {
    admin: 'Administrator: can do everything.',
    viewer: 'Viewer: can only look (dashboard, fleet, history, logs, processes, services, Docker lists, alerts). Cannot run commands, open a terminal, change files or settings.'
  };

  const ShellmanUsersUI = {
    async append(container) {
      if (!container || (window.DesktopConfig && window.DesktopConfig.userRole === 'viewer')) return;
      const card = document.createElement('div');
      card.className = 'sa-card';
      card.innerHTML = '<div class="sa-h">People who can sign in</div><div class="sa-d">Loading…</div>';
      container.appendChild(card);
      this.card = card;
      await this.load();
    },

    async load() {
      const card = this.card;
      const r = await api('/api/users');
      if (!r.success) { card.innerHTML = `<div class="sa-h">People who can sign in</div><div class="sa-err">${esc(r.error || 'Could not load users')}</div>`; return; }
      card.innerHTML = `<div class="sa-h">People who can sign in <button class="btn btn-secondary sa-btn" id="usAdd">Add person</button></div>
        <div class="sa-d">Give a teammate or a client a <b>Viewer</b> login to watch servers without being able to change anything. Changing someone's role or password signs them out everywhere.</div>
        <div id="usForm"></div>
        <div id="usList">${r.users.map(u => `
          <div class="sa-row" data-id="${u.id}">
            <div class="grow"><b>${esc(u.username)}</b>${u.id === r.me ? ' <span class="sa-sub">(you)</span>' : ''}
              <div class="sa-sub">last sign-in ${esc(ago(u.last_login))}${u.totp_enabled ? ' · 2FA on' : ''}</div></div>
            <span class="sa-pill ${u.role === 'admin' ? 'sa-ok' : 'sa-mute'}">${u.role === 'admin' ? 'ADMIN' : 'VIEWER'}</span>
            <button class="btn btn-secondary sa-btn" data-act="role">Make ${u.role === 'admin' ? 'viewer' : 'admin'}</button>
            <button class="btn btn-secondary sa-btn" data-act="pw">Reset password</button>
            ${u.id === r.me ? '' : '<button class="btn btn-secondary sa-btn" data-act="del" style="color:#ff8a93">Delete</button>'}
          </div>`).join('')}</div><div class="sa-err" id="usMsg"></div>`;
      const msg = (t, ok) => { const e = card.querySelector('#usMsg'); e.textContent = t || ''; e.style.color = ok ? '#34d399' : '#ff8a93'; };
      card.querySelector('#usAdd').onclick = () => this.form(card, msg);
      card.querySelectorAll('#usList .sa-row[data-id]').forEach(row => {
        const id = Number(row.dataset.id);
        const u = r.users.find(x => x.id === id);
        row.querySelector('[data-act="role"]').onclick = async () => {
          const role = u.role === 'admin' ? 'viewer' : 'admin';
          if (!confirm(`Make ${u.username} a${role === 'admin' ? 'n administrator' : ' viewer'}? They will be signed out.`)) return;
          const res = await api(`/api/users/${id}`, 'PUT', { role });
          if (res.success) { toast('Role changed', 'success'); this.load(); } else msg(res.error);
        };
        row.querySelector('[data-act="pw"]').onclick = () => {
          const open = row.nextElementSibling && row.nextElementSibling.classList.contains('us-pw');
          if (open) { row.nextElementSibling.remove(); return; }
          const box = document.createElement('div');
          box.className = 'sa-row us-pw';
          box.innerHTML = `<div class="grow"><input class="form-control" type="password" autocomplete="new-password" placeholder="New password for ${esc(u.username)}" style="width:100%"></div>
            <button class="btn btn-primary sa-btn">Save password</button>`;
          row.after(box);
          const inp = box.querySelector('input');
          inp.focus();
          box.querySelector('button').onclick = async () => {
            const res = await api(`/api/users/${id}`, 'PUT', { password: inp.value });
            if (res.success) { toast('Password changed', 'success'); this.load(); } else msg(res.error);
          };
        };
        const del = row.querySelector('[data-act="del"]');
        if (del) del.onclick = async () => {
          if (!confirm(`Delete ${u.username}? This cannot be undone.`)) return;
          const res = await api(`/api/users/${id}`, 'DELETE');
          if (res.success) { toast('User deleted', 'success'); this.load(); } else msg(res.error);
        };
      });
    },

    form(card, msg) {
      const box = card.querySelector('#usForm');
      if (box.innerHTML) { box.innerHTML = ''; return; }
      box.innerHTML = `<div class="sa-grid" style="margin-top:.2rem">
          <div><label>Username</label><input class="form-control" id="usName" autocomplete="off" placeholder="e.g. rahul"></div>
          <div><label>Password</label><input class="form-control" id="usPass" type="password" autocomplete="new-password"></div>
          <div><label>Role</label><select class="form-control" id="usRole"><option value="viewer">Viewer (read-only)</option><option value="admin">Administrator</option></select></div>
        </div>
        <div class="sa-sub" id="usRoleHelp" style="margin-bottom:.5rem">${esc(ROLE_TEXT.viewer)}</div>
        <button class="btn btn-primary sa-btn" id="usSave">Create</button>`;
      const roleSel = box.querySelector('#usRole');
      roleSel.onchange = () => { box.querySelector('#usRoleHelp').textContent = ROLE_TEXT[roleSel.value]; };
      box.querySelector('#usSave').onclick = async () => {
        const res = await api('/api/users', 'POST', {
          username: box.querySelector('#usName').value.trim(), password: box.querySelector('#usPass').value, role: roleSel.value
        });
        if (res.success) { toast('User created', 'success'); this.load(); } else msg(res.error);
      };
    }
  };
  window.ShellmanUsersUI = ShellmanUsersUI;

  // Read-only account: drop start-menu entries for apps it cannot use.
  const hideForViewer = () => {
    if (!window.DesktopConfig || window.DesktopConfig.userRole !== 'viewer') return;
    const allowed = (window.DesktopCustomizer && window.DesktopCustomizer.VIEWER_APPS) || [];
    document.querySelectorAll('.ctx-item[onclick]').forEach(el => {
      const m = /launch\('([a-z_]+)'/.exec(el.getAttribute('onclick') || '');
      if (m && !allowed.includes(m[1])) el.style.display = 'none';
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideForViewer); else hideForViewer();
})();
