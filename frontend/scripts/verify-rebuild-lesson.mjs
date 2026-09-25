import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-lesson');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, age, width, spacing, scale = 1) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'lesson', age }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`!!document.querySelector('.lf-learning') && location.search === ${JSON.stringify('?' + query)}`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate(`(() => {
    document.documentElement.style.fontSize = '${16 * scale}px';
    let style=document.getElementById('audit-spacing');
    if (!style) { style=document.createElement('style'); style.id='audit-spacing'; document.head.append(style); }
    style.textContent=${JSON.stringify(spacing ? '.lf-rebuild * { letter-spacing:.12em !important; word-spacing:.16em !important; line-height:1.5 !important; }' : '')};
  })()`);
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

async function click(selector) {
  const point = await page.evaluate(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)});
    if(!e) throw Error('Missing control');
    e.scrollIntoView({block:'center'});
    const r=e.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
    if(!e.contains(document.elementFromPoint(x,y))) throw Error('Control is occluded');
    return {x,y};
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

try {
  if (!process.argv.includes('--interaction-only')) {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) for (const age of ['6-9', '10-12', '13-17', 'adult']) for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
    await navigate(locale, theme, age, width, spacing, scale);
    const issues = await page.evaluate(`(() => {
      const issues=[], root=document.querySelector('.lf-rebuild'), main=root?.querySelector('main');
      if(!main || main.dataset.screen!=='lesson') return ['wrong-screen'];
      if(${age === 'adult'}&&!main.querySelector('[role="img"]')?.getAttribute('aria-label')?.includes(${JSON.stringify({ 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' }[locale])})) issues.push('currency-code-missing');
      if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
      if(main.querySelectorAll('h1').length!==1) issues.push('heading-count');
      const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
      const scale=${locale === 'en-US' ? 1 : 1.25};
      const young=${age === '6-9'};
      const limits={action:3,heading:6,body:12,prompt:young?12:20,option:young?5:8,mentor:young?12:20,narrative:30};
      let fold=0;
      for(const e of main.querySelectorAll('[data-copy-role]')) {
        const r=e.getBoundingClientRect(), s=getComputedStyle(e);
        if(!r.width || !r.height) continue;
        const role=e.dataset.copyRole, text=e.textContent.trim();
        if(role in limits && words(text)>Math.ceil(limits[role]*scale)) issues.push('copy:'+role+':'+text);
        if((s.overflowX!=='visible' && e.scrollWidth>e.clientWidth+1) || (s.overflowY!=='visible' && e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+text);
        if(parseFloat(s.fontSize)<14) issues.push('text-size:'+text);
        if(r.top<740 && r.bottom>0 && !['data','brand','legal'].includes(role)) fold+=words(text);
      }
      if(innerWidth===375 && !${spacing} && ${scale}===1 && fold>Math.ceil((young?25:40)*scale)) issues.push('first-view:'+fold);
      for(const e of main.querySelectorAll('button')) {
        const r=e.getBoundingClientRect();
        if(r.width<48 || r.height<48) issues.push('touch-target:'+e.getAttribute('aria-label'));
      }
      const action=main.querySelector('.lf-learning-actions .lf-button--accent')?.getBoundingClientRect();
      if(innerWidth===375 && !${spacing} && ${scale}===1 && action?.bottom>740) issues.push('action-below-first-view');
      return issues;
    })()`);
    configurations++;
    if (issues.length) findings.push({ locale, theme, age, width, scale, spacing, issues });
    if (locale === 'es-MX' && theme === 'light' && !spacing && scale === 1 && [375, 1280].includes(width)) {
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(output, `${age}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
    if (locale === 'es-MX' && theme === 'dark' && !spacing && scale === 1 && width === 375 && ['6-9', 'adult'].includes(age)) {
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(output, `${age}-375-dark.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  }

  await navigate('es-MX', 'light', '6-9', 375, false);
  await click('.lf-learning-view-toggle');
  if (!await page.evaluate("document.querySelectorAll('.lf-learning-table tbody tr').length === 4 && document.querySelector('.lf-learning-view-toggle').textContent === 'Ver gráfico' && !document.querySelector('.lf-learning-view-toggle').hasAttribute('aria-pressed')")) findings.push({ interaction: 'table-alternative-missing' });
  if (!await page.evaluate("document.querySelector('.lf-learning-actions .lf-button--accent').getBoundingClientRect().bottom <= 740")) findings.push({ interaction: 'table-pushed-action-below-first-view' });
  await click('.lf-learning-view-toggle');
  for (let i=0;i<4;i++) await click('button[aria-label="Guardar: Añadir"]');
  for (let i=0;i<8;i++) await click('button[aria-label="Gastar: Añadir"]');
  await navigate('es-MX', 'light', '6-9', 375, false);
  if (!await page.evaluate("document.querySelector('.lf-learning-control .lf-stepper-value')?.textContent === '4 monedas'")) findings.push({ interaction: 'checkpoint-not-restored' });
  if (await page.evaluate("!document.querySelector('button[aria-label=\"Compartir: Añadir\"]').disabled")) findings.push({ interaction: 'overspending-control-remained-enabled' });
  await click('.lf-learning-view-toggle');
  if (!await page.evaluate("document.querySelector('.lf-learning-table tbody tr:first-child td')?.textContent === '4 monedas'")) findings.push({ interaction: 'table-does-not-track-controls' });
  writeFileSync(join(output, '6-9-375-table.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await click('.lf-learning-view-toggle');
  await click('.lf-learning-actions .lf-button--accent');
  if (!await page.evaluate("!!document.querySelector('.lf-learning-feedback--met')")) findings.push({ interaction: 'valid-plan-not-recognized' });
  if (!await page.evaluate("document.querySelector('.lf-learning-progress [role=progressbar]')?.getAttribute('aria-valuenow') === '100'")) findings.push({ interaction: 'completed-progress-not-announced' });
  writeFileSync(join(output, '6-9-375-result.png'), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await click('.lf-learning-actions .lf-button--accent');
  if (!await page.evaluate("document.querySelector('.lf-learning-progress [role=progressbar]')?.getAttribute('aria-valuenow') === '0'")) findings.push({ interaction: 'retry-progress-not-reset' });
  for (let i=0;i<12;i++) await click('button[aria-label="Gastar: Añadir"]');
  await click('.lf-learning-actions .lf-button--accent');
  if (!await page.evaluate("!!document.querySelector('.lf-learning-feedback--review')")) findings.push({ interaction: 'wrong-plan-not-explained' });
  for (let i=0;i<4;i++) await click('button[aria-label="Gastar: Quitar"]');
  for (let i=0;i<4;i++) await click('button[aria-label="Guardar: Añadir"]');
  await click('.lf-learning-actions .lf-button--accent');
  if (!await page.evaluate("!!document.querySelector('.lf-learning-feedback--met')")) findings.push({ interaction: 'revised-plan-not-recognized' });
  await click('.lf-learning-sliders .lf-slider:last-child input');
  if (!await page.evaluate("Number(document.querySelectorAll('.lf-learning-sliders input')[1]?.value) < 12 && document.querySelector('.lf-learning-left strong')?.textContent === '0 monedas'")) findings.push({ interaction: 'drag-reallocation-did-not-preserve-total' });
  const savedBeforeKey = await page.evaluate("Number(document.querySelector('.lf-learning-sliders input')?.value)");
  await page.evaluate("document.querySelector('.lf-learning-sliders input').focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  if (!await page.evaluate(`Number(document.querySelector('.lf-learning-sliders input')?.value) === ${savedBeforeKey + 1} && document.querySelector('.lf-learning-left strong')?.textContent === '0 monedas'`)) findings.push({ interaction: 'keyboard-reallocation-did-not-preserve-total' });
  await click('.lf-learning-view-toggle');
  if (!await page.evaluate("document.querySelectorAll('.lf-learning-table tbody tr').length === 4 && document.querySelector('.lf-learning-table tbody tr:first-child td')?.textContent === document.querySelector('.lf-learning-control .lf-stepper-value')?.textContent")) findings.push({ interaction: 'reallocated-table-not-synchronized' });
  await click('.lf-learning-control-bar .lf-button');
  await page.evaluate("document.querySelector('button[aria-label=\"Guardar: Añadir\"]').focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  if (!await page.evaluate("document.querySelector('.lf-learning-control .lf-stepper-value')?.textContent === '1 moneda'")) findings.push({ interaction: 'keyboard-stepper-failed', state: await page.evaluate("({ value: document.querySelector('.lf-learning-control .lf-stepper-value')?.textContent, focus: document.activeElement?.getAttribute('aria-label') })") });
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });

  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Controlled new Lesson Engine UI fixture; not a published lesson or full SPEC acceptance.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 10), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
