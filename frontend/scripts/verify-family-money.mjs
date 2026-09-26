// S07.3 (D.2, D.10, D.11) browser matrix: the actual Tasks, Family and
// Banking routes in local Chrome, real pointer + keyboard input, synthetic
// Core responses.
//
// Tutor journeys:
//   /tasks   the chore composer: nothing preselected, a submit without a kind
//            is refused locally with no request, then an unpaid family
//            contribution is created with the exact body.
//   /family  the holiday pause: an out-of-range pause is refused locally, a
//            valid one is saved and re-read as running, then ended.
//   /banking the savings bonus of an under-13 child: the fixed 1-per-10 rule,
//            no percent field, the "what changed" notice, switched on (the
//            PUT carries no rate).
// Child journeys:
//   /tasks   (under 13) the chore streak with rest days; the task list names a
//            family chore with no coins; marking it done reaches 7 days and the
//            OD-7 milestone shows once.
//   /banking (under 13) the bonus as groups of ten, never a percent.
//   /banking (14) the percentage, why it grows, the "not interest" line, and
//            the worked example: a wrong answer, then the right one.
// Every configuration: 3 locales x light/dark x 375/1280 px, scoped axe with
// zero violations, no panel overflow or page scroll, 48 px targets, a copy role
// on every text node, zero browser errors.
//
// Usage (dev server running):  FAMILY_MONEY_URL=http://localhost:5340 node scripts/verify-family-money.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.FAMILY_MONEY_URL ?? 'http://localhost:5340';
const out = resolve(process.env.FAMILY_MONEY_OUT ?? '../audit-results/family-money'); mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const parentId = '11111111-1111-4111-8111-111111111111';
const kidId = '22222222-2222-4222-8222-222222222222';
const taskId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pauseId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const T = '2026-09-20T10:00:00.000Z';
const token = (sub) => 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub, is_anonymous: false })).toString('base64url') + '.synthetic';
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

let locale = 'en-US', theme = 'light', role = 'parent', framing = 'per_ten';
let state;
const evidence = [];
function reset() {
  state = { posts: [], taskDone: false, pause: null, bonusActive: false, reframed: 2000, examples: [] };
}
const streak = () => state.taskDone
  ? { status: 'practised_today', current: 7, best: 9, totalDays: 31, restDaysLeftThisWeek: 1, restDaysPerWeek: 2, pausedUntil: null, today: day(0) }
  : { status: 'alive', current: 6, best: 9, totalDays: 30, restDaysLeftThisWeek: 1, restDaysPerWeek: 2, pausedUntil: state.pause?.state === 'running' ? state.pause.endsOn : null, today: day(0) };
const task = () => ({ id: taskId, assignedBy: parentId, assignedTo: kidId, title: 'Set the table', rewardCoins: 0, recurrence: 'once', dueAt: null,
  status: state.taskDone ? 'done' : 'open', allocated: false, createdAt: T, hasEvidence: false, requiresEvidence: false, cancelReason: null, kind: 'contribution', completedOn: state.taskDone ? day(0) : null });
const account = { nickname: 'Rocket Fund', cardDesign: 'indigo', displayNumber: 'LF-1234', frozen: false, frozenBy: null, frozenAt: null, openedAt: T };

