import { createApp, SERVICE, VERSION } from './app.js';
import { loadConfig } from './config.js';
import { log } from './lib/log.js';
import { createLimits } from './services/limits.js';

/* Core's entry point: read the environment (crash if it is wrong), connect the counters, listen. */
const config = loadConfig();
const limits = await createLimits(config);
const app = createApp(config, limits);

const server = app.listen(config.port, () => {
  log.info('boot', { service: SERVICE, version: VERSION, port: config.port, env: config.env, counters: config.redisUrl ? 'redis' : 'memory' });
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void limits.close().then(() => process.exit(0));
    });
  });
}
