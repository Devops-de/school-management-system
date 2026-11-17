const ClassesView = {
  classesList: [],

  async render() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Classrooms & Academic Curriculum</h3>
            <p style="font-size: 12.5px; color: #64748b; margin-top: 2px;">Grade sections, student enrollment counts, assigned faculty, and subjects</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" onclick="ClassesView.showCreateSubjectModal()">
              <span>📚 Add Subject</span>
            </button>
            <button class="btn btn-primary" onclick="ClassesView.showCreateClassModal()">
              <span>🏫 Create Class</span>
            </button>
          </div>
        </div>

        <div class="card-body">
          <div id="classesGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
            <p style="color: #64748b;">Loading classroom data...</p>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const res = await API.getClasses();
      if (!res.success) return;
      this.classesList = res.data;

      const grid = document.getElementById('classesGrid');
      if (!grid) return;

      if (this.classesList.length === 0) {
        grid.innerHTML = '<p style="color: #64748b;">No classes registered yet.</p>';
        return;
      }

      grid.innerHTML = this.classesList.map(c => `
        <div style="background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <h4 style="font-size: 16px; font-weight: 700; color: #0f172a;">${c.name} - ${c.section}</h4>
              <p style="font-size: 12px; color: #64748b;">Academic Year: ${c.academic_year}</p>
            </div>
            <span class="badge badge-info">${c.room_number || 'Room TBD'}</span>
          </div>

          <div style="margin-bottom: 16px; font-size: 13px; color: #475569;">
            <div style="margin-bottom: 4px;"><strong>Class Teacher:</strong> ${c.class_teacher_name || 'Unassigned'}</div>
            <div><strong>Enrollment:</strong> <span style="font-weight: 700; color: #2563eb;">${c.student_count}</span> / ${c.capacity} students</div>
          </div>

          <div style="background: #f1f5f9; height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 16px;">
            <div style="width: ${Math.min(100, (c.student_count / (c.capacity || 30)) * 100)}%; height: 100%; background: #3b82f6;"></div>
          </div>

          <button class="btn btn-secondary btn-sm" style="width: 100%; justify-content: center;" onclick="ClassesView.viewClassDetails('${c.id}')">
            View Roster & Subjects
          </button>
        </div>
      `).join('');
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async viewClassDetails(classId) {
    try {
      const res = await API.getClass(classId);
      if (!res.success) return;
      const c = res.data;

      const modalHtml = `
        <div class="modal-backdrop open" id="classModal" onclick="if(event.target===this) this.remove()">
          <div class="modal-dialog modal-lg">
            <div class="modal-header">
              <h3 class="modal-title">${c.name} - Section ${c.section} (${c.academic_year})</h3>
              <button class="modal-close" onclick="document.getElementById('classModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <div style="display: flex; gap: 24px; margin-bottom: 20px; font-size: 13.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px;">
                <div><strong>Class Teacher:</strong> ${c.class_teacher_name || 'None'}</div>
                <div><strong>Room:</strong> ${c.room_number || 'TBD'}</div>
                <div><strong>Roster Count:</strong> ${c.students.length} students</div>
              </div>

              <!-- Assigned Subjects -->
              <h4 style="font-size: 14px; margin-bottom: 10px;">Curriculum & Faculty Assignments</h4>
              <div class="table-responsive" style="margin-bottom: 24px;">
                <table class="table" style="font-size: 12.5px;">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Code</th>
                      <th>Department</th>
                      <th>Assigned Instructor</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${c.subjects.length > 0 ? c.subjects.map(s => `
                      <tr>
                        <td><strong>${s.name}</strong></td>
                        <td>${s.code}</td>
                        <td>${s.department}</td>
                        <td>${s.teacher_name || '<span style="color:#ef4444;">Unassigned</span>'}</td>
                      </tr>
                    `).join('') : '<tr><td colspan="4" style="text-align: center; color: #64748b;">No subjects assigned yet.</td></tr>'}
                  </tbody>
                </table>
              </div>

              <!-- Student Roster -->
              <h4 style="font-size: 14px; margin-bottom: 10px;">Enrolled Student Roster (${c.students.length})</h4>
              <div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
                <table class="table" style="font-size: 12.5px;">
                  <thead>
                    <tr>
                      <th>Adm #</th>
                      <th>Full Name</th>
                      <th>Gender</th>
                      <th>Blood Group</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${c.students.length > 0 ? c.students.map(st => `
                      <tr>
                        <td>${st.admission_number}</td>
                        <td><strong>${st.first_name} ${st.last_name}</strong></td>
                        <td>${st.gender}</td>
                        <td>${st.blood_group || 'N/A'}</td>
                        <td>
                          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('classModal').remove(); StudentsView.viewProfile('${st.id}')">View</button>
                        </td>
                      </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align: center; color: #64748b;">No students in this class.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('classModal').remove()">Close</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  showCreateClassModal() {
    const modalHtml = `
      <div class="modal-backdrop open" id="createClassModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Create New Classroom</h3>
            <button class="modal-close" onclick="document.getElementById('createClassModal').remove()">&times;</button>
          </div>
          <form onsubmit="ClassesView.submitCreateClass(event)">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Grade Name *</label>
                  <input type="text" name="name" class="form-control" placeholder="e.g. Grade 10" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Grade Level (Numeric) *</label>
                  <input type="number" name="grade_level" class="form-control" placeholder="10" min="1" max="12" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Section *</label>
                  <input type="text" name="section" class="form-control" placeholder="e.g. A, B, or Honors" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Room Number</label>
                  <input type="text" name="room_number" class="form-control" placeholder="e.g. Wing B - Rm 305">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Academic Year *</label>
                  <input type="text" name="academic_year" class="form-control" value="2026-2027" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Capacity</label>
                  <input type="number" name="capacity" class="form-control" value="30">
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('createClassModal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Class</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitCreateClass(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    try {
      const res = await API.createClass(data);
      if (res.success) {
        App.toast('Class created successfully!', 'success');
        document.getElementById('createClassModal')?.remove();
        this.loadData();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  showCreateSubjectModal() {
    const modalHtml = `
      <div class="modal-backdrop open" id="createSubModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Register Academic Subject</h3>
            <button class="modal-close" onclick="document.getElementById('createSubModal').remove()">&times;</button>
          </div>
          <form onsubmit="ClassesView.submitCreateSubject(event)">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Subject Name *</label>
                <input type="text" name="name" class="form-control" placeholder="e.g. Quantum Computing & AI" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Course Code *</label>
                  <input type="text" name="code" class="form-control" placeholder="e.g. CS-401" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Department *</label>
                  <input type="text" name="department" class="form-control" placeholder="e.g. Technology" required>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Academic Credits</label>
                <input type="number" name="credits" class="form-control" value="4">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('createSubModal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Subject</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitCreateSubject(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    try {
      const res = await API.createSubject(data);
      if (res.success) {
        App.toast('Academic subject added!', 'success');
        document.getElementById('createSubModal')?.remove();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }
};
