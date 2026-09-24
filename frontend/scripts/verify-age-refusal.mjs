import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/age-refusal');
mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 840, dark: false });
const evidence = [], guestBodies = [];
let guestAttempts = 0;
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: '22222222-2222-4222-8222-222222222222', is_anonymous: true })).toString('base64url') + '.synthetic';
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
        if (++guestAttempts % 2 === 1) {
          status = 502; body = { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic provenance failure' } };
        } else body.data = { session: { accessToken: token, refreshToken: 'synthetic', expiresIn: 3600, user: { id: '22222222-2222-4222-8222-222222222222', email: null } } };
      } else if (url.pathname.endsWith('/auth/me')) body.data = { profile: { display_name: '', locale: 'en-US', theme: 'light' }, roles: ['universal'], analyticsEnabled: false, isGuest: true, onboardingComplete: false };
      else if (url.pathname.endsWith('/auth/age-screen')) body.data = { required: false, ageBand: 'under_13', protectedOrigin: true };
      else if (url.pathname.endsWith('/auth/oauth/providers')) body.data = { providers: [] };
      else if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
      { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: '*' },
    ], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});
async function wait(expression) {
  for (let n = 0; n < 150; n++) { if (await page.evaluate(expression)) return; await sleep(100); }
  throw Error(`Timed out: ${expression}`);
}
async function click(expression) {
  const point = await page.evaluate(`(() => {const e=${expression}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded control'); return {x,y};})()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
const button = text => `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)})`;
try {
  await warmDevServer(page, origin);
  for (const width of [375, 1280]) {
    await page.evaluate("localStorage.clear(); sessionStorage.clear(); localStorage.setItem('i18nextLng','en-US');");
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 840, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Page.navigate', { url: origin + '/signup' });
    await wait("!!document.querySelector('input[type=password]')");
    if (await page.evaluate(`!!${button('Reject optional')}`)) await click(button('Reject optional'));
    for (const [selector, value] of [['input[autocomplete=name]', 'Synthetic'], ['input[type=email]', 'synthetic@example.invalid'], ['input[type=password]', 'synthetic-password'], ['input[aria-label=Day]', '01'], ['input[aria-label=Month]', '01'], ['input[aria-label=Year]', '2018']]) {
      await click(`document.querySelector(${JSON.stringify(selector)})`);
      await page.send('Input.insertText', { text: value });
    }
    await click(button('Create account'));
    await wait(`!!${button('Keep going without an account')}`);
    await click(button('Keep going without an account'));
    await wait("!!document.querySelector('[role=alert]')");
    assert.equal(await page.evaluate('location.pathname'), '/signup');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${width}-retry.png`), Buffer.from(shot.data, 'base64'));
    await click(button('Keep going without an account'));
    await wait("location.pathname === '/onboarding'");
    await wait("!document.querySelector('[data-screen=age-screen]') && document.querySelector('h1')?.textContent === 'Welcome to LittleFounders'");
    await click(button('Get started'));
    await wait("!!document.querySelector('input[autocomplete=name]')");
    await click("document.querySelector('input[autocomplete=name]')");
    await page.send('Input.insertText', { text: 'Synthetic' });
    await click(button('Continue'));
    await wait("document.querySelector('h1')?.textContent === 'Where did you hear about us?'");
    assert.equal(await page.evaluate("!!document.querySelector('input[type=date]')"), false);
    evidence.push({ width, blockedWriteStaysOnRefusal: true, retryReachesOnboarding: true, onboardingDoesNotRecollectDOB: true, horizontalOverflow: false });
  }
  assert.deepEqual(guestBodies, Array.from({ length: 4 }, () => ({ under13Origin: true })));
  assert.deepEqual(page.errors, []);
} catch (error) {
  evidence.push({ failed: String(error), state: await page.evaluate('document.body.innerText.slice(0,1800)') });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Local Chrome, real pointer input, synthetic intercepted Core replies; not database E2E', evidence, guestBodies, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
}
console.log(JSON.stringify(evidence));
