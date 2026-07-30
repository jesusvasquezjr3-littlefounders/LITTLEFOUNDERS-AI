// Live telemetry → Vault (migration 0018 `generation_runs_live` + migration 0020
// `generation_heartbeat_snapshots`). Port of `coursegen/src/pipeline/liveTelemetry.ts`
// — Forge's module is battle-tested against real paid runs, so this is a port with
// the game-specific facts substituted, never a re-derivation (gamegen/AGENTS.md
// "Read before touching").
//
// Unlike `vault/telemetry.ts`, which ingests the FULL run ONCE at the end, this
// module upserts a heartbeat row DURING the run on every slot stage transition —
// the "what is happening RIGHT NOW" signal the admin dashboard polls every few
// seconds — and appends a time-series snapshot alongside it. `finish()` flushes a
// final state and DELETES the live row; a row still present with a stale
// `updated_at` is how Core detects a run process that died.
//
// TELEMETRY, NEVER CONTROL FLOW. Every write here is best-effort: a Vault outage,
// a bad service key or a network hiccup is swallowed to a `console.warn`. A paid
// generation run must never die because the scoreboard was unreachable — that
// would be a telemetry failure turned into a money failure.
//
// SHARED TABLES, DISJOINT RUNS (/GAME_ENGINE.md §9 "Telemetry & CI"). These four
// telemetry tables are shared with Forge. `generation_runs_live` carries no
// `params` column, so an Arcade heartbeat is identified by the `games-` run-id
// prefix alone (`vault/telemetry.ts` → `gameRunId()`); the durable
// `generation_runs` row additionally carries `params.kind = 'games'`. The admin
// dashboard filters on those markers so game runs never contaminate lesson trends.

import { getConfig } from '../env.js';
import { vaultUpsert } from '../vault/client.js';

/**
 * The Arcade checkpoint states (/GAME_ENGINE.md §9, gamegen/AGENTS.md "Pipeline
 * shape"). Declared here rather than imported from `pipeline/checkpoint.ts`
 * because this module does not own that file; `onTransition` accepts a plain
 * `string` so the two can never fight over the union, and an unmapped state
 * falls through as its own label rather than vanishing from the breakdown.
 *
 * Nine stages, EIGHT states: `gate` owns no state of its own (it runs inside the
 * author stage's corrective-retry loop), so there is no `gated` here.
 */
export type GameSlotState =
  | 'pending'
  | 'planned'
  | 'authored'
  | 'simulated'
  | 'judged'
  | 'localized'
  | 'illustrated'
  | 'published'
  | 'failed'
  | 'dry-run';

/**
 * The live stage labels pinned by /GAME_ENGINE.md §9 and gamegen/AGENTS.md. These
 * are the vocabulary the admin dashboard's per-kind stage list renders for a game
 * run — deliberately DIFFERENT from Forge's (`writing`, `reviewing`), because the
 * Arcade pipeline has different stages. Anything reading `stage_breakdown` must
 * therefore switch on the run kind rather than assume the lesson stage list.
 */
export const GAME_LIVE_STAGES = [
  'planning',
  'authoring',
  'simulating',
  'judging',
  'localizing',
  'illustrating',
  'publishing',
] as const;
export type GameLiveStage = (typeof GAME_LIVE_STAGES)[number];

/**
 * Checkpoint state → live stage label.
 *
 * A state names the work that has just COMPLETED, and its label names that stage
 * — the same convention Forge uses (`planned → planning`), kept so both kinds of
 * run read the same way in one dashboard.
 *
 * `published → 'publishing'` is the label pinned by the brief and by
 * /GAME_ENGINE.md §9, whose label list ends at `publishing`. A slot that has
 * finished therefore still occupies the `publishing` bucket of `stage_breakdown`
 * — which is why `completed_slots` (below) is derived from the CHECKPOINT STATE
 * and is the authoritative "this many are done" number. Never re-derive
 * completion by counting labels.
 */
