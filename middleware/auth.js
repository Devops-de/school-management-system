const jwt = require('jsonwebtoken');
const config = require('../config');
const { getDb } = require('../database/db');

function authenticate(req, res, next) {
  let token = null;

  // Extract from Bearer token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.sms_token) {
    // Extract from HttpOnly cookie
    token = req.cookies.sms_token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const db = getDb();
    
    // Validate that user still exists and is active
    const user = db.prepare('SELECT id, username, email, role, full_name, status FROM users WHERE id = ?').get(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User account no longer exists.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'User account is suspended or inactive.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
}

/**
 * Role-Based Access Control (RBAC) middleware
 * @param  {...string} roles Allowed roles ('admin', 'teacher', 'student', 'parent', 'accountant')
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of [${roles.join(', ')}] permissions. Current role: ${req.user.role}`
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRoles
};
