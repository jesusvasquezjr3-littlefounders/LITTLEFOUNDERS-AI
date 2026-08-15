// A mix-rule violation is a REPLAN, not a silent mutation.
//
// Owner report 2026-08-15: "hay preguntas que salen de la nada". A plan is a
// TYPE and a BRIEF. `planRepair` can only change the type, and the brief is
// what carries the micro-situation the lesson has been building — so a silent
// retype handed the writer an exercise mechanic with no relationship to the
// story, at the END of the lesson (both the money rule and the diversify rule
// scan from the back). Feeding the violation back to the planner fixes type and
// brief together, for one cheap DeepSeek call, only when a rule was broken.

import { describe, expect, it, vi } from 'vitest';
import { planLesson, type PlanContext } from '../pipeline/plan.js';
import { writeLessonDocument, type WriteInput } from '../pipeline/write.js';
import { buildDocument, buildFacts, buildTaxonomy } from './fixtures.js';
import type { ChatCompleteRequest, ChatCompleteResult } from '../providers/openaiChat.js';

function ctx(): PlanContext {
  return {
    tier: 'tier1',
    taxonomy: buildTaxonomy(),
    courseTitle: 'Educación Financiera',
    adventureNarrativeArc: 'x',
    topic: { concept: 'x', learningObjective: 'x', keyVocabulary: ['moneda'], priorKnowledge: 'x', factRefs: [] },
    lesson: { microObjective: 'x', narrativeBeat: 'x', difficulty: 1, suggestedFamilies: ['story'] },
  };
}

const COMPLIANT = {
  segments: [
    { type: 'story_scene', brief: 'Zara abre el puesto y cuenta lo que tiene.' },
    { type: 'quiz_mcq', brief: 'Elegir qué comprar primero con 10 pesos.' },
    { type: 'true_false', brief: 'Decidir si alcanza para dos vasos.' },
    { type: 'match_pairs', brief: 'Unir cada producto con su precio.' },
    { type: 'sort_buckets', brief: 'Separar lo necesario de lo deseado.' },
    { type: 'needs_wants', brief: 'Clasificar la compra del día.' },
    { type: 'coin_count', brief: 'Juntar 5 pesos en monedas.' },
    { type: 'number_input', brief: 'Escribir cuántos pesos sobran: 3.' },
  ],
};

/** Every segment the same type: breaks the story-opener and distinct-type rules. */
const VIOLATING = {
  segments: Array.from({ length: 8 }, (_, i) => ({ type: 'quiz_mcq', brief: `pregunta ${i}` })),
};

function reply(json: unknown): ChatCompleteResult {
  return { content: JSON.stringify(json), promptTokens: 1, completionTokens: 1 };
}

function joined(req: ChatCompleteRequest): string {
  return req.messages.map((m) => m.content).join('\n');
}

