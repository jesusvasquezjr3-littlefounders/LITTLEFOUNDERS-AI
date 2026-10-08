import { describe, expect, it } from 'vitest';
import { selectReleaseCatalog } from '../v2/releaseCatalog.js';

function fixture() {
  return {
    adventures: [{ id: 'a', status: 'draft' }, { id: 'old-a', status: 'archived' }],
    sagas: [{ id: 's', adventure_id: 'a', status: 'draft' }, { id: 'old-s', adventure_id: 'old-a', status: 'archived' }],
    topics: [{ id: 't', saga_id: 's', status: 'draft', title: {} }, { id: 'old-t', saga_id: 'old-s', status: 'archived', title: {} }],
    lessons: [{ id: 'l', topic_id: 't', slug: 'current', status: 'review' }, { id: 'old-l', topic_id: 'old-t', slug: 'retired', status: 'archived' }],
  };
}

describe('replacement catalog release selection', () => {
  it('selects the current course without mutating archived history', () => {
    const rows = fixture();
    const before = structuredClone(rows);
    const result = selectReleaseCatalog(rows);
    expect(result.problems).toEqual([]);
    expect(result.lessons.map(row => row.id)).toEqual(['l']);
    expect(result.archivedLessonCount).toBe(1);
    expect(rows).toEqual(before);
  });

  it.each(['adventures', 'sagas', 'topics'] as const)('refuses active children beneath archived %s', table => {
    const rows = fixture();
    rows[table][0]!.status = 'archived';
    expect(selectReleaseCatalog(rows).problems.some(problem => problem.includes('archived or missing'))).toBe(true);
  });

  it('requires explicit retirement of empty branches', () => {
    const rows = fixture();
    rows.topics[1]!.status = 'published';
    expect(selectReleaseCatalog(rows).problems).toContain('Active topic old-t has no active lesson');
  });

  it('refuses a course containing only archived lessons', () => {
    const rows = fixture();
    for (const table of Object.values(rows)) for (const row of table) row.status = 'archived';
    expect(selectReleaseCatalog(rows).problems).toContain('A release needs at least one non-archived lesson');
  });
});
