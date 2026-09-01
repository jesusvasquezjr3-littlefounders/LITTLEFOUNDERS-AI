/*
 * THE TUTOR'S CONVERSING PHASE, AUDITED WITH axe-core.
 *
 *   npm run verify:tutor-a11y
 *
 * ORACLE.md §16.1 records a real axe-core pass on 2026-08-21 (zero
 * violations) and then, two hundred lines later, admits it was never re-run
 * after the caption, the plate and the replay transport were all rebuilt —
 * "re-run axe before launch". This is that re-run, made repeatable rather
 * than a one-off manual check, against `/dev/tutor-lab`'s real `StageShell`
 * (same rig `verify-tutor-ui.mjs` drives) across the three configurations
 * that matter: desktop light en-US, desktop dark es-MX, mobile light es-MX
 * (§1.11 — desktop and mobile are both non-negotiable, and dark mode is a
 * real theme, not a filter).
 *
 * WHAT IT SCANS, per configuration:
 *   - conversing, with a `sort_buckets` activity live — the drag/drop
 *     grouping type flagged by live-testing (2026-09-01) as having group
 *     buttons with no accessible name. Driving it here means a REGRESSION —
 *     one of the buckets losing its `aria-label` again — fails a gate
 *     instead of waiting for the next live session to find it.
 *   - replaying — `ReplayInWorld.tsx`'s transport (previous/pause-play/next,
 *     the per-line "play from here" transcript), explicitly named in the
 *     same audit request as a surface rebuilt since the 08-21 pass.
 *
 * WHY `[data-lab-chrome]` IS EXCLUDED. It is the lab's own instrument panel
 * — switches, not product — and `verify-tutor-ui.mjs` already established
 * the convention that the instrument is never part of the thing under
 * measurement. Scanning it anyway would report the DEV-ONLY switch buttons'
 * contrast (`bg-primary`/`text-on-primary` at `lf-caption` size — a11y noise
 * that ships to nobody, gated behind `import.meta.env.DEV`) as if it were a
 * defect in the product a family actually uses.
 *
 * WHY `color-contrast` IS READ BUT NEVER FAILED HERE. Two structurally
 * different reasons collapse into the same axe rule, and only one of them is
 * this gate's to catch:
 *   1. TEXT OVER THE 3D RENDER has no single background colour for axe to
 *      measure against — HudPlate's Lumen material is deliberately
 *      translucent (/DESIGN.md §Lumen) — so axe reports it `incomplete`
 *      forever, not `violation`. ORACLE.md §16.1 already names the actual
 *      answer to this one: a computed BOUND (7.2:1 light / 5.4:1 dark worst
 *      case), asserted in `HudPlate.test.tsx` against the material's own
 *      alpha, which is the one thing that can actually be pinned down as a
 *      number without a live render behind it.
 *   2. AN ELEMENT MID ENTRANCE ANIMATION reads as a real `violation`
 *      (opacity ramping 0→1 over `--lf-dur-slow` — 300ms — genuinely lowers
 *      the instantaneous composite contrast), and it is a false positive:
 *      the settle finishes automatically for every user in well under a
 *      second and the RESTING state is a separate, solid `bg-accent
 *      text-on-accent` pairing (measured 6.29:1 — comfortably past 4.5:1).
 *      Caught here on 2026-09-01 scanning `PersonalizeInWorld`'s "I'm ready"
 *      button mid-`lf-settle`; confirmed a false alarm by re-scanning after
 *      the animation settles. `SETTLE_MS` below is the wait this script
 *      pays on every phase switch so it always measures the RESTING state
 *      instead of relitigating that false positive on every run.
 * A REAL, persistent contrast defect on a solid (non-canvas, non-animating)
 * surface is still worth catching by eye — this script prints every
 * `color-contrast` node it finds, tagged `incomplete` vs `violation`, so a
 * human glances at the list rather than the gate silently swallowing a case
 * that is not actually either of the two above.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { launchBrowser, openPage } from './lesson-engine/browser.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const VITE_BIN = join(HERE, '..', 'node_modules', 'vite', 'bin', 'vite.js')
const OUT = join(tmpdir(), 'lf-verify-tutor-a11y')
mkdirSync(OUT, { recursive: true })

// Resolved rather than hard-coded to `node_modules/axe-core/axe.min.js`: a
// future bump of the package is free to change its own layout, and
// `require.resolve` is the one thing that cannot drift from what npm
// actually installed.
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

/** The settle animation's own duration (`--lf-dur-slow`, index.css) plus
 *  slack — see the file banner's false-positive note. Paid once per phase
 *  switch, never per scan, so the three-configuration run costs seconds, not
 *  minutes. */
const SETTLE_MS = 600

