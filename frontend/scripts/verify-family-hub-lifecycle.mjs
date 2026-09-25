// S07.1 (D.5 / OD-21) browser matrix: the actual Family and Tasks routes in
// local Chrome, real pointer + keyboard input, synthetic Core responses.
//
// Parent journey (/family): the invited-adult status list; the Tutors panel
// (failed confirm, Enter retry, confirmed pending Tutor re-read, the
// step-away question answered with Stay and no request); coin corrections
// (local reason/amount validation, a protected-savings refusal, a saved
// correction re-read into the history), moving coins out of a goal, and
// marking an approved reward delivered.
// Child journey (/tasks as a kid): the history shows each Tutor reason and a
// delivered reward.
// Every configuration: 3 locales x light/dark x 375/1280 px, scoped axe with
// zero violations, no panel overflow, 48 px targets, no browser errors.
//
// Usage (dev server running):  FAMILY_HUB_URL=http://localhost:5340 node scripts/verify-family-hub-lifecycle.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.FAMILY_HUB_URL ?? 'http://localhost:5340';
const out = resolve(process.env.FAMILY_HUB_OUT ?? '../audit-results/family-hub-lifecycle'); mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const parentId = '11111111-1111-4111-8111-111111111111';
const kidId = '22222222-2222-4222-8222-222222222222';
const linkMe = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const linkPending = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const goalId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const redemptionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const catalogId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const T = '2026-09-20T10:00:00.000Z';
const token = (sub) => 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub, is_anonymous: false })).toString('base64url') + '.synthetic';

let locale = 'en-US', theme = 'light', role = 'parent';
let state;
const evidence = [];
function reset() {
  state = { confirmCalls: 0, decided: false, leaveCalls: 0, adjustCalls: 0, adjustBodies: [], actions: [], withdrawals: 0, goalSaved: 6, delivered: false, fulfillCalls: 0 };
}
const guardians = () => ({ guardians: [
  { linkId: linkMe, displayName: 'Ana', status: 'verified', isMe: true, since: T, decidedAt: null, revokedAt: null },
  { linkId: linkPending, displayName: 'Luis', status: state.decided ? 'verified' : 'pending', isMe: false, since: T, decidedAt: state.decided ? T : null, revokedAt: null },
] });

