import { describe, expect, it } from 'vitest';
import { gradeNumberTolerance, gradePointSet, sampleNumberTolerance, samplePointSet } from '../services/v2AnswerShapes.js';

const met = { verdict: 'met', diagnostic: 'none' };
const valid = { verdict: 'valid', diagnostic: 'none' };
const invalid = { verdict: 'invalid', diagnostic: 'none' };
const review = (diagnostic: string) => ({ verdict: 'review', diagnostic });
const poisoned = (text: string) => JSON.parse(text) as unknown;

describe('number with tolerance', () => {
  const rubric = { target: '10', tolerance: { absolute: '0.5' }, review: { absolute: '2' } };

  it('walks the whole verdict ladder: valid without a key, met inside the band, review near and far', () => {
    expect(gradeNumberTolerance({ value: '10' })).toEqual(valid);
    expect(gradeNumberTolerance({ value: '10.5' }, rubric)).toEqual(met);
    expect(gradeNumberTolerance({ value: '9.5' }, rubric)).toEqual(met);
    expect(gradeNumberTolerance({ value: '11.5' }, rubric)).toEqual(review('tolerance'));
    expect(gradeNumberTolerance({ value: '12' }, rubric)).toEqual(review('tolerance'));
    expect(gradeNumberTolerance({ value: '12.01' }, rubric)).toEqual(review('value'));
    expect(gradeNumberTolerance({ value: 'abc' }, rubric)).toEqual(invalid);
  });

  it('compares as exact rationals, so a tolerance edge never flips on float error', () => {
    const edge = { target: '0.3', tolerance: { absolute: '0.1' } };
    expect(gradeNumberTolerance({ value: '0.4' }, edge)).toEqual(met);
    expect(gradeNumberTolerance({ value: '0.2' }, edge)).toEqual(met);
    expect(gradeNumberTolerance({ value: '0.400000000001' }, edge)).toEqual(review('value'));
    expect(gradeNumberTolerance({ value: '1/3' }, { target: '0.333333333333', tolerance: { absolute: '0.000000000001' } })).toEqual(met);
  });

  it('takes the wider of the absolute and the relative tolerance', () => {
    const both = { target: '200', tolerance: { absolute: '1', relative_bps: 500 } };
    expect(gradeNumberTolerance({ value: '210' }, both)).toEqual(met);
    expect(gradeNumberTolerance({ value: '210.01' }, both)).toEqual(review('value'));
    expect(gradeNumberTolerance({ value: '-210' }, { target: '-200', tolerance: { relative_bps: 500 } })).toEqual(met);
    expect(gradeNumberTolerance({ value: '0.5' }, { target: '0', tolerance: { relative_bps: 9000 } })).toEqual(review('value'));
  });

  it('keeps an exact target when the key names no tolerance', () => {
    expect(gradeNumberTolerance({ value: '7' }, { target: '7' })).toEqual(met);
    expect(gradeNumberTolerance({ value: '7.000001' }, { target: '7' })).toEqual(review('value'));
  });

  it('enforces the payload bounds on the response and on the key', () => {
    const bounds = { minimum: '0', maximum: '100' };
    expect(gradeNumberTolerance({ value: '101' }, undefined, bounds)).toEqual(invalid);
    expect(gradeNumberTolerance({ value: '-1' }, undefined, bounds)).toEqual(invalid);
    expect(gradeNumberTolerance({ value: '50' }, undefined, bounds)).toEqual(valid);
    expect(gradeNumberTolerance({ value: '50' }, { target: '150' }, bounds)).toEqual(invalid);
    expect(gradeNumberTolerance({ value: '50' }, { target: '50', tolerance: { absolute: '100' } }, bounds)).toEqual(invalid);
    expect(gradeNumberTolerance({ value: '50' }, { target: '50' }, { minimum: '5', maximum: '1' })).toEqual(invalid);
    expect(gradeNumberTolerance({ value: '50' }, { target: '50' }, { minimum: '5', extra: 1 })).toEqual(invalid);
  });

  it('refuses a malformed rubric, never a guess', () => {
    for (const bad of [{}, { target: 10 }, { target: '10', tolerance: { absolute: '-1' } }, { target: '10', tolerance: { relative_bps: 10_001 } },
      { target: '10', tolerance: { relative_bps: 1.5 } }, { target: '10', tolerance: { absolute: '1', extra: 1 } }, { target: '10', review: { absolute: '0' } },
      { target: '10', tolerance: { absolute: '2' }, review: { absolute: '2' } }, { target: '10', tolerance: { absolute: '2' }, review: { absolute: '1' } },
      { target: '10', unknown: true }, null, [], 'x', 5]) {
      expect(gradeNumberTolerance({ value: '10' }, bad), JSON.stringify(bad)).toEqual(invalid);
    }
  });

  it('refuses adversarial responses: NaN, Infinity, exponents, huge text, wrong types, extra keys', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 10, null, undefined, '', ' 10', '10 ', '1e3', 'NaN', 'Infinity', '-Infinity', '0x10', '+10', '010', '1,000',
      '99999999999999999999', '1.1234567890123', '9'.repeat(5000), '1/0', '-', '.5', '5.', {}, [], ['10']]) {
      expect(gradeNumberTolerance({ value }, rubric), String(value)).toEqual(invalid);
    }
    for (const response of [null, undefined, 5, '10', [], { value: '10', extra: '1' }, {}, poisoned('{"__proto__":{"value":"10"}}'), poisoned('{"value":"10","__proto__":{}}')]) {
      expect(gradeNumberTolerance(response, rubric), JSON.stringify(response)).toEqual(invalid);
    }
  });

  it('gives a sample response that is never invalid, and none for a malformed key', () => {
    expect(gradeNumberTolerance(sampleNumberTolerance(rubric), rubric)).toEqual(met);
    expect(sampleNumberTolerance({ target: 'x' })).toBeNull();
    expect(sampleNumberTolerance({ target: '5' }, { minimum: '6' })).toBeNull();
  });
});

