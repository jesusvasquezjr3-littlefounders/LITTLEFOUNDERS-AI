import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * S01.4g browser half: the teen's own memory-review gate on the real Settings
 * route. Synthetic Core: failed first read + retry, two parked notes, a failed
 * approve retried to success, a delete, and a reload that sees the server's
 * post-decision state. Real pointer input, scoped axe, overflow checks.
 */

const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/memory-self-review'); mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
let reads = 0, locale = 'en-US', theme = 'light';
let queue = [{ id: P1, store: 'learner', proposed: 'I like counting coins', expectedBefore: 'Old note', sessionId: null, createdAt: '2026-09-20T10:00:00.000Z' },
  { id: P2, store: 'pedagogy', proposed: 'I need more time with subtraction', expectedBefore: null, sessionId: null, createdAt: '2026-09-21T10:00:00.000Z' }];
let current = { learner: null, pedagogy: null };
const evidence = [], decisions = [], requestLog = [];
let decisionAttempts = 0;
await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data); if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params; const url = new URL(request.url);
  if (url.pathname.startsWith('/api/v1/')) requestLog.push(`${request.method} ${url.pathname}`);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return void await page.send('Fetch.continueRequest', { requestId });
    if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    let status = 200, body = { data: {}, error: null };
    if (request.method !== 'OPTIONS') {
      if (url.pathname.endsWith('/auth/me')) body.data = { profile: { display_name: 'Synthetic', locale, theme, cover: {} }, roles: ['universal'], avatarOptions: {}, analyticsEnabled: false, isGuest: false, newAccount: false, onboardingComplete: true };
      else if (url.pathname.endsWith('/auth/age-screen')) body.data = { required: false, ageBand: '13_to_17', protectedOrigin: false };
      else if (url.pathname.endsWith('/auth/analytics-preference')) body.data = { canManage: true, enabled: false, disclosed: false };
      else if (url.pathname.endsWith('/tutor/memory-proposals')) {
        if (request.method === 'GET') { reads++; if (reads === 1) { status = 502; body = { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic read failure' } }; } else body.data = { proposals: queue, current }; }
      }
      else if (url.pathname.match(/\/tutor\/memory-proposals\/[0-9a-f-]+\/decision$/)) {
        decisions.push({ id: url.pathname.split('/')[5], body: JSON.parse(request.postData) });
        decisionAttempts++;
        if (decisionAttempts === 1) { status = 502; body = { data: null, error: { code: 'DATA_UNAVAILABLE', message: 'Synthetic decision failure' } }; }
        else {
          const decisionId = url.pathname.split('/')[5];
          const note = queue.find(q => q.id === decisionId);
          const verdict = JSON.parse(request.postData).verdict;
          if (note && verdict === 'approved') current = { ...current, [note.store]: note.proposed };
          queue = queue.filter(q => q.id !== decisionId);
          body.data = { outcome: verdict === 'approved' ? 'written' : 'rejected', applied: verdict === 'approved' };
        }
      }
      else if (url.pathname.endsWith('/profile')) body.data = { displayName: 'Synthetic', username: 'synthetic', locale, birthDate: null, learningStats: { xpPoints: 0, minutesLearned: 0, lessonsCompleted: 0, streakDays: 0, lastActiveDate: null } };
      else if (url.pathname.endsWith('/profile/blocked')) body.data = { users: [] };
      else if (url.pathname.endsWith('/analytics/tracking-decision')) body.data = { excluded: false, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});
async function wait(expression) { for (let i = 0; i < 220; i++) { try { if (await page.evaluate(expression)) return; } catch (e) { if (!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: ' + expression); }
async function waitForRead(previous) { for (let i = 0; i < 220; i++) { if (reads > previous) return; await sleep(100); } throw Error('No fresh proposal read'); }
async function clickSelector(selector) {
  const info = await page.evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return { missing: true }; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(), x=r.x+r.width/2,y=r.y+r.height/2; const top=document.elementFromPoint(x,y); return { missing: false, text: e.textContent.trim(), disabled: e.disabled, occluded: !e.contains(top), x, y }; })()`);
  if (info.missing) throw Error('Missing control: ' + selector);
  if (info.occluded) throw Error('Occluded control: ' + selector + ' text=' + info.text);
  clickLog.push({ selector, text: info.text, disabled: info.disabled });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...{ x: info.x, y: info.y }, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...{ x: info.x, y: info.y }, button: 'left', clickCount: 1 });
}
async function waitForDecisions(min) { for (let i = 0; i < 100; i++) { if (decisionAttempts >= min) return; await sleep(100); } throw Error('Decision never posted; attempts=' + decisionAttempts); }
const RETRY = '.lf-memory-self-review button';
const APPROVE = '.lf-memory-self-review .lf-memory-note:nth-child(1) .lf-memory-note-actions button:nth-child(1)';
const DELETE = '.lf-memory-self-review .lf-memory-note:nth-child(2) .lf-memory-note-actions button:nth-child(2)';
const clickLog = [];
try {
  await warmDevServer(page, origin);
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__clicks=[];document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.lf-memory-self-review');if(b)window.__clicks.push((e.target.textContent||'').trim());},true);" });
  for (locale of ['en-US', 'es-MX', 'pt-BR']) for (theme of ['light', 'dark']) for (const width of [375, 1280]) {
    reads = 0; decisionAttempts = 0; decisions.length = 0;
    queue = [{ id: P1, store: 'learner', proposed: 'I like counting coins', expectedBefore: 'Old note', sessionId: null, createdAt: '2026-09-20T10:00:00.000Z' },
      { id: P2, store: 'pedagogy', proposed: 'I need more time with subtraction', expectedBefore: null, sessionId: null, createdAt: '2026-09-21T10:00:00.000Z' }];
    current = { learner: null, pedagogy: null };
    const session = { accessToken: token, refreshToken: 'synthetic', expiresAt: Date.now() + 3600000, user: { id }, isGuest: false };
    await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
    const beforeNav = reads;
    await page.send('Page.navigate', { url: origin + '/profile/settings' });
    await waitForRead(beforeNav);
    await wait("!!document.querySelector('.lf-memory-self-review [role=alert]')");
    await wait("!!document.querySelector('.lf-memory-self-review button')");
    await clickSelector(RETRY);
    await wait("document.querySelectorAll('.lf-memory-self-review .lf-memory-note').length===2");
    assert.equal(await page.evaluate("!!document.querySelector('.lf-memory-self-review [data-copy-role]')"), true, 'Copy roles must be declared');
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false, 'No horizontal overflow with two notes');
    // Failed approve, then a successful retry. Wait until P1 is FULLY settled
    // (status line present, action buttons gone) plus a grace period, so the
    // deciding guard has definitely cleared before the delete click.
    await clickSelector(APPROVE);
    await wait("!!document.querySelector('.lf-memory-self-review [role=alert]')");
    await clickSelector(APPROVE);
    await waitForDecisions(2);
    await wait("(() => { const rows=[...document.querySelectorAll('.lf-memory-self-review .lf-memory-note')]; return !!rows[0]?.querySelector('[role=status]') && !rows[0]?.querySelector('button'); })()");
    await sleep(250);
    // Delete the second note.
    await clickSelector(DELETE);
    await waitForDecisions(3);
    await wait("(() => { const rows=[...document.querySelectorAll('.lf-memory-self-review .lf-memory-note')]; return rows.length===2 && rows.every(r=>!r.querySelector('button')); })()");
    await page.evaluate("document.querySelector('.lf-memory-self-review').scrollIntoView({block:'center',behavior:'instant'})");
    await page.evaluate('document.fonts.ready');
    await wait("(() => { for(let e=document.querySelector('.lf-memory-self-review');e;e=e.parentElement) if(Number(getComputedStyle(e).opacity)<0.999) return false; return true; })()");
    await page.evaluate(readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf-8'));
    const axe = await page.evaluate("axe.run(document.querySelector('.lf-memory-self-review'))");
    assert.deepEqual(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), []);
    assert.equal(await page.evaluate("document.querySelector('.lf-memory-self-review').dataset.theme"), theme);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(out, `${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
    // Reload must show the server's post-decision state: no pending notes, current kept.
    const beforeReload = reads;
    await page.send('Page.reload', {});
    await waitForRead(beforeReload);
    await wait("document.querySelectorAll('.lf-memory-self-review .lf-memory-note').length===0");
    await wait("!!document.querySelector('.lf-memory-self-review .lf-memory-current') && document.querySelector('.lf-memory-self-review .lf-memory-current').textContent.includes('I like counting coins')");
    assert.equal(decisions.length, 3, 'Exactly three decisions per journey (failed approve, approve, delete)');
    assert.equal(decisions.filter(d => d.body.verdict === 'approved').length, 2);
    assert.equal(decisions.filter(d => d.body.verdict === 'rejected').length, 1);
    evidence.push({ locale, theme, width, failedReadRetainsRetry: true, twoNotesReviewed: true, failedApproveRetriedToKept: true, deleteSettled: true, reloadShowsServerState: true, axeViolations: 0, horizontalOverflow: false });
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  const failureShot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (failureShot) writeFileSync(join(out, 'failure.png'), Buffer.from(failureShot.data, 'base64'));
  evidence.push({ failed: String(error), beforeDelete: typeof beforeDelete !== 'undefined' ? beforeDelete : null, clickLog, decisions, reads, decisionAttempts, requestLog, domClicks: await page.evaluate('window.__clicks').catch(() => null), state: await page.evaluate('document.body?.innerText.slice(0,2000)').catch(() => 'Unavailable') });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify({ provenance: 'Actual Settings route in local Chrome, real pointer input; synthetic Core; not database E2E', evidence, decisions, errors: page.errors }, null, 2));
  await page.send('Browser.close').catch(() => {}); page.ws.close();
}
console.log(JSON.stringify(evidence));
