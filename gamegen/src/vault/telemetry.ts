// Durable generation telemetry → Vault (migration 0017: `generation_runs` /
// `generation_slots`). Port of `coursegen/src/vault/telemetry.ts`; the design is
// inherited from Forge, which is battle-tested against real paid runs, not
// re-derived here (gamegen/AGENTS.md "Read before touching").
//
// This is the permanent "registro" of how an Arcade run behaved: per-slot
// outcomes, the stage a slot failed from, the judge rubric, revise cycles, cost
// and cache-hit share. It is the raw material for the admin Generation dashboard
// (Core `/api/v1/admin/generation/*`), and it is what a run dir alone cannot
// provide — `runs/` is a gitignored local directory on whatever machine the
// operator ran the generation from.
//
// Service-role-only posture (RLS enabled, ZERO client policies — 0017): the
// browser never reads these tables, Core does, holding the service key and
// gating on admin/superadmin.
//
// ────────────────────────────────────────────────────────────────────────────
// SHARED TABLES WITH FORGE — THE TWO MARKERS THAT KEEP THE RUNS DISJOINT
// (/GAME_ENGINE.md §9 "Telemetry & CI"):
//
//  1. `run_id` is namespaced `games-<courseSlug>-<ISO8601>` (`gameRunId()`).
//     `generation_runs.run_id` is a TEXT PRIMARY KEY shared with Forge, so an
//     un-namespaced id could collide with a lesson run of the same course and
//     silently OVERWRITE it — the same course slug feeds both pipelines by
//     design, since a game binds to a topic of that very course.
//  2. `params.kind = 'games'`, forced by this module rather than trusted from
//     the caller. It is the marker the admin dashboard filters on so game runs
//     never enter lesson cost and quality trends.
//
// THE RUBRIC SHAPE DIFFERS FROM THE LESSON ONE — read this before aggregating.
// `generation_slots.rubric` is one jsonb column serving both pipelines. A lesson
// rubric carries Forge's dimensions; an Arcade rubric carries the GAME
// dimensions pinned by /GAME_ENGINE.md §9: `concept_fit`, `fun_agency`,
// `clarity`, `kid_safety`, `difficulty_fairness` (+ `notes`). They are NOT the
// same set and are not comparable. A consumer that averages "the rubric
// dimensions" across both kinds is averaging two different instruments. To make
// that detectable without a join, every row this module writes carries
// `rubric_kind: 'game'` inside the jsonb; readers that iterate a FIXED dimension
// list and keep only `typeof v === 'number'` (which is what Core's
// `adminData.ts` does today) are unaffected by the extra string keys.
//
// TELEMETRY, NEVER CONTROL FLOW: every ingest failure is swallowed to a warning
// — a paid run must never die because the scoreboard was unreachable — and a
// dry run is NEVER ingested, because nothing was spent and there is nothing to
// evaluate.
// ────────────────────────────────────────────────────────────────────────────

import { getConfig } from '../env.js';
import { GameRubricLog } from '../pipeline/judge.js';
import { vaultUpsert } from './client.js';

/** Errors are truncated before they reach the column — a stack dump is not a datum. */
const ERROR_TRUNCATE = 600;

/** The value written into `generation_runs.params.kind` for every Arcade run. */
export const GAME_TELEMETRY_KIND = 'games';

/** The `run_id` prefix that identifies an Arcade run in the shared telemetry tables. */
export const GAME_RUN_ID_PREFIX = 'games-';

/**
 * `games-<courseSlug>-<ISO8601>` — the namespaced run id (/GAME_ENGINE.md §9).
 *
 * `:` and `.` are replaced with `-` for the same reason Forge does it: the run id
 * is also the run DIRECTORY name (`runs/<run-id>/ledger.jsonl`, `rubrics.jsonl`,
 * the checkpoint), and a colon is not portable in a path.
 */
export function gameRunId(courseSlug: string, at: Date = new Date()): string {
  return `${GAME_RUN_ID_PREFIX}${courseSlug}-${at.toISOString().replace(/[:.]/g, '-')}`;
}

function telemetryConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * The ledger/summary fields this module writes into scalar columns. Declared
 * structurally rather than imported from `pipeline/run.ts` (a file this module
 * does not own): a richer `RunSummary` is assignable to it, and the FULL object
 * — every extra field included — is what lands in the `summary` jsonb column.
 */
export interface GameRunSummaryTelemetry {
  tokensUsed: number;
  usdUsed: number;
  cachedTokens: number;
  imagesGenerated: number;
  imagesBilled: number;
}

/** Per-slot outcome fields that map onto `generation_slots` columns. */
export interface GameSlotOutcomeTelemetry {
  slotId: string;
  /**
   * `already-published` = finished by an EARLIER invocation. Filtered out below,
   * never written.
   */
  state: 'published' | 'already-published' | 'failed' | 'skipped' | 'dry-run';
  /** The checkpoint state the slot held when it failed — the failure-heatmap datum. */
  failedFrom?: string;
  error?: string;
  imagesGenerated?: number;
  imagesBilled?: number;
  imagesInherited?: number;
  /** Wall-clock this invocation spent on the slot, all outer attempts included. */
  durationMs?: number;
}

