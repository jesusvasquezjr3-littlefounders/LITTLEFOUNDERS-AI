import type { GateProblem } from '../../pipeline/gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const GEOM2_CAPABILITIES = {
  'math.geoboard.v2': ['visual.geoboard.v1', 'operation.tap-pegs.v1'],
  'math.area-squares.v2': ['visual.area-squares.v1', 'operation.shade-cells.v1'],
  'math.transform.v2': ['visual.transform-plane.v1', 'visual.symmetry-mirror.v1', 'operation.drag-point.v1'],
  'math.tessellation.v2': ['visual.tessellation.v1', 'operation.place-tile.v1'],
} as const;

const GEOBOARD = 'math.geoboard.v2';
const AREA = 'math.area-squares.v2';
const TRANSFORM = 'math.transform.v2';
const TESSELLATION = 'math.tessellation.v2';

const GEOM2_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: GEOBOARD,
    lines: [
      `${GEOBOARD}: ages 8-12 only. The prompt is one imperative sentence that names the goal as a shape on the band (cover 6 squares, make a right triangle that covers 4 squares), never a peg coordinate.`,
      `${GEOBOARD}: the payload is only the board size (3 to 8 pegs a side). The private key is the band's area in half squares (area2) and, when the prompt names a figure, that figure (triangle, right-triangle, rectangle, square or parallelogram). Never leave the area open.`,
    ],
  },
  {
    type: AREA,
    lines: [
      `${AREA}: ages 8-12 only. The prompt asks the learner to shade the squares inside an outline, never to state a count. The outline runs along the grid lines, turns at every corner and covers 1 to 32 squares.`,
      `${AREA}: the private key is every square inside the outline, each named by its lower-left corner. Never put the squares in the payload.`,
    ],
  },
  {
    type: TRANSFORM,
    lines: [
      `${TRANSFORM}: ages 8-15 only. The prompt names the move in plain words (reflect across the vertical line, slide 5 right and 3 up, quarter turn about the origin, enlarge by 2 from the center), never the image.`,
      `${TRANSFORM}: the figure is a simple polygon of 3 to 6 corners on whole pegs; its image must land on whole pegs inside the plane and differ from it. A dilation uses a ratio num/den in lowest terms (1 to 4) and every corner must land on a peg. The private key is the image corners.`,
      `${TRANSFORM}: use the symmetry-mirror visual only for a vertical or horizontal reflection with the whole figure on one side of the line (draw the other half).`,
    ],
  },
  {
    type: TESSELLATION,
    lines: [
      `${TESSELLATION}: ages 8-15 only. The prompt asks to cover the floor with copies of the tile and names what may be done to it: slid only, or also turned half a turn or flipped over when the payload lists moves.`,
      `${TESSELLATION}: build the floor from copies of the tile you chose, so a cover exists. The tile is 2 to 6 connected cells starting at the origin; the floor is whole copies of it, at most 24, inside a 12 by 12 grid. The private key is the number of copies.`,
      `${TESSELLATION}: add moves (slide first, then turn, flip or both, each once) only when the floor really needs them. A turn is half a turn about the middle of the tile and a flip is a left-to-right mirror image; the learner may use any listed move on any copy, so a cover must exist with the moves you list. Leave moves out for a slide-only floor.`,
    ],
  },
];

type Point = { x: number; y: number };
const BUDGET = 60_000;
const MAX_CELLS = 32;
const SHAPES = ['triangle', 'right-triangle', 'rectangle', 'square', 'parallelogram'];
const MIRRORS = ['vertical', 'horizontal', 'diagonal', 'anti-diagonal'];

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const keysAre = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) =>
  required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
