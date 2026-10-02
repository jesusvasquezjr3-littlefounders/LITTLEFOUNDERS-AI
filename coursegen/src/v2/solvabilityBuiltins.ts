import {
  Budget, asRecord, budgetIssue, isWhole, issue, registerSolvabilityChecker, result, searchAssignments,
  type SolvabilityChecker, type SolvabilityIssue,
} from './solvability.js';

export interface TrayPiece {
  value: number;
  available: number;
}

const MAX_SEQUENCE = 60;
const MAX_VALUE = 100_000;
const MAX_AVAILABLE = 20;
const ADVISORY_SHARE = 4;

export function readTray(value: unknown, subject: string): { tray: TrayPiece[]; issues: SolvabilityIssue[] } {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) {
    return { tray: [], issues: [issue('impossible-state', `${subject}: the tray needs between 2 and 8 denominations`)] };
  }
  const tray: TrayPiece[] = [];
  const issues: SolvabilityIssue[] = [];
  value.forEach((raw, index) => {
    const piece = asRecord(raw);
    const worth = piece?.value_minor;
    const count = piece?.available;
    if (!piece || !isWhole(worth) || worth < 1 || worth > MAX_VALUE || !isWhole(count) || count < 1 || count > MAX_AVAILABLE) {
      issues.push(issue('impossible-state', `${subject}: denomination ${index + 1} needs a whole value_minor of 1-${MAX_VALUE} and a whole available count of 1-${MAX_AVAILABLE}`));
      return;
    }
    const before = tray.at(-1);
    if (before && worth >= before.value) issues.push(issue('impossible-state', `${subject}: denominations must be strictly descending (${worth} follows ${before.value})`));
    tray.push({ value: worth, available: count });
  });
  return { tray, issues };
}

export function trayTotal(tray: readonly TrayPiece[]): number {
  return tray.reduce((sum, piece) => sum + piece.value * piece.available, 0);
}

export function fewestPieces(target: number, tray: readonly TrayPiece[], budget: Budget): number | null | undefined {
  let best = new Array<number>(target + 1).fill(Infinity);
  best[0] = 0;
  for (const { value, available } of tray) {
    if (!budget.spend(target + 1)) return undefined;
    const next = new Array<number>(target + 1).fill(Infinity);
    for (let residue = 0; residue < value && residue <= target; residue += 1) {
      const window: number[] = [];
      let head = 0;
      const keyAt = (step: number) => best[residue + step * value]! - step;
      for (let step = 0; residue + step * value <= target; step += 1) {
        const key = keyAt(step);
        while (window.length > head && keyAt(window[window.length - 1]!) >= key) window.pop();
        window.push(step);
        while (window[head]! < step - available) head += 1;
        next[residue + step * value] = keyAt(window[head]!) + step;
      }
    }
    best = next;
  }
  const pieces = best[target]!;
  return Number.isFinite(pieces) ? pieces : null;
}

function hasLongerWay(target: number, tray: readonly TrayPiece[], fewest: number, maxNodes: number): boolean | undefined {
  const reach: number[] = [];
  for (let at = tray.length - 1, sum = 0; at >= 0; at -= 1) {
    sum += tray[at]!.value * tray[at]!.available;
    reach[at] = sum;
  }
  const search = searchAssignments<number>({
    domains: tray.map((piece) => Array.from({ length: piece.available + 1 }, (_, count) => count)),
    accept: (partial, depth) => {
      const sum = partial.reduce((total, count, index) => total + count * tray[index]!.value, 0);
      return sum <= target && sum + (reach[depth + 1] ?? 0) >= target;
    },
    isSolution: (full) => full.reduce((total, count, index) => total + count * tray[index]!.value, 0) === target && full.reduce((a, b) => a + b, 0) > fewest,
    limit: 1,
    maxNodes,
  });
  if (search.count > 0) return true;
  return search.exhaustive ? false : undefined;
}

