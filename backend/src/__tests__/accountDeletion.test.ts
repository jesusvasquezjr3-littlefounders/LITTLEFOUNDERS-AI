import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../config.js';
import { ACCOUNT_DELETION_GRACE_DAYS, runAccountErasure } from '../services/accountDeletion.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * Product 10 E.6 — self-service account deletion at its enforcing boundary.
 *
 * A stateful fake Vault stands in for PostgREST (the request lifecycle
 * functions behave like migration account_deletion_requests; the real SQL is
 * proven by database/scripts/verify-account-erasure-postgres.py), plus fake
 * GoTrue, Oracle, Depot and warehouse endpoints. Every population makes
 * direct API requests: no session, a parent-created child, a guest, a
 * self-registered under-13, an independent teen, an adult (password and
 * OAuth sessions), a verified parent Tutor and staff.
 */

interface Row {
  id: string; subject_id: string; population: string; initiated_by: string; status: string;
  requested_at: string; scheduled_for: string; started_at: string | null; attempts: number;
  held_reason: string | null; steps: Record<string, unknown>; depot_paths: string[]; anon_ids: string[];
  last_error: string | null; cancelled_at: string | null; completed_at: string | null;
}

interface Account { roles: string[]; band: 'under_13' | '13_to_17' | 'adult' | null; origin?: boolean; password?: string; email?: string }

interface Fake {
  accounts: Map<string, Account>;
  rows: Row[];
  audits: { action: string; subject: string; actor_id: string | null; detail: Record<string, unknown> }[];
  calls: string[];
  kidLinks: Map<string, string[]>; // kid -> verified guardians
  openCase: Set<string>;
  fail: Partial<Record<'oracle' | 'core' | 'depot' | 'dataintel' | 'roles' | 'deletionRead' | 'links' | 'suspensions', boolean>>;
  // A.1 (F3-identity-site): kid -> profiles.suspended_at.
  suspended: Map<string, string>;
  suspensionArgs: Record<string, unknown>[];
  // D-14 (b): what the database trigger writes for a linked teen's own request (request id, Tutor).
  notices: { request: string; guardian: string }[];
  depotPaths: string[];
  revoked: string[];
}

let fake: Fake;
const now = () => new Date().toISOString();

function p0001(message: string) {
  return jsonResponse(400, { code: 'P0001', message });
}

