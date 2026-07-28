// Live telemetry → Vault (migration 0018: generation_runs_live).
//
// Unlike telemetry.ts which ingests the FULL run once at the end, this module
// upserts a heartbeat row DURING the run on every slot stage transition — the
// "what is happening RIGHT NOW" signal the admin dashboard polls every few
// seconds. Telemetry, never control flow: every ingest failure is swallowed to
// a warning, and the row is deleted when the run finishes cleanly.

import { getConfig } from '../env.js';
import { vaultUpsert } from '../vault/restClient.js';
import type { SlotState } from './checkpoint.js';

/** Maps checkpoint SlotState → the live-stage label the dashboard displays. */
const STATE_TO_LIVE_STAGE: Record<string, string> = {
  pending: 'pending',
  planned: 'planning',
  written: 'writing',      // write+gates done, awaiting judge
  reviewed: 'reviewing',   // judge passed, awaiting localize
  localized: 'localizing',
  illustrated: 'illustrating',
  published: 'published',
  'dry-run': 'completed',
  failed: 'failed',
};

function telemetryConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_SERVICE_ROLE_KEY);
}

export interface LiveHeartbeat {
  runId: string;
  trackId?: string;
  courseSlug: string;
  register: string;
  totalSlots: number;
}

/**
 * Tracks live slot progress during a generation run and pushes a heartbeat to
 * generation_runs_live on every transition. Instantiated once per
 * runGeneration(); never touches the file checkpoint — it just reads the
 * state strings processSlot tells it.
 */
export class LiveTelemetry {
  private runId: string;
  private trackId: string | undefined;
  private courseSlug: string;
  private register: string;
  private totalSlots: number;
  /** slotId → current live-stage label. */
  private slotStages = new Map<string, string>();
  private completedCount = 0;
  private failedCount = 0;
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
    this.register = heartbeat.register;
    this.totalSlots = heartbeat.totalSlots;
  }

  /** Called by processSlot after every successful stage transition. */
  onTransition(slotId: string, checkpointState: SlotState): void {
    const stage = STATE_TO_LIVE_STAGE[checkpointState] ?? checkpointState;
    if (stage === 'published' || stage === 'completed') {
      this.completedCount++;
    }
    if (stage === 'failed') {
      this.failedCount++;
    }
    this.slotStages.set(slotId, stage);
    this.dirty = true;
  }

  /** Called periodically with the latest ledger totals. */
  setCost(tokensUsed: number, usdUsed: number, cachedTokens: number): void {
    this.tokensUsed = tokensUsed;
    this.usdUsed = usdUsed;
    this.cachedTokens = cachedTokens;
  }

  /** Called after each image generation batch. */
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

  /** Delete the live row — called at the end of a completed/failed run. */
  async finish(): Promise<void> {
    await this.flush(); // final state
    await this.deleteRow();
  }

  private buildRow() {
    const stageBreakdown: Record<string, number> = {};
    for (const [, stage] of this.slotStages) {
      stageBreakdown[stage] = (stageBreakdown[stage] ?? 0) + 1;
    }
    const active = this.totalSlots - this.completedCount - this.failedCount;
    return {
      run_id: this.runId,
      track_id: this.trackId ?? null,
      course_slug: this.courseSlug,
      register: this.register,
      active_slots: Math.max(0, active),
      completed_slots: this.completedCount,
      failed_slots: this.failedCount,
      total_slots: this.totalSlots,
      stage_breakdown: stageBreakdown,
      tokens_used: this.tokensUsed,
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
        `[forge] live telemetry upsert failed (run unaffected): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async deleteRow(): Promise<void> {
    if (!telemetryConfigured()) return;
    try {
      const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig();
      await fetch(
        `${SUPABASE_URL}/rest/v1/generation_runs_live?run_id=eq.${encodeURIComponent(this.runId)}`,
        {
          method: 'DELETE',
          signal: AbortSignal.timeout(5000),
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        },
      );
    } catch (err) {
      // Row will be stale and ignored by the dashboard anyway.
      console.warn(
        `[forge] live telemetry delete failed (harmless): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Append a snapshot to generation_heartbeat_snapshots for the time-series record. */
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
        'id', // auto-generated identity — every call is a new row
      );
    } catch (err) {
      console.warn(
        `[forge] heartbeat snapshot append failed (harmless): ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
