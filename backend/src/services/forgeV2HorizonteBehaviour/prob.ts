import { add, cmp, div, eq, fromDecimal, mul, q, sub, toDecimal, ONE, ZERO, type Q } from './rational.js';
import { even, range, unique, type HzBuilder, type Json } from './shared.js';

const share = (ratio: Json): Q => q(ratio.part, ratio.whole);

function textOf(value: Q, places: number): string | null {
  if (cmp(value, ZERO) < 0 || cmp(value, ONE) > 0) return null;
  const scale = 10n ** BigInt(places);
  const rounded = (2n * value.n * scale + value.d) / (2n * value.d);
  return toDecimal(q(rounded, scale));
}

const FRACTION = /^-?(0|[1-9]\d{0,14})\/[1-9]\d{0,14}$/;

function readText(text: unknown): Q | null {
  if (typeof text !== 'string') return null;
  const plain = fromDecimal(text);
  if (plain) return plain;
  if (!FRACTION.test(text)) return null;
  const [top, bottom] = text.split('/');
  return q(BigInt(top!), BigInt(bottom!));
}

const bayes: HzBuilder = (p, r) => {
  const prior = share(p.prior); const hit = share(p.hit); const alarm = share(p.alarm);
  const sick = mul(prior, p.ask === 'positive' ? hit : sub(ONE, hit));
  const well = mul(sub(ONE, prior), p.ask === 'positive' ? alarm : sub(ONE, alarm));
  const target = div(sick, add(sick, well));
  const allowance = fromDecimal(r.tolerance?.absolute) ?? ZERO;
  const review = fromDecimal(r.review?.absolute) ?? allowance;
  const tiny = q(1, 10_000);
  const offsets = [ZERO, div(allowance, q(2)), allowance, add(allowance, tiny), add(allowance, q(1, 1000)), review, add(review, tiny), q(1, 20), q(1, 5), q(1, 2)];
  const near = offsets.flatMap((offset) => [add(target, offset), sub(target, offset)]);
  const decimals = [...range(0, 100).map((hundredth) => q(hundredth, 100)), ...near].flatMap((value) => [textOf(value, 2), textOf(value, 3), textOf(value, 4), textOf(value, 6)]);
  const fractions: string[] = [];
  for (let bottom = 1; bottom <= 16; bottom += 1) for (let top = 0; top <= bottom; top += 1) fractions.push(`${top}/${bottom}`);
  const reduced = `${target.n}/${target.d}`;
  const texts = unique([
    ...decimals.filter((text): text is string => text !== null), ...fractions, reduced, `${target.n * 2n}/${target.d * 2n}`,
    '0.0', '1.0', '0.50', '1.000000000000', '0.000000000001',
  ]).filter((text) => text !== '');
  const long = '0.'.padEnd(34, '1');
  return {
    inRange: texts.map((value) => ({ value })),
    invalid: [
      { value: '2' }, { value: '1.5' }, { value: '-0.1' }, { value: '1.000000000001' }, { value: '0.1234567890123' }, { value: 'abc' }, { value: '1,5' }, { value: '25%' },
      { value: ' 0.5' }, { value: '0.5 ' }, { value: '01' }, { value: '.5' }, { value: '5.' }, { value: '1/0' }, { value: '3/2' }, { value: '-1/2' }, { value: long },
      { value: 0.5 }, { value: null }, { value: ['0.5'] }, {}, { value: '0.5', extra: 1 },
    ],
    initial: { value: '' },
    expectMet: (response) => {
      const value = readText(response.value);
      return value !== null && cmp(value, sub(target, allowance)) >= 0 && cmp(value, add(target, allowance)) <= 0;
    },
  };
};

const SLOTS = ['has', 'lacks', 'has-pos', 'has-neg', 'lacks-pos', 'lacks-neg'];

