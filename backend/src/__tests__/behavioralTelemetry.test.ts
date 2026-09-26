import { describe, expect, it } from 'vitest';
import {
  BehavioralTelemetryReportBody,
  evaluateKillSwitch,
  KILL_SWITCH_RESOLVED,
  KILL_SWITCH_TRIGGERED,
  killSwitchLog,
  summarizeDefaultToInaction,
  summarizeRepairInitiation,
  telemetryColumns,
  TELEMETRY_THRESHOLDS,
  type TelemetryFiringRow,
  type TelemetrySessionRow,
} from '../services/pedagogy/behavioralTelemetry.js';

/*
 * C.9 / C.19 — Core's pure metrics and the Stage 7 kill-switch condition
 * (Appendix F §1.2, Part 3). No database: the route tests in `tutor.test.ts`
 * cover the reads, the writes and the automatic rollback end to end.
 */

const session = (character: string, mode: string | null, evaluated: number, action: number): TelemetrySessionRow => ({
  id: `${character}-${evaluated}-${action}`,
  character,
  telemetry_mode: mode,
  telemetry_evaluated_turns: mode === null ? null : evaluated,
  telemetry_action_turns: mode === null ? null : action,
});

const firing = (outcome: string, extra: Partial<TelemetryFiringRow> = {}): TelemetryFiringRow => ({
  session_id: null,
  character: 'rho',
  mode: 'act',
  outcome,
  repair_offered: null,
  latency_shift: '1.000',
  rapid_response: '0.000',
  verbosity_drop: '1.000',
  repeated_answer: '0.500',
  hedging: '0.000',
  off_topic: '0.000',
  hint_abuse: '0.000',
  fast_known_miss: '0.000',
  ...extra,
});

describe('the close body (signal strength only)', () => {
  const report = {
    mode: 'act',
    evaluatedTurns: 10,
    actionTurns: 1,
    events: [
      {
        observation: 7,
        latencyShift: 1,
        rapidResponse: 0,
        verbosityDrop: 1,
        repeatedAnswer: 0,
        hedging: 0,
        offTopic: 0,
        hintAbuse: 0,
        fastKnownMiss: 0,
        channels: 2,
        mode: 'act',
        outcome: 'aligned',
        repairOffered: null,
      },
    ],
  };

  it('accepts the real shape and maps the counts to their columns', () => {
    const parsed = BehavioralTelemetryReportBody.parse(report);
    expect(telemetryColumns(parsed)).toEqual({
      telemetry_mode: 'act',
      telemetry_evaluated_turns: 10,
      telemetry_action_turns: 1,
    });
    expect(telemetryColumns(undefined)).toEqual({});
  });

  it('has no field that could carry an emotion label', () => {
    const withLabel = { ...report, events: [{ ...report.events[0], state: 'frustrated' }] };
    expect(BehavioralTelemetryReportBody.safeParse(withLabel).success).toBe(false);
    expect(BehavioralTelemetryReportBody.safeParse({ ...report, mood: 'bored' }).success).toBe(false);
  });
});

describe('Default-to-Inaction Rate (floor 85%)', () => {
  it('counts act-mode sessions only, by persona, and reports a thin sample as insufficient data', () => {
    const thin = summarizeDefaultToInaction([session('rho', 'act', 20, 5)]);
    expect(thin.rate).toBeCloseTo(0.75);
    expect(thin.status).toBe('insufficient_data');

    const rows = [session('rho', 'act', 300, 15), session('zara', 'act', 100, 5), session('dina', 'shadow', 50, 0), session('liruf', null, 0, 0)];
    const summary = summarizeDefaultToInaction(rows);
    expect(summary.evaluatedTurns).toBe(400);
    expect(summary.actionTurns).toBe(20);
    expect(summary.rate).toBeCloseTo(0.95);
    expect(summary.status).toBe('ok');
    expect(summary.shadowSessions).toBe(1);
    expect(Object.keys(summary.byPersona).sort()).toEqual(['rho', 'zara']);
  });

  it('is a defect below the floor once the sample is sufficient', () => {
    const summary = summarizeDefaultToInaction([session('rho', 'act', 400, 80)]);
    expect(summary.rate).toBeCloseTo(0.8);
    expect(summary.status).toBe('defect');
  });
});

describe('Disengagement-Repair Initiation Rate (hard 100%)', () => {
  it('counts only firings a Mentor turn could have carried', () => {
    const summary = summarizeRepairInitiation([
      firing('aligned'),
      firing('misaligned', { repair_offered: true }),
      firing('unanswered'),
      firing('superseded'),
      firing('session_ended'),
      firing('shadow', { mode: 'shadow' }),
    ]);
    expect(summary.opportunities).toBe(3);
    expect(summary.rate).toBe(1);
    expect(summary.status).toBe('ok');
    expect(summary.repairsWithOffer).toBe(1);
    expect(summary.shadowFirings).toBe(1);
    expect(summary.meanStrength.latencyShift).toBeCloseTo(1);
    expect(summary.meanStrength.repeatedAnswer).toBeCloseTo(0.5);
  });

  it('ONE undelivered firing is a defect, whatever the sample', () => {
    const many = Array.from({ length: 99 }, () => firing('aligned'));
    const summary = summarizeRepairInitiation([...many, firing('undelivered')]);
    expect(summary.rate).toBeCloseTo(0.99);
    expect(summary.status).toBe('defect');
  });

  it('no firing at all is insufficient data, never a pass', () => {
    expect(summarizeRepairInitiation([]).status).toBe('insufficient_data');
  });
});

describe('the Stage 7 kill-switch condition', () => {
  it('trips on the floor only with a sufficient sample', () => {
    expect(evaluateKillSwitch([session('rho', 'act', 40, 20)], []).tripped).toBe(false);
    const verdict = evaluateKillSwitch([session('rho', 'act', TELEMETRY_THRESHOLDS.killSwitchMinEvaluatedTurns, 100)], []);
    expect(verdict.tripped).toBe(true);
    expect(verdict.causes).toEqual(['default_to_inaction_below_floor']);
  });

  it('trips on one missed check-in and reports both causes together', () => {
    const verdict = evaluateKillSwitch([session('rho', 'act', 400, 100)], [firing('undelivered')]);
    expect(verdict.causes).toEqual(['default_to_inaction_below_floor', 'repair_initiation_below_target']);
    expect(verdict.missedCheckIns).toBe(1);
  });

  it('a healthy window does not trip', () => {
    expect(evaluateKillSwitch([session('rho', 'act', 400, 10)], [firing('aligned')]).tripped).toBe(false);
  });
});

describe('the Kill-Switch Trigger Log', () => {
  it('pairs each trigger with its resolution and measures the time to resolve', () => {
    const log = killSwitchLog([
      { action: KILL_SWITCH_RESOLVED, created_at: '2026-10-02T12:00:00Z', detail: {} },
      { action: KILL_SWITCH_TRIGGERED, created_at: '2026-10-01T12:00:00Z', detail: { causes: ['repair_initiation_below_target'] } },
      // A second replica's duplicate trigger while the first is open is the same trip.
      { action: KILL_SWITCH_TRIGGERED, created_at: '2026-10-01T12:00:05Z', detail: { causes: ['repair_initiation_below_target'] } },
      { action: KILL_SWITCH_TRIGGERED, created_at: '2026-10-05T08:00:00Z', detail: { causes: ['default_to_inaction_below_floor'] } },
    ]);
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ causes: ['repair_initiation_below_target'], resolutionHours: 24 });
    expect(log[1]).toMatchObject({ resolvedAt: null, resolutionHours: null });
  });
});
