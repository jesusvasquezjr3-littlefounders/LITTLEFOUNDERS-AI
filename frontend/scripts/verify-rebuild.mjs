import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function click(selector) {
  const point = await page.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    e.scrollIntoView({block:'center'});
    const r = e.getBoundingClientRect();
    const x = r.x + r.width/2, y = r.y + r.height/2;
    if (!e.contains(document.elementFromPoint(x,y))) throw new Error('Control is occluded');
    return {x,y};
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

async function navigate(query) {
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`!!document.querySelector('.lf-rebuild') && location.search === ${JSON.stringify('?' + query)}`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  if (!await page.evaluate("document.fonts.check('600 16px Fredoka') && document.fonts.check('500 16px Nunito')")) throw Error('Fonts did not load');
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) {
    for (const screen of ['home', 'practice', 'controls']) {
      await navigate(new URLSearchParams({ locale, theme, screen }).toString());
      for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
        await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
        await page.evaluate(`(() => {
          document.documentElement.style.fontSize = '${16 * scale}px';
          let style=document.getElementById('audit-spacing');
          if (!style) { style=document.createElement('style');style.id='audit-spacing';document.head.append(style); }
          style.textContent=${JSON.stringify(spacing ? '.lf-rebuild * { letter-spacing:.12em !important; word-spacing:.16em !important; line-height:1.5 !important; }' : '')};
          window.scrollTo(0,0);
        })()`);
        await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        const issues = await page.evaluate(`(() => {
          const issues=[];
          const root=document.querySelector('.lf-rebuild'), main=root.querySelector('main');
          if(!main || main.dataset.screen!==${JSON.stringify(screen)}) return ['wrong-screen'];
          if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
          if(main.querySelectorAll('h1').length!==1) issues.push('heading-count');
          const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
          let fold=0;
          for(const e of root.querySelectorAll('[data-copy-role]')) {
            if(e.tagName==='OPTION') continue;
            const r=e.getBoundingClientRect(), s=getComputedStyle(e);
            if(!r.width || !r.height) continue;
            const role=e.dataset.copyRole;
            const limits={action:3,heading:6,body:12,prompt:12,option:5,mentor:12,narrative:30};
            const text=e.textContent.trim();
            if(role in limits && words(text)>Math.ceil(limits[role]*${locale === 'en-US' ? 1 : 1.25})) issues.push('copy:'+role+':'+text);
            if(s.textOverflow==='ellipsis' || !['none',''].includes(s.webkitLineClamp)) issues.push('truncation:'+text);
            // Match the reference audit: visible font ink outside a line box is not clipped.
            if((s.overflowX!=='visible' && e.scrollWidth>e.clientWidth+1) || (s.overflowY!=='visible' && e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+text);
            if(parseFloat(s.fontSize)<14) issues.push('text-size:'+text);
            if(main.contains(e) && r.top<740 && r.bottom>0 && !['data','brand','legal'].includes(role)) fold+=words(text);
          }
          if(${width === 375 && scale === 1 && !spacing} && fold>Math.ceil(25*${locale === 'en-US' ? 1 : 1.25})) issues.push('first-view:'+fold);
          for(const e of root.querySelectorAll('button,input,select')) {
            const r=e.getBoundingClientRect();
            if(r.width<48 || r.height<48) issues.push('touch-target:'+e.tagName);
          }
          return issues;
        })()`);
        configurations++;
        if (issues.length) findings.push({ locale, theme, screen, width, scale, spacing, issues });
        if ([375, 1280].includes(width) && scale === 1 && !spacing && locale === 'es-MX') {
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(join(output, `${screen}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
    }
    await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 740, deviceScaleFactor: 1, mobile: true });
    await navigate(new URLSearchParams({ locale, theme, screen: 'practice' }).toString());
    await click('.lf-choice:nth-child(2)');
    await click('.lf-preview-content > .lf-button--accent');
    if (!await page.evaluate("!!document.querySelector('.lf-feedback .lf-banner--retry')")) throw Error('Miss feedback missing');
    await click('.lf-preview-content > .lf-button--accent');
    await click('.lf-choice:first-child');
    await click('.lf-preview-content > .lf-button--accent');
    if (!await page.evaluate("!!document.querySelector('.lf-feedback .lf-banner--success')")) throw Error('Correct feedback missing');
    await navigate(new URLSearchParams({ locale, theme, screen: 'controls' }).toString());
    await click('form button');
    if (!await page.evaluate("document.querySelector('input').getAttribute('aria-invalid')==='true'")) throw Error('Field error missing');
    await click('input');
    await page.send('Input.insertText', { text: 'A bicycle' });
    await click('form button');
    if (!await page.evaluate("!!document.querySelector('form [role=status] p')")) throw Error('Form confirmation missing');
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (!await page.evaluate("getComputedStyle(document.querySelector('.lf-button')).transitionDuration === '0s'")) throw Error('Reduced motion is not honored');
    await page.send('Emulation.setEmulatedMedia', { features: [] });
  }
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Foundation preview only; not the full product or full reference composition audit.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 8), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
