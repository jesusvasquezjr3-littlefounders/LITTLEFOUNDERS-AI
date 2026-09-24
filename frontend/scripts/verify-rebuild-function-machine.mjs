import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-function-machine');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;
const pause = (milliseconds = 0) => new Promise((done) => setTimeout(done, milliseconds));

async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await page.evaluate(expression)) return;
    await pause(25);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function navigate(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'functionmachine', age });
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  const expected = age === '10-12' ? 'function-machine' : 'lesson-unavailable';
  await waitFor(`!!document.querySelector('[data-screen=${JSON.stringify(expected)}]')`);
  await page.evaluate(`document.fonts.ready.then(() => {
    document.documentElement.style.fontSize = '${16 * scale}px';
    let style = document.querySelector('#audit-spacing');
    if (!style) { style = document.createElement('style'); style.id = 'audit-spacing'; document.head.append(style); }
    style.textContent = ${JSON.stringify(spacing ? '.lf-rebuild *{letter-spacing:.12em!important;word-spacing:.16em!important;line-height:1.5!important;}' : '')};
  })`);
  await page.evaluate('window.scrollTo(0, 0); new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))');
  await pause();
}

async function setInput(selector, value) {
  await page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

async function activateWithKeyboard(selector) {
  const focused = await page.evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    button?.focus();
    return document.activeElement === button;
  })()`);
  if (!focused) throw new Error(`Missing keyboard control ${selector}`);
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
    await navigate(locale, theme, '10-12', width, scale, spacing);
    const issues = await page.evaluate(`(() => {
      const root = document.querySelector('[data-screen=function-machine]');
      const issues = [];
      if (!root) return ['wrong-screen'];
      if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll');
      if (root.querySelectorAll('h1').length !== 1) issues.push('heading-count');
      if (!root.querySelector('.lf-function-machine[role=img]') || root.querySelectorAll('.lf-function-machine-table tbody tr').length !== 3 || root.querySelectorAll('.lf-function-machine-table thead th[scope=col]').length !== 2) issues.push('representation-or-table');
      if (root.querySelectorAll('.lf-function-machine-try button[aria-pressed]').length !== 3 || !root.querySelector('.lf-function-machine-try button:not([aria-pressed])')) issues.push('trial-controls');
      if (innerWidth === 375 && ${scale} === 1 && !${spacing} && root.querySelector('.lf-function-machine-try')?.getBoundingClientRect().bottom > 740) issues.push('trial-action-below-first-view');
      for (const element of root.querySelectorAll('button, input')) {
        const box = element.getBoundingClientRect();
        if (box.width < 48 || box.height < 48) issues.push('touch-target');
      }
      for (const element of root.querySelectorAll('[data-copy-role]')) {
        const style = getComputedStyle(element);
        if (element.getBoundingClientRect().width && ((style.overflowX !== 'visible' && element.scrollWidth > element.clientWidth + 1) || (style.overflowY !== 'visible' && element.scrollHeight > element.clientHeight + 1))) issues.push('text-overflow');
      }
      return [...new Set(issues)];
    })()`);
    configurations += 1;
    if (issues.length) findings.push({ locale, theme, width, scale, spacing, issues });
    if (locale === 'es-MX' && width === 375 && scale === 1 && !spacing) {
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(output, `function-machine-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
    }
  }

  await navigate('es-MX', 'light', '10-12', 375, 1, false);
  await setInput('.lf-function-machine-rule label:nth-of-type(1) input', '5');
  await setInput('.lf-function-machine-rule label:nth-of-type(2) input', '10');
  const beforeRun = await page.evaluate("document.querySelector('.lf-learning-actions button')?.disabled");
  await activateWithKeyboard('.lf-function-machine-try button:nth-child(2)');
  await activateWithKeyboard('.lf-function-machine-try button:nth-child(4)');
  await waitFor("document.querySelector('.lf-function-machine[role=img]')?.getAttribute('aria-label')?.includes('Salida: 20')");
  await activateWithKeyboard('.lf-learning-actions button');
  await waitFor("document.querySelector('[role=status]')?.textContent === 'Correcto'");
  if (beforeRun !== true) findings.push({ interaction: 'trial-required', beforeRun });
  const completeShot = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, 'function-machine-complete-375-light.png'), Buffer.from(completeShot.data, 'base64'));

  for (const age of ['6-9', '13-17', 'adult']) {
    await navigate('es-MX', 'light', age, 375, 1, false);
    if (!await page.evaluate("!!document.querySelector('[data-screen=lesson-unavailable]') && !document.querySelector('.lf-function-machine')")) findings.push({ age, issue: 'age-gate' });
  }

  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('es-MX', 'light', '10-12', 375, 1, false);
  if (!await page.evaluate("getComputedStyle(document.querySelector('.lf-function-machine')).transitionDuration === '0s'")) findings.push({ interaction: 'reduced-motion-transition' });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings,
    scope: 'Controlled M13 function-machine candidate. Browser-only visual and interaction evidence; no authenticated fixture, publication or saved progress.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) process.exitCode = 1;
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
  browser.child.kill();
}
