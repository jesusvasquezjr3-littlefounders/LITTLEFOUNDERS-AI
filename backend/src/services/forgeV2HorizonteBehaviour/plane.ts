import { product, range, type HzBuilder, type Json } from './shared.js';

const single = (key: string, bounds: (p: Json) => [number, number], start: (p: Json) => number): HzBuilder => (p, r) => {
  const [low, high] = bounds(p);
  return {
    inRange: range(low, high).filter((value) => value !== start(p)).map((value) => ({ [key]: value })),
    invalid: [{ [key]: low - 1 }, { [key]: high + 1 }, { [key]: low + 0.5 }, { [key]: String(low) }, {}, { [key]: low, extra: 1 }],
    initial: { [key]: start(p) },
    expectMet: (response) => response[key] === r.target,
  };
};

const linkedViews: HzBuilder = (p, r) => {
  const grid = p.grid as { yMin: number; yMax: number };
  return {
    inRange: product([range(-9, 9), range(grid.yMin, grid.yMax)]).filter(([m, b]) => !(m === p.start.m && b === p.start.b)).map(([m, b]) => ({ m, b })),
    invalid: [{ m: 10, b: 0 }, { m: -10, b: 0 }, { m: 0, b: grid.yMax + 1 }, { m: 0, b: grid.yMin - 1 }, { m: 1.5, b: 0 }, { m: 1 }, { m: 1, b: 0, extra: 1 }],
    initial: { m: p.start.m, b: p.start.b },
    expectMet: (response) => response.m === r.target.m && response.b === r.target.b,
  };
};

const marketShift: HzBuilder = (p, r) => ({
  inRange: product<string | number>([['unset', 'up', 'down'], range(0, p.pMax)]).filter(([direction, price]) => !(direction === 'unset' && price === p.start)).map(([direction, price]) => ({ direction, price })),
  invalid: [{ direction: 'sideways', price: 0 }, { direction: 'up', price: p.pMax + 1 }, { direction: 'up', price: -1 }, { direction: 'up', price: 1.5 }, { direction: 'up' }, { price: 0 }, { direction: 'up', price: 0, extra: 1 }],
  initial: { direction: 'unset', price: p.start },
  expectMet: (response) => response.direction === r.target.direction && response.price === r.target.price,
});

export const PLANE_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'alg.slope-triangle.v2': single('rise', (p) => [0, p.grid.yMax - p.line.from.y], (p) => p.start),
  'alg.rate-of-change.v2': single('y', (p) => [p.grid.yMin, p.grid.yMax], (p) => p.start),
  'alg.linked-views.v2': linkedViews,
  'fin.break-even.v2': single('units', (p) => [0, p.maxUnits], (p) => p.start),
  'fin.cost-structure.v2': single('units', (p) => [1, p.maxUnits], (p) => p.start),
  'fin.margin-markup.v2': single('price', (p) => [0, p.maxPrice], (p) => p.start),
  'econ.market-shift.v2': marketShift,
  'econ.elasticity.v2': single('price', (p) => [1, p.pMax], (p) => p.start),
};
