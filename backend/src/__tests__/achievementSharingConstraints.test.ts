import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { firstNameOnly } from '../services/badges.js';
import { mintToken } from './helpers.js';
import { binaryParser, GOAL_ID, KID_ID, PARENT_ID, stubAchievementTransport, type AchievementStubOptions } from './achievementShareStub.js';

/*
 * F.6 STANDING CONSTRAINTS — the release-gate suite (Appendix L 1.2
 * "Standing-Constraint Integrity": pass, every release, no exceptions).
 *
 * Any redesign of achievement sharing must keep all three true, and this
 * suite fails if one is lost:
 *   1. Only a verified guardian of THIS child may initiate a share — not the
 *      child, not a guest, not an independent teen, not an unverified or
 *      revoked parent, not an unlinked adult, not staff.
 *   2. The server verifies the achievement is genuine before rendering.
 *   3. The shared artifact exposes the first name, the achievement label and
 *      the image only — no surname, age, photo, link or identifier.
 * Plus OD-20's architecture invariant: a new share persists nothing public
 * (no badge_shares row, no stored Depot object, no token, no URL).
 *
 * Each case is a DIRECT API request, as the named population would send it.
 */

afterEach(() => vi.unstubAllGlobals());

const VALID = { kind: 'streak', locale: 'en-US', handoff: 'download' };

function post(opts: { sub?: string; anonymous?: boolean; auth?: boolean; body?: unknown } = {}) {
  const req = request(createApp()).post(`/api/v1/family/kids/${KID_ID}/achievement-image`).buffer(true).parse(binaryParser);
  if (opts.auth !== false) {
    req.set('Authorization', `Bearer ${mintToken({ sub: opts.sub ?? PARENT_ID, ...(opts.anonymous ? { is_anonymous: true } : {}) })}`);
  }
  return req.send((opts.body ?? VALID) as object);
}

function code(res: request.Response): string | undefined {
  try {
    return (JSON.parse((res.body as Buffer).toString('utf8')) as { error?: { code?: string } }).error?.code;
  } catch {
    return undefined;
  }
}

function reachedRenderer(calls: { url: string }[]): boolean {
  return calls.some((c) => c.url.includes(':4006/'));
}

describe('F.6 constraint 1: guardian-only initiation (direct requests from every population)', () => {
  const refused: [string, AchievementStubOptions, { sub?: string; anonymous?: boolean; auth?: boolean }, number][] = [
    ['no session at all', {}, { auth: false }, 401],
    ['parent-created under-13 kid (kid role)', { roles: ['kid'] }, {}, 403],
    ['guest (anonymous session, universal role)', { roles: ['universal'] }, { anonymous: true }, 403],
    ['independent teen 13-17 (universal role, no parent role)', { roles: ['universal'], verification: null }, {}, 403],
    ['adult without the parent role', { roles: ['universal'] }, {}, 403],
    ['parent role with no ID verification on file', { verification: null }, {}, 403],
    ['parent whose verification was revoked', { verification: { status: 'revoked', method: 'local-ocr', birth_date: null } }, {}, 403],
    ['parent verified by a method other than local-ocr', { verification: { status: 'verified', method: 'staff-grant', birth_date: '1990-01-01' } }, {}, 403],
    ['a minor holding a parent role (verification birth date under 18)', { verification: { status: 'verified', method: 'local-ocr', birth_date: '2011-01-01' } }, {}, 403],
    ['kid role that also holds parent (kid wins)', { roles: ['kid', 'parent'] }, {}, 403],
    ['staff admin (staff never initiate a share)', { roles: ['admin'] }, {}, 403],
    ['staff superadmin', { roles: ['superadmin'] }, {}, 403],
    ['verified parent who is NOT this child\'s guardian', { guardianLinked: false }, { sub: randomUUID() }, 404],
  ];

  for (const [population, stubOpts, reqOpts, status] of refused) {
    it(`refuses: ${population}`, async () => {
      const calls = stubAchievementTransport({ streakDays: 30, ...stubOpts });
      const res = await post(reqOpts);
      expect(res.status).toBe(status);
      expect(res.headers['content-type']).not.toBe('image/png');
      expect(reachedRenderer(calls)).toBe(false);
      expect(calls.some((c) => c.url.includes('/achievement_share_initiations'))).toBe(false);
    });
  }

  it('releases nothing when the guardian link is revoked during the request', async () => {
    const calls = stubAchievementTransport({ streakDays: 30, guardianRevokedMidRequest: true });
    const res = await post();
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).not.toBe('image/png');
    expect(calls.some((c) => c.url.includes('/achievement_share_initiations'))).toBe(false);
  });

  it('admits the verified parent Tutor of this child', async () => {
    stubAchievementTransport({ streakDays: 30 });
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });
});