await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data); if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params; const url = new URL(request.url);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return void await page.send('Fetch.continueRequest', { requestId });
    if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    let status = 200; const body = { data: {}, error: null }; const p = url.pathname.replace('/api/v1', ''); const method = request.method;
    const fail = (code, s = 409) => { status = s; body.data = null; body.error = { code, message: 'Synthetic' }; };
    if (method !== 'OPTIONS') {
      if (p === '/auth/me') body.data = { profile: { display_name: role === 'parent' ? 'Ana' : 'Nico', locale, theme, cover: {} }, roles: [role], avatarOptions: {}, analyticsEnabled: false, isGuest: false, newAccount: false, onboardingComplete: true };
      else if (p === '/auth/age-screen') body.data = { required: false, ageBand: role === 'parent' ? 'adult' : 'under_13', protectedOrigin: false };
      else if (p === '/family/kids') body.data = { kids: [{ userId: kidId, displayName: 'Nico', username: 'nico', analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 12, taskStreakDays: 0 }] };
      else if (p === '/family/guardian-links/mine') body.data = { links: [{ linkId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', kidDisplayName: 'Sol', status: 'pending', updatedAt: T }] };
      else if (p === `/family/kids/${kidId}/guardians`) body.data = guardians();
      else if (p === `/family/kids/${kidId}/guardians/${linkPending}/decision`) {
        state.confirmCalls++; await sleep(200);
        if (state.confirmCalls === 1) fail('DATA_UNAVAILABLE', 502);
        else { state.decided = true; body.data = { linkId: linkPending, status: 'verified' }; }
      } else if (p === `/family/kids/${kidId}/guardians/leave`) { state.leaveCalls++; body.data = { status: 'revoked' }; }
      else if (p === `/tasks/${kidId}/goals`) body.data = { goals: [{ id: goalId, kidUserId: kidId, title: 'Bike', target: 10, icon: 'bike', status: 'active', createdAt: T, reachedAt: null, saved: state.goalSaved }] };
      else if (p === '/tasks/redemptions' && url.searchParams.get('kidId') === kidId) body.data = { redemptions: [{ id: redemptionId, catalogId, kidUserId: kidId, status: state.delivered ? 'fulfilled' : 'approved', createdAt: T, decidedAt: T, decidedBy: parentId, fulfilledAt: state.delivered ? T : null }] };
      else if (p === '/tasks/catalog') body.data = { items: [{ id: catalogId, parentUserId: parentId, title: 'Movie night', cost: 5, active: true, createdAt: T }] };
      else if (p === `/tasks/${kidId}/wallet/guardian-actions`) body.data = { actions: state.actions };
      else if (p === `/tasks/${kidId}/wallet/adjustments`) {
        state.adjustCalls++; const sent = JSON.parse(request.postData); state.adjustBodies.push(sent); await sleep(150);
        if (sent.bucket === 'save' && sent.amount < 0) fail('GOAL_SAVINGS_PROTECTED');
        else { state.actions = [{ id: '99999999-9999-4999-8999-99999999999' + state.adjustCalls, kind: 'manual_adjustment', bucket: sent.bucket, goalId: null, amount: sent.amount, reason: sent.reason, byMe: true, createdAt: T }, ...state.actions]; body.data = { actionId: '99999999-9999-4999-8999-999999999990' }; }
      } else if (p === `/tasks/${kidId}/goals/${goalId}/withdrawals`) {
        const sent = JSON.parse(request.postData); state.withdrawals++; state.goalSaved -= sent.amount;
        state.actions = [{ id: '88888888-8888-4888-8888-88888888888' + state.withdrawals, kind: 'goal_withdrawal', bucket: sent.destination, goalId, amount: sent.amount, reason: sent.reason, byMe: true, createdAt: T }, ...state.actions];
        body.data = { actionId: '88888888-8888-4888-8888-888888888880', goal: { id: goalId, title: 'Bike', target: 10, status: 'active', saved: state.goalSaved } };
      } else if (p === `/tasks/redemptions/${redemptionId}/fulfill`) { state.fulfillCalls++; state.delivered = true; body.data = { fulfilled: true }; }
      // Child board.
      else if (p === '/tasks/mine') body.data = { tasks: [] };
      else if (p === '/tasks/wallet') body.data = { balances: { save: 2, spend: 11, share: 1 } };
      else if (p === '/tasks/goals') body.data = { goals: [] };
      else if (p === '/tasks/streak') body.data = { streak: { status: 'none', current: 0, best: 0, totalDays: 0, restDaysLeftThisWeek: 2, restDaysPerWeek: 2, pausedUntil: null, today: '2026-09-20' } };
      else if (p === '/tasks/catalog/available') body.data = { items: [{ id: catalogId, parentUserId: parentId, title: 'Movie night', cost: 5, active: true, createdAt: T }] };
      else if (p === '/tasks/redemptions/mine') body.data = { redemptions: [{ id: redemptionId, catalogId, kidUserId: kidId, status: 'fulfilled', createdAt: T, decidedAt: T, decidedBy: parentId, fulfilledAt: T }] };
      else if (p === '/tasks/wallet/ledger') body.data = { entries: [
        { id: 3, bucket: 'spend', amount: 4, reason: 'goal_withdrawal', taskId: null, goalId: null, redemptionId: null, note: 'Bought the bike together', createdAt: T },
        { id: 2, bucket: 'spend', amount: -2, reason: 'manual_adjustment', taskId: null, goalId: null, redemptionId: null, note: 'Paid back the lost ball', createdAt: T },
        { id: 1, bucket: 'save', amount: 5, reason: 'task_approved', taskId: null, goalId: null, redemptionId: null, note: null, createdAt: T },
      ] };
      else if (p === '/analytics/tracking-decision') body.data = { excluded: true, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});

async function wait(expression) { for (let i = 0; i < 200; i++) { try { if (await page.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
const inPanel = (panel) => `document.querySelector('[data-family-hub=${panel}]')`;
async function click(panel, text) {
  const lookup = `[...${inPanel(panel)}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && !e.disabled)`;
  await wait(`!!(${lookup})`);
  const point = await page.evaluate(`(() => { const e=${lookup}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded action ${text}'); return {x,y}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function type(panel, label, text) {
  const lookup = `[...${inPanel(panel)}.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(label)} && document.getElementById(l.htmlFor) && !document.getElementById(l.htmlFor).disabled)`;
  await wait(`!!(${lookup})`);
  const point = await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.scrollIntoView({block:'center',behavior:'instant'}); f.select?.(); const r=f.getBoundingClientRect(); return {x:r.x+Math.min(20,r.width/2),y:r.y+r.height/2}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.select?.(); })()`);
  await page.send('Input.insertText', { text });
}
async function typeInto(selector, text) {
  const point = await page.evaluate(`(() => { const f=${selector}; f.scrollIntoView({block:'center',behavior:'instant'}); const r=f.getBoundingClientRect(),x=r.x+Math.min(20,r.width/2),y=r.y+r.height/2; if(!f.contains(document.elementFromPoint(x,y))) throw Error('Occluded field'); return {x,y}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.insertText', { text });
}
async function enter() {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}
async function settle() { await page.evaluate('Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished.catch(() => {}))).then(() => document.fonts.ready).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))'); }
async function audit(panel) {
  await settle();
  const geometry = await page.evaluate(`(() => { const e=${inPanel(panel)}; const small=[...e.querySelectorAll('button,input,select,textarea')].filter(c=>{const r=c.getBoundingClientRect();return r.width<48||r.height<48;}).map(c=>c.textContent.trim()||c.tagName); const unroled=[]; const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT); for(let n=w.nextNode();n;n=w.nextNode()){ if(n.textContent.trim() && !n.parentElement.closest('[data-copy-role]')) unroled.push(n.textContent.trim()); } return { scroll:e.scrollWidth, client:e.clientWidth, small, unroled, pageScroll: document.documentElement.scrollWidth - innerWidth }; })()`);
  assert.ok(geometry.scroll <= geometry.client + 1, `${panel} overflows`);
  assert.ok(geometry.pageScroll <= 1, `${panel} causes horizontal page scroll`);
  assert.deepEqual(geometry.small, [], `${panel} has targets under 48 px`);
  assert.deepEqual(geometry.unroled, [], `${panel} has text without a copy role`);
  const axe = await page.evaluate(`axe.run(${inPanel(panel)})`);
  assert.deepEqual(axe.violations.map((v) => v.id), [], `${panel} axe violations`);
  return geometry;
}
async function load(path, sub) {
  const session = { accessToken: token(sub), refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id: sub }, isGuest: false };
  await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
  const previous = await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate', { url: origin + path });
  await wait(`performance.timeOrigin !== ${previous}`);
}

try {
  await warmDevServer(page, origin); await page.send('Page.navigate', { url: origin }); await wait('!!document.body');
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');
  for (locale of ['en-US', 'es-MX', 'pt-BR']) for (theme of ['light', 'dark']) for (const width of [375, 1280]) {
    const copy = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/familyHub.json`), 'utf8'));
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    // ── Parent ──
    role = 'parent'; reset();
    await load('/family', parentId);
    await wait(`${inPanel('co-guardians')}?.dataset.theme === ${JSON.stringify(theme)} && ${inPanel('co-guardians')}?.lang === ${JSON.stringify(locale)}`);
    await page.evaluate(axeSource);
    await wait(`${inPanel('guardian-requests')}?.innerText.includes(${JSON.stringify(copy.guardianRequests.pending.replace('{name}', 'Sol'))})`);
    await audit('guardian-requests');

    const c = copy.coGuardians;
    await click('co-guardians', c.title);
    await wait(`${inPanel('co-guardians')}.querySelectorAll('li').length === 2`);
    await click('co-guardians', c.confirm);
    await wait(`!!${inPanel('co-guardians')}.querySelector('[role=alert]') && ${inPanel('co-guardians')}.innerText.includes(${JSON.stringify(c.decisionFailed)})`);
    assert.equal(state.decided, false, 'A failed confirmation must not show as confirmed');
    await wait(`${inPanel('co-guardians')}.querySelectorAll('[data-link-status=pending]').length === 1`);
    await page.evaluate(`[...${inPanel('co-guardians')}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(c.confirm)}).focus()`);
    await enter();
    await wait(`${inPanel('co-guardians')}.innerText.includes(${JSON.stringify(c.confirmed)}) && ${inPanel('co-guardians')}.querySelectorAll('[data-link-status=verified]').length === 2`);
    assert.equal(state.confirmCalls, 2);
    await click('co-guardians', c.leave);
    await wait(`[...${inPanel('co-guardians')}.querySelectorAll('button')].map(b=>b.textContent.trim()).join('|').includes(${JSON.stringify(c.keep + '|' + c.leaveConfirm)})`);
    const coGeometry = await audit('co-guardians');
    await click('co-guardians', c.keep);
    await wait(`[...${inPanel('co-guardians')}.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(c.leave)})`);
    assert.equal(state.leaveCalls, 0, 'Stay must not step away');

    const w = copy.walletCorrections;
    await click('wallet-corrections', w.title);
    await wait(`!!${inPanel('wallet-corrections')}.querySelector('form')`);
    await click('wallet-corrections', w.save); await click('wallet-corrections', w.remove);
    await type('wallet-corrections', w.amount, '3');
    await click('wallet-corrections', w.submit);
    await wait(`${inPanel('wallet-corrections')}.innerText.includes(${JSON.stringify(w.reasonRequired)})`);
    assert.equal(state.adjustCalls, 0, 'A correction without a reason reached Core');
    await type('wallet-corrections', w.reason, 'Counted twice by mistake');
    await click('wallet-corrections', w.submit);
    await wait(`${inPanel('wallet-corrections')}.innerText.includes(${JSON.stringify(w.protected)})`);
    await click('wallet-corrections', w.spend);
    await click('wallet-corrections', w.submit);
    await wait(`${inPanel('wallet-corrections')}.innerText.includes(${JSON.stringify(w.saved)}) && ${inPanel('wallet-corrections')}.querySelectorAll('[data-action-kind=manual_adjustment]').length === 1`);
    assert.deepEqual(state.adjustBodies.at(-1), { bucket: 'spend', amount: -3, reason: 'Counted twice by mistake' });
    await click('wallet-corrections', w.moveOut);
    const moveForm = `${inPanel('wallet-corrections')}.querySelector('form[aria-label=${JSON.stringify(w.moveOut)}]')`;
    await wait(`!!${moveForm}`);
    await typeInto(`${moveForm}.querySelector('input')`, '2');
    await typeInto(`${moveForm}.querySelector('textarea')`, 'Bought the bike together');
    await page.evaluate(`[...${moveForm}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(w.moveOut)}).focus()`);
    await enter();
    await wait(`${inPanel('wallet-corrections')}.innerText.includes(${JSON.stringify(w.moved)}) && ${inPanel('wallet-corrections')}.querySelectorAll('[data-action-kind=goal_withdrawal]').length === 1`);
    assert.equal(state.goalSaved, 4);
    await wait(`${inPanel('wallet-corrections')}.innerText.includes(${JSON.stringify(w.goalSaved.replace('{saved}', '4').replace('{target}', '10'))})`);
    const shotParent = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await click('wallet-corrections', w.deliver);
    await wait(`${inPanel('wallet-corrections')}.innerText.includes(${JSON.stringify(w.delivered)}) && ${inPanel('wallet-corrections')}.innerText.includes(${JSON.stringify(w.noRewards)})`);
    assert.equal(state.fulfillCalls, 1);
    const walletGeometry = await audit('wallet-corrections');
    await page.evaluate(`${inPanel('wallet-corrections')}.scrollIntoView({block:'start',behavior:'instant'})`);
    await settle();
    writeFileSync(join(out, `${locale}-${theme}-${width}-parent.png`), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    writeFileSync(join(out, `${locale}-${theme}-${width}-parent-before-delivery.png`), Buffer.from(shotParent.data, 'base64'));

    // ── Child ──
    role = 'kid';
    await load('/tasks', kidId);
    await wait(`${inPanel('wallet-activity')}?.dataset.theme === ${JSON.stringify(theme)} && ${inPanel('wallet-activity')}?.lang === ${JSON.stringify(locale)}`);
    await page.evaluate(axeSource);
    const a = copy.walletActivity;
    await click('wallet-activity', a.open);
    await wait(`${inPanel('wallet-activity')}.innerText.includes(${JSON.stringify(a.note.replace('{note}', 'Paid back the lost ball'))}) && ${inPanel('wallet-activity')}.innerText.includes(${JSON.stringify(a.fulfilled)})`);
    assert.ok(await page.evaluate(`${inPanel('wallet-activity')}.innerText.includes(${JSON.stringify(a.note.replace('{note}', 'Bought the bike together'))})`));
    assert.ok(!(await page.evaluate(`/confetti|celebrat/i.test(${inPanel('wallet-activity')}.innerHTML)`)));
    const kidGeometry = await audit('wallet-activity');
    await page.evaluate(`${inPanel('wallet-activity')}.scrollIntoView({block:'start',behavior:'instant'})`);
    await settle();
    writeFileSync(join(out, `${locale}-${theme}-${width}-kid.png`), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    evidence.push({ locale, theme, width, invitedStatus: true, confirmFailureThenEnterRetry: true, stayWithoutRequest: true, reasonRequiredLocally: true, protectedRefusal: true, correctionReRead: true, goalMoveByKeyboard: true, delivered: true, childSeesReasons: true, axeViolations: 0, geometry: { co: coGeometry, wallet: walletGeometry, kid: kidGeometry } });
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (shot) writeFileSync(join(out, 'failure.png'), Buffer.from(shot.data, 'base64'));
  evidence.push({ failed: String(error), locale, theme, state: await page.evaluate('document.body.innerText.slice(0,2500)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Actual Family and Tasks routes in local Chrome with real pointer/keyboard input; synthetic Core. API and PostgreSQL evidence are separate; not full-stack E2E.', journeys: evidence.filter((e) => !e.failed).length, evidence, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
}
console.log(JSON.stringify({ journeys: evidence.filter((e) => !e.failed).length, failed: evidence.filter((e) => e.failed) }));
