// Mechanical assembly of explicitly authored multilingual storyboards; no model calls.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const locales = ['en-US', 'es-MX', 'pt-BR'];
export const L = values => Object.fromEntries(locales.map((locale, i) => [locale, values[i]]));
export const sharedKc = skill => `finance.${skill}`;
export const regional = JSON.parse(readFileSync(path.join(root, 'plans/fe-recovery-adult-03-protect-committed-money.json'), 'utf8')).regional;
export const examples = (id, title, line) => ({ id, type: 'voice.mentor-turn.v2', grading: 'none', teaching_role: 'example', visual: { type: 'speech-plate' }, payload: { role: 'transition', narration: { mode: 'text_only' } }, copy: Object.fromEntries(locales.map((locale, i) => [locale, { prompt: title[i], line: line[i] }])) });
/** Each locale supplies [prompt, scene, options, success explanation, retry hint, optional option-specific hints]. */
export function choice(id, role, skill, answer, text) {
  const order = text[0][2].map((_, i) => i).sort((a, b) => {
    const key = i => createHash('sha256').update(`${id}:${text[0][1]}:${i}`).digest('hex');
    return key(a).localeCompare(key(b));
  });
  return { id, type: 'story.branch.v2', grading: 'server', teaching_role: role, visual: { type: 'story-scene' },
    payload: { options: order.map(i => ({ id: `option-${i + 1}` })) }, rubric: { acceptable_choice_ids: [`option-${answer + 1}`] },
    item_role: role === 'transfer' ? 'transfer' : 'practice', ...(role === 'transfer' ? { item_phase: 'post' } : {}), knowledge_component_id: skill,
    copy: Object.fromEntries(locales.map((locale, i) => { const [prompt, scene, options, met, not_yet, hints] = text[i]; return [locale, { prompt, scene, options: order.map(index => ({ label: options[index] })), help: [not_yet], feedback: { met, not_yet, ...(hints ? { choice_hints: Object.fromEntries(hints.map((hint, j) => [`option-${j + 1}`, hint])) } : {}) } }]; })),
  };
}
export function unitPrice(id, role, quantities, prices, text) {
  const amounts = quantities.map((quantity, index) => prices[index] / quantity);
  const best = amounts.indexOf(Math.min(...amounts));
  if (amounts.filter(amount => amount === amounts[best]).length !== 1) throw new Error('Author an unambiguous least unit price.');
  return { id, type: 'money.unit-price.v2', grading: 'server', teaching_role: role, visual: { type: 'ratio-table' },
    payload: { currency: 'local', offers: quantities.map((quantity, i) => ({ id: `offer-${i + 1}`, quantity, price_minor: prices[i] * 100 })) },
    rubric: { unit_prices: Object.fromEntries(amounts.map((amount, i) => [`offer-${i + 1}`, String(amount)])), better_id: `offer-${best + 1}` },
    item_role: role === 'transfer' ? 'transfer' : 'practice', ...(role === 'transfer' ? { item_phase: 'post' } : {}), knowledge_component_id: 'money.unit-price',
    copy: Object.fromEntries(locales.map((locale, i) => [locale, { prompt: text[i][0], unitLabel: text[i][1], offers: text[i][2].map(label => ({ label })), feedback: { met: text[i][3], not_yet: text[i][4] }, help: [text[i][4]] }])),
  };
}
export function percent(id, role, base, rate, text) {
  return { id, type: 'visual.percent-grid.v2', grading: role === 'example' ? 'none' : 'server', teaching_role: role, visual: { type: 'percent-grid' },
    payload: { baseUnits: base, step: 5, initialPercent: 0, mode: 'discount', currency: 'local' },
    ...(role === 'example' ? {} : { rubric: { target_percent: rate }, item_role: role === 'transfer' ? 'transfer' : 'practice', ...(role === 'transfer' ? { item_phase: 'post' } : {}), knowledge_component_id: 'money.percent-intro' }),
    copy: Object.fromEntries(locales.map((locale, i) => [locale, { prompt: text[i][0], ...(role === 'example' ? {} : { feedback: { met: text[i][1], not_yet: text[i][2] }, help: [text[i][2]] }) }])),
  };
}
export function savings(id, periods, initial, maximum, step, text) {
  return { id, type: 'visual.savings-line.v2', grading: 'none', teaching_role: 'example', visual: { type: 'line' },
    payload: { periods, minimum: 0, maximum, step, initial, currency: 'local', unit: 'week' },
    copy: Object.fromEntries(locales.map((locale, i) => [locale, { prompt: text[i] }])),
  };
}
export function modelExample(id, type, visual, payload, prompts, localizedFields = [{}, {}, {}]) {
  return { id, type, grading: 'none', teaching_role: 'example', visual: { type: visual }, payload,
    copy: Object.fromEntries(locales.map((locale, i) => [locale, { prompt: prompts[i], ...localizedFields[i] }])),
  };
}
export function ledger(id, role, kc, initial, receive, pay, actions, text) {
  const balance = actions.reduce((value, action) => value + (action === 'sale' ? receive : -pay), initial);
  return { id, type: 'money.running-ledger.v2', grading: role === 'example' ? 'none' : 'server', teaching_role: role, visual: { type: 'balance-meter' },
    payload: { initial, sale: receive, cost: pay, maxEntries: actions.length, personal: true, currency: 'local' },
    ...(role === 'example' ? {} : { rubric: { target_balance: balance }, item_role: role === 'transfer' ? 'transfer' : 'practice', ...(role === 'transfer' ? { item_phase: 'post' } : {}), knowledge_component_id: kc }),
    copy: Object.fromEntries(locales.map((locale, i) => [locale, { prompt: text[i][0], ...(role === 'example' ? {} : { feedback: { met: text[i][1], not_yet: text[i][2] }, help: [text[i][2]] }) }])),
  };
}
export function makeLesson({ number, slug, unit, title, skill, prerequisites = [], retrieve = [], outcome, misconception, relevance, numeracy, segments, evidenceSkills = {}, kind = 'teach' }) {
  const hook = examples('hook-01', ['Why this matters', 'Para qué sirve', 'Por que isso importa'], relevance); hook.teaching_role = 'hook'; hook.payload.role = 'intro';
  const all = [hook, ...segments];
  // Each instructional skill has its own node in the existing shared KC graph.
  for (const segment of segments) if (segment.grading === 'server') segment.knowledge_component_id = sharedKc(evidenceSkills[segment.id] ?? skill);
  const priorExample = new Map();
  const evidence = segments.map(segment => {
    const itemSkill = evidenceSkills[segment.id] ?? skill;
    const supports = segment.teaching_role === 'guided' && priorExample.has(itemSkill) ? [priorExample.get(itemSkill)] : [];
    if (['example', 'guided'].includes(segment.teaching_role)) priorExample.set(itemSkill, segment.id);
    return { segment_id: segment.id, skill_id: itemSkill, context_id: `${slug}-${segment.id}`, supports_from: supports,
      reasoning: segment.copy['en-US'].feedback?.met ?? segment.copy['en-US'].line ?? segment.copy['en-US'].prompt };
  });
  const plan = { plan_version: 1, course_id: 'financial-education', pathway_id: 'financial-adult', chapter_id: unit,
    lesson_id: `fe-solid-${String(number).padStart(2, '0')}-${slug}`, age_band: 'adult', eligibility: { minimum_age: 18, maximum_age: 119 },
    knowledge_component_ids: [...new Set([sharedKc(skill), ...segments.filter(segment => segment.knowledge_component_id).map(segment => segment.knowledge_component_id)])],
    adventure_scene_id: 'diorama-a', mentor_stage: { character: 'rho', scene: 'diorama-a' }, brief: outcome, title: L(title), new_concepts: kind === 'teach' ? [sharedKc(skill)] : [], regional: { scenarios: Object.fromEntries(locales.map((locale, i) => [locale, { ...regional.scenarios[locale], scenario: [
      `Fictional US-dollar examples for "${title[0]}"; illustrative amounts, not current prices or product offers. No assumption of salary, bank ownership or spare income.`,
      `Ejemplos ficticios en pesos mexicanos para "${title[1]}"; montos ilustrativos, no precios vigentes ni ofertas. No se supone nómina, cuenta bancaria ni dinero sobrante.`,
      `Exemplos fictícios em reais para "${title[2]}"; valores ilustrativos, não preços atuais nem ofertas. Sem supor salário, conta bancária ou dinheiro sobrando.`,
    ][i] }])) },
    instruction: { version: 1, kind, objective: { skill_id: skill, observable_action: outcome, success_criterion: 'Complete the fresh-context transfer using only its visible information.' }, prerequisite_skills: prerequisites, retrieval_skills: retrieve,
      relevance: relevance[0], misconception, numeracy_support: numeracy, evidence,
      delayed_retrieval: { skill_id: skill, fresh_context: 'Apply this skill in a later integrated decision with a different constraint.' } },
    segments: all,
  };
  return plan;
}
export function writePlans(plans) {
  const directory = path.join(root, 'course-plans'); mkdirSync(directory, { recursive: true });
  for (const plan of plans) writeFileSync(path.join(directory, `${plan.lesson_id}.json`), `${JSON.stringify(plan, null, 2)}\n`);
}
