import { query } from '../db/duckdb.js';
import {
  GAME_FUNNEL_STEPS,
  gameBreakdownQuery,
  gameCompletionQuery,
  gameDimensionProbeQuery,
  gameFunnelQuery,
  gamesVsLessonsQuery,
  resolveGameDimension,
} from '../db/queries.js';
import type {
  GameBreakdownDimension,
  GameFunnelStep,
} from '../db/queries.js';

/*
 * The Arcade analytics service — the layer the game query builders in
 * `db/queries.ts` were missing. Without it those builders had no importer
 * outside their own test file, so `game_open`/`game_start`/`game_complete`
 * were captured by Insights and then unreachable by any caller.
 *
 * Two rules from `dataintel/AGENTS.md` are load-bearing here and are why this
 * file looks the way it does:
 *
 * 1. A caller-supplied string is NEVER interpolated as a SQL column name. The
 *    only dimension text that reaches SQL comes out of
 *    `resolveGameDimension()`'s allowlist, and the route Zod-restricts the
 *    input to that same closed set before we are even called.
 * 2. A SQL LIMIT is only ever applied when the ordering key is a real SQL
 *    column. `gameBreakdownQuery` ranks by `starts`, computed in its `rolled`
 *    CTE before the limit — so this service deliberately does NOT re-rank or
 *    compute any post-hoc score over the truncated rows. Adding one here
 *    would silently reintroduce the churn-query defect (a limit applied
 *    before the value it is ranked by exists). If a derived score is ever
 *    needed, the LIMIT must move out of SQL first, exactly as churn's did.
 */

// ── Row accessors ────────────────────────────────────────────────────
//
// §1.14 "failure must be distinguishable from emptiness", applied to reads:
// a SQL NULL from an aggregate genuinely means "no rows matched", but a key
// that is ABSENT from the row means the query and this mapper disagree about
// the column set. The first is a zero; the second is a contract break and
// must surface as a failure (`null` from the service, 502 at the edge), never
// as a fabricated zero on an analytics dashboard.

function requireCell(row: Record<string, unknown>, key: string): unknown {
  if (!(key in row)) {
    throw new Error(`[dataintel][games] result row is missing column '${key}'`);
  }
  return row[key];
}

/** An aggregate count. SQL NULL (no rows matched) → 0. */
function countCol(row: Record<string, unknown>, key: string): number {
  const value = requireCell(row, key);
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(
      `[dataintel][games] column '${key}' is not a finite number: ${String(value)}`,
    );
  }
  return n;
}

/**
 * A ratio or average. SQL NULL stays `null`: every one of these is guarded by
 * `NULLIF(..., 0)` in the SQL, so NULL means "undefined — there was nothing to
 * divide by". "0% of plays were completed" and "no plays happened at all" are
 * different facts and must not collapse into the same number.
 */
function rateCol(row: Record<string, unknown>, key: string): number | null {
  const value = requireCell(row, key);
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(
      `[dataintel][games] column '${key}' is not a finite number: ${String(value)}`,
    );
  }
  return n;
}

function textCol(row: Record<string, unknown>, key: string): string {
  const value = requireCell(row, key);
  if (value === null || value === undefined) {
    throw new Error(`[dataintel][games] column '${key}' is unexpectedly NULL`);
  }
  return String(value);
}

// ── Funnel ───────────────────────────────────────────────────────────

export interface GameFunnelEntry {
  step: GameFunnelStep;
  stepOrder: number;
  users: number;
  pctOfTop: number | null;
  pctOfPrevious: number | null;
}

/**
 * game_open → game_start → game_complete, in distinct users, ordered.
 *
 * The step order comes from the exported `GAME_FUNNEL_STEPS` constant rather
 * than from the row order DuckDB happens to return, and a missing step is
 * treated as a contract break (→ `null`) instead of being dropped: a funnel
 * silently rendered with two of its three steps reads as a complete funnel.
 */
export async function getGameFunnel(
  windowDays: number,
): Promise<GameFunnelEntry[] | null> {
  try {
    const { sql, params } = gameFunnelQuery(windowDays);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    const byStep = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      byStep.set(textCol(row, 'step'), row);
    }

    return GAME_FUNNEL_STEPS.map((step, index) => {
      const row = byStep.get(step);
      if (!row) {
        throw new Error(
          `[dataintel][games] funnel returned no row for step '${step}'`,
        );
      }
      return {
        step,
        stepOrder: index + 1,
        users: countCol(row, 'users'),
        pctOfTop: rateCol(row, 'pct_of_top'),
        pctOfPrevious: rateCol(row, 'pct_of_previous'),
      };
    });
  } catch (err) {
    console.error('[dataintel][games] getGameFunnel failed:', err);
    return null;
  }
}

