import { bounded, even, product, range, sameJson, unique, type HzBuilder, type HzSpace, type Json } from './shared.js';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lowest = (n: number, d: number): { n: number; d: number } => { const g = gcd(n, d) || 1; return { n: n / g, d: d / g }; };
const texts = (answer: number): string[] => range(0, Math.max(30, answer * 2)).map(String);

const tenFrame: HzBuilder = (p, r) => {
  const start = p.start as number[];
  const rule = (counts: number[]) => (start.length === 1 ? counts[0]! >= start[0]! : counts[0]! + counts[1]! === start[0]! + start[1]!);
  const counts = product(start.map(() => range(0, 10))).filter((state) => rule(state) && !sameJson(state, start));
  const broken = start.length === 1 ? (start[0]! > 0 ? [[start[0]! - 1]] : []) : [[start[0]! < 10 ? start[0]! + 1 : start[0]! - 1, start[1]!]];
  return {
    inRange: counts.map((state) => ({ counts: state })),
    invalid: [...broken.map((state) => ({ counts: state })), { counts: [11, ...start.slice(1)] }, { counts: [] }, { counts: [...start, 0] }, { counts: [-1, ...start.slice(1)] }],
    initial: { counts: start },
    expectMet: (response) => sameJson(response.counts, r.target),
  };
};

const rekenrek: HzBuilder = (p, r) => {
  const start = p.start as number[];
  return {
    inRange: product([range(0, 10), range(0, 10)]).filter((state) => !sameJson(state, start)).map((beads) => ({ beads })),
    invalid: [{ beads: [11, 0] }, { beads: [0, -1] }, { beads: [1] }, { beads: [0, 0, 0] }, { beads: [1.5, 0] }],
    initial: { beads: start },
    expectMet: (response) => sameJson(response.beads, r.target),
  };
};

const abacus: HzBuilder = (p, r) => {
  const start = p.start as number[];
  const digits = product(start.map(() => range(0, 9))).filter((state) => !sameJson(state, start));
  return {
    inRange: bounded(digits, 2_000, [r.target]).map((state) => ({ digits: state })),
    invalid: [{ digits: [...start.slice(0, -1), 10] }, { digits: [...start, 0] }, { digits: start.slice(1) }, { digits: [-1, ...start.slice(1)] }],
    initial: { digits: start },
    expectMet: (response) => sameJson(response.digits, r.target),
  };
};

const emptyLine: HzBuilder = (p, r) => {
  const start = p.start as number;
  const sizes = p.sizes as number[];
  const moves = sizes.flatMap((size) => [size, -size]);
  const onLine = (at: number) => at >= 0 && at <= 1000;
  const best = new Map<number, number[]>([[start, []]]);
  let frontier = [{ at: start, jumps: [] as number[] }];
  for (let step = 0; step < p.max; step += 1) {
    const next: typeof frontier = [];
    for (const { at, jumps } of frontier) for (const move of moves) {
      const to = at + move;
      if (!onLine(to) || best.has(to)) continue;
      best.set(to, [...jumps, move]);
      next.push({ at: to, jumps: [...jumps, move] });
    }
    frontier = next;
  }
  const witnesses = [...best.entries()].filter(([at]) => at !== start).map(([, jumps]) => jumps);
  const shortRoutes = moves.flatMap((first) => [[first], ...moves.map((second) => [first, second])]).filter((jumps) => {
    let at = start;
    for (const jump of jumps) { at += jump; if (!onLine(at)) return false; }
    return at !== start;
  });
  const biggest = Math.max(...sizes);
  return {
    inRange: unique([...witnesses, ...shortRoutes]).map((jumps) => ({ jumps })),
    invalid: [{ jumps: Array.from({ length: (p.max as number) + 1 }, () => sizes[0]!) }, { jumps: [3] }, { jumps: [0] }, { jumps: [1.5] }, { jumps: [-5_000] },
      ...(start - biggest < 0 ? [{ jumps: [-biggest] }] : [])],
    initial: { jumps: [] },
    expectMet: (response) => (response.jumps as number[]).reduce((at, jump) => at + jump, start) === r.target,
  };
};

