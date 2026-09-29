import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig, resetConfigCache } from '../env.js';
import { execute, query } from '../db/duckdb.js';
import { listAlerts, undeliveredAlerts } from '../services/alerts.js';

/*
 * H.3 (GAP-FIX-R6), Block H: "no alert may be built to record without a real
 * consumer". On a real in-memory DuckDB:
 *   - an alert is refused (409 ALERT_CHANNEL_UNCONFIGURED) on a channel this
 *     deployment cannot deliver through, and so is re-activating one;
 *   - GET /alerts/channels says which channels exist;
 *   - GET /alerts/undelivered lists the triggers that reached nobody, the read
 *     Core's operations watchdog fails on.
 */

const KEY = getConfig().INTERNAL_API_KEY;
const WEBHOOK = '11111111-1111-4111-8111-111111111111';
const EMAIL = '22222222-2222-4222-8222-222222222222';
const auth = (req: request.Test) => req.set('x-internal-api-key', KEY);
const body = (channel: string) => ({ name: 'dau drop', metric: 'dau', condition: 'below', threshold: 10, channel, cooldownMinutes: 60 });

function setEnv(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  resetConfigCache();
}

const NONE = { ALERT_WEBHOOK_URL: undefined, ALERT_EMAIL_SERVER_URL: undefined, ALERT_EMAIL_INTERNAL_KEY: undefined, ALERT_EMAIL_TO: undefined };

beforeEach(async () => {
  setEnv(NONE);
  await listAlerts();
  await execute('DELETE FROM alert_history');
  await execute('DELETE FROM alerts');
});
afterEach(() => setEnv(NONE));

describe('POST /alerts: only on a configured channel', () => {
  it('refuses a webhook alert with no ALERT_WEBHOOK_URL, and writes nothing', async () => {
    const res = await auth(request(createApp()).post('/api/v1/intel/alerts').send(body('webhook')));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALERT_CHANNEL_UNCONFIGURED');
    expect(await query('SELECT id FROM alerts')).toEqual([]);
  });

  it('refuses an email alert unless the server URL, key and recipient are all set', async () => {
    setEnv({ ALERT_EMAIL_SERVER_URL: 'https://email.internal.test', ALERT_EMAIL_INTERNAL_KEY: 'k' });
    expect((await auth(request(createApp()).post('/api/v1/intel/alerts').send(body('email')))).status).toBe(409);
    setEnv({ ALERT_EMAIL_TO: 'ops@example.com' });
    expect((await auth(request(createApp()).post('/api/v1/intel/alerts').send(body('email')))).status).toBe(201);
  });

  it('creates the alert once its channel is configured', async () => {
    setEnv({ ALERT_WEBHOOK_URL: 'https://ops.example.test/alerts' });
    const res = await auth(request(createApp()).post('/api/v1/intel/alerts').send(body('webhook')));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ channel: 'webhook', status: 'active' });
  });
});

describe('GET /alerts/channels', () => {
  it('says which channels this deployment can deliver through', async () => {
    expect((await auth(request(createApp()).get('/api/v1/intel/alerts/channels'))).body.data).toEqual({ webhook: false, email: false });
    setEnv({ ALERT_WEBHOOK_URL: 'https://ops.example.test/alerts' });
    expect((await auth(request(createApp()).get('/api/v1/intel/alerts/channels'))).body.data).toEqual({ webhook: true, email: false });
  });

  it('is internal-key only', async () => {
    expect((await request(createApp()).get('/api/v1/intel/alerts/channels')).status).toBe(401);
  });
});

