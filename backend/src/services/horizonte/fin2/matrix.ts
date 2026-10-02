import { exactKeys, idList, isId, isRecord, isWhole, placedPieces, sameKeys, type Frame, type SlotMap } from './slots.js';

export const GRID_VISUALS = ['swot', 'eisenhower', 'two-by-two', 'decision-matrix', 'business-canvas'] as const;
export type GridVisual = (typeof GRID_VISUALS)[number];

/** The fixed regions of each grid; a decision matrix ranks into `rank-1..rank-n` instead. */
export const GRID_SLOTS = {
  swot: ['strengths', 'weaknesses', 'opportunities', 'threats'],
  eisenhower: ['do-now', 'schedule', 'delegate', 'drop'],
  'two-by-two': ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  'business-canvas': ['partners', 'activities', 'resources', 'value', 'relationships', 'channels', 'segments', 'costs', 'revenue'],
} as const satisfies Record<string, readonly string[]>;

export const TWO_BY_TWO_AXES = ['x-name', 'y-name', 'x-low', 'x-high', 'y-low', 'y-high'] as const;
export const GRID_MAX_PIECES = 16;
const PIECE_RANGE: Record<GridVisual, readonly [number, number]> = {
  swot: [4, GRID_MAX_PIECES], eisenhower: [4, GRID_MAX_PIECES], 'two-by-two': [4, 12], 'decision-matrix': [2, 5], 'business-canvas': [5, GRID_MAX_PIECES],
};

export interface GridCriterion { id: string; weight: number }
export interface GridPayload { pieces: string[]; points?: Array<[number, number]>; criteria?: GridCriterion[]; scores?: number[][] }

export const isGridVisual = (value: unknown): value is GridVisual => typeof value === 'string' && (GRID_VISUALS as readonly string[]).includes(value);
export const rankSlot = (rank: number): string => `rank-${rank}`;
const midline = (value: number) => value === 5;

/** A coordinate is 1 to 9 and never on the midline, so a quadrant is never a judgement call. */
export function gridProblem(visual: unknown, payload: unknown): string | null {
  if (!isGridVisual(visual)) return 'Unknown grid visual';
  if (!isRecord(payload) || !idList(payload.pieces, ...PIECE_RANGE[visual])) return `A ${visual} grid has ${PIECE_RANGE[visual][0]} to ${PIECE_RANGE[visual][1]} unique pieces`;
  const count = payload.pieces.length;
  const extra = ['points', 'criteria', 'scores'].filter((key) => payload[key] !== undefined);
  if (visual === 'two-by-two') {
    if (!exactKeys(payload, ['pieces', 'points'])) return 'A two-by-two grid carries pieces and one point per piece';
    const points = payload.points;
    if (!Array.isArray(points) || points.length !== count) return 'A two-by-two grid carries one point per piece';
    if (!points.every((point) => Array.isArray(point) && point.length === 2 && point.every((value) => isWhole(value, 1, 9) && !midline(value)))) return 'Each point is two whole numbers from 1 to 9, never 5';
    return null;
  }
  if (visual === 'decision-matrix') {
    if (!exactKeys(payload, ['pieces', 'criteria', 'scores'])) return 'A decision matrix carries pieces, criteria and scores';
    const { criteria, scores } = payload;
    if (!Array.isArray(criteria) || criteria.length < 2 || criteria.length > 4) return 'A decision matrix has 2 to 4 criteria';
    if (!criteria.every((criterion) => exactKeys(criterion, ['id', 'weight']) && isId(criterion.id) && isWhole(criterion.weight, 1, 5))) return 'Each criterion has an id and a weight from 1 to 5';
    const ids = [...(payload.pieces as string[]), ...criteria.map((criterion) => (criterion as GridCriterion).id)];
    if (new Set(ids).size !== ids.length) return 'Piece and criterion ids are all different';
    if (!Array.isArray(scores) || scores.length !== count || !scores.every((row) => Array.isArray(row) && row.length === criteria.length && row.every((cell) => isWhole(cell, 1, 5)))) return 'Scores are a whole number from 1 to 5 for every option and criterion';
    const totals = weightedTotals(payload as unknown as GridPayload);
    return new Set(totals).size === totals.length ? null : 'Weighted totals must all differ so the ranking is not a tie';
  }
  if (!exactKeys(payload, ['pieces']) || extra.length > 0) return `A ${visual} grid carries only its pieces`;
  return null;
}

