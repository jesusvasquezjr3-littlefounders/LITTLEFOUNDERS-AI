import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * S05.3f real-Chrome matrix (preview fixtures; the authenticated routes render
 * Core's own answers): the B.23 graduation card (into 10-12 and into 13-17,
 * and a save that failed), the B.26 guided-review offer in each of the four
 * registers (with and without a skill title), and the lesson result framed
 * per register (a medal and a tally for the young registers, capability data
 * for teens and adults).
 *
 * Every state in 3 locales x 2 themes x 320/375/768/1280 px, at 100% and 140%
 * text, with WCAG 1.4.12 spacing at 375 px. Checks: heading structure, no
 * horizontal scroll, the Copy Budget per role in the register's own band, the
 * first-view limit for full screens, no clipped or off-screen text, no text
 * under 14 px, 48 px targets, no stretched button, a copy role on every text
 * node, the glossary and no loss or shame words, no celebration outside the
 * young registers' lesson-complete medal (OD-7), the offer never a dialog and
 * never on the error hue, keyboard reach with a visible focus ring, Escape
 * declining the offer, and no motion under reduced motion.
 *
 *   REBUILD_URL=http://localhost:5320 node scripts/verify-rebuild-wellbeing.mjs
 *   REPORT_DIR=../.lane-cache/rebuild-wellbeing (optional)
 */

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve(process.env.REPORT_DIR ?? '../audit-results/rebuild-wellbeing');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

const BAND = { young: '6-9', transition: '10-12', teen: '13-17', adult: 'adult' };
/** Each state: its preview query, the band it is written for, its root, whether it is a full screen, and its celebration. */
const STATES = {
  'graduation-transition': { query: { screen: 'graduation', into: 'transition' }, band: '10-12', root: '.lf-graduation', screen: false, h1: 0 },
  'graduation-teen': { query: { screen: 'graduation', into: 'teen' }, band: '13-17', root: '.lf-graduation', screen: false, h1: 0 },
  'graduation-failed': { query: { screen: 'graduation', into: 'transition', save: 'fail' }, band: '10-12', root: '.lf-graduation', screen: false, h1: 0,
    act: "document.querySelector('.lf-graduation .lf-button')?.click()", expect: "!!document.querySelector('.lf-graduation-failed')" },
  ...Object.fromEntries(Object.keys(BAND).map((register) => [`offer-${register}`, {
    query: { screen: 'guidedreview', register }, band: BAND[register], root: '.lf-guided-review', screen: false, h1: 0, offer: true }])),
  'offer-young-noskill': { query: { screen: 'guidedreview', register: 'young', skill: '0' }, band: '6-9', root: '.lf-guided-review', screen: false, h1: 0, offer: true },
  ...Object.fromEntries(Object.keys(BAND).map((register) => [`result-${register}`, {
    query: { screen: 'resultregister', register }, band: BAND[register], root: '.lf-result', screen: true, h1: 1,
    celebrate: register === 'young' || register === 'transition' ? 'lesson-complete' : '' }])),
};

