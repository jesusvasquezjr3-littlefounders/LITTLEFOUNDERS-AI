// S07.5 (D.17, D.18) browser matrix: the actual Tasks and Family routes in
// local Chrome, real pointer + keyboard input, synthetic Core responses.
//
// Tutor journey (/tasks): the decision queue.
//   - the child's own words sit next to each request (their note on a chore,
//     their reason and note on a reward);
//   - "Send back" opens the reason form: sending with no reason code, then
//     with "Not now", is refused locally with no request; an actionable reason
//     is sent with the exact body;
//   - a reward "Not yet" with "later" carries a date (exact body);
//   - the "talk about it" card closes as "we talked", and a self-directed item
//     is confirmed afterwards (exact bodies).
// Tutor journey (/family): one child's independence level. The rule is shown
//   with the child's own numbers; "Move up" (exact body); the pre-approved
//   amount is raised within the cap and saved; "Move down" needs a reason
//   (exact body).
// Child journey (/tasks, a parent-created child):
//   - my level, what it unlocks and my progress to the next; asking for it
//     in my own words (exact body);
//   - a "not yet" shows the Tutor's reason and the date, and "Let's talk" is
//     sent once;
//   - a chore is marked done with my note and is counted by my level;
//   - a reward is asked for only with a reason picked (none: refused locally),
//     and is approved by my level.
// Every configuration: 3 locales x light/dark x 375/1280 px, scoped axe with
// zero violations, no panel overflow or page scroll, 48 px targets, a copy
// role on every text node, no celebration, zero browser errors.
//
// Usage (dev server running):  FAMILY_AUTONOMY_URL=http://localhost:5340 node scripts/verify-family-autonomy.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.FAMILY_AUTONOMY_URL ?? 'http://localhost:5340';
const out = resolve(process.env.FAMILY_AUTONOMY_OUT ?? '../audit-results/family-autonomy'); mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const parentId = '11111111-1111-4111-8111-111111111111';
const kidId = '22222222-2222-4222-8222-222222222222';
const choreId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const openChoreId = 'abababab-abab-4aba-8aba-abababababab';
const redId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const catalogId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const selfDecisionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const deniedId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const nudgeId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const requestId = '44444444-4444-4444-8444-444444444444';
const T = '2026-09-20T10:00:00.000Z';
const token = (sub) => 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub, is_anonymous: false })).toString('base64url') + '.synthetic';
const GOOD = 'Rinse the cups in the sink too, then mark it again.';

