import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * L-04 (owner decision OD-27 (1)): teen cooperative goals at Core's boundary.
 *
 * The rules themselves live in the database and are proven on PostgreSQL in
 * database/scripts/verify-coop-goals-postgres.py. Here each population calls
 * every route directly, and the suite proves Core: refuses every population
 * that is not a 13-to-17 participant before any write; always passes the
 * session as the actor; accepts no free text; maps each database refusal to
 * one answer; returns the group total only (no per-member number, no rank, no
 * reward); and gates the Tutor's opt-in behind the verified-parent boundary.
 */

interface Account { id: string; username: string; displayName: string; roles: string[] }
const A = (n: number) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const TEEN: Account = { id: A(1), username: 'rio', displayName: 'Río', roles: ['universal'] };
const FRIEND: Account = { id: A(2), username: 'luz', displayName: 'Luz', roles: ['universal'] };
const ADULT: Account = { id: A(3), username: 'marta', displayName: 'Marta', roles: ['universal'] };
const KID: Account = { id: A(4), username: 'beto', displayName: 'Beto', roles: ['universal', 'kid'] };
const TUTOR: Account = { id: A(5), username: 'tutor_ana', displayName: 'Ana', roles: ['universal', 'parent'] };
const UNVERIFIED: Account = { id: A(6), username: 'papa_x', displayName: 'Papá', roles: ['universal', 'parent'] };
const GOAL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REPORT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ACCOUNTS = [TEEN, FRIEND, ADULT, KID, TUTOR, UNVERIFIED];

interface Reply { status: number; body: unknown }
interface World {
  eligible: string[];
  overview?: unknown;
  candidates?: string[];
  rpc?: Record<string, Reply>;
  people?: { user_id: string; status: string }[];
}
interface Call { url: string; method: string; body?: string }

const refusal = (message: string): Reply => ({ status: 400, body: { code: 'P0001', message } });

