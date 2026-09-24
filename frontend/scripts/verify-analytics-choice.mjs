import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/analytics-choice'); mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
let preferenceReads = 0;
let enabled = false, disclosed = false, writes = 0, locale = 'en-US', theme = 'light';
const evidence = [], eventRequests = [], choices = [];
const crossTabOnly = process.argv.includes('--cross-tab-only');
let policyReads = 0;
async function attachInterception(page) {
await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data); if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params; const url = new URL(request.url);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return void await page.send('Fetch.continueRequest', { requestId });
    if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    let status = 200, body = { data: {}, error: null };
    if (request.method !== 'OPTIONS') {
      if (url.pathname.endsWith('/auth/me')) { policyReads++; body.data = { profile: { display_name: 'Synthetic', locale, theme, cover: {} }, roles: ['universal'], avatarOptions: {}, analyticsEnabled: enabled, isGuest: false, newAccount: false, onboardingComplete: true }; }
      else if (url.pathname.endsWith('/auth/age-screen')) body.data = { required: false, ageBand: '13_to_17', protectedOrigin: false };
      else if (url.pathname.endsWith('/auth/analytics-preference')) {
        if (request.method === 'GET') preferenceReads++;
        if (request.method === 'PUT') {
          const choice = JSON.parse(request.postData); choices.push(choice);
          if (++writes === 1) { status = 502; body = { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic write failure' } }; }
          else { enabled = choice.enabled; disclosed = true; }
        }
        if (status === 200) body.data = { canManage: true, enabled, disclosed };
      } else if (url.pathname.endsWith('/profile')) body.data = { displayName: 'Synthetic', username: 'synthetic', locale, birthDate: null, learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0, lastActiveDate: null } };
      else if (url.pathname.endsWith('/profile/blocked')) body.data = { users: [] };
      else if (url.pathname.endsWith('/events')) { eventRequests.push({ enabled, body: JSON.parse(request.postData) }); body.data = { accepted: enabled ? 1 : 0 }; }
      else if (url.pathname.endsWith('/analytics/tracking-decision')) body.data = { excluded: false, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});
}
await attachInterception(page);

