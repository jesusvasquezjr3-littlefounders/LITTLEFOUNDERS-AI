import { query, execute } from '../db/duckdb.js';
import crypto from 'crypto';

export interface Experiment {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'concluded';
  metric: string;
  variantA: string;
  variantB: string;
  segmentFilter?: Record<string, unknown>;
  createdAt: string;
  startedAt?: string;
  concludedAt?: string;
}

export interface ExperimentResults {
  experiment: Experiment;
  variantA: { users: number; mean: number; stddev: number };
  variantB: { users: number; mean: number; stddev: number };
  pValue: number;
  confidence: number;
  winner: 'A' | 'B' | null;
  significant: boolean;
}

type StoredExperiment = {
  id: string;
  name: string;
  status: string;
  metric: string;
  variant_a: string;
  variant_b: string;
  segment_filter: string | null;
  created_at: string;
  started_at: string | null;
  concluded_at: string | null;
};

type AssignmentRow = {
  experiment_id: string;
  user_id: string;
  variant: string;
};

type UserMetricRow = {
  user_id: string;
  metric_value: number;
};

const ENSURE_EXPERIMENTS = `\
CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  metric TEXT NOT NULL,
  variant_a TEXT NOT NULL,
  variant_b TEXT NOT NULL,
  segment_filter TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  concluded_at TIMESTAMP
)`;

const ENSURE_ASSIGNMENTS = `\
CREATE TABLE IF NOT EXISTS experiment_assignments (
  experiment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (experiment_id, user_id)
)`;

function rowToExperiment(r: StoredExperiment): Experiment {
  return {
    id: r.id,
    name: r.name,
    status: r.status as 'draft' | 'running' | 'concluded',
    metric: r.metric,
    variantA: r.variant_a,
    variantB: r.variant_b,
    segmentFilter: r.segment_filter
      ? (JSON.parse(r.segment_filter) as Record<string, unknown>)
      : undefined,
    createdAt: r.created_at,
    startedAt: r.started_at ?? undefined,
    concludedAt: r.concluded_at ?? undefined,
  };
}

