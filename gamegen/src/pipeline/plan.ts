// plan stage — game blueprint → manifest SKELETON (GAME_ENGINE.md §9, gamegen/AGENTS.md).
// DeepSeek, temp 0.3, JSON mode. The twin of `coursegen/src/pipeline/plan.ts`; every
// structural decision below is ported from Forge rather than re-derived.
//
// WHAT THIS STAGE PRODUCES — AND WHAT IT MUST NOT. A skeleton is COUNTS AND SHAPE:
// which mechanic config surface to target, how many items and categories, how the
// difficulty ladder ramps across rounds, how many rounds, whether interludes are
// warranted, and the scoring posture (mode / pass_score / minutes). It authors NO
// content: no labels, no category names, no prompts, no feedback lines, no numbers that
// end up inside `content`. That is the `author` stage's job, held to `gamePlaybook.ts`.
// Two reasons this split is worth a whole paid call: a plan is ~30x cheaper to retry
// than a full manifest, and a document whose counts were decided in the same breath as
// its prose reliably drifts out of the tier bands (Forge's pre-split behaviour).
//
// DETERMINISTIC REPAIR BEFORE A PAID RETRY. `planRepair()` fixes every mechanically
// fixable violation — a re-picked mechanic, an out-of-band count, an impossible
// category/item ratio, too many interludes, a pass_score outside the fair band — without
// spending an LLM attempt. Forge does exactly this and it is both cheaper and more
// reliable than hoping the model self-corrects.
//
// PREFIX-CACHE DISCIPLINE (gamegen/AGENTS.md, "static-first assembly, retries APPEND").
// The mechanic's schema-derived shape example and the FROZEN numbered PLAN RULES lead
// the user message; the per-blueprint brief goes last; corrective feedback is APPENDED
// as a third message so attempts 2..N re-send a byte-identical leading prompt. The
// numbered list contains ALWAYS-TRUE rules only — conditionals live in a separate
// UNNUMBERED "GAME DIRECTIVES" block, because splicing a conditional into a numbered
// list renumbers every following line and kills the shared prefix a few hundred tokens
// in. Scheduling note for `run.ts`: consecutive slots that share (mechanic, tier) share
// the whole leading block, so ordering the queue by mechanic then tier is free money.
//
// §1.9. Everything this stage sends to DeepSeek comes from the curriculum: the
// blueprint, the catalog concept context, the age TIER and the mechanic contract. There
// is no per-child path here and there must never be one.

import { z } from 'zod';

import type { GameBlueprint } from '../catalog/schema.js';
import { scoringModeEnum } from '../contract/core/schemaBase.js';
import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import { withCorrectiveRetry, safeJsonParse, formatZodIssues } from './correctiveRetry.js';
import { tierReasoningGuidance } from './gamePlaybook.js';
import { mechanicShapeExample } from './shapeExample.js';

// ---- Plan-stage bands ----------------------------------------------------------
//
// These are PLAN-STAGE POLICY, deliberately NARROWER than the contract bounds in
// `contract/core/schema.ts` (items 1..80, categories 0..8, interludes 0..4,
// estimated_minutes 1..10, pass_score 0..100). A skeleton at a contract extreme is
// schema-valid and pedagogically wrong — 80 items is not a five-minute game — so the
// band is what the prompt states and what `planRepair` enforces. Widening one of these
// is a content-design decision, not a bug fix.

export const MAX_CATEGORIES = 8; // contract ceiling, restated here for the prompt
export const MAX_INTERLUDES = 4; // contract ceiling
export const MIN_ROUNDS = 2;
export const MAX_ROUNDS = 8;
export const MIN_ITEMS = 3;
export const MAX_ITEMS = 32;

/** Below 50 a masher passes (free XP); above 90 leaves no margin for a child who is
 *  not the perfect bot. Both edges are checked for real by the free `simulate` gate. */
export const MIN_PASS_SCORE = 50;
export const MAX_PASS_SCORE = 90;

/** gamePlaybook rule 11: one session, one idea. */
export const MIN_MINUTES = 2;
export const MAX_MINUTES = 5;

/** Every category needs at least this many items or it cannot discriminate anything. */
export const MIN_ITEMS_PER_CATEGORY = 2;

