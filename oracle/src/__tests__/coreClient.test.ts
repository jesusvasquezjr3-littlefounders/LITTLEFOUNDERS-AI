import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { persistTutorTrajectory, recallOwnHistory, updateLearnerMemory } from '../core/client.js';
import type { TrajectoryStepInput } from '../core/client.js';

/*
 * Found by adversarial review, round 28 (2026-08-30, HIGH): Core answers a
 * per-store write failure with an ordinary 200 — `{ written: { learner:
 * false, pedagogy: true } }` is not an error envelope, just a partial
 * result (backend/src/routes/tutor.ts's own `PUT /learner-memory` handler).
 * `updateLearnerMemory` used to check only that the envelope parsed and
 * `data` was non-null — true in BOTH a full success and a partial failure —
 * so a genuine write failure was reported to the caller as success. This
 * file's own doc comment promises "a false return means did not land",
 * which `session/review.ts` relies on to retry via the NEXT session's
 * review; silently returning true instead meant a curated memory note could
 * fail to persist with no retry and no warning, forever.
 */
describe('updateLearnerMemory reflects the real per-store result, not just envelope shape', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function coreSays(written: Record<string, boolean>): Response {
    return new Response(JSON.stringify({ data: { written }, error: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('returns true when every proposed store lands', async () => {
    fetchMock.mockResolvedValueOnce(coreSays({ learner: true, pedagogy: true }));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: 'Nueva nota de pedagogia.' },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(result).toBe(true);
  });

  it('returns false when one proposed store fails to land, even though the request itself was a 200', async () => {
    fetchMock.mockResolvedValueOnce(coreSays({ learner: false, pedagogy: true }));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: 'Nueva nota de pedagogia.' },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(result).toBe(false);
  });

  it('returns false when every proposed store fails to land', async () => {
    fetchMock.mockResolvedValueOnce(coreSays({ learner: false, pedagogy: false }));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: 'Nueva nota de pedagogia.' },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(result).toBe(false);
  });

  it('does not require a store that was never proposed (null) to appear in `written`', async () => {
    // Core's own route skips a null store entirely — only `learner` appears.
    fetchMock.mockResolvedValueOnce(coreSays({ learner: true }));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: null },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(result).toBe(true);
  });

  /*
   * Found by adversarial review, round 51 (2026-08-30, MEDIUM): this
   * function used to send only `stores`, so Core had nothing to compare a
   * write against except a value it read itself, moments before writing —
   * which can never detect a genuinely concurrent session's earlier write
   * (see `updateLearnerMemory`'s own comment, and
   * `writeLearnerMemoryPair`'s in
   * `backend/src/services/tutorData.ts`). `expectedBefore` must reach the
   * wire body verbatim, unmodified, for Core's compare-and-swap to mean
   * anything.
   */
  it('sends expectedBefore on the wire exactly as given — Core\'s compare-and-swap depends on it', async () => {
    fetchMock.mockResolvedValueOnce(coreSays({ learner: true }));
    await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nota consolidada.', pedagogy: null },
      expectedBefore: { learner: 'Nota de la sesión anterior.', pedagogy: null },
    });

    const sentBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(sentBody.expectedBefore).toEqual({ learner: 'Nota de la sesión anterior.', pedagogy: null });
  });

  /*
   * THE PARENTAL APPROVAL GATE (/ORACLE.md §20, migration 0068). For a `kid`,
   * Core PARKS the learner store's proposal for a verified guardian instead of
   * writing it, so that store is correctly ABSENT from `written` — and every
   * assertion above treats an absent proposed store as a failed write.
   *
   * Without the `pending` field this function would log "the write did not
   * land" on every single kid session forever, which is the §1.14 failure that
   * matters most here: the ONE signal that would tell an operator the gate had
   * stopped working is a message that is already firing constantly for the
   * healthy case.
   */
  function coreSaysWithPending(written: Record<string, boolean>, pending: string[]): Response {
    return new Response(JSON.stringify({ data: { written, pending }, error: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('treats a store PARKED for guardian approval as landed, not as a failure', async () => {
    fetchMock.mockResolvedValueOnce(coreSaysWithPending({ pedagogy: true }, ['learner']));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: 'Nueva nota de pedagogia.' },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(result).toBe(true);
  });

  it('treats a PARKED pedagogy note as landed — C.4/OD-18 review both notes (GAP-FIX-R2)', async () => {
    fetchMock.mockResolvedValueOnce(coreSaysWithPending({}, ['learner', 'pedagogy']));
    const both = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: 'Nueva nota de pedagogia.' },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(both).toBe(true);
    fetchMock.mockResolvedValueOnce(coreSaysWithPending({}, ['pedagogy']));
    const pedagogyOnly = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: null, pedagogy: 'Nueva nota de pedagogia.' },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(pedagogyOnly).toBe(true);
  });

  it('refuses a pending store name it does not know (a drifted Core reads as not landed)', async () => {
    fetchMock.mockResolvedValueOnce(coreSaysWithPending({}, ['diary']));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: null, pedagogy: 'Nueva nota de pedagogia.' },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(result).toBe(false);
  });

  it('still reports a genuine failure when another store failed alongside a parked one', async () => {
    fetchMock.mockResolvedValueOnce(coreSaysWithPending({ pedagogy: false }, ['learner']));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: 'Nueva nota de pedagogia.' },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(result).toBe(false);
  });

  it('an older Core that sends no `pending` field at all still behaves exactly as before', async () => {
    fetchMock.mockResolvedValueOnce(coreSays({ learner: false, pedagogy: true }));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: 'Nueva nota de pedagogia.' },
      expectedBefore: { learner: null, pedagogy: null },
    });
    expect(result).toBe(false);
  });
});

