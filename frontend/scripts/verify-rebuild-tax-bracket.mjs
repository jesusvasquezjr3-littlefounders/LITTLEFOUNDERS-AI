import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-tax-bracket');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'taxbracket', age }).toString();
  const previousDocument = await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`performance.timeOrigin!==${previousDocument} && location.search===${JSON.stringify('?' + query)}
      && !!document.querySelector('[data-screen="${age === '13-17' ? 'tax-bracket' : 'lesson-unavailable'}"]')`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate(`(() => {
    document.documentElement.style.fontSize='${16 * scale}px';
    let style=document.getElementById('audit-spacing');
    if(!style){style=document.createElement('style');style.id='audit-spacing';document.head.append(style);}
    style.textContent=${JSON.stringify(spacing ? '.lf-rebuild * { letter-spacing:.12em !important; word-spacing:.16em !important; line-height:1.5 !important; }' : '')};
  })()`);
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

async function pointer(selector, fraction = .5) {
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  const point = await page.evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control');
    const r=e.getBoundingClientRect(),x=r.x+r.width*${fraction},y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw Error('Occluded control');
    return {x:x-(visualViewport?.offsetLeft||0),y:y-(visualViewport?.offsetTop||0)}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
      await navigate(locale, theme, '13-17', width, scale, spacing);
      const issues = await page.evaluate(`(() => {
        const issues=[],main=document.querySelector('[data-screen="tax-bracket"]');if(!main)return ['wrong-screen'];
        if(document.documentElement.scrollWidth>innerWidth+1)issues.push('horizontal-scroll');
        if(main.querySelectorAll('h1').length!==1)issues.push('heading-count');
        const chart=main.querySelector('[role=img]'),svg=chart?.querySelector('svg.lf-tax-stack'),rects=svg?.querySelectorAll('rect');
        if(!chart||!svg||rects?.length!==3)issues.push('svg-stacked-bar-missing');
        if(!chart?.getAttribute('aria-label')?.includes(${JSON.stringify(locale === 'es-MX' ? 'Impuesto' : locale === 'pt-BR' ? 'Imposto' : 'Tax')}))issues.push('chart-description');
        const rgb=value=>(value.match(/[\\d.]+/g)||[]).slice(0,3).map(Number),luminance=value=>{const c=rgb(value).map(n=>{const x=n/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
        const background=luminance(getComputedStyle(main.querySelector('.lf-learning-board')).backgroundColor);
        for(const rect of rects||[]){const mark=luminance(getComputedStyle(rect).fill),ratio=(Math.max(background,mark)+.05)/(Math.min(background,mark)+.05);if(ratio<3)issues.push('stacked-bar-contrast:'+ratio.toFixed(2));}
        if(main.querySelectorAll('.lf-learning-control-strip input[type=range]').length!==1)issues.push('income-slider-missing');
        if(!main.querySelector('.lf-learning-view-toggle'))issues.push('table-toggle-missing');
        for(const e of main.querySelectorAll('button,input[type=range]')){const r=e.getBoundingClientRect();if(r.width<48||r.height<48)issues.push('touch-target');}
        for(const e of main.querySelectorAll('[data-copy-role]')){const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height)continue;if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1))issues.push('text-overflow:'+e.textContent.trim());if(parseFloat(s.fontSize)<14)issues.push('text-size:'+e.textContent.trim());}
        return [...new Set(issues)]; })()`);
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, scale, spacing, issues });
      if (locale === 'es-MX' && width === 375 && scale === 1 && !spacing) { await page.evaluate('window.scrollTo(0,0)'); const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,`tax-bracket-initial-375-${theme}.png`),Buffer.from(shot.data,'base64')); }
      await pointer('.lf-learning-view-toggle');
      const tableIssues = await page.evaluate(`(() => {const table=document.querySelector('.lf-learning-table'),issues=[];if(!table||table.querySelectorAll('thead th').length!==3||table.querySelectorAll('tbody tr').length!==3)issues.push('three-row-tax-table');if(innerWidth<840&&table&&getComputedStyle(table.querySelector('tbody')).display!=='grid')issues.push('table-not-stacked');if(document.documentElement.scrollWidth>innerWidth+1)issues.push('table-horizontal-scroll');return issues;})()`);
      if (tableIssues.length) findings.push({ locale, theme, width, scale, spacing, tableIssues });
      await pointer('.lf-learning-view-toggle');
    }

  await navigate('es-MX', 'light', '13-17', 375, 1, false);
  const before = await page.evaluate(`({ chart:document.querySelector('[role=img]')?.getAttribute('aria-label'),tax:document.querySelector('.lf-tax-summary')?.textContent,rects:[...document.querySelectorAll('.lf-tax-stack rect')].map(r=>r.getAttribute('width')) })`);
  await pointer('.lf-slider input', .8);
  const after = await page.evaluate(`({ chart:document.querySelector('[role=img]')?.getAttribute('aria-label'),tax:document.querySelector('.lf-tax-summary')?.textContent,rects:[...document.querySelectorAll('.lf-tax-stack rect')].map(r=>r.getAttribute('width')) })`);
  if (before.chart === after.chart || before.tax === after.tax || before.rects.join(',') === after.rects.join(',')) findings.push({ interaction: 'income-not-synchronized' });
  await page.evaluate('document.querySelector(".lf-slider input")?.focus()');
  const keyboardBefore = await page.evaluate('document.querySelector(".lf-slider input")?.value');
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  if (keyboardBefore === await page.evaluate('document.querySelector(".lf-slider input")?.value')) findings.push({ interaction: 'keyboard-income-not-changed' });
  await pointer('.lf-learning-view-toggle');
  const rowAmounts = await page.evaluate(`[...document.querySelectorAll('.lf-learning-table tbody tr')].map(row=>row.textContent)`);
  if (rowAmounts.length !== 3 || rowAmounts.every((value) => !value?.includes('30'))) findings.push({ interaction: 'table-not-synchronized', rowAmounts });
  await page.evaluate('window.scrollTo(0,0)'); const finalShot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,'tax-bracket-adjusted-375-light.png'),Buffer.from(finalShot.data,'base64'));
  for (const age of ['6-9', '10-12', 'adult']) { await navigate('es-MX','light',age,375,1,false); if(!await page.evaluate("!!document.querySelector('[data-screen=lesson-unavailable]') && !document.querySelector('.lf-tax-chart')")) findings.push({ age, issue: 'age-gate' }); }
  if(page.errors.length||page.failedRequests.length)findings.push({ runtimeErrors:page.errors,failedRequests:page.failedRequests });
  writeFileSync(join(output,'report.json'),JSON.stringify({ configurations,findings,scope:'Controlled M20 progressive tax pilot for the 14–17 eligible subset of the teen pathway; no saved progress or server grade.' },null,2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if(findings.length){console.error(JSON.stringify(findings.slice(0,12),null,2));process.exitCode=1;}
} finally { await page.send('Browser.close').catch(()=>{});page.ws.close();browser.child.kill(); }
