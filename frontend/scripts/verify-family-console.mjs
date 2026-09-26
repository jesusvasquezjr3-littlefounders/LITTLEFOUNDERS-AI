import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript } from './audits/synthetic-core.mjs';
import { KID_A, KID_B } from './audits/lanes/family.mjs';

/*
 * W2F.1 (Lane 4): the rebuilt Family console (F1), a child's progress (F2) and
 * a child's Mentor talks (F3) on their REAL routes, in real Chrome, signed in
 * with a synthetic session and answered by the synthetic Core (the family
 * lane's scenarios in scripts/audits/lanes/family.mjs; nothing leaves the
 * machine).
 *
 *   REBUILD_URL=http://localhost:5440 node scripts/verify-family-console.mjs
 *
 * Matrix: every screen state x 3 locales x 2 modes x 320/375/768/1280 px x
 * 100% and 140% text. Each configuration checks: one h1 and one <main>; no
 * horizontal page scroll; no text clipped inside its box or pushed off screen;
 * body text at least 14 px; every button, link, field and switch at least
 * 48 x 48 px; a copy role on every text node and each role inside its budget
 * (adult Tutor copy; first view at 375 px within 40 words, x1.25 in es/pt);
 * no em dash; no celebration; OD-6 wording (the AI is never a bot, an
 * assistant or an "AI tutor"); zero browser errors; and, at 100% text, zero
 * axe violations inside the rebuilt page.
 *
 * Journeys (real pointer and keyboard input): picking another child by
 * keyboard writes it to the address and keeps the scroll; "See progress"
 * moves focus to the new page's heading and its way back returns to the same
 * child; the usage-data switch and the microphone's two-step consent send
 * their exact bodies; a flagged talk opens at the flagged moment; the note
 * approval is sent once. Populations: a verified Tutor sees the console; a
 * parent-created child, an independent teen, an adult who is not a verified
 * parent, a staff member and a guest are sent away by the parent gate on all
 * three routes and never see a console.
 *
 * Reports and screenshots: audit-results/family-console/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5440';
const out = resolve('../audit-results/family-console');
mkdirSync(out, { recursive: true });
const LOCALES = (process.env.FAMILY_LOCALES ?? 'en-US,es-MX,pt-BR').split(',');
const THEMES = (process.env.FAMILY_THEMES ?? 'light,dark').split(',');
const WIDTHS = (process.env.FAMILY_WIDTHS ?? '320,375,768,1280').split(',').map(Number);
const SCALES = (process.env.FAMILY_SCALES ?? '1,1.4').split(',').map(Number);

const STATES = [
  { id: 'console-two', path: `/family?child=${KID_A}`, scenario: 'family-two', ready: '[data-console-part="overview"] [data-copy-role]' },
  { id: 'console-teen', path: `/family?child=${KID_B}`, scenario: 'family-two', ready: '[data-console-control="manage-child"][data-self-managed="true"]' },
  { id: 'console-empty', path: '/family', scenario: 'family-empty', ready: '.lf-family-console .lf-state--empty' },
  { id: 'console-add', path: '/family', scenario: 'family-empty', ready: '[data-console-control="add-child"] form', open: '[data-console-control="add-child"] button' },
  { id: 'console-manage', path: '/family', scenario: 'family-one', ready: '[data-console-control="remove-child"]', open: '[data-console-control="manage-child"] button' },
  { id: 'console-unverified', path: '/family', scenario: 'family-unverified', ready: '.lf-family-console .lf-state--empty a[href="/verify-parent"]' },
  { id: 'console-offline', path: '/family', scenario: 'family-offline', ready: '.lf-family-console .lf-state--error' },
  { id: 'progress', path: `/family/${KID_A}/territory`, scenario: 'family-two', ready: '[data-console-part="shares"] button' },
  { id: 'progress-forbidden', path: `/family/${KID_A}/territory`, scenario: 'family-progress-forbidden', ready: '[data-screen="child-progress"] .lf-state--empty' },
  { id: 'progress-no-course', path: `/family/${KID_A}/territory`, scenario: 'family-progress-no-course', ready: '[data-screen="child-progress"] .lf-state--empty' },
  { id: 'mentor', path: `/family/${KID_A}/tutor`, scenario: 'family-two', ready: '[data-memory-note]' },
  { id: 'mentor-transcript', path: `/family/${KID_A}/tutor`, scenario: 'family-two', ready: '[data-console-part="sessions"] [data-console-part="transcript"] li',
    open: '[data-console-part="sessions"] [data-session-id] button' },
  { id: 'mentor-quiet', path: `/family/${KID_A}/tutor`, scenario: 'family-mentor-quiet', ready: '[data-console-part="disposition"] dl' },
  { id: 'mentor-forbidden', path: `/family/${KID_A}/tutor`, scenario: 'family-mentor-forbidden', ready: '[data-screen="child-mentor"] .lf-state--empty' },
];
const filter = process.env.FAMILY_STATES?.split(',');
const states = STATES.filter((state) => !filter || filter.includes(state.id));

const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const evidence = [];
const failures = [];
const journeys = [];
const unknownRequests = new Set();
const reloads = [];

async function waitFor(page, expression, what, tries = 600) {
  for (let n = 0; n < tries; n++) {
    // A page between two documents throws (no documentElement yet): keep polling, the timeout is the verdict.
    try { if (await page.evaluate(`!!(${expression})`)) return; } catch { /* navigating */ }
    await sleep(50);
  }
  throw new Error(`Timed out: ${what}`);
}

