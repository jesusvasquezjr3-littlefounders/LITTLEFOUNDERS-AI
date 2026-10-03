import { add, cmp, div, eq, fromDecimal, mul, q, sub, ONE, ZERO, type Q } from './rational.js';
import { bounded, product, range, unique, type HzBuilder, type HzSpace, type Json } from './shared.js';

type Slots = Record<string, string[]>;
interface Frame { pieces: string[]; slots: string[]; capacity: (slot: string) => number }
interface Edge { id: string; from: string; to: string; weight?: number }

const nextOf = (seed: number) => {
  let state = seed >>> 0;
  return (bound: number): number => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return (state >>> 8) % bound; };
};
type Next = ReturnType<typeof nextOf>;

const shuffle = <T,>(list: readonly T[], next: Next): T[] => {
  const out = [...list];
  for (let index = out.length - 1; index > 0; index -= 1) { const other = next(index + 1); [out[index], out[other]] = [out[other]!, out[index]!]; }
  return out;
};
const someOf = <T,>(list: readonly T[], next: Next): T[] => shuffle(list, next).slice(0, next(list.length) + 1);

const place = (slots: Slots): Json => ({ slots: Object.fromEntries(Object.entries(slots).filter(([, pieces]) => pieces.length > 0)) });

function refused(frame: Frame, key: Slots, more: unknown[]): unknown[] {
  const slot = frame.slots[0]!;
  const piece = frame.pieces[0]!;
  return [
    { slots: { [slot]: [] } }, { slots: { 'no-such-slot': [piece] } }, { slots: { [slot]: ['no-such-piece'] } }, { slots: { [slot]: [piece, piece] } },
    { slots: [piece] }, { slots: 'x' }, { slots: { [slot]: piece } }, { slots: { [slot]: [7] } }, { slots: key, extra: 1 }, {}, { slots: null },
    ...more,
  ];
}

/** The states a learner reaches on a slot board: the placements given, those that fit the frame, refusals, the empty start and the rule's own verdict. */
function arrangement(frame: Frame, key: Slots, states: Slots[], met: (slots: Slots) => boolean, more: unknown[] = []): HzSpace {
  const known = new Set(frame.pieces);
  const fits = (slots: Slots): boolean => {
    const placed = Object.values(slots).flat();
    return placed.length > 0 && new Set(placed).size === placed.length && placed.every((piece) => known.has(piece))
      && Object.entries(slots).every(([slot, pieces]) => frame.slots.includes(slot) && pieces.length <= frame.capacity(slot));
  };
  const pool = unique(states.filter(fits).map(place));
  const keep = pool.filter((state) => met(state.slots as Slots)).slice(0, 80);
  return {
    inRange: bounded(pool, 2_400, keep),
    invalid: refused(frame, key, more),
    initial: { slots: {} },
    expectMet: (response) => met(response.slots as Slots),
  };
}

const fromKey = (r: Json): Slots[] => (Array.isArray(r.solutions) ? (r.solutions as Slots[]) : []);
const onlyIn = (slots: Slots, slot: string): string[] | null => (Object.keys(slots).every((key) => key === slot) ? slots[slot] ?? [] : null);
const sameItems = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && new Set(a).size === a.length && b.every((id) => a.includes(id));

/* ── math.network-count.v2 ── */

const oddNodes: HzBuilder = (p, r) => {
  const nodes = (p.nodes as Array<{ id: string }>).map((node) => node.id);
  const edges = p.edges as Edge[];
  const degree = new Map(nodes.map((id) => [id, 0]));
  for (const edge of edges) { degree.set(edge.from, degree.get(edge.from)! + 1); degree.set(edge.to, degree.get(edge.to)! + 1); }
  const odd = nodes.filter((id) => degree.get(id)! % 2 === 1);
  const next = nextOf(11);
  const states: Slots[] = [{ odd }, { odd: [...odd].reverse() }];
  for (let mask = 1; mask < 2 ** nodes.length; mask += 1) states.push({ odd: nodes.filter((_, index) => (mask >> index) & 1) });
  for (let draw = 0; draw < 40; draw += 1) states.push({ odd: someOf(nodes, next) });
  const frame: Frame = { pieces: nodes, slots: ['odd'], capacity: () => nodes.length };
  return arrangement(frame, { odd }, [...states, ...fromKey(r)], (slots) => { const placed = onlyIn(slots, 'odd'); return placed !== null && sameItems(placed, odd); });
};

