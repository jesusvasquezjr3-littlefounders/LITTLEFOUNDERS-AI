import type { GateProblem } from '../../pipeline/gates.js';
import type { V2DocumentLike } from '../gates.js';
import { registerSolvabilityChecker } from '../solvability.js';
import { circuitChecker, circuitFrame, circuitKeyProblem, circuitLabelsProblem, circuitProblem, isCircuitVisual } from './comCircuits.js';
import { calculusChecker, explorerKeyProblem, explorerProblem, isCalculusVisual, isTrigVisual, trigChecker } from './comExplorer.js';
import { isNetworkVisual, networkChecker, networkFrame, networkKeyProblem, networkLabelsProblem, networkProblem } from './comNetwork.js';
import { keyShapeProblem, solutionsOf, type Frame, type Slots } from './comShared.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const COM_CAPABILITIES = {
  'math.network-count.v2': ['visual.network-count.v1', 'operation.drag-chips.v1', 'operation.tap-place.v1'],
  'trig.unit-circle.v2': ['visual.unit-circle.v1', 'operation.drag-point.v1', 'operation.predict-choice.v1', 'visual.math-notation.v1'],
  'calculus.explorer.v2': ['visual.calculus-explorer.v1', 'operation.drag-point.v1', 'operation.parameter-slider.v1', 'operation.predict-choice.v1', 'operation.number-input.v1', 'visual.math-notation.v1'],
  'computing.bits-gates.v2': ['visual.bits-gates.v1', 'operation.drag-chips.v1', 'operation.tap-place.v1'],
} as const;

const NETWORK = 'math.network-count.v2';
const TRIG = 'trig.unit-circle.v2';
const CALCULUS = 'calculus.explorer.v2';
const CIRCUITS = 'computing.bits-gates.v2';

