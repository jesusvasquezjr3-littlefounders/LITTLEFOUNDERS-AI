/*
 * F1.15 visual proofs and cut-and-rearrange. Every figure is a set of rigid pieces: a base polygon plus a start pose and
 * an end pose `{ angle, dx, dy }`, applied as R(angle) v + (dx, dy) in a y-up plane. Moving a piece never stretches or
 * rounds it, so "same pieces, same area" holds by construction and the model tests check it. The key (the right formula
 * and the numeric value) is derived here too, so a publish-time check can prove a key matches the geometry it names.
 */
import { canonicalRational, canonicalText, ratio, sameRational, type Rational } from './numeric.js';

export const PROOF_VISUALS = ['parallelogram-area', 'triangle-area', 'trapezoid-area', 'circle-area', 'circumference-unroll', 'pythagoras-proof', 'odd-sum-proof'] as const;
export type ProofVisual = (typeof PROOF_VISUALS)[number];
export const isProofVisual = (value: unknown): value is ProofVisual => typeof value === 'string' && (PROOF_VISUALS as readonly string[]).includes(value);

/** The closed set of formula choices a prediction can offer; labels are board copy, keyed by these ids. */
export const PROOF_CHOICES = [
  'base-height', 'half-base-height', 'base-plus-height', 'half-sum-bases-height', 'sum-bases-height',
  'pi-r-squared', 'pi-diameter', 'pi-radius', 'radius-squared',
  'legs-squares-sum', 'legs-sum-squared', 'legs-sum', 'legs-product',
  'n-times-n', 'n-plus-n', 'n-times-two',
] as const;
export type ProofChoice = (typeof PROOF_CHOICES)[number];
export const isProofChoice = (value: unknown): value is ProofChoice => typeof value === 'string' && (PROOF_CHOICES as readonly string[]).includes(value);

/** The formula that is right for each visual and the pool its distractors come from. */
export const PROOF_FORMULAS: Readonly<Record<ProofVisual, { correct: ProofChoice; pool: readonly ProofChoice[] }>> = {
  'parallelogram-area': { correct: 'base-height', pool: ['base-height', 'half-base-height', 'base-plus-height'] },
  'triangle-area': { correct: 'half-base-height', pool: ['base-height', 'half-base-height', 'base-plus-height'] },
  'trapezoid-area': { correct: 'half-sum-bases-height', pool: ['half-sum-bases-height', 'sum-bases-height', 'half-base-height'] },
  'circle-area': { correct: 'pi-r-squared', pool: ['pi-r-squared', 'pi-diameter', 'pi-radius', 'radius-squared'] },
  'circumference-unroll': { correct: 'pi-diameter', pool: ['pi-diameter', 'pi-r-squared', 'pi-radius', 'radius-squared'] },
  'pythagoras-proof': { correct: 'legs-squares-sum', pool: ['legs-squares-sum', 'legs-sum-squared', 'legs-sum', 'legs-product'] },
  'odd-sum-proof': { correct: 'n-times-n', pool: ['n-times-n', 'n-plus-n', 'n-times-two'] },
};

/** The value of pi every circle question uses: stated to the learner, so the answer is exact. */
export const PROOF_PI = '3.14';
export const PROOF_MAX_VALUE_LENGTH = 12;

export type Pt = readonly [number, number];
export type Pose = { readonly angle: number; readonly dx: number; readonly dy: number };
export type Tone = 'sky' | 'mint' | 'berry' | 'neutral';

/** A piece that can be moved: one base polygon, a start pose and an end pose. Pieces of one `group` move together. */
export interface ProofPiece { id: string; group: string; tone: Tone; base: readonly Pt[]; from: Pose; to: Pose }
/** A polygon already in plane coordinates that never moves. */
export interface ProofShape { id: string; tone: Tone | 'frame'; points: readonly Pt[] }
export type FactKey = 'base' | 'height' | 'slant' | 'apex' | 'top' | 'bottom' | 'offset' | 'radius' | 'diameter' | 'legA' | 'legB' | 'count';
export type ResultShape = 'rectangle' | 'parallelogram' | 'line' | 'squares' | 'square';
export interface ProofLabel { at: Pt; /** Pixel nudge from the anchor, so a label stays clear of a figure at any scale. */ nudge: readonly [number, number]; text: string }
export interface ProofFigure {
  visual: ProofVisual;
  pieces: readonly ProofPiece[];
  fixed: readonly ProofShape[];
  /** Regions the pieces leave empty: shown before any piece moves and after all have. */
  remainders?: { from: readonly ProofShape[]; to: readonly ProofShape[] };
  /** The unrolled length of a circle, drawn as a bar with a tick at each diameter. */
  measure?: { x0: number; y: number; length: number; marks: readonly number[] };
  labels: readonly ProofLabel[];
  facts: ReadonlyArray<{ fact: FactKey; value: number }>;
  result: { shape: ResultShape; a: number; b: number };
  extent: { minX: number; minY: number; maxX: number; maxY: number };
}

