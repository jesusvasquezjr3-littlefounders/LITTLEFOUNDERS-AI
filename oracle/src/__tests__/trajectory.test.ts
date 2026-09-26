import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitTutorTrajectory } from '../session/trajectory.js';
import type { TrajectoryStepInput } from '../core/client.js';

/*
 * V4 harness backlog: TRAJECTORY EMISSION (/ORACLE.md §20, ROADMAP.md
 * "Remaining harness phases"). This is the fire-and-forget wrapper
 * `ws/server.ts` calls from `finish()`/`finalizeParked()` — the sibling of
 * `runPostSessionReview` for the CONTROLLER's own decisions rather than the
 * learner's. Tested through the real `persistTutorTrajectory`, mocking only
 * the network boundary (this suite's own house style — see `review.test.ts`).
 */
describe('emitTutorTrajectory', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const step: TrajectoryStepInput = {
    turnSeq: 1,
    eventKind: 'activity_result',
    strategyBefore: 'DIRECT',
    strategy: 'WORKED',
    skillName: 'worked-example-basic',
    scaffolding: 3,
    difficulty: 2,
    pKnown: 0.3,
    misconceptionCode: null,
    kcId: '55555555-5555-4555-8555-555555555555',
    kcMode: 'new',    evidenceRule: null,
    evidenceObservations: null,
    evidenceRequired: null,
    masteryRevoked: false,
  };

  function coreSays(recorded: boolean): Response {
    return new Response(JSON.stringify({ data: { recorded }, error: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /*
   * MOST OF A SESSION NEVER TOUCHES THE CONTROLLER AT ALL (V4 dormant: no
   * session plan, or the plan was already exhausted). Emitting zero steps
   * must be a true no-op — not a call that Core then has to reject — or
   * every ordinary, controller-less session would spend a request proving
   * it had nothing to say.
   */
  it('makes no network call at all when there is nothing to record', async () => {
    const result = await emitTutorTrajectory({
      sessionId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      steps: [],
    });
    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists a non-empty batch and reports success', async () => {
    fetchMock.mockResolvedValueOnce(coreSays(true));
    const result = await emitTutorTrajectory({
      sessionId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      steps: [step],
    });
    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports failure without throwing when the write does not land — a lost trajectory batch must never cost the session itself', async () => {
    fetchMock.mockResolvedValueOnce(coreSays(false));
    await expect(
      emitTutorTrajectory({
        sessionId: '11111111-1111-4111-8111-111111111111',
        userId: '22222222-2222-4222-8222-222222222222',
        steps: [step],
      }),
    ).resolves.toBe(false);
  });

  it('reports failure without throwing on a transport error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(
      emitTutorTrajectory({
        sessionId: '11111111-1111-4111-8111-111111111111',
        userId: '22222222-2222-4222-8222-222222222222',
        steps: [step],
      }),
    ).resolves.toBe(false);
  });
});
