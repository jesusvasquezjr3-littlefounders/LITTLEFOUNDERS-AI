import type { GateProblem } from '../../pipeline/gates.js';
import {
  asRecord, checkRubricCoverage, issue, registerSolvabilityChecker, result, type SolvabilityChecker, type SolvabilityIssue,
} from '../solvability.js';
import {
  completions, FACE_NAMES, foldNormals, isCubeNet, labelSolutions, matchesGoal, NET_GRID, NET_PIECE, readNet, readStack, readViewer,
  SOLID_COUNTS, STACK_MAX_HEIGHT, stackSolutions, stackTotal, viewerMatches,
  type Cell, type Heights, type NetPayload, type StackPayload, type ViewerPayload,
} from './solidsGeometry.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const SOLIDS_CAPABILITIES = {
  'geometry.solid-viewer.v2': ['visual.solid-viewer.v1', 'operation.fixed-views.v1', 'operation.choose-and-count.v1'],
  'geometry.cube-net.v2': ['visual.cube-net.v1', 'operation.place-faces.v1', 'operation.fold-net.v1'],
  'geometry.cube-stack.v2': ['visual.cube-stack.v1', 'operation.stack-cubes.v1', 'operation.linked-views.v1'],
} as const;

const VIEWER = 'geometry.solid-viewer.v2';
const NET = 'geometry.cube-net.v2';
const STACK = 'geometry.cube-stack.v2';
const MAX_ANSWERS = 8;
const PROMPT_WORDS = 24;

const SOLIDS_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: VIEWER,
    lines: [
      `${VIEWER}: ages 7-12 only. List two to four different solids from cube, prism (triangular), pyramid (square base) and cylinder. The prompt is at most two imperative sentences: find the one solid with a given number of faces, edges or vertices, then count a different thing on it. It never names the solid or the final count.`,
      `${VIEWER}: exactly one listed solid must have the searched count. Teaching counts (faces, edges, vertices): cube 6, 12, 8; prism 5, 9, 6; pyramid 5, 8, 5; cylinder 3, 2, 0 (two flat faces and one curved face, two curved edges, no vertices). Searching 0 vertices among cube, cylinder and pyramid has one answer; searching 5 faces among prism and pyramid has two, so never list both.`,
      `${VIEWER}: the key is { solid, count } with count as digits in a string, computed from the table above. Fix the question with find: { kind, count } and report as a different kind.`,
    ],
  },
  {
    type: NET,
    lines: [
      `${NET}: ages 7-12 only. Two modes. label gives the six squares of a cube net as [column, row] cells (a grid of at most 5 by 4) and one to three squares already named; the learner names the rest as top, bottom, front, back, left or right. The given names must leave exactly one way to name the others, so name two squares that touch, or name squares until only one labelling fits.`,
      `${NET}: complete gives a grid (3 to 5 columns, 3 to 4 rows) and two to five placed squares; the learner adds the rest so the net folds into a cube. Any set of six squares that folds without overlap is right, so choose placed squares that some cube net contains. The key lists one to eight valid completions as g{column}x{row} slots holding square.`,
      `${NET}: only the eleven cube nets fold. A row of four squares with one above and one below is a net; six squares in a line or a 2 by 3 block are not. The edge is a whole number of units from 1 to 20 and the board shows the surface area 6 x edge x edge, so the prompt never gives it. The prompt is at most two imperative sentences and never names the answer.`,
    ],
  },
  {
    type: STACK,
    lines: [
      `${STACK}: ages 6-12. A 2 by 2 or 3 by 3 grid of stacks, at most 3 cubes a cell. heights[row][col] has row 0 at the back and the last row at the front. The goal names at least one view: front (the tallest stack per column, left to right), side (seen from the right, so left to right runs from the front row to the back row) and plan (1 where a stack stands, 0 where the cell is empty).`,
      `${STACK}: the goal must be reachable by some stack of the grid and the start must not already be the answer (and holds at least one cube). With fewest: true the learner builds the smallest number of cubes that shows the views; the key lists one to eight such stacks as c{column}r{row} slots holding one cube per level. With fewest: false any stack that shows every view is right.`,
      `${STACK}: the prompt is at most two imperative sentences that name the views (front and side both read 3, 2, 1) and never the number of cubes. Use one view for ages 6-8, two views at 9, and three views only on a 2 by 2 grid until age 10.`,
    ],
  },
];

