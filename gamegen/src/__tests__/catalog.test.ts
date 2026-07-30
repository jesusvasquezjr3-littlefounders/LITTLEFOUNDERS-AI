// Arcade game-catalog tests — GAME_ENGINE.md §8/§9.
//
// The four cases the gate exists for:
//   1. a valid catalog loads clean, with the mechanic distribution reported;
//   2. an unknown mechanic id is rejected BY NAME (a closed-set typo must not cost a
//      paid run to discover);
//   3. a slug repeated within one topic is rejected (games.slug is UNIQUE per topic);
//   4. a `topic_path` that resolves to nothing in Forge's catalog is a HARD failure,
//      with the closest real topics named — an orphan game cannot exist, because
//      `games.topic_id` is NOT NULL.
//
// Fixtures are real temp directories holding real YAML, with `coursegenCurriculumRoot`
// pointed at a fixture Forge tree: the cross-catalog read is the thing under test, so
// stubbing it away would test nothing.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';
import { loadGameCatalog, closestTopicPaths } from '../catalog/loader.js';
import {
  checkGameCatalogDirs,
  discoverGameCourseDirs,
  formatMechanicDistribution,
  runCatalogCheck,
} from '../catalog/check.js';

const COURSE_SLUG = 'first-lemonade-stand';
const TOPIC_A = 'estacion-de-pruebas/camara-de-tipos/tipos-story';
const TOPIC_B = 'estacion-de-pruebas/camara-de-tipos/tipos-dinero';

let root: string;
let gamegenCourseDir: string;
let coursegenCurriculumRoot: string;

function writeYaml(filePath: string, data: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, stringify(data), 'utf8');
}

/** A minimal but REAL Forge course: catalog.yaml + the adventure file it points at. */
function writeForgeCourse(): void {
  writeYaml(path.join(coursegenCurriculumRoot, COURSE_SLUG, 'catalog.yaml'), {
    schema_version: 1,
    course: {
      slug: COURSE_SLUG,
      subject: 'mixed',
      authoring_locale: 'es-MX',
    },
    adventures: [{ file: 'adventures/01-estacion-de-pruebas.yaml' }],
  });
  writeYaml(path.join(coursegenCurriculumRoot, COURSE_SLUG, 'adventures/01-estacion-de-pruebas.yaml'), {
    schema_version: 1,
    adventure: {
      position: 1,
      slug: 'estacion-de-pruebas',
      theme: 'city',
      age_tier: 'tier2',
      narrative_arc: 'x',
    },
    sagas: [
      {
        position: 1,
        slug: 'camara-de-tipos',
        icon: 'storefront',
        topics: [
          { position: 1, slug: 'tipos-story', title_es: 'La Gran Idea', lessons: [{ position: 1, slug: 'a' }] },
          { position: 2, slug: 'tipos-dinero', title_es: 'Contar Monedas', lessons: [{ position: 1, slug: 'b' }] },
        ],
      },
    ],
  });
}

function blueprint(overrides: Record<string, unknown> = {}) {
  return {
    topic_path: TOPIC_A,
    slug: 'contar-monedas-sorter',
    mechanic: 'sorter',
    micro_objective: 'Separar monedas de billetes hasta que la caja quede ordenada.',
    skin_brief: 'Puesto de limonada al atardecer, caja de madera, monedas doradas.',
    difficulty: 2,
    tier: 2,
    ...overrides,
  };
}

function writeGamesFile(games: Record<string, unknown>[], extra: Record<string, unknown> = {}): void {
  writeYaml(path.join(gamegenCourseDir, 'games.yaml'), {
    schema_version: 1,
    course: COURSE_SLUG,
    games,
    ...extra,
  });
}

function load() {
  return loadGameCatalog(gamegenCourseDir, { coursegenCurriculumRoot });
}

