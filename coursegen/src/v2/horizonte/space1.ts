import type { GateProblem } from '../../pipeline/gates.js';
import {
  asRecord, checkRubricCoverage, issue, registerSolvabilityChecker, result, type SolvabilityChecker, type SolvabilityIssue,
} from '../solvability.js';
import {
  ALSO_TRUE, EULER_COUNTS, TARGET_IDS, VOLUME_BOUNDS, basketMeets, coinAnswer, coinProblem, coneVolume, cutShape, eulerBounds, eulerSum,
  hiddenCount, matchingAngles, mostItems, pyramidVolume, readCoinPayload, readRotationPayload, readSolidSectionPayload,
  readStallPayload, reachableTotals, rotationAnswer, rotationProblem, sectionCut, slotsToBasket, solidSectionProblem, stallAnswer,
  stallProblem,
  type CoinPayload, type RotationPayload, type SolidSectionPayload, type StallPayload,
} from './space1Geometry.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const SPACE1_CAPABILITIES = {
  'geometry.mental-rotation.v2': ['visual.mental-rotation.v1', 'operation.turn-figure.v1', 'operation.pick-match.v1'],
  'geometry.solid-section.v2': ['visual.solid-section.v1', 'operation.turn-solid.v1', 'operation.choose-and-type.v1', 'operation.slide-plane.v1'],
  'money.market-stall.v2': ['visual.market-stall.v1', 'operation.buy-items.v1', 'operation.tap-place.v1'],
  'money.coin-stack.v2': ['visual.coin-stack.v1', 'operation.set-count.v1', 'operation.read-scale.v1'],
} as const;

const ROTATION = 'geometry.mental-rotation.v2';
const SECTION = 'geometry.solid-section.v2';
const STALL = 'money.market-stall.v2';
const COIN = 'money.coin-stack.v2';
const MAX_SOLUTIONS = 8;
const PROMPT_WORDS = 24;

