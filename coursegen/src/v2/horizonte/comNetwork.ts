import { issue, result, searchAssignments, type SolvabilityChecker, type SolvabilityIssue } from '../solvability.js';
import {
  graded, isId, keyRuleIssues, keysAre, prepareKey, record, repeated, sameKeys, sameSet, whole, withKey,
  type Frame, type Prepared, type Rec, type Slots,
} from './comShared.js';

/*
 * F2.16 networks and counting. Hand-mirrored from backend/src/services/horizonte/com/network.ts.
 * The board is graded by rule (an arrangement that meets the task), so the key lists examples and each must meet the rule.
 */

export const NETWORK_VISUALS = ['graph', 'shortest-path', 'choice-tree', 'pascal'] as const;
export type NetworkVisual = (typeof NETWORK_VISUALS)[number];

const NODE_MIN = 3;
const NODE_MAX = 7;
const GRAPH_EDGE_MAX = 9;
const PATH_EDGE_MAX = 12;
const WEIGHT_MAX = 9;
const NODE_GAP = 18;
const KEY_MAX = 8;
const TREE_ITEM_MIN = 2;
const TREE_ITEM_MAX = 4;
const TREE_LEAF_MAX = 24;
const PASCAL_ROWS_MIN = 5;
const PASCAL_ROWS_MAX = 10;
const PASCAL_MULTIPLE_MIN = 2;
const PASCAL_MULTIPLE_MAX = 5;

const ITEM_ID = /^[a-z0-9][a-z0-9_-]{2,30}$/;

interface NetNode { id: string; x: number; y: number }
interface NetEdge { id: string; from: string; to: string; weight?: number }
interface GraphPayload { task: 'odd' | 'trail'; nodes: NetNode[]; edges: NetEdge[] }
interface PathPayload { nodes: NetNode[]; edges: NetEdge[]; start: string; goal: string }
interface TreePayload { items: string[]; pick: number; mode: 'order' | 'group'; first?: string }
interface PascalPayload { rows: number; multiple: number }

const isNetworkVisual = (value: unknown): value is NetworkVisual => typeof value === 'string' && (NETWORK_VISUALS as readonly string[]).includes(value);
export { isNetworkVisual };

/** The Forge document names the visual, but a checker sees only the payload, so each visual carries a field no other has. */
export function networkVisualOf(payload: Rec): NetworkVisual | null {
  if (payload.task !== undefined) return 'graph';
  if (payload.start !== undefined || payload.goal !== undefined) return 'shortest-path';
  if (payload.items !== undefined) return 'choice-tree';
  if (payload.rows !== undefined) return 'pascal';
  return null;
}

/* ── graphs ── */

function nodesProblem(nodes: unknown): string | null {
  if (!Array.isArray(nodes) || nodes.length < NODE_MIN || nodes.length > NODE_MAX) return `A network has ${NODE_MIN} to ${NODE_MAX} nodes`;
  const seen = new Set<string>();
  for (const node of nodes as unknown[]) {
    if (!keysAre(node, ['id', 'x', 'y']) || !isId(node.id) || !whole(node.x, 0, 100) || !whole(node.y, 0, 100)) return 'Each node has an id and a whole position from 0 to 100';
    if (seen.has(node.id)) return 'Node ids are unique';
    seen.add(node.id);
  }
  const list = nodes as NetNode[];
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
    if (Math.hypot(list[i]!.x - list[j]!.x, list[i]!.y - list[j]!.y) < NODE_GAP) return `Nodes sit at least ${NODE_GAP} apart`;
  }
  return null;
}

