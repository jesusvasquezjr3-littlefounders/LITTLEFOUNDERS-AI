import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';

/*
 * S06.13 — C.24: the Mentor-quality dashboard routes, adversarially. Every
 * population is tried directly against the API: no session, each learner
 * population (a parent-created under-13 kid, an independent teen, an adult,
 * a verified parent Tutor), staff without `view_analytics`, staff with it
 * but not named for the flag's role, and the named owner. The named-owner
 * rule is enforced by Core against the database; the UI never substitutes.
 */

const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const FLAG_ID = '44444444-4444-4444-8444-444444444444';
const TARGET_ID = '55555555-5555-4555-8555-555555555555';

interface World {
  roles?: string[];
  permissions?: string[];
  named?: string[];
  flag?: Record<string, unknown> | null;
  patchRows?: unknown[];
  existingReview?: boolean;
  failSnapshotRead?: boolean;
  targetRoles?: string[];
  targetPermissions?: string[];
  /** GAP-FIX-R2: the latest release audits and record_release_audit's answer. */
  audits?: unknown[];
  auditRpc?: { status: number; body: unknown };
}
interface Call { url: string; method: string; body?: string }

const FLAG = {
  id: FLAG_ID, signal_id: 'rubric.emotion_label', kind: 'zero_tolerance', requirement: 'C.9', owner_role: 'safety_trust_lead', severity: 'urgent',
  scope: 'all', metric_value: '0.0200', threshold: '0.0000', evidence: { sessions: 1 }, status: 'open', opened_at: '2026-09-24T00:00:00Z',
  last_seen_at: '2026-09-25T00:00:00Z', seen_count: 3, acknowledged_by: null, acknowledged_at: null, resolved_by: null, resolved_at: null, resolution_note: null,
};

function stub(world: World, calls: Call[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = decodeURIComponent(String(input));
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (url.includes('/rest/v1/user_roles')) {
        const roles = url.includes(`user_id=eq.${TARGET_ID}`) ? world.targetRoles ?? [] : world.roles ?? ['admin'];
        return Promise.resolve(jsonResponse(200, roles.map((role) => ({ role }))));
      }
      if (url.includes('/rest/v1/admin_permissions')) {
        const perms = url.includes(`user_id=eq.${TARGET_ID}`) ? world.targetPermissions ?? [] : world.permissions ?? ['view_analytics'];
        return Promise.resolve(jsonResponse(200, perms.map((permission) => ({ user_id: STAFF_ID, permission }))));
      }
      if (url.includes('/rest/v1/mentor_quality_owner')) {
        if (method === 'POST') return Promise.resolve(jsonResponse(201, [{ owner_role: 'pedagogical_lead', user_id: TARGET_ID }]));
        if (method === 'DELETE') return Promise.resolve(jsonResponse(200, []));
        if (url.includes('user_id=eq.')) {
          const role = /owner_role=eq\.([a-z_]+)/.exec(url)?.[1] ?? '';
          return Promise.resolve(jsonResponse(200, (world.named ?? []).includes(role) ? [{ user_id: STAFF_ID }] : []));
        }
        return Promise.resolve(jsonResponse(200, (world.named ?? []).map((r) => ({ owner_role: r, user_id: STAFF_ID, assigned_at: '2026-09-20T00:00:00Z' }))));
      }
      if (url.includes('/rest/v1/mentor_quality_flag')) {
        if (method === 'PATCH') return Promise.resolve(jsonResponse(200, world.patchRows ?? [{ id: FLAG_ID }]));
        if (url.includes(`id=eq.${FLAG_ID}`)) return Promise.resolve(jsonResponse(200, world.flag === null ? [] : [world.flag ?? FLAG]));
        if (url.includes('status=in.(open,acknowledged)')) return Promise.resolve(jsonResponse(200, url.includes('select=id&') ? [{ id: FLAG_ID }] : [FLAG]));
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/rest/v1/mentor_quality_snapshot')) {
        if (world.failSnapshotRead) return Promise.resolve(jsonResponse(500, {}));
        if (url.includes('select=id&')) return Promise.resolve(jsonResponse(200, [{ id: 'snap-1' }]));
        return Promise.resolve(jsonResponse(200, [{
          id: 'snap-1', computed_at: new Date(Date.now() - 3_600_000).toISOString(), window_days: 30, rubric_hash: 'a'.repeat(64),
          signals: [{ id: 'rubric.emotion_label', status: 'breach', value: 0.02, sample: 50, breakdown: [], detail: {}, sourceLatestAt: null }],
        }]));
      }
      if (url.includes('/rest/v1/tutor_evaluation_run')) {
        return Promise.resolve(jsonResponse(200, [{ started_at: '2026-09-25T11:17:00Z', finished_at: '2026-09-25T11:17:30Z', status: 'ok', scored: 12, failed: 0, backlog_before: 12, trigger: 'schedule' }]));
      }
      if (url.includes('/rest/v1/mentor_quality_review')) {
        if (method === 'POST') return Promise.resolve(new Response(null, { status: 201 }));
        if (url.includes('reviewer_id=eq.')) return Promise.resolve(jsonResponse(200, world.existingReview ? [{ id: 'r-1' }] : []));
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/rest/v1/profiles')) return Promise.resolve(jsonResponse(200, [{ user_id: STAFF_ID, display_name: 'Ana Staff' }]));
      if (url.includes('/rest/v1/audit_logs')) return Promise.resolve(new Response(null, { status: 201 }));
      if (url.includes('/rest/v1/release_audit_results')) return Promise.resolve(jsonResponse(200, world.audits ?? []));
      if (url.includes('/rest/v1/rpc/record_release_audit')) return Promise.resolve(jsonResponse(world.auditRpc?.status ?? 200, world.auditRpc?.body ?? 'recorded'));
      throw new Error(`unexpected ${method} ${url}`);
    }),
  );
}

