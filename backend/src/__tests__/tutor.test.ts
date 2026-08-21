import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { jsonResponse, mintToken } from './helpers.js';
import { tierForBirthDate } from '../routes/tutor.js';

/*
 * The Tutor's Core surface (/ORACLE.md).
 *
 * The tests that matter most here are the ones about the microphone gate and
 * about XP, because those are the two places where a mistake harms someone
 * rather than merely annoying them: one opens a child's microphone without a
 * guardian's consent, the other writes progress the server could not verify.
 */

const KID = '11111111-1111-4111-8111-111111111111';
const PARENT = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';
const SEGMENT = '44444444-4444-4444-8444-444444444444';

const KID_PROFILE = {
  user_id: KID,
  display_name: 'Ana Vasquez',
  username: 'ana',
  locale: 'es-MX',
  theme: 'system',
  cover: {},
  birth_date: '2018-03-01',
  created_at: '2026-01-01T00:00:00Z',
};

const SESSION_ROW = {
  id: SESSION,
  user_id: KID,
  locale: 'es-MX',
  tier: 2,
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'course_topic',
  course_id: null,
  topic_id: null,
  skill_key: null,
  voice_used: false,
  consent_id: null,
  started_at: '2026-08-21T10:00:00Z',
  ended_at: null,
  close_reason: null,
  turn_count: 0,
  segment_count: 0,
  xp_awarded: 0,
  cost_usd: 0,
};

const MCQ_SEGMENT = {
  id: 'seg-1',
  type: 'quiz_mcq',
  prompt_md: '¿Cuánto juntas si ahorras 25 cada semana durante 4 semanas?',
  difficulty: 2,
  xp: 20,
  payload: {
    options: [
      { id: 'a', text_md: '100' },
      { id: 'b', text_md: '75', rationale_md: 'Eso son solo tres semanas.' },
      { id: 'c', text_md: '29', rationale_md: 'Sumaste en vez de multiplicar.' },
    ],
  },
};

interface StubOpts {
  roles?: { role: string }[];
  profile?: unknown;
  consent?: unknown[];
  sessions?: unknown[];
  session?: unknown[];
  segment?: unknown[];
  segments?: unknown[];
  guardianLinks?: unknown[];
  preferences?: unknown[];
  preflight?: unknown;
  insertedSession?: unknown[];
  restFailures?: string[];
  calls?: { url: string; method: string; body?: string }[];
}