export const coinTrayChecker: SolvabilityChecker = (segment, context) => {
  const subject = `coin tray ${segment.id}`;
  const parsed = readTray(segment.payload.denominations, subject);
  if (parsed.issues.length > 0) return result(parsed.issues);
  const tray = parsed.tray;
  if (context.answerKey === undefined) return result([], { denominations: tray.length });
  const key = asRecord(context.answerKey);
  const target = key?.target_minor;
  if (!key || Object.keys(key).length !== 2 || !isWhole(target) || target < 1 || typeof key.fewest !== 'boolean') {
    return result([issue('impossible-state', `${subject}: the rubric must be exactly { target_minor, fewest } with a whole, positive target`)]);
  }
  const most = trayTotal(tray);
  if (target > MAX_VALUE) return result([issue('impossible-state', `${subject}: the target ${target} is above the ${MAX_VALUE} Core accepts`)]);
  if (target > most) return result([issue('no-solution', `${subject}: the target ${target} is more than the whole tray holds (${most}), so the learner cannot build it`)]);
  const budget = new Budget(context.nodeBudget);
  const fewest = fewestPieces(target, tray, budget);
  if (fewest === undefined) return result([budgetIssue(subject, budget.limit, `that ${target} can be built`)]);
  if (fewest === null) return result([issue('no-solution', `${subject}: no mix of these pieces makes exactly ${target}, so the learner cannot build it`)]);
  const stats = { fewest, target, nodes: budget.used };
  if (!key.fewest) return result([], stats);
  const longer = hasLongerWay(target, tray, fewest, Math.max(1, Math.floor(context.nodeBudget / ADVISORY_SHARE)));
  if (longer === false) {
    return result([issue('vacuous-rubric', `${subject}: every way to make ${target} uses ${fewest} piece(s), so asking for the fewest tests nothing; change the tray or the target`, { severity: 'review' })], stats);
  }
  return result([], stats);
};

export const makingChangeChecker: SolvabilityChecker = (segment, context) => {
  const subject = `making change ${segment.id}`;
  const parsed = readTray(segment.payload.denominations, subject);
  const price = segment.payload.price_minor;
  const paid = segment.payload.paid_minor;
  const issues = [...parsed.issues];
  if (!isWhole(price) || price < 1 || !isWhole(paid) || paid <= price) {
    issues.push(issue('impossible-state', `${subject}: the price must be a positive whole amount and the payment must be more than the price`));
  }
  if (issues.length > 0 || !isWhole(price) || !isWhole(paid)) return result(issues);
  const tray = parsed.tray;
  const change = paid - price;
  if (context.answerKey !== undefined) {
    const key = asRecord(context.answerKey);
    if (!key || Object.keys(key).length !== 1 || key.change_minor !== change) {
      issues.push(issue('impossible-state', `${subject}: the rubric must be exactly { change_minor: ${change} }, the payment minus the price`));
    }
  }
  const most = trayTotal(tray);
  if (change > most) {
    issues.push(issue('no-solution', `${subject}: the change owed (${change}) is more than the whole tray holds (${most}), so the learner cannot return it`));
    return result(issues);
  }
  const budget = new Budget(context.nodeBudget);
  const fewest = fewestPieces(change, tray, budget);
  if (fewest === undefined) issues.push(budgetIssue(subject, budget.limit, `that change of ${change} can be made`));
  else if (fewest === null) issues.push(issue('no-solution', `${subject}: no mix of these pieces makes exactly ${change} in change, so the learner cannot return it`));
  else if (fewest > MAX_SEQUENCE) issues.push(issue('impossible-state', `${subject}: the least coins that make ${change} is ${fewest}, past the ${MAX_SEQUENCE}-step counting-up sequence Core accepts`));
  return result(issues, { change, nodes: budget.used, ...(typeof fewest === 'number' ? { fewest } : {}) });
};

registerSolvabilityChecker('money.coin-tray.v2', coinTrayChecker);
registerSolvabilityChecker('money.making-change.v2', makingChangeChecker);
