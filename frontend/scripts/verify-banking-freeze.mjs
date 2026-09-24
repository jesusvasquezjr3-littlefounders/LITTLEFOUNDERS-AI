import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/banking-freeze'); mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
let locale='en-US',theme='light',owner='guardian',frozen=true,writes=0,reads=0;
const evidence=[];
const account=()=>({nickname:'Synthetic account',cardDesign:'indigo',displayNumber:'LF-0000-0000',frozen,frozenBy:owner==='self'?id:'33333333-3333-4333-8333-333333333333',frozenAt:null,openedAt:'2026-01-01T00:00:00Z'});
await page.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
page.ws.addEventListener('message',async({data})=>{
 const message=JSON.parse(data);if(message.method!=='Fetch.requestPaused')return;
 const {requestId,request}=message.params;const url=new URL(request.url);
 try{
  if(url.origin===origin&&!url.pathname.startsWith('/api/'))return void await page.send('Fetch.continueRequest',{requestId});
  if(!url.pathname.startsWith('/api/v1/'))return void await page.send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});
  let status=200,body={data:{},error:null};
  if(request.method!=='OPTIONS'){
   if(url.pathname.endsWith('/auth/me'))body.data={profile:{display_name:'Synthetic',locale,theme,cover:{}},roles:['kid'],avatarOptions:{},analyticsEnabled:false,isGuest:false,newAccount:false,onboardingComplete:true};
   else if(url.pathname.endsWith('/auth/age-screen'))body.data={required:false,ageBand:'13_to_17',protectedOrigin:false};
   else if(url.pathname.endsWith('/banking/account')){reads++;body.data={account:account()};}
   else if(url.pathname.endsWith('/banking/account/freeze')){
    writes++;
    if(writes===1){status=502;body={data:null,error:{code:'DATA_UNAVAILABLE',message:'Synthetic failure'}};}
    else{frozen=JSON.parse(request.postData).frozen;body.data={account:account()};}
   }
   else if(url.pathname.endsWith('/tasks/wallet'))body.data={balances:{save:10,spend:0,share:0}};
   else if(url.pathname.endsWith('/tasks/goals'))body.data={goals:[]};
   else if(url.pathname.endsWith('/tasks/wallet/ledger'))body.data={entries:[]};
   else if(url.pathname.endsWith('/banking/wallet/pending-credits'))body.data={credits:[{id,amount:10,source:'allowance',createdAt:'2026-01-01T00:00:00Z'}]};
   else if(url.pathname.endsWith('/banking/spend-limit'))body.data={status:{configured:false}};
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
 for(locale of ['en-US','es-MX','pt-BR'])for(theme of ['light','dark'])for(const width of [375,1280])for(owner of ['guardian','self']){
  frozen=true;writes=0;const before=reads;
  const copy=JSON.parse(readFileSync(resolve(`src/i18n/${locale}/common.json`),'utf8'));
  const session={accessToken:token,refreshToken:'synthetic',expiresAt:Date.now()+3600000,user:{id},isGuest:false};
  await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
  await page.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
  await page.send('Page.navigate',{url:origin+'/banking'});
  for(let i=0;i<200&&reads===before;i++)await sleep(100);assert.ok(reads>before);
  await wait(`document.body.innerText.includes(${JSON.stringify(copy.banking.kid.frozenHold)})`);
  const allocate=`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(copy.tasks.kid.allocateCta)})`;
  assert.equal(await page.evaluate(`(${allocate}).disabled`),true);
  await click(copy.banking.kid.cardDetails);
  await wait("!!document.querySelector('[role=dialog] [role=switch]')");
  const toggle="document.querySelector('[role=dialog] [role=switch]')";
  assert.equal(await page.evaluate(`(${toggle}).getAttribute('aria-label')`),copy.banking.kid.freezeToggle);
  if(owner==='guardian'){
   assert.equal(await page.evaluate(`(${toggle}).disabled`),true);assert.equal(writes,0);
  }else{
   await click(copy.banking.kid.freezeToggle,'switch');await wait("!!document.querySelector('[role=dialog] [role=alert]')");
   assert.equal(await page.evaluate(`(${toggle}).getAttribute('aria-checked')`),'true');
   await click(copy.banking.kid.freezeToggle,'switch');await wait(`(${toggle}).getAttribute('aria-checked')==='false'`);
   assert.equal(await page.evaluate(`(${allocate}).disabled`),false);assert.equal(writes,2);
  }
  const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,`${locale}-${theme}-${width}-${owner}.png`),Buffer.from(shot.data,'base64'));
  evidence.push({locale,theme,width,owner,creditsPreserved:true,guardianRestricted:owner==='guardian',failedUnfreezeRecovered:owner==='self'});
 }
}catch(error){evidence.push({failed:String(error),state:await page.evaluate('document.body.innerText.slice(0,2200)').catch(()=>null)});process.exitCode=1;}
finally{writeFileSync(join(out,'report.json'),JSON.stringify({provenance:'Actual child banking page in local Chrome with real pointer; synthetic Core. SQL and parent component evidence are separate.',evidence,errors:page.errors},null,2));await page.send('Browser.close').catch(()=>{});page.ws.close();}
console.log(JSON.stringify(evidence));
