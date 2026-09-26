import { z } from 'zod';

/*
 * C.11: the two-tier spaced-review router (Appendix D §2.4).
 *
 * Two distinct problems, two distinct mechanisms, and one explicit rule that
 * decides which of them owns a given wrong answer:
 *
 *   WITHIN-SESSION TIER (this file). A short-horizon, PFA-style running-count
 *   rule: a shaky answer on a knowledge component the learner nearly has is
 *   brought back ONCE MORE later in THIS session, after a short gap, and
 *   retired when the learner's spaced successes outnumber their misses since
 *   the routing (successes − failures ≥ 1, the routed miss counting as the
 *   first failure). The retention interval that matters here is the rest of
 *   a 20-minute session, too short for forgetting curves to be the relevant
 *   mechanism, so the rule counts; it does not model decay.
 *
 *   CROSS-SESSION TIER (Core, `backend/src/services/pedagogy/fsrs.ts`). The
 *   existing activation/half-life-style memory card per (learner, KC):
 *   stability grows as successful SPACED reviews accumulate. Core's half of
 *   C.11 stops massed in-session repetition from inflating that interval
 *   (the short-horizon rule), and applies this router's hand-offs at close.
 *
 * THE DECISION RULE (`routeWrongAnswer`): keep the answer in-session only when
 * the learner was close to the mastery threshold BEFORE the miss AND the
 * session still has the turn and time budget a spaced re-exposure needs;
 * otherwise hand it to the cross-session scheduler instead of rushing a fake
 * spaced sequence into the last minutes of a session about to hit its cap.
 * The rule is pure and deterministic, its inputs are recorded on every
 * decision, and Core re-evaluates it over the recorded inputs (Spaced-Review
 * Routing Accuracy, Appendix F §1.1) — so a misroute is a visible,
 * re-computable fact, never a judgement call.
 *
 * WHAT IT NEVER DOES. It never grades, never changes mastery, and never reads
 * the learner's words. It sees a knowledge-component id, a correctness bit,
 * the controller's belief and the session budget. The in-session re-exposure
 * itself is the controller's review detour (`controller.ts`), opened by the
 * orchestrator when this router says an item is due and no higher directive
 * owns the turn.
 *
 * Every number below is PROPOSED, pending calibration: see
 * docs/rebuild/mentor/THRESHOLD-RECALIBRATION-LOG.md (C.11 rows). Core's copy
 * of the rule (`services/pedagogy/spacedReview.ts`) is kept identical by
 * `npm run review-calibration:check`.
 */

export const SPACED_REVIEW_RULE_VERSION = 'c11.v1';
export const SPACED_REVIEW_MODES = ['act', 'shadow', 'off'] as const;
export type SpacedReviewMode = (typeof SPACED_REVIEW_MODES)[number];

/** The stricter of the operator's switch and Core's Stage 7 verdict (off > shadow > act). */
export function strictestSpacedReviewMode(operator: SpacedReviewMode, core: 'act' | 'shadow'): SpacedReviewMode {
  if (operator === 'off') return 'off';
  return operator === 'shadow' || core === 'shadow' ? 'shadow' : 'act';
}

export const REVIEW_TIERS = ['within_session', 'cross_session'] as const;
export type ReviewTier = (typeof REVIEW_TIERS)[number];

/** Why a wrong answer went to its tier, in rule order (the first that applies wins). */
export const ROUTING_REASONS = [
  'no_plan_entry',
  'wrapping',
  'time_budget',
  'turn_budget',
  'reexposure_cap',
  'far_from_threshold',
  'queue_full',
  'near_threshold',
] as const;
export type RoutingReason = (typeof ROUTING_REASONS)[number];

export const ROUTING_SOURCES = ['first_miss', 'reexposure_miss'] as const;
export type RoutingSource = (typeof ROUTING_SOURCES)[number];

/**
 * How each decision ended, as reported at close:
 *   retired        within-session: spaced successes outnumbered the misses
 *   rerouted       within-session: a later spaced miss re-ran the rule (the
 *                  successor decision carries the outcome)
 *   session_ended  within-session: still queued when the session closed —
 *                  handed to the cross-session scheduler at close
 *   abandoned      within-session: the re-exposure was opened and the learner
 *                  never answered it — handed off at close
 *   handed_off     cross-session: the scheduler owns it from the miss on
 */
export const ROUTING_OUTCOMES = ['retired', 'rerouted', 'session_ended', 'abandoned', 'handed_off'] as const;
export type RoutingOutcome = (typeof ROUTING_OUTCOMES)[number];

export const BUDGET_STATES = ['running', 'wrapping', 'ended'] as const;

