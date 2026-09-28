// S07.2 (D.3, OD-3 Option B) browser matrix: the actual /wallet route and app
// shell in local Chrome, real pointer + keyboard input, synthetic Core.
//
// Teen journey, every configuration: the learner shell shows Wallet and no
// Family/Banking, with Tasks locked; the first view fits the Copy Budget;
// logging income refuses an unsplit amount locally, then sends ONE request
// (no holder named) and reports the goal it reached; a personal reward the
// server refuses shows "not enough", a new reward is added with Enter and
// used; coins move out of a goal; the history labels the teen's own entries;
// a parent is invited and the teen confirms the parent who accepted, after
// which the shell unlocks Tasks.
// Every configuration: 3 locales x light/dark x 375/1280 px, scoped axe with
// zero violations, no overflow, 48 px targets, every text node with a copy
// role, no browser errors.
//
// Usage (dev server running):  TEEN_WALLET_URL=http://localhost:5340 node scripts/verify-teen-wallet.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.TEEN_WALLET_URL ?? 'http://localhost:5340';
const out = resolve(process.env.TEEN_WALLET_OUT ?? '../audit-results/teen-wallet'); mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const teenId = '55555555-5555-4555-8555-555555555555';
const goalId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const movieId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const snackId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const linkId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const T = '2026-09-24T10:00:00.000Z';
const token = (sub) => 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub, is_anonymous: false })).toString('base64url') + '.synthetic';

let locale = 'en-US', theme = 'light';
let state;
const evidence = [];
function reset() {
  state = { balances: { save: 10, spend: 4, share: 2 }, goalSaved: 10, goalStatus: 'active', rewards: [{ id: movieId, title: 'Movie night', cost: 50, status: 'active', createdAt: T, archivedAt: null }],
    entries: [{ id: 1, bucket: 'save', amount: 10, reason: 'self_income', note: null, source: 'allowance', rewardTitle: null, createdAt: T }],
    posts: [], linked: false, invited: false, decided: false, nextStep: null, celebrated: false };
}
const nextId = () => state.entries.length + 1;
// S07.4 (D.16, D.15): a goal as Core sends it, its progress by provenance (every
// coin here is the teen's own) and, once reached, the "next goal" step the
// database opens for it.
const goal = () => ({ id: goalId, kidUserId: teenId, title: 'Headphones', target: 16, icon: 'star', status: state.goalStatus, createdAt: T, reachedAt: state.goalStatus === 'reached' ? T : null,
  followsGoalId: null, saved: state.goalSaved, progress: { own: state.goalSaved, bonus: 0, family: 0, total: state.goalSaved }, nextStep: state.nextStep });
const SPLIT = { save: 50, spend: 40, share: 10 };
// A 14-year-old: "Beyond the app" (D.19) opens at 15, and nobody said yes to research (D.22).
const BRIDGE = { eligible: false, minAge: 15, moments: [] };
const RESEARCH = { research: { participating: false, recording: false, grantor: null, since: null, disclosureVersion: 0, adult: false, months: 0 }, currentVersion: 1 };

