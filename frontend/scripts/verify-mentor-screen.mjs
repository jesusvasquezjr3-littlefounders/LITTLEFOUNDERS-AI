import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript } from './audits/synthetic-core.mjs';

/*
 * W2M.2: the Mentor screen (Frontend Bible 08 §2-§8) on its REAL route, `/tutor`,
 * signed in and answered by the synthetic Core (scripts/audits/synthetic-core.mjs,
 * scenarios in scripts/audits/lanes/mentor.mjs). Oracle's socket is a fake inside
 * the page (`ws://mentor.test`): the harness plays the server's frames and reads
 * what the screen sends. Nothing leaves the machine (OD-23).
 *
 *   REBUILD_URL=http://localhost:5430 node scripts/verify-mentor-screen.mjs
 *
 * Families (MENTOR_SCREEN_FAMILIES=layout,conversation,focus):
 *   layout        a child 6-9 in a family, an independent teen and an adult x 3 locales x 2 modes x
 *                 320/375/768/1280 px x normal and 140% text: one <h1>, the character's name; the stage
 *                 at least 55% of a phone's height, half a tablet's, the left 7 of 12 columns on a desktop,
 *                 never smaller than the response area; no horizontal overflow; every control at least
 *                 48 px; the menu's grown-up line only with a guardian link; the microphone only where
 *                 C.2 allows it; the keyboard path (close, menu, then the response area in the band's
 *                 order) never stops inside the stage; 0 axe violations on the screen.
 *   conversation  per locale and mode, at 375 and 1280 px, with REAL pointer presses (hit-tested): an
 *                 opening starts a session; a turn with a board shows the plate within the budget and
 *                 the board; the hint chip sends the learner's words; an adaptation offer and the
 *                 stop-or-continue offer are answered; the server's closing script shows the closing
 *                 state, and the bond question is answered and recorded.
 *   focus         arriving from Learn by the navigation's Mentor tab moves focus into the Mentor screen.
 *
 * Reports and screenshots: audit-results/mentor-screen/<families>/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5430';
const FAMILIES = (process.env.MENTOR_SCREEN_FAMILIES ?? 'layout,conversation,focus').split(',');
const out = resolve('../audit-results/mentor-screen', FAMILIES.join('-'));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const LOCALES = (process.env.MENTOR_SCREEN_LOCALES ?? 'en-US,es-MX,pt-BR').split(',');
const THEMES = ['light', 'dark'];
const WIDTHS = [320, 375, 768, 1280];
const NAMES = { rho: 'Dr. Rho', zara: 'Zara', liruf: 'Liruf', dina: 'Dina' };
const copy = Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale) => [locale, JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-mentor.json`), 'utf8'))]));
const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');

/* Oracle's socket, played by the harness. Every other WebSocket (Vite's own) is the real one. */
const FAKE_ORACLE = `(() => {
  const Real = window.WebSocket;
  const log = { sent: [], sockets: [] };
  window.__oracle = log;
  class Fake {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    constructor(url) {
      if (!String(url).startsWith('ws://mentor.test')) return new Real(url);
      this.url = url; this.readyState = 0; log.sockets.push(this);
      setTimeout(() => {
        this.readyState = 1; this.onopen?.({});
        this.onmessage?.({ data: JSON.stringify({ type: 'ready', sessionId: 'audit', character: 'dina', companion: null, diorama: 'diorama-a',
          voice: false, microphone: false, intelDegraded: false, locale: 'en-US' }) });
      }, 30);
    }
    send(data) { log.sent.push(JSON.parse(data)); }
    close(code = 1000, reason = '') { if (this.readyState === 3) return; this.readyState = 3; this.onclose?.({ code, reason, wasClean: true }); }
    addEventListener() {}
    removeEventListener() {}
  }
  window.WebSocket = Fake;
  log.push = (message) => log.sockets.at(-1)?.onmessage?.({ data: JSON.stringify(message) });
  log.end = (reason) => { const s = log.sockets.at(-1); if (!s) return; s.readyState = 3; s.onclose?.({ code: 1000, reason, wasClean: true }); };
  window.__errors = [];
  addEventListener('error', (e) => window.__errors.push(String(e.error?.stack || e.message)));
  addEventListener('unhandledrejection', (e) => window.__errors.push(String(e.reason?.stack || e.reason)));
})();`;

const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const results = [];
const failures = [];
const unknownRequests = new Set();
let page;

async function waitFor(expression, what, tries = 1200) {
  for (let n = 0; n < tries; n++) {
    try { if (await page.evaluate(`!!(${expression})`)) return; } catch (error) { if (!/context|navigat/i.test(String(error))) throw error; }
    await sleep(50);
  }
  throw new Error(`Timed out: ${what}`);
}

async function setView({ width, height, theme }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }] });
}

