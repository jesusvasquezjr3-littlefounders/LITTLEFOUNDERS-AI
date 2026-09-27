import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript } from './audits/synthetic-core.mjs';
import { KID_A, KID_B } from './audits/lanes/family.mjs';

/*
 * W2F.2 (Lane 4): the rebuilt Tasks boards (F4-P for the Tutor, F4-K for a
 * child in a family), the coin screens (F5-P, F5-K) and the independent
 * teen's wallet (OD-3 Option B) on their REAL routes, in real Chrome, signed
 * in with a synthetic session and answered by the synthetic Core (the family
 * lane's `money` scenarios in scripts/audits/lanes/family.mjs; nothing leaves
 * the machine).
 *
 *   REBUILD_URL=http://localhost:5440 node scripts/verify-family-money-screens.mjs
 *
 * Matrix: every screen state x 3 locales x 2 modes x 320/375/768/1280 px x
 * 100% and 140% text. Each configuration checks, inside the rebuilt page and
 * any dialog it opened: one h1 and one <main>; no horizontal page scroll; no
 * text clipped or pushed off screen; text at least 14 px; 48 x 48 px targets;
 * a copy role on every text node and each role inside its budget for the
 * page's declared age band (a child's page declares its register: the 6-9
 * limits, first view 25 words, x1.25 in es/pt; adult and teen pages 40); no
 * em dash; no celebration; the glossary (the AI is never a bot or an "AI
 * tutor"; coins are never money); zero browser errors; and, at 100% text,
 * zero axe violations.
 *
 * Journeys (real pointer and keyboard input): the Tutor adds a reward (the
 * exact body) and pauses one (sent once, shown only after Core confirms),
 * opens a chore's photo in a dialog that traps focus and gives it back on
 * Escape; picks another child's coins by keyboard (written to `?child=`,
 * scroll kept) and saves an allowance (the exact body); a child follows "See
 * wallet" to the new route (focus on its heading, scroll at the top) and
 * changes the card's name and colour (the exact body); the teen's wallet says
 * "offline" and loads back online. Populations: /tasks and /banking are
 * refused to an independent teen with no linked parent, an adult who is not
 * a verified parent, a staff member and a guest; /wallet is refused to a
 * parent-created child, an adult, a Tutor and staff.
 *
 * Reports and screenshots: audit-results/family-money/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5440';
const out = resolve('../audit-results/family-money');
mkdirSync(out, { recursive: true });
const LOCALES = (process.env.FAMILY_LOCALES ?? 'en-US,es-MX,pt-BR').split(',');
const THEMES = (process.env.FAMILY_THEMES ?? 'light,dark').split(',');
const WIDTHS = (process.env.FAMILY_WIDTHS ?? '320,375,768,1280').split(',').map(Number);
const SCALES = (process.env.FAMILY_SCALES ?? '1,1.4').split(',').map(Number);

const STATES = [
  { id: 'tasks-tutor', path: '/tasks', scenario: 'money-tutor', ready: '[data-screen="tutor-tasks"] [data-family-part="rewards"] li' },
  { id: 'tasks-tutor-add', path: '/tasks', scenario: 'money-tutor', ready: '[data-family-part="add-reward"] input', open: '[data-family-part="rewards"] > .lf-button-group button' },
  { id: 'tasks-tutor-photo', path: '/tasks', scenario: 'money-tutor', ready: '[data-overlay="dialog"] [data-family-part="photo"] .lf-notice',
    open: '[data-chores="waiting"] [data-task-id] button[aria-haspopup="dialog"]' },
  { id: 'tasks-tutor-empty', path: '/tasks', scenario: 'money-tutor-empty', ready: '[data-screen="tutor-tasks"] .lf-state--empty' },
  { id: 'tasks-tutor-offline', path: '/tasks', scenario: 'money-tutor-offline', ready: '[data-screen="tutor-tasks"] .lf-state--error' },
  { id: 'tasks-child', path: '/tasks', scenario: 'money-child', ready: '[data-screen="child-tasks"] [data-family-part="payouts"] .lf-rebuild' },
  { id: 'tasks-child-new', path: '/tasks', scenario: 'money-child-new', ready: '[data-screen="child-tasks"] [data-family-part="pockets"]' },
  { id: 'tasks-child-offline', path: '/tasks', scenario: 'money-child-offline', ready: '[data-screen="child-tasks"] .lf-state--error' },
  { id: 'tasks-teen-linked', path: '/tasks', scenario: 'money-teen-linked', ready: '[data-screen="child-tasks"][data-age-band="13-17"] [data-task-id]' },
  { id: 'coins-tutor', path: `/banking?child=${KID_A}`, scenario: 'money-tutor', ready: '[data-screen="tutor-coins"] [data-family-part="limit"] [role=progressbar]' },
  { id: 'coins-tutor-open', path: `/banking?child=${KID_A}`, scenario: 'money-tutor-new', ready: '[data-family-part="open-card"] input' },
  { id: 'coins-tutor-offline', path: '/banking', scenario: 'money-tutor-offline', ready: '[data-screen="tutor-coins"] .lf-state--error' },
  { id: 'coins-child', path: '/banking', scenario: 'money-child', ready: '[data-screen="child-coins"] [data-family-part="card-look"] button' },
  { id: 'coins-child-card', path: '/banking', scenario: 'money-child', ready: '[data-overlay="dialog"] [data-family-part="card-colour"] button',
    open: '[data-family-part="card-look"] button' },
  { id: 'coins-teen-linked', path: '/banking', scenario: 'money-teen-linked', ready: '[data-screen="child-coins"][data-age-band="13-17"] [data-family-part="card-look"]' },
  { id: 'wallet-teen', path: '/wallet', scenario: 'money-teen', ready: '[data-teen-wallet="root"] [data-pocket="save"]' },
  { id: 'wallet-teen-offline', path: '/wallet', scenario: 'money-teen-offline', ready: '[data-teen-wallet="root"] .lf-state--error' },
];
const filter = process.env.FAMILY_STATES?.split(',');
const states = STATES.filter((state) => !filter || filter.includes(state.id));
const ROOT = '[data-screen].lf-family-money, [data-teen-wallet="root"]';

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

async function load(page, { path, scenario, locale, theme, width, scale = 1, reduced = true, population = false }) {
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
  if (!spec.family || population) return; // a population a route guard refuses: the caller waits for where it lands
  await waitFor(page, `document.querySelector('[data-shell]')?.getAttribute('lang') === ${JSON.stringify(locale)}`, `${path}: shell`);
  await page.evaluate('document.fonts.ready');
  await waitFor(page, "!document.documentElement.classList.contains('theme-transitioning')", 'theme settled');
  if (scale !== 1) await page.evaluate(`document.documentElement.style.fontSize = '${16 * scale}px'`);
}

/** Everything one configuration must satisfy, measured inside the rebuilt page and any dialog it opened (the shell has its own matrix). */
const audit = ({ locale, width, scale, axe }) => `(async () => {
  const issues = [], root = document.querySelector(${JSON.stringify(ROOT)});
  if (!root) return ['wrong-screen'];
  const scopes = [root, ...document.querySelectorAll('[data-overlay="dialog"]')];
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll:' + (document.documentElement.scrollWidth - innerWidth));
  if (document.querySelectorAll('main h1').length !== 1) issues.push('h1-count:' + document.querySelectorAll('main h1').length);
  if (document.querySelectorAll('main').length !== 1) issues.push('main-count');
  const band = root.dataset.ageBand ?? 'adult';
  const young = band === '6-9';
  const words = (t) => (t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu) || []).length;
  const factor = ${locale === 'en-US' ? 1 : 1.25};
  const limits = { action: 3, heading: 6, body: 12, option: young ? 5 : 8, prompt: young ? 12 : 20, mentor: young ? 12 : 20, narrative: 30 };
  let fold = 0; const folded = [];
  for (const scope of scopes) for (const e of scope.querySelectorAll('[data-copy-role]')) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    if (!r.width || !r.height || s.visibility === 'hidden') continue;
    const role = e.dataset.copyRole, text = e.textContent.trim();
    if (role in limits && words(text) > Math.ceil(limits[role] * factor)) issues.push('copy:' + role + ':' + text.slice(0, 80));
    if (text.includes('—')) issues.push('em-dash:' + text.slice(0, 60));
    if ((s.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) || (s.overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1)) issues.push('text-clipped:' + text.slice(0, 60));
    if (r.right > innerWidth + 1 || r.left < -1) issues.push('offscreen:' + text.slice(0, 60));
    if (text && parseFloat(s.fontSize) < 14 * ${scale} - 0.5) issues.push('text-size:' + text.slice(0, 40));
    if (scope === root && r.top < 740 && r.bottom > 0 && !['data', 'brand', 'legal'].includes(role) && !e.parentElement.closest('[data-copy-role]')) { fold += words(text); folded.push(role + ':' + text.slice(0, 40)); }
  }
  const foldLimit = Math.ceil((young ? 25 : 40) * factor);
  if (${width} === 375 && ${scale} === 1 && scopes.length === 1 && fold > foldLimit) issues.push('first-view:' + fold + '>' + foldLimit + ' [' + folded.join(' | ') + ']');
  for (const scope of scopes) for (const e of scope.querySelectorAll('button, a[href], input:not([type=radio]):not([type=checkbox]), select, textarea, [role=switch]')) {
    const r = e.getBoundingClientRect(); if (!r.width && !r.height) continue;
    if (r.width < 47.5 || r.height < 47.5) issues.push('target:' + (e.textContent.trim() || e.getAttribute('aria-label') || e.tagName).slice(0, 40) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  for (const scope of scopes) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent.trim() && !n.parentElement.closest('[data-copy-role]')) issues.push('no-copy-role:' + n.textContent.trim().slice(0, 40));
  }
  const all = scopes.map((scope) => scope.textContent).join(' ');
  if (/\\b(bot|chatbot|assistant|asistente|assistente|ai tutor|tutor ia|tutor de ia)\\b/i.test(all)) issues.push('glossary:the AI is the Mentor');
  if (/\\b(redeem|redemption|credits|canje|resgate)\\b/i.test(all)) issues.push('glossary:bank register');
  if (document.querySelector('.lf-confetti, [data-celebration]')) issues.push('celebration');
  if (${axe}) {
    const result = await axe.run({ include: scopes.map((scope) => [scope === root ? ${JSON.stringify(ROOT)} : '[data-overlay="dialog"]']) }, { resultTypes: ['violations'] });
    for (const v of result.violations) issues.push('axe:' + v.id + ' ' + v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', '));
  }
  return issues;
})()`;

