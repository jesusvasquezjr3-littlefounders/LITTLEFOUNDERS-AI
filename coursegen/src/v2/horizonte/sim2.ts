import type { GateProblem } from '../../pipeline/gates.js';
import type { ForgeGuidance, ForgeHorizontePack } from './types.js';

export const SIM2_CAPABILITIES = {
  'money.life-sim.v2': ['visual.life-sim.v1', 'operation.seeded-run.v1', 'operation.parameter-slider.v1', 'operation.show-table.v1'],
} as const;

const LIFE = 'money.life-sim.v2';

const SIM2_GUIDANCE: readonly ForgeGuidance[] = [
  {
    type: LIFE,
    lines: [
      `${LIFE}: ages 13-17 and the adult pathway. One of four scenarios (portfolio, retirement, insurance, life) lived for 2 to 5 chapters, 100 seeded futures at a time. The learner moves one slider over 3 to 8 rising choices and watches all 100 futures; the run is graded by replaying the server seed.`,
      `${LIFE}: the payload carries the start (cash, debt, flow), the finish a future must reach, the floor its cash must stay above, the goal (50 to 99 futures out of 100), the rising choices and the start choice. It never carries the answer: the key is the list of choices that reach the goal reliably.`,
      `${LIFE}: portfolio choices are stock shares in percent, retirement choices are whole amounts spent each chapter, insurance choices are covered percents, life choices are the percent of pay sent to debt. Debt is 0 for every scenario but life, where it is at least 1.`,
      `${LIFE}: the answer rule is the highest reliable choice for portfolio and retirement, the lowest for insurance and every reliable choice for life. Every other choice must be a clear miss: a choice that reaches the goal only by luck is refused, and so is a start choice that is already an answer.`,
      `${LIFE}: the prompt writes the goal in digits ("90 of 100 futures") and names what to pick, never the choice itself. Keep money whole and in the generic currency; no brand, bank or real fund.`,
    ],
  },
];

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
export const inRange = (value: unknown, low: number, high: number): value is number => whole(value) && value >= low && value <= high;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const hasOnly = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

/* Mirrored from backend/src/services/horizonte/sim2/model.ts. */
export type Scenario = 'portfolio' | 'retirement' | 'insurance' | 'life';
const SCENARIOS: readonly Scenario[] = ['portfolio', 'retirement', 'insurance', 'life'];
const MONEY_MAX = 1_000_000;
const TARGET_MAX = 10_000_000;
export const FUTURES = 100;
export const OUTCOMES = 8;
const PERIODS_MIN = 2;
const PERIODS_MAX = 5;
const CHOICES_MIN = 3;
const CHOICES_MAX = 8;
const GOAL_MIN = 50;
const GOAL_MAX = 99;
export const SOLVE_TAIL = 1e-5;
export const MISS_TAIL = 1e-4;
const BOND_PCT = 10;
const PREMIUM_PER_POINT = 20;
const DEBT_PCT = 25;
const SAVE_PCT = 2;
const OUTCOME_TABLE: Readonly<Record<Scenario, readonly number[]>> = {
  portfolio: [-30, -8, 6, 16, 26, 36, 50, 72],
  retirement: [-18, -6, 3, 8, 12, 17, 24, 34],
  insurance: [0, 0, 0, 0, 400, 1000, 3000, 9000],
  life: [0, 0, 0, 0, 300, 700, 1500, 3500],
};
export const ANSWER_RULE: Readonly<Record<Scenario, 'all' | 'highest' | 'lowest'>> = { portfolio: 'highest', retirement: 'highest', insurance: 'lowest', life: 'all' };
const PAYLOAD_KEYS = ['scenario', 'periods', 'cash', 'debt', 'flow', 'finish', 'floor', 'goal', 'choices', 'start'] as const;

export type Payload = { scenario: Scenario; periods: number; cash: number; debt: number; flow: number; finish: number; floor: number; goal: number; choices: number[]; start: number };
type Books = readonly [cash: number, debt: number];

