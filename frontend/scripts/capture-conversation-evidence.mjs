/*
 * `node scripts/capture-conversation-evidence.mjs <boards.json> <outDir>` —
 * photograph every board a REAL conversation drew, as the learner saw it.
 *
 * WHY THIS AND NOT THE FIXTURE CAMERA. `capture-instrument-evidence.mjs`
 * photographs the lab's own fixtures: it proves a kind RENDERS. That is a
 * different claim from "the tutor drew this, for this child, on this turn" —
 * and the second is the one a report about teaching has to make. The payloads
 * here come from `tutor:converse`'s own dump, replayed through the real
 * renderer via the lab's `__LF_BOARD__` hook.
 *
 * es-MX, light theme, the plate as a learner meets it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const [, , dumpPath, outDir] = process.argv;
if (!dumpPath || !outDir) {
  console.error('usage: capture-conversation-evidence.mjs <boards.json> <outDir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const boards = JSON.parse(readFileSync(dumpPath, 'utf8'));

function startDevServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let done = false;
    const onData = (b) => {
      const m = /Local:\s+(http:\/\/\S+?)\/?\s*$/m.exec(b.toString().replace(/\[[0-9;]*m/g, ''));
      if (!done && m) {
        done = true;
        resolve({ child, url: m[1] });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    setTimeout(() => { if (!done) reject(new Error('dev server did not start')); }, 60_000);
  });
}

/*
 * One navigation puts the lab in position: `?surface=conversing` seeds the
 * phase, and the board itself is set on the page before React reads it.
 * Driving the debug panel instead measured zero lesson plates on all
 * twenty-two boards — the phase does not survive a panel toggle, and a lab
 * that is not conversing has no plate to draw into.
 */
const SETTLE = `(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms) => { const s = Date.now() + ms;
    while (Date.now() < s) { const v = fn(); if (v) return v; await wait(200); } return null; };
  const btn = (x) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === x);
  /*
   * Wait for THIS navigation before measuring anything. A fixed sleep let the
   * checks below run against the previous board's page, which was already
   * hidden and already settled — so they passed their polls instantly and then
   * measured a surface that was about to be replaced. Nine of twenty-two
   * failed that way, reporting zero plates for boards that render perfectly.
   */
  if (!await until(() => location.search.includes('surface=conversing') &&
      document.readyState === 'complete', 30000)) return 'DIAG:navigation-never-settled';
  // The panel starts open and covers the plate; hide it once it exists.
  const h = await until(() => btn('hide'), 30000);
  if (h) { h.click(); await wait(400); }
  const el = await until(() => document.querySelector('[data-tutor-whiteboard]'), 25000);
  if (!el) return 'DIAG:' + JSON.stringify({
    plates: document.querySelectorAll('aside').length,
    hook: typeof globalThis.__LF_BOARD__,
  });
  await wait(500);
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return 'DIAG:zero-size';
  const CAP = 30, PAD = 14;
  const top = Math.max(0, r.y - CAP);
  return JSON.stringify({ x: Math.max(0, r.x - PAD), y: top,
    width: r.width + PAD * 2, height: (r.y - top) + r.height + PAD });
})()`;

const server = await startDevServer();
console.log(`capture-conversation-evidence — ${server.url}, ${boards.length} boards -> ${outDir}`);
const { child, browser } = await launchBrowser(join(tmpdir(), `lf-convo-${Date.now()}`));
let ok = 0;
const manifest = [];

try {
  const page = await openPage(browser, { width: 1280, height: 900, dark: false });

  for (const [i, entry] of boards.entries()) {
    /*
     * A FULL RELOAD PER BOARD, deliberately. The board is read once, through
     * the lab's own lazy initialiser, so it must be on the page before React
     * mounts — and a reload is the only way to guarantee that without a
     * second dev hook whose only user would be this script.
     */
    await page.send('Page.navigate', {
      url:
        `${server.url}/dev/tutor-lab?surface=conversing&locale=es-MX` +
        `&board=${encodeURIComponent(Buffer.from(JSON.stringify(entry.whiteboard)).toString('base64'))}` +
        `&say=${encodeURIComponent(entry.tutor.slice(0, 300))}`,
    });
    await sleep(i === 0 ? 7000 : 1200);
    const raw = await page.evaluate(SETTLE);
    if (typeof raw === 'string' && raw.startsWith('DIAG:')) {
      console.log(`  ✗ ${String(i).padStart(2)} ${entry.whiteboard?.kind} — ${raw.slice(5)}`);
      continue;
    }
    const rect = JSON.parse(raw);
    const { data } = await page.send('Page.captureScreenshot', {
      format: 'png',
      clip: { ...rect, scale: 2 },
    });
    const file = `board-${String(i).padStart(2, '0')}.png`;
    writeFileSync(join(outDir, file), Buffer.from(data, 'base64'));
    manifest.push({ ...entry, file, kind: entry.whiteboard?.kind ?? null });
    console.log(`  ✓ ${String(i).padStart(2)} ${entry.whiteboard?.kind}`);
    ok += 1;
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
} finally {
  child.kill('SIGTERM');
  server.child.kill('SIGTERM');
}

console.log(`\ncaptured ${ok}/${boards.length}`);
process.exit(ok === boards.length ? 0 : 1);
