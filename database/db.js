const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// Ensure data directory exists
const dataDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function initDatabase() {
  if (db) return db;

  try {
    db = new Database(config.DB_PATH, {
      verbose: config.NODE_ENV === 'development' ? console.log : null,
      fileMustExist: false,
      timeout: 5000 // 5 seconds busy timeout
    });

    // High Availability, Performance and Zero Inconsistency Pragmas
    db.pragma('journal_mode = WAL');         // Write-Ahead Logging for high concurrency & resilience
    db.pragma('synchronous = NORMAL');        // Safe in WAL mode, excellent performance & crash recovery
    db.pragma('foreign_keys = ON');           // Enforce strict referential integrity
    db.pragma('busy_timeout = 5000');         // Wait up to 5s on concurrent lock
    db.pragma('temp_store = MEMORY');         // Fast temporary tables & indexes in memory
    db.pragma('cache_size = -64000');         // 64MB memory page cache
    db.pragma('auto_vacuum = INCREMENTAL');   // Controlled disk space reuse

    console.log(`[Database] Connected to SQLite database at ${config.DB_PATH} (WAL mode enabled)`);
    return db;
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error);
    throw error;
  }
}

function getDb() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

function checkIntegrity() {
  const currentDb = getDb();
  const result = currentDb.pragma('integrity_check');
  const isHealthy = Array.isArray(result) && result.length === 1 && result[0].integrity_check === 'ok';
  return {
    isHealthy,
    details: result
  };
}

function closeDatabase() {
  if (db && db.open) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)'); // Flush WAL log to disk cleanly
      db.close();
      console.log('[Database] Database closed cleanly.');
    } catch (err) {
      console.error('[Database] Error closing database:', err);
    }
  }
}

module.exports = {
  initDatabase,
  getDb,
  checkIntegrity,
  closeDatabase
};
