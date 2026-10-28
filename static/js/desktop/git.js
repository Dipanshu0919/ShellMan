/**
 * ShellMan OS: Git Deployments & Webhook Manager (git.js)
 */

DesktopAppsController.prototype.launchGit = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('git');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      return existing;
    }

    const gitWinId = 'git_' + Date.now();
    let deploymentsList = [];
    let editingDep = null;

    const fetch = RequestScope.next(); // requests of this window are cancelled when it closes
    return WindowManager.createWindow({
      appId: 'git',
      multiInstance: false,
      title: `Git Deployment Manager - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="18" cy="18" r="3" stroke="#f43f5e" stroke-width="2"/><circle cx="6" cy="6" r="3" stroke="#f43f5e" stroke-width="2"/><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12" stroke="#f43f5e" stroke-width="2"/></svg>',
      width: 980,
      height: 620,
      minWidth: 720,
      minHeight: 460,
      contentHtml: `
        <div style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); color:var(--text-primary); font-family:var(--font-sans); position:relative; overflow:hidden;">
          <!-- Top Bar -->
          <div style="height:38px; background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); padding:0 0.75rem; display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <input type="text" id="gitSearchInp_${gitWinId}" placeholder="Filter repositories..." class="form-control" style="width:180px; padding:0.25rem 0.5rem; font-size:0.75rem;">
              <span id="gitDepCount_${gitWinId}" class="badge badge-warning" style="font-size:0.7rem; padding:0.18rem 0.45rem;">0 Repos</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-primary btn-xs" id="btnLinkRepo_${gitWinId}" style="display:inline-flex; align-items:center; gap:0.3rem;">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Link Repository
              </button>
              <button class="btn btn-secondary btn-xs" id="btnRefreshGit_${gitWinId}" style="display:inline-flex; align-items:center; gap:0.3rem;">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Refresh
              </button>
            </div>
          </div>

          <!-- Main Content -->
          <div style="flex:1; overflow-y:auto; padding:1rem;" id="gitContentArea_${gitWinId}">
            <div style="text-align:center; padding:3rem; color:var(--text-muted);">Loading linked repositories...</div>
          </div>

          <!-- Modal for Link/Edit Repo -->
          <div id="gitModal_${gitWinId}" style="display:none; position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(var(--shade),0.65); backdrop-filter:blur(3px); z-index:100; align-items:center; justify-content:center; padding:1.5rem;">
            <div style="width:100%; max-width:540px; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:10px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5); display:flex; flex-direction:column; overflow:hidden;">
              <div style="padding:0.85rem 1.25rem; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <span id="gitModalTitle_${gitWinId}" style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">Link Git Repository</span>
                <button class="btn btn-secondary btn-xs" id="btnCancelGitModal_${gitWinId}">&times;</button>
              </div>
              <div style="padding:1.25rem; display:flex; flex-direction:column; gap:0.85rem;">
                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">Project Identifier</label>
                  <input type="text" id="gitNameInp_${gitWinId}" class="form-control" style="width:100%; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="e.g. Production Web Service">
                </div>

                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">Repository Clone URL</label>
                  <input type="text" id="gitRepoInp_${gitWinId}" class="form-control" spellcheck="false" autocomplete="off" autocapitalize="off" style="width:100%; font-family:monospace; font-variant-ligatures:none; font-feature-settings:'liga' 0, 'calt' 0; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="https://github.com/owner/repository.git">
                </div>

                <div style="display:grid; grid-template-columns:2fr 1fr; gap:0.75rem;">
                  <div>
                    <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">Target Server Directory</label>
                    <div style="display:flex; gap:0.4rem;">
                      <input type="text" id="gitPathInp_${gitWinId}" class="form-control" spellcheck="false" autocomplete="off" autocapitalize="off" style="flex:1; font-family:monospace; font-variant-ligatures:none; font-feature-settings:'liga' 0, 'calt' 0; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="/home/user/my-app">
                      <button type="button" class="btn btn-secondary btn-xs" id="btnBrowseGitPath_${gitWinId}" style="display:inline-flex; align-items:center; gap:0.3rem; padding:0 0.65rem;" title="Browse Server Folders">
                        <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        Browse...
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">Branch</label>
                    <input type="text" id="gitBranchInp_${gitWinId}" value="main" class="form-control" spellcheck="false" autocomplete="off" autocapitalize="off" style="width:100%; font-family:monospace; font-variant-ligatures:none; font-feature-settings:'liga' 0, 'calt' 0; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="main">
                  </div>
                </div>

                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">Post-Deployment Command (Optional)</label>
                  <input type="text" id="gitPostCmdInp_${gitWinId}" class="form-control" spellcheck="false" autocomplete="off" autocapitalize="off" style="width:100%; font-family:monospace; font-variant-ligatures:none; font-feature-settings:'liga' 0, 'calt' 0; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="npm install && npm run build">
                  <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem;">Executed automatically in target directory after git pull completes successfully.</div>
                </div>

                <div id="gitCloneOptBox_${gitWinId}" style="display:flex; align-items:center; gap:0.5rem; background:rgba(var(--wash),0.02); padding:0.5rem 0.75rem; border-radius:6px; border:1px solid var(--border-color);">
                  <input type="checkbox" id="gitCloneNowInp_${gitWinId}">
                  <label for="gitCloneNowInp_${gitWinId}" style="font-size:0.75rem; color:var(--text-secondary); cursor:pointer;">
                    Clone repository immediately into target folder if not already cloned
                  </label>
                </div>
              </div>
              <div style="padding:0.75rem 1.25rem; border-top:1px solid var(--border-subtle); background:rgba(var(--shade),0.2); display:flex; justify-content:flex-end; gap:0.5rem;">
                <button class="btn btn-secondary btn-sm" id="btnGitModalClose_${gitWinId}">Cancel</button>
                <button class="btn btn-primary btn-sm" id="btnGitModalSave_${gitWinId}">Save Repository Link</button>
              </div>
            </div>
          </div>
        </div>
      `,
      onInit: (bodyEl) => {
        const contentArea = bodyEl.querySelector(`#gitContentArea_${gitWinId}`);
        const countBadge = bodyEl.querySelector(`#gitDepCount_${gitWinId}`);
        const modal = bodyEl.querySelector(`#gitModal_${gitWinId}`);
        const modalTitle = bodyEl.querySelector(`#gitModalTitle_${gitWinId}`);
        const nameInp = bodyEl.querySelector(`#gitNameInp_${gitWinId}`);
        const repoInp = bodyEl.querySelector(`#gitRepoInp_${gitWinId}`);
        const pathInp = bodyEl.querySelector(`#gitPathInp_${gitWinId}`);
        const branchInp = bodyEl.querySelector(`#gitBranchInp_${gitWinId}`);
        const postCmdInp = bodyEl.querySelector(`#gitPostCmdInp_${gitWinId}`);
        const cloneNowInp = bodyEl.querySelector(`#gitCloneNowInp_${gitWinId}`);
        const cloneOptBox = bodyEl.querySelector(`#gitCloneOptBox_${gitWinId}`);
        const linkBtn = bodyEl.querySelector(`#btnLinkRepo_${gitWinId}`);
        const refreshBtn = bodyEl.querySelector(`#btnRefreshGit_${gitWinId}`);
        const cancelBtn = bodyEl.querySelector(`#btnCancelGitModal_${gitWinId}`);
        const closeBtn = bodyEl.querySelector(`#btnGitModalClose_${gitWinId}`);
        const saveBtn = bodyEl.querySelector(`#btnGitModalSave_${gitWinId}`);

        const loadDeployments = async () => {
          contentArea.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted);"><span class="spinner-border spinner-border-sm" style="width:14px;height:14px;"></span> Loading repositories...</div>`;
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/git/list`);
            const res = await resp.json();
            if (res.success) {
              deploymentsList = res.deployments || [];
              countBadge.textContent = `${deploymentsList.length} REPOS`;
              renderDeploymentsList();
            } else {
              contentArea.innerHTML = `<div class="alert alert-danger" style="margin:1rem;">Failed to load git repositories: ${res.error || 'Unknown error'}</div>`;
            }
          } catch (e) {
            contentArea.innerHTML = `<div class="alert alert-danger" style="margin:1rem;">Network error loading git repos: ${e}</div>`;
          }
        };

        const renderDeploymentsList = (filterQuery = '') => {
          const filtered = filterQuery
            ? deploymentsList.filter(d => d.name.toLowerCase().includes(filterQuery) || d.target_path.toLowerCase().includes(filterQuery) || d.repo_url.toLowerCase().includes(filterQuery) || d.branch.toLowerCase().includes(filterQuery))
            : deploymentsList;

          if (deploymentsList.length === 0) {
            contentArea.innerHTML = `
              <div style="text-align:center; padding:4rem 1.5rem; background:rgba(var(--wash),0.02); border:1px solid var(--border-color); border-radius:8px;">
                <svg style="width:36px;height:36px;color:var(--text-muted);margin-bottom:0.75rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"></path></svg>
                <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary); margin-bottom:0.35rem;">No Git Deployments Configured</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem;">Link a GitHub or GitLab repository to automate code deployments on this server.</div>
                <button class="btn btn-primary btn-sm" id="btnEmptyLink_${gitWinId}">Link Your First Repository</button>
              </div>
            `;
            const emptyLink = contentArea.querySelector(`#btnEmptyLink_${gitWinId}`);
            if (emptyLink) emptyLink.onclick = () => openModal(null);
            return;
          }

          if (filtered.length === 0) {
            contentArea.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted); font-size:0.82rem;">No repositories match "${filterQuery}".</div>`;
            return;
          }

          contentArea.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.9rem;">
              ${filtered.map(d => `
                <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; padding:1rem; display:flex; flex-direction:column; gap:0.75rem;">
                  <!-- Header row -->
                  <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                      <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${d.name}</span>
                      <span style="font-size:0.68rem; background:rgba(244,63,94,0.12); color:var(--c-rose); border:1px solid rgba(244,63,94,0.3); padding:0.1rem 0.45rem; border-radius:4px; font-weight:700; font-family:monospace;">${d.branch}</span>
                      <span style="font-size:0.65rem; padding:0.1rem 0.4rem; border-radius:3px; font-weight:700; ${d.last_status === 'success' ? 'background:rgba(16,185,129,0.15); color:var(--c-ok);' : d.last_status === 'failed' ? 'background:rgba(239,68,68,0.15); color:var(--c-bad);' : 'background:rgba(148,163,184,0.15); color:var(--text-muted);'}">
                        ${(d.last_status || 'PENDING').toUpperCase()}
                      </span>
                    </div>

                    <div style="display:flex; align-items:center; gap:0.4rem;">
                      <button class="btn btn-primary btn-xs btn-pull-latest" data-id="${d.id}" style="display:inline-flex; align-items:center; gap:0.3rem;">
                        <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Pull Latest
                      </button>
                      <button class="btn btn-secondary btn-xs btn-inspect-repo" data-path="${encodeURIComponent(d.target_path)}">
                        Inspect
                      </button>
                      <button class="btn btn-secondary btn-xs btn-edit-dep" data-id="${d.id}">
                        Edit
                      </button>
                      <button class="btn btn-danger btn-xs btn-del-dep" data-id="${d.id}">
                        Delete
                      </button>
                    </div>
                  </div>

                  <!-- Details row -->
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; font-size:0.75rem; color:var(--text-muted); background:rgba(var(--shade),0.2); padding:0.6rem 0.8rem; border-radius:6px;">
                    <div>Directory: <code style="color:var(--text-secondary); font-family:monospace;">${d.target_path}</code></div>
                    <div>Repository: <code style="color:var(--text-secondary); font-family:monospace;">${d.repo_url}</code></div>
                    ${d.post_deploy_cmd ? `<div style="grid-column:1 / -1;">Post-Deploy: <code style="color:var(--sm-accent); font-family:monospace;">${d.post_deploy_cmd}</code></div>` : ''}
                    ${d.last_deployed_at ? `<div style="grid-column:1 / -1; font-size:0.7rem; color:var(--text-muted);">Last Deployed: ${d.last_deployed_at}</div>` : ''}
                  </div>

                  <!-- Webhook URL Box -->
                  <div style="display:flex; align-items:center; justify-content:space-between; background:color-mix(in srgb, var(--sm-accent) 6%, transparent); border:1px solid color-mix(in srgb, var(--sm-accent) 20%, transparent); border-radius:6px; padding:0.4rem 0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.4rem; min-width:0; flex:1;">
                      <span style="font-size:0.7rem; font-weight:700; color:var(--sm-accent);">WEBHOOK:</span>
                      <code style="font-size:0.72rem; color:var(--text-secondary); font-family:monospace; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${window.location.origin}${d.webhook_url}</code>
                    </div>
                    <button class="btn btn-secondary btn-xs btn-copy-hook" data-url="${window.location.origin}${d.webhook_url}" style="font-size:0.7rem; padding:0.15rem 0.45rem;">
                      Copy URL
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `;

          // Pull Latest handler
          contentArea.querySelectorAll('.btn-pull-latest').forEach(b => {
            b.onclick = async () => {
              const id = b.dataset.id;
              b.disabled = true;
              b.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;"></span> Pulling...`;
              try {
                if (window.ShellmanFX) window.ShellmanFX.transfer(this.serverId, 'deploy', 'out', 'start');
                const resp = await fetch(`/api/servers/${this.serverId}/git/pull`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id })
                });
                const res = await resp.json();
                if (window.ShellmanFX) window.ShellmanFX.transfer(this.serverId, 'deploy', 'out', 'end');
                if (res.success) {
                  if (window.showToast) window.showToast('Git deployment pulled successfully!', 'success');
                  if (res.log && res.log.trim()) {
                    DesktopModal.showOutput({
                      title: 'Git Deployment Pulled',
                      subtitle: `Target: ${b.closest('div').parentElement.querySelector('code')?.textContent || ''}`,
                      output: res.log,
                      exitCode: 0,
                      isSuccess: true
                    });
                  }
                } else {
                  DesktopModal.showOutput({
                    title: 'Git Deployment Failed',
                    subtitle: `Exit Code ${res.exit_code}`,
                    output: res.log || res.error || 'Pull failed.',
                    exitCode: res.exit_code,
                    isSuccess: false
                  });
                }
                loadDeployments();
              } catch (e) {
                if (window.ShellmanFX) window.ShellmanFX.transfer(this.serverId, 'deploy', 'out', 'end');
                if (window.showToast) window.showToast('Pull error: ' + e, 'danger');
                else DesktopModal.alert({ title: 'Pull Error', message: String(e), type: 'danger' });
              } finally {
                b.disabled = false;
                b.innerHTML = `
                  <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Pull Latest
                `;
              }
            };
          });

          // Inspect repo handler
          contentArea.querySelectorAll('.btn-inspect-repo').forEach(b => {
            b.onclick = async () => {
              const target_path = decodeURIComponent(b.dataset.path);
              b.disabled = true;
              b.textContent = 'Inspecting...';
              try {
                const resp = await fetch(`/api/servers/${this.serverId}/git/inspect`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ target_path })
                });
                const res = await resp.json();
                if (res.success && res.is_git_repo) {
                  const c = res.last_commit || {};
                  const info = [
                    `Target Path:   ${target_path}`,
                    `Remote URL:    ${res.remote_url || 'N/A'}`,
                    `Active Branch: ${res.branch}`,
                    `Clean Tree:    ${res.is_clean ? 'Yes (Clean)' : 'No (Uncommitted Changes)'}`,
                    '',
                    'Latest Commit:',
                    `  Hash:    ${c.hash || 'N/A'}`,
                    `  Author:  ${c.author || 'N/A'}`,
                    `  Date:    ${c.relative_time || 'N/A'}`,
                    `  Message: ${c.message || 'N/A'}`,
                    '',
                    'Branch Status:',
                    res.status_summary || 'Working tree clean. Nothing to commit.'
                  ].join('\n');

                  DesktopModal.showOutput({
                    title: 'Git Repository Status',
                    subtitle: target_path,
                    output: info,
                    isSuccess: true
                  });
                } else {
                  DesktopModal.alert({
                    title: 'Git Repository Notice',
                    message: res.message || `Directory "${target_path}" is not an initialized Git repository.`,
                    type: 'info'
                  });
                }
              } catch (e) {
                if (window.showToast) window.showToast('Inspect error: ' + e, 'danger');
                else DesktopModal.alert({ title: 'Inspect Error', message: String(e), type: 'danger' });
              } finally {
                b.disabled = false;
                b.textContent = 'Inspect';
              }
            };
          });

          // Copy webhook URL
          contentArea.querySelectorAll('.btn-copy-hook').forEach(b => {
            b.onclick = () => {
              navigator.clipboard.writeText(b.dataset.url);
              if (window.showToast) window.showToast('Webhook URL copied to clipboard', 'info');
            };
          });

          // Edit handler
          contentArea.querySelectorAll('.btn-edit-dep').forEach(b => {
            b.onclick = () => {
              const id = parseInt(b.dataset.id, 10);
              const dep = deploymentsList.find(d => d.id === id);
              if (dep) openModal(dep);
            };
          });

          // Delete handler
          contentArea.querySelectorAll('.btn-del-dep').forEach(b => {
            b.onclick = async () => {
              const ok = await DesktopModal.confirm({
                title: 'Remove Git Deployment',
                message: 'Are you sure you want to remove this Git deployment project?',
                confirmText: 'Remove',
                isDanger: true
              });
              if (ok) {
                const id = b.dataset.id;
                try {
                  await fetch(`/api/servers/${this.serverId}/git/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                  });
                  if (window.showToast) window.showToast('Git deployment removed', 'info');
                  loadDeployments();
                } catch (e) {
                  DesktopModal.alert({ title: 'Delete Error', message: String(e), type: 'danger' });
                }
              }
            };
          });
        };

        const openModal = (dep) => {
          editingDep = dep;
          modal.style.display = 'flex';
          if (dep) {
            modalTitle.textContent = 'Edit Deployment Configuration';
            nameInp.value = dep.name;
            repoInp.value = dep.repo_url;
            pathInp.value = dep.target_path;
            branchInp.value = dep.branch;
            postCmdInp.value = dep.post_deploy_cmd;
            cloneOptBox.style.display = 'none';
          } else {
            modalTitle.textContent = 'Link New Git Repository';
            nameInp.value = '';
            repoInp.value = '';
            pathInp.value = '/home/';
            branchInp.value = 'main';
            postCmdInp.value = '';
            cloneNowInp.checked = true;
            cloneOptBox.style.display = 'flex';
          }
        };

        const closeModal = () => {
          modal.style.display = 'none';
          editingDep = null;
        };

        linkBtn.onclick = () => openModal(null);
        refreshBtn.onclick = () => loadDeployments();
        cancelBtn.onclick = closeModal;
        closeBtn.onclick = closeModal;

        const btnBrowseGit = modal.querySelector(`#btnBrowseGitPath_${gitWinId}`);
        if (btnBrowseGit) {
          btnBrowseGit.onclick = () => {
            this.showDirectoryPicker({
              serverId: this.serverId,
              initialPath: pathInp.value.trim() || '/home/',
              title: 'Select Deployment Target Folder',
              onSelect: (selectedPath) => {
                pathInp.value = selectedPath;
              }
            });
          };
        }

        const gitSearchInp = bodyEl.querySelector(`#gitSearchInp_${gitWinId}`);
        if (gitSearchInp) {
          gitSearchInp.oninput = (e) => {
            renderDeploymentsList(e.target.value.toLowerCase().trim());
          };
        }

        saveBtn.onclick = async () => {
          const name = nameInp.value.trim();
          let repo_url = repoInp.value.trim();
          if (repo_url && !repo_url.includes('://') && !repo_url.startsWith('git@')) {
            repo_url = 'https://' + repo_url;
            repoInp.value = repo_url;
          }
          const target_path = pathInp.value.trim();
          const branch = branchInp.value.trim();
          const post_deploy_cmd = postCmdInp.value.trim();
          const shouldClone = cloneNowInp.checked && !editingDep;

          if (!name || !repo_url || !target_path) {
            if (window.showToast) window.showToast('Project name, repository URL, and target directory are required.', 'warning');
            else DesktopModal.alert({ title: 'Validation Error', message: 'Project name, repository URL, and target directory are required.', type: 'warning' });
            return;
          }

          saveBtn.disabled = true;
          saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Saving...`;

          try {
            // Optional clone first if checked
            if (shouldClone) {
              const cResp = await fetch(`/api/servers/${this.serverId}/git/clone`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_url, target_path, branch })
              });
              const cRes = await cResp.json();
              if (!cRes.success) {
                DesktopModal.showOutput({
                  title: 'Git Clone Failed',
                  subtitle: target_path,
                  output: cRes.log || cRes.error || 'Clone failed.',
                  exitCode: cRes.exit_code,
                  isSuccess: false
                });
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Repository Link';
                return;
              }
            }

            const resp = await fetch(`/api/servers/${this.serverId}/git/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: editingDep ? editingDep.id : null,
                name,
                repo_url,
                target_path,
                branch,
                post_deploy_cmd
              })
            });
            const res = await resp.json();
            if (res.success) {
              if (window.showToast) window.showToast('Git deployment linked successfully!', 'success');
              closeModal();
              loadDeployments();
            } else {
              DesktopModal.alert({ title: 'Save Failed', message: res.error || 'Unknown error saving deployment.', type: 'danger' });
            }
          } catch (e) {
            DesktopModal.alert({ title: 'Save Error', message: String(e), type: 'danger' });
          } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Repository Link';
          }
        };

        loadDeployments();
      }
    });
};