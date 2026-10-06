import { readFileSync } from 'node:fs';
import { makeLesson, examples, choice } from '../../../../curriculum-recovery/financial-education/authoring/assemble.mjs';

export const sequence = JSON.parse(readFileSync(new URL('../../../../curriculum-design/financial-education/lesson-sequence.json', import.meta.url), 'utf8')).lessons;
export const tr = text => text.split('|');
export const ex = (id, title, lines) => examples(id, tr(title), tr(lines));
// The compact source format stores every localized scene, answer and explanation explicitly.
export function q(id, role, rows, answer = 0) {
  return choice(id, role, 'pending', answer, rows.map(row => {
    const [prompt, scene, options, met, retry] = row.split('|');
    return [prompt, scene, options.split('~'), met, retry];
  }));
}
export const proposedSkill = id => `prod.${id.replace('fe-production-', '').replace(/-(\d+)$/, '.$1')}`;
export function workedFees(id, gross, tradeFee, ongoingFee, texts) {
  const values = [gross, gross - tradeFee, gross - tradeFee - ongoingFee];
  return {
    id, type: 'math.worked-example.v2', grading: 'server', teaching_role: 'guided', item_role: 'practice', knowledge_component_id: 'pending', visual: { type: 'worked-example' },
    payload: { steps: [{ id: 'gross-return' }, { id: 'after-trade' }, { id: 'after-ongoing' }], fade_count: 1, response_step_ids: ['after-trade', 'after-ongoing'] },
    rubric: { expectedValues: { 'after-trade': String(values[1]), 'after-ongoing': String(values[2]) } },
    copy: Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale, i) => {
      const [prompt, grossLabel, tradeLabel, ongoingLabel, met, retry] = texts[i].split('|');
      return [locale, { prompt, help: [retry], feedback: { met, not_yet: retry }, steps: [
        { expression: grossLabel, result: String(gross), spokenText: grossLabel },
        { expression: `${gross} − ${tradeFee}`, result: String(values[1]), spokenText: tradeLabel },
        { expression: `${values[1]} − ${ongoingFee}`, result: String(values[2]), spokenText: ongoingLabel },
      ] }];
    })),
  };
}
export function workedSteps(id, expressions, values, texts) {
  const stepIds = expressions.map((_, index) => `step-${index + 1}`);
  return {
    id, type: 'math.worked-example.v2', grading: 'server', teaching_role: 'guided', item_role: 'practice', knowledge_component_id: 'pending', visual: { type: 'worked-example' },
    payload: { steps: stepIds.map(stepId => ({ id: stepId })), fade_count: 1, response_step_ids: stepIds.slice(1) },
    rubric: { expectedValues: Object.fromEntries(stepIds.slice(1).map((stepId, index) => [stepId, String(values[index + 1])])) },
    copy: Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale, i) => {
      const [prompt, met, retry, ...labels] = texts[i].split('|');
      const localNumber = value => locale === 'pt-BR' ? String(value).replace(/(\d)\.(\d)/g, '$1,$2') : String(value);
      return [locale, { prompt, feedback: { met, not_yet: retry }, help: [retry], steps: expressions.map((expression, index) => ({ expression: localNumber(expression), result: localNumber(values[index]), spokenText: labels[index] })) }];
    })),
  };
}
export function projectionChart(id, role, values, texts, prefer = 'higher', seriesLabels = ['Balance', 'Saldo', 'Saldo']) {
  const optionIds = role === 'practice' ? ['later', 'earlier'] : ['earlier', 'later'];
  return {
    id, type: 'visual.chart.v2', grading: 'server', teaching_role: role, item_role: role === 'transfer' ? 'transfer' : 'practice', ...(role === 'transfer' ? { item_phase: 'post' } : {}), knowledge_component_id: 'pending', visual: { type: 'bar' },
    payload: { data: { unit: 'local', categories: [{ id: 'earlier' }, { id: 'later' }], series: [{ id: 'projected-balance', values }] }, question: { options: optionIds.map(optionId => ({ id: optionId })) } },
    rubric: { acceptable_choice_ids: [(prefer === 'lower' ? values[0] < values[1] : values[0] > values[1]) ? 'earlier' : 'later'] },
    copy: Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale, i) => {
      const [prompt, title, earlier, later, question, met, retry] = texts[i].split('|');
      return [locale, { prompt, title, data: { categories: [{ label: earlier }, { label: later }], series: [{ label: seriesLabels[i] }] }, question: { prompt: question, options: optionIds.map(optionId => ({ label: optionId === 'earlier' ? earlier : later })) }, feedback: { met, not_yet: retry }, help: [retry] }];
    })),
  };
}
export function projectBalance(deposit, growth, periods, skippedPeriods = 0, fee = 0) {
  let balance = 0;
  for (let period = 0; period < periods; period += 1) {
    if (period >= skippedPeriods) balance += deposit;
    balance = balance * (1 + growth) - (period >= skippedPeriods ? fee : 0);
  }
  return Math.round(balance * 100) / 100;
}
export function buildTeach(id, title, relevance, misconception, segments, resolve = proposedSkill) {
  const design = sequence.find(row => row.lesson_id === id);
  if (!design || design.kind !== 'teach') throw new Error(`Unknown teaching slot ${id}`);
  const skill = resolve(id).replace(/^finance\./, '');
  const prerequisites = design.prerequisites.map(ref => resolve(ref).replace(/^finance\./, ''));
  const plan = makeLesson({ number: Number(id.match(/\d+$/)[0]), slug: id.replace('fe-production-', ''), unit: `fe-production-${design.domain}`, title: tr(title), skill, prerequisites, outcome: design.objective,
    misconception, relevance: tr(relevance), numeracy: 'Use only the visible fictional amounts and conditions; earlier arithmetic is preparation, not a hidden financial assumption.', segments: structuredClone(segments) });
  plan.lesson_id = id;
  return plan;
}
export const teach = (domain, number, title, relevance, misconception, segments) => ({
  id: `fe-production-${domain}-${String(number).padStart(2, '0')}`, title, relevance, misconception, segments,
});
export function assemble(storyboards, resolve = proposedSkill) {
  return storyboards.map(row => row.primary ? buildReview(row, resolve) : buildTeach(row.id, row.title, row.relevance, row.misconception, row.segments, resolve));
}
export function buildReview(row, resolve = proposedSkill) {
  const design = sequence.find(item => item.lesson_id === row.id);
  const primary = sequence.find(item => item.lesson_id === row.primary);
  const skill = resolve(row.primary).replace(/^finance\./, '');
  const evidenceSkills = Object.fromEntries(row.segments.map((segment, i) => [segment.id, resolve(row.skills[i]).replace(/^finance\./, '')]));
  const plan = makeLesson({ number: Number(row.id.match(/\d+$/)[0]), slug: row.id.replace('fe-production-', ''), unit: `fe-production-${design.domain}`,
    title: tr(row.title), skill, kind: 'consolidate', prerequisites: primary.prerequisites.map(id => resolve(id).replace(/^finance\./, '')),
    retrieve: design.retrieve_objectives.map(id => resolve(id).replace(/^finance\./, '')), outcome: row.outcome, misconception: row.misconception,
    relevance: tr(row.relevance), numeracy: 'Use the current visible conditions; do not reuse a previous scenario’s answer.', segments: structuredClone(row.segments), evidenceSkills });
  plan.lesson_id = row.id;
  return plan;
}
