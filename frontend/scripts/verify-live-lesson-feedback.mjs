/*
 * Current v2 feedback and authenticated lifecycle in real Chrome: 3 locales x
 * 2 themes x desktop/mobile. The real route and UI use a strict synthetic Core;
 * API authority is independently covered by backend tests. Pointer actions prove
 * start, viewed-step receipt, review/retry, reload recovery, grade, completion,
 * and receipt rendering. No per-answer or unlisted-result celebration is allowed.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';
import { click } from './lesson-engine/answer-models.mjs';
import { installSyntheticCore, sessionStorageScript } from './audits/synthetic-core.mjs';
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = process.env.REBUILD_URL ?? 'http://localhost:5320';
const output = resolve(process.env.REPORT_DIR ?? join(frontend, '../audit-results/live-lesson-feedback-v2'));
const checkPaths = JSON.parse(readFileSync(join(frontend,'src/rebuild/assets/manifest.json'),'utf8')).flatMap(row=>row.names?.check?[row.names.check]:[])[0];
// Bundle the exact authored pilot in Node: compiled audit hosts intentionally
// expose no development /src endpoint. CSS is irrelevant to fixture generation.
const pilotBundle = await build({
  stdin: { contents: "export { decideJustifyPilotDocument } from './src/rebuild/learning/DecisionReasonsBoard.tsx';", resolveDir: frontend, loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false,
  loader: { '.css': 'empty', '.wasm': 'empty' },
});
const { decideJustifyPilotDocument } = await import('data:text/javascript;base64,' + Buffer.from(pilotBundle.outputFiles[0].text).toString('base64'));
const pilotDocuments = Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map(locale => [locale, decideJustifyPilotDocument(locale, '10-12')]));
if (process.argv.includes('--fixtures-only')) {
  assert.equal(Object.keys(pilotDocuments).length, 3);
  for (const document of Object.values(pilotDocuments)) assert.equal(document.segments[0].type, 'reasoning.decide-justify.v2');
  console.log('PASS current-source lifecycle fixtures: 3 locales');
  process.exit(0);
}
const profile = mkdtempSync(join(tmpdir(), 'lf-v2-feedback-'));
const rows = [], unknownRequests = [];
const ok = data => ({ status: 200, body: { data, error: null } });
const refuse = message => ({ status: 409, body: { data: null, error: { code: 'UNSUPPORTED_LESSON', message } } });
async function waitFor(page, expression, label) {
  const end = Date.now() + 45000;
  while (Date.now() < end) { if (await page.evaluate(expression)) return; await sleep(100); }
  throw Error(label + ': deadline exceeded');
}
async function press(page, selector) {
  const point = await page.evaluate(`(() => { const b=${selector}; if(!b || b.disabled) throw Error('Control unavailable'); b.scrollIntoView({block:'center',behavior:'instant'});const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,t=document.elementFromPoint(x,y); if(!t || !(t===b||b.contains(t))) throw Error('Pointer target occluded'); return {x,y}; })()`);
  await click(page, point.x, point.y);
}
const celebration = `!!document.querySelector('.lf-burst,[data-celebrate],.confetti,[class*=confetti],[class*=xp-float],[class*=coin-float]')`;
let runtime;
try {
  runtime = await launchBrowser(profile);
  for (const locale of ['en-US','es-MX','pt-BR']) for (const theme of ['light','dark']) for (const width of [375,1280]) {
    const row = { locale, theme, width, failures: [], requests: [], resumed: false };
    const page = await openPage(runtime.browser, { width, height: 900, dark: theme==='dark', isolated: true });
    let document, viewed = false, met = false, attempted = false, token = 'initial-attempt', starts = 0;
    const runId = '99999999-9999-4999-8999-999999999999';
    await installSyntheticCore(page, origin, { unknownRequests, answerRequest: (_core,path,request) => {
      if (!path.startsWith('/learn/lessons/verify-feedback')) return;
      const body = request.postData ? JSON.parse(request.postData) : {};
      row.requests.push({ path, method: request.method, body });
      if (path === '/learn/lessons/verify-feedback' && request.method==='GET') return ok({ lesson:{id:'verify-feedback',slug:'verify-feedback',course_slug:'money'},locale,document,audio:{} });
      if (path.endsWith('/v2-runs') && request.method==='POST') {
        if (starts && body.run_id!==runId) return refuse('Resume must name the same run');
        starts++; row.resumed = starts>1;
        return ok({run_id:runId,version_id:document.version_id,expires_at:new Date(Date.now()+3600000).toISOString(),resumed:starts>1,
          met_segment_ids:met?['decide-01']:[],attempted_segment_ids:attempted?['decide-01']:[],viewed_segment_ids:viewed?['intro-01']:[],attempt_tokens:{'decide-01':token}});
      }
      if (path.endsWith('/views')) {
        if (body.segment_id!=='intro-01') return refuse('Unknown viewed step');
        viewed=true;return ok({recorded:true});
      }
      if (path.endsWith('/grade')) {
        if (!viewed || body.run_id!==runId || body.attempt_token!==token || body.segment_id!=='decide-01') return refuse('Invalid bound attempt');
        attempted=true;met=body.answer?.choice==='save-first';
        if (!met) token='retry-attempt';
        return ok({verdict:{correct:met,score:met?100:0,judgment:{quality:'sound'}},replayed:false,...(!met?{retry_attempt_token:token}:{})});
      }
      if (path.endsWith('/complete')) {
        if (!viewed || !met || body.run_id!==runId || !Number.isInteger(body.seconds_spent) || !body.local_date) return refuse('Pending learning steps');
        return ok({receipt:{schema_version:2,completion_id:runId,lesson_id:document.lesson_id,version_id:document.version_id,locale,
          first_try_correct:0,graded_count:1,viewed_count:1,awarded_xp:0,duration_seconds:body.seconds_spent,previous_best_percent:0,celebrations:[]}});
      }
      return refuse('Unexpected lesson endpoint');
    }});
    try {
      await page.send('Page.navigate',{url:origin+'/rebuild.html?screen=lesson'});
      await waitFor(page,'!!document.querySelector(".lf-rebuild")','preview warm');
      document = structuredClone(pilotDocuments[locale]);
      document.lesson_id = 'verify-feedback';
      document.required_capabilities.push('visual.speech-plate.v1');
      document.segments.unshift({ id: 'intro-01', type: 'voice.mentor-turn.v2', grading: 'none', prompt: 'Start here', visual: { type: 'speech-plate' }, payload: { role: 'intro', line: 'Choose, then explain.' } });
      page.core={scenario:'lesson-function-machine',locale,theme,fixtures:{}};
      await page.evaluate(sessionStorageScript({guest:false,locale,theme}));
      const url=origin+'/learn/lesson/verify-feedback?lng='+locale;
      await page.send('Page.navigate',{url});
      await waitFor(page,`document.querySelector('main.lf-learning [data-copy-role="prompt"]')?.textContent==='Start here'`,'ungraded intro');
      await press(page,`document.querySelector('main.lf-learning .lf-learning-actions button')`);
      await waitFor(page,`!!document.querySelector('.lf-learning-board .lf-reasoning-options')`,'reasoning step');
      await press(page,`document.querySelectorAll('.lf-learning-board .lf-reasoning-options button')[1]`);
      await press(page,`document.querySelectorAll('.lf-learning-control-strip .lf-reasoning-options button')[0]`);
      await press(page,`document.querySelector('main.lf-learning .lf-learning-actions button')`);
      await waitFor(page,`!!document.querySelector('.lf-learning-feedback--review')`,'review feedback');
      assert.equal(await page.evaluate(celebration),false,'review celebrates');
      await page.send('Page.navigate',{url});
      await waitFor(page,`!!document.querySelector('.lf-learning-board .lf-reasoning-options')`,'recovered pending segment');
      assert.equal(viewed,true); assert.equal(met,false); assert.equal(row.resumed,true);
      await press(page,`document.querySelectorAll('.lf-learning-board .lf-reasoning-options button')[0]`);
      await press(page,`document.querySelectorAll('.lf-learning-control-strip .lf-reasoning-options button')[0]`);
      await press(page,`document.querySelector('main.lf-learning .lf-learning-actions button')`);
      await waitFor(page,`!!document.querySelector('.lf-learning-feedback--met')`,'met feedback');
      assert.equal(await page.evaluate(celebration),false,'ordinary answer celebrates');
      assert.deepEqual(await page.evaluate(`[...document.querySelectorAll('.lf-learning-feedback--met svg path')].map(p=>p.getAttribute('d'))`),checkPaths,'feedback must use the proprietary check glyph');
      await page.send('Page.navigate',{url});
      await waitFor(page,`!!document.querySelector('[data-screen="lesson-preview-end"]')`,'recovered completed segments');
      await press(page,`document.querySelector('main.lf-learning button')`);
      await waitFor(page,`!!document.querySelector('[data-screen="result"]')`,'Core receipt result');
      assert.equal(await page.evaluate(celebration),false,'result without listed milestone celebrates');
      assert.equal(row.requests.filter(r=>r.path.endsWith('/views')).length,1,'view repeated after reload');
      assert.equal(row.requests.filter(r=>r.path.endsWith('/grade')).length,2,'grade duplicated on recovery');
      assert.equal(row.requests.filter(r=>r.path.endsWith('/complete')).length,1,'completion duplicated');
      assert.equal(row.requests.filter(r=>r.path.endsWith('/v2-runs')).length,3,'both reloads must recover the stored run');
      row.failures.push(...page.errors,...page.failedRequests.map(r=>'Request: '+r));
    } catch(error) {row.failures.push(error.message);}
    rows.push(row);console.log((row.failures.length?'FAIL ':'PASS ')+locale+' '+theme+' '+width+': '+row.failures.join('; '));
    await page.close();
  }
} finally { if(runtime) runtime.child.kill(); try { rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}); } catch { /* Preserve findings when Chrome briefly holds its Windows profile lock. */ } }
mkdirSync(output,{recursive:true});
writeFileSync(join(output,'report.json'),JSON.stringify({scope:'Current v2 UI lifecycle with synthetic Core; actual API authority covered by backend tests',rows,unknownRequests},null,2));
if(rows.length!==12||rows.some(r=>r.failures.length)||unknownRequests.length)process.exitCode=1;
