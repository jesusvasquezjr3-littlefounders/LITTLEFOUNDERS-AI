import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript } from './audits/synthetic-core.mjs';

/*
 * W2L.1: the rebuilt learner home (L1), the one course screen (L2) and the
 * journal and rhythm, on their REAL routes inside the learner shell, in real
 * Chrome.
 *
 *   REBUILD_URL=http://localhost:5420 npm run verify:learn-pages
 *
 * Signed in with a synthetic session and answered by the synthetic Core
 * (scripts/audits/synthetic-core.mjs and the learn lane's answers in
 * scripts/audits/lanes/learn.mjs; nothing leaves the machine), for every
 * population the pages serve: a parent-created child on the linear course
 * engine, an independent teen and an adult on the pathway engine (B.6), a
 * young child with a course the age safeguard closes (OD-16), the B.3
 * unavailable course, the B.2 prerequisite and the empty and failed shelves.
 * For each case in 3 locales x 2 modes x 320/375/768/1280 px it checks, at
 * 100% and at 140% text:
 *
 *   - one <main> (the shell's) and one <h1> (the page's), the page in the
 *     shell's language and mode, no horizontal overflow, no clipped or
 *     overflowing text, a copy role on every text, 48 px targets, the
 *     controlled glossary (no Tutor/bot/lives/freeze wording, no em dash);
 *   - the population's behaviour (the case's own `expect`);
 *   - at 100%: the first Tab reaches the skip link and Enter moves focus to
 *     <main>; a real press on the case's link changes the route, scrolls to
 *     the top and moves focus to the new page's heading; 0 axe violations on
 *     the page.
 *
 * Reports and screenshots: audit-results/learn-pages/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5420';
const out = resolve(process.env.REPORT_DIR ?? '../audit-results/learn-pages');
mkdirSync(out, { recursive: true });
const LOCALES = (process.env.LEARN_LOCALES ?? 'en-US,es-MX,pt-BR').split(',');
const THEMES = (process.env.LEARN_THEMES ?? 'light,dark').split(',');
const WIDTHS = (process.env.LEARN_WIDTHS ?? '320,375,768,1280').split(',').map(Number);
const MENTOR_NAMES = { rho: 'Dr. Rho', zara: 'Zara', liruf: 'Liruf', dina: 'Dina' };
/* The first paint of a route waits for the dev server to compile it: on a machine shared with other lanes' Chrome matrices that took over 15 s. */
const READY_TRIES = Number(process.env.LEARN_READY_TRIES ?? 1200);

/*
 * `ready` proves the page reached the state; `expect` is evaluated in the page
 * and must return an empty list of problems; `press` is the link a person
 * follows next and `to` where it must land.
 */
