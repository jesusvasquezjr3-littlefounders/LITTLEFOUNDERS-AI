import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * S03.2 overlay, focus and shell matrix (Frontend Bible 02 rules 12, 13 and
 * 19, §7, §8, §9.7, §9.8, §11 item 10; 03 §3.4; 04 §3; 06).
 *
 * Drives the preview-only component gallery (`rebuild.html?screen=gallery`,
 * `screen=overlays`, `screen=shell&shell=…`) in real headless Chrome:
 *
 *  1. Layout matrix: every gallery state (the overlay page closed and with
 *     each overlay open, and every shell state) × 3 locales × 2 themes ×
 *     320/375/768/1280 px × normal / WCAG 1.4.12 text spacing: text fit,
 *     copy budget, 48 px targets, 14 px floor, text contrast against the real
 *     background, one visible <h1>, no horizontal scroll, and every open
 *     overlay inside the viewport and `position: fixed`.
 *  2. Behaviour, per locale and theme, through real pointer and keyboard
 *     input: focus trap and return, Escape, scroll lock without movement,
 *     inert background, stacking (sheet → dialog), the z-order of a toast over
 *     a dialog, popover, menu and tooltip keyboard contracts, announcements,
 *     reduced motion, skip link, route focus, document title and language,
 *     the Mentor tab's real render, permission-aware staff navigation, the
 *     phone menu sheets, the docked call to action and the table-to-card
 *     collapse.
 *  3. axe-core WCAG 2.0/2.1/2.2 A/AA on every state.
 *
 * The gallery is not a product screen, so the first-view word total is not
 * measured; every individual string is.
 */
const origin = process.env.REBUILD_URL ?? 'http://localhost:5310';
const output = resolve('../audit-results/rebuild-shells');
mkdirSync(output, { recursive: true });
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
const evidence = [];
let configurations = 0;
// SHELLS_LOCALES / SHELLS_THEMES narrow a debugging run; the recorded evidence always uses the full set.
const LOCALES = process.env.SHELLS_LOCALES?.split(',') ?? ['en-US', 'es-MX', 'pt-BR'];
const THEMES = process.env.SHELLS_THEMES?.split(',') ?? ['light', 'dark'];
const WIDTHS = [320, 375, 768, 1280];
const SHOT_PLAN = new Set(['es-MX:light:375', 'pt-BR:dark:1280', 'en-US:light:1280', 'en-US:dark:375']);

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const frames = () => page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
const KEYS = { Tab: [9, 'Tab'], Escape: [27, 'Escape'], ArrowDown: [40, 'ArrowDown'], ArrowUp: [38, 'ArrowUp'], End: [35, 'End'], Home: [36, 'Home'], Enter: [13, 'Enter'] };
async function key(name, shift = false) {
  const [code, codeName] = KEYS[name];
  const base = { key: name, code: codeName, windowsVirtualKeyCode: code, modifiers: shift ? 8 : 0 };
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(name === 'Enter' ? { text: '\r' } : {}) });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  await frames();
}

/** A real pointer press at the element's centre; refuses when something else is on top (AGENTS §1.14). */
async function click(selector, { scroll = true } = {}) {
  const point = await page.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e) throw new Error('Missing ' + ${JSON.stringify(selector)});
    if (${scroll}) e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const top = document.elementFromPoint(x, y);
    if (!(e.contains(top) || top?.contains(e) || top?.closest('label')?.contains(e))) throw new Error('Occluded: ' + ${JSON.stringify(selector)} + ' by ' + (top?.outerHTML || '').slice(0, 80));
    return { x, y };
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  await frames();
}

