import type { TopicKcLink } from './kcTopicMap.js';

/*
 * Writes the topic → KC map into topic_knowledge_components (0112) for
 * `npm run seed:kc`. Separated from the operator script so the resolution and
 * write plan are unit-testable with an injected REST function.
 *
 * Posture, same as the KC seed: idempotent upserts, never a silent delete. A
 * link that exists in the database but no longer in the map is REPORTED as
 * stale; removing it is an authoring decision with its own review.
 */

export type RestFn = <T>(path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<T | null>;

export interface LiveTopicRow {
  id: string;
  slug: string;
  status: string;
  sagas: { slug: string; adventures: { slug: string; courses: { slug: string } } } | null;
}

export interface LiveTopic {
  id: string;
  status: string;
}

/** "<course>/<adventure>/<saga>/<topic>" → live topic. */
export function indexLiveTopics(rows: readonly LiveTopicRow[]): Map<string, LiveTopic> {
  const index = new Map<string, LiveTopic>();
  for (const row of rows) {
    const saga = row.sagas;
    const course = saga?.adventures?.courses?.slug;
    if (!saga || !course) continue;
    index.set(`${course}/${saga.adventures.slug}/${saga.slug}/${row.slug}`, { id: row.id, status: row.status });
  }
  return index;
}

export interface TopicKcRow {
  topic_id: string;
  kc_id: string;
  role: 'teaches' | 'reviews';
  is_primary: boolean;
  map_version: number;
}

export interface TopicKcPlan {
  rows: TopicKcRow[];
  /** Map topics the live catalog does not have (not yet published or renamed). */
  missingTopics: string[];
  /** KC keys the live kc table does not have (seed the graph first). */
  missingKcs: string[];
}

export function planTopicKcRows(
  links: readonly TopicKcLink[],
  topics: ReadonlyMap<string, LiveTopic>,
  kcIdByKey: ReadonlyMap<string, string>,
  mapVersion: number,
): TopicKcPlan {
  const rows: TopicKcRow[] = [];
  const missingTopics = new Set<string>();
  const missingKcs = new Set<string>();
  for (const link of links) {
    const topic = topics.get(`${link.course}/${link.topicPath}`);
    const kcId = kcIdByKey.get(link.kcKey);
    if (!topic) missingTopics.add(`${link.course}/${link.topicPath}`);
    if (!kcId) missingKcs.add(link.kcKey);
    if (!topic || !kcId) continue;
    rows.push({ topic_id: topic.id, kc_id: kcId, role: link.role, is_primary: link.isPrimary, map_version: mapVersion });
  }
  return { rows, missingTopics: [...missingTopics].sort(), missingKcs: [...missingKcs].sort() };
}

/** Published live topics the map does not cover: the audit that makes "every published topic" checkable. */
export function unmappedPublishedTopics(topics: ReadonlyMap<string, LiveTopic>, links: readonly TopicKcLink[]): string[] {
  const mapped = new Set(links.map((l) => `${l.course}/${l.topicPath}`));
  return [...topics.entries()].filter(([key, t]) => t.status === 'published' && !mapped.has(key)).map(([key]) => key).sort();
}

export interface TopicKcSeedReport extends TopicKcPlan {
  written: number;
  staleLinks: number;
  unmappedPublished: string[];
}

const CHUNK = 500;

/**
 * Two passes keep the one-primary-per-topic unique index satisfied while a
 * primary moves from one KC to another: first every link is written as
 * non-primary, then the primaries are promoted.
 */
export async function seedTopicKcLinks(
  rest: RestFn,
  links: readonly TopicKcLink[],
  kcIdByKey: ReadonlyMap<string, string>,
  mapVersion: number,
): Promise<TopicKcSeedReport> {
  const liveRows = await rest<LiveTopicRow[]>(
    '/topics?select=id,slug,status,sagas!inner(slug,adventures!inner(slug,courses!inner(slug)))&limit=20000',
  );
  if (liveRows === null) throw new Error('could not read topics — is the course hierarchy reachable?');
  const topics = indexLiveTopics(liveRows);
  const plan = planTopicKcRows(links, topics, kcIdByKey, mapVersion);
  if (plan.missingKcs.length > 0) throw new Error(`topic map names KCs missing from kc: ${plan.missingKcs.join(', ')}`);

  const write = async (rows: TopicKcRow[]): Promise<void> => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const res = await rest<unknown>('/topic_knowledge_components?on_conflict=topic_id,kc_id', {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify(rows.slice(i, i + CHUNK).map((r) => ({ ...r, updated_at: new Date().toISOString() }))),
      });
      if (res === null) throw new Error('topic_knowledge_components upsert failed — is the B.6 data-layer migration applied?');
    }
  };
  await write(plan.rows.map((r) => ({ ...r, is_primary: false })));
  await write(plan.rows.filter((r) => r.is_primary));

  const existing = await rest<Array<{ topic_id: string; kc_id: string }>>('/topic_knowledge_components?select=topic_id,kc_id&limit=50000');
  if (existing === null) throw new Error('could not read back topic_knowledge_components');
  const planned = new Set(plan.rows.map((r) => `${r.topic_id}:${r.kc_id}`));
  const staleLinks = existing.filter((r) => !planned.has(`${r.topic_id}:${r.kc_id}`)).length;

  return { ...plan, written: plan.rows.length, staleLinks, unmappedPublished: unmappedPublishedTopics(topics, links) };
}
