// S07.4 (D.13, D.14, D.15, D.16) browser matrix: the actual Family, Tasks and
// Wallet routes in local Chrome, real pointer + keyboard input, synthetic Core
// responses.
//
// Tutor journey (/family): the Share places of a child. A place without a kind
//   is refused locally with no request; a place is added with the exact body;
//   a waiting pledge cannot be marked done without a note; with one, the settle
//   carries it. The child's usual split is shown out of 10.
// Child journey (/tasks, a parent-created child):
//   - a chore reward arrives pre-split by the usual split (5 / 4 / 1) and one tap
//     keeps it (the exact body, no holder id);
//   - the usual split is changed out of 10 and saved as percent (PUT);
//   - a reached goal celebrates once (the OD-7 milestone) with "what's your
//     next goal?", and the next goal starts following it;
//   - every goal bar shows its provenance: own coins and bonus coins as
//     separate named segments (D.16 compliance: every bar on the page);
//   - Share coins go to the family's place (the exact body) and the Tutor's note
//     about what happened is shown.
// Teen journey (/wallet): income arrives pre-split by the teen's usual split;
//   the teen adds their own place, gives coins, and logs what they did (a note is
//   required).
// Every configuration: 3 locales x light/dark x 375/1280 px, scoped axe with
// zero violations, no panel overflow or page scroll, 48 px targets, a copy role
// on every text node, zero browser errors.
//
// Usage (dev server running):  MONEY_HABITS_URL=http://localhost:5340 node scripts/verify-money-habits.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.MONEY_HABITS_URL ?? 'http://localhost:5340';
const out = resolve(process.env.MONEY_HABITS_OUT ?? '../audit-results/money-habits'); mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const parentId = '11111111-1111-4111-8111-111111111111';
const kidId = '22222222-2222-4222-8222-222222222222';
const teenId = '33333333-3333-4333-8333-333333333333';
const taskId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reachedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const activeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const nextId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const placeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ownPlaceId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const giftId = '44444444-4444-4444-8444-444444444444';
const doneGiftId = '55555555-5555-4555-8555-555555555555';
const T = '2026-09-20T10:00:00.000Z';
const token = (sub) => 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub, is_anonymous: false })).toString('base64url') + '.synthetic';

let locale = 'en-US', theme = 'light', role = 'parent';
let state;
const evidence = [];
function reset() {
  state = { posts: [], seen: false, nextSet: false, allocated: false, usual: { save: 50, spend: 40, share: 10 }, custom: false, places: [], settled: null, pledged: false,
    teenPlaces: [], teenGift: null, teenGiven: false };
}
const USUAL = () => ({ usual: state.usual, custom: state.custom, recommended: { save: 50, spend: 40, share: 10 } });
const goal = (over) => ({ id: activeId, title: 'Bike', target: 60, icon: 'bike', status: 'active', reachedAt: null, followsGoalId: null, saved: 30,
  progress: { own: 25, bonus: 5, family: 0, total: 30 }, nextStep: null, ...over });
const kidGoals = () => [
  ...(state.nextSet ? [goal({ id: nextId, title: 'Skates', target: 80, saved: 0, progress: { own: 0, bonus: 0, family: 0, total: 0 }, followsGoalId: reachedId })] : []),
  goal({ id: reachedId, title: 'Kite', target: 20, status: 'reached', reachedAt: T, saved: 20, progress: { own: 20, bonus: 0, family: 0, total: 20 },
    nextStep: { state: state.nextSet ? 'set' : state.seen ? 'prompted' : 'pending', nextGoalId: state.nextSet ? nextId : null } }),
  goal(),
];
const task = () => ({ id: taskId, assignedBy: parentId, assignedTo: kidId, title: 'Wash the car', rewardCoins: 10, recurrence: 'once', dueAt: null,
  status: 'approved', allocated: state.allocated, createdAt: T, hasEvidence: false, requiresEvidence: false, cancelReason: null, kind: 'bonus', completedOn: '2026-09-20' });
