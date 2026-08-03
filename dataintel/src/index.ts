import { createApp, SERVICE } from './app.js';
import { getConfig } from './env.js';
import { cacheClient } from './middleware/cache.js';
import { rateLimitClient } from './middleware/rateLimit.js';
import { initDb, closeDb } from './db/duckdb.js';
import { startSyncWorker, stopSyncWorker } from './workers/sync.js';
import { startAlertWorker, stopAlertWorker } from './workers/alerts.js';

const config = getConfig();

const server = createApp().listen(config.PORT, () => {
  console.log(`[${SERVICE}] listening on :${config.PORT}`);
});

// Connect Redis clients in background — non-blocking, listener opens first.
Promise.all([
  cacheClient.connect().then(() => {
    console.log(`[${SERVICE}] cache redis connected`);
  }),
  rateLimitClient.connect().then(() => {
    console.log(`[${SERVICE}] rate-limit redis connected`);
  }),
]).catch((err: unknown) => {
  console.warn(`[${SERVICE}] redis connect failed (non-fatal):`, err);
});

// Initialise DuckDB then start sync worker — non-blocking, listener opens first.
initDb()
  .then(() => {
    console.log(`[${SERVICE}] duckdb initialised`);
    startSyncWorker();
    startAlertWorker();
  })
  .catch((err: unknown) => {
    console.warn(`[${SERVICE}] duckdb init failed (non-fatal):`, err);
  });

// Graceful shutdown
function shutdown(): void {
  console.log(`[${SERVICE}] shutting down...`);
  stopSyncWorker();
  stopAlertWorker();
  server.close();
  cacheClient.disconnect().catch(() => {});
  rateLimitClient.disconnect().catch(() => {});
  closeDb()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
