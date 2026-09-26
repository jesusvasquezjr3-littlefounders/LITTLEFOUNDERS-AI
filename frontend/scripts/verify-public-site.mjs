import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript, signedOutStorageScript } from './audits/synthetic-core.mjs';

/*
 * Real-route matrix of the rebuilt public site (W2 Lane 1, checkpoint W2S.1):
 * Landing, How it works, For families, FAQ, Terms and Privacy (M1–M6) and the
 * cookie choice (M8), in headless Chrome against a local Vite server, with
 * real pointer and keyboard input and a synthetic Core (no real Core, database
 * or provider is contacted).
 *
 * Every case x en-US/es-MX/pt-BR x light/dark x 320/375/768/1280 px x normal
 * and 140% text:
 *   - the page's one <h1> is the rebuilt copy, in the page language and mode;
 *   - no horizontal overflow, every pressable at least 48 x 48 px;
 *   - the first Tab reaches the skip link and Enter moves focus to <main>;
 *     the page's main call to action is reachable by Tab;
 *   - population: a visitor gets "Start free" (a guest session, no sign-up) or
 *     the Tutor sign-up and the cookie choice; a verified parent gets
 *     "Continue" / "Open your family", no cookie banner and no sign-up;
 *   - the cookie banner: two equal choices, never focused on arrival; a real
 *     press on "Reject optional" writes the choice and removes the banner;
 *   - 0 axe violations (the page and the banner);
 *   - one route change per case family: a real press on a page link moves to
 *     the new page, scrolls to the top and focuses its heading.
 *
 *   REBUILD_URL=http://localhost:5410 node scripts/verify-public-site.mjs
 *   Filters: SITE_CASES, SITE_LOCALES, SITE_THEMES, SITE_WIDTHS, SITE_TEXT (100,140)
 * Report and failure screenshots: audit-results/public-site/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5410';
const out = resolve('../audit-results/public-site');
mkdirSync(out, { recursive: true });
const list = (name, fallback) => (process.env[name] ? process.env[name].split(',') : fallback);
const LOCALES = list('SITE_LOCALES', ['en-US', 'es-MX', 'pt-BR']);
const THEMES = list('SITE_THEMES', ['light', 'dark']);
const WIDTHS = list('SITE_WIDTHS', ['320', '375', '768', '1280']).map(Number);
const TEXT = list('SITE_TEXT', ['100', '140']).map(Number);
const copy = Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale) => [locale, {
  site: JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-site.json`), 'utf8')),
  legal: JSON.parse(readFileSync(resolve(`src/i18n/${locale}/legal.json`), 'utf8')),
}]));

/* `h1` picks the expected heading; `cta` the page's main call to action; `follow` a link pressed to test the route change. */
const CASES = [
  { id: 'landing', path: '/', scenario: null, h1: (c) => c.site.landing.title, cta: '[data-cta="start-free"]', follow: ['.lf-site-page a[href="/how-it-works"]', '/how-it-works'] },
  { id: 'landing-tutor', path: '/', scenario: 'site-tutor', h1: (c) => c.site.landing.title, cta: '[data-cta="continue"]' },
  { id: 'how-it-works', path: '/how-it-works', scenario: null, h1: (c) => c.site.howItWorks.title, cta: '[data-cta="start-free"]' },
  { id: 'families', path: '/families', scenario: null, h1: (c) => c.site.families.title, cta: '[data-cta="become-tutor"]' },
  { id: 'families-tutor', path: '/families', scenario: 'site-tutor', h1: (c) => c.site.families.title, cta: '.lf-site-page a[href="/family"]' },
  { id: 'faq', path: '/faq', scenario: null, h1: (c) => c.site.faq.title, cta: '[data-faq-item="whatIs"] button' },
  { id: 'terms', path: '/legal/terms', scenario: null, h1: (c) => c.legal.terms.title, cta: '.lf-legal-toc a[href="#c1"]', follow: ['.lf-legal-switch a[href="/legal/privacy"]', '/legal/privacy'] },
  { id: 'privacy', path: '/legal/privacy', scenario: null, h1: (c) => c.legal.privacy.title, cta: '[data-open="cookie-preferences"]' },
];
const filter = process.env.SITE_CASES?.split(',');
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

async function key(page, name, code, keyCode, modifiers = 0) {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
}

