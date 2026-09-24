import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * S01.2i browser half: the A.2 refusal → protected guest → onboarding →
 * guest-to-account upgrade journey in the actual app, with synthetic Core.
 * Asserts the refused child's safeguards survive the in-place upgrade:
 * the rebuilt age screen never asks for a second date, the analytics beacon
 * never transmits an optional event, and direct Learn/Mentor entry resolves
 * the protected state instead of re-collecting identity data.
 */

const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/age-upgrade');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 840, dark: false });
const evidence = [], guestBodies = [], upgradeBodies = [];
let guestAttempts = 0, upgradeAttempts = 0, upgraded = false, eventsSent = 0;
const id = '22222222-2222-4222-8222-222222222222';
const guestToken = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: true })).toString('base64url') + '.synthetic';
const permanentToken = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, email: 'upgraded@example.invalid', is_anonymous: false })).toString('base64url') + '.synthetic';
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
      if (url.pathname.endsWith('/auth/signup')) {
        status = 403; body = { data: null, error: { code: 'AGE_RESTRICTED', message: 'Synthetic age refusal' } };
      } else if (url.pathname.endsWith('/auth/guest')) {
        guestBodies.push(JSON.parse(request.postData));
        guestAttempts += 1;
        body.data = { session: { accessToken: guestToken, refreshToken: 'synthetic', expiresIn: 3600, user: { id, email: null } } };
      } else if (url.pathname.endsWith('/auth/upgrade')) {
        upgradeBodies.push(JSON.parse(request.postData));
        if (++upgradeAttempts === 1) {
          status = 502; body = { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic upgrade failure' } };
        } else {
          upgraded = true;
          body.data = { session: { accessToken: permanentToken, refreshToken: 'upgraded-rt', expiresIn: 3600, user: { id, email: 'upgraded@example.invalid' } } };
        }
      } else if (url.pathname.endsWith('/auth/me')) body.data = {
        profile: { display_name: 'Synthetic', locale: 'en-US', theme: 'light', cover: {} }, roles: ['universal'], avatarOptions: {},
        analyticsEnabled: false, isGuest: !upgraded, newAccount: upgraded, onboardingComplete: upgraded || guestAttempts > 0 && documentSays('onboardingDone'),
      };
      else if (url.pathname.endsWith('/auth/age-screen')) body.data = { required: false, ageBand: 'under_13', protectedOrigin: true };
      else if (url.pathname.endsWith('/auth/oauth/providers')) body.data = { providers: [] };
      else if (url.pathname.endsWith('/events')) { eventsSent += 1; status = 202; body = { data: { accepted: 0 }, error: null }; }
      else if (url.pathname.endsWith('/onboarding/complete')) body.data = { streakDays: 0 };
      else if (url.pathname.endsWith('/learn/courses')) body.data = { courses: [] };
      else if (url.pathname.endsWith('/tutor/offers')) body.data = { locale: 'en-US', lastSession: null, intelDegraded: false, canStart: true, startBlockedBy: null, sessionCapResetAt: null, voiceAvailable: false, microphoneBlockedBy: 'POLICY_BLOCKED', weakSkills: [], faqIds: [], canAskOpen: true };
      else if (url.pathname.endsWith('/tutor/age-calibration')) body.data = { required: true, tier: null };
      else if (url.pathname.endsWith('/tutor/preferences')) body.data = { character: 'rho', companion: null, diorama: 'diorama-a', backdrop: 'auto', nickname: 'Synthetic', adaptations: [], personalized: true, catalog: { characters: ['rho', 'zara', 'liruf', 'dina'], dioramas: ['diorama-a'], backdrops: ['auto'], adaptations: [], articulates: ['rho', 'zara'] } };
      else if (url.pathname.endsWith('/tutor/map')) body.data = { nodes: [], edges: [], continueTarget: null, review: { count: 0 } };
      else if (url.pathname.endsWith('/profile')) body.data = { learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0, lastActiveDate: null } };
      else if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
      { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: '*' },
    ], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});