function eulerTrails(nodes: string[], edges: Edge[], cap: number): string[][] {
  const found: string[][] = [];
  const used = new Set<string>();
  const path: string[] = [];
  const walk = (at: string): void => {
    if (found.length >= cap) return;
    if (path.length === edges.length) { found.push([...path]); return; }
    for (const edge of edges) {
      if (used.has(edge.id)) continue;
      const to = edge.from === at ? edge.to : edge.to === at ? edge.from : null;
      if (to === null) continue;
      used.add(edge.id); path.push(edge.id);
      walk(to);
      used.delete(edge.id); path.pop();
    }
  };
  nodes.forEach(walk);
  return found;
}

const walks = (edges: Edge[], order: string[]): boolean => {
  if (order.length !== edges.length || new Set(order).size !== order.length) return false;
  const list = order.map((id) => edges.find((edge) => edge.id === id));
  if (list.some((edge) => edge === undefined)) return false;
  const from = (start: string): boolean => {
    let at = start;
    for (const edge of list as Edge[]) {
      if (edge.from === at) at = edge.to;
      else if (edge.to === at) at = edge.from;
      else return false;
    }
    return true;
  };
  return from(list[0]!.from) || from(list[0]!.to);
};

const trail: HzBuilder = (p, r) => {
  const nodes = (p.nodes as Array<{ id: string }>).map((node) => node.id);
  const edges = p.edges as Edge[];
  const ids = edges.map((edge) => edge.id);
  const all = eulerTrails(nodes, edges, 300);
  const states: string[][] = [...all, ...all.slice(0, 60).map((order) => [...order].reverse())];
  for (const order of all.slice(0, 30)) {
    for (let length = 1; length < order.length; length += 1) states.push(order.slice(0, length));
    for (let index = 0; index + 1 < order.length; index += 1) { const swapped = [...order]; [swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!]; states.push(swapped); }
    for (let index = 0; index < order.length; index += 1) states.push(order.filter((_, at) => at !== index));
  }
  for (const first of ids) { states.push([first]); for (const second of ids) if (first !== second) states.push([first, second]); }
  const next = nextOf(23);
  for (let draw = 0; draw < 250; draw += 1) { states.push(shuffle(ids, next)); states.push(someOf(ids, next)); }
  for (let draw = 0; draw < 200; draw += 1) {
    let at = nodes[next(nodes.length)]!;
    const used = new Set<string>();
    const order: string[] = [];
    for (let step = next(ids.length) + 1; step > 0; step -= 1) {
      const options = edges.filter((edge) => !used.has(edge.id) && (edge.from === at || edge.to === at));
      if (options.length === 0) break;
      const pick = options[next(options.length)]!;
      used.add(pick.id); order.push(pick.id);
      at = pick.from === at ? pick.to : pick.from;
    }
    if (order.length > 0) states.push(order);
  }
  const frame: Frame = { pieces: ids, slots: ['walk'], capacity: () => ids.length };
  const sets: Slots[] = [...states.map((order) => ({ walk: order })), ...fromKey(r)];
  return arrangement(frame, { walk: all[0] ?? [] }, sets, (slots) => { const placed = onlyIn(slots, 'walk'); return placed !== null && walks(edges, placed); });
};

