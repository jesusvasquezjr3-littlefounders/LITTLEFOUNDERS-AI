// S07.7 (D.19-D.23) browser matrix: the actual Family, Tasks and Banking
// routes in local Chrome, real pointer + keyboard input, synthetic Core.
//
// Tutor journey (/family):
//   - D.23 this month's reviewed tip; "Why it helps" shows its research basis
//     as a finding, not a promise, and records the opening (exact request);
//   - D.20 "What this practice covers": it practises four things and names
//     credit, debt, real compound interest and risk as not taught;
//   - D.21 "Your family's data": the periods Core serves (30, 400, 1100 days);
//   - D.22 research for one child: the whole disclosure before a yes, a yes
//     naming the disclosure version (exact body), then "Stop and delete"
//     asked once and sent (exact body).
// Tutor journey (/tasks):
//   - D.23 the reflective prompt before a yes: the Tutor's words are sent
//     only as the note they chose (exact body); before a "not yet", the
//     prompt is skipped and the reason form follows (exact body, reflection
//     "skipped");
//   - D.23 pricing tips inside the chore composer.
// Tutor journey (/banking): D.23 the note next to the spending limit, and
//   the D.20 statement.
// Child journey (/banking, a 15-year-old in a family):
//   - D.19 "Beyond the app": a moment is marked (exact body), its checklist
//     opens, a step is ticked (exact body), and the split tool applies the
//     usual split to a real amount with NO request sent;
//   - D.22 the child's own research note and their own no (exact body).
// Every configuration: 3 locales x light/dark x 375/1280 px, scoped axe with
// zero violations, no panel overflow or page scroll, 48 px targets, a copy
// role on every text node, no celebration, zero browser errors.
//
// Usage (dev server running):  FAMILY_GOVERNANCE_URL=http://localhost:5340 node scripts/verify-family-governance.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.FAMILY_GOVERNANCE_URL ?? 'http://localhost:5340';
const out = resolve(process.env.FAMILY_GOVERNANCE_OUT ?? '../audit-results/family-governance'); mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const parentId = '11111111-1111-4111-8111-111111111111';
const kidId = '22222222-2222-4222-8222-222222222222';
const choreId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const redId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const catalogId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const deliveryId = '99999999-9999-4999-8999-999999999999';
const T = '2026-09-20T10:00:00.000Z';
const token = (sub) => 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub, is_anonymous: false })).toString('base64url') + '.synthetic';
const WORDS = 'Proud of how carefully you did it';
const REASON = 'Save three more weeks and ask me again then.';
const POLICY = [{ id: 'photos', days: 30 }, { id: 'records', days: 400 }, { id: 'coins', days: null }, { id: 'insights', days: 400 },
  { id: 'research', days: 1100 }, { id: 'erasure', days: null }, { id: 'sharing', days: null }];

let locale = 'en-US', theme = 'light', role = 'parent';
let state;
const evidence = [];
function reset() {
  state = { posts: [], opened: false, participating: false, myParticipating: true, approved: false, denied: false, moments: { first_pay: [], first_account: [], first_budget: [] } };
}

const wireTask = (over) => ({ id: choreId, assignedBy: parentId, assignedTo: kidId, title: 'Dishes', rewardCoins: 3, recurrence: 'once', dueAt: null, status: 'done', allocated: false,
  createdAt: T, hasEvidence: false, requiresEvidence: false, cancelReason: null, kind: 'bonus', completedOn: '2026-09-20', childNote: 'I also dried them', ...over });
