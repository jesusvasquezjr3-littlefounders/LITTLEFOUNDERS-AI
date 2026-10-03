export const DEFAULT_NODE_BUDGET = 200_000;
export const MAX_NODE_BUDGET = 2_000_000;
export const COVERAGE_LIMIT = 500;
export const MAX_LAYOUT_ELEMENTS = 2_000;
const MAX_SLOTS = 256;
const MAX_LISTED = 5;
const MAX_MESSAGE = 560;

export type SolvabilityCode =
  | 'no-solution'
  | 'ambiguous-solution'
  | 'rubric-gap'
  | 'rubric-accepts-invalid'
  | 'overlap'
  | 'out-of-bounds'
  | 'impossible-state'
  | 'dangling-reference'
  | 'duplicate-id'
  | 'dead-end'
  | 'vacuous-rubric'
  | 'too-large'
  | 'budget-exceeded'
  | 'checker-error';

export interface SolvabilityIssue {
  code: SolvabilityCode;
  severity: 'block' | 'review';
  message: string;
  path?: string;
}

export interface SolvabilityResult {
  ok: boolean;
  issues: SolvabilityIssue[];
  stats?: Record<string, number>;
}

export interface SolvabilitySegment {
  id: string;
  type: string;
  grading?: string;
  prompt?: string;
  payload: Record<string, unknown>;
}

export interface SolvabilityContext {
  answerKey: unknown;
  ageBand: string | undefined;
  locale: string | undefined;
  nodeBudget: number;
}

export type SolvabilityChecker = (segment: SolvabilitySegment, context: SolvabilityContext) => SolvabilityResult;

const CHECKERS = new Map<string, SolvabilityChecker>();

export function registerSolvabilityChecker(type: string, checker: SolvabilityChecker): void {
  if (CHECKERS.has(type)) throw new Error(`solvability: a checker is already registered for "${type}"`);
  CHECKERS.set(type, checker);
}

export function unregisterSolvabilityChecker(type: string): boolean {
  return CHECKERS.delete(type);
}

export function solvabilityCheckerFor(type: string): SolvabilityChecker | undefined {
  return CHECKERS.get(type);
}

export function registeredSolvabilityTypes(): string[] {
  return [...CHECKERS.keys()].sort();
}

export function solvabilityCoverage(types: readonly string[]): { checked: string[]; unchecked: string[] } {
  const checked = types.filter((type) => CHECKERS.has(type));
  return { checked, unchecked: types.filter((type) => !CHECKERS.has(type)) };
}

export function issue(code: SolvabilityCode, message: string, extra: { severity?: 'block' | 'review'; path?: string } = {}): SolvabilityIssue {
  return { code, severity: extra.severity ?? 'block', message, ...(extra.path ? { path: extra.path } : {}) };
}

export function result(issues: readonly SolvabilityIssue[], stats?: Record<string, number>): SolvabilityResult {
  return { ok: !issues.some((item) => item.severity === 'block'), issues: [...issues], ...(stats ? { stats } : {}) };
}

export function mergeResults(...results: readonly SolvabilityResult[]): SolvabilityResult {
  const stats: Record<string, number> = {};
  for (const item of results) for (const [key, value] of Object.entries(item.stats ?? {})) stats[key] = (stats[key] ?? 0) + value;
  return result(results.flatMap((item) => item.issues), Object.keys(stats).length > 0 ? stats : undefined);
}

export function capIssues(issues: readonly SolvabilityIssue[], max = MAX_LISTED): SolvabilityIssue[] {
  if (issues.length <= max) return [...issues];
  const first = issues[0]!;
  const block = issues.some((item) => item.severity === 'block');
  return [...issues.slice(0, max), issue(first.code, `${issues.length - max} more ${first.code} problem(s) not listed`, { severity: block ? 'block' : 'review' })];
}

export function clampBudget(requested?: number): number {
  if (requested === undefined || !Number.isFinite(requested) || requested < 1) return DEFAULT_NODE_BUDGET;
  return Math.min(Math.floor(requested), MAX_NODE_BUDGET);
}

export class Budget {
  readonly limit: number;
  used = 0;
  constructor(limit?: number) {
    this.limit = clampBudget(limit);
  }
  spend(units = 1): boolean {
    this.used += units;
    return this.used <= this.limit;
  }
  get exceeded(): boolean {
    return this.used > this.limit;
  }
}

