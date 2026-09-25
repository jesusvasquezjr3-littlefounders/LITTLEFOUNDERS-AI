import { describe, expect, it } from 'vitest';
import { OrchestratorSnapshotSchema, TutorOrchestrator } from '../tutor/orchestrator.js';
import { PedagogicalController } from '../tutor/controller.js';
import { planSnapshot } from '../tutor/plan.js';
import type { SessionContext } from '../core/client.js';
import type { SpeechResult } from '../voice/speech.js';

/*
 * THE PARK SNAPSHOT'S COMPLETENESS FENCE.
 *
 * A parked session can now be adopted by a DIFFERENT replica, which means a
 * conversation crosses a process boundary as plain JSON. `RUNBOOK.md` Round
 * 142 named the exact hazard that makes this worth a dedicated suite, and
 * declined to implement the migration until there was an answer to it: "a
 * versioned snapshot/restore contract covering EVERY private field, INCLUDING
 * ONES FUTURE ROUNDS ADD — a field silently omitted looks correct on the first
 * resume."
 *
 * It looks correct because it IS correct, for one connection. An omitted field
 * restores as its constructor default, and a constructor default is a
 * perfectly plausible value: a learner's failure streak reads as zero, a
 * strategy reads as DIRECT, a set of already-used one-per-session skills reads
 * as empty. Nothing errors. The tutor simply forgets, on a reconnect, in a way
 * no gate downstream can distinguish from a learner who genuinely had not
 * struggled yet.
 *
 * So the fence does not check a hand-written list of fields against another
 * hand-written list — two lists drift together. It reads the class's REAL
 * runtime fields (TypeScript `private` is erased at compile time; every field,
 * including parameter properties, is an ordinary own enumerable property) and
 * requires each one to be in exactly one of two buckets: carried by
 * `snapshot()`, or named below as deliberately excluded WITH its reason.
 * Adding a field to either class without making that decision turns this red.
 */

const SESSION: SessionContext = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  tier: 2,
  locale: 'es-MX',
  nickname: 'Robi',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'course_topic',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  isMinor: true,
  voiceConsent: true,
  intelDegraded: false,
};

const silent = async (): Promise<SpeechResult> => ({
  url: null,
  source: 'unavailable',
  billedChars: 0,
  wordTimings: null,
});

const newOrchestrator = (): TutorOrchestrator => new TutorOrchestrator(SESSION, 1_000, silent);

/**
 * Every `TutorOrchestrator` field the snapshot deliberately does NOT carry.
 *
 * Each is a decision with a reason, not an omission — that is the entire point
 * of writing them here rather than letting the fence pass on a subset.
 */
const ORCHESTRATOR_EXCLUDED: Record<string, string> = {
  session: 'carried by the park record and passed to restore() — pinned, so it must stay readonly',
  startedAtMs: 'carried by the park record and passed to restore() — the budget clock must not restart',
  synthesize: 'a closure over one socket’s SpeechScope; rebuilt on the far side, cannot travel',
  pendingDiscardedAudio: 'unsettled Promises; awaitPendingCosts() folds their cost in BEFORE snapshot()',
  dispositionEffects:
    'C.7 derived at construction from the pinned SessionContext.dispositionProfile the park record carries — rebuilt identically on the far side, not session state',
};

/** The same, for `PedagogicalController`. */
const CONTROLLER_EXCLUDED: Record<string, string> = {
  plan: 'a constructor argument, rebuilt on the far side from the park record’s own SessionContext',
  kcStates: 'a constructor argument, rebuilt on the far side from the park record’s own SessionContext',
  corroboration:
    'C.10 operator configuration derived from env at construction (TUTOR_CORROBORATION_*), rebuilt identically on the far side — config, not session state',
  disposition:
    'C.7 derived at construction from the pinned SessionContext.dispositionProfile the park record carries, rebuilt identically on the far side — not session state',
};