const staff = () => `Bearer ${mintToken({ sub: STAFF_ID, email: 'staff@littlefounders.ai' })}`;
const dataCalls = (calls: Call[]) => calls.filter((c) => !c.url.includes('/user_roles') && !c.url.includes('/admin_permissions'));

afterEach(() => vi.unstubAllGlobals());

describe('S06.13 C.24 GET /api/v1/admin/mentor-quality', () => {
  it('serves the consolidated dashboard to staff with view_analytics', async () => {
    stub({ named: ['safety_trust_lead'] });
    const res = await request(createApp()).get('/api/v1/admin/mentor-quality').set('Authorization', staff());
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.freshness).toMatchObject({ stale: false, slaHours: 24 });
    expect(d.signals.find((s: { id: string }) => s.id === 'rubric.emotion_label')).toMatchObject({ ownerRole: 'safety_trust_lead', reading: { status: 'breach' } });
    // A signal the snapshot does not carry is present, with no reading: never dropped.
    expect(d.signals.find((s: { id: string }) => s.id === 'mastery.reversal_rate')).toMatchObject({ reading: null });
    // GAP-FIX-R2: streak anxiety is retired from the registry with its written reason.
    expect(d.signals.find((s: { id: string }) => s.id === 'engagement.streak_anxiety')).toBeUndefined();
    expect(d.retiredSignals.map((s: { id: string }) => s.id)).toEqual(['engagement.streak_anxiety']);
    expect(d.releaseAudits.kinds.map((k: { kind: string; ownerRole: string }) => `${k.kind}:${k.ownerRole}`))
      .toEqual(['dark_pattern:safety_trust_lead', 'variable_ratio:safety_trust_lead', 'reward_framing:pedagogical_lead']);
    // GAP-FIX-R1 C.24: session efficiency now reads learning_session_efficiency.
    expect(d.signals.find((s: { id: string }) => s.id === 'engagement.session_efficiency')).toMatchObject({ instrumented: 'yes' });
    expect(d.flags.active[0]).toMatchObject({ id: FLAG_ID, ownerRole: 'safety_trust_lead', severity: 'urgent', value: 0.02 });
    expect(d.owners).toEqual([expect.objectContaining({ role: 'safety_trust_lead', displayName: 'Ana Staff' })]);
    expect(d.reviews.missingRoles).toEqual(['pedagogical_lead', 'engineering_lead']);
    expect(d.viewerOwnerRoles).toEqual(['safety_trust_lead']);
    expect(d.rubric.criteria.length).toBe(12);
  });

  it('answers 502 on a failed read, never an empty calm dashboard', async () => {
    stub({ failSnapshotRead: true });
    const res = await request(createApp()).get('/api/v1/admin/mentor-quality').set('Authorization', staff());
    expect(res.status).toBe(502);
  });

  it('refuses every learner population, staff without view_analytics and no session, before any data read', async () => {
    const paths: [string, 'get' | 'post', object][] = [
      ['/mentor-quality', 'get', {}],
      [`/mentor-quality/flags/${FLAG_ID}/acknowledge`, 'post', {}],
      [`/mentor-quality/flags/${FLAG_ID}/resolve`, 'post', { note: 'root cause found and fixed' }],
      ['/mentor-quality/reviews', 'post', { role: 'pedagogical_lead' }],
      ['/mentor-quality/owners', 'post', { role: 'pedagogical_lead', userId: TARGET_ID, action: 'add' }],
    ];
    for (const [path, verb, body] of paths) {
      // Learners: a parent-created under-13 kid, an independent teen, an adult learner, a verified parent Tutor.
      for (const roles of [['kid'], ['universal'], ['parent']]) {
        const calls: Call[] = [];
        stub({ roles }, calls);
        const res = await request(createApp())[verb](`/api/v1/admin${path}`).set('Authorization', staff()).send(body);
        expect(res.status, `${path} ${roles}`).toBe(403);
        expect(dataCalls(calls), `${path} ${roles}`).toEqual([]);
      }
      const calls: Call[] = [];
      stub({ permissions: ['manage_content', 'manage_support'] }, calls);
      const noGrant = await request(createApp())[verb](`/api/v1/admin${path}`).set('Authorization', staff()).send(body);
      expect(noGrant.status, path).toBe(403);
      expect(dataCalls(calls), path).toEqual([]);
      expect((await request(createApp())[verb](`/api/v1/admin${path}`).send(body)).status, path).toBe(401);
    }
  });
});

