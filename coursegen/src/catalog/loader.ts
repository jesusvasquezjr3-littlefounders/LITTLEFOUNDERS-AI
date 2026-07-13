// Curriculum catalog loader — COURSE_ENGINE.md §3.
//
// Loads taxonomy.yaml + facts.yaml + catalog.yaml from a course directory,
// resolves the adventure files catalog.yaml points at (relative to
// catalog.yaml itself), Zod-validates every file, and cross-validates
// referential integrity (fact_refs, slug uniqueness per parent, theme/tier/
// family membership against taxonomy, quota deviations as warnings).
//
// Never throws on malformed/missing content — always returns a LoadResult
// with `ok` + a flat issue list, so `catalog:check` can report everything
// wrong in one pass instead of stopping at the first error.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  taxonomyFileSchema,
  factsFileSchema,
  catalogFileSchema,
  adventureFileSchema,
  type TaxonomyFile,
  type FactsFile,
  type CatalogFile,
  type AdventureFile,
} from './schema.js';

export interface LoadIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
}

export interface LoadedAdventure {
  file: string;
  data: AdventureFile;
}

export interface CourseCatalog {
  courseDir: string;
  taxonomy?: TaxonomyFile;
  facts?: FactsFile;
  catalog?: CatalogFile;
  adventures: LoadedAdventure[];
}

export interface LoadResult {
  ok: boolean;
  issues: LoadIssue[];
  course: CourseCatalog;
}

// Coverage-oracle quotas (COURSE_ENGINE.md §3 + §3.1 spaced-review layer) —
// deviations are WARNINGS, never errors. Shape per adventure: 5 sagas
// (4 teaching + 1 review); the review saga carries 6 review_quest topics;
// every topic carries 4 lessons.
//
// Teaching-saga topic count is POSITION-AGNOSTIC breadth-generalized
// (§3.1's "sanctioned teaching-breadth expansion"): a teaching saga carries
// EITHER 6 teaching topics (tier1 adventures 1-5, 152 lessons/adventure) OR
// 8 teaching topics (tier2 adventures 6-8, 184 lessons/adventure) — in both
// cases the 2 review topics (review_spaced then review_interleaved) are
// ALWAYS the LAST two positions of the saga (7-8 for the 6-topic shape, 9-10
// for the 8-topic shape), never a fixed position number.
const EXPECTED_SAGAS_PER_ADVENTURE = 5;
const EXPECTED_TEACHING_SAGAS_PER_ADVENTURE = 4;
const EXPECTED_REVIEW_SAGAS_PER_ADVENTURE = 1;
const TEACHING_TOPIC_COUNT_OPTIONS = [6, 8] as const;
const REVIEW_TOPICS_PER_TEACHING_SAGA = 2;
const EXPECTED_REVIEW_SAGA_TOPICS = 6;
const EXPECTED_LESSONS_PER_TOPIC = 4;
// Course total (COURSE_ENGINE.md §3.1): 5 tier1 adventures × 152 + 3 tier2
// adventures × 184 = 1,312 lessons (864 teaching + 448 review, ~34%
// consolidation). Per-adventure totals below are the per-tier component.
const EXPECTED_TOTAL_LESSONS_BY_TIER: Record<string, number> = { tier1: 152, tier2: 184 };

function readYaml(filePath: string): { data: unknown; error?: string } {
  if (!existsSync(filePath)) return { data: undefined, error: 'file not found' };
  try {
    const raw = readFileSync(filePath, 'utf8');
    return { data: parseYaml(raw) };
  } catch (err) {
    return { data: undefined, error: err instanceof Error ? err.message : String(err) };
  }
}

function zodIssuesToLoadIssues(file: string, issues: { path: PropertyKey[]; message: string }[]): LoadIssue[] {
  return issues.map((issue) => ({
    level: 'error' as const,
    file,
    message: `${issue.path.join('.')}: ${issue.message}`,
  }));
}

