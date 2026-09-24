import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { COURSE_ID, COURSE_SLUG, LESSON_1_ID, LESSON_2_ID, makeDb } from './learnFixtures.js';

let db: FakeDb;
let userId: string;
let token: string;

beforeEach(() => {
  userId = '11111111-1111-4111-8111-111111111111';
  token = mintToken({ sub: userId });
  db = makeDb(userId);
  vi.stubGlobal('fetch', createFakeFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

function v2AllocationDocument() {
  return {
    schema_version: 2,
    course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'saving-basics',
    lesson_id: LESSON_1_ID, version_id: 'rev-001', locale: 'en-US', age_band: '6-9',
    eligibility: { minimum_age: 8, maximum_age: 10 }, knowledge_component_ids: ['kc-saving-allocation'],
    adventure_scene_id: 'diorama-a', title: 'Split your coins',
    required_capabilities: ['visual.stacked-bar.v1', 'operation.reallocate.v1'],
    segments: [{ id: 'allocate-01', type: 'money.allocation.v2', grading: 'server', prompt: 'Split 12 coins.',
      visual: { type: 'stacked-bar' }, payload: { total: 12, step: 1, currency: 'coins' } }],
  };
}

const v2AllocationKeys = { 'allocate-01': { minimumSave: 4 } };

function v2WholeNumberLineDocument() {
  return {
    schema_version: 2,
    course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'counting-on',
    lesson_id: LESSON_1_ID, version_id: 'number-line-rev-001', locale: 'en-US', age_band: '6-9',
    eligibility: { minimum_age: 6, maximum_age: 9 }, knowledge_component_ids: ['kc-number-magnitude'],
    adventure_scene_id: 'diorama-a', title: 'Find your place',
    required_capabilities: ['visual.number-line.v1', 'operation.place-point.v1'],
    segments: [{ id: 'place-01', type: 'math.number-line.whole.v2', grading: 'server', prompt: 'Place 7 on the line.',
      visual: { type: 'number-line' }, payload: { minimum: 0, maximum: 10, step: 1, initial: 0 } }],
  };
}

const v2WholeNumberLineKeys = { 'place-01': { target: 7 } };

function v2FractionNumberLineDocument() {
  return {
    schema_version: 2,
    course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'fraction-magnitude',
    lesson_id: LESSON_1_ID, version_id: 'fraction-rev-001', locale: 'en-US', age_band: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-fraction-magnitude'],
    adventure_scene_id: 'diorama-a', title: 'Fractions have a place',
    required_capabilities: ['visual.number-line.v1', 'visual.fraction-area.v1', 'operation.place-point.v1', 'operation.linked-representations.v1'],
    segments: [{ id: 'fraction-01', type: 'math.number-line.fraction.v2', grading: 'server', prompt: 'Place three quarters.',
      visual: { type: 'number-line' }, payload: { maximumWhole: 1, divisions: 4, initialUnits: 0, spokenText: 'three quarters' } }],
  };
}

const v2FractionNumberLineKeys = { 'fraction-01': { targetNumerator: 3, targetDenominator: 4, toleranceUnits: 0 } };

function v2FractionAreaDocument() {
  return {
    schema_version: 2,
    course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'equal-shares',
    lesson_id: LESSON_1_ID, version_id: 'fraction-area-rev-001', locale: 'en-US', age_band: '6-9',
    eligibility: { minimum_age: 7, maximum_age: 9 }, knowledge_component_ids: ['kc-equal-shares'],
    adventure_scene_id: 'diorama-a', title: 'Make equal shares',
    required_capabilities: ['visual.fraction-area.v1', 'operation.partition-equal.v1', 'operation.shade-parts.v1', 'operation.split-equivalent.v1'],
    segments: [{ id: 'fraction-area-01', type: 'math.fraction-area.v2', grading: 'server', prompt: 'Show one half.',
      visual: { type: 'fraction-area' }, payload: { minimumParts: 2, maximumParts: 6, initialParts: 2, initialShaded: 0, spokenText: 'one half' } }],
  };
}

const v2FractionAreaKeys = { 'fraction-area-01': { targetNumerator: 1, targetDenominator: 2 } };

function v2BarModelDocument() {
  const payload = { whole: 50, difference: 12, knownLabel: 'Ana', unknownLabel: 'Leo', spokenText: 'fifty minus twelve' };
  return {
    schema_version: 2,
    course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'compare-savings',
    lesson_id: LESSON_1_ID, version_id: 'bar-rev-001', locale: 'en-US', age_band: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-compare-quantities'],
    adventure_scene_id: 'diorama-a', title: 'Compare two savings',
    required_capabilities: ['visual.bar-model.v1', 'operation.build-slots.v1', 'operation.structure-check.v1', 'operation.number-input.v1'],
    segments: [
      { id: 'bar-structure-01', type: 'math.bar-model.structure.v2', grading: 'server', prompt: 'Choose the model.', visual: { type: 'bar-model' }, payload },
      { id: 'bar-answer-01', type: 'math.bar-model.answer.v2', grading: 'server', prompt: 'Solve the model.', visual: { type: 'bar-model' }, payload },
    ],
  };
}

const v2BarModelKeys = { 'bar-structure-01': { model: 'comparison' }, 'bar-answer-01': { target: 19 } };

function v2SchemaDiagramDocument() {
  const payload = { income: 24, spending: 9, incomeLabel: 'Earned', spendingLabel: 'Spent', remainingLabel: 'Left over', spokenText: 'twenty-four minus nine equals fifteen' };
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'money-change',
    lesson_id: LESSON_1_ID, version_id: 'schema-rev-001', locale: 'en-US', age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 },
    knowledge_component_ids: ['kc-money-change-schema'], adventure_scene_id: 'diorama-a', title: 'Name the money change',
    required_capabilities: ['visual.schema-diagram.v1', 'operation.build-slots.v1', 'operation.structure-check.v1', 'operation.number-input.v1'],
    segments: [
      { id: 'schema-structure-01', type: 'math.schema-diagram.structure.v2', grading: 'server', prompt: 'Choose the schema.', visual: { type: 'schema-diagram' }, payload },
      { id: 'schema-slots-01', type: 'math.schema-diagram.slots.v2', grading: 'server', prompt: 'Fill the slots.', visual: { type: 'schema-diagram' }, payload },
      { id: 'schema-answer-01', type: 'math.schema-diagram.answer.v2', grading: 'server', prompt: 'Solve it.', visual: { type: 'schema-diagram' }, payload },
    ],
  };
}

const v2SchemaDiagramKeys = { 'schema-structure-01': { schema: 'change' }, 'schema-slots-01': { income: 24, spending: 9 }, 'schema-answer-01': { target: 15 } };

function v2WorkedExampleDocument() {
  const steps = [
    { id: 'discount-part', expression: '20% × 50', result: '10', spokenText: 'twenty percent of fifty is ten' },
    { id: 'discount-subtract', expression: '50 − 10', result: '40', spokenText: 'fifty minus ten is forty' },
    { id: 'sale-price', expression: 'Sale price', result: '40', spokenText: 'the sale price is forty' },
  ];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'discounts',
    lesson_id: LESSON_1_ID, version_id: 'worked-example-rev-001', locale: 'en-US', age_band: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-percent-discount'],
    adventure_scene_id: 'diorama-a', title: 'Find a sale price',
    required_capabilities: ['visual.worked-example.v1', 'operation.step-replay.v1', 'operation.predict-next.v1', 'operation.backward-fade.v1', 'operation.number-input.v1'],
    segments: [{ id: 'worked-example-01', type: 'math.worked-example.v2', grading: 'server', prompt: 'Follow the discount.',
      visual: { type: 'worked-example' }, payload: { steps, fade_count: 1, response_step_ids: ['discount-subtract', 'sale-price'] } }],
  };
}

