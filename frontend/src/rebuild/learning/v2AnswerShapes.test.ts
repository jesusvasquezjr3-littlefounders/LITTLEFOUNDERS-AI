import { describe, expect, it } from 'vitest';
import { answerShapeSample, gradeAnswerShape, isAnswerShapeId, V2_ANSWER_SHAPE_IDS } from './v2AnswerShapes.generated';

const met = { verdict: 'met', diagnostic: 'none' };

describe('browser copy of the canonical v2 answer shapes', () => {
  it('lists the four shapes and refuses any other id', () => {
    expect([...V2_ANSWER_SHAPE_IDS]).toEqual(['number.tolerance', 'points.set', 'curve.parameters', 'arrangement.slots']);
    expect(isAnswerShapeId('constructor')).toBe(false);
  });

  it('grades a number with tolerance and a review band', () => {
    const rubric = { target: '4.5', tolerance: { absolute: '0.25' }, review: { absolute: '1' } };
    expect(gradeAnswerShape('number.tolerance', { value: '4.6' }, rubric)).toEqual(met);
    expect(gradeAnswerShape('number.tolerance', { value: '5.2' }, rubric)).toEqual({ verdict: 'review', diagnostic: 'tolerance' });
    expect(gradeAnswerShape('number.tolerance', { value: '8' }, rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
    expect(gradeAnswerShape('number.tolerance', { value: 'NaN' }, rubric).verdict).toBe('invalid');
  });

  it('grades a point set without regard to order', () => {
    const rubric = { required: [{ x: 1, y: 1 }, { x: 4, y: -2 }], snap: 0.5 };
    expect(gradeAnswerShape('points.set', { points: [{ x: 4.2, y: -2 }, { x: 1, y: 0.9 }] }, rubric)).toEqual(met);
    expect(gradeAnswerShape('points.set', { points: [{ x: 1, y: 1 }] }, rubric)).toEqual({ verdict: 'review', diagnostic: 'miss' });
  });

  it('grades curve parameters by parameters and by sampled curve', () => {
    const rubric = { family: 'line', target: { m: '2', b: '1' }, by: 'curve', samples: [-3, 0, 4] };
    expect(gradeAnswerShape('curve.parameters', { family: 'quadratic', params: { a: '0', b: '2', c: '1' } }, rubric)).toEqual(met);
    expect(gradeAnswerShape('curve.parameters', { family: 'line', params: { m: '2', b: '1.01' } }, rubric)).toEqual({ verdict: 'review', diagnostic: 'value' });
  });

  it('grades an arrangement against the slots and pieces of its context', () => {
    const context = { pieceIds: ['piece-a', 'piece-b', 'piece-c'], slotIds: ['slot-one', 'slot-two'], capacities: { 'slot-one': 2 } };
    const rubric = { solutions: [{ 'slot-one': ['piece-a', 'piece-b'], 'slot-two': ['piece-c'] }] };
    expect(gradeAnswerShape('arrangement.slots', { slots: { 'slot-one': ['piece-b', 'piece-a'], 'slot-two': ['piece-c'] } }, rubric, context)).toEqual(met);
    expect(gradeAnswerShape('arrangement.slots', { slots: { 'slot-one': ['piece-a', 'piece-b'] } }, rubric, context)).toEqual({ verdict: 'review', diagnostic: 'miss' });
    expect(gradeAnswerShape('arrangement.slots', { slots: { 'slot-one': ['piece-a'] } }, rubric)).toEqual({ verdict: 'invalid', diagnostic: 'none' });
  });

  it('builds a sample the shape meets, and stays total on hostile input', () => {
    const rubric = { target: '10' };
    expect(gradeAnswerShape('number.tolerance', answerShapeSample('number.tolerance', rubric), rubric)).toEqual(met);
    const hostile = JSON.parse('{"slots":{"__proto__":["piece-a"]}}') as unknown;
    expect(gradeAnswerShape('arrangement.slots', hostile, undefined, { pieceIds: ['piece-a'], slotIds: ['slot-one'] }).verdict).toBe('invalid');
    expect(gradeAnswerShape('points.set', { points: Array.from({ length: 5000 }, (_, index) => ({ x: index, y: 0 })) }).verdict).toBe('invalid');
  });
});
