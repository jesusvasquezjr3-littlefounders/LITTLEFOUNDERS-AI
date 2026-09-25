import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

// Real-app driver for Frontend Bible 03 and verification-tools/proportion-audit.reference.mjs.
const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const output = resolve(process.env.REPORT_DIR ?? '../audit-results/rebuild-proportions');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

const renderedScreen = {
  waffle: 'lesson',
  donut: 'lesson',
  ratiotable: 'ratio-table',
  result: 'result-preview',
  replay: 'result-preview',
  upgrade: 'lesson-upgrade',
  invalid: 'lesson-unavailable',
  opening: 'lesson-opening',
  offline: 'lesson-offline',
  loaderror: 'lesson-load-error',
  placevalue: 'place-value',
  rulebuilder: 'savings-rule',
  ledger: 'running-ledger',
  growthcompare: 'growth-comparison',
  fractionline: 'fraction-numberline',
  fractionarea: 'fraction-area',
  barmodel: 'bar-model',
  schemadiagram: 'schema-diagram',
  workedexample: 'worked-example',
  functionmachine: 'function-machine',
  cpafading: 'cpa-fading',
};

const expectedScreen = (screen) => renderedScreen[screen] ?? screen;

const coreSurfaces = [
  { screen: 'lesson', ages: ['6-9', 'adult'] },
  { screen: 'waffle', ages: ['6-9'] },
  { screen: 'donut', ages: ['10-12'] },
  { screen: 'ratiotable', ages: ['10-12'] },
  { screen: 'timeline', ages: ['6-9', 'adult'] },
  { screen: 'numberline', ages: ['6-9', '10-12'] },
  { screen: 'goal', ages: ['6-9', 'adult'] },
  { screen: 'percent', ages: ['10-12'] },
  { screen: 'placevalue', ages: ['6-9'] },
  { screen: 'rulebuilder', ages: ['10-12'] },
  { screen: 'ledger', ages: ['13-17'] },
  { screen: 'growthcompare', ages: ['13-17'] },
  { screen: 'result', ages: ['6-9'] },
  { screen: 'replay', ages: ['6-9'] },
  { screen: 'upgrade', ages: ['6-9'] },
  { screen: 'invalid', ages: ['6-9'] },
  { screen: 'opening', ages: ['6-9'] },
  { screen: 'offline', ages: ['6-9'] },
  { screen: 'loaderror', ages: ['6-9'] },
];

const appendixCurrentSurfaces = [
  { screen: 'fractionline', ages: ['10-12'] },
  { screen: 'fractionarea', ages: ['6-9'] },
  { screen: 'barmodel', ages: ['10-12'] },
  { screen: 'schemadiagram', ages: ['10-12'] },
  { screen: 'workedexample', ages: ['10-12'] },
  { screen: 'functionmachine', ages: ['10-12'] },
  { screen: 'cpafading', ages: ['6-9', '10-12'] },
];

// B.6 / S05.3b: the rebuilt course path, one fixture per learner the server can describe.
const coursePathSurfaces = [
  { screen: 'coursepath', path: 'child', ages: ['6-9'] },
  { screen: 'coursepath', path: 'bridge', ages: ['10-12'] },
  { screen: 'coursepath', path: 'placement', ages: ['13-17'] },
  { screen: 'coursepath', path: 'adult', ages: ['adult'] },
  { screen: 'coursepath', path: 'complete', ages: ['6-9'] },
];

// B.9 / B.10 / B.13 / S05.3c: the recall, the decision journal, the learner shortcut and the Family Hub learning sections.
const narrativeSurfaces = [
  { screen: 'recall', ages: ['6-9'], query: {}, want: 'narrative-recall-preview' },
  { screen: 'journal', ages: ['6-9'], query: { journal: 'list' }, want: 'journal-preview' },
  { screen: 'journal', ages: ['13-17'], query: { journal: 'teen' }, want: 'journal-preview' },
  { screen: 'familylearning', ages: ['adult'], query: {}, want: 'family-learning-preview' },
  { screen: 'learnershortcut', ages: ['13-17'], query: { bridges: '1' }, want: 'learner-shortcut-host' },
];

