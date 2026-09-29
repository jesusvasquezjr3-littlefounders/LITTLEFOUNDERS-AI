import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_SUSPENDED_EVENT, api } from './api';
import { ACCOUNT_SUSPENDED_EVENT as MENTOR_ACCOUNT_SUSPENDED_EVENT } from '@/rebuild/mentor/session/coreApi';

afterEach(() => vi.unstubAllGlobals());

describe('Core response envelope', () => {
  it.each([{}, [], { message: 'proxy error' }, { data: {}, error: 'failure' }, { data: null, error: {} }])(
    'rejects malformed upstream responses: %j', async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
      expect((await api('/profile')).error?.code).toBe('INTERNAL');
    },
  );
  it('does not treat an HTTP failure as a successful write', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { saved: true }, error: null }), { status: 502 })));
    expect((await api('/profile', { body: {} })).error?.code).toBe('INTERNAL');
  });
  it('preserves actionable server errors and successful payloads', async () => {
    const body = { data: null, error: { code: 'SESSION_LIMIT', message: 'Daily limit', resetAt: '2026-09-17T00:00:00Z' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 429 })));
    expect(await api('/tutor')).toEqual(body);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { courses: [] }, error: null }))));
    expect(await api('/learn/courses')).toEqual({ data: { courses: [] }, error: null });
  });
});

describe('A.1: a paused child hears it on any route (F3-identity-site)', () => {
  it('announces ACCOUNT_SUSPENDED from any Core route, and only that code', async () => {
    const heard = vi.fn();
    window.addEventListener(ACCOUNT_SUSPENDED_EVENT, heard);
    try {
      const paused = { data: null, error: { code: 'ACCOUNT_SUSPENDED', message: 'paused' } };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(paused), { status: 403 })));
      expect((await api('/learn/courses')).error?.code).toBe('ACCOUNT_SUSPENDED');
      expect(heard).toHaveBeenCalledTimes(1);
      const other = { data: null, error: { code: 'FORBIDDEN', message: 'no' } };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(other), { status: 403 })));
      await api('/wallet/access');
      expect(heard).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(ACCOUNT_SUSPENDED_EVENT, heard);
    }
  });

  it('shares one event name with the Mentor session client, which keeps its own copy (Bible 02 rule 23)', () => {
    expect(MENTOR_ACCOUNT_SUSPENDED_EVENT).toBe(ACCOUNT_SUSPENDED_EVENT);
  });
});
