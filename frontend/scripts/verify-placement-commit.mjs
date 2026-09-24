import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/placement-commit'); mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
let locale = 'en-US', theme = 'light', commits = [], reads = 0;
const evidence = [];
const result = { frontier: 4, startTopicId: null, startLessonId: null, creditedLessonCount: 4, creditedTopicCount: 4, totalTopicCount: 8, method: 'adaptive_quiz', cappedByPrerequisite: false };
await page.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
page.ws.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data); if (message.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = message.params; const url = new URL(request.url);
  try {
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return void await page.send('Fetch.continueRequest', { requestId });
    if (!url.pathname.startsWith('/api/v1/')) return void await page.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
    let status = 200, body = { data: {}, error: null };
    if (request.method !== 'OPTIONS') {
      if (url.pathname.endsWith('/auth/me')) body.data = { profile: { display_name: 'Synthetic', locale, theme, cover: {} }, roles: ['universal'], avatarOptions: {}, analyticsEnabled: false, isGuest: false, newAccount: false, onboardingComplete: true };
      else if (url.pathname.endsWith('/auth/age-screen')) body.data = { required: false, ageBand: '13_to_17', protectedOrigin: false };
      else if (url.pathname.endsWith('/placement/audit/intake')) { reads++; body.data = { ageAlreadyKnown: true, conversationalIntakeAvailable: false }; }
      else if (url.pathname.endsWith('/placement/audit/step')) {
        const input = JSON.parse(request.postData);
        body.data = input.answers.length ? { kind: 'done', result } : { kind: 'ask', probe: { topicId: id, prompt: 'Synthetic authored question', options: ['Synthetic wrong', 'Synthetic right'] }, questionNumber: 1, questionsRemaining: 0, phase: 'confirm' };
      } else if (url.pathname.endsWith('/placement/audit/commit')) {
        commits.push(JSON.parse(request.postData));
        if (commits.length === 1) { status = 502; body = { data: null, error: { code: 'INTERNAL', message: 'Synthetic lost response' } }; }
        else body.data = result;
      } else if (url.pathname.includes('/learn/')) { status = 502; body = { data: null, error: { code: 'INTERNAL', message: 'Destination outside this harness' } }; }
      else if (url.pathname.endsWith('/analytics/tracking-decision')) body.data = { excluded: true, degraded: false };
    }
    await page.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
  } catch (error) { if (!/InterceptionId|closed/i.test(String(error))) page.errors.push(String(error)); }
});
async function wait(expression) { for (let i=0;i<200;i++) { try { if(await page.evaluate(expression)) return; } catch(e) { if(!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: '+expression); }
async function click(text, role='button') {
  const selector = role === 'button' ? 'button' : '[role="radio"]';
  const lookup = `[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)})`;
  await wait(`!!(${lookup}) && !(${lookup}).disabled`);
  const point = await page.evaluate(`(() => { const e=${lookup}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded action'); return {x,y}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button:'left',clickCount:1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button:'left',clickCount:1 });
}
try {
  await warmDevServer(page, origin); await page.send('Page.navigate', { url: origin }); await wait('!!document.body');
  for (locale of ['en-US','es-MX','pt-BR']) for(theme of ['light','dark']) for(const width of [375,1280]) for(const flow of ['quiz','beginning','adjusted']) {
    commits=[]; const before=reads;
    const copy=JSON.parse(readFileSync(resolve(`src/i18n/${locale}/placement.json`),'utf8'));
    const session={accessToken:token,refreshToken:'synthetic',expiresAt:Date.now()+3600000,user:{id},isGuest:false};
    await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
    await page.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    await page.send('Page.navigate',{url:origin+'/learn/audit/placement'});
    for(let i=0;i<200&&reads===before;i++) await sleep(100);
    assert.ok(reads>before);
    let action=copy.welcome.startFromZero;
    if(flow!=='beginning') {
      await click(copy.welcome.cta); await click('Synthetic right','radio');
      await wait(`document.body.innerText.includes(${JSON.stringify(copy.result.titleAhead)})`);
      action=copy.result.cta;
      if(flow==='adjusted') { await click(copy.result.tooHigh); action=copy.result.adjustEarlier; }
    }
    await click(action); await wait(`document.body.innerText.includes(${JSON.stringify(copy.error)})`);
    assert.equal(await page.evaluate('location.pathname'),'/learn/audit/placement');
    const shot=await page.send('Page.captureScreenshot',{format:'png'});
    writeFileSync(join(out,`${locale}-${theme}-${width}-${flow}-retry.png`),Buffer.from(shot.data,'base64'));
    await click(action); await wait("location.pathname==='/learn/audit'");
    assert.equal(commits.length,2); assert.deepEqual(commits[0],commits[1]);
    assert.equal(commits[0].startFromBeginning,flow==='beginning');
    if(flow==='adjusted') assert.equal(commits[0].chosenFrontier,2);
    evidence.push({locale,theme,width,flow,errorRetainsPlacement:true,identicalRetry:true,confirmedNavigation:true});
  }
} catch(error) { evidence.push({failed:String(error),state:await page.evaluate('document.body.innerText.slice(0,1600)').catch(()=>null)}); process.exitCode=1; }
finally { writeFileSync(join(out,'report.json'),JSON.stringify({provenance:'Actual legacy PlacementPage in local Chrome, real pointer; synthetic Core responses. Verifies retries and route handoff, not destination rendering or full-stack E2E.',evidence,errors:page.errors},null,2)); await page.send('Browser.close').catch(()=>{});page.ws.close(); }
console.log(JSON.stringify(evidence));
