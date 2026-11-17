const PortalView = {
  profileData: null,

  async render() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div id="portalContainer">
        <p style="color: #64748b; padding: 24px;">Loading learner portal...</p>
      </div>
    `;

    await this.loadPortalData();
  },

  async loadPortalData() {
    try {
      const res = await API.getMe();
      if (!res.success) return;
      this.profileData = res;

      const container = document.getElementById('portalContainer');
      const user = res.user;
      const profile = res.profile;

      // Determine target student ID
      let targetStudent = null;
      if (user.role === 'student' && profile) {
        targetStudent = profile;
      } else if (user.role === 'parent' && profile?.wards?.length > 0) {
        targetStudent = profile.wards[0]; // first ward
      }

      if (!targetStudent) {
        // Fallback for admin or staff previewing portal: load first demo student (Lucas Vance)
        const demoRes = await API.getStudents({ limit: 1 });
        if (demoRes.data && demoRes.data.length > 0) {
          targetStudent = demoRes.data[0];
        }
      }

      if (!targetStudent) {
        container.innerHTML = '<div class="card"><div class="card-body">No student profile linked.</div></div>';
        return;
      }

      // Fetch student details, attendance, and exams
      const [studentDetailsRes, attRes, invRes] = await Promise.all([
        API.getStudent(targetStudent.id),
        API.getStudentAttendance(targetStudent.id),
        API.getInvoices({ student_id: targetStudent.id })
      ]);

      const s = studentDetailsRes.data;
      const att = attRes.data;
      const invoices = invRes.data || [];

      container.innerHTML = `
        <!-- Welcome Hero -->
        <div class="card" style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); color: #ffffff; border: none; margin-bottom: 24px;">
          <div class="card-body" style="padding: 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: gap: 20px;">
            <div>
              <span class="badge" style="background: rgba(255,255,255,0.2); color: #fff; margin-bottom: 10px;">
                ${user.role === 'parent' ? '👨‍👩‍👧 Parent Access Portal' : '🎓 Student Learning Workspace'}
              </span>
              <h2 style="font-size: 26px; color: #ffffff; margin-bottom: 6px;">Welcome, ${s.first_name} ${s.last_name}!</h2>
              <p style="color: #bfdbfe; font-size: 14px;">Admission: <strong>${s.admission_number}</strong> • Class: <strong>${s.class_name} (${s.class_section})</strong></p>
            </div>
            <div style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 16px 24px; border-radius: 12px; text-align: center;">
              <span style="font-size: 12px; text-transform: uppercase; color: #93c5fd; font-weight: 700;">Overall Attendance</span>
              <h1 style="font-size: 36px; color: #ffffff; margin-top: 2px;">${att.stats.rate}%</h1>
              <small style="color: #6ee7b7;">${att.stats.present} Present / ${att.stats.total} Days</small>
            </div>
          </div>
        </div>

        <!-- Academic & Financial Summary Grid -->
        <div class="grid-2">
          <div>
            <!-- Academic Performance & Report Cards -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">📊 Term Assessment Results</span>
                <button class="btn btn-primary btn-sm" onclick="ExamsView.viewReportCard('${s.id}', 'ex_mid_2026')">
                  🖨️ View Official Report Card
                </button>
              </div>
              <div class="table-responsive">
                <table class="table" style="font-size: 13px;">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Score</th>
                      <th>Grade</th>
                      <th>Instructor Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${s.recentExams.map(ex => `
                      <tr>
                        <td><strong>${ex.subject_name}</strong></td>
                        <td>${ex.marks_obtained} / ${ex.max_marks}</td>
                        <td><span class="badge ${ex.grade.startsWith('A') ? 'badge-success' : 'badge-info'}">${ex.grade}</span></td>
                        <td>${ex.remarks || 'Pass'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Attendance History Calendar -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">📅 Daily Attendance Log</span>
                <span class="badge badge-success">${att.stats.rate}% Satisfactory</span>
              </div>
              <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                <table class="table" style="font-size: 12.5px;">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Faculty Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${att.records.map(r => `
                      <tr>
                        <td>${r.date}</td>
                        <td>
                          <span class="badge ${r.status === 'Present' ? 'badge-success' : (r.status === 'Late' ? 'badge-warning' : 'badge-danger')}">
                            ${r.status}
                          </span>
                        </td>
                        <td>${r.remarks || 'On time'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <!-- Financial Fee Invoices -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">💳 Tuition & Billing Status</span>
              </div>
              <div class="card-body">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #64748b; font-size: 12.5px;">Total Billed:</span>
                    <strong>$${s.financials.totalInvoiced.toLocaleString()}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                    <span style="color: #64748b; font-size: 12.5px;">Paid to Date:</span>
                    <strong style="color: #10b981;">$${s.financials.totalPaid.toLocaleString()}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                    <span style="font-size: 13.5px; font-weight: 700;">Remaining Balance:</span>
                    <strong style="font-size: 15px; color: ${s.financials.balanceDue > 0 ? '#ef4444' : '#10b981'};">$${s.financials.balanceDue.toLocaleString()}</strong>
                  </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                  ${invoices.map(inv => `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong>${inv.category_name}</strong>
                        <div style="font-size: 11px; color: #64748b;">${inv.invoice_number} • Due: ${inv.due_date}</div>
                        <div style="font-size: 12px; margin-top: 2px;">$${inv.amount.toLocaleString()} <span class="badge ${inv.status === 'Paid' ? 'badge-success' : 'badge-warning'}">${inv.status}</span></div>
                      </div>
                      ${inv.balance_due > 0 ? `
                        <button class="btn btn-primary btn-sm" onclick="FeesView.showPaymentModal('${inv.id}', ${inv.balance_due}, '${inv.invoice_number}')">Pay Now</button>
                      ` : `
                        <span style="color: #10b981; font-weight: 700; font-size: 12px;">Paid ✓</span>
                      `}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Campus Support -->
            <div class="card">
              <div class="card-header">
                <span class="card-title">ℹ️ Academic Advisory & Support</span>
              </div>
              <div class="card-body" style="font-size: 13px; color: #475569;">
                <p>Have inquiries regarding schedules, extracurriculars, or transport routes? Contact our academic coordination desk:</p>
                <div style="margin-top: 10px; line-height: 1.6;">
                  <strong>Head Teacher:</strong> Dr. Sarah Jenkins<br>
                  <strong>Office Hours:</strong> Mon-Fri 8:00 AM - 4:30 PM<br>
                  <strong>Direct Line:</strong> +1 (555) 010-0002
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }
};