describe('F.6 constraint 2: server-side verification of the achievement', () => {
  const unearned: [string, AchievementStubOptions, Record<string, unknown>][] = [
    ['a course the child never completed', { courseBadges: [] }, { kind: 'course_badge', courseSlug: 'financial-education' }],
    ['a streak under three days', { streakDays: 2 }, { kind: 'streak' }],
    ['a goal not yet reached', { goal: { id: GOAL_ID, kid_user_id: KID_ID, title: 'Bike', target: 50, icon: 'bike', status: 'active', created_at: '2026-09-01', reached_at: null } }, { kind: 'goal_reached', goalId: GOAL_ID }],
    ['another child\'s reached goal', { goal: { id: GOAL_ID, kid_user_id: randomUUID(), title: 'Bike', target: 50, icon: 'bike', status: 'reached', created_at: '2026-09-01', reached_at: '2026-09-08' } }, { kind: 'goal_reached', goalId: GOAL_ID }],
    ['a goal that does not exist', { goal: null }, { kind: 'goal_reached', goalId: GOAL_ID }],
  ];
  for (const [name, stubOpts, body] of unearned) {
    it(`refuses ${name} before rendering`, async () => {
      const calls = stubAchievementTransport(stubOpts);
      const res = await post({ body: { locale: 'en-US', handoff: 'download', ...body } });
      expect(res.status).toBe(403);
      expect(code(res)).toBe('FORBIDDEN');
      expect(reachedRenderer(calls)).toBe(false);
    });
  }

  it('never accepts a client-supplied label, name or image field', async () => {
    for (const extra of [{ label: 'Anything' }, { firstName: 'Sofía García' }, { imageUrl: 'https://x.test/a.png' }, { ageBand: '6-8' }]) {
      const calls = stubAchievementTransport({ streakDays: 30 });
      const res = await post({ body: { ...VALID, ...extra } });
      expect(res.status, JSON.stringify(extra)).toBe(400);
      expect(reachedRenderer(calls)).toBe(false);
    }
  });
});

describe('F.6 constraint 3: first name, label and image only', () => {
  it('sends Depot exactly kind, server label, FIRST name and locale — no surname, age or identifier', async () => {
    const calls = stubAchievementTransport({ streakDays: 9, displayName: '  Sofía   García López ' });
    expect((await post()).status).toBe(200);
    const render = calls.find((c) => c.url.includes('/api/v1/badges/render'));
    const body = JSON.parse(render?.body ?? '{}') as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['firstName', 'kind', 'label', 'locale']);
    expect(body.firstName).toBe('Sofía');
    expect(JSON.stringify(body)).not.toMatch(/García|López|2017|birth|age|kid|user|photo|url/i);
  });

  it('leaves out a goal title that could locate the child, and keeps a plain one', async () => {
    const goal = (title: string) => ({ id: GOAL_ID, kid_user_id: KID_ID, title, target: 50, icon: 'bike', status: 'reached', created_at: '2026-09-01', reached_at: '2026-09-08' });
    const label = async (title: string, locale: string) => {
      const calls = stubAchievementTransport({ goal: goal(title) });
      expect((await post({ body: { kind: 'goal_reached', goalId: GOAL_ID, locale, handoff: 'download' } })).status).toBe(200);
      const render = calls.find((c) => c.url.includes('/api/v1/badges/render'));
      return (JSON.parse(render?.body ?? '{}') as { label: string }).label;
    };
    for (const title of ['Trip with Lincoln Elementary', 'Bike, ask @sofia_g', 'call 555 123 4567', 'see tiktok.com/sofia', 'Party 2016']) {
      expect(await label(title, 'en-US')).toBe('Saved 50 coins for a goal');
    }
    expect(await label('Escuela Primaria Juárez', 'es-MX')).toBe('Ahorró 50 monedas para una meta');
    expect(await label('Instagram da Sofia', 'pt-BR')).toBe('Poupou 50 moedas para uma meta');
    expect(await label('A new bike', 'en-US')).toBe('Saved 50 coins for "A new bike"');
  });

  it('caps the first name at 40 characters', () => {
    expect(firstNameOnly('A'.repeat(60) + ' Surname')).toBe('A'.repeat(40));
    expect(firstNameOnly('Ana María')).toBe('Ana');
  });
});

describe('OD-20 architecture: a new share persists nothing public', () => {
  it('writes no badge_shares row, stores no Depot object and returns no token or URL', async () => {
    const calls = stubAchievementTransport({ streakDays: 30 });
    const res = await post();
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(calls.some((c) => c.url.includes('/achievement_share_initiations'))).toBe(true));
    expect(calls.some((c) => c.url.includes('/badge_shares'))).toBe(false);
    // Only the render endpoint on Depot — never the retired compose-and-store or /files.
    expect(calls.filter((c) => c.url.includes(':4006/')).map((c) => new URL(c.url).pathname)).toEqual(['/api/v1/badges/render']);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers.location).toBeUndefined();
  });
});