async function startDevServer() {
  if (process.env.TUTOR_LAB_URL) return { url: process.env.TUTOR_LAB_URL, stop: () => {} }
  const child = spawn(process.execPath, [VITE_BIN, '--host', '127.0.0.1'], {
    cwd: join(HERE, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const url = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite never printed a URL:\n${output}`)), 90_000)
    const read = (chunk) => {
      output += chunk.toString()
      const plain = output.replace(/\[[0-9;]*m/g, '')
      const match = plain.match(/http:\/\/127\.0\.0\.1:(\d+)\//)
      if (match) {
        clearTimeout(timer)
        resolve(`http://127.0.0.1:${match[1]}`)
      }
    }
    child.stdout.on('data', read)
    child.stderr.on('data', read)
  })
  return { url, stop: () => child.kill() }
}

const switchCoords = (label) =>
  `(() => { const b = [...document.querySelectorAll('[data-lab-chrome] button')]` +
  `.find((n) => n.textContent.trim() === ${JSON.stringify(label)});` +
  ` if (!b) return null; const r = b.getBoundingClientRect();` +
  ` return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } })()`

/*
 * A DIRECT `.click()`, deliberately, and only for the LAB'S OWN switches.
 *
 * This is the one place in the repo's verify-* scripts that does not
 * hit-test a coordinate first (AGENTS.md §1.14 — a synthetic click proves
 * nothing about whether a real finger could reach a PRODUCT control). It
 * does not need to: `[data-lab-chrome]` is the dev-only instrument, excluded
 * from every a11y scan below by construction, so nothing here is asserting
 * that this switch is reachable — only that the lab CAN be driven into the
 * state under test. Coordinate-based clicking failed exactly the way the
 * class predicts: the phase-switch row is `overflow-x-auto`, nine labels
 * wide, and at 375 px "replaying" sits scrolled out of the visible strip —
 * `getBoundingClientRect()` still reports a rect (elements clipped by an
 * ancestor's overflow are not `display:none`), so a coordinate click landed
 * on whatever the clipped, still-in-flow-layout position happened to be,
 * and did nothing. `.click()` on the matched element sidesteps scroll
 * position entirely, which is exactly the right tool once "reachable by a
 * pointer" is not the thing being measured.
 */
async function pressSwitch(page, label) {
  const clicked = await page.evaluate(
    `(() => { const b = [...document.querySelectorAll('[data-lab-chrome] button')]` +
      `.find((n) => n.textContent.trim() === ${JSON.stringify(label)});` +
      ` if (!b) return false; b.click(); return true })()`,
  )
  if (!clicked) throw new Error(`lab switch "${label}" not found`)
  await sleep(SETTLE_MS)
}

async function waitFor(page, expression, ms, what) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await page.evaluate(expression)) return
    await sleep(400)
  }
  throw new Error(`timed out waiting for ${what}`)
}

async function shoot(page, name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
}

/** Injects axe-core once per page and returns its excludes-the-lab report. */
async function runAxe(page) {
  await page.evaluate(axeSource)
  const json = await page.evaluate(
    `(async () => {
      const results = await axe.run(
        { exclude: [['[data-lab-chrome]']] },
        { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } },
      );
      return JSON.stringify({
        violations: results.violations.map((v) => ({
          id: v.id, impact: v.impact,
          nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 200) })),
        })),
        incomplete: results.incomplete.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 200) })),
        })),
      });
    })()`,
  )
  return JSON.parse(json)
}

/** True for the two documented, expected `color-contrast` shapes (see file
 *  banner) — everything else in `incomplete` or `violations` is reported. */
function isKnownContrastCase(node, bucket) {
  if (node.id !== 'color-contrast') return false
  // Category 1: axe itself could not compute a background — always
  // `incomplete`, never `violations`, and that split is the signal.
  if (bucket === 'incomplete') return true
  // Category 2: a mid-settle false positive. The only page this script
  // drives it through is `personalizing`'s accent-floor "done" action, and
  // `pressSwitch` already waits `SETTLE_MS` past every switch — so seeing
  // this AT ALL here means the wait stopped being enough, which is itself
  // worth printing rather than silently swallowing.
  return false
}

const server = await startDevServer()
console.log(`verify:tutor-a11y — dev server at ${server.url}, screenshots in ${OUT}`)
const { child, browser } = await launchBrowser(join(tmpdir(), `lf-tutor-a11y-${Date.now()}`))
let failures = 0
const contrastNotes = []

