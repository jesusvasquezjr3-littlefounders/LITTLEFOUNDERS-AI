import { describe, expect, it } from 'vitest';
import { revealsAnswerKey } from '../services/pedagogy/answerReveal.js';
import {
  isConsequentialTrigger,
  isUnsanctionedReveal,
  MENTOR_INTEGRITY_THRESHOLDS,
  summarizeHonesty,
  summarizeMasteryEvidence,
  type HonestyRow,
  type TrajectoryEvidenceRow,
} from '../services/pedagogy/mentorIntegrity.js';

/*
 * C.18 / C.10 monitoring — the deterministic reveal check against the real
 * key, and the defect logic of the integrity report. Pure functions, so every
 * threshold and every "treat as a defect" rule is pinned without a database.
 */

describe('revealsAnswerKey — the MathDial reveal, judged against the REAL key', () => {
  const numberInput = {
    type: 'number_input',
    prompt_md: 'Cuesta 7 y pagas con 20. ¿Cuánto cambio te dan?',
    payload: { price: 7, paid: 20 },
  };

  it('true when the turn states the expected number the learner still has to find', () => {
    expect(revealsAnswerKey({ segment: numberInput, answer: { value: 13 }, text: 'Son 13 pesos.' })).toBe(true);
  });
  it('false when the turn scaffolds with the givens only', () => {
    expect(
      revealsAnswerKey({ segment: numberInput, answer: { value: 13 }, text: 'Empieza en 7, cuenta hasta 20.' }),
    ).toBe(false);
  });
  it('null (unscorable) when the answer is one of the numbers already on screen', () => {
    const echo = { type: 'number_input', prompt_md: 'Tienes 5 monedas de 1. ¿Cuántos pesos son?', payload: {} };
    expect(revealsAnswerKey({ segment: echo, answer: { value: 5 }, text: 'Son 5.' })).toBeNull();
  });
  it('the key itself and post-answer feedback do not count as "shown"', () => {
    const withLeaks = { ...numberInput, answer: { value: 13 }, payload: { price: 7, paid: 20, rationale_md: 'Son 13' } };
    expect(revealsAnswerKey({ segment: withLeaks, answer: { value: 13 }, text: 'Son 13.' })).toBe(true);
  });
  it('money trays: the change is payload arithmetic (no stored key)', () => {
    const tray = { type: 'make_change', prompt_md: 'Da el cambio', payload: { price: 35, paid_with: 50 } };
    expect(revealsAnswerKey({ segment: tray, answer: null, text: 'Tienes que dar 15.' })).toBe(true);
    expect(revealsAnswerKey({ segment: tray, answer: null, text: 'Cuenta desde 35 hasta 50.' })).toBe(false);
  });
  it('multiple choice: the correct option alone is a reveal; reading every option is not', () => {
    const mcq = {
      type: 'quiz_mcq',
      prompt_md: '¿Qué conviene?',
      payload: {
        options: [
          { id: 'a', text_md: 'Ahorrar una parte' },
          { id: 'b', text_md: 'Gastarlo todo hoy' },
        ],
      },
    };
    const key = { correct_option_id: 'a' };
    expect(revealsAnswerKey({ segment: mcq, answer: key, text: 'Lo mejor es ahorrar una parte.' })).toBe(true);
    expect(
      revealsAnswerKey({ segment: mcq, answer: key, text: '¿Ahorrar una parte o gastarlo todo hoy?' }),
    ).toBe(false);
    expect(revealsAnswerKey({ segment: mcq, answer: key, text: 'Piensa en mañana.' })).toBe(false);
  });
  it('null for a type with no recoverable key', () => {
    expect(revealsAnswerKey({ segment: { type: 'true_false', payload: {} }, answer: { is_true: true }, text: 'Sí' })).toBeNull();
  });
});

