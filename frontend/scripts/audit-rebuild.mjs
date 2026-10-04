import { trackAuditedAssets, waitForAuditedAssets } from './audits/media.mjs';
import { mkdirSync, mkdtempSync, rmSync, statfsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installAudit } from './audits/in-page.mjs';
import { aggregate, copyFindings, FOLD, proportionFindings } from './audits/rules.mjs';
import { extraRoutes, LOCALES, shardStates, STATES, stateUrl, THEMES, WIDTHS } from './audits/states.mjs';
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
 * The proportion pass also carries the teaching-board rules of Bible 05 §8
 * (audits/in-page.mjs `boards()`, audits/rules.mjs `boardFindings`): board
 * labels, mark and axis contrast in both modes, no reserved hue on a series,
 * 64 px draggables with a tap alternative, and no board animation outside the
 * allowed state change. The scorer parity half of 05 §8 is the node gate
 * `agent/tools/sync-v2-visual-scorer.mjs --check` in `npm run spec:check`.
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
 * Needs a Vite dev server or the isolated compiled audit preview:
 *   REBUILD_URL=http://localhost:5310 npm run audit:rebuild
 *   node scripts/audits/compiled-preview.mjs --port 5181
 *   REBUILD_URL=http://127.0.0.1:5181 AUDIT_COMPILED=1 npm run audit:rebuild
 * Compiled mode changes transport only; states, widths, fixture functions and assertions are identical.
 * Env filters for a debugging run (recorded evidence always uses the full set):
 *   AUDIT_STATES=system,lesson@6-9 (ids or id prefixes ending in *), AUDIT_LOCALES,
 *   AUDIT_THEMES, AUDIT_WIDTHS, AUDIT_ROUTES=/some/route (extra real-app routes),
 *   AUDIT_WORKERS (parallel pages, default 3), AUDIT_READY_MS (how long a state may take to become ready,
 *   default 15000; raise it only on a saturated shared machine, and say so in the evidence), AUDIT_REPORT_DIR.
 * A state that does not become ready (or whose last press opens nothing) is measured once more, from the start, on a
 * fresh page, and the retry is logged; if the second attempt fails too the run stops with a setup error. A browser
 * that went away is never retried: the error says so, with the free disk space Chrome had.
 * Split run (the full set, never a trimmed one): AUDIT_SHARD=k/n measures the k-th of n round-robin shards
 * of the state list; `node scripts/audits/merge-shards.mjs <dir>` merges the n reports and fails unless
 * every state was measured exactly once over the full locale, theme and width matrix.
 * Reports: audit-results/rebuild-audits/<audit>.json. Exit 0 clean, 1 findings, 2 setup error.
 * The gate that starts Vite and runs this (CI, release readiness): scripts/rebuild-audit-gate.mjs.
 */
const AUDITS = ['text-fit', 'proportion', 'copy-budget'];
const requested = process.argv[2] ?? 'all';
if (requested !== 'all' && !AUDITS.includes(requested)) { console.error(`Usage: node scripts/audit-rebuild.mjs [${AUDITS.join('|')}|all]`); process.exit(2); }
const active = new Set(requested === 'all' ? AUDITS : [requested]);
const origin = process.env.REBUILD_URL ?? 'http://localhost:5310';
const list = (name, fallback) => process.env[name]?.split(',').map((v) => v.trim()).filter(Boolean) ?? fallback;
const locales = list('AUDIT_LOCALES', LOCALES), themes = list('AUDIT_THEMES', THEMES), widths = list('AUDIT_WIDTHS', WIDTHS.map(String)).map(Number);
const filters = list('AUDIT_STATES', null);
let states;
try {
  states = shardStates([...STATES, ...extraRoutes()].filter((state) => !filters || filters.some((f) => (f.endsWith('*') ? state.id.startsWith(f.slice(0, -1)) : state.id === f))));
} catch (error) { console.error(error.message); process.exit(2); }
if (!states.length) { console.error('No state matches AUDIT_STATES and AUDIT_SHARD'); process.exit(2); }
const shard = process.env.AUDIT_SHARD?.trim() || null;
const output = resolve(process.env.AUDIT_REPORT_DIR ?? '../audit-results/rebuild-audits');
mkdirSync(output, { recursive: true });

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
// AUDIT_READY_TRIES (x 50 ms) is the older spelling of AUDIT_READY_MS and still wins when set.
const readyTries = process.env.AUDIT_READY_TRIES ? Number(process.env.AUDIT_READY_TRIES) : Math.max(300, Math.ceil(Number(process.env.AUDIT_READY_MS ?? 15000) / 50));
const rows = { 'text-fit': [], proportion: [], 'copy-budget': [] };
const configurations = { 'text-fit': 0, proportion: 0, 'copy-budget': 0 };
const jsErrors = [];
const mediaErrors = [];
const signatures = new Map();
const unknownRequests = new Set();
let fixtures = null;
let exitCode = 0;
const profile = mkdtempSync(join(output, 'chrome-'));
const browser = await launchBrowser(profile);
let chromeExit = null;
browser.child.on('exit', (code, signal) => { chromeExit = signal ? `signal ${signal}` : `code ${code}`; });

