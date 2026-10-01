import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { admissionStubResponse, mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { COURSE_ID, COURSE_SLUG, LESSON_1_ID, LESSON_2_ID, TOPIC_ID, makeDb } from './learnFixtures.js';

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
  const payload = { quantities: [{ id: 'together', value: 50, label: 'Together' }, { id: 'ana-more', value: 12, label: '12 more' }], unknownLabel: 'Leo', spokenText: 'fifty minus twelve' };
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

// M7 (GAP-FIX-R3): "Ana has 12 more than Leo; together 50" — a comparison with its total bracket; Ana's bar carries no number.
const barBuild = { model: 'comparison', slots: { smaller: 'unknown', larger: null, difference: 'ana-more', total: 'together' } };
const v2BarModelKeys = { 'bar-structure-01': barBuild, 'bar-answer-01': { target: 19 } };

function v2SchemaDiagramDocument() {
  const payload = { quantities: [{ id: 'earned', value: 24, label: 'Earned' }, { id: 'spent', value: 9, label: 'Spent' }], unknownLabel: 'Left over', spokenText: 'twenty-four minus nine equals fifteen' };
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

const v2SchemaDiagramKeys = { 'schema-structure-01': { schema: 'change' }, 'schema-slots-01': { schema: 'change', slots: { start: 'earned', change: 'spent', result: 'unknown' } }, 'schema-answer-01': { target: 15 } };

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
    // The pause check (A.1) answers first; every read after it is down.
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const admission = admissionStubResponse(String(input));
      return admission ? Promise.resolve(admission) : Promise.reject(new Error('down'));
    }));
    const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
    expect(res.status).toBe(502);
  });

  it('503s, never a pass, when the pause check itself cannot be read (A.1)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    const res = await auth(request(createApp()).get('/api/v1/learn/courses'));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('ACCOUNT_STATE_UNAVAILABLE');
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

  it('B.2: refuses entry while a declared prerequisite course is not completed, naming the missing slug', async () => {
    const course = db.courses?.[0];
    (course as { requires?: string[] }).requires = ['financial-education'];
    const res = await auth(request(createApp()).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COURSE_PREREQUISITE_REQUIRED');
    expect(res.body.error.missingPrerequisites).toEqual(['financial-education']);
    // And the course does NOT open until the prerequisite is completed.
    db.completed_course_badges = [{ user_id: userId, course_slug: 'financial-education' }];
    const allowed = await auth(request(createApp()).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect(allowed.status).toBe(200);
    delete (course as { requires?: string[] }).requires;
  });

  it('B.2: treats a non-array or empty requires declaration as no prerequisites', async () => {
    const course = db.courses?.[0];
    (course as { requires?: unknown }).requires = 'not-an-array';
    const res = await auth(request(createApp()).get(`/api/v1/learn/courses/${COURSE_SLUG}/tree`));
    expect(res.status).toBe(200);
    delete (course as { requires?: unknown }).requires;
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

  it('refuses retired schema 1 without exposing the document or answer keys', async () => {
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_LESSON');
    expect(res.body.data).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('quiz-1');
  });

  it('prefers an explicitly activated immutable v2 version over the legacy row', async () => {
    activateImmutableV2Allocation();

    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.data.document).toMatchObject({ schema_version: 2, version_id: 'rev-001' });
    expect(res.body.data.document).not.toHaveProperty('answer_keys');
    expect(res.body.data.document.segments[0]).not.toHaveProperty('answer');
  });

  it('falls back to the available authoring locale when the caller locale has no document row', async () => {
    activateImmutableV2Allocation();
    db.profiles[0]!.locale = 'pt-BR'; // no pt-BR lesson document in the fixture
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.data.locale).toBe('en-US');
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

  function activateMutableV2AllocationWithStage(stage: unknown): void {
    db.lesson_documents[0]!.schema_version = 2;
    db.lesson_documents[0]!.document = { ...v2AllocationDocument(), ...(stage === undefined ? {} : { mentor_stage: stage }) };
    db.lesson_documents[0]!.answer_keys = v2AllocationKeys;
    db.profiles[0]!.birth_date = '2018-09-22';
  }

  it('projects the learner\'s own stored character with the document scene and strips the authored stage from the document', async () => {
    activateMutableV2AllocationWithStage({ character: 'dina', scene: 'diorama-a' });
    db.tutor_preferences = [{ user_id: userId, character: 'zara', companion: 'liruf', diorama: 'diorama-a', backdrop: 'auto', nickname: null, adaptations: [], updated_at: '2026-09-24T00:00:00.000Z' }];

    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));

    expect(res.status).toBe(200);
    expect(res.body.data.mentor_stage).toEqual({ character: 'zara', scene: 'diorama-a' });
    expect(res.body.data.document).not.toHaveProperty('mentor_stage');
    expect(res.body.data.document.segments[0]).not.toHaveProperty('answer');
  });

  it('defaults to the catalog first character when the learner has never chosen one', async () => {
    activateMutableV2AllocationWithStage({ character: 'liruf', scene: 'diorama-b' });

    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));

    expect(res.status).toBe(200);
    expect(res.body.data.mentor_stage).toEqual({ character: 'rho', scene: 'diorama-b' });
  });

  it('B.8 (GAP-FIX-R3): projects the Mentor on the lesson adventure scene when the document declares no stage', async () => {
    activateMutableV2AllocationWithStage(undefined);
    db.tutor_preferences = [{ user_id: userId, character: 'zara', companion: 'liruf', diorama: 'diorama-a', backdrop: 'auto', nickname: null, adaptations: [], updated_at: '2026-09-24T00:00:00.000Z' }];

    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));

    expect(res.status).toBe(200);
    expect(res.body.data.mentor_stage).toEqual({ character: 'zara', scene: (db.lesson_documents[0]!.document as { adventure_scene_id: string }).adventure_scene_id });
    // An adventure scene outside the approved catalog still stages the Mentor, on the catalog's first scene.
    db.lesson_documents[0]!.document = { ...(db.lesson_documents[0]!.document as Record<string, unknown>), adventure_scene_id: 'harbor-night' };
    const off = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(off.status).toBe(200);
    expect(off.body.data.mentor_stage).toEqual({ character: 'zara', scene: 'diorama-a' });
  });

  it('omits the projection rather than a wrong character when the preference read fails', async () => {
    activateMutableV2AllocationWithStage({ character: 'dina', scene: 'diorama-a' });
    const real = createFakeFetch(db);
    vi.stubGlobal('fetch', (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/rest/v1/tutor_preferences')) throw new Error('preferences down');
      return real(input, init);
    }) as typeof fetch);

    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('mentor_stage');
    expect(res.body.data.document.schema_version).toBe(2);
  });

  it('refuses a mentor stage with an unknown character, an unknown scene or an extra field', async () => {
    for (const stage of [
      { character: 'mickey', scene: 'diorama-a' },
      { character: 'dina', scene: 'diorama-z' },
      { character: 'dina', scene: 'diorama-a', backdrop: 'night' },
    ]) {
      db = makeDb(userId);
      vi.stubGlobal('fetch', createFakeFetch(db));
      activateMutableV2AllocationWithStage(stage);

      const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNSUPPORTED_LESSON');
    }
  });

  it('refuses a client-supplied character field on the attempt boundary', async () => {
    activateMutableV2AllocationWithStage({ character: 'dina', scene: 'diorama-a' });

    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({ character: 'zara' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
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
    expect(review.body.data.verdict).toMatchObject({ correct: false, score: 0 });

    const resumed = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({ run_id: started.body.data.run_id });
    expect(resumed.status).toBe(200);
    expect(resumed.body.data).toMatchObject({ resumed: true, met_segment_ids: [], attempted_segment_ids: ['cpa-concrete-01'] });
    expect(JSON.stringify(resumed.body.data)).not.toContain('value');
  });

  it('refuses a legacy row or a mutable v2 row as an attempt source', async () => {
    const legacy = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(legacy.status).toBe(422);
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
      run_id: '22222222-2222-4222-8222-222222222222', attempt_token: 'invalid-but-well-shaped',
    });
    expect(res.status).toBe(403);
  });

  it('enforces v2 age eligibility before direct grade or completion mutations', async () => {
    activateImmutableV2Allocation();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    db.profiles[0]!.birth_date = '2019-09-23';
    const grade = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'allocate-01', answer: { amounts: [10, 10, 10] }, run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['allocate-01'],
    });
    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 60, run_id: started.body.data.run_id });

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
    expect(first.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });
    expect(db.lesson_v2_attempt_nonces![0]!.consumed_at).toEqual(expect.any(String));
    expect(db.lesson_v2_grade_receipts).toHaveLength(1);
    expect(db.lesson_segment_attempts).toHaveLength(0);

    const retry = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send(body);
    expect(retry.status).toBe(200);
    expect(retry.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: true });
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
    expect(corrected.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });
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
    expect(corrected.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });
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
    expect(corrected.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });
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

  it('never sends a fluent learner back to concrete: the M1 entry stage follows mastery (Appendix P Part 4.4, GAP-FIX-R2)', async () => {
    activateImmutableV2CpaFading();
    const kcId = 'abababab-abab-4bab-8bab-abababababab';
    const mastery = (pKnown: number) => {
      Object.assign(db, { topic_knowledge_components: [{ topic_id: TOPIC_ID, kc_id: kcId, role: 'teaches', is_primary: true }],
        kc: [{ id: kcId, key: 'kc-count', title: {}, status: 'active' }], learner_kc_mastery: [{ user_id: userId, kc_id: kcId, p_known: pKnown, attempts: 9, correct: 8 }] });
    };
    const app = createApp();
    // Fluent: starts at the symbolic stage; the earlier stages are restored as skipped and can never be graded in this run.
    mastery(0.92);
    const fluent = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(fluent.body.data).toMatchObject({ cpa_entry_stage: 'abstract', attempted_segment_ids: ['cpa-concrete-01', 'cpa-pictorial-01'] });
    const grade = (run: { run_id: string; attempt_tokens: Record<string, string> }, segmentId: string, value: string) => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: segmentId, run_id: run.run_id, attempt_token: run.attempt_tokens[segmentId], answer: { value },
    });
    const concrete = await grade(fluent.body.data, 'cpa-concrete-01', '7');
    expect(concrete.status).toBe(409);
    expect(concrete.body.error.code).toBe('CPA_STAGE_SKIPPED');
    const symbolic = await grade(fluent.body.data, 'cpa-abstract-01', '7');
    expect(symbolic.status).toBe(200);
    expect(symbolic.body.data.verdict).toMatchObject({ correct: true, score: 100 });
    expect((db.lesson_v2_grade_receipts as Array<{ verdict: Record<string, unknown> }>).at(-1)!.verdict).toMatchObject({ entry_stage: 'abstract' });
    // Partial mastery starts at pictorial; a novice at concrete (the pictorial stage still needs the concrete attempt).
    mastery(0.7);
    const partial = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(partial.body.data).toMatchObject({ cpa_entry_stage: 'pictorial', attempted_segment_ids: ['cpa-concrete-01'] });
    expect((await grade(partial.body.data, 'cpa-pictorial-01', '7')).status).toBe(200);
    mastery(0.2);
    const novice = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(novice.body.data).toMatchObject({ cpa_entry_stage: 'concrete', attempted_segment_ids: [] });
    expect((await grade(novice.body.data, 'cpa-pictorial-01', '7')).status).toBe(409);
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
      attempt_token: started.body.data.attempt_tokens['bar-structure-01'], answer: barBuild,
    });
    expect(structure.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });

    const answer = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'bar-answer-01', run_id: started.body.data.run_id,
      attempt_token: started.body.data.attempt_tokens['bar-answer-01'], answer: { value: '19' },
    });
    expect(answer.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });
  });

  it('requires M8 schema and slots receipts before the independent arithmetic segment', async () => {
    activateImmutableV2SchemaDiagram();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    const grade = (segment_id: string, answer: unknown) => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id, answer, run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens[segment_id],
    });

    const slotsFirst = await grade('schema-slots-01', { schema: 'change', slots: { start: 'earned', change: 'spent', result: 'unknown' } });
    expect(slotsFirst.status).toBe(409);
    expect(slotsFirst.body.error.code).toBe('LESSON_PREREQUISITE_REQUIRED');
    await grade('schema-structure-01', { schema: 'change' });
    const slots = await grade('schema-slots-01', { schema: 'change', slots: { start: 'earned', change: 'spent', result: 'unknown' } });
    expect(slots.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });
    const answer = await grade('schema-answer-01', { value: '15' });
    expect(answer.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });
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
    expect(graded.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });
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

  it('rejects the retired unsigned grading body without recording attempts or rewards', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'quiz-1', answer: { option_id: 'a' }, attempt_number: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(db.lesson_segment_attempts).toHaveLength(0);
    expect(db.lesson_v2_grade_receipts ?? []).toHaveLength(0);
    expect(db.lesson_progress).toHaveLength(0);
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
    expect(met.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 0, passed: true, xp_earned: 20, first_try_correct: 0, graded_count: 1 });
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
    expect(met.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 0, passed: true, xp_earned: 20, first_try_correct: 0, graded_count: 1 });
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
    expect(graded.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });

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
    expect(graded.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });

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
      segment_id: 'bar-structure-01', run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens['bar-structure-01'], answer: barBuild,
    });
    expect(structure.body.data.verdict).toMatchObject({ correct: true, score: 100 });
    const answer = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'bar-answer-01', run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens['bar-answer-01'], answer: { value: '19' },
    });
    expect(answer.body.data.verdict).toMatchObject({ correct: true, score: 100 });
    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('records the browser scorer parity beside the verdict and never grades with it (Appendix P Part 8, GAP-FIX-R2)', async () => {
    activateImmutableV2SchemaDiagram();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    const grade = (segmentId: string, answer: Record<string, unknown>, clientVerdict?: unknown) => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: segmentId, run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens[segmentId], answer,
      ...(clientVerdict === undefined ? {} : { client_verdict: clientVerdict }),
    });
    expect((await grade('schema-structure-01', { schema: 'change' }, 'bogus')).status).toBe(400);
    // A client that calls a valid answer invalid is recorded as disagreeing; the verdict is Core's alone.
    const graded = await grade('schema-structure-01', { schema: 'change' }, 'invalid');
    expect(graded.body.data.verdict).toMatchObject({ correct: true, score: 100 });
    const receipt = (db.lesson_v2_grade_receipts as Array<{ segment_id: string; verdict: Record<string, unknown> }>).find((row) => row.segment_id === 'schema-structure-01');
    expect(receipt?.verdict).toMatchObject({ correct: true, client_agree: false });
    // An answer Core refuses is never graded, whatever the browser claimed.
    expect((await grade('schema-slots-01', { schema: 'change', slots: { start: 'earned' } }, 'valid')).status).toBe(400);
  });

  it('delivers, grades, and completes M8 after its ordered immutable receipts', async () => {
    activateImmutableV2SchemaDiagram();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    expect(started.body.data.attempt_tokens).toEqual({ 'schema-structure-01': expect.any(String), 'schema-slots-01': expect.any(String), 'schema-answer-01': expect.any(String) });
    expect(JSON.stringify(started.body)).not.toContain('target');
    const grade = (segmentId: string, answer: Record<string, unknown>) => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: segmentId, run_id: started.body.data.run_id, attempt_token: started.body.data.attempt_tokens[segmentId], answer,
    });
    expect((await grade('schema-structure-01', { schema: 'change' })).body.data.verdict).toMatchObject({ correct: true, score: 100 });
    expect((await grade('schema-slots-01', { schema: 'change', slots: { start: 'earned', change: 'spent', result: 'unknown' } })).body.data.verdict).toMatchObject({ correct: true, score: 100 });
    expect((await grade('schema-answer-01', { value: '15' })).body.data.verdict).toMatchObject({ correct: true, score: 100 });
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
    // GAP-FIX-R5 (Appendix P M2, Part 4.6): the receipt stores the position error as a share of the line; the client never sees it.
    expect((db.lesson_v2_grade_receipts as Array<{ verdict: Record<string, unknown> }>).at(-1)!.verdict).toMatchObject({ diagnostic: 'tolerance', pae: 0.1 });
    expect(reviewed.body.data.verdict).not.toHaveProperty('pae');

    const met = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'place-01', run_id: started.body.data.run_id,
      attempt_token: reviewed.body.data.retry_attempt_token, answer: { value: '7' },
    });
    expect(met.body.data).toMatchObject({ verdict: { correct: true, score: 100 }, replayed: false });
    expect((db.lesson_v2_grade_receipts as Array<{ verdict: Record<string, unknown> }>).at(-1)!.verdict).toMatchObject({ diagnostic: 'none', pae: 0 });

    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: started.body.data.run_id, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 0, passed: true, xp_earned: 20, first_try_correct: 0, graded_count: 1 });
    // B.5 (S05.3d): the kept score is first-try accuracy; a review retry is not a penalty but not a first try.
    expect(complete.body.data.receipt).toEqual({
      schema_version: 2, completion_id: started.body.data.run_id, lesson_id: LESSON_1_ID, version_id: 'number-line-rev-001',
      locale: 'en-US', first_try_correct: 0, graded_count: 1, viewed_count: 0, hints_used: 0, awarded_xp: 20, duration_seconds: 60, previous_best_percent: 0,
      replay: { kind: 'first', notice: 'none', best_score_kept: false, xp_policy: 'improvement_only' },
      judgment: { assessed: 0, sound: 0, partial: 0, unsupported: 0 },
      // S05.3e: the closed celebration list, the streak after this run and today's pace (B.20, B.21, B.24).
      celebrations: ['lesson-complete'],
      streak: { days: 1, milestone: null, rest_days_bridged: 0 },
      pace: { goal: 1, passed_today: 1, goal_met: true },
    });
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
    expect(concreteReview.body.data.verdict).toMatchObject({ correct: false, score: 0 });
    const pictorial = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'cpa-pictorial-01', run_id: runId,
      attempt_token: started.body.data.attempt_tokens['cpa-pictorial-01'], answer: { value: '7' },
    });
    expect(pictorial.body.data.verdict).toMatchObject({ correct: true, score: 100 });

    const beforeAbstract = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: runId, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(beforeAbstract.status).toBe(409);

    const abstract = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'cpa-abstract-01', run_id: runId,
      attempt_token: started.body.data.attempt_tokens['cpa-abstract-01'], answer: { value: '7' },
    });
    expect(abstract.body.data.verdict).toMatchObject({ correct: true, score: 100 });
    const complete = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({
      run_id: runId, seconds_spent: 60, local_date: '2026-09-22',
    });
    expect(complete.status).toBe(200);
    expect(complete.body.data).toMatchObject({ score: 100, passed: true, xp_earned: 20 });
  });

  it('recovers a failed completion write and a lost response without duplicating rewards', async () => {
    activateImmutableV2WholeNumberLine();
    const app = createApp();
    const started = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/v2-runs`)).send({});
    expect(started.status).toBe(200);
    const runId = started.body.data.run_id;
    const grade = await auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/grade`)).send({
      segment_id: 'place-01', run_id: runId, attempt_token: started.body.data.attempt_tokens['place-01'], answer: { value: '7' },
    });
    expect(grade.status).toBe(200);
    const realFetch = createFakeFetch(db);
    let failure: 'before' | 'after' | null = 'before';
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/rpc/complete_v2_mixed_lesson') && init?.method === 'POST') {
        if (failure === 'before') return new Response('{"message":"temporary failure"}', { status: 503 });
        const result = await realFetch(input, init);
        if (failure === 'after') { failure = null; throw new Error('Connection lost after commit'); }
        return result;
      }
      return realFetch(input, init);
    });
    const complete = () => auth(request(app).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`))
      .send({ seconds_spent: 300, run_id: runId, local_date: '2026-09-22' });
    expect((await complete()).status).toBe(409);
    expect(db.lesson_progress).toHaveLength(0);
    failure = 'after';
    expect((await complete()).status).toBe(409);
    const recovered = await complete();
    expect(recovered.status).toBe(200);
    expect(recovered.body.data.replayed).toBe(true);
    expect(db.lesson_progress[0]).toMatchObject({ attempts: 1, xp_earned: 20 });
    expect(db.learning_stats.find((row) => row.user_id === userId)).toMatchObject({ xp_points: 20, minutes_learned: 5, lessons_completed: 1 });
  });

  it('refuses retired schema 1 completion without attempts, progress, or rewards', async () => {
    const beforeStats = structuredClone(db.learning_stats);
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send({ seconds_spent: 300 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_LESSON');
    expect(db.lesson_segment_attempts).toHaveLength(0);
    expect(db.lesson_progress).toHaveLength(0);
    expect(db.learning_stats).toEqual(beforeStats);
    expect(db.lesson_v2_runs ?? []).toHaveLength(0);
  });

  it('keeps locked lesson admission ahead of document availability', async () => {
    const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_2_ID}/complete`)).send({ seconds_spent: 60 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('LESSON_LOCKED');
    expect(db.lesson_progress).toHaveLength(0);
  });

  it('rejects invalid or missing completion time', async () => {
    for (const body of [{ minutes_spent: 999 }, {}]) {
      const res = await auth(request(createApp()).post(`/api/v1/learn/lessons/${LESSON_1_ID}/complete`)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('GET /api/v1/learn/lessons/:id (audio manifest)', () => {
  it('includes Echo\'s narration manifest alongside the client-safe document', async () => {
    activateImmutableV2Allocation();
    db.lesson_document_versions![0]!.audio = { version: 1, units: { 'allocate-01.prompt': { url: 'http://filebase.test/files/abc' } } };
    const res = await auth(request(createApp()).get(`/api/v1/learn/lessons/${LESSON_1_ID}`));
    expect(res.status).toBe(200);
    expect(res.body.data.audio).toMatchObject({
      version: 1,
      units: { 'allocate-01.prompt': { url: 'http://filebase.test/files/abc' } },
    });
  });
});