const pct = (amount: number, percent: number): number => Math.trunc((amount * percent) / 100);

function advance(scenario: Scenario, flow: number, books: Books, choice: number, outcome: number): Books {
  const [cash, debt] = books;
  const effect = OUTCOME_TABLE[scenario][outcome] as number;
  if (scenario === 'portfolio') {
    const wealth = cash + flow;
    const stock = pct(wealth, choice);
    const bond = wealth - stock;
    return [stock + pct(stock, effect) + bond + pct(bond, BOND_PCT), 0];
  }
  if (scenario === 'retirement') {
    const left = Math.max(0, cash + flow - choice);
    return [left + pct(left, effect), 0];
  }
  if (scenario === 'insurance') return [cash + flow - choice * PREMIUM_PER_POINT - pct(effect, 100 - choice), 0];
  const toDebt = Math.min(debt, pct(flow, choice));
  let cashNow = cash + (flow - toDebt) - effect;
  let debtNow = debt - toDebt;
  if (cashNow < 0) { debtNow -= cashNow; cashNow = 0; }
  return [cashNow + pct(cashNow, SAVE_PCT), debtNow + pct(debtNow, DEBT_PCT)];
}

const worth = (books: Books): number => books[0] - books[1];
const cushion = (scenario: Scenario, books: Books): number => (scenario === 'life' ? books[0] : worth(books));
const succeeded = (payload: Payload, final: number, lowest: number): boolean => final >= payload.finish && lowest >= payload.floor;

export function waysOf(payload: Payload, choice: number): number {
  const visitHistory = (books: Books, lowest: number, period: number): number => {
    if (period === payload.periods) return succeeded(payload, worth(books), lowest) ? 1 : 0;
    let total = 0;
    for (let outcome = 0; outcome < OUTCOMES; outcome += 1) {
      const next = advance(payload.scenario, payload.flow, books, choice, outcome);
      total += visitHistory(next, Math.min(lowest, cushion(payload.scenario, next)), period + 1);
    }
    return total;
  };
  return visitHistory([payload.cash, payload.debt], Number.POSITIVE_INFINITY, 0);
}

export function reachChance(ways: number, total: number, goal: number): number {
  const q = ways / total;
  const mass = new Array<number>(FUTURES + 1).fill(0);
  mass[0] = 1;
  for (let trial = 0; trial < FUTURES; trial += 1) {
    for (let hits = trial + 1; hits >= 0; hits -= 1) mass[hits] = (mass[hits] as number) * (1 - q) + (hits > 0 ? (mass[hits - 1] as number) * q : 0);
  }
  let tail = 0;
  for (let hits = goal; hits <= FUTURES; hits += 1) tail += mass[hits] as number;
  return Math.min(1, tail);
}

export function analyseChoices(payload: Payload): { reach: number[]; reliable: number[]; answers: number[]; borderline: number | undefined } {
  const total = OUTCOMES ** payload.periods;
  const reach = payload.choices.map((choice) => reachChance(waysOf(payload, choice), total, payload.goal));
  const reliable = payload.choices.filter((_, index) => (reach[index] as number) >= 1 - SOLVE_TAIL);
  const rule = ANSWER_RULE[payload.scenario];
  const answers = rule === 'highest' ? reliable.slice(-1) : rule === 'lowest' ? reliable.slice(0, 1) : reliable;
  const borderline = payload.choices.find((_, index) => (reach[index] as number) > MISS_TAIL && (reach[index] as number) < 1 - SOLVE_TAIL);
  return { reach, reliable, answers, borderline };
}

export function analyse(payload: Payload): { answers: number[]; problem: string | null } {
  const { answers, borderline } = analyseChoices(payload);
  if (answers.length === 0) return { answers, problem: 'No choice reaches the goal reliably' };
  if (borderline !== undefined) return { answers, problem: `The choice ${borderline} reaches the goal by luck, so it is neither an answer nor a clear miss` };
  if (answers.includes(payload.start)) return { answers, problem: 'The start choice already solves the piece' };
  return { answers, problem: null };
}

