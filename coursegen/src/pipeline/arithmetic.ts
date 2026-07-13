// Tiny, safe arithmetic helpers for gate 4 (ARITHMETIC RE-EXECUTION,
// COURSE_ENGINE.md §4). No `eval`, no Function constructor — everything is
// a hand-rolled evaluator or brute-force search bounded to kid-content
// scale (small denominations, ≤8 weights, targets in the hundreds).

/** Currency amounts have at most 2 decimals (MXN centavos, USD cents, BRL centavos) — scale to integer cents. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

const SUBSET_SUM_CAP_CENTS = 200_000; // 2,000 currency units — generous for kid-content amounts

/** Unbounded subset-sum (coins/bills may repeat) — used by coin_count / make_change. */
export function reachableWithRepetition(
  targetCents: number,
  denominationCents: readonly number[],
): boolean | 'too-large' {
  if (targetCents < 0) return false;
  if (targetCents === 0) return true;
  if (targetCents > SUBSET_SUM_CAP_CENTS) return 'too-large';
  const positiveDenoms = denominationCents.filter((d) => d > 0);
  if (positiveDenoms.length === 0) return false;

  const reachable = new Array<boolean>(targetCents + 1).fill(false);
  reachable[0] = true;
  for (let amount = 1; amount <= targetCents; amount++) {
    for (const d of positiveDenoms) {
      if (d <= amount && reachable[amount - d]) {
        reachable[amount] = true;
        break;
      }
    }
  }
  return reachable[targetCents] ?? false;
}

/** Bounded subset-sum WITHOUT repetition (each weight used at most once) — used by balance_scale. Brute force, capped at 20 items. */
export function existsSubsetSumOnce(target: number, values: readonly number[], epsilon = 1e-6): boolean {
  const n = Math.min(values.length, 20);
  for (let mask = 0; mask < 2 ** n; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += values[i]!;
    }
    if (Math.abs(sum - target) <= epsilon) return true;
  }
  return false;
}

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Evaluates a well-formed infix token sequence (numbers, +-*\/, parens) —
 * shunting-yard, no `eval`. Returns null on malformed input or division by
 * zero rather than throwing (arithmetic gate treats null as a failure).
 */
export function evaluateInfixTokens(tokens: readonly string[]): number | null {
  const output: (number | string)[] = [];
  const ops: string[] = [];

  for (const t of tokens) {
    if (NUMBER_RE.test(t)) {
      output.push(Number(t));
    } else if (t in PRECEDENCE) {
      while (ops.length > 0 && PRECEDENCE[ops[ops.length - 1]!]! >= PRECEDENCE[t]!) {
        output.push(ops.pop()!);
      }
      ops.push(t);
    } else if (t === '(') {
      ops.push(t);
    } else if (t === ')') {
      while (ops.length > 0 && ops[ops.length - 1] !== '(') output.push(ops.pop()!);
      if (ops.length === 0) return null; // unbalanced
      ops.pop();
    } else {
      return null; // unknown token
    }
  }
  while (ops.length > 0) {
    const op = ops.pop()!;
    if (op === '(') return null; // unbalanced
    output.push(op);
  }

  const stack: number[] = [];
  for (const tok of output) {
    if (typeof tok === 'number') {
      stack.push(tok);
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return null;
    switch (tok) {
      case '+':
        stack.push(a + b);
        break;
      case '-':
        stack.push(a - b);
        break;
      case '*':
        stack.push(a * b);
        break;
      case '/':
        if (b === 0) return null;
        stack.push(a / b);
        break;
      default:
        return null;
    }
  }
  return stack.length === 1 ? stack[0]! : null;
}

/** Extracts the first numeric substring from free text (best-effort, used only where no structured value exists). */
export function extractFirstNumber(text: string): number | null {
  const match = /-?\d+(\.\d+)?/.exec(text);
  return match ? Number(match[0]) : null;
}

export function approxEqual(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) <= epsilon;
}
