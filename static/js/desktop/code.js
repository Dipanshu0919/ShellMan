/**
 * ShellMan OS: Monaco Code Workspace (code.js)
 */

DesktopAppsController.prototype.launchCode = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('code');
    if (existing) {
      if (existing.isMinimized) WindowManager.restoreWindow(existing.id);
      WindowManager.focusWindow(existing.id);
      if (params.root && existing._setRoot) {
        existing._setRoot(params.root);
      }
      if (params.isDir && params.path && existing._setRoot) {
        existing._setRoot(params.path);
      }
      if (params.paths && Array.isArray(params.paths) && existing._openFile) {
        params.paths.forEach(p => existing._openFile(p));
      } else if (params.path && !params.isDir && existing._openFile) {
        existing._openFile(params.path);
      }
      return existing;
    }

    const codeId = 'code_' + Date.now();
    let initialFiles = [];
    if (params.paths && Array.isArray(params.paths)) {
      initialFiles = params.paths;
    } else if (params.path && !params.isDir) {
      initialFiles = [params.path];
    }
    const initialRoot = params.root || (params.isDir && params.path ? params.path : '~');

    return WindowManager.createWindow({
      appId: 'code',
      multiInstance: false,
      title: `Code Workspace - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="#0f172a"/><polyline points="8 17 3 12 8 7" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16 7 21 12 16 17" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="14" y1="4" x2="10" y2="20" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/></svg>',
      width: 1080,
      height: 680,
      minWidth: 640,
      minHeight: 400,
      contentHtml: `
        <div class="code-workspace-app" id="capp_${codeId}" style="height:100%; display:flex; flex-direction:column; background:#141824; position:relative; overflow:hidden;">
          <!-- Top IDE Action Bar -->
          <header style="height:36px; background:#0e131f; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; padding:0 0.75rem; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span style="font-size:0.75rem; font-weight:600; color:#cbd5e1; display:flex; align-items:center; gap:0.4rem;">
                <svg style="width:14px;height:14px;color:#818cf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                Workspace:
              </span>
              <span id="wsRootLabel_${codeId}" style="font-family:var(--font-mono); font-size:0.74rem; color:#38bdf8; background:rgba(56,189,248,0.1); padding:0.15rem 0.5rem; border-radius:var(--radius-xs);">~</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-primary btn-sm" id="saveCodeBtn_${codeId}" title="Save File (Ctrl+S)">
                <svg style="width:12px;height:12px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Save
              </button>
              <button class="btn btn-secondary btn-sm" id="toggleTermBtn_${codeId}" title="Toggle Terminal (Ctrl+\`)">
                <svg style="width:12px;height:12px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                Terminal
              </button>
            </div>
          </header>

          <!-- Middle Split: Activity Bar + Sidebar + Main Editor -->
          <div style="display:flex; flex:1; overflow:hidden;">
            <!-- Left Activity Bar (44px) -->
            <div style="width:44px; background:#090d16; border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; align-items:center; padding:0.5rem 0; gap:0.5rem; flex-shrink:0;">
              <button class="btn btn-ghost btn-xs code-act-btn active" id="actExplorer_${codeId}" title="File Explorer" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs);">
                <svg style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              </button>
              <button class="btn btn-ghost btn-xs code-act-btn" id="actSearch_${codeId}" title="Search in Files" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs);">
                <svg style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </button>
              <div style="width:20px; height:1px; background:rgba(255,255,255,0.08); margin:0.2rem 0;"></div>
              <button class="btn btn-ghost btn-xs code-act-btn" id="actTerminal_${codeId}" title="Toggle Integrated Terminal" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs);">
                <svg style="width:18px;height:18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
              </button>
              <button class="btn btn-ghost btn-xs code-act-btn" id="actRefresh_${codeId}" title="Refresh Explorer Tree" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:var(--radius-xs);">
                <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </button>
            </div>

            <!-- Left Sidebar (Explorer / Search) -->
            <aside class="code-sidebar" id="sidebar_${codeId}" style="width:230px; background:#0f1420; border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; flex-shrink:0;">
              <!-- Pane 1: File Explorer -->
              <div id="paneExplorer_${codeId}" style="display:flex; flex-direction:column; height:100%;">
                <div class="code-sidebar-header" style="height:32px; padding:0 0.65rem; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.68rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">
                  <span>Explorer</span>
                  <div style="display:flex; align-items:center; gap:0.2rem;">
                    <button class="btn btn-ghost btn-xs" id="treeNewFile_${codeId}" title="New File" style="padding:2px 4px;"><svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
                    <button class="btn btn-ghost btn-xs" id="treeNewDir_${codeId}" title="New Folder" style="padding:2px 4px;"><svg style="width:11px;height:11px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg></button>
                  </div>
                </div>
                <div id="treeContainer_${codeId}" class="code-sidebar-content" style="flex:1; overflow-y:auto; padding:0.25rem 0;">
                  <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.75rem;">Loading files...</div>
                </div>
              </div>

              <!-- Pane 2: Search in Files -->
              <div id="paneSearch_${codeId}" style="display:none; flex-direction:column; height:100%;">
                <div class="code-sidebar-header" style="height:32px; padding:0 0.65rem; display:flex; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.68rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">
                  <span>Search in Files</span>
                </div>
                <div style="padding:0.6rem; display:flex; flex-direction:column; gap:0.4rem; border-bottom:1px solid rgba(255,255,255,0.06);">
                  <div style="display:flex; gap:0.3rem;">
                    <input type="text" id="searchInp_${codeId}" placeholder="Search text..." class="form-control" style="font-size:0.75rem; padding:0.25rem 0.5rem; flex:1;">
                    <button class="btn btn-secondary btn-sm" id="searchExecBtn_${codeId}" style="padding:0 0.5rem;">Go</button>
                  </div>
                </div>
                <div id="searchResults_${codeId}" style="flex:1; overflow-y:auto; padding:0.4rem;">
                  <div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.73rem;">Enter a query to search inside remote workspace files</div>
                </div>
              </div>
            </aside>

            <!-- Main Editor Area -->
            <div class="code-main-area" style="flex:1; display:flex; flex-direction:column; overflow:hidden; background:#1e1e1e;">
              <!-- Editor Tabs Bar -->
              <div class="code-tabs-bar" id="tabsBar_${codeId}" style="height:35px; background:#111520; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; overflow-x:auto; flex-shrink:0;">
                <div style="padding:0 1rem; color:var(--text-muted); font-size:0.73rem;">No file open</div>
              </div>

              <!-- Monaco / Fallback Container -->
              <div class="code-editor-viewport" id="editorViewport_${codeId}" style="flex:1; width:100%; height:100%; overflow:hidden; position:relative;">
                <div id="monaco_${codeId}" style="width:100%; height:100%; overflow:hidden;"></div>
                <textarea id="fallbackTxt_${codeId}" style="width:100%; height:100%; background:#1e1e1e; color:#f8fafc; font-family:var(--font-mono); font-size:0.88rem; border:none; padding:1rem; resize:none; outline:none; display:none;"></textarea>
                <div id="dropOverlay_${codeId}" style="display:none; position:absolute; inset:0; background:rgba(15,23,42,0.88); backdrop-filter:blur(4px); border:2px dashed #38bdf8; z-index:100; pointer-events:none; flex-direction:column; align-items:center; justify-content:center; gap:0.6rem; color:#38bdf8;">
                  <svg style="width:44px;height:44px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <div style="font-weight:700; font-size:1rem; color:#f8fafc;">Drop local file here to open in editor</div>
                  <div style="font-size:0.75rem; color:#94a3b8;">Opens in editable tabs. Press Save to upload to remote workspace.</div>
                </div>
              </div>

              <!-- Vertical Resizer for Terminal Panel -->
              <div class="code-terminal-resizer" id="termResizer_${codeId}" style="height:5px; cursor:row-resize; background:rgba(255,255,255,0.06); display:none; flex-shrink:0;" title="Drag to resize terminal"></div>

              <!-- Collapsible Bottom Terminal Panel -->
              <div class="code-terminal-panel" id="termPanel_${codeId}" style="height:190px; min-height:120px; display:none; flex-direction:column; background:#090d16; border-top:1px solid rgba(56,189,248,0.25); flex-shrink:0;">
                <div class="code-term-header" style="height:28px; background:#0f1522; border-bottom:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:space-between; padding:0 0.65rem;">
                  <div style="display:flex; align-items:center; gap:0.4rem;">
                    <span class="status-dot connected"></span>
                    <span style="font-family:var(--font-mono); font-size:0.7rem; color:#cbd5e1; font-weight:600;">TERMINAL (PTY)</span>
                  </div>
                  <div style="display:flex; align-items:center; gap:0.3rem;">
                    <button class="btn btn-ghost btn-xs" id="termClearBtn_${codeId}" title="Clear">Clear</button>
                    <button class="btn btn-ghost btn-xs" id="termCloseBtn_${codeId}" title="Close Terminal">×</button>
                  </div>
                </div>
                <div class="code-term-viewport" id="termScreen_${codeId}" style="flex:1; width:100%; height:100%; overflow:hidden; padding:4px;"></div>
              </div>

              <!-- Bottom Status Bar -->
              <footer class="code-statusbar" style="height:24px; background:#0d121c; border-top:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between; padding:0 0.75rem; font-size:0.68rem; color:#64748b; font-family:var(--font-mono); flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                  <span id="stFilePath_${codeId}" style="color:#94a3b8;">Ready</span>
                  <span id="stDirty_${codeId}" style="color:#38bdf8; display:none;">• Modified</span>
                </div>
                <div style="display:flex; align-items:center; gap:0.8rem;">
                  <span id="stCursor_${codeId}">Ln 1, Col 1</span>
                  <span>UTF-8</span>
                  <span id="stLang_${codeId}" style="color:#38bdf8; font-weight:500;">Plain Text</span>
                </div>
              </footer>
            </div>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        let currentWorkspaceRoot = '~';
        let editor = null;
        let isUsingFallback = false;
        let openTabs = new Map(); // path -> { model, dirty, lang, content }
        let activePath = null;
        let isTerminalOpen = false;
        let termSocket = null;
        let termInstance = null;
        let termFitAddon = null;

        const monacoContainer = bodyEl.querySelector(`#monaco_${codeId}`);
        const fallbackTxt = bodyEl.querySelector(`#fallbackTxt_${codeId}`);
        const tabsBar = bodyEl.querySelector(`#tabsBar_${codeId}`);
        const saveBtn = bodyEl.querySelector(`#saveCodeBtn_${codeId}`);
        const toggleTermBtn = bodyEl.querySelector(`#toggleTermBtn_${codeId}`);
        const termPanel = bodyEl.querySelector(`#termPanel_${codeId}`);
        const termResizer = bodyEl.querySelector(`#termResizer_${codeId}`);
        const termScreen = bodyEl.querySelector(`#termScreen_${codeId}`);
        const termCloseBtn = bodyEl.querySelector(`#termCloseBtn_${codeId}`);
        const termClearBtn = bodyEl.querySelector(`#termClearBtn_${codeId}`);
        const treeContainer = bodyEl.querySelector(`#treeContainer_${codeId}`);
        const wsRootLabel = bodyEl.querySelector(`#wsRootLabel_${codeId}`);
        const stFilePath = bodyEl.querySelector(`#stFilePath_${codeId}`);
        const stDirty = bodyEl.querySelector(`#stDirty_${codeId}`);
        const stCursor = bodyEl.querySelector(`#stCursor_${codeId}`);
        const stLang = bodyEl.querySelector(`#stLang_${codeId}`);

        // Activity bar panes
        const actExplorer = bodyEl.querySelector(`#actExplorer_${codeId}`);
        const actSearch = bodyEl.querySelector(`#actSearch_${codeId}`);
        const actTerminal = bodyEl.querySelector(`#actTerminal_${codeId}`);
        const actRefresh = bodyEl.querySelector(`#actRefresh_${codeId}`);
        const paneExplorer = bodyEl.querySelector(`#paneExplorer_${codeId}`);
        const paneSearch = bodyEl.querySelector(`#paneSearch_${codeId}`);

        const searchInp = bodyEl.querySelector(`#searchInp_${codeId}`);
        const searchExecBtn = bodyEl.querySelector(`#searchExecBtn_${codeId}`);
        const searchResults = bodyEl.querySelector(`#searchResults_${codeId}`);

        // Context Menu helpers for Code Workspace (Tree and Tabs)
        let activeCodeCtxMenu = null;
        const hideCodeContextMenu = () => {
          if (activeCodeCtxMenu && activeCodeCtxMenu.parentNode) {
            activeCodeCtxMenu.parentNode.removeChild(activeCodeCtxMenu);
          }
          activeCodeCtxMenu = null;
        };

        const onCodePointerDownOutside = (e) => {
          if (activeCodeCtxMenu && !e.target.closest('.file-context-menu')) {
            hideCodeContextMenu();
          }
        };
        document.addEventListener('pointerdown', onCodePointerDownOutside);

        const onCodeKeyDownEsc = (e) => {
          if (e.key === 'Escape') hideCodeContextMenu();
        };
        document.addEventListener('keydown', onCodeKeyDownEsc);

        const showCodeContextMenu = (x, y, itemsHtml) => {
          hideCodeContextMenu();
          const menu = document.createElement('div');
          menu.className = 'file-context-menu';
          menu.innerHTML = itemsHtml;
          document.body.appendChild(menu);
          activeCodeCtxMenu = menu;

          const menuW = 215;
          const menuH = menu.offsetHeight || 260;
          const clampedX = Math.min(x, window.innerWidth - menuW - 12);
          const clampedY = Math.min(y, window.innerHeight - menuH - 12);
          menu.style.left = `${Math.max(10, clampedX)}px`;
          menu.style.top = `${Math.max(10, clampedY)}px`;
        };

        // Language mapper
        const getLanguageFromPath = (fpath) => {
          const ext = (fpath.split('.').pop() || '').toLowerCase();
          const map = {
            js: 'javascript', mjs: 'javascript', cjs: 'javascript',
            ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
            py: 'python', sh: 'shell', bash: 'shell', zsh: 'shell',
            json: 'json', html: 'html', htm: 'html', css: 'css', scss: 'scss',
            yml: 'yaml', yaml: 'yaml', md: 'markdown', markdown: 'markdown',
            sql: 'sql', php: 'php', rb: 'ruby', go: 'go', rs: 'rust',
            c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', java: 'java',
            xml: 'xml', ini: 'ini', conf: 'ini'
          };
          return map[ext] || 'plaintext';
        };

        // Initialize Monaco Editor
        const initEditor = () => {
          if (window.monaco) {
            createMonaco();
          } else if (window.require) {
            window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
            window.require(['vs/editor/editor.main'], () => {
              createMonaco();
            }, () => {
              useFallback();
            });
          } else {
            useFallback();
          }
        };

        const createMonaco = () => {
          editor = monaco.editor.create(monacoContainer, {
            value: '// Remote Code Workspace\n// Select a file from the explorer tree on the left to edit\n',
            language: 'plaintext',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            minimap: { enabled: false } // MINIMAP STRICTLY DISABLED
          });

          editor.onDidChangeCursorPosition((e) => {
            if (stCursor) stCursor.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
          });

          if (initialFiles.length > 0) {
            initialFiles.forEach(fp => openFile(fp));
          }
        };

        const useFallback = () => {
          isUsingFallback = true;
          fallbackTxt.style.display = 'block';
          fallbackTxt.value = '// Remote Code Workspace\n// Select a file from the explorer tree to edit\n';
          if (initialFiles.length > 0) {
            initialFiles.forEach(fp => openFile(fp));
          }
        };

        // Tabs Bar Rendering
        const renderTabs = () => {
          if (openTabs.size === 0) {
            tabsBar.innerHTML = `<div style="padding:0 1rem; color:var(--text-muted); font-size:0.73rem;">No file open</div>`;
            stFilePath.textContent = 'Ready';
            stDirty.style.display = 'none';
            stLang.textContent = 'Plain Text';
            winObj.titleEl.textContent = `Code Workspace - ${this.serverName}`;
            return;
          }

          let html = '';
          for (const [fpath, tab] of openTabs.entries()) {
            const fileName = fpath.split('/').pop() || fpath;
            const isActive = fpath === activePath;
            html += `
              <div class="code-tab ${isActive ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}" data-path="${fpath}" style="height:100%; padding:0 0.75rem; display:inline-flex; align-items:center; gap:0.45rem; background:${isActive ? '#1e1e1e' : '#141926'}; border-right:1px solid rgba(255,255,255,0.06); border-top:2px solid ${isActive ? '#38bdf8' : 'transparent'}; color:${isActive ? '#ffffff' : '#94a3b8'}; font-size:0.74rem; cursor:pointer; user-select:none; white-space:nowrap;">
                <span>${fileName}</span>
                <span class="code-tab-dirty" style="width:6px; height:6px; border-radius:50%; background:#38bdf8; display:${tab.dirty ? 'inline-block' : 'none'};"></span>
                <span class="code-tab-close" data-close-path="${fpath}" style="font-size:12px; margin-left:2px; opacity:0.6; padding:0 2px; border-radius:2px;" title="Close">×</span>
              </div>
            `;
          }
          tabsBar.innerHTML = html;

          if (activePath && openTabs.has(activePath)) {
            const activeTab = openTabs.get(activePath);
            stFilePath.textContent = activePath;
            stDirty.style.display = activeTab.dirty ? 'inline' : 'none';
            stLang.textContent = activeTab.lang.toUpperCase();
            winObj.titleEl.textContent = `Code: ${activePath.split('/').pop()} - ${this.serverName}`;
          }
        };

        // Open File in Tab
        const openFile = async (fpath, lineToJump = null) => {
          try {
            if (openTabs.has(fpath)) {
              activePath = fpath;
              const tab = openTabs.get(fpath);
              if (editor && tab.model) {
                editor.setModel(tab.model);
              } else if (fallbackTxt) {
                fallbackTxt.value = tab.content;
              }
              if (lineToJump && editor) {
                editor.revealLineInCenter(lineToJump);
                editor.setPosition({ lineNumber: lineToJump, column: 1 });
              }
              renderTabs();
              return;
            }

            stFilePath.textContent = `Loading ${fpath}...`;
            const resp = await fetch(`/api/servers/${this.serverId}/files/read?path=${encodeURIComponent(fpath)}`);
            const res = await resp.json();
            if (!res.success) {
              DesktopModal.alert({ title: 'Open File Failed', message: res.error || 'Could not open file.', type: 'danger' });
              stFilePath.textContent = 'Error opening file';
              return;
            }

            const content = res.data.content || '';
            const lang = getLanguageFromPath(fpath);
            let model = null;

            if (window.monaco && editor) {
              const uri = monaco.Uri.parse(`inmemory://remote/${fpath.replace(/^\//, '')}`);
              model = monaco.editor.getModel(uri);
              if (!model) {
                model = monaco.editor.createModel(content, lang, uri);
              } else {
                model.setValue(content);
              }
              model.onDidChangeContent(() => {
                const cur = openTabs.get(fpath);
                if (cur && !cur.dirty) {
                  cur.dirty = true;
                  renderTabs();
                }
              });
            }

            openTabs.set(fpath, { model, content, dirty: false, lang });
            activePath = fpath;

            if (editor && model) {
              editor.setModel(model);
              if (lineToJump) {
                editor.revealLineInCenter(lineToJump);
                editor.setPosition({ lineNumber: lineToJump, column: 1 });
              }
            } else if (fallbackTxt) {
              fallbackTxt.value = content;
            }

            renderTabs();
          } catch (e) {
            DesktopModal.alert({ title: 'Open Error', message: String(e), type: 'danger' });
          }
        };

        // Expose openFile to windowObj so Files app can call it
        winObj._openFile = openFile;

        // Close File Tab
        const closeFile = async (fpath) => {
          const tab = openTabs.get(fpath);
          if (tab && tab.dirty) {
            const ok = await DesktopModal.confirm({
              title: 'Unsaved Changes',
              message: `"${fpath.split('/').pop()}" has unsaved changes. Close anyway?`,
              confirmText: 'Close Without Saving',
              isDanger: true
            });
            if (!ok) return;
          }
          if (tab && tab.model) {
            tab.model.dispose();
          }
          openTabs.delete(fpath);

          if (activePath === fpath) {
            const keys = Array.from(openTabs.keys());
            if (keys.length > 0) {
              openFile(keys[keys.length - 1]);
            } else {
              activePath = null;
              if (editor) {
                editor.setModel(monaco.editor.createModel('// No file open', 'plaintext'));
              } else if (fallbackTxt) {
                fallbackTxt.value = '// No file open';
              }
              renderTabs();
            }
          } else {
            renderTabs();
          }
        };

        tabsBar.addEventListener('click', (e) => {
          const closeBtn = e.target.closest('.code-tab-close');
          if (closeBtn) {
            e.stopPropagation();
            closeFile(closeBtn.dataset.closePath);
            return;
          }
          const tabEl = e.target.closest('.code-tab');
          if (tabEl) {
            openFile(tabEl.dataset.path);
          }
        });

        // Tabs Bar Right-Click Context Menu
        tabsBar.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();

          const tabEl = e.target.closest('.code-tab');
          if (!tabEl) return;
          const fpath = tabEl.dataset.path;
          const tabName = fpath.split('/').pop() || fpath;

          const menuHtml = `
            <div class="file-context-header" style="padding:0.35rem 0.65rem; font-size:0.68rem; font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid rgba(255,255,255,0.06); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(tabName)}
            </div>
            <div class="file-context-item" id="tab_ctx_close">
              <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <span>Close Tab</span>
            </div>
            <div class="file-context-item" id="tab_ctx_close_others">
              <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line></svg>
              <span>Close Others</span>
            </div>
            <div class="file-context-item" id="tab_ctx_close_all">
              <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg>
              <span>Close All</span>
            </div>
            <div class="file-context-separator" style="height:1px; background:rgba(255,255,255,0.06); margin:3px 0;"></div>
            <div class="file-context-item" id="tab_ctx_save">
              <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>
              <span>Save File</span>
            </div>
            <div class="file-context-item" id="tab_ctx_copy_path">
              <svg style="width:13px;height:13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              <span>Copy Path</span>
            </div>
          `;

          showCodeContextMenu(e.clientX, e.clientY, menuHtml);

          if (activeCodeCtxMenu.querySelector('#tab_ctx_close')) {
            activeCodeCtxMenu.querySelector('#tab_ctx_close').onclick = () => {
              hideCodeContextMenu();
              closeFile(fpath);
            };
          }

          if (activeCodeCtxMenu.querySelector('#tab_ctx_close_others')) {
            activeCodeCtxMenu.querySelector('#tab_ctx_close_others').onclick = async () => {
              hideCodeContextMenu();
              for (const [key] of Array.from(openTabs.entries())) {
                if (key !== fpath) {
                  await closeFile(key);
                }
              }
            };
          }

          if (activeCodeCtxMenu.querySelector('#tab_ctx_close_all')) {
            activeCodeCtxMenu.querySelector('#tab_ctx_close_all').onclick = async () => {
              hideCodeContextMenu();
              for (const [key] of Array.from(openTabs.entries())) {
                await closeFile(key);
              }
            };
          }

          if (activeCodeCtxMenu.querySelector('#tab_ctx_save')) {
            activeCodeCtxMenu.querySelector('#tab_ctx_save').onclick = () => {
              hideCodeContextMenu();
              if (activePath !== fpath) openFile(fpath);
              saveActiveFile();
            };
          }

          if (activeCodeCtxMenu.querySelector('#tab_ctx_copy_path')) {
            activeCodeCtxMenu.querySelector('#tab_ctx_copy_path').onclick = () => {
              hideCodeContextMenu();
              navigator.clipboard.writeText(fpath);
              if (window.showToast) window.showToast(`Copied path: ${fpath}`, 'info');
            };
          }
        });

        // Save active file
        const saveActiveFile = async () => {
          if (!activePath) return;
          const tab = openTabs.get(activePath);
          if (!tab) return;

          let targetPath = activePath;
          const isLocal = tab.isLocal || activePath.startsWith('[Local] ');
          if (isLocal) {
            const defaultDir = currentWorkspaceRoot === '~' ? '/root' : currentWorkspaceRoot;
            const fileName = tab.localFileName || activePath.replace(/^\[Local\]\s*/, '');
            const chosenPath = await DesktopModal.prompt({
              title: 'Upload & Save to Remote Server',
              message: `Enter destination path on ${this.serverName}:`,
              defaultValue: `${defaultDir}/${fileName}`,
              placeholder: '/path/to/remote/file'
            });
            if (!chosenPath) return;
            targetPath = chosenPath.trim();
          }

          const content = editor && tab.model ? tab.model.getValue() : fallbackTxt.value;
          saveBtn.disabled = true;
          saveBtn.textContent = 'Saving...';

          try {
            const resp = await fetch(`/api/servers/${this.serverId}/files/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: targetPath, content })
            });
            const res = await resp.json();
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<svg style="width:12px;height:12px;margin-right:3px;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>Save`;

            if (res.success) {
              if (isLocal) {
                const oldPath = activePath;
                tab.isLocal = false;
                tab.dirty = false;
                openTabs.delete(oldPath);
                openTabs.set(targetPath, tab);
                activePath = targetPath;
                if (typeof loadTree === 'function') loadTree(currentWorkspaceRoot);
              } else {
                tab.dirty = false;
              }
              renderTabs();
              if (window.showToast) window.showToast(`Saved ${targetPath.split('/').pop()}`, 'success');
            } else {
              DesktopModal.alert({ title: 'Save Failed', message: res.error || 'Could not save file.', type: 'danger' });
            }
          } catch (e) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
            DesktopModal.alert({ title: 'Save Error', message: String(e), type: 'danger' });
          }
        };

        saveBtn.onclick = saveActiveFile;

        bodyEl.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            e.stopPropagation();
            saveActiveFile();
          } else if ((e.ctrlKey || e.metaKey) && e.key === '`') {
            e.preventDefault();
            e.stopPropagation();
            toggleTerminal();
          }
        });

        // Remote Explorer Tree
        const loadTree = async (rootPath = '~') => {
          try {
            treeContainer.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.75rem;"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Loading remote files...</div>`;
            const resp = await fetch(`/api/servers/${this.serverId}/files/list?path=${encodeURIComponent(rootPath)}`);
            const res = await resp.json();
            if (!res.success) {
              treeContainer.innerHTML = `<div style="padding:1rem; color:var(--accent-rose); font-size:0.75rem;">Error loading tree: ${res.error}</div>`;
              return;
            }
            currentWorkspaceRoot = res.data.current_path;
            wsRootLabel.textContent = currentWorkspaceRoot;

            renderTreeNodes(treeContainer, res.data.items || [], 0);
          } catch (e) {
            treeContainer.innerHTML = `<div style="padding:1rem; color:var(--accent-rose); font-size:0.75rem;">Tree error: ${e}</div>`;
          }
        };

        const renderTreeNodes = (container, items, depth = 0) => {
          // Sort directories first, then alphabetical
          items.sort((a, b) => {
            if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
            return a.is_dir ? -1 : 1;
          });

          if (items.length === 0) {
            container.innerHTML = `<div style="padding:0.5rem 1rem; color:var(--text-muted); font-size:0.72rem;">Empty directory</div>`;
            return;
          }

          container.innerHTML = items.map(item => {
            const indent = depth * 14 + 8;
            const arrow = item.is_dir ? `<span class="code-tree-arrow" style="width:12px; height:12px; display:inline-flex; align-items:center; justify-content:center; color:#64748b; margin-right:2px; font-size:9px;">▶</span>` : `<span style="width:14px; display:inline-block;"></span>`;
            const icon = item.is_dir
              ? `<svg style="width:13px;height:13px;color:#38bdf8;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
              : `<svg style="width:13px;height:13px;color:#94a3b8;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>`;

            return `
              <div class="code-tree-node" style="user-select:none;">
                <div class="code-tree-item" data-path="${item.path}" data-is-dir="${item.is_dir}" style="display:flex; align-items:center; gap:0.35rem; padding:0.25rem 0.5rem 0.25rem ${indent}px; font-size:0.75rem; color:#cbd5e1; cursor:pointer; border-radius:var(--radius-xs);">
                  ${arrow}
                  ${icon}
                  <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${item.name}</span>
                </div>
                ${item.is_dir ? `<div class="code-tree-children" data-child-for="${item.path}" style="display:none;"></div>` : ''}
              </div>
            `;
          }).join('');
        };

        // Tree interactions (expand/collapse directories or open files)
        treeContainer.addEventListener('click', async (e) => {
          const itemEl = e.target.closest('.code-tree-item');
          if (!itemEl) return;
          const p = itemEl.dataset.path;
          const isDir = itemEl.dataset.isDir === 'true';

          if (isDir) {
            const nodeEl = itemEl.closest('.code-tree-node');
            const childEl = nodeEl.querySelector(`.code-tree-children[data-child-for="${CSS.escape(p)}"]`);
            const arrowEl = itemEl.querySelector('.code-tree-arrow');
            if (childEl.style.display === 'none') {
              childEl.style.display = 'block';
              if (arrowEl) arrowEl.style.transform = 'rotate(90deg)';
              if (!childEl.hasChildNodes() || childEl.innerHTML === '') {
                childEl.innerHTML = `<div style="padding:0.25rem 1.5rem; color:var(--text-muted); font-size:0.7rem;">Loading...</div>`;
                const resp = await fetch(`/api/servers/${this.serverId}/files/list?path=${encodeURIComponent(p)}`);
                const res = await resp.json();
                if (res.success) {
                  const depth = (itemEl.style.paddingLeft ? parseInt(itemEl.style.paddingLeft, 10) : 8) / 14;
                  renderTreeNodes(childEl, res.data.items || [], depth);
                } else {
                  childEl.innerHTML = `<div style="padding:0.25rem 1.5rem; color:var(--accent-rose); font-size:0.7rem;">Error</div>`;
                }
              }
            } else {
              childEl.style.display = 'none';
              if (arrowEl) arrowEl.style.transform = 'rotate(0deg)';
            }
          } else {
            openFile(p);
          }
        });

        // Tree context menu (Right-click on files, folders, or explorer background)
        treeContainer.addEventListener('contextmenu', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const itemEl = e.target.closest('.code-tree-item');
          if (itemEl) {
            const itemPath = itemEl.dataset.path;
            const isDir = itemEl.dataset.isDir === 'true';
            const itemName = itemPath.split('/').filter(Boolean).pop() || itemPath;
            const parentDir = itemPath.substring(0, itemPath.lastIndexOf('/')) || '/';
            const relPath = itemPath.startsWith(currentWorkspaceRoot)
              ? itemPath.substring(currentWorkspaceRoot.length).replace(/^\/+/, '')
              : itemName;

            if (isDir) {
              // Directory Context Menu
              showCodeContextMenu(e.clientX, e.clientY, `
                <div class="file-context-header" style="padding: 0.35rem 0.65rem; font-size: 0.68rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.06); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${escapeHtml(itemName)}
                </div>
                <div class="file-context-item" id="code_ctx_new_file">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                  <span>New File...</span>
                </div>
                <div class="file-context-item" id="code_ctx_new_folder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                  <span>New Folder...</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="code_ctx_term">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                  <span>Open Terminal Here</span>
                </div>
                <div class="file-context-item" id="code_ctx_move">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                  <span>Move Folder to...</span>
                </div>
                <div class="file-context-item" id="code_ctx_rename">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                  <span>Rename</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="code_ctx_copy_path">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy Absolute Path</span>
                </div>
                <div class="file-context-item" id="code_ctx_copy_rel_path">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy Relative Path</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item danger" id="code_ctx_delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                  <span>Delete Folder</span>
                </div>
              `);

              if (activeCodeCtxMenu.querySelector('#code_ctx_new_file')) {
                activeCodeCtxMenu.querySelector('#code_ctx_new_file').onclick = async () => {
                  hideCodeContextMenu();
                  const name = await DesktopModal.prompt({
                    title: 'New File',
                    message: `Create new file inside "${itemName}":`,
                    placeholder: 'script.js'
                  });
                  if (!name) return;
                  const targetPath = `${itemPath}/${name.trim()}`;
                  const resp = await fetch(`/api/servers/${this.serverId}/files/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: targetPath, type: 'file' })
                  });
                  const res = await resp.json();
                  if (res.success) {
                    loadTree(currentWorkspaceRoot);
                    openFile(targetPath);
                  } else {
                    DesktopModal.alert({ title: 'Creation Failed', message: res.error || 'Could not create file.', type: 'danger' });
                  }
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_new_folder')) {
                activeCodeCtxMenu.querySelector('#code_ctx_new_folder').onclick = async () => {
                  hideCodeContextMenu();
                  const name = await DesktopModal.prompt({
                    title: 'New Folder',
                    message: `Create new directory inside "${itemName}":`,
                    placeholder: 'components'
                  });
                  if (!name) return;
                  const targetPath = `${itemPath}/${name.trim()}`;
                  const resp = await fetch(`/api/servers/${this.serverId}/files/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: targetPath, type: 'dir' })
                  });
                  const res = await resp.json();
                  if (res.success) {
                    loadTree(currentWorkspaceRoot);
                  } else {
                    DesktopModal.alert({ title: 'Creation Failed', message: res.error || 'Could not create directory.', type: 'danger' });
                  }
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_term')) {
                activeCodeCtxMenu.querySelector('#code_ctx_term').onclick = () => {
                  hideCodeContextMenu();
                  DesktopApps.launch('terminal', { path: itemPath, newWindow: true });
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_move')) {
                activeCodeCtxMenu.querySelector('#code_ctx_move').onclick = () => {
                  hideCodeContextMenu();
                  this.showDirectoryPicker({
                    serverId: this.serverId,
                    initialPath: parentDir,
                    title: `Move "${itemName}" to Directory`,
                    onSelect: async (destDir) => {
                      if (!destDir || destDir === itemPath || destDir === parentDir) return;
                      const resp = await fetch(`/api/servers/${this.serverId}/files/batch-move`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paths: [itemPath], dest_dir: destDir })
                      });
                      const res = await resp.json();
                      if (res.success) {
                        if (window.showToast) window.showToast(`Moved ${itemName} to ${destDir}`, 'success');
                        loadTree(currentWorkspaceRoot);
                      } else {
                        DesktopModal.alert({ title: 'Move Failed', message: res.error || 'Failed to move folder.', type: 'danger' });
                      }
                    }
                  });
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_rename')) {
                activeCodeCtxMenu.querySelector('#code_ctx_rename').onclick = async () => {
                  hideCodeContextMenu();
                  const newName = await DesktopModal.prompt({
                    title: 'Rename Folder',
                    message: `Enter new name for folder:`,
                    defaultValue: itemName,
                    placeholder: itemName
                  });
                  if (!newName || newName.trim() === itemName) return;
                  const newPath = `${parentDir}/${newName.trim()}`;
                  const resp = await fetch(`/api/servers/${this.serverId}/files/rename`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ old_path: itemPath, new_path: newPath })
                  });
                  const res = await resp.json();
                  if (res.success) {
                    if (window.showToast) window.showToast(`Renamed to ${newName}`, 'success');
                    loadTree(currentWorkspaceRoot);
                  } else {
                    DesktopModal.alert({ title: 'Rename Failed', message: res.error || 'Failed to rename folder.', type: 'danger' });
                  }
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_copy_path')) {
                activeCodeCtxMenu.querySelector('#code_ctx_copy_path').onclick = () => {
                  hideCodeContextMenu();
                  navigator.clipboard.writeText(itemPath);
                  if (window.showToast) window.showToast('Copied absolute path to clipboard', 'info');
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_copy_rel_path')) {
                activeCodeCtxMenu.querySelector('#code_ctx_copy_rel_path').onclick = () => {
                  hideCodeContextMenu();
                  navigator.clipboard.writeText(relPath);
                  if (window.showToast) window.showToast('Copied relative path to clipboard', 'info');
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_delete')) {
                activeCodeCtxMenu.querySelector('#code_ctx_delete').onclick = async () => {
                  hideCodeContextMenu();
                  const confirmed = await DesktopModal.confirm({
                    title: 'Delete Folder',
                    message: `Are you sure you want to permanently delete folder "${itemName}" and all its contents? This cannot be undone.`,
                    type: 'danger',
                    confirmText: 'Delete Folder'
                  });
                  if (!confirmed) return;
                  const resp = await fetch(`/api/servers/${this.serverId}/files/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: itemPath, is_dir: true })
                  });
                  const res = await resp.json();
                  if (res.success) {
                    if (window.showToast) window.showToast(`Deleted ${itemName}`, 'success');
                    loadTree(currentWorkspaceRoot);
                  } else {
                    DesktopModal.alert({ title: 'Delete Failed', message: res.error || 'Failed to delete folder.', type: 'danger' });
                  }
                };
              }
            } else {
              // File Context Menu
              showCodeContextMenu(e.clientX, e.clientY, `
                <div class="file-context-header" style="padding: 0.35rem 0.65rem; font-size: 0.68rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.06); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${escapeHtml(itemName)}
                </div>
                <div class="file-context-item" id="code_ctx_open">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                  <span>Open in Editor</span>
                </div>
                <div class="file-context-item" id="code_ctx_duplicate">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Duplicate File</span>
                </div>
                <div class="file-context-item" id="code_ctx_move">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
                  <span>Move File to...</span>
                </div>
                <div class="file-context-item" id="code_ctx_rename">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                  <span>Rename</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="code_ctx_term">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                  <span>Open Terminal in Directory</span>
                </div>
                <div class="file-context-item" id="code_ctx_download">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  <span>Download File</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item" id="code_ctx_copy_path">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy Absolute Path</span>
                </div>
                <div class="file-context-item" id="code_ctx_copy_rel_path">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy Relative Path</span>
                </div>
                <div class="file-context-separator"></div>
                <div class="file-context-item danger" id="code_ctx_delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
                  <span>Delete File</span>
                </div>
              `);

              if (activeCodeCtxMenu.querySelector('#code_ctx_open')) {
                activeCodeCtxMenu.querySelector('#code_ctx_open').onclick = () => {
                  hideCodeContextMenu();
                  openFile(itemPath);
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_duplicate')) {
                activeCodeCtxMenu.querySelector('#code_ctx_duplicate').onclick = async () => {
                  hideCodeContextMenu();
                  const dotIdx = itemName.lastIndexOf('.');
                  const baseName = dotIdx !== -1 ? itemName.substring(0, dotIdx) : itemName;
                  const extName = dotIdx !== -1 ? itemName.substring(dotIdx) : '';
                  const defCopyName = `${baseName}_copy${extName}`;

                  const copyName = await DesktopModal.prompt({
                    title: 'Duplicate File',
                    message: `Enter name for duplicated file:`,
                    defaultValue: defCopyName,
                    placeholder: defCopyName
                  });
                  if (!copyName || copyName.trim() === itemName) return;

                  const resp = await fetch(`/api/servers/${this.serverId}/files/batch-copy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paths: [itemPath], dest_dir: parentDir })
                  });
                  const res = await resp.json();
                  if (res.success) {
                    const autoDestPath = `${parentDir}/${itemName}`;
                    const targetPath = `${parentDir}/${copyName.trim()}`;
                    if (copyName.trim() !== itemName) {
                      await fetch(`/api/servers/${this.serverId}/files/rename`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ old_path: autoDestPath, new_path: targetPath })
                      });
                    }
                    if (window.showToast) window.showToast(`Duplicated ${copyName.trim()}`, 'success');
                    loadTree(currentWorkspaceRoot);
                    openFile(targetPath);
                  } else {
                    DesktopModal.alert({ title: 'Duplicate Failed', message: res.error || 'Failed to duplicate file.', type: 'danger' });
                  }
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_move')) {
                activeCodeCtxMenu.querySelector('#code_ctx_move').onclick = () => {
                  hideCodeContextMenu();
                  this.showDirectoryPicker({
                    serverId: this.serverId,
                    initialPath: parentDir,
                    title: `Move "${itemName}" to Directory`,
                    onSelect: async (destDir) => {
                      if (!destDir || destDir === parentDir) return;
                      const resp = await fetch(`/api/servers/${this.serverId}/files/batch-move`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paths: [itemPath], dest_dir: destDir })
                      });
                      const res = await resp.json();
                      if (res.success) {
                        if (window.showToast) window.showToast(`Moved ${itemName} to ${destDir}`, 'success');
                        const newFilePath = `${destDir.replace(/\/+$/, '')}/${itemName}`;
                        if (openTabs.has(itemPath)) {
                          const oldTab = openTabs.get(itemPath);
                          openTabs.delete(itemPath);
                          openTabs.set(newFilePath, oldTab);
                          if (activePath === itemPath) activePath = newFilePath;
                          renderTabs();
                        }
                        loadTree(currentWorkspaceRoot);
                      } else {
                        DesktopModal.alert({ title: 'Move Failed', message: res.error || 'Failed to move file.', type: 'danger' });
                      }
                    }
                  });
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_rename')) {
                activeCodeCtxMenu.querySelector('#code_ctx_rename').onclick = async () => {
                  hideCodeContextMenu();
                  const newName = await DesktopModal.prompt({
                    title: 'Rename File',
                    message: `Enter new name for file:`,
                    defaultValue: itemName,
                    placeholder: itemName
                  });
                  if (!newName || newName.trim() === itemName) return;
                  const newPath = `${parentDir}/${newName.trim()}`;
                  const resp = await fetch(`/api/servers/${this.serverId}/files/rename`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ old_path: itemPath, new_path: newPath })
                  });
                  const res = await resp.json();
                  if (res.success) {
                    if (window.showToast) window.showToast(`Renamed to ${newName}`, 'success');
                    if (openTabs.has(itemPath)) {
                      const oldTab = openTabs.get(itemPath);
                      openTabs.delete(itemPath);
                      openTabs.set(newPath, oldTab);
                      if (activePath === itemPath) activePath = newPath;
                      renderTabs();
                    }
                    loadTree(currentWorkspaceRoot);
                  } else {
                    DesktopModal.alert({ title: 'Rename Failed', message: res.error || 'Failed to rename file.', type: 'danger' });
                  }
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_term')) {
                activeCodeCtxMenu.querySelector('#code_ctx_term').onclick = () => {
                  hideCodeContextMenu();
                  DesktopApps.launch('terminal', { path: parentDir, newWindow: true });
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_download')) {
                activeCodeCtxMenu.querySelector('#code_ctx_download').onclick = () => {
                  hideCodeContextMenu();
                  window.open(`/api/servers/${this.serverId}/files/download?path=${encodeURIComponent(itemPath)}`, '_blank');
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_copy_path')) {
                activeCodeCtxMenu.querySelector('#code_ctx_copy_path').onclick = () => {
                  hideCodeContextMenu();
                  navigator.clipboard.writeText(itemPath);
                  if (window.showToast) window.showToast('Copied absolute path to clipboard', 'info');
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_copy_rel_path')) {
                activeCodeCtxMenu.querySelector('#code_ctx_copy_rel_path').onclick = () => {
                  hideCodeContextMenu();
                  navigator.clipboard.writeText(relPath);
                  if (window.showToast) window.showToast('Copied relative path to clipboard', 'info');
                };
              }

              if (activeCodeCtxMenu.querySelector('#code_ctx_delete')) {
                activeCodeCtxMenu.querySelector('#code_ctx_delete').onclick = async () => {
                  hideCodeContextMenu();
                  const confirmed = await DesktopModal.confirm({
                    title: 'Delete File',
                    message: `Are you sure you want to delete "${itemName}"?`,
                    type: 'danger',
                    confirmText: 'Delete'
                  });
                  if (!confirmed) return;
                  const resp = await fetch(`/api/servers/${this.serverId}/files/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: itemPath, is_dir: false })
                  });
                  const res = await resp.json();
                  if (res.success) {
                    if (window.showToast) window.showToast(`Deleted ${itemName}`, 'success');
                    if (openTabs.has(itemPath)) {
                      closeTab(itemPath, true);
                    }
                    loadTree(currentWorkspaceRoot);
                  } else {
                    DesktopModal.alert({ title: 'Delete Failed', message: res.error || 'Failed to delete file.', type: 'danger' });
                  }
                };
              }
            }
          } else {
            // Right-click on empty background of explorer tree
            showCodeContextMenu(e.clientX, e.clientY, `
              <div class="file-context-header" style="padding: 0.35rem 0.65rem; font-size: 0.68rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.06);">
                Workspace
              </div>
              <div class="file-context-item" id="code_ctx_root_new_file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                <span>New File...</span>
              </div>
              <div class="file-context-item" id="code_ctx_root_new_folder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                <span>New Folder...</span>
              </div>
              <div class="file-context-separator"></div>
              <div class="file-context-item" id="code_ctx_root_term">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                <span>Open Terminal in Workspace</span>
              </div>
              <div class="file-context-item" id="code_ctx_root_copy_path">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy Workspace Path</span>
              </div>
              <div class="file-context-separator"></div>
              <div class="file-context-item" id="code_ctx_root_refresh">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                <span>Refresh Explorer</span>
              </div>
            `);

            if (activeCodeCtxMenu.querySelector('#code_ctx_root_new_file')) {
              activeCodeCtxMenu.querySelector('#code_ctx_root_new_file').onclick = async () => {
                hideCodeContextMenu();
                const name = await DesktopModal.prompt({
                  title: 'New File',
                  message: 'Enter name for the new file:',
                  placeholder: 'untitled.txt'
                });
                if (!name) return;
                const fullPath = (currentWorkspaceRoot === '/' ? '' : currentWorkspaceRoot) + '/' + name.trim();
                const resp = await fetch(`/api/servers/${this.serverId}/files/create`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: fullPath, type: 'file' })
                });
                const res = await resp.json();
                if (res.success) {
                  loadTree(currentWorkspaceRoot);
                  openFile(fullPath);
                } else {
                  DesktopModal.alert({ title: 'Creation Failed', message: res.error || 'Could not create file.', type: 'danger' });
                }
              };
            }

            if (activeCodeCtxMenu.querySelector('#code_ctx_root_new_folder')) {
              activeCodeCtxMenu.querySelector('#code_ctx_root_new_folder').onclick = async () => {
                hideCodeContextMenu();
                const name = await DesktopModal.prompt({
                  title: 'New Folder',
                  message: 'Enter name for the new directory:',
                  placeholder: 'new-directory'
                });
                if (!name) return;
                const fullPath = (currentWorkspaceRoot === '/' ? '' : currentWorkspaceRoot) + '/' + name.trim();
                const resp = await fetch(`/api/servers/${this.serverId}/files/create`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: fullPath, type: 'dir' })
                });
                const res = await resp.json();
                if (res.success) {
                  loadTree(currentWorkspaceRoot);
                } else {
                  DesktopModal.alert({ title: 'Creation Failed', message: res.error || 'Could not create directory.', type: 'danger' });
                }
              };
            }

            if (activeCodeCtxMenu.querySelector('#code_ctx_root_term')) {
              activeCodeCtxMenu.querySelector('#code_ctx_root_term').onclick = () => {
                hideCodeContextMenu();
                DesktopApps.launch('terminal', { path: currentWorkspaceRoot, newWindow: true });
              };
            }

            if (activeCodeCtxMenu.querySelector('#code_ctx_root_copy_path')) {
              activeCodeCtxMenu.querySelector('#code_ctx_root_copy_path').onclick = () => {
                hideCodeContextMenu();
                navigator.clipboard.writeText(currentWorkspaceRoot);
                if (window.showToast) window.showToast('Copied workspace path to clipboard', 'info');
              };
            }

            if (activeCodeCtxMenu.querySelector('#code_ctx_root_refresh')) {
              activeCodeCtxMenu.querySelector('#code_ctx_root_refresh').onclick = () => {
                hideCodeContextMenu();
                loadTree(currentWorkspaceRoot);
              };
            }
          }
        });

        // Tree new file / folder buttons
        bodyEl.querySelector(`#treeNewFile_${codeId}`).onclick = async () => {
          const name = await DesktopModal.prompt({
            title: 'New File',
            message: 'Enter name for the new file:',
            placeholder: 'untitled.txt'
          });
          if (!name) return;
          const fullPath = (currentWorkspaceRoot === '/' ? '' : currentWorkspaceRoot) + '/' + name.trim();
          const resp = await fetch(`/api/servers/${this.serverId}/files/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fullPath, type: 'file' })
          });
          const res = await resp.json();
          if (res.success) {
            loadTree(currentWorkspaceRoot);
            openFile(fullPath);
          } else {
            DesktopModal.alert({ title: 'Creation Failed', message: res.error || 'Could not create file.', type: 'danger' });
          }
        };

        bodyEl.querySelector(`#treeNewDir_${codeId}`).onclick = async () => {
          const name = await DesktopModal.prompt({
            title: 'New Folder',
            message: 'Enter name for the new directory:',
            placeholder: 'new-directory'
          });
          if (!name) return;
          const fullPath = (currentWorkspaceRoot === '/' ? '' : currentWorkspaceRoot) + '/' + name.trim();
          const resp = await fetch(`/api/servers/${this.serverId}/files/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: fullPath, type: 'dir' })
          });
          const res = await resp.json();
          if (res.success) {
            loadTree(currentWorkspaceRoot);
          } else {
            DesktopModal.alert({ title: 'Creation Failed', message: res.error || 'Could not create directory.', type: 'danger' });
          }
        };

        // Activity bar actions
        actExplorer.onclick = () => {
          actExplorer.classList.add('active');
          actSearch.classList.remove('active');
          paneExplorer.style.display = 'flex';
          paneSearch.style.display = 'none';
        };

        actSearch.onclick = () => {
          actSearch.classList.add('active');
          actExplorer.classList.remove('active');
          paneSearch.style.display = 'flex';
          paneExplorer.style.display = 'none';
          searchInp.focus();
        };

        actRefresh.onclick = () => loadTree(currentWorkspaceRoot);

        // Search in Files
        const runSearch = async () => {
          const q = searchInp.value.trim();
          if (!q) return;
          searchResults.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.75rem;"><span class="spinner-border spinner-border-sm" style="margin-right:6px;"></span>Searching...</div>`;
          try {
            const resp = await fetch(`/api/servers/${this.serverId}/workspace/search-code?path=${encodeURIComponent(currentWorkspaceRoot)}&q=${encodeURIComponent(q)}`);
            const res = await resp.json();
            if (!res.success) {
              searchResults.innerHTML = `<div style="padding:1rem; color:var(--accent-rose); font-size:0.73rem;">Search error: ${res.error}</div>`;
              return;
            }
            const list = res.results || [];
            if (list.length === 0) {
              searchResults.innerHTML = `<div style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.73rem;">No matches found</div>`;
              return;
            }
            searchResults.innerHTML = list.map(item => `
              <div class="search-result-item" data-path="${item.file}" data-line="${item.line}" style="padding:0.35rem 0.5rem; border-radius:var(--radius-xs); cursor:pointer; margin-bottom:0.3rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:0.74rem; font-weight:600; color:#38bdf8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${item.file.split('/').pop()} <span style="color:var(--text-muted); font-size:0.68rem; font-weight:normal;">:${item.line}</span>
                </div>
                <div style="font-size:0.7rem; color:var(--text-secondary); font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">
                  ${item.snippet || item.match || ''}
                </div>
              </div>
            `).join('');
          } catch (e) {
            searchResults.innerHTML = `<div style="padding:1rem; color:var(--accent-rose); font-size:0.73rem;">Search error: ${e}</div>`;
          }
        };

        searchExecBtn.onclick = runSearch;
        searchInp.onkeydown = (e) => { if (e.key === 'Enter') runSearch(); };

        searchResults.addEventListener('click', (e) => {
          const item = e.target.closest('.search-result-item');
          if (item) {
            openFile(item.dataset.path, parseInt(item.dataset.line, 10));
          }
        });

        // Integrated Bottom Terminal Panel
        const toggleTerminal = () => {
          isTerminalOpen = !isTerminalOpen;
          termPanel.style.display = isTerminalOpen ? 'flex' : 'none';
          if (termResizer) termResizer.style.display = isTerminalOpen ? 'block' : 'none';
          if (isTerminalOpen) {
            if (!termInstance) {
              initIntegratedTerminal();
            } else {
              setTimeout(() => {
                try {
                  if (termFitAddon) termFitAddon.fit();
                  if (termInstance) {
                    termInstance.focus();
                    if (termSocket && termSocket.readyState === WebSocket.OPEN) {
                      termSocket.send(JSON.stringify({
                        type: 'resize',
                        cols: Math.max(10, termInstance.cols || 80),
                        rows: Math.max(4, termInstance.rows || 12)
                      }));
                    }
                  }
                } catch (_) {}
              }, 60);
            }
          }
        };

        toggleTermBtn.onclick = toggleTerminal;
        actTerminal.onclick = toggleTerminal;
        termCloseBtn.onclick = () => {
          isTerminalOpen = false;
          termPanel.style.display = 'none';
          if (termResizer) termResizer.style.display = 'none';
        };

        // Drag to resize integrated terminal panel
        if (termResizer) {
          let isDragging = false;
          let startY = 0;
          let startH = 0;

          const onPointerMove = (e) => {
            if (!isDragging) return;
            const deltaY = startY - e.clientY;
            const newH = Math.max(120, Math.min(500, Math.round(startH + deltaY)));
            termPanel.style.height = `${newH}px`;
            if (termFitAddon) {
              try { termFitAddon.fit(); } catch (_) {}
            }
          };

          const onPointerUp = () => {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            if (termFitAddon && termInstance) {
              try {
                termFitAddon.fit();
                termInstance.focus();
                if (termSocket && termSocket.readyState === WebSocket.OPEN) {
                  termSocket.send(JSON.stringify({
                    type: 'resize',
                    cols: Math.max(10, termInstance.cols || 80),
                    rows: Math.max(4, termInstance.rows || 12)
                  }));
                }
              } catch (_) {}
            }
          };

          termResizer.onpointerdown = (e) => {
            isDragging = true;
            startY = e.clientY;
            startH = termPanel.offsetHeight;
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            e.preventDefault();
          };
        }

        const initIntegratedTerminal = () => {
          const savedThemeKey = localStorage.getItem('shellman_terminal_theme') || 'shellman';
          const activeTheme = SHELLMAN_TERMINAL_THEMES[savedThemeKey] || SHELLMAN_TERMINAL_THEMES.shellman;
          termInstance = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 13,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            theme: activeTheme,
            scrollback: 2000
          });

          window._shellmanTerminals = window._shellmanTerminals || new Set();
          window._shellmanTerminals.add(termInstance);

          termFitAddon = new FitAddon.FitAddon();
          termInstance.loadAddon(termFitAddon);
          termInstance.open(termScreen);

          // Click on terminal viewport to autofocus
          termScreen.onclick = () => {
            if (termInstance) termInstance.focus();
          };

          termInstance.onResize(({ cols, rows }) => {
            if (termSocket && termSocket.readyState === WebSocket.OPEN) {
              termSocket.send(JSON.stringify({
                type: 'resize',
                cols: Math.max(10, cols || 80),
                rows: Math.max(4, rows || 12)
              }));
            }
          });

          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const initCols = Math.max(10, termInstance.cols || 80);
          const initRows = Math.max(4, termInstance.rows || 12);
          let url = `${protocol}//${window.location.host}/ws/terminal/${this.serverId}?cols=${initCols}&rows=${initRows}`;
          const activeRoot = currentWorkspaceRoot || initialRoot;
          if (activeRoot) {
            url += `&cwd=${encodeURIComponent(activeRoot)}&path=${encodeURIComponent(activeRoot)}`;
          }
          termSocket = new WebSocket(url);

          termSocket.onopen = () => {
            setTimeout(() => {
              try {
                if (termFitAddon) termFitAddon.fit();
                if (termInstance) {
                  termInstance.focus();
                  if (termSocket && termSocket.readyState === WebSocket.OPEN) {
                    termSocket.send(JSON.stringify({
                      type: 'resize',
                      cols: Math.max(10, termInstance.cols || 80),
                      rows: Math.max(4, termInstance.rows || 12)
                    }));
                  }
                }
              } catch (_) {}
            }, 60);
          };

          termSocket.onmessage = (evt) => {
            try {
              const msg = JSON.parse(evt.data);
              if (msg.type === 'data') termInstance.write(msg.data);
              else if (msg.type === 'error') termInstance.write(`\r\n\x1b[31m${msg.data}\x1b[0m\r\n`);
            } catch (_) {
              termInstance.write(evt.data);
            }
          };

          termSocket.onerror = (e) => {
            console.warn('[Terminal PTY] WebSocket error:', e);
          };

          termSocket.onclose = () => {
            if (termInstance) {
              termInstance.write('\r\n\x1b[33m[Integrated terminal session closed]\x1b[0m\r\n');
            }
          };

          termInstance.onData((data) => {
            if (termSocket && termSocket.readyState === WebSocket.OPEN) {
              termSocket.send(JSON.stringify({ type: 'input', data }));
            }
          });

          termClearBtn.onclick = () => termInstance.clear();
          setTimeout(() => {
            try {
              if (termFitAddon) termFitAddon.fit();
              if (termInstance) termInstance.focus();
            } catch (_) {}
          }, 150);
        };

        // Initialize IDE
        winObj._openFile = openFile;
        winObj._setRoot = (root) => { loadTree(root); };
        loadTree(initialRoot);
        initEditor();

        // Drag & Drop Local Files onto Monaco Editor Viewport
        const editorViewport = bodyEl.querySelector(`#editorViewport_${codeId}`);
        const dropOverlay = bodyEl.querySelector(`#dropOverlay_${codeId}`);
        let dragCounter = 0;

        if (editorViewport && dropOverlay) {
          editorViewport.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter++;
            if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
              dropOverlay.style.display = 'flex';
            }
          });

          editorViewport.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          });

          editorViewport.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter--;
            if (dragCounter <= 0) {
              dragCounter = 0;
              dropOverlay.style.display = 'none';
            }
          });

          editorViewport.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            dropOverlay.style.display = 'none';

            const files = e.dataTransfer ? e.dataTransfer.files : null;
            if (!files || files.length === 0) return;

            for (const file of Array.from(files)) {
              try {
                const text = await file.text();
                const localVirtualPath = `[Local] ${file.name}`;
                const lang = getLanguageFromPath(file.name);

                let model = null;
                if (window.monaco && editor) {
                  const uri = monaco.Uri.parse(`inmemory://local/${Date.now()}_${encodeURIComponent(file.name)}`);
                  model = monaco.editor.createModel(text, lang, uri);
                  model.onDidChangeContent(() => {
                    const cur = openTabs.get(localVirtualPath);
                    if (cur && !cur.dirty) {
                      cur.dirty = true;
                      renderTabs();
                    }
                  });
                }

                openTabs.set(localVirtualPath, {
                  model,
                  content: text,
                  dirty: true,
                  lang,
                  isLocal: true,
                  localFileName: file.name
                });
                activePath = localVirtualPath;

                if (editor && model) {
                  editor.setModel(model);
                } else if (fallbackTxt) {
                  fallbackTxt.value = text;
                }
                renderTabs();

                if (window.showToast) {
                  window.showToast(`Opened local file: ${file.name}. Press Save (Ctrl+S) to upload to remote workspace.`, 'info');
                }
              } catch (err) {
                DesktopModal.alert({ title: 'Error Reading Local File', message: String(err), type: 'danger' });
              }
            }
          });
        }

        // Drag & Drop Local Files onto Explorer Tree to Upload
        if (treeContainer) {
          treeContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          });

          treeContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer ? e.dataTransfer.files : null;
            if (!files || files.length === 0) return;

            for (const file of Array.from(files)) {
              try {
                const text = await file.text();
                const targetDir = currentWorkspaceRoot === '~' ? '/root' : currentWorkspaceRoot;
                const targetPath = `${targetDir}/${file.name}`;
                const resp = await fetch(`/api/servers/${this.serverId}/files/save`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: targetPath, content: text })
                });
                const res = await resp.json();
                if (res.success) {
                  if (window.showToast) window.showToast(`Uploaded ${file.name} to ${targetDir}`, 'success');
                  loadTree(currentWorkspaceRoot);
                  openFile(targetPath);
                } else {
                  DesktopModal.alert({ title: 'Upload Failed', message: res.error || 'Could not save file to server.', type: 'danger' });
                }
              } catch (err) {
                DesktopModal.alert({ title: 'Upload Error', message: String(err), type: 'danger' });
              }
            }
          });
        }

        winObj.onResize = () => {
          if (editor) editor.layout();
          if (termFitAddon && isTerminalOpen) {
            try { termFitAddon.fit(); } catch (_) {}
          }
        };

        winObj.onClose = () => {
          hideCodeContextMenu();
          document.removeEventListener('pointerdown', onCodePointerDownOutside);
          document.removeEventListener('keydown', onCodeKeyDownEsc);
          if (termSocket) termSocket.close();
          if (termInstance) termInstance.dispose();
          for (const tab of openTabs.values()) {
            if (tab.model) tab.model.dispose();
          }
          if (editor) editor.dispose();
        };
      }
    });
};

