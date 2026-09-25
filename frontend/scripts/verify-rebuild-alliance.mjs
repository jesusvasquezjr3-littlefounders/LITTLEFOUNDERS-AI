/*
 * C.15 / C.7 real-Chrome matrix for the Mentor's goal chips
 * (`src/rebuild/mentor/GoalCheck.tsx`), the end-of-session bond proxy
 * (`AllianceCheck.tsx`) and the learner disposition profile
 * (`DispositionSummary.tsx`) on the isolated rebuild preview (no auth, no paid
 * services). 3 screens x 3 locales x 2 themes x 4 widths.
 *
 *   REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-alliance.mjs
 *
 * Checks: the right screen; the chips are EQUAL (same size, same style,
 * neither focused by default) and visibly controls in both themes; 48 px
 * targets; every visible string declares a copy role and the chips are
 * `option` controls; no horizontal scroll or clipped text; each surface is a
 * panel, not a page; nothing names a feeling and nothing exclaims; not a
 * modal; the bond proxy is absent after a safety stop; answering thanks once
 * and removes the chips; keyboard focus is visible and Enter answers; a real
 * pointer hit lands on a chip; nothing animates under reduced motion. Writes
 * report.json and screenshots to ../audit-results/rebuild-alliance.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://localhost:5330';
const output = resolve('../audit-results/rebuild-alliance');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

const SCREENS = {
  'mentor-goal-check': { chips: 2, maxHeight: 200, extra: {} },
  'mentor-alliance-check': { chips: 3, maxHeight: 320, extra: { script: 'completed' } },
  'mentor-profile': { chips: 0, maxHeight: 900, extra: { audience: 'child', state: 'ready' } },
};

async function navigate({ screen, locale, theme, width, reducedMotion = false, extra = {} }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: theme },
      { name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' },
    ],
  });
  const query = new URLSearchParams({ locale, theme, screen, age: screen === 'mentor-profile' ? 'adult' : '6-9', ...extra }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 200; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('main[data-screen=${JSON.stringify(screen)}]')`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

const audit = (screen, chips, maxHeight) => `(() => {
  const issues = [];
  const panel = document.querySelector('section[data-screen=${JSON.stringify(screen)}]');
  if (!panel) return ['missing-surface'];
  if (panel.getBoundingClientRect().height > ${maxHeight}) issues.push('panel-oversized');
  if (document.querySelector('[role="dialog"], dialog')) issues.push('modal');
  const buttons = [...panel.querySelectorAll('button.lf-alliance-chip')];
  if (buttons.length !== ${chips}) issues.push('chip-count:' + buttons.length);
  const [first] = buttons;
  for (const chip of buttons) {
    const r = chip.getBoundingClientRect(), r0 = first.getBoundingClientRect();
    if (Math.abs(r.height - r0.height) > 1 || Math.abs(r.width - r0.width) > 1) issues.push('chips-unequal-size');
    if (getComputedStyle(chip).backgroundColor !== getComputedStyle(first).backgroundColor || chip.className !== first.className) issues.push('chips-unequal-style');
    if (document.activeElement === chip) issues.push('chip-preselected');
    if (getComputedStyle(chip).backgroundColor === getComputedStyle(panel).backgroundColor && getComputedStyle(chip).boxShadow === 'none') issues.push('chip-no-boundary');
    if (chip.dataset.copyRole !== 'option') issues.push('chip-not-option');
    if (r.width < 48 || r.height < 48) issues.push('touch-target');
    if (getComputedStyle(chip).color === getComputedStyle(chip).backgroundColor) issues.push('no-contrast');
  }
  for (const b of panel.querySelectorAll('button:not(.lf-alliance-chip)')) {
    const r = b.getBoundingClientRect();
    if (r.width < 48 || r.height < 48) issues.push('touch-target-action');
  }
  if (/(^|[^\\p{L}])(feel\\p{L}*|sad|upset|bored|confus\\p{L}*|frustr\\p{L}*|triste|aburrid\\p{L}*|chatead\\p{L}*|mood)([^\\p{L}]|$)|!|¡/iu.test(panel.textContent)) issues.push('feeling-or-exclamation');
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
  return [...new Set(issues)];
})()`;

async function tabTo(selector) {
  let focus = 'no-focus';
  for (let n = 0; n < 14 && focus === 'no-focus'; n++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    focus = await page.evaluate(`(() => { const e = document.activeElement; if (!e || !e.closest(${JSON.stringify(selector)})) return 'no-focus';
      const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' ? 'ok' : 'focus-invisible'; })()`);
  }
  return focus;
}

async function pressEnter() {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await new Promise((done) => setTimeout(done, 150));
}

try {
  for (const [screen, spec] of Object.entries(SCREENS))
    for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
      for (const width of [320, 375, 768, 1280]) {
        await navigate({ screen, locale, theme, width, extra: spec.extra });
        const issues = await page.evaluate(audit(screen, spec.chips, spec.maxHeight));
        configurations++;
        if (issues.length) findings.push({ screen, locale, theme, width, issues });
        if (width === 375 || width === 1280) {
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(join(output, `${screen}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
      }

  // The bond proxy for every closing script: present for three, absent after a safety stop.
  for (const script of ['interrupted', 'learner_left', 'safety_stop']) {
    await navigate({ screen: 'mentor-alliance-check', locale: 'es-MX', theme: 'light', width: 375, extra: { script } });
    configurations++;
    const present = await page.evaluate(`!!document.querySelector('section[data-screen="mentor-alliance-check"]')`);
    if (present !== (script !== 'safety_stop')) findings.push({ interaction: 'bond-proxy-script', script, present });
  }

  // The profile's other states render their own line, with no reset action.
  for (const state of ['empty', 'failed', 'loading']) {
    await navigate({ screen: 'mentor-profile', locale: 'pt-BR', theme: 'dark', width: 320, extra: { audience: 'own', state } });
    configurations++;
    const r = await page.evaluate(`(() => { const p = document.querySelector('section[data-screen="mentor-profile"]');
      return { rows: p.querySelectorAll('.lf-disposition-row').length, buttons: p.querySelectorAll('button').length,
        overflow: document.documentElement.scrollWidth > innerWidth + 1 }; })()`);
    if (r.rows !== 0 || r.buttons !== 0 || r.overflow) findings.push({ interaction: 'profile-state', state, ...r });
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(output, `mentor-profile-${state}-pt-BR-dark-320.png`), Buffer.from(shot.data, 'base64'));
  }

  // Keyboard on the goal chips: Tab reaches a chip with a visible focus ring, Enter answers.
  await navigate({ screen: 'mentor-goal-check', locale: 'es-MX', theme: 'light', width: 375 });
  await page.evaluate(`window.__clicks = 0; for (const b of document.querySelectorAll('section[data-screen="mentor-goal-check"] button')) b.addEventListener('click', () => window.__clicks++)`);
  const goalFocus = await tabTo('section[data-screen="mentor-goal-check"]');
  if (goalFocus !== 'ok') findings.push({ interaction: 'goal-keyboard-focus', result: goalFocus });
  await pressEnter();
  if (await page.evaluate('window.__clicks') !== 1) findings.push({ interaction: 'goal-enter-did-not-answer' });

  // Keyboard on the bond proxy: Enter answers and the chips give way to one thanks line.
  await navigate({ screen: 'mentor-alliance-check', locale: 'en-US', theme: 'dark', width: 768, extra: { script: 'completed' } });
  const bondFocus = await tabTo('section[data-screen="mentor-alliance-check"]');
  if (bondFocus !== 'ok') findings.push({ interaction: 'bond-keyboard-focus', result: bondFocus });
  await pressEnter();
  const after = await page.evaluate(`(() => { const p = document.querySelector('section[data-screen="mentor-alliance-check"]');
    return { chips: p.querySelectorAll('button').length, status: p.querySelectorAll('[role="status"]').length }; })()`);
  if (after.chips !== 0 || after.status !== 1) findings.push({ interaction: 'bond-answer', ...after });
  const shotAfter = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, 'mentor-alliance-check-answered-en-US-dark-768.png'), Buffer.from(shotAfter.data, 'base64'));

  // A failed save offers a retry that is a real, reachable control.
  await navigate({ screen: 'mentor-alliance-check', locale: 'pt-BR', theme: 'light', width: 320, extra: { script: 'completed', result: 'failed' } });
  await page.evaluate(`document.querySelector('section[data-screen="mentor-alliance-check"] [data-bond="no"]').click()`);
  await new Promise((done) => setTimeout(done, 150));
  const failed = await page.evaluate(`(() => { const p = document.querySelector('section[data-screen="mentor-alliance-check"]');
    const retry = p.querySelector('[role="alert"] button'); if (!retry) return 'no-retry';
    const r = retry.getBoundingClientRect(); return r.height >= 48 && document.documentElement.scrollWidth <= innerWidth + 1 ? 'ok' : 'retry-too-small'; })()`);
  if (failed !== 'ok') findings.push({ interaction: 'bond-retry', result: failed });

  // A real pointer hit on each chip of the goal and bond surfaces lands on that chip.
  for (const screen of ['mentor-goal-check', 'mentor-alliance-check']) {
    await navigate({ screen, locale: 'en-US', theme: 'dark', width: 320, extra: SCREENS[screen].extra });
    const hit = await page.evaluate(`[...document.querySelectorAll('section[data-screen=${JSON.stringify(screen)}] button')].every((b) => {
      const r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b; })`);
    if (!hit) findings.push({ interaction: 'chip-covered', screen });
  }

  // Reduced motion: nothing on these surfaces animates or transitions.
  for (const screen of Object.keys(SCREENS)) {
    await navigate({ screen, locale: 'pt-BR', theme: 'light', width: 1280, reducedMotion: true, extra: SCREENS[screen].extra });
    const moving = await page.evaluate(`document.getAnimations().length`);
    if (moving !== 0) findings.push({ interaction: 'reduced-motion', screen, animations: moving });
  }

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({
    configurations, findings,
    scope: 'Isolated rebuild preview of the C.15 goal chips and bond proxy and the C.7 profile; not the live stage or Family Hub composition (wave 2).',
  }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
