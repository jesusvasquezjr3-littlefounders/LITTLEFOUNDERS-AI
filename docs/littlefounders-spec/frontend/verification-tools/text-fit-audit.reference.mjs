// Text Fit audit (v2). Verifies the Text Fit Contract (02-FOUNDATIONS.md §7) on the RENDERED mockup.
//
// What it drives: mockup/littlefounders-mockup.html, through the mockup's own state hooks (global `S`,
// `render()`, routes addressed as `#route=<name>` / `S.route`). It is therefore still coupled to the
// mockup; auditing a real application needs a different driver (see README).
//
// States audited (v2 mockup, 40): the 17 routes (landing, how, families, signup, login, notfound, home,
// lesson, result, board, mentor, tasks, wallet, me, parent, staff, system), expanded into their state
// variants (see variantsFor below: the lesson's answer states and guided review, the sign-up age screen and
// its three outcomes, the teen account on tasks and wallet, the parent's frozen card, the staff dialog,
// the three teaching-visual demos before and after grading, ...).
// Matrix per state: EN/ES/PT x light/dark x 320/375/768/1280 px x normal/+40% text = 48 configurations.
// Mode "audit" = normal text; "spacing" = the same matrix with the WCAG 1.4.12 text-spacing overrides;
// "both" (default) runs both. Visually-hidden elements (the .sr-only / clip:rect(0 0 0 0) 1x1 px pattern,
// e.g. the staff table's <thead> in stacked-card mode) are skipped: they are accessible, not clipped.
//
// Requirements: Node 18+, `puppeteer-core`, and a local Chrome/Chromium given by CHROME_PATH.
// Usage:
//   CHROME_PATH=/path/to/chrome node text-fit-audit.reference.mjs <mockup.html> [audit|spacing|both]
//   env: ROUTES=landing,home,...   LANGS=en,es,pt   WIDTHS=320,375,768,1280   THEMES=light,dark
//        MOTION=1 to keep animations running (default: prefers-reduced-motion, so count-ups show final text)
// Exit code: 0 = no issues, 1 = issues found, 2 = setup error.
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME = process.env.CHROME_PATH;
if (!CHROME) { console.error('CHROME_PATH is not set. Point it at a local Chrome/Chromium executable, e.g.\n  CHROME_PATH=/usr/bin/chromium node text-fit-audit.reference.mjs mockup/littlefounders-mockup.html'); process.exit(2); }
const fileArg = process.argv[2];
if (!fileArg) { console.error('Usage: CHROME_PATH=... node text-fit-audit.reference.mjs <mockup.html> [audit|spacing|both]'); process.exit(2); }
const file = path.resolve(fileArg);
if (!fs.existsSync(file)) { console.error('File not found: ' + file); process.exit(2); }
const mode = process.argv[3] || 'both';
if (!['audit', 'spacing', 'both'].includes(mode)) { console.error('Mode must be audit, spacing or both.'); process.exit(2); }

const ROUTES = (process.env.ROUTES || 'landing,how,families,signup,login,notfound,home,lesson,result,board,mentor,tasks,wallet,me,parent,staff,system').split(',');
// Per-route state variants (v2). Each variant is a plain object merged into the mockup's `S` after the
// mockup's own resetState() has put every demo state back to its default, so no state leaks between variants.
const BOARD0 = { demo: 0, line: 0, moved: false, lineChecked: false, pred: '', predErr: false, revealed: false, dstep: 1, table: false, rule: { a: null, j: null, b: null, then: null, else: null }, open: null, tested: false, live: '' };
const B = o => ({ board: Object.assign({}, BOARD0, o) });
const SU = o => ({ su: Object.assign({ step: 'age', month: '', year: '', via: '', done: false, errs: {} }, o) });
const variantsFor = (route, lessonIdx) => ({
  lesson: [['unanswered', {}], ['correct', { sel: lessonIdx.correct, checked: true }], ['try-again', { sel: lessonIdx.wrong, checked: true }], ['guided-review', { sel: lessonIdx.wrong, checked: true, misses: 3 }]],
  signup: [['age', SU({})], ['age-errors', SU({ year: '20', errs: { month: 1, year: 1 } })], ['adult', SU({ step: 'adult' })], ['adult-errors', Object.assign(SU({ step: 'adult' }), { errs: { name: 1, email: 1, pw: 1, agree: 1 } })], ['adult-done', SU({ step: 'adult', done: true })], ['teen', SU({ step: 'teen' })], ['teen-google', SU({ step: 'teen', via: 'google' })], ['under-13', SU({ step: 'child' })]],
  login: [['', {}], ['errors', { errs: { ident: 1, pw: 1 } }]],
  tasks: [['family', { acct: 'family' }], ['teen', { acct: 'teen' }]],
  wallet: [['family', { acct: 'family' }], ['family-confirmed', { acct: 'family', splitDone: true }], ['teen', { acct: 'teen' }], ['teen-logged', { acct: 'teen', splitDone: true, teen: { amt: '', src: 'gift', logged: 35, err: false, msg: true } }]],
  mentor: [['rho', { mentor: 'rho' }], ['dina', { mentor: 'dina' }]],
  parent: [['', {}], ['frozen', { frozen: true, approvedRows: [0] }]],
  staff: [['', {}], ['dialog', { dialog: true }]],
  board: [['line', B({})], ['line-try-again', B({ line: 5, moved: true, lineChecked: true })], ['line-correct', B({ line: 6, moved: true, lineChecked: true })],
          ['discount', B({ demo: 1, pred: '40' })], ['discount-revealed', B({ demo: 1, pred: '40', revealed: true, dstep: 2, table: true })],
          ['rule', B({ demo: 2, open: 'a', rule: { a: null, j: 'and', b: null, then: null, else: null } })], ['rule-tested', B({ demo: 2, tested: true, rule: { a: 'more', j: 'or', b: 'want', then: 'wait', else: 'buy' } })]],
})[route] || [['', {}]];

