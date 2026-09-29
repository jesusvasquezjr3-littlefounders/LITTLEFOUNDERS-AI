import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findChrome } from './lesson-engine/browser.mjs';

/*
 * The browser half of the Frontend Bible gate, runnable anywhere with one
 * command: it starts a Vite dev server, runs the rebuilt-app audits and/or the
 * Mentor-stage verifier against it, and stops the server.
 *
 *   node scripts/rebuild-audit-gate.mjs [--suite audits|mentor-stage|all] [--require-chrome]
 *   npm run audit:gate -- --suite all                (frontend)
 *   npm run rebuild:audit-gate                       (root; run by release-readiness.sh)
 *
 * audits        scripts/audit-rebuild.mjs all: text fit (02 §7 item 10), proportion (03 §5) with the
 *               teaching-board rules (05 §8) and the motion budget (02 §9.4), copy budget (06 §7), over
 *               every state in scripts/audits/states.mjs x 3 locales x 2 modes x 320/375/768/1280 px.
 *               AUDIT_SHARD=k/n runs one round-robin shard of the states (CI splits the full matrix
 *               across parallel jobs and merges them with scripts/audits/merge-shards.mjs); every other
 *               AUDIT_* variable passes through unchanged.
 * mentor-stage  scripts/verify-mentor-stage.mjs (08 §7, §9, §10): the one Mentor stage in real Chrome
 *               on the software GL path, headless.
 *
 * Zero spend: nothing leaves the machine. Every Core request is answered by
 * scripts/audits/synthetic-core.mjs, and the preview entry needs no Core.
 *
 * No Chrome: prints SKIP and exits 0 (release readiness on a machine without a
 * browser, like the db-verify gates without PostgreSQL), unless
 * --require-chrome is given (CI), which makes it exit 2. Otherwise the exit
 * code is the worst of the suites run: 0 clean, 1 findings, 2 setup error.
 *
 * AUDIT_GATE_PORT picks the dev server's port (default 5310, strict: a busy
 * port is an error rather than a silent second server).
 */
const HERE = fileURLToPath(new URL('.', import.meta.url));
const FRONTEND = join(HERE, '..');
const VITE_BIN = join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js');
export const SUITES = { audits: ['audits'], 'mentor-stage': ['mentor-stage'], all: ['audits', 'mentor-stage'] };

/** The command each suite runs (relative to frontend/). */
export const SUITE_SCRIPTS = {
  audits: ['scripts/audit-rebuild.mjs', 'all'],
  'mentor-stage': ['scripts/verify-mentor-stage.mjs'],
};

/** Parse argv; throws on an unknown suite. */
export function parseArgs(argv) {
  const at = argv.indexOf('--suite');
  const suite = at === -1 ? 'all' : argv[at + 1];
  if (!SUITES[suite]) throw new Error(`--suite must be one of ${Object.keys(SUITES).join(', ')}, got ${JSON.stringify(suite)}`);
  return { suite, requireChrome: argv.includes('--require-chrome') };
}

/** What to do when this machine has (or lacks) Chrome: run, skip (exit 0) or fail (exit 2). */
export function chromeDecision(chrome, requireChrome) {
  if (chrome) return 'run';
  return requireChrome ? 'fail' : 'skip';
}

function run(script, args, env) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: FRONTEND, env, stdio: 'inherit' });
    child.on('exit', (code, signal) => done(signal ? 2 : code ?? 2));
    child.on('error', () => done(2));
  });
}

/** Start Vite on a strict port and resolve with its origin once it prints it. */
function startVite(port, env) {
  const child = spawn(process.execPath, [VITE_BIN, '--port', String(port), '--strictPort'], { cwd: FRONTEND, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const ready = new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`Vite never printed its URL within 120 s:\n${output}`)), 120_000);
    const read = (chunk) => {
      // Vite colours its banner; the escape codes land between the host and the port.
      output += String(chunk).replace(/\u001b\[[0-9;]*m/g, '');
      const found = output.match(/Local:\s+(http:\/\/[^\s/]+)/);
      if (found) { clearTimeout(timer); resolve(found[1]); }
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Vite exited with ${code} before serving:\n${output}`)); });
  });
  return { child, ready };
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exit(2); }
  const chrome = findChrome();
  const decision = chromeDecision(chrome, options.requireChrome);
  if (decision === 'skip') {
    console.log('rebuild:audit-gate SKIP — no Chrome or Chromium on this machine (set CHROME_PATH); the Bible audits and the Mentor-stage verifier did NOT run');
    process.exit(0);
  }
  if (decision === 'fail') {
    console.error('rebuild:audit-gate: no Chrome or Chromium found (set CHROME_PATH) and --require-chrome was given');
    process.exit(2);
  }

  const env = { ...process.env, CHROME_PATH: chrome };
  // The predev step: the Basis transcoder the character models need, copied out of `three`.
  if (await run('scripts/copy-3d-decoders.mjs', [], env) !== 0) { console.error('rebuild:audit-gate: copy-3d-decoders failed'); process.exit(2); }

  const port = Number(process.env.AUDIT_GATE_PORT ?? 5310);
  const vite = startVite(port, env);
  const stop = () => { if (vite.child.exitCode === null) vite.child.kill(); };
  process.on('SIGINT', () => { stop(); process.exit(130); });
  process.on('SIGTERM', () => { stop(); process.exit(143); });
  let worst = 0;
  try {
    const origin = await vite.ready;
    vite.child.removeAllListeners('exit');
    console.log(`rebuild:audit-gate: dev server at ${origin}, Chrome at ${chrome}`);
    for (const name of SUITES[options.suite]) {
      console.log(`\n== ${name} ==`);
      const [script, ...args] = SUITE_SCRIPTS[name];
      const code = await run(script, args, { ...env, REBUILD_URL: origin });
      console.log(`== ${name}: exit ${code} ==`);
      worst = Math.max(worst, code === 0 || code === 1 ? code : 2);
    }
  } catch (error) {
    console.error(`rebuild:audit-gate: ${error.message}`);
    worst = 2;
  } finally {
    stop();
  }
  process.exit(worst);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
