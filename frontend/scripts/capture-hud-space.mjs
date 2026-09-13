/*
 * RE-CAPTURE THE HUD-SPACE GOLDEN FIXTURE.
 *
 *   node scripts/capture-hud-space.mjs
 *
 * `src/tutor-scene/__tests__/hudSpace.test.ts` holds a `MEASURED` record of
 * real `getBoundingClientRect` values, phase by phase, at 375x812 and
 * 1280x800, and asserts that the arrangement they describe is collision-free.
 * Its own comment states the contract: "It goes stale the way any golden file
 * does — re-capture it when the layout changes on purpose."
 *
 * That sentence had no tool behind it. The numbers were captured by hand in a
 * verification pass, so "re-capture" meant "do that again, somehow", and a
 * fixture nobody can regenerate is a fixture that quietly stops describing the
 * product while its assertions keep passing — the arrangement in it stays
 * collision-free forever, because rectangles in a file do not move.
 *
 * This is that tool. It drives the same lab, through the same phases, at the
 * same two viewports, and runs the SAME survey the lab's own live readout uses
 * (`TutorLabPage.tsx` → `surveyHudSurfaces`), then prints the fixture as
 * TypeScript ready to paste. It is not a gate and never runs in CI: it produces
 * the evidence a human pastes in, deliberately, when the layout changed on
 * purpose.
 *
 * WHAT IT FOUND ON ITS FIRST RUN, AND WHY THE FIXTURE IS NOT YET UPDATED FROM
 * IT (2026-09-12). At 375x812 in en-US, with the sheet at rest, the speech
 * caption overlaps the way-out chip by 11x14 px and the session menu by 73x14.
 * The caption is registered `avoid: true`, so it is supposed to be displaced
 * out of both — and at 375 it cannot do that horizontally: it is 258 px wide
 * and the gap between the two ends of the header row is 174, so the only
 * solution is vertical and the escape settles for a partial horizontal move
 * instead.
 *
 * It is a real defect in `hudSpace`'s escape for the "two reserved rects, no
 * horizontal room" case, not in this tool, and the old fixture could not have
 * caught it: until the anchor-release fix landed in the same branch, the
 * caption was pinned at (0, 0) by stale inline styles and never ran that code
 * at all. `verify:tutor-ui` does not catch it either, because its phone
 * configuration is es-MX, where the same sentence is short enough to clear.
 *
 * So: this tool works, the finding is recorded, and `hudSpace.test.ts` keeps
 * its historical numbers until the escape is fixed. Pasting a capture of a
 * broken arrangement would turn a collision into a baseline.
 */
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { launchBrowser, openPage } from './lesson-engine/browser.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const VITE_BIN = join(HERE, '..', 'node_modules', 'vite', 'bin', 'vite.js')

/** The phases the fixture covers, in the lab's own switch labels. */
const PHASES = ['introducing', 'conversing', 'closing', 'unavailable']

/** The two viewports the fixture is captured at. */
const VIEWPORTS = [
  { key: 375, width: 375, height: 812 },
  { key: 1280, width: 1280, height: 800 },
]

/*
 * Long enough for a phase's chips to finish arriving. The a11y gate pays the
 * same cost for the same reason: measuring a surface mid-reveal captures a
 * position nothing will ever be at again.
 */
const SETTLE_MS = 1200

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

/*
 * `surveyHudSurfaces` from `TutorLabPage.tsx`, transcribed rather than imported
 * — this runs inside the page, where the module graph is the app's own. Kept
 * literally identical on purpose: a capture that surveys differently from the
 * live readout produces a fixture the readout can never agree with.
 */
const SURVEY =
  '(() => { const stage = document.querySelector("[data-tutor-stage]"); if (!stage) return [];' +
  // A name, not every character inside the box — `TutorFace` injects a <style>
  // and `textContent` would report the caption as its CSS. Same rule as the
  // readout's own `visibleText`.
  ' const visibleText = (n) => { let t = "";' +
  '   for (const c of n.childNodes) {' +
  '     if (c.nodeType === 3) t += c.textContent || "";' +
  '     else if (c.nodeType === 1 && c.tagName !== "STYLE" && c.tagName !== "SCRIPT") t += visibleText(c);' +
  '   } return t.trim() };' +
  ' const found = [];' +
  ' for (const node of stage.querySelectorAll(".lf-lumen, .lf-glass, button")) {' +
  '   if (node.closest("[data-lab-chrome]")) continue;' +
  '   if (node.hidden || node.hasAttribute("inert")) continue;' +
  '   if (node.closest("[data-tutor-veil]")) continue;' +
  '   const box = node.getBoundingClientRect();' +
  '   if (box.width <= 0 || box.height <= 0) continue;' +
  '   if (found.some((e) => e.node.contains(node))) continue;' +
  '   const name = (node.getAttribute("aria-label") || "").trim() ||' +
  '     visibleText(node).slice(0, 32) || "unnamed surface";' +
  '   found.push({ node, name, left: box.left, top: box.top, width: box.width, height: box.height });' +
  ' }' +
  ' return found.map((e) => ({ name: e.name, left: e.left, top: e.top, width: e.width, height: e.height })) })()'

/**
 * Waits for the lab to be usable rather than sleeping at it.
 *
 * The same two markers `verify:tutor-ui` waits on, for the same reason: a
 * capture taken before the stage has drawn records the positions of a HUD
 * hanging on nothing.
 */