const isPoint = (value: unknown): value is Point => record(value) && keysAre(value, ['x', 'y']) && whole(value.x, -1000, 1000) && whole(value.y, -1000, 1000);
const isPoints = (value: unknown, minimum: number, maximum: number): value is Point[] => Array.isArray(value) && value.length >= minimum && value.length <= maximum && value.every(isPoint);
const key = (point: Point) => `${point.x},${point.y}`;
const distinct = (points: readonly Point[]) => new Set(points.map(key)).size === points.length;
const sameSet = (left: readonly Point[], right: readonly Point[]) => left.length === right.length && distinct(left) && right.every((point) => left.some((other) => key(other) === key(point)));
const bounds = (points: readonly Point[]) => ({
  minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)),
});

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const dot = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.x - o.x) + (a.y - o.y) * (b.y - o.y);
const between = (v: number, a: number, b: number) => v >= Math.min(a, b) && v <= Math.max(a, b);
const onSegment = (a: Point, b: Point, p: Point) => cross(a, b, p) === 0 && between(p.x, a.x, b.x) && between(p.y, a.y, b.y);
function segmentsMeet(a: Point, b: Point, c: Point, d: Point) {
  if (Math.sign(cross(a, b, c)) * Math.sign(cross(a, b, d)) < 0 && Math.sign(cross(c, d, a)) * Math.sign(cross(c, d, b)) < 0) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
const area2 = (points: readonly Point[]) => Math.abs(points.reduce((sum, p, i) => sum + p.x * points[(i + 1) % points.length]!.y - points[(i + 1) % points.length]!.x * p.y, 0));
function simple(points: readonly Point[]) {
  const n = points.length;
  if (n < 3 || !distinct(points) || area2(points) === 0) return false;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = points[i]!; const b = points[(i + 1) % n]!; const c = points[j]!; const d = points[(j + 1) % n]!;
      const next = j === i + 1;
      if (next || (i === 0 && j === n - 1)) {
        const shared = next ? b : a;
        if (cross(shared, next ? a : b, next ? d : c) === 0 && dot(shared, next ? a : b, next ? d : c) > 0) return false;
      } else if (segmentsMeet(a, b, c, d)) return false;
    }
  }
  return true;
}
const corners = (points: readonly Point[]) => points.filter((p, i) => cross(points[(i + points.length - 1) % points.length]!, p, points[(i + 1) % points.length]!) !== 0);
const rightAt = (c: readonly Point[], i: number) => dot(c[i]!, c[(i + c.length - 1) % c.length]!, c[(i + 1) % c.length]!) === 0;
function isShape(points: readonly Point[], shape: string) {
  const c = corners(points);
  if (shape === 'triangle') return c.length === 3;
  if (shape === 'right-triangle') return c.length === 3 && c.some((_, i) => rightAt(c, i));
  if (c.length !== 4) return false;
  const [a, b, d, e] = c as [Point, Point, Point, Point];
  const parallelogram = a.x + d.x === b.x + e.x && a.y + d.y === b.y + e.y;
  if (shape === 'parallelogram') return parallelogram;
  if (!parallelogram || !rightAt(c, 0)) return false;
  return shape === 'rectangle' || (a.x - b.x) ** 2 + (a.y - b.y) ** 2 === (b.x - d.x) ** 2 + (b.y - d.y) ** 2;
}

function bandExists(size: number, area: number, shape: unknown) {
  const top = size - 1;
  for (let a = 1; a <= top; a += 1) {
    for (let b = 1; b <= top; b += 1) {
      const bands: Point[][] = [[{ x: 0, y: 0 }, { x: a, y: 0 }, { x: a, y: b }, { x: 0, y: b }], [{ x: 0, y: 0 }, { x: a, y: 0 }, { x: 0, y: b }]];
      for (let skew = 0; a + skew <= top; skew += 1) bands.push([{ x: 0, y: 0 }, { x: a, y: 0 }, { x: a + skew, y: b }, { x: skew, y: b }], [{ x: 0, y: 0 }, { x: a, y: 0 }, { x: skew, y: b }]);
      if (bands.some((band) => simple(band) && area2(band) === area && (typeof shape !== 'string' || isShape(band, shape)))) return true;
    }
  }
  return false;
}