function stub(w: World) {
  const calls: Call[] = [];
  const byId = (id?: string) => ACCOUNTS.find((a) => a.id === id);
  const param = (url: string, key: string) => new RegExp(`${key}=eq\\.([^&]+)`).exec(url)?.[1];
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = decodeURIComponent(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body as string | undefined;
    calls.push({ url, method, body });
    const json = (b: unknown, status = 200) => Promise.resolve(jsonResponse(status, b));
    const args = body ? JSON.parse(body) as Record<string, unknown> : {};
    const rpc = /\/rpc\/([a-z_]+)/.exec(url)?.[1];
    if (rpc && w.rpc?.[rpc]) return json(w.rpc[rpc]!.body, w.rpc[rpc]!.status);
    if (rpc === 'coop_goal_eligible') return json(w.eligible.includes(args.p_user as string));
    if (rpc === 'coop_goal_overview') return json(w.overview ?? { eligible: w.eligible.includes(args.p_user as string), goals: [], invitations: [], finished: [] });
    if (rpc === 'coop_goal_candidates') return json(w.candidates ?? []);
    if (rpc === 'create_coop_goal') return json(GOAL);
    if (rpc === 'invite_coop_goal_member') return json(true);
    if (rpc === 'decide_coop_goal_invitation') return json(args.p_accept ? 'accepted' : 'declined');
    if (rpc === 'end_coop_goal_membership') return json(args.p_actor === args.p_member ? 'left' : 'removed');
    if (rpc === 'submit_social_report') return json(REPORT);
    if (rpc === 'coop_goal_guardian_view') return json({ ageFits: true, enabled: false, openGoals: 0 });
    if (rpc === 'set_coop_goal_guardian_consent') return json(args.p_enabled);
    if (rpc) return Promise.resolve(new Response(null, { status: 204 }));
    if (url.includes('/rest/v1/profiles')) {
      if (url.includes('user_id=in.(')) {
        const ids = /user_id=in\.\(([^)]*)\)/.exec(url)?.[1]?.split(',') ?? [];
        return json(ids.map(byId).filter(Boolean).map((a) => ({ user_id: a!.id, display_name: a!.displayName, username: a!.username })));
      }
      const username = param(url, 'username');
      return json(ACCOUNTS.filter((a) => a.username === username).map((a) => ({
        user_id: a.id, display_name: a.displayName, username: a.username, locale: 'es-MX', theme: 'system', cover: null, birth_date: null, created_at: '2026-07-12T00:00:00Z',
      })));
    }
    if (url.includes('/rest/v1/avatars')) return json([]);
    if (url.includes('/rest/v1/user_roles')) {
      if (url.includes('user_id=in.(')) return json([]);
      return json((byId(param(url, 'user_id'))?.roles ?? []).map((role) => ({ role })));
    }
    if (url.includes('/rest/v1/parent_verifications')) {
      return json(param(url, 'user_id') === TUTOR.id ? [{ status: 'verified', method: 'local-ocr', birth_date: '1985-03-01' }] : []);
    }
    if (url.includes('/rest/v1/coop_goal_members')) return json(w.people ?? []);
    return json([]);
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const auth = (viewer: Account, extra: Record<string, unknown> = {}) => `Bearer ${mintToken({ sub: viewer.id, ...extra })}`;
const get = (viewer: Account, path: string) => request(createApp()).get(`/api/v1${path}`).set('Authorization', auth(viewer));
const send = (verb: 'post' | 'put' | 'delete', viewer: Account, path: string, body: unknown = {}, extra: Record<string, unknown> = {}) =>
  request(createApp())[verb](`/api/v1${path}`).set('Authorization', auth(viewer, extra)).send(body as object);
const wrote = (calls: Call[], fn: string) => calls.some((c) => c.url.includes(`/rpc/${fn}`));
const argsOf = (calls: Call[], fn: string) => JSON.parse(calls.find((c) => c.url.includes(`/rpc/${fn}`))!.body!) as Record<string, unknown>;

const CREATE = { target: 10, days: 14, invite: ['luz'] };

describe('L-04: who may start or join a cooperative goal', () => {
  it('an eligible teen starts a goal with a mutual connection; the session is the creator', async () => {
    const calls = stub({ eligible: [TEEN.id, FRIEND.id] });
    const res = await send('post', TEEN, '/coop-goals', CREATE);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ goalId: GOAL });
    expect(argsOf(calls, 'create_coop_goal')).toEqual({ p_creator: TEEN.id, p_target: 10, p_days: 14, p_invitees: [FRIEND.id] });
  });

  it('every population that is not a 13-to-17 participant is refused before any write', async () => {
    for (const [viewer, extra] of [[ADULT, {}], [KID, {}], [TUTOR, {}], [TEEN, { is_anonymous: true }]] as const) {
      const calls = stub({ eligible: [FRIEND.id] });
      const res = await send('post', viewer, '/coop-goals', CREATE, extra);
      expect(res.status, viewer.username).toBe(403);
      expect(res.body.error.code).toBe('COOP_NOT_ELIGIBLE');
      expect(wrote(calls, 'create_coop_goal')).toBe(false);
      const invite = await send('post', viewer, `/coop-goals/${GOAL}/invitations`, { username: 'luz' }, extra);
      expect(invite.status).toBe(403);
      expect((await send('post', viewer, `/coop-goals/${GOAL}/decision`, { decision: 'accept' }, extra)).status).toBe(403);
      expect(wrote(calls, 'invite_coop_goal_member') || wrote(calls, 'decide_coop_goal_invitation')).toBe(false);
      expect((await get(viewer, '/coop-goals/candidates')).status).toBe(403);
    }
  });

  it('an unreadable eligibility is a 502, never a pass', async () => {
    const calls = stub({ eligible: [], rpc: { coop_goal_eligible: { status: 500, body: { message: 'down' } } } });
    expect((await send('post', TEEN, '/coop-goals', CREATE)).status).toBe(502);
    expect(wrote(calls, 'create_coop_goal')).toBe(false);
  });

  it('the database refuses an ineligible or unconnected invitee with one answer, and Core never names who', async () => {
    stub({ eligible: [TEEN.id], rpc: { create_coop_goal: refusal('COOP_MEMBER_UNAVAILABLE') } });
    const res = await send('post', TEEN, '/coop-goals', { ...CREATE, invite: ['marta'] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COOP_MEMBER_UNAVAILABLE');
    // An unknown username reads exactly like an unconnected one.
    const calls = stub({ eligible: [TEEN.id] });
    const unknown = await send('post', TEEN, '/coop-goals', { ...CREATE, invite: ['nobody_here'] });
    expect(unknown.status).toBe(409);
    expect(unknown.body.error.code).toBe('COOP_MEMBER_UNAVAILABLE');
    expect(wrote(calls, 'create_coop_goal')).toBe(false);
  });

  it('size, limits and repeat asks map to their own refusal', async () => {
    for (const [message, status, code] of [
      ['COOP_GROUP_FULL', 409, 'COOP_GROUP_FULL'], ['COOP_GOAL_LIMIT', 409, 'COOP_GOAL_LIMIT'],
      ['COOP_ALREADY_ASKED', 409, 'COOP_ALREADY_ASKED'], ['COOP_GOAL_NOT_FOUND', 404, 'NOT_FOUND'],
    ] as const) {
      stub({ eligible: [TEEN.id], rpc: { invite_coop_goal_member: refusal(message) } });
      const res = await send('post', TEEN, `/coop-goals/${GOAL}/invitations`, { username: 'luz' });
      expect(res.status, message).toBe(status);
      expect(res.body.error.code).toBe(code);
    }
  });

  it('accepts no free text: a name, note or message on a goal, an unknown target or window, or more than four people are refused', async () => {
    for (const body of [
      { ...CREATE, name: 'Squad' }, { ...CREATE, message: 'hi' }, { ...CREATE, target: 12 }, { ...CREATE, days: 30 },
      { ...CREATE, invite: [] }, { ...CREATE, invite: ['a_1', 'b_2', 'c_3', 'd_4', 'e_5'] }, { ...CREATE, invite: ['not a handle!'] },
    ]) {
      const calls = stub({ eligible: [TEEN.id, FRIEND.id] });
      const res = await send('post', TEEN, '/coop-goals', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(wrote(calls, 'create_coop_goal')).toBe(false);
    }
    const calls = stub({ eligible: [TEEN.id] });
    expect((await send('post', TEEN, `/coop-goals/${GOAL}/invitations`, { username: 'luz', note: 'join us' })).status).toBe(400);
    expect((await send('post', TEEN, `/coop-goals/${GOAL}/decision`, { decision: 'accept', reason: 'x' })).status).toBe(400);
    expect(wrote(calls, 'invite_coop_goal_member')).toBe(false);
  });
});

describe('L-04: deciding, leaving and removing', () => {
  it('the invitee decides for itself; declining works even when no longer eligible', async () => {
    let calls = stub({ eligible: [FRIEND.id] });
    const res = await send('post', FRIEND, `/coop-goals/${GOAL}/decision`, { decision: 'accept' });
    expect(res.body.data).toEqual({ status: 'accepted' });
    expect(argsOf(calls, 'decide_coop_goal_invitation')).toEqual({ p_user: FRIEND.id, p_goal: GOAL, p_accept: true });
    calls = stub({ eligible: [] });
    expect((await send('post', FRIEND, `/coop-goals/${GOAL}/decision`, { decision: 'decline' })).body.data).toEqual({ status: 'declined' });
    expect(argsOf(calls, 'decide_coop_goal_invitation').p_user).toBe(FRIEND.id);
  });

  it('anyone leaves at any time, eligible or not, as themself', async () => {
    const calls = stub({ eligible: [] });
    const res = await send('post', ADULT, `/coop-goals/${GOAL}/leave`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ ended: 'left' });
    expect(argsOf(calls, 'end_coop_goal_membership')).toEqual({ p_actor: ADULT.id, p_goal: GOAL, p_member: ADULT.id });
  });

  it('removing someone passes the session as the actor; the database decides who may', async () => {
    let calls = stub({ eligible: [TEEN.id] });
    expect((await send('delete', TEEN, `/coop-goals/${GOAL}/members/luz`)).body.data).toEqual({ ended: 'removed' });
    expect(argsOf(calls, 'end_coop_goal_membership')).toEqual({ p_actor: TEEN.id, p_goal: GOAL, p_member: FRIEND.id });
    calls = stub({ eligible: [FRIEND.id], rpc: { end_coop_goal_membership: refusal('COOP_NOT_ALLOWED') } });
    const refused = await send('delete', FRIEND, `/coop-goals/${GOAL}/members/rio`);
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('COOP_NOT_ALLOWED');
    stub({ eligible: [TEEN.id], rpc: { end_coop_goal_membership: refusal('COOP_MEMBER_NOT_FOUND') } });
    expect((await send('delete', TEEN, `/coop-goals/${GOAL}/members/marta`)).status).toBe(404);
  });
});

describe('L-04: what a member sees', () => {
  const overview = {
    eligible: true,
    goals: [{ id: GOAL, kind: 'lessons', target: 10, startsAt: '2026-09-20T00:00:00Z', endsAt: '2026-10-04T00:00:00Z', createdByMe: true, done: 12,
      members: [TEEN.id, FRIEND.id], invited: [{ userId: ADULT.id, mine: true }] }],
    invitations: [{ goalId: GOAL, kind: 'lessons', target: 5, endsAt: '2026-10-04T00:00:00Z', invitedBy: FRIEND.id, members: [FRIEND.id] }],
    finished: [{ id: GOAL, kind: 'lessons', target: 20, endsAt: '2026-09-19T00:00:00Z', done: 8 }],
  };

  it('the group total only, with cards; no per-member number, rank, stats or reward', async () => {
    stub({ eligible: [TEEN.id], overview });
    const res = await get(TEEN, '/coop-goals');
    expect(res.status).toBe(200);
    const goal = res.body.data.goals[0];
    expect(goal).toMatchObject({ target: 10, done: 12, reached: true, canInvite: true, createdByMe: true });
    expect(goal.members.map((m: { username: string }) => m.username)).toEqual(['rio', 'luz']);
    expect(Object.keys(goal.members[0]).sort()).toEqual(['avatarOptions', 'displayName', 'isSelf', 'username']);
    expect(goal.invited[0]).toMatchObject({ username: 'marta', mine: true });
    expect(res.body.data.invitations[0].invitedBy.username).toBe('luz');
    expect(res.body.data.finished[0]).toMatchObject({ done: 8, reached: false });
    const text = JSON.stringify(res.body.data);
    expect(text).not.toMatch(/\b(rank\w*|leader\w*|position|xp\w*|coins?|rewards?|streak\w*|lessonsCompleted|minutes\w*)\b/i);
  });

  it('a malformed overview is a 502, never an empty success', async () => {
    stub({ eligible: [TEEN.id], overview: { ...overview, goals: [{ ...overview.goals[0], perMember: { [TEEN.id]: 6 } }] } });
    expect((await get(TEEN, '/coop-goals')).status).toBe(502);
  });

  it('a guest gets the empty, ineligible view without a database call', async () => {
    const calls = stub({ eligible: [] });
    const res = await get(TEEN, '/coop-goals').set('Authorization', auth(TEEN, { is_anonymous: true }));
    expect(res.body.data).toMatchObject({ eligible: false, goals: [], invitations: [] });
    expect(wrote(calls, 'coop_goal_overview')).toBe(false);
  });

  it('candidates are the mutual connections the database names', async () => {
    stub({ eligible: [TEEN.id], candidates: [FRIEND.id] });
    const res = await get(TEEN, '/coop-goals/candidates');
    expect(res.body.data.people).toEqual([{ username: 'luz', displayName: 'Luz', avatarOptions: expect.any(Object), isSelf: false }]);
  });
});

describe('L-04 / E.3: reporting from inside a goal', () => {
  it('reports someone who is or was in the goal with you, and can leave in the same step', async () => {
    const calls = stub({ eligible: [TEEN.id], people: [{ user_id: TEEN.id, status: 'active' }, { user_id: FRIEND.id, status: 'ended' }] });
    const res = await send('post', TEEN, `/coop-goals/${GOAL}/report`, { username: 'luz', category: 'harassment', leave: true });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ reported: true, reportId: REPORT, left: true });
    expect(argsOf(calls, 'submit_social_report')).toMatchObject({ p_reporter_id: TEEN.id, p_subject_id: FRIEND.id, p_category: 'harassment' });
  });

  it('refuses a report about someone who was never in the goal, or from someone who was not', async () => {
    for (const people of [[{ user_id: TEEN.id, status: 'active' }], [{ user_id: FRIEND.id, status: 'active' }]]) {
      const calls = stub({ eligible: [TEEN.id], people });
      expect((await send('post', TEEN, `/coop-goals/${GOAL}/report`, { username: 'luz', category: 'other' })).status).toBe(404);
      expect(wrote(calls, 'submit_social_report')).toBe(false);
    }
    expect((await send('post', TEEN, `/coop-goals/${GOAL}/report`, { username: 'luz', category: 'spam' })).status).toBe(400);
  });
});