export function budgetIssue(subject: string, limit: number, what: string): SolvabilityIssue {
  return issue('budget-exceeded', `${subject}: could not prove ${what} within ${limit} steps; simplify the instance or give the pack a smarter checker (an unproven board is never published)`);
}

export function stableKey(value: unknown): string {
  const text = JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : item);
  return text ?? 'undefined';
}

export function isWhole(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function listed(keys: readonly string[]): string {
  return keys.slice(0, MAX_LISTED).map((key) => (key.length > 80 ? `${key.slice(0, 77)}...` : key)).join(' | ');
}

export interface SearchResult<V> {
  solutions: V[][];
  keys: string[];
  count: number;
  exhaustive: boolean;
  stoppedAtLimit: boolean;
  budgetExceeded: boolean;
  nodes: number;
}

interface Engine<V> {
  slots: number;
  candidates: (depth: number, partial: readonly V[]) => readonly V[];
  enter?: (value: V) => void;
  leave?: (value: V) => void;
  accept?: (partial: readonly V[], depth: number) => boolean;
  isSolution?: (full: readonly V[]) => boolean;
  key: (full: readonly V[]) => string;
  limit: number;
  maxNodes?: number;
}

function runSearch<V>(engine: Engine<V>): SearchResult<V> {
  const budget = new Budget(engine.maxNodes);
  const found = new Map<string, V[]>();
  const partial: V[] = [];
  let stoppedAtLimit = false;
  const visit = (depth: number): boolean => {
    if (depth === engine.slots) {
      if (engine.isSolution && !engine.isSolution(partial)) return false;
      const key = engine.key(partial);
      if (!found.has(key)) {
        found.set(key, [...partial]);
        if (found.size >= engine.limit) {
          stoppedAtLimit = true;
          return true;
        }
      }
      return false;
    }
    for (const value of engine.candidates(depth, partial)) {
      if (!budget.spend()) return true;
      partial.push(value);
      engine.enter?.(value);
      const stop = !engine.accept || engine.accept(partial, depth) ? visit(depth + 1) : false;
      engine.leave?.(value);
      partial.pop();
      if (stop) return true;
    }
    return false;
  };
  if (engine.slots > MAX_SLOTS) return { solutions: [], keys: [], count: 0, exhaustive: false, stoppedAtLimit: false, budgetExceeded: true, nodes: 0 };
  visit(0);
  return {
    solutions: [...found.values()],
    keys: [...found.keys()],
    count: found.size,
    exhaustive: !budget.exceeded && !stoppedAtLimit,
    stoppedAtLimit,
    budgetExceeded: budget.exceeded,
    nodes: Math.min(budget.used, budget.limit),
  };
}

export interface AssignmentSearch<V> {
  domains: ReadonlyArray<readonly V[]>;
  distinct?: boolean | ((value: V) => string);
  accept?: (partial: readonly V[], depth: number) => boolean;
  isSolution?: (full: readonly V[]) => boolean;
  key?: (full: readonly V[]) => string;
  limit?: number;
  maxNodes?: number;
}

export function searchAssignments<V>(options: AssignmentSearch<V>): SearchResult<V> {
  const kindOf = typeof options.distinct === 'function' ? options.distinct : (value: V) => stableKey(value);
  const distinct = options.distinct !== undefined && options.distinct !== false;
  const used = new Set<string>();
  return runSearch<V>({
    slots: options.domains.length,
    candidates: (depth) => {
      const domain = options.domains[depth] ?? [];
      return distinct ? domain.filter((value) => !used.has(kindOf(value))) : domain;
    },
    ...(distinct ? { enter: (value: V) => used.add(kindOf(value)), leave: (value: V) => used.delete(kindOf(value)) } : {}),
    ...(options.accept ? { accept: options.accept } : {}),
    ...(options.isSolution ? { isSolution: options.isSolution } : {}),
    key: options.key ?? ((full) => stableKey(full)),
    limit: Math.max(1, options.limit ?? 2),
    ...(options.maxNodes !== undefined ? { maxNodes: options.maxNodes } : {}),
  });
}

export interface ArrangementSearch<V> {
  pool: readonly V[];
  slots?: number;
  kind?: (value: V) => string;
  accept?: (partial: readonly V[], depth: number) => boolean;
  isSolution?: (full: readonly V[]) => boolean;
  key?: (full: readonly V[]) => string;
  limit?: number;
  maxNodes?: number;
}

export function searchArrangements<V>(options: ArrangementSearch<V>): SearchResult<V> {
  const kindOf = options.kind ?? ((value: V) => stableKey(value));
  const groups = new Map<string, { value: V; left: number }>();
  for (const value of options.pool) {
    const kind = kindOf(value);
    const group = groups.get(kind);
    if (group) group.left += 1;
    else groups.set(kind, { value, left: 1 });
  }
  return runSearch<V>({
    slots: Math.min(options.slots ?? options.pool.length, options.pool.length),
    candidates: () => [...groups.values()].filter((group) => group.left > 0).map((group) => group.value),
    enter: (value) => {
      groups.get(kindOf(value))!.left -= 1;
    },
    leave: (value) => {
      groups.get(kindOf(value))!.left += 1;
    },
    ...(options.accept ? { accept: options.accept } : {}),
    ...(options.isSolution ? { isSolution: options.isSolution } : {}),
    key: options.key ?? ((full) => stableKey(full)),
    limit: Math.max(1, options.limit ?? 2),
    ...(options.maxNodes !== undefined ? { maxNodes: options.maxNodes } : {}),
  });
}

export type RubricAcceptance = ReadonlySet<string> | readonly string[] | ((solutionKey: string) => boolean);

function accepts(acceptance: RubricAcceptance, key: string): boolean {
  if (typeof acceptance === 'function') return acceptance(key);
  return acceptance instanceof Set ? acceptance.has(key) : (acceptance as readonly string[]).includes(key);
}

export function checkRubricCoverage(
  solutionKeys: readonly string[],
  acceptance: RubricAcceptance,
  options: { subject: string; isSolution?: (key: string) => boolean },
): SolvabilityIssue[] {
  const issues: SolvabilityIssue[] = [];
  const uncovered = solutionKeys.filter((key) => !accepts(acceptance, key));
  if (uncovered.length > 0) {
    issues.push(issue('rubric-gap', `${options.subject}: ${uncovered.length} valid solution(s) are not accepted by the rubric, so a correct answer would be graded wrong: ${listed(uncovered)}`));
  }
  if (typeof acceptance !== 'function' && options.isSolution) {
    const list = acceptance instanceof Set ? [...acceptance] : (acceptance as readonly string[]);
    const invalid = list.filter((key) => !options.isSolution!(key));
    if (invalid.length > 0) {
      issues.push(issue('rubric-accepts-invalid', `${options.subject}: the rubric accepts ${invalid.length} answer(s) that are not solutions, so a wrong answer would be graded right: ${listed(invalid)}`));
    }
  }
  return issues;
}

export interface UniquenessOptions {
  subject: string;
  acceptance?: RubricAcceptance;
  isSolution?: (key: string) => boolean;
  predicateGraded?: boolean;
}

export function verifyUniqueOrCovered<V>(run: (limit: number) => SearchResult<V>, options: UniquenessOptions): SolvabilityResult {
  const covering = options.acceptance !== undefined;
  const search = run(covering ? COVERAGE_LIMIT + 1 : 2);
  const stats = { solutions: search.count, nodes: search.nodes };
  const { subject } = options;
  if (search.count === 0) {
    return result([search.budgetExceeded ? budgetIssue(subject, search.nodes, 'that a solution exists') : issue('no-solution', `${subject}: no arrangement of this instance is a solution, so the learner cannot succeed`)], stats);
  }
  if (covering) {
    if (search.stoppedAtLimit) return result([issue('budget-exceeded', `${subject}: more than ${COVERAGE_LIMIT} valid solutions, which a rubric cannot be shown to cover; grade by predicate (predicateGraded) or tighten the instance`)], stats);
    if (search.budgetExceeded) return result([budgetIssue(subject, search.nodes, 'that the rubric covers every solution')], stats);
    return result(checkRubricCoverage(search.keys, options.acceptance!, { subject, ...(options.isSolution ? { isSolution: options.isSolution } : {}) }), stats);
  }
  if (options.predicateGraded) return result([], stats);
  if (search.count >= 2) {
    return result([issue('ambiguous-solution', `${subject}: more than one valid solution and no rubric covers them (${listed(search.keys)}); make the instance unique or enumerate them in the rubric`)], stats);
  }
  if (search.budgetExceeded) return result([budgetIssue(subject, search.nodes, 'that the solution is unique')], stats);
  return result([], stats);
}

export interface ExploreOptions<S, M> {
  initial: readonly S[];
  moves: (state: S) => ReadonlyArray<{ move: M; next: S }>;
  isGoal: (state: S) => boolean;
  key: (state: S) => string;
  maxNodes?: number;
  maxDepth?: number;
  full?: boolean;
}

export interface ExploreResult<M> {
  goalReached: boolean;
  shortest: number | null;
  shortestPath: M[] | null;
  shortestPaths: number;
  goalStates: number;
  reachable: number;
  deadEnds: string[];
  deadEndCount: number;
  complete: boolean;
  truncated: boolean;
  budgetExceeded: boolean;
  nodes: number;
}

const PATH_COUNT_CAP = 1_000_000_000;

export function exploreStateSpace<S, M = unknown>(options: ExploreOptions<S, M>): ExploreResult<M> {
  const budget = new Budget(options.maxNodes);
  const full = options.full === true;
  const depthOf = new Map<string, number>();
  const paths = new Map<string, number>();
  const parent = new Map<string, { from: string; move: M }>();
  const reverse = new Map<string, string[]>();
  const goalKeys: string[] = [];
  let goalDepth: number | null = null;
  let truncated = false;
  let stoppedEarly = false;
  let queue: S[] = [];
  for (const start of options.initial) {
    const key = options.key(start);
    if (depthOf.has(key)) continue;
    depthOf.set(key, 0);
    paths.set(key, 1);
    queue.push(start);
  }
  search: while (queue.length > 0) {
    const nextLevel: S[] = [];
    for (const state of queue) {
      const key = options.key(state);
      const depth = depthOf.get(key)!;
      if (options.isGoal(state)) {
        goalDepth ??= depth;
        goalKeys.push(key);
        continue;
      }
      if (goalDepth !== null && !full) continue;
      if (options.maxDepth !== undefined && depth >= options.maxDepth) {
        truncated = true;
        continue;
      }
      for (const { move, next } of options.moves(state)) {
        if (!budget.spend()) break search;
        const nextKey = options.key(next);
        if (full) reverse.set(nextKey, [...(reverse.get(nextKey) ?? []), key]);
        if (!depthOf.has(nextKey)) {
          depthOf.set(nextKey, depth + 1);
          paths.set(nextKey, paths.get(key)!);
          parent.set(nextKey, { from: key, move });
          nextLevel.push(next);
        } else if (depthOf.get(nextKey) === depth + 1) {
          paths.set(nextKey, Math.min(PATH_COUNT_CAP, paths.get(nextKey)! + paths.get(key)!));
        }
      }
    }
    queue = nextLevel;
    if (goalDepth !== null && !full) {
      stoppedEarly = queue.length > 0;
      break;
    }
  }
  const atShortest = goalDepth === null ? [] : goalKeys.filter((key) => depthOf.get(key) === goalDepth);
  let shortestPath: M[] | null = null;
  if (atShortest.length > 0) {
    shortestPath = [];
    let cursor: string | undefined = atShortest[0];
    while (cursor !== undefined && parent.has(cursor)) {
      const step: { from: string; move: M } = parent.get(cursor)!;
      shortestPath.unshift(step.move);
      cursor = step.from;
    }
  }
  const complete = !budget.exceeded && !truncated && !stoppedEarly;
  let deadEnds: string[] = [];
  let deadEndCount = 0;
  if (full && complete) {
    const winning = new Set(goalKeys);
    const pending = [...goalKeys];
    for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
      for (const before of reverse.get(at) ?? []) {
        if (!winning.has(before)) {
          winning.add(before);
          pending.push(before);
        }
      }
    }
    const dead = [...depthOf.keys()].filter((key) => !winning.has(key));
    deadEndCount = dead.length;
    deadEnds = dead.slice(0, 20);
  }
  return {
    goalReached: goalDepth !== null,
    shortest: goalDepth,
    shortestPath,
    shortestPaths: atShortest.reduce((sum, key) => Math.min(PATH_COUNT_CAP, sum + (paths.get(key) ?? 0)), 0),
    goalStates: goalKeys.length,
    reachable: depthOf.size,
    deadEnds,
    deadEndCount,
    complete,
    truncated,
    budgetExceeded: budget.exceeded,
    nodes: Math.min(budget.used, budget.limit),
  };
}

