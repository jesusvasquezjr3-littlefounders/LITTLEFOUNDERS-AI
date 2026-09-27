import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript } from './audits/synthetic-core.mjs';

/*
 * W2M.1: the one Mentor stage (Frontend Bible 08 §7) in real Chrome, rendering
 * the real models on the real Dioramas (the renderer's software GL path; no
 * GPU). Nothing leaves the machine: the preview entry needs no Core, and the
 * lesson route is answered by the synthetic Core (scripts/audits/synthetic-core.mjs).
 *
 *   REBUILD_URL=http://localhost:5430 node scripts/verify-mentor-stage.mjs
 *
 * Families (MENTOR_STAGE_FAMILIES=stage,states,modes,lesson,performance):
 *   stage        the full-size stage in the Mentor screen's stage region, 3 locales x 2 modes x
 *                320/375/768/1280 px x normal and 140% text: the stage is the dominant area (58% of
 *                the height on a phone, half on a tablet, 7 of 12 columns on a desktop) and never
 *                smaller than the response area; the live model is on screen; its accessible name is
 *                the character's name and the state in the page's language; nothing in it takes
 *                keyboard focus; no horizontal overflow; 0 axe violations in <main>.
 *   states       every state x every character: the catalogue pose the state table names reaches the
 *                page, a celebration without a D7 milestone shows idle, each closing script its gesture.
 *   modes        reduced motion (the same 3D, poses held, no idle loop claimed), low power, no WebGL
 *                and data saver (a still of the same character, never a stand-in), per locale and mode.
 *   lesson       the compact size of the same component on the REAL lesson route, for a child 6-9,
 *                a child 10-12, an independent teen and an adult: decorative, the register's band
 *                height on a phone (at most 30% / 25% / 15% of 740 px), the 4-of-12 side column on a
 *                wide container, the first answer control inside the 375 x 740 first view.
 *   performance  first render against the 2.5 s budget and the frame rate against the 30 fps floor
 *                (or the still fallback the stage takes when a device cannot hold it), per character.
 *
 * Reports and screenshots: audit-results/mentor-stage/<families>/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5430';
const FAMILIES = (process.env.MENTOR_STAGE_FAMILIES ?? 'stage,states,modes,lesson,performance').split(',');
// One folder per family set, so a narrowed run never deletes another run's evidence.
const out = resolve('../audit-results/mentor-stage', FAMILIES.join('-'));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
const THEMES = ['light', 'dark'];
const WIDTHS = [320, 375, 768, 1280];
const CHARACTERS = ['dina', 'liruf', 'rho', 'zara'];
const NAMES = { rho: 'Dr. Rho', zara: 'Zara', liruf: 'Liruf', dina: 'Dina' };
const STATES = ['idle', 'listening', 'thinking', 'speaking', 'demonstrating', 'encouraging', 'celebrating', 'closing', 'acknowledging'];
const copy = Object.fromEntries(LOCALES.map((locale) => [locale, JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-mentor.json`), 'utf8')).mentorStage]));
const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');

/* Device conditions, applied before any page script by query flag (the renderer's probe runs once per load). */
const DEVICE = `(() => {
  const q = location.search;
  if (q.includes('lowPower=1')) { Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }); Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }); }
  if (q.includes('saveData=1')) Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: true }) });
  if (q.includes('noWebgl=1')) { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; }
  window.__stageErrors = [];
  addEventListener('error', (e) => window.__stageErrors.push(String(e.error?.stack || e.message)));
  addEventListener('unhandledrejection', (e) => window.__stageErrors.push(String(e.reason?.stack || e.reason)));
})();`;

const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const results = [];
const failures = [];
const unknownRequests = new Set();
let page;

async function waitFor(expression, what, tries = 400) {
  for (let n = 0; n < tries; n++) {
    try { if (await page.evaluate(`!!(${expression})`)) return; } catch (error) { if (!/context|navigat/i.test(String(error))) throw error; }
    await sleep(50);
  }
  throw new Error(`Timed out: ${what}`);
}

