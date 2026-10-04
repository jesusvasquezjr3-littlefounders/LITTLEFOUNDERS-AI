import { describe, expect, it, vi } from 'vitest';
import '../../v2/solvabilityPacks.js';
import { runSolvabilityGate } from '../../v2/solvability.js';

vi.mock('../../v2/horizonte/plane1.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../v2/horizonte/plane1.js')>();
  return {
    ...real,
    solveSlope: () => ({ answer: 5 }),
    solveBreakEven: () => ({ answer: 20 }),
    solveLinked: () => ({ answer: { m: 3, b: 0 } }),
    solveElastic: () => ({ answer: 9 }),
    solveMarket: () => ({ answer: { direction: 'down' as const, price: 12 } }),
  };
});

const found = (type: string, payload: Record<string, unknown>) =>
  runSolvabilityGate({ segments: [{ id: 'seg-plane', type, grading: 'server', payload }] }).map((finding) => finding.code);

const breakEven = { fixed: 60, price: 5, unit: 2, maxUnits: 40, start: 5 };

describe('the plane1 scan against a model answer that is wrong', () => {
  it('names a model answer that is not the value the controls meet the goal at', () => {
    expect(found('alg.slope-triangle.v2', { grid: { xMax: 8, yMin: 0, yMax: 8 }, line: { from: { x: 1, y: 1 }, to: { x: 4, y: 7 } }, run: 3, start: 2 })).toEqual(['impossible-state']);
    expect(found('alg.linked-views.v2', { grid: { xMax: 6, yMin: 0, yMax: 20 }, given: [{ x: 1, y: 5 }, { x: 3, y: 9 }], start: { m: 1, b: 0 } })).toEqual(['impossible-state']);
    expect(found('econ.elasticity.v2', { pMax: 20, demand: { a: 90, b: 3 }, goal: { num: 1, den: 2 }, start: 4 })).toEqual(['impossible-state']);
    expect(found('econ.market-shift.v2', { pMax: 16, qMax: 80, demand: { a: 60, b: 4 }, supply: { c: 0, d: 2 }, shift: { curve: 'demand', by: 12 }, start: 10 })).toEqual(['impossible-state']);
  });

  it('accepts a model answer the controls agree with', () => {
    expect(found('fin.break-even.v2', breakEven)).toEqual([]);
  });

  it('names a board whose controls never meet the goal, and one that every control meets', () => {
    expect(found('fin.break-even.v2', { ...breakEven, fixed: 61 })).toEqual(['no-solution']);
    expect(found('fin.break-even.v2', { ...breakEven, fixed: 0, unit: 5 })).toEqual(['ambiguous-solution']);
    expect(found('econ.market-shift.v2', { pMax: 16, qMax: 80, demand: { a: 61, b: 4 }, supply: { c: 0, d: 2 }, shift: { curve: 'demand', by: 12 }, start: 10 })).toContain('no-solution');
  });
});
