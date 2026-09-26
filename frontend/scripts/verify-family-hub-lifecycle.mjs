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
// S07.4 (D.16): a goal always arrives with its provenance; here every coin in it is the child's own.
const kidGoal = () => ({ id: goalId, kidUserId: kidId, title: 'Bike', target: 10, icon: 'bike', status: 'active', createdAt: T, reachedAt: null, followsGoalId: null,
  saved: state.goalSaved, progress: { own: state.goalSaved, bonus: 0, family: 0, total: state.goalSaved }, nextStep: null });
// The S05/S07 panels that now share the Family and Tasks pages, answered as Core would for
// a young child with nothing pending, so none of them fails around the panels under test.
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const autonomy = { inFamily: true, level: 1, storedLevel: 1, levelSince: null, preapprovedLimit: 0, preapprovedCap: 0, unlocks: { selfLogContributions: false, selfLogMaxCoins: null },
  next: { level: 2, eligible: false, age: { value: 9, min: 8, ok: true }, approved: { value: 4, min: 10 }, notApproved: { value: 0, maxPct: 25, ok: true }, daysAtLevel: { value: 30, min: 0, ok: true }, windowDays: 60 }, request: null };
const learningStreak = () => ({ model: 'rest-days-v1', status: 'open', current: 3, best: 5, daysPracticed: 12, restDaysLeft: 1, lastActiveDate: day(-1), pause: null });
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
      else if (p === `/tasks/${kidId}/goals`) body.data = { goals: [kidGoal()] };
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
        body.data = { actionId: '88888888-8888-4888-8888-888888888880', goal: kidGoal() };
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
      // S05/S07 neighbours on the same pages.
      else if (p === '/banking/register') body.data = { register: 'young' };
      else if (p === '/family-hub/coaching') body.data = { tip: null };
      else if (p === `/tutor/consent/${kidId}`) body.data = { active: false, grantedAt: null, locale: null, policy: 'allowed' };
      else if (p === `/family/learning/kids/${kidId}/streak`) body.data = { streak: learningStreak() };
      else if (p === `/family/learning/kids/${kidId}/bridges`) body.data = { prompts: [] };
      else if (p === '/tasks/share') body.data = { destinations: [], gifts: [] };
      else if (p === '/tasks/decisions/mine') body.data = { decisions: [] };
      else if (p === '/tasks/autonomy') body.data = { autonomy, changes: [] };
      else if (p === '/analytics/tracking-decision') body.data = { excluded: true, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});

