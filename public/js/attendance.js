const AttendanceView = {
  classesList: [],
  currentRecords: [],

  async render() {
    const today = new Date().toISOString().split('T')[0];
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Daily Attendance Terminal</h3>
            <p style="font-size: 12.5px; color: #64748b; margin-top: 2px;">Mark student attendance with atomic commit, track rates, and alert on absenteeism</p>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="AttendanceView.markAll('Present')">✅ Mark All Present</button>
            <button class="btn btn-primary" onclick="AttendanceView.saveAttendance()">💾 Save & Commit Attendance</button>
          </div>
        </div>

        <!-- Selector Controls -->
        <div style="padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid var(--border); display: flex; gap: 14px; flex-wrap: wrap; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <label class="form-label" style="margin: 0;">Class:</label>
            <select id="attClassSelect" class="form-control" style="width: 220px;" onchange="AttendanceView.loadAttendanceSheet()"></select>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label class="form-label" style="margin: 0;">Date:</label>
            <input type="date" id="attDateInput" class="form-control" style="width: 170px;" value="${today}" onchange="AttendanceView.loadAttendanceSheet()">
          </div>
          <button class="btn btn-secondary btn-sm" onclick="AttendanceView.loadAttendanceSheet()">Load Sheet</button>
        </div>

        <div class="card-body">
          <div id="attendanceContainer">
            <p style="color: #64748b; text-align: center; padding: 24px;">Select a class to open the attendance register.</p>
          </div>
        </div>
      </div>
    `;

    await this.initSelectors();
  },

  async initSelectors() {
    try {
      const res = await API.getClasses();
      if (!res.success) return;
      this.classesList = res.data;

      const sel = document.getElementById('attClassSelect');
      if (!sel) return;

      sel.innerHTML = this.classesList.map(c => `<option value="${c.id}">${c.name} - Section ${c.section}</option>`).join('');

      if (this.classesList.length > 0) {
        this.loadAttendanceSheet();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async loadAttendanceSheet() {
    const classId = document.getElementById('attClassSelect')?.value;
    const date = document.getElementById('attDateInput')?.value;
    if (!classId || !date) return;

    const container = document.getElementById('attendanceContainer');
    container.innerHTML = '<p style="text-align: center; padding: 20px; color: #64748b;">Loading attendance records...</p>';

    try {
      const res = await API.getAttendance(classId, date);
      if (!res.success) return;

      this.currentRecords = res.data;

      if (this.currentRecords.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: #64748b;">No active students enrolled in this class.</div>';
        return;
      }

      container.innerHTML = `
        <div class="attendance-grid">
          ${this.currentRecords.map((r, idx) => {
            const status = r.status || 'Present';
            return `
              <div class="attendance-row" data-student-id="${r.student_id}">
                <div>
                  <div style="font-weight: 700; color: #0f172a;">${r.first_name} ${r.last_name}</div>
                  <small style="color: #64748b;">Adm #: ${r.admission_number} • ${r.gender}</small>
                </div>

                <div style="display: flex; align-items: center; gap: 16px;">
                  <input type="text" class="form-control att-remarks" placeholder="Optional notes/remarks" value="${r.remarks || ''}" style="width: 200px; font-size: 12px; padding: 5px 8px;">

                  <div class="status-radio-group">
                    <label>
                      <input type="radio" class="status-radio" name="att_${r.student_id}" value="Present" ${status === 'Present' ? 'checked' : ''}>
                      <span class="status-label-btn p">Present</span>
                    </label>
                    <label>
                      <input type="radio" class="status-radio" name="att_${r.student_id}" value="Absent" ${status === 'Absent' ? 'checked' : ''}>
                      <span class="status-label-btn a">Absent</span>
                    </label>
                    <label>
                      <input type="radio" class="status-radio" name="att_${r.student_id}" value="Late" ${status === 'Late' ? 'checked' : ''}>
                      <span class="status-label-btn l">Late</span>
                    </label>
                    <label>
                      <input type="radio" class="status-radio" name="att_${r.student_id}" value="Excused" ${status === 'Excused' ? 'checked' : ''}>
                      <span class="status-label-btn e">Excused</span>
                    </label>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  markAll(status) {
    const radios = document.querySelectorAll(`.attendance-row input[value="${status}"]`);
    radios.forEach(r => r.checked = true);
    App.toast(`Set all to ${status}`, 'info');
  },

  async saveAttendance() {
    const classId = document.getElementById('attClassSelect')?.value;
    const date = document.getElementById('attDateInput')?.value;
    if (!classId || !date) return;

    const rows = document.querySelectorAll('.attendance-row');
    const records = [];

    rows.forEach(row => {
      const studentId = row.getAttribute('data-student-id');
      const selectedRadio = row.querySelector('input[type="radio"]:checked');
      const remarksInput = row.querySelector('.att-remarks');

      if (studentId && selectedRadio) {
        records.push({
          student_id: studentId,
          status: selectedRadio.value,
          remarks: remarksInput ? remarksInput.value.trim() : null
        });
      }
    });

    if (records.length === 0) {
      App.toast('No student records to save.', 'warning');
      return;
    }

    try {
      const res = await API.submitAttendance(classId, date, records);
      if (res.success) {
        App.toast(res.message, 'success');
        this.loadAttendanceSheet();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }
};