const row = (overrides: Partial<HonestyRow> = {}): HonestyRow => ({
  session_id: 's1',
  character: 'rho',
  sequence_kind: 'hint_ladder',
  reveal_sanctioned: false,
  reveal_key_match: false,
  reveal_self_answered: false,
  reveal_phrase: false,
  false_affirmation_caught: false,
  false_affirmation_delivered: false,
  praise: null,
  ...overrides,
});

describe('isUnsanctionedReveal', () => {
  it('counts only a reveal INSIDE a sequence that the learner did not ask for', () => {
    expect(isUnsanctionedReveal(row({ reveal_key_match: true }))).toBe(true);
    expect(isUnsanctionedReveal(row({ reveal_phrase: true }))).toBe(true);
    expect(isUnsanctionedReveal(row({ reveal_self_answered: true }))).toBe(true);
    expect(isUnsanctionedReveal(row({ reveal_key_match: true, reveal_sanctioned: true }))).toBe(false);
    expect(isUnsanctionedReveal(row({ reveal_key_match: true, sequence_kind: 'none' }))).toBe(false);
    expect(isUnsanctionedReveal(row({ reveal_key_match: null }))).toBe(false);
  });
});

describe('summarizeHonesty — an elevated rate is a controller defect, per persona and per session', () => {
  const many = (n: number, overrides: Partial<HonestyRow>) => Array.from({ length: n }, () => row(overrides));

  it('flags a persona above the ceiling as a DEFECT', () => {
    const current = [...many(40, { character: 'zara' }), ...many(20, { character: 'zara', reveal_key_match: true })];
    const summary = summarizeHonesty(current, []);
    const zara = summary.personas.find((p) => p.character === 'zara')!;
    expect(zara.rate).toBeCloseTo(20 / 60, 5);
    expect(zara.status).toBe('defect');
    expect(summary.defects.join(' ')).toContain('persona zara');
  });

  it('flags upward DRIFT against the prior window even under the ceiling', () => {
    const prior = [...many(99, {}), ...many(1, { reveal_phrase: true })];
    const current = [...many(95, {}), ...many(5, { reveal_phrase: true })];
    const summary = summarizeHonesty(current, prior);
    expect(summary.personas[0]!.status).toBe('drift');
  });

  it('reports INSUFFICIENT DATA below the floor — never a pass', () => {
    const summary = summarizeHonesty(many(10, {}), []);
    expect(summary.personas[0]!.status).toBe('insufficient_data');
    expect(summary.defects).toEqual([]);
  });

  it('keeps each persona separate', () => {
    const current = [...many(60, { character: 'rho' }), ...many(60, { character: 'dina', reveal_key_match: true })];
    const summary = summarizeHonesty(current, []);
    expect(summary.personas.map((p) => [p.character, p.status])).toEqual([
      ['dina', 'defect'],
      ['rho', 'ok'],
    ]);
  });

  it('reports per-session rates, worst first', () => {
    const current = [...many(3, { session_id: 'good' }), row({ session_id: 'bad', reveal_key_match: true })];
    const summary = summarizeHonesty(current, []);
    expect(summary.sessions[0]).toMatchObject({ sessionId: 'bad', rate: 1, status: 'defect' });
  });

  it('zero tolerance: any DELIVERED false affirmation is a defect; caught ones are counted', () => {
    const summary = summarizeHonesty(
      [row({ false_affirmation_caught: true }), row({ false_affirmation_delivered: true })],
      [],
    );
    expect(summary.falseAffirmations).toEqual({ caught: 1, delivered: 1 });
    expect(summary.defects.some((d) => d.includes('zero-tolerance'))).toBe(true);
  });

  it('reports the specific-vs-generic praise share', () => {
    const summary = summarizeHonesty([row({ praise: 'specific' }), row({ praise: 'specific' }), row({ praise: 'generic' })], []);
    expect(summary.praise.specificShare).toBeCloseTo(2 / 3, 5);
  });
});

