import { describe, expect, it } from 'vitest';
import { mirrorBktUpdate, PedagogicalController } from '../tutor/controller.js';
import type { SessionPlanEntry } from '../core/client.js';
import { mintGradeEcho, verifyGradeEcho } from '../session/gradeEcho.js';

/*
 * The v3 strategy controller: every guardrail is a rule a parent could be
 * shown, so every guardrail gets a test with a name a parent could read.
 */

const KC_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const KC_PREREQ = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0';

function entry(overrides: Partial<SessionPlanEntry> = {}): SessionPlanEntry {
  return {
    kcId: KC_A,
    kcKey: 'money.make-change-counting-up',
    skillKey: null,
    reason: 'frontier',
    pKnown: 0.4,
    targetDifficulty: 2,
    objective: 'Dar el cambio correcto contando desde el precio.',
    prereqKcIds: [KC_PREREQ],
    misconceptions: [
      { code: 'adds-instead-of-counts-up', hint: 'Cuenta hacia arriba desde el precio.' },
    ],
    ...overrides,
  };
}

const NOW = 1_756_000_000_000;

describe('PedagogicalController', () => {
  it('is dormant with no plan — exactly v2 behaviour', () => {
    const c = new PedagogicalController([]);
    expect(c.active).toBe(false);
    expect(c.activeKcId).toBeNull();
    expect(c.state()).toBeNull();
  });

  it('selects the strategy from the mastery band', () => {
    expect(new PedagogicalController([entry({ pKnown: 0.1 })]).currentStrategy).toBe('DIRECT');
    expect(new PedagogicalController([entry({ pKnown: 0.4 })]).currentStrategy).toBe('WORKED');
    expect(new PedagogicalController([entry({ pKnown: 0.6 })]).currentStrategy).toBe('FADED');
    expect(new PedagogicalController([entry({ pKnown: 0.75 })]).currentStrategy).toBe('SOCRATIC');
    expect(new PedagogicalController([entry({ pKnown: 0.9 })]).currentStrategy).toBe('FLUENCY');
  });

  it('a review entry opens as SPACED', () => {
    const c = new PedagogicalController([entry({ reason: 'review_due' })]);
    expect(c.currentStrategy).toBe('SPACED');
    expect(c.state()?.mode).toBe('review');
  });

  it('a diagnosed misconception routes to REMEDIATE with the catalogued hint', () => {
    const c = new PedagogicalController([entry()]);
    const decision = c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: 'adds-instead-of-counts-up', attemptNumber: 1 },
      NOW,
    );
    expect(decision.strategy).toBe('REMEDIATE');
    expect(decision.instruction).toContain('Cuenta hacia arriba desde el precio.');
    expect(c.state()?.misconceptionHint).toBe('Cuenta hacia arriba desde el precio.');
    expect(c.state()?.mode).toBe('remediation');
  });

  it('two failures trigger RESCUE, and never two RESCUEs in a row', () => {
    const c = new PedagogicalController([entry({ prereqKcIds: [] })]);
    c.decide({ kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 }, NOW);
    const second = c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
      NOW + 1_000,
    );
    expect(second.strategy).toBe('RESCUE');
    const third = c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
      NOW + 2_000,
    );
    expect(third.strategy).not.toBe('RESCUE');
  });

  it('difficulty never rises after a failure', () => {
    const c = new PedagogicalController([entry({ targetDifficulty: 3 })]);
    const after = c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
      NOW,
    );
    expect(after.difficulty).toBeLessThanOrEqual(3);
    const again = c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
      NOW + 1_000,
    );
    expect(again.difficulty).toBeLessThanOrEqual(after.difficulty);
  });

  it('an unexpected failure PROBEs the prerequisite, and a correct probe returns to REMEDIATE', () => {
    const c = new PedagogicalController([entry({ pKnown: 0.7 })]);
    const probe = c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 },
      NOW,
    );
    expect(probe.strategy).toBe('PROBE');
    // While probing, evidence attaches to the PREREQUISITE.
    expect(c.activeKcId).toBe(KC_PREREQ);
    expect(c.state()?.mode).toBe('probe');

    const back = c.decide(
      { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
      NOW + 5_000,
    );
    expect(back.strategy).toBe('REMEDIATE');
    expect(c.activeKcId).toBe(KC_A);
  });

  it('mastery earns one CELEBRATE and advances to the next plan entry', () => {
    const KC_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    const c = new PedagogicalController([
      entry({ pKnown: 0.8, prereqKcIds: [] }),
      entry({ kcId: KC_B, kcKey: 'biz.profit', pKnown: 0.2, prereqKcIds: [] }),
    ]);
    // One correct answer from 0.8 crosses the 0.85 mastery bar.
    const decision = c.decide(
      { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
      NOW,
    );
    expect(decision.strategy).toBe('CELEBRATE');
    expect(c.activeKcId).toBe(KC_B);
    expect(c.currentStrategy).toBe('DIRECT'); // fresh entry, low mastery band
  });

  it('holds its strategy past three changes per minute — never erratic', () => {
    const c = new PedagogicalController([entry({ pKnown: 0.75, prereqKcIds: [], misconceptions: [] })]);
    // Burn three strategy changes inside one minute.
    c.decide({ kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 }, NOW);
    c.decide({ kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 }, NOW + 1_000);
    c.decide({ kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 }, NOW + 2_000);
    const held = c.currentStrategy;
    const next = c.decide(
      { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
      NOW + 3_000,
    );
    expect(next.strategy).toBe(held);
  });

  it('a hard-won correct answer earns ELABORATE', () => {
    const c = new PedagogicalController([entry({ pKnown: 0.5, prereqKcIds: [], misconceptions: [] })]);
    const decision = c.decide(
      { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 2 },
      NOW,
    );
    expect(decision.strategy).toBe('ELABORATE');
  });

  it('SOCRATIC thinking time is the longest idle budget', () => {
    const c = new PedagogicalController([entry({ pKnown: 0.75 })]);
    const decision = c.decide({ kind: 'entry_opened' }, NOW);
    expect(decision.strategy).toBe('SOCRATIC');
    expect(decision.idleNudgeMs).toBeGreaterThanOrEqual(45_000);
  });

  it('the mirror BKT moves the right way and never freezes', () => {
    expect(mirrorBktUpdate(0.5, true)).toBeGreaterThan(0.5);
    expect(mirrorBktUpdate(0.5, false)).toBeLessThan(0.5);
    let p = 0.9;
    for (let i = 0; i < 30; i++) p = mirrorBktUpdate(p, true);
    expect(p).toBeLessThan(1);
  });
});

