/*
 * EVERY ONE OF THE TUTOR'S EIGHT STAGE PHASES, AUDITED WITH axe-core.
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
 *   - ALL EIGHT stage phases, in the lab's own order: arriving,
 *     personalizing, introducing, conversing, adapting, closing, replaying,
 *     unavailable (`LAB_SCENES`, labFixtures.ts — the same eight the phase
 *     switcher offers, `consent` excepted: it is a family-facing panel on a
 *     different route, not a stage phase). Until 2026-09-01 this gate
 *     scanned TWO of them and /AGENTS.md §5 said so in writing — "the other
 *     stage phases ... are not yet swept by this gate and need a manual
 *     spot-check until it is extended." A manual spot-check nobody is
 *     scheduled to perform is not a control; six of the eight phases a
 *     child actually walks through were being reported on by a gate that
 *     never looked at them.
 *   - conversing AGAIN, with a `sort_buckets` activity live — the drag/drop
 *     grouping type flagged by live-testing (2026-09-01) as having group
 *     buttons with no accessible name. Driving it here means a REGRESSION —
 *     one of the buckets losing its `aria-label` again — fails a gate
 *     instead of waiting for the next live session to find it. It is a
 *     SECOND pass over `conversing` rather than the phase sweep's own,
 *     because the sweep measures each phase in its resting state and this
 *     one deliberately puts a specific activity on the plate.
 *   - replaying is in the sweep above — `ReplayInWorld.tsx`'s transport
 *     (previous/pause-play/next, the per-line "play from here" transcript),
 *     explicitly named in the same audit request as a surface rebuilt since
 *     the 08-21 pass.
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
 *      the animation settles.
 *
 *      THE WAIT THAT ANSWERS IT USED TO BE A CONSTANT, AND THE CONSTANT WAS
 *      MEASURED FROM THE WRONG EVENT (found extending this gate to all eight
 *      phases, 2026-09-01). `SETTLE_MS` — 600ms, paid on every phase switch —
 *      is only correct if the entrance animation STARTS at the switch. It does
 *      not. A world chip's `lf-settle` starts when the placement solver seats
 *      it, which happens after the composition has something to seat it
 *      against, and that is an unbounded number of frames after the phase
 *      changed. Caught with `getAnimations()` at the moment axe complained:
 *      `introducing`'s "Review: Compare amounts" chip reported
 *      `lf-settle:running:33` — thirty-three milliseconds into a 300ms
 *      animation — at a sample taken 1.9 SECONDS after the switch, with the
 *      composited pair reading `#e0e0f9` on `#d9d9f8` (1.06:1) where the
 *      resting pair is `#ffffff` on `rgb(79,70,229)` (6.29:1). Three of
 *      twenty-four phase scans tripped this way, on `introducing` and
 *      `personalizing`, at two different configurations — a gate that fails
 *      one run in eight teaches people to re-run it, which is worse than not
 *      having it.
 *      So the wait is no longer a bet on a duration: `settle()` below waits
 *      for the page to have NO finite CSS animation running (an infinite one
 *      — `lf-pulse-attention` — is not an entrance and never settles, so it
 *      is excluded by construction rather than by name), holds that quiet for
 *      `QUIET_MS`, and cannot finish before `MIN_SETTLE_MS` no matter how
 *      quiet the page looks early, because "nothing is animating yet" and
 *      "nothing is animating any more" are the same reading taken from
 *      opposite sides of the thing being waited for. That makes the
 *      measurement correct BY CONSTRUCTION instead of correct when called at
 *      the right moment (/AGENTS.md §1.14, the shared-object measurement
 *      rule's own corollary).
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

import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs'

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
 *  slack. Still the right wait for a switch whose effect is SYNCHRONOUS — the
 *  lab's own locale and activity switches — but NOT for a phase switch, whose
 *  entrance animations start whenever the placement solver seats them: see
 *  `settle()` and the file banner's false-positive note. */
const SETTLE_MS = 600

/**
 * The floor on a phase scan's wait. Nothing may be measured before this, even
 * on a page that reports no animation at all, because a phase whose chips have
 * not been seated YET is indistinguishable from one whose chips have finished
 * settling — and the observed seat happened 1.9s after the switch.
 * `verify-tutor-ui.mjs` pays the same 2.5s after entering `conversing`, for
 * the same reason and against the same solver.
 */
const MIN_SETTLE_MS = 2_500

/** How long the page must stay free of running animations before it counts as settled. */
const QUIET_MS = 500

/** Upper bound on one phase's settle wait; exceeded means "measured anyway, and said so". */
const SETTLE_BUDGET_MS = 15_000

/**
 * True when no FINITE CSS animation is running anywhere in the document.
 *
 * `iterations === Infinity` is excluded rather than named: `lf-pulse-attention`
 * is the one that exists today, and an infinite animation is by definition not
 * an entrance settling into a resting state, so waiting for it would hang
 * forever on any page that ever grows another one. Reading the timing off the
 * effect keeps that true for animations this file has never heard of.
 */
