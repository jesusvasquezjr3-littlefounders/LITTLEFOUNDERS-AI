import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { V2_SEGMENT_TYPES } from '../v2/contract.js';
import { emitV2Lesson } from '../v2/emit.js';
import { FIXTURE_PLANS } from '../v2/cli.js';
import { runV2DocumentGates } from '../v2/gates.js';
import { loadV2Plans, type V2LessonPlan } from '../v2/plan.js';
import {
  Budget, COVERAGE_LIMIT, DEFAULT_NODE_BUDGET, MAX_NODE_BUDGET, capIssues, checkGridPlacement, checkIntervalOverlap, checkInvariants,
  checkPointSpacing, checkReferences, checkRectLayout, checkRubricCoverage, checkUniqueIds, clampBudget, exploreStateSpace, issue,
  judgeReachability, mergeResults, registerSolvabilityChecker, registeredSolvabilityTypes, result, runSolvabilityGate, searchArrangements,
  searchAssignments, solvabilityCheckerFor, solvabilityCoverage, stableKey, unregisterSolvabilityChecker, verifyUniqueOrCovered,
  type SolvabilityChecker, type SolvabilityContext, type SolvabilityResult,
} from '../v2/solvability.js';
import { coinTrayChecker, fewestPieces, makingChangeChecker, readTray } from '../v2/solvabilityBuiltins.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const V2_DIR = path.resolve(here, '../v2');
const codes = (issues: ReadonlyArray<{ code: string }>) => issues.map((item) => item.code);
const context = (overrides: Partial<SolvabilityContext> = {}): SolvabilityContext => ({ answerKey: undefined, ageBand: undefined, locale: undefined, nodeBudget: DEFAULT_NODE_BUDGET, ...overrides });
const segment = (type: string, payload: Record<string, unknown>, id = 's1') => ({ id, type, grading: 'server', payload });

describe('budget and keys', () => {
  it('clamps a requested budget into the hard range', () => {
    expect(clampBudget()).toBe(DEFAULT_NODE_BUDGET);
    expect(clampBudget(0)).toBe(DEFAULT_NODE_BUDGET);
    expect(clampBudget(Number.NaN)).toBe(DEFAULT_NODE_BUDGET);
    expect(clampBudget(5.7)).toBe(5);
    expect(clampBudget(1e12)).toBe(MAX_NODE_BUDGET);
  });

  it('a Budget refuses work past its limit', () => {
    const budget = new Budget(3);
    expect([budget.spend(), budget.spend(), budget.spend(), budget.spend()]).toEqual([true, true, true, false]);
    expect(budget.exceeded).toBe(true);
  });

  it('stableKey ignores object key order and keeps list order', () => {
    expect(stableKey({ b: 1, a: { d: 2, c: 3 } })).toBe(stableKey({ a: { c: 3, d: 2 }, b: 1 }));
    expect(stableKey([1, 2])).not.toBe(stableKey([2, 1]));
    expect(stableKey(undefined)).toBe('undefined');
  });
});

describe('searchAssignments', () => {
  const sums = (limit: number, domain = [1, 2, 3, 4]) => searchAssignments<number>({
    domains: [domain, domain, domain],
    distinct: true,
    isSolution: (full) => full[0]! + full[1]! === full[2]!,
    limit,
  });

  it('finds every solution of a solvable board and proves the search was exhaustive', () => {
    const search = sums(10);
    expect(search.count).toBe(4);
    expect(search.exhaustive).toBe(true);
    expect(search.keys).toContain(stableKey([1, 2, 3]));
  });

  it('stops at the limit, which is enough to refute uniqueness', () => {
    const search = sums(2);
    expect(search.count).toBe(2);
    expect(search.stoppedAtLimit).toBe(true);
    expect(search.exhaustive).toBe(false);
  });

  it('proves a unique solution', () => {
    const search = searchAssignments<number>({
      domains: [[1, 2, 3], [1, 2, 3], [1, 2, 3]],
      distinct: true,
      accept: (partial) => partial.length < 2 || partial[0]! < partial[1]!,
      isSolution: (full) => full[0]! + full[1]! === full[2]!,
    });
    expect(search.solutions).toEqual([[1, 2, 3]]);
    expect(search.exhaustive).toBe(true);
  });

  it('proves an unsolvable board has no solution', () => {
    const search = searchAssignments<number>({ domains: [[2, 4], [2, 4], [3]], isSolution: (full) => full[0]! + full[1]! === full[2]! });
    expect(search.count).toBe(0);
    expect(search.exhaustive).toBe(true);
  });

  it('merges solutions that share a canonical key', () => {
    const search = searchAssignments<number>({
      domains: [[1, 2], [1, 2]],
      key: (full) => stableKey([...full].sort()),
      limit: 10,
    });
    expect(search.count).toBe(3);
  });

  it('reports an over-budget search instead of hanging', () => {
    const search = searchAssignments<number>({ domains: Array.from({ length: 8 }, () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), isSolution: () => false, maxNodes: 5_000 });
    expect(search.budgetExceeded).toBe(true);
    expect(search.exhaustive).toBe(false);
    expect(search.nodes).toBeLessThanOrEqual(5_000);
  });

  it('refuses an absurd number of slots', () => {
    const search = searchAssignments<number>({ domains: Array.from({ length: 300 }, () => [0, 1]) });
    expect(search.budgetExceeded).toBe(true);
    expect(search.count).toBe(0);
  });
});