describe('S06.13 C.24 flags: only a named owner of the flag\'s role acts', () => {
  const ack = () => request(createApp()).post(`/api/v1/admin/mentor-quality/flags/${FLAG_ID}/acknowledge`).set('Authorization', staff()).send({});
  const resolve = (note: string) => request(createApp()).post(`/api/v1/admin/mentor-quality/flags/${FLAG_ID}/resolve`).set('Authorization', staff()).send({ note });

  it('refuses staff with view_analytics who are not named for the role (no write happens)', async () => {
    const calls: Call[] = [];
    stub({ named: ['pedagogical_lead'] }, calls);
    const res = await ack();
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_NAMED_OWNER');
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    expect((await resolve('I think it is fine now')).status).toBe(403);
  });

  it('lets the named owner acknowledge an open flag, guarded on status, and audits it', async () => {
    const calls: Call[] = [];
    stub({ named: ['safety_trust_lead'] }, calls);
    const res = await ack();
    expect(res.status).toBe(200);
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toContain('status=eq.open');
    expect(JSON.parse(patch.body!)).toMatchObject({ status: 'acknowledged', acknowledged_by: STAFF_ID });
    expect(calls.find((c) => c.url.includes('audit_logs'))?.body).toContain('admin.mentor_quality.flag.acknowledge');
  });

  it('answers 409 when the flag changed meanwhile, and 404 for no such flag', async () => {
    stub({ named: ['safety_trust_lead'], patchRows: [] });
    expect((await ack()).status).toBe(409);
    stub({ named: ['safety_trust_lead'], flag: null });
    expect((await ack()).status).toBe(404);
  });

  it('requires the root cause in words to resolve, and records who and why', async () => {
    const calls: Call[] = [];
    stub({ named: ['safety_trust_lead'] }, calls);
    expect((await resolve('fixed')).status).toBe(400);
    expect((await request(createApp()).post(`/api/v1/admin/mentor-quality/flags/${FLAG_ID}/resolve`).set('Authorization', staff()).send({ note: 'long enough note', extra: 1 })).status).toBe(400);
    const res = await resolve('Prompt v3 labelled moods; reverted in release 2026-09-26.');
    expect(res.status).toBe(200);
    const body = JSON.parse(calls.find((c) => c.method === 'PATCH')!.body!);
    expect(body).toMatchObject({ status: 'resolved', resolved_by: STAFF_ID, acknowledged_by: STAFF_ID });
    expect(body.resolution_note).toMatch(/reverted/);
  });

  it('refuses a malformed flag id', async () => {
    stub({ named: ['safety_trust_lead'] });
    expect((await request(createApp()).post('/api/v1/admin/mentor-quality/flags/nope/acknowledge').set('Authorization', staff()).send({})).status).toBe(400);
  });
});