const v2WorkedExampleKeys = { 'worked-example-01': { expectedValues: { 'discount-subtract': '40', 'sale-price': '40' } } };

function v2FunctionMachineDocument() {
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'savings-rules',
    lesson_id: LESSON_1_ID, version_id: 'function-machine-rev-001', locale: 'en-US', age_band: '10-12',
    eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-savings-function'],
    adventure_scene_id: 'diorama-a', title: 'Find the savings rule',
    required_capabilities: ['visual.function-machine.v1', 'operation.try-input.v1', 'operation.guess-rule.v1', 'operation.held-out-check.v1'],
    segments: [{ id: 'function-machine-01', type: 'math.function-machine.v2', grading: 'server', prompt: 'Try each week.',
      visual: { type: 'function-machine' }, payload: { examples: [{ input: 1, output: 15 }, { input: 2, output: 20 }, { input: 3, output: 25 }],
        multiplierMaximum: 9, offsetMaximum: 50 } }],
  };
}

const v2FunctionMachineKeys = { 'function-machine-01': { multiplier: 5, offset: 10, heldOutInputs: [4, 6] } };

function v2CpaFadingDocument() {
  const stages = [
    { id: 'cpa-concrete-01', stage: 'concrete', worked: 3 },
    { id: 'cpa-pictorial-01', stage: 'pictorial', worked: 2 },
    { id: 'cpa-abstract-01', stage: 'abstract', worked: 0 },
  ] as const;
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'saving-basics',
    lesson_id: LESSON_1_ID, version_id: 'cpa-rev-001', locale: 'en-US', age_band: '6-9',
    eligibility: { minimum_age: 6, maximum_age: 9 }, knowledge_component_ids: ['kc-saving-count'],
    adventure_scene_id: 'diorama-a', title: 'Count a savings goal',
    required_capabilities: ['visual.cpa-count.v1', 'operation.count-objects.v1', 'operation.symbolic-answer.v1'],
    representation_progressions: [{ fading_group_id: 'cpa-savings-01', problem_id: 'saving-count-01',
      stages: stages.map((item) => ({ segment_id: item.id, stage: item.stage, worked_steps_shown: item.worked })) }],
    segments: stages.map((item) => ({ id: item.id, type: 'math.cpa-count.v2', grading: 'server', prompt: 'Put the two coin groups together.',
      visual: { type: 'cpa-count' }, payload: { left: 4, right: 3, spokenText: 'four plus three' } })),
  };
}

const v2CpaFadingKeys = { 'cpa-concrete-01': { target: 7 }, 'cpa-pictorial-01': { target: 7 }, 'cpa-abstract-01': { target: 7 } };

function activateImmutableV2Allocation(): string {
  const versionId = '99999999-9999-4999-8999-999999999999';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'rev-001', schema_version: 2,
    document: v2AllocationDocument(), answer_keys: v2AllocationKeys, audio: {}, created_at: '2026-09-22T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2018-09-22';
  return versionId;
}

function activateImmutableV2WholeNumberLine(): string {
  const versionId = '99999999-9999-4999-8999-999999999991';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'number-line-rev-001', schema_version: 2,
    document: v2WholeNumberLineDocument(), answer_keys: v2WholeNumberLineKeys, audio: {}, created_at: '2026-09-22T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2018-09-22';
  return versionId;
}

function activateImmutableV2FractionNumberLine(): string {
  const versionId = '99999999-9999-4999-8999-999999999993';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'fraction-rev-001', schema_version: 2,
    document: v2FractionNumberLineDocument(), answer_keys: v2FractionNumberLineKeys, audio: {}, created_at: '2026-09-22T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2014-09-22';
  return versionId;
}

function activateImmutableV2FractionArea(): string {
  const versionId = '99999999-9999-4999-8999-999999999992';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'fraction-area-rev-001', schema_version: 2,
    document: v2FractionAreaDocument(), answer_keys: v2FractionAreaKeys, audio: {}, created_at: '2026-09-22T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2018-09-22';
  return versionId;
}

function activateImmutableV2BarModel(): string {
  const versionId = '99999999-9999-4999-8999-999999999998';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'bar-rev-001', schema_version: 2,
    document: v2BarModelDocument(), answer_keys: v2BarModelKeys, audio: {}, created_at: '2026-09-22T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2014-09-22';
  return versionId;
}

function activateImmutableV2SchemaDiagram(): string {
  const versionId = '99999999-9999-4999-8999-999999999997';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'schema-rev-001', schema_version: 2,
    document: v2SchemaDiagramDocument(), answer_keys: v2SchemaDiagramKeys, audio: {}, created_at: '2026-09-22T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2014-09-22';
  return versionId;
}

function activateImmutableV2WorkedExample(): string {
  const versionId = '99999999-9999-4999-8999-999999999996';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'worked-example-rev-001', schema_version: 2,
    document: v2WorkedExampleDocument(), answer_keys: v2WorkedExampleKeys, audio: {}, created_at: '2026-09-22T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2014-09-22';
  return versionId;
}

function activateImmutableV2FunctionMachine(): string {
  const versionId = '99999999-9999-4999-8999-999999999995';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'function-machine-rev-001', schema_version: 2,
    document: v2FunctionMachineDocument(), answer_keys: v2FunctionMachineKeys, audio: {}, created_at: '2026-09-22T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2014-09-22';
  return versionId;
}

function activateImmutableV2CpaFading(): string {
  const versionId = '99999999-9999-4999-8999-999999999994';
  db.lesson_document_version_current = [{ lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId }];
  db.lesson_document_versions = [{
    id: versionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'cpa-rev-001', schema_version: 2,
    document: v2CpaFadingDocument(), answer_keys: v2CpaFadingKeys, audio: {}, created_at: '2026-09-22T12:00:00.000Z',
  }];
  db.profiles[0]!.birth_date = '2018-09-22';
  return versionId;
}

