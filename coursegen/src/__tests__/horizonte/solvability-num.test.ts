import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_EMITTED_HORIZONTE } from '../../v2/cli.js';
import { horizontePieceGates } from '../../v2/horizonte/index.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

type Payload = Record<string, unknown>;

const TEN_FRAME = 'math.ten-frame.v2';
const REKENREK = 'math.rekenrek.v2';
const ABACUS = 'math.abacus.v2';
const EMPTY_LINE = 'math.number-line.empty.v2';
const ZOOM_LINE = 'math.number-line.zoom.v2';
const ORDER_LINE = 'math.number-line.order.v2';
const CLOCK = 'math.clock.v2';
const RULER = 'math.ruler.v2';
const RULER_MEASURE = 'math.ruler.measure.v2';
const PAN_BALANCE = 'math.pan-balance.v2';
const ARRAY_AREA = 'math.array-area.v2';
const RATIO_LINE = 'math.ratio-line.v2';
const FRACTION_WALL = 'math.fraction-wall.v2';
const FRACTION_CIRCLES = 'math.fraction-circles.v2';

const TYPES = [TEN_FRAME, REKENREK, ABACUS, EMPTY_LINE, ZOOM_LINE, ORDER_LINE, CLOCK, RULER, RULER_MEASURE, PAN_BALANCE, ARRAY_AREA, RATIO_LINE, FRACTION_WALL, FRACTION_CIRCLES];

const segment = (type: string, payload: unknown) => ({ id: 'seg-num', type, grading: 'server', payload });
type Segment = ReturnType<typeof segment>;
const run = (target: Segment, key?: unknown, nodeBudget?: number) =>
  runSolvabilityGate({ segments: [target] }, key === undefined ? undefined : { [target.id]: key }, nodeBudget === undefined ? {} : { nodeBudget });
const codes = (type: string, payload: unknown, key?: unknown, nodeBudget?: number) => run(segment(type, payload), key, nodeBudget).map((finding) => finding.code).sort();
const timed = <T>(work: () => T): { value: T; ms: number } => {
  const started = performance.now();
  const value = work();
  return { value, ms: performance.now() - started };
};
const orderKey = (payload: { low: number; step: number; values: number[] }) =>
  ({ solutions: [Object.fromEntries(payload.values.map((units) => [`m-${(units - payload.low) / payload.step}`, [`n-${units}`]]))] });

const ORDER_TENS = { scale: 0, low: 0, step: 10, count: 10, values: [70, 30, 90, 50] };
const ORDER_TENTHS = { scale: 1, low: 0, step: 1, count: 10, values: [7, 2, 5] };
const ORDER_TEENS = { scale: 0, low: 0, step: 1, count: 20, values: [14, 7, 19] };
const ORDER_HUNDREDTHS = { scale: 2, low: 30, step: 1, count: 20, values: [45, 32, 40, 37] };

