import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getConfig } from '../env.js';
import { exec, execute, initDb, query } from '../db/duckdb.js';
import { applyErasureTombstones } from '../services/erasure.js';
import { applyWarehouseRetention, getLastRetentionRun } from '../services/warehouseRetention.js';
import { ERASURE_REAPPLY_JOB, getMaintenanceStatus, RETENTION_JOB } from '../services/warehouseMaintenance.js';

/*
 * H.4 and the Block H non-negotiables (GAP-FIX-R8): the warehouse retention
 * prune (H.2) and the erasure re-apply (E.6) record every run, failures
 * included, and the record has a consumer: GET /api/v1/intel/maintenance/status,
 * internal key only, which Core's `warehouse_retention` watched job reads.
 * Failures here are real ones: a table the step needs is renamed away for the
 * duration of the run, on the in-memory warehouse.
 */

const KEY = getConfig().INTERNAL_API_KEY;
const HOUR_MS = 3_600_000;

async function withTableRenamed<T>(table: string, body: () => Promise<T>): Promise<T> {
  await exec(`ALTER TABLE ${table} RENAME TO ${table}_away`);
  try {
    return await body();
  } finally {
    await exec(`ALTER TABLE ${table}_away RENAME TO ${table}`);
  }
}

describe('warehouse maintenance log (H.4)', () => {
  beforeAll(async () => {
    await initDb();
  });

  beforeEach(async () => {
    await execute('DELETE FROM warehouse_maintenance_log');
  });

  it('a successful prune and re-apply each record an ok run', async () => {
    const now = new Date();
    await applyWarehouseRetention(now);
    await applyErasureTombstones(now);
    const status = await getMaintenanceStatus();
    expect(status?.steps.map((step) => step.step)).toEqual([RETENTION_JOB, ERASURE_REAPPLY_JOB]);
    for (const step of status!.steps) {
      expect(step.lastSuccessAt).toBe(now.toISOString());
      expect(step.lastAttemptAt).toBe(now.toISOString());
      expect(step.lastAttemptOk).toBe(true);
      expect(step.lastError).toBeNull();
    }
    const rows = await query<{ job: string; ok: boolean }>(`SELECT job, ok FROM warehouse_maintenance_log WHERE job = ?`, ERASURE_REAPPLY_JOB);
    expect(rows).toEqual([{ job: ERASURE_REAPPLY_JOB, ok: true }]);
  });

  it('a failed prune rolls back, records ok = FALSE with its error and keeps the last success', async () => {
    const earlier = new Date(Date.now() - 5 * HOUR_MS);
    await applyWarehouseRetention(earlier);
    const failedAt = new Date();
    await expect(withTableRenamed('experiment_exposures', () => applyWarehouseRetention(failedAt))).rejects.toThrow();

    const step = (await getMaintenanceStatus())!.steps.find((entry) => entry.step === RETENTION_JOB)!;
    expect(step.lastSuccessAt).toBe(earlier.toISOString());
    expect(step.lastAttemptAt).toBe(failedAt.toISOString());
    expect(step.lastAttemptOk).toBe(false);
    expect(step.lastError).toMatch(/experiment_exposures/);
    // The failed run's per-table rows rolled back: only the failure row carries its timestamp.
    const failedRows = await query<{ table_name: string; ok: boolean }>(
      'SELECT table_name, ok FROM warehouse_maintenance_log WHERE job = ? AND ran_at = ?::TIMESTAMP',
      RETENTION_JOB, failedAt.toISOString().replace('T', ' ').replace('Z', ''),
    );
    expect(failedRows).toEqual([{ table_name: 'all', ok: false }]);
    expect((await getLastRetentionRun())?.ranAt).toBe(earlier.toISOString());
  });

  it('a failed erasure re-apply records ok = FALSE, so an erased child cannot come back unnoticed', async () => {
    const failedAt = new Date();
    await expect(withTableRenamed('erased_subjects', () => applyErasureTombstones(failedAt))).rejects.toThrow();
    const step = (await getMaintenanceStatus())!.steps.find((entry) => entry.step === ERASURE_REAPPLY_JOB)!;
    expect(step.lastSuccessAt).toBeNull();
    expect(step.lastAttemptOk).toBe(false);
    expect(step.lastAttemptAt).toBe(failedAt.toISOString());
  });

  it('a step that never ran reports null, not a success', async () => {
    const status = await getMaintenanceStatus();
    expect(status?.steps.every((step) => step.lastSuccessAt === null && step.lastAttemptAt === null && step.lastAttemptOk === null)).toBe(true);
  });

  it('GET /maintenance/status answers inside the envelope, internal key only', async () => {
    const now = new Date();
    await applyWarehouseRetention(now);
    const res = await request(createApp()).get('/api/v1/intel/maintenance/status').set('x-internal-api-key', KEY);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.steps).toHaveLength(2);
    expect(res.body.data.steps[0]).toMatchObject({ step: RETENTION_JOB, lastSuccessAt: now.toISOString(), lastAttemptOk: true });
    expect((await request(createApp()).get('/api/v1/intel/maintenance/status')).status).toBe(401);
    expect((await request(createApp()).get('/api/v1/intel/maintenance/status').set('x-internal-api-key', 'wrong')).status).toBe(401);
  });

  it('an unreadable log is a 502, never "never ran"', async () => {
    const res = await withTableRenamed('warehouse_maintenance_log', () =>
      request(createApp()).get('/api/v1/intel/maintenance/status').set('x-internal-api-key', KEY));
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });
});
