const FeesView = {
  invoicesList: [],

  async render() {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
      <div class="stats-grid" style="margin-bottom: 20px;">
        <div class="stat-card green">
          <div class="stat-info">
            <span>Total Collected</span>
            <h3 id="feeTotalCollected">$0</h3>
            <p>Verified Revenue & Receipts</p>
          </div>
          <div class="stat-icon">💰</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-info">
            <span>Outstanding Dues</span>
            <h3 id="feeOutstanding">$0</h3>
            <p>Pending Student Invoices</p>
          </div>
          <div class="stat-icon">⏳</div>
        </div>
        <div class="stat-card blue">
          <div class="stat-info">
            <span>Collection Efficiency</span>
            <h3 id="feeEfficiency">0%</h3>
            <p>Billed vs Settled</p>
          </div>
          <div class="stat-icon">📈</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Fee Invoices & Student Billing</h3>
            <p style="font-size: 12.5px; color: #64748b; margin-top: 2px;">Track tuition invoices, issue bulk fee notices, process payments with double-entry balance updates</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary" onclick="FeesView.showCategoryModal()">
              <span>🏷️ Fee Structures</span>
            </button>
            <button class="btn btn-primary" onclick="FeesView.showInvoiceModal()">
              <span>📄 Generate Invoices</span>
            </button>
          </div>
        </div>

        <!-- Filter bar -->
        <div style="padding: 16px 24px; background: #f8fafc; border-bottom: 1px solid var(--border); display: flex; gap: 14px; flex-wrap: wrap; align-items: center;">
          <select id="feeStatusFilter" class="form-control" style="max-width: 180px;" onchange="FeesView.loadInvoices()">
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
          <button class="btn btn-secondary btn-sm" onclick="FeesView.loadInvoices()">🔄 Refresh Invoices</button>
        </div>

        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Student</th>
                <th>Class</th>
                <th>Fee Category</th>
                <th>Total Billed</th>
                <th>Paid Amount</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="invoicesTableBody">
              <tr><td colspan="9" style="text-align: center; padding: 24px; color: #64748b;">Loading invoices...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await this.loadStats();
    await this.loadInvoices();
  },

  async loadStats() {
    try {
      const res = await API.getFeeStats();
      if (!res.success) return;
      const d = res.data;
      document.getElementById('feeTotalCollected').textContent = `$${d.total_collected.toLocaleString()}`;
      document.getElementById('feeOutstanding').textContent = `$${d.outstanding.toLocaleString()}`;
      document.getElementById('feeEfficiency').textContent = `${d.collectionRate}%`;
    } catch (err) {
      console.warn('Fee stats error:', err.message);
    }
  },

  async loadInvoices() {
    const status = document.getElementById('feeStatusFilter')?.value || '';
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    try {
      const res = await API.getInvoices({ status });
      if (!res.success) return;
      this.invoicesList = res.data;

      if (this.invoicesList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px; color: #64748b;">No invoices matching criteria.</td></tr>';
        return;
      }

      tbody.innerHTML = this.invoicesList.map(inv => `
        <tr>
          <td><strong>${inv.invoice_number}</strong><br><small style="color: #64748b;">Due: ${inv.due_date}</small></td>
          <td><strong>${inv.first_name} ${inv.last_name}</strong><br><small style="color: #64748b;">${inv.admission_number}</small></td>
          <td>${inv.class_name} ${inv.section}</td>
          <td>${inv.category_name}</td>
          <td>$${inv.amount.toLocaleString()}</td>
          <td><span style="color: #10b981; font-weight: 600;">$${inv.paid_amount.toLocaleString()}</span></td>
          <td><strong style="color: ${inv.balance_due > 0 ? '#ef4444' : '#10b981'};">$${inv.balance_due.toLocaleString()}</strong></td>
          <td>
            <span class="badge ${inv.status === 'Paid' ? 'badge-success' : (inv.status === 'Partial' ? 'badge-warning' : 'badge-danger')}">
              ${inv.status}
            </span>
          </td>
          <td>
            ${inv.balance_due > 0 ? `
              <button class="btn btn-primary btn-sm" onclick="FeesView.showPaymentModal('${inv.id}', ${inv.balance_due}, '${inv.invoice_number}')">Pay</button>
            ` : `
              <span style="color: #10b981; font-weight: 700; font-size: 12px;">Settled ✓</span>
            `}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  showPaymentModal(invoiceId, balanceDue, invoiceNumber) {
    const modalHtml = `
      <div class="modal-backdrop open" id="paymentModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Record Payment: ${invoiceNumber}</h3>
            <button class="modal-close" onclick="document.getElementById('paymentModal').remove()">&times;</button>
          </div>
          <form onsubmit="FeesView.submitPayment(event, '${invoiceId}')">
            <div class="modal-body">
              <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <strong>Outstanding Balance:</strong> <span style="color: #ef4444; font-weight: 700;">$${balanceDue}</span>
              </div>
              <div class="form-group">
                <label class="form-label">Payment Amount ($) *</label>
                <input type="number" step="0.01" min="1" max="${balanceDue}" name="amount_paid" class="form-control" value="${balanceDue}" required>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Payment Method *</label>
                  <select name="payment_method" class="form-control" required>
                    <option value="Online">Online / Credit Card</option>
                    <option value="Bank Transfer">Bank Wire / ACH</option>
                    <option value="Card">Debit / Point-of-Sale Card</option>
                    <option value="Cash">Cash (Bursar Counter)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Transaction Reference #</label>
                  <input type="text" name="transaction_id" class="form-control" placeholder="e.g. TXN-99882">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Notes / Receipt Remarks</label>
                <input type="text" name="notes" class="form-control" placeholder="e.g. Fall term settlement">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('paymentModal').remove()">Cancel</button>
              <button type="submit" class="btn btn-success">Record Payment</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  async submitPayment(e, invoiceId) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.invoice_id = invoiceId;

    try {
      const res = await API.payFee(data);
      if (res.success) {
        App.toast(res.message, 'success');
        document.getElementById('paymentModal')?.remove();
        this.loadStats();
        this.loadInvoices();

        // Show receipt
        if (res.data?.id) {
          this.viewReceipt(res.data.id);
        }
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async viewReceipt(paymentId) {
    try {
      const res = await API.getReceipt(paymentId);
      if (!res.success) return;
      const r = res.data;

      const modalHtml = `
        <div class="modal-backdrop open" id="receiptModal" onclick="if(event.target===this) this.remove()">
          <div class="modal-dialog">
            <div class="modal-header">
              <h3 class="modal-title">Payment Receipt: ${r.payment_reference}</h3>
              <button class="modal-close" onclick="document.getElementById('receiptModal').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <div style="border: 2px solid #0f172a; padding: 24px; border-radius: 8px; font-family: 'Times New Roman', Times, serif;">
                <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
                  <h2 style="font-size: 20px; text-transform: uppercase;">The Vanguard International Academy</h2>
                  <p style="font-size: 12px; color: #64748b;">Official Bursar Payment Receipt</p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13.5px; margin-bottom: 16px;">
                  <div><strong>Receipt Ref:</strong> ${r.payment_reference}</div>
                  <div><strong>Date:</strong> ${r.payment_date}</div>
                  <div><strong>Student Name:</strong> ${r.first_name} ${r.last_name}</div>
                  <div><strong>Admission #:</strong> ${r.admission_number}</div>
                  <div><strong>Class:</strong> ${r.class_name} - ${r.section}</div>
                  <div><strong>Invoice #:</strong> ${r.invoice_number}</div>
                </div>

                <table class="report-table" style="margin-bottom: 16px;">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Method</th>
                      <th>Transaction ID</th>
                      <th>Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>${r.fee_category_name} (${r.academic_year})</td>
                      <td>${r.payment_method}</td>
                      <td>${r.transaction_id || 'N/A'}</td>
                      <td><strong>$${r.amount_paid.toLocaleString()}</strong></td>
                    </tr>
                  </tbody>
                </table>

                <div style="text-align: right; font-size: 16px; margin-bottom: 20px;">
                  <strong>Total Settled: $${r.amount_paid.toLocaleString()}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; margin-top: 30px; font-size: 12px;">
                  <div>Received by: <strong>${r.collector_name || 'Bursar Automated Service'}</strong></div>
                  <div style="border-top: 1px solid #0f172a; width: 150px; text-align: center; padding-top: 4px;">Authorized Seal</div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('receiptModal').remove()">Close</button>
              <button class="btn btn-primary" onclick="window.print()">🖨️ Print Receipt</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async showInvoiceModal() {
    const [catsRes, classesRes] = await Promise.all([API.getFeeCategories(), API.getClasses()]);
    const cats = catsRes.data || [];
    const classes = classesRes.data || [];

    const modalHtml = `
      <div class="modal-backdrop open" id="invGenModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Generate Fee Invoices</h3>
            <button class="modal-close" onclick="document.getElementById('invGenModal').remove()">&times;</button>
          </div>
          <form onsubmit="FeesView.submitInvoiceGen(event)">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Billing Target *</label>
                <select name="class_id" class="form-control" required>
                  <option value="">Select Class to Bill...</option>
                  ${classes.map(c => `<option value="${c.id}">${c.name} - ${c.section} (${c.student_count} students)</option>`).join('')}
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Fee Category *</label>
                  <select name="fee_category_id" class="form-control" required onchange="FeesView.onCatChange(this)">
                    ${cats.map(cat => `<option value="${cat.id}" data-amount="${cat.default_amount}">${cat.name} ($${cat.default_amount})</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Amount ($) *</label>
                  <input type="number" step="0.01" name="amount" id="invAmountInput" class="form-control" value="${cats[0]?.default_amount || 2500}" required>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Due Date *</label>
                  <input type="date" name="due_date" class="form-control" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Academic Year *</label>
                  <input type="text" name="academic_year" class="form-control" value="2026-2027" required>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Billing Description / Note</label>
                <input type="text" name="notes" class="form-control" placeholder="e.g. Term 2 Standard Tuition">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('invGenModal').remove()">Cancel</button>
              <button type="submit" class="btn btn-primary">Generate Invoices</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  },

  onCatChange(sel) {
    const opt = sel.options[sel.selectedIndex];
    const amt = opt.getAttribute('data-amount');
    const input = document.getElementById('invAmountInput');
    if (input && amt) input.value = amt;
  },

  async submitInvoiceGen(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    try {
      const res = await API.createInvoices(data);
      if (res.success) {
        App.toast(res.message, 'success');
        document.getElementById('invGenModal')?.remove();
        this.loadStats();
        this.loadInvoices();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  },

  async showCategoryModal() {
    const res = await API.getFeeCategories();
    const cats = res.data || [];

    const modalHtml = `
      <div class="modal-backdrop open" id="feeCatModal" onclick="if(event.target===this) this.remove()">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">Fee Categories & Schedules</h3>
            <button class="modal-close" onclick="document.getElementById('feeCatModal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <table class="table" style="font-size: 13px;">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Default Fee</th>
                  <th>Billing Frequency</th>
                </tr>
              </thead>
              <tbody>
                ${cats.map(c => `
                  <tr>
                    <td><strong>${c.name}</strong><br><small style="color: #64748b;">${c.description || ''}</small></td>
                    <td><strong>$${c.default_amount}</strong></td>
                    <td><span class="badge badge-secondary">${c.frequency}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="document.getElementById('feeCatModal').remove()">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
};
