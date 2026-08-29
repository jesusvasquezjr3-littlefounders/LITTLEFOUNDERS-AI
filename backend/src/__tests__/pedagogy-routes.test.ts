import { afterEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { buildSessionPlan, difficultyFor } from '../services/pedagogy/sessionPlan.js';
import { buildTutorMap, deriveNodeState } from '../services/pedagogy/tutorMap.js';

/*
 * The v3 brain's Core wiring: the session plan on the internal context, the
 * pedagogy join on the grade route, and the deterministic voice-check.
 */

const KID = '11111111-1111-4111-8111-111111111111';
const SESSION = '33333333-3333-4333-8333-333333333333';
const SEGMENT = '44444444-4444-4444-8444-444444444444';
const KC_COUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const KC_CHANGE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const MIS_ADD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

const KC_ROWS = [
  {
    id: KC_COUNT,
    key: 'money.count-mixed-coins',
    strand: 'money_math',
    title: { 'es-MX': 'Contar dinero mezclado' },
    objective: { 'es-MX': 'Encontrar el total de monedas mezcladas.' },
    tier_min: 1,
    p_l0: 0.25,
    p_t: 0.15,
    p_g: 0.2,
    p_s: 0.1,
    skill_key: null,
    status: 'active',
  },
  {
    id: KC_CHANGE,
    key: 'money.make-change-counting-up',
    strand: 'money_math',
    title: { 'es-MX': 'Dar cambio' },
    objective: { 'es-MX': 'Dar el cambio contando hacia arriba.' },
    tier_min: 2,
    p_l0: 0.15,
    p_t: 0.13,
    p_g: 0.1,
    p_s: 0.1,
    skill_key: null,
    status: 'active',
  },
];

const EDGE_ROWS = [{ prerequisite_kc_id: KC_COUNT, dependent_kc_id: KC_CHANGE }];

const MISCONCEPTION_ROWS = [
  {
    id: MIS_ADD,
    kc_id: KC_CHANGE,
    code: 'adds-instead-of-counts-up',
    remediation_hint: { 'es-MX': 'Cuenta hacia arriba desde el precio.' },
    distractor_patterns: { numeric: ['a+b'] },
  },
];

const SESSION_ROW = {
  id: SESSION,
  user_id: KID,
  locale: 'es-MX',
  tier: 2,
  character: 'rho',
  companion: null,
  diorama: 'diorama-a',
  intent: 'course_topic',
  course_id: null,
  topic_id: null,
  skill_key: null,
  voice_used: false,
  consent_id: null,
  started_at: '2026-08-28T10:00:00Z',
  ended_at: null,
  close_reason: null,
  turn_count: 0,
  segment_count: 0,
  xp_awarded: 0,
  cost_usd: 0,
};

/** number_input segment served for the change-making KC: price 7, paid 10 → 3. */
const CHANGE_SEGMENT_ROW = {
  id: SEGMENT,
  session_id: SESSION,
  seq: 0,
  origin: 'catalog',
  lesson_id: null,
  segment_type: 'number_input',
  payload: {
    id: 'seg-change-1',
    type: 'number_input',
    prompt_md: 'Cuesta 7 y pagan con 10. ¿Cuánto cambio das?',
    difficulty: 2,
    xp: 20,
    payload: { price: 7, paid: 10 },
  },
  answer: { value: 3, tolerance: 0 },
  key_verified: true,
  score: null,
  xp_awarded: 0,
  attempts: 0,
  provenance: { kc_id: KC_CHANGE, strategy: 'SOCRATIC' },
  review_status: null,
  created_at: '2026-08-28T10:01:00Z',
};

interface StubOpts {
  mastery?: unknown[];
  cards?: unknown[];
  writes?: { url: string; method: string; body?: string }[];
}

function stub(opts: StubOpts = {}) {
  const writes = opts.writes ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method !== 'GET') writes.push({ url, method, body: init?.body as string | undefined });

      if (url.includes('/rest/v1/kc_edge')) return Promise.resolve(jsonResponse(200, EDGE_ROWS));
      if (url.includes('/rest/v1/kc_attempt')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/rest/v1/kc?')) {
        if (url.includes('id=eq.')) {
          const row = KC_ROWS.find((k) => url.includes(k.id));
          return Promise.resolve(jsonResponse(200, row ? [row] : []));
        }
        return Promise.resolve(jsonResponse(200, KC_ROWS));
      }
      if (url.includes('/rest/v1/misconception')) return Promise.resolve(jsonResponse(200, MISCONCEPTION_ROWS));
      if (url.includes('/rest/v1/learner_kc_mastery')) {
        if (method === 'POST') return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(jsonResponse(200, opts.mastery ?? []));
      }
      if (url.includes('/rest/v1/memory_card')) {
        if (method === 'POST') return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(jsonResponse(200, opts.cards ?? []));
      }
      if (url.includes('/rest/v1/learner_misconception')) {
        return Promise.resolve(method === 'GET' ? jsonResponse(200, []) : new Response(null, { status: 204 }));
      }
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, [{ role: 'kid' }]));
      if (url.includes('/rest/v1/tutor_segments')) {
        if (url.includes('?id=eq.')) return Promise.resolve(jsonResponse(200, [CHANGE_SEGMENT_ROW]));
        if (method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(jsonResponse(200, []));
      }
      if (url.includes('/rest/v1/tutor_sessions')) {
        if (url.includes('?id=eq.')) return Promise.resolve(jsonResponse(200, [SESSION_ROW]));
        if (method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(jsonResponse(200, []));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
  return writes;
}

afterEach(() => vi.unstubAllGlobals());

describe('buildSessionPlan', () => {
  it('opens the frontier only where prerequisites are met, and respects tier', async () => {
    stub();
    const result = await buildSessionPlan(KID, 2, 'es-MX');
    expect(result).not.toBeNull();
    // Counting has no prereqs → frontier. Change-making's prereq (counting at
    // p_l0 0.25) is unmet → NOT in the plan.
    const keys = result!.plan.map((p) => p.kcKey);
    expect(keys).toContain('money.count-mixed-coins');
    expect(keys).not.toContain('money.make-change-counting-up');
  });

  it('a tier-1 learner never sees a tier-2 KC even with prereqs met', async () => {
    stub({ mastery: [{ kc_id: KC_COUNT, p_known: 0.95, attempts: 8, correct: 8, params_override: null }] });
    const result = await buildSessionPlan(KID, 1, 'es-MX');
    expect(result!.plan.map((p) => p.kcKey)).not.toContain('money.make-change-counting-up');
  });

  it('mastered prerequisites open the dependent, review debt comes first', async () => {
    stub({
      mastery: [{ kc_id: KC_COUNT, p_known: 0.95, attempts: 8, correct: 8, params_override: null }],
      cards: [
        {
          kc_id: KC_COUNT,
          state: 'review',
          stability: 3,
          difficulty: 5,
          reps: 2,
          lapses: 0,
          due_at: '2026-08-01T00:00:00Z', // overdue
          last_review_at: '2026-07-29T00:00:00Z',
        },
      ],
    });
    const result = await buildSessionPlan(KID, 2, 'es-MX');
    expect(result!.plan[0]).toMatchObject({ kcKey: 'money.count-mixed-coins', reason: 'review_due' });
    const change = result!.plan.find((p) => p.kcKey === 'money.make-change-counting-up');
    expect(change).toMatchObject({ reason: 'frontier', prereqKcIds: [KC_COUNT] });
    expect(change!.misconceptions[0]).toMatchObject({ code: 'adds-instead-of-counts-up' });
    expect(change!.objective).toContain('cambio');
  });

  it('a review-debt card that overflows MAX_REVIEW is DROPPED, never relabeled frontier', async () => {
    // Three independent KCs (no edges, no mastery), all overdue for review.
    // MAX_REVIEW caps review_due entries at 2 — the KC bumped by the cap must
    // not silently reappear one line down as 'frontier': that reports a
    // reason to the learner ("this is new ground") which is not why it was
    // chosen, and it steals a frontier slot that should go to genuinely new
    // material.
    const overflowKc = (id: string, key: string) => ({
      id,
      key,
      strand: 'money_math',
      title: { 'es-MX': key },
      objective: { 'es-MX': key },
      tier_min: 1,
      p_l0: 0.25,
      p_t: 0.15,
      p_g: 0.2,
      p_s: 0.1,
      skill_key: null,
      status: 'active',
    });
    const overdueCard = (kcId: string) => ({
      kc_id: kcId,
      state: 'review',
      stability: 3,
      difficulty: 5,
      reps: 2,
      lapses: 0,
      due_at: '2020-01-01T00:00:00Z',
      last_review_at: '2019-12-01T00:00:00Z',
    });
    const K1 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
    const K2 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2';
    const K3 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3';
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        if (url.includes('/rest/v1/kc_edge')) return Promise.resolve(jsonResponse(200, []));
        if (url.includes('/rest/v1/kc?')) {
          return Promise.resolve(jsonResponse(200, [overflowKc(K1, 'k1'), overflowKc(K2, 'k2'), overflowKc(K3, 'k3')]));
        }
        if (url.includes('/rest/v1/misconception')) return Promise.resolve(jsonResponse(200, []));
        if (url.includes('/rest/v1/learner_kc_mastery')) return Promise.resolve(jsonResponse(200, []));
        if (url.includes('/rest/v1/memory_card')) {
          return Promise.resolve(jsonResponse(200, [overdueCard(K1), overdueCard(K2), overdueCard(K3)]));
        }
        void method;
        return Promise.resolve(jsonResponse(200, []));
      }),
    );
    const result = await buildSessionPlan(KID, 2, 'es-MX');
    expect(result!.plan.map((p) => p.reason)).toEqual(['review_due', 'review_due']);
    expect(result!.plan.find((p) => p.kcKey === 'k3')).toBeUndefined();
  });

  it('an empty catalog yields an empty plan, not a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(200, []))),
    );
    const result = await buildSessionPlan(KID, 2, 'es-MX');
    expect(result).toEqual({ plan: [], kcStates: [] });
  });

  it('difficultyFor maps predicted success into bands', () => {
    expect(difficultyFor(0.95)).toBe(4);
    expect(difficultyFor(0.75)).toBe(3);
    expect(difficultyFor(0.6)).toBe(2);
    expect(difficultyFor(0.3)).toBe(1);
  });
});

