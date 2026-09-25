import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../config.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * POST /api/v1/internal/badge-links/purge — F.2's "a dead link is not dead
 * until its image stops resolving", for the links nobody revokes or visits.
 * Invariants: internal key only; every dead legacy link's Depot object is
 * deleted unless a live twin shares it; an ambiguous read never deletes; the
 * run is audited even when it purges nothing; a failed read is a 502, never
 * a reassuring zero; once retired, every legacy image is swept.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function share(token: string, hash: string) {
  return {
    id: `id-${token.slice(0, 4)}`, token, kid_user_id: 'kid', created_by: 'parent', achievement_kind: 'streak',
    achievement_label: '7-day streak', first_name: 'Sofía', image_bucket: 'badges', image_hash: hash, image_ext: 'png',
    image_url: `http://localhost:4006/files/badges/${hash}.png`, created_at: '2026-08-01T00:00:00Z',
    expires_at: '2026-08-31T00:00:00Z', revoked_at: null,
  };
}

interface SweepStub {
  dead?: unknown[] | null;
  twinFor?: string;
  referenceReadFails?: boolean;
  deleteFails?: boolean;
}

function stub(opts: SweepStub = {}) {
  const calls: { method: string; url: string; body?: string }[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: typeof init?.body === 'string' ? init.body : undefined });
    if (url.includes('/rest/v1/badge_shares?token=neq.')) {
      if (opts.referenceReadFails) return Promise.resolve(jsonResponse(500, { message: 'down' }));
      return Promise.resolve(jsonResponse(200, opts.twinFor && url.includes(opts.twinFor) ? [{ id: 'twin' }] : []));
    }
    if (url.includes('/rest/v1/badge_shares?')) {
      return Promise.resolve(opts.dead === null ? jsonResponse(500, { message: 'down' }) : jsonResponse(200, opts.dead ?? []));
    }
    if (url.includes(':4006/api/v1/files/') && method === 'DELETE') {
      if (opts.deleteFails) return Promise.reject(new Error('depot down'));
      return Promise.resolve(jsonResponse(200, { data: { deleted: true }, error: null }));
    }
    if (url.includes('/rest/v1/audit_logs')) return Promise.resolve(new Response(null, { status: 201 }));
    return Promise.resolve(jsonResponse(200, []));
  }));
  return calls;
}

function sweep(body: unknown = {}, key: string | null = getConfig().INTERNAL_API_KEY) {
  const req = request(createApp()).post('/api/v1/internal/badge-links/purge');
  if (key !== null) req.set('x-internal-api-key', key);
  return req.send(body as object);
}

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

describe('POST /api/v1/internal/badge-links/purge', () => {
  it('refuses a missing or wrong internal key, and a staff or parent session', async () => {
    const calls = stub({ dead: [share('t'.repeat(32), HASH_A)] });
    expect((await sweep({}, null)).status).toBe(403);
    expect((await sweep({}, 'wrong-key-wrong-key')).status).toBe(403);
    const session = await request(createApp()).post('/api/v1/internal/badge-links/purge')
      .set('Authorization', `Bearer ${mintToken()}`).send({});
    expect(session.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('purges every dead link\'s image, skips one a live twin still needs, and audits the run', async () => {
    const calls = stub({ dead: [share('t'.repeat(32), HASH_A), share('u'.repeat(32), HASH_B)], twinFor: HASH_B });
    const res = await sweep({ limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ scanned: 2, purged: 1, stillReferenced: 1, failed: 0, retired: false, complete: false });
    const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.url);
    expect(deletes).toEqual([`http://localhost:4006/api/v1/files/badges/${HASH_A}.png`]);
    const read = calls.find((c) => c.url.includes('/rest/v1/badge_shares?or='));
    expect(read?.url).toContain('revoked_at.not.is.null');
    expect(read?.url).toContain('expires_at.lte.');
    expect(read?.url).toContain('created_at.gte.2026-09-24T00%3A00%3A00.000Z');
    const audit = calls.find((c) => c.url.includes('/rest/v1/audit_logs'));
    expect(JSON.parse(audit?.body ?? '{}')).toMatchObject({ actor_id: null, action: 'badge_links.images_swept', detail: { purged: 1, stillReferenced: 1 } });
  });

  it('never deletes on an ambiguous reference read, and reports it as failed', async () => {
    const calls = stub({ dead: [share('t'.repeat(32), HASH_A)], referenceReadFails: true });
    const res = await sweep();
    expect(res.body.data).toMatchObject({ scanned: 1, purged: 0, failed: 1 });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('reports a Depot failure instead of swallowing it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stub({ dead: [share('t'.repeat(32), HASH_A)], deleteFails: true });
    const res = await sweep();
    expect(res.body.data).toMatchObject({ purged: 0, failed: 1 });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('audits a run that found nothing, and marks it complete', async () => {
    const calls = stub({ dead: [] });
    const res = await sweep();
    expect(res.body.data).toMatchObject({ scanned: 0, purged: 0, complete: true });
    expect(calls.some((c) => c.url.includes('/rest/v1/audit_logs'))).toBe(true);
  });

  it('answers 502, never a zero, when the link read fails', async () => {
    stub({ dead: null });
    const res = await sweep();
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DATA_UNAVAILABLE');
  });

  it('once retired, sweeps EVERY legacy link and treats none as live', async () => {
    vi.setSystemTime(new Date('2026-10-24T00:00:00.000Z'));
    const calls = stub({ dead: [share('t'.repeat(32), HASH_A)], twinFor: HASH_A });
    const res = await sweep({ limit: 10, offset: 20 });
    expect(res.body.data).toMatchObject({ scanned: 1, purged: 1, retired: true });
    const read = calls.find((c) => c.url.includes('/rest/v1/badge_shares?select='));
    expect(read?.url).not.toContain('or=');
    expect(read?.url).toContain('limit=10&offset=20');
    // No twin lookup at all: nothing can be live after retirement.
    expect(calls.some((c) => c.url.includes('token=neq.'))).toBe(false);
  });

  it('rejects an out-of-range or unknown body field', async () => {
    stub();
    expect((await sweep({ limit: 0 })).status).toBe(400);
    expect((await sweep({ limit: 5000 })).status).toBe(400);
    expect((await sweep({ everything: true })).status).toBe(400);
  });
});
