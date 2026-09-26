import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SeedSchema } from '../../scripts/seed-kc-graph.js';
import {
  KcTopicMapSchema,
  deriveTopicKcLinks,
  resolveReviewedTeachingTopics,
  summarizeKcTopicMap,
  validateKcTopicMap,
  type KcTopicMap,
} from './kcTopicMap.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const seeds = path.resolve(here, '../../../../database/seeds');
const graph = SeedSchema.parse(JSON.parse(readFileSync(path.join(seeds, 'kc_graph.v1.json'), 'utf8')));
const map = KcTopicMapSchema.parse(JSON.parse(readFileSync(path.join(seeds, 'kc_topic_map.v1.json'), 'utf8')));

/** The 28 KCs the Mentor shipped with (0052 seed), 24 of which had a content bridge before S05.3a. */
const ORIGINAL_28 = graph.kcs.filter((k) => k.status === 'active').map((k) => k.key);

describe('the real B.6 topic map (S05.3a)', () => {
  it('agrees with the real KC graph: no unknown KC, no silent gap, Mentor bridge inside the course map', () => {
    expect(validateKcTopicMap(map, graph.kcs)).toEqual([]);
  });

  it('covers every curriculum topic of the four courses (counts pinned to the audited catalog)', () => {
    expect(summarizeKcTopicMap(map)).toMatchObject({ courses: 4, topics: 882, teachingTopics: 609, reviewTopics: 273 });
    expect(map.courses.map((c) => [c.course, c.topics.length])).toEqual([
      ['financial-education', 328],
      ['investing', 272],
      ['entrepreneurship', 272],
      ['first-lemonade-stand', 10],
    ]);
  });

  it('links every topic, teaching or review, to at least one KC', () => {
    const linked = new Set(deriveTopicKcLinks(map).map((l) => `${l.course}/${l.topicPath}`));
    for (const course of map.courses) {
      for (const topic of course.topics) expect(linked.has(`${course.course}/${topic.path}`), `${course.course}/${topic.path}`).toBe(true);
    }
  });

  it('gives every teaching topic exactly one primary KC and review topics none', () => {
    const links = deriveTopicKcLinks(map);
    for (const course of map.courses) {
      for (const topic of course.topics) {
        const primaries = links.filter((l) => l.course === course.course && l.topicPath === topic.path && l.isPrimary);
        expect(primaries.length, topic.path).toBe(topic.kind === 'teaching' ? 1 : 0);
        if (topic.kind === 'teaching') expect(primaries[0]!.kcKey).toBe(topic.teaches[0]);
      }
    }
  });

  it('keeps the original 28 KCs active and every S05.3a addition draft, 100 KCs in all', () => {
    expect(ORIGINAL_28).toHaveLength(28);
    expect(graph.kcs).toHaveLength(100);
    expect(graph.kcs.filter((k) => k.status === 'draft')).toHaveLength(72);
    for (const kc of graph.kcs.filter((k) => k.status === 'draft')) expect(kc.skill_key ?? null, kc.key).toBeNull();
  });

  it('teaches 26 of the original 28 KCs and declares the other two as reasoned content gaps, not silent nulls', () => {
    const taught = new Set(deriveTopicKcLinks(map).filter((l) => l.role === 'teaches').map((l) => l.kcKey));
    const untaught = ORIGINAL_28.filter((k) => !taught.has(k)).sort();
    expect(untaught).toEqual(['biz.goods-vs-services', 'money.fraction-of-amount']);
    expect(map.content_gaps.map((g) => g.kc).sort()).toEqual(untaught);
    // The two Mentor-unbridged KCs that DO have catalog content now reach it through the teen pathway.
    expect(taught.has('money.percent-intro')).toBe(true);
    expect(taught.has('biz.risk-and-reward')).toBe(true);
    // Every KC added in S05.3a is taught somewhere: none was invented without content.
    for (const kc of graph.kcs.filter((k) => k.status === 'draft')) expect(taught.has(kc.key), kc.key).toBe(true);
  });
});

const fixture = (): KcTopicMap => ({
  version: 1,
  courses: [{
    course: 'c',
    topics: [
      { path: 'a/s1/t1', kind: 'teaching', teaches: ['k.one'] },
      { path: 'a/s1/t2', kind: 'teaching', teaches: ['k.two', 'k.one'] },
      { path: 'a/s1/r1', kind: 'review_spaced', review_of: ['a/s1'] },
      { path: 'a/s2/t3', kind: 'teaching', teaches: ['k.three'] },
      { path: 'a/m/q1', kind: 'review_quest', review_of: ['a/s1/r1', 'a/s2/t3'], teaches: ['k.four'] },
    ],
  }],
  content_gaps: [],
});
const fixtureGraph = [{ key: 'k.one' }, { key: 'k.two' }, { key: 'k.three' }, { key: 'k.four' }];

