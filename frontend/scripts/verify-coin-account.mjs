// S07.6 (D.7, D.12) browser matrix: the actual Banking route in local Chrome,
// real pointer input, synthetic Core responses.
//
// Child journeys (/banking), one per age register, as Core decides it:
//   - young (a parent-created child of 8): the practice card with no card
//     number, what a freeze really holds (the four holds the server sends),
//     "what is left" of the spending limit and three totals, no percentage and
//     no ratio anywhere on the coin account, the usual split "5 of 10"; the
//     child freezes (exact body), reads "You froze it." and unfreezes (exact body);
//   - transition (11): used of the cap over the last 7 days, "of your"
//     totals, the usual split "5 of 10" over "so 50 of 100", the bonus's "out of
//     100" bridge, and still no percentage;
//   - teen (a linked 15-year-old): percentages and the latest lines; a
//     Tutor's freeze offers no Unfreeze and says who can lift it.
// Tutor journey (/banking): the rebuilt freeze card names the view the child
//   reads, asks once before freezing (exact body), and says a freeze moves no
//   coins.
// Every configuration: 3 locales x light/dark x 375/1280 px, scoped axe with
// zero violations, no panel overflow or page scroll, 48 px targets, a copy
// role on every text node, only registered data-control values, no
// celebration, zero browser errors.
//
// Usage (dev server running):  COIN_ACCOUNT_URL=http://localhost:5340 node scripts/verify-coin-account.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const origin = process.env.COIN_ACCOUNT_URL ?? 'http://localhost:5340';
const out = resolve(process.env.COIN_ACCOUNT_OUT ?? '../audit-results/coin-account'); mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const parentId = '11111111-1111-4111-8111-111111111111';
const kidId = '22222222-2222-4222-8222-222222222222';
const teenId = '56565656-5656-4565-8565-565656565656';
const T = '2026-09-20T10:00:00.000Z';
const token = (sub) => 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub, is_anonymous: false })).toString('base64url') + '.synthetic';
const CONTROLS = new Set(JSON.parse(readFileSync(resolve('../docs/operations/block-d-controls.json'), 'utf8')).controls.map((c) => c.id));
const HOLDS = ['rewards', 'splits', 'credits', 'share'];

let locale = 'en-US', theme = 'light', role = 'kid', register = 'young';
let state;
const evidence = [];
function reset() { state = { posts: [], frozen: false, frozenBy: null }; }

const freeze = (reader) => {
  const by = !state.frozen ? null : state.frozenBy === reader ? 'you' : state.frozenBy === 'child' && reader === 'tutor' ? 'child' : 'tutor';
  return { frozen: state.frozen, by, since: state.frozen ? T : null, holds: HOLDS, canChange: reader === 'tutor' ? true : !state.frozen || by === 'you' };
};
const limit = () => register === 'young' ? { configured: true, period: 'weekly', remaining: 5 }
  : register === 'transition' ? { configured: true, period: 'weekly', remaining: 5, cap: 20, used: 15 }
    : { configured: true, period: 'weekly', remaining: 5, cap: 20, used: 15, usedPercent: 75 };
const month = () => register === 'young' ? { month: '2026-09', earned: 30, spent: 10, saved: 20 }
  : register === 'transition' ? { month: '2026-09', earned: 30, spent: 10, saved: 20, given: 2, adjusted: 0 }
    : { month: '2026-09', earned: 30, spent: 10, saved: 20, given: 2, adjusted: 1, lines: [
      { id: 1, bucket: 'save', amount: 5, reason: 'task_approved', createdAt: T }, { id: 2, bucket: 'spend', amount: -4, reason: 'redemption', createdAt: T },
      { id: 3, bucket: 'save', amount: 2, reason: 'savings_bonus', createdAt: T }] };
