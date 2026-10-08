import { z } from 'zod';
import type { V2LessonPlan } from './plan.js';
import type { LessonDesignFinding } from './lessonDesign.js';
import { checkNumericEvidence } from './numericEvidence.js';

const text = z.string().trim().min(8).max(600);
const id = z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,100}$/);
export const instructionalContractSchema = z.object({
  version: z.literal(1),
  kind: z.enum(['teach', 'consolidate', 'capstone']).default('teach'),
  objective: z.object({ skill_id: id, observable_action: text, success_criterion: text }).strict(),
  prerequisite_skills: z.array(id),
  retrieval_skills: z.array(id).default([]),
  relevance: text,
  misconception: text,
  numeracy_support: text,
  evidence: z.array(z.object({
    segment_id: id,
    skill_id: id,
    context_id: id,
    supports_from: z.array(id),
    reasoning: text,
  }).strict()).min(3),
  delayed_retrieval: z.object({ skill_id: id, fresh_context: text }).strict(),
}).strict();

/** Structural evidence, never a certificate of semantic correctness or learner outcomes. */
export function checkInstructionalContract(plan: V2LessonPlan, required = false): LessonDesignFinding[] {
  const contract = plan.instruction;
  const findings: LessonDesignFinding[] = [];
  const block = (message: string, segmentId?: string) => findings.push({ gate: 14, severity: 'block', message, ...(segmentId ? { segmentId } : {}) });
  if (!contract) {
    if (required) block('Missing instructional contract: objective, prerequisite skills, teaching evidence and delayed retrieval are required.');
    return findings;
  }
  findings.push(...checkNumericEvidence(plan));
  const primary = contract.objective.skill_id;
  const skills = new Set([primary, ...contract.prerequisite_skills, ...contract.retrieval_skills]);
  if (contract.prerequisite_skills.includes(primary)) block('The primary skill cannot be its own prerequisite.');
  if (new Set(contract.prerequisite_skills).size !== contract.prerequisite_skills.length) block('Prerequisite skills are duplicated.');
  if (new Set(contract.retrieval_skills).size !== contract.retrieval_skills.length) block('Retrieval skills are duplicated.');
  if (contract.delayed_retrieval.skill_id !== primary) block('Delayed retrieval must revisit the primary skill.');
  const byId = new Map(plan.segments.map((segment, index) => [segment.id, { segment, index }]));
  const evidence = new Map(contract.evidence.map(item => [item.segment_id, item]));
  if (evidence.size !== contract.evidence.length) block('Teaching evidence repeats a segment.');
  for (const item of contract.evidence) {
    const current = byId.get(item.segment_id);
    if (!current) { block(`Evidence refers to missing segment ${item.segment_id}.`); continue; }
    if (!skills.has(item.skill_id)) block(`Undeclared skill ${item.skill_id} is assessed or taught.`, item.segment_id);
    for (const support of item.supports_from) {
      const previous = byId.get(support);
      if (!previous || previous.index >= current.index) block(`Support ${support} must exist before the supported step.`, item.segment_id);
      else if (evidence.get(support)?.skill_id !== item.skill_id) block(`Support ${support} must teach the same skill.`, item.segment_id);
      else if (!['example', 'guided'].includes(previous.segment.teaching_role ?? '')) block(`Support ${support} must be an example or guided step.`, item.segment_id);
    }
    if (current.segment.teaching_role === 'guided' && item.supports_from.length === 0) block('Guided practice needs an explicit earlier example or supported step.', item.segment_id);
    if (['practice', 'transfer'].includes(current.segment.teaching_role ?? '') && item.supports_from.length > 0) block('Independent practice cannot depend on an earlier displayed solution.', item.segment_id);
  }
  for (const segment of plan.segments) {
    if (segment.teaching_role !== 'hook' && !evidence.has(segment.id)) block('Every teaching and assessment step needs skill evidence.', segment.id);
    if (segment.grading === 'server') {
      for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
        if (!segment.copy[locale].feedback?.met || !segment.copy[locale].feedback?.not_yet) block(`Missing explanatory feedback in ${locale}.`, segment.id);
      }
    }
  }
  for (const role of contract.kind === 'teach' ? ['example', 'guided', 'practice', 'transfer'] : ['practice', 'transfer']) {
    if (!plan.segments.some(segment => segment.teaching_role === role && evidence.get(segment.id)?.skill_id === primary)) block(`Primary skill has no ${role} evidence.`);
  }
  for (const segment of plan.segments.filter(item => item.teaching_role === 'transfer')) {
    const context = evidence.get(segment.id)?.context_id;
    if (context && plan.segments.some(other => other.id !== segment.id && evidence.get(other.id)?.context_id === context)) block('Transfer must use a new context, not the taught example.', segment.id);
    for (const previous of plan.segments.filter(other => other.id !== segment.id && other.grading === 'server')) {
      if (JSON.stringify(previous.payload) === JSON.stringify(segment.payload) && JSON.stringify(previous.copy) === JSON.stringify(segment.copy)) block('Transfer duplicates an earlier exercise verbatim.', segment.id);
    }
  }
  // A constant choice position teaches an exploit rather than the intended discrimination.
  for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) {
    const positions: number[] = [];
    for (const segment of plan.segments.filter(item => item.grading === 'server')) {
      const rubric = segment.rubric_by_locale?.[locale] ?? segment.rubric;
      const accepted = rubric?.acceptable_choice_ids;
      const payload = segment.payload as { options?: Array<{ id: string }>; replies?: Array<{ id: string }>; question?: { options?: Array<{ id: string }> } };
      const options = payload.options ?? payload.replies ?? payload.question?.options;
      if (Array.isArray(options) && Array.isArray(accepted) && options.every(option => accepted.includes(option.id))) block(`${locale}: every visible choice is accepted; this cannot evidence the claimed discrimination.`, segment.id);
      if (Array.isArray(options) && Array.isArray(accepted) && accepted.length === 1) {
        const index = options.findIndex(option => option.id === accepted[0]);
        if (index >= 0) positions.push(index);
      }
    }
    if (positions.length >= 4 && new Set(positions).size === 1) block(`${locale}: every one of ${positions.length} single-answer choices uses position ${positions[0]! + 1}; vary the discrimination instead of teaching a position shortcut.`);
  }
  return findings;
}

