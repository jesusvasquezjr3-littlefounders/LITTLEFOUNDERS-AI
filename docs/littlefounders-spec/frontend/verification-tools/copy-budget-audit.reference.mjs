// Copy Budget audit (v1). Checks the Copy Budget (frontend-bible/06-COPY-BUDGET.md) on the RENDERED mockup.
//
// What it measures, per state and language, on every visible text block inside #app:
//   - action   (button, link-button with a single line of text): words <= budget.action
//   - option   (answer options, choices, pickers): words <= budget.option
//   - prompt   (a heading-sized question, i.e. containing "?"): words <= budget.prompt
//   A pressable card (a button holding several text blocks) is not an action: its blocks are measured one by one.
//   - heading  (h1-h3, or text >= 22 px): words <= budget.heading, 1 sentence
//   - body     (any other text block): words <= budget.body, <= 2 sentences
//   - mentor, narrative, prompt, option: only when declared with data-copy-role (prompt and option are also inferred)
//   Ages 6-9: data-age-band="6-9" on <html> or #app switches to the YOUNG limits.
//   - first view: total words of the blocks that start inside the first FOLD px of the screen (app routes only)
// Budgets (two sets: app and marketing site, see BUDGETS) are English word counts; Spanish and Portuguese get x1.25 (rounded up), per 06 section 3.
// In production, components declare data-copy-role="action|heading|body|prompt|option|mentor|narrative|brand|legal|data";
// when present, that attribute wins over the heuristics below. "data" (user content, table cells,
// numbers) and "legal" (mandated disclosures, which use layering instead: 06 section 4) are not counted.
// Excluded here: the `system` route (a specimen sheet) and elements marked aria-hidden.
//
// Requirements: Node 18+, `puppeteer-core`, CHROME_PATH. Same driver as the text-fit audit (mockup state hooks).
// Usage: CHROME_PATH=/path/to/chrome node copy-budget-audit.reference.mjs <mockup.html>
//   env: ROUTES=..., LANGS=en,es,pt, FOLD=740, JSON=out.json (writes every finding)
// Exit code: 0 = within budget, 1 = over budget somewhere, 2 = setup error.
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

// Budgets from 06-COPY-BUDGET.md section 3 (English words). App = the signed-in product and its sign-up/log-in;
// site = marketing pages. `sentences` applies to body text; `mentorSentences` to one Mentor turn.
const BUDGETS = {
  app:  { action: 3, heading: 6, body: 12, prompt: 20, mentor: 20, narrative: 30, option: 8, firstView: 40 },
  site: { action: 3, heading: 8, body: 25, prompt: 20, mentor: 20, narrative: 30, option: 8, firstView: Infinity },
};
// Ages 6-9 (06 section 3.1): set data-age-band="6-9" on <html> or #app and these limits replace the app ones.
const YOUNG = { prompt: 12, option: 5, mentor: 12, firstView: 25 };
// Maximum sentences per role (06 section 3). Actions are not sentence-checked.
const SENTENCES = { app: { heading: 1, body: 2, prompt: 2, option: 1, mentor: 2, narrative: 2 }, site: { heading: 1, body: 2, prompt: 2, option: 1, mentor: 2, narrative: 2 } };
const APP_ROUTES = new Set(['home', 'lesson', 'result', 'board', 'mentor', 'tasks', 'wallet', 'me', 'parent', 'staff', 'signup', 'login']);
const LANG_FACTOR = { en: 1, es: 1.25, pt: 1.25 };

const CHROME = process.env.CHROME_PATH;
if (!CHROME) { console.error('CHROME_PATH is not set.'); process.exit(2); }
const fileArg = process.argv[2];
if (!fileArg) { console.error('Usage: CHROME_PATH=... node copy-budget-audit.reference.mjs <mockup.html>'); process.exit(2); }
const file = path.resolve(fileArg);
if (!fs.existsSync(file)) { console.error('File not found: ' + file); process.exit(2); }
const FOLD = Number(process.env.FOLD || 740);

const ROUTES = (process.env.ROUTES || 'landing,how,families,signup,login,notfound,home,lesson,result,board,mentor,tasks,wallet,me,parent,staff').split(',');
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

const langs = (process.env.LANGS || 'en,es,pt').split(',');

