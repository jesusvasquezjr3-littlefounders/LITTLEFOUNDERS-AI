import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * B.6 / S05.3b — real-Chrome matrix for the rebuilt course path (preview
 * fixtures; the authenticated route renders Core's own answer). Every state
 * the server can produce, in 3 locales x 2 themes x 320/375/768/1280 px, at
 * 100% and 140% text, with WCAG 1.4.12 spacing at 375 px. Checks: one h1, no
 * horizontal scroll, the Copy Budget per role (youngest band for child
 * states), the first-view word limit, no clipped text, no text under 14 px,
 * 48 px targets, a copy role on every text node, keyboard activation of the
 * recommendation, and no motion under reduced motion.
 *
 *   REBUILD_URL=http://localhost:5320 node scripts/verify-rebuild-course-path.mjs
 *   REPORT_DIR=../.lane-cache/rebuild-course-path (optional)
 */

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve(process.env.REPORT_DIR ?? '../audit-results/rebuild-course-path');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

/** Which Copy Budget band each fixture is written for: the learner it represents. */
const STATES = {
  child: '6-9', complete: '6-9', age: '6-9', prerequisite: '6-9', error: '6-9', loading: '6-9',
  bridge: '10-12', placement: '13-17', adult: 'adult',
};

async function navigate({ state, locale, theme, width, scale, spacing, reduced = false }) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  await page.send('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-color-scheme', value: theme },
    { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
  ] });
  const query = new URLSearchParams({ locale, theme, screen: 'coursepath', path: state, age: STATES[state] }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let n = 0; n < 100; n++) {
    if (await page.evaluate(`location.search === ${JSON.stringify('?' + query)} && !!document.querySelector('.lf-course-path')`)) break;
    await new Promise((done) => setTimeout(done, 50));
  }
  await page.evaluate('document.fonts.ready');
  await page.evaluate(`(() => {
    document.documentElement.style.fontSize='${16 * scale}px';
    let style=document.getElementById('audit-spacing');
    if(!style){style=document.createElement('style');style.id='audit-spacing';document.head.append(style);}
    style.textContent=${JSON.stringify(spacing ? '.lf-rebuild * { letter-spacing:.12em !important; word-spacing:.16em !important; line-height:1.5 !important; }' : '')};
  })()`);
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}

const audit = ({ locale, width, scale, spacing, band }) => `(() => {
  const issues=[],main=document.querySelector('.lf-course-path');
  if(!main) return ['wrong-screen'];
  if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
  if(main.querySelectorAll('h1').length!==1) issues.push('heading-count');
  const words=t=>(t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu)||[]).length;
  const factor=${locale === 'en-US' ? 1 : 1.25};
  const young=${band === '6-9'};
  const limits={action:3,heading:6,body:12,prompt:young?12:20,option:young?5:8,mentor:young?12:20,narrative:30};
  let fold=0;
  for(const e of main.querySelectorAll('[data-copy-role]')) {
    const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height) continue;
    const role=e.dataset.copyRole,text=e.textContent.trim();
    if(role in limits&&words(text)>Math.ceil(limits[role]*factor)) issues.push('copy:'+role+':'+text);
    if(text.includes('—')) issues.push('em-dash:'+text);
    if((s.overflowX!=='visible'&&e.scrollWidth>e.clientWidth+1)||(s.overflowY!=='visible'&&e.scrollHeight>e.clientHeight+1)) issues.push('text-overflow:'+text);
    if(r.right>innerWidth+1||r.left<-1) issues.push('offscreen:'+text);
    if(parseFloat(s.fontSize)<14) issues.push('text-size:'+text);
    if(r.top<740&&r.bottom>0&&!['data','brand','legal'].includes(role)&&!e.parentElement.closest('[data-copy-role]')) fold+=words(text);
  }
  if(${width}===375&&${scale}===1&&!${spacing}&&fold>Math.ceil((young?25:40)*factor)) issues.push('first-view:'+fold);
  for(const e of main.querySelectorAll('button')){const r=e.getBoundingClientRect();if(r.width<48||r.height<48) issues.push('touch-target:'+e.textContent.trim());}
  const walker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode()){ if(n.textContent.trim()&&!n.parentElement.closest('[data-copy-role]')) issues.push('no-copy-role:'+n.textContent.trim()); }
  if(/\\bTutor\\b/.test(main.textContent)) issues.push('glossary:Tutor');
  return issues;
})()`;

try {
  for (const state of Object.keys(STATES)) for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of width === 375 ? [false, true] : [false]) {
      await navigate({ state, locale, theme, width, scale, spacing });
      const issues = await page.evaluate(audit({ locale, width, scale, spacing, band: STATES[state] }));
      configurations++;
      if (issues.length) findings.push({ state, locale, theme, width, scale, spacing, issues });
      if (scale === 1 && !spacing && ((locale === 'es-MX' && width === 375) || (locale === 'en-US' && width === 1280 && state === 'child'))) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        writeFileSync(join(output, `${state}-${locale}-${width}-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
    }

  // Keyboard: Tab to the recommendation and press Enter; the preview opens the lesson.
  await navigate({ state: 'child', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false });
  let reached = false;
  for (let n = 0; n < 12 && !reached; n++) {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    reached = await page.evaluate("document.activeElement?.closest('.lf-course-path-hero') !== null && document.activeElement?.tagName === 'BUTTON'");
  }
  if (!reached) findings.push({ interaction: 'keyboard-cannot-reach-recommendation' });
  else {
    const visible = await page.evaluate("(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; })()");
    if (!visible) findings.push({ interaction: 'focus-not-visible' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await new Promise((done) => setTimeout(done, 200));
    if (await page.evaluate("!!document.querySelector('.lf-course-path')")) findings.push({ interaction: 'enter-did-not-open-lesson' });
  }

  // Reduced motion: no transition on the pressable items.
  await navigate({ state: 'adult', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false, reduced: true });
  const motion = await page.evaluate("[...document.querySelectorAll('.lf-course-path-item')].map(e => getComputedStyle(e).transitionDuration).filter(d => d.split(',').some(p => parseFloat(p) > 0))");
  if (motion.length) findings.push({ interaction: 'motion-under-reduced-motion', motion });

  // Show more reveals the rest of the open lessons and is announced as expanded.
  await navigate({ state: 'child', locale: 'en-US', theme: 'light', width: 375, scale: 1, spacing: false });
  const expanded = await page.evaluate(`(async () => {
    const before=document.querySelectorAll('.lf-course-path-item').length;
    const more=[...document.querySelectorAll('.lf-course-path-section .lf-button')].find(b=>b.getAttribute('aria-expanded')==='false');
    if(!more) return {before,after:before,expanded:null};
    more.click(); await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return {before,after:document.querySelectorAll('.lf-course-path-item').length,expanded:more.getAttribute('aria-expanded')};
  })()`);
  if (!(expanded.after > expanded.before && expanded.expanded === 'true')) findings.push({ interaction: 'show-more-failed', expanded });

  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Preview fixtures of GET /learn/courses/:slug/path; the authenticated route renders Core\'s own answer.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 15), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