describe('L-04: the Tutor turns goals together on for a 13-to-17 child', () => {
  it('a verified Tutor reads and changes the opt-in; the Tutor is the actor', async () => {
    const calls = stub({ eligible: [] });
    expect((await get(TUTOR, `/family/coop-goals/kids/${KID.id}`)).body.data).toEqual({ ageFits: true, enabled: false, openGoals: 0 });
    const res = await send('put', TUTOR, `/family/coop-goals/kids/${KID.id}`, { enabled: true });
    expect(res.status).toBe(200);
    expect(argsOf(calls, 'set_coop_goal_guardian_consent')).toEqual({ p_guardian: TUTOR.id, p_kid: KID.id, p_enabled: true });
  });

  it('an unverified parent, a teen and an adult without the parent role are refused; another family\'s child is 404', async () => {
    for (const viewer of [UNVERIFIED, TEEN, ADULT, KID]) {
      const calls = stub({ eligible: [] });
      const res = await send('put', viewer, `/family/coop-goals/kids/${KID.id}`, { enabled: true });
      expect(res.status, viewer.username).toBe(403);
      expect(wrote(calls, 'set_coop_goal_guardian_consent')).toBe(false);
    }
    stub({ eligible: [], rpc: { set_coop_goal_guardian_consent: refusal('COOP_GUARDIAN_NOT_LINKED') } });
    expect((await send('put', TUTOR, `/family/coop-goals/kids/${FRIEND.id}`, { enabled: true })).status).toBe(404);
    stub({ eligible: [], rpc: { set_coop_goal_guardian_consent: refusal('COOP_CHILD_NOT_TEEN') } });
    expect((await send('put', TUTOR, `/family/coop-goals/kids/${KID.id}`, { enabled: true })).body.error.code).toBe('COOP_CHILD_NOT_TEEN');
    expect((await send('put', TUTOR, `/family/coop-goals/kids/${KID.id}`, { enabled: 'yes' })).status).toBe(400);
  });
});

