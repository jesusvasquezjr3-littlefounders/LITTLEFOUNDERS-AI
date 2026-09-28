import { randomUUID } from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { execute, initDb } from '../db/duckdb.js';
import {
  assignVariant,
  createExperiment,
  getExperimentResults,
  recordRuntimeExposure,
  startExperiment,
} from '../services/experiments.js';

/*
 * getExperimentResults() had two confirmed bugs that both make a real
 * effect report as "no difference":
 *
 * 1. normCDF() returned 1 - true_p instead of true_p, so a large,
 *    obviously-significant t-statistic produced pValue ~ 1 (not ~ 0).
 * 2. The 'dau'/'users' per-user metric query was `WHERE user_id = ?`
 *    GROUP BY user_id with COUNT(DISTINCT user_id) — always exactly 1,
 *    so every sample was the same constant and variance was always 0.
 *
 * Both are exercised here against a real in-process DuckDB with a
 * deliberately lopsided A/B split, so a regression in either fix makes
 * these assertions fail loudly instead of silently reporting "not
 * significant" for a difference that plainly exists.
 */

let nextEventId = 1;

async function seedUserEvents(userId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await execute(
      `INSERT INTO fact_events_raw (event_id, user_id, event_type, created_at)
       VALUES (?, ?, 'nav_view', CURRENT_TIMESTAMP + INTERVAL 1 SECOND)`,
      nextEventId++,
      userId,
    );
  }
}

beforeAll(async () => {
  await initDb();
});

describe('getExperimentResults — statistical correctness', () => {
  it('reports a clear, correctly-signed difference for an "events" metric, and never names it a winner (B.28)', async () => {
    const variantAUsers = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const variantBUsers = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];

    const exp = await createExperiment('events-diff', 'events', 'control', 'treatment');
    expect(exp).not.toBeNull();
    await startExperiment(exp!.id);
    for (const u of variantAUsers) await assignVariant(exp!.id, u, 'A');
    for (const u of variantBUsers) await assignVariant(exp!.id, u, 'B');
    // Assignment is not evidence. The result must use an actual exposure,
    // then only activity that happened after that treatment rendered.
    for (const u of [...variantAUsers, ...variantBUsers]) {
      expect(await recordRuntimeExposure(u, exp!.id, 'learn', 'default', 30)).not.toBeNull();
    }
    // Keep test ordering unambiguous across DuckDB timestamp precisions.
    await execute(
      "UPDATE experiment_exposures SET exposed_at = CURRENT_TIMESTAMP - INTERVAL 1 SECOND WHERE experiment_id = ?",
      exp!.id,
    );
    // A: ~4 events/user. B: ~20 events/user — a huge, unambiguous effect.
    for (const u of variantAUsers) await seedUserEvents(u, 4 + Math.floor(Math.random() * 2));
    for (const u of variantBUsers) await seedUserEvents(u, 19 + Math.floor(Math.random() * 3));

    const results = await getExperimentResults(exp!.id);
    expect(results).not.toBeNull();
    expect(results!.variantB.mean).toBeGreaterThan(results!.variantA.mean);
    // With the normCDF inversion, this would report ~0.95-1.0 and significant:false.
    expect(results!.pValue).toBeLessThan(0.05);
    expect(results!.significant).toBe(true);
    // B.28: engagement volume is diagnosed, never won on.
    expect(results!.higher).toBe('B');
    expect(results!.engagementVolume).toBe(true);
    expect(results!.winner).toBeNull();
  });

  it('does not collapse "users" metric samples to a constant across variants', async () => {
    // Variant A: only 1 of 5 assigned users ever did anything.
    // Variant B: all 5 assigned users were active.
    const variantAUsers = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const variantBUsers = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];

    const exp = await createExperiment('activation-diff', 'users', 'control', 'treatment');
    expect(exp).not.toBeNull();
    await startExperiment(exp!.id);
    for (const u of variantAUsers) await assignVariant(exp!.id, u, 'A');
    for (const u of variantBUsers) await assignVariant(exp!.id, u, 'B');
    for (const u of [...variantAUsers, ...variantBUsers]) {
      expect(await recordRuntimeExposure(u, exp!.id, 'learn', 'default', 30)).not.toBeNull();
    }
    await execute(
      "UPDATE experiment_exposures SET exposed_at = CURRENT_TIMESTAMP - INTERVAL 1 SECOND WHERE experiment_id = ?",
      exp!.id,
    );
    await seedUserEvents(variantAUsers[0]!, 1);
    for (const u of variantBUsers) await seedUserEvents(u, 1);

    const results = await getExperimentResults(exp!.id);
    expect(results).not.toBeNull();
    // With the COUNT(DISTINCT user_id) bug, both means would be exactly 1
    // and stddev would be exactly 0 for both variants.
    expect(results!.variantA.mean).toBeCloseTo(0.2, 5);
    expect(results!.variantB.mean).toBeCloseTo(1, 5);
    expect(results!.variantA.stddev).toBeGreaterThan(0);
  });
});
