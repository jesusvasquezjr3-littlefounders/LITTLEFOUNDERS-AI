import { createServer } from 'http';
import { createApp, SERVICE } from './app.js';
import { getConfig } from './env.js';
import { redisClient } from './lib/redis.js';
import { attachTutorSocket, closeAllSockets } from './ws/server.js';
import { modelConfigured } from './model/provider.js';
import { getVoiceProvider } from './voice/index.js';
import { moderationReadiness } from './safety/moderation.js';
import { skillCatalogue } from './tutor/skills.js';

const config = getConfig();

/*
 * PEDAGOGICAL SKILLS ARE CONTENT, NOT OPTIONAL INFRASTRUCTURE — load them
 * eagerly, and let a malformed one crash the boot.
 *
 * `skills.ts`'s own comment already claimed this: "Read once at boot; loud on
 * ANY malformed file — a broken catalogue must fail deploy, not a turn." That
 * was aspirational, not true — `skillCatalogue()` lazily memoizes on its
 * FIRST call, and the only call sites were `orchestrator.ts`'s
 * `strategyInstruction()` (mid-turn, on essentially every graded turn) and
 * test/verify scripts. Nothing at boot ever called it, so a malformed skill
 * file shipped by any path that skips `npm test` — a hotfix, a CI flake, the
 * self-authoring pipeline this catalogue's own comment anticipates — would
 * boot "healthy" and throw inside `selectSkill()` on the first real child's
 * turn, caught by `ws/server.ts`'s message-handler `.catch()` and delivered
 * as a live in-session `{code:'INTERNAL', ...}` instead of a blocked deploy.
 *
 * This is the OPPOSITE posture from Redis/model/voice below (/AGENTS.md
 * §1.14): those are genuinely optional — every one has a supported degraded
 * mode (rate limiting passes through, sessions run text-only or silent) — so
 * they warn and keep serving. A skill is not optional: `strategyInstruction`
 * calls `selectSkill` on essentially every graded turn, and there is no
 * degraded posture for "some turns can't be strategized." Failing loudly here
 * and refusing to boot is what turns that into a blocked deploy rather than a
 * session someone is mid-lesson in.
 */
skillCatalogue();

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

  /*
   * THE JUDGE MUST NOT BE THE AUTHOR.
   *
   * Everything §6 and §7.3 claim rests on the judge being a genuinely
   * independent second opinion — /ORACLE.md's own record is that an
   * independent judge caught twelve semantic defects across 544 lessons that
   * nine deterministic gates passed. A model grading its own work grades it
   * generously, so a deployment that points both at the same endpoint keeps
   * every moderation call and every content verdict while silently losing the
   * property that made them worth anything.
   *
   * `check-provider-parity.mjs` pins these against Forge, not against each
   * other, so nothing anywhere would have said a word. It is a warning rather
   * than a fatal error because refusing to boot would turn a misconfiguration
   * into an outage — but it names the exact variables to change.
   */
  if (
    config.JUDGE_API_BASE === config.MODEL_API_BASE &&
    config.JUDGE_MODEL_NAME === config.MODEL_NAME
  ) {
    console.warn(
      `[${SERVICE}] JUDGE IS THE AUTHOR — JUDGE_API_BASE and JUDGE_MODEL_NAME match ` +
        `MODEL_API_BASE and MODEL_NAME ("${config.MODEL_NAME}"). Moderation and the ` +
        `content judge are no longer independent of the model they check. Point the ` +
        `judge at a different provider.`,
    );
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
  // a connection that simply stops answering mid-sentence. `closeAllSockets`
  // itself (item 79 / RUNBOOK Round 119) parks and immediately finalizes
  // every session that is still live at this exact instant, synchronously —
  // it does not wait for each socket's own close handshake, which this
  // function's remaining ~250ms budget below is too short to guarantee.
  closeAllSockets(wss);
  httpServer.close();
  redisClient.disconnect().catch(() => {});
  setTimeout(() => process.exit(0), 250).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
