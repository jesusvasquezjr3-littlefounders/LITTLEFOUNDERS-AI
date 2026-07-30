// File checkpoint — runs/<run-id>/checkpoint.json (GAME_ENGINE.md §9).
//
// Per-slot state machine (the eight states §9 pins, plus the two markers):
//   pending → planned → authored → simulated → judged → localized → illustrated → published
//   (+ 'failed' carrying failedFrom, + 'dry-run' for PRISTINE slots only)
//
// Resuming a run just means re-invoking the CLI with the same --course/--run-id:
// each stage in run.ts checks the slot's current state and no-ops past whatever
// already succeeded. Ported from `coursegen/src/pipeline/checkpoint.ts`, whose
// every comment below records a failure that actually happened on a paid Forge
// run — Arcade inherits the fixes, not the bugs (gamegen/AGENTS.md "Read before
// touching": coursegen/AGENTS.md rules are inherited verbatim).

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export type SlotState =
  | 'pending'
  | 'planned'
  | 'authored'
  | 'simulated'
  | 'judged'
  | 'localized'
  | 'illustrated'
  | 'published'
  /**
   * A --dry-run pass validated this slot and spent nothing. DISTINCT from
   * 'published' on purpose: Forge's `isSlotDone` once saw the dry-run marker as a
   * real publish, so validating a large enumeration and then running it for real
   * under the same --run-id skipped every slot and printed a full publish count
   * with ZERO content in Vault.
   */
  | 'dry-run'
  | 'failed';

/** The eight lifecycle states in pipeline order — `gate` deliberately owns none of
 *  them (it runs INSIDE the author stage's corrective-retry loop, GAME_ENGINE.md §9). */
export const SLOT_LIFECYCLE: readonly SlotState[] = [
  'pending',
  'planned',
  'authored',
  'simulated',
  'judged',
  'localized',
  'illustrated',
  'published',
];

export interface SlotCheckpoint {
  slotId: string;
  state: SlotState;
  updatedAt: string;
  error?: string;
  /**
   * The stage state the slot held when it failed — set alongside `state: 'failed'`,
   * cleared on any successful transition. This is what lets the outer retry
   * distinguish "the judge rejected the draft" (failedFrom: authored/simulated →
   * regenerate from scratch, the measured-better path) from "a transient
   * localize/illustrate/publish error discarded judge-approved work" (failedFrom:
   * judged/localized/illustrated → resume from the checkpoint, never re-pay
   * plan+author+judge for a stage whose input was fine).
   */
  failedFrom?: SlotState;
  /** Opaque per-stage payload (skeleton, documents by locale, sidecar, rubric, publish result…) — stage-defined shape. */
  data?: Record<string, unknown>;
}

/**
 * The parameters that DECIDE WHAT A SLOT CONTAINS. Persisted with the checkpoint
 * and compared on every resume.
 *
 * WHY: `isSlotDone` only ever looks at the state string, so a resume under the same
 * --run-id with DIFFERENT flags would silently treat incompatible work as finished.
 * Multi-pass runs are the normal operating mode for a whole course of games, and
 * every variation is reachable in normal use: a `--locales es-MX` first pass then a
 * full pass would lock every game to one locale forever (publish drops the documents
 * from the checkpoint and there is no locale-backfill path), and a `--no-images`
 * pass then a full pass would ship a sprite-less arcade while reporting success.
 *
 * `kind` is a frozen literal rather than an option: it marks these runs as Arcade's
 * in the SHARED generation telemetry tables (`generation_runs.params.kind = 'games'`,
 * GAME_ENGINE.md §9), so a game run can never be read as, or averaged into, a Forge
 * lesson run.
 */
export interface RunParams {
  kind: 'games';
  course: string;
  locales: string[];
  noImages: boolean;
}

export interface RunCheckpoint {
  runId: string;
  course: string;
  startedAt: string;
  updatedAt: string;
  /** Absent on checkpoints written before this field existed — treated as unknown, never as a match. */
  params?: RunParams;
  slots: Record<string, SlotCheckpoint>;
}

