import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { ALG1_CAPABILITIES, alg1 } from '../../v2/horizonte/alg1.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const TILES = 'math.algebra-tiles.v2';
const CARDS = 'math.algebra-cards.v2';
const AREA = 'math.area-model.v2';
const note = (tex: string) => ({ tex, spokenText: 'spoken' });

const tiles = (counts: Record<string, number>, tex: string, visual = 'algebra-tiles') => ({
  id: 'seg-tiles', type: TILES, visual: { type: visual }, notation: note(tex),
  payload: { counts: { 'sq-pos': 0, 'sq-neg': 0, 'bar-pos': 0, 'bar-neg': 0, 'unit-pos': 0, 'unit-neg': 0, ...counts } },
});
const cards = (disguise: string, left: string[], right: string[], supply: string[], tex?: string, id = 'seg-cards') => ({
  id, type: CARDS, visual: { type: 'algebra-cards' }, ...(tex === undefined ? {} : { notation: note(tex) }), payload: { disguise, left, right, supply },
});
const area = (id: string, visual: string, tex: string, payload: Record<string, unknown>) => ({ id, type: AREA, visual: { type: visual }, notation: note(tex), payload });
const distribute = () => area('seg-area', 'area-distribute', '3(x+4)', { fill: 'cells', rows: ['0:3'], cols: ['1:1', '0:4'], pool: ['0:12', '1:3', '1:12', '0:7'] });
const factor = () => area('seg-area', 'area-binomial', 'x^2+5x+6', { fill: 'edges', cells: ['2:1', '1:3', '1:2', '0:6'], pool: ['1:1', '1:1', '0:2', '0:3', '0:5', '0:6'] });
const square = () => area('seg-area', 'area-square', 'x^2+6x+5', { fill: 'square', b: 6, c: 5, pool: ['0:9', '0:-4', '0:3', '0:4', '0:14'] });

const gates = (...segments: unknown[]) => horizontePieceGates({ segments } as never);
const findings = (segment: { id: string }, key?: unknown) => runSolvabilityGate({ segments: [segment] }, key === undefined ? undefined : { [segment.id]: key });

