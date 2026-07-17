// Connect-to-prior (COURSE_ENGINE.md §3.1/§4): every lesson except the very
// first one in the course must open by linking to the previous slot's
// micro_objective — never a cold restart.
//  - enumerateSlots (pipeline/run.ts) computes `priorMicroObjective` per
//    slot from the GLOBAL linear walk, pure/no network calls.
//  - plan.ts/write.ts render the connect-to-prior instruction when
//    `ctx.prior` is set, and omit it (first-lesson exemption) when absent.

import { describe, expect, it, vi } from 'vitest';
import { enumerateSlots } from '../pipeline/run.js';
import { planLesson, type PlanContext } from '../pipeline/plan.js';
import { writeLessonDocument, type WriteInput } from '../pipeline/write.js';
import { buildTaxonomy, buildFacts, buildDocument } from './fixtures.js';
import type { AdventureFile } from '../catalog/schema.js';
import type { LoadedAdventure } from '../catalog/loader.js';
import type { ChatCompleteRequest, ChatCompleteResult } from '../providers/openaiChat.js';

function lesson(position: number, slug: string, microObjective: string) {
  return { position, slug, micro_objective: microObjective, narrative_beat: 'x', difficulty: 1 as const, suggested_families: ['story'] };
}

function topic(position: number, slug: string, lessons: ReturnType<typeof lesson>[]) {
  return {
    position,
    slug,
    kind: 'teaching' as const,
    title_es: 'Tema',
    concept: 'x',
    learning_objective: 'x',
    key_vocabulary: ['moneda'],
    prior_knowledge: 'x',
    fact_refs: [],
    lessons,
  };
}

function saga(position: number, slug: string, topics: ReturnType<typeof topic>[]) {
  return {
    position,
    slug,
    kind: 'teaching' as const,
    icon: 'auto_stories',
    title: { 'en-US': 'S', 'es-MX': 'S', 'pt-BR': 'S' },
    description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
    topics,
  };
}

function adventure(slug: string, position: number, sagas: ReturnType<typeof saga>[]): LoadedAdventure {
  const data: AdventureFile = {
    schema_version: 1,
    adventure: {
      position,
      slug,
      theme: 'archipelago',
      age_tier: 'tier1',
      title: { 'en-US': 'A', 'es-MX': 'A', 'pt-BR': 'A' },
      description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
      narrative_arc: 'x',
    },
    sagas,
  };
  return { file: `${slug}.yaml`, data };
}