const COM_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: NETWORK,
    lines: [
      `${NETWORK}: ages 10-17 and the adult pathway. The visual is graph, shortest-path, choice-tree or pascal, and the payload carries the field of its visual. A graph has a task (odd or trail), 3 to 7 nodes at least 18 apart on a 0 to 100 plane and 2 to 9 edges; a shortest-path map has a start, a goal, 3 to 7 nodes and 2 to 12 edges with a whole weight from 1 to 9 (one edge per pair, at most 8 routes sharing the shortest total); a choice-tree has 2 to 4 items, a pick of 2 or 3 and a mode; a pascal triangle has 5 to 10 rows and a multiple from 2 to 5.`,
      `${NETWORK}: a graph is connected. Task odd asks the learner to mark the nodes with an odd number of bridges (at least two); task trail asks for a walk over every edge once, which needs zero or two odd nodes. A choice-tree in order mode names the item that comes first (at least two outcomes start with it) and asks to keep exactly those; in group mode (no first, fewer picks than items) it asks for one outcome per team. At most 24 outcomes. Labels name every node, and the bridges of a trail, or the items of a tree; a pascal triangle takes no labels.`,
      `${NETWORK}: the key is { solutions } with one to eight example arrangements, and each must itself meet the rule, because the scorer grades by rule and never by comparing with the key. Slots: odd (nodes), walk (edges in walking order), route (nodes in order, the start first), keep (outcome ids, the items joined by a dot, such as pan.cafe), row-N with cells rRcC for a triangle (row and column from 0). The prompt names a board state, never the answer.`,
    ],
  },
  {
    type: TRIG,
    lines: [
      `${TRIG}: ages 15-17 and the adult pathway only. Trigonometry opens at 15, so a 13-17 lesson of it must carry an eligibility of 15 or older; the Forge document holds the band alone. The visual is unit-circle (payload ask, level, sign, side, step, start) or circle-wave (fn, level, sign, slope, step, start). ask and fn are cos or sin; level is zero, half, root2, root3 or one; sign is 1 or -1 (zero carries none); step is 5, 10, 15 or 30 degrees and start is a multiple of it below 360.`,
      `${TRIG}: exactly one whole-degree angle fits the level, and it is a multiple of the step and not the start angle. A level below one names the side that picks it (cos: upper or lower; sin: right or left on the circle) or the slope (rising or falling on the wave); a level of one names neither. The segment takes no labels.`,
      `${TRIG}: the answer is a choice plus a whole number of degrees, and the key is { predict, value } computed from the payload, never authored: for the circle predict is quadrant-1 to quadrant-4 (or axis) of the answer angle, for the wave it is times-1 when the level is one and times-2 otherwise, and value is the angle from 0 to 359. The prompt asks for a position on the circle, never the angle.`,
    ],
  },
  {
    type: CALCULUS,
    lines: [
      `${CALCULUS}: ages 15-17 and the adult pathway only. Calculus opens at 15, so a 13-17 lesson of it must carry an eligibility of 15 or older; the Forge document holds the band alone. A curve is four whole coefficients from -9 to 9 in c0 + c1 x + c2 x^2 + c3 x^3 order. The visual is secant, derivative-link, riemann or accumulation; the segment takes no labels.`,
      `${CALCULUS}: secant has coeffs and a point a from -3 to 3 (slope within 20 either way, the curve not a straight line); derivative-link has lead 1 or -1, two roots from -3 to 3 at least 2 apart, a base from -5 to 5 and ask max or min; riemann has coeffs, from and to (whole, -3 to 6, 2 to 8 wide, the curve never below the axis), a method (left, right, midpoint or trapezoid) and a tolerance in hundredths from 0.01 to 20; accumulation has coeffs, from, to (3 to 8 wide) and a nonzero target from -99 to 99 that exactly one whole number reaches.`,
      `${CALCULUS}: the answer is a choice plus a whole number, and the key is { predict, value } computed from the payload, never authored. secant: the sign of the slope (positive, negative, zero) and the slope; derivative-link: rising or falling and the x of the max or min; riemann: too-small or too-big and the fewest rectangles within the tolerance (2 to 40, the error keeping one sign); accumulation: growing, shrinking or flat and the x that reaches the target. The prompt asks what to explore, never the number.`,
    ],
  },
  {
    type: CIRCUITS,
    lines: [
      `${CIRCUITS}: ages 10-17 and the adult pathway. The visual is bits (payload bits from 4 to 8 and a target the bits can show, from 1) or gates (inputs, slots, pieces, expected). Gates: 1 to 3 input ids; 1 to 5 positions, each reading one or two earlier inputs or positions (two sources differ) and feeding the last position; a tray of 1 to 7 gates, at least as many as positions, each and, or, not, xor, nand or nor; expected lists one output per row of the truth table, first input as the most significant bit, never all equal.`,
      `${CIRCUITS}: a position that reads one source takes a not; one that reads two takes any other gate. The tray may hold spare gates. Every id (input, position, gate) is unique, and some arrangement must give the expected outputs. Bits take no labels; gates take labels for every input and the output position, and nothing else.`,
      `${CIRCUITS}: the key is { solutions } with one to eight example arrangements, and each must itself meet the rule, because the scorer grades by rule: the bits switched on (slot bits-on, pieces bit-8, bit-4, bit-2, bit-1 and so on) must add up to the target, and every position (one slot per position, one gate each) must give the expected output on every row. The prompt names a goal state, never the arrangement.`,
    ],
  },
];

// Gate 4 (solvability and scope).
const BANDS: Readonly<Record<string, readonly string[]>> = {
  [NETWORK]: ['10-12', '13-17', 'adult'],
  [TRIG]: ['13-17', 'adult'],
  [CALCULUS]: ['13-17', 'adult'],
  [CIRCUITS]: ['10-12', '13-17', 'adult'],
};

/** Trigonometry and calculus open at 15, so a 13-17 lesson of them must carry an eligibility of 15; the Forge document holds the band alone. */
function ageProblem(type: string, document: V2DocumentLike): string | null {
  const band = typeof document.age_band === 'string' ? document.age_band : null;
  const allowed = BANDS[type]!;
  return band === null || allowed.includes(band) ? null : `This kind is for age band ${allowed.join(', ')}, not ${band}`;
}