/** Free space where Chrome writes (its profile, next to the reports, and the temp directory), for a setup error. */
function freeDisk() {
  const at = (path) => {
    try { const fs = statfsSync(path); return `${Math.round((Number(fs.bavail) * Number(fs.bsize)) / 2 ** 20)} MB free at ${path}`; } catch { return null; }
  };
  return [...new Set([at(output), at(tmpdir())].filter(Boolean))].join(', ');
}

/** A page of the pool: its own window and storage, every Core request answered by the synthetic Core. */
async function workerPage() {
  // Each worker has its own window (a hidden page gets no frames) and its own storage (it signs in as someone else).
  const page = await openPage(browser.browser, { width: 375, height: FOLD, dark: false, newWindow: true, isolated: true });
  page.core = null;
  trackAuditedAssets(page, origin);
  await installSyntheticCore(page, origin, { unknownRequests });
  return page;
}

async function onOrigin(page) {
  // Stop the previous app before replacing its session and locale. Its effects and
  // in-flight requests must not write into the next state's storage or Core fixture.
  await waitForAuditedAssets(page, { timeoutMs: readyTries * 50, label: 'before neutral navigation' });
  await page.send('Page.stopLoading');
  await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
  const neutral = `location.origin === ${JSON.stringify(origin)} && location.pathname === '/favicon.ico' && document.readyState === 'complete'`;
  for (let n = 0; n < readyTries; n++) {
    if (await page.evaluate(neutral).catch(() => false)) return;
    await wait(50);
  }
  throw new Error('The neutral storage document did not finish loading');
}

