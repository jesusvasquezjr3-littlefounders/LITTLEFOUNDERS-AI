import { afterEach, expect, it, vi } from 'vitest';
import { readMentorAgeCalibration, recordMentorAgeCalibration } from '../services/mentorAgeCalibration.js';
import { jsonResponse } from './helpers.js';

const USER = '22222222-2222-4222-8222-222222222222';
afterEach(() => vi.unstubAllGlobals());
it.each([
  { rows: [], expected: { tier: null } },
  { rows: [{ tier: 1 }], expected: { tier: 1 } },
  { rows: [{ tier: 4 }], expected: null },
  { rows: [{ tier: 1 }, { tier: 2 }], expected: null },
  { rows: null, expected: null },
])('distinguishes missing, valid and invalid evidence: $rows', async ({ rows, expected }) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, rows)));
  expect(await readMentorAgeCalibration(USER)).toEqual(expected);
});
it('requires a valid acknowledgement and sends only the subject and tier', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(jsonResponse(200, 1)).mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);
  expect(await recordMentorAgeCalibration(USER, 3)).toBe(1);
  expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string)).toEqual({ p_user_id: USER, p_tier: 3 });
  expect(await recordMentorAgeCalibration(USER, 3)).toBeNull();
});
