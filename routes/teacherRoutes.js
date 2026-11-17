const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/teachers - List all teachers
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const teachers = db.prepare(`
      SELECT t.*, u.email, u.username, u.phone, u.status as account_status,
             (
               SELECT GROUP_CONCAT(s.name, ', ') 
               FROM class_subjects cs 
               JOIN subjects s ON cs.subject_id = s.id 
               WHERE cs.teacher_id = t.user_id
             ) as subjects_taught,
             (
               SELECT GROUP_CONCAT(c.name || ' ' || c.section, ', ')
               FROM classes c
               WHERE c.class_teacher_id = t.user_id
             ) as assigned_classes
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      ORDER BY t.first_name ASC
    `).all();

    res.json({ success: true, data: teachers });
  } catch (error) {
    next(error);
  }
});

// GET /api/teachers/:id
router.get('/:id', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const teacher = db.prepare(`
      SELECT t.*, u.email, u.username, u.phone, u.status as account_status
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }

    // Get subjects & classes taught
    const schedule = db.prepare(`
      SELECT cs.id, c.name as class_name, c.section, s.name as subject_name, s.code
      FROM class_subjects cs
      JOIN classes c ON cs.class_id = c.id
      JOIN subjects s ON cs.subject_id = s.id
      WHERE cs.teacher_id = ?
    `).all(teacher.user_id);

    res.json({
      success: true,
      data: {
        ...teacher,
        schedule
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/teachers - Add new teacher & create login account atomically
router.post('/', authenticate, requireRoles('admin'), async (req, res, next) => {
  try {
    const {
      first_name, last_name, email, phone, employee_id,
      qualification, department, designation, joining_date, salary, password
    } = req.body;

    if (!first_name || !last_name || !email || !qualification || !department) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, qualification, and department are required.' });
    }

    const db = getDb();
    const userId = uuidv4();
    const teacherId = uuidv4();
    const empId = employee_id || `EMP-${Date.now().toString().slice(-4)}`;
    const username = email.split('@')[0] + Math.floor(Math.random() * 100);
    const passwordHash = await bcrypt.hash(password || 'Teacher@123', 10);

    const createTeacherTxn = db.transaction(() => {
      // 1. Create User
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status)
        VALUES (?, ?, ?, ?, 'teacher', ?, ?, 'active')
      `).run(userId, username, email.toLowerCase(), passwordHash, `${first_name} ${last_name}`, phone || null);

      // 2. Create Teacher
      db.prepare(`
        INSERT INTO teachers (id, user_id, employee_id, first_name, last_name, qualification, department, designation, joining_date, salary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        teacherId, userId, empId, first_name, last_name,
        qualification, department, designation || 'Instructor',
        joining_date || new Date().toISOString().split('T')[0],
        salary || 0.0
      );

      logAuditAction({
        userId: req.user.id,
        action: 'CREATE_TEACHER',
        entity: 'Teacher',
        entityId: teacherId,
        newValues: { empId, first_name, last_name, department },
        req
      });
    });

    createTeacherTxn();

    res.status(201).json({
      success: true,
      message: 'Teacher profile and credentials created successfully.',
      data: { id: teacherId, employee_id: empId, username, email }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
