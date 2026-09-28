import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateAlerts, getAlertHistory } from '../services/alerts.js';
import { alertEmailBody } from '../services/alertEmail.js';
import { resetConfigCache } from '../env.js';

/*
 * H.3: an alert trigger must notify a human. These tests pin the delivery
 * contract: a webhook alert POSTs its payload to the configured URL once
 * per trigger; an unconfigured channel still records the trigger and warns
 * rather than crashing the evaluation loop; a failed delivery never loses
 * the durable trigger row.
 */

const { mockQuery, mockExecute, mockFetch } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockExecute: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('../db/duckdb.js', () => ({
  query: mockQuery,
  execute: mockExecute,
}));

afterEach(() => {
  delete process.env.ALERT_WEBHOOK_URL;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetConfigCache();
});

const ACTIVE_ALERT = {
  id: 'a1',
  name: 'dau drop',
  metric: 'dau',
  condition: 'below',
  threshold: 10,
  channel: 'webhook',
  cooldown_minutes: 60,
  status: 'active',
  last_triggered_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

function stubAlert(alert: Record<string, unknown> | null) {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('FROM alerts WHERE status')) {
      return Promise.resolve(alert === null ? [] : [alert]);
    }
    if (sql.includes('FROM alerts WHERE id')) {
      return Promise.resolve(alert === null ? [] : [{ last_triggered_at: alert.last_triggered_at }]);
    }
    if (sql.includes('COUNT(DISTINCT user_id)')) {
      return Promise.resolve([{ metric_value: 3 }]);
    }
    if (sql.includes('FILTER (WHERE')) {
      return Promise.resolve([{ current: 3, previous: 100 }]);
    }
    return Promise.resolve([]);
  });
  mockExecute.mockResolvedValue(undefined);
}

beforeEach(() => {
  stubAlert(ACTIVE_ALERT);
});

describe('evaluateAlerts delivery (H.3)', () => {
  it('POSTs the trigger payload to the configured webhook', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://ops.example.test/alerts';
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    const result = await evaluateAlerts();
    expect(result.triggered).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ops.example.test/alerts');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ alertId: 'a1', metric: 'dau', condition: 'below', value: 3 });
    delete process.env.ALERT_WEBHOOK_URL;
  });

  it('records the trigger even when no channel is configured (loud gap, no crash)', async () => {
    vi.stubGlobal('fetch', mockFetch);
    const result = await evaluateAlerts();
    expect(result.triggered).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps the durable row when delivery fails', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://ops.example.test/alerts';
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockRejectedValue(new Error('network down'));
    const result = await evaluateAlerts();
    expect(result.triggered).toBe(1);
    // The history insert still happened for the trigger.
    const historyInserts = mockExecute.mock.calls.filter((call) => String(call[0]).includes('INSERT INTO alert_history'));
    expect(historyInserts.length).toBe(1);
    delete process.env.ALERT_WEBHOOK_URL;
  });

  it('does not deliver for an alert in cooldown', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://ops.example.test/alerts';
    stubAlert({ ...ACTIVE_ALERT, last_triggered_at: new Date().toISOString() });
    vi.stubGlobal('fetch', mockFetch);
    const result = await evaluateAlerts();
    expect(result.triggered).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
    delete process.env.ALERT_WEBHOOK_URL;
  });
});

/*
 * H.3 email channel and Appendix O 1.3: the email body is the one the
 * email-server's /api/v1/send accepts (the shared fixture, which the
 * email-server's own suite POSTs through the real route and expects a 202),
 * and every trigger row records its delivery outcome.
 */
