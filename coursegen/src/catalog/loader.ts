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

// Coverage-oracle quotas (COURSE_ENGINE.md §3) — deviations are WARNINGS, never errors.
const EXPECTED_SAGAS_PER_ADVENTURE = 4;
const EXPECTED_TOPICS_PER_SAGA = 6;
const EXPECTED_LESSONS_PER_TOPIC = 4;

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

    // ---- quota warning: sagas per adventure ----
    if (data.sagas.length !== EXPECTED_SAGAS_PER_ADVENTURE) {
      issues.push({
        level: 'warning',
        file: adventurePath,
        message: `adventure "${data.adventure.slug}" has ${data.sagas.length} sagas (expected ${EXPECTED_SAGAS_PER_ADVENTURE})`,
      });
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

      if (saga.topics.length !== EXPECTED_TOPICS_PER_SAGA) {
        issues.push({
          level: 'warning',
          file: adventurePath,
          message: `saga "${saga.slug}" has ${saga.topics.length} topics (expected ${EXPECTED_TOPICS_PER_SAGA})`,
        });
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
            message: `topic "${topic.slug}" has ${topic.lessons.length} lessons (expected ${EXPECTED_LESSONS_PER_TOPIC})`,
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

  const ok = issues.every((i) => i.level !== 'error');
  return { ok, issues, course };
}
