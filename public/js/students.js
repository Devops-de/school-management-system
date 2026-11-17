const StudentsView = {
  studentsList: [],
  classesList: [],

  async render() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Student Information System (SIS)</h3>
            <p style="font-size: 12.5px; color: #64748b; margin-top: 2px;">Comprehensive learner profiles, enrollment, attendance records, and academics</p>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-primary" onclick="App.showEnrollModal()">
              <span>➕ Enroll New Student</span>
            </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div style="padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid var(--border); display: flex; gap: 14px; flex-wrap: wrap; align-items: center;">
          <input type="text" id="studentSearchInput" class="form-control" placeholder="Search by name or admission #..." style="max-width: 280px;" oninput="StudentsView.applyFilters()">
          <select id="studentClassFilter" class="form-control" style="max-width: 200px;" onchange="StudentsView.applyFilters()">
            <option value="">All Classes & Sections</option>
          </select>
          <select id="studentStatusFilter" class="form-control" style="max-width: 160px;" onchange="StudentsView.applyFilters()">
            <option value="">All Statuses</option>
            <option value="Active" selected>Active Only</option>
            <option value="Withdrawn">Withdrawn</option>
            <option value="Graduated">Graduated</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="StudentsView.loadData()">🔄 Refresh</button>
        </div>

        <div class="table-responsive">
          <table class="table" id="studentsTable">
            <thead>
              <tr>
                <th>Admission #</th>
                <th>Student Name</th>
                <th>Class & Section</th>
                <th>Gender / Blood Group</th>
                <th>Emergency / Parent</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="studentsTableBody">
              <tr><td colspan="7" style="text-align: center; padding: 24px;">Loading student records...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const [studentsRes, classesRes] = await Promise.all([
        API.getStudents({ limit: 100 }),
        API.getClasses()
      ]);

      if (classesRes.success) {
        this.classesList = classesRes.data;
        const classFilter = document.getElementById('studentClassFilter');
        if (classFilter) {
          classFilter.innerHTML = '<option value="">All Classes & Sections</option>' +
            this.classesList.map(c => `<option value="${c.id}">${c.name} - ${c.section}</option>`).join('');
        }
      }

      if (studentsRes.success) {
        this.studentsList = studentsRes.data;
        this.applyFilters();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  applyFilters() {
    const search = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();
    const classId = document.getElementById('studentClassFilter')?.value || '';
    const status = document.getElementById('studentStatusFilter')?.value || '';

    const filtered = this.studentsList.filter(s => {
      const matchSearch = !search ||
        s.first_name.toLowerCase().includes(search) ||
        s.last_name.toLowerCase().includes(search) ||
        s.admission_number.toLowerCase().includes(search);
      const matchClass = !classId || s.class_id === classId;
      const matchStatus = !status || s.status === status;
      return matchSearch && matchClass && matchStatus;
    });

    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">No matching student records found.</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(s => `
      <tr>
        <td><strong>${s.admission_number}</strong></td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${s.first_name} ${s.last_name}</div>
          <small style="color: #64748b;">DOB: ${s.date_of_birth}</small>
        </td>
        <td>
          <span class="badge badge-secondary">${s.class_name || 'Unassigned'} ${s.class_section || ''}</span>
        </td>
        <td>
          ${s.gender} ${s.blood_group ? `<span class="badge badge-info" style="margin-left: 4px;">${s.blood_group}</span>` : ''}
        </td>
        <td>
          <div>${s.parent_name || s.emergency_contact || 'N/A'}</div>
          ${s.parent_phone ? `<small style="color: #64748b;">${s.parent_phone}</small>` : ''}
        </td>
        <td>
          <span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${s.status}</span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="StudentsView.viewProfile('${s.id}')">Profile & Grades</button>
        </td>
      </tr>
    `).join('');
  },

  async viewProfile(studentId) {
    try {
      const res = await API.getStudent(studentId);
      if (!res.success) return;
      const s = res.data;

      const modalHtml = `
        <div class="modal-backdrop open" id="profileModal" onclick="if(event.target===this) this.remove()">
          <div class="modal-dialog modal-lg">
            <div class="modal-header">
              <h3 class="modal-title">Student Dossier: ${s.first_name} ${s.last_name} (${s.admission_number})</h3>
              <button class="modal-close" onclick="document.getElementById('profileModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px; margin-bottom: 20px;">
                <div style="background: #f8fafc; padding: 18px; border-radius: 10px; border: 1px solid #e2e8f0; text-align: center;">
                  <div style="width: 72px; height: 72px; border-radius: 50%; background: #2563eb; color: #fff; font-size: 28px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
                    ${s.first_name[0]}${s.last_name[0]}
                  </div>
                  <h4>${s.first_name} ${s.last_name}</h4>
                  <p style="font-size: 12.5px; color: #64748b;">${s.class_name} • Section ${s.class_section}</p>
                  <div style="margin-top: 12px; display: inline-block;">
                    <span class="badge ${s.status === 'Active' ? 'badge-success' : 'badge-danger'}">${s.status}</span>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                  <div><strong>Date of Birth:</strong> ${s.date_of_birth}</div>
                  <div><strong>Gender:</strong> ${s.gender}</div>
                  <div><strong>Blood Group:</strong> ${s.blood_group || 'N/A'}</div>
                  <div><strong>Enrollment Date:</strong> ${s.enrollment_date}</div>
                  <div><strong>Parent / Guardian:</strong> ${s.parent_name || 'N/A'}</div>
                  <div><strong>Contact Phone:</strong> ${s.parent_phone || s.emergency_contact || 'N/A'}</div>
                  <div><strong>Medical Alerts:</strong> <span style="color: #b91c1c;">${s.medical_notes || 'None noted'}</span></div>
                  <div><strong>Address:</strong> ${s.address || 'N/A'}</div>
                </div>
              </div>

              <!-- Metrics Row -->
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px;">
                <div style="background: #eff6ff; padding: 14px; border-radius: 8px; border: 1px solid #bfdbfe;">
                  <span style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Attendance Rate</span>
                  <h3 style="font-size: 24px; color: #1e3a8a; margin-top: 4px;">${s.attendance.rate}%</h3>
                  <small style="color: #3b82f6;">${s.attendance.present} of ${s.attendance.total} sessions present</small>
                </div>
                <div style="background: #ecfdf5; padding: 14px; border-radius: 8px; border: 1px solid #a7f3d0;">
                  <span style="font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase;">Financial Settlement</span>
                  <h3 style="font-size: 24px; color: #065f46; margin-top: 4px;">$${s.financials.totalPaid}</h3>
                  <small style="color: #059669;">Balance Due: $${s.financials.balanceDue}</small>
                </div>
                <div style="background: #fdf2f8; padding: 14px; border-radius: 8px; border: 1px solid #fbcfe8;">
                  <span style="font-size: 11px; font-weight: 700; color: #9d174d; text-transform: uppercase;">Academic Transcript</span>
                  <h3 style="font-size: 24px; color: #9d174d; margin-top: 4px;">${s.recentExams.length} Subjects</h3>
                  <small style="color: #db2777;">Assessment Results Recorded</small>
                </div>
              </div>

              <!-- Recent Marks Table -->
              <h4 style="font-size: 14px; margin-bottom: 8px;">Recent Exam Marks</h4>
              <div class="table-responsive">
                <table class="table" style="font-size: 12.5px;">
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Subject</th>
                      <th>Score</th>
                      <th>Grade</th>
                      <th>Faculty Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${s.recentExams.length > 0 ? s.recentExams.map(e => `
                      <tr>
                        <td>${e.exam_name}</td>
                        <td>${e.subject_name} (${e.subject_code})</td>
                        <td><strong>${e.marks_obtained} / ${e.max_marks}</strong></td>
                        <td><span class="badge ${e.grade.startsWith('A') ? 'badge-success' : 'badge-info'}">${e.grade}</span></td>
                        <td>${e.remarks || 'Pass'}</td>
                      </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align: center; color: #64748b;">No exam marks recorded yet.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('profileModal').remove()">Close</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }
};
