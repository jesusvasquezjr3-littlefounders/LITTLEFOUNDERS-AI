// Concept metadata tests (COURSE_ENGINE.md §3.2 + §3.1 breadth generalization):
//  - catalog schema: `parent_check` placeholder rule, `prerequisites` shape
//  - loader: prerequisites path resolution + the earlier-only rule
//    (a topic may not cite itself or later/same-position material),
//    parent_check kind warning
//  - loader: position-agnostic teaching-saga quota (6+2 or 8+2 topics) and
//    the total-lesson-count warning, COMPUTED from actual saga/topic kinds
//    — never a hardcoded per-tier 152/184 table (COURSE_ENGINE §3.1b; see
//    catalog-multicourse.test.ts for the tier3-generalization coverage)

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { loadCourseCatalog } from '../catalog/loader.js';
import { topicBlueprintSchema, prerequisiteSchema } from '../catalog/schema.js';

// ---------------------------------------------------------------------------
// Schema-level: parent_check + prerequisites shape
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

describe('topicBlueprintSchema — parent_check (§3.2)', () => {
  it('is optional and absent by default', () => {
    const parsed = topicBlueprintSchema.safeParse(baseTopicFields());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.parent_check).toBeUndefined();
  });

  it('accepts a string containing the {{name}} placeholder', () => {
    const parsed = topicBlueprintSchema.safeParse(
      baseTopicFields({ parent_check: 'Si {{name}} recibiera dinero, ¿podría explicar por qué ahorrar?' }),
    );
    expect(parsed.success).toBe(true);
  });

  it('rejects a string missing the {{name}} placeholder', () => {
    const parsed = topicBlueprintSchema.safeParse(baseTopicFields({ parent_check: 'Sin placeholder aquí.' }));
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.join('.') === 'parent_check')).toBe(true);
    }
  });
});

describe('prerequisiteSchema (§3.2)', () => {
  function prereq(overrides: Record<string, unknown> = {}) {
    return { path: 'adv-1/saga-1/topic-1', strength: 'hard', reason: 'Needs counting fluency first.', ...overrides };
  }

  it('accepts a valid hard prerequisite with a topic-level path', () => {
    expect(prerequisiteSchema.safeParse(prereq()).success).toBe(true);
  });

  it('accepts a valid soft prerequisite with a saga-level path', () => {
    expect(prerequisiteSchema.safeParse(prereq({ path: 'adv-1/saga-1', strength: 'soft' })).success).toBe(true);
  });

  it('rejects a strength outside hard|soft', () => {
    expect(prerequisiteSchema.safeParse(prereq({ strength: 'medium' })).success).toBe(false);
  });

  it('rejects a reason shorter than 10 chars', () => {
    expect(prerequisiteSchema.safeParse(prereq({ reason: 'short' })).success).toBe(false);
  });

  it('rejects a reason longer than 240 chars', () => {
    expect(prerequisiteSchema.safeParse(prereq({ reason: 'x'.repeat(241) })).success).toBe(false);
  });

  it('rejects a malformed (single-segment) path', () => {
    expect(prerequisiteSchema.safeParse(prereq({ path: 'only-one-segment' })).success).toBe(false);
  });
});

