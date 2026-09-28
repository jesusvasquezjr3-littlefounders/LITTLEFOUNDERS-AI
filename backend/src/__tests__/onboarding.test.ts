import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { mintToken } from './helpers.js';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';

let db: FakeDb;
let userId: string;
let token: string;

beforeEach(() => {
  userId = '44444444-4444-4444-8444-444444444444';
  token = mintToken({ sub: userId, is_anonymous: true });
  db = {
    profiles: [
      { user_id: userId, display_name: '', username: null, locale: 'en-US', theme: 'light', cover: {}, birth_date: null, created_at: '2026-01-01T00:00:00.000Z' },
    ],
    learning_stats: [
      { user_id: userId, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null },
    ],
    onboarding_responses: [],
    // Screened (Appendix M 1.1): the route sits behind requireAgeScreen.
    account_age_declarations: [{ user_id: userId, declared_age_band: 'adult' }],
    account_safety_origins: [],
  };
  vi.stubGlobal('fetch', createFakeFetch(db));
});

afterEach(() => vi.unstubAllGlobals());

const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

describe('POST /api/v1/onboarding/complete', () => {
  it('401s without a session', async () => {
    const res = await request(createApp()).post('/api/v1/onboarding/complete').send({ displayName: 'Ana', accountOfferChoice: 'later' });
    expect(res.status).toBe(401);
  });

  it('400s without a displayName', async () => {
    const res = await auth(request(createApp()).post('/api/v1/onboarding/complete')).send({ accountOfferChoice: 'later' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('saves the profile, activates day-1 streak, and records the response — skipping optional fields', async () => {
    const res = await auth(request(createApp()).post('/api/v1/onboarding/complete')).send({
      displayName: 'Ana',
      accountOfferChoice: 'later',
      localDate: '2026-08-10',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.streakDays).toBe(1);

    expect(db.profiles[0]).toMatchObject({ display_name: 'Ana', birth_date: null });
    expect(db.learning_stats[0]).toMatchObject({ streak_days: 1, longest_streak: 1, last_active_date: '2026-08-10' });
    expect(db.onboarding_responses).toEqual([
      { user_id: userId, discovery_channel: null, account_offer_choice: 'later' },
    ]);
  });

  it('saves the optional discovery channel without collecting a birth date again', async () => {
    const res = await auth(request(createApp()).post('/api/v1/onboarding/complete')).send({
      displayName: 'Ana',
      discoveryChannel: 'friend',
      accountOfferChoice: 'created_now',
      localDate: '2026-08-10',
    });
    expect(res.status).toBe(201);
    expect(db.profiles[0]).toMatchObject({ display_name: 'Ana', birth_date: null });
    expect(db.onboarding_responses[0]).toMatchObject({ discovery_channel: 'friend', account_offer_choice: 'created_now' });
  });

  it('rejects legacy or forged DOB writes without changing the profile', async () => {
    db.profiles[0]!.birth_date = '2016-05-01';
    const res = await auth(request(createApp()).post('/api/v1/onboarding/complete')).send({
      displayName: 'Ana', birthDate: '1990-01-01', accountOfferChoice: 'later',
    });
    expect(res.status).toBe(400);
    expect(db.profiles[0]).toMatchObject({ display_name: '', birth_date: '2016-05-01' });
    expect(db.onboarding_responses).toEqual([]);
  });

  it('409s ONBOARDING_ALREADY_COMPLETE on a retry, without double-writing stats', async () => {
    await auth(request(createApp()).post('/api/v1/onboarding/complete')).send({
      displayName: 'Ana',
      accountOfferChoice: 'later',
      localDate: '2026-08-10',
    });
    const res = await auth(request(createApp()).post('/api/v1/onboarding/complete')).send({
      displayName: 'Ana',
      accountOfferChoice: 'later',
      localDate: '2026-08-10',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ONBOARDING_ALREADY_COMPLETE');
    expect(db.learning_stats[0]!.streak_days).toBe(1); // unchanged, not double-incremented
    expect(db.onboarding_responses).toHaveLength(1);
  });

  /*
   * Regression guard mirroring learn.test.ts's learning_stats fault test: a
   * transient failure on the learning_stats read must abort BEFORE the blind
   * PATCH, leaving the caller safely retryable rather than silently
   * overwriting accumulated stats from an assumed-zero read.
   */
  it('never writes learning_stats when the streak transaction fails transiently, and leaves onboarding retryable', async () => {
    // S05.3e (B.21): the day is recorded by record_learning_practice_day, one
    // atomic transaction on the habit model; a failure writes nothing.
    const realFetch = createFakeFetch(db);
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/rpc/record_learning_practice_day')) {
          return Promise.resolve(new Response('', { status: 500 }));
        }
        return realFetch(input, init);
      }),
    );
    const res = await auth(request(createApp()).post('/api/v1/onboarding/complete')).send({
      displayName: 'Ana',
      accountOfferChoice: 'later',
    });
    expect(res.status).toBe(502);
    expect(db.onboarding_responses).toHaveLength(0);
    expect(db.profiles[0]).toMatchObject({ display_name: 'Ana' }); // profile write already landed — safe, idempotent overwrite on retry
    expect(db.learning_stats[0]).toMatchObject({ streak_days: 0, last_active_date: null });
  });
});
