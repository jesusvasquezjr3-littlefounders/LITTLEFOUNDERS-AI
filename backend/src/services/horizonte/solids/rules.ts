import { countOf, isCountKind, isSolidId, solidsWithCount, SOLID_IDS, type CountKind, type SolidId } from './model.js';
import {
  cellsOf, completions, inGrid, isCubeNet, isFaceName, isNetGrid, labelSolutions, netBounds, NET_GRID_LIMITS, NET_SQUARES,
  type FaceName, type NetCell, type NetGrid,
} from './net.js';
import { isHeights, isStackGoal, isStackSize, matchesGoal, solveStack, stackTotal, type Heights, type StackGoal } from './stack.js';

export const VIEWER_MIN_SOLIDS = 2;
export const VIEWER_COUNT_LIMIT = 12;
export const NET_EDGE_LIMIT = 20;
export const LABEL_FIXED_LIMITS = { min: 1, max: 3 } as const;
export const COMPLETE_FIXED_LIMITS = { min: 2, max: 5 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

export interface ViewerPayload { solids: SolidId[]; find: { kind: CountKind; count: number }; report: CountKind }

export function readViewerPayload(value: unknown): ViewerPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['solids', 'find', 'report'])) return null;
  const { solids, find, report } = value;
  if (!Array.isArray(solids) || solids.length < VIEWER_MIN_SOLIDS || solids.length > SOLID_IDS.length || !solids.every(isSolidId) || new Set(solids).size !== solids.length) return null;
  if (!isRecord(find) || !exactKeys(find, ['kind', 'count']) || !isCountKind(find.kind) || !whole(find.count, 0, VIEWER_COUNT_LIMIT) || !isCountKind(report)) return null;
  return { solids: [...solids] as SolidId[], find: { kind: find.kind, count: find.count }, report };
}

/** The one solid that has the counted thing, or null when none or several do (the question must have exactly one answer). */
export function viewerSolid(payload: ViewerPayload): SolidId | null {
  const matches = solidsWithCount(payload.find.kind, payload.find.count, payload.solids);
  return matches.length === 1 ? matches[0]! : null;
}

export function viewerProblem(payload: ViewerPayload): string | null {
  if (payload.report === payload.find.kind) return 'The question counts a different thing than the one it searches by';
  return viewerSolid(payload) === null ? 'Exactly one listed solid must match the searched count' : null;
}

export const viewerAnswer = (payload: ViewerPayload): { solid: SolidId; count: string } | null => {
  const solid = viewerSolid(payload);
  return solid === null ? null : { solid, count: String(countOf(solid, payload.report)) };
};

export interface LabelNet { mode: 'label'; cells: NetCell[]; fixed: { cell: number; name: FaceName }[]; edge: number }
export interface CompleteNet { mode: 'complete'; grid: NetGrid; fixed: NetCell[]; edge: number }
export type NetPayload = LabelNet | CompleteNet;

export function readNetPayload(value: unknown): NetPayload | null {
  if (!isRecord(value)) return null;
  if (value.mode === 'label') {
    if (!exactKeys(value, ['mode', 'cells', 'fixed', 'edge']) || !cellsOf(value.cells, NET_SQUARES, NET_SQUARES) || !whole(value.edge, 1, NET_EDGE_LIMIT)) return null;
    const fixed = value.fixed;
    if (!Array.isArray(fixed) || fixed.length < LABEL_FIXED_LIMITS.min || fixed.length > LABEL_FIXED_LIMITS.max) return null;
    const read: LabelNet['fixed'] = [];
    for (const entry of fixed) {
      if (!isRecord(entry) || !exactKeys(entry, ['cell', 'name']) || !whole(entry.cell, 0, NET_SQUARES - 1) || !isFaceName(entry.name)) return null;
      read.push({ cell: entry.cell, name: entry.name });
    }
    return { mode: 'label', cells: value.cells.map((cell) => [cell[0]!, cell[1]!] as NetCell), fixed: read, edge: value.edge };
  }
  if (value.mode === 'complete') {
    if (!exactKeys(value, ['mode', 'grid', 'fixed', 'edge']) || !isNetGrid(value.grid) || !whole(value.edge, 1, NET_EDGE_LIMIT)) return null;
    const grid = value.grid;
    if (!cellsOf(value.fixed, COMPLETE_FIXED_LIMITS.min, COMPLETE_FIXED_LIMITS.max)) return null;
    const fixed = value.fixed.map((cell) => [cell[0]!, cell[1]!] as NetCell);
    if (!fixed.every((cell) => inGrid(cell, grid))) return null;
    return { mode: 'complete', grid: { cols: grid.cols, rows: grid.rows }, fixed, edge: value.edge };
  }
  return null;
}

export const fixedNames = (fixed: LabelNet['fixed']): Record<number, FaceName> => Object.fromEntries(fixed.map((entry) => [entry.cell, entry.name]));

/** The authoring rules a net payload must meet: it can be solved, and its label mode has one answer. */
export function netProblem(payload: NetPayload): string | null {
  if (payload.mode === 'label') {
    if (!isCubeNet(payload.cells)) return 'The six squares must fold into a cube';
    const bounds = netBounds(payload.cells);
    if (bounds.cols > NET_GRID_LIMITS.maxCols || bounds.rows > NET_GRID_LIMITS.maxRows) return 'The net must fit on a grid of 5 by 4';
    if (new Set(payload.fixed.map((entry) => entry.cell)).size !== payload.fixed.length) return 'A square is named once';
    if (new Set(payload.fixed.map((entry) => entry.name)).size !== payload.fixed.length) return 'A face name is given once';
    return labelSolutions(payload.cells, fixedNames(payload.fixed)).length === 1 ? null : 'The given names must leave exactly one way to name the rest';
  }
  return completions(payload.fixed, payload.grid, NET_SQUARES - payload.fixed.length, 1).count > 0 ? null : 'The given squares cannot be completed into a cube net';
}

export interface StackPayload { size: 2 | 3; start: Heights; goal: StackGoal; fewest: boolean }

export function readStackPayload(value: unknown): StackPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['size', 'start', 'goal', 'fewest'])) return null;
  const { size, start, goal, fewest } = value;
  if (!isStackSize(size) || !isHeights(start, size) || !isStackGoal(goal, size) || typeof fewest !== 'boolean') return null;
  return { size, start: start.map((row) => [...row]), goal: structuredClone(goal), fewest };
}

const minimums = new Map<string, number | null>();
/** The fewest cubes any stack of the grid needs to match the goal (null when none does); exact, memoised for a bounded set of goals. */
export function stackMinimum(goal: StackGoal, size: number): number | null {
  const key = `${size}|${JSON.stringify(goal)}`;
  if (!minimums.has(key)) {
    if (minimums.size >= 64) minimums.clear();
    minimums.set(key, solveStack(goal, size, undefined, 1).minimum);
  }
  return minimums.get(key) ?? null;
}

export function stackProblem(payload: StackPayload): string | null {
  const minimum = stackMinimum(payload.goal, payload.size);
  if (minimum === null) return 'No stack of this grid matches the goal';
  if (minimum < 1) return 'The goal must need at least one cube';
  if (stackTotal(payload.start) < 1) return 'The start holds at least one cube';
  const done = matchesGoal(payload.start, payload.goal) && (!payload.fewest || stackTotal(payload.start) === minimum);
  return done ? 'The start must not already be the answer' : null;
}