export const gridOf = (visual: unknown, payload: unknown): GridPayload | null => (gridProblem(visual, payload) === null ? (payload as GridPayload) : null);

export function weightedTotals(grid: GridPayload): number[] {
  return (grid.scores ?? []).map((row) => row.reduce((sum, score, index) => sum + score * (grid.criteria?.[index]?.weight ?? 0), 0));
}

export function gridSlotIds(visual: GridVisual, grid: GridPayload): string[] {
  return visual === 'decision-matrix' ? grid.pieces.map((_, index) => rankSlot(index + 1)) : [...GRID_SLOTS[visual]];
}

export function gridFrame(visual: unknown, payload: unknown): Frame | null {
  const grid = gridOf(visual, payload);
  if (!grid || !isGridVisual(visual)) return null;
  const slotIds = gridSlotIds(visual, grid);
  return { pieceIds: [...grid.pieces], slotIds, capacities: Object.fromEntries(slotIds.map((slot) => [slot, visual === 'decision-matrix' ? 1 : grid.pieces.length])) };
}

/** The one correct arrangement of a computed grid (two-by-two, decision matrix); null when the key is authored. */
export function gridExpected(visual: unknown, payload: unknown): SlotMap | null {
  const grid = gridOf(visual, payload);
  if (!grid) return null;
  if (visual === 'two-by-two') {
    const slots: SlotMap = { 'top-left': [], 'top-right': [], 'bottom-left': [], 'bottom-right': [] };
    grid.pieces.forEach((piece, index) => {
      const [x, y] = grid.points![index]!;
      slots[`${y > 5 ? 'top' : 'bottom'}-${x > 5 ? 'right' : 'left'}`]!.push(piece);
    });
    return Object.fromEntries(Object.entries(slots).filter(([, pieces]) => pieces.length > 0));
  }
  if (visual === 'decision-matrix') {
    const totals = weightedTotals(grid);
    const order = grid.pieces.map((_, index) => index).sort((a, b) => totals[b]! - totals[a]!);
    return Object.fromEntries(order.map((index, place) => [rankSlot(place + 1), [grid.pieces[index]!]]));
  }
  return null;
}

/** The label ids a grid needs: every piece, plus its criteria or axis names. */
export function gridLabelIds(visual: unknown, payload: unknown): string[] | null {
  const grid = gridOf(visual, payload);
  if (!grid) return null;
  return [...grid.pieces, ...(visual === 'decision-matrix' ? grid.criteria!.map((criterion) => criterion.id) : []), ...(visual === 'two-by-two' ? TWO_BY_TWO_AXES : [])];
}

export const gridLabelsProblem = (visual: unknown, payload: unknown, labels: unknown): string | null => {
  const ids = gridLabelIds(visual, payload);
  return ids && isRecord(labels) && sameKeys(labels, ids) ? null : 'Labels name every piece, criterion and axis, and nothing else';
};

/** A key solution places every piece once; a computed grid also needs it to equal the computed arrangement. */
export function gridKeyProblem(visual: unknown, payload: unknown, solutions: readonly SlotMap[]): string | null {
  const grid = gridOf(visual, payload);
  if (!grid) return 'The grid payload is malformed';
  const wanted = [...grid.pieces].sort();
  const expected = gridExpected(visual, payload);
  const canonical = expected ? JSON.stringify(Object.entries(expected).map(([slot, pieces]) => [slot, [...pieces].sort()]).sort()) : null;
  for (const solution of solutions) {
    const placed = placedPieces(solution).sort();
    if (placed.length !== wanted.length || placed.some((id, index) => id !== wanted[index])) return 'A solution places every piece exactly once';
    const own = JSON.stringify(Object.entries(solution).filter(([, pieces]) => pieces.length > 0).map(([slot, pieces]) => [slot, [...pieces].sort()]).sort());
    if (canonical !== null && own !== canonical) return 'A computed grid has one solution: the key must equal it';
  }
  return null;
}
