/*
 * THE TUTOR'S HUD, VERIFIED THE WAY A PERSON USES IT.
 *
 *   npm run verify:tutor-ui
 *
 * Drives /dev/tutor-lab's conversing phase at three configurations — desktop
 * light en-US, desktop dark es-MX, mobile light es-MX — and hit-tests EVERY
 * visible product control with `elementFromPoint`, exactly as
 * verify-lesson-engine does and for exactly the same reason: a synthetic
 * `element.click()` does no hit-testing, so an overlay can swallow every
 * control while every other kind of audit stays green (/AGENTS.md §1.14 —
 * that is how the Lesson Engine shipped unusable).
 *
 * What this gates:
 *   every control reachable    the character layer, the caption, the docked
 *                              panel and the dock all stack over one canvas;
 *                              any of them can occlude a control.
 *   the edit affordance works  driven with REAL mouse events: pressing the
 *                              pencil on the last learner message must fill
 *                              the composer.
 *   explain-differently policy hidden while an activity is up (the learner
 *                              has a task), by design — asserted, not skipped.
 *   no console errors          a thrown render is invisible in a screenshot.
 *
 * The lab's own instrument panel is collapsed before measuring: it is dev
 * chrome floating over the product, and a harness that measures its own
 * occlusion reports the product as broken (§1.14, the harness-defect class).
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { launchBrowser, openPage } from './lesson-engine/browser.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const VITE_BIN = join(HERE, '..', 'node_modules', 'vite', 'bin', 'vite.js')
const OUT = join(tmpdir(), 'lf-verify-tutor-ui')
mkdirSync(OUT, { recursive: true })

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
      // Vite colours its banner; strip the escape codes or the URL is never
      // matched (same note as verify-lesson-engine's server starter).
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

/* Every visible product control, hit-tested the way a finger reaches one. */
const SWEEP =
  '(() => { const out = [];' +
  ' for (const b of document.querySelectorAll("button:not([disabled]),a[href],input:not([disabled])")) {' +
  '   if (b.closest("[data-lab-chrome]")) continue;' +
  '   if (b.closest("[inert]") || b.inert) continue;' +
  '   let r = b.getBoundingClientRect();' +
  '   if (r.width < 4 || r.height < 4) continue;' +
  '   if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) continue;' +
  // A control inside a scroller is reachable through the scroller's VIEW.
  // Clip the test rect to every scrollable ancestor; a control that is
  // entirely scrolled away is skipped — a finger scrolls to it, it is not
  // painted over. Without this, the third option of a half-open sheet
  // reported as unreachable while sitting exactly where a scroller puts it.
  '   let clip = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };' +
  '   for (let a = b.parentElement; a; a = a.parentElement) {' +
  '     const s = getComputedStyle(a);' +
  '     if (!/auto|scroll|hidden/.test(s.overflowY + s.overflowX)) continue;' +
  '     const ar = a.getBoundingClientRect();' +
  '     clip.left = Math.max(clip.left, ar.left); clip.top = Math.max(clip.top, ar.top);' +
  '     clip.right = Math.min(clip.right, ar.right); clip.bottom = Math.min(clip.bottom, ar.bottom);' +
  '   }' +
  '   if (clip.right - clip.left < 4 || clip.bottom - clip.top < 4) continue;' +
  '   const x = clip.left + (clip.right - clip.left) / 2, y = clip.top + (clip.bottom - clip.top) / 2;' +
  '   if (y < 0 || y > innerHeight) continue;' +
  '   const t = document.elementFromPoint(x, y);' +
  '   const ok = t === b || b.contains(t) || (t && t.closest("button,a,label,input") === b);' +
  '   out.push({ name: (b.getAttribute("aria-label") || b.textContent || b.placeholder || b.tagName).trim().slice(0, 40),' +
  '     reaches: ok, topmost: t ? t.tagName + "." + String(t.className).slice(0, 30) : "null" }); }' +
  ' return out })()'

/*
 * THE OVERLAP AUDIT (V4). The sweep proves a control is REACHABLE; nothing
 * proved two surfaces were not painted over each other — which is exactly how
 * the caption spent weeks disappearing under the docked lesson panel while
 * every gate stayed green (the caption is pointer-events-none, so no control
 * was "unreachable"). This measures the rects of the surfaces that share the
 * conversing screen and fails on any pair that intersects by more than 8 px
 * on both axes. Names, not selectors, so the report reads like the defect.
 */