export function loadCourseCatalog(courseDir: string): LoadResult {
  const issues: LoadIssue[] = [];
  const course: CourseCatalog = { courseDir, adventures: [] };

  // ---- taxonomy.yaml ----
  const taxonomyPath = path.join(courseDir, 'taxonomy.yaml');
  const taxonomyRaw = readYaml(taxonomyPath);
  if (taxonomyRaw.error) {
    issues.push({ level: 'error', file: taxonomyPath, message: taxonomyRaw.error });
  } else {
    const parsed = taxonomyFileSchema.safeParse(taxonomyRaw.data);
    if (parsed.success) course.taxonomy = parsed.data;
    else issues.push(...zodIssuesToLoadIssues(taxonomyPath, parsed.error.issues));
  }

  // ---- facts.yaml ----
  const factsPath = path.join(courseDir, 'facts.yaml');
  const factsRaw = readYaml(factsPath);
  if (factsRaw.error) {
    issues.push({ level: 'error', file: factsPath, message: factsRaw.error });
  } else {
    const parsed = factsFileSchema.safeParse(factsRaw.data);
    if (parsed.success) course.facts = parsed.data;
    else issues.push(...zodIssuesToLoadIssues(factsPath, parsed.error.issues));
  }

  // ---- catalog.yaml ----
  const catalogPath = path.join(courseDir, 'catalog.yaml');
  const catalogRaw = readYaml(catalogPath);
  if (catalogRaw.error) {
    issues.push({ level: 'error', file: catalogPath, message: catalogRaw.error });
    return { ok: false, issues, course };
  }
  const catalogParsed = catalogFileSchema.safeParse(catalogRaw.data);
  if (!catalogParsed.success) {
    issues.push(...zodIssuesToLoadIssues(catalogPath, catalogParsed.error.issues));
    return { ok: false, issues, course };
  }
  course.catalog = catalogParsed.data;

  // ---- adventures/*.yaml (resolved relative to catalog.yaml's directory) ----
  const adventureSlugsSeen = new Set<string>();
  for (const ref of course.catalog.adventures) {
    const adventurePath = path.join(courseDir, ref.file);
    const adventureRaw = readYaml(adventurePath);
    if (adventureRaw.error) {
      issues.push({ level: 'error', file: adventurePath, message: adventureRaw.error });
      continue;
    }
    const parsed = adventureFileSchema.safeParse(adventureRaw.data);
    if (!parsed.success) {
      issues.push(...zodIssuesToLoadIssues(adventurePath, parsed.error.issues));
      continue;
    }
    const data = parsed.data;
    course.adventures.push({ file: adventurePath, data });

    if (adventureSlugsSeen.has(data.adventure.slug)) {
      issues.push({
        level: 'error',
        file: adventurePath,
        message: `duplicate adventure slug "${data.adventure.slug}" across the catalog`,
      });
    }
    adventureSlugsSeen.add(data.adventure.slug);

    // ---- taxonomy membership (only checkable if taxonomy loaded OK) ----
    if (course.taxonomy) {
      if (!course.taxonomy.themes.includes(data.adventure.theme)) {
        issues.push({
          level: 'error',
          file: adventurePath,
          message: `adventure.theme "${data.adventure.theme}" is not in taxonomy.themes`,
        });
      }
      if (!(data.adventure.age_tier in course.taxonomy.age_tiers)) {
        issues.push({
          level: 'error',
          file: adventurePath,
          message: `adventure.age_tier "${data.adventure.age_tier}" is not in taxonomy.age_tiers`,
        });
      }
      if (!(data.adventure.age_tier in course.taxonomy.family_allowlist_by_tier)) {
        issues.push({
          level: 'warning',
          file: adventurePath,
          message: `adventure.age_tier "${data.adventure.age_tier}" has no entry in taxonomy.family_allowlist_by_tier`,
        });
      }
    }

    // ---- quota warning: sagas per adventure, kind-aware (COURSE_ENGINE §3.1) ----
    if (data.sagas.length !== EXPECTED_SAGAS_PER_ADVENTURE) {
      issues.push({
        level: 'warning',
        file: adventurePath,
        message:
          `adventure "${data.adventure.slug}" has ${data.sagas.length} sagas ` +
          `(expected ${EXPECTED_SAGAS_PER_ADVENTURE}: ${EXPECTED_TEACHING_SAGAS_PER_ADVENTURE} teaching + ${EXPECTED_REVIEW_SAGAS_PER_ADVENTURE} review)`,
      });
    }
    const teachingSagaCount = data.sagas.filter((s) => s.kind === 'teaching').length;
    const reviewSagaCount = data.sagas.filter((s) => s.kind === 'review').length;
    if (teachingSagaCount !== EXPECTED_TEACHING_SAGAS_PER_ADVENTURE) {
      issues.push({
        level: 'warning',
        file: adventurePath,
        message: `adventure "${data.adventure.slug}" has ${teachingSagaCount} teaching-kind saga(s) (expected ${EXPECTED_TEACHING_SAGAS_PER_ADVENTURE})`,
      });
    }
    if (reviewSagaCount !== EXPECTED_REVIEW_SAGAS_PER_ADVENTURE) {
      issues.push({
        level: 'warning',
        file: adventurePath,
        message: `adventure "${data.adventure.slug}" has ${reviewSagaCount} review-kind saga(s) (expected ${EXPECTED_REVIEW_SAGAS_PER_ADVENTURE})`,
      });
    }

    // ---- total lesson count vs. tier1/tier2 expectation (§3.1 totals) ----
    const expectedTotalLessons = EXPECTED_TOTAL_LESSONS_BY_TIER[data.adventure.age_tier];
    if (expectedTotalLessons !== undefined) {
      const totalLessonsInAdventure = data.sagas.reduce(
        (n, s) => n + s.topics.reduce((m, t) => m + t.lessons.length, 0),
        0,
      );
      if (totalLessonsInAdventure !== expectedTotalLessons) {
        issues.push({
          level: 'warning',
          file: adventurePath,
          message:
            `adventure "${data.adventure.slug}" (age_tier=${data.adventure.age_tier}) has ${totalLessonsInAdventure} ` +
            `total lesson blueprints (expected ${expectedTotalLessons} per COURSE_ENGINE.md §3.1)`,
        });
      }
    }

    const sagaSlugsSeen = new Set<string>();
    for (const saga of data.sagas) {
      if (sagaSlugsSeen.has(saga.slug)) {
        issues.push({
          level: 'error',
          file: adventurePath,
          message: `duplicate saga slug "${saga.slug}" within adventure "${data.adventure.slug}"`,
        });
      }
      sagaSlugsSeen.add(saga.slug);

      if (saga.kind === 'teaching') {
        // Position-agnostic breadth generalization (§3.1): total topics is
        // EITHER 6 teaching + 2 review = 8, OR 8 teaching + 2 review = 10.
        const validTotals = TEACHING_TOPIC_COUNT_OPTIONS.map((n) => n + REVIEW_TOPICS_PER_TEACHING_SAGA);
        if (!validTotals.includes(saga.topics.length as (typeof validTotals)[number])) {
          issues.push({
            level: 'warning',
            file: adventurePath,
            message:
              `saga "${saga.slug}" (kind=teaching) has ${saga.topics.length} topics ` +
              `(expected ${validTotals.join(' or ')}: ${TEACHING_TOPIC_COUNT_OPTIONS.join(' or ')} teaching + ${REVIEW_TOPICS_PER_TEACHING_SAGA} review)`,
          });
        }

        const teachingTopicCount = saga.topics.filter((t) => t.kind === 'teaching').length;
        if (!(TEACHING_TOPIC_COUNT_OPTIONS as readonly number[]).includes(teachingTopicCount)) {
          issues.push({
            level: 'warning',
            file: adventurePath,
            message:
              `saga "${saga.slug}" (kind=teaching) has ${teachingTopicCount} teaching-kind topics ` +
              `(expected ${TEACHING_TOPIC_COUNT_OPTIONS.join(' or ')} — tier2 sagas may use the wider breadth, COURSE_ENGINE.md §3.1)`,
          });
        }

        // The 2 review topics are ALWAYS the saga's last two positions,
        // whichever total the saga actually has (position-agnostic).
        const totalTopics = saga.topics.length;
        const spacedPosition = totalTopics - 1;
        const interleavedPosition = totalTopics;
        const spacedTopic = saga.topics.find((t) => t.position === spacedPosition);
        if (spacedTopic && spacedTopic.kind !== 'review_spaced') {
          issues.push({
            level: 'warning',
            file: adventurePath,
            message:
              `saga "${saga.slug}" topic at position ${spacedPosition} (second-to-last) has kind "${spacedTopic.kind}" ` +
              `(expected "review_spaced")`,
          });
        }
        const interleavedTopic = saga.topics.find((t) => t.position === interleavedPosition);
        if (interleavedTopic && interleavedTopic.kind !== 'review_interleaved') {
          issues.push({
            level: 'warning',
            file: adventurePath,
            message:
              `saga "${saga.slug}" topic at position ${interleavedPosition} (last) has kind "${interleavedTopic.kind}" ` +
              `(expected "review_interleaved")`,
          });
        }
      } else if (saga.kind === 'review') {
        if (saga.topics.length !== EXPECTED_REVIEW_SAGA_TOPICS) {
          issues.push({
            level: 'warning',
            file: adventurePath,
            message: `saga "${saga.slug}" (kind=review) has ${saga.topics.length} topics (expected ${EXPECTED_REVIEW_SAGA_TOPICS})`,
          });
        }
        const nonQuestTopics = saga.topics.filter((t) => t.kind !== 'review_quest');
        if (nonQuestTopics.length > 0) {
          issues.push({
            level: 'warning',
            file: adventurePath,
            message: `saga "${saga.slug}" (kind=review) has ${nonQuestTopics.length} topic(s) not of kind "review_quest"`,
          });
        }
      }

      const topicSlugsSeen = new Set<string>();
      for (const topic of saga.topics) {
        if (topicSlugsSeen.has(topic.slug)) {
          issues.push({
            level: 'error',
            file: adventurePath,
            message: `duplicate topic slug "${topic.slug}" within saga "${saga.slug}"`,
          });
        }
        topicSlugsSeen.add(topic.slug);

        if (topic.lessons.length !== EXPECTED_LESSONS_PER_TOPIC) {
          issues.push({
            level: 'warning',
            file: adventurePath,
            message: `topic "${topic.slug}" (kind=${topic.kind}) has ${topic.lessons.length} lessons (expected ${EXPECTED_LESSONS_PER_TOPIC})`,
          });
        }

        // ---- parent_check is teaching-topics territory (§3.2) — a review-kind
        // topic carrying one is a content-design smell, not a hard error.
        if (topic.parent_check !== undefined && topic.kind !== 'teaching') {
          issues.push({
            level: 'warning',
            file: adventurePath,
            message: `topic "${topic.slug}" (kind=${topic.kind}) carries parent_check — intended for teaching topics only`,
          });
        }

        // ---- fact_refs resolve against facts.yaml (only checkable if facts loaded OK) ----
        if (course.facts) {
          for (const ref of topic.fact_refs) {
            if (!(ref in course.facts.facts)) {
              issues.push({
                level: 'error',
                file: adventurePath,
                message: `topic "${topic.slug}" fact_refs includes unknown fact id "${ref}"`,
              });
            }
          }
        }

        const lessonSlugsSeen = new Set<string>();
        for (const lesson of topic.lessons) {
          if (lessonSlugsSeen.has(lesson.slug)) {
            issues.push({
              level: 'error',
              file: adventurePath,
              message: `duplicate lesson slug "${lesson.slug}" within topic "${topic.slug}"`,
            });
          }
          lessonSlugsSeen.add(lesson.slug);

          if (course.taxonomy) {
            for (const family of lesson.suggested_families) {
              if (!course.taxonomy.families.includes(family)) {
                issues.push({
                  level: 'error',
                  file: adventurePath,
                  message: `lesson "${lesson.slug}" suggested_families includes unknown family "${family}"`,
                });
              }
            }
          }
        }
      }
    }
  }

  // ---- review_of / prerequisites path resolution (needs the FULL
  // cross-adventure picture, so it runs as a second pass over every
  // adventure file loaded above) ----
  const sagaPaths = new Set<string>();
  const topicPaths = new Set<string>();
  // Global ordering tuples — used ONLY by prerequisites' earlier-only check
  // (§3.2). review_of does NOT get this check added retroactively here: it
  // predates `prerequisites`, ships in the currently-authored curriculum,
  // and COURSE_ENGINE.md's backward-compat contract for this change is that
  // existing kind/review_of catalogs keep validating exactly as before.
  const sagaPosition = new Map<string, { advPosition: number; sagaPosition: number }>();
  const topicPosition = new Map<string, { advPosition: number; sagaPosition: number; topicPosition: number }>();
  for (const { data } of course.adventures) {
    for (const saga of data.sagas) {
      const sagaPath = `${data.adventure.slug}/${saga.slug}`;
      sagaPaths.add(sagaPath);
      sagaPosition.set(sagaPath, { advPosition: data.adventure.position, sagaPosition: saga.position });
      for (const topic of saga.topics) {
        const topicPath = `${data.adventure.slug}/${saga.slug}/${topic.slug}`;
        topicPaths.add(topicPath);
        topicPosition.set(topicPath, {
          advPosition: data.adventure.position,
          sagaPosition: saga.position,
          topicPosition: topic.position,
        });
      }
    }
  }

  function tupleOf(p: { advPosition: number; sagaPosition: number; topicPosition?: number }): number[] {
    return p.topicPosition === undefined
      ? [p.advPosition, p.sagaPosition]
      : [p.advPosition, p.sagaPosition, p.topicPosition];
  }

  /** Lexicographic compare — negative if `a` is strictly earlier than `b`. */
  function compareTuples(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] ?? -Infinity) - (b[i] ?? -Infinity);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  for (const { file, data } of course.adventures) {
    for (const saga of data.sagas) {
      for (const topic of saga.topics) {
        if (!topic.review_of) continue;
        for (const ref of topic.review_of) {
          if (!sagaPaths.has(ref) && !topicPaths.has(ref)) {
            issues.push({
              level: 'error',
              file,
              message: `topic "${topic.slug}" (kind=${topic.kind}) review_of references unresolved path "${ref}"`,
            });
          }
        }
      }
    }
  }

  // ---- prerequisites: resolve + earlier-only rule (§3.2) — a topic may
  // not list itself or later/same-position material as a prerequisite.
  for (const { file, data } of course.adventures) {
    for (const saga of data.sagas) {
      for (const topic of saga.topics) {
        if (!topic.prerequisites) continue;
        const currentTopicPath = `${data.adventure.slug}/${saga.slug}/${topic.slug}`;
        // Two DIFFERENT bases for "earlier": a topic-path prerequisite
        // compares against this topic's own full (adv,saga,topic) tuple; a
        // saga-path prerequisite compares against this topic's own SAGA
        // tuple only (padding a shorter saga tuple against the 3-element
        // topic tuple would make every saga path look "earlier" by
        // construction — that's the bug this split avoids).
        const currentTopicTuple = tupleOf({ advPosition: data.adventure.position, sagaPosition: saga.position, topicPosition: topic.position });
        const currentSagaTuple = tupleOf({ advPosition: data.adventure.position, sagaPosition: saga.position });

        for (const prereq of topic.prerequisites) {
          const { path: ref } = prereq;
          const isTopicPath = topicPaths.has(ref);
          const isSagaPath = !isTopicPath && sagaPaths.has(ref);

          if (!isTopicPath && !isSagaPath) {
            issues.push({
              level: 'error',
              file,
              message: `topic "${topic.slug}" prerequisites references unresolved path "${ref}"`,
            });
            continue;
          }

          if (isTopicPath && ref === currentTopicPath) {
            issues.push({
              level: 'error',
              file,
              message: `topic "${topic.slug}" lists itself as a prerequisite ("${ref}")`,
            });
            continue;
          }

          const isEarlier = isTopicPath
            ? compareTuples(tupleOf(topicPosition.get(ref)!), currentTopicTuple) < 0
            : compareTuples(tupleOf(sagaPosition.get(ref)!), currentSagaTuple) < 0;
          if (!isEarlier) {
            issues.push({
              level: 'error',
              file,
              message: `topic "${topic.slug}" prerequisites path "${ref}" is not earlier material — prerequisites may only cite earlier adventures/sagas/topics`,
            });
          }
        }
      }
    }
  }

  const ok = issues.every((i) => i.level !== 'error');
  return { ok, issues, course };
}