const MAX_ROUND_BRIEF = 300;
const MAX_DESIGN_BRIEF = 600;
const MAX_PLAN_ATTEMPTS = 3;

/** Item/round bands per audience tier (Piaget bands, `gamePlaybook.tierReasoningGuidance`).
 *  Mapped types over the literal tier union — NOT index signatures — so
 *  `noUncheckedIndexedAccess` does not widen these reads to `| undefined`. */
type Band = { min: number; max: number };
export const TIER_ITEM_BAND: Record<1 | 2 | 3, Band> = {
  1: { min: 4, max: 10 },
  2: { min: 6, max: 18 },
  3: { min: 8, max: 26 },
};
export const TIER_ROUND_BAND: Record<1 | 2 | 3, Band> = {
  1: { min: 2, max: 4 },
  2: { min: 3, max: 6 },
  3: { min: 3, max: 8 },
};
/** Starting category count per tier — tier 1 must be able to hold the whole taxonomy
 *  in working memory while a canvas moves. */
export const TIER_CATEGORY_DEFAULT: Record<1 | 2 | 3, number> = { 1: 2, 2: 3, 3: 4 };

// ---- The skeleton --------------------------------------------------------------

export const DIFFICULTY_CURVES = ['gentle', 'steady', 'steep'] as const;
export type DifficultyCurve = (typeof DIFFICULTY_CURVES)[number];
export const difficultyCurveEnum = z.enum(DIFFICULTY_CURVES);

export const planRoundSchema = z.object({
  round: z.number().int().min(1).max(MAX_ROUNDS),
  /** WHAT NUMBER CHANGES at this rung — never new content, never a new idea. */
  brief: z.string().min(1).max(MAX_ROUND_BRIEF),
});

export const planSkeletonSchema = z.object({
  /** Confirmation only. The blueprint decides the mechanic; `planRepair` forces it back
   *  if the model "improves" on it, because the whole prompt was built for that one. */
  mechanic: z.string().min(1).max(32),
  item_count: z.number().int().min(MIN_ITEMS).max(MAX_ITEMS),
  /** How many of those items are traps carrying a `misconception_md` (playbook rule 3). */
  trap_count: z.number().int().min(0).max(MAX_ITEMS),
  category_count: z.number().int().min(0).max(MAX_CATEGORIES),
  rounds: z.array(planRoundSchema).min(MIN_ROUNDS).max(MAX_ROUNDS),
  difficulty_curve: difficultyCurveEnum,
  interlude_count: z.number().int().min(0).max(MAX_INTERLUDES),
  scoring_mode: scoringModeEnum,
  pass_score: z.number().int().min(0).max(100),
  estimated_minutes: z.number().int().min(1).max(10),
  /** One paragraph: what the player MANIPULATES and why that verb IS the concept.
   *  The author stage's brief — still not content. */
  design_brief: z.string().min(1).max(MAX_DESIGN_BRIEF),
});

export type PlanRound = z.infer<typeof planRoundSchema>;
export type PlanSkeleton = z.infer<typeof planSkeletonSchema>;

/**
 * The blueprint facts `planRepair` and the derivation need. Declared as a `Pick` of the
 * catalog type so a catalog schema change surfaces here as a compile error.
 */
export type PlanBlueprintFacts = Pick<GameBlueprint, 'mechanic' | 'tier' | 'difficulty' | 'micro_objective'>;

// ---- Context / deps / result ---------------------------------------------------

export interface PlanContext {
  courseTitle: string;
  /** The adventure's narrative arc, when the caller resolved one. Prose from Forge's catalog. */
  adventureNarrativeArc?: string;
  topic: {
    concept: string;
    learningObjective: string;
    keyVocabulary: string[];
  };
  /** What the bound lesson already taught. A game reinforces; it is never first contact. */
  priorKnowledge?: string;
  /**
   * BLUEPRINT-LEVEL PIN — the twin of Forge's `forced_types`. When present this stage is
   * SKIPPED entirely: no DeepSeek call, no ledger entry, no attempt counter, and the
   * skeleton is derived deterministically from the pin plus the blueprint's tier and
   * difficulty. `author`/`gate`/`simulate`/`judge`/`localize`/`illustrate`/`publish` all
   * still run unchanged downstream, so a pinned run exercises the REAL pipeline for
   * exactly the shape requested — which is what makes exact-coverage QA runs both free
   * and reproducible. An empty pin (`{}`) is meaningful: "derive everything, spend $0".
   *
   * WIRING (not owned by this module): `gameBlueprintSchema` in `src/catalog/schema.ts`
   * needs `plan_pin: planSkeletonPinSchema.optional()`, and `run.ts` passes
   * `blueprint.plan_pin` through as `ctx.pin`. Until that field exists a pin can only be
   * supplied programmatically.
   */
  pin?: PlanSkeletonPin;
}

