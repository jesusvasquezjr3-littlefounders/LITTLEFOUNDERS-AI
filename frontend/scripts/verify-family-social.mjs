import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/family-social'); mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
// The Family page renders the requests and history panels with the same class; the graph is the one without an audit hook.
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
let locale='en-US',theme='light',reads=0,failedPage=false,ends=0,reports=0;
const evidence=[];
const kid='33333333-3333-4333-8333-333333333333';
const member=(name)=>({userId:name,displayName:name,username:name.toLowerCase(),avatarOptions:{},isTutor:false});
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
   else if(url.pathname.endsWith('/social')){
    reads++;
    // GAP-FIX-R4: a parent-created child, so the Tutor's end action renders on every row (canEnd), next to report.
    if(url.searchParams.get('direction')==='following')body.data={users:[member('Following connection')],nextOffset:null,canEnd:true};
    else if(url.searchParams.get('offset')==='60'&&!failedPage){failedPage=true;status=502;body={data:null,error:{code:'DATA_UNAVAILABLE',message:'Synthetic failure'}};}
    else if(url.searchParams.get('offset')==='60')body.data={users:[member('Last connection')],nextOffset:null,canEnd:true};
    else body.data={users:[member('First connection')],nextOffset:60,canEnd:true};
   }
   else if(request.method==='DELETE'&&/\/family\/kids\/[^/]+\/social\/connections\/[^/]+$/.test(url.pathname)){ends++;body.data={ended:true,removed:2};}
   else if(request.method==='POST'&&/\/social\/connections\/[^/]+\/report$/.test(url.pathname)){reports++;body.data={reported:true,reportId:'99999999-9999-4999-8999-999999999995'};}
   else if(url.pathname.endsWith('/analytics/tracking-decision'))body.data={excluded:true,degraded:false};

  }
  await page.send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Headers',value:'authorization,content-type'},{name:'Access-Control-Allow-Methods',value:'GET,POST,DELETE,OPTIONS'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 }catch(error){if(!/InterceptionId|closed/i.test(String(error)))page.errors.push(String(error));}
});
async function wait(expression) { for (let i=0;i<200;i++) { try { if(await page.evaluate(expression)) return; } catch(e) { if(!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: '+expression); }
/** Press the button whose text ends with `text` inside `scope` (a dialog, a panel), with a real pointer. */
async function clickIn(scope, text) {
  const lookup = `[...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find(e=>e.textContent.trim().endsWith(${JSON.stringify(text)}))`;
  await wait(`!!(${lookup}) && !(${lookup}).disabled`);
  const point = await page.evaluate(`(() => { const e=${lookup}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded action'); return {x,y}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button:'left',clickCount:1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button:'left',clickCount:1 });
}
async function click(text, role='button') {
  // A direction is a segment of the shared SegmentedControl (a labelled native radio), pressed on its label.
  const selector = role === 'button' ? 'button' : role === 'radio' ? '.lf-segmented-option' : '[role="switch"]';
  const lookup = `[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.getAttribute('aria-label')===${JSON.stringify(text)}||e.textContent.trim().endsWith(${JSON.stringify(text)})))`;
  await wait(`!!(${lookup}) && !(${lookup}).disabled`);
  const point = await page.evaluate(`(() => { const e=${lookup}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded action'); return {x,y}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button:'left',clickCount:1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button:'left',clickCount:1 });
}
try{
 await warmDevServer(page,origin);await page.send('Page.navigate',{url:origin});await wait('!!document.body');
 for(locale of ['en-US','es-MX','pt-BR'])for(theme of ['light','dark'])for(const width of [375,1280]){
  failedPage=false;const before=reads;
  const familyCopy=JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-family.json`),'utf8'));
  const copy=familyCopy.socialGraph,actions=familyCopy.socialConnectionActions;
  const reportCopy=JSON.parse(readFileSync(resolve(`src/i18n/${locale}/rebuild-profile.json`),'utf8')).report;
  const endsBefore=ends,reportsBefore=reports;
  // Other Family panels carry their own "Try again" and "Show more": every press below is scoped to the graph panel.
  const graph='.lf-social-graph:not([data-social-audit])';
  const session={accessToken:token,refreshToken:'synthetic',expiresAt:Date.now()+3600000,user:{id},isGuest:false};
  await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
  await page.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
  const previousDocument=await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate',{url:origin+'/family'});
  await wait(`performance.timeOrigin !== ${previousDocument}`);
  await wait(`document.querySelector('.lf-social-graph:not([data-social-audit])')?.dataset.theme === ${JSON.stringify(theme)} && document.querySelector('.lf-social-graph:not([data-social-audit])')?.lang === ${JSON.stringify(locale)}`);
  await page.evaluate('document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
  assert.equal(reads,before,'Closed panel fetched the social graph');
  await click(copy.title);await wait(`document.querySelector('.lf-social-graph:not([data-social-audit])').innerText.includes('First connection')`);
  await clickIn(graph, copy.more);await wait(`!!document.querySelector('.lf-social-graph:not([data-social-audit]) [role=alert]')`);
  assert.equal(await page.evaluate(`document.querySelector('.lf-social-graph:not([data-social-audit])').innerText.includes('First connection')`),false);
  await clickIn(graph, copy.retry);await wait(`document.querySelector('.lf-social-graph:not([data-social-audit])').innerText.includes('First connection')`);
  await clickIn(graph, copy.more);await wait(`document.querySelector('.lf-social-graph:not([data-social-audit])').innerText.includes('Last connection')`);
  const geometry=await page.evaluate(`(() => {const e=document.querySelector('.lf-social-graph:not([data-social-audit])');const r=e.getBoundingClientRect();return {width:r.width,scroll:e.scrollWidth,client:e.clientWidth,theme:e.dataset.theme,lang:e.lang};})()`);
  assert.ok(geometry.scroll<=geometry.client+1,'Panel overflows');assert.equal(geometry.theme,theme);assert.equal(geometry.lang,locale);
  await page.evaluate(readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8'));
  const axe=await page.evaluate("axe.run(document.querySelector('.lf-social-graph:not([data-social-audit])'))");
  assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),[]);
  const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,`${locale}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
  await click(copy.following,'radio');await wait(`document.querySelector('.lf-social-graph:not([data-social-audit])').innerText.includes('Following connection')`);
  assert.equal(await page.evaluate(`document.querySelector('.lf-social-graph:not([data-social-audit])').innerText.includes('First connection')`),false);
  await click(copy.close);assert.equal(await page.evaluate(`!!document.querySelector('.lf-social-graph:not([data-social-audit]) ul')`),false);
  assert.equal(await page.evaluate(`document.activeElement.textContent.trim()`),copy.title);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(`document.querySelector('.lf-social-graph:not([data-social-audit])').innerText.includes('Following connection')`);
  // GAP-FIX-R4 (E.1/E.3/E.13): the Tutor's row actions. End asks first and names the consequence; confirming sends one DELETE and says so.
  await clickIn(`${graph} [data-social-actions]`, actions.endAction);
  await wait(`[...document.querySelectorAll('[aria-modal="true"]')].some(d=>d.innerText.includes(${JSON.stringify(actions.endConsequence)}))`);
  assert.equal(ends,endsBefore,'Ending sent before the confirmation');
  await clickIn('[aria-modal="true"]', actions.endConfirm);
  await wait(`document.querySelector(${JSON.stringify(graph)}).innerText.includes(${JSON.stringify(actions.ended)})`);
  assert.equal(ends,endsBefore+1,'Confirming did not send exactly one end');
  // Report opens the bounded dialog (who reads it, the reasons); cancelling sends nothing.
  await clickIn(`${graph} [data-social-actions]`, actions.report);
  await wait(`[...document.querySelectorAll('[aria-modal="true"]')].some(d=>d.innerText.includes(${JSON.stringify(reportCopy.body)}))`);
  await clickIn('[aria-modal="true"]', reportCopy.cancel);
  await wait(`!document.querySelector('[aria-modal="true"]')`);
  assert.equal(reports,reportsBefore,'Cancelling a report sent it');
  evidence.push({locale,theme,width,lazyRead:true,pageRecovery:true,directionIsolation:true,keyboardReopen:true,endConfirmed:true,reportDialog:true,axeViolations:0,geometry});
 }

 assert.deepEqual(page.errors,[]);
}catch(error){evidence.push({failed:String(error),state:await page.evaluate('document.body.innerText.slice(0,2200)').catch(()=>null)});process.exitCode=1;}
finally{writeFileSync(join(out,'report.json'),JSON.stringify({provenance:'Actual Family route in local Chrome with real pointer; synthetic Core. API/SQL evidence is separate; not full-stack E2E.',evidence,errors:page.errors},null,2));await page.send('Browser.close').catch(()=>{});page.ws.close();}
console.log(JSON.stringify(evidence));