const route: HzBuilder = (p, r) => {
  const nodes = (p.nodes as Array<{ id: string }>).map((node) => node.id);
  const edges = p.edges as Edge[];
  const between = (a: string, b: string): number | null => {
    const edge = edges.find((candidate) => (candidate.from === a && candidate.to === b) || (candidate.from === b && candidate.to === a));
    return edge ? edge.weight ?? 0 : null;
  };
  const dist = new Map<string, number>(nodes.map((id) => [id, Infinity]));
  dist.set(p.start, 0);
  for (let round = 0; round < nodes.length; round += 1) {
    for (const edge of edges) {
      const weight = edge.weight ?? 0;
      if (dist.get(edge.from)! + weight < dist.get(edge.to)!) dist.set(edge.to, dist.get(edge.from)! + weight);
      if (dist.get(edge.to)! + weight < dist.get(edge.from)!) dist.set(edge.from, dist.get(edge.to)! + weight);
    }
  }
  const best = dist.get(p.goal)!;
  const total = (order: string[]): number | null => {
    let sum = 0;
    for (let index = 0; index + 1 < order.length; index += 1) { const weight = between(order[index]!, order[index + 1]!); if (weight === null) return null; sum += weight; }
    return sum;
  };
  const met = (order: string[]): boolean => order.length >= 2 && order[0] === p.start && order[order.length - 1] === p.goal && new Set(order).size === order.length && total(order) === best;
  const paths: string[][] = [];
  const seen = new Set<string>([p.start]);
  const trace = [p.start as string];
  const visit = (at: string): void => {
    if (paths.length >= 600) return;
    if (at === p.goal) { paths.push([...trace]); return; }
    for (const edge of edges) {
      const to = edge.from === at ? edge.to : edge.to === at ? edge.from : null;
      if (to === null || seen.has(to)) continue;
      seen.add(to); trace.push(to);
      visit(to);
      seen.delete(to); trace.pop();
    }
  };
  visit(p.start);
  const shortest = paths.filter(met);
  const states: string[][] = [...paths, ...shortest.map((order) => [...order].reverse())];
  for (const order of paths.slice(0, 80)) {
    for (let length = 1; length < order.length; length += 1) states.push(order.slice(0, length));
    for (let index = 1; index + 2 < order.length; index += 1) { const swapped = [...order]; [swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!]; states.push(swapped); }
    states.push(order.slice(1));
  }
  for (const first of nodes) {
    states.push([first]);
    for (const second of nodes) if (first !== second) { states.push([first, second]); for (const third of nodes) if (third !== first && third !== second) states.push([first, second, third]); }
  }
  const next = nextOf(37);
  for (let draw = 0; draw < 300; draw += 1) states.push(someOf(nodes, next));
  const frame: Frame = { pieces: nodes, slots: ['route'], capacity: () => nodes.length };
  const sets: Slots[] = [...states.map((order) => ({ route: order })), ...fromKey(r)];
  return arrangement(frame, { route: shortest[0] ?? [] }, sets, (slots) => { const placed = onlyIn(slots, 'route'); return placed !== null && met(placed); });
};

