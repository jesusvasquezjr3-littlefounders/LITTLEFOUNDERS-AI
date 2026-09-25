import { describe, expect, it } from 'vitest';
import type { TopicKcLink } from './kcTopicMap.js';
import { indexLiveTopics, planTopicKcRows, seedTopicKcLinks, unmappedPublishedTopics, type LiveTopicRow, type RestFn } from './topicKcSeed.js';

const live = (id: string, course: string, adv: string, saga: string, slug: string, status = 'published'): LiveTopicRow => ({
  id, slug, status, sagas: { slug: saga, adventures: { slug: adv, courses: { slug: course } } },
});

const links: TopicKcLink[] = [
  { course: 'fe', topicPath: 'a/s/t1', kcKey: 'k.one', role: 'teaches', isPrimary: true },
  { course: 'fe', topicPath: 'a/s/t1', kcKey: 'k.two', role: 'teaches', isPrimary: false },
  { course: 'fe', topicPath: 'a/s/r1', kcKey: 'k.one', role: 'reviews', isPrimary: false },
  { course: 'fe', topicPath: 'a/s/unpublished', kcKey: 'k.one', role: 'teaches', isPrimary: true },
];
const kcIds = new Map([['k.one', 'kc-1'], ['k.two', 'kc-2']]);

describe('topic → KC seed plan', () => {
  it('indexes live topics by course and full path, so repeated review slugs never collide', () => {
    const index = indexLiveTopics([
      live('t-1', 'fe', 'a', 's', 'el-cofre-del-repaso'),
      live('t-2', 'fe', 'b', 's', 'el-cofre-del-repaso'),
      { id: 'orphan', slug: 'x', status: 'published', sagas: null },
    ]);
    expect([...index.keys()]).toEqual(['fe/a/s/el-cofre-del-repaso', 'fe/b/s/el-cofre-del-repaso']);
  });

  it('plans one row per resolvable link and reports what the live catalog lacks', () => {
    const index = indexLiveTopics([live('t-1', 'fe', 'a', 's', 't1'), live('r-1', 'fe', 'a', 's', 'r1')]);
    const plan = planTopicKcRows([...links, { course: 'fe', topicPath: 'a/s/t1', kcKey: 'k.ghost', role: 'teaches', isPrimary: false }], index, kcIds, 1);
    expect(plan.rows).toEqual([
      { topic_id: 't-1', kc_id: 'kc-1', role: 'teaches', is_primary: true, map_version: 1 },
      { topic_id: 't-1', kc_id: 'kc-2', role: 'teaches', is_primary: false, map_version: 1 },
      { topic_id: 'r-1', kc_id: 'kc-1', role: 'reviews', is_primary: false, map_version: 1 },
    ]);
    expect(plan.missingTopics).toEqual(['fe/a/s/unpublished']);
    expect(plan.missingKcs).toEqual(['k.ghost']);
  });

  it('flags a published live topic the map does not cover, and ignores draft ones', () => {
    const index = indexLiveTopics([live('t-1', 'fe', 'a', 's', 't1'), live('t-9', 'fe', 'a', 's', 'new-topic'), live('t-8', 'fe', 'a', 's', 'draft-topic', 'draft')]);
    expect(unmappedPublishedTopics(index, links)).toEqual(['fe/a/s/new-topic']);
  });
});

describe('seedTopicKcLinks', () => {
  function fakeRest(existing: Array<{ topic_id: string; kc_id: string }>, failOn?: string) {
    const calls: Array<{ path: string; method: string; body: unknown }> = [];
    const rest: RestFn = async <T>(path: string, init?: { method?: string; body?: string }) => {
      calls.push({ path, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : undefined });
      if (failOn && path.startsWith(failOn)) return null;
      if (path.startsWith('/topics?')) return [live('t-1', 'fe', 'a', 's', 't1'), live('r-1', 'fe', 'a', 's', 'r1')] as T;
      if (path.startsWith('/topic_knowledge_components?select=')) return existing as T;
      return [] as T;
    };
    return { rest, calls };
  }

  it('writes every link non-primary first, then promotes primaries, and counts stale links without deleting them', async () => {
    const { rest, calls } = fakeRest([{ topic_id: 't-1', kc_id: 'kc-1' }, { topic_id: 't-1', kc_id: 'kc-old' }]);
    const report = await seedTopicKcLinks(rest, links, kcIds, 1);
    const writes = calls.filter((c) => c.method === 'POST');
    expect(writes).toHaveLength(2);
    expect((writes[0]!.body as Array<{ is_primary: boolean }>).every((r) => !r.is_primary)).toBe(true);
    expect(writes[0]!.body as unknown[]).toHaveLength(3);
    expect((writes[1]!.body as Array<{ topic_id: string; kc_id: string; is_primary: boolean }>).map((r) => [r.topic_id, r.kc_id, r.is_primary])).toEqual([['t-1', 'kc-1', true]]);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(report).toMatchObject({ written: 3, staleLinks: 1, missingTopics: ['fe/a/s/unpublished'], unmappedPublished: [] });
  });

  it('fails loudly when the table is missing or the catalog is unreadable, never pretending success', async () => {
    await expect(seedTopicKcLinks(fakeRest([], '/topic_knowledge_components?on_conflict').rest, links, kcIds, 1)).rejects.toThrow(/data-layer migration/);
    await expect(seedTopicKcLinks(fakeRest([], '/topics?').rest, links, kcIds, 1)).rejects.toThrow(/could not read topics/);
    await expect(seedTopicKcLinks(fakeRest([]).rest, links, new Map([['k.one', 'kc-1']]), 1)).rejects.toThrow(/missing from kc: k.two/);
  });
});
