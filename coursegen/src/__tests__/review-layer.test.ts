// Spaced-review layer tests (COURSE_ENGINE.md §3.1):
//  - catalog schema: `kind`/`review_of` shape rules on sagas + topics
//  - loader: review_of path resolution across adventure files, kind-aware
//    quota warnings, resolveReviewSources()
//  - pipeline prompts: plan.ts/write.ts ground review lessons in their
//    sources and carry the consolidation/interleave/difficulty-cap rules

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { loadCourseCatalog, resolveReviewSources } from '../catalog/loader.js';
import { topicBlueprintSchema, sagaBlueprintSchema, reviewOfPathSchema } from '../catalog/schema.js';
import { planLesson, renderCompetencyBlockForPrompt, type PlanContext } from '../pipeline/plan.js';
import type { CompetencyPromptContext } from '../catalog/competencyGraph.js';
import { writeLessonDocument, type WriteInput } from '../pipeline/write.js';
import { buildFacts, buildTaxonomy, buildDocument } from './fixtures.js';
import type { ChatCompleteRequest, ChatCompleteResult } from '../providers/openaiChat.js';

// ---------------------------------------------------------------------------
// Schema-level: reviewOfPathSchema + kind/review_of shape rules
// ---------------------------------------------------------------------------

function baseLesson(position: number) {
  return {
    position,
    slug: `lesson-${position}`,
    micro_objective: 'x',
    narrative_beat: 'x',
    difficulty: 1,
    suggested_families: ['story'],
  };
}

function baseTopicFields(overrides: Record<string, unknown> = {}) {
  return {
    position: 1,
    slug: 'topic-1',
    title_es: 'Tema',
    concept: 'x',
    learning_objective: 'x',
    key_vocabulary: ['moneda'],
    prior_knowledge: 'x',
    fact_refs: [],
    lessons: [baseLesson(1), baseLesson(2), baseLesson(3), baseLesson(4)],
    ...overrides,
  };
}

describe('reviewOfPathSchema', () => {
  it('accepts a 2-segment saga path', () => {
    expect(reviewOfPathSchema.safeParse('archipielago-del-trueque/la-isla-de-los-trueques').success).toBe(true);
  });

  it('accepts a 3-segment topic path', () => {
    expect(
      reviewOfPathSchema.safeParse('archipielago-del-trueque/la-isla-de-los-trueques/monedas-y-billetes').success,
    ).toBe(true);
  });

  it('rejects a single-segment path', () => {
    expect(reviewOfPathSchema.safeParse('only-one-segment').success).toBe(false);
  });

  it('rejects non-kebab-case segments', () => {
    expect(reviewOfPathSchema.safeParse('Has_Underscore/x').success).toBe(false);
  });
});

describe('topicBlueprintSchema kind/review_of rules', () => {
  it('defaults kind to teaching with no review_of', () => {
    const parsed = topicBlueprintSchema.safeParse(baseTopicFields());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('teaching');
      expect(parsed.data.review_of).toBeUndefined();
    }
  });

  it('rejects a review-kind topic with no review_of at all', () => {
    const parsed = topicBlueprintSchema.safeParse(baseTopicFields({ kind: 'review_spaced' }));
    expect(parsed.success).toBe(false);
  });

  it('rejects a review-kind topic with an empty review_of array', () => {
    const parsed = topicBlueprintSchema.safeParse(baseTopicFields({ kind: 'review_spaced', review_of: [] }));
    expect(parsed.success).toBe(false);
  });

  it('accepts a review-kind topic with a non-empty review_of', () => {
    const parsed = topicBlueprintSchema.safeParse(
      baseTopicFields({ kind: 'review_spaced', review_of: ['adv-1/saga-1'] }),
    );
    expect(parsed.success).toBe(true);
  });

  it('accepts review_quest with a topic-level review_of path', () => {
    const parsed = topicBlueprintSchema.safeParse(
      baseTopicFields({ kind: 'review_quest', review_of: ['adv-1/saga-1/topic-1'] }),
    );
    expect(parsed.success).toBe(true);
  });

  it('rejects a teaching-kind topic that carries review_of', () => {
    const parsed = topicBlueprintSchema.safeParse(baseTopicFields({ kind: 'teaching', review_of: ['adv-1/saga-1'] }));
    expect(parsed.success).toBe(false);
  });
});