async function setView({ width, height = 740, theme, reduced = false }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
  ] });
}

async function openStage(query, { locale, theme }) {
  page.core = null;
  const url = `${origin}/rebuild.html?${new URLSearchParams({ locale, theme, screen: 'mentor-stage', ...query })}`;
  await page.send('Page.navigate', { url });
  // Generous: the speed of the first render is the performance family's to measure, not every check's.
  await waitFor(`location.href === ${JSON.stringify(url)} && document.querySelector('.lf-mentor-stage')?.dataset.ready === 'true'`, `stage ready at ${url}`, 1200);
  return url;
}

/*
 * The character is on screen: the live model with its still gone, or, on a device that cannot hold
 * the 30 fps floor (this harness renders in software on a shared CPU), the still fallback the stage
 * takes for exactly that (08 §7). Either is the stage working; which one is recorded.
 */
const ON_SCREEN = (selector) => `(() => { const s = document.querySelector(${JSON.stringify(selector)}); if (!s || s.dataset.ready !== 'true') return false;
  if (s.dataset.renderMode === 'still') return s.dataset.fallback === 'frame-rate' && s.querySelector('.lf-mentor-stage-still')?.naturalWidth > 0;
  return !!s.querySelector('canvas') && !s.querySelector('.lf-mentor-stage-still'); })()`;

async function shot(name, clip) {
  const image = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  writeFileSync(join(out, `${name}.png`), Buffer.from(image.data, 'base64'));
}

async function stageState() {
  return page.evaluate(`(() => {
    const s = document.querySelector('.lf-mentor-stage');
    const r = s.getBoundingClientRect();
    const panel = document.querySelector('.lf-mentor-layout-panel')?.getBoundingClientRect() ?? null;
    const focusable = s.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable]').length;
    const still = s.querySelector('.lf-mentor-stage-still');
    return {
      data: { ...s.dataset }, role: s.getAttribute('role'), label: s.getAttribute('aria-label'), hidden: s.getAttribute('aria-hidden'),
      rect: { x: r.x, y: r.y, width: r.width, height: r.height }, panel: panel && { width: panel.width, height: panel.height },
      canvas: !!s.querySelector('canvas'), still: still ? { src: still.getAttribute('src'), loaded: still.complete && still.naturalWidth > 0, alt: still.getAttribute('alt') } : null,
      focusable, overflow: document.documentElement.scrollWidth - innerWidth, viewport: { width: innerWidth, height: innerHeight },
      mains: document.querySelectorAll('main').length, errors: window.__stageErrors ?? [],
    };
  })()`);
}