interface Spec {
  visualMessage: string;
  visualOk: (visual: unknown) => boolean;
  payload: (visual: unknown, payload: unknown) => string | null;
  labels: (visual: unknown, payload: unknown, labels: unknown) => string | null;
  key: (visual: unknown, payload: unknown, key: unknown) => string | null;
}

/** An arrangement key is read against the board's own frame first, then each solution against the rule of the task. */
const arrangementKey = (
  frameOf: (visual: unknown, payload: unknown) => Frame | null,
  rule: (visual: unknown, payload: unknown, solutions: readonly Slots[]) => string | null,
) => (visual: unknown, payload: unknown, key: unknown): string | null => {
  const frame = frameOf(visual, payload);
  if (frame === null) return 'The payload is malformed';
  return keyShapeProblem(frame, key) ?? rule(visual, payload, solutionsOf(key));
};

const noLabels = (_visual: unknown, _payload: unknown, labels: unknown): string | null => (labels === undefined ? null : 'This kind takes no labels');

const SPECS: Readonly<Record<string, Spec>> = {
  [NETWORK]: {
    visualMessage: 'The network visual must be graph, shortest-path, choice-tree or pascal',
    visualOk: isNetworkVisual,
    payload: (visual, payload) => networkProblem(visual, payload),
    labels: networkLabelsProblem,
    key: arrangementKey((visual, payload) => networkFrame(visual, payload), (visual, payload, solutions) => networkKeyProblem(visual, payload, solutions)),
  },
  [TRIG]: {
    visualMessage: 'The trigonometry visual must be unit-circle or circle-wave',
    visualOk: isTrigVisual,
    payload: explorerProblem,
    labels: noLabels,
    key: explorerKeyProblem,
  },
  [CALCULUS]: {
    visualMessage: 'The calculus visual must be secant, derivative-link, riemann or accumulation',
    visualOk: isCalculusVisual,
    payload: explorerProblem,
    labels: noLabels,
    key: explorerKeyProblem,
  },
  [CIRCUITS]: {
    visualMessage: 'The circuit visual must be bits or gates',
    visualOk: isCircuitVisual,
    payload: (visual, payload) => circuitProblem(visual, payload),
    labels: circuitLabelsProblem,
    key: arrangementKey((visual, payload) => circuitFrame(visual, payload), (visual, payload, solutions) => circuitKeyProblem(visual, payload, solutions)),
  },
};

function comGates(document: V2DocumentLike, answerKeys?: Record<string, unknown>): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const type = segment.type;
    if (typeof type !== 'string' || !Object.hasOwn(SPECS, type)) continue;
    const spec = SPECS[type]!;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const problem = (message: string) => problems.push({ gate: 4, segmentId, message });
    const visual = (segment.visual as { type?: unknown } | undefined)?.type;
    if (!spec.visualOk(visual)) { problem(spec.visualMessage); continue; }
    const age = ageProblem(type, document);
    if (age) problem(age);
    const broken = spec.payload(visual, segment.payload);
    if (broken) { problem(broken); continue; }
    const labels = spec.labels(visual, segment.payload, segment.labels);
    if (labels) problem(labels);
    if (!answerKeys || !Object.hasOwn(answerKeys, segmentId)) continue;
    const wrong = spec.key(visual, segment.payload, answerKeys[segmentId]);
    if (wrong) problem(wrong);
  }
  return problems;
}

registerSolvabilityChecker(NETWORK, networkChecker);
registerSolvabilityChecker(TRIG, trigChecker);
registerSolvabilityChecker(CALCULUS, calculusChecker);
registerSolvabilityChecker(CIRCUITS, circuitChecker);

export const com = {
  id: 'com',
  capabilities: COM_CAPABILITIES,
  guidance: COM_GUIDANCE,
  gates: comGates,
} as const satisfies ForgeHorizontePack;
