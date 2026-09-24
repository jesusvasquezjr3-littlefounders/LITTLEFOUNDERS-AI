import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-rule');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'rulebuilder', age }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`location.search===${JSON.stringify('?' + query)} && !!document.querySelector('[data-screen="${age === '10-12' ? 'savings-rule' : 'lesson-unavailable'}"]')`)) break;
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
  const point = await page.evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e) throw Error('Missing control');
    e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded control');return {x,y};})()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
      await navigate(locale, theme, '10-12', width, scale, spacing);
      const issues = await page.evaluate(`(() => {
        const issues=[],main=document.querySelector('[data-screen="savings-rule"]');
        if(!main) return ['wrong-screen'];
        if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
        if(main.querySelectorAll('h1').length!==1) issues.push('heading-count');
        if(!main.querySelector('[role="img"]')?.getAttribute('aria-label')?.includes('1')) issues.push('graphic-description');
        if(main.querySelectorAll('.lf-rule-node').length!==2) issues.push('rule-nodes');
        const rgb=value=>(value.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
        const luminance=value=>{const c=rgb(value).map(n=>{const x=n/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
        for(const selector of ['.lf-rule-node','.lf-rule-links .lf-button','.lf-rule-cases .lf-button:not(:disabled)']) {
          const e=main.querySelector(selector);if(!e){issues.push('contrast-target-missing:'+selector);continue;}
          const s=getComputedStyle(e),a=luminance(s.color),b=luminance(s.backgroundColor),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
          if(ratio<4.5) issues.push('text-contrast:'+selector+':'+ratio.toFixed(2));
        }
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
        for(const e of main.querySelectorAll('button')) {const r=e.getBoundingClientRect();if(r.width<48||r.height<48) issues.push('touch-target');}
        if(innerWidth===375&&${scale}===1&&!${spacing}&&main.querySelector('.lf-rule-links')?.getBoundingClientRect().bottom>740) issues.push('operator-below-first-view');
        return issues;
      })()`);
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, scale, spacing, issues });
      if (locale === 'es-MX' && width === 375 && scale === 1 && !spacing) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(output, `savings-rule-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  await navigate('es-MX', 'light', '10-12', 375, 1, false);
  await click('.lf-rule-links button:first-child');
  await click('.lf-rule-cases button:last-child');
  if (!await page.evaluate("document.querySelector('.lf-rule-foot')?.textContent?.includes('La regla dice: espera')")) findings.push({ interaction: 'and-case-2' });
  await click('.lf-rule-links button:last-child');
  if (!await page.evaluate("document.querySelector('.lf-rule-foot')?.textContent?.includes('La regla dice: lista') && document.querySelector('.lf-rule-links button:last-child')?.getAttribute('aria-pressed')==='true'")) findings.push({ interaction: 'or-case-2' });
  const selectedContrast = await page.evaluate(`(() => {
    const s=getComputedStyle(document.querySelector('.lf-rule-links button[aria-pressed="true"]'));
    const rgb=v=>(v.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
    const lum=v=>{const c=rgb(v).map(n=>{const x=n/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
    const a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  })()`);
  if (selectedContrast < 4.5) findings.push({ interaction: 'selected-button-contrast', ratio: selectedContrast });
  await page.evaluate('window.scrollTo(0,0)');
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const orShot = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, 'savings-rule-or-case-2-375-light.png'), Buffer.from(orShot.data, 'base64'));
  await click('.lf-learning-view-toggle');
  if (!await page.evaluate("document.querySelectorAll('.lf-learning-table tbody tr').length===4 && document.querySelector('.lf-learning-table tbody tr:nth-child(2) td')?.textContent==='La regla dice: lista'")) findings.push({ interaction: 'table-cases' });
  await page.evaluate("document.querySelector('.lf-rule-cases button:last-child').focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  if (!await page.evaluate("document.querySelector('.lf-rule-cases span')?.textContent?.includes('3/4')")) findings.push({ interaction: 'keyboard-next' });
  for (const age of ['6-9', '13-17', 'adult']) {
    await navigate('es-MX', 'light', age, 375, 1, false);
    if (!await page.evaluate("!!document.querySelector('[data-screen=lesson-unavailable]') && !document.querySelector('.lf-rule-links')")) findings.push({ age, issue: 'age-gate' });
  }
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Controlled L2 rule pilot; no server grading or progress.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
