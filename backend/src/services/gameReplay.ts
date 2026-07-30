import { TICK_MS, type GameInputEvent } from '../game-contract/core/types.js';
import { replayGame, type ReplayRejectionReason } from '../game-contract/core/replay.js';
import { clampScore } from '../game-contract/core/scoring.js';
import { getMechanic } from '../game-contract/registry.js';
import { maxTicksFor, parseStoredGameDocument, parseValidationSidecar, type DocumentRejectionReason } from './gameDocument.js';

/*
 * The reward derivation — GAME_ENGINE.md §6.
 *
 * THE ONE RULE: the client's score is a CLAIM, this module's replay is the GRANT.
 * The request body carries no score at all, so there is nothing to inflate; what
 * it carries is the input log, which Core re-runs through the exact simulator the
 * browser ran. A replay violation, an out-of-bounds result or an implausible
 * duration returns a REFUSAL — never a partial reward, never a fallback to a
 * client number.
 *
 * Pure and I/O-free on purpose: the whole reward path is decidable from four
 * values (the stored document, the stored sidecar, the log, the duration), which
 * is what makes "a forged log earns nothing" a unit test rather than a claim.
 */

/** Every way a completion can be refused. Stable strings, logged verbatim and safe
 *  to return in a `422 RESULT_REJECTED` body: each names a structural property of
 *  the SUBMISSION or the CONTENT and leaks none of the sidecar's numbers. */
export type GameRejectionReason =
  | DocumentRejectionReason
  | ReplayRejectionReason
  | 'duration_below_minimum'
  | 'duration_shorter_than_play'
  | 'score_above_max';

export interface DerivedGameResult {
  /** 0..100, entirely server-derived. */
  score: number;
  passed: boolean;
  /** XP this run would be worth (the persisted grant is the high-water delta). */
  xpEarned: number;
  /** DERIVED AGGREGATES only — what `game_attempts.stats` may hold. */
  stats: Record<string, number>;
  /** Minutes to add to `learning_stats.minutes_learned`. */
  minutesDelta: number;
}

export type GameResultOutcome = { ok: true; result: DerivedGameResult } | { ok: false; reason: GameRejectionReason };

export interface DeriveGameResultArgs {
  /** `game_documents.document` (jsonb, client-safe). */
  rawDocument: unknown;
  /** `game_documents.validation` (jsonb, SERVER-ONLY). */
  rawValidation: unknown;
  /** `games.mechanic` — the column that selects the simulator. */
  mechanic: string;
  /** `games.xp_max` — the DB-constrained (5..50) ceiling on this game's payout. */
  rowXpMax: number;
  seed: number;
  inputLog: readonly GameInputEvent[];
  durationSeconds: number;
}

/**
 * Wall-clock slack, in seconds, allowed between the log's own span and the reported
 * duration. A run cannot take LESS real time than the ticks it played, but the
 * client's timer starts and stops around the loop rather than inside it, so a small
 * honest gap is normal — only an implausible one is a refusal.
 */
const DURATION_TOLERANCE_SECONDS = 3;

/**
 * How many times `estimated_minutes` may be credited to `minutes_learned` from a
 * single run. A tab left open on the pause overlay is honest behaviour, not
 * cheating, so it is CLAMPED rather than rejected — but "learning minutes" has to
 * mean minutes spent learning, and an uncapped wall clock would let one 3-minute
 * game report two hours.
 */
const MINUTES_CREDIT_SLACK = 4;

/** Keys a simulator may contribute to `game_attempts.stats`. */
const STAT_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_STAT_KEYS = 40;

/**
 * Derived aggregates, defensively normalized: sorted keys (deterministic row
 * content), snake_case names only, finite numbers only, two decimals, capped
 * count. A simulator is trusted code, but this jsonb is written to a child's
 * record on every play — bounding it costs nothing.
 */
export function derivedStats(stats: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(stats).sort()) {
    if (Object.keys(out).length >= MAX_STAT_KEYS) break;
    if (!STAT_KEY_RE.test(key)) continue;
    const value = stats[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[key] = Math.round(value * 100) / 100;
  }
  return out;
}

/** The last tick the player actually reached, or 0 for an empty log. */
function lastTick(inputLog: readonly GameInputEvent[]): number {
  const last = inputLog[inputLog.length - 1];
  return last === undefined ? 0 : last.tick;
}

/** Replay one submitted run and derive everything the reward path needs from it. */
export function deriveGameResult(args: DeriveGameResultArgs): GameResultOutcome {
  const parsed = parseStoredGameDocument(args.rawDocument, args.mechanic);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  const { document } = parsed;

  // Both the mechanic and its parse succeeded above, so the slice exists; this
  // second lookup keeps the simulator handle without widening parseStoredGameDocument's
  // return shape into the render-free registry.
  const slice = getMechanic(args.mechanic);
  if (slice === null) return { ok: false, reason: 'mechanic_unsupported' };

  const maxTicks = maxTicksFor(document);
  const validation = parseValidationSidecar(args.rawValidation, maxTicks);

  if (args.durationSeconds < validation.min_duration_seconds) {
    return { ok: false, reason: 'duration_below_minimum' };
  }
  const playedSeconds = (lastTick(args.inputLog) * TICK_MS) / 1000;
  if (args.durationSeconds + DURATION_TOLERANCE_SECONDS < playedSeconds) {
    return { ok: false, reason: 'duration_shorter_than_play' };
  }

  const outcome = replayGame({
    simulator: slice.simulator,
    document,
    seed: args.seed,
    inputLog: args.inputLog,
    maxTicks,
    maxEvents: validation.max_events,
  });
  if (!outcome.ok) return { ok: false, reason: outcome.reason };

  const score = clampScore(outcome.result.score);
  if (score > validation.max_score) return { ok: false, reason: 'score_above_max' };

  // The DB column (CHECK 5..50) bounds the document's own figure: a manifest is
  // generated content, the row is the published contract.
  const xpMax = Math.max(0, Math.min(args.rowXpMax, document.scoring.xp_max));
  const xpEarned = Math.min(xpMax, Math.round((score / 100) * xpMax));

  const creditedSeconds = Math.min(args.durationSeconds, document.meta.estimated_minutes * 60 * MINUTES_CREDIT_SLACK);
  const minutesDelta = Math.max(1, Math.round(creditedSeconds / 60));

  return {
    ok: true,
    result: {
      score,
      passed: score >= document.scoring.pass_score,
      xpEarned,
      stats: derivedStats(outcome.result.stats),
      minutesDelta,
    },
  };
}
