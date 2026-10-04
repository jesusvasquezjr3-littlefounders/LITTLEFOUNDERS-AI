import { differenceOf, equivalent, plusConstant, polyOf, printPoly, readLine, scaled, wholeCoefficients, type Line } from './expressions.js';
import { add, cmp, div, eq, fromDecimal, isInteger, isZero, mul, neg, q, sub, toDecimal, ZERO, type Q } from './rational.js';
import { bounded, even, isRecord, product, unique, type HzBuilder, type Json } from './shared.js';

const FAMILY_NAMES: Readonly<Record<string, readonly string[]>> = { line: ['m', 'b'], quadratic: ['a', 'b', 'c'], exponential: ['a', 'b'] };

interface Spec { min: Q; max: Q; step: Q }

function sliderSpec(value: Json): Spec | null {
  if (!isRecord(value)) return null;
  const min = fromDecimal(value.min); const max = fromDecimal(value.max); const step = fromDecimal(value.step);
  if (!min || !max || !step || cmp(step, ZERO) <= 0 || cmp(min, max) >= 0) return null;
  const count = div(sub(max, min), step);
  return isInteger(count) && count.n <= 400n ? { min, max, step } : null;
}

const valuesOf = (spec: Spec): Q[] => {
  const count = Number(div(sub(spec.max, spec.min), spec.step).n);
  return Array.from({ length: count + 1 }, (_, index) => add(spec.min, mul(spec.step, q(index))));
};

const onSpec = (spec: Spec, value: Q): boolean => cmp(value, spec.min) >= 0 && cmp(value, spec.max) <= 0 && isInteger(div(sub(value, spec.min), spec.step));

const contains = (list: Q[], value: Q): boolean => list.some((other) => eq(other, value));

const graph: HzBuilder = (p, r) => {
  const names = FAMILY_NAMES[p.curve as string];
  if (!names || !isRecord(r) || Object.keys(r).length !== 2 || r.family !== p.curve || !isRecord(r.target)) return null;
  const vertex = p.form === 'vertex';
  const sliderKeys = vertex ? ['a', 'h', 'k'] : [...names];
  const specs = sliderKeys.map((name) => sliderSpec(p.sliders?.[name]));
  const startSlider = sliderKeys.map((name) => fromDecimal(p.start?.[name]));
  if (specs.some((spec) => spec === null) || startSlider.some((value) => value === null)) return null;
  const sliders = specs as Spec[];
  const start = startSlider as Q[];

  const standardOf = (tuple: Q[]): Q[] => {
    if (!vertex) return tuple;
    const [a, h, k] = tuple as [Q, Q, Q];
    return [a, mul(mul(q(-2), a), h), add(mul(a, mul(h, h)), k)];
  };
  const sliderOf = (standard: Q[]): Q[] | null => {
    if (!vertex) return standard;
    const [a, b, c] = standard as [Q, Q, Q];
    if (isZero(a)) return null;
    const h = div(neg(b), mul(q(2), a));
    return [a, h, sub(c, mul(a, mul(h, h)))];
  };
  const onGrid = (standard: Q[]): boolean => {
    const tuple = sliderOf(standard);
    return tuple !== null && tuple.every((value, index) => onSpec(sliders[index]!, value));
  };
  const respond = (standard: Q[]): Json | null => {
    const texts = standard.map(toDecimal);
    if (texts.some((text) => text === null)) return null;
    return { family: p.curve, params: Object.fromEntries(names.map((name, index) => [name, texts[index]])) };
  };

  const targetParsed = names.map((name) => fromDecimal(r.target[name]));
  const target = targetParsed.every((value) => value !== null) ? (targetParsed as Q[]) : null;
  if (!target) return null;
  const targetSlider = sliderOf(target);

  const all = sliders.map(valuesOf);
  const per = sliderKeys.length === 2 ? 40 : 13;
  const lists = all.map((list, index) => {
    const picked = [...even(list, per)];
    for (const extra of [start[index]!, targetSlider?.[index]]) if (extra && !contains(picked, extra)) picked.push(extra);
    return picked;
  });
  const tuples: Q[][] = product(lists);
  if (targetSlider) {
    all.forEach((list, index) => { for (const value of list) tuples.push(targetSlider.map((current, at) => (at === index ? value : current))); });
  }
  const startStandard = standardOf(start);
  const seen = new Set<string>();
  const states: Json[] = [];
  for (const tuple of tuples) {
    const standard = standardOf(tuple);
    if (standard.every((value, index) => eq(value, startStandard[index]!))) continue;
    const id = standard.map((value) => `${value.n}/${value.d}`).join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    const response = respond(standard);
    if (response) states.push(response);
  }

  const base = respond(startStandard);
  if (!base) return null;
  const direct = vertex ? [0] : names.map((_, index) => index);
  const first = direct[0]!;
  const spec = sliders[first]!;
  const textOf = (value: Q): string => toDecimal(value) ?? '0';
  const withParam = (index: number, value: unknown): Json => ({ family: p.curve, params: { ...base.params, [names[index]!]: value } });
  const off = (index: number, value: Q): Json[] => (onSpec(sliders[index]!, value) ? [] : [withParam(index, textOf(value))]);
  const lastDirect = direct[direct.length - 1]!;
  const invalid: unknown[] = [
    ...off(first, add(spec.max, spec.step)), ...off(first, sub(spec.min, spec.step)), ...off(first, add(spec.min, div(spec.step, q(2)))),
    ...off(lastDirect, add(sliders[lastDirect]!.max, sliders[lastDirect]!.step)),
    withParam(first, 1), withParam(first, '1e0'), withParam(first, '+1'), withParam(first, ''), withParam(first, 'one'), withParam(first, null), withParam(first, ' 1'),
    { family: [...Object.keys(FAMILY_NAMES)].find((name) => name !== p.curve), params: base.params },
    { family: 'cubic', params: base.params },
    { family: p.curve, params: Object.fromEntries(Object.entries(base.params).slice(1)) },
    { family: p.curve, params: { ...base.params, extra: '1' } },
    { family: p.curve, params: [] }, { family: p.curve, params: null }, { family: p.curve }, { params: base.params },
    { family: p.curve, params: base.params, extra: 1 }, {}, { family: p.curve, params: 'x' },
  ];
  if (vertex) {
    const nudged = standardOf(start).map((value, index) => (index === 1 ? add(value, q(1, 10_000)) : value));
    if (!onGrid(nudged)) invalid.push(withParam(1, textOf(nudged[1]!)));
  }

  const answer = respond(target);
  return {
    inRange: bounded(states, 2_400, answer ? [answer] : []),
    invalid,
    initial: base,
    expectMet: (response) => {
      if (!isRecord(response.params) || response.family !== p.curve) return false;
      const parsed = names.map((name) => fromDecimal(response.params[name]));
      return parsed.every((value, index) => value !== null && eq(value, target[index]!));
    },
  };
};

