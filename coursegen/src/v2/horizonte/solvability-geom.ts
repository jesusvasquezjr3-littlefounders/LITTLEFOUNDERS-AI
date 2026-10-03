import {
  asRecord, budgetIssue, checkRubricCoverage, checkUniqueIds, isWhole, issue, registerSolvabilityChecker, result,
  type SolvabilityChecker, type SolvabilityIssue,
} from '../solvability.js';
import { PROOF_FORMULAS, PROOF_PAYLOAD_KEYS, proofPayloadFault, proofValueText, type ProofVisual } from './balance.js';
import {
  GEOM2_MAX_CELLS, GEOM2_SHAPES, area2, cellsInside, corners, coverSearch, distinct, imageOf, inPlane, isPoint, isPoints, isShape, moveProblem,
  movesProblem, pointKey, sameSet, simple, tileProblem, type LatticePoint,
} from './geom2.js';

/*
 * F0.4 solvability checkers for the geom2 and balance packs' public-payload types. Each one reads the PUBLIC payload alone for everything the
 * payload determines, so release-time verification with no key still proves it; the key is compared only when context.answerKey is present.
 * The pure lattice, move, cover and proof functions are the packs' own (imported, never copied), so a checker and its pack gate cannot drift.
 */

const GEOBOARD = 'math.geoboard.v2';
const AREA = 'math.area-squares.v2';
const TRANSFORM = 'math.transform.v2';
const TESSELLATION = 'math.tessellation.v2';
const PROOF = 'math.visual-proof.v2';

const MIN_SIZE = 3;
const MAX_SIZE = 8;
const MAX_GRID = 8;
const MAX_OUTLINE = 16;
const MIN_EXTENT = 3;
const MAX_EXTENT = 10;
const MAX_COPIES = 24;
const FLOOR_SPAN = 12;
const LISTED = 6;

const exactKeys = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean =>
  required.every((name) => Object.hasOwn(value, name)) && Object.keys(value).every((name) => required.includes(name) || optional.includes(name));
const at = (point: LatticePoint): string => `(${point.x}, ${point.y})`;
const listed = (items: readonly (string | number)[]): string =>
  `${items.slice(0, LISTED).join(', ')}${items.length > LISTED ? `, and ${items.length - LISTED} more` : ''}`;
const sorted = (set: ReadonlySet<number>): number[] => [...set].sort((a, b) => a - b);
const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/* ---------- shared: a graded point set (area-squares and transform) ---------- */

/**
 * The rubric of a point-set type is { required }, compared as an unordered set. Coverage runs per point: a missing point means the one
 * correct answer would be graded wrong (rubric-gap), an extra point means a wrong answer would be graded right (rubric-accepts-invalid).
 */
function pointSetKeyIssues(
  subject: string, what: string, answerKey: unknown, expected: readonly LatticePoint[], size: { min: number; max: number }, where: { within: (point: LatticePoint) => boolean; label: string },
): SolvabilityIssue[] {
  const rubric = asRecord(answerKey);
  if (!rubric || !exactKeys(rubric, ['required'])) return [issue('impossible-state', `${subject}: the rubric must be { required }, the ${what}`)];
  const required = rubric.required;
  if (Array.isArray(required) && required.length === 0) return [issue('vacuous-rubric', `${subject}: the rubric lists no ${what}, so it would accept an empty answer or none`)];
  if (!Array.isArray(required) || required.length > size.max || !isPoints(required, size.min, size.max)) {
    return [issue('impossible-state', `${subject}: the rubric must list ${size.min} to ${size.max} whole { x, y } points as the ${what}`)];
  }
  const issues: SolvabilityIssue[] = [...checkUniqueIds(required.map(pointKey), `${subject} rubric point`)];
  const outside = required.filter((point) => !where.within(point));
  if (outside.length > 0) issues.push(issue('out-of-bounds', `${subject}: the rubric names ${listed(outside.map(at))}, outside ${where.label}`));
  const expectedKeys = new Set(expected.map(pointKey));
  issues.push(...checkRubricCoverage(expected.map(pointKey), new Set(required.map(pointKey)), { subject, isSolution: (candidate) => expectedKeys.has(candidate) }));
  return issues;
}