async function wait(expression, target = page) { for (let i = 0; i < 200; i++) { try { if (await target.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
async function waitForPreference(previous) { for (let i = 0; i < 200; i++) { if (preferenceReads > previous) return; await sleep(100); } throw Error('No fresh preference read'); }
async function click(target = page) {
  const point = await target.evaluate(`(() => { const e=document.querySelector('.lf-analytics-choice [role=switch]'); e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(), x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded switch'); return {x,y}; })()`);
  await target.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await target.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function probe(target = page) { await target.evaluate("import('/src/lib/insights.ts').then(async m => { m.trackInsight('nav_view', {routeClass:'profile'}); await m.flushInsights(); })"); }
try {
  await warmDevServer(page, origin);
  for (locale of crossTabOnly ? [] : ['en-US', 'es-MX', 'pt-BR']) for (theme of ['light', 'dark']) for (const width of [375, 1280]) {
    enabled = false; disclosed = false; writes = 0; const initialEvents = eventRequests.length;
    const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: false };
    await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    const beforeNavigation = preferenceReads;
    await page.send('Page.navigate', { url: origin + '/profile/settings' });
    await waitForPreference(beforeNavigation);
    await wait("!!document.querySelector('.lf-analytics-choice [role=switch][aria-checked=false]:not(:disabled)')");
    await probe(); assert.equal(eventRequests.length, initialEvents, 'Undisclosed choice must not transmit');
    await click(); await wait("!!document.querySelector('.lf-analytics-choice [role=alert]')");
    assert.equal(await page.evaluate("document.querySelector('.lf-analytics-choice [role=switch]').getAttribute('aria-checked')"), 'false');
    await click(); await wait("!!document.querySelector('.lf-analytics-choice [role=switch][aria-checked=true]:not(:disabled)')");
    await probe(); assert.ok(eventRequests.length > initialEvents, 'Opt-in should enable the actual beacon');
    await click(); await wait("!!document.querySelector('.lf-analytics-choice [role=switch][aria-checked=false]:not(:disabled)')");
    const afterOptOut = eventRequests.length; await probe(); assert.equal(eventRequests.length, afterOptOut);
    const beforeReload = preferenceReads;
    await page.send('Page.reload', {}); await waitForPreference(beforeReload); await wait("!!document.querySelector('.lf-analytics-choice [role=switch][aria-checked=false]:not(:disabled)')");
    await probe(); assert.equal(eventRequests.length, afterOptOut, 'Reload must retain opt-out');
    await page.evaluate("document.querySelector('.lf-analytics-choice').scrollIntoView({block:'center',behavior:'instant'})");
    await page.evaluate('document.fonts.ready');
    await wait("(() => { if(document.documentElement.classList.contains('theme-transitioning')) return false; for(let e=document.querySelector('.lf-analytics-choice');e;e=e.parentElement) if(Number(getComputedStyle(e).opacity)<0.999) return false; return true; })()");
    await page.evaluate(readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf-8'));
    const axe = await page.evaluate("axe.run(document.querySelector('.lf-analytics-choice'))"); assert.deepEqual(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), []);
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    assert.equal(await page.evaluate("document.querySelector('.lf-analytics-choice').dataset.theme"), theme);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, `${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
    assert.equal(writes, 3);
    evidence.push({ locale, theme, width, failedWriteRetainsChoice: true, actualBeaconOptIn: true, noTransmissionAfterOptOutAndReload: true, axeViolations: 0 });
  }
  if (crossTabOnly) {
    enabled = true; disclosed = true; writes = 1;
    const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: false };
    await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});`);
    const beforeFirstRead = preferenceReads;
    await page.send('Page.navigate', { url: origin + '/profile/settings' }); await waitForPreference(beforeFirstRead);
    await wait("!!document.querySelector('.lf-analytics-choice [role=switch][aria-checked=true]:not(:disabled)')");
    await probe(); assert.ok(eventRequests.length > 0);
    const other = await openPage(browser.browser, { width: 1280, height: 900, dark: false });
    await attachInterception(other);
    const beforeOtherRead = preferenceReads;
    await other.send('Page.navigate', { url: origin + '/profile/settings' }); await waitForPreference(beforeOtherRead);
    await wait("!!document.querySelector('.lf-analytics-choice [role=switch][aria-checked=true]:not(:disabled)')", other);
    await click(other);
    await wait("!!document.querySelector('.lf-analytics-choice [role=switch][aria-checked=false]:not(:disabled)')", other);
    await wait("!!document.querySelector('.lf-analytics-choice [role=switch][aria-checked=false]:not(:disabled)')");
    const beforeFocus = policyReads;
    await page.send('Page.bringToFront', {});
    await wait("document.visibilityState === 'visible'");
    for (let n=0; n<150 && policyReads===beforeFocus; n++) await sleep(100);
    assert.ok(policyReads > beforeFocus, 'Returning tab must read policy again');
    const afterRevocation = eventRequests.length; await probe();
    assert.equal(eventRequests.length, afterRevocation, 'Other tab must stop optional requests');
    evidence.push({ twoTabs: true, sharedStorageInvalidation: true, switchUpdatesInOtherTab: true, visibleReturningTabDoesNotTransmit: true });
    await other.send('Page.close').catch(() => {}); other.ws.close();
  }
  assert.ok(eventRequests.every(r => r.enabled)); assert.deepEqual(choices, crossTabOnly ? [{ enabled: false }] : Array.from({ length: 12 }, () => [{ enabled: true }, { enabled: true }, { enabled: false }]).flat()); assert.deepEqual(page.errors, []);
} catch (error) { const failureShot = await page.send('Page.captureScreenshot', {format:'png'}).catch(() => null); if (failureShot) writeFileSync(join(out, 'failure.png'), Buffer.from(failureShot.data,'base64')); evidence.push({ failed: String(error), state: await page.evaluate('document.body?.innerText.slice(0,2000)').catch(() => 'Unavailable') }); process.exitCode = 1; }
finally { writeFileSync(join(out, crossTabOnly ? 'cross-tab-report.json' : 'report.json'), JSON.stringify({ provenance: 'Local Chrome, real pointer input and actual beacon module; synthetic Core, not database E2E or third-party provider acceptance', evidence, errors: page.errors }, null, 2)); await page.send('Browser.close').catch(() => {}); page.ws.close(); }
console.log(JSON.stringify(evidence));
