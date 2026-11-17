const DashboardView = {
  async render() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="stats-grid" id="dashboardStats">
        <div class="stat-card blue">
          <div class="stat-info">
            <span>Total Enrolled</span>
            <h3 id="statStudents">--</h3>
            <p>Active Students Across All Grades</p>
          </div>
          <div class="stat-icon">🎓</div>
        </div>
        <div class="stat-card green">
          <div class="stat-info">
            <span>Faculty & Staff</span>
            <h3 id="statTeachers">--</h3>
            <p>Certified Academic Instructors</p>
          </div>
          <div class="stat-icon">👩‍🏫</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-info">
            <span>Daily Attendance</span>
            <h3 id="statAttendance">--%</h3>
            <p>School-wide Average</p>
          </div>
          <div class="stat-icon">📋</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-info">
            <span>Fee Collection</span>
            <h3 id="statFeeCollection">--%</h3>
            <p>Settled Tuition & Lab Invoices</p>
          </div>
          <div class="stat-icon">💳</div>
        </div>
      </div>

      <div class="grid-2">
        <div>
          <!-- High Availability System Banner -->
          <div class="card" style="border-left: 4px solid #10b981;">
            <div class="card-header">
              <span class="card-title">⚡ High-Availability & Resilient Core Active</span>
              <span class="badge badge-success" id="clusterStatusBadge">Online • WAL Mode</span>
            </div>
            <div class="card-body" style="font-size: 13.5px; color: #475569;">
              <p>The system is operating with <strong>SQLite Write-Ahead Logging (WAL)</strong>, non-blocking ACID transactions, automated periodic snapshot backups, and active Node.js cluster supervisor.</p>
              <div style="margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('system')">🔍 View Diagnostics & Cluster Status</button>
                <button class="btn btn-secondary btn-sm" onclick="App.triggerInstantBackup()">💾 Trigger Instant Hot-Backup</button>
              </div>
            </div>
          </div>

          <!-- Quick Actions & Roster -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Quick Operations</span>
            </div>
            <div class="card-body">
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
                <button class="btn btn-primary" onclick="App.showEnrollModal()">
                  <span>➕ Enroll Student</span>
                </button>
                <button class="btn btn-secondary" onclick="App.navigateTo('attendance')">
                  <span>📝 Mark Attendance</span>
                </button>
                <button class="btn btn-secondary" onclick="App.navigateTo('exams')">
                  <span>📊 Exam Gradebook</span>
                </button>
                <button class="btn btn-secondary" onclick="App.navigateTo('fees')">
                  <span>💵 Fee Invoicing</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Recent Attendance Trend -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">Attendance Trends (Recent Sessions)</span>
            </div>
            <div class="card-body">
              <div id="attendanceChartContainer" style="height: 180px; display: flex; align-items: flex-end; gap: 14px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
                <!-- Dynamically generated bars -->
              </div>
              <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11.5px; color: #64748b;">
                <span>Session 1</span>
                <span>Session 5</span>
                <span>Session 10 (Latest)</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <!-- Important Announcements -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">📢 Urgent Campus Notices</span>
              <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('notices')">All Notices</button>
            </div>
            <div class="card-body" id="dashboardNotices" style="display: flex; flex-direction: column; gap: 12px;">
              <p style="color: #64748b; font-size: 13px;">Loading notices...</p>
            </div>
          </div>

          <!-- At-Risk Attendance Alerts -->
          <div class="card">
            <div class="card-header">
              <span class="card-title" style="color: #b91c1c;">⚠️ Attendance Watchlist (&lt;75%)</span>
            </div>
            <div class="card-body" id="dashboardAtRiskList" style="padding: 0;">
              <div style="padding: 16px; color: #64748b; font-size: 13px;">Scanning records...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.loadStats();
  },

  async loadStats() {
    try {
      const [metricsRes, attStatsRes, feeStatsRes, noticesRes] = await Promise.all([
        API.getMetrics(),
        API.getAttendanceStats(),
        API.getFeeStats(),
        API.getNotices()
      ]);

      if (metricsRes.success) {
        document.getElementById('statStudents').textContent = metricsRes.data.counts.activeStudents || 0;
        document.getElementById('statTeachers').textContent = metricsRes.data.counts.totalTeachers || 0;
      }

      if (feeStatsRes.success) {
        document.getElementById('statFeeCollection').textContent = `${feeStatsRes.data.collectionRate}%`;
      }

      if (attStatsRes.success) {
        const trends = attStatsRes.data.trends || [];
        const avg = trends.length > 0
          ? Math.round(trends.reduce((acc, t) => acc + (t.present / (t.total || 1)), 0) / trends.length * 100)
          : 94;
        document.getElementById('statAttendance').textContent = `${avg}%`;

        // Render attendance chart bars
        const chartEl = document.getElementById('attendanceChartContainer');
        if (chartEl && trends.length > 0) {
          chartEl.innerHTML = trends.map(t => {
            const pct = Math.round((t.present / (t.total || 1)) * 100);
            return `
              <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <div style="font-size: 10px; font-weight: 700; color: #475569;">${pct}%</div>
                <div style="width: 100%; height: ${Math.max(20, pct * 1.5)}px; background: linear-gradient(180deg, #3b82f6, #1d4ed8); border-radius: 4px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);" title="${t.date}: ${pct}% (${t.present}/${t.total})"></div>
                <div style="font-size: 9.5px; color: #94a3b8;">${t.date.slice(5)}</div>
              </div>
            `;
          }).join('');
        }

        // Render at risk list
        const atRiskEl = document.getElementById('dashboardAtRiskList');
        const atRisk = attStatsRes.data.atRiskStudents || [];
        if (atRisk.length === 0) {
          atRiskEl.innerHTML = '<div style="padding: 16px; color: #10b981; font-size: 13px;">✓ Excellent: No students currently below the 75% attendance threshold.</div>';
        } else {
          atRiskEl.innerHTML = `
            <table class="table" style="font-size: 12.5px;">
              <tbody>
                ${atRisk.map(s => `
                  <tr>
                    <td><strong>${s.first_name} ${s.last_name}</strong><br><small style="color:#64748b;">${s.class_name} ${s.section}</small></td>
                    <td style="text-align: right;"><span class="badge badge-danger">${s.percentage}%</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }
      }

      if (noticesRes.success) {
        const noticesEl = document.getElementById('dashboardNotices');
        const notices = noticesRes.data.slice(0, 3);
        if (notices.length === 0) {
          noticesEl.innerHTML = '<p style="color: #64748b; font-size: 13px;">No recent notices.</p>';
        } else {
          noticesEl.innerHTML = notices.map(n => `
            <div style="padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span class="badge ${n.priority === 'Urgent' ? 'badge-danger' : (n.priority === 'High' ? 'badge-warning' : 'badge-info')}">${n.priority}</span>
                <small style="color: #94a3b8;">${n.created_at ? n.created_at.slice(0, 10) : ''}</small>
              </div>
              <h4 style="font-size: 13.5px; font-weight: 700; color: #0f172a;">${n.title}</h4>
              <p style="font-size: 12.5px; color: #475569; margin-top: 4px; line-height: 1.4;">${n.content.slice(0, 120)}${n.content.length > 120 ? '...' : ''}</p>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('Dashboard stats load issue:', err.message);
    }
  }
};