function errorMessages(result: ReturnType<typeof load>): string[] {
  return result.issues.filter((i) => i.level === 'error').map((i) => i.message);
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'arcade-catalog-'));
  gamegenCourseDir = path.join(root, 'gamegen/curriculum', COURSE_SLUG);
  coursegenCurriculumRoot = path.join(root, 'coursegen/curriculum');
  mkdirSync(gamegenCourseDir, { recursive: true });
  writeForgeCourse();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('loadGameCatalog — a valid catalog', () => {
  it('loads clean and reports the mechanic distribution', () => {
    writeGamesFile([
      blueprint(),
      blueprint({ slug: 'precio-justo-launcher', mechanic: 'launcher', position: 2 }),
      blueprint({ topic_path: TOPIC_B, slug: 'ahorro-stacker', mechanic: 'stacker' }),
    ]);

    const result = load();

    expect(errorMessages(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.catalog?.course).toBe(COURSE_SLUG);
    expect(result.coverage.blueprints).toBe(3);
    expect(result.coverage.mechanicCounts.sorter).toBe(1);
    expect(result.coverage.mechanicCounts.launcher).toBe(1);
    expect(result.coverage.mechanicCounts.stacker).toBe(1);
    expect(result.coverage.mechanicCounts.flyer).toBe(0);
    expect(result.coverage.topicsWithGames).toBe(2);
    expect(result.coverage.topicsInCourse).toBe(2);
    // Below the coverage threshold, "you left five mechanics unused" is noise.
    expect(result.issues.filter((i) => i.level === 'warning')).toEqual([]);
  });

  it('warns — never errors — when a game tier disagrees with its adventure age_tier', () => {
    writeGamesFile([blueprint({ tier: 1 })]);

    const result = load();

    expect(result.ok).toBe(true);
    expect(result.issues.filter((i) => i.level === 'warning').map((i) => i.message)).toEqual([
      expect.stringContaining('declares tier 1'),
    ]);
  });

  it('surfaces the distribution through checkGameCatalogDirs', () => {
    writeGamesFile([blueprint(), blueprint({ slug: 'otro-sorter', topic_path: TOPIC_B })]);

    const report = checkGameCatalogDirs([gamegenCourseDir], { coursegenCurriculumRoot });

    expect(report.totalErrors).toBe(0);
    expect(report.totalBlueprints).toBe(2);
    expect(report.mechanicTotals.sorter).toBe(2);
    expect(formatMechanicDistribution(report.mechanicTotals)).toContain('sorter=2');
  });
});

describe('loadGameCatalog — closed-set violations', () => {
  it('rejects an unknown mechanic id and names it', () => {
    writeGamesFile([blueprint({ mechanic: 'sorterr' })]);

    const result = load();

    expect(result.ok).toBe(false);
    const message = errorMessages(result).join('\n');
    expect(message).toContain('unknown mechanic "sorterr"');
    expect(message).toContain('sorter, launcher, runner');
    // The offending entry is locatable: Zod's path is preserved.
    expect(message).toContain('games.0.mechanic');
  });

  it('rejects an out-of-range tier', () => {
    writeGamesFile([blueprint({ tier: 4 })]);

    expect(load().ok).toBe(false);
  });
});

describe('loadGameCatalog — local integrity', () => {
  it('rejects a duplicate slug within one topic', () => {
    writeGamesFile([blueprint(), blueprint({ position: 2 })]);

    const result = load();

    expect(result.ok).toBe(false);
    expect(errorMessages(result).join('\n')).toContain(
      'duplicate game slug "contar-monedas-sorter" within topic "estacion-de-pruebas/camara-de-tipos/tipos-story"',
    );
  });

  it('allows the same slug under two different topics', () => {
    writeGamesFile([blueprint(), blueprint({ topic_path: TOPIC_B })]);

    expect(load().ok).toBe(true);
  });

  it('rejects a duplicate position within one topic', () => {
    writeGamesFile([blueprint({ position: 1 }), blueprint({ slug: 'otro-juego', position: 1 })]);

    expect(errorMessages(load()).join('\n')).toContain('reuses position 1');
  });

  it('rejects a course slug that disagrees with its directory', () => {
    writeYaml(path.join(gamegenCourseDir, 'games.yaml'), {
      schema_version: 1,
      course: 'investing',
      games: [blueprint()],
    });

    expect(errorMessages(load()).join('\n')).toContain('does not match the containing directory');
  });
});

describe('loadGameCatalog — cross-catalog binding (the orphan gate)', () => {
  it('fails hard on a topic_path that does not exist in the Forge catalog', () => {
    writeGamesFile([blueprint({ topic_path: 'estacion-de-pruebas/camara-de-tipos/tipos-storyy' })]);

    const result = load();

    expect(result.ok).toBe(false);
    const message = errorMessages(result).join('\n');
    expect(message).toContain('game "contar-monedas-sorter"');
    expect(message).toContain('tipos-storyy');
    expect(message).toContain(`coursegen/curriculum/${COURSE_SLUG}/catalog.yaml`);
    // The author gets the fix, not just the complaint.
    expect(message).toContain(`"${TOPIC_A}"`);
  });

  it('fails when the whole Forge course is missing, without blaming every blueprint', () => {
    rmSync(path.join(coursegenCurriculumRoot, COURSE_SLUG), { recursive: true, force: true });
    writeGamesFile([blueprint(), blueprint({ slug: 'segundo-juego', topic_path: TOPIC_B })]);

    const result = load();

    expect(result.ok).toBe(false);
    // ONE error naming the real cause — not one per blueprint on top of it.
    const errors = result.issues.filter((i) => i.level === 'error');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.file).toContain(path.join(COURSE_SLUG, 'catalog.yaml'));
    expect(errors[0]?.message).toContain('file not found');
    expect(result.coverage.topicsInCourse).toBeNull();
  });

  it('ranks suggestions by shared leading segments before edit distance', () => {
    const candidates = ['otra-aventura/otra-saga/tipos-story', TOPIC_A, TOPIC_B];

    expect(closestTopicPaths('estacion-de-pruebas/camara-de-tipos/tipos-storia', candidates, 1)).toEqual([TOPIC_A]);
  });
});

// The contract catalogCli.ts depends on: argv in, EXIT CODE out. A gate that prints
// errors and still exits 0 is not a gate.
describe('runCatalogCheck — the catalog:check exit-code contract', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 0 for a clean catalog', () => {
    writeGamesFile([blueprint()]);

    expect(runCatalogCheck([gamegenCourseDir], { coursegenCurriculumRoot })).toBe(0);
  });

  it('returns 1 when a blueprint binds to a nonexistent topic', () => {
    writeGamesFile([blueprint({ topic_path: 'no-existe/no-existe/no-existe' })]);

    expect(runCatalogCheck([gamegenCourseDir], { coursegenCurriculumRoot })).toBe(1);
  });

  it('returns 1 when a named course directory has no games.yaml at all', () => {
    expect(runCatalogCheck([path.join(root, 'gamegen/curriculum', 'sin-juegos')], { coursegenCurriculumRoot })).toBe(1);
  });

  it('discovers one directory per course and ignores loose files', () => {
    writeFileSync(path.join(root, 'gamegen/curriculum', 'README.md'), '# authoring guide\n', 'utf8');

    expect(discoverGameCourseDirs(path.join(root, 'gamegen/curriculum'))).toEqual([gamegenCourseDir]);
    expect(discoverGameCourseDirs(path.join(root, 'no-such-root'))).toEqual([]);
  });
});
