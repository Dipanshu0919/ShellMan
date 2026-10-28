/**
 * ShellMan OS: In-Browser Window Manager (wm.js)
 * Implements genuine dragging, 8-way resizing, z-index stacking,
 * maximize/restore, minimize, and taskbar synchronization.
 */

class DesktopWindowManager {
  constructor() {
    this.windows = new Map(); // id -> windowObj
    this.topZIndex = 100;
    this.activeWindowId = null;
    this.cascadeStep = 0;
    this.container = null;
    this.taskbarEl = null;
    this.onWindowStateChange = null; // callback for dock/taskbar
  }

  init(containerEl, taskbarEl) {
    this.container = containerEl || document.getElementById('windowsContainer');
    this.taskbarEl = taskbarEl || document.getElementById('desktopTaskbar');

    // Create snap preview element for visual window snapping
    if (this.container && !this.snapPreviewEl) {
      this.snapPreviewEl = document.createElement('div');
      this.snapPreviewEl.className = 'wm-snap-preview';
      this.container.appendChild(this.snapPreviewEl);
    }

    // Global click listener to unfocus if clicked on desktop wallpaper
    const workspace = document.getElementById('desktopWorkspace');
    if (workspace) {
      workspace.addEventListener('pointerdown', (e) => {
        if (e.target === workspace || e.target.classList.contains('desktop-icons-container') || e.target.classList.contains('windows-container') || e.target.classList.contains('desktop-wallpaper-center') || e.target.closest('.desktop-wallpaper-center')) {
          this.unfocusAll();
        }
      });
    }

    // Viewport resize adaptation
    window.addEventListener('resize', () => {
      this.handleViewportResize();
    });
  }

  getWindow(id) {
    return this.windows.get(id) || null;
  }

  getWindowByAppId(appId) {
    for (const [id, win] of this.windows.entries()) {
      if (win.appId === appId) {
        return win;
      }
    }
    return null;
  }

  handleViewportResize() {
    const wsRect = this.container ? this.container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight - 38 };
    const availW = wsRect.width || window.innerWidth;
    const availH = wsRect.height || (window.innerHeight - 38);