describe('topicBlueprintSchema — prerequisites array shape', () => {
  it('is optional and absent by default', () => {
    const parsed = topicBlueprintSchema.safeParse(baseTopicFields());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.prerequisites).toBeUndefined();
  });

  it('rejects an empty prerequisites array', () => {
    const parsed = topicBlueprintSchema.safeParse(baseTopicFields({ prerequisites: [] }));
    expect(parsed.success).toBe(false);
  });

  it('accepts a non-empty prerequisites array', () => {
    const parsed = topicBlueprintSchema.safeParse(
      baseTopicFields({
        prerequisites: [{ path: 'adv-1/saga-1/topic-1', strength: 'hard', reason: 'Needs prior arithmetic.' }],
      }),
    );
    expect(parsed.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Loader-level fixtures (mirrors review-layer.test.ts conventions)
// ---------------------------------------------------------------------------

function taxonomyFixture() {
  return {
    schema_version: 1,
    themes: ['archipelago'],
    age_tiers: {
      tier1: { ages: '6-7', forbidden_vocabulary: { 'es-MX': [], 'en-US': [], 'pt-BR': [] } },
      tier2: { ages: '8-10', forbidden_vocabulary: { 'es-MX': [], 'en-US': [], 'pt-BR': [] } },
    },
    families: ['story', 'choice', 'money'],
    family_allowlist_by_tier: { tier1: ['story', 'choice', 'money'], tier2: ['story', 'choice', 'money'] },
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

function adventureData(advSlug: string, advPosition: number, sagas: unknown[], ageTier: 'tier1' | 'tier2' = 'tier1') {
  return {
    schema_version: 1,
    adventure: {
      position: advPosition,
      slug: advSlug,
      theme: 'archipelago',
      age_tier: ageTier,
      title: { 'en-US': 'A', 'es-MX': 'A', 'pt-BR': 'A' },
      description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
      narrative_arc: 'x',
    },
    sagas,
  };
}

let courseDir: string;

beforeEach(() => {
  courseDir = mkdtempSync(path.join(tmpdir(), 'forge-concept-metadata-'));
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

// ---------------------------------------------------------------------------
// Loader: prerequisites resolution + earlier-only rule
// ---------------------------------------------------------------------------

describe('loadCourseCatalog — prerequisites resolution + earlier-only rule', () => {
  it('accepts a prerequisite that resolves to strictly earlier material (earlier topic, same saga)', () => {
    const adv = adventureData('adv-1', 1, [
      saga(1, 'saga-1', [
        baseTopicFields({ position: 1, slug: 'topic-1' }),
        baseTopicFields({
          position: 2,
          slug: 'topic-2',
          prerequisites: [{ path: 'adv-1/saga-1/topic-1', strength: 'hard', reason: 'Builds directly on topic-1.' }],
        }),
      ]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.issues.filter((i) => i.level === 'error')).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it('accepts a prerequisite that resolves to an earlier SAGA (saga-level path)', () => {
    const adv = adventureData('adv-1', 1, [
      saga(1, 'saga-1', [baseTopicFields({ position: 1, slug: 'topic-1' })]),
      saga(2, 'saga-2', [
        baseTopicFields({
          position: 1,
          slug: 'topic-1',
          prerequisites: [{ path: 'adv-1/saga-1', strength: 'soft', reason: 'General grounding from saga-1.' }],
        }),
      ]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(true);
  });

  it('errors on an unresolved prerequisites path', () => {
    const adv = adventureData('adv-1', 1, [
      saga(1, 'saga-1', [
        baseTopicFields({
          position: 1,
          slug: 'topic-1',
          prerequisites: [{ path: 'adv-1/saga-1/does-not-exist', strength: 'hard', reason: 'Bogus reference here.' }],
        }),
      ]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.level === 'error' && i.message.includes('unresolved path'))).toBe(true);
  });

  it('errors when a topic lists itself as a prerequisite', () => {
    const adv = adventureData('adv-1', 1, [
      saga(1, 'saga-1', [
        baseTopicFields({
          position: 1,
          slug: 'topic-1',
          prerequisites: [{ path: 'adv-1/saga-1/topic-1', strength: 'hard', reason: 'Self reference by mistake.' }],
        }),
      ]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.level === 'error' && i.message.includes('lists itself as a prerequisite'))).toBe(true);
  });

  it('errors when a prerequisite references LATER material in the same saga', () => {
    const adv = adventureData('adv-1', 1, [
      saga(1, 'saga-1', [
        baseTopicFields({
          position: 1,
          slug: 'topic-1',
          prerequisites: [{ path: 'adv-1/saga-1/topic-2', strength: 'hard', reason: 'Points forward — invalid.' }],
        }),
        baseTopicFields({ position: 2, slug: 'topic-2' }),
      ]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.level === 'error' && i.message.includes('not earlier material'))).toBe(true);
  });

  it('errors when a saga-level prerequisite references the topic\'s OWN current saga', () => {
    const adv = adventureData('adv-1', 1, [
      saga(1, 'saga-1', [
        baseTopicFields({
          position: 1,
          slug: 'topic-1',
          prerequisites: [{ path: 'adv-1/saga-1', strength: 'soft', reason: 'Cites its own saga — invalid.' }],
        }),
      ]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.level === 'error' && i.message.includes('not earlier material'))).toBe(true);
  });

  it('errors when a prerequisite references a LATER adventure', () => {
    const adv1 = adventureData('adv-1', 1, [
      saga(1, 'saga-1', [
        baseTopicFields({
          position: 1,
          slug: 'topic-1',
          prerequisites: [{ path: 'adv-2/saga-1/topic-1', strength: 'hard', reason: 'Points to a later adventure.' }],
        }),
      ]),
    ]);
    const adv2 = adventureData('adv-2', 2, [saga(1, 'saga-1', [baseTopicFields({ position: 1, slug: 'topic-1' })])]);
    writeCourse({ 'adventures/01-a.yaml': adv1, 'adventures/02-b.yaml': adv2 });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.level === 'error' && i.message.includes('not earlier material'))).toBe(true);
  });
});

describe('loadCourseCatalog — parent_check kind warning', () => {
  it('warns when a non-teaching topic carries parent_check', () => {
    const adv = adventureData('adv-1', 1, [
      saga(1, 'saga-1', [
        baseTopicFields({ position: 1, slug: 'topic-1' }),
        baseTopicFields({
          position: 2,
          slug: 'topic-2',
          kind: 'review_spaced',
          review_of: ['adv-1/saga-1/topic-1'],
          parent_check: '¿{{name}} recuerda esto?',
        }),
      ]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(
      result.issues.some((i) => i.level === 'warning' && i.message.includes('parent_check') && i.message.includes('teaching topics only')),
    ).toBe(true);
  });

  it('does not warn when a teaching topic carries parent_check', () => {
    const adv = adventureData('adv-1', 1, [
      saga(1, 'saga-1', [baseTopicFields({ position: 1, slug: 'topic-1', parent_check: '¿{{name}} lo recuerda?' })]),
    ]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.issues.some((i) => i.message.includes('parent_check'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Loader: position-agnostic teaching-saga quota (6+2 or 8+2) + tier totals
// ---------------------------------------------------------------------------

function teachingTopic(position: number) {
  return baseTopicFields({ position, slug: `t-${position}` });
}

function reviewTopic(position: number, kind: 'review_spaced' | 'review_interleaved', refSlug: string, sagaSlug: string) {
  return baseTopicFields({ position, slug: `t-${position}`, kind, review_of: [`adv-1/${sagaSlug}/${refSlug}`] });
}

/** A teaching saga with EITHER 6 or 8 teaching topics + 2 review topics ALWAYS last (§3.1). */
function buildTeachingSaga(sagaPosition: number, sagaSlug: string, teachingCount: 6 | 8) {
  const topics: unknown[] = [];
  for (let i = 1; i <= teachingCount; i++) topics.push(teachingTopic(i));
  topics.push(reviewTopic(teachingCount + 1, 'review_spaced', 't-1', sagaSlug));
  topics.push(reviewTopic(teachingCount + 2, 'review_interleaved', 't-1', sagaSlug));
  return saga(sagaPosition, sagaSlug, topics, 'teaching');
}

function buildReviewSaga(sagaPosition: number, sagaSlug: string) {
  const topics = [1, 2, 3, 4, 5, 6].map((n) =>
    baseTopicFields({ position: n, slug: `q-${n}`, kind: 'review_quest', review_of: ['adv-1/saga-1'] }),
  );
  return saga(sagaPosition, sagaSlug, topics, 'review');
}

/** Full 5-saga adventure shaped exactly to the tier1 (152) or tier2 (184) total (§3.1). */
function buildFullAdventure(ageTier: 'tier1' | 'tier2', teachingCount: 6 | 8) {
  const sagas = [1, 2, 3, 4].map((n) => buildTeachingSaga(n, `saga-${n}`, teachingCount));
  sagas.push(buildReviewSaga(5, 'review-saga'));
  return adventureData('adv-1', 1, sagas, ageTier);
}

describe('loadCourseCatalog — position-agnostic teaching-saga quota (§3.1)', () => {
  it('accepts the 6-teaching+2-review shape (tier1, 152 total) with no topic-count or position warnings', () => {
    writeCourse({ 'adventures/01-a.yaml': buildFullAdventure('tier1', 6) });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.message.includes('teaching-kind topics'))).toBe(false);
    expect(result.issues.some((i) => i.message.includes('total lesson blueprints'))).toBe(false);
  });

  it('accepts the 8-teaching+2-review shape (tier2, 184 total) with no topic-count or position warnings', () => {
    writeCourse({ 'adventures/01-a.yaml': buildFullAdventure('tier2', 8) });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.message.includes('teaching-kind topics'))).toBe(false);
    expect(result.issues.some((i) => i.message.includes('total lesson blueprints'))).toBe(false);
  });

  it('warns when a teaching saga has neither 6 nor 8 teaching topics (e.g. 7)', () => {
    const topics = [1, 2, 3, 4, 5, 6, 7].map((n) => teachingTopic(n));
    topics.push(reviewTopic(8, 'review_spaced', 't-1', 'saga-1'));
    topics.push(reviewTopic(9, 'review_interleaved', 't-1', 'saga-1'));
    const adv = adventureData('adv-1', 1, [saga(1, 'saga-1', topics, 'teaching')]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(
      result.issues.some(
        (i) => i.level === 'warning' && i.message.includes('teaching-kind topics') && i.message.includes('expected 6 or 8'),
      ),
    ).toBe(true);
  });

  it('warns when the review topics are not the last two positions (position-agnostic check)', () => {
    // 6 teaching + 2 review = 8 total, but review_spaced/interleaved are NOT at 7-8.
    const topics = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => teachingTopic(n));
    (topics[6] as { kind: string; review_of: string[] }).kind = 'review_spaced';
    (topics[6] as { kind: string; review_of: string[] }).review_of = ['adv-1/saga-1/t-1'];
    // position 8 (last) stays teaching-kind — should trigger the "expected review_interleaved" warning.
    const adv = adventureData('adv-1', 1, [saga(1, 'saga-1', topics, 'teaching')]);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(
      result.issues.some(
        (i) => i.level === 'warning' && i.message.includes('position 8') && i.message.includes('review_interleaved'),
      ),
    ).toBe(true);
  });
});

describe('loadCourseCatalog — total lesson count warning, computed from actual kinds (§3.1b)', () => {
  it('warns when a tier1-shaped adventure\'s aggregate diverges from the computed topics×4 expectation (152)', () => {
    // A canonical tier1 shape computes to 38 topics × 4 = 152 — but this is
    // no longer a hardcoded per-tier lookup; give one review-saga topic an
    // EXTRA lesson so the aggregate (153) diverges from the computed value,
    // even though every other topic still reports its own correct count.
    const adv = buildFullAdventure('tier1', 6);
    const reviewSagaTopics = (adv.sagas[4] as { topics: Array<{ lessons: unknown[] }> }).topics;
    reviewSagaTopics[0]!.lessons = [...reviewSagaTopics[0]!.lessons, baseLesson(5)];
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(
      result.issues.some(
        (i) => i.level === 'warning' && i.message.includes('total lesson blueprints') && i.message.includes('expected 152'),
      ),
    ).toBe(true);
  });

  it('warns when a tier2-shaped adventure\'s aggregate diverges from the computed topics×4 expectation (184)', () => {
    // A canonical tier2 shape computes to 46 topics × 4 = 184 — drop one
    // lesson from a review-saga topic so the aggregate (183) diverges.
    const adv = buildFullAdventure('tier2', 8);
    const reviewSagaTopics = (adv.sagas[4] as { topics: Array<{ lessons: unknown[] }> }).topics;
    reviewSagaTopics[0]!.lessons = reviewSagaTopics[0]!.lessons.slice(0, 3);
    writeCourse({ 'adventures/01-a.yaml': adv });
    const result = loadCourseCatalog(courseDir);
    expect(
      result.issues.some(
        (i) => i.level === 'warning' && i.message.includes('total lesson blueprints') && i.message.includes('expected 184'),
      ),
    ).toBe(true);
  });

  it('does not warn about total lesson count for a correctly-shaped tier1 adventure (152)', () => {
    writeCourse({ 'adventures/01-a.yaml': buildFullAdventure('tier1', 6) });
    const result = loadCourseCatalog(courseDir);
    expect(result.issues.some((i) => i.message.includes('total lesson blueprints'))).toBe(false);
  });
});