async function navigate({ state, locale, theme, width, scale, spacing, reduced = false }) {
  const spec = STATES[state];
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: theme },
    { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
  ] });
  const query = new URLSearchParams({ locale, theme, ...spec.query }).toString();
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
  if (spec.act) { await page.evaluate(spec.act); await new Promise((done) => setTimeout(done, 200)); }
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
  if(${spec.h1}===0&&main.querySelectorAll('h2').length<1) issues.push('no-section-heading');
  if(main.dataset.ageBand!==${JSON.stringify(spec.band)}) issues.push('age-band:'+main.dataset.ageBand);
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
  for(let n=walker.nextNode();n;n=walker.nextNode()){ const p=n.parentElement; if(n.textContent.trim()&&!p.closest('[data-copy-role]')) issues.push('no-copy-role:'+n.textContent.trim()); }
  if(/\\bTutor\\b|\\bbot\\b|\\blives?\\b|\\bvidas?\\b|\\bhearts?\\b|corazones|corações/i.test(main.textContent)) issues.push('glossary-or-lives');
  if(/\\bfail|\\bwrong\\b|mistake|fallaste|equivoc|errou|falhou|you'?re not|no eres|você não é/i.test(main.textContent)) issues.push('shame-or-failure-words');
  if(/confetti|lf-burst/i.test(main.innerHTML)) issues.push('celebration');
  const celebrated=[...main.querySelectorAll('[data-celebrate]')].map(e=>e.dataset.celebrate).join(',');
  if(celebrated!==${JSON.stringify(spec.celebrate ?? '')}) issues.push('celebration:'+celebrated);
  if(${spec.offer === true}){
    if(main.closest('[role=dialog],[aria-modal]')||main.querySelector('[role=dialog],[aria-modal]')) issues.push('offer-is-a-dialog');
    if(getComputedStyle(main).position!=='fixed') issues.push('offer-not-anchored-to-viewport');
    const r=main.getBoundingClientRect(); if(r.bottom>innerHeight+1||r.top<0) issues.push('offer-outside-viewport');
    const probe=document.createElement('span');probe.style.color='var(--error)';main.append(probe);const error=getComputedStyle(probe).color;const soft=(probe.style.color='var(--error-soft)',getComputedStyle(probe).color);probe.remove();
    const bg=getComputedStyle(main).backgroundColor; if(bg===error||bg===soft) issues.push('offer-on-error-hue');
  }
  return issues;
})()`;
};

async function key(name, code, keyCode) {
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode });
}
async function tab(times, predicate) {
  for (let n = 0; n < times; n++) {
    await key('Tab', 'Tab', 9);
    if (await page.evaluate(predicate)) return true;
  }
  return false;
}
const focusVisible = "(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; })()";

try {
  for (const state of Object.keys(STATES)) for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of width === 375 ? [false, true] : [false]) {
      await navigate({ state, locale, theme, width, scale, spacing });
      const issues = await page.evaluate(audit({ state, locale, width, scale, spacing }));
      configurations++;
      if (issues.length) findings.push({ state, locale, theme, width, scale, spacing, issues });
      const shoot = scale === 1 && !spacing && (
        (locale === 'es-MX' && width === 375 && ['graduation-transition', 'offer-young', 'offer-teen', 'result-teen'].includes(state))
        || (locale === 'en-US' && width === 1280 && ['graduation-teen', 'offer-transition', 'result-young'].includes(state))
        || (locale === 'pt-BR' && width === 320 && ['graduation-failed', 'offer-adult', 'result-adult'].includes(state)));
      if (shoot) {
        await new Promise((done) => setTimeout(done, 400));
        const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        writeFileSync(join(output, `${state}-${locale}-${width}-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  // Keyboard: the learner reaches both offer buttons with a visible ring, and Escape declines.
  await navigate({ state: 'offer-young', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false });
  if (!(await tab(6, "document.activeElement?.classList.contains('lf-button--accent') === true"))) findings.push({ interaction: 'offer-review-unreachable' });
  else if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'offer-review-focus-not-visible' });
  if (!(await tab(3, "document.activeElement?.textContent === 'Keep going'"))) findings.push({ interaction: 'offer-decline-unreachable' });
  else if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'offer-decline-focus-not-visible' });
  await key('Escape', 'Escape', 27);
  await new Promise((done) => setTimeout(done, 200));
  if (await page.evaluate("!!document.querySelector('.lf-guided-review')")) findings.push({ interaction: 'escape-did-not-decline' });

  // Keyboard: the graduation's one action is reachable and acknowledges with Enter.
  await navigate({ state: 'graduation-transition', locale: 'es-MX', theme: 'dark', width: 1280, scale: 1, spacing: false });
  if (!(await tab(6, "document.activeElement?.closest('.lf-graduation') !== null && document.activeElement.tagName === 'BUTTON'"))) findings.push({ interaction: 'graduation-action-unreachable' });
  else {
    if (!(await page.evaluate(focusVisible))) findings.push({ interaction: 'graduation-focus-not-visible' });
    await key('Enter', 'Enter', 13);
    await new Promise((done) => setTimeout(done, 200));
    if (await page.evaluate("!!document.querySelector('.lf-graduation-failed')")) findings.push({ interaction: 'graduation-not-acknowledged' });
  }

  // Reduced motion: nothing on these surfaces moves.
  for (const state of ['graduation-teen', 'offer-transition', 'result-young']) {
    await navigate({ state, locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false, reduced: true });
    const motion = await page.evaluate("[...document.querySelectorAll('.lf-button, .lf-graduation, .lf-guided-review, .lf-result-medal')].map(e => { const s = getComputedStyle(e); return [s.transitionDuration, s.animationName]; }).filter(([d, a]) => d.split(',').some(p => parseFloat(p) > 0) || (a && a !== 'none'))");
    if (motion.length) findings.push({ state, interaction: 'motion-under-reduced-motion', motion });
  }

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Preview fixtures of the S05.3f graduation card, guided-review offer and register-framed lesson result; the authenticated routes render the answers Core returns.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 20), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
