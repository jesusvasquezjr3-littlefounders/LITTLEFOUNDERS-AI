import { describe, expect, it } from 'vitest';
import { V2_SEGMENT_CAPABILITIES } from '../../v2/contract.js';
import { HORIZONTE_FORGE_CAPABILITIES, HORIZONTE_FORGE_PACKS, horizonteGuidanceFor, horizontePieceGates } from '../../v2/horizonte/index.js';
import { PLANE1_CAPABILITIES, plane1 } from '../../v2/horizonte/plane1.js';

const SLOPE = 'alg.slope-triangle.v2';
const RATE = 'alg.rate-of-change.v2';
const LINKED = 'alg.linked-views.v2';
const BREAK_EVEN = 'fin.break-even.v2';
const COST = 'fin.cost-structure.v2';
const MARKUP = 'fin.margin-markup.v2';
const MARKET = 'econ.market-shift.v2';
const ELASTICITY = 'econ.elasticity.v2';

type Doc = { segments: Array<Record<string, unknown>> };
const doc = (type: string, visual: string, prompt: string, payload: unknown, id = 'seg-plane'): Doc => ({ segments: [{ id, type, visual: { type: visual }, prompt, payload }] });
const gate = (document: Doc, key?: unknown) => horizontePieceGates(document, key === undefined ? undefined : { 'seg-plane': key });
const messages = (document: Doc, key?: unknown) => gate(document, key).map((problem) => problem.message);
const withPayload = (document: Doc, patch: Record<string, unknown>): Doc => ({ segments: [{ ...document.segments[0]!, payload: { ...(document.segments[0]!.payload as object), ...patch } }] });
const withPrompt = (document: Doc, prompt: string): Doc => ({ segments: [{ ...document.segments[0]!, prompt }] });

const grid = { xMax: 8, yMin: 0, yMax: 8 };
const slope = doc(SLOPE, 'slope-triangle', 'Build the slope triangle with a run of 3. Drag its top corner up to the line.', { grid, line: { from: { x: 1, y: 1 }, to: { x: 4, y: 7 } }, run: 3, start: 2 });
const rate = doc(RATE, 'rate-table-graph', 'The value is 2 at step 0 and grows by 3 each step. Drag the point to step 6.', { grid: { xMax: 10, yMin: 0, yMax: 24 }, origin: { x: 0, y: 2 }, rate: 3, at: 6, start: 8 });
const linked = doc(LINKED, 'linked-views', 'Edit the line until it passes through (1, 5) and (3, 9).', { grid: { xMax: 6, yMin: 0, yMax: 20 }, given: [{ x: 1, y: 5 }, { x: 3, y: 9 }], start: { m: 1, b: 0 } });
const breakEven = doc(BREAK_EVEN, 'break-even', 'Setup costs 60. A cup costs 2 to make and sells for 5. Find the cups where sales equal costs.', { fixed: 60, price: 5, unit: 2, maxUnits: 40, start: 5 });
const cost = doc(COST, 'cost-structure', 'Setup costs 120 and each unit costs 5 to make. Find the units where the average cost per unit falls to 8.', { fixed: 120, variable: 5, maxUnits: 50, goal: { average: 8 }, start: 10 });
const markup = doc(MARKUP, 'margin-markup', 'An item costs 40. Set the price with a markup of 50% on the cost.', { cost: 40, basis: 'markup', percent: 50, maxPrice: 100, start: 40 });
const margin = doc(MARKUP, 'margin-markup', 'An item costs 60. Set the price for a margin of 25% of the price.', { cost: 60, basis: 'margin', percent: 25, maxPrice: 120, start: 60 });
const market = doc(MARKET, 'market-shift', 'A heat wave adds 12 units of demand at every price. Does the price go up or down? Set the new price.', { pMax: 16, qMax: 80, demand: { a: 60, b: 4 }, supply: { c: 0, d: 2 }, shift: { curve: 'demand', by: 12 }, start: 10 });
const elasticity = doc(ELASTICITY, 'elasticity', 'Slide the price until the elasticity of demand is 1/2.', { pMax: 20, demand: { a: 90, b: 3 }, goal: { num: 1, den: 2 }, start: 4 });

