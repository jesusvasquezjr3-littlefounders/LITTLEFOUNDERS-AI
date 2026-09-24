import { describe, expect, it } from 'vitest';
import { gradeV2Visual, v2CompletionRequiredSegmentIds, v2CpaAttemptPrerequisiteSegmentId, validateV2LessonForGrading } from './v2LessonDocument.js';

const allocationDocument = {
  schema_version: 2,
  course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'saving-basics',
  lesson_id: 'pilot-allocation', version_id: 'rev-001', locale: 'es-MX', age_band: '6-9',
  eligibility: { minimum_age: 6, maximum_age: 9 }, knowledge_component_ids: ['kc-saving-allocation'],
  adventure_scene_id: 'diorama-a', title: 'Divide your coins',
  required_capabilities: ['visual.stacked-bar.v1', 'operation.reallocate.v1'],
  segments: [{ id: 'allocate-01', type: 'money.allocation.v2', grading: 'server', prompt: 'Split 12 coins.',
    visual: { type: 'stacked-bar' }, payload: { total: 12, step: 1, currency: 'coins' } }],
};
const allocationKeys = { 'allocate-01': { minimumSave: 4 } };
const workedExampleDocument = {
  schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'discounts',
  lesson_id: 'pilot-worked-example', version_id: 'rev-001', locale: 'en-US', age_band: '10-12',
  eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-percent-discount'],
  adventure_scene_id: 'diorama-a', title: 'Find a sale price',
  required_capabilities: ['visual.worked-example.v1', 'operation.step-replay.v1', 'operation.predict-next.v1', 'operation.backward-fade.v1', 'operation.number-input.v1'],
  segments: [{ id: 'worked-example-01', type: 'math.worked-example.v2', grading: 'server', prompt: 'Follow the discount.',
    visual: { type: 'worked-example' }, payload: { steps: [
      { id: 'discount-part', expression: '20% × 50', result: '10', spokenText: 'Twenty percent of 50 is 10' },
      { id: 'discount-subtract', expression: '50 − 10', result: '40', spokenText: 'Fifty minus 10 is 40' },
      { id: 'sale-price', expression: 'Sale price', result: '40', spokenText: 'The sale price is 40' },
    ], fade_count: 1, response_step_ids: ['discount-subtract', 'sale-price'] } }],
};
const workedExampleKeys = { 'worked-example-01': { expectedValues: { 'discount-subtract': '40', 'sale-price': '40' } } };
const functionMachineDocument = {
  schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-10-12', chapter_id: 'savings-rules',
  lesson_id: 'pilot-function-machine', version_id: 'rev-001', locale: 'en-US', age_band: '10-12',
  eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-savings-function'],
  adventure_scene_id: 'diorama-a', title: 'Find the savings rule',
  required_capabilities: ['visual.function-machine.v1', 'operation.try-input.v1', 'operation.guess-rule.v1', 'operation.held-out-check.v1'],
  segments: [{ id: 'function-machine-01', type: 'math.function-machine.v2', grading: 'server', prompt: 'Try each week.',
    visual: { type: 'function-machine' }, payload: { examples: [{ input: 1, output: 15 }, { input: 2, output: 20 }, { input: 3, output: 25 }],
      multiplierMaximum: 9, offsetMaximum: 50 } }],
};
const functionMachineKeys = { 'function-machine-01': { multiplier: 5, offset: 10, heldOutInputs: [4, 6] } };
const cpaDocument = {
  schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-young', chapter_id: 'saving-basics',
  lesson_id: 'pilot-cpa', version_id: 'rev-001', locale: 'en-US', age_band: '6-9',
  eligibility: { minimum_age: 6, maximum_age: 9 }, knowledge_component_ids: ['kc-saving-count'],
  adventure_scene_id: 'diorama-a', title: 'Count a savings goal',
  required_capabilities: ['visual.cpa-count.v1', 'operation.count-objects.v1', 'operation.symbolic-answer.v1'],
  representation_progressions: [{ fading_group_id: 'cpa-savings-01', problem_id: 'saving-count-01', stages: [
    { segment_id: 'cpa-concrete-01', stage: 'concrete', worked_steps_shown: 3 },
    { segment_id: 'cpa-pictorial-01', stage: 'pictorial', worked_steps_shown: 2 },
    { segment_id: 'cpa-abstract-01', stage: 'abstract', worked_steps_shown: 0 },
  ] }],
  segments: ['cpa-concrete-01', 'cpa-pictorial-01', 'cpa-abstract-01'].map((id) => ({
    id, type: 'math.cpa-count.v2', grading: 'server', prompt: 'Put the coin groups together.',
    visual: { type: 'cpa-count' }, payload: { left: 4, right: 3, spokenText: 'four plus three' },
  })),
};
const cpaKeys = { 'cpa-concrete-01': { target: 7 }, 'cpa-pictorial-01': { target: 7 }, 'cpa-abstract-01': { target: 7 } };

