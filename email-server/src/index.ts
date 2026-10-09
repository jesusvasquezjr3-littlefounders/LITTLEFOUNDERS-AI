import type { ChildProcess } from 'node:child_process';
import { createApp, SERVICE } from './app.js';
import { getConfig } from './config.js';
import { NoopAdapter, type EmailAdapter } from './services/adapter.js';
import { SmtpAdapter } from './services/smtp-adapter.js';
import { renderHarakaConfig, startHaraka } from './services/haraka.js';

/*
 * Courier entrypoint / supervisor.
 *
 * With EMAIL_ENGINE=haraka it runs TWO cooperating processes in one container:
 *   1. the Haraka SMTP engine (email-server/haraka) — the private SMTP endpoint
 *      GoTrue talks to, and the outbound relay to Amazon SES;
 *   2. this Express HTTP API — /health (Railway healthcheck) and POST
 *      /api/v1/send, whose SmtpAdapter submits into Haraka on localhost.
 * If the engine dies, the supervisor exits non-zero so Railway restarts cleanly.
 *
 * With EMAIL_ENGINE=noop (dev/test default) it runs only the HTTP API over a
 * no-op adapter, so `npm run dev` / tests need no SMTP.
 */
const config = getConfig();

let haraka: ChildProcess | undefined;
let adapter: EmailAdapter;

if (config.EMAIL_ENGINE === 'haraka') {
  await renderHarakaConfig(config);
  haraka = startHaraka(config);
  adapter = new SmtpAdapter({
    host: config.HARAKA_LOCAL_HOST,
    port: config.HARAKA_LOCAL_PORT,
    from: config.MAIL_FROM,
  });
  haraka.on('exit', (code, signal) => {
    console.error(
      `[${SERVICE}] haraka engine exited (code=${code}, signal=${signal}) — exiting so Railway restarts`,
    );
    process.exit(1);
  });
} else {
  adapter = new NoopAdapter();
  console.log(`[${SERVICE}] engine=noop (no real SMTP; set EMAIL_ENGINE=haraka to relay via SES)`);
}

const server = createApp(adapter).listen(config.PORT, () => {
  console.log(`[${SERVICE}] HTTP listening on :${config.PORT} (engine=${config.EMAIL_ENGINE})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[${SERVICE}] ${signal} received — shutting down`);
  server.close();
  if (haraka && !haraka.killed) haraka.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
