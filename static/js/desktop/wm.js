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
      contentHtml = '',
      onInit = null,
      onResize = null,
      onClose = null,
      multiInstance = false
    } = options;

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

    const defaultX = Math.max(16, Math.min(availableW - winW - 16, 40 + (this.cascadeStep % 6) * 32));
    const defaultY = Math.max(12, Math.min(availableH - winH - 24, 28 + (this.cascadeStep % 6) * 24));
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
      onClose
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

    setTimeout(() => {
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
      // Save current geometry and maximize
      win.restoreRect = {
        left: win.el.offsetLeft,
        top: win.el.offsetTop,
        width: win.el.offsetWidth,
        height: win.el.offsetHeight
      };
      win.isMaximized = true;
      win.el.classList.add('maximized');
    }

    this.focusWindow(id);

    if (typeof win.onResize === 'function') {
      setTimeout(() => {
        win.onResize(win.el.offsetWidth, win.el.offsetHeight);
      }, 50);
    }
  }

  closeWindow(id) {
    const win = this.windows.get(id);
    if (!win || win.isClosing) return;

    win.isClosing = true;
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

    const onPointerMove = (e) => {
      if (!isDragging) return;
      if (win.isMaximized) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const wsRect = this.container ? this.container.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight - 38 };
      const availW = wsRect.width || window.innerWidth;
      const availH = wsRect.height || (window.innerHeight - 38);

      const maxTop = Math.max(0, availH - 76 - 36);
      const newLeft = Math.max(0, Math.min(availW - 80, startLeft + deltaX));
      const newTop = Math.max(0, Math.min(maxTop, startTop + deltaY));

      win.el.style.left = `${newLeft}px`;
      win.el.style.top = `${newTop}px`;
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      win.el.classList.remove('dragging');
      document.body.classList.remove('window-dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    titlebar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.window-controls') || e.button !== 0) return;
      if (win.isMaximized) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = win.el.offsetLeft;
      startTop = win.el.offsetTop;

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

