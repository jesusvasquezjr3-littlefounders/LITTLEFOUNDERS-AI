import { query, execute } from '../db/duckdb.js';
import crypto from 'crypto';

export interface Experiment {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'concluded';
  metric: string;
  variantA: string;
  variantB: string;
  surface: string;
  target: string;
  segmentFilter?: Record<string, unknown>;
  /** H.7: age eligibility bounds. NULL = unbounded on that side; a learner
   * with an unknown age (null) never qualifies for a bounded experiment. */
  minAge?: number | null;
  maxAge?: number | null;
  createdAt: string;
  startedAt?: string;
  concludedAt?: string;
}

/**
 * B.28 (S05.3f): engagement volume is never a success metric. Counting more
 * events or more sessions after a treatment rewards whatever keeps a learner
 * busy longest, which is the flow-as-stickiness trap Appendix B §2.6 names.
 * A new experiment may not declare these as its metric, and a legacy one
 * still reports its numbers (and which arm is higher, for diagnosis) but
 * never names a winner. Retention ('dau', 'users': did the learner come back
 * at all) is a binary return signal, not volume, and stays allowed.
 * Policy: docs/rebuild/LEARNER-REGISTER-AND-WELLBEING-POLICY.md §5.
 */
export const ENGAGEMENT_VOLUME_METRICS: ReadonlySet<string> = new Set(['events', 'sessions']);

export function isEngagementVolumeMetric(metric: string): boolean {
  return ENGAGEMENT_VOLUME_METRICS.has(metric);
}

export interface ExperimentResults {
  experiment: Experiment;
  variantA: { users: number; mean: number; stddev: number };
  variantB: { users: number; mean: number; stddev: number };
  pValue: number;
  confidence: number;
  winner: 'A' | 'B' | null;
  /** B.28: true when the metric counts volume; `winner` is then always null. */
  engagementVolume: boolean;
  /** The arm with the higher mean when significant, for diagnosis only. */
  higher: 'A' | 'B' | null;
  significant: boolean;
  exposedUsers: number;
  sampleRatioMismatch: boolean;
}

type StoredExperiment = {
  id: string;
  name: string;
  status: string;
  metric: string;
  variant_a: string;
  variant_b: string;
  surface: string;
  target: string;
  segment_filter: string | null;
  min_age: number | null;
  max_age: number | null;
  created_at: string;
  started_at: string | null;
  concluded_at: string | null;
};

type AssignmentRow = {
  experiment_id: string;
  user_id: string;
  variant: string;
  assigned_at: string;
};

type ExposureRow = AssignmentRow & { exposed_at: string | Date };

export interface RuntimeAssignment {
  experimentId: string;
  variant: 'A' | 'B';
  surface: string;
  target: string;
}

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
  surface TEXT NOT NULL DEFAULT 'learn',
  target TEXT NOT NULL DEFAULT 'default',
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

const ENSURE_EXPOSURES = `\
CREATE TABLE IF NOT EXISTS experiment_exposures (
  experiment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  exposed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (experiment_id, user_id)
)`;

async function ensureExperimentSchema(): Promise<void> {
  await execute(ENSURE_EXPERIMENTS);
  await execute(ENSURE_ASSIGNMENTS);
  await execute(ENSURE_EXPOSURES);
  // Persistent DuckDB files may have been created before runtime targeting.
  // DuckDB cannot add a constrained column to an existing table. Fresh tables
  // carry the constraints in CREATE TABLE; legacy files receive nullable
  // columns which this backfill and the application boundary normalize.
  await execute('ALTER TABLE experiments ADD COLUMN IF NOT EXISTS surface TEXT');
  await execute('ALTER TABLE experiments ADD COLUMN IF NOT EXISTS target TEXT');
  await execute("UPDATE experiments SET surface = 'learn' WHERE surface IS NULL");
  await execute("UPDATE experiments SET target = 'default' WHERE target IS NULL");
  // H.7: age eligibility bounds (NULL = unbounded on that side).
  await execute('ALTER TABLE experiments ADD COLUMN IF NOT EXISTS min_age INTEGER');
  await execute('ALTER TABLE experiments ADD COLUMN IF NOT EXISTS max_age INTEGER');
}

