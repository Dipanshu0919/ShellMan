/**
 * ShellMan OS: Nginx Virtual Hosts & SSL Manager (nginx.js)
 */

DesktopAppsController.prototype.launchNginx = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('nginx');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      if (params.tab && existing._switchTab) {
        existing._switchTab(params.tab, params);
      }
      return existing;
    }

    const ngxWinId = 'nginx_' + Date.now();
    let currentTab = params.tab || 'domains';
    let statusData = null;
    let sitesList = [];
    let certsList = [];
    let currentEditFile = params.file || '';
    let isFileDirty = false;

    return WindowManager.createWindow({
      appId: 'nginx',
      multiInstance: false,
      title: `Nginx & Domains (Proxy & SSL) - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="rgba(5,150,105,0.2)" stroke="#10b981" stroke-width="1.6"/><path d="M7 16V8l5 8V8M16 8v8" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      width: 960,
      height: 600,
      minWidth: 640,
      minHeight: 380,
      contentHtml: `
        <div class="nginx-app-container" id="nginxContainer_${ngxWinId}" style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); color:var(--text-primary); font-family:var(--font-sans); position:relative; overflow:hidden;">
          <!-- Top App Bar / Status Header -->
          <div style="background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); padding:0.55rem 0.9rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; z-index:10;">
            <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:0.4rem;" id="nginxStatusPill_${ngxWinId}">
                <span class="status-dot disconnected" id="nginxDot_${ngxWinId}"></span>
                <span style="font-size:0.78rem; font-weight:600;" id="nginxStatusText_${ngxWinId}">Checking Nginx...</span>
              </div>
              <span style="color:var(--border-subtle);">|</span>
              <div style="display:flex; align-items:center; gap:0.4rem;" id="certbotStatusPill_${ngxWinId}">
                <span class="status-dot disconnected" id="certbotDot_${ngxWinId}"></span>
                <span style="font-size:0.75rem; color:var(--text-secondary);" id="certbotStatusText_${ngxWinId}">Checking Certbot...</span>
              </div>
            </div>
            
            <!-- Quick Actions -->
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-secondary btn-xs" id="testNginxBtn_${ngxWinId}" title="Run nginx -t syntax verification">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                nginx -t
              </button>
              <button class="btn btn-secondary btn-xs" id="reloadNginxBtn_${ngxWinId}" title="Gracefully reload Nginx configuration">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Reload
              </button>
              <button class="btn btn-secondary btn-xs" id="restartNginxBtn_${ngxWinId}" title="Restart Nginx service">
                Restart
              </button>
              <button class="btn btn-ghost btn-xs" id="refreshAllBtn_${ngxWinId}" title="Refresh status and sites">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
              </button>
            </div>
          </div>

          <!-- Tab Bar Navigation -->
          <div style="background:#0b101b; border-bottom:1px solid var(--border-subtle); display:flex; padding:0 0.85rem; gap:0.4rem; align-items:center;">
            <button class="ngx-tab-nav-btn active" data-tab="domains" id="tabBtn_domains_${ngxWinId}" style="background:none; border:none; border-bottom:2px solid #10b981; color:#ffffff; font-weight:600; font-size:0.78rem; padding:0.55rem 0.75rem; cursor:pointer; display:flex; align-items:center; gap:0.45rem;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              Domains &amp; Reverse Proxy Routing
            </button>
            <button class="ngx-tab-nav-btn" data-tab="editor" id="tabBtn_editor_${ngxWinId}" style="background:none; border:none; border-bottom:2px solid transparent; color:var(--text-secondary); font-weight:500; font-size:0.78rem; padding:0.55rem 0.75rem; cursor:pointer; display:flex; align-items:center; gap:0.45rem;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
              Config Files Editor
            </button>
            <button class="ngx-tab-nav-btn" data-tab="ssl" id="tabBtn_ssl_${ngxWinId}" style="background:none; border:none; border-bottom:2px solid transparent; color:var(--text-secondary); font-weight:500; font-size:0.78rem; padding:0.55rem 0.75rem; cursor:pointer; display:flex; align-items:center; gap:0.45rem;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              SSL Certificates (Certbot)
            </button>
          </div>

          <!-- Tab Content Area -->
          <div style="flex:1; overflow-y:auto; position:relative; display:flex; flex-direction:column;" id="tabContent_${ngxWinId}">
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const container = bodyEl.querySelector(`#nginxContainer_${ngxWinId}`);
        const contentPane = bodyEl.querySelector(`#tabContent_${ngxWinId}`);
        const ngxDot = bodyEl.querySelector(`#nginxDot_${ngxWinId}`);
        const ngxText = bodyEl.querySelector(`#nginxStatusText_${ngxWinId}`);
        const certDot = bodyEl.querySelector(`#certbotDot_${ngxWinId}`);
        const certText = bodyEl.querySelector(`#certbotStatusText_${ngxWinId}`);

        // Modal for displaying real Linux command and Certbot outputs
        const showCommandOutputModal = (title, outputText, isSuccess) => {
          const modalBackdrop = document.createElement('div');
          modalBackdrop.style.cssText = 'position:absolute; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:110; padding:1rem;';
          modalBackdrop.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; width:100%; max-width:620px; box-shadow:0 20px 40px rgba(0,0,0,0.65); display:flex; flex-direction:column; overflow:hidden;">
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.8rem 1.1rem; border-bottom:1px solid var(--border-subtle); background:#0c121e;">
                <h4 style="margin:0; font-size:0.92rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:0.45rem;">
                  <span class="status-dot ${isSuccess ? 'connected' : 'disconnected'}"></span>
                  ${escapeHtml(title)}
                </h4>
                <button type="button" class="btn btn-ghost btn-xs" id="closeCmdModalBtn_${ngxWinId}" style="padding:2px 6px;">&times;</button>
              </div>
              <div style="padding:1rem; background:#070b12; max-height:55vh; overflow-y:auto;">
                <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:0.4rem; font-family:var(--font-sans);">Server Command Execution Output:</div>
                <pre style="margin:0; font-family:'Fira Code', monospace; font-size:0.75rem; line-height:1.55; color:${isSuccess ? '#34d399' : '#f87171'}; white-space:pre-wrap; word-break:break-all;">${escapeHtml(outputText || 'Command executed with no output.')}</pre>
              </div>
              <div style="display:flex; justify-content:flex-end; padding:0.65rem 1.1rem; border-top:1px solid var(--border-subtle); background:#0c121e;">
                <button type="button" class="btn btn-secondary btn-sm" id="okCmdModalBtn_${ngxWinId}">Close</button>
              </div>
            </div>
          `;
          container.appendChild(modalBackdrop);
          const closeModal = () => { if (modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop); };
          modalBackdrop.querySelector(`#closeCmdModalBtn_${ngxWinId}`).onclick = closeModal;
          modalBackdrop.querySelector(`#okCmdModalBtn_${ngxWinId}`).onclick = closeModal;
        };

        // Safe JSON fetcher that never throws SyntaxError on HTML/500 errors
        const safeFetchJson = async (url, options = {}) => {
          try {
            const resp = await fetch(url, options);
            const contentType = resp.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              return await resp.json();
            }
            const text = await resp.text();
            return {
              success: false,
              message: text ? `Server Error (${resp.status}): ${text.substring(0, 300)}` : `Request failed (${resp.status})`
            };
          } catch (err) {
            return {
              success: false,
              message: `Network/Request Error: ${err.message || err}`
            };
          }
        };

        // 1. Fetch Status
        const fetchStatus = async () => {
          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/status`);
            if (res.success && res.status) {
              statusData = res.status;
              updateStatusHeader(statusData);
            }
          } catch (e) {
            console.error('Error fetching Nginx status:', e);
          }
        };

        const updateStatusHeader = (st) => {
          if (!st) return;
          if (st.nginx_installed) {
            if (st.nginx_running) {
              ngxDot.className = 'status-dot connected';
              const verDisplay = (st.nginx_version && !st.nginx_version.toLowerCase().includes('not found')) ? `(${escapeHtml(st.nginx_version)})` : '';
              ngxText.innerHTML = `Nginx: <span style="color:#10b981;">Active</span> <span style="font-weight:400;color:var(--text-muted);font-size:0.72rem;">${verDisplay}</span>`;
            } else {
              ngxDot.className = 'status-dot disconnected';
              ngxText.innerHTML = `Nginx: <span style="color:#f59e0b;">Inactive (Stopped)</span>`;
            }
          } else {
            ngxDot.className = 'status-dot disconnected';
            ngxText.innerHTML = `Nginx: <span style="color:#ef4444;">Not Installed</span> <button class="btn btn-primary btn-xs" id="hdrInstallNginx_${ngxWinId}" style="margin-left:6px;padding:1px 6px;font-size:0.68rem;">Install Nginx</button>`;
            const instBtn = bodyEl.querySelector(`#hdrInstallNginx_${ngxWinId}`);
            if (instBtn) instBtn.onclick = () => installSoftware('nginx');
          }

          if (st.certbot_installed) {
            certDot.className = 'status-dot connected';
            certText.innerHTML = `Certbot: <span style="color:#10b981;">Ready</span> <span style="font-weight:400;color:var(--text-muted);font-size:0.72rem;">(${escapeHtml(st.certbot_version)})</span>`;
          } else if (st.certbot_broken) {
            certDot.className = 'status-dot disconnected';
            certText.innerHTML = `Certbot: <span style="color:#ef4444;" title="${escapeHtml(st.certbot_error || 'Dependency conflict')}">Broken (OpenSSL Error)</span> <button class="btn btn-secondary btn-xs" id="hdrRepairCert_${ngxWinId}" style="margin-left:6px;padding:1px 6px;font-size:0.68rem;" title="Reinstall and repair Certbot OpenSSL dependencies">Repair Certbot</button>`;
            const repBtn = bodyEl.querySelector(`#hdrRepairCert_${ngxWinId}`);
            if (repBtn) repBtn.onclick = () => installSoftware('certbot');
          } else {
            certDot.className = 'status-dot disconnected';
            certText.innerHTML = `Certbot: <span style="color:var(--text-muted);">Not Installed</span> <button class="btn btn-secondary btn-xs" id="hdrInstallCert_${ngxWinId}" style="margin-left:6px;padding:1px 6px;font-size:0.68rem;">Install Certbot</button>`;
            const instBtn = bodyEl.querySelector(`#hdrInstallCert_${ngxWinId}`);
            if (instBtn) instBtn.onclick = () => installSoftware('certbot');
          }
        };

        // 2. Fetch Sites
        const fetchSites = async () => {
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/nginx/sites`);
            const res = await resp.json();
            if (res.success && res.sites) {
              sitesList = res.sites;
            }
          } catch (e) {
            console.error('Error fetching sites:', e);
          }
        };

        // 3. Fetch Certificates
        const fetchCertificates = async () => {
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/nginx/ssl/certificates`);
            const res = await resp.json();
            if (res.success && res.certificates) {
              certsList = res.certificates;
            }
          } catch (e) {
            console.error('Error fetching certificates:', e);
          }
        };

        // 4. Render Domains Tab
        const renderDomainsTab = async () => {
          contentPane.innerHTML = `
            <div style="padding:0.9rem; display:flex; flex-direction:column; height:100%; box-sizing:border-box;">
              <!-- Sub-header Toolbar -->
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.6rem; flex:1; max-width:440px;">
                  <div style="position:relative; flex:1;">
                    <input type="text" id="domainFilterInput_${ngxWinId}" placeholder="Filter domains, proxy targets, or configs..." class="form-control" style="width:100%; font-size:0.78rem; padding:0.35rem 0.6rem 0.35rem 1.85rem; box-sizing:border-box;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute; left:8px; top:50%; transform:translateY(-50%); color:var(--text-muted); pointer-events:none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  <button class="btn btn-secondary btn-sm" id="domainRefreshBtn_${ngxWinId}" title="Refresh site listings" style="padding:0.35rem 0.65rem;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                  </button>
                </div>
                <button class="btn btn-primary btn-sm" id="openAddDomainBtn_${ngxWinId}" style="display:flex; align-items:center; gap:0.4rem; padding:0.4rem 0.8rem; font-weight:600;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Domain / Reverse Proxy
                </button>
              </div>

              <!-- Sites Table Container -->
              <div class="table-responsive" style="flex:1; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:6px; background:var(--bg-surface);">
                <table class="table" style="margin:0; width:100%; border-collapse:collapse; font-size:0.78rem;">
                  <thead>
                    <tr style="background:#0d131f; border-bottom:1px solid var(--border-subtle); color:var(--text-muted); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.04em;">
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Domain / Server Name</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Routing Target</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Ports</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">SSL (HTTPS)</th>
                      <th style="padding:0.6rem 0.75rem; text-align:center; font-weight:600; width:90px;">Status</th>
                      <th style="padding:0.6rem 0.75rem; text-align:right; font-weight:600; width:190px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="sitesTableBody_${ngxWinId}">
                    <tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Loading domains &amp; routes...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          `;

          const addBtn = contentPane.querySelector(`#openAddDomainBtn_${ngxWinId}`);
          if (addBtn) addBtn.onclick = () => openAddDomainModal();

          const filterInput = contentPane.querySelector(`#domainFilterInput_${ngxWinId}`);
          if (filterInput) filterInput.oninput = () => renderSitesList();

          const refreshBtn = contentPane.querySelector(`#domainRefreshBtn_${ngxWinId}`);
          if (refreshBtn) refreshBtn.onclick = async () => {
            refreshBtn.disabled = true;
            await fetchSites();
            renderSitesList();
            refreshBtn.disabled = false;
          };

          await fetchSites();
          renderSitesList();
        };

        const renderSitesList = () => {
          const tbody = contentPane.querySelector(`#sitesTableBody_${ngxWinId}`);
          if (!tbody) return;

          const filterInput = contentPane.querySelector(`#domainFilterInput_${ngxWinId}`);
          const q = filterInput ? filterInput.value.toLowerCase().trim() : '';

          let filtered = sitesList;
          if (q) {
            filtered = sitesList.filter(s => {
              const names = (s.server_names || []).join(' ').toLowerCase();
              const target = (s.proxy_pass || s.root || '').toLowerCase();
              const fname = (s.filename || '').toLowerCase();
              return names.includes(q) || target.includes(q) || fname.includes(q);
            });
          }

          if (filtered.length === 0) {
            tbody.innerHTML = `
              <tr>
                <td colspan="6" style="text-align:center; padding:3.5rem 1.5rem;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:0.6rem; color:var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.3" style="color:var(--text-muted); opacity:0.6;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    <div style="font-weight:600; font-size:0.88rem; color:var(--text-primary);">${q ? 'No matching domains found' : 'No Domains or Proxy Routes Configured'}</div>
                    <div style="font-size:0.75rem; max-width:380px;">${q ? 'Try clearing your search query.' : 'Forward traffic from your domains to background apps running on specific ports (e.g. Node, Python, Docker) with automated SSL.'}</div>
                    ${!q ? `<button class="btn btn-primary btn-sm" id="emptyAddBtn_${ngxWinId}" style="margin-top:0.4rem;">Add Your First Domain / Reverse Proxy</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
            const emptyBtn = tbody.querySelector(`#emptyAddBtn_${ngxWinId}`);
            if (emptyBtn) emptyBtn.onclick = () => openAddDomainModal();
            return;
          }

          tbody.innerHTML = filtered.map(site => {
            const domainDisplay = (site.server_names && site.server_names.length > 0 && site.server_names[0] !== '_')
              ? site.server_names.join(', ')
              : (site.filename === 'default' ? 'Default Host (_)' : site.filename);

            const isProxy = site.site_type === 'proxy' || Boolean(site.proxy_pass);
            const targetBadge = isProxy
              ? `<span style="background:color-mix(in srgb, var(--sm-accent) 12%, transparent); color:var(--sm-accent); border:1px solid color-mix(in srgb, var(--sm-accent) 22%, transparent); padding:2px 7px; border-radius:4px; font-family:var(--font-mono); font-size:0.72rem; display:inline-block; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(site.proxy_pass)}">Proxy &rarr; ${escapeHtml(site.proxy_pass || 'Port Routing')}</span>`
              : `<span style="background:rgba(203,213,225,0.08); color:#cbd5e1; border:1px solid rgba(255,255,255,0.12); padding:2px 7px; border-radius:4px; font-family:var(--font-mono); font-size:0.72rem; display:inline-block; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(site.root)}">Static &rarr; ${escapeHtml(site.root || '/var/www')}</span>`;

            const portsBadges = (site.ports && site.ports.length > 0)
              ? site.ports.map(p => {
                  const isSslPort = (p === 443 || String(p).includes('443') || String(p).includes('ssl'));
                  return `<span style="background:${isSslPort ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.1)'}; color:${isSslPort ? '#34d399' : '#94a3b8'}; border:1px solid ${isSslPort ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.2)'}; padding:1px 5px; border-radius:3px; font-family:var(--font-mono); font-size:0.68rem; margin-right:3px;">${escapeHtml(p)}</span>`;
                }).join('')
              : '<span style="color:var(--text-muted);">-</span>';

            const sslCell = site.has_ssl
              ? `<span class="badge badge-online" style="display:inline-flex; align-items:center; gap:4px; font-size:0.7rem; padding:2px 6px;">
                   <span class="status-dot connected"></span> HTTPS
                 </span>`
              : `<div style="display:flex; align-items:center; gap:4px;">
                   <span class="badge badge-offline" style="display:inline-flex; align-items:center; gap:4px; font-size:0.7rem; padding:2px 6px;">
                     <span class="status-dot disconnected"></span> HTTP Only
                   </span>
                   <button class="btn btn-secondary btn-xs issue-ssl-btn" data-domain="${escapeHtml(site.server_names[0] || site.filename)}" title="Issue Let's Encrypt certificate" style="padding:1px 6px; font-size:0.68rem;">+ SSL</button>
                 </div>`;

            const statusToggle = site.is_conf_d
              ? `<span style="font-size:0.7rem; color:var(--text-muted);" title="File resides in conf.d/ (always loaded)">conf.d</span>`
              : `<button class="btn btn-xs toggle-site-btn ${site.enabled ? 'btn-secondary' : 'btn-ghost'}" data-file="${escapeHtml(site.filename)}" data-enable="${!site.enabled}" style="padding:2px 8px; font-size:0.7rem; min-width:64px;">
                   ${site.enabled ? '<span style="color:#10b981;">Enabled</span>' : '<span style="color:var(--text-muted);">Disabled</span>'}
                 </button>`;

            return `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:0.6rem 0.75rem;">
                  <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(domainDisplay)}</div>
                  <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-muted); margin-top:1px;">${escapeHtml(site.filename)}</div>
                </td>
                <td style="padding:0.6rem 0.75rem;">${targetBadge}</td>
                <td style="padding:0.6rem 0.75rem;">${portsBadges}</td>
                <td style="padding:0.6rem 0.75rem;">${sslCell}</td>
                <td style="padding:0.6rem 0.75rem; text-align:center;">${statusToggle}</td>
                <td style="padding:0.6rem 0.75rem; text-align:right;">
                  <div style="display:flex; align-items:center; justify-content:flex-end; gap:0.35rem;">
                    <button class="btn btn-secondary btn-xs edit-config-btn" data-file="${escapeHtml(site.filename)}" title="Edit configuration file">
                      Config
                    </button>
                    <button class="btn btn-danger btn-xs delete-site-btn" data-file="${escapeHtml(site.filename)}" data-domain="${escapeHtml(domainDisplay)}" title="Delete site configuration">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('');

          // Wire row event listeners
          tbody.querySelectorAll('.toggle-site-btn').forEach(btn => {
            btn.onclick = async () => {
              const filename = btn.dataset.file;
              const enable = btn.dataset.enable === 'true';
              btn.disabled = true;
              try {
                const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/toggle`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename, enable })
                });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(res.message || 'Site toggled successfully', 'success');
                  await fetchSites();
                  renderSitesList();
                } else {
                  if (window.showToast) window.showToast(res.message || 'Failed to toggle site', 'error');
                }
              } catch (e) {
                DesktopModal.alert({ title: 'Nginx Error', message: 'Error toggling site: ' + e, type: 'danger' });
              } finally {
                btn.disabled = false;
              }
            };
          });

          tbody.querySelectorAll('.edit-config-btn').forEach(btn => {
            btn.onclick = () => {
              const filename = btn.dataset.file;
              switchTab('editor', { file: filename });
            };
          });

          tbody.querySelectorAll('.issue-ssl-btn').forEach(btn => {
            btn.onclick = () => {
              const domain = btn.dataset.domain;
              openIssueSslModal(domain);
            };
          });

          tbody.querySelectorAll('.delete-site-btn').forEach(btn => {
            btn.onclick = async () => {
              const filename = btn.dataset.file;
              const domain = btn.dataset.domain;
              const ok = await DesktopModal.confirm({
                title: 'Delete Virtual Host',
                message: `Are you sure you want to permanently delete the site configuration '${filename}' (${domain})?\n\nThis will remove the configuration and its enabled symlink.`,
                confirmText: 'Delete Site',
                isDanger: true
              });
              if (!ok) return;
              btn.disabled = true;
              try {
                const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/delete`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename })
                });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(res.message || 'Site deleted successfully', 'success');
                  await fetchSites();
                  renderSitesList();
                } else {
                  if (window.showToast) window.showToast(res.message || 'Failed to delete site', 'error');
                }
              } catch (e) {
                DesktopModal.alert({ title: 'Nginx Error', message: 'Error deleting site: ' + e, type: 'danger' });
              } finally {
                btn.disabled = false;
              }
            };
          });
        };

        // 5. Render Editor Tab
        const renderEditorTab = async (opts = {}) => {
          if (opts.file) {
            currentEditFile = opts.file;
          }

          contentPane.innerHTML = `
            <div style="display:flex; flex-direction:column; height:100%; box-sizing:border-box;">
              <!-- Editor Sub-bar -->
              <div style="background:#090d16; border-bottom:1px solid var(--border-subtle); padding:0.45rem 0.9rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                  <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Config File:</span>
                  <select class="form-control" id="editorFileSelect_${ngxWinId}" style="width:260px; font-size:0.78rem; padding:0.25rem 0.5rem; font-family:var(--font-mono);">
                    <option value="/etc/nginx/nginx.conf">/etc/nginx/nginx.conf (Main)</option>
                    ${sitesList.map(s => `
                      <option value="${escapeHtml(s.filename)}" ${s.filename === currentEditFile ? 'selected' : ''}>
                        ${escapeHtml(s.filename)} (${(s.server_names || []).slice(0, 1).join('') || 'site'})
                      </option>
                    `).join('')}
                  </select>
                  <button class="btn btn-ghost btn-xs" id="reloadEditorFileBtn_${ngxWinId}" title="Reload file from disk">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                  </button>
                </div>

                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <button class="btn btn-secondary btn-xs" id="editorTestBtn_${ngxWinId}" title="Test syntax on remote host without saving">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Test Syntax (nginx -t)
                  </button>
                  <button class="btn btn-primary btn-xs" id="editorSaveBtn_${ngxWinId}" style="display:flex; align-items:center; gap:4px; font-weight:600; padding:0.35rem 0.75rem;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Save &amp; Reload Nginx
                  </button>
                </div>
              </div>

              <!-- Main Code Surface -->
              <div style="flex:1; position:relative; display:flex; flex-direction:column; background:#070b12;">
                <textarea id="ngxCodeArea_${ngxWinId}" spellcheck="false" placeholder="Loading configuration..." style="flex:1; width:100%; border:none; outline:none; background:#070b12; color:#f8fafc; font-family:'Fira Code', 'Cascadia Code', monospace; font-size:0.8rem; line-height:1.55; padding:0.85rem; box-sizing:border-box; resize:none; white-space:pre;"></textarea>
              </div>

              <!-- Console Output Banner -->
              <div id="editorOutputBox_${ngxWinId}" style="display:none; background:#0d131f; border-top:1px solid var(--border-subtle); padding:0.5rem 0.85rem; font-family:var(--font-mono); font-size:0.72rem; max-height:120px; overflow-y:auto;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.25rem;">
                  <span id="editorOutputTitle_${ngxWinId}" style="font-weight:600; font-size:0.72rem;">Nginx Syntax Validation Result:</span>
                  <button type="button" class="btn btn-ghost btn-xs" id="closeEditorOutputBtn_${ngxWinId}" style="padding:0 4px; font-size:0.68rem;">Dismiss</button>
                </div>
                <pre id="editorOutputText_${ngxWinId}" style="margin:0; white-space:pre-wrap; word-break:break-all;"></pre>
              </div>
            </div>
          `;

          const fileSelect = contentPane.querySelector(`#editorFileSelect_${ngxWinId}`);
          const codeArea = contentPane.querySelector(`#ngxCodeArea_${ngxWinId}`);
          const saveBtn = contentPane.querySelector(`#editorSaveBtn_${ngxWinId}`);
          const testBtn = contentPane.querySelector(`#editorTestBtn_${ngxWinId}`);
          const reloadBtn = contentPane.querySelector(`#reloadEditorFileBtn_${ngxWinId}`);
          const outputBox = contentPane.querySelector(`#editorOutputBox_${ngxWinId}`);
          const outputTitle = contentPane.querySelector(`#editorOutputTitle_${ngxWinId}`);
          const outputText = contentPane.querySelector(`#editorOutputText_${ngxWinId}`);
          const closeOutputBtn = contentPane.querySelector(`#closeEditorOutputBtn_${ngxWinId}`);

          if (closeOutputBtn) {
            closeOutputBtn.onclick = () => { outputBox.style.display = 'none'; };
          }

          // Tab key handling in textarea
          codeArea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const s = codeArea.selectionStart;
              const end = codeArea.selectionEnd;
              codeArea.value = codeArea.value.substring(0, s) + '    ' + codeArea.value.substring(end);
              codeArea.selectionStart = codeArea.selectionEnd = s + 4;
            }
          });

          // Load file content
          const loadCurrentFile = async () => {
            const chosenFile = fileSelect.value;
            currentEditFile = chosenFile;
            codeArea.disabled = true;
            codeArea.value = `// Loading ${chosenFile}...`;
            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/config?file=${encodeURIComponent(chosenFile)}`);
              const res = await resp.json();
              if (res.success) {
                codeArea.value = res.content || '';
              } else {
                codeArea.value = `// Error loading file: ${res.error || 'Unknown error'}`;
              }
            } catch (e) {
              codeArea.value = `// Network error: ${e}`;
            } finally {
              codeArea.disabled = false;
            }
          };

          fileSelect.onchange = loadCurrentFile;
          reloadBtn.onclick = loadCurrentFile;

          testBtn.onclick = async () => {
            testBtn.disabled = true;
            testBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Testing...`;
            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test' })
              });
              const res = await resp.json();
              outputBox.style.display = 'block';
              if (res.success) {
                outputTitle.innerHTML = `<span style="color:#10b981;">&check; Syntax OK</span> - Nginx configuration test successful`;
                outputText.style.color = '#34d399';
                outputText.textContent = res.message || 'Syntax is ok, test is successful.';
              } else {
                outputTitle.innerHTML = `<span style="color:#ef4444;">&cross; Syntax Error</span> in configuration`;
                outputText.style.color = '#f87171';
                outputText.textContent = res.message || 'Syntax check failed';
              }
            } catch (e) {
              DesktopModal.alert({ title: 'Syntax Test Error', message: String(e), type: 'danger' });
            } finally {
              testBtn.disabled = false;
              testBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>Test Syntax (nginx -t)`;
            }
          };

          saveBtn.onclick = async () => {
            const filename = fileSelect.value;
            const content = codeArea.value;
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Validating &amp; Saving...`;
            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, content })
              });
              const res = await resp.json();
              outputBox.style.display = 'block';
              if (res.success) {
                outputTitle.innerHTML = `<span style="color:#10b981;">&check; Saved &amp; Reloaded</span>`;
                outputText.style.color = '#34d399';
                outputText.textContent = res.message || 'Configuration saved and Nginx reloaded successfully.';
                if (window.showToast) window.showToast('Config saved and Nginx reloaded!', 'success');
              } else {
                outputTitle.innerHTML = `<span style="color:#ef4444;">&cross; Syntax Error - Save Rolled Back</span>`;
                outputText.style.color = '#f87171';
                outputText.textContent = res.message || 'Syntax check failed. Reverted to previous backup.';
                if (window.showToast) window.showToast('Syntax error! Rolled back to safe backup.', 'error');
              }
            } catch (e) {
              DesktopModal.alert({ title: 'Save Config Error', message: String(e), type: 'danger' });
            } finally {
              saveBtn.disabled = false;
              saveBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save &amp; Reload Nginx`;
            }
          };

          await loadCurrentFile();
        };

        // 6. Render SSL Certificates Tab
        const renderSslTab = async () => {
          contentPane.innerHTML = `
            <div style="padding:0.9rem; display:flex; flex-direction:column; height:100%; box-sizing:border-box;">
              <!-- Sub-bar -->
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
                <div>
                  <h3 style="margin:0; font-size:0.95rem; font-weight:600; color:var(--text-primary);">Let's Encrypt SSL Certificates</h3>
                  <p style="margin:2px 0 0 0; font-size:0.75rem; color:var(--text-secondary);">Automated zero-downtime certificate issuance and renewal via Certbot Nginx plugin.</p>
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <button class="btn btn-secondary btn-sm" id="renewAllSslBtn_${ngxWinId}" style="display:flex; align-items:center; gap:0.35rem; font-weight:500;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    Renew All Certificates
                  </button>
                  <button class="btn btn-primary btn-sm" id="issueNewCertBtn_${ngxWinId}" style="display:flex; align-items:center; gap:0.35rem; font-weight:600;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Issue New Certificate
                  </button>
                </div>
              </div>

              <!-- Certbot Not Installed Warning Banner -->
              <div id="certbotNotInstalledBox_${ngxWinId}" style="display:none; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); border-radius:6px; padding:0.75rem 1rem; margin-bottom:0.85rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                  <div style="display:flex; align-items:center; gap:0.5rem;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span style="font-size:0.78rem; color:#fde68a;">Certbot is not installed on this server. Install it to manage SSL certificates.</span>
                  </div>
                  <button class="btn btn-primary btn-xs" id="installCertbotBannerBtn_${ngxWinId}" style="padding:0.3rem 0.7rem;">Install Certbot</button>
                </div>
              </div>

              <!-- Certificates Table -->
              <div class="table-responsive" style="flex:1; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:6px; background:var(--bg-surface);">
                <table class="table" style="margin:0; width:100%; border-collapse:collapse; font-size:0.78rem;">
                  <thead>
                    <tr style="background:#0d131f; border-bottom:1px solid var(--border-subtle); color:var(--text-muted); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.04em;">
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Certificate Name</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Covered Domains</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Expiry &amp; Validity</th>
                      <th style="padding:0.6rem 0.75rem; text-align:left; font-weight:600;">Certificate Path</th>
                      <th style="padding:0.6rem 0.75rem; text-align:right; font-weight:600; width:120px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="certsTableBody_${ngxWinId}">
                    <tr><td colspan="5" style="text-align:center; padding:3rem; color:var(--text-muted);"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Loading certificates...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          `;

          if (statusData && !statusData.certbot_installed) {
            const notInstBox = contentPane.querySelector(`#certbotNotInstalledBox_${ngxWinId}`);
            if (notInstBox) {
              notInstBox.style.display = 'block';
              if (statusData.certbot_broken) {
                const spanEl = notInstBox.querySelector('span');
                if (spanEl) spanEl.textContent = 'Certbot has a Python OpenSSL dependency conflict on this server. Click Repair Certbot to fix it.';
                const bBtn = notInstBox.querySelector(`#installCertbotBannerBtn_${ngxWinId}`);
                if (bBtn) bBtn.textContent = 'Repair Certbot';
              }
            }
            const instBtn = contentPane.querySelector(`#installCertbotBannerBtn_${ngxWinId}`);
            if (instBtn) instBtn.onclick = () => installSoftware('certbot');
          }

          const renewAllBtn = contentPane.querySelector(`#renewAllSslBtn_${ngxWinId}`);
          if (renewAllBtn) {
            renewAllBtn.onclick = async () => {
              const forceRenew = await DesktopModal.confirm({
                title: 'Certbot SSL Renewal',
                message: "Force renewal for all certificates now?\n\n- Click 'Force Renew' to contact Let's Encrypt and re-issue new 90-day certificates immediately.\n- Click 'Due Only' to only renew certificates due for renewal (< 30 days left).",
                confirmText: 'Force Renew',
                cancelText: 'Due Only'
              });
              renewAllBtn.disabled = true;
              renewAllBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Renewing...`;
              try {
                const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/ssl/renew`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ force: forceRenew })
                });
                showCommandOutputModal(`Certbot SSL Renewal Result (${forceRenew ? 'Forced' : 'Standard'})`, res.message || 'Renewal complete.', res.success);
                if (res.success) {
                  if (window.showToast) window.showToast('Renewal command completed', 'success');
                  await fetchCertificates();
                  renderCertsList();
                } else {
                  if (window.showToast) window.showToast(res.message || 'Renewal failed', 'error');
                }
              } catch (e) {
                showCommandOutputModal('Renewal Error', String(e), false);
              } finally {
                renewAllBtn.disabled = false;
                renewAllBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Renew All Certificates`;
              }
            };
          }

          const issueNewBtn = contentPane.querySelector(`#issueNewCertBtn_${ngxWinId}`);
          if (issueNewBtn) {
            issueNewBtn.onclick = () => openIssueSslModal();
          }

          await fetchCertificates();
          renderCertsList();
        };

        const renderCertsList = () => {
          const tbody = contentPane.querySelector(`#certsTableBody_${ngxWinId}`);
          if (!tbody) return;

          if (certsList.length === 0) {
            tbody.innerHTML = `
              <tr>
                <td colspan="5" style="text-align:center; padding:3.5rem 1.5rem;">
                  <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem; color:var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.3" style="color:var(--text-muted); opacity:0.6;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <div style="font-weight:600; font-size:0.88rem; color:var(--text-primary);">No Active Let's Encrypt Certificates</div>
                    <div style="font-size:0.75rem; max-width:380px;">Free 90-day SSL certificates issued via Certbot will be automatically monitored and listed here.</div>
                    <button class="btn btn-primary btn-sm" id="emptyCertBtn_${ngxWinId}" style="margin-top:0.4rem;">Issue New Certificate</button>
                  </div>
                </td>
              </tr>
            `;
            const emptyBtn = tbody.querySelector(`#emptyCertBtn_${ngxWinId}`);
            if (emptyBtn) emptyBtn.onclick = () => openIssueSslModal();
            return;
          }

          tbody.innerHTML = certsList.map(c => {
            const daysLeft = c.valid_days;
            let validityBadge = '';
            if (daysLeft !== null && daysLeft !== undefined) {
              if (daysLeft > 30) {
                validityBadge = `<span class="badge badge-online" style="font-size:0.7rem; padding:2px 6px;">${daysLeft} days remaining</span>`;
              } else if (daysLeft > 0) {
                validityBadge = `<span class="badge" style="background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); font-size:0.7rem; padding:2px 6px;">${daysLeft} days left (Expiring soon)</span>`;
              } else {
                validityBadge = `<span class="badge badge-offline" style="font-size:0.7rem; padding:2px 6px;">Expired</span>`;
              }
            }

            const domainsBadges = (c.domains && c.domains.length > 0)
              ? c.domains.map(d => `<span style="background:color-mix(in srgb, var(--sm-accent) 10%, transparent); color:var(--sm-accent); border:1px solid color-mix(in srgb, var(--sm-accent) 20%, transparent); padding:1px 6px; border-radius:3px; font-family:var(--font-mono); font-size:0.7rem; margin-right:3px;">${escapeHtml(d)}</span>`).join('')
              : '<span style="color:var(--text-muted);">-</span>';

            return `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:0.6rem 0.75rem;">
                  <strong style="color:var(--text-primary);">${escapeHtml(c.name)}</strong>
                </td>
                <td style="padding:0.6rem 0.75rem;">${domainsBadges}</td>
                <td style="padding:0.6rem 0.75rem;">
                  <div>${validityBadge}</div>
                  <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(c.expiry || '')}</div>
                </td>
                <td style="padding:0.6rem 0.75rem;">
                  <span style="font-family:var(--font-mono); font-size:0.7rem; color:var(--text-secondary); max-width:220px; overflow:hidden; text-overflow:ellipsis; display:inline-block;" title="${escapeHtml(c.path || '')}">${escapeHtml(c.path || '-')}</span>
                </td>
                <td style="padding:0.6rem 0.75rem; text-align:right;">
                  <button class="btn btn-secondary btn-xs renew-cert-row-btn" data-certname="${escapeHtml(c.name)}" data-domain="${escapeHtml(c.domains[0] || c.name)}" title="Renew this certificate">
                    Renew
                  </button>
                </td>
              </tr>
            `;
          }).join('');

          tbody.querySelectorAll('.renew-cert-row-btn').forEach(btn => {
            btn.onclick = async () => {
              const certName = btn.dataset.certname || btn.dataset.domain;
              const forceRenew = await DesktopModal.confirm({
                title: 'Renew Certificate',
                message: `Renew certificate '${certName}' immediately via Let's Encrypt?\n\nThis will execute:\nsudo certbot renew --cert-name ${certName} --force-renewal`,
                confirmText: 'Renew Certificate'
              });
              if (!forceRenew) return;

              btn.disabled = true;
              btn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;"></span>`;
              try {
                const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/ssl/renew`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ domain: certName, force: true })
                });
                showCommandOutputModal(`Certbot Renewal Output: ${certName}`, res.message || 'Renewal completed.', res.success);
                if (res.success) {
                  if (window.showToast) window.showToast(`Certificate '${certName}' renewed!`, 'success');
                  await fetchCertificates();
                  renderCertsList();
                } else {
                  if (window.showToast) window.showToast(res.message || 'Renewal failed', 'error');
                }
              } catch (e) {
                showCommandOutputModal(`Renewal Error: ${certName}`, String(e), false);
              } finally {
                btn.disabled = false;
                btn.textContent = 'Renew';
              }
            };
          });
        };

        // 7. Tab Switching
        const switchTab = (tab, opts = {}) => {
          currentTab = tab;
          bodyEl.querySelectorAll('.ngx-tab-nav-btn').forEach(b => {
            const isActive = (b.dataset.tab === tab);
            b.classList.toggle('active', isActive);
            b.style.borderBottomColor = isActive ? '#10b981' : 'transparent';
            b.style.color = isActive ? '#ffffff' : 'var(--text-secondary)';
            b.style.fontWeight = isActive ? '600' : '500';
          });

          if (tab === 'domains') renderDomainsTab();
          else if (tab === 'editor') renderEditorTab(opts);
          else if (tab === 'ssl') renderSslTab();
        };

        bodyEl.querySelectorAll('.ngx-tab-nav-btn').forEach(btn => {
          btn.onclick = () => switchTab(btn.dataset.tab);
        });

        winObj._switchTab = (tab, opts) => switchTab(tab, opts);

        // 8. Add Domain / Reverse Proxy Modal
        const openAddDomainModal = () => {
          const modalBackdrop = document.createElement('div');
          modalBackdrop.style.cssText = 'position:absolute; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:100; padding:1rem;';
          modalBackdrop.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; width:100%; max-width:520px; box-shadow:0 20px 40px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden;">
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1.1rem; border-bottom:1px solid var(--border-subtle); background:#0c121e;">
                <h4 style="margin:0; font-size:0.92rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:0.45rem;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg>
                  Add Domain / Reverse Proxy
                </h4>
                <button type="button" class="btn btn-ghost btn-xs" id="closeAddModalBtn_${ngxWinId}" style="padding:2px 6px;">&times;</button>
              </div>

              <div style="padding:1.1rem; display:flex; flex-direction:column; gap:0.9rem; max-height:75vh; overflow-y:auto;">
                <!-- Domain Name -->
                <div>
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Domain Name (FQDN) *</label>
                  <input type="text" class="form-control" id="mDomainName_${ngxWinId}" placeholder="e.g. app.yourdomain.com or mydomain.com" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box;">
                  <span style="font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:block;">Ensure your DNS A/AAAA record points to this server IP before obtaining SSL.</span>
                </div>

                <!-- Routing Type -->
                <div>
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.35rem; color:#cbd5e1;">Routing Target Type</label>
                  <div style="display:flex; gap:1.25rem; font-size:0.78rem;">
                    <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                      <input type="radio" name="mRouteType_${ngxWinId}" value="proxy" checked>
                      <span>Reverse Proxy (Port)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                      <input type="radio" name="mRouteType_${ngxWinId}" value="static">
                      <span>Static Directory</span>
                    </label>
                  </div>
                </div>

                <!-- Proxy Port Input -->
                <div id="mProxyBox_${ngxWinId}">
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Application Port / Internal Address *</label>
                  <input type="text" class="form-control" id="mProxyPort_${ngxWinId}" placeholder="e.g. 3000, 8080, or 127.0.0.1:5000" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box; font-family:var(--font-mono);">
                  <span style="font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:block;">Requests for this domain will be forwarded internally to this local port.</span>
                </div>

                <!-- Static Directory Input -->
                <div id="mStaticBox_${ngxWinId}" style="display:none;">
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Web Root Path *</label>
                  <input type="text" class="form-control" id="mStaticRoot_${ngxWinId}" placeholder="/var/www/my-domain" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box; font-family:var(--font-mono);">
                </div>

                <!-- Let's Encrypt Checkbox -->
                <div style="background:#0a0f1a; border:1px solid var(--border-subtle); border-radius:6px; padding:0.75rem;">
                  <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; font-size:0.78rem;">
                    <input type="checkbox" id="mEnableSsl_${ngxWinId}" style="margin-top:2px;">
                    <div>
                      <span style="font-weight:600; color:#34d399;">Obtain Free Let's Encrypt SSL Certificate</span>
                      <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:1px;">Automatically configures HTTPS with HTTP-to-HTTPS redirect.</div>
                    </div>
                  </label>

                  <div id="mEmailBox_${ngxWinId}" style="display:none; margin-top:0.6rem; padding-left:1.45rem;">
                    <label style="display:block; font-weight:600; font-size:0.74rem; margin-bottom:0.25rem; color:#cbd5e1;">Admin Email Address *</label>
                    <input type="email" class="form-control" id="mSslEmail_${ngxWinId}" placeholder="admin@yourdomain.com" style="width:100%; font-size:0.78rem; padding:0.35rem 0.55rem; box-sizing:border-box;">
                    <span style="font-size:0.68rem; color:var(--text-muted); margin-top:2px; display:block;">Required by Let's Encrypt for urgent security and renewal alerts.</span>
                  </div>
                </div>

                <div id="mAddStatus_${ngxWinId}" style="display:none; padding:0.5rem 0.75rem; border-radius:4px; font-size:0.74rem;"></div>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:0.4rem; padding:0.75rem 1.1rem; border-top:1px solid var(--border-subtle); background:#0c121e;">
                <button type="button" class="btn btn-ghost btn-sm" id="mCancelAddBtn_${ngxWinId}">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="mSubmitAddBtn_${ngxWinId}" style="font-weight:600;">Deploy Domain Route</button>
              </div>
            </div>
          `;
          container.appendChild(modalBackdrop);

          const closeModal = () => {
            if (modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop);
          };

          modalBackdrop.querySelector(`#closeAddModalBtn_${ngxWinId}`).onclick = closeModal;
          modalBackdrop.querySelector(`#mCancelAddBtn_${ngxWinId}`).onclick = closeModal;

          // Route type toggle
          const proxyBox = modalBackdrop.querySelector(`#mProxyBox_${ngxWinId}`);
          const staticBox = modalBackdrop.querySelector(`#mStaticBox_${ngxWinId}`);
          modalBackdrop.querySelectorAll(`input[name="mRouteType_${ngxWinId}"]`).forEach(r => {
            r.onchange = () => {
              proxyBox.style.display = (r.value === 'proxy') ? 'block' : 'none';
              staticBox.style.display = (r.value === 'static') ? 'block' : 'none';
            };
          });

          // SSL checkbox toggle
          const enableSslCb = modalBackdrop.querySelector(`#mEnableSsl_${ngxWinId}`);
          const emailBox = modalBackdrop.querySelector(`#mEmailBox_${ngxWinId}`);
          enableSslCb.onchange = () => {
            emailBox.style.display = enableSslCb.checked ? 'block' : 'none';
          };

          // Submit handler
          const submitBtn = modalBackdrop.querySelector(`#mSubmitAddBtn_${ngxWinId}`);
          const statusBox = modalBackdrop.querySelector(`#mAddStatus_${ngxWinId}`);

          submitBtn.onclick = async () => {
            const domain = modalBackdrop.querySelector(`#mDomainName_${ngxWinId}`).value.trim().toLowerCase();
            const routeType = modalBackdrop.querySelector(`input[name="mRouteType_${ngxWinId}"]:checked`).value;
            const portOrUrl = modalBackdrop.querySelector(`#mProxyPort_${ngxWinId}`).value.trim();
            const rootPath = modalBackdrop.querySelector(`#mStaticRoot_${ngxWinId}`).value.trim();
            const enableSsl = enableSslCb.checked;
            const email = modalBackdrop.querySelector(`#mSslEmail_${ngxWinId}`).value.trim();

            if (!domain) {
              if (window.showToast) window.showToast('Please enter a valid domain name.', 'warning');
              else DesktopModal.alert({ title: 'Validation Error', message: 'Please enter a valid domain name.', type: 'warning' });
              return;
            }

            if (routeType === 'proxy' && !portOrUrl) {
              if (window.showToast) window.showToast('Please enter a proxy port or URL (e.g. 3000 or 127.0.0.1:3000).', 'warning');
              else DesktopModal.alert({ title: 'Validation Error', message: 'Please enter a proxy port or URL (e.g. 3000 or 127.0.0.1:3000).', type: 'warning' });
              return;
            }

            if (routeType === 'static' && !rootPath) {
              if (window.showToast) window.showToast('Please enter a static web root path (e.g. /var/www/my-domain).', 'warning');
              else DesktopModal.alert({ title: 'Validation Error', message: 'Please enter a static web root path (e.g. /var/www/my-domain).', type: 'warning' });
              return;
            }

            if (enableSsl && !email) {
              if (window.showToast) window.showToast('Please provide an email address for Let\'s Encrypt SSL registration.', 'warning');
              else DesktopModal.alert({ title: 'Validation Error', message: 'Please provide an email address for Let\'s Encrypt SSL registration.', type: 'warning' });
              return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;margin-right:5px;"></span>Deploying...`;
            statusBox.style.display = 'block';
            statusBox.style.background = 'rgba(56,189,248,0.1)';
            statusBox.style.color = '#38bdf8';
            statusBox.style.border = '1px solid color-mix(in srgb, var(--sm-accent) 20%, transparent)';
            statusBox.textContent = enableSsl
              ? 'Creating Nginx configuration, testing syntax, and obtaining Let\'s Encrypt SSL certificate...'
              : 'Creating Nginx configuration and reloading service...';

            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/site/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  domain,
                  site_type: routeType,
                  port_or_url: portOrUrl,
                  root_path: rootPath,
                  enable_ssl: enableSsl,
                  email
                })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(`Domain '${domain}' deployed successfully!`, 'success');
                closeModal();
                await fetchSites();
                if (currentTab === 'domains') renderSitesList();
              } else {
                statusBox.style.background = 'rgba(239,68,68,0.1)';
                statusBox.style.color = '#f87171';
                statusBox.style.border = '1px solid rgba(239,68,68,0.25)';
                statusBox.textContent = `Deployment Failed: ${res.message || 'Unknown error'}`;
              }
            } catch (e) {
              statusBox.style.background = 'rgba(239,68,68,0.1)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = `Network error: ${e}`;
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Deploy Domain Route';
            }
          };
        };

        // 9. Issue SSL Modal
        const openIssueSslModal = (defaultDomain = '') => {
          const modalBackdrop = document.createElement('div');
          modalBackdrop.style.cssText = 'position:absolute; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:100; padding:1rem;';
          modalBackdrop.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; width:100%; max-width:480px; box-shadow:0 20px 40px rgba(0,0,0,0.6); display:flex; flex-direction:column; overflow:hidden;">
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1.1rem; border-bottom:1px solid var(--border-subtle); background:#0c121e;">
                <h4 style="margin:0; font-size:0.92rem; font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:0.45rem;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Issue Let's Encrypt Certificate
                </h4>
                <button type="button" class="btn btn-ghost btn-xs" id="closeIssueModalBtn_${ngxWinId}" style="padding:2px 6px;">&times;</button>
              </div>

              <div style="padding:1.1rem; display:flex; flex-direction:column; gap:0.85rem;">
                <div>
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Domain Name *</label>
                  <input type="text" class="form-control" id="mSslDomain_${ngxWinId}" value="${escapeHtml(defaultDomain)}" placeholder="e.g. app.yourdomain.com" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box;">
                  <span style="font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:block;">Domain must resolve to this server IP address over port 80.</span>
                </div>

                <div>
                  <label style="display:block; font-weight:600; font-size:0.78rem; margin-bottom:0.3rem; color:#cbd5e1;">Admin Email Address *</label>
                  <input type="email" class="form-control" id="mIssueEmail_${ngxWinId}" placeholder="admin@yourdomain.com" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; box-sizing:border-box;">
                </div>

                <div id="mIssueStatus_${ngxWinId}" style="display:none; padding:0.5rem 0.75rem; border-radius:4px; font-size:0.74rem;"></div>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:0.4rem; padding:0.75rem 1.1rem; border-top:1px solid var(--border-subtle); background:#0c121e;">
                <button type="button" class="btn btn-ghost btn-sm" id="mCancelIssueBtn_${ngxWinId}">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="mSubmitIssueBtn_${ngxWinId}" style="font-weight:600;">Issue Certificate</button>
              </div>
            </div>
          `;
          container.appendChild(modalBackdrop);

          const closeModal = () => {
            if (modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop);
          };

          modalBackdrop.querySelector(`#closeIssueModalBtn_${ngxWinId}`).onclick = closeModal;
          modalBackdrop.querySelector(`#mCancelIssueBtn_${ngxWinId}`).onclick = closeModal;

          const submitBtn = modalBackdrop.querySelector(`#mSubmitIssueBtn_${ngxWinId}`);
          const statusBox = modalBackdrop.querySelector(`#mIssueStatus_${ngxWinId}`);

          submitBtn.onclick = async () => {
            const domain = modalBackdrop.querySelector(`#mSslDomain_${ngxWinId}`).value.trim().toLowerCase();
            const email = modalBackdrop.querySelector(`#mIssueEmail_${ngxWinId}`).value.trim();

            if (!domain || !email) {
              if (window.showToast) window.showToast('Both domain name and email address are required.', 'warning');
              else DesktopModal.alert({ title: 'Validation Error', message: 'Both domain name and email address are required.', type: 'warning' });
              return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;margin-right:5px;"></span>Requesting SSL...`;
            statusBox.style.display = 'block';
            statusBox.style.background = 'rgba(56,189,248,0.1)';
            statusBox.style.color = '#38bdf8';
            statusBox.style.border = '1px solid color-mix(in srgb, var(--sm-accent) 20%, transparent)';
            statusBox.textContent = 'Requesting certificate from Let\'s Encrypt and updating Nginx configuration...';

            try {
              const resp = await fetch(`/api/servers/${this.serverId}/nginx/ssl/issue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, email })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(`SSL Certificate for '${domain}' issued successfully!`, 'success');
                closeModal();
                await fetchSites();
                await fetchCertificates();
                if (currentTab === 'domains') renderSitesList();
                else if (currentTab === 'ssl') renderCertsList();
              } else {
                statusBox.style.background = 'rgba(239,68,68,0.1)';
                statusBox.style.color = '#f87171';
                statusBox.style.border = '1px solid rgba(239,68,68,0.25)';
                statusBox.textContent = `Certificate Error: ${res.message || 'Unknown error'}`;
              }
            } catch (e) {
              statusBox.style.background = 'rgba(239,68,68,0.1)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = `Network error: ${e}`;
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Issue Certificate';
            }
          };
        };

        // 10. Software Installer Helper
        const installSoftware = async (pkg) => {
          const ok = await DesktopModal.confirm({
            title: 'Install Software Package',
            message: `Install ${pkg} via server's native package manager now?`,
            confirmText: 'Install Package'
          });
          if (!ok) return;
          if (window.showToast) window.showToast(`Installing ${pkg} in background... Please wait.`, 'info');
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/nginx/install`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ package: pkg })
            });
            const res = await resp.json();
            if (res.success) {
              if (window.showToast) window.showToast(`${pkg} installed successfully!`, 'success');
              await fetchStatus();
              await fetchSites();
              if (currentTab === 'domains') renderSitesList();
              else if (currentTab === 'ssl') renderSslTab();
            } else {
              if (window.showToast) window.showToast(`Installation failed: ${res.message}`, 'error');
            }
          } catch (e) {
            DesktopModal.alert({ title: 'Install Error', message: String(e), type: 'danger' });
          }
        };

        // 11. Wire Top Header Quick Action Buttons
        const testBtn = bodyEl.querySelector(`#testNginxBtn_${ngxWinId}`);
        if (testBtn) {
          testBtn.onclick = async () => {
            testBtn.disabled = true;
            try {
              const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test' })
              });
              showCommandOutputModal('nginx -t (Configuration Test Output)', res.message || 'Syntax test complete.', res.success);
              if (res.success) {
                if (window.showToast) window.showToast('Nginx syntax is OK', 'success');
              } else {
                if (window.showToast) window.showToast('Nginx syntax error detected', 'error');
              }
            } catch (e) {
              showCommandOutputModal('Test Error', String(e), false);
            } finally {
              testBtn.disabled = false;
            }
          };
        }

        const reloadBtn = bodyEl.querySelector(`#reloadNginxBtn_${ngxWinId}`);
        if (reloadBtn) {
          reloadBtn.onclick = async () => {
            reloadBtn.disabled = true;
            try {
              const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reload' })
              });
              showCommandOutputModal('systemctl reload nginx (Live Process Verification)', res.message || 'Reload command finished.', res.success);
              if (res.success) {
                if (window.showToast) window.showToast('Nginx reloaded successfully', 'success');
              } else {
                if (window.showToast) window.showToast('Nginx reload failed: ' + res.message, 'error');
              }
            } catch (e) {
              showCommandOutputModal('Reload Error', String(e), false);
            } finally {
              reloadBtn.disabled = false;
              fetchStatus();
            }
          };
        }

        const restartBtn = bodyEl.querySelector(`#restartNginxBtn_${ngxWinId}`);
        if (restartBtn) {
          restartBtn.onclick = async () => {
            const ok = await DesktopModal.confirm({
              title: 'Restart Nginx Service',
              message: 'Restart Nginx service now? Active web connections may momentarily disconnect.',
              confirmText: 'Restart Nginx',
              isDanger: true
            });
            if (!ok) return;
            restartBtn.disabled = true;
            try {
              const res = await safeFetchJson(`/api/servers/${this.serverId}/nginx/action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'restart' })
              });
              showCommandOutputModal('systemctl restart nginx (Live Process Verification)', res.message || 'Restart command finished.', res.success);
              if (res.success) {
                if (window.showToast) window.showToast('Nginx restarted successfully', 'success');
              } else {
                if (window.showToast) window.showToast('Nginx restart failed: ' + res.message, 'error');
              }
            } catch (e) {
              showCommandOutputModal('Restart Error', String(e), false);
            } finally {
              restartBtn.disabled = false;
              fetchStatus();
            }
          };
        }

        const refreshAllBtn = bodyEl.querySelector(`#refreshAllBtn_${ngxWinId}`);
        if (refreshAllBtn) {
          refreshAllBtn.onclick = async () => {
            refreshAllBtn.disabled = true;
            await fetchStatus();
            await fetchSites();
            await fetchCertificates();
            if (currentTab === 'domains') renderSitesList();
            else if (currentTab === 'ssl') renderCertsList();
            refreshAllBtn.disabled = false;
            if (window.showToast) window.showToast('Nginx state refreshed', 'info');
          };
        }

        // Initialize state
        fetchStatus();
        fetchSites().then(() => {
          switchTab(currentTab, { file: currentEditFile });
        });
      }
    });
};

