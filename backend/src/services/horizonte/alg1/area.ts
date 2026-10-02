import { isRecord, isWholeIn, exactKeys, oneOf, type ArrangePiece, type ClassState, type Solution } from './arrange.js';

/**
 * F2.3: an area model. The edges carry the factors and the cells the partial products, so a(b+c), (x+a)(x+b) and
 * completing the square are all one picture. A term is a face `degree:coefficient`, so `1:3` is 3x and `0:-2` is -2.
 * `cells` fills the products, `edges` fills the factors of given products, `square` fills the corner and the constant.
 */
export const AREA_FILLS = ['cells', 'edges', 'square'] as const;
export type AreaFill = (typeof AREA_FILLS)[number];
export const AREA_MAX_COEFFICIENT = 99;
export const AREA_MAX_SOLUTIONS = 8;
export const SQUARE_BOUNDS = { minB: 2, maxB: 18, maxC: 30 } as const;

export interface Term { d: number; k: number }
export type AreaPayload =
  | { fill: 'cells'; rows: string[]; cols: string[]; pool: string[] }
  | { fill: 'edges'; cells: string[]; pool: string[] }
  | { fill: 'square'; b: number; c: number; pool: string[] };

const FACE = /^([0-2]):(-?[1-9][0-9]?)$/;

export function readTerm(face: unknown): Term | null {
  const match = typeof face === 'string' ? FACE.exec(face) : null;
  return match ? { d: Number(match[1]), k: Number(match[2]) } : null;
}
export const faceOf = (term: Term): string => `${term.d}:${term.k}`;

function multiply(a: string, b: string): string | null {
  const left = readTerm(a); const right = readTerm(b);
  if (!left || !right || left.d + right.d > 2 || Math.abs(left.k * right.k) > AREA_MAX_COEFFICIENT) return null;
  return faceOf({ d: left.d + right.d, k: left.k * right.k });
}

function readFaces(value: unknown, minimum: number, maximum: number, maxDegree: number): string[] | null {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
  return value.every((face) => (readTerm(face)?.d ?? 9) <= maxDegree) ? [...value] as string[] : null;
}

/** The public area model, or null: a fill, its factors or products, a pool of candidate pieces, and a bounded set of answers. */
export function readArea(value: unknown): AreaPayload | null {
  if (!isRecord(value) || !oneOf(AREA_FILLS, value.fill)) return null;
  let payload: AreaPayload | null = null;
  if (value.fill === 'cells' && exactKeys(value, ['fill', 'rows', 'cols', 'pool'])) {
    const rows = readFaces(value.rows, 1, 2, 1); const cols = readFaces(value.cols, 2, 3, 1); const pool = readFaces(value.pool, 2, 10, 2);
    if (rows && cols && pool && (rows.length === 1 || cols.length === 2)) payload = { fill: 'cells', rows, cols, pool };
  } else if (value.fill === 'edges' && exactKeys(value, ['fill', 'cells', 'pool'])) {
    const cells = readFaces(value.cells, 4, 4, 2); const pool = readFaces(value.pool, 4, 10, 1);
    if (cells && pool) payload = { fill: 'edges', cells, pool };
  } else if (value.fill === 'square' && exactKeys(value, ['fill', 'b', 'c', 'pool'])) {
    const pool = readFaces(value.pool, 2, 8, 0);
    if (pool && isWholeIn(value.b, SQUARE_BOUNDS.minB, SQUARE_BOUNDS.maxB) && value.b % 2 === 0 && isWholeIn(value.c, -SQUARE_BOUNDS.maxC, SQUARE_BOUNDS.maxC) && value.c !== (value.b / 2) ** 2) payload = { fill: 'square', b: value.b, c: value.c, pool };
  }
  if (!payload) return null;
  const solutions = areaSolutions(payload);
  return solutions.length >= 1 && solutions.length <= AREA_MAX_SOLUTIONS ? payload : null;
}

export const areaGrid = (payload: AreaPayload): { rows: number; cols: number } =>
  payload.fill === 'cells' ? { rows: payload.rows.length, cols: payload.cols.length } : { rows: 2, cols: 2 };