let browser;
try {
browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 520, height: 1000, deviceScaleFactor: 1 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.goto('file://' + file + '#route=landing');
await page.evaluate(() => document.fonts.ready);
if (!(await page.evaluate(() => typeof S === 'object' && typeof render === 'function' && 'route' in S))) { console.error('Page does not expose the mockup state hooks.'); await browser.close(); process.exit(2); }
const lessonIdx = await page.evaluate(() => { let c = 1; try { const T0 = T[S.lang]; c = (T0.exercises ? T0.exercises[0].correctIdx : T0.correctIdx); } catch (e) {} return { correct: c, wrong: c === 0 ? 1 : 0 }; });
const states = ROUTES.flatMap(r => variantsFor(r, lessonIdx).map(([v, o]) => [r, v, o]));

const MEASURE = (fold) => {
  const app = document.getElementById('app'); const top0 = app.getBoundingClientRect().top;
  const words = t => (t.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’.,%$-]*/gu) || []).length;
  const sentences = t => (t.replace(/\b(Dr|Mr|Mrs|Ms|Sr|Sra|Srta|St)\./g, '$1').trim().split(/(?<=[\p{L}\p{N}]{2}[.!?…]|[.!?…]["”])\s+(?=[\p{Lu}¿¡"“])/u).filter(s => words(s) > 0)).length;
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && !el.closest('[aria-hidden="true"],.sr-only'); };
  const isBlock = el => { const d = getComputedStyle(el).display; return !d.startsWith('inline') || el.matches('button,a,label'); };
  const out = []; const seen = new Set();
  const all = [...app.querySelectorAll('*')].filter(el => !['SCRIPT','STYLE','SVG','svg','INPUT','TEXTAREA','SELECT','OPTION'].includes(el.tagName) && !el.closest('svg'));
  const words0 = t => words(t);
  for (const el of all) {
    if (seen.has(el) || !vis(el)) continue;
    const declared = el.closest('[data-copy-role]')?.dataset.copyRole;
    if (declared === 'data' || declared === 'legal' || declared === 'brand') continue;
    // An element that declares its own role is measured as one block with that role, before any heuristic.
    if (el.dataset.copyRole) {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      el.querySelectorAll('*').forEach(c => seen.add(c));
      if (t && words0(t)) { const r = el.getBoundingClientRect(); out.push({ role: el.dataset.copyRole, text: t, words: words(t), sentences: sentences(t), top: r.top - top0 }); }
      continue;
    }
    const raw = (el.innerText || '').trim();
    const pressable = el.matches('button,[role=button],a.btn,.btn,.lnk,[role=option]');
    const act = pressable && !raw.includes('\n');
    const opt = el.matches('.answer,.choice,.sel,[role=option]') || !!el.closest('.answer,.choice,.sel,[role=listbox]') || (pressable && el.matches('[aria-haspopup],[aria-expanded]') && !el.closest('nav,header'));
    if (pressable && !act) continue; // pressable card: measure its inner blocks instead
    if (!act && !isBlock(el)) continue;
    // a text block: no visible block-level descendant that itself carries text
    if (!act && [...el.children].some(c => isBlock(c) && vis(c) && c.innerText.trim())) continue;
    if (el.closest('td,th,.cell,.cell-b,table') || el.querySelector('select')) continue;
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim(); if (!text || words(text) === 0) continue;
    if (act) el.querySelectorAll('*').forEach(c => seen.add(c));
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const headingLike = el.matches('h1,h2,h3') || fs >= 22;
    const role = declared || (opt ? 'option' : act ? 'action' : headingLike ? (text.includes('?') ? 'prompt' : 'heading') : 'body');
    const r = el.getBoundingClientRect();
    out.push({ role, text, words: words(text), sentences: sentences(text), top: r.top - top0 });
  }
  const band = (document.documentElement.dataset.ageBand || app.dataset.ageBand || '');
  return { blocks: out, young: band === '6-9' };
};

async function setState(cfg) {
  const applied = await page.evaluate((c) => {
    clearTimeout(S._tt); if (typeof resetState === 'function') resetState();
    Object.assign(S, { enter: false, menu: false, tab: 0, toast: null, dialog: false, errs: {}, exIdx: 0, demo: { sel: null, checked: false } }, c);
    S.fx = null; render(); return new URLSearchParams(location.hash.slice(1)).get('route');
  }, cfg);
  if (applied !== cfg.route) throw new Error(`route not applied: ${cfg.route} -> ${applied}`);
}

const findings = []; const firstViews = [];
for (const [route, variant, extra] of states) for (const lang of langs) {
  await setState(Object.assign({ route, lang, theme: 'light', w: 375, stress: false, sel: null, checked: false }, extra));
  const kindOf = APP_ROUTES.has(route) ? 'app' : 'site';
  const res = await page.evaluate(MEASURE, FOLD); const blocks = res.blocks;
  const BUDGET = Object.assign({}, BUDGETS[kindOf], kindOf === 'app' && res.young ? YOUNG : {});
  const f = LANG_FACTOR[lang] || 1.25; const lim = k => Math.ceil(BUDGET[k] * f);
  const id = `${route}${variant ? ':' + variant : ''} ${lang}`;
  for (const b of blocks) {
    const cap = lim(b.role in BUDGET ? b.role : 'body');
    if (b.words > cap) findings.push({ id, route, lang, kind: b.role + '-words', words: b.words, cap, text: b.text.slice(0, 160) });
    const sMax = SENTENCES[kindOf][b.role] || 0;
    if (sMax && b.sentences > sMax) findings.push({ id, route, lang, kind: b.role + '-sentences', words: b.words, cap: sMax + ' sentences', text: b.text.slice(0, 160) });
  }
  if (APP_ROUTES.has(route)) { const w = blocks.filter(b => b.top < FOLD).reduce((s, b) => s + b.words, 0); firstViews.push({ id, words: w, cap: lim('firstView') }); if (w > lim('firstView')) findings.push({ id, route, lang, kind: 'first-view-words', words: w, cap: lim('firstView'), text: '' }); }
}
await browser.close();

// Deduplicate identical strings across variants, then summarise.
const uniq = new Map(); for (const x of findings) { const k = x.kind + '|' + x.lang + '|' + x.text + '|' + (x.kind === 'first-view-words' ? x.id : ''); if (!uniq.has(k)) uniq.set(k, x); }
const list = [...uniq.values()];
const byKind = {}; for (const x of list) byKind[x.kind] = (byKind[x.kind] || 0) + 1;
console.log(`Copy Budget audit: ${states.length} states x ${langs.length} languages. Distinct findings: ${list.length}`);
console.log(JSON.stringify(byKind));
for (const x of list.filter(x => x.lang === 'en').slice(0, 400)) console.log(`${x.id}\t${x.kind}\t${x.words}/${x.cap}\t${x.text}`);
if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify({ findings: list, firstViews }, null, 1));
process.exit(list.length ? 1 : 0);
} catch (e) {
  // Setup or driver failure (browser launch, navigation, a route that does not apply): exit 2, never 1.
  console.error('Setup error: ' + (e && e.message ? e.message : e));
  try { if (browser) await browser.close(); } catch (_) {}
  process.exit(2);
}
