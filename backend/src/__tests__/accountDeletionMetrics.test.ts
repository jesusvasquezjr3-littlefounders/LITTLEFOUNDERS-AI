import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * GET /api/v1/admin/analytics/account-deletions — Appendix J Deletion-Request
 * Clarity for E.6: requests by initiator and population, the stated-timeline
 * rate, the within-SLA completion rate and the open/overdue queue. Staff with
 * view_analytics only; counts only; every count exact or the read fails.
 */

const STAFF_ID = randomUUID();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-30T00:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stub(opts: { roles?: string[]; permissions?: string[]; failOn?: string } = {}) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = decodeURIComponent(String(input));
    urls.push(url);
    if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, (opts.roles ?? ['admin']).map((role) => ({ role }))));
    if (url.includes('/rest/v1/admin_permissions')) {
      return Promise.resolve(jsonResponse(200, (opts.permissions ?? ['view_analytics']).map((permission) => ({ user_id: STAFF_ID, permission }))));
    }
    if (url.includes('/rest/v1/staff_sightings') || url.includes('/rpc/')) return Promise.resolve(new Response(null, { status: 204 }));
    if (opts.failOn && url.includes(opts.failOn)) return Promise.resolve(jsonResponse(500, { message: 'down' }));
    if (url.includes('select=scheduled_for,completed_at')) {
      return Promise.resolve(jsonResponse(200, [
        { scheduled_for: '2026-09-20T00:00:00.000Z', completed_at: '2026-09-20T03:00:00.000Z' },
        { scheduled_for: '2026-09-21T00:00:00.000Z', completed_at: '2026-09-24T00:00:00.000Z' },
      ]));
    }
    const total = url.includes('initiated_by=eq.self') ? 6 : url.includes('initiated_by=eq.guardian') ? 3
      : url.includes('initiated_by=eq.suspension_expiry') ? 1 : url.includes('population=eq.adult') ? 4
        : url.includes('population=eq.teen') ? 1 : url.includes('population=eq.guest') ? 1 : url.includes('population=eq.kid') ? 4
          : url.includes('population=eq.') ? 0 : url.includes('status=eq.cancelled') ? 2 : url.includes('status=eq.pending') ? 3
            : url.includes('status=eq.processing') ? 1 : url.includes('status=eq.held') ? 1 : url.includes('status=in.') ? 1 : 10;
    return Promise.resolve(new Response('[]', { status: 206, headers: { 'content-range': `0-0/${total}`, 'content-type': 'application/json' } }));
  }));
  return urls;
}

function get(query = '') {
  return request(createApp()).get(`/api/v1/admin/analytics/account-deletions${query}`).set('Authorization', `Bearer ${mintToken({ sub: STAFF_ID })}`);
}

describe('GET /api/v1/admin/analytics/account-deletions', () => {
  it('reports requests, the stated-timeline rate, the SLA rate and the open queue', async () => {
    const urls = stub();
    const res = await get('?days=30');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      windowDays: 30,
      slaHours: 48,
      requested: { total: 10, byInitiator: { self: 6, guardian: 3, suspension_expiry: 1 }, byPopulation: { adult: 4, teen: 1, guest: 1, kid: 4, parent: 0 } },
      cancelled: 2,
      completed: 2,
      statedTimelineRate: 1,
      withinSlaRate: 0.5,
      open: { pending: 3, processing: 1, held: 1, overdue: 1 },
    });
    // Counts only: no account id is ever selected.
    expect(urls.filter((u) => u.includes('/account_deletion_requests')).every((u) => !u.includes('subject_id'))).toBe(true);
  });

  it('requires view_analytics; a staff member without it and a non-staff user are refused', async () => {
    stub({ permissions: ['manage_content'] });
    expect((await get()).status).toBe(403);
    stub({ roles: ['universal', 'parent'] });
    expect((await get()).status).toBe(403);
  });

  it('fails the whole read instead of reporting a believable zero', async () => {
    stub({ failOn: 'status=eq.held' });
    expect((await get()).status).toBe(502);
  });
});