let locale = 'en-US', theme = 'light', role = 'parent';
let state;
const evidence = [];
function reset() {
  state = { posts: [], sentBack: false, denied: false, talked: false, confirmed: false, level: 1, limit: 0, asked: false, talkAsked: false, choreDone: false, preapproved: false };
}
const day = (n) => { const d = new Date(Date.now() + n * 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const wireTask = (over) => ({ id: choreId, assignedBy: parentId, assignedTo: kidId, title: 'Dishes', rewardCoins: 3, recurrence: 'once', dueAt: null, status: 'done', allocated: false,
  createdAt: T, hasEvidence: false, requiresEvidence: false, cancelReason: null, kind: 'bonus', completedOn: '2026-09-20', childNote: 'I also dried them', ...over });
const queue = () => ({
  chores: state.sentBack ? [] : [wireTask()],
  openChores: [],
  rewards: state.denied ? [] : [{ id: redId, catalogId, kidUserId: kidId, status: 'requested', createdAt: T, decidedAt: null, decidedBy: null, fulfilledAt: null,
    childReasonKind: 'saved_for_it', childNote: 'Three weeks of saving', title: 'Cinema', cost: 10 }],
  reviews: state.confirmed ? [] : [{ id: selfDecisionId, subject: 'task', subjectId: openChoreId, title: 'Feed the cat', outcome: 'self_logged', by: 'child', byMe: false,
    reasonCode: null, reason: null, revisitOn: null, reviewsDecisionId: null, createdAt: T, kidUserId: kidId }],
  nudges: state.talked ? [] : [{ id: nudgeId, kidUserId: kidId, origin: 'pattern', decisionId: deniedId, denials: 3, status: 'open', createdAt: T, decision: null }],
  levelRequests: [],
});
const eligibility = (level) => level === 1
  ? { level: 2, eligible: true, age: { value: 9, min: 8, ok: true }, approved: { value: 12, min: 10 }, notApproved: { value: 2, maxPct: 25, ok: true }, daysAtLevel: { value: 0, min: 0, ok: true }, windowDays: 60 }
  : level === 2
    ? { level: 3, eligible: false, age: { value: 9, min: 12, ok: false }, approved: { value: 7, min: 20 }, notApproved: { value: 1, maxPct: 20, ok: true }, daysAtLevel: { value: 3, min: 28, ok: false }, windowDays: 60 }
    : null;
const autonomy = () => ({ inFamily: true, level: state.level, storedLevel: state.level, levelSince: state.level > 1 ? T : null, preapprovedLimit: state.limit,
  preapprovedCap: { 1: 0, 2: 20, 3: 100 }[state.level], unlocks: { selfLogContributions: state.level >= 2, selfLogMaxCoins: state.level >= 3 ? 100 : null },
  next: eligibility(state.level), request: state.asked ? { id: requestId, level: state.level + 1, note: 'I did every chore', createdAt: T } : null });
const changes = () => state.level === 1 && state.limit === 0 && !state.changed ? [] : [{ id: requestId, fromLevel: 2, toLevel: 1, fromLimit: 10, toLimit: 0, by: 'tutor', byMe: true,
  reasonCode: 'practice_more', reason: 'Let us practise saving before the next step.', createdAt: T }];
const myDecisions = () => [
  { id: deniedId, subject: 'redemption', subjectId: redId, title: 'Cinema', outcome: 'denied', by: 'tutor', byMe: false, reasonCode: 'later_date',
    reason: 'Let us wait until after your test on Friday.', revisitOn: '2026-10-01', reviewsDecisionId: null, createdAt: T, notYet: true, talk: state.talkAsked ? 'open' : null },
  { id: selfDecisionId, subject: 'task', subjectId: openChoreId, title: 'Feed the cat', outcome: 'self_logged', by: 'child', byMe: true, reasonCode: null, reason: null,
    revisitOn: null, reviewsDecisionId: null, createdAt: T, notYet: false, talk: null },
];

await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data); if (message.method !== 'Fetch.requestPaused') return;
  const { requestId: rid, request } = message.params; const url = new URL(request.url);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return void await page.send('Fetch.continueRequest', { requestId: rid });
    if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId: rid, errorReason: 'BlockedByClient' });
    const body = { data: {}, error: null }; const p = url.pathname.replace('/api/v1', ''); const method = request.method;
    const sent = request.postData ? JSON.parse(request.postData) : undefined;
    if (method !== 'OPTIONS' && method !== 'GET') state.posts.push({ method, path: p, body: sent });
    if (method !== 'OPTIONS') {
      const me = role === 'parent' ? 'Ana' : 'Nico';
      if (p === '/auth/me') body.data = { profile: { display_name: me, locale, theme, cover: {} }, roles: [role], avatarOptions: {}, analyticsEnabled: false, isGuest: false, newAccount: false, onboardingComplete: true };
      else if (p === '/auth/age-screen') body.data = { required: false, ageBand: role === 'parent' ? 'adult' : 'under_13', protectedOrigin: false };
      else if (p === '/wallet/access') body.data = { holder: role === 'kid' ? 'managed_child' : null, familyChild: role === 'kid' };
      else if (p === '/family/kids') body.data = { kids: [{ userId: kidId, displayName: 'Nico', username: 'nico', analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 12, taskStreakDays: 6, accountType: 'child' }] };
      else if (p === '/family/guardian-links/mine') body.data = { links: [] };
      // Tutor: the decision queue (D.18) and the ladder (D.17).
      else if (p === '/tasks/decisions/queue') body.data = queue();
      else if (p === `/tasks/${choreId}/send-back`) { await sleep(60); state.sentBack = true; body.data = { task: wireTask({ status: 'open', completedOn: null }) }; }
      else if (p === `/tasks/redemptions/${redId}/decide`) { state.denied = true; body.data = { decided: true, status: sent.approve ? 'approved' : 'denied' }; }
      else if (p === `/tasks/nudges/${nudgeId}/close`) { state.talked = true; body.data = { status: sent.outcome }; }
      else if (p === `/tasks/decisions/${selfDecisionId}/review`) { state.confirmed = true; body.data = { outcome: sent.outcome }; }
      else if (p === `/tasks/${kidId}/autonomy` && method === 'GET') body.data = { autonomy: autonomy(), changes: changes() };
      else if (p === `/tasks/${kidId}/autonomy` && method === 'PUT') { await sleep(60); state.level = sent.level; state.limit = sent.preapprovedLimit; state.changed = true; body.data = { level: sent.level, autonomy: autonomy() }; }
      else if (p === '/tasks' && method === 'GET') body.data = { tasks: [wireTask()] };
      else if (p === '/tasks/catalog' && method === 'GET') body.data = { items: [{ id: catalogId, parentUserId: parentId, title: 'Sticker', cost: 5, active: true, createdAt: T }] };
      else if (p === '/tasks/redemptions' && method === 'GET') body.data = { redemptions: [] };
      // Child: tasks, level, notes, requests.
      else if (p === '/tasks/mine') body.data = { tasks: [wireTask({ id: openChoreId, title: 'Make the bed', status: state.choreDone ? 'approved' : 'open', kind: 'contribution', rewardCoins: 0, childNote: null, completedOn: null })] };
      else if (p === '/tasks/autonomy' && method === 'GET') body.data = { autonomy: autonomy(), changes: [] };
      else if (p === '/tasks/autonomy/request') { state.asked = true; body.data = { requestId }; }
      else if (p === '/tasks/decisions/mine') body.data = { decisions: myDecisions() };
      else if (p === `/tasks/decisions/${deniedId}/talk`) { state.talkAsked = true; body.data = { nudgeId }; }
      else if (p === `/tasks/${openChoreId}/complete`) { await sleep(60); state.choreDone = true; body.data = { task: wireTask({ id: openChoreId, status: 'approved', childNote: sent.note ?? null }), streak: null, milestone: null, selfLogged: true }; }
      else if (p === '/tasks/redemptions' && method === 'POST') { state.preapproved = true; body.data = { redemption: { id: redId, catalogId, kidUserId: kidId, status: 'approved', createdAt: T, decidedAt: T, decidedBy: null, fulfilledAt: null, childReasonKind: sent.reasonKind, childNote: sent.note ?? null }, preapproved: true }; }
      else if (p === '/tasks/streak') body.data = { streak: { status: 'alive', current: 3, best: 5, totalDays: 12, restDaysLeftThisWeek: 2, restDaysPerWeek: 2, pausedUntil: null, today: '2026-09-25' } };
      else if (p === '/tasks/wallet') body.data = { balances: { save: 40, spend: 11, share: 6 } };
      else if (p === '/tasks/wallet/split') body.data = { usual: { save: 50, spend: 40, share: 10 }, custom: false, recommended: { save: 50, spend: 40, share: 10 } };
      else if (p === '/tasks/goals') body.data = { goals: [] };
      else if (p === '/tasks/share') body.data = { destinations: [], gifts: [] };
      else if (p === '/tasks/catalog/available') body.data = { items: [{ id: catalogId, parentUserId: parentId, title: 'Sticker', cost: 5, active: true, createdAt: T }] };
      else if (p === '/tasks/redemptions/mine') body.data = { redemptions: state.preapproved ? [{ id: redId, catalogId, kidUserId: kidId, status: 'approved', createdAt: T, decidedAt: T, decidedBy: null, fulfilledAt: null, childReasonKind: 'treat', childNote: null }] : [] };
      else if (p === '/tasks/wallet/ledger') body.data = { entries: [] };
      else if (p === '/analytics/tracking-decision') body.data = { excluded: true, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId: rid, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});

