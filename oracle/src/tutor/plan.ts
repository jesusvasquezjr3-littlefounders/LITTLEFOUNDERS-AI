import { z } from 'zod';
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
  /**
   * How many ordinary turn-cycles have completed AFTER the plan already
   * reached its final step — i.e. `advance()` was called while `stepIndex`
   * was already `steps.length - 1`, so the call was a no-op for the step
   * pointer itself. Zero for the whole first pass through the final step;
   * every increment past that is a turn spent with the IDENTICAL "you are on
   * step N of N" guidance repeating, because nothing downstream was ever
   * told the arc was done.
   *
   * Found live, 2026-08-31 (AGENTS.md item 81): a direct drive of the real
   * orchestrator against the real model showed the badge-facing symptom
   * (`TutorOrchestrator.lessonThread` frozen at "step 3 of 3") accompanied
   * by a genuine content stall on a controller-dormant session — four
   * straight turns re-announcing the same never-delivered activity, never
   * varying, never once choosing `next: "close"`. `prompt.ts`'s
   * `buildContextMessage` reads this counter to add a one-time "the arc is
   * complete, wrap up" instruction once it is nonzero — see that file's own
   * comment for why it is gated on the v3 controller being dormant too.
   */
  finalStepRoundsCompleted: number;
  /** Consecutive failures per skill, this session. */
  failures: Map<string, number>;
  stuckSkillKey: string | null;
  stylesTried: Adaptation[];
  /**
   * Adaptation KINDS the learner has already been offered and DECLINED for
   * the current stuck skill (/ORACLE.md §11). Scoped and reset exactly like
   * `stylesTried` above — cleared the moment this skill is mastered
   * (`recordGrade`) — because it lives only in-memory on this session's plan
   * and never reaches the profile or any persisted store: §11's "declining is
   * not recorded as a fact about them" is about a permanent label, not about
   * remembering, for the length of one struggling episode, that the learner
   * already said no to this. A later, genuinely new struggle — this same
   * skill again after being fixed, or a different skill, or a whole new
   * session — starts with a clean slate.
   *
   * Found by adversarial review, round 67 (2026-08-30, MEDIUM): before this
   * field existed, a decline left zero trace anywhere — `ws/server.ts`'s own
   * comment on the decline branch was "local state only, no upstream call" —
   * so `stuckInstruction` re-issued the IDENTICAL free-choice offer
   * instruction on the very next failure of the same skill, and the model's
   * own transcript didn't even show a decline had happened (`orchestrator.ts`
   * only pushes learner-text and tutor-say turns into `history`, never an
   * `adaptation_response` of either polarity).
   */
  declinedAdaptations: Adaptation[];
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

/**
 * `faq`'s carrier field is a published FAQ id (Core's `FAQ_IDS`,
 * `backend/src/routes/tutor.ts`), not a title — Oracle has no access to the
 * frontend's i18n catalog where the learner-facing question text actually
 * lives, and the two services deploy independently. Found by adversarial
 * review, round 40 (2026-08-30, HIGH): before this map existed, the RAW id
 * (e.g. `why_prices_change`) fell straight through to `subject` below and
 * became the lesson's whole `objective` — the model was never told this is
 * a QUESTION, let alone which one, and had to guess a topic from a mangled
 * snake_case identifier. A readable English phrase here (the instructions
 * channel is English throughout this file; `say` is separately steered to
 * the session's own locale elsewhere in the prompt) replaces the guess with
 * the actual topic.
 */
const FAQ_TOPICS: Record<string, string> = {
  what_is_saving: 'what saving means',
  why_prices_change: 'why prices change',
  what_is_a_budget: 'what a budget is',
  how_does_a_loan_work: 'how a loan works',
};

