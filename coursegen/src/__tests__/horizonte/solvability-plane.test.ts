import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { horizontePieceGates } from '../../v2/horizonte/index.js';
import { PLANE_SOLVABILITY_TYPES } from '../../v2/horizonte/solvability-plane.js';
import '../../v2/solvabilityPacks.js';
import { registeredSolvabilityTypes, runSolvabilityGate } from '../../v2/solvability.js';

const SLOPE = 'alg.slope-triangle.v2';
const RATE = 'alg.rate-of-change.v2';
const LINKED = 'alg.linked-views.v2';
const BREAK_EVEN = 'fin.break-even.v2';
const COST = 'fin.cost-structure.v2';
const MARKUP = 'fin.margin-markup.v2';
const MARKET = 'econ.market-shift.v2';
const ELASTICITY = 'econ.elasticity.v2';
const RATE_RETURN = 'money.rate-return.v2';
const SYSTEM = 'math.line-system.v2';

interface Seg { id: string; type: string; grading: string; visual: { type: string }; prompt?: string; payload: Record<string, unknown> }
const seg = (type: string, visual: string, prompt: string | undefined, payload: Record<string, unknown>, id = 'seg-plane'): Seg => ({ id, type, grading: 'server', visual: { type: visual }, ...(prompt === undefined ? {} : { prompt }), payload });
const findings = (target: Seg, key?: unknown, nodeBudget?: number) =>
  runSolvabilityGate({ segments: [target] }, key === undefined ? undefined : { [target.id]: key }, nodeBudget === undefined ? {} : { nodeBudget });
const codes = (target: Seg, key?: unknown, nodeBudget?: number) => findings(target, key, nodeBudget).map((finding) => finding.code).sort();
const edit = (target: Seg, patch: Record<string, unknown>): Seg => ({ ...target, payload: { ...target.payload, ...patch } });
const reword = (target: Seg, prompt: string): Seg => ({ ...target, prompt });
const pack = (target: Seg, key?: unknown) => horizontePieceGates({ segments: [target] }, key === undefined ? undefined : { [target.id]: key });

const grid = { xMax: 8, yMin: 0, yMax: 8 };
const slope = seg(SLOPE, 'slope-triangle', 'Build the slope triangle with a run of 3. Drag its top corner up to the line.', { grid, line: { from: { x: 1, y: 1 }, to: { x: 4, y: 7 } }, run: 3, start: 2 });
const gentle = seg(SLOPE, 'slope-triangle', 'Build the slope triangle with a run of 3. Drag its top corner up to the line.', { grid, line: { from: { x: 0, y: 1 }, to: { x: 6, y: 5 } }, run: 3, start: 5 });
const rate = seg(RATE, 'rate-table-graph', 'The value is 2 at step 0 and grows by 3 each step. Drag the point to step 6.', { grid: { xMax: 10, yMin: 0, yMax: 24 }, origin: { x: 0, y: 2 }, rate: 3, at: 6, start: 8 });
const linked = seg(LINKED, 'linked-views', 'Edit the line until it passes through (1, 5) and (3, 9).', { grid: { xMax: 6, yMin: 0, yMax: 20 }, given: [{ x: 1, y: 5 }, { x: 3, y: 9 }], start: { m: 1, b: 0 } });
const breakEven = seg(BREAK_EVEN, 'break-even', 'Setup costs 60. A cup costs 2 to make and sells for 5. Find the cups where sales equal costs.', { fixed: 60, price: 5, unit: 2, maxUnits: 40, start: 5 });
const cost = seg(COST, 'cost-structure', 'Setup costs 120 and each unit costs 5 to make. Find the units where the average cost per unit falls to 8.', { fixed: 120, variable: 5, maxUnits: 50, goal: { average: 8 }, start: 10 });
const markup = seg(MARKUP, 'margin-markup', 'An item costs 40. Set the price with a markup of 50% on the cost.', { cost: 40, basis: 'markup', percent: 50, maxPrice: 100, start: 40 });
const margin = seg(MARKUP, 'margin-markup', 'An item costs 60. Set the price for a margin of 25% of the price.', { cost: 60, basis: 'margin', percent: 25, maxPrice: 120, start: 60 });
const market = seg(MARKET, 'market-shift', 'A heat wave adds 12 units of demand at every price. Does the price go up or down? Set the new price.', { pMax: 16, qMax: 80, demand: { a: 60, b: 4 }, supply: { c: 0, d: 2 }, shift: { curve: 'demand', by: 12 }, start: 10 });
const supplyShock = seg(MARKET, 'market-shift', 'A new mill adds 25 units of supply at every price. Does the price go up or down? Set the new price.', { pMax: 24, qMax: 120, demand: { a: 90, b: 3 }, supply: { c: 10, d: 2 }, shift: { curve: 'supply', by: 25 }, start: 16 });
const coldSnap = seg(MARKET, 'market-shift', 'A cold snap removes 12 units of demand at every price. Does the price go up or down? Set the new price.', { pMax: 16, qMax: 80, demand: { a: 60, b: 4 }, supply: { c: 0, d: 2 }, shift: { curve: 'demand', by: -12 }, start: 10 });
const elasticity = seg(ELASTICITY, 'elasticity', 'Slide the price until the elasticity of demand is 1/2.', { pMax: 20, demand: { a: 90, b: 3 }, goal: { num: 1, den: 2 }, start: 4 });
const unitElastic = seg(ELASTICITY, 'elasticity', 'Slide the price until the elasticity of demand is 1.', { pMax: 20, demand: { a: 60, b: 2 }, goal: { num: 1, den: 1 }, start: 5 });