function documentSays(marker) { return marker === 'onboardingDone' && false; }
async function wait(expression) {
  for (let n = 0; n < 200; n++) { if (await page.evaluate(expression)) return; await sleep(100); }
  throw Error(`Timed out: ${expression}`);
}
async function click(expression) {
  const point = await page.evaluate(`(() => {const e=${expression}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded control'); return {x,y};})()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
const button = text => `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)})`;
async function type(selector, value) {
  await click(`document.querySelector(${JSON.stringify(selector)})`);
  await page.send('Input.insertText', { text: value });
}
try {
  await warmDevServer(page, origin);
  for (const theme of ['light', 'dark']) for (const width of [375, 1280]) {
    upgraded = false; upgradeAttempts = 0; guestAttempts = 0; eventsSent = 0; guestBodies.length = 0; upgradeBodies.length = 0;
    await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('i18nextLng','en-US');localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 840, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Page.navigate', { url: origin + '/signup' });
    await wait("!!document.querySelector('input[type=password]')");
    if (await page.evaluate(`!!${button('Reject optional')}`)) await click(button('Reject optional'));
    await type('input[autocomplete=name]', 'Synthetic');
    await type('input[type=email]', 'synthetic@example.invalid');
    await type('input[type=password]', 'synthetic-password');
    await type('input[aria-label=Day]', '01');
    await type('input[aria-label=Month]', '01');
    await type('input[aria-label=Year]', '2018');
    await click(button('Create account'));
    await wait(`!!${button('Keep going without an account')}`);
    await click(button('Keep going without an account'));
    await wait("location.pathname === '/onboarding'");
    await wait("!document.querySelector('[data-screen=age-screen]') && document.querySelector('h1')?.textContent === 'Welcome to LittleFounders'");
    assert.equal(await page.evaluate("!!document.querySelector('.lf-age-date')"), false, 'The protected guest must never be asked for a second date');
    await click(button('Get started'));
    await wait("!!document.querySelector('input[autocomplete=name]')");
    await type('input[autocomplete=name]', 'Synthetic');
    await click(button('Continue'));
    await wait("document.querySelector('h1')?.textContent === 'Where did you hear about us?'");
    await click(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Skip')`);
    await wait("document.querySelector('h1')?.textContent === 'Shall we save your progress?'");
    await click(button('Create my account'));
    await wait("location.pathname === '/upgrade-account'");
    await wait("!!document.querySelector('input[autocomplete=email]')");
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${width}-${theme}-upgrade.png`), Buffer.from(shot.data, 'base64'));
    await type('input[autocomplete=email]', 'upgraded@example.invalid');
    await type('input[autocomplete=new-password]', 'longenough1');
    await click(button('Save my account'));
    await wait(`!!${button('Save my account')} && !!document.querySelector('[role=alert]')`);
    assert.equal(await page.evaluate('location.pathname'), '/upgrade-account', 'A failed upgrade must retain the form');
    await click(button('Save my account'));
    await wait("location.pathname === '/learn' && !!document.querySelector('h1') && !document.querySelector('.lf-age-screen')");
    assert.equal(await page.evaluate("!!document.querySelector('.lf-age-date')"), false, 'The upgraded account must not be asked for its date again');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    const landed = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${width}-${theme}-learn.png`), Buffer.from(landed.data, 'base64'));
    await page.send('Page.navigate', { url: origin + '/tutor' });
    await wait("document.querySelectorAll('.lf-mentor-calibration-options button').length === 3");
    assert.equal(await page.evaluate("!!document.querySelector('.lf-age-date')"), false, 'Direct Mentor entry must resolve the protected state, not re-collect a date');
    assert.equal(guestBodies.length, 1, 'Exactly one protected-guest session per journey');
    assert.ok(guestBodies.every(b => JSON.stringify(b) === JSON.stringify({ under13Origin: true })), 'Every protected guest session must carry the origin marker');
    assert.equal(upgradeBodies.length, 2, 'Failed attempt plus successful retry per journey');
    assert.ok(upgradeBodies.every(b => b.email === 'upgraded@example.invalid' && b.password === 'longenough1' && typeof b.refreshToken === 'string' && !('birthDate' in b)), 'The upgrade must never carry a birth date');
    assert.equal(eventsSent, 0, 'No optional analytics event may be transmitted for a flagged guest or its upgraded identity');
    evidence.push({ width, theme, refusalReachesOnboarding: true, upgradeFailureRetainsForm: true, upgradeLandsOnLearn: true, noSecondDateCapture: true, optionalEventsTransmitted: eventsSent, directMentorEntryProtected: true, horizontalOverflow: false });
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  evidence.push({ failed: String(error), state: await page.evaluate('document.body?.innerText.slice(0,1800) ?? "Document navigating"').catch(() => 'Document unavailable') });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Actual local app in Chrome, real pointer input, synthetic Core; not database E2E', evidence, guestBodies, upgradeBodies: upgradeBodies.map(b => ({ email: b.email, hasRefreshToken: typeof b.refreshToken === 'string', hasBirthDate: 'birthDate' in b })), eventsSent, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
}
console.log(JSON.stringify(evidence));