function cellsInside(outline: readonly Point[], columns: number, rows: number) {
  const cells: Point[] = [];
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      let inside = false;
      for (let i = 0; i < outline.length; i += 1) {
        const a = outline[i]!; const b = outline[(i + 1) % outline.length]!;
        if (a.x !== b.x || 2 * a.x < 2 * column + 1) continue;
        if (2 * Math.min(a.y, b.y) < 2 * row + 1 && 2 * row + 1 < 2 * Math.max(a.y, b.y)) inside = !inside;
      }
      if (inside) cells.push({ x: column, y: row });
    }
  }
  return cells;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
function imageOf(move: Record<string, unknown>, figure: readonly Point[]): Point[] | null {
  const image: Point[] = [];
  for (const p of figure) {
    let q: Point;
    if (move.kind === 'translate') q = { x: p.x + (move.dx as number), y: p.y + (move.dy as number) };
    else if (move.kind === 'reflect') {
      const at = move.at as number;
      q = move.across === 'vertical' ? { x: 2 * at - p.x, y: p.y } : move.across === 'horizontal' ? { x: p.x, y: 2 * at - p.y }
        : move.across === 'diagonal' ? { x: p.y - at, y: p.x + at } : { x: at - p.y, y: at - p.x };
    } else if (move.kind === 'rotate') {
      const about = move.about as Point; const dx = p.x - about.x; const dy = p.y - about.y;
      q = move.degrees === 90 ? { x: about.x - dy, y: about.y + dx } : move.degrees === 180 ? { x: about.x - dx, y: about.y - dy } : { x: about.x + dy, y: about.y - dx };
    } else {
      const about = move.about as Point; const num = move.num as number; const den = move.den as number;
      const dx = (p.x - about.x) * num; const dy = (p.y - about.y) * num;
      if (dx % den !== 0 || dy % den !== 0) return null;
      q = { x: about.x + dx / den, y: about.y + dy / den };
    }
    image.push(q);
  }
  return image;
}
function moveProblem(move: unknown): string | null {
  if (!record(move)) return 'The move is missing';
  if (move.kind === 'translate') return keysAre(move, ['kind', 'dx', 'dy']) && whole(move.dx, -20, 20) && whole(move.dy, -20, 20) && (move.dx !== 0 || move.dy !== 0) ? null : 'A translation moves by whole pegs, at least one';
  if (move.kind === 'reflect') return keysAre(move, ['kind', 'across', 'at']) && MIRRORS.includes(move.across as string) && whole(move.at, -10, 10) ? null : 'A reflection names its line (vertical, horizontal, diagonal or anti-diagonal) and where it sits';
  if (move.kind === 'rotate') return keysAre(move, ['kind', 'degrees', 'about']) && [90, 180, 270].includes(move.degrees as number) && isPoint(move.about) ? null : 'A rotation is 90, 180 or 270 degrees counterclockwise about a peg';
  if (move.kind === 'dilate') return keysAre(move, ['kind', 'num', 'den', 'about']) && whole(move.num, 1, 4) && whole(move.den, 1, 4) && move.num !== move.den && gcd(move.num as number, move.den as number) === 1 && isPoint(move.about)
    ? null : 'A dilation is a ratio num/den of whole numbers 1 to 4 in lowest terms, not 1, about a peg';
  return 'The move is a translation, a reflection, a rotation or a dilation';
}
const inPlane = (points: readonly Point[], extent: number) => points.every((p) => Math.abs(p.x) <= extent && Math.abs(p.y) <= extent);

