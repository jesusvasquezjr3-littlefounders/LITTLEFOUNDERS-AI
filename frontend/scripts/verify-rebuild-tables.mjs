import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve('../audit-results/rebuild-tables');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;
const surfaces = [
  { screen: 'lesson', age: '6-9', expected: 'lesson' },
  { screen: 'waffle', age: '6-9', expected: 'lesson' },
  { screen: 'donut', age: '10-12', expected: 'lesson' },
  { screen: 'ratiotable', age: '10-12', expected: 'ratio-table', columns: 4 },
  { screen: 'timeline', age: '13-17', expected: 'timeline' },
  { screen: 'goal', age: 'adult', expected: 'goal' },
  { screen: 'percent', age: '10-12', expected: 'percent' },
  { screen: 'placevalue', age: '6-9', expected: 'place-value' },
  { screen: 'rulebuilder', age: '10-12', expected: 'savings-rule' },
  { screen: 'ledger', age: '13-17', expected: 'running-ledger' },
  { screen: 'growthcompare', age: '13-17', expected: 'growth-comparison', columns: 3 },
];

async function click(selector) {
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const point = await page.evaluate(`(() => {
    const e=document.querySelector(${JSON.stringify(selector)});if(!e) throw Error('Missing control');
    const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    if(!e.contains(document.elementFromPoint(x,y))) throw Error('Occluded control');
    // CDP mouse coordinates use the visual viewport after mobile text zoom and scroll.
    return {x:x-(visualViewport?.offsetLeft||0),y:y-(visualViewport?.offsetTop||0)};
  })()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}

try {
  for (const surface of surfaces) for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark'])
    for (const width of [320, 375, 768, 1280]) for (const scale of [1, 1.4]) for (const spacing of [false, true]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
      const query = new URLSearchParams({ locale, theme, screen: surface.screen, age: surface.age }).toString();
      const previousDocument = await page.evaluate('performance.timeOrigin');
      await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
      for (let n = 0; n < 100; n++) {
        if (await page.evaluate(`performance.timeOrigin!==${previousDocument} && location.search===${JSON.stringify('?' + query)}
          && !!document.querySelector('[data-screen="${surface.expected}"]')`)) break;
        await new Promise((done) => setTimeout(done, 50));
      }
      await page.evaluate('document.fonts.ready');
      await page.evaluate(`(() => {
        document.documentElement.style.fontSize='${16 * scale}px';
        let style=document.getElementById('audit-spacing');
        if(!style){style=document.createElement('style');style.id='audit-spacing';document.head.append(style);}
        style.textContent=${JSON.stringify(spacing ? '.lf-rebuild * { letter-spacing:.12em !important; word-spacing:.16em !important; line-height:1.5 !important; }' : '')};
      })()`);
      await click('.lf-learning-view-toggle');
      for (let n = 0; n < 20; n++) {
        if (await page.evaluate("!!document.querySelector('.lf-learning-table')")) break;
        await new Promise((done) => setTimeout(done, 50));
      }
      await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const issues = await page.evaluate(`(() => {
        const issues=[],main=document.querySelector('main'),table=main?.querySelector('.lf-learning-table');
        if(!main||main.dataset.screen!==${JSON.stringify(surface.expected)}) return ['wrong-screen'];
        if(!table) return ['table-missing'];
        if(table.querySelectorAll('thead th').length!==${surface.columns ?? 2}||table.querySelectorAll('tbody tr').length<1) issues.push('table-structure');
        const stacked=innerWidth<840,body=table.querySelector('tbody'),row=body?.querySelector('tr');
        if(stacked&&getComputedStyle(body).display!=='grid') issues.push('not-stacked');
        if(!stacked&&getComputedStyle(body).display==='grid') issues.push('desktop-stacked');
        if(stacked&&(!row||getComputedStyle(row).display!=='grid'||getComputedStyle(row).backgroundColor==='rgba(0, 0, 0, 0)')) issues.push('card-surface');
        for(const r of table.querySelectorAll('tbody tr')) {
          const cells=r.querySelectorAll('th,td');
          if(cells.length!==${surface.columns ?? 2}||cells[0].getAttribute('scope')!=='row') issues.push('row-semantics');
          for(const cell of cells) {
            if(!cell.dataset.label?.trim()) issues.push('cell-label-missing');
            const label=getComputedStyle(cell,'::before');
            if(stacked&&(!label.content||label.content==='none'||label.content==='normal')) issues.push('cell-label-visibility');
            if(!stacked&&label.content!=='none'&&label.content!=='normal') issues.push('desktop-label-visible');
            const box=cell.getBoundingClientRect(),s=getComputedStyle(cell);
            if(box.right>innerWidth+1||box.left<0) issues.push('cell-outside-viewport');
            if(parseFloat(s.fontSize)<14) issues.push('small-text');
            if(cell.scrollWidth>cell.clientWidth+1||cell.scrollHeight>cell.clientHeight+1) issues.push('cell-clipping');
          }
        }
        if(document.documentElement.scrollWidth>innerWidth+1) issues.push('horizontal-scroll');
        return [...new Set(issues)];
      })()`);
      if ((surface.screen === 'lesson' || surface.screen === 'waffle' || surface.screen === 'donut') && width < 840) {
        await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
        await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        const lastControl = await page.evaluate(`(() => {
          const foot=document.querySelector('.lf-learning-foot')?.getBoundingClientRect();
          const button=document.querySelector('.lf-learning-control:last-child .lf-stepper-button:last-child')?.getBoundingClientRect();
          if(!foot||!button) return 'last-control-missing';
          if(button.bottom>foot.top-4) return 'last-control-covered-by-footer';
          return null;
        })()`);
        if (lastControl) issues.push(lastControl);
      }
      if (surface.screen === 'lesson' && locale === 'es-MX' && width === 320 && scale === 1.4 && spacing) {
        const stress = await page.evaluate(`(() => {
          const cell=document.querySelector('.lf-learning-table tbody th');
          if(!cell) return 'stress-cell-missing';
          cell.textContent='Alessandro_Bartolomeo_Villanueva_Rodriguez_2014';
          const box=cell.getBoundingClientRect();
          if(box.right>innerWidth+1||cell.scrollWidth>cell.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1)
            return 'unbreakable-name-clipped';
          return null;
        })()`);
        if (stress) issues.push(stress);
      }
      configurations++;
      if (issues.length) findings.push({ ...surface, locale, theme, width, scale, spacing, issues });
      if ((surface.screen === 'ledger' || surface.screen === 'growthcompare' || surface.screen === 'waffle'
        || surface.screen === 'donut' || surface.screen === 'ratiotable') && locale === 'es-MX' && width === 375 && scale === 1 && !spacing) {
        await page.evaluate('window.scrollTo(0,0)');
        await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        await new Promise((done) => setTimeout(done, 80));
        const shot = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(join(output, `${surface.screen}-table-375-${theme}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
  if (page.errors.length || page.failedRequests.length) findings.push({ runtimeErrors: page.errors, failedRequests: page.failedRequests });
  writeFileSync(join(output, 'report.json'), JSON.stringify({ configurations, findings, scope: 'Responsive semantic-table layout for ten controlled v2 visual pilots.' }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 12), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
