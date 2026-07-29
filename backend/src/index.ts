import { createApp, SERVICE } from './app.js';
import { getConfig } from './config.js';
import { redisClient, isTestOrDev } from './middleware/rateLimit.js';

const { PORT } = getConfig();

async function startServer() {
  // Listen FIRST, connect to Redis in the background.
  //
  // This order is deliberate. node-redis applies its reconnect strategy to the
  // INITIAL connect too, so `connect()` against an unreachable server neither
  // resolves nor rejects — it retries forever. Awaiting it before listen()
  // meant that a Redis service still booting after a redeploy left Core with
  // no listener at all: the healthcheck got connection-refused, the catch
  // below never ran, `process.exit(1)` was unreachable, and Railway's
  // ON_FAILURE restart policy never fired because the process was still alive.
  // Core would hang there indefinitely.
  //
  // Rate limiting is an availability control, not a correctness one, so
  // degrading it (the limiters fail open — see passOnStoreError in
  // middleware/rateLimit.ts) is strictly better than refusing to serve.
  createApp().listen(PORT, () => {
    console.log(`[${SERVICE}] listening on :${PORT}`);
  });

  if (!isTestOrDev) {
    redisClient
      .connect()
      .then(() => console.log(`[${SERVICE}] Connected to Redis for distributed rate limiting`))
      .catch((error) => {
        // Reached only for a non-retryable failure (e.g. a malformed URL);
        // transient unreachability is handled by the reconnect strategy.
        console.error(`[${SERVICE}] Redis unavailable — rate limiting degrades to fail-open:`, error);
      });
  } else {
    console.log(`[${SERVICE}] Skipping Redis connection in dev/test mode (using MemoryStore)`);
  }
}

startServer();