const CASES = [
  { id: 'home-child', path: '/learn', scenario: 'learn-home-child', band: '6-9',
    ready: '[data-screen="learn-home"][data-state="ready"] .lf-learn-hero[data-step="lesson"]',
    expect: `[
      document.querySelector('.lf-learn-hero a.lf-button--accent')?.getAttribute('href') === '/learn/lesson/l-needs-1' || 'hero opens the next lesson',
      document.querySelectorAll('.lf-learn-courses > li').length === 4 || 'four courses',
      !!document.querySelector('[data-course="financial-education"] .lf-card--mint [data-asset-id="course.money-basics.icon"]') || 'course identity: hue and icon',
      document.querySelectorAll('.lf-button--accent').length === 1 || 'one accent call to action',
      !!document.querySelector('.lf-learn-streak') || 'streak card',
      !document.querySelector('[data-nav-id="wallet"]') && !!document.querySelector('[data-nav-id="tasks"]') || 'a child in a family: Tasks, no personal wallet',
    ]`, press: '[data-course="financial-education"] a', to: '/learn/financial-education' },
  { id: 'home-teen', path: '/learn', scenario: 'learn-home-teen', band: '13-17',
    ready: '[data-screen="learn-home"][data-state="ready"] .lf-bridge-self',
    expect: `[
      document.querySelector('.lf-learn-hero a.lf-button--accent')?.getAttribute('href') === '/learn/lesson/l-1' || 'hero opens the B.6 recommendation',
      !!document.querySelector('.lf-bridge-self') || 'the teen self prompt (B.13)',
      !!document.querySelector('[data-nav-id="wallet"]') && !document.querySelector('[data-nav-id="tasks"]') || 'OD-3 Option B: personal wallet, no Tasks',
    ]`, press: '.lf-learn-story a', to: '/learn/journal' },
  { id: 'home-young', path: '/learn', scenario: 'learn-home-young', band: '6-9',
    ready: '[data-screen="learn-home"] [data-closed="true"]',
    expect: `[
      !document.querySelector('[data-course="investing"] a') || 'a course closed by age is never offered',
      !document.querySelector('[data-course="investing"] .lf-card--sky') || 'a closed course has no identity hue',
    ]`, press: '.lf-learn-streak a', to: '/learn/rhythm' },
  { id: 'home-unavailable', path: '/learn', scenario: 'learn-home-unavailable', band: '10-12',
    ready: '[data-screen="learn-home"] .lf-banner',
    expect: `[ /Lo básico|Money basics|O básico/.test(document.querySelector('.lf-banner')?.textContent ?? '') || 'B.3 names the course' ]` },
  { id: 'home-empty', path: '/learn', scenario: 'learn-home-empty', band: 'adult', ready: '[data-screen="learn-home"] .lf-state--empty', expect: '[]' },
  { id: 'home-error', path: '/learn', scenario: 'learn-home-error', band: 'adult', ready: '[data-screen="learn-home"] .lf-state--error',
    expect: `[ !!document.querySelector('.lf-state--error button') || 'retry offered' ]` },
  { id: 'course-linear', path: '/learn/financial-education', scenario: 'learn-home-child', band: '6-9',
    ready: '[data-screen="course-path"][data-engine="linear"] .lf-course-path-chapter-toggle',
    expect: `(() => {
      const toggle = document.querySelector('.lf-course-path-chapter-toggle button');
      const closed = toggle?.getAttribute('aria-expanded') === 'false' && !document.querySelector('.lf-course-path-lessons');
      toggle?.click();
      return [
        document.querySelector('.lf-course-path-hero a.lf-button--accent')?.getAttribute('href') === '/learn/lesson/l-needs-1' || 'hero opens the next lesson',
        closed || 'chapters start closed',
        document.querySelectorAll('.lf-course-path-lessons .lf-list-row--pressable').length === 3 || 'passed and current lessons open, the locked one does not',
        document.querySelectorAll('.lf-course-path-chapter-toggle button').length === 1 || 'a locked chapter cannot be opened',
      ];
    })()`, press: '.lf-course-path-top a', to: '/learn' },
  { id: 'course-pathway', path: '/learn/financial-education', scenario: 'learn-course-adult', band: 'adult',
    ready: '[data-screen="course-path"][data-engine="pathway"]',
    expect: `[
      document.querySelector('.lf-course-path-hero a.lf-button--accent')?.getAttribute('href') === '/learn/lesson/l-1' || 'recommended lesson',
      document.querySelectorAll('.lf-course-path-items .lf-list-row--pressable').length >= 3 || 'the other open lessons are real choices (B.24)',
      document.querySelectorAll('.lf-course-path-chapter--optional').length === 2 || 'younger chapters are extras for an adult',
    ]` },
  { id: 'course-placement', path: '/learn/entrepreneurship', scenario: 'learn-home-teen', band: '13-17',
    ready: '[data-screen="course-path"] [data-step="placement"]',
    expect: `[
      document.querySelector('[data-step="placement"] a')?.getAttribute('href') === '/learn/entrepreneurship/placement' || 'placement offered first',
      !document.querySelector('.lf-course-path-items') || 'no lesson before the placement',
    ]` },
  { id: 'course-prerequisite', path: '/learn/investing', scenario: 'learn-home-child', band: '6-9',
    ready: '[data-screen="course-path-prerequisite"] .lf-list-row',
    expect: `[ /Start a business|Emprende|Abra um/.test(document.querySelector('.lf-course-path-missing')?.textContent ?? '') || 'the missing course by its title (B.2)' ]`,
    press: '.lf-course-path-missing button', to: '/learn/entrepreneurship' },
  { id: 'course-age', path: '/learn/investing', scenario: 'learn-home-young', band: '6-9', ready: '[data-screen="course-path-age-restricted"]', expect: '[]' },
  { id: 'path-redirect', path: '/learn/financial-education/path', scenario: 'learn-home-child', band: '6-9',
    ready: '[data-screen="course-path"][data-engine="linear"]', expect: `[ location.pathname === '/learn/financial-education' || 'the old /path address redirects' ]`, redirected: true },
  { id: 'journal', path: '/learn/journal', scenario: 'learn-home-teen', band: null, ready: '[data-screen="journal"] .lf-journal-entry, [data-screen="journal"] article', expect: '[]' },
  { id: 'rhythm', path: '/learn/rhythm', scenario: 'learn-home-child', band: null, ready: '[data-screen="rhythm"] .lf-rhythm-streak', expect: '[]' },
];

const filter = process.env.LEARN_CASES?.split(',');
const cases = CASES.filter((entry) => !filter || filter.includes(entry.id));
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const evidence = [];
const failures = [];
const unknownRequests = new Set();

