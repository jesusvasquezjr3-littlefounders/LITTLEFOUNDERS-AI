/*
 * kcTopicMap.ts — keeps database/seeds/kc_topic_map.v1.json in lockstep with
 * the curriculum YAML (B.6, S05.3a).
 *
 * The map says which of the Mentor's shared knowledge components each topic
 * teaches (authored in the map, reviewed with the B.6 pathway policy) and
 * repeats three facts the YAML owns: every topic's kind, a review topic's
 * review_of, and hard topic prerequisites (`requires`). Core derives review
 * links and simulates the frontier from those repeated facts without reading
 * YAML, so they must never drift. This module is the drift gate
 * (`npm run kc:map -- --check`, also a vitest) and the one sanctioned way to
 * refresh the repeated facts (`--write`), which never invents a KC for a
 * topic: an unassigned teaching topic is an error a person resolves.
 *
 * Deliberately schema-light on the KC side: whether a named KC exists is
 * Core's check (backend services/pathway/kcTopicMap.ts) against the graph.
 */

import { z } from 'zod';
import type { CourseCatalog } from './loader.js';

const topicEntrySchema = z
  .object({
    path: z.string().min(5),
    kind: z.enum(['teaching', 'review_spaced', 'review_interleaved', 'review_quest']),
    teaches: z.array(z.string().min(3)).min(1).optional(),
    review_of: z.array(z.string().min(3)).min(1).optional(),
    requires: z.array(z.string().min(3)).min(1).optional(),
  })
  .strict();

export const kcTopicMapFileSchema = z
  .object({
    $comment: z.string().optional(),
    version: z.literal(1),
    courses: z.array(z.object({ course: z.string().min(1), topics: z.array(topicEntrySchema) }).strict()),
    content_gaps: z.array(z.object({ kc: z.string().min(3), reason: z.string().min(20) }).strict()),
  })
  .strict();

export type KcTopicMapFile = z.infer<typeof kcTopicMapFileSchema>;
export type KcTopicEntry = z.infer<typeof topicEntrySchema>;

export interface CatalogTopicFacts {
  path: string;
  kind: KcTopicEntry['kind'];
  review_of?: string[];
  requires?: string[];
}

/** The facts the map repeats, in authored order, for one loaded course. */
export function catalogTopicFacts(course: CourseCatalog): CatalogTopicFacts[] {
  const facts: CatalogTopicFacts[] = [];
  for (const adventure of course.adventures) {
    for (const saga of adventure.data.sagas) {
      for (const topic of saga.topics) {
        const entry: CatalogTopicFacts = { path: `${adventure.data.adventure.slug}/${saga.slug}/${topic.slug}`, kind: topic.kind };
        if (topic.kind !== 'teaching' && topic.review_of) entry.review_of = [...topic.review_of];
        const hard = (topic.prerequisites ?? []).filter((p) => p.strength === 'hard').map((p) => p.path);
        if (hard.length > 0) entry.requires = hard;
        facts.push(entry);
      }
    }
  }
  return facts;
}

const same = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

/**
 * Every disagreement between the map and the curriculum, as readable lines.
 * Empty = in sync: the same courses, the same topics in the same order, the
 * same kinds, review_of and hard prerequisites, and every teaching topic
 * assigned at least one KC.
 */