const queue = () => ({
  chores: state.approved ? [] : [wireTask()], openChores: [],
  rewards: state.denied ? [] : [{ id: redId, catalogId, kidUserId: kidId, status: 'requested', createdAt: T, decidedAt: null, decidedBy: null, fulfilledAt: null,
    childReasonKind: 'saved_for_it', childNote: 'Three weeks of saving', title: 'Cinema', cost: 10 }],
  reviews: [], nudges: [], levelRequests: [],
});
const research = (on, recording = on) => ({ participating: on, recording, grantor: on ? 'tutor' : null, since: on ? '2026-06-01T00:00:00.000Z' : null, disclosureVersion: 1, adult: false, months: on ? 3 : 0 });
const bridge = () => ({ eligible: true, minAge: 15, moments: ['first_pay', 'first_account', 'first_budget'].map((m) => ({
  milestone: m, arrived: state.moments[m].includes(0), steps: state.moments[m].filter((s) => s > 0).sort() })) });

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
      if (p === '/auth/me') body.data = { profile: { display_name: role === 'parent' ? 'Ana' : 'Nico', locale, theme, cover: {} }, roles: [role], avatarOptions: {}, analyticsEnabled: false, isGuest: false, newAccount: false, onboardingComplete: true };
      else if (p === '/auth/age-screen') body.data = { required: false, ageBand: role === 'parent' ? 'adult' : '13_to_17', protectedOrigin: false };
      else if (p === '/wallet/access') body.data = { holder: role === 'kid' ? 'managed_child' : null, familyChild: role === 'kid' };
      else if (p === '/family/kids') body.data = { kids: [{ userId: kidId, displayName: 'Nico', username: 'nico', analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 40, taskStreakDays: 0, accountType: 'child' }] };
      else if (p === '/family/guardian-links/mine') body.data = { links: [] };
      // S07.7 governance.
      else if (p === '/family-hub/coaching') body.data = { tip: { deliveryId, tipId: 'keep-promises', period: '2026-09', opened: state.opened, dismissed: false } };
      else if (p === `/family-hub/coaching/${deliveryId}/opened`) { state.opened = true; body.data = { tip: { deliveryId, tipId: 'keep-promises', period: '2026-09', opened: true, dismissed: false } }; }
      else if (p === '/family-hub/data-policy') body.data = { classes: POLICY };
      else if (p === `/family-hub/kids/${kidId}/research` && method === 'GET') body.data = { research: research(state.participating), currentVersion: 1 };
      else if (p === `/family-hub/kids/${kidId}/research`) { await sleep(60); state.participating = sent.participate; body.data = { research: research(state.participating), currentVersion: 1 }; }
      else if (p === '/family-hub/research/me' && method === 'GET') body.data = { research: research(state.myParticipating), currentVersion: 1 };
      else if (p === '/family-hub/research/me') { await sleep(60); state.myParticipating = false; body.data = { research: research(false), currentVersion: 1 }; }
      else if (p === '/family-hub/bridge' && method === 'GET') body.data = bridge();
      else if (p === '/family-hub/bridge') {
        await sleep(60);
        const list = state.moments[sent.milestone];
        if (sent.done) list.push(sent.step); else state.moments[sent.milestone] = sent.step === 0 ? [] : list.filter((s) => s !== sent.step);
        body.data = bridge();
      }
      // Tasks (Tutor): the queue and the composer.
      else if (p === '/tasks/decisions/queue') body.data = queue();
      else if (p === `/tasks/${choreId}/approve`) { await sleep(60); state.approved = true; body.data = { task: wireTask({ status: 'approved' }) }; }
      else if (p === `/tasks/redemptions/${redId}/decide`) { await sleep(60); state.denied = true; body.data = { decided: true, status: sent.approve ? 'approved' : 'denied' }; }
      else if (p === '/tasks' && method === 'GET') body.data = { tasks: [wireTask()] };
      else if (p === '/tasks/catalog' && method === 'GET') body.data = { items: [{ id: catalogId, parentUserId: parentId, title: 'Cinema', cost: 10, active: true, createdAt: T }] };
      else if (p === '/tasks/redemptions' && method === 'GET') body.data = { redemptions: [] };
      // Banking (Tutor and child).
      else if (p === '/banking/overview') body.data = { register: 'teen', account: { nickname: 'Rocket', design: 'violet', simulated: true, freeze: { frozen: false, by: null, since: null, holds: ['rewards', 'splits', 'credits', 'share'], canChange: true } },
        pockets: { save: 20, spend: 15, share: 5 }, pendingCredits: 0, spendLimit: { configured: false }, statement: { month: '2026-09', earned: 30, spent: 10, saved: 20, given: 2, adjusted: 0, lines: [] } };
      else if (p === '/banking/register') body.data = { register: 'teen' };
      else if (p === '/banking/account' && method === 'GET') body.data = { account: { nickname: 'Rocket', cardDesign: 'violet', displayNumber: 'LF-1234-5678', frozen: false, frozenBy: null, frozenAt: null, openedAt: T } };
      else if (p === '/banking/wallet/pending-credits') body.data = { credits: [] };
      else if (p === '/banking/savings-bonus' && method === 'GET') body.data = { rule: { rateBp: 1000, active: true, nextRunAt: T }, framing: 'percent', perTen: null, maxRateBp: 2000, saved: 20, nextBonus: 2, example: { shown: false, completed: false } };
      else if (p === '/tasks/wallet') body.data = { balances: { save: 20, spend: 15, share: 5 } };
      else if (p === '/tasks/wallet/ledger') body.data = { entries: [] };
      else if (p === '/tasks/wallet/split') body.data = { usual: { save: 50, spend: 40, share: 10 }, custom: false, recommended: { save: 50, spend: 40, share: 10 } };
      else if (p === '/tasks/goals') body.data = { goals: [] };
      else if (p === `/banking/accounts/${kidId}/freeze` && method === 'GET') body.data = { register: 'teen', account: { nickname: 'Rocket', design: 'violet', simulated: true, freeze: { frozen: false, by: null, since: null, holds: ['rewards', 'splits', 'credits', 'share'], canChange: true } } };
      else if (p === `/banking/accounts/${kidId}`) body.data = { account: { nickname: 'Rocket', cardDesign: 'violet', displayNumber: 'LF-1234-5678', frozen: false, frozenBy: null, frozenAt: null, openedAt: T } };
      else if (p === `/banking/allowance/${kidId}`) body.data = { rule: null };
      else if (p === `/banking/spend-limit/${kidId}`) body.data = { status: { configured: false } };
      else if (p === `/banking/savings-bonus/${kidId}`) body.data = { rule: null, framing: 'percent', perTen: null, maxRateBp: 2000 };
      else if (p === '/analytics/tracking-decision') body.data = { excluded: true, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId: rid, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});