describe('the learning map', () => {
  it('deriveNodeState covers the five states, review outranking mastery', () => {
    expect(deriveNodeState({ pKnown: 0.9, attempts: 5, reviewDue: true, prereqsMet: true })).toBe('needs_review');
    expect(deriveNodeState({ pKnown: 0.9, attempts: 5, reviewDue: false, prereqsMet: true })).toBe('mastered');
    expect(deriveNodeState({ pKnown: 0.9, attempts: 1, reviewDue: false, prereqsMet: true })).toBe('in_progress');
    expect(deriveNodeState({ pKnown: 0.2, attempts: 0, reviewDue: false, prereqsMet: false })).toBe('locked');
    expect(deriveNodeState({ pKnown: 0.2, attempts: 0, reviewDue: false, prereqsMet: true })).toBe('available');
  });

  it('locks the dependent while its prerequisite is unmastered, and CONTINUE follows the planner', async () => {
    stub();
    const map = await buildTutorMap(KID, 2, 'es-MX');
    expect(map).not.toBeNull();
    const change = map!.nodes.find((n) => n.kcKey === 'money.make-change-counting-up');
    expect(change?.state).toBe('locked');
    const count = map!.nodes.find((n) => n.kcKey === 'money.count-mixed-coins');
    expect(count?.state).toBe('available');
    expect(count?.title).toBe('Contar dinero mezclado');
    expect(map!.continueTarget?.kcKey).toBe('money.count-mixed-coins');
    expect(map!.edges).toContainEqual({ from: 'money.count-mixed-coins', to: 'money.make-change-counting-up' });
  });

  it('a mastered prerequisite opens the dependent on the map too', async () => {
    stub({ mastery: [{ kc_id: KC_COUNT, p_known: 0.9, attempts: 5, correct: 5, params_override: null }] });
    const map = await buildTutorMap(KID, 2, 'es-MX');
    expect(map!.nodes.find((n) => n.kcKey === 'money.count-mixed-coins')?.state).toBe('mastered');
    expect(map!.nodes.find((n) => n.kcKey === 'money.make-change-counting-up')?.state).toBe('available');
  });
});

