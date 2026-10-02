import type { GateProblem } from '../../pipeline/gates.js';
import {
  asRecord, budgetIssue, checkRubricCoverage, issue, registerSolvabilityChecker, result, searchAssignments,
  type SolvabilityChecker, type SolvabilityIssue,
} from '../solvability.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const ALG1_CAPABILITIES = {
  'math.algebra-tiles.v2': ['visual.algebra-tiles.v1', 'operation.drag-chips.v1', 'operation.pair-tiles.v1', 'visual.math-notation.v1'],
  'math.algebra-cards.v2': ['visual.algebra-cards.v1', 'operation.drag-chips.v1', 'operation.balance-cards.v1', 'visual.math-notation.v1'],
  'math.area-model.v2': ['visual.area-model.v1', 'operation.drag-chips.v1', 'operation.fill-cells.v1', 'visual.math-notation.v1'],
} as const;

const TILES = 'math.algebra-tiles.v2';
const CARDS = 'math.algebra-cards.v2';
const AREA = 'math.area-model.v2';
const MAX_ANSWERS = 8;

const ALG1_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: TILES,
    lines: [
      `${TILES}: ages 11-15. The payload is the six tile counts (sq-pos, sq-neg, bar-pos, bar-neg, unit-pos, unit-neg), each 0 to 12 and 24 tiles at most, with at least one positive tile that has a negative twin of the same kind. Never write the zero pairs in the payload.`,
      `${TILES}: notation.tex is the tiles written kind by kind, positive then negative (2x^2-x^2+3x-4x+2-2), and notation.spokenText says it in the lesson language. Use the signed-tiles visual when only 1 tiles are present and algebra-tiles otherwise. The prompt asks what stays on the mat once the zero pairs are set aside.`,
      `${TILES}: the private key is { solutions: [{ mat, zero }] } with class ids and exactly one solution: every zero pair in zero, the remaining tiles on mat.`,
    ],
  },
  {
    type: CARDS,
    lines: [
      `${CARDS}: ages 10-14. A card is unk, unk-neg, pos-1 to pos-9 or neg-1 to neg-9. One to four cards a side, up to six supply cards. The goal is the unknown alone on one side with every other card reduced; the key lists each reachable isolation as { left, right } class lists.`,
      `${CARDS}: the disguise fades within a lesson: picture first, then mixed, then notation, never back. Mixed and notation segments carry notation.tex equal to the equation the cards make (left side, =, right side, the first plus dropped: x+3=7). Only picture may omit the notation.`,
      `${CARDS}: a supply card goes onto both sides at once and a card meets its opposite on one side and both leave. Never ask for multiplication or division. The prompt names the goal (get the box or x alone), never the answer.`,
    ],
  },
  {
    type: AREA,
    lines: [
      `${AREA}: ages 13-17. A face is degree:coefficient, so 1:3 is 3x and 0:-2 is -2; coefficients stay within 99 and degrees within 2. Fill cells places the products of a(b+c) or (x+a)(x+b), fill edges places the factors of four given products, fill square places the corner and the constant of x^2+bx+c.`,
      `${AREA}: the pool holds every right piece plus distractors, 2 to 10 faces. notation.tex is the problem exactly as the board shows it: 3(x+4), (x+2)(x+3), x^2+5x+6. Visual: area-distribute for one row, area-binomial for two rows or edges, area-square for square.`,
      `${AREA}: the key is { solutions: [slotMap] } with class faces per slot: cell-r-c for cells, row-0 row-1 col-0 col-1 for edges, corner and constant for square. One to eight right placements, all listed.`,
    ],
  },
];

type SlotMap = Record<string, string[]>;
const whole = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const compact = (text: string): string => text.replace(/\s+/g, '');
const rep = (count: number, face: string): string[] => Array.from({ length: count }, () => face);
const canonical = (solution: SlotMap, slots: readonly string[]): string => slots.map((slot) => `${slot}=${[...(solution[slot] ?? [])].sort().join(',')}`).join(';');

/** The pool holds the needed faces, counting repeats. */
function covers(pool: readonly string[], needed: readonly string[]): boolean {
  const left = new Map<string, number>();
  for (const face of pool) left.set(face, (left.get(face) ?? 0) + 1);
  for (const face of needed) {
    const count = left.get(face) ?? 0;
    if (count < 1) return false;
    left.set(face, count - 1);
  }
  return true;
}