const rated = (id: string, visual: string, payload: Record<string, unknown>) => seg(RATE_RETURN, visual, undefined, payload, id);
const effective = rated('effective-monthly', 'effective-rate', { kind: 'effective', nominalBps: 2400, periodsPerYear: 12 });
const cardMonths = rated('card-months', 'card-payoff', { kind: 'card', ask: 'months', balanceCents: 200_000, aprBps: 1800, minimumPctBps: 100, floorCents: 2500 });
const cardInterest = rated('card-interest', 'card-payoff', { kind: 'card', ask: 'interest', balanceCents: 500_000, aprBps: 2400, minimumPctBps: 100, floorCents: 2500 });
const npv = rated('npv-project', 'cash-flow', { kind: 'npv', rateBps: 1000, outlayCents: 1_000_000, flowsCents: [400_000, 500_000, 600_000] });
const irr = rated('irr-project', 'cash-flow', { kind: 'irr', outlayCents: 1_000_000, flowsCents: [400_000, 500_000, 600_000] });
const effectiveKey = { target: '26.82', tolerance: { absolute: '0.05' }, review: { absolute: '1' } };
const monthsKey = { target: '131', tolerance: { absolute: '0' }, review: { absolute: '6' } };
const interestKey = { target: '8886.94', tolerance: { absolute: '0.05' }, review: { absolute: '50' } };
const npvKey = { target: '2276.48', tolerance: { absolute: '0.05' }, review: { absolute: '50' } };
const irrKey = { target: '21.65', tolerance: { absolute: '0.1' }, review: { absolute: '1' } };

const cross = seg(SYSTEM, 'line-system', 'Move the marker to the point where the two lines cross.', {
  lines: [{ a: 1, b: 1, c: 5 }, { a: 1, b: -1, c: 1 }], window: { xMin: -2, xMax: 8, yMin: -2, yMax: 8 }, grid: 1, start: [{ x: 0, y: 0 }],
}, 'seg-alg2');
const halfGrid = seg(SYSTEM, 'line-system', 'The lines cross between whole numbers. Move the marker onto the crossing.', {
  lines: [{ a: 1, b: 1, c: 2 }, { a: 1, b: -1, c: 1 }], window: { xMin: -2, xMax: 5, yMin: -2, yMax: 5 }, grid: 0.5, start: [{ x: 0, y: 0 }],
}, 'seg-alg2');
const triangle = seg(SYSTEM, 'line-system', 'Three lines make a triangle. Move a marker onto each corner.', {
  lines: [{ a: 1, b: 1, c: 6 }, { a: 1, b: -1, c: 0 }, { a: 0, b: 1, c: 1 }], window: { xMin: -1, xMax: 7, yMin: -1, yMax: 7 }, grid: 1,
  start: [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }],
}, 'seg-alg2');
const triangleKey = { required: [{ x: 3, y: 3 }, { x: 5, y: 1 }, { x: 1, y: 1 }] };