/* ---------- math.geoboard.v2 ---------- */

type Family = 'triangle' | 'right-triangle' | 'rectangle' | 'square' | 'parallelogram';
const FAMILIES: readonly Family[] = ['triangle', 'right-triangle', 'rectangle', 'square', 'parallelogram'];
/** The named figure that is a special case of another: a key naming the wide family on a board that only holds the special case is the narrow key. */
const STRICTER: Readonly<Partial<Record<Family, Family>>> = { triangle: 'right-triangle', rectangle: 'square', parallelogram: 'rectangle' };

interface Reach {
  /** Areas (half squares) of some simple band, whatever its shape. */
  any: ReadonlySet<number>;
  /** Areas of a band that is each named figure. */
  figure: Readonly<Record<Family, ReadonlySet<number>>>;
  /** Areas of a band that is the family but NOT its stricter one (a scalene triangle, a rectangle that is not a square, a slanted parallelogram). */
  wide: Readonly<Record<Family, ReadonlySet<number>>>;
}

const reachCost = (size: number): number => (2 * (size - 1) + 1) ** 4 + 2 * (size - 1) ** 2;

/**
 * A simple band of exactly `area` half squares on a board `size` pegs a side, for any 1 <= area <= 2(size-1)^2: a column strip w wide whose
 * top is the line y = top, with the two outer columns shortened to heights left and right so left + right is the leftover area. It is built,
 * not searched, and the caller proves it with the pack's own `simple` and `area2`.
 */
function anyBand(size: number, area: number): LatticePoint[] | null {
  const top = size - 1;
  const width = Math.ceil(area / (2 * top));
  if (width < 1 || width > top) return null;
  const rest = area - 2 * (width - 1) * top;
  const left = Math.min(top, rest);
  const right = rest - left;
  const band: LatticePoint[] = [{ x: 0, y: 0 }, { x: width, y: 0 }];
  if (right > 0) band.push({ x: width, y: right });
  for (let x = width - 1; x >= 1; x -= 1) band.push({ x, y: top });
  band.push({ x: 0, y: left });
  return band;
}

const spanOf = (values: readonly number[]): number => Math.max(...values) - Math.min(...values);
const reachBySize = new Map<number, Reach>();

/**
 * Every figure and area a board holds, keyless. A triangle is the origin and two vectors; a parallelogram is those two vectors and their sum;
 * both are translated to the board's corner, so the vector pairs whose box fits are exactly the figures that fit. The shape of each is judged
 * by the pack's own `isShape`, and any-shape areas by a constructive band proven with `simple` and `area2`.
 */
function reachOf(size: number): Reach {
  const cached = reachBySize.get(size);
  if (cached) return cached;
  const top = size - 1;
  const figure = Object.fromEntries(FAMILIES.map((family) => [family, new Set<number>()])) as Record<Family, Set<number>>;
  const wide = Object.fromEntries(FAMILIES.map((family) => [family, new Set<number>()])) as Record<Family, Set<number>>;
  for (let ux = -top; ux <= top; ux += 1) {
    for (let uy = -top; uy <= top; uy += 1) {
      for (let vx = -top; vx <= top; vx += 1) {
        for (let vy = -top; vy <= top; vy += 1) {
          if (ux * vy - uy * vx === 0) continue;
          if (spanOf([0, ux, vx]) <= top && spanOf([0, uy, vy]) <= top) {
            const band = [{ x: 0, y: 0 }, { x: ux, y: uy }, { x: vx, y: vy }];
            const a = area2(band);
            figure.triangle.add(a);
            if (isShape(band, 'right-triangle')) figure['right-triangle'].add(a);
            else wide.triangle.add(a);
          }
          if (spanOf([0, ux, ux + vx, vx]) <= top && spanOf([0, uy, uy + vy, vy]) <= top) {
            const band = [{ x: 0, y: 0 }, { x: ux, y: uy }, { x: ux + vx, y: uy + vy }, { x: vx, y: vy }];
            const a = area2(band);
            figure.parallelogram.add(a);
            if (!isShape(band, 'rectangle')) wide.parallelogram.add(a);
            else {
              figure.rectangle.add(a);
              if (isShape(band, 'square')) figure.square.add(a);
              else wide.rectangle.add(a);
            }
          }
        }
      }
    }
  }
  const any = new Set<number>();
  for (let a = 1; a <= 2 * top * top; a += 1) {
    const band = anyBand(size, a);
    if (band !== null && simple(band) && area2(band) === a) any.add(a);
  }
  const reach: Reach = { any, figure, wide };
  reachBySize.set(size, reach);
  return reach;
}

