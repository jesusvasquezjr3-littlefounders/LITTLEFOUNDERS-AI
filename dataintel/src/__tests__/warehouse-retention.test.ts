import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { execute, initDb, query } from '../db/duckdb.js';
import { syncAll } from '../db/sync.js';
import { getLastRetentionRun, RAW_EVENT_RETENTION_DAYS, retentionCutoff } from '../services/warehouseRetention.js';

/*
 * H.2 / Appendix O 1.2 (gap-fix round 6): the warehouse keeps the raw store's
 * written 400-day window. Before this, `fact_events_raw` and the experiment
 * tables were never pruned, so an event Vault's prune_learning_events(400)
 * deleted lived on in the warehouse forever.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DAY_MS = 86_400_000;
const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString();

let nextEventId = 5_000_000;

function vaultEvent(days: number): Record<string, unknown> {
  return {
    event_id: nextEventId++,
    user_id: randomUUID(),
    event_type: 'nav_view',
    role: 'parent',
    created_at: daysAgo(days),
  };
}

/** A Vault stub: the events endpoint answers one batch, every dimension answers empty. */
function stubVault(events: Record<string, unknown>[]): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = url.includes('dataintel_events_sync') ? events : [];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }));
}

async function eventExists(eventId: unknown): Promise<boolean> {
  const rows = await query<{ n: number | bigint }>('SELECT count(*) AS n FROM fact_events_raw WHERE event_id = ?', eventId);
  return Number(rows[0]?.n) === 1;
}

async function experimentRows(table: 'experiment_assignments' | 'experiment_exposures', userId: string): Promise<number> {
  const rows = await query<{ n: number | bigint }>(`SELECT count(*) AS n FROM ${table} WHERE user_id = ?`, userId);
  return Number(rows[0]?.n);
}

describe('warehouse retention (H.2, 400 days)', () => {
  beforeAll(async () => {
    await initDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a sync cycle removes a 401-day-old event, assignment and exposure and keeps 399-day-old ones', async () => {
    const expired = vaultEvent(401);
    const kept = vaultEvent(399);
    const oldLearner = randomUUID();
    const recentLearner = randomUUID();
    for (const [learner, days] of [[oldLearner, 401], [recentLearner, 399]] as const) {
      await execute(
        'INSERT INTO experiment_assignments (experiment_id, user_id, variant, assigned_at) VALUES (?, ?, ?, ?::TIMESTAMP)',
        'exp-retention', learner, 'A', retentionCutoff(new Date(), days),
      );
      await execute(
        'INSERT INTO experiment_exposures (experiment_id, user_id, variant, exposed_at) VALUES (?, ?, ?, ?::TIMESTAMP)',
        'exp-retention', learner, 'A', retentionCutoff(new Date(), days),
      );
    }

    stubVault([expired, kept]);
    const result = await syncAll();

    expect(result.tables.learning_events).toBe(2);
    expect(result.tables.retention_pruned).toBeGreaterThanOrEqual(3);
    expect(await eventExists(expired.event_id)).toBe(false);
    expect(await eventExists(kept.event_id)).toBe(true);
    expect(await experimentRows('experiment_assignments', oldLearner)).toBe(0);
    expect(await experimentRows('experiment_exposures', oldLearner)).toBe(0);
    expect(await experimentRows('experiment_assignments', recentLearner)).toBe(1);
    expect(await experimentRows('experiment_exposures', recentLearner)).toBe(1);
  });

  it('records every prune run per table, including a run that removed nothing', async () => {
    stubVault([]);
    await syncAll();
    const rows = await query<{ table_name: string; retain_days: number; removed: number | bigint }>(
      `SELECT table_name, retain_days, removed FROM warehouse_maintenance_log
       WHERE ran_at = (SELECT max(ran_at) FROM warehouse_maintenance_log) ORDER BY table_name`,
    );
    expect(rows.map((row) => row.table_name)).toEqual(['experiment_assignments', 'experiment_exposures', 'fact_events_raw']);
    expect(rows.every((row) => Number(row.retain_days) === RAW_EVENT_RETENTION_DAYS && Number(row.removed) === 0)).toBe(true);
    const last = await getLastRetentionRun();
    expect(last?.removed).toBe(0);
    expect(last?.ranAt).toBeTruthy();
  });

  it('keeps one window with the Vault prune: insights-maintenance calls prune_learning_events with the same constant', () => {
    const yaml = readFileSync(path.join(REPO_ROOT, '.github/workflows/insights-maintenance.yml'), 'utf8');
    const calls = [...yaml.matchAll(/CALL prune_learning_events\((\d+)\)/g)].map((m) => Number(m[1]));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((days) => days === RAW_EVENT_RETENTION_DAYS)).toBe(true);
  });

  it('GOVERNANCE.md section 3 names the warehouse copy and its bound', () => {
    const doc = readFileSync(path.join(REPO_ROOT, 'docs/operations/GOVERNANCE.md'), 'utf8');
    const section = doc.slice(doc.indexOf('## 3.'), doc.indexOf('## 4.'));
    expect(section).toContain('fact_events_raw');
    expect(section).toContain(`${RAW_EVENT_RETENTION_DAYS} days`);
  });
});