const tree: HzBuilder = (p, r) => {
  const items = p.items as string[];
  const leaves: string[][] = [];
  const build = (prefix: string[]): void => {
    if (prefix.length === p.pick) { leaves.push(prefix); return; }
    for (const item of items) if (!prefix.includes(item)) build([...prefix, item]);
  };
  build([]);
  const idOf = (leaf: string[]): string => leaf.join('.');
  const teamOf = (leaf: string[]): string => [...leaf].sort((a, b) => items.indexOf(a) - items.indexOf(b)).join('.');
  const ids = leaves.map(idOf);
  const byId = new Map(leaves.map((leaf) => [idOf(leaf), leaf]));
  const teams = unique(leaves.map(teamOf));
  const asked = ids.filter((id) => byId.get(id)![0] === p.first);
  const met = (slots: Slots): boolean => {
    const kept = onlyIn(slots, 'keep');
    if (kept === null || kept.some((id) => !byId.has(id)) || new Set(kept).size !== kept.length) return false;
    if (p.mode === 'order') return sameItems(kept, asked);
    const owners = kept.map((id) => teamOf(byId.get(id)!));
    return new Set(owners).size === owners.length && owners.length === teams.length;
  };
  const next = nextOf(41);
  const sets: string[][] = [];
  if (p.mode === 'order') {
    sets.push(asked, [...asked].reverse());
    for (const item of items) sets.push(ids.filter((id) => byId.get(id)![0] === item));
    asked.forEach((_, index) => sets.push(asked.filter((__, at) => at !== index)));
    ids.filter((id) => !asked.includes(id)).forEach((extra) => sets.push([...asked, extra]));
  } else {
    const choices = teams.map((team) => ids.filter((id) => teamOf(byId.get(id)!) === team));
    const covers = product(choices, 1_500);
    sets.push(...covers);
    const key = covers[0] ?? [];
    key.forEach((_, index) => sets.push(key.filter((__, at) => at !== index)));
    key.forEach((id) => choices.forEach((list) => list.filter((other) => other !== id).slice(0, 1).forEach((other) => sets.push([...key, other]))));
  }
  ids.forEach((id) => sets.push([id]));
  sets.push(ids);
  for (let length = 1; length < ids.length; length += 1) sets.push(ids.slice(0, length));
  for (let draw = 0; draw < 400; draw += 1) sets.push(someOf(ids, next));
  const frame: Frame = { pieces: ids, slots: ['keep'], capacity: () => ids.length };
  const key = (p.mode === 'order' ? asked : sets.find((set) => met({ keep: set })) ?? []);
  return arrangement(frame, { keep: key }, [...sets.map((set) => ({ keep: set })), ...fromKey(r)], met);
};

const pascal: HzBuilder = (p, r) => {
  const rows: number[][] = [];
  for (let row = 0; row < p.rows; row += 1) rows.push(Array.from({ length: row + 1 }, (_, col) => (col === 0 || col === row ? 1 : rows[row - 1]![col - 1]! + rows[row - 1]![col]!)));
  const cell = (row: number, col: number): string => `r${row}c${col}`;
  const cells = rows.flatMap((line, row) => line.map((_, col) => cell(row, col)));
  const slotOf = (id: string): string => `row-${/^r(\d+)c/.exec(id)![1]}`;
  const grouped = (list: string[]): Slots => { const out: Slots = {}; for (const id of list) (out[slotOf(id)] ??= []).push(id); return out; };
  const multiplesOf = (factor: number): string[] => rows.flatMap((line, row) => line.flatMap((value, col) => (value % factor === 0 ? [cell(row, col)] : [])));
  const wanted = multiplesOf(p.multiple);
  const met = (slots: Slots): boolean => {
    const placed = Object.entries(slots).flatMap(([slot, list]) => list.map((id) => ({ id, slot })));
    return placed.every((entry) => /^r\d+c\d+$/.test(entry.id) && slotOf(entry.id) === entry.slot) && sameItems(placed.map((entry) => entry.id), wanted);
  };
  const sets: string[][] = [wanted, cells];
  wanted.forEach((id) => sets.push(wanted.filter((other) => other !== id)));
  cells.filter((id) => !wanted.includes(id)).forEach((extra) => sets.push([...wanted, extra]));
  cells.forEach((id) => sets.push([id]));
  rows.forEach((line, row) => { sets.push(line.map((_, col) => cell(row, col))); sets.push(wanted.filter((id) => slotOf(id) === `row-${row}`)); });
  for (let factor = 2; factor <= 5; factor += 1) sets.push(multiplesOf(factor));
  sets.push(rows.flatMap((line, row) => line.flatMap((value, col) => (value % 2 === 1 ? [cell(row, col)] : []))));
  const next = nextOf(53);
  for (let draw = 0; draw < 400; draw += 1) sets.push(someOf(cells, next));
  const frame: Frame = { pieces: cells, slots: rows.map((_, row) => `row-${row}`), capacity: (slot) => Number(slot.slice(4)) + 1 };
  const more = [{ slots: { 'row-0': [cell(1, 0)] } }, { slots: { 'row-1': [cell(0, 0)] } }, { slots: { 'row-0': [cell(0, 0), cell(1, 0)] } }];
  return arrangement(frame, grouped(wanted), [...sets.map(grouped), ...fromKey(r)], met, more);
};

