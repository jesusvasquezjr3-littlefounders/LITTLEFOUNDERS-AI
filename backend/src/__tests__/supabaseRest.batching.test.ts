import { afterEach, describe, expect, it, vi } from 'vitest';
import { getKidLessonProgress, getLessonProgressForLessons, getLessonsByTopicIds, getTopicsBySagaIds } from '../services/supabaseRest.js';

/*
 * Production incident 2026-08-10: financial-education (1,208 lessons) was the
 * first course with enough ids to push a single `lesson_id=in.(...)` filter
 * past Kong's request-line limit. getLessonProgressForLessons came back HTTP
 * 414; rest() maps ANY non-2xx to null the same as a real outage, so
 * GET /api/v1/learn/courses failed 502 for every real session — logged
 * indistinguishably from an infrastructure problem. Reproduced directly
 * against Vault with the real 1,208 lesson ids before this fix.
 *
 * These verify the id-batching fix: a large id list is split across several
 * requests instead of growing one URL without bound, results from every
 * batch are combined, and a failure on any batch propagates instead of
 * silently returning a partial list.
 */

const UUID_A = '11111111-1111-4111-8111-111111111111';

function uuidN(n: number): string {
  const hex = n.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('supabaseRest id-batched queries', () => {
  it('makes a single request for a small id list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getTopicsBySagaIds('token', [uuidN(1), uuidN(2)]);

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('splits a large id list across multiple requests and combines the results', async () => {
    const ids = Array.from({ length: 320 }, (_, i) => uuidN(i));
    const fetchMock = vi.fn(async (url: string) => {
      // Echo back one row per id actually present in THIS request's filter,
      // so the test proves batches are disjoint and complete, not just counted.
      const match = /saga_id=in\.\(([^)]+)\)/.exec(url as string);
      const idsInBatch = match![1]!.split(',');
      const rows = idsInBatch.map((id) => ({ id: `topic-for-${id}`, saga_id: id }));
      return new Response(JSON.stringify(rows), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getTopicsBySagaIds('token', ids);

    // 320 ids at 150/batch = 3 requests (150 + 150 + 20).
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(320);
    // No single request URL contains more than 150 ids worth of filter.
    for (const call of fetchMock.mock.calls) {
      const url = call[0] as string;
      const match = /saga_id=in\.\(([^)]+)\)/.exec(url);
      expect(match![1]!.split(',').length).toBeLessThanOrEqual(150);
    }
  });

  it('propagates null instead of a partial list when a later batch fails', async () => {
    const ids = Array.from({ length: 200 }, (_, i) => uuidN(i));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response('server error', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getLessonsByTopicIds('token', ids);

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reproduces the production shape: 1208 lesson ids never build a single oversized filter', async () => {
    const ids = Array.from({ length: 1208 }, (_, i) => uuidN(i));
    // A fresh Response per call — the body stream can only be read once, and
    // mockResolvedValue() (vs. mockImplementation) would reuse one instance
    // across every batch, silently starving every call after the first.
    const fetchMock = vi.fn().mockImplementation(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getLessonProgressForLessons('token', UUID_A, ids);

    expect(result).toEqual([]);
    // ceil(1208 / 150) = 9 requests, never one request carrying all 1208.
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  it('batches getKidLessonProgress (service-role path) the same way', async () => {
    const ids = Array.from({ length: 200 }, (_, i) => uuidN(i));
    const fetchMock = vi.fn().mockImplementation(async () => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getKidLessonProgress(UUID_A, ids);

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('makes zero requests for an empty id list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getLessonsByTopicIds('token', [])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
