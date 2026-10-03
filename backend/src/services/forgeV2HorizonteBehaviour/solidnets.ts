import { arrangement, type Frame, type Slots } from './arrange.js';
import { cmp, eq, fromDecimal, isInteger, mul, q, type Q } from './rational.js';
import { unique, type HzBuilder, type HzSpace, type Json } from './shared.js';

const whole = (value: unknown, least: number, most: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= least && value <= most;

/* ── the typed surface area of cube-net and solid-net ── */

const AREA_MOST = 9_999;
const FRACTION = /^-?(0|[1-9]\d{0,14})\/[1-9]\d{0,14}$/;

function amount(text: unknown): Q | null {
  if (typeof text !== 'string' || text.length > 32) return null;
  const plain = fromDecimal(text);
  if (plain) return plain;
  if (!FRACTION.test(text)) return null;
  const [top, bottom] = text.split('/');
  return q(BigInt(top!), BigInt(bottom!));
}

const inside = (value: Q): boolean => cmp(value, q(1)) >= 0 && cmp(value, q(AREA_MOST)) <= 0;
const half = (doubled: number): string => (doubled % 2 === 0 ? String(doubled / 2) : `${(doubled - 1) / 2}.5`);

/** `faces2` is twice the area of each face, so a triangle of odd leg product still has a whole number. */
function areaSpace(faces2: readonly number[]): HzSpace | null {
  const total2 = faces2.reduce((sum, area) => sum + area, 0);
  if (total2 % 2 !== 0) return null;
  const target = total2 / 2;
  if (target < 1 || target > AREA_MOST) return null;
  const proper = new Set<number>();
  for (let mask = 1; mask < 2 ** faces2.length - 1; mask += 1) proper.add(faces2.reduce((sum, area, index) => sum + ((mask >> index) & 1 ? area : 0), 0));
  const diagnose = (value: Q): string => {
    const doubled = mul(value, q(2));
    if (!isInteger(doubled)) return 'value';
    const wanted = Number(doubled.n);
    if (faces2.some((area) => total2 + area === wanted)) return 'false_alarm';
    return proper.has(wanted) ? 'miss' : 'value';
  };
  const sums = [...proper, ...faces2.map((area) => total2 + area)].filter((doubled) => doubled >= 2);
  const texts = unique([
    String(target), `${target}.0`, `${target}.00`, `${target * 2}/2`, `${target * 3}/3`, `${target}.000000000000`,
    ...sums.flatMap((doubled) => [half(doubled), `${doubled}/2`]),
    ...[target + 1, target - 1, target * 2, 1, AREA_MOST, 7, target * 3].map(String),
    `${target}.5`, `${target}.25`, `${target * 3 + 1}/3`, `${target * 3 - 1}/3`, '1.5', '3/2',
  ]).filter((text) => { const value = amount(text); return value !== null && inside(value); });
  const bad = ['0', '-1', `-${target}`, String(AREA_MOST + 1), `${(AREA_MOST + 1) * 2 - 1}/2`, '0.5', '1/2', 'abc', '1e2', ` ${target}`, `${target} `, `${target},5`, '.5', `${target}.`, `0${target}`, `${target}/0`, `+${target}`, `${target}.1234567890123`];
  return {
    inRange: texts.map((value) => ({ value })),
    invalid: [
      ...bad.map((value) => ({ value })),
      { value: target }, { value: null }, { value: [String(target)] }, { value: String(target), extra: 1 }, { answer: String(target) }, {}, null, [], 'x',
    ],
    initial: { value: '' },
    expectMet: (response) => { const value = amount(response.value); return value !== null && eq(value, q(target)); },
    expectDiagnostic: (response) => diagnose(amount(response.value)!),
  };
}

export const cubeNetArea: HzBuilder = (p) => {
  if (!whole(p.edge, 1, 40)) return null;
  return areaSpace(Array.from({ length: 6 }, () => 2 * p.edge * p.edge));
};

/* ── the solids that are not cubes ── */

type V3 = readonly [number, number, number];
type Pt = readonly [number, number];
type Kind = 'rect-prism' | 'tri-prism' | 'sq-pyramid';

/** Faces in the order the slots use, each as its corners counter-clockwise seen from outside. */
const BLUEPRINT: Readonly<Record<Kind, ReadonlyArray<readonly [string, readonly number[]]>>> = {
  'rect-prism': [['bottom', [0, 1, 2, 3]], ['top', [7, 6, 5, 4]], ['front', [3, 2, 6, 7]], ['back', [4, 5, 1, 0]], ['left', [0, 3, 7, 4]], ['right', [5, 6, 2, 1]]],
  'tri-prism': [['bottom', [3, 4, 1, 0]], ['back', [2, 5, 3, 0]], ['slope', [4, 5, 2, 1]], ['left', [0, 1, 2]], ['right', [5, 4, 3]]],
  'sq-pyramid': [['bottom', [0, 1, 2, 3]], ['back', [4, 1, 0]], ['right', [4, 2, 1]], ['front', [4, 3, 2]], ['left', [4, 0, 3]]],
};

function corners(kind: Kind, [p, w, h]: readonly number[]): V3[] {
  if (kind === 'rect-prism') return [[0, 0, 0], [p!, 0, 0], [p!, 0, w!], [0, 0, w!], [0, h!, 0], [p!, h!, 0], [p!, h!, w!], [0, h!, w!]];
  if (kind === 'tri-prism') return [[0, 0, 0], [0, 0, p!], [0, w!, 0], [h!, 0, 0], [h!, 0, p!], [h!, w!, 0]];
  return [[0, 0, 0], [p!, 0, 0], [p!, 0, p!], [0, 0, p!], [p! / 2, Math.sqrt(w! * w! - (p! * p!) / 4), p! / 2]];
}

const tidy = (value: number): number => Math.round(value * 1e9) / 1e9 || 0;
const apart = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

interface Edge { a: number; b: number; slot: string }
interface Solid { names: string[]; cycles: number[][]; flat: Pt[][]; edges: Edge[] }
interface Hinge { parent: number; child: number }

/** A face laid flat from the lengths between its corners alone: the first corner at the origin, the second along the x axis, the rest above it. */
function flatten(points: readonly V3[], cycle: readonly number[]): Pt[] {
  const gap = (from: number, to: number): number => apart(points[cycle[from]!]!, points[cycle[to]!]!);
  const base = gap(0, 1);
  return cycle.map((_, at): Pt => {
    if (at === 0) return [0, 0];
    if (at === 1) return [tidy(base), 0];
    const near = gap(0, at);
    const far = gap(1, at);
    const along = (near * near - far * far + base * base) / (2 * base);
    return [tidy(along), tidy(Math.sqrt(Math.max(0, near * near - along * along)))];
  });
}

function solidOf(spec: unknown): Solid | null {
  if (typeof spec !== 'object' || spec === null) return null;
  const { kind, dims } = spec as Json;
  if (typeof kind !== 'string' || !Object.hasOwn(BLUEPRINT, kind) || !Array.isArray(dims)) return null;
  if (dims.length !== (kind === 'sq-pyramid' ? 2 : 3) || !dims.every((entry) => whole(entry, 1, 30))) return null;
  const points = corners(kind as Kind, dims);
  if (points.some((point) => point.some((coordinate) => !Number.isFinite(coordinate)))) return null;
  const faces = BLUEPRINT[kind as Kind];
  const cycles = faces.map(([, cycle]) => [...cycle]);
  const directed = cycles.flatMap((cycle) => cycle.map((vertex, at) => `${vertex}>${cycle[(at + 1) % cycle.length]}`));
  if (new Set(directed).size !== directed.length || !directed.every((key) => directed.includes(key.split('>').reverse().join('>')))) return null;
  const names = faces.map(([name]) => name);
  const edges: Edge[] = [];
  for (let a = 0; a < cycles.length; a += 1) {
    for (let b = a + 1; b < cycles.length; b += 1) {
      if (cycles[a]!.filter((vertex) => cycles[b]!.includes(vertex)).length === 2) edges.push({ a, b, slot: `${names[a]}-${names[b]}` });
    }
  }
  return { names, cycles, flat: cycles.map((cycle) => flatten(points, cycle)), edges };
}

/** Each face lands on the far side of its hinge from its parent: the child is turned so its end of the shared edge meets the parent's. */
function lay(solid: Solid, root: number, order: readonly Hinge[]): Pt[][] | null {
  const mapOf = (face: number, points: readonly Pt[]): Map<number, Pt> => new Map(solid.cycles[face]!.map((vertex, at) => [vertex, points[at]!] as const));
  const placed = new Map<number, Map<number, Pt>>([[root, mapOf(root, solid.flat[root]!)]]);
  for (const { parent, child } of order) {
    const from = placed.get(parent);
    if (!from || placed.has(child)) return null;
    const shared = solid.cycles[child]!.filter((vertex) => solid.cycles[parent]!.includes(vertex));
    if (shared.length !== 2) return null;
    const local = mapOf(child, solid.flat[child]!);
    const [u, v] = shared as [number, number];
    const [pu, pv, lu, lv] = [from.get(u)!, from.get(v)!, local.get(u)!, local.get(v)!];
    const turn = Math.atan2(pv[1] - pu[1], pv[0] - pu[0]) - Math.atan2(lv[1] - lu[1], lv[0] - lu[0]);
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
    placed.set(child, new Map([...local].map(([vertex, point]): [number, Pt] => {
      const dx = point[0] - lu[0];
      const dy = point[1] - lu[1];
      return [vertex, [tidy(pu[0] + cos * dx - sin * dy), tidy(pu[1] + sin * dx + cos * dy)]];
    })));
  }
  return [...placed].map(([face, map]) => solid.cycles[face]!.map((vertex) => map.get(vertex)!));
}

/** Two convex shapes overlap unless some side of one of them has both shapes on its own side; sharing an edge or a corner is not overlap. */
function overlap(a: readonly Pt[], b: readonly Pt[]): boolean {
  for (const shape of [a, b]) {
    for (let at = 0; at < shape.length; at += 1) {
      const from = shape[at]!;
      const to = shape[(at + 1) % shape.length]!;
      const axis: Pt = [from[1] - to[1], to[0] - from[0]];
      const spread = (points: readonly Pt[]): [number, number] => { const along = points.map((point) => point[0] * axis[0] + point[1] * axis[1]); return [Math.min(...along), Math.max(...along)]; };
      const [lowA, highA] = spread(a);
      const [lowB, highB] = spread(b);
      const slack = 1e-7 * Math.hypot(axis[0], axis[1]);
      if (highA <= lowB + slack || highB <= lowA + slack) return false;
    }
  }
  return true;
}

interface Sheet { width: number; height: number }

function sits(shapes: readonly (readonly Pt[])[], sheet: Sheet): boolean {
  for (let first = 0; first < shapes.length; first += 1) for (let second = first + 1; second < shapes.length; second += 1) if (overlap(shapes[first]!, shapes[second]!)) return false;
  const xs = shapes.flatMap((shape) => shape.map((point) => point[0]));
  const ys = shapes.flatMap((shape) => shape.map((point) => point[1]));
  return Math.max(...xs) - Math.min(...xs) <= sheet.width + 1e-6 && Math.max(...ys) - Math.min(...ys) <= sheet.height + 1e-6;
}

/** The hinges in an order that hangs every face from one already placed; null when some hinge hangs from a face that never gets placed. */
function reach(root: number, hinges: readonly Hinge[]): Hinge[] | null {
  const placed = new Set([root]);
  const out: Hinge[] = [];
  let rest = [...hinges];
  for (let moved = true; moved && rest.length > 0;) {
    moved = false;
    const left: Hinge[] = [];
    for (const hinge of rest) {
      if (placed.has(hinge.parent) && !placed.has(hinge.child)) { placed.add(hinge.child); out.push(hinge); moved = true; } else left.push(hinge);
    }
    rest = left;
  }
  return rest.length === 0 ? out : null;
}

/** Every way to hang all the faces from the root with the edges of the solid, as the "parent>child" pairs, that lies flat without overlap on the sheet. */
function nets(solid: Solid, root: number, sheet: Sheet): Set<string>[] {
  const found: Set<string>[] = [];
  const need = solid.names.length - 1;
  const pick = (from: number, chosen: number[]): void => {
    if (chosen.length === need) {
      const seen = new Set([root]);
      const hinges: Hinge[] = [];
      for (let head = 0; head < hinges.length + 1; head += 1) {
        const parent = head === 0 ? root : hinges[head - 1]!.child;
        for (const id of chosen) {
          const edge = solid.edges[id]!;
          if (edge.a !== parent && edge.b !== parent) continue;
          const child = edge.a === parent ? edge.b : edge.a;
          if (!seen.has(child)) { seen.add(child); hinges.push({ parent, child }); }
        }
      }
      const shapes = seen.size === solid.names.length ? lay(solid, root, hinges) : null;
      if (shapes && sits(shapes, sheet)) found.push(new Set(hinges.map((hinge) => `${hinge.parent}>${hinge.child}`)));
      return;
    }
    for (let id = from; id < solid.edges.length; id += 1) pick(id + 1, [...chosen, id]);
  };
  pick(0, []);
  return found;
}

/* ── geometry.solid-net.v2, label mode ── */

function solidLabel(p: Json, r: Json): HzSpace | null {
  const solid = solidOf(p.solid);
  if (!solid || !Array.isArray(p.fixed) || !Array.isArray(r?.solutions) || r.solutions.length === 0) return null;
  const count = solid.names.length;
  const slotOf = (index: number): string => `panel${index}`;
  const fixed = p.fixed as Array<{ panel: number; name: string }>;
  const answers = (r.solutions as Slots[]).map((solution) => Array.from({ length: count }, (_, index) => solution?.[slotOf(index)]?.[0] ?? ''));
  if (answers.some((names) => new Set(names).size !== count || !names.every((name) => solid.names.includes(name)) || !fixed.every((entry) => names[entry.panel] === entry.name))) return null;
  const frame: Frame = { pieces: solid.names, slots: Array.from({ length: count }, (_, index) => slotOf(index)), capacity: () => 1 };
  const free = Array.from({ length: count }, (_, index) => index).filter((index) => !fixed.some((entry) => entry.panel === index));
  const spare = solid.names.filter((name) => !fixed.some((entry) => entry.name === name));
  const given: Slots = Object.fromEntries(fixed.map(({ panel, name }) => [slotOf(panel), [name]]));
  const states: Slots[] = [];
  const assign = (position: number, used: string[], chosen: Array<readonly [number, string]>): void => {
    if (position === free.length) {
      if (chosen.length > 0) states.push({ ...given, ...Object.fromEntries(chosen.map(([index, name]) => [slotOf(index), [name]])) });
      return;
    }
    assign(position + 1, used, chosen);
    for (const name of spare) if (!used.includes(name)) assign(position + 1, [...used, name], [...chosen, [free[position]!, name]]);
  };
  assign(0, [], []);
  const nameAt = (slots: Slots, index: number): string | null => (slots[slotOf(index)]?.length === 1 ? slots[slotOf(index)]![0]! : null);
  const full: Slots = Object.fromEntries(answers[0]!.map((name, index) => [slotOf(index), [name]]));
  const moved: unknown[] = fixed.flatMap(({ panel, name }) => [
    { slots: Object.fromEntries(Object.entries(full).filter(([slot]) => slot !== slotOf(panel))) },
    { slots: { ...given, [slotOf(panel)]: [spare[0]!], [slotOf(free[0]!)]: [name] } },
  ]);
  const swapped: unknown[] = fixed.length > 1 ? [{ slots: { ...given, [slotOf(fixed[0]!.panel)]: [fixed[1]!.name], [slotOf(fixed[1]!.panel)]: [fixed[0]!.name], [slotOf(free[0]!)]: [spare[0]!] } }] : [];
  const space = arrangement(
    frame, full, [...states, full],
    (slots) => free.every((index) => nameAt(slots, index) !== null) && answers.some((names) => free.every((index) => names[index] === nameAt(slots, index))),
    [...moved, ...swapped, { slots: given }], { slots: given },
  );
  return {
    ...space,
    expectDiagnostic: (response) => {
      const slots = response.slots as Slots;
      const placed = free.filter((index) => nameAt(slots, index) !== null);
      const best = Math.max(...answers.map((names) => placed.filter((index) => names[index] === nameAt(slots, index)).length));
      if (placed.length === free.length && best === free.length) return null;
      return best === placed.length ? 'miss' : best > 0 ? 'partial' : 'value';
    },
  };
}

/* ── geometry.solid-net.v2, complete mode ── */

function solidComplete(p: Json): HzSpace | null {
  const solid = solidOf(p.solid);
  const sheet = p.sheet as Sheet;
  if (!solid || !Array.isArray(p.fixed) || !whole(sheet?.width, 3, 60) || !whole(sheet?.height, 3, 60)) return null;
  const root = solid.names.indexOf(p.root);
  const edgeOf = (a: number, b: number): Edge | undefined => solid.edges.find((edge) => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a));
  const given: Hinge[] = (p.fixed as Array<{ parent: string; child: string }>).map((entry) => ({ parent: solid.names.indexOf(entry.parent), child: solid.names.indexOf(entry.child) }));
  if (root < 0 || given.length === 0 || given.some((hinge) => hinge.parent < 0 || hinge.child < 0 || hinge.child === root || !edgeOf(hinge.parent, hinge.child)) || new Set(given.map((hinge) => hinge.child)).size !== given.length) return null;
  const slotOfHinge = (hinge: Hinge): string => edgeOf(hinge.parent, hinge.child)!.slot;
  const givenSlots: Slots = Object.fromEntries(given.map((hinge) => [slotOfHinge(hinge), [solid.names[hinge.child]!]]));
  const hingesOf = (slots: Slots): Hinge[] => Object.entries(slots).flatMap(([slot, pieces]) => {
    const edge = solid.edges.find((entry) => entry.slot === slot);
    const child = pieces.length === 1 ? solid.names.indexOf(pieces[0]!) : -1;
    if (!edge || child < 0 || (edge.a !== child && edge.b !== child)) return [];
    return [{ parent: edge.a === child ? edge.b : edge.a, child }];
  });
  const flats = nets(solid, root, sheet);
  const need = solid.names.length - 1;
  const hung = (hinges: readonly Hinge[]): boolean => {
    const order = hinges.length === need ? reach(root, hinges) : null;
    const shapes = order ? lay(solid, root, order) : null;
    return shapes !== null && sits(shapes, sheet);
  };
  const met = (slots: Slots): boolean => hung(hingesOf(slots));
  const first = flats[0];
  if (!first) return null;
  const key: Slots = Object.fromEntries([...first].map((pair) => { const [parent, child] = pair.split('>').map(Number) as [number, number]; return [slotOfHinge({ parent, child }), [solid.names[child]!]]; }));
  const loose = solid.names.map((_, index) => index).filter((index) => index !== root && !given.some((hinge) => hinge.child === index));
  const taken = new Set(Object.keys(givenSlots));
  const states: Slots[] = [];
  const hang = (position: number, used: Set<string>, chosen: Array<readonly [string, string]>): void => {
    if (position === loose.length) { if (chosen.length > 0) states.push({ ...givenSlots, ...Object.fromEntries(chosen.map(([slot, name]) => [slot, [name]])) }); return; }
    hang(position + 1, used, chosen);
    const face = loose[position]!;
    for (const edge of solid.edges) {
      if ((edge.a !== face && edge.b !== face) || taken.has(edge.slot) || used.has(edge.slot)) continue;
      hang(position + 1, new Set([...used, edge.slot]), [...chosen, [edge.slot, solid.names[face]!]]);
    }
  };
  hang(0, new Set(), []);
  const frame: Frame = { pieces: solid.names.filter((_, index) => index !== root), slots: solid.edges.map((edge) => edge.slot), capacity: () => 1 };
  const target = loose[0]!;
  const apartFrom = solid.edges.find((edge) => edge.a !== target && edge.b !== target && !taken.has(edge.slot));
  const touching = solid.edges.filter((edge) => (edge.a === target || edge.b === target) && !taken.has(edge.slot));
  const reversed = given.map((hinge): unknown => ({ slots: { ...givenSlots, [slotOfHinge(hinge)]: [solid.names[hinge.parent]!] } }));
  const space = arrangement(
    frame, key, states, met,
    [
      ...reversed,
      ...(apartFrom ? [{ slots: { ...givenSlots, [apartFrom.slot]: [solid.names[target]!] } }] : []),
      ...(touching.length > 0 ? [{ slots: { [touching[0]!.slot]: [solid.names[target]!] } }] : []),
      ...(touching.length > 1 ? [{ slots: { ...givenSlots, [touching[0]!.slot]: [solid.names[target]!], [touching[1]!.slot]: [solid.names[target]!] } }] : []),
      { slots: { ...givenSlots, [touching[0]?.slot ?? solid.edges[0]!.slot]: [solid.names[root]!] } },
    ],
    { slots: givenSlots },
  );
  return {
    ...space,
    expectDiagnostic: (response) => {
      const hinges = hingesOf(response.slots as Slots);
      if (hinges.length === need) return hung(hinges) ? null : 'structure';
      return flats.some((pairs) => hinges.every((hinge) => pairs.has(`${hinge.parent}>${hinge.child}`))) ? 'miss' : 'value';
    },
  };
}

/* ── geometry.solid-net.v2, area mode ── */

function solidFaces2(spec: Json): number[] | null {
  if (!solidOf(spec)) return null;
  const [p, w, h] = spec.dims as number[];
  if (spec.kind === 'rect-prism') return [2 * p! * w!, 2 * p! * w!, 2 * p! * h!, 2 * p! * h!, 2 * w! * h!, 2 * w! * h!];
  if (spec.kind === 'tri-prism') {
    const slope = Math.round(Math.hypot(p!, w!));
    return slope * slope === p! * p! + w! * w! ? [2 * p! * h!, 2 * w! * h!, 2 * slope * h!, p! * w!, p! * w!] : null;
  }
  return [2 * p! * p!, p! * w!, p! * w!, p! * w!, p! * w!];
}

const solidNet: HzBuilder = (p, r) => {
  if (p.mode === 'label') return solidLabel(p, r);
  if (p.mode === 'complete') return solidComplete(p);
  if (p.mode !== 'area') return null;
  const faces2 = solidFaces2(p.solid);
  return faces2 ? areaSpace(faces2) : null;
};

export const SOLIDNET_BEHAVIOUR: Readonly<Record<string, HzBuilder>> = {
  'geometry.solid-net.v2': solidNet,
};
