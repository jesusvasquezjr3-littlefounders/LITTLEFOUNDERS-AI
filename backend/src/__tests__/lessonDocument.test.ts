import { describe, expect, it } from 'vitest';
import { completableSegmentIds, findGradingSegment, pickLessonLocale, stripAnswers, xpBySegmentId } from '../services/lessonDocument.js';
import { v2PublicLessonSchema } from '../services/v2LessonDocument.js';

const rows = [
  { lesson_id: 'l1', locale: 'en-US', schema_version: 1, document: { locale: 'en-US' }, answer_keys: {}, audio: {}, updated_at: '2026-08-01T00:00:00Z' },
  { lesson_id: 'l1', locale: 'es-MX', schema_version: 1, document: { locale: 'es-MX' }, answer_keys: {}, audio: {}, updated_at: '2026-08-01T00:00:00Z' },
  { lesson_id: 'l1', locale: 'pt-BR', schema_version: 1, document: { locale: 'pt-BR' }, answer_keys: {}, audio: {}, updated_at: '2026-08-01T00:00:00Z' },
];

describe('pickLessonLocale', () => {
  it("picks the caller's locale when present", () => {
    expect(pickLessonLocale(rows, 'pt-BR')?.locale).toBe('pt-BR');
  });

  it('falls back to es-MX (authoring locale) when the caller locale row is missing', () => {
    expect(pickLessonLocale(rows.filter((r) => r.locale !== 'en-US'), 'en-US')?.locale).toBe('es-MX');
  });

  it('falls back to any available row when neither the caller locale nor es-MX exist', () => {
    const onlyEnglish = rows.filter((r) => r.locale === 'en-US');
    expect(pickLessonLocale(onlyEnglish, 'pt-BR')?.locale).toBe('en-US');
  });

  it('returns null for an empty row set', () => {
    expect(pickLessonLocale([], 'en-US')).toBeNull();
  });

  it('treats a null caller locale the same as missing', () => {
    expect(pickLessonLocale(rows, null)?.locale).toBe('es-MX');
  });
});

describe('stripAnswers', () => {
  it('removes the answer key from every segment, defensively', () => {
    const doc = {
      segments: [
        { id: 's1', type: 'quiz_mcq', answer: { correct_option_id: 'a' }, payload: {} },
        { id: 's2', type: 'story_scene', payload: {} },
      ],
    };
    const stripped = stripAnswers(doc) as { segments: Array<Record<string, unknown>> };
    expect(stripped.segments[0]).not.toHaveProperty('answer');
    expect(stripped.segments[0]?.id).toBe('s1');
    expect(stripped.segments[1]).not.toHaveProperty('answer');
  });

  it('is a no-op on a document with no segments array', () => {
    const doc = { meta: { slug: 'x' } };
    expect(stripAnswers(doc)).toBe(doc);
  });
});

describe('findGradingSegment', () => {
  const document = {
    segments: [{ id: 'quiz-1', type: 'quiz_mcq', prompt_md: 'Pick one', difficulty: 2, xp: 10, payload: { options: [] } }],
  };
  const answerKeys = { 'quiz-1': { correct_option_id: 'a' } };

  it('merges the document segment with its server-only answer key', () => {
    const seg = findGradingSegment(document, answerKeys, 'quiz-1');
    expect(seg).toMatchObject({ id: 'quiz-1', type: 'quiz_mcq', xp: 10, answer: { correct_option_id: 'a' } });
  });

  it('returns a segment with answer=undefined when no key exists (caller maps this to 422)', () => {
    const seg = findGradingSegment(document, {}, 'quiz-1');
    expect(seg?.answer).toBeUndefined();
  });

  it('returns null when the segment id does not exist in the document', () => {
    expect(findGradingSegment(document, answerKeys, 'nope')).toBeNull();
  });
});

describe('xpBySegmentId', () => {
  it('maps xp per segment id', () => {
    const document = {
      segments: [
        { id: 'story-1', type: 'story_scene', xp: 0 },
        { id: 'quiz-1', type: 'quiz_mcq', xp: 10 },
      ],
    };
    expect(xpBySegmentId(document)).toEqual(new Map([['story-1', 0], ['quiz-1', 10]]));
  });
});

