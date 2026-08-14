import { query } from '../db/duckdb.js';
import {
  activationFunnelQuery,
  customFunnelQuery,
  type AnalyticsWindow,
} from '../db/queries.js';

export interface FunnelStep {
  step: string;
  stepOrder: number;
  users: number;
  conversionFromPrevious: number | null;
  dropoffFromPrevious: number | null;
}

interface ActivationFunnelRow {
  step: string;
  users: number;
}

interface CustomFunnelRow {
  users: number;
  [key: string]: number | string;
}

const ACTIVATION_STEP_ORDER: Record<string, number> = {
  visited: 1,
  started_signup: 2,
  completed_signup: 3,
  started_lesson: 4,
  completed_lesson: 5,
};

export async function getActivationFunnel(window: AnalyticsWindow): Promise<FunnelStep[] | null> {
  try {
    const { sql, params } = activationFunnelQuery(window);
    const rows = await query<ActivationFunnelRow>(sql, ...params);

    const sorted = [...rows].sort(
      (a, b) =>
        (ACTIVATION_STEP_ORDER[a.step] ?? 99) -
        (ACTIVATION_STEP_ORDER[b.step] ?? 99),
    );

    return sorted.map((r, i) => {
      const users = Number(r.users);
      const prevUsers = i > 0 ? Number(sorted[i - 1]?.users ?? 0) : null;

      return {
        step: r.step,
        stepOrder: ACTIVATION_STEP_ORDER[r.step] ?? i + 1,
        users,
        conversionFromPrevious:
          prevUsers !== null && prevUsers > 0
            ? Math.round((users / prevUsers) * 10000) / 100
            : null,
        dropoffFromPrevious:
          prevUsers !== null && prevUsers > 0
            ? Math.round(((prevUsers - users) / prevUsers) * 10000) / 100
            : null,
      };
    });
  } catch (err) {
    console.error('[dataintel][funnel] getActivationFunnel failed:', err);
    return null;
  }
}

export async function getCustomFunnel(
  steps: string[],
  windowDays: number,
): Promise<FunnelStep[] | null> {
  try {
    if (steps.length === 0) {
      return [];
    }

    const { sql, params } = customFunnelQuery(steps, windowDays);
    const rows = await query<CustomFunnelRow>(sql, ...params);

    const stepCounts: number[] = new Array(steps.length).fill(0);

    for (const row of rows) {
      for (let i = 0; i < steps.length; i++) {
        const col = `step${i}`;
        if (row[col] === 1) {
          stepCounts[i] = (stepCounts[i] ?? 0) + 1;
        }
      }
    }

    return stepCounts.map((users, i) => {
      const prevUsers = i > 0 ? (stepCounts[i - 1] ?? 0) : null;

      return {
        step: steps[i] ?? `step_${i}`,
        stepOrder: i + 1,
        users,
        conversionFromPrevious:
          prevUsers !== null && prevUsers > 0
            ? Math.round((users / prevUsers) * 10000) / 100
            : null,
        dropoffFromPrevious:
          prevUsers !== null && prevUsers > 0
            ? Math.round(((prevUsers - users) / prevUsers) * 10000) / 100
            : null,
      };
    });
  } catch (err) {
    console.error('[dataintel][funnel] getCustomFunnel failed:', err);
    return null;
  }
}
