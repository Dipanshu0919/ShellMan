/**
 * ShellMan: MySQL / MariaDB and PostgreSQL viewer (sqlviewer.js)
 * Mounted into the Database Explorer tabs. Read-only: lists databases and tables, previews rows, runs one
 * SELECT-style query at a time. Everything goes to /api/servers/<id>/database/<mysql|postgres>/...
 * The password lives only in the input box while the window is open; it is never stored in the browser.
 */
(function () {
  if (window.ShellmanSql) return;

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const KINDS = {
    mysql: {
      title: 'MySQL / MariaDB',
      defaultUser: 'root',
      userHint: 'User (e.g. root)',
      passHint: 'Password (blank = socket login)',
      help: 'Connects from the server itself over its local socket, so no database port needs to be opened. Leave the password blank to log in as root through the socket (works when you are root or have passwordless sudo).',
      quote: (n) => '`' + String(n).replace(/`/g, '``') + '`',
      select: (db, t) => `SELECT * FROM \`${db.replace(/`/g, '``')}\`.\`${t.name.replace(/`/g, '``')}\` LIMIT 100;`
    },
    postgres: {
      title: 'PostgreSQL',
      defaultUser: 'postgres',
      userHint: 'User (e.g. postgres)',
      passHint: 'Password (blank = peer login)',
      help: 'Connects from the server itself. Leave the password blank to use peer authentication as the postgres system user (needs root or passwordless sudo on the server). With a password it connects to 127.0.0.1.',
      select: (db, t) => `SELECT * FROM "${(t.schema || 'public').replace(/"/g, '""')}"."${t.name.replace(/"/g, '""')}" LIMIT 100;`
    }
  };

  const mount = (container, opts) => {
    const kind = opts.kind, cfg = KINDS[kind];
    const serverId = opts.serverId;
    const doFetch = opts.fetch || window.fetch.bind(window);
    const uid = 'sq' + kind + Date.now();
    const remembered = (() => { try { return localStorage.getItem('shellman_sql_user_' + kind); } catch (_) { return null; } })();

    let db = '';
    let tables = [];
    let connected = false;
    let lastResult = null;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%; min-height:0;">
        <div style="padding:.55rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(var(--shade),.15); display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; flex-shrink:0;">
          <input type="text" data-user class="form-control" placeholder="${cfg.userHint}" value="${esc(remembered || cfg.defaultUser)}" autocomplete="username" style="font-size:.78rem; width:150px; padding:.3rem .55rem;">
          <input type="password" data-pass class="form-control" placeholder="${cfg.passHint}" autocomplete="current-password" style="font-size:.78rem; width:220px; padding:.3rem .55rem;">
          <button class="btn btn-primary btn-xs" data-connect>Connect &amp; list databases</button>
          <span data-status style="font-size:.74rem; color:var(--text-muted);">${cfg.title}</span>
          <span style="flex:1"></span>
          <span style="font-size:.68rem; color:var(--text-muted);" title="${esc(cfg.help)}">Read-only &middot; hover for how login works</span>
        </div>
        <div style="flex:1; display:flex; min-height:0;">
          <div style="width:240px; border-right:1px solid var(--border-subtle); background:rgba(var(--shade),.1); display:flex; flex-direction:column; flex-shrink:0;">
            <div style="padding:.5rem .7rem; border-bottom:1px solid var(--border-subtle);">
              <div style="font-size:.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:.25rem;">Database</div>
              <select data-db class="form-control" style="width:100%; font-size:.76rem; padding:.3rem .45rem;" disabled><option>Connect first</option></select>
              <input type="text" data-filter class="form-control" placeholder="Filter tables…" style="width:100%; margin-top:.4rem; font-size:.74rem; padding:.25rem .5rem;" disabled>
            </div>
            <div style="padding:.4rem .8rem; border-bottom:1px solid var(--border-subtle); font-size:.68rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; display:flex; justify-content:space-between;">
              <span>Tables</span><span data-count>0</span>
            </div>
            <div data-tables style="flex:1; overflow-y:auto; padding:.4rem;">
              <div style="padding:1rem .5rem; text-align:center; color:var(--text-muted); font-size:.75rem; line-height:1.5;">Enter the database login above and click Connect.</div>
            </div>
          </div>
          <div style="flex:1; display:flex; flex-direction:column; min-width:0; min-height:0;">
            <div style="padding:.55rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(var(--shade),.08); display:flex; flex-direction:column; gap:.4rem; flex-shrink:0;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Read-only SQL console (one statement, Ctrl+Enter to run)</span>
                <button class="btn btn-secondary btn-xs" data-run disabled style="font-size:.7rem; padding:.15rem .6rem;">Execute query</button>
              </div>
              <textarea data-sql rows="2" spellcheck="false" class="form-control" placeholder="SELECT * FROM tablename LIMIT 100;" style="font-family:var(--font-mono); font-size:.75rem; padding:.35rem .55rem; width:100%; resize:vertical; min-height:44px;"></textarea>
            </div>
            <div style="padding:.35rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(var(--shade),.15); display:flex; justify-content:space-between; align-items:center; font-size:.72rem; color:var(--text-secondary); flex-shrink:0;">
              <span data-heading>Result</span>
              <span style="display:flex; gap:.6rem; align-items:center;"><span data-rows>0 rows</span><button class="btn btn-ghost btn-xs" data-csv disabled style="font-size:.68rem;">Export CSV</button></span>
            </div>
            <div style="flex:1; overflow:auto; min-height:0;">
              <table class="table" style="font-size:.75rem; margin:0;">
                <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:2;" data-thead><tr><th>No result yet</th></tr></thead>
                <tbody data-tbody><tr><td style="text-align:center; padding:3rem; color:var(--text-muted);">Pick a table on the left or run a query.</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    const q = (s) => container.querySelector(s);
    const userEl = q('[data-user]'), passEl = q('[data-pass]'), statusEl = q('[data-status]'), dbEl = q('[data-db]');
    const filterEl = q('[data-filter]'), tablesEl = q('[data-tables]'), countEl = q('[data-count]');
    const sqlEl = q('[data-sql]'), runBtn = q('[data-run]'), theadEl = q('[data-thead]'), tbodyEl = q('[data-tbody]');
    const headingEl = q('[data-heading]'), rowsEl = q('[data-rows]'), csvBtn = q('[data-csv]'), connectBtn = q('[data-connect]');

    const api = async (path, method, body) => {
      const url = `/api/servers/${serverId}/database/${kind}/${path}`;
      const opt = { method: method || 'POST', headers: {} };
      if (opt.method !== 'GET') { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body || {}); }
      try {
        const r = await doFetch(url, opt);
        let j = {};
        try { j = await r.json(); } catch (_) {}
        if (!j.success && !j.error && !j.status) j.error = `HTTP ${r.status}`;
        return j;
      } catch (e) { return { success: false, error: String(e.message || e) }; }
    };
    const login = () => ({ user: userEl.value.trim() || cfg.defaultUser, password: passEl.value });

    const showError = (msg) => {
      theadEl.innerHTML = '<tr><th>Error</th></tr>';
      tbodyEl.innerHTML = `<tr><td style="padding:1.5rem; color:var(--c-bad); white-space:pre-wrap; font-family:var(--font-mono); font-size:.74rem;">${esc(msg)}</td></tr>`;
      rowsEl.textContent = '';
      csvBtn.disabled = true;
      lastResult = null;
    };

    const showResult = (res, heading) => {
      lastResult = res;
      headingEl.textContent = heading || 'Result';
      rowsEl.textContent = `${res.row_count} row${res.row_count === 1 ? '' : 's'}${res.truncated ? ' (first 500 shown)' : ''}` + (res.elapsed_ms != null ? ` · ${res.elapsed_ms} ms` : '');
      csvBtn.disabled = !res.rows.length;
      if (!res.columns.length) {
        theadEl.innerHTML = '<tr><th>Result</th></tr>';
        tbodyEl.innerHTML = '<tr><td style="text-align:center; padding:2rem; color:var(--text-muted);">The query ran and returned nothing.</td></tr>';
        return;
      }
      theadEl.innerHTML = `<tr>${res.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
      tbodyEl.innerHTML = res.rows.length ? res.rows.map(r => `<tr>${r.map(cell =>
        `<td style="font-family:var(--font-mono); font-size:.72rem; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(cell)}">${cell === null ? '<span style="color:var(--text-muted);">NULL</span>' : esc(cell)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${res.columns.length}" style="text-align:center; padding:2rem; color:var(--text-muted);">0 rows.</td></tr>`;
    };

    const run = async (heading) => {
      const sql = sqlEl.value.trim();
      if (!sql || !db) return;
      runBtn.disabled = true;
      tbodyEl.innerHTML = '<tr><td style="text-align:center; padding:3rem; color:var(--text-muted);">Running…</td></tr>';
      const res = await api('query', 'POST', { database: db, query: sql, ...login() });
      runBtn.disabled = false;
      if (!res.success) { showError(res.error || 'The query failed.'); return; }
      showResult(res, heading || 'Result');
    };

    const paintTables = () => {
      const f = filterEl.value.trim().toLowerCase();
      const list = tables.filter(t => !f || (t.schema ? t.schema + '.' : '').concat(t.name).toLowerCase().includes(f));
      countEl.textContent = tables.length;
      if (!list.length) {
        tablesEl.innerHTML = `<div style="padding:1rem .5rem; text-align:center; color:var(--text-muted); font-size:.75rem;">${tables.length ? 'No match.' : 'No tables in this database.'}</div>`;
        return;
      }
      tablesEl.innerHTML = list.map((t, i) => `
        <div class="sq-row" data-i="${tables.indexOf(t)}" style="padding:.32rem .6rem; border-radius:4px; cursor:pointer; font-size:.74rem; font-family:var(--font-mono); color:var(--text-secondary); display:flex; align-items:center; gap:.4rem; overflow:hidden; white-space:nowrap;" title="${esc((t.schema ? t.schema + '.' : '') + t.name)}${t.rows != null ? ' (about ' + t.rows + ' rows)' : ''}">
          <span style="flex-shrink:0; color:var(--sm-accent); font-size:.64rem; font-weight:700;">${t.type === 'view' ? 'VW' : 'TB'}</span>
          <span style="overflow:hidden; text-overflow:ellipsis; flex:1;">${esc((t.schema && t.schema !== 'public' ? t.schema + '.' : '') + t.name)}</span>
          ${t.rows != null ? `<span style="color:var(--text-muted); font-size:.64rem;">${t.rows}</span>` : ''}
        </div>`).join('');
      tablesEl.querySelectorAll('.sq-row').forEach(row => {
        row.onclick = () => {
          tablesEl.querySelectorAll('.sq-row').forEach(r => r.style.background = 'transparent');
          row.style.background = 'rgba(56,189,248,.15)';
          const t = tables[Number(row.dataset.i)];
          sqlEl.value = cfg.select(db, t);
          run(`${db}.${(t.schema && t.schema !== 'public' ? t.schema + '.' : '') + t.name}`);
        };
      });
    };

    const loadTables = async () => {
      if (!db) return;
      tablesEl.innerHTML = '<div style="padding:1rem .5rem; text-align:center; color:var(--text-muted); font-size:.75rem;">Loading tables…</div>';
      const res = await api('tables', 'POST', { database: db, ...login() });
      if (!res.success) {
        tables = [];
        tablesEl.innerHTML = `<div style="padding:1rem .5rem; color:var(--c-bad); font-size:.74rem; white-space:pre-wrap;">${esc(res.error || 'Could not list tables.')}</div>`;
        countEl.textContent = '0';
        return;
      }
      tables = res.tables || [];
      paintTables();
      const first = tablesEl.querySelector('.sq-row');
      if (first) first.click();
    };

    const connect = async () => {
      connectBtn.disabled = true;
      statusEl.style.color = 'var(--text-muted)';
      statusEl.textContent = 'Connecting…';
      try { localStorage.setItem('shellman_sql_user_' + kind, userEl.value.trim()); } catch (_) {}
      const [st, res] = await Promise.all([api('status', 'GET'), api('databases', 'POST', login())]);
      connectBtn.disabled = false;
      const s = st && st.status;
      if (!res.success) {
        connected = false;
        statusEl.style.color = 'var(--c-bad)';
        statusEl.textContent = s && !s.installed ? `No ${cfg.title} client found on this server` : 'Could not connect';
        dbEl.innerHTML = '<option>Connect first</option>'; dbEl.disabled = true; filterEl.disabled = true; runBtn.disabled = true;
        tablesEl.innerHTML = `<div style="padding:1rem .5rem; color:var(--c-bad); font-size:.75rem; line-height:1.5; white-space:pre-wrap;">${esc(res.error || 'Could not connect.')}</div>`;
        return;
      }
      connected = true;
      statusEl.style.color = 'var(--c-ok)';
      statusEl.textContent = (s && s.version ? s.version.replace(/^.*?Ver\s/, 'Ver ').slice(0, 70) : cfg.title) + (s && !s.active ? ' (service not reported active)' : '');
      const dbs = res.databases || [];
      dbEl.innerHTML = dbs.length ? dbs.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('') : '<option value="">No databases</option>';
      dbEl.disabled = !dbs.length; filterEl.disabled = !dbs.length; runBtn.disabled = !dbs.length;
      db = dbs.length ? (dbs.find(d => !['mysql', 'postgres'].includes(d)) || dbs[0]) : '';
      dbEl.value = db;
      loadTables();
    };

    connectBtn.onclick = connect;
    passEl.onkeydown = userEl.onkeydown = (e) => { if (e.key === 'Enter') connect(); };
    dbEl.onchange = () => { db = dbEl.value; filterEl.value = ''; loadTables(); };
    filterEl.oninput = paintTables;
    runBtn.onclick = () => run('Query result');
    sqlEl.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run('Query result'); } };
    csvBtn.onclick = () => {
      if (!lastResult) return;
      const cell = (v) => v === null ? '' : /[",\n\r]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
      const text = [lastResult.columns.map(cell).join(',')].concat(lastResult.rows.map(r => r.map(cell).join(','))).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
      a.download = `${db || kind}-result.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

    return {
      // what the 1-click backup should dump
      backupTarget: () => (connected && db) ? { type: kind, target: db, ...login() } : null,
      connect
    };
  };

  window.ShellmanSql = { mount };
})();