export interface PlanDeps {
  ledger?: UsageLedger;
  /** Injection seam for tests. Production always uses the `completeDeepSeek` chokepoint,
   *  which is where `checkBudget()` lives. */
  complete?: typeof completeDeepSeek;
}

export interface PlanResult {
  skeleton: PlanSkeleton;
  /** Human-readable log of every deterministic repair applied. Surfaced in telemetry:
   *  a stage that repairs the same rule on every slot is a prompt bug, not a model quirk. */
  fixes: string[];
  /** Corrective attempts spent. 0 for a pinned skeleton — nothing was called. */
  attempts: number;
  /** True when the skeleton came from a pin and no paid call happened. */
  pinned: boolean;
}

/**
 * A blueprint names a mechanic this release cannot look up (unknown id, or declared in
 * the closed set but not yet copied into `src/contract/mechanics/`). Fatal for the slot
 * and deliberately NOT degraded: without the mechanic's schemas there is no shape to
 * plan against, and without its simulator the winnability gate can never run — an
 * ungated game is exactly what that gate exists to prevent.
 */
export class UnknownMechanicError extends Error {
  constructor(
    readonly mechanic: string,
    readonly slug: string,
  ) {
    super(`game "${slug}": mechanic "${mechanic}" is not implemented in this release — cannot plan or bot-gate it`);
    this.name = 'UnknownMechanicError';
  }
}

// ---- Deterministic derivation --------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Position `difficulty` (1..5) inside a band. difficulty 1 → band.min, 5 → band.max. */
function alongBand(band: Band, difficulty: number): number {
  return band.min + Math.round(((band.max - band.min) * (difficulty - 1)) / 4);
}

export function deriveDifficultyCurve(difficulty: number): DifficultyCurve {
  if (difficulty <= 2) return 'gentle';
  if (difficulty === 3) return 'steady';
  return 'steep';
}

/** GAME_ENGINE.md §11 / §2: cheer (no fail state) is the tier-1 default, and at tier 1
 *  it is not a preference — a fail state at that band is the dark pattern §11 forbids. */
export function deriveScoringMode(tier: 1 | 2 | 3): 'cheer' | 'arcade' {
  return tier === 1 ? 'cheer' : 'arcade';
}

export function derivePassScore(difficulty: number): number {
  return clamp(60 + (difficulty - 1) * 5, MIN_PASS_SCORE, MAX_PASS_SCORE);
}

/** Authoring locale is es-MX (the whole pipeline authors there, then localizes), so the
 *  deterministic briefs are Spanish — the same choice Forge made in `buildForcedSkeleton`. */
function derivedRoundBrief(round: number, total: number, curve: DifficultyCurve, microObjective: string): string {
  return `Ronda ${round} de ${total} (ladder ${curve}): la MISMA idea con números más exigentes — ${microObjective}`.slice(
    0,
    MAX_ROUND_BRIEF,
  );
}

// ---- The pin -------------------------------------------------------------------

/**
 * Every field optional: a pin states only what the QA run wants to fix, and everything
 * else is derived from tier + difficulty. `z.strictObject` on purpose — a typo'd key in
 * hand-authored YAML must fail `catalog:check` loudly instead of being silently ignored
 * and then quietly not applied to a run someone believes is pinned.
 */