/** The private key against what the public payload allows: every derived answer accepted, every accepted answer derived. */
function keyIssues(subject: string, derived: readonly SlotMap[], slots: readonly string[], answerKey: unknown): SolvabilityIssue[] {
  const record = asRecord(answerKey);
  const list = record && Array.isArray(record.solutions) ? record.solutions : null;
  if (!record || !list || Object.keys(record).some((name) => name !== 'solutions' && name !== 'ordered') || list.length < 1 || list.length > MAX_ANSWERS) {
    return [issue('impossible-state', `${subject}: the rubric must be { solutions } with one to ${MAX_ANSWERS} solutions`)];
  }
  const accepted: string[] = [];
  for (const raw of list) {
    const entry = asRecord(raw);
    if (!entry || Object.keys(entry).some((slot) => !slots.includes(slot)) || !Object.values(entry).every(strings)) {
      return [issue('impossible-state', `${subject}: each solution must name only ${slots.join(' and ')}, each a list of class ids`)];
    }
    accepted.push(canonical(entry as SlotMap, slots));
  }
  const reachable = new Set(derived.map((solution) => canonical(solution, slots)));
  return checkRubricCoverage([...reachable], new Set(accepted), { subject, isSolution: (key) => reachable.has(key) });
}

interface Derived { solutions: SlotMap[]; budgetExceeded: boolean; nodes: number; capped: boolean }
const exact = (solutions: SlotMap[]): Derived => ({ solutions, budgetExceeded: false, nodes: 1, capped: false });

function judge(subject: string, found: Derived, slots: readonly string[], answerKey: unknown): ReturnType<typeof result> {
  const stats = { solutions: found.solutions.length, nodes: found.nodes };
  if (found.solutions.length === 0) {
    return result([found.budgetExceeded ? budgetIssue(subject, found.nodes, 'that a solution exists') : issue('no-solution', `${subject}: no placement of these pieces is right, so the learner cannot succeed`)], stats);
  }
  if (found.capped || found.solutions.length > MAX_ANSWERS) return result([issue('too-large', `${subject}: more than ${MAX_ANSWERS} right answers; narrow the pool so the key can list them all`)], stats);
  if (found.budgetExceeded) return result([budgetIssue(subject, found.nodes, 'that every right answer is found')], stats);
  return result(answerKey === undefined ? [] : keyIssues(subject, found.solutions, slots, answerKey), stats);
}

/* F2.1 tiles */
const TILE_CLASSES = ['sq-pos', 'sq-neg', 'bar-pos', 'bar-neg', 'unit-pos', 'unit-neg'] as const;
const TILE_KINDS = ['sq', 'bar', 'unit'] as const;
type TileCounts = Record<(typeof TILE_CLASSES)[number], number>;
const TILE_FACE = { sq: 'x^2', bar: 'x', unit: '1' } as const;

function readTiles(value: unknown): { counts: TileCounts } | { problem: string; code: 'impossible-state' | 'no-solution' } {
  const record = asRecord(value);
  if (!record || Object.keys(record).length !== TILE_CLASSES.length || !TILE_CLASSES.every((cls) => whole(record[cls], 0, 12))) {
    return { problem: 'the tiles are exactly the six counts sq-pos, sq-neg, bar-pos, bar-neg, unit-pos and unit-neg, each a whole number from 0 to 12', code: 'impossible-state' };
  }
  const counts = record as unknown as TileCounts;
  if (TILE_CLASSES.reduce((sum, cls) => sum + counts[cls], 0) > 24) return { problem: 'the mat holds at most 24 tiles', code: 'impossible-state' };
  if (TILE_KINDS.every((kind) => Math.min(counts[`${kind}-pos`], counts[`${kind}-neg`]) === 0)) return { problem: 'no positive tile has a negative twin of the same kind, so there is no zero pair to set aside', code: 'no-solution' };
  return { counts };
}

function tilesTex(counts: TileCounts): string {
  const terms = TILE_KINDS.flatMap((kind) => (['pos', 'neg'] as const).flatMap((sign) => {
    const count = counts[`${kind}-${sign}`];
    if (count === 0) return [];
    return [`${sign === 'pos' ? '+' : '-'}${kind === 'unit' ? count : `${count === 1 ? '' : count}${TILE_FACE[kind]}`}`];
  }));
  return terms.join('').replace(/^\+/, '');
}

function tilesAnswer(counts: TileCounts): SlotMap {
  const mat: string[] = []; const zero: string[] = [];
  for (const kind of TILE_KINDS) {
    const pos = counts[`${kind}-pos`]; const neg = counts[`${kind}-neg`]; const pairs = Math.min(pos, neg);
    zero.push(...rep(pairs, `${kind}-pos`), ...rep(pairs, `${kind}-neg`));
    mat.push(...rep(pos - pairs, `${kind}-pos`), ...rep(neg - pairs, `${kind}-neg`));
  }
  return { mat, zero };
}