describe('the grade route pedagogy join', () => {
  it('a wrong answer matching a+b is diagnosed and the echo is signed', async () => {
    const writes = stub();
    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ answer: { value: 17 }, attemptNumber: 1 });

    expect(response.status).toBe(200);
    const pedagogy = response.body.data.pedagogy;
    expect(pedagogy).toMatchObject({
      kcId: KC_CHANGE,
      correct: false,
      misconceptionCode: 'adds-instead-of-counts-up',
    });
    expect(pedagogy.pKnownAfter).toBeLessThan(0.15 + 0.13); // went down from the prior region

    // The echo verifies under the shared TUTOR_SESSION_SECRET.
    const [prefix, body, sig] = (pedagogy.echo as string).split('.');
    expect(prefix).toBe('ge1');
    const expected = crypto
      .createHmac('sha256', process.env.TUTOR_SESSION_SECRET as string)
      .update(`${prefix}.${body}`)
      .digest('base64url');
    expect(sig).toBe(expected);
    const payload = JSON.parse(Buffer.from(body as string, 'base64url').toString('utf8'));
    expect(payload).toMatchObject({ segmentId: SEGMENT, kcId: KC_CHANGE, correct: false });

    // Evidence landed: mastery upsert + memory card + kc_attempt.
    const tables = writes.map((w) => w.url);
    expect(tables.some((u) => u.includes('learner_kc_mastery'))).toBe(true);
    expect(tables.some((u) => u.includes('memory_card'))).toBe(true);
    expect(tables.some((u) => u.includes('kc_attempt'))).toBe(true);
  });

  it('a correct answer raises the posterior', async () => {
    stub();
    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ answer: { value: 3 }, attemptNumber: 1 });

    const pedagogy = response.body.data.pedagogy;
    expect(pedagogy.correct).toBe(true);
    expect(pedagogy.misconceptionCode).toBeNull();
    expect(pedagogy.pKnownAfter).toBeGreaterThan(0.15);
    expect(typeof pedagogy.reviewDueAt).toBe('string');
  });
});

