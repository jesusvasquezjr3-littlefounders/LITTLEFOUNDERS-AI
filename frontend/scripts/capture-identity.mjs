import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';
import { installSyntheticCore, SCENARIOS, sessionStorageScript, signedOutStorageScript } from './audits/synthetic-core.mjs';

/*
 * Screenshots of the rebuilt sign-in, recovery, verification and onboarding
 * screens (W2 Lane 1, W2S.2) for a person to look at: each target whole (the
 * viewport grows to the page's height), per locale, mode and width. Real
 * routes answered by the synthetic Core, and the preview entry for the states
 * a route cannot show on demand. Evidence for the visual review (02 §12); the
 * pass/fail checks are verify-identity.mjs and audit:rebuild.
 *
 *   REBUILD_URL=http://localhost:5410 node scripts/capture-identity.mjs
 *   Filters: CAPTURE_TARGETS=login,onboarding-mentor  CAPTURE_LOCALES  CAPTURE_THEMES  CAPTURE_WIDTHS
 * Output: audit-results/identity/captures/.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5410';
const out = resolve('../audit-results/identity/captures');
mkdirSync(out, { recursive: true });
const list = (name, fallback) => (process.env[name] ? process.env[name].split(',') : fallback);
const TARGETS = {
  login: { path: '/login' },
  signup: { path: '/signup?intent=tutor' },
  forgot: { path: '/forgot-password' },
  'reset-expired': { path: '/reset-password' },
  'callback-failed': { path: '/auth/callback#error=access_denied' },
  'verify-intro': { path: '/verify-parent', scenario: 'identity-adult' },
  'verify-already': { path: '/verify-parent', scenario: 'identity-tutor' },
  'verify-age': { path: '/verify-parent', scenario: 'age-screen' },
  upgrade: { path: '/upgrade-account', scenario: 'identity-guest' },
  'onboarding-welcome': { path: '/onboarding', scenario: 'identity-new-guest' },
  'age-standalone': { path: '/onboarding', scenario: 'age-screen' },
  suspended: { path: '/account-suspended' },
  ...Object.fromEntries(['login-google', 'signup-refused', 'signup-confirm', 'forgot-sent', 'reset-form', 'upgrade-error', 'verify-failed', 'verify-success', 'verify-revoked']
    .map((view) => [`identity-${view}`, { preview: { screen: 'identity', view } }])),
  ...Object.fromEntries(['name', 'mentor', 'discovery', 'account'].map((step) => [`onboarding-${step}`, { preview: { screen: 'onboarding', step, chosen: step === 'mentor' ? 'zara' : '' } }])),
};
const targets = list('CAPTURE_TARGETS', Object.keys(TARGETS));
const locales = list('CAPTURE_LOCALES', ['en-US']);
const themes = list('CAPTURE_THEMES', ['light', 'dark']);
const widths = list('CAPTURE_WIDTHS', ['375', '1280']).map(Number);

const profile = mkdtempSync(join(out, 'chrome-'));
const browser = await launchBrowser(profile);
try {
  const warm = await openPage(browser.browser, { width: 375, height: 800, dark: false });
  if (!await warmDevServer(warm, origin)) throw new Error(`The dev server at ${origin} never mounted the app`);
  await warm.send('Page.close').catch(() => {});
  const page = await openPage(browser.browser, { width: 375, height: 800, dark: false, newWindow: true, isolated: true });
  page.core = null;
  await installSyntheticCore(page, origin, { unknownRequests: new Set() });
  for (const id of targets) for (const locale of locales) for (const theme of themes) for (const width of widths) {
    const target = TARGETS[id];
    await page.send('Network.clearBrowserCookies');
    await page.send('Network.setCookie', { name: 'lf_cc', value: 'denied', url: origin });
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 768 });
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
    if (await page.evaluate('location.origin').catch(() => '') !== origin) { await page.send('Page.navigate', { url: `${origin}/favicon.ico` }); await sleep(500); }
    const spec = target.scenario ? SCENARIOS[target.scenario] : null;
    page.core = spec ? { scenario: target.scenario, locale, theme, fixtures: {} } : null;
    await page.evaluate(spec ? sessionStorageScript({ guest: spec.guest, locale, theme }) : signedOutStorageScript({ locale, theme }));
    let url;
    if (target.preview) {
      url = new URL('/rebuild.html', origin);
      for (const [key, value] of Object.entries(target.preview)) if (value) url.searchParams.set(key, value);
      url.searchParams.set('locale', locale); url.searchParams.set('theme', theme);
    } else { url = new URL(target.path, origin); url.searchParams.set('lng', locale); }
    await page.send('Page.navigate', { url: url.toString() });
    for (let n = 0; n < 600; n++) { if (await page.evaluate("!!document.querySelector('[data-shell] h1, [data-shell] [data-screen]')").catch(() => false)) break; await sleep(50); }
    await page.evaluate('document.fonts.ready').catch(() => {});
    await sleep(900);
    const height = Math.min(9000, await page.evaluate('document.documentElement.scrollHeight'));
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: Math.max(height, 800), deviceScaleFactor: 1, mobile: width < 768 });
    await sleep(400);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    const name = `${id}-${locale}-${theme}-${width}.png`;
    writeFileSync(join(out, name), Buffer.from(shot.data, 'base64'));
    process.stdout.write(`${name}\n`);
  }
} finally {
  browser.child.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a lock on Windows */ }
}
