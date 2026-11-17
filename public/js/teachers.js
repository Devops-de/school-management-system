const TeachersView = {
  teachersList: [],

  async render() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Academic Faculty & Staff Directory</h3>
            <p style="font-size: 12.5px; color: #64748b; margin-top: 2px;">Faculty profiles, department specializations, assigned classes, and credentials</p>
          </div>
          <button class="btn btn-primary" onclick="App.showAddTeacherModal()">
            <span>➕ Add Faculty Member</span>
          </button>
        </div>

        <div class="card-body">
          <div id="teachersGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
            <p style="color: #64748b;">Loading faculty records...</p>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    try {
      const res = await API.getTeachers();
      if (!res.success) return;

      this.teachersList = res.data;
      const grid = document.getElementById('teachersGrid');
      if (!grid) return;

      if (this.teachersList.length === 0) {
        grid.innerHTML = '<p style="color: #64748b;">No faculty members registered.</p>';
        return;
      }

      grid.innerHTML = this.teachersList.map(t => `
        <div style="background: #ffffff; border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 14px;">
              <div style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: #fff; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center;">
                ${t.first_name[0]}${t.last_name[0]}
              </div>
              <div>
                <h4 style="font-size: 15px; font-weight: 700; color: #0f172a;">${t.first_name} ${t.last_name}</h4>
                <p style="font-size: 12px; color: #2563eb; font-weight: 600;">${t.designation || 'Instructor'}</p>
                <span class="badge badge-secondary" style="font-size: 10.5px; margin-top: 2px;">${t.department}</span>
              </div>
            </div>

            <div style="font-size: 12.5px; color: #475569; display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
              <div><strong>Employee ID:</strong> ${t.employee_id}</div>
              <div><strong>Email:</strong> ${t.email}</div>
              <div><strong>Qualification:</strong> ${t.qualification}</div>
              <div><strong>Subjects:</strong> ${t.subjects_taught || 'General Instruction'}</div>
              <div><strong>Class Teacher:</strong> ${t.assigned_classes || 'None'}</div>
            </div>
          </div>

          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
            <span class="badge badge-success">Active Faculty</span>
            <span style="font-size: 11px; color: #94a3b8;">Joined ${t.joining_date}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }
};
