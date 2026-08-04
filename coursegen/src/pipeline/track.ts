// Mass-run coordinator ("track") — bookkeeping over runGeneration, never an
// LLM orchestrator (COURSE_ENGINE.md §4). A full course is too big for one
// invocation, so the track shards it PER ADVENTURE (~hundreds of slots: big
// enough that the proportional budget term dominates the per-run floor),
// executes the shards sequentially — concurrency stays INSIDE each run via
// FORGE_CONCURRENCY — and owns exactly three things no single run can:
//
//   1. A GLOBAL cumulative budget. Per-shard budgets do not compose: every
//      shard gets at least the FORGE_MAX_USD_PER_RUN floor, so ~55 saga-sized
//      shards would aggregate to ~$2,750 of permitted spend on a course whose
//      whole-run budget is ~$328. The track passes its REMAINING budget down
//      as `maxUsdOverride` and stops the moment the cumulative spend crosses
//      the cap.
//   2. The resume-vs-advance policy. `runGeneration` RESOLVES on a fatal
//      provider error (it does not throw), so a naive shard loop would start
//      the next shard against a dead account. The track halts on fatal errors,
//      resumes a shard that still has unattempted work, and only advances past
//      a shard when its remaining deficit is stubborn slot-level failures
//      (each already retried FORGE_SLOT_ATTEMPTS times) — those go to the
//      mop-up list instead of blocking days of generation.
//   3. The cross-shard report: per-shard outcomes, cost, cache-hit rate, and a
//      failure heatmap keyed by the STAGE each failure came from (`failedFrom`).
//
// The priorMicroObjective chain survives sharding by construction:
// enumerateSlots computes it over the FULL catalog walk before --slots
// filtering, so a shard's first lesson still receives the true prior.

import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { getConfig } from '../env.js';
import { loadCourseCatalog, type LoadedAdventure } from '../catalog/loader.js';
import type { LessonLocale } from '../contract/core/types.js';
import type { Register } from './register.js';
import type { SlotState } from './checkpoint.js';
import { enumerateSlots, requireAllLessonLocales, runGeneration, type RunSummary } from './run.js';
import { ingestTrackTelemetry } from '../vault/telemetry.js';

export interface ShardPlan {
  adventureSlug: string;
  slotCount: number;
}

/** One shard per adventure, in catalog order. */
export function planShards(adventures: LoadedAdventure[]): ShardPlan[] {
  return adventures.map(({ data }) => ({
    adventureSlug: data.adventure.slug,
    slotCount: data.sagas.reduce((n, saga) => n + saga.topics.reduce((m, t) => m + t.lessons.length, 0), 0),
  }));
}

export type ShardVerdict =
  | { action: 'halt'; reason: string }
  | { action: 'retry' }
  | { action: 'advance'; deficit: string[] };

/**
 * The resume-vs-advance policy, pure and testable.
 *
 * - fatal provider error → HALT the track (nothing further can succeed).
 * - every enumerated slot failed → HALT (that is systemic — schema break,
 *   Vault down — not lesson-level bad luck; advancing would fail everything).
 * - unattempted work or a budget stop → RETRY the same run-id while passes
 *   remain and the last pass made progress (published something new);
 *   otherwise HALT — a shard is never skipped with work left undone.
 * - only stubborn failures remain → ADVANCE, recording them as the mop-up
 *   deficit (each already got FORGE_SLOT_ATTEMPTS in-run attempts per pass).
 */
export function assessShardOutcome(summary: RunSummary, pass: number, maxPasses: number): ShardVerdict {
  if (summary.fatalProviderError) {
    return {
      action: 'halt',
      reason: `fatal provider error — fix the account, then re-run generate:track (it resumes from the checkpoints): ${summary.fatalProviderError}`,
    };
  }
  if (summary.slotsEnumerated > 0 && summary.failed.length === summary.slotsEnumerated) {
    return {
      action: 'halt',
      reason: `every slot in the shard failed (${summary.failed.length}/${summary.slotsEnumerated}) — systemic, not lesson-level; investigate before spending more`,
    };
  }
  const unfinished = summary.notAttempted.length > 0 || summary.stoppedOnBudget;
  if (!unfinished && summary.failed.length === 0) return { action: 'advance', deficit: [] };
  const progressed = summary.published.length > 0;
  if (pass < maxPasses && progressed) return { action: 'retry' };
  if (unfinished) {
    return {
      action: 'halt',
      reason:
        pass >= maxPasses
          ? `shard still has unattempted work after ${pass} pass(es) — resume the track, never skip work`
          : 'last pass made no progress and unattempted work remains — investigate before spending more',
    };
  }
  return { action: 'advance', deficit: summary.failed.map((f) => f.slotId) };
}

