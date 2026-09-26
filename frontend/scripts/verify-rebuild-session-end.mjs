/*
 * C.8/C.12 + C.16 real-Chrome matrix for the Mentor's session-end surfaces
 * (`src/rebuild/mentor/SessionEnd.tsx`): the stop-or-continue choice and the
 * four closing states, on the isolated rebuild preview (no auth, no paid
 * services). 3 locales x 2 themes x 4 widths x 4 closing scripts.
 *
 *   REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-session-end.mjs
 *
 * Checks: the right screen and closing script; the two choices are EQUAL
 * (same size, same style, neither focused by default); 48 px targets; every
 * visible string declares a copy role; no horizontal scroll or clipped text;
 * the safety stop shows no topic; keyboard focus is visible and Enter works;
 * nothing animates under reduced motion. Writes report.json and screenshots
 * to ../audit-results/rebuild-session-end.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://localhost:5330';
const output = resolve('../audit-results/rebuild-session-end');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;
const SCRIPTS = ['completed', 'interrupted', 'learner_left', 'safety_stop'];

async function navigate({ locale, theme, width, script, reducedMotion = false }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: theme },
      { name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' },
    ],
  });
  const query = new URLSearchParams({ locale, theme, screen: 'mentor-session-end', age: '6-9', script, effort: 'recovered' }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 200; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('[data-screen="mentor-session-closing"]')`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

const audit = (script) => `(() => {
  const issues = [];
  const choice = document.querySelector('[data-screen="mentor-session-end-choice"]');
  const closing = document.querySelector('[data-screen="mentor-session-closing"]');
  if (!choice || !closing) return ['missing-surface'];
  // Proportion: panels, not pages — the choice is one row (or two stacked), the closing state a short card.
  if (choice.getBoundingClientRect().height > 260) issues.push('choice-oversized');
  if (closing.getBoundingClientRect().height > 480) issues.push('closing-oversized');
  if (closing.dataset.closingScript !== ${JSON.stringify(script)}) issues.push('wrong-script');
  const [a, b] = choice.querySelectorAll('button');
  if (!a || !b) issues.push('choices-missing');
  else {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    if (Math.abs(ra.height - rb.height) > 1 || Math.abs(ra.width - rb.width) > 1) issues.push('choices-unequal-size');
    if (getComputedStyle(a).backgroundColor !== getComputedStyle(b).backgroundColor || a.className !== b.className) issues.push('choices-unequal-style');
    if (document.activeElement === a || document.activeElement === b) issues.push('choice-preselected');
    // Affordance: a chip must be visibly a control on its panel, in both themes.
    if (getComputedStyle(a).backgroundColor === getComputedStyle(choice).backgroundColor && getComputedStyle(a).boxShadow === 'none') issues.push('choice-no-boundary');
  }
  for (const button of document.querySelectorAll('[data-screen^="mentor-session"] button')) {
    const r = button.getBoundingClientRect();
    if (r.width < 48 || r.height < 48) issues.push('touch-target');
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll');
  const topic = closing.querySelector('[data-copy-role="data"]');
  if (${JSON.stringify(script)} === 'safety_stop' ? !!topic : !topic) issues.push('topic-rule');
  if (/!|great|awesome|¡|incr[ií]vel|genial/i.test(closing.textContent)) issues.push('celebration-or-exclamation');
  const walker = document.createTreeWalker(document.querySelector('.lf-preview-content'), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    if (!node.parentElement.closest('[data-copy-role]')) issues.push('copy-role-missing:' + node.textContent.trim().slice(0, 20));
  }
  for (const e of document.querySelectorAll('[data-screen^="mentor-session"] [data-copy-role]')) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if ((s.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) || (s.overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1)) issues.push('text-overflow');
    if (parseFloat(s.fontSize) < 14) issues.push('text-size');
    if (r.right > innerWidth + 1 || r.left < 0) issues.push('text-outside-viewport');
  }
  const bg = getComputedStyle(closing).backgroundColor, fg = getComputedStyle(closing).color;
  if (bg === fg) issues.push('no-contrast');
  return issues;
})()`;

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const script of SCRIPTS) {
      await navigate({ locale, theme, width, script });
      const issues = await page.evaluate(audit(script));
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, script, issues });
      if ((width === 375 || width === 1280) && (script === 'completed' || script === 'safety_stop' || (script === 'interrupted' && locale === 'es-MX'))) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(output, `${script}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  // Keyboard: Tab reaches the first choice with a visible focus indicator, and Enter on
  // the closing action goes back to the path (home).
  await navigate({ locale: 'es-MX', theme: 'light', width: 375, script: 'completed' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  const focus = await page.evaluate(`(() => { const e = document.activeElement; if (!e || e.tagName !== 'BUTTON') return 'no-focus';
    const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' ? 'ok' : 'focus-invisible'; })()`);
  if (focus !== 'ok') findings.push({ interaction: 'keyboard-focus', result: focus });
  await page.evaluate(`document.querySelector('[data-screen="mentor-session-closing"] button').focus()`);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await new Promise((done) => setTimeout(done, 150));
  if (!await page.evaluate(`!!document.querySelector('[data-screen="home"]')`)) findings.push({ interaction: 'back-to-path-failed' });

  // A real pointer click on "One more" lands on that button (topmost at its coordinates).
  await navigate({ locale: 'en-US', theme: 'dark', width: 375, script: 'interrupted' });
  const hit = await page.evaluate(`(() => { const b = document.querySelectorAll('[data-screen="mentor-session-end-choice"] button')[1];
    const r = b.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
    return document.elementFromPoint(x, y) === b ? 'ok' : 'covered'; })()`);
  if (hit !== 'ok') findings.push({ interaction: 'choice-covered', result: hit });

  // Reduced motion: nothing on these surfaces animates or transitions.
  await navigate({ locale: 'pt-BR', theme: 'light', width: 1280, script: 'completed', reducedMotion: true });
  const moving = await page.evaluate(`document.getAnimations().length`);
  if (moving !== 0) findings.push({ interaction: 'reduced-motion', animations: moving });

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({
    configurations, findings,
    scope: 'Isolated rebuild preview of the C.8/C.12 stop-or-continue choice and the C.16 closing states; not the live stage composition (wave 2).',
  }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 10), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
