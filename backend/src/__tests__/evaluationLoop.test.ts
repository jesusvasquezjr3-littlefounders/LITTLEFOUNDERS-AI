import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { runEvaluationPass, upsertFlags } from '../services/pedagogy/evaluationLoop.js';
import { TRANSCRIPT_RUBRIC_HASH } from '../services/pedagogy/transcriptRubric.js';
import { resetLiveContentGateCache } from '../services/pedagogy/liveContentGovernance.js';

/*
 * S06.13 — C.21 / C.24: the evaluation pass against a fetch-stubbed
 * PostgREST. It scores the backlog and stamps the sessions, never scores a
 * session whose rows could not all be read, writes nothing in a dry run,
 * opens and refreshes flags, records its run and snapshot, and its internal
 * route refuses anything without the internal key.
 */

const NOW = new Date('2026-09-25T12:00:00Z');
const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';

interface Call { url: string; method: string; body?: string }

interface World {
  backlog?: unknown[];
  failHonesty?: boolean;
  failRunInsert?: boolean;
  activeFlags?: unknown[];
  scoresStore?: unknown[];
  /** GAP-FIX-R3: the mentor_age_calibration_coverage answer and the canary-arm sessions. */
  ageCoverage?: unknown[];
  canaryArms?: unknown[];
}

function stubPostgrest(world: World, calls: Call[]) {
  const scores = world.scoresStore ?? [];
  let backlogServed = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = decodeURIComponent(String(input));
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      if (headers.get('Prefer')?.includes('count=exact')) {
        return Promise.resolve(new Response('[]', { status: 206, headers: { 'Content-Range': `0-0/${(world.backlog ?? []).length}` } }));
      }
      if (url.includes('/rest/v1/tutor_sessions?select=id,character,tier,locale,close_reason')) {
        const out = backlogServed ? [] : world.backlog ?? [];
        backlogServed = true;
        return Promise.resolve(jsonResponse(200, out));
      }
      if (url.includes('/rest/v1/tutor_sessions') && method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
      if (url.includes('/rest/v1/tutor_turns')) {
        return Promise.resolve(jsonResponse(200, [
          { session_id: S1, seq: 0, speaker: 'tutor', text: 'You seem frustrated. Let us try again.', source: 'model' },
          { session_id: S1, seq: 1, speaker: 'learner', text: 'ok', source: 'stt' },
          { session_id: S2, seq: 0, speaker: 'tutor', text: 'How many coins are left?', source: 'model' },
        ]));
      }
      if (url.includes('/rest/v1/tutor_turn_honesty')) {
        if (world.failHonesty) return Promise.resolve(jsonResponse(500, { message: 'down' }));
        return Promise.resolve(jsonResponse(200, [
          { session_id: S2, character: 'rho', turn_seq: 0, sequence_kind: 'none', hint_level: null, reveal_sanctioned: false, reveal_key_match: null, reveal_self_answered: false, reveal_phrase: false, false_affirmation_caught: false, false_affirmation_delivered: true, praise: 'generic' },
        ]));
      }
      if (url.includes('/rest/v1/tutor_transcript_score')) {
        if (method === 'POST') {
          scores.push(...(JSON.parse(String(init?.body)) as unknown[]));
          return Promise.resolve(new Response(null, { status: 201 }));
        }
        if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(jsonResponse(200, url.includes('session_ended_at=lt.') ? [] : scores));
      }
      if (url.includes('/rest/v1/mentor_quality_flag')) {
        if (method === 'GET') return Promise.resolve(jsonResponse(200, world.activeFlags ?? []));
        return Promise.resolve(new Response(null, { status: method === 'POST' ? 201 : 204 }));
      }
      if (url.includes('/rest/v1/tutor_evaluation_run')) {
        if (method === 'POST') return Promise.resolve(world.failRunInsert ? jsonResponse(500, {}) : jsonResponse(201, [{ id: 'run-1' }]));
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/rest/v1/mentor_quality_snapshot')) {
        if (method === 'POST') return Promise.resolve(jsonResponse(201, [{ id: 'snap-1' }]));
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/rest/v1/rpc/mentor_age_calibration_coverage')) return Promise.resolve(jsonResponse(200, world.ageCoverage ?? []));
      if (url.includes('/rest/v1/tutor_sessions?select=id,canary_proposal_id')) return Promise.resolve(jsonResponse(200, world.canaryArms ?? []));
      if (url.includes('/rest/v1/rpc/')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/rest/v1/')) return Promise.resolve(jsonResponse(200, []));
      throw new Error(`unexpected ${method} ${url}`);
    }),
  );
}

const backlog = [
  { id: S1, character: 'dina', tier: 1, locale: 'en-US', close_reason: 'completed', closing_script: 'completed', ended_at: '2026-09-25T10:00:00Z' },
  { id: S2, character: 'rho', tier: 3, locale: 'es-MX', close_reason: 'safety_stop', closing_script: 'completed', ended_at: '2026-09-25T10:30:00Z' },
];

