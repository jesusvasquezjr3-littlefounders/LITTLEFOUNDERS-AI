import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * Real-Chrome matrix for the S08.6 social-tier surfaces (Product 10 E.8 and
 * E.13, with E.9's no-count rule) on the fixture-only preview
 * (rebuild.html?screen=social-tiers): the private teen card (idle, pending,
 * failed, cooldown, the child's managed variant and the managed note on a full
 * profile), the teen's own connections (list, empty, failed, saving) and the
 * profile-safety notice for each audience (teen, child, Tutor).
 * 3 locales x 2 themes x 4 widths x 2 text scales x 13 states.
 *
 * Checks: no horizontal scroll; every visible string sits under a
 * data-copy-role; Copy Budget per role and the first-view budget at 375 px;
 * no em dash; no clipped or off-screen text; text >= 14 px; 48 px targets;
 * text contrast >= 4.5:1; no number in any heading or action (E.9: nothing
 * to count); the child's card offers no control; while saving every control
 * is disabled; a visible keyboard focus ring; no motion under
 * prefers-reduced-motion; no runtime errors or failed requests.
 *
 * Usage: start the dev server, then
 *   REBUILD_URL=http://localhost:5350 AUDIT_OUT=<dir> node scripts/verify-rebuild-social-tiers.mjs
 */

const origin = process.env.REBUILD_URL ?? 'http://localhost:5350';
const output = resolve(process.env.AUDIT_OUT ?? '../audit-results/rebuild-social-tiers');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

const STATES = ['card', 'cardPending', 'cardFailed', 'cardCooldown', 'cardManaged', 'managedNote',
  'teen', 'teenEmpty', 'teenFailed', 'teenBusy', 'safetySelf', 'safetyKid', 'safetyGuardian'];

async function navigate(locale, theme, width, scale, state) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'social-tiers', state }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 200; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('[data-screen="social-tiers-preview"] .lf-social-tier-card')`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate(`document.documentElement.style.fontSize='${16 * scale}px'`);
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

const AUDIT = (locale, width, scale, state) => `(() => {
  const issues = [], root = document.querySelector('[data-screen="social-tiers-preview"] .lf-social-tier-card');
  if (!root) return ['wrong-screen'];
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll');
  const words = t => (t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu) || []).length;
  const factor = ${locale === 'en-US' ? 1 : 1.25}, limits = { action: 3, heading: 6, body: 12, option: 8 };
  let firstView = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const owner = node.parentElement;
    if (!owner.closest('[data-copy-role]') && owner.getClientRects().length) issues.push('no-copy-role:' + node.textContent.trim());
  }
  for (const e of root.querySelectorAll('[data-copy-role]')) {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e); if (!r.width || !r.height) continue;
    const role = e.dataset.copyRole, text = e.textContent.trim();
    if (role in limits && words(text) > Math.ceil(limits[role] * factor)) issues.push('copy:' + role + ':' + text);
    if (role !== 'data' && r.top < 740 && r.bottom > 0) firstView += words(text);
    if (text.includes('—')) issues.push('em-dash:' + text);
    if ((role === 'heading' || role === 'action') && /\\d/.test(text)) issues.push('number-in-' + role + ':' + text);
    if (e.scrollWidth > e.clientWidth + 1 && s.overflowX !== 'visible') issues.push('text-overflow:' + text);
    if (r.right > innerWidth + 1 || r.left < -1) issues.push('offscreen:' + text);
    if (parseFloat(s.fontSize) < 14 * ${scale}) issues.push('text-size:' + text);
  }
  if (${width} === 375 && ${scale} === 1 && firstView > Math.ceil(40 * factor)) issues.push('first-view:' + firstView);
  for (const b of root.querySelectorAll('button')) {
    const r = b.getBoundingClientRect(); if (r.height < 48 || r.width < 48) issues.push('touch-target:' + b.textContent.trim());
  }
  const lum = c => { const [r, g, b] = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\\(.*,\\s*0\\)$/.test(c) && c !== 'transparent') return c; } return 'rgb(255,255,255)'; };
  for (const p of root.querySelectorAll('p, h2, time, button:not(:disabled)')) {
    if (!p.getClientRects().length) continue;
    const a = lum(getComputedStyle(p).color), b = lum(bgOf(p)); const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (ratio < 4.5) issues.push('contrast:' + ratio.toFixed(2) + ':' + p.textContent.trim());
  }
  const state = ${JSON.stringify(state)}, buttons = [...root.querySelectorAll('button')];
  if ((state === 'cardManaged' || state === 'managedNote' || state.startsWith('safety')) && buttons.length) issues.push('unexpected-control');
  if (state === 'card' && (buttons.length !== 1 || buttons[0].disabled)) issues.push('card-needs-one-ask');
  if (['cardPending', 'cardCooldown'].includes(state) && !buttons.every(b => b.disabled)) issues.push('settled-card-still-asks');
  if (state === 'teenBusy' && !buttons.every(b => b.disabled)) issues.push('busy-not-disabled');
  if (state === 'cardFailed' && !root.querySelector('[role="alert"]')) issues.push('failure-not-announced');
  return issues;
})()`;

async function tab(times = 1) {
  for (let n = 0; n < times; n++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  }
  return page.evaluate(`(() => { const e = document.activeElement; const s = getComputedStyle(e);
    return { tag: e.tagName, text: (e.textContent || e.type || '').trim().slice(0, 40), ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 || s.boxShadow !== 'none' }; })()`);
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const state of STATES) {
      await navigate(locale, theme, width, scale, state);
      const issues = await page.evaluate(AUDIT(locale, width, scale, state));
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, scale, state, issues });
      const shoot = scale === 1 && (width === 375 || width === 1280)
        && ((state === 'card' && locale === 'en-US') || (state === 'teen' && locale === 'es-MX') || (state === 'safetyGuardian' && locale === 'pt-BR'));
      if (shoot) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(join(output, `social-tiers-${locale}-${theme}-${width}-${state}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  // Keyboard: the card's ask and the teen's first decision are reachable, each with a ring.
  await navigate('en-US', 'light', 375, 1, 'card');
  const keyboard = { ask: await tab() };
  await navigate('es-MX', 'dark', 375, 1, 'teen');
  keyboard.accept = await tab();
  keyboard.decline = await tab();
  for (const [name, focus] of Object.entries(keyboard)) if (focus.tag !== 'BUTTON' || !focus.ring) findings.push({ keyboard: name, focus });

  // Reduced motion: no transition on the controls.
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('en-US', 'dark', 375, 1, 'teen');
  const motion = await page.evaluate(`(() => { const s = getComputedStyle(document.querySelector('.lf-social-tier-card button'));
    return { duration: s.transitionDuration, animation: s.animationName }; })()`);
  if (!/^0s(, 0s)*$/.test(motion.duration) || motion.animation !== 'none') findings.push({ reducedMotion: motion });
  await page.send('Emulation.setEmulatedMedia', { features: [] });

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({
    configurations, findings, keyboard, motion,
    scope: 'Fixture-only preview of the S08.6 surfaces (private teen card, teen connections, profile-safety notice); no session, no Core.',
  }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