function geoboardKeyIssues(subject: string, size: number, reach: Reach, answerKey: unknown): SolvabilityIssue[] {
  const maxArea = 2 * (size - 1) ** 2;
  const rubric = asRecord(answerKey);
  if (!rubric || !exactKeys(rubric, ['area2'], ['shape'])) return [issue('impossible-state', `${subject}: the rubric must be { area2, shape? }, the band's area in half squares and optionally its figure`)];
  if (!whole(rubric.area2) || rubric.area2 < 1) return [issue('impossible-state', `${subject}: area2 must be a whole number of half squares from 1`)];
  if (rubric.area2 > maxArea) return [issue('out-of-bounds', `${subject}: area2 ${rubric.area2} is larger than the biggest band a ${size}-peg board holds (${maxArea} half squares)`)];
  const area = rubric.area2;
  if (rubric.shape === undefined) {
    return reach.any.has(area) ? [] : [issue('no-solution', `${subject}: no simple band on a ${size}-peg board has ${area} half squares, so the learner cannot succeed`)];
  }
  const shape = rubric.shape;
  if (typeof shape !== 'string' || !(GEOM2_SHAPES as readonly string[]).includes(shape)) {
    return [issue('impossible-state', `${subject}: shape must be one of ${GEOM2_SHAPES.join(', ')}`)];
  }
  const family = shape as Family;
  if (!reach.figure[family].has(area)) {
    return [issue('no-solution', `${subject}: no ${family} of ${area} half squares fits a ${size}-peg board (the areas it reaches as a ${family} are ${listed(sorted(reach.figure[family]))}), so the learner cannot succeed`)];
  }
  const stricter = STRICTER[family];
  if (stricter !== undefined && !reach.wide[family].has(area)) {
    // Not unsolvable, but the wide name and the narrow one grade the very same bands here: the prompt and the key may disagree about the figure.
    return [issue('ambiguous-solution', `${subject}: the only ${family} of ${area} half squares this ${size}-peg board holds is a ${stricter}, so naming a ${family} grades exactly what naming a ${stricter} would`, { severity: 'review' })];
  }
  return [];
}

