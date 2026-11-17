const NoticesView = {
  noticesList: [],

  async render() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Campus Announcements & Circulars</h3>
            <p style="font-size: 12.5px; color: #64748b; margin-top: 2px;">School-wide broadcast messages, event notices, academic schedules, and priority alerts</p>
          </div>
          <button class="btn btn-primary" onclick="NoticesView.showCreateModal()">
            <span>➕ Publish Announcement</span>
          </button>
        </div>

        <div class="card-body">
          <div id="noticesContainer" style="display: flex; flex-direction: column; gap: 16px;">
            <p style="color: #64748b;">Loading notices...</p>
          </div>
        </div>
      </div>
    `;

    await this.loadNotices();
  },

  async loadNotices() {
    try {
      const res = await API.getNotices();
      if (!res.success) return;
      this.noticesList = res.data;

      const container = document.getElementById('noticesContainer');
      if (!container) return;

      if (this.noticesList.length === 0) {
        container.innerHTML = '<p style="color: #64748b; text-align: center; padding: 24px;">No active notices.</p>';
        return;
      }

      container.innerHTML = this.noticesList.map(n => `
        <div style="background: #ffffff; border: 1px solid ${n.priority === 'Urgent' ? '#fecaca' : '#e2e8f0'}; border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); position: relative;">
          ${n.is_pinned ? `<span style="position: absolute; top: 16px; right: 20px; font-size: 16px;" title="Pinned Notice">📌</span>` : ''}
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
            <span class="badge ${n.priority === 'Urgent' ? 'badge-danger' : (n.priority === 'High' ? 'badge-warning' : 'badge-info')}">
              ${n.priority} Priority
            </span>
            <span class="badge badge-secondary">Target: ${n.target_role}</span>
            <span style="font-size: 12px; color: #94a3b8; margin-left: 6px;">Published on ${n.created_at ? n.created_at.slice(0, 10) : ''}</span>
          </div>

          <h3 style="font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">${n.title}</h3>
          <p style="font-size: 13.5px; color: #334155; line-height: 1.6; white-space: pre-line;">${n.content}</p>

          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b;">
            <span>Author: <strong>${n.author_name || 'Administration'}</strong> (${n.author_role || 'Staff'})</span>
            ${App.currentUser?.role === 'admin' ? `
              <button class="btn btn-danger btn-sm" onclick="NoticesView.deleteNotice('${n.id}')">Delete Notice</button>
            ` : ''}
          </div>
        </div>
      `).join('');
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  showCreateModal() {
    const modalHtml = `
      <div class="modal-backdrop open" id="noticeModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Publish Campus Circular</h3>
            <button class="modal-close" onclick="document.getElementById('noticeModal').remove()">&times;</button>
          </div>
          <form onsubmit="NoticesView.submitNotice(event)">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Notice Title *</label>
                <input type="text" name="title" class="form-control" placeholder="e.g. Annual STEM Symposium 2026" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Priority Level *</label>
                  <select name="priority" class="form-control" required>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent Alert</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Audience *</label>
                  <select name="target_role" class="form-control" required>
                    <option value="All">Entire School (All Roles)</option>
                    <option value="Teachers">Faculty & Teachers Only</option>
                    <option value="Parents">Parents Only</option>
                    <option value="Students">Students Only</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Notice Content *</label>
                <textarea name="content" class="form-control" rows="5" placeholder="Enter complete announcement details..." required></textarea>
              </div>
              <div class="form-group" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" name="is_pinned" id="pinNoticeCheck" value="1">
                <label for="pinNoticeCheck" style="margin: 0; font-size: 13px; font-weight: 600; cursor: pointer;">Pin to top of notice board</label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('noticeModal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Publish Circular</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitNotice(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.is_pinned = e.target.is_pinned.checked ? 1 : 0;

    try {
      const res = await API.postNotice(data);
      if (res.success) {
        App.toast('Notice broadcasted successfully!', 'success');
        document.getElementById('noticeModal')?.remove();
        this.loadNotices();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async deleteNotice(id) {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      const res = await API.deleteNotice(id);
      if (res.success) {
        App.toast('Notice removed', 'info');
        this.loadNotices();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }
};
