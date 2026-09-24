import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * POST /api/v1/family/kids/:kidId/badge — the shareable-achievement-badge
 * loop's issuance endpoint (0072/0073). The invariant under test is that a
 * badge can only be minted for a REAL, ALREADY-EARNED achievement and for a
 * kid this caller is a VERIFIED guardian of — never a course never
 * completed, never a streak too short to be meaningful, never someone
 * else's child.
 */

const KID_ID = randomUUID();
const PARENT_ID = randomUUID();
const GOAL_ID = randomUUID();
const IMAGE_HASH = 'a'.repeat(64);

afterEach(() => vi.unstubAllGlobals());

interface StubOptions {
  courseBadges?: { course_slug: string; course_title: Record<string, string>; badge_asset: string; completed_at: string }[];
  streakDays?: number;
  composeFails?: boolean;
  insertFails?: boolean;
  guardianLinked?: boolean;
  goal?: Record<string, unknown> | null;
  birthDate?: string | null;
}

function stub(opts: StubOptions = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/parent_verifications?')) {
        return Promise.resolve(jsonResponse(200, [{ status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' }]));
      }
      const method = init?.method ?? 'GET';

      if (url.includes('/rest/v1/user_roles?user_id=eq.')) {
        return Promise.resolve(jsonResponse(200, [{ role: 'parent' }]));
      }
      if (url.includes('/rest/v1/guardian_links?parent_user_id=eq.')) {
        const rows = opts.guardianLinked === false ? [] : [{ parent_user_id: PARENT_ID, kid_user_id: KID_ID, verification_status: 'verified' }];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/profiles?user_id=')) {
        return Promise.resolve(jsonResponse(200, [{ user_id: KID_ID, display_name: 'Sofía García', username: 'sofia', birth_date: opts.birthDate ?? null }]));
      }
      if (url.includes('/rpc/get_completed_course_badges')) {
        return Promise.resolve(jsonResponse(200, opts.courseBadges ?? []));
      }
      if (url.includes('/rest/v1/savings_goals?id=eq.')) {
        const rows = opts.goal === null ? [] : [opts.goal ?? { id: GOAL_ID, kid_user_id: KID_ID, title: 'A bike', target: 50, icon: 'bike', status: 'reached', created_at: '2026-09-01', reached_at: '2026-09-08' }];
        return Promise.resolve(jsonResponse(200, rows));
      }
      if (url.includes('/rest/v1/learning_stats?user_id=eq.')) {
        return Promise.resolve(
          jsonResponse(200, [
            { user_id: KID_ID, xp_points: 100, lessons_completed: 5, streak_days: opts.streakDays ?? 7, longest_streak: 7, last_active_date: '2026-09-01' },
          ]),
        );
      }
      if (url.includes(':4006/api/v1/badges')) {
        if (opts.composeFails) return Promise.resolve(jsonResponse(502, { data: null, error: { code: 'INTERNAL', message: 'nope' } }));
        return Promise.resolve(
          jsonResponse(200, {
            data: {
              url: `http://localhost:4006/files/badges/${IMAGE_HASH}.png`,
              bucket: 'badges',
              hash: IMAGE_HASH,
              ext: 'png',
              bytes: 4096,
              mime: 'image/png',
              deduplicated: false,
            },
            error: null,
          }),
        );
      }
      if (url.includes('/rest/v1/badge_shares') && method === 'POST') {
        if (opts.insertFails) return Promise.resolve(jsonResponse(500, { message: 'nope' }));
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      return Promise.resolve(new Response(null, { status: 201 }));
    }),
  );
}

function post(body: unknown) {
  return request(createApp())
    .post(`/api/v1/family/kids/${KID_ID}/badge`)
    .set('Authorization', `Bearer ${mintToken({ sub: PARENT_ID })}`)
    .send(body as string | object);
}

describe('POST /api/v1/family/kids/:kidId/badge', () => {
  it('rejects a course_badge for a course never completed', async () => {
    stub({ courseBadges: [] });
    const res = await post({ kind: 'course_badge', courseSlug: 'financial-education' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('issues a course_badge for an actually-completed course, localized', async () => {
    stub({
      courseBadges: [
        { course_slug: 'financial-education', course_title: { 'en-US': 'Financial Education', 'es-MX': 'Educación Financiera' }, badge_asset: 'x.png', completed_at: '2026-09-01' },
      ],
    });
    const res = await post({ kind: 'course_badge', courseSlug: 'financial-education', locale: 'es-MX' });
    expect(res.status).toBe(201);
    expect(res.body.error).toBeNull();
    expect(res.body.data.token).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(res.body.data.imageUrl).toContain(IMAGE_HASH);
    expect(res.body.data.shareUrl).toContain(`/badge/${res.body.data.token}`);
  });

  it('rejects a streak below the minimum shareable length', async () => {
    stub({ streakDays: 2 });
    const res = await post({ kind: 'streak' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('issues a streak badge at or above the minimum', async () => {
    stub({ streakDays: 7 });
    const res = await post({ kind: 'streak', locale: 'en-US' });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
  });

  it('populates the F.4 age_band from the stored birth date, and stays null outside the teaching bands', async () => {
    const writes: { url: string; body: unknown }[] = [];
    stub({ streakDays: 7, birthDate: '2018-05-01' });
    const routeStub = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/badge_shares') && (init?.method ?? 'GET') === 'POST') {
        writes.push({ url, body: JSON.parse(String(init?.body)) as unknown });
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      return (routeStub as typeof fetch)(input, init);
    }));
    expect((await post({ kind: 'streak', locale: 'en-US' })).status).toBe(201);
    expect((writes[0]!.body as { age_band?: unknown }).age_band).toBe('6-8');
    stub({ streakDays: 7, birthDate: '2004-05-01' });
    const routeStub2 = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/badge_shares') && (init?.method ?? 'GET') === 'POST') {
        writes.push({ url, body: JSON.parse(String(init?.body)) as unknown });
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      return (routeStub2 as typeof fetch)(input, init);
    }));
    expect((await post({ kind: 'streak', locale: 'en-US' })).status).toBe(201);
    expect((writes[1]!.body as { age_band?: unknown }).age_band).toBeNull();
  });

  it('404s for a kid this caller is not a verified guardian of', async () => {
    stub({ guardianLinked: false });
    const res = await post({ kind: 'streak' });
    expect(res.status).toBe(404);
  });

  it('502s when Depot cannot render the image, and never fabricates a badge row', async () => {
    stub({ streakDays: 7, composeFails: true });
    const res = await post({ kind: 'streak' });
    expect(res.status).toBe(502);
    expect(res.body.data).toBeNull();
  });

  it('rejects an invalid kind', async () => {
    stub({ streakDays: 7 });
    const res = await post({ kind: 'not-a-kind' });
    expect(res.status).toBe(400);
  });

  it('issues a goal_reached badge for a goal actually reached', async () => {
    stub({});
    const res = await post({ kind: 'goal_reached', goalId: GOAL_ID, locale: 'es-MX' });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
  });

  it('rejects a goal_reached badge without a goalId', async () => {
    stub({});
    const res = await post({ kind: 'goal_reached' });
    expect(res.status).toBe(400);
  });

  it('rejects a goal that has not been reached yet', async () => {
    stub({ goal: { id: GOAL_ID, kid_user_id: KID_ID, title: 'A bike', target: 50, icon: 'bike', status: 'active', created_at: '2026-09-01', reached_at: null } });
    const res = await post({ kind: 'goal_reached', goalId: GOAL_ID });
    expect(res.status).toBe(403);
  });

  it("rejects a goal belonging to a different kid — no leak of another family's goal", async () => {
    stub({ goal: { id: GOAL_ID, kid_user_id: randomUUID(), title: 'A bike', target: 50, icon: 'bike', status: 'reached', created_at: '2026-09-01', reached_at: '2026-09-08' } });
    const res = await post({ kind: 'goal_reached', goalId: GOAL_ID });
    expect(res.status).toBe(403);
  });
});
