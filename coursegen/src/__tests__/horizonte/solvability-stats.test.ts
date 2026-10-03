import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIXTURE_EMITTED_HORIZONTE } from '../../v2/cli.js';
import { horizontePieceGates } from '../../v2/horizonte/index.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate, solvabilityCheckerFor } from '../../v2/solvability.js';

const DOT_PLOT = 'stats.dot-plot.v2';
const BALANCE = 'stats.balance-point.v2';
const NORMAL = 'stats.normal.v2';
const BINOMIAL = 'stats.binomial.v2';
const CLT = 'stats.clt.v2';
const TREE = 'prob.tree.v2';
const BAYES = 'prob.bayes.v2';
const REGRESSION = 'prob.regression.v2';
const TYPES = [DOT_PLOT, BALANCE, NORMAL, BINOMIAL, CLT, TREE, BAYES, REGRESSION] as const;

const VISUAL: Record<string, string> = {
  [DOT_PLOT]: 'dot-plot', [BALANCE]: 'balance-point', [NORMAL]: 'normal-curve', [BINOMIAL]: 'binomial-bars', [CLT]: 'sampling-mean',
  [TREE]: 'prob-tree', [BAYES]: 'natural-frequencies', [REGRESSION]: 'regression-residuals',
};

type Segment = { id: string; type: string; grading: string; visual: { type: string }; prompt: string; payload: unknown };
const segment = (type: string, payload: unknown, prompt = ''): Segment => ({ id: 'seg-x', type, grading: 'server', visual: { type: VISUAL[type]! }, prompt, payload });
const findings = (target: Segment, key?: unknown, nodeBudget?: number) =>
  runSolvabilityGate({ segments: [target] }, key === undefined ? undefined : { [target.id]: key }, nodeBudget === undefined ? {} : { nodeBudget });
const codes = (target: Segment, key?: unknown, nodeBudget?: number) => [...new Set(findings(target, key, nodeBudget).map((finding) => finding.code))].sort();
const packGate = (target: Segment, key?: unknown) => horizontePieceGates({ segments: [target] }, key === undefined ? undefined : { [target.id]: key });
const statsOf = (target: Segment, nodeBudget = 200_000) =>
  solvabilityCheckerFor(target.type)!({ id: target.id, type: target.type, payload: target.payload as Record<string, unknown> }, { answerKey: undefined, ageBand: undefined, locale: undefined, nodeBudget }).stats ?? {};

describe('registration', () => {
  it.each(TYPES)('registers a checker for %s', (type) => {
    expect(registeredSolvabilityTypes()).toContain(type);
  });
});

describe('the committed Horizonte fixtures', () => {
  const rows = JSON.parse(readFileSync(FIXTURE_EMITTED_HORIZONTE, 'utf8')) as Array<{
    lesson_id: string;
    locale: string;
    document: { segments: Array<{ id: string; type: string }> };
    answer_keys: Record<string, unknown>;
  }>;
  const cases = rows.flatMap((row) => row.document.segments
    .filter((entry) => (TYPES as readonly string[]).includes(entry.type))
    .map((entry) => ({ name: `${row.lesson_id} ${row.locale} ${entry.id}`, type: entry.type, entry, key: row.answer_keys[entry.id], row })));

  it('covers every type in all three locales', () => {
    for (const type of TYPES) expect(cases.filter((item) => item.type === type).length, type).toBeGreaterThanOrEqual(3);
  });

  it.each(cases.map((item) => [item.name, item] as const))('passes %s with and without the key', (_name, item) => {
    const minimal = { segments: [item.entry], age_band: undefined, locale: item.row.locale };
    expect(runSolvabilityGate(minimal)).toEqual([]);
    expect(runSolvabilityGate(minimal, { [item.entry.id]: item.key })).toEqual([]);
  });
});