const cellText = (cell: Cell): string => `${cell[0]}x${cell[1]}`;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const objectKeys = (value: Record<string, unknown>): string[] => Object.keys(value).sort();

type SlotMap = Record<string, string[]>;

/** The rubric as the arrangement shape Core stores: { solutions: [slots] } with at most the allowed count. */
function readSolutions(subject: string, answerKey: unknown): { slots: SlotMap[] } | SolvabilityIssue {
  const record = asRecord(answerKey);
  const list = record && Array.isArray(record.solutions) ? record.solutions : null;
  if (!record || !list || objectKeys(record).some((name) => name !== 'solutions' && name !== 'ordered') || list.length < 1 || list.length > MAX_ANSWERS) {
    return issue('impossible-state', `${subject}: the rubric must be { solutions } with one to ${MAX_ANSWERS} solutions`);
  }
  const slots: SlotMap[] = [];
  for (const raw of list) {
    const entry = asRecord(raw);
    if (!entry || !Object.values(entry).every(strings)) return issue('impossible-state', `${subject}: each solution is a map of slot ids to lists of piece ids`);
    slots.push(entry as SlotMap);
  }
  return { slots };
}

const isIssue = (value: { slots: SlotMap[] } | SolvabilityIssue): value is SolvabilityIssue => 'code' in value;

function viewerIssues(subject: string, payload: ViewerPayload, answerKey: unknown): SolvabilityIssue[] {
  if (payload.report === payload.find.kind) return [issue('impossible-state', `${subject}: the question counts a different thing than the one it searches by`)];
  const matches = viewerMatches(payload);
  if (matches.length === 0) return [issue('no-solution', `${subject}: no listed solid has ${payload.find.count} ${payload.find.kind}, so the learner cannot succeed`)];
  if (matches.length > 1) return [issue('ambiguous-solution', `${subject}: ${matches.join(' and ')} all have ${payload.find.count} ${payload.find.kind}; list solids so exactly one matches`)];
  if (answerKey === undefined) return [];
  const solid = matches[0]!;
  const expected = JSON.stringify([solid, String(SOLID_COUNTS[solid][payload.report])]);
  const record = asRecord(answerKey);
  if (!record || objectKeys(record).join() !== 'count,solid' || typeof record.solid !== 'string' || typeof record.count !== 'string') {
    return [issue('impossible-state', `${subject}: the rubric must be { solid, count } with the count as digits in a string`)];
  }
  return checkRubricCoverage([expected], new Set([JSON.stringify([record.solid, record.count])]), { subject, isSolution: (key) => key === expected });
}

const viewerChecker: SolvabilityChecker = (segment, context) => {
  const subject = `solid viewer ${segment.id}`;
  const payload = readViewer(segment.payload);
  if (typeof payload === 'string') return result([issue('impossible-state', `${subject}: ${payload}`)]);
  return result(viewerIssues(subject, payload, context.answerKey), { solids: payload.solids.length });
};

const labelOf = (slots: SlotMap): string | null => {
  const names: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const held = slots[`cell${index}`];
    if (!held || held.length !== 1 || !(FACE_NAMES as readonly string[]).includes(held[0]!)) return null;
    names.push(held[0]!);
  }
  return Object.keys(slots).length === 6 ? names.join() : null;
};

const slotCells = (slots: SlotMap, grid: { cols: number; rows: number }): Cell[] | null => {
  const cells: Cell[] = [];
  for (const [slot, held] of Object.entries(slots)) {
    if (held.length === 0) continue;
    const match = /^g(\d)x(\d)$/.exec(slot);
    if (!match || held.length !== 1 || held[0] !== NET_PIECE) return null;
    const cell: Cell = [Number(match[1]), Number(match[2])];
    if (cell[0] >= grid.cols || cell[1] >= grid.rows) return null;
    cells.push(cell);
  }
  return cells;
};

const hasDuplicates = (payload: Extract<NetPayload, { mode: 'label' }>): boolean =>
  new Set(payload.fixed.map((entry) => entry.cell)).size !== payload.fixed.length || new Set(payload.fixed.map((entry) => entry.name)).size !== payload.fixed.length;

