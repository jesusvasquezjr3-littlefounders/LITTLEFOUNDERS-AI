import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript } from './audits/synthetic-core.mjs';

/*
 * W2P.1 (profile lane): the rebuilt own profile (P1), look editor (P2) and
 * Settings (P3) on their REAL routes, in real Chrome, for every population
 * each screen serves, signed in with a synthetic session and answered by the
 * synthetic Core (scripts/audits/synthetic-core.mjs and the lane's
 * scripts/audits/lanes/profile.mjs; nothing leaves the machine).
 *
 *   REBUILD_URL=http://localhost:5450 npm run verify:profile-screens
 *
 * For each case x 3 locales x 2 modes x 320/375/768/1280 px, at normal text
 * size and again with the root font at 140%, it checks:
 *
 *   - the rebuilt screen is mounted inside the shell, in the right mode and
 *     language, with exactly one <h1> and one <main>;
 *   - no horizontal overflow, no text box that clips its text, and every
 *     control of the screen at least 48 x 48 px;
 *   - the population's rules: E.9 (no digit in the connections card, which is
 *     not inside the progress card), the invite link only for an adult or a
 *     teen, the Tutor pill only for the verified parent, E.13 and E.8 for the
 *     teen, A.6 for the child (no email change, the username as data, no
 *     Mentor-profile reset, deletion refused), the upgrade card and no
 *     sign-in rows for a guest, H.1/OD-18 panels for the independent teen;
 *   - the keyboard path: from the skip link, Tab reaches the screen's first
 *     control and the focused control shows a visible focus ring;
 *   - no axe-core violation inside the screen (normal text only);
 *
 * and once per locale and mode at 375 px, a real press on the profile's
 * "Settings" link moves to /profile/settings and focuses its <h1>.
 *
 * Reports and screenshots: audit-results/profile-screens/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5450';
const out = resolve('../audit-results/profile-screens');
mkdirSync(out, { recursive: true });
const LOCALES = (process.env.PROFILE_LOCALES ?? 'en-US,es-MX,pt-BR').split(',');
const THEMES = (process.env.PROFILE_THEMES ?? 'light,dark').split(',');
const WIDTHS = (process.env.PROFILE_WIDTHS ?? '320,375,768,1280').split(',').map(Number);

const CASES = [
  { id: 'p1-adult', path: '/profile', scenario: 'profile-adult', screen: 'own-profile', ready: '.lf-profile-badge', expect: { invite: true, people: true, tutorPill: false } },
  { id: 'p1-tutor', path: '/profile', scenario: 'profile-tutor', screen: 'own-profile', ready: '.lf-pill', expect: { invite: true, people: true, tutorPill: true } },
  { id: 'p1-teen', path: '/profile', scenario: 'profile-teen', screen: 'own-profile', ready: '[data-social-audit="teen-connections"] .lf-social-tier-list li',
    expect: { invite: true, people: true, tutorPill: false, safety: true, teenPanel: true } },
  { id: 'p1-kid', path: '/profile', scenario: 'profile-kid', screen: 'own-profile', ready: '.lf-profile-stats', expect: { invite: false, people: true, tutorPill: false, young: true, managed: true } },
  { id: 'p1-guest', path: '/profile', scenario: 'profile-guest', screen: 'own-profile', ready: '.lf-profile-stats', expect: { invite: false, people: false, tutorPill: false } },
  { id: 'p2-adult', path: '/profile/avatar', scenario: 'profile-adult', screen: 'look-editor', ready: '.lf-look-part[data-part="cover"] .lf-picture-input:checked', expect: {} },
  { id: 'p2-kid', path: '/profile/avatar', scenario: 'profile-kid', screen: 'look-editor', ready: '.lf-look-part[data-part="cover"] .lf-picture-input:checked', expect: { young: true } },
  { id: 'p3-adult', path: '/profile/settings', scenario: 'profile-adult', screen: 'settings', ready: '.lf-settings-blocked li', readyAlso: ['.lf-disposition dl', '.lf-account-deletion'],
    expect: { changeEmail: true, reset: true, deletion: 'allowed' } },
  { id: 'p3-tutor', path: '/profile/settings', scenario: 'profile-tutor', screen: 'settings', ready: '.lf-settings-form', readyAlso: ['.lf-disposition dl', '.lf-account-deletion'],
    expect: { changeEmail: true, reset: true, deletion: 'allowed' } },
  { id: 'p3-teen', path: '/profile/settings', scenario: 'settings-teen', screen: 'settings', ready: '.lf-memory-self-review .lf-memory-note',
    readyAlso: ['.lf-analytics-choice [role="switch"]', '.lf-disposition dl', '.lf-account-deletion'], expect: { changeEmail: true, reset: true, deletion: 'allowed', teenPanels: true } },
  { id: 'p3-kid', path: '/profile/settings', scenario: 'profile-kid', screen: 'settings', ready: '[data-field="username"]', readyAlso: ['.lf-disposition dl', '.lf-account-deletion'],
    expect: { changeEmail: false, kidRows: true, reset: false, deletion: 'refused', young: true } },
  { id: 'p3-guest', path: '/profile/settings', scenario: 'profile-guest', screen: 'settings', ready: '.lf-card--primary', readyAlso: ['.lf-account-deletion'],
    expect: { guest: true, deletion: 'allowed' } },
];

const filter = process.env.PROFILE_CASES?.split(',');
const cases = CASES.filter((entry) => !filter || filter.includes(entry.id));
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const evidence = [];
const failures = [];
const unknownRequests = new Set();

async function waitFor(page, expression, what, tries = 900) {
  for (let n = 0; n < tries; n++) {
    try { if (await page.evaluate(`!!(${expression})`)) return; } catch (error) { if (!/context|navigat/i.test(String(error))) throw error; }
    await sleep(50);
  }
  throw new Error(`Timed out: ${what}`);
}

async function key(page, name, code, keyCode, modifiers = 0) {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
}

/** A real pointer press on the visible element matching `selector` (checked for occlusion first). */
async function press(page, selector) {
  const point = await page.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (!e) return { missing: true };
    e.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, top = document.elementFromPoint(x, y);
    return { missing: false, occluded: !(e.contains(top) || top?.contains(e)), x, y };
  })()`);
  if (point.missing) throw new Error(`Missing: ${selector}`);
  if (point.occluded) throw new Error(`Occluded: ${selector}`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

/** Everything measured on the loaded screen, in one evaluation. */
const MEASURE = (screen) => `(() => {
  const root = document.querySelector('[data-screen=${JSON.stringify(screen)}]');
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
  const controls = [...root.querySelectorAll('a[href], button, input, select, textarea, [role=switch]')].filter((el) => {
    const target = el.matches('input[type=radio], input[type=checkbox]') ? (el.closest('label') ?? el) : el;
    return visible(target);
  }).map((el) => {
    const target = el.matches('input[type=radio], input[type=checkbox]') ? (el.closest('label') ?? el) : el;
    const r = target.getBoundingClientRect();
    return { w: r.width, h: r.height, what: (target.getAttribute('aria-label') ?? target.textContent ?? '').trim().slice(0, 40) };
  });
  const clipped = [...root.querySelectorAll('*')].filter((el) => {
    if (el.closest('svg') || !visible(el)) return false;
    const s = getComputedStyle(el); const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!text) return false;
    if (s.textOverflow === 'ellipsis') return true;
    const hides = (v) => v === 'hidden' || v === 'clip';
    return (hides(s.overflowX) && el.scrollWidth > el.clientWidth + 1) || (hides(s.overflowY) && el.scrollHeight > el.clientHeight + 1);
  }).map((el) => el.className + ' ' + el.textContent.trim().slice(0, 30));
  const outside = [...root.querySelectorAll('*')].filter((el) => {
    if (el.closest('svg') || !visible(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
    if (el.closest('input, select, textarea')) return false;
    const r = el.getBoundingClientRect(); return r.left < -0.5 || r.right > innerWidth + 0.5;
  }).map((el) => el.textContent.trim().slice(0, 30));
  const people = [...root.querySelectorAll('.lf-card')].find((card) => card.querySelector('a[href="/profile/followers"]'));
  const progress = root.querySelector('.lf-profile-stats')?.closest('.lf-card') ?? null;
  return {
    theme: root.getAttribute('data-theme'), lang: root.getAttribute('lang'), ageBand: root.getAttribute('data-age-band'),
    h1: document.querySelectorAll('main h1').length, mains: document.querySelectorAll('main').length,
    overflow: document.documentElement.scrollWidth - innerWidth,
    small: controls.filter((c) => c.w < 47.5 || c.h < 47.5).map((c) => c.what + ' ' + Math.round(c.w) + 'x' + Math.round(c.h)),
    clipped, outside,
    people: people ? { digits: /\\d/.test(people.textContent), insideProgress: !!progress && progress.contains(people) } : null,
    invite: !!root.querySelector('.lf-profile-link'), copyLink: [...root.querySelectorAll('button')].some((b) => b.classList.contains('lf-button--berry')),
    tutorPill: !!root.querySelector('.lf-profile-names .lf-pill'),
    safety: !!root.querySelector('[data-social-audit="profile-safety"]'), teenPanel: !!root.querySelector('[data-social-audit="teen-connections"]'),
    changeEmail: !!root.querySelector('.lf-settings-row .lf-button') && [...root.querySelectorAll('.lf-settings-row')].some((row) => /@/.test(row.textContent) && row.querySelector('button')),
    usernameField: !!root.querySelector('input[autocomplete="username"]'), usernameRow: !!root.querySelector('[data-field="username"]'),
    reset: !!root.querySelector('.lf-disposition .lf-alliance-status button'),
    deletionStart: !!root.querySelector('.lf-account-deletion button'),
    guestCard: !!root.querySelector('.lf-card--primary a[href="/upgrade-account"]'), signInCard: root.querySelectorAll('.lf-settings-row').length > 0 && !!root.querySelector('input[type=password], .lf-settings-row button'),
    analytics: !!root.querySelector('.lf-analytics-choice [role="switch"]'), memory: !!root.querySelector('.lf-memory-self-review .lf-memory-note'),
    radios: root.querySelectorAll('.lf-picture-input').length, unnamedRadios: [...root.querySelectorAll('.lf-picture-input')].filter((r) => !(r.getAttribute('aria-label') || r.closest('label')?.textContent.trim())).length,
  };
})()`;

try {
  const warm = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await warm.send('Page.close').catch(() => {});
  const page = await openPage(browser.browser, { width: 375, height: 800, dark: false, newWindow: true, isolated: true });
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests });
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');

  for (const entry of cases) for (const locale of LOCALES) for (const theme of THEMES) for (const width of WIDTHS) {
    const where = `${entry.id} ${locale} ${theme} ${width}px`;
    page.errors.length = 0;
    try {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      if (await page.evaluate('location.origin').catch(() => '') !== origin) {
        await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
        await waitFor(page, `location.origin === ${JSON.stringify(origin)}`, 'origin');
      }
      const spec = SCENARIOS[entry.scenario];
      page.core = { scenario: entry.scenario, locale, theme, fixtures: {} };
      await page.evaluate(sessionStorageScript({ guest: spec.guest, locale, theme }));
      const url = new URL(entry.path, origin); url.searchParams.set('lng', locale);
      await page.send('Page.navigate', { url: url.toString() });
      const root = `[data-screen=${JSON.stringify(entry.screen)}]`;
      await waitFor(page, [`document.querySelector('[data-shell] ${root}')`, `document.documentElement.lang === ${JSON.stringify(locale)}`,
        ...[entry.ready, ...(entry.readyAlso ?? [])].map((selector) => `document.querySelector(${JSON.stringify(selector)})`)].join(' && '), `${where}: screen ready`);
      await page.evaluate('document.fonts.ready');
      await waitFor(page, "!document.documentElement.classList.contains('theme-transitioning')", `${where}: theme settled`);
      await sleep(120);

      const results = {};
      for (const scale of ['100%', '140%']) {
        await page.evaluate(`document.documentElement.style.fontSize = ${JSON.stringify(scale === '100%' ? '' : scale)}`);
        await sleep(80);
        const m = await page.evaluate(MEASURE(entry.screen));
        const at = `${where} @${scale}`;
        assert.equal(m.theme, theme, `${at}: screen mode`);
        assert.equal(m.lang, locale, `${at}: screen language`);
        assert.equal(m.mains, 1, `${at}: one <main>`);
        assert.equal(m.h1, 1, `${at}: one <h1>`);
        assert.ok(m.overflow <= 1, `${at}: horizontal overflow ${m.overflow}px`);
        assert.deepEqual(m.small, [], `${at}: targets under 48 px`);
        assert.deepEqual(m.clipped, [], `${at}: clipped text`);
        assert.deepEqual(m.outside, [], `${at}: text outside the viewport`);
        results[scale] = m;
      }
      const m = results['100%'];
      const e = entry.expect;
      if (e.young) assert.equal(m.ageBand, '6-9', 'a child\'s screen carries the youngest copy budget');
      if (entry.screen === 'own-profile') {
        assert.equal(m.invite && m.copyLink, e.invite, 'invite link only for an adult or a teen');
        assert.equal(m.people !== null, e.people, 'connections card');
        if (m.people) { assert.equal(m.people.digits, false, 'E.9: no number in the connections card'); assert.equal(m.people.insideProgress, false, 'E.9: not in the progress block'); }
        assert.equal(m.tutorPill, e.tutorPill, 'Tutor pill only for the verified parent');
        assert.equal(m.safety, !!e.safety, 'E.13 notice');
        assert.equal(m.teenPanel, !!e.teenPanel, 'E.8 teen connections');
      }
      if (entry.screen === 'look-editor') {
        assert.equal(m.radios, 16 + 6 + 8 + 8 + 6 + 6 + 6 + 9 + 10 + 7 + 10, 'every option of every part, and the cover presets');
        assert.equal(m.unnamedRadios, 0, 'every option has a name');
      }
      if (entry.screen === 'settings') {
        if (e.guest) { assert.ok(m.guestCard, 'guest upgrade card'); assert.equal(m.signInCard, false, 'no sign-in rows for a guest'); }
        else assert.equal(m.changeEmail, e.changeEmail, 'A.6: email change only for an account with its own email');
        if (e.kidRows) { assert.ok(m.usernameRow && !m.usernameField, 'A.6: a child\'s username is data, not a field'); }
        if ('reset' in e) assert.equal(m.reset, e.reset, 'C.7 reset only where Core allows it');
        assert.equal(m.deletionStart, e.deletion === 'allowed', 'E.6 deletion offered by population');
        if (e.teenPanels) { assert.ok(m.analytics, 'H.1 analytics choice'); assert.ok(m.memory, 'OD-18 memory self-review'); }
      }

      // Keyboard: the skip link first, then Tab lands inside the screen on a control with a visible focus ring.
      await page.evaluate('window.scrollTo(0, 0); document.activeElement?.blur()');
      await key(page, 'Tab', 'Tab', 9);
      assert.equal(await page.evaluate("document.activeElement?.classList.contains('lf-skip-link')"), true, 'first Tab reaches the skip link');
      await key(page, 'Enter', 'Enter', 13);
      await waitFor(page, "document.activeElement?.tagName === 'MAIN'", `${where}: skip link focuses <main>`, 60);
      await key(page, 'Tab', 'Tab', 9);
      const focus = await page.evaluate(`(() => { const a = document.activeElement; const target = a?.matches('input[type=radio]') ? a.closest('label') : a;
        const s = target ? getComputedStyle(target) : null;
        return { inScreen: !!a?.closest(${JSON.stringify(root)}), ring: !!s && ((s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || /0px 0px 0px [2-9]/.test(s.boxShadow)) }; })()`);
      assert.ok(focus.inScreen, 'Tab from <main> reaches the screen');
      assert.ok(focus.ring, 'the focused control shows a focus ring');

      await page.evaluate(axeSource);
      const axe = await page.evaluate(`axe.run({ include: [[${JSON.stringify(root)}]] }, { resultTypes: ['violations'] })`);
      assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.any?.[0]?.message ?? ''})`).join(', ')}`), [], 'axe violations');

      if (width === 375 || width === 1280) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(out, `${entry.id}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }

      // Route change by a real press: the profile's Settings link, once per locale and mode.
      let routeFocus = null;
      if (entry.id === 'p1-adult' && width === 375) {
        await press(page, `${root} .lf-profile-actions a[href="/profile/settings"]`);
        await waitFor(page, "location.pathname === '/profile/settings' && document.querySelector('[data-screen=\"settings\"] h1')", `${where}: navigates to Settings`);
        await waitFor(page, "document.activeElement?.tagName === 'H1' && document.activeElement.closest('[data-screen=\"settings\"]')", `${where}: focus on the Settings heading`);
        routeFocus = 'h1';
      }
      assert.deepEqual(page.errors.filter((error) => !/Failed to load resource|net::ERR|synthetic core/i.test(error)), [], 'JS errors');
      evidence.push({ case: entry.id, population: spec.population, locale, theme, width, textScales: ['100%', '140%'], axe: 0, routeFocus, keyboard: 'skip link, main, first control with a ring' });
      process.stdout.write('.');
    } catch (error) {
      failures.push(`${where}: ${error.message}${page.errors.length ? ` [page errors: ${page.errors.slice(0, 3).join(' | ').slice(0, 600)}]` : ''}`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) writeFileSync(join(out, `FAIL-${entry.id}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      process.stdout.write('F');
    }
  }
  await page.send('Page.close').catch(() => {});
} catch (error) {
  failures.push(`setup: ${error.message}`);
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({
    provenance: 'Real routes on a local Vite server in headless Chrome, real pointer and keyboard input; synthetic Core; not full-stack',
    origin, date: new Date().toISOString(), configurations: (evidence.length + failures.length) * 2, pageLoads: evidence.length + failures.length,
    passed: evidence.length, failures, evidence, unansweredCoreRequests: [...unknownRequests].sort(),
  }, null, 1));
  browser.child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
console.log(`\n${evidence.length}/${evidence.length + failures.length} page loads passed (x2 text sizes = ${evidence.length * 2} configurations)`);
if (failures.length) { console.log(failures.slice(0, 30).join('\n')); process.exitCode = 1; }
if (unknownRequests.size) console.log(`Synthetic Core answered with an empty envelope: ${[...unknownRequests].sort().join('; ')}`);
