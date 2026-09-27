import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript } from './audits/synthetic-core.mjs';
import { consoleRequests } from './audits/lanes/staff.mjs';

/*
 * W2 Lane 6 (W2T.1, W2T.2): the rebuilt staff console on its REAL routes, in real Chrome.
 *
 *   REBUILD_URL=http://localhost:5460 npm run verify:staff-console
 *
 * Signed in with a synthetic session and answered by the synthetic Core
 * (scripts/audits/synthetic-core.mjs with the staff lane's fixtures; nothing
 * leaves the machine). Screen families: Overview (superadmin, and an admin with
 * only manage_support), Users (superadmin, and an admin with only
 * manage_users), Roles & Access, Audit log, Reports and Emails; W2T.2 adds
 * Content in its four views (superadmin, and an admin with only
 * manage_content), Generation in its four views and Mentor quality (an admin
 * with only view_analytics), with the course, lesson, live-activity and
 * generation-lesson sheets. For each of
 * 3 locales x 2 modes x 320/375/768/1280 px x normal and 140% text:
 *
 *   - the page is the rebuilt screen inside the staff shell (no legacy body),
 *     one h1 equal to the section's navigation label, the right language/mode;
 *   - no horizontal overflow, no clipped text box, every control >= 48 px;
 *   - the first Tab reaches the skip link, Enter focuses <main>, and Tab then
 *     reaches the page's first control;
 *   - 0 axe violations in the page;
 *   - population: the manage_support admin sees exactly Emails, Audit log and
 *     Reports on the Overview and never asks Core for users, health or
 *     retention; the manage_users admin never asks for the analytics funnel; a
 *     direct link to a section the grant does not open lands on /learn with no
 *     console read; a superadmin's section link changes the route, scrolls to
 *     the top and focuses the new page's heading;
 *   - details: a real press opens the details sheet, focus moves into it,
 *     Escape closes it and focus returns to the button that opened it.
 *
 * Screenshots: audit-results/staff-console/<case>-<locale>-<theme>-<width>[-140].png
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5460';
const out = resolve('../audit-results/staff-console');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const list = (name, fallback) => (process.env[name] ?? fallback).split(',').map((value) => value.trim()).filter(Boolean);
const LOCALES = list('STAFF_LOCALES', 'en-US,es-MX,pt-BR');
const THEMES = list('STAFF_THEMES', 'light,dark');
const WIDTHS = list('STAFF_WIDTHS', '320,375,768,1280').map(Number);
const SCALES = list('STAFF_TEXT', '100,140').map(Number);
const core = Object.fromEntries(LOCALES.map((locale) => [locale, JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-core.json`), 'utf8'))]));

const CASES = [
  { id: 'overview-super', path: '/admin', scenario: 'staff-super', screen: 'staff-overview', section: 'overview', ready: '[data-metric="auditEvents"]', follow: { press: '[data-console-section="audit"]', to: '/admin/audit', screen: 'staff-audit' } },
  { id: 'overview-support', path: '/admin', scenario: 'staff-support', screen: 'staff-overview', section: 'overview', ready: '[data-metric="auditEvents"]',
    sections: ['emails', 'audit', 'reports'], never: ['/admin/users', '/admin/health', '/admin/learning', '/admin/roles'] },
  { id: 'denied-users', path: '/admin/users', scenario: 'staff-support', denied: true },
  { id: 'users-super', path: '/admin/users', scenario: 'staff-super', screen: 'staff-users', section: 'users', ready: '.lf-table-row', details: '.lf-table-row:nth-child(3) .lf-table-cell:last-child button' },
  { id: 'users-manage-users', path: '/admin/users', scenario: 'staff-users', screen: 'staff-users', section: 'users', ready: '.lf-table-row', never: ['/admin/insights'] },
  { id: 'roles', path: '/admin/roles', scenario: 'staff-super', screen: 'staff-roles', section: 'roles', ready: '.lf-table-row', details: '.lf-table-row:first-child .lf-table-cell:last-child button' },
  { id: 'audit', path: '/admin/audit', scenario: 'staff-super', screen: 'staff-audit', section: 'audit', ready: '.lf-table-row', details: '.lf-table-row:first-child .lf-table-cell:last-child button' },
  { id: 'reports', path: '/admin/reports', scenario: 'staff-super', screen: 'staff-reports', section: 'reports', ready: '.lf-table-row', details: '.lf-table-row:first-child .lf-table-cell:last-child button' },
  { id: 'emails', path: '/admin/emails', scenario: 'staff-super', screen: 'staff-emails', section: 'emails', ready: '.lf-table-row', details: '.lf-table-row:first-child .lf-table-cell:last-child button' },
  // W2T.2: Content (courses, lesson review, Mentor activities, learning quality), Generation and Mentor quality.
  { id: 'content-courses', path: '/admin/content', scenario: 'staff-super', screen: 'staff-content', section: 'content', ready: '.lf-table-row',
    details: '.lf-table-row:nth-child(2) .lf-table-cell:last-child button' },
  { id: 'content-manage-content', path: '/admin/content', scenario: 'staff-content', screen: 'staff-content', section: 'content', ready: '.lf-table-row',
    never: ['/admin/users', '/admin/roles', '/admin/mentor-quality', '/admin/audit', '/admin/tutor', '/admin/moderation', '/admin/content/learning-quality'] },
  { id: 'content-review', path: '/admin/content?view=review', scenario: 'staff-super', screen: 'staff-content', section: 'content', ready: '.lf-table-row',
    details: '.lf-table-row:first-child .lf-table-cell:last-child button' },
  { id: 'content-live', path: '/admin/content?view=live', scenario: 'staff-super', screen: 'staff-content', section: 'content', ready: '[data-screen="staff-live-content-packs"]',
    details: '.lf-table-row:nth-child(2) .lf-table-cell:last-child button' },
  { id: 'content-quality', path: '/admin/content?view=quality', scenario: 'staff-super', screen: 'staff-content', section: 'content', ready: '[data-screen="learning-quality"] form' },
  { id: 'denied-content', path: '/admin/content', scenario: 'staff-analytics', denied: true },
  { id: 'generation-live', path: '/admin/generation', scenario: 'staff-content', screen: 'staff-generation', section: 'generation', ready: '.lf-staff-stages',
    never: ['/admin/generation/analytics', '/admin/generation/coach', '/admin/content'] },
  { id: 'generation-history', path: '/admin/generation?view=history', scenario: 'staff-super', screen: 'staff-generation', section: 'generation', ready: '.lf-staff-plot-svg',
    details: '.lf-table-row:nth-child(3) .lf-table-cell:last-child button' },
  { id: 'generation-trends', path: '/admin/generation?view=trends', scenario: 'staff-super', screen: 'staff-generation', section: 'generation', ready: '.lf-staff-plot-svg' },
  { id: 'generation-coach', path: '/admin/generation?view=coach', scenario: 'staff-super', screen: 'staff-generation', section: 'generation', ready: '.lf-staff-proposals' },
  { id: 'mentor-quality', path: '/admin/mentor-quality', scenario: 'staff-analytics', screen: 'staff-mentor-quality', section: 'mentorQuality', ready: '[data-screen="staff-mentor-quality-signals"]',
    never: ['/admin/content', '/admin/generation', '/admin/users'] },
  { id: 'denied-mentor-quality', path: '/admin/mentor-quality', scenario: 'staff-content', denied: true },
];
const filter = process.env.STAFF_CASES?.split(',');
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
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, ...(type === 'mouseMoved' ? {} : { button: 'left', clickCount: 1 }) });
  }
}

async function key(page, name, code, keyCode) {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode });
}

async function shot(page, name) {
  const image = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(out, `${name}.png`), Buffer.from(image.data, 'base64'));
}

/** Geometry of the page: overflow, controls under 48 px and clipped text boxes (visible, non-decorative only). */
const GEOMETRY = `(() => {
  const main = document.querySelector('[data-shell="staff"] main');
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0'; };
  const controls = [...main.querySelectorAll('button, a[href], select, input:not([type=radio]):not([type=checkbox]), textarea, .lf-segmented-option, [role=switch]')].filter(visible);
  const small = controls.map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => Math.round(r.height) < 48 || Math.round(r.width) < 48)
    .map(({ e, r }) => e.tagName + '.' + (e.className || '').toString().split(' ')[0] + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + (e.textContent || '').trim().slice(0, 30) + '"');
  const clipped = [...main.querySelectorAll('[data-copy-role]')].filter(visible).filter((e) => {
    const s = getComputedStyle(e);
    return /hidden|clip/.test(s.overflowX + s.overflowY) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1);
  }).map((e) => (e.textContent || '').trim().slice(0, 40));
  return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small, clipped,
    h1: [...main.querySelectorAll('h1')].map((h) => h.textContent.trim()), legacy: !!document.querySelector('[data-legacy-body]'),
    lang: document.querySelector('.lf-rebuild')?.getAttribute('lang'), theme: document.querySelector('.lf-rebuild')?.dataset.theme };
})()`;

