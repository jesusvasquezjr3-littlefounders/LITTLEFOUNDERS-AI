import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

// Real-app driver for Frontend Bible 03 and verification-tools/proportion-audit.reference.mjs.
const origin = process.env.REBUILD_URL ?? 'http://127.0.0.1:5190';
const scopeOutput = { controls: 'rebuild-proportions-controls', shells: 'rebuild-proportions-shells' }[process.env.REBUILD_PROPORTIONS_SCOPE] ?? 'rebuild-proportions';
const output = resolve(process.env.REPORT_DIR ?? `../audit-results/${scopeOutput}`);
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
  { screen: 'numberline', ages: ['6-9'] },
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

// S03.1: the preview-only shared control catalogue, measured on its own.
const controlSurfaces = [{ screen: 'system', ages: ['6-9'] }];

// S03.2: the preview-only overlay catalogue and every shared shell state, measured on their own.
const shellSurfaces = [
  { screen: 'gallery', ages: ['6-9'] }, { screen: 'overlays', ages: ['6-9'] },
  ...['learner', 'teen', 'tutor', 'staff', 'staff-limited', 'site', 'auth', 'single', 'table'].map((shell) => ({ screen: 'shell', shell, ages: ['6-9'] })),
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

// B.12 / B.5 / B.15 / B.19 (S05.3d): the reasoning board, the kept-best result, the placement outcome and the staff panel.
const learningQualitySurfaces = [
  { screen: 'reasoning', ages: ['6-9', '13-17'], query: {}, want: 'decision-reasons' },
  { screen: 'resultkept', ages: ['6-9'], query: {}, want: 'result-preview' },
  { screen: 'placementoutcome', ages: ['6-9'], query: { start: 'further_in' }, want: 'placement-outcome-preview' },
  { screen: 'learningquality', ages: ['adult'], query: {}, want: 'learning-quality-host' },
];

// B.20 / B.21 / B.24 (S05.3e): the learner rhythm, the guardian holiday pause and the milestone result.
const motivationSurfaces = [
  { screen: 'rhythm', ages: ['6-9', '13-17'], query: { rhythm: 'open' }, want: 'rhythm-preview' },
  { screen: 'rhythm', ages: ['6-9'], query: { rhythm: 'resting' }, want: 'rhythm-preview' },
  { screen: 'streakpause', ages: ['adult'], query: { pause: 'ready' }, want: 'streak-pause-host' },
  { screen: 'resultmilestone', ages: ['6-9'], query: {}, want: 'result-preview' },
];

// B.23 / B.26 (S05.3f): the graduation card, the guided-review offer and the register-framed result.
const wellbeingSurfaces = [
  { screen: 'graduation', ages: ['10-12'], query: { into: 'transition' }, want: 'graduation-host' },
  { screen: 'graduation', ages: ['13-17'], query: { into: 'teen' }, want: 'graduation-host' },
  { screen: 'guidedreview', ages: ['6-9'], query: { register: 'young' }, want: 'guided-review-host' },
  { screen: 'guidedreview', ages: ['13-17'], query: { register: 'teen' }, want: 'guided-review-host' },
  { screen: 'resultregister', ages: ['13-17'], query: { register: 'teen' }, want: 'result-preview' },
];

const scope = process.env.REBUILD_PROPORTIONS_SCOPE;
const surfaces = scope === 'appendix-current' ? appendixCurrentSurfaces
  : scope === 'controls' ? controlSurfaces
    : scope === 'shells' ? shellSurfaces
      : scope === 'course-path' ? coursePathSurfaces
        : scope === 'narrative' ? narrativeSurfaces
          : scope === 'learning-quality' ? learningQualitySurfaces
            : scope === 'motivation' ? motivationSurfaces
              : scope === 'wellbeing' ? wellbeingSurfaces
                : [...coreSurfaces, ...appendixCurrentSurfaces, ...coursePathSurfaces, ...narrativeSurfaces, ...learningQualitySurfaces, ...motivationSurfaces, ...wellbeingSurfaces];

try {
  for (const { screen, shell, ages, path, query: extra, want: wantScreen } of surfaces) for (const age of ages) for (const locale of ['en-US', 'es-MX', 'pt-BR']) for (const theme of ['light', 'dark']) for (const width of [320, 375, 768, 1280]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
    const query = new URLSearchParams({ locale, theme, screen, age, ...(shell ? { shell } : {}), ...(path ? { path } : {}), ...(extra ?? {}) }).toString();
    const want = wantScreen ?? (path ? 'course-path-preview' : expectedScreen(screen));
    // A shell's <main> carries no data-screen; its root names the shell instead.
    // Fixtures that share a screen name also wait for this URL's own render.
    const ready = shell ? `document.querySelector('main') && document.querySelector('.lf-shell')?.dataset.shell === ${JSON.stringify(shell === 'teen' ? 'learner' : shell === 'staff-limited' ? 'staff' : shell === 'single' ? 'single-state' : shell === 'table' ? 'tutor' : shell)}`
      : `${path || extra ? `location.search === ${JSON.stringify('?' + query)} && ` : ''}!!document.querySelector(${JSON.stringify(`main[data-screen="${want}"], main [data-screen="${want}"]`)})`;
    await page.send('Page.navigate', { url: `${origin}/rebuild.html?${query}` });
    for (let n = 0; n < 100; n++) {
      if (await page.evaluate(`!!(${ready})`)) break;
      await new Promise((done) => setTimeout(done, 50));
    }
    await page.evaluate('document.fonts.ready');
    const issues = await page.evaluate(`(() => {
      const main=document.querySelector('main'),issues=[];
      if(!(${ready})) return ['wrong-screen'];
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
    if (issues.length) findings.push({ screen, ...(shell ? { shell } : {}), ...(path ? { path } : {}), ...(extra ?? {}), age, locale, theme, width, issues });
  }
  writeFileSync(join(output, 'report.json'), JSON.stringify({
    configurations,
    findings,
    scope: scope === 'appendix-current'
      ? 'Current controlled Appendix P candidate renderers only.'
      : scope === 'controls'
        ? 'S03.1 shared control catalogue only.'
        : scope === 'shells'
          ? 'S03.2 overlay catalogue and shared shell states only.'
          : scope === 'course-path'
            ? 'The B.6 rebuilt course path preview fixtures only.'
            : scope === 'narrative'
              ? 'The S05.3c recall, decision journal, learner shortcut and Family Hub learning preview fixtures only.'
              : scope === 'learning-quality'
                ? 'The S05.3d reasoning board, kept-best result, placement outcome and learning-quality panel preview fixtures only.'
                : scope === 'motivation'
                  ? 'The S05.3e learner rhythm, guardian holiday pause and milestone result preview fixtures only.'
                  : scope === 'wellbeing'
                    ? 'The S05.3f graduation card, guided-review offer and register-framed result preview fixtures only.'
                    : 'All current controlled lesson, Appendix P candidate, course-path, S05.3c narrative, S05.3d learning-quality, S05.3e motivation and S05.3f wellbeing renderers.',
  }, null, 2));
  console.log(JSON.stringify({ configurations, findings: findings.length, output }));
  if (findings.length) { console.error(JSON.stringify(findings.slice(0, 8), null, 2)); process.exitCode = 1; }
} finally {
  await page.send('Browser.close').catch(() => {});
  page.ws.close(); browser.child.kill();
}