function install(): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
    fake.calls.push(`${method} ${url}`);
    const param = (name: string) => new URL(url).searchParams.get(name)?.replace(/^eq\./, '') ?? '';

    if (url.includes('/rest/v1/user_roles')) {
      if (fake.fail.roles) return jsonResponse(500, {});
      return jsonResponse(200, (fake.accounts.get(param('user_id'))?.roles ?? []).map((role) => ({ role })));
    }
    if (url.includes('/rest/v1/account_age_declarations')) {
      const band = fake.accounts.get(param('user_id'))?.band;
      return jsonResponse(200, band && band !== 'under_13' ? [{ declared_age_band: band }] : []);
    }
    if (url.includes('/rest/v1/account_safety_origins')) {
      return jsonResponse(200, fake.accounts.get(param('user_id'))?.origin ? [{ under13_origin: true }] : []);
    }
    if (url.includes('/rest/v1/guardian_links?parent_user_id=')) {
      const parent = param('parent_user_id');
      return jsonResponse(200, [...fake.kidLinks.entries()].filter(([, gs]) => gs.includes(parent))
        .map(([kid]) => ({ parent_user_id: parent, kid_user_id: kid, verification_status: 'verified' })));
    }
    if (url.includes('/rest/v1/guardian_links?kid_user_id=')) {
      if (fake.fail.links) return jsonResponse(500, {});
      return jsonResponse(200, (fake.kidLinks.get(param('kid_user_id')) ?? []).map((id) => ({ parent_user_id: id, id: randomUUID() })));
    }
    if (url.includes('/rest/v1/audit_logs')) {
      fake.audits.push(body as Fake['audits'][number]);
      return new Response(null, { status: 201 });
    }
    if (url.includes('/rest/v1/account_deletion_requests')) {
      if (fake.fail.deletionRead) return jsonResponse(500, {});
      const q = new URL(url).searchParams;
      let rows = fake.rows;
      if (q.get('subject_id')) rows = rows.filter((r) => r.subject_id === q.get('subject_id')!.slice(3));
      if (q.get('id')) rows = rows.filter((r) => r.id === q.get('id')!.slice(3));
      if (q.get('status')?.startsWith('in.')) rows = rows.filter((r) => ['pending', 'processing', 'held'].includes(r.status));
      if (q.get('status')?.startsWith('eq.')) rows = rows.filter((r) => r.status === q.get('status')!.slice(3));
      if (q.get('or')) {
        rows = rows.filter((r) => (r.status === 'pending' && Date.parse(r.scheduled_for) <= Date.now())
          || (r.status === 'processing' && r.started_at !== null && Date.parse(r.started_at) <= Date.now() - 600_000));
      }
      if (q.get('limit')) rows = rows.slice(0, Number(q.get('limit')));
      return jsonResponse(200, rows.map((r) => (q.get('select') === 'id' ? { id: r.id } : r)));
    }
    if (url.endsWith('/rest/v1/rpc/request_account_deletion')) {
      const subject = String(body.p_subject);
      const account = fake.accounts.get(subject);
      if (!account) return p0001('NO_SUCH_ACCOUNT');
      if (account.roles.some((r) => r === 'admin' || r === 'superadmin')) return p0001('STAFF_ACCOUNT');
      if (fake.rows.some((r) => r.subject_id === subject && ['pending', 'processing', 'held'].includes(r.status))) return p0001('DELETION_ALREADY_OPEN');
      const requested = now();
      const row: Row = {
        id: randomUUID(), subject_id: subject, population: String(body.p_population), initiated_by: String(body.p_initiated_by),
        status: 'pending', requested_at: requested,
        scheduled_for: new Date(Date.parse(requested) + Number(body.p_grace_days) * 86_400_000).toISOString(),
        started_at: null, attempts: 0, held_reason: null, steps: {}, depot_paths: [], anon_ids: [], last_error: null,
        cancelled_at: null, completed_at: null,
      };
      fake.rows.push(row);
      fake.audits.push({ action: 'account.deletion_requested', subject, actor_id: (body.p_actor as string | null) ?? null, detail: { request_id: row.id } });
      // teen_deletion_guardian_notices: the trigger tells each verified Tutor of a teen's own request, in the same transaction.
      const tutors = row.population === 'teen' && row.initiated_by === 'self' ? fake.kidLinks.get(subject) ?? [] : [];
      for (const guardian of tutors) fake.notices.push({ request: row.id, guardian });
      if (tutors.length > 0) fake.audits.push({ action: 'account.deletion_guardians_notified', subject, actor_id: subject, detail: { request_id: row.id, guardians: tutors.length } });
      return jsonResponse(200, row);
    }
    if (url.endsWith('/rest/v1/rpc/cancel_account_deletion')) {
      const row = fake.rows.find((r) => r.subject_id === body.p_subject && ['pending', 'held'].includes(r.status) && r.initiated_by === 'self');
      if (!row) {
        return fake.rows.some((r) => r.subject_id === body.p_subject && r.status === 'processing') ? p0001('DELETION_IN_PROGRESS') : p0001('NO_OPEN_DELETION');
      }
      row.status = 'cancelled'; row.cancelled_at = now();
      fake.audits.push({ action: 'account.deletion_cancelled', subject: row.subject_id, actor_id: row.subject_id, detail: {} });
      return jsonResponse(200, row);
    }
    if (url.endsWith('/rest/v1/rpc/claim_account_deletion')) {
      const row = fake.rows.find((r) => r.id === body.p_request);
      const nulls = { id: null };
      if (!row || !['pending', 'processing', 'held'].includes(row.status)) return jsonResponse(200, nulls);
      if (row.status === 'pending' && Date.parse(row.scheduled_for) > Date.now()) return jsonResponse(200, nulls);
      if (row.status === 'processing' && row.started_at && Date.parse(row.started_at) > Date.now() - 600_000) return jsonResponse(200, nulls);
      if (!('core' in row.steps) && fake.openCase.has(row.subject_id)) {
        row.status = 'held'; row.held_reason = 'open_safety_review';
        return jsonResponse(200, row);
      }
      row.status = 'processing'; row.held_reason = null; row.started_at = now(); row.attempts += 1;
      return jsonResponse(200, row);
    }
    if (url.endsWith('/rest/v1/rpc/record_account_deletion_step')) {
      const row = fake.rows.find((r) => r.id === body.p_request && r.status === 'processing');
      if (!row) return jsonResponse(200, false);
      if (body.p_result) row.steps[String(body.p_step)] = body.p_result;
      row.last_error = body.p_error ? `${String(body.p_step)}: ${String(body.p_error)}` : null;
      if (Array.isArray(body.p_depot_paths)) row.depot_paths = body.p_depot_paths as string[];
      return jsonResponse(200, true);
    }
    if (url.endsWith('/rest/v1/rpc/list_expired_kid_suspensions')) {
      // The SQL filter (window, kid role, no verified link, no open request) is
      // proven on PostgreSQL by verify-account-erasure-postgres.py. This fake
      // applies the window and the open request only, so the tests below can
      // prove that Core re-reads the links before it erases anything.
      fake.suspensionArgs.push(body);
      if (fake.fail.suspensions) return jsonResponse(500, { message: 'db down' });
      const days = Number(body.p_older_than_days);
      return jsonResponse(200, [...fake.suspended.entries()]
        .filter(([kid, at]) => fake.accounts.has(kid) && Date.parse(at) <= Date.now() - days * 86_400_000
          && !fake.rows.some((r) => r.subject_id === kid && ['pending', 'processing', 'held'].includes(r.status)))
        .slice(0, Number(body.p_limit))
        .map(([kid, at]) => ({ user_id: kid, suspended_at: at })));
    }
    if (url.endsWith('/rest/v1/rpc/erase_account_data')) {
      const row = fake.rows.find((r) => r.id === body.p_request);
      if (!row || row.status !== 'processing') return p0001('ERASURE_NOT_CLAIMED');
      if (fake.fail.core) return jsonResponse(500, { message: 'db down' });
      if (!('core' in row.steps)) {
        row.steps.core = { account: 1 };
        row.depot_paths = [...fake.depotPaths];
        row.anon_ids = [];
        fake.accounts.delete(row.subject_id);
      }
      return jsonResponse(200, row.steps.core);
    }
    if (url.endsWith('/rest/v1/rpc/complete_account_deletion')) {
      const row = fake.rows.find((r) => r.id === body.p_request);
      if (!row || row.status !== 'processing') return p0001('DELETION_NOT_PROCESSING');
      if (!['oracle', 'core', 'depot', 'dataintel'].every((s) => s in row.steps) || row.depot_paths.length > 0) return p0001('DELETION_INCOMPLETE');
      row.status = 'completed'; row.completed_at = now();
      return jsonResponse(200, row);
    }
    if (url.includes('/auth/v1/token?grant_type=password')) {
      const account = [...fake.accounts.values()].find((a) => a.email === body.email);
      return account && account.password === body.password
        ? jsonResponse(200, { access_token: 'x', refresh_token: 'y', expires_in: 3600, user: {} })
        : jsonResponse(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    }
    if (url.includes('/auth/v1/admin/users/') && url.endsWith('/sessions') && method === 'DELETE') {
      fake.revoked.push(url.split('/admin/users/')[1]!.split('/')[0]!);
      return new Response(null, { status: 204 });
    }
    if (url.startsWith('http://oracle.test/api/v1/tutor/erasure')) {
      if (fake.fail.oracle) return jsonResponse(503, {});
      return jsonResponse(200, { data: { live: 0, parked: 0 }, error: null });
    }
    if (url.includes('/api/v1/files/') && method === 'DELETE') {
      if (fake.fail.depot) return jsonResponse(503, {});
      return jsonResponse(200, { data: { deleted: true }, error: null });
    }
    if (url.includes('/api/v1/intel/erasure')) {
      if (fake.fail.dataintel) return jsonResponse(502, {});
      return jsonResponse(200, { data: { fact_events_raw: 3 }, error: null });
    }
    return jsonResponse(200, []);
  }));
}