// Uniqueness does not apply: the key grades an area (and a named figure), never one fixed band, so many bands are accepted by design. What is
// proved instead is that the accepted set is non-empty on this board. Start: the learner holds no band, and the grader answers an untouched
// board 'valid', never 'met'. Dead end: a band is a free list of pegs the learner can always retap, so no move is irreversible.
const geoboardChecker: SolvabilityChecker = (segment, context) => {
  const subject = `geoboard ${segment.id}`;
  const payload = segment.payload;
  if (!exactKeys(payload, ['size'])) return result([issue('impossible-state', `${subject}: the payload is only { size }, the pegs a side; the band, its area and its figure belong to the private key`)]);
  const size = payload.size;
  if (!whole(size)) return result([issue('impossible-state', `${subject}: size must be a whole number of pegs a side`)]);
  if (size < MIN_SIZE || size > MAX_SIZE) return result([issue('out-of-bounds', `${subject}: a board of ${size} pegs a side is outside the ${MIN_SIZE} to ${MAX_SIZE} pegs the geoboard draws`)]);
  const cost = reachCost(size);
  if (cost > context.nodeBudget) return result([budgetIssue(subject, context.nodeBudget, 'which figures and areas the board reaches')]);
  const reach = reachOf(size);
  const stats = { nodes: cost, areas: reach.any.size, triangles: reach.figure.triangle.size, parallelograms: reach.figure.parallelogram.size };
  const issues: SolvabilityIssue[] = [];
  const maxArea = 2 * (size - 1) ** 2;
  if (reach.any.size !== maxArea) issues.push(issue('no-solution', `${subject}: only ${reach.any.size} of the ${maxArea} areas from 1 to the full board are reachable by a simple band`));
  if (context.answerKey !== undefined) issues.push(...geoboardKeyIssues(subject, size, reach, context.answerKey));
  return result(issues, stats);
};

/* ---------- math.area-squares.v2 ---------- */

// Uniqueness: the squares inside an outline are one set (the even-odd rule at each square's centre), and the shoelace area cross-checks the
// count, so the answer is a single number of squares. Start: nothing is shaded, and an outline that encloses no square is refused as no-solution.
// Dead end: shading toggles a square on and off, so no move is irreversible.
const areaChecker: SolvabilityChecker = (segment, context) => {
  const subject = `area squares ${segment.id}`;
  const payload = segment.payload;
  if (!exactKeys(payload, ['columns', 'rows', 'outline'])) return result([issue('impossible-state', `${subject}: the payload is { columns, rows, outline } and nothing else, never the squares`)]);
  const { columns, rows, outline } = payload;
  if (!whole(columns) || !whole(rows)) return result([issue('impossible-state', `${subject}: columns and rows must be whole numbers of squares`)]);
  if (columns < 2 || columns > MAX_GRID || rows < 2 || rows > MAX_GRID) return result([issue('out-of-bounds', `${subject}: the grid is ${columns} by ${rows} squares; it must be 2 to ${MAX_GRID} wide and tall`)]);
  if (!Array.isArray(outline) || outline.length < 4 || outline.length > MAX_OUTLINE) return result([issue('impossible-state', `${subject}: the outline is 4 to ${MAX_OUTLINE} corners`)]);
  const bad = outline.findIndex((corner) => !isPoint(corner));
  if (bad >= 0) return result([issue('impossible-state', `${subject}: corner ${bad + 1} of the outline is not a whole { x, y } grid point`)]);
  const band = outline as LatticePoint[];
  const outside = band.filter((corner) => corner.x < 0 || corner.x > columns || corner.y < 0 || corner.y > rows);
  if (outside.length > 0) return result([issue('out-of-bounds', `${subject}: the outline corner ${at(outside[0]!)} is off the ${columns} by ${rows} grid`)]);
  if (!distinct(band)) return result([issue('impossible-state', `${subject}: the outline names a corner twice`)]);
  const diagonal = band.findIndex((corner, index) => {
    const next = band[(index + 1) % band.length]!;
    return (corner.x === next.x) === (corner.y === next.y);
  });
  if (diagonal >= 0) return result([issue('impossible-state', `${subject}: the outline edge from ${at(band[diagonal]!)} does not run along a grid line, so the squares inside it are not whole`)]);
  if (corners(band).length !== band.length) return result([issue('impossible-state', `${subject}: a listed outline point is not a corner (it sits straight between its neighbours)`)]);
  if (!simple(band)) return result([issue('impossible-state', `${subject}: the outline crosses or touches itself, so which squares are inside is not one set`)]);
  const cells = cellsInside(band, columns, rows);
  if (cells.length === 0) return result([issue('no-solution', `${subject}: the outline encloses no whole square, so there is nothing to shade`)]);
  if (cells.length > GEOM2_MAX_CELLS) return result([issue('too-large', `${subject}: the outline encloses ${cells.length} squares; the tool takes at most ${GEOM2_MAX_CELLS}`)]);
  const stats = { cells: cells.length, nodes: columns * rows * band.length };
  const issues: SolvabilityIssue[] = [];
  if (area2(band) !== 2 * cells.length) {
    issues.push(issue('ambiguous-solution', `${subject}: the squares counted inside the outline (${cells.length}) disagree with its area (${area2(band) / 2}), so the count is not a single number`));
  }
  if (context.answerKey !== undefined) {
    issues.push(...pointSetKeyIssues(subject, 'squares inside the outline, each by its lower-left corner', context.answerKey, cells, { min: 1, max: GEOM2_MAX_CELLS }, {
      within: (point) => point.x >= 0 && point.x < columns && point.y >= 0 && point.y < rows, label: `the ${columns} by ${rows} grid`,
    }));
  }
  return result(issues, stats);
};

