// Audience registers (COURSE_ENGINE.md §3.3):
//  - resolveRegister(): kid is always vocabulary-gated regardless of the
//    catalog, adult falls back to sane built-in defaults when the catalog
//    doesn't declare `registers` at all, slug/title suffixes
//  - resolveAllowedTypes({ fullPalette }) bypasses tier subsetting
//  - plan.ts/write.ts inject the tone directive into prompts when present
//  - localize.ts threads the tone directive + optionally skips the re-gate

import { describe, expect, it, vi } from 'vitest';
import { resolveRegister } from '../pipeline/register.js';
import { resolveAllowedTypes } from '../pipeline/prompts/palette.js';
import { ALL_TYPES } from '../contract/registry.js';
import { planLesson, type PlanContext } from '../pipeline/plan.js';
import { writeLessonDocument, type WriteInput } from '../pipeline/write.js';
import { localizeLesson } from '../pipeline/localize.js';
import { buildTaxonomy, buildFacts, buildDocument } from './fixtures.js';
import type { ChatCompleteRequest, ChatCompleteResult } from '../providers/openaiChat.js';

describe('resolveRegister', () => {
  it('kid is always vocabulary-gated, even if a (hypothetical) taxonomy tried to turn it off', () => {
    const taxonomy = buildTaxonomy({
      registers: { kid: { vocabulary_gates: false }, adult: { vocabulary_gates: false } },
    });
    const resolved = resolveRegister(taxonomy, 'kid');
    expect(resolved.vocabularyGates).toBe(true);
    expect(resolved.fullPalette).toBe(false);
    expect(resolved.slugSuffix).toBe('');
    expect(resolved.titleSuffix).toBe('');
  });

  it('adult falls back to built-in defaults when taxonomy.registers is absent entirely', () => {
    const taxonomy = buildTaxonomy(); // no `registers` field — every pre-existing catalog
    const resolved = resolveRegister(taxonomy, 'adult');
    expect(resolved.vocabularyGates).toBe(false);
    expect(resolved.fullPalette).toBe(true);
    expect(resolved.toneDirectiveEs).toBeTruthy();
    expect(resolved.slugSuffix).toBe('-adultos');
    expect(resolved.titleSuffix).toBe(' (Adultos)');
  });

  it('adult falls back to built-in defaults even when taxonomy itself is undefined', () => {
    const resolved = resolveRegister(undefined, 'adult');
    expect(resolved.vocabularyGates).toBe(false);
    expect(resolved.fullPalette).toBe(true);
    expect(resolved.toneDirectiveEs).toBeTruthy();
  });

  it('adult reads a catalog-declared tone_es / vocabulary_gates override', () => {
    const taxonomy = buildTaxonomy({
      registers: { adult: { tone_es: 'CUSTOM TONE', vocabulary_gates: true } },
    });
    const resolved = resolveRegister(taxonomy, 'adult');
    expect(resolved.toneDirectiveEs).toBe('CUSTOM TONE');
    expect(resolved.vocabularyGates).toBe(true); // catalog explicitly opted back into gating
  });
});

describe('resolveAllowedTypes({ fullPalette })', () => {
  it('returns every type in the closed canon, ignoring tier allowlist/exceptions entirely', () => {
    const taxonomy = buildTaxonomy();
    const { allowed } = resolveAllowedTypes(taxonomy, 'tier1', { fullPalette: true });
    expect([...allowed].sort()).toEqual([...ALL_TYPES].sort());
    // tier1_banned_types normally excludes these — full palette does not.
    expect(allowed).toContain('confidence_quiz');
    expect(allowed).toContain('interest_peek');
  });

  it('without fullPalette, behaves exactly as before (tier subsetting applies)', () => {
    const taxonomy = buildTaxonomy();
    const { allowed } = resolveAllowedTypes(taxonomy, 'tier1');
    expect(allowed).not.toContain('confidence_quiz');
  });
});

function basePlanContext(): PlanContext {
  return {
    tier: 'tier1',
    taxonomy: buildTaxonomy(),
    courseTitle: 'Educación Financiera',
    adventureNarrativeArc: 'x',
    topic: { concept: 'x', learningObjective: 'x', keyVocabulary: ['moneda'], priorKnowledge: 'x', factRefs: [] },
    lesson: { microObjective: 'x', narrativeBeat: 'x', difficulty: 1, suggestedFamilies: ['story'] },
  };
}