function stub(opts: StubOpts = {}) {
  const calls = opts.calls ?? [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });

      for (const fragment of opts.restFailures ?? []) {
        if (url.includes(fragment)) return Promise.resolve(new Response(null, { status: 500 }));
      }

      if (url.includes('/api/v1/tutor/preflight')) {
        return Promise.resolve(
          jsonResponse(200, {
            data: opts.preflight ?? {
              canStart: true,
              blockedBy: null,
              voiceAvailable: true,
              microphoneAvailable: true,
            },
            error: null,
          }),
        );
      }
      if (url.includes('/rest/v1/user_roles')) return Promise.resolve(jsonResponse(200, opts.roles ?? [{ role: 'kid' }]));
      if (url.includes('/rest/v1/profiles')) return Promise.resolve(jsonResponse(200, [opts.profile ?? KID_PROFILE]));
      if (url.includes('/rest/v1/tutor_voice_consent')) {
        if (method === 'POST' || method === 'PATCH') return Promise.resolve(jsonResponse(200, opts.consent ?? []));
        return Promise.resolve(jsonResponse(200, opts.consent ?? []));
      }
      if (url.includes('/rest/v1/tutor_preferences')) {
        return Promise.resolve(jsonResponse(200, opts.preferences ?? []));
      }
      if (url.includes('/rest/v1/tutor_segments')) {
        if (method === 'POST') return Promise.resolve(jsonResponse(200, opts.segment ?? []));
        if (method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
        // '?id=eq.' and not 'id=eq.': the latter also matches
        // 'user_id=eq.' and 'session_id=eq.', so the single-row lookup would
        // swallow every list query.
        if (url.includes('?id=eq.')) return Promise.resolve(jsonResponse(200, opts.segment ?? []));
        return Promise.resolve(jsonResponse(200, opts.segments ?? []));
      }
      if (url.includes('/rest/v1/tutor_sessions')) {
        if (method === 'POST') return Promise.resolve(jsonResponse(200, opts.insertedSession ?? [SESSION_ROW]));
        if (method === 'PATCH') return Promise.resolve(new Response(null, { status: 204 }));
        if (url.includes('?id=eq.')) return Promise.resolve(jsonResponse(200, opts.session ?? [SESSION_ROW]));
        return Promise.resolve(jsonResponse(200, opts.sessions ?? []));
      }
      if (url.includes('/rest/v1/tutor_turns')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/rest/v1/tutor_safety_flags')) return Promise.resolve(jsonResponse(200, []));
      if (url.includes('/rest/v1/guardian_links')) {
        return Promise.resolve(jsonResponse(200, opts.guardianLinks ?? []));
      }
      if (url.includes('/intel/learning/states')) {
        return Promise.resolve(jsonResponse(200, { data: { states: [] }, error: null }));
      }
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('tierForBirthDate', () => {
  const now = new Date('2026-08-21T00:00:00Z');
  it.each([
    ['2020-01-01', 1],
    ['2018-01-01', 2],
    ['2010-01-01', 3],
  ])('maps %s to tier %i', (date, tier) => {
    expect(tierForBirthDate(date, now)).toBe(tier);
  });

  it('uses the middle band for an unknown birth date, never the adult band', () => {
    expect(tierForBirthDate(null, now)).toBe(2);
  });
});

describe('POST /api/v1/tutor/sessions — the microphone gate', () => {
  it('refuses the microphone for a kid with NO guardian consent', async () => {
    const calls = stub({
      roles: [{ role: 'kid' }],
      consent: [],
      preflight: {
        canStart: true,
        blockedBy: null,
        voiceAvailable: true,
        microphoneAvailable: true,
        minorVoicePolicy: 'allowed',
      },
    });

    const response = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ intent: 'course_topic', wantsVoice: true });

    expect(response.status).toBe(201);
    // The session still works — silent, captioned, fully usable. The refusal
    // is the microphone, not the tutor.
    expect(response.body.data.microphoneAvailable).toBe(false);
    expect(response.body.data.microphoneBlockedBy).toBe('CONSENT_REQUIRED');

    const insert = calls.find((c) => c.method === 'POST' && c.url.includes('tutor_sessions'));
    expect(JSON.parse(insert?.body ?? '{}').voice_used).toBe(false);
  });

  it('allows the microphone for a kid WITH active consent, once policy permits', async () => {
    stub({
      roles: [{ role: 'kid' }],
      consent: [{ id: '55555555-5555-4555-8555-555555555555', user_id: KID, granted_at: 'x', revoked_at: null }],
      preflight: {
        canStart: true,
        blockedBy: null,
        voiceAvailable: true,
        microphoneAvailable: true,
        minorVoicePolicy: 'allowed',
      },
    });

    const response = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ intent: 'course_topic', wantsVoice: true });

    expect(response.status).toBe(201);
    expect(response.body.data.microphoneAvailable).toBe(true);
  });

  it('does not require consent for an adult', async () => {
    stub({ roles: [{ role: 'universal' }], consent: [] });

    const response = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({ intent: 'open', wantsVoice: true });

    expect(response.body.data.microphoneAvailable).toBe(true);
    expect(response.body.data.microphoneBlockedBy).toBeNull();
  });

  it('refuses a kid the microphone while the DPA policy is BLOCKED, even with consent', async () => {
    stub({
      roles: [{ role: 'kid' }],
      consent: [{ id: '55555555-5555-4555-8555-555555555555', user_id: KID, granted_at: 'x', revoked_at: null }],
      preflight: {
        canStart: true,
        blockedBy: null,
        voiceAvailable: true,
        microphoneAvailable: false,
        minorVoicePolicy: 'blocked',
      },
    });

    const response = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ intent: 'course_topic', wantsVoice: true });

    expect(response.status).toBe(201);
    expect(response.body.data.microphoneAvailable).toBe(false);
    // POLICY, not CONSENT: consent IS granted here, and saying "ask a grown-up"
    // would send a family to fix something that is already fixed.
    expect(response.body.data.microphoneBlockedBy).toBe('POLICY_BLOCKED');
  });

  it('reports POLICY before CONSENT when neither is satisfied', async () => {
    stub({
      roles: [{ role: 'kid' }],
      consent: [],
      preflight: {
        canStart: true,
        blockedBy: null,
        voiceAvailable: true,
        microphoneAvailable: false,
        minorVoicePolicy: 'blocked',
      },
    });

    const response = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ intent: 'course_topic', wantsVoice: true });

    expect(response.body.data.microphoneBlockedBy).toBe('POLICY_BLOCKED');
  });

  it('does not apply the minor policy to an adult', async () => {
    stub({
      roles: [{ role: 'universal' }],
      preflight: {
        canStart: true,
        blockedBy: null,
        voiceAvailable: true,
        microphoneAvailable: true,
        minorVoicePolicy: 'blocked',
      },
    });

    const response = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({ intent: 'open', wantsVoice: true });

    // The DPA gates a CHILD's voice reaching a third party. It says nothing
    // about an adult's, and gating both would be a policy nobody chose.
    expect(response.body.data.microphoneAvailable).toBe(true);
    expect(response.body.data.microphoneBlockedBy).toBeNull();
  });

  it('refuses to start when Oracle says it cannot serve', async () => {
    stub({ preflight: { canStart: false, blockedBy: 'MODEL_UNAVAILABLE', voiceAvailable: false, microphoneAvailable: false } });

    const response = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ intent: 'course_topic' });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('MODEL_UNAVAILABLE');
  });

  it('enforces the daily session cap', async () => {
    stub({ sessions: [{ id: 'a' }, { id: 'b' }] });

    const response = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ intent: 'course_topic' });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('SESSION_LIMIT');
  });

  it('hands back a websocket URL carrying a session token, never a Supabase JWT', async () => {
    stub();

    const response = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ intent: 'course_topic' });

    const url: string = response.body.data.socketUrl;
    expect(url).toMatch(/^ws:\/\//);
    expect(url).toContain('/ws/tutor?token=');
    const token = decodeURIComponent(url.split('token=')[1] ?? '');
    expect(token.startsWith('v1.')).toBe(true);
    expect(token.startsWith('eyJ')).toBe(false);
  });
});