describe('completableSegmentIds', () => {
  const graders = new Set(['quiz_mcq', 'memory_flip']);
  const keyless = new Set(['memory_flip']);
  it('permits genuine story-only content and includes keyless graded weight', () => {
    expect(completableSegmentIds({ schema_version: 1, segments: [{ id: 'story', type: 'story_scene', xp: 0 }] }, {}, graders, keyless)).toEqual([]);
    expect(completableSegmentIds({ schema_version: 1, segments: [{ id: 'memory', type: 'memory_flip', xp: 10 }] }, {}, graders, keyless)).toEqual(['memory']);
  });
  it('refuses an unknown exercise or missing answer key before completion', () => {
    expect(completableSegmentIds({ schema_version: 1, segments: [{ id: 'future', type: 'future_chart', xp: 20 }] }, {}, graders, keyless)).toBeNull();
    expect(completableSegmentIds({ schema_version: 1, segments: [{ id: 'quiz', type: 'quiz_mcq', xp: 20 }] }, {}, graders, keyless)).toBeNull();
    expect(completableSegmentIds({ schema_version: 1, segments: [{ id: 'quiz', type: 'quiz_mcq', xp: 0 }] }, { quiz: {} }, graders, keyless)).toBeNull();
  });
});

describe('v2 public lesson capabilities', () => {
  const growthDocument = {
    schema_version: 2,
    course_id: 'financial-education', pathway_id: 'financial-teen', chapter_id: 'compound-growth',
    lesson_id: 'growth-pilot', version_id: 'revision-001', locale: 'en-US', age_band: '13-17',
    eligibility: { minimum_age: 13, maximum_age: 17 }, knowledge_component_ids: ['kc-compound-growth'],
    adventure_scene_id: 'diorama-a', title: 'Compare growth',
    required_capabilities: ['visual.multi-line.v1', 'operation.parameter-slider.v1', 'operation.predict-reveal.v1', 'operation.scale-toggle.v1'],
    segments: [{ id: 'growth-01', type: 'visual.growth-comparison.v2', grading: 'none', prompt: 'Compare the paths.',
      visual: { type: 'multi-line' }, payload: {
        principalMinor: 10_000, minimumRateBps: 200, maximumRateBps: 1_200, rateStepBps: 200,
        initialRateBps: 800, minimumYears: 5, maximumYears: 30, yearStep: 5, initialYears: 10,
        predictionStepMinor: 1_000, predictionMaximumMinor: 1_000_000,
      } }],
  };

  it('requires the long-horizon scale control for a growth comparison', () => {
    expect(v2PublicLessonSchema.safeParse(growthDocument).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse({ ...growthDocument,
      required_capabilities: growthDocument.required_capabilities.filter((value) => value !== 'operation.scale-toggle.v1'),
    }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...growthDocument,
      required_capabilities: [...growthDocument.required_capabilities, 'operation.not-real.v1'],
    }).success).toBe(false);
  });

  it("requires M20's exact 14–17 policy, full capabilities, and increasing brackets", () => {
    const taxDocument = {
      schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-teen', chapter_id: 'tax-basics',
      lesson_id: 'tax-pilot', version_id: 'revision-001', locale: 'en-US', age_band: '13-17',
      eligibility: { minimum_age: 14, maximum_age: 17 }, knowledge_component_ids: ['kc-marginal-tax'],
      adventure_scene_id: 'diorama-a', title: 'How brackets fill',
      required_capabilities: ['visual.stacked-bar.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
      segments: [{ id: 'tax-01', type: 'visual.tax-bracket.v2', grading: 'none', prompt: 'Move income.', visual: { type: 'stacked-bar' },
        payload: { minimumIncomeMinor: 0, maximumIncomeMinor: 60_000, incomeStepMinor: 5_000, initialIncomeMinor: 30_000,
          brackets: [{ upToMinor: 10_000, rateBasisPoints: 1_000 }, { upToMinor: 30_000, rateBasisPoints: 2_000 }, { upToMinor: null, rateBasisPoints: 3_000 }] } }],
    };
    expect(v2PublicLessonSchema.safeParse(taxDocument).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse({ ...taxDocument, eligibility: { minimum_age: 13, maximum_age: 17 } }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...taxDocument, required_capabilities: ['visual.stacked-bar.v1', 'operation.parameter-slider.v1'] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...taxDocument, segments: [{ ...taxDocument.segments[0], payload: { ...taxDocument.segments[0].payload,
      brackets: [{ upToMinor: 30_000, rateBasisPoints: 1_000 }, { upToMinor: 10_000, rateBasisPoints: 2_000 }, { upToMinor: null, rateBasisPoints: 3_000 }] } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...taxDocument, segments: [{ ...taxDocument.segments[0], payload: { ...taxDocument.segments[0].payload,
      brackets: [{ upToMinor: 10_000, rateBasisPoints: 10_001 }, { upToMinor: null, rateBasisPoints: 3_000 }] } }] }).success).toBe(false);
  });

  it('requires M3 linked equal parts and a fraction that lands on the bounded line', () => {
    const fractionDocument = { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'fraction-magnitude', lesson_id: 'fraction-pilot', version_id: 'revision-001', locale: 'en-US', age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-fraction-magnitude'], adventure_scene_id: 'diorama-a', title: 'Fractions have a place', required_capabilities: ['visual.number-line.v1', 'visual.fraction-area.v1', 'operation.place-point.v1', 'operation.linked-representations.v1'], segments: [{ id: 'fraction-01', type: 'math.number-line.fraction.v2', grading: 'server', prompt: 'Place three quarters.', visual: { type: 'number-line' }, payload: { maximumWhole: 1, divisions: 4, initialUnits: 0, spokenText: 'three quarters' } }] };
    expect(v2PublicLessonSchema.safeParse(fractionDocument).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse({ ...fractionDocument, required_capabilities: ['visual.number-line.v1', 'operation.place-point.v1'] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...fractionDocument, segments: [{ ...fractionDocument.segments[0], payload: { ...fractionDocument.segments[0].payload, targetNumerator: 3 } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...fractionDocument, eligibility: { minimum_age: 9, maximum_age: 12 } }).success).toBe(false);
  });

  it('keeps M6 equal-area targets private and exactly limits its safe age subset', () => {
    const document = { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'equal-shares', lesson_id: 'fraction-area-pilot', version_id: 'revision-001', locale: 'en-US', age_band: '6-9', eligibility: { minimum_age: 7, maximum_age: 9 }, knowledge_component_ids: ['kc-equal-shares'], adventure_scene_id: 'diorama-a', title: 'Make equal shares', required_capabilities: ['visual.fraction-area.v1', 'operation.partition-equal.v1', 'operation.shade-parts.v1', 'operation.split-equivalent.v1'], segments: [{ id: 'fraction-area-01', type: 'math.fraction-area.v2', grading: 'server', prompt: 'Show one half.', visual: { type: 'fraction-area' }, payload: { minimumParts: 2, maximumParts: 6, initialParts: 2, initialShaded: 0, spokenText: 'one half' } }] };
    expect(v2PublicLessonSchema.safeParse(document).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse({ ...document, eligibility: { minimum_age: 6, maximum_age: 9 } }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: [{ ...document.segments[0], payload: { ...document.segments[0].payload, targetNumerator: 1 } }] }).success).toBe(false);
  });

  it('requires M7 to keep structure and arithmetic distinct in an ordered tween-only pair', () => {
    const payload = { whole: 50, difference: 12, knownLabel: 'Ana', unknownLabel: 'Leo', spokenText: 'fifty minus twelve' };
    const document = { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'compare-savings', lesson_id: 'bar-model-pilot', version_id: 'revision-001', locale: 'en-US', age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-compare-quantities'], adventure_scene_id: 'diorama-a', title: 'Compare two savings', required_capabilities: ['visual.bar-model.v1', 'operation.build-slots.v1', 'operation.structure-check.v1', 'operation.number-input.v1'], segments: [{ id: 'bar-structure-01', type: 'math.bar-model.structure.v2', grading: 'server', prompt: 'Choose the model.', visual: { type: 'bar-model' }, payload }, { id: 'bar-answer-01', type: 'math.bar-model.answer.v2', grading: 'server', prompt: 'Solve it.', visual: { type: 'bar-model' }, payload }] };
    expect(v2PublicLessonSchema.safeParse(document).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse({ ...document, eligibility: { minimum_age: 9, maximum_age: 12 } }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: [document.segments[1], document.segments[0]] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: [document.segments[0]] }).success).toBe(false);
  });

  it('requires M8 to keep its change schema, slots and answer in the exact 10–12 order', () => {
    const payload = { income: 24, spending: 9, incomeLabel: 'Earned', spendingLabel: 'Spent', remainingLabel: 'Left', spokenText: 'twenty four minus nine' };
    const document = { schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'change-schemas', lesson_id: 'schema-diagram-pilot', version_id: 'revision-001', locale: 'en-US', age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-change-schemas'], adventure_scene_id: 'diorama-a', title: 'Find what is left', required_capabilities: ['visual.schema-diagram.v1', 'operation.build-slots.v1', 'operation.structure-check.v1', 'operation.number-input.v1'], segments: [{ id: 'schema-structure-01', type: 'math.schema-diagram.structure.v2', grading: 'server', prompt: 'Choose the schema.', visual: { type: 'schema-diagram' }, payload }, { id: 'schema-slots-01', type: 'math.schema-diagram.slots.v2', grading: 'server', prompt: 'Fill the values.', visual: { type: 'schema-diagram' }, payload }, { id: 'schema-answer-01', type: 'math.schema-diagram.answer.v2', grading: 'server', prompt: 'Find the amount left.', visual: { type: 'schema-diagram' }, payload }] };
    expect(v2PublicLessonSchema.safeParse(document).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse({ ...document, eligibility: { minimum_age: 9, maximum_age: 12 } }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: [document.segments[1], document.segments[0], document.segments[2]] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: document.segments.slice(0, 2) }).success).toBe(false);
  });

  it('keeps the controlled M9/M10 teaching candidate public, bounded, and server-gradeable', () => {
    const document = {
      schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'discounts',
      lesson_id: 'worked-example-pilot', version_id: 'revision-001', locale: 'en-US', age_band: '10-12',
      eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-percent-discount'],
      adventure_scene_id: 'diorama-a', title: 'Find a sale price',
      required_capabilities: ['visual.worked-example.v1', 'operation.step-replay.v1', 'operation.predict-next.v1', 'operation.backward-fade.v1', 'operation.number-input.v1'],
      segments: [{ id: 'worked-example-01', type: 'math.worked-example.v2', grading: 'server',
        prompt: 'Follow the discount.', visual: { type: 'worked-example' }, payload: {
          steps: [
            { id: 'discount-part', expression: '20% × 50', result: '10', spokenText: 'Twenty percent of 50 is 10' },
            { id: 'discount-subtract', expression: '50 − 10', result: '40', spokenText: 'Fifty minus 10 is 40' },
            { id: 'sale-price', expression: 'Sale price', result: '40', spokenText: 'The sale price is 40' },
          ], fade_count: 1, response_step_ids: ['discount-subtract', 'sale-price'],
        } }],
    };
    expect(v2PublicLessonSchema.safeParse(document).success).toBe(true);
    expect(v2PublicLessonSchema.safeParse({ ...document, eligibility: { minimum_age: 9, maximum_age: 12 } }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, required_capabilities: ['visual.worked-example.v1', 'operation.step-replay.v1'] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: [{ ...document.segments[0], grading: 'none' }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: [{ ...document.segments[0], payload: {
      ...document.segments[0].payload, fade_count: 3,
    } }] }).success).toBe(false);
    expect(v2PublicLessonSchema.safeParse({ ...document, segments: [{ ...document.segments[0], payload: {
      ...document.segments[0].payload, response_step_ids: ['sale-price', 'discount-subtract'],
    } }] }).success).toBe(false);
  });
});
