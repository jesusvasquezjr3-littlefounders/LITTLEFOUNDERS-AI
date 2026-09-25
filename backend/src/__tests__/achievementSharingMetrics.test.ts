import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * GET /api/v1/admin/analytics/achievement-sharing — Appendix L under OD-20:
 * shares INITIATED (by hand-off and kind), the Persistent Public URL Rate and
 * the legacy links' lifecycle. Never viewer reach. Staff with view_analytics
 * only; every count exact or the read fails.
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

function stub(opts: { roles?: string[]; permissions?: string[]; failOn?: string; persistent?: number } = {}) {
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
    let total = 0;
    if (url.includes('/achievement_share_initiations')) {
      total = url.includes('handoff=eq.share_sheet') ? 7 : url.includes('handoff=eq.download') ? 3
        : url.includes('achievement_kind=eq.course_badge') ? 2 : url.includes('achievement_kind=eq.streak') ? 5
          : url.includes('achievement_kind=eq.goal_reached') ? 3 : 10;
    } else if (url.includes('/badge_shares')) {
      total = url.includes('created_at=gte.') ? (opts.persistent ?? 0) : url.includes('revoked_at=not.is.null') ? 4
        : url.includes('revoked_at=is.null') ? 6 : 40;
    }
    return Promise.resolve(new Response('[]', { status: 206, headers: { 'content-range': `0-0/${total}`, 'content-type': 'application/json' } }));
  }));
  return urls;
}

function get(query = '') {
  return request(createApp()).get(`/api/v1/admin/analytics/achievement-sharing${query}`).set('Authorization', `Bearer ${mintToken({ sub: STAFF_ID })}`);
}

describe('GET /api/v1/admin/analytics/achievement-sharing', () => {
  it('reports shares initiated by hand-off and kind, a zero persistent-URL rate and the legacy lifecycle', async () => {
    const urls = stub();
    const res = await get('?days=7');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      windowDays: 7,
      initiated: { total: 10, shareSheet: 7, download: 3, byKind: { course_badge: 2, streak: 5, goal_reached: 3 } },
      persistentPublicUrls: 0,
      persistentPublicUrlRate: 0,
      legacyLinks: { cutover: '2026-09-24T00:00:00.000Z', routeRetiresAt: '2026-10-24T00:00:00.000Z', retired: false, total: 40, live: 6, revoked: 4 },
    });
    // The persistent-URL numerator starts at the cutover even when the window reaches further back.
    const persistent = urls.find((u) => u.includes('/badge_shares?select=id&created_at=gte.'));
    expect(persistent).toContain('created_at=gte.2026-09-24T00:00:00.000Z');
    // Nothing here ever reads a viewer-reach signal.
    expect(urls.some((u) => u.includes('badge_link_click') || u.includes('learning_events'))).toBe(false);
  });

  it('computes a non-zero rate honestly if a public link ever appears', async () => {
    stub({ persistent: 10 });
    const res = await get();
    expect(res.body.data.persistentPublicUrlRate).toBe(0.5);
  });

  it('fails the whole read instead of reporting a believable zero', async () => {
    stub({ failOn: 'handoff=eq.download' });
    const res = await get();
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('refuses staff without view_analytics and every non-staff caller', async () => {
    stub({ permissions: ['manage_content'] });
    expect((await get()).status).toBe(403);
    stub({ roles: ['parent'] });
    expect((await get()).status).toBe(403);
  });

  it('validates the window', async () => {
    stub();
    expect((await get('?days=0')).status).toBe(400);
    expect((await get('?days=400')).status).toBe(400);
    expect((await get('?days=7&extra=1')).status).toBe(400);
  });
});
