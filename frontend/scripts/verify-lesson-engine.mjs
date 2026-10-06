/*
 * Complete current v2 Forge fixture catalogue, through actual LessonDocumentView
 * boards. Real pointer hit-testing, 48px controls, help activation, loaded media
 * and JavaScript/network failures are gated. Fixture preview enters a board
 * directly: this does not claim authenticated grading/completion/resume.
 * --mobile and --light change the viewport; --only TYPE,TYPE is a labelled
 * debugging subset. REBUILD_URL/LESSON_LAB_URL reuse an existing server.
 */
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';
import { click } from './lesson-engine/answer-models.mjs';
import { createHash } from 'node:crypto';
import { installAudit } from './audits/in-page.mjs';
import { copyFindings, proportionFindings } from './audits/rules.mjs';
import { authoredBoardTypes, exerciseAuthoredBoard } from './lesson-engine/authored-board-interactions.mjs';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mobile = args.includes('--mobile'), dark = !args.includes('--light');
const onlyIndex = args.indexOf('--only'), only = onlyIndex < 0 ? null : args[onlyIndex + 1]?.split(',');
if (onlyIndex >= 0 && !only?.length) throw new Error('--only needs a segment type list');
const width = mobile ? 375 : 1280, height = mobile ? 812 : 900;
const corpusIndex = args.indexOf('--course-documents');
if (corpusIndex >= 0 && (!args[corpusIndex + 1] || args[corpusIndex + 1].startsWith('--'))) throw Error('--course-documents needs a compiled documents.json');
const corpusFile = corpusIndex < 0 ? null : resolve(args[corpusIndex + 1]);
const workersIndex = args.indexOf('--workers');
const workers = workersIndex < 0 ? 1 : Number(args[workersIndex + 1]);
if (!Number.isInteger(workers) || workers < 1 || workers > 4 || (workers > 1 && !corpusFile)) throw Error('--workers supports 1–4 isolated authored-course pages; measure machine capacity first');
const choiceInteractions = args.includes('--choice-interactions');
if (choiceInteractions && !corpusFile) throw Error('--choice-interactions requires --course-documents');
const boardInteractions = args.includes('--board-interactions');
if (boardInteractions && (!corpusFile || choiceInteractions)) throw Error('--board-interactions requires --course-documents and cannot combine with --choice-interactions');
const sourceText = readFileSync(corpusFile ?? join(frontend, 'src/rebuild/preview/fixtures/v2FixtureDocuments.generated.json'), 'utf8');
const docs = JSON.parse(sourceText);
const sourceHash = createHash('sha256').update(sourceText).digest('hex');
const all = corpusFile ? docs.flatMap(row => row.document.segments.map((segment, step) => ({ lesson: row.lesson_id, locale: row.locale, age: row.document.age_band, segment, step })))
  : Object.entries(docs).flatMap(([lesson, locales]) => Object.entries(locales).flatMap(([locale, doc]) =>
    doc.segments.map((segment) => ({ lesson, locale, age: doc.age_band, segment }))));
const casesIndex = args.indexOf('--cases');
if (casesIndex >= 0 && (!corpusFile || !args[casesIndex + 1] || args[casesIndex + 1].startsWith('--'))) throw Error('--cases requires --course-documents and a JSON list of {lesson,locale,segment}');
const caseKey = (lesson, locale, segment) => JSON.stringify([lesson, locale, segment]);
const requestedCases = casesIndex < 0 ? null : JSON.parse(readFileSync(resolve(args[casesIndex + 1]), 'utf8'));
if (requestedCases && (!Array.isArray(requestedCases) || !requestedCases.length || requestedCases.some(row => !row || typeof row.lesson !== 'string' || typeof row.locale !== 'string' || typeof row.segment !== 'string'))) throw Error('Invalid or empty --cases list');
const selectedCases = requestedCases ? new Set(requestedCases.map(row => caseKey(row.lesson,row.locale,row.segment))) : null;
if (selectedCases && only) throw Error('Choose --cases or --only; do not silently exclude requested cases');
if (selectedCases && selectedCases.size !== requestedCases.length) throw Error('Duplicate --cases entries');
const availableCases = new Set(all.map(row => caseKey(row.lesson,row.locale,row.segment.id)));
if (selectedCases && [...selectedCases].some(key => !availableCases.has(key))) throw Error('--cases names an unknown authored step');
if (choiceInteractions && selectedCases && all.some(row => selectedCases.has(caseKey(row.lesson,row.locale,row.segment.id)) && row.segment.type !== 'story.branch.v2')) throw Error('--choice-interactions cases must all be story.branch.v2');
if (choiceInteractions && only && only.some(type => type !== 'story.branch.v2')) throw Error('--choice-interactions supports story.branch.v2 only');
if (boardInteractions && selectedCases && all.some(row => selectedCases.has(caseKey(row.lesson,row.locale,row.segment.id)) && (row.segment.grading !== 'server' || !authoredBoardTypes.includes(row.segment.type)))) throw Error('--board-interactions cases must be supported, server-graded boards');
if (boardInteractions && only?.some(type => !authoredBoardTypes.includes(type))) throw Error('--board-interactions --only contains an unsupported type');
const fixtures = all.filter(({ lesson, locale, segment }) => (!choiceInteractions || segment.type === 'story.branch.v2') && (!boardInteractions || segment.grading === 'server' && authoredBoardTypes.includes(segment.type)) && (!only || only.includes(segment.type)) && (!selectedCases || selectedCases.has(caseKey(lesson,locale,segment.id))));
const filtered = !!only || !!selectedCases;
if (!fixtures.length) throw new Error('No current v2 fixtures selected');