function isChoices(scenario: Scenario, value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length < CHOICES_MIN || value.length > CHOICES_MAX) return false;
  const high = scenario === 'retirement' ? MONEY_MAX : 100;
  return value.every((choice, index) => inRange(choice, 0, high) && (index === 0 || choice > (value[index - 1] as number)));
}

export function payloadProblem(value: unknown): string | null {
  if (!hasOnly(value, PAYLOAD_KEYS)) return 'The payload has exactly the fields scenario, periods, cash, debt, flow, finish, floor, goal, choices and start';
  const scenario = value.scenario as Scenario;
  if (!SCENARIOS.includes(scenario)) return 'The scenario is portfolio, retirement, insurance or life';
  if (!inRange(value.periods, PERIODS_MIN, PERIODS_MAX)) return 'The run is 2 to 5 chapters';
  if (!inRange(value.cash, 0, MONEY_MAX) || !inRange(value.flow, 0, MONEY_MAX)) return 'The cash and the money in each chapter are whole amounts up to 1000000';
  if (!(scenario === 'life' ? inRange(value.debt, 1, MONEY_MAX) : value.debt === 0)) return 'Only a life piece carries debt, and it carries some';
  if (!inRange(value.finish, 0, TARGET_MAX) || !inRange(value.floor, 0, MONEY_MAX)) return 'The finish and the floor are whole amounts';
  if (!inRange(value.goal, GOAL_MIN, GOAL_MAX)) return 'The goal is 50 to 99 futures out of 100';
  if (!isChoices(scenario, value.choices)) return 'The choices are 3 to 8 rising whole values: percents up to 100, or amounts for a retirement';
  if (!value.choices.includes(value.start as number)) return 'The start is one of the choices';
  return null;
}

const namesNumber = (prompt: unknown, value: unknown): boolean =>
  typeof prompt === 'string' && whole(value) && new RegExp(`(?<![\\d.,])${value}(?!\\d|[.,]\\d)`).test(prompt);

/** Gate 4 (solvability), hand-mirrored from Core: the key is the exact answer set of the payload, and no choice is left to luck. */
function sim2Gates(document: { segments?: unknown }, answerKeys?: Record<string, unknown>): GateProblem[] {
  const problems: GateProblem[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as Array<Record<string, unknown>>) : [];
  for (const segment of segments) {
    if (segment.type !== LIFE) continue;
    const segmentId = typeof segment.id === 'string' ? segment.id : '(segment)';
    const report = (message: string): void => { problems.push({ gate: 4, segmentId, message }); };
    if ((segment.visual as { type?: unknown } | undefined)?.type !== 'life-sim') report(`The ${LIFE} visual must be life-sim`);
    const payload = segment.payload;
    const shape = payloadProblem(payload);
    if (shape) { report(shape); continue; }
    const setup = payload as Payload;
    const analysis = analyse(setup);
    if (analysis.problem) { report(analysis.problem); continue; }
    if (!namesNumber(segment.prompt, setup.goal)) report('The life prompt must write the goal number of futures in digits');
    const key = answerKeys && Object.hasOwn(answerKeys, segmentId) ? (answerKeys[segmentId] as { target?: unknown } | null) : undefined;
    if (key === undefined) continue;
    const target = hasOnly(key, ['target']) ? key.target : undefined;
    const answers = hasOnly(target, ['answers']) ? target.answers : undefined;
    if (!Array.isArray(answers) || answers.length !== analysis.answers.length || !answers.every((answer, index) => answer === analysis.answers[index])) {
      report(`The life target must be the answers ${analysis.answers.join(', ')}, every choice that reaches the goal reliably under the scenario rule`);
    }
  }
  return problems;
}

export const sim2 = {
  id: 'sim2',
  capabilities: SIM2_CAPABILITIES,
  guidance: SIM2_GUIDANCE,
  gates: sim2Gates,
} as const satisfies ForgeHorizontePack;