/** A real pointer press on the first visible element matching `selector`, refused when something covers it. */
async function press(page, selector) {
  // Let any smooth scroll (the flagged moment, a route's scroll restore) settle first, or the press lands where the element was.
  for (let last = '', n = 0; n < 40; n++) {
    const now = await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return 'missing'; e.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect(); return Math.round(r.x) + ',' + Math.round(r.y) + ',' + scrollY; })()`);
    if (now === last) break;
    last = now; await sleep(60);
  }
  const point = await page.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; });
    if (!e) return { missing: true };
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, top = document.elementFromPoint(x, y);
    // Input events are in visual-viewport coordinates; a mobile layout viewport taller than the visual one offsets them.
    const vv = window.visualViewport;
    return { missing: false, occluded: !(e.contains(top) || top?.contains(e)), x: x - (vv?.offsetLeft ?? 0), y: y - (vv?.offsetTop ?? 0) };
  })()`);
  if (point.missing) throw new Error(`Missing: ${selector}`);
  if (point.occluded) throw new Error(`Occluded: ${selector}`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}
const pressText = (page, scope, text) => page.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(`${scope} button, ${scope} a`)})]
  .find((el) => el.textContent.trim() === ${JSON.stringify(text)}); if (e) { e.setAttribute('data-press', '1'); return true; } return false; })()`)
  .then(async (found) => { if (!found) throw new Error(`Missing "${text}" in ${scope}`); await press(page, '[data-press="1"]'); await page.evaluate("document.querySelector('[data-press]')?.removeAttribute('data-press')"); });

async function key(page, name, code, keyCode, modifiers = 0) {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, modifiers, ...(name === 'Enter' ? { text: String.fromCharCode(13) } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
}

async function load(page, { path, scenario, locale, theme, width, scale = 1, reduced = true }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  if (await page.evaluate('location.origin').catch(() => '') !== origin) {
    await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
    await waitFor(page, `location.origin === ${JSON.stringify(origin)}`, 'origin');
  }
  // A hidden tab pauses animations and timers: keep this one in front so motion and route focus run as a person sees them.
  await page.send('Page.bringToFront').catch(() => {});
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  const spec = SCENARIOS[scenario];
  page.core = { scenario, locale, theme, fixtures: {}, posts: page.core?.posts ?? [] };
  await page.evaluate(sessionStorageScript({ guest: spec.guest, locale, theme }));
  const url = new URL(path, origin); url.searchParams.set('lng', locale);
  await page.send('Page.navigate', { url: url.toString() });
  // The dev server on this shared machine sometimes serves a navigation's modules slowly enough that the app has not
  // mounted after 30 s (a blank document, no error). One reload is allowed and recorded; a second blank page fails.
  const mounted = `!!document.querySelector('[data-shell], main')`;
  try { await waitFor(page, mounted, `${path}: app mounted`); } catch {
    reloads.push(`${path} ${locale}`);
    await page.send('Page.navigate', { url: url.toString() });
    await waitFor(page, mounted, `${path}: app mounted after one reload`);
  }
  if (!spec.family) return; // a population the parent gate refuses: the caller waits for where it lands
  await waitFor(page, `document.querySelector('[data-shell]')?.getAttribute('lang') === ${JSON.stringify(locale)}`, `${path}: shell`);
  await page.evaluate('document.fonts.ready');
  await waitFor(page, "!document.documentElement.classList.contains('theme-transitioning')", 'theme settled');
  if (scale !== 1) await page.evaluate(`document.documentElement.style.fontSize = '${16 * scale}px'`);
}

/** Everything one configuration must satisfy, measured inside the rebuilt page (the shell has its own matrix). */
const audit = ({ locale, width, scale, axe }) => `(async () => {
  const issues = [], root = document.querySelector('.lf-family-console');
  if (!root) return ['wrong-screen'];
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll:' + (document.documentElement.scrollWidth - innerWidth));
  if (document.querySelectorAll('main h1').length !== 1) issues.push('h1-count:' + document.querySelectorAll('main h1').length);
  if (document.querySelectorAll('main').length !== 1) issues.push('main-count');
  const words = (t) => (t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu) || []).length;
  const factor = ${locale === 'en-US' ? 1 : 1.25};
  const limits = { action: 3, heading: 6, body: 12, option: 8, prompt: 20, mentor: 20, narrative: 30 };
  let fold = 0;
  for (const e of root.querySelectorAll('[data-copy-role]')) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (!r.width || !r.height || s.visibility === 'hidden') continue;
    const role = e.dataset.copyRole, text = e.textContent.trim();
    if (role in limits && words(text) > Math.ceil(limits[role] * factor)) issues.push('copy:' + role + ':' + text.slice(0, 80));
    if (text.includes('—')) issues.push('em-dash:' + text.slice(0, 60));
    if ((s.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) || (s.overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1)) issues.push('text-clipped:' + text.slice(0, 60));
    if (r.right > innerWidth + 1 || r.left < -1) issues.push('offscreen:' + text.slice(0, 60));
    if (text && parseFloat(s.fontSize) < 14 * ${scale} - 0.5) issues.push('text-size:' + text.slice(0, 40));
    if (r.top < 740 && r.bottom > 0 && !['data', 'brand', 'legal'].includes(role) && !e.parentElement.closest('[data-copy-role]')) fold += words(text);
  }
  if (${width} === 375 && ${scale} === 1 && fold > Math.ceil(40 * factor)) issues.push('first-view:' + fold);
  for (const e of root.querySelectorAll('button, a[href], input:not([type=radio]):not([type=checkbox]), select, textarea, [role=switch]')) {
    const r = e.getBoundingClientRect(); if (!r.width && !r.height) continue;
    if (r.width < 47.5 || r.height < 47.5) issues.push('target:' + (e.textContent.trim() || e.getAttribute('aria-label') || e.tagName).slice(0, 40) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim() && !n.parentElement.closest('[data-copy-role]')) issues.push('no-copy-role:' + n.textContent.trim().slice(0, 40));
  if (/\\b(bot|chatbot|assistant|asistente|assistente|ai tutor|tutor ia|tutor de ia)\\b/i.test(root.textContent)) issues.push('glossary:the AI is the Mentor');
  if (document.querySelector('[data-milestone], .lf-confetti, [data-celebration]')) issues.push('celebration');
  if (${axe}) {
    const result = await axe.run({ include: [['.lf-family-console']] }, { resultTypes: ['violations'] });
    for (const v of result.violations) issues.push('axe:' + v.id + ' ' + v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', '));
  }
  return issues;
})()`;

const copy = Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale) => [locale, JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-family.json`), 'utf8'))]));