const gridValues = (low: number, high: number, step: number): number[] => {
  const out: number[] = [];
  for (let value = low; value <= high; value += step) out.push(value);
  return out;
};

const spotKey = (point: Json): string => `${Math.round(point.x * 1e6)},${Math.round(point.y * 1e6)}`;

const system: HzBuilder = (p, r) => {
  if (!isRecord(r) || Object.keys(r).length !== 1 || !Array.isArray(r.required)) return null;
  const window = p.window as { xMin: number; xMax: number; yMin: number; yMax: number };
  const grid = p.grid as number;
  const lines = p.lines as Array<{ a: number; b: number; c: number }>;
  const markers = p.start as Array<{ x: number; y: number }>;
  const count = markers.length;
  const xs = gridValues(window.xMin, window.xMax, grid);
  const ys = gridValues(window.yMin, window.yMax, grid);
  const spots = xs.flatMap((x) => ys.map((y) => ({ x, y })));
  const required = (r.required as Json[]).map((point) => ({ x: point.x as number, y: point.y as number }));
  const startKeys = new Set(markers.map(spotKey));

  const crossings: Array<{ x: number; y: number }> = [];
  for (let left = 0; left < lines.length; left += 1) for (let right = left + 1; right < lines.length; right += 1) {
    const one = lines[left]!; const two = lines[right]!;
    const det = one.a * two.b - two.a * one.b;
    if (det === 0) continue;
    const x = q(one.c * two.b - two.c * one.b, det); const y = q(one.a * two.c - two.a * one.c, det);
    const inside = (value: Q, low: number, high: number) => cmp(value, q(low)) >= 0 && cmp(value, q(high)) <= 0 && isInteger(div(sub(value, q(low)), q(Math.round(grid * 2), 2)));
    if (inside(x, window.xMin, window.xMax) && inside(y, window.yMin, window.yMax)) crossings.push({ x: Number(x.n) / Number(x.d), y: Number(y.n) / Number(y.d) });
  }
  const onBoard = (point: { x: number; y: number }) => point.x >= window.xMin && point.x <= window.xMax && point.y >= window.yMin && point.y <= window.yMax;
  const near = [...required, ...crossings].flatMap((point) => [[grid, 0], [-grid, 0], [0, grid], [0, -grid]].map(([dx, dy]) => ({ x: point.x + dx!, y: point.y + dy! }))).filter(onBoard);
  const pool = unique([...required, ...crossings, ...markers, ...near, ...even(spots, 40)]);

  const sets: Array<Array<{ x: number; y: number }>> = [];
  if (count === 1) {
    for (const spot of spots) sets.push([spot]);
  } else {
    sets.push(required, [...required].reverse());
    const small = pool.slice(0, count === 2 ? 40 : 14);
    const choose = (from: number, chosen: Array<{ x: number; y: number }>) => {
      if (chosen.length === count) { sets.push(chosen); return; }
      for (let at = from; at < small.length; at += 1) choose(at + 1, [...chosen, small[at]!]);
    };
    choose(0, []);
    required.forEach((_, slot) => { for (const spot of pool) sets.push(required.map((point, index) => (index === slot ? spot : point))); });
    markers.forEach((_, slot) => sets.push(markers.map((point, index) => (index === slot ? required[index]! : point))));
  }
  const seen = new Set<string>();
  const states: Json[] = [];
  for (const set of sets) {
    const id = set.map(spotKey).sort().join('|');
    if (set.length !== count || new Set(set.map(spotKey)).size !== count || seen.has(id) || id === [...startKeys].sort().join('|')) continue;
    seen.add(id);
    states.push({ points: set });
  }

  const sample = markers[0]!;
  const shifted = (point: { x: number; y: number }, dx: number, dy: number) => ({ x: point.x + dx, y: point.y + dy });
  const invalid: unknown[] = [
    { points: [shifted(sample, grid / 4, 0), ...markers.slice(1)] },
    { points: [{ x: window.xMax + grid, y: sample.y }, ...markers.slice(1)] },
    { points: [{ x: sample.x, y: window.yMin - grid }, ...markers.slice(1)] },
    { points: markers.slice(0, -1) },
    { points: [...markers, shifted(sample, grid, grid)] },
    { points: [{ x: String(sample.x), y: sample.y }, ...markers.slice(1)] },
    { points: [{ x: null, y: sample.y }, ...markers.slice(1)] },
    { points: [{ ...sample, z: 1 }, ...markers.slice(1)] },
    { points: markers, extra: 1 }, { points: [null] }, { points: [[sample.x, sample.y]] }, { points: 'x' }, { points: null }, {},
  ];
  if (count >= 2) invalid.push({ points: [sample, sample, ...markers.slice(2)] });

  const wanted = new Set(required.map(spotKey));
  return {
    inRange: bounded(states, 2_400, [{ points: required }]),
    invalid,
    initial: { points: markers },
    expectMet: (response) => {
      if (!Array.isArray(response.points) || response.points.length !== count) return false;
      const got = new Set(response.points.map((point: Json) => spotKey(point)));
      return got.size === wanted.size && [...got].every((id) => wanted.has(id));
    },
  };
};