const tutorView = () => ({
  destinations: [{ id: placeId, title: 'Food bank', kind: 'charity', chosenBy: 'tutor', status: 'active', createdAt: T }, ...state.places],
  gifts: [{ id: giftId, destinationId: placeId, amount: 4, status: state.settled ? 'given' : 'pledged', pledgedAt: T, settledAt: state.settled ? T : null,
    settledBy: state.settled ? 'tutor' : null, note: state.settled }],
});
const kidView = () => ({
  destinations: [{ id: placeId, title: 'Food bank', kind: 'charity', chosenBy: 'tutor', status: 'active', createdAt: T }],
  gifts: [...(state.pledged ? [{ id: giftId, destinationId: placeId, amount: 3, status: 'pledged', pledgedAt: T, settledAt: null, settledBy: null, note: null }] : []),
    { id: doneGiftId, destinationId: placeId, amount: 2, status: 'given', pledgedAt: T, settledAt: T, settledBy: 'tutor', note: 'We took rice to the food bank' }],
});
const teenView = () => ({
  destinations: state.teenPlaces,
  gifts: state.teenGift ? [{ id: giftId, destinationId: ownPlaceId, amount: 2, status: state.teenGiven ? 'given' : 'pledged', pledgedAt: T, settledAt: state.teenGiven ? T : null,
    settledBy: state.teenGiven ? 'holder' : null, note: state.teenGiven || null }] : [],
});

await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data); if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params; const url = new URL(request.url);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return void await page.send('Fetch.continueRequest', { requestId });
    if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    const body = { data: {}, error: null }; const p = url.pathname.replace('/api/v1', ''); const method = request.method;
    const sent = request.postData ? JSON.parse(request.postData) : undefined;
    if (method !== 'OPTIONS' && method !== 'GET') state.posts.push({ method, path: p, body: sent });
    if (method !== 'OPTIONS') {
      const me = role === 'parent' ? 'Ana' : role === 'kid' ? 'Nico' : 'Sam';
      if (p === '/auth/me') body.data = { profile: { display_name: me, locale, theme, cover: {} }, roles: [role === 'teen' ? 'universal' : role], avatarOptions: {}, analyticsEnabled: false, isGuest: false, newAccount: false, onboardingComplete: true };
      else if (p === '/auth/age-screen') body.data = { required: false, ageBand: role === 'parent' ? 'adult' : role === 'kid' ? 'under_13' : '13_to_17', protectedOrigin: false };
      else if (p === '/wallet/access') body.data = { holder: role === 'kid' ? 'managed_child' : role === 'teen' ? 'teen' : null, familyChild: role === 'kid' };
      else if (p === '/family/kids') body.data = { kids: [{ userId: kidId, displayName: 'Nico', username: 'nico', analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 12, taskStreakDays: 6, accountType: 'child' }] };
      else if (p === '/family/guardian-links/mine') body.data = { links: [] };
      // Tutor: the Share places (D.14) and the child's usual split (D.13).
      else if (p === `/tasks/${kidId}/share`) body.data = tutorView();
      else if (p === `/tasks/${kidId}/wallet/split`) body.data = USUAL();
      else if (p === `/tasks/${kidId}/share/destinations`) { state.places.push({ id: ownPlaceId, title: sent.title, kind: sent.kind, chosenBy: 'tutor', status: 'active', createdAt: T }); body.data = { destinationId: ownPlaceId }; }
      else if (p === `/tasks/${kidId}/share/gifts/${giftId}/settle`) { await sleep(80); state.settled = sent.note; body.data = { outcome: sent.outcome }; }
      // Child: tasks, split, goals, Share.
      else if (p === '/tasks/mine') body.data = { tasks: [task()] };
      else if (p === '/tasks/streak') body.data = { streak: { status: 'alive', current: 3, best: 5, totalDays: 12, restDaysLeftThisWeek: 2, restDaysPerWeek: 2, pausedUntil: null, today: '2026-09-25' } };
      else if (p === '/tasks/wallet') body.data = { balances: role === 'teen' ? { save: 10, spend: 6, share: state.teenGift ? 3 : 5 } : { save: 40, spend: 11, share: state.pledged ? 3 : 6 } };
      else if (p === '/tasks/wallet/split' && method === 'GET') body.data = USUAL();
      else if (p === '/tasks/wallet/split' && method === 'PUT') { state.usual = sent; state.custom = true; body.data = USUAL(); }
      else if (p === `/tasks/${taskId}/allocate`) { await sleep(80); state.allocated = true; body.data = { allocated: true, goal: null }; }
      else if (p === '/tasks/goals' && method === 'GET') body.data = { goals: role === 'teen' ? [goal({ progress: { own: 30, bonus: 0, family: 0, total: 30 } })] : kidGoals() };
      else if (p === '/tasks/goals' && method === 'POST') { state.nextSet = true; body.data = { goal: goal({ id: nextId, title: sent.title, target: sent.target, saved: 0, progress: { own: 0, bonus: 0, family: 0, total: 0 }, followsGoalId: sent.followsGoalId }) }; }
      else if (p === `/tasks/goals/${reachedId}/next-step/seen`) { body.data = { celebrate: !state.seen }; state.seen = true; }
      else if (p === '/tasks/share') body.data = role === 'teen' ? teenView() : kidView();
      else if (p === '/tasks/share/gifts') { if (role === 'teen') state.teenGift = true; else state.pledged = true; body.data = { giftId }; }
      else if (p === '/tasks/share/destinations') { state.teenPlaces.push({ id: ownPlaceId, title: sent.title, kind: sent.kind, chosenBy: 'holder', status: 'active', createdAt: T }); body.data = { destinationId: ownPlaceId }; }
      else if (p === `/tasks/share/gifts/${giftId}/settle`) { state.teenGiven = sent.note; body.data = { outcome: sent.outcome }; }
      else if (p === '/tasks/catalog/available') body.data = { items: [] };
      else if (p === '/tasks/redemptions/mine') body.data = { redemptions: [] };
      else if (p === '/tasks/wallet/ledger') body.data = { entries: [] };
      // Teen wallet.
      else if (p === '/wallet/rewards') body.data = { rewards: [] };
      else if (p === '/wallet/guardians') body.data = { guardians: [] };
      else if (p === '/wallet/income') body.data = { actionId: '66666666-6666-4666-8666-666666666666', goal: null };
      else if (p === '/analytics/tracking-decision') body.data = { excluded: true, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});