async function wait(expression) { for (let i = 0; i < 200; i++) { try { if (await page.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
const inPanel = (panel) => `document.querySelector('[data-family-hub=${panel}]')`;
async function stablePoint(lookup, label, centre = false) {
  // The pointer lands where the element IS: wait until it holds still for two frames (a
  // notice or a re-read can still be shifting the layout), then refuse an occluded point.
  return page.evaluate(`(async () => { const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    let last = null;
    for (let i = 0; i < 30; i++) { const e=${lookup}; if (!e) { await frame(); continue; } e.scrollIntoView({block:'center',behavior:'instant'}); await frame();
      const r=e.getBoundingClientRect(); const key=r.x+':'+r.y+':'+r.width+':'+r.height;
      if (key === last) { const x=r.x+(${centre} ? r.width/2 : Math.min(r.width/2, 20)),y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error(${JSON.stringify('Occluded ')} + ${JSON.stringify(label)}); return {x,y}; }
      last = key; }
    throw Error(${JSON.stringify('Unstable ')} + ${JSON.stringify(label)}); })()`);
}
async function click(panel, text) {
  // A button, or a shared radio/checkbox, which is pressed through its visible <label>.
  const lookup = `[...${inPanel(panel)}.querySelectorAll('button,label:has(> input[type=radio]),label:has(input[type=checkbox])')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && !e.disabled && !e.querySelector('input:disabled'))`;
  await wait(`!!(${lookup})`);
  const point = await stablePoint(lookup, 'action ' + text, true);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function type(panel, label, text) {
  const lookup = `[...${inPanel(panel)}.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(label)} && document.getElementById(l.htmlFor) && !document.getElementById(l.htmlFor).disabled)`;
  await wait(`!!(${lookup})`);
  const point = await stablePoint(`document.getElementById((${lookup}).htmlFor)`, 'field ' + label);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.select?.(); })()`);
  await page.send('Input.insertText', { text });
}
async function typeInto(selector, text) {
  const point = await stablePoint(selector, 'field');
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.insertText', { text });
}
async function enter() {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}
async function settle() {
  // The app shell cross-fades every color for 500 ms whenever it re-applies the theme
  // (html.theme-transitioning), and a colour transition can start a frame after the last
  // check on a busy machine: contrast sampled mid-fade is meaningless. Settle until two
  // frames pass with no finite animation or transition left running.
  await wait(`!document.documentElement.classList.contains('theme-transitioning')`);
  for (let i = 0; i < 20; i++) {
    const running = await page.evaluate('(async () => { const live = document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(a.effect?.getTiming().iterations)); await Promise.all(live.map(a => a.finished.catch(() => {}))); await document.fonts.ready; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return live.length + (document.documentElement.classList.contains("theme-transitioning") ? 1 : 0); })()');
    if (!running) return;
  }
}
async function audit(panel) {
  await settle();
  const geometry = await page.evaluate(`(() => { const e=${inPanel(panel)}; const small=[...e.querySelectorAll('button,input,select,textarea')].filter(c=>{const t=c.matches('input[type=radio],input[type=checkbox]')?(c.closest('label')??(c.id&&document.querySelector('label[for="'+c.id+'"]'))??c):c;const r=t.getBoundingClientRect();return r.width<48||r.height<48;}).map(c=>c.textContent.trim()||c.tagName); const unroled=[]; const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT); for(let n=w.nextNode();n;n=w.nextNode()){ if(n.textContent.trim() && !n.parentElement.closest('[data-copy-role]')) unroled.push(n.textContent.trim()); } return { scroll:e.scrollWidth, client:e.clientWidth, small, unroled, pageScroll: document.documentElement.scrollWidth - innerWidth }; })()`);
  assert.ok(geometry.scroll <= geometry.client + 1, `${panel} overflows`);
  assert.ok(geometry.pageScroll <= 1, `${panel} causes horizontal page scroll`);
  assert.deepEqual(geometry.small, [], `${panel} has targets under 48 px`);
  assert.deepEqual(geometry.unroled, [], `${panel} has text without a copy role`);
  const axe = await page.evaluate(`axe.run(${inPanel(panel)})`);
  assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${JSON.stringify(n.any?.[0]?.data ?? null)}`).join(', ')}`), [], `${panel} axe violations`);
  return geometry;
}
async function load(path, sub) {
  const session = { accessToken: token(sub), refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id: sub }, isGuest: false };
  await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
  const previous = await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate', { url: origin + path });
  await wait(`performance.timeOrigin !== ${previous}`);
  await mounted();
}
// A reload re-requests every module from Vite; on a busy machine the app can take far longer
// than one 20 s wait to mount. That is start-up, not the surface under test: wait for the
// mount with the warm-up's own ceiling, then every assertion keeps its usual wait.
async function mounted() {
  const started = Date.now();
  for (let i = 0; i < 180; i++) {
    try { if (await page.evaluate('(document.getElementById("root")?.innerHTML.length ?? 0) > 0')) { if (Date.now() - started > 5000) console.log(`  [load] app mounted after ${((Date.now() - started) / 1000).toFixed(0)}s`); return; } }
    catch (e) { if (!/context|navigat/i.test(String(e))) throw e; }
    await sleep(1000);
  }
  throw Error('The app never mounted after a reload');
}

try {
  await warmDevServer(page, origin); await page.send('Page.navigate', { url: origin }); await wait('!!document.body');
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');
  const only = (name, all) => (process.env[name] ? process.env[name].split(',') : all);
  for (locale of only('FAMILY_HUB_LOCALES', ['en-US', 'es-MX', 'pt-BR'])) for (theme of only('FAMILY_HUB_THEMES', ['light', 'dark'])) for (const width of only('FAMILY_HUB_WIDTHS', ['375', '1280']).map(Number)) {
    const copy = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/familyHub.json`), 'utf8'));
    const goalOf = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/moneyHabits.json`), 'utf8')).goalProgressTutor.of;
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
    await typeInto(`${moveForm}.querySelector('input:not([type=radio])')`, '2');
    await typeInto(`${moveForm}.querySelector('textarea')`, 'Bought the bike together');
    await page.evaluate(`[...${moveForm}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(w.moveOut)}).focus()`);
    await enter();
    await wait(`${inPanel('wallet-corrections')}.innerText.includes(${JSON.stringify(w.moved)}) && ${inPanel('wallet-corrections')}.querySelectorAll('[data-action-kind=goal_withdrawal]').length === 1`);
    assert.equal(state.goalSaved, 4);
    await wait(`${inPanel('wallet-corrections')}.innerText.includes(${JSON.stringify(goalOf.replace('{saved}', '4').replace('{target}', '10'))})`);
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
