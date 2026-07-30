import { query, execute } from '../db/duckdb.js';
import { anomalyQuery } from '../db/queries.js';

export interface Anomaly {
  metric: string;
  date: string;
  value: number;
  expected: number;
  zScore: number;
  direction: 'up' | 'down';
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

function severityFromZScore(z: number): 'low' | 'medium' | 'high' {
  const absZ = Math.abs(z);
  if (absZ >= 3.0) return 'high';
  if (absZ >= 2.0) return 'medium';
  return 'low';
}

type AnomalyRow = {
  hour_bucket: string;
  event_count: number;
  users: number;
  avg_value: number;
  total_value: number;
  mean_val: number;
  std_val: number;
  z_score: number;
  classification: string;
};

type StoredAnomaly = {
  metric: string;
  date: string;
  value: number;
  expected: number;
  z_score: number;
  direction: string;
  severity: string;
  resolved: boolean;
};

const ENSURE_TABLE = `\
CREATE TABLE IF NOT EXISTS anomalies (
  metric TEXT NOT NULL,
  date TEXT NOT NULL,
  value DOUBLE NOT NULL,
  expected DOUBLE NOT NULL,
  z_score DOUBLE NOT NULL,
  direction TEXT NOT NULL,
  severity TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (date, metric)
)`;

export async function detectAnomalies(
  metric: string,
  days: number,
  threshold: number,
): Promise<Anomaly[] | null> {
  try {
    await execute(ENSURE_TABLE);

    const q = anomalyQuery(metric, days, threshold);
    const rows = await query<AnomalyRow>(q.sql, ...q.params);

    const anomalies: Anomaly[] = [];

    for (const row of rows) {
      const zScore = Number(row.z_score);
      const value = Number(row.event_count);
      const expected = Number(row.mean_val);
      const direction: 'up' | 'down' = value > expected ? 'up' : 'down';
      const severity = severityFromZScore(zScore);

      await execute(
        `INSERT OR REPLACE INTO anomalies (metric, date, value, expected, z_score, direction, severity, resolved)
         VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
        metric,
        row.hour_bucket,
        value,
        expected,
        zScore,
        direction,
        severity,
      );

      anomalies.push({
        metric,
        date: row.hour_bucket,
        value,
        expected,
        zScore,
        direction,
        severity,
        resolved: false,
      });
    }

    return anomalies;
  } catch (err) {
    console.error('[dataintel][anomalies] detect failed:', err);
    return null;
  }
}

export async function getActiveAnomalies(): Promise<Anomaly[] | null> {
  try {
    await execute(ENSURE_TABLE);

    const rows = await query<StoredAnomaly>(
      'SELECT * FROM anomalies WHERE resolved = FALSE ORDER BY date DESC',
    );

    return rows.map((r) => ({
      metric: r.metric,
      date: r.date,
      value: Number(r.value),
      expected: Number(r.expected),
      zScore: Number(r.z_score),
      direction: r.direction as 'up' | 'down',
      severity: r.severity as 'low' | 'medium' | 'high',
      resolved: r.resolved,
    }));
  } catch (err) {
    console.error('[dataintel][anomalies] getActive failed:', err);
    return null;
  }
}

export async function resolveAnomaly(
  date: string,
  metric: string,
): Promise<boolean> {
  try {
    await execute(ENSURE_TABLE);

    await execute(
      'UPDATE anomalies SET resolved = TRUE WHERE date = ? AND metric = ?',
      date,
      metric,
    );

    return true;
  } catch (err) {
    console.error('[dataintel][anomalies] resolve failed:', err);
    return false;
  }
}

export async function getAnomalyHistory(
  limit: number,
): Promise<Anomaly[] | null> {
  try {
    await execute(ENSURE_TABLE);

    const rows = await query<StoredAnomaly>(
      'SELECT * FROM anomalies ORDER BY date DESC LIMIT ?',
      limit,
    );

    return rows.map((r) => ({
      metric: r.metric,
      date: r.date,
      value: Number(r.value),
      expected: Number(r.expected),
      zScore: Number(r.z_score),
      direction: r.direction as 'up' | 'down',
      severity: r.severity as 'low' | 'medium' | 'high',
      resolved: r.resolved,
    }));
  } catch (err) {
    console.error('[dataintel][anomalies] getHistory failed:', err);
    return null;
  }
}