describe('the park snapshot covers every field either class actually has', () => {
  it('TutorOrchestrator: every runtime field is snapshotted or deliberately excluded', () => {
    const orchestrator = newOrchestrator();
    const carried = new Set(Object.keys(orchestrator.snapshot()));
    // `version` is the record's own, not a field of the class.
    carried.delete('version');

    const unaccounted = Object.keys(orchestrator).filter(
      (field) => !carried.has(field) && !(field in ORCHESTRATOR_EXCLUDED),
    );

    expect(
      unaccounted,
      `TutorOrchestrator has ${unaccounted.length} field(s) that neither snapshot() carries nor ` +
        `ORCHESTRATOR_EXCLUDED explains: ${unaccounted.join(', ')}. A field left out of the snapshot ` +
        `restores as its constructor default on a cross-replica resume, which is indistinguishable ` +
        `from a healthy session. Decide which bucket it belongs in.`,
    ).toEqual([]);
  });

  it('PedagogicalController: every runtime field is snapshotted or deliberately excluded', () => {
    const controller = new PedagogicalController([], []);
    const carried = new Set(Object.keys(controller.snapshot()));

    const unaccounted = Object.keys(controller).filter(
      (field) => !carried.has(field) && !(field in CONTROLLER_EXCLUDED),
    );

    expect(
      unaccounted,
      `PedagogicalController has ${unaccounted.length} field(s) that neither snapshot() carries nor ` +
        `CONTROLLER_EXCLUDED explains: ${unaccounted.join(', ')}.`,
    ).toEqual([]);
  });

  /*
   * The mirror of the two above. Without it, a field DELETED from a class but
   * left in the exclusion list would keep passing while the list quietly
   * became fiction — the same drift the fence exists to prevent, running the
   * other way.
   */
  it('every excluded field still exists — the exclusion lists cannot go stale', () => {
    const orchestratorFields = new Set(Object.keys(newOrchestrator()));
    for (const field of Object.keys(ORCHESTRATOR_EXCLUDED)) {
      expect(orchestratorFields, `ORCHESTRATOR_EXCLUDED names '${field}', which no longer exists`).toContain(field);
    }
    const controllerFields = new Set(Object.keys(new PedagogicalController([], [])));
    for (const field of Object.keys(CONTROLLER_EXCLUDED)) {
      expect(controllerFields, `CONTROLLER_EXCLUDED names '${field}', which no longer exists`).toContain(field);
    }
  });
});