function id(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export async function createExperiment(
  name: string,
  metric: string,
  variantA: string,
  variantB: string,
): Promise<Experiment | null> {
  try {
    await execute(ENSURE_EXPERIMENTS);

    const experimentId = id();
    const createdAt = now();

    await execute(
      `INSERT INTO experiments (id, name, status, metric, variant_a, variant_b, created_at)
       VALUES (?, ?, 'draft', ?, ?, ?, ?)`,
      experimentId,
      name,
      metric,
      variantA,
      variantB,
      createdAt,
    );

    return {
      id: experimentId,
      name,
      status: 'draft',
      metric,
      variantA,
      variantB,
      createdAt,
    };
  } catch (err) {
    console.error('[dataintel][experiments] create failed:', err);
    return null;
  }
}

export async function startExperiment(id: string): Promise<boolean> {
  try {
    await execute(ENSURE_EXPERIMENTS);

    const rows = await query<StoredExperiment>(
      'SELECT * FROM experiments WHERE id = ?',
      id,
    );

    if (rows.length === 0) {
      return false;
    }

    const exp = rows[0]!;
    if (exp.status !== 'draft') {
      return false;
    }

    await execute(
      "UPDATE experiments SET status = 'running', started_at = ? WHERE id = ?",
      now(),
      id,
    );

    return true;
  } catch (err) {
    console.error('[dataintel][experiments] start failed:', err);
    return false;
  }
}

export async function concludeExperiment(
  id: string,
): Promise<Experiment | null> {
  try {
    await execute(ENSURE_EXPERIMENTS);

    const rows = await query<StoredExperiment>(
      'SELECT * FROM experiments WHERE id = ?',
      id,
    );

    if (rows.length === 0) {
      return null;
    }

    const exp = rows[0]!;
    if (exp.status !== 'running') {
      return null;
    }

    const concludedAt = now();
    await execute(
      "UPDATE experiments SET status = 'concluded', concluded_at = ? WHERE id = ?",
      concludedAt,
      id,
    );

    return rowToExperiment({ ...exp, status: 'concluded', concluded_at: concludedAt });
  } catch (err) {
    console.error('[dataintel][experiments] conclude failed:', err);
    return null;
  }
}

export async function listExperiments(): Promise<Experiment[] | null> {
  try {
    await execute(ENSURE_EXPERIMENTS);

    const rows = await query<StoredExperiment>(
      'SELECT * FROM experiments ORDER BY created_at DESC',
    );

    return rows.map(rowToExperiment);
  } catch (err) {
    console.error('[dataintel][experiments] list failed:', err);
    return null;
  }
}

export async function assignVariant(
  experimentId: string,
  userId: string,
  variant: 'A' | 'B',
): Promise<boolean> {
  try {
    await execute(ENSURE_ASSIGNMENTS);

    await execute(
      `INSERT OR REPLACE INTO experiment_assignments (experiment_id, user_id, variant, assigned_at)
       VALUES (?, ?, ?, ?)`,
      experimentId,
      userId,
      variant,
      now(),
    );

    return true;
  } catch (err) {
    console.error('[dataintel][experiments] assignVariant failed:', err);
    return false;
  }
}

export async function getExperimentResults(
  id: string,
): Promise<ExperimentResults | null> {
  try {
    await execute(ENSURE_EXPERIMENTS);
    await execute(ENSURE_ASSIGNMENTS);

    const expRows = await query<StoredExperiment>(
      'SELECT * FROM experiments WHERE id = ?',
      id,
    );

    if (expRows.length === 0) {
      return null;
    }

    const experiment = rowToExperiment(expRows[0]!);

    let aggExpression: string;
    switch (experiment.metric) {
      case 'dau':
      case 'users':
        aggExpression = 'COUNT(DISTINCT user_id)';
        break;
      case 'sessions':
        aggExpression = 'COUNT(DISTINCT session_id)';
        break;
      case 'events':
      default:
        aggExpression = 'COUNT(*)';
        break;
    }

    const assignments = await query<AssignmentRow>(
      'SELECT * FROM experiment_assignments WHERE experiment_id = ?',
      id,
    );

    if (assignments.length === 0) {
      return null;
    }

    const userMetricsA: number[] = [];
    const userMetricsB: number[] = [];

    for (const a of assignments) {
      const metricRows = await query<UserMetricRow>(
        `SELECT user_id, ${aggExpression} AS metric_value
         FROM fact_events
         WHERE user_id = ?
         GROUP BY user_id`,
        a.user_id,
      );

      if (metricRows.length > 0 && metricRows[0]!.metric_value !== undefined) {
        const val = Number(metricRows[0]!.metric_value);
        if (a.variant === 'A') {
          userMetricsA.push(val);
        } else {
          userMetricsB.push(val);
        }
      }
    }

    if (userMetricsA.length === 0 || userMetricsB.length === 0) {
      return null;
    }

    const statsA = computeStats(userMetricsA);
    const statsB = computeStats(userMetricsB);

    const { pValue } = welchsTTest(
      statsA.mean,
      statsA.stddev,
      statsA.users,
      statsB.mean,
      statsB.stddev,
      statsB.users,
    );

    const confidence = round2((1 - pValue) * 100);
    const significant = pValue < 0.05;
    let winner: 'A' | 'B' | null = null;

    if (significant) {
      winner = statsB.mean > statsA.mean ? 'B' : 'A';
    }

    return {
      experiment,
      variantA: statsA,
      variantB: statsB,
      pValue: round4(pValue),
      confidence,
      winner,
      significant,
    };
  } catch (err) {
    console.error('[dataintel][experiments] getResults failed:', err);
    return null;
  }
}

function computeStats(values: number[]): {
  users: number;
  mean: number;
  stddev: number;
} {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance =
    n > 1
      ? values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / (n - 1)
      : 0;
  const stddev = Math.sqrt(variance);
  return { users: n, mean: round4(mean), stddev: round4(stddev) };
}

function welchsTTest(
  meanA: number,
  stddevA: number,
  nA: number,
  meanB: number,
  stddevB: number,
  nB: number,
): { t: number; pValue: number } {
  const varA = (stddevA * stddevA) / nA;
  const varB = (stddevB * stddevB) / nB;
  const se = Math.sqrt(varA + varB);

  if (se === 0) {
    return { t: 0, pValue: 1.0 };
  }

  const t = (meanB - meanA) / se;

  const num = (varA + varB) * (varA + varB);
  const denom =
    (varA * varA) / (nA - 1) + (varB * varB) / (nB - 1);

  let df = num / denom;
  if (!Number.isFinite(df) || df < 1) {
    df = nA + nB - 2;
  }

  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  return { t: round4(t), pValue: clamp(pValue, 0, 1) };
}

function tCDF(t: number, df: number): number {
  if (df <= 0) return 0.5;
  if (t <= 0) return 0.5;

  if (df > 100) {
    return normCDF(t);
  }

  // Hill (1970) approximation for t-distribution CDF
  // via normal CDF with transformed argument
  const num = t * (1 - 1 / (4 * df));
  const den = Math.sqrt(1 + (t * t) / (2 * df));
  return normCDF(num / den);
}

function normCDF(x: number): number {
  const z = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-z * z);

  return x > 0 ? 1 - 0.5 * y : 0.5 * y;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}