const otherLetter = (variable: string): string => (variable === 'z' ? 'w' : 'z');

/** Lines of one task with what is known about each: unfinished but equal to the given, finished (the reference and its spelling variants), and unequal. */
function vocabulary(task: Json, reference: string, given: Line): { equal: string[]; finished: string[]; unequal: string[] } | null {
  const variable = task.variable as string;
  const key = readLine(reference, variable);
  if (!key || key.kind !== given.kind) return null;
  const equal = [task.given as string, ` ${task.given as string}`];
  const finished = [reference];
  const unequal: string[] = [];
  if (given.kind === 'expression') {
    const poly = polyOf(key)!;
    equal.push(`${task.given}+0`, `0+${task.given}`, `(${task.given})`);
    if (wholeCoefficients(poly) && poly.length > 0) {
      const canonical = printPoly(poly, variable);
      if (task.form === 'expanded') finished.push(canonical, printPoly(poly, variable, false));
      else equal.push(canonical);
      unequal.push(printPoly(plusConstant(poly, q(1)), variable), printPoly(plusConstant(poly, q(-1)), variable));
    }
    const brackets = /^\(([^()]+)\)\(([^()]+)\)$/.exec(reference);
    if (task.form === 'factored' && brackets) finished.push(`(${brackets[2]})(${brackets[1]})`);
  } else {
    const diff = differenceOf(given)!;
    if (wholeCoefficients(diff) && diff.length >= 2 && diff.filter((coefficient) => !isZero(coefficient)).length >= 2) {
      equal.push(`${printPoly(diff, variable)}=0`, `0=${printPoly(diff, variable)}`, `${printPoly(scaled(diff, q(2)), variable)}=0`);
      unequal.push(`${printPoly(plusConstant(diff, q(1)), variable)}=0`, `${printPoly(plusConstant(diff, q(-1)), variable)}=0`);
      if (diff.length === 2) {
        const solution = div(neg(diff[0]!), diff[1]!);
        const wrong = toDecimal(add(solution, q(1)));
        if (wrong) unequal.push(`${variable}=${wrong}`);
      }
    }
    const sides = reference.split('=');
    if (sides.length === 2) finished.push(`${sides[1]}=${sides[0]}`);
  }
  return { equal: unique(equal), finished: unique(finished), unequal: unique(unequal.filter((text) => !equal.includes(text) && !finished.includes(text))) };
}

