import { query } from '../db/duckdb.js';
import { churnRiskQuery, churnFactorsQuery } from '../db/queries.js';

export interface ChurnRiskEntry {
  user_id: string;
  active_days_7d: number;
  active_days_14d: number;
  days_since_active: number;
  risk_level: 'high' | 'medium' | 'at_risk' | 'active';
  risk_score: number;
  lessons_completed: number;
  last_event_at: string;
}

export interface ChurnFactor {
  factor: string;
  churnedAvg: number;
  retainedAvg: number;
  difference: number;
  impact: 'high' | 'medium' | 'low';
}

type ChurnRiskRow = {
  user_id: string;
  role: string;
  xp_points: number;
  lessons_completed: number;
  streak_days: number;
  last_active: string;
  days_since_active: number;
  active_days: number;
  lessons_touched: number;
  events_last_7d: number;
  active_days_last_7d: number;
  churn_risk: string;
};

type ChurnFactorRow = {
  churned: number;
  user_count: number;
  avg_total_events: number;
  avg_active_days: number;
  avg_lessons_touched: number;
  avg_sessions: number;
  avg_feature_diversity: number;
};

function riskLevelToCategory(
  risk: string,
): 'high' | 'medium' | 'at_risk' | 'active' {
  switch (risk) {
    case 'high_risk':
      return 'high';
    case 'medium_risk':
      return 'medium';
    case 'at_risk':
      return 'at_risk';
    default:
      return 'active';
  }
}

function computeRiskScore(
  daysSinceActive: number,
  activeDaysLast7d: number,
  lessonsCompleted: number,
): number {
  let score = 0;

  if (daysSinceActive > 14) {
    score += 60;
  } else if (daysSinceActive > 7) {
    score += 40;
  } else if (daysSinceActive > 3) {
    score += 20;
  } else {
    score += daysSinceActive * 2;
  }

  if (activeDaysLast7d === 0) {
    score += 30;
  } else if (activeDaysLast7d === 1) {
    score += 15;
  }

  if (lessonsCompleted === 0) {
    score += 10;
  }

  return Math.min(score, 100);
}

function factorImpact(difference: number): 'high' | 'medium' | 'low' {
  const absDiff = Math.abs(difference);
  if (absDiff >= 0.5) return 'high';
  if (absDiff >= 0.25) return 'medium';
  return 'low';
}

export async function getChurnRisk(
  limit: number,
): Promise<ChurnRiskEntry[] | null> {
  try {
    const q = churnRiskQuery(limit);
    const rows = await query<ChurnRiskRow>(q.sql, ...q.params);

    const entries: ChurnRiskEntry[] = rows.map((r) => ({
      user_id: r.user_id,
      active_days_7d: Number(r.active_days_last_7d),
      active_days_14d: Number(r.active_days),
      days_since_active: Number(r.days_since_active),
      risk_level: riskLevelToCategory(r.churn_risk),
      risk_score: computeRiskScore(
        Number(r.days_since_active),
        Number(r.active_days_last_7d),
        Number(r.lessons_completed),
      ),
      lessons_completed: Number(r.lessons_completed),
      last_event_at: r.last_active,
    }));

    entries.sort((a, b) => b.risk_score - a.risk_score);

    return entries;
  } catch (err) {
    console.error('[dataintel][churn] getChurnRisk failed:', err);
    return null;
  }
}

export async function getChurnFactors(): Promise<ChurnFactor[] | null> {
  try {
    const q = churnFactorsQuery();
    const rows = await query<ChurnFactorRow>(q.sql, ...q.params);

    const churned = rows.find((r) => r.churned === 1);
    const retained = rows.find((r) => r.churned === 0);

    if (!churned || !retained) {
      return [];
    }

    const factors: ChurnFactor[] = [
      {
        factor: 'avg_total_events',
        churnedAvg: Number(churned.avg_total_events),
        retainedAvg: Number(retained.avg_total_events),
        difference:
          Number(retained.avg_total_events) -
          Number(churned.avg_total_events),
        impact: factorImpact(
          (Number(retained.avg_total_events) -
            Number(churned.avg_total_events)) /
            Math.max(Number(retained.avg_total_events), 1),
        ),
      },
      {
        factor: 'avg_active_days',
        churnedAvg: Number(churned.avg_active_days),
        retainedAvg: Number(retained.avg_active_days),
        difference:
          Number(retained.avg_active_days) -
          Number(churned.avg_active_days),
        impact: factorImpact(
          (Number(retained.avg_active_days) -
            Number(churned.avg_active_days)) /
            Math.max(Number(retained.avg_active_days), 1),
        ),
      },
      {
        factor: 'avg_lessons_touched',
        churnedAvg: Number(churned.avg_lessons_touched),
        retainedAvg: Number(retained.avg_lessons_touched),
        difference:
          Number(retained.avg_lessons_touched) -
          Number(churned.avg_lessons_touched),
        impact: factorImpact(
          (Number(retained.avg_lessons_touched) -
            Number(churned.avg_lessons_touched)) /
            Math.max(Number(retained.avg_lessons_touched), 1),
        ),
      },
      {
        factor: 'avg_sessions',
        churnedAvg: Number(churned.avg_sessions),
        retainedAvg: Number(retained.avg_sessions),
        difference:
          Number(retained.avg_sessions) - Number(churned.avg_sessions),
        impact: factorImpact(
          (Number(retained.avg_sessions) - Number(churned.avg_sessions)) /
            Math.max(Number(retained.avg_sessions), 1),
        ),
      },
      {
        factor: 'avg_feature_diversity',
        churnedAvg: Number(churned.avg_feature_diversity),
        retainedAvg: Number(retained.avg_feature_diversity),
        difference:
          Number(retained.avg_feature_diversity) -
          Number(churned.avg_feature_diversity),
        impact: factorImpact(
          (Number(retained.avg_feature_diversity) -
            Number(churned.avg_feature_diversity)) /
            Math.max(Number(retained.avg_feature_diversity), 1),
        ),
      },
    ];

    return factors;
  } catch (err) {
    console.error('[dataintel][churn] getChurnFactors failed:', err);
    return null;
  }
}
