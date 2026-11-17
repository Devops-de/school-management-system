const App = {
  currentView: 'dashboard',
  currentUser: null,

  async init() {
    // If not logged in, auto-login with default admin demo credentials for instant evaluation
    if (!API.token) {
      try {
        console.log('[App] Initializing demo session as Principal/Admin...');
        await API.login('admin@school.edu', 'Admin@123');
      } catch (e) {
        console.warn('Auto-login notice:', e.message);
      }
    }

    try {
      const meRes = await API.getMe();
      if (meRes.success) {
        this.currentUser = meRes.user;
        this.updateUserUI(meRes.user);
      }
    } catch (err) {
      console.warn('Get me error:', err.message);
    }

    // Set initial view from hash or default
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    this.navigateTo(hash, false);

    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '') || 'dashboard';
      this.navigateTo(h, false);
    });
  },

  updateUserUI(user) {
    if (!user) return;
    const nameEl = document.getElementById('topbarUserName');
    const emailEl = document.getElementById('topbarUserEmail');
    const avatarEl = document.getElementById('topbarUserAvatar');
    const badgeEl = document.getElementById('topbarRoleBadge');
    const roleSel = document.getElementById('roleSwitcherSelect');

    if (nameEl) nameEl.textContent = user.full_name;
    if (emailEl) emailEl.textContent = user.email;
    if (avatarEl) avatarEl.textContent = user.full_name ? user.full_name[0] : 'U';

    if (badgeEl) {
      badgeEl.textContent = user.role;
      badgeEl.className = `role-badge role-${user.role}`;
    }

    if (roleSel) {
      roleSel.value = user.role;
    }
  },

  navigateTo(viewName, updateHash = true) {
    this.currentView = viewName;
    if (updateHash) {
      window.location.hash = viewName;
    }

    // Update nav links active class
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-view') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update topbar breadcrumb
    const titles = {
      dashboard: 'Campus Dashboard & Metrics',
      students: 'Student Information System (SIS)',
      teachers: 'Academic Faculty & Staff',
      classes: 'Classrooms & Academic Curriculum',
      attendance: 'Smart Attendance Register',
      exams: 'Exams, Gradebook & Report Cards',
      fees: 'Fee Management & Invoicing',
      notices: 'Announcements & Circulars',
      system: 'High Availability & Fault-Tolerance Diagnostics',
      portal: 'Learner & Parent Workspace'
    };
    const breadcrumb = document.getElementById('pageTitleBreadcrumb');
    if (breadcrumb) {
      breadcrumb.textContent = titles[viewName] || 'School Management System';
    }

    // Render corresponding view
    switch (viewName) {
      case 'dashboard':
        DashboardView.render();
        break;
      case 'students':
        StudentsView.render();
        break;
      case 'teachers':
        TeachersView.render();
        break;
      case 'classes':
        ClassesView.render();
        break;
      case 'attendance':
        AttendanceView.render();
        break;
      case 'exams':
        ExamsView.render();
        break;
      case 'fees':
        FeesView.render();
        break;
      case 'notices':
        NoticesView.render();
        break;
      case 'system':
        SystemView.render();
        break;
      case 'portal':
        PortalView.render();
        break;
      default:
        DashboardView.render();
    }
  },

  async switchRole(targetRole) {
    const roleAccounts = {
      admin: { email: 'admin@school.edu', pw: 'Admin@123' },
      teacher: { email: 'teacher@school.edu', pw: 'Teacher@123' },
      student: { email: 'student@school.edu', pw: 'Student@123' },
      parent: { email: 'parent@school.edu', pw: 'Parent@123' },
      accountant: { email: 'accountant@school.edu', pw: 'Accountant@123' }
    };

    const creds = roleAccounts[targetRole];
    if (!creds) return;

    try {
      this.toast(`Switching active role to ${targetRole.toUpperCase()}...`, 'info');
      await API.login(creds.email, creds.pw);
      const meRes = await API.getMe();
      this.currentUser = meRes.user;
      this.updateUserUI(meRes.user);
      this.toast(`Now operating as ${meRes.user.full_name} (${targetRole.toUpperCase()})`, 'success');

      // If switched to student or parent, automatically route to portal
      if (targetRole === 'student' || targetRole === 'parent') {
        this.navigateTo('portal');
      } else {
        this.navigateTo(this.currentView);
      }
    } catch (err) {
      this.toast(`Could not switch role: ${err.message}`, 'error');
    }
  },

  toast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = message;
    container.appendChild(t);

    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      t.style.transition = 'all 0.3s ease';
      setTimeout(() => t.remove(), 300);
    }, 4000);
  },

  async triggerInstantBackup() {
    try {
      this.toast('Executing online hot-backup...', 'info');
      const res = await API.triggerBackup();
      if (res.success) {
        this.toast(`Backup saved: ${res.data.filename} (${res.data.durationMs}ms)`, 'success');
      }
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async showEnrollModal() {
    const classesRes = await API.getClasses();
    const classes = classesRes.data || [];

    const modalHtml = `
      <div class="modal-backdrop open" id="enrollModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog modal-lg">
          <div class="modal-header">
            <h3 class="modal-title">Student Enrollment & SIS Registration</h3>
            <button class="modal-close" onclick="document.getElementById('enrollModal').remove()">&times;</button>
          </div>
          <form onsubmit="App.submitEnrollment(event)">
            <div class="modal-body">
              <h4 style="font-size: 13.5px; text-transform: uppercase; color: #64748b; margin-bottom: 12px;">Student Demographics</h4>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">First Name *</label>
                  <input type="text" name="first_name" class="form-control" placeholder="e.g. Alexander" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Last Name *</label>
                  <input type="text" name="last_name" class="form-control" placeholder="e.g. Vance" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Date of Birth *</label>
                  <input type="date" name="date_of_birth" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Gender *</label>
                  <select name="gender" class="form-control" required>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Blood Group</label>
                  <select name="blood_group" class="form-control">
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+" selected>O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Assign Class & Section *</label>
                  <select name="class_id" class="form-control" required>
                    ${classes.map(c => `<option value="${c.id}">${c.name} - Section ${c.section} (${c.academic_year})</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Enrollment Date</label>
                  <input type="date" name="enrollment_date" class="form-control" value="${new Date().toISOString().split('T')[0]}">
                </div>
              </div>

              <h4 style="font-size: 13.5px; text-transform: uppercase; color: #64748b; margin: 18px 0 12px;">Parent / Guardian Information</h4>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Parent Full Name</label>
                  <input type="text" name="parent_name" class="form-control" placeholder="e.g. Margaret Vance">
                </div>
                <div class="form-group">
                  <label class="form-label">Relationship</label>
                  <select name="parent_relationship" class="form-control">
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Parent Phone / Emergency Contact</label>
                  <input type="tel" name="parent_phone" class="form-control" placeholder="+1 (555) 000-0000">
                </div>
                <div class="form-group">
                  <label class="form-label">Parent Email</label>
                  <input type="email" name="parent_email" class="form-control" placeholder="parent@example.com">
                </div>
              </div>

              <h4 style="font-size: 13.5px; text-transform: uppercase; color: #64748b; margin: 18px 0 12px;">Medical Notes & Residential Address</h4>
              <div class="form-group">
                <label class="form-label">Medical Considerations / Allergies</label>
                <input type="text" name="medical_notes" class="form-control" placeholder="e.g. Asthma, peanut allergy, or None">
              </div>
              <div class="form-group">
                <label class="form-label">Home Address</label>
                <input type="text" name="address" class="form-control" placeholder="Street address, city, state, zip">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('enrollModal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Enroll & Generate Admission #</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitEnrollment(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await API.enrollStudent(data);
      if (res.success) {
        this.toast(res.message, 'success');
        document.getElementById('enrollModal')?.remove();
        if (this.currentView === 'students') {
          StudentsView.loadData();
        } else {
          this.navigateTo('students');
        }
      }
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  showAddTeacherModal() {
    const modalHtml = `
      <div class="modal-backdrop open" id="addTeacherModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog modal-lg">
          <div class="modal-header">
            <h3 class="modal-title">Register Faculty Member</h3>
            <button class="modal-close" onclick="document.getElementById('addTeacherModal').remove()">&times;</button>
          </div>
          <form onsubmit="App.submitTeacher(event)">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">First Name *</label>
                  <input type="text" name="first_name" class="form-control" placeholder="e.g. Eleanor" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Last Name *</label>
                  <input type="text" name="last_name" class="form-control" placeholder="e.g. Vance" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Official Email *</label>
                  <input type="email" name="email" class="form-control" placeholder="teacher@school.edu" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Contact Phone</label>
                  <input type="tel" name="phone" class="form-control" placeholder="+1 (555) 000-0000">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Department *</label>
                  <select name="department" class="form-control" required>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Sciences">Sciences</option>
                    <option value="Humanities">Humanities</option>
                    <option value="Technology">Technology & Computer Science</option>
                    <option value="Arts">Fine Arts & Music</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Highest Qualification *</label>
                  <input type="text" name="qualification" class="form-control" placeholder="e.g. Ph.D. in Computer Science" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Designation</label>
                  <input type="text" name="designation" class="form-control" value="Senior Instructor">
                </div>
                <div class="form-group">
                  <label class="form-label">Default Portal Password</label>
                  <input type="text" name="password" class="form-control" value="Teacher@123">
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('addTeacherModal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Faculty Account</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitTeacher(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await API.createTeacher(data);
      if (res.success) {
        this.toast(res.message, 'success');
        document.getElementById('addTeacherModal')?.remove();
        if (this.currentView === 'teachers') {
          TeachersView.loadData();
        } else {
          this.navigateTo('teachers');
        }
      }
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }
};

// Initialize App on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
