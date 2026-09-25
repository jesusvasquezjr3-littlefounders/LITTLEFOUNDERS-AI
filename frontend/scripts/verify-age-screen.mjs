import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const journeysOnly = process.argv.includes('--journeys-only');
const historyOnly = process.argv.includes('--history-only');
const mentorOnly = process.argv.includes('--mentor-only');
const out = resolve(mentorOnly ? '../audit-results/mentor-calibration' : journeysOnly ? '../audit-results/age-screen-journeys' : historyOnly ? '../audit-results/age-screen-history' : '../audit-results/age-screen');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 840, dark: false });
let screened = false, attempts = 0, reads = 0, locale = 'en-US', theme = 'light';
const readsLog = [];
let stepLog = [];
let guest = true;
let calibrated = false, calibrationAttempts = 0;
const calibrationBodies = [];
const productRequests = [];
const evidence = [], submissions = [];
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: true })).toString('base64url') + '.synthetic';
await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params;
  const url = new URL(request.url);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return void await page.send('Fetch.continueRequest', { requestId });
    let body = { data: {}, error: null }, status = 200;
    if (request.method !== 'OPTIONS') {
      if (/\/api\/v1\/(learn|placement|tutor)(\/|$)/.test(url.pathname)) productRequests.push(url.pathname);
      if (url.pathname.endsWith('/auth/age-screen')) {
        readsLog.push(`${request.method} ${url.pathname}${request.postData ? ' ' + request.postData.slice(0, 60) : ''}`);
        if (request.method === 'GET') reads += 1;
        if (request.method === 'POST') {
          submissions.push(JSON.parse(request.postData));
          if (++attempts === 1) { status = 502; body = { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic storage failure' } }; }
          else screened = true;
        }
        if (status === 200) body.data = { required: !screened, ageBand: screened ? 'under_13' : null, protectedOrigin: screened };
      }       else if (url.pathname.endsWith('/auth/me')) body.data = {
        profile: { display_name: '', locale, theme, cover: {} }, roles: ['universal'], avatarOptions: {},
        analyticsEnabled: false, isGuest: guest, newAccount: !guest, onboardingComplete: false,
      };
      else if (historyOnly && url.pathname.endsWith('/learn/courses')) body.data = { courses: [] };
      else if (historyOnly && url.pathname.endsWith('/tutor/offers')) body.data = { locale, lastSession: null, intelDegraded: false, canStart: true, startBlockedBy: null, sessionCapResetAt: null, voiceAvailable: false, microphoneBlockedBy: 'POLICY_BLOCKED', weakSkills: [], faqIds: [], canAskOpen: true };
      else if (historyOnly && url.pathname.endsWith('/tutor/age-calibration')) body.data = { required: true, tier: null };
      else if (historyOnly && url.pathname.endsWith('/tutor/preferences')) body.data = { character: 'rho', companion: null, diorama: 'diorama-a', backdrop: 'auto', nickname: 'Synthetic', adaptations: [], personalized: true, catalog: { characters: ['rho', 'zara', 'liruf', 'dina'], dioramas: ['diorama-a'], backdrops: ['auto'], adaptations: [], articulates: ['rho', 'zara'] } };
      else if (historyOnly && url.pathname.endsWith('/tutor/map')) body.data = { nodes: [], edges: [], continueTarget: null, review: { count: 0 } };
      else if (historyOnly && url.pathname.endsWith('/profile')) body.data = { learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0, lastActiveDate: null } };
      else if (mentorOnly && url.pathname.endsWith('/tutor/age-calibration')) {
        if (request.method === 'POST') {
          calibrationBodies.push(JSON.parse(request.postData));
          if (++calibrationAttempts === 1) { status = 502; body = { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic calibration failure' } }; }
          else calibrated = true;
        }
        if (status === 200) body.data = { required: !calibrated, tier: calibrated ? 2 : null };
      }
      else if (mentorOnly && url.pathname.endsWith('/tutor/preferences')) body.data = {
        character: 'rho', companion: null, diorama: 'diorama-a', backdrop: 'auto', nickname: 'Synthetic', adaptations: [], personalized: true,
        catalog: { characters: ['rho', 'zara', 'liruf', 'dina'], dioramas: ['diorama-a'], backdrops: ['auto'], adaptations: [], articulates: ['rho', 'zara'] },
      };
      else if (mentorOnly && url.pathname.endsWith('/tutor/offers')) body.data = { locale, lastSession: null, intelDegraded: false, canStart: true, startBlockedBy: null, sessionCapResetAt: null, voiceAvailable: false, microphoneBlockedBy: 'POLICY_BLOCKED', weakSkills: [], faqIds: [], canAskOpen: true };
      else if (mentorOnly && url.pathname.endsWith('/tutor/map')) body.data = { nodes: [], edges: [], continueTarget: null, review: { count: 0 } };
      else if (mentorOnly && url.pathname.endsWith('/profile')) body.data = { learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0, lastActiveDate: null } };
      else if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
      { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: '*' },
    ], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});