describe('the grade echo', () => {
  const SECRET = process.env.TUTOR_SESSION_SECRET as string;
  const payload = {
    segmentId: '44444444-4444-4444-8444-444444444444',
    kcId: KC_A,
    correct: false,
    misconceptionCode: 'adds-instead-of-counts-up',
    exp: Math.floor(NOW / 1000) + 600,
  };

  it('verifies what Core signs (wire-format parity with recordAttempt.ts)', () => {
    const token = mintGradeEcho(payload, SECRET);
    const verdict = verifyGradeEcho(token, NOW);
    expect(verdict).toEqual({ ok: true, payload });
  });

  it('rejects a tampered payload', () => {
    const token = mintGradeEcho(payload, SECRET);
    const parts = token.split('.');
    const forged = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
    forged.correct = true;
    const tampered = `${parts[0]}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${parts[2]}`;
    expect(verifyGradeEcho(tampered, NOW).ok).toBe(false);
  });

  it('rejects a wrong secret and an expired echo', () => {
    const wrong = mintGradeEcho(payload, 'not-the-secret-not-the-secret-00');
    expect(verifyGradeEcho(wrong, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    const expired = mintGradeEcho({ ...payload, exp: Math.floor(NOW / 1000) - 1 }, SECRET);
    expect(verifyGradeEcho(expired, NOW)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects garbage without throwing', () => {
    expect(verifyGradeEcho('', NOW).ok).toBe(false);
    expect(verifyGradeEcho('ge1.zzz', NOW).ok).toBe(false);
    expect(verifyGradeEcho('v1.a.b', NOW).ok).toBe(false);
  });
});