describe('consent', () => {
  it('lets ONLY a verified guardian grant it', async () => {
    stub({ guardianLinks: [] });

    const response = await request(createApp())
      .post('/api/v1/tutor/consent')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({
        kidUserId: KID,
        consentText: 'I allow my child to speak with the AI tutor using the microphone on this device.',
        locale: 'es-MX',
      });

    expect(response.status).toBe(403);
  });

  it('records the exact wording the guardian was shown', async () => {
    const wording = 'I allow my child to speak with the AI tutor using the microphone on this device.';
    const calls = stub({
      guardianLinks: [{ parent_user_id: PARENT, kid_user_id: KID, verification_status: 'verified' }],
      consent: [],
    });

    await request(createApp())
      .post('/api/v1/tutor/consent')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({ kidUserId: KID, consentText: wording, locale: 'es-MX' });

    const insert = calls.find((c) => c.method === 'POST' && c.url.includes('tutor_voice_consent'));
    // A dispute is resolved against what was on screen, not against whatever
    // the current build says.
    expect(JSON.parse(insert?.body ?? '{}').consent_text).toBe(wording);
  });

  it('lets a learner revoke their own consent', async () => {
    const calls = stub();
    const response = await request(createApp())
      .delete(`/api/v1/tutor/consent/${KID}`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`);

    expect(response.status).toBe(200);
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('tutor_voice_consent'));
    // The row is CLOSED, never deleted — "was consent active on date X" has to
    // stay answerable.
    expect(patch?.url).toContain('revoked_at=is.null');
    expect(JSON.parse(patch?.body ?? '{}').revoked_at).toBeTruthy();
  });
});

describe('grading a tutor segment', () => {
  const verifiedRow = {
    id: SEGMENT,
    session_id: SESSION,
    seq: 0,
    origin: 'live',
    lesson_id: null,
    segment_type: 'quiz_mcq',
    payload: MCQ_SEGMENT,
    answer: { correct_option_id: 'a' },
    key_verified: true,
    score: null,
    xp_awarded: 0,
    attempts: 0,
    provenance: {},
    review_status: null,
    created_at: 'x',
  };

  it('awards XP for a verified key', async () => {
    stub({ segment: [verifiedRow], sessions: [] });

    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ answer: { option_id: 'a' }, attemptNumber: 1 });

    expect(response.status).toBe(200);
    expect(response.body.data.verdict.score).toBe(100);
    expect(response.body.data.xpAwarded).toBe(20);
    expect(response.body.data.scoresXp).toBe(true);
  });

  it('awards NOTHING when the key could not be re-derived', async () => {
    // /ORACLE.md §8: a live segment whose key the server could not verify
    // still teaches, and must never pay progress.
    stub({ segment: [{ ...verifiedRow, key_verified: false }] });

    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ answer: { option_id: 'a' }, attemptNumber: 1 });

    expect(response.body.data.verdict.score).toBe(100);
    expect(response.body.data.xpAwarded).toBe(0);
    expect(response.body.data.scoresXp).toBe(false);
  });

  it('refuses to grade someone else’s segment', async () => {
    stub({ segment: [verifiedRow] });

    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({ answer: { option_id: 'a' } });

    expect(response.status).toBe(403);
  });

  it('never lets the answer key reach the client', async () => {
    stub({ segment: [verifiedRow] });

    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ answer: { option_id: 'b' } });

    expect(JSON.stringify(response.body)).not.toContain('correct_option_id');
  });

  it('refuses rather than defaulting when today’s XP total cannot be read', async () => {
    // §1.14 in its exact shape: defaulting "earned today" to zero on a
    // transient read failure would make the daily cap bypassable at will.
    stub({ segment: [verifiedRow], restFailures: ['started_at=gte'] });

    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ answer: { option_id: 'a' } });

    expect(response.status).toBe(502);
  });
});

describe('the internal surface', () => {
  it('is not reachable with a user session', async () => {
    stub();
    const response = await request(createApp())
      .get(`/api/v1/tutor/internal/sessions/${SESSION}`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`);
    expect(response.status).toBe(403);
  });

  it('hands Oracle the tier band and NEVER the birth date', async () => {
    stub({ roles: [{ role: 'kid' }] });

    const response = await request(createApp())
      .get(`/api/v1/tutor/internal/sessions/${SESSION}`)
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string);

    expect(response.status).toBe(200);
    expect(response.body.data.tier).toBe(2);
    expect(response.body.data.isMinor).toBe(true);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain('2018-03-01');
    expect(body).not.toContain('Ana Vasquez');
  });

  it('substitutes a neutral word when no nickname was chosen', async () => {
    stub({ preferences: [] });

    const response = await request(createApp())
      .get(`/api/v1/tutor/internal/sessions/${SESSION}`)
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string);

    // Never the display name: that is the back door §4.1 exists to close.
    expect(response.body.data.nickname).toBe('Explorador');
  });

  it('reports a degraded personalization read instead of pretending to know nothing', async () => {
    stub({ restFailures: ['/intel/learning/states'] });

    const response = await request(createApp())
      .get(`/api/v1/tutor/internal/sessions/${SESSION}`)
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string);

    expect(response.body.data.intelDegraded).toBe(true);
    expect(response.body.data.skillStates).toEqual([]);
  });

  it('refuses to open a session that has already ended', async () => {
    stub({ session: [{ ...SESSION_ROW, ended_at: '2026-08-21T10:30:00Z', close_reason: 'completed' }] });

    const response = await request(createApp())
      .get(`/api/v1/tutor/internal/sessions/${SESSION}`)
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string);

    expect(response.status).toBe(409);
  });

  it('rejects a generated segment whose own key does not score 100', async () => {
    stub();

    const response = await request(createApp())
      .post('/api/v1/tutor/internal/segments/verify')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({
        sessionId: SESSION,
        segment: { ...MCQ_SEGMENT, answer: { correct_option_id: 'does-not-exist' } },
        provenance: { model: 'test' },
      });

    expect(response.body.data.accepted).toBe(false);
    expect(String(response.body.data.failures)).toMatch(/does not exist exactly once|scores/);
  });

  it('rejects a generated segment of a type not on the allowlist', async () => {
    stub();

    const response = await request(createApp())
      .post('/api/v1/tutor/internal/segments/verify')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({
        sessionId: SESSION,
        segment: { ...MCQ_SEGMENT, type: 'robot_path' },
        provenance: {},
      });

    expect(response.body.data.accepted).toBe(false);
    expect(String(response.body.data.failures)).toContain('allowlist');
  });

  it('rejects a wrong option with no teaching rationale', async () => {
    stub();

    const response = await request(createApp())
      .post('/api/v1/tutor/internal/segments/verify')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({
        sessionId: SESSION,
        segment: {
          ...MCQ_SEGMENT,
          payload: {
            options: [
              { id: 'a', text_md: '100' },
              { id: 'b', text_md: '75' },
            ],
          },
          answer: { correct_option_id: 'a' },
        },
        provenance: {},
      });

    expect(response.body.data.accepted).toBe(false);
    expect(String(response.body.data.failures)).toContain('teaching rationale');
  });

  it('accepts and persists a well-formed generated segment, stripped', async () => {
    stub({
      segment: [
        {
          id: SEGMENT,
          session_id: SESSION,
          seq: 0,
          origin: 'live',
          payload: MCQ_SEGMENT,
          key_verified: true,
        },
      ],
    });

    const response = await request(createApp())
      .post('/api/v1/tutor/internal/segments/verify')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({
        sessionId: SESSION,
        segment: { ...MCQ_SEGMENT, answer: { correct_option_id: 'a' } },
        provenance: { model: 'test' },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.keyVerified).toBe(true);
    expect(JSON.stringify(response.body.data.segment)).not.toContain('correct_option_id');
  });
});