describe('searchArrangements', () => {
  const tiles = ['1', '2', '3', '+', '='];
  const holds = (full: readonly string[]) => full[1] === '+' && full[3] === '=' && [full[0], full[2], full[4]].every((tile) => /^\d$/.test(tile ?? ''))
    && Number(full[0]) + Number(full[2]) === Number(full[4]);
  const commutative = (full: readonly string[]) => `${[full[0], full[2]].sort().join('+')}=${full[4]}`;

  it('counts a swap of operands as a second solution unless the key says otherwise', () => {
    expect(searchArrangements({ pool: tiles, isSolution: holds }).count).toBe(2);
    const unique = searchArrangements({ pool: tiles, isSolution: holds, key: commutative });
    expect(unique.count).toBe(1);
    expect(unique.exhaustive).toBe(true);
  });

  it('treats identical tiles as interchangeable, so equal tiles do not multiply solutions', () => {
    const search = searchArrangements({ pool: ['1', '1', '2', '+', '='], isSolution: holds, limit: 50 });
    expect(search.count).toBe(1);
    expect(search.solutions[0]).toEqual(['1', '+', '1', '=', '2']);
  });

  it('proves a tile set that cannot make an equation unsolvable', () => {
    const search = searchArrangements({ pool: ['1', '1', '+', '='], isSolution: holds });
    expect(search.count).toBe(0);
    expect(search.exhaustive).toBe(true);
  });

  it('can fill fewer slots than the pool holds', () => {
    const search = searchArrangements({ pool: ['a', 'b', 'c'], slots: 2, limit: 20 });
    expect(search.count).toBe(6);
  });

  it('is over budget on a permutation space it cannot finish', () => {
    const search = searchArrangements({ pool: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], isSolution: () => false, maxNodes: 1_000 });
    expect(search.budgetExceeded).toBe(true);
  });
});

