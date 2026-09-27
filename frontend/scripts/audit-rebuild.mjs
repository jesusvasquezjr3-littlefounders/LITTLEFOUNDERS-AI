import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installAudit } from './audits/in-page.mjs';
import { aggregate, copyFindings, FOLD, proportionFindings } from './audits/rules.mjs';
import { extraRoutes, LOCALES, STATES, stateUrl, THEMES, WIDTHS } from './audits/states.mjs';
import { installSyntheticCore, loadLessonFixtures, SCENARIOS, sessionStorageScript, signedOutStorageScript } from './audits/synthetic-core.mjs';

/*
 * The three Frontend Bible audits on the REAL rebuilt app (02 §7 item 10,
 * 03 §5, 06 §7): text fit, proportion and copy budget, ported from
 * docs/littlefounders-spec/frontend/verification-tools/*.reference.mjs to a
 * driver that reaches every state the way a person does (URL, then real
 * pointer presses) instead of the mockup's `S`/`render()` hooks.
 *
 *   npm run audit:text-fit      02 §7 Text Fit Contract
 *   npm run audit:proportion    03 §3 proportion and composition
 *   npm run audit:copy-budget   06 §3 copy budget
 *   npm run audit:rebuild       all three in one pass (the pre-merge gate for UI changes)
 *
 * Authenticated routes (S03.5) are measured on the real app, signed in with a
 * synthetic session; every request to Core is answered locally by
 * audits/synthetic-core.mjs (no real Core, database or provider is contacted).
 *
 * Matrix: every state in audits/states.mjs x en-US/es-MX/pt-BR x light/dark x
 * 320/375/768/1280 px. Text fit runs each width with normal and +40% text,
 * each with and without the WCAG 1.4.12 spacing overrides (the reference's
 * "audit" and "spacing" modes); proportion and copy budget run each width with
 * normal text; the copy budget's first-view total is taken at 375 x 740 only,
 * as 06 §3.1 defines it. One page load per state, locale and theme (a state
 * reached by pressing controls is reloaded per width).
 *
 * Needs a Vite dev server (the preview entry is development-only):
 *   REBUILD_URL=http://localhost:5310 npm run audit:rebuild
 * Env filters for a debugging run (recorded evidence always uses the full set):
 *   AUDIT_STATES=system,lesson@6-9 (ids or id prefixes ending in *), AUDIT_LOCALES,
 *   AUDIT_THEMES, AUDIT_WIDTHS, AUDIT_ROUTES=/some/route (extra real-app routes),
 *   AUDIT_WORKERS (parallel pages, default 3), AUDIT_READY_MS (how long a state may take to become ready,
 *   default 15000; raise it only on a saturated shared machine, and say so in the evidence).
 * Reports: audit-results/rebuild-audits/<audit>.json. Exit 0 clean, 1 findings, 2 setup error.
 */
const AUDITS = ['text-fit', 'proportion', 'copy-budget'];
const requested = process.argv[2] ?? 'all';
if (requested !== 'all' && !AUDITS.includes(requested)) { console.error(`Usage: node scripts/audit-rebuild.mjs [${AUDITS.join('|')}|all]`); process.exit(2); }
const active = new Set(requested === 'all' ? AUDITS : [requested]);
const origin = process.env.REBUILD_URL ?? 'http://localhost:5310';
const list = (name, fallback) => process.env[name]?.split(',').map((v) => v.trim()).filter(Boolean) ?? fallback;
const locales = list('AUDIT_LOCALES', LOCALES), themes = list('AUDIT_THEMES', THEMES), widths = list('AUDIT_WIDTHS', WIDTHS.map(String)).map(Number);
const filters = list('AUDIT_STATES', null);
const states = [...STATES, ...extraRoutes()].filter((state) => !filters || filters.some((f) => (f.endsWith('*') ? state.id.startsWith(f.slice(0, -1)) : state.id === f)));
if (!states.length) { console.error('No state matches AUDIT_STATES'); process.exit(2); }
const output = resolve('../audit-results/rebuild-audits');
mkdirSync(output, { recursive: true });

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const readyTries = Math.max(300, Math.ceil(Number(process.env.AUDIT_READY_MS ?? 15000) / 50));
const rows = { 'text-fit': [], proportion: [], 'copy-budget': [] };
const configurations = { 'text-fit': 0, proportion: 0, 'copy-budget': 0 };
const jsErrors = [];
const signatures = new Map();
const unknownRequests = new Set();
let fixtures = null;
let exitCode = 0;
const profile = mkdtempSync(join(output, 'chrome-'));
const browser = await launchBrowser(profile);

async function onOrigin(page) {
  if (await page.evaluate('location.origin').catch(() => '') === origin) return;
  await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
  for (let n = 0; n < 200 && await page.evaluate('location.origin').catch(() => '') !== origin; n++) await wait(50);
}

