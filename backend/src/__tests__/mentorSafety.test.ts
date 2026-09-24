import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasVerifiedAdultEvidence, requiresMinorMentorSafeguards, resolveMentorSafety } from '../services/mentorSafety.js';
import { jsonResponse } from './helpers.js';

const USER = '22222222-2222-4222-8222-222222222222';
const adult = { status: 'verified', method: 'local-ocr', birth_date: '1990-01-01' };
afterEach(() => { vi.unstubAllGlobals(); });

describe('C.2/C.3 conservative Mentor safety posture', () => {
  it.each([
    { origin: [], guardians: [], blocked: false },
    { origin: null, guardians: [], blocked: true },
    { origin: [{ under13_origin: true }], guardians: [], blocked: true },
    { origin: [{ under13_origin: true }], guardians: null, blocked: true },
    { origin: [{ under13_origin: true }], guardians: [{}], blocked: true },
    { origin: [{ under13_origin: true }], guardians: [{ parent_user_id: USER }], blocked: false },
  ])('resolves origin restrictions conservatively: case %#', async ({ origin, guardians, blocked }) => {
    const fetch = vi.fn((input: string) => Promise.resolve(jsonResponse(200,
      input.includes('/account_safety_origins') ? origin : guardians)));
    vi.stubGlobal('fetch', fetch);
    expect(await resolveMentorSafety(USER, ['universal'])).toEqual({ isMinor: true, originRestricted: blocked });
    const guardianCall = fetch.mock.calls.find(([url]) => url.includes('/guardian_links'));
    if (guardianCall) {
      const query = new URL(guardianCall[0]).searchParams;
      expect(query.get('kid_user_id')).toBe(`eq.${USER}`);
      expect(query.get('verification_status')).toBe('eq.verified');
    }
  });

  it('allows only trusted adult evidence to release origin restrictions without a guardian', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [adult])));
    expect(await resolveMentorSafety(USER, ['parent'])).toEqual({ isMinor: false, originRestricted: false });
  });
  it('uses exact UTC birthdays and rejects missing, malformed or unverified evidence', () => {
    const now = new Date('2026-09-21T00:00:00Z');
    expect(hasVerifiedAdultEvidence({ ...adult, birth_date: '2008-09-21' }, now)).toBe(true);
    for (const row of [null, {}, { ...adult, status: 'revoked' }, { ...adult, method: 'staff-grant' },
      { ...adult, birth_date: '2008-09-22' }, { ...adult, birth_date: '2008-02-30' },
      { ...adult, birth_date: 'not-a-date' }, { ...adult, birth_date: '2090-01-01' }]) {
      expect(hasVerifiedAdultEvidence(row, now)).toBe(false);
    }
  });

  it.each([[], ['universal'], ['admin'], ['superadmin'], ['kid'], ['kid', 'parent']].map(roles => ({ roles })))(
    'never treats roles $roles as evidence of adulthood', async ({ roles }) => {
      const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
      expect(await requiresMinorMentorSafeguards(USER, roles)).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('requires current ID evidence even for a parent, with a narrowly scoped read', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(200, [adult])); vi.stubGlobal('fetch', fetch);
    expect(await requiresMinorMentorSafeguards(USER, ['parent'])).toBe(false);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('user_id')).toBe(`eq.${USER}`);
    expect(url.searchParams.get('select')).toBe('status,method,birth_date');
    expect(url.searchParams.get('order')).toBe('created_at.desc,id.desc');
    expect(url.searchParams.get('limit')).toBe('1');
    expect(url.searchParams.has('status')).toBe(false);
  });

  it.each([[], [{ ...adult, status: 'revoked' }], null, {}, [adult, adult]].map(rows => ({ rows })))(
    'fails closed for missing, revoked or malformed lookup result %#', async ({ rows }) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, rows)));
      expect(await requiresMinorMentorSafeguards(USER, ['parent'])).toBe(true);
    },
  );

  it('fails closed on database and transport failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    expect(await requiresMinorMentorSafeguards(USER, ['parent'])).toBe(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unavailable')));
    expect(await requiresMinorMentorSafeguards(USER, ['parent'])).toBe(true);
  });
});