// ── Completion / abandonment ─────────────────────────────────────────

export interface GameCompletionSummary {
  starts: number;
  completes: number;
  players: number;
  finishers: number;
  abandons: number;
  completionPct: number | null;
  abandonmentPct: number | null;
  avgCompletedValue: number | null;
}

/** Play-level completion for the games surface over the last `days` days. */
export async function getGameCompletion(
  days: number,
): Promise<GameCompletionSummary | null> {
  try {
    const { sql, params } = gameCompletionQuery(days);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    // The query is an ungrouped aggregate: exactly one row, always. Anything
    // else means the SQL changed shape under us.
    const row = rows[0];
    if (rows.length !== 1 || !row) {
      throw new Error(
        `[dataintel][games] completion query returned ${String(rows.length)} rows, expected 1`,
      );
    }

    return {
      starts: countCol(row, 'starts'),
      completes: countCol(row, 'completes'),
      players: countCol(row, 'players'),
      finishers: countCol(row, 'finishers'),
      abandons: countCol(row, 'abandons'),
      completionPct: rateCol(row, 'completion_pct'),
      abandonmentPct: rateCol(row, 'abandonment_pct'),
      avgCompletedValue: rateCol(row, 'avg_completed_value'),
    };
  } catch (err) {
    console.error('[dataintel][games] getGameCompletion failed:', err);
    return null;
  }
}

// ── Games vs lessons ─────────────────────────────────────────────────

export const GAME_SURFACES = ['games', 'lessons'] as const;
export type GameSurface = (typeof GAME_SURFACES)[number];

export interface SurfaceEngagement {
  surface: GameSurface;
  starts: number;
  completes: number;
  players: number;
  reach: number;
  sessions: number;
  activeDays: number;
  completionPct: number | null;
  startsPerPlayer: number | null;
  avgCompletedValue: number | null;
}

function isGameSurface(value: string): value is GameSurface {
  return (GAME_SURFACES as readonly string[]).includes(value);
}

/**
 * One row per surface. A surface with no events in the window is simply
 * ABSENT — it is not synthesised as a row of zeros, because "nobody played a
 * game this week" and "we have no game telemetry at all" are different
 * findings and the caller must be able to tell them apart.
 *
 * The two surfaces are never summed: a game reinforces a lesson concept, so
 * adding them double-counts one learning act (GAME_ENGINE §7 — games
 * deliberately do not touch `lessons_completed`).
 */
export async function getGamesVsLessons(
  days: number,
): Promise<SurfaceEngagement[] | null> {
  try {
    const { sql, params } = gamesVsLessonsQuery(days);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    return rows.map((row) => {
      const surface = textCol(row, 'surface');
      if (!isGameSurface(surface)) {
        throw new Error(
          `[dataintel][games] unexpected surface '${surface}' — the CASE arms and this mapper disagree`,
        );
      }
      return {
        surface,
        starts: countCol(row, 'starts'),
        completes: countCol(row, 'completes'),
        players: countCol(row, 'players'),
        reach: countCol(row, 'reach'),
        sessions: countCol(row, 'sessions'),
        activeDays: countCol(row, 'active_days'),
        completionPct: rateCol(row, 'completion_pct'),
        startsPerPlayer: rateCol(row, 'starts_per_player'),
        avgCompletedValue: rateCol(row, 'avg_completed_value'),
      };
    });
  } catch (err) {
    console.error('[dataintel][games] getGamesVsLessons failed:', err);
    return null;
  }
}

// ── Capability probe + breakdown ─────────────────────────────────────

/**
 * Maps a requirement named by `resolveGameDimension(...).requires` to the
 * boolean column `gameDimensionProbeQuery()` reports it under. If the query
 * layer ever declares a requirement that is absent from this map we throw
 * rather than assume it is satisfied — assuming would ship exactly the opaque
 * "column does not exist" 502 the capability gate exists to prevent.
 */
const CAPABILITY_PROBE_COLUMN: Readonly<Record<string, string>> = Object.freeze({
  'fact_events.game_id': 'has_game_id',
  'dim_games.mechanic': 'has_dim_games_mechanic',
});

