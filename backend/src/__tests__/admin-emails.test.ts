import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { resetConfigForTests } from '../config.js';
import { mintToken } from './helpers.js';

const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const INTERNAL_KEY = 'test-internal-key-0123456789';

const emailResponse = {
  entries: [],
  total: 0,
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('EMAIL_SERVER_URL', 'http://email-server.railway.internal:4005');
  vi.stubEnv('INTERNAL_API_KEY', INTERNAL_KEY);
  resetConfigForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetConfigForTests();
});

function auth() {
  return `Bearer ${mintToken({ sub: ADMIN_ID, email: 'staff@littlefounders.ai' })}`;
}

describe('admin email proxy', () => {
  it('forwards global history filters to Courier', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(new Response(JSON.stringify([{ role: 'admin' }]), { status: 200 }));
      if (url.includes('/api/v1/logs')) return Promise.resolve(new Response(JSON.stringify({ data: emailResponse, error: null }), { status: 200 }));
      throw new Error(`unexpected fetch: ${url}`);
    }));

    const res = await request(createApp())
      .get('/api/v1/admin/emails/logs?q=parent%40example.com&status=failed&templateType=auth')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    const courierCall = calls.find((url) => url.includes('/api/v1/logs?'));
    expect(courierCall).toBeDefined();
    const query = new URL(courierCall!).searchParams;
    expect(query.get('q')).toBe('parent@example.com');
    expect(query.get('status')).toBe('failed');
    expect(query.get('templateType')).toBe('auth');
  });

  it('uses the Railway private Courier default in production when the variable is absent', async () => {
    delete process.env.EMAIL_SERVER_URL;
    resetConfigForTests();
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(new Response(JSON.stringify([{ role: 'admin' }]), { status: 200 }));
      if (url.startsWith('http://email-server.railway.internal:4005/')) return Promise.resolve(new Response(JSON.stringify({ data: emailResponse, error: null }), { status: 200 }));
      throw new Error(`unexpected fetch: ${url}`);
    }));

    const res = await request(createApp()).get('/api/v1/admin/emails/logs').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(calls.some((url) => url.startsWith('http://email-server.railway.internal:4005/'))).toBe(true);
  });

  it('forwards the requested trend window to Courier', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(new Response(JSON.stringify([{ role: 'admin' }]), { status: 200 }));
      if (url.includes('/api/v1/logs/summary')) return Promise.resolve(new Response(JSON.stringify({ data: { total: 0, statuses: {}, templates: {}, locales: {}, trend: [] }, error: null }), { status: 200 }));
      throw new Error(`unexpected fetch: ${url}`);
    }));

    const res = await request(createApp()).get('/api/v1/admin/emails/summary?days=365').set('Authorization', auth());
    expect(res.status).toBe(200);
    expect(new URL(calls.find((url) => url.includes('/api/v1/logs/summary'))!).searchParams.get('days')).toBe('365');
  });
});
