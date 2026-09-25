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
    expect(headers['x-oracle-context-fields']).toBe('opening,behavioralTelemetryMode');
    expect(headers['x-internal-api-key']).toBeDefined();
    expect(CONTEXT_OPTIONAL_FIELDS).toEqual(['opening', 'behavioralTelemetryMode']);
  });

  it('parses the announced fields, and refuses a context carrying a field it never announced', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => coreReplies({ ...CONTEXT, opening: 'greeting', behavioralTelemetryMode: 'shadow' })));
    expect((await fetchSessionContext(CONTEXT.sessionId))?.behavioralTelemetryMode).toBe('shadow');
    vi.stubGlobal('fetch', vi.fn(async () => coreReplies({ ...CONTEXT, someFutureField: true })));
    expect(await fetchSessionContext(CONTEXT.sessionId)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => coreReplies({ ...CONTEXT, behavioralTelemetryMode: 'loud' })));
    expect(await fetchSessionContext(CONTEXT.sessionId)).toBeNull();
  });
});
