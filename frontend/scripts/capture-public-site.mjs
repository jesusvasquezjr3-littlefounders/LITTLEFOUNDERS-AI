import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, signedOutStorageScript } from './audits/synthetic-core.mjs';

/*
 * Screenshots of the rebuilt public site (W2 Lane 1) for a person to look at:
 * each page, whole (the viewport is grown to the page's height, so nothing is
 * composited off screen), per locale, mode and width. Evidence for the visual
 * review the Bible asks for (02 §12); the pass/fail checks are
 * verify-public-site.mjs and audit:rebuild.
 *
 *   REBUILD_URL=http://localhost:5410 node scripts/capture-public-site.mjs
 *   Filters: CAPTURE_PATHS=/,/faq  CAPTURE_LOCALES  CAPTURE_THEMES  CAPTURE_WIDTHS  CAPTURE_CONSENT=banner|decided
 * Output: audit-results/public-site/captures/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5410';
const out = resolve('../audit-results/public-site/captures');
mkdirSync(out, { recursive: true });
const list = (name, fallback) => (process.env[name] ? process.env[name].split(',') : fallback);
const paths = list('CAPTURE_PATHS', ['/', '/how-it-works', '/families', '/faq', '/legal/terms', '/legal/privacy']);
const locales = list('CAPTURE_LOCALES', ['en-US', 'es-MX', 'pt-BR']);
const themes = list('CAPTURE_THEMES', ['light', 'dark']);
const widths = list('CAPTURE_WIDTHS', ['375', '1280']).map(Number);
const consent = process.env.CAPTURE_CONSENT ?? 'decided';

const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
try {
  const warm = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await warm.send('Page.close').catch(() => {});
  const page = await openPage(browser.browser, { width: 375, height: 800, dark: false, newWindow: true, isolated: true });
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests: new Set() });
  for (const path of paths) for (const locale of locales) for (const theme of themes) for (const width of widths) {
    await page.send('Network.clearBrowserCookies');
    if (consent === 'decided') await page.send('Network.setCookie', { name: 'lf_cc', value: 'denied', url: origin });
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (await page.evaluate('location.origin').catch(() => '') !== origin) { await page.send('Page.navigate', { url: `${origin}/favicon.ico` }); await sleep(500); }
    await page.evaluate(signedOutStorageScript({ locale, theme }));
    const url = new URL(path, origin); url.searchParams.set('lng', locale);
    await page.send('Page.navigate', { url: url.toString() });
    for (let n = 0; n < 200; n++) { if (await page.evaluate("!!document.querySelector('[data-shell] [data-screen]')").catch(() => false)) break; await sleep(50); }
    await page.evaluate('document.fonts.ready');
    await sleep(700);
    const height = Math.min(9000, await page.evaluate('document.documentElement.scrollHeight'));
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await sleep(400);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    const name = `${path === '/' ? 'landing' : path.slice(1).replace(/\//g, '-')}-${locale}-${theme}-${width}${consent === 'banner' ? '-banner' : ''}.png`;
    writeFileSync(join(out, name), Buffer.from(shot.data, 'base64'));
    process.stdout.write(`${name}\n`);
  }
} finally {
  browser.child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
