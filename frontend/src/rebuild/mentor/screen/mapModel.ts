import type { TutorMapNode, TutorMapResponse } from '../session/tutorApi';

/*
 * The learning map (T1f) as steps: the knowledge-component graph read the way
 * a learner reads a path. A skill's step is one past its deepest prerequisite,
 * so every prerequisite sits on an earlier step; the same graph always lays
 * out the same way (no measuring, no randomness). A skill that is not open yet
 * names the prerequisite it waits on, never just a lock.
 */

export interface MapStep { step: number; nodes: TutorMapNode[] }

export function mapSteps(map: Pick<TutorMapResponse, 'nodes' | 'edges'>): MapStep[] {
  const byKey = new Map(map.nodes.map((node) => [node.kcKey, node]));
  const prerequisites = new Map<string, string[]>();
  for (const edge of map.edges) {
    if (!byKey.has(edge.from) || !byKey.has(edge.to)) continue;
    prerequisites.set(edge.to, [...(prerequisites.get(edge.to) ?? []), edge.from]);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const depthOf = (key: string): number => {
    const known = depth.get(key);
    if (known !== undefined) return known;
    if (visiting.has(key)) return 0; // a cycle in a bad payload never hangs the screen
    visiting.add(key);
    const before = prerequisites.get(key) ?? [];
    const value = before.length === 0 ? 0 : Math.max(...before.map(depthOf)) + 1;
    visiting.delete(key);
    depth.set(key, value);
    return value;
  };
  const steps = new Map<number, TutorMapNode[]>();
  for (const node of map.nodes) {
    const d = depthOf(node.kcKey);
    steps.set(d, [...(steps.get(d) ?? []), node]);
  }
  return [...steps.entries()].sort(([a], [b]) => a - b).map(([step, nodes]) => ({ step: step + 1, nodes }));
}

/** The prerequisite a locked skill waits on: the first one not mastered yet, else the first one. */
export function waitsOn(map: Pick<TutorMapResponse, 'nodes' | 'edges'>, node: TutorMapNode): TutorMapNode | null {
  const before = map.edges.filter((edge) => edge.to === node.kcKey)
    .map((edge) => map.nodes.find((candidate) => candidate.kcKey === edge.from))
    .filter((candidate): candidate is TutorMapNode => candidate !== undefined);
  return before.find((candidate) => candidate.state !== 'mastered') ?? before[0] ?? null;
}