const zoom: HzBuilder = (p, r) => {
  const scale = 10 ** p.depth;
  const from = p.low * scale;
  const to = p.high * scale;
  const start = p.start * scale;
  return {
    inRange: bounded(range(from, to).filter((units) => units !== start), 1_500, [r.target]).map((units) => ({ units })),
    invalid: [{ units: from - 1 }, { units: to + 1 }, { units: from + 0.5 }, { units: String(from) }],
    initial: { units: start },
    expectMet: (response) => response.units === r.target,
  };
};

const clock: HzBuilder = (p, r) => {
  const onStep = (minutes: number) => (minutes % 60) % p.step === 0;
  const off = range(0, 719).find((minutes) => !onStep(minutes));
  return {
    inRange: range(0, 719).filter((minutes) => onStep(minutes) && minutes !== p.start).map((minutes) => ({ minutes })),
    invalid: [{ minutes: 720 }, { minutes: -1 }, { minutes: 30.5 }, ...(off === undefined ? [] : [{ minutes: off }])],
    initial: { minutes: p.start },
    expectMet: (response) => response.minutes === r.target,
  };
};

const ruler: HzBuilder = (p, r) => ({
  inRange: range(p.from, p.max).filter((end) => end !== p.start).map((end) => ({ end })),
  invalid: [{ end: p.from - 1 }, { end: p.max + 1 }, { end: p.from + 0.5 }, { end: String(p.max) }],
  initial: { end: p.start },
  expectMet: (response) => response.end === r.target,
});

const panBalance: HzBuilder = (p, r) => {
  const weights = p.weights as number[];
  const sum = (list: number[]) => list.reduce((total, weight) => total + weight, 0);
  const difference = (pans: number[]) => sum(p.left) - sum(p.right) + weights.reduce((total, weight, index) => total + (pans[index] === 1 ? weight : pans[index] === 2 ? -weight : 0), 0);
  const untouched = weights.map(() => 0);
  return {
    inRange: product(weights.map(() => [0, 1, 2])).filter((pans) => difference(pans) !== difference(untouched)).map((pans) => ({ pans })),
    invalid: [{ pans: [...untouched, 0] }, { pans: untouched.slice(1) }, { pans: [3, ...untouched.slice(1)] }, { pans: [-1, ...untouched.slice(1)] }],
    initial: { pans: untouched },
    expectMet: (response) => difference(response.pans) === r.target,
  };
};

const text = (value: unknown) => String(value);
const typedInvalid = (extra: Json[] = []): unknown[] => [{ value: '01' }, { value: '-1' }, { value: '1.5' }, { value: 'x' }, { value: '12345678' }, { value: 12 }, { value: '1', other: '1' }, ...extra];

const arrayArea: HzBuilder = (p, r) => {
  if (typeof p.rows === 'number') {
    const answer = p.rows * p.columns;
    return { inRange: texts(answer).map((value) => ({ value })), invalid: typedInvalid(), initial: { value: '' }, expectMet: (response) => response.value === text(answer) };
  }
  if (typeof p.across === 'number') {
    const answer = p.across * p.down;
    const splits = even(range(1, p.across - 1), 5);
    const inRange = splits.flatMap((split) => {
      const first = split * p.down;
      const second = (p.across - split) * p.down;
      return [[first, second], [first + 1, second], [second, first]].flatMap(([a, b]) => [answer, answer + 1].map((value) => ({ split, partials: [text(a), text(b)], value: text(value) })));
    });
    return {
      inRange,
      invalid: [{ split: p.across, partials: ['1', '1'], value: '1' }, { split: 1, partials: [1, 1], value: '1' }, { split: 1, partials: ['1', '1'] }, { split: 1, partials: ['01', '1'], value: '1' }, { split: -1, partials: ['1', '1'], value: '1' }],
      initial: { split: 0, partials: ['', ''], value: '' },
      expectMet: (response) => response.partials[0] === text(response.split * p.down) && response.partials[1] === text((p.across - response.split) * p.down) && response.value === text(answer),
    };
  }
  if (typeof p.dividend === 'number') {
    const quotient = p.dividend / p.divisor;
    const firsts = even(range(1, quotient - 1), 5);
    const inRange = [
      ...firsts.flatMap((first) => [quotient, quotient + 1].flatMap((value) => [[first, quotient - first], [first, quotient - first + 1]].map(([a, b]) => ({ partials: [text(a), text(b)], value: text(value) })))),
      { partials: ['0', text(quotient)], value: text(quotient) },
    ];
    return {
      inRange,
      invalid: [{ partials: [1, 1], value: '1' }, { partials: ['1', '1'] }, { partials: ['01', '1'], value: '1' }, { partials: ['1'], value: '1' }],
      initial: { partials: ['', ''], value: '' },
      expectMet: (response) => Number(response.partials[0]) >= 1 && Number(response.partials[1]) >= 1 && Number(response.partials[0]) + Number(response.partials[1]) === quotient && response.value === text(quotient),
    };
  }
  return null;
};