const NETWORK: HzBuilder = (p, r, segment) => {
  switch (segment.visual?.type) {
    case 'graph': return p.task === 'odd' ? oddNodes(p, r, segment) : p.task === 'trail' ? trail(p, r, segment) : null;
    case 'shortest-path': return route(p, r, segment);
    case 'choice-tree': return tree(p, r, segment);
    case 'pascal': return pascal(p, r, segment);
    default: return null;
  }
};

/* ── computing.bits-gates.v2 ── */

const bits: HzBuilder = (p, r) => {
  const weights = Array.from({ length: p.bits as number }, (_, index) => 2 ** (p.bits - 1 - index));
  const pieces = weights.map((weight) => `bit-${weight}`);
  const key = pieces.filter((_, index) => (p.target & weights[index]!) !== 0);
  const next = nextOf(61);
  const sets: string[][] = [];
  for (let mask = 1; mask < 2 ** pieces.length; mask += 1) sets.push(pieces.filter((_, index) => (mask >> index) & 1));
  for (let draw = 0; draw < 30; draw += 1) sets.push(someOf(pieces, next));
  sets.push([...key].reverse());
  const frame: Frame = { pieces, slots: ['bits-on'], capacity: () => pieces.length };
  return arrangement(frame, { 'bits-on': key }, [...sets.map((set) => ({ 'bits-on': set })), ...fromKey(r)], (slots) => {
    const on = onlyIn(slots, 'bits-on');
    return on !== null && on.length > 0 && new Set(on).size === on.length && on.reduce((sum, id) => sum + Number(id.slice(4)), 0) === p.target;
  });
};

const GATE: Record<string, (a: number, b: number) => number> = {
  and: (a, b) => a & b, or: (a, b) => a | b, not: (a) => 1 - a, xor: (a, b) => a ^ b, nand: (a, b) => 1 - (a & b), nor: (a, b) => 1 - (a | b),
};

const gates: HzBuilder = (p, r) => {
  const inputs = p.inputs as string[];
  const spots = p.slots as Array<{ id: string; from: string[] }>;
  const pieces = p.pieces as Array<{ id: string; kind: string }>;
  const expected = p.expected as number[];
  const arity = (kind: string): number => (kind === 'not' ? 1 : 2);
  const fits = (piece: string, spot: { from: string[] }): boolean => arity(pieces.find((candidate) => candidate.id === piece)!.kind) === spot.from.length;
  const works = (pick: Record<string, string>): boolean => expected.every((bit, row) => {
    const value = new Map<string, number>(inputs.map((id, index) => [id, (row >> (inputs.length - 1 - index)) & 1]));
    let last = 0;
    for (const spot of spots) {
      const piece = pieces.find((candidate) => candidate.id === pick[spot.id]);
      if (!piece || arity(piece.kind) !== spot.from.length) return false;
      last = GATE[piece.kind]!(value.get(spot.from[0]!)!, spot.from.length === 2 ? value.get(spot.from[1]!)! : 0);
      value.set(spot.id, last);
    }
    return last === bit;
  });
  const states: Slots[] = [];
  const solutions: Slots[] = [];
  const pick: Record<string, string> = {};
  const used = new Set<string>();
  const fill = (index: number): void => {
    if (states.length > 30_000) return;
    if (index === spots.length) {
      if (Object.keys(pick).length === 0) return;
      const state = Object.fromEntries(Object.entries(pick).map(([slot, piece]) => [slot, [piece]]));
      states.push(state);
      if (Object.keys(pick).length === spots.length && works(pick)) solutions.push(state);
      return;
    }
    fill(index + 1);
    for (const piece of pieces) {
      if (used.has(piece.id) || !fits(piece.id, spots[index]!)) continue;
      used.add(piece.id); pick[spots[index]!.id] = piece.id;
      fill(index + 1);
      used.delete(piece.id); delete pick[spots[index]!.id];
    }
  };
  fill(0);
  const frame: Frame = { pieces: pieces.map((piece) => piece.id), slots: spots.map((spot) => spot.id), capacity: () => 1 };
  const clash = spots.flatMap((spot) => pieces.filter((piece) => !fits(piece.id, spot)).slice(0, 1).map((piece) => ({ slots: { [spot.id]: [piece.id] } })));
  const crowded = spots.length > 1 ? [{ slots: { [spots[0]!.id]: [pieces[0]!.id], [spots[1]!.id]: [pieces[0]!.id] } }, { slots: { [spots[0]!.id]: [pieces[0]!.id, pieces[1]!.id] } }] : [];
  const sampled = bounded(states, 2_000, solutions.slice(0, 60));
  return arrangement(frame, solutions[0] ?? {}, [...sampled, ...fromKey(r)], (slots) => {
    const chosen = Object.entries(slots);
    if (chosen.some(([slot, list]) => !spots.some((spot) => spot.id === slot) || list.length !== 1) || chosen.length !== spots.length) return false;
    return works(Object.fromEntries(chosen.map(([slot, list]) => [slot, list[0]!])));
  }, [...clash.slice(0, 4), ...crowded]);
};

