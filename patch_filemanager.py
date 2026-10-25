"""
Usage:  python patch_filemanager.py path/to/static/js/desktop/filemanager.js
Replaces the whole streamTaskProgress() function with the fixed version
(a .bak backup is written next to the file).
"""
import sys, shutil

NEW = r'''    function streamTaskProgress(taskId, title, successMsg, onComplete) {
      const toastId = 'sse_toast_' + Date.now();
      const toast = document.createElement('div');
      toast.id = toastId;
      toast.className = 'desktop-toast info';
      toast.style.cssText = 'flex-direction:column; align-items:flex-start; gap:6px; min-width:340px;';
      toast.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span style="font-weight:600; font-size:0.8rem; color:#f8fafc;">${title}</span>
          <span class="sse-percent" style="font-family:var(--font-mono); font-size:0.75rem; color:#38bdf8;">0%</span>
        </div>
        <div style="width:100%; height:5px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
          <div class="sse-bar" style="width:0%; height:100%; background:#0284c7; transition:width 0.2s ease;"></div>
        </div>
        <div class="sse-status" style="font-family:var(--font-mono); font-size:0.68rem; color:#94a3b8; width:100%; text-align:right;">Connecting...</div>
      `;
      const tc = document.getElementById('toastContainer');
      if (tc) tc.appendChild(toast);

      const eventSource = new EventSource(`/api/tasks/${taskId}/progress`);

      let lastTransferred = 0;
      let lastUpdateTime = Date.now();
      let stallShown = false;
      let stallCheck = setInterval(() => {
        if (Date.now() - lastUpdateTime > 4000 && toast.isConnected && !stallShown) {
          const statEl = toast.querySelector('.sse-status');
          if (statEl) {
            statEl.textContent += ' (waiting on remote server...)';
            statEl.style.color = '#f59e0b';
            stallShown = true;
          }
        }
      }, 1000);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'waiting') return;

          if (data.transferred !== lastTransferred) {
            lastTransferred = data.transferred;
            lastUpdateTime = Date.now();
            stallShown = false;
            const s = toast.querySelector('.sse-status');
            if (s) s.style.color = '#94a3b8';
          }

          const transferredMB = (data.transferred / 1048576).toFixed(2);
          const pctEl = toast.querySelector('.sse-percent');
          const barEl = toast.querySelector('.sse-bar');
          const statEl = toast.querySelector('.sse-status');

          if (data.total > 0) {
            const percent = Math.min(100, Math.round((data.transferred / data.total) * 100));
            const totalMB = (data.total / 1048576).toFixed(2);
            if (pctEl) pctEl.textContent = `${percent}%`;
            if (barEl) { barEl.style.width = `${percent}%`; barEl.style.opacity = '1'; }
            if (statEl && !stallShown) statEl.textContent = `${transferredMB} MB / ${totalMB} MB`;
          } else {
            // total unknown (e.g. compression): show real bytes written, no fake percent
            if (pctEl) pctEl.textContent = '…';
            if (barEl) { barEl.style.width = '100%'; barEl.style.opacity = '0.35'; }
            if (statEl && !stallShown) statEl.textContent = `${transferredMB} MB written`;
          }

          if (data.status === 'done') {
            clearInterval(stallCheck);
            eventSource.close();
            toast.className = 'desktop-toast success';
            toast.innerHTML = `<div style="font-weight:600; color:#34d399;">✓ ${successMsg || 'Completed successfully!'}</div>`;
            setTimeout(() => toast.remove(), 3000);
            if (onComplete) onComplete();
          } else if (data.status === 'error') {
            clearInterval(stallCheck);
            eventSource.close();
            toast.className = 'desktop-toast error';
            toast.innerHTML = `<div style="font-weight:600; color:#f87171;">✗ Failed: ${data.error || 'Unknown error'}</div>`;
            setTimeout(() => toast.remove(), 5000);
          }
        } catch (_) {}
      };

      eventSource.onerror = () => {
        clearInterval(stallCheck);
        eventSource.close();
        toast.remove();
      };
    }

'''

path = sys.argv[1]
src = open(path, encoding='utf-8').read()
a = src.index('function streamTaskProgress(')
a = src.rfind('\n', 0, a) + 1          # start of that line (drops odd indentation)
b = src.index('const startProgressToast')
b = src.rfind('\n', 0, b) + 1          # start of that line
shutil.copy(path, path + '.bak')
open(path, 'w', encoding='utf-8').write(src[:a] + NEW + src[b:])
print('patched, backup at', path + '.bak')