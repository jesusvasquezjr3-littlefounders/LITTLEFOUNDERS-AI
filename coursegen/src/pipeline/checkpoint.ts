// File checkpoint — runs/<run-id>/checkpoint.json (COURSE_ENGINE.md §4).
// Per-slot state machine: planned → written → reviewed → localized →
// illustrated → published | failed. Resuming a run just means re-invoking
// the CLI with the same --course/--slots: each stage in run.ts checks the
// slot's current state and no-ops past whatever already succeeded.

import { readFile, writeFile, mkdir, rename, open, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export type SlotState =
  | 'pending'
  | 'planned'
  | 'written'
  | 'reviewed'
  | 'localized'
  | 'illustrated'
  | 'published'
  /**
   * A --dry-run pass validated this slot and spent nothing. DISTINCT from
   * 'published' on purpose: `isSlotDone` used to see the dry-run marker as a real
   * publish, so validating a 1000-slot enumeration and then running it for real
   * under the same --run-id skipped every slot and printed "published: 1000" with
   * ZERO lessons in Vault.
   */
  | 'dry-run'
  | 'failed';

export interface SlotCheckpoint {
  slotId: string;
  state: SlotState;
  updatedAt: string;
  error?: string;
  /**
   * The stage state the slot held when it failed — set alongside `state:
   * 'failed'`, cleared on any successful transition. This is what lets the
   * outer retry distinguish "the judge rejected the draft" (failedFrom:
   * written → regenerate from scratch, the measured-better path) from "a
   * transient localize/publish error discarded judge-approved work"
   * (failedFrom: reviewed/localized/illustrated → resume from the checkpoint,
   * never re-pay plan+write+judge for a stage whose input was fine).
   */
  failedFrom?: SlotState;
  /** Opaque per-stage payload (skeleton, documents by locale, publish result…) — stage-defined shape. */
  data?: Record<string, unknown>;
}

/**
 * The parameters that DECIDE WHAT A SLOT CONTAINS. Persisted with the checkpoint
 * and compared on every resume.
 *
 * WHY: `isSlotDone` only ever looked at the state string, so a resume under the
 * same --run-id with DIFFERENT flags silently treated incompatible work as
 * finished. A 1000-lesson course cannot be generated in one invocation, so
 * multi-pass runs are the normal operating mode and every one of these was
 * reachable: a `--locales es-MX` first pass then a full pass locked 1000 lessons
 * to one locale forever (publish drops the documents from the checkpoint, and
 * there is no locale-backfill path); a `--no-images` pass then a full pass
 * published a visual-first curriculum with no illustrations; `--register kid`
 * resumed as `--register adult` never created the adult course yet reported it
 * complete.
 */
export interface RunParams {
  course: string;
  locales: string[];
  noImages: boolean;
  /**
   * Production mode: an image failure must fail the slot, never fall back.
   * Optional because checkpoints written before the flag existed have no key —
   * that era could not require images, so absent ≙ false. run.ts always
   * materializes a boolean for new checkpoints.
   */
  requireImages?: boolean;
  register: string;
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
  if (stored.course !== current.course) diffs.push(`course ${stored.course} → ${current.course}`);
  const a = [...stored.locales].sort().join(',');
  const b = [...current.locales].sort().join(',');
  if (a !== b) diffs.push(`locales ${a || '(none)'} → ${b || '(none)'}`);
  if (stored.noImages !== current.noImages) diffs.push(`noImages ${stored.noImages} → ${current.noImages}`);
  // Normalize BOTH sides: a legacy checkpoint lacking the key must compare equal
  // to a plain (requireImages: false) resume, or every pre-flag run with
  // published slots is permanently unresumable — "re-run with the original
  // parameters" would be unachievable, since the original run had no such flag.
  const storedRequireImages = stored.requireImages ?? false;
  const currentRequireImages = current.requireImages ?? false;
  if (storedRequireImages !== currentRequireImages) diffs.push(`requireImages ${storedRequireImages} → ${currentRequireImages}`);
  if (stored.register !== current.register) diffs.push(`register ${stored.register} → ${current.register}`);
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
 */
export function isSlotDone(checkpoint: RunCheckpoint, slotId: string): boolean {
  return getSlot(checkpoint, slotId).state === 'published';
}

export class CheckpointStore {
  // run.ts shares ONE checkpoint object across FORGE_CONCURRENCY concurrent
  // slot workers (COURSE_ENGINE.md §4) — save() can be called concurrently.
  // This queue serializes the actual disk writes in call order: each save()
  // snapshots the checkpoint to JSON SYNCHRONOUSLY (matching the exact
  // ordering of the synchronous in-memory mutations that preceded the call),
  // then appends the write to the queue. Without this, two concurrent saves
  // used the SAME pid-only tmp filename (a second rename of an
  // already-renamed-away file threw ENOENT) and, even with unique tmp names,
  // could still race the final rename and leave checkpoint.json holding a
  // STALER snapshot than what was already on disk.
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

/** Cross-process exclusion for a run directory; concurrent writers corrupt resume semantics. */
export class RunLock {
  private constructor(private readonly lockPath: string) {}

  static async acquire(runDir: string, runId: string): Promise<RunLock> {
    const lockPath = path.join(runDir, '.run.lock');
    await mkdir(runDir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const handle = await open(lockPath, 'wx');
        await handle.writeFile(JSON.stringify({ pid: process.pid, runId, startedAt: new Date().toISOString() }));
        await handle.close();
        return new RunLock(lockPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
        const raw = await readFile(lockPath, 'utf8').catch(() => '');
        let owner: { pid?: unknown; runId?: unknown } = {};
        try { owner = JSON.parse(raw || '{}') as { pid?: unknown; runId?: unknown }; } catch { /* corrupt lock is stale */ }
        const pid = typeof owner.pid === 'number' ? owner.pid : null;
        let active = false;
        if (pid !== null) {
          try { process.kill(pid, 0); active = true; } catch { /* stale owner */ }
        }
        if (active) {
          throw new Error(`run "${runId}" is already active in process ${pid}; wait for it to finish or use a different --run-id.`);
        }
        await unlink(lockPath).catch(() => undefined);
      }
    }
    throw new Error(`could not acquire run lock for "${runId}"`);
  }

  async release(): Promise<void> {
    await unlink(this.lockPath).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
}
