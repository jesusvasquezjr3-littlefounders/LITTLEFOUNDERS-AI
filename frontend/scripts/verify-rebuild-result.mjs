import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-result');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, width, scale, spacing, mode = 'result') {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: mode, age: '6-9' }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('[data-screen="result-preview"]')`)) break;
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

try {
  for (const mode of ['result', 'replay']) for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
      await navigate(locale, theme, width, scale, spacing, mode);
      const issues = await page.evaluate(`(() => {
        const issues=[],main=document.querySelector('[data-screen="result-preview"]');
        if(!main) return ['wrong-screen'];
        if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
        if(main.querySelectorAll('h1').length!==1) issues.push('heading-count');
        const medal=main.querySelector('.lf-result-medal');
        if(!medal||!medal.complete||medal.naturalWidth===0) issues.push('medal-missing');
        if(main.querySelectorAll('.lf-result-stat').length!==3) issues.push('stats-missing');
        const bars=[...main.querySelectorAll('[role="progressbar"]')];
        const expected=${JSON.stringify(mode === 'replay' ? ['50','90'] : ['75','75'])};
        if(bars.length!==2||bars.some((b,i)=>b.getAttribute('aria-valuenow')!==expected[i])) issues.push('comparison-invalid');
        const saved=main.querySelector('.lf-result-saved-best');
        if(${mode === 'replay'} ? !saved||!saved.textContent.includes('90%') : !!saved) issues.push('preserved-best-copy-invalid');
        if(!main.textContent.includes(${JSON.stringify(locale === 'en-US' ? 'Sample result' : locale === 'es-MX' ? 'Resultado de ejemplo' : 'Resultado de exemplo')})) issues.push('preview-label-missing');
        const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
        const factor=${locale === 'en-US' ? 1 : 1.25},limits={action:3,heading:6,body:12,prompt:12,option:5,mentor:12,narrative:30};
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
        return issues;
      })()`);
      configurations++;
      if (issues.length) findings.push({ mode, locale, theme, width, scale, spacing, issues });
      if (locale === 'es-MX' && width === 375 && scale === 1 && !spacing) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(output, `${mode}-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  await navigate('es-MX', 'light', 375, 1, false);
  const point = await page.evaluate(`(() => { const e=document.querySelector('.lf-result-sheet .lf-button');e.scrollIntoView({block:'center'});
    const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  if (!await page.evaluate("!!document.querySelector('[data-screen=home]')")) findings.push({ interaction: 'continue-failed' });
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Sample result UI only; no server-issued completion receipt.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
