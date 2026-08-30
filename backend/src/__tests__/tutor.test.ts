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
  /** Catalog fixtures for the ladder. Absent means "no published content". */
  courses?: unknown[];
  topics?: unknown[];
  lessons?: unknown[];
  lessonDocuments?: unknown[];
  kcs?: unknown[];
  kcEdges?: unknown[];
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
  /** Overrides what `/rpc/award_tutor_xp` reports as actually credited — the
   * daily cap already having been (partly or fully) spent, simulated at the
   * boundary rather than by fabricating a real race. */
  awardedXp?: number;
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
              // Stated explicitly rather than omitted: the consent routes read
              // this and treat anything other than 'allowed' as blocked, so a
              // fixture that leaves it out is testing the refusal path by
              // accident instead of the one it means to.
              minorVoicePolicy: 'allowed',
            },
            error: null,
          }),
        );
      }
      /*
       * THE CATALOG THE LADDER READS. Absent by default, so every existing
       * test keeps describing a world with no published content — which is
       * what they were written against. A test that wants tier 1 to succeed
       * says so explicitly.
       */
      if (url.includes('/rest/v1/courses')) return Promise.resolve(jsonResponse(200, opts.courses ?? []));
      if (url.includes('/rest/v1/topics')) {
        /*
         * The slug filter is HONOURED here, not ignored. A stub that returns
         * the same topic for every query makes "this skill has no content"
         * unreachable — which is the exact state the prerequisite fallback
         * exists for, so the test for it would have passed against no code.
         */
        const want = /slug=eq\.([^&]+)/.exec(url)?.[1];
        const rows = (opts.topics ?? []) as { slug?: string }[];
        return Promise.resolve(
          jsonResponse(200, want ? rows.filter((r) => r.slug === decodeURIComponent(want)) : rows),
        );
      }
      if (url.includes('/rest/v1/lessons')) return Promise.resolve(jsonResponse(200, opts.lessons ?? []));
      if (url.includes('/rest/v1/lesson_documents')) {
        return Promise.resolve(jsonResponse(200, opts.lessonDocuments ?? []));
      }
      if (url.includes('/rest/v1/kc_edge')) return Promise.resolve(jsonResponse(200, opts.kcEdges ?? []));
      if (url.includes('/rest/v1/kc?')) return Promise.resolve(jsonResponse(200, opts.kcs ?? []));
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
      if (url.includes('/rpc/award_tutor_xp')) {
        // Default: award exactly what was requested (no cap in play). A test
        // exercising the cap passes `opts.awardedXp` to override this.
        const requested = JSON.parse(String(init?.body ?? '{}')).p_requested as number;
        return Promise.resolve(jsonResponse(200, opts.awardedXp ?? requested));
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

describe('GET /api/v1/tutor/preferences — the server-side picker marker', () => {
  it('reports personalized=false while no row exists, true once one does', async () => {
    stub({ preferences: [] });
    const fresh = await request(createApp())
      .get('/api/v1/tutor/preferences')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`);
    expect(fresh.body.data.personalized).toBe(false);

    stub({
      preferences: [
        {
          user_id: KID,
          character: 'zara',
          companion: null,
          diorama: 'diorama-a',
          backdrop: 'auto',
          nickname: null,
          adaptations: [],
          updated_at: '2026-08-27T10:00:00Z',
        },
      ],
    });
    const returning = await request(createApp())
      .get('/api/v1/tutor/preferences')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`);
    // A cleared browser used to re-open the picker forever; the row is the
    // durable half of "you have been offered this".
    expect(returning.body.data.personalized).toBe(true);
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

  /*
   * The cap is a promise to parents (the tutor sends a child away on purpose),
   * so it is not weakened and not made configurable. Staff are exempt because
   * they are not who it protects, and because iterating on the Tutor means
   * starting sessions: at two per day the person fixing a defect cannot look
   * at their own next change until tomorrow.
   */
  it('exempts staff from the daily cap, and only staff', async () => {
    stub({ sessions: [{ id: 'a' }, { id: 'b' }], roles: [{ role: 'superadmin' }] });
    const staff = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({ intent: 'open' });
    expect(staff.status).toBe(201);

    stub({ sessions: [{ id: 'a' }, { id: 'b' }], roles: [{ role: 'parent' }] });
    const ordinary = await request(createApp())
      .post('/api/v1/tutor/sessions')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({ intent: 'open' });
    expect(ordinary.status).toBe(429);
    expect(ordinary.body.error.code).toBe('SESSION_LIMIT');
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

describe('POST /api/v1/tutor/sessions/:id/resume', () => {
  it('mints a FRESH single-use socket URL for the owner of a still-open session', async () => {
    stub();

    const response = await request(createApp())
      .post(`/api/v1/tutor/sessions/${SESSION}/resume`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({});

    expect(response.status).toBe(200);
    const url: string = response.body.data.socketUrl;
    expect(url).toContain('/ws/tutor?token=');
    expect(decodeURIComponent(url.split('token=')[1] ?? '').startsWith('v1.')).toBe(true);
    expect(response.body.data.sessionId).toBe(SESSION);
  });

  it('refuses a session that already ended — the park expired, nothing to go back to', async () => {
    stub({ session: [{ ...SESSION_ROW, ended_at: '2026-08-21T10:30:00Z', close_reason: 'learner_left' }] });

    const response = await request(createApp())
      .post(`/api/v1/tutor/sessions/${SESSION}/resume`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SESSION_CLOSED');
  });

  it('refuses anyone but the owner — a guardian may read a transcript, never hold the microphone', async () => {
    stub({ guardianLinks: [{ kid_user_id: KID }] });

    const response = await request(createApp())
      .post(`/api/v1/tutor/sessions/${SESSION}/resume`)
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
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

  /*
   * THE POLICY GATE ON THE RECORD ITSELF (/ORACLE.md §16).
   *
   * The UI already hides the switch while `TUTOR_VOICE_FOR_MINORS` is off.
   * These assert the second, independent guard: even a hand-made request must
   * not be able to write a consent row. The two guards protect different
   * things — the UI protects the guardian from being asked, this protects the
   * RECORD from containing an agreement to placeholder wording for a
   * capability we do not offer.
   */
  const WORDING = 'I allow my child to speak with the AI tutor using the microphone on this device.';
  const guardianOf = (kid: string) => [
    { parent_user_id: PARENT, kid_user_id: kid, verification_status: 'verified' },
  ];

  it('refuses to record a consent while the DPA policy is blocked', async () => {
    const calls = stub({
      guardianLinks: guardianOf(KID),
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
      .post('/api/v1/tutor/consent')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({ kidUserId: KID, consentText: WORDING, locale: 'es-MX' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('POLICY_BLOCKED');
    // Nothing was written. A refusal that still persists the row would defeat
    // the whole point of the guard.
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('tutor_voice_consent'))).toBe(false);
  });

  it('refuses to record a consent when Oracle omits the policy field entirely', async () => {
    const calls = stub({
      guardianLinks: guardianOf(KID),
      consent: [],
      // An older Oracle, or a payload that lost the field in transit. Absent
      // must read as "no" — this is the fail-open shape the guard exists for.
      preflight: { canStart: true, blockedBy: null, voiceAvailable: true, microphoneAvailable: true },
    });

    const response = await request(createApp())
      .post('/api/v1/tutor/consent')
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`)
      .send({ kidUserId: KID, consentText: WORDING, locale: 'es-MX' });

    expect(response.status).toBe(409);
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('tutor_voice_consent'))).toBe(false);
  });

  it('reports the policy alongside the consent state, so the UI can be honest', async () => {
    stub({
      guardianLinks: guardianOf(KID),
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
      .get(`/api/v1/tutor/consent/${KID}`)
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`);

    expect(response.status).toBe(200);
    expect(response.body.data.active).toBe(false);
    expect(response.body.data.policy).toBe('blocked');
  });

  it('still lets a guardian revoke while the policy is blocked', async () => {
    // The reachable case: a consent granted while the policy was open, then
    // the policy closes. Revocation must never depend on it.
    const calls = stub({
      guardianLinks: guardianOf(KID),
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
      .delete(`/api/v1/tutor/consent/${KID}`)
      .set('Authorization', `Bearer ${mintToken({ sub: PARENT })}`);

    expect(response.status).toBe(200);
    expect(calls.some((c) => c.method === 'PATCH' && c.url.includes('tutor_voice_consent'))).toBe(true);
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

  it('refuses rather than defaulting when the atomic XP credit cannot be read', async () => {
    // §1.14 in its exact shape: assuming zero was credited on a failed write
    // would be indistinguishable from a silently lost one.
    stub({ segment: [verifiedRow], restFailures: ['/rpc/award_tutor_xp'] });

    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ answer: { option_id: 'a' } });

    expect(response.status).toBe(502);
  });

  it('never pays a segment more than its own worth, no matter how many times it is graded', async () => {
    /*
     * Found by adversarial review, 2026-08-30 (HIGH): this route used to
     * compute `xp` fresh from the CURRENT score on every call, with no memory
     * of what this exact segment had already paid — so re-grading the same
     * 20-XP segment (a retried request, a double-tap, a trivial replay) paid
     * the full 20 XP again each time. Simulated here without any concurrency
     * trick: `verifiedRow` already carries `xp_awarded: 15` from an earlier
     * grade call on this SAME segment, so a fresh full-score grade must only
     * be able to earn the remaining 5, not another 20.
     */
    const calls = stub({ segment: [{ ...verifiedRow, xp_awarded: 15 }] });

    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ answer: { option_id: 'a' }, attemptNumber: 2 });

    expect(response.status).toBe(200);
    expect(response.body.data.xpAwarded).toBe(5);
    const rpcCall = calls.find((c) => c.url.includes('/rpc/award_tutor_xp'));
    expect(JSON.parse(rpcCall?.body ?? '{}').p_requested).toBe(5);
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('tutor_segments'));
    expect(JSON.parse(patch?.body ?? '{}').xp_awarded).toBe(20);
  });

  it('trusts what the atomic credit actually granted over what it locally computed', async () => {
    /*
     * Found by adversarial review, 2026-08-30 (CRITICAL): the previous shape
     * computed the capped amount in application code from a separately-read
     * "earned today", which a concurrent request could make stale by the
     * time this one wrote — both could believe the full remaining cap was
     * theirs. `award_tutor_xp` (migration 0055) now does the read, the cap
     * arithmetic AND the write atomically in Postgres and reports back what
     * it actually credited. This asserts the route reports and stores
     * EXACTLY that number, not the score-derived amount it would have
     * computed on its own — proving there is no second, independent XP
     * calculation left in this route for a race to exploit.
     */
    const calls = stub({ segment: [verifiedRow], awardedXp: 3 });

    const response = await request(createApp())
      .post(`/api/v1/tutor/segments/${SEGMENT}/grade`)
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`)
      .send({ answer: { option_id: 'a' }, attemptNumber: 1 });

    expect(response.status).toBe(200);
    expect(response.body.data.xpAwarded).toBe(3);
    const rpcCall = calls.find((c) => c.url.includes('/rpc/award_tutor_xp'));
    // The route still asked for the segment's full worth (20) — the cap was
    // enforced INSIDE the atomic function, not by this route second-guessing it.
    expect(JSON.parse(rpcCall?.body ?? '{}').p_requested).toBe(20);
    const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('tutor_segments'));
    expect(JSON.parse(patch?.body ?? '{}').xp_awarded).toBe(3);
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

  it('writes a memory digest at close — topic, skills, outcome, counters, and nothing anyone said', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stub({
      calls,
      session: [
        {
          ...SESSION_ROW,
          skill_key: 'money.saving',
          ended_at: '2026-08-21T10:30:00Z',
          close_reason: 'completed',
        },
      ],
      segments: [
        {
          id: SEGMENT,
          session_id: SESSION,
          seq: 0,
          origin: 'catalog',
          payload: MCQ_SEGMENT,
          score: 100,
          provenance: { skill_key: 'money.goals' },
        },
      ],
    });

    const response = await request(createApp())
      .post(`/api/v1/tutor/internal/sessions/${SESSION}/close`)
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({ sessionId: SESSION, closeReason: 'completed', turnCount: 8, segmentCount: 1, costUsd: 0.01 });

    expect(response.status).toBe(200);
    const write = calls.find(
      (c) => c.method === 'PATCH' && c.url.includes('/tutor_sessions') && (c.body ?? '').includes('summary'),
    );
    expect(write).toBeDefined();
    const digest = (JSON.parse(write?.body ?? '{}') as { summary: Record<string, unknown> }).summary;
    expect(digest).toMatchObject({
      outcome: 'completed',
      gradedCorrect: 1,
      gradedTotal: 1,
    });
    expect(digest.skillKeys).toEqual(expect.arrayContaining(['money.saving', 'money.goals']));
    // The digest is what the NEXT session's model context carries, so no
    // transcript-shaped field may ever appear in it.
    expect(Object.keys(digest).sort()).toEqual([
      'courseId',
      'gradedCorrect',
      'gradedTotal',
      'outcome',
      'skillKeys',
      'topic',
      'topicId',
    ]);
  });

  it('hands Oracle the previous sessions as digests, shaped for the sealed context', async () => {
    stub({
      sessions: [
        {
          summary: {
            topic: 'Ahorro',
            courseId: '55555555-5555-4555-8555-555555555555',
            topicId: null,
            skillKeys: ['money.saving'],
            outcome: 'completed',
            gradedCorrect: 2,
            gradedTotal: 3,
          },
          ended_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        },
      ],
    });

    const response = await request(createApp())
      .get(`/api/v1/tutor/internal/sessions/${SESSION}`)
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string);

    expect(response.status).toBe(200);
    const prior = response.body.data.previousSessions;
    expect(prior).toHaveLength(1);
    expect(prior[0]).toMatchObject({ topic: 'Ahorro', outcome: 'completed', daysAgo: 2 });
    // The internal ids the digest stores do NOT travel to Oracle: the sealed
    // schema would reject them, and Oracle has no use for them.
    expect(prior[0].courseId).toBeUndefined();
  });

  it('offers "continue where you left off" from the latest digest', async () => {
    stub({
      sessions: [
        {
          summary: {
            topic: 'Ahorro',
            courseId: '55555555-5555-4555-8555-555555555555',
            topicId: null,
            skillKeys: ['money.saving'],
            outcome: 'left',
            gradedCorrect: 1,
            gradedTotal: 2,
          },
          ended_at: new Date(Date.now() - 86_400_000).toISOString(),
        },
      ],
    });

    const response = await request(createApp())
      .get('/api/v1/tutor/offers')
      .set('Authorization', `Bearer ${mintToken({ sub: KID })}`);

    expect(response.status).toBe(200);
    expect(response.body.data.lastSession).toMatchObject({
      topic: 'Ahorro',
      courseId: '55555555-5555-4555-8555-555555555555',
      skillKey: 'money.saving',
      outcome: 'left',
      daysAgo: 1,
    });
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

describe('serving an activity for a knowledge component nothing teaches', () => {
  /*
   * Five of the twenty-eight KCs have `skill_key` null ON PURPOSE — no
   * published topic teaches them, and mapping one to an unrelated topic would
   * serve confidently wrong content. Before the prerequisite walk, landing on
   * one meant tier 1 and tier 2 both missed and the learner got "Esa actividad
   * ya no está lista", which is the owner's original complaint. Observed live
   * on 2026-08-29 the moment a conversation drifted onto goods-versus-services.
   *
   * This route had NO test for its ladder at all, which is how the hole
   * shipped: every fixture described a world with no catalog, so "served
   * nothing" always looked correct.
   */
  const UNMAPPED = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
  const PREREQ = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0';

  const catalog = {
    // The insert of the served segment returns its row; without it the ladder
    // succeeds and the route still answers 502.
    segment: [{ id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd5' }],
    courses: [{ id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', slug: 'financial-education' }],
    topics: [{ id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', slug: 'cual-vale-mas', saga_id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4', status: 'published' }],
    lessons: [{ id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3', topic_id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', position: 1, status: 'published' }],
    lessonDocuments: [
      {
        lesson_id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
        locale: 'es-MX',
        schema_version: 1,
        audio: null,
        updated_at: '2026-08-29T00:00:00.000Z',
        document: { segments: [{ id: 'seg-a', type: 'quiz_mcq', difficulty: 2, prompt_md: '¿Cuál vale más?' }] },
        answer_keys: { 'seg-a': { correct: 'a' } },
      },
    ],
    kcs: [
      { id: UNMAPPED, key: 'biz.goods-vs-services', skill_key: null },
      { id: PREREQ, key: 'money.compare-amounts', skill_key: 'financial-education/cual-vale-mas' },
    ],
    kcEdges: [{ prerequisite_kc_id: PREREQ, dependent_kc_id: UNMAPPED }],
  };

  const body = {
    sessionId: SESSION,
    skillKey: 'financial-education/nothing-teaches-this',
    difficulty: 2,
    framing: 'Vamos a practicar.',
    rationale: 'the learner asked for an exercise',
    kcId: UNMAPPED,
  };

  it('falls back to a mapped PREREQUISITE instead of refusing', async () => {
    stub(catalog);

    const response = await request(createApp())
      .post('/api/v1/tutor/internal/segments')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send(body);

    expect(response.status).toBe(200);
    // Not the "I have nothing" answer: real authored content, one edge back.
    expect(response.body.data.needsGeneration).toBeUndefined();
    expect(response.body.data.segment?.id).toBe('seg-a');
  });

  it('still asks for generation when no prerequisite has content either', async () => {
    stub({ ...catalog, kcs: [{ id: UNMAPPED, key: 'biz.goods-vs-services', skill_key: null }], kcEdges: [] });

    const response = await request(createApp())
      .post('/api/v1/tutor/internal/segments')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send(body);

    // The fallback must not become a way to always answer SOMETHING: with no
    // mapped neighbour, tier 3 is still the honest next step.
    expect(response.body.data.needsGeneration).toBe(true);
  });
});

describe('preferredTypes — the ladder\'s visual-type hint (V4 sprint 2 backlog)', () => {
  /*
   * ROADMAP.md: the tutor tells a growth or spending story and the activity
   * panel showed something unrelated, because `serveFromCatalog` matched on
   * difficulty alone and had no notion of "make it a visual one". This is the
   * end-to-end proof: a topic with BOTH a quiz and a number line, requested
   * at difficulty 2 — the quiz is the exact difficulty match and the number
   * line is not, so a plain difficulty sort would pick the quiz every time.
   */
  const catalog = {
    courses: [{ id: 'ee000000-0000-4000-8000-000000000001', slug: 'financial-education' }],
    topics: [
      {
        id: 'ee000000-0000-4000-8000-000000000002',
        slug: 'ahorro',
        saga_id: 'ee000000-0000-4000-8000-000000000004',
        status: 'published',
      },
    ],
    lessons: [
      {
        id: 'ee000000-0000-4000-8000-000000000003',
        topic_id: 'ee000000-0000-4000-8000-000000000002',
        position: 1,
        status: 'published',
      },
    ],
    lessonDocuments: [
      {
        lesson_id: 'ee000000-0000-4000-8000-000000000003',
        locale: 'es-MX',
        schema_version: 1,
        audio: null,
        updated_at: '2026-08-29T00:00:00.000Z',
        document: {
          segments: [
            { id: 'seg-quiz', type: 'quiz_mcq', difficulty: 2, prompt_md: '¿Cuánto ahorras?' },
            { id: 'seg-visual', type: 'number_line', difficulty: 4, prompt_md: 'Marca el punto en la recta.' },
          ],
        },
        answer_keys: { 'seg-quiz': { correct: 'a' }, 'seg-visual': { correct: 3 } },
      },
    ],
  };

  const body = {
    sessionId: SESSION,
    skillKey: 'financial-education/ahorro',
    difficulty: 2,
    framing: 'Veamos cómo crece.',
    rationale: 'right after a growth story',
  };

  it('serves the exact-difficulty match when no preference is given', async () => {
    stub({ ...catalog, segment: [{ id: 'sss00000-0000-4000-8000-000000000005' }] });

    const response = await request(createApp())
      .post('/api/v1/tutor/internal/segments')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send(body);

    expect(response.body.data.segment?.id).toBe('seg-quiz');
  });

  it('serves the visual type instead, even at a worse difficulty distance, when asked', async () => {
    stub({ ...catalog, segment: [{ id: 'sss00000-0000-4000-8000-000000000005' }] });

    const response = await request(createApp())
      .post('/api/v1/tutor/internal/segments')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({ ...body, preferredTypes: ['number_line'] });

    expect(response.body.data.segment?.id).toBe('seg-visual');
  });

  it('rejects a type outside the two named ones — a preference, not a new authoring surface', async () => {
    stub(catalog);

    const response = await request(createApp())
      .post('/api/v1/tutor/internal/segments')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send({ ...body, preferredTypes: ['quiz_mcq'] });

    expect(response.status).toBe(400);
  });
});

describe('a tutor that admits it does not know which skill', () => {
  /*
   * In an open conversation there is no lesson plan and no skill state to copy
   * a key from, so the model invented plausible ones — `making_change`,
   * `matematicas/sumar-con-monedas` — naming nothing, matching nothing, and
   * dropping every request to live generation. The prompt now offers the
   * sentinel `unknown`, and the server decides instead of the guess.
   */
  const body = {
    sessionId: SESSION,
    skillKey: 'unknown',
    difficulty: 2,
    framing: 'Vamos a practicar.',
    rationale: 'the learner asked for an exercise about giving change',
  };

  it('does not try to resolve the sentinel as a real skill', async () => {
    const calls = stub();

    await request(createApp())
      .post('/api/v1/tutor/internal/segments')
      .set('x-internal-api-key', process.env.INTERNAL_API_KEY as string)
      .send(body);

    // No lookup for a course called "unknown": the sentinel means "you pick",
    // and a query for it would be a query for nothing.
    expect(calls.some((c) => c.url.includes('slug=eq.unknown'))).toBe(false);
  });
});
