import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * M7 bar model in a real browser (GAP-FIX-R3: Appendix P M7; Bible 05 §4 Build and §7). The board starts empty; the
 * learner adds bars and fills each slot from its picker; the unknown is a dashed "?" segment; the arithmetic step
 * opens only after the structure is met and draws the bars the learner built. Every locale, both themes, four widths,
 * 1.4x text and WCAG text spacing: no horizontal scroll, one h1, 48 px targets, nothing answered before the build.
 */
const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190', output = resolve('../audit-results/rebuild-bar-model');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-'))), page = await openPage(browser.browser, { width: 375, height: 740, dark: false }), findings = [];
let configurations = 0;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function go(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const q = new URLSearchParams({ locale, theme, screen: 'barmodel', age }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${q}` });
  for (let n = 0; n < 100; n++) { if (await page.evaluate(`!!document.querySelector('[data-screen="${age === '10-12' ? 'bar-model' : 'lesson-unavailable'}"]')`)) break; await wait(50); }
  await page.evaluate(`document.fonts.ready.then(()=>{document.documentElement.style.fontSize='${16 * scale}px';let s=document.querySelector('#audit-spacing');if(!s){s=document.createElement('style');s.id='audit-spacing';document.head.append(s);}s.textContent=${JSON.stringify(spacing ? '.lf-rebuild *{letter-spacing:.12em!important;word-spacing:.16em!important;line-height:1.5!important;}' : '')};})`);
}

/** Clicks through the pilot's build: two bars, the total, then each slot from its picker (menu items in document order). */
async function build() {
  const click = (selector, index = 0) => page.evaluate(`(() => { const all = [...document.querySelectorAll(${JSON.stringify(selector)})]; all[${index}]?.click(); return !!all[${index}]; })()`);
  await click('.lf-bar-model-add button', 1); await wait(30);
  await click('.lf-bar-model-add button', 0); await wait(30);
  // Slots in order: smaller, larger, difference, total. Menu items: quantity 1 (together), quantity 2 (12 more), ?, no number.
  for (const [slot, item] of [['smaller', 2], ['difference', 1], ['total', 0]]) {
    await click(`[data-slot="${slot}"]`); await wait(60);
    await click('[role=menuitem]', item); await wait(60);
  }
}

const measure = `(()=>{const m=document.querySelector('[data-screen=bar-model]'),x=[];if(!m)return['wrong-screen'];if(document.documentElement.scrollWidth>innerWidth+1)x.push('horizontal-scroll');if(m.querySelectorAll('h1').length!==1)x.push('heading');
  if(m.querySelector('.lf-bar-model-row'))x.push('board-not-empty-at-start');if(m.querySelector('input:not([type=radio])'))x.push('answer-visible-before-structure');
  if(m.querySelectorAll('.lf-bar-model-add button').length!==2)x.push('add-bars');if(!m.querySelector('.lf-learning-actions button')?.disabled)x.push('check-enabled-on-empty-board');
  for(const e of m.querySelectorAll('button')){const r=e.getBoundingClientRect();if(r.width<48||r.height<48)x.push('target');}return [...new Set(x)]})()`;
const built = `(()=>{const m=document.querySelector('[data-screen=bar-model]'),x=[];if(m.querySelectorAll('.lf-bar-model-row').length!==2)x.push('bars');const u=m.querySelector('.lf-pz-seg--unknown');
  if(!u||u.textContent!=='?'||getComputedStyle(u).borderStyle.indexOf('dashed')<0)x.push('unknown-not-dashed-question-mark');if(document.documentElement.scrollWidth>innerWidth+1)x.push('horizontal-scroll');
  for(const e of m.querySelectorAll('button')){const r=e.getBoundingClientRect();if(r.width<48||r.height<48)x.push('target');}if(m.querySelector('.lf-learning-actions button')?.disabled)x.push('check-disabled-on-complete-build');return x})()`;

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
    await go(locale, theme, '10-12', width, scale, spacing);
    const issues = await page.evaluate(measure);
    await build();
    issues.push(...await page.evaluate(built));
    configurations++;
    if (issues.length) findings.push({ locale, theme, width, scale, spacing, issues: [...new Set(issues)] });
  }
  // The flow: a met build opens the arithmetic, which draws the same bars.
  await go('es-MX', 'light', '10-12', 375, 1, false);
  await build();
  await page.evaluate(`document.querySelector('.lf-learning-actions button')?.click()`); await wait(50);
  await page.evaluate(`document.querySelector('.lf-learning-actions button')?.click()`); await wait(50);
  const flow = await page.evaluate(`({input:!!document.querySelector('input:not([type=radio])'),title:document.querySelector('h2')?.textContent,bars:document.querySelectorAll('.lf-bar-model-row').length})`);
  if (!flow.input || flow.title !== 'Resuelve el modelo' || flow.bars !== 2) findings.push({ flow });
  const shot = await page.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(output, 'answer-step-es-MX-375.png'), Buffer.from(shot.data, 'base64'));
  for (const age of ['6-9', '13-17', 'adult']) { await go('es-MX', 'light', age, 375, 1, false); if (!await page.evaluate("!!document.querySelector('[data-screen=lesson-unavailable]')")) findings.push({ age }); }
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Controlled M7 build sequence; preview-only, no saved progress.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) process.exitCode = 1;
} finally { await page.send('Browser.close').catch(() => {}); page.ws.close(); browser.child.kill(); }
