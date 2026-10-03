import {
  Budget, budgetIssue, issue, registerSolvabilityChecker, result, type SolvabilityChecker, type SolvabilityIssue,
} from '../solvability.js';
import { expressionTaskProblem, isExpressionTask, parseExpression, toPolynomial, type Rat } from './alg2Expression.js';
import { onSliders, passesThrough, readGraphPayload, sameStandard, toStandard, type Dec, type GraphMark, type ReadGraph } from './alg2Model.js';

const GRAPH = 'math.function-graph.v2';
const EXPRESSION = 'math.expression-editor.v2';

const abs = (value: bigint): bigint => (value < 0n ? -value : value);
function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) { const rest = x % y; x = y; y = rest; }
  return x;
}
function ratio(n: bigint, d: bigint): Dec {
  const g = gcd(n, d) || 1n;
  const sign = d < 0n ? -1n : 1n;
  return { n: sign * (n / g), d: sign * (d / g) };
}
const whole = (value: number): Dec => ({ n: BigInt(value), d: 1n });
const plus = (a: Dec, b: Dec): Dec => ratio(a.n * b.d + b.n * a.d, a.d * b.d);
const minus = (a: Dec, b: Dec): Dec => ratio(a.n * b.d - b.n * a.d, a.d * b.d);
const times = (a: Dec, b: Dec): Dec => ratio(a.n * b.n, a.d * b.d);
const over = (a: Dec, b: Dec): Dec | null => (b.n === 0n ? null : ratio(a.n * b.d, a.d * b.n));
const isZero = (value: Dec): boolean => value.n === 0n;

function power(base: Dec, exponent: number): Dec | null {
  let out = whole(1);
  for (let step = 0; step < Math.abs(exponent); step += 1) out = times(out, base);
  return exponent < 0 ? over(whole(1), out) : out;
}

type Candidates = { found: Array<Map<string, Dec>>; budgetExceeded: boolean; spent: number };

/** Every parameter set of the family through all the marks that sits on the sliders: one for a line or a quadratic, a scan of the base slider for y = a * b^x. */
function candidatesOf(graph: ReadGraph, budget: Budget): Candidates {
  const marks: readonly GraphMark[] = graph.marks;
  const [first, second, third] = marks as [GraphMark, GraphMark, GraphMark];
  const x1 = whole(first.x);
  const y1 = whole(first.y);
  const raw: Array<Map<string, Dec>> = [];
  if (graph.curve === 'line') {
    const slope = over(minus(whole(second.y), y1), minus(whole(second.x), x1));
    if (slope) raw.push(new Map([['m', slope], ['b', minus(y1, times(slope, x1))]]));
  } else if (graph.curve === 'quadratic') {
    const left = over(minus(whole(second.y), y1), minus(whole(second.x), x1));
    const right = over(minus(whole(third.y), whole(second.y)), minus(whole(third.x), whole(second.x)));
    const a = left && right ? over(minus(right, left), minus(whole(third.x), x1)) : null;
    if (left && a) {
      const b = minus(left, times(a, plus(x1, whole(second.x))));
      raw.push(new Map([['a', a], ['b', b], ['c', minus(minus(y1, times(a, times(x1, x1))), times(b, x1))]]));
    }
  } else {
    const slider = graph.sliders.get('b')!;
    const count = over(minus(slider.max, slider.min), slider.step);
    const steps = count ? Number(count.n) : 0;
    for (let index = 0; index <= steps; index += 1) {
      if (!budget.spend()) return { found: [], budgetExceeded: true, spent: budget.used };
      const base = plus(slider.min, times(slider.step, whole(index)));
      const scale = power(base, first.x);
      const a = scale ? over(y1, scale) : null;
      if (a && !(base.n === 1n && base.d === 1n)) raw.push(new Map([['a', a], ['b', base]]));
    }
  }
  const found = raw.filter((standard) => (graph.curve === 'line' || !isZero(standard.get('a')!)) && onSliders(graph, standard) && passesThrough(graph.curve, standard, marks));
  return { found, budgetExceeded: false, spent: budget.used };
}

