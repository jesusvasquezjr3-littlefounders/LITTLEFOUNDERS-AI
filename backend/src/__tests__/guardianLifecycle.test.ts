import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enforceKidSuspensionAtAdmission,
  purgeExpiredKidSuspension,
  KID_SUSPENSION_DELETE_DAYS,
} from '../services/guardianLifecycle.js';

/*
 * A.1's suspension lifecycle: enforcement is session revocation, the 90-day
 * purge is lazy and only ever deletes on an unambiguous read, and a failed
 * read never revokes or deletes (§1.14).
 */

const KID_ID = '22222222-2222-4222-8222-222222222222';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface StubOpts {
  suspendedAt?: string | null;
  links?: unknown[] | null;
  deleteStatus?: number;
  sessionsStatus?: number;
  profilesStatus?: number;
}

function stub(opts: StubOpts = {}) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url}`);
      if (url.includes('/rest/v1/profiles')) {
        if (opts.profilesStatus && opts.profilesStatus >= 500) return Promise.resolve(jsonResponse(500, {}));
        return Promise.resolve(jsonResponse(200, opts.suspendedAt === undefined
          ? [{ suspended_at: new Date().toISOString() }]
          : [{ suspended_at: opts.suspendedAt }]));
      }
      if (url.includes('/rest/v1/guardian_links')) {
        return Promise.resolve(jsonResponse(200, opts.links === undefined ? [] : opts.links));
      }
      if (url.includes('/admin/users/') && url.endsWith('/sessions') && method === 'DELETE') {
        return Promise.resolve(jsonResponse(opts.sessionsStatus ?? 200, {}));
      }
      if (url.includes('/admin/users/') && method === 'DELETE') {
        return Promise.resolve(jsonResponse(opts.deleteStatus ?? 200, {}));
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('purgeExpiredKidSuspension', () => {
  it('stays suspended while the 90-day window has not passed', async () => {
    stub();
    const recent = new Date(Date.now() - (KID_SUSPENSION_DELETE_DAYS - 1) * 24 * 60 * 60 * 1000).toISOString();
    await expect(purgeExpiredKidSuspension(KID_ID, recent)).resolves.toBe('suspended');
  });

  it('reactivates (active) when a verified link exists even after the window', async () => {
    stub({ links: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }] });
    const old = new Date(Date.now() - (KID_SUSPENSION_DELETE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    await expect(purgeExpiredKidSuspension(KID_ID, old)).resolves.toBe('active');
  });

  it('deletes only when the window passed AND no verified link exists', async () => {
    const calls = stub({ links: [] });
    const old = new Date(Date.now() - (KID_SUSPENSION_DELETE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    await expect(purgeExpiredKidSuspension(KID_ID, old)).resolves.toBe('deleted');
    expect(calls.some((c) => c.includes(`/admin/users/${KID_ID}`) && c.includes('DELETE'))).toBe(true);
  });

  it('never deletes on an ambiguous link read', async () => {
    const calls = stub({ links: null });
    const old = new Date(Date.now() - (KID_SUSPENSION_DELETE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    await expect(purgeExpiredKidSuspension(KID_ID, old)).resolves.toBe('unknown');
    expect(calls.some((c) => c.includes(`/admin/users/${KID_ID}`) && c.includes('DELETE'))).toBe(false);
  });

  it('never deletes when the GoTrue delete itself fails', async () => {
    stub({ links: [], deleteStatus: 502 });
    const old = new Date(Date.now() - (KID_SUSPENSION_DELETE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    await expect(purgeExpiredKidSuspension(KID_ID, old)).resolves.toBe('unknown');
  });
});

describe('enforceKidSuspensionAtAdmission', () => {
  it('is active when no suspension marker exists', async () => {
    stub({ suspendedAt: null });
    await expect(enforceKidSuspensionAtAdmission(KID_ID)).resolves.toBe('active');
  });

  it('revokes sessions and reports suspended while inside the window', async () => {
    const calls = stub({ links: [] });
    await expect(enforceKidSuspensionAtAdmission(KID_ID)).resolves.toBe('suspended');
    expect(calls.some((c) => c.includes(`/admin/users/${KID_ID}/sessions`))).toBe(true);
  });

  it('still refuses admission when session revocation fails', async () => {
    const calls = stub({ links: [], sessionsStatus: 502 });
    await expect(enforceKidSuspensionAtAdmission(KID_ID)).resolves.toBe('suspended');
    expect(calls.some((c) => c.includes(`/admin/users/${KID_ID}/sessions`))).toBe(true);
  });

  it('deletes an account past the window with no verified links', async () => {
    stub({ suspendedAt: new Date(Date.now() - (KID_SUSPENSION_DELETE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString(), links: [] });
    await expect(enforceKidSuspensionAtAdmission(KID_ID)).resolves.toBe('deleted');
  });

  it('never revokes or deletes when the marker read fails', async () => {
    const calls = stub({ profilesStatus: 502 });
    await expect(enforceKidSuspensionAtAdmission(KID_ID)).resolves.toBe('unknown');
    expect(calls.some((c) => c.includes('/admin/users/'))).toBe(false);
  });
});
