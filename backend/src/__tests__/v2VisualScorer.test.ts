import { describe, expect, it } from 'vitest';
import { barModelUnknown, gradeV2Response, scoreV2Visual } from '../services/v2VisualScorer.js';

describe('canonical v2 visual scorer', () => {
  it('checks every complete 12-coin allocation and refuses impossible responses', () => {
    const payload = { total: 12, step: 1 };
    for (let save = 0; save <= 12; save++) for (let spend = 0; spend <= 12 - save; spend++) {
      const response = { save, spend, share: 12 - save - spend };
      expect(scoreV2Visual('money.allocation.v2', payload, response)).toBe('valid');
      expect(scoreV2Visual('money.allocation.v2', payload, response, { minimumSave: 4 }))
        .toBe(save >= 4 ? 'met' : 'review');
    }
    for (const response of [
      { save: 4, spend: 4, share: 3 }, { save: -1, spend: 13, share: 0 },
      { save: 4.5, spend: 4.5, share: 3 }, { save: 4, spend: 4, share: 4, score: 100 },
    ]) expect(scoreV2Visual('money.allocation.v2', payload, response, { minimumSave: 4 })).toBe('invalid');
    expect(scoreV2Visual('money.allocation.v2', payload, { save: 4, spend: 4, share: 4 }, { minimumSave: 13 })).toBe('invalid');
  });

  it('checks the entire whole-number line and rejects alternate encodings and off-grid values', () => {
    const payload = { minimum: 0, maximum: 10, step: 1 };
    for (let value = 0; value <= 10; value++) {
      expect(scoreV2Visual('math.number-line.whole.v2', payload, { value: String(value) })).toBe('valid');
      expect(scoreV2Visual('math.number-line.whole.v2', payload, { value: String(value) }, { target: 7 }))
        .toBe(value === 7 ? 'met' : 'review');
    }
    for (const value of ['07', '7.0', '1e1', '-1', '11', '9007199254740993']) {
      expect(scoreV2Visual('math.number-line.whole.v2', payload, { value }, { target: 7 })).toBe('invalid');
    }
    expect(scoreV2Visual('math.number-line.whole.v2', { minimum: 0, maximum: 10, step: 2 }, { value: '7' }, { target: 8 })).toBe('invalid');
    expect(scoreV2Visual('math.number-line.whole.v2', payload, { value: '7' }, { target: 12 })).toBe('invalid');
    expect(scoreV2Visual('math.number-line.whole.v2', payload, { value: '7', score: 100 }, { target: 7 })).toBe('invalid');
  });

  it('scores semantic fraction positions exactly on the public grid with a private tolerance', () => {
    const payload = { maximumWhole: 1, divisions: 4 }, rubric = { targetNumerator: 3, targetDenominator: 4, toleranceUnits: 0 };
    expect(scoreV2Visual('math.number-line.fraction.v2', payload, { value: '3/4' })).toBe('valid');
    expect(scoreV2Visual('math.number-line.fraction.v2', payload, { value: '6/8' }, rubric)).toBe('met');
    expect(scoreV2Visual('math.number-line.fraction.v2', payload, { value: '1/2' }, rubric)).toBe('review');
    for (const value of ['0.75', '3/5', '-1/4']) expect(scoreV2Visual('math.number-line.fraction.v2', payload, { value }, rubric)).toBe('invalid');
    expect(scoreV2Visual('math.number-line.fraction.v2', payload, { value: '4/4' }, rubric)).toBe('review');
    expect(scoreV2Visual('math.number-line.fraction.v2', payload, { value: '3/4' }, { ...rubric, targetDenominator: 0 })).toBe('invalid');
  });

  it('accepts only equal-area fractions with a valid partition and equivalent private target', () => {
    const payload = { minimumParts: 2, maximumParts: 6 }, rubric = { targetNumerator: 1, targetDenominator: 2 };
    expect(scoreV2Visual('math.fraction-area.v2', payload, { n: 1, d: 2 })).toBe('valid');
    expect(scoreV2Visual('math.fraction-area.v2', payload, { n: 2, d: 4 }, rubric)).toBe('met');
    expect(scoreV2Visual('math.fraction-area.v2', payload, { n: 2, d: 3 }, rubric)).toBe('review');
    for (const response of [{ n: 3, d: 2 }, { n: 1, d: 7 }, { n: 1.5, d: 3 }, { n: 1, d: 2, score: 100 }]) {
      expect(scoreV2Visual('math.fraction-area.v2', payload, response, rubric)).toBe('invalid');
    }
  });

  it('keeps M7 structure and arithmetic as distinct semantic scores', () => {
    // "Ana has 12 more than Leo; together 50": a comparison with its total; Ana's bar carries no number.
    const payload = { quantityIds: ['together', 'ana-more'], values: [50, 12] };
    const key = { model: 'comparison', slots: { smaller: 'unknown', larger: null, difference: 'ana-more', total: 'together' } };
    expect(scoreV2Visual('math.bar-model.structure.v2', payload, key, key)).toBe('met');
    expect(scoreV2Visual('math.bar-model.answer.v2', payload, { value: '19' }, { target: 19 })).toBe('met');
    expect(gradeV2Response('math.bar-model.answer.v2', payload, { value: '18' }, { target: 19 })).toEqual({ verdict: 'review', diagnostic: 'value' });
    // A wrong model or a wrong slot is a structure error.
    expect(gradeV2Response('math.bar-model.structure.v2', payload, { model: 'part-whole', slots: { 'part-a': 'ana-more', 'part-b': 'unknown', whole: 'together' } }, key))
      .toEqual({ verdict: 'review', diagnostic: 'structure' });
    expect(gradeV2Response('math.bar-model.structure.v2', payload, { model: 'comparison', slots: { smaller: null, larger: 'unknown', difference: 'ana-more', total: 'together' } }, key))
      .toEqual({ verdict: 'review', diagnostic: 'structure' });
    expect(barModelUnknown(key.model, key.slots, { ids: payload.quantityIds, values: payload.values })).toBe(19);
  });

  it('M7 (GAP-FIX-R3): part-whole builds, parts in any order, three parts, and the refused incomplete builds', () => {
    const payload = { quantityIds: ['saved-may', 'saved-june'], values: [18, 25] };
    const key = { model: 'part-whole', slots: { 'part-a': 'saved-may', 'part-b': 'saved-june', whole: 'unknown' } };
    expect(scoreV2Visual('math.bar-model.structure.v2', payload, key, key)).toBe('met');
    expect(scoreV2Visual('math.bar-model.structure.v2', payload, { model: 'part-whole', slots: { 'part-a': 'saved-june', 'part-b': 'saved-may', whole: 'unknown' } }, key)).toBe('met');
    expect(scoreV2Visual('math.bar-model.structure.v2', payload, { model: 'part-whole', slots: { 'part-a': 'saved-may', 'part-b': 'unknown', whole: 'saved-june' } }, key)).toBe('review');
    expect(barModelUnknown('part-whole', key.slots, { ids: payload.quantityIds, values: payload.values })).toBe(43);
    const three = { quantityIds: ['coins-a', 'coins-b', 'coins-c'], values: [5, 7, 20] };
    const threeKey = { model: 'part-whole', slots: { 'part-a': 'coins-a', 'part-b': 'coins-b', 'part-c': 'unknown', whole: 'coins-c' } };
    expect(scoreV2Visual('math.bar-model.structure.v2', three, threeKey, threeKey)).toBe('met');
    expect(barModelUnknown('part-whole', threeKey.slots, { ids: three.quantityIds, values: three.values })).toBe(8);
    // The board starts empty: an empty, partial or duplicated build is not an answer.
    for (const response of [{ model: null, slots: {} }, { model: 'part-whole', slots: { 'part-a': 'saved-may', 'part-b': 'saved-june', whole: null } },
      { model: 'part-whole', slots: { 'part-a': 'saved-may', 'part-b': 'saved-may', whole: 'unknown' } }, { model: 'comparison', slots: { smaller: 'saved-may', larger: 'saved-june' } },
      { model: 'part-whole', slots: { 'part-a': 'saved-may', 'part-b': 'saved-june', whole: 'unknown' }, score: 100 }, { model: 'tape', slots: {} }]) {
      expect(scoreV2Visual('math.bar-model.structure.v2', payload, response, key), JSON.stringify(response)).toBe('invalid');
    }
    // A rubric whose lengths contradict each other (a part longer than its whole) is refused.
    expect(scoreV2Visual('math.bar-model.structure.v2', payload, key, { model: 'part-whole', slots: { 'part-a': 'saved-june', 'part-b': 'unknown', whole: 'saved-may' } })).toBe('invalid');
    expect(scoreV2Visual('math.bar-model.structure.v2', payload, key, { model: 'comparison', slots: { smaller: 'saved-june', larger: 'saved-may', difference: 'unknown' } })).toBe('invalid');
  });

  it('keeps M8 schema, slots, and answer as three semantic scores', () => {
    const payload = { quantityIds: ['earned', 'spent'], values: [24, 9] };
    const slots = { schema: 'change', slots: { start: 'earned', change: 'spent', result: 'unknown' } };
    expect(scoreV2Visual('math.schema-diagram.structure.v2', payload, { schema: 'change' }, { schema: 'change' })).toBe('met');
    expect(scoreV2Visual('math.schema-diagram.structure.v2', payload, { schema: 'compare' }, { schema: 'change' })).toBe('review');
    expect(scoreV2Visual('math.schema-diagram.slots.v2', payload, slots, slots)).toBe('met');
    expect(scoreV2Visual('math.schema-diagram.slots.v2', payload, { schema: 'change', slots: { start: 'spent', change: 'earned', result: 'unknown' } }, slots)).toBe('review');
    expect(scoreV2Visual('math.schema-diagram.answer.v2', payload, { value: '15' }, { target: 15 })).toBe('met');
  });

  it('grades all four M8 schemas: change, group, compare and ratio (GAP-FIX-R2)', () => {
    const payload = { quantityIds: ['price', 'tickets'], values: [6, 5] };
    const ratio = { schema: 'ratio', slots: { rate: 'price', count: 'tickets', total: 'unknown' } };
    for (const schema of ['change', 'group', 'compare', 'ratio']) {
      expect(scoreV2Visual('math.schema-diagram.structure.v2', payload, { schema }, { schema: 'ratio' })).toBe(schema === 'ratio' ? 'met' : 'review');
    }
    expect(gradeV2Response('math.schema-diagram.structure.v2', payload, { schema: 'group' }, { schema: 'ratio' }).diagnostic).toBe('structure');
    expect(scoreV2Visual('math.schema-diagram.slots.v2', payload, ratio, ratio)).toBe('met');
    // The group schema with the right numbers is a structure error; the ratio schema with swapped numbers a value error.
    expect(gradeV2Response('math.schema-diagram.slots.v2', payload, { schema: 'group', slots: { part: 'price', other: 'tickets', total: 'unknown' } }, ratio).diagnostic).toBe('structure');
    expect(gradeV2Response('math.schema-diagram.slots.v2', payload, { schema: 'ratio', slots: { rate: 'tickets', count: 'price', total: 'unknown' } }, ratio).diagnostic).toBe('value');
    // Impossible slot states: a slot from another schema, a number used twice, two unknowns, no unknown.
    expect(scoreV2Visual('math.schema-diagram.slots.v2', payload, { schema: 'ratio', slots: { start: 'price', count: 'tickets', total: 'unknown' } })).toBe('invalid');
    expect(scoreV2Visual('math.schema-diagram.slots.v2', payload, { schema: 'ratio', slots: { rate: 'price', count: 'price', total: 'unknown' } })).toBe('invalid');
    expect(scoreV2Visual('math.schema-diagram.slots.v2', payload, { schema: 'ratio', slots: { rate: 'unknown', count: 'unknown', total: 'price' } })).toBe('invalid');
    expect(scoreV2Visual('math.schema-diagram.slots.v2', payload, { schema: 'combine', slots: {} })).toBe('invalid');
    expect(scoreV2Visual('math.schema-diagram.answer.v2', payload, { value: '30' }, { target: 30 })).toBe('met');
    expect(scoreV2Visual('math.schema-diagram.answer.v2', payload, { value: '11' }, { target: 30 })).toBe('review');
    // A target that is no relation of the two quantities is a broken key.
    expect(scoreV2Visual('math.schema-diagram.answer.v2', payload, { value: '30' }, { target: 29 })).toBe('invalid');
  });

  it('scores every submitted M9/M10 step and rejects incomplete or widened responses', () => {
    const payload = { response_step_ids: ['discount-subtract', 'sale-price'] };
    const rubric = { expectedValues: { 'discount-subtract': '40', 'sale-price': '40' } };
    expect(scoreV2Visual('math.worked-example.v2', payload,
      { values: { 'discount-subtract': '40', 'sale-price': '40' } })).toBe('valid');
    expect(scoreV2Visual('math.worked-example.v2', payload,
      { values: { 'discount-subtract': '40', 'sale-price': '40' } }, rubric)).toBe('met');
    expect(scoreV2Visual('math.worked-example.v2', payload,
      { values: { 'discount-subtract': '39', 'sale-price': '40' } }, rubric)).toBe('review');
    expect(scoreV2Visual('math.worked-example.v2', payload,
      { values: { 'discount-subtract': '40' } }, rubric)).toBe('invalid');
    expect(scoreV2Visual('math.worked-example.v2', payload,
      { values: { 'discount-subtract': '40', 'sale-price': '40', extra: '40' } }, rubric)).toBe('invalid');
  });

  it('scores an M13 function rule only through private held-out inputs', () => {
    const payload = { multiplierMaximum: 9, offsetMaximum: 50, exampleInputs: [1, 2, 3] };
    const rubric = { multiplier: 5, offset: 10, heldOutInputs: [4, 6] };
    expect(scoreV2Visual('math.function-machine.v2', payload, { multiplier: '5', offset: '10' })).toBe('valid');
    expect(scoreV2Visual('math.function-machine.v2', payload, { multiplier: '5', offset: '10' }, rubric)).toBe('met');
    expect(scoreV2Visual('math.function-machine.v2', payload, { multiplier: '4', offset: '10' }, rubric)).toBe('review');
    expect(scoreV2Visual('math.function-machine.v2', payload, { multiplier: '5', offset: '10', extra: '1' }, rubric)).toBe('invalid');
    expect(scoreV2Visual('math.function-machine.v2', payload, { multiplier: '5', offset: '10' },
      { ...rubric, heldOutInputs: [3, 6] })).toBe('invalid');
  });
});