const PLANE1_FIXTURES: Array<[string, Seg, unknown]> = [
  ['slope-triangle-run', slope, { target: 6 }],
  ['slope-triangle-gentle', gentle, { target: 2 }],
  ['rate-of-change-steps', rate, { target: 20 }],
  ['linked-views-line', linked, { target: { m: 2, b: 3 } }],
  ['break-even-stand', breakEven, { target: 20 }],
  ['cost-structure-average', cost, { target: 40 }],
  ['markup-price', markup, { target: 60 }],
  ['margin-price', margin, { target: 80 }],
  ['market-shift-demand', market, { target: { direction: 'up', price: 12 } }],
  ['market-shift-supply', supplyShock, { target: { direction: 'down', price: 11 } }],
  ['market-shift-cold-snap', coldSnap, { target: { direction: 'down', price: 8 } }],
  ['elasticity-half', elasticity, { target: 10 }],
  ['elasticity-unit', unitElastic, { target: 15 }],
];

describe('plane1, rate-return and line-system F0.4 checkers', () => {
  it('registers a checker for each of the ten types and leaves the exempt table alone', () => {
    expect([...PLANE_SOLVABILITY_TYPES].sort()).toEqual([SLOPE, RATE, LINKED, BREAK_EVEN, COST, MARKUP, MARKET, ELASTICITY, RATE_RETURN, SYSTEM].sort());
    expect(registeredSolvabilityTypes()).toEqual(expect.arrayContaining([...PLANE_SOLVABILITY_TYPES]));
    expect(registeredSolvabilityTypes()).not.toContain('space.ar-table.v2');
  });

  it('accepts every authored fixture with its key and without one', () => {
    const cases: Array<[string, Seg, unknown]> = [
      ...PLANE1_FIXTURES,
      ['effective-monthly', effective, effectiveKey], ['card-months', cardMonths, monthsKey], ['card-interest', cardInterest, interestKey],
      ['npv-project', npv, npvKey], ['irr-project', irr, irrKey],
      ['system-cross', cross, { required: [{ x: 3, y: 2 }] }], ['system-half-grid', halfGrid, { required: [{ x: 1.5, y: 0.5 }] }], ['system-triangle', triangle, triangleKey],
    ];
    for (const [name, target, key] of cases) {
      expect(findings(target), `${name} without a key`).toEqual([]);
      expect(findings(target, key), `${name} with its key`).toEqual([]);
      expect(pack(target, key), `${name} still passes its pack gate`).toEqual([]);
    }
  });

  it('accepts every emitted Horizonte row of the ten types in all three locales, keyed and unkeyed', () => {
    type Row = { locale: string; document: { segments: Array<{ id: string; type: string }> }; answer_keys: Record<string, unknown> };
    const rows = JSON.parse(readFileSync(new URL('../../v2/fixtures/emitted-horizonte.json', import.meta.url), 'utf8')) as Row[];
    const seen = new Set<string>();
    for (const row of rows) {
      for (const segment of row.document.segments) {
        if (!(PLANE_SOLVABILITY_TYPES as readonly string[]).includes(segment.type)) continue;
        seen.add(`${row.locale}|${segment.type}`);
        const document = { segments: [segment], locale: row.locale };
        expect(runSolvabilityGate(document), `${row.locale} ${segment.id} without a key`).toEqual([]);
        expect(runSolvabilityGate(document, row.answer_keys), `${row.locale} ${segment.id} with its key`).toEqual([]);
      }
    }
    for (const type of PLANE_SOLVABILITY_TYPES) for (const locale of ['en-US', 'es-MX', 'pt-BR']) expect(seen.has(`${locale}|${type}`), `${locale} ${type}`).toBe(true);
  });

  it('only reads the prompt when the segment has one', () => {
    expect(codes(seg(SLOPE, 'slope-triangle', undefined, slope.payload))).toEqual([]);
    expect(codes(reword(slope, 'Construye el triángulo con un avance de 3. Arrastra su vértice hasta la recta.'))).toEqual([]);
  });

  describe('slope triangle', () => {
    it('names a run with no whole rise, a run off the grid, a start on the answer and a malformed payload', () => {
      expect(codes(edit(slope, { run: 5 }))).toEqual(['no-solution']);
      expect(codes(edit(slope, { run: 9 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(slope, { start: 6 }))).toEqual(['impossible-state']);
      expect(codes(edit(slope, { start: 9 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(slope, { line: { from: { x: 4, y: 7 }, to: { x: 1, y: 1 } } }))).toEqual(['out-of-bounds']);
      expect(codes(edit(slope, { extra: true }))).toEqual(['impossible-state']);
    });
    it('names a prompt that hides the run', () => {
      expect(codes(reword(slope, 'Build the slope triangle. Drag its top corner up to the line.'))).toEqual(['no-solution']);
      expect(codes(reword(slope, 'Build the slope triangle with a run of 13.'))).toEqual(['no-solution']);
    });
    it('names a key that is not the rise, in a wrong shape or the wrong number', () => {
      expect(codes(slope, { target: 5 })).toEqual(['rubric-accepts-invalid']);
      expect(codes(slope, { target: 6.5 })).toEqual(['rubric-gap']);
      expect(codes(slope, { target: '6' })).toEqual(['rubric-gap']);
      expect(codes(slope, { target: 6, review: true })).toEqual(['rubric-gap']);
      expect(codes(slope, 6)).toEqual(['rubric-gap']);
    });
    it('stays inside a small node budget with a named finding', () => {
      expect(codes(slope, { target: 6 }, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('rate of change', () => {
    it('names a value off the grid, a step left of the origin and a start on the answer', () => {
      expect(codes(edit(rate, { rate: 9 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(rate, { at: 0 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(rate, { start: 20 }))).toEqual(['impossible-state']);
      expect(codes(edit(rate, { grid: { xMax: 10, yMin: 0, yMax: 12 } }))).toEqual(['out-of-bounds']);
    });
    it('names a prompt that hides the rate or the step and a wrong key', () => {
      expect(codes(reword(rate, 'The value is 2 at step 0 and grows each step. Drag the point to step 6.'))).toEqual(['no-solution']);
      expect(codes(reword(rate, 'The value is 2 at step 0 and grows by 3 each step. Drag the point to the end.'))).toEqual(['no-solution']);
      expect(codes(rate, { target: 21 })).toEqual(['rubric-accepts-invalid']);
      expect(codes(rate, {})).toEqual(['rubric-gap']);
    });
    it('stays inside a small node budget', () => {
      expect(codes(rate, undefined, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('linked views', () => {
    it('names points with no whole slope, points the wrong way round and a start on the answer', () => {
      expect(codes(edit(linked, { given: [{ x: 1, y: 5 }, { x: 3, y: 8 }] }))).toEqual(['no-solution']);
      expect(codes(edit(linked, { given: [{ x: 1, y: 5 }, { x: 2, y: 20 }] }))).toEqual(['no-solution']);
      expect(codes(edit(linked, { given: [{ x: 3, y: 9 }, { x: 1, y: 5 }] }))).toEqual(['out-of-bounds']);
      expect(codes(edit(linked, { start: { m: 2, b: 3 } }))).toEqual(['impossible-state']);
      expect(codes(edit(linked, { start: { m: 12, b: 3 } }))).toEqual(['out-of-bounds']);
      expect(codes(edit(linked, { given: [{ x: 1, y: 5 }, 'nope'] }))).toHaveLength(1);
    });
    it('names a prompt that hides a coordinate', () => {
      expect(codes(reword(linked, 'Edit the line until it passes through (1, 5).'))).toEqual(['no-solution']);
    });
    it('names a key that is not the line through both points', () => {
      expect(codes(linked, { target: { m: 2, b: 4 } })).toEqual(['rubric-accepts-invalid']);
      expect(codes(linked, { target: { m: 2 } })).toEqual(['rubric-gap']);
      expect(codes(linked, { target: 2 })).toEqual(['rubric-gap']);
      expect(codes(linked, { target: { m: 2, b: 3, c: 0 } })).toEqual(['rubric-gap']);
    });
    it('stays inside a small node budget', () => {
      expect(codes(linked, undefined, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('break-even and cost structure', () => {
    it('names a profit per unit that does not divide the setup cost, a loss per unit and a break-even off the axis', () => {
      expect(codes(edit(breakEven, { fixed: 61 }))).toEqual(['no-solution']);
      expect(codes(edit(breakEven, { unit: 5 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(breakEven, { maxUnits: 10 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(breakEven, { start: 20 }))).toEqual(['impossible-state']);
    });
    it('names a prompt that hides the price and a wrong key', () => {
      expect(codes(reword(breakEven, 'Setup costs 60. A cup costs 2 to make. Find the cups where sales equal costs.'))).toEqual(['no-solution']);
      expect(codes(breakEven, { target: 15 })).toEqual(['rubric-accepts-invalid']);
    });
    it('names an average goal below the variable cost, off the axis or with no whole answer', () => {
      expect(codes(edit(cost, { goal: { average: 5 } }))).toEqual(['out-of-bounds']);
      expect(codes(edit(cost, { goal: { average: 7 } }))).toEqual(['out-of-bounds']);
      expect(codes(edit(cost, { goal: { average: 9 }, fixed: 121 }))).toEqual(['no-solution']);
      expect(codes(edit(cost, { start: 40 }))).toEqual(['impossible-state']);
      expect(codes(reword(cost, 'Setup costs 120 and each unit costs 5 to make. Find the units where the average cost falls.'))).toEqual(['no-solution']);
      expect(codes(cost, { target: 24 })).toEqual(['rubric-accepts-invalid']);
    });
    it('stays inside a small node budget', () => {
      expect(codes(breakEven, undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(cost, undefined, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('margin and markup', () => {
    it('names a percent with no whole price, a price off the axis, an unknown basis and a start on the answer', () => {
      expect(codes(edit(markup, { percent: 51 }))).toEqual(['no-solution']);
      expect(codes(edit(markup, { percent: 301 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(margin, { percent: 91 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(markup, { maxPrice: 50 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(markup, { basis: 'discount' }))).toHaveLength(1);
      expect(codes(edit(markup, { start: 60 }))).toEqual(['impossible-state']);
    });
    it('names a prompt that hides a number and a key that mixes up markup and margin', () => {
      expect(codes(reword(markup, 'An item costs 40. Set the price with a markup on the cost.'))).toEqual(['no-solution']);
      expect(codes(markup, { target: 50 })).toEqual(['rubric-accepts-invalid']);
      expect(codes(markup, { target: 80 })).toEqual(['rubric-accepts-invalid']);
      expect(codes(edit(markup, { basis: 'margin' }), { target: 80 })).toEqual([]);
      expect(codes(edit(markup, { basis: 'margin' }), { target: 60 })).toEqual(['rubric-accepts-invalid']);
    });
    it('stays inside a small node budget', () => {
      expect(codes(markup, undefined, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('market shift', () => {
    it('names a shift that leaves no whole price, a start on the answer and a market that does not clear', () => {
      expect(codes(edit(market, { shift: { curve: 'demand', by: 5 } }))).toEqual(['no-solution']);
      expect(codes(edit(market, { shift: { curve: 'demand', by: 0 } }))).toEqual(['out-of-bounds']);
      expect(codes(edit(market, { shift: { curve: 'tax', by: 12 } }))).toEqual(['out-of-bounds']);
      expect(codes(edit(market, { demand: { a: 61, b: 4 } }))).toEqual(['no-solution']);
      expect(codes(edit(market, { start: 12 }))).toEqual(['impossible-state']);
      expect(codes(edit(market, { pMax: 11 }))).toHaveLength(1);
    });
    it('names a prompt that hides the size of the shift and keeps a downward shift written without its sign', () => {
      expect(codes(reword(market, 'A heat wave adds demand at every price. Does the price go up or down? Set the new price.'))).toEqual(['no-solution']);
      expect(codes(reword(coldSnap, 'A cold snap removes demand at every price. Does the price go up or down? Set the new price.'))).toEqual(['no-solution']);
    });
    it('names a key with the wrong direction, the wrong price, no direction or a bare number', () => {
      expect(codes(market, { target: { direction: 'down', price: 12 } })).toEqual(['rubric-accepts-invalid']);
      expect(codes(market, { target: { direction: 'up', price: 13 } })).toEqual(['rubric-accepts-invalid']);
      expect(codes(market, { target: { direction: 'unset', price: 12 } })).toEqual(['rubric-gap']);
      expect(codes(market, { target: { price: 12 } })).toEqual(['rubric-gap']);
      expect(codes(market, { target: 12 })).toEqual(['rubric-gap']);
    });
    it('stays inside a small node budget', () => {
      expect(codes(market, undefined, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('elasticity', () => {
    it('names a goal with no whole price, a demand that reaches zero and a start on the answer', () => {
      expect(codes(edit(elasticity, { pMax: 30 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(elasticity, { goal: { num: 1, den: 3 } }))).toEqual(['no-solution']);
      expect(codes(edit(elasticity, { goal: { num: 5, den: 2 } }))).toHaveLength(1);
      expect(codes(edit(elasticity, { start: 10 }))).toEqual(['impossible-state']);
    });
    it('names a prompt that hides the fraction and a wrong key', () => {
      expect(codes(reword(elasticity, 'Slide the price until the elasticity of demand is low.'))).toEqual(['no-solution']);
      expect(codes(elasticity, { target: 15 })).toEqual(['rubric-accepts-invalid']);
      expect(codes(unitElastic, { target: 10 })).toEqual(['rubric-accepts-invalid']);
    });
    it('stays inside a small node budget', () => {
      expect(codes(elasticity, undefined, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('rate and return', () => {
    const severities = (target: Seg, key?: unknown) => findings(target, key).map((finding) => `${finding.code}:${finding.severity}`);
    it('names a case with nothing to find, flows outside what the case takes and an IRR with no break-even', () => {
      expect(codes(edit(effective, { periodsPerYear: 1 }))).toEqual(['impossible-state']);
      expect(codes(edit(effective, { nominalBps: 100, periodsPerYear: 2 }))).toEqual(['impossible-state']);
      expect(codes(edit(npv, { flowsCents: [4_000_000_000, 4_000_000_000, 4_000_000_000] }))).toEqual(['impossible-state']);
      expect(codes(edit(irr, { flowsCents: [400_000, 500_000] }))).toEqual(['no-solution']);
      expect(codes(edit(irr, { flowsCents: [4_000_000, 4_000_000] }))).toEqual(['out-of-bounds']);
      expect(codes(edit(irr, { kind: 'bond' }))).toEqual(['impossible-state']);
    });
    it('names a key whose target is not the model answer or whose shape cannot be read', () => {
      expect(codes(effective, { ...effectiveKey, target: '24' })).toEqual(['rubric-accepts-invalid']);
      expect(codes(irr, { ...irrKey, target: '21.7' })).toEqual(['rubric-accepts-invalid']);
      expect(codes(npv, {})).toEqual(['rubric-gap']);
      expect(codes(npv, { ...npvKey, target: 2276.48 })).toEqual(['rubric-gap']);
      expect(codes(npv, { ...npvKey, tolerance: { absolute: '-1' } })).toEqual(['rubric-gap']);
      expect(codes(npv, { ...npvKey, extra: 1 })).toEqual(['rubric-gap']);
      expect(codes(npv, { ...npvKey, review: { absolute: '0.05' } })).toEqual(['rubric-gap']);
    });
    it('names the shortcut a band lets through: the nominal rate, the undiscounted total, the flat interest and the simple average', () => {
      const daily = rated('effective-daily', 'effective-rate', { kind: 'effective', nominalBps: 150, periodsPerYear: 365 });
      expect(codes(daily, { target: '1.51', tolerance: { absolute: '0.05' } })).toEqual(['rubric-accepts-invalid']);
      expect(codes(daily, { target: '1.51', tolerance: { absolute: '0.005' } })).toEqual([]);
      expect(codes(npv, { ...npvKey, tolerance: { absolute: '3000' }, review: { absolute: '4000' } })).toEqual(['rubric-accepts-invalid']);
      expect(codes(irr, { ...irrKey, tolerance: { absolute: '5' }, review: { absolute: '6' } })).toEqual(['rubric-accepts-invalid']);
      expect(codes(cardInterest, { ...interestKey, tolerance: { absolute: '15000' }, review: { absolute: '16000' } })).toEqual(['rubric-accepts-invalid']);
    });
    it('only warns about a shortcut the guidance band would let through when there is no key yet', () => {
      const daily = rated('effective-daily', 'effective-rate', { kind: 'effective', nominalBps: 150, periodsPerYear: 365 });
      expect(severities(daily)).toEqual(['rubric-accepts-invalid:review']);
      expect(severities(daily, { target: '1.51', tolerance: { absolute: '0.05' } })).toEqual(['rubric-accepts-invalid:block']);
    });
    it('names a months band that spans two whole months and a band as wide as the answer range', () => {
      expect(codes(cardMonths, { target: '131', tolerance: { absolute: '1' }, review: { absolute: '6' } })).toEqual(['rubric-accepts-invalid']);
      expect(codes(effective, { target: '26.82', tolerance: { absolute: '2000' }, review: { absolute: '3000' } })).toContain('vacuous-rubric');
    });
    it('names an IRR band that no tenth of a percent on the dial can reach', () => {
      expect(codes(irr, { target: '21.65', tolerance: { absolute: '0.04' }, review: { absolute: '1' } })).toEqual(['dead-end']);
      expect(codes(irr, { target: '21.65', tolerance: { absolute: '0.05' }, review: { absolute: '1' } })).toEqual([]);
    });
    it('stays inside a small node budget', () => {
      expect(codes(cardMonths, monthsKey, 3)).toEqual(['budget-exceeded']);
      expect(codes(cardInterest, undefined, 3)).toEqual(['budget-exceeded']);
      expect(codes(irr, irrKey, 3)).toEqual(['budget-exceeded']);
    });
  });

  describe('line system', () => {
    it('names two copies of one line, which cross everywhere', () => {
      expect(codes(edit(cross, { lines: [{ a: 1, b: 1, c: 5 }, { a: 2, b: 2, c: 10 }] }))).toEqual(['ambiguous-solution']);
    });
    it('names more markers than crossings and more crossings than markers', () => {
      expect(codes(edit(cross, { start: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }))).toEqual(['no-solution']);
      expect(codes(edit(triangle, { start: [{ x: 1, y: 0 }] }))).toEqual(['ambiguous-solution']);
      expect(codes(edit(triangle, { start: [{ x: 1, y: 0 }, { x: 0, y: 0 }] }))).toEqual(['ambiguous-solution']);
    });
    it('names a crossing between grid lines, a marker outside the window and a window off the grid', () => {
      expect(codes(edit(halfGrid, { grid: 1 }))).toEqual(['out-of-bounds']);
      expect(codes(edit(cross, { start: [{ x: 99, y: 0 }] }))).toEqual(['out-of-bounds']);
      expect(codes(edit(cross, { start: [{ x: 0.5, y: 0 }] }))).toEqual(['out-of-bounds']);
      expect(codes(edit(cross, { window: { xMin: -2, xMax: 8, yMin: -2, yMax: 7.5 } }))).toEqual(['out-of-bounds']);
      expect(codes(edit(cross, { window: { xMin: -2, xMax: 8, yMin: 0, yMax: 2 } }))).toEqual(['out-of-bounds']);
    });
    it('names markers on one spot, markers already on the crossings and a malformed payload', () => {
      expect(codes(edit(triangle, { start: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }] }))).toEqual(['overlap']);
      expect(codes(edit(cross, { start: [{ x: 3, y: 2 }] }))).toEqual(['impossible-state']);
      expect(codes(edit(triangle, { start: [{ x: 5, y: 1 }, { x: 1, y: 1 }, { x: 3, y: 3 }] }))).toEqual(['impossible-state']);
      expect(codes(edit(cross, { grid: 3 }))).toEqual(['impossible-state']);
      expect(codes(edit(cross, { extra: 1 }))).toEqual(['impossible-state']);
    });
    it('names a key that requires a point that is not a crossing, misses one or lists one twice', () => {
      expect(codes(cross, { required: [{ x: 3, y: 3 }] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(triangle, { required: [{ x: 3, y: 3 }, { x: 5, y: 1 }, { x: 2, y: 2 }] })).toEqual(['rubric-accepts-invalid', 'rubric-gap']);
      expect(codes(triangle, { required: [{ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 1, y: 1 }] })).toContain('rubric-gap');
      expect(codes(triangle, { required: [{ x: 3, y: 3 }, { x: 5, y: 1 }] })).toEqual(['rubric-gap']);
      expect(codes(cross, { required: [{ x: 3, y: 2 }, { x: 5, y: 1 }] })).toContain('rubric-accepts-invalid');
    });
    it('keeps a key in any order and names a key of the wrong shape', () => {
      expect(codes(triangle, { required: [{ x: 1, y: 1 }, { x: 3, y: 3 }, { x: 5, y: 1 }] })).toEqual([]);
      expect(codes(cross, { required: [{ x: 3, y: 2 }], extra: 1 })).toEqual(['rubric-gap']);
      expect(codes(cross, { required: [{ x: 3 }] })).toEqual(['rubric-gap']);
      expect(codes(cross, { required: 'x' })).toEqual(['rubric-gap']);
      expect(codes(cross, { required: [{ x: 3, y: Number.NaN }] })).toEqual(['rubric-gap']);
      expect(codes(cross, [])).toEqual(['rubric-gap']);
    });
    it('stays inside a small node budget', () => {
      expect(codes(cross, { required: [{ x: 3, y: 2 }] }, 3)).toEqual(['budget-exceeded']);
    });
  });
});