async function load(page, state, locale, theme, width) {
  await onOrigin(page);
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: FOLD, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  const url = stateUrl(origin, state, locale, theme);
  if (state.entry === 'app') {
    // The real app reads its session, language and mode from storage: a synthetic session for an
    // authenticated state, none for a session-less route. Core is answered by the synthetic Core.
    const spec = state.scenario ? SCENARIOS[state.scenario] : null;
    // A `signedOut` scenario answers Core for a visitor with no session (a public page that reads Core).
    await page.evaluate(spec && !spec.signedOut ? sessionStorageScript({ guest: spec.guest, locale, theme }) : signedOutStorageScript({ locale, theme }));
    page.core = spec ? { scenario: state.scenario, locale, theme, fixtures } : null;
  } else page.core = null;
  await page.send('Page.navigate', { url });
  if (state.entry === 'app' && state.pushState) {
    // A screen only a router hand-off reaches (router state, never a URL): once the app has mounted, push the
    // address with that state and let the router read it, as a navigate(path, { state }) inside the app does.
    for (let n = 0; n < readyTries && !await page.evaluate("!!document.querySelector('.lf-rebuild')").catch(() => false); n++) await wait(50);
    await page.evaluate(`(() => {
      history.pushState({ usr: ${JSON.stringify(state.pushState.state)}, key: 'audit', idx: (history.state?.idx ?? 0) + 1 }, '', ${JSON.stringify(state.pushState.path)});
      dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    })()`);
  }
  const ready = state.entry === 'app'
    ? `document.readyState === 'complete' && !!document.querySelector('.lf-rebuild') && document.documentElement.lang === ${JSON.stringify(locale)}${(state.readyAll ?? []).map((selector) => ` && !!document.querySelector(${JSON.stringify(selector)})`).join('')}`
    :`location.href === ${JSON.stringify(url)} && !!document.querySelector('.lf-rebuild main, main.lf-rebuild')`;
  let ok = false;
  // AUDIT_READY_MS: how long a state may take to become ready (default 15 s). A loaded machine needs longer;
  // waiting longer never changes what is measured once the state is ready.
  for (let n = 0; n < readyTries && !ok; n++) { await wait(50); ok = await page.evaluate(`!!(${ready})`).catch(() => false); }
  if (!ok) {
    const observed = await page.evaluate(`({ readyState: document.readyState, language: document.documentElement.lang, root: !!document.querySelector('.lf-rebuild'), selectors: ${JSON.stringify(state.readyAll ?? [])}.map(selector => ({ selector, present: !!document.querySelector(selector) })) })`).catch(() => null);
    throw new Error(`${state.id} ${locale} ${theme}: never became ready at ${url}${page.crashed ? ' (its renderer crashed)' : ''}; observed ${JSON.stringify(observed)}`);
  }
  // A hidden page gets no animation frames: every measurement after this would be of a frozen page.
  if (await page.evaluate('document.visibilityState') !== 'visible') throw new Error(`${state.id}: the audit page is hidden`);
  await page.evaluate('document.fonts.ready');
  if (!await page.evaluate("document.fonts.check('600 16px Fredoka') && document.fonts.check('500 16px Nunito')")) throw new Error(`${state.id}: fonts did not load`);
  // The rebuilt root must carry the locale and theme asked for, or the matrix is measuring something else.
  const applied = await page.evaluate(`(() => { const r = document.querySelector('.lf-rebuild'); return { lang: r.getAttribute('lang') || document.documentElement.lang, theme: r.dataset.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light') }; })()`);
  if (applied.lang !== locale || applied.theme !== theme) throw new Error(`${state.id}: asked for ${locale}/${theme}, the page shows ${applied.lang}/${applied.theme}`);
  for (const selector of state.open ?? []) {
    const aim = `(() => {
      const e = document.querySelector(${JSON.stringify(selector)});
      if (!e) throw new Error('Missing ' + ${JSON.stringify(selector)});
      e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2, top = document.elementFromPoint(x, y);
      if (!(e.contains(top) || top?.contains(e))) throw new Error('Occluded: ' + ${JSON.stringify(selector)});
      // CDP input uses the visual viewport; DOM rectangles use the layout viewport.
      return { x: x - (visualViewport?.offsetLeft ?? 0), y: y - (visualViewport?.offsetTop ?? 0), page: document.documentElement.scrollHeight };
    })()`;
    // Pressed only once the target has stopped moving, as a person taps what has settled: panels above it that are
    // still loading grow the page, and a press aimed before such a shift lands on whatever moved under the pointer
    // (on a loaded CI runner the /family panel toggles were missed that way and the closed page was measured).
    let point = await page.evaluate(aim);
    for (let n = 0; n < 40; n++) {
      await wait(150);
      const again = await page.evaluate(aim);
      const still = Math.abs(again.x - point.x) < 1 && Math.abs(again.y - point.y) < 1 && again.page === point.page;
      point = again;
      if (still) break;
    }
    point = { x: point.x, y: point.y };
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await wait(350);
  }
  // A state whose last press opens something that loads (a lazy chunk, a read) names what must be there before it is measured.
  if (state.openReady) {
    let opened = false;
    for (let n = 0; n < readyTries && !opened; n++) { await wait(50); opened = await page.evaluate(`!!document.querySelector(${JSON.stringify(state.openReady)})`).catch(() => false); }
    if (!opened) throw new Error(`${state.id} ${locale} ${theme}: ${state.openReady} never appeared after the presses${page.crashed ? ' (its renderer crashed)' : ''}`);
  }
  await waitForAuditedAssets(page, { timeoutMs: readyTries * 50, label: `${state.id} ${locale} ${theme}` });
  await page.evaluate(`(${installAudit})()`);
  // A milestone celebration measures on its settled frame (it settles within 1.2 s by contract; 07 §5).
  for (let n = 0; n < 60 && await page.evaluate("!!document.querySelector('[data-celebration=\"playing\"]')"); n++) await wait(50);
  await settle(page);
}

async function settle(page) {
  await waitForAuditedAssets(page, { timeoutMs: readyTries * 50 });
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
    await settle(page);
    sink.configurations['text-fit']++;
    for (const [type, detail] of found) sink.rows['text-fit'].push({ type, detail, ...where, stress, spacing });
  }
  await settle(page);
  if (active.has('proportion')) {
    const res = await page.evaluate('window.__lfAudit.proportion()');
    // Bible 05 §8: the teaching-board rules, over every .lf-learning-board of the state (both modes by the matrix).
    res.board = await page.evaluate('window.__lfAudit.boards()');
    // 02 §9.4 / D7 motion budget: read with motion allowed, then back to reduced motion for everything else.
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await settle(page);
    Object.assign(res, await page.evaluate('window.__lfAudit.motion()'));
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    await settle(page);
    sink.configurations.proportion++;
    for (const [type, detail] of proportionFindings(res, state, width)) sink.rows.proportion.push({ type, detail, ...where });
  }
  if (active.has('copy-budget')) {
    const res = await page.evaluate(`window.__lfAudit.copyBudget(${FOLD})`);
    sink.configurations['copy-budget']++;
    if (!res.blocks.length) sink.rows['copy-budget'].push({ type: 'no-text-measured', detail: 'the state rendered no measurable text', ...where });
    const band = state.scenario ? SCENARIOS[state.scenario]?.ageBand : undefined;
    for (const [type, detail] of copyFindings(res, state, locale, { firstView: width === 375, band })) sink.rows['copy-budget'].push({ type, detail, ...where });
  }
}

