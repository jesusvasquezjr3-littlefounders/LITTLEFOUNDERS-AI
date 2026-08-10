import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLessonDocument, listPendingLessonDocuments } from '../db/lessonDocumentsRepo.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getLessonDocument', () => {
  it('distinguishes an empty successful result from a missing row', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));

    await expect(getLessonDocument('missing', 'en-US')).resolves.toBeNull();
  });

  it('propagates a Vault failure instead of collapsing it into null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"down"}', { status: 503 })));

    await expect(getLessonDocument('lesson-1', 'en-US')).rejects.toThrow('Vault query failed (HTTP 503)');
  });
});

// Production incident 2026-08-10: PostgREST caps an unranged response at its
// server-configured max-rows (observed 1000) and returns it as a normal-
// looking 206 with a Content-Range header nobody checked. A course with more
// pending documents than the cap silently lost the remainder — the batch
// reported "N pending", narrated exactly N, and exited 0, indistinguishable
// from a fully-narrated course.
describe('listPendingLessonDocuments', () => {
  function row(n: number) {
    return { lesson_id: `lesson-${n}`, locale: 'en-US' };
  }

  it('returns everything on a single page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([row(1), row(2)]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listPendingLessonDocuments('financial-education');

    expect(result).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('pages past a truncated response instead of treating it as complete', async () => {
    const pageSize = 1000;
    const firstPage = Array.from({ length: pageSize }, (_, i) => row(i));
    const secondPage = [row(pageSize), row(pageSize + 1)];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 206 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), { status: 206 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listPendingLessonDocuments('financial-education');

    expect(result).toHaveLength(pageSize + 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallHeaders = fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(secondCallHeaders.Range).toBe(`${pageSize}-${pageSize * 2 - 1}`);
  });

  it('checks for a next page when the total is an exact multiple of the page size', async () => {
    const pageSize = 1000;
    const exactlyOnePage = Array.from({ length: pageSize }, (_, i) => row(i));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(exactlyOnePage), { status: 200 }))
      .mockResolvedValueOnce(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listPendingLessonDocuments();

    expect(result).toHaveLength(pageSize);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws instead of returning a partial list when a later page fails', async () => {
    const pageSize = 1000;
    const firstPage = Array.from({ length: pageSize }, (_, i) => row(i));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 206 }))
      .mockResolvedValueOnce(new Response('{"error":"down"}', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listPendingLessonDocuments('financial-education')).rejects.toThrow('Vault query failed (HTTP 503)');
  });
});