function labelIssues(subject: string, payload: Extract<NetPayload, { mode: 'label' }>, answerKey: unknown): SolvabilityIssue[] {
  if (!isCubeNet(payload.cells)) return [issue('impossible-state', `${subject}: the six squares do not fold into a cube`)];
  const spread = (axis: 0 | 1): number => Math.max(...payload.cells.map((cell) => cell[axis])) - Math.min(...payload.cells.map((cell) => cell[axis])) + 1;
  if (spread(0) > NET_GRID.maxCols || spread(1) > NET_GRID.maxRows) return [issue('out-of-bounds', `${subject}: the net must fit on a grid of ${NET_GRID.maxCols} by ${NET_GRID.maxRows}`)];
  if (hasDuplicates(payload)) return [issue('duplicate-id', `${subject}: a square is named once and a face name is given once`)];
  const answers = labelSolutions(payload.cells, payload.fixed).map((labelling) => labelling.join());
  if (answers.length === 0) return [issue('no-solution', `${subject}: the given names cannot belong to one cube, so the learner cannot succeed`)];
  if (answers.length > 1) return [issue('ambiguous-solution', `${subject}: the given names leave ${answers.length} ways to name the rest; name one more square so exactly one fits`)];
  if (answerKey === undefined) return [];
  const read = readSolutions(subject, answerKey);
  if (isIssue(read)) return [read];
  const accepted = read.slots.map(labelOf);
  if (accepted.some((entry) => entry === null)) return [issue('impossible-state', `${subject}: each solution names all six squares as cell0 to cell5, one face name each`)];
  return checkRubricCoverage(answers, new Set(accepted as string[]), { subject, isSolution: (key) => answers.includes(key) });
}

function completeIssues(subject: string, payload: Extract<NetPayload, { mode: 'complete' }>, answerKey: unknown): SolvabilityIssue[] {
  const found = completions(payload.fixed, payload.grid, 1);
  if (found.count === 0) return [issue('no-solution', `${subject}: the placed squares are in no cube net, so the learner cannot succeed`)];
  if (answerKey === undefined) return [];
  const read = readSolutions(subject, answerKey);
  if (isIssue(read)) return [read];
  const fixedKeys = payload.fixed.map(cellText);
  const unsound = read.slots.filter((slots) => {
    const cells = slotCells(slots, payload.grid);
    return cells === null || cells.length !== 6 || !fixedKeys.every((key) => cells.some((cell) => cellText(cell) === key)) || !isCubeNet(cells);
  });
  return unsound.length === 0 ? [] : [issue('rubric-accepts-invalid', `${subject}: ${unsound.length} rubric solution(s) do not fold into a cube with the placed squares, so a wrong answer would be graded right`)];
}

const netChecker: SolvabilityChecker = (segment, context) => {
  const subject = `cube net ${segment.id}`;
  const payload = readNet(segment.payload);
  if (typeof payload === 'string') return result([issue('impossible-state', `${subject}: ${payload}`)]);
  return result(payload.mode === 'label' ? labelIssues(subject, payload, context.answerKey) : completeIssues(subject, payload, context.answerKey));
};

function slotsToHeights(slots: SlotMap, size: number): Heights | null {
  const heights = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  for (const [slot, held] of Object.entries(slots)) {
    if (held.length === 0) continue;
    const match = /^c(\d)r(\d)$/.exec(slot);
    if (!match || Number(match[1]) >= size || Number(match[2]) >= size || held.length > STACK_MAX_HEIGHT || !held.every((piece) => piece === 'cube')) return null;
    heights[Number(match[2])]![Number(match[1])] = held.length;
  }
  return heights;
}

const minimumCubes = (solutions: readonly Heights[]): number => Math.min(...solutions.map(stackTotal));
const alreadyDone = (payload: StackPayload, minimum: number): boolean =>
  matchesGoal(payload.start, payload.goal) && (!payload.fewest || stackTotal(payload.start) === minimum);