try {
  // A small pool of pages in one browser: each takes the next state x locale x theme.
  const jobs = states.flatMap((state) => locales.flatMap((locale) => themes.map((theme) => ({ state, locale, theme }))));
  const workers = Math.max(1, Math.min(Number(process.env.AUDIT_WORKERS ?? 3), jobs.length));
  const warm = await openPage(browser.browser, { width: 375, height: FOLD, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  if (states.some((state) => state.scenario)) fixtures = await loadLessonFixtures(warm, locales, { compiled: process.env.AUDIT_COMPILED === '1', origin });
  await warm.send('Page.close').catch(() => {});
  let next = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    let page = await workerPage();
    while (next < jobs.length) {
      const { state, locale, theme } = jobs[next++];
      const stateWidths = widths.filter((w) => !state.widths || state.widths.includes(w));
      // One retry, with nothing from the failed attempt kept: a dev server that hot-reloads
      // mid-measurement (a file saved during a run) navigates the page under the driver, and on a
      // loaded machine a renderer can die or stall before the state is ready. A state that fails
      // twice is a setup error: the run stops, nothing is marked measured.
      for (let attempt = 1; ; attempt++) {
        const sink = { rows: { 'text-fit': [], proportion: [], 'copy-budget': [] }, configurations: { 'text-fit': 0, proportion: 0, 'copy-budget': 0 } };
        page.errors.length = 0;
        page.assetFailures.length = 0;
        try {
          if (state.open) {
            for (const [index, width] of stateWidths.entries()) { await load(page, state, locale, theme, width); await measure(page, state, locale, theme, width, index === 0, sink); }
          } else {
            await load(page, state, locale, theme, stateWidths[0]);
            for (const [index, width] of stateWidths.entries()) await measure(page, state, locale, theme, width, index === 0, sink);
          }
        } catch (error) {
          if (attempt >= 2 || page.closed || /identical markup|asked for|fonts did not load/.test(error.message)) throw error;
          // Not ready: the second attempt starts over on a fresh page (a new renderer), never on the one that stalled.
          const fresh = /never became ready|never appeared after the presses/.test(error.message);
          console.log(`
  [retry] ${state.id} ${locale} ${theme}, attempt 2 of 2${fresh ? ' on a fresh page' : ''}: ${error.message}`);
          if (fresh) { await page.close(); page = await workerPage(); }
          continue;
        }
        for (const audit of AUDITS) { rows[audit].push(...sink.rows[audit]); configurations[audit] += sink.configurations[audit]; }
        break;
      }
      await settle(page);
      for (const error of page.errors) jsErrors.push({ state: state.id, locale, theme, error });
      for (const error of page.assetFailures) mediaErrors.push({ state: state.id, locale, theme, error });
      process.stdout.write('.');
    }
    await settle(page);
    await page.close();
  }));

  process.stdout.write('\n');
  for (const audit of active) {
    const groups = aggregate(rows[audit]);
    writeFileSync(join(output, `${audit}.json`), JSON.stringify({
      audit, origin, runtime: process.env.AUDIT_COMPILED === '1' ? 'compiled' : 'dev', date: new Date().toISOString(), shard, filtered: Boolean(filters), states: states.map((s) => s.id), locales, themes, widths,
      configurations: configurations[audit], findings: rows[audit].length, findingsRows: rows[audit], groups, jsErrors, mediaErrors,
      authenticated: states.filter((s) => s.scenario).map((s) => ({ state: s.id, population: SCENARIOS[s.scenario].population })),
      unansweredCoreRequests: [...unknownRequests].sort(),
      // [signature, state] per measured page: merge-shards.mjs repeats the identical-markup check across shards.
      signatures: [...signatures],
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
  console.log(`Media errors: ${mediaErrors.length ? JSON.stringify(mediaErrors.slice(0, 5)) : 'none'}`);
  if (mediaErrors.length) exitCode = 1;
  if (unknownRequests.size) console.log(`Synthetic Core answered with an empty envelope: ${[...unknownRequests].sort().join('; ')}`);
  console.log(`Reports: ${output}`);
} catch (error) {
  console.error(`\nSetup error: ${error.message}`);
  // What the machine looked like when the run stopped: a full disk or a Chrome that exited reads as a state that
  // "never became ready", so both are said here rather than left to be guessed.
  console.error(`  Chrome: ${chromeExit ? `exited (${chromeExit})` : 'running'}; disk: ${freeDisk() || 'unknown'}`);
  exitCode = 2;
} finally {
  browser.child.kill();
  await wait(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
process.exit(exitCode);
