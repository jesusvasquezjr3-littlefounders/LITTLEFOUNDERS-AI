import { arrangement, nextOf, shuffle, type Frame, type Slots } from './arrange.js';
import { eq, q, type Q } from './rational.js';
import { range, unique, type HzBuilder } from './shared.js';

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/* ── math.number-line.order.v2 ── */

const order: HzBuilder = (p) => {
  const { low, step, count, values } = p;
  if (!whole(low) || !whole(step) || !whole(count) || !Array.isArray(values) || values.length === 0 || step < 1) return null;
  if (!values.every((units) => whole(units) && units >= low && (units - low) % step === 0 && (units - low) / step <= count)) return null;
  const piece = (units: number): string => `n-${units}`;
  const slot = (mark: number): string => `m-${mark}`;
  const markOf = (units: number): number => (units - low) / step;
  const frame: Frame = { pieces: values.map(piece), slots: range(0, count).map(slot), capacity: () => 1 };
  const key: Slots = Object.fromEntries(values.map((units: number) => [slot(markOf(units)), [piece(units)]]));
  const marks = range(0, count);

  const build = (pairs: Array<[number, number]>): Slots | null => {
    const used = new Set(pairs.map(([, mark]) => mark));
    return used.size === pairs.length ? Object.fromEntries(pairs.map(([units, mark]) => [slot(mark), [piece(units)]])) : null;
  };
  const right = values.map((units: number): [number, number] => [units, markOf(units)]);
  const next = nextOf(count * 31 + values.length);
  const states: Array<Slots | null> = [];
  for (let mask = 1; mask < 2 ** values.length; mask += 1) states.push(build(right.filter((_, index) => (mask >> index) % 2 === 1)));
  for (const units of values) for (const mark of marks) states.push(build([[units, mark]]));
  for (const [index, [units]] of right.entries()) {
    for (const mark of marks) states.push(build(right.map((pair, position): [number, number] => (position === index ? [units, mark] : pair))));
  }
  for (let a = 0; a < right.length; a += 1) for (let b = a + 1; b < right.length; b += 1) {
    states.push(build(right.map((pair, position): [number, number] => (position === a ? [pair[0], right[b]![1]] : position === b ? [pair[0], right[a]![1]] : pair))));
  }
  const sorted = [...values].sort((a, b) => a - b);
  const reversed = [...right.map(([, mark]) => mark)].sort((a, b) => b - a);
  states.push(build(sorted.map((units, index): [number, number] => [units, reversed[index]!])));
  for (let draw = 0; draw < 200; draw += 1) {
    const some = shuffle(values, next).slice(0, next(values.length) + 1);
    const where = shuffle(marks, next);
    states.push(build(some.map((units, index): [number, number] => [units, where[index]!])));
  }

  const crowded = [piece(values[0]), piece(values[values.length - 1])];
  const more = [
    { slots: { [slot(count + 1)]: [piece(values[0])] } },
    { slots: { [slot(0)]: [piece(values.reduce((a: number, b: number) => Math.max(a, b)) + 1)] } },
    ...(values.length > 1 ? [{ slots: { [slot(0)]: crowded } }] : []),
    { slots: { [slot(0)]: [piece(values[0]), piece(values[0])] } },
  ];
  const space = arrangement(frame, key, states.filter((state): state is Slots => state !== null), (slots) => {
    const placed = Object.values(slots).flat();
    return placed.length === values.length && values.every((units: number) => slots[slot(markOf(units))]?.[0] === piece(units));
  }, more);
  const emptyStart = JSON.stringify({ slots: { [frame.slots[0]!]: [] } });
  space.invalid = space.invalid.filter((state) => JSON.stringify(state) !== emptyStart);
  space.expectDiagnostic = (response) => {
    const slots = response.slots as Slots;
    const shared = values.filter((units: number) => slots[slot(markOf(units))]?.[0] === piece(units)).length;
    const have = Object.values(slots).flat().length;
    const missing = values.length - shared;
    const extra = have - shared;
    if (shared === 0) return 'value';
    if (missing > 0 && extra > 0) return 'partial';
    return missing > 0 ? 'miss' : 'false_alarm';
  };
  return space;
};

/* ── math.ruler.measure.v2 ── */

const reading = (text: unknown): Q | null => {
  if (typeof text !== 'string' || text.length > 32) return null;
  const decimal = /^(-)?(0|[1-9]\d{0,14})(?:\.(\d{1,12}))?$/.exec(text);
  if (decimal) {
    const fraction = decimal[3] ?? '';
    return q((decimal[1] ? -1n : 1n) * BigInt(`${decimal[2]}${fraction}`), 10n ** BigInt(fraction.length));
  }
  const ratio = /^(-)?(0|[1-9]\d{0,14})\/([1-9]\d{0,14})$/.exec(text);
  return ratio ? q((ratio[1] ? -1n : 1n) * BigInt(ratio[2]!), BigInt(ratio[3]!)) : null;
};

const measure: HzBuilder = (p) => {
  const { from, to, max } = p;
  if (!whole(from) || !whole(to) || !whole(max) || to <= from || to > max || from < 0) return null;
  const length = to - from;
  const wanted = q(length);
  const inside = (text: string): boolean => { const value = reading(text); return value !== null && value.n >= 0n && value.n <= BigInt(max) * value.d; };
  const candidates = unique([
    ...range(1, max).map(String),
    ...range(0, max - 1).map((unit) => `${unit}.5`),
    `${length}.0`, `${length}.00`, `${length * 2}/2`, `${length * 3}/3`, `${length}/1`, `${length}.5`, `${length - 1}.9`, `${length + 1}/2`,
    '0.0', '-0', '0/1', `${max}.0`, `${max}/1`, `${max * 2}/2`, '0.25', '1/3',
  ]);
  const listed = candidates.filter((text) => text !== '0' && inside(text));
  const off = candidates.filter((text) => text !== '0' && !inside(text));
  return {
    inRange: listed.map((value) => ({ value })),
    invalid: [
      ...off.map((value) => ({ value })),
      { value: String(max + 1) }, { value: '-1' }, { value: `${max}.5` }, { value: '01' }, { value: '1.' }, { value: '.5' }, { value: '+1' }, { value: ' 1' }, { value: '1 ' },
      { value: '1/0' }, { value: '1/' }, { value: '1e1' }, { value: 'x' }, { value: '' }, { value: '1,5' }, { value: '1.2.3' }, { value: '9'.repeat(33) },
      { value: length }, { value: null }, { value: [String(length)] }, { value: String(length), extra: 1 }, { other: String(length) }, {}, null, [], 'x',
    ],
    initial: { value: '0' },
    expectMet: (response) => { const value = reading(response.value); return value !== null && eq(value, wanted); },
    expectDiagnostic: () => 'value',
  };
};

export const NUMA_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.number-line.order.v2': order,
  'math.ruler.measure.v2': measure,
};