async function wait(expression) { for (let i = 0; i < 200; i++) { try { if (await page.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
const inPanel = (panel) => `document.querySelector('[data-autonomy=${panel}]')`;
async function press(point) {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function click(panel, text, { scope = '' } = {}) {
  const root = scope ? `${inPanel(panel)}.querySelector(${JSON.stringify(scope)})` : inPanel(panel);
  const lookup = `[...${root}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && !e.disabled)`;
  await wait(`!!(${root}) && !!(${lookup})`);
  // Panels above load on their own; press only once the target has stopped moving.
  const point = await page.evaluate(`(async () => { const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    let last = null;
    for (let i = 0; i < 30; i++) { const e=${lookup}; if (!e) { await frame(); continue; } e.scrollIntoView({block:'center',behavior:'instant'}); await frame();
      const r=e.getBoundingClientRect(); const key=r.x+':'+r.y+':'+r.width+':'+r.height;
      if (key === last) { const x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error(${JSON.stringify('Occluded action ' + text)}); return {x,y}; }
      last = key; }
    throw Error(${JSON.stringify('Unstable action ' + text)}); })()`);
  await press(point);
}
async function type(panel, label, text) {
  const lookup = `[...${inPanel(panel)}.querySelectorAll('label, legend')].find(l=>l.textContent.trim()===${JSON.stringify(label)} && l.htmlFor && document.getElementById(l.htmlFor) && !document.getElementById(l.htmlFor).disabled)`;
  await wait(`!!(${lookup})`);
  await press(await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.scrollIntoView({block:'center',behavior:'instant'}); const r=f.getBoundingClientRect(); return {x:r.x+Math.min(20,r.width/2),y:r.y+r.height/2}; })()`));
  await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.select?.(); })()`);
  await page.send('Input.insertText', { text });
}
/** A date field: focused by pointer; the value is set through the native setter (the calendar widget's keyboard order differs by locale). */
async function pickDate(panel, label, value) {
  const lookup = `[...${inPanel(panel)}.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(label)})`;
  await wait(`!!(${lookup})`);
  await press(await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.scrollIntoView({block:'center',behavior:'instant'}); const r=f.getBoundingClientRect(); return {x:r.x+10,y:r.y+r.height/2}; })()`));
  await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f, ${JSON.stringify(value)}); f.dispatchEvent(new Event('input',{bubbles:true})); })()`);
}
async function settle() { await page.evaluate('Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished.catch(() => {}))).then(() => document.fonts.ready).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))'); }
async function audit(panel) {
  await settle();
  const geometry = await page.evaluate(`(() => { const e=${inPanel(panel)}; const small=[...e.querySelectorAll('button,input,select,textarea')].filter(c=>{const r=c.getBoundingClientRect();return r.width<48||r.height<48;}).map(c=>c.textContent.trim()||c.getAttribute('aria-label')||c.tagName); const unroled=[]; const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT); for(let n=w.nextNode();n;n=w.nextNode()){ if(n.textContent.trim() && !n.parentElement.closest('[data-copy-role]')) unroled.push(n.textContent.trim()); } return { scroll:e.scrollWidth, client:e.clientWidth, small, unroled, pageScroll: document.documentElement.scrollWidth - innerWidth, celebration: !!document.querySelector('[data-milestone], .lf-confetti, [data-celebration]') }; })()`);
  assert.ok(geometry.scroll <= geometry.client + 1, `${panel} overflows`);
  assert.ok(geometry.pageScroll <= 1, `${panel} causes horizontal page scroll`);
  assert.deepEqual(geometry.small, [], `${panel} has targets under 48 px`);
  assert.deepEqual(geometry.unroled, [], `${panel} has text without a copy role`);
  assert.equal(geometry.celebration, false, `${panel}: something celebrates (OD-7)`);
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
async function ready(panel) {
  await wait(`${inPanel(panel)}?.closest('[data-theme]')?.dataset.theme === ${JSON.stringify(theme)} && ${inPanel(panel)}?.closest('[lang]')?.lang === ${JSON.stringify(locale)}`);
}
async function shot(name, panel) {
  await page.evaluate(`${inPanel(panel)}.scrollIntoView({block:'start',behavior:'instant'})`);
  await settle();
  writeFileSync(join(out, `${locale}-${theme}-${name}.png`), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
}
const text = (panel) => page.evaluate(`${inPanel(panel)}.innerText`);
const has = (panel, s) => wait(`${inPanel(panel)}?.innerText.includes(${JSON.stringify(s)})`);
const fill = (s, values) => s.replace(/\{(\w+)\}/g, (_, k) => String(values[k]));

try {
  await warmDevServer(page, origin); await page.send('Page.navigate', { url: origin }); await wait('!!document.body');
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');
  for (locale of ['en-US', 'es-MX', 'pt-BR']) for (theme of ['light', 'dark']) for (const width of [375, 1280]) {
    const c = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/familyAutonomy.json`), 'utf8'));
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    reset(); role = 'parent';
    const geometry = {};

    // ── Tutor: the decision queue (D.18) ──
    await load('/tasks', parentId); await ready('queue'); await page.evaluate(axeSource);
    await has('queue', fill(c.queue.says, { name: 'Nico', note: 'I also dried them' }));
    await has('queue', fill(c.queue.wants, { name: 'Nico', reason: c.queue.saved_for_it }));
    await has('queue', fill(c.queue.talkPattern, { count: 3, name: 'Nico' }));
    geometry.queue = await audit('queue');
    await shot(`${width}-tutor-queue`, 'queue');
    await click('queue', c.queue.sendBack, { scope: '[data-queue=chores]' });
    await click('queue', c.notYet.send, { scope: '[data-queue=chores]' });
    await has('queue', c.notYet.pickCode);
    await click('queue', c.notYet.redo, { scope: '[data-queue=chores]' });
    await type('queue', c.notYet.reason, 'Not now');
    await click('queue', c.notYet.send, { scope: '[data-queue=chores]' });
    await has('queue', c.notYet.tooVague);
    assert.equal(state.posts.length, 0, 'A "not yet" without an actionable reason reached Core');
    geometry.notYet = await audit('queue');
    await shot(`${width}-tutor-not-yet`, 'queue');
    await type('queue', c.notYet.reason, GOOD);
    await click('queue', c.notYet.send, { scope: '[data-queue=chores]' });
    await has('queue', c.queue.done);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/${choreId}/send-back`, body: { reasonCode: 'redo', reason: GOOD } });
    await click('queue', c.queue.deny, { scope: '[data-queue=rewards]' });
    await click('queue', c.notYet.later_date, { scope: '[data-queue=rewards]' });
    await type('queue', c.notYet.reason, 'Let us wait until after your test on Friday.');
    await pickDate('queue', c.notYet.revisit, day(5));
    await click('queue', c.notYet.send, { scope: '[data-queue=rewards]' });
    await wait(`!${inPanel('queue')}.querySelector('[data-queue=rewards]')`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/redemptions/${redId}/decide`, body: { approve: false, reasonCode: 'later_date', reason: 'Let us wait until after your test on Friday.', revisitOn: day(5) } });
    await click('queue', c.queue.talked);
    await wait(`!${inPanel('queue')}.querySelector('[data-queue=talk]')`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/nudges/${nudgeId}/close`, body: { outcome: 'talked' } });
    await click('queue', c.queue.looksGood);
    await wait(`!${inPanel('queue')}.querySelector('[data-queue=reviews]')`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/decisions/${selfDecisionId}/review`, body: { outcome: 'confirmed' } });

    // ── Tutor: the ladder (D.17) ──
    await load('/family', parentId); await ready('ladder'); await page.evaluate(axeSource);
    await click('ladder', c.ladder.open);
    await has('ladder', fill(c.ladder.approved, { count: 12, min: 10, days: 60 }));
    await has('ladder', c.ladder.ready);
    geometry.ladder = await audit('ladder');
    await shot(`${width}-tutor-ladder`, 'ladder');
    await click('ladder', c.ladder.moveUp);
    await has('ladder', c.ladder.saved);
    assert.deepEqual(state.posts.at(-1), { method: 'PUT', path: `/tasks/${kidId}/autonomy`, body: { level: 2, preapprovedLimit: 0 } });
    await click('ladder', c.ladder.more); await click('ladder', c.ladder.more);
    await has('ladder', fill(c.ladder.limitValue, { count: 10 }));
    await click('ladder', c.ladder.saveLimit);
    await wait(`${inPanel('ladder')}.innerText.includes(${JSON.stringify(fill(c.levelsTutor.preapproved, { count: 10 }))})`);
    assert.deepEqual(state.posts.at(-1), { method: 'PUT', path: `/tasks/${kidId}/autonomy`, body: { level: 2, preapprovedLimit: 10 } });
    await has('ladder', fill(c.ladder.days, { count: 3, min: 28 }));
    await click('ladder', c.ladder.moveDown);
    await click('ladder', c.notYet.send);
    await has('ladder', c.notYet.pickCode);
    await click('ladder', c.notYet.practice_more);
    await type('ladder', c.notYet.reason, 'Let us practise saving before the next step.');
    geometry.ladderDown = await audit('ladder');
    await shot(`${width}-tutor-ladder-down`, 'ladder');
    await click('ladder', c.notYet.send);
    await wait(`document.querySelector('[data-autonomy=ladder] [data-level]')?.dataset.level === '1'`);
    assert.deepEqual(state.posts.at(-1), { method: 'PUT', path: `/tasks/${kidId}/autonomy`, body: { level: 1, preapprovedLimit: 0, reasonCode: 'practice_more', reason: 'Let us practise saving before the next step.' } });

    // ── Child: my level, my notes, my requests (D.17, D.18) ──
    role = 'kid'; state.level = 2; state.limit = 10; state.posts = [];
    await load('/tasks', kidId); await ready('my-level'); await page.evaluate(axeSource);
    await has('my-level', fill(c.levels.label, { count: 2, name: c.levels.name2 }));
    await has('my-level', fill(c.levels.preapproved, { count: 10 }));
    await has('my-level', fill(c.myLevel.approved, { count: 7, min: 20, name: c.levels.name3 }));
    assert.ok(!(await text('my-level')).includes('%'), 'A percentage reached a child');
    await click('my-level', c.myLevel.ask);
    await type('my-level', c.myLevel.why, 'I did every chore');
    geometry.myLevel = await audit('my-level');
    await shot(`${width}-kid-level`, 'my-level');
    await click('my-level', c.myLevel.send);
    await has('my-level', c.myLevel.pending);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: '/tasks/autonomy/request', body: { note: 'I did every chore' } });

    await ready('notes');
    await has('notes', 'Let us wait until after your test on Friday.');
    await has('notes', c.notes.self_logged);
    await click('notes', c.notes.talk);
    await has('notes', c.notes.talkAsked);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/decisions/${deniedId}/talk`, body: {} });
    geometry.notes = await audit('notes');
    await shot(`${width}-kid-notes`, 'notes');

    await ready('chore-done');
    await click('chore-done', c.choreDone.addNote);
    await type('chore-done', c.choreDone.notePrompt, 'Pillow on top too');
    geometry.choreDone = await audit('chore-done');
    await shot(`${width}-kid-chore`, 'chore-done');
    await click('chore-done', c.choreDone.markDone);
    for (let i = 0; i < 100 && !state.choreDone; i++) await sleep(100);
    const complete = state.posts.find((x) => x.path === `/tasks/${openChoreId}/complete`);
    assert.ok(complete && complete.body.note === 'Pillow on top too' && /^\d{4}-\d{2}-\d{2}$/.test(complete.body.localDate), 'The chore was not marked done with the child\'s note');

    // Marking the chore refreshes the level and the notes above: let the
    // layout settle before pointing at anything below them.
    await sleep(600); await settle();
    await ready('reward-ask');
    await click('reward-ask', c.rewardAsk.ask);
    await settle();
    await click('reward-ask', c.rewardAsk.send);
    await has('reward-ask', c.rewardAsk.pickOne);
    assert.equal(state.posts.filter((x) => x.path === '/tasks/redemptions').length, 0, 'A reward request without a reason reached Core');
    await click('reward-ask', c.rewardAsk.treat);
    geometry.rewardAsk = await audit('reward-ask');
    await shot(`${width}-kid-reward`, 'reward-ask');
    await click('reward-ask', c.rewardAsk.send);
    await has('reward-ask', c.rewardAsk.approved);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: '/tasks/redemptions', body: { catalogId, reasonKind: 'treat' } });

    evidence.push({ locale, theme, width, childWordsBesideRequests: true, notYetRefusedLocally: ['no code', 'Not now'], sendBackBody: true, laterDateBody: true,
      nudgeClosed: true, selfDirectedConfirmed: true, ruleWithOwnNumbers: true, moveUpBody: true, limitWithinCap: true, moveDownNeedsReason: true,
      childAskBody: true, childTalkBody: true, choreNoteBody: true, rewardReasonRequired: true, rewardPreapproved: true, noCelebration: true,
      posts: state.posts.map((x) => `${x.method} ${x.path}`), axeViolations: 0, geometry });
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  const failure = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (failure) writeFileSync(join(out, 'failure.png'), Buffer.from(failure.data, 'base64'));
  evidence.push({ failed: String(error), locale, theme, role, state: await page.evaluate('document.body.innerText.slice(0,2500)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Actual Tasks and Family routes in local Chrome with real pointer/keyboard input (a date field set through its native setter); synthetic Core. API and PostgreSQL evidence are separate; not full-stack E2E.', journeys: evidence.filter((e) => !e.failed).length, evidence, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
  await new Promise((done) => { browser.child.once('exit', done); setTimeout(done, 5000); });
  browser.child.kill();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log(JSON.stringify({ journeys: evidence.filter((e) => !e.failed).length, failed: evidence.filter((e) => e.failed) }));