export function judgeReachability<M>(
  explored: ExploreResult<M>,
  options: { subject: string; requireUniqueShortest?: boolean; forbidDeadEnds?: boolean },
): SolvabilityResult {
  const stats = { reachable: explored.reachable, nodes: explored.nodes, shortestPaths: explored.shortestPaths, deadEnds: explored.deadEndCount };
  const issues: SolvabilityIssue[] = [];
  if (!explored.goalReached) {
    if (explored.budgetExceeded) issues.push(budgetIssue(options.subject, explored.nodes, 'that the goal is reachable'));
    else issues.push(issue('no-solution', `${options.subject}: the goal is unreachable${explored.truncated ? ' within the move limit' : ''} from the starting state, so the learner cannot succeed`));
    return result(issues, stats);
  }
  if (options.requireUniqueShortest) {
    if (explored.budgetExceeded) issues.push(budgetIssue(options.subject, explored.nodes, 'that the shortest solution is unique'));
    else if (explored.shortestPaths > 1) issues.push(issue('ambiguous-solution', `${options.subject}: ${explored.shortestPaths} different shortest solutions of ${explored.shortest} move(s); make the shortest one unique or cover them in the rubric`));
  }
  if (options.forbidDeadEnds) {
    if (!explored.complete) issues.push(budgetIssue(options.subject, explored.nodes, 'that no reachable state is a dead end'));
    else if (explored.deadEndCount > 0) issues.push(issue('dead-end', `${options.subject}: ${explored.deadEndCount} reachable state(s) can never reach the goal, so the learner can get stuck (first: ${listed(explored.deadEnds)})`));
  }
  return result(issues, stats);
}

