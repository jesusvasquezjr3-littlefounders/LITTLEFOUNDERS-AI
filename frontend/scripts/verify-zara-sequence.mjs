import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';
import { installAudit } from './audits/in-page.mjs';
import { copyFindings, proportionFindings, FOLD } from './audits/rules.mjs';
import { trackAuditedAssets, waitForAuditedAssets } from './audits/media.mjs';
const origin=process.env.REBUILD_URL??'http://127.0.0.1:5182',output=resolve(process.env.REPORT_DIR??'../audit-results/zara-sequence');
mkdirSync(output,{recursive:true});
const manifest=JSON.parse(readFileSync(new URL('../src/rebuild/assets/manifest.json',import.meta.url),'utf8'));
const diagnostic=process.argv.includes('--bounded');
const rows=[],browser=await launchBrowser(mkdtempSync(join(output,'chrome-')));
async function until(page,expression,label){const end=Date.now()+15000;while(Date.now()<end){if(await page.evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error(label);}
try{for(const locale of (diagnostic?['en-US']:['en-US','es-MX','pt-BR']))for(const theme of (diagnostic?['light']:['light','dark']))for(const width of (diagnostic?[375]:[375,1280])){
  const row={locale,theme,width,failures:[]};rows.push(row);
  const page=await openPage(browser.browser,{width,height:740,dark:theme==='dark',isolated:true}),tracker=trackAuditedAssets(page,origin);
  try{
    await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await page.send('Page.navigate',{url:origin+'/rebuild.html?'+new URLSearchParams({screen:'mentor-stage',character:'zara',state:'idle',age:'10-12',device:'no-webgl',locale,theme})});
    await waitForAuditedAssets(page);
    assert.equal(await page.evaluate(`document.querySelector('[data-mentor-stage]').dataset.mentorState`),'idle');
    await page.evaluate(`(()=>{const u=new URL(location.href);u.searchParams.set('state','speaking');history.replaceState(null,'',u);dispatchEvent(new PopStateEvent('popstate'));})()`);
    await until(page,`!!document.querySelector('[data-still-sequence]')`,'actual sequence never played');
    row.sequence=await page.evaluate(`document.querySelector('[data-still-sequence]').dataset.stillSequence`);
    const sequence=manifest.find(a=>a.id===row.sequence);assert.ok(sequence&&sequence.character==='zara'&&sequence.poseId==='ambient.idle.happy');
    const capture=async phase=>{const screenshot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,[locale,theme,width,phase+'.png'].join('-')),Buffer.from(screenshot.data,'base64'));};
    await capture('sequence');
    await until(page,`(()=>{const s=document.querySelector('[data-mentor-stage]');return s?.dataset.ready==='true'&&!s.dataset.stillSequence&&s.dataset.stillPose==='ambient.idle.happy'})()`,'sequence never settled on speaking still');
    await waitForAuditedAssets(page);
    row.end=await page.evaluate(`(()=>{const s=document.querySelector('[data-mentor-stage]'),i=s.querySelector('picture img');return{mode:s.dataset.renderMode,pose:s.dataset.stillPose,src:i.currentSrc,complete:i.complete,width:i.naturalWidth}})()`);
    assert.equal(row.end.mode,'still');assert.ok(row.end.complete&&row.end.width>0);
    const still=manifest.find(a=>a.id===sequence.endFrame);assert.ok(still&&new URL(row.end.src).pathname===still.path&&still.sourceModel==='/scenes/zara.glb');
    row.provenance={sequence:sequence.id,endFrame:still.id,sequenceSha256:createHash('sha256').update(readFileSync(new URL('../public'+sequence.path,import.meta.url))).digest('hex'),endSha256:createHash('sha256').update(readFileSync(new URL('../public'+still.path,import.meta.url))).digest('hex')};
    await capture('settled');
    await page.evaluate(`(${installAudit})()`);
    const state={id:'zara-speaking-forced-still',budget:'app',firstView:true,catalogue:false};
    for(const stress of [false,true])for(const spacing of [false,true]){
      await page.evaluate(`window.__lfAudit.spacing(${spacing});window.__lfAudit.stress(${stress})`);
      await waitForAuditedAssets(page);
      row.failures.push(...(await page.evaluate('window.__lfAudit.textFit()')).map(f=>JSON.stringify(['text-fit',stress,spacing,...f])));
    }
    await page.evaluate('window.__lfAudit.stress(false);window.__lfAudit.spacing(false)');
    await waitForAuditedAssets(page);
    const proportion=await page.evaluate('window.__lfAudit.proportion()');
    proportion.board=await page.evaluate('window.__lfAudit.boards()');Object.assign(proportion,await page.evaluate('window.__lfAudit.motion()'));
    row.failures.push(...proportionFindings(proportion,state,width).map(f=>JSON.stringify(['proportion',...f])));
    row.failures.push(...copyFindings(await page.evaluate(`window.__lfAudit.copyBudget(${FOLD})`),state,locale,{firstView:width===375,band:'10-12'}).map(f=>JSON.stringify(['copy-budget',...f])));
    assert.deepEqual(tracker.failures,[]);assert.deepEqual(page.errors,[]);
  }catch(e){row.failures.push(e.message);}finally{await page.close();}
  console.log((row.failures.length?'FAIL ':'PASS ')+[locale,theme,width].join(' ')+' '+row.failures.join('; '));
}}finally{browser.child.kill();}
writeFileSync(join(output,'report.json'),JSON.stringify({expected:diagnostic?1:12,diagnosticOnly:diagnostic,scope:'12 forced-still Zara speaking sequences through actual corrected final pose; no human acceptance claim',rows},null,2));
if(rows.length!==(diagnostic?1:12)||rows.some(r=>r.failures.length))process.exitCode=1;
