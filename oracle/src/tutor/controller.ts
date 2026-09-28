import { z } from 'zod';
import { STRATEGIES } from '../context/schema.js';
import type { PedagogyState, Strategy } from '../context/schema.js';
import type { KcState, SessionPlanEntry } from '../core/client.js';

/*
 * ── THE CONTROLLER'S HALF OF THE PARK SNAPSHOT ──────────────────────────────
 *
 * A parked session can be adopted by a DIFFERENT replica (`ws/parkStore.ts`),
 * so every mutable field below has to survive as plain JSON and come back
 * IDENTICAL. This is the part /AGENTS.md §1.14 warns loudest about: a field
 * silently left out of the snapshot restores as its constructor default,
 * which looks like a perfectly healthy controller and is in fact a learner
 * whose struggle the tutor has just forgotten. `snapshot-fence.test.ts`
 * enumerates this class's real runtime fields and fails the moment one is
 * added without a decision recorded here, so omission is a broken build
 * rather than a quiet regression on somebody's reconnect.
 *
 * TWO fields are deliberately NOT in the snapshot, and both are constructor
 * arguments rather than session state: `plan` (the `SessionPlanEntry[]` Core
 * computed) and `kcStates`. They are rebuilt on the far side from the SAME
 * pinned `SessionContext` the snapshot already carries, so copying them here
 * would store the identical bytes twice and invite the two copies to disagree.
 */