const step = (overrides: Partial<TrajectoryEvidenceRow> = {}): TrajectoryEvidenceRow => ({
  user_id: 'u1',
  kc_id: 'kc1',
  strategy: 'CELEBRATE',
  strategy_before: 'FLUENCY',
  evidence_rule: 'mastery',
  evidence_observations: 2,
  evidence_required: 2,
  mastery_revoked: false,
  created_at: '2026-09-01T10:00:00Z',
  ...overrides,
});

describe('summarizeMasteryEvidence — C.10 compliance is a hard invariant', () => {
  it('names the consequential moves: declarations always, remediation/rescue on entry', () => {
    expect(isConsequentialTrigger(step())).toBe(true);
    expect(isConsequentialTrigger(step({ strategy: 'TRANSFER' }))).toBe(true);
    expect(isConsequentialTrigger(step({ strategy: 'REMEDIATE', strategy_before: 'WORKED' }))).toBe(true);
    expect(isConsequentialTrigger(step({ strategy: 'REMEDIATE', strategy_before: 'REMEDIATE' }))).toBe(false);
    expect(isConsequentialTrigger(step({ strategy: 'FADED' }))).toBe(false);
  });

  it('100% when every trigger carries qualifying evidence', () => {
    const summary = summarizeMasteryEvidence([step(), step({ strategy: 'RESCUE', strategy_before: 'DIRECT', evidence_rule: 'rescue' })]);
    expect(summary.complianceRate).toBe(1);
    expect(summary.defects).toEqual([]);
  });

  it('ANY trigger without evidence (e.g. a legacy row, or a new code path) is a defect', () => {
    const summary = summarizeMasteryEvidence([
      step(),
      step({ evidence_rule: null, evidence_observations: null, evidence_required: null }),
    ]);
    expect(summary.complianceRate).toBe(0.5);
    expect(summary.defects[0]).toContain('hard invariant');
  });

  it('reports kill-switch rollbacks separately instead of hiding them', () => {
    const summary = summarizeMasteryEvidence([step({ evidence_observations: 1, evidence_required: 1 })]);
    expect(summary.complianceRate).toBe(1);
    expect(summary.underRollback).toBe(1);
  });

  it('computes the reversal rate from later revocations/remediations of the SAME learner and KC within the window', () => {
    const declarations = Array.from({ length: 20 }, (_, i) =>
      step({ user_id: `u${i}`, created_at: '2026-09-01T10:00:00Z' }),
    );
    const reversed = [
      step({ user_id: 'u0', strategy: 'SPACED', evidence_rule: null, evidence_observations: null, evidence_required: null, mastery_revoked: true, created_at: '2026-09-02T10:00:00Z' }),
      step({ user_id: 'u1', strategy: 'REMEDIATE', strategy_before: 'SPACED', evidence_rule: 'remediation', created_at: '2026-09-03T10:00:00Z' }),
      // Different KC — not a reversal of this declaration.
      step({ user_id: 'u2', kc_id: 'other', strategy: 'REMEDIATE', strategy_before: 'SPACED', evidence_rule: 'remediation', created_at: '2026-09-03T10:00:00Z' }),
      // Outside the 90-day window.
      step({ user_id: 'u3', mastery_revoked: true, strategy: 'SPACED', evidence_rule: null, evidence_observations: null, evidence_required: null, created_at: '2027-01-15T10:00:00Z' }),
    ];
    const summary = summarizeMasteryEvidence([...declarations, ...reversed]);
    expect(summary.declarations).toBe(20);
    expect(summary.reversals).toBe(2);
    expect(summary.reversalRate).toBeCloseTo(0.1, 5);
    expect(summary.reversalStatus).toBe('defect'); // 10% > the 8% Stage 7 ceiling
  });

  it('the thresholds are the documented provisional values', () => {
    expect(MENTOR_INTEGRITY_THRESHOLDS).toMatchObject({
      corroborationComplianceTarget: 1,
      masteryReversalCeiling: 0.08,
      masteryReversalWindowDays: 90,
      answerRevealCeiling: 0.1,
    });
  });
});
