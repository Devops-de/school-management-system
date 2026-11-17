const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const config = require('./config');
const { initDatabase, closeDatabase } = require('./database/db');
const { initializeSchema } = require('./database/schema');
const { seedData } = require('./database/seed');
const { startBackupScheduler, stopBackupScheduler } = require('./database/backupService');

// Middleware
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const classRoutes = require('./routes/classRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const examRoutes = require('./routes/examRoutes');
const feeRoutes = require('./routes/feeRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const auditRoutes = require('./routes/auditRoutes');
const systemRoutes = require('./routes/systemRoutes');

const app = express();

// 1. Security Headers via Helmet (with relaxed CSP for modern UI assets & CDNs)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://ui-avatars.com"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// 2. CORS & Parsing
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 3. Request Logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

// 4. Rate Limiting for API routes
app.use('/api', apiLimiter);

// 5. Static Files (Frontend UI)
app.use(express.static(path.join(__dirname, 'public')));

// 6. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/system', systemRoutes);

// 7. Single Page Application (SPA) fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: `Endpoint ${req.method} ${req.path} not found.` });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 8. Global Fault-Tolerant Error Handling
app.use(errorHandler);

// Server startup and graceful termination
let serverInstance = null;

function startServer(port = config.PORT) {
  // Ensure DB & Schema are initialized
  initDatabase();
  initializeSchema();
  seedData().catch(err => console.error('[Startup] Seed check error:', err.message));

  // Start background backup scheduler
  startBackupScheduler();

  serverInstance = app.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`  VANGUARD SCHOOL MANAGEMENT SYSTEM (Production Grade)  `);
    console.log(`  PID: ${process.pid} | Environment: ${config.NODE_ENV} `);
    console.log(`  Live URL: http://localhost:${port}                    `);
    console.log(`=======================================================`);
  });

  return serverInstance;
}

// Graceful Shutdown Handler for High Availability
function gracefulShutdown(signal) {
  console.log(`\n[Shutdown] Received ${signal}. Initiating graceful shutdown...`);
  stopBackupScheduler();

  if (serverInstance) {
    serverInstance.close(() => {
      console.log('[Shutdown] Closed remaining active HTTP connections.');
      closeDatabase();
      console.log('[Shutdown] High availability process exited cleanly.');
      process.exit(0);
    });

    // Force exit after 10s if connections refuse to drain
    setTimeout(() => {
      console.error('[Shutdown] Forcefully terminating after timeout.');
      closeDatabase();
      process.exit(1);
    }, 10000).unref();
  } else {
    closeDatabase();
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FaultTolerance] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[FaultTolerance] Uncaught Exception:', error);
  // Allow cluster supervisor to revive this worker if fatal
  if (config.NODE_ENV === 'production') {
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  }
});

// Direct execution
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
