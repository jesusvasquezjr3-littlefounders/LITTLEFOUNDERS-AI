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
  /**
   * GAP-FIX-R7 (OD-17, OD-24): which authoring path wrote the draft. Absent on
   * the legacy v1 pipeline's lines (and on every line written before this
   * field existed); 'v2' on `v2:author`'s, where slotId is the lesson_id.
   */
  pipeline?: GatePipeline;
}

export type GatePipeline = 'v1' | 'v2';
const pipelineOf = (entry: GateSubmissionEntry): GatePipeline => entry.pipeline ?? 'v1';

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

const ALL_GATES: readonly GateNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

/**
 * Per-gate first-submission pass rate. Only the FIRST entry per slot and
 * locale counts: a resumed run that writes the slot again is not a first
 * submission. Gate 1 (the contract) runs on every submission; gates 2-19 are
 * counted only on submissions that parsed (17-19 read the raw document, but the
 * write stage runs them only once the draft parses, so an unparsed draft never
 * counts as a pass for them).
 */
export function firstSubmissionPassRates(entries: readonly GateSubmissionEntry[], pipeline?: GatePipeline): GatePassRate[] {
  const first = new Map<string, GateSubmissionEntry>();
  for (const entry of entries) {
    if (pipeline !== undefined && pipelineOf(entry) !== pipeline) continue;
    const key = `${pipelineOf(entry)}:${entry.slotId}:${entry.locale}`;
    if (!first.has(key)) first.set(key, entry);
  }
  const submissions = [...first.values()];
  return ALL_GATES.map((gate) => {
    const ran = gate === 1 ? submissions : submissions.filter((entry) => entry.evaluated);
    const passed = ran.filter((entry) => !entry.failedGates.includes(gate)).length;
    return { gate, evaluated: ran.length, passed, rate: ran.length === 0 ? null : passed / ran.length };
  });
}

/**
 * The per-gate first-submission lines of a run, one per authoring path that
 * wrote into it (Appendix C Part 1.3: tracked separately per gate; GAP-FIX-R7:
 * the v2 catalog OD-17/OD-24 make the only path for new lessons is reported
 * apart from the legacy v1 drafts). Only gates that ran at least once.
 */
export function formatFirstSubmissionPassRates(entries: readonly GateSubmissionEntry[]): string[] {
  const lines: string[] = [];
  for (const pipeline of ['v1', 'v2'] as const) {
    const rates = firstSubmissionPassRates(entries, pipeline).filter((rate) => rate.evaluated > 0);
    if (rates.length > 0) lines.push(`first-submission gate pass rate (${pipeline}): ${rates.map((rate) => `g${rate.gate} ${rate.passed}/${rate.evaluated}`).join(' · ')}`);
  }
  return lines;
}
