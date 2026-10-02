import { describe, expect, it } from 'vitest';
import {
  answerShapeSample, gradeAnswerShape, gradeArrangement, gradeCurveParameters, gradeNumberTolerance, gradePointSet, isAnswerShapeId,
  sampleArrangement, sampleCurveParameters, V2_ANSWER_SHAPE_IDS, type V2AnswerShapeId,
} from '../services/v2AnswerShapes.js';
import { answerShapeResponseSchemas, answerShapeRubric, answerShapeRubricSchemas, shapeGradeAsV2Grade } from '../services/v2AnswerShapeSchemas.js';

const met = { verdict: 'met', diagnostic: 'none' };
const valid = { verdict: 'valid', diagnostic: 'none' };
const invalid = { verdict: 'invalid', diagnostic: 'none' };
const review = (diagnostic: string) => ({ verdict: 'review', diagnostic });
const poisoned = (text: string) => JSON.parse(text) as unknown;
const curve = (family: string, params: Record<string, string>) => ({ family, params });

describe('curve parameters', () => {
  const line = { family: 'line', target: { m: '2', b: '1' }, parameter_tolerance: { absolute: '0.1' }, parameter_review: { absolute: '0.5' } };

  it('walks the whole verdict ladder on parameters', () => {
    expect(gradeCurveParameters(curve('line', { m: '3', b: '0' }))).toEqual(valid);
    expect(gradeCurveParameters(curve('line', { m: '2.1', b: '0.9' }), line)).toEqual(met);
    expect(gradeCurveParameters(curve('line', { m: '2.4', b: '1' }), line)).toEqual(review('tolerance'));
    expect(gradeCurveParameters(curve('line', { m: '2', b: '9' }), line)).toEqual(review('partial'));
    expect(gradeCurveParameters(curve('line', { m: '5', b: '9' }), line)).toEqual(review('value'));
    expect(gradeCurveParameters(curve('quadratic', { a: '0', b: '2', c: '1' }), line)).toEqual(review('structure'));
    expect(gradeCurveParameters(curve('line', { m: 'x', b: '9' }), line)).toEqual(invalid);
  });

  it('compares the sampled curve, so a different family on the same curve is met', () => {
    const key = { family: 'line', target: { m: '2', b: '1' }, by: 'curve', samples: [-3, 0, 4] };
    expect(gradeCurveParameters(curve('line', { m: '2', b: '1' }), key)).toEqual(met);
    expect(gradeCurveParameters(curve('quadratic', { a: '0', b: '2', c: '1' }), key)).toEqual(met);
    expect(gradeCurveParameters(curve('line', { m: '2', b: '1.01' }), key)).toEqual(review('value'));
    const parabola = { family: 'quadratic', target: { a: '1', b: '0', c: '0' }, by: 'curve', samples: [-2, -1, 0, 1, 2], curve_tolerance: { absolute: '0.5' }, curve_review: { absolute: '1.5' } };
    expect(gradeCurveParameters(curve('quadratic', { a: '1', b: '0', c: '0.2' }), parabola)).toEqual(met);
    expect(gradeCurveParameters(curve('quadratic', { a: '1', b: '0', c: '1.2' }), parabola)).toEqual(review('tolerance'));
    expect(gradeCurveParameters(curve('line', { m: '0', b: '0' }), parabola)).toEqual(review('partial'));
    expect(gradeCurveParameters(curve('line', { m: '0', b: '40' }), parabola)).toEqual(review('value'));
  });

  it('applies a relative curve tolerance against the expected value at each sample', () => {
    const key = { family: 'line', target: { m: '1', b: '0' }, by: 'curve', samples: [1, 10], curve_tolerance: { relative_bps: 1000 } };
    expect(gradeCurveParameters(curve('line', { m: '1.05', b: '0' }), key)).toEqual(met);
    expect(gradeCurveParameters(curve('line', { m: '1', b: '0.5' }), key)).toEqual(review('partial'));
    expect(gradeCurveParameters(curve('line', { m: '1.2', b: '0' }), key)).toEqual(review('value'));
  });

  it('grades exponentials exactly, including negative exponents', () => {
    const key = { family: 'exponential', target: { a: '8', b: '2' }, by: 'curve', samples: [-2, 0, 3] };
    expect(gradeCurveParameters(curve('exponential', { a: '8', b: '2' }), key)).toEqual(met);
    expect(gradeCurveParameters(curve('exponential', { a: '8', b: '4' }), key)).toEqual(review('partial'));
    expect(gradeCurveParameters(curve('exponential', { a: '2', b: '4' }), key)).toEqual(review('value'));
    expect(gradeCurveParameters(curve('exponential', { a: '8', b: '2.0001' }), key)).toEqual(review('partial'));
    expect(gradeCurveParameters(curve('exponential', { a: '8', b: '3' }), { family: 'exponential', target: { a: '8', b: '2' } })).toEqual(review('partial'));
  });

  it('combines parameters and curve with either and both', () => {
    const base = { family: 'line', target: { m: '2', b: '0' }, samples: [1, 2], parameter_tolerance: { absolute: '0.1' }, curve_tolerance: { absolute: '0.5' } };
    const near = curve('line', { m: '2.2', b: '0' });
    expect(gradeCurveParameters(near, { ...base, by: 'either' })).toEqual(met);
    expect(gradeCurveParameters(near, { ...base, by: 'both' })).toEqual(review('partial'));
    expect(gradeCurveParameters(near, { ...base, by: 'parameters', samples: undefined, curve_tolerance: undefined })).toEqual(review('partial'));
    expect(gradeCurveParameters(curve('line', { m: '2', b: '0' }), { ...base, by: 'both' })).toEqual(met);
  });

  it('keeps the response in its slider ranges and family list', () => {
    const context = { families: ['line', 'quadratic'], ranges: { m: { minimum: '-5', maximum: '5' }, b: { minimum: '-10', maximum: '10' } } };
    expect(gradeCurveParameters(curve('line', { m: '6', b: '0' }), undefined, context)).toEqual(invalid);
    expect(gradeCurveParameters(curve('line', { m: '5', b: '10' }), undefined, context)).toEqual(valid);
    expect(gradeCurveParameters(curve('exponential', { a: '1', b: '2' }), undefined, context)).toEqual(invalid);
    expect(gradeCurveParameters(curve('line', { m: '1', b: '1' }), { family: 'line', target: { m: '9', b: '1' } }, context)).toEqual(invalid);
    expect(gradeCurveParameters(curve('line', { m: '1', b: '1' }), undefined, { families: [] })).toEqual(invalid);
    expect(gradeCurveParameters(curve('line', { m: '1', b: '1' }), undefined, { families: ['line', 'line'] })).toEqual(invalid);
    expect(gradeCurveParameters(curve('line', { m: '1', b: '1' }), undefined, { ranges: poisoned('{"__proto__":{"minimum":"0","maximum":"1"}}') })).toEqual(invalid);
    expect(gradeCurveParameters(curve('line', { m: '1', b: '1' }), undefined, { ranges: { z: { minimum: '0', maximum: '1' } } })).toEqual(invalid);
    expect(gradeCurveParameters(curve('line', { m: '1', b: '1' }), undefined, { ranges: { m: { minimum: '1', maximum: '1' } } })).toEqual(invalid);
  });

  it('refuses a malformed or degenerate rubric', () => {
    const bad: unknown[] = [{}, { family: 'line' }, { family: 'cubic', target: { m: '1', b: '0' } }, { family: 'line', target: { m: '1' } }, { family: 'line', target: { m: '1', b: '0', c: '0' } },
      { family: 'line', target: { m: '1', b: 'NaN' } }, { family: 'quadratic', target: { a: '0', b: '1', c: '1' } }, { family: 'exponential', target: { a: '0', b: '2' } },
      { family: 'exponential', target: { a: '1', b: '1' } }, { family: 'exponential', target: { a: '1', b: '-2' } },
      { ...line, by: 'sideways' }, { ...line, by: 'curve' }, { ...line, samples: [1, 2] }, { ...line, by: 'curve', samples: [1, 2], parameter_tolerance: { absolute: '1' } },
      { family: 'line', target: { m: '1', b: '0' }, by: 'curve', samples: [1] }, { family: 'line', target: { m: '1', b: '0' }, by: 'curve', samples: [1, 1] },
      { family: 'line', target: { m: '1', b: '0' }, by: 'curve', samples: [1, 11] }, { family: 'line', target: { m: '1', b: '0' }, by: 'curve', samples: [1, 1.5] },
      { family: 'line', target: { m: '1', b: '0' }, by: 'curve', samples: Array.from({ length: 17 }, (_, index) => index - 8) },
      { family: 'line', target: { m: '1', b: '0' }, by: 'curve', samples: [0, 1], curve_review: { absolute: '1' }, curve_tolerance: { absolute: '1' } },
      { ...line, parameter_review: { absolute: '0.1' } }, { ...line, extra: true }, null, [], 'line'];
    for (const key of bad) expect(gradeCurveParameters(curve('line', { m: '2', b: '1' }), key), JSON.stringify(key)).toEqual(invalid);
  });

  it('refuses adversarial responses without throwing or stalling', () => {
    for (const response of [null, undefined, [], 'line', { family: 'line' }, { params: { m: '1', b: '1' } }, { family: 'line', params: { m: '1', b: '1' }, extra: 1 },
      { family: 'line', params: { m: '1', b: '1', c: '1' } }, { family: 'line', params: { m: '1' } }, { family: 'line', params: 'm' }, { family: 'line', params: [] },
      { family: '__proto__', params: { m: '1', b: '1' } }, { family: 'constructor', params: {} }, { family: 'toString', params: {} }, { family: 7, params: {} },
      poisoned('{"family":"line","params":{"m":"1","b":"1","__proto__":{"m":"2"}}}'), poisoned('{"family":"line","params":{"m":"1","b":"1"},"__proto__":{}}'),
      { family: 'line', params: { m: Number.NaN, b: '1' } }, { family: 'line', params: { m: Number.POSITIVE_INFINITY, b: '1' } }, { family: 'line', params: { m: '1e9', b: '1' } },
      { family: 'line', params: { m: '9'.repeat(10_000), b: '1' } }, { family: 'exponential', params: { a: '1', b: '0' } }, { family: 'exponential', params: { a: '1', b: '-3' } }]) {
      expect(gradeCurveParameters(response, line), JSON.stringify(response)).toEqual(invalid);
    }
    const started = Date.now();
    const heavy = { family: 'exponential', target: { a: '999999999999999', b: '999999999999999.999999999999' }, by: 'curve', samples: [10, -10, 9, -9, 8, -8, 7, -7, 6, -6, 5, -5, 4, -4, 3, -3] };
    expect(gradeCurveParameters(curve('exponential', { a: '1', b: '0.000000000001' }), heavy).verdict).toBe('review');
    expect(gradeCurveParameters(curve('exponential', { a: '999999999999999', b: '999999999999999.999999999999' }), heavy)).toEqual(met);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('gives a sample response that is never invalid, and none for a malformed key', () => {
    for (const key of [line, { family: 'quadratic', target: { a: '1', b: '2', c: '3' }, by: 'both', samples: [0, 1, 2] }, { family: 'exponential', target: { a: '2', b: '3' }, by: 'curve', samples: [0, 1] }]) {
      expect(gradeCurveParameters(sampleCurveParameters(key), key), JSON.stringify(key)).toEqual(met);
    }
    expect(sampleCurveParameters({ family: 'line' })).toBeNull();
    expect(sampleCurveParameters(line, { families: ['quadratic'] })).toBeNull();
  });
});

describe('arrangement', () => {
  const context = { pieceIds: ['piece-a', 'piece-b', 'piece-c', 'piece-d'], slotIds: ['slot-one', 'slot-two', 'slot-three'], capacities: { 'slot-one': 2 } };
  const key = { solutions: [{ 'slot-one': ['piece-a', 'piece-b'], 'slot-two': ['piece-c'] }] };
  const place = (slots: Record<string, string[]>) => ({ slots });

  it('walks the whole verdict ladder', () => {
    expect(gradeArrangement(place({ 'slot-one': ['piece-d'] }), undefined, context)).toEqual(valid);
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-b'], 'slot-two': ['piece-c'] }), key, context)).toEqual(met);
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-b'] }), key, context)).toEqual(review('miss'));
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-b'], 'slot-two': ['piece-c'], 'slot-three': ['piece-d'] }), key, context)).toEqual(review('false_alarm'));
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-b'], 'slot-three': ['piece-c'] }), key, context)).toEqual(review('partial'));
    expect(gradeArrangement(place({ 'slot-three': ['piece-a'], 'slot-two': ['piece-d'] }), key, context)).toEqual(review('value'));
    expect(gradeArrangement(place({}), key, context)).toEqual(invalid);
  });

  it('ignores order inside a slot unless the key is ordered, and never ignores which slot', () => {
    const swapped = place({ 'slot-one': ['piece-b', 'piece-a'], 'slot-two': ['piece-c'] });
    expect(gradeArrangement(swapped, key, context)).toEqual(met);
    expect(gradeArrangement(swapped, { ...key, ordered: true }, context)).toEqual(review('partial'));
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-b'], 'slot-two': ['piece-c'] }), { ...key, ordered: true }, context)).toEqual(met);
    expect(gradeArrangement(place({ 'slot-one': ['piece-c'], 'slot-two': ['piece-a', 'piece-b'] }), key, context)).toEqual(invalid);
  });

  it('accepts any listed alternative and diagnoses against the closest one', () => {
    const many = { solutions: [{ 'slot-one': ['piece-a'], 'slot-two': ['piece-b'] }, { 'slot-one': ['piece-b'], 'slot-two': ['piece-a'] }] };
    expect(gradeArrangement(place({ 'slot-one': ['piece-b'], 'slot-two': ['piece-a'] }), many, context)).toEqual(met);
    expect(gradeArrangement(place({ 'slot-one': ['piece-b'] }), many, context)).toEqual(review('miss'));
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-b'], 'slot-two': ['piece-c'] }), many, context)).toEqual(review('partial'));
  });

  it('enforces slot capacity, duplicates and repetition', () => {
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-b', 'piece-c'] }), undefined, context)).toEqual(invalid);
    expect(gradeArrangement(place({ 'slot-two': ['piece-a', 'piece-b'] }), undefined, context)).toEqual(invalid);
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-a'] }), undefined, context)).toEqual(invalid);
    expect(gradeArrangement(place({ 'slot-one': ['piece-a'], 'slot-two': ['piece-a'] }), undefined, context)).toEqual(invalid);
    const repeat = { ...context, repeatable: true };
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-a'], 'slot-two': ['piece-a'] }), undefined, repeat)).toEqual(valid);
    const repeated = { solutions: [{ 'slot-one': ['piece-a', 'piece-a'], 'slot-two': ['piece-b'] }] };
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-a'], 'slot-two': ['piece-b'] }), repeated, repeat)).toEqual(met);
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-b'], 'slot-two': ['piece-b'] }), repeated, repeat)).toEqual(review('partial'));
    expect(gradeArrangement(place({ 'slot-one': ['piece-a'], 'slot-two': ['piece-b'] }), repeated, repeat)).toEqual(review('miss'));
    expect(gradeArrangement(place({ 'slot-one': ['piece-a', 'piece-a'], 'slot-two': ['piece-b'] }), repeated, context)).toEqual(invalid);
  });

  it('refuses unknown slots and pieces, and every prototype-pollution key', () => {
    for (const slots of [{ 'slot-nine': ['piece-a'] }, { 'slot-one': ['piece-z'] }, { 'slot-one': 'piece-a' }, { 'slot-one': [1] }, { 'slot-one': [null] }, { constructor: ['piece-a'] },
      poisoned('{"__proto__":["piece-a"]}'), poisoned('{"slot-one":["piece-a"],"__proto__":["piece-b"]}'), poisoned('{"prototype":["piece-a"]}'), poisoned('{"toString":["piece-a"]}'), []]) {
      expect(gradeArrangement({ slots }, key, context), JSON.stringify(slots)).toEqual(invalid);
    }
    for (const response of [null, undefined, [], 'x', {}, { slots: null }, { slots: 'x' }, { slots: { 'slot-one': ['piece-a'] }, extra: 1 }, poisoned('{"slots":{"slot-one":["piece-a"]},"__proto__":{}}')]) {
      expect(gradeArrangement(response, key, context), JSON.stringify(response)).toEqual(invalid);
    }
    const hostile = { pieceIds: ['piece-a', 'piece-b'], slotIds: ['constructor', 'slot-two'] };
    expect(gradeArrangement({ slots: { constructor: ['piece-a'] } }, undefined, hostile)).toEqual(valid);
    expect(gradeArrangement({ slots: { 'slot-two': ['piece-a'] } }, { solutions: [{ constructor: ['piece-a'] }] }, hostile)).toEqual(review('value'));
    expect(gradeArrangement({ slots: { constructor: ['piece-a'] } }, { solutions: [{ constructor: ['piece-a'] }] }, hostile)).toEqual(met);
  });

  it('refuses huge or hostile inputs quickly', () => {
    const started = Date.now();
    const crowd = Object.fromEntries(Array.from({ length: 20_000 }, (_, index) => [`slot-${index}`, ['piece-a']]));
    expect(gradeArrangement({ slots: crowd }, key, context)).toEqual(invalid);
    expect(gradeArrangement({ slots: { 'slot-one': Array.from({ length: 100_000 }, () => 'piece-a') } }, key, context)).toEqual(invalid);
    expect(gradeArrangement({ slots: { 'slot-one': ['piece-a'] } }, { solutions: Array.from({ length: 9 }, () => key.solutions[0]) }, context)).toEqual(invalid);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('refuses a malformed context or rubric', () => {
    const response = place({ 'slot-one': ['piece-a'] });
    for (const bad of [undefined, null, {}, { pieceIds: ['piece-a'] }, { slotIds: ['slot-one'] }, { ...context, pieceIds: ['piece-a', 'piece-a'] }, { ...context, slotIds: ['slot-one', 'slot-one'] },
      { ...context, pieceIds: ['Piece A'] }, { ...context, pieceIds: ['__proto__'] }, { ...context, pieceIds: [] }, { ...context, capacities: { 'slot-nine': 1 } },
      { ...context, capacities: { 'slot-one': 0 } }, { ...context, capacities: { 'slot-one': 33 } }, { ...context, capacities: { 'slot-one': 1.5 } },
      { ...context, capacities: poisoned('{"__proto__":2}') }, { ...context, repeatable: 'yes' }, { ...context, extra: 1 },
      { ...context, pieceIds: Array.from({ length: 65 }, (_, index) => `piece-${index}`) }, { ...context, slotIds: Array.from({ length: 33 }, (_, index) => `slot-${index}`) }]) {
      expect(gradeArrangement(response, undefined, bad), JSON.stringify(bad)).toEqual(invalid);
    }
    for (const bad of [{}, { solutions: [] }, { solutions: [{}] }, { solutions: [{ 'slot-one': [] }] }, { solutions: [{ 'slot-one': ['piece-a'], 'slot-two': ['piece-a'] }] },
      { solutions: [{ 'slot-nine': ['piece-a'] }] }, { solutions: [{ 'slot-one': ['piece-a', 'piece-b', 'piece-c'] }] }, { solutions: [{ 'slot-one': ['piece-a'] }], ordered: 'yes' },
      { solutions: [{ 'slot-one': ['piece-a'] }], extra: 1 }, { solutions: 'x' }, null, []]) {
      expect(gradeArrangement(response, bad, context), JSON.stringify(bad)).toEqual(invalid);
    }
  });

  it('gives a sample response that is never invalid, and none for a malformed key', () => {
    expect(gradeArrangement(sampleArrangement(key, context), key, context)).toEqual(met);
    expect(gradeArrangement(sampleArrangement({ ...key, ordered: true }, context), { ...key, ordered: true }, context)).toEqual(met);
    expect(sampleArrangement({ solutions: [] }, context)).toBeNull();
    expect(sampleArrangement(key)).toBeNull();
  });
});

describe('answer shape dispatch, samples and schemas', () => {
  const cases: Array<[V2AnswerShapeId, unknown, unknown]> = [
    ['number.tolerance', { target: '4.5', tolerance: { absolute: '0.25' }, review: { absolute: '1' } }, { minimum: '0', maximum: '10' }],
    ['points.set', { required: [{ x: 1, y: 1 }, { x: 4, y: -2 }], forbidden: [{ x: 0, y: 0 }], snap: 0.5, extra: 'forbid' }, { minimumX: -5, maximumX: 5, minimumY: -5, maximumY: 5, step: 0.5 }],
    ['curve.parameters', { family: 'quadratic', target: { a: '1', b: '-2', c: '1' }, by: 'both', samples: [-1, 0, 1, 2], parameter_tolerance: { absolute: '0.1' }, curve_tolerance: { absolute: '0.2' } }, { families: ['line', 'quadratic'] }],
    ['arrangement.slots', { solutions: [{ 'slot-one': ['piece-a'], 'slot-two': ['piece-b', 'piece-c'] }], ordered: true }, { pieceIds: ['piece-a', 'piece-b', 'piece-c'], slotIds: ['slot-one', 'slot-two'], capacities: { 'slot-two': 2 } }],
  ];

  it('lists four shapes, recognises them and refuses any other id', () => {
    expect([...V2_ANSWER_SHAPE_IDS]).toEqual(['number.tolerance', 'points.set', 'curve.parameters', 'arrangement.slots']);
    for (const shape of V2_ANSWER_SHAPE_IDS) expect(isAnswerShapeId(shape)).toBe(true);
    for (const other of ['constructor', '__proto__', 'points', '', 7, null, undefined, {}]) expect(isAnswerShapeId(other)).toBe(false);
    expect(gradeAnswerShape('constructor' as V2AnswerShapeId, {}, {}, {})).toEqual(invalid);
    expect(answerShapeSample('constructor' as V2AnswerShapeId, {}, {})).toBeNull();
  });

  it('dispatches to the shape scorer and returns a grade the engine accepts as a V2Grade', () => {
    expect(gradeAnswerShape('number.tolerance', { value: '4.6' }, cases[0]![1], cases[0]![2])).toEqual(gradeNumberTolerance({ value: '4.6' }, cases[0]![1], cases[0]![2]));
    expect(gradeAnswerShape('points.set', { points: [{ x: 1, y: 1 }] }, cases[1]![1], cases[1]![2])).toEqual(gradePointSet({ points: [{ x: 1, y: 1 }] }, cases[1]![1], cases[1]![2]));
    expect(shapeGradeAsV2Grade(gradeAnswerShape('number.tolerance', { value: '4.5' }, cases[0]![1], cases[0]![2]))).toEqual(met);
  });

  it('builds a sample for every shape that its own scorer meets and its response schema accepts', () => {
    for (const [shape, rubric, context] of cases) {
      const sample = answerShapeSample(shape, rubric, context);
      expect(sample, shape).not.toBeNull();
      expect(gradeAnswerShape(shape, sample, rubric, context), shape).toEqual(met);
      expect(gradeAnswerShape(shape, sample, undefined, context), shape).toEqual(valid);
      expect(answerShapeResponseSchemas[shape].safeParse(sample).success, shape).toBe(true);
      expect(answerShapeRubricSchemas[shape].safeParse(rubric).success, shape).toBe(true);
      expect(answerShapeRubric(shape, context).safeParse(rubric).success, shape).toBe(true);
    }
  });

  it('rejects at the schema what the pure scorer calls malformed', () => {
    expect(answerShapeRubric('number.tolerance').safeParse({ target: '10', tolerance: { absolute: '2' }, review: { absolute: '1' } }).success).toBe(false);
    expect(answerShapeRubric('number.tolerance').safeParse({ target: '10', extra: 1 }).success).toBe(false);
    expect(answerShapeRubric('points.set').safeParse({ required: [{ x: 0, y: 0 }, { x: 0, y: 0 }] }).success).toBe(false);
    expect(answerShapeRubric('points.set').safeParse({ required: [{ x: Number.NaN, y: 0 }] }).success).toBe(false);
    expect(answerShapeRubric('points.set').safeParse({ required: [{ x: Number.POSITIVE_INFINITY, y: 0 }] }).success).toBe(false);
    expect(answerShapeRubric('curve.parameters').safeParse({ family: 'line', target: { m: '1', b: '0' }, by: 'curve' }).success).toBe(false);
    expect(answerShapeRubric('arrangement.slots', cases[3]![2]).safeParse({ solutions: [{ 'slot-nine': ['piece-a'] }] }).success).toBe(false);
    expect(answerShapeRubricSchemas['arrangement.slots'].safeParse({ solutions: [poisoned('{"__proto__":["piece-a"]}')] }).success).toBe(false);
    expect(answerShapeResponseSchemas['arrangement.slots'].safeParse({ slots: poisoned('{"__proto__":["piece-a"]}') }).success).toBe(false);
    expect(answerShapeResponseSchemas['arrangement.slots'].safeParse({ slots: poisoned('{"slot-one":["piece-a"],"__proto__":["piece-b"]}') }).success).toBe(false);
    expect(answerShapeRubricSchemas['curve.parameters'].safeParse({ family: 'line', target: poisoned('{"m":"1","b":"0","__proto__":"1"}') }).success).toBe(false);
    expect(answerShapeResponseSchemas['curve.parameters'].safeParse({ family: 'line', params: poisoned('{"m":"1","b":"0","__proto__":"1"}') }).success).toBe(false);
    expect(answerShapeRubricSchemas['number.tolerance'].safeParse(poisoned('{"target":"1","__proto__":{"absolute":"9"}}')).success).toBe(false);
    expect(answerShapeRubricSchemas['number.tolerance'].safeParse({ target: '1' }).success).toBe(true);
    expect(answerShapeResponseSchemas['points.set'].safeParse({ points: Array.from({ length: 65 }, () => ({ x: 0, y: 0 })) }).success).toBe(false);
  });

  it('never throws on junk and always answers inside the ladder', () => {
    const circular: Record<string, unknown> = {}; circular.self = circular;
    const junk: unknown[] = [undefined, null, 0, -0, 1, Number.NaN, Number.POSITIVE_INFINITY, '', 'x', '9'.repeat(100_000), true, 1n, Symbol('s'), () => 1, new Date(0), new Map(), new Set(), /x/, new Uint8Array(4),
      [], [[]], [[[[[[]]]]]], {}, { value: 1n }, circular, Object.create(null), Object.create({ value: '1' }), new Array(100_000).fill(0), poisoned('{"__proto__":{"polluted":true}}')];
    const ladder = new Set(['invalid', 'valid', 'review', 'met']);
    for (const shape of V2_ANSWER_SHAPE_IDS) {
      for (const response of junk) {
        for (const rubric of [undefined, ...junk]) {
          for (const context of [undefined, null, {}, ...cases.map((item) => item[2])]) {
            expect(ladder.has(gradeAnswerShape(shape, response, rubric, context).verdict)).toBe(true);
          }
        }
      }
    }
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
