const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/fees/categories
router.get('/categories', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const categories = db.prepare('SELECT * FROM fee_categories ORDER BY name ASC').all();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

// POST /api/fees/categories
router.post('/categories', authenticate, requireRoles('admin', 'accountant'), (req, res, next) => {
  try {
    const { name, description, default_amount, frequency } = req.body;
    if (!name || default_amount === undefined) {
      return res.status(400).json({ success: false, message: 'Fee name and default amount are required.' });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO fee_categories (id, name, description, default_amount, frequency)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description || null, default_amount, frequency || 'Term');

    res.status(201).json({ success: true, message: 'Fee category created.', data: { id } });
  } catch (error) {
    next(error);
  }
});

// GET /api/fees/invoices - Filter invoices
router.get('/invoices', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { student_id, status, class_id } = req.query;

    let query = `
      SELECT fi.*, 
             s.admission_number, s.first_name, s.last_name,
             c.name as class_name, c.section,
             fc.name as category_name,
             COALESCE((SELECT SUM(fp.amount_paid) FROM fee_payments fp WHERE fp.invoice_id = fi.id), 0) as paid_amount
      FROM fee_invoices fi
      JOIN students s ON fi.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      JOIN fee_categories fc ON fi.fee_category_id = fc.id
      WHERE 1=1
    `;
    const params = [];

    if (student_id) {
      query += ' AND fi.student_id = ?';
      params.push(student_id);
    }
    if (status) {
      query += ' AND fi.status = ?';
      params.push(status);
    }
    if (class_id) {
      query += ' AND s.class_id = ?';
      params.push(class_id);
    }

    query += ' ORDER BY fi.created_at DESC';

    const invoices = db.prepare(query).all(...params);

    // Compute remaining balance
    const enriched = invoices.map(inv => ({
      ...inv,
      balance_due: Math.max(0, inv.amount - inv.paid_amount)
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    next(error);
  }
});

// POST /api/fees/invoices - Create invoice (Individual or Class-wide bulk)
router.post('/invoices', authenticate, requireRoles('admin', 'accountant'), (req, res, next) => {
  try {
    const { student_id, class_id, fee_category_id, amount, due_date, academic_year, notes } = req.body;

    if (!fee_category_id || !amount || !due_date || !academic_year) {
      return res.status(400).json({ success: false, message: 'Fee category, amount, due date, and academic year are required.' });
    }

    const db = getDb();
    let targetStudents = [];

    if (student_id) {
      targetStudents.push(student_id);
    } else if (class_id) {
      const studs = db.prepare("SELECT id FROM students WHERE class_id = ? AND status = 'Active'").all(class_id);
      targetStudents = studs.map(s => s.id);
    } else {
      return res.status(400).json({ success: false, message: 'Please specify either a student or a class.' });
    }

    const insertInvoice = db.prepare(`
      INSERT INTO fee_invoices (id, invoice_number, student_id, fee_category_id, amount, due_date, status, academic_year, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
    `);

    let count = 0;
    const invTxn = db.transaction(() => {
      const yearPrefix = new Date().getFullYear();
      for (const stId of targetStudents) {
        const invId = uuidv4();
        const invNum = `INV-${yearPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;
        insertInvoice.run(invId, invNum, stId, fee_category_id, amount, due_date, academic_year, notes || null);
        count++;
      }

      logAuditAction({
        userId: req.user.id,
        action: 'GENERATE_INVOICES',
        entity: 'FeeInvoice',
        newValues: { totalGenerated: count, amount, fee_category_id },
        req
      });
    });

    invTxn();

    res.status(201).json({
      success: true,
      message: `Successfully generated ${count} invoice(s).`
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/fees/pay - Record payment with double-entry consistency
router.post('/pay', authenticate, requireRoles('admin', 'accountant'), (req, res, next) => {
  try {
    const { invoice_id, amount_paid, payment_method, transaction_id, notes } = req.body;
    const paymentAmount = parseFloat(amount_paid);

    if (!invoice_id || isNaN(paymentAmount) || paymentAmount <= 0 || !payment_method) {
      return res.status(400).json({ success: false, message: 'Valid invoice ID, payment amount, and payment method are required.' });
    }

    const db = getDb();
    let paymentRecord = null;

    // Execute atomic payment transaction
    const payTxn = db.transaction(() => {
      const invoice = db.prepare('SELECT * FROM fee_invoices WHERE id = ?').get(invoice_id);
      if (!invoice) {
        throw new Error('Invoice not found.');
      }

      const totalAlreadyPaid = db.prepare(`
        SELECT COALESCE(SUM(amount_paid), 0) as total FROM fee_payments WHERE invoice_id = ?
      `).get(invoice_id).total;

      const remainingBalance = invoice.amount - totalAlreadyPaid;
      if (paymentAmount > remainingBalance) {
        throw new Error(`Payment amount ($${paymentAmount}) exceeds invoice balance due ($${remainingBalance}).`);
      }

      const paymentId = uuidv4();
      const paymentRef = `PAY-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const today = new Date().toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO fee_payments (id, payment_reference, invoice_id, amount_paid, payment_date, payment_method, transaction_id, notes, received_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(paymentId, paymentRef, invoice_id, paymentAmount, today, payment_method, transaction_id || null, notes || null, req.user.id);

      // Recalculate status
      const newTotalPaid = totalAlreadyPaid + paymentAmount;
      const newStatus = (newTotalPaid >= invoice.amount) ? 'Paid' : 'Partial';

      db.prepare('UPDATE fee_invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, invoice_id);

      paymentRecord = {
        id: paymentId,
        paymentReference: paymentRef,
        amountPaid: paymentAmount,
        date: today,
        newStatus,
        newBalanceDue: invoice.amount - newTotalPaid
      };

      logAuditAction({
        userId: req.user.id,
        action: 'PROCESS_FEE_PAYMENT',
        entity: 'FeePayment',
        entityId: paymentId,
        newValues: { paymentRef, paymentAmount, invoice_id, newStatus },
        req
      });
    });

    payTxn();

    res.json({
      success: true,
      message: `Payment of $${paymentAmount} processed successfully.`,
      data: paymentRecord
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/fees/receipt/:paymentId - Official receipt
router.get('/receipt/:paymentId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const receipt = db.prepare(`
      SELECT fp.*,
             fi.invoice_number, fi.amount as invoice_total, fi.academic_year,
             fc.name as fee_category_name,
             s.admission_number, s.first_name, s.last_name,
             c.name as class_name, c.section,
             u.full_name as collector_name
      FROM fee_payments fp
      JOIN fee_invoices fi ON fp.invoice_id = fi.id
      JOIN fee_categories fc ON fi.fee_category_id = fc.id
      JOIN students s ON fi.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN users u ON fp.received_by = u.id
      WHERE fp.id = ?
    `).get(req.params.paymentId);

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Payment receipt not found.' });
    }

    res.json({ success: true, data: receipt });
  } catch (error) {
    next(error);
  }
});

// GET /api/fees/stats - Financial overview
router.get('/stats', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT fi.id) as total_invoices,
        COALESCE(SUM(fi.amount), 0) as total_invoiced,
        COALESCE((SELECT SUM(amount_paid) FROM fee_payments), 0) as total_collected,
        SUM(CASE WHEN fi.status = 'Paid' THEN 1 ELSE 0 END) as count_paid,
        SUM(CASE WHEN fi.status = 'Partial' THEN 1 ELSE 0 END) as count_partial,
        SUM(CASE WHEN fi.status = 'Pending' THEN 1 ELSE 0 END) as count_pending,
        SUM(CASE WHEN fi.status = 'Overdue' THEN 1 ELSE 0 END) as count_overdue
      FROM fee_invoices fi
    `).get();

    const outstanding = Math.max(0, stats.total_invoiced - stats.total_collected);
    const collectionRate = stats.total_invoiced > 0
      ? Math.round((stats.total_collected / stats.total_invoiced) * 100)
      : 100;

    res.json({
      success: true,
      data: {
        ...stats,
        outstanding,
        collectionRate
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