function stackIssues(subject: string, payload: StackPayload, answerKey: unknown): { issues: SolvabilityIssue[]; stats?: Record<string, number> } {
  const solutions = stackSolutions(payload.goal, payload.size);
  if (solutions.length === 0) return { issues: [issue('no-solution', `${subject}: no stack of this grid shows these views, so the learner cannot succeed`)] };
  const minimum = minimumCubes(solutions);
  const stats = { solutions: solutions.length, minimum };
  if (minimum < 1) return { issues: [issue('impossible-state', `${subject}: the views are empty, so no cube is needed`)], stats };
  if (stackTotal(payload.start) < 1) return { issues: [issue('impossible-state', `${subject}: the start holds at least one cube`)], stats };
  if (alreadyDone(payload, minimum)) return { issues: [issue('impossible-state', `${subject}: the start already is the answer, so there is nothing to build`)], stats };
  if (answerKey === undefined) return { issues: [], stats };
  const read = readSolutions(subject, answerKey);
  if (isIssue(read)) return { issues: [read], stats };
  const stacks = read.slots.map((slots) => slotsToHeights(slots, payload.size));
  if (stacks.some((heights) => heights === null)) return { issues: [issue('impossible-state', `${subject}: each solution is c{column}r{row} slots holding at most ${STACK_MAX_HEIGHT} cubes`)], stats };
  const unsound = (stacks as Heights[]).filter((heights) => !matchesGoal(heights, payload.goal) || (payload.fewest && stackTotal(heights) !== minimum));
  const detail = payload.fewest ? ` with exactly ${minimum} cube(s)` : '';
  return {
    issues: unsound.length === 0 ? [] : [issue('rubric-accepts-invalid', `${subject}: ${unsound.length} rubric solution(s) do not show every view${detail}, so a wrong answer would be graded right`)],
    stats,
  };
}

const stackChecker: SolvabilityChecker = (segment, context) => {
  const subject = `cube stack ${segment.id}`;
  const payload = readStack(segment.payload);
  if (typeof payload === 'string') return result([issue('impossible-state', `${subject}: ${payload}`)]);
  const found = stackIssues(subject, payload, context.answerKey);
  return result(found.issues, found.stats);
};

registerSolvabilityChecker(VIEWER, viewerChecker);
registerSolvabilityChecker(NET, netChecker);
registerSolvabilityChecker(STACK, stackChecker);

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
const VISUALS: Readonly<Record<string, string>> = { [VIEWER]: 'solid-viewer', [NET]: 'cube-net', [STACK]: 'cube-stack' };

/** Gate 4: each board is well formed and its visual says what it holds; a cube net really folds and a stack goal can be built. The private key is judged by the solvability checkers above. */
function solidsGates(document: { segments?: unknown }): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const type = segment.type;
    if (typeof type !== 'string' || !Object.hasOwn(VISUALS, type)) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const problem = (message: string): void => { problems.push({ gate: 4, segmentId, message }); };
    if (asRecord(segment.visual)?.type !== VISUALS[type]) problem(`The ${VISUALS[type]} board needs the visual type ${VISUALS[type]}`);
    if (typeof segment.prompt === 'string' && wordCount(segment.prompt) > PROMPT_WORDS) problem(`The prompt is at most ${PROMPT_WORDS} words`);
    if (type === VIEWER) {
      const payload = readViewer(segment.payload);
      if (typeof payload === 'string') problem(`The solid viewer: ${payload}`);
      else if (payload.report === payload.find.kind) problem('The solid viewer counts a different thing than the one it searches by');
      else if (viewerMatches(payload).length !== 1) problem('Exactly one listed solid must have the searched count');
    } else if (type === NET) {
      const payload = readNet(segment.payload);
      if (typeof payload === 'string') { problem(`The cube net: ${payload}`); continue; }
      if (payload.mode === 'label') {
        if (foldNormals(payload.cells) === null) problem('The six squares of a label net must fold into a cube');
        else if (hasDuplicates(payload)) problem('A square is named once and a face name is given once');
        else if (labelSolutions(payload.cells, payload.fixed).length !== 1) problem('The given names must leave exactly one way to name the rest');
      } else if (completions(payload.fixed, payload.grid, 1).count === 0) problem('The placed squares must be part of some cube net');
    } else {
      const payload = readStack(segment.payload);
      if (typeof payload === 'string') { problem(`The cube stack: ${payload}`); continue; }
      const solutions = stackSolutions(payload.goal, payload.size);
      if (solutions.length === 0) problem('Some stack of the grid must show the goal views');
      else if (alreadyDone(payload, minimumCubes(solutions))) problem('The start must not already be the answer');
    }
  }
  return problems;
}

export const solids = {
  id: 'solids',
  capabilities: SOLIDS_CAPABILITIES,
  guidance: SOLIDS_GUIDANCE,
  gates: solidsGates,
} as const satisfies ForgeHorizontePack;