const graphChecker: SolvabilityChecker = (segment, context) => {
  const subject = `function graph ${segment.id}`;
  const graph = readGraphPayload(segment.payload);
  if (typeof graph === 'string') return result([issue('impossible-state', `${subject}: ${graph}`)]);
  if (graph.marks.length === 0) return result([], { marks: 0 });
  const budget = new Budget(context.nodeBudget);
  const { found, budgetExceeded, spent } = candidatesOf(graph, budget);
  if (budgetExceeded) return result([budgetIssue(subject, budget.limit, 'that a curve on the sliders goes through every mark')], { nodes: spent });
  const stats = { marks: graph.marks.length, candidates: found.length, nodes: spent };
  if (found.length === 0) {
    return result([issue('no-solution', `${subject}: no ${graph.curve} on the sliders (each inside its range and on a step, a not zero for a curve, a base above zero and not 1) goes exactly through every mark, so the learner cannot succeed`)], stats);
  }
  const start = toStandard(graph, graph.start);
  if (start && found.every((standard) => sameStandard(standard, start))) {
    return result([issue('impossible-state', `${subject}: the start already sits on the one curve through the marks, so there is nothing to do`)], stats);
  }
  return result([], stats);
};

type Poly = readonly Rat[];

function trimmed(poly: Poly): Rat[] {
  const out = [...poly];
  while (out.length > 0 && out[out.length - 1]!.n === 0n) out.pop();
  return out;
}

const taskKeys = ['form', 'given', 'task', 'variable'].join();

const expressionChecker: SolvabilityChecker = (segment) => {
  const subject = `expression editor ${segment.id}`;
  const payload = segment.payload;
  if (Object.keys(payload).sort().join() !== taskKeys || !isExpressionTask(payload) || !/^[a-z]$/.test(payload.variable)) {
    return result([issue('impossible-state', `${subject}: the payload is a task (rewrite or solve), a given, a form that fits the task and one lowercase variable letter`)]);
  }
  const problem = expressionTaskProblem(payload);
  if (problem) return result([issue('impossible-state', `${subject}: ${problem}`)]);
  const parsed = parseExpression(payload.given, payload.variable);
  if (!parsed.ok) return result([issue('impossible-state', `${subject}: the given does not parse`)]);
  const issues: SolvabilityIssue[] = [];
  if (parsed.kind === 'equation') {
    const left = toPolynomial(parsed.left);
    const right = toPolynomial(parsed.right);
    if (!left || !right) return result([issue('no-solution', `${subject}: a solve task needs both sides to be polynomials in ${payload.variable}, so no finished line is equal to the given`)]);
    const difference = trimmed(Array.from({ length: Math.max(left.length, right.length) }, (_, at) => {
      const a = left[at] ?? { n: 0n, d: 1n };
      const b = right[at] ?? { n: 0n, d: 1n };
      return { n: a.n * b.d - b.n * a.d, d: a.d * b.d };
    }));
    const degree = difference.length - 1;
    if (difference.length === 0) issues.push(issue('ambiguous-solution', `${subject}: both sides are the same for every ${payload.variable}, so no single answer exists`));
    else if (degree === 0) issues.push(issue('no-solution', `${subject}: the sides differ by the same amount for every ${payload.variable}, so no ${payload.variable} makes them equal`));
    else if (degree > 1) issues.push(issue('no-solution', `${subject}: the equation has degree ${degree}, but an isolated or separated line is a single linear answer; use a linear equation`));
    return result(issues, { degree: Math.max(degree, 0) });
  }
  const poly = toPolynomial(parsed.expr);
  if (!poly) return result([issue('no-solution', `${subject}: a rewrite task needs a polynomial in ${payload.variable}, so no expanded or factored line is equal to the given`)]);
  if (payload.form === 'factored') {
    const coefficients = trimmed(poly);
    const lowest = coefficients.findIndex((coefficient) => coefficient.n !== 0n);
    if (coefficients.length - 1 - lowest < 1) {
      issues.push(issue('no-solution', `${subject}: the given is a single term, so there is no bracket to factor it into`));
    }
    return result(issues, { degree: Math.max(coefficients.length - 1, 0) });
  }
  return result([], { degree: Math.max(trimmed(poly).length - 1, 0) });
};

registerSolvabilityChecker(GRAPH, graphChecker);
registerSolvabilityChecker(EXPRESSION, expressionChecker);