export const planSkeletonPinSchema = z.strictObject({
  item_count: z.number().int().min(MIN_ITEMS).max(MAX_ITEMS).optional(),
  trap_count: z.number().int().min(0).max(MAX_ITEMS).optional(),
  category_count: z.number().int().min(0).max(MAX_CATEGORIES).optional(),
  round_count: z.number().int().min(MIN_ROUNDS).max(MAX_ROUNDS).optional(),
  difficulty_curve: difficultyCurveEnum.optional(),
  interlude_count: z.number().int().min(0).max(MAX_INTERLUDES).optional(),
  scoring_mode: scoringModeEnum.optional(),
  pass_score: z.number().int().min(MIN_PASS_SCORE).max(MAX_PASS_SCORE).optional(),
  estimated_minutes: z.number().int().min(MIN_MINUTES).max(MAX_MINUTES).optional(),
  design_brief: z.string().min(1).max(MAX_DESIGN_BRIEF).optional(),
  /** One brief per round, in order. Shorter than `round_count` → the rest are derived. */
  round_briefs: z.array(z.string().min(1).max(MAX_ROUND_BRIEF)).max(MAX_ROUNDS).optional(),
});

export type PlanSkeletonPin = z.infer<typeof planSkeletonPinSchema>;

/**
 * QA/authoring override — builds a `PlanSkeleton` with ZERO model calls.
 *
 * Pure and total: same inputs → same skeleton, byte for byte, which is the property that
 * makes a pinned coverage run reproducible. Cross-field coherence (categories vs items,
 * interludes vs rounds, traps vs items) is clamped here rather than left to `planRepair`,
 * because a pin is hand-written and an internally impossible pin should still yield a
 * runnable skeleton instead of a slot that dies in `author`. The PEDAGOGY rules are NOT
 * re-litigated — a pin is a deliberate hand-made skeleton, the same posture Forge's
 * `buildForcedSkeleton` takes toward its MIX RULES.
 */
export function buildPinnedSkeleton(pin: PlanSkeletonPin, blueprint: PlanBlueprintFacts): PlanSkeleton {
  const { tier, difficulty } = blueprint;
  const curve = pin.difficulty_curve ?? deriveDifficultyCurve(difficulty);

  const roundCount = clamp(
    pin.round_count ?? alongBand(TIER_ROUND_BAND[tier], difficulty),
    MIN_ROUNDS,
    MAX_ROUNDS,
  );

  const itemCount = clamp(pin.item_count ?? alongBand(TIER_ITEM_BAND[tier], difficulty), MIN_ITEMS, MAX_ITEMS);
  // A category with fewer than MIN_ITEMS_PER_CATEGORY items discriminates nothing.
  const categoryCount = clamp(
    pin.category_count ?? TIER_CATEGORY_DEFAULT[tier],
    0,
    Math.min(MAX_CATEGORIES, Math.floor(itemCount / MIN_ITEMS_PER_CATEGORY)),
  );

  const trapCount = clamp(
    pin.trap_count ?? Math.max(tier === 1 ? 0 : 1, Math.floor(itemCount / 4)),
    0,
    Math.max(0, itemCount - 1),
  );

  // Playbook rule 11: at most one interlude per two rounds.
  const interludeCount = clamp(
    pin.interlude_count ?? Math.floor(roundCount / 2),
    0,
    Math.min(MAX_INTERLUDES, Math.floor(roundCount / 2)),
  );

  const rounds: PlanRound[] = [];
  for (let index = 0; index < roundCount; index++) {
    const pinnedBrief = pin.round_briefs?.[index];
    rounds.push({
      round: index + 1,
      brief: pinnedBrief ?? derivedRoundBrief(index + 1, roundCount, curve, blueprint.micro_objective),
    });
  }

  return {
    mechanic: blueprint.mechanic,
    item_count: itemCount,
    trap_count: trapCount,
    category_count: categoryCount,
    rounds,
    difficulty_curve: curve,
    interlude_count: interludeCount,
    scoring_mode: pin.scoring_mode ?? deriveScoringMode(tier),
    pass_score: pin.pass_score ?? derivePassScore(difficulty),
    estimated_minutes: clamp(
      pin.estimated_minutes ?? 2 + Math.round((difficulty - 1) / 2),
      MIN_MINUTES,
      MAX_MINUTES,
    ),
    design_brief: (
      pin.design_brief ??
      `Esqueleto FIJADO (QA determinista) para la mecánica "${blueprint.mechanic}", tier ${tier}, dificultad ${difficulty}/5 — ${blueprint.micro_objective}`
    ).slice(0, MAX_DESIGN_BRIEF),
  };
}