export function checkKcTopicMap(map: KcTopicMapFile, courses: ReadonlyArray<{ slug: string; facts: CatalogTopicFacts[] }>): string[] {
  const issues: string[] = [];
  const mapCourses = map.courses.map((c) => c.course);
  const catalogCourses = courses.map((c) => c.slug);
  for (const slug of catalogCourses) if (!mapCourses.includes(slug)) issues.push(`course ${slug} is missing from the map`);
  for (const slug of mapCourses) if (!catalogCourses.includes(slug)) issues.push(`course ${slug} is in the map but not in the curriculum`);
  for (const course of courses) {
    const entries = map.courses.find((c) => c.course === course.slug)?.topics;
    if (!entries) continue;
    const byPath = new Map(entries.map((e) => [e.path, e]));
    const catalogPaths = course.facts.map((f) => f.path);
    for (const fact of course.facts) {
      const entry = byPath.get(fact.path);
      if (!entry) {
        issues.push(`${course.slug}/${fact.path} is not in the map`);
        continue;
      }
      if (entry.kind !== fact.kind) issues.push(`${course.slug}/${fact.path} kind ${entry.kind} ≠ curriculum ${fact.kind}`);
      if (!same(entry.review_of, fact.review_of)) issues.push(`${course.slug}/${fact.path} review_of differs from the curriculum`);
      if (!same(entry.requires, fact.requires)) issues.push(`${course.slug}/${fact.path} requires differs from the curriculum's hard prerequisites`);
      if (fact.kind === 'teaching' && !entry.teaches?.length) issues.push(`${course.slug}/${fact.path} is a teaching topic with no KC`);
    }
    for (const entry of entries) if (!catalogPaths.includes(entry.path)) issues.push(`${course.slug}/${entry.path} is in the map but not in the curriculum`);
    const mapOrder = entries.map((e) => e.path).filter((p) => catalogPaths.includes(p));
    if (issues.length === 0 && JSON.stringify(mapOrder) !== JSON.stringify(catalogPaths)) issues.push(`${course.slug}: topic order differs from the curriculum`);
  }
  return issues;
}

/**
 * Rebuild the map from the curriculum, keeping every authored `teaches`
 * list. Returns issues (unassigned teaching topics) instead of guessing.
 */
export function syncKcTopicMap(map: KcTopicMapFile, courses: ReadonlyArray<{ slug: string; facts: CatalogTopicFacts[] }>): { map: KcTopicMapFile; issues: string[] } {
  const issues: string[] = [];
  const next: KcTopicMapFile = {
    ...(map.$comment ? { $comment: map.$comment } : {}),
    version: 1,
    courses: courses.map((course) => {
      const previous = new Map((map.courses.find((c) => c.course === course.slug)?.topics ?? []).map((e) => [e.path, e]));
      return {
        course: course.slug,
        topics: course.facts.map((fact) => {
          const teaches = previous.get(fact.path)?.teaches;
          if (fact.kind === 'teaching' && !teaches?.length) issues.push(`${course.slug}/${fact.path} needs a KC assignment`);
          const entry: KcTopicEntry = { path: fact.path, kind: fact.kind };
          if (fact.kind === 'teaching') entry.teaches = teaches ?? [];
          if (fact.review_of) entry.review_of = fact.review_of;
          if (fact.kind !== 'teaching' && teaches?.length) entry.teaches = teaches;
          if (fact.requires) entry.requires = fact.requires;
          return entry;
        }),
      };
    }),
    content_gaps: map.content_gaps,
  };
  return { map: next, issues };
}

/** One topic per line: reviewable diffs for an 882-topic file. */
export function serializeKcTopicMap(map: KcTopicMapFile): string {
  const lines = ['{'];
  if (map.$comment) lines.push(`  "$comment": ${JSON.stringify(map.$comment)},`);
  lines.push(`  "version": ${map.version},`, '  "courses": [');
  map.courses.forEach((course, ci) => {
    lines.push('    {', `      "course": ${JSON.stringify(course.course)},`, '      "topics": [');
    course.topics.forEach((topic, ti) => lines.push(`        ${JSON.stringify(topic)}${ti < course.topics.length - 1 ? ',' : ''}`));
    lines.push('      ]', `    }${ci < map.courses.length - 1 ? ',' : ''}`);
  });
  lines.push('  ],', '  "content_gaps": [');
  map.content_gaps.forEach((gap, i) => lines.push(`    ${JSON.stringify(gap)}${i < map.content_gaps.length - 1 ? ',' : ''}`));
  lines.push('  ]', '}');
  return `${lines.join('\n')}\n`;
}
