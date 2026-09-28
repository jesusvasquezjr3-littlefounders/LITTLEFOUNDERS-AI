import { describe, expect, it, vi } from 'vitest';
import { cancelAccountDeletion, getDeletionState, requestAccountDeletion } from './deletionClient';

/*
 * The E.6 client layer carries requests and validates answers: a malformed
 * or partial response is a failure, never an invented state, and the only
 * body it ever sends is the acknowledgement plus an optional password.
 */

function transport(status: number, body: unknown) {
  const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  return { baseUrl: 'http://core.test', token: 'jwt', fetchImpl: fetchImpl as unknown as typeof fetch, calls: fetchImpl };
}

const allowed = { allowed: true, population: 'adult', graceDays: 14, immediate: false, reauth: 'password', children: { lastTutorOf: 0, sharedTutorOf: 0 } };

describe('getDeletionState', () => {
  it('parses an allowed account with no open deletion', async () => {
    const t = transport(200, { data: { deletion: null, eligibility: allowed }, error: null });
    // An older Core without `tutorsTold` reads as nobody told.
    await expect(getDeletionState(t)).resolves.toEqual({ ok: true, value: { deletion: null, eligibility: { ...allowed, tutorsTold: 0 } } });
    expect(String(t.calls.mock.calls[0]![0])).toBe('http://core.test/api/v1/account/deletion');
  });

  it("reads how many Tutors a linked teen's deletion tells (D-14 (b))", async () => {
    const teen = { ...allowed, population: 'teen', tutorsTold: 2 };
    const t = transport(200, { data: { deletion: null, eligibility: teen }, error: null });
    await expect(getDeletionState(t)).resolves.toEqual({ ok: true, value: { deletion: null, eligibility: teen } });
  });

  it('parses a scheduled deletion and a refusal', async () => {
    const deletion = { status: 'pending', requestedAt: '2026-09-24T00:00:00.000Z', scheduledFor: '2026-10-08T00:00:00.000Z' };
    const t = transport(200, { data: { deletion, eligibility: { allowed: false, reason: 'kid' } }, error: null });
    await expect(getDeletionState(t)).resolves.toEqual({ ok: true, value: { deletion, eligibility: { allowed: false, reason: 'kid' } } });
  });

  it('treats any malformed answer as unavailable', async () => {
    for (const body of [
      { data: { deletion: { status: 'completed', requestedAt: 'x', scheduledFor: 'y' }, eligibility: allowed } },
      { data: { deletion: null, eligibility: { ...allowed, graceDays: -1 } } },
      { data: { deletion: null, eligibility: { allowed: false, reason: 'teen' } } },
      { data: { deletion: null } },
      null,
    ]) {
      await expect(getDeletionState(transport(200, body))).resolves.toEqual({ ok: false, code: 'UNAVAILABLE' });
    }
    await expect(getDeletionState(transport(502, { data: null, error: { code: 'DATA_UNAVAILABLE' } }))).resolves.toEqual({ ok: false, code: 'DATA_UNAVAILABLE' });
  });
});

describe('requestAccountDeletion', () => {
  it('sends only the acknowledgement and the password', async () => {
    const t = transport(202, { data: { status: 'pending', scheduledFor: '2026-10-08T00:00:00.000Z', signedOut: true }, error: null });
    await expect(requestAccountDeletion({ ...t, currentPassword: 'pw' })).resolves.toEqual({ ok: true, value: { status: 'pending', scheduledFor: '2026-10-08T00:00:00.000Z', signedOut: true } });
    const init = t.calls.mock.calls[0]![1]!;
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ acknowledge: true, currentPassword: 'pw' });
  });

  it('passes Core’s refusal code through and rejects an unknown outcome', async () => {
    await expect(requestAccountDeletion(transport(401, { data: null, error: { code: 'INVALID_CREDENTIALS' } }))).resolves.toEqual({ ok: false, code: 'INVALID_CREDENTIALS' });
    await expect(requestAccountDeletion(transport(403, { data: null, error: { code: 'KID_DELETION_BY_TUTOR' } }))).resolves.toEqual({ ok: false, code: 'KID_DELETION_BY_TUTOR' });
    await expect(requestAccountDeletion(transport(200, { data: { status: 'gone', scheduledFor: '2026-10-08T00:00:00.000Z' } }))).resolves.toEqual({ ok: false, code: 'UNAVAILABLE' });
  });

  it('reports an immediate erasure', async () => {
    const t = transport(200, { data: { status: 'finishing', scheduledFor: '2026-09-24T00:00:00.000Z' }, error: null });
    await expect(requestAccountDeletion(t)).resolves.toEqual({ ok: true, value: { status: 'finishing', scheduledFor: '2026-09-24T00:00:00.000Z' } });
    expect(JSON.parse(String(t.calls.mock.calls[0]![1]!.body))).toEqual({ acknowledge: true });
  });
});

describe('cancelAccountDeletion', () => {
  it('confirms only an explicit cancelled answer', async () => {
    await expect(cancelAccountDeletion(transport(200, { data: { status: 'cancelled' } }))).resolves.toEqual({ ok: true, value: 'cancelled' });
    await expect(cancelAccountDeletion(transport(409, { data: null, error: { code: 'DELETION_IN_PROGRESS' } }))).resolves.toEqual({ ok: false, code: 'DELETION_IN_PROGRESS' });
    await expect(cancelAccountDeletion(transport(200, { data: {} }))).resolves.toEqual({ ok: false, code: 'UNAVAILABLE' });
  });
});
