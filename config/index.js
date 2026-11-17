require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'production',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secure-school-management-jwt-secret-key-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'school.db'),
  BACKUP_DIR: process.env.BACKUP_DIR || path.join(__dirname, '..', 'data', 'backups'),
  BACKUP_INTERVAL_MINUTES: parseInt(process.env.BACKUP_INTERVAL_MINUTES || '30', 10),
  MAX_WORKERS: parseInt(process.env.MAX_WORKERS || '2', 10),
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 500, // 500 requests per window
  AUTH_RATE_LIMIT_MAX: 20 // 20 login attempts per window
};
