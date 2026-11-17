const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

function computeGradeAndPoints(percentage) {
  if (percentage >= 90) return { grade: 'A+', points: 4.0, remarks: 'Outstanding Academic Excellence' };
  if (percentage >= 80) return { grade: 'A', points: 3.7, remarks: 'Very Good' };
  if (percentage >= 70) return { grade: 'B', points: 3.0, remarks: 'Good Mastery' };
  if (percentage >= 60) return { grade: 'C', points: 2.0, remarks: 'Satisfactory' };
  if (percentage >= 50) return { grade: 'D', points: 1.0, remarks: 'Needs Improvement' };
  return { grade: 'F', points: 0.0, remarks: 'Unsatisfactory - Academic Intervention Required' };
}

// GET /api/exams - List all exams
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const exams = db.prepare(`
      SELECT e.*,
             (SELECT COUNT(*) FROM exam_schedules es WHERE es.exam_id = e.id) as total_schedules
      FROM exams e
      ORDER BY e.start_date DESC
    `).all();

    res.json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
});

// POST /api/exams - Create exam term
router.post('/', authenticate, requireRoles('admin'), (req, res, next) => {
  try {
    const { name, term, academic_year, start_date, end_date, status } = req.body;
    if (!name || !term || !academic_year || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'All exam details are required.' });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO exams (id, name, term, academic_year, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, term, academic_year, start_date, end_date, status || 'Upcoming');

    logAuditAction({
      userId: req.user.id,
      action: 'CREATE_EXAM',
      entity: 'Exam',
      entityId: id,
      newValues: req.body,
      req
    });

    res.status(201).json({ success: true, message: 'Exam term created.', data: { id } });
  } catch (error) {
    next(error);
  }
});

// GET /api/exams/:id/schedules - Schedules for an exam
router.get('/:id/schedules', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const schedules = db.prepare(`
      SELECT es.*, 
             c.name as class_name, c.section,
             s.name as subject_name, s.code as subject_code,
             (SELECT COUNT(*) FROM exam_results er WHERE er.exam_schedule_id = es.id) as graded_count,
             (SELECT COUNT(*) FROM students stu WHERE stu.class_id = es.class_id AND stu.status = 'Active') as total_students
      FROM exam_schedules es
      JOIN classes c ON es.class_id = c.id
      JOIN subjects s ON es.subject_id = s.id
      WHERE es.exam_id = ?
      ORDER BY es.exam_date ASC, es.start_time ASC
    `).all(req.params.id);

    res.json({ success: true, data: schedules });
  } catch (error) {
    next(error);
  }
});

// POST /api/exams/:id/schedules - Add exam schedule
router.post('/:id/schedules', authenticate, requireRoles('admin', 'teacher'), (req, res, next) => {
  try {
    const { class_id, subject_id, exam_date, start_time, end_time, max_marks, pass_marks } = req.body;
    if (!class_id || !subject_id || !exam_date || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'All schedule fields are required.' });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO exam_schedules (id, exam_id, class_id, subject_id, exam_date, start_time, end_time, max_marks, pass_marks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, class_id, subject_id, exam_date, start_time, end_time, max_marks || 100, pass_marks || 40);

    res.status(201).json({ success: true, message: 'Exam scheduled successfully.', data: { id } });
  } catch (error) {
    next(error);
  }
});

