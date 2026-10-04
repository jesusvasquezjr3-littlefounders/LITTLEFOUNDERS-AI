import type { GateProblem } from '../../pipeline/gates.js';
import type { V2DocumentLike } from '../gates.js';
import {
  asRecord, checkRubricCoverage, issue, registerSolvabilityChecker, result, type SolvabilityChecker, type SolvabilityIssue,
} from '../solvability.js';
import {
  globeKey, globeProblem, isFlatSurface, optionCents, PLACE_IDS, readArPayload, readGlobePayload, readSurfacePayload,
  surfaceKey, surfaceProblem, type GlobePayload, type SurfacePayload,
} from './space2Geometry.js';
import {
  answerCount, formulaKey, formulaProblem, ratText, readFormulaPayload, throughCount, type FormulaPayload,
} from './space2Formula.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const SPACE2_CAPABILITIES = {
  'math.surface.v2': ['visual.surface.v1', 'operation.read-surface.v1', 'operation.slice-surface.v1'],
  'math.surface-formula.v2': ['visual.surface-formula.v1', 'operation.read-partials.v1', 'operation.walk-gradient.v1'],
  'geography.globe-route.v2': ['visual.globe-route.v1', 'operation.rotate-globe.v1', 'operation.compare-routes.v1'],
  'space.ar-table.v2': ['visual.ar-table.v1', 'operation.view-object.v1', 'operation.optional-ar.v1'],
} as const;

const SURFACE = 'math.surface.v2';
const FORMULA = 'math.surface-formula.v2';
const GLOBE = 'geography.globe-route.v2';
const AR = 'space.ar-table.v2';
const PROMPT_WORDS = 24;