/** The places a piece can go; `tray` is where pieces start. */
export function areaSlots(payload: AreaPayload): string[] {
  if (payload.fill === 'square') return ['tray', 'corner', 'constant'];
  if (payload.fill === 'edges') return ['tray', 'row-0', 'row-1', 'col-0', 'col-1'];
  return ['tray', ...payload.rows.flatMap((_, row) => payload.cols.map((__, col) => `cell-${row}-${col}`))];
}
export const areaTargets = (payload: AreaPayload): string[] => areaSlots(payload).filter((slot) => slot !== 'tray');

export const areaPieces = (payload: AreaPayload): ArrangePiece[] => payload.pool.map((cls, index) => ({ id: `piece-${index + 1}`, cls, home: 'tray' }));

function within(pool: readonly string[], needed: readonly string[]): boolean {
  const left = new Map<string, number>();
  for (const face of pool) left.set(face, (left.get(face) ?? 0) + 1);
  for (const face of needed) {
    const count = left.get(face) ?? 0;
    if (count < 1) return false;
    left.set(face, count - 1);
  }
  return true;
}

const key = (solution: ClassState): string => Object.keys(solution).sort().map((slot) => `${slot}=${[...solution[slot]!].sort().join(',')}`).join(';');

/** Every placement of pool pieces that is right, derived from the public problem; the author's key must be one of them. */
export function areaSolutions(payload: AreaPayload): Solution[] {
  if (payload.fill === 'square') {
    const half = payload.b / 2;
    const corner = `0:${half * half}`; const constant = readTerm(`0:${payload.c - half * half}`) ? `0:${payload.c - half * half}` : null;
    return constant && Math.abs(half * half) <= AREA_MAX_COEFFICIENT && within(payload.pool, [corner, constant]) ? [{ corner: [corner], constant: [constant] }] : [];
  }
  if (payload.fill === 'cells') {
    const needed: string[] = []; const solution: Solution = {};
    for (const [row, rowFace] of payload.rows.entries()) for (const [col, colFace] of payload.cols.entries()) {
      const product = multiply(rowFace, colFace);
      if (!product) return [];
      needed.push(product); solution[`cell-${row}-${col}`] = [product];
    }
    return within(payload.pool, needed) ? [solution] : [];
  }
  const found = new Map<string, Solution>();
  const faces = [...new Set(payload.pool)];
  for (const row0 of faces) for (const row1 of faces) for (const col0 of faces) for (const col1 of faces) {
    if (multiply(row0, col0) !== payload.cells[0] || multiply(row0, col1) !== payload.cells[1] || multiply(row1, col0) !== payload.cells[2] || multiply(row1, col1) !== payload.cells[3]) continue;
    if (!within(payload.pool, [row0, row1, col0, col1])) continue;
    const solution = { 'row-0': [row0], 'row-1': [row1], 'col-0': [col0], 'col-1': [col1] };
    found.set(key(solution), solution);
  }
  return [...found.values()].sort((a, b) => key(a).localeCompare(key(b)));
}

export const areaSolutionFits = (solution: ClassState, payload: AreaPayload): boolean => areaSolutions(payload).some((derived) => key(derived) === key(solution));

function termTex(term: Term, lead: boolean): string {
  const magnitude = Math.abs(term.k);
  const body = term.d === 0 ? String(magnitude) : `${magnitude === 1 ? '' : magnitude}${term.d === 1 ? 'x' : 'x^2'}`;
  return `${term.k < 0 ? '-' : lead ? '' : '+'}${body}`;
}
const sequence = (faces: readonly string[]): string => faces.map((face, index) => termTex(readTerm(face)!, index === 0)).join('');

/** The problem as the notation line shows it; the author's TeX has to match it. */
export function areaTex(payload: AreaPayload): string {
  if (payload.fill === 'cells') return payload.rows.length === 1 ? `${sequence(payload.rows)}(${sequence(payload.cols)})` : `(${sequence(payload.rows)})(${sequence(payload.cols)})`;
  if (payload.fill === 'square') return sequence(['2:1', `1:${payload.b}`, ...(payload.c === 0 ? [] : [`0:${payload.c}`])]);
  const sums = [2, 1, 0].map((degree) => ({ d: degree, k: payload.cells.reduce((total, face) => total + (readTerm(face)!.d === degree ? readTerm(face)!.k : 0), 0) }));
  return sequence(sums.filter((term) => term.k !== 0).map(faceOf));
}