async function waitForLab(page) {
  const deadline = Date.now() + 120_000
  const ready = async (expression) => {
    while (Date.now() < deadline) {
      if (await page.evaluate(expression)) return true
      await sleep(250)
    }
    return false
  }
  if (!(await ready('!!document.querySelector("[data-lab-chrome]")'))) {
    throw new Error('the lab never mounted its instrument panel')
  }
  // "stage ready" is printed INSIDE the instrument panel, so the panel has to
  // be open to read it. `verify:tutor-ui` opens it for the same reason.
  await setLabPanel(page, true)
  if (!(await ready('document.body.innerText.includes("stage ready")'))) {
    throw new Error('the stage never reported ready')
  }
}

async function pressSwitch(page, label) {
  return page.evaluate(
    `(() => { const b = [...document.querySelectorAll('[data-lab-chrome] button')]` +
      `.find((n) => n.textContent.trim() === ${JSON.stringify(label)});` +
      ` if (!b) return false; b.click(); return true })()`,
  )
}

const PANEL_IS_OPEN =
  `(() => [...document.querySelectorAll('[data-lab-chrome] button')]` +
  `.some((n) => n.textContent.trim() === 'hide'))()`

/**
 * Collapse the lab's own instrument panel before measuring anything.
 *
 * The survey already drops `[data-lab-chrome]` from its RESULTS, which is not
 * the same as the panel not being there: it is a real box on a real screen, and
 * a fixture captured with it expanded records where the HUD sits next to a
 * surface the product does not have.
 */
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

/**
 * Put the mobile sheet back to its RESTING detent before measuring.
 *
 * This fixture is a picture of the arrangement a learner is IN, and that is the
 * sheet at PEEK: a board arriving raises it, and a raised sheet is a state they
 * chose or were shown for one activity. The original hand-captured fixture was
 * taken at rest too — its `conversing@375` caption is 88 px tall at y=9, which
 * is only reachable with the sheet down.
 *
 * It matters more than tidiness. At 375x812 with the sheet at FULL there are
 * about 105 px between the header row and the microphone dock, and the tutor's
 * sentence is frequently taller than that — so a fixture captured there records
 * a collision that is real but belongs to `verify:tutor-ui`, which opens the
 * sheet deliberately and audits that state with its own list.
 */
async function restSheet(page) {
  const HANDLE = `document.querySelector('button[aria-label="Move this up or down"]')`
  const height = `(() => { const b = document.querySelector('[data-plate-body]');` +
    ` const s = b && b.closest('[style*="height"]'); return s ? s.getBoundingClientRect().height : 0 })()`
  if (!(await page.evaluate(`!!${HANDLE}`))) return
  for (let i = 0; i < 4; i += 1) {
    if ((await page.evaluate(height)) <= 96) return
    await page.evaluate(`(() => { const h = ${HANDLE}; if (h) h.click(); return true })()`)
    await sleep(400)
  }
}

const round = (n) => Math.round(n)

async function main() {
  const server = await startDevServer()
  console.log(`capture-hud-space — dev server at ${server.url}`)
  /*
   * BOTH children are started before the try, and BOTH are killed in the
   * finally. The first version launched the browser outside it, so a launch
   * failure left Vite running with nobody to stop it — the process never
   * exited, its piped stdout never closed, and the run looked like a hang
   * rather than the immediate error it was.
   */
  let child = null
  let browser = null
  const captured = {}
  let problems = 0

  try {
    ;({ child, browser } = await launchBrowser(join(tmpdir(), `lf-capture-hud-${Date.now()}`)))
    for (const viewport of VIEWPORTS) {
      const page = await openPage(browser, { width: viewport.width, height: viewport.height, dark: false })
      await page.send('Page.navigate', { url: `${server.url}/dev/tutor-lab` })
      await waitForLab(page)

      for (const phase of PHASES) {
        // The switch row lives in the panel, so it has to be open to press it
        // and closed to measure anything.
        await setLabPanel(page, true)
        const switched = await pressSwitch(page, phase)
        if (!switched) {
          console.log(`  ! could not switch to ${phase} at ${viewport.key}`)
          problems += 1
          continue
        }
        await setLabPanel(page, false)
        await sleep(SETTLE_MS)
        await restSheet(page)
        const surfaces = await page.evaluate(SURVEY)
        if (!Array.isArray(surfaces) || surfaces.length === 0) {
          console.log(`  ! ${phase}@${viewport.key} surveyed nothing`)
          problems += 1
          continue
        }
        captured[`${phase}@${viewport.key}`] = surfaces
        console.log(`  ${phase}@${viewport.key}: ${surfaces.length} surfaces`)
      }
    }
  } finally {
    if (child) child.kill()
    server.stop()
  }

  console.log('\n// ── paste into hudSpace.test.ts ──────────────────────────\n')
  console.log('const MEASURED: Record<string, NamedRect[]> = {')
  for (const [key, surfaces] of Object.entries(captured)) {
    console.log(`  '${key}': [`)
    for (const s of surfaces) {
      const name = s.name.replace(/'/g, "\\'").replace(/\s+/g, ' ')
      console.log(`    { name: '${name}', rect: rect(${round(s.left)}, ${round(s.top)}, ${round(s.width)}, ${round(s.height)}) },`)
    }
    console.log('  ],')
  }
  console.log('}')

  if (problems > 0) {
    console.log(`\ncapture-hud-space: ${problems} problem(s) — the output above is incomplete`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
