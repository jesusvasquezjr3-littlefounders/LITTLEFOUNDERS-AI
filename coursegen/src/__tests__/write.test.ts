import { describe, expect, it, vi } from 'vitest';
import { writeLessonDocument, type WriteInput } from '../pipeline/write.js';
import { buildFacts, buildTaxonomy, baseSegments } from './fixtures.js';
import type { ChatCompleteRequest, ChatCompleteResult } from '../providers/openaiChat.js';

function baseInput(): WriteInput {
  return {
    ctx: {
      tier: 'tier1',
      taxonomy: undefined as never,
      courseTitle: 'Educación Financiera',
      adventureNarrativeArc: 'x',
      topic: { concept: 'x', learningObjective: 'x', keyVocabulary: ['moneda'], priorKnowledge: 'x', factRefs: [] },
      lesson: { microObjective: 'x', narrativeBeat: 'x', difficulty: 1, suggestedFamilies: ['money'] },
    },
    skeleton: { segments: [{ type: 'story_scene', brief: 'intro' }] },
    facts: buildFacts(),
    locale: 'es-MX',
    slug: 'test-lesson',
    subject: 'money',
  };
}

function validDocumentJson(extraBrokenSegment: boolean) {
  const segments = baseSegments();
  if (extraBrokenSegment) {
    segments.push({ id: 's7', type: 'this_type_does_not_exist' } as never);
    segments.push({ id: 's8', type: 'story_scene', prompt_md: 'x', difficulty: 1, xp: 0, payload: { backdrop: 'base', body_md: 'x' } } as never);
  }
  return {
    schema_version: 1,
    meta: {
      slug: 'test-lesson',
      title: 'Lección',
      locale: 'es-MX',
      subject: 'money',
      estimated_minutes: 5,
      objectives: ['x'],
      cast: ['dina'],
    },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
    segments,
  };
}

describe('writeLessonDocument', () => {
  it('returns a valid document on the first attempt when the model gets it right', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({
        content: JSON.stringify(validDocumentJson(false)),
        promptTokens: 10,
        completionTokens: 10,
      }),
    );
    const result = await writeLessonDocument(baseInput(), { complete: complete as never });
    expect(result.salvaged).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.document.segments.length).toBe(baseSegments().length);
  });

  it('feeds Zod issues back into the next call when the document is invalid', async () => {
    let call = 0;
    const complete = vi.fn(async (): Promise<ChatCompleteResult> => {
      call++;
      if (call === 1) return { content: '{"not":"valid"}', promptTokens: 1, completionTokens: 1 };
      return { content: JSON.stringify(validDocumentJson(false)), promptTokens: 1, completionTokens: 1 };
    });
    const result = await writeLessonDocument(baseInput(), { complete: complete as never });
    expect(result.attempts).toBe(2);
    expect(complete).toHaveBeenCalledTimes(2);
    // The 2nd call's messages must include the issues from the 1st failure.
    const secondCallArgs = complete.mock.calls[1]![0] as ChatCompleteRequest;
    const joined = secondCallArgs.messages.map((m) => m.content).join(' ');
    expect(joined).toContain('previous JSON failed validation');
  });

  it('feeds GATE failures (not just Zod issues) back into the next call when gateCtx is provided', async () => {
    // Zod-valid document whose one graded segment carries a too-short,
    // ungrounded explanation_md — passes the contract, fails gate 6.
    const gateBreaking = validDocumentJson(false) as { segments: Record<string, unknown>[] };
    const graded = gateBreaking.segments.find((s) => s.type === 'quiz_mcq');
    expect(graded).toBeDefined();
    graded!.explanation_md = '¡Muy bien hecho!'; // <40 chars, no digit/character/payload token

    let call = 0;
    const complete = vi.fn(async (): Promise<ChatCompleteResult> => {
      call++;
      if (call === 1) return { content: JSON.stringify(gateBreaking), promptTokens: 1, completionTokens: 1 };
      return { content: JSON.stringify(validDocumentJson(false)), promptTokens: 1, completionTokens: 1 };
    });

    const input: WriteInput = {
      ...baseInput(),
      gateCtx: { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts(), topicTitle: 'x' },
    };
    const result = await writeLessonDocument(input, { complete: complete as never });
    expect(result.attempts).toBe(2);
    // The 2nd call's messages must carry the gate's actionable message.
    const secondCallArgs = complete.mock.calls[1]![0] as ChatCompleteRequest;
    const joined = secondCallArgs.messages.map((m) => m.content).join(' ');
    expect(joined).toContain('[gate 6');
    expect(joined).toContain('too generic');
  });

  it('salvages a document with one unsalvageable segment when corrective retries are exhausted', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({
        // ALWAYS returns the same broken document — corrective retries never fix it,
        // so write.ts must fall back to per-segment salvage.
        content: JSON.stringify(validDocumentJson(true)),
        promptTokens: 10,
        completionTokens: 10,
      }),
    );
    const result = await writeLessonDocument(baseInput(), { complete: complete as never });
    expect(result.salvaged).toBe(true);
    expect(result.droppedSegments).toBe(1);
    expect(result.document.segments.length).toBe(baseSegments().length + 1); // +1 valid (s8), -1 dropped (s7)
    expect(result.document.segments.some((s) => s.id === 's7')).toBe(false);
  });
});