    this.windows.forEach(win => {
      if (win.isMaximized) {
        if (typeof win.onResize === 'function') win.onResize(win.el.offsetWidth, win.el.offsetHeight);
        return;
      }
      let curW = win.el.offsetWidth;
      let curH = win.el.offsetHeight;
      let curL = win.el.offsetLeft;
      let curT = win.el.offsetTop;

      if (curW > availW - 32) {
        curW = Math.max(win.minWidth, availW - 32);
        win.el.style.width = `${curW}px`;
      }
      if (curH > availH - 48) {
        curH = Math.max(win.minHeight, availH - 48);
        win.el.style.height = `${curH}px`;
      }
      if (curL + curW > availW) {
        win.el.style.left = `${Math.max(10, availW - curW - 16)}px`;
      }
      if (curT + curH > availH) {
        win.el.style.top = `${Math.max(10, availH - curH - 16)}px`;
      }
      if (typeof win.onResize === 'function') {
        win.onResize(win.el.offsetWidth, win.el.offsetHeight);
      }
    });
  }

  createWindow(options) {
    const {
      id = 'win_' + Date.now(),
      appId = 'app',
      title = 'Application',
      icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>',
      width = 820,
      height = 540,
      minWidth = 380,
      minHeight = 260,
      x = null,
      y = null,
      contentHtml = options.contentHtml || options.content || '',
      onInit = options.onInit || options.onCreated || null,
      onResize = null,
      onClose = null,
      multiInstance = false
    } = options;

    // Request scope created by the app right before this call (see requests.js)
    const reqScope = window.RequestScope ? window.RequestScope.takePending() : null;

    // If single-instance app is already open, focus and restore it!
    if (!multiInstance) {
      for (const [existingId, win] of this.windows.entries()) {
        if (win.appId === appId) {
          if (win.isMinimized) this.restoreWindow(existingId);
          this.focusWindow(existingId);
          return win;
        }
      }
    }

    // Responsive dimensions and smart positioning
    const wsRect = this.container ? this.container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight - 38 };
    const availableW = Math.max(380, wsRect.width > 0 ? wsRect.width : window.innerWidth);
    const availableH = Math.max(260, wsRect.height > 0 ? wsRect.height : (window.innerHeight - 38));

    // Clamp initial dimensions so windows never overflow viewport
    const winW = Math.min(width, Math.max(minWidth, availableW - 32));
    const winH = Math.min(height, Math.max(minHeight, availableH - 52));

    // Open in center of the workspace by default
    const centerX = Math.max(12, Math.min(availableW - winW - 12, Math.round((availableW - winW) / 2)));
    const centerY = Math.max(12, Math.min(availableH - winH - 24, Math.round((availableH - winH) / 2)));

    let defaultX = centerX;
    let defaultY = centerY;

    // If an existing open window already occupies this exact position, apply a slight stagger (+26px) so window titlebars don't completely overlap
    let attempts = 0;
    while (attempts < 6) {
      let collides = false;
      for (const w of this.windows.values()) {
        if (!w.isMinimized && w.el) {
          const curLeft = parseInt(w.el.style.left, 10) || 0;
          const curTop = parseInt(w.el.style.top, 10) || 0;
          if (Math.abs(curLeft - defaultX) < 18 && Math.abs(curTop - defaultY) < 18) {
            collides = true;
            break;
          }
        }
      }
      if (!collides) break;
      defaultX = Math.min(availableW - winW - 12, defaultX + 26);
      defaultY = Math.min(availableH - winH - 24, defaultY + 26);
      attempts++;
    }

    const posX = (x !== null) ? Math.max(0, Math.min(x, availableW - winW)) : defaultX;
    const posY = (y !== null) ? Math.max(0, Math.min(y, availableH - winH)) : defaultY;
    this.cascadeStep++;

    // Create DOM element for window
    const winEl = document.createElement('div');
    winEl.className = 'desktop-window';
    winEl.id = id;
    winEl.dataset.app = appId;
    winEl.style.width = `${winW}px`;
    winEl.style.height = `${winH}px`;
    winEl.style.left = `${posX}px`;
    winEl.style.top = `${posY}px`;
    winEl.style.zIndex = ++this.topZIndex;

    winEl.innerHTML = `
      <div class="window-titlebar" id="tb_${id}">
        <div class="window-title-left">
          <span class="window-app-icon">${icon}</span>
          <span class="window-title-text" id="wintitle_${id}">${title}</span>
        </div>
        <div class="window-controls">
          <button class="win-btn win-minimize" onclick="WindowManager.minimizeWindow('${id}')" title="Minimize">
            <svg viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6"></line></svg>
          </button>
          <button class="win-btn win-maximize" onclick="WindowManager.toggleMaximize('${id}')" title="Maximize/Restore">
            <svg viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8"></rect></svg>
          </button>
          <button class="win-btn win-close" onclick="WindowManager.closeWindow('${id}')" title="Close">
            <svg viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10"></line><line x1="10" y1="2" x2="2" y2="10"></line></svg>
          </button>
        </div>
      </div>
      <div class="window-body" id="body_${id}">
        ${contentHtml}
      </div>
      <div class="win-resize-handle handle-n" data-dir="n"></div>
      <div class="win-resize-handle handle-s" data-dir="s"></div>
      <div class="win-resize-handle handle-e" data-dir="e"></div>
      <div class="win-resize-handle handle-w" data-dir="w"></div>
      <div class="win-resize-handle handle-ne" data-dir="ne"></div>
      <div class="win-resize-handle handle-nw" data-dir="nw"></div>
      <div class="win-resize-handle handle-se" data-dir="se"></div>
      <div class="win-resize-handle handle-sw" data-dir="sw"></div>
    `;

    this.container.appendChild(winEl);

    // Create Taskbar Pill in top system bar
    const taskbarPill = document.createElement('div');
    taskbarPill.className = 'taskbar-pill';
    taskbarPill.id = `pill_${id}`;
    taskbarPill.innerHTML = `
      ${icon}
      <span class="taskbar-pill-title">${title}</span>
    `;
    taskbarPill.onclick = () => {
      const win = this.windows.get(id);
      if (!win) return;
      if (win.isMinimized) {
        this.restoreWindow(id);
        this.focusWindow(id);
      } else if (this.activeWindowId === id) {
        this.minimizeWindow(id);
      } else {
        this.focusWindow(id);
      }
    };
    if (this.taskbarEl) {
      this.taskbarEl.appendChild(taskbarPill);
    }

    const winObj = {
      id,
      appId,
      title,
      icon,
      el: winEl,
      taskbarPill: taskbarPill,
      bodyEl: winEl.querySelector(`#body_${id}`),
      titleEl: winEl.querySelector(`#wintitle_${id}`),
      minWidth,
      minHeight,
      isMaximized: false,
      isMinimized: false,
      restoreRect: null,
      onResize,
      onClose,
      scope: reqScope
    };

    this.windows.set(id, winObj);

    // Setup interactive handlers
    this.setupWindowDragging(winObj);
    this.setupWindowResizing(winObj);

    // Window focus on pointerdown
    winEl.addEventListener('pointerdown', () => {
      this.focusWindow(id);
    });

    // Double-click titlebar to maximize / restore
    const titlebar = winEl.querySelector(`#tb_${id}`);
    titlebar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.window-controls')) return;
      this.toggleMaximize(id);
    });

    this.focusWindow(id);

    // Run custom onInit callback
    if (typeof onInit === 'function') {
      try {
        onInit(winObj.bodyEl, winObj);
      } catch (err) {
        console.error('Window onInit error:', err);
      }
    }

    this.notifyStateChange();
    return winObj;
  }

  focusWindow(id) {
    if (!this.windows.has(id)) return;
    const targetWin = this.windows.get(id);

    if (targetWin.isMinimized) {
      this.restoreWindow(id);
    }

    this.topZIndex += 2;
    targetWin.el.style.zIndex = this.topZIndex;

    this.windows.forEach((win, winId) => {
      if (winId === id) {
        win.el.classList.add('active');
        if (win.taskbarPill) win.taskbarPill.classList.add('active');
      } else {
        win.el.classList.remove('active');
        if (win.taskbarPill) win.taskbarPill.classList.remove('active');
      }
    });

    this.activeWindowId = id;
    this.notifyStateChange();
  }

  unfocusAll() {
    this.windows.forEach(win => {
      win.el.classList.remove('active');
      if (win.taskbarPill) win.taskbarPill.classList.remove('active');
    });
    this.activeWindowId = null;
    this.notifyStateChange();
  }

  minimizeWindow(id) {
    const win = this.windows.get(id);
    if (!win || win.isMinimized || win.isClosing) return;

    win.isMinimized = true;
    win.el.classList.add('minimizing');
    if (win.taskbarPill) {
      win.taskbarPill.classList.remove('active');
      win.taskbarPill.classList.add('minimized');
    }

    setTimeout(() => {
      if (win.isMinimized) {
        win.el.classList.remove('minimizing');
        win.el.classList.add('minimized');
      }
    }, 150);

    // If minimized window was active, focus highest visible window
    if (this.activeWindowId === id) {
      this.activeWindowId = null;
      let nextTopWin = null;
      let maxZ = -1;
      this.windows.forEach(w => {
        if (!w.isMinimized && !w.isClosing && parseInt(w.el.style.zIndex || 0) > maxZ) {
          maxZ = parseInt(w.el.style.zIndex);
          nextTopWin = w;
        }
      });
      if (nextTopWin) {
        this.focusWindow(nextTopWin.id);
      }
    }

    this.notifyStateChange();
  }

  restoreWindow(id) {
    const win = this.windows.get(id);
    if (!win || !win.isMinimized) return;

    win.isMinimized = false;
    win.el.classList.remove('minimized');
    win.el.classList.add('restoring');
    if (win.taskbarPill) {
      win.taskbarPill.classList.remove('minimized');
    }

    win.el.classList.remove('minimizing');
    setTimeout(() => {
      // Stop base winOpen animation from replaying when 'restoring' is removed.
      win.el.classList.add('no-anim');
      win.el.classList.remove('restoring');
    }, 180);

    if (typeof win.onResize === 'function') {
      setTimeout(() => {
        win.onResize(win.el.offsetWidth, win.el.offsetHeight);
      }, 50);
    }

    this.notifyStateChange();
  }

  toggleMaximize(id) {
    const win = this.windows.get(id);
    if (!win || win.isClosing) return;

    if (win.isMaximized) {
      // Restore previous geometry
      win.isMaximized = false;
      win.el.classList.remove('maximized');
      if (win.restoreRect) {
        win.el.style.left = `${win.restoreRect.left}px`;
        win.el.style.top = `${win.restoreRect.top}px`;
        win.el.style.width = `${win.restoreRect.width}px`;
        win.el.style.height = `${win.restoreRect.height}px`;
      }
    } else {
      // Clear snap classes if snapped
      if (win.snapState) {
        win.snapState = null;
        win.el.classList.remove('snapped', 'snapped-left', 'snapped-right');
      }
      // Save current geometry and maximize
      if (!win.restoreRect) {
        win.restoreRect = {
          left: win.el.offsetLeft,
          top: win.el.offsetTop,
          width: win.el.offsetWidth,
          height: win.el.offsetHeight
        };
      }
      win.isMaximized = true;
      win.el.classList.add('maximized');
    }

    this.focusWindow(id);

    if (typeof win.onResize === 'function') {
      setTimeout(() => {
        win.onResize(win.el.offsetWidth, win.el.offsetHeight);
      }, 50);
    }
    this.notifyStateChange();   // dock auto-hide follows maximize state
  }

  maximizeWindow(id) {
    const win = this.windows.get(id);
    if (!win || win.isClosing || win.isMaximized) return;
    this.toggleMaximize(id);
  }

  closeWindow(id) {
    const win = this.windows.get(id);
    if (!win || win.isClosing) return;

    win.isClosing = true;
    // Cancel every request this window started (and kill the remote jobs behind them)
    if (win.scope && window.RequestScope) window.RequestScope.abortScope(win.scope);
    win.el.classList.add('closing');

    if (win.taskbarPill && win.taskbarPill.parentNode) {
      win.taskbarPill.parentNode.removeChild(win.taskbarPill);
    }

    // Immediately pass active focus to top visible window
    if (this.activeWindowId === id) {
      this.activeWindowId = null;
      let nextTopWin = null;
      let maxZ = -1;
      this.windows.forEach(w => {
        if (!w.isMinimized && !w.isClosing && w.id !== id && parseInt(w.el.style.zIndex || 0) > maxZ) {
          maxZ = parseInt(w.el.style.zIndex);
          nextTopWin = w;
        }
      });
      if (nextTopWin) {
        this.focusWindow(nextTopWin.id);
      }
    }

    setTimeout(() => {
      if (typeof win.onClose === 'function') {
        try {
          win.onClose();
        } catch (err) {
          console.error('Error in window onClose:', err);
        }
      }

      if (win.el && win.el.parentNode) {
        win.el.parentNode.removeChild(win.el);
      }

      this.windows.delete(id);
      this.notifyStateChange();
    }, 140);
  }

  setWindowTitle(id, newTitle) {
    const win = this.windows.get(id);
    if (!win) return;
    win.title = newTitle;
    if (win.titleEl) win.titleEl.textContent = newTitle;
    if (win.taskbarPill) {
      const p = win.taskbarPill.querySelector('.taskbar-pill-title');
      if (p) p.textContent = newTitle;
    }
  }

  setupWindowDragging(win) {
    const titlebar = win.el.querySelector(`#tb_${win.id}`);
    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let currentSnapCandidate = null;

    const onPointerMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const wsRect = this.container ? this.container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight - 38, left: 0, top: 0 };
      const availW = wsRect.width || window.innerWidth;
      const availH = wsRect.height || (window.innerHeight - 38);
      const wsLeft = wsRect.left || 0;
      const wsTop = wsRect.top || 0;

      const maxTop = Math.max(0, availH - 76 - 36);
      const newLeft = Math.max(0, Math.min(availW - 80, startLeft + deltaX));
      const newTop = Math.max(0, Math.min(maxTop, startTop + deltaY));

      win.el.style.left = `${newLeft}px`;
      win.el.style.top = `${newTop}px`;

      // Window Snap Detection (Left 50%, Right 50%, Top Maximize)
      let candidate = null;
      const edgeDistLeft = e.clientX - wsLeft;
      const edgeDistRight = (wsLeft + availW) - e.clientX;
      const edgeDistTop = e.clientY - wsTop;

      if (edgeDistTop <= 20 && edgeDistTop >= -50) {
        candidate = 'top';
      } else if (edgeDistLeft <= 26 && edgeDistLeft >= -50) {
        candidate = 'left';
      } else if (edgeDistRight <= 26 && edgeDistRight >= -50) {
        candidate = 'right';
      }

      currentSnapCandidate = candidate;

      if (this.snapPreviewEl) {
        if (candidate === 'left') {
          this.snapPreviewEl.style.left = '6px';
          this.snapPreviewEl.style.top = '6px';
          this.snapPreviewEl.style.width = `calc(50% - 10px)`;
          this.snapPreviewEl.style.height = `calc(100% - 12px)`;
          this.snapPreviewEl.classList.add('visible');
        } else if (candidate === 'right') {
          this.snapPreviewEl.style.left = `calc(50% + 4px)`;
          this.snapPreviewEl.style.top = '6px';
          this.snapPreviewEl.style.width = `calc(50% - 10px)`;
          this.snapPreviewEl.style.height = `calc(100% - 12px)`;
          this.snapPreviewEl.classList.add('visible');
        } else if (candidate === 'top') {
          this.snapPreviewEl.style.left = '6px';
          this.snapPreviewEl.style.top = '6px';
          this.snapPreviewEl.style.width = `calc(100% - 12px)`;
          this.snapPreviewEl.style.height = `calc(100% - 12px)`;
          this.snapPreviewEl.classList.add('visible');
        } else {
          this.snapPreviewEl.classList.remove('visible');
        }
      }
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      win.el.classList.remove('dragging');
      document.body.classList.remove('window-dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (this.snapPreviewEl) {
        this.snapPreviewEl.classList.remove('visible');
      }

      const wsRect = this.container ? this.container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight - 38 };
      const availW = wsRect.width || window.innerWidth;
      const availH = wsRect.height || (window.innerHeight - 38);

      if (currentSnapCandidate === 'top') {
        this.maximizeWindow(win.id);
      } else if (currentSnapCandidate === 'left') {
        if (!win.restoreRect) {
          win.restoreRect = { left: startLeft, top: startTop, width: win.el.offsetWidth, height: win.el.offsetHeight };
        }
        win.snapState = 'left';
        win.el.style.left = '4px';
        win.el.style.top = '4px';
        win.el.style.width = `${Math.round(availW / 2) - 8}px`;
        win.el.style.height = `${availH - 8}px`;
        win.el.classList.add('snapped', 'snapped-left');
        win.el.classList.remove('snapped-right');
        if (typeof win.onResize === 'function') {
          setTimeout(() => win.onResize(win.el.offsetWidth, win.el.offsetHeight), 50);
        }
      } else if (currentSnapCandidate === 'right') {
        if (!win.restoreRect) {
          win.restoreRect = { left: startLeft, top: startTop, width: win.el.offsetWidth, height: win.el.offsetHeight };
        }
        const halfW = Math.round(availW / 2);
        win.snapState = 'right';
        win.el.style.left = `${halfW + 4}px`;
        win.el.style.top = '4px';
        win.el.style.width = `${availW - halfW - 8}px`;
        win.el.style.height = `${availH - 8}px`;
        win.el.classList.add('snapped', 'snapped-right');
        win.el.classList.remove('snapped-left');
        if (typeof win.onResize === 'function') {
          setTimeout(() => win.onResize(win.el.offsetWidth, win.el.offsetHeight), 50);
        }
      }
      currentSnapCandidate = null;
    };

    titlebar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.window-controls') || e.button !== 0) return;

      // If dragging a maximized or snapped window, restore normal dimensions centered on cursor
      if (win.isMaximized) {
        const savedW = win.restoreRect ? win.restoreRect.width : 820;
        const savedH = win.restoreRect ? win.restoreRect.height : 540;
        win.isMaximized = false;
        win.el.classList.remove('maximized');
        win.el.style.width = `${savedW}px`;
        win.el.style.height = `${savedH}px`;
        startLeft = Math.max(10, e.clientX - Math.round(savedW / 2));
        startTop = Math.max(10, e.clientY - 16);
        win.el.style.left = `${startLeft}px`;
        win.el.style.top = `${startTop}px`;
        if (typeof win.onResize === 'function') win.onResize(savedW, savedH);
      } else if (win.snapState) {
        const savedW = win.restoreRect ? win.restoreRect.width : win.el.offsetWidth;
        const savedH = win.restoreRect ? win.restoreRect.height : win.el.offsetHeight;
        win.snapState = null;
        win.el.classList.remove('snapped', 'snapped-left', 'snapped-right');
        win.el.style.width = `${savedW}px`;
        win.el.style.height = `${savedH}px`;
        startLeft = Math.max(10, e.clientX - Math.round(savedW / 2));
        startTop = Math.max(10, e.clientY - 16);
        win.el.style.left = `${startLeft}px`;
        win.el.style.top = `${startTop}px`;
        if (typeof win.onResize === 'function') win.onResize(savedW, savedH);
      } else {
        startLeft = win.el.offsetLeft;
        startTop = win.el.offsetTop;
      }

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      currentSnapCandidate = null;

      win.el.classList.add('dragging');
      document.body.classList.add('window-dragging');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  setupWindowResizing(win) {
    const handles = win.el.querySelectorAll('.win-resize-handle');

    handles.forEach(handle => {
      const dir = handle.dataset.dir;

      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || win.isMaximized) return;
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = win.el.offsetWidth;
        const startHeight = win.el.offsetHeight;
        const startLeft = win.el.offsetLeft;
        const startTop = win.el.offsetTop;

        win.el.classList.add('resizing');
        document.body.classList.add('window-dragging');

        const onResizeMove = (moveEvt) => {
          const deltaX = moveEvt.clientX - startX;
          const deltaY = moveEvt.clientY - startY;
          let newW = startWidth;
          let newH = startHeight;
          let newL = startLeft;
          let newT = startTop;

          if (dir.includes('e')) newW = Math.max(win.minWidth, startWidth + deltaX);
          if (dir.includes('s')) newH = Math.max(win.minHeight, startHeight + deltaY);
          if (dir.includes('w')) {
            const potentialW = startWidth - deltaX;
            if (potentialW >= win.minWidth) {
              newW = potentialW;
              newL = startLeft + deltaX;
            }
          }
          if (dir.includes('n')) {
            const potentialH = startHeight - deltaY;
            if (potentialH >= win.minHeight) {
              newH = potentialH;
              newT = startTop + deltaY;
            }
          }

          win.el.style.width = `${newW}px`;
          win.el.style.height = `${newH}px`;
          win.el.style.left = `${newL}px`;
          win.el.style.top = `${newT}px`;

          if (typeof win.onResize === 'function') {
            win.onResize(newW, newH);
          }
        };

        const onResizeUp = () => {
          win.el.classList.remove('resizing');
          document.body.classList.remove('window-dragging');
          window.removeEventListener('pointermove', onResizeMove);
          window.removeEventListener('pointerup', onResizeUp);
          if (typeof win.onResize === 'function') {
            win.onResize(win.el.offsetWidth, win.el.offsetHeight);
          }
        };

        window.addEventListener('pointermove', onResizeMove);
        window.addEventListener('pointerup', onResizeUp);
      });
    });
  }

  // Window Arrangers
  cascadeWindows() {
    let offset = 40;
    this.windows.forEach(win => {
      if (win.isMinimized) this.restoreWindow(win.id);
      if (win.isMaximized) win.el.classList.remove('maximized');
      win.isMaximized = false;
      win.el.style.left = `${offset}px`;
      win.el.style.top = `${offset}px`;
      win.el.style.width = '840px';
      win.el.style.height = '520px';
      offset += 32;
      if (typeof win.onResize === 'function') win.onResize(840, 520);
    });
  }

  minimizeAll() {
    this.windows.forEach(win => {
      this.minimizeWindow(win.id);
    });
  }

  notifyStateChange() {
    if (typeof this.onWindowStateChange === 'function') {
      this.onWindowStateChange(this.windows, this.activeWindowId);
    }
  }
}