const SPACE2_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: SURFACE,
    lines: [
      `${SURFACE}: ages 15 and up (a 13-17 lesson of it carries an eligibility of 15). A surface is a third real variable: two inputs make one output. surface is either { kind: "compound", principalCents, ratesBps: 3 to 6 rising rates in basis points (0 to 1500), terms: 3 to 7 rising years (0 to 40) } for compound interest, or { kind: "profit", unitCostCents, fixedCents, prices: 3 to 6 rising prices in cents, units: 3 to 7 rising quantities } for profit. Money is whole cents; a year of interest is rounded half up to the cent.`,
      `${SURFACE}: ask is { kind: "highest" }, { kind: "lowest" } or { kind: "reach", targetCents }. options lists 2 to 4 cells { id: a, b, c, d in order, x, y } as positions on the grid (x indexes the first input, y the second), all different. Exactly one option must be the highest, the lowest, or the only one that reaches the target; the surface must not be flat.`,
      `${SURFACE}: the key is { choice: the id of that option }. The prompt is at most two imperative sentences that name the quantity and the question, and never the amount or the winner. Teach that time can beat rate: pick options where the longer term with the smaller rate wins.`,
    ],
  },
  {
    type: FORMULA,
    lines: [
      `${FORMULA}: ages 15 and up (a 13-17 lesson of it carries an eligibility of 15). A free-form surface z = f(x, y) typed as text: the board reads it with a bounded parser and never runs it as code. payload is exactly { window: { xMin, xMax, yMin, yMax }, task }; the window holds whole numbers from -9 to 9 and spans 2 to 8 steps on each side.`,
      `${FORMULA}: task is one of { kind: "slope", expression, axis: "x" or "y", at: { x, y } } (how steep the surface is along one axis at the dot), { kind: "gradient", expression, at } (both slopes, x first, then y), { kind: "walk", expression, at, rate: { n, d }, below, maxSteps: 3 to 12 } (walk downhill, each step moving by rate times the slope, and count the steps until the height is at or below the whole number below), or { kind: "build", through: 2 or 3 points { x, y, z } } (the learner types a formula whose surface passes through every point). The dot and the points sit on whole positions inside the window, all different.`,
      `${FORMULA}: an expression is at most 48 characters made of x, y, numbers of at most 6 digits (a point or a comma for decimals), + - * / ^ and brackets, with 2x, xy and 2(x+1) meaning a product. A power is one whole number from 0 to 6 and never chained. No other letter, name, symbol or function is allowed. It must be defined at every whole point of the window (no division by something that reaches zero) and the surface must not be flat.`,
      `${FORMULA}: the key is private and the prompt never writes it. For a slope, a gradient or a walk it is { key: [one exact decimal text per box] }: one text for a slope or a walk, two for a gradient (x slope, then y slope), each a number a learner can type exactly (at most 3 decimals, never above 100000) such as "6" or "-1.25". For a build it is { reference: a formula that passes through every point }, which proves the task can be solved. A walk must start above the line, stay inside the window, take at least 2 steps and reach the line within maxSteps.`,
      `${FORMULA}: the prompt is at most two imperative sentences that name the question and, for a walk, the step rate and the line in the same numbers as the payload. It never gives a slope, an answer or the reference formula. Teach that the slope is how fast the height changes along one axis at a time, and that stepping downhill with it finds the low point.`,
    ],
  },
  {
    type: GLOBE,
    lines: [
      `${GLOBE}: ages 12 and up (a 10-12 lesson of it carries an eligibility of 12). routes lists 2 to 4 remittance routes { id: a, b, c, d in order, from, to, feeBps (0 to 2000), flatCents (0 to 5000) }; from and to are place ids from ${PLACE_IDS.join(', ')} and must differ. sendCents (1000 to 500000) is the amount sent, in whole cents. Each corridor is listed once.`,
      `${GLOBE}: ask is shortest, longest or cheapest. The fee of a route is round half up (sendCents x feeBps / 10000) plus flatCents; the distance is the great-circle distance in whole kilometres. Exactly one route must win: the lowest fee with no tie, or a distance ahead of the next route by at least 2 percent, so a rounding difference never changes the answer.`,
      `${GLOBE}: the key is { choice: the id of that route }. The prompt is at most two imperative sentences that name the amount sent and the question, and never the winner. A cheapest question works best when the shortest route is not the cheapest.`,
    ],
  },
  {
    type: AR,
    lines: [
      `${AR}: ages 13 and up, optional and not scored: grading is none and there is no rubric and no key. payload is exactly { object } with object one of litre-box, cereal-box, soup-can or shoebox, shown at its true size on a table, or as a turnable drawing where the device has no AR.`,
      `${AR}: the prompt is one or two imperative sentences that ask the learner to look at the object and compare it with something at home. It never asks for a photo, never mentions the camera and never asks the learner to turn the camera on; the board does that itself after consent.`,
    ],
  },
];

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
const withoutSpaces = (text: string): string => text.replace(/\s+/g, '').toLowerCase();

/** The rubric Core stores for a choice step: exactly { choice }, one string. */
function readChoice(subject: string, answerKey: unknown): { choice: string } | SolvabilityIssue {
  const record = asRecord(answerKey);
  if (!record || Object.keys(record).sort().join() !== 'choice' || typeof record.choice !== 'string') {
    return issue('impossible-state', `${subject}: the rubric must be { choice } with the id of one option`);
  }
  return { choice: record.choice };
}

const isIssue = (value: { choice: string } | SolvabilityIssue): value is SolvabilityIssue => 'code' in value;

function choiceIssues(subject: string, expected: string, answerKey: unknown): SolvabilityIssue[] {
  if (answerKey === undefined) return [];
  const read = readChoice(subject, answerKey);
  if (isIssue(read)) return [read];
  return checkRubricCoverage([expected], new Set([read.choice]), { subject, isSolution: (key) => key === expected });
}

/** A reach question no option meets has no answer; any other missing key is a tie, which is ambiguous. */
function surfaceCode(payload: SurfacePayload): 'no-solution' | 'ambiguous-solution' {
  const { ask } = payload;
  return ask.kind === 'reach' && !optionCents(payload).some((cents) => cents >= ask.targetCents) ? 'no-solution' : 'ambiguous-solution';
}