export interface ShardReport {
  adventure: string;
  runId: string;
  passes: number;
  slotCount: number;
  published: number;
  alreadyDone: number;
  dryRun: number;
  failed: { slotId: string; error: string; failedFrom?: SlotState }[];
  notAttempted: number;
  salvaged: { slotId: string; droppedSegments: number }[];
  imagesGenerated: number;
  imagesBilled: number;
  imagesInherited: number;
  imageSkipReasons: string[];
  stoppedOnBudget: boolean;
  usd: number;
  tokens: number;
  cachedTokens: number;
  /** Prefix-cache hit share of prompt+completion tokens — the shard-1 canary metric. */
  cachePct: number;
}

export interface TrackReport {
  trackId: string;
  course: string;
  startedAt: string;
  finishedAt: string;
  budgetUsd: number;
  shardPasses: number;
  shards: ShardReport[];
  totals: {
    slots: number;
    published: number;
    alreadyDone: number;
    dryRun: number;
    failed: number;
    notAttempted: number;
    salvaged: number;
    imagesGenerated: number;
    imagesBilled: number;
    usd: number;
    tokens: number;
    cachedTokens: number;
    cachePct: number;
  };
  /** Failure count by the stage it failed from — where the pipeline actually bleeds. */
  failureHeatmap: Record<string, number>;
  /** Stubborn failed slots the track advanced past — re-run them with `generate -- --slots <id>`. */
  mopUp: string[];
  /** Set when the track stopped before finishing every shard, with the single cause. */
  halted: string | null;
}

export interface TrackOptions {
  course: string;
  trackId: string;
  locales?: LessonLocale[];
  noImages?: boolean;
  requireImages?: boolean;
  dryRun?: boolean;
  register?: Register;
  /** Global cumulative USD cap. Default: the same work-scaled formula a single whole-course run would get. */
  budgetUsd?: number;
  /** Max invocations per shard (first pass + resumes). Default 3. */
  shardPasses?: number;
  /**
   * Adventure slugs to exclude from this invocation entirely — not attempted,
   * not counted in totals, not in the report. Every process restart re-enters
   * the shard loop from the FIRST shard (`pass` is invocation-local, not
   * persisted), so a shard that is already good-enough (published its
   * reachable slots, only stubborn per-slot failures left) gets its residual
   * failures re-attempted on every redeploy instead of the track moving on to
   * shards with actual unattempted work. This is an operator escape hatch for
   * exactly that: skip the already-handled shard now, mop it up later with
   * `generate -- --slots <id>` (same recovery path `mopUp` already points to).
   */
  skipShards?: string[];
  curriculumRoot: string;
  runsRoot: string;
}

export interface TrackDeps {
  /** Injectable for tests — the real one spends money. */
  generate?: typeof runGeneration;
}

function buildShardReport(
  shard: ShardPlan,
  runId: string,
  passes: number,
  summary: RunSummary,
  images: { generated: number; billed: number; inherited: number },
): ShardReport {
  const cachePct = summary.tokensUsed > 0 ? (summary.cachedTokens / summary.tokensUsed) * 100 : 0;
  return {
    adventure: shard.adventureSlug,
    runId,
    passes,
    slotCount: shard.slotCount,
    published: summary.published.length + summary.alreadyDone.length,
    alreadyDone: summary.alreadyDone.length,
    dryRun: summary.dryRun.length,
    failed: summary.failed,
    notAttempted: summary.notAttempted.length,
    salvaged: summary.salvagedSlots,
    imagesGenerated: images.generated,
    imagesBilled: images.billed,
    imagesInherited: images.inherited,
    imageSkipReasons: summary.imageSkipReasons,
    stoppedOnBudget: summary.stoppedOnBudget,
    usd: summary.usdUsed,
    tokens: summary.tokensUsed,
    cachedTokens: summary.cachedTokens,
    cachePct: Number(cachePct.toFixed(1)),
  };
}