async function startServer() {
  const existing = corpusFile ? null : process.env.REBUILD_URL ?? process.env.LESSON_LAB_URL;
  if (existing) return { url: existing.replace(/\/$/, ''), stop() {} };
  const child = spawn(process.execPath, [join(frontend, 'node_modules/vite/bin/vite.js'), ...(corpusFile ? ['--config', 'scripts/course-review/vite.config.ts', '--port', '5198'] : []), '--host', '127.0.0.1'], { cwd: frontend, env: {...process.env, ...(corpusFile ? {COURSE_REVIEW_FILE: corpusFile} : {})}, stdio: ['ignore','pipe','pipe'] });
  try {
    const url = await new Promise((ok, fail) => {
      let output = '';
      const timer = setTimeout(() => fail(Error('Vite did not start: ' + output)), 90000);
      const read = (chunk) => {
        output += String(chunk).replace(/\x1b\[[0-9;]*m/g, '');
        const found = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (found) { clearTimeout(timer); ok(found[0]); }
      };
      child.stdout.on('data', read); child.stderr.on('data', read);
      child.once('error', (error) => { clearTimeout(timer); fail(error); });
      child.once('exit', (code) => { clearTimeout(timer); fail(Error('Vite exited ' + code)); });
    });
    return { url, stop: () => child.kill() };
  } catch (error) { child.kill(); throw error; }
}
async function waitFor(page, expression, label, ms = 30000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (page.closed || page.crashed) throw Error(label + ': browser unavailable');
    if (await page.evaluate(expression)) return;
    await sleep(100);
  }
  throw Error(label + ': readiness deadline exceeded');
}
async function pressSelector(page, selector) {
  const point = await page.evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n||n.disabled)throw Error('Missing or disabled control');n.scrollIntoView({block:'center',behavior:'instant'});const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,t=document.elementFromPoint(x,y);if(!t||!(t===n||n.contains(t)))throw Error('Control occluded');return{x,y};})()`);
  await click(page, point.x, point.y);
}
async function exerciseChoices(page, fixture) {
  const source = docs.find(row => row.lesson_id === fixture.lesson && row.locale === fixture.locale);
  const accepted = source.answer_keys[fixture.segment.id]?.acceptable_choice_ids;
  if (!accepted || accepted.length !== 1) throw Error('Choice journey requires exactly one accepted choice');
  const options = fixture.segment.payload.options;
  const correct = options.findIndex(option => option.id === accepted[0]);
  if (correct < 0) throw Error('Accepted choice missing from the board');
  const observed = [];
  for (const index of [...options.map((_, index) => index).filter(index => index !== correct), correct]) {
    await pressSelector(page, `.lf-story-options button:nth-child(${index + 1})`);
    await waitFor(page, '!document.querySelector(".lf-learning-feedback--review")', 'old feedback cleared');
    await pressSelector(page, '.lf-learning-actions button');
    const verdict = index === correct ? 'met' : 'review';
    await waitFor(page, `!!document.querySelector('.lf-learning-feedback--${verdict}')`, verdict+' feedback');
    const expected = index === correct ? fixture.segment.feedback.met : fixture.segment.feedback.choice_hints?.[options[index].id] ?? fixture.segment.feedback.not_yet;
    const actual = await page.evaluate(`document.querySelector('.lf-learning-feedback--${verdict}').textContent`);
    if (!expected || !actual.includes(expected)) throw Error('Feedback does not match the selected choice');
    observed.push({choice:options[index].id,verdict,feedbackMatched:true,feedbackSource:index === correct ? 'met' : fixture.segment.feedback.choice_hints?.[options[index].id] ? 'choice_hints' : 'not_yet'});
  }
  await pressSelector(page, '.lf-learning-actions button');
  const next = source.document.segments[fixture.step + 1];
  await waitFor(page, next ? `document.querySelector('main.lf-learning [data-copy-role="prompt"]')?.textContent===${JSON.stringify(next.prompt)}` : '!!document.querySelector("main[data-screen=lesson-preview-end]") || !document.querySelector("main.lf-learning")', 'advance after correct answer');
  return {choices:observed,advanced:true};
}
const scan = `(() => {
  const nodes = [...document.querySelectorAll('main.lf-learning button:not([disabled]),main.lf-learning input:not([disabled]),main.lf-learning textarea:not([disabled]),main.lf-learning [role="slider"],main.lf-learning [role="combobox"],main.lf-learning a[href]')];
  const targets = [...new Set(nodes.map(node => node.matches('input[type=radio],input[type=checkbox]') ? node.closest('label') ?? node.labels?.[0] ?? node : node))];
  return targets.flatMap((node) => {
    let r = node.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || getComputedStyle(node).visibility === 'hidden') return [];
    node.scrollIntoView({block:'center',behavior:'instant'}); r = node.getBoundingClientRect();
    const top = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return [{label:(node.getAttribute('aria-label')||node.textContent||node.tagName).trim().slice(0,80),
      reachable:!!top&&(top===node||node.contains(top)),width:r.width,height:r.height}];
  });
})()`;
const rows = [], profile = mkdtempSync(join(tmpdir(), 'lf-v2-lesson-'));
const output=resolve(frontend,corpusFile ? '../audit-results/lesson-engine-authored' : '../audit-results/lesson-engine-v2',width+'-'+(dark?'dark':'light')+(choiceInteractions?'-choice-interactions':boardInteractions?'-board-interactions':'')+(filtered?'-filtered':''));
mkdirSync(output,{recursive:true});
writeFileSync(join(output,'progress.jsonl'),JSON.stringify({sourceHash,workers,expected:fixtures.length,complete:false})+'\n');
let dev, browser, setupError = null;
try {
  dev = await startServer(); browser = await launchBrowser(profile);
  console.log('v2 lesson-engine: ' + fixtures.length + '/' + all.length + ' localized segments, ' + new Set(fixtures.map(f=>f.segment.type)).size + ' types' + (filtered?' FILTERED':''));
  // Keep each localized lesson on one page. A single browser owns all isolated
  // contexts; every fixture still runs the same complete assertions.
  const groups = new Map();
  for (const fixture of fixtures) {
    const key = fixture.lesson+'|'+fixture.locale;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(fixture);
  }
  const queues = Array.from({length:workers}, () => []);
  [...groups.values()].forEach((group,index) => queues[index % workers].push(...group));
  const completed = await Promise.allSettled(queues.map(async queue => {
  let authoredPage, authoredKey;
  try { for (const fixture of queue) {
    const row = {lesson:fixture.lesson,segment:fixture.segment.id,type:fixture.segment.type,locale:fixture.locale,mounted:false,controls:[],helpPressed:false,failures:[]};
    let page, errorOffset = 0, requestOffset = 0;
    try {
      const key = fixture.lesson+'|'+fixture.locale;
      const reuse = corpusFile && authoredPage && authoredKey === key;
      if (corpusFile && !reuse) await authoredPage?.close();
      page = reuse ? authoredPage : await openPage(browser.browser, {width,height,dark,isolated:true});
      if (corpusFile) { authoredPage = page; authoredKey = key; }
      errorOffset = page.errors.length; requestOffset = page.failedRequests.length;
      const query = new URLSearchParams(corpusFile ? {lesson:fixture.lesson,step:String(fixture.step),audit:'1',locale:fixture.locale,theme:dark?'dark':'light'} : {screen:'fixture',seg:fixture.lesson+':'+fixture.segment.id,age:fixture.age,locale:fixture.locale,theme:dark?'dark':'light'});
      if (reuse) {
        // This changes author-preview navigation, never a learner answer or product control.
        await page.evaluate(`(() => { const s=document.querySelector('[data-review-control="step"]'); s.value=${JSON.stringify(String(fixture.step))}; s.dispatchEvent(new Event('change',{bubbles:true})); })()`);
        await waitFor(page,`document.querySelector('[data-review-step]')?.getAttribute('data-review-step')===${JSON.stringify(String(fixture.step))}`,'authored step');
      } else await page.send('Page.navigate',{url:dev.url+(corpusFile ? '/scripts/course-review/index.html?' : '/rebuild.html?')+query});
      await waitFor(page, `(() => { const r=document.querySelector('.lf-rebuild'),m=document.querySelector('main.lf-learning'); return r?.getAttribute('lang')===${JSON.stringify(fixture.locale)} && m?.querySelector('h1') && !['lesson-unavailable','lesson-update','lesson-preview-end'].includes(m.dataset.screen); })()`, fixture.lesson+'/'+fixture.segment.id, rows.length?30000:90000);
      await waitFor(page, `document.querySelector('main.lf-learning [data-copy-role="prompt"]')?.textContent===${JSON.stringify(fixture.segment.prompt)}`, 'requested prompt');
      await waitFor(page, '[...document.querySelectorAll("main.lf-learning img")].every(i=>i.complete&&i.naturalWidth>0)', 'board media');
      await sleep(150); row.mounted=true; row.controls=await page.evaluate(scan);
      if (corpusFile) {
        await page.evaluate(`(${installAudit.toString()})()`);
        await page.evaluate('window.scrollTo(0,0)');
        const measured = await page.evaluate('({fit:window.__lfAudit.textFit(),proportion:window.__lfAudit.proportion(),copy:window.__lfAudit.copyBudget(740)})');
        row.layout = [...measured.fit.map(item => ['text-fit', item]), ...copyFindings(measured.copy,{budget:'app',firstView:true},fixture.locale,{firstView:mobile,band:fixture.age}), ...proportionFindings(measured.proportion,{budget:'app'},width)];
        row.failures.push(...row.layout.map(item => 'Layout: '+JSON.stringify(item)));
      }
      for (const c of row.controls) {
        if (!c.reachable) row.failures.push('Control occluded: '+c.label);
        if (c.width+.5<48||c.height+.5<48) row.failures.push('Target below48px: '+c.label+' ('+c.width.toFixed(1)+' x '+c.height.toFixed(1)+')');
      }
      const help = await page.evaluate(`(() => {const b=document.querySelector('main.lf-learning .lf-segment-help button[aria-expanded="false"]');if(!b)return null;b.scrollIntoView({block:'center',behavior:'instant'});const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,t=document.elementFromPoint(x,y);if(!t||!(t===b||b.contains(t)))throw Error('Help occluded');return{x,y};})()`);
      if(help) {
        await click(page,help.x,help.y);
        await waitFor(page,'!!document.querySelector("main.lf-learning .lf-segment-help [data-copy-role=mentor]")','pointer help');
        row.helpPressed=true;
        for(const c of await page.evaluate(scan))if(!c.reachable)row.failures.push('After help occluded: '+c.label);
        if (choiceInteractions || boardInteractions) await pressSelector(page, '.lf-segment-help [role="note"] button');
      }
      if (choiceInteractions) row.interaction = await exerciseChoices(page, fixture);
      if (boardInteractions) row.interaction = await exerciseAuthoredBoard(page, fixture, docs.find(source => source.lesson_id === fixture.lesson && source.locale === fixture.locale), pressSelector, waitFor);
    } catch(error) {row.failures.push(error.message);}
    finally {
      try { if (!corpusFile) await page?.close(); }
      catch(error) { row.failures.push('Browser cleanup: '+error.message); }
    }
    row.failures.push(...(page?.errors ?? []).slice(errorOffset).map(e=>'JavaScript: '+e),...(page?.failedRequests ?? []).slice(requestOffset).map(e=>'Request: '+e));
    rows.push(row);
    appendFileSync(join(output,'progress.jsonl'),JSON.stringify(row)+'\n');
    console.log((row.failures.length?'FAIL ':'PASS ')+row.lesson+' '+row.type+' '+row.segment+' '+row.locale+' ('+row.controls.length+' controls)'+(row.failures.length?' '+row.failures.join('; '):''));
  } } finally { await authoredPage?.close(); }
  }));
  const rejected = completed.filter(result => result.status === 'rejected');
  if (rejected.length) throw Error(rejected.map(result => String(result.reason)).join('; '));
} catch(error) {setupError=error.message;}
finally {
  browser?.child.kill(); dev?.stop();
  try{rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{/* Preserve the actual result if Chrome holds a Windows profile lock. */}
}
const failed=rows.filter(r=>r.failures.length);
writeFileSync(join(output,'report.json'),JSON.stringify({schemaVersion:2,sourceHash,authored:!!corpusFile,scope:choiceInteractions?'Story choices: every wrong choice, matching feedback, correct answer and advance through local Core grading. Not other board types, authenticated persistence or learner outcomes.':boardInteractions?'Authored ledger, percent, unit-price and chart boards: wrong answer, feedback, correction and advance through local Core. Not ungraded simulations, authenticated persistence or learner outcomes.':'Initial authored screens and control reachability; not full graded journeys or learner outcomes',filtered,width,height,theme:dark?'dark':'light',expected:fixtures.length,measured:rows.length,setupError,fixtures:rows,failures:failed.length},null,2));
if(setupError){console.error('Setup error: '+setupError);process.exitCode=2;}
else if(failed.length||rows.length!==fixtures.length){for(const r of failed)console.error(r.lesson+'/'+r.segment+'/'+r.locale+': '+r.failures.join('; '));process.exitCode=1;}
else console.log('verify:lesson-engine OK: v2 board entry, reachable controls, media and JavaScript; report '+output);