const OVERLAPS =
  '(() => { const rects = [];' +
  ' const grab = (name, el) => { if (!el) return; const r = el.getBoundingClientRect();' +
  '   if (r.width > 8 && r.height > 8) rects.push({ name, l: r.left, t: r.top, r: r.right, b: r.bottom }); };' +
  ' grab("caption", document.querySelector(".lf-speech"));' +
  ' grab("lesson-plate", document.querySelector("[data-plate-body]"));' +
  ' grab("dock", document.querySelector(\'[data-mic-dock]\'));' +
  ' const out = [];' +
  ' for (let i = 0; i < rects.length; i += 1) for (let j = i + 1; j < rects.length; j += 1) {' +
  '   const a = rects[i], b = rects[j];' +
  '   const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);' +
  '   const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);' +
  '   if (w > 8 && h > 8) out.push(a.name + " overlaps " + b.name + " by " + Math.round(w) + "x" + Math.round(h) + "px");' +
  ' }' +
  ' return out })()'

async function realClick(page, x, y) {
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

const centerOf = (selectorExpr) =>
  `(() => { const b = ${selectorExpr}; if (!b) return null; const r = b.getBoundingClientRect();` +
  ` return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } })()`

const switchCoords = (label) =>
  `(() => { const b = [...document.querySelectorAll('[data-lab-chrome] button')]` +
  `.find((n) => n.textContent.trim() === ${JSON.stringify(label)});` +
  ` if (!b) return null; const r = b.getBoundingClientRect();` +
  ` return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } })()`

async function pressSwitch(page, label) {
  const at = await page.evaluate(switchCoords(label))
  if (!at) throw new Error(`lab switch "${label}" not found`)
  await realClick(page, at.x, at.y)
}

/*
 * THE LAB PANEL, OPENED AND CLOSED BY ITS ACTUAL STATE RATHER THAN BY A COUNT
 * OF HOW MANY TIMES IT HAS BEEN TOGGLED.
 *
 * `pressSwitch(page, 'lab')` is not idempotent and never was: 'lab' is the
 * COLLAPSED chip and 'hide' is the OPEN panel's header button, so the same
 * call throws "lab switch not found" whenever the panel happens to already be
 * open. The whiteboard loop below toggles open/closed once per kind and had
 * been assuming those toggles stay in phase — which held for three kinds and
 * then, on the run that added a fourth, did not: one run failed at the fourth
 * iteration's first press with the panel open, and the very next identical run
 * passed. Intermittent, not deterministic, and the exact mechanism that put
 * the panel back open was never pinned down (the toggle cycle reproduces
 * cleanly in isolation, at the loop's own timing, for all four kinds).
 *
 * So the assumption goes rather than the count: ask what state the panel is
 * in, act only if it is the wrong one, and confirm the change landed. An
 * unproven root cause is not a reason to keep a construct that can only be
 * correct when a guess about state is correct — and a gate that fails one run
 * in two teaches people to re-run it, which is worse than not having it.
 */
const PANEL_IS_OPEN =
  `(() => [...document.querySelectorAll('[data-lab-chrome] button')]` +
  `.some((n) => n.textContent.trim() === 'hide'))()`

async function setLabPanel(page, open) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await page.evaluate(PANEL_IS_OPEN)) === open) return
    await pressSwitch(page, open ? 'lab' : 'hide')
    await sleep(250)
  }
  if ((await page.evaluate(PANEL_IS_OPEN)) !== open) {
    throw new Error(`the lab panel would not ${open ? 'open' : 'close'}`)
  }
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

const server = await startDevServer()
console.log(`verify:tutor-ui — dev server at ${server.url}, screenshots in ${OUT}`)
const { child, browser } = await launchBrowser(join(tmpdir(), `lf-tutor-ui-${Date.now()}`))
let failures = 0