function edgesProblem(nodes: readonly NetNode[], edges: unknown, weighted: boolean, max: number): string | null {
  if (!Array.isArray(edges) || edges.length < 2 || edges.length > max) return `A network has 2 to ${max} edges`;
  const ids = new Set(nodes.map((node) => node.id));
  const pairs = new Set<string>();
  for (const edge of edges as unknown[]) {
    if (!keysAre(edge, ['id', 'from', 'to'], weighted ? ['weight'] : []) || !isId(edge.id) || !isId(edge.from) || !isId(edge.to)) return 'Each edge has an id, a start and an end';
    if (weighted ? !whole(edge.weight, 1, WEIGHT_MAX) : edge.weight !== undefined) return weighted ? `Each edge carries a whole weight from 1 to ${WEIGHT_MAX}` : 'A graph edge carries no weight';
    if (ids.has(edge.id)) return 'Edge ids are unique and never a node id';
    ids.add(edge.id);
    if (edge.from === edge.to) return 'An edge joins two different nodes';
    if (!nodes.some((node) => node.id === edge.from) || !nodes.some((node) => node.id === edge.to)) return 'An edge joins two nodes of the network';
    const pair = [edge.from, edge.to].sort().join('|');
    if (weighted && pairs.has(pair)) return 'A weighted network joins two nodes by one edge at most';
    pairs.add(pair);
  }
  return null;
}

function oddNodes(payload: { nodes: readonly NetNode[]; edges: readonly NetEdge[] }): string[] {
  const count: Record<string, number> = Object.fromEntries(payload.nodes.map((node) => [node.id, 0]));
  for (const edge of payload.edges) { count[edge.from] = (count[edge.from] ?? 0) + 1; count[edge.to] = (count[edge.to] ?? 0) + 1; }
  return payload.nodes.filter((node) => count[node.id]! % 2 === 1).map((node) => node.id);
}

