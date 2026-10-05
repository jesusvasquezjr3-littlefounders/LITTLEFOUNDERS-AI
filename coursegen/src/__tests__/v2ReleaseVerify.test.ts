import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCatalogStructure, loadKcGraph } from '../v2/catalogCheck.js';
import { emitV2Lesson } from '../v2/emit.js';
import { applyLessonIds } from '../v2/hierarchy.js';
import { loadV2Plans } from '../v2/plan.js';
import { evaluateV2Release, type CurrentV2Document } from '../v2/releaseVerify.js';
import { currentV2Documents } from '../v2/verifyCourse.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const courseDir = path.resolve(here, '../../curriculum-v2/financial-education');

function corpus() {
  const parsed = parseCatalogStructure(readFileSync(path.join(courseDir, 'structure.yaml'), 'utf8'));
  const ids = JSON.parse(readFileSync(path.join(courseDir, 'hierarchy/ids.json'), 'utf8')) as Record<string, string>;
  const loaded = loadV2Plans(path.join(courseDir, 'plans'));
  const mapped = applyLessonIds(loaded.map((entry) => entry.plan!), ids);
  const current: CurrentV2Document[] = mapped.plans.flatMap((plan) => {
    const emitted = emitV2Lesson(plan, { versionId: '11111111-1111-4111-8111-111111111111', requireLessonDesign: true });
    expect(emitted.problems).toEqual([]);
    return emitted.documents.map((row) => ({ lesson_id: row.lesson_id, locale: row.locale, version_id: row.version_id, document: row.document, answer_keys: row.answer_keys }));
  });
  const rows = JSON.parse(readFileSync(path.join(courseDir, 'hierarchy/hierarchy.rows.json'), 'utf8')) as { tables: { topics: Array<{ title: unknown }>; lessons: Array<{ id: string; slug: string; status: string }> } };
  return { structure: parsed.structure!, plans: mapped.plans, current, rows: rows.tables };
}

describe('canonical v2 release evaluation', () => {
  it('uses the authored semantic version id, not the current-pointer row UUID', () => {
    const current = currentV2Documents(
      [{ lesson_id: 'lesson', locale: 'en-US', document_version_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
      [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', version_id: 'forge-financial-education-2026-10-05', lesson_id: 'lesson', locale: 'en-US', document: { version_id: 'forge-financial-education-2026-10-05' }, answer_keys: {} }],
    );
    expect(current[0]).toMatchObject({ version_id: 'forge-financial-education-2026-10-05', document: { version_id: 'forge-financial-education-2026-10-05' } });
  });

  it('attests the authored v2 corpus without requiring fabricated v1 documents', () => {
    const { structure, plans, current, rows } = corpus();
    const result = evaluateV2Release({ structure, graph: loadKcGraph(), plans, current, vaultLessons: rows.lessons, topicTitles: rows.topics.map((topic) => topic.title), orphansWithProgress: [], orphanCount: 0, corePassed: true, coreDetail: 'pass' });
    expect(result.checks).toHaveLength(34);
    expect(result.checks.find((check) => check.gate === 'forge.release.v2-content')).toMatchObject({ ok: true, total: current.length });
    expect(result.checks.filter((check) => !check.ok)).toEqual([]);
  }, 20_000);

  it('fails closed when Vault current content differs from the authored plan', () => {
    const { structure, plans, current, rows } = corpus();
    const changed = structuredClone(current);
    (changed[0]!.document as { title: string }).title = 'Unreviewed production edit';
    const result = evaluateV2Release({ structure, graph: loadKcGraph(), plans, current: changed, vaultLessons: rows.lessons, topicTitles: rows.topics.map((topic) => topic.title), orphansWithProgress: [], orphanCount: 0, corePassed: true, coreDetail: 'pass' });
    expect(result.checks.find((check) => check.gate === 'forge.release.illustration-style')?.ok).toBe(false);
    expect(result.checks.find((check) => check.gate === 'forge.release.v2-content')?.ok).toBe(false);
    expect(result.ok).toBe(false);
  }, 20_000);
});