afterEach(() => {
  vi.unstubAllGlobals();
  resetLiveContentGateCache();
});

describe('C.21 the evaluation pass', () => {
  it('scores the backlog, stamps each session with the rubric hash, flags what it found and records itself', async () => {
    const calls: Call[] = [];
    stubPostgrest({ backlog }, calls);
    const result = await runEvaluationPass({ now: NOW, trigger: 'operator' });
    expect(result.scoring).toMatchObject({ scored: 2, failed: 0, backlogBefore: 2 });
    const posted = JSON.parse(calls.find((c) => c.url.includes('tutor_transcript_score') && c.method === 'POST')!.body!) as Record<string, unknown>[];
    expect(posted.every((r) => r.rubric_hash === TRANSCRIPT_RUBRIC_HASH && r.scorer === 'rules')).toBe(true);
    // No text and no learner id leave the scorer.
    expect(posted.every((r) => !('text' in r) && !('user_id' in r))).toBe(true);
    expect(posted.find((r) => r.session_id === S1 && r.criterion === 'emotion_label')).toMatchObject({ outcome: 'fail', numerator: 1, denominator: 1 });
    expect(posted.find((r) => r.session_id === S2 && r.criterion === 'closing_script')).toMatchObject({ outcome: 'fail' });
    const stamp = calls.find((c) => c.url.includes('/tutor_sessions?id=in.') && c.method === 'PATCH')!;
    expect(stamp.url).toContain('evaluation_rubric_hash=is.null');
    expect(JSON.parse(stamp.body!)).toEqual({ evaluation_rubric_hash: TRANSCRIPT_RUBRIC_HASH });

    const flags = calls.filter((c) => c.url.includes('mentor_quality_flag') && c.method === 'POST').map((c) => JSON.parse(c.body!) as Record<string, unknown>);
    expect(flags.find((f) => f.signal_id === 'rubric.emotion_label')).toMatchObject({ kind: 'zero_tolerance', owner_role: 'safety_trust_lead', severity: 'urgent' });
    expect(flags.find((f) => f.signal_id === 'rubric.false_affirmation')).toMatchObject({ kind: 'zero_tolerance', owner_role: 'pedagogical_lead' });
    expect(flags.find((f) => f.signal_id === 'rubric.closing_script')).toMatchObject({ kind: 'zero_tolerance' });
    // The live-content judge starts uncalibrated: a breach for its owner, never hidden.
    expect(flags.find((f) => f.signal_id === 'judge.content_calibration')).toMatchObject({ owner_role: 'safety_trust_lead' });
    // C.23: so does the transcript judge (read from mentor_judge_calibration), urgently.
    expect(calls.some((c) => c.url.includes('/mentor_judge_calibration?') && c.method === 'GET')).toBe(true);
    expect(flags.find((f) => f.signal_id === 'transcript_judge.agreement')).toMatchObject({ owner_role: 'safety_trust_lead', severity: 'urgent' });

    const run = JSON.parse(calls.find((c) => c.url.includes('tutor_evaluation_run') && c.method === 'POST')!.body!) as Record<string, unknown>;
    expect(run).toMatchObject({ trigger: 'operator', scored: 2, failed: 0, rubric_hash: TRANSCRIPT_RUBRIC_HASH });
    const snapshot = JSON.parse(calls.find((c) => c.url.includes('mentor_quality_snapshot') && c.method === 'POST')!.body!) as { signals: { id: string }[]; schema_version: string };
    expect(snapshot.schema_version).toBe('mentor-quality.v1');
    expect(snapshot.signals.length).toBeGreaterThan(30);
    expect(result).toMatchObject({ runId: 'run-1', snapshotId: 'snap-1' });
    // Retention of the loop's own artifacts ran.
    expect(calls.filter((c) => c.method === 'DELETE').length).toBe(3);
  });

  it('GAP-FIX-R3: reads Age-Tier Calibration Coverage and the canary arms; a missed calibration opens an urgent flag for the Safety and Trust lead', async () => {
    const calls: Call[] = [];
    stubPostgrest({
      backlog: [],
      ageCoverage: [{ sessions: 50, unknown_age_sessions: 10, calibrated_before_start: 9, coverage: 0.9 }],
      canaryArms: [{ id: S1, canary_proposal_id: 'P-2026-10-01-latency-z', canary_arm: 'canary', ended_at: '2026-09-25T10:00:00Z' }],
    }, calls);
    await runEvaluationPass({ now: NOW, trigger: 'operator' });
    const rpc = calls.find((c) => c.url.includes('/rpc/mentor_age_calibration_coverage'));
    expect(Object.keys(JSON.parse(rpc!.body!))).toEqual(['p_from', 'p_to']);
    expect(calls.some((c) => c.url.includes('canary_proposal_id=not.is.null'))).toBe(true);
    const flags = calls.filter((c) => c.url.includes('mentor_quality_flag') && c.method === 'POST').map((c) => JSON.parse(c.body!) as Record<string, unknown>);
    expect(flags.find((f) => f.signal_id === 'safety.age_tier_calibration')).toMatchObject({ kind: 'threshold_breach', owner_role: 'safety_trust_lead', severity: 'urgent', requirement: 'C.1' });
    const snapshot = JSON.parse(calls.find((c) => c.url.includes('mentor_quality_snapshot') && c.method === 'POST')!.body!) as { signals: { id: string; reading?: { status: string } }[] };
    expect(snapshot.signals.map((s) => s.id)).toEqual(expect.arrayContaining(['safety.fracture_closure', 'safety.age_tier_calibration', 'canary.arm_comparison']));
  });

  it('scores NOTHING from a batch whose honesty ledger could not be read (a missing ledger would read as clean)', async () => {
    const calls: Call[] = [];
    stubPostgrest({ backlog, failHonesty: true }, calls);
    const result = await runEvaluationPass({ now: NOW, trigger: 'schedule' });
    expect(result.scoring).toMatchObject({ scored: 0, failed: 2 });
    expect(calls.some((c) => c.url.includes('tutor_transcript_score') && c.method === 'POST')).toBe(false);
    expect(calls.some((c) => c.url.includes('/tutor_sessions?id=in.') && c.method === 'PATCH')).toBe(false);
    expect(result.status).toBe('partial');
  });

  it('writes nothing at all in a dry run', async () => {
    const calls: Call[] = [];
    stubPostgrest({ backlog }, calls);
    const result = await runEvaluationPass({ now: NOW, trigger: 'operator', dryRun: true });
    expect(result.scoring.scored).toBe(2);
    expect(result.anomalies?.length).toBeGreaterThan(0);
    expect(calls.filter((c) => c.method !== 'GET' && !c.url.includes('/rpc/'))).toEqual([]);
  });

  it('refreshes the flag already active for an anomaly instead of opening a second one', async () => {
    const calls: Call[] = [];
    stubPostgrest({ activeFlags: [{ id: 'f-1', dedup_key: 'rubric.false_affirmation|zero_tolerance|all', seen_count: 4 }] }, calls);
    const out = await upsertFlags([
      { signalId: 'rubric.false_affirmation', kind: 'zero_tolerance', scope: 'all', value: 0.1, threshold: 0, owner: 'pedagogical_lead', requirement: 'C.18', severity: 'urgent', evidence: {} },
      { signalId: 'rubric.false_affirmation', kind: 'zero_tolerance', scope: 'all', value: 0.1, threshold: 0, owner: 'pedagogical_lead', requirement: 'C.18', severity: 'urgent', evidence: {} },
      { signalId: 'rubric.hint_repeat', kind: 'zero_tolerance', scope: 'all', value: 0.2, threshold: 0, owner: 'pedagogical_lead', requirement: 'C.13', severity: 'urgent', evidence: {} },
    ], NOW);
    expect(out).toEqual({ opened: 1, refreshed: 1, failed: 0 });
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toContain('id=eq.f-1');
    expect(patch.url).toContain('status=in.(open,acknowledged)');
    expect(JSON.parse(patch.body!)).toMatchObject({ seen_count: 5 });
  });

  it('answers failed when it cannot record its own run (so the workflow goes red)', async () => {
    stubPostgrest({ failRunInsert: true }, []);
    expect((await runEvaluationPass({ now: NOW, trigger: 'schedule' })).status).toBe('failed');
  });
});

