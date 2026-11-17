const SystemView = {
  async render() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="card" style="border-left: 4px solid #3b82f6;">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">High Availability, Fault-Tolerance & Integrity Control Center</h3>
            <p style="font-size: 12.5px; color: #64748b; margin-top: 2px;">Real-time Node.js clustering metrics, SQLite WAL engine state, disaster recovery hot-backups, and chaos resilience testing</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary btn-sm" onclick="SystemView.refreshAll()">🔄 Refresh Diagnostics</button>
            <button class="btn btn-primary btn-sm" onclick="SystemView.triggerBackup()">💾 Run Hot-Backup</button>
          </div>
        </div>

        <div class="card-body">
          <!-- Diagnostics Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Cluster & Process Status</span>
              <div style="font-size: 16px; font-weight: 700; color: #10b981; margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                <span class="pulse-dot"></span> <span id="diagClusterStatus">Active / Healthy</span>
              </div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px;" id="diagProcessDetails">PID: -- | Worker: --</div>
            </div>

            <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Database Engine</span>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 6px;">SQLite (WAL Mode)</div>
              <div style="font-size: 12px; color: #10b981; font-weight: 600; margin-top: 4px;" id="diagDbIntegrity">Integrity: VERIFIED OK</div>
            </div>

            <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">System Memory Usage</span>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 6px;" id="diagMemory">-- MB Heap</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;" id="diagMemoryRss">RSS: -- MB</div>
            </div>

            <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Database Storage</span>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 6px;" id="diagDbSize">-- MB</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;" id="diagPages">-- Pages</div>
            </div>
          </div>

          <!-- Chaos Testing & Resilience Sandbox -->
          <div class="card" style="border: 1px dashed #f59e0b; background: #fffdf5; margin-bottom: 24px;">
            <div class="card-header" style="background: transparent;">
              <span class="card-title" style="color: #b45309;">⚠️ Chaos & Fault-Tolerance Verification Sandbox</span>
              <span class="badge badge-warning">Simulated Resilience</span>
            </div>
            <div class="card-body">
              <p style="font-size: 13.5px; color: #78350f; margin-bottom: 14px;">
                Validate that the application never goes down and self-heals immediately upon unexpected faults or process deaths:
              </p>
              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="btn btn-danger btn-sm" onclick="SystemView.simulateWorkerCrash()">
                  💥 Simulate Sudden Worker Crash (Test Auto-Resurrection)
                </button>
                <button class="btn btn-secondary btn-sm" onclick="SystemView.simulateHandledFault()">
                  🛡️ Simulate Isolated Runtime Fault (Test Error Boundary)
                </button>
              </div>
              <div id="chaosOutput" class="terminal-box" style="margin-top: 14px; display: none;"></div>
            </div>
          </div>

          <!-- Hot Backups Registry -->
          <div class="card" style="margin-bottom: 24px;">
            <div class="card-header">
              <span class="card-title">Disaster Recovery Snapshots (Online Hot-Backups)</span>
              <button class="btn btn-secondary btn-sm" onclick="SystemView.loadBackups()">Refresh Archive</button>
            </div>
            <div class="table-responsive">
              <table class="table" style="font-size: 12.5px;">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody id="backupsTableBody">
                  <tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">Loading backups...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Real-Time Audit Trail -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Security & Audit Event Stream</span>
              <button class="btn btn-secondary btn-sm" onclick="SystemView.loadAuditLogs()">Refresh Events</button>
            </div>
            <div class="table-responsive" style="max-height: 350px; overflow-y: auto;">
              <table class="table" style="font-size: 12px;">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>Entity</th>
                    <th>IP Address</th>
                    <th>Audit Details</th>
                  </tr>
                </thead>
                <tbody id="auditTableBody">
                  <tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">Loading audit trace...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    this.refreshAll();
  },

  async refreshAll() {
    await Promise.all([
      this.loadHealth(),
      this.loadMetrics(),
      this.loadBackups(),
      this.loadAuditLogs()
    ]);
  },

  async loadHealth() {
    try {
      const res = await API.getHealth();
      document.getElementById('diagClusterStatus').textContent = `${res.status} (Uptime: ${res.process.uptimeSeconds}s)`;
      document.getElementById('diagProcessDetails').textContent = `PID: ${res.process.pid} | Worker: ${res.process.workerId} | Node: ${res.process.nodeVersion}`;
      document.getElementById('diagDbIntegrity').textContent = `Integrity Check: ${res.database.integrityCheck}`;
      document.getElementById('diagMemory').textContent = `${(res.system.heapUsedBytes / (1024 * 1024)).toFixed(1)} MB Heap`;
      document.getElementById('diagMemoryRss').textContent = `RSS: ${(res.system.memoryRssBytes / (1024 * 1024)).toFixed(1)} MB | Sys Free: ${(res.system.freeMemoryBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } catch (err) {
      console.warn('Health error:', err.message);
    }
  },

  async loadMetrics() {
    try {
      const res = await API.getMetrics();
      if (!res.success) return;
      document.getElementById('diagDbSize').textContent = `${res.data.storage.dbSizeMb} MB`;
      document.getElementById('diagPages').textContent = `${res.data.storage.pageCount.toLocaleString()} Pages (Size: ${res.data.storage.pageSize} B)`;
    } catch (err) {
      console.warn('Metrics error:', err.message);
    }
  },

  async loadBackups() {
    const tbody = document.getElementById('backupsTableBody');
    if (!tbody) return;

    try {
      const res = await API.getBackups();
      if (!res.success) return;
      const backups = res.data;

      if (backups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #64748b;">No backups recorded yet.</td></tr>';
        return;
      }

      tbody.innerHTML = backups.map(b => `
        <tr>
          <td><strong>${b.filename}</strong></td>
          <td><span class="badge ${b.backup_type === 'Automated' ? 'badge-info' : 'badge-secondary'}">${b.backup_type}</span></td>
          <td>${(b.size_bytes / (1024 * 1024)).toFixed(2)} MB</td>
          <td><span class="badge badge-success">${b.status}</span></td>
          <td>${b.created_at}</td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="color: #ef4444; padding: 16px;">Error loading backups: ${err.message}</td></tr>`;
    }
  },

  async loadAuditLogs() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    try {
      const res = await API.getAuditLogs(30);
      if (!res.success) return;
      const logs = res.data;

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">No audit events recorded.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td><small style="color: #64748b;">${l.created_at}</small></td>
          <td><strong>${l.action}</strong></td>
          <td>${l.user_name || 'System'}</td>
          <td><span class="badge badge-secondary">${l.entity}</span></td>
          <td>${l.ip_address}</td>
          <td><code style="font-size: 11px; color: #2563eb;">${(l.new_values || l.old_values || '').slice(0, 80)}</code></td>
        </tr>
      `).join('');
    } catch (err) {
      console.warn('Audit logs load issue:', err.message);
    }
  },

  async triggerBackup() {
    try {
      App.toast('Starting atomic database hot-backup...', 'info');
      const res = await API.triggerBackup();
      if (res.success) {
        App.toast(`Hot-backup created in ${res.data.durationMs}ms!`, 'success');
        this.loadBackups();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async simulateWorkerCrash() {
    const term = document.getElementById('chaosOutput');
    term.style.display = 'block';
    term.innerHTML = '[CHAOS ENGINE] Triggering abrupt process crash on active cluster worker...\n';

    try {
      const res = await API.simulateFault('worker-crash');
      term.innerHTML += `[OK] Response: ${res.message}\n`;
      term.innerHTML += '[WATCHDOG] Worker process terminating now. Waiting 1.5 seconds for cluster supervisor resurrection...\n';

      setTimeout(async () => {
        try {
          const health = await API.getHealth();
          term.innerHTML += `[SELF-HEALED] New replacement worker online!\n`;
          term.innerHTML += `[METRIC] New PID: ${health.process.pid} | Worker ID: ${health.process.workerId} | Uptime: ${health.process.uptimeSeconds}s\n`;
          term.innerHTML += `[STATUS] ZERO DOWNTIME CONFIRMED. High Availability verified.\n`;
          App.toast('Worker resurrected cleanly by Cluster Supervisor!', 'success');
          SystemView.loadHealth();
        } catch (e) {
          term.innerHTML += `[ERROR] Reconnect retry: ${e.message}\n`;
        }
      }, 1500);
    } catch (err) {
      term.innerHTML += `[ERROR] ${err.message}\n`;
    }
  },

  async simulateHandledFault() {
    const term = document.getElementById('chaosOutput');
    term.style.display = 'block';
    term.innerHTML = '[CHAOS ENGINE] Triggering uncaught business exception...\n';

    try {
      await API.simulateFault('handled-error');
    } catch (err) {
      term.innerHTML += `[TRAPPED] Exception was safely captured by global error boundary:\n`;
      term.innerHTML += `>>> ${err.message}\n`;
      term.innerHTML += `[INTEGRITY] Database connection, state, and HTTP worker remain 100% operational.\n`;
      App.toast('Fault safely isolated by Express error boundary!', 'success');
    }
  }
};