describe('GET /api/v1/learn/courses', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/learn/courses');
    expect(res.status).toBe(401);
  });

  it('lists published courses with rollup progress for the caller', async () => {
    const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
    expect(res.status).toBe(200);
    expect(res.body.data.courses).toEqual([
      {
        id: '33333333-3333-4333-8333-333333333333',
        slug: COURSE_SLUG,
        title: { 'en-US': 'Financial Education' },
        lessonCount: 2,
        subject: 'money',
        badgeAsset: 'course-badges/financial-education.png',
        inProgress: false,
        adventureCount: 1,
        progress: { passed: 0, total: 2, pct: 0 },
      },
    ]);
  });

  /*
   * This handler re-lists CourseSummary's fields by hand instead of spreading
   * it, so adding a field to the summary does NOT serve it. `inProgress` was
   * computed correctly and dropped right here, and the "still being built"
   * badge never rendered in production — the frontend's own tests passed
   * because their fixtures already carried the field.
   */
  it('serves inProgress, which the card badge depends on', async () => {
    db.courses[0]!.in_progress = true;
    const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
    expect(res.status).toBe(200);
    expect(res.body.data.courses[0].inProgress).toBe(true);
  });

  it('records every isolated assembly failure and names the unavailable featured course', async () => {
    const SECOND_COURSE_ID = '44444444-4444-4444-8444-444444444444';
    db.courses!.push({
      ...db.courses![0]!,
      id: SECOND_COURSE_ID,
      slug: 'healthy-course',
      title: { 'en-US': 'Healthy Course' },
      position: 2,
    });
    // A malformed review edge makes only the original course's pure assembly
    // fail. The independent empty course remains usable on the shelf.
    db.topics![0]!.kind = 'review';
    db.topics![0]!.review_of = {};

    const res = await auth(request(createApp()).get('/api/v1/learn/courses'));

    expect(res.status).toBe(200);
    expect(res.body.data.courses).toHaveLength(1);
    expect(res.body.data.courses[0].slug).toBe('healthy-course');
    expect(res.body.data.unavailableFeaturedCourse).toEqual({
      slug: COURSE_SLUG,
      title: { 'en-US': 'Financial Education' },
    });
    expect(db.course_assembly_incidents).toEqual([
      expect.objectContaining({ course_id: COURSE_ID, occurrence_count: 1 }),
    ]);

    await auth(request(createApp()).get('/api/v1/learn/courses'));
    expect(db.course_assembly_incidents![0]).toEqual(
      expect.objectContaining({ course_id: COURSE_ID, occurrence_count: 2 }),
    );
  });

  it('502s when PostgREST is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
    expect(res.status).toBe(502);
  });

  /*
   * THE SHAPE OF THE READ, which is where /learn's 2.0-2.4 s lived.
   *
   * The handler used to await the whole adventures -> sagas -> topics ->
   * lessons -> progress chain once PER COURSE. Nothing asserted that, and the
   * fixture had a single course, so the per-course cost was invisible to the
   * suite by construction. A second course makes it measurable.
   */
  describe('reads the whole shelf one level at a time', () => {
    const SECOND_COURSE_ID = '44444444-4444-4444-8444-444444444444';

    function countingFetch(counts: Record<string, number>): typeof fetch {
      const real = createFakeFetch(db);
      return (async (input: RequestInfo | URL, init?: RequestInit) => {
        const table = String(input).split('/rest/v1/')[1]?.split('?')[0];
        if (table) counts[table] = (counts[table] ?? 0) + 1;
        return real(input, init);
      }) as typeof fetch;
    }

    beforeEach(() => {
      db.courses!.push({
        ...db.courses![0]!,
        id: SECOND_COURSE_ID,
        slug: 'second-course',
        title: { 'en-US': 'Second Course' },
      });
    });

    it('asks each level ONCE, however many courses are published', async () => {
      const counts: Record<string, number> = {};
      vi.stubGlobal('fetch', countingFetch(counts));

      const res = await auth(request(createApp()).get('/api/v1/learn/courses'));

      expect(res.status).toBe(200);
      expect(res.body.data.courses).toHaveLength(2);
      // One request per level for the whole shelf — not one chain per course.
      for (const table of ['adventures', 'sagas', 'topics', 'lessons', 'course_placements', 'placement_credits']) {
        expect(counts[table], `${table} was read ${counts[table]} time(s)`).toBe(1);
      }
    });

    it('still 502s when a level read fails — that is the content service, not one bad row', async () => {
      const real = createFakeFetch(db);
      vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('/rest/v1/adventures')) return new Response('boom', { status: 500 });
        return real(input, init);
      }) as typeof fetch);

      const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
      expect(res.status).toBe(502);
    });
  });
});

