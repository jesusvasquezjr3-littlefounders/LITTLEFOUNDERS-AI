import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';
import { trackAuditedAssets, waitForAuditedAssets } from './audits/media.mjs';
import { installSyntheticCore, loadLessonFixtures, SCENARIOS, sessionStorageScript } from './audits/synthetic-core.mjs';

/* Real cold-route fallback matrix. One precise lazy request is deliberately
 * held or failed; its expected errors are recorded separately, never hidden.
 * No real Core, model, media service or production endpoint is contacted. */
const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5182';
const output = resolve(process.env.REPORT_DIR ?? '../audit-results/route-fallbacks');
mkdirSync(output, { recursive: true });
const locales = ['en-US', 'es-MX', 'pt-BR'], themes = ['light', 'dark'], widths = [375, 768, 1280];
const cases = [
  { id: 'mentor-chunk-loading', chunk: 'TutorPage', path: '/tutor', scenario: 'mentor-screen-child', selector: '.lf-mentor-route-loading', embedded: false },
  { id: 'lesson-chunk-loading', chunk: 'LessonRoute', path: '/learn/lesson/audit-machine', scenario: 'lesson-function-machine', selector: '.lf-route-loading', embedded: false },
  { id: 'lesson-chunk-error', chunk: 'LessonRoute', path: '/learn/lesson/audit-machine', scenario: 'lesson-function-machine', selector: '[data-screen="route-error"]', embedded: false, fail: true },
  { id: 'staff-embedded-loading', chunk: 'staffConsole', path: '/admin/intel', scenario: 'shell-staff', selector: '.lf-route-loading', embedded: true },
];
async function until(page, expression, label) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await page.evaluate(`!!(${expression})`).catch(() => false)) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw Error(`Timed out: ${label}`);
}
async function press(page, selector) {
  const point = await page.evaluate(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)}); if(!e)throw Error('Missing pointer target');
    e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    if(!e.contains(document.elementFromPoint(x,y)))throw Error('Occluded pointer target');return{x,y};
  })()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
}
async function key(page, name, code, number) {
  for(const type of ['keyDown','keyUp'])await page.send('Input.dispatchKeyEvent',{type,key:name,code,windowsVirtualKeyCode:number,...(type==='keyDown'&&name==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})});
}
const html = await (await fetch(origin)).text();
const entry = /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
assert.ok(entry, 'compiled script entry');
const entryText = await (await fetch(new URL(entry, origin))).text();
const chunks = Object.fromEntries(['TutorPage','LessonRoute','staffConsole'].map(name => {
  const matches = [...new Set(entryText.match(new RegExp(`${name}-[A-Za-z0-9_-]+\.js`, 'g')) ?? [])];
  assert.equal(matches.length,1,`exact compiled ${name} chunk`);
  return [name,new URL(`/assets/${matches[0]}`,origin).href];
}));
const browser = await launchBrowser(mkdtempSync(join(output,'chrome-')));
const evidence=[], failures=[];
try {
  const warm = await openPage(browser.browser,{width:375,height:740,dark:false});
  const fixtures = await loadLessonFixtures(warm,locales,{compiled:true,origin});
  await warm.close();
  for(const item of cases) for(const locale of locales) for(const theme of themes) for(const width of widths) {
    const where={case:item.id,locale,theme,width},page=await openPage(browser.browser,{width,height:740,dark:theme==='dark',newWindow:true,isolated:true});
    const tracker=trackAuditedAssets(page,origin),target=chunks[item.chunk];let held=null;
    try {
      await installSyntheticCore(page,origin,{unknownRequests:new Set(),answerRequest:(_core,_path,request)=>request.url===target?'hold':undefined});
      await page.send('Fetch.enable',{patterns:[{urlPattern:'*/api/v1/*'},{urlPattern:target}]});
      page.ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.sessionId===page.sessionId&&m.method==='Fetch.requestPaused'&&m.params.request.url===target)held=m.params.requestId;});
      await page.send('Page.navigate',{url:`${origin}/favicon.ico`});
      await until(page,"location.pathname==='/favicon.ico' && document.readyState==='complete'",'neutral document');
      const spec=SCENARIOS[item.scenario];assert.ok(spec,`scenario ${item.scenario}`);
      page.core={scenario:item.scenario,locale,theme,fixtures};
      await page.evaluate(sessionStorageScript({guest:spec.guest,locale,theme}));
      await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:'reduce'}]});
      await page.send('Page.navigate',{url:new URL(`${item.path}?lng=${locale}`,origin).href});
      const heldDeadline=Date.now()+20000;
      while(!held && Date.now()<heldDeadline) { await new Promise(r=>setTimeout(r,50)); if(page.closed)throw Error(page.closed); }
      assert.ok(held, `exact lazy request intercepted: ${target}`);
      if(item.fail)await page.send('Fetch.failRequest',{requestId:held,errorReason:'Failed'});
      await until(page,`document.querySelector(${JSON.stringify(item.selector)}) && document.documentElement.lang===${JSON.stringify(locale)}`,'fallback mounted');
      // The sole deliberate held request is excluded from this transient wait;
      // every other typed asset and rendered image must already have completed.
      const end=Date.now()+15000;
      while(Date.now()<end) {
        const other=[...tracker.pending.values()].filter(url=>url!==target);
        const ready=await page.evaluate("[...document.images].every(i=>i.complete&&i.naturalWidth>0)");
        if(!other.length&&ready)break;
        await new Promise(r=>setTimeout(r,50));
      }
      assert.deepEqual([...tracker.pending.values()].filter(url=>url!==target),[],'all unintended asset transport settled');
      assert.ok(await page.evaluate("[...document.images].every(i=>i.complete&&i.naturalWidth>0)"),'all rendered images decoded');
      const structure=await page.evaluate(`({headers:document.querySelectorAll('header').length,brand:document.querySelectorAll('img[data-asset-id="brand.mark"]').length,
        decoded:[...document.querySelectorAll('img[data-asset-id="brand.mark"]')].every(i=>i.complete&&i.naturalWidth>0),
        prefs:document.querySelectorAll('[data-shell-preferences]').length,mains:document.querySelectorAll('main').length,
        standalone:document.querySelectorAll('.lf-standalone-header').length,skip:document.querySelectorAll('.lf-skip-link').length,
        modeText:document.querySelector('[data-shell-preferences] .lf-icon-button')?.textContent,
        theme:document.querySelector('.lf-rebuild')?.dataset.theme,nav:document.querySelectorAll('nav').length})`);
      assert.equal(structure.headers,1);assert.equal(structure.brand,1);assert.ok(structure.decoded);assert.equal(structure.prefs,1);assert.equal(structure.mains,1);assert.equal(structure.skip,1);
      assert.equal(structure.standalone,item.embedded?0:1);assert.equal(structure.modeText,'');assert.equal(structure.theme,theme);
      if(!item.embedded)assert.equal(structure.nav,0);
      await page.evaluate('document.activeElement?.blur(); window.scrollTo(0,0)');
      await key(page,'Tab','Tab',9);
      assert.ok(await page.evaluate("document.activeElement.classList.contains('lf-skip-link')"),'first Tab is skip');
      await key(page,'Enter','Enter',13);
      assert.ok(await page.evaluate("document.activeElement.tagName==='MAIN'"),'skip moves focus to main');
      await press(page,'[data-shell-preferences] [role=combobox]');
      assert.equal(await page.evaluate("document.querySelectorAll('[role=option]').length"),3);
      await key(page,'Escape','Escape',27);
      assert.ok(await page.evaluate("document.activeElement.matches('[data-shell-preferences] [role=combobox]')"),'language Escape restores focus');
      const alternateLocale=locale==='en-US'?'es-MX':'en-US';
      await press(page,'[data-shell-preferences] [role=combobox]');
      await key(page,'Home','Home',36);
      if(alternateLocale==='es-MX')await key(page,'ArrowDown','ArrowDown',40);
      await key(page,'Enter','Enter',13);
      await until(page,`document.documentElement.lang===${JSON.stringify(alternateLocale)} && document.querySelector('.lf-rebuild')?.getAttribute('lang')===${JSON.stringify(alternateLocale)}`,'working language control');
      await press(page,'[data-shell-preferences] [role=combobox]');
      await key(page,'Home','Home',36);
      for(let n=0;n<locales.indexOf(locale);n++)await key(page,'ArrowDown','ArrowDown',40);
      await key(page,'Enter','Enter',13);
      await until(page,`document.documentElement.lang===${JSON.stringify(locale)}`,'language restored');
      await press(page,'[data-shell-preferences] .lf-icon-button');
      await until(page,`document.querySelector('.lf-rebuild')?.dataset.theme===${JSON.stringify(theme==='dark'?'light':'dark')}`,'working theme control');
      await press(page,'[data-shell-preferences] .lf-icon-button');
      if(!item.fail)await page.send('Fetch.continueRequest',{requestId:held});
      await waitForAuditedAssets(page,{timeoutMs:20000,label:item.id});
      const expectedTransport=`net::ERR_FAILED ${target}`;
      const unexpectedMedia=tracker.failures.filter(error=>!item.fail||error!==expectedTransport);
      const expectedJs=page.errors.filter(error=>item.fail&&error.includes(`Failed to fetch dynamically imported module: ${target}`));
      const unexpectedJs=page.errors.filter(error=>!expectedJs.includes(error));
      assert.deepEqual(unexpectedMedia,[],'no unexpected media errors');assert.deepEqual(unexpectedJs,[],'no unexpected JS errors');
      if(item.fail){assert.ok(tracker.failures.includes(expectedTransport),'intentional transport fault recorded');assert.ok(expectedJs.length,'intentional stale chunk error recorded');}
      evidence.push({...where,structure,intentionalFailure:item.fail?{asset:target,transport:expectedTransport,js:expectedJs}:null});
    } catch(error){failures.push({...where,error:error.message});}
    finally {if(held)await page.send('Fetch.continueRequest',{requestId:held}).catch(()=>{});await page.close();}
  }
} finally {browser.child.kill();}
writeFileSync(join(output,'report.json'),JSON.stringify({scope:'actual cold-route wrappers; deliberate lazy chunk hold/failure',expectedCases:72,configurations:evidence.length+failures.length,evidence,failures},null,2));
console.log(`${evidence.length}/72 PASS; ${failures.length} failures; ${output}`);
process.exitCode=failures.length?1:0;