async function navigate(params) {
  const query = new URLSearchParams(params).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 200; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('main')`)) break;
    await wait(50);
  }
  await page.evaluate('document.fonts.ready');
  if (!await page.evaluate("document.fonts.check('600 16px Fredoka') && document.fonts.check('500 16px Nunito')")) throw Error('Fonts did not load');
  await page.evaluate(`Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })))`);
  await frames();
}

async function viewport(width) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  await frames();
}

/** Layout measurement of whatever is on screen, overlays included; inert and visually hidden content is skipped. */
const measure = (locale) => `(() => {
  const issues = [];
  const hidden = (e) => { for (let n = e; n && n !== document.documentElement; n = n.parentElement) { const s = getComputedStyle(n); if (s.clipPath === 'inset(50%)' || s.visibility === 'hidden' || s.display === 'none') return true; } return false; };
  const live = (e) => !e.closest('[inert]') && !hidden(e);
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && live(e); };
  if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('horizontal-scroll:' + document.documentElement.scrollWidth);
  const h1 = [...document.querySelectorAll('h1')].filter(visible);
  const modalOpen = !!document.querySelector('[aria-modal="true"]');
  if (!modalOpen && h1.length !== 1) issues.push('h1-count:' + h1.length);
  const words = (t) => (t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu) || []).length;
  const factor = ${locale === 'en-US' ? 1 : 1.25};
  const app = { action: 3, heading: 6, body: 12, prompt: 12, option: 5, mentor: 12, narrative: 30 };
  const site = { ...app, heading: 8, body: 25 };
  for (const e of document.querySelectorAll('[data-copy-role]')) {
    if (e.tagName === 'OPTION' || !visible(e)) continue;
    const role = e.dataset.copyRole, text = e.textContent.trim(), s = getComputedStyle(e);
    const limits = e.closest('[data-shell="site"] main') ? site : app;
    if (role in limits && words(text) > Math.ceil(limits[role] * factor)) issues.push('copy:' + role + ':' + text);
    if (/—/.test(text)) issues.push('em-dash:' + text);
    if (s.textOverflow === 'ellipsis' || !['none', ''].includes(s.webkitLineClamp)) issues.push('truncation:' + text);
    if ((s.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) || (s.overflowY !== 'visible' && e.scrollHeight > e.clientHeight + 1)) issues.push('text-overflow:' + text);
    const r = e.getBoundingClientRect();
    if (r.right > innerWidth + 1 || r.left < -1) issues.push('offscreen-x:' + text);
  }
  const parse = (c) => { const m = c.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const background = (e) => { for (let n = e; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > .99) return c; } return parse(getComputedStyle(document.querySelector('.lf-rebuild')).backgroundColor); };
  for (const e of document.querySelectorAll('.lf-rebuild *')) {
    if (!visible(e) || e.closest('svg,[aria-hidden="true"]:not(.lf-tooltip)') || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e);
    if (parseFloat(s.fontSize) < 14) issues.push('text-size:' + e.textContent.trim());
    const owner = e.closest('label,button,a');
    if (e.closest(':disabled,[aria-disabled="true"]') || owner?.querySelector(':disabled') || e.matches('input,select')) continue;
    const fg = lum(parse(s.color)), bg = lum(background(e));
    const ratio = (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
    const large = parseFloat(s.fontSize) >= 24 || (parseFloat(s.fontSize) >= 18.66 && Number(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) issues.push('contrast:' + ratio.toFixed(2) + ':' + e.textContent.trim());
  }
  for (const e of document.querySelectorAll('a[href],button,input,select,[role=menuitem],[role=switch]')) {
    if (!visible(e)) continue;
    const target = e.matches('input[type=checkbox],input[type=radio]') ? (e.closest('label') ?? e) : e;
    const r = target.getBoundingClientRect();
    if (r.width < 47.5 || r.height < 47.5) issues.push('touch-target:' + (target.className || target.tagName) + ':' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  // Every open overlay is fixed to the viewport and fits inside it (02 rule 12).
  for (const e of document.querySelectorAll('[data-overlay]')) {
    const s = getComputedStyle(e);
    if (s.position !== 'fixed') issues.push('overlay-not-fixed:' + e.dataset.overlay);
    const panel = e.querySelector('[role=dialog],[role=alertdialog]') ?? e;
    const r = panel.getBoundingClientRect();
    if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) issues.push('overlay-outside-viewport:' + e.dataset.overlay + ':' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
  }
  return [...new Set(issues)];
})()`;

async function measureAcross(label, locale, theme, widths) {
  for (const width of widths) for (const spacing of [false, true]) {
    await viewport(width);
    await page.evaluate(`(() => {
      let style = document.getElementById('audit-spacing');
      if (!style) { style = document.createElement('style'); style.id = 'audit-spacing'; document.head.append(style); }
      style.textContent = ${JSON.stringify(spacing ? '.lf-rebuild * { letter-spacing:.12em !important; word-spacing:.16em !important; line-height:1.5 !important; }' : '')};
    })()`);
    await wait(40);
    await frames();
    const issues = await page.evaluate(measure(locale));
    configurations++;
    if (issues.length) findings.push({ state: label, locale, theme, width, spacing, issues });
    if (!spacing && SHOT_PLAN.has(`${locale}:${theme}:${width}`)) {
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(join(output, `${label}-${locale}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  await page.evaluate(`document.getElementById('audit-spacing')?.remove()`);
}

async function axe(label, locale, theme) {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
    .then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 5).map(n => n.target.join(' ') + ' ' + (n.failureSummary || '').split('\\n')[1]) })))`);
  if (violations.length) findings.push({ state: label, locale, theme, check: 'axe', issues: violations });
  return violations.length;
}

/* ---- State catalogue: how to reach each state from a fresh load ---- */
const overlayStates = {
  'overlays': null,
  'overlays-dialog': '[data-open=dialog]',
  'overlays-confirm': '[data-open=confirm]',
  'overlays-sheet': '[data-open=sheet]',
  'overlays-sheet-confirm': ['[data-open=sheet]', '[data-open=sheet-confirm]'],
  'overlays-popover': '[data-open=popover]',
  'overlays-menu': '[data-open=menu]',
  'overlays-toast': '[data-open=toast]',
};
const shellStates = {
  'gallery': { screen: 'gallery' },
  'shell-learner': { screen: 'shell', shell: 'learner' },
  'shell-teen': { screen: 'shell', shell: 'teen' },
  'shell-tutor': { screen: 'shell', shell: 'tutor' },
  'shell-staff': { screen: 'shell', shell: 'staff' },
  'shell-staff-limited': { screen: 'shell', shell: 'staff-limited' },
  'shell-site': { screen: 'shell', shell: 'site' },
  'shell-auth': { screen: 'shell', shell: 'auth' },
  'shell-single': { screen: 'shell', shell: 'single' },
  'shell-single-accent': { screen: 'shell', shell: 'single', hue: 'accent' },
  'shell-table': { screen: 'shell', shell: 'table' },
};

async function openOverlayState(selectors) {
  for (const selector of [selectors].flat()) { await click(selector); await wait(450); }
}

try {
  for (const locale of LOCALES) for (const theme of THEMES) {
    const checks = [];
    const expectTrue = async (name, expression) => {
      let ok = false;
      try { ok = await page.evaluate(expression); } catch (error) { ok = false; checks.push(name + ':' + error.message.slice(0, 120)); return; }
      if (!ok) checks.push(name);
    };
    let axeViolations = 0;
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });

    /* 1. Layout matrix over every state. */
    for (const [label, selectors] of Object.entries(overlayStates)) {
      await viewport(375);
      await navigate({ locale, theme, screen: 'overlays' });
      if (selectors) await openOverlayState(selectors);
      await measureAcross(label, locale, theme, WIDTHS);
      if (['overlays', 'overlays-dialog', 'overlays-sheet', 'overlays-menu'].includes(label)) { await viewport(375); axeViolations += await axe(label, locale, theme); }
    }
    for (const [label, params] of Object.entries(shellStates)) {
      await viewport(375);
      await navigate({ locale, theme, ...params });
      await measureAcross(label, locale, theme, WIDTHS);
      await viewport(375);
      axeViolations += await axe(label, locale, theme);
    }
    // Menu sheets exist only where the inline navigation does not fit.
    for (const [label, params, widths] of [['shell-staff-menu', { screen: 'shell', shell: 'staff' }, [320, 375, 768]], ['shell-site-menu', { screen: 'shell', shell: 'site' }, [320, 375, 768]]]) {
      await viewport(375);
      await navigate({ locale, theme, ...params });
      await click(label === 'shell-staff-menu' ? '.lf-appbar-menu' : '.lf-site-menu');
      await wait(350);
      await measureAcross(label, locale, theme, widths);
      axeViolations += await axe(label, locale, theme);
    }

    /* 2. Behaviour through real input (375 px unless stated). */
    await viewport(375);
    await navigate({ locale, theme, screen: 'overlays' });
    // Dialog opened after scrolling: fixed to the viewport, page does not move, focus trapped and returned.
    await page.evaluate(`document.querySelector('[data-open=dialog-bottom]').scrollIntoView({ block: 'center' })`);
    const scrolled = await page.evaluate('scrollY');
    await click('[data-open=dialog-bottom]', { scroll: false });
    await wait(300);
    await expectTrue('dialog-in-viewport', `(() => { const r = document.querySelector('[role=dialog]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(document.querySelector('.lf-layer')).position === 'fixed'; })()`);
    await expectTrue('dialog-scrim-covers-viewport', `(() => { const r = document.querySelector('.lf-scrim').getBoundingClientRect(); return r.top === 0 && r.left === 0 && Math.round(r.width) === document.documentElement.clientWidth && Math.round(r.height) === innerHeight; })()`);
    await expectTrue('dialog-page-did-not-move', `scrollY === ${scrolled}`);
    await expectTrue('dialog-scroll-locked', `getComputedStyle(document.documentElement).overflow === 'hidden'`);
    await expectTrue('dialog-background-inert', `document.getElementById('rebuild-root').hasAttribute('inert')`);
    await expectTrue('dialog-focus-inside', `!!document.activeElement.closest('[role=dialog]')`);
    for (let n = 0; n < 4; n++) { await key('Tab'); await expectTrue('dialog-tab-trapped-' + n, `!!document.activeElement.closest('[role=dialog]')`); }
    for (let n = 0; n < 3; n++) { await key('Tab', true); await expectTrue('dialog-shift-tab-trapped-' + n, `!!document.activeElement.closest('[role=dialog]')`); }
    await page.evaluate(`window.__lfGalleryToast?.('Toast over dialog')`);
    await wait(350);
    await expectTrue('toast-above-scrim', `(() => { const t = document.querySelector('.lf-toast'); const r = t.getBoundingClientRect(); return t.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })()`);
    await expectTrue('toast-not-inert', `!document.querySelector('.lf-toast').closest('[inert]')`);
    await key('Escape');
    await expectTrue('dialog-escape-closes', `!document.querySelector('[role=dialog]')`);
    await expectTrue('dialog-focus-returned', `document.activeElement === document.querySelector('[data-open=dialog-bottom]')`);
    await expectTrue('dialog-page-still-still', `scrollY === ${scrolled}`);
    await expectTrue('dialog-unlocked', `getComputedStyle(document.documentElement).overflow !== 'hidden' && !document.querySelector('[inert]')`);

    await page.evaluate(`document.querySelectorAll('.lf-toast .lf-icon-button').forEach(b => b.click())`);
    await frames();
    // Destructive confirmation: keep first and focused; Enter keeps; confirming runs, then a toast is announced.
    await click('[data-open=confirm]');
    await wait(300);
    await expectTrue('confirm-keep-first-and-focused', `(() => { const b = [...document.querySelectorAll('[role=alertdialog] button')]; return b[0].dataset.confirm === 'keep' && document.activeElement === b[0] && b[1].classList.contains('lf-button--danger'); })()`);
    await key('Enter');
    await expectTrue('confirm-enter-keeps', `!document.querySelector('[role=alertdialog]') && !document.querySelector('.lf-toast')`);
    await click('[data-open=confirm]');
    await wait(300);
    await click('[role=alertdialog] [data-confirm=confirm]', { scroll: false });
    await expectTrue('confirm-pending', `document.querySelector('[data-confirm=confirm]')?.getAttribute('aria-busy') === 'true'`);
    await wait(900);
    await expectTrue('confirm-toast-announced', `!document.querySelector('[role=alertdialog]') && !!document.querySelector('.lf-toast--success') && document.querySelector('[data-politeness=polite]').textContent === document.querySelector('.lf-toast--success .lf-toast-text').textContent`);
    await expectTrue('toast-in-viewport', `(() => { const r = document.querySelector('.lf-toast').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0 && r.left >= 0 && r.right <= innerWidth; })()`);
    await page.evaluate(`document.querySelectorAll('.lf-toast .lf-icon-button').forEach(b => b.click())`);
    await frames();

    // Sheet, then a dialog from inside it: stacking, inert, Escape order and focus return.
    await click('[data-open=sheet]');
    await wait(450);
    await expectTrue('sheet-docked-bottom', `(() => { const r = document.querySelector('.lf-sheet').getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) <= 1 && r.top >= 0; })()`);
    await expectTrue('sheet-focus-inside', `!!document.activeElement.closest('.lf-sheet')`);
    await click('[data-open=sheet-confirm]', { scroll: false });
    await wait(300);
    await expectTrue('stack-sheet-inert-under-dialog', `document.querySelector('.lf-sheet').closest('.lf-layer-root').hasAttribute('inert') && !!document.activeElement.closest('[role=alertdialog]')`);
    await key('Escape');
    await expectTrue('stack-escape-closes-top-only', `!document.querySelector('[role=alertdialog]') && !!document.querySelector('.lf-sheet') && document.activeElement === document.querySelector('[data-open=sheet-confirm]')`);
    await key('Escape');
    await expectTrue('stack-escape-then-sheet', `!document.querySelector('.lf-sheet') && document.activeElement === document.querySelector('[data-open=sheet]')`);

    // Popover: anchored next to its trigger, Escape returns focus, an outside press closes it.
    await click('[data-open=popover]');
    await wait(200);
    await expectTrue('popover-anchored', `(() => { const t = document.querySelector('[data-open=popover]').getBoundingClientRect(), p = document.querySelector('.lf-popover').getBoundingClientRect(); return (p.top >= t.bottom - 1 || p.bottom <= t.top + 1) && p.left >= 0 && p.right <= innerWidth && p.top >= 0 && p.bottom <= innerHeight; })()`);
    await expectTrue('popover-focus-inside', `!!document.activeElement.closest('.lf-popover')`);
    await key('Escape');
    await expectTrue('popover-escape-returns', `!document.querySelector('.lf-popover') && document.activeElement === document.querySelector('[data-open=popover]')`);
    await click('[data-open=popover]');
    await wait(200);
    await click('h1');
    await expectTrue('popover-outside-closes', `!document.querySelector('.lf-popover')`);

    // Menu by keyboard only.
    await page.evaluate(`document.querySelector('[data-open=menu]').focus()`);
    await key('ArrowDown');
    await expectTrue('menu-opens-on-first', `document.activeElement?.getAttribute('role') === 'menuitem' && document.activeElement.dataset.index === '0'`);
    await key('ArrowDown');
    await expectTrue('menu-arrow-moves', `document.activeElement.dataset.index === '1'`);
    await key('ArrowDown');
    await expectTrue('menu-skips-disabled', `document.activeElement.dataset.index === '3'`);
    await key('Home');
    await expectTrue('menu-home', `document.activeElement.dataset.index === '0'`);
    await key('Enter');
    await wait(150);
    await expectTrue('menu-enter-chooses', `!document.querySelector('[role=menu]') && document.activeElement === document.querySelector('[data-open=menu]') && !!document.querySelector('.lf-toast--info')`);
    await page.evaluate(`document.querySelectorAll('.lf-toast .lf-icon-button').forEach(b => b.click())`);

    // Tooltip: keyboard focus shows it, Escape hides it without moving focus; hover shows it and it is hoverable.
    await page.evaluate(`document.querySelector('[data-open=tooltip]').focus()`);
    await wait(120);
    await expectTrue('tooltip-on-focus', `!!document.querySelector('.lf-tooltip') && document.querySelector('[data-open=tooltip]').getAttribute('aria-describedby')?.length > 0`);
    await key('Escape');
    await expectTrue('tooltip-escape', `!document.querySelector('.lf-tooltip') && document.activeElement === document.querySelector('[data-open=tooltip]')`);
    await page.evaluate(`document.activeElement.blur()`);
    const tip = await page.evaluate(`(() => { const r = document.querySelector('[data-open=tooltip]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: tip.x, y: tip.y });
    await wait(500);
    await expectTrue('tooltip-on-hover', `!!document.querySelector('.lf-tooltip')`);
    const bubble = await page.evaluate(`(() => { const r = document.querySelector('.lf-tooltip').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (tip.x + bubble.x) / 2, y: (tip.y + bubble.y) / 2 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bubble.x, y: bubble.y });
    await wait(400);
    await expectTrue('tooltip-hoverable', `!!document.querySelector('.lf-tooltip')`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
    await wait(400);
    await expectTrue('tooltip-leaves', `!document.querySelector('.lf-tooltip')`);

    // Motion: overlays animate only when motion is allowed.
    await click('[data-open=dialog]');
    await wait(50);
    await expectTrue('motion-on', `getComputedStyle(document.querySelector('.lf-dialog')).animationName === 'lf-dialog-enter'`);
    await key('Escape');
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: theme }] });
    await click('[data-open=dialog]');
    await expectTrue('reduced-motion', `['.lf-dialog', '.lf-scrim'].every(s => getComputedStyle(document.querySelector(s)).animationName === 'none') && !!document.querySelector('[role=dialog]')`);
    await key('Escape');
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });

    // Learner shell: skip link, tab bar, Mentor tab, route focus, title and language.
    await navigate({ locale, theme, screen: 'shell', shell: 'learner' });
    await page.evaluate('document.activeElement?.blur(); window.scrollTo(0, 0)');
    await key('Tab');
    await expectTrue('skip-link-first-and-visible', `(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return a.classList.contains('lf-skip-link') && r.width >= 48 && r.height >= 48 && getComputedStyle(a).clipPath === 'none'; })()`);
    await key('Enter');
    await expectTrue('skip-link-moves-to-main', `document.activeElement === document.querySelector('main')`);
    await expectTrue('lang', `document.documentElement.lang === ${JSON.stringify(locale)} && document.querySelector('.lf-shell').lang === ${JSON.stringify(locale)}`);
    await expectTrue('tabbar-docked', `(() => { const t = document.querySelector('.lf-tabbar'); const r = t.getBoundingClientRect(); return getComputedStyle(t).display !== 'none' && Math.abs(r.bottom - innerHeight) <= 1 && getComputedStyle(document.querySelector('.lf-shell-rail')).display === 'none'; })()`);
    await expectTrue('mentor-tab-real-render', `(() => { const a = [...document.querySelectorAll('.lf-tabbar a')][1]; const i = a.querySelector('[data-slot=mentor-avatar] img'); return a.textContent === 'Dina' && i.naturalWidth > 0 && i.dataset.character === 'dina' && i.getAttribute('src').endsWith('dina-square-${theme}.png'); })()`);
    const title = await page.evaluate('document.title');
    await page.evaluate('window.scrollTo(0, 600)');
    await click('.lf-tabbar a[data-nav-id=wallet]', { scroll: false });
    await wait(150);
    await expectTrue('route-title', `document.title !== ${JSON.stringify(title)} && document.title.endsWith(' · LittleFounders') && document.title.startsWith(document.querySelector('h1').textContent)`);
    await expectTrue('route-focus-heading', `document.activeElement === document.querySelector('h1')`);
    await expectTrue('route-scroll-top', `scrollY === 0`);
    await expectTrue('route-current', `document.querySelector('.lf-tabbar [aria-current=page]')?.dataset.navId === 'wallet'`);
    await viewport(1280);
    await expectTrue('rail-at-desktop', `getComputedStyle(document.querySelector('.lf-shell-rail')).display === 'flex' && getComputedStyle(document.querySelector('.lf-tabbar')).display === 'none'`);
    await viewport(375);
    // A teen without a parent: no Tasks, and Zara has no render yet, so no picture at all (never a stand-in).
    await navigate({ locale, theme, screen: 'shell', shell: 'teen' });
    await expectTrue('teen-no-tasks-no-standin', `(() => { const ids = [...document.querySelectorAll('.lf-tabbar a')].map(a => a.dataset.navId); const m = document.querySelector('.lf-tabbar a[data-nav-id=mentor]'); return !ids.includes('tasks') && m.textContent === 'Zara' && !m.querySelector('img,svg'); })()`);

    // Staff: permission-aware navigation and the phone menu sheet.
    await navigate({ locale, theme, screen: 'shell', shell: 'staff' });
    await click('.lf-appbar-menu');
    await wait(350);
    await expectTrue('staff-menu-sheet', `document.querySelectorAll('.lf-sheet--full a[data-nav-id]').length === 7 && (() => { const r = document.querySelector('.lf-sheet--full').getBoundingClientRect(); return r.top === 0 && Math.round(r.height) === innerHeight; })()`);
    await click('.lf-sheet--full a[data-nav-id=insights]', { scroll: false });
    await wait(200);
    await expectTrue('staff-menu-navigates', `!document.querySelector('.lf-sheet') && document.activeElement === document.querySelector('h1') && document.querySelector('.lf-shell-rail [aria-current=page]')?.dataset.navId === 'insights'`);
    await navigate({ locale, theme, screen: 'shell', shell: 'staff-limited' });
    await expectTrue('staff-limited-slots', `[...document.querySelectorAll('.lf-tabbar a')].map(a => a.dataset.navId).join() === 'overview,insights' && [...document.querySelectorAll('.lf-shell-rail a[data-nav-id]')].length === 2`);

    // Public site: menu sheet on phones, inline links on desktop, the docked call to action after the first screen.
    await navigate({ locale, theme, screen: 'shell', shell: 'site' });
    await expectTrue('site-cta-hidden-at-top', `document.querySelector('.lf-sticky-action').dataset.visible === 'false'`);
    await page.evaluate('window.scrollTo(0, 900)');
    await wait(500);
    await expectTrue('site-cta-docked', `(() => { const e = document.querySelector('.lf-sticky-action'); const r = e.getBoundingClientRect(); return e.dataset.visible === 'true' && e.hasAttribute('data-dock') && Math.abs(r.bottom - innerHeight) <= 1; })()`);
    await page.evaluate('window.scrollTo(0, 0)');
    await click('.lf-site-menu');
    await wait(350);
    await expectTrue('site-menu-sheet', `!!document.querySelector('.lf-sheet--full [data-nav-id=how]') && !!document.querySelector('.lf-sheet--full .lf-button--accent')`);
    await key('Escape');
    await expectTrue('site-menu-returns-focus', `document.activeElement === document.querySelector('.lf-site-menu')`);
    await viewport(1280);
    await expectTrue('site-inline-links', `getComputedStyle(document.querySelector('.lf-site-links')).display === 'block' && getComputedStyle(document.querySelector('.lf-site-menu')).display === 'none'`);
    await viewport(375);

    // Single-state screen: one hue edge to edge, the focus ring in that hue's on-colour, actions docked.
    await navigate({ locale, theme, screen: 'shell', shell: 'single' });
    await expectTrue('single-full-bleed', `(() => { const s = getComputedStyle(document.querySelector('.lf-single-state')); const r = document.querySelector('.lf-single-state').getBoundingClientRect(); return s.backgroundColor === 'rgb(92, 85, 253)' && r.width === document.documentElement.clientWidth && r.height >= innerHeight; })()`);
    await page.evaluate('document.activeElement?.blur()');
    await key('Tab'); await key('Tab');
    await expectTrue('single-focus-ring-on-hue', `(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && s.outlineColor === 'rgb(255, 255, 255)'; })()`);
    await expectTrue('single-actions-docked', `(() => { const r = document.querySelector('.lf-single-state-actions').getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) <= 1; })()`);

    // Table: cards below 840 px with visible labels, a real table above.
    await navigate({ locale, theme, screen: 'shell', shell: 'table' });
    await expectTrue('table-cards-on-phone', `getComputedStyle(document.querySelector('.lf-table-row')).display === 'grid' && getComputedStyle(document.querySelector('.lf-table-label')).display !== 'none'`);
    await viewport(1280);
    await expectTrue('table-on-desktop', `getComputedStyle(document.querySelector('.lf-table')).display === 'table' && getComputedStyle(document.querySelector('.lf-table-label')).display === 'none' && getComputedStyle(document.querySelector('.lf-table-head')).clipPath === 'none'`);
    await viewport(375);

    if (checks.length) findings.push({ locale, theme, check: 'behaviour', issues: checks });
    evidence.push({ locale, theme, behaviourFailures: checks.length, axeViolations });
  }
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, evidence, findings,
    scope: 'S03.2 preview-only component gallery (overlays, focus, feedback and shells); not a product route.' }, null, 2));
  console.log(JSON.stringify({ configurations, evidence, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
