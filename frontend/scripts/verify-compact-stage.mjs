import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const output = resolve('../audit-results/rebuild-stage');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const cases = [
  { name: 'young-phone', width: 375, height: 740, age: '6-9', dark: false },
  { name: 'young-phone-dark', width: 375, height: 740, age: '6-9', dark: true },
  { name: 'young-phone-reduced', width: 375, height: 740, age: '6-9', dark: false, reduced: true },
  { name: 'young-phone-low-power', width: 375, height: 740, age: '6-9', dark: false, lowPower: true },
  { name: 'teen-phone', width: 375, height: 740, age: '13-17', dark: false },
  { name: 'teen-phone-dark', width: 375, height: 740, age: '13-17', dark: true },
  { name: 'tablet', width: 768, height: 900, age: '10-12', dark: false },
  { name: 'adult-desktop-light', width: 1280, height: 800, age: 'adult', dark: false },
  { name: 'adult-desktop-dark', width: 1280, height: 800, age: 'adult', dark: true },
  { name: 'adult-desktop-dark-reduced', width: 1280, height: 800, age: 'adult', dark: true, reduced: true },
];
let failures = 0;
const page = await openPage(browser.browser, cases[0]);
async function click(selector) {
  const point = await page.evaluate(`(() => {
    const control = document.querySelector(${JSON.stringify(selector)});
    if (!control) throw Error('Missing control');
    control.scrollIntoView({ block: 'center' });
    const rect = control.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    if (!control.contains(document.elementFromPoint(x, y))) throw Error('Control occluded');
    return { x, y };
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
try {
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__stageErrors=[];window.addEventListener('error',e=>window.__stageErrors.push(String(e.error?.stack||e.message)));window.addEventListener('unhandledrejection',e=>window.__stageErrors.push(String(e.reason?.stack||e.reason)));" });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: "if(location.search.includes('lowPower=1')) { Object.defineProperty(navigator,'deviceMemory',{get:()=>2}); Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>2}); }" });
  for (const scenario of cases) {
      page.errors.length = 0;
      page.failedRequests.length = 0;
      await page.send('Emulation.setDeviceMetricsOverride', { width: scenario.width, height: scenario.height, deviceScaleFactor: 1, mobile: scenario.width < 768 });
      await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scenario.dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: scenario.reduced ? 'reduce' : 'no-preference' }] });
      await page.send('Page.navigate', { url: `http://127.0.0.1:5190/rebuild.html?locale=es-MX&theme=${scenario.dark ? 'dark' : 'light'}&screen=lesson&age=${scenario.age}&stage=1${scenario.lowPower ? '&lowPower=1' : ''}` });
      for (let n = 0; n < 200; n++) {
        if (page.errors.length) break;
        if (await page.evaluate(scenario.reduced || scenario.lowPower ? "document.querySelector('.lf-mentor-band')?.dataset.renderMode === 'still' && !!document.querySelector('.lf-mentor-band-still')?.complete" : "!!document.querySelector('.lf-mentor-band canvas') && !document.querySelector('.lf-mentor-band-still')")) break;
        await new Promise((done) => setTimeout(done, 50));
      }
      await new Promise((done) => setTimeout(done, 800));
      const state = await page.evaluate(`(() => {
        const rect = (selector) => { const node = document.querySelector(selector); if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
        const clippedLabels = [...document.querySelectorAll('.lf-learning-control-label > *')].filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.textContent);
        return { main: !!document.querySelector('.lf-learning'), canvas: !!document.querySelector('.lf-mentor-band canvas'), renderMode: document.querySelector('.lf-mentor-band')?.dataset.renderMode, stillLoaded: !!document.querySelector('.lf-mentor-band-still')?.naturalWidth, ready: !document.querySelector('.lf-mentor-band-still'), band: rect('.lf-mentor-band'), question: rect('.lf-learning-intro'), firstAnswer: rect('.lf-learning-control'), horizontalOverflow: document.documentElement.scrollWidth > innerWidth, clippedLabels, errors: window.__stageErrors ?? [] };
      })()`);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(output, `${scenario.name}.png`), Buffer.from(shot.data, 'base64'));
      if (state.band && ['young-phone', 'young-phone-dark', 'teen-phone', 'teen-phone-dark', 'adult-desktop-light', 'adult-desktop-dark'].includes(scenario.name)) {
        const clip = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: state.band.x, y: state.band.y, width: state.band.width, height: state.band.height, scale: 1 }, captureBeyondViewport: false });
        writeFileSync(join(output, `${scenario.name}-stage.png`), Buffer.from(clip.data, 'base64'));
      }
      const rendered = scenario.reduced || scenario.lowPower ? state.renderMode === 'still' && !state.canvas && state.stillLoaded : state.renderMode === '3d' && state.canvas && state.ready;
      const ok = state.main && rendered && state.band && state.firstAnswer && !state.horizontalOverflow && !state.clippedLabels.length
        && (scenario.width < 640 ? state.firstAnswer.y < scenario.height && state.band.height <= scenario.height * (scenario.age === '13-17' ? .15 : .3) : state.band.x < state.question.x)
        && !state.errors.length && !page.errors.length && !page.failedRequests.length;
      if (!ok) failures++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${scenario.name} ${JSON.stringify({ state, consoleErrors: page.errors, failedRequests: page.failedRequests })}`);
      if (scenario.name === 'young-phone') {
        for (let i = 0; i < 4; i++) await click('button[aria-label="Añadir: Guardar"]');
        for (let i = 0; i < 8; i++) await click('button[aria-label="Añadir: Gastar"]');
        await click('.lf-learning-actions .lf-button--accent');
        if (!await page.evaluate("document.querySelector('.lf-mentor-band')?.dataset.mentorState === 'happy'")) failures++;
        await click('.lf-learning-actions .lf-button--accent');
        for (let i = 0; i < 12; i++) await click('button[aria-label="Añadir: Gastar"]');
        await click('.lf-learning-actions .lf-button--accent');
        if (!await page.evaluate("document.querySelector('.lf-mentor-band')?.dataset.mentorState === 'encouraging'")) failures++;
      }
  }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
  browser.child.kill();
}
if (failures) process.exitCode = 1;
