// File checkpoint — runs/<run-id>/checkpoint.json (COURSE_ENGINE.md §4).
// Per-slot state machine: planned → written → reviewed → localized →
// illustrated → published | failed. Resuming a run just means re-invoking
// the CLI with the same --course/--slots: each stage in run.ts checks the
// slot's current state and no-ops past whatever already succeeded.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
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
  | 'failed';

export interface SlotCheckpoint {
  slotId: string;
  state: SlotState;
  updatedAt: string;
  error?: string;
  /** Opaque per-stage payload (skeleton, documents by locale, publish result…) — stage-defined shape. */
  data?: Record<string, unknown>;
}

export interface RunCheckpoint {
  runId: string;
  course: string;
  startedAt: string;
  updatedAt: string;
  slots: Record<string, SlotCheckpoint>;
}

export function newRunCheckpoint(runId: string, course: string): RunCheckpoint {
  const now = new Date().toISOString();
  return { runId, course, startedAt: now, updatedAt: now, slots: {} };
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
  patch: Partial<Pick<SlotCheckpoint, 'error' | 'data'>> = {},
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
  };
  checkpoint.updatedAt = now;
  return checkpoint;
}

/** 'published' is the only terminal-success state — everything else (including 'failed') is retried on resume. */
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
