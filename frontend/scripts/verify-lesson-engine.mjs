/*
 * Complete current v2 Forge fixture catalogue, through actual LessonDocumentView
 * boards. Real pointer hit-testing, 48px controls, help activation, loaded media
 * and JavaScript/network failures are gated. Fixture preview enters a board
 * directly: this does not claim authenticated grading/completion/resume.
 * --mobile and --light change the viewport; --only TYPE,TYPE is a labelled
 * debugging subset. REBUILD_URL/LESSON_LAB_URL reuse an existing server.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';
import { click } from './lesson-engine/answer-models.mjs';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mobile = args.includes('--mobile'), dark = !args.includes('--light');
const onlyIndex = args.indexOf('--only'), only = onlyIndex < 0 ? null : args[onlyIndex + 1]?.split(',');
if (onlyIndex >= 0 && !only?.length) throw new Error('--only needs a segment type list');
const width = mobile ? 375 : 1280, height = mobile ? 812 : 900;
const docs = JSON.parse(readFileSync(join(frontend, 'src/rebuild/preview/fixtures/v2FixtureDocuments.generated.json'), 'utf8'));
const all = Object.entries(docs).flatMap(([lesson, locales]) => Object.entries(locales).flatMap(([locale, doc]) =>
  doc.segments.map((segment) => ({ lesson, locale, age: doc.age_band, segment }))));
const fixtures = all.filter(({ segment }) => !only || only.includes(segment.type));
if (!fixtures.length) throw new Error('No current v2 fixtures selected');

async function startServer() {
  const existing = process.env.REBUILD_URL ?? process.env.LESSON_LAB_URL;
  if (existing) return { url: existing.replace(/\/$/, ''), stop() {} };
  const child = spawn(process.execPath, [join(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'], { cwd: frontend, stdio: ['ignore','pipe','pipe'] });
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
let dev, browser, setupError = null;
try {
  dev = await startServer(); browser = await launchBrowser(profile);
  const page = await openPage(browser.browser, {width,height,dark,isolated:true});
  console.log('v2 lesson-engine: ' + fixtures.length + '/' + all.length + ' localized segments, ' + new Set(fixtures.map(f=>f.segment.type)).size + ' types' + (only?' FILTERED':''));
  for (const fixture of fixtures) {
    const row = {lesson:fixture.lesson,segment:fixture.segment.id,type:fixture.segment.type,locale:fixture.locale,mounted:false,controls:[],helpPressed:false,failures:[]};
    const errors = page.errors.length, requests = page.failedRequests.length;
    try {
      const query = new URLSearchParams({screen:'fixture',seg:fixture.lesson+':'+fixture.segment.id,age:fixture.age,locale:fixture.locale,theme:dark?'dark':'light'});
      await page.send('Page.navigate',{url:dev.url+'/rebuild.html?'+query});
      await waitFor(page, `(() => { const r=document.querySelector('.lf-rebuild'),m=document.querySelector('main.lf-learning'); return r?.getAttribute('lang')===${JSON.stringify(fixture.locale)} && m?.querySelector('h1') && !['lesson-unavailable','lesson-update','lesson-preview-end'].includes(m.dataset.screen); })()`, fixture.lesson+'/'+fixture.segment.id, rows.length?30000:90000);
      await waitFor(page, `document.querySelector('main.lf-learning [data-copy-role="prompt"]')?.textContent===${JSON.stringify(fixture.segment.prompt)}`, 'requested prompt');
      await waitFor(page, '[...document.querySelectorAll("main.lf-learning img")].every(i=>i.complete&&i.naturalWidth>0)', 'board media');
      await sleep(150); row.mounted=true; row.controls=await page.evaluate(scan);
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
      }
    } catch(error) {row.failures.push(error.message);}
    row.failures.push(...page.errors.slice(errors).map(e=>'JavaScript: '+e),...page.failedRequests.slice(requests).map(e=>'Request: '+e));
    rows.push(row); console.log((row.failures.length?'FAIL ':'PASS ')+row.type+' '+row.segment+' '+row.locale+' ('+row.controls.length+' controls)'+(row.failures.length?' '+row.failures.join('; '):''));
    if(page.closed||page.crashed)break;
  }
  await page.close();
} catch(error) {setupError=error.message;}
finally {
  browser?.child.kill(); dev?.stop();
  try{rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}catch{/* Preserve the actual result if Chrome holds a Windows profile lock. */}
}
const output=resolve(frontend,'../audit-results/lesson-engine-v2',width+'-'+(dark?'dark':'light')+(only?'-filtered':''));
mkdirSync(output,{recursive:true});
const failed=rows.filter(r=>r.failures.length);
writeFileSync(join(output,'report.json'),JSON.stringify({schemaVersion:2,filtered:!!only,width,height,theme:dark?'dark':'light',expected:fixtures.length,measured:rows.length,setupError,fixtures:rows,failures:failed.length},null,2));
if(setupError){console.error('Setup error: '+setupError);process.exitCode=2;}
else if(failed.length||rows.length!==fixtures.length){for(const r of failed)console.error(r.lesson+'/'+r.segment+'/'+r.locale+': '+r.failures.join('; '));process.exitCode=1;}
else console.log('verify:lesson-engine OK: v2 board entry, reachable controls, media and JavaScript; report '+output);
