/**
 * ShellMan OS: Cloudflare Domains & DNS Management (domains.js)
 */

DesktopAppsController.prototype.launchDomains = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('domains');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      if (params.zoneId && existing._openDomainDetails) {
        existing._openDomainDetails(params.zoneId);
      }
      return existing;
    }

    const domWinId = 'dom_' + Date.now();
    let cfAccount = null;
    let domainsList = [];
    let activeZoneId = params.zoneId || null;
    let activeDetailTab = 'dns';
    let cachedDnsRecords = [];
    let domainFilterStatus = 'ALL';
    let searchQuery = '';

    const winObj = WindowManager.createWindow({
      appId: 'domains',
      multiInstance: false,
      title: 'Cloudflare Domains & DNS Management',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
      width: 980,
      height: 620,
      contentHtml: `
        <div style="display:flex; flex-direction:column; height:100%; background:var(--bg-canvas); overflow:hidden;" id="domRoot_${domWinId}">
          <!-- Top Application Toolbar -->
          <div style="display:flex; align-items:center; justify-content:space-between; padding:0.45rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(255,255,255,0.02); flex-shrink:0; gap:0.5rem; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <div id="cfStatusPill_${domWinId}" style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.25rem 0.65rem; border-radius:12px; font-size:0.72rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); cursor:pointer;" title="Click to view Cloudflare Settings">
                <span class="sys-pulse-dot offline" id="cfDot_${domWinId}"></span>
                <span id="cfStatusText_${domWinId}" style="color:var(--text-muted);">Checking Cloudflare...</span>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:0.45rem;">
              <button class="btn btn-secondary btn-xs" id="btnSyncAll_${domWinId}" style="font-size:0.72rem; height:26px;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Sync Zones
              </button>
              <button class="btn btn-secondary btn-xs" id="btnCfSettings_${domWinId}" style="font-size:0.72rem; height:26px;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1z"></path></svg>
                Cloudflare Settings
              </button>
              <button class="btn btn-primary btn-xs" id="btnAddDomain_${domWinId}" style="font-weight:600; font-size:0.72rem; height:26px;">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Domain
              </button>
            </div>
          </div>

          <!-- Main Content Area: Dashboard View or Details View -->
          <div id="domMainArea_${domWinId}" style="flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;">
            <!-- Rendered dynamically -->
          </div>
        </div>
      `,
      onInit: async (bodyEl, winInstance) => {
        const root = bodyEl.querySelector(`#domRoot_${domWinId}`);
        const mainArea = root.querySelector(`#domMainArea_${domWinId}`);
        const cfPill = root.querySelector(`#cfStatusPill_${domWinId}`);
        const cfDot = root.querySelector(`#cfDot_${domWinId}`);
        const cfText = root.querySelector(`#cfStatusText_${domWinId}`);
        const btnSync = root.querySelector(`#btnSyncAll_${domWinId}`);
        const btnSettings = root.querySelector(`#btnCfSettings_${domWinId}`);
        const btnAdd = root.querySelector(`#btnAddDomain_${domWinId}`);

        // Helper: Status badge color
        const getZoneStatusBadge = (st) => {
          const s = (st || 'unknown').toLowerCase();
          if (s === 'active') return '<span class="badge" style="background:rgba(16,185,129,0.15); color:#34d399; font-weight:700;">Active</span>';
          if (s === 'pending') return '<span class="badge" style="background:rgba(245,158,11,0.2); color:#fbbf24; font-weight:700;">Pending Nameservers</span>';
          if (s === 'initializing') return '<span class="badge" style="background:color-mix(in srgb, var(--sm-accent) 15%, transparent); color:var(--sm-accent);">Initializing</span>';
          if (s === 'error') return '<span class="badge" style="background:rgba(239,68,68,0.2); color:#f87171;">Error</span>';
          return `<span class="badge" style="background:rgba(255,255,255,0.06); color:#94a3b8;">${escapeHtml(st)}</span>`;
        };

        // 1. Fetch Cloudflare Connection Status
        const fetchCfStatus = async () => {
          try {
            const resp = await fetch('/api/cloudflare/status');
            const res = await resp.json();
            if (res.success && res.is_connected) {
              cfAccount = res.account;
              cfDot.className = 'sys-pulse-dot online';
              cfText.innerHTML = `<span style="color:#34d399; font-weight:600;">Connected</span>: ${escapeHtml(cfAccount.account_name || 'Cloudflare Account')}`;
            } else {
              cfAccount = null;
              cfDot.className = 'sys-pulse-dot offline';
              cfText.innerHTML = '<span style="color:#f87171; font-weight:600;">Disconnected</span> (Click to Connect)';
            }
          } catch (_) {
            cfDot.className = 'sys-pulse-dot offline';
            cfText.textContent = 'Connection Error';
          }
        };

        // 2. Fetch Domains List
        const fetchDomains = async () => {
          try {
            const resp = await fetch('/api/domains');
            const res = await resp.json();
            if (res.success) {
              domainsList = res.domains || [];
              if (!activeZoneId) {
                renderDashboard();
              } else {
                openDomainDetails(activeZoneId);
              }
            }
          } catch (e) {
            if (window.showToast) window.showToast('Error loading domains: ' + e, 'danger');
          }
        };

        // 3. Render Dashboard View
        const renderDashboard = () => {
          activeZoneId = null;
          const total = domainsList.length;
          const activeCount = domainsList.filter(d => (d.status || '').toLowerCase() === 'active').length;
          const pendingCount = domainsList.filter(d => (d.status || '').toLowerCase() === 'pending').length;
          const connectedSrvCount = domainsList.filter(d => d.server_id).length;

          mainArea.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;">
              <!-- Summary Metric Cards -->
              <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.75rem; padding:0.85rem 1.1rem; background:rgba(0,0,0,0.15); border-bottom:1px solid var(--border-subtle); flex-shrink:0;">
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:6px; padding:0.5rem 0.75rem;">
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Total Managed Domains</div>
                  <div style="font-size:1.2rem; font-weight:700; color:#f8fafc; margin-top:2px;">${total}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:6px; padding:0.5rem 0.75rem;">
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Active Zones</div>
                  <div style="font-size:1.2rem; font-weight:700; color:#34d399; margin-top:2px;">${activeCount}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:6px; padding:0.5rem 0.75rem;">
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Pending Nameservers</div>
                  <div style="font-size:1.2rem; font-weight:700; color:#fbbf24; margin-top:2px;">${pendingCount}</div>
                </div>
                <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:6px; padding:0.5rem 0.75rem;">
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Linked To Servers</div>
                  <div style="font-size:1.2rem; font-weight:700; color:var(--sm-accent); margin-top:2px;">${connectedSrvCount}</div>
                </div>
              </div>

              <!-- Filter & Search Toolbar -->
              <div style="display:flex; justify-content:space-between; align-items:center; padding:0.55rem 1.1rem; border-bottom:1px solid var(--border-subtle); flex-shrink:0; gap:0.5rem; flex-wrap:wrap;">
                <div style="display:flex; gap:0.35rem; align-items:center;">
                  <button class="btn btn-secondary btn-xs filter-btn active" data-st="ALL" id="fAll_${domWinId}">All (${total})</button>
                  <button class="btn btn-ghost btn-xs filter-btn" data-st="ACTIVE" id="fAct_${domWinId}">Active (${activeCount})</button>
                  <button class="btn btn-ghost btn-xs filter-btn" data-st="PENDING" id="fPen_${domWinId}">Pending NS (${pendingCount})</button>
                  <button class="btn btn-ghost btn-xs filter-btn" data-st="LINKED" id="fLnk_${domWinId}">Linked to Server (${connectedSrvCount})</button>
                </div>

                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <input type="text" id="domSearchInp_${domWinId}" placeholder="Search domains, nameservers, servers..." class="form-control" style="font-size:0.75rem; padding:0.25rem 0.6rem; width:260px;" value="${escapeHtml(searchQuery)}">
                  ${searchQuery ? `<button class="btn btn-ghost btn-xs" id="domClearSearch_${domWinId}" style="padding:0.25rem 0.4rem;">&times;</button>` : ''}
                </div>
              </div>

              <!-- Domains List Table -->
              <div style="flex:1; overflow-y:auto; min-height:0;">
                <table class="table" style="font-size:0.75rem; margin:0;">
                  <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:2;">
                    <tr>
                      <th>Domain Name</th>
                      <th style="width:130px;">Zone Status</th>
                      <th>Assigned Nameservers</th>
                      <th style="width:110px;">SSL / TLS</th>
                      <th style="width:150px;">Target Server</th>
                      <th style="text-align:right; width:260px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="domTableBody_${domWinId}">
                    <!-- Injected by filter -->
                  </tbody>
                </table>
              </div>
            </div>
          `;

          // Wire Filters
          const fBtns = mainArea.querySelectorAll('.filter-btn');
          fBtns.forEach(btn => {
            btn.onclick = () => {
              fBtns.forEach(b => {
                b.classList.remove('active', 'btn-secondary');
                b.classList.add('btn-ghost');
              });
              btn.classList.add('active', 'btn-secondary');
              btn.classList.remove('btn-ghost');
              domainFilterStatus = btn.dataset.st;
              renderDomainsTable();
            };
          });

          const searchInp = mainArea.querySelector(`#domSearchInp_${domWinId}`);
          searchInp.oninput = () => {
            searchQuery = searchInp.value.trim();
            renderDomainsTable();
          };

          const clearSearchBtn = mainArea.querySelector(`#domClearSearch_${domWinId}`);
          if (clearSearchBtn) {
            clearSearchBtn.onclick = () => {
              searchQuery = '';
              renderDashboard();
            };
          }

          renderDomainsTable();
        };

        const renderDomainsTable = () => {
          const tbody = mainArea.querySelector(`#domTableBody_${domWinId}`);
          if (!tbody) return;

          const q = searchQuery.toLowerCase();
          const filtered = domainsList.filter(d => {
            const st = (d.status || '').toUpperCase();
            if (domainFilterStatus === 'ACTIVE' && st !== 'ACTIVE') return false;
            if (domainFilterStatus === 'PENDING' && st !== 'PENDING') return false;
            if (domainFilterStatus === 'LINKED' && !d.server_id) return false;

            if (q) {
              const fullStr = `${d.name} ${d.status} ${(d.nameservers || []).join(' ')} ${d.server_name || ''} ${d.server_host || ''}`.toLowerCase();
              if (!fullStr.includes(q)) return false;
            }
            return true;
          });

          if (filtered.length === 0) {
            if (domainsList.length === 0) {
              tbody.innerHTML = `
                <tr>
                  <td colspan="6" style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.75rem; opacity:0.4;"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    <div style="font-weight:600; font-size:0.88rem; color:#f8fafc; margin-bottom:0.35rem;">No domains managed in ShellMan yet</div>
                    <div style="font-size:0.75rem; margin-bottom:1rem;">Add a domain or connect your Cloudflare API token to manage DNS and link servers.</div>
                    <button class="btn btn-primary btn-sm" id="emptyAddBtn_${domWinId}" style="font-weight:600;">+ Add First Domain</button>
                  </td>
                </tr>
              `;
              const emptyBtn = tbody.querySelector(`#emptyAddBtn_${domWinId}`);
              if (emptyBtn) emptyBtn.onclick = openAddDomainModal;
            } else {
              tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No domains match your search or filter.</td></tr>`;
            }
            return;
          }

          tbody.innerHTML = filtered.map(d => {
            const nsList = d.nameservers || [];
            const nsHtml = nsList.length > 0
              ? nsList.map(ns => `
                  <span class="badge" style="background:rgba(255,255,255,0.04); font-family:monospace; font-size:0.68rem; color:#cbd5e1; margin-right:3px;">
                    ${escapeHtml(ns)}
                    <button type="button" class="btn-copy-ns" data-ns="${escapeHtml(ns)}" style="background:none; border:none; color:var(--sm-accent); cursor:pointer; padding:0 2px; font-size:0.65rem;" title="Copy nameserver">&copy;</button>
                  </span>
                `).join('')
              : '<span style="color:var(--text-muted); font-size:0.7rem;">None assigned</span>';

            const serverHtml = d.server_id
              ? `<div style="display:flex; align-items:center; gap:0.3rem;"><span class="sys-pulse-dot online" style="width:6px;height:6px;"></span><span style="font-weight:600; color:var(--sm-accent);">${escapeHtml(d.server_name || 'Server')}</span> <span style="font-size:0.68rem; color:var(--text-muted);">(${escapeHtml(d.server_host || '')})</span></div>`
              : `<span style="color:var(--text-muted); font-size:0.7rem;">Unlinked</span>`;

            return `
              <tr>
                <td>
                  <a href="javascript:void(0)" class="domain-click-name" data-zone="${d.zone_id}" style="font-weight:700; font-size:0.82rem; color:#f8fafc; text-decoration:none; display:flex; align-items:center; gap:0.35rem;">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    ${escapeHtml(d.name)}
                  </a>
                </td>
                <td>${getZoneStatusBadge(d.status)}</td>
                <td>${nsHtml}</td>
                <td><span style="font-size:0.72rem; color:#94a3b8; text-transform:capitalize;">${escapeHtml(d.ssl_mode || 'unknown')}</span></td>
                <td>${serverHtml}</td>
                <td style="text-align:right;">
                  <div style="display:flex; justify-content:flex-end; gap:0.25rem;">
                    <button class="btn btn-secondary btn-xs btn-open-dns" data-zone="${d.zone_id}" title="Manage DNS Records">DNS</button>
                    <button class="btn btn-secondary btn-xs btn-link-srv" data-zone="${d.zone_id}" title="Connect to ShellMan Server">Link Server</button>
                    <button class="btn btn-ghost btn-xs btn-check-ns" data-zone="${d.zone_id}" title="Re-check Nameservers on Cloudflare">Check NS</button>
                    <button class="btn btn-ghost btn-xs btn-del-dom" data-zone="${d.zone_id}" data-name="${escapeHtml(d.name)}" title="Remove Domain" style="color:#f87171;">&times;</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('');

          // Wire Row Actions
          tbody.querySelectorAll('.domain-click-name, .btn-open-dns').forEach(el => {
            el.onclick = () => openDomainDetails(el.dataset.zone, 'dns');
          });

          tbody.querySelectorAll('.btn-link-srv').forEach(btn => {
            btn.onclick = () => openDomainDetails(btn.dataset.zone, 'server');
          });

          tbody.querySelectorAll('.btn-copy-ns').forEach(btn => {
            btn.onclick = (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(btn.dataset.ns);
              if (window.showToast) window.showToast(`Copied ${btn.dataset.ns}`, 'info');
            };
          });

          tbody.querySelectorAll('.btn-check-ns').forEach(btn => {
            btn.onclick = async () => {
              const zoneId = btn.dataset.zone;
              btn.disabled = true;
              btn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;"></span>`;
              try {
                const resp = await fetch(`/api/domains/${zoneId}/check-activation`, { method: 'POST' });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(res.message, res.status === 'active' ? 'success' : 'info');
                  await fetchDomains();
                } else {
                  if (window.showToast) window.showToast(res.error || 'Check failed', 'danger');
                }
              } catch (e) {
                if (window.showToast) window.showToast(String(e), 'danger');
              } finally {
                btn.disabled = false;
                btn.textContent = 'Check NS';
              }
            };
          });

          tbody.querySelectorAll('.btn-del-dom').forEach(btn => {
            btn.onclick = async () => {
              const zoneId = btn.dataset.zone;
              const name = btn.dataset.name;
              const ok = await DesktopModal.confirm({
                title: 'Remove Domain',
                message: `Are you sure you want to remove domain '${name}' from ShellMan?\n\nNote: This will not delete your domain from Cloudflare unless explicitly specified.`,
                confirmText: 'Remove Domain',
                isDanger: true
              });
              if (!ok) return;

              try {
                const resp = await fetch(`/api/domains/${zoneId}`, {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ delete_cloudflare_zone: false })
                });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(res.message, 'success');
                  await fetchDomains();
                } else {
                  DesktopModal.alert({ title: 'Delete Failed', message: res.error, type: 'danger' });
                }
              } catch (e) {
                DesktopModal.alert({ title: 'Delete Error', message: String(e), type: 'danger' });
              }
            };
          });
        };

        // 4. Domain Details & DNS Management View
        const openDomainDetails = async (zoneId, initialTab = 'dns') => {
          activeZoneId = zoneId;
          activeDetailTab = initialTab;

          const domain = domainsList.find(d => d.zone_id === zoneId);
          if (!domain) {
            renderDashboard();
            return;
          }

          mainArea.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;" id="domDetailView_${domWinId}">
              <!-- Domain Title Bar -->
              <div style="display:flex; align-items:center; justify-content:space-between; padding:0.6rem 1.1rem; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.2); flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:0.65rem;">
                  <button class="btn btn-ghost btn-xs" id="btnBackToDomains_${domWinId}" style="display:flex; align-items:center; gap:0.3rem;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Domains
                  </button>
                  <span style="color:var(--text-muted); font-size:0.8rem;">/</span>
                  <span style="font-weight:700; font-size:1.05rem; color:#f8fafc; display:flex; align-items:center; gap:0.45rem;">
                    ${escapeHtml(domain.name)}
                  </span>
                  ${getZoneStatusBadge(domain.status)}
                </div>

                <div style="display:flex; align-items:center; gap:0.45rem;">
                  <button class="btn btn-secondary btn-xs" id="btnQuickPurge_${domWinId}" style="font-size:0.72rem; height:26px;">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Purge Cache
                  </button>
                  <button class="btn btn-secondary btn-xs" id="btnSyncSingle_${domWinId}" style="font-size:0.72rem; height:26px;">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    Refresh Zone
                  </button>
                </div>
              </div>

              <!-- Details Sub-Navigation Tabs -->
              <div style="display:flex; gap:0.35rem; padding:0.45rem 1.1rem; border-bottom:1px solid var(--border-subtle); background:rgba(255,255,255,0.015); flex-shrink:0; overflow-x:auto;">
                <button class="btn btn-secondary btn-xs detail-tab-btn active" data-dtab="dns" id="dtabDns_${domWinId}">DNS Records</button>
                <button class="btn btn-ghost btn-xs detail-tab-btn" data-dtab="edge" id="dtabEdge_${domWinId}">Edge &amp; Cache</button>
                <button class="btn btn-ghost btn-xs detail-tab-btn" data-dtab="ssl" id="dtabSsl_${domWinId}">SSL &amp; Origin CA</button>
                <button class="btn btn-ghost btn-xs detail-tab-btn" data-dtab="server" id="dtabSrv_${domWinId}">Server &amp; Nginx Link</button>
                <button class="btn btn-ghost btn-xs detail-tab-btn" data-dtab="nameservers" id="dtabNs_${domWinId}">Nameservers Setup</button>
                <button class="btn btn-ghost btn-xs detail-tab-btn" data-dtab="diagnostics" id="dtabDiag_${domWinId}">Live Diagnostics</button>
              </div>

              <!-- Tab Content Container -->
              <div id="domTabContent_${domWinId}" style="flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;">
                <!-- Injected dynamically -->
              </div>
            </div>
          `;

          const detailRoot = mainArea.querySelector(`#domDetailView_${domWinId}`);
          const tabContent = detailRoot.querySelector(`#domTabContent_${domWinId}`);

          detailRoot.querySelector(`#btnBackToDomains_${domWinId}`).onclick = renderDashboard;

          detailRoot.querySelector(`#btnSyncSingle_${domWinId}`).onclick = async () => {
            try {
              if (window.showToast) window.showToast(`Syncing ${domain.name} from Cloudflare...`, 'info');
              const resp = await fetch(`/api/domains/${zoneId}/sync`, { method: 'POST' });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast('Zone synchronized!', 'success');
                await fetchDomains();
                openDomainDetails(zoneId, activeDetailTab);
              }
            } catch (e) {
              if (window.showToast) window.showToast(String(e), 'danger');
            }
          };

          const qPurgeBtn = detailRoot.querySelector(`#btnQuickPurge_${domWinId}`);
          if (qPurgeBtn) {
            qPurgeBtn.onclick = () => {
              activeDetailTab = 'edge';
              dTabBtns.forEach(b => {
                const isMatch = b.dataset.dtab === 'edge';
                b.classList.toggle('active', isMatch);
                b.classList.toggle('btn-secondary', isMatch);
                b.classList.toggle('btn-ghost', !isMatch);
              });
              renderActiveTabContent(domain, tabContent);
            };
          }

          // Sub-Tab Switcher
          const dTabBtns = detailRoot.querySelectorAll('.detail-tab-btn');
          dTabBtns.forEach(btn => {
            btn.onclick = () => {
              dTabBtns.forEach(b => {
                b.classList.remove('active', 'btn-secondary');
                b.classList.add('btn-ghost');
              });
              btn.classList.add('active', 'btn-secondary');
              btn.classList.remove('btn-ghost');
              activeDetailTab = btn.dataset.dtab;
              renderActiveTabContent(domain, tabContent);
            };
          });

          // Set initial active sub-tab button
          dTabBtns.forEach(b => {
            const isMatch = b.dataset.dtab === initialTab;
            b.classList.toggle('active', isMatch);
            b.classList.toggle('btn-secondary', isMatch);
            b.classList.toggle('btn-ghost', !isMatch);
          });

          renderActiveTabContent(domain, tabContent);
        };

        const renderActiveTabContent = (domain, container) => {
          if (activeDetailTab === 'dns') {
            renderDnsTab(domain, container);
          } else if (activeDetailTab === 'edge') {
            renderEdgeCacheTab(domain, container);
          } else if (activeDetailTab === 'ssl') {
            renderSslOriginTab(domain, container);
          } else if (activeDetailTab === 'server') {
            renderServerLinkTab(domain, container);
          } else if (activeDetailTab === 'nameservers') {
            renderNameserversTab(domain, container);
          } else if (activeDetailTab === 'diagnostics') {
            renderDiagnosticsTab(domain, container);
          }
        };

        // 4A. Render DNS Tab
        const renderDnsTab = async (domain, container) => {
          container.innerHTML = `
            <div style="flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;">
              <!-- DNS Toolbar -->
              <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 1.1rem; border-bottom:1px solid var(--border-subtle); flex-shrink:0; gap:0.5rem; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <input type="text" id="dnsSearchInp_${domWinId}" placeholder="Search record name, content, type..." class="form-control" style="font-size:0.74rem; padding:0.25rem 0.55rem; width:240px;">
                  <select id="dnsTypeFilter_${domWinId}" class="form-control" style="font-size:0.72rem; padding:0.2rem 0.4rem; height:26px;">
                    <option value="ALL">All Types</option>
                    <option value="A">A</option>
                    <option value="AAAA">AAAA</option>
                    <option value="CNAME">CNAME</option>
                    <option value="MX">MX</option>
                    <option value="TXT">TXT</option>
                    <option value="NS">NS</option>
                    <option value="SRV">SRV</option>
                    <option value="CAA">CAA</option>
                  </select>
                </div>

                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <button class="btn btn-secondary btn-xs" id="btnReloadDns_${domWinId}" style="font-size:0.72rem; height:26px;">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    Refresh
                  </button>
                  <button class="btn btn-primary btn-xs" id="btnAddDnsRec_${domWinId}" style="font-weight:600; font-size:0.72rem; height:26px;">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Record
                  </button>
                </div>
              </div>

              <!-- Records Table -->
              <div style="flex:1; overflow-y:auto; min-height:0;">
                <table class="table" style="font-size:0.74rem; margin:0;">
                  <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:2;">
                    <tr>
                      <th style="width:70px;">Type</th>
                      <th>Name</th>
                      <th>Content / Target</th>
                      <th style="width:120px;">Proxy Status</th>
                      <th style="width:75px;">TTL</th>
                      <th style="width:75px;">Priority</th>
                      <th style="text-align:right; width:130px;">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="dnsRecordsTbody_${domWinId}">
                    <tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Loading DNS records from Cloudflare...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          `;

          const dnsTbody = container.querySelector(`#dnsRecordsTbody_${domWinId}`);
          const dnsSearch = container.querySelector(`#dnsSearchInp_${domWinId}`);
          const dnsTypeSel = container.querySelector(`#dnsTypeFilter_${domWinId}`);
          const reloadBtn = container.querySelector(`#btnReloadDns_${domWinId}`);
          const addRecBtn = container.querySelector(`#btnAddDnsRec_${domWinId}`);

          const loadDns = async () => {
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/dns`);
              const res = await resp.json();
              if (res.success) {
                cachedDnsRecords = res.records || [];
                renderDnsRows();
              } else {
                dnsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:#f87171;">Failed to load DNS: ${escapeHtml(res.error || 'Unknown error')}</td></tr>`;
              }
            } catch (e) {
              dnsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:#f87171;">Network error loading DNS: ${escapeHtml(String(e))}</td></tr>`;
            }
          };

          const renderDnsRows = () => {
            const q = dnsSearch.value.toLowerCase().trim();
            const filterType = dnsTypeSel.value;

            const filtered = cachedDnsRecords.filter(r => {
              if (filterType !== 'ALL' && r.type !== filterType) return false;
              if (q) {
                const s = `${r.type} ${r.name} ${r.content} ${r.comment || ''}`.toLowerCase();
                if (!s.includes(q)) return false;
              }
              return true;
            });

            if (filtered.length === 0) {
              dnsTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No DNS records match current filters.</td></tr>`;
              return;
            }

            dnsTbody.innerHTML = filtered.map(r => {
              const isEligibleProxy = ['A', 'AAAA', 'CNAME'].includes(r.type);
              const proxyBadge = isEligibleProxy
                ? (r.proxied
                    ? `<span class="badge" style="background:rgba(245,158,11,0.2); color:#fbbf24; display:inline-flex; align-items:center; gap:4px; font-weight:700;"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>Proxied</span>`
                    : `<span class="badge" style="background:rgba(255,255,255,0.06); color:#94a3b8; display:inline-flex; align-items:center; gap:4px;"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>DNS Only</span>`
                  )
                : '<span style="color:var(--text-muted); font-size:0.68rem;">-</span>';

              const ttlDisplay = r.ttl === 1 ? 'Auto' : (r.ttl >= 3600 ? `${r.ttl / 3600}h` : `${r.ttl / 60}m`);

              return `
                <tr>
                  <td><span class="badge" style="background:color-mix(in srgb, var(--sm-accent) 15%, transparent); color:var(--sm-accent); font-family:monospace; font-weight:700;">${r.type}</span></td>
                  <td><code style="font-size:0.75rem; color:#f8fafc;">${escapeHtml(r.name)}</code></td>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.35rem; max-width:320px;">
                      <code style="font-size:0.74rem; color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(r.content)}</code>
                      <button type="button" class="btn btn-ghost btn-xs btn-copy-rec-content" data-content="${escapeHtml(r.content)}" style="padding:0 3px; font-size:0.65rem;" title="Copy content">&copy;</button>
                    </div>
                  </td>
                  <td>${proxyBadge}</td>
                  <td style="color:var(--text-muted); font-family:monospace;">${ttlDisplay}</td>
                  <td style="color:var(--text-muted); font-family:monospace;">${r.priority !== undefined ? r.priority : '-'}</td>
                  <td style="text-align:right;">
                    <div style="display:flex; justify-content:flex-end; gap:0.25rem;">
                      <button class="btn btn-ghost btn-xs btn-edit-rec" data-rec='${escapeHtml(JSON.stringify(r))}' title="Edit Record">Edit</button>
                      <button class="btn btn-ghost btn-xs btn-del-rec" data-id="${r.id}" data-name="${escapeHtml(r.name)}" data-type="${r.type}" title="Delete Record" style="color:#f87171;">Delete</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('');

            dnsTbody.querySelectorAll('.btn-copy-rec-content').forEach(btn => {
              btn.onclick = () => {
                navigator.clipboard.writeText(btn.dataset.content);
                if (window.showToast) window.showToast('Copied to clipboard', 'info');
              };
            });

            dnsTbody.querySelectorAll('.btn-edit-rec').forEach(btn => {
              btn.onclick = () => {
                const recData = JSON.parse(btn.dataset.rec);
                openRecordModal(domain.zone_id, recData, loadDns);
              };
            });

            dnsTbody.querySelectorAll('.btn-del-rec').forEach(btn => {
              btn.onclick = async () => {
                const recId = btn.dataset.id;
                const recName = btn.dataset.name;
                const recType = btn.dataset.type;

                const ok = await DesktopModal.confirm({
                  title: 'Delete DNS Record',
                  message: `Are you sure you want to permanently delete the ${recType} record for '${recName}' from Cloudflare?\n\nThis cannot be undone.`,
                  confirmText: 'Delete Record',
                  isDanger: true
                });
                if (!ok) return;

                try {
                  const resp = await fetch(`/api/domains/${domain.zone_id}/dns/${recId}`, { method: 'DELETE' });
                  const res = await resp.json();
                  if (res.success) {
                    if (window.showToast) window.showToast('DNS record deleted!', 'success');
                    loadDns();
                  } else {
                    DesktopModal.alert({ title: 'Delete Failed', message: res.error, type: 'danger' });
                  }
                } catch (e) {
                  DesktopModal.alert({ title: 'Delete Error', message: String(e), type: 'danger' });
                }
              };
            });
          };

          dnsSearch.oninput = renderDnsRows;
          dnsTypeSel.onchange = renderDnsRows;
          reloadBtn.onclick = loadDns;
          addRecBtn.onclick = () => openRecordModal(domain.zone_id, null, loadDns);

          await loadDns();
        };

        // 4B. Render Server & Nginx Connection Tab
        const renderServerLinkTab = async (domain, container) => {
          container.innerHTML = `
            <div style="flex:1; overflow-y:auto; padding:1.25rem; max-width:760px;">
              <h4 style="margin:0 0 0.35rem 0; font-size:0.95rem; font-weight:700; color:#f8fafc;">Connect Domain to a ShellMan Server</h4>
              <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:1.15rem; line-height:1.45;">
                Link this domain to an existing remote node managed by ShellMan. This creates or updates the authoritative A-record in Cloudflare to point to the server's public IP address, and allows you to configure Nginx reverse proxy routes with automated SSL.
              </p>

              <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.2rem; display:flex; flex-direction:column; gap:1rem; margin-bottom:1.5rem;">
                <div>
                  <label style="display:block; font-size:0.78rem; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Target Server Node *</label>
                  <select id="lnkServerSel_${domWinId}" class="form-control" style="width:100%; font-size:0.8rem; padding:0.45rem 0.65rem;">
                    <option value="">-- Choose a server --</option>
                    ${(window.DesktopServersList || []).map(s => `
                      <option value="${s.id}" data-host="${s.host}" ${domain.server_id === s.id ? 'selected' : ''}>
                        ${escapeHtml(s.name)} (${s.host})
                      </option>
                    `).join('')}
                  </select>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.85rem;">
                  <div>
                    <label style="display:block; font-size:0.78rem; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Subdomain / Host</label>
                    <div style="display:flex; align-items:center;">
                      <input type="text" id="lnkSubdomainInp_${domWinId}" class="form-control" placeholder="@" value="@" style="font-size:0.8rem; padding:0.45rem 0.65rem; border-top-right-radius:0; border-bottom-right-radius:0;">
                      <span style="background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); border-left:none; padding:0.45rem 0.65rem; font-size:0.75rem; color:var(--text-muted); border-top-right-radius:4px; border-bottom-right-radius:4px;">.${escapeHtml(domain.name)}</span>
                    </div>
                    <span style="font-size:0.68rem; color:var(--text-muted); margin-top:2px; display:block;">Use "@" for root domain, or specify subdomain (e.g. "api", "app").</span>
                  </div>

                  <div>
                    <label style="display:block; font-size:0.78rem; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Destination Server IP *</label>
                    <input type="text" id="lnkDestIpInp_${domWinId}" class="form-control" placeholder="e.g. 20.219.23.4" value="${escapeHtml(domain.server_host || '')}" style="font-size:0.8rem; padding:0.45rem 0.65rem; font-family:monospace;">
                    <div id="lnkIpNotice_${domWinId}" style="margin-top:2px; font-size:0.68rem;"></div>
                  </div>
                </div>

                <div>
                  <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-size:0.78rem; color:#f8fafc; font-weight:600;">
                    <input type="checkbox" id="lnkProxiedCb_${domWinId}" checked>
                    Enable Cloudflare Proxy (CDN, DDoS Protection &amp; Edge SSL)
                  </label>
                  <span style="font-size:0.68rem; color:var(--text-muted); margin-left:1.55rem; display:block;">Hides origin server IP and accelerates traffic via Cloudflare Anycast edge.</span>
                </div>

                <div id="lnkConflictBox_${domWinId}" style="display:none; padding:0.65rem 0.85rem; border-radius:6px; background:rgba(245,158,11,0.15); border:1px solid rgba(245,158,11,0.3); font-size:0.75rem; color:#fbbf24;"></div>

                <div style="display:flex; justify-content:flex-end; gap:0.5rem; padding-top:0.5rem; border-top:1px solid var(--border-subtle);">
                  <button type="button" class="btn btn-primary btn-sm" id="btnApplyLink_${domWinId}" style="font-weight:600;">
                    Apply &amp; Create DNS A-Record
                  </button>
                </div>
              </div>

              <!-- Nginx Virtual Host Shortcut Card -->
              <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.2rem;">
                <h5 style="margin:0 0 0.35rem 0; font-size:0.88rem; font-weight:700; color:#cbd5e1; display:flex; align-items:center; gap:0.45rem;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                  Nginx &amp; SSL Integration
                </h5>
                <p style="font-size:0.74rem; color:var(--text-secondary); margin-bottom:0.85rem; line-height:1.45;">
                  Once your DNS record is configured, deploy an Nginx virtual host and issue a Let's Encrypt SSL certificate on the connected node.
                </p>
                <div style="display:flex; gap:0.5rem;">
                  <button type="button" class="btn btn-secondary btn-sm" id="btnOpenNginxMgr_${domWinId}">
                    Open Nginx Manager for ${escapeHtml(domain.name)}
                  </button>
                </div>
              </div>
            </div>
          `;

          const srvSel = container.querySelector(`#lnkServerSel_${domWinId}`);
          const destIpInp = container.querySelector(`#lnkDestIpInp_${domWinId}`);
          const subInp = container.querySelector(`#lnkSubdomainInp_${domWinId}`);
          const proxiedCb = container.querySelector(`#lnkProxiedCb_${domWinId}`);
          const applyBtn = container.querySelector(`#btnApplyLink_${domWinId}`);
          const conflictBox = container.querySelector(`#lnkConflictBox_${domWinId}`);
          const ipNotice = container.querySelector(`#lnkIpNotice_${domWinId}`);
          const nginxBtn = container.querySelector(`#btnOpenNginxMgr_${domWinId}`);

          nginxBtn.onclick = () => {
            DesktopApps.launch('nginx');
          };

          srvSel.onchange = () => {
            const opt = srvSel.selectedOptions[0];
            if (opt && opt.dataset.host) {
              destIpInp.value = opt.dataset.host;
              checkIpType(destIpInp.value);
            }
          };

          const checkIpType = (ip) => {
            const isPriv = ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.') || ip.startsWith('127.');
            if (isPriv) {
              ipNotice.innerHTML = `<span style="color:#fbbf24;">Private network IP detected. Public web clients cannot reach this IP over the internet.</span>`;
            } else {
              ipNotice.innerHTML = `<span style="color:#34d399;">Public routable IP address.</span>`;
            }
          };

          if (destIpInp.value) checkIpType(destIpInp.value);
          destIpInp.oninput = () => checkIpType(destIpInp.value.trim());

          applyBtn.onclick = async () => {
            const serverId = srvSel.value;
            const subdomain = subInp.value.trim() || '@';
            const destIp = destIpInp.value.trim();
            const proxied = proxiedCb.checked;

            if (!serverId) {
              if (window.showToast) window.showToast('Please select a target server.', 'warning');
              return;
            }
            if (!destIp) {
              if (window.showToast) window.showToast('Destination IP is required.', 'warning');
              return;
            }

            applyBtn.disabled = true;
            applyBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Connecting...`;
            conflictBox.style.display = 'none';

            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/connect-server`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  server_id: serverId,
                  subdomain: subdomain,
                  destination_ip: destIp,
                  proxied: proxied,
                  allow_private_ip: true,
                  overwrite_conflict: false
                })
              });
              const res = await resp.json();

              if (res.conflict) {
                conflictBox.style.display = 'block';
                conflictBox.innerHTML = `
                  <div style="font-weight:700; margin-bottom:4px;">Conflicting Record Detected:</div>
                  <div>${escapeHtml(res.message)}</div>
                  <button type="button" class="btn btn-warning btn-xs" id="btnForceOverwrite_${domWinId}" style="margin-top:6px; font-weight:700;">Overwrite Existing Record</button>
                `;

                const forceBtn = conflictBox.querySelector(`#btnForceOverwrite_${domWinId}`);
                forceBtn.onclick = async () => {
                  forceBtn.disabled = true;
                  const fResp = await fetch(`/api/domains/${domain.zone_id}/connect-server`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      server_id: serverId,
                      subdomain: subdomain,
                      destination_ip: destIp,
                      proxied: proxied,
                      allow_private_ip: true,
                      overwrite_conflict: true
                    })
                  });
                  const fRes = await fResp.json();
                  if (fRes.success) {
                    if (window.showToast) window.showToast('DNS A-Record updated successfully!', 'success');
                    await fetchDomains();
                    openDomainDetails(domain.zone_id, 'server');
                  } else {
                    DesktopModal.alert({ title: 'Connection Failed', message: fRes.error, type: 'danger' });
                  }
                };
                return;
              }

              if (res.success) {
                if (window.showToast) window.showToast(res.message, 'success');
                await fetchDomains();
                openDomainDetails(domain.zone_id, 'server');
              } else {
                DesktopModal.alert({ title: 'Connection Failed', message: res.error, type: 'danger' });
              }
            } catch (e) {
              DesktopModal.alert({ title: 'Connection Error', message: String(e), type: 'danger' });
            } finally {
              applyBtn.disabled = false;
              applyBtn.textContent = 'Apply & Create DNS A-Record';
            }
          };
        };

        // 4C. Render Nameservers Setup Tab
        const renderNameserversTab = (domain, container) => {
          const nsList = domain.nameservers || [];
          container.innerHTML = `
            <div style="flex:1; overflow-y:auto; padding:1.25rem; max-width:760px;">
              <h4 style="margin:0 0 0.35rem 0; font-size:0.95rem; font-weight:700; color:#f8fafc;">Authoritative Nameservers Activation</h4>
              <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:1.15rem; line-height:1.45;">
                To activate DNS routing, CDN caching, and DDoS mitigation for <strong>${escapeHtml(domain.name)}</strong>, update your registrar's nameservers with the Cloudflare authoritative servers below.
              </p>

              <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.2rem; margin-bottom:1.25rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                  <span style="font-size:0.78rem; font-weight:700; color:#cbd5e1; text-transform:uppercase;">Assigned Cloudflare Nameservers</span>
                  <button type="button" class="btn btn-secondary btn-xs" id="btnCopyAllNs_${domWinId}">Copy Both Nameservers</button>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem;">
                  ${nsList.map((ns, idx) => `
                    <div style="display:flex; align-items:center; justify-content:space-between; background:#0b111c; border:1px solid var(--border-subtle); border-radius:6px; padding:0.5rem 0.75rem;">
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size:0.72rem; color:var(--text-muted); font-weight:700;">NS ${idx + 1}:</span>
                        <code style="font-size:0.8rem; color:var(--sm-accent); font-weight:700;">${escapeHtml(ns)}</code>
                      </div>
                      <button type="button" class="btn btn-ghost btn-xs btn-copy-single-ns" data-ns="${escapeHtml(ns)}" style="font-size:0.7rem;">Copy</button>
                    </div>
                  `).join('')}
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding-top:0.75rem; border-top:1px solid var(--border-subtle);">
                  <div style="font-size:0.72rem; color:var(--text-muted);">
                    Current status: ${getZoneStatusBadge(domain.status)}
                  </div>
                  <button type="button" class="btn btn-primary btn-sm" id="btnCheckNsNow_${domWinId}" style="font-weight:600;">
                    Check Nameservers Now
                  </button>
                </div>
              </div>

              <!-- Registrar Instructions Card -->
              <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.2rem;">
                <h5 style="margin:0 0 0.5rem 0; font-size:0.85rem; font-weight:700; color:#cbd5e1;">How to update nameservers:</h5>
                <ol style="margin:0; padding-left:1.25rem; font-size:0.74rem; color:var(--text-secondary); line-height:1.6;">
                  <li>Log in to your domain registrar account where you purchased <strong>${escapeHtml(domain.name)}</strong> (e.g. Namecheap, GoDaddy, Google Domains / Squarespace, Cloudflare Registrar).</li>
                  <li>Go to your Domain List, select <strong>${escapeHtml(domain.name)}</strong>, and locate the <strong>DNS</strong> or <strong>Nameservers</strong> section.</li>
                  <li>Change nameserver type from <em>Default Nameservers</em> to <em>Custom Nameservers</em>.</li>
                  <li>Enter the two Cloudflare nameservers listed above and save changes.</li>
                  <li>Click <strong>Check Nameservers Now</strong>. Global DNS propagation typically completes within 5 to 60 minutes.</li>
                </ol>
              </div>
            </div>
          `;

          container.querySelectorAll('.btn-copy-single-ns').forEach(btn => {
            btn.onclick = () => {
              navigator.clipboard.writeText(btn.dataset.ns);
              if (window.showToast) window.showToast(`Copied ${btn.dataset.ns}`, 'info');
            };
          });

          const copyAllBtn = container.querySelector(`#btnCopyAllNs_${domWinId}`);
          if (copyAllBtn) {
            copyAllBtn.onclick = () => {
              navigator.clipboard.writeText(nsList.join('\n'));
              if (window.showToast) window.showToast('Copied all nameservers to clipboard', 'info');
            };
          }

          const checkBtn = container.querySelector(`#btnCheckNsNow_${domWinId}`);
          if (checkBtn) {
            checkBtn.onclick = async () => {
              checkBtn.disabled = true;
              checkBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Checking...`;
              try {
                const resp = await fetch(`/api/domains/${domain.zone_id}/check-activation`, { method: 'POST' });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(res.message, res.status === 'active' ? 'success' : 'info');
                  await fetchDomains();
                  openDomainDetails(domain.zone_id, 'nameservers');
                } else {
                  DesktopModal.alert({ title: 'Check Failed', message: res.error, type: 'danger' });
                }
              } catch (e) {
                DesktopModal.alert({ title: 'Network Error', message: String(e), type: 'danger' });
              } finally {
                checkBtn.disabled = false;
                checkBtn.textContent = 'Check Nameservers Now';
              }
            };
          }
        };

        // 4D. Render Diagnostics Tab
        const renderDiagnosticsTab = (domain, container) => {
          container.innerHTML = `
            <div style="flex:1; overflow-y:auto; padding:1.25rem; max-width:760px;">
              <h4 style="margin:0 0 0.35rem 0; font-size:0.95rem; font-weight:700; color:#f8fafc;">Live DNS &amp; Reachability Diagnostics</h4>
              <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:1.15rem; line-height:1.45;">
                Verifies public DNS resolution, HTTP response status, and SSL certificate availability for <strong>${escapeHtml(domain.name)}</strong>.
              </p>

              <div style="display:flex; gap:0.5rem; margin-bottom:1rem;">
                <input type="text" id="diagHostInp_${domWinId}" class="form-control" value="${escapeHtml(domain.name)}" placeholder="${escapeHtml(domain.name)}" style="font-size:0.8rem; padding:0.4rem 0.65rem; max-width:320px;">
                <button type="button" class="btn btn-primary btn-sm" id="btnRunDiag_${domWinId}" style="font-weight:600;">Run Diagnostic Probe</button>
              </div>

              <div id="diagResultsBox_${domWinId}" style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.2rem; font-size:0.78rem;">
                <div style="color:var(--text-muted); text-align:center; padding:1.5rem;">Click "Run Diagnostic Probe" to test resolution and connectivity.</div>
              </div>
            </div>
          `;

          const runBtn = container.querySelector(`#btnRunDiag_${domWinId}`);
          const hostInp = container.querySelector(`#diagHostInp_${domWinId}`);
          const resBox = container.querySelector(`#diagResultsBox_${domWinId}`);

          runBtn.onclick = async () => {
            const hostname = hostInp.value.trim() || domain.name;
            runBtn.disabled = true;
            runBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Testing...`;
            resBox.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted);"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Probing DNS and HTTP/HTTPS reachability...</div>`;

            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/verify-live`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostname })
              });
              const res = await resp.json();

              if (res.success) {
                const d = res.data;
                resBox.innerHTML = `
                  <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:0.5rem; border-bottom:1px solid var(--border-subtle);">
                      <span style="font-weight:700; color:#f8fafc;">Target Hostname</span>
                      <code style="color:var(--sm-accent);">${escapeHtml(d.hostname)}</code>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:0.5rem; border-bottom:1px solid var(--border-subtle);">
                      <span style="font-weight:700; color:#f8fafc;">Resolved Public IPs</span>
                      <code>${d.resolved_ips.length > 0 ? d.resolved_ips.join(', ') : 'None resolved'}</code>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:0.5rem; border-bottom:1px solid var(--border-subtle);">
                      <span style="font-weight:700; color:#f8fafc;">Target Server Host</span>
                      <code>${d.server_ip || 'Unlinked'}</code>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:0.5rem; border-bottom:1px solid var(--border-subtle);">
                      <span style="font-weight:700; color:#f8fafc;">HTTP Status</span>
                      <span class="badge" style="background:${d.http_status ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}; color:${d.http_status ? '#34d399' : '#f87171'};">
                        ${d.http_status ? `HTTP ${d.http_status}` : 'Unreachable'}
                      </span>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:0.5rem; border-bottom:1px solid var(--border-subtle);">
                      <span style="font-weight:700; color:#f8fafc;">HTTPS &amp; SSL Certificate</span>
                      <span class="badge" style="background:${d.ssl_detected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}; color:${d.ssl_detected ? '#34d399' : '#f87171'};">
                        ${d.ssl_detected ? `HTTPS Valid (${d.https_status})` : 'No SSL Detected'}
                      </span>
                    </div>

                    ${d.diagnostics.length > 0 ? `
                      <div style="margin-top:0.5rem; padding:0.65rem 0.85rem; background:#0b111c; border:1px solid var(--border-subtle); border-radius:6px; font-family:monospace; font-size:0.72rem; color:#94a3b8; line-height:1.5;">
                        ${d.diagnostics.map(msg => `<div>&bull; ${escapeHtml(msg)}</div>`).join('')}
                      </div>
                    ` : ''}
                  </div>
                `;
              } else {
                resBox.innerHTML = `<div style="color:#f87171;">Diagnostic failed: ${escapeHtml(res.error || 'Unknown error')}</div>`;
              }
            } catch (e) {
              resBox.innerHTML = `<div style="color:#f87171;">Probe network error: ${escapeHtml(String(e))}</div>`;
            } finally {
              runBtn.disabled = false;
              runBtn.textContent = 'Run Diagnostic Probe';
            }
          };
        };

        const formatBytes = (bytes) => {
          if (!bytes || bytes === 0) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        // 4E. Render Edge & Cache Tab
        const renderEdgeCacheTab = async (domain, container) => {
          container.innerHTML = `
            <div style="flex:1; overflow-y:auto; padding:1.2rem; display:flex; flex-direction:column; gap:1.1rem;">
              <!-- 24-Hour Traffic Ticker -->
              <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:8px; padding:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                  <span style="font-weight:700; font-size:0.85rem; color:#f8fafc; display:flex; align-items:center; gap:0.45rem;">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#38bdf8" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    24-Hour Edge Traffic &amp; Cache Telemetry
                  </span>
                  <span id="edgeAnalyticsLoading_${domWinId}" style="font-size:0.7rem; color:var(--text-muted);">Fetching metrics...</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.75rem;" id="edgeStatsGrid_${domWinId}">
                  <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border-subtle); border-radius:6px; padding:0.6rem 0.8rem;">
                    <div style="font-size:0.66rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Total Requests (24h)</div>
                    <div style="font-size:1.25rem; font-weight:700; color:#f8fafc; margin-top:2px;" id="statReqTotal_${domWinId}">--</div>
                    <div style="font-size:0.68rem; color:var(--sm-accent); margin-top:3px;" id="statReqCached_${domWinId}">-- cached</div>
                  </div>
                  <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border-subtle); border-radius:6px; padding:0.6rem 0.8rem;">
                    <div style="font-size:0.66rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Bandwidth Served</div>
                    <div style="font-size:1.25rem; font-weight:700; color:#34d399; margin-top:2px;" id="statBwTotal_${domWinId}">--</div>
                    <div style="font-size:0.68rem; color:#34d399; margin-top:3px;" id="statBwSaved_${domWinId}">-- saved by cache</div>
                  </div>
                  <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border-subtle); border-radius:6px; padding:0.6rem 0.8rem;">
                    <div style="font-size:0.66rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Threats Blocked</div>
                    <div style="font-size:1.25rem; font-weight:700; color:#fbbf24; margin-top:2px;" id="statThreats_${domWinId}">--</div>
                    <div style="font-size:0.68rem; color:var(--text-muted); margin-top:3px;">WAF / DDoS mitigation</div>
                  </div>
                  <div style="background:rgba(0,0,0,0.25); border:1px solid var(--border-subtle); border-radius:6px; padding:0.6rem 0.8rem;">
                    <div style="font-size:0.66rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Unique Visitors</div>
                    <div style="font-size:1.25rem; font-weight:700; color:#a78bfa; margin-top:2px;" id="statUniques_${domWinId}">--</div>
                    <div style="font-size:0.68rem; color:var(--text-muted); margin-top:3px;">Edge distinct IPs</div>
                  </div>
                </div>
              </div>

              <!-- Quick Action Edge Cards Grid -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <!-- 1-Click "Under Attack Mode" & Security Level -->
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:8px; padding:1rem; display:flex; flex-direction:column; justify-content:space-between;">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                      <span style="font-weight:700; font-size:0.85rem; color:#f8fafc; display:flex; align-items:center; gap:0.45rem;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ef4444" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        DDoS &amp; Security Level
                      </span>
                      <span id="badgeSecLevel_${domWinId}" class="badge" style="background:rgba(255,255,255,0.06); color:#94a3b8;">Checking...</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.75rem; margin:0 0 0.85rem; line-height:1.45;">
                      If your server is experiencing high traffic or SYN flood spikes in the Netstat monitor, enable <strong>Under Attack Mode</strong> to challenge all visitors at Cloudflare's edge.
                    </p>
                  </div>
                  <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-warning btn-xs" id="btnToggleUnderAttack_${domWinId}" style="font-weight:600; font-size:0.74rem;">
                      Toggle Under Attack Mode
                    </button>
                    <select id="selSecLevel_${domWinId}" class="form-control" style="font-size:0.72rem; padding:0.2rem 0.4rem; height:26px; width:130px;">
                      <option value="essentially_off">Essentially Off</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium (Standard)</option>
                      <option value="high">High</option>
                      <option value="under_attack">Under Attack</option>
                    </select>
                  </div>
                </div>

                <!-- Development Mode Toggle -->
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:8px; padding:1rem; display:flex; flex-direction:column; justify-content:space-between;">
                  <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                      <span style="font-weight:700; font-size:0.85rem; color:#f8fafc; display:flex; align-items:center; gap:0.45rem;">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                        Development Mode (3 Hours)
                      </span>
                      <span id="badgeDevMode_${domWinId}" class="badge" style="background:rgba(255,255,255,0.06); color:#94a3b8;">Checking...</span>
                    </div>
                    <p style="color:var(--text-secondary); font-size:0.75rem; margin:0 0 0.85rem; line-height:1.45;">
                      Temporarily bypasses edge caching for 3 hours so file changes or Git deployments show up immediately without busting cache.
                    </p>
                  </div>
                  <div>
                    <button class="btn btn-secondary btn-xs" id="btnToggleDevMode_${domWinId}" style="font-weight:600; font-size:0.74rem;">
                      Toggle Development Mode
                    </button>
                  </div>
                </div>
              </div>

              <!-- Cache Purge Section -->
              <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:8px; padding:1rem;">
                <span style="font-weight:700; font-size:0.85rem; color:#f8fafc; display:flex; align-items:center; gap:0.45rem; margin-bottom:0.5rem;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Edge Cache Purge
                </span>
                <p style="color:var(--text-secondary); font-size:0.75rem; margin:0 0 0.85rem; line-height:1.45;">
                  Wipe cached static assets across Cloudflare's edge network.
                </p>

                <div style="display:flex; gap:0.75rem; align-items:flex-start; flex-wrap:wrap;">
                  <button class="btn btn-danger btn-xs" id="btnPurgeEverything_${domWinId}" style="font-weight:600; font-size:0.74rem; padding:0.35rem 0.75rem;">
                    Purge Everything
                  </button>

                  <div style="flex:1; min-width:280px; display:flex; flex-direction:column; gap:0.4rem;">
                    <textarea id="inpPurgeUrls_${domWinId}" class="form-control" rows="2" placeholder="Purge specific URLs (one per line, e.g. https://${escapeHtml(domain.name)}/style.css)" style="font-size:0.74rem; font-family:monospace;"></textarea>
                    <button class="btn btn-secondary btn-xs" id="btnPurgeUrls_${domWinId}" style="align-self:flex-start; font-size:0.72rem;">
                      Purge Specific URLs
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;

          // Wire Analytics
          const loadAnalytics = async () => {
            const lbl = container.querySelector(`#edgeAnalyticsLoading_${domWinId}`);
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/analytics`);
              const res = await resp.json();
              if (res.success && res.analytics) {
                const a = res.analytics;
                container.querySelector(`#statReqTotal_${domWinId}`).textContent = (a.total_requests || 0).toLocaleString();
                container.querySelector(`#statReqCached_${domWinId}`).textContent = `${(a.cached_requests || 0).toLocaleString()} cached (${a.cache_ratio_pct}%)`;
                container.querySelector(`#statBwTotal_${domWinId}`).textContent = formatBytes(a.total_bandwidth_bytes);
                container.querySelector(`#statBwSaved_${domWinId}`).textContent = `${formatBytes(a.cached_bandwidth_bytes)} cached`;
                container.querySelector(`#statThreats_${domWinId}`).textContent = (a.threats_blocked || 0).toLocaleString();
                container.querySelector(`#statUniques_${domWinId}`).textContent = (a.unique_visitors || 0).toLocaleString();
                if (lbl) lbl.textContent = 'Telemetry updated';
              }
            } catch (_) {
              if (lbl) lbl.textContent = 'Analytics offline';
            }
          };

          // Wire Security Level
          let curSecLevel = 'medium';
          const badgeSec = container.querySelector(`#badgeSecLevel_${domWinId}`);
          const selSec = container.querySelector(`#selSecLevel_${domWinId}`);
          const btnUnderAttack = container.querySelector(`#btnToggleUnderAttack_${domWinId}`);

          const loadSecurity = async () => {
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/security-level`);
              const res = await resp.json();
              if (res.success && res.data) {
                curSecLevel = res.data.level || 'medium';
                badgeSec.textContent = curSecLevel.toUpperCase();
                badgeSec.style.background = curSecLevel === 'under_attack' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)';
                badgeSec.style.color = curSecLevel === 'under_attack' ? '#f87171' : '#cbd5e1';
                selSec.value = curSecLevel;
                btnUnderAttack.textContent = curSecLevel === 'under_attack' ? 'Disable Under Attack Mode' : 'Enable Under Attack Mode';
                btnUnderAttack.className = curSecLevel === 'under_attack' ? 'btn btn-secondary btn-xs' : 'btn btn-danger btn-xs';
              }
            } catch (_) {}
          };

          btnUnderAttack.onclick = async () => {
            const nextLvl = curSecLevel === 'under_attack' ? 'medium' : 'under_attack';
            btnUnderAttack.disabled = true;
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/security-level`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: nextLvl })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(res.message, 'success');
                await loadSecurity();
              } else {
                DesktopModal.alert({ title: 'Security Level Error', message: res.error, type: 'danger' });
              }
            } finally {
              btnUnderAttack.disabled = false;
            }
          };

          selSec.onchange = async () => {
            const newLvl = selSec.value;
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/security-level`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: newLvl })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(`Security level set to ${newLvl}`, 'success');
                await loadSecurity();
              }
            } catch (e) {
              DesktopModal.alert({ title: 'Error', message: String(e), type: 'danger' });
            }
          };

          // Wire Dev Mode
          const badgeDev = container.querySelector(`#badgeDevMode_${domWinId}`);
          const btnDev = container.querySelector(`#btnToggleDevMode_${domWinId}`);
          let isDevActive = false;

          const loadDevMode = async () => {
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/development-mode`);
              const res = await resp.json();
              if (res.success && res.data) {
                isDevActive = res.data.enabled;
                const remMins = Math.round((res.data.time_remaining || 0) / 60);
                badgeDev.textContent = isDevActive ? `ACTIVE (${remMins}m remaining)` : 'OFF';
                badgeDev.style.background = isDevActive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)';
                badgeDev.style.color = isDevActive ? '#34d399' : '#94a3b8';
                btnDev.textContent = isDevActive ? 'Disable Development Mode' : 'Enable Development Mode (3h)';
                btnDev.className = isDevActive ? 'btn btn-secondary btn-xs' : 'btn btn-primary btn-xs';
              }
            } catch (_) {}
          };

          btnDev.onclick = async () => {
            btnDev.disabled = true;
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/development-mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !isDevActive })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(res.message, 'success');
                await loadDevMode();
              } else {
                DesktopModal.alert({ title: 'Dev Mode Error', message: res.error, type: 'danger' });
              }
            } finally {
              btnDev.disabled = false;
            }
          };

          // Wire Cache Purge
          const purgeAllBtn = container.querySelector(`#btnPurgeEverything_${domWinId}`);
          purgeAllBtn.onclick = async () => {
            const ok = await DesktopModal.confirm({
              title: 'Purge Entire Edge Cache?',
              message: `This will immediately invalidate all cached assets across Cloudflare's global edge network for ${domain.name}. Origin server load may temporarily increase.`,
              confirmText: 'Purge Everything',
              confirmType: 'danger'
            });
            if (!ok) return;

            purgeAllBtn.disabled = true;
            purgeAllBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Purging...`;
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/purge-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ purge_everything: true })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(res.message, 'success');
              } else {
                DesktopModal.alert({ title: 'Purge Error', message: res.error, type: 'danger' });
              }
            } finally {
              purgeAllBtn.disabled = false;
              purgeAllBtn.textContent = 'Purge Everything';
            }
          };

          const purgeUrlsBtn = container.querySelector(`#btnPurgeUrls_${domWinId}`);
          const purgeUrlsInp = container.querySelector(`#inpPurgeUrls_${domWinId}`);
          purgeUrlsBtn.onclick = async () => {
            const raw = purgeUrlsInp.value.trim();
            const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
            if (lines.length === 0) {
              DesktopModal.alert({ title: 'Missing URLs', message: 'Please enter at least one URL to purge.', type: 'warning' });
              return;
            }

            purgeUrlsBtn.disabled = true;
            purgeUrlsBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Purging...`;
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/purge-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ purge_everything: false, files: lines })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(res.message, 'success');
                purgeUrlsInp.value = '';
              } else {
                DesktopModal.alert({ title: 'Purge Error', message: res.error, type: 'danger' });
              }
            } finally {
              purgeUrlsBtn.disabled = false;
              purgeUrlsBtn.textContent = 'Purge Specific URLs';
            }
          };

          loadAnalytics();
          loadSecurity();
          loadDevMode();
        };

        // 4F. Render SSL & Origin CA Tab
        const renderSslOriginTab = async (domain, container) => {
          container.innerHTML = `
            <div style="flex:1; overflow-y:auto; padding:1.2rem; display:flex; flex-direction:column; gap:1.1rem;">
              <!-- Cloudflare SSL Encryption Mode -->
              <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:8px; padding:1rem;">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.45rem;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Cloudflare SSL/TLS Encryption Mode
                </div>
                <p style="color:var(--text-secondary); font-size:0.75rem; margin:0 0 0.85rem; line-height:1.45;">
                  Controls how Cloudflare encrypts traffic between the edge and your origin server. <strong>Full (Strict)</strong> verifies your server's certificate.
                </p>

                <div style="display:flex; align-items:center; gap:0.6rem;">
                  <select id="selSslMode_${domWinId}" class="form-control" style="font-size:0.75rem; padding:0.3rem 0.6rem; width:240px;">
                    <option value="strict" ${(domain.ssl_mode || '').toLowerCase() === 'strict' ? 'selected' : ''}>Full (Strict) - Recommended</option>
                    <option value="full" ${(domain.ssl_mode || '').toLowerCase() === 'full' ? 'selected' : ''}>Full (Permissive)</option>
                    <option value="flexible" ${(domain.ssl_mode || '').toLowerCase() === 'flexible' ? 'selected' : ''}>Flexible (Insecure origin)</option>
                    <option value="off" ${(domain.ssl_mode || '').toLowerCase() === 'off' ? 'selected' : ''}>Off</option>
                  </select>
                  <button class="btn btn-secondary btn-xs" id="btnSaveSslMode_${domWinId}" style="font-size:0.74rem;">Save Mode</button>
                </div>
              </div>

              <!-- Cloudflare Origin CA Certificate Generator (15-Year Free SSL) -->
              <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:8px; padding:1rem;">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.4rem; display:flex; align-items:center; gap:0.45rem;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                  Cloudflare Origin CA Certificate (15-Year Validity)
                </div>
                <p style="color:var(--text-secondary); font-size:0.75rem; margin:0 0 0.85rem; line-height:1.45;">
                  Generate a free TLS certificate signed by Cloudflare's Origin CA valid for up to 15 years. You can install it directly to <code>/etc/nginx/ssl/</code> on your server with 1 click, completely avoiding 90-day Let's Encrypt renewal errors behind proxied domains.
                </p>

                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                  <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                    <div style="flex:1; min-width:260px;">
                      <label style="display:block; font-size:0.7rem; color:var(--text-muted); margin-bottom:2px;">Hostnames (comma separated)</label>
                      <input type="text" id="inpOriginHostnames_${domWinId}" class="form-control" value="${escapeHtml(domain.name)}, *.${escapeHtml(domain.name)}" style="font-size:0.75rem; padding:0.3rem 0.6rem; width:100%;">
                    </div>
                    <button class="btn btn-primary btn-xs" id="btnGenOriginCert_${domWinId}" style="align-self:flex-end; font-weight:600; font-size:0.74rem; height:28px;">
                      Generate 15-Year Certificate
                    </button>
                  </div>

                  <!-- Generated Certificate Display Area -->
                  <div id="originCertOutput_${domWinId}" style="display:none; flex-direction:column; gap:0.75rem; margin-top:0.5rem; border-top:1px solid var(--border-subtle); padding-top:0.75rem;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                      <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                          <span style="font-size:0.72rem; font-weight:700; color:#f8fafc;">Certificate (.crt)</span>
                          <button class="btn btn-ghost btn-xs" id="btnCopyCert_${domWinId}" style="padding:1px 5px; font-size:0.68rem;">Copy</button>
                        </div>
                        <textarea id="txtCert_${domWinId}" class="form-control" rows="6" readonly style="font-family:monospace; font-size:0.68rem;"></textarea>
                      </div>

                      <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                          <span style="font-size:0.72rem; font-weight:700; color:#f8fafc;">Private Key (.key)</span>
                          <button class="btn btn-ghost btn-xs" id="btnCopyKey_${domWinId}" style="padding:1px 5px; font-size:0.68rem;">Copy</button>
                        </div>
                        <textarea id="txtKey_${domWinId}" class="form-control" rows="6" readonly style="font-family:monospace; font-size:0.68rem;"></textarea>
                      </div>
                    </div>

                    <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:6px; padding:0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
                      <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:260px;">
                        <span style="font-size:0.73rem; font-weight:700; color:#34d399;">Target Server:</span>
                        <select id="selInstallServer_${domWinId}" class="form-control" style="font-size:0.74rem; padding:0.25rem 0.5rem; flex:1;">
                          ${(window.DesktopServersList || []).map(s => `
                            <option value="${s.id}" ${domain.server_id == s.id ? 'selected' : ''}>${escapeHtml(s.name)} (${s.host})</option>
                          `).join('')}
                        </select>
                      </div>
                      <button class="btn btn-primary btn-xs" id="btnInstallCert_${domWinId}" style="font-weight:600; font-size:0.74rem;">
                        Install to /etc/nginx/ssl on Server
                      </button>
                    </div>

                    <div id="installCertFeedback_${domWinId}" style="display:none; padding:0.5rem 0.75rem; border-radius:4px; font-size:0.74rem;"></div>
                  </div>
                </div>
              </div>
            </div>
          `;

          // Wire SSL Mode Save
          const sslSel = container.querySelector(`#selSslMode_${domWinId}`);
          const saveSslBtn = container.querySelector(`#btnSaveSslMode_${domWinId}`);
          saveSslBtn.onclick = async () => {
            const m = sslSel.value;
            saveSslBtn.disabled = true;
            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/ssl-mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssl_mode: m })
              });
              const res = await resp.json();
              if (res.success) {
                domain.ssl_mode = m;
                if (window.showToast) window.showToast(res.message, 'success');
              } else {
                DesktopModal.alert({ title: 'Error', message: res.error, type: 'danger' });
              }
            } finally {
              saveSslBtn.disabled = false;
            }
          };

          // Wire Origin CA Gen
          let lastCert = '', lastKey = '';
          const genBtn = container.querySelector(`#btnGenOriginCert_${domWinId}`);
          const outArea = container.querySelector(`#originCertOutput_${domWinId}`);
          const txtCert = container.querySelector(`#txtCert_${domWinId}`);
          const txtKey = container.querySelector(`#txtKey_${domWinId}`);
          const copyCertBtn = container.querySelector(`#btnCopyCert_${domWinId}`);
          const copyKeyBtn = container.querySelector(`#btnCopyKey_${domWinId}`);
          const hostnamesInp = container.querySelector(`#inpOriginHostnames_${domWinId}`);

          copyCertBtn.onclick = () => {
            navigator.clipboard.writeText(lastCert);
            if (window.showToast) window.showToast('Certificate copied', 'info');
          };
          copyKeyBtn.onclick = () => {
            navigator.clipboard.writeText(lastKey);
            if (window.showToast) window.showToast('Private key copied', 'info');
          };

          genBtn.onclick = async () => {
            const rawHosts = hostnamesInp.value.trim();
            const hostList = rawHosts.split(',').map(s => s.trim()).filter(Boolean);
            if (hostList.length === 0) {
              DesktopModal.alert({ title: 'Error', message: 'Hostnames cannot be empty.', type: 'warning' });
              return;
            }

            genBtn.disabled = true;
            genBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Generating...`;

            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/origin-cert/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostnames: hostList })
              });
              const res = await resp.json();
              if (res.success) {
                lastCert = res.certificate;
                lastKey = res.private_key;
                txtCert.value = lastCert;
                txtKey.value = lastKey;
                outArea.style.display = 'flex';
                if (window.showToast) window.showToast(res.message, 'success');
              } else {
                DesktopModal.alert({ title: 'Certificate Error', message: res.error, type: 'danger' });
              }
            } finally {
              genBtn.disabled = false;
              genBtn.textContent = 'Generate 15-Year Certificate';
            }
          };

          // Wire Install to Server
          const installBtn = container.querySelector(`#btnInstallCert_${domWinId}`);
          const srvSel = container.querySelector(`#selInstallServer_${domWinId}`);
          const fbBox = container.querySelector(`#installCertFeedback_${domWinId}`);

          installBtn.onclick = async () => {
            const sId = srvSel.value;
            if (!sId) {
              DesktopModal.alert({ title: 'No Server', message: 'Please select a target server.', type: 'warning' });
              return;
            }

            installBtn.disabled = true;
            installBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Installing...`;
            fbBox.style.display = 'none';

            try {
              const resp = await fetch(`/api/domains/${domain.zone_id}/origin-cert/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  server_id: parseInt(sId, 10),
                  certificate: lastCert,
                  private_key: lastKey
                })
              });
              const res = await resp.json();
              fbBox.style.display = 'block';
              if (res.success) {
                fbBox.style.background = 'rgba(16,185,129,0.15)';
                fbBox.style.color = '#34d399';
                fbBox.textContent = res.message;
                if (window.showToast) window.showToast('Origin certificate installed successfully!', 'success');
              } else {
                fbBox.style.background = 'rgba(239,68,68,0.15)';
                fbBox.style.color = '#f87171';
                fbBox.textContent = res.error || 'Installation failed.';
              }
            } catch (e) {
              fbBox.style.display = 'block';
              fbBox.style.background = 'rgba(239,68,68,0.15)';
              fbBox.style.color = '#f87171';
              fbBox.textContent = 'Error: ' + e;
            } finally {
              installBtn.disabled = false;
              installBtn.textContent = 'Install to /etc/nginx/ssl on Server';
            }
          };
        };

        // 5. Add Domain Modal
        const openAddDomainModal = () => {
          const backdrop = document.createElement('div');
          backdrop.className = 'desktop-modal-backdrop';
          backdrop.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:100020; padding:1.25rem;';
          backdrop.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:12px; width:100%; max-width:520px; box-shadow:0 25px 50px rgba(0,0,0,0.85); overflow:hidden; display:flex; flex-direction:column;">
              <div style="height:42px; padding:0 1rem; border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02);">
                <div style="font-weight:700; font-size:0.88rem; color:#f8fafc; display:flex; align-items:center; gap:0.45rem;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Domain to Cloudflare
                </div>
                <button type="button" class="btn btn-secondary btn-xs" id="closeAddDomBtn_${domWinId}" style="padding:0.15rem 0.45rem;">&times;</button>
              </div>

              <div style="padding:1.2rem; display:flex; flex-direction:column; gap:0.85rem; font-size:0.78rem;">
                <p style="margin:0; color:var(--text-secondary); line-height:1.45;">
                  Adding a domain creates a DNS zone inside your connected Cloudflare account.
                  <br><strong style="color:#cbd5e1;">Note:</strong> ShellMan does not register or purchase domains. You must already own the domain at a registrar (e.g. Namecheap, GoDaddy, Squarespace).
                </p>

                <div>
                  <label style="display:block; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Domain Name *</label>
                  <input type="text" id="newDomNameInp_${domWinId}" class="form-control" placeholder="e.g. example.com (no http:// or /)" style="width:100%; font-size:0.82rem; padding:0.45rem 0.65rem;" autocomplete="off" spellcheck="false">
                  <span style="font-size:0.68rem; color:var(--text-muted); display:block; margin-top:3px;">Must be a registered root domain (e.g. <code>example.com</code>). Subdomains like <code>sub.example.com</code> are configured as DNS records once the domain is added.</span>
                </div>

                <div>
                  <label style="display:block; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Link to ShellMan Server (Optional)</label>
                  <select id="newDomSrvSel_${domWinId}" class="form-control" style="width:100%; font-size:0.8rem; padding:0.45rem 0.65rem;">
                    <option value="">-- None (DNS Management Only) --</option>
                    ${(window.DesktopServersList || []).map(s => `
                      <option value="${s.id}">${escapeHtml(s.name)} (${s.host})</option>
                    `).join('')}
                  </select>
                </div>

                <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); border-radius:6px; padding:0.65rem 0.85rem; font-size:0.73rem; color:#fbbf24; line-height:1.45;">
                  <strong>Existing Email / MX Records Notice:</strong> When activating Cloudflare, ensure any required MX, TXT, or SPF records are configured in Cloudflare to prevent email delivery disruptions.
                </div>

                <div id="addDomErr_${domWinId}" style="display:none; color:#ef4444; font-size:0.74rem;"></div>
              </div>

              <div style="padding:0.75rem 1rem; border-top:1px solid var(--border-subtle); background:rgba(0,0,0,0.2); display:flex; justify-content:flex-end; gap:0.5rem;">
                <button type="button" class="btn btn-secondary btn-sm" id="cancelAddDomBtn_${domWinId}">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="submitAddDomBtn_${domWinId}" style="font-weight:600;">Add Domain</button>
              </div>
            </div>
          `;
          document.body.appendChild(backdrop);

          const closeM = () => { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
          backdrop.querySelector(`#closeAddDomBtn_${domWinId}`).onclick = closeM;
          backdrop.querySelector(`#cancelAddDomBtn_${domWinId}`).onclick = closeM;

          const submitBtn = backdrop.querySelector(`#submitAddDomBtn_${domWinId}`);
          const nameInp = backdrop.querySelector(`#newDomNameInp_${domWinId}`);
          const srvSel = backdrop.querySelector(`#newDomSrvSel_${domWinId}`);
          const errBox = backdrop.querySelector(`#addDomErr_${domWinId}`);

          nameInp.focus();
          submitBtn.onclick = async () => {
            const rawDomain = nameInp.value.trim();
            const serverId = srvSel.value || null;

            if (!rawDomain) {
              errBox.style.display = 'block';
              errBox.textContent = 'Please enter a valid domain name.';
              return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Creating Zone...`;
            errBox.style.display = 'none';

            try {
              const resp = await fetch('/api/domains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: rawDomain, server_id: serverId })
              });
              const res = await resp.json();

              if (res.success) {
                closeM();
                if (window.showToast) window.showToast(`Domain '${res.domain.name}' added successfully!`, 'success');
                await fetchDomains();
                openDomainDetails(res.domain.zone_id, 'nameservers');
              } else {
                errBox.style.display = 'block';
                errBox.textContent = res.error || 'Failed to add domain.';
              }
            } catch (e) {
              errBox.style.display = 'block';
              errBox.textContent = 'Network error: ' + e;
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Add Domain';
            }
          };
        };

        // 6. Cloudflare Settings / Connect Token Modal
        const openCloudflareSettingsModal = () => {
          const backdrop = document.createElement('div');
          backdrop.className = 'desktop-modal-backdrop';
          backdrop.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:100020; padding:1.25rem;';
          backdrop.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:12px; width:100%; max-width:560px; box-shadow:0 25px 50px rgba(0,0,0,0.85); overflow:hidden; display:flex; flex-direction:column;">
              <div style="height:42px; padding:0 1rem; border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02);">
                <div style="font-weight:700; font-size:0.88rem; color:#f8fafc; display:flex; align-items:center; gap:0.45rem;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  Cloudflare API Integration Settings
                </div>
                <button type="button" class="btn btn-secondary btn-xs" id="closeCfModalBtn_${domWinId}" style="padding:0.15rem 0.45rem;">&times;</button>
              </div>

              <div style="padding:1.25rem; display:flex; flex-direction:column; gap:0.95rem; font-size:0.78rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#0b111c; border:1px solid var(--border-subtle); border-radius:6px; padding:0.65rem 0.85rem;">
                  <div>
                    <span style="font-weight:700; color:#f8fafc;">Account Status: </span>
                    <span id="mCfAccStatus_${domWinId}">Checking...</span>
                  </div>
                  ${cfAccount ? `<button type="button" class="btn btn-danger btn-xs" id="btnDisconnCf_${domWinId}">Disconnect</button>` : ''}
                </div>

                <div>
                  <label style="display:block; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Cloudflare API Token *</label>
                  <input type="password" id="cfTokenInp_${domWinId}" class="form-control" placeholder="${cfAccount ? '•••••••••••••••••••• (Leave blank to keep current)' : 'Paste Cloudflare Scoped API Token'}" style="width:100%; font-size:0.8rem; padding:0.45rem 0.65rem; font-family:monospace;" autocomplete="off">
                  <span style="font-size:0.68rem; color:var(--text-muted); margin-top:2px; display:block;">Token is encrypted at rest using Fernet keys and never exposed in browser or API payloads.</span>
                </div>

                <!-- Scoped Token Permissions Guide -->
                <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:6px; padding:0.75rem 0.95rem; line-height:1.5;">
                  <div style="font-weight:700; color:var(--sm-accent); margin-bottom:0.3rem;">Required Minimum-Privilege Scoped Permissions:</div>
                  <div style="color:var(--text-secondary); font-size:0.73rem;">
                    When creating an API Token at <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" style="color:var(--sm-accent); text-decoration:underline;">Cloudflare Dashboard &gt; API Tokens</a>, choose <strong>Create Custom Token</strong> with:
                    <ul style="margin:4px 0 0; padding-left:1.2rem;">
                      <li><code>Account &gt; Account Settings &gt; Read</code> <em>(Required to identify your Cloudflare Account)</em></li>
                      <li><code>Zone &gt; Zone &gt; Read / Edit</code></li>
                      <li><code>Zone &gt; DNS &gt; Read / Edit</code></li>
                      <li><code>Zone &gt; SSL and Certificates &gt; Edit</code> <em>(Required for 15-Year Origin CA SSL Generator)</em></li>
                      <li><code>Zone &gt; Zone Settings &gt; Read / Edit</code> <em>(Required for Under Attack Mode &amp; Dev Mode)</em></li>
                      <li>Account Resources: <code>All Accounts</code> (or your chosen account)</li>
                      <li>Zone Resources: <code>All Zones</code></li>
                    </ul>
                    <div style="margin-top:0.5rem;">
                      <a href="/static/images/cloudflare-token-setup.png?v=2" target="_blank" style="display:inline-flex; align-items:center; gap:4px; color:var(--sm-accent); text-decoration:none; font-weight:600; font-size:0.72rem; padding:3px 7px; background:color-mix(in srgb, var(--sm-accent) 10%, transparent); border:1px solid color-mix(in srgb, var(--sm-accent) 25%, transparent); border-radius:4px;">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        View Reference Screenshot
                      </a>
                    </div>
                  </div>
                </div>

                <div id="cfModalMsg_${domWinId}" style="display:none; padding:0.5rem 0.75rem; border-radius:4px; font-size:0.74rem;"></div>
              </div>

              <div style="padding:0.75rem 1rem; border-top:1px solid var(--border-subtle); background:rgba(0,0,0,0.2); display:flex; justify-content:space-between; align-items:center;">
                <button type="button" class="btn btn-secondary btn-sm" id="btnTestCfToken_${domWinId}">Test Token</button>
                <div style="display:flex; gap:0.5rem;">
                  <button type="button" class="btn btn-secondary btn-sm" id="cancelCfModalBtn_${domWinId}">Cancel</button>
                  <button type="button" class="btn btn-primary btn-sm" id="saveCfTokenBtn_${domWinId}" style="font-weight:600;">Save &amp; Connect</button>
                </div>
              </div>
            </div>
          `;
          document.body.appendChild(backdrop);

          const closeM = () => { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
          backdrop.querySelector(`#closeCfModalBtn_${domWinId}`).onclick = closeM;
          backdrop.querySelector(`#cancelCfModalBtn_${domWinId}`).onclick = closeM;

          const accStatEl = backdrop.querySelector(`#mCfAccStatus_${domWinId}`);
          if (cfAccount) {
            accStatEl.innerHTML = `<span style="color:#34d399; font-weight:700;">Active</span> (${escapeHtml(cfAccount.account_name || 'Cloudflare Account')})`;
          } else {
            accStatEl.innerHTML = `<span style="color:#f87171; font-weight:700;">Not Connected</span>`;
          }

          const msgBox = backdrop.querySelector(`#cfModalMsg_${domWinId}`);
          const tokenInp = backdrop.querySelector(`#cfTokenInp_${domWinId}`);
          const saveBtn = backdrop.querySelector(`#saveCfTokenBtn_${domWinId}`);
          const testBtn = backdrop.querySelector(`#btnTestCfToken_${domWinId}`);
          const disconnBtn = backdrop.querySelector(`#btnDisconnCf_${domWinId}`);

          if (disconnBtn) {
            disconnBtn.onclick = async () => {
              const ok = await DesktopModal.confirm({
                title: 'Disconnect Cloudflare',
                message: 'Are you sure you want to disconnect Cloudflare?\n\nExisting zones and DNS records on Cloudflare will not be affected.',
                confirmText: 'Disconnect'
              });
              if (!ok) return;

              try {
                const resp = await fetch('/api/cloudflare/disconnect', { method: 'POST' });
                const res = await resp.json();
                if (res.success) {
                  closeM();
                  if (window.showToast) window.showToast('Cloudflare disconnected', 'info');
                  await fetchCfStatus();
                  await fetchDomains();
                }
              } catch (e) {
                DesktopModal.alert({ title: 'Disconnect Error', message: String(e), type: 'danger' });
              }
            };
          }

          testBtn.onclick = async () => {
            const raw = tokenInp.value.trim();
            testBtn.disabled = true;
            testBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Testing...`;
            msgBox.style.display = 'block';

            try {
              if (raw) {
                // Testing new token
                const resp = await fetch('/api/cloudflare/connect', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ api_token: raw })
                });
                const res = await resp.json();
                if (res.success) {
                  msgBox.style.background = 'rgba(16,185,129,0.15)';
                  msgBox.style.color = '#34d399';
                  msgBox.textContent = res.message;
                  await fetchCfStatus();
                  await fetchDomains();
                } else {
                  msgBox.style.background = 'rgba(239,68,68,0.15)';
                  msgBox.style.color = '#f87171';
                  msgBox.textContent = res.error || 'Token test failed.';
                }
              } else {
                // Testing existing stored token
                const resp = await fetch('/api/cloudflare/test', { method: 'POST' });
                const res = await resp.json();
                if (res.success) {
                  msgBox.style.background = 'rgba(16,185,129,0.15)';
                  msgBox.style.color = '#34d399';
                  msgBox.textContent = res.message;
                } else {
                  msgBox.style.background = 'rgba(239,68,68,0.15)';
                  msgBox.style.color = '#f87171';
                  msgBox.textContent = res.error || 'Test failed.';
                }
              }
            } catch (e) {
              msgBox.style.background = 'rgba(239,68,68,0.15)';
              msgBox.style.color = '#f87171';
              msgBox.textContent = 'Network error: ' + e;
            } finally {
              testBtn.disabled = false;
              testBtn.textContent = 'Test Token';
            }
          };

          saveBtn.onclick = async () => {
            const raw = tokenInp.value.trim();
            if (!raw && !cfAccount) {
              msgBox.style.display = 'block';
              msgBox.style.background = 'rgba(239,68,68,0.15)';
              msgBox.style.color = '#f87171';
              msgBox.textContent = 'Please provide a valid Cloudflare API token.';
              return;
            }

            if (!raw && cfAccount) {
              closeM();
              return;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Saving...`;

            try {
              const resp = await fetch('/api/cloudflare/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_token: raw })
              });
              const res = await resp.json();
              if (res.success) {
                closeM();
                if (window.showToast) window.showToast('Cloudflare connected successfully!', 'success');
                await fetchCfStatus();
                await fetchDomains();
              } else {
                msgBox.style.display = 'block';
                msgBox.style.background = 'rgba(239,68,68,0.15)';
                msgBox.style.color = '#f87171';
                msgBox.textContent = res.error || 'Failed to connect token.';
              }
            } catch (e) {
              msgBox.style.display = 'block';
              msgBox.style.background = 'rgba(239,68,68,0.15)';
              msgBox.style.color = '#f87171';
              msgBox.textContent = 'Network error: ' + e;
            } finally {
              saveBtn.disabled = false;
              saveBtn.textContent = 'Save & Connect';
            }
          };
        };

        // 7. Add / Edit DNS Record Modal Dialog
        const openRecordModal = (zoneId, existingRecord = null, onSaved = null) => {
          const isEdit = !!existingRecord;
          const r = existingRecord || {};

          const backdrop = document.createElement('div');
          backdrop.className = 'desktop-modal-backdrop';
          backdrop.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:100020; padding:1.25rem;';
          backdrop.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:12px; width:100%; max-width:500px; box-shadow:0 25px 50px rgba(0,0,0,0.85); overflow:hidden; display:flex; flex-direction:column;">
              <div style="height:42px; padding:0 1rem; border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02);">
                <div style="font-weight:700; font-size:0.88rem; color:#f8fafc;">
                  ${isEdit ? 'Edit DNS Record' : 'Add New DNS Record'}
                </div>
                <button type="button" class="btn btn-secondary btn-xs" id="closeRecModalBtn_${domWinId}" style="padding:0.15rem 0.45rem;">&times;</button>
              </div>

              <div style="padding:1.2rem; display:flex; flex-direction:column; gap:0.85rem; font-size:0.78rem;">
                <div style="display:grid; grid-template-columns:120px 1fr; gap:0.75rem;">
                  <div>
                    <label style="display:block; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Type *</label>
                    <select id="mRecType_${domWinId}" class="form-control" style="width:100%; font-size:0.8rem; padding:0.45rem 0.55rem;">
                      ${['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'].map(t => `
                        <option value="${t}" ${r.type === t ? 'selected' : ''}>${t}</option>
                      `).join('')}
                    </select>
                  </div>

                  <div>
                    <label style="display:block; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Name *</label>
                    <input type="text" id="mRecName_${domWinId}" class="form-control" value="${escapeHtml(r.name || '@')}" placeholder="@ or subdomain" style="width:100%; font-size:0.8rem; padding:0.45rem 0.65rem;">
                  </div>
                </div>

                <div>
                  <label style="display:block; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Content / Target *</label>
                  <input type="text" id="mRecContent_${domWinId}" class="form-control" value="${escapeHtml(r.content || '')}" placeholder="IPv4 address, hostname, or text" style="width:100%; font-size:0.8rem; padding:0.45rem 0.65rem; font-family:monospace;">
                </div>

                <div id="mRecProxyRow_${domWinId}">
                  <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; color:#f8fafc; font-weight:600;">
                    <input type="checkbox" id="mRecProxied_${domWinId}" ${r.proxied ? 'checked' : ''}>
                    Cloudflare Proxy Status (Orange Cloud CDN &amp; WAF)
                  </label>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                  <div>
                    <label style="display:block; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">TTL</label>
                    <select id="mRecTtl_${domWinId}" class="form-control" style="width:100%; font-size:0.8rem; padding:0.45rem 0.55rem;">
                      <option value="1" ${r.ttl === 1 || !r.ttl ? 'selected' : ''}>Auto</option>
                      <option value="60" ${r.ttl === 60 ? 'selected' : ''}>1 minute</option>
                      <option value="300" ${r.ttl === 300 ? 'selected' : ''}>5 minutes</option>
                      <option value="1800" ${r.ttl === 1800 ? 'selected' : ''}>30 minutes</option>
                      <option value="3600" ${r.ttl === 3600 ? 'selected' : ''}>1 hour</option>
                      <option value="86400" ${r.ttl === 86400 ? 'selected' : ''}>1 day</option>
                    </select>
                  </div>

                  <div id="mRecPrioCol_${domWinId}" style="display:${r.type === 'MX' || r.type === 'SRV' ? 'block' : 'none'};">
                    <label style="display:block; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Priority</label>
                    <input type="number" id="mRecPrio_${domWinId}" class="form-control" value="${r.priority !== undefined ? r.priority : 10}" style="width:100%; font-size:0.8rem; padding:0.45rem 0.55rem;">
                  </div>
                </div>

                <div>
                  <label style="display:block; font-weight:600; color:#cbd5e1; margin-bottom:0.35rem;">Comment (Optional)</label>
                  <input type="text" id="mRecComment_${domWinId}" class="form-control" value="${escapeHtml(r.comment || '')}" placeholder="Note or description" style="width:100%; font-size:0.8rem; padding:0.45rem 0.65rem;">
                </div>

                <div id="mRecErr_${domWinId}" style="display:none; color:#ef4444; font-size:0.74rem;"></div>
              </div>

              <div style="padding:0.75rem 1rem; border-top:1px solid var(--border-subtle); background:rgba(0,0,0,0.2); display:flex; justify-content:flex-end; gap:0.5rem;">
                <button type="button" class="btn btn-secondary btn-sm" id="cancelRecModalBtn_${domWinId}">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="saveRecModalBtn_${domWinId}" style="font-weight:600;">
                  ${isEdit ? 'Update Record' : 'Create Record'}
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(backdrop);

          const closeM = () => { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); };
          backdrop.querySelector(`#closeRecModalBtn_${domWinId}`).onclick = closeM;
          backdrop.querySelector(`#cancelRecModalBtn_${domWinId}`).onclick = closeM;

          const typeSel = backdrop.querySelector(`#mRecType_${domWinId}`);
          const proxyRow = backdrop.querySelector(`#mRecProxyRow_${domWinId}`);
          const prioCol = backdrop.querySelector(`#mRecPrioCol_${domWinId}`);
          const nameInp = backdrop.querySelector(`#mRecName_${domWinId}`);
          const contentInp = backdrop.querySelector(`#mRecContent_${domWinId}`);
          const proxiedCb = backdrop.querySelector(`#mRecProxied_${domWinId}`);
          const ttlSel = backdrop.querySelector(`#mRecTtl_${domWinId}`);
          const prioInp = backdrop.querySelector(`#mRecPrio_${domWinId}`);
          const commentInp = backdrop.querySelector(`#mRecComment_${domWinId}`);
          const errBox = backdrop.querySelector(`#mRecErr_${domWinId}`);
          const saveBtn = backdrop.querySelector(`#saveRecModalBtn_${domWinId}`);

          const updateTypeUI = () => {
            const t = typeSel.value;
            proxyRow.style.display = ['A', 'AAAA', 'CNAME'].includes(t) ? 'block' : 'none';
            prioCol.style.display = ['MX', 'SRV'].includes(t) ? 'block' : 'none';
          };
          typeSel.onchange = updateTypeUI;
          updateTypeUI();

          saveBtn.onclick = async () => {
            const rType = typeSel.value;
            const rName = nameInp.value.trim() || '@';
            const rContent = contentInp.value.trim();
            const rProxied = proxiedCb.checked;
            const rTtl = parseInt(ttlSel.value, 10);
            const rPrio = parseInt(prioInp.value, 10);
            const rComment = commentInp.value.trim();

            if (!rContent) {
              errBox.style.display = 'block';
              errBox.textContent = 'Record content/value is required.';
              return;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:4px;"></span>Saving...`;
            errBox.style.display = 'none';

            const payload = {
              type: rType,
              name: rName,
              content: rContent,
              proxied: rProxied,
              ttl: rTtl,
              priority: rPrio,
              comment: rComment
            };

            try {
              const url = isEdit ? `/api/domains/${zoneId}/dns/${r.id}` : `/api/domains/${zoneId}/dns`;
              const method = isEdit ? 'PUT' : 'POST';
              const resp = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const res = await resp.json();

              if (res.success) {
                closeM();
                if (window.showToast) window.showToast(res.message || 'Record saved successfully!', 'success');
                if (onSaved) onSaved();
              } else {
                errBox.style.display = 'block';
                errBox.textContent = res.error || 'Failed to save DNS record.';
              }
            } catch (e) {
              errBox.style.display = 'block';
              errBox.textContent = 'Network error: ' + e;
            } finally {
              saveBtn.disabled = false;
              saveBtn.textContent = isEdit ? 'Update Record' : 'Create Record';
            }
          };
        };

        // Wire Header Buttons
        cfPill.onclick = openCloudflareSettingsModal;
        btnSettings.onclick = openCloudflareSettingsModal;
        btnAdd.onclick = openAddDomainModal;
        btnSync.onclick = async () => {
          btnSync.disabled = true;
          btnSync.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;margin-right:3px;"></span>Syncing...`;
          await fetchDomains();
          btnSync.disabled = false;
          btnSync.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>Sync Zones`;
        };

        // Expose openDomainDetails on winInstance so other windows or notifications can deep-link
        if (winInstance) winInstance._openDomainDetails = openDomainDetails;

        // Render dashboard skeleton immediately so the window is never blank
        renderDashboard();

        // Initial Load
        await fetchCfStatus();
        await fetchDomains();
      }
    });

    return winObj;
};

