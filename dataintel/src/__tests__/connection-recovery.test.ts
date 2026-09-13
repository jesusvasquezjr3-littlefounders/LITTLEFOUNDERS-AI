import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../env.js';
import { exec, execute, query, withConnection } from '../db/duckdb.js';

const KEY = getConfig().INTERNAL_API_KEY;

/**
 * Regression: 2026-09-12. One failed statement used to poison the process.
 *
 * `query`, `execute` and `exec` all run on the single implicit connection a
 * `duckdb.Database` owns, and DuckDB runs every statement inside a transaction.
 * On this driver a failed statement did not always unwind its own — so the
 * connection was left mid-transaction, and everything after it failed FAR from
 * the cause and with an unrelated message:
 *
 *   a SELECT from a missing table  → Catalog Error          (the real, expected error)
 *   the next CREATE TABLE          → "cannot start a transaction within a transaction"
 *   the next SELECT                → "Serialization Error: Failed to parse JSON string"
 *
 * That is not a hypothetical. The warehouse has no `fact_events` until the
 * first sync finishes, so this fired on ordinary console traffic during every
 * cold start, and it made `POST /api/v1/intel/experiments` answer 502 instead
 * of 201 in 7 of 8 local suite runs — a failure that pointed at the experiments
 * route, which had nothing to do with it.
 *
 * These tests assert the RECOVERY, not the driver's behaviour: the first
 * statement is still expected to reject. What must not happen is the second one
 * failing too.
 */
describe('reads that fail do not break the writes that follow', () => {
  /*
   * The shape that actually reproduces, and the reason this is an app-level
   * test rather than a unit one: a single failing statement is harmless, and
   * so is a single concurrent batch. It takes the real thing — a run of
   * console reads against a warehouse that has not synced yet, several of
   * which fan out into concurrent queries on the shared connection — to wedge
   * it. Without the recovery in db/duckdb.ts this fails every time — to check
   * that is still true, make `recoverSharedConnection` resolve without issuing
   * its ROLLBACK and run this file.
   */
  const READS = [
    '/api/v1/intel/metrics/summary?days=30',
    '/api/v1/intel/metrics/trends?metric=dau&granularity=day&days=30',
    '/api/v1/intel/engagement/leaderboard?limit=10',
    '/api/v1/intel/lessons/dropoff?limit=25',
    '/api/v1/intel/retention/cohorts?weeks=12',
  ];

  it('a cold warehouse does not stop an experiment from being created', async () => {
    for (const path of READS) {
      const res = await request(createApp()).get(path).set('x-internal-api-key', KEY);
      // 502 is the correct answer here — the tables genuinely are not there.
      expect([200, 502]).toContain(res.status);
    }

    const created = await request(createApp())
      .post('/api/v1/intel/experiments')
      .set('x-internal-api-key', KEY)
      .send({
        name: 'Recovery probe',
        metric: 'dau',
        variantA: 'Control',
        variantB: 'Variant',
      });

    expect(created.status).toBe(201);
  });
});

describe('shared connection recovers from a failed statement', () => {
  it('a failed SELECT does not break the next DDL', async () => {
    await expect(query('SELECT * FROM a_table_that_does_not_exist')).rejects.toThrow();

    await expect(
      exec('CREATE TABLE IF NOT EXISTS recovery_probe_ddl (id INTEGER)'),
    ).resolves.toBeUndefined();
  });

  it('a failed SELECT does not break the next write or read', async () => {
    await exec('CREATE TABLE IF NOT EXISTS recovery_probe_rw (id INTEGER)');

    await expect(query('SELECT nonexistent_column FROM recovery_probe_rw')).rejects.toThrow();

    await execute('INSERT INTO recovery_probe_rw (id) VALUES (?)', 7);
    const rows = await query<{ id: number }>('SELECT id FROM recovery_probe_rw');
    expect(rows.map((r) => r.id)).toContain(7);
  });

  it('a failed write does not break the connection either', async () => {
    await expect(execute('INSERT INTO no_such_table (id) VALUES (?)', 1)).rejects.toThrow();

    const rows = await query<{ n: number }>('SELECT 1 AS n');
    expect(rows[0]?.n).toBe(1);
  });

  /*
   * The recovery ROLLBACK is only safe because explicit transactions do not
   * live on the shared connection. If someone moves one back onto it, this
   * fails: the committed row would be gone.
   */
  it('an explicit transaction is isolated from the shared connection', async () => {
    await exec('CREATE TABLE IF NOT EXISTS recovery_probe_tx (id INTEGER)');

    await withConnection(async (c) => {
      await c.exec('BEGIN TRANSACTION');
      await c.execute('INSERT INTO recovery_probe_tx (id) VALUES (?)', 42);
      await c.exec('COMMIT');
    });

    // Poison the shared connection, which triggers its ROLLBACK.
    await expect(query('SELECT * FROM still_not_a_table')).rejects.toThrow();

    const rows = await query<{ id: number }>('SELECT id FROM recovery_probe_tx');
    expect(rows.map((r) => r.id)).toContain(42);
  });

  it('withConnection closes its connection even when the body throws', async () => {
    await expect(
      withConnection(async (c) => {
        await c.exec('BEGIN TRANSACTION');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // The abandoned transaction died with its connection; the shared one is fine.
    const rows = await query<{ n: number }>('SELECT 1 AS n');
    expect(rows[0]?.n).toBe(1);
  });
});
