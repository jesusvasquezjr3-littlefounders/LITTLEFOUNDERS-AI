/*
 * C.5 / C.6 real-Chrome matrix for the staff live-content surfaces
 * (`src/rebuild/mentor/LiveContentGovernance.tsx`): the per-category status,
 * one review decision and the curated-pack release, on the isolated rebuild
 * preview (no auth, no paid services). 3 locales x 2 themes x 4 widths, plus
 * the uncalibrated / loading / failed states and the interactions.
 *
 *   REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-live-content.mjs
 *
 * Checks: the three panels render; the three review decisions are EQUAL
 * (same size, same style, none focused by default) and visibly controls in
 * both themes; 48 px targets for every button; every visible string declares
 * a copy role; no horizontal scroll or clipped text; each surface is a panel,
 * not a page; not a modal; nothing exclaims or celebrates; a paused category
 * says why in words; the uncalibrated state pauses both categories; a
 * decision replaces the controls with one status line; a refused publish
 * lists every reason; keyboard focus is visible and Enter decides; a real
 * pointer hit lands on a decision; nothing animates under reduced motion.
 * Writes report.json and screenshots to ../audit-results/rebuild-live-content.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://localhost:5330';
const output = resolve('../audit-results/rebuild-live-content');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;
const SCREEN = 'staff-live-content';

async function navigate({ locale, theme, width, reducedMotion = false, extra = {} }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: theme },
      { name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' },
    ],
  });
  const query = new URLSearchParams({ locale, theme, screen: SCREEN, age: 'adult', ...extra }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 200; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('main[data-screen=${JSON.stringify(SCREEN)}]')`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

const audit = `(() => {
  const issues = [];
  const panels = ['staff-live-content-status', 'staff-live-content-review', 'staff-live-content-packs']
    .map((s) => document.querySelector('section[data-screen="' + s + '"]'));
  if (panels.some((p) => !p)) return ['missing-surface'];
  if (document.querySelector('[role="dialog"], dialog')) issues.push('modal');
  for (const panel of panels) {
    if (panel.getBoundingClientRect().height > 1400) issues.push('panel-oversized');
    for (const b of panel.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) issues.push('touch-target');
      if (getComputedStyle(b).color === getComputedStyle(b).backgroundColor) issues.push('no-contrast');
    }
    for (const e of panel.querySelectorAll('[data-copy-role]')) {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      if ((s.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) || (s.overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1)) issues.push('text-overflow');
      if (parseFloat(s.fontSize) < 14) issues.push('text-size');
      if (r.right > innerWidth + 1 || r.left < 0) issues.push('text-outside-viewport');
    }
  }
  const decisions = [...panels[1].querySelectorAll('button.lf-generated-decision')];
  if (decisions.length !== 3) issues.push('decision-count:' + decisions.length);
  const [first] = decisions;
  for (const d of decisions) {
    const r = d.getBoundingClientRect(), r0 = first.getBoundingClientRect();
    if (Math.abs(r.height - r0.height) > 1 || Math.abs(r.width - r0.width) > 1) issues.push('decisions-unequal-size');
    if (getComputedStyle(d).backgroundColor !== getComputedStyle(first).backgroundColor || d.className !== first.className) issues.push('decisions-unequal-style');
    if (document.activeElement === d) issues.push('decision-preselected');
    if (getComputedStyle(d).backgroundColor === getComputedStyle(panels[1]).backgroundColor && getComputedStyle(d).boxShadow === 'none') issues.push('decision-no-boundary');
  }
  const paused = panels[0].querySelector('[data-suspended="true"] .lf-generated-state');
  if (paused && !paused.textContent.trim()) issues.push('pause-without-reason');
  if (/!|¡/.test(document.querySelector('.lf-preview-content').textContent)) issues.push('exclamation');
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll');
  const walker = document.createTreeWalker(document.querySelector('.lf-preview-content'), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    if (!node.parentElement.closest('[data-copy-role]')) issues.push('copy-role-missing:' + node.textContent.trim().slice(0, 20));
  }
  return [...new Set(issues)];
})()`;

async function tabTo(selector) {
  let focus = 'no-focus';
  for (let n = 0; n < 20 && focus === 'no-focus'; n++) {
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

async function shot(name) {
  const capture = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(join(output, `${name}.png`), Buffer.from(capture.data, 'base64'));
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) {
      await navigate({ locale, theme, width });
      const issues = await page.evaluate(audit);
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, issues });
      if (width === 375 || width === 1280) await shot(`${SCREEN}-${locale}-${theme}-${width}`);
    }

  // The state production starts in: the judge is uncalibrated, both categories paused, in words.
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) {
    await navigate({ locale, theme: 'light', width: 375, extra: { judge: 'uncalibrated' } });
    configurations++;
    const r = await page.evaluate(`(() => ({ paused: document.querySelectorAll('[data-suspended="true"]').length,
      judge: document.querySelector('[data-judge]')?.dataset.judge, issues: ${audit} }))()`);
    if (r.paused !== 2 || r.judge !== 'uncalibrated' || r.issues.length) findings.push({ interaction: 'uncalibrated', locale, ...r });
    if (locale === 'es-MX') await shot(`${SCREEN}-uncalibrated-es-MX-light-375`);
  }

  // Loading and failure: no invented numbers, a status or an alert.
  for (const state of ['loading', 'failed']) {
    await navigate({ locale: 'pt-BR', theme: 'dark', width: 320, extra: { state } });
    configurations++;
    const r = await page.evaluate(`(() => { const p = document.querySelector('section[data-screen="staff-live-content-status"]');
      return { categories: p.querySelectorAll('[data-category]').length, role: !!p.querySelector(${JSON.stringify(state === 'loading' ? '[role="status"]' : '[role="alert"]')}) }; })()`);
    if (r.categories !== 0 || !r.role) findings.push({ interaction: 'status-state', state, ...r });
  }

  // Keyboard: Tab reaches a decision with a visible focus ring, Enter decides, one status line replaces the controls.
  await navigate({ locale: 'es-MX', theme: 'dark', width: 375 });
  const focus = await tabTo('section[data-screen="staff-live-content-review"] .lf-generated-decision');
  if (focus !== 'ok') findings.push({ interaction: 'decision-keyboard-focus', result: focus });
  await pressEnter();
  configurations++;
  const afterKey = await page.evaluate(`(() => { const p = document.querySelector('section[data-screen="staff-live-content-review"]');
    return { decisions: p.querySelectorAll('.lf-generated-decision').length, status: p.querySelector('[role="status"]')?.textContent ?? null }; })()`);
  if (afterKey.decisions !== 0 || !afterKey.status) findings.push({ interaction: 'decision-keyboard', ...afterKey });

  // A real pointer hit lands on a decision (nothing overlays the controls).
  await navigate({ locale: 'en-US', theme: 'light', width: 1280 });
  const target = await page.evaluate(`(() => { const b = document.querySelector('[data-decision="quality"]'); b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const hit = await page.evaluate(`document.elementFromPoint(${target.x}, ${target.y})?.closest('[data-decision]')?.dataset.decision ?? null`);
  if (hit !== 'quality') findings.push({ interaction: 'pointer-hit', hit });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
  await new Promise((done) => setTimeout(done, 150));
  configurations++;
  const decided = await page.evaluate(`!!document.querySelector('section[data-screen="staff-live-content-review"] [role="status"]')`);
  if (!decided) findings.push({ interaction: 'pointer-decides' });

  // A failed save keeps the decisions and says so; a stale decision says it was already made.
  for (const decide of ['failed', 'already']) {
    await navigate({ locale: 'pt-BR', theme: 'light', width: 375, extra: { decide } });
    await page.evaluate(`document.querySelector('[data-decision="approve"]').click()`);
    await new Promise((done) => setTimeout(done, 150));
    configurations++;
    const r = await page.evaluate(`(() => { const p = document.querySelector('section[data-screen="staff-live-content-review"]');
      return { decisions: p.querySelectorAll('.lf-generated-decision').length, alert: !!p.querySelector('[role="alert"]'), status: !!p.querySelector('[role="status"]') }; })()`);
    const ok = decide === 'failed' ? r.decisions === 3 && r.alert : r.decisions === 0 && r.status;
    if (!ok) findings.push({ interaction: 'decision-outcome', decide, ...r });
  }

  // A refused publish lists every reason, in a panel that still fits the screen.
  await navigate({ locale: 'es-MX', theme: 'light', width: 320, extra: { pack: 'refused' } });
  await page.evaluate(`document.querySelector('[data-pack="pack-preview-1"] button').click()`);
  await new Promise((done) => setTimeout(done, 150));
  configurations++;
  const refused = await page.evaluate(`(() => { const a = document.querySelector('[data-pack="pack-preview-1"] [role="alert"]');
    return { reasons: a ? a.querySelectorAll('li').length : 0, overflow: document.documentElement.scrollWidth > innerWidth + 1, issues: ${audit} }; })()`);
  if (refused.reasons !== 2 || refused.overflow || refused.issues.length) findings.push({ interaction: 'pack-refused', ...refused });
  await shot(`${SCREEN}-pack-refused-es-MX-light-320`);

  // A publish that lands replaces the actions with one status line.
  await navigate({ locale: 'en-US', theme: 'dark', width: 768 });
  await page.evaluate(`document.querySelector('[data-pack="pack-preview-2"] button').click()`);
  await new Promise((done) => setTimeout(done, 150));
  configurations++;
  const published = await page.evaluate(`(() => { const p = document.querySelector('[data-pack="pack-preview-2"]');
    return { buttons: p.querySelectorAll('button').length, status: p.querySelector('[role="status"]')?.textContent ?? null }; })()`);
  if (published.buttons !== 0 || !published.status) findings.push({ interaction: 'pack-published', ...published });

  // Reduced motion: nothing animates.
  await navigate({ locale: 'en-US', theme: 'light', width: 375, reducedMotion: true });
  configurations++;
  const moving = await page.evaluate(`document.getAnimations().length`);
  if (moving !== 0) findings.push({ interaction: 'reduced-motion', animations: moving });

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({
    configurations, findings,
    scope: 'Isolated rebuild preview of the C.5/C.6 staff surfaces (status, one review decision, the curated-pack release); not the finished staff-console composition (wave 2).',
  }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