export const SPACED_REVIEW_THRESHOLDS = {
  /** P(L) BEFORE the miss at or above this is "close to the mastery threshold". */
  nearThresholdFloor: 0.5,
  /** Model turns a within-session re-exposure needs left before the turn cap. */
  minTurnsRemaining: 8,
  /** Time a within-session re-exposure needs before the session starts wrapping up. */
  minMsUntilWrap: 4 * 60_000,
  /** Learner turns between a miss (or a re-exposure) and the next spaced re-exposure. */
  reexposureGapTurns: 3,
  /** Spaced re-exposures of one KC per session, after which it is handed off. */
  maxReexposuresPerKc: 3,
  /** Retired once spaced successes − failures (the routed miss included) reach this. */
  retireAtNet: 1,
  /** Knowledge components waiting in the within-session tier at once. */
  maxQueued: 3,
  /** An opened re-exposure no graded answer followed within this many learner turns is abandoned. */
  reviewOpenTurns: 3,
  /** Decisions reported per session (the rest are counted, not itemised). */
  maxDecisions: 40,
} as const;

/** The thresholds' shape with plain numbers, so a gym or a test can pass a variant. */
export type SpacedReviewThresholds = { readonly [K in keyof typeof SPACED_REVIEW_THRESHOLDS]: number };

export interface RoutingInput {
  /** Whether the KC has a plan entry the controller can bring back (a probe's prerequisite has none). */
  planned: boolean;
  /** The controller's belief BEFORE this answer's evidence. */
  pBefore: number;
  turnsRemaining: number;
  msUntilWrap: number;
  budgetState: (typeof BUDGET_STATES)[number];
  /** Spaced re-exposures this KC has already had this session. */
  reexposures: number;
  /** OTHER knowledge components already waiting in the within-session tier. */
  queued: number;
}

/** THE decision rule (Appendix D §2.4). Pure; Core re-evaluates it over the recorded inputs. */
export function routeWrongAnswer(
  input: RoutingInput,
  t: SpacedReviewThresholds = SPACED_REVIEW_THRESHOLDS,
): { tier: ReviewTier; reason: RoutingReason } {
  const cross = (reason: RoutingReason) => ({ tier: 'cross_session' as const, reason });
  if (!input.planned) return cross('no_plan_entry');
  if (input.budgetState !== 'running') return cross('wrapping');
  if (input.msUntilWrap < t.minMsUntilWrap) return cross('time_budget');
  if (input.turnsRemaining < t.minTurnsRemaining) return cross('turn_budget');
  if (input.reexposures >= t.maxReexposuresPerKc) return cross('reexposure_cap');
  if (input.pBefore < t.nearThresholdFloor) return cross('far_from_threshold');
  if (input.queued >= t.maxQueued) return cross('queue_full');
  return { tier: 'within_session', reason: 'near_threshold' };
}

const round3 = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;

export const RoutingDecisionSchema = z
  .object({
    observation: z.number().int().min(1).max(200),
    kcId: z.string().min(1).max(64),
    tier: z.enum(REVIEW_TIERS),
    reason: z.enum(ROUTING_REASONS),
    source: z.enum(ROUTING_SOURCES),
    pBefore: z.number().min(0).max(1),
    pAfter: z.number().min(0).max(1),
    turnsRemaining: z.number().int().min(0).max(100_000),
    msUntilWrap: z.number().int().min(0).max(86_400_000),
    budgetState: z.enum(BUDGET_STATES),
    planned: z.boolean(),
    reexposuresBefore: z.number().int().min(0).max(50),
    queuedBefore: z.number().int().min(0).max(50),
    /** The learner turn the decision was made on (1-based). */
    atTurn: z.number().int().min(0).max(100_000),
    outcome: z.enum(ROUTING_OUTCOMES).nullable(),
    /** Spaced successes / failures counted while this decision was the KC's latest (within-session). */
    successes: z.number().int().min(0).max(50),
    failures: z.number().int().min(0).max(50),
  })
  .strict();
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

const ItemSchema = z
  .object({
    kcId: z.string(),
    decision: z.number().int().min(0),
    lastEventTurn: z.number().int().min(0),
    successes: z.number().int().min(0),
    failures: z.number().int().min(0),
    reexposures: z.number().int().min(0),
    opened: z.boolean(),
  })
  .strict();

export const SpacedReviewSnapshotSchema = z
  .object({
    learnerTurn: z.number().int().min(0),
    items: z.array(ItemSchema),
    handedOff: z.array(z.string()),
    decisions: z.array(RoutingDecisionSchema),
    overflow: z.number().int().min(0),
    detoursOpened: z.number().int().min(0),
  })
  .strict();
export type SpacedReviewSnapshot = z.infer<typeof SpacedReviewSnapshotSchema>;