/* ---------- math.transform.v2 ---------- */

// Uniqueness: the image is a function of the public move, so the answer is one point set, and the grader compares an unordered set (corner
// order never makes a second answer). The injectivity of every move is still checked. Start: the learner sees the figure, and an image equal to
// the figure is refused as already solved. Dead end: a dragged point can always be dragged again. Not provable here: the symmetry-mirror rule
// (whole figure on one side of a vertical or horizontal line) needs the segment's visual, which a checker never sees; the pack gate holds it.
const transformChecker: SolvabilityChecker = (segment, context) => {
  const subject = `transform ${segment.id}`;
  const payload = segment.payload;
  if (!exactKeys(payload, ['extent', 'figure', 'move'])) return result([issue('impossible-state', `${subject}: the payload is { extent, figure, move } and nothing else, never the image`)]);
  const { extent, figure, move } = payload;
  if (!whole(extent)) return result([issue('impossible-state', `${subject}: extent must be a whole number of pegs from the origin`)]);
  if (extent < MIN_EXTENT || extent > MAX_EXTENT) return result([issue('out-of-bounds', `${subject}: the plane reaches ${extent} pegs from the origin; it must be ${MIN_EXTENT} to ${MAX_EXTENT}`)]);
  if (!Array.isArray(figure) || figure.length < 3 || figure.length > 6) return result([issue('impossible-state', `${subject}: the figure is a polygon of 3 to 6 corners`)]);
  const bad = figure.findIndex((corner) => !isPoint(corner));
  if (bad >= 0) return result([issue('impossible-state', `${subject}: figure corner ${bad + 1} is not a whole { x, y } peg`)]);
  const shape = figure as LatticePoint[];
  const outside = shape.filter((corner) => !inPlane([corner], extent));
  if (outside.length > 0) return result([issue('out-of-bounds', `${subject}: the figure corner ${at(outside[0]!)} is outside the plane (${extent} pegs each way from the origin)`)]);
  if (!distinct(shape)) return result([issue('impossible-state', `${subject}: the figure names a corner twice`)]);
  if (!simple(shape)) return result([issue('impossible-state', `${subject}: the figure crosses or touches itself or is flat, so it is not a polygon to move`)]);
  const moveFault = moveProblem(move);
  if (moveFault !== null) return result([issue('impossible-state', `${subject}: ${moveFault}`)]);
  const image = imageOf(move as Record<string, unknown>, shape);
  if (image === null) return result([issue('no-solution', `${subject}: a corner of the image falls between pegs, and a learner can only drop a point on a peg`)]);
  const off = image.filter((corner) => !inPlane([corner], extent));
  if (off.length > 0) return result([issue('out-of-bounds', `${subject}: the image corner ${at(off[0]!)} falls outside the plane, so the learner cannot place it`)]);
  const issues: SolvabilityIssue[] = [];
  if (!distinct(image)) issues.push(issue('ambiguous-solution', `${subject}: two corners of the figure land on the same peg, so the image is not a point set the learner can tell from another`));
  if (sameSet(image, shape)) issues.push(issue('impossible-state', `${subject}: the move leaves the figure where it is, so the figure already is the answer`));
  else if (!simple(image)) issues.push(issue('impossible-state', `${subject}: the image is not a polygon, so the move does not keep the figure's shape`));
  if (context.answerKey !== undefined) {
    issues.push(...pointSetKeyIssues(subject, 'image corners of the figure under the move', context.answerKey, image, { min: 3, max: 6 }, {
      within: (point) => inPlane([point], extent), label: `the plane (${extent} pegs each way)`,
    }));
  }
  return result(issues, { corners: image.length, nodes: shape.length * 2 });
};