const TARGETS = `[...document.querySelectorAll('[data-shell] main :is(a[href], button, input, select, [role=button]), [data-consent-banner] :is(a[href], button)')]
  .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); })
  .map((e) => { const t = e.matches('input[type=radio]') ? (e.closest('label') ?? e) : e; const r = t.getBoundingClientRect(); return { w: r.width, h: r.height, label: (t.textContent || t.getAttribute('aria-label') || t.tagName).trim().slice(0, 40) }; })
  .filter((t) => t.w < 47.5 || t.h < 47.5)`;

try {
  const warm = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await warm.send('Page.close').catch(() => {});
  const page = await openPage(browser.browser, { width: 375, height: 800, dark: false, newWindow: true, isolated: true });
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests });
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');

  for (const entry of cases) for (const locale of LOCALES) for (const theme of THEMES) for (const width of WIDTHS) for (const text of TEXT) {
    const where = `${entry.id} ${locale} ${theme} ${width}px ${text}%`;
    const c = copy[locale];
    page.errors.length = 0;
    try {
      await page.send('Network.clearBrowserCookies');
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      if (await page.evaluate('location.origin').catch(() => '') !== origin) {
        await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
        await waitFor(page, `location.origin === ${JSON.stringify(origin)}`, 'origin');
      }
      const spec = entry.scenario ? SCENARIOS[entry.scenario] : null;
      page.core = spec ? { scenario: entry.scenario, locale, theme, fixtures: {} } : null;
      await page.evaluate(spec ? sessionStorageScript({ guest: spec.guest, locale, theme }) : signedOutStorageScript({ locale, theme }));
      const url = new URL(entry.path, origin); url.searchParams.set('lng', locale);
      await page.send('Page.navigate', { url: url.toString() });
      await waitFor(page, `document.querySelector('[data-shell="site"] [data-screen]') && document.documentElement.lang === ${JSON.stringify(locale)}`, `${where}: page`);
      if (text !== 100) await page.evaluate(`document.documentElement.style.fontSize = '${text}%'`);
      await page.evaluate('document.fonts.ready');
      await waitFor(page, "!document.documentElement.classList.contains('theme-transitioning')", `${where}: theme settled`);
      await waitFor(page, `document.querySelector(${JSON.stringify(entry.cta)})`, `${where}: call to action`);
      if (!spec) await waitFor(page, "document.querySelector('[data-consent-banner]')", `${where}: cookie banner`);
      await sleep(150);

      const state = await page.evaluate(`(() => {
        const root = document.querySelector('[data-shell="site"]').closest('.lf-rebuild');
        const h1s = [...document.querySelectorAll('h1')];
        const banner = document.querySelector('[data-consent-banner]');
        const choices = banner ? [...banner.querySelectorAll('[data-consent="reject"], [data-consent="accept"]')].map((b) => b.className) : [];
        return {
          lang: root.getAttribute('lang'), theme: root.dataset.theme, h1: h1s.map((h) => h.textContent.trim()),
          mains: document.querySelectorAll('main').length, overflow: document.documentElement.scrollWidth - innerWidth,
          startFree: !!document.querySelector('[data-cta="start-free"]'), cont: !!document.querySelector('[data-cta="continue"]'),
          becomeTutor: !!document.querySelector('.lf-site-page a[href="/signup?intent=tutor"]'),
          verifyLink: !!document.querySelector('.lf-site-page a[href="/verify-parent"]'),
          banner: !!banner, bannerFocused: !!banner && banner.contains(document.activeElement), equalChoices: choices.length === 2 && choices[0] === choices[1],
          small: ${TARGETS},
          em: /—/.test(document.querySelector('[data-shell="site"] main').innerText),
          aiTutor: /\\b(AI|IA) Tutor\\b|\\bTutor (de )?IA\\b/.test(document.body.innerText),
        };
      })()`);
      assert.equal(state.lang, locale, 'page language');
      assert.equal(state.theme, theme, 'page mode');
      assert.deepEqual(state.h1, [entry.h1(c)], 'one <h1>, the rebuilt copy');
      assert.equal(state.mains, 1, 'one <main>');
      assert.ok(state.overflow <= 1, `horizontal overflow ${state.overflow}px`);
      assert.deepEqual(state.small, [], 'targets under 48 px');
      assert.equal(state.em, false, 'no em dash in the page');
      assert.equal(state.aiTutor, false, 'the AI is never "AI Tutor" (OD-6)');
      assert.equal(state.verifyLink, false, 'the public pages never send anyone to parent verification');
      if (spec) {
        assert.equal(state.banner, false, 'no cookie banner for a signed-in account');
        assert.equal(state.startFree, false, 'no guest start for a signed-in account');
        assert.equal(state.becomeTutor, false, 'no Tutor sign-up for a verified parent');
      } else {
        assert.equal(state.banner, true, 'cookie banner for a first visit');
        assert.equal(state.bannerFocused, false, 'the banner never takes focus');
        assert.equal(state.equalChoices, true, 'reject and accept look the same');
        assert.equal(state.cont, false, 'a visitor is not offered "Continue"');
      }

      // axe over the page and the banner (the page is fully rebuilt: nothing is excluded).
      await page.evaluate(axeSource);
      const axe = await page.evaluate("axe.run({ include: [['[data-shell]'], ...(document.querySelector('[data-consent-banner]') ? [['[data-consent-banner]']] : [])] }, { resultTypes: ['violations'] })");
      assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} (${n.any?.[0]?.message ?? ''})`).join(', ')}`), [], 'axe violations');

      // The visitor decides: a real press on "Reject optional" writes the choice and removes the banner.
      if (!spec) {
        await press(page, '[data-consent-banner] [data-consent="reject"]');
        await waitFor(page, "!document.querySelector('[data-consent-banner]') && document.cookie.includes('lf_cc=denied')", `${where}: reject recorded`);
      }

      // Keyboard: the skip link first, Enter to <main>, then Tab reaches the page's call to action.
      await page.evaluate('window.scrollTo(0, 0); document.activeElement?.blur(); document.body.focus()');
      await key(page, 'Tab', 'Tab', 9);
      assert.equal(await page.evaluate("document.activeElement?.classList.contains('lf-skip-link') ?? false"), true, 'first Tab reaches the skip link');
      await key(page, 'Enter', 'Enter', 13);
      await waitFor(page, "document.activeElement?.tagName === 'MAIN'", `${where}: skip link moves focus to <main>`, 40);
      let reached = false;
      for (let n = 0; n < 60 && !reached; n++) {
        await key(page, 'Tab', 'Tab', 9);
        reached = await page.evaluate(`document.activeElement?.matches(${JSON.stringify(entry.cta)}) ?? false`);
      }
      assert.ok(reached, 'the call to action is reachable by keyboard');
      const ring = await page.evaluate("getComputedStyle(document.activeElement).outlineStyle !== 'none' || getComputedStyle(document.activeElement).boxShadow !== 'none'");
      assert.ok(ring, 'the focused call to action shows a focus ring');

      if (width === 375 && text === 100) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(out, `${entry.id}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }

      // One route change: a real press on a page link; the new page starts at the top with focus on its heading.
      let routeFocus = null;
      if (entry.follow && text === 100) {
        const [selector, to] = entry.follow;
        await press(page, selector);
        await waitFor(page, `location.pathname === ${JSON.stringify(to)}`, `${where}: navigates to ${to}`);
        await waitFor(page, "(() => { const a = document.activeElement; const main = document.querySelector('main'); return a && main && (a === main || (main.contains(a) && a.tagName === 'H1')); })()", `${where}: focus on the new page`);
        const after = await page.evaluate('({ scrollY, focus: document.activeElement.tagName })');
        assert.equal(after.scrollY, 0, 'route change scrolls to the top');
        routeFocus = after.focus;
      }
      assert.deepEqual(page.errors.filter((error) => !/Failed to load resource|net::ERR|synthetic core/i.test(error)), [], 'JS errors');
      evidence.push({ case: entry.id, population: spec?.population ?? 'visitor (signed out, first visit)', locale, theme, width, text, overflow: state.overflow, axe: 0, routeFocus });
      process.stdout.write('.');
    } catch (error) {
      failures.push(`${where}: ${error.message}${page.errors.length ? ` [page errors: ${page.errors.slice(0, 3).join(' | ').slice(0, 600)}]` : ''}`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (shot) writeFileSync(join(out, `FAIL-${entry.id}-${locale}-${theme}-${width}-${text}.png`), Buffer.from(shot.data, 'base64'));
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
if (failures.length) { console.log(failures.slice(0, 30).join('\n')); process.exitCode = 1; }
if (unknownRequests.size) console.log(`Synthetic Core answered with an empty envelope: ${[...unknownRequests].sort().join('; ')}`);
