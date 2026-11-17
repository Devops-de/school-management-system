const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { logAuditAction } = require('../middleware/audit');

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and password are required.' });
    }

    const db = getDb();
    const user = db.prepare(`
      SELECT * FROM users WHERE (email = ? OR username = ?) AND status = 'active'
    `).get(login.trim().toLowerCase(), login.trim());

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or inactive account.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      logAuditAction({
        userId: user.id,
        action: 'FAILED_LOGIN_ATTEMPT',
        entity: 'User',
        entityId: user.id,
        req
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    // Set secure cookie
    res.cookie('sms_token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    logAuditAction({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      req
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res, next) => {
  try {
    const db = getDb();
    let additionalInfo = null;

    if (req.user.role === 'student') {
      additionalInfo = db.prepare(`
        SELECT s.*, c.name as class_name, c.section as class_section
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE s.user_id = ?
      `).get(req.user.id);
    } else if (req.user.role === 'teacher') {
      additionalInfo = db.prepare(`
        SELECT * FROM teachers WHERE user_id = ?
      `).get(req.user.id);
    } else if (req.user.role === 'parent') {
      const parent = db.prepare('SELECT * FROM parents WHERE user_id = ?').get(req.user.id);
      let wards = [];
      if (parent) {
        wards = db.prepare(`
          SELECT s.*, c.name as class_name, c.section as class_section
          FROM students s
          LEFT JOIN classes c ON s.class_id = c.id
          WHERE s.parent_id = ?
        `).all(parent.id);
      }
      additionalInfo = { parent, wards };
    }

    res.json({
      success: true,
      user: req.user,
      profile: additionalInfo
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user.id);

    logAuditAction({
      userId: req.user.id,
      action: 'PASSWORD_CHANGE',
      entity: 'User',
      entityId: req.user.id,
      req
    });

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('sms_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
