import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * S05.3e real-Chrome matrix (preview fixtures; the authenticated routes render
 * Core's own answers): the learner's rhythm (B.21 habit streak with rest days,
 * B.24 pace, path and Mentor choices) in every state, the verified parent's
 * holiday pause (B.21) including a refused range, the lesson result on a
 * streak milestone with the skill behind the XP and the learner's plan done
 * (B.20, B.24), and the staff panel's new motivation signals.
 *
 * Every state in 3 locales x 2 themes x 320/375/768/1280 px, at 100% and 140%
 * text, with WCAG 1.4.12 spacing at 375 px. Checks: heading structure, no
 * horizontal scroll, the Copy Budget per role and band, the first-view word
 * limit for full screens, no clipped or off-screen text, no text under 14 px,
 * 48 px targets, no stretched button, a copy role on every text node, the
 * glossary (no "streak freeze", no loss words), celebration ONLY on the
 * milestone result (OD-7), keyboard reach with a visible focus ring, and no
 * motion under reduced motion.
 *
 *   REBUILD_URL=http://localhost:5320 node scripts/verify-rebuild-motivation.mjs
 *   REPORT_DIR=../.lane-cache/rebuild-motivation (optional)
 */

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve(process.env.REPORT_DIR ?? '../audit-results/rebuild-motivation');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

/** A parent types a 23-day range and presses Pause: the form must refuse it before sending. */
const invalidRange = `(() => { const inputs = document.querySelectorAll('.lf-streak-pause input[type=date]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(inputs[1], '2026-10-16'); inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  setTimeout(() => document.querySelector('.lf-streak-pause .lf-button--accent')?.click(), 40); })()`;

/** Each state: its preview query, the Copy Budget band it is written for, its root, and whether it is a full screen. */
const STATES = {
  'rhythm-open': { query: { screen: 'rhythm', rhythm: 'open' }, band: '6-9', root: '.lf-rhythm', screen: true, h1: 1 },
  'rhythm-today': { query: { screen: 'rhythm', rhythm: 'today' }, band: '6-9', root: '.lf-rhythm', screen: true, h1: 1 },
  'rhythm-resting': { query: { screen: 'rhythm', rhythm: 'resting' }, band: '6-9', root: '.lf-rhythm', screen: true, h1: 1 },
  'rhythm-paused': { query: { screen: 'rhythm', rhythm: 'paused' }, band: '6-9', root: '.lf-rhythm', screen: true, h1: 1 },
  'rhythm-none': { query: { screen: 'rhythm', rhythm: 'none' }, band: '6-9', root: '.lf-rhythm', screen: true, h1: 1 },
  'rhythm-teen': { query: { screen: 'rhythm', rhythm: 'open' }, band: '13-17', root: '.lf-rhythm', screen: true, h1: 1 },
  'rhythm-loading': { query: { screen: 'rhythm', rhythm: 'loading' }, band: '6-9', root: '.lf-rhythm', screen: true, h1: 1 },
  'rhythm-error': { query: { screen: 'rhythm', rhythm: 'error' }, band: '6-9', root: '.lf-rhythm', screen: true, h1: 1 },
  // The second layer: the Choices tab (pace, path, Mentor), then a saved pace.
  'rhythm-choices': { query: { screen: 'rhythm', rhythm: 'open' }, band: '6-9', root: '.lf-rhythm', screen: true, h1: 1,
    act: "document.querySelectorAll('.lf-rhythm-tab')[1]?.click()", expect: "document.querySelectorAll('.lf-rhythm-options .lf-button').length === 3 && !document.querySelector('.lf-rhythm-options').closest('[hidden]')" },
  'rhythm-saved': { query: { screen: 'rhythm', rhythm: 'open' }, band: '6-9', root: '.lf-rhythm', screen: true, h1: 1,
    act: "document.querySelectorAll('.lf-rhythm-tab')[1]?.click(); setTimeout(() => document.querySelectorAll('.lf-rhythm-options .lf-button')[2]?.click(), 40)",
    expect: "!!document.querySelector('.lf-rhythm-notice')" },
  // The pause lives inside the Family Hub page, which owns the h1 and the first view.
  'pause-ready': { query: { screen: 'streakpause', pause: 'ready' }, band: 'adult', root: '.lf-streak-pause', screen: false, h1: 0 },
  'pause-active': { query: { screen: 'streakpause', pause: 'active' }, band: 'adult', root: '.lf-streak-pause', screen: false, h1: 0 },
  'pause-resting': { query: { screen: 'streakpause', pause: 'resting' }, band: 'adult', root: '.lf-streak-pause', screen: false, h1: 0 },
  'pause-error': { query: { screen: 'streakpause', pause: 'error' }, band: 'adult', root: '.lf-streak-pause', screen: false, h1: 0 },
  'pause-invalid': { query: { screen: 'streakpause', pause: 'ready' }, band: 'adult', root: '.lf-streak-pause', screen: false, h1: 0, act: invalidRange,
    expect: "document.querySelector('.lf-streak-pause-notice')?.getAttribute('role') === 'alert'" },
  // The one milestone moment on the list: lesson complete plus a 7-day streak (OD-7).
  'result-milestone': { query: { screen: 'resultmilestone' }, band: '6-9', root: '.lf-result', screen: true, h1: 1, celebrate: true },
  'quality-motivation': { query: { screen: 'learningquality' }, band: 'adult', root: '.lf-quality', screen: false, h1: 0 },
};
async function navigate({ state, locale, theme, width, scale, spacing, reduced = false }) {
  const spec = STATES[state];
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: theme },
    { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
  ] });
  const query = new URLSearchParams({ locale, theme, age: spec.band, ...spec.query }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector(${JSON.stringify(spec.root)})`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate(`(() => {
    document.documentElement.style.fontSize='${16 * scale}px';
    let style=document.getElementById('audit-spacing');
    if(!style){style=document.createElement('style');style.id='audit-spacing';document.head.append(style);}
    style.textContent=${JSON.stringify(spacing ? '.lf-rebuild * { letter-spacing:.12em !important; word-spacing:.16em !important; line-height:1.5 !important; }' : '')};
  })()`);
  if (spec.expand) await page.evaluate(`document.querySelectorAll(${JSON.stringify(spec.expand)}).forEach((e) => e.click())`);
  if (spec.act) { await page.evaluate(spec.act); await new Promise((done) => setTimeout(done, 150)); }
  if (spec.expect && !(await page.evaluate(spec.expect))) throw new Error(`${state}: the interaction did not reach its state`);
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

const audit = ({ state, locale, width, scale, spacing }) => {
  const spec = STATES[state];
  return `(() => {
  const issues=[],main=document.querySelector(${JSON.stringify(spec.root)});
  if(!main) return ['wrong-screen'];
  if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
  if(main.querySelectorAll('h1').length!==${spec.h1}) issues.push('h1-count');
  if(${spec.h1}===0&&${spec.heading !== false}&&main.querySelectorAll('h2').length<1) issues.push('no-section-heading');
  const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
  const sentences=t=>t.replace(/\\b(?:Dr|Mr|Mrs|Ms|Sr|Sra|Dra)\\./gu,'').replace(/(\\d)\\.(?=\\d)/gu,'$1').split(/[.!?…]+(?:\\s|$)/u).filter(p=>/[\\p{L}\\p{N}]/u.test(p)).length;
  const factor=${locale === 'en-US' ? 1 : 1.25};
  const young=${spec.band === '6-9'};
  const limits={action:3,heading:6,body:12,prompt:young?12:20,option:young?5:8,mentor:young?12:20,narrative:30};
  const maxSentences={heading:1,body:2,prompt:2,option:1,mentor:2,narrative:2};
  let fold=0;
  for(const e of main.querySelectorAll('[data-copy-role]')) {
    const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height) continue;
    const role=e.dataset.copyRole,text=e.textContent.trim();
    if(role in limits&&words(text)>Math.ceil(limits[role]*factor)) issues.push('copy:'+role+':'+text);
    if(role in maxSentences&&sentences(text)>maxSentences[role]) issues.push('sentences:'+role+':'+text);
    if(text.includes('—')) issues.push('em-dash:'+text);
    if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+text);
    if(r.right>innerWidth+1||r.left<-1) issues.push('offscreen:'+text);
    if(parseFloat(s.fontSize)<14) issues.push('text-size:'+text);
    if(r.top<740&&r.bottom>0&&!['data','brand','legal'].includes(role)&&!e.parentElement.closest('[data-copy-role]')) fold+=words(text);
  }
  if(${spec.screen}&&${width}===375&&${scale}===1&&!${spacing}&&fold>Math.ceil((young?25:40)*factor)) issues.push('first-view:'+fold);
  for(const e of main.querySelectorAll('button, input, select')){const r=e.getBoundingClientRect();if(!r.width) continue;if(r.width<48||r.height<48) issues.push('touch-target:'+(e.textContent.trim()||e.getAttribute('aria-label')||e.tagName));if(e.tagName==='BUTTON'){const range=document.createRange();range.selectNodeContents(e);const c=range.getBoundingClientRect().height;if(r.height>96&&r.height>c+64) issues.push('stretched-control:'+(e.textContent.trim()||e.tagName));}}
  const walker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode()){ const p=n.parentElement; if(n.textContent.trim()&&!p.closest('[data-copy-role]')&&p.tagName!=='OPTION') issues.push('no-copy-role:'+n.textContent.trim()); }
  if(/\\bTutor\\b|\\bbot\\b|\\blives?\\b|\\bvidas?\\b/.test(main.textContent)) issues.push('glossary');
  if(/confetti|lf-celebrat|lf-burst/i.test(main.innerHTML)) issues.push('celebration');
  if(!${spec.celebrate === true}&&main.querySelector('[data-celebrate]')) issues.push('celebration-outside-milestone');
  if(${spec.celebrate === true}&&[...main.querySelectorAll('[data-celebrate]')].map(e=>e.dataset.celebrate).join(',')!=='lesson-complete,streak-7') issues.push('milestone-not-celebrated');
  if(/freeze|congel|\\blost\\b|perdiste|perdeu|\\bbroke\\b/i.test(main.textContent)) issues.push('loss-or-freeze-copy');
  return issues;
})()`;
};

async function tab(times, predicate) {
  for (let n = 0; n < times; n++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    if (await page.evaluate(predicate)) return true;
  }
  return false;
}
const focusVisible = "(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; })()";
async function enter() {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await new Promise((done) => setTimeout(done, 200));
}

try {
  for (const state of Object.keys(STATES)) for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of width === 375 ? [false, true] : [false]) {
      await navigate({ state, locale, theme, width, scale, spacing });
      const issues = await page.evaluate(audit({ state, locale, width, scale, spacing }));
      configurations++;
      if (issues.length) findings.push({ state, locale, theme, width, scale, spacing, issues });
      const shoot = scale === 1 && !spacing && (
        (locale === 'es-MX' && width === 375 && ['rhythm-open', 'rhythm-resting', 'rhythm-choices', 'result-milestone', 'pause-ready'].includes(state))
        || (locale === 'en-US' && width === 1280 && ['rhythm-today', 'pause-active', 'result-milestone', 'quality-motivation'].includes(state))
        || (locale === 'pt-BR' && width === 320 && ['rhythm-paused', 'pause-invalid', 'rhythm-saved'].includes(state)));
      if (shoot) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(join(output, `${state}-${locale}-${width}-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  // Keyboard: the learner reaches the tabs, moves to Choices with an arrow, then a pace option, and chooses it with Enter.
  await navigate({ state: 'rhythm-open', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false });
  if (!(await tab(6, "document.activeElement?.getAttribute('role') === 'tab'"))) findings.push({ interaction: 'tabs-unreachable' });
  else {
    if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'tab-focus-not-visible' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await new Promise((done) => setTimeout(done, 100));
    if (!(await page.evaluate("document.activeElement?.getAttribute('aria-selected') === 'true' && document.activeElement.textContent === 'Choices'"))) findings.push({ interaction: 'tab-arrow-did-not-move' });
  }
  if (!(await tab(8, "document.activeElement?.getAttribute('role') === 'radio'"))) findings.push({ interaction: 'pace-unreachable' });
  else {
    if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'pace-focus-not-visible' });
    await enter();
    if (!(await page.evaluate("!!document.querySelector('.lf-rhythm-notice')"))) findings.push({ interaction: 'pace-not-saved-by-keyboard' });
  }

  // Keyboard: the parent reaches both dates and the Pause button.
  await navigate({ state: 'pause-ready', locale: 'en-US', theme: 'dark', width: 1280, scale: 1, spacing: false });
  if (!(await tab(6, "document.activeElement?.type === 'date'"))) findings.push({ interaction: 'pause-date-unreachable' });
  else {
    if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'pause-date-focus-not-visible' });
    // A date field is several tab stops in Chrome (day, month, year), so allow for two of them.
    if (!(await tab(12, "document.activeElement?.classList.contains('lf-button--accent') === true"))) findings.push({ interaction: 'pause-button-unreachable' });
    else if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'pause-button-focus-not-visible' });
  }

  // Reduced motion: no transition on controls, and the milestone medal does not pop.
  for (const state of ['rhythm-open', 'rhythm-choices', 'pause-ready', 'result-milestone']) {
    await navigate({ state, locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false, reduced: true });
    const motion = await page.evaluate("[...document.querySelectorAll('.lf-button, .lf-rhythm-tab, .lf-result-medal, .lf-result-streak')].map(e => { const s = getComputedStyle(e); return [s.transitionDuration, s.animationName]; }).filter(([d, a]) => d.split(',').some(p => parseFloat(p) > 0) || (a && a !== 'none'))");
    if (motion.length) findings.push({ state, interaction: 'motion-under-reduced-motion', motion });
  }
  // With motion allowed, the milestone medal DOES pop: the one celebration on the list.
  await navigate({ state: 'result-milestone', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false });
  if ((await page.evaluate("getComputedStyle(document.querySelector('.lf-result-medal')).animationName")) !== 'lf-result-pop') findings.push({ interaction: 'milestone-medal-does-not-pop' });

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Preview fixtures of the S05.3e learner rhythm, guardian holiday pause, milestone result and staff motivation signals; the authenticated routes render the answers Core returns.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 20), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
