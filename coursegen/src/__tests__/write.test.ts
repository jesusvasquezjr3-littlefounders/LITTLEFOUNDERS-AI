import { describe, expect, it, vi } from 'vitest';
import { writeLessonDocument, stripNullValues, repairDocument, type WriteInput } from '../pipeline/write.js';
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

describe('stripNullValues', () => {
  it('drops null-valued object keys recursively but keeps everything else', () => {
    const input = {
      id: 's1',
      title: null,
      narrator: null,
      payload: { options: [{ id: 'a', rationale_md: null, label: 'A' }, { id: 'b', rationale_md: 'because', label: 'B' }] },
      hints: null,
      keep: 0,
      keepFalse: false,
      keepEmpty: '',
    };
    const out = stripNullValues(input) as Record<string, unknown>;
    expect('title' in out).toBe(false);
    expect('narrator' in out).toBe(false);
    expect('hints' in out).toBe(false);
    expect(out.keep).toBe(0);
    expect(out.keepFalse).toBe(false);
    expect(out.keepEmpty).toBe('');
    const opts = (out.payload as { options: Record<string, unknown>[] }).options;
    expect('rationale_md' in opts[0]!).toBe(false); // null dropped
    expect(opts[1]!.rationale_md).toBe('because'); // real value kept
  });

  it('preserves array length (recurses into elements, does not compact)', () => {
    expect(stripNullValues([{ x: null, y: 1 }, { x: 2 }])).toEqual([{ y: 1 }, { x: 2 }]);
  });

  it('leaves primitives and top-level null untouched in shape', () => {
    expect(stripNullValues('hi')).toBe('hi');
    expect(stripNullValues(5)).toBe(5);
  });
});

describe('repairDocument — balance_scale subset-sum', () => {
  function balanceDoc(weights: number[], leftValues: number[]) {
    return {
      segments: [{
        id: 's1',
        type: 'balance_scale',
        payload: {
          left_fixed: leftValues.map((v, i) => ({ label: `L${i}`, value: v })),
          weights: weights.map((v, i) => ({ id: `w${i}`, label: `W${i}`, value: v })),
        },
      }],
    };
  }

  it('leaves a solvable board untouched', () => {
    const doc = balanceDoc([5, 3, 2, 4], [8]); // 5+3=8 works
    repairDocument(doc);
    expect(doc.segments[0]!.payload.weights.map((w) => w.value)).toEqual([5, 3, 2, 4]);
  });

  it('repairs an unsolvable board by making weight[0] the exact left total', () => {
    const doc = balanceDoc([5, 6, 7], [8]); // no subset sums to 8
    repairDocument(doc);
    expect(doc.segments[0]!.payload.weights[0]!.value).toBe(8);
    // rest stay as distractors
    expect(doc.segments[0]!.payload.weights.slice(1).map((w) => w.value)).toEqual([6, 7]);
  });

  it('ignores malformed payloads and non-balance segments without throwing', () => {
    expect(() => repairDocument({ segments: [{ id: 'x', type: 'quiz_mcq', payload: {} }] })).not.toThrow();
    expect(() => repairDocument({ segments: [{ id: 'x', type: 'balance_scale', payload: { weights: 'nope' } }] })).not.toThrow();
    expect(() => repairDocument(null)).not.toThrow();
  });
});

describe('stripNullValues — semantic nulls survive', () => {
  it('keeps story_branch ending `next: null` and scoring `hearts: null` intact', () => {
    const doc = {
      scoring: { hearts: null },
      segments: [{ type: 'story_branch', payload: { nodes: [{ id: 'fin', choices: [{ id: 'c1', text_md: 'Fin', next: null }] }] }, narrator: null }],
    };
    const out = stripNullValues(doc) as typeof doc;
    expect(out.scoring.hearts).toBeNull();
    expect(out.segments[0]!.payload.nodes[0]!.choices[0]!.next).toBeNull();
    expect('narrator' in out.segments[0]!).toBe(false); // ordinary null still stripped
  });
});

describe('repairDocument — interest_peek constraint repair', () => {
  it('bumps periods<2 to 2 and recomputes answer.value with the gate formula', () => {
    const doc = {
      segments: [{
        id: 's1', type: 'interest_peek',
        payload: { principal: 100, rate_pct: 10, periods: 1, currency: 'MXN' },
        answer: { value: 110, tolerance: 0 },
      }],
    };
    repairDocument(doc);
    const seg = doc.segments[0]!;
    expect(seg.payload.periods).toBe(2);
    expect(seg.answer.value).toBe(121); // 100·1.1²
    expect(seg.answer.tolerance).toBeGreaterThan(0);
  });

  it('leaves a valid interest_peek untouched', () => {
    const doc = {
      segments: [{
        id: 's1', type: 'interest_peek',
        payload: { principal: 100, rate_pct: 10, periods: 5, currency: 'MXN' },
        answer: { value: 161.05, tolerance: 5 },
      }],
    };
    repairDocument(doc);
    expect(doc.segments[0]!.payload.periods).toBe(5);
    expect(doc.segments[0]!.answer.value).toBe(161.05);
    expect(doc.segments[0]!.answer.tolerance).toBe(5);
  });
});

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