async function shot(name) {
  const image = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, `${name}.png`), Buffer.from(image.data, 'base64'));
}

async function signIn(scenario, locale, theme, path = '/tutor') {
  const spec = SCENARIOS[scenario];
  if (await page.evaluate('location.origin').catch(() => '') !== origin) {
    await page.send('Page.navigate', { url: `${origin}/favicon.ico` });
    await waitFor(`location.origin === ${JSON.stringify(origin)}`, 'origin');
  }
  page.core = { scenario, locale, theme, fixtures: {} };
  await page.evaluate(sessionStorageScript({ guest: spec.guest, locale, theme }));
  await page.send('Page.navigate', { url: `${origin}${path}?lng=${locale}` });
}

/* A real press: the element under the pointer at its centre must be the control itself. */
async function press(selector, what = selector) {
  const point = await page.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; });
    if (!e) return null;
    e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: hit === e || e.contains(hit) };
  })()`);
  assert.ok(point, `missing ${what}`);
  assert.ok(point.hit, `${what} is covered at its centre`);
  for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: 'left', clickCount: 1 });
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
    const state = await page.evaluate(`(() => { const s = document.querySelector('.lf-mentor-screen'); return s ? { ...s.dataset, errors: window.__errors } : { url: location.href, body: document.body?.innerText.slice(0, 200) }; })()`).catch(() => null);
    const message = `${error.message ?? error} | screen: ${JSON.stringify(state)}`;
    failures.push({ family, where, error: message });
    results.push({ family, where, ok: false, error: message });
    process.stdout.write('F');
  }
}

const MEASURE = `(() => {
  const screen = document.querySelector('.lf-mentor-screen');
  const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const controls = [...screen.querySelectorAll('button, a[href], input, textarea, select')].filter(visible);
  const small = controls.filter((c) => { const r = c.getBoundingClientRect(); return c.matches('input, textarea') ? r.height < 48 : Math.min(r.width, r.height) < 47.5; })
    .map((c) => (c.getAttribute('aria-label') || c.textContent || c.tagName).trim().slice(0, 40) + ' ' + Math.round(c.getBoundingClientRect().width) + 'x' + Math.round(c.getBoundingClientRect().height));
  return {
    h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
    mains: document.querySelectorAll('main').length,
    stage: rect(screen.querySelector('.lf-mentor-stage-region')), response: rect(screen.querySelector('.lf-mentor-response')),
    panel: rect(screen.querySelector('.lf-mentor-panel')), viewport: { width: innerWidth, height: innerHeight },
    overflow: document.documentElement.scrollWidth - innerWidth, small,
    mic: !!screen.querySelector('[data-mic]'), notices: [...screen.querySelectorAll('.lf-notice')].map((n) => n.textContent.trim()),
    layout: screen.dataset.layout, band: screen.dataset.ageBand, character: screen.querySelector('.lf-mentor-stage')?.dataset.mentorCharacter,
  };
})()`;

try {
  page = await openPage(browser.browser, { width: 375, height: 740, dark: false, newWindow: true, isolated: true });
  if (!await warmDevServer(page, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE_ORACLE });
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests });

  if (FAMILIES.includes('layout')) {
    const populations = [['mentor-screen-child', true, true], ['mentor-screen-teen', false, false], ['mentor-screen-adult', false, true]];
    for (const [scenario, guardian, micAllowed] of populations) for (const locale of LOCALES) for (const theme of THEMES) {
      const spec = SCENARIOS[scenario];
      const t = copy[locale].mentorScreen;
      let loaded = false;
      for (const width of WIDTHS) for (const text of [100, 140]) {
        const where = `${scenario} ${locale} ${theme} ${width}px text ${text}%`;
        await check('layout', where, async () => {
          const height = width >= 1024 ? 800 : width >= 600 ? 1024 : 740;
          await setView({ width, height, theme });
          if (!loaded) {
            await signIn(scenario, locale, theme);
            await waitFor(`document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector('.lf-mentor-screen[data-phase="openings"]')`, `${where}: openings`);
            loaded = true;
          }
          await page.evaluate(`document.documentElement.style.fontSize = '${text}%'`);
          await sleep(300);
          const m = await page.evaluate(MEASURE);
          assert.deepEqual(m.h1, [NAMES[spec.mentor]], 'one <h1>: the character’s name');
          assert.equal(m.mains, 1, 'one <main>');
          assert.equal(m.character, spec.mentor);
          assert.equal(m.band, spec.ageBand, 'the register Core resolved');
          assert.ok(m.overflow <= 1, `horizontal overflow ${m.overflow}px`);
          assert.deepEqual(m.small, [], 'controls under 48 px');
          const { stage, response, panel, viewport: v } = m;
          if (width < 600) assert.ok(stage.height / v.height >= 0.549, `phone: stage ${Math.round(stage.height)} of ${v.height}`);
          else if (width < 1024) assert.ok(stage.height / v.height >= 0.499, `tablet: stage ${Math.round(stage.height)} of ${v.height}`);
          else assert.ok(Math.abs(stage.width - v.width * 7 / 12) <= 2 && Math.abs(panel.width - v.width * 5 / 12) <= 2, `desktop: stage ${stage.width} and panel ${panel.width}`);
          assert.ok(width < 1024 ? stage.height >= response.height : stage.width >= panel.width, 'the stage is never smaller than the response area');
          // C.2: the microphone only where Core allows it; a policy refusal is said, not hidden.
          assert.equal(m.mic, micAllowed, micAllowed ? 'the microphone is offered' : 'no microphone for this learner');
          if (!micAllowed) assert.ok(m.notices.includes(t.micBlocked.POLICY_BLOCKED), 'the policy line');
          if (text === 100 && width === 375 || text === 100 && width === 1280) {
            // The menu: the grown-up line only for a child in a family (08 §4).
            await press('.lf-mentor-top [aria-haspopup="menu"]', 'the menu');
            await waitFor("document.querySelector('[role=menu]')", 'menu open', 200);
            const items = await page.evaluate("[...document.querySelectorAll('[role=menuitem]')].map((i) => i.textContent.trim())");
            assert.deepEqual(items, [t.changeMentor, t.transcript, ...(guardian ? [t.grownUp] : [])]);
            await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
            await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
            await waitFor("!document.querySelector('[role=menu]')", 'menu closed', 200);
            // The keyboard path: close, the menu, then the response area; never a stop inside the stage.
            // Tab from the start of the screen: focus its root for a moment (a blur keeps Chrome's sequential starting point).
            await page.evaluate("(() => { const s = document.querySelector('.lf-mentor-screen'); s.setAttribute('tabindex', '-1'); s.focus(); s.removeAttribute('tabindex'); window.scrollTo(0, 0); })()");
            const stops = [];
            for (let i = 0; i < 5; i++) {
              await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
              await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
              stops.push(await page.evaluate("(() => { const a = document.activeElement; return { inStage: !!a.closest('.lf-mentor-stage'), label: a.getAttribute('aria-label') || a.textContent.trim(), tag: a.tagName, region: a.closest('.lf-mentor-top') ? 'top' : a.closest('.lf-mentor-response') ? 'response' : 'other' }; })()"));
            }
            assert.ok(stops.every((s) => !s.inStage), 'a Tab stop inside the stage');
            assert.deepEqual(stops.slice(0, 2).map((s) => s.label), [t.close, t.menu], 'close, then the menu');
            assert.equal(stops[2].region, 'response', 'then the response area');
            const firstResponse = stops[2].tag;
            if (spec.ageBand === '13-17' || spec.ageBand === 'adult') assert.equal(firstResponse, 'INPUT', 'the field leads for 13 and older');
            else assert.equal(firstResponse, 'BUTTON', 'the chips lead for 6-9');
            await page.evaluate(axeSource);
            const axe = await page.evaluate("axe.run(document.querySelector('.lf-mentor-screen'), { resultTypes: ['violations'] }).then((r) => r.violations.map((v) => v.id + ': ' + v.nodes.length))");
            assert.deepEqual(axe, [], 'axe violations');
            await shot(`layout-${scenario}-${locale}-${theme}-${width}`);
          }
          return { stage: Math.round(width < 1024 ? stage.height : stage.width), response: Math.round(width < 1024 ? response.height : panel.width) };
        });
      }
      await page.evaluate("document.documentElement.style.fontSize = ''").catch(() => {});
    }
  }

  if (FAMILIES.includes('conversation')) {
    const board = { kind: 'goal_bar', goal: { label: 'Bike', value: 120 }, saved: { label: 'Saved', value: 45 }, remaining: 75, savedFraction: 0.375, label: 'My goal', currency: 'USD' };
    for (const locale of LOCALES) for (const theme of THEMES) for (const width of [375, 1280]) {
      const where = `mentor-screen-child ${locale} ${theme} ${width}px`;
      const t = copy[locale].mentorScreen;
      await check('conversation', where, async () => {
        await setView({ width, height: width >= 1024 ? 800 : 740, theme });
        await signIn('mentor-screen-child', locale, theme);
        await waitFor(`document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector('.lf-mentor-screen[data-phase="openings"] [data-opening]')`, 'openings');
        await press('[data-opening]', 'the first opening');
        await waitFor("window.__oracle.sockets.length === 1 && window.__oracle.sockets[0].readyState === 1 && document.querySelector('.lf-mentor-screen[data-phase=\"conversing\"]')", 'a session and its socket');
        const say = 'You saved ten coins the first week. Then you added five coins each week, so the jar kept growing. How much is left for the bike?';
        await page.evaluate(`window.__oracle.push(${JSON.stringify({ type: 'turn', seq: 1, say, emotion: 'happy', action: 'point', audioUrl: null, audioPending: false, next: 'ask', whiteboard: board })})`);
        await waitFor("document.querySelector('[data-board-kind=\"goal_bar\"]') && document.querySelector('.lf-mentor-plate-text')", 'the board and the plate');
        const plate = await page.evaluate("document.querySelector('.lf-mentor-plate-text').textContent");
        assert.ok(plate.split(/\s+/).length <= 15, `the plate holds one caption page: "${plate}"`);
        assert.ok(say.startsWith(plate), 'the first page of the current turn');
        assert.equal(await page.evaluate("document.querySelector('.lf-mentor-stage').dataset.mentorState"), 'demonstrating');
        if (locale === 'en-US' || width === 375) await shot(`conversation-board-${locale}-${theme}-${width}`);
        // C.13: the hint ladder, as the learner's own words.
        await press('[data-ladder="hint"]', 'the hint chip');
        await waitFor(`window.__oracle.sent.some((m) => m.type === 'learner_text' && m.text === ${JSON.stringify(t.hint)})`, 'the hint was sent');
        // C.15: an adaptation offer, two equal chips.
        await page.evaluate("window.__oracle.push({ type: 'turn', seq: 2, say: 'Shall we try another way?', emotion: 'encouraging', action: 'nod', audioUrl: null, audioPending: false, next: 'ask' }); window.__oracle.push({ type: 'adaptation_offer', adaptation: 'more_examples' })");
        await waitFor("document.querySelector('[data-adaptation=\"no\"]')", 'the adaptation chips');
        await press('[data-adaptation="no"]', 'No, thanks');
        await waitFor("window.__oracle.sent.some((m) => m.type === 'adaptation_response' && m.accepted === false)", 'the decline was sent');
        // C.8/C.12: stop or one more; then the server's closing (C.16).
        await page.evaluate("window.__oracle.push({ type: 'turn', seq: 3, say: 'Stop here for today, or one more?', emotion: 'happy', action: 'idle', audioUrl: null, audioPending: false, next: 'ask' }); window.__oracle.push({ type: 'session_end_offer' })");
        await waitFor("document.querySelector('[data-screen=\"mentor-session-end-choice\"] button')", 'the stop-or-continue choice');
        await press('[data-screen="mentor-session-end-choice"] button', 'stop');
        await waitFor("window.__oracle.sent.some((m) => m.type === 'session_end_response')", 'the answer was sent');
        await page.evaluate("window.__oracle.push({ type: 'session_closing', script: 'completed', effort: 'recovered', topic: 'Saving' }); window.__oracle.push({ type: 'closed', reason: 'completed' }); window.__oracle.end('completed')");
        await waitFor("document.querySelector('.lf-mentor-screen[data-phase=\"closing\"] [data-closing-script=\"completed\"]')", 'the closing state');
        assert.equal(await page.evaluate("document.querySelector('.lf-mentor-stage').dataset.mentorState"), 'closing');
        assert.equal(await page.evaluate("document.querySelector('.lf-session-closing h2').textContent"), copy[locale].mentorSessionEnd.completedTitle);
        await press('[data-bond="yes"]', 'the bond answer');
        await waitFor("document.querySelector('[data-screen=\"mentor-alliance-check\"] .lf-notice')", 'the bond answer was recorded');
        if (width === 375) await shot(`conversation-closing-${locale}-${theme}`);
        return { sent: await page.evaluate('window.__oracle.sent.map((m) => m.type)') };
      });
    }
  }

  if (FAMILIES.includes('focus')) {
    for (const locale of LOCALES) {
      await check('focus', `${locale} Learn to the Mentor tab`, async () => {
        await setView({ width: 375, height: 740, theme: 'light' });
        await signIn('mentor-screen-child', locale, 'light', '/learn');
        await waitFor("document.querySelector('[data-shell] [data-nav-id=\"mentor\"]')", 'the learner shell');
        await press('[data-shell] [data-nav-id="mentor"]', 'the Mentor tab');
        await waitFor("location.pathname === '/tutor' && document.querySelector('.lf-mentor-screen[data-phase=\"openings\"]')", 'the Mentor screen');
        await sleep(300);
        const focus = await page.evaluate("(() => { const a = document.activeElement; return { inScreen: !!a?.closest('.lf-mentor-screen'), tag: a?.tagName }; })()");
        assert.ok(focus.inScreen, `focus stayed at ${focus.tag}`);
        return focus;
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
if (unknownRequests.size) console.log(`Synthetic Core answered with an empty envelope: ${[...unknownRequests].join('; ')}`);
console.log(`Report: ${join(out, 'report.json')}`);
if (failures.length) process.exitCode = 1;
