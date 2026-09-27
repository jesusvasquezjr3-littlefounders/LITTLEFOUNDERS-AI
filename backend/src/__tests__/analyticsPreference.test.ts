import { afterEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { attributeSignup, insertLearningEvents } from '../services/insights.js';

const USER = '22222222-2222-4222-8222-222222222222';
const route = '/api/v1/auth/analytics-preference';
afterEach(() => vi.unstubAllGlobals());
function fixture(options: { enabled?: boolean; failRead?: boolean; failWrite?: boolean; staleRead?: boolean; band?: string; roles?: readonly string[]; origin?: boolean; birthMonth?: string } = {}) {
  let enabled = options.enabled;
  const writes: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method && init.method !== 'GET') writes.push({ url, body: JSON.parse(String(init.body ?? '{}')) });
    if (url.includes('/rpc/set_teen_analytics_preference')) {
      const choice = JSON.parse(String(init?.body)).p_enabled as boolean;
      if (options.failWrite) return Promise.resolve(jsonResponse(200, null));
      if (!options.staleRead) enabled = choice;
      return Promise.resolve(jsonResponse(200, choice));
    }
    if (url.includes('/teen_analytics_preferences?')) return Promise.resolve(jsonResponse(200, options.failRead ? null : enabled === undefined ? [] : [{ enabled, disclosure_version: 1 }]));
    if (url.includes('/rpc/promote_age_declaration')) return Promise.resolve(jsonResponse(200, 'adult'));
    if (url.includes('/account_age_declarations?')) return Promise.resolve(jsonResponse(200, [{ declared_age_band: options.band ?? '13_to_17', ...(options.birthMonth ? { declared_birth_month: options.birthMonth } : {}) }]));
    if (url.includes('/account_safety_origins?')) return Promise.resolve(jsonResponse(200, options.origin ? [{ under13_origin: true }] : []));
    if (url.includes('/user_roles?')) return Promise.resolve(jsonResponse(200, (options.roles ?? ['universal']).map(role => ({ role }))));
    if (url.includes('/profiles?')) return Promise.resolve(jsonResponse(200, [{ user_id: USER, birth_date: null, locale: 'en-US', display_name: 'Synthetic' }]));
    if (url.includes('/learning_events') && init?.method === 'POST') return Promise.resolve(jsonResponse(200, [{}]));
    return Promise.resolve(jsonResponse(200, []));
  }));
  return writes;
}
const auth = (req: request.Test, guest = false) => req.set('User-Agent', 'Mozilla/5.0').set('Authorization', `Bearer ${mintToken({ sub: USER, is_anonymous: guest })}`);
it('requires authentication and keeps an undisclosed teen off', async () => {
  fixture(); const app = createApp();
  expect((await request(app).get(route)).status).toBe(401);
  expect((await auth(request(app).get(route))).body.data).toEqual({ canManage: true, enabled: false, disclosed: false });
});
it('stores the authenticated subject, can revoke, and confirms each write', async () => {
  const writes = fixture(); const app = createApp();
  for (const enabled of [true, false]) {
    const res = await auth(request(app).put(route)).send({ enabled });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ canManage: true, enabled, disclosed: true });
  }
  expect(writes.map(w => w.body)).toEqual([{ p_user_id: USER, p_enabled: true }, { p_user_id: USER, p_enabled: false }]);
});
it.each([{ enabled: 'yes' }, { enabled: true, userId: USER }, { enabled: false, safetyLogging: false }])('rejects excessive/forged fields %j', async body => {
  const writes = fixture(); expect((await auth(request(createApp()).put(route)).send(body)).status).toBe(400); expect(writes).toEqual([]);
});
it.each([{ failRead: true }, { failWrite: true }, { staleRead: true }])('does not report success without confirmed persistence %j', async options => {
  fixture(options); expect((await auth(request(createApp()).put(route)).send({ enabled: true })).status).toBe(502);
});
it.each([{ band: 'adult' }, { band: 'under_13' }, { origin: true }, { roles: ['kid', 'universal'] }])('cannot override another population or guardian policy %j', async options => {
  const writes = fixture(options); expect((await auth(request(createApp()).put(route)).send({ enabled: true })).status).toBe(403); expect(writes).toEqual([]);
});
it('does not let a guest opt into identified analytics', async () => {
  const writes = fixture(); expect((await auth(request(createApp()).put(route), true).send({ enabled: true })).status).toBe(403); expect(writes).toEqual([]);
});
it.each([undefined, false, true])('enforces choice %s in /me, direct ingest and attribution', async enabled => {
  const writes = fixture({ enabled }); const app = createApp();
  const me = await auth(request(app).get('/api/v1/auth/me'));
  expect(me.body.data.analyticsEnabled).toBe(enabled === true);
  const ingest = await auth(request(app).post('/api/v1/events')).send({ events: [{ event: 'nav_view', routeClass: 'learn' }] });
  expect(ingest.status).toBe(202);
  expect(writes.some(w => w.url.includes('/learning_events'))).toBe(enabled === true);
  expect(await attributeSignup(USER, USER, ['universal'])).toBe(enabled === true);
  expect(writes.some(w => w.url.includes('/anon_visitors'))).toBe(enabled === true);
});
it('drops optional events if preference storage cannot be read', async () => {
  const writes = fixture({ enabled: true, failRead: true });
  const res = await auth(request(createApp()).post('/api/v1/events')).send({ events: [{ event: 'nav_view', routeClass: 'learn' }] });
  expect(res.body.data.accepted).toBe(0); expect(writes).toEqual([]);
});

