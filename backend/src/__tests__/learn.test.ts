import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/v1/learn/courses', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).get('/api/v1/learn/courses');
    expect(res.status).toBe(401);
  });

  it('lists published courses with lesson counts (user-token RLS read)', async () => {
    const token = mintToken();
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        expect(url).toContain('/rest/v1/courses');
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe(`Bearer ${token}`);
        return Promise.resolve(
          jsonResponse(200, [
            { id: 'c1', slug: 'money-basics', title: { 'en-US': 'Money Basics' }, lessons: [{ count: 3 }] },
            { id: 'c2', slug: 'saving', title: { 'en-US': 'Saving' }, lessons: [] },
          ]),
        );
      }),
    );
    const res = await request(createApp()).get('/api/v1/learn/courses').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.courses).toEqual([
      { id: 'c1', slug: 'money-basics', title: { 'en-US': 'Money Basics' }, lessonCount: 3 },
      { id: 'c2', slug: 'saving', title: { 'en-US': 'Saving' }, lessonCount: 0 },
    ]);
  });

  it('502s when PostgREST is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    const res = await request(createApp())
      .get('/api/v1/learn/courses')
      .set('Authorization', `Bearer ${mintToken()}`);
    expect(res.status).toBe(502);
  });
});