const SPACE1_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: ROTATION,
    lines: [
      `${ROTATION}: ages 6-17 and adults. payload { axis, figure, targets }: axis is up, side or depth (the line the figure turns about, drawn dashed); figure and each target are 3 to 10 unit cubes as [x, y, z] cells in a 3 by 3 by 3 box (each coordinate 0 to 2), and every cube touches another by a face. One to three targets, named a, b and c in order. Ages 6-9 use one target and a figure of 3 to 5 cubes; ages 10-12 use two or three targets; ages 13-17 use a figure of 5 cubes or more.`,
      `${ROTATION}: exactly one target is the figure turned about the axis by 90, 180 or 270 degrees; every other target is a mirror image or a changed shape, never a turn of the figure about any axis. No target equals the figure as it stands (a turn of 0 is never the answer), and no two targets are the same shape. The learner picks the target and sets the angle.`,
      `${ROTATION}: the key is { pick, angles } with pick the one matching target id and angles every turn that carries the figure onto it, in ascending order (a figure with its own symmetry has more than one). The prompt is at most two imperative sentences and never names the target or the angle.`,
    ],
  },
  {
    type: SECTION,
    lines: [
      `${SECTION}: ages 11-17 and adults. Five modes in payload.mode. section: { mode, solid, plane, options } with solid tetrahedron, cube, octahedron or cylinder, plane { normal, offset } (three whole normal parts from -3 to 3, not all zero, and a whole offset from -16 to 16 in quarters: the plane is normal . p = offset / 4 with the solid centred on the origin, a cube's corners at plus or minus 1, and the cylinder of radius 1 and height 3 standing on the y axis), and two to four distinct option shapes drawn from triangle, square, rectangle, rhombus, parallelogram, trapezoid, quadrilateral, pentagon, hexagon, polygon, circle, ellipse.`,
      `${SECTION}: the plane must really cut through the solid. The options include the shape of the cut and no other option that is also true of it (a square is also a rectangle, a rhombus and a parallelogram, and a circle is also an ellipse, so never list a square with those or a circle with an ellipse). A cube cut across a corner region by normal [1, 1, 1] and offset 0 gives a hexagon; a tetrahedron cut halfway between two opposite edges (normal [1, 0, 0], offset 0) gives a square. A cylinder cut by normal [0, 1, 0] (parallel to its flat ends) gives a circle while the offset stays under 6; by [1, 0, 0] (along its axis) a rectangle; by a slanted normal such as [1, 2, 0] an ellipse, but only while the cut stays clear of both flat ends (offset 7 or less there), because a cut that runs into an end cap is not a named shape and is refused. The key is { pick } with the shape.`,
      `${SECTION}: euler: { mode, solid, hide } with solid one of the five Platonic solids (tetrahedron 4, 6, 4; cube 8, 12, 6; octahedron 6, 12, 8; dodecahedron 20, 30, 12; icosahedron 12, 30, 20 as vertices, edges, faces) or one of five Archimedean solids (truncated-tetrahedron 12, 18, 8; cuboctahedron 12, 24, 14; truncated-octahedron 24, 36, 14; icosidodecahedron 30, 60, 32; truncated-icosahedron 60, 90, 32) and hide one of vertices, edges or faces. The board shows the other two counts and V - E + F = 2; the key is { target } with the hidden count as digits in a string.`,
      `${SECTION}: volume: { mode, side, height } with a square base side from 2 to 12 and a height from 1 to 12. The learner finds the pyramid's volume as a third of the prism with the same base and height, so side x side x height must divide by 3; the key is { target } with that volume as digits in a string. cone: { mode, radius, height } with a whole radius from 1 to 12 and a whole height from 1 to 12; the learner finds the cone's volume as a third of the cylinder with the same base and height, counted in pi, so radius x radius x height must divide by 3; the key is { target } with that number of pi as digits in a string (radius 3, height 4 gives 12).`,
      `${SECTION}: slide: { mode, solid, normal, start, target } with solid tetrahedron, cube, octahedron or cylinder, normal three whole parts from -3 to 3 (not all zero), start the whole offset the plane begins at (from -16 to 16) and target the shape to find. The learner slides the plane along its normal (a slider with a keyboard alternative) and the key is { pick } with the target shape. The plane must make the target at some position, must not start on it, and the solid must not also make a shape that the target is a kind of (a square is a rectangle), or one position would be graded two ways. A cube with normal [1, 1, 1] makes a hexagon near offset 0 and a triangle near offset 10; a tetrahedron with normal [1, 0, 0] makes a square only at offset 0. Never include a sphere. The prompt is at most two imperative sentences and never names the answer.`,
    ],
  },
  {
    type: STALL,
    lines: [
      `${STALL}: ages 7-12 only. payload { items, goal }: two to five items, each { id, price, stock } with id from apple, bread, juice, toy, book, pen, cap, kite, shell, stamp (no words in the payload), price in whole cents of a generic currency from 1 to 2000 and stock from 1 to 9, each id once. The goal is { kind: "exact", total }, { kind: "change", paid, change } (the basket must cost paid minus change) or { kind: "most", budget }, with totals up to 10000 cents.`,
      `${STALL}: an exact or change goal must be reachable by some basket within the stock. A most goal must buy at least the cheapest item and must not cover the whole stall; the right basket is the one with the most items, which is the cheapest items first, so give at least two prices that differ. Many baskets can be right, so the key is { solutions } with one to eight baskets as { item id: ["item", ...] } slot maps, each one a basket that meets the rule within the stock.`,
      `${STALL}: ages 7-9 use whole-dollar-friendly prices and an exact goal; ages 10-12 may use change or most. The prompt is at most two imperative sentences, names the total or the budget as the question asks, and never names a basket.`,
    ],
  },
  {
    type: COIN,
    lines: [
      `${COIN}: ages 7-17 and adults. payload { piece, value, goal, step, max }: piece is coin (2 mm thick) or bill (0.1 mm thick), value is what one piece is worth in whole cents of a generic currency, goal is { kind: "amount", total } in cents or { kind: "height", mm } in whole millimetres, step is the count the handle moves by, and max is the largest count (a whole number of steps, at most 40 resting places).`,
      `${COIN}: the goal must fall on a whole number of pieces: the total must be a multiple of the value, or the height 10 x mm must be a multiple of the piece thickness in tenths (20 for a coin, 1 for a bill). That count must be a multiple of the step and between one step and the maximum, so the handle can rest on it. The key is { target } with the count as digits in a string.`,
      `${COIN}: the board prints the other quantity live (the worth when the question is a height, the height when it is a worth) beside a phone (8 mm), a book (30 mm), a desk (750 mm) and a door (2000 mm). Use a height goal for ages 7-9, an amount for ages 10-12, and a very large amount in bills for ages 13-17. The prompt is at most two imperative sentences and never names the count.`,
    ],
  },
];