await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data); if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params; const url = new URL(request.url);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return void await page.send('Fetch.continueRequest', { requestId });
    if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    let status = 200; const body = { data: {}, error: null }; const p = url.pathname.replace('/api/v1', ''); const method = request.method;
    const sent = request.postData ? JSON.parse(request.postData) : undefined;
    if (method !== 'OPTIONS' && method !== 'GET') state.posts.push({ method, path: p, body: sent });
    if (method !== 'OPTIONS') {
      if (p === '/auth/me') body.data = { profile: { display_name: role === 'parent' ? 'Ana' : 'Nico', locale, theme, cover: {} }, roles: [role], avatarOptions: {}, analyticsEnabled: false, isGuest: false, newAccount: false, onboardingComplete: true };
      else if (p === '/auth/age-screen') body.data = { required: false, ageBand: role === 'parent' ? 'adult' : 'under_13', protectedOrigin: false };
      else if (p === '/wallet/access') body.data = { holder: role === 'kid' ? 'managed_child' : null, familyChild: role === 'kid' };
      else if (p === '/family/kids') body.data = { kids: [{ userId: kidId, displayName: 'Nico', username: 'nico', analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 12, taskStreakDays: 6, accountType: 'child' }] };
      else if (p === '/family/guardian-links/mine') body.data = { links: [] };
      // Tutor: chores.
      else if (p === '/tasks' && method === 'GET') body.data = { tasks: [task()] };
      else if (p === '/tasks' && method === 'POST') body.data = { task: { ...task(), id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: sent.title, kind: sent.kind, rewardCoins: sent.rewardCoins, assignedTo: sent.assignedTo } };
      else if (p === '/tasks/catalog') body.data = { items: [] };
      else if (p === '/tasks/redemptions') body.data = { redemptions: [] };
      // Tutor: the streak and the holiday pause.
      else if (p === `/tasks/${kidId}/streak`) body.data = { streak: streak(), pauses: state.pause && state.pause.state !== 'over' ? [{ id: pauseId, startsOn: state.pause.startsOn, endsOn: state.pause.endsOn, state: state.pause.state }] : [] };
      else if (p === `/tasks/${kidId}/streak/pauses`) { await sleep(120); state.pause = { ...sent, state: sent.startsOn <= day(0) ? 'running' : 'upcoming' }; body.data = { pauseId }; }
      else if (p === `/tasks/${kidId}/streak/pauses/${pauseId}/end`) { state.pause = { ...state.pause, state: 'over' }; body.data = { outcome: 'ended' }; }
      // Tutor: banking.
      else if (p === `/banking/accounts/${kidId}`) body.data = { account };
      else if (p === `/banking/allowance/${kidId}`) body.data = { rule: null };
      else if (p === `/banking/spend-limit/${kidId}`) body.data = { status: { configured: false } };
      else if (p === `/banking/savings-bonus/${kidId}` && method === 'GET') body.data = { framing: 'per_ten', perTen: { unit: 10, coins: 1 }, maxRateBp: null, rule: { rateBp: 1000, active: state.bonusActive, nextRunAt: T, reframedFromRateBp: state.reframed } };
      else if (p === `/banking/savings-bonus/${kidId}` && method === 'PUT') { state.bonusActive = sent.active; state.reframed = null; body.data = { framing: 'per_ten', perTen: { unit: 10, coins: 1 }, maxRateBp: null, rule: { rateBp: 1000, active: sent.active, nextRunAt: T, reframedFromRateBp: null } }; }
      // Child: tasks.
      else if (p === '/tasks/mine') body.data = { tasks: [task()] };
      else if (p === `/tasks/${taskId}/complete`) { state.taskDone = true; body.data = { task: task(), streak: streak(), milestone: 'streak-7', selfLogged: false }; }
      else if (p === '/tasks/streak') body.data = { streak: streak() };
      else if (p === '/tasks/wallet') body.data = { balances: { save: 57, spend: 11, share: 1 } };
      else if (p === '/tasks/goals') body.data = { goals: [] };
      else if (p === '/tasks/catalog/available') body.data = { items: [] };
      else if (p === '/tasks/redemptions/mine') body.data = { redemptions: [] };
      else if (p === '/tasks/wallet/ledger') body.data = { entries: [] };
      // Child: banking.
      else if (p === '/banking/account') body.data = { account };
      else if (p === '/banking/wallet/pending-credits') body.data = { credits: [] };
      else if (p === '/banking/spend-limit') body.data = { status: { configured: false } };
      else if (p === '/banking/savings-bonus' && method === 'GET') body.data = framing === 'per_ten'
        ? { framing, perTen: { unit: 10, coins: 1 }, maxRateBp: null, rule: { rateBp: 1000, active: true, nextRunAt: T }, saved: 57, nextBonus: 5, example: null }
        : { framing, perTen: null, maxRateBp: 2000, rule: { rateBp: 1500, active: true, nextRunAt: T }, saved: 57, nextBonus: 8, example: { shown: false, completed: false } };
      else if (p === '/banking/savings-bonus/example') {
        state.examples.push(sent); await sleep(100);
        body.data = sent.step === 'shown' ? { shown: true } : { correct: sent.answer === Math.floor(sent.exampleSaved * 15 / 100) };
      } else if (p === '/analytics/tracking-decision') body.data = { excluded: true, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});