// ---- Deterministic repair ------------------------------------------------------

/**
 * PLAN RULES repair — applied BEFORE any corrective LLM attempt is spent, because a
 * count that is one outside a band is a clamp, not a re-generation.
 *
 *  1. `mechanic` is the blueprint's, always. The model confirms it; it never re-picks it.
 *  2. `item_count` inside the tier's item band.
 *  3. `category_count` <= floor(item_count / MIN_ITEMS_PER_CATEGORY), and <= MAX_CATEGORIES.
 *  4. `trap_count` <= item_count - 1 (a document that is all traps teaches nothing).
 *  5. Round count inside the tier's round band; `round` renumbered 1..N contiguously.
 *  6. `interlude_count` <= min(MAX_INTERLUDES, floor(rounds / 2)).
 *  7. `scoring_mode` = 'cheer' at tier 1 (GAME_ENGINE.md §11 — not a preference).
 *  8. `pass_score` inside [MIN_PASS_SCORE, MAX_PASS_SCORE].
 *  9. `estimated_minutes` inside [MIN_MINUTES, MAX_MINUTES].
 *
 * Anything NOT on this list (a lazy `design_brief`, a ladder whose rungs do not actually
 * ramp, a concept that survives the swap test) is deliberately left alone: it is a
 * QUALITY problem, and quality is what the corrective retry, the deterministic `gate`
 * and the paid `judge` are for. Repairing prose here would launder a bad plan into a
 * shaped one and hide the signal.
 */
export function planRepair(
  skeleton: PlanSkeleton,
  blueprint: PlanBlueprintFacts,
): { skeleton: PlanSkeleton; fixes: string[] } {
  const fixes: string[] = [];
  const { tier } = blueprint;

  // Rule 1
  let mechanic = skeleton.mechanic;
  if (mechanic !== blueprint.mechanic) {
    fixes.push(`forced mechanic back to the blueprint's "${blueprint.mechanic}" (model answered "${mechanic}")`);
    mechanic = blueprint.mechanic;
  }

  // Rule 2
  const itemBand = TIER_ITEM_BAND[tier];
  const itemCount = clamp(skeleton.item_count, itemBand.min, itemBand.max);
  if (itemCount !== skeleton.item_count) {
    fixes.push(`clamped item_count ${skeleton.item_count} → ${itemCount} (tier ${tier} band ${itemBand.min}-${itemBand.max})`);
  }

  // Rule 3
  let categoryCount = clamp(skeleton.category_count, 0, MAX_CATEGORIES);
  const categoryCeiling = Math.floor(itemCount / MIN_ITEMS_PER_CATEGORY);
  if (categoryCount > categoryCeiling) {
    fixes.push(
      `reduced category_count ${categoryCount} → ${categoryCeiling} (${itemCount} items give fewer than ${MIN_ITEMS_PER_CATEGORY} per category)`,
    );
    categoryCount = categoryCeiling;
  }

  // Rule 4
  const trapCeiling = Math.max(0, itemCount - 1);
  const trapCount = clamp(skeleton.trap_count, 0, trapCeiling);
  if (trapCount !== skeleton.trap_count) {
    fixes.push(`clamped trap_count ${skeleton.trap_count} → ${trapCount} (at most ${trapCeiling} of ${itemCount} items may be traps)`);
  }

  // Rule 5 — count into the band, then renumber contiguously from 1.
  const roundBand = TIER_ROUND_BAND[tier];
  const curve = skeleton.difficulty_curve;
  const targetRounds = clamp(skeleton.rounds.length, roundBand.min, roundBand.max);
  const rounds: PlanRound[] = skeleton.rounds.slice(0, targetRounds).map((round, index) => ({
    round: index + 1,
    brief: round.brief,
  }));
  if (skeleton.rounds.length > targetRounds) {
    fixes.push(`dropped ${skeleton.rounds.length - targetRounds} round(s) beyond the tier ${tier} ceiling of ${roundBand.max}`);
  }
  while (rounds.length < targetRounds) {
    const roundNumber = rounds.length + 1;
    rounds.push({
      round: roundNumber,
      brief: derivedRoundBrief(roundNumber, targetRounds, curve, blueprint.micro_objective),
    });
    fixes.push(`appended round ${roundNumber} to reach the tier ${tier} floor of ${roundBand.min}`);
  }
  const renumbered = skeleton.rounds
    .slice(0, targetRounds)
    .some((round, index) => round.round !== index + 1);
  if (renumbered) fixes.push('renumbered rounds contiguously from 1');

  // Rule 6
  const interludeCeiling = Math.min(MAX_INTERLUDES, Math.floor(rounds.length / 2));
  const interludeCount = clamp(skeleton.interlude_count, 0, interludeCeiling);
  if (interludeCount !== skeleton.interlude_count) {
    fixes.push(
      `clamped interlude_count ${skeleton.interlude_count} → ${interludeCount} (at most one per two rounds, hard cap ${MAX_INTERLUDES})`,
    );
  }

  // Rule 7
  let scoringMode = skeleton.scoring_mode;
  if (tier === 1 && scoringMode !== 'cheer') {
    fixes.push('forced scoring_mode to "cheer" — tier 1 has no fail state (GAME_ENGINE.md §11)');
    scoringMode = 'cheer';
  }

  // Rule 8
  const passScore = clamp(skeleton.pass_score, MIN_PASS_SCORE, MAX_PASS_SCORE);
  if (passScore !== skeleton.pass_score) {
    fixes.push(`clamped pass_score ${skeleton.pass_score} → ${passScore} (fair band ${MIN_PASS_SCORE}-${MAX_PASS_SCORE})`);
  }

  // Rule 9
  const minutes = clamp(skeleton.estimated_minutes, MIN_MINUTES, MAX_MINUTES);
  if (minutes !== skeleton.estimated_minutes) {
    fixes.push(`clamped estimated_minutes ${skeleton.estimated_minutes} → ${minutes} (one session, one idea)`);
  }

  return {
    skeleton: {
      mechanic,
      item_count: itemCount,
      trap_count: trapCount,
      category_count: categoryCount,
      rounds,
      difficulty_curve: curve,
      interlude_count: interludeCount,
      scoring_mode: scoringMode,
      pass_score: passScore,
      estimated_minutes: minutes,
      design_brief: skeleton.design_brief,
    },
    fixes,
  };
}