const ControllerSnapshotSchema = z
  .object({
    entryIndex: z.number().int().min(0),
    pKnown: z.array(z.tuple([z.string(), z.number()])),
    strategy: z.enum(STRATEGIES),
    consecutiveFailures: z.number().int().min(0),
    lastDifficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    lastDifficultyFromContent: z.boolean(),
    misconceptionCode: z.string().nullable(),
    strategyChangesAt: z.array(z.number()),
    questioningWithoutProgress: z.number().int().min(0),
    rescuedSinceProgress: z.boolean(),
    opportunities: z.array(z.tuple([z.string(), z.number()])),
    correctLatencies: z.array(z.tuple([z.string(), z.array(z.number())])),
    guessedLastTurn: z.boolean(),
    probeReturnIndex: z.number().int().nullable(),
    probingKcId: z.string().nullable(),
    celebratedKcIds: z.array(z.string()),
    masteryRevokedKcIds: z.array(z.string()),
    /*
     * C.10: the corroborating-evidence chains. Defaulted rather than
     * required, like the orchestrator's `hintLadder`: a session parked by
     * the previous build has no chains and restores with empty ones, which
     * is the conservative direction — a fresh chain can only DELAY a
     * mastery or remediation decision by one observation, never fire one.
     */
    masteryEvidence: z.array(z.tuple([z.string(), z.number().int().min(0)])).default([]),
    /* GAP-FIX-R2: correct answers the chain set aside, per KC (defaulted: an older snapshot recorded none). */
    discountedCorrect: z.array(z.tuple([z.string(), z.boolean(), z.boolean()])).default([]),
    remediationEvidence: z
      .array(z.tuple([z.string(), z.string().nullable(), z.number().int().min(0)]))
      .default([]),
    /*
     * C.11: the in-session review detour (a spaced re-exposure of a plan KC
     * the within-session tier brought back). Defaulted: a session parked by
     * the previous build has no detour open, which is exactly its state.
     */
    inSessionReview: z
      .object({ entryIndex: z.number().int().min(0), turns: z.number().int().min(0) })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();

export { ControllerSnapshotSchema };
export type ControllerSnapshot = z.infer<typeof ControllerSnapshotSchema>;

/**
 * C.10 — HOW MANY CONSECUTIVE QUALIFYING OBSERVATIONS the controller needs
 * before it executes either of its two most consequential moves: declaring
 * a knowledge component mastered (CELEBRATE/TRANSFER), or triggering
 * remediation/rescue (REMEDIATE/RESCUE).
 *
 * Two is the SPEC's number ("a minimum of two consecutive observations",
 * Product C.10) and is marked there as PROPOSED, PENDING DATA-DRIVEN
 * VALIDATION: it is recorded in the Block C Threshold Recalibration Log
 * (`docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md`) and must be
 * recalibrated together with the compliance metric that watches it, never
 * separately. The operator can raise it, or roll individual knowledge
 * components back to the pre-C.10 single-observation baseline (Appendix F
 * Part 3 Stage 7, the Extended Mastery Engine kill switch), through
 * `ControllerOptions` — never lower the default in code.
 *
 * WHY THE RULE EXISTS (Appendix D §2.6): with the mirror's slip at 0.10 a
 * fully-mastered skill still misses one answer in ten, and with guess at
 * 0.20 a learner who does not know it hits one in five. A single response
 * is not evidence the controller may act on consequentially.
 */
export const CORROBORATION_MIN_OBSERVATIONS = 2;

/**
 * Below this pre-evidence belief a CORRECT answer is "surprising" — the
 * lucky-guess shape Appendix D §2.6 names. A surprising correct that also
 * arrived too fast to have been read (the same self-calibrated latency test
 * `answeredWithoutReading` uses) is not trusted as mastery evidence: it
 * neither extends nor breaks the chain (Wise 2017: a rapid guess is
 * non-effortful, not informative). Deliberately only the SURPRISING case: a
 * learner the controller already believes knows the skill is allowed to be
 * fast, or fluency itself would become a cage.
 */
const SURPRISING_CORRECT_BELOW = 0.5;

/** Operator configuration for the C.10 rule — see `CORROBORATION_MIN_OBSERVATIONS`. */
export interface ControllerOptions {
  /**
   * Integer in [2, 5]; out-of-range or non-integer values fall back to the
   * default. Never 1: a single observation is exactly what C.10 forbids, and
   * the per-KC rollback below is the only sanctioned way back to it.
   */
  corroborationMinObservations?: number;
  /**
   * `kcKey`s rolled back to the pre-C.10 single-observation baseline by the
   * Appendix F Stage 7 kill switch, until root-caused. Empty by default.
   */
  corroborationRollbackKcKeys?: readonly string[];
  /**
   * C.7: questioning turns without progress after which SOCRATIC/FLUENCY
   * degrade to FADED — 3 by default, lowered for a learner whose persistent
   * disposition profile shows early disengagement or an early "just tell
   * me" habit (`dispositionProfile.ts`). Integer in [1, 3]; anything else
   * falls back to 3.
   */
  stuckDegradeAfter?: number;
}

/**
 * The evidence behind a consequential decision, carried on the decision and
 * into the trajectory log so the Corroborating-Evidence Compliance Rate
 * (Appendix F §1.1) and the parent-facing explanation can read WHAT the
 * controller saw rather than only what it concluded (Appendix D §2.6:
 * "moved on after 2 correct responses" is auditable, "the AI decided" is
 * not). Null on every non-consequential decision, and on a turn where a
 * guardrail HELD the previous strategy instead of executing the proposal.
 */
export interface DecisionEvidence {
  rule: 'mastery' | 'remediation' | 'rescue';
  /** Consecutive qualifying observations the trigger rested on. */
  observations: number;
  /** The corroboration requirement in force for this KC at decision time. */
  required: number;
  /**
   * GAP-FIX-R2 (Appendix D §2.6, C.10): whether any correct answer on this KC
   * this session was NOT counted as evidence — too fast to have been read (a
   * surprising correct), or given with the hint ladder's help. Shown to the
   * parent beside the count ("a quick answer did not count"). Filled in by
   * `decide()` for every consequential decision; absent means not recorded.
   */
  discounted?: DiscountedEvidence;
}

/** Which correct answers the evidence chain set aside, as one closed label. */
export type DiscountedEvidence = 'none' | 'too_fast' | 'hint_assisted' | 'too_fast_and_hint_assisted';
export const DISCOUNTED_EVIDENCE = ['none', 'too_fast', 'hint_assisted', 'too_fast_and_hint_assisted'] as const;

/*
 * The v3 pedagogical controller (/ORACLE.md, Tutor v3; blueprint §9).
 *
 * NOT a prompt — a policy. It receives state (the session plan Core computed,
 * the local mastery mirror, the events the server witnessed) and emits a
 * STRATEGY CODE per turn; the conversational layer only performs the matching
 * template. If the differentiation lived in the prompt, there would be no
 * product — this file is where "the intelligence lives upstream of the LLM"
 * becomes code.
 *
 * Deterministic and side-effect-free by construction, like plan.ts: every
 * decision here must be explainable to a parent later ("why did my child get
 * a hint?"), which is why it is a rule engine and not a learned policy. When
 * a learned policy exists someday, these rules stay as the SHIELD: it
 * proposes, they veto.
 *
 * `plan.ts` remains the macro-phase spine (warmup → explain → practice …);
 * this controller decides HOW the current phase is taught. With no session
 * plan (v3 off, unseeded, cold learner) the controller reports null and the
 * whole pipeline behaves exactly as v2 — that dormancy is the deploy story.
 */

/** The local BKT mirror's fixed parameters — display-grade, Core's persisted
 * update is authoritative. Matching Core's seed defaults keeps the mirror
 * honest enough for band selection, which is all it is for. */
const MIRROR = { pT: 0.15, pG: 0.2, pS: 0.1 };

export function mirrorBktUpdate(pKnown: number, correct: boolean): number {
  const p = Math.min(1, Math.max(0, pKnown));
  let posterior: number;
  if (correct) {
    const num = p * (1 - MIRROR.pS);
    const den = num + (1 - p) * MIRROR.pG;
    posterior = den > 0 ? num / den : p;
  } else {
    const num = p * MIRROR.pS;
    const den = num + (1 - p) * (1 - MIRROR.pG);
    posterior = den > 0 ? num / den : p;
  }
  const learned = posterior + (1 - posterior) * MIRROR.pT;
  return Math.min(0.999, Math.max(0.001, learned));
}

/**
 * C.8/C.12: the predicted probability of a CORRECT answer from a mastery
 * belief — P(L)(1 − slip) + (1 − P(L))·guess, on the mirror's own
 * parameters. A miss is "surprising" (Appendix D §2.5) when this is high.
 */
export function predictedCorrectFrom(pKnown: number): number {
  const p = Math.min(1, Math.max(0, pKnown));
  return p * (1 - MIRROR.pS) + (1 - p) * MIRROR.pG;
}

export interface ControllerDecision {
  strategy: Strategy;
  scaffolding: 0 | 1 | 2 | 3;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** The extra system-side line the turn's prompt carries, or null. */
  instruction: string | null;
  /**
   * What the V4 skill selector needs to pick a maneuver (skills.ts): the
   * mastery estimate behind this decision and the diagnosed wrong idea, if
   * any. Exposed on the decision rather than read back out of the controller,
   * so selection sees exactly the state the decision was made on.
   */
  pKnown: number | null;
  misconceptionCode: string | null;
  /** How long the client should wait before a gentle nudge, per strategy. */
  idleNudgeMs: number;
  /**
   * How much silence, after the learner has actually spoken, means their turn
   * is over — the blueprint's §6.2 turn policy, per strategy.
   */
  listenSilenceMs: number;
  /** The knowledge component this decision was ABOUT (null when none was active). */
  kcId: string | null;
  /** C.10: what a consequential trigger rested on — see `DecisionEvidence`. */
  evidence: DecisionEvidence | null;
  /** C.10: this decision's evidence withdrew a mastery declared earlier this session. */
  masteryRevoked: boolean;
  /**
   * C.11: the belief about `kcId` BEFORE this event's evidence — what the
   * spaced-review router judges "close to the mastery threshold" against.
   * Null when no KC was active.
   */
  pKnownBefore: number | null;
  /**
   * C.11: this decision CLOSED an in-session review detour — answered
   * (correct or wrong), or abandoned after `REVIEW_OPEN_TURNS` learner turns
   * with no graded answer. Null on every other decision.
   */
  review: { kcId: string; objective: string; outcome: 'correct' | 'wrong' | 'abandoned' } | null;
}

/**
 * C.11: learner turns an opened in-session review may stay open without a
 * graded answer before the controller closes it (mirrors the router's
 * `reviewOpenTurns`; `npm run review-calibration:check` keeps them equal).
 */
export const REVIEW_OPEN_TURNS = 3;

export type PedagogyEvent =
  | {
      kind: 'activity_result';
      correct: boolean;
      misconceptionCode: string | null;
      attemptNumber: number;
      /**
       * How long the learner took, or null when nothing measured it.
       *
       * Null is not zero and must never be read as a fast answer: it means we
       * have no evidence about fluency, so fluency cannot be a reason to promote
       * or to hold.
       */
      latencyMs?: number | null;
      /**
       * C.10: the learner asked for (and received) hint-ladder help on this
       * item before answering. A scaffolded success is not independent
       * evidence of mastery (Appendix D §2.6's hint-request corroboration).
       */
      hintAssisted?: boolean;
    }
  | { kind: 'voice_result'; correct: boolean; misconceptionCode: string | null; hintAssisted?: boolean }
  | { kind: 'conversation_turn' }
  /**
   * The learner SAID a wrong idea, in words, outside any graded exercise
   * (`statedMisconception.ts` reads it deterministically from the utterance).
   *
   * DELIBERATELY NOT A FAILURE. It carries a code and nothing else: no
   * opportunity is counted, no belief is revised downward, no consecutive
   * failure is recorded. Saying "y ya, no sobra nada" is evidence about what
   * a child BELIEVES, not evidence that they got a question wrong — the
   * question was never asked. Treating it as a graded failure would drag
   * mastery down for talking, and two such sentences in a row would trip the
   * RESCUE guardrail into rescuing a child who is not struggling, merely
   * chatting.
   *
   * What it does buy is the one thing conversation could not reach before:
   * `REMEDIATE`, and with it the 21 repair moves that are fenced out of every
   * other path.
   */
  | { kind: 'stated_misconception'; misconceptionCode: string }
  | { kind: 'entry_opened' };

/** Guardrail: never raise difficulty after a failure; cap strategy churn. */
const MAX_STRATEGY_CHANGES_PER_MINUTE = 3;

/**
 * How many assessed opportunities a knowledge component needs before mastery
 * can be declared, however confident the posterior is.
 *
 * Three is the blueprint's own number for a diagnosis ("2-3 ítems de sondeo",
 * §640) and the conventional minimum in mastery learning. It is deliberately
 * small: this gates CELEBRATING and MOVING ON, not the teaching itself, and a
 * learner who genuinely knows something answers three questions quickly.
 */
export const MASTERY_MIN_OPPORTUNITIES = 3;

/**
 * How much slower than their own median a correct answer must be to read as
 * hesitant rather than fluent (blueprint §8.3).
 *
 * Two is wide on purpose. This guard HOLDS a promotion, and holding a fluent
 * learner back is a worse error than promoting a hesitant one a turn late.
 */
const HESITATION_FACTOR = 2;

/**
 * How much FASTER than their own median a wrong answer must be to read as a
 * guess rather than an attempt (blueprint §8.3).
 *
 * Three is deliberately conservative in the same direction as its sibling: the
 * cost of missing a guess is one wasted remediation, and the cost of calling a
 * real attempt a guess is telling a child who tried that they did not.
 */
const GUESS_FACTOR = 3;

/**
 * How many correct-latency measurements establish a KC's baseline pace,
 * after which the baseline FREEZES — no further correct answer, however
 * slow or fast, moves it again.
 *
 * Found by the pedagogy gym's "fragile hesitant" archetype, 2026-09-01: with
 * an unbounded, ever-growing history, a learner who answers correctly at a
 * CONSTANT slow pace eventually makes that pace itself the median, and
 * `latency > median * HESITATION_FACTOR` becomes `L > L * 2`, which is false
 * for every positive `L` — mathematically guaranteed for any constant-pace
 * run long enough, regardless of how extreme the original fast/slow gap
 * was. The identical shape, in the opposite direction, would eventually
 * understate `answeredWithoutReading`'s own guess threshold too, since both
 * read the same `correctLatencies` history.
 *
 * Three is the smallest number a median is more than a single point (two
 * measurements average two numbers; three has an actual middle) and matches
 * the gym archetype's own construction — three fast, confident answers
 * before the slow phase begins. Once frozen, a GENUINE, lasting change in
 * pace (a KC that got easier for real, a learner who matured) is read
 * through `targetDifficulty`/`pKnown` moving instead — which is what those
 * signals are for — rather than through silently moving the very yardstick
 * a symptom is measured against.
 */
const LATENCY_BASELINE_SIZE = 3;

/**
 * Every ordinary teaching strategy the no-progress counter watches.
 *
 * Originally just SOCRATIC and FLUENCY — "the strategies that ASK rather than
 * TEACH" — because a learner making no progress must not be left in one of
 * them, and fixing only SOCRATIC (the one the blueprint names) left the
 * identical defect in FLUENCY.
 *
 * Widened to include DIRECT, WORKED and FADED, found live, testing as a
 * struggling learner, 2026-08-30: answering "no sé" / "no entiendo"
 * repeatedly during DIRECT or WORKED — the bands a NEW or struggling learner
 * actually starts in, below the 0.65 mastery floor where SOCRATIC/FLUENCY
 * begin — produced a fresh worked example with new numbers every turn,
 * forever, because `conversation_turn` events never touch
 * `consecutiveFailures` (that field only moves on a graded `activity_result`
 * / `voice_result`) and this counter used to increment only for SOCRATIC/
 * FLUENCY. The top-of-file rationale already claimed "any turn spent asking
 * that did not produce a correct answer counts" — DIRECT and WORKED teach
 * rather than ask, but a learner stuck in them is exactly as stuck, and they
 * have no lower rung to degrade to the way SOCRATIC/FLUENCY degrade to FADED.
 * So they share the same counter, and `propose()`'s rule 1b spends it on
 * RESCUE instead — the response actually built for "frustrated, no progress".
 *
 * Widened again to include SPACED, found by adversarial review, round 22
 * (2026-08-30, HIGH): `baseStrategy` returns SPACED unconditionally for a
 * due review (`entry.reason === 'review_due'`), with no `stuck` check at
 * all — unlike the mastery-band branch just below it, which always checks
 * `stuck` before choosing between SOCRATIC/FLUENCY and FADED. A learner who
 * deflects a spaced-review question with ordinary chat ("no sé", "olvidé
 * eso") produces only `conversation_turn` events, never a graded
 * `activity_result`/`voice_result` — so `consecutiveFailures` never moves
 * (rule 1 can't fire) and, before this widening, `questioningWithoutProgress`
 * never moved either (rule 1b's counter was blind to SPACED). The controller
 * proposed SPACED forever, with no escalation path at all — the exact defect
 * this set already exists to close for DIRECT/WORKED/FADED, just for the one
 * strategy nobody had reason to type an example of yet.
 */
const NO_PROGRESS_TRACKED_STRATEGIES: ReadonlySet<Strategy> = new Set([
  'DIRECT',
  'WORKED',
  'FADED',
  'SOCRATIC',
  'FLUENCY',
  'SPACED',
]);

type Difficulty = 1 | 2 | 3 | 4 | 5;
const band = (n: number): Difficulty => Math.min(5, Math.max(1, Math.round(n))) as Difficulty;

export class PedagogicalController {
  private entryIndex = 0;
  /** Local mastery mirror per kcId — Core's persisted BKT is authoritative. */
  private readonly pKnown = new Map<string, number>();
  private strategy: Strategy;
  private consecutiveFailures = 0;
  private lastDifficulty: 1 | 2 | 3 | 4 | 5;
  /**
   * Whether `lastDifficulty`'s CURRENT value was set by a content-availability
   * substitution (`reconcileServedDifficulty`) rather than by `decide()`'s own
   * pedagogical judgment — the two legitimate reasons this field ever moves,
   * and `decide()`'s default case needs to tell them apart (added alongside
   * the fix below; see that fix's own comment for why one flag was not
   * enough on its own).
   *
   * A content substitution is the ladder doing its job on a topic that does
   * not cover every band — no opinion about the learner — so `decide()`'s
   * default case climbs back toward the PLAN's own target (this is what
   * `reconcileServedDifficulty`'s own comment already documents: "a reconcile
   * down to 1 does not pin a learner at 1"). A pedagogical adjustment (the
   * failure branch lowering it, most commonly) IS an opinion about the
   * learner and must persist until something changes it again — which is
   * exactly the case the flag being `false` protects.
   */
  private lastDifficultyFromContent = false;
  private misconceptionCode: string | null = null;
  private strategyChangesAt: number[] = [];
  /**
   * Consecutive turns spent ASKING that produced no correct answer.
   *
   * The blueprint's guardrail is a COUNT, not a band: three questions with no
   * progress means questions are not working, whatever the mastery estimate
   * says about them — which is why this counts every questioning strategy and
   * not only the one the blueprint happens to name.
   */
  private questioningWithoutProgress = 0;
  /**
   * Whether RESCUE has already fired since the learner last got something right.
   *
   * Rescue lowers the temperature of a session that is going badly. Firing it
   * repeatedly does not lower it further; it just replaces teaching with
   * reassurance, on a learner who by then needs the teaching.
   */
  private rescuedSinceProgress = false;
  /**
   * How many assessed opportunities this session has produced per KC, seeded
   * from the learner's persisted history.
   *
   * The blueprint's own schema carries `n_opportunities` beside the posterior
   * for a reason: a Bayesian belief says how confident we are, not how much we
   * have seen. Mastery needs both.
   */
  private opportunities = new Map<string, number>();
  /**
   * How long each CORRECT answer took, per KC — the §8.3 fluency signal.
   *
   * Kept per KC because pace is not comparable across skills: counting coins is
   * slower than recalling a fact, and a learner who is careful about one is not
   * struggling with the other.
   */
  private correctLatencies = new Map<string, number[]>();
  /** Whether the last assessed answer looked like a guess rather than an attempt. */
  private guessedLastTurn = false;
  /** Set while probing a prerequisite; holds the interrupted entry's index. */
  private probeReturnIndex: number | null = null;
  private probingKcId: string | null = null;
  /**
   * Every KC that has EVER earned a CELEBRATE, kept for the life of the
   * session — not a single boolean cleared on advance.
   *
   * Found live (adversarial review, 2026-08-29): a plain `celebrated`
   * boolean was set true and then reset to false in the SAME synchronous
   * call — `applyStrategy`'s CELEBRATE branch called `advanceEntry()`,
   * which unconditionally zeroed it — so `propose()`'s
   * `this.celebrated ? 'TRANSFER' : 'CELEBRATE'` could never observe
   * `true`. TRANSFER was dead code: reachable through no input sequence,
   * despite having its own skill file, its own turn-policy budgets, and
   * its own entry in `STRATEGY_INSTRUCTIONS`. Proven with a throwaway test
   * driving two KCs to mastery in one session: `['FLUENCY','FLUENCY',
   * 'CELEBRATE','FLUENCY','FLUENCY','CELEBRATE']` — TRANSFER never
   * appears.
   *
   * Keyed by kcId rather than replacing the boolean with a KC-scoped reset
   * on `advanceEntry` for a reason that matters: this KC is normally never
   * revisited after its entry is advanced past, so the ONLY turn TRANSFER
   * could ever fire on on is a LATER encounter of the SAME kcId — spaced
   * review (`SessionPlanEntry.reason === 'review_due'`) resurfacing an
   * already-mastered skill. That is also the pedagogically right moment
   * for "check it travels" (transfer-probe.md): not an artificial second
   * check before the plan is allowed to move on, which would risk stalling
   * `advanceEntry` — the ONLY place the plan pointer moves at all — on a
   * learner who never gets a second qualifying opportunity on this exact
   * entry before the session ends.
   */
  private readonly celebratedKcIds = new Set<string>();

  /**
   * Every KC whose mastery was DECLARED and then TAKEN BACK, because later
   * evidence contradicted it. Kept for the life of the session, alongside
   * `celebratedKcIds` rather than inside it, because the two answer different
   * questions: "have we ever celebrated this" (which is what makes TRANSFER
   * reachable) and "did that celebration survive contact with more evidence".
   *
   * WHY THIS EXISTS (owner decision, 2026-09-01). Until now mastery was
   * evaluated exactly ONCE, on whatever evidence existed at that moment, with
   * nothing anywhere in this codebase that revisited the decision if worse
   * evidence followed. The pedagogy gym's `fragile hesitant` archetype named
   * the consequence precisely: a learner is promoted on three fast, correct
   * answers, and a later run of slow-but-correct ones — the blueprint §8.3
   * signal for FRAGILE mastery, "correcto + latencia alta → no promover" —
   * had no way to reach the decision it should have changed.
   *
   * WHY IT REVOKES AFTERWARDS RATHER THAN WITHHOLDING UP FRONT. Withholding
   * would mean a second confirming check before `advanceEntry()` is allowed
   * to run, and `celebratedKcIds`'s own comment above already reasoned that
   * through and rejected it: `advanceEntry` is the ONLY place the plan
   * pointer moves, so gating it on a second qualifying opportunity risks a
   * learner who never gets one being stalled on the same entry until the
   * session ends. Revocation is strictly additive to the plan's forward
   * motion — it can never block it — so it buys the correction without
   * re-opening the stall this file already closed once.
   *
   * WHAT COUNTS AS CONTRADICTION, and why not simply "any wrong answer
   * ever": both halves are read from the SAME two signals the promotion
   * itself was judged on, so the bar to lose mastery is the bar to gain it,
   * read in reverse. Anything looser would make a single unlucky tap undo a
   * genuinely learned skill; anything tighter would leave §8.3 unenforced,
   * which is the gap this closes.
   */
  private readonly masteryRevokedKcIds = new Set<string>();

  /**
   * C.10 — the MASTERY chain: consecutive qualifying correct observations
   * per KC, this session. A qualifying correct is unassisted by the hint
   * ladder, not fragile (hesitant, before a revocation), and not a
   * surprising-and-rapid possible guess (neutral). Any graded miss or a
   * stated wrong idea breaks it; a hint-assisted or fragile correct resets
   * it. Mastery (rule 5) needs the chain at or above the requirement, on top
   * of every pre-existing bar (posterior, opportunity count, fluency).
   *
   * Session-scoped on purpose, unlike `opportunities`: "consecutive" is
   * about the evidence the controller is acting on NOW. Core's persisted
   * map applies the same rule across sessions from `kc_attempt`.
   */
  private readonly masteryEvidence = new Map<string, number>();

  /** GAP-FIX-R2: per KC this session, whether a correct answer was set aside as too fast / hint-assisted. */
  private readonly discountedCorrect = new Map<string, { fast: boolean; hint: boolean }>();

  private discountedFor(kcId: string): DiscountedEvidence {
    const seen = this.discountedCorrect.get(kcId);
    if (!seen || (!seen.fast && !seen.hint)) return 'none';
    return seen.fast && seen.hint ? 'too_fast_and_hint_assisted' : seen.fast ? 'too_fast' : 'hint_assisted';
  }

  /**
   * C.10 — the REMEDIATION chain: consecutive qualifying incorrect
   * observations per KC that AGREE on the diagnosis (the same catalogued
   * misconception code, or both undiagnosed). A graded miss that looked like
   * a guess is neutral — a guess is not a diagnosis; a stated wrong idea
   * counts as an observation of that idea; any graded correct clears it.
   * REMEDIATE — and the catalogued repair hint with it — is only reachable
   * once the chain meets the requirement, so no single response can open
   * the repair catalogue.
   */
  private readonly remediationEvidence = new Map<string, { code: string | null; count: number }>();

  /** Operator configuration (constructor-derived, never session state). */
  private readonly corroboration: { min: number; rollbackKcKeys: ReadonlySet<string> };
  /** C.7: the learner's disposition, read beside mastery (constructor-derived from the session context). */
  private readonly disposition: { stuckDegradeAfter: 1 | 2 | 3 };
  /**
   * C.11 — THE IN-SESSION REVIEW DETOUR. A spaced re-exposure of a plan KC
   * the within-session tier (`spacedReview.ts`) brought back after a short
   * gap. While it is open the active entry is that KC, served and graded as
   * a review (`reason: 'review_due'`, SPACED), and the plan pointer does NOT
   * move: the detour answers exactly one graded item and closes, whatever
   * the answer, so a re-check can never celebrate, advance or open a probe
   * (`decide`'s review branch). `turns` counts learner turns without a graded
   * answer; at `REVIEW_OPEN_TURNS` the detour is abandoned.
   */
  private inSessionReview: { entryIndex: number; turns: number } | null = null;

  constructor(
    private readonly plan: SessionPlanEntry[],
    /**
     * What this learner knows about EVERY knowledge component, not just the
     * ones in today's plan. Core has always sent it and nothing read it —
     * the same shape as `turnHistory`, which travelled sealed and validated
     * for months into a renderer that dropped it.
     *
     * It is what turns the backward walk into a DIAGNOSIS. Without it the
     * probe takes `prereqKcIds[0]`, the first prerequisite in array order,
     * which is a guess wearing the costume of one.
     */
    private readonly kcStates: readonly KcState[] = [],
    options: ControllerOptions = {},
  ) {
    const requested = options.corroborationMinObservations;
    this.corroboration = {
      min:
        typeof requested === 'number' && Number.isInteger(requested) && requested >= CORROBORATION_MIN_OBSERVATIONS && requested <= 5
          ? requested
          : CORROBORATION_MIN_OBSERVATIONS,
      rollbackKcKeys: new Set(options.corroborationRollbackKcKeys ?? []),
    };
    const degrade = options.stuckDegradeAfter;
    this.disposition = {
      stuckDegradeAfter:
        degrade === 1 || degrade === 2 || degrade === 3 ? degrade : 3,
    };
    for (const entry of plan) this.pKnown.set(entry.kcId, entry.pKnown);
    this.strategy = this.plan.length > 0 ? this.baseStrategy(this.plan[0]!) : 'DIRECT';
    this.lastDifficulty = band(this.plan[0]?.targetDifficulty ?? 2);
    /*
     * Seeded from the learner's persisted history, so a child returning to a KC
     * they have already been asked about three times is not made to re-earn the
     * evidence. The count is about how much we have SEEN of them, and previous
     * sessions are things we saw.
     */
    for (const state of this.kcStates) this.opportunities.set(state.kcId, state.attempts);
  }

  /** Every mutable field, as plain JSON — see this file's snapshot header. */
  snapshot(): ControllerSnapshot {
    return {
      entryIndex: this.entryIndex,
      pKnown: [...this.pKnown.entries()],
      strategy: this.strategy,
      consecutiveFailures: this.consecutiveFailures,
      lastDifficulty: this.lastDifficulty,
      lastDifficultyFromContent: this.lastDifficultyFromContent,
      misconceptionCode: this.misconceptionCode,
      strategyChangesAt: [...this.strategyChangesAt],
      questioningWithoutProgress: this.questioningWithoutProgress,
      rescuedSinceProgress: this.rescuedSinceProgress,
      opportunities: [...this.opportunities.entries()],
      correctLatencies: [...this.correctLatencies.entries()].map(([kcId, ms]) => [kcId, [...ms]]),
      guessedLastTurn: this.guessedLastTurn,
      probeReturnIndex: this.probeReturnIndex,
      probingKcId: this.probingKcId,
      celebratedKcIds: [...this.celebratedKcIds],
      masteryRevokedKcIds: [...this.masteryRevokedKcIds],
      masteryEvidence: [...this.masteryEvidence.entries()],
      discountedCorrect: [...this.discountedCorrect.entries()].map(([kcId, seen]) => [kcId, seen.fast, seen.hint]),
      remediationEvidence: [...this.remediationEvidence.entries()].map(([kcId, chain]) => [
        kcId,
        chain.code,
        chain.count,
      ]),
      inSessionReview: this.inSessionReview ? { ...this.inSessionReview } : null,
    };
  }

  /**
   * Overwrites EVERY mutable field from a snapshot — never merges.
   *
   * The constructor has already seeded `pKnown` and `opportunities` from the
   * plan and the KC states by the time this runs, and those seeds are exactly
   * what a resumed session must NOT keep: they are the values from the START
   * of the session, and the whole point of the snapshot is the evidence
   * gathered since. `clear()` before each replay rather than `set()` over the
   * top, so a key the learner's live run had removed cannot survive as the
   * constructor's stale copy of it.
   */
  restore(snapshot: ControllerSnapshot): void {
    this.entryIndex = snapshot.entryIndex;
    this.pKnown.clear();
    for (const [kcId, p] of snapshot.pKnown) this.pKnown.set(kcId, p);
    this.strategy = snapshot.strategy;
    this.consecutiveFailures = snapshot.consecutiveFailures;
    this.lastDifficulty = snapshot.lastDifficulty;
    this.lastDifficultyFromContent = snapshot.lastDifficultyFromContent;
    this.misconceptionCode = snapshot.misconceptionCode;
    this.strategyChangesAt = [...snapshot.strategyChangesAt];
    this.questioningWithoutProgress = snapshot.questioningWithoutProgress;
    this.rescuedSinceProgress = snapshot.rescuedSinceProgress;
    this.opportunities.clear();
    for (const [kcId, n] of snapshot.opportunities) this.opportunities.set(kcId, n);
    this.correctLatencies.clear();
    for (const [kcId, ms] of snapshot.correctLatencies) this.correctLatencies.set(kcId, [...ms]);
    this.guessedLastTurn = snapshot.guessedLastTurn;
    this.probeReturnIndex = snapshot.probeReturnIndex;
    this.probingKcId = snapshot.probingKcId;
    this.celebratedKcIds.clear();
    for (const kcId of snapshot.celebratedKcIds) this.celebratedKcIds.add(kcId);
    this.masteryRevokedKcIds.clear();
    for (const kcId of snapshot.masteryRevokedKcIds) this.masteryRevokedKcIds.add(kcId);
    this.masteryEvidence.clear();
    for (const [kcId, n] of snapshot.masteryEvidence) this.masteryEvidence.set(kcId, n);
    this.discountedCorrect.clear();
    for (const [kcId, fast, hint] of snapshot.discountedCorrect ?? []) this.discountedCorrect.set(kcId, { fast, hint });
    this.remediationEvidence.clear();
    for (const [kcId, code, count] of snapshot.remediationEvidence) {
      this.remediationEvidence.set(kcId, { code, count });
    }
    this.inSessionReview = snapshot.inSessionReview ? { ...snapshot.inSessionReview } : null;
  }

  /**
   * The C.10 requirement in force for one KC: the configured minimum, or the
   * pre-C.10 single-observation baseline for a KC the Stage 7 kill switch
   * rolled back.
   */
  private requiredObservationsFor(entry: SessionPlanEntry): number {
    return this.corroboration.rollbackKcKeys.has(entry.kcKey) ? 1 : this.corroboration.min;
  }

  /** The corroborated diagnosis for a KC, or null while it is still one observation. */
  private remediationChain(kcId: string): { code: string | null; count: number } {
    return this.remediationEvidence.get(kcId) ?? { code: null, count: 0 };
  }

  /** Extends (same diagnosis) or restarts (different diagnosis) a KC's remediation chain. */
  private observeWrongIdea(kcId: string, code: string | null): void {
    const prior = this.remediationEvidence.get(kcId);
    this.remediationEvidence.set(
      kcId,
      prior !== undefined && prior.code === code ? { code, count: prior.count + 1 } : { code, count: 1 },
    );
  }

  /** Whether the controller has anything to control. False = v2 behaviour. */
  get active(): boolean {
    // C.11: a review detour keeps the controller active even after the plan
    // completed — the re-check of a KC it already moved past is still its job.
    return this.plan.length > 0 && (this.entryIndex < this.plan.length || this.inSessionReview !== null);
  }

  get activeEntry(): SessionPlanEntry | null {
    if (!this.active) return null;
    if (this.probingKcId !== null) {
      // While probing, the "entry" is the prerequisite: evidence and segment
      // requests attach to IT, not to the interrupted KC.
      return this.probeEntry();
    }
    const review = this.reviewEntry();
    if (review) return review;
    return this.plan[this.entryIndex] ?? null;
  }

  /** C.11: the KC an open in-session review detour is re-checking, or null. */
  get inSessionReviewKcId(): string | null {
    return this.reviewEntry()?.kcId ?? null;
  }

  /** C.11: whether a knowledge component has a plan entry a review detour can bring back. */
  isPlannedKc(kcId: string): boolean {
    return this.plan.some((entry) => entry.kcId === kcId);
  }

  /** C.11: the objective text of a planned KC (our catalog), for the review instructions. */
  objectiveFor(kcId: string): string | null {
    return this.plan.find((entry) => entry.kcId === kcId)?.objective ?? null;
  }

  /**
   * C.11: opens an in-session review detour for a planned KC the
   * within-session tier says is due. Refused (false) while a probe is open,
   * while the controller is repairing (REMEDIATE / RESCUE / PROBE — a
   * re-check must never interrupt a repair), when a detour is already open,
   * when the KC is the one being taught right now (its ordinary attempts are
   * its re-exposures), or for a KC with no plan entry.
   *
   * Also refused while the strategy-change ceiling (3 per minute) is spent:
   * the Block C standard keeps that ceiling as the governing constraint, and
   * the new signals choose WHICH strategy runs within it, never add decision
   * velocity (S06.15 lane review). The KC stays due, so the detour opens on a
   * later turn once the ceiling allows it.
   */
  openInSessionReview(kcId: string, nowMs: number): boolean {
    if (this.plan.length === 0 || this.inSessionReview !== null || this.probingKcId !== null) return false;
    if (this.strategy === 'REMEDIATE' || this.strategy === 'RESCUE' || this.strategy === 'PROBE') return false;
    const index = this.plan.findIndex((entry) => entry.kcId === kcId);
    if (index < 0) return false;
    if (this.entryIndex < this.plan.length && this.plan[this.entryIndex]?.kcId === kcId) return false;
    if (this.strategy !== 'SPACED' && this.strategyCeilingReached(nowMs)) return false;
    this.inSessionReview = { entryIndex: index, turns: 0 };
    if (this.strategy !== 'SPACED') this.strategyChangesAt.push(nowMs);
    this.strategy = 'SPACED';
    return true;
  }

  /** C.11: the review detour's synthetic entry — the plan KC, served as a review. */
  private reviewEntry(): SessionPlanEntry | null {
    if (this.inSessionReview === null) return null;
    const planned = this.plan[this.inSessionReview.entryIndex];
    if (!planned) return null;
    return { ...planned, reason: 'review_due' };
  }

  get currentStrategy(): Strategy {
    return this.strategy;
  }

  /** The difficulty band the next activity should carry. */
  get targetDifficulty(): 1 | 2 | 3 | 4 | 5 {
    // C.11: a re-check is served at the reviewed KC's own planned band; the
    // main entry's ratchet is not the reviewed KC's and is left untouched.
    const review = this.probingKcId === null ? this.reviewEntry() : null;
    if (review) return band(review.targetDifficulty);
    return this.lastDifficulty;
  }

  /**
   * Correct the ratchet to the band that ACTUALLY reached the screen.
   *
   * `lastDifficulty` is this controller's memory of where the learner
   * currently is, and every adjustment in `decide()` is made RELATIVE to it —
   * "never raise after a failure" lowers from it, the mastery branch raises
   * from it. Core's content ladder, though, answers a request for a band with
   * the NEAREST segment it has, and its prerequisite and frontier fallbacks
   * reach into a different topic entirely: asking for band 4 and being handed
   * band 2 is ordinary, correct behaviour there. Without this, the ratchet
   * kept adjusting from its own guess rather than from the thing the child was
   * actually looking at, and the gap survived for the rest of the session.
   * Found by adversarial review, round 59, deferred; fixed round 74
   * (2026-08-30, MEDIUM).
   *
   * It corrects the MEMORY, not the plan. `decide()` re-bases on
   * `entry.targetDifficulty` every turn, so a reconcile down to 1 does not pin
   * a learner at 1 — it only stops the next relative adjustment being computed
   * from a band nobody was ever shown.
   *
   * Silent for a substitution of one band: that is the ladder doing its job on
   * a topic whose segments simply do not cover every band, and a line per
   * occurrence would be noise that teaches people to skip the line. TWO or
   * more bands apart is a different claim — the ladder had nothing anywhere
   * near this learner's level — so that one is logged, in the same spirit as
   * the fallback rungs' own `console.warn`s in `backend/src/routes/tutor.ts`.
   */
  reconcileServedDifficulty(served: number | null | undefined): void {
    // While the brain is off, the request never came from this ratchet in the
    // first place (`ws/server.ts` sends the model's own asked-for band), so
    // the served value says nothing about a number nothing reads.
    if (!this.active) return;
    // C.11: a re-check's band is the reviewed KC's, not the main ratchet's.
    if (this.inSessionReview !== null && this.probingKcId === null) return;
    // `null` is "the segment declared no difficulty" — a real answer, and not
    // one that licenses moving the ratchet anywhere (§1.14).
    if (typeof served !== 'number' || !Number.isInteger(served) || served < 1 || served > 5) return;
    const requested = this.lastDifficulty;
    if (served === requested) return;
    if (Math.abs(served - requested) >= 2) {
      console.warn(
        `[oracle] the ladder served difficulty ${served} for a request at ${requested} — a content gap at this learner's level`,
      );
    }
    this.lastDifficulty = band(served);
    // See `lastDifficultyFromContent`'s own comment: this correction is a
    // content-availability fact, not a pedagogical one, and `decide()`'s
    // default case needs to know that to climb back toward the plan's own
    // target rather than holding here indefinitely.
    this.lastDifficultyFromContent = true;
  }

  /** The content-pool bridge for the active KC, when the catalog mapped one. */
  get activeSkillKey(): string | null {
    return this.activeEntry?.skillKey ?? null;
  }

  /**
   * Where the learner is in THIS session's knowledge-component plan,
   * 1-based — the unit `TutorOrchestrator.lessonThread` (the HUD's "step X
   * of Y" badge) counts by while this controller is steering, instead of
   * `plan.ts`'s own fixed macro-phase arc (warmup/explain/practice/…),
   * which has no idea a knowledge component ever changed.
   *
   * Found live, 2026-08-31 (AGENTS.md item 81): a direct drive of the real
   * orchestrator showed `activeKcId` change to a brand-new knowledge
   * component on a CELEBRATE — genuine teaching progress — in the very same
   * turn `plan.ts`'s own step counter happened to cap out, and the badge
   * never moved again for the rest of the session even though this
   * controller went on to teach something entirely new. Null while dormant
   * (see `active`), which is exactly when `lessonThread` falls back to the
   * macro-phase arc instead — the only teaching unit left to describe once
   * there is no session plan, or once every planned KC has already been
   * mastered (`active` and this getter turn false together: `advanceEntry`
   * moving `entryIndex` to `plan.length` is what ends both).
   */
  get kcProgress(): { index: number; of: number } | null {
    if (!this.active) return null;
    return { index: this.entryIndex + 1, of: this.plan.length };
  }

  /** The kcId a served activity should be stamped with right now. */
  /**
   * C.8/C.12: the predicted probability that the learner answers the ACTIVE
   * knowledge component correctly, read from the local mastery mirror BEFORE
   * the next piece of evidence is applied (the belief the answer is judged
   * against). Null while the controller is dormant.
   */
  predictedCorrect(): number | null {
    const entry = this.activeEntry;
    if (!entry) return null;
    return predictedCorrectFrom(this.pKnown.get(entry.kcId) ?? entry.pKnown);
  }

  get activeKcId(): string | null {
    return this.activeEntry?.kcId ?? null;
  }

  /**
   * KCs whose declared mastery was withdrawn again this session, because
   * later evidence contradicted it (see `masteryRevokedKcIds`).
   *
   * Exposed as a copy rather than the live Set: this is read by the pedagogy
   * gym and by tests as an OBSERVATION of what the controller concluded, and
   * handing out the internal Set would let a reader mutate the decision it
   * came to ask about — the same shared-mutable-state hazard AGENTS.md §1.14
   * records twice for 3D scene objects, in a much smaller place.
   */
  get revokedMasteryKcIds(): readonly string[] {
    return [...this.masteryRevokedKcIds];
  }

  private probeEntry(): SessionPlanEntry | null {
    const interrupted = this.plan[this.probeReturnIndex ?? 0];
    if (!interrupted || this.probingKcId === null) return null;
    // A synthetic entry for the prerequisite: gentler difficulty, no plan
    // metadata of its own (Core did not plan it — the failure did).
    return {
      kcId: this.probingKcId,
      kcKey: `${interrupted.kcKey}#prereq`,
      skillKey: interrupted.skillKey,
      reason: 'frontier',
      pKnown: this.pKnown.get(this.probingKcId) ?? 0.5,
      targetDifficulty: 1,
      objective: interrupted.objective,
      prereqKcIds: [],
      misconceptions: [],
    };
  }

  private baseStrategy(entry: SessionPlanEntry): Strategy {
    if (entry.reason === 'review_due') return 'SPACED';
    const p = this.pKnown.get(entry.kcId) ?? entry.pKnown;
    if (p < 0.3) return 'DIRECT';
    if (p < 0.5) return 'WORKED';
    if (p < 0.65) return 'FADED';
    /*
     * "NEVER MORE THAN 3 SOCRATIC WITHOUT PROGRESS → DEGRADE TO FADED"
     * (blueprint §9.2), applied to the CLASS rather than to the one strategy it
     * names.
     *
     * The band alone decided this before, so a learner who kept getting nowhere
     * stayed in whichever questioning strategy their mastery implied,
     * indefinitely. The blueprint names SOCRATIC, and fixing only SOCRATIC left
     * the identical defect one band up: a learner who had mastered something and
     * then went quiet was given FLUENCY — timed drills — seven turns running,
     * after six answers of "no sé". Same failure, different label, and it was
     * caught by the sequence gate the moment the Socratic half was fixed.
     *
     * RESCUE covers the EMOTIONAL version of this at two consecutive failures,
     * and it is not the same rule: rescue lowers the temperature and hands the
     * learner straight back to the band. This one changes the TEACHING — a faded
     * example gives them the shape of the answer and asks for the last step.
     */
    // C.7: the learner's disposition lowers this for an early disengager or
    // an early "just tell me" asker (3 by default; see ControllerOptions).
    const stuck = this.questioningWithoutProgress >= this.disposition.stuckDegradeAfter;
    if (p < 0.85) return stuck ? 'FADED' : 'SOCRATIC';
    return stuck ? 'FADED' : 'FLUENCY';
  }

  private scaffoldingFor(strategy: Strategy): 0 | 1 | 2 | 3 {
    switch (strategy) {
      case 'DIRECT':
      case 'WORKED':
      case 'RESCUE':
      case 'REMEDIATE':
        return 3;
      case 'FADED':
      case 'PROBE':
        return 2;
      case 'SOCRATIC':
      case 'ELABORATE':
      case 'SPACED':
        return 1;
      default:
        return 0;
    }
  }

  /**
   * The one decision function. Applies the event, selects a strategy, runs
   * the guardrails, and returns what this turn should do.
   */
  decide(event: PedagogyEvent, nowMs: number): ControllerDecision {
    /*
     * C.11: an open review detour that the learner talks past instead of
     * answering is abandoned after `REVIEW_OPEN_TURNS` learner turns — the
     * re-check is not pushed at a learner who is not doing it; the router
     * hands the KC to the cross-session scheduler instead.
     */
    let closedReview: ControllerDecision['review'] = null;
    if (
      this.inSessionReview !== null &&
      this.probingKcId === null &&
      (event.kind === 'conversation_turn' || event.kind === 'stated_misconception')
    ) {
      this.inSessionReview.turns += 1;
      if (this.inSessionReview.turns >= REVIEW_OPEN_TURNS) {
        const reviewed = this.reviewEntry();
        this.inSessionReview = null;
        if (reviewed) closedReview = { kcId: reviewed.kcId, objective: reviewed.objective, outcome: 'abandoned' };
        const main = this.plan[this.entryIndex];
        if (main) {
          // Leaving the detour is a strategy change too, and counts against the ceiling.
          const back = this.baseStrategy(main);
          if (back !== this.strategy) this.strategyChangesAt.push(nowMs);
          this.strategy = back;
        }
      }
    }

    const entry = this.activeEntry;
    if (!entry) {
      return {
        strategy: 'CELEBRATE',
        scaffolding: 0,
        difficulty: this.lastDifficulty,
        instruction: null,
        pKnown: null,
        misconceptionCode: null,
        idleNudgeMs: IDLE_NUDGE_MS.CELEBRATE,
        listenSilenceMs: LISTEN_SILENCE_MS.CELEBRATE,
        kcId: null,
        evidence: null,
        masteryRevoked: false,
        pKnownBefore: null,
        review: closedReview,
      };
    }
    const reviewing = this.inSessionReview !== null && this.probingKcId === null;

    const required = this.requiredObservationsFor(entry);
    let masteryRevoked = false;
    let failedNow = false;
    /** Whether this turn produced a correct answer — the definition of progress. */
    const assessedCorrect =
      (event.kind === 'activity_result' || event.kind === 'voice_result') && event.correct;
    // "Unexpected failure" is judged against what we believed BEFORE the
    // evidence — the update itself drags the posterior down, and a probe
    // decision made on the post-update number would never fire.
    const pBefore = this.pKnown.get(entry.kcId) ?? entry.pKnown;
    if (event.kind === 'activity_result' || event.kind === 'voice_result') {
      const kcId = entry.kcId;
      // Read BEFORE this event can revoke anything below: the fragile-answer
      // test in the C.10 chain must judge this answer by the state it was
      // given in, or the revocation it causes would excuse it.
      const revokedBefore = this.masteryRevokedKcIds.has(kcId);
      this.opportunities.set(kcId, (this.opportunities.get(kcId) ?? 0) + 1);
      if (event.correct && event.kind === 'activity_result') {
        const latency = event.latencyMs;
        if (latency !== null && latency !== undefined) {
          // Only correct answers set the pace. A wrong answer's timing measures
          // confusion, not fluency, and mixing them makes every learner look
          // slow exactly when they are struggling.
          const priorLatencies = this.correctLatencies.get(kcId) ?? [];
          // FROZEN once the baseline is established — see
          // `LATENCY_BASELINE_SIZE`'s own comment for why a still-growing
          // history can defeat the exact signals it exists to compute.
          if (priorLatencies.length < LATENCY_BASELINE_SIZE) {
            this.correctLatencies.set(kcId, [...priorLatencies, latency]);
          }
        }
      }
      this.pKnown.set(kcId, mirrorBktUpdate(this.pKnown.get(kcId) ?? entry.pKnown, event.correct));

      /*
       * MASTERY IS RECONSIDERED, NOT DECLARED ONCE (owner decision,
       * 2026-09-01 — see `masteryRevokedKcIds` for the full reasoning).
       *
       * Reached on a LATER encounter of a KC this session already
       * celebrated — in practice a spaced-review entry
       * (`reason === 'review_due'`), which is the same re-encounter that
       * makes TRANSFER reachable at all. Placed HERE, in the evidence
       * handler, rather than beside rule 5's promotion test, because the
       * two are different acts: rule 5 decides what to SAY this turn,
       * while this decides what the session still BELIEVES. Putting it in
       * the strategy path would have tied revocation to whichever strategy
       * happened to win, which is how the promotion got evaluated exactly
       * once in the first place.
       *
       * The two contradiction signals are the same two rule 5 requires to
       * promote — `event.correct` and `answeredHesitantly` — so mastery is
       * lost on exactly the evidence that would have prevented it. A
       * hesitant answer counts precisely BECAUSE it is correct: a learner
       * who still gets there, but now takes more than twice their own
       * established pace, is the fragile-mastery case §8.3 names, and it is
       * invisible to any check that only watches for wrong answers.
       */
      /*
       * ONCE PER KC PER SESSION — `!masteryRevokedKcIds.has(kcId)` is
       * load-bearing, not defensive. Without it this block re-fires on every
       * subsequent contradicting turn, and because it runs BEFORE the strategy
       * is chosen, each firing pins the opportunity count back to one below
       * the floor that the same turn's increment had just restored. The count
       * can then never reach `MASTERY_MIN_OPPORTUNITIES` at decision time
       * again, and rule 5's bypass below never gets the chance to fire.
       *
       * Observed, not reasoned: the gym printed `CELEBRATE` then SPACED
       * thirteen times with the plan never completing, and printed it
       * IDENTICALLY before and after the rule 5 bypass was added — which is
       * what exposed that the bypass was unreachable rather than wrong.
       */
      if (this.celebratedKcIds.has(kcId) && !this.masteryRevokedKcIds.has(kcId)) {
        const contradicted = !event.correct || this.answeredHesitantly(kcId, event);
        if (contradicted) {
          /*
           * `celebratedKcIds` is deliberately NOT cleared here. It answers
           * "has this KC ever been celebrated", which is what makes TRANSFER
           * reachable at all (see its own comment); clearing it would conflate
           * that with "do we still believe it" and quietly kill TRANSFER for
           * every KC that was ever revoked — a second dead strategy, which is
           * the exact defect that comment was written about. The BELIEF lives
           * in the opportunity count below; the HISTORY stays where it was.
           */
          this.masteryRevokedKcIds.add(kcId);
          masteryRevoked = true;
          /*
           * Dropped just below the floor, never to zero: the earlier
           * opportunities genuinely happened and this learner is not made to
           * start from nothing. What is withdrawn is only the SUFFICIENCY of
           * that evidence — one more qualifying, unhesitant correct answer
           * re-earns the promotion, and a second contradiction takes it away
           * again. `Math.min` because a persisted-attempt seed (constructor)
           * can legitimately sit far above the floor, and this must lower the
           * count rather than silently raise it.
           */
          this.opportunities.set(
            kcId,
            Math.min(this.opportunities.get(kcId) ?? 0, MASTERY_MIN_OPPORTUNITIES - 1),
          );
        }
      }
      /*
       * A GUESS IS NOT A DIAGNOSIS. Our distractors are authored to encode
       * misconceptions, so a random tap produces a confident wrong-idea code;
       * accepting it makes the tutor argue against something the child never
       * thought. Dropping it lets the turn be about re-engaging them instead.
       */
      this.guessedLastTurn = this.answeredWithoutReading(kcId, event);

      /*
       * C.10 — THE CORROBORATING-EVIDENCE CHAINS (see `masteryEvidence` and
       * `remediationEvidence` for the full qualifying rules). Updated here,
       * in the evidence handler, for the same reason revocation is: this is
       * what the session BELIEVES, independent of which strategy wins.
       */
      if (event.correct) {
        const assisted = event.hintAssisted === true;
        const fragile = this.answeredHesitantly(kcId, event) && !revokedBefore;
        const possibleGuess = pBefore < SURPRISING_CORRECT_BELOW && this.answeredTooFastToRead(kcId, event);
        if (assisted || fragile) this.masteryEvidence.set(kcId, 0);
        else if (!possibleGuess) this.masteryEvidence.set(kcId, (this.masteryEvidence.get(kcId) ?? 0) + 1);
        if (assisted || possibleGuess) {
          const seen = this.discountedCorrect.get(kcId) ?? { fast: false, hint: false };
          this.discountedCorrect.set(kcId, { fast: seen.fast || (possibleGuess && !assisted), hint: seen.hint || assisted });
        }
        this.remediationEvidence.delete(kcId);
      } else {
        this.masteryEvidence.set(kcId, 0);
        if (!this.guessedLastTurn) this.observeWrongIdea(kcId, event.misconceptionCode);
      }

      /*
       * A DIAGNOSIS IS ACTED ON ONLY ONCE IT IS CORROBORATED (C.10). Before,
       * the code of a single wrong answer went straight into
       * `misconceptionCode` — REMEDIATE, the catalogued hint in the model's
       * context and the whole repair catalogue — off one response that a
       * slip produces one time in ten. The code is now held in the chain
       * and surfaces only when two consecutive observations agree on it.
       * A guess still clears it outright, exactly as before.
       */
      const chain = this.remediationChain(kcId);
      this.misconceptionCode =
        this.guessedLastTurn || event.correct || event.misconceptionCode === null
          ? null
          : chain.code === event.misconceptionCode && chain.count >= required
            ? event.misconceptionCode
            : null;
      if (event.correct) {
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures += 1;
        failedNow = true;
      }
    }

    /*
     * A STATED wrong idea sets the code and nothing else — see the event's
     * own doc comment for why it must not touch `consecutiveFailures`,
     * `opportunities` or the posterior. `statedRemediation` is what lets
     * `propose` reach REMEDIATE without the failure that rule normally
     * requires; it is scoped to this turn only, so a belief stated once does
     * not hold the tutor in repair mode afterwards.
     */
    let statedRemediation = false;
    if (event.kind === 'stated_misconception') {
      /*
       * C.10: a stated belief is an OBSERVATION of that belief — it breaks
       * the mastery chain and extends the remediation chain — but it opens
       * REMEDIATE only once corroborated: the same idea stated twice, or a
       * graded miss carrying the same code next to it. One sentence is one
       * observation, however committed it sounds.
       */
      this.masteryEvidence.set(entry.kcId, 0);
      this.observeWrongIdea(entry.kcId, event.misconceptionCode);
      this.guessedLastTurn = false;
      if (this.remediationChain(entry.kcId).count >= required) {
        this.misconceptionCode = event.misconceptionCode;
        statedRemediation = true;
      }
    }

    /*
     * THE STREAK COUNTS TURNS THAT WENT NOWHERE, NOT WRONG ANSWERS.
     *
     * A first version counted only failed results, and measuring it showed the
     * threshold was unreachable: two consecutive wrong answers trigger RESCUE
     * before a third can land, and any correct answer resets the count. It was
     * dead code that read like a guardrail.
     *
     * "Sin progreso" is the broader thing, and it is the shape the owner's own
     * transcripts show: a learner answering "no sé" produces a
     * `conversation_turn`, which is not a failure, so `consecutiveFailures`
     * never grows, RESCUE never fires, and the Socratic questions continue
     * indefinitely. Nothing in the controller could see that, because nothing
     * was counting the turns where NOTHING HAPPENED.
     *
     * So: any turn spent asking that did not produce a correct answer counts,
     * and a correct answer resets it. `this.strategy` is the strategy that was in
     * force during the turn being judged, not the one about to be chosen.
     * `entry_opened` is excluded — it is the controller opening a KC, not the
     * learner spending a turn.
     */
    if (assessedCorrect) {
      this.questioningWithoutProgress = 0;
      // Progress re-arms rescue: the next slump gets the same support this one
      // did, rather than being permanently denied it by an earlier bad patch.
      this.rescuedSinceProgress = false;
    } else if (NO_PROGRESS_TRACKED_STRATEGIES.has(this.strategy) && event.kind !== 'entry_opened') {
      this.questioningWithoutProgress += 1;
    }

    /*
     * C.11 — THE REVIEW DETOUR ANSWERS EXACTLY ONE GRADED ITEM. The evidence
     * above already landed on the reviewed KC (its belief, its chains, and —
     * for a KC celebrated earlier this session — the C.10 revocation, which
     * makes a failed re-check the Khan-style demotion Appendix D §2.3 asks
     * for). What it must never do is what the plan rules would do next:
     * celebrate and ADVANCE the plan pointer, or open a probe from a KC the
     * session already moved past. So the detour closes here, whatever the
     * answer: RESCUE still wins (two consecutive misses), otherwise a correct
     * re-check gets a short FLUENCY beat and a wrong one a single WORKED
     * example — never a drill; the router decides whether it comes back.
     */
    if (reviewing && (event.kind === 'activity_result' || event.kind === 'voice_result')) {
      const rescueFailures = Math.max(2, required);
      const rescue = this.consecutiveFailures >= rescueFailures && !this.rescuedSinceProgress;
      const proposed: Strategy = rescue ? 'RESCUE' : event.correct ? 'FLUENCY' : 'WORKED';
      const strategy = this.enforceGuardrails(proposed, nowMs);
      this.inSessionReview = null;
      this.applyStrategy(strategy, nowMs);
      const instruction = this.instructionFor(strategy, entry);
      // The reviewed KC's diagnosis does not follow the learner back to the main entry.
      this.misconceptionCode = null;
      this.lastDifficultyFromContent = false;
      return {
        strategy,
        scaffolding: this.scaffoldingFor(strategy),
        difficulty: this.lastDifficulty,
        instruction,
        pKnown: this.pKnown.get(entry.kcId) ?? entry.pKnown,
        misconceptionCode: null,
        idleNudgeMs: IDLE_NUDGE_MS[strategy],
        listenSilenceMs: listenSilenceMsFor(strategy, this.opportunities.get(entry.kcId) ?? 0),
        kcId: entry.kcId,
        evidence:
          strategy === 'RESCUE' && proposed === 'RESCUE'
            ? { rule: 'rescue', observations: this.consecutiveFailures, required, discounted: this.discountedFor(entry.kcId) }
            : null,
        masteryRevoked,
        pKnownBefore: pBefore,
        review: { kcId: entry.kcId, objective: entry.objective, outcome: event.correct ? 'correct' : 'wrong' },
      };
    }

    const proposal = this.propose(event, entry, failedNow, pBefore, statedRemediation, required);
    const strategy = this.enforceGuardrails(proposal.strategy, nowMs);
    // A guardrail that HELD the previous strategy did not execute the
    // proposal, so the proposal's evidence describes nothing that happened.
    const executed = strategy === proposal.strategy;
    this.applyStrategy(strategy, nowMs);
    /*
     * C.10: a correct probe whose original KC has NOT yet corroborated a
     * remediation returns to that KC's ordinary teaching (rule 4) rather
     * than remediating it on the one miss that opened the probe. The probe
     * has answered its question either way, so it closes here — the same
     * close `applyStrategy` performs on the REMEDIATE path.
     */
    if (executed && proposal.closeProbe && this.probingKcId !== null) {
      this.probingKcId = null;
      this.probeReturnIndex = null;
    }

    const p = this.pKnown.get(entry.kcId) ?? entry.pKnown;
    /*
     * `this.lastDifficulty`, NOT `entry.targetDifficulty` — found by the
     * pedagogy gym's "steady improver" archetype, 2026-09-01 (see
     * `pedagogyGym.ts`'s own comment on that archetype for the full
     * mechanism). Every OTHER line in this function treats `lastDifficulty`
     * as "this controller's memory of where the learner currently is" (see
     * that field's own doc comment above) and adjusts RELATIVE to it — this
     * default was the one place that instead reset to the KC's AUTHORED
     * target, so a turn that was neither a fresh failure/support-strategy
     * NOR high-mastery silently undid however far the failure branch had
     * just lowered difficulty. Two wrong answers correctly held difficulty
     * down; the very next correct one — still well short of the mastery
     * bar to justify raising it — visibly jumped it back up, one turn late,
     * to the identical effect the failure branch's own comment says never
     * to have: "never raise difficulty after a failure." `this.lastDifficulty`
     * is already correctly seeded to the KC's target the moment a KC is
     * entered (both at construction and wherever `lastDifficulty` is reset
     * on a KC change), so this is a no-op on a genuinely fresh KC and only
     * changes behavior once an adaptive move has actually happened.
     *
     * ONE EXCEPTION, and it needed a second flag rather than reading as a
     * blanket rule: `reconcileServedDifficulty`'s own comment already
     * documents, correctly, that a content-ladder substitution ("asked for
     * band 4, the topic only has band 1-2 content") must NOT pin a learner
     * at the substituted band forever — that correction is about content
     * AVAILABILITY, not the learner's ability, and the existing test
     * "does not pin the learner: the plan's own target still drives the
     * next turn" exists specifically to protect it. `lastDifficultyFromContent`
     * (set by that method, cleared below) is what lets this default case
     * tell the two apart: climb back to the plan's own target when the
     * last move was a content fact, hold in place when it was a pedagogical
     * one.
     */
    let difficulty = this.lastDifficultyFromContent ? band(entry.targetDifficulty) : this.lastDifficulty;
    /*
     * A probe closed by C.10's rule 4 (back to ordinary teaching instead of
     * REMEDIATE) holds difficulty exactly as the REMEDIATE it replaces did:
     * the learner's last answer on the ORIGINAL KC was a miss, and "never
     * raise difficulty after a failure" does not lapse because the next turn
     * happened to be about a prerequisite.
     */
    const probeClosedWithoutRemediation = executed && proposal.closeProbe;
    if (
      failedNow ||
      probeClosedWithoutRemediation ||
      strategy === 'RESCUE' ||
      strategy === 'REMEDIATE' ||
      strategy === 'PROBE'
    ) {
      // Never raise difficulty after a failure — only hold or lower.
      difficulty = band(Math.min(difficulty, Math.max(1, this.lastDifficulty - (failedNow ? 1 : 0))));
    } else if (p >= 0.85 && strategy !== 'CELEBRATE') {
      difficulty = band(this.lastDifficulty + 1);
    }
    this.lastDifficulty = difficulty;
    // Whatever this call decided, it is now the authoritative "why" behind
    // `lastDifficulty` — a content fact from before this turn must not keep
    // pinning a decision this function has already made fresh.
    this.lastDifficultyFromContent = false;

    return {
      strategy,
      scaffolding: this.scaffoldingFor(strategy),
      difficulty,
      instruction: this.instructionFor(strategy, entry),
      pKnown: p,
      misconceptionCode: this.misconceptionCode,
      idleNudgeMs: IDLE_NUDGE_MS[strategy],
      // Extended for a learner new to THIS knowledge component — see
      // `listenSilenceMsFor`. The CELEBRATE/no-entry fallback above stays on
      // the raw table: with no active KC there is nothing to be "new" to.
      listenSilenceMs: listenSilenceMsFor(strategy, this.opportunities.get(entry.kcId) ?? 0),
      kcId: entry.kcId,
      evidence: executed && proposal.evidence ? { ...proposal.evidence, discounted: this.discountedFor(entry.kcId) } : null,
      masteryRevoked,
      pKnownBefore: pBefore,
      review: closedReview,
    };
  }

  /**
   * The strategy proposal, with the C.10 evidence a consequential proposal
   * rests on. Every consequential return below goes through a rule that
   * checks its chain against `required` first — there is no other path to
   * CELEBRATE, TRANSFER, REMEDIATE or RESCUE.
   */
  private propose(
    event: PedagogyEvent,
    entry: SessionPlanEntry,
    failedNow: boolean,
    pBefore: number,
    /** A corroborated wrong idea the learner SAID, which reaches REMEDIATE without a graded failure. */
    statedRemediation: boolean,
    required: number,
  ): { strategy: Strategy; evidence: DecisionEvidence | null; closeProbe: boolean } {
    const plain = (strategy: Strategy): { strategy: Strategy; evidence: null; closeProbe: false } => ({
      strategy,
      evidence: null,
      closeProbe: false,
    });
    const backed = (
      strategy: Strategy,
      rule: DecisionEvidence['rule'],
      observations: number,
    ): { strategy: Strategy; evidence: DecisionEvidence; closeProbe: false } => ({
      strategy,
      evidence: { rule, observations, required },
      closeProbe: false,
    });
    /*
     * RESCUE's two rules were already multi-observation (two consecutive
     * graded failures; three turns without progress). They keep their own
     * floors — the pre-C.10 baseline — and rise with the requirement if the
     * operator ever raises it above them, never fall below them.
     */
    const rescueFailures = Math.max(2, required);
    const rescueNoProgress = Math.max(3, required);
    const p = this.pKnown.get(entry.kcId) ?? entry.pKnown;

    /*
     * 1) Safety rules always win (blueprint §9.3): frustration first.
     *
     * THE COOLDOWN IS THE RULE, NOT THE "NEVER TWICE IN A ROW".
     *
     * Blocking only the immediately-consecutive rescue produced a worse thing
     * than the one it prevented. Measured against six straight failures, the
     * controller emitted RESCUE, DIRECT, RESCUE, DIRECT, RESCUE, DIRECT: the
     * failure count stays at or above two, so rescue is proposed every turn, and
     * the "never two in a row" guardrail downgrades every second one. The child
     * is bounced between emotional support and direct instruction on alternating
     * turns, forever — which is precisely the erratic experience the churn cap
     * exists to prevent, arriving through a different door. The churn cap cannot
     * catch it either, because real turns are far enough apart to keep clearing
     * its sixty-second window.
     *
     * Rescue is a RESET, so it needs room to work: once it has fired, it does
     * not fire again until the learner gets something right. Failing again after
     * a rescue means the rescue was not the answer, and the answer is to keep
     * teaching — rule 2's remediation, rule 3's prerequisite probe, or direct
     * instruction — not to rescue again with a different label.
     */
    if (this.consecutiveFailures >= rescueFailures && !this.rescuedSinceProgress) {
      return backed('RESCUE', 'rescue', this.consecutiveFailures);
    }

    /*
     * 1b) No progress across ordinary teaching turns, in a band with no lower
     * rung to fall back to.
     *
     * SOCRATIC and FLUENCY have somewhere to go when stuck: `baseStrategy`
     * degrades them to FADED (rule 7, below). DIRECT, WORKED, FADED and
     * SPACED do not — a learner already being given a full worked example
     * (or a due review) who keeps answering "no sé" is not undertaught,
     * they are stuck, and rule 1 above cannot see it because a
     * conversational "I don't know" is never a graded failure. Three such
     * turns is the SAME threshold rule 7 already uses for the questioning
     * bands, spent on the response actually built for this: RESCUE
     * validates the difficulty and makes the next thing easier, rather
     * than handing the model the identical instruction a fourth time and
     * trusting it to notice on its own that nothing is landing.
     */
    if (
      this.questioningWithoutProgress >= rescueNoProgress &&
      !this.rescuedSinceProgress &&
      (this.strategy === 'DIRECT' ||
        this.strategy === 'WORKED' ||
        this.strategy === 'FADED' ||
        this.strategy === 'SPACED')
    ) {
      return backed('RESCUE', 'rescue', this.questioningWithoutProgress);
    }

    /*
     * 2) A diagnosed wrong idea outranks everything except rescue — once it
     * is CORROBORATED (C.10). `misconceptionCode` is only ever set from a
     * chain that met the requirement (see the evidence handler), so a
     * non-null code here already carries its evidence.
     */
    if ((failedNow || statedRemediation) && this.misconceptionCode !== null) {
      return backed('REMEDIATE', 'remediation', this.remediationChain(entry.kcId).count);
    }

    // 3) Unexpected failure with prerequisites → walk the graph backwards.
    //    Judged on the PRE-update belief: "we thought they had this".
    if (
      failedNow &&
      this.probingKcId === null &&
      entry.prereqKcIds.length > 0 &&
      (pBefore >= 0.55 || this.consecutiveFailures >= 2)
    ) {
      return plain('PROBE');
    }

    /*
     * 4) While probing: a correct probe means the prerequisite holds and the
     * gap is in the original KC. Pre-C.10 that remediated the original KC
     * outright — on the ONE miss that opened the probe. It now remediates
     * only when the original KC's own chain is corroborated; otherwise the
     * probe closes and the original KC is taught normally until a second
     * observation arrives. A wrong probe keeps probing at floor difficulty.
     */
    if (this.probingKcId !== null && (event.kind === 'activity_result' || event.kind === 'voice_result')) {
      if (!event.correct) return plain('DIRECT');
      const interrupted = this.plan[this.probeReturnIndex ?? this.entryIndex];
      const chain = interrupted ? this.remediationChain(interrupted.kcId) : { code: null, count: 0 };
      const interruptedRequired = interrupted ? this.requiredObservationsFor(interrupted) : required;
      if (interrupted && chain.count >= interruptedRequired) {
        // The evidence is the ORIGINAL KC's, so is the requirement it is
        // judged against: a Stage 7 rollback on either KC alone must not
        // make a compliant decision read as a violation (or the reverse).
        return {
          strategy: 'REMEDIATE',
          evidence: { rule: 'remediation', observations: chain.count, required: interruptedRequired },
          closeProbe: false,
        };
      }
      return {
        strategy: interrupted ? this.baseStrategy(interrupted) : 'DIRECT',
        evidence: null,
        closeProbe: true,
      };
    }

    /*
     * 5) Mastery reached → celebrate once, then move to the next plan entry.
     *
     * MASTERY NEEDS EVIDENCE, NOT JUST CONFIDENCE. The posterior alone declared
     * it after a SINGLE correct answer: the mirror's textbook BKT update takes a
     * learner from 0.50 to 0.845 on one right answer and to 0.967 on two, so a
     * plan entry was finished, celebrated and left behind on evidence a guess
     * produces one time in five. Driving a competent learner through the whole
     * session plan took three turns, after which the controller went dormant and
     * the rest of the session fell back to v2 behaviour with no pedagogy at all.
     * That is the shallowness the product was accused of, expressed as a
     * threshold.
     *
     * The fix is the one the blueprint's schema already implies by carrying
     * `n_opportunities` beside the posterior, and that §640 states directly when
     * it asks for "2-3 ítems de sondeo": confidence is not evidence. A belief
     * above the bar on one observation means we have not looked enough, so
     * mastery now also requires having actually asked.
     */
    if (
      p >= 0.85 &&
      (event.kind === 'activity_result' || event.kind === 'voice_result') &&
      event.correct &&
      (this.opportunities.get(entry.kcId) ?? 0) >= MASTERY_MIN_OPPORTUNITIES &&
      /*
       * FRAGILITY IS CHECKED ONCE, AND MUST NOT BECOME A CAGE (2026-09-01,
       * found by running the gym immediately after adding revocation — the
       * fix for one defect creating its mirror image, which AGENTS.md §1.14
       * names as its own class: "a value derived to correct an
       * under-measurement must be checked against every case the ORIGINAL fix
       * was protecting").
       *
       * Hesitancy blocking promotion is right the FIRST time: it is what
       * takes a fragile mastery back. Left unqualified it is also a trap,
       * because a learner whose pace never returns to their own early
       * baseline can never again produce an unhesitant answer — so once
       * revoked they would sit in review forever, correct every single turn
       * and never promoted. The gym showed exactly that the moment
       * revocation existed: `CELEBRATE` followed by SPACED thirteen times,
       * the plan never completing inside a 16-turn budget.
       *
       * So once this session has ALREADY taken this KC's mastery back once,
       * sustained correctness is allowed to re-earn it even at the slower
       * pace. What that encodes is a real pedagogical position and not a
       * threshold tweak: we check whether a promotion was fragile, we act on
       * it once by teaching more, and we then believe the child rather than
       * holding them to a speed they may simply not have. A learner who is
       * carefully, reliably right is not a learner who has failed to learn.
       */
      (!this.answeredHesitantly(entry.kcId, event) || this.masteryRevokedKcIds.has(entry.kcId)) &&
      /*
       * C.10: AND a chain of consecutive qualifying correct answers at or
       * above the requirement. The opportunity count above is LIFETIME
       * (seeded from persisted history), so before this a returning learner
       * with old attempts could be declared master of a KC on one lucky
       * answer today. The chain is this session's, and unassisted.
       */
      (this.masteryEvidence.get(entry.kcId) ?? 0) >= required
    ) {
      return backed(
        this.celebratedKcIds.has(entry.kcId) ? 'TRANSFER' : 'CELEBRATE',
        'mastery',
        this.masteryEvidence.get(entry.kcId) ?? 0,
      );
    }

    // 6) A hard-won correct answer earns a self-explanation beat.
    if (
      (event.kind === 'activity_result' && event.correct && event.attemptNumber > 1) ||
      (this.strategy === 'REMEDIATE' && !failedNow && event.kind !== 'conversation_turn')
    ) {
      return plain('ELABORATE');
    }

    // 7) Otherwise: the mastery band decides.
    return plain(this.baseStrategy(entry));
  }

  private enforceGuardrails(proposed: Strategy, nowMs: number): Strategy {
    // Never two RESCUEs in a row — if it persists, the session-close path
    // (the orchestrator's budget/adaptation machinery) takes over.
    if (proposed === 'RESCUE' && this.strategy === 'RESCUE') return 'DIRECT';

    // Cap strategy churn: more than 3 changes in 60s reads as erratic to a
    // child, so past the cap the controller HOLDS its current strategy.
    const ceilingReached = this.strategyCeilingReached(nowMs);
    if (proposed !== this.strategy && ceilingReached) return this.strategy;
    return proposed;
  }

  /** Whether the 3-changes-per-minute ceiling is spent (prunes changes older than 60 s). */
  private strategyCeilingReached(nowMs: number): boolean {
    const cutoff = nowMs - 60_000;
    this.strategyChangesAt = this.strategyChangesAt.filter((t) => t > cutoff);
    return this.strategyChangesAt.length >= MAX_STRATEGY_CHANGES_PER_MINUTE;
  }

  private applyStrategy(strategy: Strategy, nowMs: number): void {
    const wasRemediating = this.strategy === 'REMEDIATE';
    if (strategy !== this.strategy) this.strategyChangesAt.push(nowMs);
    if (strategy === 'RESCUE') this.rescuedSinceProgress = true;
    this.strategy = strategy;

    /*
     * A DIAGNOSIS DOES NOT OUTLIVE THE REMEDIATION IT WAS FOR.
     *
     * Found live (adversarial review, 2026-08-29): `this.misconceptionCode`
     * is set ONLY inside the `activity_result`/`voice_result` branch of
     * `decide()` — a `conversation_turn` never touches it, by design
     * (rule 6 explicitly excludes `conversation_turn` from re-entering
     * ELABORATE). So a learner who deflects a REMEDIATE turn with an
     * ordinary chat reply ("no entiendo, ¿podemos hacer otra cosa?") moves
     * the STRATEGY on via `baseStrategy(entry)` — `mode` in `state()`
     * correctly reports the new one — while `misconceptionCode` (and the
     * `misconceptionHint` prompt.ts sends the model from it) kept
     * asserting the OLD diagnosis, contradicting `mode` in the very same
     * context payload, for every turn afterward until the next graded
     * result happened to overwrite it. Cleared here instead: the moment
     * the strategy itself leaves REMEDIATE, whatever diagnosis it was
     * open for is resolved BY DEFINITION, correctly-answered-and-cleared
     * or not.
     */
    if (wasRemediating && strategy !== 'REMEDIATE') this.misconceptionCode = null;

    if (strategy === 'PROBE' && this.probingKcId === null) {
      const entry = this.plan[this.entryIndex];
      this.probeReturnIndex = this.entryIndex;
      this.probingKcId = this.weakestPrerequisite(entry?.prereqKcIds ?? []);
      if (this.probingKcId === null) this.probeReturnIndex = null;
    }
    if (strategy === 'REMEDIATE' && this.probingKcId !== null) {
      // The probe answered its question; return to the interrupted KC.
      this.probingKcId = null;
      this.probeReturnIndex = null;
    }
    if (strategy === 'CELEBRATE' || strategy === 'TRANSFER') {
      // TRANSFER only ever fires on a kcId already in the set (rule 5), so
      // `.add` here is a no-op for it — advancing the plan is the part
      // both share: whichever of the two resolves THIS entry, the plan
      // moves on. Without this, a review-due re-encounter of an
      // already-mastered KC that resolves to TRANSFER would never
      // advance past its own entry at all.
      const entry = this.plan[this.entryIndex];
      if (entry) this.celebratedKcIds.add(entry.kcId);
      this.advanceEntry();
    }
  }

  /**
   * THE PREREQUISITE THEY ARE ACTUALLY WEAKEST AT.
   *
   * The blueprint calls this the product's "wow" moment — walk the graph
   * backwards and find the gap from two years ago, rather than reteaching the
   * step they just failed. Taking the FIRST prerequisite is not that: array
   * order is authoring order, so it probed whichever idea the curriculum
   * happened to list first and called it a diagnosis.
   *
   * With mastery in hand it is a real one: of everything this knowledge
   * component rests on, ask about the piece the learner is least likely to
   * have. A prerequisite with no evidence at all sorts as weakest, which is
   * correct — never assessed is not the same as known, and it is exactly where
   * a hidden gap hides.
   */
  /**
   * "CORRECTO + LATENCIA ALTA → DOMINIO FRÁGIL. NO PROMOVER" (blueprint §8.3).
   *
   * A right answer that took far longer than this learner's own right answers
   * usually take is a learner working it out rather than knowing it. Promoting
   * on it moves them off something they can only just barely do — which is how a
   * tutor produces a confident-looking mastery curve and a child who cannot do
   * any of it a week later.
   *
   * THE THRESHOLD IS THE LEARNER'S OWN PACE, deliberately, because every
   * absolute number here would have been invented. Children differ enormously in
   * how fast they answer, an activity that needs reading and dragging is slower
   * than one that needs a word, and a number tuned on a guess would silently
   * hold back every careful child. Comparing a learner against themselves needs
   * no such guess.
   *
   * It refuses to judge without evidence: fewer than two prior measurements, or
   * none at all, and this returns false — exactly the behaviour we had before
   * the signal existed. Absent data must never be read as a bad answer.
   */
  private answeredHesitantly(kcId: string, event: PedagogyEvent): boolean {
    if (event.kind !== 'activity_result') return false;
    const latency = event.latencyMs;
    if (latency === null || latency === undefined) return false;

    const history = this.correctLatencies.get(kcId) ?? [];
    // Two prior measurements is the minimum from which "usually" means anything.
    if (history.length < 2) return false;

    const sorted = [...history].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
    // Twice the learner's own median is a wide margin on purpose: this HOLDS a
    // promotion, and holding a fluent learner is a worse error than promoting a
    // hesitant one a turn late.
    return median > 0 && latency > median * HESITATION_FACTOR;
  }

  /**
   * "INCORRECTO + LATENCIA MUY BAJA → ADIVINANZA O DESENGANCHE" (blueprint §8.3).
   *
   * This matters more here than the blueprint's own framing suggests, because of
   * how our content is authored. The content playbook's rule 7 requires that
   * "every wrong option encodes ONE specific, common kid misconception" and that
   * a wrong choice be "tempting AND diagnostic" — so in 475 published lessons,
   * essentially EVERY wrong option is tagged with a wrong idea.
   *
   * That is excellent content design and it makes a guess indistinguishable from
   * a diagnosis. A child who taps at random lands on a misconception-tagged
   * distractor nearly every time they miss, the controller reads a diagnosed
   * wrong idea, and the tutor spends its next turns arguing against an idea the
   * child never held — while the actual problem, that they were not reading, is
   * never addressed. The better the distractors, the more confidently wrong the
   * diagnosis.
   *
   * Same self-calibrating threshold as the hesitation signal and the same
   * refusal to judge without evidence: faster than a third of this learner's own
   * median for this KC is not reading time, and fewer than two measurements
   * means no opinion.
   */
  private answeredWithoutReading(kcId: string, event: PedagogyEvent): boolean {
    if (event.kind !== 'activity_result' || event.correct) return false;
    return this.answeredTooFastToRead(kcId, event);
  }

  /**
   * The latency half of `answeredWithoutReading`, regardless of correctness —
   * C.10 reuses it for the SURPRISING correct (a possible lucky guess). Same
   * self-calibrated threshold and the same refusal to judge without two
   * prior measurements.
   */
  private answeredTooFastToRead(kcId: string, event: PedagogyEvent): boolean {
    if (event.kind !== 'activity_result') return false;
    const latency = event.latencyMs;
    if (latency === null || latency === undefined) return false;

    const history = this.correctLatencies.get(kcId) ?? [];
    if (history.length < 2) return false;

    const sorted = [...history].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
    return median > 0 && latency * GUESS_FACTOR < median;
  }

  private weakestPrerequisite(prereqKcIds: readonly string[]): string | null {
    if (prereqKcIds.length === 0) return null;
    const masteryOf = new Map(this.kcStates.map((s) => [s.kcId, s]));
    let weakest: string | null = null;
    let lowest = Number.POSITIVE_INFINITY;
    for (const kcId of prereqKcIds) {
      const state = masteryOf.get(kcId);
      // No evidence sorts below any measured belief: unassessed is where a gap
      // survives unnoticed, which is the whole point of looking backwards.
      const score = state === undefined || state.attempts === 0 ? -1 : state.pKnown;
      if (score < lowest) {
        lowest = score;
        weakest = kcId;
      }
    }
    return weakest;
  }

  private advanceEntry(): void {
    if (this.entryIndex < this.plan.length) {
      this.entryIndex += 1;
      this.consecutiveFailures = 0;
      this.misconceptionCode = null;
      const next = this.plan[this.entryIndex];
      if (next) {
        this.strategy = this.baseStrategy(next);
        this.lastDifficulty = band(next.targetDifficulty);
      }
    }
  }

  /** The hint text for the active misconception, from OUR catalog. */
  private activeMisconceptionHint(entry: SessionPlanEntry): string | null {
    if (this.misconceptionCode === null) return null;
    const hit = entry.misconceptions.find((m) => m.code === this.misconceptionCode);
    return hit ? hit.hint.slice(0, 240) : null;
  }

  private instructionFor(strategy: Strategy, entry: SessionPlanEntry): string | null {
    const template = STRATEGY_INSTRUCTIONS[strategy];
    if (!template) return null;
    const hint = this.activeMisconceptionHint(entry);
    const base =
      strategy === 'REMEDIATE' && hint
        ? `${template} The specific wrong idea, from our catalog: "${hint}"`
        : template;
    if (!this.guessedLastTurn) return base;
    /*
     * "Bajar dificultad, cambiar de modalidad" (§8.3). Difficulty already drops
     * on any failure; this is the other half. The instruction says what was
     * OBSERVED rather than what to conclude, because the tutor is better at
     * choosing words for a disengaged child than a rule is — and it must not
     * accuse: a child answering fast may be bored, tired, or testing the toy,
     * and none of those are met by being told off.
     */
    return `${base} NOTE: they answered almost instantly, too fast to have read it — treat this as disengagement, not a wrong idea. Do not re-teach the concept. Change what they are DOING: a different kind of activity, something to touch or say out loud, or a question about them.`;
  }

  /** The strict projection allowed to reach the model (context/schema.ts). */
  state(): PedagogyState | null {
    const entry = this.activeEntry;
    if (!entry) return null;
    const mode =
      this.probingKcId !== null
        ? 'probe'
        : this.strategy === 'REMEDIATE'
          ? 'remediation'
          : entry.reason === 'review_due'
            ? 'review'
            : 'new';
    return {
      strategy: this.strategy,
      scaffolding: this.scaffoldingFor(this.strategy),
      kcObjective: entry.objective.slice(0, 200) || 'Teach the current idea until the learner can use it.',
      mode,
      misconceptionHint: this.activeMisconceptionHint(entry),
    };
  }
}

/**
 * How long the client waits before a gentle nudge, PER STRATEGY (blueprint
 * §6.2, adapted to push-to-talk): thinking time is the most valuable part of
 * a Socratic beat, so those wait long; fluency work wants pace.
 */
export const IDLE_NUDGE_MS: Record<Strategy, number> = {
  DIRECT: 25_000,
  WORKED: 25_000,
  FADED: 35_000,
  SOCRATIC: 45_000,
  FLUENCY: 15_000,
  SPACED: 30_000,
  PROBE: 45_000,
  REMEDIATE: 30_000,
  RESCUE: 40_000,
  ELABORATE: 45_000,
  TRANSFER: 35_000,
  CELEBRATE: 30_000,
};

/**
 * HOW LONG A PAUSE MEANS "I'M DONE TALKING", PER STRATEGY.
 *
 * This is the blueprint's §6.2 turn policy, and it is differentiator #1 of the
 * fourteen for a reason: in customer service you want to close a turn fast, and
 * in TUTORING you want the opposite. The silence of a child who is thinking is
 * the most valuable part of the session, and a tutor that talks into it has
 * destroyed the thing it was there to cause.
 *
 * So the number is not global and it is not a timeout — it is a pedagogical
 * decision that changes with what the tutor just did. After an open Socratic
 * question, three and a half seconds of quiet is a child working; after a
 * fluency drill, the same silence is a child who has lost the thread and needs
 * the next card. The strategy already knows which of those it is, and it is the
 * only thing that does.
 *
 * These are DELIBERATELY longer than a voice assistant's ~700 ms. A product
 * built for six-year-olds that cuts them off mid-sentence is a product they
 * stop talking to, and the cost of waiting too long is one awkward beat where
 * the cost of waiting too little is the answer itself.
 */
export const LISTEN_SILENCE_MS: Record<Strategy, number> = {
  // The tutor just explained; the learner is acknowledging or asking back.
  DIRECT: 1_500,
  WORKED: 1_500,
  // A partially-faded example: they are working, with a step to fill in.
  FADED: 2_500,
  // The whole point is the pause. Never rush it.
  SOCRATIC: 3_500,
  // Recall drills want pace — a long tail here reads as the app being broken.
  FLUENCY: 900,
  SPACED: 1_500,
  // A diagnostic probe is a question about something they may not know yet.
  PROBE: 3_000,
  REMEDIATE: 2_500,
  // Frustrated: present, unhurried, never looming.
  RESCUE: 2_500,
  // "Explain why it works" — the longest answers in the whole session.
  ELABORATE: 3_500,
  TRANSFER: 3_000,
  CELEBRATE: 1_200,
};

/**
 * Below this many EVER-assessed opportunities on the active knowledge
 * component — a lifetime count, seeded in the constructor from Core's
 * persisted history (`kcStates`), not merely this session's — a learner
 * counts as NEW to the skill, for the one purpose of listening a little
 * longer. See `NEW_TO_SKILL_SILENCE_GRACE` for why.
 */
export const NEW_TO_SKILL_OPPORTUNITIES = 2;

/**
 * How much longer to listen for a learner new to the active knowledge
 * component, as a FRACTION of the strategy's own budget rather than a
 * second hand-authored table — derived, so it cannot drift out of ratio
 * with `LISTEN_SILENCE_MS` the way two independently-tuned tables would
 * (`/AGENTS.md` item 32's lesson).
 *
 * THE GAP THIS CLOSES. `LISTEN_SILENCE_MS` above is a fixed, strategy-only
 * lookup — the identical pause budget for a learner meeting a knowledge
 * component for the very first time and one who has answered it a dozen
 * times, with no per-learner adjustment at all. Confirmed MEDIUM finding,
 * adversarial review sweep tutor-review-sweep-101 (voice-audio-quality
 * dimension), 2026-08-31: a genuine speech-timing difference — a stutter
 * block, real processing delay, a child who needs a beat before answering —
 * produces silence indistinguishable from "done talking," and this product
 * explicitly serves learners for whom that difference is real, not a rare
 * edge case. First exposure to a skill is exactly when working memory is
 * doing the most and the tutor is LEAST entitled to read a pause as "done."
 *
 * NOT keyed off a partial or interim transcript, because none exists
 * anywhere in this pipeline. Audio is transcribed exactly once, on COMMIT
 * (`/AGENTS.md` §2.7 — the streamed `learner_audio_begin`/`_chunk` frames
 * claim nothing; only `learner_audio_commit` "claims, transcribes and
 * pays"), and that commit is triggered BY the client's own amplitude-based
 * turn detector (`frontend/src/tutor/turnDetector.ts`) deciding the turn
 * already ended. By the time any transcript — partial or final — could
 * exist, the cutoff this fix needs to prevent has already happened; there
 * is nothing upstream of it to read. `opportunities` is this file's own
 * closest available analogue to "have they shown me this before": a real,
 * persisted-history-aware signal that needs no new plumbing, no per-turn
 * peek into the future, and no ML.
 *
 * DELIBERATELY NOT a flat grace added inside the turn detector's own timer
 * instead: that mechanism cannot tell a mid-answer stutter from a learner
 * who has genuinely finished at the exact instant the ordinary silence
 * threshold is reached, so extending it unconditionally would extend EVERY
 * silence run by the same amount — including one that really is over,
 * which is the one behaviour this fix must leave untouched. Gating the
 * extension on knowledge-component exposure instead confines it to a
 * bounded, identifiable population (new to THIS skill) and leaves every
 * already-covered case — an experienced learner's threshold, and this same
 * learner's own third opportunity onward — exactly as it was.
 */
export const NEW_TO_SKILL_SILENCE_GRACE = 0.4;

/**
 * `LISTEN_SILENCE_MS[strategy]`, extended for a learner new to the active
 * knowledge component. See `NEW_TO_SKILL_SILENCE_GRACE` for the rationale
 * and why the turn detector's own timer is not the lever instead.
 */
export function listenSilenceMsFor(strategy: Strategy, opportunitiesOnKc: number): number {
  const base = LISTEN_SILENCE_MS[strategy];
  if (opportunitiesOnKc >= NEW_TO_SKILL_OPPORTUNITIES) return base;
  return Math.round(base * (1 + NEW_TO_SKILL_SILENCE_GRACE));
}

/**
 * The per-strategy instruction the turn's prompt carries. Constant strings —
 * the prefix cache is untouched because these ride in the USER content, and
 * nothing learner-authored is ever interpolated into them.
 */
export const STRATEGY_INSTRUCTIONS: Record<Strategy, string> = {
  DIRECT:
    'Strategy for this turn: DIRECT INSTRUCTION. Teach the idea plainly in two or three short sentences with one small concrete example, then ask one simple question that uses it.',
  WORKED:
    'Strategy for this turn: WORKED EXAMPLE. Walk through one complete example out loud, naming each step as you do it, then hand the learner the very last step to finish.',
  FADED:
    'Strategy for this turn: FADED EXAMPLE. Start an example and leave the final steps for the learner. Each time they succeed, leave one more step to them.',
  SOCRATIC:
    'Strategy for this turn: SOCRATIC. Ask ONE guiding question that moves them a step forward. NEVER state the answer or any step that reveals it — if they ask for the answer, answer with a smaller question.',
  FLUENCY:
    'Strategy for this turn: FLUENCY. They know this — help them get quick. Short, snappy exchanges, one small question at a time, keep the energy up.',
  SPACED:
    'Strategy for this turn: SPACED REVIEW. This is something they learned before and it is time to bring it back. Present it as a fresh little problem, never as a test of memory.',
  PROBE:
    'Strategy for this turn: DIAGNOSTIC PROBE. Something earlier may be shaky. Ask one gentle question about the underlying idea, framed as curiosity, never as a step backwards.',
  REMEDIATE:
    'Strategy for this turn: REMEDIATION. The learner is applying a specific wrong idea, not making a random mistake. Do not re-explain the whole topic — confront that one idea with an example where it visibly fails, then rebuild.',
  RESCUE:
    'Strategy for this turn: RESCUE. The learner is frustrated. Validate the difficulty first, in one warm sentence. Make the next thing genuinely easier, and offer a choice: keep going gently, or switch to something else.',
  ELABORATE:
    'Strategy for this turn: SELF-EXPLANATION. They got it right — now ask them to explain WHY it works, in their own words. Their explanation matters more than the answer did.',
  TRANSFER:
    'Strategy for this turn: TRANSFER. They own this idea. Give it to them in a completely different context and let them discover it still works.',
  CELEBRATE:
    'Strategy for this turn: CELEBRATE. They just mastered something real. Name exactly what they can now do, connect it to what comes next, and keep it to two sentences of genuine warmth.',
};
