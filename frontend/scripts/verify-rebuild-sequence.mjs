import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-sequence');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'sequence', age: '6-9' }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('[data-screen="timeline"]')`)) break;
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
    const e=document.querySelector(${JSON.stringify(selector)});if(!e) throw Error('Missing control: ${selector}');
    e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    if(!e.contains(document.elementFromPoint(x,y))) throw Error('Control is occluded: ${selector}');return {x,y};
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

async function auditScreen(screen, locale, width, scale, spacing) {
  return page.evaluate(`(() => {
    const issues=[],main=document.querySelector('[data-screen="${screen}"]');
    if(!main) return ['wrong-screen'];
    if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
    if(main.querySelectorAll('h1').length!==1) issues.push('heading-count');
    if(main.querySelector('h1')?.getBoundingClientRect().top<0) issues.push('heading-above-view');
    const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
    const factor=${locale === 'en-US' ? 1 : 1.25};
    const limits={action:3,heading:6,body:12,prompt:12,option:5,mentor:12,narrative:30};
    let fold=0;
    for(const e of main.querySelectorAll('[data-copy-role]')) {
      const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height) continue;
      const role=e.dataset.copyRole,text=e.textContent.trim();
      if(role in limits&&words(text)>Math.ceil(limits[role]*factor)) issues.push('copy:'+role+':'+text);
      if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+text);
      if(parseFloat(s.fontSize)<14) issues.push('text-size:'+text);
      if(r.top<740&&r.bottom>0&&!['data','brand','legal'].includes(role)) fold+=words(text);
    }
    if(${width}===375&&${scale}===1&&!${spacing}&&fold>Math.ceil(25*factor)) issues.push('first-view:'+fold);
    for(const e of main.querySelectorAll('button')){const r=e.getBoundingClientRect();if(r.width<48||r.height<48) issues.push('touch-target');}
    const progress=main.querySelector('[role="progressbar"]');
    if(progress?.getAttribute('aria-valuenow')!==${JSON.stringify(screen === 'timeline' ? '0' : '50')}) issues.push('progress');
    if(${width}===375&&${scale}===1&&!${spacing}) {
      const control=main.querySelector(${JSON.stringify(screen === 'timeline' ? 'input[type="range"]' : 'button[aria-label*="Save"],button[aria-label*="Guardar"],button[aria-label*="Guardar"]')});
      if(!control||control.getBoundingClientRect().bottom>740) issues.push('first-control-below-view');
    }
    return issues;
  })()`);
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
      await navigate(locale, theme, width, scale, spacing);
      const first = await auditScreen('timeline', locale, width, scale, spacing);
      await page.evaluate("document.querySelector('input[type=range]').focus()");
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      if (!await page.evaluate("document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')==='50'")) first.push('exploration-progress');
      await click('.lf-growth-foot .lf-button--accent');
      const second = await auditScreen('lesson', locale, width, scale, spacing);
      configurations++;
      if (first.length || second.length) findings.push({ locale, theme, width, scale, spacing, first, second });
      if (locale === 'es-MX' && width === 375 && scale === 1 && !spacing) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(output, `allocation-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  await navigate('es-MX', 'light', 375, 1, false);
  const firstShot = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, 'exploration-375-light.png'), Buffer.from(firstShot.data, 'base64'));
  await page.evaluate("document.querySelector('input[type=range]').focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await click('.lf-growth-foot .lf-button--accent');
  for (let i = 0; i < 12; i++) await click('button[aria-label="Añadir: Guardar"]');
  await click('.lf-learning-actions .lf-button--accent');
  await page.evaluate('new Promise(r=>setTimeout(r,100))');
  if (!await page.evaluate("document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')==='100'")) findings.push({ interaction: 'scored-segment-progress' });
  await click('.lf-learning-actions .lf-button--accent');
  if (!await page.evaluate("document.querySelector('[data-screen=lesson-preview-end]')?.textContent.includes('El progreso no se guarda.')")) findings.push({ interaction: 'preview-end-missing' });
  const endShot = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, 'end-375-light.png'), Buffer.from(endShot.data, 'base64'));
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });

  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Two-activity visual preview; no server completion or saved progress.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
