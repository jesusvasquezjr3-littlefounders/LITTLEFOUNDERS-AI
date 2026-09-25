import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * Real-Chrome matrix for the S08.4 sharing surfaces (Product 10 F.1/F.3 under
 * OD-20): the share action (achievement + goal variants, every state) and the
 * legacy-link panel, on the fixture-only preview (rebuild.html?screen=
 * achievement-share). 3 locales x 2 themes x 4 widths x 2 text scales x 4
 * states. Checks: no horizontal scroll, Copy Budget per data-copy-role, no
 * clipped text, 48 px targets, the F.3 disclosure present AND bound to its
 * button (aria-describedby), disclosure contrast >= 4.5:1, a visible keyboard
 * focus ring, no motion under prefers-reduced-motion, and no link/expiry
 * language in the image flow's copy.
 *
 * Usage: start the dev server, then
 *   REBUILD_URL=http://localhost:5350 AUDIT_OUT=<dir> node scripts/verify-rebuild-achievement-share.mjs
 */

const origin = process.env.REBUILD_URL ?? 'http://localhost:5350';
const output = resolve(process.env.AUDIT_OUT ?? '../audit-results/rebuild-achievement-share');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

async function navigate(locale, theme, width, scale, state) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'achievement-share', state }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 200; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('[data-screen="achievement-share-preview"]')`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate(`document.documentElement.style.fontSize='${16 * scale}px'`);
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

const AUDIT = (locale, width, scale) => `(() => {
  const issues = [], main = document.querySelector('[data-screen="achievement-share-preview"]');
  if (!main) return ['wrong-screen'];
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll');
  const words = t => (t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu) || []).length;
  const factor = ${locale === 'en-US' ? 1 : 1.25}, limits = { action: 3, heading: 6, body: 12, option: 8 };
  for (const e of main.querySelectorAll('[data-copy-role]')) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e); if (!r.width || !r.height) continue;
    const role = e.dataset.copyRole, text = e.textContent.trim();
    if (role in limits && words(text) > Math.ceil(limits[role] * factor)) issues.push('copy:' + role + ':' + text);
    if (text.includes('—')) issues.push('em-dash:' + text);
    if (e.scrollWidth > e.clientWidth + 1 && s.overflowX !== 'visible') issues.push('text-overflow:' + text);
    if (r.right > innerWidth + 1 || r.left < -1) issues.push('offscreen:' + text);
    if (parseFloat(s.fontSize) < 14 * ${scale}) issues.push('text-size:' + text);
  }
  for (const b of main.querySelectorAll('button')) { const r = b.getBoundingClientRect(); if (r.width < 48 || r.height < 48) issues.push('touch-target:' + b.textContent.trim()); }
  const share = main.querySelector('.lf-achievement-share button');
  const described = share && document.getElementById(share.getAttribute('aria-describedby') || '');
  if (!described || described.querySelectorAll('[data-copy-role="body"]').length !== 2) issues.push('disclosure-unbound');
  const shareText = [...main.querySelectorAll('.lf-achievement-share')].map(e => e.textContent).join(' ');
  if (/30|expir|caduc|revog|revoc|revoke/i.test(shareText)) issues.push('link-language-in-image-flow');
  const lum = c => { const [r, g, b] = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\\(.*,\\s*0\\)$/.test(c) && c !== 'transparent') return c; } return 'rgb(255,255,255)'; };
  if (described) for (const p of described.querySelectorAll('p')) {
    const a = lum(getComputedStyle(p).color), b = lum(bgOf(p)); const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (ratio < 4.5) issues.push('disclosure-contrast:' + ratio.toFixed(2));
  }
  return issues;
})()`;

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const state of ['idle', 'preparing', 'downloaded', 'failed']) {
      await navigate(locale, theme, width, scale, state);
      const issues = await page.evaluate(AUDIT(locale, width, scale));
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, scale, state, issues });
      if (scale === 1 && (width === 375 || width === 1280) && (state === 'idle' || (state === 'failed' && locale === 'es-MX'))) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(join(output, `achievement-share-${locale}-${theme}-${width}-${state}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  // Keyboard: Tab reaches the share button first, with a visible focus ring.
  await navigate('en-US', 'light', 375, 1, 'idle');
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  const focus = await page.evaluate(`(() => { const e = document.activeElement; const s = getComputedStyle(e);
    return { onShare: !!e.closest('.lf-achievement-share') && e.tagName === 'BUTTON', ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 || s.boxShadow !== 'none' }; })()`);
  if (!focus.onShare || !focus.ring) findings.push({ keyboard: focus });

  // Reduced motion: the pressed-state transform and its transition are off.
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('en-US', 'dark', 375, 1, 'idle');
  const motion = await page.evaluate(`(() => { const s = getComputedStyle(document.querySelector('.lf-achievement-share button'));
    return { duration: s.transitionDuration, animation: s.animationName }; })()`);
  if (!/^0s(, 0s)*$/.test(motion.duration) || motion.animation !== 'none') findings.push({ reducedMotion: motion });
  await page.send('Emulation.setEmulatedMedia', { features: [] });

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({
    configurations, findings, focus, motion,
    scope: 'Fixture-only preview of the S08.4 share action and legacy-link panel; no session, no Core, no Depot.',
  }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