export interface GameRunTelemetryInput {
  /** MUST come from `gameRunId()` — see the namespacing note in the header. */
  runId: string;
  /** Set when this run is a shard of a multi-course invocation (`generate:full`). */
  trackId?: string;
  courseSlug: string;
  /** Shared-column parity with Forge; Arcade has no register concept, so 'kid'. */
  register?: string;
  /**
   * The run parameters, whatever shape `run.ts` gives them. `unknown` on purpose:
   * this module refuses to constrain a contract it does not own, and it forces
   * `kind: 'games'` on top regardless of what the caller passed.
   */
  params: unknown;
  summary: GameRunSummaryTelemetry;
  outcomes: readonly GameSlotOutcomeTelemetry[];
  /** `runs/<run-id>` — where `rubrics.jsonl` lives. */
  runDir: string;
  /**
   * A dry run is NEVER ingested (nothing spent, nothing to evaluate). The guard
   * lives HERE, not only in the caller, so no future call site can forget it and
   * pollute the cost trend with a free run.
   */
  dryRun?: boolean;
}

/** `params` with the kind marker forced on. Non-object params are not lost — they are boxed. */
function paramsWithKind(params: unknown): Record<string, unknown> {
  if (params !== null && typeof params === 'object' && !Array.isArray(params)) {
    return { ...(params as Record<string, unknown>), kind: GAME_TELEMETRY_KIND };
  }
  return params === undefined
    ? { kind: GAME_TELEMETRY_KIND }
    : { kind: GAME_TELEMETRY_KIND, value: params };
}

/**
 * Upserts the run row + the per-slot rows for one Arcade run.
 *
 * NEVER throws — telemetry cannot kill a paid run. A missing Vault config is a
 * loud warning and a no-op, not a failure.
 */
export async function ingestGameRunTelemetry(input: GameRunTelemetryInput): Promise<void> {
  if (input.dryRun) return;
  if (!telemetryConfigured()) {
    console.warn(
      '[arcade] telemetry: SUPABASE_URL/SERVICE_ROLE_KEY not configured — generation stats NOT recorded to Vault.',
    );
    return;
  }
  if (!input.runId.startsWith(GAME_RUN_ID_PREFIX)) {
    // A warning, not a throw: the run already happened and its stats are worth
    // more than this module's opinion. But an un-namespaced id CAN overwrite a
    // Forge run on the shared text primary key, so it must never pass silently.
    console.warn(
      `[arcade] telemetry: run id "${input.runId}" is missing the "${GAME_RUN_ID_PREFIX}" namespace — ` +
        `it may collide with a Forge run on generation_runs.run_id (use gameRunId()).`,
    );
  }
  try {
    const now = new Date().toISOString();
    // Last judge verdict per slot, from runs/<run-id>/rubrics.jsonl. The
    // checkpoint drops the rubric at the `localized` transition, so without this
    // the verdicts would be ephemeral.
    const rubrics = GameRubricLog.latestBySlot(await GameRubricLog.read(input.runDir));

    await vaultUpsert(
      'generation_runs',
      [
        {
          run_id: input.runId,
          track_id: input.trackId ?? null,
          course_slug: input.courseSlug,
          register: input.register ?? 'kid',
          params: paramsWithKind(input.params),
          summary: input.summary,
          tokens_used: input.summary.tokensUsed,
          // numeric(12,4) in 0017 — round here so the column never truncates.
          usd_used: Number(input.summary.usdUsed.toFixed(4)),
          cached_tokens: input.summary.cachedTokens,
          images_generated: input.summary.imagesGenerated,
          images_billed: input.summary.imagesBilled,
          updated_at: now,
        },
      ],
      'run_id',
    );

    /*
     * `already-published` outcomes carry NO new information: their row was
     * written by the pass that actually published them, and this pass did no
     * work on them. Writing an empty echo would overwrite a real rubric, a real
     * duration and real image counts with nulls and zeros — so a resume pass
     * would DESTROY the telemetry of the run that did the work.
     */
    const slotRows = input.outcomes
      .filter((o) => o.state !== 'already-published')
      .map((o) => {
        const verdict = rubrics.get(o.slotId);
        return {
          run_id: input.runId,
          slot_id: o.slotId,
          state: o.state,
          failed_from: o.failedFrom ?? null,
          error: o.error ? o.error.slice(0, ERROR_TRUNCATE) : null,
          images_generated: o.imagesGenerated ?? 0,
          images_billed: o.imagesBilled ?? 0,
          images_inherited: o.imagesInherited ?? 0,
          duration_ms: o.durationMs ?? null,
          // GAME dimensions — a different set from the lesson rubric's; see the
          // header. `rubric_kind` is the discriminator a kind-aware aggregator
          // switches on, and `outcome`/`failing` turn the column into a defect
          // histogram (which dimension drags, and how often) rather than a
          // scoreboard — the judge's scores have a measured ±0.4 noise floor.
          rubric: verdict
            ? {
                ...verdict.rubric,
                rubric_kind: 'game',
                outcome: verdict.outcome,
                failing: verdict.failing,
              }
            : null,
          review_cycles: verdict?.cycles ?? null,
          early_stopped: verdict?.earlyStopped ?? false,
          updated_at: now,
        };
      });

    // `salvaged` / `dropped_segments` are deliberately NOT written: they are
    // lesson-only concepts (a partially-salvaged document with dropped segments),
    // and Arcade has no analogue. PostgREST leaves omitted columns at their
    // NOT NULL defaults, so the rows stay well-formed for a shared reader.
    if (slotRows.length > 0) await vaultUpsert('generation_slots', slotRows, 'run_id,slot_id');
  } catch (err) {
    console.warn(
      `[arcade] telemetry ingest failed (run unaffected — stats for run "${input.runId}" are missing from Vault): ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