async function wait(expression) { for (let i = 0; i < 200; i++) { try { if (await page.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
const inPanel = (panel) => `document.querySelector('[data-family-money=${panel}]')`;
async function press(point) {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function click(panel, text, exact = true) {
  const match = exact ? `e.textContent.trim()===${JSON.stringify(text)}` : `e.textContent.trim().startsWith(${JSON.stringify(text)})`;
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
/** A native date picker takes no inserted text; the value is set through the input's own setter and announced, as the picker would. */
async function setDate(panel, label, value) {
  const lookup = `[...${inPanel(panel)}.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(label)})`;
  await wait(`!!(${lookup})`);
  await page.evaluate(`(() => { const f=document.getElementById((${lookup}).htmlFor); f.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f, ${JSON.stringify(value)}); f.dispatchEvent(new Event('input',{bubbles:true})); f.dispatchEvent(new Event('change',{bubbles:true})); })()`);
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
async function ready(panel) {
  await wait(`${inPanel(panel)}?.dataset.theme === ${JSON.stringify(theme)} && ${inPanel(panel)}?.lang === ${JSON.stringify(locale)}`);
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
    const copy = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/familyMoney.json`), 'utf8'));
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    reset(); role = 'parent';
    const geometry = {};

    // ── Tutor: the chore composer (D.10) ──
    await load('/tasks', parentId); await ready('chore-composer'); await page.evaluate(axeSource);
    const cc = copy.choreComposer;
    await click('chore-composer', cc.open);
    await wait(`${inPanel('chore-composer')}.querySelectorAll('[data-kind]').length === 2`);
    assert.equal(await page.evaluate(`[...${inPanel('chore-composer')}.querySelectorAll('[data-kind]')].filter(b=>b.getAttribute('aria-pressed')==='true').length`), 0, 'A kind was preselected');
    await type('chore-composer', cc.title, 'Set the table');
    await click('chore-composer', cc.submit);
    await wait(`${inPanel('chore-composer')}.innerText.includes(${JSON.stringify(cc.needKind)})`);
    assert.equal(state.posts.length, 0, 'A chore without a kind reached Core');
    geometry.composer = await audit('chore-composer');
    await click('chore-composer', cc.contribution, false);
    await page.evaluate(`[...${inPanel('chore-composer')}.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(cc.submit)}).focus()`);
    await enter();
    await wait(`${inPanel('chore-composer')}.innerText.includes(${JSON.stringify(fill(cc.added, { title: 'Set the table' }))})`);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: '/tasks', body: { assignedTo: kidId, title: 'Set the table', kind: 'contribution', rewardCoins: 0, recurrence: 'once', requiresEvidence: false } });
    await shot(`${width}-tutor-chore`, 'chore-composer');

    // ── Tutor: the holiday pause (D.2) ──
    const sp = copy.streakPauses;
    await load('/family', parentId); await ready('streak-pauses'); await page.evaluate(axeSource);
    await click('streak-pauses', sp.open);
    await wait(`${inPanel('streak-pauses')}.innerText.includes(${JSON.stringify(fill(sp.current, { count: 6 }))})`);
    await setDate('streak-pauses', sp.from, day(-10)); await setDate('streak-pauses', sp.to, day(-9));
    await click('streak-pauses', sp.submit);
    await wait(`${inPanel('streak-pauses')}.innerText.includes(${JSON.stringify(sp.invalid)})`);
    assert.equal(state.posts.filter((x) => x.path.includes('/streak/pauses')).length, 0, 'An out-of-range pause reached Core');
    await setDate('streak-pauses', sp.from, day(-1)); await setDate('streak-pauses', sp.to, day(4));
    await click('streak-pauses', sp.submit);
    await wait(`${inPanel('streak-pauses')}.innerText.includes(${JSON.stringify(sp.saved)}) && !!${inPanel('streak-pauses')}.querySelector('[data-pause-state=running]')`);
    assert.deepEqual(state.posts.at(-1).body, { startsOn: day(-1), endsOn: day(4) });
    geometry.pauses = await audit('streak-pauses');
    await shot(`${width}-tutor-pause`, 'streak-pauses');
    await click('streak-pauses', sp.end);
    await wait(`${inPanel('streak-pauses')}.innerText.includes(${JSON.stringify(sp.ended)}) && !${inPanel('streak-pauses')}.querySelector('[data-pause-state]')`);

    // ── Tutor: the savings bonus of an under-13 child (D.11) ──
    const bs = copy.bonusSettings;
    await load('/banking', parentId); await ready('bonus-settings'); await page.evaluate(axeSource);
    await click('bonus-settings', bs.open);
    await wait(`${inPanel('bonus-settings')}.innerText.includes(${JSON.stringify(bs.perTenBody)})`);
    assert.ok((await text('bonus-settings')).includes(fill(bs.reframedOff, { rate: 20 })), 'The Tutor was not told what changed');
    assert.equal(await page.evaluate(`!!${inPanel('bonus-settings')}.querySelector('input[type=number]')`), false, 'A percent field was offered for an under-13 child');
    await click('bonus-settings', bs.on);
    await click('bonus-settings', bs.save);
    await wait(`${inPanel('bonus-settings')}.innerText.includes(${JSON.stringify(bs.saved)}) && !${inPanel('bonus-settings')}.innerText.includes(${JSON.stringify(fill(bs.reframedOff, { rate: 20 }))})`);
    assert.deepEqual(state.posts.at(-1), { method: 'PUT', path: `/banking/savings-bonus/${kidId}`, body: { active: true } });
    geometry.bonusSettings = await audit('bonus-settings');
    await shot(`${width}-tutor-bonus`, 'bonus-settings');

    // ── Child (under 13): the streak and a family chore (D.2, D.10) ──
    role = 'kid'; framing = 'per_ten';
    const cs = copy.choreStreak;
    await load('/tasks', kidId); await ready('chore-streak'); await page.evaluate(axeSource);
    await wait(`${inPanel('chore-streak')}.innerText.includes(${JSON.stringify(fill(cs.days, { count: 6 }))})`);
    assert.ok((await text('chore-streak')).includes(fill(cs.restLeft, { count: 1 })));
    const kindLine = `${copy.choreKind.contribution} · ${copy.choreKind.noCoins}`;
    await wait(`document.body.innerText.includes(${JSON.stringify(kindLine)})`);
    assert.equal(await page.evaluate(`!!${inPanel('chore-streak')}.querySelector('[data-milestone]')`), false, 'An ordinary day celebrated');
    geometry.streak = await audit('chore-streak');
    // Since S07.5 (D.18) the child marks a chore done through the rebuilt ChoreDone control.
    const doneLabel = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/familyAutonomy.json`), 'utf8')).choreDone.markDone;
    const doneLookup = `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(doneLabel)})`;
    await wait(`!!(${doneLookup})`);
    await press(await page.evaluate(`(() => { const e=${doneLookup}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`));
    await wait(`${inPanel('chore-streak')}.querySelector('[data-milestone=streak-7]') && ${inPanel('chore-streak')}.innerText.includes(${JSON.stringify(fill(cs.milestone, { count: 7 }))})`);
    assert.equal(state.posts.filter((x) => x.path === `/tasks/${taskId}/complete`).length, 1);
    await shot(`${width}-kid-streak`, 'chore-streak');

    // ── Child (under 13): the bonus in groups of ten (D.11) ──
    const by = copy.bonusYoung;
    await load('/banking', kidId); await ready('bonus-explainer'); await page.evaluate(axeSource);
    await wait(`${inPanel('bonus-explainer')}.innerText.includes(${JSON.stringify(fill(by.next, { bonus: 5 }))})`);
    assert.equal(await page.evaluate(`${inPanel('bonus-explainer')}.querySelectorAll('[data-group=ten]').length`), 5);
    assert.ok(!(await text('bonus-explainer')).includes('%'), 'A percent reached an under-13 child');
    geometry.young = await audit('bonus-explainer');
    await shot(`${width}-kid-bonus`, 'bonus-explainer');

    // ── Child (14): the percentage and the worked example (D.11) ──
    framing = 'percent';
    const bt = copy.bonusTeen;
    await load('/banking', kidId); await ready('bonus-explainer'); await page.evaluate(axeSource);
    await wait(`${inPanel('bonus-explainer')}.innerText.includes(${JSON.stringify(fill(bt.rule, { rate: 15 }))})`);
    for (const line of [bt.compounding, bt.notInterest]) assert.ok((await text('bonus-explainer')).includes(line));
    await click('bonus-explainer', bt.open);
    await wait(`${inPanel('bonus-explainer')}.innerText.includes(${JSON.stringify(fill(bt.question, { saved: 200, rate: 15 }))})`);
    await type('bonus-explainer', bt.answer, '20');
    await click('bonus-explainer', bt.check);
    await wait(`${inPanel('bonus-explainer')}.innerText.includes(${JSON.stringify(bt.wrong)})`);
    await type('bonus-explainer', bt.answer, '30');
    await enter();
    await wait(`${inPanel('bonus-explainer')}.innerText.includes(${JSON.stringify(fill(bt.correct, { saved: 200, rate: 15, bonus: 30 }))})`);
    assert.deepEqual(state.examples, [{ step: 'shown' }, { step: 'answered', exampleSaved: 200, answer: 20 }, { step: 'answered', exampleSaved: 200, answer: 30 }]);
    assert.ok(!(await page.evaluate(`/confetti/i.test(${inPanel('bonus-explainer')}.innerHTML) || !!${inPanel('bonus-explainer')}.querySelector('[data-milestone]')`)), 'A right answer celebrated');
    geometry.teen = await audit('bonus-explainer');
    await shot(`${width}-teen-example`, 'bonus-explainer');

    evidence.push({ locale, theme, width, composerNoPreselect: true, kindRequiredLocally: true, contributionBody: true, pauseRefusedLocally: true, pauseSavedAndEnded: true,
      bonusFixedNoPercentField: true, reframedNoticeShownThenCleared: true, bonusPutWithoutRate: true, streakRestDays: true, kindLineShown: true, milestoneOnceAt7: true,
      youngGroupsOfTen: true, teenExampleWrongThenRight: true, posts: state.posts.map((x) => `${x.method} ${x.path}`), axeViolations: 0, geometry });
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  const failure = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (failure) writeFileSync(join(out, 'failure.png'), Buffer.from(failure.data, 'base64'));
  evidence.push({ failed: String(error), locale, theme, role, state: await page.evaluate('document.body.innerText.slice(0,2500)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Actual Tasks, Family and Banking routes in local Chrome with real pointer/keyboard input (date fields set through the input setter); synthetic Core. API and PostgreSQL evidence are separate; not full-stack E2E.', journeys: evidence.filter((e) => !e.failed).length, evidence, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
  await new Promise((done) => { browser.child.once('exit', done); setTimeout(done, 5000); });
  browser.child.kill();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log(JSON.stringify({ journeys: evidence.filter((e) => !e.failed).length, failed: evidence.filter((e) => e.failed) }));