// ---- Prompt assembly -----------------------------------------------------------

const PLAN_SYSTEM =
  'You are Arcade, the game-planning stage of a financial-literacy platform for children (LittleFounders). ' +
  'You output ONLY strict JSON matching the requested shape — no prose, no markdown fences. ' +
  'You plan the SKELETON of a minigame manifest: counts, the difficulty ladder and the scoring posture. ' +
  'A later stage authors every label, category, prompt and feedback line — you author none of them.';

/**
 * FROZEN. Always-true rules only, fixed numbering: a conditional spliced in here would
 * renumber every following line and destroy the shared prefix for the rest of the run.
 * Per-blueprint conditionals go in `buildDirectives` instead.
 */
const PLAN_RULES = [
  'Answer with a single JSON object in the SKELETON SHAPE below. No other keys, no commentary.',
  '`mechanic` MUST be exactly the mechanic named in the GAME BRIEF. You CONFIRM the choice; you never re-pick it — the shape example above is the only config surface that exists for this game.',
  'You plan COUNTS AND SHAPE ONLY. Never write an item label, a category name, an interlude question or a feedback line: `item_count`, `category_count` and `trap_count` are NUMBERS, and the author stage writes the content behind them.',
  'Respect the ITEM and ROUND bands stated in the GAME BRIEF for this tier. Every category needs at least 2 items to discriminate anything, so `category_count` never exceeds `item_count / 2`. A mechanic whose config has no notion of categories takes `category_count: 0`.',
  '`trap_count` counts the items that will carry a specific kid misconception. At least 1, at most `item_count - 1`: an item nobody would pick diagnoses nothing, and a document that is all traps teaches nothing.',
  '`rounds` IS THE DIFFICULTY LADDER: the same idea with harder numbers. Each `brief` names WHICH CONFIG NUMBER CHANGES at that rung (spawn interval, speed, simultaneous elements, included item tiers, budget, tolerance, target) — never a new idea, never a new concept, never content.',
  '`interlude_count` is at most one per two rounds and never more than 4. Zero is a perfectly good answer; an interlude must earn its interruption by asking about the SAME concept.',
  '`pass_score` must sit between 50 and 90: below 50 a player who mashes passes and the XP is free, above 90 there is no margin for a child who plays well but not perfectly. A free deterministic bot gate checks both edges before this game can be published.',
  '`estimated_minutes` is 2-5 and the document covers exactly ONE concept. Rounds vary the DIFFICULTY of that idea, never the idea.',
  '`difficulty_curve` is one of "gentle" | "steady" | "steep" and must match how sharply the round briefs ramp.',
  '`design_brief` is ONE paragraph for the author stage: what the player physically MANIPULATES, and why that verb IS the concept. Apply the swap test — if replacing every label with "cosa A / cosa B / cosa C" leaves the game playable, the plan is a reskin and must be redesigned before you answer.',
] as const;

