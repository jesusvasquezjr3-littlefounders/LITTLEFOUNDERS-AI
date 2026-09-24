import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
const origin = process.env.AGE_AUDIT_URL ?? 'http://127.0.0.1:5190';
const out = resolve('../audit-results/connection-withdrawal'); mkdirSync(out, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(out, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 900, dark: false });
const id = '22222222-2222-4222-8222-222222222222';
const token = 'eyJhbGciOiJub25lIn0.' + Buffer.from(JSON.stringify({ sub: id, is_anonymous: false })).toString('base64url') + '.synthetic';
let locale='en-US',theme='light',writes=0,directFollows=0;
const evidence=[];
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
   else if(url.pathname.endsWith('/profiles/synthetic'))body.data={displayName:'Synthetic child',username:'synthetic',cover:{},avatarOptions:{},memberSince:'2026-01-01T00:00:00Z',followers:3,following:0,isFollowing:true,isSelf:false,isTutor:false,requiresGuardianApproval:true,learningStats:{xpPoints:0,minutesLearned:0,lessonsCompleted:0,streakDays:0,lastActiveDate:null},courseBadges:[]};
   else if(url.pathname.endsWith('/connection-request')){directFollows++;status=500;body={data:null,error:{code:'UNEXPECTED',message:'Approved connection must not request again'}};}
   else if(url.pathname.endsWith('/follow')){
    assert.equal(request.method,'DELETE');writes++;body.data={following:false};
   }
   else if(url.pathname.endsWith('/analytics/tracking-decision'))body.data={excluded:true,degraded:false};
   else {status=502;body={data:null,error:{code:'OUTSIDE_AUDIT_SCOPE',message:'Destination data outside this profile audit'}};}

  }
  await page.send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:origin},{name:'Access-Control-Allow-Headers',value:'authorization,content-type'},{name:'Access-Control-Allow-Methods',value:'GET,POST,DELETE,OPTIONS'}],body:Buffer.from(JSON.stringify(body)).toString('base64')});
 }catch(error){if(!/InterceptionId|closed/i.test(String(error)))page.errors.push(String(error));}
});
async function wait(expression) { for (let i=0;i<200;i++) { try { if(await page.evaluate(expression)) return; } catch(e) { if(!/context|navigat/i.test(String(e))) throw e; } await sleep(100); } throw Error('Timed out: '+expression); }
async function click(text, role='button') {
  const selector = role === 'button' ? 'button' : '[role="switch"]';
  const lookup = `[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.getAttribute('aria-label')===${JSON.stringify(text)}||e.textContent.trim().endsWith(${JSON.stringify(text)})))`;
  await wait(`!!(${lookup}) && !(${lookup}).disabled`);
  const point = await page.evaluate(`(() => { const e=${lookup}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded action: '+document.elementFromPoint(x,y)?.outerHTML.slice(0,600)); return {x,y}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button:'left',clickCount:1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button:'left',clickCount:1 });
}
try{
 await warmDevServer(page,origin);await page.send('Page.navigate',{url:origin});await wait('!!document.body');
 for(locale of ['en-US','es-MX','pt-BR'])for(theme of ['light','dark'])for(const width of [375,1280]){
  writes=0;directFollows=0;
  const copy=JSON.parse(readFileSync(resolve(`src/i18n/${locale}/profile.json`),'utf8')).public;
  const session={accessToken:token,refreshToken:'synthetic',expiresAt:Date.now()+3600000,user:{id},isGuest:false};
  await page.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('lf.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('i18nextLng',${JSON.stringify(locale)});localStorage.setItem('lf-theme',${JSON.stringify(theme)});`);
  await page.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
  const previousDocument=await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate',{url:origin+'/@synthetic'});
  await wait(`performance.timeOrigin !== ${previousDocument}`);
  await wait(`!![...document.querySelectorAll('button')].find(e=>e.textContent.trim().endsWith(${JSON.stringify(copy.following)}))`);
  await page.evaluate('document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
  assert.equal(await page.evaluate(`!!document.querySelector('[data-social-audit=connection-request]')`),false);
  const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,`${locale}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
  await click(copy.following);
  await wait(`location.pathname === '/learn' && !document.body.innerText.includes('@synthetic')`);
  assert.equal(writes,1);assert.equal(directFollows,0);
  evidence.push({locale,theme,width,withdrawalAvailable:true,noDuplicateRequest:true,oneDelete:true,leavesPrivateProfile:true});

 }

 assert.deepEqual(page.errors,[]);
}catch(error){const failedShot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,'failure.png'),Buffer.from(failedShot.data,'base64'));evidence.push({failed:String(error),state:await page.evaluate('document.body.innerText.slice(0,2200)').catch(()=>null)});process.exitCode=1;}
finally{writeFileSync(join(out,'report.json'),JSON.stringify({provenance:'Actual public-profile route in local Chrome with real pointer; synthetic Core. API/SQL evidence is separate; not full-stack E2E.',evidence,errors:page.errors},null,2));await page.send('Browser.close').catch(()=>{});page.ws.close();}
console.log(JSON.stringify(evidence));
