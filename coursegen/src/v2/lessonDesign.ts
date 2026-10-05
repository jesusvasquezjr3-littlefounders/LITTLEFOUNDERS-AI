// Lesson design gate (pilot round 2): a lesson that introduces something new
// SHOWS it before it asks, and its exercises only reaffirm what was shown.
//
// Pilot round 1 was exercise-heavy: one Mentor intro, then five or six graded
// items, with no `pre` item and a single `post` tag. The worked-example effect
// (a novice learns more from studying a solved step than from solving it) and
// the testing effect (retrieval strengthens what was just learned) pull in the
// same direction once they are sequenced: demonstrate, guide, then reaffirm.
//
// Authors annotate each segment with its `teaching_role` (plan.ts). This module
// reads the annotations; it never touches the emitted document, so Core's strict
// contract is unchanged. Findings ride gate 14 (the lesson-design gate beside
// the B.17 concept cap): gate numbers are bounded by a database constraint, so
// a new check joins an existing gate rather than minting a new number.

import { V2_TEACHING_ROLES, type V2LessonPlan, type V2PlanSegment, type V2TeachingRole } from './plan.js';

export interface LessonDesignFinding { gate: 14; severity: 'block' | 'review'; segmentId?: string; message: string }
export interface LessonDesignOptions { /** A plan with no `teaching_role` at all blocks (default: it is skipped, so older plans still emit). */ required?: boolean }

const GRADED: ReadonlySet<V2TeachingRole> = new Set(['pre', 'guided', 'practice', 'transfer']);
const UNGRADED: ReadonlySet<V2TeachingRole> = new Set(['hook', 'example']);

/** Longest run of back-to-back demonstrations before the learner must do something. */
const EXAMPLE_RUN_REVIEW = 3;
const EXAMPLE_RUN_BLOCK = 5;
/** Independent exercises (practice + transfer) per demonstration (example + guided): above 1 is reviewed, above 2 blocks. */
const EXERCISE_RATIO_REVIEW = 1;
const EXERCISE_RATIO_BLOCK = 2;

export interface LessonDesignSummary {
  declared: boolean;
  roles: Record<V2TeachingRole, number>;
  demonstrations: number;
  independentExercises: number;
  /** Independent exercises per demonstration; null when there is no demonstration. */
  exerciseToDemonstration: number | null;
  hasPre: boolean;
  hasPost: boolean;
}

export function summarizeLessonDesign(plan: V2LessonPlan): LessonDesignSummary {
  const roles = Object.fromEntries(V2_TEACHING_ROLES.map((role) => [role, 0])) as Record<V2TeachingRole, number>;
  for (const segment of plan.segments) if (segment.teaching_role) roles[segment.teaching_role] += 1;
  const demonstrations = roles.example + roles.guided;
  const independentExercises = roles.practice + roles.transfer;
  return {
    declared: plan.segments.some((segment) => segment.teaching_role),
    roles,
    demonstrations,
    independentExercises,
    exerciseToDemonstration: demonstrations === 0 ? null : Number((independentExercises / demonstrations).toFixed(2)),
    hasPre: plan.segments.some((segment) => segment.item_phase === 'pre'),
    hasPost: plan.segments.some((segment) => segment.item_phase === 'post'),
  };
}