const objectKeys = (value: Record<string, unknown>): string[] => Object.keys(value).sort();
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');

type SlotMap = Record<string, string[]>;

/** The rubric as the arrangement shape Core stores: { solutions: [slots] } with at most the allowed count. */
function readSolutions(subject: string, answerKey: unknown): { slots: SlotMap[] } | SolvabilityIssue {
  const record = asRecord(answerKey);
  const list = record && Array.isArray(record.solutions) ? record.solutions : null;
  if (!record || !list || objectKeys(record).some((name) => name !== 'solutions' && name !== 'ordered') || list.length < 1 || list.length > MAX_SOLUTIONS) {
    return issue('impossible-state', `${subject}: the rubric must be { solutions } with one to ${MAX_SOLUTIONS} solutions`);
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

function rotationIssues(subject: string, payload: RotationPayload, answerKey: unknown): SolvabilityIssue[] {
  const problem = rotationProblem(payload);
  if (problem) {
    const matching = payload.targets.filter((target) => matchingAngles(payload.figure, target, payload.axis).length > 0).length;
    if (matching === 0 && /axis/.test(problem)) return [issue('no-solution', `${subject}: ${problem}, so the learner cannot succeed`)];
    if (matching > 1 || /wrong target/.test(problem)) return [issue('ambiguous-solution', `${subject}: ${problem}`)];
    return [issue('impossible-state', `${subject}: ${problem}`)];
  }
  if (answerKey === undefined) return [];
  const answer = rotationAnswer(payload)!;
  const expected = JSON.stringify([answer.pick, answer.angles]);
  const record = asRecord(answerKey);
  if (!record || objectKeys(record).join() !== 'angles,pick' || typeof record.pick !== 'string' || !Array.isArray(record.angles)) {
    return [issue('impossible-state', `${subject}: the rubric must be { pick, angles }`)];
  }
  if (!TARGET_IDS.slice(0, payload.targets.length).includes(record.pick as never)) return [issue('rubric-accepts-invalid', `${subject}: the rubric picks "${record.pick}", which is not one of the ${payload.targets.length} target(s)`)];
  return checkRubricCoverage([expected], new Set([JSON.stringify([record.pick, record.angles])]), { subject, isSolution: (key) => key === expected });
}

const rotationChecker: SolvabilityChecker = (segment, context) => {
  const subject = `mental rotation ${segment.id}`;
  const payload = readRotationPayload(segment.payload);
  if (!payload) return result([issue('impossible-state', `${subject}: the payload must be { axis, figure, targets } with each figure of 3 to 10 cubes in a 3 by 3 by 3 box and one to three targets`)]);
  return result(rotationIssues(subject, payload, context.answerKey), { targets: payload.targets.length, cubes: payload.figure.length });
};

function sectionIssues(subject: string, payload: SolidSectionPayload, answerKey: unknown): SolvabilityIssue[] {
  if (payload.mode === 'euler' && eulerSum(EULER_COUNTS[payload.solid]) !== 2) return [issue('impossible-state', `${subject}: ${payload.solid} does not satisfy V - E + F = 2`)];
  const problem = solidSectionProblem(payload);
  if (problem) {
    const shape = payload.mode === 'section' ? cutShape(payload) : null;
    const ambiguous = (payload.mode === 'section' && shape !== null && payload.options.some((option) => option !== shape && ALSO_TRUE[shape].includes(option))) || /graded two ways/.test(problem);
    const silent = payload.mode === 'cone' || /must start|must not start/.test(problem);
    return [issue(ambiguous ? 'ambiguous-solution' : silent ? 'impossible-state' : 'no-solution', `${subject}: ${problem}`)];
  }
  if (answerKey === undefined) return [];
  const record = asRecord(answerKey);
  if (payload.mode === 'section' || payload.mode === 'slide') {
    const shape = payload.mode === 'slide' ? payload.target : cutShape(payload)!;
    if (!record || objectKeys(record).join() !== 'pick' || typeof record.pick !== 'string') return [issue('impossible-state', `${subject}: the rubric must be { pick } with the shape name`)];
    return checkRubricCoverage([shape], new Set([record.pick]), { subject, isSolution: (key) => key === shape });
  }
  const target = payload.mode === 'euler' ? String(hiddenCount(payload)) : payload.mode === 'cone' ? String(coneVolume(payload.radius, payload.height)) : String(pyramidVolume(payload.side, payload.height));
  const bounds = payload.mode === 'euler' ? eulerBounds(payload.solid) : VOLUME_BOUNDS;
  if (!record || objectKeys(record).join() !== 'target' || typeof record.target !== 'string') return [issue('impossible-state', `${subject}: the rubric must be { target } with the number as digits in a string`)];
  const issues = checkRubricCoverage([target], new Set([record.target]), { subject, isSolution: (key) => key === target });
  if (Number(target) > Number(bounds.maximum)) issues.push(issue('out-of-bounds', `${subject}: the answer ${target} is above the ${bounds.maximum} the box accepts`));
  return issues;
}

const sectionChecker: SolvabilityChecker = (segment, context) => {
  const subject = `solid section ${segment.id}`;
  const payload = readSolidSectionPayload(segment.payload);
  if (!payload) return result([issue('impossible-state', `${subject}: the payload must be a section, euler, volume, cone or slide question of the documented shape`)]);
  return result(sectionIssues(subject, payload, context.answerKey));
};

function stallIssues(subject: string, payload: StallPayload, answerKey: unknown): { issues: SolvabilityIssue[]; stats?: Record<string, number> } {
  const problem = stallProblem(payload);
  if (problem) return { issues: [issue(/budget must not cover|nothing to choose/.test(problem) ? 'impossible-state' : 'no-solution', `${subject}: ${problem}`)] };
  const sold = payload.items.reduce((sum, item) => sum + item.price * item.stock, 0);
  const stats: Record<string, number> = payload.goal.kind === 'most'
    ? { most: mostItems(payload.items, payload.goal.budget) }
    : { totals: reachableTotals(payload.items, sold).size };
  if (answerKey === undefined) return { issues: [], stats };
  const read = readSolutions(subject, answerKey);
  if (isIssue(read)) return { issues: [read], stats };
  const unsound = read.slots.filter((slots) => {
    const basket = slotsToBasket(slots, payload);
    return basket === null || !basketMeets(payload, basket);
  });
  return {
    issues: unsound.length === 0 ? [] : [issue('rubric-accepts-invalid', `${subject}: ${unsound.length} rubric solution(s) are not a basket the stall can fill that meets the goal, so a wrong answer would be graded right`)],
    stats,
  };
}

const stallChecker: SolvabilityChecker = (segment, context) => {
  const subject = `market stall ${segment.id}`;
  const payload = readStallPayload(segment.payload);
  if (!payload) return result([issue('impossible-state', `${subject}: the payload must be { items, goal } with two to five distinct items and an exact, change or most goal`)]);
  const found = stallIssues(subject, payload, context.answerKey);
  return result(found.issues, found.stats);
};

function coinIssues(subject: string, payload: CoinPayload, answerKey: unknown): SolvabilityIssue[] {
  const problem = coinProblem(payload);
  if (problem) {
    const answer = coinAnswer(payload);
    const code = answer === null ? 'no-solution' : answer < payload.step || answer > payload.max ? 'out-of-bounds' : 'impossible-state';
    return [issue(code, `${subject}: ${problem}`)];
  }
  if (answerKey === undefined) return [];
  const expected = String(coinAnswer(payload));
  const record = asRecord(answerKey);
  if (!record || objectKeys(record).join() !== 'target' || typeof record.target !== 'string') return [issue('impossible-state', `${subject}: the rubric must be { target } with the count as digits in a string`)];
  return checkRubricCoverage([expected], new Set([record.target]), { subject, isSolution: (key) => key === expected });
}

const coinChecker: SolvabilityChecker = (segment, context) => {
  const subject = `coin stack ${segment.id}`;
  const payload = readCoinPayload(segment.payload);
  if (!payload) return result([issue('impossible-state', `${subject}: the payload must be { piece, value, goal, step, max } with a coin or bill and an amount or height goal`)]);
  return result(coinIssues(subject, payload, context.answerKey), { positions: Math.floor(payload.max / payload.step) });
};

registerSolvabilityChecker(ROTATION, rotationChecker);
registerSolvabilityChecker(SECTION, sectionChecker);
registerSolvabilityChecker(STALL, stallChecker);
registerSolvabilityChecker(COIN, coinChecker);

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
const VISUALS: Readonly<Record<string, string>> = { [ROTATION]: 'mental-rotation', [SECTION]: 'solid-section', [STALL]: 'market-stall', [COIN]: 'coin-stack' };

/** Gate 4: each board is well formed and its visual says what it holds; the question has one answer the learner can reach. The private key is judged by the solvability checkers above. */
function space1Gates(document: { segments?: unknown }): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const type = segment.type;
    if (typeof type !== 'string' || !Object.hasOwn(VISUALS, type)) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const problem = (message: string): void => { problems.push({ gate: 4, segmentId, message }); };
    if (asRecord(segment.visual)?.type !== VISUALS[type]) problem(`The ${VISUALS[type]} board needs the visual type ${VISUALS[type]}`);
    if (typeof segment.prompt === 'string' && wordCount(segment.prompt) > PROMPT_WORDS) problem(`The prompt is at most ${PROMPT_WORDS} words`);
    if (type === ROTATION) {
      const payload = readRotationPayload(segment.payload);
      if (!payload) problem('The mental rotation payload must be { axis, figure, targets }, each figure of 3 to 10 cubes inside a 3 by 3 by 3 box');
      else { const message = rotationProblem(payload); if (message) problem(`The mental rotation: ${message}`); }
    } else if (type === SECTION) {
      const payload = readSolidSectionPayload(segment.payload);
      if (!payload) problem('The solid section payload must be a section, euler, volume, cone or slide question of the documented shape');
      else { const message = solidSectionProblem(payload); if (message) problem(`The solid section: ${message}`); }
    } else if (type === STALL) {
      const payload = readStallPayload(segment.payload);
      if (!payload) problem('The market stall payload must be { items, goal } with two to five distinct items and an exact, change or most goal');
      else {
        const message = stallProblem(payload);
        if (message) problem(`The market stall: ${message}`);
        else if (stallAnswer(payload) === null) problem('The market stall: no basket meets the goal');
      }
    } else {
      const payload = readCoinPayload(segment.payload);
      if (!payload) problem('The coin stack payload must be { piece, value, goal, step, max } with a coin or bill and an amount or height goal');
      else { const message = coinProblem(payload); if (message) problem(`The coin stack: ${message}`); }
    }
  }
  return problems;
}

export const space1 = {
  id: 'space1',
  capabilities: SPACE1_CAPABILITIES,
  guidance: SPACE1_GUIDANCE,
  gates: space1Gates,
} as const satisfies ForgeHorizontePack;