const CIRCUITS: HzBuilder = (p, r, segment) => (segment.visual?.type === 'bits' ? bits(p, r, segment) : segment.visual?.type === 'gates' ? gates(p, r, segment) : null);

/* ── trig.unit-circle.v2 and calculus.explorer.v2 ── */

interface Truth { predict: string; value: number }

function explorer(options: readonly string[], low: number, high: number, truth: Truth): HzSpace {
  const values = range(low, high);
  return {
    inRange: options.flatMap((predict) => values.map((value) => ({ predict, value }))),
    invalid: [
      ...options.map((predict) => ({ predict })), { predict: 'no-such-choice', value: truth.value }, { predict: truth.predict, value: low - 1 }, { predict: truth.predict, value: high + 1 },
      { predict: truth.predict, value: truth.value + 0.5 }, { predict: truth.predict, value: String(truth.value) }, { predict: truth.predict, value: null },
      { predict: truth.predict, value: truth.value, extra: 1 }, { value: truth.value }, { predict: 7, value: truth.value }, {}, null, [],
    ],
    expectMet: (response) => response.predict === truth.predict && response.value === truth.value,
    expectDiagnostic: (response) => (response.value === truth.value ? 'miss' : 'value'),
  };
}

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const wave = (name: string, degrees: number): number => (name === 'cos' ? Math.cos(radians(degrees)) : Math.sin(radians(degrees)));
const SQUARED: Record<string, number> = { zero: 0, half: 1, root2: 2, root3: 3, one: 4 };
const QUADRANTS = ['quadrant-1', 'quadrant-2', 'quadrant-3', 'quadrant-4', 'axis'];

function turnAngle(name: string, p: Json, keep: (degrees: number) => boolean): number | null {
  const found = range(0, 359).filter((degrees) => {
    const value = wave(name, degrees);
    return Math.abs(4 * value * value - SQUARED[p.level]!) < 1e-6 && (p.level === 'zero' || value * p.sign > 0) && keep(degrees);
  });
  return found.length === 1 ? found[0]! : null;
}

const trig: HzBuilder = (p, _r, segment) => {
  if (segment.visual?.type === 'unit-circle') {
    const other = p.ask === 'cos' ? 'sin' : 'cos';
    const angle = turnAngle(p.ask, p, (degrees) => {
      const side = wave(other, degrees);
      return p.side === undefined ? true : p.side === 'upper' || p.side === 'right' ? side > 1e-9 : side < -1e-9;
    });
    if (angle === null) return null;
    return explorer(QUADRANTS, 0, 359, { predict: angle % 90 === 0 ? 'axis' : `quadrant-${Math.floor(angle / 90) + 1}`, value: angle });
  }
  if (segment.visual?.type === 'circle-wave') {
    const angle = turnAngle(p.fn, p, (degrees) => {
      const slope = p.fn === 'cos' ? -Math.sin(radians(degrees)) : Math.cos(radians(degrees));
      return p.slope === undefined ? true : p.slope === 'rising' ? slope > 1e-9 : slope < -1e-9;
    });
    if (angle === null) return null;
    return explorer(['times-1', 'times-2'], 0, 359, { predict: p.level === 'one' ? 'times-1' : 'times-2', value: angle });
  }
  return null;
};

