import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * F.2 — per-share badge revocation and default expiry. The invariants under
 * test: a VERIFIED guardian of THIS kid can revoke one share (killing the
 * page AND the image's own Depot object, while leaving the badge_shares row
 * and the underlying achievement untouched), a stranger cannot, revoke is
 * idempotent, and expiry is enforced at page-serve time with a lazy image
 * purge — all through the synthetic-transport stubs this suite owns.
 */

const KID_ID = randomUUID();
const PARENT_ID = randomUUID();
const OTHER_KID_ID = randomUUID();
const TOKEN = 'a'.repeat(32);
const IMAGE_HASH = 'b'.repeat(64);

afterEach(() => vi.unstubAllGlobals());

interface ShareRow {
  token: string;
  kid_user_id: string;
  created_by: string;
  achievement_kind: string;
  achievement_label: string;
  first_name: string;
  age_band: string | null;
  image_bucket: string;
  image_hash: string;
  image_ext: string;
  image_url: string;
  id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

function liveShare(overrides: Partial<ShareRow> = {}): ShareRow {
  return {
    token: TOKEN,
    kid_user_id: KID_ID,
    created_by: PARENT_ID,
    achievement_kind: 'streak',
    achievement_label: '7-day streak',
    first_name: 'Sofia',
    age_band: null,
    image_bucket: 'badges',
    image_hash: IMAGE_HASH,
    image_ext: 'png',
    image_url: `http://localhost:4006/files/badges/${IMAGE_HASH}.png`,
    id: 'row-id',
    created_at: '2026-09-01T00:00:00Z',
    expires_at: '2099-01-01T00:00:00Z',
    revoked_at: null,
    ...overrides,
  };
}

interface StubOptions {
  roles?: string[];
  guardianLinked?: boolean;
  share?: ShareRow | null;
  listRows?: ShareRow[];
  otherActiveRefs?: boolean;
  deleteFails?: boolean;
}

interface StubState {
  share: ShareRow | null;
  calls: { method: string; url: string; body: unknown }[];
  filebaseDeletes: number;
}

function stub(opts: StubOptions = {}): StubState {
  const state: StubState = { share: opts.share === undefined ? liveShare() : opts.share, calls: [], filebaseDeletes: 0 };
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      state.calls.push({ method, url, body: init?.body });

      if (url.includes('/parent_verifications?')) {
        return Promise.resolve(jsonResponse(200, [{ status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' }]));
      }
      if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
        return Promise.resolve(jsonResponse(200, (opts.roles ?? ['parent']).map((role) => ({ role }))));
      }
      if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.')) {
        const rows = opts.guardianLinked === false ? [] : [{ parent_user_id: PARENT_ID, kid_user_id: KID_ID, verification_status: 'verified' }];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/badge_shares') && method === 'PATCH') {
        const match = url.includes(`kid_user_id=eq.${KID_ID}`) && url.includes('revoked_at=is.null');
        const share = state.share;
        if (match && share && share.revoked_at === null) {
          state.share = { ...share, revoked_at: '2026-09-24T12:00:00Z' };
          return Promise.resolve(jsonResponse(200, [state.share]));
        }
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/rest/v1/badge_shares?token=eq.')) {
        return Promise.resolve(jsonResponse(200, state.share ? [state.share] : []));
      }
      if (url.includes('/rest/v1/badge_shares?token=neq.')) {
        return Promise.resolve(jsonResponse(200, opts.otherActiveRefs ? [{ id: 'twin' }] : []));
      }
      if (url.includes('/rest/v1/badge_shares?kid_user_id=eq.')) {
        return Promise.resolve(jsonResponse(200, opts.listRows ?? []));
      }
      if (url.includes('/rest/v1/audit_logs')) {
        return Promise.resolve(jsonResponse(201, {}));
      }
      if (url.includes(':4006/api/v1/files/') && method === 'DELETE') {
        if (opts.deleteFails) return Promise.reject(new Error('depot down'));
        state.filebaseDeletes += 1;
        return Promise.resolve(jsonResponse(200, { data: { deleted: true, id: 'x' }, error: null }));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
  return state;
}

const auth = (sub = PARENT_ID) => ({ Authorization: `Bearer ${mintToken({ sub })}` });

describe('DELETE /api/v1/family/kids/:kidId/badges/:token', () => {
  it('revokes a live share: row marked, page 404s, image object deleted, achievement untouched', async () => {
    const state = stub();
    const res = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID}/badges/${TOKEN}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ revoked: true, token: TOKEN, imagePurged: true });
    // The share record survives — only its lifecycle columns changed, never a DELETE.
    expect(state.share).not.toBeNull();
    expect(state.share?.revoked_at).not.toBeNull();
    expect(state.share?.achievement_label).toBe('7-day streak');
    // No write reached any table other than badge_shares' PATCH and the image delete.
    const writeTargets = state.calls.filter((c) => c.method !== 'GET').map((c) => c.url);
    expect(writeTargets.every((u) => u.includes('/rest/v1/badge_shares') || u.includes(':4006/api/v1/files/') || u.includes('/rest/v1/audit_logs'))).toBe(true);
    expect(state.filebaseDeletes).toBe(1);

    // The token is dead NOW: the public page must refuse it.
    const page = await request(createApp()).get(`/api/v1/badges/${TOKEN}`);
    expect(page.status).toBe(404);
    expect(page.headers['cache-control']).toBe('no-store');
  });

  it('refuses a parent who is not THIS kid\'s verified guardian, without touching the row', async () => {
    const state = stub({ guardianLinked: false });
    const res = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID}/badges/${TOKEN}`).set(auth());
    expect(res.status).toBe(404);
    expect(state.share?.revoked_at).toBeNull();
    expect(state.filebaseDeletes).toBe(0);
  });

  it('refuses a kid-role caller outright', async () => {
    const state = stub({ roles: ['kid'] });
    const res = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID}/badges/${TOKEN}`).set(auth());
    expect(res.status).toBe(403);
    expect(state.share?.revoked_at).toBeNull();
    expect(state.filebaseDeletes).toBe(0);
  });

