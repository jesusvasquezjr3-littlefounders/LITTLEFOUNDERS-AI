import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-schema-diagram');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = []; let configurations = 0;

async function go(locale, theme, age, width, scale, spacing) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
  const query = new URLSearchParams({ locale, theme, screen: 'schemadiagram', age }).toString();
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await page.evaluate(`!!document.querySelector('[data-screen="${age === '10-12' ? 'schema-diagram' : 'lesson-unavailable'}"]')`)) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  await page.evaluate(`document.fonts.ready.then(()=>{document.documentElement.style.fontSize='${16 * scale}px';let style=document.querySelector('#audit-spacing');if(!style){style=document.createElement('style');style.id='audit-spacing';document.head.append(style);}style.textContent=${JSON.stringify(spacing ? '.lf-rebuild *{letter-spacing:.12em!important;word-spacing:.16em!important;line-height:1.5!important;}' : '')};})`);
}

async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await page.evaluate(expression)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

try {
  for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
    await go(locale, theme, '10-12', width, scale, spacing);
    const issues = await page.evaluate(`(()=>{const root=document.querySelector('[data-screen=schema-diagram]'),issues=[];if(!root)return['wrong-screen'];if(document.documentElement.scrollWidth>innerWidth+1)issues.push('horizontal-scroll');if(root.querySelectorAll('h1').length!==1)issues.push('heading');if(!root.querySelector('.lf-schema-diagram[role=img]'))issues.push('diagram');if(root.querySelector('.lf-schema-slot input'))issues.push('slots-visible-before-structure');for(const button of root.querySelectorAll('button')){const box=button.getBoundingClientRect();if(box.width<48||box.height<48)issues.push('target');}return [...new Set(issues)]})()`);
    configurations++; if (issues.length) findings.push({ locale, theme, width, scale, spacing, issues });
  }
  await go('es-MX', 'light', '10-12', 375, 1, false);
  await page.evaluate(`document.querySelector('.lf-scale-toggle button')?.click()`);
  await waitFor("document.querySelector('.lf-learning-actions button')?.disabled === false");
  await page.evaluate(`document.querySelector('.lf-learning-actions button')?.click()`);
  await waitFor("document.querySelector('.lf-learning-actions button')?.textContent === 'Continuar'");
  await page.evaluate(`document.querySelector('.lf-learning-actions button')?.click()`);
  await waitFor("document.querySelectorAll('.lf-schema-slot input').length === 2");
  await page.evaluate(`for(const [index,value] of ['24','9'].entries()){const input=document.querySelectorAll('.lf-schema-slot input')[index],set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('.lf-learning-actions button')?.click()`);
  await waitFor("document.querySelector('.lf-learning-actions button')?.textContent === 'Continuar'");
  await page.evaluate(`document.querySelector('.lf-learning-actions button')?.click()`);
  await waitFor("!!document.querySelector('.lf-parameter-slider input')");
  await page.evaluate(`const input=document.querySelector('.lf-parameter-slider input'),set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,'15');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.lf-learning-actions button')?.click()`);
  await waitFor("document.querySelector('[role=status]')?.textContent === 'Correcto'");
  const flow = await page.evaluate(`({title:document.querySelector('h2')?.textContent,correct:document.querySelector('[role=status]')?.textContent})`);
  if (flow.title !== 'Resuelve el esquema' || flow.correct !== 'Correcto') findings.push({ flow });
  for (const age of ['6-9', '13-17', 'adult']) { await go('es-MX', 'light', age, 375, 1, false); if (!await page.evaluate("!!document.querySelector('[data-screen=lesson-unavailable]')")) findings.push({ age }); }
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Controlled M8 sequence; preview-only, no saved progress.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) process.exitCode = 1;
} finally { await page.send('Browser.close').catch(() => {}); page.ws.close(); browser.child.kill(); }