export interface GridCell {
  id: string;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
}

export function checkGridPlacement(cells: readonly GridCell[], grid?: { rows: number; cols: number }, options: { subject?: string; maxNodes?: number } = {}): SolvabilityIssue[] {
  const subject = options.subject ?? 'grid';
  const budget = new Budget(options.maxNodes);
  const issues: SolvabilityIssue[] = [];
  const owner = new Map<string, string>();
  const reported = new Set<string>();
  for (const cell of cells) {
    const rows = cell.rowSpan ?? 1;
    const cols = cell.colSpan ?? 1;
    if (!isWhole(cell.row) || !isWhole(cell.col) || !isWhole(rows) || !isWhole(cols) || rows < 1 || cols < 1) {
      issues.push(issue('impossible-state', `${subject}: "${cell.id}" has a position or span that is not a whole, positive grid number`));
      continue;
    }
    if (grid && (cell.row + rows > grid.rows || cell.col + cols > grid.cols)) {
      issues.push(issue('out-of-bounds', `${subject}: "${cell.id}" at row ${cell.row}, column ${cell.col} (${rows}x${cols}) leaves the ${grid.rows}x${grid.cols} grid`));
    }
    for (let row = cell.row; row < cell.row + rows; row += 1) {
      for (let col = cell.col; col < cell.col + cols; col += 1) {
        if (!budget.spend()) return [...capIssues(issues), budgetIssue(subject, budget.limit, 'that no two cells overlap')];
        const square = `${row},${col}`;
        const other = owner.get(square);
        if (other === undefined) owner.set(square, cell.id);
        else if (other !== cell.id) {
          const pair = [other, cell.id].sort().join('|');
          if (!reported.has(pair)) {
            reported.add(pair);
            issues.push(issue('overlap', `${subject}: "${other}" and "${cell.id}" both cover row ${row}, column ${col}`));
          }
        }
      }
    }
  }
  return capIssues(issues);
}

