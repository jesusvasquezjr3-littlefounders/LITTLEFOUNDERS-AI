import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateLearnerMemory } from '../core/client.js';

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
    });
    expect(result).toBe(true);
  });

  it('returns false when one proposed store fails to land, even though the request itself was a 200', async () => {
    fetchMock.mockResolvedValueOnce(coreSays({ learner: false, pedagogy: true }));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: 'Nueva nota de pedagogia.' },
    });
    expect(result).toBe(false);
  });

  it('returns false when every proposed store fails to land', async () => {
    fetchMock.mockResolvedValueOnce(coreSays({ learner: false, pedagogy: false }));
    const result = await updateLearnerMemory({
      userId: '22222222-2222-4222-8222-222222222222',
      sessionId: '11111111-1111-4111-8111-111111111111',
      stores: { learner: 'Nueva nota.', pedagogy: 'Nueva nota de pedagogia.' },
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
    });
    expect(result).toBe(true);
  });
});
