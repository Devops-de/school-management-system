const rateLimit = require('express-rate-limit');
const config = require('../config');

// Standard API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP address. Please try again after 15 minutes.'
  }
});

// Strict Rate Limiter for Authentication endpoints (prevent brute-force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many failed login attempts. Account temporarily throttled for security. Please try again in 15 minutes.'
  }
});

// Operational limiter for heavy operations (backups, report card bulk generation)
const heavyOpsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    message: 'Rate limit exceeded for resource-intensive operations. Please wait a moment.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  heavyOpsLimiter
};