const tree: HzBuilder = (p) => {
  const people = (count: number, ratio: Json): number => (count * ratio.part) / ratio.whole;
  const has = people(p.population, p.prior);
  const lacks = p.population - has;
  const hasPos = people(has, p.hit);
  const lacksPos = people(lacks, p.alarm);
  const counts = [has, lacks, hasPos, has - hasPos, lacksPos, lacks - lacksPos];
  if (!counts.every(Number.isInteger)) return null;
  const answer = counts.map((count) => `n-${count}`);
  const chips = (p.chips as number[]).map((chip) => `n-${chip}`);
  const place = (placement: Array<string | null>, explicitEmpty = false): Json => ({
    slots: Object.fromEntries(SLOTS.flatMap((slot, index) => (placement[index] ? [[slot, [placement[index]]]] : explicitEmpty ? [[slot, []]] : []))),
  });
  const states: Array<Array<string | null>> = [];
  for (let mask = 1; mask < 2 ** SLOTS.length; mask += 1) states.push(answer.map((chip, index) => ((mask >> index) & 1 ? chip : null)));
  SLOTS.forEach((_, slot) => chips.forEach((chip) => states.push(SLOTS.map((__, index) => (index === slot ? chip : null)))));
  SLOTS.forEach((_, slot) => chips.forEach((chip) => states.push(answer.map((original, index) => (index === slot ? chip : original)))));
  for (let first = 0; first < SLOTS.length; first += 1) for (let second = first + 1; second < SLOTS.length; second += 1) {
    states.push(answer.map((chip, index) => (index === first ? answer[second]! : index === second ? answer[first]! : chip)));
  }
  let seed = 12345;
  const next = (bound: number): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed >>> 8) % bound; };
  for (let draw = 0; draw < 400; draw += 1) {
    const pool = [...chips];
    states.push(SLOTS.map(() => (next(4) === 0 ? null : pool.splice(next(pool.length), 1)[0] ?? null)));
  }
  const usable = states.filter((state) => state.some((chip) => chip !== null) && new Set(state.filter((chip) => chip !== null)).size === state.filter((chip) => chip !== null).length);
  return {
    inRange: unique([...usable.map((state) => place(state)), ...even(usable, 40).map((state) => place(state, true)), { slots: Object.fromEntries([...SLOTS].reverse().map((slot, index) => [slot, [answer[SLOTS.length - 1 - index]]])) }]),
    invalid: [
      { slots: { has: [answer[0]], lacks: [answer[0]] } }, { slots: { has: [answer[0], answer[1]] } }, { slots: { ghost: [answer[0]] } }, { slots: { has: ['n-0'] } },
      { slots: { has: answer[0] } }, { slots: { has: [7] } }, { slots: null }, { slots: [] }, { slots: { has: [answer[0]] }, extra: 1 }, {}, { slots: { has: [] } },
    ],
    initial: { slots: {} },
    expectMet: (response) => SLOTS.every((slot, index) => Array.isArray(response.slots[slot]) && response.slots[slot].length === 1 && response.slots[slot][0] === answer[index]),
  };
};

const regression: HzBuilder = (p, r) => {
  const points = p.points as Array<{ x: number; y: number }>;
  const count = points.length;
  const sx = points.reduce((sum, point) => sum + point.x, 0);
  const sy = points.reduce((sum, point) => sum + point.y, 0);
  const sxx = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const sxy = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const slope = q(count * sxy - sx * sy, count * sxx - sx * sx);
  const intercept = div(sub(q(sy), mul(slope, q(sx))), q(count));
  const allowance = fromDecimal(r.parameter_tolerance?.absolute) ?? ZERO;
  const text = (value: Q): string => toDecimal(value)!;
  const tenths = (value: number): Q => q(value, 10);
  const slopes = range(-30, 30).map(tenths);
  const intercepts = range(-50, 150).map(tenths);
  const start = { m: tenths(p.start.slope), b: tenths(p.start.intercept) };
  const hundredth = q(1, 100);
  const steps = [0, 4, 5, 6, 30, 31].flatMap((step) => [mul(q(step), hundredth), mul(q(-step), hundredth)]);
  const within = (value: Q, low: Q, high: Q): boolean => cmp(value, low) >= 0 && cmp(value, high) <= 0;
  const pairs: Array<[Q, Q]> = [
    ...even(slopes, 25).flatMap((m) => even(intercepts, 61).map((b): [Q, Q] => [m, b])),
    ...slopes.map((m): [Q, Q] => [m, intercept]), ...intercepts.map((b): [Q, Q] => [slope, b]),
    ...steps.flatMap((dm) => steps.map((db): [Q, Q] => [add(slope, dm), add(intercept, db)])),
    ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dm, db]): [Q, Q] => [add(start.m, tenths(dm!)), add(start.b, tenths(db!))]),
    [slope, intercept],
  ];
  const reachable = pairs.filter(([m, b]) => within(m, tenths(-30), tenths(30)) && within(b, tenths(-50), tenths(150)) && !(eq(m, start.m) && eq(b, start.b)));
  const response = (m: string, b: string): Json => ({ family: 'line', params: { m, b } });
  const states = unique(reachable.map(([m, b]) => response(text(m), text(b))));
  const padded = (value: string, places: number): string => { const [whole, fraction = ''] = value.split('.'); return `${whole}.${fraction.padEnd(places, '0')}`; };
  const spelled = [response(padded(text(slope), 2), text(intercept)), response(text(slope), padded(text(intercept), 3))];
  return {
    inRange: unique([...states, ...spelled.filter((state) => !(state.params.m === text(start.m) && state.params.b === text(start.b)))]),
    invalid: [
      response('3.1', '0'), response('-3.1', '0'), response('0', '15.1'), response('0', '-5.1'), response('abc', '0'), response('', '0'), response('1,5', '0'), response('0', ''),
      { family: 'quadratic', params: { a: '1', b: '0', c: '0' } }, { family: 'line', params: { m: '1' } }, { family: 'line', params: { m: '1', b: '0', c: '0' } },
      { family: 'line', params: { m: 1, b: 0 } }, { family: 'line', params: { m: '1', b: '0' }, extra: 1 }, { params: { m: '1', b: '0' } }, { family: 'line' },
    ],
    initial: response(text(start.m), text(start.b)),
    expectMet: (answer) => {
      const m = fromDecimal(answer.params.m); const b = fromDecimal(answer.params.b);
      return m !== null && b !== null && within(m, sub(slope, allowance), add(slope, allowance)) && within(b, sub(intercept, allowance), add(intercept, allowance));
    },
  };
};

export const PROB_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'prob.bayes.v2': bayes,
  'prob.tree.v2': tree,
  'prob.regression.v2': regression,
};
