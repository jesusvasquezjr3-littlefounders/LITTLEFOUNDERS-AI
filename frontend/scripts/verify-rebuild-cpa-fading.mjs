import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-cpa-fading');
mkdirSync(output, { recursive: true });
let browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
let page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;
let currentConfiguration = null;
const pause = (milliseconds = 0) => new Promise((done) => setTimeout(done, milliseconds));

async function restartBrowser(name) {
  page.ws.close();
  browser.child.kill();
  browser = await launchBrowser(mkdtempSync(join(output, name)));
  page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
}

async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await page.evaluate(expression)) return;
    await pause(25);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function navigate(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'cpafading', age });
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  const expected = age === '6-9' || age === '10-12' ? 'cpa-fading' : 'lesson-unavailable';
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

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
    const age = '6-9';
    currentConfiguration = { locale, theme, age, width, scale, spacing };
    await navigate(locale, theme, age, width, scale, spacing);
    const issues = await page.evaluate(`(() => {
      const root = document.querySelector('[data-screen=cpa-fading]'); const issues = [];
      if (!root) return ['wrong-screen'];
      if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll');
      if (root.querySelectorAll('h1').length !== 1) issues.push('heading-count');
      if (root.querySelector('[data-cpa-stage=concrete]') === null || root.querySelectorAll('.lf-cpa-dots span').length < 2) issues.push('concrete-representation');
      if (!root.querySelector('.lf-cpa-answer input')) issues.push('symbolic-input');
      if (innerWidth === 375 && ${scale} === 1 && !${spacing} && root.querySelector('.lf-cpa-answer')?.getBoundingClientRect().bottom > 740) issues.push('answer-below-first-view');
      for (const element of root.querySelectorAll('button, input')) { const box = element.getBoundingClientRect(); if (box.width < 48 || box.height < 48) issues.push('touch-target'); }
      for (const element of root.querySelectorAll('[data-copy-role]')) { const style = getComputedStyle(element); if (element.getBoundingClientRect().width && ((style.overflowX !== 'visible' && element.scrollWidth > element.clientWidth + 1) || (style.overflowY !== 'visible' && element.scrollHeight > element.clientHeight + 1))) issues.push('text-overflow'); }
      return [...new Set(issues)];
    })()`);
    configurations += 1;
    if (issues.length) findings.push({ locale, theme, age, width, scale, spacing, issues });
    if (locale === 'es-MX' && age === '6-9' && width === 375 && scale === 1 && !spacing) {
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(output, `cpa-fading-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
    }
    if (configurations === 48) await restartBrowser('chrome-matrix-b-');
  }

  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings,
    scope: 'Controlled M1 static visual matrix. The live three-stage progression is inspected separately; no authenticated fixture, publication, Mentor-support attribution or saved progress.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) process.exitCode = 1;
} catch (error) {
  writeFileSync(join(output, 'error.txt'), JSON.stringify({ configurations, currentConfiguration, error: String(error?.stack ?? error) }, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close();
  browser.child.kill();
}