async function wait(expression) { for (let i = 0; i < 200; i++) { try { if (await page.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
const inPanel = (panel) => panel === 'teen' ? `document.querySelector('[data-teen-wallet=root]')` : `document.querySelector('[data-money-habits=${panel}]')`;
async function press(point) {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function click(panel, text, { exact = true, label = false } = {}) {
  const match = label ? `e.getAttribute('aria-label')===${JSON.stringify(text)}` : exact ? `e.textContent.trim()===${JSON.stringify(text)}` : `e.textContent.trim().startsWith(${JSON.stringify(text)})`;
  const lookup = `[...${inPanel(panel)}.querySelectorAll('button')].find(e=>${match} && !e.disabled)`;
  await wait(`!!(${lookup})`);
  await press(await page.evaluate(`(() => { const e=${lookup}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded action ${text}'); return {x,y}; })()`));
}
async function type(panel, label, text) {
  const lookup = `[...${inPanel(panel)}.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(label)} && document.getElementById(l.htmlFor) && !document.getElementById(l.htmlFor).disabled)`;
  await wait(`!!(${lookup})`);
  await press(await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.scrollIntoView({block:'center',behavior:'instant'}); const r=f.getBoundingClientRect(); return {x:r.x+Math.min(20,r.width/2),y:r.y+r.height/2}; })()`));
  await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.select?.(); })()`);
  await page.send('Input.insertText', { text });
}
async function enter() {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}
async function settle() { await page.evaluate('Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished.catch(() => {}))).then(() => document.fonts.ready).then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))'); }
async function audit(panel) {
  await settle();
  const geometry = await page.evaluate(`(() => { const e=${inPanel(panel)}; const small=[...e.querySelectorAll('button,input,select,textarea')].filter(c=>{const r=c.getBoundingClientRect();return r.width<48||r.height<48;}).map(c=>c.textContent.trim()||c.getAttribute('aria-label')||c.tagName); const unroled=[]; const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT); for(let n=w.nextNode();n;n=w.nextNode()){ if(n.textContent.trim() && !n.parentElement.closest('[data-copy-role]')) unroled.push(n.textContent.trim()); } return { scroll:e.scrollWidth, client:e.clientWidth, small, unroled, pageScroll: document.documentElement.scrollWidth - innerWidth }; })()`);
  assert.ok(geometry.scroll <= geometry.client + 1, `${panel} overflows`);
  assert.ok(geometry.pageScroll <= 1, `${panel} causes horizontal page scroll`);
  assert.deepEqual(geometry.small, [], `${panel} has targets under 48 px`);
  assert.deepEqual(geometry.unroled, [], `${panel} has text without a copy role`);
  const axe = await page.evaluate(`axe.run(${inPanel(panel)})`);
  assert.deepEqual(axe.violations.map((v) => v.id), [], `${panel} axe violations`);
  return geometry;
}
/** D.16 on the rendered page: every goal bar carries its provenance, draws each non-zero source as its own segment and names it. */
async function goalBars() {
  return page.evaluate(`[...document.querySelectorAll('[data-goal-progress]')].map(e => ({
    own: +e.dataset.own, bonus: +e.dataset.bonus, family: +e.dataset.family,
    parts: [...e.querySelectorAll('.lf-goal-progress-bar [data-part]')].map(p => p.dataset.part),
    legend: [...e.querySelectorAll('[data-legend]')].map(l => l.dataset.legend),
    label: e.querySelector('[role=img]')?.getAttribute('aria-label') ?? null,
    fills: [...e.querySelectorAll('.lf-goal-progress-bar [data-part]')].map(p => getComputedStyle(p).backgroundImage !== 'none' ? 'pattern' : getComputedStyle(p).backgroundColor),
  }))`);
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
const fill = (s, values) => s.replace(/\{(\w+)\}/g, (_, k) => String(values[k]));

try {
  await warmDevServer(page, origin); await page.send('Page.navigate', { url: origin }); await wait('!!document.body');
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');
  for (locale of ['en-US', 'es-MX', 'pt-BR']) for (theme of ['light', 'dark']) for (const width of [375, 1280]) {
    const copy = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/moneyHabits.json`), 'utf8'));
    const teenCopy = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/teenWallet.json`), 'utf8'));
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    reset(); role = 'parent';
    const geometry = {};

    // ── Tutor: the child's Share places (D.14) ──
    const d = copy.destinations;
    await load('/family', parentId); await ready('share-destinations'); await page.evaluate(axeSource);
    await click('share-destinations', d.open);
    await wait(`${inPanel('share-destinations')}.innerText.includes(${JSON.stringify(fill(d.waiting, { count: 4, place: 'Food bank' }))})`);
    assert.ok((await text('share-destinations')).includes(fill(d.usualSplit, { save: 5, spend: 4, share: 1 })), 'The usual split was not shown out of 10');
    await type('share-destinations', d.placeName, 'Grandma');
    await click('share-destinations', d.add);
    await wait(`${inPanel('share-destinations')}.innerText.includes(${JSON.stringify(d.invalid)})`);
    assert.equal(state.posts.length, 0, 'A place without a kind reached Core');
    await click('share-destinations', d.gift);
    await click('share-destinations', d.add);
    await wait(`${inPanel('share-destinations')}.innerText.includes(${JSON.stringify(d.added)})`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/${kidId}/share/destinations`, body: { title: 'Grandma', kind: 'gift' } });
    await click('share-destinations', d.markGiven);
    await click('share-destinations', d.confirm);
    await wait(`${inPanel('share-destinations')}.innerText.includes(${JSON.stringify(d.noteRequired)})`);
    assert.equal(state.posts.filter((x) => x.path.endsWith('/settle')).length, 0, 'A settle without a note reached Core');
    geometry.tutor = await audit('share-destinations');
    await shot(`${width}-tutor-share`, 'share-destinations');
    await type('share-destinations', d.whatHappened, 'We bought rice together');
    await click('share-destinations', d.confirm);
    await wait(`${inPanel('share-destinations')}.innerText.includes(${JSON.stringify(fill(d.givenNotice, { name: 'Nico' }))})`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/${kidId}/share/gifts/${giftId}/settle`, body: { outcome: 'given', note: 'We bought rice together' } });

    // ── Child: the split chooser (D.13) ──
    role = 'kid';
    const sc = copy.split;
    await load('/tasks', kidId); await ready('allocation'); await page.evaluate(axeSource);
    geometry.allocationClosed = await audit('allocation');
    await click('allocation', sc.splitNow);
    await ready('split-chooser');
    await wait(`[...${inPanel('split-chooser')}.querySelectorAll('[data-pocket]')].map(p=>p.innerText.replace(/\\s+/g,'')).join('|') === ${JSON.stringify([`${sc.save}5`, `${sc.spend}4`, `${sc.share}1`].map((s) => s.replace(/\s+/g, '')).join('|'))}`);
    geometry.split = await audit('split-chooser');
    await shot(`${width}-kid-split`, 'split-chooser');
    await page.evaluate(`[...${inPanel('split-chooser')}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(sc.use)}).focus()`);
    await enter();
    await wait(`!document.querySelector('[data-money-habits=split-chooser]') && !document.querySelector('[data-money-habits=allocation]')`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/tasks/${taskId}/allocate`, body: { save: 5, spend: 4, share: 1, goalId: null } });

    // ── Child: the usual split out of 10 (D.13) ──
    const us = copy.usualSplit;
    await click('usual-split', us.open);
    await wait(`${inPanel('usual-split')}.innerText.includes(${JSON.stringify(fill(us.tenths, { count: 5 }))})`);
    assert.ok(!(await text('usual-split')).includes('%'), 'A percentage reached a child');
    await click('usual-split', fill(sc.less, { pocket: sc.spend }), { label: true });
    await click('usual-split', fill(sc.more, { pocket: sc.share }), { label: true });
    await click('usual-split', us.submit);
    await wait(`${inPanel('usual-split')}.innerText.includes(${JSON.stringify(us.saved)})`);
    assert.deepEqual(state.posts.at(-1), { method: 'PUT', path: '/tasks/wallet/split', body: { save: 50, spend: 30, share: 20 } });
    geometry.usual = await audit('usual-split');
    await shot(`${width}-kid-usual`, 'usual-split');

    // ── Child: goals, the celebration once, and the next goal (D.15, D.16) ──
    const ng = copy.nextGoal;
    await wait(`!!${inPanel('savings-goals')}?.querySelector('[data-milestone=savings-goal-reached]')`);
    assert.ok((await text('savings-goals')).includes(fill(ng.milestone, { title: 'Kite' })));
    const bars = await goalBars();
    assert.equal(bars.length, 2, 'Every goal shows one provenance bar');
    for (const bar of bars) {
      const nonZero = ['own', 'bonus', 'family'].filter((k) => bar[k] > 0);
      assert.deepEqual(bar.parts, nonZero, 'A source was folded into another segment');
      assert.deepEqual(bar.legend, nonZero.length === 1 && nonZero[0] === 'own' ? ['own'] : nonZero, 'A source is not named');
      assert.ok(bar.label, 'A bar has no accessible description');
    }
    const mixed = bars.find((b) => b.bonus > 0);
    assert.ok(mixed && mixed.fills[0] !== mixed.fills[1] && mixed.fills.includes('pattern'), 'Bonus coins are not drawn apart from own coins');
    geometry.goals = await audit('savings-goals');
    await shot(`${width}-kid-goals`, 'savings-goals');
    await type('savings-goals', ng.name, 'Skates');
    await type('savings-goals', ng.target, '80');
    await click('savings-goals', ng.start);
    await wait(`${inPanel('savings-goals')}.innerText.includes(${JSON.stringify(ng.started)}) && !${inPanel('savings-goals')}.querySelector('[data-money-habits=next-goal]')`);
    assert.deepEqual(state.posts.filter((x) => x.path === '/tasks/goals').at(-1), { method: 'POST', path: '/tasks/goals', body: { title: 'Skates', target: 80, followsGoalId: reachedId } });
    assert.equal(state.posts.filter((x) => x.path.endsWith('/next-step/seen')).length, 1, 'The first view was not recorded exactly once');

    // ── Child: the Share place (D.14) ──
    const sh = copy.share;
    await ready('share-giving');
    await wait(`${inPanel('share-giving')}.innerText.includes(${JSON.stringify(fill(sh.note, { note: 'We took rice to the food bank' }))})`);
    await click('share-giving', 'Food bank');
    await type('share-giving', sh.amount, '3');
    await click('share-giving', sh.give);
    await wait(`${inPanel('share-giving')}.innerText.includes(${JSON.stringify(sh.pledged)})`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: '/tasks/share/gifts', body: { destinationId: placeId, amount: 3 } });
    geometry.share = await audit('share-giving');
    await shot(`${width}-kid-share`, 'share-giving');

    // ── Teen: income pre-split, own place, logging what they did (D.13, D.14) ──
    role = 'teen'; state.usual = { save: 50, spend: 40, share: 10 }; state.custom = false;
    await load('/wallet', teenId); await ready('teen'); await page.evaluate(axeSource);
    await click('teen', teenCopy.income.open);
    await type('teen', teenCopy.income.amount, '12');
    await wait(`[...${inPanel('teen')}.querySelectorAll('.lf-teen-wallet-split-row input')].map(i=>i.value).join('/') === '6/5/1'`);
    assert.ok((await text('teen')).includes(teenCopy.income.usualNote));
    await click('teen', teenCopy.income.submit);
    await wait(`${inPanel('teen')}.innerText.includes(${JSON.stringify(fill(teenCopy.income.added, { n: 12 }))})`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: '/wallet/income', body: { source: 'allowance', save: 6, spend: 5, share: 1, goalId: null } });
    await click('teen', sh.heading);
    await ready('share-giving');
    const st = copy.shareTeen;
    await type('share-giving', st.placeName, 'Animal shelter');
    await click('share-giving', sh.charity);
    await click('share-giving', st.add);
    await wait(`[...${inPanel('share-giving')}.querySelectorAll('button')].some(b=>b.textContent.trim()==='Animal shelter')`);
    await click('share-giving', 'Animal shelter');
    await type('share-giving', sh.amount, '2');
    await click('share-giving', sh.give);
    await click('share-giving', st.markGiven);
    await click('share-giving', st.saveGiven);
    await wait(`${inPanel('share-giving')}.innerText.includes(${JSON.stringify(st.noteRequired)})`);
    assert.equal(state.posts.filter((x) => x.path === `/tasks/share/gifts/${giftId}/settle`).length, 0, 'A teen log without a note reached Core');
    await type('share-giving', st.whatHappened, 'Bought dog food');
    await click('share-giving', st.saveGiven);
    await wait(`${inPanel('share-giving')}.innerText.includes(${JSON.stringify(fill(sh.note, { note: 'Bought dog food' }))})`);
    assert.deepEqual(state.posts.slice(-3).map((x) => [x.path, x.body]), [
      ['/tasks/share/destinations', { title: 'Animal shelter', kind: 'charity' }],
      ['/tasks/share/gifts', { destinationId: ownPlaceId, amount: 2 }],
      [`/tasks/share/gifts/${giftId}/settle`, { outcome: 'given', note: 'Bought dog food' }],
    ]);
    geometry.teen = await audit('teen');
    await shot(`${width}-teen-share`, 'share-giving');

    evidence.push({ locale, theme, width, tutorPlaceKindRequired: true, tutorNoteRequired: true, tutorSettleBody: true, usualSplitShownOutOf10: true,
      splitPreSplit541: true, splitKeptWithOneKey: true, usualSplitSavedAsPercent: true, celebrationOnce: true, everyGoalBarProvenance: bars,
      nextGoalFollows: true, sharePledgeBody: true, tutorNoteShownToChild: true, teenIncomePreSplit: true, teenOwnPlaceAndLog: true,
      posts: state.posts.map((x) => `${x.method} ${x.path}`), axeViolations: 0, geometry });
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  const failure = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (failure) writeFileSync(join(out, 'failure.png'), Buffer.from(failure.data, 'base64'));
  evidence.push({ failed: String(error), locale, theme, role, state: await page.evaluate('document.body.innerText.slice(0,2500)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Actual Family, Tasks and Wallet routes in local Chrome with real pointer/keyboard input; synthetic Core. API and PostgreSQL evidence are separate; not full-stack E2E.', journeys: evidence.filter((e) => !e.failed).length, evidence, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
  await new Promise((done) => { browser.child.once('exit', done); setTimeout(done, 5000); });
  browser.child.kill();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log(JSON.stringify({ journeys: evidence.filter((e) => !e.failed).length, failed: evidence.filter((e) => e.failed) }));