function connected(cells: readonly Point[]) {
  const seen = new Set([key(cells[0]!)]); const queue = [cells[0]!];
  while (queue.length > 0) {
    const here = queue.pop()!;
    for (const next of [{ x: here.x + 1, y: here.y }, { x: here.x - 1, y: here.y }, { x: here.x, y: here.y + 1 }, { x: here.x, y: here.y - 1 }]) {
      if (cells.some((c) => key(c) === key(next)) && !seen.has(key(next))) { seen.add(key(next)); queue.push(next); }
    }
  }
  return seen.size === cells.length;
}
function tileProblem(tile: unknown): string | null {
  if (!isPoints(tile, 2, 6) || !distinct(tile) || !connected(tile)) return 'The tile is 2 to 6 distinct cells that touch edge to edge';
  const span = bounds(tile);
  return span.minX === 0 && span.minY === 0 ? null : 'The tile starts at the origin: its smallest x and its smallest y are both 0';
}
function floorProblem(floor: unknown, tile: readonly Point[]): string | null {
  if (!isPoints(floor, tile.length, tile.length * 24) || !distinct(floor) || floor.length % tile.length !== 0) return 'The floor is whole copies of the tile: 1 to 24 of them, no cell twice';
  const span = bounds(floor);
  return span.minX >= 0 && span.minY >= 0 && span.maxX <= 11 && span.maxY <= 11 ? null : 'The floor stays inside a 12 by 12 grid of cells';
}
const MOTIONS = ['slide', 'turn', 'flip'];
function movesProblem(moves: unknown): string | null {
  const order = Array.isArray(moves) ? moves.map((move) => MOTIONS.indexOf(move as string)) : [];
  const ok = order.length >= 2 && order.length <= 3 && order[0] === 0 && order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1]!));
  return ok ? null : 'The moves are slide first and then turn, flip or both, each once';
}
function oriented(tile: readonly Point[], motion: string): Point[] {
  const span = bounds(tile);
  const cells = tile.map((cell) => (motion === 'turn' ? { x: span.minX + span.maxX - cell.x, y: span.minY + span.maxY - cell.y } : motion === 'flip' ? { x: span.minX + span.maxX - cell.x, y: cell.y } : { x: cell.x, y: cell.y }));
  return cells.sort((a, b) => a.x - b.x || a.y - b.y);
}
/** What an exact-cover search proved: a cover (and its copy count), no cover, or that the step budget ran out before either. */
interface CoverSearch { covered: boolean; exhausted: boolean; steps: number; copies: number }
function coverSearch(floor: readonly Point[], tile: readonly Point[], motions: readonly string[], limit: number): CoverSearch {
  const order = (a: Point, b: Point) => a.x - b.x || a.y - b.y;
  const cells = [...floor].sort(order);
  const shapes = [...new Map(motions.map((motion) => oriented(tile, motion)).map((shape) => [shape.map(key).join(';'), shape])).values()];
  const open = new Set(cells.map(key)); let budget = limit; let exhausted = false; let copies = 0;
  const search = (from: number, placed: number): boolean => {
    let index = from;
    while (index < cells.length && !open.has(key(cells[index]!))) index += 1;
    if (index === cells.length) { copies = placed; return true; }
    for (const shape of shapes) {
      if (budget <= 0) { exhausted = true; return false; }
      budget -= 1;
      const dx = cells[index]!.x - shape[0]!.x; const dy = cells[index]!.y - shape[0]!.y;
      const used = shape.map((c) => key({ x: c.x + dx, y: c.y + dy }));
      if (!used.every((k) => open.has(k))) continue;
      for (const k of used) open.delete(k);
      if (search(index + 1, placed + 1)) return true;
      for (const k of used) open.add(k);
    }
    return false;
  };
  const covered = search(0, 0);
  return { covered, exhausted: !covered && exhausted, steps: limit - budget, copies };
}
/** The pack gate: a cover found inside the fixed BUDGET; running out of steps counts as no cover (the Core publish check does the same). */
const solvable = (floor: readonly Point[], tile: readonly Point[], motions: readonly string[]) => coverSearch(floor, tile, motions, BUDGET).covered;

