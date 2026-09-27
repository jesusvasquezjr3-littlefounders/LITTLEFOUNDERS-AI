import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * B.9 / B.10 / B.13 (S05.3c) — real-Chrome matrix for the rebuilt narrative
 * surfaces (preview fixtures; the authenticated routes render Core's own
 * answers): the "Remember this?" recall, the learner's decision journal (with
 * an independent teen's "try it for real" prompt), the learner shortcut on the
 * learning home, and the guardian's Family
 * Hub sections (course-learning narrative and bridge prompts).
 *
 * Every state in 3 locales x 2 themes x 320/375/768/1280 px, at 100% and 140%
 * text, with WCAG 1.4.12 spacing at 375 px. Checks: heading structure, no
 * horizontal scroll, the Copy Budget per role and band, the first-view word
 * limit for full screens, no clipped or off-screen text, no text under 14 px,
 * 48 px targets (buttons, inputs, selects), no button stretched by its host far
 * past its own content, a copy role on every text node,
 * the glossary, keyboard reach with a visible focus ring, and no motion under
 * reduced motion.
 *
 *   REBUILD_URL=http://localhost:5320 node scripts/verify-rebuild-narrative.mjs
 *   REPORT_DIR=../.lane-cache/rebuild-narrative (optional)
 */

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve(process.env.REPORT_DIR ?? '../audit-results/rebuild-narrative');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

