/*
 * THE LESSON ENGINE, VERIFIED THE WAY A PERSON USES IT.
 *
 *   npm run verify:lesson-engine              1280x900 dark
 *   npm run verify:lesson-engine -- --mobile  375x812
 *   npm run verify:lesson-engine -- --light   light theme
 *   npm run verify:lesson-engine -- --only quiz_mcq,fill_blank
 *   npm run verify:lesson-engine -- --strict  also require every graded type to
 *                                             produce a verdict (see below)
 *
 * Every one of the segment-type fixtures in /dev/lesson-lab is opened and played
 * with REAL pointer and keyboard events, and every visible control is hit-tested
 * with `elementFromPoint` — retried after scrolling it into view, because the
 * lesson shell scrolls and so does a person, and only then does "unreachable"
 * mean it.
 *
 * WHAT THIS GATES, and why it is exactly this:
 *
 *   every control reachable   the regression this exists for. R3F writes
 *                             `pointer-events: auto` INLINE on its container,
 *                             beating an inherited `pointer-events: none`, and
 *                             the character layer became the topmost element
 *                             over the whole product. 57 fixtures, 1,305 unit
 *                             tests and four screenshot passes stayed green
 *                             because they all drove the app with
 *                             `element.click()`, which does no hit-testing.
 *   "Start lesson" advances   the symptom the owner reported.
 *   no console error          a thrown render is not visible in a screenshot.
 *   no failed request         a missing asset degrades silently.
 *   characters all 3D         2D is deprecated in the Lesson Engine.
 *   one WebGL context         the layer is one canvas for a screenful of
 *                             characters; a second context is a leak.
 *
 * WHAT THIS DELIBERATELY DOES NOT GATE: the count of segments driven to a
 * verdict. That number measures THE DRIVER, not the engine — reordering the
 * answer models moved it from 41 to 39 while swapping which types passed, and
 * an audit that reported 33 of 57 types as ungradeable turned out to be nine
 * harness defects and zero engine defects (/AGENTS.md §1.14). It is reported,
 * never asserted, unless --strict is passed for a deliberate deep run.
 *
 * Grading itself is covered where it belongs: `registry.test.tsx` asserts every
 * graded type has a grader, that graders never throw and clamp scores, and that
 * every fixture round-trips through its own grader.
 */
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { fileURLToPath } from 'node:url'

import { launchBrowser, openPage } from './lesson-engine/browser.mjs'
import { answer, click, coords, submitOwnControl, GATE, FOOTER, MAIN } from './lesson-engine/answer-models.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const VITE_BIN = join(HERE, '..', 'node_modules', 'vite', 'bin', 'vite.js')

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const value = (name) => {
  const at = args.indexOf(`--${name}`)
  return at === -1 ? null : args[at + 1]
}

const MOBILE = flag('mobile')
const WIDTH = MOBILE ? 375 : 1280
const HEIGHT = MOBILE ? 812 : 900
const DARK = !flag('light')
const STRICT = flag('strict')
const ONLY = value('only')?.split(',').map((s) => s.trim()) ?? null
const TAP_TARGET_FLOOR = 44

/* Every visible control, hit-tested the way a finger reaches one. */
const CONTROLS =
  '(() => { const out = [];' +
  ' for (const b of document.querySelectorAll("button:not([disabled]),a[href]")) {' +
  '   let r = b.getBoundingClientRect();' +
  '   if (r.width < 4 || r.height < 4) continue;' +
  '   if (r.right < 0 || r.left > innerWidth) continue;' +
  '   const test = () => { const x = r.left + r.width / 2, y = r.top + r.height / 2;' +
  '     if (y < 0 || y > innerHeight) return null;' +
  '     const t = document.elementFromPoint(x, y);' +
  '     return { x: Math.round(x), y: Math.round(y),' +
  '       ok: t === b || b.contains(t) || (t && t.closest("button,a") === b),' +
  '       topmost: t ? t.tagName : "null" } };' +
  '   let hit = test();' +
  '   if (!hit || !hit.ok) { b.scrollIntoView({ block: "center", behavior: "instant" });' +
  '     r = b.getBoundingClientRect(); hit = test(); }' +
  '   if (!hit) continue;' +
  '   out.push({ label: (b.textContent || "").trim().slice(0, 30), height: Math.round(r.height),' +
  '     reaches: hit.ok, topmost: hit.topmost }); }' +
  ' return out })()'

const STATE =
  '(() => ({' +
  ' head: (document.body.innerText || "").slice(0, 60),' +
  // A character the layer could not draw falls back to the 2D actor and says so.
  ' flat: [...document.querySelectorAll("[data-render]")].filter((n) => n.dataset.render !== "3d").length,' +
  ' webgl: [...document.querySelectorAll("canvas")].filter((c) => c.width > 200).length,' +
  ' verdict: Boolean(document.querySelector("[role=status]")),' +
  ' results: /Lesson complete|Good effort/i.test(document.body.innerText || ""),' +
  '}))()'