beforeEach(() => {
  fake = {
    accounts: new Map(), rows: [], audits: [], calls: [], kidLinks: new Map(), openCase: new Set(), fail: {}, depotPaths: [], revoked: [], notices: [],
    suspended: new Map(), suspensionArgs: [],
  };
  install();
});
afterEach(() => {
  vi.unstubAllGlobals();
  // The deletion request shares authRateLimiter's 10-per-15-minutes budget
  // (it checks a password); reset the loopback key so tests stay independent.
  for (const key of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) void authRateLimiter.resetKey(key);
});

const fresh = () => [{ method: 'oauth', timestamp: Math.floor(Date.now() / 1000) - 60 }];
const stale = () => [{ method: 'oauth', timestamp: Math.floor(Date.now() / 1000) - 3 * 3600 }];

function person(account: Account, id = randomUUID()): string {
  fake.accounts.set(id, account);
  return id;
}

function as(id: string, extra: Parameters<typeof mintToken>[0] = {}) {
  const email = fake.accounts.get(id)?.email ?? 'user@example.com';
  return { Authorization: `Bearer ${mintToken({ sub: id, email, amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }], ...extra })}` };
}

const del = (headers: Record<string, string>, body: unknown = { acknowledge: true }) =>
  request(createApp()).post('/api/v1/account/deletion').set(headers).send(body as object);