async function wait(expression) {
  for (let n = 0; n < (mentorOnly ? 450 : 150); n++) {
    try { if (await page.evaluate(expression)) return; }
    catch (error) { if (!/context|navigat/i.test(String(error))) throw error; }
    await sleep(100);
  }
  throw Error(`Timed out: ${expression}`);
}
async function waitForReadAfter(previous) {
  for (let n = 0; n < 150; n++) { if (reads > previous) return; await sleep(100); }
  throw Error(`No age-screen read observed (previous=${previous}, reads=${reads})`);
}
async function goBack() {
  await page.evaluate('history.back()');
}
async function goForward() {
  await page.evaluate('history.forward()');
}
/** Same-document SPA navigation: the product never full-navigates between routes. */
async function spaGo(path) {
  await page.evaluate(`history.pushState(null,'',${JSON.stringify(path)});window.dispatchEvent(new PopStateEvent('popstate'))`);
}
async function click(selector) {
  const point = await page.evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Control occluded'); return {x,y}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
try {
  await warmDevServer(page, origin);
  for (locale of journeysOnly || mentorOnly || historyOnly ? [] : ['en-US', 'es-MX', 'pt-BR']) for (theme of ['light', 'dark']) for (const width of [375, 1280]) {
    screened = false; attempts = 0;
    const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: true };
    await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 840, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Page.navigate', { url: origin + '/onboarding' });
    await wait("document.querySelectorAll('.lf-age-date input').length===3");
    const initialReads = reads;
    await page.send('Page.reload', {});
    await waitForReadAfter(initialReads);
    await wait("document.querySelectorAll('.lf-age-date input').length===3");
    assert.ok(reads > initialReads, 'Reload must consult server before granting clearance');
    await page.evaluate('document.fonts.ready');
    assert.equal(await page.evaluate("document.querySelector('.lf-rebuild').dataset.theme"), theme);
    for (const [index, text] of ['01', '02', '2018'].entries()) {
      await click(`.lf-age-date .lf-input-field:nth-child(${index + 1}) input`);
      await page.send('Input.insertText', { text });
    }
    await click('.lf-age-form button[type=submit]');
    await wait("!!document.querySelector('.lf-age-screen [role=alert]')");
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    const clipped = await page.evaluate("[...document.querySelectorAll('.lf-age-screen [data-copy-role]')].filter(e=>e.scrollWidth>e.clientWidth+1 || e.scrollHeight>e.clientHeight+1).map(e=>e.textContent)");
    assert.deepEqual(clipped, []);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
    await click('.lf-age-form button[type=submit]');
    await wait("!document.querySelector('.lf-age-screen')");
    const clearedReads = reads;
    await page.send('Page.reload', {});
    await waitForReadAfter(clearedReads);
    await wait("!document.querySelector('.lf-age-screen') && !!document.querySelector('h1')");
    assert.ok(reads > clearedReads, 'Confirmed session must revalidate on reload');
    assert.equal(attempts, 2, 'Reload must not request another birth date after stored clearance');
    evidence.push({ locale, theme, width, errorRetainsScreen: true, confirmedRetryOpensOnboarding: true, reloadBeforeAndAfterConfirmation: true, clippedCopy: clipped });
  }
  if (journeysOnly) {
    guest = false; screened = false; locale = 'en-US'; theme = 'light';
    await page.evaluate("localStorage.clear();sessionStorage.clear();localStorage.setItem('i18nextLng','en-US');");
    const socialToken = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
    const fragment = new URLSearchParams({ access_token: socialToken, refresh_token: 'synthetic', expires_in: '3600' });
    await page.send('Page.navigate', { url: origin + '/auth/callback#' + fragment });
    await wait("location.pathname === '/learn' && document.querySelectorAll('.lf-age-date input').length === 3");
    assert.equal(await page.evaluate('location.hash'), '');
    assert.deepEqual(productRequests, [], 'OAuth must not mount product requests before screening');
    for (const path of ['/tutor', '/learn']) {
      const before = reads;
      await page.send('Page.navigate', { url: origin + path });
      await waitForReadAfter(before);
      await wait("document.querySelectorAll('.lf-age-date input').length === 3");
      assert.deepEqual(productRequests, [], 'Deep links must not mount protected content');
    }
    evidence.push({ syntheticOAuthCallback: true, tokenFragmentScrubbed: true, learnAndMentorDeepLinksBlocked: true, productRequestsBeforeScreening: productRequests.length });
  }
  if (historyOnly) {
    stepLog = [];
    const step = async (label) => {
      const path = await page.evaluate('location.pathname + location.search').catch(() => '?');
      const age = await page.evaluate("!!document.querySelector('.lf-age-date')").catch(() => '?');
      stepLog.push(`${label} @ ${path} reads=${reads} ageForm=${age}`);
    };
    guest = true; screened = false; locale = 'en-US'; theme = 'light';
    const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: true };
    await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng','en-US');localStorage.setItem('lf-theme','light');`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 840, deviceScaleFactor: 1, mobile: true });

    // Journey 1: back/forward across the mandatory gate BEFORE any clearance.
    await page.send('Page.navigate', { url: origin + '/' });
    await wait("!!document.querySelector('h1') && location.pathname === '/'");
    const beforeFirst = reads;
    await spaGo('/learn');
    await waitForReadAfter(beforeFirst);
    await wait("document.querySelectorAll('.lf-age-date input').length===3");
    assert.deepEqual(productRequests, [], 'No product content may be requested before screening');
    await step('learn-form');
    await goBack();
    await wait("location.pathname === '/' && !!document.querySelector('h1')");
    await step('back-to-home');
    assert.equal(await page.evaluate("!!document.querySelector('.lf-age-date')"), false, 'Back to marketing must leave the gate surface');
    const beforeForward = reads;
    await goForward();
    await waitForReadAfter(beforeForward);
    await step('forward-to-learn');
    await wait("location.pathname === '/learn' && document.querySelectorAll('.lf-age-date input').length === 3");
    assert.deepEqual(productRequests, [], 'Forward must revalidate before mounting product content');
    const history = await page.send('Page.getNavigationHistory');

    // Journey 2: a permanent account with stored clearance — back/forward
    // between two real protected surfaces revalidates without re-asking.
    guest = false; screened = false; attempts = 0;
    const permanentToken = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
    const permanentSession = { accessToken: permanentToken, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: false };
    await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(permanentSession))});localStorage.setItem('i18nextLng','en-US');localStorage.setItem('lf-theme','light');`);
    await page.send('Page.navigate', { url: origin + '/learn' });
    await waitForReadAfter(reads);
    await wait("document.querySelectorAll('.lf-age-date input').length===3");
    for (const [index, text] of ['01', '02', '2018'].entries()) {
      await click(`.lf-age-date .lf-input-field:nth-child(${index + 1}) input`);
      await page.send('Input.insertText', { text });
    }
    await click('.lf-age-form button[type=submit]');
    await wait("!!document.querySelector('.lf-age-screen [role=alert]')");
    await click('.lf-age-form button[type=submit]');
    await wait("location.pathname === '/learn' && !document.querySelector('.lf-age-screen') && !!document.querySelector('h1')");
    assert.equal(attempts, 2);
    assert.equal(await page.evaluate("!!document.querySelector('.lf-age-date')"), false, 'Stored clearance must never re-ask the date');
    const beforeSecond = reads;
    await spaGo('/tutor');
    await waitForReadAfter(beforeSecond);
    await wait("location.pathname === '/tutor' && document.querySelectorAll('.lf-mentor-calibration-options button').length === 3");
    assert.equal(await page.evaluate("!!document.querySelector('.lf-age-date')"), false, 'The Mentor must not re-collect a birth date');
    const beforeBack = reads;
    await goBack();
    await waitForReadAfter(beforeBack);
    await wait("location.pathname === '/learn' && !document.querySelector('.lf-age-date') && !!document.querySelector('h1')");
    const beforeForward2 = reads;
    await goForward();
    await waitForReadAfter(beforeForward2);
    await wait("location.pathname === '/tutor' && document.querySelectorAll('.lf-mentor-calibration-options button').length === 3");
    assert.equal(attempts, 2, 'History traversal must never ask for a second birth date after stored clearance');

    // Journey 3: the OAuth callback is safe to traverse — the token URL is
    // scrubbed (replaceState + replace navigate), so Back cannot replay it.
    guest = false; screened = false; attempts = 0; productRequests.length = 0;
    const socialToken = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
    const fragment = new URLSearchParams({ access_token: socialToken, refresh_token: 'synthetic', expires_in: '3600' });
    await spaGo('/auth/callback#' + fragment);
    await wait("location.pathname === '/learn' && document.querySelectorAll('.lf-age-date input').length === 3");
    assert.equal(await page.evaluate('location.hash'), '', 'Token fragment must be scrubbed from the URL');
    assert.deepEqual(productRequests, [], 'OAuth must not mount product content before screening');
    const beforeBack3 = reads;
    await goBack();
    await wait("location.pathname !== '/learn' && location.pathname !== '/auth/callback'");
    await waitForReadAfter(beforeBack3);
    assert.deepEqual(productRequests, [], 'History traversal from OAuth must not mount unguarded content');
    const beforeForward3 = reads;
    await goForward();
    await waitForReadAfter(beforeForward3);
    await wait("location.pathname === '/learn' && document.querySelectorAll('.lf-age-date input').length === 3");
    assert.deepEqual(productRequests, [], 'Forward from the callback must still require screening');
    evidence.push({ backForwardBeforeClearance: true, backForwardAfterClearance: true, callbackBackIsSafe: true, revalidationReads: reads, historyEntries: history.entries.length, productRequestsBeforeScreening: productRequests.length, stepLog });
  }
  if (mentorOnly) for (locale of ['en-US', 'es-MX', 'pt-BR']) for (theme of ['light', 'dark']) for (const width of [375, 1280]) {
    guest = false; screened = true; calibrated = false; calibrationAttempts = 0;
    const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: false };
    await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 840, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Page.navigate', { url: origin + '/tutor' });
    await wait("document.querySelectorAll('.lf-mentor-calibration-options button').length === 3");
    await page.evaluate('document.fonts.ready');
    await wait("(() => { const e=document.querySelector('.lf-mentor-calibration-options button:nth-child(2)'); if(!e) return false; const r=e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })()");
    await click('.lf-mentor-calibration-options button:nth-child(2)');
    await wait("!!document.querySelector('.lf-mentor-calibration [role=alert]')");
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${locale}-${theme}-${width}-retry.png`), Buffer.from(shot.data, 'base64'));
    assert.equal(await page.evaluate("document.querySelector('.lf-mentor-calibration').dataset.theme"), theme);
    await page.evaluate(readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf-8'));
    const accessibility = await page.evaluate("axe.run(document.querySelector('.lf-mentor-calibration'))");
    assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
    let keyboardReached = false;
    for (let step = 0; step < 12; step++) {
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      if (await page.evaluate("document.activeElement === document.querySelector('.lf-mentor-calibration-options button:nth-child(2)')")) { keyboardReached = true; break; }
    }
    assert.equal(keyboardReached, true, 'The middle answer must be reachable by Tab');
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await wait("!!document.querySelector('[data-opening]') && !document.querySelector('.lf-mentor-calibration')");
    const before = reads;
    await page.send('Page.reload', {}); await waitForReadAfter(before);
    await wait("!!document.querySelector('canvas') && !!document.querySelector('[data-opening]') && !document.querySelector('.lf-mentor-calibration')");
    assert.equal(calibrationAttempts, 2);
    evidence.push({ locale, theme, width, keyboardRetry: true, axeViolations: 0, failedWriteRetainsQuestion: true, confirmedWriteContinues: true, reloadDoesNotReask: true });
  }
  if (mentorOnly) assert.deepEqual(calibrationBodies, Array.from({ length: 24 }, () => ({ tier: 2 })));
  assert.equal(submissions.length, journeysOnly || mentorOnly ? 0 : historyOnly ? 2 : 24);
  assert.ok(submissions.every(value => JSON.stringify(value) === JSON.stringify({ birthDate: '2018-02-01' })));
  assert.deepEqual(page.errors, []);
} catch (error) {
  if (mentorOnly) {
    const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
    if (shot) writeFileSync(join(out, 'failure.png'), Buffer.from(shot.data, 'base64'));
  }
  evidence.push({ failed: String(error), readsLog, stepLog: stepLog ?? null, state: await page.evaluate('document.body?.innerText.slice(0,1800) ?? "Document navigating"').catch(() => 'Document unavailable') });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Local Chrome, real pointer input, synthetic Core; not database E2E', evidence, submissions: submissions.length, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
}
console.log(JSON.stringify(evidence));
