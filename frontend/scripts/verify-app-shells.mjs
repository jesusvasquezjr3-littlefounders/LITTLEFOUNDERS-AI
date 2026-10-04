import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { trackAuditedAssets, waitForAuditedAssets } from './audits/media.mjs';
import { STATES } from './audits/states.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript, signedOutStorageScript } from './audits/synthetic-core.mjs';

/*
 * W2 Lane 0: the rebuilt shells mounted on REAL routes, in real Chrome.
 *
 *   npm run verify:app-shells   (REBUILD_URL=http://localhost:5395 for a Vite dev server)
 *
 * Every population a shell serves, signed in with a synthetic session and
 * answered by the synthetic Core (scripts/audits/synthetic-core.mjs; nothing
 * leaves the machine): a parent-created child on the learner app, an
 * independent teen (OD-3 Option B), a verified parent on the Tutor console, a
 * staff member granted only view_analytics on the staff console, a visitor on
 * the public site and on the sign-in shell, and the not-found state. For each
 * of 3 locales x 2 modes x 375/768/1280 px it checks, with real pointer and
 * keyboard input:
 *
 *   - no legacy chrome is left (the old sidebar, glass bars, raster logo,
 *     marketing header), exactly one <main>, and the shell in the right mode
 *     and language;
 *   - the learner's Mentor tab shows the chosen character's name and a render
 *     of that character's real model, and no navigation says Tutor, bot or
 *     assistant (OD-6); the Tutor console shows the Tutor pill and no Mentor slot;
 *   - the staff items are exactly what the grant opens;
 *   - the first Tab reaches the skip link and Enter moves focus to <main>;
 *   - Settings carries sign-out; every route carries the shared language and icon-only mode controls;
 *   - following a navigation link changes the route, scrolls to the top,
 *     moves focus to the new page's heading (or <main>) and retitles the document;
 *   - no horizontal overflow, and no axe violation in the shell (the legacy
 *     page body inside it is excluded until its lane rebuilds it).
 *
 * Reports and screenshots: audit-results/app-shells/.
 */