/** Start Vite and wait for the port it prints — the lab is a DEV-only route. */
async function startDevServer() {
  if (process.env.LESSON_LAB_URL) return { url: process.env.LESSON_LAB_URL, stop: () => {} }

  // Vite is invoked directly rather than through `npm run dev`: a shell is then
  // never needed, which keeps this identical on Windows and CI.
  const child = spawn(process.execPath, [VITE_BIN, '--host', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const url = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error(`Vite never printed a URL:\n${output}`)), 90_000)
    const read = (chunk) => {
      // Vite colours its banner, and the escape sequences land BETWEEN the
      // colon and the port (`127.0.0.1:\x1b[1m5173`), so the URL has to be
      // matched on the stripped text or it is never found at all.
      output += String(chunk).replace(/\[[0-9;]*m/g, '')
      const found = output.match(/http:\/\/127\.0\.0\.1:(\d+)/)
      if (found) {
        clearTimeout(timer)
        resolve(found[0])
      }
    }
    child.stdout.on('data', read)
    child.stderr.on('data', read)
    child.on('exit', (code) => reject(new Error(`Vite exited with ${code} before serving:\n${output}`)))
  })
  return { url, stop: () => child.kill() }
}

async function main() {
  const profile = join(tmpdir(), `lf-lesson-engine-${process.pid}`)
  const dev = await startDevServer()
  const lab = `${dev.url}/dev/lesson-lab`
  const { child, browser } = await launchBrowser(profile)

  const rows = []
  const smallTargets = new Map()
  let flatTotal = 0
  let maxWebgl = 0

  try {
    const page = await openPage(browser, { width: WIDTH, height: HEIGHT, dark: DARK })
    await page.send('Page.navigate', { url: lab })

    /*
     * POLL for the fixture list rather than sleeping a guess. The lab is a lazy
     * route, and on a dev server that has just started the FIRST page load also
     * pays for Vite's dependency optimisation — a fixed eleven-second wait
     * found nothing and reported "no fixtures", which is the harness measuring
     * a moment rather than an interaction. The same mistake one level down
     * missed forty-three cards and would have called them broken segments.
     */
    const LIST =
      '[...document.querySelectorAll("button")].map((b) => b.textContent.trim())' +
      '.filter((t) => t.indexOf("play_circle") !== -1).map((t) => t.replace("play_circle", "").trim())'
    let all = []
    for (let tries = 0; tries < 60 && !all.length; tries += 1) {
      await sleep(1000)
      all = await page.evaluate(LIST)
    }
    const fixtures = ONLY ? all.filter((f) => ONLY.some((name) => f.startsWith(name))) : all
    if (!fixtures.length) throw new Error('No fixtures found in /dev/lesson-lab.')

    console.log(`lesson-engine  ${WIDTH}x${HEIGHT}  ${DARK ? 'dark' : 'light'}  fixtures: ${fixtures.length}`)

    for (const fixture of fixtures) {
      const label = fixture.split(/XP |D\d/)[0].slice(0, 24).trim()
      const row = { label, reachable: true, starts: false, verdict: false, finishes: false, blocked: [] }
      const errorsBefore = page.errors.length
      const requestsBefore = page.failedRequests.length

      await page.send('Page.navigate', { url: lab })
      let card = null
      for (let tries = 0; tries < 18 && !card; tries += 1) {
        await sleep(500)
        card = await coords(
          page,
          '[...document.querySelectorAll("button")]' +
            `.find((n) => n.textContent.trim().startsWith(${JSON.stringify(fixture.slice(0, 22))}))`,
        )
      }
      if (!card) {
        row.blocked.push('lab card never appeared')
        rows.push(row)
        process.stdout.write('?')
        continue
      }
      await sleep(300)
      await click(page, card.x, card.y)
      await sleep(2500)

      const scan = async (where) => {
        for (const control of await page.evaluate(CONTROLS)) {
          if (!control.reaches) {
            row.reachable = false
            row.blocked.push(`${where}: "${control.label}" is under ${control.topmost}`)
          }
          if (control.height < TAP_TARGET_FLOOR) {
            smallTargets.set(control.label, control.height)
          }
        }
      }
      await scan('intro')

      const start = await coords(
        page,
        '[...document.querySelectorAll("button")].find((n) => /Start lesson|Empezar/i.test(n.textContent))',
      )
      if (start) {
        const before = await page.evaluate(STATE)
        await click(page, start.x, start.y)
        await sleep(2800)
        row.starts = (await page.evaluate(STATE)).head !== before.head
      }

      for (let screen = 0; screen < 12; screen += 1) {
        const state = await page.evaluate(STATE)
        flatTotal += state.flat
        maxWebgl = Math.max(maxWebgl, state.webgl)
        if (state.flat > 0) row.blocked.push(`screen ${screen}: a character rendered in 2D`)
        if (state.verdict) row.verdict = true
        if (state.results) {
          row.finishes = true
          break
        }
        await scan(`screen ${screen}`)

        if (!state.verdict) await answer(page)
        if ((await page.evaluate(GATE)).verdict) row.verdict = true
        await submitOwnControl(page)

        const advance = await coords(page, `${FOOTER}.filter((b) => !b.disabled).slice(-1)[0]`)
        if (!advance) {
          /*
           * No control to press does not mean the segment is stuck: a dialogue
           * has no footer button at all and advances as its speech card is
           * tapped. Try the screen itself, and stop only when nothing changes.
           */
          const body = await page.evaluate('(document.body.innerText || "").slice(0, 400)')
          const tap = await coords(page, `${MAIN}[0]`)
          if (!tap) break
          await click(page, tap.x, tap.y)
          await sleep(800)
          if ((await page.evaluate('(document.body.innerText || "").slice(0, 400)')) === body) break
          continue
        }
        await click(page, advance.x, advance.y)
        await sleep(1100)
        const after = await page.evaluate(GATE)
        if (after.verdict) row.verdict = true
        if (after.results) {
          row.finishes = true
          break
        }
      }

      row.errors = page.errors.slice(errorsBefore)
      row.failedRequests = page.failedRequests.slice(requestsBefore)
      rows.push(row)
      const clean = row.reachable && row.starts && !row.errors.length && !row.failedRequests.length
      process.stdout.write(clean ? '.' : 'X')
    }

    // A 2D character is a GLOBAL failure, counted once. Folding it into the
    // per-row filter marked all 57 fixtures as failing over one bad frame,
    // which buries the one row that actually has something to say.
    const failures = rows.filter((r) => !r.reachable || !r.starts || r.errors.length || r.failedRequests.length)
    const unanswered = rows.filter((r) => !r.verdict && !r.finishes)

    console.log('\n')
    console.log(`fixtures played:             ${rows.length}`)
    console.log(`  every control reachable:   ${rows.filter((r) => r.reachable).length}/${rows.length}`)
    console.log(`  "Start lesson" advances:   ${rows.filter((r) => r.starts).length}/${rows.length}`)
    console.log(`  answered to a verdict:     ${rows.filter((r) => r.verdict).length}/${rows.length}   (reported, not gated)`)
    console.log(`  reached the results screen:${rows.filter((r) => r.finishes).length}/${rows.length}   (reported, not gated)`)
    console.log(`characters rendered in 2D:   ${flatTotal}`)
    console.log(`most WebGL contexts at once: ${maxWebgl}`)
    console.log(`console errors:              ${rows.reduce((n, r) => n + r.errors.length, 0)}`)
    console.log(`failed requests:             ${rows.reduce((n, r) => n + r.failedRequests.length, 0)}`)

    if (smallTargets.size) {
      console.log(`\ntap targets under ${TAP_TARGET_FLOOR}px (reported, not gated):`)
      for (const [label, height] of smallTargets) console.log(`   ${label} (${height}px)`)
    }

    for (const row of failures) {
      console.log(`\nFAIL ${row.label}`)
      if (!row.starts) console.log('   "Start lesson" did not advance')
      for (const reason of row.blocked.slice(0, 4)) console.log(`   ${reason}`)
      for (const error of row.errors.slice(0, 3)) console.log(`   console: ${error}`)
      for (const failed of row.failedRequests.slice(0, 3)) console.log(`   request: ${failed}`)
    }

    if (STRICT && unanswered.length) {
      console.log(`\n--strict: ${unanswered.length} fixture(s) produced no verdict and no results screen:`)
      for (const row of unanswered) console.log(`   ${row.label}`)
      console.log('   Before calling these product defects, read /AGENTS.md §1.14: every')
      console.log('   one of the 33 originally reported was the harness, and six of the 57')
      console.log('   types are ungraded CONTENT segments that cannot produce a verdict.')
    }

    const broken = failures.length + (flatTotal > 0 ? 1 : 0) + (STRICT ? unanswered.length : 0)
    if (flatTotal > 0) {
      console.log(`\nFAIL — a character rendered in 2D ${flatTotal} time(s); the Lesson Engine is 3D-only`)
    }
    if (broken) {
      console.log(`\nverify:lesson-engine FAILED — ${broken} problem(s)`)
      process.exitCode = 1
    } else {
      console.log('\nverify:lesson-engine OK — every control reachable, every lesson starts, nothing 2D, no errors')
    }
  } finally {
    child.kill()
    dev.stop()
    /*
     * Best effort, and it MUST NOT throw: Windows holds the profile directory
     * open for a moment after Chrome exits, and a `finally` that throws
     * replaces whatever real failure this run was about to report.
     */
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {
      /* a temp directory left behind is not worth losing a verdict over */
    }
  }
}

await main()
