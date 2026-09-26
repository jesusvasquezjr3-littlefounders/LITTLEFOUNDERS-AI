import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ControllerSnapshotSchema,
  CORROBORATION_MIN_OBSERVATIONS,
  IDLE_NUDGE_MS,
  LISTEN_SILENCE_MS,
  listenSilenceMsFor,
  MASTERY_MIN_OPPORTUNITIES,
  mirrorBktUpdate,
  NEW_TO_SKILL_OPPORTUNITIES,
  NEW_TO_SKILL_SILENCE_GRACE,
  PedagogicalController,
} from '../tutor/controller.js';
import type { KcState, SessionPlanEntry } from '../core/client.js';
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

  /*
   * C.10: a diagnosis is acted on only once CORROBORATED — two consecutive
   * observations agreeing on it. Here the learner states the wrong idea and
   * then applies it on a graded item: two observations, one failure (so the
   * rescue guardrail stays out of the way), and REMEDIATE opens.
   */
  const statedIdea = { kind: 'stated_misconception', misconceptionCode: 'adds-instead-of-counts-up' } as const;

  it('a SINGLE diagnosed miss is held, not remediated (C.10)', () => {
    const c = new PedagogicalController([entry()]);
    const decision = c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: 'adds-instead-of-counts-up', attemptNumber: 1 },
      NOW,
    );
    expect(decision.strategy).not.toBe('REMEDIATE');
    expect(decision.misconceptionCode).toBeNull();
    expect(c.state()?.misconceptionHint).toBeNull();
  });

  it('a CORROBORATED misconception routes to REMEDIATE with the catalogued hint', () => {
    const c = new PedagogicalController([entry()]);
    c.decide(statedIdea, NOW);
    const decision = c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: 'adds-instead-of-counts-up', attemptNumber: 1 },
      NOW + 1_000,
    );
    expect(decision.strategy).toBe('REMEDIATE');
    expect(decision.evidence).toEqual({ rule: 'remediation', observations: 2, required: 2 });
    expect(decision.instruction).toContain('Cuenta hacia arriba desde el precio.');
    expect(c.state()?.misconceptionHint).toBe('Cuenta hacia arriba desde el precio.');
    expect(c.state()?.mode).toBe('remediation');
  });

  /*
   * A DIAGNOSIS DOES NOT OUTLIVE THE REMEDIATION IT WAS FOR (adversarial
   * review, 2026-08-29). `misconceptionCode` was set ONLY inside the
   * activity_result/voice_result branch of `decide()` — a `conversation_turn`
   * never touched it, by design (rule 6 excludes `conversation_turn` from
   * ELABORATE). A learner who deflects a REMEDIATE turn with an ordinary chat
   * reply moves `mode` on correctly (`baseStrategy` picks a fresh strategy),
   * but `misconceptionHint` — sent to the model in the SAME context payload —
   * kept asserting the resolved diagnosis, flatly contradicting `mode` in the
   * model's own turn context, for every conversational turn afterward until
   * the next graded result happened to overwrite it.
   */
  it('clears the misconception hint the moment the strategy leaves REMEDIATE via ordinary chat', () => {
    const c = new PedagogicalController([entry({ pKnown: 0.9 })]);
    c.decide(statedIdea, NOW - 1_000);
    c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: 'adds-instead-of-counts-up', attemptNumber: 1 },
      NOW,
    );
    expect(c.state()?.mode).toBe('remediation');
    expect(c.state()?.misconceptionHint).not.toBeNull();

    // An ordinary conversational deflection — not a retry, not graded.
    const after = c.decide({ kind: 'conversation_turn' }, NOW + 1_000);

    expect(after.strategy).not.toBe('REMEDIATE');
    expect(c.state()?.mode).not.toBe('remediation');
    // The bug: this stayed the OLD hint text even though `mode` above already
    // says the diagnosis is no longer active.
    expect(c.state()?.misconceptionHint).toBeNull();
    expect(after.misconceptionCode).toBeNull();
  });

  it('does NOT clear the misconception hint while still inside REMEDIATE', () => {
    // The fix must be scoped to LEAVING remediation, not to every turn —
    // an unrelated conversational aside mid-remediation must not erase a
    // diagnosis that is still the active one.
    const c = new PedagogicalController([entry({ pKnown: 0.9, targetDifficulty: 1 })]);
    c.decide(statedIdea, NOW - 1_000);
    c.decide(
      { kind: 'activity_result', correct: false, misconceptionCode: 'adds-instead-of-counts-up', attemptNumber: 1 },
      NOW,
    );
    expect(c.state()?.mode).toBe('remediation');

    // A hard-won correct answer after REMEDIATE routes to ELABORATE, not away
    // from remediation via chat — the hint should still be live here since
    // this event itself reports which misconception was checked.
    const after = c.decide(
      { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 2 },
      NOW + 1_000,
    );
    expect(after.strategy).toBe('ELABORATE');
    // Answered correctly, so line 385's own logic already clears it — this
    // is the EXISTING mechanism working, not the new one firing redundantly.
    expect(after.misconceptionCode).toBeNull();
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
   * TRANSFER WAS DEAD CODE (adversarial review, 2026-08-29): `applyStrategy`'s
   * CELEBRATE branch set `this.celebrated = true` and then, in the SAME
   * synchronous call, `advanceEntry()` unconditionally reset it back to
   * `false` — so `propose()`'s `this.celebrated ? 'TRANSFER' : 'CELEBRATE'`
   * could never observe `true`. No input sequence could ever produce
   * TRANSFER, despite it having its own skill file (transfer-probe.md), its
   * own turn-policy budgets, and its own line in STRATEGY_INSTRUCTIONS.
   */
  describe('mastering a knowledge component TWICE — CELEBRATE once, TRANSFER the second time', () => {
    /*
     * `activity_result` carries no `kcId` of its own — the controller reads
     * it against WHATEVER entry `this.entryIndex` currently points at. Two
     * plan entries sharing the same `kcId` (a frontier pass, then its own
     * review-due re-encounter) is what makes "the same KC comes up twice"
     * observable at all: `advanceEntry()` moves the pointer from the first
     * to the second on CELEBRATE, and the second entry's `entry.kcId` is
     * the SAME string, which is exactly what `celebratedKcIds` keys on.
     */
    const masteringOpportunities = () =>
      Array.from({ length: MASTERY_MIN_OPPORTUNITIES }, () => ({
        kind: 'activity_result' as const,
        correct: true,
        misconceptionCode: null,
        attemptNumber: 1,
      }));

    it('CELEBRATEs the first time a KC is mastered, and advances the plan', () => {
      const c = new PedagogicalController([
        entry({ kcId: KC_A, pKnown: 0.9 }),
        entry({ kcId: KC_A, reason: 'review_due', pKnown: 0.9 }),
      ]);
      let last;
      for (const [i, event] of masteringOpportunities().entries()) {
        last = c.decide(event, NOW + i * 1_000);
      }
      expect(last!.strategy).toBe('CELEBRATE');
      // Advanced to the second plan entry, the review-due re-encounter.
      expect(c.state()?.mode).toBe('review');
    });

    it('TRANSFERs — not CELEBRATEs again — when the SAME kcId is mastered a second time', () => {
      // The whole point of the strategy (transfer-probe.md: "check it
      // travels"): a KC that comes back via spaced review and is ALSO
      // mastered there is the one real opportunity to verify the skill
      // generalizes, rather than only ever having been shown in one story.
      //
      // Only ONE further correct answer is needed here, not another three:
      // `this.opportunities`/`this.pKnown` are keyed by kcId and already
      // cleared the mastery bar during the first batch, so the SAME kcId's
      // very next correct answer re-qualifies immediately — it is rule 5's
      // `celebratedKcIds` check, not a fresh opportunity count, that must
      // now say TRANSFER instead of CELEBRATE.
      const c = new PedagogicalController([
        entry({ kcId: KC_A, pKnown: 0.9 }),
        entry({ kcId: KC_A, reason: 'review_due', pKnown: 0.9 }),
      ]);
      const opportunities = masteringOpportunities();
      opportunities.forEach((event, i) => c.decide(event, NOW + i * 1_000));
      const again = c.decide(
        { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
        NOW + 10_000,
      );
      expect(again.strategy).toBe('TRANSFER');
    });

    /*
     * MASTERY IS RECONSIDERED, NOT DECLARED ONCE (owner decision, 2026-09-01).
     *
     * The gap these three tests close was found by the pedagogy gym's
     * `fragile hesitant` archetype and tracked in its `KNOWN_GAPS`: mastery
     * was evaluated exactly once, and a later run of slow-but-correct answers
     * — blueprint §8.3's fragile-mastery signal — could not reach the
     * decision it should have changed.
     *
     * Latencies are supplied explicitly here because `masteringOpportunities`
     * deliberately carries none: `answeredHesitantly` refuses to judge without
     * them, which is why every OTHER test in this file is unaffected by this
     * behaviour existing at all.
     */
    const fastCorrect = (latencyMs: number) => ({
      kind: 'activity_result' as const,
      correct: true,
      misconceptionCode: null,
      attemptNumber: 1,
      latencyMs,
    });

    it('takes mastery BACK when a celebrated KC comes back and the learner is correct but hesitant', () => {
      const c = new PedagogicalController([
        entry({ kcId: KC_A, pKnown: 0.9 }),
        entry({ kcId: KC_A, reason: 'review_due', pKnown: 0.9 }),
      ]);
      // Three fast, correct answers establish both the pace baseline and the
      // promotion — this is the exact evidence the gym archetype promotes on.
      let last;
      for (let i = 0; i < MASTERY_MIN_OPPORTUNITIES; i += 1) {
        last = c.decide(fastCorrect(1_500), NOW + i * 1_000);
      }
      expect(last!.strategy).toBe('CELEBRATE');
      expect(c.revokedMasteryKcIds).toEqual([]);

      // Same KC, review-due re-encounter, still CORRECT — but at six times
      // their own established pace. Mastery must not survive this.
      const hesitant = c.decide(fastCorrect(9_000), NOW + 10_000);
      expect(hesitant.strategy).not.toBe('TRANSFER');
      expect(hesitant.strategy).not.toBe('CELEBRATE');
      expect(c.revokedMasteryKcIds).toEqual([KC_A]);
    });

    it('a revoked KC must EARN mastery again — two consecutive qualifying answers (C.10), not zero', () => {
      const c = new PedagogicalController([
        entry({ kcId: KC_A, pKnown: 0.9 }),
        entry({ kcId: KC_A, reason: 'review_due', pKnown: 0.9 }),
      ]);
      for (let i = 0; i < MASTERY_MIN_OPPORTUNITIES; i += 1) {
        c.decide(fastCorrect(1_500), NOW + i * 1_000);
      }
      c.decide(fastCorrect(9_000), NOW + 10_000); // revokes
      // Back at their own pace. ONE such answer is a single observation and
      // must not re-declare mastery (C.10); the second corroborates it, and
      // because the KC WAS celebrated before, it comes back as TRANSFER.
      expect(c.decide(fastCorrect(1_500), NOW + 11_000).strategy).not.toBe('TRANSFER');
      const regained = c.decide(fastCorrect(1_500), NOW + 12_000);
      expect(regained.strategy).toBe('TRANSFER');
      expect(regained.evidence).toEqual({ rule: 'mastery', observations: 2, required: 2 });
    });

    it('a WRONG answer on a celebrated KC revokes it too — not only a slow one', () => {
      const c = new PedagogicalController([
        entry({ kcId: KC_A, pKnown: 0.9 }),
        entry({ kcId: KC_A, reason: 'review_due', pKnown: 0.9 }),
      ]);
      for (let i = 0; i < MASTERY_MIN_OPPORTUNITIES; i += 1) {
        c.decide(fastCorrect(1_500), NOW + i * 1_000);
      }
      c.decide(
        {
          kind: 'activity_result',
          correct: false,
          misconceptionCode: null,
          attemptNumber: 1,
          latencyMs: 1_500,
        },
        NOW + 10_000,
      );
      expect(c.revokedMasteryKcIds).toEqual([KC_A]);
    });

    it('TRANSFER still advances the plan — it must not strand the entry it resolves', () => {
      const c = new PedagogicalController([
        entry({ kcId: KC_A, pKnown: 0.9 }),
        entry({ kcId: KC_A, reason: 'review_due', pKnown: 0.9 }),
        entry({ kcId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', pKnown: 0.1 }),
      ]);
      masteringOpportunities().forEach((event, i) => c.decide(event, NOW + i * 1_000));
      c.decide(
        { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
        NOW + 10_000,
      );
      // Past both KC_A entries and onto the third, unrelated one.
      expect(c.activeKcId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');
    });

    it('a DIFFERENT KC mastered for the first time still CELEBRATEs, even after another KC transferred', () => {
      // celebratedKcIds must be scoped per KC — a single reused flag would
      // either block every later CELEBRATE or none of them.
      const KC_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
      const c = new PedagogicalController([
        entry({ kcId: KC_A, pKnown: 0.9 }),
        entry({ kcId: KC_A, reason: 'review_due', pKnown: 0.9 }),
        entry({ kcId: KC_B, pKnown: 0.9 }),
      ]);
      masteringOpportunities().forEach((event, i) => c.decide(event, NOW + i * 1_000));
      c.decide(
        { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
        NOW + 10_000,
      );
      // Now on KC_B, which starts with zero opportunities of its own —
      // needs its own fresh MASTERY_MIN_OPPORTUNITIES, same as any KC
      // meeting the bar for the first time.
      let last;
      for (const [i, event] of masteringOpportunities().entries()) {
        last = c.decide(event, NOW + 20_000 + i * 1_000);
      }
      expect(last!.strategy).toBe('CELEBRATE');
    });
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
   * DIRECT and WORKED have no lower rung to degrade to the way SOCRATIC and
   * FLUENCY degrade to FADED — found live, testing as a struggling learner,
   * 2026-08-30: answering "no sé" repeatedly to a WORKED example produced a
   * fresh example with new numbers every turn, forever, because a
   * conversational shrug is a `conversation_turn`, never a graded failure, so
   * `consecutiveFailures` never grew and rule 1's RESCUE never fired. This is
   * the same "sin progreso" streak the Socratic fix above already counts —
   * it was just never spent on these two bands.
   */
  describe('a learner stuck in DIRECT or WORKED, not just SOCRATIC, gets rescued', () => {
    const shrug = { kind: 'conversation_turn' } as const;
    const right = { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 } as const;

    it('escalates to RESCUE after three WORKED turns that went nowhere', () => {
      const c = new PedagogicalController([entry({ pKnown: 0.4, targetDifficulty: 2 })]);
      const seen = [0, 1, 2].map((i) => c.decide(shrug, NOW + i * 40_000).strategy);
      expect(seen.slice(0, 2)).toEqual(['WORKED', 'WORKED']);
      expect(seen[2]).toBe('RESCUE');
    });

    it('escalates to RESCUE after three DIRECT turns that went nowhere', () => {
      const c = new PedagogicalController([entry({ pKnown: 0.1, targetDifficulty: 2 })]);
      const seen = [0, 1, 2].map((i) => c.decide(shrug, NOW + i * 40_000).strategy);
      expect(seen.slice(0, 2)).toEqual(['DIRECT', 'DIRECT']);
      expect(seen[2]).toBe('RESCUE');
    });

    it('keeps teaching while the learner is still getting them right', () => {
      const c = new PedagogicalController([entry({ pKnown: 0.4, targetDifficulty: 2 })]);
      for (let i = 0; i < 6; i += 1) {
        c.decide(i % 2 === 0 ? right : shrug, NOW + i * 40_000);
      }
      expect(c.decide(shrug, NOW + 7 * 40_000).strategy).not.toBe('RESCUE');
    });
  });

  /*
   * SPACED has the identical "no lower rung to fall back to" shape as DIRECT/
   * WORKED/FADED above — found by adversarial review, round 22 (2026-08-30,
   * HIGH): `baseStrategy` returns SPACED unconditionally for a due review,
   * with no `stuck` check at all, and SPACED was missing from the set rule
   * 1b's counter tracks. A learner who deflects a spaced-review question with
   * "no sé" produces only `conversation_turn` events — never a graded
   * failure — so before this fix the controller proposed SPACED forever,
   * with no escalation path whatsoever.
   */
  describe('a learner stuck in SPACED, not just DIRECT/WORKED/FADED, gets rescued', () => {
    const shrug = { kind: 'conversation_turn' } as const;
    const right = { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 } as const;

    it('escalates to RESCUE after three SPACED turns that went nowhere', () => {
      const c = new PedagogicalController([entry({ reason: 'review_due', pKnown: 0.9 })]);
      const seen = [0, 1, 2].map((i) => c.decide(shrug, NOW + i * 40_000).strategy);
      expect(seen.slice(0, 2)).toEqual(['SPACED', 'SPACED']);
      expect(seen[2]).toBe('RESCUE');
    });

    it('keeps reviewing while the learner is still getting the reviews right', () => {
      const c = new PedagogicalController([entry({ reason: 'review_due', pKnown: 0.9 })]);
      for (let i = 0; i < 6; i += 1) {
        c.decide(i % 2 === 0 ? right : shrug, NOW + i * 40_000);
      }
      expect(c.decide(shrug, NOW + 7 * 40_000).strategy).not.toBe('RESCUE');
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

  it('an unexpected failure PROBEs the prerequisite; a correct probe on ONE miss returns to ordinary teaching (C.10)', () => {
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
    // Pre-C.10 this remediated the original KC on the single miss that
    // opened the probe. The probe still closes and the learner is back on
    // the original KC — taught, not remediated, until a second observation.
    expect(back.strategy).not.toBe('REMEDIATE');
    expect(back.evidence).toBeNull();
    expect(c.activeKcId).toBe(KC_A);
    expect(c.state()?.mode).not.toBe('probe');
  });

  it('a correct probe remediates the original KC once its own misses are corroborated', () => {
    // Below the 0.55 "unexpected" bar the first miss does not probe; the
    // second trips rescue; the third probes (two consecutive failures). The
    // original KC now carries three agreeing misses, so a correct probe
    // remediates it — with that evidence on the decision.
    const c = new PedagogicalController([entry({ pKnown: 0.5, misconceptions: [] })]);
    const miss = { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 } as const;
    expect(c.decide(miss, NOW).strategy).not.toBe('PROBE');
    expect(c.decide(miss, NOW + 90_000).strategy).toBe('RESCUE');
    expect(c.decide(miss, NOW + 180_000).strategy).toBe('PROBE');
    const back = c.decide(
      { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
      NOW + 270_000,
    );
    expect(back.strategy).toBe('REMEDIATE');
    expect(back.evidence).toEqual({ rule: 'remediation', observations: 3, required: 2 });
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

  /*
   * Found live, 2026-08-31 (AGENTS.md item 81): `TutorOrchestrator.lessonThread`
   * (the HUD's "step X of Y" badge) used to be blind to everything this
   * controller does — a direct drive of the real orchestrator against the
   * real model showed `activeKcId` change to a brand-new knowledge component
   * on exactly this CELEBRATE, while the badge's own counter (driven by
   * `tutor/plan.ts`'s unrelated macro arc) had already capped and never
   * moved again. `kcProgress` is the fix's other half: a KC-scoped counter
   * `lessonThread` can read instead.
   */
  describe('kcProgress — the unit lessonThread counts by while this controller steers', () => {
    it('is null while dormant, exactly like activeKcId', () => {
      const c = new PedagogicalController([]);
      expect(c.kcProgress).toBeNull();
    });

    it('starts at "1 of N" the moment a plan is seeded, before any turn', () => {
      const c = new PedagogicalController([entry(), entry({ kcId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2' })]);
      expect(c.kcProgress).toEqual({ index: 1, of: 2 });
    });

    it('advances to "2 of N" on the SAME mastery event that moves activeKcId', () => {
      const KC_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
      const c = new PedagogicalController([
        entry({ pKnown: 0.8, prereqKcIds: [] }),
        entry({ kcId: KC_B, kcKey: 'biz.profit', pKnown: 0.2, prereqKcIds: [] }),
      ]);
      const right = { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 } as const;
      expect(c.kcProgress).toEqual({ index: 1, of: 2 });

      c.decide(right, NOW);
      c.decide(right, NOW + 40_000);
      expect(c.kcProgress).toEqual({ index: 1, of: 2 }); // not yet — only 2 opportunities

      c.decide(right, NOW + 80_000); // CELEBRATE fires here
      expect(c.activeKcId).toBe(KC_B);
      expect(c.kcProgress).toEqual({ index: 2, of: 2 });
    });

    it('goes dormant (null) once every planned KC is mastered, the same turn activeKcId does', () => {
      const c = new PedagogicalController([entry({ pKnown: 0.8, prereqKcIds: [] })]);
      const right = { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 } as const;
      c.decide(right, NOW);
      c.decide(right, NOW + 40_000);
      c.decide(right, NOW + 80_000); // the only entry — CELEBRATE ends the plan
      expect(c.active).toBe(false);
      expect(c.activeKcId).toBeNull();
      expect(c.kcProgress).toBeNull();
    });

    it('holds still while probing a prerequisite — a probe is a detour, not a new unit', () => {
      const c = new PedagogicalController([entry({ pKnown: 0.7 })]);
      expect(c.kcProgress).toEqual({ index: 1, of: 1 });
      c.decide({ kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 }, NOW);
      expect(c.activeKcId).toBe(KC_PREREQ); // now probing
      expect(c.kcProgress).toEqual({ index: 1, of: 1 }); // unchanged
    });
  });

  describe('a guess is not a diagnosis (§8.3)', () => {
    /*
     * Our content playbook requires every wrong option to encode a specific
     * misconception ("tempting AND diagnostic"), so a child tapping at random
     * lands on a diagnosed wrong idea nearly every time they miss. The better
     * the distractors, the more confidently wrong the diagnosis.
     */
    const right = (latencyMs: number) =>
      ({ kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1, latencyMs }) as const;
    const wrong = (latencyMs: number | null) =>
      ({
        kind: 'activity_result',
        correct: false,
        misconceptionCode: 'adds-instead-of-counts-up',
        attemptNumber: 1,
        latencyMs,
      }) as const;
    /** Two fluent answers establish this learner's own pace. */
    const paced = () => {
      const c = new PedagogicalController([entry({ pKnown: 0.7, prereqKcIds: [] })]);
      c.decide(right(9_000), NOW);
      c.decide(right(9_000), NOW + 40_000);
      return c;
    };

    const stated = { kind: 'stated_misconception', misconceptionCode: 'adds-instead-of-counts-up' } as const;

    it('does not remediate an idea the child never had', () => {
      const c = paced();
      // Even with the idea stated once already: a guess is not the second
      // observation that would corroborate it (C.10 — a guess is neutral).
      c.decide(stated, NOW + 60_000);
      const decision = c.decide(wrong(600), NOW + 80_000);
      expect(decision.strategy).not.toBe('REMEDIATE');
      expect(decision.instruction).toContain('disengagement');
    });

    it('still remediates a real attempt that went wrong', () => {
      // The same wrong answer, thought about. This is the case the catalogued
      // hint exists for, and it must survive the guess detector intact. C.10:
      // corroborated by the learner having stated the same idea first.
      const c = paced();
      c.decide(stated, NOW + 60_000);
      const decision = c.decide(wrong(11_000), NOW + 80_000);
      expect(decision.strategy).toBe('REMEDIATE');
      expect(decision.instruction).not.toContain('disengagement');
    });

    it('refuses to call anything a guess without a measurement', () => {
      const c = paced();
      c.decide(stated, NOW + 60_000);
      expect(c.decide(wrong(null), NOW + 80_000).strategy).toBe('REMEDIATE');
    });

    /*
     * Found by the pedagogy gym's "fragile hesitant" archetype, 2026-09-01
     * (`pedagogyGym.ts`'s own comment on that archetype has the full
     * mechanism): `correctLatencies` used to grow without bound, so a
     * SUSTAINED run of unusually slow (but correct) answers would eventually
     * drag the comparison median toward that slow pace itself — at which
     * point a WRONG, genuinely-fast answer stops looking fast BY COMPARISON,
     * and `answeredWithoutReading` silently stops firing. This targets the
     * shared root cause (`correctLatencies`'s own append site, now capped at
     * `LATENCY_BASELINE_SIZE`) through its OTHER consumer, deliberately —
     * `answeredHesitantly`'s own equivalent scenario is entangled with the
     * mastery/opportunity gate (three correct answers alone are usually
     * enough to satisfy both at once, leaving no room to observe a SUSTAINED
     * slow run before the KC completes), where this one is not.
     */
    it("a long run of slow (but correct) answers afterward does not drag the baseline toward it", () => {
      const c = new PedagogicalController([entry({ pKnown: 0.3, prereqKcIds: [] })]);
      // A wrong answer between every correct one, throughout — otherwise the
      // mirror's own BKT update crosses the mastery bar within two or three
      // STRAIGHT correct answers regardless of starting point (textbook BKT
      // is simply that steep), which would complete this single-entry plan
      // and make it dormant long before the slow run this test needs even
      // starts. Alternating holds the posterior in the 0.7-0.85 band
      // indefinitely (verified numerically before writing this), so the ONLY
      // thing being exercised turn to turn is the latency history — not an
      // accidental race against mastery.
      let t = NOW;
      const tick = () => (t += 40_000);
      // Three fast correct answers — AT `LATENCY_BASELINE_SIZE` — establish,
      // and freeze, this learner's baseline pace.
      c.decide(right(9_000), tick());
      c.decide(wrong(9_000), tick());
      c.decide(right(9_000), tick());
      c.decide(wrong(9_000), tick());
      c.decide(right(9_000), tick());
      // Five MORE correct answers, all unusually slow. An unfrozen history
      // would let these outnumber the original three and pull the median
      // from 9,000 toward 40,000.
      for (let i = 0; i < 5; i++) {
        c.decide(wrong(9_000), tick());
        c.decide(right(40_000), tick());
      }
      // The probe: a wrong answer at 5,000ms. Genuinely fast against the
      // FROZEN 9,000ms baseline (5,000 * GUESS_FACTOR = 15,000, which is NOT
      // under 9,000 — not a guess) but would read as a guess against a
      // contaminated ~40,000ms one (15,000 IS under that) — the two
      // baselines disagree on this exact input on purpose, so this proves
      // which one the controller is actually using rather than merely being
      // consistent with either.
      // C.10: the stated idea is the first observation; the probe is the
      // second only if it is NOT read as a guess — which is the question.
      c.decide(stated, tick());
      const decision = c.decide(wrong(5_000), tick());
      expect(decision.strategy).toBe('REMEDIATE');
      expect(decision.instruction).not.toContain('disengagement');
    });
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
      // The laboured answer broke the C.10 chain: the next fluent answer is
      // one observation, and the one after it corroborates — so this HOLDS
      // rather than blocks.
      expect(c.decide(right(4_500), NOW + 120_000).strategy).not.toBe('CELEBRATE');
      expect(c.decide(right(4_500), NOW + 160_000).strategy).toBe('CELEBRATE');
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

  it('credits the evidence a returning learner already produced — but not as today’s corroboration', () => {
    // The opportunity count is about how much we have SEEN of a learner, and
    // previous sessions are things we saw. A child coming back to a KC they
    // have already been asked about must not re-earn it from zero: two
    // answers today suffice, not three.
    //
    // C.10: before, ONE correct answer today declared mastery on the strength
    // of old attempts — exactly the single-observation declaration the SPEC
    // forbids. Today's two consecutive answers are the corroboration.
    const c = new PedagogicalController(
      [entry({ pKnown: 0.8, prereqKcIds: [] })],
      [{ kcId: KC_A, kcKey: 'money.make-change-counting-up', pKnown: 0.8, attempts: 4 }],
    );
    const right = { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 } as const;
    expect(c.decide(right, NOW).strategy).not.toBe('CELEBRATE');
    const decision = c.decide(right, NOW + 40_000);
    expect(decision.strategy).toBe('CELEBRATE');
    expect(decision.evidence).toEqual({ rule: 'mastery', observations: 2, required: 2 });
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

/*
 * A LEARNER NEW TO A KNOWLEDGE COMPONENT GETS A LITTLE LONGER TO ANSWER IT.
 *
 * Round 103 (RUNBOOK.md), confirmed MEDIUM, adversarial review sweep
 * tutor-review-sweep-101 (voice-audio-quality dimension): `LISTEN_SILENCE_MS`
 * above is a fixed, strategy-only table with NO per-learner adjustment, so a
 * genuine speech-timing difference — a stutter block, real processing delay,
 * a child who needs a beat before answering, all real for the learners this
 * product serves — produces silence the turn detector cannot tell apart from
 * "done talking." `listenSilenceMsFor` closes that gap for the population
 * most likely to need it: a learner meeting a knowledge component for the
 * first time or two.
 *
 * `wouldEndTurn` mirrors — without importing, since `frontend/` is a
 * separate package with no shared code (`/AGENTS.md` §1.2) — the ONE
 * comparison `createTurnDetector` in `frontend/src/tutor/turnDetector.ts`
 * actually uses to close a turn: `speechMs >= minSpeechMs && silenceMs >=
 * policy.silenceMs`. Real speech is a given in every case below, so only the
 * silence side of that comparison is exercised here — this grounds the proof
 * in the real cutoff condition rather than in the abstract constant alone.
 */
describe('a learner new to a knowledge component gets a longer listening budget', () => {
  const wouldEndTurn = (silenceMs: number, budgetMs: number) => silenceMs >= budgetMs;
  const strategies = Object.keys(LISTEN_SILENCE_MS) as (keyof typeof LISTEN_SILENCE_MS)[];

  it('the fixed table alone would cut off a first-exposure learner mid-pause', () => {
    // A child new to DIRECT instruction on this KC pauses 1.9s — a stutter
    // block, or a beat to gather their words. Against the OLD, fixed budget
    // alone that already crosses the line, so the turn would end right there.
    const pauseMs = 1_900;
    expect(wouldEndTurn(pauseMs, LISTEN_SILENCE_MS.DIRECT)).toBe(true);
  });

  it('the fix extends the window in that exact case, so the SAME pause does not end it', () => {
    const pauseMs = 1_900;
    const extended = listenSilenceMsFor('DIRECT', 0); // first-ever opportunity on this KC
    expect(wouldEndTurn(pauseMs, extended)).toBe(false);
    expect(extended).toBeGreaterThan(pauseMs); // real room to resume, not a hair short
  });

  it('extends every strategy in proportion to its own budget, not by a flat constant', () => {
    for (const strategy of strategies) {
      const base = LISTEN_SILENCE_MS[strategy];
      const expected = Math.round(base * (1 + NEW_TO_SKILL_SILENCE_GRACE));
      expect(listenSilenceMsFor(strategy, 0)).toBe(expected);
      expect(listenSilenceMsFor(strategy, NEW_TO_SKILL_OPPORTUNITIES - 1)).toBe(expected);
    }
  });

  it('leaves genuinely-experienced silence ending the turn exactly as before', () => {
    // At and beyond the threshold, the budget is byte-identical to the
    // original fixed table — the same silence that ended an experienced
    // learner's turn before this fix still ends it, at the exact same
    // millisecond. This is the population the finding explicitly says must
    // be left untouched.
    for (const strategy of strategies) {
      expect(listenSilenceMsFor(strategy, NEW_TO_SKILL_OPPORTUNITIES)).toBe(LISTEN_SILENCE_MS[strategy]);
      expect(listenSilenceMsFor(strategy, NEW_TO_SKILL_OPPORTUNITIES + 5)).toBe(LISTEN_SILENCE_MS[strategy]);
    }
    // Concretely: the exact 1.9s pause a first-exposure learner is now
    // rescued from still, correctly, ends an experienced learner's turn.
    expect(wouldEndTurn(1_900, listenSilenceMsFor('DIRECT', NEW_TO_SKILL_OPPORTUNITIES))).toBe(true);
  });

  it('flows end to end through the real controller, seeded from PERSISTED history', () => {
    // A learner returning to a KC they have already been assessed on many
    // times before — Core's persisted `attempts`, not this session's own
    // count — must not be treated as new just because this is a fresh
    // session. `opportunities` is seeded from `kcStates` in the constructor.
    const seasoned: KcState[] = [
      { kcId: KC_A, kcKey: 'money.make-change-counting-up', pKnown: 0.4, attempts: 6 },
    ];
    const c = new PedagogicalController([entry()], seasoned);
    const decision = c.decide(
      { kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 },
      NOW,
    );
    expect(decision.listenSilenceMs).toBe(LISTEN_SILENCE_MS[decision.strategy]);
  });

  it('a brand-new KC — no persisted history at all — gets the extended budget on its very first turn', () => {
    const c = new PedagogicalController([entry()]); // no kcStates: never seen before
    const decision = c.decide({ kind: 'entry_opened' }, NOW);
    expect(decision.listenSilenceMs).toBe(listenSilenceMsFor(decision.strategy, 0));
    expect(decision.listenSilenceMs).toBeGreaterThan(LISTEN_SILENCE_MS[decision.strategy]);
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

/*
 * WHAT THE LADDER ACTUALLY SERVED, NOT WHAT WE ASKED FOR.
 *
 * Found by adversarial review, round 59 (2026-08-30, MEDIUM), deferred to
 * round 74. `lastDifficulty` is this controller's memory of where the learner
 * is, and every adjustment in `decide()` is made RELATIVE to it. Core's
 * content ladder answers a request for a band with the NEAREST segment it has,
 * and its prerequisite and frontier fallbacks reach into another topic
 * entirely — so "asked for 4, served 2" is ordinary, correct behaviour there.
 * The ratchet never heard about it, so from that turn on it was adjusting from
 * a band the child was never shown.
 */
describe('the ratchet is reconciled to the band that actually reached the screen', () => {
  afterEach(() => vi.restoreAllMocks());

  const HARD = (): SessionPlanEntry => entry({ targetDifficulty: 4, pKnown: 0.4 });

  it('moves to the served band when the ladder substituted a different one', () => {
    const c = new PedagogicalController([HARD()]);
    expect(c.targetDifficulty).toBe(4);
    c.reconcileServedDifficulty(2);
    expect(c.targetDifficulty).toBe(2);
  });

  it('stays exactly where it was when served and requested agree', () => {
    const c = new PedagogicalController([HARD()]);
    c.reconcileServedDifficulty(4);
    expect(c.targetDifficulty).toBe(4);
  });

  /*
   * The drift this whole fix exists for, stated as behaviour rather than as a
   * field read. "Never raise after a failure" lowers RELATIVE to
   * `lastDifficulty`, so the same failing answer produces a different next
   * band depending on whether the ratchet knows what the learner was actually
   * given. Without the reconcile both runs answer the same thing.
   */
  it('changes the NEXT adjustment, which is the whole reason it matters', () => {
    const drifting = new PedagogicalController([HARD()]);
    const reconciled = new PedagogicalController([HARD()]);
    reconciled.reconcileServedDifficulty(2);

    const fail = { kind: 'activity_result', correct: false, misconceptionCode: null, attemptNumber: 1 } as const;
    // Lowers one band from what it BELIEVES the learner is on: 4 → 3…
    expect(drifting.decide(fail, NOW).difficulty).toBe(3);
    // …versus one band from the 2 they were actually shown.
    expect(reconciled.decide(fail, NOW).difficulty).toBe(1);
  });

  /*
   * The correction is to the MEMORY, not to the plan. `decide()` re-bases on
   * `entry.targetDifficulty` every turn, so a reconcile down to 1 must not pin
   * a learner at 1 for the rest of the session.
   */
  it('does not pin the learner: the plan\'s own target still drives the next turn', () => {
    const c = new PedagogicalController([HARD()]);
    c.reconcileServedDifficulty(1);
    const next = c.decide({ kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1 }, NOW);
    expect(next.difficulty).toBe(4);
  });

  /*
   * `null` is a real answer from Core — "the chosen segment declares no
   * difficulty" — and it is NOT a licence to move the ratchet anywhere
   * (§1.14). Neither is anything outside the closed 1–5 band.
   */
  it.each([[null], [undefined], [0], [6], [2.5], [Number.NaN]])(
    'moves nothing for %p — an unusable value is not a measurement',
    (value) => {
      const c = new PedagogicalController([HARD()]);
      c.reconcileServedDifficulty(value);
      expect(c.targetDifficulty).toBe(4);
    },
  );

  it('leaves a dormant controller alone — the request never came from this ratchet', () => {
    // With no plan the brain is off and `ws/server.ts` sends the MODEL's own
    // asked-for band, so a served value says nothing about this field.
    const c = new PedagogicalController([]);
    const before = c.targetDifficulty;
    c.reconcileServedDifficulty(5);
    expect(c.targetDifficulty).toBe(before);
  });

  /*
   * A one-band substitution is the ladder doing its job on a topic whose
   * segments do not cover every band — logging each one would be noise that
   * teaches people to skip the line. Two or more bands apart is a different
   * claim: nothing anywhere near this learner's level existed.
   */
  it('is silent about a one-band substitution and loud about a two-band one', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    new PedagogicalController([HARD()]).reconcileServedDifficulty(3);
    expect(warn).not.toHaveBeenCalled();

    new PedagogicalController([HARD()]).reconcileServedDifficulty(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('served difficulty 2');
  });
});

/*
 * C.10 — THE CORROBORATING-EVIDENCE RULE (Product C.10, Appendix D §2.6).
 *
 * No mastery declaration and no remediation/rescue trigger on a single
 * observation; the observations must be consecutive and QUALIFYING — weighted
 * by response latency and by the hint-request pattern. Each test below names
 * one way a single, possibly-unrepresentative response used to be enough.
 */
describe('C.10: two consecutive qualifying observations before a consequential move', () => {
  const right = (extra: Partial<{ latencyMs: number | null; hintAssisted: boolean }> = {}) =>
    ({ kind: 'activity_result', correct: true, misconceptionCode: null, attemptNumber: 1, ...extra }) as const;
  const wrongWith = (code: string | null) =>
    ({ kind: 'activity_result', correct: false, misconceptionCode: code, attemptNumber: 1 }) as const;
  const returning = (options?: ConstructorParameters<typeof PedagogicalController>[2]) =>
    new PedagogicalController(
      [entry({ pKnown: 0.8, prereqKcIds: [] })],
      [{ kcId: KC_A, kcKey: 'money.make-change-counting-up', pKnown: 0.8, attempts: 6 }],
      options,
    );

  it('exposes the SPEC value as the default requirement', () => {
    expect(CORROBORATION_MIN_OBSERVATIONS).toBe(2);
  });

  it('a hint-assisted correct answer is not independent evidence — it RESETS the chain', () => {
    const c = returning();
    c.decide(right(), NOW);
    // Two correct in a row, but the second was scaffolded by the hint ladder.
    expect(c.decide(right({ hintAssisted: true }), NOW + 40_000).strategy).not.toBe('CELEBRATE');
    // One unassisted answer after it is again only ONE observation.
    expect(c.decide(right(), NOW + 80_000).strategy).not.toBe('CELEBRATE');
    expect(c.decide(right(), NOW + 120_000).strategy).toBe('CELEBRATE');
  });

  it('a SURPRISING correct that arrived too fast to read is a possible guess — neutral', () => {
    // A learner the controller believes does NOT know this (p < 0.5).
    const c = new PedagogicalController([entry({ pKnown: 0.2, prereqKcIds: [] })]);
    const miss = { ...wrongWith(null), latencyMs: 9_000 } as const;
    // Establish a pace baseline from careful answers, misses in between so
    // the belief stays low.
    c.decide(right({ latencyMs: 9_000 }), NOW);
    c.decide(miss, NOW + 40_000);
    c.decide(right({ latencyMs: 9_000 }), NOW + 80_000);
    c.decide(miss, NOW + 120_000);
    const before = new Map(c.snapshot().masteryEvidence).get(KC_A) ?? 0;
    // 600 ms against a 9 s median, from a low belief: a lucky tap.
    c.decide(right({ latencyMs: 600 }), NOW + 160_000);
    expect(new Map(c.snapshot().masteryEvidence).get(KC_A) ?? 0).toBe(before);
  });

  it('a FAST correct from a learner already believed to know it DOES count — fluency is not a cage', () => {
    const c = returning();
    c.decide(right({ latencyMs: 9_000 }), NOW);
    c.decide(right({ latencyMs: 9_000 }), NOW + 40_000);
    // Declared on the two answers above (returning learner): the plan is done.
    expect(c.active).toBe(false);
  });

  it('a wrong answer breaks the mastery chain — the two must be CONSECUTIVE', () => {
    const c = returning();
    c.decide(right(), NOW);
    c.decide(wrongWith(null), NOW + 40_000);
    expect(c.decide(right(), NOW + 80_000).strategy).not.toBe('CELEBRATE');
  });

  it('a conversational turn between two correct answers is not an observation and does not break them', () => {
    const c = returning();
    c.decide(right(), NOW);
    c.decide({ kind: 'conversation_turn' }, NOW + 40_000);
    expect(c.decide(right(), NOW + 80_000).strategy).toBe('CELEBRATE');
  });

  it('two misses with DIFFERENT diagnoses do not corroborate either one', () => {
    const c = new PedagogicalController([entry({ pKnown: 0.4, prereqKcIds: [] })]);
    c.decide({ kind: 'stated_misconception', misconceptionCode: 'some-other-idea' }, NOW);
    const d = c.decide(wrongWith('adds-instead-of-counts-up'), NOW + 40_000);
    expect(d.strategy).not.toBe('REMEDIATE');
    expect(d.misconceptionCode).toBeNull();
  });

  it('a stated wrong idea said TWICE is corroborated — without any graded failure', () => {
    const c = new PedagogicalController([entry({ pKnown: 0.4, prereqKcIds: [] })]);
    const stated = { kind: 'stated_misconception', misconceptionCode: 'adds-instead-of-counts-up' } as const;
    expect(c.decide(stated, NOW).strategy).not.toBe('REMEDIATE');
    const d = c.decide(stated, NOW + 40_000);
    expect(d.strategy).toBe('REMEDIATE');
    expect(d.evidence).toEqual({ rule: 'remediation', observations: 2, required: 2 });
  });

  it('RESCUE carries its evidence: two consecutive graded failures', () => {
    const c = new PedagogicalController([entry({ pKnown: 0.4, prereqKcIds: [], misconceptions: [] })]);
    expect(c.decide(wrongWith(null), NOW).evidence).toBeNull();
    const d = c.decide(wrongWith(null), NOW + 40_000);
    expect(d.strategy).toBe('RESCUE');
    expect(d.evidence).toEqual({ rule: 'rescue', observations: 2, required: 2 });
  });

  it('a decision a guardrail HELD carries no evidence — it executed nothing', () => {
    // The churn cap already spent (three strategy changes this minute), and
    // a remediation chain one observation short. The next stated idea
    // corroborates it — REMEDIATE is proposed — but the cap HOLDS the current
    // strategy, so nothing consequential executed and no evidence is claimed.
    const c = new PedagogicalController([entry({ pKnown: 0.4, prereqKcIds: [] })]);
    c.restore({
      ...c.snapshot(),
      strategy: 'WORKED',
      strategyChangesAt: [NOW - 3_000, NOW - 2_000, NOW - 1_000],
      remediationEvidence: [[KC_A, 'adds-instead-of-counts-up', 1]],
    });
    const held = c.decide({ kind: 'stated_misconception', misconceptionCode: 'adds-instead-of-counts-up' }, NOW);
    expect(held.strategy).toBe('WORKED');
    expect(held.evidence).toBeNull();
  });

  it('files a mastery declaration under the KC it declared, not the next one', () => {
    const KC_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    const c = new PedagogicalController(
      [entry({ pKnown: 0.8, prereqKcIds: [] }), entry({ kcId: KC_B, pKnown: 0.2, prereqKcIds: [] })],
      [{ kcId: KC_A, kcKey: 'money.make-change-counting-up', pKnown: 0.8, attempts: 6 }],
    );
    c.decide(right(), NOW);
    const d = c.decide(right(), NOW + 40_000);
    expect(d.strategy).toBe('CELEBRATE');
    expect(d.kcId).toBe(KC_A);
    expect(c.activeKcId).toBe(KC_B);
  });

  it('reports a revocation on the decision that made it', () => {
    const c = new PedagogicalController([
      entry({ kcId: KC_A, pKnown: 0.9 }),
      entry({ kcId: KC_A, reason: 'review_due', pKnown: 0.9 }),
    ]);
    for (let i = 0; i < 3; i += 1) c.decide(right({ latencyMs: 1_500 }), NOW + i * 1_000);
    const d = c.decide(wrongWith(null), NOW + 10_000);
    expect(d.masteryRevoked).toBe(true);
    expect(c.decide({ kind: 'conversation_turn' }, NOW + 11_000).masteryRevoked).toBe(false);
  });

  describe('operator configuration (Appendix F Stage 7 kill switch, Tier 1 threshold)', () => {
    it('rolls ONE knowledge component back to the single-observation baseline', () => {
      const c = returning({ corroborationRollbackKcKeys: ['money.make-change-counting-up'] });
      const d = c.decide(right(), NOW);
      expect(d.strategy).toBe('CELEBRATE');
      expect(d.evidence).toEqual({ rule: 'mastery', observations: 1, required: 1 });
    });

    it("judges a probe's remediation against the ORIGINAL KC's requirement", () => {
      // The original KC is rolled back (requirement 1); the probe entry is a
      // different key (`#prereq`) still on the rule. The remediation rests on
      // the original KC's chain, so its evidence must carry that KC's
      // requirement — otherwise a compliant decision reads as a violation.
      const c = new PedagogicalController([entry({ pKnown: 0.7 })], [], {
        corroborationRollbackKcKeys: ['money.make-change-counting-up'],
      });
      expect(c.decide(wrongWith(null), NOW).strategy).toBe('PROBE');
      const back = c.decide(right(), NOW + 5_000);
      expect(back.strategy).toBe('REMEDIATE');
      expect(back.evidence).toEqual({ rule: 'remediation', observations: 1, required: 1 });
    });

    it('leaves every other knowledge component on the rule', () => {
      const c = returning({ corroborationRollbackKcKeys: ['some.other-kc'] });
      expect(c.decide(right(), NOW).strategy).not.toBe('CELEBRATE');
    });

    it('can RAISE the requirement', () => {
      const c = returning({ corroborationMinObservations: 3 });
      c.decide(right(), NOW);
      expect(c.decide(right(), NOW + 40_000).strategy).not.toBe('CELEBRATE');
      expect(c.decide(right(), NOW + 80_000).evidence).toEqual({ rule: 'mastery', observations: 3, required: 3 });
    });

    it('ignores an out-of-range value rather than weakening the rule', () => {
      // 1 included: a global single-observation setting would switch C.10 off.
      for (const bad of [0, -1, 1, 1.5, 9, Number.NaN]) {
        const c = returning({ corroborationMinObservations: bad });
        expect(c.decide(right(), NOW).strategy, String(bad)).not.toBe('CELEBRATE');
      }
    });
  });

  it('restores a park record from the previous build (no chains) as empty chains', () => {
    const c = new PedagogicalController([entry()]);
    const legacy = { ...c.snapshot() } as Record<string, unknown>;
    delete legacy.masteryEvidence;
    delete legacy.remediationEvidence;
    const parsed = ControllerSnapshotSchema.parse(legacy);
    expect(parsed.masteryEvidence).toEqual([]);
    expect(parsed.remediationEvidence).toEqual([]);
  });
});
