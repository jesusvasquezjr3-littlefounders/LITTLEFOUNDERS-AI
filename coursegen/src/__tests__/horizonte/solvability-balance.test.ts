import { describe, expect, it } from 'vitest';
import { horizontePieceGates } from '../../v2/horizonte/index.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const BAL = 'math.equation-balance.v2';

type Pan = { x: number; u: number };
const segment = (l: Pan, r: Pan, ops: string[]) => ({ id: 'seg-bal', type: BAL, grading: 'server', visual: { type: 'equation-balance' }, payload: { start: { l, r }, ops } });
const findings = (target: ReturnType<typeof segment>, key?: unknown, nodeBudget?: number) =>
  runSolvabilityGate({ segments: [target] }, key === undefined ? undefined : { [target.id]: key }, nodeBudget === undefined ? {} : { nodeBudget });
const codes = (target: ReturnType<typeof segment>, key?: unknown, nodeBudget?: number) => findings(target, key, nodeBudget).map((finding) => finding.code).sort();

const OPS = ['sub-x', 'sub-unit', 'add-unit', 'div-2', 'slip-left'];
const START = { l: { x: 3, u: 2 }, r: { x: 1, u: 8 } };

describe('equation balance F0.4 checker', () => {
  it('is registered for the type', () => {
    expect(registeredSolvabilityTypes()).toContain(BAL);
  });

  it('accepts a solvable start with and without a key', () => {
    expect(codes(segment(START.l, START.r, OPS))).toEqual([]);
    expect(codes(segment(START.l, START.r, OPS), { x: 3 })).toEqual([]);
    expect(codes(segment({ x: 1, u: 5 }, { x: 2, u: 1 }, ['sub-x', 'sub-unit']), { x: 4 })).toEqual([]);
  });

  it('proves the route from the public pans alone, which the pack gate only does once a key exists', () => {
    const stuck = segment(START.l, START.r, ['sub-x', 'slip-right']);
    expect(codes(stuck)).toEqual(['no-solution']);
    expect(horizontePieceGates({ segments: [stuck] })).toEqual([]);
    expect(horizontePieceGates({ segments: [stuck] }, { 'seg-bal': { x: 3 } })).toHaveLength(1);
  });

  it('never counts a slip as progress', () => {
    expect(codes(segment(START.l, START.r, ['slip-left', 'slip-right']))).toEqual(['no-solution']);
  });

  it('refuses pans that hold for every x or for no x', () => {
    expect(codes(segment({ x: 2, u: 3 }, { x: 2, u: 3 }, OPS))).toEqual(['ambiguous-solution']);
    expect(codes(segment({ x: 2, u: 1 }, { x: 2, u: 5 }, OPS))).toEqual(['no-solution']);
  });

  it('refuses an answer that is not a whole number from 0 to 99', () => {
    expect(codes(segment({ x: 2, u: 0 }, { x: 0, u: 5 }, OPS))).toEqual(['no-solution']);
    expect(codes(segment({ x: 1, u: 5 }, { x: 0, u: 2 }, OPS))).toEqual(['no-solution']);
    expect(codes(segment({ x: 1, u: 0 }, { x: 0, u: 9 }, OPS))).toEqual(['impossible-state']);
  });

  it('refuses a start that is already solved, an empty board and a malformed payload', () => {
    expect(codes(segment({ x: 1, u: 0 }, { x: 0, u: 4 }, OPS))).toEqual(['impossible-state']);
    expect(codes(segment({ x: 0, u: 3 }, { x: 0, u: 3 }, OPS))).toContain('impossible-state');
    expect(codes(segment({ x: 9, u: 0 }, { x: 0, u: 1 }, OPS))).toEqual(['impossible-state']);
    expect(codes(segment(START.l, START.r, ['sub-x', 'sub-x']))).toContain('duplicate-id');
    expect(codes(segment(START.l, START.r, ['sub-x', 'dance']))).toContain('impossible-state');
    const noStart = { ...segment(START.l, START.r, OPS), payload: { ops: OPS } };
    expect(codes(noStart)).toEqual(['impossible-state']);
  });

  it('checks the key against the x the pans fix', () => {
    expect(codes(segment(START.l, START.r, OPS), { x: 4 })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(segment(START.l, START.r, OPS), { x: 3.5 })).toEqual(['impossible-state']);
    expect(codes(segment(START.l, START.r, OPS), { x: 3, extra: 1 })).toEqual(['impossible-state']);
    expect(codes(segment(START.l, START.r, OPS), { x: 100 })).toEqual(['impossible-state']);
    expect(codes(segment(START.l, START.r, OPS), null)).toEqual(['impossible-state']);
  });

  it('allows a route of exactly 16 offered moves and refuses one of 17', () => {
    const sixteen = segment({ x: 1, u: 16 }, { x: 0, u: 19 }, ['sub-unit']);
    const seventeen = segment({ x: 1, u: 17 }, { x: 0, u: 20 }, ['sub-unit']);
    expect(codes(sixteen)).toEqual([]);
    expect(codes(seventeen)).toEqual(['no-solution']);
    expect(horizontePieceGates({ segments: [seventeen] }, { 'seg-bal': { x: 3 } })).toHaveLength(1);
  });

  it('says so when the budget runs out instead of calling the board unsolvable', () => {
    const needsWork = segment({ x: 4, u: 12 }, { x: 2, u: 20 }, ['sub-x', 'sub-unit', 'add-unit', 'div-2']);
    expect(codes(needsWork)).toEqual([]);
    expect(codes(needsWork, undefined, 2)).toEqual(['budget-exceeded']);
  });

  it('agrees with the pack gate on every small board it can write a key for', () => {
    const sets = [OPS, ['sub-x', 'sub-unit'], ['sub-x'], ['sub-unit', 'div-2'], ['div-2', 'div-3'], ['sub-x', 'sub-unit', 'div-2', 'div-3', 'div-4', 'div-5']];
    let compared = 0;
    for (const lx of [0, 1, 2, 3]) for (const rx of [0, 1, 2, 4]) for (const lu of [0, 2, 3, 6, 12]) for (const ru of [0, 1, 4, 8, 12]) {
      for (const ops of sets) {
        const target = segment({ x: lx, u: lu }, { x: rx, u: ru }, ops);
        const slope = lx - rx;
        const rise = ru - lu;
        const x = slope !== 0 && rise % slope === 0 && rise / slope >= 0 ? rise / slope : 1;
        const pack = horizontePieceGates({ segments: [target] }, { 'seg-bal': { x } });
        expect(codes(target, { x }).length === 0, JSON.stringify(target.payload)).toBe(pack.length === 0);
        compared += 1;
      }
    }
    expect(compared).toBe(4 * 4 * 5 * 5 * sets.length);
  });
});
