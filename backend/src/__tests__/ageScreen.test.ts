import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import {
  birthMonthForBand, birthMonthProvesAge, birthMonthToKeep, declaredBandForDate, effectiveAgeBand, promotionDue,
} from '../services/ageScreen.js';
import { jsonResponse, mintToken } from './helpers.js';

const USER = '22222222-2222-4222-8222-222222222222';
afterEach(() => {
  vi.unstubAllGlobals();
  // POST /age-screen sits behind authRateLimiter (10 per window); each case is independent.
  for (const key of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) void authRateLimiter.resetKey(key);
});

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
 * S-04 (owner decision OD-28): the age screen keeps a declared teen's birth
 * month (derived from the date) so the teen moves to the adult tier at 18. An
 * optional `birthMonth` in the body must agree with the date.
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


  it('accepts a sent month only as the month of the date, and keeps it only for a teen', () => {
    expect(birthMonthToKeep('2010-05-17', undefined, '13_to_17')).toBeNull();
    expect(birthMonthToKeep('2010-05-17', '2010-05', '13_to_17')).toBe('2010-05');
    expect(birthMonthToKeep('2010-05-17', '2010-06', '13_to_17')).toBe('invalid');
    expect(birthMonthToKeep('2010-05-17', '2010-5', '13_to_17')).toBe('invalid');
    expect(birthMonthToKeep('2018-05-17', '2018-05', 'under_13')).toBeNull();
    expect(birthMonthToKeep('1990-05-17', '1990-05', 'adult')).toBeNull();
  });

  function recorder(stored: { declared_age_band: string; declared_birth_month?: string | null; promoted_to_adult_at?: string | null }[]) {
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

  it('a teen who also sends the matching month records the same month as an old client', async () => {
    const { writes } = recorder([{ declared_age_band: '13_to_17', declared_birth_month: '2011-05-01' }]);
    const res = await post({ birthDate: '2011-05-17', birthMonth: '2011-05' });
    expect(res.status).toBe(200);
    expect(writes).toEqual([{
      url: expect.stringContaining('/rpc/record_age_declaration'),
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
    recorder([{ declared_age_band: 'adult', declared_birth_month: null, promoted_to_adult_at: '2018-02-01T00:00:00Z' }]);
    const res = await request(createApp()).get('/api/v1/auth/age-screen').set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      required: false, ageBand: 'adult', protectedOrigin: false, birthMonthRecorded: true, adultByBirthMonth: true,
    });
  });

  it('an under-13 origin always wins over any stored month', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(jsonResponse(200, url.includes('account_age_declarations')
      ? [{ declared_age_band: '13_to_17', declared_birth_month: '2000-01-01' }] : [{ under13_origin: true }]))));
    const res = await request(createApp()).get('/api/v1/auth/age-screen').set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
    expect(res.body.data).toEqual({
      required: false, ageBand: 'under_13', protectedOrigin: true, birthMonthRecorded: false, adultByBirthMonth: false,
    });
  });

  it('fails closed on a stored month that is not a first-of-month date', async () => {
    recorder([{ declared_age_band: '13_to_17', declared_birth_month: '2000-01-15' }]);
    const res = await request(createApp()).get('/api/v1/auth/age-screen').set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
    expect(res.status).toBe(502);
  });
});

