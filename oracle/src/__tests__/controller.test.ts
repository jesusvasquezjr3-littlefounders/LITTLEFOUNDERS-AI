import { describe, expect, it } from 'vitest';
import {
  IDLE_NUDGE_MS,
  LISTEN_SILENCE_MS,
  mirrorBktUpdate,
  PedagogicalController,
} from '../tutor/controller.js';
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

  /*
   * "NEVER MORE THAN 3 SOCRATIC WITHOUT PROGRESS → DEGRADE TO FADED"
   * (blueprint §9.2). FADED was reachable ONLY by mastery band before this, so
   * a learner who kept answering "no sé" was asked question after question with
   * no scaffolding, indefinitely — the shape the owner's own transcripts show.
   */
  describe('questions that are not working stop being questions', () => {
    /** A learner in the Socratic band: 0.65 ≤ p < 0.85. */
    const socratic = () => new PedagogicalController([entry({ pKnown: 0.8, targetDifficulty: 2 })]);
    const shrug = { kind: 'conversation_turn' } as const;
    const right = { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 } as const;

    it('degrades to a faded example after three Socratic turns that went nowhere', () => {
      /*
       * "No sé" is not a WRONG ANSWER — it is not an answer at all, so
       * `consecutiveFailures` never grows and RESCUE never fires. A first
       * version of this guardrail counted only failed results and was therefore
       * unreachable: two wrong answers trigger rescue before a third can land,
       * and any correct one resets the count. Measuring it is what showed the
       * guardrail was dead code.
       */
      const c = socratic();
      const seen = [0, 1, 2].map((i) => c.decide(shrug, NOW + i * 40_000).strategy);
      expect(seen.slice(0, 2)).toEqual(['SOCRATIC', 'SOCRATIC']);
      expect(seen[2]).toBe('FADED');
    });

    it('keeps asking questions while the learner is still getting them right', () => {
      // Progress resets the streak. A learner who is working must not be
      // demoted to worked examples for pausing to think.
      const c = socratic();
      for (let i = 0; i < 6; i += 1) {
        c.decide(i % 2 === 0 ? right : shrug, NOW + i * 40_000);
      }
      expect(c.decide(shrug, NOW + 7 * 40_000).strategy).not.toBe('FADED');
    });
  });

  /*
   * RESCUE IS A RESET, SO IT NEEDS ROOM TO WORK.
   *
   * Blocking only the immediately-consecutive rescue produced a worse thing
   * than it prevented: with the failure count stuck at two, rescue was proposed
   * every turn and downgraded every second one, giving RESCUE, DIRECT, RESCUE,
   * DIRECT forever. The churn cap cannot catch it — real turns are far enough
   * apart to keep clearing its sixty-second window.
   */
  describe('a learner having a bad run is taught, not bounced', () => {
    const wrong = { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 } as const;
    const right = { ...wrong, correct: true } as const;

    it('rescues once and then keeps teaching', () => {
      const c = new PedagogicalController([entry({ pKnown: 0.8, targetDifficulty: 2 })]);
      const seen = Array.from({ length: 8 }, (_, i) => c.decide(wrong, NOW + i * 60_000).strategy);
      expect(seen.filter((s) => s === 'RESCUE')).toHaveLength(1);
      // The turns after the rescue must not alternate back into it.
      const afterRescue = seen.slice(seen.indexOf('RESCUE') + 1);
      expect(afterRescue).not.toContain('RESCUE');
      expect(new Set(afterRescue).size).toBeLessThanOrEqual(2);
    });

    it('rescues again once the learner has recovered and slumps a second time', () => {
      // The cooldown must not permanently deny support because of one bad patch
      // earlier in the session.
      const c = new PedagogicalController([entry({ pKnown: 0.8, targetDifficulty: 2 })]);
      for (let i = 0; i < 4; i += 1) c.decide(wrong, NOW + i * 60_000);
      c.decide(right, NOW + 5 * 60_000);
      const later = [5, 6, 7].map((i) => c.decide(wrong, NOW + (i + 1) * 60_000).strategy);
      expect(later).toContain('RESCUE');
    });
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
    /*
     * MASTERY NEEDS EVIDENCE, NOT JUST CONFIDENCE.
     *
     * This test used to read "one correct answer from 0.8 crosses the 0.85
     * mastery bar" and assert exactly that — the defect written down as the
     * intended contract. It is true of the arithmetic: the BKT mirror takes a
     * learner from 0.50 to 0.845 on a single right answer. It is not true of
     * teaching. A guess produces that same answer one time in five, and a
     * competent learner finished the entire session plan in three turns, after
     * which the controller went dormant for the rest of the session.
     */
    const KC_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    const c = new PedagogicalController([
      entry({ pKnown: 0.8, prereqKcIds: [] }),
      entry({ kcId: KC_B, kcKey: 'biz.profit', pKnown: 0.2, prereqKcIds: [] }),
    ]);
    const right = { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 } as const;

    // Confident after one answer — and deliberately not finished.
    expect(c.decide(right, NOW).strategy).not.toBe('CELEBRATE');
    expect(c.activeKcId).toBe(KC_A);
    expect(c.decide(right, NOW + 40_000).strategy).not.toBe('CELEBRATE');

    // Three opportunities is the blueprint's own number for a diagnosis.
    expect(c.decide(right, NOW + 80_000).strategy).toBe('CELEBRATE');
    expect(c.activeKcId).toBe(KC_B);
    expect(c.currentStrategy).toBe('DIRECT'); // fresh entry, low mastery band
  });

  describe('a right answer that took too long is not mastery (§8.3)', () => {
    const right = (latencyMs: number | null) =>
      ({ kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1, latencyMs }) as const;
    const fluent = () => new PedagogicalController([entry({ pKnown: 0.8, prereqKcIds: [] })]);

    it('holds the promotion when the learner laboured over it', () => {
      const c = fluent();
      // Two fluent answers establish this learner's own pace...
      c.decide(right(4_000), NOW);
      c.decide(right(4_000), NOW + 40_000);
      // ...and the third, four times slower, is a learner working it out rather
      // than knowing it. Confidence and opportunity count both say promote.
      expect(c.decide(right(16_000), NOW + 80_000).strategy).not.toBe('CELEBRATE');
      // A fluent answer afterwards promotes, so this holds rather than blocks.
      expect(c.decide(right(4_500), NOW + 120_000).strategy).toBe('CELEBRATE');
    });

    it('promotes a learner who is simply consistent, however slow', () => {
      // The threshold is the learner's OWN pace. A careful child who always
      // takes twenty seconds must never be held back for being careful — which
      // is what any absolute number would have done to them.
      const c = fluent();
      c.decide(right(20_000), NOW);
      c.decide(right(21_000), NOW + 40_000);
      expect(c.decide(right(20_500), NOW + 80_000).strategy).toBe('CELEBRATE');
    });

    it('refuses to judge fluency with no measurement', () => {
      // Null is not zero. With nothing measured, behaviour is exactly what it
      // was before the signal existed.
      const c = fluent();
      c.decide(right(null), NOW);
      c.decide(right(null), NOW + 40_000);
      expect(c.decide(right(null), NOW + 80_000).strategy).toBe('CELEBRATE');
    });
  });

  it('credits the evidence a returning learner already produced', () => {
    // The opportunity count is about how much we have SEEN of a learner, and
    // previous sessions are things we saw. A child coming back to a KC they
    // have already been asked about must not re-earn it from zero.
    const c = new PedagogicalController(
      [entry({ pKnown: 0.8, prereqKcIds: [] })],
      [{ kcId: KC_A, kcKey: 'money.make-change-counting-up', pKnown: 0.8, attempts: 4 }],
    );
    const decision = c.decide(
      { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
      NOW,
    );
    expect(decision.strategy).toBe('CELEBRATE');
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

/*
 * THE TURN POLICY — differentiator #1 of the blueprint's fourteen.
 *
 * In customer service you close a turn fast. In tutoring you do the opposite:
 * the silence of a child who is thinking is the most valuable part of the
 * session, and a tutor that talks into it has destroyed the thing it was there
 * to cause. So this is asserted as a RELATIONSHIP rather than as a set of
 * magic numbers — the exact milliseconds will be tuned against real children,
 * but the ordering is the pedagogy and must not silently invert.
 */
describe('per-strategy listening budgets', () => {
  it('waits longest where the learner is thinking, shortest where pace is the point', () => {
    // An open question and "explain why it works" produce the longest answers
    // in the whole session; a recall drill wants the next card.
    expect(LISTEN_SILENCE_MS.SOCRATIC).toBeGreaterThan(LISTEN_SILENCE_MS.DIRECT);
    expect(LISTEN_SILENCE_MS.ELABORATE).toBeGreaterThan(LISTEN_SILENCE_MS.DIRECT);
    expect(LISTEN_SILENCE_MS.PROBE).toBeGreaterThan(LISTEN_SILENCE_MS.FLUENCY);
    expect(LISTEN_SILENCE_MS.FLUENCY).toBeLessThan(LISTEN_SILENCE_MS.SOCRATIC);
  });

  it('never rushes a frustrated learner more than a fluent one', () => {
    // RESCUE is the beat where being cut off is most expensive.
    expect(LISTEN_SILENCE_MS.RESCUE).toBeGreaterThan(LISTEN_SILENCE_MS.FLUENCY);
  });

  it('gives every strategy a budget a six-year-old can actually use', () => {
    // A voice assistant closes at ~700ms. A child is not a voice assistant, and
    // a zero or a missing entry would cut them off the moment they breathe.
    for (const [strategy, ms] of Object.entries(LISTEN_SILENCE_MS)) {
      expect(ms, `${strategy} is too impatient`).toBeGreaterThanOrEqual(900);
      expect(ms, `${strategy} would feel broken`).toBeLessThanOrEqual(5_000);
    }
  });

  it('covers every strategy the controller can choose', () => {
    for (const s of Object.keys(IDLE_NUDGE_MS)) {
      expect(LISTEN_SILENCE_MS[s as keyof typeof LISTEN_SILENCE_MS]).toBeDefined();
    }
  });
});

describe('the backward walk is a diagnosis, not a guess', () => {
  /*
   * The blueprint calls this the product's "wow" moment: walk the graph
   * backwards and find the gap from two years ago rather than reteaching the
   * step they just failed.
   *
   * It took `prereqKcIds[0]` — the FIRST prerequisite in array order, which is
   * authoring order. So it probed whichever idea the curriculum happened to
   * list first and called that a diagnosis. Core has been sending `kcStates`,
   * this learner's mastery of every knowledge component, the whole time, and
   * nothing read it — the same shape as `turnHistory`.
   */
  const STRONG = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  const WEAK = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
  const UNSEEN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3';

  function planWith(prereqs: string[]): SessionPlanEntry[] {
    return [
      {
        kcId: KC_A,
        kcKey: 'money.add-money',
        skillKey: null,
        reason: 'frontier',
        pKnown: 0.7,
        targetDifficulty: 3,
        objective: 'sumar dinero',
        prereqKcIds: prereqs,
        misconceptions: [],
      },
    ];
  }

  /** Fails the entry once from a confident prior, which is what triggers PROBE. */
  function failInto(controller: PedagogicalController): void {
    controller.decide({ kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 }, 0);
  }

  it('probes the prerequisite with the LOWEST mastery, not the first listed', () => {
    const controller = new PedagogicalController(planWith([STRONG, WEAK]), [
      { kcId: STRONG, kcKey: 'a', pKnown: 0.9, attempts: 8 },
      { kcId: WEAK, kcKey: 'b', pKnown: 0.2, attempts: 6 },
    ]);
    failInto(controller);
    expect(controller.currentStrategy).toBe('PROBE');
    expect(controller.activeKcId).toBe(WEAK);
  });

  it('treats a prerequisite with NO evidence as the weakest of all', () => {
    // Never assessed is not the same as known, and it is exactly where a
    // hidden gap survives — which is the reason to look backwards at all.
    const controller = new PedagogicalController(planWith([STRONG, UNSEEN]), [
      { kcId: STRONG, kcKey: 'a', pKnown: 0.9, attempts: 8 },
      { kcId: UNSEEN, kcKey: 'c', pKnown: 0.4, attempts: 0 },
    ]);
    failInto(controller);
    expect(controller.activeKcId).toBe(UNSEEN);
  });

  it('still works when Core sent no mastery at all', () => {
    // An older Core, or a first session. Falling back to the first
    // prerequisite is the old behaviour, and it must not crash.
    const controller = new PedagogicalController(planWith([STRONG, WEAK]));
    failInto(controller);
    expect(controller.activeKcId).toBe(STRONG);
  });
});
