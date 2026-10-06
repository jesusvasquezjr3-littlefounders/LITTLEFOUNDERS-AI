import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { makeLesson, examples, choice, ledger } from '../../../curriculum-recovery/financial-education/authoring/assemble.mjs';

// Reuse the proven mechanical assembler; all production identities and curriculum bindings are explicit.
export { examples as E, choice as Q, ledger };
const designRoot = new URL('../../../curriculum-design/financial-education/', import.meta.url);
export const sequence = JSON.parse(readFileSync(new URL('lesson-sequence.json', designRoot), 'utf8'));
export const briefs = JSON.parse(readFileSync(new URL('opening-briefs.json', designRoot), 'utf8')).briefs;
const mapping = new Map(briefs.map(brief => [brief.lesson_id, brief.kc_reconciliation.candidate.replace(/^finance\./, '')]));
const id = number => `fe-production-usable-money-${String(number).padStart(2, '0')}`;

export function define(number, title, relevance, segments) {
  const lessonId = id(number);
  const design = sequence.lessons.find(lesson => lesson.lesson_id === lessonId);
  const brief = briefs.find(row => row.lesson_id === lessonId);
  if (!design || !brief || design.kind !== 'teach') throw new Error(`Missing teaching design for ${lessonId}`);
  const prerequisites = design.prerequisites.map(reference => {
    const skill = mapping.get(reference);
    if (!skill) throw new Error(`Unmapped prerequisite ${reference}`);
    return skill;
  });
  const plan = makeLesson({
    number, slug: `production-money-${number}`, unit: 'fe-production-usable-money',
    title, skill: mapping.get(lessonId), prerequisites,
    outcome: design.objective, misconception: brief.misconception,
    relevance, numeracy: brief.numeracy_support, segments,
  });
  plan.lesson_id = lessonId;
  plan.instruction.delayed_retrieval.fresh_context = 'Use the skill in the scheduled usable-money review and later financial decisions; this draft does not yet contain those review exercises.';
  return plan;
}

export const adoptedSources = [
  ['fe-solid-01-money-moves', 'b8c6870dbe4c7690efcd7a2d8f392c78e4813a44c58f13fc0acbb53c402e79d3'],
  ['fe-solid-02-received-not-promised', '586db9db18c7100c8eac28fae445a3f193819ca0aca164414e45f6d025e999a5'],
  ['fe-solid-03-update-your-balance', '1bcab3326bfc1fdf3eaa78a87b7856d0e760cbd0cd79b00123582375896997bc'],
];

export function adoptOpening(number) {
  const [sourceId, expectedHash] = adoptedSources[number];
  const file = new URL(`../../../curriculum-recovery/financial-education/course-plans/${sourceId}.json`, import.meta.url);
  const raw = readFileSync(file, 'utf8');
  if (createHash('sha256').update(raw).digest('hex') !== expectedHash) throw new Error(`Review changed calibration source before adopting ${sourceId}.`);
  const source = JSON.parse(raw);
  // The approved instructional sequence is retained; draft brief examples are alternatives, not copied claims.
  const plan = define(number, Object.values(source.title), Object.values(source.segments[0].copy).map(copy => copy.line), source.segments.slice(1));
  for (const segment of plan.segments) {
    if (segment.type !== 'money.running-ledger.v2' || segment.grading !== 'server') continue;
    for (const [locale, copy] of Object.entries(segment.copy)) copy.feedback.met = {
      'en-US': 'The final balance matches the stated receipts and payments.',
      'es-MX': 'El saldo final coincide con las entradas y pagos indicados.',
      'pt-BR': 'O saldo final corresponde às entradas e aos pagamentos informados.',
    }[locale];
  }
  return plan;
}

export function numeric(segment, visible_inputs, expression) {
  segment.numeric_proof = { source: 'scene', visible_inputs, expression };
  return segment;
}
export const input = index => ({ input: index });
export const subtract = (left, right) => ({ op: 'subtract', args: [left, right] });
export const add = (left, right) => ({ op: 'add', args: [left, right] });

export function defineReview(number, title, relevance, outcome, primaryNumber, segments, evidenceSkills) {
  const lessonId = `fe-production-usable-money-review-${number}`;
  const design = sequence.lessons.find(lesson => lesson.lesson_id === lessonId);
  const primaryId = id(primaryNumber);
  const primary = sequence.lessons.find(lesson => lesson.lesson_id === primaryId);
  if (!design || !primary) throw new Error(`Missing review design ${lessonId}`);
  const plan = makeLesson({
    number, slug: `production-money-review-${number}`, unit: 'fe-production-usable-money',
    title, skill: mapping.get(primaryId), kind: 'consolidate',
    prerequisites: primary.prerequisites.map(reference => mapping.get(reference)),
    retrieve: design.retrieve_objectives.map(reference => mapping.get(reference)),
    outcome, misconception: 'Repeating a previous answer without checking the current person, payment status and commitments.',
    relevance, numeracy: 'All amounts and conditions needed for the current decision remain visible. Arithmetic uses previously demonstrated receipt, payment and reservation relationships.',
    segments, evidenceSkills,
  });
  plan.lesson_id = lessonId;
  plan.instruction.delayed_retrieval.fresh_context = 'Revisit these money decisions in the later budget and payment domains; this opening batch does not implement those domains.';
  return plan;
}