// Global Singleton
window.WindowManager = new DesktopWindowManager();

// =========================================================================
// DESKTOP MODAL SYSTEM (Replaces native browser alert, confirm, prompt)
// =========================================================================
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
      position: fixed; inset: 0; background: rgba(var(--shade), 0.75);
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 100020; padding: 1.25rem; font-family: var(--font-sans); color: var(--text-primary);
    `;

    const isOutput = cfg.type === 'output';
    const isDanger = cfg.isDanger || cfg.type === 'danger';
    const maxWidth = isOutput ? '700px' : '480px';

    let iconSvg = '<svg style="width:16px;height:16px;color:var(--sm-accent);flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (isDanger) {
      iconSvg = '<svg style="width:16px;height:16px;color:var(--c-bad);flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (cfg.type === 'success' || (isOutput && cfg.isSuccess)) {
      iconSvg = '<svg style="width:16px;height:16px;color:var(--c-ok);flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (isOutput && !cfg.isSuccess) {
      iconSvg = '<svg style="width:16px;height:16px;color:var(--c-bad);flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }

    let bodyHtml = '';
    if (isOutput) {
      const escaped = (cfg.output || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      bodyHtml = `
        <div style="display:flex; flex-direction:column; gap:0.5rem; flex:1; min-height:0;">
          ${cfg.subtitle ? `<div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono); word-break:break-all;">${cfg.subtitle}</div>` : ''}
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.15rem;">
            <span style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Output Details</span>
            <button type="button" class="btn btn-secondary btn-xs" id="dmCopyOutputBtn" style="font-size:0.68rem; padding:0.15rem 0.5rem;">
              Copy Output
            </button>
          </div>
          <div id="dmOutputPane" style="background:var(--bg-system); border:1px solid var(--border-subtle); border-radius:6px; padding:0.75rem; font-family:monospace; font-size:0.78rem; line-height:1.45; color:var(--text-secondary); max-height:360px; overflow-y:auto; white-space:pre-wrap; word-break:break-all;">${escaped}</div>
        </div>
      `;
    } else if (cfg.type === 'prompt') {
      bodyHtml = `
        <div style="display:flex; flex-direction:column; gap:0.65rem;">
          <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45; white-space:pre-wrap;">${cfg.message}</div>
          <input type="text" id="dmPromptInput" value="${(cfg.defaultValue || '').replace(/"/g, '&quot;')}" placeholder="${cfg.placeholder || ''}" class="form-control" style="width:100%; font-size:0.82rem; padding:0.45rem 0.65rem;" spellcheck="false" autocomplete="off">
        </div>
      `;
    } else {
      bodyHtml = `
        <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.5; white-space:pre-wrap; word-break:break-word;">${cfg.message}</div>
      `;
    }

    overlay.innerHTML = `
      <div style="width:100%; max-width:${maxWidth}; max-height:85vh; background:var(--bg-surface, var(--bg-system)); border:1px solid var(--border-color, var(--sm-line-strong)); border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.85); display:flex; flex-direction:column; overflow:hidden;">
        <!-- Header -->
        <div style="height:42px; padding:0 1rem; border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; background:rgba(var(--wash),0.02); flex-shrink:0;">
          <div style="display:flex; align-items:center; gap:0.5rem; min-width:0;">
            ${iconSvg}
            <span style="font-weight:700; font-size:0.88rem; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cfg.title}</span>
            ${isOutput && cfg.exitCode !== null && cfg.exitCode !== undefined ? `<span style="font-size:0.68rem; padding:0.1rem 0.4rem; border-radius:3px; font-weight:700; font-family:monospace; ${cfg.isSuccess ? 'background:rgba(16,185,129,0.15); color:var(--c-ok);' : 'background:rgba(239,68,68,0.15); color:var(--c-bad);'}">EXIT ${cfg.exitCode}</span>` : ''}
          </div>
          <button class="btn btn-secondary btn-xs" id="dmCloseBtn" style="padding:0.15rem 0.45rem; line-height:1;">&times;</button>
        </div>

        <!-- Body -->
        <div style="padding:1.15rem 1.25rem; overflow-y:auto; flex:1; min-height:0;">
          ${bodyHtml}
        </div>

        <!-- Footer -->
        <div style="padding:0.75rem 1rem; border-top:1px solid var(--border-subtle); background:rgba(var(--shade),0.25); display:flex; align-items:center; justify-content:flex-end; gap:0.5rem; flex-shrink:0;">
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

if (!window.DesktopModal) {
  window.DesktopModal = new DesktopModalManager();
}
if (!window._origAlert) {
  window._origAlert = window.alert;
  window.alert = function(msg) {
    if (window.DesktopModal) {
      window.DesktopModal.alert(msg);
    } else {
      console.warn('Alert:', msg);
    }
  };
}