function surfaceIssues(subject: string, payload: SurfacePayload, answerKey: unknown): SolvabilityIssue[] {
  if (isFlatSurface(payload)) return [issue('impossible-state', `${subject}: the surface is flat, so no option is better than another`)];
  const key = surfaceKey(payload);
  if (key === null) return [issue(surfaceCode(payload), `${subject}: ${surfaceProblem(payload)}`)];
  return choiceIssues(subject, key, answerKey);
}

const surfaceChecker: SolvabilityChecker = (segment, context) => {
  const subject = `surface ${segment.id}`;
  const payload = readSurfacePayload(segment.payload);
  if (!payload) return result([issue('impossible-state', `${subject}: the surface payload is malformed`)]);
  return result(surfaceIssues(subject, payload, context.answerKey), { options: payload.options.length });
};

/** The one reason a formula task can have no answer at all; every other broken task is an impossible state. */
const formulaCode = (payload: FormulaPayload, problem: string): 'no-solution' | 'impossible-state' =>
  payload.task.kind === 'walk' && problem.startsWith('The walk must reach the line') ? 'no-solution' : 'impossible-state';

/** The rubric Core stores for a formula step: { key: texts } for a slope, gradient or walk, { reference } for a build. It must be the one exact answer of this payload. */
function formulaKeyIssues(subject: string, payload: FormulaPayload, answerKey: unknown): SolvabilityIssue[] {
  if (answerKey === undefined) return [];
  const record = asRecord(answerKey);
  const names = record ? Object.keys(record).sort().join() : '';
  const { task } = payload;
  if (task.kind === 'build') {
    if (!record || names !== 'reference' || typeof record.reference !== 'string') return [issue('impossible-state', `${subject}: the rubric must be { reference } with a formula`)];
    const through = throughCount(record.reference, task.through);
    if (through === null) return [issue('impossible-state', `${subject}: the reference formula does not read`)];
    return through === task.through.length ? [] : [issue('rubric-accepts-invalid', `${subject}: the reference formula passes through ${through} of ${task.through.length} points, so a correct surface would be graded wrong`)];
  }
  if (!record || names !== 'key' || !Array.isArray(record.key) || !record.key.every((text) => typeof text === 'string')) {
    return [issue('impossible-state', `${subject}: the rubric must be { key } with one exact number as text for each box`)];
  }
  const expected = (formulaKey(payload) ?? []).map(ratText);
  if (record.key.length !== expected.length) return [issue('impossible-state', `${subject}: the key needs exactly ${expected.length} number(s)`)];
  const wanted = expected.join('|');
  return checkRubricCoverage([wanted], new Set([(record.key as string[]).join('|')]), { subject, isSolution: (key) => key === wanted });
}

function formulaIssues(subject: string, payload: FormulaPayload, answerKey: unknown): SolvabilityIssue[] {
  const problem = formulaProblem(payload);
  if (problem !== null) return [issue(formulaCode(payload, problem), `${subject}: ${problem}`)];
  return formulaKeyIssues(subject, payload, answerKey);
}

const formulaChecker: SolvabilityChecker = (segment, context) => {
  const subject = `formula ${segment.id}`;
  const payload = readFormulaPayload(segment.payload);
  if (!payload) return result([issue('impossible-state', `${subject}: the formula payload is malformed`)]);
  return result(formulaIssues(subject, payload, context.answerKey), { answers: answerCount(payload.task) });
};

function globeIssues(subject: string, payload: GlobePayload, answerKey: unknown): SolvabilityIssue[] {
  if (payload.routes.some((route) => route.from === route.to)) return [issue('impossible-state', `${subject}: a route joins two different places`)];
  const corridors = payload.routes.map((route) => [route.from, route.to].sort().join('|'));
  if (new Set(corridors).size !== corridors.length) return [issue('duplicate-id', `${subject}: each corridor is listed once`)];
  const key = globeKey(payload);
  if (key === null) return [issue('ambiguous-solution', `${subject}: ${globeProblem(payload)}`)];
  return choiceIssues(subject, key, answerKey);
}