/** Each state: its preview query, the Copy Budget band it is written for, its root, and whether it is a full screen. */
const STATES = {
  'recall': { query: { screen: 'recall' }, band: '6-9', root: '.lf-recall', screen: true, h1: 1 },
  'recall-unchanged': { query: { screen: 'recall', changed: '0' }, band: '6-9', root: '.lf-recall', screen: true, h1: 1 },
  // The second layer (Bible 06): audited expanded, but it is not the first view.
  'recall-open': { query: { screen: 'recall' }, band: '6-9', root: '.lf-recall', screen: false, h1: 1, expand: '.lf-recall-inner > .lf-button' },
  'journal-open': { query: { screen: 'journal', journal: 'teen' }, band: '6-9', root: '.lf-journal', screen: false, h1: 1, expand: '.lf-journal-toggle' },
  'journal': { query: { screen: 'journal', journal: 'list' }, band: '6-9', root: '.lf-journal', screen: true, h1: 1 },
  'journal-teen': { query: { screen: 'journal', journal: 'teen' }, band: '13-17', root: '.lf-journal', screen: true, h1: 1 },
  'journal-empty': { query: { screen: 'journal', journal: 'empty' }, band: '6-9', root: '.lf-journal', screen: true, h1: 1 },
  'journal-loading': { query: { screen: 'journal', journal: 'loading' }, band: '6-9', root: '.lf-journal', screen: true, h1: 1 },
  'journal-error': { query: { screen: 'journal', journal: 'error' }, band: '6-9', root: '.lf-journal', screen: true, h1: 1 },
  // The learner shortcut sits on the learning home, which owns the h1; without a prompt it is one link and no heading.
  'shortcut': { query: { screen: 'learnershortcut' }, band: '6-9', root: '.lf-learner-shortcut', screen: false, h1: 0, heading: false },
  'shortcut-teen': { query: { screen: 'learnershortcut', bridges: '1' }, band: '13-17', root: '.lf-learner-shortcut', screen: false, h1: 0 },
  // Family Hub sections sit inside the Family page, which owns the h1 and the first view.
  'family': { query: { screen: 'familylearning' }, band: 'adult', root: '.lf-family-preview', screen: false, h1: 0 },
  'family-empty': { query: { screen: 'familylearning', narrative: 'empty', bridges: '0' }, band: 'adult', root: '.lf-family-preview', screen: false, h1: 0 },
  'family-error': { query: { screen: 'familylearning', narrative: 'error' }, band: 'adult', root: '.lf-family-preview', screen: false, h1: 0 },
  'family-closed': { query: { screen: 'familylearning', open: '0' }, band: 'adult', root: '.lf-family-preview', screen: false, h1: 0 },
  // W3L.1 (OD-27 (3), L-13): an under-13 child's story choices in the Tutor's narrative.
  'family-choices': { query: { screen: 'familylearning', narrative: 'choices' }, band: 'adult', root: '.lf-family-preview', screen: false, h1: 0 },
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
/*
 * A visible focus ring, wherever the shared control draws it (S03.1): an outline on the element; the inset focus ring
 * of a shared TextField input (its box-shadow in the focus colour; transparent when unfocused); or the outline on the
 * option of a shared RadioGroup or SegmentedControl, whose native input is visually hidden.
 */
const focusVisible = `(() => {
  const outlined = (el) => { if (!el) return false; const s = getComputedStyle(el); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; };
  const insetRing = (el) => { if (!el || !el.matches('.lf-input')) return false; const first = getComputedStyle(el).boxShadow.split(/,(?![^(]*\\))/)[0].trim();
    return first !== 'none' && /\\binset\\b/.test(first) && !/^rgba\\([^)]*,\\s*0\\)/.test(first); };
  const e = document.activeElement;
  return outlined(e) || insetRing(e) || outlined(e && e.closest('.lf-radio-option, .lf-segmented-option'));
})()`;
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
        (locale === 'es-MX' && width === 375 && ['recall', 'journal-teen', 'family', 'shortcut-teen'].includes(state))
        || (locale === 'en-US' && width === 1280 && ['recall', 'journal', 'family'].includes(state))
        || (locale === 'pt-BR' && width === 320 && state === 'family'));
      if (shoot) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(join(output, `${state}-${locale}-${width}-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  // Keyboard: "What happened" opens with Enter; Continue is reachable, visibly focused, and Enter moves on.
  await navigate({ state: 'recall', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false });
  if (!(await tab(8, "document.activeElement?.getAttribute('aria-expanded') === 'false'"))) findings.push({ interaction: 'recall-disclosure-unreachable' });
  else {
    await enter();
    if (!(await page.evaluate("document.activeElement?.getAttribute('aria-expanded') === 'true' && !!document.getElementById(document.activeElement.getAttribute('aria-controls'))"))) findings.push({ interaction: 'recall-disclosure-did-not-open' });
  }
  if (!(await tab(8, "document.activeElement?.classList.contains('lf-button--accent') === true"))) findings.push({ interaction: 'recall-continue-unreachable' });
  else {
    if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'recall-focus-not-visible' });
    await enter();
    if (await page.evaluate("!!document.querySelector('.lf-recall')")) findings.push({ interaction: 'recall-enter-did-not-continue' });
  }

  // Keyboard: an independent teen reaches "I will try" and answers it.
  await navigate({ state: 'journal-teen', locale: 'en-US', theme: 'dark', width: 375, scale: 1, spacing: false });
  if (!(await tab(10, "document.activeElement?.closest('.lf-bridge-self') !== null"))) findings.push({ interaction: 'teen-bridge-unreachable' });
  else {
    if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'teen-bridge-focus-not-visible' });
    await enter();
    if (!(await page.evaluate("document.querySelector('.lf-bridge-self [role=status]')?.textContent === 'Saved as your plan.'"))) findings.push({ interaction: 'teen-bridge-not-answered' });
  }

  // Keyboard: the guardian opens a goal form and every field is reachable and at least 48 px.
  await navigate({ state: 'family', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false });
  if (!(await tab(6, "document.activeElement?.closest('.lf-family-bridge') !== null && document.activeElement?.tagName === 'BUTTON'"))) findings.push({ interaction: 'guardian-bridge-unreachable' });
  else {
    await enter();
    const form = await page.evaluate("(() => { const f = document.querySelector('.lf-family-bridge-form'); if (!f) return null; return [...f.querySelectorAll('input, select, button')].map(e => Math.round(e.getBoundingClientRect().height)); })()");
    if (!form) findings.push({ interaction: 'guardian-form-did-not-open' });
    else if (form.some((h) => h < 48)) findings.push({ interaction: 'guardian-form-target', form });
    if (!(await tab(3, "document.activeElement?.tagName === 'INPUT'"))) findings.push({ interaction: 'guardian-form-field-unreachable' });
    else if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'guardian-field-focus-not-visible' });
  }

  // Reduced motion: no transition on the pressable segments (the shared SegmentedControl) or buttons.
  await navigate({ state: 'family', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false, reduced: true });
  await page.evaluate("document.querySelectorAll('.lf-family-bridge .lf-button--accent')[1]?.click()");
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const motion = await page.evaluate("[...document.querySelectorAll('.lf-segmented-option, .lf-button')].map(e => getComputedStyle(e).transitionDuration).filter(d => d.split(',').some(p => parseFloat(p) > 0))");
  if (motion.length) findings.push({ interaction: 'motion-under-reduced-motion', motion });

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Preview fixtures of the S05.3c recall, journal, learner shortcut and Family Hub sections; the authenticated routes render Core\'s own answers.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 20), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
