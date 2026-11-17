const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/students - List students with filter & search
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { class_id, status, search, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT s.*, 
             c.name as class_name, c.section as class_section,
             p.full_name as parent_name, p.phone as parent_phone
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN parents p ON s.parent_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (class_id) {
      query += ' AND s.class_id = ?';
      params.push(class_id);
    }

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY s.admission_number ASC';

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    query += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    const students = db.prepare(query).all(...params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM students s WHERE 1=1';
    const countParams = [];
    if (class_id) { countQuery += ' AND s.class_id = ?'; countParams.push(class_id); }
    if (status) { countQuery += ' AND s.status = ?'; countParams.push(status); }
    if (search) {
      countQuery += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)';
      const term = `%${search}%`;
      countParams.push(term, term, term);
    }
    const total = db.prepare(countQuery).get(...countParams).total;

    res.json({
      success: true,
      data: students,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/students/:id - Detailed student profile
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const student = db.prepare(`
      SELECT s.*, 
             c.name as class_name, c.section as class_section, c.room_number,
             p.full_name as parent_name, p.phone as parent_phone, p.email as parent_email, p.relationship, p.occupation,
             u.username, u.email as user_email
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN parents p ON s.parent_id = p.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Calculate attendance percentage
    const attStats = db.prepare(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_days
      FROM attendance
      WHERE student_id = ?
    `).get(student.id);

    const attendanceRate = attStats.total_days > 0
      ? Math.round(((attStats.present_days + attStats.late_days * 0.5) / attStats.total_days) * 100)
      : 100;

    // Get recent exam scores
    const examResults = db.prepare(`
      SELECT er.marks_obtained, er.grade, er.remarks,
             s.name as subject_name, s.code as subject_code,
             e.name as exam_name, es.max_marks
      FROM exam_results er
      JOIN exam_schedules es ON er.exam_schedule_id = es.id
      JOIN subjects s ON es.subject_id = s.id
      JOIN exams e ON es.exam_id = e.id
      WHERE er.student_id = ?
      ORDER BY es.exam_date DESC LIMIT 5
    `).all(student.id);

    // Get fee status summary
    const feeSummary = db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_invoiced,
        COALESCE((
          SELECT SUM(amount_paid) 
          FROM fee_payments fp 
          JOIN fee_invoices fi ON fp.invoice_id = fi.id 
          WHERE fi.student_id = ?
        ), 0) as total_paid
      FROM fee_invoices
      WHERE student_id = ?
    `).get(student.id, student.id);

    res.json({
      success: true,
      data: {
        ...student,
        attendance: {
          rate: attendanceRate,
          total: attStats.total_days,
          present: attStats.present_days,
          absent: attStats.absent_days,
          late: attStats.late_days
        },
        recentExams: examResults,
        financials: {
          totalInvoiced: feeSummary.total_invoiced,
          totalPaid: feeSummary.total_paid,
          balanceDue: Math.max(0, feeSummary.total_invoiced - feeSummary.total_paid)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/students - Enroll new student (ACID Transaction)
router.post('/', authenticate, requireRoles('admin', 'teacher'), (req, res, next) => {
  try {
    const {
      first_name, last_name, date_of_birth, gender, blood_group,
      class_id, parent_name, parent_phone, parent_email, parent_relationship,
      address, emergency_contact, medical_notes, enrollment_date
    } = req.body;

    if (!first_name || !last_name || !date_of_birth || !gender || !class_id) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, date of birth, gender, and class are required.'
      });
    }

    const db = getDb();
    const studentId = uuidv4();
    let parentId = null;

    // Generate admission number: ADM-2026-XXXX
    const latestAdm = db.prepare('SELECT admission_number FROM students ORDER BY created_at DESC LIMIT 1').get();
    let nextNum = 1;
    if (latestAdm && latestAdm.admission_number) {
      const parts = latestAdm.admission_number.split('-');
      if (parts.length === 3) {
        nextNum = parseInt(parts[2], 10) + 1;
      }
    }
    const admission_number = `ADM-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;

    // Transaction execution
    const enrollTxn = db.transaction(() => {
      // Check / Create Parent if details provided
      if (parent_name && parent_phone) {
        parentId = uuidv4();
        db.prepare(`
          INSERT INTO parents (id, full_name, relationship, phone, email, address)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(parentId, parent_name, parent_relationship || 'Parent', parent_phone, parent_email || null, address || null);
      }

      // Insert Student
      db.prepare(`
        INSERT INTO students (
          id, admission_number, first_name, last_name, date_of_birth, gender,
          blood_group, class_id, parent_id, address, emergency_contact,
          medical_notes, enrollment_date, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
      `).run(
        studentId, admission_number, first_name, last_name, date_of_birth, gender,
        blood_group || null, class_id, parentId, address || null, emergency_contact || parent_phone || null,
        medical_notes || null, enrollment_date || new Date().toISOString().split('T')[0]
      );

      logAuditAction({
        userId: req.user.id,
        action: 'ENROLL_STUDENT',
        entity: 'Student',
        entityId: studentId,
        newValues: { admission_number, first_name, last_name, class_id },
        req
      });
    });

    enrollTxn();

    res.status(201).json({
      success: true,
      message: `Student enrolled successfully with Admission Number ${admission_number}`,
      data: { id: studentId, admission_number }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/students/:id - Update student information
router.put('/:id', authenticate, requireRoles('admin', 'teacher'), (req, res, next) => {
  try {
    const {
      first_name, last_name, date_of_birth, gender, blood_group,
      class_id, address, emergency_contact, medical_notes, status
    } = req.body;

    const db = getDb();
    const existing = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    db.prepare(`
      UPDATE students SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        date_of_birth = COALESCE(?, date_of_birth),
        gender = COALESCE(?, gender),
        blood_group = COALESCE(?, blood_group),
        class_id = COALESCE(?, class_id),
        address = COALESCE(?, address),
        emergency_contact = COALESCE(?, emergency_contact),
        medical_notes = COALESCE(?, medical_notes),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      first_name, last_name, date_of_birth, gender, blood_group,
      class_id, address, emergency_contact, medical_notes, status, req.params.id
    );

    logAuditAction({
      userId: req.user.id,
      action: 'UPDATE_STUDENT',
      entity: 'Student',
      entityId: req.params.id,
      oldValues: existing,
      newValues: req.body,
      req
    });

    res.json({ success: true, message: 'Student details updated successfully.' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/students/:id - Soft delete / withdraw
router.delete('/:id', authenticate, requireRoles('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    db.prepare("UPDATE students SET status = 'Withdrawn', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

    logAuditAction({
      userId: req.user.id,
      action: 'WITHDRAW_STUDENT',
      entity: 'Student',
      entityId: req.params.id,
      req
    });

    res.json({ success: true, message: 'Student status updated to Withdrawn.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