const FIXTURES: Array<{ name: string; type: string; payload: Payload; key: unknown }> = [
  { name: 'ten-frame make-ten', type: TEN_FRAME, payload: { start: [6] }, key: { target: [10] } },
  { name: 'ten-frame fill-first', type: TEN_FRAME, payload: { start: [8, 5] }, key: { target: [10, 3] } },
  { name: 'rekenrek seven', type: REKENREK, payload: { start: [0, 0] }, key: { target: [5, 2] } },
  { name: 'rekenrek ten', type: REKENREK, payload: { start: [6, 0] }, key: { target: [10, 0] } },
  { name: 'abacus forty-seven', type: ABACUS, payload: { start: [0, 0] }, key: { target: [4, 7] } },
  { name: 'abacus add-twenty', type: ABACUS, payload: { start: [3, 5] }, key: { target: [5, 5] } },
  { name: 'empty line jump-up', type: EMPTY_LINE, payload: { start: 47, sizes: [1, 5, 10, 20], max: 6 }, key: { target: 73 } },
  { name: 'empty line jump-back', type: EMPTY_LINE, payload: { start: 62, sizes: [1, 2, 10, 20], max: 4 }, key: { target: 38 } },
  { name: 'zoom tenths', type: ZOOM_LINE, payload: { low: 0, high: 10, depth: 1, start: 0 }, key: { target: 34 } },
  { name: 'zoom hundredths', type: ZOOM_LINE, payload: { low: 0, high: 5, depth: 2, start: 0 }, key: { target: 347 } },
  { name: 'order tens', type: ORDER_LINE, payload: ORDER_TENS, key: orderKey(ORDER_TENS) },
  { name: 'order tenths', type: ORDER_LINE, payload: ORDER_TENTHS, key: orderKey(ORDER_TENTHS) },
  { name: 'order teens', type: ORDER_LINE, payload: ORDER_TEENS, key: orderKey(ORDER_TEENS) },
  { name: 'order hundredths', type: ORDER_LINE, payload: ORDER_HUNDREDTHS, key: orderKey(ORDER_HUNDREDTHS) },
  { name: 'clock half-past', type: CLOCK, payload: { start: 0, step: 15 }, key: { target: 210 } },
  { name: 'clock later', type: CLOCK, payload: { start: 195, step: 5 }, key: { target: 220 } },
  { name: 'ruler six', type: RULER, payload: { unit: 'cm', from: 2, start: 3, max: 10 }, key: { target: 8 } },
  { name: 'ruler inches', type: RULER, payload: { unit: 'in', from: 3, start: 3, max: 9 }, key: { target: 7 } },
  { name: 'measure pencil', type: RULER_MEASURE, payload: { unit: 'cm', object: 'pencil', from: 0, to: 7, max: 10 }, key: { target: '7' } },
  { name: 'measure strip', type: RULER_MEASURE, payload: { unit: 'in', object: 'strip', from: 2, to: 8, max: 11 }, key: { target: '6' } },
  { name: 'balance it', type: PAN_BALANCE, payload: { left: [5], right: [], weights: [1, 2, 2, 3] }, key: { target: 0 } },
  { name: 'balance heavier', type: PAN_BALANCE, payload: { left: [4], right: [4], weights: [1, 2, 3] }, key: { target: 2 } },
  { name: 'array rows and columns', type: ARRAY_AREA, payload: { rows: 3, columns: 4 }, key: { value: 12 } },
  { name: 'area box', type: ARRAY_AREA, payload: { across: 14, down: 7 }, key: { value: 98 } },
  { name: 'area division', type: ARRAY_AREA, payload: { dividend: 156, divisor: 12 }, key: { value: 13 } },
  { name: 'double line scale', type: RATIO_LINE, payload: { units: ['pencils', 'coins'], base: [3, 6], given: { line: 'top', value: 12 } }, key: { value: 24 } },
  { name: 'ratio tape share', type: RATIO_LINE, payload: { unit: 'stickers', parts: [3, 2], whole: 30, ask: 'b' }, key: { value: 12 } },
  { name: 'wall equivalent', type: FRACTION_WALL, payload: { op: 'equivalent', fraction: [1, 2], denominator: 6 }, key: { n: 3, d: 6 } },
  { name: 'bars add', type: FRACTION_WALL, payload: { op: 'add', left: [1, 2], right: [1, 3] }, key: { n: 5, d: 6 } },
  { name: 'bars subtract', type: FRACTION_WALL, payload: { op: 'subtract', left: [3, 4], right: [1, 3] }, key: { n: 5, d: 12 } },
  { name: 'product grid', type: FRACTION_WALL, payload: { op: 'multiply', left: [2, 3], right: [3, 4] }, key: { n: 1, d: 2 } },
  { name: 'measure fit', type: FRACTION_WALL, payload: { op: 'divide', left: [5, 6], right: [1, 3] }, key: { n: 5, d: 2 } },
  { name: 'circles show', type: FRACTION_CIRCLES, payload: { op: 'show', fraction: [3, 4] }, key: { n: 3, d: 4 } },
  { name: 'circles compare', type: FRACTION_CIRCLES, payload: { op: 'compare', left: [3, 8], right: [5, 8] }, key: { n: 5, d: 8 } },
  { name: 'circles add', type: FRACTION_CIRCLES, payload: { op: 'add', left: [1, 8], right: [3, 8] }, key: { n: 1, d: 2 } },
  { name: 'circles subtract', type: FRACTION_CIRCLES, payload: { op: 'subtract', left: [7, 10], right: [3, 10] }, key: { n: 2, d: 5 } },
];

const GAP_AND_INVALID = ['rubric-accepts-invalid', 'rubric-gap'];

