/*
 * C.19 real-Chrome matrix for the Mentor's check-in reply chips
 * (`src/rebuild/mentor/CheckIn.tsx`) on the isolated rebuild preview (no
 * auth, no paid services). 3 locales x 2 themes x 4 widths.
 *
 *   REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-check-in.mjs
 *
 * Checks: the right screen; the two chips are EQUAL (same size, same style,
 * neither focused by default) and visibly controls in both themes; 48 px
 * targets; every visible string declares a copy role and the chips are
 * `option` controls; no horizontal scroll or clipped text; the panel is a
 * panel, not a page; nothing names a feeling; not a modal; keyboard focus is
 * visible and Enter answers; a real pointer hit lands on the chip; nothing
 * animates under reduced motion. Writes report.json and screenshots to
 * ../audit-results/rebuild-check-in.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://localhost:5330';
const output = resolve('../audit-results/rebuild-check-in');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate({ locale, theme, width, reducedMotion = false }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: theme },
      { name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' },
    ],
  });
  const query = new URLSearchParams({ locale, theme, screen: 'mentor-check-in', age: '6-9' }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 200; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('section[data-screen="mentor-check-in"]')`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

const audit = `(() => {
  const issues = [];
  const panel = document.querySelector('section[data-screen="mentor-check-in"]');
  if (!panel) return ['missing-surface'];
  if (panel.getBoundingClientRect().height > 200) issues.push('panel-oversized');
  if (document.querySelector('[role="dialog"], dialog')) issues.push('modal');
  const [a, b] = panel.querySelectorAll('button');
  if (!a || !b) issues.push('chips-missing');
  else {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    if (Math.abs(ra.height - rb.height) > 1 || Math.abs(ra.width - rb.width) > 1) issues.push('chips-unequal-size');
    if (getComputedStyle(a).backgroundColor !== getComputedStyle(b).backgroundColor || a.className !== b.className) issues.push('chips-unequal-style');
    if (document.activeElement === a || document.activeElement === b) issues.push('chip-preselected');
    if (getComputedStyle(a).backgroundColor === getComputedStyle(panel).backgroundColor && getComputedStyle(a).boxShadow === 'none') issues.push('chip-no-boundary');
    for (const chip of [a, b]) {
      if (chip.dataset.copyRole !== 'option') issues.push('chip-not-option');
      const r = chip.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) issues.push('touch-target');
      if (getComputedStyle(chip).color === getComputedStyle(chip).backgroundColor) issues.push('no-contrast');
    }
  }
  if (/feel|sad|upset|bored|confus|frustr|sient|triste|aburr|sente|!|¡/i.test(panel.textContent)) issues.push('feeling-or-exclamation');
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll');
  const walker = document.createTreeWalker(document.querySelector('.lf-preview-content'), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    if (!node.parentElement.closest('[data-copy-role]')) issues.push('copy-role-missing:' + node.textContent.trim().slice(0, 20));
  }
  for (const e of panel.querySelectorAll('[data-copy-role]')) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if ((s.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) || (s.overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1)) issues.push('text-overflow');
    if (parseFloat(s.fontSize) < 14) issues.push('text-size');
    if (r.right > innerWidth + 1 || r.left < 0) issues.push('text-outside-viewport');
  }
  return issues;
})()`;

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) {
      await navigate({ locale, theme, width });
      const issues = await page.evaluate(audit);
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, issues });
      if (width === 375 || width === 1280) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(output, `check-in-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  // Keyboard: Tab reaches a chip with a visible focus indicator, and Enter activates it
  // (the fixture's handler is a no-op, so activation is observed as a click event).
  await navigate({ locale: 'es-MX', theme: 'light', width: 375 });
  await page.evaluate(`window.__checkInClicks = 0; for (const b of document.querySelectorAll('section[data-screen="mentor-check-in"] button')) b.addEventListener('click', () => window.__checkInClicks++)`);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  let focus = 'no-focus';
  for (let n = 0; n < 12 && focus === 'no-focus'; n++) {
    focus = await page.evaluate(`(() => { const e = document.activeElement; if (!e || !e.closest('section[data-screen="mentor-check-in"]')) return 'no-focus';
      const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' ? 'ok' : 'focus-invisible'; })()`);
    if (focus === 'no-focus') {
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    }
  }
  if (focus !== 'ok') findings.push({ interaction: 'keyboard-focus', result: focus });
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await new Promise((done) => setTimeout(done, 100));
  if (await page.evaluate('window.__checkInClicks') !== 1) findings.push({ interaction: 'enter-did-not-answer' });

  // A real pointer hit on "Not really" lands on that chip (topmost at its coordinates).
  await navigate({ locale: 'en-US', theme: 'dark', width: 320 });
  const hit = await page.evaluate(`(() => { const b = document.querySelector('section[data-screen="mentor-check-in"] [data-check-in="misaligned"]');
    const r = b.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
    return document.elementFromPoint(x, y) === b ? 'ok' : 'covered'; })()`);
  if (hit !== 'ok') findings.push({ interaction: 'chip-covered', result: hit });

  // Reduced motion: nothing on this surface animates or transitions.
  await navigate({ locale: 'pt-BR', theme: 'light', width: 1280, reducedMotion: true });
  const moving = await page.evaluate(`document.getAnimations().length`);
  if (moving !== 0) findings.push({ interaction: 'reduced-motion', animations: moving });

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({
    configurations, findings,
    scope: 'Isolated rebuild preview of the C.19 check-in reply chips; not the live stage composition (wave 2).',
  }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 10), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