describe('who may delete their own account (POST /api/v1/account/deletion)', () => {
  it('refuses a request with no session', async () => {
    expect((await request(createApp()).post('/api/v1/account/deletion').send({ acknowledge: true })).status).toBe(401);
    expect((await request(createApp()).get('/api/v1/account/deletion')).status).toBe(401);
  });

  it('refuses a parent-created child: its Tutor deletes it, never the child', async () => {
    const kid = person({ roles: ['kid'], band: null });
    const res = await del(as(kid));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('KID_DELETION_BY_TUTOR');
    expect(fake.rows).toHaveLength(0);
    const state = await request(createApp()).get('/api/v1/account/deletion').set(as(kid));
    expect(state.body.data.eligibility).toEqual({ allowed: false, reason: 'kid' });
  });

  it('refuses staff (admin and superadmin) through this flow', async () => {
    for (const role of ['admin', 'superadmin']) {
      const staff = person({ roles: ['universal', role], band: 'adult', password: 'pw-correct', email: `${role}@littlefounders.ai` });
      const res = await del(as(staff), { acknowledge: true, currentPassword: 'pw-correct' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('STAFF_ACCOUNT');
    }
    expect(fake.rows).toHaveLength(0);
  });

  it('requires the explicit acknowledgement and refuses any other field', async () => {
    const adult = person({ roles: ['universal'], band: 'adult', password: 'pw-correct', email: 'a@example.com' });
    expect((await del(as(adult), {})).status).toBe(400);
    expect((await del(as(adult), { acknowledge: false })).status).toBe(400);
    expect((await del(as(adult), { acknowledge: true, currentPassword: 'pw-correct', population: 'guest' })).status).toBe(400);
    expect(fake.rows).toHaveLength(0);
  });

  it('a password session must re-enter the password', async () => {
    const adult = person({ roles: ['universal'], band: 'adult', password: 'pw-correct', email: 'a@example.com' });
    const missing = await del(as(adult));
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('REAUTH_REQUIRED');
    const wrong = await del(as(adult), { acknowledge: true, currentPassword: 'nope' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(fake.rows).toHaveLength(0);
  });

  it('an OAuth session must be a recent sign-in', async () => {
    const adult = person({ roles: ['universal'], band: 'adult', email: 'g@example.com' });
    const old = await del(as(adult, { amr: stale() }));
    expect(old.status).toBe(401);
    expect(old.body.error.code).toBe('REAUTH_REQUIRED');
    const recent = await del(as(adult, { amr: fresh() }));
    expect(recent.status).toBe(202);
  });

  it('an adult gets a pending deletion with a stated date, and every session is signed out', async () => {
    const adult = person({ roles: ['universal'], band: 'adult', password: 'pw-correct', email: 'a@example.com' });
    const res = await del(as(adult), { acknowledge: true, currentPassword: 'pw-correct' });
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ status: 'pending', population: 'adult', graceDays: ACCOUNT_DELETION_GRACE_DAYS, signedOut: true });
    const days = (Date.parse(res.body.data.scheduledFor) - Date.parse(res.body.data.requestedAt)) / 86_400_000;
    expect(days).toBe(ACCOUNT_DELETION_GRACE_DAYS);
    expect(fake.revoked).toEqual([adult]);
    expect(fake.accounts.has(adult)).toBe(true);
    expect(fake.calls.some((c) => c.includes('erase_account_data'))).toBe(false);
    expect(fake.audits.some((a) => a.action === 'account.deletion_requested' && a.subject === adult)).toBe(true);
  });

  it('an independent teen (13-17, no guardian) deletes their own account on the same terms', async () => {
    const teen = person({ roles: ['universal'], band: '13_to_17', password: 'pw-correct', email: 't@example.com' });
    const res = await del(as(teen), { acknowledge: true, currentPassword: 'pw-correct' });
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ status: 'pending', population: 'teen' });
  });

  describe('D-14 (b): a linked teen\'s Tutors are told (notify only)', () => {
    const PARENT_A = randomUUID();
    const PARENT_B = randomUUID();
    const linkedTeen = () => {
      const teen = person({ roles: ['universal'], band: '13_to_17', password: 'pw-correct', email: 'lt@example.com' });
      fake.kidLinks.set(teen, [PARENT_A, PARENT_B]);
      return teen;
    };

    it('shows the teen, before confirming, how many Tutors will be told', async () => {
      const teen = linkedTeen();
      const res = await request(createApp()).get('/api/v1/account/deletion').set(as(teen));
      expect(res.status).toBe(200);
      expect(res.body.data.eligibility).toMatchObject({ allowed: true, population: 'teen', tutorsTold: 2 });
    });

    it('tells each verified Tutor in the request\'s own step, with the audit row', async () => {
      const teen = linkedTeen();
      const res = await del(as(teen), { acknowledge: true, currentPassword: 'pw-correct' });
      expect(res.status).toBe(202);
      expect(res.body.data).toMatchObject({ status: 'pending', population: 'teen', tutorsTold: 2 });
      const [row] = fake.rows;
      expect(fake.notices).toEqual([{ request: row!.id, guardian: PARENT_A }, { request: row!.id, guardian: PARENT_B }]);
      expect(fake.audits.filter((a) => a.action === 'account.deletion_guardians_notified'))
        .toEqual([{ action: 'account.deletion_guardians_notified', subject: teen, actor_id: teen, detail: { request_id: row!.id, guardians: 2 } }]);
      // Read before scheduling: the link lookup precedes the request.
      const lookup = fake.calls.findIndex((c) => c.includes(`guardian_links?kid_user_id=eq.${teen}`));
      const scheduled = fake.calls.findIndex((c) => c.includes('rpc/request_account_deletion'));
      expect(lookup).toBeGreaterThanOrEqual(0);
      expect(lookup).toBeLessThan(scheduled);
    });

    it('tells nobody for an unlinked teen (D-14 (a)) or an adult', async () => {
      const teen = person({ roles: ['universal'], band: '13_to_17', password: 'pw-correct', email: 'ut@example.com' });
      const res = await del(as(teen), { acknowledge: true, currentPassword: 'pw-correct' });
      expect(res.status).toBe(202);
      expect(res.body.data.tutorsTold).toBe(0);
      const adult = person({ roles: ['universal'], band: 'adult', password: 'pw-correct', email: 'ad@example.com' });
      fake.kidLinks.set(adult, [PARENT_A]);
      expect((await del(as(adult), { acknowledge: true, currentPassword: 'pw-correct' })).body.data.tutorsTold).toBe(0);
      expect(fake.notices).toEqual([]);
      expect(fake.audits.some((a) => a.action === 'account.deletion_guardians_notified')).toBe(false);
    });

    it('needs no second notice when the teen keeps the account', async () => {
      const teen = linkedTeen();
      await del(as(teen), { acknowledge: true, currentPassword: 'pw-correct' });
      const kept = await request(createApp()).delete('/api/v1/account/deletion').set(as(teen));
      expect(kept.status).toBe(200);
      expect(fake.notices).toHaveLength(2);
      expect(fake.audits.filter((a) => a.action === 'account.deletion_guardians_notified')).toHaveLength(1);
    });

    it('schedules nothing when the linked Tutors cannot be read (502)', async () => {
      const teen = linkedTeen();
      fake.fail.links = true;
      const res = await del(as(teen), { acknowledge: true, currentPassword: 'pw-correct' });
      expect(res.status).toBe(502);
      expect(fake.rows).toEqual([]);
      expect(fake.calls.some((c) => c.includes('rpc/request_account_deletion'))).toBe(false);
      expect((await request(createApp()).get('/api/v1/account/deletion').set(as(teen))).status).toBe(502);
    });
  });

  it('a guest is erased now, across every service, with no password to re-enter', async () => {
    const guest = person({ roles: ['universal'], band: null, origin: true });
    fake.depotPaths = [`tutor-speech/${'a'.repeat(64)}.mp3`];
    const res = await del(as(guest, { is_anonymous: true, amr: [{ method: 'anonymous', timestamp: 1 }] }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'completed', population: 'guest' });
    expect(fake.accounts.has(guest)).toBe(false);
    const order = ['oracle.test/api/v1/tutor/erasure', 'rpc/erase_account_data', '/api/v1/files/tutor-speech/', '/api/v1/intel/erasure', 'rpc/complete_account_deletion']
      .map((needle) => fake.calls.findIndex((c) => c.includes(needle)));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(fake.rows[0]!.status).toBe('completed');
  });

  it('a self-registered under-13 account is erased now as well', async () => {
    const child = person({ roles: ['universal'], band: 'under_13', origin: true, email: 'c@example.com' });
    const res = await del(as(child, { amr: fresh() }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'completed', population: 'child' });
  });

  it('a verified parent sees which children will be paused before confirming', async () => {
    const parent = person({ roles: ['universal', 'parent'], band: 'adult', password: 'pw-correct', email: 'p@example.com' });
    const other = randomUUID();
    fake.kidLinks.set(randomUUID(), [parent]);
    fake.kidLinks.set(randomUUID(), [parent, other]);
    const state = await request(createApp()).get('/api/v1/account/deletion').set(as(parent));
    expect(state.status).toBe(200);
    expect(state.body.data).toMatchObject({
      deletion: null,
      eligibility: { allowed: true, population: 'parent', graceDays: 14, immediate: false, reauth: 'password', children: { lastTutorOf: 1, sharedTutorOf: 1 } },
    });
    const res = await del(as(parent), { acknowledge: true, currentPassword: 'pw-correct' });
    expect(res.body.data).toMatchObject({ status: 'pending', population: 'parent' });
  });

  it('a second request while one is open is refused', async () => {
    const adult = person({ roles: ['universal'], band: 'adult', email: 'g@example.com' });
    expect((await del(as(adult, { amr: fresh() }))).status).toBe(202);
    const again = await del(as(adult, { amr: fresh() }));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('DELETION_ALREADY_OPEN');
  });

  it('an unreadable role or state is a 502, never a decision', async () => {
    const adult = person({ roles: ['universal'], band: 'adult', email: 'g@example.com' });
    fake.fail.roles = true;
    expect((await del(as(adult, { amr: fresh() }))).status).toBe(502);
    expect(fake.rows).toHaveLength(0);
    fake.fail.roles = false;
    fake.fail.deletionRead = true;
    expect((await request(createApp()).get('/api/v1/account/deletion').set(as(adult))).status).toBe(502);
  });
});