describe('malformed input never throws', () => {
  const payloads: unknown[] = [
    undefined, null, 7, 'text', [], {}, { axis: null, dots: 'x' }, { axis: { min: 'a', max: 5 }, dots: [NaN, Infinity] },
    { axis: { min: 0, max: 10 }, dots: [1, 2, 3], measure: 'median', moves: 1, pivot: Number.MAX_SAFE_INTEGER },
    { population: 1e308, prior: { part: 1, whole: 2 }, hit: null, alarm: [] }, { points: new Array(1000).fill({ x: 1, y: 1 }), size: 10 },
    { chips: new Array(1000).fill(5), population: 1000 }, { weights: [1e9, 1e9, 1e9], nMax: 25, start: { n: 1 }, goal: { shrink: 3 } },
    { start: 5, goal: 'x', band: [], sdMax: -1, nMax: 1e9 }, { size: 20, points: [{ x: -1, y: 2 }], start: { slope: 'a', intercept: {} } },
  ];
  const keys: unknown[] = [
    undefined, null, 5, 'x', [], {}, { target: {} }, { target: [] }, { target: null }, { solutions: 'x' }, { solutions: [null, 3] },
    { solutions: new Array(1000).fill({}) }, { family: 'line', target: { m: {}, b: [] } }, { target: 'x', tolerance: 5 },
  ];
  it.each(TYPES)('%s answers every garbage payload and key without a checker error', (type) => {
    for (const payload of payloads) {
      for (const key of keys) {
        const out = findings({ id: 'seg-x', type, grading: 'server', visual: { type: VISUAL[type]! }, prompt: '', payload }, key);
        expect(out.some((finding) => finding.code === 'checker-error'), `${type} ${JSON.stringify(payload)?.slice(0, 80)} ${JSON.stringify(key)?.slice(0, 40)}`).toBe(false);
        if (payload === undefined || payload === null || (typeof payload === 'object' && Object.keys(payload).length === 0)) expect(out.length, type).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------

describe('dot plot checker', () => {
  const P = { axis: { min: 0, max: 10 }, dots: [2, 3, 4, 4, 5, 7, 9], measure: 'median', moves: 2 };
  const dot = (over: Record<string, unknown> = {}, prompt = '') => segment(DOT_PLOT, { ...P, ...over }, prompt);

  it('accepts the fixture board with and without a key', () => {
    expect(codes(dot())).toEqual([]);
    expect(codes(dot(), { target: 6 })).toEqual([]);
  });

  it('proves from the public dots alone that some different whole value can be reached', () => {
    expect(codes(dot({ dots: [5, 5, 5], moves: 1 }))).toEqual(['no-solution']);
    expect(codes(dot({ axis: { min: 0, max: 4 }, dots: [2, 2, 2], measure: 'mean', moves: 1 }))).toEqual(['no-solution']);
    expect(codes(dot({ axis: { min: 0, max: 4 }, dots: [2, 2, 2], measure: 'mean', moves: 2 }))).toEqual([]);
    expect(codes(dot({ dots: [3, 3, 4, 4, 5], measure: 'mode', moves: 1 }))).toEqual([]);
  });

  it('refuses a key whose target no allowed move reaches', () => {
    expect(codes(dot({ moves: 1 }), { target: 6 })).toEqual(['no-solution']);
    expect(codes(dot(), { target: 9 })).toEqual(['no-solution']);
    expect(horizontePieceGates({ segments: [dot({ moves: 1 }, 'Make it 6.')] }, { 'seg-x': { target: 6 } })).toHaveLength(1);
  });

  it('refuses a start that already has the target measure', () => {
    expect(codes(dot(), { target: 4 })).toEqual(['impossible-state']);
    expect(codes(dot({ measure: 'mean', dots: [2, 4, 6] }), { target: 4 })).toEqual(['impossible-state']);
  });

  it('refuses a target off the axis or one that is not a whole number', () => {
    expect(codes(dot(), { target: 11 })).toEqual(['out-of-bounds']);
    expect(codes(dot(), { target: -1 })).toEqual(['out-of-bounds']);
    expect(codes(dot(), { target: 6.5 })).toEqual(['impossible-state']);
    expect(codes(dot(), { target: 'six' })).toEqual(['impossible-state']);
    expect(codes(dot(), { target: 6, extra: 1 })).toEqual(['impossible-state']);
    expect(codes(dot(), null)).toEqual(['impossible-state']);
  });

  it('refuses a malformed payload', () => {
    expect(codes(dot({ dots: [2, 3] }))).toEqual(['impossible-state']);
    expect(codes(dot({ dots: [2.5, 3, 4] }))).toEqual(['impossible-state']);
    expect(codes(dot({ dots: [2, 3, 40] }))).toEqual(['out-of-bounds']);
    expect(codes(dot({ moves: 3 }))).toEqual(['impossible-state']);
    expect(codes(dot({ moves: 0 }))).toEqual(['impossible-state']);
    expect(codes(dot({ measure: 'range' }))).toEqual(['impossible-state']);
    expect(codes(dot({ axis: { min: 0, max: 2 } }))).toEqual(['impossible-state']);
    expect(codes(segment(DOT_PLOT, undefined))).toEqual(['impossible-state']);
  });

  it('says so when the budget runs out instead of calling the board unsolvable', () => {
    expect(codes(dot(), undefined, 3)).toEqual(['budget-exceeded']);
    const started = performance.now();
    const biggest = dot({ axis: { min: 0, max: 20 }, dots: [0, 1, 3, 4, 6, 8, 9, 11, 13, 15, 18, 20], measure: 'median' });
    expect(codes(biggest, undefined, 2_000)).toEqual(['budget-exceeded']);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it('proves the largest allowed plot inside the default budget', () => {
    const biggest = dot({ axis: { min: 0, max: 20 }, dots: [0, 1, 3, 4, 6, 8, 9, 11, 13, 15, 18, 20], measure: 'median' });
    expect(codes(biggest)).toEqual([]);
    expect(statsOf(biggest).nodes!).toBeLessThan(200_000);
    expect(codes(biggest, { target: 10 })).toEqual([]);
  });

  it('agrees with the pack gate on every small board it can write a key for', () => {
    const sets = [[1, 2, 3], [2, 2, 4], [0, 3, 3, 6], [1, 1, 1, 5, 6], [0, 2, 4, 6], [3, 3, 3]];
    let compared = 0;
    for (const dots of sets) for (const measure of ['mean', 'median', 'mode']) for (const moves of [1, 2]) for (let target = -1; target <= 7; target += 1) {
      const board = dot({ axis: { min: 0, max: 6 }, dots, measure, moves }, `Make it ${target}.`);
      const ours = codes(board, { target }).length === 0;
      expect(ours, JSON.stringify([dots, measure, moves, target])).toBe(packGate(board, { target }).length === 0);
      compared += 1;
    }
    expect(compared).toBe(sets.length * 3 * 2 * 9);
  });
});

describe('balance point checker', () => {
  const P = { axis: { min: 0, max: 12 }, dots: [1, 2, 2, 5, 8, 12], pivot: 3 };
  const beam = (over: Record<string, unknown> = {}) => segment(BALANCE, { ...P, ...over });

  it('accepts the fixture beam with and without a key', () => {
    expect(codes(beam())).toEqual([]);
    expect(codes(beam(), { target: 5 })).toEqual([]);
  });

  it('refuses dots that balance on no whole position', () => {
    const lopsided = beam({ dots: [1, 2, 4] });
    expect(codes(lopsided)).toEqual(['no-solution']);
    expect(codes(lopsided, { target: 2 })).toEqual(['no-solution']);
    expect(packGate(lopsided)).toHaveLength(1);
    expect(packGate(lopsided, { target: 2 })).toHaveLength(1);
  });

  it('refuses a pivot that starts on the balance point', () => {
    expect(codes(beam({ pivot: 5 }))).toEqual(['impossible-state']);
    expect(codes(beam({ pivot: 5 }), { target: 5 })).toEqual(['impossible-state']);
  });

  it('refuses a pivot or dots off the axis and malformed beams', () => {
    expect(codes(beam({ pivot: 13 }))).toEqual(['out-of-bounds']);
    expect(codes(beam({ dots: [1, 2, 13] }))).toEqual(['out-of-bounds']);
    expect(codes(beam({ pivot: 2.5 }))).toEqual(['impossible-state']);
    expect(codes(beam({ pivot: undefined }))).toEqual(['impossible-state']);
    expect(codes(beam({ dots: [1, 2] }))).toEqual(['impossible-state']);
    expect(codes(beam({ axis: { min: 0, max: 80 } }))).toEqual(['impossible-state']);
  });

  it('checks the key against the one balance position', () => {
    expect(codes(beam(), { target: 4 })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(beam(), { target: 99 })).toEqual(['out-of-bounds']);
    expect(codes(beam(), { target: 5.5 })).toEqual(['impossible-state']);
    expect(codes(beam(), { target: '5' })).toEqual(['impossible-state']);
    expect(codes(beam(), { target: 5, extra: true })).toEqual(['impossible-state']);
  });

  it('reports a spent budget as a budget finding', () => {
    expect(codes(beam(), undefined, 3)).toEqual(['budget-exceeded']);
    expect(codes(beam({ axis: { min: 0, max: 20 } }), { target: 5 }, 2)).toEqual(['budget-exceeded']);
  });

  it('agrees with the pack gate on every small beam', () => {
    const sets = [[1, 2, 3], [1, 2, 4], [0, 4, 8, 4], [2, 2, 2], [0, 1, 1, 6], [3, 5, 7, 9, 11]];
    let compared = 0;
    for (const dots of sets) for (let pivot = 0; pivot <= 12; pivot += 1) for (let target = 0; target <= 12; target += 1) {
      const board = beam({ axis: { min: 0, max: 12 }, dots, pivot });
      expect(codes(board, { target }).length === 0, JSON.stringify([dots, pivot, target])).toBe(packGate(board, { target }).length === 0);
      compared += 1;
    }
    expect(compared).toBe(sets.length * 13 * 13);
  });
});

describe('normal curve checker', () => {
  const P = { axis: { min: 0, max: 100 }, start: { mean: 30, sd: 10 }, sdMax: 20, band: { rule: 2, low: 40, high: 60 } };
  const curve = (over: Record<string, unknown> = {}, prompt = '') => segment(NORMAL, { ...P, ...over }, prompt);
  const KEY = { target: { mean: 50, sd: 5 } };

  it('accepts the fixture curve with and without a key', () => {
    expect(codes(curve())).toEqual([]);
    expect(codes(curve(), KEY)).toEqual([]);
  });

  it('refuses a band no mean and spread on the sliders can sit on', () => {
    expect(codes(curve({ band: { rule: 2, low: 40, high: 61 } }))).toEqual(['no-solution']);
    expect(codes(curve({ band: { rule: 3, low: 40, high: 60 } }))).toEqual(['no-solution']);
    expect(codes(curve({ sdMax: 4, start: { mean: 30, sd: 3 } }))).toEqual(['no-solution']);
    expect(codes(curve({ band: { rule: 1, low: 0, high: 100 } }), KEY)).toEqual(['no-solution']);
    expect(packGate(curve({ sdMax: 4, start: { mean: 30, sd: 3 } }, 'Between 40 and 60 either side of the mean.'))).toHaveLength(1);
  });

  it('refuses a curve that starts on the answer', () => {
    expect(codes(curve({ start: { mean: 50, sd: 5 } }))).toEqual(['impossible-state']);
  });

  it('refuses values off the axis and malformed payloads', () => {
    expect(codes(curve({ band: { rule: 2, low: 40, high: 120 } }))).toEqual(['out-of-bounds']);
    expect(codes(curve({ start: { mean: 150, sd: 10 } }))).toEqual(['out-of-bounds']);
    expect(codes(curve({ start: { mean: 30, sd: 25 } }))).toEqual(['out-of-bounds']);
    expect(codes(curve({ band: undefined }))).toEqual(['impossible-state']);
    expect(codes(curve({ band: { rule: 2, low: 60, high: 40 } }))).toEqual(['impossible-state']);
    expect(codes(curve({ band: { rule: 4, low: 40, high: 60 } }))).toEqual(['impossible-state']);
    expect(codes(curve({ sdMax: 0 }))).toEqual(['impossible-state']);
    expect(codes(curve({ start: { mean: 30.5, sd: 10 } }))).toEqual(['impossible-state']);
    expect(codes(curve({ axis: { min: 0, max: 5 } }))).toEqual(['impossible-state']);
  });

  it('checks the key against the one curve the band fixes', () => {
    expect(codes(curve(), { target: { mean: 50, sd: 6 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(curve(), { target: { mean: 40, sd: 10 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(curve(), { target: { mean: 50 } })).toEqual(['impossible-state']);
    expect(codes(curve(), { target: 50 })).toEqual(['impossible-state']);
    expect(codes(curve(), { target: { mean: 50, sd: 5, extra: 1 } })).toEqual(['impossible-state']);
    expect(codes(curve(), { target: { mean: 500, sd: 5 } })).toEqual(['out-of-bounds']);
    expect(codes(curve(), { target: { mean: 50, sd: 5 }, extra: 1 })).toEqual(['impossible-state']);
  });

  it('reports a spent budget as a budget finding', () => {
    expect(codes(curve(), undefined, 10)).toEqual(['budget-exceeded']);
    expect(statsOf(curve({ axis: { min: 0, max: 200 }, sdMax: 30 })).nodes!).toBeLessThan(10_000);
  });

  it('agrees with the pack gate on every small curve it can write a key for', () => {
    let compared = 0;
    for (const rule of [1, 2, 3]) for (const low of [10, 14, 20, 21]) for (const high of [20, 30, 34, 41]) for (const sdMax of [3, 8, 20]) {
      for (const start of [{ mean: 5, sd: 2 }, { mean: 22, sd: 5 }, { mean: 25, sd: 5 }]) {
        const width = high - low;
        const solvable = high > low && (low + high) % 2 === 0 && width % (2 * rule) === 0 && width / (2 * rule) <= sdMax;
        const target = solvable ? { mean: (low + high) / 2, sd: width / (2 * rule) } : { mean: 0, sd: 1 };
        const board = curve({ axis: { min: 0, max: 40 }, start, sdMax, band: { rule, low, high } }, `Between ${low} and ${high}, either side of the mean.`);
        expect(codes(board, { target }).length === 0, JSON.stringify([rule, low, high, sdMax, start])).toBe(packGate(board, { target }).length === 0);
        compared += 1;
      }
    }
    expect(compared).toBe(3 * 4 * 4 * 3 * 3);
  });
});

describe('binomial checker', () => {
  const P = { nMax: 40, start: { n: 10, pct: 30 }, goal: { mean: 10, variance: 5 } };
  const bars = (over: Record<string, unknown> = {}, prompt = '') => segment(BINOMIAL, { ...P, ...over }, prompt);
  const KEY = { target: { n: 20, pct: 50 } };

  it('accepts the fixture bars with and without a key', () => {
    expect(codes(bars())).toEqual([]);
    expect(codes(bars(), KEY)).toEqual([]);
  });

  it('refuses a goal no count and percent on the grid reaches', () => {
    expect(codes(bars({ goal: { mean: 10, variance: 10 } }))).toEqual(['no-solution']);
    expect(codes(bars({ goal: { mean: 10, variance: 3 } }))).toEqual(['no-solution']);
    expect(codes(bars({ nMax: 15 }))).toEqual(['no-solution']);
    expect(codes(bars({ goal: { mean: 10, variance: 12 } }), KEY)).toEqual(['no-solution']);
    expect(packGate(bars({ nMax: 15 }, 'Mean 10. Variance 5.'))).toHaveLength(1);
  });

  it('refuses bars that start on the answer', () => {
    expect(codes(bars({ start: { n: 20, pct: 50 } }))).toEqual(['impossible-state']);
  });

  it('refuses a start off the sliders and malformed payloads', () => {
    expect(codes(bars({ start: { n: 10, pct: 33 } }))).toEqual(['out-of-bounds']);
    expect(codes(bars({ start: { n: 41, pct: 30 } }))).toEqual(['out-of-bounds']);
    expect(codes(bars({ start: { n: 10.5, pct: 30 } }))).toEqual(['impossible-state']);
    expect(codes(bars({ nMax: 0 }))).toEqual(['impossible-state']);
    expect(codes(bars({ goal: undefined }))).toEqual(['impossible-state']);
    expect(codes(bars({ goal: { mean: 41, variance: 5 } }))).toEqual(['impossible-state']);
    expect(codes(bars({ goal: { mean: 10, variance: 0 } }))).toEqual(['impossible-state']);
  });

  it('checks the key against the one count and percent', () => {
    expect(codes(bars(), { target: { n: 10, pct: 50 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(bars(), { target: { n: 20 } })).toEqual(['impossible-state']);
    expect(codes(bars(), { target: { n: 0, pct: 50 } })).toEqual(['out-of-bounds']);
    expect(codes(bars(), { target: { n: 20, pct: 51 } })).toEqual(['out-of-bounds']);
    expect(codes(bars(), { target: 20 })).toEqual(['impossible-state']);
    expect(codes(bars(), { target: { n: 20, pct: 50, extra: 1 } })).toEqual(['impossible-state']);
  });

  it('reports a spent budget as a budget finding', () => {
    expect(codes(bars(), undefined, 10)).toEqual(['budget-exceeded']);
  });

  it('agrees with the pack gate on every small goal it can write a key for', () => {
    let compared = 0;
    for (const nMax of [10, 20, 40]) for (const mean of [2, 5, 10, 20]) for (const variance of [1, 2, 5, 10, 20]) for (const start of [{ n: 5, pct: 50 }, { n: 4, pct: 50 }, { n: 20, pct: 50 }]) {
      let target = { n: 1, pct: 5 };
      for (let n = 1; n <= nMax; n += 1) for (let pct = 5; pct <= 95; pct += 5) {
        if (n * pct === 100 * mean && n * pct * (100 - pct) === 10_000 * variance) target = { n, pct };
      }
      const board = bars({ nMax, start, goal: { mean, variance } }, `Mean ${mean}. Variance ${variance}.`);
      expect(codes(board, { target }).length === 0, JSON.stringify([nMax, mean, variance, start])).toBe(packGate(board, { target }).length === 0);
      compared += 1;
    }
    expect(compared).toBe(3 * 4 * 5 * 3);
  });
});

describe('sampling mean checker', () => {
  const P = { weights: [6, 1, 1, 1, 1, 6], nMax: 25, start: { n: 1 }, goal: { shrink: 3 } };
  const sampling = (over: Record<string, unknown> = {}, prompt = '') => segment(CLT, { ...P, ...over }, prompt);
  const KEY = { target: { n: 9 } };

  it('accepts the fixture population with and without a key', () => {
    expect(codes(sampling())).toEqual([]);
    expect(codes(sampling(), KEY)).toEqual([]);
  });

  it('refuses a shrink that needs more draws than the slider offers', () => {
    expect(codes(sampling({ nMax: 8 }))).toEqual(['no-solution']);
    expect(codes(sampling({ goal: { shrink: 5 }, nMax: 20 }), { target: { n: 20 } })).toEqual(['no-solution']);
  });

  it('refuses a population with no spread, where every sample size shrinks nothing and so shrinks it any amount', () => {
    expect(codes(sampling({ weights: [0, 0, 5, 0] }))).toEqual(['ambiguous-solution']);
    expect(codes(sampling({ weights: [7, 0, 0] }), KEY)).toEqual(['ambiguous-solution']);
    expect(packGate(sampling({ weights: [0, 0, 5, 0] }, '3 times smaller.'), KEY)).toEqual([]);
  });

  it('refuses a sample size that starts on the answer', () => {
    expect(codes(sampling({ start: { n: 9 } }))).toEqual(['impossible-state']);
  });

  it('refuses values off the sliders and malformed payloads', () => {
    expect(codes(sampling({ weights: [6, 21, 1] }))).toEqual(['out-of-bounds']);
    expect(codes(sampling({ start: { n: 26 } }))).toEqual(['out-of-bounds']);
    expect(codes(sampling({ weights: [1, 2] }))).toEqual(['impossible-state']);
    expect(codes(sampling({ weights: [0, 0, 0] }))).toEqual(['impossible-state']);
    expect(codes(sampling({ goal: { shrink: 1 } }))).toEqual(['impossible-state']);
    expect(codes(sampling({ goal: { shrink: 6 } }))).toEqual(['impossible-state']);
    expect(codes(sampling({ nMax: 26 }))).toEqual(['impossible-state']);
    expect(codes(sampling({ weights: [1, 2.5, 3] }))).toEqual(['impossible-state']);
  });

  it('checks the key against the one sample size', () => {
    expect(codes(sampling(), { target: { n: 8 } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(sampling(), { target: { n: 26 } })).toEqual(['out-of-bounds']);
    expect(codes(sampling(), { target: { n: 9.5 } })).toEqual(['impossible-state']);
    expect(codes(sampling(), { target: 9 })).toEqual(['impossible-state']);
    expect(codes(sampling(), { target: { n: 9, extra: 1 } })).toEqual(['impossible-state']);
  });

  it('reports a spent budget as a budget finding', () => {
    expect(codes(sampling(), undefined, 3)).toEqual(['budget-exceeded']);
  });

  it('agrees with the pack gate on every small population it can write a key for', () => {
    let compared = 0;
    for (const weights of [[6, 1, 1, 1, 1, 6], [1, 1, 1], [2, 4, 2, 4], [1, 0, 0, 3]]) for (const nMax of [4, 9, 16, 25]) for (const shrink of [2, 3, 4, 5]) for (const start of [1, 4, 9]) {
      const target = { n: shrink * shrink <= nMax ? shrink * shrink : 1 };
      const board = sampling({ weights, nMax, start: { n: start }, goal: { shrink } }, `${shrink} times smaller.`);
      expect(codes(board, { target }).length === 0, JSON.stringify([weights, nMax, shrink, start])).toBe(packGate(board, { target }).length === 0);
      compared += 1;
    }
    expect(compared).toBe(4 * 4 * 4 * 3);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------

describe('probability tree checker', () => {
  const P = { population: 1000, prior: { part: 1, whole: 100 }, hit: { part: 9, whole: 10 }, alarm: { part: 1, whole: 10 }, chips: [1, 9, 10, 99, 100, 891, 900, 990] };
  const tree = (over: Record<string, unknown> = {}) => segment(TREE, { ...P, ...over });
  const SOLUTION = { has: ['n-10'], lacks: ['n-990'], 'has-pos': ['n-9'], 'has-neg': ['n-1'], 'lacks-pos': ['n-99'], 'lacks-neg': ['n-891'] };
  const KEY = { solutions: [SOLUTION] };
  const SWAPPED = { ...SOLUTION, 'has-pos': ['n-1'], 'has-neg': ['n-9'] };

  it('accepts the fixture tree with and without a key', () => {
    expect(codes(tree())).toEqual([]);
    expect(codes(tree(), KEY)).toEqual([]);
  });

  it('finds the one tree from the tray alone and refuses a tray that cannot build it', () => {
    expect(codes(tree({ chips: [1, 9, 10, 99, 100, 900, 990] }))).toEqual(['no-solution']);
    expect(codes(tree({ chips: [1, 9, 10, 99, 100, 900, 990] }), KEY)).toEqual(['no-solution']);
    expect(packGate(tree({ chips: [1, 9, 10, 99, 100, 900, 990] }))).toHaveLength(1);
  });

  it('refuses counts that tie or a tray that repeats a chip, both of which make a branch ambiguous', () => {
    expect(codes(tree({ prior: { part: 1, whole: 2 }, hit: { part: 1, whole: 10 }, alarm: { part: 1, whole: 5 } }))).toEqual(['ambiguous-solution']);
    expect(codes(tree({ chips: [1, 9, 10, 99, 100, 891, 900, 990, 990] }))).toEqual(['ambiguous-solution']);
  });

  it('refuses shares that do not land on whole people and malformed payloads', () => {
    expect(codes(tree({ prior: { part: 1, whole: 3 } }))).toEqual(['no-solution']);
    expect(codes(tree({ population: 50 }))).toEqual(['impossible-state']);
    expect(codes(tree({ ask: 'positive' }))).toEqual(['impossible-state']);
    expect(codes(tree({ chips: [1, 9, 10, 99, 891, 990] }))).toEqual(['impossible-state']);
    expect(codes(tree({ chips: [1, 9, 10, 99, 100, 891, 900, 990, 'x'] }))).toEqual(['impossible-state']);
    expect(codes(tree({ chips: [1, 9, 10, 99, 100, 891, 900, 990, 1001] }))).toEqual(['out-of-bounds']);
    expect(codes(tree({ chips: [0, 9, 10, 99, 100, 891, 900, 990] }))).toEqual(['out-of-bounds']);
    expect(codes(segment(TREE, undefined))).toEqual(['impossible-state']);
  });

  it('checks the key against the one arrangement the relations allow', () => {
    expect(codes(tree(), { solutions: [SWAPPED] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(tree(), { solutions: [SOLUTION, SWAPPED] })).toEqual(['rubric-accepts-invalid']);
    expect(codes(tree(), { solutions: [] })).toEqual(['rubric-gap']);
    expect(codes(tree(), { solutions: [{ ...SOLUTION, 'lacks-neg': ['n-ten'] }] })).toEqual(['impossible-state']);
    expect(codes(tree(), { solutions: [{ ...SOLUTION, 'lacks-neg': ['n-891', 'n-1'] }] })).toEqual(['impossible-state']);
    expect(codes(tree(), { solutions: [{ has: ['n-10'] }] })).toEqual(['impossible-state']);
    expect(codes(tree(), { solutions: 'x' })).toEqual(['impossible-state']);
    expect(codes(tree(), { solutions: [SOLUTION], extra: 1 })).toEqual(['impossible-state']);
    expect(codes(tree(), { solutions: new Array(65).fill(SOLUTION) })).toEqual(['too-large']);
  });

  // The tray starts empty and a chip can be taken back off a branch, so there is no start to solve and no placement to be stuck in.
  it('reports a spent budget as a budget finding', () => {
    expect(codes(tree(), undefined, 3)).toEqual(['budget-exceeded']);
    expect(codes(tree(), KEY, 3)).toEqual(['budget-exceeded']);
  });

  it('agrees with the pack gate on every small population', () => {
    const shares = [[1, 100], [1, 20], [1, 10], [1, 4], [3, 10], [1, 2], [9, 10], [7, 10]];
    let compared = 0;
    let solvable = 0;
    for (const population of [100, 200, 1000]) for (const prior of shares) for (const hit of shares) for (const alarm of shares) {
      const has = (population * prior[0]!) / prior[1]!;
      const lacks = population - has;
      const hasPos = (has * hit[0]!) / hit[1]!;
      const lacksPos = (lacks * alarm[0]!) / alarm[1]!;
      const whole = [has, hasPos, lacksPos].every(Number.isInteger);
      const counts = whole ? [has, lacks, hasPos, has - hasPos, lacksPos, lacks - lacksPos] : [1, 2, 3, 4, 5, 6];
      const extra = [7, 11, 13, 17].find((value) => !counts.includes(value))!;
      const chips = [...counts, extra, extra + 1].filter((value, index, all) => all.indexOf(value) === index && value >= 1 && value <= population);
      const names = ['has', 'lacks', 'has-pos', 'has-neg', 'lacks-pos', 'lacks-neg'];
      const key = { solutions: [Object.fromEntries(names.map((name, index) => [name, [`n-${counts[index]}`]]))] };
      const board = tree({ population, prior: { part: prior[0], whole: prior[1] }, hit: { part: hit[0], whole: hit[1] }, alarm: { part: alarm[0], whole: alarm[1] }, chips });
      const ours = codes(board, key).length === 0;
      expect(ours, JSON.stringify(board.payload)).toBe(packGate(board, key).length === 0);
      expect(codes(board).length === 0, JSON.stringify(board.payload)).toBe(packGate(board).length === 0);
      if (ours) solvable += 1;
      compared += 1;
    }
    expect(compared).toBe(3 * 8 * 8 * 8);
    expect(solvable).toBeGreaterThan(20);
  });
});

describe('Bayes chance checker', () => {
  const P = { population: 1000, prior: { part: 1, whole: 100 }, hit: { part: 9, whole: 10 }, alarm: { part: 1, whole: 10 }, ask: 'positive' };
  const bayes = (over: Record<string, unknown> = {}) => segment(BAYES, { ...P, ...over });
  const KEY = { target: '1/12', tolerance: { absolute: '0.005' }, review: { absolute: '0.02' } };
  // 12 of the 62 positives truly have it, and the 20 in 100 who have it before any test sit 0.0065 away: a tolerance of 0.01 would accept the base rate.
  const BASE = { population: 100, prior: { part: 1, whole: 5 }, hit: { part: 3, whole: 5 }, alarm: { part: 5, whole: 8 }, ask: 'positive' };

  it('accepts the fixture question with and without a key', () => {
    expect(codes(bayes())).toEqual([]);
    expect(codes(bayes(), KEY)).toEqual([]);
    expect(codes(bayes(), { target: '0.08333333', tolerance: { absolute: '0.005' } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(bayes(), { target: '1/12', tolerance: { absolute: '0' } })).toEqual([]);
  });

  it('refuses a chance the learner could not tell from certainty, which the payload alone fixes', () => {
    expect(codes(bayes({ ask: 'negative' }))).toEqual(['out-of-bounds']);
    expect(codes(bayes({ prior: { part: 9, whole: 10 }, hit: { part: 99, whole: 100 }, alarm: { part: 1, whole: 100 } }))).toEqual(['out-of-bounds']);
  });

  it('refuses shares that tie or do not land on whole people', () => {
    expect(codes(bayes({ prior: { part: 1, whole: 3 } }))).toEqual(['no-solution']);
    expect(codes(bayes({ prior: { part: 1, whole: 2 }, hit: { part: 1, whole: 10 }, alarm: { part: 1, whole: 5 } }))).toEqual(['ambiguous-solution']);
  });

  it('refuses malformed payloads', () => {
    expect(codes(bayes({ ask: 'maybe' }))).toEqual(['impossible-state']);
    expect(codes(bayes({ ask: undefined }))).toEqual(['impossible-state']);
    expect(codes(bayes({ prior: { part: 5, whole: 5 } }))).toEqual(['impossible-state']);
    expect(codes(bayes({ chips: [1, 2, 3] }))).toEqual(['impossible-state']);
    expect(codes(bayes({ population: 10 }))).toEqual(['impossible-state']);
    expect(codes(segment(BAYES, undefined))).toEqual(['impossible-state']);
  });

  it('checks the key against the one exact chance and the wrongs it would accept', () => {
    expect(codes(bayes(), { ...KEY, target: '1/10' })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(bayes(), { ...KEY, tolerance: { absolute: '0.05' } })).toContain('rubric-accepts-invalid');
    expect(codes(bayes(), { ...KEY, review: { absolute: '0.005' } })).toEqual(['vacuous-rubric']);
    expect(codes(bayes(), { ...KEY, review: { absolute: '0.2' } })).toEqual(['impossible-state']);
    expect(codes(bayes(), { target: '1/12' })).toEqual(['impossible-state']);
    expect(codes(bayes(), { ...KEY, target: 0.0833 })).toEqual(['impossible-state']);
    expect(codes(bayes(), { ...KEY, extra: 1 })).toEqual(['impossible-state']);
    expect(codes(bayes(), null)).toEqual(['impossible-state']);
  });

  it('refuses a tolerance that grades a mix-up of the grid as right', () => {
    expect(codes(bayes(BASE), { target: '6/31', tolerance: { absolute: '0.005' } })).toEqual([]);
    expect(codes(bayes(BASE), { target: '6/31', tolerance: { absolute: '0.01' } })).toEqual(['rubric-accepts-invalid']);
    expect(findings(bayes(BASE), { target: '6/31', tolerance: { absolute: '0.01' } })[0]!.message).toContain('(1/5)');
    expect(packGate(bayes(BASE), { target: '6/31', tolerance: { absolute: '0.01' } })).toEqual([]);
  });

  // The chance is one division of whole counts: there is no search, so a budget of 1 changes nothing and nothing can hang.
  it('does a fixed amount of work whatever the budget', () => {
    expect(codes(bayes(), KEY, 1)).toEqual([]);
    expect(codes(bayes({ ask: 'negative' }), undefined, 1)).toEqual(['out-of-bounds']);
  });

  it('agrees with the pack gate on every small population', () => {
    const shares = [[1, 100], [1, 20], [1, 10], [1, 4], [3, 10], [1, 2], [9, 10], [7, 10]];
    let compared = 0;
    for (const population of [100, 200, 1000]) for (const prior of shares) for (const hit of shares) for (const alarm of shares) for (const ask of ['positive', 'negative']) {
      const board = bayes({ population, prior: { part: prior[0], whole: prior[1] }, hit: { part: hit[0], whole: hit[1] }, alarm: { part: alarm[0], whole: alarm[1] }, ask });
      expect(codes(board).length === 0, JSON.stringify(board.payload)).toBe(packGate(board).length === 0);
      compared += 1;
    }
    expect(compared).toBe(3 * 8 * 8 * 8 * 2);
  });
});

describe('regression checker', () => {
  const P = {
    size: 10,
    points: [{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 3, y: 5 }, { x: 6, y: 7 }, { x: 8, y: 10 }, { x: 10, y: 10 }],
    start: { slope: 0, intercept: 50 },
  };
  const KEY = { family: 'line', target: { m: '1', b: '1' }, parameter_tolerance: { absolute: '0.05' }, parameter_review: { absolute: '0.3' } };
  const line = (over: Record<string, unknown> = {}) => segment(REGRESSION, { ...P, ...over });

  it('accepts the fixture plot with and without a key', () => {
    expect(codes(line())).toEqual([]);
    expect(codes(line(), KEY)).toEqual([]);
    expect(codes(line(), { ...KEY, target: { m: '1.0', b: '2/2' } })).toEqual([]);
  });

  it('refuses points whose best line is no slider position, which the pack only sees once the points are known', () => {
    const off = line({ points: [...P.points.slice(0, 5), { x: 10, y: 9 }] });
    expect(codes(off)).toEqual(['no-solution']);
    expect(codes(off, KEY)).toEqual(['no-solution']);
    expect(packGate(off)).toHaveLength(1);
  });

  it('refuses a best line outside the slider ranges', () => {
    const steep = line({ size: 20, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 11 }] });
    expect(codes(steep)).toEqual(['out-of-bounds']);
    expect(packGate(steep)).toHaveLength(1);
  });

  it('refuses points on one line, where there are no squares to make small', () => {
    expect(codes(line({ points: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }] }))).toEqual(['impossible-state']);
  });

  it('refuses a start on the best line and a start off the sliders', () => {
    expect(codes(line({ start: { slope: 10, intercept: 10 } }))).toEqual(['impossible-state']);
    expect(codes(line({ start: { slope: 31, intercept: 10 } }))).toEqual(['out-of-bounds']);
    expect(codes(line({ start: { slope: 0, intercept: 151 } }))).toEqual(['out-of-bounds']);
    expect(codes(line({ start: { slope: 0.5, intercept: 10 } }))).toEqual(['impossible-state']);
    expect(codes(line({ start: undefined }))).toEqual(['impossible-state']);
  });

  it('refuses malformed points', () => {
    expect(codes(line({ points: P.points.slice(0, 3) }))).toEqual(['impossible-state']);
    expect(codes(line({ points: [...P.points.slice(0, 5), { x: 1, y: 1 }] }))).toEqual(['impossible-state']);
    expect(codes(line({ points: [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }] }))).toEqual(['impossible-state']);
    expect(codes(line({ points: [...P.points.slice(0, 5), { x: 11, y: 3 }] }))).toEqual(['out-of-bounds']);
    expect(codes(line({ size: 5 }))).toEqual(['impossible-state']);
    expect(codes(line({ extra: 1 }))).toEqual(['impossible-state']);
  });

  it('checks the key against the one best line and the wrongs it would accept', () => {
    expect(codes(line(), { ...KEY, target: { m: '2', b: '1' } })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
    expect(codes(line(), { ...KEY, parameter_tolerance: { absolute: '0.2' } })).toEqual(['rubric-accepts-invalid']);
    expect(findings(line(), { ...KEY, parameter_tolerance: { absolute: '0.1' } }).map((finding) => finding.message).join(' ')).toContain('slider lines');
    expect(codes(line(), { ...KEY, parameter_review: { absolute: '0.01' } })).toEqual(['vacuous-rubric']);
    expect(codes(line(), { ...KEY, parameter_review: { absolute: '0.6' } })).toEqual(['impossible-state']);
    expect(codes(line(), { ...KEY, family: 'curve' })).toEqual(['impossible-state']);
    expect(codes(line(), { ...KEY, target: { m: 1, b: 1 } })).toEqual(['impossible-state']);
    expect(codes(line(), { family: 'line', target: { m: '1', b: '1' } })).toEqual(['impossible-state']);
    expect(codes(line(), { ...KEY, extra: 1 })).toEqual(['impossible-state']);
  });

  it('reports a spent budget as a budget finding', () => {
    expect(codes(line(), undefined, 100)).toEqual(['budget-exceeded']);
    expect(codes(line(), KEY, 100)).toEqual(['budget-exceeded']);
    const started = performance.now();
    codes(line(), KEY, 50);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(statsOf(line()).nodes!).toBe(61 * 201);
  });

  it('agrees with the pack gate on a spread of generated plots', () => {
    let seed = 7;
    const next = (limit: number) => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) % limit;
    };
    let compared = 0;
    let fitted = 0;
    for (let round = 0; round < 4000; round += 1) {
      const size = 6 + next(6);
      const count = 4 + next(4);
      const points: Array<{ x: number; y: number }> = [];
      while (points.length < count) {
        const point = { x: next(size + 1), y: next(size + 1) };
        if (!points.some((other) => other.x === point.x && other.y === point.y)) points.push(point);
      }
      const board = line({ size, points });
      const clean = packGate(board).length === 0;
      if (clean) {
        fitted += 1;
        const n = points.length;
        const sx = points.reduce((total, point) => total + point.x, 0);
        const sy = points.reduce((total, point) => total + point.y, 0);
        const sxy = points.reduce((total, point) => total + point.x * point.y, 0);
        const sxx = points.reduce((total, point) => total + point.x * point.x, 0);
        const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
        const intercept = (sy - slope * sx) / n;
        const key = { ...KEY, target: { m: String(Number(slope.toFixed(6))), b: String(Number(intercept.toFixed(6))) } };
        expect(codes(board, key), JSON.stringify(board.payload)).toEqual([]);
        expect(packGate(board, key), JSON.stringify(board.payload)).toEqual([]);
      }
      expect(codes(board).length === 0, JSON.stringify(board.payload)).toBe(clean);
      compared += 1;
    }
    expect(compared).toBe(4000);
    expect(fitted).toBeGreaterThan(5);
  });
});