describe('OD-9 4.2: goals together are a registered data practice (sharing.cooperative_goals)', () => {
  it('a migrated child without the practice consent is refused by name, before any write', async () => {
    const calls = stub({ eligible: [], rpc: { data_practice_applies: { status: 200, body: false } } });
    const res = await send('post', TEEN, '/coop-goals', CREATE);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DATA_PRACTICE_CONSENT_REQUIRED');
    expect(argsOf(calls, 'data_practice_applies')).toEqual({ p_subject: TEEN.id, p_practice: 'sharing.cooperative_goals' });
    expect(wrote(calls, 'create_coop_goal')).toBe(false);
  });

  it('an ineligible account the practice applies to (or an unreadable answer) keeps the generic refusal', async () => {
    stub({ eligible: [], rpc: { data_practice_applies: { status: 200, body: true } } });
    expect((await send('post', TEEN, '/coop-goals', CREATE)).body.error.code).toBe('COOP_NOT_ELIGIBLE');
    stub({ eligible: [], rpc: { data_practice_applies: { status: 500, body: { message: 'down' } } } });
    expect((await send('post', TEEN, '/coop-goals', CREATE)).body.error.code).toBe('COOP_NOT_ELIGIBLE');
  });

  it('the database\'s named refusal maps to 403 DATA_PRACTICE_CONSENT_REQUIRED on create and on accept', async () => {
    stub({ eligible: [TEEN.id], rpc: { create_coop_goal: refusal('DATA_PRACTICE_CONSENT_REQUIRED') } });
    const created = await send('post', TEEN, '/coop-goals', CREATE);
    expect(created.status).toBe(403);
    expect(created.body.error.code).toBe('DATA_PRACTICE_CONSENT_REQUIRED');
    stub({ eligible: [TEEN.id], rpc: { decide_coop_goal_invitation: refusal('DATA_PRACTICE_CONSENT_REQUIRED') } });
    const accepted = await send('post', TEEN, `/coop-goals/${GOAL}/decision`, { decision: 'accept' });
    expect(accepted.status).toBe(403);
    expect(accepted.body.error.code).toBe('DATA_PRACTICE_CONSENT_REQUIRED');
  });

  it('the practice is registered in a migration and enforced inside coop_goal_eligible and both write paths', () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const dir = join(root, 'database/migrations');
    const name = readdirSync(dir).find((f) => f.endsWith('_cooperative_goals_data_practice.sql'));
    expect(name).toBeDefined();
    const sql = readFileSync(join(dir, name!), 'utf8');
    expect(sql).toMatch(/\('sharing\.cooperative_goals', 'sharing_surface', 'teen_cooperative_goals', 'B\.23\/OD-27', 'data_practice_consents', false,/);
    const eligible = sql.slice(sql.indexOf('FUNCTION public.coop_goal_eligible'), sql.indexOf('$$;', sql.indexOf('FUNCTION public.coop_goal_eligible')));
    expect(eligible).toContain("public.data_practice_applies(p_user, 'sharing.cooperative_goals')");
    expect(sql.match(/RAISE EXCEPTION 'DATA_PRACTICE_CONSENT_REQUIRED'/g)).toHaveLength(2);
    expect(sql).toContain("public.data_practice_set_consent(p_kid, p_guardian, 'sharing.cooperative_goals', p_enabled,");
  });
});