// ---- review source resolution for the generation pipeline -----------------
//
// Given a topic's `review_of` paths, returns the concept/objective/vocabulary
// of every teaching topic they resolve to — a saga path expands to ALL of
// that saga's topics, a topic path resolves to just that topic. Used by
// pipeline/plan.ts + pipeline/write.ts to ground review lessons in their
// sources (COURSE_ENGINE.md §3.1). Assumes `course` already passed
// `loadCourseCatalog` with `ok: true` (paths resolve) — unresolved refs are
// silently skipped here since loader-time validation already reports them.

export interface ReviewSourceTopic {
  path: string;
  concept: string;
  learningObjective: string;
  keyVocabulary: string[];
}

export function resolveReviewSources(course: CourseCatalog, reviewOf: readonly string[]): ReviewSourceTopic[] {
  const sources: ReviewSourceTopic[] = [];
  const seenPaths = new Set<string>();

  for (const ref of reviewOf) {
    const segments = ref.split('/');
    for (const { data } of course.adventures) {
      if (data.adventure.slug !== segments[0]) continue;
      for (const saga of data.sagas) {
        if (saga.slug !== segments[1]) continue;
        const matchingTopics = segments.length === 3 ? saga.topics.filter((t) => t.slug === segments[2]) : saga.topics;
        for (const topic of matchingTopics) {
          const path = `${data.adventure.slug}/${saga.slug}/${topic.slug}`;
          if (seenPaths.has(path)) continue;
          seenPaths.add(path);
          sources.push({
            path,
            concept: topic.concept,
            learningObjective: topic.learning_objective,
            keyVocabulary: topic.key_vocabulary,
          });
        }
      }
    }
  }

  return sources;
}
