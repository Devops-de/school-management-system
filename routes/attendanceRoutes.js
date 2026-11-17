const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/attendance - Fetch attendance records for a class on a date
router.get('/', authenticate, (req, res, next) => {
  try {
    const { class_id, date } = req.query;
    if (!class_id || !date) {
      return res.status(400).json({ success: false, message: 'Class ID and date are required.' });
    }

    const db = getDb();

    // Query all active students in class along with their attendance for this date (if recorded)
    const records = db.prepare(`
      SELECT s.id as student_id, s.admission_number, s.first_name, s.last_name, s.gender,
             a.id as attendance_id, a.status, a.remarks, a.recorded_by, u.full_name as recorder_name
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
      LEFT JOIN users u ON a.recorded_by = u.id
      WHERE s.class_id = ? AND s.status = 'Active'
      ORDER BY s.admission_number ASC
    `).all(date, class_id);

    res.json({ success: true, data: records, date, class_id });
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/bulk - Record or update attendance for students in ACID transaction
router.post('/bulk', authenticate, requireRoles('admin', 'teacher'), (req, res, next) => {
  try {
    const { class_id, date, records } = req.body;
    // records: [ { student_id, status: 'Present'|'Absent'|'Late'|'Excused', remarks } ]

    if (!class_id || !date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'Class ID, date, and student attendance records are required.' });
    }

    const db = getDb();
    const recordedBy = req.user.id;

    const upsertStmt = db.prepare(`
      INSERT INTO attendance (id, student_id, class_id, date, status, remarks, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(student_id, date) DO UPDATE SET
        status = excluded.status,
        remarks = excluded.remarks,
        recorded_by = excluded.recorded_by
    `);

    // ACID Transaction guarantees zero inconsistency
    const attendanceTxn = db.transaction(() => {
      for (const rec of records) {
        if (!['Present', 'Absent', 'Late', 'Excused'].includes(rec.status)) {
          throw new Error(`Invalid attendance status: ${rec.status} for student ${rec.student_id}`);
        }
        upsertStmt.run(
          uuidv4(),
          rec.student_id,
          class_id,
          date,
          rec.status,
          rec.remarks || null,
          recordedBy
        );
      }

      logAuditAction({
        userId: req.user.id,
        action: 'MARK_ATTENDANCE',
        entity: 'Attendance',
        entityId: `${class_id}_${date}`,
        newValues: { studentCount: records.length, date, class_id },
        req
      });
    });

    attendanceTxn();

    res.json({
      success: true,
      message: `Successfully processed attendance for ${records.length} students on ${date}.`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/stats - School-wide daily and monthly statistics
router.get('/stats', authenticate, (req, res, next) => {
  try {
    const db = getDb();

    // Today's summary
    const today = new Date().toISOString().split('T')[0];
    const todayStats = db.prepare(`
      SELECT 
        COUNT(*) as total_recorded,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) as excused
      FROM attendance
      WHERE date = ?
    `).get(today);

    // Recent 7 days trend
    const trends = db.prepare(`
      SELECT date,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
             SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
             SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late
      FROM attendance
      GROUP BY date
      ORDER BY date DESC
      LIMIT 10
    `).all();

    // At-Risk Attendance Alerts (Students with attendance < 75%)
    const atRiskStudents = db.prepare(`
      SELECT s.id, s.admission_number, s.first_name, s.last_name, c.name as class_name, c.section,
             COUNT(a.id) as total_days,
             SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_days,
             ROUND((CAST(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS REAL) / COUNT(a.id)) * 100, 1) as percentage
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN attendance a ON s.id = a.student_id
      WHERE s.status = 'Active'
      GROUP BY s.id
      HAVING total_days >= 5 AND percentage < 75.0
      ORDER BY percentage ASC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        today: todayStats,
        trends: trends.reverse(),
        atRiskStudents
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/student/:studentId
router.get('/student/:studentId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const records = db.prepare(`
      SELECT date, status, remarks, created_at
      FROM attendance
      WHERE student_id = ?
      ORDER BY date DESC LIMIT 60
    `).all(req.params.studentId);

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN status = 'Excused' THEN 1 ELSE 0 END) as excused
      FROM attendance
      WHERE student_id = ?
    `).get(req.params.studentId);

    const rate = stats.total > 0
      ? Math.round(((stats.present + stats.late * 0.5) / stats.total) * 100)
      : 100;

    res.json({
      success: true,
      data: {
        records,
        stats: { ...stats, rate }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
