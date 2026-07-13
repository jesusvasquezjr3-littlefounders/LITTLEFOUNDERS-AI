import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { loadCourseCatalog } from '../catalog/loader.js';

function taxonomyFixture() {
  return {
    schema_version: 1,
    themes: ['archipelago'],
    age_tiers: {
      tier1: { ages: '6-7', forbidden_vocabulary: { 'es-MX': ['préstamo'], 'en-US': ['loan'], 'pt-BR': ['empréstimo'] } },
    },
    families: ['story', 'choice', 'money'],
    family_allowlist_by_tier: { tier1: ['story', 'choice', 'money'] },
    type_exceptions: { tier1_extra_allowed: [], tier1_banned_types: [] },
  };
}

function factsFixture() {
  return {
    schema_version: 1,
    facts: {
      'mxn.denominations.coins': { value: [1, 2, 5], unit: 'MXN', verified: true },
    },
  };
}

function catalogFixture() {
  return {
    schema_version: 1,
    course: {
      slug: 'test-course',
      subject: 'money',
      title: { 'en-US': 'Test', 'es-MX': 'Prueba', 'pt-BR': 'Teste' },
      description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
      authoring_locale: 'es-MX',
    },
    adventures: [{ file: 'adventures/01-a.yaml' }],
  };
}

function lessonBlueprint(position: number) {
  return {
    position,
    slug: `lesson-${position}`,
    micro_objective: 'x',
    narrative_beat: 'x',
    difficulty: 1,
    suggested_families: ['story'],
  };
}

function adventureFixture(opts: { factRef?: string; sagaCount?: number; lessonCount?: number } = {}) {
  const lessonCount = opts.lessonCount ?? 4;
  return {
    schema_version: 1,
    adventure: {
      position: 1,
      slug: 'archipelago-1',
      theme: 'archipelago',
      age_tier: 'tier1',
      title: { 'en-US': 'A', 'es-MX': 'A', 'pt-BR': 'A' },
      description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
      narrative_arc: 'x',
    },
    sagas: Array.from({ length: opts.sagaCount ?? 1 }, (_, sagaIndex) => ({
      position: sagaIndex + 1,
      slug: `saga-${sagaIndex + 1}`,
      icon: 'auto_stories',
      title: { 'en-US': 'S', 'es-MX': 'S', 'pt-BR': 'S' },
      description: { 'en-US': 'd', 'es-MX': 'd', 'pt-BR': 'd' },
      topics: [
        {
          position: 1,
          slug: 'topic-1',
          title_es: 'Tema',
          concept: 'x',
          learning_objective: 'x',
          key_vocabulary: ['moneda'],
          prior_knowledge: 'x',
          fact_refs: opts.factRef ? [opts.factRef] : [],
          lessons: Array.from({ length: lessonCount }, (_, i) => lessonBlueprint(i + 1)),
        },
      ],
    })),
  };
}

let courseDir: string;

beforeEach(() => {
  courseDir = mkdtempSync(path.join(tmpdir(), 'forge-catalog-'));
});

afterEach(() => {
  rmSync(courseDir, { recursive: true, force: true });
});

function writeCourse(overrides: {
  taxonomy?: unknown;
  facts?: unknown;
  catalog?: unknown;
  adventure?: unknown;
} = {}) {
  writeFileSync(path.join(courseDir, 'taxonomy.yaml'), stringify(overrides.taxonomy ?? taxonomyFixture()));
  writeFileSync(path.join(courseDir, 'facts.yaml'), stringify(overrides.facts ?? factsFixture()));
  writeFileSync(path.join(courseDir, 'catalog.yaml'), stringify(overrides.catalog ?? catalogFixture()));
  mkdirSync(path.join(courseDir, 'adventures'), { recursive: true });
  writeFileSync(path.join(courseDir, 'adventures/01-a.yaml'), stringify(overrides.adventure ?? adventureFixture()));
}

describe('loadCourseCatalog', () => {
  it('loads a valid course with zero errors and zero warnings', () => {
    writeCourse();
    const result = loadCourseCatalog(courseDir);
    expect(result.issues.filter((i) => i.level === 'error')).toHaveLength(0);
    expect(result.ok).toBe(true);
    expect(result.course.adventures).toHaveLength(1);
  });

  it('tolerates a missing adventure file without throwing, reporting it as an error', () => {
    writeCourse({ catalog: { ...catalogFixture(), adventures: [{ file: 'adventures/missing.yaml' }] } });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('not found'))).toBe(true);
  });

  it('errors on an unresolved fact_ref', () => {
    writeCourse({ adventure: adventureFixture({ factRef: 'does.not.exist' }) });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('unknown fact id'))).toBe(true);
  });

  it('passes when a fact_ref resolves', () => {
    writeCourse({ adventure: adventureFixture({ factRef: 'mxn.denominations.coins' }) });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(true);
  });

  it('errors on a theme not in taxonomy.themes', () => {
    const adv = adventureFixture();
    adv.adventure.theme = 'not-a-theme';
    writeCourse({ adventure: adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('taxonomy.themes'))).toBe(true);
  });

  it('warns (not errors) when saga count deviates from the quota of 4', () => {
    writeCourse({ adventure: adventureFixture({ sagaCount: 1 }) });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.level === 'warning' && i.message.includes('sagas'))).toBe(true);
  });

  it('errors on a duplicate lesson slug within a topic', () => {
    const adv = adventureFixture();
    adv.sagas[0]!.topics[0]!.lessons = [lessonBlueprint(1), { ...lessonBlueprint(2), slug: 'lesson-1' }];
    writeCourse({ adventure: adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('duplicate lesson slug'))).toBe(true);
  });

  it('errors on an unknown suggested_families entry', () => {
    const adv = adventureFixture();
    adv.sagas[0]!.topics[0]!.lessons[0]!.suggested_families = ['not-a-family'];
    writeCourse({ adventure: adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('suggested_families'))).toBe(true);
  });

  it('accepts a lesson with valid forced_types (QA override, §4 addendum)', () => {
    const adv = adventureFixture();
    (adv.sagas[0]!.topics[0]!.lessons[0] as Record<string, unknown>).forced_types = ['quiz_mcq', 'true_false'];
    writeCourse({ adventure: adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(true);
  });

  it('errors on an unknown forced_types entry', () => {
    const adv = adventureFixture();
    (adv.sagas[0]!.topics[0]!.lessons[0] as Record<string, unknown>).forced_types = ['not_a_real_type'];
    writeCourse({ adventure: adv });
    const result = loadCourseCatalog(courseDir);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('forced_types') && i.message.includes('not_a_real_type'))).toBe(true);
  });
});
