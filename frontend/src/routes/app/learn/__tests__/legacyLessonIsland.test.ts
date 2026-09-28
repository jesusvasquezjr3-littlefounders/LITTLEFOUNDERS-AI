import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { newCheckpoint } from '@/lesson-engine/player/checkpoint';
import type { LessonDocument } from '@/lesson-engine/core/types';
import { isLegacyLessonDocument, reconcileLegacyCheckpoint } from '../LessonRoute';

/*
 * W2L.3 / OD-24: the v1 Lesson Player is the single sanctioned legacy island
 * on the learner's side, reached through ONE named adapter. These scans pin
 * both directions: the learner lane reaches the legacy lesson engine only
 * through the island (and the island's own grader helper), and nothing
 * rebuilt imports the island.
 */
const src = resolve(__dirname, '../../../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { if (name !== '__tests__') walk(full, out); } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const imports = (file: string) => [...readFileSync(file, 'utf8').matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)].map((match) => match[1]!);
const lane = [...walk(join(src, 'routes/app/learn')), ...walk(join(src, 'rebuild'))].map((file) => ({ file: relative(src, file).replace(/\\/g, '/'), imports: imports(file) }));

describe('the legacy lesson island (W2L.3, OD-24)', () => {
  it('is the only way from the learner lane into the legacy lesson engine', () => {
    const allowed: Record<string, (name: string) => boolean> = {
      'routes/app/learn/LegacyLessonIsland.tsx': () => true,
      // The island's grader helper: types only.
      'routes/app/learn/coreGrader.ts': (name) => name === '@/lesson-engine/core/types',
      // The route keeps the resume record (a storage module, no UI) for v2 run ids, and decides on a v1 document by its type.
      'routes/app/learn/LessonRoute.tsx': (name) => name === '@/lesson-engine/player/checkpoint' || name === '@/lesson-engine/core/types',
    };
    const offences = lane.flatMap(({ file, imports: names }) => names
      .filter((name) => /lesson-engine\//.test(name))
      .filter((name) => !(allowed[file]?.(name) ?? false))
      .map((name) => `${file} -> ${name}`));
    expect(offences).toEqual([]);
  });

  it('is mounted by the lesson route alone, and never from rebuilt code', () => {
    const importers = lane.filter(({ imports: names }) => names.some((name) => /LegacyLessonIsland$/.test(name))).map(({ file }) => file);
    expect(importers).toEqual(['routes/app/learn/LessonRoute.tsx']);
  });

  it('carries the legacy global sheet, and is loaded lazily so a v2 lesson never pays for it (S10 gap fix)', () => {
    const island = readFileSync(join(src, 'routes/app/learn/LegacyLessonIsland.tsx'), 'utf8');
    const route = readFileSync(join(src, 'routes/app/learn/LessonRoute.tsx'), 'utf8');
    expect(island).toMatch(/^import '@\/index\.css';$/m);
    expect(route).toMatch(/lazy\(\(\) => import\('\.\/LegacyLessonIsland'\)/);
    expect(route).not.toMatch(/from '\.\/LegacyLessonIsland'/);
  });

  it('plays only the v1 schema', () => {
    expect(isLegacyLessonDocument({ schema_version: 1, segments: [] })).toBe(true);
    expect(isLegacyLessonDocument({ schema_version: 2, segments: [] })).toBe(false);
    expect(isLegacyLessonDocument(null)).toBe(false);
    expect(isLegacyLessonDocument([])).toBe(false);
  });

  it('never restores a checkpoint into a revised or translated document', () => {
    const document = { schema_version: 1, meta: { slug: 'l1' }, segments: [{ id: 'a' }, { id: 'b' }] } as unknown as LessonDocument;
    const fresh = reconcileLegacyCheckpoint(newCheckpoint(), document);
    expect(fresh.document).toBe(JSON.stringify(document));
    const resumed = { ...fresh, state: { index: 1, seg: { a: {} } } } as unknown as ReturnType<typeof newCheckpoint>;
    expect(reconcileLegacyCheckpoint(resumed, document)).toBe(resumed);
    const revised = { ...document, segments: [{ id: 'a' }] } as unknown as LessonDocument;
    const reset = reconcileLegacyCheckpoint(resumed, revised);
    expect(reset).not.toBe(resumed);
    expect(reset.state).toBeFalsy();
    expect(reset.document).toBe(JSON.stringify(revised));
  });
});