type Add = (message: string) => void;
type KeyOf = () => Record<string, unknown> | null | undefined;

function geoboardGate(segment: Record<string, unknown>, add: Add, keyOf: KeyOf) {
  const payload = segment.payload;
  if (!record(payload) || !keysAre(payload, ['size']) || !whole(payload.size, 3, 8)) return add('The geoboard payload is only its size, 3 to 8 pegs a side');
  const size = payload.size as number;
  const secret = keyOf();
  if (secret === undefined) return;
  if (!record(secret) || !keysAre(secret, ['area2'], ['shape'])) return add('The geoboard key is the band area in half squares, and optionally the named figure');
  if (!whole(secret.area2, 1, 2 * (size - 1) ** 2)) return add('The geoboard area (in half squares) must fit on the board: 1 to twice the squares a side minus one, squared');
  if (secret.shape !== undefined && !SHAPES.includes(secret.shape as string)) return add('The geoboard figure is a triangle, right-triangle, rectangle, square or parallelogram');
  if (!bandExists(size, secret.area2 as number, secret.shape)) add('No band on this board has that area and figure; the geoboard cannot be solved');
}

function areaGate(segment: Record<string, unknown>, add: Add, keyOf: KeyOf) {
  const payload = segment.payload;
  if (!record(payload) || !keysAre(payload, ['columns', 'rows', 'outline']) || !whole(payload.columns, 2, 8) || !whole(payload.rows, 2, 8)) return add('The area grid is 2 to 8 squares wide and tall, with an outline');
  const { columns, rows, outline } = payload as { columns: number; rows: number; outline: unknown };
  if (!isPoints(outline, 4, 16) || !outline.every((p) => p.x >= 0 && p.x <= columns && p.y >= 0 && p.y <= rows)) return add('The outline is 4 to 16 corners on the grid lines, inside the grid');
  if (!simple(outline) || !outline.every((p, i) => (p.x === outline[(i + 1) % outline.length]!.x) !== (p.y === outline[(i + 1) % outline.length]!.y)) || corners(outline).length !== outline.length) {
    return add('The outline is a simple closed band that runs along the grid lines and turns at every listed corner');
  }
  const cells = cellsInside(outline, columns, rows);
  if (cells.length < 1 || cells.length > MAX_CELLS) return add('The outline covers 1 to 32 squares');
  const secret = keyOf();
  if (secret === undefined) return;
  if (!record(secret) || !keysAre(secret, ['required']) || !isPoints(secret.required, 1, MAX_CELLS) || !sameSet(secret.required, cells)) add('The area key must be exactly the squares inside the outline, each by its lower-left corner');
}

function transformGate(segment: Record<string, unknown>, add: Add, keyOf: KeyOf) {
  const payload = segment.payload;
  if (!record(payload) || !keysAre(payload, ['extent', 'figure', 'move']) || !whole(payload.extent, 3, 10)) return add('The transformation payload is the plane extent (3 to 10), the figure and the move');
  const { extent, figure, move } = payload as { extent: number; figure: unknown; move: unknown };
  if (!isPoints(figure, 3, 6) || !distinct(figure) || !inPlane(figure, extent) || !simple(figure)) return add('The figure is a simple polygon of 3 to 6 corners on pegs inside the plane');
  const problem = moveProblem(move);
  if (problem) return add(problem);
  const image = imageOf(move as Record<string, unknown>, figure);
  if (!image) return add('A corner of the image falls between pegs; choose a center and ratio that land every corner on a peg');
  if (!inPlane(image, extent)) return add('The image must stay inside the plane');
  if (sameSet(image, figure)) return add('The image must differ from the figure');
  const visual = (segment.visual as { type?: unknown } | undefined)?.type;
  if (visual === 'symmetry-mirror') {
    const mirror = move as { kind: string; across: string; at: number };
    const offsets = figure.map((p) => (mirror.across === 'vertical' ? p.x : p.y) - mirror.at);
    if (mirror.kind !== 'reflect' || (mirror.across !== 'vertical' && mirror.across !== 'horizontal') || (offsets.some((o) => o < 0) && offsets.some((o) => o > 0)) || offsets.every((o) => o === 0)) {
      add('A symmetry mirror reflects over a vertical or horizontal line with the whole figure on one side of it');
    }
  } else if (visual !== 'transform-plane') add('The transformation visual is transform-plane or symmetry-mirror');
  const secret = keyOf();
  if (secret === undefined) return;
  if (!record(secret) || !keysAre(secret, ['required']) || !isPoints(secret.required, 3, 6) || !sameSet(secret.required, image)) add('The transformation key must be exactly the image corners of the figure under the move');
}

