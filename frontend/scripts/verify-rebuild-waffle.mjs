import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-waffle');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'waffle', age }).toString();
  const previousDocument = await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`performance.timeOrigin!==${previousDocument} && location.search===${JSON.stringify('?' + query)}
      && !!document.querySelector('[data-screen="${age === '6-9' ? 'lesson' : 'lesson-unavailable'}"]')`)) break;
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

async function click(selector) {
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const point = await page.evaluate(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)});if(!e) throw Error('Missing control');
    const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded control');
    return {x:x-(visualViewport?.offsetLeft||0),y:y-(visualViewport?.offsetTop||0)};
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

async function capture(name) {
  await page.evaluate('window.scrollTo(0,0)');
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const shot = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, name), Buffer.from(shot.data, 'base64'));
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
      await navigate(locale, theme, '6-9', width, scale, spacing);
      const issues = await page.evaluate(`(() => {
        const issues=[],main=document.querySelector('[data-screen="lesson"]'),grid=main?.querySelector('.lf-learning-waffle-grid');
        if(!main||!grid) return ['wrong-screen'];
        if(grid.querySelectorAll('.lf-learning-waffle-cell').length!==100
          ||grid.querySelectorAll('.lf-learning-waffle-cell--left').length!==100) issues.push('initial-grid');
        if(getComputedStyle(grid).gridTemplateColumns.split(' ').length!==10) issues.push('ten-columns');
        if(!main.querySelector('[role="img"]')?.getAttribute('aria-label')?.includes(${JSON.stringify(locale === 'es-MX' ? '1 fila = 1 moneda' : locale === 'pt-BR' ? '1 linha = 1 moeda' : '1 row = 1 coin')}))
          issues.push('row-coin-description');
        if(main.querySelectorAll('h1').length!==1) issues.push('heading-count');
        if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
        const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
        const factor=${locale === 'en-US' ? 1 : 1.25},limits={action:3,heading:6,body:12,prompt:12,option:5};
        let fold=0;
        for(const e of main.querySelectorAll('[data-copy-role]')){
          const r=e.getBoundingClientRect(),s=getComputedStyle(e),role=e.dataset.copyRole,text=e.textContent.trim();
          if(role in limits&&words(text)>Math.ceil(limits[role]*factor)) issues.push('copy:'+role+':'+text);
          if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)
            ||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+role);
          if(parseFloat(s.fontSize)<14) issues.push('text-size:'+role);
          if(r.top<740&&r.bottom>0&&!['data','brand','legal'].includes(role)) fold+=words(text);
        }
        if(innerWidth===375&&${scale}===1&&!${spacing}&&fold>Math.ceil(25*factor)) issues.push('first-view:'+fold);
        for(const e of main.querySelectorAll('button,input[type="range"]')){
          const r=e.getBoundingClientRect();if(r.width<48||r.height<48) issues.push('touch-target');
        }
        if(innerWidth===375&&${scale}===1&&!${spacing}){
          const action=main.querySelector('.lf-learning-actions button')?.getBoundingClientRect();
          const first=main.querySelector('.lf-learning-stepper button')?.getBoundingClientRect();
          const foot=main.querySelector('.lf-learning-foot')?.getBoundingClientRect();
          if(!action||!first||!foot||first.bottom>740||first.bottom>foot.top-4)
            issues.push('first-control-not-reachable');
        }
        return [...new Set(issues)];
      })()`);
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, scale, spacing, issues });
      if (locale === 'es-MX' && width === 375 && scale === 1 && !spacing)
        await capture(`waffle-initial-375-${theme}.png`);
    }

  for (const theme of ['light', 'dark']) {
    await page.evaluate('sessionStorage.clear()');
    await navigate('es-MX', theme, '6-9', 375, 1, false);
    for (let n = 0; n < 3; n++) await click('button[aria-label="Añadir: Guardar"]');
    for (let n = 0; n < 3; n++) await click('button[aria-label="Añadir: Gastar"]');
    for (let n = 0; n < 4; n++) await click('button[aria-label="Añadir: Compartir"]');
    const allocationIssues = await page.evaluate(`(() => {
      const issues=[],grid=document.querySelector('.lf-learning-waffle-grid');
      for(const [kind,count] of [['save',30],['spend',30],['share',40]])
        if(grid.querySelectorAll('.lf-learning-waffle-cell--'+kind).length!==count) issues.push('cells:'+kind);
      if(grid.querySelectorAll('.lf-learning-waffle-cell--left').length) issues.push('unallocated-cells');
      const rgb=value=>(value.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
      const luminance=value=>{const c=rgb(value).map(n=>{const x=n/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
      const surface=luminance(getComputedStyle(document.querySelector('.lf-learning-board')).backgroundColor);
      for(const kind of ['save','spend','share']){
        const mark=luminance(getComputedStyle(grid.querySelector('.lf-learning-waffle-cell--'+kind)).backgroundColor);
        const ratio=(Math.max(surface,mark)+.05)/(Math.min(surface,mark)+.05);
        if(ratio<3) issues.push('mark-contrast:'+kind+':'+ratio.toFixed(2));
      }
      return issues;
    })()`);
    if (allocationIssues.length) findings.push({ theme, allocationIssues });
    await capture(`waffle-filled-375-${theme}.png`);
    await click('.lf-learning-view-toggle');
    if (!await page.evaluate("document.querySelector('.lf-learning-table')?.textContent?.includes('3 monedas') && document.querySelector('.lf-learning-table')?.textContent?.includes('4 monedas')"))
      findings.push({ theme, interaction: 'table-not-synchronized' });
    const tableFoot = await page.evaluate(`(() => {
      const foot=document.querySelector('.lf-learning-foot'),action=foot?.querySelector('button');
      return { position:foot ? getComputedStyle(foot).position : '', bottom:action?.getBoundingClientRect().bottom };
    })()`);
    if (tableFoot.position !== 'fixed' || tableFoot.bottom > 740)
      findings.push({ theme, interaction: 'table-action-not-in-view', tableFoot });
    await capture(`waffle-table-375-${theme}.png`);
    await click('.lf-learning-actions button');
    if (!await page.evaluate("!!document.querySelector('.lf-learning-feedback--met') && document.querySelector('.lf-learning-progress')?.getAttribute('aria-valuenow')==='100'"))
      findings.push({ theme, interaction: 'shared-scorer-not-met' });
    await click('.lf-learning-control-bar .lf-button');
    await page.evaluate("document.querySelector('button[aria-label=\"Añadir: Guardar\"]').focus()");
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await click('.lf-learning-view-toggle');
    if (!await page.evaluate("document.querySelectorAll('.lf-learning-waffle-cell--save').length===10"))
      findings.push({ theme, interaction: 'keyboard-allocation-not-reflected-in-waffle' });
  }

  for(const age of ['10-12','13-17','adult']){
    await navigate('es-MX','light',age,375,1,false);
    if(!await page.evaluate("!!document.querySelector('[data-screen=lesson-unavailable]') && !document.querySelector('.lf-learning-waffle')"))
      findings.push({ age, issue: 'age-gate' });
  }
  if(page.errors.length||page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output,'report.json'),JSON.stringify({ configurations, findings,
    scope:'Controlled ten-coin waffle pilot; same pure allocation scorer, no signed attempt or saved progress.' },null,2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if(findings.length){console.error(JSON.stringify(findings.slice(0,12),null,2));process.exitCode=1;}
} finally {
  await page.send('Browser.close').catch(()=>{});
  page.ws.close(); browser.child.kill();
}
