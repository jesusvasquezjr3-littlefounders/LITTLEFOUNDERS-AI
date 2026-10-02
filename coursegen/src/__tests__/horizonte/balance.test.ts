import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { BALANCE_CAPABILITIES, balance } from '../../v2/horizonte/balance.js';

const BAL = 'math.equation-balance.v2';
const PRF = 'math.visual-proof.v2';

const balanceDoc = (start: unknown, ops: unknown, visual = 'equation-balance') => ({ segments: [{ id: 'seg-bal', type: BAL, visual: { type: visual }, payload: { start, ops } }] });
const proofDoc = (visual: string, payload: Record<string, unknown>) => ({ segments: [{ id: 'seg-prf', type: PRF, visual: { type: visual }, payload }] });
const gateBal = (document: ReturnType<typeof balanceDoc>, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-bal': key });
const gatePrf = (document: ReturnType<typeof proofDoc>, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-prf': key });

const START = { l: { x: 3, u: 2 }, r: { x: 1, u: 8 } };
const OPS = ['sub-x', 'sub-unit', 'add-unit', 'div-2', 'slip-left'];

describe('balance pack in the Forge (F1.8 equation balance, F1.15 visual proofs)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    expect(BALANCE_CAPABILITIES[BAL]).toEqual(['visual.equation-balance.v1', 'operation.balance-ops.v1', 'operation.number-input.v1', 'visual.math-notation.v1']);
    expect(BALANCE_CAPABILITIES[PRF]).toEqual(['visual.visual-proof.v1', 'operation.drag-pieces.v1', 'operation.predict-choice.v1', 'operation.number-input.v1']);
    for (const type of [BAL, PRF] as const) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(BALANCE_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(BALANCE_CAPABILITIES[type]);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(balance);
  });

  it('adds authoring guidance only when the skeleton uses the type', () => {
    expect(horizonteGuidanceFor([BAL]).join('\n')).toMatch(/ages 10-14 only/);
    expect(horizonteGuidanceFor([PRF]).join('\n')).toMatch(/predicts the formula before seeing/);
    expect(horizonteGuidanceFor([PRF]).join('\n')).not.toMatch(/ages 10-14/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  describe('equation balance solvability', () => {
    it('accepts a solvable start with its key, and a document with no key', () => {
      expect(gateBal(balanceDoc(START, OPS), { x: 3 })).toEqual([]);
      expect(gateBal(balanceDoc(START, OPS))).toEqual([]);
      expect(gateBal(balanceDoc({ l: { x: 1, u: 5 }, r: { x: 2, u: 1 } }, ['sub-x', 'sub-unit']), { x: 4 })).toEqual([]);
    });

    it('refuses a start the offered moves cannot solve', () => {
      const found = gateBal(balanceDoc(START, ['sub-x', 'slip-right']), { x: 3 });
      expect(found[0]).toMatchObject({ gate: 4, segmentId: 'seg-bal' });
      expect(found[0]?.message).toMatch(/cannot be solved/);
      expect(gateBal(balanceDoc(START, ['slip-left', 'slip-right']))).toHaveLength(1);
    });

    it('refuses a key that does not make the pans equal or is not a whole answer', () => {
      expect(gateBal(balanceDoc(START, OPS), { x: 4 })[0]?.message).toMatch(/does not make the two pans equal/);
      expect(gateBal(balanceDoc(START, OPS), { x: 3.5 })[0]?.message).toMatch(/whole number from 0 to 99/);
      expect(gateBal(balanceDoc(START, OPS), { x: 3, extra: 1 })[0]?.message).toMatch(/whole number from 0 to 99/);
      expect(gateBal(balanceDoc(START, OPS), { x: 100 })[0]?.message).toMatch(/whole number from 0 to 99/);
    });

    it('refuses a malformed start, offered list, visual, a solved start and equal x counts', () => {
      expect(gateBal(balanceDoc({ l: { x: 9, u: 0 }, r: { x: 0, u: 1 } }, OPS))[0]?.message).toMatch(/two pans/);
      expect(gateBal(balanceDoc({ l: { x: 0, u: 3 }, r: { x: 0, u: 3 } }, OPS))[0]?.message).toMatch(/two pans/);
      expect(gateBal(balanceDoc(START, ['sub-x', 'sub-x']))[0]?.message).toMatch(/distinct known operations/);
      expect(gateBal(balanceDoc(START, ['slip-left']))[0]?.message).toMatch(/distinct known operations/);
      expect(gateBal(balanceDoc(START, ['dance']))[0]?.message).toMatch(/distinct known operations/);
      expect(gateBal(balanceDoc(START, OPS, 'ten-frame'))[0]?.message).toMatch(/visual must be equation-balance/);
      expect(gateBal(balanceDoc({ l: { x: 1, u: 0 }, r: { x: 0, u: 4 } }, OPS))[0]?.message).toMatch(/already has x alone/);
      expect(gateBal(balanceDoc({ l: { x: 2, u: 1 }, r: { x: 2, u: 5 } }, OPS))[0]?.message).toMatch(/different x counts/);
    });
  });

  describe('visual proof key against geometry', () => {
    const parallelogram = { base: 6, height: 4, slant: 2, choices: ['base-plus-height', 'base-height', 'half-base-height'] };
    const circle = { radius: 5, sectors: [8, 16, 32], choices: ['pi-diameter', 'pi-r-squared', 'radius-squared'] };
    const pythagoras = { a: 6, b: 8, choices: ['legs-squares-sum', 'legs-sum', 'legs-product'] };

    it('accepts every visual with its exact key', () => {
      expect(gatePrf(proofDoc('parallelogram-area', parallelogram), { choice: 'base-height', value: '24' })).toEqual([]);
      expect(gatePrf(proofDoc('triangle-area', { base: 8, height: 5, apex: 3, choices: ['half-base-height', 'base-height', 'base-plus-height'] }), { choice: 'half-base-height', value: '20' })).toEqual([]);
      expect(gatePrf(proofDoc('triangle-area', { base: 7, height: 5, apex: 3, choices: ['half-base-height', 'base-height', 'base-plus-height'] }), { choice: 'half-base-height', value: '17.5' })).toEqual([]);
      expect(gatePrf(proofDoc('trapezoid-area', { top: 4, bottom: 10, height: 6, offset: 2, choices: ['half-sum-bases-height', 'sum-bases-height', 'half-base-height'] }), { choice: 'half-sum-bases-height', value: '42' })).toEqual([]);
      expect(gatePrf(proofDoc('circle-area', circle), { choice: 'pi-r-squared', value: '78.5' })).toEqual([]);
      expect(gatePrf(proofDoc('circle-area', { ...circle, radius: 2 }), { choice: 'pi-r-squared', value: '12.56' })).toEqual([]);
      expect(gatePrf(proofDoc('circumference-unroll', { diameter: 7, choices: ['pi-r-squared', 'pi-diameter', 'pi-radius'] }), { choice: 'pi-diameter', value: '21.98' })).toEqual([]);
      expect(gatePrf(proofDoc('pythagoras-proof', pythagoras), { choice: 'legs-squares-sum', value: '10' })).toEqual([]);
      expect(gatePrf(proofDoc('odd-sum-proof', { n: 5, choices: ['n-times-n', 'n-plus-n', 'n-times-two'] }), { choice: 'n-times-n', value: '25' })).toEqual([]);
      expect(gatePrf(proofDoc('parallelogram-area', parallelogram))).toEqual([]);
    });

    it('refuses a key that disagrees with the figure', () => {
      expect(gatePrf(proofDoc('parallelogram-area', parallelogram), { choice: 'base-height', value: '12' })[0]).toMatchObject({ gate: 4, segmentId: 'seg-prf' });
      expect(gatePrf(proofDoc('parallelogram-area', parallelogram), { choice: 'half-base-height', value: '24' })[0]?.message).toMatch(/does not fit the figure/);
      expect(gatePrf(proofDoc('circle-area', circle), { choice: 'pi-r-squared', value: '78.54' })[0]?.message).toMatch(/figure gives 78\.5, with pi as 3\.14/);
      expect(gatePrf(proofDoc('circle-area', circle), { choice: 'pi-r-squared', value: '78.50' })[0]?.message).toMatch(/figure gives 78\.5/);
      expect(gatePrf(proofDoc('pythagoras-proof', pythagoras), { choice: 'legs-squares-sum', value: '14' })[0]?.message).toMatch(/figure gives 10/);
      expect(gatePrf(proofDoc('parallelogram-area', parallelogram), { choice: 'base-height' })[0]?.message).toMatch(/\{ choice, value \}/);
    });

    it('refuses a payload that does not fit its visual', () => {
      expect(gatePrf(proofDoc('parallelogram-area', { ...parallelogram, slant: 6 }))[0]?.message).toMatch(/slant/);
      expect(gatePrf(proofDoc('parallelogram-area', { ...parallelogram, choices: ['base-plus-height', 'half-base-height', 'pi-radius'] }))[0]?.message).toMatch(/choices/);
      expect(gatePrf(proofDoc('parallelogram-area', { ...parallelogram, choices: ['base-height', 'base-height', 'half-base-height'] }))[0]?.message).toMatch(/choices/);
      expect(gatePrf(proofDoc('pythagoras-proof', { ...pythagoras, b: 7 }))[0]?.message).toMatch(/whole long side/);
      expect(gatePrf(proofDoc('circle-area', { ...circle, sectors: [8, 7] }))[0]?.message).toMatch(/slice counts/);
      expect(gatePrf(proofDoc('odd-sum-proof', { n: 9, choices: ['n-times-n', 'n-plus-n', 'n-times-two'] }))[0]?.message).toMatch(/n from 3 to 7/);
      expect(gatePrf(proofDoc('rhombus-area', parallelogram))[0]?.message).toMatch(/seven proof figures/);
      expect(gatePrf(proofDoc('circumference-unroll', { diameter: 7, radius: 3, choices: ['pi-diameter', 'pi-radius', 'radius-squared'] }))[0]?.message).toMatch(/fields do not match/);
    });
  });

  it('ignores segment types it does not own and a document with no segments', () => {
    expect(horizontePieceGates({ segments: [{ id: 'seg-x', type: 'money.allocation.v2' }] })).toEqual([]);
    expect(horizontePieceGates({})).toEqual([]);
  });
});
