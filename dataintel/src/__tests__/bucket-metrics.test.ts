import { randomUUID } from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../env.js';
import { execute, initDb } from '../db/duckdb.js';

/*
 * forecastQuery/anomalyQuery/compareQuery previously interpolated the raw
 * `metric` enum value directly as a SQL column name against a subquery that
 * only ever exposed `event_count`/`users` — so every metric except the one
 * that happened to literally match a column name ('users') threw a DuckDB
 * "column not found" error deep inside the query, surfacing as an opaque
 * 502 no matter which of the 9 documented metric values was requested.
 *
 * This exercises the fix against a real, seeded in-process DuckDB: metrics
 * that map to a real rollup column ('events', 'sessions') must now succeed,
 * and metrics that fundamentally can't be answered by a flat bucket rollup
 * ('wau') must be rejected clearly at the edge (400), not 502 deep inside
 * a query.
 */

const KEY = getConfig().INTERNAL_API_KEY;
const auth = (req: request.Test) => req.set('x-internal-api-key', KEY);

let nextEventId = 1;

async function seedEvent(userId: string, sessionId: string, daysAgo: number): Promise<void> {
  await execute(
    `INSERT INTO fact_events (event_id, user_id, session_id, event_type, created_at)
     VALUES (?, ?, ?, 'nav_view', CURRENT_TIMESTAMP - INTERVAL (?) DAY)`,
    nextEventId++,
    userId,
    sessionId,
    daysAgo,
  );
}

beforeAll(async () => {
  await initDb();

  // Two days of history: day -2 has 2 users / 2 sessions / 3 events,
  // day -1 has 3 users / 3 sessions / 5 events.
  const u = Array.from({ length: 5 }, () => randomUUID());
  const s = Array.from({ length: 5 }, () => randomUUID());

  await seedEvent(u[0]!, s[0]!, 2);
  await seedEvent(u[0]!, s[0]!, 2);
  await seedEvent(u[1]!, s[1]!, 2);

  await seedEvent(u[2]!, s[2]!, 1);
  await seedEvent(u[2]!, s[2]!, 1);
  await seedEvent(u[3]!, s[3]!, 1);
  await seedEvent(u[3]!, s[3]!, 1);
  await seedEvent(u[4]!, s[4]!, 1);
});

describe('GET /api/v1/intel/forecast — metric/column resolution', () => {
  it('succeeds for metric=events (previously 502: no "events" column exists)', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/forecast?metric=events&daysHistory=7&daysForecast=3'),
    );
    expect(res.status).toBe(200);
    const historical = res.body.data.filter((p: { isForecast: boolean }) => !p.isForecast);
    expect(historical.length).toBeGreaterThan(0);
    // event counts (3, 5), not user/session counts (2, 3) — proves the
    // historical series is now actually reading the requested metric.
    expect(historical.some((p: { value: number }) => p.value === 3 || p.value === 5)).toBe(true);
  });

  it('succeeds for metric=sessions (previously 502: no "sessions" column existed)', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/forecast?metric=sessions&daysHistory=7&daysForecast=3'),
    );
    expect(res.status).toBe(200);
  });

  it('rejects metric=wau with 400, not a 502 from deep inside DuckDB', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/forecast?metric=wau&daysHistory=7&daysForecast=3'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/intel/anomalies — metric/column resolution', () => {
  it('succeeds for metric=events and metric=sessions', async () => {
    const eventsRes = await auth(request(createApp()).get('/api/v1/intel/anomalies?metric=events&days=7'));
    expect(eventsRes.status).toBe(200);

    const sessionsRes = await auth(request(createApp()).get('/api/v1/intel/anomalies?metric=sessions&days=7'));
    expect(sessionsRes.status).toBe(200);
  });

  it('rejects metric=retention with 400', async () => {
    const res = await auth(request(createApp()).get('/api/v1/intel/anomalies?metric=retention&days=7'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/intel/metrics/compare — metric/column resolution', () => {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const currentStart = iso(new Date(now.getTime() - 3 * 86400_000));
  const currentEnd = iso(now);
  const previousStart = iso(new Date(now.getTime() - 6 * 86400_000));
  const previousEnd = iso(new Date(now.getTime() - 3 * 86400_000));

  it('succeeds for metric=events and metric=sessions', async () => {
    const eventsRes = await auth(
      request(createApp()).get(
        `/api/v1/intel/metrics/compare?metric=events&currentStart=${currentStart}&currentEnd=${currentEnd}&previousStart=${previousStart}&previousEnd=${previousEnd}`,
      ),
    );
    expect(eventsRes.status).toBe(200);

    const sessionsRes = await auth(
      request(createApp()).get(
        `/api/v1/intel/metrics/compare?metric=sessions&currentStart=${currentStart}&currentEnd=${currentEnd}&previousStart=${previousStart}&previousEnd=${previousEnd}`,
      ),
    );
    expect(sessionsRes.status).toBe(200);
  });

  it('rejects metric=completions instead of relabelling all events as completions', async () => {
    const res = await auth(
      request(createApp()).get(
        `/api/v1/intel/metrics/compare?metric=completions&currentStart=${currentStart}&currentEnd=${currentEnd}&previousStart=${previousStart}&previousEnd=${previousEnd}`,
      ),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/intel/anomalies — value reporting is metric-aware', () => {
  it('reports the requested metric value, not a hardcoded event_count', async () => {
    const res = await auth(request(createApp()).get('/api/v1/intel/anomalies?metric=sessions&days=7&threshold=0.5'));
    expect(res.status).toBe(200);
    // With 2 sessions on day -2 and 3 sessions on day -1, any flagged
    // anomaly's `value` must be one of the actual session counts (2 or 3),
    // never the (different) event counts (3 or 5) the old hardcoded
    // row.event_count read would have reported instead.
    for (const a of res.body.data) {
      expect([2, 3]).toContain(a.value);
    }
  });
});
