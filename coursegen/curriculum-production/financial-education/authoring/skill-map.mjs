import { sequence, briefs } from './factory.mjs';

// Stable identities are independent of the agent/provider that writes a lesson.
// Reuse an existing skill only when the assessed competence matches its scope.
const reused = {
  'fe-production-financial-math-08': 'price.percent',
  'fe-production-cashflow-budget-08': 'plan.periodic',
  'fe-production-time-inflation-03': 'time.compound',
};
export const skillReconciliation = [
  { lesson_id: 'fe-production-financial-math-08', skill: 'price.percent', reason: 'Both compute a percentage of a stated whole. Unit-price comparison is incidental course context, not an irreducible prerequisite to percentages.' },
  { lesson_id: 'fe-production-cashflow-budget-08', skill: 'plan.periodic', reason: 'Both divide a known future obligation into contributions before its deadline. Retain shared timing and reserved-money prerequisites as explicit contextual preparation.' },
  { lesson_id: 'fe-production-time-inflation-03', skill: 'time.compound', reason: 'Both compute reinvested growth on an updated balance. Debt interest and purchasing-power interpretation are applications, not prerequisites to this arithmetic.' },
];
const opening = new Map(briefs.map(row => [row.lesson_id, row.kc_reconciliation.candidate.replace(/^finance\./, '')]));
export const skillMapping = Object.fromEntries(sequence.lessons.filter(row => row.kind === 'teach').map(row => [row.lesson_id,
  opening.get(row.lesson_id) ?? reused[row.lesson_id] ?? `prod.${row.lesson_id.replace('fe-production-', '').replace(/-(\d+)$/, '.$1')}`,
]));
export function resolveSkill(lessonId) {
  const skill = skillMapping[lessonId];
  if (!skill) throw new Error(`No teaching competence mapped for ${lessonId}`);
  return skill;
}

export const requiredSharedPreparation = {
  'price.percent': ['cash.balance'],
  'plan.periodic': ['cash.dates', 'cash.reserved'],
  'time.compound': ['price.percent'],
};
export function prerequisiteSkills(design) {
  const skill = resolveSkill(design.lesson_id);
  return [...new Set([...design.prerequisites.map(resolveSkill), ...(requiredSharedPreparation[skill] ?? [])])];
}