/** Composed from OUR titles and the closed intent vocabulary — never learner text. */
export function buildPlan(
  intent: TutorIntent,
  courseContext: { courseTitle: string | null; topicTitle: string | null } | null,
  skillKey: string | null,
): LessonPlan {
  const subject =
    courseContext?.topicTitle ??
    courseContext?.courseTitle ??
    (intent === 'faq' && skillKey ? (FAQ_TOPICS[skillKey] ?? null) : skillKey) ??
    null;
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
    finalStepRoundsCompleted: 0,
    failures: new Map(),
    stuckSkillKey: null,
    stylesTried: [],
    declinedAdaptations: [],
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
      plan.declinedAdaptations = [];
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
  if (plan.stepIndex < plan.steps.length - 1) {
    plan.stepIndex += 1;
  } else {
    // Already on the last step — this call was a no-op for the pointer
    // itself. Counted so the model can eventually be told so; see the
    // field's own doc comment.
    plan.finalStepRoundsCompleted += 1;
  }
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

/**
 * The learner declined an offered adaptation — called from
 * `TutorOrchestrator.declineAdaptation`, the decline-side sibling of
 * `applyAdaptation` (both consume `lastOfferedAdaptation` there; this is only
 * the plan-side bookkeeping). See `LessonPlan.declinedAdaptations` for scope
 * and why this is safe under §11.
 */
export function recordDeclinedAdaptation(plan: LessonPlan, adaptation: Adaptation): void {
  if (!plan.declinedAdaptations.includes(adaptation)) plan.declinedAdaptations.push(adaptation);
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
    finalStepRoundsCompleted: Math.min(plan.finalStepRoundsCompleted, 10),
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
  /*
   * DECLINED ADAPTATIONS MUST NOT BE RE-OFFERED (/ORACLE.md §11, item found by
   * adversarial review, round 67, 2026-08-30). Without this, a learner who
   * declines "slower pacing" and then fails the same skill again was offered
   * "slower pacing" again, verbatim — thrashing, not adapting. This is a
   * prompt-level exclusion, the same enforcement style §11 already uses for
   * "the offer must stand alone in its turn" (not a deterministic gate on the
   * model's output) — deliberately, since `offerAdaptation` is a genuinely
   * free choice among the closed vocabulary and there is no wrong value to
   * reject the way there is for e.g. `stylesTried`'s deterministic rotation.
   */
  const declined = plan.declinedAdaptations;
  const offerable = ADAPTATIONS.filter((kind) => !declined.includes(kind));
  if (declined.length === 0) {
    return (
      `The learner has now missed this skill ${failures} times and different explanations were tried. ` +
      `Reassure them warmly that this one is genuinely tricky, and offer ONE adaptation via offerAdaptation ` +
      `(pick the one you judge most likely to help). Do not request another activity this turn.`
    );
  }
  const declinedList = declined.map((kind) => kind.replace(/_/g, ' ')).join(', ');
  if (offerable.length === 0) {
    return (
      `The learner has now missed this skill ${failures} times, different explanations were tried, and they ` +
      `already declined every adaptation available (${declinedList}). Do NOT offer another adaptation — ` +
      `reassure them warmly that this one is genuinely tricky and keep teaching directly, patiently, with a ` +
      `fresh concrete example. Do not request another activity this turn.`
    );
  }
  return (
    `The learner has now missed this skill ${failures} times and different explanations were tried. They already ` +
    `DECLINED this adaptation, so do NOT offer it again: ${declinedList}. Reassure them warmly that this one is ` +
    `genuinely tricky, and offer ONE DIFFERENT adaptation via offerAdaptation (pick the one you judge most likely ` +
    `to help, never one already declined). Do not request another activity this turn.`
  );
}

/*
 * ── THE PLAN'S HALF OF THE PARK SNAPSHOT ────────────────────────────────────
 *
 * A parked session can now be adopted by a DIFFERENT replica (`ws/parkStore.ts`),
 * which means everything a session's teaching depends on has to survive as
 * plain JSON. The plan is genuinely mutable state, not a derived value:
 * `recordGrade`, `advance`, `noteConversationTurn`, `nextStyle` and
 * `recordDeclinedAdaptation` all write to it during a lesson. Rebuilding it
 * with `buildPlan` on the far side would silently rewind a learner to step 1
 * with no failures recorded — which looks exactly like a fresh, healthy plan.
 *
 * So the snapshot carries the WHOLE plan, `objective` and `steps` included,
 * rather than re-deriving the deterministic parts. That is the /AGENTS.md
 * §1.14 "prefer a measurement that reads NOTHING above the thing being
 * measured" posture applied here: a restored plan is correct because it is a
 * copy, not because `buildPlan` happens to still be deterministic and happens
 * to still be fed identical inputs.
 */

export const PlanSnapshotSchema = z
  .object({
    objective: z.string(),
    steps: z.array(z.enum(PLAN_STEPS)),
    stepIndex: z.number().int().min(0),
    turnsOnStep: z.number().int().min(0),
    finalStepRoundsCompleted: z.number().int().min(0),
    /** A Map cannot be JSON; entry pairs are the honest wire shape for one. */
    failures: z.array(z.tuple([z.string(), z.number().int().min(0)])),
    stuckSkillKey: z.string().nullable(),
    stylesTried: z.array(z.enum(ADAPTATIONS)),
    declinedAdaptations: z.array(z.enum(ADAPTATIONS)),
  })
  .strict();

export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;

export function planSnapshot(plan: LessonPlan): PlanSnapshot {
  return {
    objective: plan.objective,
    steps: [...plan.steps],
    stepIndex: plan.stepIndex,
    turnsOnStep: plan.turnsOnStep,
    finalStepRoundsCompleted: plan.finalStepRoundsCompleted,
    failures: [...plan.failures.entries()],
    stuckSkillKey: plan.stuckSkillKey,
    stylesTried: [...plan.stylesTried],
    declinedAdaptations: [...plan.declinedAdaptations],
  };
}

export function planFromSnapshot(snapshot: PlanSnapshot): LessonPlan {
  return {
    objective: snapshot.objective,
    steps: [...snapshot.steps],
    stepIndex: snapshot.stepIndex,
    turnsOnStep: snapshot.turnsOnStep,
    finalStepRoundsCompleted: snapshot.finalStepRoundsCompleted,
    failures: new Map(snapshot.failures),
    stuckSkillKey: snapshot.stuckSkillKey,
    stylesTried: [...snapshot.stylesTried],
    declinedAdaptations: [...snapshot.declinedAdaptations],
  };
}