describe('PATCH /alerts/:id: no re-activation on a missing channel', () => {
  beforeEach(async () => {
    await execute(`INSERT INTO alerts (id, name, metric, condition, threshold, channel, cooldown_minutes, status, created_at) VALUES
      ('${WEBHOOK}', 'dau drop', 'dau', 'below', 10, 'webhook', 60, 'paused', CURRENT_TIMESTAMP),
      ('${EMAIL}', 'events spike', 'events', 'above', 500, 'email', 60, 'paused', CURRENT_TIMESTAMP)`);
  });

  it('refuses to switch on an alert whose channel is not configured, and leaves it paused', async () => {
    const res = await auth(request(createApp()).patch(`/api/v1/intel/alerts/${WEBHOOK}`).send({ status: 'active' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALERT_CHANNEL_UNCONFIGURED');
    expect(await query<{ status: string }>(`SELECT status FROM alerts WHERE id = '${WEBHOOK}'`)).toEqual([{ status: 'paused' }]);
  });

  it('switches it on once the channel is configured, and always lets an alert be paused', async () => {
    setEnv({ ALERT_WEBHOOK_URL: 'https://ops.example.test/alerts' });
    expect((await auth(request(createApp()).patch(`/api/v1/intel/alerts/${WEBHOOK}`).send({ status: 'active' }))).status).toBe(200);
    expect((await auth(request(createApp()).patch(`/api/v1/intel/alerts/${EMAIL}`).send({ status: 'active' }))).status).toBe(409);
    expect((await auth(request(createApp()).patch(`/api/v1/intel/alerts/${EMAIL}`).send({ status: 'paused' }))).status).toBe(200);
  });

  it('answers 404 for an unknown alert being switched on', async () => {
    const res = await auth(request(createApp()).patch('/api/v1/intel/alerts/33333333-3333-4333-8333-333333333333').send({ status: 'active' }));
    expect(res.status).toBe(404);
  });
});

describe('undelivered triggers (the operations watchdog read)', () => {
  beforeEach(async () => {
    await execute(`INSERT INTO alerts (id, name, metric, condition, threshold, channel, cooldown_minutes, status, created_at) VALUES
      ('${WEBHOOK}', 'dau drop', 'dau', 'below', 10, 'webhook', 60, 'active', CURRENT_TIMESTAMP)`);
    const row = (ago: string, status: string | null, error: string | null = null, attempts: number | null = null) =>
      `('${WEBHOOK}', CURRENT_TIMESTAMP - INTERVAL ${ago}, 'dau', 3, 10, 'below', ${status === null ? 'NULL' : `'${status}'`}, 'webhook', NULL, ${error === null ? 'NULL' : `'${error}'`}, ${attempts ?? 'NULL'})`;
    await execute(`INSERT INTO alert_history (alert_id, triggered_at, metric, value, threshold, condition, delivery_status, delivery_channel, delivered_at, delivery_error, delivery_attempts) VALUES
      ${row('1 HOUR', 'failed', 'HTTP 502', 3)},
      ${row('2 HOUR', 'unconfigured', null, 0)},
      ${row('3 HOUR', null)},
      ${row('1 MINUTE', null)},
      ${row('4 HOUR', 'delivered', null, 1)},
      ${row('40 HOUR', 'failed', 'HTTP 500', 3)}`);
  });

  it('counts failed, unconfigured and long-unrecorded triggers inside the window, newest first', async () => {
    const result = await undeliveredAlerts(36);
    expect(result).toMatchObject({ hours: 36, count: 3 });
    expect(result!.alerts.map((a) => [a.status, a.error, a.attempts])).toEqual([
      ['failed', 'HTTP 502', 3], ['unconfigured', null, 0], ['unrecorded', null, null],
    ]);
    expect(result!.alerts[0]).toMatchObject({ alertId: WEBHOOK, name: 'dau drop', channel: 'webhook' });
    expect((await undeliveredAlerts(48))!.count).toBe(4);
  });

  it('refuses a window outside 1-168 hours', async () => {
    expect(await undeliveredAlerts(0)).toBeNull();
    expect(await undeliveredAlerts(169)).toBeNull();
  });

  it('GET /alerts/undelivered answers inside the envelope, internal-key only', async () => {
    const res = await auth(request(createApp()).get('/api/v1/intel/alerts/undelivered?hours=36'));
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(3);
    expect((await auth(request(createApp()).get('/api/v1/intel/alerts/undelivered?hours=0'))).status).toBe(400);
    expect((await request(createApp()).get('/api/v1/intel/alerts/undelivered')).status).toBe(401);
  });
});
