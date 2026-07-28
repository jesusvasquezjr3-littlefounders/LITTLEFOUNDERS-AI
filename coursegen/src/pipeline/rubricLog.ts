// Per-run judge-rubric log — runs/<run-id>/rubrics.jsonl (append-only, one
// line per REVIEW OUTCOME). This is the raw material of the improvement loop
// (forge:coach) and of the generation-telemetry dashboard: without it, the
// judge's scores were ephemeral (the checkpoint drops the rubric at the
// `localized` transition), so a run left no record of WHICH dimensions dragged,
// how many revise cycles lessons burned, or why rejected drafts were rejected.
//
// Mirrors UsageLedger's mechanics: JSONL, append-only, tolerant reader (a
// truncated final line — process killed mid-append — is skipped, never fatal).
// Multiple invocations of the same run APPEND to the same file; consumers take
// the LAST entry per slot as the final verdict.

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReviewRubric } from './review.js';

export interface RubricLogEntry {
  ts: string;
  slotId: string;
  outcome: 'passed' | 'failed';
  /** Revise cycles consumed before this verdict (0 = passed first judgment). */
  cycles: number;
  /** True when the revise loop broke early (no failing dimension improved). */
  earlyStopped: boolean;
  rubric: ReviewRubric;
}

const NOTES_TRUNCATE = 600;

export class RubricLog {
  private readonly filePath: string;

  constructor(runDir: string) {
    this.filePath = path.join(runDir, 'rubrics.jsonl');
  }

  async record(entry: Omit<RubricLogEntry, 'ts'>): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        ...entry,
        rubric: { ...entry.rubric, notes: entry.rubric.notes.slice(0, NOTES_TRUNCATE) },
      } satisfies RubricLogEntry) + '\n';
    await appendFile(this.filePath, line, 'utf8');
  }

  /** All entries, oldest first. Tolerates a truncated final line and a missing file. */
  static async read(runDir: string): Promise<RubricLogEntry[]> {
    let raw: string;
    try {
      raw = await readFile(path.join(runDir, 'rubrics.jsonl'), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const entries: RubricLogEntry[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as RubricLogEntry);
      } catch {
        // truncated tail — skip, never fatal (same policy as UsageLedger.hydrate)
      }
    }
    return entries;
  }

  /** The FINAL verdict per slot (last entry wins — later passes supersede). */
  static latestBySlot(entries: readonly RubricLogEntry[]): Map<string, RubricLogEntry> {
    const map = new Map<string, RubricLogEntry>();
    for (const entry of entries) map.set(entry.slotId, entry);
    return map;
  }
}
