import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { NUM_B_CAPABILITIES, numB } from '../../v2/horizonte/num-b.js';

const ARRAY = 'math.array-area.v2';
const RATIO = 'math.ratio-line.v2';
const WALL = 'math.fraction-wall.v2';
const CIRCLES = 'math.fraction-circles.v2';

const doc = (type: string, visual: string, payload: unknown, band = '10-12') => ({ age_band: band, segments: [{ id: 'seg', type, visual: { type: visual }, payload }] });
const gate = (document: ReturnType<typeof doc>, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { seg: key });

describe('num-b pack in the Forge (F1.4 arrays and area, F1.5 ratio, F1.6 fractions)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    for (const type of [ARRAY, RATIO, WALL, CIRCLES]) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type as keyof typeof HORIZONTE_FORGE_CAPABILITIES]).toEqual(NUM_B_CAPABILITIES[type as keyof typeof NUM_B_CAPABILITIES]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(NUM_B_CAPABILITIES[type as keyof typeof NUM_B_CAPABILITIES]);
    }
    expect(HORIZONTE_FORGE_PACKS).toContain(numB);
  });

  it('adds authoring guidance only for the types the skeleton uses', () => {
    expect(horizonteGuidanceFor([ARRAY]).join('\n')).toMatch(/area-division/);
    expect(horizonteGuidanceFor([RATIO]).join('\n')).toMatch(/ages 10-12 only/);
    expect(horizonteGuidanceFor([WALL]).join('\n')).toMatch(/"equivalent"/);
    expect(horizonteGuidanceFor([CIRCLES]).join('\n')).toMatch(/"compare"/);
    expect(horizonteGuidanceFor([CIRCLES]).join('\n')).not.toMatch(/fraction-bars/);
    expect(horizonteGuidanceFor([ARRAY]).join('\n')).not.toMatch(/ratio-tape/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  describe('array and area', () => {
    it('accepts the three visuals with their keys and a document with no key', () => {
      expect(gate(doc(ARRAY, 'array', { rows: 4, columns: 6 }, '6-9'), { value: 24 })).toEqual([]);
      expect(gate(doc(ARRAY, 'area-model', { across: 14, down: 7 }), { value: 98 })).toEqual([]);
      expect(gate(doc(ARRAY, 'area-division', { dividend: 84, divisor: 6 }), { value: 14 })).toEqual([]);
      expect(gate(doc(ARRAY, 'array', { rows: 4, columns: 6 }))).toEqual([]);
    });

    it('refuses a malformed payload, a mismatched visual, a wrong key and a band mismatch', () => {
      expect(gate(doc(ARRAY, 'array', { rows: 11, columns: 3 }))[0]).toMatchObject({ gate: 4, segmentId: 'seg' });
      expect(gate(doc(ARRAY, 'array', { rows: 3 }))).toHaveLength(1);
      expect(gate(doc(ARRAY, 'area-model', { across: 8, down: 7 }))).toHaveLength(1);
      expect(gate(doc(ARRAY, 'area-division', { dividend: 85, divisor: 6 }))).toHaveLength(1);
      expect(gate(doc(ARRAY, 'area-model', { rows: 4, columns: 6 }))[0]?.message).toMatch(/visual type must be array/);
      expect(gate(doc(ARRAY, 'array', { rows: 4, columns: 6 }), { value: 20 })[0]?.message).toMatch(/not the answer/);
      expect(gate(doc(ARRAY, 'array', { rows: 4, columns: 6 }), { value: '24' })[0]?.message).toMatch(/whole number/);
      expect(gate(doc(ARRAY, 'array', { rows: 4, columns: 6 }), { n: 24 })).toHaveLength(1);
      expect(gate(doc(ARRAY, 'area-model', { across: 14, down: 7 }, '6-9'), { value: 98 })[0]?.message).toMatch(/age band 10-12/);
      expect(gate(doc(ARRAY, 'array', { rows: 4, columns: 6 }, '13-17'), { value: 24 })[0]?.message).toMatch(/6-9 and 10-12/);
    });
  });

  describe('ratio line and tape', () => {
    const line = { units: ['coins', 'pencils'], base: [3, 2], given: { line: 'top', value: 12 } };
    const tape = { unit: 'stickers', parts: [2, 3], whole: 20, ask: 'b' };

    it('accepts a double line and a tape with their keys', () => {
      expect(gate(doc(RATIO, 'double-number-line', line), { value: 8 })).toEqual([]);
      expect(gate(doc(RATIO, 'double-number-line', { ...line, given: { line: 'bottom', value: 8 } }), { value: 12 })).toEqual([]);
      expect(gate(doc(RATIO, 'ratio-tape', tape), { value: 12 })).toEqual([]);
      expect(gate(doc(RATIO, 'ratio-tape', { ...tape, ask: 'a' }), { value: 8 })).toEqual([]);
    });

    it('refuses an unsolvable payload, a free unit, a wrong visual, a wrong key and the young band', () => {
      expect(gate(doc(RATIO, 'double-number-line', { ...line, given: { line: 'top', value: 10 } }))).toHaveLength(1);
      expect(gate(doc(RATIO, 'double-number-line', { ...line, given: { line: 'top', value: 3 } }))).toHaveLength(1);
      expect(gate(doc(RATIO, 'double-number-line', { ...line, units: ['coins', 'coins'] }))).toHaveLength(1);
      expect(gate(doc(RATIO, 'double-number-line', { ...line, units: ['coins', 'dollars'] }))).toHaveLength(1);
      expect(gate(doc(RATIO, 'ratio-tape', { ...tape, whole: 21 }))).toHaveLength(1);
      expect(gate(doc(RATIO, 'ratio-tape', { ...tape, parts: [9, 9] }))).toHaveLength(1);
      expect(gate(doc(RATIO, 'ratio-tape', { ...tape, ask: 'c' }))).toHaveLength(1);
      expect(gate(doc(RATIO, 'ratio-tape', line))).toHaveLength(1);
      expect(gate(doc(RATIO, 'double-number-line', tape))).toHaveLength(1);
      expect(gate(doc(RATIO, 'ratio-tape', tape))).toEqual([]);
      expect(gate(doc(RATIO, 'double-number-line', line), { value: 18 })[0]?.message).toMatch(/not the answer/);
      expect(gate(doc(RATIO, 'ratio-tape', tape, '6-9'))[0]?.message).toMatch(/age band 10-12/);
    });
  });

  describe('fraction wall and operations', () => {
    it('accepts every operation with a reachable key', () => {
      expect(gate(doc(WALL, 'fraction-wall', { op: 'equivalent', fraction: [2, 3], denominator: 12 }, '6-9'), { n: 8, d: 12 })).toEqual([]);
      expect(gate(doc(WALL, 'fraction-bars', { op: 'add', left: [1, 3], right: [1, 4] }), { n: 7, d: 12 })).toEqual([]);
      expect(gate(doc(WALL, 'fraction-bars', { op: 'subtract', left: [3, 4], right: [1, 6] }), { n: 7, d: 12 })).toEqual([]);
      expect(gate(doc(WALL, 'fraction-product', { op: 'multiply', left: [2, 3], right: [3, 4] }), { n: 1, d: 2 })).toEqual([]);
      expect(gate(doc(WALL, 'fraction-measure', { op: 'divide', left: [3, 4], right: [3, 8] }), { n: 2, d: 1 })).toEqual([]);
    });

    it('accepts an equivalent form for operations, and only the asked form for equivalent', () => {
      expect(gate(doc(WALL, 'fraction-bars', { op: 'add', left: [1, 3], right: [1, 4] }), { n: 14, d: 24 })).toEqual([]);
      expect(gate(doc(WALL, 'fraction-wall', { op: 'equivalent', fraction: [2, 3], denominator: 12 }, '6-9'), { n: 4, d: 6 })[0]?.message).toMatch(/not the result/);
    });

    it('refuses a malformed payload, a wrong visual, a wrong key and the young band', () => {
      expect(gate(doc(WALL, 'fraction-wall', { op: 'equivalent', fraction: [2, 3], denominator: 10 }, '6-9'))).toHaveLength(1);
      expect(gate(doc(WALL, 'fraction-wall', { op: 'equivalent', fraction: [3, 3], denominator: 6 }, '6-9'))).toHaveLength(1);
      expect(gate(doc(WALL, 'fraction-bars', { op: 'subtract', left: [1, 4], right: [3, 4] }))).toHaveLength(1);
      expect(gate(doc(WALL, 'fraction-measure', { op: 'divide', left: [1, 9], right: [1, 10] }))).toHaveLength(1);
      expect(gate(doc(WALL, 'fraction-product', { op: 'multiply', left: [1, 7], right: [1, 2] }))).toHaveLength(1);
      expect(gate(doc(WALL, 'fraction-bars', { op: 'power', left: [1, 2], right: [1, 3] }))).toHaveLength(1);
      expect(gate(doc(WALL, 'fraction-bars', { op: 'add', left: [1, 3] }))).toHaveLength(1);
      expect(gate(doc(WALL, 'fraction-wall', { op: 'add', left: [1, 3], right: [1, 4] }))[0]?.message).toMatch(/visual type must be fraction-bars/);
      expect(gate(doc(WALL, 'fraction-bars', { op: 'add', left: [1, 3], right: [1, 4] }), { n: 2, d: 7 })[0]?.message).toMatch(/not the result/);
      expect(gate(doc(WALL, 'fraction-bars', { op: 'add', left: [1, 3], right: [1, 4] }), { value: 7 })[0]?.message).toMatch(/\{n, d\}/);
      expect(gate(doc(WALL, 'fraction-bars', { op: 'add', left: [1, 3], right: [1, 4] }), { n: 0, d: 12 })[0]?.message).toMatch(/\{n, d\}/);
      expect(gate(doc(WALL, 'fraction-bars', { op: 'add', left: [1, 3], right: [1, 4] }, '6-9'))[0]?.message).toMatch(/age band 10-12/);
    });
  });

  describe('fraction circles', () => {
    it('accepts every operation with a reachable key', () => {
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'show', fraction: [3, 4] }, '6-9'), { n: 3, d: 4 })).toEqual([]);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'compare', left: [3, 8], right: [5, 8] }, '6-9'), { n: 5, d: 8 })).toEqual([]);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'add', left: [1, 8], right: [3, 8] }), { n: 1, d: 2 })).toEqual([]);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'subtract', left: [7, 10], right: [3, 10] }), { n: 2, d: 5 })).toEqual([]);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'add', left: [2, 6], right: [4, 6] }))).toEqual([]);
    });

    it('takes the exact form for show and any equal form for the other operations', () => {
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'show', fraction: [3, 4] }, '6-9'), { n: 6, d: 8 })[0]?.message).toMatch(/not the result/);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'add', left: [1, 8], right: [3, 8] }), { n: 4, d: 8 })).toEqual([]);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'compare', left: [3, 8], right: [5, 8] }, '6-9'), { n: 10, d: 16 })).toEqual([]);
    });

    it('refuses an unsolvable payload, a wrong visual, a wrong key and the young band for add and subtract', () => {
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'show', fraction: [4, 4] }, '6-9'))).toHaveLength(1);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'show', fraction: [1, 7] }, '6-9'))).toHaveLength(1);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'compare', left: [3, 8], right: [3, 8] }, '6-9'))).toHaveLength(1);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'compare', left: [3, 8], right: [1, 4] }, '6-9'))).toHaveLength(1);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'add', left: [5, 8], right: [5, 8] }))).toHaveLength(1);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'subtract', left: [3, 10], right: [7, 10] }))).toHaveLength(1);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'multiply', left: [1, 2], right: [1, 2] }))).toHaveLength(1);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'add', left: [1, 8] }))).toHaveLength(1);
      expect(gate(doc(CIRCLES, 'fraction-wall', { op: 'show', fraction: [3, 4] }, '6-9'))[0]?.message).toMatch(/visual type must be fraction-circles/);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'show', fraction: [3, 4] }, '6-9'), { n: 3, d: 5 })[0]?.message).toMatch(/not the result/);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'show', fraction: [3, 4] }, '6-9'), { value: 3 })[0]?.message).toMatch(/\{n, d\}/);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'show', fraction: [3, 4] }, '6-9'), { n: 0, d: 4 })[0]?.message).toMatch(/\{n, d\}/);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'add', left: [1, 8], right: [3, 8] }, '6-9'))[0]?.message).toMatch(/age band 10-12/);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'subtract', left: [7, 10], right: [3, 10] }, '6-9'))[0]?.message).toMatch(/age band 10-12/);
      expect(gate(doc(CIRCLES, 'fraction-circles', { op: 'show', fraction: [3, 4] }, '13-17'))[0]?.message).toMatch(/6-9 and 10-12/);
    });
  });

  it('leaves other segment types and a document without segments alone', () => {
    expect(horizontePieceGates({ age_band: '10-12', segments: [{ id: 's', type: 'money.allocation.v2', payload: {} }] })).toEqual([]);
    expect(numB.gates({ age_band: '10-12' })).toEqual([]);
  });
});