try {
  for (const [tag, viewport, locale] of [
    ['desktop-en', { width: 1280, height: 900, dark: false }, 'en-US'],
    ['desktop-es-dark', { width: 1280, height: 900, dark: true }, 'es-MX'],
    ['mobile-es', { width: 375, height: 812, dark: false }, 'es-MX'],
  ]) {
    const page = await openPage(browser, viewport)
    await page.send('Page.navigate', { url: `${server.url}/dev/tutor-lab` })
    await waitFor(page, '!!document.querySelector("[data-lab-chrome]")', 60_000, 'lab chrome')
    await setLabPanel(page, true)
    await waitFor(page, 'document.body.innerText.includes("stage ready")', 90_000, 'stage ready')
    await pressSwitch(page, locale)
    await sleep(400)
    await pressSwitch(page, 'conversing')
    await sleep(2500)
    await setLabPanel(page, false)
    await sleep(300)

    const controls = await page.evaluate(SWEEP)
    const unreachable = controls.filter((c) => !c.reaches)
    console.log(`[${tag}] ${controls.length} controls, ${unreachable.length} unreachable`)
    for (const c of unreachable) {
      failures += 1
      console.log(`  UNREACHABLE: "${c.name}" — topmost ${c.topmost}`)
    }
    const overlaps = await page.evaluate(OVERLAPS)
    for (const o of overlaps) {
      failures += 1
      console.log(`  OVERLAP: ${o}`)
    }
    await shoot(page, `tutor-ui-${tag}`)

    /*
     * THE ACTIVITY PASS (V4) — the blindness that let a broken floating
     * lesson ship. At PEEK the plate body is display:none, so the sweep's
     * zero-rect filter silently skipped every activity control: Check, the
     * options, all of it, on every run, while printing OK. On mobile the
     * gate now opens the sheet the way a child does — a real tap on the peek
     * row — and sweeps INSIDE it; on desktop the plate is already docked and
     * the main sweep covers it.
     */
    if (tag === 'mobile-es') {
      const peek = await page.evaluate(
        centerOf(`[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').match(/actividad|activity|lección|lesson/i) || b.closest('[data-sheet-peek]'))`),
      )
      const alreadyOpen = await page.evaluate(
        `(() => { const p = document.querySelector('[data-plate-body]'); return p ? p.getBoundingClientRect().height > 100 : false })()`,
      )
      if (!peek && alreadyOpen) {
        // V4: an announced activity raises the sheet on its own, so there is
        // no resting peek row to tap — and the main sweep above already
        // hit-tested the open plate's controls.
        console.log('  sheet already open (announced activity) — covered by the main sweep')
      } else if (!peek) {
        console.log('  NOTE: no peek row found — no activity in this scene, sheet pass skipped')
      } else {
        await realClick(page, peek.x, peek.y)
        await sleep(900)
        const inPlate = await page.evaluate(
          `(() => { const plate = document.querySelector('[data-plate-body]');` +
            ` if (!plate) return null; const r = plate.getBoundingClientRect(); return r.height > 100 })()`,
        )
        if (inPlate !== true) {
          failures += 1
          console.log('  SHEET: tapping the peek row did not open the activity')
        } else {
          const plateControls = await page.evaluate(SWEEP)
          const plateUnreachable = plateControls.filter((c) => !c.reaches)
          console.log(`  [sheet open] ${plateControls.length} controls, ${plateUnreachable.length} unreachable`)
          for (const c of plateUnreachable) {
            failures += 1
            console.log(`  UNREACHABLE IN SHEET: "${c.name}" — topmost ${c.topmost}`)
          }
          const sheetOverlaps = await page.evaluate(OVERLAPS)
          for (const o of sheetOverlaps) {
            failures += 1
            console.log(`  OVERLAP WITH SHEET OPEN: ${o}`)
          }
          await shoot(page, `tutor-ui-${tag}-sheet-open`)
        }
      }
    }

    /*
     * The caption must never sit inside the docked panel's rect (desktop).
     * This is the owner-reported defect, pinned as geometry.
     */
    if (tag.startsWith('desktop')) {
      const captionInPanel = await page.evaluate(
        '(() => { const cap = document.querySelector(".lf-speech");' +
          ' const plate = document.querySelector("[data-plate-body]");' +
          ' if (!cap || !plate) return false;' +
          ' const c = cap.getBoundingClientRect(), p = plate.getBoundingClientRect();' +
          ' const w = Math.min(c.right, p.right) - Math.max(c.left, p.left);' +
          ' const h = Math.min(c.bottom, p.bottom) - Math.max(c.top, p.top);' +
          ' return w > 8 && h > 8 })()',
      )
      if (captionInPanel) {
        failures += 1
        console.log('  CAPTION UNDER PANEL: the tutor\'s words are painted over by the activity')
      }
    }

    if (tag === 'desktop-en') {
      const activityUp = await page.evaluate(
        `!!document.querySelector('[data-plate-body]') && /Check|Comprobar/.test(document.body.innerText)`,
      )
      const chip = await page.evaluate(
        centerOf(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('another way'))`),
      )
      if (activityUp) {
        console.log(`  explain-differently hidden while an activity is up (by design): ${chip === null}`)
        if (chip !== null) failures += 1
      } else if (!chip) {
        failures += 1
        console.log('  MISSING: explain-differently chip')
      } else {
        await realClick(page, chip.x, chip.y)
        await sleep(600)
        const landed = await page.evaluate(
          `document.body.innerText.includes('Can you explain it another way?')`,
        )
        console.log(`  explain-differently click lands in the log: ${landed}`)
        if (!landed) failures += 1
      }

      const pencil = await page.evaluate(
        centerOf(`document.querySelector('button[aria-label="Rephrase this message"]')`),
      )
      if (activityUp) {
        // Same design rule as explain-differently: no rewind mid-activity.
        console.log(`  edit affordance hidden while an activity is up (by design): ${pencil === null}`)
        if (pencil !== null) failures += 1
      } else if (!pencil) {
        failures += 1
        console.log('  MISSING: edit affordance on the last learner message')
      } else {
        await realClick(page, pencil.x, pencil.y)
        await sleep(300)
        const filled = await page.evaluate(
          `(() => { const i = [...document.querySelectorAll('input')].find((n) => n.placeholder && n.placeholder.includes('Rephrase')); return i ? i.value.length > 0 : false })()`,
        )
        console.log(`  edit affordance fills the composer: ${filled}`)
        if (!filled) failures += 1
      }

      /*
       * THE WHITEBOARD (V4) — all FOUR kinds (`sequence` via the lab's own
       * `'whiteboard'` activity id, then `compare`, `marked_line` and
       * `categories` — /ORACLE.md §20.5 backlog: "same schema family,
       * straightforward once sequence is proven live"). The owner's own
       * defect: a growth story narrated in pure text beside an unrelated
       * activity.
       *
       * `categories` was added 2026-09-01, closing a gap /ORACLE.md §20.5 had
       * flagged in writing rather than dropped: the argument for leaving it
       * out was that the existing scenarios "already exercise the shared
       * container/DOM shape this kind renders into." True of the SHELL and
       * false of the thing that has actually broken here — `CategoriesBoard`
       * draws its own `height: N%` bars (TutorWhiteboard.tsx), which is
       * precisely the construct that rendered at ZERO PIXELS in every real
       * browser for `sequence` from launch until the check below was written.
       * A per-kind component with per-kind bars needs a per-kind measurement;
       * inheriting a wrapper is not inheriting a layout.
       *
       * The activity switch lives in
       * the same chrome panel `hide` just unmounted (`panelOpen` gates the
       * whole panel, not just its visibility), so briefly reopen it for EACH
       * kind — via `setLabPanel`, which asks the panel what state it is in
       * rather than assuming (see its own comment) — flip the fixture, and
       * hide again before measuring, so the chrome is absent from the
       * screenshot exactly like every other tag.
       */
      await setLabPanel(page, true)
      const activitySelect = await page.evaluate(
        centerOf(`document.querySelector('select[aria-label="activity on the plate"]')`),
      )
      if (!activitySelect) {
        failures += 1
        console.log('  MISSING: the lab activity switch — cannot drive the whiteboard scenarios')
      }
      await setLabPanel(page, false)

      for (const activityId of activitySelect ? [
        'whiteboard', 'compare', 'marked-line', 'categories', 'tokens',
        'bar-model', 'part-whole', 'flow', 'goal-bar', 'worked',
        'ten-frame', 'number-jumps', 'array', 'fraction-strip', 'partition',
        'table', 'scale', 'two-bins', 'venn', 'ranking', 'outcomes', 'trade', 'chance',
        'deal', 'change', 'regroup', 'equation', 'receipt', 'ledger', 'price-tag', 'inventory', 'budget',
        'pictograph', 'beads', 'tally', 'fraction-circle', 'stack', 'two-futures', 'timeline', 'cycle', 'before-after',
        'grab', 'fill', 'whatif', 'your-turn',
      ] : []) {
        await setLabPanel(page, true)
        const flipped = await page.evaluate(
          `(() => { const s = document.querySelector('select[aria-label="activity on the plate"]');` +
            ` if (!s) return false; s.value = ${JSON.stringify(activityId)};` +
            ` s.dispatchEvent(new Event('change', { bubbles: true })); return s.value === ${JSON.stringify(activityId)} })()`,
        )
        if (!flipped) {
          // Without this the run would measure the PREVIOUS kind's board and
          // print this kind's name over it — a harness reporting confidently
          // on something it never actually put on screen (/AGENTS.md §1.14).
          failures += 1
          console.log(`  COULD NOT SELECT: the lab activity switch never took "${activityId}"`)
          continue
        }
        await setLabPanel(page, false)
        await sleep(300)

        await waitFor(
          page,
          '!!document.querySelector("[data-tutor-whiteboard]")',
          10_000,
          `the ${activityId} whiteboard to mount`,
        )
        // Lets a `sequence` board's bars grow in before measuring; a no-op
        // wait for `compare`/`marked_line`/`categories`, which render fully
        // immediately (TutorWhiteboard.tsx — several named things at one
        // moment have no story unfolding over steps for either to pace an
        // animation against).
        await sleep(2_500)

        const boardControls = await page.evaluate(SWEEP)
        const boardUnreachable = boardControls.filter((c) => !c.reaches)
        console.log(`  [${activityId}] ${boardControls.length} controls, ${boardUnreachable.length} unreachable`)
        for (const c of boardUnreachable) {
          failures += 1
          console.log(`  UNREACHABLE WITH ${activityId} BOARD OPEN: "${c.name}" — topmost ${c.topmost}`)
        }
        const boardOverlaps = await page.evaluate(OVERLAPS)
        for (const o of boardOverlaps) {
          failures += 1
          console.log(`  OVERLAP WITH ${activityId} BOARD OPEN: ${o}`)
        }
        const captionUnderBoard = await page.evaluate(
          '(() => { const cap = document.querySelector(".lf-speech");' +
            ' const board = document.querySelector("[data-tutor-whiteboard]");' +
            ' if (!cap || !board) return false;' +
            ' const c = cap.getBoundingClientRect(), b = board.getBoundingClientRect();' +
            ' const w = Math.min(c.right, b.right) - Math.max(c.left, b.left);' +
            ' const h = Math.min(c.bottom, b.bottom) - Math.max(c.top, b.top);' +
            ' return w > 8 && h > 8 })()',
        )
        if (captionUnderBoard) {
          failures += 1
          console.log(`  CAPTION UNDER ${activityId} BOARD: the tutor's words are painted over by the whiteboard`)
        }

        /*
         * A PERCENTAGE-HEIGHT BAR MUST HAVE REAL PIXELS, not just a CSS
         * value that never resolves. Found live (2026-09-01, building the
         * `compare`/`marked_line` kinds): `sequence`'s own bars — an
         * ALREADY-SHIPPED surface — had rendered at ZERO height in every
         * real browser since the feature launched, because their track was
         * a flex item under `items-end` (auto/content-sized, not a definite
         * containing block a CSS percentage can resolve against). Every
         * existing test only ever asserted the inline STYLE VALUE ("71%"),
         * and jsdom never lays anything out at all — a real browser,
         * measuring the actual box, is the only thing that can see this
         * class of defect at all, which is exactly why this check lives
         * here and not in a unit test.
         */
        const bars = await page.evaluate(
          `[...document.querySelectorAll('[data-tutor-whiteboard] [style*="height:"]')].map((el) => ({
             intended: el.style.height,
             rendered: el.getBoundingClientRect().height,
           }))`,
        )
        /*
         * INTENDED vs RENDERED, not merely rendered.
         *
         * The first version of this check flagged ANY inline-height element
         * measuring zero pixels, which was right while every such element was
         * meant to be visible. It stopped being right once a board could
         * legitimately draw a zero: `barHeightPct` returns exactly 0 for a true
         * zero value (round 107 — a bar labelled "$0" that still had height
         * contradicted its own label), and `sequence_compare` opens on two
         * tracks that both start at zero. Reported as two broken bars on a board
         * that was drawing correctly.
         *
         * So the question is not "did it render at zero" but "did it render at
         * zero when it asked not to". That is strictly SHARPER than the old
         * check — a bar asking for 71% and getting 0px still fails, which is the
         * defect this exists for — and it no longer calls a correct zero a bug.
         */
        const collapsed = bars.filter((bar) => {
          const asked = Number.parseFloat(bar.intended)
          return Number.isFinite(asked) && asked > 0 && bar.rendered <= 0
        })
        if (collapsed.length > 0) {
          failures += 1
          console.log(
            `  ${activityId}: ${collapsed.length}/${bars.length} bar(s) asked for height and rendered at ZERO pixels`,
          )
        }

        await shoot(page, `tutor-ui-${tag}-${activityId}`)
      }
    }
    if (page.errors.length > 0) {
      failures += page.errors.length
      console.log(`  [${tag}] console errors:`, page.errors.slice(0, 5))
    }
  }
} finally {
  child.kill()
  server.stop()
}

console.log(failures === 0 ? 'verify:tutor-ui OK — every control reachable, affordances live.' : `verify:tutor-ui FAILED: ${failures}`)
process.exitCode = failures === 0 ? 0 : 1