describe('a snapshot survives a round trip byte for byte', () => {
  /**
   * Every snapshotted field is set to a DISTINCTIVE, non-default value first.
   *
   * Driving a real conversation instead would exercise perhaps half of them —
   * and the half it exercises is the half that is easy to get right. The
   * fields that matter here are the rarely-visited ones (a revoked mastery, a
   * declined adaptation, a probe in flight), which is exactly where a dropped
   * field would hide. Reaching past `private` to set them is deliberate: this
   * suite is about the class's real runtime shape, which is what crosses the
   * wire, not about its declared API.
   */
  function mutateEverything(orchestrator: TutorOrchestrator): void {
    const o = orchestrator as unknown as Record<string, unknown>;
    (o.history as { speaker: string; text: string }[]).push(
      { speaker: 'tutor', text: 'Hola Robi' },
      { speaker: 'learner', text: 'quiero ahorrar' },
    );
    o.seq = 7;
    o.modelUsd = 0.0125;
    o.voiceUsd = 0.004;
    o.paidSyntheses = 3;
    o.freeSyntheses = 5;
    o.discardedSyntheses = 1;
    o.segmentCount = 2;
    o.adaptations = ['slower_pacing', 'more_visual'];
    o.stopped = false;
    o.lastTurn = {
      turn: { say: 'Muy bien', emotion: 'proud', action: 'celebrate', next: 'ask', savePlan: false },
      seq: 7,
    };
    o.lastOfferedAdaptation = 'more_examples';
    o.closeGraceUsed = true;
    o.openCheckableSegment = 'seg-checkable';
    o.openActivity = { type: 'coin_count', prompt: 'How many pesos?' };
    o.openUngradedSegmentId = 'seg-ungraded';
    (o.usedSkillNames as Set<string>).add('counterexample-confront');
    (o.trajectoryLog as unknown[]).push({
      turnSeq: 3,
      eventKind: 'activity_result',
      strategyBefore: 'DIRECT',
      strategy: 'RESCUE',
      skillName: 'worked-example',
      scaffolding: 2,
      difficulty: 3,
      pKnown: 0.42,
      misconceptionCode: 'mc-unit-confusion',
      kcId: 'kc-saving-1',
      kcMode: 'remediation',
      evidenceRule: 'rescue',
      evidenceObservations: 2,
      evidenceRequired: 2,
      masteryRevoked: true,
    });
    (o.skillStates as unknown[]).push({
      skillKey: 'saving-basics',
      masteryProbability: 0.61,
      uncertainty: 0.2,
      evidenceCount: 4,
      recommendedAction: 'practice',
      reasonCode: 'improving',
    });
    (o.servedSegmentSkills as Map<string, string>).set('seg-1', 'saving-basics');
    (o.segmentServedAt as Map<string, number>).set('seg-1', 1_234);
    o.minorPosture = false;

    // The plan, which is genuinely mutable state and not a derived value.
    const plan = o.plan as {
      stepIndex: number;
      turnsOnStep: number;
      finalStepRoundsCompleted: number;
      failures: Map<string, number>;
      stuckSkillKey: string | null;
      stylesTried: string[];
      declinedAdaptations: string[];
    };
    plan.stepIndex = 2;
    plan.turnsOnStep = 3;
    plan.finalStepRoundsCompleted = 1;
    plan.failures.set('saving-basics', 2);
    plan.stuckSkillKey = 'saving-basics';
    plan.stylesTried.push('more_examples');
    plan.declinedAdaptations.push('slower_pacing');

    // The controller, through its own snapshot/restore contract.
    (o.controller as PedagogicalController).restore({
      entryIndex: 1,
      pKnown: [['kc-saving-1', 0.73]],
      strategy: 'SOCRATIC',
      consecutiveFailures: 2,
      lastDifficulty: 4,
      lastDifficultyFromContent: true,
      misconceptionCode: 'mc-unit-confusion',
      strategyChangesAt: [1_000, 2_000],
      questioningWithoutProgress: 3,
      rescuedSinceProgress: true,
      opportunities: [['kc-saving-1', 6]],
      correctLatencies: [['kc-saving-1', [1_200, 3_400]]],
      guessedLastTurn: true,
      probeReturnIndex: 0,
      probingKcId: 'kc-prereq-9',
      celebratedKcIds: ['kc-saving-1'],
      masteryRevokedKcIds: ['kc-saving-1'],
      masteryEvidence: [['kc-saving-1', 1]],
      remediationEvidence: [['kc-saving-1', 'mc-unit-confusion', 2]],
    });
  }

  it('restores a fully-populated orchestrator to an identical snapshot', () => {
    const original = newOrchestrator();
    mutateEverything(original);
    const before = original.snapshot();

    const restored = TutorOrchestrator.restore(before, SESSION, 1_000, silent);

    expect(restored.snapshot()).toEqual(before);
  });

  it('survives JSON — the shape a shared store actually stores', () => {
    const original = newOrchestrator();
    mutateEverything(original);
    const before = original.snapshot();

    // Exactly what `ws/server.ts` does: stringify, store, read, validate.
    const parsed = OrchestratorSnapshotSchema.safeParse(JSON.parse(JSON.stringify(before)));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(TutorOrchestrator.restore(parsed.data, SESSION, 1_000, silent).snapshot()).toEqual(before);
  });

  it('restores state a DEFAULT-constructed orchestrator would silently disagree with', () => {
    /*
     * The fence's own control. If `restore` quietly kept the constructor's
     * fresh plan and controller, every assertion above would still pass on a
     * snapshot that happened to be near-default — so this one proves the
     * restored instance differs from a fresh one in exactly the ways the
     * snapshot said it should.
     */
    const original = newOrchestrator();
    mutateEverything(original);
    const restored = TutorOrchestrator.restore(original.snapshot(), SESSION, 1_000, silent);
    const fresh = newOrchestrator();

    expect(restored.snapshot()).not.toEqual(fresh.snapshot());
    expect(restored.turnCount).toBe(7);
    expect(restored.totalCostUsd).toBeCloseTo(0.0165, 6);
    expect(restored.servedSegments).toBe(2);
    expect(restored.startedAt).toBe(1_000);
    expect(restored.resumeSnapshot.turns).toHaveLength(2);
    expect(restored.activeStrategy).toBe(null); // no session plan => controller dormant
    expect(restored.trajectorySteps).toHaveLength(1);
  });

  it('carries the controller’s private state, not just the orchestrator’s', () => {
    const controller = new PedagogicalController([], []);
    const populated = {
      entryIndex: 2,
      pKnown: [['kc-a', 0.9]] as [string, number][],
      strategy: 'REMEDIATE' as const,
      consecutiveFailures: 4,
      lastDifficulty: 5 as const,
      lastDifficultyFromContent: true,
      misconceptionCode: 'mc-x',
      strategyChangesAt: [5, 6, 7],
      questioningWithoutProgress: 2,
      rescuedSinceProgress: true,
      opportunities: [['kc-a', 11]] as [string, number][],
      correctLatencies: [['kc-a', [900]]] as [string, number[]][],
      guessedLastTurn: true,
      probeReturnIndex: 1,
      probingKcId: 'kc-b',
      celebratedKcIds: ['kc-a'],
      masteryRevokedKcIds: ['kc-a'],
      masteryEvidence: [['kc-a', 3]] as [string, number][],
      remediationEvidence: [['kc-b', null, 1]] as [string, string | null, number][],
    };
    controller.restore(populated);
    expect(controller.snapshot()).toEqual(populated);

    // …and restoring an EMPTY snapshot over a populated controller clears it,
    // rather than merging — the "previous owner's state" failure (§1.14) in
    // its most direct form.
    const fresh = new PedagogicalController([], []).snapshot();
    controller.restore(fresh);
    expect(controller.snapshot()).toEqual(fresh);
  });

  it('carries the lesson plan, which a resume must never rebuild from scratch', () => {
    const original = newOrchestrator();
    mutateEverything(original);
    const restored = TutorOrchestrator.restore(original.snapshot(), SESSION, 1_000, silent);

    const planOf = (o: TutorOrchestrator): unknown =>
      planSnapshot((o as unknown as { plan: Parameters<typeof planSnapshot>[0] }).plan);

    expect(planOf(restored)).toEqual(planOf(original));
    expect(planOf(restored)).not.toEqual(planOf(newOrchestrator()));
  });
});

describe('the snapshot refuses to be taken with money still in flight', () => {
  it('throws rather than silently under-reporting an unsettled paid synthesis', () => {
    /*
     * `pendingDiscardedAudio` holds paid TTS whose cost has not yet reached
     * `voiceUsd`. Snapshotting over it would hand the ADOPTING replica a cost
     * that is real money short — and that replica's close is the one Core
     * records, so the difference is lost permanently. `publishPark` awaits
     * `awaitPendingCosts()` first; this asserts the class refuses rather than
     * trusting every future caller to remember.
     */
    const orchestrator = newOrchestrator();
    (orchestrator as unknown as { pendingDiscardedAudio: Promise<unknown>[] }).pendingDiscardedAudio = [
      Promise.resolve(),
    ];

    expect(() => orchestrator.snapshot()).toThrow(/awaitPendingCosts/);
  });

  it('is snapshottable again once those costs have settled', async () => {
    const orchestrator = newOrchestrator();
    (orchestrator as unknown as { pendingDiscardedAudio: Promise<unknown>[] }).pendingDiscardedAudio = [
      Promise.resolve(),
    ];
    await orchestrator.awaitPendingCosts();
    expect(() => orchestrator.snapshot()).not.toThrow();
  });
});
