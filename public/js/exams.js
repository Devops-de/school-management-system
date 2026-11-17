const ExamsView = {
  examsList: [],
  currentExam: null,

  async render() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Examinations & Academic Assessment</h3>
            <p style="font-size: 12.5px; color: #64748b; margin-top: 2px;">Manage assessment schedules, gradebook marks entry, GPA calculations, and official report cards</p>
          </div>
          <button class="btn btn-primary" onclick="ExamsView.showCreateExamModal()">
            <span>➕ Create Exam Term</span>
          </button>
        </div>

        <div class="card-body">
          <div style="margin-bottom: 20px; display: flex; gap: 12px; align-items: center;">
            <label class="form-label" style="margin: 0;">Select Assessment Term:</label>
            <select id="examTermSelect" class="form-control" style="max-width: 320px;" onchange="ExamsView.onExamSelected()"></select>
          </div>

          <div id="examSchedulesContainer">
            <p style="color: #64748b;">Loading assessment schedules...</p>
          </div>
        </div>
      </div>
    `;

    await this.loadExams();
  },

  async loadExams() {
    try {
      const res = await API.getExams();
      if (!res.success) return;
      this.examsList = res.data;

      const sel = document.getElementById('examTermSelect');
      if (!sel) return;

      if (this.examsList.length === 0) {
        sel.innerHTML = '<option value="">No exam terms created</option>';
        document.getElementById('examSchedulesContainer').innerHTML = '<p style="color:#64748b;">No exams available. Create an exam term above.</p>';
        return;
      }

      sel.innerHTML = this.examsList.map(e => `
        <option value="${e.id}">${e.name} (${e.term} - ${e.academic_year}) [${e.status}]</option>
      `).join('');

      this.onExamSelected();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async onExamSelected() {
    const examId = document.getElementById('examTermSelect')?.value;
    if (!examId) return;

    this.currentExam = this.examsList.find(e => e.id === examId);
    const container = document.getElementById('examSchedulesContainer');
    container.innerHTML = '<p style="color: #64748b;">Loading papers and schedules...</p>';

    try {
      const res = await API.getExamSchedules(examId);
      if (!res.success) return;

      const schedules = res.data;
      if (schedules.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 30px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <p style="color: #64748b; margin-bottom: 12px;">No subject exam papers scheduled yet for this term.</p>
            <button class="btn btn-secondary btn-sm" onclick="ExamsView.showScheduleModal('${examId}')">➕ Schedule a Subject Paper</button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4 style="font-size: 15px; color: #1e293b;">Scheduled Papers (${schedules.length})</h4>
          <button class="btn btn-secondary btn-sm" onclick="ExamsView.showScheduleModal('${examId}')">➕ Add Subject Paper</button>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Subject Paper</th>
                <th>Exam Date & Time</th>
                <th>Marks Scale</th>
                <th>Grading Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${schedules.map(s => `
                <tr>
                  <td><strong>${s.class_name} ${s.section}</strong></td>
                  <td><strong>${s.subject_name}</strong> <small style="color: #64748b;">(${s.subject_code})</small></td>
                  <td>${s.exam_date} <br><small style="color: #64748b;">${s.start_time} - ${s.end_time}</small></td>
                  <td>Max: ${s.max_marks} | Pass: ${s.pass_marks}</td>
                  <td>
                    <span class="badge ${s.graded_count >= s.total_students ? 'badge-success' : 'badge-warning'}">
                      ${s.graded_count} / ${s.total_students} Graded
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-primary btn-sm" onclick="ExamsView.openGradebook('${s.id}')">Enter Marks</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async openGradebook(scheduleId) {
    try {
      const res = await API.getScheduleMarks(scheduleId);
      if (!res.success) return;
      const { schedule, marks } = res;

      const modalHtml = `
        <div class="modal-backdrop open" id="gradebookModal" onclick="if(event.target===this) this.remove()">
          <div class="modal-dialog modal-lg">
            <div class="modal-header">
              <div>
                <h3 class="modal-title">Gradebook: ${schedule.subject_name} - ${schedule.class_name} ${schedule.section}</h3>
                <small style="color: #64748b;">Max Score: ${schedule.max_marks} marks | Pass: ${schedule.pass_marks} marks</small>
              </div>
              <button class="modal-close" onclick="document.getElementById('gradebookModal').remove()">&times;</button>
            </div>
            <form onsubmit="ExamsView.submitGradebook(event, '${scheduleId}')">
              <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Adm #</th>
                      <th>Student</th>
                      <th style="width: 140px;">Marks Obtained</th>
                      <th>Grade Preview</th>
                      <th>Report Card</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${marks.map(m => `
                      <tr class="grade-row" data-student-id="${m.student_id}">
                        <td>${m.admission_number}</td>
                        <td><strong>${m.first_name} ${m.last_name}</strong></td>
                        <td>
                          <input type="number" step="0.5" min="0" max="${schedule.max_marks}" class="form-control marks-input" value="${m.marks_obtained !== null && m.marks_obtained !== undefined ? m.marks_obtained : ''}" required style="padding: 5px 8px; font-weight: 700;">
                        </td>
                        <td>
                          <span class="badge ${m.grade ? (m.grade.startsWith('A') ? 'badge-success' : 'badge-info') : 'badge-secondary'} grade-badge">
                            ${m.grade || '--'}
                          </span>
                        </td>
                        <td>
                          <button type="button" class="btn btn-secondary btn-sm" onclick="ExamsView.viewReportCard('${m.student_id}', '${schedule.exam_id}')">
                            🖨️ Report Card
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('gradebookModal').remove()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save & Calculate All Grades</button>
              </div>
            </form>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async submitGradebook(e, scheduleId) {
    e.preventDefault();
    const rows = document.querySelectorAll('.grade-row');
    const results = [];

    rows.forEach(r => {
      const studentId = r.getAttribute('data-student-id');
      const input = r.querySelector('.marks-input');
      if (studentId && input && input.value !== '') {
        results.push({
          student_id: studentId,
          marks_obtained: parseFloat(input.value)
        });
      }
    });

    try {
      const res = await API.submitMarks(scheduleId, results);
      if (res.success) {
        App.toast(res.message, 'success');
        document.getElementById('gradebookModal')?.remove();
        this.onExamSelected();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async viewReportCard(studentId, examId) {
    try {
      const res = await API.getReportCard(studentId, examId);
      if (!res.success) return;
      const d = res.data;

      const modalHtml = `
        <div class="modal-backdrop open" id="reportCardModal" onclick="if(event.target===this) this.remove()">
          <div class="modal-dialog modal-lg">
            <div class="modal-header">
              <h3 class="modal-title">Official Academic Transcript & Report Card</h3>
              <button class="modal-close" onclick="document.getElementById('reportCardModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <div class="report-card-container" id="printableReportCard">
                <div class="report-header">
                  <h1>${d.school.name}</h1>
                  <p><em>${d.school.motto} • ${d.school.accreditation}</em></p>
                  <h3 style="margin-top: 10px; font-size: 17px; text-decoration: underline;">${d.exam.name} (${d.exam.term})</h3>
                </div>

                <div class="report-meta-grid">
                  <div><strong>Student Name:</strong> ${d.student.first_name} ${d.student.last_name}</div>
                  <div><strong>Admission Number:</strong> ${d.student.admission_number}</div>
                  <div><strong>Class & Section:</strong> ${d.student.class_name} - ${d.student.section}</div>
                  <div><strong>Academic Year:</strong> ${d.student.academic_year}</div>
                  <div><strong>Parent / Guardian:</strong> ${d.student.parent_name || 'N/A'}</div>
                  <div><strong>Date of Issue:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>

                <table class="report-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Course Code</th>
                      <th>Max Marks</th>
                      <th>Marks Obtained</th>
                      <th>Grade</th>
                      <th>Academic Faculty Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${d.subjects.map(s => `
                      <tr>
                        <td><strong>${s.subject_name}</strong></td>
                        <td>${s.subject_code}</td>
                        <td>${s.max_marks}</td>
                        <td><strong>${s.marks_obtained}</strong></td>
                        <td><strong>${s.grade}</strong></td>
                        <td>${s.remarks || 'Satisfactory'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>

                <div class="report-summary-box">
                  <div>
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b;">Total Marks</span>
                    <h3 style="font-size: 20px; font-family: inherit;">${d.summary.totalMarksObtained} / ${d.summary.maximumPossibleMarks}</h3>
                  </div>
                  <div>
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b;">Percentage</span>
                    <h3 style="font-size: 20px; font-family: inherit;">${d.summary.percentage}%</h3>
                  </div>
                  <div>
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b;">Cumulative GPA</span>
                    <h3 style="font-size: 20px; font-family: inherit;">${d.summary.gpa} / 4.00</h3>
                  </div>
                  <div>
                    <span style="font-size: 11px; text-transform: uppercase; color: #64748b;">Class Standing</span>
                    <h3 style="font-size: 20px; font-family: inherit;">Rank ${d.summary.classRank}</h3>
                  </div>
                </div>

                <div style="font-size: 13.5px; margin-bottom: 20px; padding: 10px; background: #f1f5f9; border-radius: 4px;">
                  <strong>Principal's Overall Evaluation:</strong> ${d.summary.remarks}. Demonstrates consistent discipline and high engagement.
                </div>

                <div class="report-signatures">
                  <div class="sig-line">Class Teacher Signature</div>
                  <div class="sig-line">Exam Controller</div>
                  <div class="sig-line">Principal / Seal</div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('reportCardModal').remove()">Close</button>
              <button class="btn btn-primary" onclick="window.print()">🖨️ Print Official Report Card</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  showCreateExamModal() {
    const modalHtml = `
      <div class="modal-backdrop open" id="createExamModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Create Assessment Term</h3>
            <button class="modal-close" onclick="document.getElementById('createExamModal').remove()">&times;</button>
          </div>
          <form onsubmit="ExamsView.submitCreateExam(event)">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Exam Name *</label>
                <input type="text" name="name" class="form-control" placeholder="e.g. Mid-Term Assessment 2026" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Term *</label>
                  <input type="text" name="term" class="form-control" placeholder="e.g. Term 1" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Academic Year *</label>
                  <input type="text" name="academic_year" class="form-control" value="2026-2027" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Start Date *</label>
                  <input type="date" name="start_date" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label">End Date *</label>
                  <input type="date" name="end_date" class="form-control" required>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('createExamModal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Term</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitCreateExam(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    try {
      const res = await API.createExam(data);
      if (res.success) {
        App.toast('Exam created!', 'success');
        document.getElementById('createExamModal')?.remove();
        this.loadExams();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async showScheduleModal(examId) {
    const [classesRes, subjectsRes] = await Promise.all([API.getClasses(), API.getSubjects()]);
    const classes = classesRes.data || [];
    const subjects = subjectsRes.data || [];

    const modalHtml = `
      <div class="modal-backdrop open" id="schedModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Schedule Subject Paper</h3>
            <button class="modal-close" onclick="document.getElementById('schedModal').remove()">&times;</button>
          </div>
          <form onsubmit="ExamsView.submitSchedule(event, '${examId}')">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Class *</label>
                  <select name="class_id" class="form-control" required>
                    ${classes.map(c => `<option value="${c.id}">${c.name} - ${c.section}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Subject *</label>
                  <select name="subject_id" class="form-control" required>
                    ${subjects.map(s => `<option value="${s.id}">${s.name} (${s.code})</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Exam Date *</label>
                <input type="date" name="exam_date" class="form-control" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Start Time *</label>
                  <input type="time" name="start_time" class="form-control" value="09:00" required>
                </div>
                <div class="form-group">
                  <label class="form-label">End Time *</label>
                  <input type="time" name="end_time" class="form-control" value="12:00" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Max Marks</label>
                  <input type="number" name="max_marks" class="form-control" value="100">
                </div>
                <div class="form-group">
                  <label class="form-label">Pass Marks</label>
                  <input type="number" name="pass_marks" class="form-control" value="40">
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('schedModal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Schedule Paper</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitSchedule(e, examId) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    try {
      const res = await API.createExamSchedule(examId, data);
      if (res.success) {
        App.toast('Subject paper scheduled!', 'success');
        document.getElementById('schedModal')?.remove();
        this.onExamSelected();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }
};
