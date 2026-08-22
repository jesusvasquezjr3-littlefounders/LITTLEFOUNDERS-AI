import { createServer } from 'http';
import { createApp, SERVICE } from './app.js';
import { getConfig } from './env.js';
import { redisClient } from './lib/redis.js';
import { attachTutorSocket, closeAllSockets } from './ws/server.js';
import { modelConfigured } from './model/provider.js';
import { getVoiceProvider } from './voice/index.js';
import { moderationReadiness } from './safety/moderation.js';

const config = getConfig();

/*
 * The listener opens FIRST, before any optional dependency is touched
 * (/AGENTS.md §1.14). Awaiting a client that retries its initial connect
 * forever — which node-redis does — means the listener never opens at all,
 * leaving the process alive, unhealthy, and never restarted.
 */
const httpServer = createServer();
let liveSessions = 0;

const wss = attachTutorSocket(httpServer);
wss.on('connection', (socket) => {
  liveSessions += 1;
  socket.once('close', () => {
    liveSessions -= 1;
  });
});

httpServer.on('request', createApp(() => liveSessions));

httpServer.listen(config.PORT, () => {
  console.log(`[${SERVICE}] listening on :${config.PORT}`);

  /*
   * Say out loud what this instance can and cannot do.
   *
   * A silent degraded start is how a deployment ends up serving text-only
   * sessions for a week before anyone notices the voice key never made it into
   * the environment. These are warnings rather than failures on purpose: every
   * one of them is a real, supported posture.
   */
  if (!modelConfigured()) {
    console.warn(`[${SERVICE}] NO MODEL CONFIGURED — every session will fall back to scripted lines`);
  }
  if (!getVoiceProvider().available) {
    console.warn(`[${SERVICE}] voice provider "${getVoiceProvider().name}" unavailable — sessions run silent`);
  }
  if (!moderationReadiness(true).ready) {
    console.warn(`[${SERVICE}] no moderation judge — sessions for minors will be REFUSED`);
  }
});

/*
 * Redis connects in the background. Non-blocking, and never fatal.
 *
 * It now backs two things — the rate limiter and the speech cache — and both
 * degrade rather than fail without it: the limiter passes traffic through, and
 * a cache miss becomes a paid text-to-speech call. Neither is silence and
 * neither is an outage.
 */
redisClient
  .connect()
  .then(() => console.log(`[${SERVICE}] redis connected (rate limit + speech cache)`))
  .catch((err: unknown) => console.warn(`[${SERVICE}] redis connect failed (non-fatal):`, err));

function shutdown(): void {
  console.log(`[${SERVICE}] shutting down...`);
  // Sockets first: a live session gets a close frame and a reason rather than
  // a connection that simply stops answering mid-sentence.
  closeAllSockets(wss);
  httpServer.close();
  redisClient.disconnect().catch(() => {});
  setTimeout(() => process.exit(0), 250).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
