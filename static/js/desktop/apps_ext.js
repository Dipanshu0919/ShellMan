/**
 * ShellMan OS: Advanced Ecosystem Apps Extension (apps_ext.js)
 * Implements:
 * 1. SSH Connection Diagnostics Dashboard (The Secret Weapon)
 * 2. Docker & Container Manager (Containers, Live Logs, Compose, Stats)
 * 3. Database Explorer & Backups (SQLite .db Viewer, MySQL, PostgreSQL)
 * 4. Firewall (UFW) & Fail2Ban Security Shield (+ 1-Click Netstat DDoS Ban)
 */

(function () {
  const safeFetchJson = async (url, options = {}) => {
    const resp = await fetch(url, options);
    return await resp.json();
  };

  // =========================================================================
  // 1. SSH CONNECTION DIAGNOSTICS DASHBOARD (THE SECRET WEAPON)
  // =========================================================================

  DesktopAppsController.prototype.launchSshDiagnostics = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('ssh_diag');
    if (existing) {
      WindowManager.bringToFront(existing);
      return existing;
    }

    const diagWinId = 'diag_' + Date.now();
    const winObj = WindowManager.createWindow({
      appId: 'ssh_diag',
      multiInstance: false,
      title: `SSH Connection Diagnostics - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><path d="M12 6v6l4 2"></path><path d="M2 12h3M19 12h3"></path></svg>',
      width: 760,
      height: 580,
      contentHtml: `
        <div class="ssh-diag-container" id="sshDiagContainer_${diagWinId}" style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); color:var(--text-primary); font-family:var(--font-sans); position:relative; overflow:hidden;">
          <!-- Top Utility Toolbar -->
          <div style="height:42px; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:space-between; padding:0 1rem; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.55rem;">
              <span class="status-dot connected" id="diagDot_${diagWinId}"></span>
              <span style="font-size:0.82rem; font-weight:700; color:#f8fafc;">SSH Session Diagnostics</span>
              <span class="badge" id="diagNodeBadge_${diagWinId}" style="background:rgba(56,189,248,0.15); color:#38bdf8; font-family:var(--font-mono); font-size:0.7rem;">${escapeHtml(this.serverName)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-secondary btn-xs" id="btnTestPing_${diagWinId}" style="font-size:0.72rem; padding:0.25rem 0.6rem;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                Measure Latency (RTT)
              </button>
            </div>
          </div>

          <!-- Body -->
          <div style="flex:1; overflow-y:auto; padding:1.25rem; display:flex; flex-direction:column; gap:1.15rem;" id="diagBody_${diagWinId}">
            <!-- Latency Gauge Banner -->
            <div style="background:linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,41,59,0.5)); border:1px solid var(--border-subtle); border-radius:8px; padding:1.15rem 1.4rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:0.68rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">Raw SSH Round-Trip Latency</div>
                <div style="display:flex; align-items:baseline; gap:0.5rem; margin-top:0.35rem;">
                  <span style="font-size:2.2rem; font-weight:800; font-family:var(--font-mono); color:#38bdf8;" id="txtDiagLatency_${diagWinId}">--</span>
                  <span style="font-size:1.1rem; color:var(--text-secondary);">ms</span>
                  <span id="badgeDiagRating_${diagWinId}" class="badge" style="font-size:0.72rem; font-weight:700; padding:0.2rem 0.5rem; margin-left:0.5rem; background:rgba(255,255,255,0.06); color:#94a3b8;">Testing...</span>
                </div>
                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.2rem;">Measured via OpenSSH encrypted transport global request without invoking remote shell processes.</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:0.68rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Session Lifetime</div>
                <div style="font-size:1.2rem; font-weight:700; font-family:var(--font-mono); color:#f8fafc; margin-top:0.25rem;" id="txtDiagUptime_${diagWinId}">--</div>
                <div style="font-size:0.7rem; color:#34d399; margin-top:2px;" id="txtDiagSftpPool_${diagWinId}">SFTP Pool Active</div>
              </div>
            </div>

            <!-- Network Throughput (Upload & Download Speed) Meter -->
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.15rem 1.4rem; display:flex; flex-direction:column; gap:0.85rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                <div style="display:flex; align-items:center; gap:0.55rem; font-size:0.82rem; font-weight:700; color:#38bdf8;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                  <span>Network Throughput (Upload &amp; Download Speed)</span>
                  <span class="badge" id="txtNetIface_${diagWinId}" style="background:rgba(56,189,248,0.12); color:#38bdf8; font-family:var(--font-mono); font-size:0.68rem;">eth0</span>
                </div>
                <button class="btn btn-secondary btn-xs" id="btnBenchmarkThroughput_${diagWinId}" style="display:flex; align-items:center; gap:4px; font-size:0.72rem; padding:0.25rem 0.65rem;">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                  <span>Benchmark SSH Speed</span>
                </button>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
                <!-- Download Rate (Rx) -->
                <div style="background:rgba(0,0,0,0.22); border:1px solid rgba(52,211,153,0.2); border-radius:6px; padding:0.85rem 1rem;">
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Download Speed (Incoming Rx)</span>
                    <span style="font-size:0.75rem; color:#34d399; font-weight:700;">&#8595; Rx</span>
                  </div>
                  <div style="display:flex; align-items:baseline; gap:0.4rem; margin-top:0.35rem;">
                    <span style="font-size:1.8rem; font-weight:800; font-family:var(--font-mono); color:#34d399;" id="txtNetRxRate_${diagWinId}">0 KB/s</span>
                  </div>
                  <div style="font-size:0.7rem; color:var(--text-muted); margin-top:3px;">Total Received: <span id="txtNetRxTotal_${diagWinId}" style="font-family:var(--font-mono); color:#cbd5e1;">--</span></div>
                </div>

                <!-- Upload Rate (Tx) -->
                <div style="background:rgba(0,0,0,0.22); border:1px solid rgba(56,189,248,0.2); border-radius:6px; padding:0.85rem 1rem;">
                  <div style="display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Upload Speed (Outgoing Tx)</span>
                    <span style="font-size:0.75rem; color:#38bdf8; font-weight:700;">&#8593; Tx</span>
                  </div>
                  <div style="display:flex; align-items:baseline; gap:0.4rem; margin-top:0.35rem;">
                    <span style="font-size:1.8rem; font-weight:800; font-family:var(--font-mono); color:#38bdf8;" id="txtNetTxRate_${diagWinId}">0 KB/s</span>
                  </div>
                  <div style="font-size:0.7rem; color:var(--text-muted); margin-top:3px;">Total Transmitted: <span id="txtNetTxTotal_${diagWinId}" style="font-family:var(--font-mono); color:#cbd5e1;">--</span></div>
                </div>
              </div>

              <!-- Active Benchmark Result Strip -->
              <div id="boxBenchmarkResults_${diagWinId}" style="display:none; padding:0.55rem 0.9rem; border-radius:6px; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); font-size:0.75rem; font-family:var(--font-mono); color:#f8fafc; align-items:center; justify-content:space-between;">
                <span>SSH Tunnel Speed: <strong id="txtBenchDown_${diagWinId}" style="color:#34d399;">-- MB/s</strong> download, <strong id="txtBenchUp_${diagWinId}" style="color:#38bdf8;">-- MB/s</strong> upload</span>
                <span id="txtBenchLatency_${diagWinId}" style="color:var(--text-muted); font-size:0.7rem;">Tested in -- ms</span>
              </div>
            </div>

            <!-- Two-Column Cryptography & Transport Grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.15rem;">
              <!-- Cryptographic Suite Card -->
              <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.1rem; display:flex; flex-direction:column; gap:0.75rem;">
                <div style="font-size:0.78rem; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:0.4rem;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Negotiated Cryptographic Suite
                </div>

                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Symmetric Bulk Cipher</div>
                  <div style="font-family:var(--font-mono); font-size:0.8rem; color:#f8fafc; font-weight:600;" id="txtCipher_${diagWinId}">--</div>
                </div>

                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Key Exchange (KEX) Engine</div>
                  <div style="font-family:var(--font-mono); font-size:0.8rem; color:#f8fafc;" id="txtKex_${diagWinId}">--</div>
                </div>

                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Message Authentication Code (MAC)</div>
                  <div style="font-family:var(--font-mono); font-size:0.78rem; color:#cbd5e1;" id="txtMac_${diagWinId}">--</div>
                </div>

                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Strict KEX Mode (Anti-Terrapin)</div>
                  <div style="font-family:var(--font-mono); font-size:0.78rem;" id="txtStrictKex_${diagWinId}">--</div>
                </div>
              </div>

              <!-- Host Key & Authentication Card -->
              <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.1rem; display:flex; flex-direction:column; gap:0.75rem;">
                <div style="font-size:0.78rem; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:0.4rem;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-2-2l2 2"></path><circle cx="10" cy="14" r="5"></circle><path d="M19 5l-5 5"></path><path d="M14 10l1.5 1.5"></path></svg>
                  Host Key &amp; Server Identity
                </div>

                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Host Key Algorithm</div>
                  <div style="font-family:var(--font-mono); font-size:0.8rem; color:#f8fafc; font-weight:600;" id="txtHostKeyType_${diagWinId}">--</div>
                </div>

                <div>
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Host Key SHA-256 Fingerprint</span>
                    <button class="btn btn-ghost btn-xs" id="btnCopyFp_${diagWinId}" style="font-size:0.66rem; padding:0.1rem 0.35rem;">Copy</button>
                  </div>
                  <div style="font-family:var(--font-mono); font-size:0.72rem; color:#94a3b8; word-break:break-all; background:rgba(0,0,0,0.25); padding:0.35rem 0.5rem; border-radius:4px; margin-top:2px;" id="txtFingerprint_${diagWinId}">--</div>
                </div>

                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Authentication Mechanism</div>
                  <div style="font-family:var(--font-mono); font-size:0.8rem; color:#34d399;" id="txtAuthType_${diagWinId}">--</div>
                </div>

                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Active Parallel Channels</div>
                  <div style="font-family:var(--font-mono); font-size:0.78rem; color:#cbd5e1;" id="txtChannels_${diagWinId}">--</div>
                </div>
              </div>
            </div>

            <!-- Server Version & Protocol Banner Details -->
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.1rem; display:flex; flex-direction:column; gap:0.65rem;">
              <div style="font-size:0.78rem; font-weight:700; color:#38bdf8; display:flex; align-items:center; gap:0.4rem;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                Remote Protocol &amp; Socket Transport
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Remote OpenSSH Banner</div>
                  <div style="font-family:var(--font-mono); font-size:0.76rem; color:#f8fafc;" id="txtServerBanner_${diagWinId}">--</div>
                </div>
                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Local Client Protocol</div>
                  <div style="font-family:var(--font-mono); font-size:0.76rem; color:#cbd5e1;" id="txtClientBanner_${diagWinId}">--</div>
                </div>
                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Socket Endpoint</div>
                  <div style="font-family:var(--font-mono); font-size:0.76rem; color:#f8fafc;" id="txtSocketEndpoint_${diagWinId}">--</div>
                </div>
                <div>
                  <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Wire Compression</div>
                  <div style="font-family:var(--font-mono); font-size:0.76rem; color:#cbd5e1;" id="txtCompression_${diagWinId}">none</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const root = bodyEl.querySelector(`#sshDiagContainer_${diagWinId}`);
        let lastFp = '';

        const loadDiag = async () => {
          const btn = root.querySelector(`#btnTestPing_${diagWinId}`);
          if (btn) btn.disabled = true;

          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/ssh/diagnostics`);
            if (!res.success || !res.connected) {
              root.querySelector(`#txtDiagLatency_${diagWinId}`).textContent = 'Error';
              root.querySelector(`#badgeDiagRating_${diagWinId}`).textContent = res.error || 'Disconnected';
              root.querySelector(`#badgeDiagRating_${diagWinId}`).style.color = '#ef4444';
              return;
            }

            // Latency & Rating
            const latEl = root.querySelector(`#txtDiagLatency_${diagWinId}`);
            latEl.textContent = res.latency_ms >= 0 ? res.latency_ms : 'N/A';
            const rateBadge = root.querySelector(`#badgeDiagRating_${diagWinId}`);
            rateBadge.textContent = res.latency_rating;
            rateBadge.style.color = res.latency_color;
            rateBadge.style.background = `${res.latency_color}18`;
            rateBadge.style.borderColor = `${res.latency_color}40`;

            // Session Info
            const upMin = Math.floor(res.session_age_seconds / 60);
            const upSec = Math.floor(res.session_age_seconds % 60);
            root.querySelector(`#txtDiagUptime_${diagWinId}`).textContent = `${upMin}m ${upSec}s`;
            root.querySelector(`#txtDiagSftpPool_${diagWinId}`).textContent = `SFTP: ${res.sftp_status}`;

            // Crypto
            root.querySelector(`#txtCipher_${diagWinId}`).textContent = res.cipher;
            root.querySelector(`#txtKex_${diagWinId}`).textContent = res.kex;
            root.querySelector(`#txtMac_${diagWinId}`).textContent = res.mac;
            const strictEl = root.querySelector(`#txtStrictKex_${diagWinId}`);
            strictEl.innerHTML = res.strict_kex
              ? `<span style="color:#34d399; font-weight:700;">Active (Strict KEX negotiated)</span>`
              : `<span style="color:#94a3b8;">Standard KEX</span>`;

            // Host key
            const bitsStr = res.host_key_bits ? ` (${res.host_key_bits}-bit)` : '';
            root.querySelector(`#txtHostKeyType_${diagWinId}`).textContent = `${res.host_key_type}${bitsStr}`;
            lastFp = res.host_key_fingerprint || '';
            root.querySelector(`#txtFingerprint_${diagWinId}`).textContent = lastFp;
            root.querySelector(`#txtAuthType_${diagWinId}`).textContent = (res.auth_type || 'password').toUpperCase();
            root.querySelector(`#txtChannels_${diagWinId}`).textContent = `${res.channels_count} active channels`;

            // Banners & Endpoint
            root.querySelector(`#txtServerBanner_${diagWinId}`).textContent = res.server_banner;
            root.querySelector(`#txtClientBanner_${diagWinId}`).textContent = res.client_banner;
            root.querySelector(`#txtSocketEndpoint_${diagWinId}`).textContent = `${res.peer_ip}:${res.peer_port}`;
            root.querySelector(`#txtCompression_${diagWinId}`).textContent = res.compression;

            // Throughput & Traffic
            if (res.throughput) {
              const ifaceEl = root.querySelector(`#txtNetIface_${diagWinId}`);
              const rxEl = root.querySelector(`#txtNetRxRate_${diagWinId}`);
              const txEl = root.querySelector(`#txtNetTxRate_${diagWinId}`);
              const rxTotEl = root.querySelector(`#txtNetRxTotal_${diagWinId}`);
              const txTotEl = root.querySelector(`#txtNetTxTotal_${diagWinId}`);
              if (ifaceEl) ifaceEl.textContent = res.throughput.interface || 'eth0';
              if (rxEl) rxEl.textContent = res.throughput.download_speed || '0 KB/s';
              if (txEl) txEl.textContent = res.throughput.upload_speed || '0 KB/s';
              if (rxTotEl) rxTotEl.textContent = res.throughput.total_download || '0 B';
              if (txTotEl) txTotEl.textContent = res.throughput.total_upload || '0 B';
            }
          } catch (err) {
            console.error('Error loading SSH diagnostics:', err);
          } finally {
            if (btn) btn.disabled = false;
          }
        };

        // Live Telemetry Subscription for real-time Rx/Tx speed updates
        const unsubDiagTelemetry = window.DesktopTelemetry ? window.DesktopTelemetry.subscribe((metrics) => {
          if (metrics && metrics.network) {
            const rxEl = root.querySelector(`#txtNetRxRate_${diagWinId}`);
            const txEl = root.querySelector(`#txtNetTxRate_${diagWinId}`);
            const rxTotEl = root.querySelector(`#txtNetRxTotal_${diagWinId}`);
            const txTotEl = root.querySelector(`#txtNetTxTotal_${diagWinId}`);
            const ifaceEl = root.querySelector(`#txtNetIface_${diagWinId}`);
            if (rxEl && metrics.network.rx_rate_human) rxEl.textContent = metrics.network.rx_rate_human;
            if (txEl && metrics.network.tx_rate_human) txEl.textContent = metrics.network.tx_rate_human;
            if (rxTotEl && metrics.network.rx_total_human) rxTotEl.textContent = metrics.network.rx_total_human;
            if (txTotEl && metrics.network.tx_total_human) txTotEl.textContent = metrics.network.tx_total_human;
            if (ifaceEl && metrics.network.interface) ifaceEl.textContent = metrics.network.interface;
          }
        }) : null;

        winObj.onClose = () => {
          if (unsubDiagTelemetry) unsubDiagTelemetry();
        };

        // Benchmark SSH Tunnel Speed
        const btnBench = root.querySelector(`#btnBenchmarkThroughput_${diagWinId}`);
        if (btnBench) {
          btnBench.onclick = async () => {
            btnBench.disabled = true;
            btnBench.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:11px;height:11px;margin-right:4px;"></span> Testing...`;
            const boxResults = root.querySelector(`#boxBenchmarkResults_${diagWinId}`);
            try {
              const bRes = await safeFetchJson(`/api/servers/${this.serverId}/ssh/benchmark`, { method: 'POST' });
              if (bRes.success) {
                boxResults.style.display = 'flex';
                root.querySelector(`#txtBenchDown_${diagWinId}`).textContent = bRes.download_speed;
                root.querySelector(`#txtBenchUp_${diagWinId}`).textContent = bRes.upload_speed;
                root.querySelector(`#txtBenchLatency_${diagWinId}`).textContent = `Down: ${bRes.download_ms}ms, Up: ${bRes.upload_ms}ms`;
                if (window.showToast) window.showToast(`SSH Tunnel Capacity: ${bRes.download_speed} down, ${bRes.upload_speed} up`, 'success');
              } else {
                if (window.showToast) window.showToast(`Benchmark error: ${bRes.error || 'Test failed'}`, 'warning');
              }
            } catch (e) {
              if (window.showToast) window.showToast(`Benchmark error: ${e}`, 'danger');
            } finally {
              btnBench.disabled = false;
              btnBench.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>Benchmark SSH Speed</span>`;
            }
          };
        }

        root.querySelector(`#btnTestPing_${diagWinId}`).onclick = loadDiag;
        root.querySelector(`#btnCopyFp_${diagWinId}`).onclick = () => {
          if (lastFp && navigator.clipboard) {
            navigator.clipboard.writeText(lastFp);
            if (window.showToast) window.showToast('Host key fingerprint copied', 'info');
          }
        };

        loadDiag();
      }
    });

    return winObj;
  };

  // =========================================================================
  // 2. DOCKER & CONTAINER MANAGER
  // =========================================================================

  DesktopAppsController.prototype.launchDocker = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('docker');
    if (existing) {
      WindowManager.bringToFront(existing);
      return existing;
    }

    const docWinId = 'docker_' + Date.now();
    const winObj = WindowManager.createWindow({
      appId: 'docker',
      multiInstance: false,
      title: `Docker & Containers - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8"><rect x="3" y="11" width="3" height="3" fill="#38bdf8"></rect><rect x="7" y="11" width="3" height="3" fill="#38bdf8"></rect><rect x="11" y="11" width="3" height="3" fill="#38bdf8"></rect><rect x="7" y="7" width="3" height="3" fill="#38bdf8"></rect><rect x="11" y="7" width="3" height="3" fill="#38bdf8"></rect><rect x="15" y="11" width="3" height="3" fill="#38bdf8"></rect><path d="M2 14c1.5 4 5 6 10 6s9-3 10-6c-1-1-3-1-4 0-1.5 1.5-4 1-5 0-1.5-1.5-4-1-5 0-1.5 1-4 0-6 0z"></path></svg>',
      width: 980,
      height: 620,
      contentHtml: `
        <div class="docker-app-container" id="dockerContainer_${docWinId}" style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); color:var(--text-primary); font-family:var(--font-sans); position:relative; overflow:hidden;">
          <!-- Top Utility Toolbar -->
          <div style="height:42px; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:space-between; padding:0 1rem; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span class="status-dot disconnected" id="docDot_${docWinId}"></span>
              <span style="font-size:0.82rem; font-weight:700;" id="docStatusText_${docWinId}">Checking Docker...</span>
              <span class="badge" id="docSummaryBadge_${docWinId}" style="background:rgba(255,255,255,0.06); font-size:0.7rem;">--</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-secondary btn-xs" id="btnDocCompose_${docWinId}" style="font-size:0.72rem; padding:0.25rem 0.55rem;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="16 16 12 12 8 16"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path><polyline points="16 16 12 12 8 16"></polyline></svg>
                Compose Up / Down
              </button>
              <button class="btn btn-secondary btn-xs" id="btnRefreshDoc_${docWinId}" style="font-size:0.72rem; padding:0.25rem 0.55rem;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                Refresh
              </button>
            </div>
          </div>

          <!-- Secondary Filter & Search Bar -->
          <div style="padding:0.45rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:0.5rem; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.1); flex-shrink:0;">
            <input type="text" id="docSearchInp_${docWinId}" placeholder="Search containers by name, image, or port..." class="form-control" style="font-size:0.75rem; padding:0.25rem 0.55rem; width:280px;">
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <select id="docStateFilter_${docWinId}" class="form-control" style="font-size:0.72rem; padding:0.2rem 0.4rem; height:26px;">
                <option value="ALL">All States</option>
                <option value="running">Running</option>
                <option value="exited">Stopped / Exited</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          <!-- Containers Table View -->
          <div style="flex:1; overflow-y:auto; min-height:0;">
            <table class="table" style="font-size:0.75rem; margin:0;">
              <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:2;">
                <tr>
                  <th style="width:30px;"></th>
                  <th>Name / Container ID</th>
                  <th>Image</th>
                  <th style="width:110px;">Status / State</th>
                  <th>Ports</th>
                  <th style="width:140px;">Created / Uptime</th>
                  <th style="width:160px; text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody id="docContainersTbody_${docWinId}">
                <tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading containers...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const root = bodyEl.querySelector(`#dockerContainer_${docWinId}`);
        const tbody = root.querySelector(`#docContainersTbody_${docWinId}`);
        const searchInp = root.querySelector(`#docSearchInp_${docWinId}`);
        const stateSel = root.querySelector(`#docStateFilter_${docWinId}`);
        const dot = root.querySelector(`#docDot_${docWinId}`);
        const statusTxt = root.querySelector(`#docStatusText_${docWinId}`);
        const badge = root.querySelector(`#docSummaryBadge_${docWinId}`);

        let allContainers = [];

        const renderTable = () => {
          const q = searchInp.value.trim().toLowerCase();
          const filterState = stateSel.value;

          const filtered = allContainers.filter(c => {
            if (filterState !== 'ALL' && c.state !== filterState) return false;
            if (q) {
              const match = (c.name || '').toLowerCase().includes(q) ||
                            (c.image || '').toLowerCase().includes(q) ||
                            (c.id || '').toLowerCase().includes(q) ||
                            (c.ports || '').toLowerCase().includes(q);
              if (!match) return false;
            }
            return true;
          });

          if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:var(--text-muted);">${allContainers.length === 0 ? 'No containers found on server.' : 'No matching containers.'}</td></tr>`;
            return;
          }

          tbody.innerHTML = filtered.map(c => {
            const isRunning = c.state === 'running';
            const isPaused = c.state === 'paused';
            const dotClass = isRunning ? 'status-dot connected' : (isPaused ? 'status-dot' : 'status-dot disconnected');
            const stateColor = isRunning ? '#34d399' : (isPaused ? '#fbbf24' : '#94a3b8');

            return `
              <tr data-id="${c.id}">
                <td style="vertical-align:middle; text-align:center;"><span class="${dotClass}" style="margin:0;"></span></td>
                <td style="vertical-align:middle;">
                  <div style="font-weight:700; color:#f8fafc; font-size:0.78rem;">${escapeHtml(c.name)}</div>
                  <div style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">${c.short_id}</div>
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-family:var(--font-mono); font-size:0.74rem; color:#cbd5e1;">${escapeHtml(c.image)}</span>
                </td>
                <td style="vertical-align:middle;">
                  <span class="badge" style="background:rgba(255,255,255,0.06); color:${stateColor}; font-weight:700; text-transform:uppercase; font-size:0.66rem;">${c.state}</span>
                  <div style="font-size:0.68rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(c.status)}</div>
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-family:var(--font-mono); font-size:0.72rem; color:#38bdf8;">${escapeHtml(c.ports || '-')}</span>
                </td>
                <td style="vertical-align:middle; font-size:0.72rem; color:var(--text-muted);">
                  ${escapeHtml(c.created)}
                </td>
                <td style="vertical-align:middle; text-align:right;">
                  <div style="display:inline-flex; gap:0.25rem;">
                    ${isRunning ? `
                      <button class="btn btn-secondary btn-xs btn-doc-action" data-action="stop" data-id="${c.id}" title="Stop container">Stop</button>
                      <button class="btn btn-secondary btn-xs btn-doc-action" data-action="restart" data-id="${c.id}" title="Restart container">Restart</button>
                    ` : `
                      <button class="btn btn-primary btn-xs btn-doc-action" data-action="start" data-id="${c.id}" title="Start container">Start</button>
                    `}
                    <button class="btn btn-ghost btn-xs btn-doc-logs" data-id="${c.id}" data-name="${escapeHtml(c.name)}" title="Stream container logs">Logs</button>
                    <button class="btn btn-ghost btn-xs btn-doc-action" data-action="delete" data-id="${c.id}" style="color:#f87171;" title="Delete container">&times;</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('');

          // Wire action buttons
          tbody.querySelectorAll('.btn-doc-action').forEach(btn => {
            btn.onclick = async () => {
              const action = btn.dataset.action;
              const id = btn.dataset.id;
              if (action === 'delete') {
                const conf = await DesktopModal.confirm({
                  title: 'Delete Container',
                  message: `Are you sure you want to forcibly remove container ${id.substring(0, 12)}?`,
                  confirmText: 'Delete',
                  confirmClass: 'btn-danger'
                });
                if (!conf) return;
              }

              btn.disabled = true;
              try {
                const res = await safeFetchJson(`/api/servers/${this.serverId}/docker/action`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ container_id: id, action: action })
                });
                if (res.success) {
                  if (window.showToast) window.showToast(res.message, 'success');
                  loadData();
                } else {
                  DesktopModal.alert({ title: 'Container Action Error', message: res.error, type: 'danger' });
                }
              } finally {
                btn.disabled = false;
              }
            };
          });

          // Wire Logs viewer
          tbody.querySelectorAll('.btn-doc-logs').forEach(btn => {
            btn.onclick = async () => {
              const id = btn.dataset.id;
              const name = btn.dataset.name;
              try {
                const res = await safeFetchJson(`/api/servers/${this.serverId}/docker/logs/${id}?tail=300`);
                DesktopModal.showOutput({
                  title: `Container Logs: ${name} (${id.substring(0, 12)})`,
                  output: res.logs || '(Empty logs)',
                  isSuccess: true
                });
              } catch (e) {
                DesktopModal.alert({ title: 'Log Error', message: String(e), type: 'danger' });
              }
            };
          });
        };

        const loadData = async () => {
          try {
            const [statusRes, listRes] = await Promise.all([
              safeFetchJson(`/api/servers/${this.serverId}/docker/status`),
              safeFetchJson(`/api/servers/${this.serverId}/docker/containers`)
            ]);

            if (statusRes.success && statusRes.status.installed) {
              if (statusRes.status.running) {
                dot.className = 'status-dot connected';
                statusTxt.textContent = `Docker v${statusRes.status.server_version || ''}`;
                badge.textContent = `${statusRes.status.containers_running || 0} Running / ${statusRes.status.containers_total || 0} Total`;
              } else {
                dot.className = 'status-dot disconnected';
                statusTxt.textContent = 'Daemon Inactive';
                badge.textContent = statusRes.status.message || 'Inactive';
              }
            } else {
              dot.className = 'status-dot disconnected';
              statusTxt.textContent = 'Docker Not Installed';
              badge.textContent = '0 Containers';
            }

            if (listRes.success) {
              allContainers = listRes.containers || [];
              renderTable();
            }
          } catch (e) {
            console.error('Error loading docker data:', e);
          }
        };

        searchInp.oninput = renderTable;
        stateSel.onchange = renderTable;
        root.querySelector(`#btnRefreshDoc_${docWinId}`).onclick = loadData;

        // Wire Compose Up / Down modal
        root.querySelector(`#btnDocCompose_${docWinId}`).onclick = async () => {
          const compDir = await DesktopModal.prompt({
            title: 'Docker Compose Project',
            message: 'Enter directory path containing docker-compose.yml on the remote server:',
            placeholder: '/var/www/my-project or /home/...',
            defaultValue: '/var/www/'
          });
          if (!compDir) return;

          const action = await DesktopModal.confirm({
            title: 'Compose Action',
            message: `Run 'docker compose up -d --build' in ${compDir}?\n(Click Cancel for 'docker compose down')`,
            confirmText: 'Compose Up',
            cancelText: 'Compose Down'
          });

          const actName = action ? 'up' : 'down';
          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/docker/compose/action`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ work_dir: compDir, action: actName })
            });
            DesktopModal.showOutput({
              title: `Docker Compose ${actName.toUpperCase()}`,
              output: res.output || (res.success ? 'Success' : res.error),
              isSuccess: res.success,
              exitCode: res.exit_code
            });
            loadData();
          } catch (e) {
            DesktopModal.alert({ title: 'Compose Error', message: String(e), type: 'danger' });
          }
        };

        loadData();
      }
    });

    return winObj;
  };

  // =========================================================================
  // 3. DATABASE EXPLORER & BACKUPS (SQLITE .DB VIEWER, MYSQL, POSTGRESQL)
  // =========================================================================

  DesktopAppsController.prototype.launchDatabase = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('database');
    if (existing) {
      WindowManager.bringToFront(existing);
      if (params.path && existing._inspectSqlite) {
        existing._inspectSqlite(params.path);
      }
      return existing;
    }

    const dbWinId = 'db_' + Date.now();
    const winObj = WindowManager.createWindow({
      appId: 'database',
      multiInstance: false,
      title: `Database Explorer & Backups - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>',
      width: 1040,
      height: 680,
      contentHtml: `
        <div class="db-app-container" id="dbContainer_${dbWinId}" style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); color:var(--text-primary); font-family:var(--font-sans); position:relative; overflow:hidden;">
          <!-- Top Tab Navigation -->
          <div style="height:42px; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:space-between; padding:0 1rem; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.35rem;">
              <button class="btn btn-secondary btn-xs db-tab-btn active" data-tab="sqlite" id="tabBtnSqlite_${dbWinId}" style="font-weight:700;">SQLite (.db Viewer)</button>
              <button class="btn btn-secondary btn-xs db-tab-btn" data-tab="mysql" id="tabBtnMysql_${dbWinId}">MySQL / MariaDB</button>
              <button class="btn btn-secondary btn-xs db-tab-btn" data-tab="postgres" id="tabBtnPostgres_${dbWinId}">PostgreSQL</button>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-secondary btn-xs" id="btnBackupDb_${dbWinId}" style="font-size:0.72rem; padding:0.25rem 0.6rem;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                1-Click Compressed Backup
              </button>
            </div>
          </div>

          <!-- TAB 1: SQLite Explorer Pane -->
          <div id="paneSqlite_${dbWinId}" style="flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;">
            <!-- File Selector Bar -->
            <div style="padding:0.5rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.15); display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
              <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">Database File:</span>
              <input type="text" id="inpSqlitePath_${dbWinId}" placeholder="/path/to/database.db or .sqlite" class="form-control" style="font-family:var(--font-mono); font-size:0.75rem; padding:0.25rem 0.55rem; flex:1;" value="${escapeHtml(params.path || '')}">
              <button class="btn btn-primary btn-xs" id="btnInspectSqlite_${dbWinId}">Open Database</button>
              <button class="btn btn-secondary btn-xs" id="btnDiscoverSqlite_${dbWinId}" title="Scan & list all SQLite databases on server">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                Find .db Files
              </button>
              <button class="btn btn-secondary btn-xs" id="btnBrowseDbSftp_${dbWinId}" title="Browse remote filesystem using SFTP file picker">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:3px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                Browse Server...
              </button>
            </div>

            <!-- Main Split Content Area -->
            <div style="flex:1; display:flex; min-height:0;">
              <!-- Left Sidebar: Tables List -->
              <div style="width:230px; border-right:1px solid var(--border-subtle); background:rgba(0,0,0,0.1); display:flex; flex-direction:column; flex-shrink:0;">
                <div style="padding:0.5rem 0.8rem; border-bottom:1px solid var(--border-subtle); font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; display:flex; justify-content:space-between; align-items:center;">
                  <span>Tables</span>
                  <span class="badge" id="badgeSqliteTablesCount_${dbWinId}" style="background:rgba(255,255,255,0.06); font-size:0.68rem;">0</span>
                </div>
                <div style="flex:1; overflow-y:auto; padding:0.4rem;" id="listSqliteTables_${dbWinId}">
                  <div style="padding:1rem 0.5rem; text-align:center; color:var(--text-muted); font-size:0.75rem;">Enter a .db file path and click Open</div>
                </div>
                <div style="padding:0.4rem 0.8rem; border-top:1px solid var(--border-subtle); font-size:0.68rem; color:var(--text-muted); font-family:var(--font-mono);" id="infoSqliteStats_${dbWinId}">--</div>
              </div>

              <!-- Right Pane: Table Data & Query Runner -->
              <div style="flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;">
                <!-- SQL Console & Toolbar -->
                <div style="padding:0.6rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.08); display:flex; flex-direction:column; gap:0.4rem; flex-shrink:0;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Read-Only SQL Query Console</span>
                    <button class="btn btn-secondary btn-xs" id="btnRunSqliteQuery_${dbWinId}" style="font-size:0.7rem; padding:0.15rem 0.5rem;">Execute Query</button>
                  </div>
                  <input type="text" id="inpSqliteQuery_${dbWinId}" placeholder="SELECT * FROM tablename LIMIT 100;" class="form-control" style="font-family:var(--font-mono); font-size:0.75rem; padding:0.3rem 0.55rem; width:100%;">
                </div>

                <!-- Table Grid Header Info -->
                <div style="padding:0.35rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.15); display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:var(--text-secondary); flex-shrink:0;">
                  <span id="txtTableHeading_${dbWinId}">Table Preview</span>
                  <div style="display:flex; gap:0.35rem; align-items:center;">
                    <span id="txtRowCount_${dbWinId}">0 rows</span>
                  </div>
                </div>

                <!-- Grid Data Table -->
                <div style="flex:1; overflow:auto; min-height:0;" id="gridDataContainer_${dbWinId}">
                  <table class="table" style="font-size:0.75rem; margin:0;" id="tableDataGrid_${dbWinId}">
                    <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:2;" id="theadDataGrid_${dbWinId}">
                      <tr><th>No table selected</th></tr>
                    </thead>
                    <tbody id="tbodyDataGrid_${dbWinId}">
                      <tr><td style="text-align:center; padding:3rem; color:var(--text-muted);">Select a table on the left to preview records.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: MySQL / MariaDB Pane -->
          <div id="paneMysql_${dbWinId}" style="flex:1; display:none; flex-direction:column; padding:1.25rem; overflow-y:auto;">
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.15rem; max-width:680px;">
              <h4 style="margin:0 0 0.5rem 0; font-size:0.95rem; font-weight:700; color:#f8fafc;">MySQL / MariaDB Connection</h4>
              <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:1rem;">Inspect databases and tables directly over local Unix socket / localhost without opening external database ports.</p>
              
              <div style="display:flex; gap:0.6rem; align-items:center; margin-bottom:1rem;">
                <input type="text" id="inpMysqlUser_${dbWinId}" placeholder="User (e.g. root)" class="form-control" style="font-size:0.78rem; width:160px;" value="root" autocomplete="username">
                <input type="password" id="inpMysqlPass_${dbWinId}" placeholder="Password (leave blank for socket)" class="form-control" style="font-size:0.78rem; width:220px;" autocomplete="current-password">
                <button class="btn btn-primary btn-sm" id="btnConnectMysql_${dbWinId}">Connect &amp; List Databases</button>
              </div>

              <div id="boxMysqlDbs_${dbWinId}" style="display:none; margin-top:1rem;">
                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Select Database:</label>
                <select id="selMysqlDbs_${dbWinId}" class="form-control" style="font-size:0.78rem; margin-top:3px; max-width:320px;"></select>
                <div id="boxMysqlTables_${dbWinId}" style="margin-top:0.75rem; font-size:0.75rem;"></div>
              </div>
            </div>
          </div>

          <!-- TAB 3: PostgreSQL Pane -->
          <div id="panePostgres_${dbWinId}" style="flex:1; display:none; flex-direction:column; padding:1.25rem; overflow-y:auto;">
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.15rem; max-width:680px;">
              <h4 style="margin:0 0 0.5rem 0; font-size:0.95rem; font-weight:700; color:#f8fafc;">PostgreSQL Peer Connection</h4>
              <p style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:1rem;">Connects to PostgreSQL using local peer authentication via standard SSH subshell.</p>
              <button class="btn btn-primary btn-sm" id="btnConnectPostgres_${dbWinId}">Connect &amp; List Databases</button>

              <div id="boxPgDbs_${dbWinId}" style="display:none; margin-top:1rem;">
                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Select Database:</label>
                <select id="selPgDbs_${dbWinId}" class="form-control" style="font-size:0.78rem; margin-top:3px; max-width:320px;"></select>
                <div id="boxPgTables_${dbWinId}" style="margin-top:0.75rem; font-size:0.75rem;"></div>
              </div>
            </div>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const root = bodyEl.querySelector(`#dbContainer_${dbWinId}`);
        let currentDbPath = params.path || '';
        let currentTable = '';

        // Tab Switching
        const tabs = ['sqlite', 'mysql', 'postgres'];
        root.querySelectorAll('.db-tab-btn').forEach(btn => {
          btn.onclick = () => {
            const target = btn.dataset.tab;
            tabs.forEach(t => {
              root.querySelector(`#tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}_${dbWinId}`).classList.toggle('active', t === target);
              root.querySelector(`#pane${t.charAt(0).toUpperCase() + t.slice(1)}_${dbWinId}`).style.display = (t === target) ? 'flex' : 'none';
            });
          };
        });

        // SQLite Inspection
        const inspectSqlite = async (path) => {
          if (!path) return;
          currentDbPath = path;
          root.querySelector(`#inpSqlitePath_${dbWinId}`).value = path;
          const tablesListEl = root.querySelector(`#listSqliteTables_${dbWinId}`);
          tablesListEl.innerHTML = `<div style="padding:1rem 0.5rem; text-align:center; color:var(--text-muted); font-size:0.75rem;">Inspecting database...</div>`;

          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/database/sqlite/inspect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: path })
            });

            if (!res.success) {
              tablesListEl.innerHTML = `<div style="padding:1rem 0.5rem; text-align:center; color:#f87171; font-size:0.75rem;">${escapeHtml(res.error)}</div>`;
              return;
            }

            root.querySelector(`#badgeSqliteTablesCount_${dbWinId}`).textContent = (res.tables || []).length;
            root.querySelector(`#infoSqliteStats_${dbWinId}`).textContent = `${formatBytes(res.size)} | SQLite v${res.sqlite_version || ''}`;

            if (!res.tables || res.tables.length === 0) {
              tablesListEl.innerHTML = `<div style="padding:1rem 0.5rem; text-align:center; color:var(--text-muted); font-size:0.75rem;">No user tables found in database.</div>`;
              return;
            }

            tablesListEl.innerHTML = res.tables.map(tbl => `
              <div class="db-table-row" data-table="${escapeHtml(tbl)}" style="padding:0.35rem 0.6rem; border-radius:4px; cursor:pointer; font-size:0.74rem; font-family:var(--font-mono); color:#cbd5e1; display:flex; align-items:center; gap:0.4rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; color:#38bdf8;"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                <span style="overflow:hidden; text-overflow:ellipsis;">${escapeHtml(tbl)}</span>
              </div>
            `).join('');

            tablesListEl.querySelectorAll('.db-table-row').forEach(row => {
              row.onclick = () => {
                tablesListEl.querySelectorAll('.db-table-row').forEach(r => r.style.background = 'transparent');
                row.style.background = 'rgba(56,189,248,0.15)';
                loadTableData(row.dataset.table);
              };
            });

            // Auto-load first table
            if (res.tables.length > 0) {
              tablesListEl.querySelector('.db-table-row').click();
            }
          } catch (e) {
            tablesListEl.innerHTML = `<div style="padding:1rem 0.5rem; text-align:center; color:#f87171; font-size:0.75rem;">${escapeHtml(String(e))}</div>`;
          }
        };

        winObj._inspectSqlite = inspectSqlite;

        // Load Table Rows
        const loadTableData = async (tbl) => {
          currentTable = tbl;
          root.querySelector(`#txtTableHeading_${dbWinId}`).textContent = `Table: ${tbl}`;
          root.querySelector(`#inpSqliteQuery_${dbWinId}`).value = `SELECT * FROM "${tbl}" LIMIT 100;`;

          const thead = root.querySelector(`#theadDataGrid_${dbWinId}`);
          const tbody = root.querySelector(`#tbodyDataGrid_${dbWinId}`);
          tbody.innerHTML = `<tr><td style="text-align:center; padding:3rem; color:var(--text-muted);">Fetching rows...</td></tr>`;

          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/database/sqlite/table`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: currentDbPath, table: tbl, limit: 100, offset: 0 })
            });

            if (!res.success) {
              tbody.innerHTML = `<tr><td style="text-align:center; padding:2rem; color:#f87171;">${escapeHtml(res.error)}</td></tr>`;
              return;
            }

            root.querySelector(`#txtRowCount_${dbWinId}`).textContent = `${res.rows.length} of ${res.total_rows} rows`;

            // Headers
            thead.innerHTML = `<tr>${res.columns.map(c => `
              <th>
                <div style="color:#f8fafc; font-weight:700;">${escapeHtml(c.name)}</div>
                <div style="font-size:0.64rem; color:var(--text-muted); font-weight:normal;">${escapeHtml(c.type || 'TEXT')} ${c.pk ? '(PK)' : ''}</div>
              </th>
            `).join('')}</tr>`;

            // Rows
            if (res.rows.length === 0) {
              tbody.innerHTML = `<tr><td colspan="${res.columns.length}" style="text-align:center; padding:2.5rem; color:var(--text-muted);">Table is empty.</td></tr>`;
              return;
            }

            tbody.innerHTML = res.rows.map(r => `
              <tr>
                ${r.map(cell => `<td style="font-family:var(--font-mono); font-size:0.72rem; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(cell)}">${cell === null ? '<span style="color:var(--text-muted);">NULL</span>' : escapeHtml(cell)}</td>`).join('')}
              </tr>
            `).join('');
          } catch (e) {
            tbody.innerHTML = `<tr><td style="text-align:center; padding:2rem; color:#f87171;">${escapeHtml(String(e))}</td></tr>`;
          }
        };

        // Query Runner
        const runQuery = async () => {
          const q = root.querySelector(`#inpSqliteQuery_${dbWinId}`).value.trim();
          if (!q || !currentDbPath) return;

          const thead = root.querySelector(`#theadDataGrid_${dbWinId}`);
          const tbody = root.querySelector(`#tbodyDataGrid_${dbWinId}`);
          tbody.innerHTML = `<tr><td style="text-align:center; padding:3rem; color:var(--text-muted);">Executing query...</td></tr>`;

          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/database/sqlite/query`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: currentDbPath, query: q })
            });

            if (!res.success) {
              tbody.innerHTML = `<tr><td style="text-align:center; padding:2rem; color:#f87171;">${escapeHtml(res.error)}</td></tr>`;
              return;
            }

            root.querySelector(`#txtRowCount_${dbWinId}`).textContent = `${res.row_count} rows (${res.elapsed_ms} ms)`;
            thead.innerHTML = `<tr>${res.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;

            if (res.rows.length === 0) {
              tbody.innerHTML = `<tr><td colspan="${res.columns.length || 1}" style="text-align:center; padding:2rem; color:var(--text-muted);">Query returned 0 rows.</td></tr>`;
              return;
            }

            tbody.innerHTML = res.rows.map(r => `
              <tr>
                ${r.map(cell => `<td style="font-family:var(--font-mono); font-size:0.72rem; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cell === null ? '<span style="color:var(--text-muted);">NULL</span>' : escapeHtml(cell)}</td>`).join('')}
              </tr>
            `).join('');
          } catch (e) {
            tbody.innerHTML = `<tr><td style="text-align:center; padding:2rem; color:#f87171;">${escapeHtml(String(e))}</td></tr>`;
          }
        };

        root.querySelector(`#btnInspectSqlite_${dbWinId}`).onclick = () => {
          inspectSqlite(root.querySelector(`#inpSqlitePath_${dbWinId}`).value.trim());
        };

        root.querySelector(`#btnRunSqliteQuery_${dbWinId}`).onclick = runQuery;
        root.querySelector(`#inpSqliteQuery_${dbWinId}`).onkeydown = (e) => {
          if (e.key === 'Enter') runQuery();
        };

        // Auto-Discover .db files with Full Database Picker Modal
        root.querySelector(`#btnDiscoverSqlite_${dbWinId}`).onclick = () => {
          this.showDatabasePicker({
            serverId: this.serverId,
            serverName: this.serverName,
            onSelect: (selectedDbPath) => {
              root.querySelector(`#inpSqlitePath_${dbWinId}`).value = selectedDbPath;
              inspectSqlite(selectedDbPath);
            }
          });
        };

        // Browse Server Filesystem directly with SFTP Picker
        root.querySelector(`#btnBrowseDbSftp_${dbWinId}`).onclick = () => {
          if (typeof this.showDirectoryPicker === 'function') {
            this.showDirectoryPicker({
              serverId: this.serverId,
              initialPath: root.querySelector(`#inpSqlitePath_${dbWinId}`).value.trim() || '/var/www/',
              title: 'Select SQLite Database File (.db / .sqlite)',
              selectFiles: true,
              fileExtensions: ['.db', '.sqlite', '.sqlite3'],
              onSelect: (selectedDbPath) => {
                root.querySelector(`#inpSqlitePath_${dbWinId}`).value = selectedDbPath;
                inspectSqlite(selectedDbPath);
              }
            });
          }
        };

        // 1-Click Backup
        root.querySelector(`#btnBackupDb_${dbWinId}`).onclick = async () => {
          if (!currentDbPath) {
            DesktopModal.alert({ title: 'No Database', message: 'Please open an SQLite database or connect to MySQL/Postgres first.', type: 'warning' });
            return;
          }

          const btn = root.querySelector(`#btnBackupDb_${dbWinId}`);
          btn.disabled = true;
          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/database/dump`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'sqlite', target: currentDbPath })
            });

            if (res.success) {
              DesktopModal.alert({
                title: 'Backup Created',
                message: `${res.message}\nSaved to remote path: ${res.dump_file}\nYou can download it via the SFTP File Manager.`,
                type: 'success'
              });
            } else {
              DesktopModal.alert({ title: 'Backup Error', message: res.error, type: 'danger' });
            }
          } finally {
            btn.disabled = false;
          }
        };

        if (params.path) {
          inspectSqlite(params.path);
        }
      }
    });

    return winObj;
  };

  // =========================================================================
  // 4. FIREWALL (UFW) & FAIL2BAN SECURITY SHIELD
  // =========================================================================

  DesktopAppsController.prototype.launchFirewall = function (params = {}) {
    const existing = WindowManager.getWindowByAppId('firewall');
    if (existing) {
      WindowManager.bringToFront(existing);
      if (params.ban_ip && existing._triggerBanIp) {
        existing._triggerBanIp(params.ban_ip);
      }
      return existing;
    }

    const fwWinId = 'fw_' + Date.now();
    const winObj = WindowManager.createWindow({
      appId: 'firewall',
      multiInstance: false,
      title: `Firewall (UFW) & Security Shield - ${this.serverName}`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>',
      width: 940,
      height: 620,
      contentHtml: `
        <div class="firewall-app-container" id="fwContainer_${fwWinId}" style="height:100%; display:flex; flex-direction:column; background:var(--bg-canvas); color:var(--text-primary); font-family:var(--font-sans); position:relative; overflow:hidden;">
          <!-- Top Utility Toolbar -->
          <div style="height:42px; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:space-between; padding:0 1rem; flex-shrink:0;">
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span class="status-dot disconnected" id="fwDot_${fwWinId}"></span>
              <span style="font-size:0.82rem; font-weight:700;" id="fwStatusText_${fwWinId}">Checking Firewall...</span>
              <span class="badge" id="fwPolicyBadge_${fwWinId}" style="background:rgba(255,255,255,0.06); font-size:0.7rem;">--</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <button class="btn btn-secondary btn-xs" id="btnToggleFw_${fwWinId}" style="font-size:0.72rem; padding:0.25rem 0.55rem;">Toggle Firewall</button>
              <button class="btn btn-primary btn-xs" id="btnAddRule_${fwWinId}" style="font-size:0.72rem; padding:0.25rem 0.55rem;">+ Add Rule</button>
              <button class="btn btn-danger btn-xs" id="btnEmergencyBan_${fwWinId}" style="font-size:0.72rem; padding:0.25rem 0.55rem;">1-Click Ban IP</button>
              <button class="btn btn-secondary btn-xs" id="btnRefreshFw_${fwWinId}" style="font-size:0.72rem; padding:0.25rem 0.55rem;">Refresh</button>
            </div>
          </div>

          <!-- Tab Bar -->
          <div style="padding:0.4rem 1rem; border-bottom:1px solid var(--border-subtle); background:rgba(0,0,0,0.1); display:flex; gap:0.35rem; flex-shrink:0;">
            <button class="btn btn-secondary btn-xs fw-tab-btn active" data-tab="ufw" id="tabBtnUfw_${fwWinId}">UFW Active Rules</button>
            <button class="btn btn-secondary btn-xs fw-tab-btn" data-tab="fail2ban" id="tabBtnFail2ban_${fwWinId}">Fail2Ban Jails &amp; Bans</button>
          </div>

          <!-- TAB 1: UFW Rules Table -->
          <div id="paneUfw_${fwWinId}" style="flex:1; display:flex; flex-direction:column; min-height:0; overflow-y:auto;">
            <table class="table" style="font-size:0.75rem; margin:0;">
              <thead style="position:sticky; top:0; background:var(--bg-surface); z-index:2;">
                <tr>
                  <th style="width:50px;">#</th>
                  <th>To (Port / Service)</th>
                  <th style="width:120px;">Action</th>
                  <th>From (Source IP / Net)</th>
                  <th style="width:70px;">Proto</th>
                  <th style="width:80px; text-align:right;">Delete</th>
                </tr>
              </thead>
              <tbody id="fwRulesTbody_${fwWinId}">
                <tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">Loading firewall rules...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- TAB 2: Fail2Ban Pane -->
          <div id="paneFail2ban_${fwWinId}" style="flex:1; display:none; flex-direction:column; min-height:0; overflow-y:auto; padding:1.25rem;">
            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:1.15rem; margin-bottom:1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                <span style="font-size:0.85rem; font-weight:700; color:#f8fafc;" id="txtFbStatus_${fwWinId}">Fail2Ban Service</span>
                <span class="badge" id="badgeFbActiveJails_${fwWinId}" style="background:rgba(56,189,248,0.15); color:#38bdf8;">--</span>
              </div>
              <p style="font-size:0.74rem; color:var(--text-secondary); margin:0;">Fail2Ban inspects auth logs for brute-force patterns and dynamically updates firewall drop rules.</p>
            </div>

            <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; overflow:hidden;">
              <div style="padding:0.6rem 1rem; border-bottom:1px solid var(--border-subtle); font-size:0.78rem; font-weight:700; color:#f8fafc;">Currently Banned IPs</div>
              <table class="table" style="font-size:0.75rem; margin:0;">
                <thead>
                  <tr>
                    <th>Banned IP Address</th>
                    <th>Jail Name</th>
                    <th style="text-align:right;">Action</th>
                  </tr>
                </thead>
                <tbody id="fbBannedTbody_${fwWinId}">
                  <tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--text-muted);">No currently banned IPs in fail2ban jails.</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `,
      onInit: (bodyEl, winObj) => {
        const root = bodyEl.querySelector(`#fwContainer_${fwWinId}`);
        const tbody = root.querySelector(`#fwRulesTbody_${fwWinId}`);
        const dot = root.querySelector(`#fwDot_${fwWinId}`);
        const statusTxt = root.querySelector(`#fwStatusText_${fwWinId}`);
        const policyBadge = root.querySelector(`#fwPolicyBadge_${fwWinId}`);
        const toggleBtn = root.querySelector(`#btnToggleFw_${fwWinId}`);

        let isFwActive = false;

        // Tab Switching
        root.querySelector(`#tabBtnUfw_${fwWinId}`).onclick = () => {
          root.querySelector(`#tabBtnUfw_${fwWinId}`).classList.add('active');
          root.querySelector(`#tabBtnFail2ban_${fwWinId}`).classList.remove('active');
          root.querySelector(`#paneUfw_${fwWinId}`).style.display = 'flex';
          root.querySelector(`#paneFail2ban_${fwWinId}`).style.display = 'none';
        };
        root.querySelector(`#tabBtnFail2ban_${fwWinId}`).onclick = () => {
          root.querySelector(`#tabBtnFail2ban_${fwWinId}`).classList.add('active');
          root.querySelector(`#tabBtnUfw_${fwWinId}`).classList.remove('active');
          root.querySelector(`#paneUfw_${fwWinId}`).style.display = 'none';
          root.querySelector(`#paneFail2ban_${fwWinId}`).style.display = 'flex';
          loadFail2ban();
        };

        const loadUfw = async () => {
          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/firewall/status`);
            if (!res.success || !res.firewall.installed) {
              dot.className = 'status-dot disconnected';
              statusTxt.textContent = 'UFW Not Available';
              policyBadge.textContent = 'Requires sudo';
              tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">${res.firewall ? res.firewall.message : 'UFW not installed'}</td></tr>`;
              return;
            }

            isFwActive = res.firewall.active;
            dot.className = isFwActive ? 'status-dot connected' : 'status-dot disconnected';
            statusTxt.textContent = isFwActive ? 'UFW Active' : 'UFW Inactive';
            policyBadge.textContent = res.firewall.default_policy || (isFwActive ? 'Enforcing' : 'Disabled');
            toggleBtn.textContent = isFwActive ? 'Disable Firewall' : 'Enable Firewall';
            toggleBtn.className = isFwActive ? 'btn btn-secondary btn-xs' : 'btn btn-primary btn-xs';

            const rules = res.firewall.rules || [];
            if (rules.length === 0) {
              tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:3rem; color:var(--text-muted);">${isFwActive ? 'No rules configured. All incoming traffic follows default policy.' : 'Firewall is currently inactive.'}</td></tr>`;
              return;
            }

            tbody.innerHTML = rules.map(r => {
              const isAllow = r.action.includes('ALLOW');
              const isDeny = r.action.includes('DENY') || r.action.includes('REJECT');
              const actBadge = isAllow ? 'rgba(16,185,129,0.15)' : (isDeny ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)');
              const actColor = isAllow ? '#34d399' : (isDeny ? '#f87171' : '#cbd5e1');

              return `
                <tr>
                  <td style="font-family:var(--font-mono); color:var(--text-muted); font-weight:700;">[${r.num}]</td>
                  <td style="font-weight:700; color:#f8fafc; font-family:var(--font-mono);">${escapeHtml(r.to)}</td>
                  <td><span class="badge" style="background:${actBadge}; color:${actColor}; font-weight:700;">${escapeHtml(r.action)}</span></td>
                  <td style="font-family:var(--font-mono); color:#cbd5e1;">${escapeHtml(r.from)}</td>
                  <td><span style="font-size:0.68rem; color:var(--text-muted);">${r.is_v6 ? 'IPv6' : 'IPv4'}</span></td>
                  <td style="text-align:right;">
                    <button class="btn btn-ghost btn-xs btn-del-rule" data-num="${r.num}" style="color:#f87171;" title="Delete rule [${r.num}]">&times;</button>
                  </td>
                </tr>
              `;
            }).join('');

            tbody.querySelectorAll('.btn-del-rule').forEach(btn => {
              btn.onclick = async () => {
                const num = btn.dataset.num;
                const conf = await DesktopModal.confirm({
                  title: 'Delete Rule',
                  message: `Are you sure you want to delete firewall rule [${num}]?`,
                  confirmText: 'Delete Rule',
                  confirmClass: 'btn-danger'
                });
                if (!conf) return;

                btn.disabled = true;
                try {
                  const delRes = await safeFetchJson(`/api/servers/${this.serverId}/firewall/rule/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rule_number: num })
                  });
                  if (delRes.success) {
                    if (window.showToast) window.showToast(`Deleted rule [${num}]`, 'success');
                    loadUfw();
                  } else {
                    DesktopModal.alert({ title: 'Delete Error', message: delRes.error, type: 'danger' });
                  }
                } finally {
                  btn.disabled = false;
                }
              };
            });
          } catch (e) {
            console.error('Error loading UFW rules:', e);
          }
        };

        const loadFail2ban = async () => {
          const fbTbody = root.querySelector(`#fbBannedTbody_${fwWinId}`);
          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/firewall/fail2ban/status`);
            if (!res.success || !res.fail2ban.installed) {
              root.querySelector(`#txtFbStatus_${fwWinId}`).textContent = 'Fail2Ban Not Installed';
              root.querySelector(`#badgeFbActiveJails_${fwWinId}`).textContent = 'Inactive';
              return;
            }

            const jails = res.fail2ban.jails || [];
            root.querySelector(`#badgeFbActiveJails_${fwWinId}`).textContent = `${jails.length} Jails Active`;

            const banned = res.fail2ban.banned_ips || [];
            if (banned.length === 0) {
              fbTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:2rem; color:var(--text-muted);">No currently banned IPs across all jails.</td></tr>`;
              return;
            }

            fbTbody.innerHTML = banned.map(b => `
              <tr>
                <td style="font-family:var(--font-mono); font-weight:700; color:#f8fafc;">${escapeHtml(b.ip)}</td>
                <td><span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8;">${escapeHtml(b.jail)}</span></td>
                <td style="text-align:right;">
                  <button class="btn btn-secondary btn-xs btn-unban-ip" data-jail="${escapeHtml(b.jail)}" data-ip="${escapeHtml(b.ip)}">Unban</button>
                </td>
              </tr>
            `).join('');

            fbTbody.querySelectorAll('.btn-unban-ip').forEach(btn => {
              btn.onclick = async () => {
                const j = btn.dataset.jail;
                const ip = btn.dataset.ip;
                btn.disabled = true;
                try {
                  const unbanRes = await safeFetchJson(`/api/servers/${this.serverId}/firewall/fail2ban/action`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'unban', jail: j, ip: ip })
                  });
                  if (unbanRes.success) {
                    if (window.showToast) window.showToast(`Unbanned ${ip} in ${j}`, 'success');
                    loadFail2ban();
                  }
                } finally {
                  btn.disabled = false;
                }
              };
            });
          } catch (e) {
            console.error('Error loading fail2ban:', e);
          }
        };

        // Toggle Firewall
        toggleBtn.onclick = async () => {
          const action = !isFwActive;
          const conf = await DesktopModal.confirm({
            title: action ? 'Enable Firewall' : 'Disable Firewall',
            message: action
              ? 'Enabling UFW will enforce all firewall rules. Ensure port 22 (SSH) is allowed to avoid locking yourself out.'
              : 'Disabling UFW will stop active packet filtering on this server. Proceed?',
            confirmText: action ? 'Enable UFW' : 'Disable UFW',
            confirmClass: action ? 'btn-primary' : 'btn-danger'
          });
          if (!conf) return;

          toggleBtn.disabled = true;
          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/firewall/toggle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ enable: action })
            });
            if (res.success) {
              if (window.showToast) window.showToast(res.message, 'success');
              loadUfw();
            } else {
              DesktopModal.alert({ title: 'Firewall Error', message: res.message, type: 'danger' });
            }
          } finally {
            toggleBtn.disabled = false;
          }
        };

        // Add Rule Dialog
        root.querySelector(`#btnAddRule_${fwWinId}`).onclick = async () => {
          const ruleType = await DesktopModal.prompt({
            title: 'Add Firewall Rule',
            message: 'Select rule type:\n1: allow_port (e.g. 80, 443, 3000)\n2: deny_ip (block abusive IP)\n3: limit_port (rate limit e.g. 22)\n4: allow_ip (whitelist trusted IP)',
            defaultValue: 'allow_port',
            placeholder: 'allow_port or deny_ip'
          });
          if (!ruleType) return;

          const target = await DesktopModal.prompt({
            title: 'Rule Target',
            message: ruleType.includes('ip') ? 'Enter IP address to block or allow:' : 'Enter Port number or service (e.g. 80, 443, 8080/tcp):',
            placeholder: ruleType.includes('ip') ? '1.2.3.4' : '80/tcp'
          });
          if (!target) return;

          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/firewall/rule/add`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: ruleType.trim(), target: target.trim() })
            });
            if (res.success) {
              if (window.showToast) window.showToast(`Rule added: ${target}`, 'success');
              loadUfw();
            } else {
              DesktopModal.alert({ title: 'Add Rule Error', message: res.error, type: 'danger' });
            }
          } catch (e) {
            DesktopModal.alert({ title: 'Error', message: String(e), type: 'danger' });
          }
        };

        // 1-Click Ban IP
        const triggerBanIp = async (prefillIp = '') => {
          const ip = await DesktopModal.prompt({
            title: 'Emergency 1-Click Ban IP',
            message: 'Enter abusive IP address to immediately block at firewall rule position 1:',
            defaultValue: prefillIp,
            placeholder: '1.2.3.4'
          });
          if (!ip) return;

          try {
            const res = await safeFetchJson(`/api/servers/${this.serverId}/firewall/ban-ip`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ip: ip.trim(), comment: 'ShellMan Shield' })
            });
            if (res.success) {
              DesktopModal.alert({
                title: 'IP Blocked',
                message: `${res.message}\nUFW: ${res.ufw_result}\nFail2Ban: ${res.fail2ban_result}`,
                type: 'success'
              });
              loadUfw();
            } else {
              DesktopModal.alert({ title: 'Ban Error', message: res.error, type: 'danger' });
            }
          } catch (e) {
            DesktopModal.alert({ title: 'Error', message: String(e), type: 'danger' });
          }
        };

        winObj._triggerBanIp = triggerBanIp;
        root.querySelector(`#btnEmergencyBan_${fwWinId}`).onclick = () => triggerBanIp();
        root.querySelector(`#btnRefreshFw_${fwWinId}`).onclick = loadUfw;

        loadUfw();

        if (params.ban_ip) {
          triggerBanIp(params.ban_ip);
        }
      }
    });

    return winObj;
  };

  // =========================================================================
  // 5. DEDICATED SQLITE DATABASE PICKER DIALOG
  // =========================================================================
  DesktopAppsController.prototype.showDatabasePicker = function ({ serverId, serverName, onSelect }) {
    const sId = serverId || this.serverId;
    const sName = serverName || this.serverName || 'Server';

    const overlay = document.createElement('div');
    overlay.className = 'desktop-modal-backdrop';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.76);
      backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center;
      z-index: 100000; padding: 1rem; font-family: var(--font-sans); color: var(--text-primary);
    `;

    overlay.innerHTML = `
      <div style="width: 100%; max-width: 700px; height: 560px; background: var(--bg-surface, #111827); border: 1px solid var(--border-color, #1f2937); border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85); display: flex; flex-direction: column; overflow: hidden;">
        <!-- Header -->
        <div style="height: 44px; padding: 0 1rem; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 0.55rem; font-weight: 700; font-size: 0.88rem; color: #f8fafc;">
            <svg style="width: 18px; height: 18px; color: #10b981;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
            <span>SQLite Database Picker</span>
            <span class="badge" style="background: rgba(16,185,129,0.15); color: #10b981; font-family: var(--font-mono); font-size: 0.68rem;">${escapeHtml(sName)}</span>
            <span class="badge" id="dbPickerCountBadge" style="background: rgba(255,255,255,0.06); color: var(--text-muted); font-size: 0.68rem;">Scanning...</span>
          </div>
          <button class="btn btn-secondary btn-xs" id="dbPickerCloseBtn" style="padding: 0.15rem 0.45rem;">&times;</button>
        </div>

        <!-- Filter & SFTP Browse Bar -->
        <div style="padding: 0.55rem 0.85rem; border-bottom: 1px solid var(--border-subtle); background: rgba(0,0,0,0.22); display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
          <div style="flex: 1; display: flex; align-items: center; background: var(--bg-canvas, #090d16); border: 1px solid var(--border-color, #1f2937); border-radius: 6px; padding: 0.2rem 0.55rem;">
            <svg style="width: 13px; height: 13px; color: #94a3b8; margin-right: 0.4rem; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="dbPickerSearchInput" placeholder="Filter databases by filename or directory path..." style="width: 100%; background: transparent; border: none; outline: none; font-family: var(--font-sans); font-size: 0.78rem; color: #f8fafc;">
          </div>
          <button class="btn btn-secondary btn-xs" id="dbPickerBrowseSftpBtn" style="display: flex; align-items: center; gap: 4px; padding: 0.3rem 0.65rem;" title="Browse Server Folders with SFTP File Picker">
            <svg style="width: 13px; height: 13px; color: #38bdf8;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Browse Server (SFTP)...
          </button>
          <button class="btn btn-secondary btn-xs" id="dbPickerRefreshBtn" style="padding: 0.3rem 0.55rem;" title="Rescan /home, /var/www, /opt, /tmp">
            <svg style="width: 13px; height: 13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        </div>

        <!-- Discovered Database Files List View -->
        <div id="dbPickerList" style="flex: 1; overflow-y: auto; padding: 0.6rem; display: flex; flex-direction: column; gap: 4px;">
          <div style="text-align: center; padding: 3.5rem; color: var(--text-muted); font-size: 0.8rem;">
            <span class="spinner-border spinner-border-sm" style="width: 14px; height: 14px; margin-right: 6px;"></span>
            Scanning server directories for SQLite databases...
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 0.65rem 1rem; border-top: 1px solid var(--border-subtle); background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-shrink: 0;">
          <div style="flex: 1; display: flex; align-items: center; gap: 0.4rem; min-width: 0;">
            <span style="font-size: 0.72rem; color: var(--text-muted); flex-shrink: 0;">Selected Path:</span>
            <input type="text" id="dbPickerManualPath" class="form-control" style="flex: 1; font-family: var(--font-mono); font-size: 0.74rem; padding: 0.2rem 0.5rem;" placeholder="/path/to/database.db">
          </div>
          <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
            <button class="btn btn-secondary btn-sm" id="dbPickerCancelBtn">Cancel</button>
            <button class="btn btn-primary btn-sm" id="dbPickerConfirmBtn" style="font-weight: 600;">Open Database</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const listEl = overlay.querySelector('#dbPickerList');
    const searchInp = overlay.querySelector('#dbPickerSearchInput');
    const manualPathInp = overlay.querySelector('#dbPickerManualPath');
    const countBadge = overlay.querySelector('#dbPickerCountBadge');
    const closeBtn = overlay.querySelector('#dbPickerCloseBtn');
    const cancelBtn = overlay.querySelector('#dbPickerCancelBtn');
    const confirmBtn = overlay.querySelector('#dbPickerConfirmBtn');
    const browseSftpBtn = overlay.querySelector('#dbPickerBrowseSftpBtn');
    const refreshBtn = overlay.querySelector('#dbPickerRefreshBtn');

    let allFiles = [];
    let selectedPath = '';

    const closeModal = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
      const path = manualPathInp.value.trim() || selectedPath;
      if (!path) {
        if (typeof window.showToast === 'function') {
          window.showToast('Please select or specify a database file', 'warning');
        }
        return;
      }
      closeModal();
      if (typeof onSelect === 'function') onSelect(path);
    };

    const renderList = (filter = '') => {
      filter = (filter || '').toLowerCase().trim();
      const filtered = allFiles.filter(f => {
        if (!filter) return true;
        return f.name.toLowerCase().includes(filter) || f.path.toLowerCase().includes(filter);
      });

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: 0.8rem;">
            ${allFiles.length === 0 
              ? 'No .db or .sqlite files found in /home, /var/www, /opt, or /tmp.<br>Use <strong>"Browse Server (SFTP)..."</strong> above to locate your database file.' 
              : `No databases matching "${escapeHtml(filter)}"`}
          </div>
        `;
        return;
      }

      listEl.innerHTML = filtered.map(f => {
        const isSel = f.path === selectedPath;
        return `
          <div class="db-picker-row" data-path="${escapeHtml(f.path)}" style="display:flex; align-items:center; justify-content:space-between; padding:0.5rem 0.75rem; border-radius:6px; background:${isSel ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${isSel ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.05)'}; cursor:pointer; transition:all 0.15s; user-select:none;">
            <!-- Left: DB Icon & Names -->
            <div style="display:flex; align-items:center; gap:0.65rem; min-width:0; flex:1;">
              <div style="width:32px; height:32px; border-radius:7px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <svg style="width:16px; height:16px; color:#10b981;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
              </div>
              <div style="min-width:0; overflow:hidden;">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span style="font-weight:600; font-size:0.82rem; color:#f1f5f9; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(f.name)}</span>
                  ${f.size ? `<span class="badge" style="background:rgba(56,189,248,0.12); color:#38bdf8; font-family:var(--font-mono); font-size:0.66rem;">${escapeHtml(f.size)}</span>` : ''}
                </div>
                <div style="font-family:var(--font-mono); font-size:0.71rem; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(f.path)}</div>
              </div>
            </div>

            <!-- Right: Action Button -->
            <div style="display:flex; align-items:center; gap:0.4rem; flex-shrink:0; margin-left:0.5rem;">
              <button class="btn btn-primary btn-xs btn-open-db" data-path="${escapeHtml(f.path)}" style="font-size:0.72rem; padding:0.2rem 0.55rem;">Open</button>
            </div>
          </div>
        `;
      }).join('');

      const rows = listEl.querySelectorAll('.db-picker-row');
      rows.forEach(r => {
        r.onclick = (e) => {
          if (e.target.closest('.btn-open-db')) return;
          rows.forEach(row => {
            row.style.background = 'rgba(255,255,255,0.02)';
            row.style.borderColor = 'rgba(255,255,255,0.05)';
          });
          r.style.background = 'rgba(16,185,129,0.18)';
          r.style.borderColor = 'rgba(16,185,129,0.4)';
          selectedPath = r.dataset.path;
          manualPathInp.value = selectedPath;
        };

        r.ondblclick = () => {
          selectedPath = r.dataset.path;
          closeModal();
          if (typeof onSelect === 'function') onSelect(selectedPath);
        };
      });

      listEl.querySelectorAll('.btn-open-db').forEach(b => {
        b.onclick = (e) => {
          e.stopPropagation();
          closeModal();
          if (typeof onSelect === 'function') onSelect(b.dataset.path);
        };
      });
    };

    const loadDatabases = async () => {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 3.5rem; color: var(--text-muted); font-size: 0.8rem;">
          <span class="spinner-border spinner-border-sm" style="width: 14px; height: 14px; margin-right: 6px;"></span>
          Scanning server directories for SQLite databases...
        </div>
      `;
      countBadge.textContent = 'Scanning...';

      try {
        const res = await safeFetchJson(`/api/servers/${sId}/database/sqlite/discover`);
        if (res.success && Array.isArray(res.files)) {
          allFiles = res.files;
          countBadge.textContent = `${allFiles.length} Found`;
          if (allFiles.length > 0 && !selectedPath) {
            selectedPath = allFiles[0].path;
            manualPathInp.value = selectedPath;
          }
          renderList(searchInp.value);
        } else {
          allFiles = [];
          countBadge.textContent = '0 Found';
          renderList();
        }
      } catch (err) {
        listEl.innerHTML = `<div style="text-align:center; padding:2.5rem; color:#f87171; font-size:0.8rem;">Error scanning databases: ${err}</div>`;
        countBadge.textContent = 'Error';
      }
    };

    searchInp.oninput = () => renderList(searchInp.value);
    refreshBtn.onclick = loadDatabases;

    browseSftpBtn.onclick = () => {
      closeModal();
      if (typeof this.showDirectoryPicker === 'function') {
        this.showDirectoryPicker({
          serverId: sId,
          initialPath: manualPathInp.value.trim() || '/var/www/',
          title: 'Select SQLite Database File (.db / .sqlite)',
          selectFiles: true,
          fileExtensions: ['.db', '.sqlite', '.sqlite3'],
          onSelect: (chosenPath) => {
            if (typeof onSelect === 'function') onSelect(chosenPath);
          }
        });
      }
    };

    loadDatabases();
  };
})();