describe('verifyUniqueOrCovered', () => {
  const pool = ['1', '2', '3', '+', '='];
  const holds = (full: readonly string[]) => full[1] === '+' && full[3] === '=' && Number(full[0]) + Number(full[2]) === Number(full[4]) && [full[0], full[2], full[4]].every((tile) => /^\d$/.test(tile ?? ''));
  const run = (limit: number) => searchArrangements({ pool, isSolution: holds, limit });
  const both = [stableKey(['1', '+', '2', '=', '3']), stableKey(['2', '+', '1', '=', '3'])];
  const isSolutionKey = (key: string) => holds(JSON.parse(key) as string[]);

  it('accepts a board with one solution', () => {
    const ok = verifyUniqueOrCovered((limit) => searchArrangements({ pool, isSolution: holds, limit, key: (full) => [full[0], full[2]].sort().join('+') }), { subject: 'tiles' });
    expect(ok.ok).toBe(true);
    expect(ok.stats?.solutions).toBe(1);
  });

  it('blocks a board with no solution', () => {
    const verdict = verifyUniqueOrCovered((limit) => searchArrangements({ pool: ['1', '1', '+', '='], isSolution: holds, limit }), { subject: 'tiles' });
    expect(verdict.ok).toBe(false);
    expect(codes(verdict.issues)).toEqual(['no-solution']);
  });

  it('blocks an ambiguous board no rubric covers', () => {
    const verdict = verifyUniqueOrCovered(run, { subject: 'tiles' });
    expect(verdict.ok).toBe(false);
    expect(codes(verdict.issues)).toEqual(['ambiguous-solution']);
  });

  it('accepts an ambiguous board whose rubric covers every solution', () => {
    expect(verifyUniqueOrCovered(run, { subject: 'tiles', acceptance: new Set(both), isSolution: isSolutionKey }).ok).toBe(true);
    expect(verifyUniqueOrCovered(run, { subject: 'tiles', acceptance: (key) => isSolutionKey(key) }).ok).toBe(true);
  });

  it('blocks a rubric that rejects a valid solution', () => {
    const verdict = verifyUniqueOrCovered(run, { subject: 'tiles', acceptance: [both[0]!] });
    expect(codes(verdict.issues)).toEqual(['rubric-gap']);
    expect(verdict.ok).toBe(false);
  });

  it('blocks a rubric that accepts an answer which is not a solution', () => {
    const verdict = verifyUniqueOrCovered(run, { subject: 'tiles', acceptance: [...both, stableKey(['1', '+', '1', '=', '3'])], isSolution: isSolutionKey });
    expect(codes(verdict.issues)).toEqual(['rubric-accepts-invalid']);
  });

  it('blocks an over-budget search: not proven is not published', () => {
    const verdict = verifyUniqueOrCovered((limit) => searchArrangements({ pool: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], isSolution: () => false, limit, maxNodes: 500 }), { subject: 'tiles' });
    expect(verdict.ok).toBe(false);
    expect(codes(verdict.issues)).toEqual(['budget-exceeded']);
  });

  it('blocks a unique-looking board whose search could not finish', () => {
    const verdict = verifyUniqueOrCovered((limit) => searchAssignments<number>({ domains: [[1], ...Array.from({ length: 7 }, () => [1, 0, 2, 3, 4, 5, 6, 7, 8, 9])], isSolution: (full) => full.every((value) => value === 1), limit, maxNodes: 200 }), { subject: 'cells' });
    expect(codes(verdict.issues)).toEqual(['budget-exceeded']);
  });

  it('refuses to cover more solutions than it can enumerate', () => {
    const wide = Array.from({ length: 30 }, (_, index) => index);
    const verdict = verifyUniqueOrCovered((limit) => searchAssignments<number>({ domains: [wide, wide], limit }), { subject: 'cells', acceptance: () => true });
    expect(codes(verdict.issues)).toEqual(['budget-exceeded']);
    expect(verdict.issues[0]?.message).toContain(String(COVERAGE_LIMIT));
  });

  it('lets a board graded by predicate have many solutions', () => {
    const wide = Array.from({ length: 30 }, (_, index) => index);
    const verdict = verifyUniqueOrCovered((limit) => searchAssignments<number>({ domains: [wide, wide], limit }), { subject: 'cells', predicateGraded: true });
    expect(verdict.ok).toBe(true);
  });

  it('checkRubricCoverage reports both directions on its own', () => {
    expect(checkRubricCoverage(['a', 'b'], new Set(['a', 'b']), { subject: 'x' })).toEqual([]);
    expect(codes(checkRubricCoverage(['a', 'b'], ['a', 'z'], { subject: 'x', isSolution: (key) => key !== 'z' }))).toEqual(['rubric-gap', 'rubric-accepts-invalid']);
  });
});

describe('exploreStateSpace and judgeReachability', () => {
  const walk = (limit: number, jumps: number[], extra: { maxNodes?: number; maxDepth?: number; full?: boolean } = {}) => exploreStateSpace<number, number>({
    initial: [0],
    moves: (at) => jumps.map((jump) => ({ move: jump, next: at + jump })).filter((step) => step.next <= limit),
    isGoal: (at) => at === limit,
    key: (at) => String(at),
    ...extra,
  });

  it('finds the shortest solution and counts how many there are', () => {
    const many = walk(5, [1, 2]);
    expect(many.goalReached).toBe(true);
    expect(many.shortest).toBe(3);
    expect(many.shortestPaths).toBe(3);
    expect(many.shortestPath).toHaveLength(3);
    expect(codes(judgeReachability(many, { subject: 'walk', requireUniqueShortest: true }).issues)).toEqual(['ambiguous-solution']);
    const one = walk(6, [1, 3]);
    expect(one.shortest).toBe(2);
    expect(one.shortestPaths).toBe(1);
    expect(judgeReachability(one, { subject: 'walk', requireUniqueShortest: true }).ok).toBe(true);
  });

  it('proves an unreachable goal when the whole space was explored', () => {
    const none = walk(5, [2]);
    expect(none.goalReached).toBe(false);
    expect(none.complete).toBe(true);
    expect(codes(judgeReachability(none, { subject: 'walk' }).issues)).toEqual(['no-solution']);
  });

  it('solves the 3 and 5 litre jug board in 6 moves and proves 2 and 4 cannot make 3', () => {
    const jugs = (cap: [number, number], goal: number) => exploreStateSpace<[number, number], string>({
      initial: [[0, 0]],
      moves: ([a, b]) => {
        const toB = Math.min(a, cap[1] - b);
        const toA = Math.min(b, cap[0] - a);
        const moves: Array<{ move: string; next: [number, number] }> = [
          { move: 'fill A', next: [cap[0], b] }, { move: 'fill B', next: [a, cap[1]] },
          { move: 'empty A', next: [0, b] }, { move: 'empty B', next: [a, 0] },
          { move: 'A to B', next: [a - toB, b + toB] }, { move: 'B to A', next: [a + toA, b - toA] },
        ];
        return moves;
      },
      isGoal: ([a, b]) => a === goal || b === goal,
      key: ([a, b]) => `${a},${b}`,
    });
    expect(jugs([3, 5], 4).shortest).toBe(6);
    const stuck = jugs([2, 4], 3);
    expect(stuck.goalReached).toBe(false);
    expect(stuck.complete).toBe(true);
  });

  it('lists dead ends the learner can wander into', () => {
    const graph: Record<string, string[]> = { A: ['B', 'T'], B: ['G'], T: ['T2'], T2: ['T'], G: [] };
    const explored = exploreStateSpace<string, string>({
      initial: ['A'],
      moves: (state) => graph[state]!.map((next) => ({ move: `${state}>${next}`, next })),
      isGoal: (state) => state === 'G',
      key: (state) => state,
      full: true,
    });
    expect(explored.goalReached).toBe(true);
    expect(explored.deadEnds.sort()).toEqual(['T', 'T2']);
    expect(codes(judgeReachability(explored, { subject: 'maze', forbidDeadEnds: true }).issues)).toEqual(['dead-end']);
    expect(judgeReachability(explored, { subject: 'maze' }).ok).toBe(true);
  });

  it('blocks when an unbounded space cannot be finished inside the budget', () => {
    const endless = exploreStateSpace<number, number>({ initial: [0], moves: (at) => [{ move: 1, next: at + 1 }], isGoal: (at) => at < 0, key: (at) => String(at), maxNodes: 50 });
    expect(endless.budgetExceeded).toBe(true);
    expect(endless.complete).toBe(false);
    expect(codes(judgeReachability(endless, { subject: 'endless' }).issues)).toEqual(['budget-exceeded']);
  });

  it('names the move limit when a depth cut hides the goal', () => {
    const cut = walk(10, [1], { maxDepth: 3 });
    expect(cut.truncated).toBe(true);
    expect(judgeReachability(cut, { subject: 'walk' }).issues[0]?.message).toContain('move limit');
  });

  it('refuses dead-end proofs it could not complete', () => {
    const partial = walk(100, [1, 2], { full: true, maxNodes: 20 });
    expect(codes(judgeReachability(partial, { subject: 'walk', forbidDeadEnds: true }).issues)).toContain('budget-exceeded');
  });
});