describe('planLesson — mix-rule violations go back to the planner', () => {
  it('re-plans once and keeps the corrected plan, leaving nothing for the repair to fix', async () => {
    const complete = vi
      .fn<(req: ChatCompleteRequest) => Promise<ChatCompleteResult>>()
      .mockResolvedValueOnce(reply(VIOLATING))
      .mockResolvedValueOnce(reply(COMPLIANT));

    const result = await planLesson(ctx(), { complete: complete as never });

    expect(complete).toHaveBeenCalledTimes(2);
    expect(result.attempts).toBe(2);
    // The corrected plan needed no deterministic surgery at all.
    expect(result.fixes).toEqual([]);
    expect(result.skeleton.segments.every((s) => s.retypedFrom === undefined)).toBe(true);
    expect(result.skeleton.segments[0]!.type).toBe('story_scene');
  });

  it('tells the planner WHICH rules broke and that the brief must change too', async () => {
    const complete = vi
      .fn<(req: ChatCompleteRequest) => Promise<ChatCompleteResult>>()
      .mockResolvedValueOnce(reply(VIOLATING))
      .mockResolvedValueOnce(reply(COMPLIANT));

    await planLesson(ctx(), { complete: complete as never });

    const feedback = joined(complete.mock.calls[1]![0]);
    expect(feedback).toContain('segment 1 must be a `story` family type');
    expect(feedback).toContain('distinct types');
    // The whole point: a brief written for the old type is not acceptable.
    expect(feedback).toContain('BOTH the type and its brief corrected');
  });

  it('does not spend a retry when the first plan already complies', async () => {
    const complete = vi.fn<(req: ChatCompleteRequest) => Promise<ChatCompleteResult>>().mockResolvedValue(reply(COMPLIANT));

    const result = await planLesson(ctx(), { complete: complete as never });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.fixes).toEqual([]);
  });

  /*
   * Degrade, do not die. A plan whose ONLY fault is a mix-rule violation is
   * still a usable plan: the deterministic net repairs it and the retyped
   * segments are flagged for the writer. Killing the slot instead would trade
   * a flawed lesson for no lesson.
   */
  it('falls back to the deterministic repair when every attempt still violates', async () => {
    const complete = vi.fn<(req: ChatCompleteRequest) => Promise<ChatCompleteResult>>().mockResolvedValue(reply(VIOLATING));

    const result = await planLesson(ctx(), { complete: complete as never });

    expect(complete).toHaveBeenCalledTimes(3);
    expect(result.skeleton.segments[0]!.type).not.toBe('quiz_mcq');
    expect(result.fixes[0]).toContain('could not satisfy the mix rules');
    // And the writer is told which briefs no longer match their mechanic.
    expect(result.skeleton.segments.some((s) => s.retypedFrom)).toBe(true);
  });

  /*
   * The degradation is scoped: only a mix-rule failure may fall through. A plan
   * that never parsed produced no usable skeleton at all, and pretending
   * otherwise would publish whatever the repair invented from nothing.
   */
  it('still throws when the model never returns a contract-valid plan', async () => {
    const complete = vi
      .fn<(req: ChatCompleteRequest) => Promise<ChatCompleteResult>>()
      .mockResolvedValue({ content: 'not json at all', promptTokens: 1, completionTokens: 1 });

    await expect(planLesson(ctx(), { complete: complete as never })).rejects.toThrow(/corrective attempt/i);
  });
});

/*
 * The flag is only worth setting if it reaches the author. A `retypedFrom`
 * segment carries a brief written for another mechanic; unflagged, the writer
 * transcribes a decision-quiz premise into a jar-splitting widget and the child
 * meets an exercise the lesson never set up.
 */
describe('writeLessonDocument prompt — a retyped brief is called out', () => {
  const writeInput = (segments: Array<{ type: string; brief: string; retypedFrom?: string }>): WriteInput => ({
    ctx: ctx(),
    skeleton: { segments },
    facts: buildFacts(),
    locale: 'es-MX',
    slug: 'test-lesson',
    subject: 'money',
  });

  it('warns the author, names both types, and demands a re-anchored premise', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(buildDocument()), promptTokens: 10, completionTokens: 10 }),
    );

    await writeLessonDocument(
      writeInput([{ type: 'piggy_split', brief: 'Zara decide si sube el precio', retypedFrom: 'quiz_mcq' }]),
      { complete: complete as never },
    );

    const prompt = joined(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(prompt).toContain('written for "quiz_mcq"');
    expect(prompt).toContain('CHANGED to "piggy_split"');
    expect(prompt).toContain('RE-ANCHOR');
    // The premise itself still travels — same characters, objects and stakes.
    expect(prompt).toContain('Zara decide si sube el precio');
  });

  it('stays silent for an untouched segment, so the warning keeps its meaning', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(buildDocument()), promptTokens: 10, completionTokens: 10 }),
    );

    await writeLessonDocument(writeInput([{ type: 'story_scene', brief: 'Zara abre el puesto' }]), { complete: complete as never });

    expect(joined(complete.mock.calls[0]![0] as ChatCompleteRequest)).not.toContain('RE-ANCHOR');
  });
});
