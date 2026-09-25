/*
 * C.24 real-Chrome matrix for the staff Mentor-quality dashboard
 * (`src/rebuild/staff/MentorQualityDashboard.tsx`) on the isolated rebuild
 * preview (no auth, no paid services). 3 locales x 2 themes x 4 widths, plus
 * the loading / failed / out-of-date / never-computed states and the
 * interactions.
 *
 *   REBUILD_URL=http://localhost:5330 node scripts/verify-rebuild-mentor-quality.mjs
 *
 * Checks: the four panels render; every registered signal has a row whose
 * status is in words; "needs review" and "on target" carry a glyph and no
 * other status does; 48 px targets; every visible string declares a copy
 * role; no horizontal scroll or clipped text; not a modal; nothing exclaims;
 * out-of-date numbers say so; loading and failure show no numbers; a reader
 * not named for a role sees no actions; keyboard focus is visible and Enter
 * acknowledges; resolving needs the root cause and then says resolved; a
 * refused action says why; the weekly sign-off lands or says it was already
 * signed; a real pointer hit lands on a flag action; nothing animates under
 * reduced motion. Writes report.json and screenshots to
 * ../audit-results/rebuild-mentor-quality.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://localhost:5330';
const output = resolve('../audit-results/rebuild-mentor-quality');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;
const SCREEN = 'staff-mentor-quality';
const SIGNALS = 46;
const PANELS = ['staff-mentor-quality-status', 'staff-mentor-quality-flags', 'staff-mentor-quality-review', 'staff-mentor-quality-signals'];

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
  const panels = ${JSON.stringify(PANELS)}.map((s) => document.querySelector('section[data-screen="' + s + '"]'));
  if (panels.some((p) => !p)) return ['missing-surface'];
  if (document.querySelector('[role="dialog"], dialog')) issues.push('modal');
  for (const panel of panels) {
    for (const b of panel.querySelectorAll('button, textarea')) {
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
  const rows = [...document.querySelectorAll('[data-signal]')];
  if (rows.length !== ${SIGNALS}) issues.push('signal-count:' + rows.length);
  for (const row of rows) {
    const status = row.querySelector('.lf-quality-status');
    if (!status || !status.textContent.trim()) issues.push('status-without-words:' + row.dataset.signal);
    const glyph = !!row.querySelector('svg');
    const s = row.dataset.status;
    if (glyph !== (s === 'ok' || s === 'breach')) issues.push('glyph-mismatch:' + row.dataset.signal);
    if (row.textContent.includes(row.dataset.signal)) issues.push('raw-signal-id:' + row.dataset.signal);
  }
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
  for (let n = 0; n < 40 && focus === 'no-focus'; n++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    focus = await page.evaluate(`(() => { const e = document.activeElement; if (!e || !e.matches(${JSON.stringify(selector)})) return 'no-focus';
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

const buttonByText = (scope, text) => `[...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find((b) => b.textContent === ${JSON.stringify(text)})`;

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) {
      await navigate({ locale, theme, width });
      const issues = await page.evaluate(audit);
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, issues });
      if (width === 375 || width === 1280) await shot(`${SCREEN}-${locale}-${theme}-${width}`);
    }

  // Out of date and never computed: said in words, never calm.
  for (const [fresh, locale] of [['stale', 'es-MX'], ['never', 'pt-BR']]) {
    await navigate({ locale, theme: 'light', width: 375, extra: { fresh } });
    configurations++;
    const r = await page.evaluate(`(() => ({ stale: document.querySelector('.lf-quality-fresh')?.dataset.stale,
      computed: document.querySelectorAll('[data-status="not_computed"]').length, issues: ${audit} }))()`);
    const ok = r.stale === 'true' && r.issues.length === 0 && (fresh === 'stale' ? r.computed === 0 : r.computed > 20);
    if (!ok) findings.push({ interaction: 'freshness', fresh, ...r });
    await shot(`${SCREEN}-${fresh}-${locale}-light-375`);
  }

  // Loading and failure: no numbers, a status or an alert, no other panel.
  for (const state of ['loading', 'failed']) {
    await navigate({ locale: 'pt-BR', theme: 'dark', width: 320, extra: { state } });
    configurations++;
    const r = await page.evaluate(`(() => ({ panels: document.querySelectorAll('section[data-screen]').length, signals: document.querySelectorAll('[data-signal]').length,
      role: !!document.querySelector(${JSON.stringify(state === 'loading' ? '[role="status"]' : '[role="alert"]')}) }))()`);
    if (r.panels !== 1 || r.signals !== 0 || !r.role) findings.push({ interaction: 'status-state', state, ...r });
  }

  // A reader not named for any role sees the flags and signals but no actions.
  await navigate({ locale: 'en-US', theme: 'dark', width: 768, extra: { viewer: 'none' } });
  configurations++;
  const readOnly = await page.evaluate(`document.querySelectorAll('section[data-screen] button').length`);
  if (readOnly !== 0) findings.push({ interaction: 'not-named-no-actions', buttons: readOnly });

  // Keyboard: Tab reaches the first flag action with a visible ring; Enter acknowledges.
  await navigate({ locale: 'es-MX', theme: 'dark', width: 375 });
  const focus = await tabTo('[data-flag="flag-emotion"] button');
  if (focus !== 'ok') findings.push({ interaction: 'flag-keyboard-focus', result: focus });
  await pressEnter();
  configurations++;
  const acked = await page.evaluate(`!!document.querySelector('[data-flag="flag-emotion"] [role="status"]')`);
  if (!acked) findings.push({ interaction: 'flag-keyboard-acknowledge' });

  // Resolving requires the root cause in words, then says resolved.
  await navigate({ locale: 'pt-BR', theme: 'light', width: 320 });
  await page.evaluate(`${buttonByText('[data-flag="flag-friction"]', 'Resolver')}.click()`);
  await new Promise((done) => setTimeout(done, 100));
  const before = await page.evaluate(`${buttonByText('[data-flag="flag-friction"]', 'Marcar resolvido')}.disabled`);
  await page.evaluate(`document.querySelector('[data-flag="flag-friction"] textarea').focus()`);
  await page.send('Input.insertText', { text: 'Limiar de latência calibrado errado para es-MX.' });
  await new Promise((done) => setTimeout(done, 100));
  const beforeIssues = await page.evaluate(audit);
  const enabled = await page.evaluate(`!${buttonByText('[data-flag="flag-friction"]', 'Marcar resolvido')}.disabled`);
  await shot(`${SCREEN}-resolve-pt-BR-light-320`);
  await page.evaluate(`${buttonByText('[data-flag="flag-friction"]', 'Marcar resolvido')}.click()`);
  await new Promise((done) => setTimeout(done, 150));
  configurations++;
  const resolved = await page.evaluate(`document.querySelector('[data-flag="flag-friction"] [role="status"]')?.textContent ?? null`);
  if (before !== true || !enabled || resolved !== 'Resolvido.' || beforeIssues.length) findings.push({ interaction: 'resolve', before, enabled, resolved, beforeIssues });

  // A refused action says why and keeps the actions.
  await navigate({ locale: 'en-US', theme: 'light', width: 375, extra: { act: 'not_owner' } });
  await page.evaluate(`document.querySelector('[data-flag="flag-emotion"] button').click()`);
  await new Promise((done) => setTimeout(done, 150));
  configurations++;
  const refused = await page.evaluate(`(() => ({ alert: document.querySelector('[data-flag="flag-emotion"] [role="alert"]')?.textContent ?? null,
    buttons: document.querySelectorAll('[data-flag="flag-emotion"] button').length }))()`);
  if (refused.alert !== 'Only the named owner can do this.' || refused.buttons !== 2) findings.push({ interaction: 'refused', ...refused });

  // The weekly sign-off lands; a second one says it was already signed.
  for (const review of ['done', 'already']) {
    await navigate({ locale: 'es-MX', theme: 'light', width: 768, extra: review === 'done' ? {} : { review } });
    await page.evaluate(`document.querySelector('[data-role="safety_trust_lead"] button').click()`);
    await new Promise((done) => setTimeout(done, 150));
    configurations++;
    const r = await page.evaluate(`(() => { const li = document.querySelector('[data-role="safety_trust_lead"]');
      return { status: li.querySelector('[role="status"]')?.textContent ?? null, buttons: li.querySelectorAll('button').length }; })()`);
    const expected = review === 'done' ? 'Revisión firmada.' : 'Ya se firmó esta semana.';
    if (r.status !== expected || r.buttons !== 0) findings.push({ interaction: 'review', review, ...r });
  }

  // A real pointer hit lands on a flag action (nothing overlays it).
  await navigate({ locale: 'en-US', theme: 'dark', width: 1280 });
  const target = await page.evaluate(`(() => { const b = document.querySelector('[data-flag="flag-bond"] button'); b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  const hit = await page.evaluate(`document.elementFromPoint(${target.x}, ${target.y})?.closest('[data-flag]')?.dataset.flag ?? null`);
  configurations++;
  if (hit !== 'flag-bond') findings.push({ interaction: 'pointer-hit', hit });

  // Reduced motion: nothing animates.
  await navigate({ locale: 'en-US', theme: 'light', width: 375, reducedMotion: true });
  configurations++;
  const moving = await page.evaluate(`document.getAnimations().length`);
  if (moving !== 0) findings.push({ interaction: 'reduced-motion', animations: moving });

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({
    configurations, findings,
    scope: 'Isolated rebuild preview of the C.24 staff Mentor-quality dashboard; not the finished staff-console composition (wave 2).',
  }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