function reachable(edges: readonly NetEdge[], from: string): Set<string> {
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const here = queue.shift()!;
    for (const edge of edges) {
      const next = edge.from === here ? edge.to : edge.to === here ? edge.from : null;
      if (next !== null && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

/** `loose` leaves the odd-node count of a walk to the search, so a graph with no walk reads as no-solution, not as a malformed payload. */
function graphProblem(payload: unknown, loose = false): string | null {
  if (!keysAre(payload, ['task', 'nodes', 'edges'])) return 'A graph payload holds a task, nodes and edges';
  if (payload.task !== 'odd' && payload.task !== 'trail') return 'The graph task is odd or trail';
  const bad = nodesProblem(payload.nodes) ?? edgesProblem(payload.nodes as NetNode[], payload.edges, false, GRAPH_EDGE_MAX);
  if (bad) return bad;
  const graph = payload as unknown as GraphPayload;
  if (reachable(graph.edges, graph.nodes[0]!.id).size !== graph.nodes.length) return 'Every node is reachable from every other';
  const odd = oddNodes(graph).length;
  if (graph.task === 'odd' && odd < 2) return 'The odd task needs at least two odd nodes to mark';
  if (!loose && graph.task === 'trail' && odd !== 0 && odd !== 2) return 'A walk over every edge once needs zero or two odd nodes';
  return null;
}

/** Whether `order` walks the edges one after another (each shares the node the last one ended on); `full` asks for every edge exactly once. */
function isTrail(edges: readonly NetEdge[], order: readonly string[], full: boolean): boolean {
  if (order.length === 0 || new Set(order).size !== order.length) return false;
  if (full && order.length !== edges.length) return false;
  const byId = new Map(edges.map((edge) => [edge.id, edge]));
  let ends: Set<string> | null = null;
  for (const id of order) {
    const edge = byId.get(id);
    if (!edge) return false;
    if (ends === null) { ends = new Set([edge.from, edge.to]); continue; }
    const next = new Set<string>();
    for (const here of ends) {
      if (here === edge.from) next.add(edge.to);
      else if (here === edge.to) next.add(edge.from);
    }
    if (next.size === 0) return false;
    ends = next;
  }
  return true;
}

/* ── shortest path ── */

function pathWeight(edges: readonly NetEdge[], route: readonly string[]): number | null {
  let total = 0;
  for (let i = 0; i + 1 < route.length; i += 1) {
    const edge = edges.find((candidate) => (candidate.from === route[i] && candidate.to === route[i + 1]) || (candidate.to === route[i] && candidate.from === route[i + 1]));
    if (!edge) return null;
    total += edge.weight ?? 0;
  }
  return total;
}

/** Every shortest simple route from the start to the goal, in a fixed order, with its total. */
function shortestPaths(route: PathPayload): { distance: number; paths: string[][] } {
  let best = Infinity;
  let paths: string[][] = [];
  const seen = new Set<string>([route.start]);
  const trail = [route.start];
  const visit = (here: string, total: number): void => {
    if (total > best) return;
    if (here === route.goal) {
      if (total < best) { best = total; paths = []; }
      paths.push([...trail]);
      return;
    }
    for (const edge of route.edges) {
      const next = edge.from === here ? edge.to : edge.to === here ? edge.from : null;
      if (next === null || seen.has(next)) continue;
      seen.add(next); trail.push(next);
      visit(next, total + (edge.weight ?? 0));
      seen.delete(next); trail.pop();
    }
  };
  visit(route.start, 0);
  return { distance: best, paths: paths.sort((a, b) => a.join('|').localeCompare(b.join('|'))) };
}

/** `loose` leaves the reachability of the goal to the search, so an unreachable goal reads as no-solution. */
function pathProblem(payload: unknown, loose = false): string | null {
  if (!keysAre(payload, ['nodes', 'edges', 'start', 'goal'])) return 'A route payload holds nodes, edges, a start and a goal';
  const bad = nodesProblem(payload.nodes) ?? edgesProblem(payload.nodes as NetNode[], payload.edges, true, PATH_EDGE_MAX);
  if (bad) return bad;
  const route = payload as unknown as PathPayload;
  const ids = route.nodes.map((node) => node.id);
  if (!isId(route.start) || !isId(route.goal) || !ids.includes(route.start) || !ids.includes(route.goal) || route.start === route.goal) return 'The start and the goal are two different nodes';
  if (!loose && !reachable(route.edges, route.start).has(route.goal)) return 'The goal is reachable from the start';
  if (shortestPaths(route).paths.length > KEY_MAX) return `At most ${KEY_MAX} routes share the shortest total`;
  return null;
}

function isShortestRoute(route: PathPayload, order: readonly string[]): boolean {
  if (order.length < 2 || order[0] !== route.start || order[order.length - 1] !== route.goal || new Set(order).size !== order.length) return false;
  const total = pathWeight(route.edges, order);
  return total !== null && total === shortestPaths(route).distance;
}

/* ── choice tree ── */

/** Every ordered pick of `pick` different items, in item order: the leaves of the tree. */
function treeLeaves(tree: TreePayload): string[][] {
  const leaves: string[][] = [];
  const build = (prefix: string[]): void => {
    if (prefix.length === tree.pick) { leaves.push(prefix); return; }
    for (const item of tree.items) if (!prefix.includes(item)) build([...prefix, item]);
  };
  build([]);
  return leaves;
}

const leafId = (leaf: readonly string[]): string => leaf.join('.');
const teamOf = (tree: TreePayload, leaf: readonly string[]): string => [...leaf].sort((a, b) => tree.items.indexOf(a) - tree.items.indexOf(b)).join('.');
const teamIds = (tree: TreePayload): string[] => [...new Set(treeLeaves(tree).map((leaf) => teamOf(tree, leaf)))];

function treeProblem(payload: unknown): string | null {
  if (!keysAre(payload, ['items', 'pick', 'mode'], ['first'])) return 'A choice tree payload holds items, a pick count and a mode';
  const items = payload.items;
  if (!Array.isArray(items) || items.length < TREE_ITEM_MIN || items.length > TREE_ITEM_MAX || !items.every((id) => typeof id === 'string' && ITEM_ID.test(id)) || new Set(items).size !== items.length) {
    return `A choice tree has ${TREE_ITEM_MIN} to ${TREE_ITEM_MAX} different items`;
  }
  if (!whole(payload.pick, 2, 3) || payload.pick > items.length) return 'The pick count is 2 or 3 and never above the item count';
  if (payload.mode !== 'order' && payload.mode !== 'group') return 'The tree mode is order or group';
  if (treeLeaves(payload as unknown as TreePayload).length > TREE_LEAF_MAX) return `A tree has at most ${TREE_LEAF_MAX} outcomes`;
  if (payload.mode === 'order') {
    if (typeof payload.first !== 'string' || !items.includes(payload.first)) return 'The order mode names the item that comes first';
    if (treeLeaves(payload as unknown as TreePayload).filter((leaf) => leaf[0] === payload.first).length < 2) return 'At least two outcomes start with the named item';
  } else {
    if (payload.first !== undefined) return 'The group mode names no first item';
    if (items.length === payload.pick) return 'A group of every item has one team only';
  }
  return null;
}

/** Whether the kept outcomes are what the task asks: every outcome that starts with the named item, or exactly one outcome per team. */
function treeMet(tree: TreePayload, kept: readonly string[]): boolean {
  const leaves = treeLeaves(tree);
  const known = new Map(leaves.map((leaf) => [leafId(leaf), leaf]));
  if (kept.some((id) => !known.has(id)) || new Set(kept).size !== kept.length) return false;
  if (tree.mode === 'order') return sameSet(kept as string[], leaves.filter((leaf) => leaf[0] === tree.first).map(leafId));
  const teams = kept.map((id) => teamOf(tree, known.get(id)!));
  return new Set(teams).size === teams.length && teams.length === teamIds(tree).length;
}

/* ── Pascal's triangle ── */

const pascalCellId = (row: number, col: number): string => `r${row}c${col}`;
const pascalSlotId = (row: number): string => `row-${row}`;
const pascalRowOf = (cell: string): number | null => {
  const match = /^r(\d+)c\d+$/.exec(cell);
  return match ? Number(match[1]) : null;
};

function pascalValues(rows: number): number[][] {
  const out: number[][] = [];
  for (let row = 0; row < rows; row += 1) {
    out.push(Array.from({ length: row + 1 }, (_, col) => (col === 0 || col === row ? 1 : out[row - 1]![col - 1]! + out[row - 1]![col]!)));
  }
  return out;
}

const pascalCells = (rows: number): string[] => pascalValues(rows).flatMap((line, row) => line.map((_, col) => pascalCellId(row, col)));
const pascalMultiples = (pascal: PascalPayload): string[] =>
  pascalValues(pascal.rows).flatMap((line, row) => line.flatMap((value, col) => (value % pascal.multiple === 0 ? [pascalCellId(row, col)] : [])));

function pascalProblem(payload: unknown): string | null {
  if (!keysAre(payload, ['rows', 'multiple'])) return 'A Pascal payload holds a row count and a multiple';
  if (!whole(payload.rows, PASCAL_ROWS_MIN, PASCAL_ROWS_MAX) || !whole(payload.multiple, PASCAL_MULTIPLE_MIN, PASCAL_MULTIPLE_MAX)) {
    return `The triangle has ${PASCAL_ROWS_MIN} to ${PASCAL_ROWS_MAX} rows and the multiple is ${PASCAL_MULTIPLE_MIN} to ${PASCAL_MULTIPLE_MAX}`;
  }
  if (pascalMultiples(payload as unknown as PascalPayload).length === 0) return 'At least one cell is a multiple of the number';
  return null;
}

/* ── the piece ── */

export function networkProblem(visual: unknown, payload: unknown, loose = false): string | null {
  switch (visual) {
    case 'graph': return graphProblem(payload, loose);
    case 'shortest-path': return pathProblem(payload, loose);
    case 'choice-tree': return treeProblem(payload);
    case 'pascal': return pascalProblem(payload);
    default: return 'This kind has no such visual';
  }
}

export function networkFrame(visual: unknown, payload: unknown, loose = false): Frame | null {
  if (networkProblem(visual, payload, loose) !== null) return null;
  if (visual === 'graph') {
    const graph = payload as GraphPayload;
    return graph.task === 'odd'
      ? { pieceIds: graph.nodes.map((node) => node.id), slotIds: ['odd'], capacities: { odd: graph.nodes.length } }
      : { pieceIds: graph.edges.map((edge) => edge.id), slotIds: ['walk'], capacities: { walk: graph.edges.length } };
  }
  if (visual === 'shortest-path') {
    const route = payload as PathPayload;
    return { pieceIds: route.nodes.map((node) => node.id), slotIds: ['route'], capacities: { route: route.nodes.length } };
  }
  if (visual === 'choice-tree') {
    const leaves = treeLeaves(payload as TreePayload).map(leafId);
    return { pieceIds: leaves, slotIds: ['keep'], capacities: { keep: leaves.length } };
  }
  const pascal = payload as PascalPayload;
  const slots = Array.from({ length: pascal.rows }, (_, row) => pascalSlotId(row));
  return { pieceIds: pascalCells(pascal.rows), slotIds: slots, capacities: Object.fromEntries(slots.map((slot, row) => [slot, row + 1])) };
}

/** The ids the labels must name: nodes (and the bridges of a walk), or the items of a tree; a triangle has none. */
function networkLabelIds(visual: unknown, payload: unknown): string[] | null {
  if (networkProblem(visual, payload) !== null) return null;
  if (visual === 'graph') { const graph = payload as GraphPayload; return [...graph.nodes.map((node) => node.id), ...(graph.task === 'trail' ? graph.edges.map((edge) => edge.id) : [])]; }
  if (visual === 'shortest-path') return (payload as PathPayload).nodes.map((node) => node.id);
  if (visual === 'choice-tree') return (payload as TreePayload).items;
  return [];
}

export function networkLabelsProblem(visual: unknown, payload: unknown, labels: unknown): string | null {
  const ids = networkLabelIds(visual, payload);
  if (ids === null) return 'The payload is malformed, so no label can be checked';
  if (ids.length === 0) return labels === undefined ? null : 'A triangle takes no labels';
  return record(labels) && sameKeys(labels, ids) ? null : 'Labels name every node, bridge or item, and nothing else';
}

/** Whether a placement is what the task asks, by rule; the key lists examples only. */
function networkMet(visual: unknown, payload: unknown, slots: Slots, loose: boolean): boolean {
  const frame = networkFrame(visual, payload, loose);
  if (frame === null || Object.keys(slots).some((key) => !frame.slotIds.includes(key))) return false;
  if (visual === 'pascal') {
    return Object.entries(slots).every(([slot, cells]) => cells.every((cell) => { const row = pascalRowOf(cell); return row !== null && pascalSlotId(row) === slot; }))
      && sameSet(Object.values(slots).flat(), pascalMultiples(payload as PascalPayload));
  }
  const placed = slots[frame.slotIds[0]!] ?? [];
  if (visual === 'graph') {
    const graph = payload as GraphPayload;
    return graph.task === 'odd' ? sameSet(placed, oddNodes(graph)) : isTrail(graph.edges, placed, true);
  }
  if (visual === 'shortest-path') return isShortestRoute(payload as PathPayload, placed);
  return treeMet(payload as TreePayload, placed);
}

/** A key solution must itself meet the rule, so a wrong key never grades anyone. */
export function networkKeyProblem(visual: unknown, payload: unknown, solutions: readonly Slots[], loose = false): string | null {
  if (networkProblem(visual, payload, loose) !== null) return 'The payload is malformed';
  return solutions.every((solution) => networkMet(visual, payload, solution, loose)) ? null : 'Every key solution meets the rule of the task';
}

/* ── solvability ── */

const NAMES: Readonly<Record<NetworkVisual, string>> = { graph: 'graph', 'shortest-path': 'route map', 'choice-tree': 'choice tree', pascal: 'Pascal triangle' };
const END = '';

function structure(visual: NetworkVisual, payload: Rec): SolvabilityIssue[] {
  if (visual === 'graph' || visual === 'shortest-path') {
    const nodes = Array.isArray(payload.nodes) ? payload.nodes.filter(record) : [];
    const edges = Array.isArray(payload.edges) ? payload.edges.filter(record) : [];
    const nodeIds = nodes.map((node) => node.id).filter((id): id is string => typeof id === 'string');
    const references = edges.flatMap((edge) => [edge.from, edge.to].filter((to): to is string => typeof to === 'string').map((to) => ({ from: String(edge.id), to })));
    const ends = visual === 'shortest-path' ? [payload.start, payload.goal].filter((to): to is string => typeof to === 'string').map((to) => ({ from: 'the route', to })) : [];
    const known = new Set(nodeIds);
    return [
      ...repeated([...nodeIds, ...edges.map((edge) => edge.id)], 'network item'),
      ...[...references, ...ends].filter((reference) => !known.has(reference.to)).map((reference) => issue('dangling-reference', `"${reference.from}" refers to "${reference.to}", which does not exist`)),
    ];
  }
  if (visual === 'choice-tree') {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const dangling = typeof payload.first === 'string' && !items.includes(payload.first) ? [issue('dangling-reference', `"first" refers to "${payload.first}", which is not an item of the tree`)] : [];
    return [...repeated(items, 'item'), ...dangling];
  }
  return [];
}

export const networkChecker: SolvabilityChecker = (segment, context) => {
  const payload = segment.payload;
  const visual = networkVisualOf(payload);
  if (visual === null) return result([issue('impossible-state', `network segment ${segment.id}: the payload matches no visual (graph has a task, a route map a start, a choice tree items, a Pascal triangle rows)`)]);
  const subject = `${NAMES[visual]} ${segment.id}`;
  const structural = structure(visual, payload);
  if (structural.length > 0) return result(structural);
  const broken = networkProblem(visual, payload, true);
  if (broken) return result([issue('impossible-state', `${subject}: ${broken}`)]);
  const prepared: Prepared = prepareKey(networkFrame(visual, payload, true)!, context, subject);
  const ruleIssues = keyRuleIssues(subject, prepared, prepared.solutions.length > 0 ? networkKeyProblem(visual, payload, prepared.solutions, true) : null);
  const direct = (stats: Record<string, number>) => result([...prepared.issues, ...ruleIssues], { ...stats, solutionsInKey: prepared.solutions.length });

  if (visual === 'pascal') return direct({ cells: pascalMultiples(payload as unknown as PascalPayload).length });
  if (visual === 'choice-tree') {
    const tree = payload as unknown as TreePayload;
    if (tree.mode === 'order') return direct({ outcomes: treeLeaves(tree).filter((leaf) => leaf[0] === tree.first).length });
    const leaves = treeLeaves(tree);
    const teams = leaves.map((leaf) => teamOf(tree, leaf));
    const ids = leaves.map(leafId);
    return withKey(graded(subject, (limit) => searchAssignments<number>({
      domains: ids.map(() => [1, 0]),
      accept: (partial, depth) => partial[depth] === 0 || partial.slice(0, depth).every((kept, index) => kept === 0 || teams[index] !== teams[depth]),
      isSolution: (full) => treeMet(tree, ids.filter((_, index) => full[index] === 1)),
      key: (full) => full.join(''),
      limit,
      maxNodes: context.nodeBudget,
    })), prepared, ruleIssues);
  }
  if (visual === 'graph') {
    const graph = payload as unknown as GraphPayload;
    if (graph.task === 'odd') return direct({ nodes: graph.nodes.length, oddNodes: oddNodes(graph).length });
    const ids = graph.edges.map((edge) => edge.id);
    return withKey(graded(subject, (limit) => searchAssignments<string>({
      domains: ids.map(() => ids),
      distinct: true,
      accept: (partial) => isTrail(graph.edges, partial, false),
      isSolution: (full) => isTrail(graph.edges, full, true),
      key: (full) => full.join('>'),
      limit,
      maxNodes: context.nodeBudget,
    })), prepared, ruleIssues);
  }
  const route = payload as unknown as PathPayload;
  const ids = route.nodes.map((node) => node.id);
  const shortest = shortestPaths(route).distance;
  const walkOf = (list: readonly string[]): string[] => list.filter((id) => id !== END);
  return withKey(graded(subject, (limit) => searchAssignments<string>({
    domains: ids.map(() => [...ids, END]),
    accept: (partial, depth) => {
      const value = partial[depth]!;
      if (depth === 0) return value === route.start;
      if (partial[depth - 1] === END) return value === END;
      if (value === END) return true;
      if (partial.slice(0, depth).includes(value)) return false;
      const total = pathWeight(route.edges, partial.slice(0, depth + 1));
      return total !== null && total <= shortest;
    },
    isSolution: (full) => { const walk = walkOf(full); return walk[walk.length - 1] === route.goal && pathWeight(route.edges, walk) === shortest; },
    key: (full) => walkOf(full).join('>'),
    limit,
    maxNodes: context.nodeBudget,
  })), prepared, ruleIssues);
};