describe('overlap detection', () => {
  it('finds cells that share a grid square, leave the grid or sit off-grid', () => {
    const issues = checkGridPlacement(
      [{ id: 'A', row: 0, col: 0, rowSpan: 2, colSpan: 2 }, { id: 'B', row: 1, col: 1 }, { id: 'C', row: 4, col: 3 }, { id: 'D', row: 0.5, col: 1 }],
      { rows: 4, cols: 4 },
    );
    expect(codes(issues).sort()).toEqual(['impossible-state', 'out-of-bounds', 'overlap']);
    expect(checkGridPlacement([{ id: 'A', row: 0, col: 0 }, { id: 'B', row: 0, col: 1 }, { id: 'C', row: 1, col: 0, colSpan: 2 }], { rows: 2, cols: 2 })).toEqual([]);
  });

  it('reports each overlapping pair once', () => {
    const issues = checkGridPlacement([{ id: 'A', row: 0, col: 0, rowSpan: 2, colSpan: 2 }, { id: 'B', row: 0, col: 0, rowSpan: 2, colSpan: 2 }]);
    expect(issues.filter((item) => item.code === 'overlap')).toHaveLength(1);
  });

  it('gives up on a grid too large to prove', () => {
    const issues = checkGridPlacement([{ id: 'A', row: 0, col: 0, rowSpan: 1_000_000, colSpan: 1_000_000 }]);
    expect(codes(issues)).toEqual(['budget-exceeded']);
  });

  it('finds rectangles that overlap or crowd each other, and lets touching ones be', () => {
    const rects = [{ id: 'a', x: 0, y: 0, w: 10, h: 10 }, { id: 'b', x: 5, y: 5, w: 10, h: 10 }, { id: 'c', x: 10, y: 0, w: 4, h: 4 }, { id: 'd', x: 100, y: 100, w: 5, h: 5 }];
    const issues = checkRectLayout(rects, { bounds: { id: 'board', x: 0, y: 0, w: 110, h: 110 } });
    expect(issues.filter((item) => item.code === 'overlap').map((item) => item.message).join(' ')).toContain('"a" and "b"');
    expect(issues.some((item) => item.message.includes('"a" and "c"'))).toBe(false);
    expect(codes(checkRectLayout([{ id: 'a', x: 0, y: 0, w: 10, h: 10 }, { id: 'c', x: 10, y: 0, w: 4, h: 4 }], { gap: 2 }))).toEqual(['overlap']);
    expect(codes(checkRectLayout([{ id: 'z', x: 0, y: 0, w: 0, h: 5 }, { id: 'out', x: 120, y: 0, w: 5, h: 5 }], { bounds: { id: 'board', x: 0, y: 0, w: 110, h: 110 } })).sort()).toEqual(['impossible-state', 'out-of-bounds']);
  });

  it('finds points closer than the minimum distance', () => {
    const points = [{ id: 'p', x: 0, y: 0 }, { id: 'q', x: 3, y: 4 }, { id: 'r', x: 3.5, y: 4 }, { id: 's', x: Number.NaN, y: 0 }];
    const issues = checkPointSpacing(points, { minDistance: 1 });
    expect(codes(issues).sort()).toEqual(['impossible-state', 'overlap']);
    expect(issues.find((item) => item.code === 'overlap')?.message).toContain('"q" and "r"');
    expect(checkPointSpacing(points.slice(0, 2), { minDistance: 5 })).toEqual([]);
    expect(codes(checkPointSpacing(points.slice(0, 2), { minDistance: 6 }))).toEqual(['overlap']);
  });

  it('finds intervals that overlap, with touching ends allowed by default', () => {
    const bands = [{ id: 'low', start: 0, end: 10 }, { id: 'mid', start: 10, end: 20 }, { id: 'high', start: 15, end: 30 }, { id: 'bad', start: 5, end: 2 }];
    const issues = checkIntervalOverlap(bands);
    expect(codes(issues).sort()).toEqual(['impossible-state', 'overlap']);
    expect(checkIntervalOverlap(bands.slice(0, 2))).toEqual([]);
    expect(codes(checkIntervalOverlap(bands.slice(0, 2), { allowTouching: false }))).toEqual(['overlap']);
  });

  it('refuses layouts it cannot prove', () => {
    const many = Array.from({ length: 2_001 }, (_, index) => ({ id: `n${index}`, x: index * 20, y: 0, w: 10, h: 10 }));
    expect(codes(checkRectLayout(many))).toEqual(['too-large']);
  });

  it('keeps a broken layout readable by capping the list', () => {
    const stack = Array.from({ length: 12 }, (_, index) => ({ id: `n${index}`, x: 0, y: 0, w: 10, h: 10 }));
    const issues = checkRectLayout(stack);
    expect(issues).toHaveLength(6);
    expect(issues.at(-1)?.message).toMatch(/more overlap problem/);
    expect(capIssues([issue('overlap', 'x')])).toHaveLength(1);
  });
});

