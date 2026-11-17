const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/notices - List notices accessible to current user
router.get('/', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    const role = req.user.role;

    let roleFilter = "target_role = 'All'";
    if (role === 'teacher') roleFilter += " OR target_role = 'Teachers'";
    if (role === 'parent')  roleFilter += " OR target_role = 'Parents'";
    if (role === 'student') roleFilter += " OR target_role = 'Students'";
    if (role === 'admin')   roleFilter = "1=1"; // Admin sees all

    const notices = db.prepare(`
      SELECT n.*, u.full_name as author_name, u.role as author_role
      FROM notices n
      LEFT JOIN users u ON n.author_id = u.id
      WHERE (${roleFilter})
      ORDER BY n.is_pinned DESC, n.created_at DESC
    `).all();

    res.json({ success: true, data: notices });
  } catch (error) {
    next(error);
  }
});

// POST /api/notices - Post new notice
router.post('/', authenticate, requireRoles('admin', 'teacher'), (req, res, next) => {
  try {
    const { title, content, priority, target_role, is_pinned, expires_at } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Notice title and content are required.' });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO notices (id, title, content, priority, target_role, author_id, is_pinned, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, title, content,
      priority || 'Normal',
      target_role || 'All',
      req.user.id,
      is_pinned ? 1 : 0,
      expires_at || null
    );

    logAuditAction({
      userId: req.user.id,
      action: 'POST_NOTICE',
      entity: 'Notice',
      entityId: id,
      newValues: { title, priority, target_role },
      req
    });

    res.status(201).json({ success: true, message: 'Notice published.', data: { id } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/notices/:id
router.delete('/:id', authenticate, requireRoles('admin'), (req, res, next) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM notices WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Notice removed.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