const poly = (c: number[], x: Q): Q => c.reduceRight((sum, coefficient) => add(mul(sum, x), q(coefficient)), ZERO);
const power = (x: Q, exponent: number): Q => { let out = ONE; for (let step = 0; step < exponent; step += 1) out = mul(out, x); return out; };
const area = (c: number[], from: Q, to: Q): Q => c.reduce((sum, coefficient, k) => add(sum, mul(q(coefficient, k + 1), sub(power(to, k + 1), power(from, k + 1)))), ZERO);

function riemannSum(c: number[], from: number, to: number, method: string, n: number): Q {
  const h = q(to - from, n);
  const f = (x: Q): Q => poly(c, x);
  const at = (index: Q): Q => add(q(from), mul(index, h));
  let sum = ZERO;
  if (method === 'trapezoid') {
    sum = div(add(f(q(from)), f(q(to))), q(2));
    for (let index = 1; index < n; index += 1) sum = add(sum, f(at(q(index))));
  } else {
    const shift = method === 'left' ? ZERO : method === 'right' ? ONE : q(1, 2);
    for (let index = 0; index < n; index += 1) sum = add(sum, f(at(add(q(index), shift))));
  }
  return mul(sum, h);
}

const calculus: HzBuilder = (p, _r, segment) => {
  const visual = segment.visual?.type;
  if (visual === 'secant') {
    const c = p.coeffs as number[];
    const slope = c[1]! + 2 * c[2]! * p.a + 3 * c[3]! * p.a * p.a;
    return explorer(['positive', 'negative', 'zero'], -20, 20, { predict: slope > 0 ? 'positive' : slope < 0 ? 'negative' : 'zero', value: slope });
  }
  if (visual === 'derivative-link') {
    const [low, high] = p.roots as [number, number];
    const peak = p.lead > 0 ? low : high;
    const trough = p.lead > 0 ? high : low;
    return explorer(['rising', 'falling'], -4, 4, { predict: p.lead > 0 ? 'falling' : 'rising', value: p.ask === 'max' ? peak : trough });
  }
  if (visual === 'riemann') {
    const c = p.coeffs as number[];
    const tolerance = fromDecimal((p.tolerance as number).toFixed(2));
    if (tolerance === null) return null;
    const exact = area(c, q(p.from), q(p.to));
    let first = 0;
    let big = false;
    for (let n = 1; n <= 40 && first === 0; n += 1) {
      const error = sub(riemannSum(c, p.from, p.to, p.method, n), exact);
      if (n === 1) { if (error.n === 0n) return null; big = error.n > 0n; }
      const size = error.n < 0n ? { n: -error.n, d: error.d } : error;
      if (cmp(size, tolerance) <= 0) first = n;
    }
    return first === 0 ? null : explorer(['too-small', 'too-big'], 1, 40, { predict: big ? 'too-big' : 'too-small', value: first });
  }
  if (visual === 'accumulation') {
    const c = p.coeffs as number[];
    const hits = range(p.from + 1, p.to).filter((x) => eq(area(c, q(p.from), q(x)), q(p.target)));
    if (hits.length !== 1) return null;
    const rate = poly(c, q(hits[0]!));
    return explorer(['growing', 'shrinking', 'flat'], p.from, p.to, { predict: rate.n > 0n ? 'growing' : rate.n < 0n ? 'shrinking' : 'flat', value: hits[0]! });
  }
  return null;
};

export const COM_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'math.network-count.v2': NETWORK,
  'trig.unit-circle.v2': trig,
  'calculus.explorer.v2': calculus,
  'computing.bits-gates.v2': CIRCUITS,
};