export const EMPTY_SPACED_REVIEW: SpacedReviewSnapshot = {
  learnerTurn: 0,
  items: [],
  handedOff: [],
  decisions: [],
  overflow: 0,
  detoursOpened: 0,
};

/** What Core records at close (labels, ids of OUR catalog and numbers only). */
export interface SpacedReviewReport {
  mode: 'act' | 'shadow';
  ruleVersion: string;
  learnerTurns: number;
  detoursOpened: number;
  /** Decisions beyond `maxDecisions`, counted but not itemised. */
  overflow: number;
  decisions: RoutingDecision[];
}

export interface ObserveInput {
  kcId: string;
  planned: boolean;
  correct: boolean;
  pBefore: number;
  pAfter: number;
  turnsRemaining: number;
  msUntilWrap: number;
  budgetState: (typeof BUDGET_STATES)[number];
  /** The answer came from an opened in-session review detour (always spaced). */
  fromDetour: boolean;
}

export type ObserveResult = 'routed_within' | 'routed_cross' | 'counted' | 'retired' | null;

type Item = z.infer<typeof ItemSchema>;

export class SpacedReviewRouter {
  private learnerTurn = 0;
  private items = new Map<string, Item>();
  private handedOff = new Set<string>();
  private decisions: RoutingDecision[] = [];
  private overflow = 0;
  private detoursOpened = 0;

  constructor(readonly mode: SpacedReviewMode) {}

  /** One learner turn happened (a message, a spoken answer or a graded activity). */
  noteLearnerTurn(): void {
    if (this.mode === 'off') return;
    this.learnerTurn += 1;
  }

  get queuedKcIds(): readonly string[] {
    return [...this.items.keys()];
  }

  /**
   * Feeds one graded answer. A miss is routed (or re-routed); a spaced answer
   * on a queued KC moves its running count. Answers inside the gap are massed
   * practice and are not counted — the controller still teaches from them.
   */
  observe(input: ObserveInput, t: SpacedReviewThresholds = SPACED_REVIEW_THRESHOLDS): ObserveResult {
    if (this.mode === 'off') return null;
    // The cross-session scheduler owns a handed-off KC for the rest of the session.
    if (this.handedOff.has(input.kcId)) return null;
    const item = this.items.get(input.kcId);

    if (item === undefined) {
      if (input.correct) return null;
      return this.route(input, 'first_miss', 0, t);
    }

    const spaced = input.fromDetour || this.learnerTurn - item.lastEventTurn >= t.reexposureGapTurns;
    if (!spaced) return null;
    item.reexposures += 1;
    item.lastEventTurn = this.learnerTurn;
    item.opened = false;
    const decision = this.decisions[item.decision];
    if (input.correct) {
      item.successes += 1;
      if (decision) decision.successes = item.successes;
      if (item.successes - item.failures >= t.retireAtNet) {
        if (decision) decision.outcome = 'retired';
        this.items.delete(input.kcId);
        return 'retired';
      }
      return 'counted';
    }
    item.failures += 1;
    if (decision) {
      decision.failures = item.failures;
      decision.outcome = 'rerouted';
    }
    return this.route(input, 'reexposure_miss', item.reexposures, t, item);
  }

  private route(
    input: ObserveInput,
    source: RoutingSource,
    reexposures: number,
    t: SpacedReviewThresholds,
    existing?: Item,
  ): ObserveResult {
    const queued = [...this.items.keys()].filter((kc) => kc !== input.kcId).length;
    const routingInput: RoutingInput = {
      planned: input.planned,
      pBefore: input.pBefore,
      turnsRemaining: Math.max(0, Math.floor(input.turnsRemaining)),
      msUntilWrap: Math.max(0, Math.floor(input.msUntilWrap)),
      budgetState: input.budgetState,
      reexposures,
      queued,
    };
    const { tier, reason } = routeWrongAnswer(routingInput, t);
    const record: RoutingDecision = {
      observation: this.decisions.length + this.overflow + 1,
      kcId: input.kcId.slice(0, 64),
      tier,
      reason,
      source,
      pBefore: round3(input.pBefore),
      pAfter: round3(input.pAfter),
      turnsRemaining: Math.min(routingInput.turnsRemaining, 100_000),
      msUntilWrap: Math.min(routingInput.msUntilWrap, 86_400_000),
      budgetState: input.budgetState,
      planned: input.planned,
      reexposuresBefore: Math.min(reexposures, 50),
      queuedBefore: Math.min(queued, 50),
      atTurn: this.learnerTurn,
      outcome: tier === 'cross_session' ? 'handed_off' : null,
      successes: existing?.successes ?? 0,
      failures: existing?.failures ?? 1,
    };
    let index = -1;
    if (this.decisions.length < t.maxDecisions) {
      this.decisions.push(record);
      index = this.decisions.length - 1;
    } else {
      this.overflow += 1;
    }
    if (tier === 'cross_session') {
      this.items.delete(input.kcId);
      this.handedOff.add(input.kcId);
      return 'routed_cross';
    }
    if (existing) {
      existing.decision = index < 0 ? existing.decision : index;
      existing.lastEventTurn = this.learnerTurn;
      return 'routed_within';
    }
    this.items.set(input.kcId, {
      kcId: input.kcId,
      decision: index < 0 ? Number.MAX_SAFE_INTEGER : index,
      lastEventTurn: this.learnerTurn,
      successes: 0,
      failures: 1,
      reexposures: 0,
      opened: false,
    });
    return 'routed_within';
  }