describe('review derivation', () => {
  it('resolves a saga citation to its teaching topics only and follows a cited review topic', () => {
    const topics = fixture().courses[0]!.topics;
    expect(resolveReviewedTeachingTopics(topics, ['a/s1']).map((t) => t.path)).toEqual(['a/s1/t1', 'a/s1/t2']);
    expect(resolveReviewedTeachingTopics(topics, ['a/s1/r1', 'a/s2/t3']).map((t) => t.path).sort()).toEqual(['a/s1/t1', 'a/s1/t2', 'a/s2/t3']);
  });

  it('terminates on a citation cycle instead of hanging', () => {
    const topics: KcTopicMap['courses'][number]['topics'] = [
      { path: 'a/s/r1', kind: 'review_spaced', review_of: ['a/s/r2'] },
      { path: 'a/s/r2', kind: 'review_spaced', review_of: ['a/s/r1'] },
    ];
    expect(resolveReviewedTeachingTopics(topics, ['a/s/r1'])).toEqual([]);
  });

  it('derives reviews links, keeps explicit lesson-verified teaches first, and never duplicates a KC per topic', () => {
    const links = deriveTopicKcLinks(fixture());
    expect(links.filter((l) => l.topicPath === 'a/s1/r1').map((l) => [l.kcKey, l.role])).toEqual([['k.one', 'reviews'], ['k.two', 'reviews']]);
    expect(links.filter((l) => l.topicPath === 'a/m/q1').map((l) => [l.kcKey, l.role])).toEqual([
      ['k.four', 'teaches'], ['k.one', 'reviews'], ['k.two', 'reviews'], ['k.three', 'reviews'],
    ]);
    expect(links.filter((l) => l.topicPath === 'a/s1/t2').map((l) => [l.kcKey, l.isPrimary])).toEqual([['k.two', true], ['k.one', false]]);
  });
});

describe('validateKcTopicMap refuses every drift it exists to catch', () => {
  it('passes the clean fixture', () => {
    expect(validateKcTopicMap(fixture(), fixtureGraph)).toEqual([]);
  });

  it('refuses an unknown KC', () => {
    const bad = fixture();
    bad.courses[0]!.topics[0] = { path: 'a/s1/t1', kind: 'teaching', teaches: ['k.ghost'] };
    expect(validateKcTopicMap(bad, [...fixtureGraph, { key: 'k.ghost2' }]).map((i) => i.code)).toContain('unknown-kc');
  });

  it('refuses a KC that no topic teaches unless it is a declared gap, and a declared gap that is taught', () => {
    expect(validateKcTopicMap(fixture(), [...fixtureGraph, { key: 'k.orphan' }]).map((i) => i.code)).toEqual(['untaught-kc']);
    const declared = { ...fixture(), content_gaps: [{ kc: 'k.orphan', reason: 'No topic teaches this yet; author one.' }] };
    expect(validateKcTopicMap(declared, [...fixtureGraph, { key: 'k.orphan' }])).toEqual([]);
    const wrongGap = { ...fixture(), content_gaps: [{ kc: 'k.one', reason: 'Claimed missing but actually taught.' }] };
    expect(validateKcTopicMap(wrongGap, fixtureGraph).map((i) => i.code)).toEqual(['gap-is-taught']);
  });

  it('refuses a Mentor bridge that points at a topic the course map does not link to that KC', () => {
    expect(validateKcTopicMap(fixture(), [...fixtureGraph.slice(1), { key: 'k.one', skill_key: 'c/t3' }]).map((i) => i.code)).toEqual(['bridge-disagrees']);
    expect(validateKcTopicMap(fixture(), [...fixtureGraph.slice(1), { key: 'k.one', skill_key: 'c/t1' }])).toEqual([]);
    // A bridge reached only through a review topic is still inside the map.
    expect(validateKcTopicMap(fixture(), [...fixtureGraph.slice(1), { key: 'k.one', skill_key: 'c/r1' }])).toEqual([]);
    expect(validateKcTopicMap(fixture(), [...fixtureGraph.slice(1), { key: 'k.one', skill_key: 'c/nowhere' }]).map((i) => i.code)).toEqual(['bridge-unresolved']);
  });

  it('refuses a review or requirement citation that resolves to nothing, and duplicates', () => {
    const bad = fixture();
    bad.courses[0]!.topics.push({ path: 'a/s3/r9', kind: 'review_spaced', review_of: ['a/nowhere'] });
    bad.courses[0]!.topics.push({ path: 'a/s1/t1', kind: 'teaching', teaches: ['k.one', 'k.one'], requires: ['a/ghost/x'] });
    const codes = validateKcTopicMap(bad, fixtureGraph).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['review-resolves-nothing', 'unresolved-review-citation', 'duplicate-topic', 'duplicate-kc', 'unresolved-requirement']));
  });

  it('rejects a malformed map at the schema boundary', () => {
    expect(KcTopicMapSchema.safeParse({ ...fixture(), courses: [{ course: 'c', topics: [{ path: 'a/s/t', kind: 'teaching', teaches: [] }] }] }).success).toBe(false);
    expect(KcTopicMapSchema.safeParse({ ...fixture(), courses: [{ course: 'c', topics: [{ path: 'a/s/t', kind: 'review_spaced', teaches: ['k.one'] }] }] }).success).toBe(false);
    expect(KcTopicMapSchema.safeParse({ ...fixture(), extra: true }).success).toBe(false);
  });
});
