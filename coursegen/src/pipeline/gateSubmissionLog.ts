// Per-run first-submission gate log — runs/<run-id>/gate-submissions.jsonl
// (S05.4c; Appendix C Part 1.3 "Forge Gate Pass Rate (per gate)": "% of
// authored lessons passing each individual gate on FIRST submission, tracked
// separately per gate", data source "Forge pipeline logs").
//
// verify:course reports the release-time pass rate; this is the other half:
// what the author (a model in a live run) got right before any corrective
// retry told it what to fix. One line per written lesson draft, recorded by
// the write stage. Zero spend: it records what a run already computed.
//
// Same mechanics as RubricLog: JSONL, append-only, tolerant reader, and a
// write failure never kills a run.

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { GateNumber } from './gates.js';

export interface GateSubmissionEntry {
  ts: string;
  slotId: string;
  locale: string;
  /**
   * False when the first submission was not valid JSON or failed the lesson
   * schema: gates 2-16 never ran on it, so they count as NOT evaluated, never
   * as passed.
   */
  evaluated: boolean;
  /** Gates that reported a problem on the first submission (gate 1 when unparseable). */
  failedGates: GateNumber[];
}

export const GATE_SUBMISSIONS_FILE = 'gate-submissions.jsonl';

export class GateSubmissionLog {
  private readonly filePath: string;

  constructor(runDir: string) {
    this.filePath = path.join(runDir, GATE_SUBMISSIONS_FILE);
  }

  async record(entry: Omit<GateSubmissionEntry, 'ts'>): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry, failedGates: [...new Set(entry.failedGates)].sort((a, b) => a - b) }) + '\n';
    await appendFile(this.filePath, line, 'utf8');
  }

  /** All entries, oldest first. Tolerates a missing file and a truncated final line. */
  static async read(runDir: string): Promise<GateSubmissionEntry[]> {
    let raw: string;
    try {
      raw = await readFile(path.join(runDir, GATE_SUBMISSIONS_FILE), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const entries: GateSubmissionEntry[] = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line) as GateSubmissionEntry);
      } catch {
        // A process killed mid-append leaves a partial last line: skip it.
      }
    }
    return entries;
  }
}

export interface GatePassRate {
  gate: GateNumber;
  /** First submissions on which this gate actually ran. */
  evaluated: number;
  passed: number;
  /** passed / evaluated, or null when the gate never ran. */
  rate: number | null;
}

const ALL_GATES: readonly GateNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

/**
 * Per-gate first-submission pass rate. Only the FIRST entry per slot and
 * locale counts: a resumed run that writes the slot again is not a first
 * submission. Gate 1 (the contract) runs on every submission; gates 2-16 only
 * on submissions that parsed.
 */
export function firstSubmissionPassRates(entries: readonly GateSubmissionEntry[]): GatePassRate[] {
  const first = new Map<string, GateSubmissionEntry>();
  for (const entry of entries) {
    const key = `${entry.slotId}:${entry.locale}`;
    if (!first.has(key)) first.set(key, entry);
  }
  const submissions = [...first.values()];
  return ALL_GATES.map((gate) => {
    const ran = gate === 1 ? submissions : submissions.filter((entry) => entry.evaluated);
    const passed = ran.filter((entry) => !entry.failedGates.includes(gate)).length;
    return { gate, evaluated: ran.length, passed, rate: ran.length === 0 ? null : passed / ran.length };
  });
}