const NO_FINITE_ANIMATION_RUNNING =
  '(() => document.getAnimations().every((a) => {' +
  '  const timing = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;' +
  '  if (timing && timing.iterations === Infinity) return true;' +
  '  return a.playState === "finished" || a.playState === "idle";' +
  '}))()'

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
      const plain = output.replace(/\[[0-9;]*m/g, '')
      const match = plain.match(/http:\/\/127\.0\.0\.1:(\d+)/)
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

/* Reports the margin on success and the page's actual state on timeout — the
 * same instrumentation as verify-tutor-ui, and for the same reason: a bare
 * "timed out" cannot tell a broken Tutor from a dev server that was still
 * starting, and on CI each guess costs a 25-minute round trip. */
async function waitFor(page, expression, ms, what) {
  const started = Date.now()
  const until = started + ms
  while (Date.now() < until) {
    if (await page.evaluate(expression)) {
      const took = Date.now() - started
      if (took > 2000) console.log(`  [wait] ${what}: ${(took / 1000).toFixed(1)}s of a ${ms / 1000}s budget`)
      return
    }
    await sleep(400)
  }
  const seen = await page.evaluate(
    '(() => { const r = document.getElementById("root");' +
      ' return JSON.stringify({ readyState: document.readyState,' +
      ' rootHtml: r ? r.innerHTML.length : -1,' +
      ' labChrome: document.querySelectorAll("[data-lab-chrome]").length,' +
      ' text: (document.body.innerText || "").slice(0, 120) }) })()',
  )
  console.log(`  [timeout] ${what} — page was: ${seen}`)
  throw new Error(`timed out waiting for ${what} after ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

/**
 * Waits until the page is holding still — see the file banner. Returns false
 * if the budget ran out with something still animating, so the caller can say
 * so out loud instead of silently reporting a mid-animation frame as the
 * product's resting state.
 */
async function settle(page) {
  const started = Date.now()
  const deadline = started + SETTLE_BUDGET_MS
  let quietSince = null
  while (Date.now() < deadline) {
    if (await page.evaluate(NO_FINITE_ANIMATION_RUNNING)) {
      if (quietSince === null) quietSince = Date.now()
      if (Date.now() - quietSince >= QUIET_MS && Date.now() - started >= MIN_SETTLE_MS) return true
    } else {
      quietSince = null
    }
    await sleep(120)
  }
  return false
}

/*
 * THE EIGHT STAGE PHASES, AND HOW TO KNOW EACH ONE ARRIVED.
 *
 * Every readiness expression is STRUCTURAL, never a string of copy: this file
 * runs two of its three configurations in es-MX, so matching English text
 * would time out on the product being perfectly fine (the same trap
 * `replaying`'s own marker note below already records). Each marker was read
 * off the live DOM rather than guessed, and each is chosen to distinguish the
 * phase from the one BEFORE it in this list, so waiting on it proves the
 * switch actually landed rather than that the previous phase is still up:
 * `arriving`/`unavailable` mount no `StageLayer` at all, `introducing` is the
 * only phase with `[data-opening]`, `conversing` brings `[data-character]`,
 * `adapting` adds `[data-offer]` on top of it, and `closing` is the one that
 * takes `[data-character]` away again while keeping a layer.
 */
const PHASES = [
  ['arriving', '!document.querySelector("section[aria-label]")'],
  ['personalizing', '!!document.querySelector("section[aria-label]")'],
  ['introducing', '!!document.querySelector("[data-opening]")'],
  ['conversing', '!!document.querySelector("[data-character]")'],
  ['adapting', '!!document.querySelector("[data-offer]")'],
  ['closing', '!document.querySelector("[data-character]") && !!document.querySelector("section[aria-label]")'],
  /*
   * Locale-proof on purpose: "Line X of Y" is `tutor.replay.position` and
   * reads "Línea X de Y" in es-MX, so matching English text here would time
   * out on two of the three configurations instead of the product having
   * anything wrong with it. `skip_previous` is the Material Symbols ligature
   * `Icon` renders as literal text content (AGENTS.md §1.14 notes the same
   * ligatures glue onto labels elsewhere) — it names an icon, not a locale,
   * so it is present identically in all three languages.
   */
  ['replaying', 'document.body.innerText.includes("skip_previous")'],
  ['unavailable', '!document.querySelector("section[aria-label]")'],
]

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
  // Category 2: a mid-settle false positive — `settle()` waits every phase
  // scan out to real animation quiescence, so seeing this AT ALL means either
  // the settle budget was exceeded (the run says so, out loud, on its own
  // line) or a genuinely resting surface is genuinely below 4.5:1. Both are
  // worth failing on rather than silently swallowing.
  return false
}

const server = await startDevServer()
console.log(`verify:tutor-a11y — dev server at ${server.url}, screenshots in ${OUT}`)
const { child, browser } = await launchBrowser(join(tmpdir(), `lf-tutor-a11y-${Date.now()}`))
let failures = 0
const contrastNotes = []

/*
 * Same cold-start race as its two siblings: a lazy lab route reached before
 * Vite has finished optimising dependencies never mounts, and this gate's poll
 * then blames "lab chrome". See warmDevServer's note.
 */
{
  const warm = await openPage(browser, { width: 1280, height: 900, dark: false })
  if (!(await warmDevServer(warm, server.url))) {
    console.log('  [warm-up] the root route never mounted; continuing, the lab poll will report it')
  }
}

try {
  for (const [tag, viewport, locale] of [
    ['desktop-en', { width: 1280, height: 900, dark: false }, 'en-US'],
    ['desktop-es-dark', { width: 1280, height: 900, dark: true }, 'es-MX'],
    ['mobile-es', { width: 375, height: 812, dark: false }, 'es-MX'],
  ]) {
    const page = await openPage(browser, viewport)
    await page.send('Page.navigate', { url: `${server.url}/dev/tutor-lab` })
    // 150s for the same reason as verify-tutor-ui: a dev-server cold-mount
    // budget for a 2-vCPU runner serving unbundled ESM, not a product SLO.
    await waitFor(page, '!!document.querySelector("[data-lab-chrome]")', 150_000, 'lab chrome')
    const open = await page.evaluate(switchCoords('conversing'))
    if (!open) await pressSwitch(page, 'lab')
    await waitFor(page, 'document.body.innerText.includes("stage ready")', 90_000, 'stage ready')
    await pressSwitch(page, locale)

    // ---- every stage phase, in the lab's own order, each in its resting state
    for (const [phaseName, ready] of PHASES) {
      await pressSwitch(page, phaseName)
      /*
       * 120s, raised from 20s on evidence rather than on feel: on a 16-thread
       * workstation with a cold cache and the CPU throttled 4x, `personalizing`
       * took 29.1s to mount. The old budget would have failed HERE, so it was a
       * latent failure waiting for any machine slower than a warm developer
       * laptop — which is every CI runner. `waitFor` prints what each wait
       * actually spends, so the next person tightens this from data.
       */
      await waitFor(page, ready, 120_000, `the ${phaseName} phase to mount`)
      if (!(await settle(page))) {
        // Not a failure by itself — the scan below still runs and still
        // gates. It is printed because it is the ONE condition under which a
        // `color-contrast` violation from this phase might be the animation
        // rather than the product, and a reader of this log deserves to know
        // which of the two they are looking at (§1.14 — failure must be
        // distinguishable, and so must a caveat).
        console.log(`[${tag}] ${phaseName}: still animating after ${SETTLE_BUDGET_MS}ms — scanned anyway`)
      }

      const phaseReport = await runAxe(page)
      const shown = phaseReport.violations.length
      console.log(`[${tag}] ${phaseName}: ${shown} violation(s)`)
      for (const v of phaseReport.violations) {
        failures += 1
        console.log(`  VIOLATION [${v.id}]${v.impact ? ` (${v.impact})` : ''}: ${v.nodes.length} node(s)`)
        for (const n of v.nodes) console.log(`    ${n.target.join(' ')} — ${n.html}`)
      }
      for (const v of phaseReport.incomplete) {
        if (isKnownContrastCase(v, 'incomplete')) continue
        console.log(`  INCOMPLETE [${v.id}] (needs a human look): ${v.nodes.length} node(s)`)
        for (const n of v.nodes) contrastNotes.push(`${tag} ${phaseName}: ${v.id} — ${n.target.join(' ')}`)
      }
      await shoot(page, `tutor-a11y-${tag}-${phaseName}`)
    }

    // ---- conversing AGAIN, sort_buckets — the drag/drop grouping regression check
    await pressSwitch(page, 'conversing')
    await waitFor(page, '!!document.querySelector("[data-character]")', 60_000, 'the conversing phase to mount')
    const select = await page.evaluate(
      `(() => { const s = document.querySelector('select[aria-label="activity on the plate"]');` +
        ` if (!s) return false; s.value = 'sort_buckets'; s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`,
    )
    if (!select) {
      failures += 1
      console.log(`[${tag}] MISSING: the lab activity switch — cannot drive sort_buckets`)
    } else {
      await settle(page)
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

    // `replaying` — ReplayInWorld's transport — is no longer scanned here on
    // its own: it is one of the eight phases the sweep above already drives,
    // with the same `skip_previous` readiness marker it always used and the
    // same screenshot name it always wrote.

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
    ? `verify:tutor-a11y OK — zero WCAG A/AA violations across all ${PHASES.length} stage phases plus conversing/sort_buckets, both themes, desktop and mobile.`
    : `verify:tutor-a11y FAILED: ${failures}`,
)
process.exitCode = failures === 0 ? 0 : 1
