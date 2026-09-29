import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTEXT_OPTIONAL_FIELDS, fetchSessionContext } from '../core/client.js';

/*
 * The context field negotiation (found while building C.9, 2026-09-25).
 * Oracle's context schema is `.strict()`, so Core may send an optional field
 * only when Oracle announces it can parse it. Otherwise a Core deployed
 * before Oracle would make every session refuse to start.
 */

const CONTEXT = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  tier: 2,
  locale: 'es-MX',
  nickname: 'Robi',
  character: 'rho',
  companion: 'liruf',
  diorama: 'diorama-a',
  intent: 'course_topic',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  isMinor: true,
  voiceConsent: false,
  intelDegraded: false,
};

function coreReplies(data: unknown): Response {
  return new Response(JSON.stringify({ data, error: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('context optional fields', () => {
  it('announces every optional field it can parse on the context read', async () => {
    const fetchMock = vi.fn(async () => coreReplies(CONTEXT));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchSessionContext(CONTEXT.sessionId)).not.toBeNull();
    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>;
    expect(headers['x-oracle-context-fields']).toBe(
      'opening,behavioralTelemetryMode,dispositionProfile,allianceContinuity,allianceMode,spacedReviewMode,dialogueCalibration,canary',
    );
    expect(headers['x-internal-api-key']).toBeDefined();
    expect(CONTEXT_OPTIONAL_FIELDS).toEqual([
      'opening',
      'behavioralTelemetryMode',
      'dispositionProfile',
      'allianceContinuity',
      'allianceMode',
      'spacedReviewMode',
      'dialogueCalibration',
      'canary',
    ]);
  });

  it('C.11/C.17: parses the spaced-review mode and the dialogue calibration, strictly', async () => {
    const calibration = {
      band: 'teen',
      variant: 'calibrated',
      assignment: 'not_eligible',
      experimentId: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => coreReplies({ ...CONTEXT, spacedReviewMode: 'shadow', dialogueCalibration: calibration })),
    );
    const parsed = await fetchSessionContext(CONTEXT.sessionId);
    expect(parsed?.spacedReviewMode).toBe('shadow');
    expect(parsed?.dialogueCalibration).toEqual(calibration);
    // Null (Core could not decide) parses; the tier fallback then applies.
    vi.stubGlobal('fetch', vi.fn(async () => coreReplies({ ...CONTEXT, dialogueCalibration: null })));
    expect((await fetchSessionContext(CONTEXT.sessionId))?.dialogueCalibration).toBeNull();
    // An unknown band, an age, a louder mode or an extra field refuses the context.
    for (const bad of [
      { dialogueCalibration: { ...calibration, band: 'toddler' } },
      { dialogueCalibration: { ...calibration, age: 15 } },
      { dialogueCalibration: { ...calibration, variant: 'experimental' } },
      { dialogueCalibration: { ...calibration, experimentId: 'not-a-uuid' } },
      { spacedReviewMode: 'off' },
    ]) {
      vi.stubGlobal('fetch', vi.fn(async () => coreReplies({ ...CONTEXT, ...bad })));
      expect(await fetchSessionContext(CONTEXT.sessionId)).toBeNull();
    }
  });

  it('parses the announced fields, and refuses a context carrying a field it never announced', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => coreReplies({ ...CONTEXT, opening: 'greeting', behavioralTelemetryMode: 'shadow' })));
    expect((await fetchSessionContext(CONTEXT.sessionId))?.behavioralTelemetryMode).toBe('shadow');
    vi.stubGlobal('fetch', vi.fn(async () => coreReplies({ ...CONTEXT, someFutureField: true })));
    expect(await fetchSessionContext(CONTEXT.sessionId)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => coreReplies({ ...CONTEXT, behavioralTelemetryMode: 'loud' })));
    expect(await fetchSessionContext(CONTEXT.sessionId)).toBeNull();
  });

  it('C.7/C.15: parses the disposition projection and the alliance fields, strictly', async () => {
    const profile = {
      sessionsObserved: 4,
      helpStyle: 'tell_early',
      persistence: 'persists',
      explanation: 'needs_scaffold',
      persistentlyDeclined: ['less_text'],
      typicalTypedReplyMs: 9000,
      typicalSpokenReplyMs: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        coreReplies({ ...CONTEXT, dispositionProfile: profile, allianceContinuity: 'persona_switch', allianceMode: 'shadow' }),
      ),
    );
    const parsed = await fetchSessionContext(CONTEXT.sessionId);
    expect(parsed?.dispositionProfile?.helpStyle).toBe('tell_early');
    expect(parsed?.allianceContinuity).toBe('persona_switch');
    expect(parsed?.allianceMode).toBe('shadow');
    // An emotion label smuggled into the profile, an unknown continuity or a
    // louder-than-act mode each refuse the whole context.
    for (const bad of [
      { dispositionProfile: { ...profile, mood: 'bored' } },
      { dispositionProfile: { ...profile, helpStyle: 'lazy' } },
      { allianceContinuity: 'best_friends' },
      { allianceMode: 'loud' },
    ]) {
      vi.stubGlobal('fetch', vi.fn(async () => coreReplies({ ...CONTEXT, ...bad })));
      expect(await fetchSessionContext(CONTEXT.sessionId), JSON.stringify(bad)).toBeNull();
    }
  });
});