describe('guardian visibility', () => {
  it('refuses a stranger', async () => {
    stub({ guardianLinks: [] });
    const response = await request(createApp())
      .get(`/api/v1/tutor/kids/${KID}/sessions`)
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`);
    expect(response.status).toBe(403);
  });

  it('gives a verified guardian the sessions AND the safety flags', async () => {
    stub({ guardianLinks: [{ parent_user_id: PARENT, kid_user_id: KID, verification_status: 'verified' }] });
    const response = await request(createApp())
      .get(`/api/v1/tutor/kids/${KID}/sessions`)
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('sessions');
    expect(response.body.data).toHaveProperty('safetyFlags');
  });
});

describe('preferences', () => {
  it('rejects a nickname that is really a full name', async () => {
    stub();
    const response = await request(createApp())
      .put('/api/v1/tutor/preferences')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ nickname: 'Ana Vasquez, Jr.' });
    expect(response.status).toBe(400);
  });

  it('rejects a companion that is the same character as the tutor', async () => {
    stub();
    const response = await request(createApp())
      .put('/api/v1/tutor/preferences')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ character: 'rho', companion: 'rho' });
    expect(response.status).toBe(400);
  });

  it('rejects an unknown field rather than silently dropping it', async () => {
    stub();
    const response = await request(createApp())
      .put('/api/v1/tutor/preferences')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ character: 'rho', voiceModel: 'something-custom' });
    expect(response.status).toBe(400);
  });

  it('serves the catalog so the client never hard-codes the cast', async () => {
    stub();
    const response = await request(createApp())
      .get('/api/v1/tutor/preferences')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`);

    expect(response.body.data.catalog.characters).toEqual(['dina', 'liruf', 'rho', 'zara']);
    // rho and zara have mouth cards; liruf and dina do not (/TUTOR_3D.md §3.1).
    expect(response.body.data.catalog.articulates).toEqual(['rho', 'zara']);
  });
});
