import { mkdirSync, mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage, warmDevServer } from './lesson-engine/browser.mjs';

// Scratch probe: prints the structure of the tablet screens after a click, to write the recorder's scenes against real selectors.
const origin = process.env.REBUILD_URL ?? 'http://localhost:5173';
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const scratch = resolve('../audit-results/site-tablet');
mkdirSync(scratch, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(scratch, 'chrome-')), { gpuMode: 'hardware' });
try {
  const page = await openPage(browser.browser, { width: 1024, height: 768, dark: false });
  if (!await warmDevServer(page, origin)) throw new Error('no dev server');
  await page.send('Page.navigate', { url: `${origin}/rebuild.html?${process.env.URLQ ?? 'screen=site-tablet&view=wallet&theme=light&locale=es-MX'}` });
  for (let n = 0; n < 60 && !(await page.evaluate("!!document.querySelector('button')")); n++) await wait(250);
  await wait(1500);
  const outline = await page.evaluate(`(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, [role=tab], [role=radio], input, a, summary')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      out.push([el.tagName, (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), el.className.toString().slice(0, 50), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(' | '));
    }
    return out.join('\\n');
  })()`);
  console.log(outline);
  if (process.env.RECTS) console.log(await page.evaluate(`JSON.stringify([...document.querySelectorAll(${JSON.stringify(process.env.RECTS)})].map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, e.className.toString().slice(0, 40), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }))`));
  if (process.env.CLICK) {
    await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(process.env.CLICK)}); e && e.click(); })()`);
    await wait(900);
    console.log('--- after click');
    console.log(await page.evaluate(`(() => {
      const out = [];
      for (const el of document.querySelectorAll('[role=dialog] *, [role=alertdialog] *')) {
        if (!['BUTTON', 'INPUT', 'H2', 'H3', 'LABEL', 'SELECT'].includes(el.tagName)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        out.push([el.tagName, (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), el.className.toString().slice(0, 50), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(' | '));
      }
      return out.join('\\n');
    })()`));
  }
} finally {
  browser.child.kill();
}
