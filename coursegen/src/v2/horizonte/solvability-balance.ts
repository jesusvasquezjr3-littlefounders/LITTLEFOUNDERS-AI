import {
  asRecord, budgetIssue, checkRubricCoverage, checkUniqueIds, exploreStateSpace, isWhole, issue, registerSolvabilityChecker, result,
  type SolvabilityChecker, type SolvabilityIssue,
} from '../solvability.js';

const BALANCE = 'math.equation-balance.v2';
const ROUTE_OPS: readonly string[] = ['sub-x', 'sub-unit', 'add-unit', 'div-2', 'div-3', 'div-4', 'div-5'];
const SLIP_OPS: readonly string[] = ['slip-left', 'slip-right'];
const MAX_X = 8;
const MAX_UNITS = 30;
const MAX_ANSWER = 99;
const MAX_STEPS = 16;

interface Pan { x: number; u: number }
interface Scale { l: Pan; r: Pan }

function readPan(value: unknown): Pan | null {
  const pan = asRecord(value);
  if (!pan || Object.keys(pan).sort().join() !== 'u,x') return null;
  return isWhole(pan.x) && pan.x <= MAX_X && isWhole(pan.u) && pan.u <= MAX_UNITS ? { x: pan.x, u: pan.u } : null;
}

function readBoard(payload: Record<string, unknown>): { start: Scale; ops: string[] } | null {
  const start = asRecord(payload.start);
  if (!start || Object.keys(start).sort().join() !== 'l,r') return null;
  const l = readPan(start.l);
  const r = readPan(start.r);
  const ops = payload.ops;
  if (!l || !r || !Array.isArray(ops) || !ops.every((op) => typeof op === 'string')) return null;
  return { start: { l, r }, ops: ops as string[] };
}

const solved = ({ l, r }: Scale): boolean => (l.x === 1 && l.u === 0 && r.x === 0) || (r.x === 1 && r.u === 0 && l.x === 0);
const scaleKey = ({ l, r }: Scale): string => `${l.x},${l.u},${r.x},${r.u}`;

/** One route move on both pans at once, or null when the move is not allowed from this state. */
function step(scale: Scale, op: string): Scale | null {
  const { l, r } = scale;
  switch (op) {
    case 'sub-x': return l.x >= 1 && r.x >= 1 ? { l: { x: l.x - 1, u: l.u }, r: { x: r.x - 1, u: r.u } } : null;
    case 'sub-unit': return l.u >= 1 && r.u >= 1 ? { l: { x: l.x, u: l.u - 1 }, r: { x: r.x, u: r.u - 1 } } : null;
    case 'add-unit': return l.u < MAX_UNITS && r.u < MAX_UNITS ? { l: { x: l.x, u: l.u + 1 }, r: { x: r.x, u: r.u + 1 } } : null;
    default: {
      const n = Number(op.slice('div-'.length));
      const counts = [l.x, l.u, r.x, r.u];
      return counts.every((count) => count % n === 0) && counts.some((count) => count > 0)
        ? { l: { x: l.x / n, u: l.u / n }, r: { x: r.x / n, u: r.u / n } }
        : null;
    }
  }
}

type Answer = { kind: 'every' } | { kind: 'none' } | { kind: 'value'; x: number | null };

/** What the public pans say x is: l.x*x + l.u = r.x*x + r.u, so the key is fixed before any key exists. */
function answerOf({ l, r }: Scale): Answer {
  const slope = l.x - r.x;
  const rise = r.u - l.u;
  if (slope === 0) return rise === 0 ? { kind: 'every' } : { kind: 'none' };
  if (rise % slope !== 0) return { kind: 'value', x: null };
  const x = rise / slope;
  return { kind: 'value', x: x >= 0 && x <= MAX_ANSWER ? x : null };
}

function keyIssues(subject: string, x: number, answerKey: unknown): SolvabilityIssue[] {
  const key = asRecord(answerKey);
  if (!key || Object.keys(key).sort().join() !== 'x' || !isWhole(key.x) || key.x > MAX_ANSWER) {
    return [issue('impossible-state', `${subject}: the rubric must be { x } with x a whole number from 0 to ${MAX_ANSWER}`)];
  }
  const accepted = String(key.x);
  return checkRubricCoverage([String(x)], new Set([accepted]), { subject, isSolution: (candidate) => candidate === String(x) });
}

const balanceChecker: SolvabilityChecker = (segment, context) => {
  const subject = `equation balance ${segment.id}`;
  const board = readBoard(segment.payload);
  if (!board) return result([issue('impossible-state', `${subject}: the payload must be { start: { l, r }, ops } with x-blocks 0-${MAX_X} and units 0-${MAX_UNITS} on each pan`)]);
  const issues: SolvabilityIssue[] = [...checkUniqueIds(board.ops, `${subject} operation`)];
  const unknown = board.ops.filter((op) => !ROUTE_OPS.includes(op) && !SLIP_OPS.includes(op));
  if (unknown.length > 0) issues.push(issue('impossible-state', `${subject}: unknown operation(s) ${unknown.join(', ')}`));
  const { start } = board;
  if (start.l.x + start.r.x < 1) issues.push(issue('impossible-state', `${subject}: x is on neither pan, so there is nothing to solve for`));
  if (solved(start)) issues.push(issue('impossible-state', `${subject}: the start already has x alone, so there is nothing to solve`));
  const answer = answerOf(start);
  if (answer.kind === 'every') issues.push(issue('ambiguous-solution', `${subject}: the two pans are the same for every x, so no single x is the answer`));
  else if (answer.kind === 'none') issues.push(issue('no-solution', `${subject}: the pans differ by the same amount for every x, so no x makes them equal`));
  else if (answer.x === null) issues.push(issue('no-solution', `${subject}: the x that balances the pans is not a whole number from 0 to ${MAX_ANSWER}, so the key { x } cannot be written`));
  if (issues.length > 0) return result(issues);

  const offered = board.ops.filter((op) => ROUTE_OPS.includes(op));
  const explored = exploreStateSpace<Scale, string>({
    initial: [start],
    moves: (scale) => offered.flatMap((op) => {
      const next = step(scale, op);
      return next === null ? [] : [{ move: op, next }];
    }),
    isGoal: solved,
    key: scaleKey,
    maxNodes: context.nodeBudget,
    maxDepth: MAX_STEPS,
  });
  const stats = { reachable: explored.reachable, nodes: explored.nodes, shortest: explored.shortest ?? 0 };
  if (!explored.goalReached) {
    return result([explored.budgetExceeded
      ? budgetIssue(subject, explored.nodes, 'that a route leaves x alone')
      : issue('no-solution', `${subject}: no route of at most ${MAX_STEPS} offered moves leaves x alone (slips never count), so the learner cannot succeed`)], stats);
  }
  const x = (answer as { kind: 'value'; x: number }).x;
  return result(context.answerKey === undefined ? [] : keyIssues(subject, x, context.answerKey), stats);
};

registerSolvabilityChecker(BALANCE, balanceChecker);