describe('email channel contract and delivery outcome (H.3, Appendix O 1.3)', () => {
  const FIXTURE_TRIGGER = { name: 'dau drop', metric: 'dau', condition: 'below' as const, threshold: 10, value: 3, triggeredAt: '2026-09-27T08:00:00.000Z' };
  const here = dirname(fileURLToPath(import.meta.url));

  function emailEnv() {
    process.env.ALERT_EMAIL_SERVER_URL = 'https://email.internal.test';
    process.env.ALERT_EMAIL_INTERNAL_KEY = 'internal-key';
    process.env.ALERT_EMAIL_TO = 'ops@example.com';
    resetConfigCache();
  }
  afterEach(() => {
    delete process.env.ALERT_EMAIL_SERVER_URL;
    delete process.env.ALERT_EMAIL_INTERNAL_KEY;
    delete process.env.ALERT_EMAIL_TO;
  });

  const deliveryUpdates = () => mockExecute.mock.calls.filter((call) => String(call[0]).includes('UPDATE alert_history SET delivery_status'));

  it('builds exactly the shared fixture, and the email-server copy is byte-identical', () => {
    const mine = readFileSync(join(here, 'fixtures/alert-email-body.json'), 'utf8');
    const theirs = readFileSync(join(here, '../../../email-server/src/__tests__/fixtures/alert-email-body.json'), 'utf8');
    expect(theirs).toBe(mine);
    expect(alertEmailBody('ops@example.com', FIXTURE_TRIGGER)).toEqual(JSON.parse(mine));
  });

  it('never sends the retired template/data shape the email-server rejects', () => {
    const body = alertEmailBody('ops@example.com', FIXTURE_TRIGGER) as unknown as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['subject', 'templateType', 'text', 'to']);
    expect(body.template).toBeUndefined();
    expect(body.data).toBeUndefined();
  });

  it('POSTs the accepted body to /api/v1/send with the internal key and records "delivered"', async () => {
    emailEnv();
    stubAlert({ ...ACTIVE_ALERT, channel: 'email' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'x', status: 'queued' }, error: null }), { status: 202 }));
    const result = await evaluateAlerts();
    expect(result.triggered).toBe(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://email.internal.test/api/v1/send');
    expect((init.headers as Record<string, string>)['x-internal-api-key']).toBe('internal-key');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ to: 'ops@example.com', subject: '[LittleFounders alert] dau drop', templateType: 'alert_notification' });
    expect(String(body.text)).toContain('Value: 3');
    const [update] = deliveryUpdates();
    expect(update!.slice(1, 3)).toEqual(['delivered', 'email']);
    expect(update![3]).toEqual(expect.any(String));
    expect(update![4]).toBeNull();
    expect(update![5]).toBe('a1');
  });

  it('records "failed" with the HTTP status when the email-server refuses', async () => {
    emailEnv();
    stubAlert({ ...ACTIVE_ALERT, channel: 'email' });
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue(new Response(null, { status: 400 }));
    await evaluateAlerts();
    expect(deliveryUpdates()[0]!.slice(1, 5)).toEqual(['failed', 'email', null, 'HTTP 400']);
  });

  it('records "failed" when the webhook throws, and "unconfigured" when no channel is set', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://ops.example.test/alerts';
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockRejectedValue(new Error('network down'));
    await evaluateAlerts();
    expect(deliveryUpdates()[0]!.slice(1, 3)).toEqual(['failed', 'webhook']);
    expect(String(deliveryUpdates()[0]![4])).toContain('network down');
    delete process.env.ALERT_WEBHOOK_URL;
    resetConfigCache();
    mockExecute.mockClear();
    await evaluateAlerts();
    expect(deliveryUpdates()[0]!.slice(1, 5)).toEqual(['unconfigured', 'webhook', null, null]);
  });

  it('the history read returns each trigger\'s delivery outcome, and only a known status', async () => {
    mockQuery.mockResolvedValueOnce([
      { alert_id: 'a1', triggered_at: '2026-09-27 08:00:00', metric: 'dau', value: 3, threshold: 10, condition: 'below',
        delivery_status: 'delivered', delivery_channel: 'email', delivered_at: '2026-09-27 08:00:01', delivery_error: null },
      { alert_id: 'a1', triggered_at: '2026-09-26 08:00:00', metric: 'dau', value: 3, threshold: 10, condition: 'below',
        delivery_status: 'bogus', delivery_channel: null, delivered_at: null, delivery_error: null },
    ]);
    const history = await getAlertHistory('a1', 10);
    expect(history![0]).toMatchObject({ deliveryStatus: 'delivered', deliveryChannel: 'email', deliveredAt: '2026-09-27 08:00:01', deliveryError: null });
    expect(history![1]!.deliveryStatus).toBeNull();
    const ddl = mockExecute.mock.calls.map((call) => String(call[0]));
    expect(ddl).toContain('ALTER TABLE alert_history ADD COLUMN IF NOT EXISTS delivery_status TEXT');
  });
});