export const SHARED_INSTRUCTIONAL_RULES = [
  'Teach one observable primary skill. Age is not evidence of prior financial knowledge.',
  'Show the decision and why it works, then guide an action, remove support and require a fresh-context transfer.',
  'Every prerequisite must be taught earlier, checked through the shared placement graph, or supported explicitly. Do not hide arithmetic prerequisites.',
  'Use an interaction because its state changes express the concept, not to meet an exercise-type quota.',
  'Budget the whole first mobile view, including the lesson title, question, scene, all visible options, Mentor label and controls. Per-field limits do not add up to a screen allowance. The app first-view limit is 40 words in en-US and 50 in es-MX/pt-BR; ages 6-9 use 25 and 32. Leave room for interface text and verify the actual rendered player.',
  'Keep every fact needed to solve the current assessment on its current board. Shorten redundant wording before removing conditions; never hide essential amounts, dates, units or assumptions in optional help, audio or an earlier step. Keep questions and answer choices grammatically aligned after shortening or localization.',
  'Recompute answers from visible inputs. A solvable key is not proof that the authored key or explanation is correct.',
  'Every rejected choice must represent a plausible misconception about the current decision. Reject unrelated jokes, personal preferences and absurd filler; two meaningful options are better than three with a giveaway. Independently try to justify every option from the visible facts in each locale, and revise any question with multiple defensible answers.',
  'Make financial assumptions explicit: opening balances, available funds before a deadline, positive rates, remaining payment schedules, charges and coverage conditions. An unknown benefit is not a proven disadvantage. Teach a procedure before grading its first use, and make transfer apply that same objective in a genuinely different decision.',
  'Explain the consequence of the learner action. Never praise reasoning that the scorer did not check.',
  'Plan later retrieval and interleaving in the existing shared mastery/review system. Do not invent a second scheduler.',
  'Do not claim mastery, retention or habit formation from schema validity, a completed lesson or an agent review.',
] as const;
