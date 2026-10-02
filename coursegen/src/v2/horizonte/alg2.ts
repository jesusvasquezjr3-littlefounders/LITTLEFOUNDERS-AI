import type { GateProblem } from '../../pipeline/gates.js';
import { expressionReferenceProblem, expressionTaskProblem, isExpressionTask, type ExpressionTask } from './alg2Expression.js';
import {
  formatDecimal, fromStandard, isCrossing, onSliders, passesThrough, pointKey, readGraphPayload, readStandard, readSystemPayload, responseNames, sameSpots, sameStandard, toStandard,
  type Dec, type PlanePoint,
} from './alg2Model.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const ALG2_CAPABILITIES = {
  'math.function-graph.v2': ['visual.function-graph.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
  'math.line-system.v2': ['visual.line-system.v1', 'operation.drag-point.v1', 'operation.move-menu.v1', 'operation.show-table.v1'],
  'math.expression-editor.v2': ['visual.expression-editor.v1', 'operation.type-expression.v1', 'operation.step-check.v1'],
} as const;

const GRAPH = 'math.function-graph.v2';
const SYSTEM = 'math.line-system.v2';
const EXPRESSION = 'math.expression-editor.v2';

const ALG2_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: GRAPH,
    lines: [
      `${GRAPH}: ages 12-17 only. Sliders for the parameters of a line (m, b), a parabola (a, b, c, or a, h, k in vertex form) or an exponential (a, b). Every slider has a min below its max and a step that divides the range into at most 400 steps, and every start sits on its slider. A vertex form's a slider skips zero and an exponential's base slider stays above zero.`,
      `${GRAPH}: pin the curve with marks, whole points at different x: at least 2 for a line or an exponential, at least 3 for a parabola, or none. The key is {family, target} with no tolerance: every mark lies exactly on the target, the target sits on the sliders, and the curve starts away from it. With marks the prompt never writes the target values; with no marks the prompt writes every nonzero target value in digits.`,
    ],
  },
  {
    type: SYSTEM,
    lines: [
      `${SYSTEM}: ages 13-17 only. Two or three lines a x + b y = c with whole a and b within 20 and a whole c within 200, a grid of 0.5, 1 or 2 that every window edge sits on, and one marker for each crossing of the lines. Every crossing lies inside the window, on the grid.`,
      `${SYSTEM}: the key is {required: [crossings]}, one point for each marker. The markers start away from the crossings. The prompt asks the learner to put the markers where the lines cross and never writes a crossing.`,
    ],
  },
  {
    type: EXPRESSION,
    lines: [
      `${EXPRESSION}: ages 13-17 and adults. A rewrite task starts from an expression and asks for its expanded or factored form; a solve task starts from an equation and asks for the variable alone (isolated) or a term in the variable against a plain number (separated). One lowercase variable letter, a given of at most 64 characters made of digits, the variable, + - * / ^ and brackets, with whole exponents 0 to 6.`,
      `${EXPRESSION}: the given must not already have the finished form. The key is {reference}: the finished line written the way a learner would type it, equal in value to the given. The board states the goal from the form, so the prompt sets the scene and never writes the reference.`,
    ],
  },
];

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnly = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

const isDigit = (code: number): boolean => code >= 48 && code <= 57;

/** The numerals a prompt writes, as plain decimal text ("0,5" reads as "0.5"). Read by character code. */
function numeralsIn(text: unknown): Set<string> {
  const found = new Set<string>();
  if (typeof text !== 'string') return found;
  let at = 0;
  while (at < text.length) {
    if (!isDigit(text.charCodeAt(at))) { at += 1; continue; }
    let end = at;
    while (end < text.length && isDigit(text.charCodeAt(end))) end += 1;
    if ((text[end] === '.' || text[end] === ',') && isDigit(text.charCodeAt(end + 1))) {
      end += 1;
      while (end < text.length && isDigit(text.charCodeAt(end))) end += 1;
    }
    found.add(text.slice(at, end).replace(',', '.'));
    at = end;
  }
  return found;
}

const withoutSpaces = (text: string): string => text.split(/\s+/).join('');

type Report = (message: string) => void;
/** `key` is null when the caller holds no key for the segment; otherwise its value, whatever that is. */
type Check = (segment: Record<string, unknown>, payload: Record<string, unknown>, key: { value: unknown } | null, report: Report) => void;

function visit(document: { segments?: unknown }, answerKeys: Record<string, unknown> | undefined, type: string, visual: string, check: Check): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    if (segment.type !== type) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const report: Report = (message) => problems.push({ gate: 4, segmentId, message });
    if ((segment.visual as { type?: unknown } | undefined)?.type !== visual) report(`The ${type} visual must be ${visual}`);
    const payload = segment.payload;
    if (!record(payload)) { report('The payload is missing'); continue; }
    const key = answerKeys && Object.hasOwn(answerKeys, segmentId) ? { value: answerKeys[segmentId] } : null;
    check(segment, payload, key, report);
  }
  return problems;
}