  /**
   * The queued KC whose gap has elapsed longest ago, or null. Only in `act`
   * mode, only while the session is running, never one whose re-exposure is
   * already open, and never the KC the controller is currently teaching
   * (its ordinary attempts are its re-exposures).
   */
  dueKcId(
    activeKcId: string | null,
    budgetState: (typeof BUDGET_STATES)[number],
    t: SpacedReviewThresholds = SPACED_REVIEW_THRESHOLDS,
  ): string | null {
    if (this.mode !== 'act' || budgetState !== 'running') return null;
    let best: Item | null = null;
    for (const item of this.items.values()) {
      if (item.opened || item.kcId === activeKcId) continue;
      if (this.learnerTurn - item.lastEventTurn < t.reexposureGapTurns) continue;
      if (best === null || item.lastEventTurn < best.lastEventTurn) best = item;
    }
    return best?.kcId ?? null;
  }

  /** The controller opened a re-exposure detour for this KC. */
  noteDetourOpened(kcId: string): void {
    const item = this.items.get(kcId);
    if (!item) return;
    item.opened = true;
    this.detoursOpened += 1;
  }

  /**
   * The opened re-exposure went unanswered for `reviewOpenTurns` learner
   * turns: the learner is not doing it, so it is not pushed again this
   * session — the cross-session scheduler gets it at close.
   */
  noteDetourAbandoned(kcId: string): void {
    const item = this.items.get(kcId);
    if (!item) return;
    const decision = this.decisions[item.decision];
    if (decision) decision.outcome = 'abandoned';
    this.items.delete(kcId);
    this.handedOff.add(kcId);
  }

  /** The record for Core. Pending within-session decisions read `session_ended`. */
  report(): SpacedReviewReport {
    return {
      mode: this.mode === 'shadow' ? 'shadow' : 'act',
      ruleVersion: SPACED_REVIEW_RULE_VERSION,
      learnerTurns: Math.min(this.learnerTurn, 100_000),
      detoursOpened: Math.min(this.detoursOpened, 10_000),
      overflow: Math.min(this.overflow, 10_000),
      decisions: this.decisions.map((d) => ({ ...d, outcome: d.outcome ?? 'session_ended' })),
    };
  }

  snapshot(): SpacedReviewSnapshot {
    return {
      learnerTurn: this.learnerTurn,
      items: [...this.items.values()].map((i) => ({ ...i })),
      handedOff: [...this.handedOff].sort(),
      decisions: this.decisions.map((d) => ({ ...d })),
      overflow: this.overflow,
      detoursOpened: this.detoursOpened,
    };
  }

  restore(snapshot: SpacedReviewSnapshot): void {
    this.learnerTurn = snapshot.learnerTurn;
    this.items = new Map(snapshot.items.map((i) => [i.kcId, { ...i }]));
    this.handedOff = new Set(snapshot.handedOff);
    this.decisions = snapshot.decisions.map((d) => ({ ...d }));
    this.overflow = snapshot.overflow;
    this.detoursOpened = snapshot.detoursOpened;
  }
}

/** The lead a turn carries when the controller opens an in-session re-exposure. */
export function reviewLeadInstruction(objective: string): string {
  return [
    'IN-SESSION REVIEW: before going on, bring back one idea from earlier in this session as a quick re-check —',
    `"${objective.slice(0, 200)}".`,
    'Present it as one fresh little problem with new numbers, never as a memory test, and request ONE short activity for it.',
    'Do not say it is a review of a mistake.',
  ].join(' ');
}

/** What the turn reacting to an in-session re-exposure is told. */
export function reviewResultInstruction(correct: boolean, objective: string): string {
  return correct
    ? `IN-SESSION REVIEW RESULT: they just re-did an idea from earlier in this session ("${objective.slice(0, 200)}") and got it right. Confirm it in one short specific sentence, then go back to what you were working on.`
    : `IN-SESSION REVIEW RESULT: they just re-did an idea from earlier in this session ("${objective.slice(0, 200)}") and it is not there yet. Show the step plainly once with one small example — do NOT drill it now, it will come back later — then go back to what you were working on.`;
}
