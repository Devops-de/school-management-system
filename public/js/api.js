// Client-side API abstraction layer
const API = {
  token: localStorage.getItem('sms_token') || null,
  currentUser: JSON.parse(localStorage.getItem('sms_user') || 'null'),

  setSession(token, user) {
    this.token = token;
    this.currentUser = user;
    if (token) {
      localStorage.setItem('sms_token', token);
      localStorage.setItem('sms_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sms_token');
      localStorage.removeItem('sms_user');
    }
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401 && !endpoint.includes('/login')) {
          this.setSession(null, null);
          window.location.reload();
          throw new Error('Session expired. Please log in.');
        }
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth endpoints
  async login(login, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password })
    });
    if (res.success) {
      this.setSession(res.token, res.user);
    }
    return res;
  },

  async getMe() {
    return this.request('/api/auth/me');
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setSession(null, null);
      window.location.reload();
    }
  },

  // Students
  getStudents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/students?${query}`);
  },

  getStudent(id) {
    return this.request(`/api/students/${id}`);
  },

  enrollStudent(data) {
    return this.request('/api/students', { method: 'POST', body: JSON.stringify(data) });
  },

  updateStudent(id, data) {
    return this.request(`/api/students/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  // Teachers
  getTeachers() {
    return this.request('/api/teachers');
  },

  createTeacher(data) {
    return this.request('/api/teachers', { method: 'POST', body: JSON.stringify(data) });
  },

  // Classes & Subjects
  getClasses() {
    return this.request('/api/classes');
  },

  getClass(id) {
    return this.request(`/api/classes/${id}`);
  },

  createClass(data) {
    return this.request('/api/classes', { method: 'POST', body: JSON.stringify(data) });
  },

  getSubjects() {
    return this.request('/api/classes/subjects/all');
  },

  createSubject(data) {
    return this.request('/api/classes/subjects', { method: 'POST', body: JSON.stringify(data) });
  },

  assignSubject(classId, data) {
    return this.request(`/api/classes/${classId}/assign-subject`, { method: 'POST', body: JSON.stringify(data) });
  },

  // Attendance
  getAttendance(classId, date) {
    return this.request(`/api/attendance?class_id=${classId}&date=${date}`);
  },

  submitAttendance(classId, date, records) {
    return this.request('/api/attendance/bulk', {
      method: 'POST',
      body: JSON.stringify({ class_id: classId, date, records })
    });
  },

  getAttendanceStats() {
    return this.request('/api/attendance/stats');
  },

  getStudentAttendance(studentId) {
    return this.request(`/api/attendance/student/${studentId}`);
  },

  // Exams
  getExams() {
    return this.request('/api/exams');
  },

  createExam(data) {
    return this.request('/api/exams', { method: 'POST', body: JSON.stringify(data) });
  },

  getExamSchedules(examId) {
    return this.request(`/api/exams/${examId}/schedules`);
  },

  createExamSchedule(examId, data) {
    return this.request(`/api/exams/${examId}/schedules`, { method: 'POST', body: JSON.stringify(data) });
  },

  getScheduleMarks(scheduleId) {
    return this.request(`/api/exams/schedule/${scheduleId}/marks`);
  },

  submitMarks(scheduleId, results) {
    return this.request(`/api/exams/schedule/${scheduleId}/marks`, {
      method: 'POST',
      body: JSON.stringify({ results })
    });
  },

  getReportCard(studentId, examId) {
    return this.request(`/api/exams/report-card/${studentId}/${examId}`);
  },

  // Fees
  getFeeCategories() {
    return this.request('/api/fees/categories');
  },

  getInvoices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/fees/invoices?${query}`);
  },

  createInvoices(data) {
    return this.request('/api/fees/invoices', { method: 'POST', body: JSON.stringify(data) });
  },

  payFee(data) {
    return this.request('/api/fees/pay', { method: 'POST', body: JSON.stringify(data) });
  },

  getReceipt(paymentId) {
    return this.request(`/api/fees/receipt/${paymentId}`);
  },

  getFeeStats() {
    return this.request('/api/fees/stats');
  },

  // Notices
  getNotices() {
    return this.request('/api/notices');
  },

  postNotice(data) {
    return this.request('/api/notices', { method: 'POST', body: JSON.stringify(data) });
  },

  deleteNotice(id) {
    return this.request(`/api/notices/${id}`, { method: 'DELETE' });
  },

  // System & Fault Tolerance
  getHealth() {
    return this.request('/api/system/health');
  },

  getMetrics() {
    return this.request('/api/system/metrics');
  },

  getBackups() {
    return this.request('/api/system/backups');
  },

  triggerBackup() {
    return this.request('/api/system/backup', { method: 'POST' });
  },

  simulateFault(type) {
    return this.request('/api/system/simulate-fault', { method: 'POST', body: JSON.stringify({ type }) });
  },

  // Audit Logs
  getAuditLogs(limit = 40) {
    return this.request(`/api/audit-logs?limit=${limit}`);
  }
};