describe('sagaBlueprintSchema kind', () => {
  function baseSaga(overrides: Record<string, unknown> = {}) {
    return {
      position: 1,
      slug: 'saga-1',
      icon: 'auto_stories',
      title: { 'en-US': 'S', 'es-MX': 'S', 'pt-BR': 'S' },
      description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
      topics: [baseTopicFields()],
      ...overrides,
    };
  }

  it('defaults to teaching', () => {
    const parsed = sagaBlueprintSchema.safeParse(baseSaga());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.kind).toBe('teaching');
  });

  it('accepts kind: review', () => {
    const parsed = sagaBlueprintSchema.safeParse(baseSaga({ kind: 'review' }));
    expect(parsed.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loader-level: cross-file path resolution + kind-aware quota warnings
// ---------------------------------------------------------------------------

function taxonomyFixture() {
  return {
    schema_version: 1,
    themes: ['archipelago'],
    age_tiers: {
      tier1: { ages: '6-7', forbidden_vocabulary: { 'es-MX': [], 'en-US': [], 'pt-BR': [] } },
    },
    families: ['story', 'choice', 'money'],
    family_allowlist_by_tier: { tier1: ['story', 'choice', 'money'] },
    type_exceptions: { tier1_extra_allowed: [], tier1_banned_types: [] },
  };
}

function factsFixture() {
  return { schema_version: 1, facts: { 'x.fact': { value: 1, verified: true } } };
}

function catalogFixture(files: string[]) {
  return {
    schema_version: 1,
    course: {
      slug: 'test-course',
      subject: 'money',
      title: { 'en-US': 'Test', 'es-MX': 'Prueba', 'pt-BR': 'Teste' },
      description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
      authoring_locale: 'es-MX',
    },
    adventures: files.map((file) => ({ file })),
  };
}

function saga(position: number, slug: string, topics: unknown[], kind: 'teaching' | 'review' = 'teaching') {
  return {
    position,
    slug,
    kind,
    icon: 'auto_stories',
    title: { 'en-US': 'S', 'es-MX': 'S', 'pt-BR': 'S' },
    description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
    topics,
  };
}

function adventureData(slug: string, sagas: unknown[]) {
  return {
    schema_version: 1,
    adventure: {
      position: 1,
      slug,
      theme: 'archipelago',
      age_tier: 'tier1',
      title: { 'en-US': 'A', 'es-MX': 'A', 'pt-BR': 'A' },
      description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
      narrative_arc: 'x',
    },
    sagas,
  };
}

let courseDir: string;

beforeEach(() => {
  courseDir = mkdtempSync(path.join(tmpdir(), 'forge-review-'));
  mkdirSync(path.join(courseDir, 'adventures'), { recursive: true });
});

afterEach(() => {
  rmSync(courseDir, { recursive: true, force: true });
});

function writeCourse(adventureFiles: Record<string, unknown>) {
  writeFileSync(path.join(courseDir, 'taxonomy.yaml'), stringify(taxonomyFixture()));
  writeFileSync(path.join(courseDir, 'facts.yaml'), stringify(factsFixture()));
  writeFileSync(path.join(courseDir, 'catalog.yaml'), stringify(catalogFixture(Object.keys(adventureFiles))));
  for (const [file, data] of Object.entries(adventureFiles)) {
    writeFileSync(path.join(courseDir, file), stringify(data));
  }
}

describe('loadCourseCatalog — review_of path resolution', () => {
  it('errors on an unresolved review_of path', () => {
    const adv = adventureData('adv-1', [
      saga(1, 'saga-1', [
        baseTopicFields({ slug: 'topic-1' }),
        baseTopicFields({ position: 2, slug: 'topic-2', kind: 'review_spaced', review_of: ['adv-1/saga-1/does-not-exist'] }),
      ]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });

    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.level === 'error' && i.message.includes('unresolved path'))).toBe(true);
  });

  it('resolves review_of paths that point across DIFFERENT adventure files', () => {
    const adv1 = adventureData('adv-1', [
      saga(1, 'saga-1', [baseTopicFields({ slug: 'topic-1' })]),
    ]);
    const adv2 = adventureData('adv-2', [
      saga(1, 'saga-2', [
        baseTopicFields({ slug: 'topic-a' }),
        baseTopicFields({
          position: 2,
          slug: 'topic-b',
          kind: 'review_interleaved',
          review_of: ['adv-1/saga-1', 'adv-1/saga-1/topic-1'],
        }),
      ]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv1, 'adventures/02-b.yaml': adv2 });

    const result = loadCourseCatalog(courseDir);
    expect(result.issues.filter((i) => i.level === 'error')).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it('resolveReviewSources expands a saga path and dedupes overlapping topic paths', () => {
    const adv1 = adventureData('adv-1', [
      saga(1, 'saga-1', [baseTopicFields({ slug: 'topic-1', concept: 'SOURCE CONCEPT' })]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv1 });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(true);

    // Both a whole-saga reference and an explicit topic reference resolve to
    // the SAME topic here — resolveReviewSources must not duplicate it.
    const sources = resolveReviewSources(result.course, ['adv-1/saga-1', 'adv-1/saga-1/topic-1']);
    expect(sources).toHaveLength(1);
    expect(sources[0]!.path).toBe('adv-1/saga-1/topic-1');
    expect(sources[0]!.concept).toBe('SOURCE CONCEPT');
  });
});

describe('loadCourseCatalog — kind-aware quota warnings', () => {
  it('warns with a kind=teaching message when a teaching saga deviates from 8 topics', () => {
    const adv = adventureData('adv-1', [
      saga(
        1,
        'saga-1',
        [1, 2, 3, 4, 5, 6].map((n) => baseTopicFields({ position: n, slug: `topic-${n}` })),
        'teaching',
      ),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(
      result.issues.some(
        (i) => i.level === 'warning' && i.message.includes('kind=teaching') && i.message.includes('expected 8'),
      ),
    ).toBe(true);
  });

  it('warns with a kind=review message when the review saga deviates from 6 topics', () => {
    const teachingAdv = adventureData('adv-1', [
      saga(1, 'saga-1', [baseTopicFields({ slug: 'topic-1' })], 'teaching'),
    ]);
    const reviewAdv = adventureData('adv-2', [
      saga(
        1,
        'review-saga',
        [
          baseTopicFields({ slug: 'quest-1', kind: 'review_quest', review_of: ['adv-1/saga-1'] }),
          baseTopicFields({ position: 2, slug: 'quest-2', kind: 'review_quest', review_of: ['adv-1/saga-1'] }),
        ],
        'review',
      ),
    ]);
    writeCourse({ 'adventures/01-a.yaml': teachingAdv, 'adventures/02-b.yaml': reviewAdv });
    const result = loadCourseCatalog(courseDir);
    expect(
      result.issues.some(
        (i) => i.level === 'warning' && i.message.includes('kind=review') && i.message.includes('expected 6'),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pipeline prompts: review context reaches plan.ts + write.ts
// ---------------------------------------------------------------------------

function reviewPlanContext(kind: 'review_spaced' | 'review_interleaved' | 'review_quest'): PlanContext {
  return {
    tier: 'tier1',
    taxonomy: buildTaxonomy(),
    courseTitle: 'Educación Financiera',
    adventureNarrativeArc: 'x',
    topic: { concept: 'reviewed concept', learningObjective: 'reviewed objective', keyVocabulary: ['moneda'], priorKnowledge: 'x', factRefs: [] },
    lesson: { microObjective: 'x', narrativeBeat: 'x', difficulty: 5, suggestedFamilies: ['story'] },
    review: {
      kind,
      sources: [
        {
          path: 'adv-1/saga-1/topic-1',
          concept: 'SOURCE_CONCEPT_ONE',
          learningObjective: 'SOURCE_OBJECTIVE_ONE',
          keyVocabulary: ['moneda'],
        },
        {
          path: 'adv-1/saga-1/topic-2',
          concept: 'SOURCE_CONCEPT_TWO',
          learningObjective: 'SOURCE_OBJECTIVE_TWO',
          keyVocabulary: ['ahorro'],
        },
      ],
    },
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

describe('planLesson prompt — review context', () => {
  it('grounds a review_spaced plan prompt in its sources, with the consolidation rule and a capped difficulty', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({
        content: JSON.stringify(validSkeletonJson()),
        promptTokens: 1,
        completionTokens: 1,
      }),
    );
    await planLesson(reviewPlanContext('review_spaced'), { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).toContain('CONSOLIDATION LESSON');
    expect(joined).toContain('SOURCE_CONCEPT_ONE');
    expect(joined).toContain('SOURCE_OBJECTIVE_ONE');
    expect(joined).toContain('SOURCE_CONCEPT_TWO');
    expect(joined).toContain('Target difficulty: 2/5'); // capped from 5 -> 2 (review_spaced cap)
    expect(joined).not.toContain('Interleave at least 2 distinct source topics');
  });

  it('adds the interleave instruction for review_interleaved and review_quest only', async () => {
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({
        content: JSON.stringify(validSkeletonJson()),
        promptTokens: 1,
        completionTokens: 1,
      }),
    );
    await planLesson(reviewPlanContext('review_interleaved'), { complete: complete as never });
    const joinedInterleaved = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joinedInterleaved).toContain('Interleave at least 2 distinct source topics');
    expect(joinedInterleaved).toContain('Target difficulty: 2/5'); // review_interleaved cap = 2

    complete.mockClear();
    await planLesson(reviewPlanContext('review_quest'), { complete: complete as never });
    const joinedQuest = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joinedQuest).toContain('Interleave at least 2 distinct source topics');
    expect(joinedQuest).toContain('Target difficulty: 3/5'); // review_quest cap = 3
  });

  it('leaves a plain teaching prompt untouched (no review block, no consolidation rule)', async () => {
    const teachingCtx: PlanContext = { ...reviewPlanContext('review_spaced'), review: undefined };
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({
        content: JSON.stringify(validSkeletonJson()),
        promptTokens: 1,
        completionTokens: 1,
      }),
    );
    await planLesson(teachingCtx, { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).not.toContain('CONSOLIDATION LESSON');
    expect(joined).not.toContain('SOURCE_CONCEPT_ONE');
    expect(joined).toContain('Target difficulty: 5/5'); // uncapped
  });
});

describe('renderCompetencyBlockForPrompt — retrieval edges never duplicate SOURCE TOPICS', () => {
  function edge(kind: 'retrieval' | 'prerequisite', topicPath: string, concept: string): CompetencyPromptContext['incoming'][number] {
    return {
      kind,
      strength: kind === 'retrieval' ? 'soft' : 'hard',
      reason: 'x',
      source: { topicPath, role: 'teaching', objective: `${concept} objective`, concept, vocabulary: ['moneda'] },
    };
  }

  function competency(incoming: CompetencyPromptContext['incoming']): CompetencyPromptContext {
    return {
      current: { topicPath: 'adv-1/saga-2/review-1', role: 'retrieval', objective: 'x', concept: 'x', vocabulary: [], evidence: 'graded_lesson_completion' },
      incoming,
    };
  }

  const review = reviewPlanContext('review_spaced').review;

  it('omits retrieval edges already covered by the review sources while prerequisite and unmatched edges survive', () => {
    const rendered = renderCompetencyBlockForPrompt(
      competency([
        edge('retrieval', 'adv-1/saga-1/topic-1', 'RETRIEVAL_DUP'), // duplicates source 1
        edge('prerequisite', 'adv-1/saga-1/topic-1', 'PREREQ_KEPT'), // same topic, but a prerequisite — kept
        edge('retrieval', 'adv-1/saga-9/topic-9', 'RETRIEVAL_KEPT'), // not a review source — kept
      ]),
      review,
    );
    expect(rendered).toBeDefined();
    expect(rendered).not.toContain('RETRIEVAL_DUP');
    expect(rendered).toContain('PREREQ_KEPT');
    expect(rendered).toContain('RETRIEVAL_KEPT');
  });

  it('never renders a fully-deduped review block as a "graph root" — it points at SOURCE TOPICS instead', () => {
    const rendered = renderCompetencyBlockForPrompt(
      competency([edge('retrieval', 'adv-1/saga-1/topic-1', 'RETRIEVAL_DUP'), edge('retrieval', 'adv-1/saga-1/topic-2', 'RETRIEVAL_DUP_TWO')]),
      review,
    );
    expect(rendered).not.toContain('RETRIEVAL_DUP');
    expect(rendered).not.toContain('graph root and must establish the concept from first principles');
    expect(rendered).toContain('SOURCE TOPICS');
  });

  it('leaves a non-review lesson completely untouched', () => {
    const ctx = competency([edge('retrieval', 'adv-1/saga-1/topic-1', 'RETRIEVAL_ANY')]);
    expect(renderCompetencyBlockForPrompt(ctx, undefined)).toContain('RETRIEVAL_ANY');
  });

  it('drops the duplicated retrieval edges from the actual plan prompt, keeping the sources block', async () => {
    const ctx: PlanContext = {
      ...reviewPlanContext('review_spaced'),
      competency: competency([
        edge('retrieval', 'adv-1/saga-1/topic-1', 'RETRIEVAL_DUP'),
        edge('prerequisite', 'adv-1/saga-1/topic-2', 'PREREQ_KEPT'),
      ]),
    };
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({
        content: JSON.stringify(validSkeletonJson()),
        promptTokens: 1,
        completionTokens: 1,
      }),
    );
    await planLesson(ctx, { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).not.toContain('RETRIEVAL_DUP');
    expect(joined).toContain('PREREQ_KEPT');
    expect(joined).toContain('SOURCE_CONCEPT_ONE'); // the material still reaches the prompt — exactly once
  });
});

describe('writeLessonDocument prompt — review context', () => {
  it('grounds a review_quest write prompt in its sources, with consolidation + interleave + difficulty cap', async () => {
    const input: WriteInput = {
      ctx: reviewPlanContext('review_quest'),
      skeleton: { segments: [{ type: 'story_scene', brief: 'intro' }] },
      facts: buildFacts(),
      locale: 'es-MX',
      slug: 'test-lesson',
      subject: 'money',
    };
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({
        content: JSON.stringify(buildDocument()),
        promptTokens: 10,
        completionTokens: 10,
      }),
    );
    await writeLessonDocument(input, { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).toContain('CONSOLIDATION LESSON');
    expect(joined).toContain('SOURCE_CONCEPT_ONE');
    expect(joined).toContain('SOURCE_OBJECTIVE_ONE');
    expect(joined).toContain('Interleave at least 2 distinct source topics');
    expect(joined).toContain('No segment.difficulty may exceed 3'); // review_quest cap
  });

  it('leaves a plain teaching write prompt untouched', async () => {
    const input: WriteInput = {
      ctx: { ...reviewPlanContext('review_spaced'), review: undefined },
      skeleton: { segments: [{ type: 'story_scene', brief: 'intro' }] },
      facts: buildFacts(),
      locale: 'es-MX',
      slug: 'test-lesson',
      subject: 'money',
    };
    const complete = vi.fn(
      async (): Promise<ChatCompleteResult> => ({
        content: JSON.stringify(buildDocument()),
        promptTokens: 10,
        completionTokens: 10,
      }),
    );
    await writeLessonDocument(input, { complete: complete as never });
    const joined = joinedMessages(complete.mock.calls[0]![0] as ChatCompleteRequest);
    expect(joined).not.toContain('CONSOLIDATION LESSON');
    expect(joined).not.toContain('SOURCE_CONCEPT_ONE');
  });
});
