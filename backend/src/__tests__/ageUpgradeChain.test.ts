import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { attributeSignup } from '../services/insights.js';

/*
 * A.2(c)/A.3(c) adversarial chain: the under-13 origin marker and its three
 * downstream safeguards must survive the guest-to-account upgrade (B8) on the
 * SAME auth.users id. Frontend visibility is not authorization: each check is
 * a direct API request against the enforcing boundary. The microphone and
 * fail-closed moderation halves of the chain are enforced in tutor.test.ts
 * ("keeps flagged origin protected after anonymous status becomes …"); these
 * tests close the identity, age-screen and analytics halves.
 */

const USER = '44444444-4444-4444-8444-444444444444';
const ANON = '55555555-5555-4555-8555-555555555555';
afterEach(() => vi.unstubAllGlobals());

interface ChainFixture {
  origin?: boolean;
  failOriginRead?: boolean;
  writes: { url: string; body: unknown }[];
}

function fixture(options: { origin?: boolean; failOriginRead?: boolean } = {}): ChainFixture {
  const writes: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method && init.method !== 'GET') writes.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
    if (url.includes('/rpc/record_age_declaration')) {
      // The immutable first declaration wins; a later adult self-declaration
      // cannot overwrite the under-13 band stored with the origin marker.
      return Promise.resolve(jsonResponse(200, 'under_13'));
    }
    if (url.includes('/account_safety_origins?')) {
      return Promise.resolve(jsonResponse(200, options.failOriginRead ? null : options.origin ? [{ under13_origin: true }] : []));
    }
    if (url.includes('/account_age_declarations?')) {
      return Promise.resolve(jsonResponse(200, [{ declared_age_band: 'under_13' }]));
    }
    if (url.includes('/user_roles?')) return Promise.resolve(jsonResponse(200, [{ role: 'universal' }]));
    if (url.includes('/profiles?')) {
      return Promise.resolve(jsonResponse(200, [{
        user_id: USER, birth_date: null, locale: 'en-US', display_name: 'Synthetic',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      }]));
    }
    return Promise.resolve(jsonResponse(200, []));
  }));
  return { ...options, writes };
}

const auth = (req: request.Test, guest: boolean) =>
  req.set('User-Agent', 'Mozilla/5.0').set('Authorization', `Bearer ${mintToken({ sub: USER, is_anonymous: guest })}`);

describe('A.2(c): flagged guest keeps its safeguards through an in-place upgrade', () => {
  it('keeps optional analytics off in /me before and after the same identity becomes permanent', async () => {
    fixture({ origin: true });
    const app = createApp();
    const asGuest = await auth(request(app).get('/api/v1/auth/me'), true);
    expect(asGuest.status).toBe(200);
    expect(asGuest.body.data.isGuest).toBe(true);
    expect(asGuest.body.data.analyticsEnabled).toBe(false);
    const asPermanent = await auth(request(app).get('/api/v1/auth/me'), false);
    expect(asPermanent.status).toBe(200);
    expect(asPermanent.body.data.isGuest).toBe(false);
    expect(asPermanent.body.data.analyticsEnabled).toBe(false);
  });

  it('drops the upgraded account\'s direct event batch and refuses signup attribution', async () => {
    const { writes } = fixture({ origin: true });
    const app = createApp();
    const ingest = await auth(request(app).post('/api/v1/events'), false).send({
      anonId: ANON,
      events: [{ event: 'login_complete', routeClass: 'learn' }, { event: 'nav_view', routeClass: 'learn' }],
    });
    expect(ingest.status).toBe(202);
    expect(ingest.body.data.accepted).toBe(0);
    expect(writes).toEqual([]);
    expect(await attributeSignup(ANON, USER, ['universal'])).toBe(false);
    expect(writes).toEqual([]);
  });

  it('completes the upgrade in place but never attributes a flagged guest', async () => {
    const { writes } = fixture({ origin: true });
    const token = mintToken({ sub: USER, is_anonymous: true });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method && init.method !== 'GET') writes.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
      if (url.includes('/auth/v1/user') && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse(200, { id: USER, email: 'ana@example.com', is_anonymous: false }));
      }
      if (url.includes('/auth/v1/token?grant_type=refresh_token')) {
        return Promise.resolve(jsonResponse(200, {
          access_token: 'upgraded-at',
          refresh_token: 'upgraded-rt',
          expires_in: 3600,
          user: { id: USER, email: 'ana@example.com', is_anonymous: false },
        }));
      }
      if (url.includes('/account_safety_origins?')) return Promise.resolve(jsonResponse(200, [{ under13_origin: true }]));
      if (url.includes('/account_age_declarations?')) return Promise.resolve(jsonResponse(200, [{ declared_age_band: 'under_13' }]));
      return Promise.resolve(jsonResponse(200, []));
    }));
    const res = await request(createApp()).post('/api/v1/auth/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'ana@example.com', password: 'longenough1', refreshToken: 'old-rt', anonId: ANON });
    expect(res.status).toBe(200);
    expect(res.body.data.session.accessToken).toBe('upgraded-at');
    expect(writes.some(w => w.url.includes('/anon_visitors'))).toBe(false);
  });

  it('resolves the upgraded identity as protected without a second date, and an adult self-declaration cannot elevate it', async () => {
    const { writes } = fixture({ origin: true });
    const app = createApp();
    const read = await auth(request(app).get('/api/v1/auth/age-screen'), false);
    expect(read.status).toBe(200);
    expect(read.body.data).toEqual({ required: false, ageBand: 'under_13', protectedOrigin: true, birthMonthRecorded: false, adultByBirthMonth: false });
    const claim = await auth(request(app).post('/api/v1/auth/age-screen'), false).send({ birthDate: '1990-01-01' });
    expect(claim.status).toBe(200);
    expect(claim.body.data).toEqual({ required: false, ageBand: 'under_13', protectedOrigin: true, birthMonthRecorded: false, adultByBirthMonth: false });
    expect(writes).toEqual([{ url: expect.stringContaining('/rpc/record_age_declaration'), body: { p_user_id: USER, p_age_band: 'adult' } }]);
  });

  it('fails closed for the upgraded identity when origin evidence cannot be read', async () => {
    fixture({ failOriginRead: true });
    const app = createApp();
    const me = await auth(request(app).get('/api/v1/auth/me'), false);
    expect(me.status).toBe(200);
    expect(me.body.data.analyticsEnabled).toBe(false);
    const ingest = await auth(request(app).post('/api/v1/events'), false).send({ events: [{ event: 'nav_view', routeClass: 'learn' }] });
    expect(ingest.body.data.accepted).toBe(0);
    const screen = await auth(request(app).get('/api/v1/auth/age-screen'), false);
    expect(screen.status).toBe(502);
  });
});