export interface LayoutRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

function tooLarge(subject: string, count: number): SolvabilityIssue {
  return issue('too-large', `${subject}: ${count} elements exceed the ${MAX_LAYOUT_ELEMENTS} the overlap check can prove; split the board`);
}

export function checkRectLayout(rects: readonly LayoutRect[], options: { gap?: number; bounds?: LayoutRect; subject?: string } = {}): SolvabilityIssue[] {
  const subject = options.subject ?? 'layout';
  const gap = options.gap ?? 0;
  if (rects.length > MAX_LAYOUT_ELEMENTS) return [tooLarge(subject, rects.length)];
  const issues: SolvabilityIssue[] = [];
  const valid: LayoutRect[] = [];
  for (const rect of rects) {
    if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) || rect.w <= 0 || rect.h <= 0) {
      issues.push(issue('impossible-state', `${subject}: "${rect.id}" has a position or size that is not a finite positive number`));
      continue;
    }
    const box = options.bounds;
    if (box && (rect.x < box.x || rect.y < box.y || rect.x + rect.w > box.x + box.w || rect.y + rect.h > box.y + box.h)) {
      issues.push(issue('out-of-bounds', `${subject}: "${rect.id}" leaves the board`));
    }
    valid.push(rect);
  }
  valid.sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 0; i < valid.length; i += 1) {
    const a = valid[i]!;
    for (let j = i + 1; j < valid.length; j += 1) {
      const b = valid[j]!;
      if (b.x >= a.x + a.w + gap) break;
      if (b.y < a.y + a.h + gap && a.y < b.y + b.h + gap) {
        issues.push(issue('overlap', `${subject}: "${a.id}" and "${b.id}" ${gap > 0 ? `are closer than ${gap}` : 'overlap'}`));
      }
    }
  }
  return capIssues(issues);
}

