/*
 * The pass/fail rules of the three reference audits, applied in Node to what
 * `in-page.mjs` measured. Numbers are the references' (and the Bible's):
 * 03 §3 for proportion, 06 §3 for the copy budget.
 */

// 06 §3.1 / §3.2, English words; es-MX and pt-BR get x1.25 rounded up (06 §3).
export const BUDGETS = {
  app: { action: 3, heading: 6, body: 12, prompt: 20, mentor: 20, narrative: 30, option: 8, firstView: 40 },
  site: { action: 3, heading: 8, body: 25, prompt: 20, mentor: 20, narrative: 30, option: 8, firstView: Infinity },
};
export const YOUNG = { prompt: 12, option: 5, mentor: 12, firstView: 25 };
export const SENTENCES = { heading: 1, body: 2, prompt: 2, option: 1, mentor: 2, narrative: 2 };
export const FOLD = 740;
const factor = (locale) => (locale.startsWith('en') ? 1 : 1.25);

/** Copy budget findings for one measured state (copy-budget-audit.reference.mjs rules). */
export function copyFindings(result, state, locale, { firstView }) {
  const findings = [];
  const limit = (block, role) => {
    const base = { ...BUDGETS[block.site ? 'site' : state.budget], ...(!block.site && block.young ? YOUNG : {}) };
    return Math.ceil((base[role in base ? role : 'body']) * factor(locale));
  };
  for (const block of result.blocks) {
    const cap = limit(block, block.role);
    if (block.words > cap) findings.push([`${block.role}-words`, `${block.words}/${cap} "${block.text.slice(0, 120)}"`]);
    const max = SENTENCES[block.role];
    if (max && block.sentences > max) findings.push([`${block.role}-sentences`, `${block.sentences}/${max} "${block.text.slice(0, 120)}"`]);
  }
  // First view: product screens only, at 375 x 740, never with a modal over the page.
  if (firstView && state.firstView && !result.modal) {
    const counted = result.blocks.filter((block) => block.fold);
    const total = counted.reduce((sum, block) => sum + block.words, 0);
    const young = counted.some((block) => block.young) || result.blocks.some((block) => block.young);
    const site = state.budget === 'site';
    const cap = Math.ceil((site ? Infinity : young ? YOUNG.firstView : BUDGETS.app.firstView) * factor(locale));
    if (total > cap) findings.push(['first-view-words', `${total}/${cap}`]);
  }
  return findings;
}

/** Proportion findings for one measured state (proportion-audit.reference.mjs rules, 03 §3). */
export function proportionFindings(res, state, width) {
  const findings = [];
  const add = (type, detail) => findings.push([type, [detail].flat().join(' ; ')]);
  if (res.spacing.length) add('off-grid-spacing', res.spacing.map(([k, n]) => `${k} x${n}`));
  if (res.font.length) add('off-scale-font', res.font.map(([k, n]) => `${k} x${n}`));
  if (res.measure.length && !state.catalogue) add('measure>75', res.measure);
  if (res.uniform.length && state.budget === 'site') add('uniform-card-row', res.uniform);
  if (!state.catalogue && res.h1n !== 1) add('h1-count!=1', String(res.h1n));
  if (res.ratio !== null && !state.catalogue) { const min = state.budget === 'site' ? 3 : 1.5; if (res.ratio < min) add(`h1-body-ratio<${min}`, String(res.ratio)); }
  if (res.center !== null && res.center > 0.5 && width >= 768 && !state.centred && !state.catalogue) add('centered-text-share>50%', String(res.center));
  if (res.split !== null && res.split < 1.15) add('symmetric-hero-split', String(res.split));
  if (res.sizes > 9 && !state.catalogue) add('type-sizes>9', String(res.sizes));
  if (res.radii > 6 && !state.catalogue) add('radii>6', String(res.radii));
  if (res.accent > 3 && !state.catalogue) add('accent-buttons>3', String(res.accent));
  for (let i = 1, run = 1; i < res.rhythm.length; i++) { run = res.rhythm[i] === res.rhythm[i - 1] ? run + 1 : 1; if (run >= 3) { add('identical-section-rhythm x3', res.rhythm[i]); break; } }
  if (res.gaps) add('tap-gap<8px', [`${res.gaps} pairs`, ...res.pairs]);
  return findings;
}

/** Group findings the way the references print them: one key per type and element, with a count and a first example. */
export function aggregate(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.type} | ${row.detail.replace(/ (l|r|sw|cw)=-?\d+/g, '').replace(/\d+x\d+/g, '').replace(/\d+>\d+/g, '').replace(/\d+\/\d+ /, '')}`;
    if (!groups.has(key)) groups.set(key, { count: 0, first: row });
    groups.get(key).count++;
  }
  return [...groups.entries()].sort((a, b) => b[1].count - a[1].count).map(([key, value]) => ({ key, count: value.count, example: value.first }));
}