export async function runTrack(options: TrackOptions, deps: TrackDeps = {}): Promise<TrackReport> {
  // Reject before catalog work, checkpoints, telemetry, or any shard can be
  // created. `runGeneration` repeats this check as the paid-pipeline boundary.
  requireAllLessonLocales(options.locales);
  if (options.noImages && options.requireImages) {
    throw new Error('generate:track: --no-images and --require-images cannot be used together');
  }
  const generate = deps.generate ?? runGeneration;
  const config = getConfig();
  const loadResult = loadCourseCatalog(path.join(options.curriculumRoot, options.course));
  const errors = loadResult.issues.filter((i) => i.level === 'error');
  if (errors.length > 0) {
    throw new Error(`generate:track: catalog failed to load — ${errors.map((e) => e.message).join('; ')}`);
  }

  const allSlots = enumerateSlots(loadResult.course.adventures);
  const skipShards = new Set(options.skipShards ?? []);
  const shards = planShards(loadResult.course.adventures).filter((s) => s.slotCount > 0 && !skipShards.has(s.adventureSlug));
  const shardPasses = Math.max(1, options.shardPasses ?? 3);
  const budgetUsd =
    options.budgetUsd ?? Math.max(config.FORGE_MAX_USD_PER_RUN, allSlots.length * config.FORGE_MAX_USD_PER_SLOT);
  const startedAt = new Date().toISOString();

  console.log(
    `[track] ${options.trackId}: ${shards.length} shard(s) over ${allSlots.length} slot(s), ` +
      `global budget $${budgetUsd.toFixed(2)}, up to ${shardPasses} pass(es) per shard`,
  );
  if (skipShards.size > 0) {
    console.log(`[track] skipping this invocation (operator --skip-shards): ${[...skipShards].join(', ')}`);
  }

  /** Spend of ADVANCED/finished shards; the active shard's spend lives in its own run ledger. */
  let spentUsd = 0;
  const shardReports: ShardReport[] = [];
  const mopUp: string[] = [];
  let halted: string | null = null;

  for (const shard of shards) {
    if (spentUsd >= budgetUsd) {
      halted = `track budget exhausted ($${spentUsd.toFixed(2)} of $${budgetUsd.toFixed(2)}) before shard "${shard.adventureSlug}"`;
      break;
    }
    const runId = `${options.trackId}--${shard.adventureSlug}`;
    let pass = 0;
    let summary: RunSummary;
    let verdict: ShardVerdict;
    // Image counters are PER-INVOCATION (unlike tokens/usd, which hydrate from
    // the ledger) — accumulate across passes or a resumed shard reports the
    // LAST pass's zeros and misfires the zero-images warning (seen live on the
    // first track run: 58 billed images reported as 0).
    const images = { generated: 0, billed: 0, inherited: 0 };
    do {
      pass++;
      console.log(`[track] shard "${shard.adventureSlug}" (${shard.slotCount} slots) — pass ${pass}/${shardPasses}, run-id ${runId}`);
      summary = await generate({
        course: options.course,
        slots: [shard.adventureSlug],
        locales: options.locales,
        noImages: options.noImages,
        requireImages: options.requireImages,
        dryRun: options.dryRun,
        register: options.register,
        runId,
        trackId: options.trackId,
        curriculumRoot: options.curriculumRoot,
        runsRoot: options.runsRoot,
        // The whole point of the track: a shard may never spend past what the
        // TRACK has left, whatever its own per-run floor says.
        maxUsdOverride: Math.max(0, budgetUsd - spentUsd),
      });
      images.generated += summary.imagesGenerated;
      images.billed += summary.imagesBilled;
      images.inherited += summary.imagesInherited;
      verdict = assessShardOutcome(summary, pass, shardPasses);
    } while (verdict.action === 'retry');

    spentUsd += summary.usdUsed;
    shardReports.push(buildShardReport(shard, runId, pass, summary, images));
    if (verdict.action === 'halt') {
      halted = `shard "${shard.adventureSlug}": ${verdict.reason}`;
      break;
    }
    mopUp.push(...verdict.deficit);
  }

  const totals = shardReports.reduce(
    (t, s) => ({
      slots: t.slots + s.slotCount,
      published: t.published + s.published,
      alreadyDone: t.alreadyDone + s.alreadyDone,
      dryRun: t.dryRun + s.dryRun,
      failed: t.failed + s.failed.length,
      notAttempted: t.notAttempted + s.notAttempted,
      salvaged: t.salvaged + s.salvaged.length,
      imagesGenerated: t.imagesGenerated + s.imagesGenerated,
      imagesBilled: t.imagesBilled + s.imagesBilled,
      usd: t.usd + s.usd,
      tokens: t.tokens + s.tokens,
      cachedTokens: t.cachedTokens + s.cachedTokens,
      cachePct: 0,
    }),
    { slots: 0, published: 0, alreadyDone: 0, dryRun: 0, failed: 0, notAttempted: 0, salvaged: 0, imagesGenerated: 0, imagesBilled: 0, usd: 0, tokens: 0, cachedTokens: 0, cachePct: 0 },
  );
  totals.cachePct = totals.tokens > 0 ? Number(((totals.cachedTokens / totals.tokens) * 100).toFixed(1)) : 0;

  const failureHeatmap: Record<string, number> = {};
  for (const shard of shardReports) {
    for (const f of shard.failed) {
      const key = f.failedFrom ?? 'unknown';
      failureHeatmap[key] = (failureHeatmap[key] ?? 0) + 1;
    }
  }

  const report: TrackReport = {
    trackId: options.trackId,
    course: options.course,
    startedAt,
    finishedAt: new Date().toISOString(),
    budgetUsd,
    shardPasses,
    shards: shardReports,
    totals,
    failureHeatmap,
    mopUp,
    halted,
  };

  const trackDir = path.join(options.runsRoot, options.trackId);
  await mkdir(trackDir, { recursive: true });
  await writeFile(path.join(trackDir, 'track-report.json'), JSON.stringify(report, null, 2), 'utf8');
  // Durable scoreboard (0017) — the admin Generation dashboard reads this row.
  // Swallows its own failures; dry runs are never ingested.
  if (!options.dryRun) await ingestTrackTelemetry(report);
  return report;
}
