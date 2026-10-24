/**
 * ShellMan OS: System Settings, 2FA & Server Node Management (settings.js)
 */

DesktopAppsController.prototype.launchSettings = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('settings');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      if (params.tab && existing._switchTab) {
        existing._switchTab(params.tab);
      }
      return existing;
    }

    const setWinId = 'settings_' + Date.now();
    let currentTab = params.tab || 'servers';
    let serversList = window.DesktopServersList ? [...window.DesktopServersList] : [];

    return WindowManager.createWindow({
      appId: 'settings',
      multiInstance: false,
      title: 'System Settings',
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.5" fill="rgba(56,189,248,0.2)" stroke="#38bdf8" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      width: 920,
      height: 600,
      minWidth: 720,
      minHeight: 460,
      contentHtml: `
        <div class="settings-app-container" id="settingsContainer_${setWinId}">
          <!-- Left Navigation Sidebar -->
          <nav class="settings-sidebar">
            <div class="settings-sidebar-header">System Settings</div>
            <div class="settings-nav-item active" data-tab="servers" id="tabNav_servers_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
              <span>Server Nodes</span>
            </div>
            <div class="settings-nav-item" data-tab="admin" id="tabNav_admin_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              <span>Admin & Security</span>
            </div>
            <div class="settings-nav-item" data-tab="appearance" id="tabNav_appearance_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 10 10 0 0 0 0-20"></path></svg>
              <span>Appearance</span>
            </div>
            <div class="settings-nav-item" data-tab="alerts" id="tabNav_alerts_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              <span>Health Alerts</span>
            </div>
            <div class="settings-nav-item" data-tab="backup" id="tabNav_backup_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Backup & Export</span>
            </div>
            <div class="settings-nav-item" data-tab="pwa" id="tabNav_pwa_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Desktop App (PWA)</span>
            </div>
            <div class="settings-nav-item" data-tab="about" id="tabNav_about_${setWinId}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span>About ShellMan</span>
            </div>
          </nav>

          <!-- Right Content Pane -->
          <div class="settings-content-pane" id="tabContent_${setWinId}">
            <!-- Content will be rendered dynamically -->
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const container = bodyEl.querySelector(`#settingsContainer_${setWinId}`);
        const contentPane = bodyEl.querySelector(`#tabContent_${setWinId}`);

        // Helper to load servers from API
        const loadServers = async () => {
          try {
            const resp = await fetch('/api/servers/list');
            const res = await resp.json();
            if (res.success && res.servers) {
              serversList = res.servers;
              window.DesktopServersList = res.servers;
            }
          } catch (_) {}
        };

        // Render Server Nodes Tab
        const renderServersTab = async () => {
          contentPane.innerHTML = `
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem;">
                <div>
                  <h3 class="settings-section-title">Server Nodes Management</h3>
                  <p class="settings-section-desc">Manage SSH credentials, ports, authentication keys, and remote VPS endpoints.</p>
                </div>
                <button class="btn btn-primary btn-sm" id="addNewServerBtn_${setWinId}" style="display:flex; align-items:center; gap:0.4rem;">
                  <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add Server Node
                </button>
              </div>

              <div id="serversListContainer_${setWinId}">
                <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                  <span class="spinner-border spinner-border-sm" style="margin-right:8px;"></span>Loading servers...
                </div>
              </div>
            </div>
          `;

          await loadServers();

          const listContainer = contentPane.querySelector(`#serversListContainer_${setWinId}`);
          if (!serversList || serversList.length === 0) {
            listContainer.innerHTML = `
              <div class="settings-card" style="text-align:center; padding:3rem 1.5rem;">
                <svg style="width:48px;height:48px;color:#64748b;margin-bottom:0.75rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="2" width="20" height="8" rx="2"></rect><rect x="2" y="14" width="20" height="8" rx="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
                <div style="font-size:0.95rem; font-weight:600; color:#cbd5e1; margin-bottom:0.3rem;">No Servers Configured</div>
                <p style="font-size:0.78rem; color:var(--text-muted); margin-bottom:1rem;">Add your first remote Linux VPS or dedicated server to begin managing it agentlessly.</p>
                <button class="btn btn-primary btn-sm" id="emptyAddServerBtn_${setWinId}">+ Add Your First Server</button>
              </div>
            `;
            const emptyBtn = listContainer.querySelector(`#emptyAddServerBtn_${setWinId}`);
            if (emptyBtn) emptyBtn.onclick = () => openServerModal();
          } else {
            listContainer.innerHTML = serversList.map(s => {
              const isCurrent = this.serverId && s.id === this.serverId;
              return `
                <div class="settings-server-row" data-server-id="${s.id}">
                  <div class="settings-server-info">
                    <span class="status-dot ${s.is_online ? 'connected' : 'disconnected'}" title="${s.is_online ? 'Online' : 'Offline'}"></span>
                    <div>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-weight:600; font-size:0.85rem; color:#f8fafc;">${escapeHtml(s.name)}</span>
                        ${isCurrent ? '<span style="font-size:0.68rem; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">ACTIVE NODE</span>' : ''}
                      </div>
                      <div style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                        <span>${escapeHtml(s.username)}@${escapeHtml(s.host)}:${s.port}</span>
                        <span style="margin:0 4px;">&bull;</span>
                        <span style="color:#94a3b8;">${s.auth_type === 'key' ? 'SSH Key' : 'Password'}</span>
                      </div>
                    </div>
                  </div>
                  <div class="settings-server-actions">
                    ${!isCurrent ? `
                      <a href="/?server_id=${s.id}" class="btn btn-ghost btn-xs" title="Switch to this node">
                        Switch
                      </a>
                    ` : ''}
                    <button class="btn btn-secondary btn-xs test-server-btn" data-id="${s.id}" title="Test SSH Connection">
                      Test SSH
                    </button>
                    <button class="btn btn-secondary btn-xs edit-server-btn" data-id="${s.id}" title="Edit Server Details">
                      Edit
                    </button>
                    <button class="btn btn-danger btn-xs del-server-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}" title="Delete Server">
                      Delete
                    </button>
                  </div>
                </div>
              `;
            }).join('');
          }

          // Wire Add Server button
          const addBtn = contentPane.querySelector(`#addNewServerBtn_${setWinId}`);
          if (addBtn) addBtn.onclick = () => openServerModal();

          // Wire row action buttons
          contentPane.querySelectorAll('.edit-server-btn').forEach(btn => {
            btn.onclick = () => {
              const id = parseInt(btn.dataset.id);
              const srv = serversList.find(s => s.id === id);
              if (srv) openServerModal(srv);
            };
          });

          contentPane.querySelectorAll('.test-server-btn').forEach(btn => {
            btn.onclick = async () => {
              const id = parseInt(btn.dataset.id);
              btn.disabled = true;
              btn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;"></span>`;
              try {
                const resp = await fetch(`/api/servers/${id}/test`, { method: 'POST' });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(`SSH Connection to node successful!`, 'success');
                  else DesktopModal.alert({ title: 'SSH Connection', message: 'SSH Connection Successful!', type: 'success' });
                } else {
                  if (window.showToast) window.showToast(`SSH Connection failed: ${res.message || 'Unknown error'}`, 'danger');
                  else DesktopModal.alert({ title: 'Connection Failed', message: res.message || 'Unknown error', type: 'danger' });
                }
              } catch (e) {
                DesktopModal.alert({ title: 'Test Error', message: String(e), type: 'danger' });
              } finally {
                btn.disabled = false;
                btn.textContent = 'Test SSH';
                renderServersTab();
              }
            };
          });

          contentPane.querySelectorAll('.del-server-btn').forEach(btn => {
            btn.onclick = async () => {
              const id = parseInt(btn.dataset.id);
              const name = btn.dataset.name;
              const ok = await DesktopModal.confirm({
                title: 'Delete Server Node',
                message: `Are you sure you want to delete server node "${name}"? This action cannot be undone.`,
                confirmText: 'Delete Server',
                isDanger: true
              });
              if (ok) {
                try {
                  const resp = await fetch(`/api/servers/${id}/delete`, { method: 'POST' });
                  const res = await resp.json();
                  if (res.success) {
                    if (window.showToast) window.showToast(`Server "${name}" deleted.`, 'info');
                    if (this.serverId === id) {
                      window.location.href = '/';
                    } else {
                      renderServersTab();
                    }
                  } else {
                    DesktopModal.alert({ title: 'Delete Failed', message: res.error || 'Server error', type: 'danger' });
                  }
                } catch (e) {
                  DesktopModal.alert({ title: 'Delete Error', message: String(e), type: 'danger' });
                }
              }
            };
          });
        };

        // Server Add / Edit Modal Drawer
        const openServerModal = (serverToEdit = null) => {
          const isEdit = !!serverToEdit;
          const modalBackdrop = document.createElement('div');
          modalBackdrop.className = 'file-modal-backdrop';
          modalBackdrop.innerHTML = `
            <div class="file-modal-box" style="width:560px; max-width:92vw;">
              <div class="file-modal-header" style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.88rem; color:#f8fafc;">
                  ${isEdit ? `Edit Server Details: ${escapeHtml(serverToEdit.name)}` : 'Add New Server Node'}
                </span>
                <button class="win-btn win-close" id="srvMClose_${setWinId}">×</button>
              </div>
              <div class="file-modal-body" style="padding:1.1rem; display:flex; flex-direction:column; gap:0.85rem; font-size:0.78rem;">
                <div style="display:flex; gap:0.75rem;">
                  <div style="flex:2;">
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">Server Friendly Name *</label>
                    <input type="text" class="form-control" id="mSrvName_${setWinId}" value="${isEdit ? escapeHtml(serverToEdit.name) : ''}" placeholder="e.g. Production Web App" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>
                  <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">SSH Port *</label>
                    <input type="number" class="form-control" id="mSrvPort_${setWinId}" value="${isEdit ? serverToEdit.port : '22'}" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>
                </div>

                <div style="display:flex; gap:0.75rem;">
                  <div style="flex:2;">
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">Host / IP Address *</label>
                    <input type="text" class="form-control" id="mSrvHost_${setWinId}" value="${isEdit ? escapeHtml(serverToEdit.host) : ''}" placeholder="e.g. 20.198.72.44 or vps.example.com" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>
                  <div style="flex:1;">
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">Username *</label>
                    <input type="text" class="form-control" id="mSrvUser_${setWinId}" value="${isEdit ? escapeHtml(serverToEdit.username) : 'root'}" placeholder="root" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  </div>
                </div>

                <div>
                  <label style="display:block; font-weight:600; margin-bottom:0.35rem; color:#cbd5e1;">Authentication Method</label>
                  <div style="display:flex; gap:1.25rem; align-items:center;">
                    <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                      <input type="radio" name="mAuthType_${setWinId}" value="password" ${(!isEdit || serverToEdit.auth_type === 'password') ? 'checked' : ''}>
                      <span>Password Authentication</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                      <input type="radio" name="mAuthType_${setWinId}" value="key" ${(isEdit && serverToEdit.auth_type === 'key') ? 'checked' : ''}>
                      <span>SSH Private Key</span>
                    </label>
                  </div>
                </div>

                <!-- Password Auth Fields -->
                <div id="mPasswordBox_${setWinId}" style="display:${(!isEdit || serverToEdit.auth_type === 'password') ? 'block' : 'none'};">
                  <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">
                    ${isEdit ? 'Password (leave blank to keep current)' : 'Password *'}
                  </label>
                  <div style="display:flex; position:relative;">
                    <input type="password" class="form-control" id="mSrvPassword_${setWinId}" placeholder="${isEdit ? '••••••••' : 'Enter SSH user password'}" style="width:100%; font-size:0.8rem; padding:0.4rem 2rem 0.4rem 0.6rem;" autocomplete="current-password">
                    <button type="button" class="btn btn-ghost btn-xs" id="mTogglePass_${setWinId}" style="position:absolute; right:4px; top:50%; transform:translateY(-50%); padding:2px 6px; display:flex; align-items:center;">
                      <svg style="width:14px;height:14px;color:#94a3b8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                  </div>
                </div>

                <!-- SSH Key Auth Fields -->
                <div id="mKeyBox_${setWinId}" style="display:${(isEdit && serverToEdit.auth_type === 'key') ? 'block' : 'none'};">
                  <label style="display:block; font-weight:600; margin-bottom:0.25rem; color:#cbd5e1;">
                    ${isEdit ? 'SSH Private Key (leave blank to keep current)' : 'SSH Private Key *'}
                  </label>
                  <textarea class="form-control" id="mSrvKey_${setWinId}" rows="4" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..." style="width:100%; font-family:var(--font-mono); font-size:0.72rem; padding:0.4rem 0.6rem;"></textarea>
                  
                  <label style="display:block; font-weight:600; margin-top:0.5rem; margin-bottom:0.25rem; color:#cbd5e1;">
                    Key Passphrase (optional)
                  </label>
                  <input type="password" class="form-control" id="mSrvPassphrase_${setWinId}" placeholder="Enter passphrase if key is encrypted" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;" autocomplete="current-password">
                </div>

                <div id="mTestStatus_${setWinId}" style="display:none; padding:0.45rem 0.75rem; border-radius:4px; font-size:0.75rem;"></div>
              </div>
              <div class="file-modal-footer" style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1.1rem; border-top:1px solid rgba(255,255,255,0.08);">
                <button type="button" class="btn btn-secondary btn-sm" id="mTestBtn_${setWinId}">
                  Test Connection
                </button>
                <div style="display:flex; gap:0.4rem;">
                  <button type="button" class="btn btn-ghost btn-sm" id="mCancelBtn_${setWinId}">Cancel</button>
                  <button type="button" class="btn btn-primary btn-sm" id="mSaveBtn_${setWinId}">
                    ${isEdit ? 'Save Changes' : 'Create Server'}
                  </button>
                </div>
              </div>
            </div>
          `;
          container.appendChild(modalBackdrop);

          const closeModal = () => {
            if (modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop);
          };

          modalBackdrop.querySelector(`#srvMClose_${setWinId}`).onclick = closeModal;
          modalBackdrop.querySelector(`#mCancelBtn_${setWinId}`).onclick = closeModal;

          // Toggle auth type radio
          const passBox = modalBackdrop.querySelector(`#mPasswordBox_${setWinId}`);
          const keyBox = modalBackdrop.querySelector(`#mKeyBox_${setWinId}`);
          modalBackdrop.querySelectorAll(`input[name="mAuthType_${setWinId}"]`).forEach(r => {
            r.onchange = () => {
              const isKey = r.value === 'key';
              passBox.style.display = isKey ? 'none' : 'block';
              keyBox.style.display = isKey ? 'block' : 'none';
            };
          });

          // Toggle password visibility
          const passInp = modalBackdrop.querySelector(`#mSrvPassword_${setWinId}`);
          const togBtn = modalBackdrop.querySelector(`#mTogglePass_${setWinId}`);
          togBtn.onclick = () => {
            passInp.type = passInp.type === 'password' ? 'text' : 'password';
          };

          const statusBox = modalBackdrop.querySelector(`#mTestStatus_${setWinId}`);

          // Test Connection button
          const testBtn = modalBackdrop.querySelector(`#mTestBtn_${setWinId}`);
          testBtn.onclick = async () => {
            testBtn.disabled = true;
            testBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Testing...`;
            statusBox.style.display = 'block';
            statusBox.style.background = 'rgba(56,189,248,0.1)';
            statusBox.style.color = '#38bdf8';
            statusBox.textContent = 'Connecting to remote SSH daemon...';

            const payload = {
              name: modalBackdrop.querySelector(`#mSrvName_${setWinId}`).value.trim(),
              host: modalBackdrop.querySelector(`#mSrvHost_${setWinId}`).value.trim(),
              port: parseInt(modalBackdrop.querySelector(`#mSrvPort_${setWinId}`).value) || 22,
              username: modalBackdrop.querySelector(`#mSrvUser_${setWinId}`).value.trim(),
              auth_type: modalBackdrop.querySelector(`input[name="mAuthType_${setWinId}"]:checked`).value,
              password: passInp.value,
              private_key: modalBackdrop.querySelector(`#mSrvKey_${setWinId}`).value,
              passphrase: modalBackdrop.querySelector(`#mSrvPassphrase_${setWinId}`).value
            };

            try {
              let resp, res;
              if (isEdit && !payload.password && !payload.private_key) {
                resp = await fetch(`/api/servers/${serverToEdit.id}/test`, { method: 'POST' });
              } else {
                resp = await fetch('/api/servers/test-config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
              }
              res = await resp.json();
              if (res.success) {
                statusBox.style.background = 'rgba(16,185,129,0.12)';
                statusBox.style.color = '#34d399';
                statusBox.textContent = '✓ SSH Authentication Successful! Server is reachable.';
              } else {
                statusBox.style.background = 'rgba(239,68,68,0.12)';
                statusBox.style.color = '#f87171';
                statusBox.textContent = `✗ Connection Failed: ${res.message || 'Authentication error'}`;
              }
            } catch (e) {
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = `Error: ${e}`;
            } finally {
              testBtn.disabled = false;
              testBtn.textContent = 'Test Connection';
            }
          };

          // Save button
          const saveBtn = modalBackdrop.querySelector(`#mSaveBtn_${setWinId}`);
          saveBtn.onclick = async () => {
            const name = modalBackdrop.querySelector(`#mSrvName_${setWinId}`).value.trim();
            const host = modalBackdrop.querySelector(`#mSrvHost_${setWinId}`).value.trim();
            const port = parseInt(modalBackdrop.querySelector(`#mSrvPort_${setWinId}`).value) || 22;
            const username = modalBackdrop.querySelector(`#mSrvUser_${setWinId}`).value.trim();
            const auth_type = modalBackdrop.querySelector(`input[name="mAuthType_${setWinId}"]:checked`).value;
            const password = passInp.value;
            const private_key = modalBackdrop.querySelector(`#mSrvKey_${setWinId}`).value;
            const passphrase = modalBackdrop.querySelector(`#mSrvPassphrase_${setWinId}`).value;

            if (!name || !host || !username) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'Name, Host, and Username are required.';
              return;
            }

            saveBtn.disabled = true;
            saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Saving...`;

            try {
              const endpoint = isEdit ? `/api/servers/${serverToEdit.id}/edit` : '/api/servers/add';
              const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, host, port, username, auth_type, password, private_key, passphrase })
              });
              const res = await resp.json();
              if (res.success) {
                if (window.showToast) window.showToast(`Server "${name}" ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
                closeModal();
                renderServersTab();
              } else {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(239,68,68,0.12)';
                statusBox.style.color = '#f87171';
                statusBox.textContent = res.error || 'Failed to save server.';
                saveBtn.disabled = false;
                saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Server';
              }
            } catch (e) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'Save error: ' + e;
              saveBtn.disabled = false;
              saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Server';
            }
          };
        };

        // Render Admin & Security Tab
        const renderAdminTab = async () => {
          contentPane.innerHTML = `
            <div>
              <h3 class="settings-section-title">Admin & Account Security</h3>
              <p class="settings-section-desc">Manage ShellMan master control credentials and access keys.</p>

              <!-- Profile Details Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="display:flex; align-items:center; gap:1rem;">
                  <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, #0284c7, #38bdf8); display:flex; align-items:center; justify-content:center; color:#ffffff; font-weight:700; font-size:1.2rem; flex-shrink:0;">
                    A
                  </div>
                  <div style="min-width:0; flex:1;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <span style="font-weight:700; font-size:0.95rem; color:#f8fafc;" id="adminUsername_${setWinId}">admin</span>
                      <span style="font-size:0.68rem; background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3); padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">SUPER ADMINISTRATOR</span>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">
                      Full privileges &bull; Interactive SSH, SFTP, and terminal execution
                    </div>
                  </div>
                </div>
              </div>

              <!-- Change Password Card -->
              <div class="settings-card">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.25rem;">Change Administrator Password</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem;">Update master credentials for this ShellMan management instance.</p>

                <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:440px;">
                  <div>
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; font-size:0.75rem; color:#cbd5e1;">Current Password *</label>
                    <input type="password" class="form-control" id="admCurPass_${setWinId}" placeholder="Enter current password" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;" autocomplete="current-password">
                  </div>

                  <div>
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; font-size:0.75rem; color:#cbd5e1;">New Password (min 6 characters) *</label>
                    <input type="password" class="form-control" id="admNewPass_${setWinId}" placeholder="Enter new strong password" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;" autocomplete="new-password">
                  </div>

                  <div>
                    <label style="display:block; font-weight:600; margin-bottom:0.25rem; font-size:0.75rem; color:#cbd5e1;">Confirm New Password *</label>
                    <input type="password" class="form-control" id="admConfPass_${setWinId}" placeholder="Confirm new password" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;" autocomplete="new-password">
                  </div>

                  <div id="admPassStatus_${setWinId}" style="display:none; padding:0.45rem 0.75rem; border-radius:4px; font-size:0.75rem;"></div>

                  <div style="margin-top:0.35rem;">
                    <button class="btn btn-primary btn-sm" id="admSubmitPass_${setWinId}">
                      Update Master Password
                    </button>
                  </div>
                </div>
              </div>

              <!-- Two-Factor Authentication Card -->
              <div class="settings-card" style="margin-top:1.25rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.35rem;">
                  <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; display:flex; align-items:center; gap:0.45rem;">
                    <svg style="width:15px;height:15px;color:#38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    Two-Factor Authentication (TOTP)
                  </div>
                  <span id="totpBadge_${setWinId}" style="font-size:0.68rem; font-weight:700; padding:0.12rem 0.5rem; border-radius:4px; background:rgba(148,163,184,0.15); color:#94a3b8;">
                    CHECKING...
                  </span>
                </div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem; line-height:1.4;">
                  Enforce a 6-digit verification code from Google Authenticator, Authy, or 1Password when logging in to safeguard access to your servers.
                </p>

                <div id="totpSection_${setWinId}">
                  <!-- Dynamic 2FA content -->
                </div>
              </div>

              <!-- Session Termination -->
              <div class="settings-card" style="margin-top:1.25rem; display:flex; align-items:center; justify-content:space-between;">
                <div>
                  <div style="font-weight:600; font-size:0.82rem; color:#f8fafc;">Active Session</div>
                  <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Logged in via web session. End session and require authentication on next visit.</div>
                </div>
                <a href="/logout" class="btn btn-danger btn-sm" style="display:inline-flex; align-items:center; gap:0.4rem;">
                  <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  Log Out
                </a>
              </div>
            </div>
          `;

          // Fetch profile info
          try {
            const resp = await fetch('/api/settings/profile');
            const res = await resp.json();
            if (res.success && res.user && res.user.username) {
              const uEl = contentPane.querySelector(`#adminUsername_${setWinId}`);
              if (uEl) uEl.textContent = res.user.username;
            }
          } catch (_) {}

          // 2FA State Manager
          const totpBadge = contentPane.querySelector(`#totpBadge_${setWinId}`);
          const totpSection = contentPane.querySelector(`#totpSection_${setWinId}`);

          const load2FAState = async () => {
            try {
              const resp = await fetch('/api/settings/2fa/status');
              const res = await resp.json();
              const isEnabled = res.success && res.enabled;
              if (isEnabled) {
                totpBadge.style.background = 'rgba(16,185,129,0.15)';
                totpBadge.style.color = '#34d399';
                totpBadge.style.border = '1px solid rgba(16,185,129,0.3)';
                totpBadge.textContent = 'ACTIVE (PROTECTED)';

                totpSection.innerHTML = `
                  <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    <div style="font-size:0.78rem; color:#cbd5e1; display:flex; align-items:center; gap:0.4rem;">
                      <svg style="width:14px;height:14px;color:#34d399;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Two-factor authentication is currently active on your administrator account.
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                      <button class="btn btn-secondary btn-sm" id="btnToggleBackupCodes_${setWinId}" style="display:inline-flex; align-items:center; gap:0.4rem; color:#38bdf8; border-color:rgba(56,189,248,0.3);">
                        <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        View Backup Recovery Codes
                      </button>
                      <button class="btn btn-secondary btn-sm" id="btnShowDisable2FA_${setWinId}" style="color:#f87171; border-color:rgba(239,68,68,0.3);">
                        Disable Two-Factor Authentication
                      </button>
                    </div>

                    <!-- Backup Codes Container -->
                    <div id="backupCodesBox_${setWinId}" style="display:none; margin-top:0.25rem; padding:0.85rem; background:rgba(2,132,199,0.06); border:1px solid rgba(56,189,248,0.25); border-radius:6px;">
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.5rem;">
                        <div>
                          <div style="font-size:0.78rem; font-weight:700; color:#38bdf8;">Your Emergency Backup Recovery Codes</div>
                          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Each code can be entered once if you lose access to your authenticator app.</div>
                        </div>
                        <div style="display:flex; gap:0.4rem;">
                          <button class="btn btn-secondary btn-xs" id="btnCopyActiveCodes_${setWinId}" style="font-size:0.7rem; padding:0.2rem 0.5rem;">Copy All Codes</button>
                          <button class="btn btn-secondary btn-xs" id="btnRegenCodes_${setWinId}" style="font-size:0.7rem; padding:0.2rem 0.5rem; color:#fbbf24; border-color:rgba(245,158,11,0.3);">Regenerate Fresh Codes</button>
                        </div>
                      </div>
                      <div id="backupCodesGrid_${setWinId}" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.45rem; margin-top:0.6rem;">
                        <span style="font-size:0.75rem; color:var(--text-muted);">Loading codes...</span>
                      </div>
                    </div>

                    <div id="disable2FAForm_${setWinId}" style="display:none; margin-top:0.5rem; max-width:380px; padding:0.75rem; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:6px;">
                      <label style="display:block; font-size:0.75rem; font-weight:600; color:#cbd5e1; margin-bottom:0.3rem;">Confirm Master Password to Disable</label>
                      <input type="password" id="disable2FAPass_${setWinId}" class="form-control" placeholder="Current master password" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem; margin-bottom:0.5rem;" autocomplete="current-password">
                      <div id="disable2FAStatus_${setWinId}" style="display:none; font-size:0.72rem; margin-bottom:0.4rem;"></div>
                      <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-danger btn-xs" id="btnConfirmDisable2FA_${setWinId}">Confirm & Disable</button>
                        <button class="btn btn-secondary btn-xs" id="btnCancelDisable2FA_${setWinId}">Cancel</button>
                      </div>
                    </div>
                  </div>
                `;

                // Backup codes logic
                let activeCodesList = [];
                const codesBox = totpSection.querySelector(`#backupCodesBox_${setWinId}`);
                const codesGrid = totpSection.querySelector(`#backupCodesGrid_${setWinId}`);
                const btnToggleCodes = totpSection.querySelector(`#btnToggleBackupCodes_${setWinId}`);
                const btnCopyActive = totpSection.querySelector(`#btnCopyActiveCodes_${setWinId}`);
                const btnRegen = totpSection.querySelector(`#btnRegenCodes_${setWinId}`);

                const renderCodes = (codes) => {
                  activeCodesList = codes || [];
                  if (!activeCodesList.length) {
                    codesGrid.innerHTML = '<span style="font-size:0.75rem; color:#f87171; grid-column:1/-1;">No backup codes remaining. Click "Regenerate Fresh Codes" to generate 8 new recovery codes.</span>';
                    return;
                  }
                  codesGrid.innerHTML = activeCodesList.map(c => `
                    <code style="background:rgba(0,0,0,0.35); padding:0.35rem 0.5rem; border-radius:4px; font-size:0.8rem; text-align:center; color:#38bdf8; font-family:monospace; border:1px solid rgba(56,189,248,0.2); user-select:all; display:block;">${c}</code>
                  `).join('');
                };

                const fetchBackupCodes = async () => {
                  try {
                    codesGrid.innerHTML = '<span style="font-size:0.72rem; color:var(--text-muted); grid-column:1/-1;">Retrieving active backup recovery codes...</span>';
                    const cResp = await fetch('/api/settings/2fa/backup-codes');
                    const cRes = await cResp.json();
                    if (cRes.success && Array.isArray(cRes.backup_codes)) {
                      renderCodes(cRes.backup_codes);
                    } else {
                      codesGrid.innerHTML = `<span style="font-size:0.72rem; color:#f87171; grid-column:1/-1;">${cRes.error || 'Failed to load backup codes.'}</span>`;
                    }
                  } catch (e) {
                    codesGrid.innerHTML = `<span style="font-size:0.72rem; color:#f87171; grid-column:1/-1;">Network error loading codes: ${e}</span>`;
                  }
                };

                btnToggleCodes.onclick = async () => {
                  const isVisible = codesBox.style.display !== 'none';
                  if (isVisible) {
                    codesBox.style.display = 'none';
                    btnToggleCodes.innerHTML = `<svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> View Backup Recovery Codes`;
                  } else {
                    codesBox.style.display = 'block';
                    btnToggleCodes.innerHTML = `<svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Hide Backup Recovery Codes`;
                    await fetchBackupCodes();
                  }
                };

                btnCopyActive.onclick = () => {
                  if (!activeCodesList.length) return;
                  navigator.clipboard.writeText(activeCodesList.join('\n'));
                  if (window.showToast) window.showToast('Copied all backup recovery codes to clipboard.', 'success');
                };

                btnRegen.onclick = async () => {
                  const ok = await DesktopModal.confirm({
                    title: 'Regenerate Backup Codes',
                    message: 'Are you sure you want to invalidate old backup codes and generate a fresh set of 8 recovery codes?',
                    confirmText: 'Regenerate Codes',
                    isDanger: true
                  });
                  if (!ok) return;
                  btnRegen.disabled = true;
                  btnRegen.textContent = 'Regenerating...';
                  try {
                    const rResp = await fetch('/api/settings/2fa/regenerate-backup-codes', { method: 'POST' });
                    const rRes = await rResp.json();
                    if (rRes.success && Array.isArray(rRes.backup_codes)) {
                      renderCodes(rRes.backup_codes);
                      if (window.showToast) window.showToast('Fresh backup recovery codes generated!', 'success');
                    } else {
                      DesktopModal.alert({ title: 'Regeneration Failed', message: rRes.error || 'Failed to regenerate codes.', type: 'danger' });
                    }
                  } catch (err) {
                    DesktopModal.alert({ title: 'Network Error', message: String(err), type: 'danger' });
                  } finally {
                    btnRegen.disabled = false;
                    btnRegen.textContent = 'Regenerate Fresh Codes';
                  }
                };

                totpSection.querySelector(`#btnShowDisable2FA_${setWinId}`).onclick = () => {
                  totpSection.querySelector(`#disable2FAForm_${setWinId}`).style.display = 'block';
                };
                totpSection.querySelector(`#btnCancelDisable2FA_${setWinId}`).onclick = () => {
                  totpSection.querySelector(`#disable2FAForm_${setWinId}`).style.display = 'none';
                };
                totpSection.querySelector(`#btnConfirmDisable2FA_${setWinId}`).onclick = async () => {
                  const pw = totpSection.querySelector(`#disable2FAPass_${setWinId}`).value;
                  const stat = totpSection.querySelector(`#disable2FAStatus_${setWinId}`);
                  if (!pw) {
                    stat.style.display = 'block';
                    stat.style.color = '#f87171';
                    stat.textContent = 'Password is required.';
                    return;
                  }
                  try {
                    const dResp = await fetch('/api/settings/2fa/disable', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ password: pw })
                    });
                    const dRes = await dResp.json();
                    if (dRes.success) {
                      if (window.showToast) window.showToast('2FA has been disabled.', 'info');
                      load2FAState();
                    } else {
                      stat.style.display = 'block';
                      stat.style.color = '#f87171';
                      stat.textContent = dRes.error || 'Failed to disable 2FA.';
                    }
                  } catch (e) {
                    stat.style.display = 'block';
                    stat.style.color = '#f87171';
                    stat.textContent = 'Network error: ' + e;
                  }
                };
              } else {
                totpBadge.style.background = 'rgba(239,68,68,0.12)';
                totpBadge.style.color = '#f87171';
                totpBadge.style.border = '1px solid rgba(239,68,68,0.25)';
                totpBadge.textContent = 'DISABLED';

                totpSection.innerHTML = `
                  <div>
                    <button class="btn btn-primary btn-sm" id="btnStart2FASetup_${setWinId}" style="display:inline-flex; align-items:center; gap:0.4rem;">
                      <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      Enable Two-Factor Authentication
                    </button>
                    <div id="totpWizard_${setWinId}" style="display:none; margin-top:1rem; padding:1rem; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:8px;"></div>
                  </div>
                `;

                const startBtn = totpSection.querySelector(`#btnStart2FASetup_${setWinId}`);
                const wizardDiv = totpSection.querySelector(`#totpWizard_${setWinId}`);

                startBtn.onclick = async () => {
                  startBtn.disabled = true;
                  startBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Generating keys...`;
                  try {
                    const sResp = await fetch('/api/settings/2fa/setup', { method: 'POST' });
                    const sRes = await sResp.json();
                    if (sRes.success) {
                      startBtn.style.display = 'none';
                      wizardDiv.style.display = 'block';
                      wizardDiv.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:1.25rem;">
                          <div style="display:flex; gap:1.5rem; align-items:flex-start; flex-wrap:wrap;">
                            <!-- QR Code SVG container -->
                            <div style="background:#ffffff; padding:0.6rem; border-radius:8px; width:160px; height:160px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.3); flex-shrink:0;">
                              <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
                                ${sRes.qr_svg}
                              </div>
                            </div>
                            <div style="flex:1; min-width:240px;">
                              <div style="font-size:0.85rem; font-weight:700; color:#f8fafc; margin-bottom:0.25rem;">1. Scan Barcode</div>
                              <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.75rem; line-height:1.4;">
                                Open Google Authenticator, Authy, or 1Password and scan this QR code.
                              </p>
                              <div style="font-size:0.72rem; color:#94a3b8; margin-bottom:0.25rem;">Manual Entry Secret Key:</div>
                              <div style="display:flex; align-items:center; gap:0.4rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:6px; padding:0.35rem 0.6rem;">
                                <code style="font-size:0.8rem; font-family:monospace; color:#38bdf8; flex:1; letter-spacing:0.05em;">${sRes.secret}</code>
                                <button class="btn btn-secondary btn-xs" id="btnCopySecret_${setWinId}" style="padding:0.2rem 0.5rem; font-size:0.7rem;">Copy</button>
                              </div>
                            </div>
                          </div>

                          <!-- One-time backup recovery codes -->
                          <div style="background:rgba(2,132,199,0.08); border:1px solid rgba(2,132,199,0.25); border-radius:6px; padding:0.75rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                              <span style="font-size:0.78rem; font-weight:700; color:#38bdf8;">2. Emergency Backup Recovery Codes</span>
                              <button class="btn btn-secondary btn-xs" id="btnCopyCodes_${setWinId}" style="font-size:0.7rem; padding:0.15rem 0.5rem;">Copy All Codes</button>
                            </div>
                            <p style="font-size:0.72rem; color:var(--text-muted); margin-bottom:0.6rem;">
                              Store these backup codes safely. If you lose access to your device, each code can be used once to log in.
                            </p>
                            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.4rem;">
                              ${sRes.backup_codes.map(c => `<code style="background:rgba(0,0,0,0.3); padding:0.2rem 0.4rem; border-radius:4px; font-size:0.75rem; text-align:center; color:#cbd5e1; font-family:monospace;">${c}</code>`).join('')}
                            </div>
                          </div>

                          <!-- Step 3: Verification -->
                          <div style="display:flex; flex-direction:column; gap:0.4rem; max-width:340px;">
                            <label style="font-size:0.78rem; font-weight:700; color:#f8fafc;">3. Verify Authenticator Code</label>
                            <div style="display:flex; gap:0.5rem;">
                              <input type="text" id="inpVerifyCode_${setWinId}" maxlength="6" class="form-control" placeholder="123456"
                                     autocomplete="one-time-code"
                                     style="width:130px; font-size:1.1rem; letter-spacing:0.2em; text-align:center; font-family:monospace; font-weight:700;">
                              <button class="btn btn-primary btn-sm" id="btnConfirm2FA_${setWinId}">Verify & Enable</button>
                              <button class="btn btn-secondary btn-sm" id="btnCancel2FA_${setWinId}">Cancel</button>
                            </div>
                            <div id="verify2FAStatus_${setWinId}" style="display:none; font-size:0.72rem; margin-top:0.2rem;"></div>
                          </div>
                        </div>
                      `;

                      wizardDiv.querySelector(`#btnCopySecret_${setWinId}`).onclick = () => {
                        navigator.clipboard.writeText(sRes.secret);
                        if (window.showToast) window.showToast('Secret key copied', 'info');
                      };

                      wizardDiv.querySelector(`#btnCopyCodes_${setWinId}`).onclick = () => {
                        navigator.clipboard.writeText(sRes.backup_codes.join('\n'));
                        if (window.showToast) window.showToast('All recovery codes copied', 'info');
                      };

                      wizardDiv.querySelector(`#btnCancel2FA_${setWinId}`).onclick = () => {
                        load2FAState();
                      };

                      const codeInp = wizardDiv.querySelector(`#inpVerifyCode_${setWinId}`);
                      const confirmBtn = wizardDiv.querySelector(`#btnConfirm2FA_${setWinId}`);
                      const statDiv = wizardDiv.querySelector(`#verify2FAStatus_${setWinId}`);

                      confirmBtn.onclick = async () => {
                        const code = codeInp.value.trim();
                        if (code.length < 6) {
                          statDiv.style.display = 'block';
                          statDiv.style.color = '#f87171';
                          statDiv.textContent = 'Enter the 6-digit code from your authenticator.';
                          return;
                        }
                        confirmBtn.disabled = true;
                        confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Verifying...`;
                        try {
                          const vResp = await fetch('/api/settings/2fa/verify-enable', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ code })
                          });
                          const vRes = await vResp.json();
                          if (vRes.success) {
                            if (window.showToast) window.showToast('Two-Factor Authentication is now ENABLED!', 'success');
                            load2FAState();
                          } else {
                            statDiv.style.display = 'block';
                            statDiv.style.color = '#f87171';
                            statDiv.textContent = vRes.error || 'Verification failed.';
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = 'Verify & Enable';
                          }
                        } catch (err) {
                          statDiv.style.display = 'block';
                          statDiv.style.color = '#f87171';
                          statDiv.textContent = 'Network error: ' + err;
                          confirmBtn.disabled = false;
                          confirmBtn.textContent = 'Verify & Enable';
                        }
                      };
                    } else {
                      DesktopModal.alert({ title: '2FA Setup Failed', message: sRes.error || 'Unknown error initializing 2FA setup.', type: 'danger' });
                      startBtn.disabled = false;
                      startBtn.textContent = 'Enable Two-Factor Authentication';
                    }
                  } catch (e) {
                    DesktopModal.alert({ title: 'Network Error', message: 'Network error initializing 2FA: ' + e, type: 'danger' });
                    startBtn.disabled = false;
                    startBtn.textContent = 'Enable Two-Factor Authentication';
                  }
                };
              }
            } catch (_) {}
          };

          load2FAState();

          // Password change handler
          const submitBtn = contentPane.querySelector(`#admSubmitPass_${setWinId}`);
          const curInp = contentPane.querySelector(`#admCurPass_${setWinId}`);
          const newInp = contentPane.querySelector(`#admNewPass_${setWinId}`);
          const confInp = contentPane.querySelector(`#admConfPass_${setWinId}`);
          const statusBox = contentPane.querySelector(`#admPassStatus_${setWinId}`);

          submitBtn.onclick = async () => {
            const current_password = curInp.value;
            const new_password = newInp.value;
            const confirm_password = confInp.value;

            if (!current_password) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'Current password is required.';
              return;
            }
            if (new_password.length < 6) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'New password must be at least 6 characters.';
              return;
            }
            if (new_password !== confirm_password) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'New passwords do not match.';
              return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Updating...`;

            try {
              const resp = await fetch('/api/settings/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password, new_password, confirm_password })
              });
              const res = await resp.json();
              if (res.success) {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(16,185,129,0.12)';
                statusBox.style.color = '#34d399';
                statusBox.textContent = '✓ Password updated successfully!';
                curInp.value = '';
                newInp.value = '';
                confInp.value = '';
                if (window.showToast) window.showToast('Password updated successfully', 'success');
              } else {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(239,68,68,0.12)';
                statusBox.style.color = '#f87171';
                statusBox.textContent = res.error || 'Failed to update password.';
              }
            } catch (e) {
              statusBox.style.display = 'block';
              statusBox.style.background = 'rgba(239,68,68,0.12)';
              statusBox.style.color = '#f87171';
              statusBox.textContent = 'Network error: ' + e;
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Update Master Password';
            }
          };
        };

        // Render Appearance Tab
        const renderAppearanceTab = () => {
          const currentFontPx = parseInt(localStorage.getItem('shellman_font_size') || '16', 10);
          const currentFontPct = Math.round((currentFontPx / 16) * 100);
          const currentTermTheme = localStorage.getItem('shellman_terminal_theme') || 'shellman';

          contentPane.innerHTML = `
            <div>
              <h3 class="settings-section-title">Desktop Appearance & Display</h3>
              <p class="settings-section-desc">Personalize system typography, font scale, wallpaper, and visual theme.</p>

              <!-- 1. System Font Size & UI Scale Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                  <div>
                    <div style="font-weight:700; font-size:0.88rem; color:#f8fafc;">System Font Size & Typography Scale</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                      Applies globally across all windows, Task Manager, File Manager, Nginx editor, headers, and menus.
                    </div>
                  </div>
                  <span id="fontScaleBadge_${setWinId}" style="font-family:var(--font-mono); font-size:0.75rem; font-weight:700; padding:3px 10px; border-radius:12px; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3);">
                    ${currentFontPx}px (${currentFontPct}%${currentFontPx === 16 ? ' Default' : ''})
                  </span>
                </div>

                <!-- Quick Presets -->
                <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:1rem; flex-wrap:wrap;">
                  <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600; margin-right:4px;">Presets:</span>
                  <button class="btn ${currentFontPx === 13 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="13">Small (13px)</button>
                  <button class="btn ${currentFontPx === 14 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="14">Compact (14px)</button>
                  <button class="btn ${currentFontPx === 16 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="16">Default (16px)</button>
                  <button class="btn ${currentFontPx === 18 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="18">Medium (18px)</button>
                  <button class="btn ${currentFontPx === 20 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="20">Large (20px)</button>
                  <button class="btn ${currentFontPx === 22 ? 'btn-primary' : 'btn-secondary'} btn-xs font-preset-btn" data-size="22">Extra Large (22px)</button>
                </div>

                <!-- Range Slider -->
                <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1.25rem;">
                  <span style="font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">12px</span>
                  <input type="range" class="form-range" id="fontSizeSlider_${setWinId}" min="12" max="24" step="1" value="${currentFontPx}" style="flex:1; accent-color:#38bdf8; cursor:pointer;">
                  <span style="font-size:0.72rem; color:var(--text-muted); font-family:var(--font-mono);">24px</span>
                  <button class="btn btn-ghost btn-xs" id="resetFontBtn_${setWinId}" title="Reset to standard 16px font size">Reset</button>
                </div>

                <!-- Live Preview Box -->
                <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:0.85rem 1rem;">
                  <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); font-weight:700; margin-bottom:0.4rem;">Live Preview</div>
                  <div id="fontPreviewBox_${setWinId}" style="display:flex; flex-direction:column; gap:0.4rem;">
                    <div style="font-size:0.95rem; font-weight:700; color:#f8fafc;">Task Manager & App Window Header</div>
                    <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.45;">Process PID 1814781 (gunicorn) is active and running with 0% CPU and 9.6% RAM.</div>
                    <div style="display:flex; gap:0.5rem; align-items:center; margin-top:2px;">
                      <span style="display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:12px; background:rgba(52,211,153,0.14); color:#34d399; font-size:0.72rem; font-weight:600;">
                        <span style="width:6px; height:6px; border-radius:50%; background:#34d399;"></span>Active
                      </span>
                      <span style="font-family:var(--font-mono); font-size:0.72rem; color:#38bdf8;">/var/www/site/app.py</span>
                      <button class="btn btn-secondary btn-xs" style="pointer-events:none; padding:2px 8px;">Sample Button</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2. Terminal Color Theme Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="font-weight:700; font-size:0.88rem; color:#f8fafc; margin-bottom:0.25rem;">Terminal Color Theme</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.85rem;">
                  Choose the color theme for all SSH terminal instances and the integrated code terminal.
                </div>
                <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                  <select class="form-control" id="settingsTermTheme_${setWinId}" data-terminal-theme-select style="max-width:320px; font-size:0.8rem; padding:0.4rem 0.6rem;">
                    ${Object.values(SHELLMAN_TERMINAL_THEMES).map(t => `<option value="${t.id}" ${currentTermTheme === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                  </select>
                </div>
              </div>

              <!-- 2. Preset Wallpapers -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.75rem;">Preset Wallpapers</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.85rem;">
                  <div class="wallpaper-card" data-url="/static/images/wallpaper.jpg" style="border:2px solid #38bdf8; border-radius:6px; overflow:hidden; cursor:pointer; background:#070b14;">
                    <div style="height:95px; background:url('/static/images/wallpaper.jpg') center/cover; position:relative;">
                      <span style="position:absolute; bottom:4px; left:4px; font-size:0.68rem; background:rgba(0,0,0,0.7); color:#f8fafc; padding:2px 6px; border-radius:3px;">Default Studio</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 3. Custom Wallpaper URL -->
              <div class="settings-card">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.35rem;">Custom Wallpaper URL</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.75rem;">Set an external image URL as your desktop background.</p>
                <div style="display:flex; gap:0.5rem;">
                  <input type="text" class="form-control" id="customWallUrl_${setWinId}" placeholder="https://images.unsplash.com/..." style="flex:1; font-size:0.8rem; padding:0.4rem 0.6rem;">
                  <button class="btn btn-primary btn-sm" id="applyWallBtn_${setWinId}">Apply</button>
                  <button class="btn btn-ghost btn-sm" id="resetWallBtn_${setWinId}">Reset</button>
                </div>
              </div>
            </div>
          `;

          // Font scaling logic
          const applyFontSize = (size) => {
            const s = parseInt(size, 10) || 16;
            document.documentElement.style.fontSize = `${s}px`;
            document.documentElement.style.setProperty('--app-font-size', `${s}px`);
            document.documentElement.style.setProperty('--app-font-scale', (s / 16).toString());
            localStorage.setItem('shellman_font_size', s.toString());

            const badge = contentPane.querySelector(`#fontScaleBadge_${setWinId}`);
            if (badge) {
              const pct = Math.round((s / 16) * 100);
              badge.textContent = `${s}px (${pct}%${s === 16 ? ' Default' : ''})`;
            }

            const slider = contentPane.querySelector(`#fontSizeSlider_${setWinId}`);
            if (slider && parseInt(slider.value, 10) !== s) {
              slider.value = s;
            }

            contentPane.querySelectorAll('.font-preset-btn').forEach(btn => {
              const bSize = parseInt(btn.dataset.size, 10);
              btn.className = (bSize === s)
                ? 'btn btn-primary btn-xs font-preset-btn'
                : 'btn btn-secondary btn-xs font-preset-btn';
            });

            // Dynamically scale any open terminals
            if (window._shellmanTerminals) {
              window._shellmanTerminals.forEach(t => {
                try {
                  t.options.fontSize = Math.max(10, Math.round(14 * (s / 16)));
                  if (t._fitAddon) t._fitAddon.fit();
                } catch (_) {}
              });
            }
          };

          const slider = contentPane.querySelector(`#fontSizeSlider_${setWinId}`);
          if (slider) {
            slider.oninput = (e) => applyFontSize(e.target.value);
          }

          contentPane.querySelectorAll('.font-preset-btn').forEach(btn => {
            btn.onclick = () => applyFontSize(btn.dataset.size);
          });

          const resetFontBtn = contentPane.querySelector(`#resetFontBtn_${setWinId}`);
          if (resetFontBtn) {
            resetFontBtn.onclick = () => applyFontSize(16);
          }

          const settingsTermTheme = contentPane.querySelector(`#settingsTermTheme_${setWinId}`);
          if (settingsTermTheme) {
            settingsTermTheme.onchange = (e) => {
              applyShellmanTerminalTheme(e.target.value);
              const themeName = (SHELLMAN_TERMINAL_THEMES[e.target.value] || {}).name || e.target.value;
              if (window.showToast) window.showToast(`Terminal theme set to ${themeName}`, 'success');
            };
          }

          const applyWall = (url) => {
            const desktopEnv = document.getElementById('desktop');
            const ws = document.getElementById('desktopWorkspace');
            if (desktopEnv) {
              desktopEnv.style.backgroundImage = `linear-gradient(180deg, rgba(8, 12, 20, 0.42) 0%, rgba(6, 9, 15, 0.65) 100%), url("${url}")`;
              desktopEnv.style.backgroundSize = 'cover';
              desktopEnv.style.backgroundPosition = 'center center';
              desktopEnv.style.backgroundRepeat = 'no-repeat';
              desktopEnv.style.backgroundAttachment = 'fixed';
            }
            if (ws) {
              ws.style.background = 'transparent';
              ws.style.backgroundImage = 'none';
            }
            localStorage.setItem('shellman_wallpaper', url);
            if (window.showToast) window.showToast('Wallpaper applied', 'info');
          };

          contentPane.querySelectorAll('.wallpaper-card').forEach(c => {
            c.onclick = () => applyWall(c.dataset.url);
          });

          const applyBtn = contentPane.querySelector(`#applyWallBtn_${setWinId}`);
          const inp = contentPane.querySelector(`#customWallUrl_${setWinId}`);
          if (applyBtn && inp) {
            applyBtn.onclick = () => {
              const u = inp.value.trim();
              if (u) applyWall(u);
            };
          }

          const resetBtn = contentPane.querySelector(`#resetWallBtn_${setWinId}`);
          if (resetBtn) {
            resetBtn.onclick = () => applyWall('/static/images/wallpaper.jpg');
          }
        };

        // Render Server Health & Alerts Tab
        const renderAlertsTab = () => {
          const toastEnabled = localStorage.getItem('shellman_toast_alerts') !== 'false';
          const pushEnabled = localStorage.getItem('shellman_push_alerts') !== 'false';
          const currentCpuThresh = localStorage.getItem('shellman_alert_cpu_threshold') || '90';
          const currentRamThresh = localStorage.getItem('shellman_alert_ram_threshold') || '90';
          const currentDuration = localStorage.getItem('shellman_alert_duration_mins') || '5';
          const hasNotif = 'Notification' in window;
          const perm = hasNotif ? Notification.permission : 'unsupported';

          let permBadge = '';
          if (!hasNotif) {
            permBadge = '<span style="font-size:0.68rem; background:rgba(148,163,184,0.15); color:#94a3b8; padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">UNSUPPORTED</span>';
          } else if (perm === 'granted') {
            permBadge = '<span style="font-size:0.68rem; background:rgba(16,185,129,0.15); color:#34d399; padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">ALLOWED</span>';
          } else if (perm === 'denied') {
            permBadge = '<span style="font-size:0.68rem; background:rgba(239,68,68,0.15); color:#f87171; padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">BLOCKED</span>';
          } else {
            permBadge = '<span style="font-size:0.68rem; background:rgba(245,158,11,0.15); color:#fbbf24; padding:0.1rem 0.4rem; border-radius:4px; font-weight:600;">PROMPT REQUIRED</span>';
          }

          contentPane.innerHTML = `
            <div>
              <h3 class="settings-section-title">Server Health & Notifications</h3>
              <p class="settings-section-desc">Configure automated alerts for offline nodes and customize resource threshold triggers for CPU and RAM.</p>

              <!-- Channels Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.25rem;">Alert Notification Channels</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem;">Choose how ShellMan notifies you when a monitored server requires attention.</p>

                <div style="display:flex; flex-direction:column; gap:0.9rem;">
                  <!-- In-App Toasts -->
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:0.65rem 0.85rem; background:rgba(255,255,255,0.03); border-radius:6px; border:1px solid var(--border-color);">
                    <div>
                      <div style="font-size:0.82rem; font-weight:600; color:#f8fafc;">In-App Desktop Toast Banners</div>
                      <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Real-time glassmorphism alerts rendered directly inside the ShellMan desktop workspace.</div>
                    </div>
                    <label style="position:relative; display:inline-block; width:38px; height:20px; margin:0; cursor:pointer;">
                      <input type="checkbox" id="chkToastAlerts_${setWinId}" ${toastEnabled ? 'checked' : ''} style="opacity:0; width:0; height:0;">
                      <span id="sliderToast_${setWinId}" style="position:absolute; top:0; left:0; right:0; bottom:0; background-color:${toastEnabled ? '#0284c7' : '#334155'}; border-radius:20px; transition:.2s;"></span>
                    </label>
                  </div>

                  <!-- OS / Browser Notifications -->
                  <div style="display:flex; align-items:center; justify-content:space-between; padding:0.65rem 0.85rem; background:rgba(255,255,255,0.03); border-radius:6px; border:1px solid var(--border-color);">
                    <div>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size:0.82rem; font-weight:600; color:#f8fafc;">Browser & OS Push Notifications</span>
                        ${permBadge}
                      </div>
                      <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Native desktop push alerts via Web Notifications API / PWA when ShellMan is minimized or in background.</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                      ${hasNotif && perm !== 'granted' ? `<button class="btn btn-secondary btn-xs" id="btnRequestPerm_${setWinId}" style="font-size:0.72rem; padding:0.2rem 0.5rem;">Request Permission</button>` : ''}
                      <label style="position:relative; display:inline-block; width:38px; height:20px; margin:0; cursor:pointer;">
                        <input type="checkbox" id="chkPushAlerts_${setWinId}" ${pushEnabled ? 'checked' : ''} style="opacity:0; width:0; height:0;">
                        <span id="sliderPush_${setWinId}" style="position:absolute; top:0; left:0; right:0; bottom:0; background-color:${pushEnabled ? '#0284c7' : '#334155'}; border-radius:20px; transition:.2s;"></span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Configurable Resource Thresholds Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.25rem;">Resource Alert Thresholds</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem;">Set custom numbers for resource thresholds and sustained duration before ShellMan dispatches warnings.</p>

                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.85rem; margin-bottom:1rem;">
                  <!-- CPU Threshold -->
                  <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; padding:0.75rem;">
                    <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.4rem;">
                      CPU Alert Limit
                    </label>
                    <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.5rem;">
                      <input type="number" id="inpCpuThresh_${setWinId}" min="1" max="100" class="form-control" value="${currentCpuThresh}" style="width:75px; text-align:center; font-weight:700; font-size:0.88rem; padding:0.35rem 0.4rem;">
                      <span style="font-size:0.82rem; font-weight:600; color:#94a3b8;">%</span>
                    </div>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                      ${['60','70','80','85','90','95'].map(v => `<button type="button" class="btn btn-secondary btn-xs btn-preset-cpu" data-val="${v}" style="font-size:0.68rem; padding:0.15rem 0.4rem; ${currentCpuThresh === v ? 'border-color:#38bdf8; color:#38bdf8;' : ''}">${v}%</button>`).join('')}
                    </div>
                  </div>

                  <!-- RAM Threshold -->
                  <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; padding:0.75rem;">
                    <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.4rem;">
                      RAM Alert Limit
                    </label>
                    <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.5rem;">
                      <input type="number" id="inpRamThresh_${setWinId}" min="1" max="100" class="form-control" value="${currentRamThresh}" style="width:75px; text-align:center; font-weight:700; font-size:0.88rem; padding:0.35rem 0.4rem;">
                      <span style="font-size:0.82rem; font-weight:600; color:#94a3b8;">%</span>
                    </div>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                      ${['60','70','80','85','90','95'].map(v => `<button type="button" class="btn btn-secondary btn-xs btn-preset-ram" data-val="${v}" style="font-size:0.68rem; padding:0.15rem 0.4rem; ${currentRamThresh === v ? 'border-color:#38bdf8; color:#38bdf8;' : ''}">${v}%</button>`).join('')}
                    </div>
                  </div>

                  <!-- Duration Filter -->
                  <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:6px; padding:0.75rem;">
                    <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.4rem;">
                      Sustained Duration
                    </label>
                    <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.5rem;">
                      <input type="number" id="inpDuration_${setWinId}" min="1" max="60" class="form-control" value="${currentDuration}" style="width:75px; text-align:center; font-weight:700; font-size:0.88rem; padding:0.35rem 0.4rem;">
                      <span style="font-size:0.82rem; font-weight:600; color:#94a3b8;">mins</span>
                    </div>
                    <div style="display:flex; gap:0.25rem; flex-wrap:wrap;">
                      ${['1','2','3','5','10'].map(v => `<button type="button" class="btn btn-secondary btn-xs btn-preset-dur" data-val="${v}" style="font-size:0.68rem; padding:0.15rem 0.4rem; ${currentDuration === v ? 'border-color:#38bdf8; color:#38bdf8;' : ''}">${v}m</button>`).join('')}
                    </div>
                  </div>
                </div>

                <div style="padding:0.6rem 0.8rem; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:6px; display:flex; align-items:center; gap:0.5rem;">
                  <svg style="width:16px;height:16px;color:#f87171;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  <div style="font-size:0.72rem; color:#cbd5e1; line-height:1.4;">
                    <strong>Node Outage Detection:</strong> Always active. Alerts automatically after 3 failed consecutive polls (~15s) and sends recovery notifications when connectivity returns.
                  </div>
                </div>
              </div>

              <!-- Test Alert Card -->
              <div class="settings-card" style="display:flex; align-items:center; justify-content:space-between;">
                <div>
                  <div style="font-weight:600; font-size:0.82rem; color:#f8fafc;">Test Notification Dispatcher</div>
                  <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Trigger a mock health alert to verify both in-app toast and OS push notifications.</div>
                </div>
                <button class="btn btn-secondary btn-sm" id="btnTestAlert_${setWinId}" style="display:inline-flex; align-items:center; gap:0.4rem;">
                  <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Dispatch Test Alert
                </button>
              </div>
            </div>
          `;

          // Handlers
          const chkToast = contentPane.querySelector(`#chkToastAlerts_${setWinId}`);
          const sliderToast = contentPane.querySelector(`#sliderToast_${setWinId}`);
          if (chkToast) {
            chkToast.onchange = (e) => {
              localStorage.setItem('shellman_toast_alerts', e.target.checked ? 'true' : 'false');
              if (sliderToast) sliderToast.style.backgroundColor = e.target.checked ? '#0284c7' : '#334155';
            };
          }

          const chkPush = contentPane.querySelector(`#chkPushAlerts_${setWinId}`);
          const sliderPush = contentPane.querySelector(`#sliderPush_${setWinId}`);
          if (chkPush) {
            chkPush.onchange = (e) => {
              localStorage.setItem('shellman_push_alerts', e.target.checked ? 'true' : 'false');
              if (sliderPush) sliderPush.style.backgroundColor = e.target.checked ? '#0284c7' : '#334155';
            };
          }

          // Custom numeric inputs & presets
          const inpCpu = contentPane.querySelector(`#inpCpuThresh_${setWinId}`);
          const cpuPresets = contentPane.querySelectorAll('.btn-preset-cpu');
          const saveCpu = (val) => {
            const num = Math.min(100, Math.max(1, parseInt(val, 10) || 90));
            inpCpu.value = num;
            localStorage.setItem('shellman_alert_cpu_threshold', String(num));
            cpuPresets.forEach(b => {
              const active = b.getAttribute('data-val') === String(num);
              b.style.borderColor = active ? '#38bdf8' : '';
              b.style.color = active ? '#38bdf8' : '';
            });
            if (window.showToast) window.showToast(`CPU alert threshold set to ${num}%`, 'info');
          };
          if (inpCpu) {
            inpCpu.onchange = (e) => saveCpu(e.target.value);
            cpuPresets.forEach(b => {
              b.onclick = () => saveCpu(b.getAttribute('data-val'));
            });
          }

          const inpRam = contentPane.querySelector(`#inpRamThresh_${setWinId}`);
          const ramPresets = contentPane.querySelectorAll('.btn-preset-ram');
          const saveRam = (val) => {
            const num = Math.min(100, Math.max(1, parseInt(val, 10) || 90));
            inpRam.value = num;
            localStorage.setItem('shellman_alert_ram_threshold', String(num));
            ramPresets.forEach(b => {
              const active = b.getAttribute('data-val') === String(num);
              b.style.borderColor = active ? '#38bdf8' : '';
              b.style.color = active ? '#38bdf8' : '';
            });
            if (window.showToast) window.showToast(`RAM alert threshold set to ${num}%`, 'info');
          };
          if (inpRam) {
            inpRam.onchange = (e) => saveRam(e.target.value);
            ramPresets.forEach(b => {
              b.onclick = () => saveRam(b.getAttribute('data-val'));
            });
          }

          const inpDur = contentPane.querySelector(`#inpDuration_${setWinId}`);
          const durPresets = contentPane.querySelectorAll('.btn-preset-dur');
          const saveDur = (val) => {
            const num = Math.min(60, Math.max(1, parseInt(val, 10) || 5));
            inpDur.value = num;
            localStorage.setItem('shellman_alert_duration_mins', String(num));
            durPresets.forEach(b => {
              const active = b.getAttribute('data-val') === String(num);
              b.style.borderColor = active ? '#38bdf8' : '';
              b.style.color = active ? '#38bdf8' : '';
            });
            if (window.showToast) window.showToast(`Sustained alert duration set to ${num} minutes`, 'info');
          };
          if (inpDur) {
            inpDur.onchange = (e) => saveDur(e.target.value);
            durPresets.forEach(b => {
              b.onclick = () => saveDur(b.getAttribute('data-val'));
            });
          }

          const reqBtn = contentPane.querySelector(`#btnRequestPerm_${setWinId}`);
          if (reqBtn && hasNotif) {
            reqBtn.onclick = async () => {
              await Notification.requestPermission();
              renderAlertsTab();
            };
          }

          const testBtn = contentPane.querySelector(`#btnTestAlert_${setWinId}`);
          if (testBtn) {
            testBtn.onclick = () => {
              const cVal = inpCpu ? inpCpu.value : '90';
              const rVal = inpRam ? inpRam.value : '90';
              if (window.ServerHealthAlerts) {
                window.ServerHealthAlerts.triggerAlert('Test Server Alert', `Host "production-server" CPU utilization sustained at ${cVal}% and RAM at ${rVal}%.`, 'danger');
              } else if (window.showToast) {
                window.showToast(`Test Health Alert: Host "production-server" CPU sustained at ${cVal}%`, 'danger');
              }
            };
          }
        };

        // Render Backup & Export Tab
        const renderBackupTab = () => {
          contentPane.innerHTML = `
            <div>
              <h3 class="settings-section-title">Configuration Backup & Migration</h3>
              <p class="settings-section-desc">Export or import custom automation actions, server nodes, and visual UI preferences in a unified JSON document.</p>

              <!-- Export Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.25rem;">Export ShellMan Archive</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem; line-height:1.4;">
                  Packages all registered server hosts, custom action scripts, and desktop appearance preferences into a portable JSON document.<br>
                  <span style="color:#fbbf24; font-weight:600;">Security Notice:</span> Master passwords and SSH private keys are sanitized from the export. You can safely transfer this file across machines.
                </p>
                <div>
                  <button class="btn btn-primary btn-sm" id="btnExportConfig_${setWinId}" style="display:inline-flex; align-items:center; gap:0.4rem;">
                    <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Export Settings Archive (.json)
                  </button>
                </div>
              </div>

              <!-- Import Card -->
              <div class="settings-card">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.25rem;">Import Configuration Archive</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem; line-height:1.4;">
                  Restore server nodes, custom actions, and desktop preferences from a previously exported <code style="color:#38bdf8;">shellman_backup_*.json</code> file. Existing nodes and actions will be merged seamlessly.
                </p>

                <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:440px;">
                  <div>
                    <input type="file" id="inpImportConfig_${setWinId}" accept=".json,application/json" class="form-control" style="font-size:0.8rem; padding:0.4rem;">
                  </div>

                  <div id="importStatusBox_${setWinId}" style="display:none; padding:0.45rem 0.75rem; border-radius:4px; font-size:0.75rem;"></div>

                  <div>
                    <button class="btn btn-secondary btn-sm" id="btnImportConfig_${setWinId}" style="display:inline-flex; align-items:center; gap:0.4rem;">
                      <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      Import and Restore Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;

          // Export handler
          const expBtn = contentPane.querySelector(`#btnExportConfig_${setWinId}`);
          if (expBtn) {
            expBtn.onclick = async () => {
              expBtn.disabled = true;
              expBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Exporting...`;
              try {
                const prefs = {
                  shellman_theme: localStorage.getItem('shellman_theme') || 'dark',
                  shellman_wallpaper: localStorage.getItem('shellman_wallpaper') || '',
                  shellman_font_size: localStorage.getItem('shellman_font_size') || '16',
                  shellman_font_family: localStorage.getItem('shellman_font_family') || '',
                  shellman_toast_alerts: localStorage.getItem('shellman_toast_alerts') || 'true',
                  shellman_push_alerts: localStorage.getItem('shellman_push_alerts') || 'true',
                  shellman_ip_revealed: localStorage.getItem('shellman_ip_revealed') || 'false'
                };
                const resp = await fetch('/api/settings/export', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ preferences: prefs })
                });
                const res = await resp.json();
                if (res.success && res.data) {
                  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = res.filename || 'shellman_backup.json';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                  if (window.showToast) window.showToast('Configuration archive exported successfully!', 'success');
                } else {
                  DesktopModal.alert({ title: 'Export Failed', message: res.error || 'Failed to export configuration archive.', type: 'danger' });
                }
              } catch (e) {
                DesktopModal.alert({ title: 'Export Error', message: String(e), type: 'danger' });
              } finally {
                expBtn.disabled = false;
                expBtn.innerHTML = `
                  <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export Settings Archive (.json)
                `;
              }
            };
          }

          // Import handler
          const impBtn = contentPane.querySelector(`#btnImportConfig_${setWinId}`);
          const fileInp = contentPane.querySelector(`#inpImportConfig_${setWinId}`);
          const statusBox = contentPane.querySelector(`#importStatusBox_${setWinId}`);

          if (impBtn && fileInp) {
            impBtn.onclick = async () => {
              const file = fileInp.files && fileInp.files[0];
              if (!file) {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(239,68,68,0.12)';
                statusBox.style.color = '#f87171';
                statusBox.textContent = 'Please choose a .json backup file first.';
                return;
              }

              impBtn.disabled = true;
              impBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Restoring...`;
              statusBox.style.display = 'none';

              try {
                const text = await file.text();
                const jsonPayload = JSON.parse(text);

                const resp = await fetch('/api/settings/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(jsonPayload)
                });
                const res = await resp.json();
                if (res.success) {
                  statusBox.style.display = 'block';
                  statusBox.style.background = 'rgba(16,185,129,0.12)';
                  statusBox.style.color = '#34d399';
                  statusBox.textContent = '✓ ' + (res.message || 'Configuration restored successfully!');

                  // Restore UI preferences
                  if (res.preferences && typeof res.preferences === 'object') {
                    for (const [k, v] of Object.entries(res.preferences)) {
                      if (v !== undefined && v !== null) {
                        localStorage.setItem(k, v);
                      }
                    }
                    if (res.preferences.shellman_wallpaper) {
                      const ws = document.getElementById('desktopWorkspace');
                      if (ws) ws.style.backgroundImage = `url('${res.preferences.shellman_wallpaper}')`;
                    }
                  }

                  if (window.showToast) window.showToast('Settings restored successfully!', 'success');
                  loadServers();
                } else {
                  statusBox.style.display = 'block';
                  statusBox.style.background = 'rgba(239,68,68,0.12)';
                  statusBox.style.color = '#f87171';
                  statusBox.textContent = res.error || 'Failed to restore configuration.';
                }
              } catch (e) {
                statusBox.style.display = 'block';
                statusBox.style.background = 'rgba(239,68,68,0.12)';
                statusBox.style.color = '#f87171';
                statusBox.textContent = 'Invalid file or parsing error: ' + e;
              } finally {
                impBtn.disabled = false;
                impBtn.innerHTML = `
                  <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Import and Restore Settings
                `;
              }
            };
          }
        };

        // Render About Tab
        const renderAboutTab = () => {
          contentPane.innerHTML = `
            <div>
              <div class="settings-card" style="text-align:center; padding:2.5rem 1.5rem; margin-bottom:1.25rem;">
                <div style="width:72px; height:72px; margin:0 auto 1rem; filter: drop-shadow(0 10px 24px rgba(14, 165, 233, 0.45));">
                  <img src="/static/images/logo.png" alt="ShellMan Logo" style="width:100%; height:100%; object-fit:contain;">
                </div>
                <h2 style="font-size:1.4rem; font-weight:800; color:#f8fafc; margin-bottom:0.25rem; letter-spacing:0.04em;">SHELLMAN OS</h2>
                <div style="font-size:0.75rem; font-family:var(--font-mono); color:#38bdf8; margin-bottom:0.75rem;">Version 1.0.0 Production Release</div>
                <p style="font-size:0.8rem; color:var(--text-secondary); max-width:480px; margin:0 auto; line-height:1.5;">
                  Modern, agentless, high-performance Linux remote infrastructure desktop environment.
                </p>
              </div>

              <div class="settings-card">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.75rem;">Architecture Specs</div>
                <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.78rem;">
                  <div style="display:flex; justify-content:space-between; padding-bottom:0.35rem; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="color:var(--text-muted);">Managed VPS Overhead</span>
                    <span style="font-weight:600; color:#10b981;">0 MB Permanent RAM (Agentless)</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; padding-bottom:0.35rem; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="color:var(--text-muted);">Terminal Emulation</span>
                    <span style="font-family:var(--font-mono); color:#cbd5e1;">xterm.js + WebSocket PTY</span>
                  </div>
                  <div style="display:flex; justify-content:space-between; padding-bottom:0.35rem; border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="color:var(--text-muted);">File Transport</span>
                    <span style="font-family:var(--font-mono); color:#cbd5e1;">SFTP over SSH-2.0</span>
                  </div>
                  <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--text-muted);">Monaco IDE</span>
                    <span style="font-family:var(--font-mono); color:#cbd5e1;">VS Code Engine (v0.34.0)</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        };

        // Render Desktop App (PWA) Tab
        const renderPwaTab = () => {
          const isStandalone = window.PwaManager ? window.PwaManager.isStandalone : false;
          contentPane.innerHTML = `
            <div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem;">
                <div>
                  <h3 class="settings-section-title">Desktop Application (PWA)</h3>
                  <p class="settings-section-desc">Download and install ShellMan as a standalone desktop app with native windowing and offline shell.</p>
                </div>
                <div>
                  <span class="pwa-badge ${isStandalone ? 'online' : 'ready'}">
                    ${isStandalone ? '● STANDALONE APP' : '● READY TO INSTALL'}
                  </span>
                </div>
              </div>

              <!-- Main Install Card -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
                  <div style="display:flex; align-items:center; gap:1rem;">
                    <div style="width:48px; height:48px; border-radius:12px; background:linear-gradient(135deg, #0ea5e9, #6366f1); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </div>
                    <div>
                      <div style="font-weight:700; font-size:0.95rem; color:#f8fafc;">ShellMan Desktop PWA</div>
                      <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                        ${isStandalone ? 'Currently running inside dedicated native application window.' : 'Install to desktop or dock for single-click launch without browser tabs.'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <button class="btn btn-primary" id="pwaTabInstallBtn_${setWinId}" style="display:inline-flex; align-items:center; gap:0.5rem; font-weight:600;">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                      <span>${isStandalone ? 'Installed (Run Standalone)' : 'Install ShellMan to Desktop'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- PWA Benefits Grid -->
              <div class="settings-card" style="margin-bottom:1.25rem;">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.75rem;">Native Desktop Features</div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.75rem;">
                  <div class="pwa-feature-item">
                    <div class="pwa-feature-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>
                    </div>
                    <div>
                      <div style="font-weight:600; color:#f8fafc; font-size:0.8rem;">Dedicated Window</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">Runs in a clean, chromeless native window without browser address bars.</div>
                    </div>
                  </div>
                  <div class="pwa-feature-item">
                    <div class="pwa-feature-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                    </div>
                    <div>
                      <div style="font-weight:600; color:#f8fafc; font-size:0.8rem;">Instant Launch & Caching</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">Pre-cached assets and service worker boot the desktop instantaneously.</div>
                    </div>
                  </div>
                  <div class="pwa-feature-item">
                    <div class="pwa-feature-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h8M6 16h12"></path></svg>
                    </div>
                    <div>
                      <div style="font-weight:600; color:#f8fafc; font-size:0.8rem;">Global OS Shortcuts</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">Use Ctrl+K, Alt+Tab, and Ctrl+W without browser hotkey interference.</div>
                    </div>
                  </div>
                  <div class="pwa-feature-item">
                    <div class="pwa-feature-icon">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                    </div>
                    <div>
                      <div style="font-weight:600; color:#f8fafc; font-size:0.8rem;">App Launcher Shortcuts</div>
                      <div style="font-size:0.72rem; color:var(--text-muted);">Direct dock shortcuts to SSH Terminal, SFTP Files, and Code IDE.</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Manual Installation Guide Card -->
              <div class="settings-card">
                <div style="font-weight:700; font-size:0.85rem; color:#f8fafc; margin-bottom:0.35rem;">Installation Instructions by Browser</div>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.75rem;">If the automatic install button is not supported by your browser, follow these steps:</p>
                <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.75rem; color:var(--text-secondary);">
                  <div>&bull; <strong>Chrome / Brave / Edge:</strong> Click the install icon in the URL bar (top right) or browser Menu &rarr; "Install ShellMan...".</div>
                  <div>&bull; <strong>Safari (macOS Sonoma+):</strong> Click "File" menu &rarr; "Add to Dock...".</div>
                  <div>&bull; <strong>iPhone / iPad Safari:</strong> Tap Share button &rarr; "Add to Home Screen".</div>
                  <div>&bull; <strong>Android Chrome:</strong> Tap three dots &rarr; "Install app" or "Add to Home screen".</div>
                </div>
              </div>
            </div>
          `;

          const installBtn = contentPane.querySelector(`#pwaTabInstallBtn_${setWinId}`);
          if (installBtn) {
            installBtn.onclick = () => {
              if (window.PwaManager) {
                window.PwaManager.promptInstall();
              }
            };
          }
        };

        const renderTab = (tab) => {
          currentTab = tab;
          bodyEl.querySelectorAll('.settings-nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
          });
          if (tab === 'servers') renderServersTab();
          else if (tab === 'admin') renderAdminTab();
          else if (tab === 'appearance') renderAppearanceTab();
          else if (tab === 'alerts') renderAlertsTab();
          else if (tab === 'backup') renderBackupTab();
          else if (tab === 'about') renderAboutTab();
          else if (tab === 'pwa') renderPwaTab();
        };

        // Tab click listeners
        bodyEl.querySelectorAll('.settings-nav-item').forEach(item => {
          item.onclick = () => renderTab(item.dataset.tab);
        });

        winObj._switchTab = (tab) => renderTab(tab);

        // Initial tab render
        renderTab(currentTab);
      }
    });
};


DesktopAppsController.prototype.launchServers = function (params = {}) {
    return this.launchSettings({ tab: 'servers' });
};

