import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPostSessionReview } from '../session/review.js';
import type { SessionContext } from '../core/client.js';

/*
 * THE POST-SESSION REVIEW — the slow chamber's first organ (V4).
 *
 * What it writes becomes what the model believes about a child in every
 * future session, so the tests care most about what it REFUSES to do: spend
 * a call on an empty session, accept a malformed proposal, or forward
 * anything identifier-shaped.
 */

const SESSION = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  tier: 2,
  locale: 'es-MX',
  nickname: 'Robi',
  character: 'rho',
  intent: 'open',
  adaptations: [],
  courseContext: null,
  isMinor: true,
  voiceConsent: true,
  learnerBrief: { learner: null, pedagogy: 'Responde bien a ejemplos con comida.' },
} as unknown as SessionContext;

const EXCHANGE = [
  { speaker: 'tutor' as const, text: '¿Qué te gustaría aprender hoy?' },
  { speaker: 'learner' as const, text: 'quiero ahorrar para una bici' },
  { speaker: 'tutor' as const, text: 'Si guardas 10 pesos por semana…' },
  { speaker: 'learner' as const, text: 'en un mes tendría 40' },
];

const fetchMock = vi.fn();

function modelSays(payload: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

beforeEach(() => {
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  delete process.env.MODEL_API_KEY;
  vi.unstubAllGlobals();
});

describe('when it refuses to run', () => {
  it('spends nothing on a session with fewer than two learner turns', async () => {
    const result = await runPostSessionReview({
      session: SESSION,
      history: [{ speaker: 'tutor', text: 'hola' }, { speaker: 'learner', text: 'adiós' }],
    });
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('what it forwards to Core', () => {
  it('writes a valid proposal and reports what it wrote', async () => {
    fetchMock
      .mockResolvedValueOnce(
        modelSays({ learner: 'Le motivan las metas concretas (una bici).', pedagogy: null }),
      )
      // Core's PUT — the envelope the client validates.
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { written: { learner: true } }, error: null }), { status: 200 }),
      );
    const result = await runPostSessionReview({ session: SESSION, history: EXCHANGE });
    expect(result?.learner).toContain('bici');
    // The review call carried the EXISTING stores, so the model consolidates
    // rather than starting blank — the hard-limit pattern depends on it.
    const reviewBody = String(fetchMock.mock.calls[0]?.[1]?.body ?? '');
    expect(reviewBody).toContain('Responde bien a ejemplos con comida.');
  });

  it('a double-null proposal writes nothing — most short sessions teach nothing durable', async () => {
    fetchMock.mockResolvedValueOnce(modelSays({ learner: null, pedagogy: null }));
    const result = await runPostSessionReview({ session: SESSION, history: EXCHANGE });
    expect(result).toEqual({ learner: null, pedagogy: null });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no PUT
  });

  it('drops an identifier-shaped proposal WHOLE', async () => {
    // §1.9's re-check: a partially sanitized belief is not a belief we hold
    // about a child. The digit run is phone-shaped; the whole thing dies.
    fetchMock.mockResolvedValueOnce(
      modelSays({ learner: 'Vive cerca de la escuela, tel 5512345678.', pedagogy: 'Ritmo lento.' }),
    );
    const result = await runPostSessionReview({ session: SESSION, history: EXCHANGE });
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no PUT
  });

  it('a malformed model reply is dropped, never guessed at', async () => {
    fetchMock.mockResolvedValueOnce(modelSays({ learner: 42, pedagogy: 'x' }));
    const result = await runPostSessionReview({ session: SESSION, history: EXCHANGE });
    expect(result).toBeNull();
  });

  it('a transport failure costs continuity, not a crash', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    await expect(runPostSessionReview({ session: SESSION, history: EXCHANGE })).resolves.toBeNull();
  });
});
