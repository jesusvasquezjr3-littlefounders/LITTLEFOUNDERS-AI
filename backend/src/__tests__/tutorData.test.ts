import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLearnerMemory } from '../services/tutorData.js';

/*
 * Found by adversarial review, round 28 (2026-08-30, HIGH): `getLearnerMemory`
 * used to collapse "the read failed" and "this learner genuinely has no
 * memory yet" into the identical `{ learner: null, pedagogy: null }` shape
 * via `rows ?? []` — throwing away the one signal (`serviceRest` returning
 * `null` specifically on a transient failure, vs. a real, successful `[]`)
 * that tells them apart. `routes/tutor.ts` injects the result into Oracle's
 * session as `learnerBrief`, and Oracle's post-session review treats an
 * empty brief as "write a note from scratch" — which then REPLACES whatever
 * real memory existed. A transient failure on session N+1 could silently
 * and permanently erase everything sessions 1..N had accumulated.
 */
describe('getLearnerMemory distinguishes a failed read from a genuinely empty one', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null — not an empty brief — when the read itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))));
    await expect(getLearnerMemory('22222222-2222-4222-8222-222222222222')).resolves.toBeNull();
  });

  it('returns a real, empty brief when the read succeeds and finds no rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }))),
    );
    await expect(getLearnerMemory('22222222-2222-4222-8222-222222222222')).resolves.toEqual({
      learner: null,
      pedagogy: null,
    });
  });

  it('returns the real stored content when rows exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([{ store: 'learner', content: 'Le motivan las metas concretas.' }]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
      ),
    );
    await expect(getLearnerMemory('22222222-2222-4222-8222-222222222222')).resolves.toEqual({
      learner: 'Le motivan las metas concretas.',
      pedagogy: null,
    });
  });
});