const SKELETON_SHAPE = JSON.stringify(
  {
    mechanic: '<mechanic id from the GAME BRIEF>',
    item_count: 0,
    trap_count: 0,
    category_count: 0,
    rounds: [{ round: 1, brief: '<which config number changes at this rung>' }],
    difficulty_curve: 'gentle | steady | steep',
    interlude_count: 0,
    scoring_mode: 'cheer | arcade',
    pass_score: 0,
    estimated_minutes: 0,
    design_brief: '<what the player manipulates and why that verb IS the concept>',
  },
  null,
  2,
);

/** Unnumbered on purpose — see the module header. Same force as the numbered rules. */
function buildDirectives(blueprint: PlanBlueprintFacts): string[] {
  const directives: string[] = [];
  if (blueprint.tier === 1) {
    directives.push(
      'TIER 1: `scoring_mode` MUST be "cheer" — no lives, no fail state, nothing lost. At this band a fail state is a dark pattern, not a challenge.',
    );
  } else {
    directives.push(
      '`scoring_mode` "arcade" (lives) is viable at this tier, but the ladder still has to be the source of difficulty.',
    );
  }
  if (blueprint.difficulty <= 2) {
    directives.push(
      `DIFFICULTY ${blueprint.difficulty}/5: sit at the BOTTOM of the tier bands with a "gentle" curve. Fewer, clearer rounds beat more rounds of the same easy idea.`,
    );
  } else if (blueprint.difficulty >= 4) {
    directives.push(
      `DIFFICULTY ${blueprint.difficulty}/5: sit near the TOP of the tier bands with a "steep" curve — but the ramp comes from the config numbers, never from ambiguity, hidden information or unreadable speed.`,
    );
  }
  return directives;
}

interface MechanicShape {
  config: unknown;
  content: unknown;
  spriteSlots: readonly string[];
}