describe('impossible states', () => {
  it('finds duplicate ids, dangling references and violated invariants', () => {
    expect(codes(checkUniqueIds(['a', 'b', 'a', 'a'], 'tile'))).toEqual(['duplicate-id']);
    expect(checkUniqueIds(['a', 'b'])).toEqual([]);
    expect(codes(checkReferences([{ from: 'x', to: 'a' }, { from: 'y', to: 'nope' }], ['a', 'b']))).toEqual(['dangling-reference']);
    expect(checkReferences([{ from: 'x', to: 'a' }], new Set(['a']))).toEqual([]);
    const tray = { held: 12, capacity: 10 };
    const found = checkInvariants(tray, [{ check: (item) => (item.held > item.capacity ? `holds ${item.held} of ${item.capacity}` : null) }, { check: () => undefined }]);
    expect(found).toHaveLength(1);
    expect(found[0]?.code).toBe('impossible-state');
  });

  it('mergeResults sums stats and keeps every issue', () => {
    const merged = mergeResults(result([], { nodes: 3 }), result([issue('overlap', 'x')], { nodes: 4, solutions: 1 }), result([issue('overlap', 'note', { severity: 'review' })]));
    expect(merged.ok).toBe(false);
    expect(merged.issues).toHaveLength(2);
    expect(merged.stats).toEqual({ nodes: 7, solutions: 1 });
    expect(result([issue('overlap', 'note', { severity: 'review' })]).ok).toBe(true);
  });
});