const scope = process.env.REBUILD_PROPORTIONS_SCOPE;
const surfaces = scope === 'appendix-current' ? appendixCurrentSurfaces
  : scope === 'course-path' ? coursePathSurfaces
    : scope === 'narrative' ? narrativeSurfaces
      : [...coreSurfaces, ...appendixCurrentSurfaces, ...coursePathSurfaces, ...narrativeSurfaces];

try {
  for (const { screen, ages, path, query: extra, want: wantScreen } of surfaces) for (const age of ages) for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) for (const width of [320, 375, 768, 1280]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
    const query = new URLSearchParams({ locale, theme, screen, age, ...(path ? { path } : {}), ...(extra ?? {}) }).toString();
    const want = wantScreen ?? (path ? 'course-path-preview' : expectedScreen(screen));
    // Fixtures that share a screen name also wait for this URL's own render.
    const ready = path || extra ? `location.search === ${JSON.stringify('?' + query)} && ` : '';
    await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
    for (let n = 0; n < 100; n++) {
      if (await page.evaluate(`${ready}document.querySelector('main')?.dataset.screen === ${JSON.stringify(want)}`)) break;
      await new Promise((done) => setTimeout(done, 50));
    }
    await page.evaluate('document.fonts.ready');
    const issues = await page.evaluate(`(() => {
      const main=document.querySelector('main'),issues=[];
      if(!main||main.dataset.screen!==${JSON.stringify(want)}) return ['wrong-screen'];
      const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const scale=new Set([12,14,16,18,20,24,28,32,36,40,48,56,60,64,72,96]);
      for(const e of main.querySelectorAll('*')){
        if(e.closest('svg')||!visible(e)) continue;
        const cs=getComputedStyle(e);
        for(const p of ['paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft','rowGap','columnGap']){
          if(cs[p]==='auto') continue;
          const v=Math.abs(parseFloat(cs[p]));if(!Number.isFinite(v)||v<=2) continue;
          if(Math.abs(v/4-Math.round(v/4))>.02) issues.push('off-grid:'+e.tagName.toLowerCase()+'.'+e.className+':'+p+'='+v);
        }
        if([...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())){
          const size=parseFloat(cs.fontSize);if(!scale.has(Math.round(size))) issues.push('font-scale:'+size);
        }
      }
      // Family Hub sections sit under the page's own h1, so their section heading leads.
      const h1=main.querySelector('h1')||main.querySelector('h2'),p=main.querySelector('p');
      if(!h1||(!p&&!${screen === 'upgrade' || screen === 'invalid'})||(p&&parseFloat(getComputedStyle(h1).fontSize)/parseFloat(getComputedStyle(p).fontSize)<1.5)) issues.push('heading-body-ratio');
      if(main.querySelectorAll('.lf-button--accent:not(:disabled)').length>3) issues.push('accent-competition');
      const targets=[...main.querySelectorAll('button,input[type=range]')].filter(visible);
      for(let i=0;i<targets.length;i++) for(let j=i+1;j<targets.length;j++){
        const a=targets[i].getBoundingClientRect(),b=targets[j].getBoundingClientRect();
        const vertical=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
        const horizontal=Math.min(a.right,b.right)-Math.max(a.left,b.left);
        const hGap=Math.max(a.left,b.left)-Math.min(a.right,b.right);
        const vGap=Math.max(a.top,b.top)-Math.min(a.bottom,b.bottom);
        if((vertical>8&&hGap>=0&&hGap<8)||(horizontal>8&&vGap>=0&&vGap<8)) issues.push('tap-gap<8px');
      }
      return [...new Set(issues)];
    })()`);
    configurations++;
    if (issues.length) findings.push({ screen, ...(path ? { path } : {}), ...(extra ?? {}), age, locale, theme, width, issues });
  }
  writeFileSync(join(output, 'report.json'), JSON.stringify({
    configurations,
    findings,
    scope: scope === 'appendix-current'
      ? 'Current controlled Appendix P candidate renderers only.'
      : scope === 'course-path'
        ? 'The B.6 rebuilt course path preview fixtures only.'
        : scope === 'narrative'
          ? 'The S05.3c recall, decision journal, learner shortcut and Family Hub learning preview fixtures only.'
          : 'All current controlled lesson, Appendix P candidate, course-path and S05.3c narrative renderers.',
  }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 8), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