const isZero = (value: Dec): boolean => value.n === 0n;

/**
 * F2.4. The payload plays (sliders, start, window, marks), and a key is one curve of the payload's family: on the sliders,
 * through every mark, away from the start. With no marks the learner has nothing to aim at, so the prompt writes the numbers.
 */
const graphGate: Check = (segment, payload, key, report) => {
  const graph = readGraphPayload(payload);
  if (typeof graph === 'string') return report(graph);
  if (key === null) return;
  const rubric = key.value;
  if (!hasOnly(rubric, ['family', 'target'])) return report('The key is a family and a target, with no tolerance');
  if (rubric.family !== graph.curve) return report(`The key family must be ${graph.curve}`);
  const target = readStandard(graph.curve, rubric.target);
  if (!target) return report(`The key target names exactly ${responseNames(graph.curve).join(', ')} as numbers`);
  if (graph.curve !== 'line' && isZero(target.get('a')!)) return report('The key a must not be zero');
  const base = target.get('b')!;
  if (graph.curve === 'exponential' && (base.n <= 0n || (base.n === 1n && base.d === 1n))) return report('The key base must be above zero and not 1');
  if (!onSliders(graph, target)) return report('The key target must sit on the sliders, inside each range and on a step');
  if (!passesThrough(graph.curve, target, graph.marks)) return report('Every mark must lie exactly on the key curve');
  const start = toStandard(graph, graph.start);
  if (!start || sameStandard(start, target)) return report('The curve must start away from the answer');
  if (graph.marks.length > 0) return;
  const named = numeralsIn(segment.prompt);
  const values = fromStandard(graph, target) ?? new Map<string, Dec>();
  const missing = [...values].filter(([, value]) => !isZero(value) && !named.has(formatDecimal({ n: value.n < 0n ? -value.n : value.n, d: value.d }) ?? ''));
  if (missing.length > 0) report(`With no marks the prompt must write ${missing.map(([name]) => name).join(', ')} in digits`);
};

const isPoint = (value: unknown): value is PlanePoint =>
  hasOnly(value, ['x', 'y']) && typeof value.x === 'number' && typeof value.y === 'number' && Number.isFinite(value.x) && Number.isFinite(value.y);

/** F2.5. The payload plays (lines, grid, one marker for each crossing), and a key is exactly the crossings, away from the start. */
const systemGate: Check = (_segment, payload, key, report) => {
  const system = readSystemPayload(payload);
  if (typeof system === 'string') return report(system);
  if (key === null) return;
  const rubric = key.value;
  if (!hasOnly(rubric, ['required']) || !Array.isArray(rubric.required) || !rubric.required.every(isPoint)) return report('The key is the list of required crossings, each an x and a y');
  const required = rubric.required as PlanePoint[];
  if (required.length !== system.start.length) return report('The key has one crossing for each marker');
  if (new Set(required.map(pointKey)).size !== required.length) return report('The key crossings are different points');
  if (!required.every((point) => isCrossing(system.lines, point))) return report('Every key point must be a crossing of two of the lines');
  if (sameSpots(system.start, required)) report('The markers must start away from the crossings');
};

const isVariableLetter = (value: string): boolean => value.length === 1 && value >= 'a' && value <= 'z';

/** F2.6. The task plays (it parses as the right kind and is not finished), and a key is the finished line, equal in value to the given. */
const expressionGate: Check = (segment, payload, key, report) => {
  if (!hasOnly(payload, ['task', 'given', 'form', 'variable']) || !isExpressionTask(payload) || !isVariableLetter(payload.variable)) {
    return report('The payload is a task (rewrite or solve), a given, a form that fits the task and one lowercase variable letter');
  }
  const task: ExpressionTask = payload;
  const problem = expressionTaskProblem(task);
  if (problem) return report(problem);
  if (key === null) return;
  const rubric = key.value;
  if (!hasOnly(rubric, ['reference'])) return report('The key is a reference and nothing else');
  const reference = expressionReferenceProblem(task, rubric.reference);
  if (reference) return report(reference);
  const written = typeof rubric.reference === 'string' ? withoutSpaces(rubric.reference) : '';
  if (written.length >= 3 && typeof segment.prompt === 'string' && withoutSpaces(segment.prompt).includes(written)) report('The prompt must not write the reference answer');
};

/** Gate 4 (solvability), over the shared model and engine (copied from Core, pinned by a test): every key is one answer the payload allows. */
function alg2Gates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  return [
    ...visit(document, answerKeys, GRAPH, 'function-graph', graphGate),
    ...visit(document, answerKeys, SYSTEM, 'line-system', systemGate),
    ...visit(document, answerKeys, EXPRESSION, 'expression-editor', expressionGate),
  ];
}

export const alg2 = {
  id: 'alg2',
  capabilities: ALG2_CAPABILITIES,
  guidance: ALG2_GUIDANCE,
  gates: alg2Gates,
} as const satisfies ForgeHorizontePack;
