import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-lesson-states');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;
const headings = {
  upgrade: { 'en-US': 'This lesson needs an update.', 'es-MX': 'Esta lección necesita una actualización.',
    'pt-BR': 'Esta lição precisa de atualização.' },
  invalid: { 'en-US': 'This lesson cannot open.', 'es-MX': 'Esta lección no se puede abrir.',
    'pt-BR': 'Esta lição não pode ser aberta.' },
};

async function navigate(mode, locale, theme, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: mode, age: '6-9' }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  const expected = mode === 'upgrade' ? 'lesson-upgrade' : 'lesson-unavailable';
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector(${JSON.stringify(`[data-screen="${expected}"]`)})`)) break;
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
  for (const mode of ['upgrade', 'invalid']) for (const locale of ['en-US', 'es-MX', 'pt-BR'])
    for (const theme of ['light', 'dark']) for (const width of [320, 375, 768, 1280])
      for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
        await navigate(mode, locale, theme, width, scale, spacing);
        const issues = await page.evaluate(`(() => {
          const issues=[],main=document.querySelector('main');
          if(!main||main.dataset.screen!==${JSON.stringify(mode === 'upgrade' ? 'lesson-upgrade' : 'lesson-unavailable')}) return ['wrong-screen'];
          const h=main.querySelector('h1'),b=main.querySelector('button');
          if(!h||h.textContent.trim()!==${JSON.stringify(headings[mode][locale])}) issues.push('wrong-heading');
          if(!h||h.dataset.copyRole!=='heading'||!b||b.dataset.copyRole!=='action') issues.push('copy-role');
          if(main.querySelector('input,svg,[role="progressbar"],.lf-learning-board')) issues.push('exercise-leaked');
          if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
          if(b){const r=b.getBoundingClientRect();if(r.width<48||r.height<48) issues.push('touch-target');}
          for(const e of main.querySelectorAll('[data-copy-role]')){
            const r=e.getBoundingClientRect(),s=getComputedStyle(e);
            if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow');
            if(parseFloat(s.fontSize)<14) issues.push('text-size');
            if(r.right>innerWidth+1||r.left<0) issues.push('text-outside-viewport');
          }
          return issues;
        })()`);
        configurations++;
        if (issues.length) findings.push({ mode, locale, theme, width, scale, spacing, issues });
        if (locale === 'es-MX' && width === 375 && scale === 1 && !spacing) {
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          writeFileSync(join(output, `${mode}-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
  for (const mode of ['upgrade', 'invalid']) {
    await navigate(mode, 'es-MX', 'light', 375, 1, false);
    if (mode === 'upgrade') {
      const point = await page.evaluate(`(() => {const r=document.querySelector('main button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    } else {
      await page.evaluate("document.querySelector('main button').focus()");
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    }
    if (!await page.evaluate("!!document.querySelector('[data-screen=home]')")) findings.push({ mode, interaction: 'back-failed' });
  }
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Isolated client document refusal UI only.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 10), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