/* ---------- math.tessellation.v2 ---------- */

// Uniqueness: the cover itself is not unique by design (the learner may use any listed move on any copy), but the NUMBER of copies is, because
// every exact cover of the floor uses floor cells / tile cells copies; an ambiguity is reported if a cover disagrees, which no well-formed
// payload can produce. Start: the learner holds no copy, so a floor of at least one copy is never already tiled (an empty floor is refused).
// Dead end: a placed copy can be lifted again, so no placement is irreversible.
const tessellationChecker: SolvabilityChecker = (segment, context) => {
  const subject = `tessellation ${segment.id}`;
  const payload = segment.payload;
  if (!exactKeys(payload, ['floor', 'tile'], ['moves'])) return result([issue('impossible-state', `${subject}: the payload is { floor, tile } and optionally { moves }, as lists of cells`)]);
  if (Object.hasOwn(payload, 'moves')) {
    const movesFault = movesProblem(payload.moves);
    if (movesFault !== null) return result([issue('impossible-state', `${subject}: ${movesFault}`)]);
  }
  const tileFault = tileProblem(payload.tile);
  if (tileFault !== null) return result([issue('impossible-state', `${subject}: ${tileFault}`)]);
  const tile = payload.tile as LatticePoint[];
  const floor = payload.floor;
  if (!Array.isArray(floor)) return result([issue('impossible-state', `${subject}: the floor is a list of cells`)]);
  if (floor.length === 0) return result([issue('impossible-state', `${subject}: the floor is empty, so it is already tiled`)]);
  if (floor.length > MAX_COPIES * tile.length) return result([issue('too-large', `${subject}: the floor has ${floor.length} cells, more than ${MAX_COPIES} copies of a ${tile.length}-cell tile`)]);
  if (!isPoints(floor, 1, MAX_COPIES * tile.length)) return result([issue('impossible-state', `${subject}: every floor cell is a whole { x, y }`)]);
  const cells = floor as LatticePoint[];
  const outside = cells.filter((cell) => cell.x < 0 || cell.y < 0 || cell.x >= FLOOR_SPAN || cell.y >= FLOOR_SPAN);
  if (outside.length > 0) return result([issue('out-of-bounds', `${subject}: the floor cell ${at(outside[0]!)} is outside the ${FLOOR_SPAN} by ${FLOOR_SPAN} grid`)]);
  if (!distinct(cells)) return result([issue('overlap', `${subject}: the floor lists a cell twice, so a cell would need two copies`)]);
  if (cells.length % tile.length !== 0) {
    return result([issue('no-solution', `${subject}: ${cells.length} floor cells cannot be whole copies of a ${tile.length}-cell tile, so no cover exists`)]);
  }
  const motions = Array.isArray(payload.moves) ? (payload.moves as string[]) : ['slide'];
  const search = coverSearch(cells, tile, motions, context.nodeBudget);
  const stats = { nodes: search.steps, copies: search.copies };
  if (!search.covered) {
    return result([search.exhausted
      ? budgetIssue(subject, search.steps, 'that the tile covers the floor')
      : issue('no-solution', `${subject}: the tile cannot cover the floor ${motions.length > 1 ? `by the moves listed (${motions.join(', ')})` : 'by sliding alone'}, so the learner cannot succeed`)], stats);
  }
  const issues: SolvabilityIssue[] = [];
  if (search.copies * tile.length !== cells.length) {
    issues.push(issue('ambiguous-solution', `${subject}: an exact cover takes ${search.copies} copies but the floor holds ${cells.length / tile.length}, so two tilings differ in tile count`));
  }
  if (context.answerKey !== undefined) {
    const rubric = asRecord(context.answerKey);
    if (!rubric || !exactKeys(rubric, ['copies']) || !isWhole(rubric.copies) || rubric.copies < 1) {
      issues.push(issue('impossible-state', `${subject}: the rubric must be { copies }, the number of whole copies an exact cover takes`));
    } else {
      issues.push(...checkRubricCoverage([String(search.copies)], new Set([String(rubric.copies)]), { subject, isSolution: (candidate) => candidate === String(search.copies) }));
    }
  }
  return result(issues, stats);
};

