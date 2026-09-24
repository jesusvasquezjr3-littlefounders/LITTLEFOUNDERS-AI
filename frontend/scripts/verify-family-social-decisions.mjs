import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/family-social-decisions'); mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
let locale='en-US',theme='light',reads=0,writes=0,queue=[],graphReads=0,historyReads=0;
const evidence=[];
const kid='33333333-3333-4333-8333-333333333333';
const queued=(requestId,requesterName)=>({requestId,requesterName,requesterId:'private-identifier',status:'pending',requestedAt:'2026-09-21T00:00:00Z'});
await page.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
page.ws.addEventListener('message',async({data})=>{
 const message=JSON.parse(data);if(message.method!=='Fetch.requestPaused')return;
 const {requestId,request}=message.params;const url=new URL(request.url);
 try{
  if(url.origin===origin&&!url.pathname.startsWith('/api/'))return void await page.send('Fetch.continueRequest',{requestId});
  if(!url.pathname.startsWith('/api/v1/'))return void await page.send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});
  let status=200,body={data:{},error:null};
  if(request.method!=='OPTIONS'){
   if(url.pathname.endsWith('/auth/me'))body.data={profile:{display_name:'Synthetic',locale,theme,cover:{}},roles:['parent'],avatarOptions:{},analyticsEnabled:false,isGuest:false,newAccount:false,onboardingComplete:true};
   else if(url.pathname.endsWith('/auth/age-screen'))body.data={required:false,ageBand:'adult',protectedOrigin:false};
   else if(url.pathname.endsWith('/family/kids'))body.data={kids:[{userId:kid,displayName:'Synthetic child',username:'synthetic',analyticsConsent:false,pendingApprovalCount:0,walletTotal:0,taskStreakDays:0}]};
   else if(url.pathname.endsWith('/social/requests')){reads++;body.data={requests:queue,nextOffset:null};}
   else if(url.pathname.endsWith('/decision')){
    writes++;const choice=JSON.parse(request.postData).decision;const selected=url.pathname.split('/').at(-2);
    await sleep(250);
    if(writes===1){status=502;body={data:null,error:{code:'DATA_UNAVAILABLE',message:'Synthetic failure'}};}
    else if(writes===4){queue=[];status=409;body={data:null,error:{code:'SOCIAL_DECISION_CONFLICT',message:'Another guardian decided'}};}
    else {queue=queue.filter(item=>item.requestId!==selected);body.data={requestId:selected,status:choice==='approve'?'approved':'denied'};}
   }
   else if(url.pathname.endsWith('/social')){graphReads++;body.data={users:writes>=2?[{userId:id,displayName:'New graph member',username:null}]:[],nextOffset:null};}
   else if(url.pathname.endsWith('/social/audit')){historyReads++;body.data={entries:writes>=2?[{id:1,action:'social.follow',sourceName:'New history member',targetName:'Child',createdAt:'2026-09-21T00:00:00Z'}]:[],nextOffset:null};}
   else if(url.pathname.endsWith('/analytics/tracking-decision'))body.data={excluded:true,degraded:false};

  }
  await page.send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Headers',value:'authorization,content-type'},{name:'Access-Control-Allow-Methods',value:'GET,POST,OPTIONS'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 }catch(error){if(!/InterceptionId|closed/i.test(String(error)))page.errors.push(String(error));}
});
async function wait(expression) { for (let i=0;i<200;i++) { try { if(await page.evaluate(expression)) return; } catch(e) { if(!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: '+expression); }
async function click(text, role='button') {
  const selector = role === 'button' ? 'button' : '[role="switch"]';
  const lookup = `[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.getAttribute('aria-label')===${JSON.stringify(text)}||e.textContent.trim().endsWith(${JSON.stringify(text)})))`;
  await wait(`!!(${lookup}) && !(${lookup}).disabled`);
  const point = await page.evaluate(`(() => { const e=${lookup}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded action'); return {x,y}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button:'left',clickCount:1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button:'left',clickCount:1 });
}
try{
 await warmDevServer(page,origin);await page.send('Page.navigate',{url:origin});await wait('!!document.body');
 for(locale of ['en-US','es-MX','pt-BR'])for(theme of ['light','dark'])for(const width of [375,1280]){
  writes=0;graphReads=0;historyReads=0;queue=[queued('first','First requester'),queued('second','Second requester'),queued('third','Third requester')];const before=reads;
  const copy=JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild.json`),'utf8')).socialRequests;
  const session={accessToken:token,refreshToken:'synthetic',expiresAt:Date.now()+3600000,user:{id},isGuest:false};
  await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
  await page.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
  const previousDocument=await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate',{url:origin+'/family'});
  await wait(`performance.timeOrigin !== ${previousDocument}`);
  await wait(`document.querySelector('[data-social-audit=requests]')?.dataset.theme === ${JSON.stringify(theme)} && document.querySelector('[data-social-audit=requests]')?.lang === ${JSON.stringify(locale)}`);
  await page.evaluate('document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
  assert.equal(reads,before,'Closed panel fetched the social graph');
  const allCopy=JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild.json`),'utf8'));
  await click(allCopy.socialGraph.title);await click(allCopy.socialHistory.title);
  await wait(`!!document.querySelector('[data-social-audit=history] ul')`);
  await click(copy.title);await wait(`document.querySelectorAll('[data-social-audit=requests] li').length === 3`);
  await page.evaluate('Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations)).map(a => a.finished.catch(() => {}))).then(() => document.fonts.ready)');
  const geometry=await page.evaluate(`(() => {const e=document.querySelector('[data-social-audit=requests]');return {scroll:e.scrollWidth,client:e.clientWidth};})()`);
  assert.ok(geometry.scroll<=geometry.client+1,'Panel overflows');
  await page.evaluate(readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8'));
  const axe=await page.evaluate("axe.run(document.querySelector('[data-social-audit=requests]'))");assert.deepEqual(axe.violations,[]);
  await click(copy.approve);
  await wait(`!!document.querySelector('[data-social-audit=requests] [role=alert]')`);
  assert.equal(await page.evaluate('document.activeElement.textContent.trim()'),copy.approve);
  assert.equal(await page.evaluate(`document.querySelectorAll('[data-social-audit=requests] li').length`),3);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(`document.querySelectorAll('[data-social-audit=requests] li').length === 2 && document.querySelector('[data-social-audit=requests]').innerText.includes(${JSON.stringify(copy.approved)})`);
  await wait(`document.querySelector('.lf-social-graph:not([data-social-audit=history]):not([data-social-audit=requests])').innerText.includes('New graph member') && document.querySelector('[data-social-audit=history]').innerText.includes('New history member')`);
  assert.equal(graphReads,2);assert.equal(historyReads,2);
  await click(copy.deny);
  await wait(`document.querySelectorAll('[data-social-audit=requests] li').length === 1 && document.querySelector('[data-social-audit=requests]').innerText.includes(${JSON.stringify(copy.denied)})`);
  const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,`${locale}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
  await click(copy.approve);
  await wait(`document.querySelectorAll('[data-social-audit=requests] li').length === 0 && document.querySelector('[data-social-audit=requests]').innerText.includes(${JSON.stringify(copy.empty)})`);
  assert.equal(await page.evaluate(`document.querySelector('[data-social-audit=requests] [role=alert]').textContent.trim()`),copy.conflict);
  assert.equal(writes,4);
  await wait(`!document.querySelector('[data-social-audit=history] [role=status]')`);
  assert.equal(graphReads,4);assert.equal(historyReads,4);
  evidence.push({locale,theme,width,approvalRetry:true,keyboardRetry:true,denial:true,conflictRefresh:true,openGraphAndHistoryRefresh:true,axeViolations:0,geometry});

 }

 assert.deepEqual(page.errors,[]);
}catch(error){const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'failure.png'),Buffer.from(shot.data,'base64'));evidence.push({failed:String(error),state:await page.evaluate('document.body.innerText.slice(0,2200)').catch(()=>null)});process.exitCode=1;}
finally{writeFileSync(join(out,'report.json'),JSON.stringify({provenance:'Actual Family route in local Chrome with real pointer; synthetic Core. API/SQL evidence is separate; not full-stack E2E.',evidence,errors:page.errors},null,2));await page.send('Browser.close').catch(()=>{});page.ws.close();}
console.log(JSON.stringify(evidence));