const overview = () => ({ register, account: { nickname: 'Rocket', design: register === 'teen' ? 'violet' : 'emerald', simulated: true, freeze: freeze('child') },
  pockets: { save: 20, spend: 15, share: 5 }, pendingCredits: 0, spendLimit: limit(), statement: month() });

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
      const roles = role === 'parent' ? ['parent'] : role === 'teen' ? ['universal'] : ['kid'];
      if (p === '/auth/me') body.data = { profile: { display_name: role === 'parent' ? 'Ana' : 'Nico', locale, theme, cover: {} }, roles, avatarOptions: {}, analyticsEnabled: false, isGuest: false, newAccount: false, onboardingComplete: true };
      else if (p === '/auth/age-screen') body.data = { required: false, ageBand: role === 'parent' ? 'adult' : role === 'teen' ? '13_to_17' : 'under_13', protectedOrigin: false };
      else if (p === '/wallet/access') body.data = { holder: role === 'teen' ? 'teen' : role === 'kid' ? 'managed_child' : null, familyChild: role !== 'parent' };
      // The child's coin account and the panels around it.
      else if (p === '/banking/overview') body.data = overview();
      else if (p === '/banking/register') body.data = { register };
      else if (p === '/banking/account' && method === 'GET') body.data = { account: { nickname: 'Rocket', cardDesign: 'emerald', frozen: state.frozen, frozenBy: state.frozen ? (state.frozenBy === 'child' ? kidId : parentId) : null, frozenAt: null, openedAt: T } };
      else if (p === '/banking/account/freeze') { await sleep(60); state.frozen = sent.frozen; state.frozenBy = sent.frozen ? 'child' : null; body.data = { account: { frozen: state.frozen } }; }
      else if (p === '/banking/wallet/pending-credits') body.data = { credits: [] };
      else if (p === '/banking/savings-bonus' && method === 'GET') body.data = register === 'teen'
        ? { rule: { rateBp: 1000, active: true, nextRunAt: T }, framing: 'percent', perTen: null, maxRateBp: 2000, saved: 20, nextBonus: 2, example: { shown: false, completed: false } }
        : { rule: { rateBp: 1000, active: true, nextRunAt: T }, framing: 'per_ten', perTen: { unit: 10, coins: 1 }, maxRateBp: null, saved: 20, nextBonus: 2, example: null };
      else if (p === '/tasks/wallet') body.data = { balances: { save: 20, spend: 15, share: 5 } };
      else if (p === '/tasks/wallet/ledger') body.data = { entries: [] };
      else if (p === '/tasks/wallet/split') body.data = { usual: { save: 50, spend: 40, share: 10 }, custom: false, recommended: { save: 50, spend: 40, share: 10 } };
      else if (p === '/tasks/goals') body.data = { goals: [] };
      // The Tutor's Banking page.
      else if (p === '/family/kids') body.data = { kids: [{ userId: kidId, displayName: 'Nico', username: 'nico', analyticsConsent: false, pendingApprovalCount: 0, walletTotal: 40, taskStreakDays: 0, accountType: 'child' }] };
      else if (p === `/banking/accounts/${kidId}/freeze` && method === 'GET') body.data = { register, account: { nickname: 'Rocket', design: 'emerald', simulated: true, freeze: freeze('tutor') } };
      else if (p === `/banking/accounts/${kidId}/freeze`) { await sleep(60); state.frozen = sent.frozen; state.frozenBy = sent.frozen ? 'tutor' : null; body.data = { account: { frozen: state.frozen } }; }
      else if (p === `/banking/accounts/${kidId}`) body.data = { account: { nickname: 'Rocket', cardDesign: 'emerald', frozen: state.frozen, frozenBy: null, frozenAt: null, openedAt: T } };
      else if (p === `/banking/allowance/${kidId}`) body.data = { rule: null };
      else if (p === `/banking/spend-limit/${kidId}`) body.data = { status: { configured: false } };
      else if (p === `/banking/savings-bonus/${kidId}`) body.data = { rule: null, framing: 'per_ten', perTen: { unit: 10, coins: 1 }, maxRateBp: null };
      else if (p === '/tasks/decisions/queue') body.data = { chores: [], openChores: [], rewards: [], reviews: [], nudges: [], levelRequests: [] };
      else if (p === '/family/guardian-links/mine') body.data = { links: [] };
      // S07.7 neighbours on the child's page: "Beyond the app" opens at 15 (the linked teen), and nobody said yes to research.
      else if (p === '/family-hub/bridge' && method === 'GET') body.data = role === 'teen'
        ? { eligible: true, minAge: 15, moments: ['first_pay', 'first_account', 'first_budget'].map((milestone) => ({ milestone, arrived: false, steps: [] })) }
        : { eligible: false, minAge: 15, moments: [] };
      else if (p === '/family-hub/research/me' && method === 'GET') body.data = { research: { participating: false, recording: false, grantor: null, since: null, disclosureVersion: 0, adult: false, months: 0 }, currentVersion: 1 };
      else if (p === '/analytics/tracking-decision') body.data = { excluded: true, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId: rid, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});