try {
  const warm = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await warm.send('Page.close').catch(() => {});
  const page = await openPage(browser.browser, { width: 375, height: 740, dark: false, newWindow: true, isolated: true });
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests });
  // Record every write the page sends (the journeys assert exact bodies).
  const writes = [];
  page.ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method !== 'Fetch.requestPaused' || message.sessionId !== page.sessionId) return;
    const { request } = message.params;
    if (!['GET', 'OPTIONS'].includes(request.method) && request.url.includes('/api/v1/')) writes.push({ method: request.method, path: new URL(request.url).pathname.replace(/^.*\/api\/v1/, ''), body: request.postData ? JSON.parse(request.postData) : null });
  });
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');

  // 1. The matrix.
  for (const state of states) for (const locale of LOCALES) for (const theme of THEMES) for (const width of WIDTHS) for (const scale of SCALES) {
    const where = `${state.id} ${locale} ${theme} ${width}px ${Math.round(scale * 100)}%`;
    page.errors.length = 0;
    try {
      await load(page, { ...state, locale, theme, width, scale });
      if (state.open) {
        await waitFor(page, `document.querySelector(${JSON.stringify(state.open)})`, `${where}: opener`);
        // Panels above the opener finish loading and move it; press once the page has settled, and again if a shift swallowed the press.
        for (let attempt = 0; attempt < 3; attempt++) {
          await waitFor(page, "!document.querySelector('.lf-family-console [aria-busy=\"true\"], .lf-family-console .lf-loading')", `${where}: settled`);
          await sleep(250);
          await press(page, state.open);
          try { await waitFor(page, `document.querySelector(${JSON.stringify(state.ready)})`, `${where}: ready`, 60); break; } catch (error) { if (attempt === 2) throw error; }
        }
      }
      await waitFor(page, `document.querySelector(${JSON.stringify(state.ready)})`, `${where}: ready`);
      await sleep(120);
      await page.evaluate('window.scrollTo(0, 0)');
      const axe = scale === 1;
      if (axe) await page.evaluate(axeSource);
      const issues = await page.evaluate(audit({ locale, width, scale, axe }));
      const errors = page.errors.filter((error) => !/Failed to load resource|net::ERR|synthetic core/i.test(error));
      assert.deepEqual([...issues, ...errors.map((e) => `js:${e.slice(0, 160)}`)], [], where);
      if (scale === 1 && (width === 375 || width === 1280)) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: await page.evaluate(`({ x: 0, y: 0, width: innerWidth, height: Math.min(document.documentElement.scrollHeight, 4000), scale: 1 })`) });
        writeFileSync(join(out, `${state.id}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
      evidence.push({ state: state.id, locale, theme, width, scale, axe: axe ? 0 : 'n/a' });
      process.stdout.write('.');
    } catch (error) {
      failures.push(`${where}: ${error.message.slice(0, 1500)}`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) writeFileSync(join(out, `FAIL-${state.id}-${locale}-${theme}-${width}-${Math.round(scale * 100)}.png`), Buffer.from(shot.data, 'base64'));
      process.stdout.write('F');
    }
  }

  // 2. Journeys, in two configurations (a phone in English and light, a desktop in Spanish and dark).
  for (const [locale, theme, width] of [['en-US', 'light', 375], ['es-MX', 'dark', 1280]]) {
    const c = copy[locale];
    const where = `journey ${locale} ${theme} ${width}px`;
    try {
      page.errors.length = 0; writes.length = 0;
      await load(page, { path: `/family?child=${KID_A}`, scenario: 'family-two', locale, theme, width, reduced: false });
      await waitFor(page, "document.querySelector('[data-console-part=\"picker\"] button')", `${where}: picker`);
      // Keyboard: focus the second child's chip and press Enter; the address names that child and the page does not jump.
      await page.evaluate('window.scrollTo(0, 120)');
      const before = await page.evaluate('scrollY');
      await page.evaluate("[...document.querySelectorAll('[data-console-part=\"picker\"] button')][1].focus({ preventScroll: true })");
      await key(page, 'Enter', 'Enter', 13);
      await waitFor(page, `location.search.includes(${JSON.stringify(`child=${KID_B}`)}) && document.querySelector('[data-console-control="manage-child"][data-self-managed="true"]')`, `${where}: picked child`);
      const after = await page.evaluate("({ scrollY, focus: document.activeElement?.getAttribute('aria-pressed') })");
      assert.equal(after.focus, 'true', 'focus stays on the picked child');
      assert.ok(Math.abs(after.scrollY - before) < 2, `in-place change keeps the scroll (${before} -> ${after.scrollY})`);
      // The usage-data switch sends the verb for its direction (Mateo starts on).
      await press(page, '[data-console-control="insights"] [role=switch]');
      await waitFor(page, "document.querySelector('[data-console-control=\"insights\"] [role=switch]')?.getAttribute('aria-checked') === 'false'", `${where}: consent off`);
      assert.deepEqual(writes.filter((w) => w.path.endsWith('/analytics-consent')).map((w) => `${w.method} ${w.path}`), [`DELETE /family/kids/${KID_B}/analytics-consent`]);
      // The microphone: the exact wording first, then a deliberate second press stores it.
      await pressText(page, '[data-console-control="microphone"]', c.familyChildConsent.micAllow);
      await waitFor(page, "document.querySelector('[data-console-consent=\"microphone\"] [data-copy-role=legal]')", `${where}: consent wording shown`);
      assert.equal(writes.filter((w) => w.path === '/tutor/consent').length, 0, 'nothing is stored before the second press');
      await pressText(page, '[data-console-consent="microphone"]', c.familyChildConsent.micConfirm);
      await waitFor(page, `[...document.querySelectorAll('[data-console-control="microphone"] button')].some((b) => b.textContent.trim() === ${JSON.stringify(c.familyChildConsent.micTurnOff)})`, `${where}: microphone on`);
      assert.deepEqual(writes.find((w) => w.path === '/tutor/consent')?.body, { kidUserId: KID_B, consentText: c.familyChildConsent.micConsent, locale });
      // A real press on "See progress": new route, focus on its heading, and the way back returns to the same child.
      await pressText(page, '[data-console-part="overview"]', c.familyConsole.progress);
      await waitFor(page, `location.pathname === ${JSON.stringify(`/family/${KID_B}/territory`)} && document.querySelector('[data-screen="child-progress"] h1')`, `${where}: progress route`);
      await waitFor(page, "document.activeElement?.tagName === 'H1' || document.activeElement?.tagName === 'MAIN'", `${where}: route focus`);
      assert.equal(await page.evaluate('scrollY'), 0, 'route change scrolls to the top');
      await waitFor(page, "document.querySelector('[data-console-part=\"map\"]')", `${where}: map`);
      await pressText(page, '[data-screen="child-progress"] .lf-console-header', c.familyChildProgress.back);
      await waitFor(page, `location.pathname === '/family' && location.search.includes(${JSON.stringify(`child=${KID_B}`)}) && document.querySelector('[data-console-part="overview"][data-child-id=${JSON.stringify(KID_B)}]')`, `${where}: back to the same child`);
      // F3: the flagged talk opens at the flagged moment; the note approval is sent once.
      await load(page, { path: `/family/${KID_A}/tutor`, scenario: 'family-two', locale, theme, width, reduced: false });
      await waitFor(page, "document.querySelector('[data-console-part=\"flags\"] li button')", `${where}: flags`);
      await press(page, '[data-console-part="flags"] li button');
      await waitFor(page, "document.querySelector('[data-console-part=\"flags\"] [data-flagged=\"true\"]')", `${where}: flagged moment`);
      const flaggedVisible = await page.evaluate("(() => { const r = document.querySelector('[data-flagged=\"true\"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()");
      assert.ok(flaggedVisible, 'the flagged moment is scrolled into view');
      await pressText(page, '[data-memory-note]', c.familyMemoryNotes.approve);
      await waitFor(page, `document.querySelector('[data-memory-note]')?.textContent.includes(${JSON.stringify(c.familyMemoryNotes.approved)})`, `${where}: note approved`);
      assert.deepEqual(writes.filter((w) => w.path.includes('/memory-proposals/')).map((w) => w.body), [{ verdict: 'approved' }]);
      assert.deepEqual(page.errors.filter((error) => !/Failed to load resource|net::ERR|synthetic core/i.test(error)), [], 'JS errors');
      journeys.push({ journey: where, result: 'passed', writes: writes.map((w) => `${w.method} ${w.path}`) });
      process.stdout.write('J');
    } catch (error) {
      failures.push(`${where}: ${error.message.slice(0, 1500)}`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) writeFileSync(join(out, `FAIL-journey-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      process.stdout.write('F');
    }
  }

  // 2b. Offline: with the browser offline, a retry that fails says "offline", not "our side"; back online, a retry loads the family.
  for (const [locale, theme, width] of [['pt-BR', 'dark', 375]]) {
    const c = copy[locale];
    const where = `offline ${locale} ${theme} ${width}px`;
    try {
      page.errors.length = 0;
      await load(page, { path: '/family', scenario: 'family-offline', locale, theme, width });
      await waitFor(page, "document.querySelector('.lf-family-console .lf-state--error')", `${where}: failure`);
      await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await pressText(page, '.lf-family-console .lf-state--error', c.familyConsole.retry);
      await waitFor(page, `document.querySelector('.lf-family-console .lf-state--error')?.textContent.includes(${JSON.stringify(c.familyConsole.offlineBody)})`, `${where}: offline copy`);
      await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      page.core = { ...page.core, scenario: 'family-one' };
      await pressText(page, '.lf-family-console .lf-state--error', c.familyConsole.retry);
      await waitFor(page, "document.querySelector('[data-console-part=\"overview\"]')", `${where}: back online`);
      journeys.push({ journey: where, result: 'passed' });
      process.stdout.write('O');
    } catch (error) {
      await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
      failures.push(`${where}: ${error.message.slice(0, 600)}`);
      process.stdout.write('F');
    }
  }

  // 3. Populations: only a verified Tutor sees the console; everyone else is sent away by the parent gate.
  for (const scenario of ['family-kid', 'family-teen', 'family-adult', 'family-staff', 'family-guest']) {
    for (const path of ['/family', `/family/${KID_A}/territory`, `/family/${KID_A}/tutor`]) {
      const where = `population ${scenario} ${path}`;
      try {
        page.errors.length = 0;
        await load(page, { path, scenario, locale: 'en-US', theme: 'light', width: 375 });
        await waitFor(page, "!location.pathname.startsWith('/family')", `${where}: sent away`, 200);
        await sleep(300);
        assert.equal(await page.evaluate("!!document.querySelector('.lf-family-console')"), false, 'no console');
        journeys.push({ journey: where, result: 'refused', landed: await page.evaluate('location.pathname') });
        process.stdout.write('P');
      } catch (error) {
        const at = await page.evaluate("location.pathname + ' | ' + document.body.innerText.slice(0, 120).replace(/\s+/g, ' ')").catch(() => '?');
        failures.push(`${where}: ${error.message.slice(0, 600)} (at ${at}) [errors: ${page.errors.slice(0, 2).join(' | ').slice(0, 300)}]`);
        const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
        if (shot) writeFileSync(join(out, `FAIL-${scenario}-${path.split('/').pop()}.png`), Buffer.from(shot.data, 'base64'));
        process.stdout.write('F');
      }
    }
  }
  await page.send('Page.close').catch(() => {});
} catch (error) {
  failures.push(`setup: ${error.message}`);
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({
    provenance: 'Real routes on a local Vite server in headless Chrome, real pointer and keyboard input; synthetic Core; not full-stack',
    origin, date: new Date().toISOString(), configurations: evidence.length + failures.length, passed: evidence.length, failures, journeys, reloads, evidence,
    unansweredCoreRequests: [...unknownRequests].sort(),
  }, null, 1));
  browser.child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
console.log(`\n${evidence.length} configurations passed, ${journeys.length} journeys and population checks passed, ${failures.length} failures, ${reloads.length} slow loads reloaded once`);
if (failures.length) { console.log(failures.slice(0, 40).join('\n')); process.exitCode = 1; }
if (unknownRequests.size) console.log(`Synthetic Core answered with an empty envelope: ${[...unknownRequests].sort().join('; ')}`);