describe('S06.13 C.24 weekly owner review', () => {
  const review = (body: object) => request(createApp()).post('/api/v1/admin/mentor-quality/reviews').set('Authorization', staff()).send(body);

  it('lets only a named owner sign their role\'s weekly review, once per week', async () => {
    stub({ named: ['pedagogical_lead'] });
    expect((await review({ role: 'safety_trust_lead' })).status).toBe(403);
    const calls: Call[] = [];
    stub({ named: ['pedagogical_lead'] }, calls);
    const ok = await review({ role: 'pedagogical_lead', note: 'Read all signals; one flag acknowledged.' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.week).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const insert = JSON.parse(calls.find((c) => c.url.includes('mentor_quality_review') && c.method === 'POST')!.body!);
    expect(insert).toMatchObject({ owner_role: 'pedagogical_lead', reviewer_id: STAFF_ID, snapshot_id: 'snap-1', open_flags: 1 });
    stub({ named: ['pedagogical_lead'], existingReview: true });
    expect((await review({ role: 'pedagogical_lead' })).status).toBe(409);
    expect((await review({ role: 'chief' })).status).toBe(400);
  });
});

describe('S06.13 C.24 naming owners (manage_users)', () => {
  const name = (body: object) => request(createApp()).post('/api/v1/admin/mentor-quality/owners').set('Authorization', staff()).send(body);

  it('needs manage_users on top of view_analytics', async () => {
    const calls: Call[] = [];
    stub({ permissions: ['view_analytics'] }, calls);
    expect((await name({ role: 'pedagogical_lead', userId: TARGET_ID, action: 'add' })).status).toBe(403);
    expect(dataCalls(calls)).toEqual([]);
  });

  it('refuses to name someone who is not staff able to read analytics', async () => {
    stub({ permissions: ['view_analytics', 'manage_users'], targetRoles: ['universal'] });
    expect((await name({ role: 'pedagogical_lead', userId: TARGET_ID, action: 'add' })).status).toBe(422);
    stub({ permissions: ['view_analytics', 'manage_users'], targetRoles: ['admin'], targetPermissions: ['manage_content'] });
    expect((await name({ role: 'pedagogical_lead', userId: TARGET_ID, action: 'add' })).status).toBe(422);
  });

  it('names an eligible staff member and audits it; removing someone not named is a 409', async () => {
    const calls: Call[] = [];
    stub({ permissions: ['view_analytics', 'manage_users'], targetRoles: ['admin'], targetPermissions: ['view_analytics'] }, calls);
    const res = await name({ role: 'pedagogical_lead', userId: TARGET_ID, action: 'add' });
    expect(res.status).toBe(200);
    expect(calls.find((c) => c.url.includes('audit_logs'))?.body).toContain('admin.mentor_quality.owner.add');
    stub({ permissions: ['view_analytics', 'manage_users'] });
    expect((await name({ role: 'pedagogical_lead', userId: TARGET_ID, action: 'remove' })).status).toBe(409);
    expect((await name({ role: 'pedagogical_lead', userId: 'x', action: 'add' })).status).toBe(400);
  });
});

describe('GAP-FIX-R2 C.24 per-release manual audits (B.25, B.22, B.20)', () => {
  const body = { kind: 'dark_pattern', releaseId: 'release-2026.10', result: 'fail', findingCount: 2, note: 'Two countdown banners.' };

  it('records through Vault with the staff actor; Vault decides the named owner', async () => {
    const calls: Call[] = [];
    stub({ named: ['safety_trust_lead'] }, calls);
    const res = await request(createApp()).post('/api/v1/admin/mentor-quality/audits').set('Authorization', staff()).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ kind: 'dark_pattern', releaseId: 'release-2026.10', result: 'fail' });
    const rpc = calls.find((c) => c.url.includes('/rpc/record_release_audit'))!;
    expect(JSON.parse(rpc.body!)).toEqual({ p_actor: STAFF_ID, p_kind: 'dark_pattern', p_release_id: 'release-2026.10', p_result: 'fail', p_findings: 2, p_note: 'Two countdown banners.' });
  });

  it('maps a non-owner to 403, a repeat to 409 and an unreadable answer to 502', async () => {
    for (const [answer, status, code] of [['not_owner', 403, 'NOT_NAMED_OWNER'], ['duplicate', 409, 'ALREADY_RECORDED'], ['invalid', 400, 'VALIDATION_ERROR'], [null, 502, 'DATA_UNAVAILABLE']] as const) {
      stub({ auditRpc: answer === null ? { status: 500, body: null } : { status: 200, body: answer } });
      const res = await request(createApp()).post('/api/v1/admin/mentor-quality/audits').set('Authorization', staff()).send(body);
      expect(res.status, String(answer)).toBe(status);
      expect(res.body.error.code).toBe(code);
    }
  });

  it('refuses a fail without findings, a pass with findings, an unknown kind and a malformed release id, with no call', async () => {
    const calls: Call[] = [];
    stub({}, calls);
    for (const bad of [{ ...body, findingCount: 0 }, { ...body, result: 'pass' }, { ...body, kind: 'loot_box' }, { ...body, releaseId: 'no spaces' }, { ...body, extra: 1 }]) {
      expect((await request(createApp()).post('/api/v1/admin/mentor-quality/audits').set('Authorization', staff()).send(bad)).status).toBe(400);
    }
    expect(calls.some((c) => c.url.includes('/rpc/'))).toBe(false);
  });

  it('refuses staff without view_analytics before any call', async () => {
    const calls: Call[] = [];
    stub({ permissions: ['manage_support'] }, calls);
    expect((await request(createApp()).post('/api/v1/admin/mentor-quality/audits').set('Authorization', staff()).send(body)).status).toBe(403);
    expect(dataCalls(calls)).toEqual([]);
  });

  it('the dashboard carries the latest audit of each kind for the form', async () => {
    stub({ audits: [
      { audit_kind: 'reward_framing', release_id: 'r-9', result: 'pass', finding_count: 0, recorded_at: '2026-09-20T00:00:00Z' },
      { audit_kind: 'dark_pattern', release_id: 'r-9', result: 'fail', finding_count: '2', recorded_at: '2026-09-19T00:00:00Z' },
    ] });
    const res = await request(createApp()).get('/api/v1/admin/mentor-quality').set('Authorization', staff());
    expect(res.status).toBe(200);
    const kinds = Object.fromEntries(res.body.data.releaseAudits.kinds.map((k: { kind: string }) => [k.kind, k]));
    expect(kinds.dark_pattern.latest).toEqual({ releaseId: 'r-9', result: 'fail', findingCount: 2, recordedAt: '2026-09-19T00:00:00Z' });
    expect(kinds.variable_ratio.latest).toBeNull();
    expect(res.body.data.releaseAudits.cadenceDays).toBe(45);
  });
});