export function buildPlanMessages(
  blueprint: GameBlueprint,
  ctx: PlanContext,
  shape: MechanicShape,
  issues: string | undefined,
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const itemBand = TIER_ITEM_BAND[blueprint.tier];
  const roundBand = TIER_ROUND_BAND[blueprint.tier];

  // STATIC-FIRST. Blocks are ordered most-stable → least-stable across a run:
  // mechanic shape (per mechanic) → frozen rules + skeleton shape (byte-constant) →
  // tier guidance (per tier) → directives (per blueprint) → the brief (per blueprint).
  const head = [
    `MECHANIC "${blueprint.mechanic}" — the config surface you are planning INTO (field names and nesting only; values are placeholders):`,
    JSON.stringify(shape.config, null, 2),
    '',
    'Its content surface (the author stage fills this; you size it):',
    JSON.stringify(shape.content, null, 2),
    '',
    `Declared sprite slots for this mechanic: ${shape.spriteSlots.join(', ') || '(none)'}`,
    '',
    'PLAN RULES:',
    PLAN_RULES.map((line, index) => `${index + 1}. ${line}`).join('\n'),
    '',
    'SKELETON SHAPE (answer with exactly this object):',
    SKELETON_SHAPE,
    '',
    'AGE TIER GUIDANCE:',
    tierReasoningGuidance(blueprint.tier),
  ].join('\n');

  const directives = buildDirectives(blueprint);
  const directivesBlock =
    directives.length > 0
      ? ['', 'GAME DIRECTIVES (non-negotiable for THIS game, same force as the plan rules):', ...directives.map((d) => `- ${d}`)].join('\n')
      : '';

  // §1.9: curriculum and contract only — no child data reaches this block, ever.
  const brief = [
    `Course: ${ctx.courseTitle}`,
    ctx.adventureNarrativeArc ? `Adventure arc: ${ctx.adventureNarrativeArc}` : undefined,
    `Bound topic: ${blueprint.topic_path}`,
    `Topic concept: ${ctx.topic.concept}`,
    `Learning objective: ${ctx.topic.learningObjective}`,
    `Key vocabulary: ${ctx.topic.keyVocabulary.join(', ') || '(none specified)'}`,
    ctx.priorKnowledge ? `Already taught by the bound lesson: ${ctx.priorKnowledge}` : undefined,
    `Game micro-objective (the ONE thing this game consolidates): ${blueprint.micro_objective}`,
    `Skin brief (setting/props direction for the art stage): ${blueprint.skin_brief}`,
    `Mechanic: ${blueprint.mechanic}`,
    `Age tier: ${blueprint.tier}`,
    `Target difficulty: ${blueprint.difficulty}/5`,
    `Item band for this tier: ${itemBand.min}-${itemBand.max} items`,
    `Round band for this tier: ${roundBand.min}-${roundBand.max} rounds`,
  ].filter((line): line is string => typeof line === 'string');

  const user = [head, directivesBlock, '', 'GAME BRIEF:', brief.join('\n')].join('\n');

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: PLAN_SYSTEM },
    { role: 'user', content: user },
  ];

  // APPENDED, never spliced: attempts 2..N re-send an identical leading prompt, so the
  // provider's automatic prefix cache still hits (gamegen/AGENTS.md).
  if (issues) {
    messages.push({
      role: 'user',
      content: `Your previous JSON was invalid. Fix these issues and resend the FULL corrected JSON:\n${issues}`,
    });
  }

  return messages;
}

// ---- The stage -----------------------------------------------------------------

/**
 * PAID (DeepSeek) unless `ctx.pin` is present.
 *
 * No `try`/`catch` anywhere in this function, deliberately. `completeDeepSeek` runs
 * `ledger.checkBudget()` before the call and throws `BudgetExceededError`, and throws
 * `ProviderNotConfiguredError` with no key: both MUST propagate out of the stage so
 * `run.ts` can stop scheduling. A kill switch only exists if the error escapes
 * (gamegen/AGENTS.md — Forge's `illustrateSegments` swallowed exactly this and kept
 * paying past its own cap).
 */
export async function planGame(
  blueprint: GameBlueprint,
  ctx: PlanContext,
  deps: PlanDeps = {},
): Promise<PlanResult> {
  if (ctx.pin) {
    return { skeleton: buildPinnedSkeleton(ctx.pin, blueprint), fixes: [], attempts: 0, pinned: true };
  }

  const shape = mechanicShapeExample(blueprint.mechanic);
  if (shape === null) throw new UnknownMechanicError(blueprint.mechanic, blueprint.slug);

  const complete = deps.complete ?? completeDeepSeek;

  const { data, attempts } = await withCorrectiveRetry<PlanSkeleton>({
    maxAttempts: MAX_PLAN_ATTEMPTS,
    callModel: async (issues) => {
      const messages = buildPlanMessages(blueprint, ctx, shape, issues);
      const result = await complete(
        { messages, temperature: 0.3, jsonMode: true },
        { operation: 'plan', ledger: deps.ledger },
      );
      return result.content;
    },
    parse: (raw) => {
      const json = safeJsonParse(raw);
      if (!json.ok) return { ok: false, issues: `invalid JSON: ${json.error}` };
      const parsed = planSkeletonSchema.safeParse(json.value);
      if (!parsed.success) return { ok: false, issues: formatZodIssues(parsed.error.issues) };
      return { ok: true, data: parsed.data };
    },
  });

  const { skeleton, fixes } = planRepair(data, blueprint);
  return { skeleton, fixes, attempts, pinned: false };
}
