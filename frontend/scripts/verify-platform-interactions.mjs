/* Pointer/keyboard smoke with local HTTP fixtures. Never contacts a real API. */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const out = resolve('../audit-results');
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(out, 'interaction-profile-'));
const browser = await launchBrowser(profile);
const page = await openPage(browser.browser, { width: 390, height: 844, dark: false });
const origin = 'http://127.0.0.1:5177';
const evidence = [];
let rejectLogin = true;
await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async (event) => {
  const message = JSON.parse(event.data);
  if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params;
  const url = new URL(request.url);
  try {
    if (url.origin === origin) return void await page.send('Fetch.continueRequest', { requestId });
    if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    const path = url.pathname.slice(7);
    const map = {
      '/auth/login': { session: { accessToken: 'audit-only', refreshToken: 'audit-only', expiresIn: 3600, user: { id: 'audit-kid', email: null } } },
      '/auth/me': { profile: { display_name: 'Audit learner', username: 'audit', locale: 'en-US', theme: 'light', cover: {} }, roles: ['kid'], avatarOptions: {}, analyticsEnabled: false, onboardingComplete: true },
      '/auth/logout': {}, '/learn/courses': { courses: [] },
      '/tasks/mine': { tasks: [] }, '/tasks/wallet': { balances: { save: 0, spend: 0, share: 0 } },
      '/tasks/goals': { goals: [] }, '/tasks/catalog/available': { items: [] },
      '/tasks/redemptions/mine': { redemptions: [] }, '/tasks/wallet/ledger': { entries: [] },
    };
    const data = path === '/auth/login' && rejectLogin ? null : map[path];
    const body = data ? { data, error: null } : { data: null, error: { code: 'UNAUTHORIZED', message: 'Audit rejection' } };
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: data || request.method === 'OPTIONS' ? 200 : 401,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Methods', value: '*' }],
      body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) {
    if (!/Invalid InterceptionId|Session closed|Target closed/.test(String(error))) throw error;
  }
});

async function waitFor(expression) {
  for (let n = 0; n < 600; n++) {
    if (await page.evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out: ${expression}`);
}
async function click(expression) {
  const point = await page.evaluate(`(() => { const el = ${expression}; if(!el) throw Error('Control missing'); el.scrollIntoView({block:'center',behavior:'instant'}); const r=el.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; const hit=document.elementFromPoint(x,y); if(hit!==el&&!el.contains(hit)) throw Error('Control obstructed');return {x,y};})()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await sleep(250);
}
const byText = (text) => `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)})`;
try {
  await warmDevServer(page, origin);
  await page.evaluate(`localStorage.clear();localStorage.setItem('lf-theme','light');localStorage.setItem('i18nextLng','en-US')`);
  await page.send('Page.navigate', { url: origin + '/tasks?kidId=learner-2#pending' });
  await waitFor(`location.pathname === '/login' && !!document.querySelector('input[autocomplete="username"]')`);
  if (await page.evaluate(`Boolean(${byText('Reject optional')})`)) await click(byText('Reject optional'));
  assert.equal(await page.evaluate(`document.querySelector('button[type="submit"]').disabled`), true);
  await click(`document.querySelector('input[autocomplete="username"]')`);
  await page.send('Input.insertText', { text: 'audit_child' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await page.evaluate(`document.activeElement.getAttribute('autocomplete')`), 'current-password');
  await page.send('Input.insertText', { text: 'synthetic-passphrase' });
  await click(`document.querySelector('form button[aria-pressed]')`);
  assert.equal(await page.evaluate(`document.querySelector('input[autocomplete="current-password"]').type`), 'text');
  await click(`document.querySelector('button[type="submit"]')`);
  await waitFor(`Boolean(document.querySelector('[role="alert"]'))`);
  evidence.push({ flow: 'Mobile login failure, input labels, Tab order, password reveal, retry-enabled submit', passed: true });
  rejectLogin = false;
  await click(`document.querySelector('button[type="submit"]')`);
  await waitFor(`location.pathname === '/tasks'`);
  assert.equal(await page.evaluate(`location.search+location.hash`), '?kidId=learner-2#pending');
  await page.send('Page.reload');
  await waitFor(`location.pathname === '/tasks' && document.body?.innerText.includes('Tasks')`);
  evidence.push({ flow: 'Fixture login success preserves protected deep-link query/fragment and survives reload', passed: true });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  await click(`[...document.querySelectorAll('button[aria-label]')].find(b=>/log out|sign out/i.test(b.getAttribute('aria-label')) && b.getBoundingClientRect().width>0)`);
  await waitFor(`!localStorage.getItem('lf.session.v1')`);
  await page.send('Page.navigate', { url: origin + '/family' });
  await waitFor(`location.pathname === '/login'`);
  evidence.push({ flow: 'Desktop sign-out clears storage and protected family navigation redirects to login', passed: true });
  await page.send('Page.navigate', { url: origin + '/faq' });
  await waitFor(`Boolean(document.querySelector('main button[aria-expanded]'))`);
  await click(`document.querySelector('main button[aria-expanded]')`);
  assert.equal(await page.evaluate(`document.querySelector('main button[aria-expanded]').getAttribute('aria-expanded')`), 'true');
  await click(`document.querySelector('main button[aria-expanded]')`);
  assert.equal(await page.evaluate(`document.querySelector('main button[aria-expanded]').getAttribute('aria-expanded')`), 'false');
  evidence.push({ flow: 'FAQ opens and closes through actual pointer events', passed: true });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const touch = await page.evaluate(`(() => { const el=document.querySelector('main button[aria-expanded]');el.scrollIntoView({block:'center',behavior:'instant'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...touch, id: 1 }] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitFor(`document.querySelector('main button[aria-expanded]')?.getAttribute('aria-expanded') === 'true'`);
  await page.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  assert.equal(await page.evaluate('visualViewport.scale'), 2);
  evidence.push({ flow: 'Emulated mobile touch opens FAQ; pinch zoom reaches 200%', passed: true, physicalTouch: false, desktopBrowserZoom: false });
  await page.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  const accessibility = await page.send('Accessibility.getFullAXTree');
  evidence.push({ flow: 'Chrome accessibility tree available', nodes: accessibility.nodes.length, physicalScreenReader: false });
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, 'interactions-faq.png'), Buffer.from(data, 'base64'));
} catch (error) {
  evidence.push({ failed: String(error) });
  evidence.push(await page.evaluate(`({url:location.href,text:document.body?.innerText?.slice(0,3000)})`));
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'platform-interactions.json'), JSON.stringify({ provenance: 'Local Chrome and intercepted synthetic Core responses', evidence, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
  await sleep(1000);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log(JSON.stringify(evidence, null, 2));