describe('the registry and the gate runner', () => {
  const TYPE = 'test.board.v2';
  afterEach(() => {
    unregisterSolvabilityChecker(TYPE);
  });
  const doc = (segments: unknown[] = [segment(TYPE, { n: 1 })]) => ({ age_band: '6-9', locale: 'en-US', segments });
  const register = (checker: SolvabilityChecker) => registerSolvabilityChecker(TYPE, checker);

  it('registers once per type and refuses a second proof', () => {
    register(() => result([]));
    expect(() => register(() => result([]))).toThrow(/already registered/);
    expect(solvabilityCheckerFor(TYPE)).toBeTypeOf('function');
    expect(registeredSolvabilityTypes()).toContain(TYPE);
    expect(unregisterSolvabilityChecker(TYPE)).toBe(true);
    expect(unregisterSolvabilityChecker(TYPE)).toBe(false);
  });

  it('ships checkers for the money boards and only for real v2 segment types', () => {
    expect(registeredSolvabilityTypes()).toEqual(expect.arrayContaining(['money.coin-tray.v2', 'money.making-change.v2']));
    for (const type of registeredSolvabilityTypes()) expect(V2_SEGMENT_TYPES as readonly string[]).toContain(type);
    expect(solvabilityCoverage(['money.coin-tray.v2', 'story.branch.v2'])).toEqual({ checked: ['money.coin-tray.v2'], unchecked: ['story.branch.v2'] });
  });

  it('passes a document with no checkers for its types unchanged', () => {
    expect(runSolvabilityGate({ segments: [segment('story.branch.v2', {}), { id: 'x' }, 'junk'] })).toEqual([]);
    expect(runSolvabilityGate({})).toEqual([]);
  });

  it('maps checker issues to block and review findings with a stable prefix', () => {
    register(() => result([issue('no-solution', 'cannot win', { path: 'payload.tiles' }), issue('vacuous-rubric', 'nothing tested', { severity: 'review' })]));
    const findings = runSolvabilityGate(doc());
    expect(findings).toEqual([
      { severity: 'block', segmentId: 's1', type: TYPE, code: 'no-solution', message: 'solvability/no-solution: payload.tiles: cannot win' },
      { severity: 'review', segmentId: 's1', type: TYPE, code: 'vacuous-rubric', message: 'solvability/vacuous-rubric: nothing tested' },
    ]);
  });

  it('passes the private rubric, age band, locale and a clamped budget to the checker', () => {
    const seen: SolvabilityContext[] = [];
    register((_segment, given) => {
      seen.push(given);
      return result([]);
    });
    runSolvabilityGate(doc([segment(TYPE, {}, 'a'), segment(TYPE, {}, 'b')]), { a: { target: 1 } }, { nodeBudget: 9e12 });
    expect(seen[0]).toEqual({ answerKey: { target: 1 }, ageBand: '6-9', locale: 'en-US', nodeBudget: MAX_NODE_BUDGET });
    expect(seen[1]?.answerKey).toBeUndefined();
  });

  it('fails closed when a checker throws', () => {
    register(() => {
      throw new Error('boom');
    });
    const findings = runSolvabilityGate(doc());
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'block', code: 'checker-error' });
    expect(findings[0]?.message).toContain('boom');
  });

  it('fails closed on a malformed result, and on not-ok with nothing named', () => {
    register(() => ({}) as unknown as SolvabilityResult);
    expect(runSolvabilityGate(doc())[0]).toMatchObject({ severity: 'block', code: 'checker-error' });
    unregisterSolvabilityChecker(TYPE);
    register(() => ({ ok: false, issues: [] }));
    expect(runSolvabilityGate(doc())[0]).toMatchObject({ severity: 'block', code: 'checker-error' });
  });

  it('blocks on a blocking issue even when the checker claims ok, and on an unknown severity', () => {
    register(() => ({ ok: true, issues: [{ code: 'overlap', severity: 'block', message: 'x' }, { code: 'overlap', severity: 'nonsense' as unknown as 'block', message: 'y' }] }));
    expect(runSolvabilityGate(doc()).map((finding) => finding.severity)).toEqual(['block', 'block']);
  });

  it('caps a runaway message', () => {
    register(() => result([issue('overlap', 'x'.repeat(5_000))]));
    expect(runSolvabilityGate(doc())[0]?.message.length).toBeLessThanOrEqual(560);
  });
});

describe('fewestPieces', () => {
  const brute = (tray: Array<{ value: number; available: number }>) => {
    const best = new Map<number, number>();
    const walk = (index: number, sum: number, pieces: number) => {
      if (index === tray.length) {
        if (pieces < (best.get(sum) ?? Infinity)) best.set(sum, pieces);
        return;
      }
      for (let count = 0; count <= tray[index]!.available; count += 1) walk(index + 1, sum + count * tray[index]!.value, pieces + count);
    };
    walk(0, 0, 0);
    return best;
  };

  it('matches exhaustive enumeration on many trays', () => {
    let seed = 20_260_702;
    const rand = (below: number) => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed % below;
    };
    for (let round = 0; round < 60; round += 1) {
      const values = new Set<number>();
      const wanted = 2 + rand(3);
      while (values.size < wanted) values.add(1 + rand(12));
      const tray = [...values].sort((a, b) => b - a).map((value) => ({ value, available: 1 + rand(4) }));
      const best = brute(tray);
      const total = tray.reduce((sum, piece) => sum + piece.value * piece.available, 0);
      for (let target = 1; target <= total; target += 1) {
        expect(fewestPieces(target, tray, new Budget(1_000_000))).toBe(best.get(target) ?? null);
      }
    }
  });

  it('reports a spent budget as undefined, not as unsolvable', () => {
    expect(fewestPieces(1_000, [{ value: 10, available: 20 }, { value: 1, available: 20 }], new Budget(100))).toBeUndefined();
  });
});

