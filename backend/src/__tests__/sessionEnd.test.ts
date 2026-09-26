import { describe, expect, it } from 'vitest';
import {
  CLOSE_REASONS,
  CLOSING_SCRIPT_FOR_REASON,
  CLOSING_SCRIPTS,
  decideOpening,
  SESSION_END_THRESHOLDS,
  summarizeClosingAccuracy,
  summarizeTriggerRate,
  type ClosedSessionRow,
  type PreviousCloseRow,
  type SignalEventRow,
} from '../services/pedagogy/sessionEnd.js';

/*
 * Core's pure half of C.16 and C.8/C.12: the re-engagement decision and the
 * two Appendix F metrics, tested without a database.
 */

const NOW = new Date('2026-09-24T12:00:00Z');
const prev = (row: Partial<PreviousCloseRow>): PreviousCloseRow => ({
  close_reason: 'learner_left',
  ended_at: '2026-09-23T12:00:00Z',
  intent: 'course_topic',
  course_id: null,
  topic_id: 'topic-1',
  skill_key: null,
  ...row,
});
const here = { course_id: null, topic_id: 'topic-1', skill_key: null };

describe('decideOpening — the re-engagement a dropout or interruption queues', () => {
  it('resumes after a silent dropout on the same ground, fresh on different ground', () => {
    expect(decideOpening(prev({}), here, NOW)).toBe('reengage_left_resume');
    expect(decideOpening(prev({}), { ...here, topic_id: 'topic-2' }, NOW)).toBe('reengage_left_fresh');
    expect(decideOpening(prev({ close_reason: 'abandoned' }), here, NOW)).toBe('reengage_left_resume');
    expect(decideOpening(prev({ close_reason: 'error' }), here, NOW)).toBe('reengage_left_resume');
  });

  it('names the interruption only for a budget end', () => {
    expect(decideOpening(prev({ close_reason: 'hard_budget' }), here, NOW)).toBe('reengage_interrupted_resume');
  });

  it('never queues a "welcome back" after a safety stop, a consent revocation or an ordinary completion', () => {
    for (const reason of ['safety_stop', 'consent_revoked', 'completed', 'soft_budget']) {
      expect(decideOpening(prev({ close_reason: reason }), here, NOW), reason).toBe('greeting');
    }
  });

  it('greets plainly on a first session, an open previous row, or after the staleness window', () => {
    expect(decideOpening(null, here, NOW)).toBe('greeting');
    expect(decideOpening(prev({ ended_at: null }), here, NOW)).toBe('greeting');
    const stale = new Date(NOW.getTime() - (SESSION_END_THRESHOLDS.reengagementMaxAgeDays + 1) * 86_400_000);
    expect(decideOpening(prev({ ended_at: stale.toISOString() }), here, NOW)).toBe('greeting');
  });

  it('does not read two unrelated null targets as "the same ground"', () => {
    expect(
      decideOpening(prev({ topic_id: null }), { course_id: null, topic_id: null, skill_key: null }, NOW),
    ).toBe('reengage_left_fresh');
  });
});

describe('the reason → script table', () => {
  it('covers every close reason with one of the four scripts', () => {
    expect(Object.keys(CLOSING_SCRIPT_FOR_REASON).sort()).toEqual([...CLOSE_REASONS].sort());
    expect(new Set(Object.values(CLOSING_SCRIPT_FOR_REASON))).toEqual(new Set(CLOSING_SCRIPTS));
  });
});

const session = (id: string, row: Partial<ClosedSessionRow>): ClosedSessionRow => ({
  id,
  character: 'rho',
  close_reason: 'completed',
  closing_script: 'completed',
  opening: 'greeting',
  end_signal_evaluated: true,
  ...row,
});

describe('Session-Closing Script Accuracy (target 100%)', () => {
  it('is 100% when every recorded script matches its reason', () => {
    const summary = summarizeClosingAccuracy([
      session('a', {}),
      session('b', { close_reason: 'hard_budget', closing_script: 'interrupted' }),
      session('c', { close_reason: 'abandoned', closing_script: 'learner_left', opening: 'reengage_left_fresh' }),
      session('d', { close_reason: 'safety_stop', closing_script: 'safety_stop' }),
    ]);
    expect(summary).toMatchObject({ recorded: 4, correct: 4, accuracy: 1, status: 'ok', defects: [] });
    expect(summary.openings).toEqual({ greeting: 3, reengage_left_fresh: 1 });
  });

  it('is a defect on ONE wrong script — above all a positive close on a safety stop', () => {
    const summary = summarizeClosingAccuracy([
      session('a', {}),
      session('b', { close_reason: 'safety_stop', closing_script: 'completed' }),
    ]);
    expect(summary.status).toBe('defect');
    expect(summary.mismatches).toEqual([{ sessionId: 'b', closeReason: 'safety_stop', closingScript: 'completed' }]);
    expect(summary.defects).toHaveLength(1);
  });

  it('reports insufficient data — never a pass — when nothing was recorded', () => {
    const summary = summarizeClosingAccuracy([session('a', { closing_script: null })]);
    expect(summary).toMatchObject({ recorded: 0, accuracy: null, status: 'insufficient_data' });
  });
});

describe('Early-Warning Signal Trigger Rate (diagnostic)', () => {
  const event = (sessionId: string, row: Partial<SignalEventRow>): SignalEventRow => ({
    session_id: sessionId,
    character: 'rho',
    remaining_ms: 600_000,
    mode: 'offer',
    outcome: 'declined',
    confirmed: null,
    ...row,
  });

  it('counts evaluated sessions that fired before the hard cap, and the precision of labelled firings', () => {
    const sessions = [
      session('a', {}),
      session('b', {}),
      session('c', {}),
      session('d', { end_signal_evaluated: false }),
      session('e', { character: 'zara' }),
    ];
    const summary = summarizeTriggerRate(sessions, [
      event('a', { outcome: 'accepted', confirmed: true }),
      event('b', { confirmed: false }),
      event('c', { remaining_ms: 0 }),
      event('d', {}),
      event('e', { mode: 'shadow', outcome: 'not_offered', confirmed: true }),
    ]);
    // a, b and e fired before the cap; c fired AT the cap; d was not evaluated.
    expect(summary).toMatchObject({ evaluatedSessions: 4, firedSessions: 3, triggerRate: 0.75 });
    expect(summary).toMatchObject({ labelledFirings: 3, confirmedFirings: 2 });
    expect(summary.precision).toBeCloseTo(2 / 3);
    expect(summary.shadowFirings).toBe(1);
    expect(summary.offers).toEqual({ accepted: 1, declined: 3 });
    expect(summary.byPersona).toEqual({ rho: { evaluated: 3, fired: 2 }, zara: { evaluated: 1, fired: 1 } });
    // Diagnostic: a thin sample is insufficient data, never a verdict.
    expect(summary.triggerStatus).toBe('insufficient_data');
  });

  it('is diagnostic, never a defect, once the sample is large enough', () => {
    const sessions = Array.from({ length: SESSION_END_THRESHOLDS.triggerRateMinSessions }, (_, i) => session(`s${i}`, {}));
    expect(summarizeTriggerRate(sessions, []).triggerStatus).toBe('diagnostic');
  });
});