/*
 * Found by adversarial review, round 29 (2026-08-30, HIGH): episodic
 * recall's full-text search hardcoded the Spanish Postgres text-search
 * configuration regardless of the session's actual locale. Postgres's
 * Spanish stemmer mistransforms English/Portuguese words rather than
 * merely leaving them unstemmed — `to_tsvector('spanish','remember')` and
 * `to_tsvector('spanish','remembered')` produce two DIFFERENT stems for the
 * same root, verified against a real local Postgres instance — so recall
 * broke unpredictably for en-US/pt-BR sessions. Fixed in
 * `database/migrations/0056_recall_locale_aware_fts.sql`, which needs the
 * CALLING session's own locale threaded all the way from the orchestrator
 * through Core to `search_tutor_turns`'s new `p_locale` parameter. This
 * test proves ONLY the oracle-side half of that wiring — that the real
 * locale reaches the query string `coreFetch` sends — since proving the
 * Postgres stemming behavior itself needs a real database, which this
 * suite intentionally never touches (see `admin.test.ts`-style tests
 * elsewhere for the fetch-mocking convention this file follows).
 */
/*
 * V4 harness backlog: TRAJECTORY EMISSION (/ORACLE.md §20, ROADMAP.md
 * "Remaining harness phases", migration 0065). Same posture as every other
 * write in this file: `false` means the batch did not land, and the caller
 * (`session/trajectory.ts`) logs it rather than retrying.
 */
describe('persistTutorTrajectory', () => {
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
    eventKind: 'conversation_turn',
    strategyBefore: 'SOCRATIC',
    strategy: 'DIRECT',
    skillName: null,
    scaffolding: 3,
    difficulty: 2,
    pKnown: 0.4,
    misconceptionCode: null,
    kcId: null,
    kcMode: 'new',
    evidenceRule: null,
    evidenceDiscounted: null,
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

  it('returns true when the batch lands', async () => {
    fetchMock.mockResolvedValueOnce(coreSays(true));
    const result = await persistTutorTrajectory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      steps: [step],
    });
    expect(result).toBe(true);
  });

  it('returns false — never throws — when Core reports the write did not land', async () => {
    fetchMock.mockResolvedValueOnce(coreSays(false));
    const result = await persistTutorTrajectory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      steps: [step],
    });
    expect(result).toBe(false);
  });

  it('returns false — never throws — on a transport failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const result = await persistTutorTrajectory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      steps: [step],
    });
    expect(result).toBe(false);
  });

  it('sends the WHOLE batch to /tutor/internal/trajectory in one call', async () => {
    fetchMock.mockResolvedValueOnce(coreSays(true));
    await persistTutorTrajectory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      steps: [step, { ...step, turnSeq: 2, strategyBefore: 'DIRECT', strategy: 'CELEBRATE' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tutor/internal/trajectory');
    const body = JSON.parse(String(init.body)) as { steps: unknown[] };
    expect(body.steps).toHaveLength(2);
  });
});

describe('recallOwnHistory sends the session\'s own locale, not a hardcoded one', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(['en-US', 'es-MX', 'pt-BR'] as const)('passes %s through to the recall query string', async (locale) => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { excerpts: [] }, error: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await recallOwnHistory('22222222-2222-4222-8222-222222222222', 'remember cookie problem', locale);
    const url = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(url).toContain(`locale=${encodeURIComponent(locale)}`);
  });
});
