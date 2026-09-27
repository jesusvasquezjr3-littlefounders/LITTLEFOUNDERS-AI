import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  birthMonthFitsTeenBand, birthMonthProvesAge, birthMonthToKeep, declaredBandForDate, effectiveAgeBand,
} from '../services/ageScreen.js';
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
    expect(res.body.data).toEqual({
      required: false, ageBand: 'under_13', protectedOrigin: true, birthMonthRecorded: false, adultByBirthMonth: false,
    });
  });
});

/*
 * S-04 (owner decision OD-28): the age screen may also keep a birth month so a
 * declared teen moves to the adult tier at 18. Kept only with a 13-to-17 band,
 * only when the client sends it, only with the first declaration.
 */
describe('S-04 the birth month moves a declared teen to the adult tier at 18', () => {
  it('reads a teen as adult only after every day of the 18th-birthday month has passed', () => {
    expect(effectiveAgeBand('13_to_17', '2008-10-01', new Date('2026-10-31T23:59:59Z'))).toBe('13_to_17');
    expect(effectiveAgeBand('13_to_17', '2008-10-01', new Date('2026-11-01T00:00:00Z'))).toBe('adult');
    // December rolls into January of the next year.
    expect(effectiveAgeBand('13_to_17', '2008-12-01', new Date('2026-12-31T12:00:00Z'))).toBe('13_to_17');
    expect(effectiveAgeBand('13_to_17', '2008-12-01', new Date('2027-01-01T00:00:00Z'))).toBe('adult');
    // No month, another band, or a malformed month: the declaration stands.
    expect(effectiveAgeBand('13_to_17', null, new Date('2040-01-01T00:00:00Z'))).toBe('13_to_17');
    expect(effectiveAgeBand('under_13', '2008-10-01', new Date('2040-01-01T00:00:00Z'))).toBe('under_13');
    expect(effectiveAgeBand('13_to_17', 'garbage', new Date('2040-01-01T00:00:00Z'))).toBe('13_to_17');
    expect(birthMonthProvesAge('2010-03-01', 16, new Date('2026-03-31T00:00:00Z'))).toBe(false);
    expect(birthMonthProvesAge('2010-03-01', 16, new Date('2026-04-01T00:00:00Z'))).toBe(true);
  });

  it('accepts a month only when it can belong to a 13-to-17 person today', () => {
    const now = new Date('2026-09-26T00:00:00Z');
    expect(birthMonthFitsTeenBand('2013-09', now)).toBe(true); // 13 on some day of that month
    expect(birthMonthFitsTeenBand('2013-10', now)).toBe(false); // under 13 on every day
    expect(birthMonthFitsTeenBand('2008-09', now)).toBe(true); // 17 on some day of that month
    expect(birthMonthFitsTeenBand('2008-08', now)).toBe(false); // 18 on every day
    for (const bad of ['2008-13', '2008-00', '08-09', '2008-9']) expect(birthMonthFitsTeenBand(bad, now)).toBe(false);
  });

  it('keeps the month only when the client sends it, for a teen, and only as the month of the date', () => {
    expect(birthMonthToKeep('2010-05-17', undefined, '13_to_17')).toBeNull();
    expect(birthMonthToKeep('2010-05-17', '2010-05', '13_to_17')).toBe('2010-05');
    expect(birthMonthToKeep('2010-05-17', '2010-06', '13_to_17')).toBe('invalid');
    expect(birthMonthToKeep('2010-05-17', '2010-5', '13_to_17')).toBe('invalid');
    expect(birthMonthToKeep('2018-05-17', '2018-05', 'under_13')).toBeNull();
    expect(birthMonthToKeep('1990-05-17', '1990-05', 'adult')).toBeNull();
  });

  function recorder(stored: { declared_age_band: string; birth_month?: string | null }[]) {
    const writes: { url: string; body: unknown }[] = [];
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/rpc/')) {
        const body = JSON.parse(String(init?.body)) as { p_age_band: string };
        writes.push({ url, body });
        return Promise.resolve(jsonResponse(200, body.p_age_band));
      }
      return Promise.resolve(jsonResponse(200, url.includes('account_age_declarations') ? stored : []));
    });
    vi.stubGlobal('fetch', fetch);
    return { fetch, writes };
  }
  const post = (body: object) => request(createApp()).post('/api/v1/auth/age-screen')
    .set('Authorization', `Bearer ${mintToken({ sub: USER })}`).send(body);

  it('an old client ({ birthDate } only) records the band exactly as before', async () => {
    const { writes } = recorder([{ declared_age_band: '13_to_17' }]);
    const res = await post({ birthDate: '2011-05-17' });
    expect(res.status).toBe(200);
    expect(writes).toEqual([{ url: expect.stringContaining('/rpc/record_age_declaration'), body: { p_user_id: USER, p_age_band: '13_to_17' } }]);
    expect(res.body.data).toMatchObject({ ageBand: '13_to_17', birthMonthRecorded: false, adultByBirthMonth: false });
  });

  it('a teen who sends the month records it with the first declaration', async () => {
    const { writes } = recorder([{ declared_age_band: '13_to_17', birth_month: '2011-05-01' }]);
    const res = await post({ birthDate: '2011-05-17', birthMonth: '2011-05' });
    expect(res.status).toBe(200);
    expect(writes).toEqual([{
      url: expect.stringContaining('/rpc/record_age_screen'),
      body: { p_user_id: USER, p_age_band: '13_to_17', p_birth_month: '2011-05-01' },
    }]);
    expect(res.body.data).toMatchObject({ ageBand: '13_to_17', birthMonthRecorded: true, adultByBirthMonth: false });
  });

  it.each([
    ['a month that is not the month of the date', { birthDate: '2011-05-17', birthMonth: '2011-06' }],
    ['a malformed month', { birthDate: '2011-05-17', birthMonth: '2011-5' }],
    ['a non-string month', { birthDate: '2011-05-17', birthMonth: 201105 }],
    ['an unknown field', { birthDate: '2011-05-17', birthMonth: '2011-05', ageBand: 'adult' }],
  ])('refuses %s before any write', async (_label, body) => {
    const { fetch } = recorder([]);
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['an under-13 date, never retained', '2018-05-17', '2018-05', 'under_13'],
    ['an adult date, no tier left to move to', '1990-05-17', '1990-05', 'adult'],
  ])('does not keep the month for %s', async (_label, birthDate, birthMonth, band) => {
    const { writes } = recorder([{ declared_age_band: band }]);
    await post({ birthDate, birthMonth });
    expect(writes).toEqual([{ url: expect.stringContaining('/rpc/record_age_declaration'), body: { p_user_id: USER, p_age_band: band } }]);
  });

  it('reads a declared teen whose 18th-birthday month has passed as an adult, and says why', async () => {
    recorder([{ declared_age_band: '13_to_17', birth_month: '2000-01-01' }]);
    const res = await request(createApp()).get('/api/v1/auth/age-screen').set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      required: false, ageBand: 'adult', protectedOrigin: false, birthMonthRecorded: true, adultByBirthMonth: true,
    });
  });

  it('an under-13 origin always wins over any stored month', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(jsonResponse(200, url.includes('account_age_declarations')
      ? [{ declared_age_band: '13_to_17', birth_month: '2000-01-01' }] : [{ under13_origin: true }]))));
    const res = await request(createApp()).get('/api/v1/auth/age-screen').set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
    expect(res.body.data).toEqual({
      required: false, ageBand: 'under_13', protectedOrigin: true, birthMonthRecorded: false, adultByBirthMonth: false,
    });
  });

  it('fails closed on a stored month that is not a first-of-month date', async () => {
    recorder([{ declared_age_band: '13_to_17', birth_month: '2000-01-15' }]);
    const res = await request(createApp()).get('/api/v1/auth/age-screen').set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
    expect(res.status).toBe(502);
  });
});