describe('Horizonte numbers solvability checkers (F0.4)', () => {
  describe('registration', () => {
    it('registers all fourteen types, and leaves the exempt AR table alone', () => {
      expect(TYPES).toHaveLength(14);
      for (const type of TYPES) expect(registeredSolvabilityTypes(), type).toContain(type);
      expect(registeredSolvabilityTypes()).not.toContain('space.ar-table.v2');
    });
  });

  describe('every Forge fixture', () => {
    it('passes with and without the key, and every type has at least one fixture', () => {
      expect([...new Set(FIXTURES.map((fixture) => fixture.type))].sort()).toEqual([...TYPES].sort());
      for (const fixture of FIXTURES) {
        expect(codes(fixture.type, fixture.payload), `${fixture.name} (no key)`).toEqual([]);
        expect(codes(fixture.type, fixture.payload, fixture.key), `${fixture.name} (key)`).toEqual([]);
      }
    });

    it('passes every committed row of emitted-horizonte.json, in all three markets', () => {
      const rows = JSON.parse(readFileSync(FIXTURE_EMITTED_HORIZONTE, 'utf8')) as Array<{ document: { segments: Array<{ id: string; type: string; grading?: string; payload: unknown }> }; answer_keys: Record<string, unknown> }>;
      const seen = new Set<string>();
      for (const row of rows) {
        for (const entry of row.document.segments.filter((candidate) => TYPES.includes(candidate.type))) {
          seen.add(entry.type);
          const minimal = { segments: [entry] };
          expect(runSolvabilityGate(minimal), entry.id).toEqual([]);
          expect(runSolvabilityGate(minimal, { [entry.id]: row.answer_keys[entry.id] }), entry.id).toEqual([]);
        }
      }
      expect([...seen].sort()).toEqual([...TYPES].sort());
    });
  });

  describe('math.ten-frame.v2', () => {
    it('refuses a frame that cannot move, from the public payload alone', () => {
      expect(codes(TEN_FRAME, { start: [10] })).toEqual(['no-solution']);
      expect(codes(TEN_FRAME, { start: [10, 10] })).toEqual(['no-solution']);
      expect(horizontePieceGates({ segments: [{ id: 'seg-num', type: TEN_FRAME, visual: { type: 'ten-frame' }, payload: { start: [10] } }] })).toEqual([]);
    });

    it('refuses a target the frame rule cannot reach', () => {
      expect(codes(TEN_FRAME, { start: [6] }, { target: [4] })).toEqual(['no-solution']);
      expect(codes(TEN_FRAME, { start: [8, 5] }, { target: [10, 4] })).toEqual(['no-solution']);
      expect(codes(TEN_FRAME, { start: [8, 5] }, { target: [8, 5] })).toEqual(['impossible-state']);
    });

    it('refuses a start that is already the target, a malformed payload and a malformed key', () => {
      expect(codes(TEN_FRAME, { start: [6] }, { target: [6] })).toEqual(['impossible-state']);
      for (const start of [[11], [-1], [], [1, 2, 3], [1.5], 'x', undefined]) expect(codes(TEN_FRAME, { start }), JSON.stringify(start)).toEqual(['impossible-state']);
      expect(codes(TEN_FRAME, {})).toEqual(['impossible-state']);
      for (const key of [{ target: [11] }, { target: [1, 2] }, { target: 10 }, { value: 10 }, null]) expect(codes(TEN_FRAME, { start: [6] }, key), JSON.stringify(key)).toEqual(['impossible-state']);
    });

    it('says so when the budget runs out', () => {
      const one = timed(() => codes(TEN_FRAME, { start: [6] }, { target: [10] }, 1));
      expect(one.value).toEqual(['budget-exceeded']);
      expect(one.ms).toBeLessThan(5000);
      expect(codes(TEN_FRAME, { start: [8, 5] }, { target: [10, 3] }, 2)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.rekenrek.v2', () => {
    it('refuses a start that is already the target or a target off the rows', () => {
      expect(codes(REKENREK, { start: [6, 0] }, { target: [6, 0] })).toEqual(['impossible-state']);
      for (const key of [{ target: [11, 0] }, { target: [5] }, { target: [0, 0, 0] }, { target: 'ten' }, {}, null]) expect(codes(REKENREK, { start: [6, 0] }, key), JSON.stringify(key)).toEqual(['impossible-state']);
    });

    it('refuses a malformed payload', () => {
      for (const start of [[0], [0, 11], [0, 0, 0], [0, -1], [0.5, 1], 'x', undefined]) expect(codes(REKENREK, { start }), JSON.stringify(start)).toEqual(['impossible-state']);
    });

    it('says so when the budget runs out', () => {
      expect(codes(REKENREK, { start: [0, 0] }, { target: [5, 2] }, 5)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.abacus.v2', () => {
    it('proves every digit of every rod reachable, including the hardest toggles', () => {
      expect(codes(ABACUS, { start: [9, 0, 5, 4] }, { target: [0, 9, 4, 5] })).toEqual([]);
      expect(codes(ABACUS, { start: [0] }, { target: [9] })).toEqual([]);
    });

    it('refuses a start that is already the target or a target off the rods', () => {
      expect(codes(ABACUS, { start: [3, 5] }, { target: [3, 5] })).toEqual(['impossible-state']);
      for (const key of [{ target: [3] }, { target: [3, 10] }, { target: [3, 5, 0] }, { target: 35 }, null]) expect(codes(ABACUS, { start: [3, 5] }, key), JSON.stringify(key)).toEqual(['impossible-state']);
    });

    it('refuses a malformed payload', () => {
      for (const start of [[], [1, 2, 3, 4, 5], [10], [-1], 'x', undefined]) expect(codes(ABACUS, { start }), JSON.stringify(start)).toEqual(['impossible-state']);
    });

    it('says so when the budget runs out', () => {
      expect(codes(ABACUS, { start: [0, 0] }, { target: [4, 7] }, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.number-line.empty.v2', () => {
    it('refuses a landing the jump cap and sizes cannot reach', () => {
      expect(codes(EMPTY_LINE, { start: 47, sizes: [10, 20], max: 2 }, { target: 48 })).toEqual(['no-solution']);
      expect(codes(EMPTY_LINE, { start: 47, sizes: [20, 50], max: 1 }, { target: 57 })).toEqual(['no-solution']);
      expect(codes(EMPTY_LINE, { start: 47, sizes: [20, 50], max: 1 }, { target: 67 })).toEqual([]);
    });

    it('refuses a start that is already the target, a target off the line and a malformed payload', () => {
      expect(codes(EMPTY_LINE, { start: 47, sizes: [1, 5], max: 3 }, { target: 47 })).toEqual(['impossible-state']);
      for (const key of [{ target: 1001 }, { target: -1 }, { target: 5.5 }, { target: '50' }, null]) expect(codes(EMPTY_LINE, { start: 47, sizes: [1, 5], max: 3 }, key), JSON.stringify(key)).toEqual(['impossible-state']);
      for (const payload of [{ start: 47, sizes: [3, 4], max: 3 }, { start: 47, sizes: [10], max: 3 }, { start: 47, sizes: [1, 5], max: 9 }, { start: 47, sizes: [1, 5], max: 0 }, { start: 1001, sizes: [1, 5], max: 3 }, { start: 47, sizes: [5, 5], max: 3 }, {}]) {
        expect(codes(EMPTY_LINE, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
      }
    });

    it('proves the largest allowed instance inside the default budget', () => {
      const big = timed(() => codes(EMPTY_LINE, { start: 500, sizes: [1, 2, 5, 10, 20, 50], max: 8 }, { target: 777 }));
      expect(big.value).toEqual([]);
      expect(big.ms).toBeLessThan(10000);
    });

    it('says so when the budget runs out', () => {
      expect(codes(EMPTY_LINE, { start: 47, sizes: [1, 5, 10, 20], max: 6 }, { target: 73 }, 20)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.number-line.zoom.v2', () => {
    it('reaches every grid point of a tenths window with the stepper and the zoom buttons', () => {
      for (let target = 1; target <= 100; target += 1) expect(codes(ZOOM_LINE, { low: 0, high: 10, depth: 1, start: 0 }, { target }), `target ${target}`).toEqual([]);
      for (let units = 20; units <= 120; units += 7) if (units !== 40) expect(codes(ZOOM_LINE, { low: 2, high: 12, depth: 1, start: 4 }, { target: units }), `target ${units}`).toEqual([]);
    });

    it('reaches sampled hundredths from a start in the middle of the window', () => {
      for (let target = 3; target <= 500; target += 53) if (target !== 200) expect(codes(ZOOM_LINE, { low: 0, high: 5, depth: 2, start: 2 }, { target }), `target ${target}`).toEqual([]);
      expect(codes(ZOOM_LINE, { low: 0, high: 5, depth: 2, start: 5 }, { target: 1 })).toEqual([]);
    });

    it('refuses a start that is already the target, a target off the grid and a malformed payload', () => {
      expect(codes(ZOOM_LINE, { low: 0, high: 10, depth: 1, start: 3 }, { target: 30 })).toEqual(['impossible-state']);
      for (const key of [{ target: 101 }, { target: -1 }, { target: 3.5 }, { target: '34' }, null]) expect(codes(ZOOM_LINE, { low: 0, high: 10, depth: 1, start: 0 }, key), JSON.stringify(key)).toEqual(['impossible-state']);
      for (const payload of [{ low: 0, high: 10, depth: 3, start: 0 }, { low: 0, high: 25, depth: 1, start: 0 }, { low: 0, high: 10, depth: 1, start: 11 }, { low: 5, high: 5, depth: 1, start: 5 }, { low: 0, high: 10, depth: 0, start: 0 }, {}]) {
        expect(codes(ZOOM_LINE, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
      }
    });

    it('says so when the budget runs out', () => {
      expect(codes(ZOOM_LINE, { low: 0, high: 10, depth: 1, start: 0 }, { target: 34 }, 10)).toEqual(['budget-exceeded']);
      expect(codes(ZOOM_LINE, { low: 0, high: 5, depth: 2, start: 0 }, { target: 347 }, 50)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.number-line.order.v2', () => {
    it('proves the numbers force one arrangement, from the public payload alone', () => {
      for (const payload of [ORDER_TENS, ORDER_TENTHS, ORDER_TEENS, ORDER_HUNDREDTHS]) expect(codes(ORDER_LINE, payload)).toEqual([]);
      expect(codes(ORDER_LINE, { scale: 0, low: 0, step: 1, count: 20, values: [2, 19] })).toEqual([]);
    });

    it('refuses a key that holds two arrangements, even a repeat of the right one', () => {
      const [truth] = orderKey(ORDER_TENS).solutions;
      expect(codes(ORDER_LINE, ORDER_TENS, { solutions: [truth, truth] })).toEqual(['ambiguous-solution']);
      expect(codes(ORDER_LINE, ORDER_TENS, { solutions: [truth, { ...truth, 'm-7': ['n-30'], 'm-3': ['n-70'] }] })).toEqual(['ambiguous-solution', 'rubric-accepts-invalid']);
    });

    it('refuses a key that is not the arrangement the numbers imply', () => {
      expect(codes(ORDER_LINE, ORDER_TENS, { solutions: [{ 'm-7': ['n-30'], 'm-3': ['n-70'], 'm-9': ['n-90'], 'm-5': ['n-50'] }] })).toEqual(GAP_AND_INVALID);
      expect(codes(ORDER_LINE, ORDER_TENS, { solutions: [{ 'm-7': ['n-70'], 'm-3': ['n-30'], 'm-9': ['n-90'] }] })).toEqual(GAP_AND_INVALID);
      expect(codes(ORDER_LINE, ORDER_TENS, { solutions: [] })).toEqual(['rubric-gap']);
      for (const key of [{ solutions: 'x' }, { solutions: [7] }, { solutions: [{ 'm-7': 'n-70' }] }, { target: 1 }, null]) expect(codes(ORDER_LINE, ORDER_TENS, key), JSON.stringify(key)).toEqual(['impossible-state']);
    });

    it('refuses a malformed payload', () => {
      for (const payload of [
        { ...ORDER_TENS, values: [75, 30] }, { ...ORDER_TENS, values: [70] }, { ...ORDER_TENS, values: [70, 70] }, { ...ORDER_TENS, count: 3 },
        { ...ORDER_TENS, scale: 3 }, { ...ORDER_TENS, values: [70, 30, 90, 50, 10, 20, 40] }, { ...ORDER_TENS, step: 0 }, { ...ORDER_TENS, values: [70, 300] }, {},
      ]) expect(codes(ORDER_LINE, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('leaves the tray order and the age band to the pack gate', () => {
      const ascending = { ...ORDER_TENS, values: [30, 50, 70] };
      expect(codes(ORDER_LINE, ascending)).toEqual([]);
      expect(horizontePieceGates({ age_band: '6-9', segments: [{ id: 'seg-num', type: ORDER_LINE, visual: { type: 'order-number-line' }, payload: ascending }] })).toHaveLength(1);
    });

    it('says so when the budget runs out', () => {
      expect(codes(ORDER_LINE, ORDER_HUNDREDTHS, undefined, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.clock.v2', () => {
    it('reaches every time of the step from every start hand position', () => {
      for (const target of [1, 11, 12, 13, 60, 359, 360, 361, 600, 719]) expect(codes(CLOCK, { start: 125, step: 1 }, { target }), `step 1 target ${target}`).toEqual([]);
      for (const target of [5, 30, 55, 60, 355, 715]) expect(codes(CLOCK, { start: 10, step: 5 }, { target }), `step 5 target ${target}`).toEqual([]);
      for (const target of [30, 90, 690]) expect(codes(CLOCK, { start: 15, step: 15 }, { target }), `step 15 target ${target}`).toEqual([]);
      expect(codes(CLOCK, { start: 30, step: 30 }, { target: 690 })).toEqual([]);
    });

    it('refuses a start that is already the target, a time off the step and a malformed payload', () => {
      expect(codes(CLOCK, { start: 195, step: 5 }, { target: 195 })).toEqual(['impossible-state']);
      for (const key of [{ target: 720 }, { target: 205 }, { target: -5 }, { target: '220' }, null]) expect(codes(CLOCK, { start: 195, step: 15 }, key), JSON.stringify(key)).toEqual(['impossible-state']);
      for (const payload of [{ start: 195, step: 7 }, { start: 17, step: 5 }, { start: 720, step: 5 }, { start: 195 }, {}]) expect(codes(CLOCK, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('says so when the budget runs out', () => {
      expect(codes(CLOCK, { start: 0, step: 15 }, { target: 210 }, 5)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.ruler.v2', () => {
    it('reaches every mark the bar can end on', () => {
      for (let target = 3; target <= 12; target += 1) expect(codes(RULER, { unit: 'cm', from: 2, start: 2, max: 12 }, { target }), `target ${target}`).toEqual([]);
    });

    it('refuses a start that is already the target, a mark off the ruler and a malformed payload', () => {
      expect(codes(RULER, { unit: 'cm', from: 2, start: 3, max: 10 }, { target: 3 })).toEqual(['impossible-state']);
      for (const key of [{ target: 2 }, { target: 11 }, { target: 0 }, { target: '8' }, null]) expect(codes(RULER, { unit: 'cm', from: 2, start: 3, max: 10 }, key), JSON.stringify(key)).toEqual(['impossible-state']);
      for (const payload of [{ unit: 'mm', from: 2, start: 3, max: 10 }, { unit: 'cm', from: 2, start: 3, max: 3 }, { unit: 'cm', from: 2, start: 1, max: 10 }, { unit: 'cm', from: 10, start: 10, max: 10 }, { unit: 'cm', from: 2, start: 3, max: 13 }, {}]) {
        expect(codes(RULER, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
      }
    });

    it('says so when the budget runs out', () => {
      expect(codes(RULER, { unit: 'cm', from: 2, start: 3, max: 10 }, { target: 8 }, 2)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.ruler.measure.v2', () => {
    it('proves the reading is the far mark minus the near mark, from the public payload alone', () => {
      expect(codes(RULER_MEASURE, { unit: 'cm', object: 'pencil', from: 3, to: 11, max: 12 })).toEqual([]);
      expect(codes(RULER_MEASURE, { unit: 'cm', object: 'pencil', from: 3, to: 11, max: 12 }, { target: '8' })).toEqual([]);
    });

    it('refuses a key that is not the length, so a correct reading would be graded wrong', () => {
      const payload = { unit: 'cm', object: 'pencil', from: 2, to: 9, max: 10 };
      expect(codes(RULER_MEASURE, payload, { target: '9' })).toEqual(GAP_AND_INVALID);
      expect(codes(RULER_MEASURE, payload, { target: '07' })).toEqual(GAP_AND_INVALID);
      for (const key of [{ target: 7 }, { target: ['7'] }, { value: '7' }, null]) expect(codes(RULER_MEASURE, payload, key), JSON.stringify(key)).toEqual(['impossible-state']);
    });

    it('refuses an object with no length, one off the ruler and a malformed payload', () => {
      for (const payload of [
        { unit: 'cm', object: 'pencil', from: 5, to: 5, max: 10 }, { unit: 'cm', object: 'pencil', from: 6, to: 5, max: 10 }, { unit: 'cm', object: 'pencil', from: 2, to: 11, max: 10 },
        { unit: 'cm', object: 'spoon', from: 2, to: 9, max: 10 }, { unit: 'mm', object: 'pencil', from: 2, to: 9, max: 10 }, { unit: 'cm', object: 'pencil', from: 2, to: 9, max: 13 }, {},
      ]) expect(codes(RULER_MEASURE, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('says so when the budget runs out', () => {
      expect(codes(RULER_MEASURE, { unit: 'cm', object: 'pencil', from: 0, to: 7, max: 10 }, { target: '7' }, 2)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.pan-balance.v2', () => {
    it('proves several placements can make the target, where any of them is accepted by design', () => {
      expect(codes(PAN_BALANCE, { left: [5], right: [], weights: [1, 2, 2, 3] }, { target: 0 })).toEqual([]);
      expect(codes(PAN_BALANCE, { left: [5], right: [], weights: [1, 2, 2, 3] }, { target: 13 })).toEqual([]);
      expect(codes(PAN_BALANCE, { left: [], right: [], weights: [20, 20, 20, 20, 20, 20] }, { target: -120 })).toEqual([]);
    });

    it('refuses a difference no placement can make', () => {
      expect(codes(PAN_BALANCE, { left: [5], right: [], weights: [1, 2, 2, 3] }, { target: 99 })).toEqual(['no-solution']);
      expect(codes(PAN_BALANCE, { left: [4], right: [4], weights: [2, 4] }, { target: 1 })).toEqual(['no-solution']);
    });

    it('refuses a target that equals the tray-only difference, so the board starts solved', () => {
      expect(codes(PAN_BALANCE, { left: [5], right: [], weights: [1, 2, 2, 3] }, { target: 5 })).toEqual(['impossible-state']);
      expect(codes(PAN_BALANCE, { left: [4], right: [4], weights: [1, 2, 3] }, { target: 0 })).toEqual(['impossible-state']);
    });

    it('refuses a malformed key and a malformed payload', () => {
      for (const key of [{ target: 1.5 }, { target: '0' }, { value: 0 }, null]) expect(codes(PAN_BALANCE, { left: [5], right: [], weights: [1, 2] }, key), JSON.stringify(key)).toEqual(['impossible-state']);
      for (const payload of [{ left: [5], right: [], weights: [] }, { left: [5], right: [], weights: [21] }, { left: [0], right: [], weights: [1] }, { left: [1, 1, 1, 1, 1], right: [], weights: [1] }, { left: [5], right: [], weights: [1, 1, 1, 1, 1, 1, 1] }, {}]) {
        expect(codes(PAN_BALANCE, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
      }
    });

    it('says so when the budget runs out', () => {
      expect(codes(PAN_BALANCE, { left: [5], right: [], weights: [1, 2, 2, 3] }, { target: 0 }, 10)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.array-area.v2', () => {
    it('derives the one typed answer for the array, the multiplication box and the missing-area division', () => {
      expect(codes(ARRAY_AREA, { rows: 10, columns: 10 }, { value: 100 })).toEqual([]);
      expect(codes(ARRAY_AREA, { across: 99, down: 99 }, { value: 9801 })).toEqual([]);
      expect(codes(ARRAY_AREA, { dividend: 1188, divisor: 12 }, { value: 99 })).toEqual([]);
    });

    it('refuses a key that is not the answer the payload determines', () => {
      expect(codes(ARRAY_AREA, { rows: 3, columns: 4 }, { value: 13 })).toEqual(GAP_AND_INVALID);
      expect(codes(ARRAY_AREA, { across: 14, down: 7 }, { value: 21 })).toEqual(GAP_AND_INVALID);
      expect(codes(ARRAY_AREA, { dividend: 156, divisor: 12 }, { value: 12 })).toEqual(GAP_AND_INVALID);
      for (const key of [{ value: '12' }, { value: 12.5 }, { value: 12, extra: 1 }, { target: 12 }, null]) expect(codes(ARRAY_AREA, { rows: 3, columns: 4 }, key), JSON.stringify(key)).toEqual(['impossible-state']);
    });

    it('refuses a payload with no whole answer, a mixed payload and one outside the pieces', () => {
      for (const payload of [
        { rows: 11, columns: 4 }, { rows: 0, columns: 4 }, { across: 10, down: 7 }, { across: 14, down: 1 }, { dividend: 157, divisor: 12 }, { dividend: 156, divisor: 1 },
        { dividend: 156, divisor: 13 }, { rows: 3, columns: 4, across: 14 }, { rows: 3 }, { rows: '3', columns: 4 }, {},
      ]) expect(codes(ARRAY_AREA, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('says so when the budget runs out', () => {
      const small = timed(() => codes(ARRAY_AREA, { rows: 3, columns: 4 }, { value: 12 }, 5));
      expect(small.value).toEqual(['budget-exceeded']);
      expect(small.ms).toBeLessThan(5000);
      expect(codes(ARRAY_AREA, { dividend: 1188, divisor: 12 }, { value: 99 }, 50)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.ratio-line.v2', () => {
    it('searches every value the bounds allow and finds exactly one for each form', () => {
      expect(codes(RATIO_LINE, { units: ['coins', 'cups'], base: [12, 1], given: { line: 'top', value: 144 } }, { value: 12 })).toEqual([]);
      expect(codes(RATIO_LINE, { units: ['coins', 'cups'], base: [1, 12], given: { line: 'bottom', value: 144 } }, { value: 12 })).toEqual([]);
      expect(codes(RATIO_LINE, { unit: 'boxes', parts: [9, 3], whole: 996, ask: 'a' }, { value: 747 })).toEqual([]);
      expect(codes(RATIO_LINE, { unit: 'boxes', parts: [1, 1], whole: 2, ask: 'a' }, { value: 1 })).toEqual([]);
    });

    it('refuses a key that is not the one value that fits', () => {
      expect(codes(RATIO_LINE, { units: ['pencils', 'coins'], base: [3, 6], given: { line: 'top', value: 12 } }, { value: 25 })).toEqual(GAP_AND_INVALID);
      expect(codes(RATIO_LINE, { unit: 'stickers', parts: [3, 2], whole: 30, ask: 'b' }, { value: 18 })).toEqual(GAP_AND_INVALID);
      for (const key of [{ value: '24' }, { value: 24.5 }, { value: 24, extra: 1 }, { target: 24 }, null]) expect(codes(RATIO_LINE, { units: ['pencils', 'coins'], base: [3, 6], given: { line: 'top', value: 12 } }, key), JSON.stringify(key)).toEqual(['impossible-state']);
    });

    it('refuses a line or tape with no whole answer and a malformed payload', () => {
      for (const payload of [
        { units: ['pencils', 'coins'], base: [3, 6], given: { line: 'top', value: 13 } }, { units: ['pencils', 'coins'], base: [3, 6], given: { line: 'top', value: 3 } },
        { units: ['pencils', 'pencils'], base: [3, 6], given: { line: 'top', value: 12 } }, { units: ['pencils', 'dollars'], base: [3, 6], given: { line: 'top', value: 12 } },
        { units: ['pencils', 'coins'], base: [3, 6], given: { line: 'middle', value: 12 } }, { unit: 'stickers', parts: [3, 2], whole: 31, ask: 'b' },
        { unit: 'stickers', parts: [9, 9], whole: 18, ask: 'b' }, { unit: 'stickers', parts: [3, 2], whole: 30, ask: 'c' }, { unit: 'stickers', parts: [3, 2], whole: 30 }, {},
      ]) expect(codes(RATIO_LINE, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('says so when the budget runs out', () => {
      const small = timed(() => codes(RATIO_LINE, { unit: 'stickers', parts: [3, 2], whole: 30, ask: 'b' }, { value: 12 }, 100));
      expect(small.value).toEqual(['budget-exceeded']);
      expect(small.ms).toBeLessThan(5000);
    });
  });

  describe('math.fraction-wall.v2', () => {
    it('takes the exact form for equivalent and any equal form for the operations, as the pack gate does', () => {
      expect(codes(FRACTION_WALL, { op: 'equivalent', fraction: [2, 3], denominator: 12 }, { n: 8, d: 12 })).toEqual([]);
      expect(codes(FRACTION_WALL, { op: 'add', left: [1, 3], right: [1, 4] }, { n: 14, d: 24 })).toEqual([]);
      expect(codes(FRACTION_WALL, { op: 'multiply', left: [2, 3], right: [3, 4] }, { n: 3, d: 6 })).toEqual([]);
      expect(codes(FRACTION_WALL, { op: 'divide', left: [3, 4], right: [3, 8] }, { n: 4, d: 2 })).toEqual([]);
    });

    it('refuses a key that is not the result the payload determines', () => {
      expect(codes(FRACTION_WALL, { op: 'equivalent', fraction: [2, 3], denominator: 12 }, { n: 4, d: 6 })).toEqual(GAP_AND_INVALID);
      expect(codes(FRACTION_WALL, { op: 'add', left: [1, 3], right: [1, 4] }, { n: 2, d: 7 })).toEqual(GAP_AND_INVALID);
      expect(codes(FRACTION_WALL, { op: 'subtract', left: [3, 4], right: [1, 3] }, { n: 7, d: 12 })).toEqual(GAP_AND_INVALID);
      for (const key of [{ n: 0, d: 12 }, { n: 1000, d: 12 }, { n: 7 }, { n: 7, d: 12, extra: 1 }, { value: 7 }, { n: '7', d: 12 }, null]) {
        expect(codes(FRACTION_WALL, { op: 'add', left: [1, 3], right: [1, 4] }, key), JSON.stringify(key)).toEqual(['impossible-state']);
      }
    });

    it('refuses a payload with no proper result and a malformed payload', () => {
      for (const payload of [
        { op: 'equivalent', fraction: [2, 3], denominator: 10 }, { op: 'equivalent', fraction: [3, 3], denominator: 6 }, { op: 'subtract', left: [1, 4], right: [3, 4] },
        { op: 'divide', left: [1, 9], right: [1, 10] }, { op: 'multiply', left: [1, 7], right: [1, 2] }, { op: 'power', left: [1, 2], right: [1, 3] }, { op: 'add', left: [1, 3] }, {},
      ]) expect(codes(FRACTION_WALL, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('says so when the budget runs out', () => {
      expect(codes(FRACTION_WALL, { op: 'equivalent', fraction: [1, 2], denominator: 6 }, { n: 3, d: 6 }, 100)).toEqual(['budget-exceeded']);
    });
  });

  describe('math.fraction-circles.v2', () => {
    it('takes the exact form for show and any equal form for the other operations, as the pack gate does', () => {
      expect(codes(FRACTION_CIRCLES, { op: 'show', fraction: [3, 4] }, { n: 3, d: 4 })).toEqual([]);
      expect(codes(FRACTION_CIRCLES, { op: 'add', left: [1, 8], right: [3, 8] }, { n: 4, d: 8 })).toEqual([]);
      expect(codes(FRACTION_CIRCLES, { op: 'compare', left: [3, 8], right: [5, 8] }, { n: 10, d: 16 })).toEqual([]);
      expect(codes(FRACTION_CIRCLES, { op: 'add', left: [2, 6], right: [4, 6] })).toEqual([]);
    });

    it('refuses a key that is not the result the payload determines', () => {
      expect(codes(FRACTION_CIRCLES, { op: 'show', fraction: [3, 4] }, { n: 6, d: 8 })).toEqual(GAP_AND_INVALID);
      expect(codes(FRACTION_CIRCLES, { op: 'show', fraction: [3, 4] }, { n: 3, d: 5 })).toEqual(GAP_AND_INVALID);
      expect(codes(FRACTION_CIRCLES, { op: 'compare', left: [3, 8], right: [5, 8] }, { n: 3, d: 8 })).toEqual(GAP_AND_INVALID);
      for (const key of [{ n: 0, d: 4 }, { n: 3 }, { value: 3 }, { n: 3, d: 4, extra: 1 }, null]) expect(codes(FRACTION_CIRCLES, { op: 'show', fraction: [3, 4] }, key), JSON.stringify(key)).toEqual(['impossible-state']);
    });

    it('refuses a payload with no proper result and a malformed payload', () => {
      for (const payload of [
        { op: 'show', fraction: [4, 4] }, { op: 'show', fraction: [1, 7] }, { op: 'compare', left: [3, 8], right: [3, 8] }, { op: 'compare', left: [3, 8], right: [1, 4] },
        { op: 'add', left: [5, 8], right: [5, 8] }, { op: 'subtract', left: [3, 10], right: [7, 10] }, { op: 'multiply', left: [1, 2], right: [1, 2] }, { op: 'add', left: [1, 8] }, {},
      ]) expect(codes(FRACTION_CIRCLES, payload), JSON.stringify(payload)).toEqual(['impossible-state']);
    });

    it('says so when the budget runs out', () => {
      expect(codes(FRACTION_CIRCLES, { op: 'show', fraction: [3, 4] }, { n: 3, d: 4 }, 100)).toEqual(['budget-exceeded']);
    });
  });

  describe('every checker', () => {
    it('answers a segment with no payload at all with a blocking finding, never a throw', () => {
      for (const type of TYPES) {
        const findings = runSolvabilityGate({ segments: [{ id: 'seg-bare', type }] }, { 'seg-bare': { target: 1 } });
        expect(findings.length, type).toBeGreaterThan(0);
        expect(findings.every((finding) => finding.severity === 'block' && finding.code !== 'checker-error'), type).toBe(true);
      }
    });

    it('keeps the fixtures fast under the default budget', () => {
      const all = timed(() => FIXTURES.map((fixture) => codes(fixture.type, fixture.payload, fixture.key)));
      expect(all.value.every((entry) => entry.length === 0)).toBe(true);
      expect(all.ms).toBeLessThan(15000);
    });
  });
});
