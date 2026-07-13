// File checkpoint — runs/<run-id>/checkpoint.json (COURSE_ENGINE.md §4).
// Per-slot state machine: planned → written → reviewed → localized →
// illustrated → published | failed. Resuming a run just means re-invoking
// the CLI with the same --course/--slots: each stage in run.ts checks the
// slot's current state and no-ops past whatever already succeeded.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
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

  /** Atomic write (tmp file + rename) so a crash mid-write never corrupts the checkpoint. */
  async save(checkpoint: RunCheckpoint): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp-${process.pid}`;
    await writeFile(tmpPath, JSON.stringify(checkpoint, null, 2), 'utf8');
    await rename(tmpPath, this.filePath);
  }
}