function tessellationGate(segment: Record<string, unknown>, add: Add, keyOf: KeyOf) {
  const payload = segment.payload;
  if (!record(payload) || !keysAre(payload, ['floor', 'tile'], ['moves'])) return add('The tessellation payload is the floor and the tile, as lists of cells, and optionally the moves');
  if (Object.hasOwn(payload, 'moves')) {
    const movesIssue = movesProblem(payload.moves);
    if (movesIssue) return add(movesIssue);
  }
  const tile = payload.tile;
  const tileIssue = tileProblem(tile);
  if (tileIssue) return add(tileIssue);
  const floorIssue = floorProblem(payload.floor, tile as Point[]);
  if (floorIssue) return add(floorIssue);
  const floor = payload.floor as Point[];
  const motions = Array.isArray(payload.moves) ? (payload.moves as string[]) : ['slide'];
  if (!solvable(floor, tile as Point[], motions)) return add(`The tile cannot cover the floor by ${motions.length > 1 ? 'the moves listed' : 'sliding alone'}; build the floor from copies of the tile`);
  const secret = keyOf();
  if (secret === undefined) return;
  if (!record(secret) || !keysAre(secret, ['copies']) || secret.copies !== floor.length / (tile as Point[]).length) add('The tessellation key is the number of copies an exact cover takes');
}

const GATES: Readonly<Record<string, (segment: Record<string, unknown>, add: Add, keyOf: KeyOf) => void>> = {
  [GEOBOARD]: geoboardGate, [AREA]: areaGate, [TRANSFORM]: transformGate, [TESSELLATION]: tessellationGate,
};

/** Gate 4 (solvability): each public payload is well-formed, the private key is exactly what the payload implies, and a solution exists. */
function geom2Gates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const gate = typeof segment.type === 'string' ? GATES[segment.type] : undefined;
    if (!gate) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const keyOf: KeyOf = () => (answerKeys && Object.hasOwn(answerKeys, segmentId) ? (answerKeys[segmentId] as Record<string, unknown> | null) : undefined);
    gate(segment, (message) => problems.push({ gate: 4, segmentId, message }), keyOf);
  }
  return problems;
}

/* The pure lattice, move and cover functions the Forge solvability checker (solvability-geom.ts) reuses; the pack gates above are unchanged. */
export {
  BUDGET as GEOM2_COVER_BUDGET, MAX_CELLS as GEOM2_MAX_CELLS, MIRRORS as GEOM2_MIRRORS, SHAPES as GEOM2_SHAPES,
  area2, bounds, cellsInside, connected, corners, coverSearch, distinct, floorProblem, imageOf, inPlane, isPoint, isPoints, isShape,
  key as pointKey, moveProblem, movesProblem, oriented, sameSet, simple, tileProblem,
};
export type { CoverSearch, Point as LatticePoint };

export const geom2 = {
  id: 'geom2',
  capabilities: GEOM2_CAPABILITIES,
  guidance: GEOM2_GUIDANCE,
  gates: geom2Gates,
} as const satisfies ForgeHorizontePack;
