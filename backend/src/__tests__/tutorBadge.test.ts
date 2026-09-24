import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { tutorBadgeVisible } from '../services/supabaseRest.js';

/*
 * E.5: the Tutor badge is a verified-adult signal, not a platform-wide
 * public badge. Service-level matrix: self/staff always; otherwise only a
 * verified-linked kid or a mutual approved follow sees it, and only when
 * the subject is a currently ID-verified parent. An ambiguous read hides
 * the badge.
 */

afterEach(() => vi.unstubAllGlobals());

const VIEWER = '11111111-1111-4111-8111-111111111111';
const SUBJECT = '22222222-2222-4222-8222-222222222222';

interface StubOpts {
  viewerRoles?: string[];
  subjectVerification?: unknown[] | null;
  linkedRows?: unknown[] | null;
  viewerFollows?: unknown[] | null;
  subjectFollows?: unknown[] | null;
}

function stub(opts: StubOpts = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/rest/v1/user_roles')) {
        const roleMatch = url.match(/role=eq\.([a-z]+)/);
        const requested = roleMatch ? roleMatch[1] : null;
        const roles = requested ? (opts.viewerRoles ?? []).filter((role) => role === requested) : (opts.viewerRoles ?? []);
        return Promise.resolve(jsonResponse(200, roles.map((role) => ({ role }))));
      }
      if (url.includes('/rest/v1/parent_verifications')) {
        if (opts.subjectVerification === null) return Promise.resolve(jsonResponse(500, { message: 'unavailable' }));
        return Promise.resolve(jsonResponse(200, opts.subjectVerification ?? [{ status: 'verified', method: 'local-ocr', birth_date: '1988-02-14' }]));
      }
      if (url.includes('/rest/v1/guardian_links')) {
        return Promise.resolve(jsonResponse(200, opts.linkedRows ?? []));
      }
      if (url.includes('/rest/v1/follows') && url.includes(`follower_id=eq.${VIEWER}`)) {
        return Promise.resolve(jsonResponse(200, opts.viewerFollows ?? []));
      }
      if (url.includes('/rest/v1/follows') && url.includes(`follower_id=eq.${SUBJECT}`)) {
        return Promise.resolve(jsonResponse(200, opts.subjectFollows ?? []));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
}

const verified = () => [{ status: 'verified', method: 'local-ocr', birth_date: '1988-02-14' }];

describe('tutorBadgeVisible (E.5)', () => {
  it('is true for the subject themself and for staff viewers', async () => {
    expect(await tutorBadgeVisible(SUBJECT, SUBJECT)).toBe(true);
    stub({ viewerRoles: ['admin'] });
    expect(await tutorBadgeVisible(VIEWER, SUBJECT)).toBe(true);
  });

  it('shows to the subject’s own verified-linked kid', async () => {
    stub({ linkedRows: [{ id: randomUUID() }] });
    expect(await tutorBadgeVisible(VIEWER, SUBJECT)).toBe(true);
  });

  it('shows to a mutual follow (approved connection) without a guardian link', async () => {
    stub({ viewerFollows: [{ id: randomUUID() }], subjectFollows: [{ id: randomUUID() }] });
    expect(await tutorBadgeVisible(VIEWER, SUBJECT)).toBe(true);
  });

  it('hides from an unconnected kid-role viewer', async () => {
    stub({ viewerRoles: ['kid'] });
    expect(await tutorBadgeVisible(VIEWER, SUBJECT)).toBe(false);
  });

  it('hides when the subject has no current ID verification (staff-granted or revoked)', async () => {
    stub({ linkedRows: [{ id: randomUUID() }], subjectVerification: [] });
    expect(await tutorBadgeVisible(VIEWER, SUBJECT)).toBe(false);
    stub({ linkedRows: [{ id: randomUUID() }], subjectVerification: [{ status: 'revoked', method: 'local-ocr', birth_date: '1988-02-14' }] });
    expect(await tutorBadgeVisible(VIEWER, SUBJECT)).toBe(false);
    stub({ linkedRows: [{ id: randomUUID() }], subjectVerification: [{ status: 'verified', method: 'staff-granted', birth_date: null }] });
    expect(await tutorBadgeVisible(VIEWER, SUBJECT)).toBe(false);
  });

  it('fails closed on an ambiguous verification read', async () => {
    stub({ linkedRows: [{ id: randomUUID() }], subjectVerification: null });
    expect(await tutorBadgeVisible(VIEWER, SUBJECT)).toBe(false);
  });
});

describe('public profile badge projection (E.5)', () => {
  const TARGET_ID = '33333333-3333-4333-8333-333333333333';

  function stubProfile(opts: StubOpts = {}) {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/rest/v1/user_roles')) {
          const roleMatch = url.match(/role=eq\.([a-z]+)/);
          const requested = roleMatch ? roleMatch[1] : null;
          const roles = requested ? (opts.viewerRoles ?? ['universal']).filter((role) => role === requested) : (opts.viewerRoles ?? ['universal']);
          return Promise.resolve(jsonResponse(200, roles.map((role) => ({ role }))));
        }
        if (url.includes('/rest/v1/parent_verifications')) {
          if (opts.subjectVerification === null) return Promise.resolve(jsonResponse(500, { message: 'unavailable' }));
          return Promise.resolve(jsonResponse(200, opts.subjectVerification ?? []));
        }
        if (url.includes('/rest/v1/guardian_links')) return Promise.resolve(jsonResponse(200, opts.linkedRows ?? []));
        if (url.includes('/rest/v1/follows')) return Promise.resolve(jsonResponse(200, []));
        if (url.includes('/rest/v1/profiles') && url.includes('username=eq.')) {
          return Promise.resolve(jsonResponse(200, [{
            user_id: TARGET_ID, display_name: 'Ana Tutor', username: 'anatutor', locale: 'es-MX',
            theme: 'system', cover: { preset: 'sunset' }, created_at: '2026-07-12T00:00:00Z',
          }]));
        }
        if (url.includes('/rest/v1/avatars')) return Promise.resolve(jsonResponse(200, []));
        if (url.includes('/rest/v1/learning_stats')) return Promise.resolve(jsonResponse(200, [{ user_id: TARGET_ID, xp_points: 0, minutes_learned: 0, lessons_completed: 0, streak_days: 0, longest_streak: 0, last_active_date: null }]));
        if (url.includes('/rest/v1/course_badges') || url.includes('/rest/v1/badges')) return Promise.resolve(jsonResponse(200, []));
        return Promise.resolve(jsonResponse(200, []));
      }),
    );
  }

  it('a stranger sees a parent profile without the badge', async () => {
    stubProfile({ subjectVerification: verified() });
    const res = await request(createApp())
      .get('/api/v1/profiles/anatutor')
      .set('Authorization', `Bearer ${mintToken({ sub: VIEWER })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isTutor).toBe(false);
  });

  it('the verified parent’s linked kid sees the badge', async () => {
    stubProfile({ subjectVerification: verified(), linkedRows: [{ id: randomUUID() }] });
    const res = await request(createApp())
      .get('/api/v1/profiles/anatutor')
      .set('Authorization', `Bearer ${mintToken({ sub: VIEWER })}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isTutor).toBe(true);
  });
});
