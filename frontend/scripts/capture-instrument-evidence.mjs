/*
 * `node scripts/capture-instrument-evidence.mjs` — photograph each newly-wired
 * instrument as a learner in es-MX actually sees it, and write one cropped PNG
 * per kind.
 *
 * WHY IT EXISTS. The instruments wired on 2026-09-04 were verified three ways
 * that a reader cannot check: unit tests, a coverage gate, and a live
 * conversation transcript. None of those is a picture, and the question the
 * owner actually asked — is this teaching better now — is answered by looking.
 *
 * It reuses the SAME browser helper and the SAME dev server the shipped gates
 * use (`verify-tutor-ui.mjs`), and drives the SAME lab fixtures, so what it
 * photographs is the product rather than a mock built to be photographed.
 *
 * es-MX ON PURPOSE: this product's learners are Mexican children and every
 * board's own copy is authored per locale. An English screenshot is evidence
 * about a locale almost nobody uses.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { spawn } from 'node:child_process'
import { launchBrowser, openPage } from './lesson-engine/browser.mjs'

const OUT = process.env.EVIDENCE_OUT ?? join(process.cwd(), 'evidence')
mkdirSync(OUT, { recursive: true })

/** The instruments wired 2026-09-04, by their lab-fixture id. */
const KINDS = [
  'deal', 'change', 'regroup', 'table', 'receipt',
  'budget', 'outcomes', 'trade', 'number-jumps',
  'fraction-strip', 'fraction-circle', 'scale', 'ranking', 'chance',
]

function startDevServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'dev', '--', '--port', '5178', '--strictPort'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let done = false
    const onData = (b) => {
      const s = b.toString()
      /*
       * Read the port Vite ACTUALLY bound, never the one that was asked for.
       * The first version of this script hardcoded 5178 and matched only on
       * the word "Local:", so when the flags did not reach Vite it happily
       * reported success and then drove a dead port for fourteen straight
       * captures — every one failing as "no-lab-button", which reads exactly
       * like a product defect and is not one.
       */
      const m = /Local:\s+(http:\/\/\S+?)\/?\s*$/m.exec(s.replace(/\[[0-9;]*m/g, ''))
      if (!done && m) {
        done = true
        resolve({ child, url: m[1] })
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    setTimeout(() => { if (!done) reject(new Error('dev server did not start')) }, 60_000)
  })
}

/*
 * Drives the lab's own debug panel the way a person would, then hides it: the
 * panel overlaps the board it is used to select, so a screenshot taken with it
 * open photographs the harness rather than the product.
 */
const SETUP = (kind) => `(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const btn = (t) => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t);
  const click = (t) => { const b = btn(t); if (b) b.click(); return !!b; };
  /*
   * Poll rather than sleep a fixed amount: the lab mounts behind the 3D
   * island's own load, which is not a fixed cost on a cold start, and a fixed
   * wait that is long enough on a warm machine is the exact shape of a flaky
   * gate this repo has already paid for once.
   */
  const until = async (fn, ms) => {
    const stop = Date.now() + ms;
    while (Date.now() < stop) { if (fn()) return true; await wait(200); }
    return false;
  };
  if (!document.querySelector('select')) {
    if (!await until(() => btn('lab'), 30000)) return 'no-lab-button';
    click('lab');
    if (!await until(() => document.querySelector('select'), 10000)) return 'panel-never-opened';
  }
  click('es-MX'); await wait(350);
  click('conversing'); await wait(500);
  const sel = document.querySelector('select');
  if (!sel) return 'no-select';
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(sel, ${JSON.stringify(kind)});
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 500));
  click('hide');
  await new Promise(r => setTimeout(r, 700));
  return 'ok';
})()`

/*
 * The BOARD's own box, not the whole lesson plate.
 *
 * The first version clipped the plate, which is correct and useless: the plate
 * is a tall column that is mostly empty space, a chat log and a text input, so
 * the instrument — the entire subject of the photograph — came out as a small
 * shape floating in the middle of furniture. This reaches up to include the
 * board's own caption line (the sentence the tutor says while drawing), which
 * IS part of the evidence, and stops there.
 */
const BOARD_RECT = `(() => {
  const el = document.querySelector('[data-tutor-whiteboard]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  const CAPTION = 34;
  const PAD = 14;
  const top = Math.max(0, r.y - CAPTION);
  return JSON.stringify({
    x: Math.max(0, r.x - PAD),
    y: top,
    width: r.width + PAD * 2,
    height: (r.y - top) + r.height + PAD,
  });
})()`

const server = await startDevServer()
console.log(`capture-instrument-evidence — dev server ${server.url}, PNGs in ${OUT}`)
const { child, browser } = await launchBrowser(join(tmpdir(), `lf-evidence-${Date.now()}`))
let ok = 0
let failed = 0

try {
  const page = await openPage(browser, { width: 1280, height: 860, dark: false })
  await page.send('Page.navigate', { url: `${server.url}/dev/tutor-lab` })
  await sleep(6000)

  // Warm-up: the FIRST kind otherwise pays the island's cold mount and comes
  // back as 'no-lab-button', which reads like a defect and is a stopwatch.
  await page.evaluate(SETUP(KINDS[0]))
  await sleep(1200)

  for (const kind of KINDS) {
    const state = await page.evaluate(SETUP(kind))
    if (state !== 'ok') {
      console.log(`  ✗ ${kind} — setup returned ${state}`)
      failed += 1
      continue
    }
    const raw = await page.evaluate(BOARD_RECT)
    if (!raw) {
      console.log(`  ✗ ${kind} — no whiteboard on screen`)
      failed += 1
      continue
    }
    const rect = JSON.parse(raw)
    const { data } = await page.send('Page.captureScreenshot', {
      format: 'png',
      clip: { ...rect, scale: 2 },
    })
    writeFileSync(join(OUT, `${kind}.png`), Buffer.from(data, 'base64'))
    console.log(`  ✓ ${kind} — ${Math.round(rect.width)}x${Math.round(rect.height)}`)
    ok += 1
  }
} finally {
  child.kill('SIGTERM')
  server.child.kill('SIGTERM')
}

console.log(`\ncaptured ${ok}/${KINDS.length}${failed ? `, ${failed} failed` : ''}`)
process.exit(failed ? 1 : 0)