async function load(page, state, locale, theme, width) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: FOLD, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  const url = stateUrl(origin, state, locale, theme);
  if (state.entry === 'app') {
    // The real app reads its session, language and mode from storage: a synthetic session for an
    // authenticated state, none for a session-less route. Core is answered by the synthetic Core.
    await onOrigin(page);
    const spec = state.scenario ? SCENARIOS[state.scenario] : null;
    await page.evaluate(spec ? sessionStorageScript({ guest: spec.guest, locale, theme }) : signedOutStorageScript({ locale, theme }));
    page.core = spec ? { scenario: state.scenario, locale, theme, fixtures } : null;
  } else page.core = null;
  await page.send('Page.navigate', { url });
  const ready = state.entry === 'app'
    ? `document.readyState === 'complete' && !!document.querySelector('.lf-rebuild') && document.documentElement.lang === ${JSON.stringify(locale)}${(state.readyAll ?? []).map((selector) => ` && !!document.querySelector(${JSON.stringify(selector)})`).join('')}`
    :`location.href === ${JSON.stringify(url)} && !!document.querySelector('.lf-rebuild main, main.lf-rebuild')`;
  let ok = false;
  // AUDIT_READY_MS: how long a state may take to become ready (default 15 s). A loaded machine needs longer;
  // waiting longer never changes what is measured once the state is ready.
  for (let n = 0; n < readyTries && !ok; n++) { await wait(50); ok = await page.evaluate(`!!(${ready})`).catch(() => false); }
  if (!ok) throw new Error(`${state.id} ${locale} ${theme}: never became ready at ${url}`);
  // A hidden page gets no animation frames: every measurement after this would be of a frozen page.
  if (await page.evaluate('document.visibilityState') !== 'visible') throw new Error(`${state.id}: the audit page is hidden`);
  await page.evaluate('document.fonts.ready');
  if (!await page.evaluate("document.fonts.check('600 16px Fredoka') && document.fonts.check('500 16px Nunito')")) throw new Error(`${state.id}: fonts did not load`);
  // The rebuilt root must carry the locale and theme asked for, or the matrix is measuring something else.
  const applied = await page.evaluate(`(() => { const r = document.querySelector('.lf-rebuild'); return { lang: r.getAttribute('lang') || document.documentElement.lang, theme: r.dataset.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light') }; })()`);
  if (applied.lang !== locale || applied.theme !== theme) throw new Error(`${state.id}: asked for ${locale}/${theme}, the page shows ${applied.lang}/${applied.theme}`);
  for (const selector of state.open ?? []) {
    const point = await page.evaluate(`(() => {
      const e = document.querySelector(${JSON.stringify(selector)});
      if (!e) throw new Error('Missing ' + ${JSON.stringify(selector)});
      e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, top = document.elementFromPoint(x, y);
      if (!(e.contains(top) || top?.contains(e))) throw new Error('Occluded: ' + ${JSON.stringify(selector)});
      return { x, y };
    })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await wait(350);
  }
  await page.evaluate(`Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))`);
  await page.evaluate(`(${installAudit})()`);
  // A milestone celebration measures on its settled frame (it settles within 1.2 s by contract; 07 §5).
  for (let n = 0; n < 60 && await page.evaluate("!!document.querySelector('[data-celebration=\"playing\"]')"); n++) await wait(50);
  await settle(page);
}

async function settle(page) {
  await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
}

async function measure(page, state, locale, theme, width, first, sink) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: FOLD, deviceScaleFactor: 1, mobile: width < 768 });
  if (!state.open) await page.evaluate('window.scrollTo(0, 0)');
  await settle(page);
  const where = { state: state.id, locale, theme, width };
  if (first) {
    // Per entry: the same surface on the preview entry and on its real route may legitimately match.
    const signature = `${state.entry}:${await page.evaluate('window.__lfAudit.signature()')}`;
    if (signatures.has(signature) && signatures.get(signature) !== state.id) throw new Error(`States ${signatures.get(signature)} and ${state.id} render identical markup: the driver is not reaching them`);
    signatures.set(signature, state.id);
  }
  if (active.has('text-fit')) for (const stress of [false, true]) for (const spacing of [false, true]) {
    await page.evaluate(`window.__lfAudit.spacing(${spacing}); window.__lfAudit.stress(${stress})`);
    await settle(page);
    const found = await page.evaluate('window.__lfAudit.textFit()');
    await page.evaluate('window.__lfAudit.stress(false); window.__lfAudit.spacing(false)');
    sink.configurations['text-fit']++;
    for (const [type, detail] of found) sink.rows['text-fit'].push({ type, detail, ...where, stress, spacing });
  }
  await settle(page);
  if (active.has('proportion')) {
    const res = await page.evaluate('window.__lfAudit.proportion()');
    // 02 §9.4 / D7 motion budget: read with motion allowed, then back to reduced motion for everything else.
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await page.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
    Object.assign(res, await page.evaluate('window.__lfAudit.motion()'));
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    sink.configurations.proportion++;
    for (const [type, detail] of proportionFindings(res, state, width)) sink.rows.proportion.push({ type, detail, ...where });
  }
  if (active.has('copy-budget')) {
    const res = await page.evaluate(`window.__lfAudit.copyBudget(${FOLD})`);
    sink.configurations['copy-budget']++;
    if (!res.blocks.length) sink.rows['copy-budget'].push({ type: 'no-text-measured', detail: 'the state rendered no measurable text', ...where });
    for (const [type, detail] of copyFindings(res, state, locale, { firstView: width === 375 })) sink.rows['copy-budget'].push({ type, detail, ...where });
  }
}

try {
  // A small pool of pages in one browser: each takes the next state x locale x theme.
  const jobs = states.flatMap((state) => locales.flatMap((locale) => themes.map((theme) => ({ state, locale, theme }))));
  const workers = Math.max(1, Math.min(Number(process.env.AUDIT_WORKERS ?? 3), jobs.length));
  const warm = await openPage(browser.browser, { width: 375, height: FOLD, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  if (states.some((state) => state.scenario)) fixtures = await loadLessonFixtures(warm, locales);
  await warm.send('Page.close').catch(() => {});
  let next = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    // Each worker has its own window (a hidden page gets no frames) and its own storage (it signs in as someone else).
    const page = await openPage(browser.browser, { width: 375, height: FOLD, dark: false, newWindow: true, isolated: true });
    page.core = null;
    await installSyntheticCore(page, origin, { unknownRequests });
    while (next < jobs.length) {
      const { state, locale, theme } = jobs[next++];
      const stateWidths = widths.filter((w) => !state.widths || state.widths.includes(w));
      // One retry, with nothing from the failed attempt kept: a dev server that hot-reloads
      // mid-measurement (a file saved during a run) navigates the page under the driver.
      for (let attempt = 1; ; attempt++) {
        const sink = { rows: { 'text-fit': [], proportion: [], 'copy-budget': [] }, configurations: { 'text-fit': 0, proportion: 0, 'copy-budget': 0 } };
        page.errors.length = 0;
        try {
          if (state.open) {
            for (const [index, width] of stateWidths.entries()) { await load(page, state, locale, theme, width); await measure(page, state, locale, theme, width, index === 0, sink); }
          } else {
            await load(page, state, locale, theme, stateWidths[0]);
            for (const [index, width] of stateWidths.entries()) await measure(page, state, locale, theme, width, index === 0, sink);
          }
        } catch (error) {
          if (attempt >= 2 || /identical markup|asked for|never became ready|fonts did not load/.test(error.message)) throw error;
          console.log(`
  [retry] ${state.id} ${locale} ${theme}: ${error.message}`);
          continue;
        }
        for (const audit of AUDITS) { rows[audit].push(...sink.rows[audit]); configurations[audit] += sink.configurations[audit]; }
        break;
      }
      for (const error of page.errors) jsErrors.push({ state: state.id, locale, theme, error });
      process.stdout.write('.');
    }
  }));

  process.stdout.write('\n');
  for (const audit of active) {
    const groups = aggregate(rows[audit]);
    writeFileSync(join(output, `${audit}.json`), JSON.stringify({
      audit, origin, date: new Date().toISOString(), states: states.map((s) => s.id), locales, themes, widths,
      configurations: configurations[audit], findings: rows[audit].length, groups, jsErrors,
      authenticated: states.filter((s) => s.scenario).map((s) => ({ state: s.id, population: SCENARIOS[s.scenario].population })),
      unansweredCoreRequests: [...unknownRequests].sort(),
    }, null, 1));
    const matrix = audit === 'text-fit' ? 'x normal/+40% text x normal/WCAG 1.4.12 spacing' : 'x normal text';
    console.log(`\n${audit.toUpperCase()}: ${configurations[audit]} configurations (${states.length} states x ${locales.length} locales x ${themes.length} themes x up to ${widths.length} widths ${matrix})`);
    if (!groups.length) console.log('NO ISSUES FOUND');
    for (const group of groups.slice(0, 40)) {
      const e = group.example;
      console.log(`${String(group.count).padStart(5)}x  ${group.key}\n         e.g. ${e.state} ${e.locale} ${e.theme} ${e.width}px${'stress' in e ? ` stress=${e.stress} spacing=${e.spacing}` : ''}`);
    }
    if (groups.length) exitCode = 1;
  }
  console.log(`\nJS errors: ${jsErrors.length ? JSON.stringify(jsErrors.slice(0, 5)) : 'none'}`);
  if (jsErrors.length) exitCode = 1;
  if (unknownRequests.size) console.log(`Synthetic Core answered with an empty envelope: ${[...unknownRequests].sort().join('; ')}`);
  console.log(`Reports: ${output}`);
} catch (error) {
  console.error(`\nSetup error: ${error.message}`);
  exitCode = 2;
} finally {
  browser.child.kill();
  await wait(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
process.exit(exitCode);