const globeChecker: SolvabilityChecker = (segment, context) => {
  const subject = `globe ${segment.id}`;
  const payload = readGlobePayload(segment.payload);
  if (!payload) return result([issue('impossible-state', `${subject}: the globe payload is malformed`)]);
  return result(globeIssues(subject, payload, context.answerKey), { routes: payload.routes.length });
};

registerSolvabilityChecker(SURFACE, surfaceChecker);
registerSolvabilityChecker(FORMULA, formulaChecker);
registerSolvabilityChecker(GLOBE, globeChecker);

const VISUALS: Readonly<Record<string, string>> = { [SURFACE]: 'surface', [FORMULA]: 'surface-formula', [GLOBE]: 'globe-route', [AR]: 'ar-table' };
const GRADING: Readonly<Record<string, string>> = { [SURFACE]: 'server', [FORMULA]: 'server', [GLOBE]: 'server', [AR]: 'none' };
/** The surfaces open at 15 and the globe at 12 in Core's eligibility; the Forge document holds the band alone. */
const BANDS: Readonly<Record<string, readonly string[]>> = {
  [SURFACE]: ['13-17', 'adult'],
  [FORMULA]: ['13-17', 'adult'],
  [GLOBE]: ['10-12', '13-17', 'adult'],
  [AR]: ['13-17', 'adult'],
};

/** Gate 4: each board is well formed, its visual says what it holds, its question has exactly one answer, and the AR step is never scored. The private key is judged by the solvability checkers above. */
function space2Gates(document: V2DocumentLike, answerKeys?: Record<string, unknown>): GateProblem[] {
  const problems: GateProblem[] = [];
  const band = typeof document.age_band === 'string' ? document.age_band : null;
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    const type = segment.type;
    if (typeof type !== 'string' || !Object.hasOwn(VISUALS, type)) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const problem = (message: string): void => { problems.push({ gate: 4, segmentId, message }); };
    if (asRecord(segment.visual)?.type !== VISUALS[type]) problem(`The ${VISUALS[type]} board needs the visual type ${VISUALS[type]}`);
    if (segment.grading !== GRADING[type]) problem(GRADING[type] === 'none' ? 'The AR table step is not scored: its grading is none' : `The ${VISUALS[type]} board is graded on Core: its grading is server`);
    if (band !== null && !BANDS[type]!.includes(band)) problem(`This kind is for age band ${BANDS[type]!.join(', ')}, not ${band}`);
    if (typeof segment.prompt === 'string' && wordCount(segment.prompt) > PROMPT_WORDS) problem(`The prompt is at most ${PROMPT_WORDS} words`);
    if (type === SURFACE) {
      const payload = readSurfacePayload(segment.payload);
      if (!payload) problem('The surface payload is malformed: a compound or profit surface, an ask and 2 to 4 different options');
      else { const message = surfaceProblem(payload); if (message) problem(message); }
    } else if (type === FORMULA) {
      const payload = readFormulaPayload(segment.payload);
      if (!payload) problem('The formula payload is malformed: a window, and a slope, gradient, walk or build task with a formula that reads');
      else {
        const message = formulaProblem(payload);
        if (message) problem(message);
        const rubric = answerKeys && Object.hasOwn(answerKeys, segmentId) ? asRecord(answerKeys[segmentId]) : undefined;
        const reference = typeof rubric?.reference === 'string' ? withoutSpaces(rubric.reference) : '';
        if (reference.length >= 3 && typeof segment.prompt === 'string' && withoutSpaces(segment.prompt).includes(reference)) problem('The prompt must not write the reference formula');
      }
    } else if (type === GLOBE) {
      const payload = readGlobePayload(segment.payload);
      if (!payload) problem('The globe payload is malformed: 2 to 4 routes between listed places, an ask and an amount');
      else { const message = globeProblem(payload); if (message) problem(message); }
    } else if (!readArPayload(segment.payload)) problem('The AR payload is exactly { object } with a listed object');
  }
  return problems;
}

export const space2 = {
  id: 'space2',
  capabilities: SPACE2_CAPABILITIES,
  guidance: SPACE2_GUIDANCE,
  gates: space2Gates,
} as const satisfies ForgeHorizontePack;
