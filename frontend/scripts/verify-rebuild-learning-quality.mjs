import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * S05.3d real-Chrome matrix (preview fixtures; the authenticated routes render
 * Core's own answers): the B.12 decide-and-justify board (every age band,
 * before and after grading), the B.5 result with Core's replay notice and
 * judgment count, the B.15 placement outcome frames, and the staff
 * learning-quality panel (B.19, B.12 and B.5 metrics) in its ready, empty,
 * loading, error and band-form states.
 *
 * Every state in 3 locales x 2 themes x 320/375/768/1280 px, at 100% and 140%
 * text, with WCAG 1.4.12 spacing at 375 px. Checks: heading structure, no
 * horizontal scroll, the Copy Budget per role and band, the first-view word
 * limit for full screens, no clipped or off-screen text, no text under 14 px,
 * 48 px targets, no stretched button, a copy role on every text node, the
 * glossary, no celebration, keyboard reach with a visible focus ring, and no
 * motion under reduced motion.
 *
 *   REBUILD_URL=http://localhost:5320 node scripts/verify-rebuild-learning-quality.mjs
 *   REPORT_DIR=../.lane-cache/rebuild-learning-quality (optional)
 */

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve(process.env.REPORT_DIR ?? '../audit-results/rebuild-learning-quality');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

/** Picks a decision that does not work and a sound reason, then checks: both feedback lines appear. */
const graded = `new Promise((done) => { document.querySelectorAll('.lf-reasoning-option')[1]?.click();
  setTimeout(() => { document.querySelectorAll('.lf-reasoning-option')[2]?.click();
    setTimeout(() => { document.querySelector('.lf-learning-actions .lf-button')?.click(); setTimeout(done, 120); }, 40); }, 40); })`;

/** Each state: its preview query, the Copy Budget band it is written for, its root, and whether it is a full screen. */
const STATES = {
  'reasoning-6-9': { query: { screen: 'reasoning' }, band: '6-9', root: '.lf-learning--reasoning', screen: true, h1: 1 },
  'reasoning-10-12': { query: { screen: 'reasoning' }, band: '10-12', root: '.lf-learning--reasoning', screen: true, h1: 1 },
  'reasoning-13-17': { query: { screen: 'reasoning' }, band: '13-17', root: '.lf-learning--reasoning', screen: true, h1: 1 },
  'reasoning-adult': { query: { screen: 'reasoning' }, band: 'adult', root: '.lf-learning--reasoning', screen: true, h1: 1 },
  // After a check: the decision verdict and the reason quality as two lines (the second layer, not the first view).
  'reasoning-graded': { query: { screen: 'reasoning' }, band: '6-9', root: '.lf-learning--reasoning', screen: false, h1: 1, act: graded,
    expect: "document.querySelectorAll('.lf-reasoning-feedback-lines p').length === 2" },
  'result-kept': { query: { screen: 'resultkept' }, band: '6-9', root: '.lf-result', screen: true, h1: 1 },
  'result-replay': { query: { screen: 'replay' }, band: '6-9', root: '.lf-result', screen: true, h1: 1 },
  'placement-beginning': { query: { screen: 'placementoutcome', start: 'beginning' }, band: '6-9', root: '.lf-placement-outcome', screen: true, h1: 1 },
  'placement-further': { query: { screen: 'placementoutcome', start: 'further_in' }, band: '6-9', root: '.lf-placement-outcome', screen: true, h1: 1 },
  'placement-chosen': { query: { screen: 'placementoutcome', start: 'further_in', path: 'learner_adjusted' }, band: '6-9', root: '.lf-placement-outcome', screen: true, h1: 1 },
  // The staff panel sits inside the staff console, which owns the h1 and the first view.
  'quality': { query: { screen: 'learningquality' }, band: 'adult', root: '.lf-quality', screen: false, h1: 0 },
  'quality-empty': { query: { screen: 'learningquality', quality: 'empty' }, band: 'adult', root: '.lf-quality', screen: false, h1: 0 },
  'quality-loading': { query: { screen: 'learningquality', quality: 'loading' }, band: 'adult', root: '.lf-quality', screen: false, h1: 0 },
  'quality-error': { query: { screen: 'learningquality', quality: 'error' }, band: 'adult', root: '.lf-quality', screen: false, h1: 0 },
  'quality-band-form': { query: { screen: 'learningquality' }, band: 'adult', root: '.lf-quality', screen: false, h1: 0,
    act: "[...document.querySelectorAll('.lf-quality-decision')][1]?.click()", expect: "!!document.querySelector('.lf-quality-band input')" },
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
  if(/confetti|lf-celebrat/i.test(main.innerHTML)) issues.push('celebration');
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
        (locale === 'es-MX' && width === 375 && ['reasoning-6-9', 'reasoning-graded', 'result-kept', 'placement-further', 'quality'].includes(state))
        || (locale === 'en-US' && width === 1280 && ['reasoning-13-17', 'result-kept', 'placement-beginning', 'quality', 'quality-band-form'].includes(state))
        || (locale === 'pt-BR' && width === 320 && ['reasoning-graded', 'placement-chosen'].includes(state)));
      if (shoot) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(join(output, `${state}-${locale}-${width}-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  // Keyboard: a learner picks a decision and a reason and checks, with a visible focus ring, never touching the mouse.
  await navigate({ state: 'reasoning-10-12', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false });
  if (!(await tab(6, "document.activeElement?.classList.contains('lf-reasoning-option') === true"))) findings.push({ interaction: 'reasoning-choice-unreachable' });
  else {
    if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'reasoning-focus-not-visible' });
    await enter();
    if (!(await tab(4, "document.activeElement?.closest('[aria-labelledby=reasoning-reason-title]') !== null"))) findings.push({ interaction: 'reasoning-reason-unreachable' });
    else {
      await enter();
      if (!(await tab(6, "document.activeElement?.classList.contains('lf-button--accent') === true && !document.activeElement.disabled"))) findings.push({ interaction: 'reasoning-check-unreachable' });
      else {
        await enter();
        const lines = await page.evaluate("document.querySelectorAll('.lf-reasoning-feedback-lines p').length");
        if (lines !== 2) findings.push({ interaction: 'reasoning-feedback-lines', lines });
      }
    }
  }

  // Keyboard: the staff reviewer reaches a decision and then the note field.
  await navigate({ state: 'quality', locale: 'en-US', theme: 'dark', width: 1280, scale: 1, spacing: false });
  if (!(await tab(8, "document.activeElement?.classList.contains('lf-quality-decision') === true"))) findings.push({ interaction: 'quality-decision-unreachable' });
  else {
    if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'quality-focus-not-visible' });
    await enter();
    if (!(await tab(6, "document.activeElement?.tagName === 'TEXTAREA'"))) findings.push({ interaction: 'quality-note-unreachable' });
    else if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'quality-note-focus-not-visible' });
  }

  // Reduced motion: no transition on options, decisions or buttons.
  for (const state of ['reasoning-6-9', 'quality', 'placement-further', 'result-kept']) {
    await navigate({ state, locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false, reduced: true });
    const motion = await page.evaluate("[...document.querySelectorAll('.lf-reasoning-option, .lf-quality-decision, .lf-button')].map(e => getComputedStyle(e).transitionDuration).filter(d => d.split(',').some(p => parseFloat(p) > 0))");
    if (motion.length) findings.push({ state, interaction: 'motion-under-reduced-motion', motion });
  }

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Preview fixtures of the S05.3d reasoning board, result receipt, placement outcome and staff learning-quality panel; the authenticated routes render the answers Core returns.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 20), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