describe('GET /api/v1/learn/courses/:slug/tree', () => {
  it('404s for an unknown course slug', async () => {
    const res = await auth(request(createApp()).get('/api/v1/learn/courses/does-not-exist/tree'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns the full tree with per-lesson unlock state and nextLessonId', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect(res.status).toBe(200);
    const lessons = res.body.data.adventures[0].sagas[0].topics[0].lessons;
    expect(lessons.map((l: { id: string; state: string }) => [l.id, l.state])).toEqual([
      [LESSON_1_ID, 'current'],
      [LESSON_2_ID, 'locked'],
    ]);
    expect(res.body.data.nextLessonId).toBe(LESSON_1_ID);
    expect(res.body.data.adventures[0].state).toBe('available');
  });
});

describe('GET /api/v1/learn/lessons/:id', () => {
  it('404s for an unknown lesson', async () => {
    const res = await auth(request(createApp()).get('/api/v1/learn/lessons/00000000-0000-4000-8000-000000000000'));
    expect(res.status).toBe(404);
  });

  it('403s LESSON_LOCKED for a locked lesson', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_2_ID}`));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('LESSON_LOCKED');
  });

  it('serves the client-safe document with answers stripped from every segment', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    for (const segment of res.body.data.document.segments) {
      expect(segment).not.toHaveProperty('answer');
    }
    expect(res.body.data.lesson).toMatchObject({ id: LESSON_1_ID, slug: 'lesson-1', xp_total: 20 });
  });

  it('prefers an explicitly activated immutable v2 version over the legacy row', async () => {
    activateImmutableV2Allocation();

    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.data.document).toMatchObject({ schema_version: 2, version_id: 'rev-001' });
    expect(res.body.data.document).not.toHaveProperty('answer_keys');
    expect(res.body.data.document.segments[0]).not.toHaveProperty('answer');
  });

  it('falls back to es-MX (authoring locale) when the caller locale has no document row', async () => {
    db.profiles[0]!.locale = 'pt-BR'; // no pt-BR lesson_documents row in the fixture
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.data.locale).toBe('es-MX');
  });

  it('enforces a v2 lesson’s exact server-side age range without returning the birth date', async () => {
    db.lesson_documents[0]!.schema_version = 2;
    db.lesson_documents[0]!.document = v2AllocationDocument();
    db.lesson_documents[0]!.answer_keys = v2AllocationKeys;
    db.profiles[0]!.birth_date = '2019-09-23';
    const blocked = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('LESSON_AGE_RESTRICTED');
    expect(JSON.stringify(blocked.body)).not.toContain('2019-09-23');

    db.profiles[0]!.birth_date = '2018-09-22';
    const allowed = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(allowed.status).toBe(200);
    expect(JSON.stringify(allowed.body)).not.toContain('2018-09-22');
  });

  it('removes misplaced v2 grading material before delivery', async () => {
    db.lesson_documents[0]!.schema_version = 2;
    db.lesson_documents[0]!.document = {
      ...v2AllocationDocument(),
      answer_keys: { secretRoot: 'do-not-deliver' },
      rubric: { secretRoot: 'do-not-deliver' },
      hidden_tests: [{ secretRoot: 'do-not-deliver' }],
      segments: [{ ...v2AllocationDocument().segments[0], answer: 'do-not-deliver',
        answer_key: 'do-not-deliver', hidden_tests: ['do-not-deliver'], rubric: { secret: 'do-not-deliver' } }],
    };
    db.lesson_documents[0]!.answer_keys = v2AllocationKeys;
    db.profiles[0]!.birth_date = '2018-09-22';

    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.data.document)).not.toContain('do-not-deliver');
    expect(res.body.data.document).not.toHaveProperty('answer_keys');
    expect(res.body.data.document).not.toHaveProperty('rubric');
    expect(res.body.data.document.segments[0]).not.toHaveProperty('answer');
  });

  it('refuses a v2 document that does not match the public/private contract', async () => {
    db.lesson_documents[0]!.schema_version = 2;
    db.lesson_documents[0]!.document = { ...v2AllocationDocument(), unexpected: true };
    db.lesson_documents[0]!.answer_keys = v2AllocationKeys;
    db.profiles[0]!.birth_date = '2018-09-22';

    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_LESSON');
  });

  it('fails closed when a v2 lesson lacks an exact age policy or the learner has no protected date', async () => {
    db.lesson_documents[0]!.schema_version = 2;
    const missingPolicy = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(missingPolicy.status).toBe(409);
    expect(missingPolicy.body.error.code).toBe('LESSON_ELIGIBILITY_MISSING');

    const document = db.lesson_documents[0]!.document as Record<string, unknown>;
    db.lesson_documents[0]!.document = { ...document, schema_version: 2, eligibility: { minimum_age: 7, maximum_age: 10 } };
    const unknownAge = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(unknownAge.status).toBe(403);
    expect(unknownAge.body.error.code).toBe('LESSON_AGE_ELIGIBILITY_REQUIRED');
  });
});

describe('POST /api/v1/learn/lessons/:id/v2-runs', () => {
  it('pins an immutable version, then persists nonces before returning only segment-bound attempt tokens', async () => {
    const versionId = activateImmutableV2Allocation();
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ version_id: 'rev-001' });
    expect(res.body.data).not.toHaveProperty('document_version_id');
    const runId = res.body.data.run_id as string;
    const attemptToken = res.body.data.attempt_tokens['allocate-01'] as string;
    expect(runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(attemptToken).toContain('.');
    expect(db.lesson_v2_runs).toEqual([expect.objectContaining({
      id: runId, user_id: userId, lesson_id: LESSON_1_ID, locale: 'en-US', document_version_id: versionId,
    })]);
    expect(db.lesson_v2_attempt_nonces).toEqual([expect.objectContaining({
      user_id: userId, run_id: runId, document_version_id: versionId, segment_id: 'allocate-01',
    })]);
    expect(JSON.stringify(res.body)).not.toContain('minimumSave');
  });

  it('recovers the same live immutable run after reload without storing or minting a second nonce', async () => {
    activateImmutableV2Allocation();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const runId = started.body.data.run_id as string;
    const token = started.body.data.attempt_tokens['allocate-01'] as string;

    const resumed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({ run_id: runId });
    expect(resumed.status).toBe(200);
    expect(resumed.body.data).toMatchObject({ run_id: runId, version_id: 'rev-001', resumed: true, met_segment_ids: [], attempted_segment_ids: [] });
    expect(resumed.body.data.attempt_tokens).toEqual({ 'allocate-01': token });
    expect(db.lesson_v2_runs).toHaveLength(1);
    expect(db.lesson_v2_attempt_nonces).toHaveLength(1);
  });

  it('recovers an M1 review as an attempted representation without treating it as a met receipt', async () => {
    activateImmutableV2CpaFading();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const review = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'cpa-concrete-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['cpa-concrete-01'], answer: { value: '6' },
    });
    expect(review.body.data.verdict).toEqual({ correct: false, score: 0 });

    const resumed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({ run_id: started.body.data.run_id });
    expect(resumed.status).toBe(200);
    expect(resumed.body.data).toMatchObject({ resumed: true, met_segment_ids: [], attempted_segment_ids: ['cpa-concrete-01'] });
    expect(JSON.stringify(resumed.body.data)).not.toContain('value');
  });

  it('refuses a legacy row or a mutable v2 row as an attempt source', async () => {
    const legacy = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(legacy.status).toBe(409);
    expect(legacy.body.error.code).toBe('UNSUPPORTED_LESSON');

    db.lesson_documents[0]!.schema_version = 2;
    db.lesson_documents[0]!.document = v2AllocationDocument();
    db.lesson_documents[0]!.answer_keys = v2AllocationKeys;
    db.profiles[0]!.birth_date = '2018-09-22';
    const mutable = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(mutable.status).toBe(409);
    expect(mutable.body.error.code).toBe('UNSUPPORTED_LESSON');
    expect(db.lesson_v2_runs ?? []).toHaveLength(0);
  });
});

describe('POST /api/v1/learn/lessons/:id/grade', () => {
  it('400s on a malformed body', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('403s LESSON_LOCKED for a locked lesson', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_2_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    expect(res.status).toBe(403);
  });

  it('enforces v2 age eligibility before direct grade or completion mutations', async () => {
    const document = db.lesson_documents[0]!.document as Record<string, unknown>;
    db.lesson_documents[0]!.schema_version = 2;
    db.lesson_documents[0]!.document = { ...document, schema_version: 2, eligibility: { minimum_age: 8, maximum_age: 10 } };
    db.profiles[0]!.birth_date = '2019-09-23';

    const grade = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 1,
    });
    const complete = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 60 });

    expect(grade.status).toBe(403);
    expect(grade.body.error.code).toBe('LESSON_AGE_RESTRICTED');
    expect(complete.status).toBe(403);
    expect(complete.body.error.code).toBe('LESSON_AGE_RESTRICTED');
    expect(JSON.stringify({ grade: grade.body, complete: complete.body })).not.toContain('2019-09-23');
    expect(db.lesson_segment_attempts).toHaveLength(0);
    expect(db.lesson_progress).toHaveLength(0);
  });

  it('uses the signed, stored v2 nonce exactly once and returns the immutable receipt on a network retry', async () => {
    activateImmutableV2Allocation();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    const body = {
      segment_id: 'allocate-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['allocate-01'], answer: { save: 4, spend: 8, share: 0 },
    };
    const first = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send(body);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });
    expect(db.lesson_v2_attempt_nonces![0]!.consumed_at).toEqual(expect.any(String));
    expect(db.lesson_v2_grade_receipts).toHaveLength(1);
    expect(db.lesson_segment_attempts).toHaveLength(0);

    const retry = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send(body);
    expect(retry.status).toBe(200);
    expect(retry.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: true });
    expect(db.lesson_v2_grade_receipts).toHaveLength(1);
  });

  it('gives a review a fresh nonce so a corrected answer can continue without a penalty', async () => {
    activateImmutableV2Allocation();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const runId = started.body.data.run_id as string;
    const first = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'allocate-01', run_id: runId, attempt_token: started.body.data.attempt_tokens['allocate-01'], answer: { save: 3, spend: 8, share: 1 },
    });
    expect(first.body.data).toMatchObject({ verdict: { correct: false, score: 0 }, replayed: false, retry_attempt_token: expect.any(String) });
    const corrected = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'allocate-01', run_id: runId, attempt_token: first.body.data.retry_attempt_token, answer: { save: 4, spend: 8, share: 0 },
    });
    expect(corrected.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });
    expect(db.lesson_v2_grade_receipts).toHaveLength(2);
    expect(db.lesson_v2_attempt_nonces).toHaveLength(2);
  });

  it('grades the M9/M10 worked-example semantic values through the signed retry boundary', async () => {
    activateImmutableV2WorkedExample();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data.attempt_tokens).toEqual({ 'worked-example-01': expect.any(String) });

    const reviewed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'worked-example-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['worked-example-01'],
      answer: { values: { 'discount-subtract': '39', 'sale-price': '40' } },
    });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data).toMatchObject({ verdict: { correct: false, score: 0 }, replayed: false, retry_attempt_token: expect.any(String) });

    const corrected = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'worked-example-01', run_id: started.body.data.run_id,
      attempt_token: reviewed.body.data.retry_attempt_token,
      answer: { values: { 'discount-subtract': '40', 'sale-price': '40' } },
    });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });
    expect(db.lesson_v2_grade_receipts).toHaveLength(2);
  });

  it('grades an M13 function rule through the signed retry boundary without exposing held-out inputs', async () => {
    activateImmutableV2FunctionMachine();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data.attempt_tokens).toEqual({ 'function-machine-01': expect.any(String) });

    const reviewed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'function-machine-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['function-machine-01'], answer: { multiplier: '4', offset: '10' },
    });
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data).toMatchObject({ verdict: { correct: false, score: 0 }, replayed: false, retry_attempt_token: expect.any(String) });

    const corrected = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'function-machine-01', run_id: started.body.data.run_id,
      attempt_token: reviewed.body.data.retry_attempt_token, answer: { multiplier: '5', offset: '10' },
    });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });
    expect(db.lesson_v2_grade_receipts).toHaveLength(2);
  });

  it('requires an attempted M1 representation before a later stage and records immutable first success metadata', async () => {
    const versionId = activateImmutableV2CpaFading();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});

    const skipped = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'cpa-pictorial-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['cpa-pictorial-01'], answer: { value: '7' },
    });
    expect(skipped.status).toBe(409);
    expect(skipped.body.error.code).toBe('LESSON_PREREQUISITE_REQUIRED');
    expect(db.lesson_v2_attempt_nonces!.find((nonce) => nonce.segment_id === 'cpa-pictorial-01')!.consumed_at).toBeUndefined();

    const concreteReview = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'cpa-concrete-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['cpa-concrete-01'], answer: { value: '6' },
    });
    expect(concreteReview.status).toBe(200);
    expect(concreteReview.body.data).toMatchObject({ verdict: { correct: false, score: 0 }, retry_attempt_token: expect.any(String) });

    const graded = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'cpa-pictorial-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['cpa-pictorial-01'], answer: { value: '7' },
    });
    expect(graded.status).toBe(200);
    expect(db.lesson_v2_first_unaided_stages).toEqual([expect.objectContaining({ user_id: userId,
      document_version_id: versionId, fading_group_id: 'cpa-savings-01', stage: 'pictorial' })]);
  });

  it('requires a met M7 structure receipt before its independent arithmetic segment', async () => {
    activateImmutableV2BarModel();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);

    const answerFirst = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'bar-answer-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['bar-answer-01'], answer: { value: '19' },
    });
    expect(answerFirst.status).toBe(409);
    expect(answerFirst.body.error.code).toBe('LESSON_PREREQUISITE_REQUIRED');
    expect(db.lesson_v2_grade_receipts ?? []).toHaveLength(0);
    expect(db.lesson_v2_attempt_nonces!.find((nonce) => nonce.segment_id === 'bar-answer-01')!.consumed_at).toBeUndefined();

    const structure = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'bar-structure-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['bar-structure-01'], answer: { model: 'comparison' },
    });
    expect(structure.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });

    const answer = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'bar-answer-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['bar-answer-01'], answer: { value: '19' },
    });
    expect(answer.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });
  });

  it('requires M8 schema and slots receipts before the independent arithmetic segment', async () => {
    activateImmutableV2SchemaDiagram();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    const grade = (segment_id: string, answer: unknown) => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id, answer, run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens[segment_id],
    });

    const slotsFirst = await grade('schema-slots-01', { income: '24', spending: '9' });
    expect(slotsFirst.status).toBe(409);
    expect(slotsFirst.body.error.code).toBe('LESSON_PREREQUISITE_REQUIRED');
    await grade('schema-structure-01', { schema: 'change' });
    const slots = await grade('schema-slots-01', { income: '24', spending: '9' });
    expect(slots.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });
    const answer = await grade('schema-answer-01', { value: '15' });
    expect(answer.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });
  });

  it('grades an already-started v2 run against its immutable version after a newer revision is activated', async () => {
    const firstVersionId = activateImmutableV2Allocation();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);

    const nextVersionId = '88888888-8888-4888-8888-888888888888';
    db.lesson_document_versions!.push({
      id: nextVersionId, lesson_id: LESSON_1_ID, locale: 'en-US', version_id: 'rev-002', schema_version: 2,
      document: { ...v2AllocationDocument(), version_id: 'rev-002' }, answer_keys: v2AllocationKeys, audio: {},
      created_at: '2026-09-22T12:01:00.000Z',
    });
    db.lesson_document_version_current![0]!.document_version_id = nextVersionId;

    const graded = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'allocate-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['allocate-01'], answer: { save: 4, spend: 8, share: 0 },
    });

    expect(graded.status).toBe(200);
    expect(graded.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });
    expect(db.lesson_v2_grade_receipts![0]).toMatchObject({ document_version_id: firstVersionId });
  });

  it('does not let a v2 request fall through to the legacy grade writer', async () => {
    activateImmutableV2Allocation();
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'allocate-01', answer: { save: 4, spend: 8, share: 0 }, attempt_number: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(db.lesson_segment_attempts).toHaveLength(0);
    expect(db.lesson_v2_grade_receipts ?? []).toHaveLength(0);
  });

  it('grades a correct quiz_mcq as a perfect score with reveal (score 100 always reveals)', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict).toMatchObject({ correct: true, score: 100, tier: 'perfect', allowRetry: false });
    expect(res.body.data.verdict.reveal).toEqual({ correct_option_id: 'a' });
  });

  it('grades a wrong quiz_mcq with per-distractor rationale feedback, no reveal on a non-final attempt', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'b' },
      attempt_number: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict).toMatchObject({ correct: false, score: 0, tier: 'tryAgain', allowRetry: true });
    expect(res.body.data.verdict.feedback_md).toBe('because that is wrong');
    expect(res.body.data.verdict.reveal).toBeUndefined();
  });

  it('reveal gating: reveals + disallows retry on the final permitted attempt (max_attempts = 2)', async () => {
    const app = createApp();
    const first = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'b' },
      attempt_number: 1,
    });
    expect(first.body.data.verdict.reveal).toBeUndefined();
    expect(first.body.data.verdict.allowRetry).toBe(true);

    const second = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'b' },
      attempt_number: 2,
    });
    expect(second.status).toBe(200);
    expect(second.body.data.verdict.reveal).toEqual({ correct_option_id: 'a' });
    expect(second.body.data.verdict.allowRetry).toBe(false);
  });

  it('409s ATTEMPTS_EXHAUSTED once max_attempts is reached, and does not record a third attempt', async () => {
    const app = createApp();
    for (let i = 0; i < 2; i++) {
      await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
        segment_id: 'quiz-1',
        answer: { option_id: 'b' },
        attempt_number: i + 1,
      });
    }
    const third = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 3,
    });
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('ATTEMPTS_EXHAUSTED');
    expect(db.lesson_segment_attempts).toHaveLength(2);
  });

  it('applies the hint penalty server-side to the recorded score (hint_penalty_pct 10)', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' }, // correct → raw 100
      attempt_number: 1,
      hints_used: 1, // 100 × 0.9 = 90
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict.score).toBe(90);
    expect(res.body.data.verdict.tier).toBe('great'); // penalized below 100 → not "perfect"
    const row = db.lesson_segment_attempts.find((r) => r.segment_id === 'quiz-1');
    expect(row?.score).toBe(90);
    expect(row?.hints_used).toBe(1);
  });

  it('records grade timing and closed pedagogical context for intelligence processing', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'b' },
      attempt_number: 1,
      time_spent_seconds: 42,
    });
    expect(res.status).toBe(200);
    const row = db.lesson_segment_attempts.find((attempt) => attempt.segment_id === 'quiz-1');
    expect(row).toMatchObject({
      time_spent_seconds: 42,
      course_id: COURSE_ID,
      skill_key: 'financial-education/topic-1',
      diagnostic_code: 'initial_incorrect',
    });
    expect(row?.document_updated_at).toBeDefined();
  });

  it('run-scopes the attempt cap: a fresh run_id starts every segment over', async () => {
    const app = createApp();
    const RUN_A = '11111111-1111-4111-8111-111111111111';
    const RUN_B = '22222222-2222-4222-8222-222222222222';
    for (let i = 0; i < 2; i++) {
      await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
        segment_id: 'quiz-1', answer: { option_id: 'b' }, attempt_number: i + 1, run_id: RUN_A,
      });
    }
    const exhausted = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 3, run_id: RUN_A,
    });
    expect(exhausted.status).toBe(409); // run A is spent
    const freshRun = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 1, run_id: RUN_B,
    });
    expect(freshRun.status).toBe(200); // a new play-through starts fresh
    expect(freshRun.body.data.verdict.score).toBe(100);
  });

  it('fails closed when the atomic grading service is unavailable', async () => {
    const fake = createFakeFetch(db);
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/rpc/record_lesson_grade')) {
        return Promise.resolve(new Response('{}', { status: 503 }));
      }
      return fake(input, init);
    });
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 1,
    });
    expect(res.status).toBe(502);
    expect(db.lesson_segment_attempts).toHaveLength(0);
  });

  it('does not exceed the attempt cap when three requests observe the same count', async () => {
    const fake = createFakeFetch(db);
    let readers = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const response = await fake(input, init);
      if (url.pathname.endsWith('/lesson_segment_attempts') && url.searchParams.get('select') === 'segment_id') {
        readers += 1;
        if (readers === 3) release();
        await barrier;
      }
      return response;
    });
    const app = createApp();
    const replies = await Promise.all([1, 2, 3].map(attempt_number => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'b' }, attempt_number,
      run_id: '33333333-3333-4333-8333-333333333333',
    })));
    expect(replies.map(reply => reply.status).sort()).toEqual([200, 200, 409]);
    expect(db.lesson_segment_attempts).toHaveLength(2);
  });

  it('returns the original verdict after a lost grade response without consuming another attempt', async () => {
    const fake = createFakeFetch(db);
    let loseResponse = true;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fake(input, init);
      if (String(input).endsWith('/rpc/record_lesson_grade') && loseResponse) {
        loseResponse = false;
        throw new Error('Injected lost response after commit');
      }
      return response;
    });
    const app = createApp();
    const body = { segment_id: 'quiz-1', answer: { option_id: 'b' }, attempt_number: 1, run_id: '33333333-3333-4333-8333-333333333333' };
    expect((await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send(body)).status).toBe(502);
    const retry = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({ ...body, answer: { option_id: 'a' } });
    expect(retry.status).toBe(200);
    expect(retry.body.data.verdict).toMatchObject({ score: 0, allowRetry: true });
    expect(retry.body.data.verdict.reveal).toBeUndefined();
    expect(db.lesson_segment_attempts).toHaveLength(1);
  });

  it('422s UNSUPPORTED_SEGMENT for an ungraded (story) segment', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'story-1',
      answer: {},
      attempt_number: 1,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_SEGMENT');
  });

  it('grades a keyless memory_flip segment (no answer key) instead of 422', async () => {
    for (const row of db.lesson_documents) {
      if (row.lesson_id !== LESSON_1_ID) continue;
      const document = row.document as { segments: Record<string, unknown>[] };
      document.segments.push({ id: 'memory-1', type: 'memory_flip', prompt_md: 'Find the pairs', difficulty: 1, xp: 10,
        payload: { pairs: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] } });
    }
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'memory-1',
      answer: { flips: 6, pairs: 3 },
      attempt_number: 1,
    });
    expect(res.status).toBe(200);
    // Completing the board is the win — memory_flip floors at 40.
    expect(res.body.data.verdict.score).toBeGreaterThanOrEqual(40);
  });

  it('404s for a segment id that does not exist in the document', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'nope',
      answer: {},
      attempt_number: 1,
    });
    expect(res.status).toBe(404);
  });

  it('scores a malformed answer as 0 rather than throwing', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { not_an_option_id: true },
      attempt_number: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.verdict.score).toBe(0);
  });
});

describe('POST /api/v1/learn/lessons/:id/complete', () => {
  it('requires a version-pinned v2 run before accepting completion', async () => {
    activateImmutableV2Allocation();
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 60 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(db.lesson_progress).toHaveLength(0);
    expect(db.learning_stats[0]!.xp_points).toBe(0);
  });

  it('completes a v2 run only after its immutable receipt is met', async () => {
    activateImmutableV2Allocation();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const pending = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22', score: 100, xp: 9999,
    });
    expect(pending.status).toBe(409);
    expect(db.lesson_v2_runs![0]!.completed_at).toBeUndefined();

    const graded = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'allocate-01', run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens['allocate-01'], answer: { save: 4, spend: 8, share: 0 },
    });
    expect(graded.status).toBe(200);
    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22', score: 0, xp: 0,
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
    expect(db.lesson_v2_runs![0]!.completed_at).toEqual(expect.any(String));
    const replay = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(replay.body.data).toMatchObject({ replayed: true, xp_delta: 20 });
  });

  it('delivers, grades, and completes M3 through its immutable fraction number-line version', async () => {
    activateImmutableV2FractionNumberLine();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({ version_id: 'fraction-rev-001', attempt_tokens: { 'fraction-01': expect.any(String) } });
    expect(JSON.stringify(started.body)).not.toContain('targetNumerator');

    const reviewed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'fraction-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['fraction-01'], answer: { value: '1/4' },
    });
    expect(reviewed.body.data).toMatchObject({ verdict: { correct: false, score: 0 }, retry_attempt_token: expect.any(String) });

    const met = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'fraction-01', run_id: started.body.data.run_id,
      attempt_token: reviewed.body.data.retry_attempt_token, answer: { value: '6/8' },
    });
    expect(met.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('delivers, grades, and completes M6 through its immutable equal-area fraction version', async () => {
    activateImmutableV2FractionArea();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({ version_id: 'fraction-area-rev-001', attempt_tokens: { 'fraction-area-01': expect.any(String) } });
    expect(JSON.stringify(started.body)).not.toContain('targetNumerator');

    const reviewed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'fraction-area-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['fraction-area-01'], answer: { n: 1, d: 3 },
    });
    expect(reviewed.body.data).toMatchObject({ verdict: { correct: false, score: 0 }, retry_attempt_token: expect.any(String) });

    const met = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'fraction-area-01', run_id: started.body.data.run_id,
      attempt_token: reviewed.body.data.retry_attempt_token, answer: { n: 2, d: 4 },
    });
    expect(met.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('delivers, grades, and completes M9/M10 through its immutable worked-example version', async () => {
    activateImmutableV2WorkedExample();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({ version_id: 'worked-example-rev-001', attempt_tokens: { 'worked-example-01': expect.any(String) } });
    expect(JSON.stringify(started.body)).not.toContain('expectedValues');

    const graded = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'worked-example-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['worked-example-01'], answer: { values: { 'discount-subtract': '40', 'sale-price': '40' } },
    });
    expect(graded.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('delivers, grades, and completes M13 through its immutable function-machine version', async () => {
    activateImmutableV2FunctionMachine();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({ version_id: 'function-machine-rev-001', attempt_tokens: { 'function-machine-01': expect.any(String) } });
    expect(JSON.stringify(started.body)).not.toContain('heldOutInputs');

    const graded = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'function-machine-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['function-machine-01'], answer: { multiplier: '5', offset: '10' },
    });
    expect(graded.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('delivers, grades, and completes M7 after its ordered immutable receipts', async () => {
    activateImmutableV2BarModel();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data.attempt_tokens).toEqual({ 'bar-structure-01': expect.any(String), 'bar-answer-01': expect.any(String) });
    expect(JSON.stringify(started.body)).not.toContain('target');
    const structure = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'bar-structure-01', run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens['bar-structure-01'], answer: { model: 'comparison' },
    });
    expect(structure.body.data.verdict).toEqual({ correct: true, score: 100 });
    const answer = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'bar-answer-01', run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens['bar-answer-01'], answer: { value: '19' },
    });
    expect(answer.body.data.verdict).toEqual({ correct: true, score: 100 });
    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('delivers, grades, and completes M8 after its ordered immutable receipts', async () => {
    activateImmutableV2SchemaDiagram();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data.attempt_tokens).toEqual({ 'schema-structure-01': expect.any(String), 'schema-slots-01': expect.any(String), 'schema-answer-01': expect.any(String) });
    expect(JSON.stringify(started.body)).not.toContain('target');
    const grade = (segmentId: string, answer: Record<string, string>) => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: segmentId, run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens[segmentId], answer,
    });
    expect((await grade('schema-structure-01', { schema: 'change' })).body.data.verdict).toEqual({ correct: true, score: 100 });
    expect((await grade('schema-slots-01', { income: '24', spending: '9' })).body.data.verdict).toEqual({ correct: true, score: 100 });
    expect((await grade('schema-answer-01', { value: '15' })).body.data.verdict).toEqual({ correct: true, score: 100 });
    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('delivers, grades, and completes M2 through its immutable whole-number line version', async () => {
    activateImmutableV2WholeNumberLine();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data).toMatchObject({ version_id: 'number-line-rev-001', attempt_tokens: { 'place-01': expect.any(String) } });
    expect(JSON.stringify(started.body)).not.toContain('target');

    const reviewed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'place-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['place-01'], answer: { value: '6' },
    });
    expect(reviewed.body.data).toMatchObject({ verdict: { correct: false, score: 0 }, retry_attempt_token: expect.any(String) });

    const met = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'place-01', run_id: started.body.data.run_id,
      attempt_token: reviewed.body.data.retry_attempt_token, answer: { value: '7' },
    });
    expect(met.body.data).toEqual({ verdict: { correct: true, score: 100 }, replayed: false });

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('completes M1 from the final symbolic receipt after earlier representations were attempted', async () => {
    activateImmutableV2CpaFading();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const runId = started.body.data.run_id as string;

    const concreteReview = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'cpa-concrete-01', run_id: runId,
      attempt_token: started.body.data.attempt_tokens['cpa-concrete-01'], answer: { value: '6' },
    });
    expect(concreteReview.body.data.verdict).toEqual({ correct: false, score: 0 });
    const pictorial = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'cpa-pictorial-01', run_id: runId,
      attempt_token: started.body.data.attempt_tokens['cpa-pictorial-01'], answer: { value: '7' },
    });
    expect(pictorial.body.data.verdict).toEqual({ correct: true, score: 100 });

    const beforeAbstract = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: runId, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(beforeAbstract.status).toBe(409);

    const abstract = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'cpa-abstract-01', run_id: runId,
      attempt_token: started.body.data.attempt_tokens['cpa-abstract-01'], answer: { value: '7' },
    });
    expect(abstract.body.data.verdict).toEqual({ correct: true, score: 100 });
    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: runId, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('preserves earned XP and completion totals when retrying after a failed stats write', async () => {
    const app = createApp();
    const runId = '22222222-2222-4222-8222-222222222222';
    const completion = { seconds_spent: 300, run_id: runId };
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 1, run_id: runId,
    });
    const realFetch = createFakeFetch(db);
    let failStats = true;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (failStats && String(input).includes('/rpc/complete_lesson') && init?.method === 'POST') {
        return new Response('{"message":"temporary failure"}', { status: 503 });
      }
      return realFetch(input, init);
    }));
    const first = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send(completion);
    expect(first.status).toBe(502);
    expect(db.lesson_progress).toHaveLength(0);
    failStats = false;
    const retried = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send(completion);
    expect(retried.status).toBe(200);
    expect(db.learning_stats.find((row) => row.user_id === userId)).toMatchObject({
      xp_points: 20, lessons_completed: 1,
    });
  });

  it('retries a lost response without duplicating minutes, attempts, or rewards', async () => {
    const app = createApp();
    const runId = '22222222-2222-4222-8222-222222222222';
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 1, run_id: runId,
    });
    const realFetch = createFakeFetch(db);
    let loseResponse = true;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const result = await realFetch(input, init);
      if (String(input).includes('/rpc/complete_lesson') && loseResponse) {
        loseResponse = false;
        throw new Error('Connection lost after commit');
      }
      return result;
    });
    const complete = () => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`))
      .send({ seconds_spent: 300, run_id: runId });
    expect((await complete()).status).toBe(502);
    expect((await complete()).body.data).toMatchObject({ xp_delta: 20, minutes_learned: 5, lessons_completed: 1 });
    expect(db.lesson_progress[0]).toMatchObject({ attempts: 1, xp_earned: 20 });
    expect(db.learning_stats[0]).toMatchObject({ xp_points: 20, minutes_learned: 5, lessons_completed: 1 });
  });

  it('400s on an out-of-range minutes_spent', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 999 });
    expect(res.status).toBe(400);
  });

  it('recomputes the score server-side from recorded attempts (never trusts a client-reported score) and awards XP/streak', async () => {
    const app = createApp();
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });

    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      score: 100,
      passed: true,
      xp_earned: 20,
      xp_delta: 20,
      next_lesson_id: LESSON_2_ID,
    });
    expect(res.body.data.progress).toEqual({ passed: 1, total: 2, pct: 50 });

    const stats = db.learning_stats.find((s) => s.user_id === userId);
    expect(stats).toMatchObject({ xp_points: 20, lessons_completed: 1, minutes_learned: 5, streak_days: 1 });

    const progressRow = db.lesson_progress.find((p) => p.lesson_id === LESSON_1_ID);
    expect(progressRow).toMatchObject({ best_score: 100, passed: true, xp_earned: 20 });
  });

  it('ignores a client-supplied score entirely — score is 0 with zero recorded attempts', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ score: 0, passed: false, xp_earned: 0, xp_delta: 0 });
  });

  it('is idempotent on xp_delta / lessons_completed once already passed', async () => {
    const app = createApp();
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 5 });

    const second = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 3 });
    expect(second.status).toBe(200);
    expect(second.body.data).toMatchObject({ xp_delta: 0, passed: true });

    const stats = db.learning_stats.find((s) => s.user_id === userId);
    // minutes still accrue even when nothing was "newly passed"; xp/lessons_completed do not.
    expect(stats).toMatchObject({ xp_points: 20, lessons_completed: 1, minutes_learned: 8 });
  });

  it('403s LESSON_LOCKED for a locked lesson', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_2_ID}/complete`)).send({ minutes_spent: 1 });
    expect(res.status).toBe(403);
  });

  /*
   * Regression: completion is a read-modify-write over learning_stats. When the
   * READ failed transiently, supabaseRest collapsed the failure into a zeroed
   * row and the following PATCH wrote deltas-from-zero straight back — silently
   * erasing a learner's XP, minutes, lessons and BOTH streak columns behind a
   * 200 response. minutes_learned and the streaks exist nowhere else, so the
   * loss was permanent. The read must now be distinguishable from "no progress".
   */
  it('never overwrites accumulated stats when the completion transaction fails transiently', async () => {
    const app = createApp();
    // A learner with real history.
    const existing = {
      user_id: userId, xp_points: 5000, minutes_learned: 300, lessons_completed: 40,
      streak_days: 12, longest_streak: 30, last_active_date: '2020-01-01', updated_at: '2020-01-01T00:00:00.000Z',
    };
    db.learning_stats = [{ ...existing }];

    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });

    // A failed atomic operation must leave the existing totals untouched.
    const realFetch = createFakeFetch(db);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/rpc/complete_lesson') && method === 'POST') {
        return new Response('{"message":"no more connections allowed"}', { status: 503 });
      }
      return realFetch(input, init);
    }));

    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ minutes_spent: 5 });

    // Refuse rather than compute from assumed zeros.
    expect(res.status).toBe(502);
    // And crucially: the row is untouched.
    expect(db.learning_stats[0]).toMatchObject(existing);
  });

  it('a story-only lesson (no graded segments) scores 100 and PASSES on completion', async () => {
    const app = createApp();
    // Pass lesson-1 first to unlock the story-only lesson-2.
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 60 });

    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_2_ID}/complete`)).send({ seconds_spent: 25 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ score: 100, passed: true });

    const progressRow = db.lesson_progress.find((p) => p.lesson_id === LESSON_2_ID);
    expect(progressRow).toMatchObject({ best_score: 100, passed: true });
    const stats = db.learning_stats.find((s) => s.user_id === userId);
    expect(stats?.lessons_completed).toBe(2);
  });

  it('refuses completion when an unknown exercise would otherwise pass as story-only', async () => {
    const app = createApp();
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 1,
    });
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 60 });
    const row = db.lesson_documents.find((item) => item.lesson_id === LESSON_2_ID)!;
    (row.document as { segments: Array<Record<string, unknown>> }).segments.push({
      id: 'future-1', type: 'future_chart', prompt_md: 'Unsupported visual', xp: 10, payload: {},
    });

    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_2_ID}/complete`)).send({ seconds_spent: 25 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('UNSUPPORTED_LESSON');
    expect(db.lesson_progress.some((item) => item.lesson_id === LESSON_2_ID)).toBe(false);
  });

  it('accepts seconds_spent and floors the accrued time at 1 minute per completion', async () => {
    const app = createApp();
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 20 });
    expect(res.status).toBe(200);
    const stats = db.learning_stats.find((s) => s.user_id === userId);
    expect(stats?.minutes_learned).toBe(1); // 20s rounds to 0 — the floor keeps a finished lesson from counting as no learning time
  });

  it('returns day-streak facts (streak_days / streak_extended / first_today) for the celebration screen', async () => {
    const app = createApp();
    await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1',
      answer: { option_id: 'a' },
      attempt_number: 1,
    });
    const res = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 90 });
    expect(res.status).toBe(200);
    // Fixture stats were last touched in 2020 → this pass starts a fresh streak today.
    expect(res.body.data).toMatchObject({ streak_days: 1, streak_extended: true, first_today: true });
  });

  it('400s when neither seconds_spent nor minutes_spent is provided', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/learn/lessons/:id (audio manifest)', () => {
  it('includes Echo\'s narration manifest alongside the client-safe document', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.data.audio).toMatchObject({
      version: 1,
      units: { 'story-1.prompt': { url: 'http://filebase.test/files/abc' } },
    });
  });
});
