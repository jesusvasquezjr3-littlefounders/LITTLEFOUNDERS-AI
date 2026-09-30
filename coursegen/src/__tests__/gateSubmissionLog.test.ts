// S05.4c — Appendix C 1.3 "Forge Gate Pass Rate (per gate)" on first submission.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATE_SUBMISSIONS_FILE, GateSubmissionLog, firstSubmissionPassRates, formatFirstSubmissionPassRates, type GateSubmissionEntry } from '../pipeline/gateSubmissionLog.js';

const entry = (slotId: string, evaluated: boolean, failedGates: number[], locale = 'es-MX'): GateSubmissionEntry =>
  ({ ts: '2026-09-24T00:00:00.000Z', slotId, locale, evaluated, failedGates }) as GateSubmissionEntry;

describe('the first-submission gate log', () => {
  it('appends one line per draft and reads them back, tolerating a truncated last line', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lf-gate-log-'));
    const log = new GateSubmissionLog(dir);
    await log.record({ slotId: 'a1-s1-t1-l1', locale: 'es-MX', evaluated: true, failedGates: [13, 11, 13] });
    await log.record({ slotId: 'a1-s1-t1-l2', locale: 'es-MX', evaluated: false, failedGates: [1] });
    writeFileSync(path.join(dir, GATE_SUBMISSIONS_FILE), readFileSync(path.join(dir, GATE_SUBMISSIONS_FILE), 'utf8') + '{"slotId":"cut', 'utf8');
    const read = await GateSubmissionLog.read(dir);
    expect(read.map((e) => [e.slotId, e.failedGates])).toEqual([['a1-s1-t1-l1', [11, 13]], ['a1-s1-t1-l2', [1]]]);
    expect(await GateSubmissionLog.read(path.join(dir, 'missing'))).toEqual([]);
  });

  it('rates each gate over the drafts it actually ran on, first submission per slot only', () => {
    const rates = firstSubmissionPassRates([
      entry('s1', true, [11, 13]),
      entry('s2', true, []),
      entry('s3', false, [1]),
      entry('s1', true, []), // a resumed run writing s1 again is not a first submission
    ]);
    const byGate = new Map(rates.map((r) => [r.gate, r]));
    expect(byGate.get(1)).toEqual({ gate: 1, evaluated: 3, passed: 2, rate: 2 / 3 });
    expect(byGate.get(11)).toEqual({ gate: 11, evaluated: 2, passed: 1, rate: 0.5 });
    expect(byGate.get(12)).toEqual({ gate: 12, evaluated: 2, passed: 2, rate: 1 });
    expect(firstSubmissionPassRates([]).every((r) => r.rate === null)).toBe(true);
  });

  it('rates v1 and v2 drafts apart, per gate, and reports each path on its own line (GAP-FIX-R7)', () => {
    const v2 = (slotId: string, failedGates: number[], locale = 'es-MX'): GateSubmissionEntry => ({ ...entry(slotId, true, failedGates, locale), pipeline: 'v2' });
    const entries = [entry('s1', true, [11]), v2('lesson-a', [13]), v2('lesson-a', [], 'en-US'), v2('lesson-a', [18]), entry('lesson-a', true, [])];
    // No filter: every path, first submission per path, slot and locale (a v1 slot with a v2 lesson id is its own draft).
    expect(firstSubmissionPassRates(entries).find((r) => r.gate === 1)!.evaluated).toBe(4);
    const v2Rates = new Map(firstSubmissionPassRates(entries, 'v2').map((r) => [r.gate, r]));
    expect(v2Rates.get(13)).toEqual({ gate: 13, evaluated: 2, passed: 1, rate: 0.5 });
    expect(v2Rates.get(18)).toEqual({ gate: 18, evaluated: 2, passed: 2, rate: 1 });
    expect(firstSubmissionPassRates(entries, 'v1').find((r) => r.gate === 11)).toEqual({ gate: 11, evaluated: 2, passed: 1, rate: 0.5 });
    const lines = formatFirstSubmissionPassRates(entries);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^first-submission gate pass rate \(v1\): g1 2\/2 .*g11 1\/2/);
    expect(lines[1]).toMatch(/^first-submission gate pass rate \(v2\): g1 2\/2 .*g13 1\/2/);
    expect(formatFirstSubmissionPassRates([])).toEqual([]);
  });
});