async function wait(expression) { for (let i = 0; i < 200; i++) { try { if (await page.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
const PANELS = { child: '[data-coin-account=child]', tutor: '[data-coin-account=tutor]', split: '[data-money-habits=usual-split]', bonus: '[data-family-money=bonus-explainer]' };
const inPanel = (panel) => `document.querySelector(${JSON.stringify(PANELS[panel])})`;
async function press(point) {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function click(panel, text) {
  const lookup = `[...${inPanel(panel)}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && !e.disabled)`;
  await wait(`!!(${inPanel(panel)}) && !!(${lookup})`);
  const point = await page.evaluate(`(async () => { const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    let last = null;
    for (let i = 0; i < 30; i++) { const e=${lookup}; if (!e) { await frame(); continue; } e.scrollIntoView({block:'center',behavior:'instant'}); await frame();
      const r=e.getBoundingClientRect(); const key=r.x+':'+r.y+':'+r.width+':'+r.height;
      if (key === last) { const x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error(${JSON.stringify('Occluded action ' + text)}); return {x,y}; }
      last = key; }
    throw Error(${JSON.stringify('Unstable action ' + text)}); })()`);
  await press(point);
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
  const geometry = await page.evaluate(`(() => { const e=${inPanel(panel)}; const small=[...e.querySelectorAll('button,input,select,textarea')].filter(c=>{const t=c.matches('input[type=radio],input[type=checkbox]')?(c.closest('label')??(c.id&&document.querySelector('label[for="'+c.id+'"]'))??c):c;const r=t.getBoundingClientRect();return r.width<48||r.height<48;}).map(c=>c.textContent.trim()||c.getAttribute('aria-label')||c.tagName); const unroled=[]; const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT); for(let n=w.nextNode();n;n=w.nextNode()){ if(n.textContent.trim() && !n.parentElement.closest('[data-copy-role]')) unroled.push(n.textContent.trim()); } const controls=[...e.querySelectorAll('[data-control]')].map(c=>c.getAttribute('data-control')); return { scroll:e.scrollWidth, client:e.clientWidth, small, unroled, controls, pageScroll: document.documentElement.scrollWidth - innerWidth, celebration: !!document.querySelector('[data-milestone], .lf-confetti, [data-celebration]') }; })()`);
  assert.ok(geometry.scroll <= geometry.client + 1, `${panel} overflows`);
  assert.ok(geometry.pageScroll <= 1, `${panel} causes horizontal page scroll`);
  assert.deepEqual(geometry.small, [], `${panel} has targets under 48 px`);
  assert.deepEqual(geometry.unroled, [], `${panel} has text without a copy role`);
  assert.deepEqual(geometry.controls.filter((c) => !CONTROLS.has(c)), [], `${panel} declares an unregistered control`);
  assert.equal(geometry.celebration, false, `${panel}: something celebrates (OD-7)`);
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
async function ready(panel) {
  await wait(`${inPanel(panel)}?.closest('[data-theme]')?.dataset.theme === ${JSON.stringify(theme)} && ${inPanel(panel)}?.closest('[lang]')?.lang === ${JSON.stringify(locale)}`);
  // The app cross-fades between modes (W2 Lane 0 shells): a contrast read during the fade measures the old mode's text on the new ground.
  await wait("!document.documentElement.classList.contains('theme-transitioning')");
  // ...and every finite animation or colour transition (the page body's entrance fade, a surface settling into the new mode):
  // an axe read mid-change blends the text into the ground. Idle loops (infinite) are not waited for.
  await wait("document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity)");
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
  const only = (name, all) => (process.env[name] ? process.env[name].split(',') : all);
  for (locale of only('COIN_ACCOUNT_LOCALES', ['en-US', 'es-MX', 'pt-BR'])) for (theme of only('COIN_ACCOUNT_THEMES', ['light', 'dark'])) for (const width of only('COIN_ACCOUNT_WIDTHS', ['375', '1280']).map(Number)) {
    const c = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/coinAccount.json`), 'utf8'));
    const reg = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/moneyHabits.json`), 'utf8'));
    const overlay = JSON.parse(readFileSync(resolve(`src/i18n/${locale}/moneyRegister.json`), 'utf8'));
    const nf = new Intl.NumberFormat(locale);
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    const geometry = {};

    // ── Child, young register (D.7, D.12) ──
    reset(); role = 'kid'; register = 'young';
    await load('/banking', kidId); await ready('child'); await page.evaluate(axeSource);
    const y = c.young;
    await has('child', y.practice); await has('child', y.coinsOnly);
    // W2F.2: while nothing is frozen, what a freeze pauses is one press away (06 §4 layering); pressed here, then checked.
    await click('child', y.whatHolds);
    for (const k of ['holdRewards', 'holdSplits', 'holdCredits', 'holdShare']) await has('child', y[k]);
    await has('child', fill(y.limitWeekly, { remaining: 5 }));
    await has('child', y.limitWhen);
    const youngText = await text('child');
    assert.ok(!/%/.test(youngText), 'A percentage reached a young reader');
    assert.ok(!/LF-\d{4}/.test(await page.evaluate('document.body.innerText')), 'A card number is on the page');
    geometry.young = await audit('child');
    await shot(`${width}-young`, 'child');
    await click('child', y.freeze);
    await has('child', y.byYou);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: '/banking/account/freeze', body: { frozen: true } });
    await has('child', y.frozenNotice);
    geometry.youngFrozen = await audit('child');
    await shot(`${width}-young-frozen`, 'child');
    await click('child', y.unfreeze);
    await has('child', y.notFrozen);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: '/banking/account/freeze', body: { frozen: false } });
    await ready('split'); await click('split', reg.usualSplit.open);
    await has('split', fill(overlay.usualSplit.young.tenths, { count: 5 }));
    assert.ok(!/%/.test(await text('split')), 'The young usual split shows a percentage');

    // ── Child, transition register (D.12) ──
    reset(); register = 'transition';
    await load('/banking', kidId); await ready('child'); await page.evaluate(axeSource);
    const tr = c.transition;
    await has('child', fill(tr.limitWeekly, { used: 15, cap: 20, remaining: 5 }));
    await has('child', fill(tr.pocketDetail, { count: nf.format(20), total: nf.format(40) }));
    assert.ok(!/%/.test(await text('child')), 'A percentage reached a transition reader');
    geometry.transition = await audit('child');
    await shot(`${width}-transition`, 'child');
    await ready('bonus'); await has('bonus', overlay.bonus.transition.scaffold);
    await ready('split'); await click('split', reg.usualSplit.open);
    await has('split', fill(overlay.usualSplit.transition.tenths, { count: 5 }));
    await has('split', fill(overlay.usualSplit.transition.scale, { pct: 50 }));
    geometry.transitionSplit = await audit('split');
    await shot(`${width}-transition-split`, 'split');

    // ── Linked teen, teen register, a Tutor's freeze (D.7, D.12) ──
    reset(); role = 'teen'; register = 'teen'; state.frozen = true; state.frozenBy = 'tutor';
    await load('/banking', teenId); await ready('child'); await page.evaluate(axeSource);
    const te = c.teen;
    await has('child', fill(te.limitWeekly, { used: 15, cap: 20, pct: 75, remaining: 5 }));
    await has('child', te.byTutor); await has('child', te.onlyTutor); await has('child', te.lineBonus);
    assert.equal(await page.evaluate(`[...${inPanel('child')}.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(te.unfreeze)})`), false, 'A child was offered a way to lift a Tutor freeze');
    geometry.teen = await audit('child');
    await shot(`${width}-teen-tutor-freeze`, 'child');

    // ── Tutor: the rebuilt freeze card (D.7) ──
    reset(); role = 'parent'; register = 'young';
    await load('/banking', parentId); await ready('tutor'); await page.evaluate(axeSource);
    const tu = c.tutor;
    await has('tutor', fill(tu.view, { name: 'Nico', band: tu.bandYoung }));
    // W2F.2: what a freeze holds (and that it moves no coins) is shown at the point of action, the confirmation;
    // before it, one press away (06 §4 layering).
    await click('tutor', tu.freeze);
    await has('tutor', fill(tu.confirmFreeze, { name: 'Nico' }));
    await has('tutor', tu.noCoinsMoved);
    for (const k of ['holdRewards', 'holdSplits', 'holdCredits', 'holdShare']) await has('tutor', tu[k]);
    assert.equal(state.posts.length, 0, 'Freezing did not ask first');
    geometry.tutorConfirm = await audit('tutor');
    await shot(`${width}-tutor-confirm`, 'tutor');
    await click('tutor', tu.confirm);
    await has('tutor', tu.byYou);
    assert.deepEqual(state.posts.at(-1), { method: 'POST', path: `/banking/accounts/${kidId}/freeze`, body: { frozen: true } });
    geometry.tutorFrozen = await audit('tutor');
    await shot(`${width}-tutor-frozen`, 'tutor');

    evidence.push({ locale, theme, width, practiceCardNoNumber: true, holdsFromServer: HOLDS, youngNoPercent: true, youngFreezeBodies: true,
      transitionScaffold: true, transitionNoPercent: true, teenPercent: true, tutorFreezeNotLiftableByChild: true, tutorConfirmBeforeFreeze: true,
      noCelebration: true, posts: state.posts.map((x) => `${x.method} ${x.path}`), axeViolations: 0, geometry });
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  const failure = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (failure) writeFileSync(join(out, 'failure.png'), Buffer.from(failure.data, 'base64'));
  evidence.push({ failed: String(error), locale, theme, role, register, state: await page.evaluate('document.body.innerText.slice(0,2500)').catch(() => null) });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Actual Banking route in local Chrome with real pointer input; synthetic Core. API and PostgreSQL evidence are separate; not full-stack E2E.', journeys: evidence.filter((e) => !e.failed).length, evidence, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
  await new Promise((done) => { browser.child.once('exit', done); setTimeout(done, 5000); });
  browser.child.kill();
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log(JSON.stringify({ journeys: evidence.filter((e) => !e.failed).length, failed: evidence.filter((e) => e.failed) }));