const STATE_TO_LIVE_STAGE: Record<GameSlotState, string> = {
  pending: 'pending',
  planned: 'planning',
  authored: 'authoring',
  simulated: 'simulating',
  judged: 'judging',
  localized: 'localizing',
  illustrated: 'illustrating',
  published: 'publishing',
  // A dry-run slot was validated and cost nothing; it is finished, not in flight.
  'dry-run': 'completed',
  failed: 'failed',
};

/** Terminal states that count toward `completed_slots`. */
const COMPLETED_STATES: ReadonlySet<string> = new Set<string>(['published', 'dry-run']);

/** Maps a checkpoint state to its live label; an unknown state is its own label. */
export function liveStageFor(state: string): string {
  return Object.prototype.hasOwnProperty.call(STATE_TO_LIVE_STAGE, state)
    ? STATE_TO_LIVE_STAGE[state as GameSlotState]
    : state;
}

function telemetryConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_SERVICE_ROLE_KEY);
}

export interface LiveHeartbeat {
  /** `games-<courseSlug>-<ISO8601>` — see `vault/telemetry.ts` → `gameRunId()`. */
  runId: string;
  /** Set when this run is a shard of a multi-course invocation (`generate:full`). */
  trackId?: string;
  courseSlug: string;
  /** Shared-column parity with Forge; Arcade has no register concept, so 'kid'. */
  register?: string;
  totalSlots: number;
}

/**
 * Tracks live slot progress during an Arcade run and pushes a heartbeat to
 * `generation_runs_live` (plus a `generation_heartbeat_snapshots` row) on every
 * flush. Instantiated once per run; it never touches the file checkpoint — it
 * only reads the state strings the slot worker reports.
 */
export class LiveTelemetry {
  private runId: string;
  private trackId: string | undefined;
  private courseSlug: string;
  private register: string;
  private totalSlots: number;
  /** slotId → current live-stage label. */
  private slotStages = new Map<string, string>();
  /**
   * slotId → terminal outcome. A MAP, not two counters: a resume pass or an
   * outer from-scratch retry (`ARCADE_SLOT_ATTEMPTS`) can re-emit a terminal
   * transition for a slot that already reported one, and counting EVENTS instead
   * of SLOTS would then drive `active_slots` negative and overstate completion.
   */
  private terminal = new Map<string, 'completed' | 'failed'>();
  private tokensUsed = 0;
  private usdUsed = 0;
  private cachedTokens = 0;
  private imagesGenerated = 0;
  private imagesBilled = 0;
  private imagesInherited = 0;
  private dirty = false;

  constructor(heartbeat: LiveHeartbeat) {
    this.runId = heartbeat.runId;
    this.trackId = heartbeat.trackId;
    this.courseSlug = heartbeat.courseSlug;
    this.register = heartbeat.register ?? 'kid';
    this.totalSlots = heartbeat.totalSlots;
  }

  /** Called by the slot worker after every successful stage transition. */
  onTransition(slotId: string, checkpointState: string): void {
    this.slotStages.set(slotId, liveStageFor(checkpointState));
    if (COMPLETED_STATES.has(checkpointState)) this.terminal.set(slotId, 'completed');
    else if (checkpointState === 'failed') this.terminal.set(slotId, 'failed');
    this.dirty = true;
  }

  /** Called with the latest `UsageLedger` totals (tokens / usd / cached tokens). */
  setCost(tokensUsed: number, usdUsed: number, cachedTokens: number): void {
    this.tokensUsed = tokensUsed;
    this.usdUsed = usdUsed;
    this.cachedTokens = cachedTokens;
  }

  /** Called after each Prism sprite/background batch. */
  addImages(generated: number, billed: number, inherited: number): void {
    this.imagesGenerated += generated;
    this.imagesBilled += billed;
    this.imagesInherited += inherited;
  }

  /** Push the current heartbeat to Vault. Swallow-on-failure by design. */
  async flush(): Promise<void> {
    if (!this.dirty && this.tokensUsed === 0) return;
    this.dirty = false;
    await this.upsertHeartbeat();
    await this.appendSnapshot();
  }