describe('plane1 pack in the Forge (F1.9, F1.11, F1.12)', () => {
  it('declares the capability literal and the emitter map spreads it', () => {
    for (const type of Object.keys(PLANE1_CAPABILITIES) as Array<keyof typeof PLANE1_CAPABILITIES>) {
      expect(HORIZONTE_FORGE_CAPABILITIES[type]).toEqual(PLANE1_CAPABILITIES[type]);
      expect((V2_SEGMENT_CAPABILITIES as Record<string, readonly string[]>)[type]).toEqual(PLANE1_CAPABILITIES[type]);
    }
    expect(PLANE1_CAPABILITIES[SLOPE]).toEqual(['visual.slope-triangle.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1']);
    expect(Object.keys(PLANE1_CAPABILITIES)).toHaveLength(8);
    expect(HORIZONTE_FORGE_PACKS).toContain(plane1);
  });

  it('adds authoring guidance only for the types a skeleton uses, with the age scopes and the prompt rules', () => {
    expect(horizonteGuidanceFor([SLOPE]).join('\n')).toMatch(/ages 13-17 only.*never the rise/s);
    expect(horizonteGuidanceFor([RATE]).join('\n')).toMatch(/never the value reached/);
    expect(horizonteGuidanceFor([LINKED]).join('\n')).toMatch(/all four coordinates/);
    expect(horizonteGuidanceFor([BREAK_EVEN]).join('\n')).toMatch(/never the break-even/);
    expect(horizonteGuidanceFor([COST]).join('\n')).toMatch(/goal average/);
    expect(horizonteGuidanceFor([MARKUP]).join('\n')).toMatch(/markup on the cost or a margin of the price/);
    expect(horizonteGuidanceFor([MARKET]).join('\n')).toMatch(/never names the direction/);
    expect(horizonteGuidanceFor([ELASTICITY]).join('\n')).toMatch(/never the price/);
    expect(horizonteGuidanceFor(['money.allocation.v2'])).toEqual([]);
  });

  it('accepts every authored example with its key and without one', () => {
    const keyed: Array<[Doc, unknown]> = [
      [slope, { target: 6 }], [rate, { target: 20 }], [linked, { target: { m: 2, b: 3 } }], [breakEven, { target: 20 }], [cost, { target: 40 }],
      [markup, { target: 60 }], [margin, { target: 80 }], [market, { target: { direction: 'up', price: 12 } }], [elasticity, { target: 10 }],
    ];
    for (const [document, key] of keyed) {
      expect(gate(document, key)).toEqual([]);
      expect(gate(document)).toEqual([]);
    }
  });

  it('refuses a mismatched visual and a missing payload', () => {
    expect(messages(doc(SLOPE, 'rate-table-graph', slope.segments[0]!.prompt as string, slope.segments[0]!.payload))[0]).toMatch(/visual must be slope-triangle/);
    expect(messages({ segments: [{ id: 'seg-plane', type: SLOPE, visual: { type: 'slope-triangle' }, prompt: 'x' }] })[0]).toMatch(/payload is missing/);
    expect(gate(withPayload(slope, { run: 5 }))[0]).toMatchObject({ gate: 4, segmentId: 'seg-plane' });
  });

  describe('slope triangle', () => {
    it('refuses a run with no whole rise, a start on the answer, a wrong key and a prompt without the run', () => {
      expect(messages(withPayload(slope, { run: 5 }))[0]).toMatch(/whole number that stays on the grid/);
      expect(messages(withPayload(slope, { run: 9 }))[0]).toMatch(/run is 1 to 8/);
      expect(messages(withPayload(slope, { start: 6 }))[0]).toMatch(/starts? away from the answer/);
      expect(messages(withPayload(slope, { start: 9 }))[0]).toMatch(/rise starts on the grid/);
      expect(messages(withPayload(slope, { line: { from: { x: 4, y: 7 }, to: { x: 1, y: 1 } } }))[0]).toMatch(/line climbs/);
      expect(messages(withPayload(slope, { grid: { xMax: 3, yMin: 0, yMax: 8 } }))[0]).toMatch(/grid starts at x 0/);
      expect(messages(slope, { target: 5 })[0]).toMatch(/must be 6/);
      expect(messages(withPrompt(slope, 'Build the slope triangle. Drag its top corner up to the line.'))[0]).toMatch(/write its numbers in digits/);
      expect(messages(withPrompt(slope, 'Build the slope triangle with a run of 13.'))[0]).toMatch(/write its numbers in digits/);
    });
  });

  describe('rate of change', () => {
    it('refuses a value off the grid, a step left of the origin, a start on the answer and a hidden rate', () => {
      expect(messages(withPayload(rate, { rate: 8 }))[0]).toMatch(/stays on the grid/);
      expect(messages(withPayload(rate, { rate: 9 }))[0]).toMatch(/1 to 8 per step/);
      expect(messages(withPayload(rate, { at: 0 }))[0]).toMatch(/right of the origin/);
      expect(messages(withPayload(rate, { start: 20 }))[0]).toMatch(/starts? away from the answer/);
      expect(messages(rate, { target: 21 })[0]).toMatch(/must be 20/);
      expect(messages(withPrompt(rate, 'The value is 2 at step 0 and grows each step. Drag the point to step 6.'))[0]).toMatch(/write its numbers in digits/);
    });
  });

  describe('linked views', () => {
    it('refuses points with no whole slope, an intercept off the grid, a start on the answer and a hidden point', () => {
      expect(messages(withPayload(linked, { given: [{ x: 1, y: 5 }, { x: 3, y: 8 }] }))[0]).toMatch(/slope through the points/);
      expect(messages(withPayload(linked, { given: [{ x: 3, y: 9 }, { x: 1, y: 5 }] }))[0]).toMatch(/second right of the first/);
      expect(messages(withPayload(linked, { given: [{ x: 1, y: 5 }, { x: 2, y: 20 }] }))[0]).toMatch(/slope through the points/);
      expect(messages(withPayload(linked, { start: { m: 2, b: 3 } }))[0]).toMatch(/starts? away from the answer/);
      expect(messages(withPayload(linked, { start: { m: 12, b: 3 } }))[0]).toMatch(/start in range/);
      expect(messages(linked, { target: { m: 2, b: 4 } })[0]).toMatch(/slope 2 and intercept 3/);
      expect(messages(withPrompt(linked, 'Edit the line until it passes through (1, 5).'))[0]).toMatch(/both points in digits/);
    });
  });

  describe('break-even and cost structure', () => {
    it('keeps the break-even whole and inside the axis', () => {
      expect(messages(withPayload(breakEven, { fixed: 61 }))[0]).toMatch(/divides by the profit per unit/);
      expect(messages(withPayload(breakEven, { unit: 5 }))[0]).toMatch(/below it/);
      expect(messages(withPayload(breakEven, { maxUnits: 10 }))[0]).toMatch(/within the unit limit/);
      expect(messages(withPayload(breakEven, { start: 20 }))[0]).toMatch(/starts? away from the answer/);
      expect(messages(breakEven, { target: 15 })[0]).toMatch(/must be 20/);
      expect(messages(withPrompt(breakEven, 'Setup costs 60. A cup costs 2 to make. Find the cups where sales equal costs.'))[0]).toMatch(/write its numbers in digits/);
    });

    it('keeps the average cost goal above the variable cost and reachable', () => {
      expect(messages(withPayload(cost, { goal: { average: 5 } }))[0]).toMatch(/above the variable cost/);
      expect(messages(withPayload(cost, { goal: { average: 7 } }))[0]).toMatch(/within the unit limit/);
      expect(messages(withPayload(cost, { goal: { average: 9 }, fixed: 121 }))[0]).toMatch(/divides by the gap/);
      expect(messages(withPayload(cost, { start: 40 }))[0]).toMatch(/starts? away from the answer/);
      expect(messages(cost, { target: 24 })[0]).toMatch(/must be 40/);
      expect(messages(withPrompt(cost, 'Setup costs 120 and each unit costs 5 to make. Find the units where the average cost falls.'))[0]).toMatch(/write its numbers in digits/);
    });
  });

  describe('margin and markup', () => {
    it('prices a markup on the cost and a margin on the price, whole and inside the limit', () => {
      expect(messages(withPayload(markup, { percent: 51 }))[0]).toMatch(/whole price/);
      expect(messages(withPayload(markup, { percent: 301 }))[0]).toMatch(/markup is a whole percent from 5 to 300/);
      expect(messages(withPayload(margin, { percent: 91 }))[0]).toMatch(/margin is a whole percent from 5 to 90/);
      expect(messages(withPayload(markup, { maxPrice: 50 }))[0]).toMatch(/within the price limit/);
      expect(messages(withPayload(markup, { basis: 'discount' }))[0]).toMatch(/markup or margin/);
      expect(messages(withPayload(markup, { start: 60 }))[0]).toMatch(/starts? away from the answer/);
      expect(messages(markup, { target: 50 })[0]).toMatch(/must be 60/);
      expect(gate(withPayload(markup, { basis: 'margin' }), { target: 80 }).map((problem) => problem.message)).toEqual([]);
      expect(messages(withPrompt(markup, 'An item costs 40. Set the price with a markup on the cost.'))[0]).toMatch(/cost and the percent in digits/);
    });
  });

  describe('market shift', () => {
    it('keeps both markets clearing at whole numbers and asks for the direction and the price', () => {
      expect(messages(withPayload(market, { shift: { curve: 'demand', by: 5 } }))[0]).toMatch(/After the shift the market clears/);
      expect(messages(withPayload(market, { shift: { curve: 'demand', by: 0 } }))[0]).toMatch(/1 to 60 units/);
      expect(messages(withPayload(market, { shift: { curve: 'tax', by: 12 } }))[0]).toMatch(/1 to 60 units/);
      expect(messages(withPayload(market, { demand: { a: 61, b: 4 } }))[0]).toMatch(/market clears at a whole price/);
      expect(messages(withPayload(market, { start: 12 }))[0]).toMatch(/starts? away from the answer/);
      expect(messages(withPayload(market, { pMax: 11 }))[0]).toMatch(/market clears at a whole price|After the shift/);
      expect(messages(market, { target: { direction: 'down', price: 12 } })[0]).toMatch(/up at price 12/);
      expect(messages(market, { target: { direction: 'up', price: 13 } })[0]).toMatch(/up at price 12/);
      expect(messages(market, { target: 12 })[0]).toMatch(/up at price 12/);
      expect(messages(withPrompt(market, 'A heat wave adds demand at every price. Does the price go up or down? Set the new price.'))[0]).toMatch(/size of the shift in digits/);
    });

    it('names the size of a downward shift without its sign', () => {
      const down = withPrompt(withPayload(market, { shift: { curve: 'demand', by: -12 } }), 'A cold snap removes 12 units of demand at every price. Does the price go up or down? Set the new price.');
      expect(gate(down, { target: { direction: 'down', price: 8 } })).toEqual([]);
    });
  });

  describe('elasticity', () => {
    it('reaches the goal at one whole price and says the fraction in digits', () => {
      expect(messages(withPayload(elasticity, { pMax: 30 }))[0]).toMatch(/stays above zero/);
      expect(messages(withPayload(elasticity, { goal: { num: 1, den: 3 } }))[0]).toMatch(/whole price within the limit/);
      expect(messages(withPayload(elasticity, { goal: { num: 5, den: 2 } }))[0]).toMatch(/fraction of whole numbers/);
      expect(messages(withPayload(elasticity, { start: 10 }))[0]).toMatch(/starts? away from the answer/);
      expect(messages(elasticity, { target: 15 })[0]).toMatch(/must be 10/);
      expect(messages(withPrompt(elasticity, 'Slide the price until the elasticity of demand is low.'))[0]).toMatch(/write its numbers in digits/);
      const unit = withPrompt(withPayload(elasticity, { demand: { a: 60, b: 2 }, goal: { num: 1, den: 1 }, start: 5 }), 'Slide the price until the elasticity of demand is 1.');
      expect(gate(unit, { target: 15 })).toEqual([]);
    });
  });
});
