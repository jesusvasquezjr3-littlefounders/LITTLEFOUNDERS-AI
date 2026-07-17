// Multi-course catalog tests (COURSE_ENGINE.md §3.1b — the course sequence:
// financial-education, entrepreneurship, investing):
//  - checkCourseDirs(): scans N course directories independently, folds
//    per-course + cross-course issues, returns the report catalog:check prints
//  - crossValidateRequires(): course.requires — missing-course and cycle are
//    both WARNINGS (siblings may be mid-authoring; not a runtime dependency
//    today, only a future placement hint), never a crash
//  - catalogFileSchema.course.requires: optional, kebab-slug array
//  - tier3 taxonomy-driven generalization: quota/palette/vocabulary gating
//    NEVER hardcodes tier1/tier2 — any tier key in the course's own
//    taxonomy.yaml age_tiers just works; an unknown tier is a loader error

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { loadCourseCatalog, crossValidateRequires, checkCourseDirs } from '../catalog/loader.js';
import { resolveAllowedTypes } from '../pipeline/prompts/palette.js';
import { runVocabularyGate } from '../pipeline/gates.js';
import { buildDocument } from './fixtures.js';

function localized3(v: string) {
  return { 'en-US': v, 'es-MX': v, 'pt-BR': v };
}

function baseLesson(position: number) {
  return {
    position,
    slug: `lesson-${position}`,
    micro_objective: 'x',
    narrative_beat: 'x',
    difficulty: 1,
    suggested_families: ['story'],
  };
}

function baseTopicFields(overrides: Record<string, unknown> = {}) {
  return {
    position: 1,
    slug: 'topic-1',
    title_es: 'Tema',
    concept: 'x',
    learning_objective: 'x',
    key_vocabulary: ['moneda'],
    prior_knowledge: 'x',
    fact_refs: [],
    lessons: [baseLesson(1), baseLesson(2), baseLesson(3), baseLesson(4)],
    ...overrides,
  };
}

function baseSaga(overrides: Record<string, unknown> = {}) {
  return {
    position: 1,
    slug: 'saga-1',
    icon: 'auto_stories',
    title: localized3('S'),
    description: localized3('d'),
    topics: [baseTopicFields()],
    ...overrides,
  };
}

function taxonomyFixture(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    themes: ['archipelago'],
    age_tiers: {
      tier1: { ages: '6-7', forbidden_vocabulary: { 'es-MX': ['préstamo'], 'en-US': ['loan'], 'pt-BR': ['empréstimo'] } },
    },
    families: ['story', 'choice', 'money'],
    family_allowlist_by_tier: { tier1: ['story', 'choice', 'money'] },
    type_exceptions: { tier1_extra_allowed: [], tier1_banned_types: [] },
    ...overrides,
  };
}

function factsFixture() {
  return { schema_version: 1, facts: { 'x.fact': { value: 1, verified: true } } };
}

function catalogFixture(slug: string, opts: { requires?: string[] } = {}) {
  return {
    schema_version: 1,
    course: {
      slug,
      subject: 'money',
      title: localized3(slug),
      description: localized3('d'),
      authoring_locale: 'es-MX',
      ...(opts.requires ? { requires: opts.requires } : {}),
    },
    adventures: [{ file: 'adventures/01-a.yaml' }],
  };
}

function adventureFixture(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    adventure: {
      position: 1,
      slug: 'adv-1',
      theme: 'archipelago',
      age_tier: 'tier1',
      title: localized3('A'),
      description: localized3('d'),
      narrative_arc: 'x',
    },
    sagas: [baseSaga()],
    ...overrides,
  };
}

let curriculumRoot: string;

beforeEach(() => {
  curriculumRoot = mkdtempSync(path.join(tmpdir(), 'forge-multicourse-'));
});

afterEach(() => {
  rmSync(curriculumRoot, { recursive: true, force: true });
});

function writeCourseDir(
  slug: string,
  opts: { requires?: string[]; taxonomy?: unknown; adventure?: unknown } = {},
): string {
  const dir = path.join(curriculumRoot, slug);
  mkdirSync(path.join(dir, 'adventures'), { recursive: true });
  writeFileSync(path.join(dir, 'taxonomy.yaml'), stringify(opts.taxonomy ?? taxonomyFixture()));
  writeFileSync(path.join(dir, 'facts.yaml'), stringify(factsFixture()));
  writeFileSync(path.join(dir, 'catalog.yaml'), stringify(catalogFixture(slug, { requires: opts.requires })));
  writeFileSync(path.join(dir, 'adventures/01-a.yaml'), stringify(opts.adventure ?? adventureFixture()));
  return dir;
}