export interface LayoutPoint {
  id: string;
  x: number;
  y: number;
}

export function checkPointSpacing(points: readonly LayoutPoint[], options: { minDistance: number; bounds?: LayoutRect; subject?: string }): SolvabilityIssue[] {
  const subject = options.subject ?? 'points';
  if (points.length > MAX_LAYOUT_ELEMENTS) return [tooLarge(subject, points.length)];
  const issues: SolvabilityIssue[] = [];
  const valid: LayoutPoint[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      issues.push(issue('impossible-state', `${subject}: "${point.id}" has a position that is not a finite number`));
      continue;
    }
    const box = options.bounds;
    if (box && (point.x < box.x || point.y < box.y || point.x > box.x + box.w || point.y > box.y + box.h)) {
      issues.push(issue('out-of-bounds', `${subject}: "${point.id}" leaves the board`));
    }
    valid.push(point);
  }
  valid.sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 0; i < valid.length; i += 1) {
    const a = valid[i]!;
    for (let j = i + 1; j < valid.length; j += 1) {
      const b = valid[j]!;
      if (b.x - a.x >= options.minDistance) break;
      if (Math.hypot(b.x - a.x, b.y - a.y) < options.minDistance) {
        issues.push(issue('overlap', `${subject}: "${a.id}" and "${b.id}" are closer than ${options.minDistance}`));
      }
    }
  }
  return capIssues(issues);
}

export interface LayoutInterval {
  id: string;
  start: number;
  end: number;
}

export function checkIntervalOverlap(intervals: readonly LayoutInterval[], options: { allowTouching?: boolean; subject?: string } = {}): SolvabilityIssue[] {
  const subject = options.subject ?? 'intervals';
  const touching = options.allowTouching ?? true;
  if (intervals.length > MAX_LAYOUT_ELEMENTS) return [tooLarge(subject, intervals.length)];
  const issues: SolvabilityIssue[] = [];
  const valid: LayoutInterval[] = [];
  for (const interval of intervals) {
    if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) || interval.end < interval.start) {
      issues.push(issue('impossible-state', `${subject}: "${interval.id}" does not have a finite start at or before its end`));
      continue;
    }
    valid.push(interval);
  }
  valid.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 0; i < valid.length; i += 1) {
    const a = valid[i]!;
    for (let j = i + 1; j < valid.length; j += 1) {
      const b = valid[j]!;
      if (touching ? b.start >= a.end : b.start > a.end) break;
      issues.push(issue('overlap', `${subject}: "${a.id}" and "${b.id}" overlap`));
    }
  }
  return capIssues(issues);
}

export function checkUniqueIds(ids: readonly string[], subject = 'id'): SolvabilityIssue[] {
  const seen = new Set<string>();
  const issues: SolvabilityIssue[] = [];
  for (const id of ids) {
    if (seen.has(id) && !issues.some((item) => item.message.includes(`"${id}"`))) issues.push(issue('duplicate-id', `two ${subject}s share the id "${id}"`));
    seen.add(id);
  }
  return capIssues(issues);
}

