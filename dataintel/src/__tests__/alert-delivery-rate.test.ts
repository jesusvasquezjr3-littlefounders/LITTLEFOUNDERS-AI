import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../env.js';
import { execute } from '../db/duckdb.js';
import { alertDeliveryRate, listAlerts } from '../services/alerts.js';

/*
 * Appendix O 1.3 (H.3): the Alert-to-Notification Delivery Rate and each
 * alert's latest delivery outcome, computed on a real in-memory DuckDB (the
 * test environment's DUCKDB_PATH is :memory:). An alert that fired and
 * notified nobody must be visible, never averaged away or hidden.
 */

const KEY = getConfig().INTERNAL_API_KEY;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

async function reset() {
  // listAlerts / alertDeliveryRate create both tables on first use.
  await listAlerts();
  await execute('DELETE FROM alert_history');
  await execute('DELETE FROM alerts');
  await execute(`INSERT INTO alerts (id, name, metric, condition, threshold, channel, cooldown_minutes, status, created_at) VALUES
    ('${A}', 'dau drop', 'dau', 'below', 10, 'webhook', 60, 'active', CURRENT_TIMESTAMP - INTERVAL 3 DAY),
    ('${B}', 'events spike', 'events', 'above', 500, 'email', 60, 'active', CURRENT_TIMESTAMP - INTERVAL 2 DAY),
    ('${C}', 'quiet', 'sessions', 'below', 1, 'webhook', 60, 'paused', CURRENT_TIMESTAMP - INTERVAL 1 DAY)`);
  const row = (id: string, ago: string, status: string | null, error: string | null = null) =>
    `('${id}', CURRENT_TIMESTAMP - INTERVAL ${ago}, 'dau', 3, 10, 'below', ${status === null ? 'NULL' : `'${status}'`}, 'webhook', NULL, ${error === null ? 'NULL' : `'${error}'`})`;
  await execute(`INSERT INTO alert_history (alert_id, triggered_at, metric, value, threshold, condition, delivery_status, delivery_channel, delivered_at, delivery_error) VALUES
    ${row(A, '5 HOUR', 'delivered')},
    ${row(A, '1 HOUR', 'failed', 'HTTP 500')},
    ${row(B, '2 HOUR', 'unconfigured')},
    ${row(B, '3 HOUR', 'delivered')},
    ${row(B, '4 HOUR', null)},
    ${row(A, '40 DAY', 'delivered')}`);
}

beforeEach(reset);

describe('alertDeliveryRate (Appendix O 1.3)', () => {
  it('counts every trigger in the window by outcome, against the 100% target', async () => {
    expect(await alertDeliveryRate(30)).toEqual({
      days: 30, triggered: 5, delivered: 2, failed: 1, unconfigured: 1, pending: 1, rate: 0.4, target: 1,
    });
  });

  it('widens with the window and answers no rate when nothing fired', async () => {
    expect(await alertDeliveryRate(60)).toMatchObject({ triggered: 6, delivered: 3, rate: 0.5 });
    await execute('DELETE FROM alert_history');
    expect(await alertDeliveryRate(30)).toMatchObject({ triggered: 0, rate: null });
  });

  it('refuses a window outside 1-365', async () => {
    expect(await alertDeliveryRate(0)).toBeNull();
    expect(await alertDeliveryRate(366)).toBeNull();
    expect(await alertDeliveryRate(1.5)).toBeNull();
  });
});

describe('listAlerts: the latest trigger outcome (H.3)', () => {
  it('carries each alert\'s latest delivery status and reason, null when it never fired', async () => {
    const alerts = await listAlerts();
    const byId = Object.fromEntries((alerts ?? []).map((a) => [a.id, a]));
    expect(byId[A]).toMatchObject({ lastDeliveryStatus: 'failed', lastDeliveryError: 'HTTP 500' });
    expect(byId[B]).toMatchObject({ lastDeliveryStatus: 'unconfigured', lastDeliveryError: null });
    expect(byId[C]).toMatchObject({ lastDeliveryStatus: null, lastDeliveryError: null });
  });
});

describe('GET /api/v1/intel/alerts/delivery', () => {
  it('answers the rate inside the envelope', async () => {
    const res = await request(createApp()).get('/api/v1/intel/alerts/delivery?days=30').set('x-internal-api-key', KEY);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ triggered: 5, delivered: 2, rate: 0.4, target: 1 });
  });

  it('refuses a bad window and a caller without the internal key', async () => {
    expect((await request(createApp()).get('/api/v1/intel/alerts/delivery?days=0').set('x-internal-api-key', KEY)).status).toBe(400);
    expect((await request(createApp()).get('/api/v1/intel/alerts/delivery?days=abc').set('x-internal-api-key', KEY)).status).toBe(400);
    expect((await request(createApp()).get('/api/v1/intel/alerts/delivery')).status).toBe(401);
  });
});
