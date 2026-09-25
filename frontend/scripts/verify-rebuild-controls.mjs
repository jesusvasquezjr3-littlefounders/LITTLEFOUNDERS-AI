import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * S03.1 shared control matrix (Frontend Bible 02 §2, §5, §7, §8, §9; 06; 04 §3).
 *
 * Drives the preview-only catalogue (`rebuild.html?screen=system`) in real
 * headless Chrome: 3 locales x 2 themes x 4 widths x 2 text sizes x normal /
 * WCAG 1.4.12 text spacing = 96 configurations of text fit, copy budget,
 * 48 px targets, 14 px floor and text contrast, then per locale/theme the
 * keyboard focus walk, the interaction checks, reduced motion and axe-core.
 * The catalogue is not a product screen, so the first-view word total is not
 * measured here; every individual string is.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5310';
const output = resolve('../audit-results/rebuild-controls');
mkdirSync(output, { recursive: true });
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
const evidence = [];
let configurations = 0;

const key = async (name, code, keyCode, modifiers = 0) => {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode, modifiers });
};

/** A real pointer press at the element's centre; refuses when something else is on top (AGENTS §1.14). */
async function click(selector) {
  const point = await page.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) throw new Error('Missing ' + ${JSON.stringify(selector)});
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const top = document.elementFromPoint(x, y);
    if (!(e.contains(top) || top?.contains(e) || top?.closest('label')?.contains(e))) throw new Error('Occluded: ' + ${JSON.stringify(selector)});
    return { x, y };
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