const tilesChecker: SolvabilityChecker = (segment, context) => {
  const subject = `algebra tiles ${segment.id}`;
  const read = readTiles(asRecord(segment.payload)?.counts);
  if (!('counts' in read)) return result([issue(read.code, `${subject}: ${read.problem}`)]);
  return judge(subject, exact([tilesAnswer(read.counts)]), ['mat', 'zero'], context.answerKey);
};

/* F2.2 cards */
const DISGUISE_ORDER = ['picture', 'mixed', 'notation'] as const;
const CARD_FACE = /^(unk|unk-neg|(?:pos|neg)-[1-9])$/;
interface Cards { disguise: (typeof DISGUISE_ORDER)[number]; left: string[]; right: string[]; supply: string[] }

function readCards(value: unknown): Cards | string {
  const record = asRecord(value);
  if (!record || Object.keys(record).sort().join() !== 'disguise,left,right,supply' || !DISGUISE_ORDER.includes(record.disguise as never)) return 'the cards are { disguise, left, right, supply }';
  const faces = (list: unknown, minimum: number, maximum: number): string[] | null =>
    Array.isArray(list) && list.length >= minimum && list.length <= maximum && list.every((face) => typeof face === 'string' && CARD_FACE.test(face)) ? [...list] as string[] : null;
  const left = faces(record.left, 1, 4); const right = faces(record.right, 1, 4); const supply = faces(record.supply, 0, 6);
  return left && right && supply ? { disguise: record.disguise as Cards['disguise'], left, right, supply } : 'each side is one to four cards and the supply up to six, each unk, unk-neg, pos-1 to pos-9 or neg-1 to neg-9';
}

const cardSlot = (face: string): [string, number] => (face.startsWith('unk') ? ['x', face === 'unk' ? 1 : -1] : [face.slice(4), face.startsWith('pos-') ? 1 : -1]);

/** What is left of a side once every card meets its opposite. */
function reduced(faces: readonly string[]): string[] {
  const net = new Map<string, number>();
  for (const face of faces) { const [slot, sign] = cardSlot(face); net.set(slot, (net.get(slot) ?? 0) + sign); }
  return [...net].flatMap(([slot, amount]) => rep(Math.abs(amount), slot === 'x' ? (amount > 0 ? 'unk' : 'unk-neg') : `${amount > 0 ? 'pos' : 'neg'}-${slot}`)).sort();
}

const alone = (side: readonly string[]): boolean => side.length === 1 && side[0] === 'unk';

function cardOutcome(cards: Cards, used: readonly number[]): SlotMap | null {
  const extra = cards.supply.filter((_, index) => used[index] === 1);
  const left = reduced([...cards.left, ...extra]); const right = reduced([...cards.right, ...extra]);
  if (alone(left) === alone(right)) return null;
  const other = alone(left) ? right : left;
  return other.length > 0 && !other.some((face) => face.startsWith('unk')) ? { left, right } : null;
}

function cardsAnswers(cards: Cards, nodes: number): Derived {
  const slots = ['left', 'right'];
  const search = searchAssignments<number>({
    domains: cards.supply.map(() => [0, 1]),
    isSolution: (full) => cardOutcome(cards, full) !== null,
    key: (full) => canonical(cardOutcome(cards, full) ?? {}, slots),
    limit: MAX_ANSWERS + 1,
    maxNodes: nodes,
  });
  return { solutions: search.solutions.map((full) => cardOutcome(cards, full)!), budgetExceeded: search.budgetExceeded, nodes: search.nodes, capped: search.stoppedAtLimit };
}

function cardsTex(cards: Cards): string {
  const face = (card: string): string => { const [slot, sign] = cardSlot(card); return `${sign > 0 ? '+' : '-'}${slot}`; };
  const side = (list: readonly string[]): string => list.map(face).join('').replace(/^\+/, '');
  return `${side(cards.left)}=${side(cards.right)}`;
}

const cardsChecker: SolvabilityChecker = (segment, context) => {
  const subject = `algebra cards ${segment.id}`;
  const cards = readCards(segment.payload);
  if (typeof cards === 'string') return result([issue('impossible-state', `${subject}: ${cards}`)]);
  const found = cardsAnswers(cards, context.nodeBudget);
  const slots = ['left', 'right'];
  const start = canonical({ left: [...cards.left].sort(), right: [...cards.right].sort() }, slots);
  if (found.solutions.some((solution) => canonical(solution, slots) === start)) {
    return result([issue('impossible-state', `${subject}: the unknown is already alone, so there is nothing to do`)]);
  }
  return judge(subject, found, slots, context.answerKey);
};

