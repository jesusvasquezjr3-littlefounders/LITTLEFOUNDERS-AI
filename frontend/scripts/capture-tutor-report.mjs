/*
 * Captures the evidence set for the Tutor's engineering + UX report.
 *
 * WHY A SCRIPT AND NOT THE INTERACTIVE BROWSER. Screenshots taken through an
 * emulated viewport composite at the pane's own size, not the emulated one —
 * the page renders correctly (the DOM measures 1280x900) while the PNG shows
 * the content boxed into a corner. That is a capture artifact, and a report
 * built on it would misrepresent the product it is documenting. Driving Chrome
 * over CDP at a real window size is the same path `verify-tutor-ui.mjs` and
 * `verify-tutor-a11y.mjs` already trust, so the repo keeps one convention.
 *
 * Locale is forced to es-MX: the report is written in Spanish and a reader
 * comparing prose to a screenshot must not have to translate between them.
 *
 *   node scripts/capture-tutor-report.mjs [outDir]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { launchBrowser, openPage } from './lesson-engine/browser.mjs'

const OUT = process.argv[2] || join(tmpdir(), 'lf-tutor-report')
/*
 * `localhost`, NOT `127.0.0.1`. Measured, not assumed: the first run of this
 * script produced sixteen byte-identical PNGs of Chrome's own
 * ERR_CONNECTION_REFUSED page and reported success, because the dev server
 * binds `localhost` — which resolves to ::1 first on this machine — while the
 * script asked for the IPv4 literal. `verify-tutor-*.mjs` never hit this
 * because they spawn their own Vite and read the URL back out of its banner.
 */
const BASE = process.env.TUTOR_LAB_URL || 'http://localhost:5173'
mkdirSync(OUT, { recursive: true })

/* Every stage phase the lab can mount, in the order a learner meets them. */
const PHASES = [
  ['arriving', 'La llegada a la isla'],
  ['personalizing', 'Elegir tutor y compañero'],
  ['introducing', 'El saludo y las ofertas'],
  ['conversing', 'La conversación'],
  ['adapting', 'La adaptación ofrecida'],
  ['closing', 'El cierre'],
  ['replaying', 'La repetición'],
  ['unavailable', 'El tutor no disponible'],
]

const VIEWPORTS = [
  ['desktop', { width: 1280, height: 900, dark: false }],
  ['mobile', { width: 390, height: 844, dark: false }],
]

async function shoot(page, name) {
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' })
  const file = join(OUT, `${name}.png`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  console.log(`  saved ${name}.png`)
}

/*
 * THROWS. It used to return false and let the walk continue, which is how the
 * first run of this script saved sixteen screenshots of an error page and
 * printed "OK" — the same "a check that reports success on an empty run is
 * worse than none" defect this repo fixed in `verify-rig.mjs` the same day,
 * reintroduced here by the person who had just fixed it. Evidence for a report
 * is worth less than nothing when it is confidently wrong: a blank screenshot
 * in a document about how the product works is a claim, not an absence.
 */
async function waitFor(page, expression, ms, what) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (await page.evaluate(expression)) return true
    await sleep(400)
  }
  throw new Error(`timed out waiting for ${what} — captured nothing`)
}

/* The lab's own switches, pressed by text. `.click()` is correct HERE and only
 * here: these are the instrument panel, not the product, and this script is
 * capturing the product rather than proving the panel is reachable. */
async function pressSwitch(page, label) {
  const ok = await page.evaluate(
    `(() => { const b = [...document.querySelectorAll('[data-lab-chrome] button')]` +
      `.find((n) => n.textContent.trim() === ${JSON.stringify(label)});` +
      ` if (!b) return false; b.click(); return true })()`,
  )
  // Also throws, same reason as `waitFor`: a phase switch that silently did
  // nothing means the NEXT screenshot is of the previous phase, filed under
  // this one's name — a mislabelled exhibit is worse than a missing one.
  if (!ok) throw new Error(`lab switch "${label}" not found — cannot capture that phase`)
  await sleep(900)
  return ok
}

/** Hides the lab's instrument panel so it never appears in report evidence. */
const HIDE_CHROME =
  `(() => { const el = document.querySelector('[data-lab-chrome]');` +
  ` if (el) el.style.display = 'none'; return !!el })()`
const SHOW_CHROME =
  `(() => { const el = document.querySelector('[data-lab-chrome]');` +
  ` if (el) el.style.display = ''; return !!el })()`

const { child, browser } = await launchBrowser(join(tmpdir(), `lf-report-${Date.now()}`))
console.log(`capture-tutor-report — ${BASE}, output in ${OUT}`)

try {
  for (const [tag, viewport] of VIEWPORTS) {
    console.log(`\n== ${tag} (${viewport.width}x${viewport.height}) ==`)
    const page = await openPage(browser, viewport)
    await page.send('Page.navigate', { url: `${BASE}/dev/tutor-lab` })
    await waitFor(page, '!!document.querySelector("[data-lab-chrome]")', 60_000, 'lab chrome')
    /*
     * The lab's own panel starts COLLAPSED below 768px
     * (`TutorLabPage.tsx`: `useState(() => window.innerWidth >= 768)`), so at
     * the mobile viewport none of the switches exist in the DOM yet and every
     * `pressSwitch` below would throw. Pressing `lab` reopens it. Found by the
     * mobile pass failing on the locale switch after the desktop pass had
     * captured all eight phases cleanly — the harness was viewport-dependent
     * in a way the product is not.
     */
    const collapsed = await page.evaluate(
      `[...document.querySelectorAll('[data-lab-chrome] button')].length <= 1`,
    )
    if (collapsed) await pressSwitch(page, 'lab')
    // Locale first, so every later capture is already in Spanish.
    await pressSwitch(page, 'es-MX')
    await waitFor(page, 'document.body.innerText.includes("stage ready")', 90_000, 'stage ready')

    for (const [phase, description] of PHASES) {
      await pressSwitch(page, phase)
      await sleep(1400) // let entrance animations settle before the shutter
      await page.evaluate(HIDE_CHROME)
      await sleep(150)
      await shoot(page, `${tag}-${phase}`)
      await page.evaluate(SHOW_CHROME)
      console.log(`    ${phase} — ${description}`)
    }
  }
} finally {
  child.kill()
}

console.log(`\ncapture-tutor-report OK — evidence in ${OUT}`)