describe('enumerateSlots — priorMicroObjective wiring', () => {
  it('the very first slot of the course has no priorMicroObjective (exempt)', () => {
    const adv = adventure('adv-1', 1, [
      saga(1, 'saga-1', [topic(1, 'topic-1', [lesson(1, 'l1', 'OBJ_1'), lesson(2, 'l2', 'OBJ_2')])]),
    ]);
    const slots = enumerateSlots([adv]);
    expect(slots[0]!.priorMicroObjective).toBeUndefined();
  });

  it('a lesson after position 1 in the SAME topic gets the previous lesson\'s micro_objective', () => {
    const adv = adventure('adv-1', 1, [
      saga(1, 'saga-1', [topic(1, 'topic-1', [lesson(1, 'l1', 'OBJ_1'), lesson(2, 'l2', 'OBJ_2')])]),
    ]);
    const slots = enumerateSlots([adv]);
    expect(slots[1]!.priorMicroObjective).toBe('OBJ_1');
  });

  it('the first lesson of a NEW topic gets the last lesson of the PREVIOUS topic', () => {
    const adv = adventure('adv-1', 1, [
      saga(1, 'saga-1', [
        topic(1, 'topic-1', [lesson(1, 'l1', 'OBJ_1'), lesson(2, 'l2', 'OBJ_2')]),
        topic(2, 'topic-2', [lesson(1, 'l3', 'OBJ_3')]),
      ]),
    ]);
    const slots = enumerateSlots([adv]);
    const firstOfTopic2 = slots.find((s) => s.slotId === 'adv-1/saga-1/topic-2/l3')!;
    expect(firstOfTopic2.priorMicroObjective).toBe('OBJ_2');
  });

  it('the first lesson of a NEW saga gets the last lesson of the previous saga\'s last topic', () => {
    const adv = adventure('adv-1', 1, [
      saga(1, 'saga-1', [topic(1, 'topic-1', [lesson(1, 'l1', 'OBJ_1')])]),
      saga(2, 'saga-2', [topic(1, 'topic-1', [lesson(1, 'l2', 'OBJ_2')])]),
    ]);
    const slots = enumerateSlots([adv]);
    const firstOfSaga2 = slots.find((s) => s.slotId === 'adv-1/saga-2/topic-1/l2')!;
    expect(firstOfSaga2.priorMicroObjective).toBe('OBJ_1');
  });

  it('the first lesson of a NEW adventure gets the last lesson of the previous adventure', () => {
    const adv1 = adventure('adv-1', 1, [saga(1, 'saga-1', [topic(1, 'topic-1', [lesson(1, 'l1', 'OBJ_1')])])]);
    const adv2 = adventure('adv-2', 2, [saga(1, 'saga-1', [topic(1, 'topic-1', [lesson(1, 'l2', 'OBJ_2')])])]);
    const slots = enumerateSlots([adv1, adv2]);
    const firstOfAdv2 = slots.find((s) => s.slotId === 'adv-2/saga-1/topic-1/l2')!;
    expect(firstOfAdv2.priorMicroObjective).toBe('OBJ_1');
  });
});

// ---------------------------------------------------------------------------
// Prompt rendering: plan.ts / write.ts
// ---------------------------------------------------------------------------

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

describe('planLesson prompt — connect-to-prior', () => {
  it('includes the connect-to-prior instruction with the exact prior text when ctx.prior is set', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(validSkeletonJson()), promptTokens: 1, completionTokens: 1 }),
    );
    const ctx: PlanContext = { ...basePlanContext(), prior: 'PRIOR_MICRO_OBJECTIVE_TEXT' };
    await planLesson(ctx, { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).toContain('CONNECT TO PRIOR');
    expect(joined).toContain('PRIOR_MICRO_OBJECTIVE_TEXT');
  });

  it('omits the connect-to-prior instruction when ctx.prior is undefined (first lesson of the course)', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(validSkeletonJson()), promptTokens: 1, completionTokens: 1 }),
    );
    await planLesson(basePlanContext(), { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).not.toContain('CONNECT TO PRIOR');
  });
});

describe('writeLessonDocument prompt — connect-to-prior', () => {
  it('includes the connect-to-prior instruction when ctx.prior is set', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(buildDocument()), promptTokens: 10, completionTokens: 10 }),
    );
    const input: WriteInput = {
      ctx: { ...basePlanContext(), prior: 'PRIOR_MICRO_OBJECTIVE_TEXT' },
      skeleton: { segments: [{ type: 'story_scene', brief: 'intro' }] },
      facts: buildFacts(),
      locale: 'es-MX',
      slug: 'test-lesson',
      subject: 'money',
    };
    await writeLessonDocument(input, { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).toContain('CONNECT TO PRIOR');
    expect(joined).toContain('PRIOR_MICRO_OBJECTIVE_TEXT');
  });

  it('omits the connect-to-prior instruction for the first lesson of the course (ctx.prior undefined)', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({ content: JSON.stringify(buildDocument()), promptTokens: 10, completionTokens: 10 }),
    );
    const input: WriteInput = {
      ctx: basePlanContext(),
      skeleton: { segments: [{ type: 'story_scene', brief: 'intro' }] },
      facts: buildFacts(),
      locale: 'es-MX',
      slug: 'test-lesson',
      subject: 'money',
    };
    await writeLessonDocument(input, { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).not.toContain('CONNECT TO PRIOR');
  });
});