describe('OD-28 (S-04): a declared teen keeps a birth month and moves to adult at 18', () => {
  const isoYearsAgo = (years: number) => {
    const date = new Date();
    date.setUTCFullYear(date.getUTCFullYear() - years);
    return date.toISOString().slice(0, 10);
  };

  it("keeps only a teen's month and year, never the day, and nothing for another band", () => {
    expect(birthMonthForBand('2011-05-17', '13_to_17')).toBe('2011-05-01');
    expect(birthMonthForBand('2018-05-17', 'under_13')).toBeNull();
    expect(birthMonthForBand('1990-05-17', 'adult')).toBeNull();
    expect(birthMonthForBand('not-a-date', '13_to_17')).toBeNull();
  });

  it("reads the 18th birthday as the birth month's last day (the protective reading)", () => {
    expect(promotionDue('2008-09-01', new Date('2026-09-30T23:59:59Z'))).toBe(false);
    expect(promotionDue('2008-09-01', new Date('2026-10-01T00:00:00Z'))).toBe(true);
    expect(promotionDue('2008-12-01', new Date('2026-12-31T12:00:00Z'))).toBe(false);
    expect(promotionDue('2008-12-01', new Date('2027-01-01T00:00:00Z'))).toBe(true);
    expect(promotionDue(null)).toBe(false);
    expect(promotionDue('2008-12-17')).toBe(false);
  });

  it.each([
    { years: 15, month: true },
    { years: 30, month: false },
  ])('sends a birth month to the database only for a teen: $years years', async ({ years, month }) => {
    const birthDate = isoYearsAgo(years);
    const bodies: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/rpc/record_age_declaration')) {
        bodies.push(JSON.parse(String(init?.body)));
        return Promise.resolve(jsonResponse(200, month ? '13_to_17' : 'adult'));
      }
      return Promise.resolve(jsonResponse(200, url.includes('account_age_declarations') ?
        [{ declared_age_band: month ? '13_to_17' : 'adult', declared_birth_month: month ? `${birthDate.slice(0, 7)}-01` : null }] : []));
    }));
    const res = await request(createApp()).post('/api/v1/auth/age-screen')
      .set('Authorization', `Bearer ${mintToken({ sub: USER })}`).send({ birthDate });
    expect(res.status).toBe(200);
    expect(bodies).toEqual([month
      ? { p_user_id: USER, p_age_band: '13_to_17', p_birth_month: `${birthDate.slice(0, 7)}-01` }
      : { p_user_id: USER, p_age_band: 'adult' }]);
  });

  it('refuses a caller-supplied birth month: only Core derives it from a checked date', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const res = await request(createApp()).post('/api/v1/auth/age-screen')
      .set('Authorization', `Bearer ${mintToken({ sub: USER })}`)
      .send({ birthDate: isoYearsAgo(15), birthMonth: '2000-01-01' });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'due and confirmed: adult', month: '2000-01-01', origins: [], promoted: 'adult', calls: 1, band: 'adult' },
    { name: 'due, the database does not confirm: stays teen', month: '2000-01-01', origins: [], promoted: null, calls: 1, band: '13_to_17' },
    { name: 'due, the database keeps the teen band: stays teen', month: '2000-01-01', origins: [], promoted: '13_to_17', calls: 1, band: '13_to_17' },
    { name: 'not due: no promotion asked', month: `${new Date().getUTCFullYear() - 15}-01-01`, origins: [], promoted: 'adult', calls: 0, band: '13_to_17' },
    { name: 'no month kept: no promotion asked', month: null, origins: [], promoted: 'adult', calls: 0, band: '13_to_17' },
    { name: 'under-13 origin: never promoted', month: '2000-01-01', origins: [{ under13_origin: true }], promoted: 'adult', calls: 0, band: 'under_13' },
  ])('promotes on the next read only through the database: $name', async ({ month, origins, promoted, calls, band }) => {
    const promotions: unknown[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/rpc/promote_age_declaration')) {
        promotions.push(JSON.parse(String(init?.body)));
        return Promise.resolve(jsonResponse(200, promoted));
      }
      return Promise.resolve(jsonResponse(200, url.includes('account_age_declarations') ?
        [{ declared_age_band: '13_to_17', declared_birth_month: month }] : origins));
    }));
    const res = await request(createApp()).get('/api/v1/auth/age-screen').set('Authorization', `Bearer ${mintToken({ sub: USER })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ageBand).toBe(band);
    expect(promotions).toEqual(Array.from({ length: calls }, () => ({ p_user_id: USER })));
  });
});