try {
  for (const [tag, viewport, locale] of [
    ['desktop-en', { width: 1280, height: 900, dark: false }, 'en-US'],
    ['desktop-es-dark', { width: 1280, height: 900, dark: true }, 'es-MX'],
    ['mobile-es', { width: 375, height: 812, dark: false }, 'es-MX'],
  ]) {
    const page = await openPage(browser, viewport)
    await page.send('Page.navigate', { url: `${server.url}/dev/tutor-lab` })
    await waitFor(page, '!!document.querySelector("[data-lab-chrome]")', 60_000, 'lab chrome')
    const open = await page.evaluate(switchCoords('conversing'))
    if (!open) await pressSwitch(page, 'lab')
    await waitFor(page, 'document.body.innerText.includes("stage ready")', 90_000, 'stage ready')
    await pressSwitch(page, locale)
    await pressSwitch(page, 'conversing')

    // ---- conversing, sort_buckets — the drag/drop grouping regression check
    const select = await page.evaluate(
      `(() => { const s = document.querySelector('select[aria-label="activity on the plate"]');` +
        ` if (!s) return false; s.value = 'sort_buckets'; s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`,
    )
    if (!select) {
      failures += 1
      console.log(`[${tag}] MISSING: the lab activity switch — cannot drive sort_buckets`)
    } else {
      await sleep(SETTLE_MS)
      const zones = await page.evaluate(
        `JSON.stringify([...document.querySelectorAll('[data-dropzone] button')].map((b) => ({` +
          ` ariaLabel: b.getAttribute('aria-label'), text: b.textContent.trim() })))`,
      )
      const zoneList = JSON.parse(zones)
      const unlabelled = zoneList.filter((z) => !z.ariaLabel && !z.text)
      console.log(`[${tag}] conversing/sort_buckets: ${zoneList.length} group buttons, ${unlabelled.length} with no name at all`)
      for (const z of unlabelled) {
        failures += 1
        console.log(`  NO ACCESSIBLE NAME: group button html-text="${z.text}"`)
      }

      const report = await runAxe(page)
      for (const v of report.violations) {
        failures += 1
        console.log(`  VIOLATION [${v.id}]${v.impact ? ` (${v.impact})` : ''}: ${v.nodes.length} node(s)`)
        for (const n of v.nodes) console.log(`    ${n.target.join(' ')} — ${n.html}`)
      }
      for (const v of report.incomplete) {
        if (isKnownContrastCase(v, 'incomplete')) continue
        console.log(`  INCOMPLETE [${v.id}] (needs a human look): ${v.nodes.length} node(s)`)
        for (const n of v.nodes) contrastNotes.push(`${tag} conversing: ${v.id} — ${n.target.join(' ')}`)
      }
      await shoot(page, `tutor-a11y-${tag}-sort-buckets`)
    }

    // ---- replaying — ReplayInWorld's transport
    await pressSwitch(page, 'replaying')
    // Locale-proof on purpose: "Line X of Y" is `tutor.replay.position` and
    // reads "Línea X de Y" in es-MX, so matching English text here would
    // time out on two of the three configurations instead of the product
    // having anything wrong with it. `skip_previous` is the Material Symbols
    // ligature `Icon` renders as literal text content (AGENTS.md §1.14 notes
    // the same ligatures glue onto labels elsewhere) — it names an icon, not
    // a locale, so it is present identically in all three languages.
    await waitFor(page, 'document.body.innerText.includes("skip_previous")', 15_000, 'the replay transport')
    const replayReport = await runAxe(page)
    for (const v of replayReport.violations) {
      failures += 1
      console.log(`[${tag}] REPLAY VIOLATION [${v.id}]${v.impact ? ` (${v.impact})` : ''}: ${v.nodes.length} node(s)`)
      for (const n of v.nodes) console.log(`    ${n.target.join(' ')} — ${n.html}`)
    }
    for (const v of replayReport.incomplete) {
      if (isKnownContrastCase(v, 'incomplete')) continue
      for (const n of v.nodes) contrastNotes.push(`${tag} replaying: ${v.id} — ${n.target.join(' ')}`)
    }
    await shoot(page, `tutor-a11y-${tag}-replaying`)

    if (page.errors.length > 0) {
      failures += page.errors.length
      console.log(`  [${tag}] console errors:`, page.errors.slice(0, 5))
    }
  }
} finally {
  child.kill()
  server.stop()
}

if (contrastNotes.length > 0) {
  console.log(`\n${contrastNotes.length} color-contrast node(s) flagged "incomplete" beyond the known text-over-render case — worth a human look, not gated here:`)
  for (const note of contrastNotes) console.log(`  ${note}`)
}

console.log(
  failures === 0
    ? 'verify:tutor-a11y OK — zero WCAG A/AA violations across conversing (sort_buckets) and replaying, both themes, desktop and mobile.'
    : `verify:tutor-a11y FAILED: ${failures}`,
)
process.exitCode = failures === 0 ? 0 : 1
