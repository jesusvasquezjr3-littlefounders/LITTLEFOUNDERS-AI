import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

// Scratch: screenshots of preview URLs in a headless GPU browser (the Browser pane cannot draw WebGL while hidden).
//   node scripts/shot-url.mjs "<query>" "<query>" ...   (each: the part after rebuild.html?)   W/H/DARK env; out: ../audit-results/shots/N.png
const origin = process.env.REBUILD_URL ?? 'http://localhost:5173';
const W = Number(process.env.W ?? 1024), H = Number(process.env.H ?? 768);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const scratch = resolve('../audit-results/shots');
mkdirSync(scratch, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(scratch, 'chrome-')), { gpuMode: 'hardware' });
try {
  const page = await openPage(browser.browser, { width: W, height: H, dark: process.env.DARK === '1' });
  await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  if (!await warmDevServer(page, origin)) throw new Error('no dev server');
  let n = 0;
  for (const query of process.argv.slice(2)) {
    await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
    await wait(Number(process.env.WAIT ?? 9000));
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    const file = join(scratch, `${++n}.png`);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(file, query);
  }
} finally {
  browser.child.kill();
}
