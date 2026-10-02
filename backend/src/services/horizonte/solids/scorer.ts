import { gradeArrangement, gradeNumberTolerance, sampleArrangement, type ArrangementContext } from '../../v2AnswerShapes.js';
import type { V2Grade } from '../../v2VisualScorer.js';
import type { HorizonteScorer } from '../types.js';
import type { SolidId } from './model.js';
import {
  completions, FACE_NAMES, gridSlotId, isCubeNet, labelSolutions, netSlotId, NET_PIECE, NET_SQUARES, slotsToCells, slotsToLabelling,
  type NetCell,
} from './net.js';
import {
  fixedNames, readNetPayload, readStackPayload, readViewerPayload, stackMinimum, VIEWER_COUNT_LIMIT, viewerAnswer,
  type CompleteNet, type LabelNet, type StackPayload,
} from './rules.js';
import { matchesGoal, sameHeights, slotsToStack, stackContext, stackToSlots, stackTotal, type StackGoal } from './stack.js';

type Segment = { payload: unknown };

const INVALID: V2Grade = { verdict: 'invalid', diagnostic: 'none' };
const VALID: V2Grade = { verdict: 'valid', diagnostic: 'none' };
const MET: V2Grade = { verdict: 'met', diagnostic: 'none' };
const review = (diagnostic: 'partial' | 'miss' | 'value' | 'false_alarm' | 'structure'): V2Grade => ({ verdict: 'review', diagnostic });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

const COUNT_BOUNDS = { minimum: '0', maximum: String(VIEWER_COUNT_LIMIT) };
const countGrade = (count: string, target?: string) => gradeNumberTolerance({ value: count }, target === undefined ? undefined : { target }, COUNT_BOUNDS);

/**
 * invalid: malformed, or a solid the question does not list. valid: a blank field (not yet an answer) and every well-formed
 * response when there is no rubric. met: the solid and its count. review: one of the two right (partial) or neither (value).
 */
function viewerGrade(segment: Segment, response: unknown, rubric: unknown): V2Grade {
  const payload = readViewerPayload(segment?.payload);
  if (!payload || !isRecord(response) || !hasKeys(response, ['solid', 'count'])) return INVALID;
  const { solid, count } = response;
  if (typeof solid !== 'string' || typeof count !== 'string') return INVALID;
  if (solid !== '' && !payload.solids.includes(solid as SolidId)) return INVALID;
  if (count !== '' && countGrade(count).verdict === 'invalid') return INVALID;
  if (rubric === undefined) return VALID;
  const answer = viewerAnswer(payload);
  if (!answer || !isRecord(rubric) || !hasKeys(rubric, ['solid', 'count']) || rubric.solid !== answer.solid || rubric.count !== answer.count) return INVALID;
  if (solid === '' || count === '') return VALID;
  const solidRight = solid === answer.solid;
  const countRight = countGrade(count, answer.count).verdict === 'met';
  if (solidRight && countRight) return MET;
  return review(solidRight || countRight ? 'partial' : 'value');
}

const slotsOf = (response: unknown): Record<string, string[]> => (response as { slots: Record<string, string[]> }).slots;
const solutionsOf = (rubric: unknown): unknown[] => (rubric as { solutions: unknown[] }).solutions;

function netContext(payload: LabelNet | CompleteNet): ArrangementContext {
  if (payload.mode === 'label') return { pieceIds: [...FACE_NAMES], slotIds: Array.from({ length: NET_SQUARES }, (_, index) => netSlotId(index)) };
  const slotIds: string[] = [];
  for (let row = 0; row < payload.grid.rows; row += 1) for (let col = 0; col < payload.grid.cols; col += 1) slotIds.push(gridSlotId(col, row));
  return { pieceIds: [NET_PIECE], slotIds, repeatable: true };
}

function labelGrade(payload: LabelNet, response: unknown, rubric: unknown): V2Grade {
  const context = netContext(payload);
  if (gradeArrangement(response, undefined, context).verdict === 'invalid') return INVALID;
  const slots = slotsOf(response);
  for (const { cell, name } of payload.fixed) {
    const held = slots[netSlotId(cell)];
    if (!held || held.length !== 1 || held[0] !== name) return INVALID;
  }
  if (rubric === undefined) return VALID;
  const fixed = fixedNames(payload.fixed);
  const answers = labelSolutions(payload.cells, fixed);
  if (answers.length === 0 || sampleArrangement(rubric, context) === null) return INVALID;
  const known = new Set(answers.map((answer) => JSON.stringify(answer)));
  const sound = solutionsOf(rubric).every((solution) => {
    const labelling = slotsToLabelling(solution, NET_SQUARES);
    return labelling !== null && known.has(JSON.stringify(labelling));
  });
  if (!sound) return INVALID;
  const free = Array.from({ length: NET_SQUARES }, (_, index) => index).filter((index) => fixed[index] === undefined);
  const placed = free.filter((index) => slots[netSlotId(index)]?.length === 1);
  if (placed.length === 0) return VALID;
  const best = Math.max(...answers.map((answer) => placed.filter((index) => slots[netSlotId(index)]![0] === answer[index]).length));
  if (placed.length === free.length && best === free.length) return MET;
  if (best === placed.length) return review('miss');
  return review(best > 0 ? 'partial' : 'value');
}