const ratioLine: HzBuilder = (p) => {
  let answer: number;
  if (p.given) answer = (p.given.value / p.base[p.given.line === 'top' ? 0 : 1]) * p.base[p.given.line === 'top' ? 1 : 0];
  else if (p.parts) answer = (p.whole / (p.parts[0] + p.parts[1])) * p.parts[p.ask === 'a' ? 0 : 1];
  else return null;
  return { inRange: bounded(texts(answer).map((value) => ({ value })), 400, [{ value: text(answer) }]), invalid: typedInvalid(), initial: { value: '' }, expectMet: (response) => response.value === text(answer) };
};

function fractionStates(answer: { n: number; d: number }, exact: boolean): HzSpace {
  const pairs: Array<[number, number]> = product([range(1, 12), range(1, 12)]).map(([n, d]) => [n!, d!]);
  for (let k = 1; k <= 12; k += 1) if (answer.n * k <= 999 && answer.d * k <= 999) pairs.push([answer.n * k, answer.d * k]);
  return {
    inRange: unique(pairs).map(([n, d]) => ({ n, d })),
    invalid: [{ n: 1_000, d: 1 }, { n: -1, d: 2 }, { n: 1.5, d: 2 }, { n: '1', d: 2 }, { n: 1 }, { n: 1, d: 2, extra: 1 }],
    initial: { n: 0, d: 0 },
    expectMet: (response) => (exact ? response.n === answer.n && response.d === answer.d : response.n * answer.d === answer.n * response.d),
  };
}

const fractionWall: HzBuilder = (p) => {
  if (p.op === 'equivalent') return fractionStates({ n: (p.fraction[0] * p.denominator) / p.fraction[1], d: p.denominator }, true);
  const [a, b] = p.left as number[];
  const [c, d] = p.right as number[];
  const raw = p.op === 'add' ? [a! * d! + c! * b!, b! * d!] : p.op === 'subtract' ? [a! * d! - c! * b!, b! * d!] : p.op === 'multiply' ? [a! * c!, b! * d!] : p.op === 'divide' ? [a! * d!, b! * c!] : null;
  return raw ? fractionStates(lowest(raw[0]!, raw[1]!), false) : null;
};

const fractionCircles: HzBuilder = (p) => {
  if (p.op === 'show') return fractionStates({ n: p.fraction[0], d: p.fraction[1] }, true);
  const [a, d] = p.left as number[];
  const c = (p.right as number[])[0]!;
  const n = p.op === 'compare' ? Math.max(a!, c) : p.op === 'add' ? a! + c : p.op === 'subtract' ? a! - c : null;
  return n === null ? null : fractionStates(lowest(n, d!), false);
};

export const NUMBER_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.ten-frame.v2': tenFrame,
  'math.rekenrek.v2': rekenrek,
  'math.abacus.v2': abacus,
  'math.number-line.empty.v2': emptyLine,
  'math.number-line.zoom.v2': zoom,
  'math.clock.v2': clock,
  'math.ruler.v2': ruler,
  'math.pan-balance.v2': panBalance,
  'math.array-area.v2': arrayArea,
  'math.ratio-line.v2': ratioLine,
  'math.fraction-wall.v2': fractionWall,
  'math.fraction-circles.v2': fractionCircles,
};
