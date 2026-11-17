const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

/**
 * Logs a system or business audit action into the immutable audit_logs table
 */
function logAuditAction({ userId, action, entity, entityId = null, oldValues = null, newValues = null, req = null }) {
  try {
    const db = getDb();
    const id = uuidv4();
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const userAgent = req ? (req.headers['user-agent'] || 'system') : 'system';

    const oldStr = oldValues ? (typeof oldValues === 'string' ? oldValues : JSON.stringify(oldValues)) : null;
    const newStr = newValues ? (typeof newValues === 'string' ? newValues : JSON.stringify(newValues)) : null;

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity, entity_id, old_values, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId || 'system', action, entity, entityId, oldStr, newStr, ipAddress, userAgent);
  } catch (error) {
    console.error('[AuditService] Failed to record audit log:', error.message);
  }
}

module.exports = {
  logAuditAction
};
