import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-numberline');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'numberline', age }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('[data-screen="numberline"]')`)) break;
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
  const point = await page.evaluate(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)});if(!e) throw Error('Missing control');
    e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    if(!e.contains(document.elementFromPoint(x,y))) throw Error('Control is occluded');return {x,y};
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) for (const age of ['6-9', '10-12']) for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
    await navigate(locale, theme, age, width, scale, spacing);
    const issues = await page.evaluate(`(() => {
      const issues=[],main=document.querySelector('[data-screen="numberline"]');
      if(!main||main.dataset.screen!=='numberline') return ['wrong-screen'];
      if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
      if(main.querySelectorAll('h1').length!==1) issues.push('heading-count');
      if(!main.querySelector('[role="img"]')||!main.querySelector('input[type="range"]')) issues.push('visual-or-slider-missing');
      const marker=main.querySelector('.lf-number-line-marker')?.getBoundingClientRect();
      if(!marker||Math.abs(marker.width-32)>1||Math.abs(marker.height-32)>1) issues.push('handle-not-32px');
      const slider=main.querySelector('input[type="range"]')?.getBoundingClientRect();
      if(!slider||slider.height<64) issues.push('slider-hit-area');
      const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
      const factor=${locale === 'en-US' ? 1 : 1.25},young=${age === '6-9'};
      const limits={action:3,heading:6,body:12,prompt:young?12:20,option:young?5:8,mentor:young?12:20,narrative:30};
      let fold=0;
      for(const e of main.querySelectorAll('[data-copy-role]')) {
        const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height) continue;
        const role=e.dataset.copyRole,text=e.textContent.trim();
        if(role in limits&&words(text)>Math.ceil(limits[role]*factor)) issues.push('copy:'+role+':'+text);
        if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+text);
        if(parseFloat(s.fontSize)<14) issues.push('text-size:'+text);
        if(r.top<740&&r.bottom>0&&!['data','brand','legal'].includes(role)) fold+=words(text);
      }
      if(innerWidth===375&&${scale}===1&&!${spacing}&&fold>Math.ceil((young?25:40)*factor)) issues.push('first-view:'+fold);
      for(const e of main.querySelectorAll('button')){const r=e.getBoundingClientRect();if(r.width<48||r.height<48) issues.push('touch-target');}
      if(innerWidth===375&&${scale}===1&&!${spacing}&&slider?.bottom>740) issues.push('slider-below-first-view');
      return issues;
    })()`);
    configurations++;
    if (issues.length) findings.push({ locale, theme, age, width, scale, spacing, issues });
    if (locale === 'es-MX' && theme === 'light' && width === 375 && scale === 1 && !spacing) {
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(output, `${age}-375.png`), Buffer.from(shot.data, 'base64'));
    }
  }

  await navigate('es-MX', 'light', '6-9', 375, 1, false);
  const sliderPoint = await page.evaluate(`(() => { const r=document.querySelector('.lf-number-line-slider').getBoundingClientRect();
    return { start:{x:r.left+16,y:r.top+r.height/2}, target:{x:r.left+16+(r.width-32)*.7,y:r.top+r.height/2} }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...sliderPoint.start, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...sliderPoint.target, button: 'left' });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...sliderPoint.target, button: 'left', clickCount: 1 });
  if (!await page.evaluate("document.querySelector('.lf-number-line-slider').value === '7'")) findings.push({ interaction: 'pointer-placement-failed' });
  await page.evaluate("document.querySelector('.lf-number-line-slider').focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  if (!await page.evaluate("document.querySelector('.lf-number-line-slider').value === '8'")) findings.push({ interaction: 'keyboard-placement-failed' });
  await click('.lf-learning-actions .lf-button--accent');
  if (!await page.evaluate("!!document.querySelector('.lf-learning-feedback--review') && document.querySelector('.lf-learning-progress')?.getAttribute('aria-valuenow') === '0'")) findings.push({ interaction: 'wrong-point-not-reviewed' });
  await click('button[aria-label="Mover a la izquierda"]');
  await click('.lf-learning-actions .lf-button--accent');
  if (!await page.evaluate("!!document.querySelector('.lf-learning-feedback--met') && document.querySelector('.lf-learning-progress')?.getAttribute('aria-valuenow') === '100'")) findings.push({ interaction: 'correct-point-not-recognized' });
  await click('.lf-learning-actions .lf-button--accent');
  if (!await page.evaluate("document.querySelector('.lf-number-line-slider').value === '0' && document.querySelector('.lf-learning-progress')?.getAttribute('aria-valuenow') === '0'")) findings.push({ interaction: 'retry-did-not-reset' });
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });

  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Controlled M2 number-line pilot; no signed attempt or server grading.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
