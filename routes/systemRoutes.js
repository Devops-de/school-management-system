const express = require('express');
const router = express.Router();
const os = require('os');
const cluster = require('cluster');
const { getDb, checkIntegrity } = require('../database/db');
const { createBackup, listBackups } = require('../database/backupService');
const { authenticate, requireRoles } = require('../middleware/auth');
const { heavyOpsLimiter } = require('../middleware/rateLimiter');

// GET /api/system/health - Public or monitoring endpoint (Liveness & Readiness probe)
router.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const dbHealth = checkIntegrity();

  const isHealthy = dbHealth.isHealthy;
  const status = isHealthy ? 'HEALTHY' : 'DEGRADED';

  res.status(isHealthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      isClusterWorker: cluster.isWorker,
      workerId: cluster.isWorker ? cluster.worker.id : 'standalone'
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      cpuCount: os.cpus().length,
      freeMemoryBytes: os.freemem(),
      totalMemoryBytes: os.totalmem(),
      memoryRssBytes: memUsage.rss,
      heapUsedBytes: memUsage.heapUsed
    },
    database: {
      engine: 'SQLite (WAL Mode)',
      integrityCheck: dbHealth.isHealthy ? 'PASSED' : 'FAILED',
      details: dbHealth.details
    }
  });
});

// GET /api/system/metrics - Administrative metrics
router.get('/metrics', authenticate, requireRoles('admin'), (req, res, next) => {
  try {
    const db = getDb();

    // Summary counts
    const totalStudents = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
    const activeStudents = db.prepare("SELECT COUNT(*) as c FROM students WHERE status = 'Active'").get().c;
    const totalTeachers = db.prepare('SELECT COUNT(*) as c FROM teachers').get().c;
    const totalClasses = db.prepare('SELECT COUNT(*) as c FROM classes').get().c;
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

    // Database physical size
    const pageCount = db.pragma('page_count', { simple: true });
    const pageSize = db.pragma('page_size', { simple: true });
    const dbSizeBytes = pageCount * pageSize;

    res.json({
      success: true,
      data: {
        counts: {
          totalStudents,
          activeStudents,
          totalTeachers,
          totalClasses,
          totalUsers
        },
        storage: {
          dbSizeBytes,
          dbSizeMb: (dbSizeBytes / (1024 * 1024)).toFixed(2),
          pageCount,
          pageSize
        },
        cluster: {
          isWorker: cluster.isWorker,
          workerId: cluster.isWorker ? cluster.worker.id : null,
          pid: process.pid
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/system/backups - List historical backups
router.get('/backups', authenticate, requireRoles('admin'), (req, res, next) => {
  try {
    const backups = listBackups();
    res.json({ success: true, data: backups });
  } catch (error) {
    next(error);
  }
});

// POST /api/system/backup - Trigger manual snapshot backup
router.post('/backup', authenticate, requireRoles('admin'), heavyOpsLimiter, async (req, res, next) => {
  try {
    const backupResult = await createBackup('Manual');
    res.json({
      success: true,
      message: `Database hot-backup completed successfully: ${backupResult.filename}`,
      data: backupResult
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/system/simulate-fault - Chaos test endpoint to demonstrate self-healing resilience
router.post('/simulate-fault', authenticate, requireRoles('admin'), (req, res) => {
  const { type } = req.body; // 'worker-crash' or 'handled-error'

  if (type === 'worker-crash') {
    res.json({
      success: true,
      message: 'Simulating worker crash. Cluster master will automatically detect death and resurrect a new worker in milliseconds.'
    });
    setTimeout(() => {
      console.warn(`[ChaosTest] Deliberately terminating worker PID ${process.pid} for resilience verification.`);
      process.exit(1);
    }, 200);
  } else {
    throw new Error('Simulated Chaos Testing Error: The application error boundaries safely caught and isolated this exception without dropping connections.');
  }
});

module.exports = router;