function validSkeletonJson() {
  return {
    segments: [
      { type: 'story_scene', brief: 'x' },
      { type: 'quiz_mcq', brief: 'x' },
      { type: 'true_false', brief: 'x' },
      { type: 'match_pairs', brief: 'x' },
      { type: 'sort_buckets', brief: 'x' },
      { type: 'needs_wants', brief: 'x' },
      { type: 'coin_count', brief: 'x' },
      { type: 'type_answer', brief: 'x' },
    ],
  };
}

function joinedMessages(req: ChatCompleteRequest): string {
  return req.messages.map((m) => m.content).join(' ');
}

describe('register tone directive — plan.ts / write.ts prompts', () => {
  it('planLesson injects the adult tone directive into the prompt when register is set', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(validSkeletonJson()), promptTokens: 1, completionTokens: 1 }),
    );
    const ctx: PlanContext = { ...basePlanContext(), register: { fullPalette: true, toneDirectiveEs: 'TONO_ADULTO_UNICO' } };
    await planLesson(ctx, { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).toContain('TONO_ADULTO_UNICO');
    expect(joined).toContain('AUDIENCE REGISTER');
  });

  it('planLesson prompt has no register line when register is absent (kid, default)', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(validSkeletonJson()), promptTokens: 1, completionTokens: 1 }),
    );
    await planLesson(basePlanContext(), { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).not.toContain('AUDIENCE REGISTER');
  });

  it('writeLessonDocument injects the adult tone directive into the hard rules', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(buildDocument()), promptTokens: 10, completionTokens: 10 }),
    );
    const input: WriteInput = {
      ctx: { ...basePlanContext(), register: { fullPalette: true, toneDirectiveEs: 'TONO_ADULTO_UNICO' } },
      skeleton: { segments: [{ type: 'story_scene', brief: 'intro' }] },
      facts: buildFacts(),
      locale: 'es-MX',
      slug: 'test-lesson',
      subject: 'money',
    };
    await writeLessonDocument(input, { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).toContain('TONO_ADULTO_UNICO');
  });
});

describe('register — localize.ts', () => {
  const gateCtx = { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() };

  function identityTranslate() {
    return vi.fn(async (req: ChatCompleteRequest): Promise<ChatCompleteResult> => {
      const lastLine = req.messages[req.messages.length - 1]!.content.split('\n').pop()!;
      const map = JSON.parse(lastLine) as Record<string, string>;
      const translated: Record<string, string> = {};
      for (const [k, v] of Object.entries(map)) translated[k] = `EN:${v}`;
      return { content: JSON.stringify(translated), promptTokens: 5, completionTokens: 5 };
    });
  }

  it('injects the register tone directive into the translation system prompt', async () => {
    const translate = identityTranslate();
    await localizeLesson(buildDocument(), 'en-US', gateCtx, {
      translate: translate as never,
      registerToneEs: 'TONO_ADULTO_UNICO',
    });
    const sentContent = translate.mock.calls[0]![0].messages.map((m) => m.content).join('\n');
    expect(sentContent).toContain('TONO_ADULTO_UNICO');
    expect(sentContent).toContain('ADULT');
  });

  it('skipVocabularyGate lets a forbidden word through localize without throwing', async () => {
    const forbiddenTaxonomy = buildTaxonomy({
      age_tiers: {
        tier1: {
          ages: '6-7',
          forbidden_vocabulary: { 'es-MX': [], 'en-US': ['loan'], 'pt-BR': [] },
        },
      },
    });
    // Every translated value gets " loan" appended, whatever the actual index map turns out to be.
    const translate = vi.fn(async (req: ChatCompleteRequest): Promise<ChatCompleteResult> => {
      const lastLine = req.messages[req.messages.length - 1]!.content.split('\n').pop()!;
      const map = JSON.parse(lastLine) as Record<string, string>;
      const translated: Record<string, string> = {};
      for (const k of Object.keys(map)) translated[k] = 'a loan for adults';
      return { content: JSON.stringify(translated), promptTokens: 5, completionTokens: 5 };
    });
    // Without skip, this SHOULD throw (loan is forbidden for en-US/tier1).
    await expect(
      localizeLesson(buildDocument(), 'en-US', { taxonomy: forbiddenTaxonomy, tier: 'tier1', facts: buildFacts() }, {
        translate: translate as never,
      }),
    ).rejects.toThrow();

    // With skip (adult register), it must NOT throw.
    await expect(
      localizeLesson(buildDocument(), 'en-US', { taxonomy: forbiddenTaxonomy, tier: 'tier1', facts: buildFacts() }, {
        translate: translate as never,
        skipVocabularyGate: true,
      }),
    ).resolves.toBeDefined();
  });
});
