import { afterEach, describe, expect, it, vi } from 'vitest';
import { markUnder13Origin, readUnder13Origin } from '../services/ageOrigin.js';
import { jsonResponse } from './helpers.js';

const USER = '22222222-2222-4222-8222-222222222222';
afterEach(() => vi.unstubAllGlobals());

describe('A.2 service-owned origin storage contract', () => {
  it.each([
    { rows: [], expected: false },
    { rows: [{ under13_origin: true }], expected: true },
    { rows: [{ under13_origin: false }], expected: null },
    { rows: [{ under13_origin: 'true' }], expected: null },
    { rows: [{ under13_origin: true }, { under13_origin: true }], expected: null },
    { rows: null, expected: null },
    { rows: {}, expected: null },
  ])('validates lookup response $rows', async ({ rows, expected }) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(200, rows));
    vi.stubGlobal('fetch', fetch);
    expect(await readUnder13Origin(USER)).toBe(expected);
    const url = new URL(String(fetch.mock.calls[0]?.[0]));
    expect(url.searchParams.get('user_id')).toBe(`eq.${USER}`);
    expect(url.searchParams.get('select')).toBe('under13_origin');
  });

  it('requires an affirmative RPC result, never an empty successful response', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(200, true));
    vi.stubGlobal('fetch', fetch);
    expect(await markUnder13Origin(USER)).toBe(true);
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({ p_user_id: USER });
    fetch.mockResolvedValue(new Response(null, { status: 204 }));
    expect(await markUnder13Origin(USER)).toBe(false);
  });

  it('distinguishes outages from an absent marker and refuses malformed identities', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    expect(await readUnder13Origin(USER)).toBeNull();
    expect(await markUnder13Origin(USER)).toBe(false);
    fetch.mockClear();
    expect(await readUnder13Origin('invalid')).toBeNull();
    expect(await markUnder13Origin('invalid')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