// ---------------------------------------------------------------------------
// checkCourseDirs — multi-directory scan
// ---------------------------------------------------------------------------

describe('checkCourseDirs — multi-course scan (§3.1b)', () => {
  it('scans 2 tiny course directories independently and reports both', () => {
    const dirA = writeCourseDir('course-a');
    const dirB = writeCourseDir('course-b');
    const report = checkCourseDirs([dirA, dirB]);
    expect(report.summaries).toHaveLength(2);
    expect(report.summaries.map((s) => s.result.course.catalog?.course.slug).sort()).toEqual(['course-a', 'course-b']);
    expect(report.totalErrors).toBe(0);
  });

  it('a non-existent adventure file in one course is a clear per-course error, not a crash across the scan', () => {
    const dirA = writeCourseDir('course-a');
    const dirB = path.join(curriculumRoot, 'course-b');
    mkdirSync(path.join(dirB, 'adventures'), { recursive: true });
    writeFileSync(path.join(dirB, 'taxonomy.yaml'), stringify(taxonomyFixture()));
    writeFileSync(path.join(dirB, 'facts.yaml'), stringify(factsFixture()));
    writeFileSync(
      path.join(dirB, 'catalog.yaml'),
      stringify({ ...catalogFixture('course-b'), adventures: [{ file: 'adventures/missing.yaml' }] }),
    );
    // Deliberately no adventures/missing.yaml written — "siblings mid-authoring".

    const report = checkCourseDirs([dirA, dirB]);
    expect(report.summaries).toHaveLength(2);
    expect(report.totalErrors).toBeGreaterThan(0);

    const courseB = report.summaries.find((s) => s.courseDir === dirB)!;
    expect(courseB.result.issues.some((i) => i.level === 'error' && i.message.includes('not found'))).toBe(true);

    const courseA = report.summaries.find((s) => s.courseDir === dirA)!;
    expect(courseA.result.issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// crossValidateRequires — missing course + cycle, both warnings
// ---------------------------------------------------------------------------

describe('crossValidateRequires — missing + cycle warnings (§3.1b)', () => {
  it('produces no requires-related issues for a valid, non-cyclic chain', () => {
    const dirA = writeCourseDir('course-a');
    const dirB = writeCourseDir('course-b', { requires: ['course-a'] });
    const results = [loadCourseCatalog(dirA), loadCourseCatalog(dirB)];
    expect(crossValidateRequires(results)).toHaveLength(0);
  });

  it('warns when a required course is not among the scanned directories (may be mid-authoring)', () => {
    const dirB = writeCourseDir('course-b', { requires: ['course-a-not-scanned'] });
    const results = [loadCourseCatalog(dirB)];
    const issues = crossValidateRequires(results);
    expect(
      issues.some(
        (i) =>
          i.level === 'warning' &&
          i.message.includes('course-a-not-scanned') &&
          i.message.includes('not among the scanned'),
      ),
    ).toBe(true);
  });

  it('warns (never errors) on a requires cycle between two scanned courses', () => {
    const dirA = writeCourseDir('course-a', { requires: ['course-b'] });
    const dirB = writeCourseDir('course-b', { requires: ['course-a'] });
    const results = [loadCourseCatalog(dirA), loadCourseCatalog(dirB)];
    const issues = crossValidateRequires(results);
    expect(issues.some((i) => i.level === 'warning' && i.message.includes('cycle'))).toBe(true);
    expect(issues.every((i) => i.level === 'warning')).toBe(true);
  });

  it('checkCourseDirs folds requires issues back into the owning course\'s own section', () => {
    const dirB = writeCourseDir('course-b', { requires: ['ghost-course'] });
    const report = checkCourseDirs([dirB]);
    const summary = report.summaries[0]!;
    expect(summary.result.issues.some((i) => i.message.includes('ghost-course'))).toBe(true);
    expect(report.totalWarnings).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// catalogFileSchema.course.requires shape
// ---------------------------------------------------------------------------

describe('catalogFileSchema — course.requires (§3.1b)', () => {
  it('is optional and absent by default', () => {
    const dir = writeCourseDir('solo-course');
    const result = loadCourseCatalog(dir);
    expect(result.ok).toBe(true);
    expect(result.course.catalog?.course.requires).toBeUndefined();
  });

  it('accepts a non-empty kebab-slug array', () => {
    const dir = writeCourseDir('course-b', { requires: ['course-a'] });
    const result = loadCourseCatalog(dir);
    expect(result.ok).toBe(true);
    expect(result.course.catalog?.course.requires).toEqual(['course-a']);
  });
});

// ---------------------------------------------------------------------------
// tier3 taxonomy-driven generalization — quota/palette/vocabulary gating
// must never hardcode tier1/tier2 (COURSE_ENGINE.md §3.1b)
// ---------------------------------------------------------------------------

describe('tier3 taxonomy-driven generalization (§3.1b)', () => {
  function tier3Taxonomy() {
    return taxonomyFixture({
      age_tiers: {
        tier1: { ages: '6-7', forbidden_vocabulary: { 'es-MX': ['préstamo'], 'en-US': ['loan'], 'pt-BR': ['empréstimo'] } },
        // tier3's forbidden list is deliberately SMALLER — most of tier1's
        // list becomes teachable by tier3 (still-forbidden: apalancamiento
        // etc., COURSE_ENGINE.md §3.1b). This "just works" purely because
        // the gate reads whatever list the tier's OWN taxonomy entry
        // declares — never a hardcoded tier1/tier2 lookup table.
        tier3: {
          ages: '10-12',
          forbidden_vocabulary: { 'es-MX': ['apalancamiento'], 'en-US': ['leverage'], 'pt-BR': ['alavancagem'] },
        },
      },
      family_allowlist_by_tier: { tier1: ['story', 'choice', 'money'], tier3: ['story', 'choice', 'money'] },
    });
  }

  it('loader accepts an adventure whose age_tier is tier3, purely because taxonomy.age_tiers declares it', () => {
    const dir = writeCourseDir('investing', {
      taxonomy: tier3Taxonomy(),
      adventure: adventureFixture({ adventure: { ...adventureFixture().adventure, age_tier: 'tier3' } }),
    });
    const result = loadCourseCatalog(dir);
    expect(result.issues.filter((i) => i.level === 'error')).toHaveLength(0);
    expect(result.ok).toBe(true);
  });

  it('loader errors when an adventure declares an age_tier absent from its own course taxonomy', () => {
    const dir = writeCourseDir('investing', {
      taxonomy: tier3Taxonomy(), // no tier9 declared
      adventure: adventureFixture({ adventure: { ...adventureFixture().adventure, age_tier: 'tier9' } }),
    });
    const result = loadCourseCatalog(dir);
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.level === 'error' && i.message.includes('age_tier') && i.message.includes('tier9')),
    ).toBe(true);
  });

  it('resolveAllowedTypes resolves tier3 straight from family_allowlist_by_tier.tier3 — no tier1/tier2 special-casing', () => {
    const { allowed } = resolveAllowedTypes(tier3Taxonomy(), 'tier3');
    expect(allowed).toContain('quiz_mcq'); // choice family
    expect(allowed).toContain('coin_count'); // money family
  });

  it('runVocabularyGate uses tier3\'s OWN (smaller) forbidden list — a tier1-forbidden word is fine under tier3', () => {
    const doc = buildDocument();
    (doc.segments[0]!.payload as { body_md: string }).body_md = 'Hoy hablamos de un préstamo entre amigos.';
    const tier1Problems = runVocabularyGate(doc, tier3Taxonomy(), 'tier1');
    const tier3Problems = runVocabularyGate(doc, tier3Taxonomy(), 'tier3');
    expect(tier1Problems.length).toBeGreaterThan(0); // "préstamo" IS forbidden for tier1
    expect(tier3Problems).toHaveLength(0); // tier3's own list doesn't forbid it
  });

  it('the computed total-lesson-count check generalizes to tier3 with no 152/184-style hardcoding', () => {
    // A deliberately non-canonical tier3 shape (1 saga, 1 topic, 4 lessons)
    // — the computed expectation (1 topic × 4 = 4) is self-consistent
    // regardless of tier, so no "total lesson blueprints" warning fires.
    const dir = writeCourseDir('investing', {
      taxonomy: tier3Taxonomy(),
      adventure: adventureFixture({ adventure: { ...adventureFixture().adventure, age_tier: 'tier3' } }),
    });
    const result = loadCourseCatalog(dir);
    expect(result.issues.some((i) => i.message.includes('total lesson blueprints'))).toBe(false);
  });
});