async function wait(expression) { for (let i = 0; i < 200; i++) { try { if (await page.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
const SELECTORS = {
  coaching: '[data-governance=coaching]', scope: '[data-governance=scope]', 'data-policy': '[data-governance=data-policy]', research: '[data-governance=research]',
  'my-research': '[data-governance=my-research]', bridge: '[data-governance=bridge]', queue: '[data-autonomy=queue]', composer: '[data-family-money=chore-composer]',
  limit: '[data-coaching=limit]',
};
const inPanel = (panel) => `document.querySelector(${JSON.stringify(SELECTORS[panel])})`;
async function press(point) {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function pointAt(lookup, label) {
  return page.evaluate(`(async () => { const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    let last = null;
    for (let i = 0; i < 30; i++) { const e=${lookup}; if (!e) { await frame(); continue; } e.scrollIntoView({block:'center',behavior:'instant'}); await frame();
      const r=e.getBoundingClientRect(); const key=r.x+':'+r.y+':'+r.width+':'+r.height;
      if (key === last) { const x=r.x+Math.min(24, r.width/2),y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error(${JSON.stringify('Occluded ' + label)}); return {x,y}; }
      last = key; }
    throw Error(${JSON.stringify('Unstable ' + label)}); })()`);
}
async function click(panel, text, { scope = '' } = {}) {
  const root = scope ? `${inPanel(panel)}.querySelector(${JSON.stringify(scope)})` : inPanel(panel);
  const lookup = `[...${root}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && !e.disabled)`;
  await wait(`!!(${root}) && !!(${lookup})`);
  await press(await pointAt(lookup, `action ${text}`));
}
async function tick(panel, selector) {
  const lookup = `${inPanel(panel)}.querySelector(${JSON.stringify(selector)})`;
  await wait(`!!(${lookup}) && !(${lookup}).querySelector('input').disabled`);
  await press(await pointAt(lookup, `checkbox ${selector}`));
}
async function type(panel, label, text) {
  const lookup = `[...${inPanel(panel)}.querySelectorAll('label, legend')].find(l=>l.textContent.trim()===${JSON.stringify(label)} && l.htmlFor && document.getElementById(l.htmlFor) && !document.getElementById(l.htmlFor).disabled)`;
  await wait(`!!(${lookup})`);
  await press(await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.scrollIntoView({block:'center',behavior:'instant'}); const r=f.getBoundingClientRect(); return {x:r.x+Math.min(20,r.width/2),y:r.y+r.height/2}; })()`));
  await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.select?.(); })()`);
  await page.send('Input.insertText', { text });
}
async function settle() { await page.evaluate('Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished.catch(() => {}))).then(() => document.fonts.ready).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))'); }
async function audit(panel) {
  await settle();
  const geometry = await page.evaluate(`(() => { const e=${inPanel(panel)}; const small=[...e.querySelectorAll('button,input,select,textarea,label.lf-governance-step')].filter(c=>{ if (c.matches('input[type=checkbox]')) return false; const r=c.getBoundingClientRect();return r.width<48||r.height<48;}).map(c=>c.textContent.trim()||c.getAttribute('aria-label')||c.tagName); const unroled=[]; const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT); for(let n=w.nextNode();n;n=w.nextNode()){ if(n.textContent.trim() && !n.parentElement.closest('[data-copy-role]')) unroled.push(n.textContent.trim()); } return { scroll:e.scrollWidth, client:e.clientWidth, small, unroled, pageScroll: document.documentElement.scrollWidth - innerWidth, celebration: !!document.querySelector('[data-milestone], .lf-confetti, [data-celebration]') }; })()`);
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
    const g = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/familyGovernance.json`), 'utf8'));
    const a = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/familyAutonomy.json`), 'utf8'));
    const m = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/familyMoney.json`), 'utf8'));
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    reset(); role = 'parent';
    const geometry = {};

    // ── Tutor /family: tip, scope, data policy, research ──
    await load('/family', parentId); await ready('coaching'); await page.evaluate(axeSource);
    await has('coaching', g.tips['keep-promises'].title);
    geometry.tip = await audit('coaching');
    await click('coaching', g.coaching.why);
    await has('coaching', g.coaching.whyNote);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/family-hub/coaching/${deliveryId}/opened`, body: {} });
    await shot(`${width}-tutor-tip`, 'coaching');

    await ready('scope'); await click('scope', g.scope.open);
    for (const k of ['earning', 'splitting', 'goals', 'asking', 'credit', 'debt', 'compounding', 'risk']) await has('scope', g.scope[k]);
    geometry.scope = await audit('scope');
    await shot(`${width}-tutor-scope`, 'scope');

    await ready('data-policy'); await click('data-policy', g.dataPolicy.open);
    await has('data-policy', fill(g.dataPolicy.photos, { days: 30 }));
    await has('data-policy', fill(g.dataPolicy.records, { days: 400 }));
    await has('data-policy', fill(g.dataPolicy.research, { days: new Intl.NumberFormat(locale).format(1100) }));
    await has('data-policy', g.dataPolicy.sharing);
    geometry.dataPolicy = await audit('data-policy');
    await shot(`${width}-tutor-data`, 'data-policy');

    await ready('research'); await click('research', g.research.open);
    await has('research', g.research.how); await has('research', fill(g.research.never, { name: 'Nico' }));
    geometry.researchAsk = await audit('research');
    await shot(`${width}-tutor-research`, 'research');
    const postsBefore = state.posts.length;
    await click('research', fill(g.research.yes, { name: 'Nico' }));
    await has('research', fill(g.research.months, { count: 3 }));
    assert.deepEqual(state.posts.slice(postsBefore), [{ method: 'PUT', path: `/family-hub/kids/${kidId}/research`, body: { participate: true, disclosureVersion: 1 } }]);
    await click('research', g.research.stopButton);
    await has('research', fill(g.research.confirm, { name: 'Nico' }));
    assert.equal(state.posts.length, postsBefore + 1, 'Stopping research did not ask first');
    geometry.researchStop = await audit('research');
    await shot(`${width}-tutor-research-stop`, 'research');
    await click('research', g.research.confirmYes);
    await has('research', g.research.deleted);
    assert.deepEqual(state.posts.at(-1), { method: 'PUT', path: `/family-hub/kids/${kidId}/research`, body: { participate: false } });

    // ── Tutor /tasks: the reflective prompt (D.23) and pricing tips ──
    await load('/tasks', parentId); await ready('queue'); await page.evaluate(axeSource);
    await click('queue', a.queue.approve, { scope: '[data-queue=chores]' });
    await has('queue', fill(g.reflection.prompt, { name: 'Nico' }));
    assert.equal(state.posts.filter((x) => x.path.startsWith('/tasks/')).length, 0, 'A yes was sent before the reflective prompt');
    await type('queue', fill(g.reflection.prompt, { name: 'Nico' }), WORDS);
    geometry.reflection = await audit('queue');
    await shot(`${width}-tutor-reflection`, 'queue');
    await click('queue', g.reflection.share, { scope: '[data-queue=chores]' });
    await wait(`!${inPanel('queue')}.querySelector('[data-queue=chores]')`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/${choreId}/approve`, body: { reflection: 'shared', note: WORDS } });

    await click('queue', a.queue.deny, { scope: '[data-queue=rewards]' });
    await click('queue', g.reflection.continue, { scope: '[data-queue=rewards]' });
    await click('queue', a.notYet.save_more, { scope: '[data-queue=rewards]' });
    await type('queue', a.notYet.reason, REASON);
    await click('queue', a.notYet.send, { scope: '[data-queue=rewards]' });
    await wait(`!${inPanel('queue')}.querySelector('[data-queue=rewards]')`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/redemptions/${redId}/decide`,
      body: { approve: false, reasonCode: 'save_more', reason: REASON, revisitOn: null, reflection: 'skipped' } });

    await ready('composer'); await click('composer', m.choreComposer.open);
    await click('composer', g.pricing.open);
    for (const k of ['contribution', 'bonus', 'promise']) await has('composer', g.pricing[k]);
    geometry.pricing = await audit('composer');
    await shot(`${width}-tutor-pricing`, 'composer');

    // ── Tutor /banking: the limit note (D.23) and the scope statement (D.20) ──
    await load('/banking', parentId); await ready('limit'); await page.evaluate(axeSource);
    await click('limit', g.limitNote.open);
    await has('limit', g.limitNote.reason); await has('limit', g.limitNote.review);
    geometry.limit = await audit('limit');
    await shot(`${width}-tutor-limit`, 'limit');
    await ready('scope');

    // ── Child /banking, 15: the bridge (D.19) and the child's own research no (D.22) ──
    role = 'kid'; state.posts = [];
    await load('/banking', kidId); await ready('bridge'); await page.evaluate(axeSource);
    for (const k of ['first_pay', 'first_account', 'first_budget']) await has('bridge', g.bridge[k]);
    await click('bridge', g.bridge.arrived, { scope: '[data-moment=first_pay]' });
    await has('bridge', g.bridge.first_pay1);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: '/family-hub/bridge', body: { milestone: 'first_pay', step: 0, done: true } });
    await tick('bridge', '[data-moment=first_pay] [data-step="1"]');
    await wait(`${inPanel('bridge')}.querySelector('[data-moment=first_pay] [data-step="1"] input').checked`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: '/family-hub/bridge', body: { milestone: 'first_pay', step: 1, done: true } });
    const postsBeforeSplit = state.posts.length;
    await type('bridge', g.bridge.amount, '250');
    await has('bridge', fill(g.bridge.splitResult, { save: new Intl.NumberFormat(locale).format(125), spend: new Intl.NumberFormat(locale).format(100), share: new Intl.NumberFormat(locale).format(25) }));
    await sleep(300);
    assert.equal(state.posts.length, postsBeforeSplit, 'The split tool sent a request');
    assert.ok(!/%/.test(await text('bridge')), 'A percentage reached a teen on the bridge');
    geometry.bridge = await audit('bridge');
    await shot(`${width}-kid-bridge`, 'bridge');

    await ready('my-research'); await has('my-research', g.myResearch.body);
    await click('my-research', g.myResearch.button);
    await has('my-research', g.myResearch.confirm);
    geometry.myResearch = await audit('my-research');
    await shot(`${width}-kid-research`, 'my-research');
    await click('my-research', g.myResearch.yes);
    await has('my-research', g.myResearch.stopped);
    assert.deepEqual(state.posts.at(-1), { method: 'PUT', path: '/family-hub/research/me', body: { participate: false } });

    evidence.push({ locale, theme, width, tipFindingNotPromise: true, tipOpenedRecorded: true, scopeNamesFourExclusions: true, dataPolicyServedPeriods: [30, 400, 1100],
      researchYesNamesVersion: true, researchStopAskedOnce: true, reflectionBeforeYes: true, reflectionSharedAsNote: true, reflectionSkippedBeforeNotYet: true,
      pricingInComposer: true, limitNoteOnBanking: true, bridgeMomentAndStep: true, splitToolSendsNothing: true, childOwnResearchNo: true, noCelebration: true,
      posts: state.posts.map((x) => `${x.method} ${x.path}`), axeViolations: 0, geometry });
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  const failure = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (failure) writeFileSync(join(out, 'failure.png'), Buffer.from(failure.data, 'base64'));
  evidence.push({ failed: String(error), locale, theme, role, state: await page.evaluate('document.body.innerText.slice(0,2500)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Actual Family, Tasks and Banking routes in local Chrome with real pointer/keyboard input; synthetic Core. API and PostgreSQL evidence are separate; not full-stack E2E.', journeys: evidence.filter((e) => !e.failed).length, evidence, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
  await new Promise((done) => { browser.child.once('exit', done); setTimeout(done, 5000); });
  browser.child.kill();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log(JSON.stringify({ journeys: evidence.filter((e) => !e.failed).length, failed: evidence.filter((e) => e.failed) }));
