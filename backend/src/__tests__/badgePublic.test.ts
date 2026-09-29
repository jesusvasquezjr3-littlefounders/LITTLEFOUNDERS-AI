import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse } from './helpers.js';

/*
 * GET /api/v1/badges/:token — the LEGACY unauthenticated badge-link read,
 * retiring under OD-20. No Authorization header on any request here: a
 * stranger's browser is the only client this route is for.
 */

function row(overrides: Record<string, unknown> = {}) {
  return {
    token: 'a'.repeat(32),
    kid_user_id: 'kid',
    created_by: 'parent',
    achievement_kind: 'streak',
    achievement_label: '7-day streak',
    first_name: 'Sofía',
    image_bucket: 'badges',
    image_hash: 'b'.repeat(64),
    image_ext: 'png',
    image_url: 'http://localhost:4006/files/badges/hash.png',
    id: 'row-id',
    created_at: '2026-09-01T00:00:00Z',
    expires_at: '2026-10-01T00:00:00Z',
    revoked_at: null,
    ...overrides,
  };
}

// Pinned inside the legacy window (after the OD-20 cutover, before the
// 24 October 2026 retirement) so these cases never change meaning with the
// calendar; the retirement itself is tested explicitly below.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function stub(rows: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/rest/v1/badge_shares?token=eq.')) return Promise.resolve(jsonResponse(200, rows));
      return Promise.resolve(new Response(null, { status: 404 }));
    }),
  );
}

describe('GET /api/v1/badges/:token', () => {
  it('rejects a malformed token without touching Vault', async () => {
    const res = await request(createApp()).get('/api/v1/badges/short');
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404s for a token with no matching row', async () => {
    stub([]);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns only whitelisted display fields, never kid_user_id/created_by', async () => {
    stub([
      {
        token: 'a'.repeat(32),
        kid_user_id: 'should-never-leave-core',
        created_by: 'should-never-leave-core',
        achievement_kind: 'streak',
        achievement_label: '7-day streak',
        first_name: 'Sofía',
        age_band: null,
        image_bucket: 'badges',
        image_hash: 'b'.repeat(64),
        image_ext: 'png',
        image_url: 'http://localhost:4006/files/badges/hash.png',
        id: 'row-id',
        created_at: '2026-09-01T00:00:00Z',
        expires_at: '2026-10-01T00:00:00Z',
        revoked_at: null,
      },
    ]);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.body.data).toEqual({
      firstName: 'Sofía',
      achievementKind: 'streak',
      achievementLabel: '7-day streak',
      imageUrl: 'http://localhost:4006/files/badges/hash.png',
      locale: 'en-US',
    });
    expect(JSON.stringify(res.body)).not.toContain('should-never-leave-core');
  });

  it('404s a revoked share, even though the row still exists', async () => {
    stub([
      {
        token: 'a'.repeat(32),
        kid_user_id: 'kid',
        created_by: 'parent',
        achievement_kind: 'streak',
        achievement_label: '7-day streak',
        first_name: 'Sofía',
        age_band: null,
        image_bucket: 'badges',
        image_hash: 'b'.repeat(64),
        image_ext: 'png',
        image_url: 'http://localhost:4006/files/badges/hash.png',
        id: 'row-id',
        created_at: '2026-09-01T00:00:00Z',
        expires_at: '2026-10-01T00:00:00Z',
        revoked_at: '2026-09-02T00:00:00Z',
      },
    ]);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('404s an expired share at the window boundary', async () => {
    stub([
      {
        token: 'a'.repeat(32),
        kid_user_id: 'kid',
        created_by: 'parent',
        achievement_kind: 'streak',
        achievement_label: '7-day streak',
        first_name: 'Sofía',
        age_band: null,
        image_bucket: 'badges',
        image_hash: 'b'.repeat(64),
        image_ext: 'png',
        image_url: 'http://localhost:4006/files/badges/hash.png',
        id: 'row-id',
        created_at: '2026-09-01T00:00:00Z',
        expires_at: '2026-09-24T00:00:00Z',
        revoked_at: null,
      },
    ]);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('404s a link issued at or after the OD-20 cutover, even if un-revoked and in its window', async () => {
    stub([row({ created_at: '2026-09-24T00:00:00Z', expires_at: '2026-10-24T00:00:00Z' })]);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.status).toBe(404);
  });

  it('is retired from 24 October 2026: 410 for every token, with no database read', async () => {
    vi.setSystemTime(new Date('2026-10-24T00:00:00.000Z'));
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, [row({ expires_at: '2099-01-01T00:00:00Z' })])));
    vi.stubGlobal('fetch', fetchMock);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('GONE');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/*
 * GAP-FIX-R4 (Bible 02 section 1.2): the unfurl picks its copy by the locale
 * the label was written in. A legacy row stores none, so Core reads the
 * sharing Tutor's profile locale, then the child's, and answers one of the
 * three product locales, en-US otherwise. Only the locale column is read.
 */
describe('GET /api/v1/badges/:token locale', () => {
  const PARENT = '11111111-1111-4111-8111-111111111111';
  const KID = '22222222-2222-4222-8222-222222222222';

  function stubWithProfiles(profiles: unknown[] | null) {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/rest/v1/badge_shares?token=eq.')) {
        return Promise.resolve(jsonResponse(200, [row({ kid_user_id: KID, created_by: PARENT })]));
      }
      if (url.includes('/rest/v1/profiles?')) {
        return Promise.resolve(profiles === null ? new Response('boom', { status: 500 }) : jsonResponse(200, profiles));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it("answers the sharing Tutor's locale, reading only the locale column", async () => {
    const fetchMock = stubWithProfiles([{ user_id: KID, locale: 'pt-BR' }, { user_id: PARENT, locale: 'es-MX' }]);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.locale).toBe('es-MX');
    const profileUrl = fetchMock.mock.calls.map(([input]) => String(input)).find((url) => url.includes('/rest/v1/profiles?'));
    expect(profileUrl).toContain('select=user_id,locale');
    expect(profileUrl).not.toContain('display_name');
    expect(JSON.stringify(res.body)).not.toContain(PARENT);
    expect(JSON.stringify(res.body)).not.toContain(KID);
  });

  it("falls back to the child's locale when the Tutor's profile gives none", async () => {
    stubWithProfiles([{ user_id: KID, locale: 'pt-BR' }]);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.body.data.locale).toBe('pt-BR');
  });

  it('answers en-US for a locale outside the three, or when the profile read fails, and still serves the share', async () => {
    stubWithProfiles([{ user_id: PARENT, locale: 'fr-FR' }]);
    const unknown = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(unknown.status).toBe(200);
    expect(unknown.body.data.locale).toBe('en-US');

    stubWithProfiles(null);
    const failed = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(failed.status).toBe(200);
    expect(failed.body.data.locale).toBe('en-US');
  });
});