describe('keeping the account (DELETE /api/v1/account/deletion) and signing back in', () => {
  it('the holder cancels a pending deletion; /auth/me carries it until then', async () => {
    const adult = person({ roles: ['universal'], band: 'adult', email: 'g@example.com' });
    const created = await del(as(adult, { amr: fresh() }));
    const scheduledFor = created.body.data.scheduledFor;
    const state = await request(createApp()).get('/api/v1/account/deletion').set(as(adult));
    expect(state.body.data.deletion).toMatchObject({ status: 'pending', scheduledFor });

    const cancelled = await request(createApp()).delete('/api/v1/account/deletion').set(as(adult));
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect(fake.audits.some((a) => a.action === 'account.deletion_cancelled')).toBe(true);
    const none = await request(createApp()).delete('/api/v1/account/deletion').set(as(adult));
    expect(none.status).toBe(404);
  });

  it('once the erasure has started it can no longer be cancelled', async () => {
    const adult = person({ roles: ['universal'], band: 'adult', email: 'g@example.com' });
    await del(as(adult, { amr: fresh() }));
    fake.rows[0]!.status = 'processing';
    const res = await request(createApp()).delete('/api/v1/account/deletion').set(as(adult));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DELETION_IN_PROGRESS');
  });

  it('/auth/me reports a pending deletion so the shell can show the date and the keep action', async () => {
    const adult = person({ roles: ['universal'], band: 'adult', email: 'g@example.com' });
    await del(as(adult, { amr: fresh() }));
    const res = await request(createApp()).get('/api/v1/auth/me').set(as(adult));
    expect(res.status).toBe(200);
    expect(res.body.data.accountDeletion).toMatchObject({ status: 'pending', scheduledFor: fake.rows[0]!.scheduled_for });
    await request(createApp()).delete('/api/v1/account/deletion').set(as(adult));
    const after = await request(createApp()).get('/api/v1/auth/me').set(as(adult));
    expect(after.body.data.accountDeletion).toBeNull();
  });
});