/* F2.3 area model */
interface Term { d: number; k: number }
const TERM = /^([0-2]):(-?[1-9][0-9]?)$/;
type Area =
  | { fill: 'cells'; rows: string[]; cols: string[]; pool: string[] }
  | { fill: 'edges'; cells: string[]; pool: string[] }
  | { fill: 'square'; b: number; c: number; pool: string[] };

function term(face: string): Term | null {
  const match = TERM.exec(face);
  return match ? { d: Number(match[1]), k: Number(match[2]) } : null;
}
function times(a: string, b: string): string | null {
  const left = term(a); const right = term(b);
  return left && right && left.d + right.d <= 2 && Math.abs(left.k * right.k) <= 99 ? `${left.d + right.d}:${left.k * right.k}` : null;
}

function readArea(value: unknown): Area | string {
  const record = asRecord(value);
  const keys = record ? Object.keys(record).sort().join() : '';
  const faces = (list: unknown, minimum: number, maximum: number, degree: number): string[] | null =>
    Array.isArray(list) && list.length >= minimum && list.length <= maximum && list.every((face) => typeof face === 'string' && (term(face)?.d ?? 9) <= degree) ? [...list] as string[] : null;
  if (record?.fill === 'cells' && keys === 'cols,fill,pool,rows') {
    const rows = faces(record.rows, 1, 2, 1); const cols = faces(record.cols, 2, 3, 1); const pool = faces(record.pool, 2, 10, 2);
    if (rows && cols && pool && (rows.length === 1 || cols.length === 2)) return { fill: 'cells', rows, cols, pool };
    return 'cells needs one or two rows and two or three columns (two rows only with two columns), each a term of degree 1 or less, and a pool of 2 to 10 faces';
  }
  if (record?.fill === 'edges' && keys === 'cells,fill,pool') {
    const cells = faces(record.cells, 4, 4, 2); const pool = faces(record.pool, 4, 10, 1);
    if (cells && pool) return { fill: 'edges', cells, pool };
    return 'edges needs four product faces of degree 2 or less and a pool of 4 to 10 faces of degree 1 or less';
  }
  if (record?.fill === 'square' && keys === 'b,c,fill,pool') {
    const pool = faces(record.pool, 2, 8, 0);
    const { b, c } = record;
    if (pool && whole(b, 2, 18) && b % 2 === 0 && whole(c, -30, 30) && c !== (b / 2) ** 2) return { fill: 'square', b, c, pool };
    return 'square needs an even b from 2 to 18, a whole c from -30 to 30 that is not (b/2)^2, and a pool of 2 to 8 numbers';
  }
  return 'the area model is { fill: cells | edges | square, ... } with that fill\'s fields';
}

function termText(face: string, lead: boolean): string {
  const { d, k } = term(face)!;
  const magnitude = Math.abs(k);
  return `${k < 0 ? '-' : lead ? '' : '+'}${d === 0 ? magnitude : `${magnitude === 1 ? '' : magnitude}${d === 1 ? 'x' : 'x^2'}`}`;
}
const run = (faces: readonly string[]): string => faces.map((face, index) => termText(face, index === 0)).join('');

function areaTex(area: Area): string {
  if (area.fill === 'cells') return area.rows.length === 1 ? `${run(area.rows)}(${run(area.cols)})` : `(${run(area.rows)})(${run(area.cols)})`;
  if (area.fill === 'square') return run(['2:1', `1:${area.b}`, ...(area.c === 0 ? [] : [`0:${area.c}`])]);
  return run([2, 1, 0].map((degree) => `${degree}:${area.cells.reduce((sum, face) => sum + (term(face)!.d === degree ? term(face)!.k : 0), 0)}`).filter((face) => !face.endsWith(':0')));
}