const whole = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const plain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const round = (value: number): number => Math.round(value * 1e4) / 1e4;
const pose = (angle: number, dx: number, dy: number): Pose => ({ angle, dx: round(dx), dy: round(dy) });
const POSE_ZERO = pose(0, 0, 0);

/** The point under a pose: rotate by `angle` degrees counter-clockwise, then move by (dx, dy). */
export function placePoint([x, y]: Pt, p: Pose): Pt {
  const radians = (p.angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [round(cos * x - sin * y + p.dx), round(sin * x + cos * y + p.dy)];
}
export const placePolygon = (base: readonly Pt[], p: Pose): Pt[] => base.map((point) => placePoint(point, p));

/** Unsigned shoelace area. */
export function polygonArea(points: readonly Pt[]): number {
  let twice = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]!;
    const [x2, y2] = points[(index + 1) % points.length]!;
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

/** Whether a point lies inside a simple polygon (even-odd rule). */
export function insidePolygon([px, py]: Pt, points: readonly Pt[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [x1, y1] = points[index]!;
    const [x2, y2] = points[previous]!;
    if ((y1 > py) !== (y2 > py) && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

/* ---------- payloads ---------- */

export const PROOF_SECTOR_MIN = 4;
export const PROOF_SECTOR_MAX = 48;
const PAYLOAD_KEYS: Readonly<Record<ProofVisual, string>> = {
  'parallelogram-area': 'base,choices,height,slant',
  'triangle-area': 'apex,base,choices,height',
  'trapezoid-area': 'bottom,choices,height,offset,top',
  'circle-area': 'choices,radius,sectors',
  'circumference-unroll': 'choices,diameter',
  'pythagoras-proof': 'a,b,choices',
  'odd-sum-proof': 'choices,n',
};

export const isTriple = (a: number, b: number): boolean => { const c = Math.round(Math.sqrt(a * a + b * b)); return c * c === a * a + b * b; };

/** Why a payload is not a valid one for the visual, or null. Total: any input is judged, never trusted. */
export function proofPayloadProblem(visual: unknown, payload: unknown): string | null {
  if (!isProofVisual(visual)) return 'Unknown visual';
  if (!plain(payload) || Object.keys(payload).sort().join() !== PAYLOAD_KEYS[visual]) return 'The payload fields do not match the visual';
  const choices = payload.choices;
  const formulas = PROOF_FORMULAS[visual];
  if (!Array.isArray(choices) || choices.length < 3 || choices.length > 5 || new Set(choices).size !== choices.length
    || !choices.every((choice) => isProofChoice(choice) && formulas.pool.includes(choice)) || !choices.includes(formulas.correct)) return 'The choices must be distinct formulas of this visual, with the right one among them';
  const p = payload;
  switch (visual) {
    case 'parallelogram-area': return whole(p.base, 2, 20) && whole(p.height, 1, 20) && whole(p.slant, 1, 19) && p.slant < p.base ? null : 'base 2-20, height 1-20, slant 1 up to base minus 1';
    case 'triangle-area': return whole(p.base, 1, 20) && whole(p.height, 1, 20) && whole(p.apex, 0, 20) && p.apex <= p.base ? null : 'base 1-20, height 1-20, apex 0 up to base';
    case 'trapezoid-area': return whole(p.top, 1, 19) && whole(p.bottom, 2, 20) && p.top < p.bottom && whole(p.height, 1, 20) && whole(p.offset, 0, 19) && p.offset <= p.bottom - p.top ? null : 'top below bottom, height 1-20, offset 0 up to bottom minus top';
    case 'circle-area': {
      const sectors = p.sectors;
      return whole(p.radius, 1, 12) && Array.isArray(sectors) && sectors.length >= 2 && sectors.length <= 5
        && sectors.every((count, index) => whole(count, PROOF_SECTOR_MIN, PROOF_SECTOR_MAX) && count % 2 === 0 && (index === 0 || count > (sectors[index - 1] as number))) ? null : 'radius 1-12 and 2-5 increasing even sector counts from 4 to 48';
    }
    case 'circumference-unroll': return whole(p.diameter, 1, 20) ? null : 'diameter 1-20';
    case 'pythagoras-proof': return whole(p.a, 3, 20) && whole(p.b, 3, 20) && isTriple(p.a, p.b) ? null : 'legs 3-20 that make a whole hypotenuse';
    case 'odd-sum-proof': return whole(p.n, 3, 7) ? null : 'n 3-7';
  }
}

/* ---------- figures ---------- */

const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const num = (value: number): string => String(round(value));

function extentOf(polygons: readonly (readonly Pt[])[], labels: readonly ProofLabel[], pad: number): ProofFigure['extent'] {
  const points = [...polygons.flat(), ...labels.map((label) => label.at)];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { minX: round(Math.min(...xs) - pad), minY: round(Math.min(...ys) - pad), maxX: round(Math.max(...xs) + pad), maxY: round(Math.max(...ys) + pad) };
}

function finish(figure: Omit<ProofFigure, 'extent'>): ProofFigure {
  // A piece whose two poses are the same never needs moving: it is part of the figure, not something to place.
  const still = figure.pieces.filter((piece) => piece.from.angle === piece.to.angle && piece.from.dx === piece.to.dx && piece.from.dy === piece.to.dy);
  const moving = figure.pieces.filter((piece) => !still.includes(piece));
  const fixed = [...figure.fixed, ...still.map((piece): ProofShape => ({ id: piece.id, tone: piece.tone, points: placePolygon(piece.base, piece.from) }))];
  const polygons = [
    ...fixed.map((shape) => shape.points), ...moving.flatMap((piece) => [placePolygon(piece.base, piece.from), placePolygon(piece.base, piece.to)]),
    ...(figure.remainders ? [...figure.remainders.from, ...figure.remainders.to].map((shape) => shape.points) : []),
    ...(figure.measure ? [[[figure.measure.x0, figure.measure.y], [figure.measure.x0 + figure.measure.length, figure.measure.y]] as Pt[]] : []),
  ];
  return { ...figure, pieces: moving, fixed, extent: extentOf(polygons, figure.labels, 0.75) };
}

function wedge(radius: number, sectors: number): Pt[] {
  const theta = (2 * Math.PI) / sectors;
  const steps = Math.min(12, Math.max(2, Math.round(48 / sectors)));
  const points: Pt[] = [[0, 0]];
  for (let step = 0; step <= steps; step += 1) {
    const angle = Math.PI / 2 - theta / 2 + (theta * step) / steps;
    points.push([round(radius * Math.cos(angle)), round(radius * Math.sin(angle))]);
  }
  return points;
}

/** Odd-sum gnomon k: the L of 2k-1 unit squares that grows a (k-1) square into a k square. */
const gnomon = (k: number): Pt[] => (k === 1 ? rect(0, 0, 1, 1) : [[k - 1, 0], [k, 0], [k, k], [0, k], [0, k - 1], [k - 1, k - 1]]);

/** The figure of a valid payload; `sectors` picks the circle's slice count (one of the payload's), ignored elsewhere. */
export function proofFigure(visual: ProofVisual, payload: Record<string, unknown>, sectors?: number): ProofFigure | null {
  if (proofPayloadProblem(visual, payload) !== null) return null;
  const p = payload as Record<string, number>;
  switch (visual) {
    case 'parallelogram-area': {
      const { base: b, height: h, slant: s } = p as { base: number; height: number; slant: number };
      return finish({
        visual, fixed: [{ id: 'body', tone: 'sky', points: [[s, 0], [b, 0], [b + s, h], [s, h]] }],
        pieces: [{ id: 'wedge', group: 'wedge', tone: 'mint', base: [[0, 0], [s, 0], [s, h]], from: POSE_ZERO, to: pose(0, b, 0) }],
        labels: [{ at: [b / 2, 0], nudge: [0, 18], text: num(b) }, { at: [0, h / 2], nudge: [-14, 4], text: num(h) }],
        facts: [{ fact: 'base', value: b }, { fact: 'height', value: h }, { fact: 'slant', value: s }], result: { shape: 'rectangle', a: b, b: h },
      });
    }
    case 'triangle-area': {
      const { base: b, height: h, apex: a } = p as { base: number; height: number; apex: number };
      const triangle: Pt[] = [[0, 0], [b, 0], [a, h]];
      return finish({
        visual, fixed: [{ id: 'triangle', tone: 'sky', points: triangle }],
        pieces: [{ id: 'copy', group: 'copy', tone: 'mint', base: triangle, from: pose(0, 0, -h - 1), to: pose(180, b + a, h) }],
        labels: [{ at: [b / 2, 0], nudge: [0, 18], text: num(b) }, { at: [0, h / 2], nudge: [-14, 4], text: num(h) }],
        facts: [{ fact: 'base', value: b }, { fact: 'height', value: h }, { fact: 'apex', value: a }], result: { shape: 'parallelogram', a: b, b: h },
      });
    }
    case 'trapezoid-area': {
      const { top: t, bottom: u, height: h, offset: o } = p as { top: number; bottom: number; height: number; offset: number };
      const trapezoid: Pt[] = [[0, 0], [u, 0], [o + t, h], [o, h]];
      return finish({
        visual, fixed: [{ id: 'trapezoid', tone: 'sky', points: trapezoid }],
        pieces: [{ id: 'copy', group: 'copy', tone: 'mint', base: trapezoid, from: pose(0, 0, -h - 1), to: pose(180, u + o + t, h) }],
        labels: [{ at: [o + t / 2, h], nudge: [0, -8], text: num(t) }, { at: [u / 2, 0], nudge: [0, 18], text: num(u) }, { at: [0, h / 2], nudge: [-14, 4], text: num(h) }],
        facts: [{ fact: 'top', value: t }, { fact: 'bottom', value: u }, { fact: 'height', value: h }, { fact: 'offset', value: o }], result: { shape: 'parallelogram', a: t + u, b: h },
      });
    }
    case 'circle-area': {
      const { radius: r } = p as { radius: number };
      const list = (payload as { sectors: number[] }).sectors;
      const n = sectors !== undefined && list.includes(sectors) ? sectors : list[0]!;
      const theta = (2 * Math.PI) / n;
      const half = theta / 2;
      const base = wedge(r, n);
      // The whole circle is one thing to move: the slices rotate about its centre and then lie side by side, points up and down in turn.
      const centre = -(r + 1 + r * Math.sin(half));
      const pieces: ProofPiece[] = Array.from({ length: n }, (_, index) => {
        const x = index * r * Math.sin(half);
        return {
          id: `slice-${index + 1}`, group: 'slices', tone: index % 2 === 0 ? 'sky' : 'mint', base,
          from: pose((index * 360) / n, centre, r),
          to: index % 2 === 0 ? pose(0, x, 0) : pose(180, x, r * Math.cos(half)),
        } satisfies ProofPiece;
      });
      return finish({
        visual, fixed: [], pieces,
        labels: [],
        facts: [{ fact: 'radius', value: r }, { fact: 'count', value: n }],
        result: { shape: 'rectangle', a: round(Math.round(Math.PI * r * 100) / 100), b: r },
      });
    }
    case 'circumference-unroll': {
      const { diameter: d } = p as { diameter: number };
      const r = d / 2;
      const disc: Pt[] = Array.from({ length: 48 }, (_, index) => [round(r * Math.cos((index * Math.PI) / 24)), round(r * Math.sin((index * Math.PI) / 24))] as Pt);
      const travel = Math.PI * d;
      const w = Math.max(0.05 * d, 0.08);
      const marks = [1, 2, 3].map((k) => k * d).filter((mark) => mark < travel);
      // The spoke starts pointing down at the ground, so one full turn of the wheel lays one circumference on the line.
      return finish({
        visual, fixed: [{ id: 'ground', tone: 'neutral', points: rect(-0.4 * d, -0.12 * d, 2 * r + travel + 0.8 * d, 0.12 * d) }],
        pieces: [
          { id: 'disc', group: 'wheel', tone: 'sky', base: disc, from: pose(0, r, r), to: pose(-360, r + travel, r) },
          { id: 'spoke', group: 'wheel', tone: 'berry', base: rect(-w, 0, 2 * w, r), from: pose(180, r, r), to: pose(-180, r + travel, r) },
        ],
        measure: { x0: r, y: -0.45 * d, length: round(travel), marks },
        labels: [{ at: [r, d], nudge: [0, -8], text: num(d) }],
        facts: [{ fact: 'diameter', value: d }], result: { shape: 'line', a: round(Math.round(Math.PI * d * 100) / 100), b: d },
      });
    }
    case 'pythagoras-proof': {
      const { a, b } = p as { a: number; b: number };
      const s = a + b;
      const triangle: Pt[] = [[0, 0], [a, 0], [0, b]];
      return finish({
        visual, fixed: [{ id: 'frame', tone: 'frame', points: rect(0, 0, s, s) }],
        pieces: [
          { id: 'corner-1', group: 'corner-1', tone: 'mint', base: triangle, from: pose(0, 0, 0), to: pose(0, 0, a) },
          { id: 'corner-2', group: 'corner-2', tone: 'mint', base: triangle, from: pose(90, s, 0), to: pose(90, s, 0) },
          { id: 'corner-3', group: 'corner-3', tone: 'mint', base: triangle, from: pose(180, s, s), to: pose(270, a, a) },
          { id: 'corner-4', group: 'corner-4', tone: 'mint', base: triangle, from: pose(270, 0, s), to: pose(180, a, s) },
        ],
        remainders: {
          from: [{ id: 'hypotenuse-square', tone: 'berry', points: [[a, 0], [s, a], [b, s], [0, b]] }],
          to: [{ id: 'leg-a-square', tone: 'sky', points: rect(0, 0, a, a) }, { id: 'leg-b-square', tone: 'berry', points: rect(a, a, b, b) }],
        },
        labels: [{ at: [a / 2, 0], nudge: [0, 18], text: num(a) }, { at: [a + b / 2, 0], nudge: [0, 18], text: num(b) }],
        facts: [{ fact: 'legA', value: a }, { fact: 'legB', value: b }], result: { shape: 'squares', a, b },
      });
    }
    case 'odd-sum-proof': {
      const { n } = p as { n: number };
      const order = Array.from({ length: n }, (_, index) => n - index);
      const pieces: ProofPiece[] = [];
      let cursor = 0;
      let top = n;
      let rowHeight = order[0]!;
      let row: number[] = [];
      const flush = (): void => {
        let x = 0;
        for (const k of row) { pieces.push({ id: `odd-${2 * k - 1}`, group: `odd-${2 * k - 1}`, tone: k % 2 === 0 ? 'mint' : 'sky', base: gnomon(k), from: pose(0, n + 1 + x, top - rowHeight), to: POSE_ZERO }); x += k + 1; }
        top -= rowHeight + 1;
      };
      for (const k of order) {
        if (cursor > 0 && cursor + k > 2 * n) { flush(); row = []; cursor = 0; rowHeight = k; }
        row.push(k);
        cursor += k + 1;
      }
      flush();
      pieces.sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)));
      return finish({
        visual, fixed: [{ id: 'frame', tone: 'frame', points: rect(0, 0, n, n) }], pieces,
        labels: [{ at: [n / 2, 0], nudge: [0, 18], text: num(n) }],
        facts: [{ fact: 'count', value: n }], result: { shape: 'square', a: n, b: n },
      });
    }
  }
}

/** The things a learner moves, in order: every piece of a group travels together. */
export const proofGroups = (figure: ProofFigure): string[] => [...new Set(figure.pieces.map((piece) => piece.group))];

/* ---------- the key ---------- */

/** The exact value the question asks for, or null for an invalid payload. pi is 3.14 and stated as such. */
export function proofValue(visual: ProofVisual, payload: Record<string, unknown>): Rational | null {
  if (proofPayloadProblem(visual, payload) !== null) return null;
  const p = payload as Record<string, number>;
  switch (visual) {
    case 'parallelogram-area': return ratio(p.base! * p.height!);
    case 'triangle-area': return ratio(p.base! * p.height!, 2);
    case 'trapezoid-area': return ratio((p.top! + p.bottom!) * p.height!, 2);
    case 'circle-area': return ratio(314 * p.radius! * p.radius!, 100);
    case 'circumference-unroll': return ratio(314 * p.diameter!, 100);
    case 'pythagoras-proof': return ratio(Math.round(Math.sqrt(p.a! * p.a! + p.b! * p.b!)));
    case 'odd-sum-proof': return ratio(p.n! * p.n!);
  }
}

/** The key a piece must hold for a payload: the right formula and the canonical value text. Null when the payload is invalid. */
export function proofKey(visual: ProofVisual, payload: Record<string, unknown>): { choice: ProofChoice; value: string } | null {
  const value = proofValue(visual, payload);
  const text = value === null ? null : canonicalText(value);
  return text === null ? null : { choice: PROOF_FORMULAS[visual].correct, value: text };
}

/** Whether typed text names the same number as the key value; both must be canonical decimals. */
export function sameProofValue(typed: unknown, keyed: unknown): boolean {
  const a = canonicalRational(typed);
  const b = canonicalRational(keyed);
  return a !== null && b !== null && sameRational(a, b);
}