describe('alg1 pack in the Forge (F2.1 tiles, F2.2 cards, F2.3 area model)', () => {
  it('declares the capability literals and the emitter map spreads them', () => {
    expect(ALG1_CAPABILITIES[TILES]).toEqual(['visual.algebra-tiles.v1', 'operation.drag-chips.v1', 'operation.pair-tiles.v1', 'visual.math-notation.v1']);
    expect(ALG1_CAPABILITIES[CARDS]).toEqual(['visual.algebra-cards.v1', 'operation.drag-chips.v1', 'operation.balance-cards.v1', 'visual.math-notation.v1']);
    expect(ALG1_CAPABILITIES[AREA]).toEqual(['visual.area-model.v1', 'operation.drag-chips.v1', 'operation.fill-cells.v1', 'visual.math-notation.v1']);
    for (const type of [TILES, CARDS, AREA]) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(ALG1_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(ALG1_CAPABILITIES[type]);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(alg1);
  });

  it('adds authoring guidance only for the types a skeleton uses', () => {
    expect(horizonteGuidanceFor([TILES]).join('\n')).toMatch(/ages 11-15/);
    expect(horizonteGuidanceFor([CARDS]).join('\n')).toMatch(/ages 10-14/);
    expect(horizonteGuidanceFor([AREA]).join('\n')).toMatch(/ages 13-17/);
    expect(horizonteGuidanceFor([TILES]).join('\n')).not.toMatch(/ages 10-14/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('registers one solvability checker per type', () => {
    expect(registeredSolvabilityTypes()).toEqual(expect.arrayContaining([TILES, CARDS, AREA]));
  });

  describe('piece gates', () => {
    it('accept well formed boards', () => {
      expect(gates(tiles({ 'unit-pos': 5, 'unit-neg': 3 }, '5-3', 'signed-tiles'))).toEqual([]);
      expect(gates(tiles({ 'sq-pos': 2, 'sq-neg': 1, 'bar-pos': 3, 'bar-neg': 4, 'unit-pos': 2, 'unit-neg': 2 }, '2x^2 - x^2 + 3x - 4x + 2 - 2'))).toEqual([]);
      expect(gates(cards('picture', ['unk', 'pos-3'], ['pos-7'], ['neg-3']))).toEqual([]);
      expect(gates(cards('mixed', ['pos-7'], ['unk', 'pos-2'], ['neg-2'], '7=x+2'))).toEqual([]);
      expect(gates(distribute(), factor(), square())).toEqual([]);
    });

    it('refuse a malformed or inconsistent tiles board', () => {
      expect(gates(tiles({ 'unit-pos': 13, 'unit-neg': 1 }, '13-1', 'signed-tiles'))).toHaveLength(1);
      expect(gates(tiles({ 'unit-pos': 3 }, '3', 'signed-tiles'))[0]?.message).toMatch(/zero pair/);
      expect(gates(tiles({ 'unit-pos': 5, 'unit-neg': 3 }, '5-3'))[0]?.message).toMatch(/signed-tiles/);
      expect(gates(tiles({ 'bar-pos': 2, 'bar-neg': 1 }, '2x-x', 'signed-tiles'))[0]?.message).toMatch(/algebra-tiles/);
      expect(gates(tiles({ 'unit-pos': 5, 'unit-neg': 3 }, '5-4', 'signed-tiles'))[0]).toMatchObject({ gate: 4, segmentId: 'seg-tiles' });
    });

    it('refuse a card board with a missing notation, a wrong equation or a disguise that moves back', () => {
      expect(gates(cards('notation', ['unk', 'pos-3'], ['pos-7'], ['neg-3']))[0]?.message).toMatch(/Only the picture disguise/);
      expect(gates(cards('mixed', ['unk', 'pos-3'], ['pos-7'], ['neg-3'], 'x+3=8'))[0]?.message).toMatch(/x\+3=7/);
      expect(gates(cards('notation', ['unk', 'pos-3'], ['pos-7'], ['neg-3'], 'x+3=7', 'a'), cards('picture', ['unk', 'pos-4'], ['pos-9'], ['neg-4'], undefined, 'b'))[0])
        .toMatchObject({ gate: 4, segmentId: 'b', message: expect.stringMatching(/never back/) });
      expect(gates(cards('picture', ['unk', 'pos-10'], ['pos-7'], [])).length).toBeGreaterThan(0);
    });

    it('refuse an area model with the wrong visual or notation', () => {
      expect(gates({ ...distribute(), visual: { type: 'area-binomial' } })[0]?.message).toMatch(/area-distribute/);
      expect(gates({ ...square(), notation: note('x^2+6x+4') })[0]?.message).toMatch(/x\^2\+6x\+5/);
      expect(gates({ ...factor(), payload: { fill: 'edges', cells: ['2:1'], pool: [] } })[0]?.message).toMatch(/edges needs/);
    });
  });

  describe('solvability checkers', () => {
    it('prove the tiles answer is unique and judge the key', () => {
      const segment = tiles({ 'sq-pos': 2, 'sq-neg': 1, 'bar-pos': 3, 'bar-neg': 4, 'unit-pos': 2, 'unit-neg': 2 }, '');
      const key = { solutions: [{ mat: ['bar-neg', 'sq-pos'], zero: ['sq-pos', 'sq-neg', 'bar-pos', 'bar-pos', 'bar-pos', 'bar-neg', 'bar-neg', 'bar-neg', 'unit-pos', 'unit-pos', 'unit-neg', 'unit-neg'] }] };
      expect(findings(segment, key)).toEqual([]);
      expect(findings(segment)).toEqual([]);
      expect(findings(segment, { solutions: [{ mat: ['bar-neg', 'sq-pos'], zero: [] }] })[0]?.code).toBe('rubric-gap');
      expect(findings(tiles({ 'unit-pos': 4 }, ''))[0]?.code).toBe('no-solution');
    });

    it('derive every isolation of a card board and judge the key', () => {
      const segment = cards('picture', ['unk', 'pos-3'], ['pos-7'], ['neg-3']);
      expect(findings(segment, { solutions: [{ left: ['unk'], right: ['neg-3', 'pos-7'] }] })).toEqual([]);
      expect(findings(segment)).toEqual([]);
      expect(findings(segment, { solutions: [{ left: ['unk'], right: ['pos-4'] }] }).map((item) => item.code).sort()).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(findings(cards('picture', ['unk', 'pos-3'], ['pos-7'], ['neg-4']))[0]?.code).toBe('no-solution');
      expect(findings(cards('picture', ['unk'], ['pos-7'], ['neg-4']))[0]?.message).toMatch(/already alone/);
      expect(findings(cards('notation', ['pos-3', 'unk'], ['unk', 'unk'], ['unk-neg']), { solutions: [{ left: ['pos-3'], right: ['unk'] }] })).toEqual([]);
    });

    it('derive the placements of each area fill and judge the key', () => {
      expect(findings(distribute(), { solutions: [{ 'cell-0-0': ['1:3'], 'cell-0-1': ['0:12'] }] })).toEqual([]);
      expect(findings(factor(), { solutions: [{ 'row-0': ['1:1'], 'row-1': ['0:2'], 'col-0': ['1:1'], 'col-1': ['0:3'] }] })).toEqual([]);
      expect(findings(square(), { solutions: [{ corner: ['0:9'], constant: ['0:-4'] }] })).toEqual([]);
      expect(findings(distribute(), { solutions: [{ 'cell-0-0': ['1:3'], 'cell-0-1': ['0:7'] }] }).map((item) => item.code).sort()).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(findings(area('seg-area', 'area-distribute', '3(x+4)', { fill: 'cells', rows: ['0:3'], cols: ['1:1', '0:4'], pool: ['0:12', '0:7'] }))[0]?.code).toBe('no-solution');
      expect(findings(area('seg-area', 'area-square', 'x^2+6x+5', { fill: 'square', b: 6, c: 5, pool: ['0:9', '0:3'] }))[0]?.code).toBe('no-solution');
    });

    it('derive an edges board with repeated faces and refuse a key that swaps the factors', () => {
      const segment = area('seg-area', 'area-binomial', 'x^2+4x+4', { fill: 'edges', cells: ['2:1', '1:2', '1:2', '0:4'], pool: ['1:1', '0:2', '0:2', '1:1'] });
      expect(findings(segment, { solutions: [{ 'row-0': ['1:1'], 'row-1': ['0:2'], 'col-0': ['1:1'], 'col-1': ['0:2'] }] })).toEqual([]);
      const swapped = area('seg-area', 'area-binomial', 'x^2+5x+6', { fill: 'edges', cells: ['2:1', '1:2', '1:3', '0:6'], pool: ['1:1', '1:1', '0:2', '0:3'] });
      expect(findings(swapped, { solutions: [{ 'row-0': ['1:1'], 'row-1': ['0:3'], 'col-0': ['1:1'], 'col-1': ['0:2'] }] })).toEqual([]);
      expect(findings(swapped, { solutions: [{ 'row-0': ['1:1'], 'row-1': ['0:2'], 'col-0': ['1:1'], 'col-1': ['0:3'] }] }).map((item) => item.code).sort()).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    });

    it('refuse a malformed payload or key without throwing', () => {
      expect(findings({ id: 'seg-bad', type: TILES, payload: { counts: { 'sq-pos': 1 } } } as never)[0]?.code).toBe('impossible-state');
      expect(findings(distribute(), { solutions: 'nope' })[0]?.code).toBe('impossible-state');
      expect(findings(distribute(), { solutions: [{ nowhere: ['1:3'] }] })[0]?.code).toBe('impossible-state');
    });
  });
});
