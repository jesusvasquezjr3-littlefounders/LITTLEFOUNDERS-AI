import { describe, expect, it, vi } from 'vitest';
import { appendRecapSegment, generateRecapLines, pickPersonas } from '../pipeline/recapDialogue.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

/*
 * The dual-persona recap's whole value is the STUDENT's blindness: it never
 * receives the lesson, so its questions are authentically naive. These tests
 * pin that boundary, the alternation, the caps, and the placement rule.
 */

function doc(over: Partial<{ segments: unknown[]; cast: string[] }> = {}): LessonDocumentParsed {
  return {
    schema_version: 1,
    meta: {
      slug: 'r',
      title: 'El precio justo',
      locale: 'es-MX',
      subject: 'money',
      estimated_minutes: 5,
      objectives: ['saber poner un precio'],
      cast: over.cast ?? ['dina'],
    },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
    segments:
      over.segments ??
      ([
        {
          id: 's1',
          type: 'quiz_mcq',
          prompt_md: 'El vaso cuesta 5 pesos. ¿Cuánto cuestan 2?',
          explanation_md: 'Dos vasos de 5 pesos suman 10 pesos.',
          difficulty: 1,
          xp: 10,
          narrator: { character: 'dina' },
          payload: { options: [] },
        },
      ] as unknown[]),
  } as unknown as LessonDocumentParsed;
}

describe('pickPersonas', () => {
  it('teacher = most-used narrator, student = a DIFFERENT canon character', () => {
    expect(pickPersonas(doc())).toEqual({ teacher: 'dina', student: 'liruf' });
  });

  it('a liruf-narrated lesson gets a different student (never self-dialogue)', () => {
    const d = doc({
      segments: [
        { id: 's1', type: 'quiz_mcq', prompt_md: 'x', difficulty: 1, xp: 10, narrator: { character: 'liruf' }, payload: {} },
      ],
    });
    expect(pickPersonas(d)).toEqual({ teacher: 'liruf', student: 'zara' });
  });
});

describe('generateRecapLines', () => {
  it('alternates teacher/student, and the STUDENT calls never contain the lesson', async () => {
    const seen: { turn: number; content: string }[] = [];
    let turn = 0;
    const complete = vi.fn(async (req: { messages: { role: string; content: string }[] }) => {
      turn += 1;
      seen.push({ turn, content: req.messages.map((m) => m.content).join('\n') });
      return { content: `Línea ${turn}.`, promptTokens: 10, completionTokens: 5, cachedPromptTokens: 0 };
    });

    const lines = await generateRecapLines(doc(), { complete: complete as never });

    expect(lines.map((l) => l.character)).toEqual(['dina', 'liruf', 'dina', 'liruf', 'dina']);
    expect(lines).toHaveLength(5);
    // Teacher turns (1,3,5) see the lesson; STUDENT turns (2,4) must NOT.
    for (const { turn: n, content } of seen) {
      const isStudent = n % 2 === 0;
      if (isStudent) {
        expect(content, `student turn ${n} must be blind to the lesson`).not.toContain('El vaso cuesta 5 pesos');
        expect(content).not.toContain('LECCIÓN');
      } else {
        expect(content).toContain('El precio justo');
      }
    }
    // Later turns carry the dialogue so far.
    expect(seen[4]?.content).toContain('Línea 1.');
    expect(seen[4]?.content).toContain('Línea 4.');
  });

  it('caps line length and rejects an empty model line loudly', async () => {
    const complete = vi
      .fn()
      .mockResolvedValueOnce({ content: 'x'.repeat(500), promptTokens: 1, completionTokens: 1, cachedPromptTokens: 0 })
      .mockResolvedValue({ content: '   ', promptTokens: 1, completionTokens: 1, cachedPromptTokens: 0 });

    await expect(generateRecapLines(doc(), { complete: complete as never })).rejects.toThrow(/empty student line at turn 2/);
    const first = complete.mock.results[0];
    expect(first).toBeDefined();
  });
});

describe('appendRecapSegment', () => {
  const lines = [
    { character: 'dina' as const, text_md: 'Hoy aprendimos el precio justo.' },
    { character: 'liruf' as const, text_md: '¿Y eso qué es?' },
  ];

  it('inserts BEFORE a closing checkpoint and completes meta.cast', () => {
    const d = doc({
      cast: ['dina'],
      segments: [
        { id: 's1', type: 'quiz_mcq', prompt_md: 'x', difficulty: 1, xp: 10, payload: {} },
        { id: 's2', type: 'checkpoint', prompt_md: 'y', difficulty: 1, xp: 0, payload: { recap_md: 'z' } },
      ],
    });
    const out = appendRecapSegment(d, lines) as unknown as { meta: { cast: string[] }; segments: { id: string; type: string }[] };
    expect(out.segments.map((s) => s.type)).toEqual(['quiz_mcq', 'story_dialogue', 'checkpoint']);
    expect(out.segments[1]?.id).toBe('recap-charla');
    expect(out.meta.cast).toContain('liruf');
    // input untouched
    expect(d.segments).toHaveLength(2);
  });

  it('appends at the end when no checkpoint closes the lesson', () => {
    const out = appendRecapSegment(doc(), lines) as unknown as { segments: { type: string }[] };
    expect(out.segments[out.segments.length - 1]?.type).toBe('story_dialogue');
  });
});