// Exercise the common sink directly: server producers do not pass through /events.
it.each([
  [{ enabled: true }, 1],
  [{ enabled: false }, 0],
  [{}, 0],
  [{ enabled: true, origin: true }, 0],
  [{ enabled: true, roles: [] }, 0],
  [{ enabled: true, roles: ['kid'] }, 0],
  [{ failRead: true }, 0],
  [{ band: 'adult' }, 1],
] as const)('applies source admission to server events: %j', async (options, expected) => {
  const writes = fixture(options);
  expect(await insertLearningEvents([{ user_id: USER, role: 'universal', event: 'lesson_complete' }])).toBe(expected);
  expect(writes.filter(write => write.url.includes('/learning_events'))).toHaveLength(expected);
});
it('retains anonymous acquisition while suppressing an opted-out identified row in the same batch', async () => {
  const writes = fixture({ enabled: false });
  expect(await insertLearningEvents([
    { user_id: USER, role: 'universal', event: 'lesson_complete' },
    { anon_id: 'anonymous-fixture', role: 'anonymous', event: 'page_view' },
  ])).toBe(1);
  const inserted = writes.find(write => write.url.includes('/learning_events'))!.body;
  expect(inserted).toEqual([expect.objectContaining({ anon_id: 'anonymous-fixture', event: 'page_view' })]);
});

// S-04 (OD-28): a declared teen whose birth month moved them to the adult tier
// keeps an explicit earlier "no" and keeps the toggle; with no recorded choice
// the adult rule applies.
it.each([
  [false, false],
  [true, true],
  [undefined, true],
])('a teen who reached 18 by birth month with choice %s is admitted: %s', async (enabled, admitted) => {
  const writes = fixture({ enabled, birthMonth: '2000-01-01' }); const app = createApp();
  const me = await auth(request(app).get('/api/v1/auth/me'));
  expect(me.body.data.analyticsEnabled).toBe(admitted);
  const ingest = await auth(request(app).post('/api/v1/events')).send({ events: [{ event: 'nav_view', routeClass: 'learn' }] });
  expect(ingest.status).toBe(202);
  expect(writes.some(w => w.url.includes('/learning_events'))).toBe(admitted);
  expect((await auth(request(app).get(route))).body.data.canManage).toBe(true);
});
it('a teen whose birth month has not reached 18 stays on the teen rule', async () => {
  fixture({ birthMonth: '2011-05-01' });
  const me = await auth(request(createApp()).get('/api/v1/auth/me'));
  expect(me.body.data.analyticsEnabled).toBe(false);
});
