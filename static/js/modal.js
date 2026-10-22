/**
 * ShellMan Unified Desktop Modal System
 * Provides async promise-based DesktopModal.alert(), confirm(), prompt(), and showOutput()
 * Replaces native browser alert(), confirm(), and prompt().
 */
(function() {
  if (window.DesktopModal) return;

  class DesktopModalManager {
    alert(optionsOrMessage) {
      const opts = typeof optionsOrMessage === 'string' ? { message: optionsOrMessage } : (optionsOrMessage || {});
      return new Promise((resolve) => {
        this._createModal({
          title: opts.title || 'Information',
          type: opts.type || 'info',
          message: opts.message || '',
          okText: opts.okText || 'OK',
          showCancel: false,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });
    }

    confirm(optionsOrMessage) {
      const opts = typeof optionsOrMessage === 'string' ? { message: optionsOrMessage } : (optionsOrMessage || {});
      return new Promise((resolve) => {
        this._createModal({
          title: opts.title || 'Confirmation',
          type: opts.type || (opts.isDanger ? 'danger' : 'confirm'),
          message: opts.message || '',
          okText: opts.confirmText || opts.okText || 'Confirm',
          cancelText: opts.cancelText || 'Cancel',
          isDanger: opts.isDanger || false,
          showCancel: true,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });
    }

    prompt(optionsOrMessage) {
      const opts = typeof optionsOrMessage === 'string' ? { message: optionsOrMessage } : (optionsOrMessage || {});
      return new Promise((resolve) => {
        this._createModal({
          title: opts.title || 'Input Required',
          type: 'prompt',
          message: opts.message || '',
          defaultValue: opts.defaultValue || '',
          placeholder: opts.placeholder || '',
          okText: opts.confirmText || opts.okText || 'OK',
          cancelText: opts.cancelText || 'Cancel',
          showCancel: true,
          onConfirm: (val) => resolve(val),
          onCancel: () => resolve(null)
        });
      });
    }

    showOutput(optionsOrTitle, rawOutput, exitCode = 0, isSuccess = true) {
      const opts = typeof optionsOrTitle === 'object'
        ? optionsOrTitle
        : { title: optionsOrTitle, output: rawOutput, exitCode: exitCode, isSuccess: isSuccess };

      return new Promise((resolve) => {
        this._createModal({
          title: opts.title || 'Execution Output',
          subtitle: opts.subtitle || '',
          type: 'output',
          output: opts.output || '(No output produced)',
          exitCode: opts.exitCode !== undefined ? opts.exitCode : null,
          isSuccess: opts.isSuccess !== undefined ? opts.isSuccess : (opts.exitCode === 0),
          okText: opts.okText || 'Close',
          showCancel: false,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });
    }

    _createModal(cfg) {
      const overlay = document.createElement('div');
      overlay.className = 'desktop-modal-backdrop';
      overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 100020; padding: 1.25rem; font-family: var(--font-sans, system-ui, -apple-system, sans-serif); color: var(--text-primary, #f8fafc);
      `;

      const isOutput = cfg.type === 'output';
      const isDanger = cfg.isDanger || cfg.type === 'danger';
      const maxWidth = isOutput ? '700px' : '480px';

      let iconSvg = '<svg style="width:16px;height:16px;color:#38bdf8;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
      if (isDanger) {
        iconSvg = '<svg style="width:16px;height:16px;color:#f87171;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      } else if (cfg.type === 'success' || (isOutput && cfg.isSuccess)) {
        iconSvg = '<svg style="width:16px;height:16px;color:#34d399;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      } else if (isOutput && !cfg.isSuccess) {
        iconSvg = '<svg style="width:16px;height:16px;color:#f87171;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      }

      let bodyHtml = '';
      if (isOutput) {
        const escaped = (cfg.output || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        bodyHtml = `
          <div style="display:flex; flex-direction:column; gap:0.5rem; flex:1; min-height:0;">
            ${cfg.subtitle ? `<div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-family:monospace; word-break:break-all;">${cfg.subtitle}</div>` : ''}
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.15rem;">
              <span style="font-size:0.7rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em;">Output Details</span>
              <button type="button" class="btn btn-secondary btn-xs" id="dmCopyOutputBtn" style="font-size:0.68rem; padding:0.15rem 0.5rem;">
                Copy Output
              </button>
            </div>
            <div id="dmOutputPane" style="background:#0b111c; border:1px solid var(--border-subtle, rgba(255,255,255,0.08)); border-radius:6px; padding:0.75rem; font-family:monospace; font-size:0.78rem; line-height:1.45; color:#cbd5e1; max-height:360px; overflow-y:auto; white-space:pre-wrap; word-break:break-all;">${escaped}</div>
          </div>
        `;
      } else if (cfg.type === 'prompt') {
        bodyHtml = `
          <div style="display:flex; flex-direction:column; gap:0.65rem;">
            <div style="font-size:0.82rem; color:#cbd5e1; line-height:1.45; white-space:pre-wrap;">${cfg.message}</div>
            <input type="text" id="dmPromptInput" value="${(cfg.defaultValue || '').replace(/"/g, '&quot;')}" placeholder="${cfg.placeholder || ''}" class="form-control" style="width:100%; font-size:0.82rem; padding:0.45rem 0.65rem;" spellcheck="false" autocomplete="off">
          </div>
        `;
      } else {
        bodyHtml = `
          <div style="font-size:0.82rem; color:#cbd5e1; line-height:1.5; white-space:pre-wrap; word-break:break-word;">${cfg.message}</div>
        `;
      }

      overlay.innerHTML = `
        <div style="width:100%; max-width:${maxWidth}; max-height:85vh; background:var(--bg-surface, #111827); border:1px solid var(--border-color, #1f2937); border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.85); display:flex; flex-direction:column; overflow:hidden;">
          <!-- Header -->
          <div style="height:42px; padding:0 1rem; border-bottom:1px solid var(--border-subtle, rgba(255,255,255,0.08)); display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.02); flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.5rem; min-width:0;">
              ${iconSvg}
              <span style="font-weight:700; font-size:0.88rem; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cfg.title}</span>
              ${cfg.exitCode !== null ? `<span style="font-size:0.68rem; padding:0.1rem 0.4rem; border-radius:3px; font-weight:700; font-family:monospace; ${cfg.isSuccess ? 'background:rgba(16,185,129,0.15); color:#34d399;' : 'background:rgba(239,68,68,0.15); color:#f87171;'}">EXIT ${cfg.exitCode}</span>` : ''}
            </div>
            <button class="btn btn-secondary btn-xs" id="dmCloseBtn" style="padding:0.15rem 0.45rem; line-height:1;">&times;</button>
          </div>

          <!-- Body -->
          <div style="padding:1.15rem 1.25rem; overflow-y:auto; flex:1; min-height:0;">
            ${bodyHtml}
          </div>

          <!-- Footer -->
          <div style="padding:0.75rem 1rem; border-top:1px solid var(--border-subtle, rgba(255,255,255,0.08)); background:rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:flex-end; gap:0.5rem; flex-shrink:0;">
            ${cfg.showCancel ? `<button class="btn btn-secondary btn-sm" id="dmCancelBtn">${cfg.cancelText || 'Cancel'}</button>` : ''}
            <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'} btn-sm" id="dmConfirmBtn" style="font-weight:600;">${cfg.okText || 'OK'}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const closeBtn = overlay.querySelector('#dmCloseBtn');
      const cancelBtn = overlay.querySelector('#dmCancelBtn');
      const confirmBtn = overlay.querySelector('#dmConfirmBtn');
      const promptInp = overlay.querySelector('#dmPromptInput');
      const copyBtn = overlay.querySelector('#dmCopyOutputBtn');

      if (promptInp) {
        setTimeout(() => { promptInp.focus(); promptInp.select(); }, 50);
        promptInp.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            cleanup(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(false);
          }
        };
      } else {
        setTimeout(() => confirmBtn.focus(), 50);
      }

      if (copyBtn) {
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(cfg.output || '');
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy Output'; }, 1500);
        };
      }

      const cleanup = (confirmed) => {
        window.removeEventListener('keydown', onKeyDown);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (confirmed) {
          const val = promptInp ? promptInp.value.trim() : true;
          cfg.onConfirm(val);
        } else {
          cfg.onCancel();
        }
      };

      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cleanup(false);
        } else if (e.key === 'Enter' && !isOutput && !e.shiftKey) {
          e.preventDefault();
          cleanup(true);
        }
      };
      window.addEventListener('keydown', onKeyDown);

      closeBtn.onclick = () => cleanup(false);
      if (cancelBtn) cancelBtn.onclick = () => cleanup(false);
      confirmBtn.onclick = () => cleanup(true);
    }
  }

  window.DesktopModal = new DesktopModalManager();

  // Intercept window.alert so all legacy and library alerts display modern desktop dialogs
  window.alert = function(msg) {
    if (window.DesktopModal) {
      window.DesktopModal.alert(msg);
    } else {
      console.warn('Alert:', msg);
    }
  };
})();
