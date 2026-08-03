import { query } from '../db/duckdb.js';
import { pathQuery, sankeyQuery } from '../db/queries.js';

export interface PathTransition {
  fromEvent: string;
  toEvent: string;
  count: number;
  pct: number;
}

export interface SankeyNode {
  name: string;
  step: number;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

type PathRow = {
  from_event: string;
  to_event: string;
  count: number;
  pct: number;
};

type SankeyRow = {
  from_step: string;
  to_step: string;
  users_from: number;
  users_to: number;
  value: number;
};

export async function getTopPaths(
  fromEvent: string,
  limit: number,
): Promise<PathTransition[] | null> {
  try {
    const q = pathQuery(fromEvent, limit);
    const rows = await query<PathRow>(q.sql, ...q.params);

    return rows.map((r) => ({
      fromEvent: r.from_event,
      toEvent: r.to_event,
      count: Number(r.count),
      pct: Number(r.pct),
    }));
  } catch (err) {
    console.error('[dataintel][paths] getTopPaths failed:', err);
    return null;
  }
}

export async function getSankeyData(
  funnelSteps: string[],
  windowDays: number,
): Promise<SankeyData | null> {
  if (funnelSteps.length === 0) {
    return { nodes: [], links: [] };
  }

  try {
    const q = sankeyQuery(funnelSteps, windowDays);
    const rows = await query<SankeyRow>(q.sql, ...q.params);

    const nameSet = new Set<string>();
    for (const r of rows) {
      nameSet.add(r.from_step);
      nameSet.add(r.to_step);
    }

    const names = Array.from(nameSet);
    const nameToIndex = new Map<string, number>();
    for (let i = 0; i < names.length; i++) {
      nameToIndex.set(names[i]!, i);
    }

    const nodes: SankeyNode[] = names.map((name, i) => ({
      name,
      step: i,
    }));

    const links: SankeyLink[] = rows
      .filter((r) => Number(r.value) > 0)
      .map((r) => {
        const sourceIdx = nameToIndex.get(r.from_step) ?? 0;
        const targetIdx = nameToIndex.get(r.to_step) ?? 0;
        return {
          source: sourceIdx,
          target: targetIdx,
          value: Number(r.value),
        };
      });

    return { nodes, links };
  } catch (err) {
    console.error('[dataintel][paths] getSankeyData failed:', err);
    return null;
  }
}
