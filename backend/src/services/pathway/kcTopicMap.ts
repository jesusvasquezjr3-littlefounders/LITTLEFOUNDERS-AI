import { z } from 'zod';

/*
 * B.6 (S05.3a) — the topic → knowledge-component map, the one bridge between
 * the course catalog and the Mentor's knowledge-component graph (0052).
 *
 * WHY A MAP AND NOT A SECOND GRAPH. The SPEC forbids a course-specific
 * progression model parallel to the Mentor's (Product 10 B.6). The course
 * engine therefore owns no competency nodes of its own: each topic declares
 * which of the SHARED KCs it teaches, and review topics inherit the KCs of
 * the teaching topics they cite. Mastery, prerequisites and review cards stay
 * in the Mentor's tables; the pathway policy (pathwayPolicy.ts) reads both.
 *
 * The authored source is `database/seeds/kc_topic_map.v1.json`. Coursegen's
 * `npm run kc:map -- --check` proves it lists every curriculum topic with the
 * same kind and review_of the YAML declares; this module proves it agrees
 * with the KC graph and derives the rows `seed:kc` writes to
 * `topic_knowledge_components`. Everything here is pure, so the policy is
 * testable without a database.
 */

const kcKey = z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,95}$/);
const topicPath = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
const reviewOfPath = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/);

const teachingTopic = z.object({
  path: topicPath,
  kind: z.literal('teaching'),
  teaches: z.array(kcKey).min(1).max(8),
  /** The YAML's hard topic prerequisites (topic or saga paths), repeated so the frontier can be exercised on the whole catalog. */
  requires: z.array(reviewOfPath).min(1).optional(),
}).strict();

const reviewTopic = z.object({
  path: topicPath,
  kind: z.enum(['review_spaced', 'review_interleaved', 'review_quest']),
  review_of: z.array(reviewOfPath).min(1),
  /** KCs a review topic's own lessons grade as new application (lesson-verified), beyond what it reviews. */
  teaches: z.array(kcKey).min(1).max(8).optional(),
  requires: z.array(reviewOfPath).min(1).optional(),
}).strict();

export const KcTopicMapSchema = z.object({
  $comment: z.string().optional(),
  version: z.literal(1),
  courses: z.array(z.object({
    course: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    topics: z.array(z.discriminatedUnion('kind', [teachingTopic, reviewTopic])).min(1),
  }).strict()).min(1),
  content_gaps: z.array(z.object({ kc: kcKey, reason: z.string().min(20).max(600) }).strict()),
}).strict();

export type KcTopicMap = z.infer<typeof KcTopicMapSchema>;
export type MapTopic = KcTopicMap['courses'][number]['topics'][number];

export type TopicKcRole = 'teaches' | 'reviews';

export interface TopicKcLink {
  course: string;
  topicPath: string;
  kcKey: string;
  role: TopicKcRole;
  /** Exactly one per teaching topic: the first KC it lists. Review topics carry none. */
  isPrimary: boolean;
}

export interface GraphKcLite {
  key: string;
  status?: 'draft' | 'active';
  skill_key?: string | null;
}

export interface MapIssue {
  code: string;
  message: string;
}

/**
 * A review topic's cited teaching topics, resolved against its own course.
 * A saga path ("adv/saga") cites every TEACHING topic of that saga; a topic
 * path cites that topic, and a cited review topic is followed to what it
 * reviews. The visited set makes a citation cycle terminate instead of hang.
 */
export function resolveReviewedTeachingTopics(
  topics: readonly MapTopic[],
  reviewOf: readonly string[],
): Array<Extract<MapTopic, { kind: 'teaching' }>> {
  const byPath = new Map(topics.map((t) => [t.path, t]));
  const out = new Map<string, Extract<MapTopic, { kind: 'teaching' }>>();
  const visited = new Set<string>();
  const visit = (citation: string): void => {
    if (visited.has(citation)) return;
    visited.add(citation);
    const topic = byPath.get(citation);
    if (topic) {
      if (topic.kind === 'teaching') out.set(topic.path, topic);
      else topic.review_of.forEach(visit);
      return;
    }
    for (const candidate of topics) {
      if (candidate.kind === 'teaching' && candidate.path.startsWith(`${citation}/`) && candidate.path.split('/').length === 3) {
        out.set(candidate.path, candidate);
      }
    }
  };
  reviewOf.forEach(visit);
  return [...out.values()];
}

/** Every link row the map implies, deterministic and de-duplicated per (topic, KC). */
export function deriveTopicKcLinks(map: KcTopicMap): TopicKcLink[] {
  const links: TopicKcLink[] = [];
  for (const course of map.courses) {
    for (const topic of course.topics) {
      const seen = new Set<string>();
      const push = (kc: string, role: TopicKcRole, isPrimary: boolean): void => {
        if (seen.has(kc)) return;
        seen.add(kc);
        links.push({ course: course.course, topicPath: topic.path, kcKey: kc, role, isPrimary });
      };
      if (topic.kind === 'teaching') {
        topic.teaches.forEach((kc, index) => push(kc, 'teaches', index === 0));
        continue;
      }
      // Explicit, lesson-verified application first: it is stronger evidence than a derived review link.
      (topic.teaches ?? []).forEach((kc) => push(kc, 'teaches', false));
      for (const cited of resolveReviewedTeachingTopics(course.topics, topic.review_of)) {
        cited.teaches.forEach((kc) => push(kc, 'reviews', false));
      }
    }
  }
  return links;
}

