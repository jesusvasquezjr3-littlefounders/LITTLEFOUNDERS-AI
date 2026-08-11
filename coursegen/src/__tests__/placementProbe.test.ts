import { describe, expect, it, vi } from 'vitest';
import {
  gatePlacementProbe,
  authorPlacementProbe,
  translatePlacementProbe,
  type PlacementProbe,
} from '../pipeline/placementProbe.js';
import type { ChatCompleteResult } from '../providers/openaiChat.js';

function mockComplete(...responses: string[]) {
  let call = 0;
  return vi.fn(async (): Promise<ChatCompleteResult> => {
    const content = responses[Math.min(call, responses.length - 1)]!;
    call += 1;
    return { content, promptTokens: 10, completionTokens: 10, cachedPromptTokens: 0 };
  });
}

const VALID_PROBE: PlacementProbe = {
  prompt: '¿Qué es el dinero?',
  options: ['Algo que sirve para intercambiar cosas', 'Un juguete', 'Un color'],
  correctIndex: 0,
};

describe('gatePlacementProbe (deterministic, no network)', () => {
  it('accepts a well-formed probe', () => {
    expect(gatePlacementProbe(VALID_PROBE)).toEqual({ ok: true, problems: [] });
  });

  it('rejects too few options', () => {
    const result = gatePlacementProbe({ prompt: 'p', options: ['a'], correctIndex: 0 });
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('option-count');
  });

  it('rejects too many options', () => {
    const result = gatePlacementProbe({ prompt: 'p', options: ['a', 'b', 'c', 'd', 'e', 'f'], correctIndex: 0 });
    expect(result.problems.map((p) => p.code)).toContain('option-count');
  });

  it('rejects an out-of-range correctIndex', () => {
    const result = gatePlacementProbe({ prompt: 'p', options: ['a', 'b'], correctIndex: 5 });
    expect(result.problems.map((p) => p.code)).toContain('correct-index-range');
  });

  it('rejects duplicate options (case/whitespace-insensitive)', () => {
    const result = gatePlacementProbe({ prompt: 'p', options: ['Ahorro', ' ahorro ', 'Gasto'], correctIndex: 0 });
    expect(result.problems.map((p) => p.code)).toContain('duplicate-options');
  });

  it('rejects an answer leak — the correct option restated verbatim in the prompt', () => {
    const result = gatePlacementProbe({
      prompt: '¿Es verdad que ahorrar dinero es guardarlo para el futuro?',
      options: ['guardarlo para el futuro', 'gastarlo todo hoy', 'regalarlo'],
      correctIndex: 0,
    });
    expect(result.problems.map((p) => p.code)).toContain('answer-leak');
  });

  it('does not flag a short correct answer as a leak (avoids false positives on trivial substrings)', () => {
    const result = gatePlacementProbe({ prompt: '¿Cuánto es 2 más 2?', options: ['4', '5', '3'], correctIndex: 0 });
    expect(result.problems.map((p) => p.code)).not.toContain('answer-leak');
  });
});

describe('authorPlacementProbe', () => {
  const input = {
    concept: 'El dinero sirve para intercambiar bienes y servicios.',
    learningObjective: 'El niño identifica para qué sirve el dinero.',
    keyVocabulary: ['dinero', 'intercambio'],
  };

  it('returns a valid probe on the first attempt', async () => {
    const complete = mockComplete(JSON.stringify(VALID_PROBE));
    const probe = await authorPlacementProbe(input, { complete: complete as never });
    expect(probe).toEqual(VALID_PROBE);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('sends only the topic content (concept/objective/vocabulary/facts) — no learner id, no free-text beyond what was passed in', async () => {
    const complete = mockComplete(JSON.stringify(VALID_PROBE));
    await authorPlacementProbe({ ...input, factRefs: ['fact-1'] }, { complete: complete as never });
    const userMessages = complete.mock.calls[0]![0].messages.filter((m) => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0]!.content).toBe(
      'Concept: El dinero sirve para intercambiar bienes y servicios.\n' +
        'Learning objective: El niño identifica para qué sirve el dinero.\n' +
        'Key vocabulary: dinero, intercambio\n' +
        'Fact references: fact-1',
    );
    // No UUID-shaped value anywhere in the prompt — the one shape a real learner/user id would take.
    const fullPrompt = complete.mock.calls[0]![0].messages.map((m) => m.content).join('\n');
    expect(fullPrompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it('retries with corrective feedback on invalid JSON, then succeeds', async () => {
    const complete = mockComplete('not json', JSON.stringify(VALID_PROBE));
    const probe = await authorPlacementProbe(input, { complete: complete as never });
    expect(probe).toEqual(VALID_PROBE);
    expect(complete).toHaveBeenCalledTimes(2);
    const secondCallMessages = complete.mock.calls[1]![0].messages;
    expect(secondCallMessages[secondCallMessages.length - 1]!.content).toContain('invalid');
  });

  it('retries when the gate rejects a schema-valid but duplicate-option probe', async () => {
    const badProbe = { prompt: 'p', options: ['a', 'a', 'b'], correctIndex: 0 };
    const complete = mockComplete(JSON.stringify(badProbe), JSON.stringify(VALID_PROBE));
    const probe = await authorPlacementProbe(input, { complete: complete as never });
    expect(probe).toEqual(VALID_PROBE);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting corrective attempts on persistently invalid output', async () => {
    const complete = mockComplete('still not json');
    await expect(authorPlacementProbe(input, { complete: complete as never })).rejects.toThrow(/Exceeded/);
  });
});

describe('translatePlacementProbe', () => {
  it('translates prompt/options and preserves correctIndex', async () => {
    const translated = { prompt: 'What is money?', options: ['Something used to trade', 'A toy', 'A color'], correctIndex: 0 };
    const complete = mockComplete(JSON.stringify(translated));
    const result = await translatePlacementProbe(VALID_PROBE, 'en-US', { complete: complete as never });
    expect(result).toEqual(translated);
  });

  it('retries when the translation changes correctIndex (must stay the same option)', async () => {
    const wrongIndex = { prompt: 'What is money?', options: ['Something used to trade', 'A toy', 'A color'], correctIndex: 1 };
    const rightIndex = { prompt: 'What is money?', options: ['Something used to trade', 'A toy', 'A color'], correctIndex: 0 };
    const complete = mockComplete(JSON.stringify(wrongIndex), JSON.stringify(rightIndex));
    const result = await translatePlacementProbe(VALID_PROBE, 'en-US', { complete: complete as never });
    expect(result.correctIndex).toBe(0);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
