import { readFileSync } from 'node:fs';
import { makeLesson, examples, choice } from '../../../../curriculum-recovery/financial-education/authoring/assemble.mjs';

export const sequence = JSON.parse(readFileSync(new URL('../../../../curriculum-design/financial-education/lesson-sequence.json', import.meta.url), 'utf8')).lessons;
export const t = (en, es, pt) => [en, es, pt];
export const i = input => ({ input });
export const op = (operation, ...args) => ({ op: operation, args });
export const row = (prompt, scene, options, met, hint) => [prompt, scene, options, met, hint];
export function item(role, texts, proof) {
  return { role, texts, proof };
}
export function calculation(role, prompts, scenes, answers, feedback, hints, inputs, expression) {
  return item(role, prompts.map((prompt, index) => row(prompt, scenes[index], answers.map(String), feedback[index], hints[index])), [inputs, expression]);
}
export function assemble(record, resolveKc) {
  const design = sequence.find(value => value.lesson_id === record.id);
  if (!design) throw new Error(`Unknown curriculum lesson ${record.id}`);
  const skill = resolveKc(record.primary ?? record.id);
  if (!skill) throw new Error(`Missing skill mapping ${record.id}`);
  const segments = record.example ? [examples('example-01', record.exampleTitle ?? t('Follow the evidence', 'Sigue las pruebas', 'Siga as provas'), record.example)] : [];
  const evidenceSkills = {};
  if (record.guidedBoard) segments.push(record.guidedBoard);
  record.items.forEach((authored, index) => {
    const segment = choice(`${authored.role}-${String(index + 1).padStart(2, '0')}`, authored.role, `finance.${skill}`, 0, authored.texts);
    if (authored.proof) segment.numeric_proof = { source: 'scene', visible_inputs: authored.proof[0], expression: authored.proof[1] };
    evidenceSkills[segment.id] = resolveKc(authored.retrieve ?? record.primary ?? record.id);
    segments.push(segment);
  });
  const graded = segments.filter(segment => segment.type === 'story.branch.v2');
  const keyPositions = graded.map(segment => segment.payload.options.findIndex(option => segment.rubric.acceptable_choice_ids.includes(option.id)));
  if (graded.length > 1 && new Set(keyPositions).size === 1) {
    const last = graded.at(-1);
    last.payload.options.reverse();
    for (const copy of Object.values(last.copy)) copy.options.reverse();
  }
  const prerequisiteDesign = record.primary ? sequence.find(value => value.lesson_id === record.primary) : design;
  const plan = makeLesson({ number: 1, slug: record.id, unit: `fe-production-${design.domain}`, title: record.title, skill,
    prerequisites: prerequisiteDesign.prerequisites.map(resolveKc), retrieve: design.retrieve_objectives.map(resolveKc), kind: design.kind,
    outcome: design.objective ?? record.outcome, misconception: record.misconception,
    relevance: record.relevance, numeracy: record.numeracy ?? 'Every quantity and assumption needed to decide is visible in the current scenario. Examples explain the relationship before independent application.', segments, evidenceSkills });
  plan.lesson_id = record.id;
  return plan;
}

export function worked(prompts, steps, feedback, hints) {
  return {
    id: 'guided-worked-01', type: 'math.worked-example.v2', grading: 'server', teaching_role: 'guided',
    visual: { type: 'worked-example' },
    payload: { steps: steps.map((_, index) => ({ id: `step-${index + 1}` })), fade_count: 1, response_step_ids: steps.slice(1).map((_, index) => `step-${index + 2}`) },
    rubric: { expectedValues: Object.fromEntries(steps.slice(1).map((step, index) => [`step-${index + 2}`, String(step.result)])) },
    item_role: 'practice',
    copy: Object.fromEntries(['en-US', 'es-MX', 'pt-BR'].map((locale, index) => [locale, {
      prompt: prompts[index], steps: steps.map(step => ({ expression: step.expression, result: String(step.result), spokenText: step.spoken[index] })),
      feedback: { met: feedback[index], not_yet: hints[index] }, help: [hints[index]],
    }])),
  };
}
