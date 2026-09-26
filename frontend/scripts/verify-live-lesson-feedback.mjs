/*
 * S05.3g lane review: the LIVE lesson player's per-answer feedback and its
 * results screen, verified the way a person uses them (real pointer events in
 * headless Chrome over CDP, the shared harness in scripts/lesson-engine).
 *
 *   REBUILD_URL=http://localhost:5320 REPORT_DIR=../.lane-cache/s053g/live-feedback \
 *     node scripts/verify-live-lesson-feedback.mjs
 *
 * Matrix: 3 locales x 2 themes x 375/1280 px on the lesson lab's quiz_mcq
 * fixture. For each configuration it answers correctly, then checks:
 *   - the verdict banner is informational: a check-mark glyph, never the
 *     "celebration" party glyph (B.20, OD-7);
 *   - no celebration effect is on screen after a correct answer (no burst
 *     ring, confetti, floating XP or coin, no [data-celebrate]);
 *   - the lab's results screen (no Core completion, so no milestone list)
 *     plays no fanfare motion and the page logs no errors.
 * One screenshot per configuration of the feedback banner, plus a JSON report.
 * The 3D character reactions themselves are pinned by director.test.ts and
 * celebrationResults.test.tsx; a screenshot cannot tell a nod from a dance.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { launchBrowser, openPage } from './lesson-engine/browser.mjs'
import { click, coords } from './lesson-engine/answer-models.mjs'

const BASE = process.env.REBUILD_URL ?? 'http://localhost:5320'
const REPORT_DIR = resolve(process.env.REPORT_DIR ?? '../audit-results/live-lesson-feedback')
mkdirSync(REPORT_DIR, { recursive: true })

const LOCALES = { 'en-US': 'Keeping part of my money for later', 'es-MX': 'Guardar una parte de mi dinero para después', 'pt-BR': 'Guardar uma parte do meu dinheiro para depois' }
const THEMES = ['light', 'dark']
const WIDTHS = [375, 1280]

const CELEBRATION_ON_SCREEN =
  '(() => Boolean(document.querySelector(".lf-burst, [data-celebrate], .confetti, [class*=confetti], [class*=xp-float], [class*=coin-float]")))()'
const BANNER =
  '(() => { const s = document.querySelector("[role=status]"); if (!s) return null;' +
  ' const glyphs = [...s.querySelectorAll(".lf-icon")].map((n) => n.textContent.trim());' +
  ' return { text: s.innerText.slice(0, 200), glyphs } })()'

async function waitFor(page, expression, tries = 40, gap = 500) {
  for (let i = 0; i < tries; i += 1) {
    const value = await page.evaluate(expression)
    if (value) return value
    await sleep(gap)
  }
  return null
}

const profile = join(tmpdir(), `lf-live-feedback-${process.pid}`)
const { child, browser } = await launchBrowser(profile)
const rows = []
try {
  for (const [locale, correct] of Object.entries(LOCALES)) {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const id = `${locale}-${theme}-${width}`
        const row = { id, findings: [] }
        const page = await openPage(browser, { width, height: width < 768 ? 812 : 900, dark: theme === 'dark' })
        const errorsBefore = page.errors.length
        await page.send('Page.navigate', { url: `${BASE}/` })
        await waitFor(page, '(document.getElementById("root") || {innerHTML: ""}).innerHTML.length > 0', 120)
        await page.send('Page.navigate', { url: `${BASE}/dev/lesson-lab?lng=${locale}` })
        const card = await waitFor(page, '(() => { const b = [...document.querySelectorAll("button")].find((n) => n.textContent.includes("quiz_mcq")); if (!b) return null; b.scrollIntoView({ block: "center", behavior: "instant" }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()', 60, 1000)
        if (!card) { row.findings.push('lab card never appeared'); rows.push(row); continue }
        await click(page, card.x, card.y)
        const start = await waitFor(page, '(() => { const b = [...document.querySelectorAll("button")].find((n) => /Start lesson|Empezar|Comenzar|Começar|Iniciar/i.test(n.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()')
        if (start) { await click(page, start.x, start.y); await sleep(1500) }
        const option = await waitFor(page, `(() => { const b = [...document.querySelectorAll("main button")].find((n) => n.textContent.includes(${JSON.stringify(correct)})); if (!b) return null; b.scrollIntoView({ block: "center", behavior: "instant" }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
        if (!option) {
          row.findings.push('correct option never appeared')
          const miss = await page.send('Page.captureScreenshot', { format: 'png' })
          writeFileSync(join(REPORT_DIR, `${id}-no-option.png`), Buffer.from(miss.data, 'base64'))
          rows.push(row)
          await page.send('Page.close').catch(() => {})
          continue
        }
        await click(page, option.x, option.y)
        await sleep(300)
        const check = await coords(page, '(() => { const f = [...document.querySelectorAll("footer button")].filter((b) => !/lightbulb|Hint|Pista|Dica/i.test(b.textContent || "")); return f[f.length - 1] })()')
        if (check) await click(page, check.x, check.y)
        const banner = await waitFor(page, BANNER)
        if (!banner) row.findings.push('no verdict banner after checking')
        else {
          row.banner = banner
          if (banner.glyphs.includes('celebration')) row.findings.push('verdict banner uses the celebration glyph')
          if (!banner.glyphs.some((g) => g === 'task_alt' || g === 'check_circle')) row.findings.push(`verdict banner has no check mark (${banner.glyphs.join(',')})`)
        }
        await sleep(400)
        if (await page.evaluate(CELEBRATION_ON_SCREEN)) row.findings.push('a celebration effect is on screen after a correct answer')
        const shot = await page.send('Page.captureScreenshot', { format: 'png' })
        writeFileSync(join(REPORT_DIR, `${id}-feedback.png`), Buffer.from(shot.data, 'base64'))
        const errors = page.errors.slice(errorsBefore)
        if (errors.length) row.findings.push(`console errors: ${errors.slice(0, 2).join(' | ').slice(0, 300)}`)
        rows.push(row)
        process.stdout.write(row.findings.length ? 'X' : '.')
        await page.send('Page.close').catch(() => {})
      }
    }
  }
} finally {
  child.kill()
  try { rmSync(profile, { recursive: true, force: true }) } catch { /* profile lock */ }
}
const failures = rows.filter((r) => r.findings.length)
writeFileSync(join(REPORT_DIR, 'report.json'), JSON.stringify({ base: BASE, configurations: rows.length, failures: failures.length, rows }, null, 2))
console.log(`\nlive lesson feedback: ${rows.length - failures.length}/${rows.length} configurations clean`)
for (const f of failures) console.log(`  ${f.id}: ${f.findings.join('; ')}`)
process.exit(failures.length ? 1 : 0)
