import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkKcTopicMap, kcTopicMapFileSchema, serializeKcTopicMap, syncKcTopicMap, type CatalogTopicFacts, type KcTopicMapFile } from '../catalog/kcTopicMap.js';
import { KC_TOPIC_MAP_PATH, loadCurriculumFacts } from '../scripts/kc-topic-map.js';

/*
 * B.6 (S05.3a): the topic → KC map in database/seeds must describe exactly
 * the curriculum Forge publishes. This is the CI face of `npm run kc:map`.
 */

describe('kc_topic_map.v1.json against the real curriculum', () => {
  const raw = readFileSync(KC_TOPIC_MAP_PATH, 'utf8');
  const map = kcTopicMapFileSchema.parse(JSON.parse(raw));
  const courses = loadCurriculumFacts();

  it('is in sync: every course and topic, in order, with the same kinds, review_of and hard prerequisites, and a KC on every teaching topic', () => {
    expect(checkKcTopicMap(map, courses)).toEqual([]);
    expect(courses.map((c) => [c.slug, c.facts.length])).toEqual([
      ['financial-education', 328],
      ['investing', 272],
      ['entrepreneurship', 272],
      ['first-lemonade-stand', 10],
    ]);
  });

  it('round-trips byte for byte through --write, so the file is always the canonical serialization', () => {
    const { map: next, issues } = syncKcTopicMap(map, courses);
    expect(issues).toEqual([]);
    expect(serializeKcTopicMap(next)).toBe(raw.replace(/\r\n/g, '\n'));
  });
});

const facts: CatalogTopicFacts[] = [
  { path: 'a/s/t1', kind: 'teaching' },
  { path: 'a/s/t2', kind: 'teaching', requires: ['a/s/t1'] },
  { path: 'a/s/r', kind: 'review_spaced', review_of: ['a/s'] },
];
const good = (): KcTopicMapFile => ({
  version: 1,
  courses: [{ course: 'c', topics: [
    { path: 'a/s/t1', kind: 'teaching', teaches: ['k.one'] },
    { path: 'a/s/t2', kind: 'teaching', teaches: ['k.two'], requires: ['a/s/t1'] },
    { path: 'a/s/r', kind: 'review_spaced', review_of: ['a/s'] },
  ] }],
  content_gaps: [],
});

describe('checkKcTopicMap catches every drift', () => {
  it('accepts the matching fixture', () => {
    expect(checkKcTopicMap(good(), [{ slug: 'c', facts }])).toEqual([]);
  });

  it('reports a new curriculum topic, a removed one, a changed kind, review_of, requirement, an unassigned topic and a new course', () => {
    const drifted = good();
    drifted.courses[0]!.topics[0] = { path: 'a/s/t1', kind: 'review_quest', review_of: ['a/s/t2'] };
    drifted.courses[0]!.topics[1] = { path: 'a/s/t2', kind: 'teaching', teaches: ['k.two'] };
    drifted.courses[0]!.topics[2] = { path: 'a/s/r', kind: 'review_spaced', review_of: ['a/s/t1'] };
    drifted.courses[0]!.topics.push({ path: 'a/s/gone', kind: 'teaching', teaches: ['k.x'] });
    const issues = checkKcTopicMap(drifted, [{ slug: 'c', facts: [...facts, { path: 'a/s/new', kind: 'teaching' }] }, { slug: 'd', facts: [] }]);
    expect(issues).toEqual([
      'course d is missing from the map',
      'c/a/s/t1 kind review_quest ≠ curriculum teaching',
      'c/a/s/t1 review_of differs from the curriculum',
      'c/a/s/t1 is a teaching topic with no KC',
      "c/a/s/t2 requires differs from the curriculum's hard prerequisites",
      'c/a/s/r review_of differs from the curriculum',
      'c/a/s/new is not in the map',
      'c/a/s/gone is in the map but not in the curriculum',
    ]);
  });

  it('reports a reordered course', () => {
    const reordered = good();
    reordered.courses[0]!.topics.reverse();
    expect(checkKcTopicMap(reordered, [{ slug: 'c', facts }])).toEqual(['c: topic order differs from the curriculum']);
  });

  it('never invents a KC when syncing: an unassigned teaching topic is an error', () => {
    const { issues, map } = syncKcTopicMap(good(), [{ slug: 'c', facts: [...facts, { path: 'a/s/new', kind: 'teaching' }] }]);
    expect(issues).toEqual(['c/a/s/new needs a KC assignment']);
    expect(map.courses[0]!.topics.at(-1)).toEqual({ path: 'a/s/new', kind: 'teaching', teaches: [] });
  });
});