try {
  const warm = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await warm.send('Page.close').catch(() => {});
  const page = await openPage(browser.browser, { width: 375, height: 800, dark: false, newWindow: true, isolated: true });
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests });
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');

  for (const entry of cases) for (const locale of LOCALES) for (const theme of THEMES) for (const width of WIDTHS) for (const scale of SCALES) {
    // The population and keyboard checks run once per locale and theme at 375 px; the geometry at every width and text size.
    const full = width === 375 && scale === 100;
    if (entry.denied && !full) continue;
    const where = `${entry.id} ${locale} ${theme} ${width}px ${scale}%`;
    page.errors.length = 0;
    consoleRequests.length = 0;
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
      await page.send('Page.navigate', { url: `${origin}${entry.path}` });

      if (entry.denied) {
        await waitFor(page, "location.pathname === '/learn'", `${where}: redirected to /learn`);
        await sleep(300);
        assert.deepEqual(consoleRequests.filter((request) => request.includes(entry.path)), [], 'a denied section read its data');
        evidence.push({ case: entry.id, locale, theme, width, deniedDeepLink: true, noConsoleRead: true });
        continue;
      }

      // A cold dev server compiles the console chunk on first use: allow it a minute.
      await waitFor(page, `document.querySelector('[data-shell="staff"] [data-screen=${JSON.stringify(entry.screen)}] ${entry.ready}') && document.documentElement.lang === ${JSON.stringify(locale)}`, `${where}: screen ready`, 1200);
      await page.evaluate('document.fonts.ready');
      await waitFor(page, "!document.documentElement.classList.contains('theme-transitioning')", `${where}: theme settled`);
      if (scale !== 100) await page.evaluate(`document.documentElement.style.fontSize = '${scale}%'`);
      await sleep(200);
      await page.evaluate('window.scrollTo(0, 0)');

      const geometry = await page.evaluate(GEOMETRY);
      assert.equal(geometry.legacy, false, 'a legacy page body is left around the rebuilt screen');
      assert.deepEqual(geometry.h1, [core[locale].appShell.staff[entry.section]], 'one h1, the section label');
      assert.equal(geometry.lang, locale);
      assert.equal(geometry.theme, theme);
      assert.ok(geometry.overflow <= 1, `horizontal overflow of ${geometry.overflow}px`);
      assert.deepEqual(geometry.small, [], 'controls under 48 px');
      assert.deepEqual(geometry.clipped, [], 'clipped text boxes');
      const name = `${entry.id}-${locale}-${theme}-${width}${scale === 100 ? '' : `-${scale}`}`;
      if (width === 375 || width === 1280) await shot(page, name);
      const record = { case: entry.id, locale, theme, width, scale, oneH1: true, noOverflow: true, targets: true, noClipping: true };

      if (full) {
        // Keyboard: the skip link first, then <main>, then the page's first control.
        await page.evaluate('document.activeElement?.blur(); window.scrollTo(0, 0)');
        await key(page, 'Tab', 'Tab', 9);
        assert.ok(await page.evaluate("document.activeElement?.classList.contains('lf-skip-link')"), 'first Tab reaches the skip link');
        await key(page, 'Enter', 'Enter', 13);
        await waitFor(page, "document.activeElement?.tagName === 'MAIN'", `${where}: skip link focuses main`);
        await key(page, 'Tab', 'Tab', 9);
        assert.ok(await page.evaluate(`!!document.activeElement?.closest('[data-screen=${JSON.stringify(entry.screen)}]')`), 'Tab from main reaches the page');
        if (!await page.evaluate("typeof axe !== 'undefined'")) await page.evaluate(axeSource);
        const axe = await page.evaluate(`axe.run({ include: [['[data-screen=${JSON.stringify(entry.screen)}]']] }, { resultTypes: ['violations'] }).then((r) => r.violations.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')))`);
        assert.deepEqual(axe, [], 'axe violations');
        Object.assign(record, { skipLink: true, pageReachable: true, axe: 0 });
        if (entry.sections) {
          assert.deepEqual(await page.evaluate("[...document.querySelectorAll('[data-console-section]')].map((a) => a.dataset.consoleSection)"), entry.sections, 'overview sections by grant');
          record.sectionsByGrant = entry.sections;
        }
        if (entry.never) {
          await sleep(300);
          const asked = consoleRequests.filter((request) => entry.never.some((path) => request.includes(` ${path}`)));
          assert.deepEqual(asked, [], 'asked Core for a section the grant does not open');
          record.neverAsked = entry.never;
        }
        if (entry.details) {
          await press(page, `[data-screen=${JSON.stringify(entry.screen)}] ${entry.details}`);
          await waitFor(page, "document.querySelector('[role=dialog][aria-modal=true]')?.contains(document.activeElement)", `${where}: details open with focus inside`)
            .catch(async (error) => { throw new Error(`${error.message} (focus: ${await page.evaluate("document.activeElement?.outerHTML.slice(0, 160)").catch(() => '?')}; dialogs: ${await page.evaluate("[...document.querySelectorAll('[role=dialog]')].map((d) => d.className).join(',')")})`); });
          await sleep(200);
          const sheet = await page.evaluate(`(() => { const d = document.querySelector('[role=dialog][aria-modal=true]'); const r = d.getBoundingClientRect();
            return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, inside: r.left >= -1 && r.right <= innerWidth + 1 }; })()`);
          assert.ok(sheet.overflow <= 1 && sheet.inside, 'details sheet inside the viewport');
          await shot(page, `${name}-details`);
          await key(page, 'Escape', 'Escape', 27);
          await waitFor(page, `!document.querySelector('[role=dialog][aria-modal=true]') && document.activeElement?.closest('.lf-table-row')`, `${where}: Escape closes and returns focus`);
          record.details = 'opens with focus inside, Escape returns focus';
        }
        if (entry.follow) {
          await page.evaluate('window.scrollTo(0, 400)');
          await press(page, entry.follow.press);
          await waitFor(page, `location.pathname === ${JSON.stringify(entry.follow.to)} && document.querySelector('[data-screen=${JSON.stringify(entry.follow.screen)}]')`, `${where}: followed a section link`);
          await waitFor(page, "window.scrollY === 0 && ['H1', 'MAIN'].includes(document.activeElement?.tagName)", `${where}: route focus`);
          record.routeFocus = await page.evaluate('document.activeElement.tagName');
        }
      }
      assert.deepEqual(page.errors, [], 'page errors');
      evidence.push(record);
    } catch (error) {
      failures.push({ where, error: String(error.message ?? error), pageErrors: page.errors.slice(0, 3) });
      await shot(page, `FAIL-${entry.id}-${locale}-${theme}-${width}-${scale}`).catch(() => {});
      console.log(`\nFAIL ${where}: ${error.message ?? error}`);
    }
    process.stdout.write('.');
  }
  await page.send('Page.close').catch(() => {});
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({
    provenance: 'Actual app routes in local Chrome with a synthetic Core (scripts/audits/lanes/staff.mjs fixtures). Core authorization is verified by its own tests. Not full-stack or release acceptance.',
    configurations: evidence.length, failures, unknownRequests: [...unknownRequests], evidence,
  }, null, 2));
  browser.child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
console.log(`\n${evidence.length} configurations passed, ${failures.length} failed. Unknown Core requests: ${[...unknownRequests].join(', ') || 'none'}`);
if (failures.length) process.exitCode = 1;
