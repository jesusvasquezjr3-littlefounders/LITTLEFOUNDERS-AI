import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

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
