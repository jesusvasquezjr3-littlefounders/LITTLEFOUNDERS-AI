import { afterEach, expect, it, vi } from 'vitest';
import { syncTable } from '../db/sync.js';

// Exercise the real pagination/network contract without repeating 1001 native
// single-row writes; warehouse storage is covered by the native DB suites.
vi.mock('../db/duckdb.js', () => ({
  isReady: () => true,
  exec: vi.fn(async () => undefined),
  execute: vi.fn(async () => undefined),
  query: vi.fn(async () => []),
  withConnection: async (callback: (connection: { exec: () => Promise<void>; execute: () => Promise<void> }) => Promise<void>) =>
    callback({ exec: async () => undefined, execute: async () => undefined }),
}));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('syncs the complete catalog when PostgREST caps every response at 1000 rows', async () => {
  const lessons = Array.from({ length: 1001 }, (_, index) => ({
    lesson_id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    slug: `lesson-${index}`, title_en: `Lesson ${index}`, segment_count: 1,
  }));
  const offsets: number[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = new URL(input);
    expect(url.pathname).toBe('/rest/v1/dataintel_lessons_sync');
    expect(url.searchParams.get('order')).toBe('lesson_id.asc');
    const offset = Number(url.searchParams.get('offset'));
    const size = Math.min(Number(url.searchParams.get('limit')), 1000);
    offsets.push(offset);
    return new Response(JSON.stringify(lessons.slice(offset, offset + size)), { status: 200 });
  }));
  expect((await syncTable('lessons')).rows).toBe(1001);
  expect(offsets).toEqual([0, 1000]);
});