  it('is idempotent: a second revoke succeeds without another image delete', async () => {
    const state = stub();
    const first = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID}/badges/${TOKEN}`).set(auth());
    expect(first.status).toBe(200);
    const second = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID}/badges/${TOKEN}`).set(auth());
    expect(second.status).toBe(200);
    expect(second.body.data.revoked).toBe(true);
    expect(state.filebaseDeletes).toBe(1);
  });

  it('404s a token that belongs to another kid — no existence leak, no write', async () => {
    const state = stub({ share: liveShare({ kid_user_id: OTHER_KID_ID }) });
    const res = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID}/badges/${TOKEN}`).set(auth());
    expect(res.status).toBe(404);
    expect(state.share?.revoked_at).toBeNull();
    expect(state.filebaseDeletes).toBe(0);
  });

  it('rejects a malformed token before any read', async () => {
    stub();
    const res = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID}/badges/${'x'.repeat(3)}`).set(auth());
    expect(res.status).toBe(400);
  });

  it('skips the image delete when another LIVE share still references the same object', async () => {
    const state = stub({ otherActiveRefs: true });
    const res = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID}/badges/${TOKEN}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.imagePurged).toBe(false);
    expect(state.filebaseDeletes).toBe(0);
    // The page still dies — the twin's image survives because the twin needs it.
    const page = await request(createApp()).get(`/api/v1/badges/${TOKEN}`);
    expect(page.status).toBe(404);
  });

  it('still revokes when the image delete fails, and reports the purge honestly', async () => {
    const state = stub({ deleteFails: true });
    const res = await request(createApp()).delete(`/api/v1/family/kids/${KID_ID}/badges/${TOKEN}`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.revoked).toBe(true);
    expect(res.body.data.imagePurged).toBe(false);
    expect(state.share?.revoked_at).not.toBeNull();
    const page = await request(createApp()).get(`/api/v1/badges/${TOKEN}`);
    expect(page.status).toBe(404);
  });
});

describe('GET /api/v1/family/kids/:kidId/badges', () => {
  it('lists only live shares in a whitelisted shape, filtering revoked and expired server-side', async () => {
    stub({
      listRows: [
        liveShare({ token: TOKEN }),
        liveShare({ token: 'c'.repeat(32), revoked_at: '2026-09-02T00:00:00Z' }),
        liveShare({ token: 'd'.repeat(32), expires_at: '2026-01-01T00:00:00Z' }),
      ],
    });
    const res = await request(createApp()).get(`/api/v1/family/kids/${KID_ID}/badges`).set(auth());
    expect(res.status).toBe(200);
    const listUrl = vi.mocked(fetch).mock.calls.map((c) => String(c[0])).find((u) => u.includes('badge_shares?kid_user_id=eq.'));
    expect(listUrl).toContain('revoked_at=is.null');
    expect(listUrl).toContain('expires_at=gt.');
    expect(res.body.data.shares).toHaveLength(3);
    const share = res.body.data.shares[0];
    expect(Object.keys(share).sort()).toEqual(['achievementKind', 'achievementLabel', 'createdAt', 'expiresAt', 'token']);
  });

  it('refuses a parent who is not this kid\'s guardian', async () => {
    stub({ guardianLinked: false });
    const res = await request(createApp()).get(`/api/v1/family/kids/${KID_ID}/badges`).set(auth());
    expect(res.status).toBe(404);
  });
});

describe('expiry enforcement on the public page', () => {
  it('serves a share inside its window', async () => {
    stub({ share: liveShare({ expires_at: '2099-01-01T00:00:00Z' }) });
    const res = await request(createApp()).get(`/api/v1/badges/${TOKEN}`);
    expect(res.status).toBe(200);
  });

  it('404s an expired share and lazily purges its image', async () => {
    const state = stub({ share: liveShare({ expires_at: '2020-01-01T00:00:00Z' }) });
    const res = await request(createApp()).get(`/api/v1/badges/${TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
    // The purge is deliberately not awaited by the route — wait for it.
    await vi.waitFor(() => expect(state.filebaseDeletes).toBe(1));
  });

  it('does not purge an expired share\'s image while another live share references it', async () => {
    const state = stub({ share: liveShare({ expires_at: '2020-01-01T00:00:00Z' }), otherActiveRefs: true });
    const res = await request(createApp()).get(`/api/v1/badges/${TOKEN}`);
    expect(res.status).toBe(404);
    expect(state.filebaseDeletes).toBe(0);
  });
});