const expression: HzBuilder = (p, r) => {
  if (!isRecord(r) || Object.keys(r).length !== 1 || typeof r.reference !== 'string') return null;
  const variable = p.variable as string;
  if (typeof variable !== 'string' || typeof p.given !== 'string') return null;
  const given = readLine(p.given, variable);
  if (!given || given.kind !== (p.task === 'rewrite' ? 'expression' : 'equation')) return null;
  const words = vocabulary(p, r.reference, given);
  if (!words) return null;
  const finished = new Set(words.finished);
  const lines = [...words.equal, ...words.finished, ...words.unequal];
  const core = unique([p.given as string, words.equal[2] ?? p.given, words.finished[0]!, words.unequal[0] ?? p.given]);

  const sequences: string[][] = [];
  for (const first of lines) {
    sequences.push([first]);
    for (const second of lines) {
      sequences.push([first, second]);
      for (const third of lines) sequences.push([first, second, third]);
    }
  }
  for (const a of core) for (const b of core) for (const c of core) for (const d of core) sequences.push([a, b, c, d]);
  sequences.push([p.given, ...words.equal.slice(2), words.finished[0]!].slice(0, 8), Array.from({ length: 8 }, () => words.finished[0]!));

  const chain = (steps: string[]): { sound: boolean; last: Line } | null => {
    let previous: Line = given;
    let sound = true;
    for (const step of steps) {
      const line = readLine(step, variable);
      if (!line || line.kind !== given.kind) return null;
      if (!equivalent(previous, line)) sound = false;
      previous = line;
    }
    return { sound, last: previous };
  };
  const target = readLine(r.reference, variable)!;
  const states = unique(sequences).filter((steps) => !(steps.length === 1 && steps[0] === p.given)).map((steps) => ({ steps }));

  const bad = otherLetter(variable);
  const broken = `${p.given})`;
  const wrongKind = p.task === 'rewrite' ? `${variable}=1` : `${variable}+1`;
  const invalid: unknown[] = [
    { steps: [broken] }, { steps: [p.given, broken] }, { steps: [wrongKind] }, { steps: [p.given, wrongKind] }, { steps: [`${bad}+1`] }, { steps: [''] }, { steps: [' '] },
    { steps: [`${variable}==1`] }, { steps: [`${variable}^7`] }, { steps: [`${variable}^-1`] }, { steps: [`${p.given}${'+1'.repeat(40)}`] },
    { steps: [] }, { steps: Array.from({ length: 9 }, () => p.given) }, { steps: [1] }, { steps: [null] }, { steps: [[p.given]] },
    { steps: p.given }, { steps: [p.given], extra: 1 }, { steps: [p.given], given: p.given }, {}, { steps: null },
  ];

  return {
    inRange: bounded(states, 2_400, [{ steps: [p.given, r.reference] }]),
    invalid,
    initial: { steps: [p.given] },
    expectMet: (response) => {
      if (!Array.isArray(response.steps) || response.steps.length < 1 || response.steps.length > 8 || !response.steps.every((step: unknown) => typeof step === 'string')) return false;
      if (response.steps.length === 1 && response.steps[0] === p.given) return false;
      const walked = chain(response.steps);
      return walked !== null && walked.sound && finished.has(response.steps[response.steps.length - 1]!) && equivalent(walked.last, target);
    },
  };
};

export const ALG2_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.function-graph.v2': graph,
  'math.line-system.v2': system,
  'math.expression-editor.v2': expression,
};