await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data); if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params; const url = new URL(request.url);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return void await page.send('Fetch.continueRequest', { requestId });
    if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    let status = 200; const body = { data: {}, error: null }; const p = url.pathname.replace('/api/v1', ''); const method = request.method;
    const fail = (code, s = 409) => { status = s; body.data = null; body.error = { code, message: 'Synthetic' }; };
    const sent = request.postData ? JSON.parse(request.postData) : undefined;
    if (method !== 'OPTIONS') {
      if (method !== 'GET') state.posts.push({ method, path: p, body: sent });
      if (p === '/auth/me') body.data = { profile: { display_name: 'Sam', locale, theme, cover: {} }, roles: ['universal'], avatarOptions: {}, analyticsEnabled: false, isGuest: false, newAccount: false, onboardingComplete: true };
      else if (p === '/auth/age-screen') body.data = { required: false, ageBand: '13_to_17', protectedOrigin: false };
      else if (p === '/wallet/access') body.data = { holder: 'teen', familyChild: state.linked };
      else if (p === '/tasks/wallet') body.data = { balances: state.balances };
      else if (p === '/tasks/goals' && method === 'GET') body.data = { goals: [goal()] };
      else if (p === `/tasks/goals/${goalId}/next-step/seen`) { body.data = { celebrate: !state.celebrated }; state.celebrated = true; state.nextStep = { state: 'prompted', nextGoalId: null }; }
      else if (p === '/tasks/wallet/split' && method === 'GET') body.data = { usual: SPLIT, custom: false, recommended: SPLIT };
      else if (p === '/tasks/share' && method === 'GET') body.data = { destinations: [], gifts: [] };
      else if (p === '/family-hub/bridge' && method === 'GET') body.data = BRIDGE;
      else if (p === '/family-hub/research/me' && method === 'GET') body.data = RESEARCH;
      else if (p === '/tasks/wallet/ledger') body.data = { entries: [...state.entries].reverse() };
      else if (p === '/wallet/rewards' && method === 'GET') body.data = { rewards: state.rewards };
      else if (p === '/wallet/guardians') body.data = { guardians: state.invited ? [{ linkId, displayName: 'Ana', status: state.decided ? 'verified' : 'pending', since: T, decidedAt: state.decided ? T : null, awaitingMe: !state.decided }] : [] };
      else if (p === '/wallet/income') {
        await sleep(120);
        state.balances.save += sent.save; state.balances.spend += sent.spend; state.balances.share += sent.share;
        if (sent.goalId === goalId) { state.goalSaved += sent.save; if (state.goalSaved >= 16) { state.goalStatus = 'reached'; state.nextStep = { state: 'pending', nextGoalId: null }; } }
        state.entries.push({ id: nextId(), bucket: 'spend', amount: sent.spend, reason: 'self_income', note: null, source: sent.source, rewardTitle: null, createdAt: T });
        body.data = { actionId, goal: sent.goalId ? goal() : null };
      } else if (p === `/wallet/rewards/${movieId}/claim`) fail('INSUFFICIENT_BALANCE');
      else if (p === '/wallet/rewards' && method === 'POST') {
        state.rewards = [{ id: snackId, title: sent.title, cost: sent.cost, status: 'active', createdAt: T, archivedAt: null }, ...state.rewards];
        body.data = { rewardId: snackId };
      } else if (p === `/wallet/rewards/${snackId}/claim`) {
        const reward = state.rewards.find((r) => r.id === snackId);
        state.balances.spend -= reward.cost;
        state.entries.push({ id: nextId(), bucket: 'spend', amount: -reward.cost, reason: 'personal_reward', note: null, source: null, rewardTitle: reward.title, createdAt: T });
        body.data = { actionId };
      } else if (p === `/wallet/goals/${goalId}/release`) {
        state.goalSaved -= sent.amount; state.balances.save -= sent.amount; state.balances[sent.destination] += sent.amount;
        state.entries.push({ id: nextId(), bucket: sent.destination, amount: sent.amount, reason: 'goal_release', note: null, source: null, rewardTitle: null, createdAt: T });
        body.data = { actionId };
      } else if (p === '/wallet/guardian-invite') { state.invited = true; body.data = { token: 'q'.repeat(32), expiresAt: '2026-10-01T10:00:00.000Z' }; }
      else if (p === `/wallet/guardians/${linkId}/decision`) { state.decided = true; state.linked = sent.decision === 'confirm'; body.data = { linkId, status: sent.decision === 'confirm' ? 'verified' : 'rejected' }; }
      else if (p === '/analytics/tracking-decision') body.data = { excluded: true, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});

