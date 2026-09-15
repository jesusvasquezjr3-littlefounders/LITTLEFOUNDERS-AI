import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetConfigForTests } from '../config.js';
import { summarizeEmailLogs } from '../db/emailLogsRepo.js';

/*
 * Regression for the 2026-09 "Courier no respondió" incident: a year-long
 * trend used to cost one PostgREST request PER DAY (plus one per distinct
 * status/template/locale value), all fired via `Promise.all` — 365+
 * concurrent requests for the admin dashboard's own default range, which
 * reliably lost the race against Core's 10s proxy timeout
 * (backend/src/routes/admin.ts). These tests pin the fix: a summary over any
 * window costs a SMALL, bounded number of sequential requests, never one per
 * day or per distinct value.
 */

function row(overrides: Partial<{ status: string; template_type: string; locale: string | null; created_at: string }> = {}) {
  return {
    status: 'relayed',
    template_type: 'auth',
    locale: 'es-MX',
    created_at: '2026-09-10T12:00:00.000Z',
    ...overrides,
  };
}

function restResponse(body: unknown, contentRange: string) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Content-Range': contentRange },
  });
}

beforeEach(() => {
  resetConfigForTests();
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'http://vault.test';
  // Spaced out on purpose: config.ts only checks `.min(20)` on length, and a
  // contiguous 16+ char run here trips secrets:check's pattern scan even
  // though this is a fixture, never a real key (see coursegen's tests for
  // the same avoidance, at a length short enough not to need it).
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test only placeholder key, never a real credential';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe('summarizeEmailLogs', () => {
  it('costs exactly one request for a window that fits on one page — including the 365-day default', async () => {
    const fetchSpy = vi.fn(async () => restResponse([row(), row({ status: 'failed' })], '0-1/2'));
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await summarizeEmailLogs(365);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(summary?.total).toBe(2);
    expect(summary?.statuses).toEqual({ relayed: 1, failed: 1 });
    expect(summary?.templates).toEqual({ auth: 2 });
    expect(summary?.locales).toEqual({ 'es-MX': 2 });
    expect(summary?.trend).toHaveLength(365);
  });

  it('paginates sequentially — one request per page, not per day or per distinct value', async () => {
    const fullPage = Array.from({ length: 1000 }, () => row());
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(restResponse(fullPage, '0-999/1200'))
      .mockResolvedValueOnce(restResponse(Array.from({ length: 200 }, () => row()), '1000-1199/1200'));
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await summarizeEmailLogs(30);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(summary?.total).toBe(1200);
  });

  it('buckets rows into their UTC day in the trend, not just their existence', async () => {
    const fetchSpy = vi.fn(async () =>
      restResponse(
        [row({ created_at: '2026-09-10T23:59:59.000Z' }), row({ created_at: '2026-09-10T00:00:01.000Z' }), row({ created_at: '2026-09-11T08:00:00.000Z' })],
        '0-2/3',
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await summarizeEmailLogs(7);

    const day10 = summary?.trend?.find((point) => point.date === '2026-09-10');
    const day11 = summary?.trend?.find((point) => point.date === '2026-09-11');
    expect(day10?.count).toBe(2);
    expect(day11?.count).toBe(1);
  });

  it('refuses a partial summary when a page fails, rather than showing a truncated count as complete', async () => {
    const fetchSpy = vi.fn(async () => new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchSpy);

    const summary = await summarizeEmailLogs(30);

    expect(summary).toBeNull();
  });
});