const langs = (process.env.LANGS || 'en,es,pt').split(','), themes = (process.env.THEMES || 'light,dark').split(',');
const widths = (process.env.WIDTHS || '320,375,768,1280').split(',').map(Number), stress = [false, true];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
if (process.env.MOTION !== '1') await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto('file://' + file + '#route=landing');
await page.evaluate(() => document.fonts.ready);
if (!(await page.evaluate(() => typeof S === 'object' && typeof render === 'function' && 'route' in S))) { console.error('Page does not expose the mockup state hooks (S.route, render()).'); await browser.close(); process.exit(2); }

// Lesson answer states: resolve the correct/wrong option from the mockup's own exercise data.
const lessonIdx = await page.evaluate(() => { let c = 1; try { const T0 = T[S.lang]; c = (T0.exercises ? T0.exercises[0].correctIdx : T0.correctIdx); } catch (e) {} return { correct: c, wrong: c === 0 ? 1 : 0 }; });
const states = ROUTES.flatMap(r => variantsFor(r, lessonIdx).map(([v, o]) => [r, v, o]));

const AUDIT = () => {
  const app = document.getElementById('app'); const ar = app.getBoundingClientRect(); const out = [];
  const cvs = document.createElement('canvas').getContext('2d');
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  // Visually hidden = accessible but deliberately not painted: the sr-only pattern (clip to nothing,
  // 1x1 px absolutely positioned box), clip-path inset(50%), display:none or visibility:hidden.
  const hiddenCache = new Map();
  const isHidden = el => {
    if (!el || el === app || el === document.body) return false;
    if (hiddenCache.has(el)) return hiddenCache.get(el);
    const c = getComputedStyle(el); let h = false;
    if (c.display === 'none' || c.visibility === 'hidden') h = true;
    else if (c.clip === 'rect(0px, 0px, 0px, 0px)' || c.clipPath === 'inset(50%)') h = true;
    else if (c.position === 'absolute' && c.overflow === 'hidden' && el.offsetWidth <= 1 && el.offsetHeight <= 1) h = true;
    else h = isHidden(el.parentElement);
    hiddenCache.set(el, h); return h;
  };
  const label = el => (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : el.tagName.toLowerCase()) + ' "' + (el.textContent || '').trim().slice(0, 32) + '"';
  const all = [...app.querySelectorAll('*')].filter(el => !el.closest('svg') && !isHidden(el) && (!el.classList.contains('tab-label') || (visible(el) && el.getBoundingClientRect().width > 2)));
  for (const el of all) {
    const cs = getComputedStyle(el); const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (cs.textOverflow === 'ellipsis') out.push(['ellipsis', label(el)]);
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') out.push(['line-clamp', label(el)]);
    if (el.classList.contains('bar') || el.closest('.bar')) continue;
    const clipX = cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1;
    if (clipX && (hasText || el.classList.contains('scroller') || el.textContent.trim())) out.push(['clipped-x', label(el) + ` sw=${el.scrollWidth} cw=${el.clientWidth}`]);
    const clipY = cs.overflowY !== 'visible' && !el.classList.contains('scroller') && el.scrollHeight > el.clientHeight + 1;
    if (clipY && el.textContent.trim()) out.push(['clipped-y', label(el)]);
    if (hasText && visible(el)) {
      const r = el.getBoundingClientRect();
      if (r.left < ar.left - 0.5 || r.right > ar.right + 0.5) out.push(['outside-frame-x', label(el) + ` l=${(r.left - ar.left).toFixed(0)} r=${(r.right - ar.right).toFixed(0)}`]);
      // a single word wider than its box would force a mid-word break or spill
      let box = el; while (box && getComputedStyle(box).display === 'inline') box = box.parentElement;
      const bs = getComputedStyle(box); const bw = box.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
      if (cs.overflowWrap !== 'anywhere') {
        cvs.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        try { cvs.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing; } catch (e) {}
        for (const n of el.childNodes) if (n.nodeType === 3) for (const w of n.textContent.split(/\s+|(?<=-)/).filter(Boolean)) {
          const ww = cvs.measureText(w).width; if (ww > bw + 0.5) out.push(['word-wider-than-box', `${label(el)} word="${w}" ${ww.toFixed(0)}>${bw.toFixed(0)}`]);
        }
      }
    }
  }
  for (const b of app.querySelectorAll('button,a[href],input,select,textarea,[role=button]')) {
    if (!visible(b) || isHidden(b)) continue; const r = b.getBoundingClientRect();
    if (r.width < 47.5 || r.height < 47.5) out.push(['tap-target<48', label(b) + ` ${r.width.toFixed(0)}x${r.height.toFixed(0)}`]);
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(['page-hscroll', `sw=${document.documentElement.scrollWidth}`]);
  return out;
};

async function setState(cfg) {
  const applied = await page.evaluate((c) => {
    clearTimeout(S._tt);
    if (typeof resetState === 'function') resetState();
    Object.assign(S, { enter: false, menu: false, tab: 0, toast: null, dialog: false, errs: {}, exIdx: 0, demo: { sel: null, checked: false } }, c);
    S.fx = null; render();
    return new URLSearchParams(location.hash.slice(1)).get('route');
  }, cfg);
  if (applied !== cfg.route) throw new Error(`route not applied: asked for "${cfg.route}", page shows "${applied}"`);
  await page.evaluate(() => document.fonts.ready);
}

// Guard against a vacuous pass: every route must render different markup.
{
  const seen = new Map();
  for (const r of ROUTES) { await setState({ route: r, lang: 'en', theme: 'light', w: 1280, stress: false, sel: null, checked: false }); const sig = await page.evaluate(() => document.getElementById('app').innerHTML.length + ':' + document.getElementById('app').textContent.slice(0, 200)); if (seen.has(sig)) { console.error(`Routes "${seen.get(sig)}" and "${r}" render identical markup: the driver is not reaching the routes.`); await browser.close(); process.exit(2); } seen.set(sig, r); }
}

let total = 0;
for (const m of (mode === 'both' ? ['audit', 'spacing'] : [mode])) {
  if (m === 'spacing') await page.addStyleTag({ content: '#app *{letter-spacing:.12em!important;word-spacing:.16em!important;line-height:1.5!important} #app p{margin-bottom:2em!important}' });
  const agg = new Map(); let runs = 0;
  for (const [route, variant, ls] of states) for (const lang of langs) for (const theme of themes) for (const w of widths) for (const st of stress) {
    const cfg = Object.assign({ route, lang, theme, w, stress: st, sel: null, checked: false }, ls);
    await setState(cfg); runs++;
    const res = await page.evaluate(AUDIT);
    for (const [type, det] of res) {
      const key = type + ' | ' + det.replace(/ (l|r|sw|cw)=-?\d+/g, '').replace(/\d+x\d+/, '').replace(/\d+>\d+/, '');
      if (!agg.has(key)) agg.set(key, { n: 0, first: JSON.stringify({ route: route + (variant ? ':' + variant : ''), lang, theme, w, stress: st }), detail: det });
      agg.get(key).n++;
    }
  }
  console.log(`\nTEXT FIT ${m === 'spacing' ? '(WCAG 1.4.12 text spacing)' : '(normal text)'}: ${runs} configurations = ${states.length} states x ${langs.length} languages x ${themes.length} themes x ${widths.length} widths x normal/+40% text`);
  const rows = [...agg.entries()].sort((a, b) => b[1].n - a[1].n);
  if (!rows.length) console.log('NO ISSUES FOUND');
  for (const [k, v] of rows.slice(0, 40)) console.log(`${String(v.n).padStart(4)}x  ${k}\n        e.g. ${v.first}  ${v.detail}`);
  total += rows.length;
}
console.log('\nJS errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
process.exit(total || errors.length ? 1 : 0);
