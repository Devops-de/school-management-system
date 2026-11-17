const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/classes - List all classes with student counts
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const classes = db.prepare(`
      SELECT c.*,
             u.full_name as class_teacher_name,
             (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'Active') as student_count
      FROM classes c
      LEFT JOIN users u ON c.class_teacher_id = u.id
      ORDER BY c.grade_level ASC, c.section ASC
    `).all();

    res.json({ success: true, data: classes });
  } catch (error) {
    next(error);
  }
});

// GET /api/classes/:id - Class details with subjects and roster
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const classInfo = db.prepare(`
      SELECT c.*, u.full_name as class_teacher_name
      FROM classes c
      LEFT JOIN users u ON c.class_teacher_id = u.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!classInfo) {
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }

    const students = db.prepare(`
      SELECT id, admission_number, first_name, last_name, gender, blood_group, status
      FROM students
      WHERE class_id = ?
      ORDER BY first_name ASC
    `).all(req.params.id);

    const subjects = db.prepare(`
      SELECT cs.id as assignment_id, s.id as subject_id, s.name, s.code, s.department, s.credits,
             u.id as teacher_id, u.full_name as teacher_name
      FROM class_subjects cs
      JOIN subjects s ON cs.subject_id = s.id
      LEFT JOIN users u ON cs.teacher_id = u.id
      WHERE cs.class_id = ?
    `).all(req.params.id);

    res.json({
      success: true,
      data: {
        ...classInfo,
        students,
        subjects
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/classes - Create class
router.post('/', authenticate, requireRoles('admin'), (req, res, next) => {
  try {
    const { name, grade_level, section, room_number, academic_year, capacity, class_teacher_id } = req.body;
    if (!name || !grade_level || !section || !academic_year) {
      return res.status(400).json({ success: false, message: 'Name, grade level, section, and academic year are required.' });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO classes (id, name, grade_level, section, room_number, academic_year, capacity, class_teacher_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, grade_level, section, room_number || null, academic_year, capacity || 35, class_teacher_id || null);

    logAuditAction({
      userId: req.user.id,
      action: 'CREATE_CLASS',
      entity: 'Class',
      entityId: id,
      newValues: { name, section, academic_year },
      req
    });

    res.status(201).json({ success: true, message: 'Class created successfully.', data: { id } });
  } catch (error) {
    next(error);
  }
});

// GET /api/classes/subjects/all - List all academic subjects
router.get('/subjects/all', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const subjects = db.prepare('SELECT * FROM subjects ORDER BY department ASC, name ASC').all();
    res.json({ success: true, data: subjects });
  } catch (error) {
    next(error);
  }
});

// POST /api/classes/subjects - Create new subject
router.post('/subjects', authenticate, requireRoles('admin'), (req, res, next) => {
  try {
    const { name, code, department, credits, description } = req.body;
    if (!name || !code || !department) {
      return res.status(400).json({ success: false, message: 'Subject name, code, and department are required.' });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO subjects (id, name, code, department, credits, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, code.toUpperCase(), department, credits || 3, description || null);

    res.status(201).json({ success: true, message: 'Subject created successfully.', data: { id } });
  } catch (error) {
    next(error);
  }
});

// POST /api/classes/:id/assign-subject - Assign subject and teacher to a class
router.post('/:id/assign-subject', authenticate, requireRoles('admin'), (req, res, next) => {
  try {
    const { subject_id, teacher_id } = req.body;
    if (!subject_id) {
      return res.status(400).json({ success: false, message: 'Subject ID is required.' });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO class_subjects (id, class_id, subject_id, teacher_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(class_id, subject_id) DO UPDATE SET teacher_id = excluded.teacher_id
    `).run(id, req.params.id, subject_id, teacher_id || null);

    res.json({ success: true, message: 'Subject assigned to class successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
