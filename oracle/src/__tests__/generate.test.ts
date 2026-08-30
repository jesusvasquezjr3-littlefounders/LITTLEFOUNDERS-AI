import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSegment, type GenerationRequest } from '../content/generate.js';

/*
 * Found MISSING entirely by an adversarial review, 2026-08-30 (CRITICAL):
 * `/ORACLE.md` §7.3's own guard table asserts "Moderation | §6, same as
 * speech" for tier-3 live-generated content — a generated segment's
 * `prompt_md`/`explanation_md`/`payload` strings never passed through
 * `deterministicModeration`/`moderateTutorOutput` at all, only the separate
 * quality/pedagogy judge in this file (one loose bullet about "anything
 * unsuitable for a child" among eight correctness criteria, not the closed
 * harm-category vocabulary the safety stack enforces everywhere else). These
 * tests pin the fix: a candidate that passes the quality judge cleanly but
 * carries a contact detail in its learner-visible text must still be
 * refused, and a clean candidate must still be served.
 */

const REQUEST: GenerationRequest = {
  skillKey: 'financial-education/cobrar-y-dar-cambio',
  tier: 2,
  locale: 'es-MX',
  difficulty: 2,
  framing: 'Vamos a practicar con monedas en la pantalla.',
  rationale: 'reinforce change-making',
  allowedTypes: ['quiz_mcq'],
  recentTutorLines: [],
  isMinor: true,
};

function segmentJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: 'seg-1',
    type: 'quiz_mcq',
    prompt_md: '¿Cuánto cambio das si pagan con 50 y algo cuesta 30?',
    difficulty: 2,
    xp: 10,
    explanation_md: 'Restas 50 menos 30 para saber el cambio.',
    payload: {
      options: [
        { id: 'a', text_md: '20 pesos', rationale_md: 'correcto' },
        { id: 'b', text_md: '30 pesos', rationale_md: 'confunde el precio con el cambio' },
      ],
    },
    answer: { correct_option_id: 'a' },
    ...overrides,
  });
}

function chatResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(async () => {
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  process.env.JUDGE_API_KEY = 'test-judge-key-0123';
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.MODEL_API_KEY;
  delete process.env.JUDGE_API_KEY;
});

describe('generateSegment — safety moderation on the generated text itself', () => {
  it('refuses a candidate that PASSES the quality judge but carries a contact detail', async () => {
    // Two calls happen in order: author (complete) then the quality judge (a
    // raw fetch to JUDGE_API_BASE) — sequenced explicitly since both hit
    // "/chat/completions".
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(chatResponse(segmentJson({ explanation_md: 'Escríbeme a alguien@ejemplo.com si tienes dudas.' })))
      .mockResolvedValueOnce(chatResponse(JSON.stringify({ pass: true })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateSegment(REQUEST);
    expect(result).toBeNull();
    // Never reached a THIRD call (the safety judge) — the deterministic pass
    // inside moderateTutorOutput caught the email synchronously, with no
    // model round trip needed.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still serves a clean candidate that passes both the quality judge and safety moderation', async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(chatResponse(segmentJson()))
      .mockResolvedValueOnce(chatResponse(JSON.stringify({ pass: true })))
      // The safety judge's own call — reached because the deterministic pass
      // (synchronous, no fetch) found nothing wrong in this clean candidate.
      .mockResolvedValueOnce(chatResponse(JSON.stringify({ safe: true })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateSegment(REQUEST);
    expect(result).not.toBeNull();
    expect(result?.segment.type).toBe('quiz_mcq');
  });

  it('refuses a candidate for a MINOR when the safety judge is required and unreachable', async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(chatResponse(segmentJson()))
      .mockResolvedValueOnce(chatResponse(JSON.stringify({ pass: true })))
      // The safety judge call (deterministic pass finds nothing, so this is
      // reached) — throws, and requireModelPass is true for this minor.
      .mockRejectedValue(new Error('socket hang up'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateSegment(REQUEST);
    expect(result).toBeNull();
  });
});