describe('the coin tray checker', () => {
  const tray = [{ value_minor: 10, kind: 'coin', available: 3 }, { value_minor: 5, kind: 'coin', available: 3 }, { value_minor: 1, kind: 'coin', available: 6 }];
  const check = (payload: Record<string, unknown>, answerKey?: unknown, budget = DEFAULT_NODE_BUDGET) => coinTrayChecker(segment('money.coin-tray.v2', payload, 'coins-01'), context({ answerKey, nodeBudget: budget }));
  const payload = { currency: 'coins', denominations: tray };

  it('accepts a target the tray can build, and reports the fewest pieces', () => {
    const verdict = check(payload, { target_minor: 17, fewest: true });
    expect(verdict.ok).toBe(true);
    expect(verdict.stats?.fewest).toBe(4);
  });

  it('checks only the tray when the rubric is not available (release time)', () => {
    expect(check(payload).ok).toBe(true);
    expect(codes(check({ currency: 'coins', denominations: [tray[0], tray[0]] }).issues)).toEqual(['impossible-state']);
  });

  it('blocks a target above everything the tray holds', () => {
    const verdict = check(payload, { target_minor: 52, fewest: false });
    expect(codes(verdict.issues)).toEqual(['no-solution']);
    expect(verdict.ok).toBe(false);
  });

  it('blocks a target no mix of pieces makes exactly', () => {
    const sparse = { currency: 'coins', denominations: [{ value_minor: 10, kind: 'coin', available: 2 }, { value_minor: 5, kind: 'coin', available: 1 }] };
    expect(codes(check(sparse, { target_minor: 7, fewest: false }).issues)).toEqual(['no-solution']);
    expect(check(sparse, { target_minor: 25, fewest: false }).ok).toBe(true);
  });

  it('blocks a malformed rubric and a malformed tray', () => {
    expect(codes(check(payload, { target_minor: 17 }).issues)).toEqual(['impossible-state']);
    expect(codes(check(payload, { target_minor: 0, fewest: false }).issues)).toEqual(['impossible-state']);
    expect(codes(check(payload, 'seventeen').issues)).toEqual(['impossible-state']);
    expect(codes(readTray([{ value_minor: 5, available: 1 }, { value_minor: 10, available: 1 }], 'tray').issues)).toEqual(['impossible-state']);
    expect(readTray('nope', 'tray').tray).toEqual([]);
  });

  it('marks a "fewest" ask that tests nothing for review', () => {
    const forced = { currency: 'coins', denominations: [{ value_minor: 10, kind: 'coin', available: 1 }, { value_minor: 5, kind: 'coin', available: 1 }] };
    const verdict = check(forced, { target_minor: 15, fewest: true });
    expect(verdict.ok).toBe(true);
    expect(verdict.issues).toMatchObject([{ code: 'vacuous-rubric', severity: 'review' }]);
    expect(check(forced, { target_minor: 15, fewest: false }).issues).toEqual([]);
  });

  it('blocks when the budget cannot prove it', () => {
    const big = { currency: 'local', denominations: [{ value_minor: 500, kind: 'bill', available: 20 }, { value_minor: 100, kind: 'coin', available: 20 }] };
    const verdict = check(big, { target_minor: 9_000, fewest: false }, 50);
    expect(codes(verdict.issues)).toEqual(['budget-exceeded']);
    expect(check(big, { target_minor: 9_000, fewest: false }).ok).toBe(true);
  });
});

describe('the making-change checker', () => {
  const tray = [{ value_minor: 10, kind: 'coin', available: 3 }, { value_minor: 5, kind: 'coin', available: 3 }, { value_minor: 1, kind: 'coin', available: 6 }];
  const check = (payload: Record<string, unknown>, answerKey?: unknown) => makingChangeChecker(segment('money.making-change.v2', payload, 'change-01'), context({ answerKey }));
  const payload = { currency: 'coins', denominations: tray, price_minor: 13, paid_minor: 20 };

  it('accepts change the tray can return, with or without the rubric', () => {
    expect(check(payload, { change_minor: 7 }).ok).toBe(true);
    expect(check(payload).ok).toBe(true);
  });

  it('blocks a rubric that is not the payment minus the price', () => {
    expect(codes(check(payload, { change_minor: 8 }).issues)).toEqual(['impossible-state']);
    expect(codes(check(payload, { change_minor: 7, extra: 1 }).issues)).toEqual(['impossible-state']);
  });

  it('blocks change the tray cannot return exactly, from the public payload alone', () => {
    const coarse = { ...payload, denominations: tray.slice(0, 2) };
    expect(codes(check(coarse).issues)).toEqual(['no-solution']);
    expect(codes(check({ ...payload, paid_minor: 100 }).issues)).toEqual(['no-solution']);
  });

  it('blocks a payment that is not above the price', () => {
    expect(codes(check({ ...payload, paid_minor: 13 }).issues)).toEqual(['impossible-state']);
  });

  it('blocks change that needs more coins than the counting-up sequence allows', () => {
    const heavy = { currency: 'coins', denominations: [4, 3, 2, 1].map((value) => ({ value_minor: value, kind: 'coin', available: 20 })), price_minor: 1, paid_minor: 201 };
    expect(codes(check(heavy).issues)).toEqual(['impossible-state']);
    expect(check({ ...heavy, paid_minor: 101 }).ok).toBe(true);
  });
});