export function newRunCheckpoint(runId: string, course: string, params?: RunParams): RunCheckpoint {
  const now = new Date().toISOString();
  return { runId, course, startedAt: now, updatedAt: now, params, slots: {} };
}

/** Human-readable difference between a stored and a current parameter set, or null when compatible. */
export function describeParamMismatch(stored: RunParams | undefined, current: RunParams): string | null {
  if (!stored) return 'the checkpoint predates run-parameter tracking, so what produced its slots is unknown';
  const diffs: string[] = [];
  if (stored.kind !== current.kind) diffs.push(`kind ${stored.kind} → ${current.kind}`);
  if (stored.course !== current.course) diffs.push(`course ${stored.course} → ${current.course}`);
  const a = [...stored.locales].sort().join(',');
  const b = [...current.locales].sort().join(',');
  if (a !== b) diffs.push(`locales ${a || '(none)'} → ${b || '(none)'}`);
  if (stored.noImages !== current.noImages) diffs.push(`noImages ${stored.noImages} → ${current.noImages}`);
  return diffs.length > 0 ? diffs.join('; ') : null;
}

export function getSlot(checkpoint: RunCheckpoint, slotId: string): SlotCheckpoint {
  return (
    checkpoint.slots[slotId] ?? {
      slotId,
      state: 'pending',
      updatedAt: checkpoint.startedAt,
    }
  );
}

export function setSlotState(
  checkpoint: RunCheckpoint,
  slotId: string,
  state: SlotState,
  patch: Partial<Pick<SlotCheckpoint, 'error' | 'data' | 'failedFrom'>> = {},
): RunCheckpoint {
  const now = new Date().toISOString();
  const existing = getSlot(checkpoint, slotId);
  checkpoint.slots[slotId] = {
    ...existing,
    ...patch,
    slotId,
    state,
    updatedAt: now,
    // A successful transition clears any stale error from a previous failed attempt.
    error: state === 'failed' ? patch.error : undefined,
    // failedFrom lives and dies with the 'failed' state, exactly like error.
    failedFrom: state === 'failed' ? patch.failedFrom : undefined,
  };
  checkpoint.updatedAt = now;
  return checkpoint;
}

/**
 * 'published' is the only terminal-success state — everything else (including
 * 'failed' and 'dry-run') is retried on resume.
 *
 * NOTE: for Arcade "published" means the row landed in Vault with
 * `games.status = 'review'`. Arcade NEVER auto-publishes to children; the human
 * content queue is the gate (GAME_ENGINE.md §9). The checkpoint state names the
 * PIPELINE stage, not the product state.
 */
export function isSlotDone(checkpoint: RunCheckpoint, slotId: string): boolean {
  return getSlot(checkpoint, slotId).state === 'published';
}

export class CheckpointStore {
  // run.ts shares ONE checkpoint object across ARCADE_CONCURRENCY concurrent slot
  // workers — save() can be called concurrently. This queue serializes the actual
  // disk writes in call order: each save() snapshots the checkpoint to JSON
  // SYNCHRONOUSLY (matching the exact ordering of the synchronous in-memory
  // mutations that preceded the call), then appends the write to the queue.
  //
  // NEVER "simplify" this away and never writeFile/rename the checkpoint path
  // directly (gamegen/AGENTS.md). Without the queue, two concurrent saves used the
  // SAME pid-only tmp filename — a second rename of an already-renamed-away file
  // threw ENOENT at concurrency 2 — and, even with unique tmp names, could still
  // race the final rename and leave checkpoint.json holding a STALER snapshot than
  // what was already on disk.
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<RunCheckpoint | null> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as RunCheckpoint;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  async save(checkpoint: RunCheckpoint): Promise<void> {
    const json = JSON.stringify(checkpoint, null, 2);
    const next = this.queue.then(() => this.writeAtomic(json));
    // Swallow here so one failed write doesn't poison the queue for later,
    // independent saves — the caller's own `await store.save(...)` still sees the rejection.
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Atomic write (unique tmp file + rename) so a crash mid-write never corrupts the checkpoint. */
  private async writeAtomic(json: string): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp-${process.pid}-${randomUUID()}`;
    await writeFile(tmpPath, json, 'utf8');
    await rename(tmpPath, this.filePath);
  }
}
