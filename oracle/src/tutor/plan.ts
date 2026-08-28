import type { Adaptation, PlanState, TutorIntent } from '../context/schema.js';
import { ADAPTATIONS, PLAN_STEPS } from '../context/schema.js';

/*
 * The lesson plan — the spine that makes a session a LESSON rather than a
 * playlist of replies (/ORACLE.md §9.3).
 *
 * Everything here is deterministic and server-owned, on purpose. The model is
 * good at PERFORMING a step — explaining warmly, choosing an example, writing
 * a check-in question — and bad at remembering which step it is on, because
 * its only memory is a transcript it re-reads under a token budget. Before
 * this file existed, "adaptivity" was one sentence in the system prompt asking
 * the model to notice when a learner was stuck twice; nothing counted, so
 * nothing noticed. Now the counting is arithmetic here, and the model is told
 * the state instead of being asked to reconstruct it.
 *
 * The plan is built WITHOUT a model call — a session must not open with a paid
 * round trip to decide that teaching starts by explaining — and advanced by
 * events the server witnesses itself: a graded result, a served activity.
 * Nothing the learner types moves the plan; only what they demonstrably do.
 */

export type PlanStep = (typeof PLAN_STEPS)[number];

/** A learner has missed the same skill this many times → change the approach. */
export const STUCK_THRESHOLD = 2;
/** …and this many times → the tutor should OFFER an adaptation (/ORACLE.md §11). */
export const OFFER_ADAPTATION_THRESHOLD = 3;

export interface LessonPlan {
  objective: string;
  steps: PlanStep[];
  stepIndex: number;
  /** Learner turns spent on the current step, so talk-only steps still move. */
  turnsOnStep: number;
  /** Consecutive failures per skill, this session. */
  failures: Map<string, number>;
  stuckSkillKey: string | null;
  stylesTried: Adaptation[];
}

/**
 * The step sequences, per intent. Closed and short: a 15-minute session fits
 * about five beats, and a plan longer than the session is a plan that always
 * ends mid-air.
 */
const SEQUENCES: Record<TutorIntent, PlanStep[]> = {
  course_topic: ['explain', 'practice', 'check', 'practice', 'stretch'],
  weak_skill: ['warmup', 'explain', 'practice', 'practice', 'check'],
  diagnostic: ['warmup', 'check', 'check', 'explain'],
  faq: ['explain', 'check', 'practice'],
  open: ['explain', 'practice', 'check'],
};

/** Composed from OUR titles and the closed intent vocabulary — never learner text. */
export function buildPlan(
  intent: TutorIntent,
  courseContext: { courseTitle: string | null; topicTitle: string | null } | null,
  skillKey: string | null,
): LessonPlan {
  const subject =
    courseContext?.topicTitle ?? courseContext?.courseTitle ?? skillKey ?? null;
  const objective =
    intent === 'diagnostic'
      ? 'Find out where this learner actually stands, gently.'
      : subject
        ? `Teach one real idea about "${subject}" until the learner can use it.`.slice(0, 200)
        : 'Teach one real idea from whatever the learner brings, until they can use it.';
  return {
    objective,
    steps: SEQUENCES[intent],
    stepIndex: 0,
    turnsOnStep: 0,
    failures: new Map(),
    stuckSkillKey: null,
    stylesTried: [],
  };
}

/**
 * A graded activity came back — the one event that MOVES a plan.
 *
 * Correct: the failure streak for that skill resets and the plan advances.
 * Incorrect: the streak grows, and past the threshold the skill is STUCK —
 * the plan stays on its step (advancing past something the learner just
 * missed is how a playlist behaves) and the next explanation style is picked
 * deterministically from the ones not yet tried.
 */
export function recordGrade(plan: LessonPlan, skillKey: string, correct: boolean): void {
  if (correct) {
    plan.failures.delete(skillKey);
    if (plan.stuckSkillKey === skillKey) {
      plan.stuckSkillKey = null;
      plan.stylesTried = [];
    }
    advance(plan);
    return;
  }
  const failures = (plan.failures.get(skillKey) ?? 0) + 1;
  plan.failures.set(skillKey, failures);
  if (failures >= STUCK_THRESHOLD) plan.stuckSkillKey = skillKey;
}

/** The conversation moved on without an activity (a `check` answered in words). */
export function advance(plan: LessonPlan): void {
  if (plan.stepIndex < plan.steps.length - 1) plan.stepIndex += 1;
  plan.turnsOnStep = 0;
}

/**
 * A plain conversational exchange happened. Talk-only steps (warmup, explain,
 * check, stretch) move after two exchanges — a lesson that never leaves
 * "explain" because nobody graded anything is the stall this prevents. A
 * practice step gets a longer leash (the activity is the exit), but even it
 * moves after three, because a model that never requests a segment must not
 * pin the plan to one step forever.
 */
export function noteConversationTurn(plan: LessonPlan): void {
  plan.turnsOnStep += 1;
  const step = plan.steps[plan.stepIndex];
  const limit = step === 'practice' ? 3 : 2;
  if (plan.turnsOnStep >= limit) advance(plan);
}

/** The next explanation style to try against a stuck skill, or null when exhausted. */
export function nextStyle(plan: LessonPlan): Adaptation | null {
  return ADAPTATIONS.find((style) => !plan.stylesTried.includes(style)) ?? null;
}

/** The strict projection that is allowed to reach the model (schema.ts). */
export function planState(plan: LessonPlan): PlanState {
  const stuckCount = plan.stuckSkillKey ? (plan.failures.get(plan.stuckSkillKey) ?? 0) : 0;
  return {
    objective: plan.objective,
    steps: plan.steps,
    stepIndex: plan.stepIndex,
    stuckSkillKey: plan.stuckSkillKey,
    stuckCount: Math.min(stuckCount, 10),
    stylesTried: [...plan.stylesTried],
  };
}

/**
 * The system-side instruction a stuck skill earns, appended to the graded
 * result's prompt. DETERMINISTIC: the model is not asked to notice — it is
 * told, and told what to do differently, in words the prompt's own adaptation
 * vocabulary already defines.
 */
export function stuckInstruction(plan: LessonPlan, skillKey: string): string | null {
  const failures = plan.failures.get(skillKey) ?? 0;
  if (failures < STUCK_THRESHOLD) return null;

  const style = nextStyle(plan);
  if (style && failures < OFFER_ADAPTATION_THRESHOLD) {
    plan.stylesTried.push(style);
    return (
      `The learner has now missed this skill ${failures} times. Do NOT explain it the same way again — ` +
      `change the approach entirely, in the direction of "${style.replace(/_/g, ' ')}", ` +
      `with a completely different concrete example. Do not request another activity this turn.`
    );
  }
  return (
    `The learner has now missed this skill ${failures} times and different explanations were tried. ` +
    `Reassure them warmly that this one is genuinely tricky, and offer ONE adaptation via offerAdaptation ` +
    `(pick the one you judge most likely to help). Do not request another activity this turn.`
  );
}