describe('C.21 internal route POST /api/v1/tutor/internal/evaluation/run', () => {
  it('refuses a caller without the internal key, including a signed-in learner', async () => {
    const calls: Call[] = [];
    stubPostgrest({ backlog }, calls);
    expect((await request(createApp()).post('/api/v1/tutor/internal/evaluation/run').send({})).status).toBe(403);
    const learner = await request(createApp()).post('/api/v1/tutor/internal/evaluation/run')
      .set('Authorization', `Bearer ${mintToken()}`).send({});
    expect(learner.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it('runs one pass with the key, and validates the body', async () => {
    stubPostgrest({ backlog }, []);
    const bad = await request(createApp()).post('/api/v1/tutor/internal/evaluation/run')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string).send({ limit: 0 });
    expect(bad.status).toBe(400);
    const res = await request(createApp()).post('/api/v1/tutor/internal/evaluation/run')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string).send({ limit: 50 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ runId: 'run-1', scored: 2, backlogBefore: 2 });
    expect(['ok', 'partial']).toContain(res.body.data.status);
  });

  it('answers 502 when the pass could not record itself', async () => {
    stubPostgrest({ failRunInsert: true }, []);
    const res = await request(createApp()).post('/api/v1/tutor/internal/evaluation/run')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string).send({});
    expect(res.status).toBe(502);
  });
});