export function checkLessonDesign(plan: V2LessonPlan, options: LessonDesignOptions = {}): LessonDesignFinding[] {
  const findings: LessonDesignFinding[] = [];
  const block = (message: string, segment?: V2PlanSegment) => findings.push({ gate: 14, severity: 'block', ...(segment ? { segmentId: segment.id } : {}), message });
  const review = (message: string, segment?: V2PlanSegment) => findings.push({ gate: 14, severity: 'review', ...(segment ? { segmentId: segment.id } : {}), message });

  const summary = summarizeLessonDesign(plan);
  if (!summary.declared) {
    if (options.required) block(`names no teaching_role on any segment: annotate each segment as hook, pre, example, guided, practice or transfer so the examples-first arc can be checked`);
    return findings;
  }
  for (const segment of plan.segments) {
    if (!segment.teaching_role) block(`${segment.id} has no teaching_role: once a lesson names its roles, every segment does`, segment);
  }

  for (const segment of plan.segments) {
    const role = segment.teaching_role;
    if (!role) continue;
    if (UNGRADED.has(role) && segment.grading !== 'none') block(`${segment.id} is a ${role} but is graded: a ${role} demonstrates, so a graded step is a guided step or practice`, segment);
    if (GRADED.has(role) && segment.grading !== 'server') block(`${segment.id} is a ${role} but is not graded: the learner's answer is what a ${role} is for`, segment);
    if (role === 'pre' && segment.item_phase !== 'pre') block(`${segment.id} is the pre item but lacks item_phase "pre", so the learning gain cannot be computed`, segment);
    if (role !== 'pre' && segment.item_phase === 'pre') block(`${segment.id} carries item_phase "pre" but its role is ${role}: only the pre item is tagged pre`, segment);
    if (role === 'transfer' && segment.item_phase !== 'post') block(`${segment.id} is the transfer but lacks item_phase "post"`, segment);
    if (role !== 'transfer' && segment.item_phase === 'post') block(`${segment.id} carries item_phase "post" but its role is ${role}: only the transfer is tagged post`, segment);
    const itemRole = role === 'transfer' ? 'transfer' : GRADED.has(role) ? 'practice' : undefined;
    if (itemRole && segment.item_role !== itemRole) block(`${segment.id} is a ${role} and needs item_role "${itemRole}" so practice and transfer success can be compared (Appendix C)`, segment);
  }

  if (summary.roles.pre > 2) block(`has ${summary.roles.pre} pre items: one baseline item per primary skill (two at most), not a quiz before the lesson`);

  const firstExample = plan.segments.findIndex((segment) => segment.teaching_role === 'example');
  const introducesSomething = plan.new_concepts.length > 0;
  if (introducesSomething && firstExample === -1) {
    block(`introduces ${plan.new_concepts.length} new concept(s) but demonstrates none: add example segments (ungraded Mentor steps that show the skill) before the first exercise`);
  }
  if (firstExample !== -1) {
    plan.segments.forEach((segment, index) => {
      if (index < firstExample && segment.teaching_role && !['hook', 'pre'].includes(segment.teaching_role)) {
        block(`${segment.id} (${segment.teaching_role}) comes before the first example: show the skill first, then ask`, segment);
      }
    });
    plan.segments.forEach((segment, index) => {
      if (segment.teaching_role === 'pre' && index > firstExample) block(`${segment.id} is a pre item placed after teaching began: a pre item measures what the learner knew before the first example`, segment);
    });
  }

  const gradedRoles = plan.segments.filter((segment) => segment.teaching_role && GRADED.has(segment.teaching_role));
  const lastGraded = gradedRoles[gradedRoles.length - 1];
  if (gradedRoles.length > 0 && lastGraded && lastGraded.teaching_role !== 'transfer') {
    block(`ends its graded run with a ${lastGraded.teaching_role} (${lastGraded.id}): the last graded item is the transfer, a fresh instance tagged post`, lastGraded);
  }
  if (gradedRoles.length > 0 && summary.roles.transfer === 0) block(`has no transfer item: the lesson needs one fresh-instance item with role transfer and item_phase post`);

  let run = 0;
  let runStart: V2PlanSegment | undefined;
  let reported = false;
  for (const segment of plan.segments) {
    if (segment.teaching_role === 'example') {
      run += 1;
      runStart ??= segment;
    } else {
      run = 0;
      runStart = undefined;
      reported = false;
    }
    if (run > EXAMPLE_RUN_BLOCK && runStart) {
      block(`runs ${run} examples in a row from ${runStart.id}: after at most ${EXAMPLE_RUN_BLOCK} demonstrations the learner does a guided step`, segment);
      reported = true;
    } else if (run > EXAMPLE_RUN_REVIEW && runStart && !reported) {
      review(`runs ${run} examples in a row from ${runStart.id}: interleave a guided step so the learner is not only watching`, segment);
      reported = true;
    }
  }

  if (summary.exerciseToDemonstration !== null) {
    const ratio = summary.exerciseToDemonstration;
    const where = `${summary.independentExercises} independent exercise(s) against ${summary.demonstrations} demonstration step(s)`;
    if (ratio > EXERCISE_RATIO_BLOCK) block(`is exercise-led, ${where}: exercises reaffirm, so show more or ask less`);
    else if (ratio > EXERCISE_RATIO_REVIEW) review(`leans on exercises, ${where}: Stage 3 checks the examples carry the teaching`);
  }

  const pre = plan.segments.find((segment) => segment.teaching_role === 'pre');
  const transfer = plan.segments.find((segment) => segment.teaching_role === 'transfer');
  if (pre?.knowledge_component_id && transfer?.knowledge_component_id && pre.knowledge_component_id !== transfer.knowledge_component_id) {
    review(`the pre item (${pre.knowledge_component_id}) and the transfer (${transfer.knowledge_component_id}) evidence different knowledge components, so the learning gain pairs nothing`, transfer);
  }
  return findings;
}
