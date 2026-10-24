/**
 * ShellMan OS: Visual Cron Job Scheduler (cron.js)
 */

DesktopAppsController.prototype.launchCron = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('cron');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      return existing;
    }

    const cronWinId = 'cron_' + Date.now();
    let jobsList = [];
    let editingJob = null;

    return WindowManager.createWindow({
      appId: 'cron',
      multiInstance: false,
      title: `Cron Job Manager (Scheduler) - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#f59e0b" stroke-width="2"/><polyline points="12 6 12 12 16 14" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>',
      width: 980,
      height: 600,
      minWidth: 720,
      minHeight: 440,
      contentHtml: `
        <div style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); color:var(--text-primary); font-family:var(--font-sans); position:relative; overflow:hidden;">
          <!-- Top Bar -->
          <div style="height:38px; background:var(--bg-surface); border-bottom:1px solid var(--border-subtle); padding:0 0.75rem; display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <input type="text" id="cronSearchInp_${cronWinId}" placeholder="Filter cron jobs..." class="form-control" style="width:190px; padding:0.25rem 0.5rem; font-size:0.75rem;">
              <span id="cronJobCount_${cronWinId}" class="badge badge-warning" style="font-size:0.7rem; padding:0.18rem 0.45rem;">0 Jobs</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-primary btn-xs" id="btnAddJob_${cronWinId}" style="display:inline-flex; align-items:center; gap:0.3rem;">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                New Cron Job
              </button>
              <button class="btn btn-secondary btn-xs" id="btnRefreshCron_${cronWinId}" style="display:inline-flex; align-items:center; gap:0.3rem;">
                <svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                Reload
              </button>
            </div>
          </div>

          <!-- Main Content -->
          <div style="flex:1; overflow-y:auto; padding:1rem;" id="cronContentArea_${cronWinId}">
            <div style="text-align:center; padding:3rem; color:var(--text-muted);">Loading scheduled crontab jobs...</div>
          </div>

          <!-- Modal for Add/Edit -->
          <div id="cronModal_${cronWinId}" style="display:none; position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(3px); z-index:100; align-items:center; justify-content:center; padding:1.5rem;">
            <div style="width:100%; max-width:540px; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:10px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5); display:flex; flex-direction:column; overflow:hidden;">
              <div style="padding:0.85rem 1.25rem; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
                <span id="cronModalTitle_${cronWinId}" style="font-weight:700; font-size:0.9rem; color:#f8fafc;">Add Scheduled Job</span>
                <button class="btn btn-secondary btn-xs" id="btnCancelModal_${cronWinId}">&times;</button>
              </div>
              <div style="padding:1.25rem; display:flex; flex-direction:column; gap:0.9rem;">
                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.35rem;">Schedule Preset</label>
                  <select id="cronPresetSel_${cronWinId}" class="form-control" style="width:100%; font-size:0.8rem; padding:0.4rem; background:var(--bg-secondary); color:#f8fafc;">
                    <option value="custom">Custom Cron Expression</option>
                    <option value="* * * * *">Every Minute (* * * * *)</option>
                    <option value="*/5 * * * *">Every 5 Minutes (*/5 * * * *)</option>
                    <option value="*/15 * * * *">Every 15 Minutes (*/15 * * * *)</option>
                    <option value="0 * * * *">Hourly at Minute 0 (0 * * * *)</option>
                    <option value="0 0 * * *">Daily at Midnight (0 0 * * *)</option>
                    <option value="0 12 * * *">Daily at Noon (0 12 * * *)</option>
                    <option value="0 0 * * 0">Weekly on Sunday at 00:00 (0 0 * * 0)</option>
                    <option value="0 0 1 * *">Monthly on 1st at 00:00 (0 0 1 * *)</option>
                    <option value="@reboot">On System Reboot (@reboot)</option>
                  </select>
                </div>

                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.35rem;">Cron Schedule Expression</label>
                  <input type="text" id="cronExprInp_${cronWinId}" value="0 0 * * *" class="form-control" style="width:100%; font-family:monospace; font-size:0.9rem; padding:0.4rem 0.6rem;" placeholder="* * * * *">
                  <div id="cronHumanDesc_${cronWinId}" style="font-size:0.72rem; color:#38bdf8; margin-top:0.3rem;">Daily at midnight (00:00)</div>
                </div>

                <div>
                  <label style="display:block; font-size:0.75rem; font-weight:700; color:#cbd5e1; margin-bottom:0.35rem;">Command to Execute</label>
                  <textarea id="cronCmdInp_${cronWinId}" rows="3" class="form-control" style="width:100%; font-family:monospace; font-size:0.8rem; padding:0.4rem 0.6rem;" placeholder="/usr/bin/python3 /opt/scripts/backup.py >> /var/log/backup.log 2>&1"></textarea>
                  <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem;">Always use absolute paths to system binaries and redirect logs when needed.</div>
                </div>

                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <input type="checkbox" id="cronEnabledInp_${cronWinId}" checked>
                  <label for="cronEnabledInp_${cronWinId}" style="font-size:0.78rem; color:#cbd5e1; cursor:pointer;">Job is enabled &amp; active</label>
                </div>
              </div>
              <div style="padding:0.75rem 1.25rem; border-top:1px solid var(--border-subtle); background:rgba(0,0,0,0.2); display:flex; justify-content:flex-end; gap:0.5rem;">
                <button class="btn btn-secondary btn-sm" id="btnModalClose_${cronWinId}">Cancel</button>
                <button class="btn btn-primary btn-sm" id="btnModalSave_${cronWinId}">Save Scheduled Job</button>
              </div>
            </div>
          </div>
        </div>
      `,
      onInit: (bodyEl) => {
        const contentArea = bodyEl.querySelector(`#cronContentArea_${cronWinId}`);
        const countBadge = bodyEl.querySelector(`#cronJobCount_${cronWinId}`);
        const modal = bodyEl.querySelector(`#cronModal_${cronWinId}`);
        const modalTitle = bodyEl.querySelector(`#cronModalTitle_${cronWinId}`);
        const presetSel = bodyEl.querySelector(`#cronPresetSel_${cronWinId}`);
        const exprInp = bodyEl.querySelector(`#cronExprInp_${cronWinId}`);
        const humanDesc = bodyEl.querySelector(`#cronHumanDesc_${cronWinId}`);
        const cmdInp = bodyEl.querySelector(`#cronCmdInp_${cronWinId}`);
        const enabledInp = bodyEl.querySelector(`#cronEnabledInp_${cronWinId}`);
        const addBtn = bodyEl.querySelector(`#btnAddJob_${cronWinId}`);
        const refreshBtn = bodyEl.querySelector(`#btnRefreshCron_${cronWinId}`);
        const cancelBtn = bodyEl.querySelector(`#btnCancelModal_${cronWinId}`);
        const closeBtn = bodyEl.querySelector(`#btnModalClose_${cronWinId}`);
        const saveBtn = bodyEl.querySelector(`#btnModalSave_${cronWinId}`);

        const loadJobs = async () => {
          contentArea.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted);"><span class="spinner-border spinner-border-sm" style="width:14px;height:14px;"></span> Loading crontab...</div>`;
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/cron/list`);
            const res = await resp.json();
            if (res.success) {
              jobsList = res.jobs || [];
              countBadge.textContent = `${jobsList.length} JOBS`;
              renderJobsTable();
            } else {
              contentArea.innerHTML = `<div class="alert alert-danger" style="margin:1rem;">Failed to load crontab: ${res.error || 'Unknown error'}</div>`;
            }
          } catch (e) {
            contentArea.innerHTML = `<div class="alert alert-danger" style="margin:1rem;">Network error loading crontab: ${e}</div>`;
          }
        };

        const renderJobsTable = (filterQuery = '') => {
          const filtered = filterQuery
            ? jobsList.filter(j => j.command.toLowerCase().includes(filterQuery) || j.schedule.toLowerCase().includes(filterQuery) || (j.human && j.human.toLowerCase().includes(filterQuery)))
            : jobsList;

          if (jobsList.length === 0) {
            contentArea.innerHTML = `
              <div style="text-align:center; padding:4rem 1.5rem; background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px;">
                <svg style="width:36px;height:36px;color:var(--text-muted);margin-bottom:0.75rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <div style="font-weight:700; font-size:0.95rem; color:#f8fafc; margin-bottom:0.35rem;">No Scheduled Cron Jobs</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:1rem;">This server user currently has no active crontab entries configured.</div>
                <button class="btn btn-primary btn-sm" id="btnEmptyAdd_${cronWinId}">Create First Cron Job</button>
              </div>
            `;
            const emptyAdd = contentArea.querySelector(`#btnEmptyAdd_${cronWinId}`);
            if (emptyAdd) emptyAdd.onclick = () => openModal(null);
            return;
          }

          if (filtered.length === 0) {
            contentArea.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--text-muted); font-size:0.82rem;">No cron jobs match "${filterQuery}".</div>`;
            return;
          }

          contentArea.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.65rem;">
              ${filtered.map(j => `
                <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:8px; padding:0.75rem 1rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; opacity:${j.is_enabled ? '1' : '0.6'};">
                  <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.35rem; flex-wrap:wrap;">
                      <code style="font-size:0.8rem; background:rgba(0,0,0,0.3); border:1px solid var(--border-subtle); padding:0.15rem 0.5rem; border-radius:4px; color:#38bdf8; font-family:monospace; font-weight:700;">${j.schedule}</code>
                      <span style="font-size:0.75rem; font-weight:600; color:#cbd5e1;">${j.human}</span>
                      <span style="font-size:0.65rem; padding:0.1rem 0.4rem; border-radius:3px; font-weight:700; ${j.is_enabled ? 'background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3);' : 'background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3);'}">
                        ${j.is_enabled ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </div>
                    <div style="font-family:monospace; font-size:0.78rem; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${j.command}">
                      ${j.command}
                    </div>
                  </div>

                  <!-- Actions -->
                  <div style="display:flex; align-items:center; gap:0.4rem; flex-shrink:0;">
                    <button class="btn btn-secondary btn-xs btn-run-now" data-cmd="${encodeURIComponent(j.command)}" title="Run command immediately over SSH">
                      <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                      Run Now
                    </button>
                    <button class="btn btn-secondary btn-xs btn-toggle" data-id="${j.id}" title="${j.is_enabled ? 'Disable' : 'Enable'}">
                      ${j.is_enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn btn-secondary btn-xs btn-edit" data-id="${j.id}">
                      Edit
                    </button>
                    <button class="btn btn-danger btn-xs btn-del" data-id="${j.id}">
                      Delete
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `;

          // Button handlers
          contentArea.querySelectorAll('.btn-run-now').forEach(b => {
            b.onclick = async () => {
              const cmd = decodeURIComponent(b.dataset.cmd);
              b.disabled = true;
              b.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:10px;height:10px;"></span>`;
              try {
                const resp = await fetch(`/api/servers/${this.serverId}/cron/run-now`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ command: cmd })
                });
                const res = await resp.json();
                DesktopModal.showOutput({
                  title: res.exit_code === 0 ? 'Cron Job Executed' : 'Cron Job Execution Failed',
                  subtitle: `Command: ${cmd}`,
                  output: res.output || '(No command output)',
                  exitCode: res.exit_code,
                  isSuccess: res.exit_code === 0
                });
              } catch (e) {
                if (window.showToast) window.showToast('Execution error: ' + e, 'danger');
                else DesktopModal.alert({ title: 'Execution Error', message: String(e), type: 'danger' });
              } finally {
                b.disabled = false;
                b.innerHTML = `
                  <svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Run Now
                `;
              }
            };
          });

          contentArea.querySelectorAll('.btn-toggle').forEach(b => {
            b.onclick = async () => {
              const id = b.dataset.id;
              try {
                await fetch(`/api/servers/${this.serverId}/cron/toggle`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id })
                });
                loadJobs();
              } catch (e) {
                if (window.showToast) window.showToast('Toggle error: ' + e, 'danger');
              }
            };
          });

          contentArea.querySelectorAll('.btn-edit').forEach(b => {
            b.onclick = () => {
              const id = parseInt(b.dataset.id, 10);
              const job = jobsList.find(j => j.id === id);
              if (job) openModal(job);
            };
          });

          contentArea.querySelectorAll('.btn-del').forEach(b => {
            b.onclick = async () => {
              const ok = await DesktopModal.confirm({
                title: 'Delete Scheduled Job',
                message: 'Are you sure you want to delete this scheduled cron job?',
                confirmText: 'Delete',
                isDanger: true
              });
              if (ok) {
                const id = b.dataset.id;
                try {
                  await fetch(`/api/servers/${this.serverId}/cron/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                  });
                  if (window.showToast) window.showToast('Cron job deleted', 'info');
                  loadJobs();
                } catch (e) {
                  DesktopModal.alert({ title: 'Delete Error', message: String(e), type: 'danger' });
                }
              }
            };
          });
        };

        const openModal = (job) => {
          editingJob = job;
          modal.style.display = 'flex';
          if (job) {
            modalTitle.textContent = 'Edit Scheduled Job';
            exprInp.value = job.schedule;
            cmdInp.value = job.command;
            enabledInp.checked = job.is_enabled;
            humanDesc.textContent = job.human;
          } else {
            modalTitle.textContent = 'Add Scheduled Job';
            exprInp.value = '0 0 * * *';
            cmdInp.value = '';
            enabledInp.checked = true;
            presetSel.value = '0 0 * * *';
            humanDesc.textContent = 'Daily at midnight (00:00)';
          }
        };

        const closeModal = () => {
          modal.style.display = 'none';
          editingJob = null;
        };

        presetSel.onchange = (e) => {
          if (e.target.value !== 'custom') {
            exprInp.value = e.target.value;
            humanDesc.textContent = presetSel.options[presetSel.selectedIndex].text;
          }
        };

        exprInp.oninput = (e) => {
          humanDesc.textContent = `Schedule: ${e.target.value}`;
        };

        addBtn.onclick = () => openModal(null);
        refreshBtn.onclick = () => loadJobs();
        cancelBtn.onclick = closeModal;
        closeBtn.onclick = closeModal;

        const searchInp = bodyEl.querySelector(`#cronSearchInp_${cronWinId}`);
        if (searchInp) {
          searchInp.oninput = (e) => {
            renderJobsTable(e.target.value.toLowerCase().trim());
          };
        }

        saveBtn.onclick = async () => {
          const schedule = exprInp.value.trim();
          const command = cmdInp.value.trim();
          if (!schedule || !command) {
            if (window.showToast) window.showToast('Schedule and command are required.', 'warning');
            else DesktopModal.alert({ title: 'Validation Error', message: 'Schedule and command are required.', type: 'warning' });
            return;
          }

          saveBtn.disabled = true;
          saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:12px;height:12px;"></span> Saving...`;

          try {
            const resp = await fetch(`/api/servers/${this.serverId}/cron/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: editingJob ? editingJob.id : null,
                schedule,
                command,
                is_enabled: enabledInp.checked
              })
            });
            const res = await resp.json();
            if (res.success) {
              if (window.showToast) window.showToast('Cron schedule saved successfully!', 'success');
              closeModal();
              loadJobs();
            } else {
              DesktopModal.alert({ title: 'Save Failed', message: res.error || 'Unknown error saving cron job.', type: 'danger' });
            }
          } catch (e) {
            DesktopModal.alert({ title: 'Save Error', message: String(e), type: 'danger' });
          } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Scheduled Job';
          }
        };

        loadJobs();
      }
    });
};

