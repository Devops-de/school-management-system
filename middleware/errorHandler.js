const config = require('../config');

function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.url} -`, err);

  // Handle SQLite constraint errors gracefully
  if (err.code && err.code.startsWith('SQLITE_CONSTRAINT')) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: A record with these unique details already exists (e.g. duplicate email, admission number, or exam schedule entry).'
      });
    }
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(400).json({
        success: false,
        message: 'Data Integrity Constraint: Referenced parent record does not exist or cannot be modified.'
      });
    }
    if (err.message.includes('CHECK')) {
      return res.status(400).json({
        success: false,
        message: 'Validation Check Failed: Provided field value does not satisfy domain constraints.'
      });
    }
  }

  // Handle JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body.'
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = (statusCode === 500 && config.NODE_ENV === 'production')
    ? 'An internal server error occurred. The incident has been recorded.'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = errorHandler;