function rowToExperiment(r: StoredExperiment): Experiment {
  return {
    id: r.id,
    name: r.name,
    status: r.status as 'draft' | 'running' | 'concluded',
    metric: r.metric,
    variantA: r.variant_a,
    variantB: r.variant_b,
    surface: r.surface ?? 'learn',
    target: r.target ?? 'default',
    segmentFilter: r.segment_filter
      ? (JSON.parse(r.segment_filter) as Record<string, unknown>)
      : undefined,
    minAge: r.min_age,
    maxAge: r.max_age,
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
  surface = 'learn',
  target = 'default',
  ageBounds: { minAge?: number | null; maxAge?: number | null } = {},
): Promise<Experiment | null> {
  try {
    await ensureExperimentSchema();

    const experimentId = id();
    const createdAt = now();

    await execute(
      `INSERT INTO experiments (id, name, status, metric, variant_a, variant_b, surface, target, min_age, max_age, created_at)
       VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
      experimentId,
      name,
      metric,
      variantA,
      variantB,
      surface,
      target,
      ageBounds.minAge ?? null,
      ageBounds.maxAge ?? null,
      createdAt,
    );

    return {
      id: experimentId,
      name,
      status: 'draft',
      metric,
      variantA,
      variantB,
      surface,
      target,
      minAge: ageBounds.minAge ?? null,
      maxAge: ageBounds.maxAge ?? null,
      createdAt,
    };
  } catch (err) {
    console.error('[dataintel][experiments] create failed:', err);
    return null;
  }
}

export async function startExperiment(id: string): Promise<boolean> {
  try {
    await ensureExperimentSchema();

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
    await ensureExperimentSchema();

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
    await ensureExperimentSchema();

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
    await ensureExperimentSchema();

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

/** Stable, deterministic allocation. The same learner never flips variants. */
function deterministicVariant(experimentId: string, userId: string): 'A' | 'B' {
  const digest = crypto.createHash('sha256').update(`${experimentId}:${userId}`).digest();
  return (digest[0] ?? 0) % 2 === 0 ? 'A' : 'B';
}

/** Returns active assignments for an actual product surface and target. */
export async function getRuntimeAssignments(
  userId: string,
  surface: string,
  target: string,
  age?: number | null,
): Promise<RuntimeAssignment[] | null> {
  try {
    await ensureExperimentSchema();
    const experiments = await query<StoredExperiment>(
      `SELECT * FROM experiments
       WHERE status = 'running' AND surface = ? AND target = ?
       ORDER BY started_at ASC`,
      surface,
      target,
    );
    const assignments: RuntimeAssignment[] = [];
    for (const experiment of experiments) {
      // H.7: age eligibility is evaluated before any assignment exists. An
      // age-bounded experiment never assigns (and never exposes) a learner
      // whose age is unknown or outside its bounds.
      if (!ageWithinBounds(age, experiment.min_age, experiment.max_age)) continue;
      const existing = await query<AssignmentRow>(
        'SELECT experiment_id, user_id, variant, assigned_at FROM experiment_assignments WHERE experiment_id = ? AND user_id = ?',
        experiment.id,
        userId,
      );
      const variant = existing[0]?.variant === 'B'
        ? 'B'
        : existing[0]?.variant === 'A'
          ? 'A'
          : deterministicVariant(experiment.id, userId);
      if (existing.length === 0) {
        await execute(
          `INSERT OR IGNORE INTO experiment_assignments (experiment_id, user_id, variant, assigned_at)
           VALUES (?, ?, ?, ?)`,
          experiment.id,
          userId,
          variant,
          now(),
        );
      }
      assignments.push({ experimentId: experiment.id, variant, surface, target });
    }
    return assignments;
  } catch (err) {
    console.error('[dataintel][experiments] getRuntimeAssignments failed:', err);
    return null;
  }
}

/**
 * H.7: a learner qualifies for an experiment only when their age is known
 * and inside every declared bound. An unbounded experiment accepts unknown
 * ages (null); a bounded one never does — eligibility cannot be guessed.
 */
export function ageWithinBounds(age: number | null | undefined, minAge: number | null, maxAge: number | null): boolean {
  if (minAge === null && maxAge === null) return true;
  if (age === null || age === undefined || !Number.isFinite(age)) return false;
  if (minAge !== null && age < minAge) return false;
  if (maxAge !== null && age > maxAge) return false;
  return true;
}

/**
 * Records exposure only after the product actually rendered the assigned
 * treatment. Assignment alone is not causal evidence and is never used as a
 * substitute for exposure in experiment results.
 */
export async function recordRuntimeExposure(
  userId: string,
  experimentId: string,
  surface: string,
  target: string,
  age?: number | null,
): Promise<RuntimeAssignment | null> {
  const assignments = await getRuntimeAssignments(userId, surface, target, age);
  if (assignments === null) return null;
  const assignment = assignments.find((item) => item.experimentId === experimentId);
  if (!assignment) return null;
  try {
    await execute(
      `INSERT OR IGNORE INTO experiment_exposures (experiment_id, user_id, variant, exposed_at)
       VALUES (?, ?, ?, ?)`,
      experimentId,
      userId,
      assignment.variant,
      now(),
    );
    return assignment;
  } catch (err) {
    console.error('[dataintel][experiments] recordRuntimeExposure failed:', err);
    return null;
  }
}

export async function getExperimentResults(
  id: string,
): Promise<ExperimentResults | null> {
  try {
    await ensureExperimentSchema();

    const expRows = await query<StoredExperiment>(
      'SELECT * FROM experiments WHERE id = ?',
      id,
    );

    if (expRows.length === 0) {
      return null;
    }

    const experiment = rowToExperiment(expRows[0]!);

    const assignments = await query<ExposureRow>(
      'SELECT * FROM experiment_exposures WHERE experiment_id = ?',
      id,
    );

    if (assignments.length === 0) {
      return null;
    }

    const userMetricsA: number[] = [];
    const userMetricsB: number[] = [];

    for (const a of assignments) {
      const val = await getUserMetricValue(a.user_id, experiment.metric, a.exposed_at);
      if (val !== null) {
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
    const higher: 'A' | 'B' | null = significant ? (statsB.mean > statsA.mean ? 'B' : 'A') : null;
    const engagementVolume = isEngagementVolumeMetric(experiment.metric);
    const winner: 'A' | 'B' | null = engagementVolume ? null : higher;

    return {
      experiment,
      variantA: statsA,
      variantB: statsB,
      pValue: round4(pValue),
      confidence,
      winner,
      engagementVolume,
      higher,
      significant,
      exposedUsers: assignments.length,
      sampleRatioMismatch: Math.abs(statsA.users - statsB.users) / Math.max(1, statsA.users + statsB.users) > 0.1,
    };
  } catch (err) {
    console.error('[dataintel][experiments] getResults failed:', err);
    return null;
  }
}

/**
 * Per-assigned-user metric value used as the t-test's sample unit.
 *
 * 'dau'/'users' cannot reuse the events/sessions GROUP BY shape: with the
 * query already filtered to WHERE user_id = ?, COUNT(DISTINCT user_id) is
 * always exactly 1 for any user with >=1 matching row (and the row vanishes
 * entirely — not a 0 — for a user with none), so every sample collapses to
 * the same constant and the t-test always reports zero variance. The correct
 * per-user unit for a user-count metric is binary activation: did this user
 * do anything at all during the experiment, 1 or 0 — computed via EXISTS so
 * an inactive user still yields a real (0) sample instead of no row at all.
 */
async function getUserMetricValue(
  userId: string,
  metric: string,
  exposedAt: string | Date,
): Promise<number | null> {
  // node-duckdb returns TIMESTAMP columns as Date instances, while all
  // insertions use ISO strings. Normalize at this boundary and force the
  // parameter's SQL type; otherwise the native binder can compare a timestamp
  // to an opaque JS value and quietly return an all-zero experiment.
  const exposureBoundary = new Date(exposedAt).toISOString();
  if (metric === 'dau' || metric === 'users') {
    const rows = await query<{ metric_value: number }>(
      `SELECT CASE WHEN EXISTS (
        SELECT 1 FROM fact_events
        WHERE user_id = ? AND created_at >= CAST(? AS TIMESTAMP)
      ) THEN 1 ELSE 0 END AS metric_value`,
      userId, exposureBoundary,
    );
    return rows.length > 0 ? Number(rows[0]!.metric_value) : null;
  }

  const aggExpression =
    metric === 'sessions' ? 'COUNT(DISTINCT session_id)' : 'COUNT(*)';

  const rows = await query<UserMetricRow>(
    `SELECT user_id, ${aggExpression} AS metric_value
     FROM fact_events
     WHERE user_id = ? AND created_at >= CAST(? AS TIMESTAMP)
     GROUP BY user_id`,
    userId, exposureBoundary,
  );

  return rows.length > 0 && rows[0]!.metric_value !== undefined
    ? Number(rows[0]!.metric_value)
    : null;
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

  return x > 0 ? 0.5 + 0.5 * y : 0.5 - 0.5 * y;
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
