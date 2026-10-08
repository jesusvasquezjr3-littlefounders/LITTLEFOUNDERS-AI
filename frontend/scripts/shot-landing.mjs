import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

// Scratch: screenshots of landing sections in a headless GPU browser (the Browser pane is hidden, so its WebGL is lost).
//   node scripts/shot-landing.mjs ".lf-problem" ".lf-demo"   env: W H DARK=1 ACTIONS='["click:Continue", ...]' (applied to the LAST selector's page, in order)
const origin = process.env.REBUILD_URL ?? 'http://localhost:5173';
const W = Number(process.env.W ?? 1280), H = Number(process.env.H ?? 800);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const scratch = resolve('../audit-results/landing-shots');
mkdirSync(scratch, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(scratch, 'chrome-')), { gpuMode: 'hardware' });
try {
  const page = await openPage(browser.browser, { width: W, height: H, dark: process.env.DARK === '1' });
  await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 600 });
  if (!await warmDevServer(page, origin)) throw new Error('no dev server');
  await page.send('Page.navigate', { url: `${origin}/` });
  await wait(6000);
  // Refuse the optional cookies so the banner does not cover the page.
  await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /reject|rechazar|recusar/i.test(x.textContent)); if (b) b.click(); })()`);
  await wait(800);
  const actions = JSON.parse(process.env.ACTIONS ?? '[]');
  let n = 0;
  for (const selector of process.argv.slice(2)) {
    await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -${Number(process.env.PAD ?? 70)}); } })()`);
    await wait(Number(process.env.SETTLE ?? 4500));
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    const file = join(scratch, `${++n}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(file, selector);
  }
  for (const action of actions) {
    const [head, extra] = action.split('|');
    const [kind, arg] = head.split(':');
    if (kind === 'click') await page.evaluate(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(process.env.SCOPE ?? 'button, a')})].find((x) => x.textContent.trim().startsWith(${JSON.stringify(arg)})); if (b) b.click(); })()`);
    await wait(Number(extra ?? 2500));
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    const file = join(scratch, `${++n}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(file, action);
  }
} finally {
  browser.child.kill();
}
