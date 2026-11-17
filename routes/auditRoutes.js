const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { authenticate, requireRoles } = require('../middleware/auth');

// GET /api/audit-logs - Security & administrative trace
router.get('/', authenticate, requireRoles('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const { action, limit = 50 } = req.query;

    let query = `
      SELECT a.*, u.full_name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      query += ' AND a.action = ?';
      params.push(action);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = db.prepare(query).all(...params);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
