import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateAlerts } from '../services/alerts.js';
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