describe('the gate inside the real emitter', () => {
  const plans = loadV2Plans(FIXTURE_PLANS);
  const young = plans.map((entry) => entry.plan!).find((plan) => plan.lesson_id === 'v2-first-release-young-money')!;
  const clone = (plan: V2LessonPlan): V2LessonPlan => JSON.parse(JSON.stringify(plan));
  const segmentOf = (plan: V2LessonPlan, id: string) => plan.segments.find((item) => item.id === id)!;
  const solvabilityProblems = (problems: Array<{ gate: number; message: string }>) => problems.filter((problem) => problem.message.startsWith('solvability/'));

  it('lets the committed money lesson through, and no answerless document trips the gate at release time', () => {
    const emitted = emitV2Lesson(young, { versionId: 'forge-solv-test' });
    expect(solvabilityProblems(emitted.problems)).toEqual([]);
    expect(emitted.review.filter((item) => item.message.startsWith('solvability/'))).toEqual([]);
    expect(emitted.documents.length).toBeGreaterThan(0);
    for (const output of emitted.documents) expect(solvabilityProblems(runV2DocumentGates(output.document).problems)).toEqual([]);
  });

  it('blocks a tray rubric nobody can reach, once per market, on gate 1', () => {
    const plan = clone(young);
    segmentOf(plan, 'coins-01').rubric = { target_minor: 200, fewest: true };
    const emitted = emitV2Lesson(plan, { versionId: 'forge-solv-test' });
    const found = solvabilityProblems(emitted.problems);
    expect(emitted.ok).toBe(false);
    expect(emitted.documents).toEqual([]);
    expect(found).toHaveLength(3);
    expect(found.every((problem) => problem.gate === 1 && problem.message.includes('solvability/no-solution'))).toBe(true);
  });

  it('blocks unreturnable change from the public document alone', () => {
    const plan = clone(young);
    const board = segmentOf(plan, 'change-01');
    const payload = board.payload as { denominations: unknown[] };
    payload.denominations = payload.denominations.slice(0, 2);
    const emitted = emitV2Lesson(plan, { versionId: 'forge-solv-test' });
    expect(solvabilityProblems(emitted.problems).length).toBeGreaterThan(0);
    const answerless = emitV2Lesson(clone(young), { versionId: 'forge-solv-test' }).documents[0]!.document;
    const broken = JSON.parse(JSON.stringify(answerless)) as { segments: Array<{ id: string; payload: { denominations: unknown[] } }> };
    const target = broken.segments.find((item) => item.id === 'change-01')!;
    target.payload.denominations = target.payload.denominations.slice(0, 2);
    expect(solvabilityProblems(runV2DocumentGates(broken as unknown as Parameters<typeof runV2DocumentGates>[0]).problems)).toHaveLength(1);
  });
});

describe('module layering', () => {
  it('keeps the verifier free of runtime imports so every pack can import it without a cycle', () => {
    const source = readFileSync(path.join(V2_DIR, 'solvability.ts'), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\bfrom\s+['"]/);
    expect(source).not.toMatch(/\brequire\(|\bimport\(/);
  });

  it('lists every horizonte module that registers a checker, and keeps them out of the gate cycle', () => {
    const packs = readFileSync(path.join(V2_DIR, 'solvabilityPacks.ts'), 'utf8');
    expect(packs).toContain("import './solvabilityBuiltins.js';");
    const dir = path.join(V2_DIR, 'horizonte');
    const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts')) : [];
    for (const name of files) {
      const source = readFileSync(path.join(dir, name), 'utf8');
      if (source.includes('registerSolvabilityChecker(')) expect(packs, `${name} registers a checker but solvabilityPacks.ts does not import it`).toContain(`./horizonte/${name.replace(/\.ts$/, '.js')}'`);
      expect(source, `${name} must not import the gate runner it is loaded by at runtime`).not.toMatch(/^\s*import\s+(?!type\b)[^;]*from '\.\.\/(gates|emit|cli|solvabilityPacks)\.js'/m);
    }
  });
});
