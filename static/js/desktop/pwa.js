/**
 * ShellMan OS: Progressive Web App Manager (pwa.js)
 * Manages service worker registration, install prompts, standalone detection, and UI triggers.
 */

const PwaManager = {
  deferredPrompt: null,
  isInstalled: false,
  isStandalone: false,

  init() {
    // Detect standalone mode
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone === true ||
                        document.referrer.includes('android-app://');

    if (this.isStandalone) {
      this.isInstalled = true;
      document.body.classList.add('pwa-standalone');
      console.log('[ShellMan PWA] Running in standalone desktop mode.');
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((reg) => {
            console.log('[ShellMan PWA] Service Worker registered successfully with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[ShellMan PWA] Service Worker registration failed:', err);
          });
      });
    }

    // Capture install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      window.deferredPwaPrompt = e;
      this.updateInstallButtons(true);
      console.log('[ShellMan PWA] beforeinstallprompt event captured and ready.');
    });

    // Detect successful installation
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      window.deferredPwaPrompt = null;
      this.updateInstallButtons(false);
      if (typeof showToast === 'function') {
        showToast('ShellMan desktop app installed successfully!', 'success');
      }
      console.log('[ShellMan PWA] Application installed to desktop.');
    });

    // Listen for display-mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (evt) => {
      this.isStandalone = evt.matches;
      if (evt.matches) {
        this.isInstalled = true;
        this.updateInstallButtons(false);
      }
    });
  },

  updateInstallButtons(isInstallable) {
    document.querySelectorAll('.pwa-install-btn').forEach(btn => {
      if (this.isStandalone || this.isInstalled) {
        btn.classList.add('installed');
        btn.title = 'ShellMan Desktop App is installed';
        const label = btn.querySelector('.btn-label') || btn;
        if (label && label.dataset.installedText) {
          label.textContent = label.dataset.installedText;
        }
      } else if (isInstallable) {
        btn.classList.remove('installed');
        btn.style.display = '';
      }
    });
  },

  async promptInstall() {
    if (this.isStandalone) {
      if (typeof showToast === 'function') {
        showToast('ShellMan is already running as an installed desktop app.', 'info');
      }
      return;
    }

    if (this.deferredPrompt) {
      try {
        this.deferredPrompt.prompt();
        const choice = await this.deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          if (typeof showToast === 'function') {
            showToast('Installing ShellMan to your desktop...', 'success');
          }
        }
        this.deferredPrompt = null;
        window.deferredPwaPrompt = null;
      } catch (err) {
        console.error('[ShellMan PWA] Prompt failed:', err);
        this.showManualInstallModal();
      }
    } else {
      // Browser didn't dispatch prompt or already installed / dismissed
      this.showManualInstallModal();
    }
  },

  showManualInstallModal() {
    const modalId = 'pwaManualInstallModal';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'desktop-modal-backdrop';
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="desktop-modal-box" style="max-width: 480px; text-align: left;">
          <div class="desktop-modal-header">
            <div style="display:flex;align-items:center;gap:0.6rem;">
              <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg, #0ea5e9, #38bdf8);display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </div>
              <h3 style="margin:0;font-size:1.05rem;font-weight:700;color:var(--text-primary);">Install ShellMan App (PWA)</h3>
            </div>
            <button class="desktop-modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
          </div>
          <div class="desktop-modal-body" style="padding:1.25rem;font-size:0.875rem;color:var(--text-secondary);line-height:1.6;">
            <p style="margin-top:0;">You can install ShellMan as a native desktop application with window frame, offline shell, and keyboard shortcuts:</p>
            
            <div style="display:flex;flex-direction:column;gap:0.75rem;margin:1rem 0;">
              <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;padding:0.75rem 1rem;">
                <div style="font-weight:600;color:var(--text-primary);margin-bottom:0.25rem;">Chrome &amp; Brave &amp; Edge:</div>
                <div style="font-size:0.8rem;color:var(--text-muted);">
                  Look at the right side of your browser address bar and click the <strong>Install ShellMan</strong> icon <span style="display:inline-block;padding:2px 6px;background:rgba(255,255,255,0.1);border-radius:4px;font-family:monospace;">⊕</span> or open the browser menu &rarr; <strong>"Install ShellMan..."</strong>.
                </div>
              </div>
              
              <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;padding:0.75rem 1rem;">
                <div style="font-weight:600;color:var(--text-primary);margin-bottom:0.25rem;">Safari (macOS Sonoma+):</div>
                <div style="font-size:0.8rem;color:var(--text-muted);">
                  Click <strong>File</strong> in the macOS menu bar &rarr; <strong>"Add to Dock..."</strong>.
                </div>
              </div>

              <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;padding:0.75rem 1rem;">
                <div style="font-weight:600;color:var(--text-primary);margin-bottom:0.25rem;">Mobile / iPadOS:</div>
                <div style="font-size:0.8rem;color:var(--text-muted);">
                  Tap the <strong>Share</strong> button &rarr; <strong>"Add to Home Screen"</strong>.
                </div>
              </div>
            </div>
          </div>
          <div class="desktop-modal-footer" style="padding:0.85rem 1.25rem;display:flex;justify-content:flex-end;">
            <button class="btn btn-primary" onclick="document.getElementById('${modalId}').remove()">Got it</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
  }
};

// Global accessor
window.PwaManager = PwaManager;

// Auto-initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PwaManager.init());
} else {
  PwaManager.init();
}