const copy = Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale) => [locale, JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-family.json`), 'utf8'))]));
const ignorable = (error) => /Failed to load resource|net::ERR|synthetic core/i.test(error);

try {
  const warm = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await warm.send('Page.close').catch(() => {});
  const page = await openPage(browser.browser, { width: 375, height: 740, dark: false, newWindow: true, isolated: true });
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests });
  const writes = [];
  page.ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method !== 'Fetch.requestPaused' || message.sessionId !== page.sessionId) return;
    const { request } = message.params;
    if (!['GET', 'OPTIONS'].includes(request.method) && request.url.includes('/api/v1/')) {
      let body = null;
      try { body = request.postData ? JSON.parse(request.postData) : null; } catch { body = 'multipart'; }
      writes.push({ method: request.method, path: new URL(request.url).pathname.replace(/^.*\/api\/v1/, ''), body });
    }
  });
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');
  const settled = `!document.querySelector('${ROOT.replace(/'/g, "\\'").split(', ').map((s) => `${s} [aria-busy="true"], ${s} .lf-loading`).join(', ')}')`;

  // 1. The matrix.
  for (const state of states) for (const locale of LOCALES) for (const theme of THEMES) for (const width of WIDTHS) for (const scale of SCALES) {
    const where = `${state.id} ${locale} ${theme} ${width}px ${Math.round(scale * 100)}%`;
    page.errors.length = 0;
    try {
      await load(page, { ...state, locale, theme, width, scale });
      if (state.open) {
        await waitFor(page, `document.querySelector(${JSON.stringify(state.open)})`, `${where}: opener`);
        for (let attempt = 0; attempt < 3; attempt++) {
          await waitFor(page, settled, `${where}: settled`);
          await sleep(250);
          await press(page, state.open);
          try { await waitFor(page, `document.querySelector(${JSON.stringify(state.ready)})`, `${where}: ready`, 60); break; } catch (error) { if (attempt === 2) throw error; }
        }
      }
      await waitFor(page, `document.querySelector(${JSON.stringify(state.ready)})`, `${where}: ready`);
      await waitFor(page, settled, `${where}: settled`);
      await sleep(150);
      if (!state.open) await page.evaluate('window.scrollTo(0, 0)');
      const axe = scale === 1;
      if (axe) await page.evaluate(axeSource);
      const issues = await page.evaluate(audit({ locale, width, scale, axe }));
      const errors = page.errors.filter((error) => !ignorable(error));
      assert.deepEqual([...issues, ...errors.map((e) => `js:${e.slice(0, 160)}`)], [], where);
      if (scale === 1 && (width === 375 || width === 1280)) {
        // An open dialog locks the page's scroll: capture the viewport as the person sees it (a document clip comes out blank).
        const shot = state.open ? await page.send('Page.captureScreenshot', { format: 'png' })
          : await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
            clip: await page.evaluate('({ x: 0, y: 0, width: innerWidth, height: Math.min(document.documentElement.scrollHeight, 5000), scale: 1 })') });
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

  // 2. Journeys: a phone in English and light, a desktop in Portuguese and dark (FAMILY_SKIP_JOURNEYS=1 runs the matrix alone).
  const journeysOn = process.env.FAMILY_SKIP_JOURNEYS !== '1';
  for (const [locale, theme, width] of journeysOn ? [['en-US', 'light', 375], ['pt-BR', 'dark', 1280]] : []) {
    const c = copy[locale];
    const where = `journey ${locale} ${theme} ${width}px`;
    try {
      page.errors.length = 0; writes.length = 0;
      // The Tutor's Tasks: add a reward, pause one, open a photo in a dialog and give focus back on Escape.
      await load(page, { path: '/tasks', scenario: 'money-tutor', locale, theme, width, reduced: false });
      await waitFor(page, "document.querySelector('[data-family-part=\"rewards\"] li')", `${where}: rewards`);
      await pressText(page, '[data-family-part="rewards"]', c.familyTasks.addReward);
      await waitFor(page, "document.querySelector('[data-family-part=\"add-reward\"] input')", `${where}: reward form`);
      await page.evaluate("document.querySelector('[data-family-part=\"add-reward\"] input').focus()");
      await page.send('Input.insertText', { text: 'Movie night' });
      await page.evaluate("document.querySelectorAll('[data-family-part=\"add-reward\"] input')[1].focus()");
      await page.send('Input.insertText', { text: '25' });
      await pressText(page, '[data-family-part="add-reward"]', c.familyTasks.create);
      await waitFor(page, `document.querySelector('[data-family-part="rewards"]').textContent.includes(${JSON.stringify(c.familyTasks.added)})`, `${where}: reward added`);
      assert.deepEqual(writes.filter((w) => w.path === '/tasks/catalog').map((w) => w.body), [{ title: 'Movie night', cost: 25 }]);
      const first = await page.evaluate("document.querySelectorAll('[data-family-part=\"rewards\"] li[data-offered=\"true\"]')[1]?.getAttribute('data-reward-id')");
      await press(page, `[data-reward-id="${first}"] button`);
      await waitFor(page, `document.querySelector('[data-reward-id="${first}"]')?.getAttribute('data-offered') === 'false'`, `${where}: reward paused`);
      assert.deepEqual(writes.filter((w) => w.method === 'PATCH').map((w) => w.body), [{ active: false }]);
      await press(page, '[data-chores="waiting"] [data-task-id] button[aria-haspopup="dialog"]');
      await waitFor(page, "document.querySelector('[data-overlay=\"dialog\"]')?.contains(document.activeElement)", `${where}: focus in the photo dialog`);
      await key(page, 'Escape', 'Escape', 27);
      await waitFor(page, "!document.querySelector('[data-overlay=\"dialog\"]') && document.activeElement?.getAttribute('aria-haspopup') === 'dialog'", `${where}: focus returned`);

      // The Tutor's coins: another child by keyboard (address, scroll kept), then an allowance with the exact body.
      await load(page, { path: `/banking?child=${KID_A}`, scenario: 'money-tutor', locale, theme, width, reduced: false });
      await waitFor(page, "document.querySelector('[data-console-part=\"picker\"] button') && document.querySelector('[data-family-part=\"allowance\"]')", `${where}: coins`);
      await page.evaluate("[...document.querySelectorAll('[data-console-part=\"picker\"] button')][1].focus({ preventScroll: true })");
      const before = await page.evaluate('scrollY');
      await key(page, 'Enter', 'Enter', 13);
      await waitFor(page, `location.search.includes(${JSON.stringify(`child=${KID_B}`)}) && document.querySelector('[data-family-part="allowance"]')`, `${where}: picked child`);
      assert.ok(Math.abs(await page.evaluate('scrollY') - before) < 2, 'an in-place change keeps the scroll');
      // The other child's card loads in place of the first (keyed by child): wait for it, never the outgoing child's form.
      await waitFor(page, settled, `${where}: the picked child's card`);
      await waitFor(page, `document.querySelector('[data-family-part="allowance"][data-child-id="${KID_B}"] input[type=number]')`, `${where}: the picked child's allowance`);
      await page.evaluate(`(() => { const i = document.querySelector('[data-family-part="allowance"][data-child-id="${KID_B}"] input[type=number]'); i.focus(); i.select(); })()`);
      await page.send('Input.insertText', { text: '15' });
      await pressText(page, '[data-family-part="allowance"]', c.familyCoins.save);
      await waitFor(page, `document.querySelector('[data-family-part="allowance"]').textContent.includes(${JSON.stringify(c.familyCoins.saved)})`, `${where}: allowance saved`);
      assert.deepEqual(writes.filter((w) => w.path === `/banking/allowance/${KID_B}`).map((w) => w.body), [{ amount: 15, frequency: 'weekly', anchorDay: 5, active: true }]);

      // A child: "See wallet" lands on the coins route with focus on its heading; then the card's name and colour.
      await load(page, { path: '/tasks', scenario: 'money-child', locale, theme, width, reduced: false });
      await waitFor(page, "document.querySelector('[data-family-part=\"pockets\"] a')", `${where}: pockets`);
      await press(page, '[data-family-part="pockets"] a');
      await waitFor(page, "location.pathname === '/banking' && document.querySelector('[data-screen=\"child-coins\"] h1')", `${where}: wallet route`);
      await waitFor(page, "document.activeElement?.tagName === 'H1' || document.activeElement?.tagName === 'MAIN'", `${where}: route focus`);
      assert.equal(await page.evaluate('scrollY'), 0, 'a route change scrolls to the top');
      await waitFor(page, "document.querySelector('[data-family-part=\"card-look\"] button')", `${where}: card`);
      await press(page, '[data-family-part="card-look"] button');
      await waitFor(page, "document.querySelector('[data-overlay=\"dialog\"] input')", `${where}: card dialog`);
      await page.evaluate("(() => { const i = document.querySelector('[data-overlay=\"dialog\"] input'); i.focus(); i.select(); })()");
      await page.send('Input.insertText', { text: 'Star jar' });
      await pressText(page, '[data-overlay="dialog"] [data-family-part="card-colour"]', c.coinCard.violet);
      await pressText(page, '[data-overlay="dialog"]', c.childCoins.save);
      await waitFor(page, `!document.querySelector('[data-overlay="dialog"]') && document.querySelector('[data-family-part="card-look"]').textContent.includes(${JSON.stringify(c.childCoins.saved)})`, `${where}: card saved`);
      assert.deepEqual(writes.filter((w) => w.path === '/banking/account').map((w) => w.body), [{ nickname: 'Star jar', cardDesign: 'violet' }]);
      assert.deepEqual(page.errors.filter((error) => !ignorable(error)), [], 'JS errors');
      journeys.push({ journey: where, result: 'passed', writes: writes.map((w) => `${w.method} ${w.path}`) });
      process.stdout.write('J');
    } catch (error) {
      failures.push(`${where}: ${error.message.slice(0, 1500)}`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) writeFileSync(join(out, `FAIL-journey-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      process.stdout.write('F');
    }
  }

  // 2b. Offline: the teen's wallet says "offline" with the browser offline, and loads back online.
  for (const [locale, theme, width] of journeysOn ? [['es-MX', 'dark', 375]] : []) {
    const c = copy[locale];
    const where = `offline ${locale} ${theme} ${width}px`;
    try {
      page.errors.length = 0;
      await load(page, { path: '/wallet', scenario: 'money-teen-offline', locale, theme, width });
      await waitFor(page, "document.querySelector('[data-teen-wallet=\"root\"] .lf-state--error')", `${where}: failure`);
      await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await pressText(page, '[data-teen-wallet="root"] .lf-state--error', c.teenWalletScreen.retry);
      await waitFor(page, `document.querySelector('[data-teen-wallet="root"] .lf-state--error')?.textContent.includes(${JSON.stringify(c.teenWalletScreen.offlineBody)})`, `${where}: offline copy`);
      await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      page.core = { ...page.core, scenario: 'money-teen' };
      await pressText(page, '[data-teen-wallet="root"] .lf-state--error', c.teenWalletScreen.retry);
      await waitFor(page, "document.querySelector('[data-teen-wallet=\"root\"] [data-pocket=\"save\"]')", `${where}: back online`);
      journeys.push({ journey: where, result: 'passed' });
      process.stdout.write('O');
    } catch (error) {
      await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
      failures.push(`${where}: ${error.message.slice(0, 600)}`);
      process.stdout.write('F');
    }
  }

  // 3. Populations: the family money routes and the teen wallet open only for whom Core would admit.
  const refusals = [
    ...['family-teen', 'family-adult', 'family-staff', 'family-guest'].flatMap((scenario) => ['/tasks', '/banking'].map((path) => ({ scenario, path }))),
    ...['family-kid', 'family-adult', 'family-two', 'family-staff'].map((scenario) => ({ scenario, path: '/wallet' })),
  ];
  for (const { scenario, path } of journeysOn ? refusals : []) {
    const where = `population ${scenario} ${path}`;
    try {
      page.errors.length = 0;
      await load(page, { path, scenario, locale: 'en-US', theme: 'light', width: 375, population: true });
      await waitFor(page, `location.pathname !== ${JSON.stringify(path)}`, `${where}: sent away`, 200);
      await sleep(300);
      assert.equal(await page.evaluate(`!!document.querySelector(${JSON.stringify(ROOT)})`), false, 'no money screen');
      journeys.push({ journey: where, result: 'refused', landed: await page.evaluate('location.pathname') });
      process.stdout.write('P');
    } catch (error) {
      const at = await page.evaluate("location.pathname + ' | ' + document.body.innerText.slice(0, 120).replace(/\s+/g, ' ')").catch(() => '?');
      failures.push(`${where}: ${error.message.slice(0, 600)} (at ${at})`);
      process.stdout.write('F');
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