const ROOT = `document.querySelector('[data-teen-wallet=root]')`;
async function wait(expression) { for (let i = 0; i < 200; i++) { try { if (await page.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
async function pointAt(lookup, label, centre = false) {
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
async function press(point) {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
// A button or link, or a shared choice (a radio/checkbox is pressed through its visible <label>).
const button = (text) => `[...${ROOT}.querySelectorAll('button,a,label:has(> input[type=radio]),label:has(input[type=checkbox])')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && !e.disabled && !e.querySelector('input:disabled'))`;
async function click(text) { await wait(`!!(${button(text)})`); await press(await pointAt(button(text), text)); }
const field = (label) => `(() => { const l=[...${ROOT}.querySelectorAll('label')].find(l=>l.textContent.trim()===${JSON.stringify(label)}); return l && document.getElementById(l.htmlFor); })()`;
async function type(label, text) {
  await wait(`!!${field(label)} && !${field(label)}.disabled`);
  await press(await pointAt(field(label), label));
  await page.evaluate(`${field(label)}.select?.()`);
  await page.send('Input.insertText', { text });
}
async function choose(label, value) {
  // A native <select>: focus it with the pointer, then pick the option with the keyboard.
  await wait(`!!${field(label)}`);
  await press(await pointAt(field(label), label));
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  for (let i = 0; i < 4 && !(await page.evaluate(`${field(label)}.value === ${JSON.stringify(value)}`)); i++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  }
  assert.equal(await page.evaluate(`${field(label)}.value`), value, 'goal not chosen by keyboard');
}
async function enterOn(text) {
  await page.evaluate(`(${button(text)}).focus()`);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}
const has = (text) => `${ROOT}.innerText.includes(${JSON.stringify(text)})`;
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
async function audit(step) {
  await settle();
  const geometry = await page.evaluate(`(() => { const e=${ROOT}; const small=[...e.querySelectorAll('button,input,select,textarea,a')].filter(c=>{const t=c.matches('input[type=radio],input[type=checkbox]')?(c.closest('label')??(c.id&&document.querySelector('label[for="'+c.id+'"]'))??c):c;const r=t.getBoundingClientRect();return r.width<48||r.height<48;}).map(c=>c.textContent.trim()||c.tagName); const unroled=[]; const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT); for(let n=w.nextNode();n;n=w.nextNode()){ if(n.textContent.trim() && !n.parentElement.closest('[data-copy-role]') && !n.parentElement.closest('option')) unroled.push(n.textContent.trim()); } return { scroll:e.scrollWidth, client:e.clientWidth, small, unroled, pageScroll: document.documentElement.scrollWidth - innerWidth }; })()`);
  assert.ok(geometry.scroll <= geometry.client + 1, `${step}: the wallet overflows`);
  assert.ok(geometry.pageScroll <= 1, `${step}: horizontal page scroll`);
  assert.deepEqual(geometry.small, [], `${step}: targets under 48 px`);
  assert.deepEqual(geometry.unroled, [], `${step}: text without a copy role`);
  const axe = await page.evaluate(`axe.run(${ROOT})`);
  assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${JSON.stringify(n.any?.[0]?.data ?? null)}`).join(', ')}`), [], `${step}: axe violations`);
  return geometry;
}
async function shot(name) {
  await settle();
  writeFileSync(join(out, `${locale}-${theme}-${name}.png`), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
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
const wordsIn = (expression) => page.evaluate(`(${expression}).innerText.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)?.length ?? 0`);

try {
  await warmDevServer(page, origin); await page.send('Page.navigate', { url: origin }); await wait('!!document.body');
  const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');
  const only = (name, all) => (process.env[name] ? process.env[name].split(',') : all);
  for (locale of only('TEEN_WALLET_LOCALES', ['en-US', 'es-MX', 'pt-BR'])) for (theme of only('TEEN_WALLET_THEMES', ['light', 'dark'])) for (const width of only('TEEN_WALLET_WIDTHS', ['375', '1280']).map(Number)) {
    const copy = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/teenWallet.json`), 'utf8'));
    // The rebuilt shell's labels (rebuild-core.json); the legacy dashboard.json went with the legacy UI (S10L.1).
    const shellNav = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-core.json`), 'utf8')).appShell.nav;
    const nav = { family: shellNav.family, banking: shellNav.familyCoins };
    // S07.4/S07.6 (D.16, D.12): a goal's progress is the shared GoalProgress line in the teen register.
    const progressOf = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/moneyRegister.json`), 'utf8')).goalProgress.teen.of;
    const progress = (saved, target) => progressOf.replace('{saved}', String(saved)).replace('{target}', String(target)).replace('{pct}', String(Math.min(100, Math.floor((saved * 100) / target))));
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    reset();
    await load('/wallet', teenId);
    await wait(`${ROOT}?.dataset.theme === ${JSON.stringify(theme)} && ${ROOT}?.lang === ${JSON.stringify(locale)} && ${has(copy.page.total.replace('{n}', '16'))}`);
    await page.evaluate(axeSource);

    // Shell: Wallet present, no Family/Banking, Tasks locked (a button, not a link).
    const shell = await page.evaluate(`({ wallet: !!document.querySelector('a[href="/wallet"]'), family: !!document.querySelector('a[href="/family"]') || [...document.querySelectorAll('button')].some(b=>b.textContent.includes(${JSON.stringify(nav.family)})),
      banking: !!document.querySelector('a[href="/banking"]') || [...document.querySelectorAll('button')].some(b=>b.textContent.includes(${JSON.stringify(nav.banking)})), tasksLink: !!document.querySelector('a[href="/tasks"]') })`);
    assert.deepEqual(shell, { wallet: true, family: false, banking: false, tasksLink: false }, 'teen shell');
    const firstViewWords = await wordsIn(ROOT);
    assert.ok(firstViewWords <= (locale === 'en-US' ? 40 : 50), `first view has ${firstViewWords} words`);
    const firstGeometry = await audit('first view');
    await shot(`${width}-first-view`);

    // Income: an unsplit amount is refused locally; then ONE request, a goal reached.
    // S07.4 (D.13): the amount arrives pre-split by the usual split (50/40/10:
    // 6 + 5 + 1 of 12), so the teen overrides a pocket to leave it unsplit.
    await click(copy.income.open);
    await type(copy.income.amount, '12');
    await click(copy.income.gift);
    await wait(`${field(copy.page.save)}.value === '6' && ${field(copy.page.spend)}.value === '5' && ${field(copy.page.share)}.value === '1'`);
    await type(copy.page.save, '8');
    await click(copy.income.submit);
    await wait(`!!${ROOT}.querySelector('[role=alert]') && ${has(copy.income.splitMismatch.replace('{n}', '12'))}`);
    assert.equal(state.posts.length, 0, 'an unsplit income reached Core');
    await type(copy.page.save, '6');
    await type(copy.page.spend, '4');
    await type(copy.page.share, '2');
    await wait(has(copy.income.done));
    await choose(copy.income.toGoal, goalId);
    await audit('income form');
    await enterOn(copy.income.submit);
    await wait(`${has(copy.income.added.replace('{n}', '12'))} && ${has(copy.income.goalReached.replace('{goal}', 'Headphones'))}`);
    assert.deepEqual(state.posts, [{ method: 'POST', path: '/wallet/income', body: { source: 'gift', save: 6, spend: 4, share: 2, goalId } }]);
    await wait(has(copy.page.total.replace('{n}', '28')));
    assert.ok(!(await page.evaluate(`/confetti|celebrat/i.test(${ROOT}.innerHTML) || !!${ROOT}.querySelector('canvas')`)), 'no celebration');
    await shot(`${width}-income`);

    // Rewards: a refused use, a reward added with Enter, then used.
    await click(copy.rewards.open);
    await wait(has('Movie night'));
    await click(copy.rewards.use);
    await wait(has(copy.rewards.notEnough));
    await type(copy.rewards.name, 'Snack');
    await type(copy.rewards.cost, '3');
    await enterOn(copy.rewards.create);
    await wait(`${has(copy.rewards.created)} && ${has('Snack')}`);
    await page.evaluate(`[...${ROOT}.querySelectorAll('li')].find(li=>li.innerText.includes('Snack')).querySelector('button').focus()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await wait(has(copy.rewards.used.replace('{n}', '3')));
    const rewardsGeometry = await audit('rewards');
    await shot(`${width}-rewards`);

    // Goals: move 4 coins out of the reached goal into Spend.
    await click(copy.goals.open);
    await wait(has(progress(16, 16)));
    // S07.4 (D.15, OD-7): the reached goal's first view celebrates exactly once (the server
    // says so), with "what's your next goal?". Let the moment land before pointing at the card.
    await wait(`${ROOT}.querySelector('[data-money-habits=next-goal]')?.dataset.celebrating === 'savings-goal-reached' && ${ROOT}.querySelector('[data-money-habits=next-goal] [data-celebration]')?.dataset.celebration !== 'playing'`);
    assert.equal(state.posts.filter((x) => x.path === `/tasks/goals/${goalId}/next-step/seen`).length, 1, 'the next-goal moment was not asked for exactly once');
    await settle();
    await click(copy.goals.move);
    await type(copy.goals.moveAmount, '4');
    await click(copy.goals.confirmMove);
    await wait(`${has(copy.goals.moved.replace('{n}', '4'))} && ${has(progress(12, 16))}`);
    const goalsGeometry = await audit('goals');
    await shot(`${width}-goals`);

    // History: the teen's own entries, labelled.
    await click(copy.history.open);
    await wait(`${has(copy.history.reward)} && ${has(copy.history.goalMove)} && ${has(copy.income.gift)} && ${has('Snack')}`);
    const historyGeometry = await audit('history');
    await shot(`${width}-history`);

    // Parents: Tasks locked; invite; confirm the parent who accepted; Tasks unlock.
    await click(copy.parents.open);
    await wait(has(copy.parents.tasksLocked));
    await click(copy.parents.invite);
    await wait(`${has('/family?join=' + 'q'.repeat(32))} && ${has(copy.parents.linkReady)}`);
    await click(copy.parents.copy);
    await wait(`${has(copy.parents.copied)} || ${has(copy.parents.copyFailed)}`);
    // The parent accepts out of band; the teen comes back to the wallet later.
    await load('/wallet', teenId);
    await wait(`${ROOT}?.lang === ${JSON.stringify(locale)} && ${has(copy.page.total.replace('{n}', '25'))}`);
    await page.evaluate(axeSource);
    await click(copy.parents.open);
    await wait(has(copy.parents.waiting.replace('{name}', 'Ana')));
    await audit('parents pending');
    await click(copy.parents.confirm);
    await wait(`${has(copy.parents.confirmed.replace('{name}', 'Ana'))} && ${has(copy.parents.tasksOn)}`);
    await wait(`!!document.querySelector('a[href="/tasks"]')`);
    const parentsGeometry = await audit('parents linked');
    await shot(`${width}-parents-linked`);
    evidence.push({ locale, theme, width, shell, firstViewWords, splitRefusedLocally: true, oneIncomeRequest: true, goalReachedPlain: true, rewardRefusal: true, rewardAddedAndUsed: true,
      goalRelease: true, historyLabelled: true, invite: true, teenConfirmedParent: true, tasksUnlockedAfterLink: true, posts: state.posts.map((p) => p.path), axeViolations: 0,
      geometry: { first: firstGeometry, rewards: rewardsGeometry, goals: goalsGeometry, history: historyGeometry, parents: parentsGeometry } });
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  const failure = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (failure) writeFileSync(join(out, 'failure.png'), Buffer.from(failure.data, 'base64'));
  evidence.push({ failed: String(error), locale, theme, state: await page.evaluate('document.body.innerText.slice(0,2500)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Actual /wallet route and app shell in local Chrome with real pointer/keyboard input; synthetic Core. API and PostgreSQL evidence are separate; not full-stack E2E.', journeys: evidence.filter((e) => !e.failed).length, evidence, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
  // The throwaway Chrome profile is not evidence; remove it once Chrome has let go of it.
  await new Promise((done) => { browser.child.once('exit', done); setTimeout(done, 5000); });
  browser.child.kill();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log(JSON.stringify({ journeys: evidence.filter((e) => !e.failed).length, failed: evidence.filter((e) => e.failed) }));