async function check(family, where, body) {
  page.errors.length = 0;
  page.failedRequests.length = 0;
  try {
    const detail = await body();
    assert.deepEqual(page.errors, [], 'console errors');
    assert.deepEqual(page.failedRequests, [], 'failed requests');
    results.push({ family, where, ok: true, ...(detail ? { detail } : {}) });
    process.stdout.write('.');
  } catch (error) {
    // What the stage was doing when the check failed, so a timeout says why.
    const stage = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-stage'); return s ? { ...s.dataset, canvas: !!s.querySelector('canvas'),
      still: s.querySelector('.lf-mentor-stage-still')?.getAttribute('src') ?? null, errors: window.__stageErrors } : { url: location.href, body: document.body?.innerText.slice(0, 200) }; })()`).catch(() => null);
    error = new Error(`${error.message ?? error} | stage: ${JSON.stringify(stage)}`);
    failures.push({ family, where, error: String(error.message ?? error) });
    results.push({ family, where, ok: false, error: String(error.message ?? error) });
    process.stdout.write('F');
  }
}

try {
  page = await openPage(browser.browser, { width: 375, height: 740, dark: false, newWindow: true, isolated: true });
  if (!await warmDevServer(page, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: DEVICE });
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests });

  if (FAMILIES.includes('stage')) {
    let n = 0;
    for (const locale of LOCALES) for (const theme of THEMES) for (const width of WIDTHS) for (const text of [100, 140]) {
      const character = CHARACTERS[n % 4];
      const state = STATES[n % STATES.length] === 'celebrating' ? 'listening' : STATES[n % STATES.length];
      n += 1;
      const where = `${locale} ${theme} ${width}px text ${text}% ${character} ${state}`;
      await check('stage', where, async () => {
        const height = width >= 1024 ? 800 : width >= 600 ? 1024 : 740;
        await setView({ width, height, theme });
        await openStage({ age: '6-9', character, state }, { locale, theme });
        if (text !== 100) await page.evaluate(`document.documentElement.style.fontSize = '${text}%'`);
        await waitFor(ON_SCREEN('.lf-mentor-stage'), `${where}: the character on screen`, 1200);
        const s = await stageState();
        assert.equal(s.mains, 1, 'one <main>');
        assert.ok(s.data.renderMode === 'live' ? s.canvas : s.data.fallback === 'frame-rate', 'the live model, or its frame-rate still');
        assert.equal(s.role, 'img');
        assert.equal(s.label, `${NAMES[character]}, ${copy[locale].states[state]}`, 'accessible name: name and state, in the page language');
        assert.equal(s.focusable, 0, 'nothing inside the stage takes focus');
        assert.ok(s.overflow <= 1, `horizontal overflow ${s.overflow}px`);
        const { viewport: v, rect: r, panel: p } = s;
        if (width < 600) assert.ok(Math.abs(r.height / v.height - 0.58) < 0.02 && Math.abs(r.width - v.width) <= 1, `phone: stage ${r.width}x${r.height} of ${v.width}x${v.height}`);
        else if (width < 1024) assert.ok(Math.abs(r.height / v.height - 0.5) < 0.02 && Math.abs(r.width - v.width) <= 1, `tablet: stage ${r.width}x${r.height}`);
        else assert.ok(Math.abs(r.width - v.width * 7 / 12) <= 2 && Math.abs(r.height - v.height) <= 1, `desktop: stage ${r.width}x${r.height}`);
        assert.ok(width < 1024 ? r.height >= p.height : r.width >= p.width, 'the stage is never smaller than the response area');
        // Keyboard: no Tab stop lands inside the stage.
        await page.evaluate('document.activeElement?.blur?.()');
        for (let i = 0; i < 4; i++) {
          await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
          await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
          assert.ok(!await page.evaluate("!!document.activeElement?.closest('.lf-mentor-stage')"), 'Tab reached inside the stage');
        }
        await page.evaluate(axeSource);
        const axe = await page.evaluate("axe.run(document.querySelector('main'), { resultTypes: ['violations'] }).then((r) => r.violations.map((v) => v.id + ': ' + v.nodes.length))");
        assert.deepEqual(axe, [], 'axe violations');
        if (text === 100 && ((width === 375 && locale === 'en-US') || (width === 1280 && locale === 'pt-BR'))) await shot(`stage-${locale}-${theme}-${width}`);
        return { firstRenderMs: Number(s.data.firstRenderMs), mode: s.data.renderMode };
      });
    }
  }

  if (FAMILIES.includes('states')) {
    await setView({ width: 375, theme: 'light' });
    const expected = await page.evaluate(`(async () => {
      const m = await import('/src/rebuild/mentor/stageStates.ts');
      const out = {};
      for (const age of ['6-9', '13-17']) for (const state of ${JSON.stringify(STATES)}) out[age + ':' + state] = m.resolveMentorPose({ state, ageBand: age, milestone: 'badge-earned' }).pose.id;
      for (const closing of m.CLOSING_SCRIPTS) out['closing:' + closing] = m.resolveMentorPose({ state: 'closing', ageBand: '6-9', closing }).pose.id;
      return out;
    })()`);
    for (const age of ['6-9', '13-17']) for (const character of CHARACTERS) for (const state of STATES) {
      const where = `${age} ${character} ${state}`;
      await check('states', where, async () => {
        await openStage({ age, character, state, ...(state === 'celebrating' ? { milestone: 'badge-earned' } : {}) }, { locale: 'en-US', theme: 'light' });
        const s = await stageState();
        assert.equal(s.data.mentorState, state);
        assert.equal(s.data.mentorPose, expected[`${age}:${state}`]);
        assert.equal(s.data.mentorCharacter, character);
        assert.equal(s.label, `${NAMES[character]}, ${copy['en-US'].states[state]}`);
        assert.ok(s.data.renderMode === 'live' ? s.canvas : s.data.fallback === 'frame-rate', 'the live model, or its frame-rate still');
      });
    }
    await check('states', 'celebration without a milestone', async () => {
      await openStage({ age: '6-9', character: 'zara', state: 'celebrating' }, { locale: 'es-MX', theme: 'dark' });
      const s = await stageState();
      assert.equal(s.data.mentorState, 'idle');
      assert.equal(s.data.mentorRequestedState, 'celebrating');
      assert.notEqual(s.data.mentorAction, 'celebrate');
      assert.equal(s.label, `Zara, ${copy['es-MX'].states.idle}`);
    });
    for (const closing of ['completed', 'interrupted', 'learner_left', 'safety_stop']) {
      await check('states', `closing ${closing}`, async () => {
        await openStage({ age: '6-9', character: 'rho', state: 'closing', closing }, { locale: 'pt-BR', theme: 'light' });
        assert.equal((await stageState()).data.mentorPose, expected[`closing:${closing}`]);
      });
    }
  }

  if (FAMILIES.includes('modes')) {
    for (const locale of LOCALES) for (const theme of THEMES) {
      await check('modes', `${locale} ${theme} reduced motion`, async () => {
        await setView({ width: 375, theme, reduced: true });
        await openStage({ age: '6-9', character: 'zara', state: 'demonstrating' }, { locale, theme });
        const s = await stageState();
        assert.ok(s.data.renderMode === 'held' ? s.canvas && s.data.fallback === undefined : s.data.fallback === 'frame-rate',
          'reduced motion holds poses in the same 3D (or takes the frame-rate still)');
        assert.equal(s.data.idleMotion, undefined, 'no idle loop claimed');
        if (locale === 'en-US') await shot(`held-${theme}`);
      });
      for (const [flag, fallback] of [['lowPower', 'low-power'], ['noWebgl', 'no-webgl'], ['saveData', 'data-saver']]) {
        await check('modes', `${locale} ${theme} ${fallback}`, async () => {
          await setView({ width: 375, theme });
          await openStage({ age: '10-12', character: 'liruf', state: 'listening', [flag]: '1' }, { locale, theme });
          const s = await stageState();
          assert.equal(s.data.renderMode, 'still');
          assert.equal(s.data.fallback, fallback);
          assert.ok(!s.canvas, 'the renderer is not loaded');
          assert.ok(s.still?.loaded, 'the still loaded');
          assert.equal(s.still.src, `/rebuild/mentor-chooser/liruf-${theme}.png`, 'a render of the same character on its Diorama, in this mode (W2M.3)');
          assert.equal(s.still.alt, '');
          assert.equal(s.data.stillPose, 'ambient.idle', 'the stage says which pose the still shows');
          assert.equal(s.label, `Liruf, ${copy[locale].states.listening}`);
          if (locale === 'en-US' && flag === 'lowPower') await shot(`still-${theme}`);
        });
      }
    }
  }

  if (FAMILIES.includes('lesson')) {
    // Each band's own allocation document (the rebuilt lesson reads the presence of the document's band).
    const documents = await page.evaluate(`(async () => {
      const allocation = await import('/src/rebuild/learning/AllocationBoard.tsx');
      const out = {};
      for (const locale of ${JSON.stringify(LOCALES)}) for (const band of ['6-9', '10-12', '13-17', 'adult']) out[locale + ':' + band] = allocation.allocationPilotDocument(locale, band);
      return JSON.parse(JSON.stringify(out));
    })()`);
    const populations = [
      ['mentor-compact-6-9', 110, 0.3], ['mentor-compact-10-12', 96, 0.25], ['mentor-compact-13-17', 80, 0.15], ['mentor-compact-adult', 80, 0.15],
    ];
    const only = process.env.MENTOR_STAGE_SCENARIOS?.split(',');
    for (const [scenario, bandPx, cap] of populations.filter(([name]) => !only || only.includes(name))) for (const locale of LOCALES) for (const theme of THEMES) for (const width of WIDTHS) {
      const where = `${scenario} ${locale} ${theme} ${width}px`;
      await check('lesson', where, async () => {
        const spec = SCENARIOS[scenario];
        await setView({ width, height: 740, theme });
        if (await page.evaluate('location.origin').catch(() => '') !== origin) {
          await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
          await waitFor(`location.origin === ${JSON.stringify(origin)}`, 'origin');
        }
        page.core = { scenario, locale, theme, fixtures: { [locale]: { allocation: documents[`${locale}:${spec.ageBand}`] } } };
        await page.evaluate(sessionStorageScript({ guest: spec.guest, locale, theme }));
        await page.send('Page.navigate', { url: `${origin}/learn/lesson/verify-stage?lng=${locale}` });
        await waitFor(`document.documentElement.lang === ${JSON.stringify(locale)} && ${ON_SCREEN('.lf-mentor-band')}`, `${where}: compact stage on screen`, 1200);
        const s = await page.evaluate(`(() => {
          const band = document.querySelector('.lf-mentor-band'), b = band.getBoundingClientRect();
          const question = document.querySelector('.lf-learning-intro')?.getBoundingClientRect();
          const control = document.querySelector('.lf-learning-control')?.getBoundingClientRect();
          return { data: { ...band.dataset }, hidden: band.getAttribute('aria-hidden'), role: band.getAttribute('role'), canvas: !!band.querySelector('canvas'),
            band: { x: b.x, y: b.y, width: b.width, height: b.height }, question: question && { x: question.x, y: question.y },
            control: control && { y: control.y, bottom: control.bottom }, overflow: document.documentElement.scrollWidth - innerWidth,
            focusable: band.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])').length, errors: window.__stageErrors };
        })()`);
        assert.equal(s.data.mentorStage, 'compact');
        assert.equal(s.data.mentorCharacter, spec.mentorStage.character);
        assert.equal(s.data.mentorScene, spec.mentorStage.scene);
        assert.ok(s.data.renderMode === 'live' ? s.canvas : s.data.fallback === 'frame-rate', 'the live model, or its frame-rate still');
        assert.equal(s.hidden, 'true', 'decorative in a lesson');
        assert.equal(s.role, null);
        assert.equal(s.focusable, 0);
        assert.ok(s.overflow <= 1, `horizontal overflow ${s.overflow}px`);
        assert.ok(['idle', 'acknowledging', 'encouraging'].includes(s.data.mentorState));
        if (width < 640) {
          assert.equal(Math.round(s.band.height), bandPx, 'the register band height');
          assert.ok(s.band.height <= 740 * cap, `band within ${cap * 100}% of the height`);
          assert.ok(s.control && s.control.y < 740, 'the first answer control starts inside the first view');
        } else {
          assert.ok(s.question && s.band.x < s.question.x, 'the stage is the side column left of the question');
          assert.ok(Math.abs(s.band.width - s.band.height) <= 1, 'square side column');
        }
        if ((width === 375 && theme === 'light' && locale === 'en-US') || (width === 375 && theme === 'dark' && locale === 'es-MX') || (width === 1280 && locale === 'pt-BR' && theme === 'dark')) {
          await shot(`lesson-${scenario}-${locale}-${theme}-${width}`);
        }
        return { band: s.band.height, state: s.data.mentorState, presence: s.data.mentorPresence, mode: s.data.renderMode };
      });
    }
    page.core = null;
  }

  if (FAMILIES.includes('performance')) {
    /*
     * The budgets are for a mid-range phone (08 §7). This harness renders with Chrome's software GL on a
     * shared CPU, which is not that device, so the numbers are recorded as observations; the behaviour is
     * asserted: a stage that cannot hold 30 fps at the renderer's lowest tier falls back to its still.
     * MENTOR_STAGE_STRICT_BUDGET=1 also asserts the 2.5 s first render (for a quiet, capable machine).
     */
    /*
     * W2M.3 (08 §10 evidence): each character is measured in three profiles on this machine: `warm` (the
     * models already in the HTTP cache), `cold` (the cache disabled: every model, texture and chunk fetched
     * again from the local dev server) and `phone` (warm, with the CPU throttled 4x, Chrome's usual stand-in
     * for a mid-range phone; still software GL). MENTOR_STAGE_PROFILES narrows them.
     */
    const PROFILES = (process.env.MENTOR_STAGE_PROFILES ?? 'warm,cold,phone').split(',');
    for (const profile of PROFILES) for (const character of CHARACTERS) {
      await check('performance', `${character} 375x740 ${profile}`, async () => {
        await setView({ width: 375, theme: 'light' });
        await page.send('Network.enable').catch(() => {});
        await page.send('Network.setCacheDisabled', { cacheDisabled: profile === 'cold' });
        await page.send('Emulation.setCPUThrottlingRate', { rate: profile === 'phone' ? 4 : 1 });
        try {
          await openStage({ age: '6-9', character, state: 'idle' }, { locale: 'en-US', theme: 'light' });
          const firstRenderMs = Number(await page.evaluate("document.querySelector('.lf-mentor-stage').dataset.firstRenderMs"));
          const liveFirst = await page.evaluate("document.querySelector('.lf-mentor-stage').dataset.renderMode");
          await sleep(1500);
          const fps = await page.evaluate('new Promise((done) => { let frames = 0; const start = performance.now(); const tick = (now) => { frames++; if (now - start < 3000) requestAnimationFrame(tick); else done(Math.round(frames * 1000 / (now - start))); }; requestAnimationFrame(tick); })');
          if (fps < 30) await waitFor("document.querySelector('.lf-mentor-stage')?.dataset.renderMode === 'still' && document.querySelector('.lf-mentor-stage-still')?.naturalWidth > 0", `${character}: ${fps} fps, the stage never fell back to its still`, 600);
          const after = await stageState();
          if (process.env.MENTOR_STAGE_STRICT_BUDGET === '1') assert.ok(firstRenderMs <= 2500, `first render ${firstRenderMs} ms over the 2.5 s budget`);
          assert.ok(fps >= 30 || (after.data.renderMode === 'still' && after.data.fallback === 'frame-rate' && after.still?.loaded), `${fps} fps and ${after.data.renderMode}`);
          return { profile, firstRenderMs, withinBudget: firstRenderMs <= 2500, firstMode: liveFirst, fps, mode: after.data.renderMode, fallback: after.data.fallback ?? null };
        } finally {
          await page.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
          await page.send('Network.setCacheDisabled', { cacheDisabled: false }).catch(() => {});
        }
      });
    }
  }
} finally {
  await page?.send('Browser.close').catch(() => {});
  browser.child.kill();
}

const summary = Object.fromEntries(FAMILIES.map((family) => [family, {
  configurations: results.filter((r) => r.family === family).length, failures: failures.filter((f) => f.family === family).length,
}]));
writeFileSync(join(out, 'report.json'), JSON.stringify({ origin, summary, failures, unknownRequests: [...unknownRequests], results }, null, 2));
console.log(`\n${JSON.stringify(summary)}`);
for (const failure of failures) console.log(`FAIL ${failure.family} ${failure.where}: ${failure.error}`);
for (const row of results.filter((r) => r.family === 'performance' && r.detail)) console.log(`performance ${row.where}: ${JSON.stringify(row.detail)}`);
if (unknownRequests.size) console.log(`Synthetic Core answered with an empty envelope: ${[...unknownRequests].join('; ')}`);
console.log(`Report: ${join(out, 'report.json')}`);
if (failures.length) process.exitCode = 1;