/* ---------- math.visual-proof.v2 ---------- */

/** The figure the payload is, from its keys alone (a checker never sees the segment's visual); each of the seven has its own key set. */
function proofFigureOf(payload: Record<string, unknown>): ProofVisual | undefined {
  const names = Object.keys(payload).sort().join();
  return (Object.keys(PROOF_PAYLOAD_KEYS) as ProofVisual[]).find((visual) => PROOF_PAYLOAD_KEYS[visual] === names);
}

/**
 * What each offered formula gives on this figure, in 400ths so pi = 3.14 and a half of a half stay whole numbers; null for an id the figure's
 * pool does not hold. The circumference figure reads its radius as half the diameter and the circle reads its diameter as twice the radius.
 */
function formulaValue(visual: ProofVisual, choice: string, p: Record<string, number>): number | null {
  switch (visual) {
    case 'parallelogram-area':
    case 'triangle-area': {
      const product = p.base! * p.height!;
      return choice === 'base-height' ? 400 * product : choice === 'half-base-height' ? 200 * product : choice === 'base-plus-height' ? 400 * (p.base! + p.height!) : null;
    }
    case 'trapezoid-area': {
      const sum = (p.top! + p.bottom!) * p.height!;
      return choice === 'half-sum-bases-height' ? 200 * sum : choice === 'sum-bases-height' ? 400 * sum : choice === 'half-base-height' ? 200 * p.bottom! * p.height! : null;
    }
    case 'circle-area': {
      const r = p.radius!;
      return choice === 'pi-r-squared' ? 1256 * r * r : choice === 'pi-diameter' ? 2512 * r : choice === 'pi-radius' ? 1256 * r : choice === 'radius-squared' ? 400 * r * r : null;
    }
    case 'circumference-unroll': {
      const d = p.diameter!;
      return choice === 'pi-diameter' ? 1256 * d : choice === 'pi-r-squared' ? 314 * d * d : choice === 'pi-radius' ? 628 * d : choice === 'radius-squared' ? 100 * d * d : null;
    }
    case 'pythagoras-proof': {
      const { a, b } = { a: p.a!, b: p.b! };
      return choice === 'legs-squares-sum' ? 400 * (a * a + b * b) : choice === 'legs-sum-squared' ? 400 * (a + b) ** 2 : choice === 'legs-sum' ? 400 * (a + b) : choice === 'legs-product' ? 400 * a * b : null;
    }
    case 'odd-sum-proof': {
      const n = p.n!;
      return choice === 'n-times-n' ? 400 * n * n : choice === 'n-plus-n' || choice === 'n-times-two' ? 800 * n : null;
    }
  }
}

/** The key's value text as hundredths, or null when it is not plain decimal text with at most two decimals. */
function hundredthsOf(text: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(text);
  return match ? Number(match[1]) * 100 + Number(`${match[2] ?? ''}00`.slice(0, 2)) : null;
}