const has = (cells: readonly NetCell[], cell: NetCell): boolean => cells.some((entry) => entry[0] === cell[0] && entry[1] === cell[1]);

function completeGrade(payload: CompleteNet, response: unknown, rubric: unknown): V2Grade {
  const context = netContext(payload);
  if (gradeArrangement(response, undefined, context).verdict === 'invalid') return INVALID;
  const cells = slotsToCells(slotsOf(response), payload.grid);
  if (!cells || !payload.fixed.every((cell) => has(cells, cell))) return INVALID;
  if (rubric === undefined) return VALID;
  if (sampleArrangement(rubric, context) === null) return INVALID;
  const sound = solutionsOf(rubric).every((solution) => {
    const squares = slotsToCells(solution, payload.grid);
    return squares !== null && squares.length === NET_SQUARES && payload.fixed.every((cell) => has(squares, cell)) && isCubeNet(squares);
  });
  if (!sound) return INVALID;
  if (cells.length === payload.fixed.length) return VALID;
  if (cells.length === NET_SQUARES) return isCubeNet(cells) ? MET : review('structure');
  if (cells.length > NET_SQUARES) return review('false_alarm');
  return review(completions(cells, payload.grid, NET_SQUARES - cells.length, 1).count > 0 ? 'miss' : 'value');
}

/**
 * invalid: malformed, a fixed square or name moved, a name used twice, or a square off the grid. valid: only the given
 * squares placed. met: a complete naming (label) or six squares that fold into a cube (complete), checked on the geometry.
 */
function netGrade(segment: Segment, response: unknown, rubric: unknown): V2Grade {
  const payload = readNetPayload(segment?.payload);
  if (!payload) return INVALID;
  return payload.mode === 'label' ? labelGrade(payload, response, rubric) : completeGrade(payload, response, rubric);
}

function stackKeyIsSound(rubric: unknown, payload: StackPayload, minimum: number): boolean {
  if (sampleArrangement(rubric, stackContext(payload.size)) === null) return false;
  return solutionsOf(rubric).every((solution) => {
    const heights = slotsToStack(solution, payload.size);
    return heights !== null && matchesGoal(heights, payload.goal) && (!payload.fewest || stackTotal(heights) === minimum);
  });
}

/**
 * invalid: malformed, a slot off the grid or a cell above three cubes. valid: the start untouched. met: every goal view
 * matches, with the fewest cubes when asked. review: some views match (partial), none (value), or too many cubes (false_alarm).
 */
function stackGrade(segment: Segment, response: unknown, rubric: unknown): V2Grade {
  const payload = readStackPayload(segment?.payload);
  if (!payload) return INVALID;
  if (gradeArrangement(response, undefined, stackContext(payload.size)).verdict === 'invalid') return INVALID;
  const heights = slotsToStack(slotsOf(response), payload.size);
  if (!heights) return INVALID;
  if (rubric === undefined) return VALID;
  const minimum = stackMinimum(payload.goal, payload.size);
  if (minimum === null || !stackKeyIsSound(rubric, payload, minimum)) return INVALID;
  if (sameHeights(heights, payload.start)) return VALID;
  const keys = (['front', 'side', 'plan'] as const).filter((key) => payload.goal[key] !== undefined);
  const hit = keys.filter((key) => matchesGoal(heights, { [key]: payload.goal[key] } as StackGoal)).length;
  if (hit === keys.length) return payload.fewest && stackTotal(heights) > minimum ? review('false_alarm') : MET;
  return review(hit > 0 ? 'partial' : 'value');
}

function netStart(segment: Segment): { slots: Record<string, string[]> } {
  const payload = readNetPayload(segment.payload);
  if (!payload) return { slots: {} };
  if (payload.mode === 'label') return { slots: Object.fromEntries(payload.fixed.map((entry) => [netSlotId(entry.cell), [entry.name]])) };
  return { slots: Object.fromEntries(payload.fixed.map((cell) => [gridSlotId(cell[0], cell[1]), [NET_PIECE]])) };
}

export const SOLIDS_SCORERS: Readonly<Record<string, HorizonteScorer>> = {
  'geometry.solid-viewer.v2': {
    grade: viewerGrade as HorizonteScorer['grade'],
    sample: (() => ({ solid: '', count: '' })) as HorizonteScorer['sample'],
  },
  'geometry.cube-net.v2': {
    grade: netGrade as HorizonteScorer['grade'],
    sample: netStart as HorizonteScorer['sample'],
  },
  'geometry.cube-stack.v2': {
    grade: stackGrade as HorizonteScorer['grade'],
    sample: ((segment: Segment) => {
      const payload = readStackPayload(segment.payload);
      return { slots: payload ? stackToSlots(payload.start) : {} };
    }) as HorizonteScorer['sample'],
  },
};
