import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-worked-example');
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

async function navigate(locale, theme, age, width, scale, spacing, fade = false) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width, height: 740, deviceScaleFactor: 1, mobile: width < 768,
  });
  const query = new URLSearchParams({ locale, theme, screen: 'workedexample', age });
  if (fade) query.set('fade', '1');
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  const expected = age === '10-12' ? 'worked-example' : 'lesson-unavailable';
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

async function click(selector) {
  const point = await page.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: 'center' });
    const box = element.getBoundingClientRect();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  })()`);
  if (!point) throw new Error(`Missing clickable ${selector}`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

async function setInput(selector, value) {
  await page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
    await navigate(locale, theme, '10-12', width, scale, spacing);
    const issues = await page.evaluate(`(() => {
      const root = document.querySelector('[data-screen=worked-example]');
      const issues = [];
      if (!root) return ['wrong-screen'];
      if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll');
      if (root.querySelectorAll('h1').length !== 1) issues.push('heading-count');
      const rows = root.querySelectorAll('.lf-worked-example-step');
      if (rows.length !== 3 || !rows[0]?.classList.contains('lf-worked-example-step--active')) issues.push('authored-step-states');
      if (!root.querySelector('.lf-step-replay input[type=range]') || !root.querySelector('.lf-worked-example-prediction input')) issues.push('replay-or-prediction-missing');
      if (root.querySelector('.lf-worked-example-blank input')) issues.push('fade-visible-in-full-example');
      if (innerWidth === 375 && ${scale} === 1 && !${spacing} && root.querySelector('.lf-worked-example-prediction button')?.getBoundingClientRect().bottom > 740) issues.push('prediction-action-below-first-view');
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
      writeFileSync(join(output, `worked-example-full-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
    }
  }

  await navigate('es-MX', 'light', '10-12', 375, 1, false);
  const initial = await page.evaluate(`({ revealDisabled: document.querySelector('.lf-worked-example-prediction button')?.disabled, active: document.querySelector('.lf-worked-example-step--active .lf-worked-example-expression')?.textContent })`);
  await setInput('.lf-worked-example-prediction input', '40');
  await click('.lf-worked-example-prediction button');
  await waitFor("document.querySelector('.lf-worked-example-step--active .lf-worked-example-expression')?.textContent === '50 − 10'");
  await setInput('.lf-worked-example-prediction input', '40');
  await click('.lf-worked-example-prediction button');
  await waitFor("document.querySelector('.lf-worked-example-step--active .lf-worked-example-expression')?.textContent === 'Precio final'");
  if (initial.revealDisabled !== true || initial.active !== '20% × 50') findings.push({ interaction: 'prediction-required', initial });

  await page.evaluate("document.querySelector('.lf-step-replay-scrub input')?.focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
  const scrubPoint = await page.evaluate(`(() => { const input = document.querySelector('.lf-step-replay-scrub input'); const box = input.getBoundingClientRect(); return { x: box.x + box.width * .94, y: box.y + box.height / 2 }; })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...scrubPoint, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...scrubPoint, button: 'left', clickCount: 1 });
  if (!await page.evaluate("document.querySelector('.lf-step-replay-scrub input')?.value === '2' && document.querySelector('.lf-worked-example-step--active .lf-worked-example-expression')?.textContent === 'Precio final'")) findings.push({ interaction: 'free-keyboard-and-pointer-scrub' });
  await click('.lf-worked-example-complete button');
  await waitFor("document.querySelector('[role=status]')?.textContent === 'Correcto'");

  await navigate('es-MX', 'light', '10-12', 375, 1, false, true);
  await setInput('.lf-worked-example-prediction input', '40');
  await click('.lf-worked-example-prediction button');
  await waitFor("!!document.querySelector('.lf-worked-example-blank input')");
  await setInput('.lf-worked-example-blank input', '40');
  if (await page.evaluate("document.querySelector('.lf-worked-example-prediction button')?.disabled")) findings.push({ interaction: 'faded-input-does-not-enable-reveal' });
  await click('.lf-worked-example-prediction button');
  await waitFor("document.querySelector('.lf-worked-example-step--active .lf-worked-example-expression')?.textContent === 'Precio final'");
  await click('.lf-worked-example-complete button');
  await waitFor("document.querySelector('[role=status]')?.textContent === 'Correcto'");
  const fadedShot = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, 'worked-example-fade-375-light.png'), Buffer.from(fadedShot.data, 'base64'));

  for (const age of ['6-9', '13-17', 'adult']) {
    await navigate('es-MX', 'light', age, 375, 1, false);
    if (!await page.evaluate("!!document.querySelector('[data-screen=lesson-unavailable]') && !document.querySelector('.lf-worked-example-steps')")) findings.push({ age, issue: 'age-gate' });
  }

  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('es-MX', 'light', '10-12', 375, 1, false);
  if (!await page.evaluate("getComputedStyle(document.querySelector('.lf-worked-example-step')).transitionDuration === '0s'")) findings.push({ interaction: 'reduced-motion-transition' });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings,
    scope: 'Controlled M9/M10 worked-example candidate. Browser-only visual and interaction evidence; no authenticated fixture, publication or saved progress.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) process.exitCode = 1;
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
  browser.child.kill();
}
