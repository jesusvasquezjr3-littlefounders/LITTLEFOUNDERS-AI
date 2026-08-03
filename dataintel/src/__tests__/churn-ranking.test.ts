import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { execute, initDb } from '../db/duckdb.js';
import { getChurnRisk } from '../services/churn.js';

/*
 * churnRiskQuery previously did `ORDER BY days_since_active DESC LIMIT $1`
 * in SQL, truncating the candidate set BEFORE risk_score (a 3-factor JS
 * computation) was ever calculated. Two users in the SAME days_since_active
 * bucket (7 < d <= 14, contributing a flat +40 either way) diverge only on
 * lessons_completed (+10 if zero) — so a user with fewer days-since-active
 * but zero lessons can have a HIGHER true risk_score than one with more
 * days-since-active but some lessons completed. LIMIT-by-days-since-active
 * would keep the wrong one.
 */

let nextEventId = 1;

async function seedUser(
  userId: string,
  daysAgo: number,
  lessonsCompleted: number,
): Promise<void> {
  await execute(
    `INSERT INTO fact_events (event_id, user_id, event_type, created_at)
     VALUES (?, ?, 'nav_view', CURRENT_TIMESTAMP - INTERVAL (?) DAY)`,
    nextEventId++,
    userId,
    daysAgo,
  );
  await execute(
    `INSERT INTO dim_users (user_id, role, lessons_completed) VALUES (?, 'universal', ?)`,
    userId,
    lessonsCompleted,
  );
}

describe('getChurnRisk — ranking survives SQL truncation', () => {
  it('does not drop the highest true risk_score user in favor of one merely inactive longer', async () => {
    await initDb();

    // Same days-since-active bucket (7 < d <= 14, +40 either way).
    const higherRiskUser = randomUUID(); // 8 days inactive, 0 lessons -> 40+30+10 = 80
    const lowerRiskUser = randomUUID(); // 13 days inactive, 5 lessons -> 40+30+0 = 70

    await seedUser(higherRiskUser, 8, 0);
    await seedUser(lowerRiskUser, 13, 5);

    // With the old SQL `ORDER BY days_since_active DESC LIMIT 1`, only
    // lowerRiskUser (13 days) would ever reach the JS layer — higherRiskUser
    // (8 days, but the actually higher risk_score) would be silently
    // dropped before its score was ever computed.
    const results = await getChurnRisk(1);
    expect(results).not.toBeNull();
    expect(results).toHaveLength(1);
    expect(results![0]!.user_id).toBe(higherRiskUser);
    expect(results![0]!.risk_score).toBe(80);
  });

  it('never returns a negative risk_score', async () => {
    await initDb();
    const results = await getChurnRisk(1000);
    expect(results).not.toBeNull();
    for (const r of results!) {
      expect(r.risk_score).toBeGreaterThanOrEqual(0);
      expect(r.risk_score).toBeLessThanOrEqual(100);
    }
  });
});
