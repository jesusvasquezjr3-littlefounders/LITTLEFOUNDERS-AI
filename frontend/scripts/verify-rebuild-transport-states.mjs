import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-transport-states');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;
const screens = { opening: 'lesson-opening', offline: 'lesson-offline', loaderror: 'lesson-load-error' };
const headings = {
  opening: { 'en-US': 'Opening lesson', 'es-MX': 'Abriendo la lección', 'pt-BR': 'Abrindo a lição' },
  offline: { 'en-US': 'Connection lost', 'es-MX': 'Sin conexión', 'pt-BR': 'Sem conexão' },
  loaderror: { 'en-US': 'Lesson unavailable', 'es-MX': 'Lección no disponible', 'pt-BR': 'Lição indisponível' },
};

async function navigate(mode, locale, theme, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: mode, age: '6-9' }).toString();
  const previousDocument = await page.evaluate('performance.timeOrigin');
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`performance.timeOrigin!==${previousDocument} && location.search===${JSON.stringify('?' + query)}
      && !!document.querySelector(${JSON.stringify(`[data-screen="${screens[mode]}"]`)})`)) break;
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

async function activate(selector, keyboard = false) {
  if (keyboard) {
    await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  } else {
    const point = await page.evaluate(`(() => {
      const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();
      const x=r.x+r.width/2,y=r.y+r.height/2;
      if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded action');
      return {x,y};
    })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  }
}

try {
  for (const mode of Object.keys(screens)) for (const locale of ['en-US', 'es-MX', 'pt-BR'])
    for (const theme of ['light', 'dark']) for (const width of [320, 375, 768, 1280])
      for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
        await navigate(mode, locale, theme, width, scale, spacing);
        const issues = await page.evaluate(`(() => {
          const issues=[],main=document.querySelector(${JSON.stringify(`[data-screen="${screens[mode]}"]`)});
          if(!main) return ['wrong-screen'];
          const h=main.querySelector('h1'),body=main.querySelector('p'),actions=[...main.querySelectorAll('button')];
          if(h?.textContent?.trim()!==${JSON.stringify(headings[mode][locale])}) issues.push('heading');
          if(h?.dataset.copyRole!=='heading'||body?.dataset.copyRole!=='body'
            ||actions.some(b=>b.dataset.copyRole!=='action')) issues.push('copy-roles');
          if(actions.length!==${mode === 'opening' ? 1 : 2}) issues.push('action-count');
          if(main.getAttribute('aria-busy')!==${JSON.stringify(mode === 'opening' ? 'true' : 'false')}) issues.push('busy-state');
          const progress=main.querySelector('[role="progressbar"]');
          if(${mode === 'opening'} ? !progress||progress.getAttribute('aria-label')!==h?.textContent : !!progress)
            issues.push('progress-state');
          if(main.querySelector('.lf-learning-board,input,svg')) issues.push('exercise-leaked');
          if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
          const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
          const factor=${locale === 'en-US' ? 1 : 1.25}; let fold=0;
          for(const e of main.querySelectorAll('[data-copy-role]')) {
            const r=e.getBoundingClientRect(),s=getComputedStyle(e),role=e.dataset.copyRole,text=e.textContent.trim();
            if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)
              ||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+role);
            if(r.left<0||r.right>innerWidth+1) issues.push('text-outside:'+role);
            if(parseFloat(s.fontSize)<14) issues.push('text-size:'+role);
            if(role==='heading'&&words(text)>Math.ceil(6*factor)) issues.push('copy-heading');
            if(role==='body'&&words(text)>Math.ceil(12*factor)) issues.push('copy-body');
            if(role==='action'&&words(text)>Math.ceil(3*factor)) issues.push('copy-action');
            if(r.top<740&&r.bottom>0) fold+=words(text);
          }
          if(innerWidth===375&&${scale}===1&&!${spacing}&&fold>25) issues.push('first-view-copy:'+fold);
          for(const b of actions){const r=b.getBoundingClientRect();
            if(r.width<48||r.height<48) issues.push('touch-target');
            if(innerWidth===375&&${scale}===1&&!${spacing}&&r.bottom>740) issues.push('action-below-first-view');
          }
          return [...new Set(issues)];
        })()`);
        configurations++;
        if (issues.length) findings.push({ mode, locale, theme, width, scale, spacing, issues });
        if (locale === 'es-MX' && width === 375 && scale === 1 && !spacing) {
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(join(output, `${mode}-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
        }
      }

  await navigate('offline', 'es-MX', 'light', 375, 1, false);
  await activate('.lf-transport-state-actions button:first-child');
  if (!await page.evaluate("!!document.querySelector('[data-screen=lesson]')"))
    findings.push({ interaction: 'offline-retry-failed' });
  await navigate('loaderror', 'es-MX', 'light', 375, 1, false);
  await activate('.lf-transport-state-actions button:last-child', true);
  if (!await page.evaluate("!!document.querySelector('[data-screen=home]')"))
    findings.push({ interaction: 'load-error-keyboard-back-failed' });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('opening', 'es-MX', 'dark', 375, 1, false);
  if (!await page.evaluate("getComputedStyle(document.querySelector('.lf-transport-state-progress span')).animationName==='none'"))
    findings.push({ interaction: 'reduced-motion-loading' });
  await activate('.lf-transport-state-actions button', true);
  if (!await page.evaluate("!!document.querySelector('[data-screen=home]')"))
    findings.push({ interaction: 'opening-keyboard-back-failed' });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings,
    scope: 'Controlled lesson transport-state presentation; no server attempt, saved progress or retry network contract.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