async function navigate(locale, theme) {
  const query = new URLSearchParams({ locale, theme, screen: 'system' }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 200; n++) {
    if (await page.evaluate(`document.querySelector('main')?.dataset.screen === 'system' && location.search === ${JSON.stringify('?' + query)}`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  if (!await page.evaluate("document.fonts.check('600 16px Fredoka') && document.fonts.check('500 16px Nunito')")) throw Error('Fonts did not load');
  await page.evaluate(`Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))`);
  // The catalogue's milestone demonstration celebrates on each visit; measure its settled frame (it settles within 1.2 s by contract).
  for (let n = 0; n < 60 && await page.evaluate("!!document.querySelector('[data-celebration=\"playing\"]')"); n++) await new Promise((done) => setTimeout(done, 50));
}

const measure = (locale) => `(() => {
  const issues = [];
  const root = document.querySelector('.lf-rebuild'), main = root.querySelector('main');
  if (!main || main.dataset.screen !== 'system') return ['wrong-screen'];
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll:' + document.documentElement.scrollWidth);
  if (main.querySelectorAll('h1').length !== 1) issues.push('heading-count');
  const words = (t) => (t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu) || []).length;
  const factor = ${locale === 'en-US' ? 1 : 1.25};
  const limits = { action: 3, heading: 6, body: 12, prompt: 12, option: 5, mentor: 12, narrative: 30 };
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  for (const e of main.querySelectorAll('[data-copy-role]')) {
    if (e.tagName === 'OPTION' || !visible(e)) continue;
    const role = e.dataset.copyRole, text = e.textContent.trim(), s = getComputedStyle(e);
    if (role in limits && words(text) > Math.ceil(limits[role] * factor)) issues.push('copy:' + role + ':' + text);
    if (s.textOverflow === 'ellipsis' || !['none', ''].includes(s.webkitLineClamp)) issues.push('truncation:' + text);
    if ((s.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) || (s.overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1)) issues.push('text-overflow:' + text);
  }
  for (const e of main.querySelectorAll('[aria-label]')) {
    if (e.matches('button') && words(e.getAttribute('aria-label')) > Math.ceil(6 * factor)) issues.push('label-budget:' + e.getAttribute('aria-label'));
  }
  const parse = (c) => { const m = c.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const background = (e) => { for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > .99) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  for (const e of main.querySelectorAll('*')) {
    if (!visible(e) || e.closest('svg,[aria-hidden="true"]') || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e);
    if (parseFloat(s.fontSize) < 14) issues.push('text-size:' + e.textContent.trim());
    // WCAG 1.4.3 exempts inactive components, including the label of a disabled control.
    const owner = e.closest('label,button');
    if (e.closest(':disabled,[aria-disabled="true"]') || owner?.querySelector(':disabled') || e.matches('input,select')) continue;
    const fg = lum(parse(s.color)), bg = lum(background(e));
    const ratio = (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) issues.push('contrast:' + ratio.toFixed(2) + ':' + e.textContent.trim());
  }
  for (const e of main.querySelectorAll('button,input,select,[role=switch]')) {
    const target = e.matches('input[type=checkbox],input[type=radio]') ? (e.closest('label') ?? e) : e;
    const r = target.getBoundingClientRect();
    if (r.width < 48 || r.height < 48) issues.push('touch-target:' + (target.className || target.tagName) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  return [...new Set(issues)];
})()`;

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 740, deviceScaleFactor: 1, mobile: true });
    await navigate(locale, theme);
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
      await page.evaluate(`(() => {
        document.documentElement.style.fontSize = '${16 * scale}px';
        let style = document.getElementById('audit-spacing');
        if (!style) { style = document.createElement('style'); style.id = 'audit-spacing'; document.head.append(style); }
        style.textContent = ${JSON.stringify(spacing ? '.lf-rebuild * { letter-spacing:.12em !important; word-spacing:.16em !important; line-height:1.5 !important; }' : '')};
        window.scrollTo(0, 0);
      })()`);
      await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const issues = await page.evaluate(measure(locale));
      configurations++;
      if (issues.length) findings.push({ locale, theme, width, scale, spacing, issues });
      if ([375, 1280].includes(width) && scale === 1 && !spacing) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: await page.evaluate(`({ x: 0, y: 0, width: ${width}, height: document.documentElement.scrollHeight, scale: 1 })`) });
        writeFileSync(join(output, `system-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    await page.evaluate(`(() => { document.documentElement.style.fontSize = ''; document.getElementById('audit-spacing')?.remove(); })()`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 740, deviceScaleFactor: 1, mobile: true });

    // Keyboard: every stop shows a 3 px ring (outline, or the inset ring plus halo on fields).
    await navigate(locale, theme);
    await page.evaluate('document.activeElement?.blur(); window.scrollTo(0, 0)');
    const stops = [];
    for (let n = 0; n < 120; n++) {
      await key('Tab', 'Tab', 9);
      const stop = await page.evaluate(`(() => {
        const e = document.activeElement;
        if (!e || e === document.body || e.dataset.auditStop === 'first') return null;
        // A native date input keeps focus across its day/month/year segments: one stop.
        if (e.dataset.auditStop) return { repeat: true };
        e.dataset.auditStop = document.querySelector('[data-audit-stop]') ? 'seen' : 'first';
        const ring = (n) => { const s = getComputedStyle(n); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 3) || /inset/.test(s.boxShadow); };
        const holder = e.matches('input[type=radio]') ? e.closest('label') : e;
        return { id: (e.getAttribute('aria-label') || e.textContent || e.name || e.type || e.tagName).trim().slice(0, 40), ring: ring(holder) };
      })()`);
      if (!stop) break;
      if (stop.repeat) continue;
      stops.push({ ...stop, index: n });
    }
    const unringed = stops.filter((stop) => !stop.ring);
    if (unringed.length) findings.push({ locale, theme, check: 'focus-ring', issues: unringed.map((s) => s.id) });
    if (stops.length < 30) findings.push({ locale, theme, check: 'focus-walk', issues: [`only ${stops.length} stops`] });

    // Interactions through the real pointer and keyboard.
    const checks = [];
    const expectTrue = async (name, expression) => { if (!await page.evaluate(expression)) checks.push(name); };
    // Animation events are dispatched on the frame after an animation starts, so motion checks poll for up to a second.
    const expectSoon = async (name, expression) => { for (let n = 0; n < 20; n++) { if (await page.evaluate(expression)) return; await new Promise((done) => setTimeout(done, 50)); } checks.push(name); };
    await click('.lf-system-form button[type=submit]');
    await expectTrue('empty-goal-error', `(() => { const i = document.querySelector('.lf-system-form input'); const d = i.getAttribute('aria-describedby') || ''; return i.getAttribute('aria-invalid') === 'true' && !!document.querySelector('.lf-system-form .lf-input-error svg') && d.split(' ').some(id => document.getElementById(id)?.classList.contains('lf-input-error')); })()`);
    await click('.lf-system-form input');
    await page.send('Input.insertText', { text: 'Bicycle' });
    await click('.lf-system-form button[type=submit]');
    await expectTrue('goal-error-clears', `!document.querySelector('.lf-system-form .lf-input-error')`);
    await click('.lf-input-reveal');
    await expectTrue('password-reveal', `document.querySelector('.lf-input-box:has(.lf-input-reveal) input').type === 'text'`);
    await click('.lf-input-reveal');
    await expectTrue('password-hide', `document.querySelector('.lf-input-box:has(.lf-input-reveal) input').type === 'password'`);
    await click('.lf-toggle:not(:disabled)');
    await expectTrue('switch-on', `document.querySelector('.lf-toggle:not(:disabled)').getAttribute('aria-checked') === 'true' && !!document.querySelector('.lf-toggle:not(:disabled) .lf-toggle-thumb svg')`);
    await click('.lf-segmented-option:first-child');
    await key('ArrowRight', 'ArrowRight', 39);
    await expectTrue('segmented-arrow-key', `document.querySelectorAll('.lf-segmented-input')[1].checked && !!document.querySelectorAll('.lf-segmented-option')[1].querySelector('svg')`);
    await click('.lf-radio-option:first-child');
    await expectTrue('radio-choose', `document.querySelector('.lf-radio-input').checked`);
    await click('.lf-check-label');
    await expectTrue('checkbox-toggle', `!document.querySelector('.lf-check-input:not(:disabled)').checked`);
    const before = await page.evaluate(`document.querySelector('.lf-stepper-value').textContent`);
    await click('.lf-stepper-button:last-child');
    await expectTrue('stepper-increase', `document.querySelector('.lf-stepper-value').textContent !== ${JSON.stringify(before)}`);
    await click('.lf-choice-chip:nth-child(2)');
    await expectTrue('choice-chip', `document.querySelectorAll('.lf-choice-chip')[1].getAttribute('aria-pressed') === 'true'`);
    const pendingText = await page.evaluate(`document.querySelector('.lf-button--pending').textContent`);
    await click('.lf-button--pending');
    await expectTrue('pending-holds', `document.querySelector('.lf-button--pending').textContent === ${JSON.stringify(pendingText)} && document.querySelector('.lf-button--pending').getAttribute('aria-busy') === 'true'`);
    await click('.lf-state--error .lf-button');
    await expectTrue('retry-pending', `document.querySelector('.lf-state--error .lf-button').getAttribute('aria-busy') === 'true'`);
    await expectTrue('avatar-real-render', `[...document.querySelectorAll('[data-slot=mentor-avatar] img')].every(i => i.naturalWidth > 0 && i.dataset.character === 'dina' && i.dataset.pose === 'ambient.idle' && i.getAttribute('src') === '/rebuild/mentor-avatars/dina-${theme}.png') && document.querySelectorAll('[data-slot=mentor-avatar] img').length > 0 && !document.querySelector('[data-refused]')`);
    await expectTrue('scroll-kept-on-rerender', `scrollY > 0`);
    await expectTrue('motion-on', `getComputedStyle(document.querySelector('.lf-toggle-thumb')).transitionDuration !== '0s'`);
    // S03.7 motion patterns (02 §9.1, §9.4; D7; 07 §5).
    const loops = `document.getAnimations().filter(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity)`;
    await expectTrue('breathing-one-cta', `document.querySelectorAll('[data-idle-motion="breathing-cta"]').length === 1 && ${loops}.length === 1 && ${loops}[0].effect.target.dataset.idleMotion === 'breathing-cta'`);
    await page.evaluate(`window.__lfMotion = []; document.addEventListener('animationstart', (event) => window.__lfMotion.push(event.animationName), true)`);
    await click('section[aria-labelledby="system-motion"] .lf-check-label');
    await expectSoon('armed-bump-once', `window.__lfMotion.filter(n => n === 'lf-armed-bump').length === 1 && !document.querySelector('section[aria-labelledby="system-motion"] .lf-button--success').disabled`);
    await click('.lf-celebration[data-milestone=\"badge-earned\"] .lf-button');
    await expectSoon('milestone-celebrates', `document.querySelector('.lf-celebration[data-milestone=\"badge-earned\"]').dataset.milestone === 'badge-earned' && window.__lfMotion.includes('lf-celebration-pop') && window.__lfMotion.includes('lf-celebration-rise')`);
    await new Promise((done) => setTimeout(done, 1400));
    await expectTrue('celebration-settles', `document.querySelector('.lf-celebration[data-milestone=\"badge-earned\"]').dataset.celebration === 'settled' && document.querySelector('.lf-celebration[data-milestone=\"badge-earned\"] .lf-count-up').textContent === '+40'`);
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: theme }] });
    await expectTrue('reduced-motion', `['.lf-toggle-thumb', '.lf-icon-button', '.lf-stepper-button', '.lf-progress-fill', '.lf-button'].every(s => getComputedStyle(document.querySelector(s)).transitionDuration.split(',').every(d => d.trim() === '0s'))`);
    await click('.lf-celebration[data-milestone=\"badge-earned\"] .lf-button');
    await expectTrue('reduced-motion-static-frame', `document.querySelector('.lf-celebration[data-milestone=\"badge-earned\"]').dataset.celebration === 'static' && document.querySelector('.lf-celebration[data-milestone=\"badge-earned\"] .lf-count-up').textContent === '+40' && document.getAnimations().length === 0 && !!document.querySelector('.lf-button--breathing')`);
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    if (checks.length) findings.push({ locale, theme, check: 'interactions', issues: checks });

    // axe-core, WCAG 2.x A/AA, on the fresh catalogue.
    await navigate(locale, theme);
    await page.evaluate(axeSource);
    const axe = await page.evaluate(`axe.run(document.querySelector('.lf-rebuild'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
      .then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 5).map(n => n.target.join(' ') + ' ' + (n.failureSummary || '').split('\\n')[1]) })))`);
    if (axe.length) findings.push({ locale, theme, check: 'axe', issues: axe });
    evidence.push({ locale, theme, focusStops: stops.length, interactionFailures: checks.length, axeViolations: axe.length });
  }
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, evidence, findings,
    scope: 'S03.1 preview-only shared control catalogue; not a product screen or a full composition audit.' }, null, 2));
  console.log(JSON.stringify({ configurations, evidence, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 10), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