describe('the erasure lifecycle (services/accountDeletion.ts)', () => {
  async function due(population = 'adult'): Promise<string> {
    const subject = person({ roles: ['universal'], band: 'adult' });
    const res = await fetch('http://supabase.test/rest/v1/rpc/request_account_deletion', {
      method: 'POST', body: JSON.stringify({ p_subject: subject, p_population: population, p_initiated_by: 'self', p_grace_days: 0, p_actor: subject }),
    });
    return ((await res.json()) as Row).id;
  }

  it('an Oracle failure stops before the database is touched, and the retry finishes the job', async () => {
    const id = await due();
    fake.fail.oracle = true;
    expect(await runAccountErasure(id)).toMatchObject({ status: 'processing', failedStep: 'oracle', accountErased: false });
    expect(fake.calls.some((c) => c.includes('erase_account_data'))).toBe(false);
    expect(fake.rows[0]!.last_error).toBe('oracle: status 503');
    expect(fake.audits.some((a) => a.action === 'account.deletion_step_failed')).toBe(true);
    fake.fail.oracle = false;
    fake.rows[0]!.started_at = new Date(Date.now() - 11 * 60_000).toISOString();
    expect(await runAccountErasure(id)).toMatchObject({ status: 'completed', accountErased: true });
  });

  it('a failed Depot delete keeps exactly the remaining objects and completion waits for them', async () => {
    const id = await due();
    fake.depotPaths = [`task-evidence/${'e'.repeat(64)}.jpg`, `badges/${'b'.repeat(64)}.png`];
    fake.fail.depot = true;
    expect(await runAccountErasure(id)).toMatchObject({ status: 'processing', failedStep: 'depot', accountErased: true });
    expect(fake.rows[0]!.depot_paths).toHaveLength(2);
    expect(fake.rows[0]!.status).toBe('processing');
    fake.fail.depot = false;
    fake.rows[0]!.started_at = new Date(Date.now() - 11 * 60_000).toISOString();
    expect(await runAccountErasure(id)).toMatchObject({ status: 'completed' });
    expect(fake.calls.filter((c) => c.includes('rpc/erase_account_data'))).toHaveLength(1);
  });

  it('a warehouse failure leaves the request processing; the core step is not repeated', async () => {
    const id = await due();
    fake.fail.dataintel = true;
    expect(await runAccountErasure(id)).toMatchObject({ status: 'processing', failedStep: 'dataintel' });
    expect(fake.rows[0]!.status).toBe('processing');
    fake.fail.dataintel = false;
    fake.rows[0]!.started_at = new Date(Date.now() - 11 * 60_000).toISOString();
    expect(await runAccountErasure(id)).toMatchObject({ status: 'completed' });
    expect(fake.calls.filter((c) => c.includes('rpc/erase_account_data'))).toHaveLength(1);
  });

  it('an open safety review holds the erasure and nothing is erased', async () => {
    const id = await due();
    fake.openCase.add(fake.rows[0]!.subject_id);
    expect(await runAccountErasure(id)).toMatchObject({ status: 'held', accountErased: false });
    expect(fake.calls.some((c) => c.includes('oracle.test'))).toBe(false);
    expect(fake.accounts.has(fake.rows[0]!.subject_id)).toBe(true);
  });

  it('a database failure is recorded and nothing downstream runs', async () => {
    const id = await due();
    fake.fail.core = true;
    expect(await runAccountErasure(id)).toMatchObject({ status: 'processing', failedStep: 'core', accountErased: false });
    expect(fake.calls.some((c) => c.includes('/api/v1/files/') || c.includes('/intel/erasure'))).toBe(false);
  });
});

