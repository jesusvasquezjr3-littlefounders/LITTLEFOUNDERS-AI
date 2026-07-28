// Generation telemetry → Vault (migration 0017: generation_runs /
// generation_slots / generation_tracks, service-role-only posture like
// picture_assets 0014 / speech_assets 0015 — RLS enabled, ZERO client
// policies; the ONLY reader is Core's staff console via /api/v1/admin/*).
//
// This is the durable "registro" of how the agentic pipeline behaved on every
// run: per-slot outcomes, failure stages, judge rubrics, revise cycles, cost
// and cache-hit — the raw material for the admin Generation dashboard and for
// forge:coach's improvement loop. It is TELEMETRY, never control flow: every
// ingest failure is swallowed to a warning (a run must never die because the
// scoreboard was unreachable), and dry runs are never ingested (nothing was
// spent, nothing to evaluate).

import { getConfig } from '../env.js';
import { vaultUpsert } from './restClient.js';
import { RubricLog } from '../pipeline/rubricLog.js';
import type { RunSummary, ProcessSlotOutcome } from '../pipeline/run.js';
import type { RunParams } from '../pipeline/checkpoint.js';
import type { TrackReport } from '../pipeline/track.js';

const ERROR_TRUNCATE = 600;

function telemetryConfigured(): boolean {
  const cfg = getConfig();
  return Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_SERVICE_ROLE_KEY);
}

export interface RunTelemetryInput {
  runId: string;
  /** Set when the run is a shard of a generate:track — links runs to their track row. */
  trackId?: string;
  courseSlug: string;
  register: string;
  params: RunParams;
  summary: RunSummary;
  outcomes: readonly ProcessSlotOutcome[];
  runDir: string;
}

/** Upserts the run + per-slot telemetry. NEVER throws — telemetry cannot kill a run. */
export async function ingestRunTelemetry(input: RunTelemetryInput): Promise<void> {
  if (!telemetryConfigured()) {
    console.warn('[forge] telemetry: SUPABASE_URL/SERVICE_ROLE_KEY not configured — generation stats NOT recorded to Vault.');
    return;
  }
  try {
    const now = new Date().toISOString();
    const rubrics = RubricLog.latestBySlot(await RubricLog.read(input.runDir));
    await vaultUpsert(
      'generation_runs',
      [
        {
          run_id: input.runId,
          track_id: input.trackId ?? null,
          course_slug: input.courseSlug,
          register: input.register,
          params: input.params,
          summary: input.summary,
          tokens_used: input.summary.tokensUsed,
          usd_used: Number(input.summary.usdUsed.toFixed(4)),
          cached_tokens: input.summary.cachedTokens,
          images_generated: input.summary.imagesGenerated,
          images_billed: input.summary.imagesBilled,
          updated_at: now,
        },
      ],
      'run_id',
    );
    // already-published outcomes carry no new information (their row was
    // written by the pass that actually published them) — skip, so a resume
    // pass never overwrites real telemetry with an empty echo.
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
          salvaged: o.salvaged ?? false,
          dropped_segments: o.droppedSegments ?? 0,
          images_generated: o.imagesGenerated ?? 0,
          images_billed: o.imagesBilled ?? 0,
          images_inherited: o.imagesInherited ?? 0,
          duration_ms: o.durationMs ?? null,
          rubric: verdict ? verdict.rubric : null,
          review_cycles: verdict?.cycles ?? null,
          early_stopped: verdict?.earlyStopped ?? false,
          updated_at: now,
        };
      });
    if (slotRows.length > 0) await vaultUpsert('generation_slots', slotRows, 'run_id,slot_id');
  } catch (err) {
    console.warn(
      `[forge] telemetry ingest failed (run unaffected — stats for run "${input.runId}" are missing from Vault): ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Upserts the track-level report. NEVER throws. */
export async function ingestTrackTelemetry(report: TrackReport): Promise<void> {
  if (!telemetryConfigured()) {
    console.warn('[forge] telemetry: SUPABASE_URL/SERVICE_ROLE_KEY not configured — track report NOT recorded to Vault.');
    return;
  }
  try {
    await vaultUpsert(
      'generation_tracks',
      [
        {
          track_id: report.trackId,
          course_slug: report.course,
          report,
          budget_usd: Number(report.budgetUsd.toFixed(4)),
          halted: report.halted,
          updated_at: new Date().toISOString(),
        },
      ],
      'track_id',
    );
  } catch (err) {
    console.warn(
      `[forge] telemetry ingest failed (track unaffected — report for "${report.trackId}" is missing from Vault): ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
