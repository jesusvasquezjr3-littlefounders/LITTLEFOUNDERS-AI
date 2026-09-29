import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { loadV2LearningSignals } from '../services/learningQuality.js';
import { evaluateSignals, type QualitySources } from '../services/pedagogy/mentorQuality.js';

/*
 * GAP-FIX-R1 learning (Appendix C 1.1, Appendix P Parts 4.5 and 8): the v2
 * receipt signals reach the staff report and the Mentor quality loop. The
 * SQL itself is 0207; these tests pin how Core reads and reports it.
 */

afterEach(() => vi.unstubAllGlobals());

describe('v2 learning signals', () => {
  it('reports transfer vs practice, the structure-versus-answer split, the first unaided stage and d-prime', async () => {
    const db = { __rpc: [
      { name: 'learning_transfer_success', body: [
        { kc: 'kc-needs-wants', item_role: 'practice', first_attempts: 10, successes: 8, success_share: 0.8 },
        { kc: 'kc-needs-wants', item_role: 'transfer', first_attempts: 5, successes: 2, success_share: 0.4 },
      ] },
      { name: 'learning_error_family_split', body: [
        { family: 'structure', diagnostic: 'bin', errors: 3 }, { family: 'answer', diagnostic: 'value', errors: 5 }, { family: 'answer', diagnostic: 'reason', errors: 1 },
      ] },
      { name: 'learning_first_unaided_stage_distribution', body: [{ stage: 'pictorial', learners: 4 }, { stage: 'abstract', learners: 2 }] },
      { name: 'learning_detection_cells', body: [{ lesson_id: '11111111-1111-4111-8111-111111111111', responses: 6, hits: 10, misses: 2, false_alarms: 1, correct_rejections: 11 }] },
    ] } as unknown as FakeDb;
    vi.stubGlobal('fetch', createFakeFetch(db));
    const signals = await loadV2LearningSignals({ p_since: '2026-09-01T00:00:00.000Z', p_until: '2026-09-28T00:00:00.000Z' });
    expect(signals?.errorSplit).toMatchObject({ structure: 3, answer: 6 });
    expect(signals?.firstUnaided.map((row) => row.stage)).toEqual(['pictorial', 'abstract']);
    expect(signals?.detection[0]!.dPrime).toBeGreaterThan(1);
    expect(signals?.transfer).toHaveLength(2);
  });

  it('is null (pending the migration) when any function is missing, never partial numbers', async () => {
    vi.stubGlobal('fetch', createFakeFetch({ __rpc: [{ name: 'learning_transfer_success', body: [] }] } as unknown as FakeDb));
    expect(await loadV2LearningSignals({ p_since: '2026-09-01T00:00:00.000Z', p_until: '2026-09-28T00:00:00.000Z' })).toBeNull();
  });

  it('turns learning.transfer_success into an instrumented reading with a practice and transfer breakdown per KC', () => {
    const src = { transfer: [
      { kc: 'kc-a', item_role: 'practice', first_attempts: 10, successes: 8 },
      { kc: 'kc-a', item_role: 'transfer', first_attempts: 4, successes: 1 },
    ] } as Partial<QualitySources>;
    const report = evaluateSignals({ ...(baseSources()), ...src } as QualitySources);
    const reading = report.readings.find((r) => r.id === 'learning.transfer_success')!;
    expect(reading).toMatchObject({ status: 'diagnostic', value: 0.25, sample: 4 });
    expect(reading.breakdown.map((b) => b.key)).toEqual(['kc:kc-a/practice', 'kc:kc-a/transfer']);
    const failed = evaluateSignals({ ...(baseSources()), transfer: null } as QualitySources).readings.find((r) => r.id === 'learning.transfer_success');
    expect(failed?.status).toBe('unavailable');
  });
});

describe('GAP-FIX-R4: Session Efficiency counts v2 lesson work (Appendix C 1.2, Appendix P Part 7.5)', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../../database/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const sql = (name: string) => readFileSync(join(dir, name), 'utf8').split(String.fromCharCode(13)).join('');
  /** The body of the LAST migration that defines a function: the one production runs. */
  const latest = (fn: string) => {
    const file = [...files].reverse().find((f) => sql(f).includes(`FUNCTION public.${fn}(`))!;
    const text = sql(file);
    const start = text.indexOf(`FUNCTION public.${fn}(`);
    return { file, body: text.slice(start, text.indexOf('$$;', text.indexOf('$$', start) + 2)) };
  };

  it('sums graded seconds from the v1 attempts and the v2 receipts and views', () => {
    const { body } = latest('learning_session_efficiency');
    for (const table of ['lesson_segment_attempts', 'lesson_v2_grade_receipts', 'lesson_v2_segment_views']) expect(body).toContain(`public.${table}`);
    expect(body.match(/time_spent_seconds/g)?.length).toBeGreaterThanOrEqual(3);
    // Still capped at the day's visible session time.
    expect(body).toContain('LEAST(COALESCE(g.seconds, 0), s.seconds)');
  });

  it('keeps time on task out of every grading and completion function', () => {
    for (const fn of ['record_v2_lesson_grade', 'record_v2_lesson_grade_ordered', 'record_v2_lesson_grade_retry', 'record_v2_cpa_grade_retry', 'complete_v2_lesson', 'complete_v2_mixed_lesson']) {
      const found = [...files].reverse().find((f) => sql(f).includes(`FUNCTION public.${fn}(`));
      if (!found) continue;
      expect(latest(fn).body, fn).not.toContain('time_spent_seconds');
    }
    // The one writer sets it once, only while NULL, bounded 0-7200.
    const { body } = latest('record_v2_time_on_task');
    expect(body).toContain('time_spent_seconds IS NULL');
    expect(body).toContain('NOT BETWEEN 0 AND 7200');
  });
});

/** A source set with every read empty (no evidence), as the loop builds on a quiet window. */
function baseSources(): Record<string, unknown> {
  return {
    now: new Date('2026-09-28T00:00:00.000Z'), rubricHash: 'x', sessions: [], scores: [], priorScores: [], firings: [], endSignals: [], alliance: [],
    allianceBaseline: [], renegotiations: [], trajectory: [], routing: [], dialogue: [], ladder: [], liveGate: { calibration: 'passed', suspended: [] },
    judgeCalibrations: [], killSwitchAudit: [], completeness: { active: 0, current: 0 }, kcAttempts: [], retention: [],
    // F1-staff-ops (C.24): the Block B learning signals the loop also reads.
    learning: {
      judgment: [],
      narrative: { journal_entries_recorded: 0, journal_entries_resurfaced: 0, bridge_prompts_offered: 0, bridge_prompts_converted_7d: 0, bridge_self_commitments: 0 },
      sessionEfficiency: [], mentorResolution: [],
      restDays: { learners_with_lapse: 0, kept_by_rest_days: 0, utilization_rate: null, rest_days_used: 0 },
      autonomy: [],
    },
  };
}
