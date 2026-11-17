const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { getDb, checkIntegrity } = require('./db');

// Ensure backup folder exists
if (!fs.existsSync(config.BACKUP_DIR)) {
  fs.mkdirSync(config.BACKUP_DIR, { recursive: true });
}

let backupTimer = null;

/**
 * Creates an atomic hot-backup of the SQLite database using SQLite's online backup API
 */
async function createBackup(backupType = 'Manual') {
  const db = getDb();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `school_backup_${timestamp}.db`;
  const backupPath = path.join(config.BACKUP_DIR, filename);

  try {
    console.log(`[BackupService] Starting ${backupType} hot backup to ${filename}...`);
    const startTime = Date.now();

    // Use better-sqlite3 native async online backup
    await db.backup(backupPath, {
      progress({ totalPages, remainingPages }) {
        // Backup in progress
      }
    });

    const stats = fs.statSync(backupPath);
    const durationMs = Date.now() - startTime;
    const backupId = uuidv4();

    // Record backup in registry table
    const stmt = db.prepare(`
      INSERT INTO system_backups (id, filename, filepath, size_bytes, backup_type, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'success', CURRENT_TIMESTAMP)
    `);
    stmt.run(backupId, filename, backupPath, stats.size, backupType);

    console.log(`[BackupService] Backup completed in ${durationMs}ms (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Clean up older backups (keep last 10)
    pruneOldBackups(10);

    return {
      success: true,
      id: backupId,
      filename,
      sizeBytes: stats.size,
      durationMs,
      createdAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('[BackupService] Backup failed:', err);
    try {
      const backupId = uuidv4();
      db.prepare(`
        INSERT INTO system_backups (id, filename, filepath, size_bytes, backup_type, status, created_at)
        VALUES (?, ?, ?, 0, ?, 'failed', CURRENT_TIMESTAMP)
      `).run(backupId, filename, backupPath, backupType);
    } catch (e) {
      // Ignore registry error
    }
    throw err;
  }
}

/**
 * Prunes older backups to keep storage under control
 */
function pruneOldBackups(keepCount = 10) {
  try {
    const files = fs.readdirSync(config.BACKUP_DIR)
      .filter(f => f.startsWith('school_backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(config.BACKUP_DIR, f),
        time: fs.statSync(path.join(config.BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // newest first

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.path);
          console.log(`[BackupService] Pruned old backup: ${item.name}`);
        } catch (e) {
          console.warn(`[BackupService] Failed to prune ${item.name}:`, e.message);
        }
      }
    }
  } catch (err) {
    console.warn('[BackupService] Could not prune backups:', err.message);
  }
}

/**
 * Lists all available backup records
 */
function listBackups() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM system_backups ORDER BY created_at DESC LIMIT 20
  `).all();
}

/**
 * Start periodic automated backup scheduler
 */
function startBackupScheduler() {
  if (backupTimer) return;

  const intervalMs = config.BACKUP_INTERVAL_MINUTES * 60 * 1000;
  console.log(`[BackupService] Scheduler active: Running every ${config.BACKUP_INTERVAL_MINUTES} minutes`);

  backupTimer = setInterval(async () => {
    try {
      await createBackup('Automated');
    } catch (err) {
      console.error('[BackupService] Scheduled backup error:', err.message);
    }
  }, intervalMs);
}

function stopBackupScheduler() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}

module.exports = {
  createBackup,
  listBackups,
  startBackupScheduler,
  stopBackupScheduler,
  checkIntegrity
};
