import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse } from './helpers.js';

/*
 * GET /api/v1/badges/:token — the ONE unauthenticated Core read. No
 * Authorization header on any request here: a stranger's browser is the
 * only client this route is for.
 */

afterEach(() => vi.unstubAllGlobals());

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
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404s for a token with no matching row', async () => {
    stub([]);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.status).toBe(404);
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
      },
    ]);
    const res = await request(createApp()).get(`/api/v1/badges/${'a'.repeat(32)}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      firstName: 'Sofía',
      achievementKind: 'streak',
      achievementLabel: '7-day streak',
      imageUrl: 'http://localhost:4006/files/badges/hash.png',
    });
    expect(JSON.stringify(res.body)).not.toContain('should-never-leave-core');
  });
});
