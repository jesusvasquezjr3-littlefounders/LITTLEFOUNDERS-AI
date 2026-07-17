import { createApp, SERVICE } from './app.js';
import { getConfig } from './config.js';
import { redisClient, isTestOrDev } from './middleware/rateLimit.js';

const { PORT } = getConfig();

async function startServer() {
  if (!isTestOrDev) {
    try {
      await redisClient.connect();
      console.log(`[${SERVICE}] Connected to Redis for distributed rate limiting`);
    } catch (error) {
      console.error(`[${SERVICE}] Failed to connect to Redis:`, error);
      process.exit(1);
    }
  } else {
    console.log(`[${SERVICE}] Skipping Redis connection in dev/test mode (using MemoryStore)`);
  }

  createApp().listen(PORT, () => {
    console.log(`[${SERVICE}] listening on :${PORT}`);
  });
}

startServer();
