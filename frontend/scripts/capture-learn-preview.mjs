import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

/*
 * W2L: screenshots of preview-entry screens, for looking at them (not a gate).
 *
 *   REBUILD_URL=http://localhost:5420 node scripts/capture-learn-preview.mjs "screen=territory&map=linear" 375 light [...]
 *
 * Each argument triple is a query, a width and a mode; captures land in
 * audit-results/learn-preview/. Full-page captures, at 100% text.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5420';
const out = resolve(process.env.REPORT_DIR ?? '../audit-results/learn-preview');
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const shots = [];
for (let i = 0; i + 2 < args.length + 1; i += 3) shots.push({ query: args[i], width: Number(args[i + 1]), theme: args[i + 2] });
const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
try {
  const page = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  await warmDevServer(page, origin);
  for (const { query, width, theme } of shots) {
    const params = new URLSearchParams(query);
    if (!params.has('theme')) params.set('theme', theme);
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    await page.send('Page.navigate', { url: `${origin}/rebuild.html?${params}` });
    for (let n = 0; n < 200; n++) {
      if (await page.evaluate("document.readyState === 'complete' && !!document.querySelector('[data-screen]')").catch(() => false)) break;
      await sleep(100);
    }
    await page.evaluate('document.fonts.ready');
    await sleep(600);
    const height = await page.evaluate('Math.ceil(document.documentElement.scrollHeight)');
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: Math.min(height, 4000), deviceScaleFactor: 1, mobile: width < 768 });
    await sleep(200);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    const name = `${query.replace(/[^a-z0-9=&-]/gi, '').replace(/[=&]/g, '_')}-${width}-${theme}.png`;
    writeFileSync(join(out, name), Buffer.from(shot.data, 'base64'));
    console.log(join(out, name));
  }
} finally {
  browser.child.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may hold a lock */ }
}