function areaAnswers(area: Area, nodes: number): Derived {
  if (area.fill === 'square') {
    const half = area.b / 2;
    const constant = `0:${area.c - half * half}`;
    const pieces = [`0:${half * half}`, constant];
    return exact(term(constant) !== null && covers(area.pool, pieces) ? [{ corner: [pieces[0]!], constant: [constant] }] : []);
  }
  if (area.fill === 'cells') {
    const solution: SlotMap = {}; const needed: string[] = [];
    for (const [row, rowFace] of area.rows.entries()) for (const [col, colFace] of area.cols.entries()) {
      const product = times(rowFace, colFace);
      if (product === null) return exact([]);
      needed.push(product); solution[`cell-${row}-${col}`] = [product];
    }
    return exact(covers(area.pool, needed) ? [solution] : []);
  }
  const faces = [...new Set(area.pool)];
  const search = searchAssignments<string>({
    domains: [faces, faces, faces, faces],
    accept: (partial) => covers(area.pool, partial),
    isSolution: ([row0, row1, col0, col1]) => times(row0!, col0!) === area.cells[0] && times(row0!, col1!) === area.cells[1] && times(row1!, col0!) === area.cells[2] && times(row1!, col1!) === area.cells[3],
    limit: MAX_ANSWERS + 1,
    maxNodes: nodes,
  });
  return {
    solutions: search.solutions.map(([row0, row1, col0, col1]) => ({ 'row-0': [row0!], 'row-1': [row1!], 'col-0': [col0!], 'col-1': [col1!] })),
    budgetExceeded: search.budgetExceeded, nodes: search.nodes, capped: search.stoppedAtLimit,
  };
}

const areaSlotNames = (area: Area): string[] =>
  area.fill === 'square' ? ['corner', 'constant'] : area.fill === 'edges' ? ['row-0', 'row-1', 'col-0', 'col-1']
    : area.rows.flatMap((_, row) => area.cols.map((__, col) => `cell-${row}-${col}`));

const areaChecker: SolvabilityChecker = (segment, context) => {
  const subject = `area model ${segment.id}`;
  const area = readArea(segment.payload);
  if (typeof area === 'string') return result([issue('impossible-state', `${subject}: ${area}`)]);
  return judge(subject, areaAnswers(area, context.nodeBudget), areaSlotNames(area), context.answerKey);
};

registerSolvabilityChecker(TILES, tilesChecker);
registerSolvabilityChecker(CARDS, cardsChecker);
registerSolvabilityChecker(AREA, areaChecker);

/** Gate 4: each board is well formed, its visual and notation say what its payload holds, and the cards fade in order. The private key is judged by the solvability checkers above. */
function alg1Gates(document: { segments?: unknown }): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  let faded = 0;
  for (const segment of segments) {
    const type = segment.type;
    if (type !== TILES && type !== CARDS && type !== AREA) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const problem = (message: string): void => { problems.push({ gate: 4, segmentId, message }); };
    const payload = asRecord(segment.payload);
    const visual = asRecord(segment.visual)?.type;
    const notation = asRecord(segment.notation);
    const tex = typeof notation?.tex === 'string' ? compact(notation.tex) : null;
    const expectTex = (expected: string, label: string): void => {
      if (tex !== null && tex !== expected) problem(`The ${label} notation must be the board written as an expression: ${expected}`);
    };
    if (type === TILES) {
      const read = readTiles(payload?.counts);
      if (!('counts' in read)) { problem(`The algebra tiles: ${read.problem}`); continue; }
      const unitsOnly = TILE_CLASSES.filter((cls) => !cls.startsWith('unit')).every((cls) => read.counts[cls] === 0);
      if (visual !== (unitsOnly ? 'signed-tiles' : 'algebra-tiles')) problem(`The tiles visual must be ${unitsOnly ? 'signed-tiles (only 1 tiles)' : 'algebra-tiles'}`);
      if (tex === null) problem('The algebra tiles need a notation with tex and spokenText');
      else expectTex(tilesTex(read.counts), 'tiles');
    } else if (type === CARDS) {
      const cards = readCards(payload);
      if (typeof cards === 'string') { problem(`The algebra cards: ${cards}`); continue; }
      if (visual !== 'algebra-cards') problem('The cards visual must be algebra-cards');
      if (cards.disguise !== 'picture' && tex === null) problem('Only the picture disguise may leave the notation out');
      else expectTex(cardsTex(cards), 'cards');
      const rank = DISGUISE_ORDER.indexOf(cards.disguise);
      if (rank < faded) problem('The card disguise fades in order: picture, then mixed, then notation, never back');
      faded = Math.max(faded, rank);
    } else {
      const area = readArea(payload);
      if (typeof area === 'string') { problem(`The area model: ${area}`); continue; }
      const expected = area.fill === 'square' ? 'area-square' : area.fill === 'cells' && area.rows.length === 1 ? 'area-distribute' : 'area-binomial';
      if (visual !== expected) problem(`The area model visual must be ${expected}`);
      if (tex === null) problem('The area model needs a notation with tex and spokenText');
      else expectTex(areaTex(area), 'area model');
    }
  }
  return problems;
}

export const alg1 = {
  id: 'alg1',
  capabilities: ALG1_CAPABILITIES,
  guidance: ALG1_GUIDANCE,
  gates: alg1Gates,
} as const satisfies ForgeHorizontePack;