const origin = process.env.REBUILD_URL ?? process.env.AGE_AUDIT_URL ?? 'http://localhost:5395';
const out = resolve(process.env.REPORT_DIR ?? '../audit-results/app-shells');
mkdirSync(out, { recursive: true });
const LOCALES = (process.env.SHELL_LOCALES ?? 'en-US,es-MX,pt-BR').split(',');
const THEMES = (process.env.SHELL_THEMES ?? 'light,dark').split(',');
const WIDTHS = (process.env.SHELL_WIDTHS ?? '375,768,1280').split(',').map(Number);
const MENTOR_NAMES = { rho: 'Dr. Rho', zara: 'Zara', liruf: 'Liruf', dina: 'Dina' };
const copy = Object.fromEntries(LOCALES.map((locale) => [locale, JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-core.json`), 'utf8'))]));

/*
 * `navigate` is the slot a person presses next (by nav id); `expect` the
 * page's nav ids in order (the learner's Mentor tab included).
 */
const CASES = [
  { id: 'learner-child', shell: 'learner', path: '/learn', scenario: 'shell-child', navigate: 'profile', to: '/profile',
    expect: ['learn', 'mentor', 'tasks', 'banking', 'profile'] },
  { id: 'independent-teen', shell: 'learner', path: '/profile/settings', scenario: 'shell-teen', navigate: 'learn', to: '/learn',
    expect: ['learn', 'mentor', 'wallet', 'profile'] },
  { id: 'tutor', shell: 'tutor', path: '/family', scenario: 'shell-tutor', navigate: 'learn', to: '/learn',
    expect: ['family', 'tasks', 'banking', 'learn', 'profile'] },
  { id: 'staff-limited', shell: 'staff', path: '/admin/intel', scenario: 'shell-staff', navigate: 'analytics', to: '/admin/analytics',
    expect: ['overview', 'analytics', 'intel', 'mentorQuality', 'back-to-app'] },
  { id: 'marketing', shell: 'site', path: '/faq', scenario: null, navigate: 'how-it-works', to: '/how-it-works',
    expect: ['how-it-works', 'families', 'faq'] },
  { id: 'auth', shell: 'auth', path: '/login', scenario: null, navigate: null, expect: [] },
  { id: 'not-found', shell: 'single-state', path: '/no/such/page', scenario: null, navigate: null, expect: [] },
];

// Every additional actual-route wrapper uses its catalogue's exact fixture and path.
for (const [stateId, shell] of [
  ['app:/account-suspended', 'single-state'],
  ['app:/account-deletion@scheduled', 'single-state'],
  ['app:/learn@age-ask-tutor', 'single-state'],
  ['app:/onboarding@onboarding-welcome', 'single-state'],
  ['app:/badge/:token@expired', 'single-state'],
  ['app:/badge/:token@ready', 'single-state'],
  ['app:/learn/:course/placement@welcome-child', 'single-state'],
  ['app:/learn/lesson@opening', 'lesson'],
  ['app:/tutor@mentor-screen-child', 'mentor'],
]) {
  const fixture = STATES.find(state => state.id === stateId);
  if (!fixture) throw new Error(`Missing actual-route fixture ${stateId}`);
  CASES.push({ id: stateId, shell, path: fixture.path, scenario: fixture.scenario ?? null, ready: fixture.readyAll ?? [], navigate: null, expect: [] });
}

const filter = process.env.SHELL_CASES?.split(',');
const cases = CASES.filter((entry) => !filter || filter.includes(entry.id));
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const evidence = [];
const failures = [];
const unknownRequests = new Set();
let auditedPage;

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
    // Mobile visual-viewport panning must not move the real pointer below its DOM target.
    return { missing: false, occluded: !(e.contains(top) || top?.contains(e)), x: x - (visualViewport?.offsetLeft ?? 0), y: y - (visualViewport?.offsetTop ?? 0) };
  })()`);
  if (point.missing) throw new Error(`Missing: ${selector}`);
  if (point.occluded) throw new Error(`Occluded: ${selector}`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function key(page, name, code, keyCode) {
  // Native Enter activation includes a trusted keypress; React key handlers alone do not need it.
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode,
    ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode });
}

try {
  const warm = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  trackAuditedAssets(warm, origin);
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await waitForAuditedAssets(warm, {timeoutMs:60000,label:'warm assets'});
  assert.deepEqual(warm.assetFailures, [], 'warm media errors');
  await warm.send('Page.close').catch(() => {});
  const page = await openPage(browser.browser, { width: 375, height: 800, dark: false, newWindow: true, isolated: true });
  auditedPage = page;
  trackAuditedAssets(page, origin);
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests });
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');

  for (const entry of cases) for (const locale of LOCALES) for (const theme of THEMES) for (const width of WIDTHS) {
    const where = `${entry.id} ${locale} ${theme} ${width}px`;
    const screenshotId = entry.id.replace(/[^a-zA-Z0-9_.-]/g, '_');
    page.errors.length = 0;
    try {
      await waitForAuditedAssets(page, {timeoutMs:60000,label:`${where}: before navigation`});
      assert.deepEqual(page.assetFailures, [], 'previous route media errors');
      // Drain and leave the previous app before resizing or changing identity.
      await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
      await waitFor(page, `location.origin === ${JSON.stringify(origin)} && !document.querySelector('.lf-rebuild')`, 'neutral origin');
      await waitForAuditedAssets(page, {timeoutMs:60000,label:'neutral assets'});
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      const spec = entry.scenario ? SCENARIOS[entry.scenario] : null;
      page.core = spec ? { scenario: entry.scenario, locale, theme, fixtures: {} } : null;
      await page.evaluate(spec ? sessionStorageScript({ guest: spec.guest, locale, theme }) : signedOutStorageScript({ locale, theme }));
      const url = new URL(entry.path, origin); url.searchParams.set('lng', locale);
      await page.send('Page.navigate', { url: url.toString() });
      await waitFor(page, `document.querySelector('[data-shell=${JSON.stringify(entry.shell)}]') && document.documentElement.lang === ${JSON.stringify(locale)}`, `${where}: shell`);
      for (const selector of entry.ready ?? []) await waitFor(page, `document.querySelector(${JSON.stringify(selector)})`, `${where}: actual state`);
      await waitFor(page, "[...document.querySelectorAll('[data-mentor-stage]')].every(stage => stage.dataset.ready === 'true')", `${where}: stage resources settled`, 1200);
      if (entry.shell === 'learner') await waitFor(page, `(() => { const l = document.querySelector('.lf-shell-rail [data-nav-id="mentor"]'); return l && l.textContent.trim() !== ${JSON.stringify(copy[locale].appShell.mentor)} && l.querySelector('img')?.complete; })()`, `${where}: Mentor tab`);
      if (entry.expect.length) await waitFor(page, `[...document.querySelectorAll('[data-shell] .lf-shell-rail [data-nav-id], [data-shell] .lf-site-links [data-nav-id]')].length === ${entry.expect.length}`, `${where}: navigation`);
      await page.evaluate('document.fonts.ready');
      // The app cross-fades a theme it applies from the profile (500 ms): measure colours after it settles.
      await waitFor(page, "!document.documentElement.classList.contains('theme-transitioning')", `${where}: theme settled`);
      await sleep(150);

      const marketing = entry.shell === 'site' || entry.path.startsWith('/badge/');
      const application = ['learner', 'tutor', 'staff'].includes(entry.shell);
      if (marketing || entry.shell === 'auth' || application) await waitFor(page, "(() => { const img = document.querySelector('img[data-asset-id^=\"brand.\"]'); return !!img?.complete && img.naturalWidth > 0; })()", `${where}: official brand loaded`);
      await waitForAuditedAssets(page, {timeoutMs:60000,label:`${where}: initial assets`});
      const state = await page.evaluate(`(() => {
        const root = document.querySelector('.lf-rebuild');
        const shell = document.querySelector('[data-shell]');
        const nav = [...shell.querySelectorAll('.lf-shell-rail [data-nav-id], .lf-site-links [data-nav-id]')];
        const mentor = shell.querySelector('.lf-shell-rail [data-nav-id="mentor"]');
        return {
          lang: root.getAttribute('lang'), theme: root.dataset.theme, mains: document.querySelectorAll('main').length,
          // The legacy layouts' chrome, outside the legacy page body (a legacy card inside the body is the lane's to rebuild).
          legacyChrome: [...document.querySelectorAll('img[src*="logo-main"], .lf-glass, .lf-marketing-header, aside, [class*="w-sidebar"], [class*="ml-sidebar"]')]
            .filter((e) => !e.closest('[data-legacy-body]') && !e.closest('[role="dialog"], [aria-modal]')).map((e) => e.outerHTML.slice(0, 80)),
          nav: nav.map((a) => a.dataset.navId), navText: nav.map((a) => a.textContent.trim()),
          mentorName: mentor?.textContent.trim() ?? null, mentorAsset: mentor?.querySelector('img')?.dataset.assetId ?? null,
          pill: [...shell.querySelectorAll('.lf-pill')].map((p) => p.textContent.trim()),
          overflow: document.documentElement.scrollWidth - innerWidth, title: document.title,
          skip: !!shell.querySelector('.lf-skip-link'),
          sessionControls: !!document.querySelector('.lf-session-preferences button'),
          brand: (() => { const img = document.querySelector('img[data-asset-id^="brand."]'); const rect = img?.getBoundingClientRect(); return !!img?.complete && img.naturalWidth > 0 && rect.width > 0 && rect.height > 0 && getComputedStyle(img).visibility === 'visible'; })(),
          preferences: document.querySelectorAll('[data-shell-preferences]').length,
          topbars: document.querySelectorAll('.lf-site-header, .lf-appbar, .lf-auth-header, .lf-standalone-header').length,
        };
      })()`);
      assert.equal(state.lang, locale, 'shell language');
      assert.equal(state.theme, theme, 'shell mode');
      assert.deepEqual(state.legacyChrome, [], 'legacy chrome left on the page');
      assert.equal(state.mains, 1, 'exactly one <main>');
      assert.ok(state.overflow <= 1, `horizontal overflow ${state.overflow}px`);
      assert.ok(state.skip, 'skip link');
      assert.deepEqual(state.nav, entry.expect, 'navigation items');
      if (entry.shell === 'learner') {
        const character = spec.mentor;
        assert.equal(state.mentorName, MENTOR_NAMES[character], 'Mentor tab shows the chosen character');
        assert.equal(state.mentorAsset, `mentor.${character}.avatar.${theme}`, 'Mentor tab shows the real-model render');
      }
      if (['learner', 'tutor', 'staff'].includes(entry.shell)) {
        for (const text of state.navText) assert.doesNotMatch(text, /\b(tutor ia|ai tutor|bot|assistant|asistente|assistente)\b/i, `OD-6 wording: ${text}`);
        if (entry.shell === 'learner') for (const text of state.navText) assert.doesNotMatch(text, /tutor/i, `the learner's navigation never says Tutor: ${text}`);
      }
      // Settings retains sign-out; mode and locale live in the application rail or bottom dock, and the marketing header.
      if (entry.path === '/profile/settings') assert.ok(state.sessionControls, 'sign-out in Settings');
      if (entry.shell === 'tutor') { assert.ok(state.pill.includes('Tutor'), 'Tutor pill'); assert.ok(!state.nav.includes('mentor'), 'no Mentor slot'); }
      if (entry.shell === 'staff') assert.ok(state.pill.includes(copy[locale].appShell.staffRole), 'staff role pill');

      // Skip link: the first Tab stop, Enter moves focus to <main>.
      await page.evaluate('window.scrollTo(0, 0)');
      await key(page, 'Tab', 'Tab', 9);
      const firstStop = await page.evaluate("(() => { const a = document.activeElement; return a?.classList.contains('lf-skip-link') ? 'skip' : (a?.outerHTML ?? 'none').slice(0, 120); })()");
      assert.equal(firstStop, 'skip', 'first Tab reaches the skip link');
      await key(page, 'Enter', 'Enter', 13);
      await waitFor(page, "document.activeElement?.tagName === 'MAIN'", `${where}: skip link moves focus to <main>`, 40);

      assert.equal(state.topbars, marketing ? 1 : 0, 'topbar exclusive to marketing');
      if (marketing || entry.shell === 'auth' || (application && width >= 840)) assert.ok(state.brand, 'approved graphical brand');
      if (marketing || application || entry.shell === 'auth') {
      assert.equal(state.preferences, 1, 'one display preference group before opening the dock');
      const dockPreferences = application && width < 840;
      if (dockPreferences) await press(page, '.lf-app-preferences-dock > button');
      const preferencesRoot = dockPreferences ? '[role=dialog] [data-shell-preferences]' : '[data-shell-preferences]';
      const language = `${preferencesRoot} [role=combobox]`;
      await press(page, language);
      await waitFor(page, "document.querySelectorAll('[role=option]').length === 3", `${where}: three language options`);
      await key(page, 'Escape', 'Escape', 27);
      assert.ok(await page.evaluate("document.activeElement?.matches('[data-shell-preferences] [role=combobox]')"), 'Escape restores language trigger focus');
      const alternateLocale = locale === 'en-US' ? 'es-MX' : 'en-US';
      await waitForAuditedAssets(page, {timeoutMs:60000,label:`${where}: before locale`});
      if (page.core) page.core.locale = alternateLocale;
      await key(page, 'Enter', 'Enter', 13);
      await key(page, 'Home', 'Home', 36);
      if (alternateLocale === 'es-MX') await key(page, 'ArrowDown', 'ArrowDown', 40);
      await key(page, 'Enter', 'Enter', 13);
      await waitFor(page, `document.querySelector('.lf-rebuild').lang === ${JSON.stringify(alternateLocale)}`, `${where}: keyboard changes language`);
      await waitForAuditedAssets(page, {timeoutMs:60000,label:`${where}: alternate locale assets`});
      if (page.core) page.core.locale = locale;
      await press(page, language);
      await key(page, 'Home', 'Home', 36);
      for (let index = 0; index < ['en-US', 'es-MX', 'pt-BR'].indexOf(locale); index++) await key(page, 'ArrowDown', 'ArrowDown', 40);
      await key(page, 'Enter', 'Enter', 13);
      await waitFor(page, `document.querySelector('.lf-rebuild').lang === ${JSON.stringify(locale)}`, `${where}: restores language`);
      await waitForAuditedAssets(page, {timeoutMs:60000,label:`${where}: restored locale assets`});
      const themeButton = `${preferencesRoot} .lf-icon-button`;
      assert.ok(await page.evaluate("(() => { const b = [...document.querySelectorAll('[data-shell-preferences] .lf-icon-button')].find(b => b.getBoundingClientRect().width > 0); return !!b?.getAttribute('aria-label') && !b.textContent.trim() && !!b.querySelector('svg'); })()"), 'icon-only theme has accessible name and own glyph');
      await key(page, 'Tab', 'Tab', 9);
      assert.ok(await page.evaluate("document.activeElement?.matches('[data-shell-preferences] .lf-icon-button')"), 'theme follows language in keyboard order');
      await key(page, 'Enter', 'Enter', 13);
      await waitFor(page, `document.querySelector('.lf-rebuild').dataset.theme === ${JSON.stringify(theme === 'dark' ? 'light' : 'dark')}`, `${where}: keyboard toggles mode`);
      await waitForAuditedAssets(page, {timeoutMs:60000,label:`${where}: alternate theme assets`});
      await press(page, themeButton);
      await waitFor(page, `document.querySelector('.lf-rebuild').dataset.theme === ${JSON.stringify(theme)}`, `${where}: pointer restores mode`);
      await waitFor(page, "!document.documentElement.classList.contains('theme-transitioning')", `${where}: restored theme settles`);

      await waitForAuditedAssets(page, {timeoutMs:60000,label:`${where}: restored theme assets`});
      if (dockPreferences) { await key(page, 'Escape', 'Escape', 27); await waitFor(page, '!document.querySelector("[role=dialog]")', `${where}: preferences sheet closed`); }
      }

      // Scoped axe: the shell, not the legacy page body inside it.
      await page.evaluate(axeSource);
      const axe = await page.evaluate("axe.run({ include: [['[data-shell]']], exclude: [['[data-legacy-body]']] }, { resultTypes: ['violations'] })");
      assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.any?.[0]?.message ?? ''})`).join(', ')}`), [], 'axe violations');

      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(out, `${screenshotId}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));

      // Route change: a real press on the visible link; the page scrolls to the top and focus lands on the new heading.
      let routeFocus = null;
      if (entry.navigate) {
        await waitForAuditedAssets(page, {timeoutMs:60000,label:`${where}: before route press`});
        const before = state.title;
        await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
        const menu = await page.evaluate(`(() => { const b = document.querySelector('.lf-appbar-menu, .lf-site-menu'); return !!b && b.getBoundingClientRect().width > 0 && getComputedStyle(b).display !== 'none'; })()`);
        if (menu) { await press(page, '.lf-appbar-menu, .lf-site-menu'); await waitFor(page, "document.querySelector('.lf-nav-list--sheet')", `${where}: menu sheet`); }
        const selector = menu ? `.lf-nav-list--sheet [data-nav-id="${entry.navigate}"]` : `[data-shell] nav [data-nav-id="${entry.navigate}"]`;
        await press(page, selector);
        await waitFor(page, `location.pathname === ${JSON.stringify(entry.to)}`, `${where}: navigates to ${entry.to}`);
        await waitFor(page, "(() => { const a = document.activeElement; const main = document.querySelector('main'); return a && main && (a === main || (main.contains(a) && a.tagName === 'H1')); })()", `${where}: focus on the new page`);
        const after = await page.evaluate("({ scrollY, title: document.title, current: document.querySelector('[data-shell] [aria-current=page]')?.dataset.navId ?? null, focus: document.activeElement.tagName })");
        assert.equal(after.scrollY, 0, 'route change scrolls to the top');
        assert.notEqual(after.title, before, 'route change retitles the document');
        routeFocus = after.focus;
      }
      await waitForAuditedAssets(page, {timeoutMs:60000,label:`${where}: final assets`});
      assert.deepEqual(page.assetFailures, [], 'structured media errors');
      assert.deepEqual(page.errors, [], 'JS errors');
      evidence.push({ case: entry.id, population: spec?.population ?? 'signed out', locale, theme, width, nav: state.nav, mentor: state.mentorName, pill: state.pill,
        overflow: state.overflow, skipLink: 'ok', routeFocus, axe: 0, mediaErrors: [] });
      process.stdout.write('.');
    } catch (error) {
      console.log(`\nFAIL ${where}: ${error.message}`);
      failures.push(`${where}: ${error.message}${page.errors.length ? ` [page errors: ${page.errors.slice(0, 3).join(" | ").slice(0, 600)}]` : ""}`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) writeFileSync(join(out, `FAIL-${screenshotId}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      process.stdout.write('F');
    }
  }
  await waitForAuditedAssets(page, {timeoutMs:60000,label:'before close'});
  assert.deepEqual(page.assetFailures, [], 'final media errors');
  await page.send('Page.close').catch(() => {});
} catch (error) {
  failures.push(`setup: ${error.message}`);
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({
    provenance: 'Real routes on a local Vite server in headless Chrome, real pointer and keyboard input; synthetic Core; not full-stack',
    origin, date: new Date().toISOString(), configurations: evidence.length + failures.length, passed: evidence.length, failures, evidence,
    unansweredCoreRequests: [...unknownRequests].sort(),
    mediaErrors: auditedPage?.assetFailures ?? [],
  }, null, 1));
  browser.child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
console.log(`\n${evidence.length}/${evidence.length + failures.length} configurations passed`);
if (failures.length) { console.log(failures.slice(0, 30).join('\n')); process.exitCode = 1; }
if (unknownRequests.size) console.log(`Synthetic Core answered with an empty envelope: ${[...unknownRequests].sort().join('; ')}`);