/**
 * Agreement between the map and the KC graph. An empty result is the gate:
 *  - every KC the map names exists in the graph;
 *  - every graph KC is taught by at least one topic OR is declared a content
 *    gap with a reason, and a declared gap is never silently taught;
 *  - every review topic derives at least one KC and every citation resolves;
 *  - the Mentor's own bridge (kc.skill_key = "course/topic-slug") points at a
 *    topic that links that KC, so the two brains cannot disagree about where a
 *    KC is taught (the contradiction B.6 exists to prevent).
 */
export function validateKcTopicMap(map: KcTopicMap, graph: readonly GraphKcLite[]): MapIssue[] {
  const issues: MapIssue[] = [];
  const keys = new Set(graph.map((k) => k.key));
  const courses = new Set<string>();
  for (const course of map.courses) {
    if (courses.has(course.course)) issues.push({ code: 'duplicate-course', message: `${course.course} is listed twice` });
    courses.add(course.course);
    const paths = new Set<string>();
    for (const topic of course.topics) {
      if (paths.has(topic.path)) issues.push({ code: 'duplicate-topic', message: `${course.course}/${topic.path} is listed twice` });
      paths.add(topic.path);
      for (const citation of topic.requires ?? []) {
        if (resolveReviewedTeachingTopics(course.topics, [citation]).length === 0) {
          issues.push({ code: 'unresolved-requirement', message: `${course.course}/${topic.path} requires ${citation}, which resolves to no teaching topic` });
        }
      }
      for (const kc of topic.teaches ?? []) {
        if (!keys.has(kc)) issues.push({ code: 'unknown-kc', message: `${course.course}/${topic.path} names unknown KC ${kc}` });
      }
      if (topic.kind !== 'teaching') {
        if (new Set(topic.teaches ?? []).size !== (topic.teaches ?? []).length) issues.push({ code: 'duplicate-kc', message: `${course.course}/${topic.path} repeats a KC` });
        const cited = resolveReviewedTeachingTopics(course.topics, topic.review_of);
        if (cited.length === 0) issues.push({ code: 'review-resolves-nothing', message: `${course.course}/${topic.path} cites no teaching topic` });
        for (const citation of topic.review_of) {
          if (resolveReviewedTeachingTopics(course.topics, [citation]).length === 0) {
            issues.push({ code: 'unresolved-review-citation', message: `${course.course}/${topic.path} cites ${citation}, which resolves to no teaching topic` });
          }
        }
      } else if (new Set(topic.teaches).size !== topic.teaches.length) {
        issues.push({ code: 'duplicate-kc', message: `${course.course}/${topic.path} repeats a KC` });
      }
    }
  }

  const links = deriveTopicKcLinks(map);
  const taught = new Set(links.filter((l) => l.role === 'teaches').map((l) => l.kcKey));
  const gaps = new Map(map.content_gaps.map((g) => [g.kc, g]));
  for (const gap of map.content_gaps) {
    if (!keys.has(gap.kc)) issues.push({ code: 'unknown-gap-kc', message: `content gap names unknown KC ${gap.kc}` });
    if (taught.has(gap.kc)) issues.push({ code: 'gap-is-taught', message: `${gap.kc} is declared a content gap but a topic teaches it` });
  }
  for (const kc of graph) {
    if (!taught.has(kc.key) && !gaps.has(kc.key)) issues.push({ code: 'untaught-kc', message: `${kc.key} is taught by no topic and is not declared a content gap` });
  }

  // The Mentor's content bridge must be a subset of the course map.
  const linkedKcsByTopic = new Map<string, Set<string>>();
  for (const link of links) {
    const id = `${link.course}/${link.topicPath}`;
    linkedKcsByTopic.set(id, (linkedKcsByTopic.get(id) ?? new Set()).add(link.kcKey));
  }
  for (const kc of graph) {
    if (!kc.skill_key) continue;
    const [courseSlug, topicSlug] = kc.skill_key.split('/');
    // Financial Education V2 replaced the legacy three-level catalog whose
    // paths this B.6 map describes. Its canonical lesson ids are verified
    // against hierarchy.rows.json by seedKcGraph.test.ts; do not reject those
    // current bridges merely because the retired V1 map cannot resolve them.
    if (courseSlug === 'financial-education' && /^fe-(?:69|1012|1317|adult)-/.test(topicSlug ?? '')) continue;
    const course = map.courses.find((c) => c.course === courseSlug);
    const matches = course?.topics.filter((t) => t.path.split('/')[2] === topicSlug) ?? [];
    if (matches.length !== 1) {
      issues.push({ code: 'bridge-unresolved', message: `${kc.key}.skill_key ${kc.skill_key} matches ${matches.length} topics` });
      continue;
    }
    if (!linkedKcsByTopic.get(`${courseSlug}/${matches[0]!.path}`)?.has(kc.key)) {
      issues.push({ code: 'bridge-disagrees', message: `${kc.key}.skill_key ${kc.skill_key} points at a topic the course map does not link to ${kc.key}` });
    }
  }
  return issues;
}

/** Counts reported by seed:kc and recorded in the sprint evidence. */
export function summarizeKcTopicMap(map: KcTopicMap): {
  courses: number;
  topics: number;
  teachingTopics: number;
  reviewTopics: number;
  links: number;
  teachesLinks: number;
  reviewsLinks: number;
  taughtKcs: number;
} {
  const links = deriveTopicKcLinks(map);
  const topics = map.courses.flatMap((c) => c.topics);
  return {
    courses: map.courses.length,
    topics: topics.length,
    teachingTopics: topics.filter((t) => t.kind === 'teaching').length,
    reviewTopics: topics.filter((t) => t.kind !== 'teaching').length,
    links: links.length,
    teachesLinks: links.filter((l) => l.role === 'teaches').length,
    reviewsLinks: links.filter((l) => l.role === 'reviews').length,
    taughtKcs: new Set(links.filter((l) => l.role === 'teaches').map((l) => l.kcKey)).size,
  };
}
