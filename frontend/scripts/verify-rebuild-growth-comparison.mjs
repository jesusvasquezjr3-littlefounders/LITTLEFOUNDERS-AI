import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-growth-comparison');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'growthcompare', age }).toString();
  const previousDocument = await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`performance.timeOrigin!==${previousDocument} && location.search===${JSON.stringify('?' + query)}
      && !!document.querySelector('[data-screen="${age === '13-17' ? 'growth-comparison' : 'lesson-unavailable'}"]')`)) break;
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
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const point = await page.evaluate(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)});if(!e) throw Error('Missing control');
    const r=e.getBoundingClientRect(),x=r.x+r.width*${fraction},y=r.y+r.height/2;
    if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded control');
    return {x:x-(visualViewport?.offsetLeft||0),y:y-(visualViewport?.offsetTop||0)};
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
      await navigate(locale, theme, '13-17', width, scale, spacing);
      const issues = await page.evaluate(`(() => {
        const issues=[],main=document.querySelector('[data-screen="growth-comparison"]');
        if(!main) return ['wrong-screen'];
        if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
        if(main.querySelectorAll('h1').length!==1) issues.push('heading-count');
        const scale=main.querySelector('[role="group"][aria-label=${JSON.stringify(locale === 'es-MX' ? 'Escala de tiempo' : locale === 'pt-BR' ? 'Escala de tempo' : 'Time scale')}]');
        if(!scale||scale.querySelectorAll('button').length!==2) issues.push('scale-toggle-missing');
        if(scale?.querySelectorAll('button[aria-pressed="true"]').length!==1) issues.push('scale-toggle-state');
        if(main.querySelectorAll('.lf-growth-compare-controls input[type="range"]').length!==3) issues.push('three-controls');
        if(!main.querySelector('.lf-growth-compare-controls .lf-parameter-slider:nth-child(2) label')?.textContent?.includes(${JSON.stringify(locale === 'es-MX' ? 'Tu predicción' : locale === 'pt-BR' ? 'Sua previsão' : 'Your prediction')})) issues.push('prediction-not-first');
        if(!main.querySelector('.lf-learning-actions button')?.disabled) issues.push('reveal-without-prediction');
        if(main.querySelector('.lf-growth-compare-compound')) issues.push('answer-shown-before-prediction');
        if(!main.querySelector('[role="img"]')?.getAttribute('aria-label')?.includes(${JSON.stringify(locale === 'es-MX' ? 'revela' : locale === 'pt-BR' ? 'oculta' : 'hidden')})) issues.push('hidden-chart-description');
        const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
        const factor=${locale === 'en-US' ? 1 : 1.25},limits={action:3,heading:6,body:12,prompt:20,option:8,mentor:20};
        let fold=0;
        for(const e of main.querySelectorAll('[data-copy-role]')) {
          const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height) continue;
          const role=e.dataset.copyRole,text=e.textContent.trim();
          if(role in limits&&words(text)>Math.ceil(limits[role]*factor)) issues.push('copy:'+role+':'+text);
          if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+text);
          if(parseFloat(s.fontSize)<14) issues.push('text-size:'+text);
          if(r.top<740&&r.bottom>0&&!['data','brand','legal'].includes(role)) fold+=words(text);
        }
        if(innerWidth===375&&${scale}===1&&!${spacing}&&fold>Math.ceil(40*factor)) issues.push('first-view:'+fold);
        for(const e of main.querySelectorAll('button,input[type="range"]')) {
          const r=e.getBoundingClientRect();if(r.width<48||r.height<48) issues.push('touch-target');
        }
        if(innerWidth===375&&${scale}===1&&!${spacing}) {
          const action=main.querySelector('.lf-learning-actions button')?.getBoundingClientRect();
          const first=main.querySelector('.lf-growth-compare-controls input')?.getBoundingClientRect();
          if(!action||action.bottom>740) issues.push('reveal-below-first-view');
          if(!first||first.top>740) issues.push('first-control-below-first-view');
        }
        return [...new Set(issues)];
      })()`);
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, scale, spacing, issues });
      if (locale === 'es-MX' && width === 375 && scale === 1 && !spacing) {
        await page.evaluate('window.scrollTo(0,0)');
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(output, `growth-compare-initial-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
      await pointer('.lf-learning-view-toggle');
      const tableIssues = await page.evaluate(`(() => {
        const issues=[],table=document.querySelector('.lf-learning-table');
        if(!table||table.querySelectorAll('thead th').length!==3||table.querySelectorAll('tbody tr').length!==11) return ['three-column-table'];
        if([...table.querySelectorAll('tbody td:last-child')].some(cell=>!['Hidden','Oculto'].includes(cell.textContent.trim()))) issues.push('table-leaks-compound');
        if(innerWidth<840&&getComputedStyle(table.querySelector('tbody')).display!=='grid') issues.push('table-not-stacked');
        if(document.documentElement.scrollWidth>innerWidth+1) issues.push('table-horizontal-scroll');
        return issues;
      })()`);
      if (tableIssues.length) findings.push({ locale, theme, width, scale, spacing, tableIssues });
      await pointer('.lf-growth-compare-controls input[type="range"]', .25);
      await pointer('.lf-learning-actions button');
      const revealIssues = await page.evaluate(`(() => {
        const issues=[],table=document.querySelector('.lf-learning-table'),last=table?.querySelector('tbody tr:last-child td:last-child');
        if(!document.querySelector('.lf-growth-compare-outcome')) issues.push('reveal-missing');
        if(!last||['Hidden','Oculto'].includes(last.textContent.trim())) issues.push('table-still-hidden');
        if(last?.scrollWidth>last?.clientWidth+1||last?.scrollHeight>last?.clientHeight+1) issues.push('revealed-value-clipped');
        if(document.documentElement.scrollWidth>innerWidth+1) issues.push('revealed-horizontal-scroll');
        return issues;
      })()`);
      if (revealIssues.length) findings.push({ locale, theme, width, scale, spacing, revealIssues });
      await pointer('.lf-learning-view-toggle');
      const seriesIssues = await page.evaluate(`(() => {
        const issues=[];
        const rgb=value=>(value.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
        const luminance=value=>{const c=rgb(value).map(n=>{const x=n/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
        const board=document.querySelector('.lf-learning-board');
        const background=luminance(getComputedStyle(board).backgroundColor);
        for(const selector of ['.lf-growth-compare-simple','.lf-growth-compare-compound']) {
          const series=document.querySelector(selector);
          if(!series){issues.push('series-missing:'+selector);continue;}
          const mark=luminance(getComputedStyle(series).stroke);
          const ratio=(Math.max(background,mark)+.05)/(Math.min(background,mark)+.05);
          if(ratio<3) issues.push('series-contrast:'+selector+':'+ratio.toFixed(2));
        }
        return issues;
      })()`);
      if (seriesIssues.length) findings.push({ locale, theme, width, scale, spacing, seriesIssues });
    }

  await navigate('es-MX', 'light', '13-17', 375, 1, false);
  const chartBeforePrediction = await page.evaluate(`({
    axis: document.querySelector('.lf-growth-compare-scale-max')?.textContent,
    simple: document.querySelector('.lf-growth-compare-simple')?.getAttribute('points'),
  })`);
  await pointer('.lf-growth-compare-controls input[type="range"]', .9);
  const chartAfterPrediction = await page.evaluate(`({
    axis: document.querySelector('.lf-growth-compare-scale-max')?.textContent,
    simple: document.querySelector('.lf-growth-compare-simple')?.getAttribute('points'),
    overflowMark: document.querySelector('.lf-growth-compare-prediction')?.tagName.toLowerCase(),
    overflowText: document.querySelector('.lf-growth-compare-legend-prediction')?.textContent,
  })`);
  if (chartAfterPrediction.axis !== chartBeforePrediction.axis
    || chartAfterPrediction.simple !== chartBeforePrediction.simple)
    findings.push({ interaction: 'prediction-rescaled-simple-growth' });
  if (chartAfterPrediction.overflowMark !== 'path' || !chartAfterPrediction.overflowText?.includes('sobre la escala'))
    findings.push({ interaction: 'high-prediction-not-marked-outside-scale' });
  await page.evaluate('window.scrollTo(0,0)');
  const beyondScale = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, 'growth-compare-out-of-scale-375-light.png'), Buffer.from(beyondScale.data, 'base64'));
  await navigate('es-MX', 'light', '13-17', 375, 1, false);
  await pointer('.lf-growth-compare-controls .lf-parameter-slider:nth-child(3) input', .7);
  const rateBeforeReveal = await page.evaluate("document.querySelectorAll('.lf-growth-compare-controls input[type=range]')[1]?.value");
  if (rateBeforeReveal === '800') findings.push({ interaction: 'pointer-rate-did-not-change' });
  await pointer('.lf-growth-compare-controls input[type="range"]', .25);
  if (await page.evaluate("document.querySelector('.lf-learning-actions button')?.disabled"))
    findings.push({ interaction: 'prediction-did-not-enable-reveal' });
  await pointer('.lf-learning-actions button');
  if (!await page.evaluate("!!document.querySelector('.lf-growth-compare-compound') && !!document.querySelector('.lf-growth-compare-outcome')"))
    findings.push({ interaction: 'reveal-missing' });
  if (!await page.evaluate("getComputedStyle(document.querySelector('.lf-growth-compare-compound')).animationDuration==='0.25s'"))
    findings.push({ interaction: 'reveal-motion-token' });
  await new Promise((done) => setTimeout(done, 300));
  await page.evaluate('window.scrollTo(0,0)');
  const reveal = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, 'growth-compare-revealed-375-light.png'), Buffer.from(reveal.data, 'base64'));
  await pointer('.lf-learning-view-toggle');
  if (!await page.evaluate("document.querySelector('.lf-learning-table tbody tr:last-child td:last-child')?.textContent!=='Oculto'"))
    findings.push({ interaction: 'table-not-revealed' });
  await page.evaluate("document.querySelectorAll('.lf-growth-compare-controls input[type=range]')[1]?.focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  if (!await page.evaluate("!document.querySelector('.lf-growth-compare-outcome') && document.querySelector('.lf-learning-table tbody tr:last-child td:last-child')?.textContent==='Oculto'"))
    findings.push({ interaction: 'keyboard-change-did-not-reset-reveal' });
  await navigate('es-MX', 'light', '13-17', 375, 1, false);
  await pointer('[role="group"][aria-label="Escala de tiempo"] button:last-child');
  const scaleToggle = await page.evaluate(`(() => ({
    longPressed: document.querySelector('[role="group"][aria-label="Escala de tiempo"] button:last-child')?.getAttribute('aria-pressed'),
    nearPressed: document.querySelector('[role="group"][aria-label="Escala de tiempo"] button:first-child')?.getAttribute('aria-pressed'),
    years: document.querySelectorAll('.lf-growth-compare-controls input[type=range]')[2]?.value,
    axis: document.querySelector('[role=img]')?.getAttribute('aria-label'),
    rows: document.querySelectorAll('.lf-learning-table tbody tr').length,
  }))()`);
  if (scaleToggle.longPressed !== 'true' || scaleToggle.nearPressed !== 'false' || scaleToggle.years !== '30'
    || !scaleToggle.axis?.includes('0–30') || scaleToggle.rows !== 31) findings.push({ interaction: 'scale-toggle-not-synchronized', scaleToggle });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('es-MX', 'dark', '13-17', 375, 1, false);
  await pointer('.lf-growth-compare-controls input[type="range"]', .25);
  await pointer('.lf-learning-actions button');
  if (!await page.evaluate("!!document.querySelector('.lf-growth-compare-compound') && getComputedStyle(document.querySelector('.lf-growth-compare-compound')).animationName==='none'"))
    findings.push({ interaction: 'reduced-motion-reveal' });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  for (const age of ['6-9', '10-12', 'adult']) {
    await navigate('es-MX', 'light', age, 375, 1, false);
    if (!await page.evaluate("!!document.querySelector('[data-screen=lesson-unavailable]') && !document.querySelector('.lf-growth-compare-chart')"))
      findings.push({ age, issue: 'age-gate' });
  }
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings,
    scope: 'Controlled teen simple/compound prediction pilot; no saved progress or server grade.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
