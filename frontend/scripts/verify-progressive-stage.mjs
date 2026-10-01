import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';
import { trackAuditedAssets, waitForAuditedAssets } from './audits/media.mjs';
import { installAudit } from './audits/in-page.mjs';
import { copyFindings, proportionFindings, FOLD } from './audits/rules.mjs';
import { STATES } from './audits/states.mjs';

// Separate transient-state proof: actual approved paint precedes deliberately held
// real-model transport. Both transient and live phases retain the standard audits.
const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5182';
const output = resolve(process.env.REPORT_DIR ?? '../audit-results/progressive-stage');
const closure = STATES.filter(s => s.id.startsWith('app:/learn/lesson@') || s.id.startsWith('mentor-stage@') || s.query?.screen === 'lesson' || /lesson-v2-preview|mentor-screen|lesson-/.test(s.id));
if (process.argv.includes('--list')) { console.log(JSON.stringify(closure.map(s=>s.id),null,2)); process.exit(0); }
mkdirSync(output,{recursive:true});
const browser = await launchBrowser(mkdtempSync(join(output,'chrome-'))), rows=[];
const manifest = JSON.parse(readFileSync(new URL('../src/rebuild/assets/manifest.json',import.meta.url),'utf8'));
const pick=(name,values)=>{const selected=process.env[name]?.split(',')??values;assert.ok(selected.length&&selected.every(v=>values.includes(v)),name+' invalid diagnostic filter');return selected;};
const characters=pick('PROGRESSIVE_CHARACTERS',['rho','zara','liruf','dina']),locales=pick('PROGRESSIVE_LOCALES',['en-US','es-MX','pt-BR']),themes=pick('PROGRESSIVE_THEMES',['light','dark']),widths=pick('PROGRESSIVE_WIDTHS',['320','375','768','1280']).map(Number);
const expected=characters.length*locales.length*themes.length*widths.length;
const pause = ms => new Promise(r=>setTimeout(r,ms));
async function until(page, predicate, label) {
  const end=Date.now()+30000;
  while(Date.now()<end) { if(await predicate()) return; await pause(50); }
  throw Error('Deadline: '+label);
}
try {
  for(const character of characters) for(const locale of locales) for(const theme of themes) for(const width of widths) {
    const row={character,locale,theme,width,findings:[],initial:null,live:null}; rows.push(row);
    const page=await openPage(browser.browser,{width,height:FOLD,dark:theme==='dark',isolated:true});
    const tracker=trackAuditedAssets(page,origin), held=new Set(); let holding=true;
    const state={id:'progressive-'+character,budget:'app',firstView:true,catalogue:false};
    try {
      page.ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.sessionId===page.sessionId&&m.method==='Fetch.requestPaused') {
        if(holding) held.add(m.params.requestId); else page.send('Fetch.continueRequest',{requestId:m.params.requestId}).catch(e=>row.findings.push(['transport-release',e.message]));
      }});
      await page.send('Fetch.enable',{patterns:[{urlPattern:origin+'/scenes/*.glb'}]});
      await page.send('Page.navigate',{url:origin+'/rebuild.html?'+new URLSearchParams({screen:'mentor-stage',character,state:'idle',age:'10-12',locale,theme})});
      const read=()=>page.evaluate(`(()=>{
        const s=document.querySelector('[data-mentor-stage]'),i=s?.querySelector('picture img');if(!s)return null;
        const r=s.getBoundingClientRect(),ir=i?.getBoundingClientRect(),x=ir?ir.x+ir.width/2:0,y=ir?ir.y+ir.height/2:0;
        const effective=e=>{let opacity=1;while(e){const c=getComputedStyle(e);if(c.display==='none'||c.visibility!=='visible')return 0;opacity*=Number(c.opacity);e=e.parentElement;}return opacity;};
        let visible=!!i&&ir.width>0&&ir.height>0&&effective(i)===1&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight;
        if(visible){const layers=document.elementsFromPoint(x,y),index=layers.indexOf(i);visible=index>=0&&layers.slice(0,index).every(e=>e.contains(i)||effective(e)===0);}
        return{ready:s.dataset.ready,visual:s.dataset.visualReady,first:Number(s.dataset.firstRenderMs),live:s.dataset.liveReadyMs?Number(s.dataset.liveReadyMs):null,pose:s.dataset.mentorPose,stillPose:s.dataset.stillPose,src:i?.currentSrc,complete:i?.complete,width:i?.naturalWidth,visible,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
      })()`);
      await until(page,async()=>{row.initial=await read();return row.initial?.visual==='true'&&row.initial.complete&&row.initial.width>0&&held.size>0;},'painted still and held real GLB');
      await until(page,async()=>[...tracker.pending.values()].every(url=>new URL(url).pathname.startsWith('/scenes/')&&new URL(url).pathname.endsWith('.glb')), 'all non-held asset transport');
      await page.evaluate('document.fonts.ready');
      row.paintLayers=await page.evaluate(`(()=>{const s=document.querySelector('[data-mentor-stage]'),i=s.querySelector('picture img'),r=i.getBoundingClientRect();const chain=e=>{const a=[];while(e){const c=getComputedStyle(e);a.push({tag:e.tagName,class:e.className,opacity:c.opacity,display:c.display,visibility:c.visibility,overflow:c.overflow,rect:e.getBoundingClientRect().toJSON()});e=e.parentElement;}return a;};return{image:chain(i),top:chain(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};})()`);
      const shot=await page.send('Page.captureScreenshot',{format:'png'});
      row.initialScreenshot=[character,locale,theme,width,'initial.png'].join('-');
      writeFileSync(join(output,row.initialScreenshot),Buffer.from(shot.data,'base64'));
      assert.equal(row.initial.ready,'false'); assert.equal(row.initial.pose,row.initial.stillPose); assert.equal(row.initial.visible,true);
      const approved=manifest.find(asset=>asset.path===new URL(row.initial.src).pathname);
      assert.ok(approved&&approved.class==='B'&&approved.type==='render'&&approved.character===character&&approved.poseId===row.initial.pose&&approved.sourceModel===`/scenes/${character}.glb`&&approved.reviewStatus!=='retired','registered real-model same-pose still');
      row.sourceProvenance={id:approved.id,path:approved.path,sourceModel:approved.sourceModel,poseId:approved.poseId,generatedBy:approved.generatedBy,reviewFamily:approved.reviewFamily,sha256:createHash('sha256').update(readFileSync(new URL('../public'+approved.path,import.meta.url))).digest('hex')};
      assert.ok(row.initial.first>=0&&row.initial.first<2500,'unchanged first visual budget');
      await page.evaluate(`(${installAudit})()`);
      async function audit(phase) {
        for(const stress of [false,true])for(const spacing of [false,true]) {
          await page.evaluate(`window.__lfAudit.spacing(${spacing});window.__lfAudit.stress(${stress})`);
          await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
          row.findings.push(...(await page.evaluate('window.__lfAudit.textFit()')).map(f=>[phase,'text-fit',stress,spacing,...f]));
        }
        await page.evaluate('window.__lfAudit.stress(false);window.__lfAudit.spacing(false)');
        const proportion=await page.evaluate('window.__lfAudit.proportion()');
        proportion.board=await page.evaluate('window.__lfAudit.boards()');Object.assign(proportion,await page.evaluate('window.__lfAudit.motion()'));
        row.findings.push(...proportionFindings(proportion,state,width).map(f=>[phase,'proportion',...f]));
        row.findings.push(...copyFindings(await page.evaluate(`window.__lfAudit.copyBudget(${FOLD})`),state,locale,{firstView:width===375,band:'10-12'}).map(f=>[phase,'copy-budget',...f]));
      }
      await audit('initial-approved-still');
      holding=false; for(const requestId of held)await page.send('Fetch.continueRequest',{requestId}); held.clear();
      await waitForAuditedAssets(page,{timeoutMs:30000,label:'released live stage'});
      row.live=await read();assert.equal(row.live.ready,'true');assert.ok(row.live.live>=row.initial.first,'live timing is separate');
      assert.deepEqual(row.live.rect,row.initial.rect,'progressive stage geometry');
      await audit('settled-live');
      assert.deepEqual(tracker.failures,[]);assert.deepEqual(page.errors,[]);
    } catch(e) { row.findings.push(['proof',e.message]); }
    finally { holding=false;for(const requestId of held)await page.send('Fetch.continueRequest',{requestId}).catch(()=>{});await page.close(); }
    console.log((row.findings.length?'FAIL ':'PASS ')+[character,locale,theme,width].join(' ')+(row.findings.length?' '+JSON.stringify(row.findings):''));
  }
} finally { browser.child.kill(); }
writeFileSync(join(output,'report.json'),JSON.stringify({expected,diagnosticOnly:expected!==96,scope:'96 cold progressive contexts, initial and live standard audits; settled catalogue closure separately required',closure:closure.map(s=>s.id),rows},null,2));
if(rows.length!==expected||rows.some(r=>r.findings.length))process.exitCode=1;