// Uniqueness: one formula id is graded, so the answer is unique unless a distractor gives the same number as the right formula on this figure
// (then a learner who picks it and types the right number is graded wrong for a numerically correct prediction); that is ambiguous-solution.
// Start: the payload holds only the figure's measures and unmarked choices (its key set is exact), so the answer is never on screen, and the
// learner starts with no choice and no value, which the grader answers 'valid', never 'met'. Dead end: a choice and a number can be changed freely.
const proofChecker: SolvabilityChecker = (segment, context) => {
  const subject = `visual proof ${segment.id}`;
  const payload = segment.payload;
  const visual = proofFigureOf(payload);
  if (visual === undefined) return result([issue('impossible-state', `${subject}: the payload fields (${Object.keys(payload).sort().join(', ') || 'none'}) match none of the seven proof figures`)]);
  const formulas = PROOF_FORMULAS[visual];
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length < 3 || choices.length > 5) return result([issue('impossible-state', `${subject}: a ${visual} offers 3 to 5 formula choices`)]);
  if (!choices.every((choice) => typeof choice === 'string')) return result([issue('impossible-state', `${subject}: every formula choice is a formula id`)]);
  const offered = choices as string[];
  const issues: SolvabilityIssue[] = [...checkUniqueIds(offered, `${subject} formula choice`)];
  const foreign = offered.filter((choice) => !formulas.pool.includes(choice));
  if (foreign.length > 0) issues.push(issue('impossible-state', `${subject}: ${listed(foreign)} is not a formula of a ${visual} (its pool is ${formulas.pool.join(', ')})`));
  if (!offered.includes(formulas.correct)) issues.push(issue('no-solution', `${subject}: the right formula for a ${visual} (${formulas.correct}) is not among the choices, so the learner cannot succeed`));
  if (issues.length > 0) return result(issues);
  const fault = proofPayloadFault(visual, payload);
  if (fault !== null) {
    const numbers = Object.entries(payload).every(([name, value]) => name === 'choices' || name === 'sectors' || (typeof value === 'number' && Number.isFinite(value)));
    return result([issue(numbers ? 'out-of-bounds' : 'impossible-state', `${subject}: ${fault}`)]);
  }
  const measures = payload as Record<string, number>;
  const right = formulaValue(visual, formulas.correct, measures);
  for (const choice of offered) {
    if (choice !== formulas.correct && right !== null && formulaValue(visual, choice, measures) === right) {
      issues.push(issue('ambiguous-solution', `${subject}: the distractor ${choice} gives the same number as ${formulas.correct} on this figure, so a learner who picks it and types the right value is graded wrong`));
    }
  }
  const expected = proofValueText(visual, measures);
  if (context.answerKey !== undefined) {
    const rubric = asRecord(context.answerKey);
    if (!rubric || !exactKeys(rubric, ['choice', 'value']) || typeof rubric.choice !== 'string' || typeof rubric.value !== 'string') {
      issues.push(issue('impossible-state', `${subject}: the rubric must be { choice, value }, the formula id and the value as plain decimal text`));
    } else {
      const keyed = hundredthsOf(rubric.value);
      if (keyed === null) issues.push(issue('impossible-state', `${subject}: the rubric value "${rubric.value.slice(0, 24)}" is not plain decimal text with at most two decimals`));
      else {
        const solution = `${formulas.correct}|${hundredthsOf(expected)}`;
        issues.push(...checkRubricCoverage([solution], new Set([`${rubric.choice}|${keyed}`]), { subject, isSolution: (candidate) => candidate === solution }));
      }
    }
  }
  return result(issues, { choices: offered.length, nodes: offered.length });
};

registerSolvabilityChecker(GEOBOARD, geoboardChecker);
registerSolvabilityChecker(AREA, areaChecker);
registerSolvabilityChecker(TRANSFORM, transformChecker);
registerSolvabilityChecker(TESSELLATION, tessellationChecker);
registerSolvabilityChecker(PROOF, proofChecker);