describe('the internal voice-check', () => {
  const key = () => process.env.INTERNAL_API_KEY as string;

  it('grades a spoken correct answer deterministically', async () => {
    stub();
    const response = await request(createApp())
      .post(`/api/v1/tutor/internal/segments/${SEGMENT}/voice-check`)
      .set('x-internal-api-key', key())
      .send({ sessionId: SESSION, utterance: 'son tres pesos', strategy: 'SOCRATIC' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      checkable: true,
      recognized: true,
      value: 3,
      correct: true,
    });
    expect(response.body.data.pKnownAfter).toBeGreaterThan(0.15);
  });

  it('diagnoses a spoken wrong answer (diecisiete = 7 + 10)', async () => {
    stub();
    const response = await request(createApp())
      .post(`/api/v1/tutor/internal/segments/${SEGMENT}/voice-check`)
      .set('x-internal-api-key', key())
      .send({ sessionId: SESSION, utterance: 'diecisiete' });

    expect(response.body.data).toMatchObject({
      recognized: true,
      correct: false,
      misconceptionCode: 'adds-instead-of-counts-up',
    });
  });

  it('an unparseable utterance is a no-op, never a wrong answer', async () => {
    const writes = stub();
    const response = await request(createApp())
      .post(`/api/v1/tutor/internal/segments/${SEGMENT}/voice-check`)
      .set('x-internal-api-key', key())
      .send({ sessionId: SESSION, utterance: 'no sé, explícame otra vez' });

    expect(response.body.data).toMatchObject({ checkable: true, recognized: false });
    // Nothing was written: no mastery update, no attempt row.
    expect(writes.some((w) => w.url.includes('learner_kc_mastery'))).toBe(false);
    expect(writes.some((w) => w.url.includes('kc_attempt'))).toBe(false);
  });

  it('refuses a segment from a different session', async () => {
    stub();
    const response = await request(createApp())
      .post(`/api/v1/tutor/internal/segments/${SEGMENT}/voice-check`)
      .set('x-internal-api-key', key())
      .send({ sessionId: '99999999-9999-4999-8999-999999999999', utterance: 'tres' });
    expect(response.status).toBe(403);
  });

  it('is not reachable with a user session token', async () => {
    stub();
    const response = await request(createApp())
      .post(`/api/v1/tutor/internal/segments/${SEGMENT}/voice-check`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ sessionId: SESSION, utterance: 'tres' });
    expect(response.status).toBe(403);
  });
});