export function checkReferences(references: ReadonlyArray<{ from: string; to: string }>, known: ReadonlySet<string> | readonly string[]): SolvabilityIssue[] {
  const ids = known instanceof Set ? known : new Set(known as readonly string[]);
  return capIssues(references.filter((ref) => !ids.has(ref.to)).map((ref) => issue('dangling-reference', `"${ref.from}" refers to "${ref.to}", which does not exist`)));
}

export interface Invariant<T> {
  check: (subject: T) => string | null | undefined | false;
}

export function checkInvariants<T>(subject: T, invariants: ReadonlyArray<Invariant<T>>): SolvabilityIssue[] {
  const issues: SolvabilityIssue[] = [];
  for (const invariant of invariants) {
    const message = invariant.check(subject);
    if (message) issues.push(issue('impossible-state', message));
  }
  return issues;
}

export interface SolvabilityFinding {
  severity: 'block' | 'review';
  segmentId: string;
  type: string;
  code: SolvabilityCode;
  message: string;
}

export interface SolvabilityDocumentLike {
  segments?: unknown;
  age_band?: unknown;
  locale?: unknown;
}

function cap(message: string): string {
  return message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE - 3)}...` : message;
}

function isResult(value: unknown): value is SolvabilityResult {
  const candidate = asRecord(value);
  return !!candidate && typeof candidate.ok === 'boolean' && Array.isArray(candidate.issues)
    && candidate.issues.every((item) => {
      const entry = asRecord(item);
      return !!entry && typeof entry.code === 'string' && typeof entry.message === 'string';
    });
}

export function runSolvabilityGate(
  document: SolvabilityDocumentLike,
  answerKeys?: Record<string, unknown>,
  options: { nodeBudget?: number } = {},
): SolvabilityFinding[] {
  const findings: SolvabilityFinding[] = [];
  const segments = Array.isArray(document.segments) ? (document.segments as unknown[]) : [];
  const nodeBudget = clampBudget(options.nodeBudget);
  for (const raw of segments) {
    const entry = asRecord(raw);
    if (!entry || typeof entry.type !== 'string') continue;
    const checker = CHECKERS.get(entry.type);
    if (!checker) continue;
    const id = typeof entry.id === 'string' ? entry.id : '(segment)';
    const segment: SolvabilitySegment = {
      id,
      type: entry.type,
      ...(typeof entry.grading === 'string' ? { grading: entry.grading } : {}),
      ...(typeof entry.prompt === 'string' ? { prompt: entry.prompt } : {}),
      payload: asRecord(entry.payload) ?? {},
    };
    const context: SolvabilityContext = {
      answerKey: answerKeys && Object.hasOwn(answerKeys, id) ? answerKeys[id] : undefined,
      ageBand: typeof document.age_band === 'string' ? document.age_band : undefined,
      locale: typeof document.locale === 'string' ? document.locale : undefined,
      nodeBudget,
    };
    const blocked = (code: SolvabilityCode, message: string): SolvabilityFinding => ({ severity: 'block', segmentId: id, type: entry.type as string, code, message: cap(`solvability/${code}: ${message}`) });
    let outcome: unknown;
    try {
      outcome = checker(segment, context);
    } catch (error) {
      findings.push(blocked('checker-error', `the ${entry.type} checker threw (${error instanceof Error ? error.message : String(error)}); an unproven board is never published`));
      continue;
    }
    if (!isResult(outcome)) {
      findings.push(blocked('checker-error', `the ${entry.type} checker returned a malformed result`));
      continue;
    }
    for (const item of outcome.issues) {
      findings.push({
        severity: item.severity === 'review' ? 'review' : 'block',
        segmentId: id,
        type: entry.type,
        code: item.code,
        message: cap(`solvability/${item.code}: ${item.path ? `${item.path}: ` : ''}${item.message}`),
      });
    }
    if (!outcome.ok && !outcome.issues.some((item) => item.severity !== 'review')) {
      findings.push(blocked('checker-error', `the ${entry.type} checker reported not ok without naming a blocking issue`));
    }
  }
  return findings;
}