describe('point set', () => {
  const rubric = { required: [{ x: 1, y: 2 }, { x: 5, y: 5 }, { x: -3, y: 0 }], snap: 0.25 };
  const frame = { minimumX: -10, maximumX: 10, minimumY: -10, maximumY: 10 };
  const at = (...points: Array<[number, number]>) => ({ points: points.map(([x, y]) => ({ x, y })) });

  it('walks the whole verdict ladder', () => {
    expect(gradePointSet(at([1, 2]))).toEqual(valid);
    expect(gradePointSet(at([-3, 0], [1, 2], [5, 5]), rubric)).toEqual(met);
    expect(gradePointSet(at([1, 2], [5, 5]), rubric)).toEqual(review('miss'));
    expect(gradePointSet(at([1, 2], [5, 5], [-3, 0], [9, 9]), rubric)).toEqual(review('false_alarm'));
    expect(gradePointSet(at([1, 2], [9, 9]), rubric)).toEqual(review('partial'));
    expect(gradePointSet(at([8, 8]), rubric)).toEqual(review('value'));
    expect(gradePointSet({ points: [] }, rubric)).toEqual(invalid);
  });

  it('is order independent and uses the snap radius inclusively', () => {
    expect(gradePointSet(at([5.25, 5], [-3, -0.25], [1.25, 2]), rubric)).toEqual(met);
    expect(gradePointSet(at([5.26, 5], [-3, 0], [1, 2]), rubric)).toEqual(review('partial'));
    expect(gradePointSet(at([5.2, 5.2], [-3, 0], [1, 2]), rubric)).toEqual(review('partial'));
    expect(gradePointSet(at([1, 2]), { required: [{ x: 1, y: 2 }] })).toEqual(met);
    expect(gradePointSet(at([1.000001, 2]), { required: [{ x: 1, y: 2 }] })).toEqual(review('value'));
  });

  it('treats a second point near an already matched required point as extra, not as a second hit', () => {
    expect(gradePointSet(at([1, 2], [1.1, 2], [5, 5], [-3, 0]), rubric)).toEqual(review('false_alarm'));
    expect(gradePointSet(at([1, 2], [1.1, 2], [5, 5], [-3, 0]), { ...rubric, extra: 'allow' })).toEqual(met);
    expect(gradePointSet(at([1, 2], [1.1, 2]), rubric)).toEqual(review('partial'));
  });

  it('handles forbidden points: any hit is a false alarm even when extras are allowed', () => {
    const key = { required: [{ x: 0, y: 0 }], forbidden: [{ x: 3, y: 3 }], snap: 0.5, extra: 'allow' };
    expect(gradePointSet(at([0, 0], [7, 7]), key)).toEqual(met);
    expect(gradePointSet(at([0, 0], [3.2, 3]), key)).toEqual(review('false_alarm'));
    expect(gradePointSet(at([3, 3]), key)).toEqual(review('value'));
    expect(gradePointSet(at([3, 3], [0.1, 0]), key)).toEqual(review('false_alarm'));
  });

  it('bounds the response by the frame, the grid step and the point cap', () => {
    const grid = { ...frame, step: 1, maxPoints: 3 };
    expect(gradePointSet(at([11, 0]), undefined, grid)).toEqual(invalid);
    expect(gradePointSet(at([0.5, 0]), undefined, grid)).toEqual(invalid);
    expect(gradePointSet(at([0, 0], [1, 1], [2, 2]), undefined, grid)).toEqual(valid);
    expect(gradePointSet(at([0, 0], [1, 1], [2, 2], [3, 3]), undefined, grid)).toEqual(invalid);
    expect(gradePointSet(at([1, 2]), { required: [{ x: 1.5, y: 2 }] }, grid)).toEqual(invalid);
    expect(gradePointSet(at([1, 2]), { required: [{ x: 1, y: 2 }] }, { ...frame, maximumX: -10 })).toEqual(invalid);
    expect(gradePointSet(at([1, 2]), { required: [{ x: 1, y: 2 }] }, { ...frame, step: 0 })).toEqual(invalid);
    expect(gradePointSet(at([1, 2]), { required: [{ x: 1, y: 2 }] }, { ...frame, extra: 1 })).toEqual(invalid);
  });

  it('refuses a malformed or ambiguous rubric', () => {
    const bad: unknown[] = [{}, { required: [] }, { required: [{ x: 1, y: 2 }], snap: -1 }, { required: [{ x: 1, y: 2 }], snap: 1001 },
      { required: [{ x: 1, y: 2 }], snap: Number.NaN }, { required: [{ x: 1, y: 2 }], extra: 'maybe' }, { required: [{ x: 1, y: 2 }, { x: 1, y: 2 }] },
      { required: [{ x: 0, y: 0 }, { x: 0.4, y: 0 }], snap: 0.25 }, { required: [{ x: 0, y: 0 }], forbidden: [{ x: 0.2, y: 0 }], snap: 0.25 },
      { required: [{ x: 1, y: 2, z: 3 }] }, { required: [{ x: '1', y: 2 }] }, { required: Array.from({ length: 33 }, (_, index) => ({ x: index, y: 0 })) }, { required: [{ x: 1, y: 2 }], other: 1 }];
    for (const key of bad) expect(gradePointSet(at([1, 2]), key), JSON.stringify(key)).toEqual(invalid);
    expect(gradePointSet(at([0, 0], [3, 0]), { required: [{ x: 0, y: 0 }, { x: 3, y: 0 }], snap: 1.4 })).toEqual(met);
  });

  it('refuses adversarial responses: NaN, Infinity, huge coordinates, huge arrays, duplicates, prototype keys', () => {
    for (const x of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e9, -1e9, 100_001, 0.0000001, '1', null, undefined, 1n]) {
      expect(gradePointSet({ points: [{ x, y: 0 }] }, rubric), String(x)).toEqual(invalid);
    }
    expect(gradePointSet({ points: Array.from({ length: 5000 }, (_, index) => ({ x: index, y: 0 })) }, rubric)).toEqual(invalid);
    expect(gradePointSet({ points: Array.from({ length: 33 }, (_, index) => ({ x: index, y: 0 })) }, rubric)).toEqual(invalid);
    expect(gradePointSet(at([1, 2], [1, 2]), rubric)).toEqual(invalid);
    for (const response of [null, undefined, [], { points: 'x' }, { points: [[1, 2]] }, { points: [{ x: 1 }] }, { points: [{ x: 1, y: 2, extra: 3 }] }, { points: [{ x: 1, y: 2 }], extra: 1 },
      poisoned('{"points":[{"x":1,"y":2,"__proto__":{"x":1}}]}'), poisoned('{"__proto__":{"points":[{"x":1,"y":2}]}}'), poisoned('{"points":[{"x":1,"y":2}],"constructor":1}')]) {
      expect(gradePointSet(response, rubric), JSON.stringify(response)).toEqual(invalid);
    }
  });

  it('keeps coordinate arithmetic exact at the largest magnitude', () => {
    const far = { required: [{ x: 100_000, y: 100_000 }], snap: 0.000001 };
    expect(gradePointSet(at([100_000, 100_000]), far)).toEqual(met);
    expect(gradePointSet(at([99_999.999998, 100_000]), far)).toEqual(review('value'));
    expect(gradePointSet(at([99_999.999999, 100_000]), far)).toEqual(met);
  });

  it('gives a sample response that is never invalid, and none for a malformed key', () => {
    expect(gradePointSet(samplePointSet(rubric), rubric)).toEqual(met);
    expect(gradePointSet(samplePointSet(rubric, frame), rubric, frame)).toEqual(met);
    expect(samplePointSet({ required: [] })).toBeNull();
    expect(samplePointSet({ required: [{ x: 50, y: 0 }] }, frame)).toBeNull();
  });
});
