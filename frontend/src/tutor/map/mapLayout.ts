import type { TutorMapNode } from '../tutorApi';

/*
 * The learning map's layout — pure, deterministic, testable without a DOM.
 *
 * Topological layering by prerequisite depth: a node's row is one past its
 * deepest prerequisite, so every edge always points downward (mobile) or
 * rightward (desktop) and the learner READS the graph as a path. No force
 * simulation, no randomness — the same graph always draws the same map,
 * which is what lets the SVG edge layer and the DOM node layer agree by
 * construction.
 */

export interface LaidOutNode<T extends TutorMapNode = TutorMapNode> {
  node: T;
  /** Topological depth: 0 = no prerequisites. */
  row: number;
  /** Position within the row, stable (seed order = catalog order). */
  col: number;
  /** Nodes in this row, for percentage positioning. */
  rowSize: number;
}

export interface MapLayout<T extends TutorMapNode = TutorMapNode> {
  nodes: LaidOutNode<T>[];
  rows: number;
  /** Same edges, keyed to layout — from/to kcKey. */
  edges: Array<{ from: string; to: string }>;
}

export function layoutMap<T extends TutorMapNode>(
  nodes: T[],
  edges: Array<{ from: string; to: string }>,
): MapLayout<T> {
  const byKey = new Map(nodes.map((n) => [n.kcKey, n]));
  const prereqsOf = new Map<string, string[]>();
  for (const e of edges) {
    if (!byKey.has(e.from) || !byKey.has(e.to)) continue;
    prereqsOf.set(e.to, [...(prereqsOf.get(e.to) ?? []), e.from]);
  }

  // Depth by memoized longest-prerequisite chain. The seed loader refuses
  // cycles, but a defensive visit guard keeps a bad payload from hanging.
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (key: string): number => {
    const known = depth.get(key);
    if (known !== undefined) return known;
    if (visiting.has(key)) return 0;
    visiting.add(key);
    const prereqs = prereqsOf.get(key) ?? [];
    const d = prereqs.length === 0 ? 0 : Math.max(...prereqs.map(depthOf)) + 1;
    visiting.delete(key);
    depth.set(key, d);
    return d;
  };
  for (const n of nodes) depthOf(n.kcKey);

  const rowsByDepth = new Map<number, T[]>();
  for (const n of nodes) {
    const d = depth.get(n.kcKey) ?? 0;
    rowsByDepth.set(d, [...(rowsByDepth.get(d) ?? []), n]);
  }

  const laidOut: LaidOutNode<T>[] = [];
  const rows = rowsByDepth.size === 0 ? 0 : Math.max(...rowsByDepth.keys()) + 1;
  for (const [row, members] of rowsByDepth) {
    members.forEach((node, col) => laidOut.push({ node, row, col, rowSize: members.length }));
  }
  laidOut.sort((a, b) => a.row - b.row || a.col - b.col);

  return {
    nodes: laidOut,
    rows,
    edges: edges.filter((e) => byKey.has(e.from) && byKey.has(e.to)),
  };
}