describe('the daily sweep (POST /api/v1/internal/account-deletions/run)', () => {
  const sweep = (key: string | null = getConfig().INTERNAL_API_KEY, body: unknown = {}) => {
    const req = request(createApp()).post('/api/v1/internal/account-deletions/run');
    if (key) req.set('x-internal-api-key', key);
    return req.send(body as object);
  };

  it('is internal-key only (a session, even staff, is refused)', async () => {
    expect((await sweep(null)).status).toBe(403);
    expect((await sweep('wrong-key-wrong-key')).status).toBe(403);
    const staff = person({ roles: ['superadmin'], band: 'adult' });
    const res = await request(createApp()).post('/api/v1/internal/account-deletions/run').set(as(staff)).send({});
    expect(res.status).toBe(403);
  });

  it('runs due requests only, audits every run, and never touches a request still in its grace period', async () => {
    const waiting = person({ roles: ['universal'], band: 'adult', email: 'w@example.com' });
    await del(as(waiting, { amr: fresh() }));
    const res = await sweep();
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ scanned: 0, completed: 0 });
    expect(fake.audits.filter((a) => a.action === 'account_deletions.sweep_ran')).toHaveLength(1);
    fake.rows[0]!.scheduled_for = new Date(Date.now() - 1000).toISOString();
    const second = await sweep();
    expect(second.body.data).toMatchObject({ scanned: 1, completed: 1 });
    expect(fake.accounts.has(waiting)).toBe(false);
  });

  it('a queue of held requests never starves a due erasure', async () => {
    for (let i = 0; i < 3; i += 1) {
      const heldSubject = person({ roles: ['universal'], band: 'adult' });
      fake.openCase.add(heldSubject);
      fake.rows.push({
        id: randomUUID(), subject_id: heldSubject, population: 'adult', initiated_by: 'self', status: 'held',
        requested_at: new Date(Date.now() - 30 * 86_400_000).toISOString(), scheduled_for: new Date(Date.now() - 16 * 86_400_000).toISOString(),
        started_at: null, attempts: 0, held_reason: 'open_safety_review', steps: {}, depot_paths: [], anon_ids: [], last_error: null,
        cancelled_at: null, completed_at: null,
      });
    }
    const dueSubject = person({ roles: ['universal'], band: 'adult', email: 'd@example.com' });
    await del(as(dueSubject, { amr: fresh() }));
    fake.rows.find((r) => r.subject_id === dueSubject)!.scheduled_for = new Date(Date.now() - 1000).toISOString();
    const res = await sweep(undefined, { limit: 2 });
    expect(res.body.data).toMatchObject({ scanned: 2, completed: 1, held: 1 });
    expect(fake.accounts.has(dueSubject)).toBe(false);
  });

  it('an unreadable request list is a 502, never "nothing to do"', async () => {
    fake.fail.deletionRead = true;
    expect((await sweep()).status).toBe(502);
  });

  describe('A.1: a child paused 90 days is erased without signing in again (F3-identity-site)', () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

    it('erases an expired suspension through the E.6 lifecycle, audited, with no session involved', async () => {
      const kid = person({ roles: ['kid'], band: null });
      fake.suspended.set(kid, daysAgo(91));
      const res = await sweep();
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ suspensionsExpired: 1, suspensionsErased: 1, suspensionsKept: 0 });
      expect(fake.accounts.has(kid)).toBe(false);
      expect(fake.rows.find((r) => r.subject_id === kid)).toMatchObject({ population: 'kid', initiated_by: 'suspension_expiry', status: 'completed' });
      expect(fake.suspensionArgs[0]).toMatchObject({ p_older_than_days: 90 });
      const ran = fake.audits.find((a) => a.action === 'account_deletions.sweep_ran');
      expect(ran?.detail).toMatchObject({ suspensionsExpired: 1, suspensionsErased: 1 });
      expect(fake.calls.some((c) => c.includes('/auth/v1/token'))).toBe(false);
    });

    it('keeps a child paused less than 90 days', async () => {
      const kid = person({ roles: ['kid'], band: null });
      fake.suspended.set(kid, daysAgo(89));
      const res = await sweep();
      expect(res.body.data).toMatchObject({ suspensionsExpired: 0, suspensionsErased: 0 });
      expect(fake.accounts.has(kid)).toBe(true);
    });

    it('keeps a child a Tutor linked again, even if the candidate list still named it', async () => {
      const kid = person({ roles: ['kid'], band: null });
      fake.suspended.set(kid, daysAgo(120));
      fake.kidLinks.set(kid, [randomUUID()]);
      const res = await sweep();
      expect(res.body.data).toMatchObject({ suspensionsExpired: 1, suspensionsErased: 0, suspensionsKept: 1 });
      expect(fake.accounts.has(kid)).toBe(true);
      expect(fake.calls.some((c) => c.includes('rpc/request_account_deletion'))).toBe(false);
    });

    it('never erases when the link set cannot be read', async () => {
      const kid = person({ roles: ['kid'], band: null });
      fake.suspended.set(kid, daysAgo(120));
      fake.fail.links = true;
      const res = await sweep();
      expect(res.body.data).toMatchObject({ suspensionsExpired: 1, suspensionsErased: 0, suspensionsKept: 1 });
      expect(fake.accounts.has(kid)).toBe(true);
      expect(fake.calls.some((c) => c.includes('rpc/request_account_deletion') || c.includes('rpc/erase_account_data'))).toBe(false);
    });

    it('an unreadable candidate list still runs the due requests, then answers 502 and records no suspension coverage', async () => {
      const waiting = person({ roles: ['universal'], band: 'adult', email: 'w2@example.com' });
      await del(as(waiting, { amr: fresh() }));
      fake.rows[0]!.scheduled_for = new Date(Date.now() - 1000).toISOString();
      fake.fail.suspensions = true;
      const res = await sweep();
      expect(res.status).toBe(502);
      expect(fake.accounts.has(waiting)).toBe(false);
      const ran = fake.audits.find((a) => a.action === 'account_deletions.sweep_ran');
      expect(ran?.detail).toMatchObject({ suspensionsUnreadable: true, completed: 1 });
      expect(ran?.detail).not.toHaveProperty('suspensionsExpired');
    });
  });
});