async function waitFor(page, expression, what, tries = 300) {
  for (let n = 0; n < tries; n++) {
    try { if (await page.evaluate(`!!(${expression})`)) return; } catch (error) { if (!/context|navigat/i.test(String(error))) throw error; }
    await sleep(50);
  }
  throw new Error(`Timed out: ${what}`);
}

/** A real pointer press on the visible element matching `selector` (checked for occlusion first). */
async function press(page, selector) {
  const point = await page.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; });
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

async function key(page, name, code, keyCode) {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode });
}

/** Every per-page problem at the current text size: structure, fit, targets, roles and wording. */
const INSPECT = `(() => {
  const problems = [];
  const page = document.querySelector('[data-shell] main .lf-learner-page');
  if (!page) return ['no rebuilt learner page in the shell'];
  if (document.querySelectorAll('main').length !== 1) problems.push('main count ' + document.querySelectorAll('main').length);
  if (page.querySelectorAll('h1').length !== 1) problems.push('h1 count ' + page.querySelectorAll('h1').length);
  const over = document.documentElement.scrollWidth - innerWidth;
  if (over > 1) problems.push('horizontal overflow ' + over + 'px');
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]'); };
  const label = (e) => (e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ').slice(0, 2).join('.') : '') + ' "' + e.textContent.trim().slice(0, 30) + '"');
  const canvas = document.createElement('canvas').getContext('2d');
  for (const e of page.querySelectorAll('*')) {
    if (!visible(e) || e.closest('svg') || e.closest('[aria-hidden="true"]')) continue;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(e);
    if (s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none')) problems.push('truncated ' + label(e));
    if (s.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) problems.push('clipped ' + label(e));
    const r = e.getBoundingClientRect();
    if (r.left < -0.5 || r.right > innerWidth + 0.5) problems.push('outside the frame ' + label(e));
    if (!e.closest('[data-copy-role]')) problems.push('no copy role ' + label(e));
    if (parseFloat(s.fontSize) < 13.9) problems.push('text under 14px ' + label(e));
    canvas.font = s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily;
    const width = e.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    for (const word of e.textContent.trim().split(/\\s+/)) if (width > 0 && canvas.measureText(word).width > width + 1 && s.overflowWrap === 'normal' && s.wordBreak === 'normal') problems.push('word wider than its box "' + word + '" in ' + label(e));
  }
  for (const t of page.querySelectorAll('a[href], button')) {
    if (!visible(t)) continue;
    const r = t.getBoundingClientRect();
    if (r.width < 47.5 || r.height < 47.5) problems.push('target under 48px ' + label(t) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  const text = page.innerText;
  if (/\\bTutor\\b|\\bbot\\b|\\blives?\\b|\\bvidas?\\b|freeze|congel|\\u2014/i.test(text)) problems.push('glossary or em dash');
  return problems;
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
      const spec = SCENARIOS[entry.scenario];
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      if (await page.evaluate('location.origin').catch(() => '') !== origin) {
        await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
        await waitFor(page, `location.origin === ${JSON.stringify(origin)}`, 'origin');
      }
      page.core = { scenario: entry.scenario, locale, theme, fixtures: {} };
      await page.evaluate(sessionStorageScript({ guest: spec.guest, locale, theme }));
      const url = new URL(entry.path, origin); url.searchParams.set('lng', locale);
      await page.send('Page.navigate', { url: url.toString() });
      await waitFor(page, `document.querySelector('[data-shell="learner"]') && document.querySelector(${JSON.stringify(entry.ready)}) && document.documentElement.lang === ${JSON.stringify(locale)}`, `${where}: ready`, READY_TRIES);
      // The Mentor tab shows the chosen character's real-model render; before a choice, the word alone (OD-6).
      await waitFor(page, spec.mentor
        ? `(() => { const l = document.querySelector('.lf-shell-rail [data-nav-id="mentor"]'); return l && l.querySelector('img')?.complete; })()`
        : `!!document.querySelector('.lf-shell-rail [data-nav-id="mentor"]')`, `${where}: Mentor tab`);
      await page.evaluate('document.fonts.ready');
      await waitFor(page, "!document.documentElement.classList.contains('theme-transitioning')", `${where}: theme settled`);
      await sleep(120);

      const base = await page.evaluate(`(() => { const p = document.querySelector('[data-shell] main .lf-learner-page');
        return { lang: p?.getAttribute('lang'), theme: p?.dataset.theme, band: p?.dataset.ageBand ?? null,
          mentor: document.querySelector('.lf-shell-rail [data-nav-id="mentor"]')?.textContent.trim() }; })()`);
      assert.equal(base.lang, locale, 'page language');
      assert.equal(base.theme, theme, 'page mode');
      if (entry.band) assert.equal(base.band, entry.band, 'Copy Budget band from Core\'s register');
      if (spec.mentor) assert.equal(base.mentor, MENTOR_NAMES[spec.mentor], 'the Mentor tab names the chosen character');
      else assert.ok(!Object.values(MENTOR_NAMES).includes(base.mentor), 'no character named before one is chosen');
      assert.deepEqual(await page.evaluate(entry.expect).then((list) => list.filter((item) => item !== true)), [], 'population behaviour');
      assert.deepEqual(await page.evaluate(INSPECT), [], 'page at 100% text');
      const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(out, `${entry.id}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));

      // 140% text (WCAG 1.4.4 at the root size): nothing clips, overflows or shrinks below a target.
      await page.evaluate("document.documentElement.style.fontSize = '140%'");
      await sleep(80);
      const large = await page.evaluate(INSPECT);
      await page.evaluate("document.documentElement.style.fontSize = ''");
      assert.deepEqual(large, [], 'page at 140% text');

      // Scoped axe: the rebuilt page.
      await page.evaluate(axeSource);
      const axe = await page.evaluate("axe.run({ include: [['[data-shell] main .lf-learner-page']] }, { resultTypes: ['violations'] })");
      assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.any?.[0]?.message ?? ''})`).join(', ')}`), [], 'axe violations');

      // A redirect is a route change: the shell has already moved focus to the page's heading (02 rule 13).
      if (entry.redirected) assert.equal(await page.evaluate("document.activeElement?.tagName === 'H1' && !!document.activeElement.closest('.lf-learner-page')"), true, 'the redirect lands focus on the page heading');
      // Keyboard: from the top of a freshly loaded document, the first Tab reaches the skip link, Enter moves focus to <main>.
      if (entry.redirected) {
        await page.send('Page.reload', {});
        await waitFor(page, `document.querySelector(${JSON.stringify(entry.ready)}) && document.querySelector('.lf-shell-rail [data-nav-id="mentor"] img')?.complete`, `${where}: reloaded`, READY_TRIES);
        await page.evaluate('document.fonts.ready');
        await sleep(300);
      }
      await page.evaluate('window.scrollTo(0, 0); document.activeElement?.blur()');
      await key(page, 'Tab', 'Tab', 9);
      const firstStop = await page.evaluate("document.activeElement?.classList.contains('lf-skip-link') ? 'skip' : (document.activeElement?.outerHTML ?? 'none').slice(0, 120)");
      assert.equal(firstStop, 'skip', 'first Tab reaches the skip link');
      await key(page, 'Enter', 'Enter', 13);
      await waitFor(page, "document.activeElement?.tagName === 'MAIN'", `${where}: skip link moves focus to <main>`, 40);
      // The next Tab stops inside the page, on a visible control.
      await key(page, 'Tab', 'Tab', 9);
      const inPage = await page.evaluate("(() => { const a = document.activeElement; const r = a?.getBoundingClientRect(); return !!a?.closest('.lf-learner-page') && r.width > 0; })()");
      assert.ok(inPage, 'Tab from <main> reaches a control of the page');

      // Route change by a real press: the new page is at the top with focus on its heading.
      let routeFocus = null;
      if (entry.press) {
        await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
        await press(page, entry.press);
        await waitFor(page, `location.pathname === ${JSON.stringify(entry.to)}`, `${where}: navigates to ${entry.to}`);
        await waitFor(page, "(() => { const a = document.activeElement; const main = document.querySelector('main'); return a && main && (a === main || (main.contains(a) && a.tagName === 'H1')); })()", `${where}: focus on the new page`);
        const after = await page.evaluate('({ scrollY, focus: document.activeElement.tagName })');
        assert.equal(after.scrollY, 0, 'route change scrolls to the top');
        routeFocus = after.focus;
      }
      assert.deepEqual(page.errors.filter((error) => !/Failed to load resource|net::ERR|synthetic core/i.test(error)), [], 'JS errors');
      evidence.push({ case: entry.id, population: spec.population, locale, theme, width, text: ['100%', '140%'], band: base.band, mentor: base.mentor, routeFocus, axe: 0 });
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
    origin, date: new Date().toISOString(), configurations: evidence.length + failures.length, passed: evidence.length, failures, evidence,
    unansweredCoreRequests: [...unknownRequests].sort(),
  }, null, 1));
  browser.child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
console.log(`\n${evidence.length}/${evidence.length + failures.length} configurations passed`);
if (failures.length) { console.log(failures.slice(0, 40).join('\n')); process.exitCode = 1; }
if (unknownRequests.size) console.log(`Synthetic Core answered with an empty envelope: ${[...unknownRequests].sort().join('; ')}`);
