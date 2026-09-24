import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { declaredBandForDate } from '../services/ageScreen.js';
import { jsonResponse, mintToken } from './helpers.js';

const USER = '22222222-2222-4222-8222-222222222222';
afterEach(() => vi.unstubAllGlobals());

describe('A.3/A.4 authoritative age-screen contract', () => {
  it.each(['/api/v1/learn/courses', '/api/v1/placement/course/start', '/api/v1/tutor/offers'])(
    'blocks direct access before screening: %s', async (path) => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, []))));
      const res = await request(createApp()).get(path).set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AGE_SCREEN_REQUIRED');
    },
  );
  it('classifies exact birthdays and rejects impossible dates', () => {
    const now = new Date('2026-09-21T00:00:00Z');
    expect(declaredBandForDate('2013-09-21', now)).toBe('13_to_17');
    expect(declaredBandForDate('2013-09-22', now)).toBe('under_13');
    expect(declaredBandForDate('2008-09-21', now)).toBe('adult');
    expect(declaredBandForDate('2008-09-22', now)).toBe('13_to_17');
    for (const date of ['2012-02-30', '2027-01-01', '1900-01-01', 'invalid']) expect(declaredBandForDate(date, now)).toBeNull();
  });

  it.each([
    { declarations: [], origins: [], required: true, ageBand: null, status: 200 },
    { declarations: [], origins: [{ under13_origin: true }], required: false, ageBand: 'under_13', status: 200 },
    { declarations: [{ declared_age_band: 'adult' }], origins: [{ under13_origin: true }], required: false, ageBand: 'under_13', status: 200 },
    { declarations: [{ declared_age_band: '13_to_17' }], origins: [], required: false, ageBand: '13_to_17', status: 200 },
    { declarations: null, origins: [], required: undefined, ageBand: undefined, status: 502 },
    { declarations: [], origins: null, required: undefined, ageBand: undefined, status: 502 },
  ])('reads durable state without trusting profile or metadata: case %#', async (state) => {
    vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(jsonResponse(200,
      input.includes('account_age_declarations') ? state.declarations : state.origins))));
    const res = await request(createApp()).get('/api/v1/auth/age-screen').set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
    expect(res.status).toBe(state.status);
    if (state.status === 200) expect(res.body.data).toMatchObject({ required: state.required, ageBand: state.ageBand });
    else expect(res.body.data).toBeNull();
  });

  it('requires a session and never accepts a caller-supplied user ID', async () => {
    expect((await request(createApp()).get('/api/v1/auth/age-screen')).status).toBe(401);
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const res = await request(createApp()).post('/api/v1/auth/age-screen')
      .set('Authorization', `Bearer ${mintToken({ sub: USER })}`)
      .send({ userId: USER, birthDate: '2018-01-01' });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stores only the band for the authenticated identity and confirms the protected result', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/rpc/')) {
        expect(JSON.parse(String(init?.body))).toEqual({ p_user_id: USER, p_age_band: 'under_13' });
        return Promise.resolve(jsonResponse(200, 'under_13'));
      }
      return Promise.resolve(jsonResponse(200, url.includes('account_age_declarations') ?
        [{ declared_age_band: 'under_13' }] : [{ under13_origin: true }]));
    });
    vi.stubGlobal('fetch', fetch);
    const res = await request(createApp()).post('/api/v1/auth/age-screen')
      .set('Authorization', `Bearer ${mintToken({ sub: USER })}`).send({ birthDate: '2018-01-01' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ required: false, ageBand: 'under_13', protectedOrigin: true });
  });
});