  /** Flush a final state, then delete the live row. Called at run end (clean OR failed). */
  async finish(): Promise<void> {
    await this.flush();
    await this.deleteRow();
  }

  private counts(): { completed: number; failed: number } {
    let completed = 0;
    let failed = 0;
    for (const outcome of this.terminal.values()) {
      if (outcome === 'completed') completed++;
      else failed++;
    }
    return { completed, failed };
  }

  private buildRow() {
    const stageBreakdown: Record<string, number> = {};
    for (const stage of this.slotStages.values()) {
      stageBreakdown[stage] = (stageBreakdown[stage] ?? 0) + 1;
    }
    const { completed, failed } = this.counts();
    return {
      run_id: this.runId,
      track_id: this.trackId ?? null,
      course_slug: this.courseSlug,
      register: this.register,
      // Clamped: `totalSlots` is the enumeration, and a resumed run can report
      // terminal slots it never scheduled this invocation.
      active_slots: Math.max(0, this.totalSlots - completed - failed),
      completed_slots: completed,
      failed_slots: failed,
      total_slots: this.totalSlots,
      stage_breakdown: stageBreakdown,
      tokens_used: this.tokensUsed,
      // numeric(12,4) in 0018/0020 — round here so the column never truncates.
      usd_used: Number(this.usdUsed.toFixed(4)),
      cached_tokens: this.cachedTokens,
      images_generated: this.imagesGenerated,
      images_billed: this.imagesBilled,
      images_inherited: this.imagesInherited,
      updated_at: new Date().toISOString(),
    };
  }

  private async upsertHeartbeat(): Promise<void> {
    if (!telemetryConfigured()) return;
    try {
      await vaultUpsert('generation_runs_live', [this.buildRow()], 'run_id');
    } catch (err) {
      console.warn(
        `[arcade] live telemetry upsert failed (run unaffected): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async deleteRow(): Promise<void> {
    if (!telemetryConfigured()) return;
    try {
      const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ARCADE_VAULT_TIMEOUT_MS } = getConfig();
      await fetch(
        `${SUPABASE_URL}/rest/v1/generation_runs_live?run_id=eq.${encodeURIComponent(this.runId)}`,
        {
          method: 'DELETE',
          // Bounded like every other Vault call: an untimed fetch at run end can
          // park the process on a half-open socket long after the work is done.
          signal: AbortSignal.timeout(ARCADE_VAULT_TIMEOUT_MS),
          headers: {
            // telemetryConfigured() above already proved both are present.
            apikey: SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY!}`,
          },
        },
      );
    } catch (err) {
      // Harmless: a leftover row is stale and the dashboard already treats a
      // heartbeat older than ~2 minutes as a terminated run (migration 0018).
      console.warn(
        `[arcade] live telemetry delete failed (harmless): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Append one snapshot to `generation_heartbeat_snapshots` (0020) — the time series. */
  private async appendSnapshot(): Promise<void> {
    if (!telemetryConfigured()) return;
    try {
      const row = this.buildRow();
      await vaultUpsert(
        'generation_heartbeat_snapshots',
        [
          {
            run_id: row.run_id,
            active_slots: row.active_slots,
            completed_slots: row.completed_slots,
            failed_slots: row.failed_slots,
            stage_breakdown: row.stage_breakdown,
            tokens_used: row.tokens_used,
            usd_used: row.usd_used,
            cached_tokens: row.cached_tokens,
            images_generated: row.images_generated,
            images_billed: row.images_billed,
            images_inherited: row.images_inherited,
          },
        ],
        // `id` is a generated-always identity (0020), so no conflict can occur:
        // every call is a new row. Naming it keeps the shared upsert helper's
        // `on_conflict` contract satisfied without inventing a unique key.
        'id',
      );
    } catch (err) {
      console.warn(
        `[arcade] heartbeat snapshot append failed (harmless): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
