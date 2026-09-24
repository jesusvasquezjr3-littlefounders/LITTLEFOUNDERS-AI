import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-ratio-table');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'ratiotable', age }).toString();
  const previous = await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`performance.timeOrigin!==${previous} && location.search===${JSON.stringify('?' + query)}
      && !!document.querySelector('[data-screen="${age === '10-12' ? 'ratio-table' : 'lesson-unavailable'}"]')`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate(`(() => { document.documentElement.style.fontSize='${16 * scale}px'; let style=document.getElementById('audit-spacing');
    if(!style){style=document.createElement('style');style.id='audit-spacing';document.head.append(style);} style.textContent=${JSON.stringify(spacing ? '.lf-rebuild * { letter-spacing:.12em !important; word-spacing:.16em !important; line-height:1.5 !important; }' : '')}; window.scrollTo(0,0); })()`);
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

async function click(selector) {
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  const point = await page.evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw Error('Missing control'); const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2; if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded control'); return {x:x-(visualViewport?.offsetLeft||0),y:y-(visualViewport?.offsetTop||0)}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function dragPair(selector, fraction) {
  const points = await page.evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}),track=e?.parentElement; if(!e||!track) throw Error('Missing pair'); const a=e.getBoundingClientRect(),b=track.getBoundingClientRect(); return {start:{x:a.x+a.width/2,y:a.y+a.height/2},end:{x:b.x+b.width*Math.min(1,Math.max(0,${fraction})),y:a.y+a.height/2}}; })()`);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...points.start,button:'left',clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',...points.end,button:'left'});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...points.end,button:'left',clickCount:1});
}
async function capture(name) { await page.evaluate('window.scrollTo(0,0)'); const shot=await page.send('Page.captureScreenshot',{format:'png'}); writeFileSync(join(output,name),Buffer.from(shot.data,'base64')); }

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
      await navigate(locale, theme, '10-12', width, scale, spacing);
      const issues = await page.evaluate(`(() => { const issues=[],main=document.querySelector('[data-screen="ratio-table"]'),slider=main?.querySelector('input[type=range]'),diagram=main?.querySelector('.lf-ratio-diagram'); if(!main||!slider||!diagram) return ['wrong-screen'];
        if(slider.min!=='1'||slider.max!=='4'||slider.step!=='1'||slider.value!=='2') issues.push('pack-range');
        if(!diagram.getAttribute('aria-label')?.includes('6')||!diagram.getAttribute('aria-label')?.includes('30')) issues.push('linked-values');
        if(diagram.querySelectorAll('.lf-ratio-line').length!==2||diagram.querySelectorAll('.lf-ratio-ticks span').length!==8||diagram.querySelectorAll('.lf-ratio-pair').length!==2) issues.push('paired-lines');
        if(main.querySelectorAll('h1').length!==1||document.documentElement.scrollWidth>innerWidth+1) issues.push('layout');
        const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length, factor=${locale === 'en-US' ? 1 : 1.25},limits={action:3,heading:6,body:12,prompt:12,option:5}; let fold=0;
        for(const e of main.querySelectorAll('[data-copy-role]')) { const r=e.getBoundingClientRect(),s=getComputedStyle(e),role=e.dataset.copyRole,text=e.textContent.trim(); if(role in limits&&words(text)>Math.ceil(limits[role]*factor)) issues.push('copy:'+role+':'+text); if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+role); if(parseFloat(s.fontSize)<14) issues.push('text-size:'+role); if(r.top<740&&r.bottom>0&&!['data','brand','legal'].includes(role)) fold+=words(text); }
        if(innerWidth===375&&${scale}===1&&!${spacing}&&fold>Math.ceil(25*factor)) issues.push('first-view:'+fold);
        for(const e of main.querySelectorAll('button,input[type=range]')) {const r=e.getBoundingClientRect();if(r.width<48||r.height<48) issues.push('touch-target');}
        return [...new Set(issues)]; })()`);
      configurations++; if(issues.length) findings.push({ locale, theme, width, scale, spacing, issues });
      if(locale==='es-MX'&&width===375&&scale===1&&!spacing) await capture(`ratio-table-initial-375-${theme}.png`);
    }
  for (const theme of ['light', 'dark']) {
    await navigate('es-MX', theme, '10-12', 375, 1, false);
    await dragPair('.lf-ratio-pair:first-of-type', 2 / 3);
    for(let n=0;n<20;n++){if(await page.evaluate("document.querySelector('input[type=range]')?.value==='3'")) break;await new Promise(done=>setTimeout(done,50));}
    if(!await page.evaluate("document.querySelector('.lf-ratio-diagram')?.getAttribute('aria-label')?.includes('9 artículos; 45 monedas')")) findings.push({theme,interaction:'drag-pair-linked-values'});
    await capture(`ratio-table-filled-375-${theme}.png`);
    await click('.lf-learning-view-toggle');
    for(let n=0;n<20;n++){if(await page.evaluate("document.querySelector('.lf-learning-view-toggle')?.getAttribute('aria-pressed')==='true'")) break;await new Promise(done=>setTimeout(done,50));}
    if(!await page.evaluate("document.querySelectorAll('.lf-ratio-table tbody tr').length===3 && document.querySelector('.lf-ratio-table')?.textContent?.includes('45 monedas')")) findings.push({theme,interaction:'table-parity'});
    await capture(`ratio-table-table-375-${theme}.png`);
    await click('.lf-learning-view-toggle');
    for(let n=0;n<20;n++){if(await page.evaluate("document.querySelector('.lf-learning-view-toggle')?.getAttribute('aria-pressed')==='false'")) break;await new Promise(done=>setTimeout(done,50));}
    await page.evaluate("document.querySelector('input[type=range]')?.focus()");
    await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39}); await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    if(!await page.evaluate("document.querySelector('input[type=range]')?.value==='4'")) findings.push({theme,interaction:'keyboard-slider'});
    await click('.lf-parameter-stepper button:first-child');
    if(!await page.evaluate("document.querySelector('input[type=range]')?.value==='3'")) findings.push({theme,interaction:'stepper'});
  }
  for(const age of ['6-9','13-17','adult']) { await navigate('es-MX','light',age,375,1,false); if(!await page.evaluate("!!document.querySelector('[data-screen=lesson-unavailable]')&&!document.querySelector('.lf-ratio-diagram')")) findings.push({age,issue:'age-gate'}); }
  if(page.errors.length||page.failedRequests.length) findings.push({runtimeErrors:page.errors,failedRequests:page.failedRequests});
  writeFileSync(join(output,'report.json'),JSON.stringify({configurations,findings,scope:'Controlled tween ratio-table candidate; linked, answerless exploration with semantic table. Drag-pair authoring remains pending.'},null,2));
  console.log(JSON.stringify({configurations,findings:findings.length,output})); if(findings.length){console.error(JSON.stringify(findings.slice(0,12),null,2));process.exitCode=1;}
} finally { await page.send('Browser.close').catch(()=>{});page.ws.close();browser.child.kill(); }
