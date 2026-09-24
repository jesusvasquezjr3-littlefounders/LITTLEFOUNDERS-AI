import { afterEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

const USER = '22222222-2222-4222-8222-222222222222';
const route = '/api/v1/tutor/age-calibration';
const auth = (req: request.Test) => req.set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
afterEach(() => vi.unstubAllGlobals());
function fixture(options: { failWrite?: boolean; failRead?: boolean; tier?: number; adult?: boolean } = {}) {
  let tier = options.tier;
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/rpc/record_mentor_age_calibration')) {
      const body = JSON.parse(String(init?.body)); writes.push(body);
      if (options.failWrite) return Promise.resolve(jsonResponse(200, null));
      tier ??= body.p_tier;
      return Promise.resolve(jsonResponse(200, tier));
    }
    if (url.includes('/mentor_age_calibrations?')) return Promise.resolve(jsonResponse(200, options.failRead ? null : tier === undefined ? [] : [{ tier }]));
    if (url.includes('/account_age_declarations?')) return Promise.resolve(jsonResponse(200, [{ declared_age_band: options.adult ? 'adult' : 'under_13' }]));
    if (url.includes('/account_safety_origins?')) return Promise.resolve(jsonResponse(200, []));
    if (url.includes('/profiles?')) return Promise.resolve(jsonResponse(200, [{ user_id: USER, birth_date: null }]));
    return Promise.resolve(jsonResponse(200, []));
  }));
  return writes;
}
it('requires authentication and reports explicit unknown instead of tier 2', async () => {
  fixture();
  expect((await request(createApp()).get(route)).status).toBe(401);
  const res = await auth(request(createApp()).get(route));
  expect(res.body.data).toEqual({ required: true, tier: null });
});
it('records the authenticated subject and requires confirmed persistence', async () => {
  const writes = fixture();
  const app = createApp();
  const res = await auth(request(app).post(route)).send({ tier: 1 });
  expect(res.status).toBe(200);
  expect(res.body.data).toEqual({ required: false, tier: 1 });
  expect(writes).toEqual([{ p_user_id: USER, p_tier: 1 }]);
  const retry = await auth(request(app).post(route)).send({ tier: 3 });
  expect(retry.body.data).toEqual({ required: false, tier: 1 });
  expect(writes).toHaveLength(1);
});
it.each([{ tier: 4 }, { tier: 1, userId: USER }, { tier: 1, birthDate: '2016-01-01' }])('rejects forged or excessive payloads %j', async body => {
  const writes = fixture();
  expect((await auth(request(createApp()).post(route)).send(body)).status).toBe(400);
  expect(writes).toEqual([]);
});
it.each([{ failRead: true }, { failWrite: true }])('fails closed when storage is unavailable: %j', async options => {
  fixture(options);
  expect((await auth(request(createApp()).post(route)).send({ tier: 2 })).status).toBe(502);
});
it('does not replace an already known 13+ teaching band', async () => {
  const writes = fixture({ adult: true });
  const res = await auth(request(createApp()).post(route)).send({ tier: 1 });
  expect(res.body.data).toEqual({ required: false, tier: 3 });
  expect(writes).toEqual([]);
});