export interface GameDimensionCapabilities {
  hasGameId: boolean;
  hasDimGamesMechanic: boolean;
}

async function probeCapabilities(): Promise<Record<string, boolean>> {
  const { sql, params } = gameDimensionProbeQuery();
  const rows = await query<Record<string, unknown>>(sql, ...params);
  const row = rows[0];
  if (!row) {
    throw new Error('[dataintel][games] dimension probe returned no row');
  }

  const flags: Record<string, boolean> = {};
  for (const column of Object.values(CAPABILITY_PROBE_COLUMN)) {
    flags[column] = requireCell(row, column) === true;
  }
  return flags;
}

/**
 * Whether the warehouse currently carries the game dimension at all. Callers
 * (the admin console) use this to decide whether to offer the breakdown view
 * instead of rendering a tab that can only answer "not available".
 */
export async function getGameDimensionCapabilities(): Promise<GameDimensionCapabilities | null> {
  try {
    const flags = await probeCapabilities();
    return {
      hasGameId: flags.has_game_id === true,
      hasDimGamesMechanic: flags.has_dim_games_mechanic === true,
    };
  } catch (err) {
    console.error(
      '[dataintel][games] getGameDimensionCapabilities failed:',
      err,
    );
    return null;
  }
}

export interface GameBreakdownEntry {
  dimensionKey: string;
  starts: number;
  completes: number;
  players: number;
  abandons: number;
  completionPct: number | null;
  abandonmentPct: number | null;
  avgCompletedValue: number | null;
}

export type GameBreakdownResult =
  | {
      available: true;
      dimension: GameBreakdownDimension;
      rows: GameBreakdownEntry[];
    }
  | {
      available: false;
      dimension: GameBreakdownDimension;
      /** The warehouse objects this dimension needs and does not have yet. */
      missing: string[];
    };

/**
 * Per-game or per-mechanic starts/completes/abandonment.
 *
 * CAPABILITY-GATED on purpose. `db/schema.sql` does not declare
 * `fact_events.game_id` and there is no `dim_games` table yet (migration 0028
 * added `learning_events.game_id` in Vault, but `dataintel_events_sync` does
 * not select it and `db/sync.ts#mapEventRow` does not map it). Running the
 * breakdown SQL against a warehouse without those objects would fail as an
 * opaque 502 for every caller, so we probe first and return an honest
 * `available: false` naming exactly what is missing — never a broken query,
 * and never a fabricated zero.
 */
export async function getGameBreakdown(
  dimension: GameBreakdownDimension,
  limit: number,
): Promise<GameBreakdownResult | null> {
  try {
    // Throws UnsupportedGameDimensionError on anything outside the allowlist.
    // The route already Zod-restricts `dimension` to the same closed set; this
    // is the defence-in-depth twin, and it is what guarantees no caller text
    // ever reaches the SQL string.
    const { requires } = resolveGameDimension(dimension);
    const flags = await probeCapabilities();

    const missing: string[] = [];
    for (const requirement of requires) {
      const probeColumn = CAPABILITY_PROBE_COLUMN[requirement];
      if (probeColumn === undefined) {
        throw new Error(
          `[dataintel][games] dimension '${dimension}' requires '${requirement}', which the capability probe cannot check`,
        );
      }
      if (flags[probeColumn] !== true) {
        missing.push(requirement);
      }
    }

    if (missing.length > 0) {
      return { available: false, dimension, missing };
    }

    const { sql, params } = gameBreakdownQuery(dimension, limit);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    // Row order is the SQL's (starts DESC, dimension_key) and is preserved
    // verbatim — see the LIMIT note at the top of this file.
    return {
      available: true,
      dimension,
      rows: rows.map((row) => ({
        dimensionKey: textCol(row, 'dimension_key'),
        starts: countCol(row, 'starts'),
        completes: countCol(row, 'completes'),
        players: countCol(row, 'players'),
        abandons: countCol(row, 'abandons'),
        completionPct: rateCol(row, 'completion_pct'),
        abandonmentPct: rateCol(row, 'abandonment_pct'),
        avgCompletedValue: rateCol(row, 'avg_completed_value'),
      })),
    };
  } catch (err) {
    console.error('[dataintel][games] getGameBreakdown failed:', err);
    return null;
  }
}