// GET /api/exams/schedule/:scheduleId/marks - Get marks sheet for students in a scheduled exam
router.get('/schedule/:scheduleId/marks', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const schedule = db.prepare(`
      SELECT es.*, c.name as class_name, c.section, s.name as subject_name, s.code, e.name as exam_name
      FROM exam_schedules es
      JOIN classes c ON es.class_id = c.id
      JOIN subjects s ON es.subject_id = s.id
      JOIN exams e ON es.exam_id = e.id
      WHERE es.id = ?
    `).get(req.params.scheduleId);

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Exam schedule not found.' });
    }

    const marks = db.prepare(`
      SELECT stu.id as student_id, stu.admission_number, stu.first_name, stu.last_name,
             er.id as result_id, er.marks_obtained, er.grade, er.remarks
      FROM students stu
      LEFT JOIN exam_results er ON er.student_id = stu.id AND er.exam_schedule_id = ?
      WHERE stu.class_id = ? AND stu.status = 'Active'
      ORDER BY stu.admission_number ASC
    `).all(req.params.scheduleId, schedule.class_id);

    res.json({
      success: true,
      schedule,
      marks
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/exams/schedule/:scheduleId/marks - Bulk marks entry in transaction
router.post('/schedule/:scheduleId/marks', authenticate, requireRoles('admin', 'teacher'), (req, res, next) => {
  try {
    const { results } = req.body; // array of { student_id, marks_obtained, remarks }
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ success: false, message: 'Marks results array is required.' });
    }

    const db = getDb();
    const schedule = db.prepare('SELECT max_marks, pass_marks FROM exam_schedules WHERE id = ?').get(req.params.scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Exam schedule not found.' });
    }

    const upsertMarks = db.prepare(`
      INSERT INTO exam_results (id, exam_schedule_id, student_id, marks_obtained, grade, remarks, recorded_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(exam_schedule_id, student_id) DO UPDATE SET
        marks_obtained = excluded.marks_obtained,
        grade = excluded.grade,
        remarks = excluded.remarks,
        recorded_by = excluded.recorded_by,
        updated_at = CURRENT_TIMESTAMP
    `);

    const marksTxn = db.transaction(() => {
      for (const item of results) {
        const marks = parseFloat(item.marks_obtained);
        if (isNaN(marks) || marks < 0 || marks > schedule.max_marks) {
          throw new Error(`Invalid marks value: ${item.marks_obtained}. Must be between 0 and ${schedule.max_marks}.`);
        }

        const percentage = (marks / schedule.max_marks) * 100;
        const evaluation = computeGradeAndPoints(percentage);

        upsertMarks.run(
          uuidv4(),
          req.params.scheduleId,
          item.student_id,
          marks,
          evaluation.grade,
          item.remarks || evaluation.remarks,
          req.user.id
        );
      }

      logAuditAction({
        userId: req.user.id,
        action: 'SUBMIT_EXAM_MARKS',
        entity: 'ExamSchedule',
        entityId: req.params.scheduleId,
        newValues: { count: results.length },
        req
      });
    });

    marksTxn();

    res.json({ success: true, message: `Successfully updated marks for ${results.length} students.` });
  } catch (error) {
    next(error);
  }
});

// GET /api/exams/report-card/:studentId/:examId - Official student transcript & report card
router.get('/report-card/:studentId/:examId', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const { studentId, examId } = req.params;

    const student = db.prepare(`
      SELECT s.*, c.name as class_name, c.section, c.academic_year,
             p.full_name as parent_name, p.phone as parent_phone
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN parents p ON s.parent_id = p.id
      WHERE s.id = ?
    `).get(studentId);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found.' });
    }

    // Get all subject grades for this student and exam
    const subjectsGrades = db.prepare(`
      SELECT s.name as subject_name, s.code as subject_code, s.credits,
             es.max_marks, es.pass_marks,
             er.marks_obtained, er.grade, er.remarks
      FROM exam_results er
      JOIN exam_schedules es ON er.exam_schedule_id = es.id
      JOIN subjects s ON es.subject_id = s.id
      WHERE er.student_id = ? AND es.exam_id = ?
      ORDER BY s.name ASC
    `).all(studentId, examId);

    if (subjectsGrades.length === 0) {
      return res.status(404).json({ success: false, message: 'No graded results found for this exam.' });
    }

    let totalMax = 0;
    let totalObtained = 0;
    let totalCreditPoints = 0;
    let totalCredits = 0;

    subjectsGrades.forEach(sg => {
      totalMax += sg.max_marks;
      totalObtained += sg.marks_obtained;
      const pct = (sg.marks_obtained / sg.max_marks) * 100;
      const evalItem = computeGradeAndPoints(pct);
      const credits = sg.credits || 3;
      totalCreditPoints += evalItem.points * credits;
      totalCredits += credits;
    });

    const overallPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const gpa = totalCredits > 0 ? (totalCreditPoints / totalCredits).toFixed(2) : '0.00';
    const overall = computeGradeAndPoints(overallPercentage);

    // Compute Class Rank
    const rankQuery = db.prepare(`
      SELECT er.student_id, SUM(er.marks_obtained) as total_marks
      FROM exam_results er
      JOIN exam_schedules es ON er.exam_schedule_id = es.id
      WHERE es.exam_id = ? AND es.class_id = ?
      GROUP BY er.student_id
      ORDER BY total_marks DESC
    `).all(examId, student.class_id);

    const rankIndex = rankQuery.findIndex(r => r.student_id === studentId);
    const rank = rankIndex !== -1 ? rankIndex + 1 : 'N/A';
    const totalInClass = rankQuery.length;

    res.json({
      success: true,
      data: {
        school: {
          name: 'The Vanguard International Academy',
          motto: 'Excellence, Integrity, Innovation',
          accreditation: 'Global Baccalaureate Accredited'
        },
        student,
        exam,
        subjects: subjectsGrades,
        summary: {
          totalMarksObtained: totalObtained,
          maximumPossibleMarks: totalMax,
          percentage: overallPercentage.toFixed(1),
          gpa,
          overallGrade: overall.grade,
          remarks: overall.remarks,
          classRank: `${rank} of ${totalInClass}`
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
