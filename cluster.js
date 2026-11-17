const cluster = require('cluster');
const os = require('os');
const config = require('./config');

const numCPUs = Math.min(os.cpus().length, config.MAX_WORKERS || 2);

if (cluster.isPrimary || cluster.isMaster) {
  console.log(`=======================================================`);
  console.log(`  HIGH AVAILABILITY CLUSTER SUPERVISOR (Master PID: ${process.pid}) `);
  console.log(`  Spawning ${numCPUs} resilient worker processes...        `);
  console.log(`=======================================================`);

  // Track worker restarts to prevent fast crash loops
  const restartTimes = [];

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('online', (worker) => {
    console.log(`[Cluster] Worker ${worker.id} (PID ${worker.process.pid}) is online and accepting traffic.`);
  });

  cluster.on('exit', (worker, code, signal) => {
    const exitReason = signal ? `signal ${signal}` : `exit code ${code}`;
    console.warn(`[FaultTolerance] Worker ${worker.id} (PID ${worker.process.pid}) terminated with ${exitReason}.`);

    const now = Date.now();
    restartTimes.push(now);

    // Keep only timestamps within last 60 seconds
    const recentRestarts = restartTimes.filter(t => now - t < 60000);

    if (recentRestarts.length > 10) {
      console.error('[FaultTolerance] CRITICAL: More than 10 worker restarts within 1 minute. Throttling resurrection to prevent CPU saturation.');
      setTimeout(() => {
        console.log('[FaultTolerance] Resuming worker resurrection...');
        cluster.fork();
      }, 5000);
    } else {
      console.log('[FaultTolerance] Resurrecting replacement worker immediately to maintain High Availability...');
      cluster.fork();
    }
  });

  // Master process graceful shutdown
  const shutdownMaster = () => {
    console.log('[Cluster Master] Terminating all worker processes gracefully...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 1000);
  };

  process.on('SIGINT', shutdownMaster);
  process.on('SIGTERM', shutdownMaster);
} else {
  // Worker process
  const { startServer } = require('./server');
  startServer();
}