describe('v2 lesson document contract', () => {
  it('accepts a complete public document only with matching private rubrics', () => {
    const result = validateV2LessonForGrading(allocationDocument, allocationKeys, { lessonId: 'pilot-allocation', locale: 'es-MX' });
    expect(result?.version_id).toBe('rev-001');
    expect(result?.segments[0]?.id).toBe('allocate-01');
  });

  it('rejects a route/locale mismatch, extra private material and malformed public data', () => {
    expect(validateV2LessonForGrading(allocationDocument, allocationKeys, { lessonId: 'other', locale: 'es-MX' })).toBeNull();
    expect(validateV2LessonForGrading(allocationDocument, { ...allocationKeys, secret: { x: 1 } }, { lessonId: 'pilot-allocation', locale: 'es-MX' })).toBeNull();
    expect(validateV2LessonForGrading({ ...allocationDocument, answer_keys: allocationKeys }, allocationKeys, { lessonId: 'pilot-allocation', locale: 'es-MX' })).toBeNull();
    expect(validateV2LessonForGrading({ ...allocationDocument, segments: [{ ...allocationDocument.segments[0], payload: { total: 12, step: 5, currency: 'coins' } }] }, allocationKeys, { lessonId: 'pilot-allocation', locale: 'es-MX' })).toBeNull();
  });

  it('scores only canonical semantic responses against the server-only rubric', () => {
    const document = validateV2LessonForGrading(allocationDocument, allocationKeys, { lessonId: 'pilot-allocation', locale: 'es-MX' });
    expect(document).not.toBeNull();
    if (!document) return;
    expect(gradeV2Visual(document, allocationKeys, 'allocate-01', { save: 4, spend: 4, share: 4 })).toMatchObject({ score: 100, correct: true });
    expect(gradeV2Visual(document, allocationKeys, 'allocate-01', { save: 3, spend: 4, share: 5 })).toMatchObject({ score: 0, correct: false });
    expect(gradeV2Visual(document, allocationKeys, 'allocate-01', { save: 4, spend: 4, share: 3 })).toBeNull();
  });

  it('accepts and scores an M9/M10 value set only with its matching private rubric', () => {
    const document = validateV2LessonForGrading(workedExampleDocument, workedExampleKeys, { lessonId: 'pilot-worked-example', locale: 'en-US' });
    expect(document).not.toBeNull();
    if (!document) return;
    expect(gradeV2Visual(document, workedExampleKeys, 'worked-example-01',
      { values: { 'discount-subtract': '40', 'sale-price': '40' } })).toMatchObject({ score: 100, correct: true });
    expect(gradeV2Visual(document, workedExampleKeys, 'worked-example-01',
      { values: { 'discount-subtract': '40', 'sale-price': '39' } })).toMatchObject({ score: 0, correct: false });
    expect(validateV2LessonForGrading(workedExampleDocument, { 'worked-example-01': { expectedValues: { 'discount-subtract': '40' } } },
      { lessonId: 'pilot-worked-example', locale: 'en-US' })).toBeNull();
  });

  it('accepts M13 public examples and scores its rule only against distinct held-out inputs', () => {
    const document = validateV2LessonForGrading(functionMachineDocument, functionMachineKeys,
      { lessonId: 'pilot-function-machine', locale: 'en-US' });
    expect(document).not.toBeNull();
    if (!document) return;
    expect(gradeV2Visual(document, functionMachineKeys, 'function-machine-01', { multiplier: '5', offset: '10' }))
      .toMatchObject({ score: 100, correct: true });
    expect(gradeV2Visual(document, functionMachineKeys, 'function-machine-01', { multiplier: '4', offset: '10' }))
      .toMatchObject({ score: 0, correct: false });
    expect(validateV2LessonForGrading(functionMachineDocument,
      { 'function-machine-01': { multiplier: 5, offset: 10, heldOutInputs: [3, 6] } },
      { lessonId: 'pilot-function-machine', locale: 'en-US' })).toBeNull();
  });

  it('derives an M1 attempted-stage prerequisite only from the validated progression', () => {
    const document = validateV2LessonForGrading(cpaDocument, cpaKeys, { lessonId: 'pilot-cpa', locale: 'en-US' });
    expect(document).not.toBeNull();
    if (!document) return;
    expect(v2CpaAttemptPrerequisiteSegmentId(document, 'cpa-concrete-01')).toBeNull();
    expect(v2CpaAttemptPrerequisiteSegmentId(document, 'cpa-pictorial-01')).toBe('cpa-concrete-01');
    expect(v2CpaAttemptPrerequisiteSegmentId(document, 'cpa-abstract-01')).toBe('cpa-pictorial-01');
    expect(v2CpaAttemptPrerequisiteSegmentId(document, 'missing')).toBeUndefined();
    expect(v2CompletionRequiredSegmentIds(document)).toEqual(['cpa-abstract-01']);
    expect(validateV2LessonForGrading({ ...cpaDocument, segments: cpaDocument.segments.map(({ payload, ...segment }) => ({
      ...segment, payload: { left: payload.left, right: payload.right },
    })) }, cpaKeys, { lessonId: 'pilot-cpa', locale: 'en-US' })).toBeNull();
  });
});
