/* Completion recovery with real pointer events and intercepted synthetic HTTP replies. */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

const out = fileURLToPath(new URL('../../audit-results/', import.meta.url));
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(out, 'completion-profile-'));
const browser = await launchBrowser(profile);
const page = await openPage(browser.browser, { width: 390, height: 844, dark: false });
const origin = process.env.LESSON_LAB_URL ?? 'http://127.0.0.1:5177';
const evidence = [];
const submitted = [];
const lesson = {
  schema_version: 1,
  meta: { slug: 'audit-completion', title: 'Completion recovery', locale: 'en-US', subject: 'money', estimated_minutes: 1, objectives: [], cast: ['dina'] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 0, max_attempts: 2, hearts: null },
  segments: [
    { id: 'story-1', type: 'story_scene', xp: 0, prompt_md: 'A short lesson', payload: { backdrop: 'base', body_md: 'Saving helps you reach your goals.' } },
    { id: 'story-2', type: 'story_scene', xp: 0, prompt_md: 'The second activity', payload: { backdrop: 'base', body_md: 'You reached the second activity.' } },
  ],
};
const completion = { score: 100, passed: true, best_score: 100, xp_earned: 0, xp_delta: 0,
  streak_days: 1, longest_streak: 1, streak_extended: false, first_today: false,
  minutes_learned: 1, lessons_completed: 1, next_lesson_id: null };
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
      '/auth/me': { profile: { display_name: 'Synthetic learner', username: 'audit', locale: 'en-US', theme: 'light', cover: {} }, roles: ['kid'], avatarOptions: {}, analyticsEnabled: false, onboardingComplete: true },
      '/learn/lessons/audit-completion': { lesson: { id: 'audit-completion', slug: 'audit-completion' }, locale: 'en-US', audio: {}, document: lesson },
    };
    let data = map[path];
    if (path === '/learn/lessons/audit-completion/complete' && request.method === 'POST') {
      submitted.push(JSON.parse(request.postData));
      data = submitted.length % 2 === 1 ? null : completion;
    }
    const body = data ? { data, error: null } : { data: null, error: { code: 'INTERNAL', message: 'Injected completion failure' } };
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: data || request.method === 'OPTIONS' ? 200 : 502,
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
const byText = (text) => `[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}))`;
try {
  await warmDevServer(page, origin);
  const session = { accessToken: 'synthetic-audit-token', refreshToken: 'synthetic-refresh', expiresAt: Date.now() + 3600000, user: { id: 'audit-kid' }, isGuest: false };
  await page.evaluate(`localStorage.clear(); localStorage.setItem('lf.session.v1', ${JSON.stringify(JSON.stringify(session))}); localStorage.setItem('i18nextLng','en-US');localStorage.setItem('lf-theme','light')`);
  for (const [width, height, reload] of [[390, 844, false], [1440, 900, false], [390, 844, true]]) {
    await page.evaluate('sessionStorage.clear()');
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Page.navigate', { url: origin + '/learn/lesson/audit-completion' });
    await waitFor(`Boolean(${byText('Start lesson')})`);
    if (await page.evaluate(`Boolean(${byText('Reject optional')})`)) await click(byText('Reject optional'));
    await click(byText('Start lesson'));
    await waitFor(`Boolean(${byText('Continue')})`);
    await click(byText('Continue'));
    await waitFor(`document.body.textContent.includes('You reached the second activity.')`);
    if (reload) {
      await page.send('Page.reload');
      await waitFor(`Boolean(${byText('Continue')})`);
      assert.equal(await page.evaluate(`document.body.textContent.includes('You reached the second activity.')`), true);
      assert.equal(await page.evaluate(`Boolean(${byText('Start lesson')})`), false);
    }
    await click(byText('Continue'));
    await waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('not been confirmed')`);
    assert.equal(await page.evaluate(`Boolean(${byText('Finish')}?.disabled)`), true);
    // Allow the software compositor to paint after a viewport transition.
    await page.send('Page.bringToFront');
    await page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await sleep(750);
    const screenshot = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    if (!reload) writeFileSync(join(out, `completion-retry-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    if (reload) {
      await page.send('Page.reload');
      await waitFor(`Boolean(${byText('Finish')}) && !${byText('Finish')}?.disabled`);
    } else await click(byText('Try again'));
    await waitFor(`!document.querySelector('[role="alert"]') && !document.querySelector('[role="status"]')`);
    assert.equal(await page.evaluate(`Boolean(${byText('Finish')}?.disabled)`), false);
    assert.equal(submitted.length % 2, 0);
    assert.deepEqual(submitted.at(-1), submitted.at(-2));
    evidence.push({ viewport: [width, height], reloadRecovery: reload, errorAnnounced: true, pointerRetry: !reload, identicalRunAndDuration: true, finishBlockedUntilSaved: true, overflow: false });
    await click(byText('Finish'));
    await waitFor(`location.pathname === '/learn'`);
    assert.equal(await page.evaluate(`Object.keys(sessionStorage).some(key => key.startsWith('lf.lesson.checkpoint.v1:'))`), false);
  }
  assert.deepEqual(page.errors, []);
} catch (error) {
  evidence.push({ failed: String(error), state: await page.evaluate('document.body?.innerText?.slice(0, 2000)') });
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'completion-recovery.json'), JSON.stringify({ provenance: 'Local Chrome with intercepted synthetic Core replies; no database or provider', evidence, errors: page.errors }, null, 2));
  const closed = browser.child.exitCode !== null ? Promise.resolve() : new Promise(resolve => browser.child.once('exit', resolve));
  await page.send('Browser.close').catch(() => {});
  await closed;
  page.ws.close();
  await sleep(1000);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log(JSON.stringify(evidence, null, 2));
