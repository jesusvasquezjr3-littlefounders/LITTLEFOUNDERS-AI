import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCatalogStructure, loadKcGraph } from '../v2/catalogCheck.js';
import { emitV2Lesson } from '../v2/emit.js';
import { applyLessonIds } from '../v2/hierarchy.js';
import { loadV2Plans } from '../v2/plan.js';
import { evaluateV2Release, type CurrentV2Document } from '../v2/releaseVerify.js';
import { currentV2Documents, lessonsWithHistory } from '../v2/verifyCourse.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const courseDir = path.resolve(here, '../../curriculum-v2/financial-education');

function corpus() {
  const parsed = parseCatalogStructure(readFileSync(path.join(courseDir, 'structure.yaml'), 'utf8'));
  const ids = JSON.parse(readFileSync(path.join(courseDir, 'hierarchy/ids.json'), 'utf8')) as Record<string, string>;
  const loaded = loadV2Plans(path.join(courseDir, 'plans'));
  const mapped = applyLessonIds(loaded.map((entry) => entry.plan!), ids);
  const current: CurrentV2Document[] = mapped.plans.flatMap((plan) => {
    const emitted = emitV2Lesson(plan, { versionId: '11111111-1111-4111-8111-111111111111', requireLessonDesign: true });
    return emitted.documents.map((row) => ({ lesson_id: row.lesson_id, locale: row.locale, version_id: row.version_id, document: row.document, answer_keys: row.answer_keys }));
  });
  const rows = JSON.parse(readFileSync(path.join(courseDir, 'hierarchy/hierarchy.rows.json'), 'utf8')) as { tables: { topics: Array<{ title: unknown }>; lessons: Array<{ id: string; slug: string; status: string }> } };
  return { structure: parsed.structure!, plans: mapped.plans, current, rows: rows.tables };
}

describe('canonical v2 release evaluation', () => {
  it('detects legacy attempts and v2 runs independently, including lessons after a busy first lesson', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `lesson-${i}`);
    const calls: string[] = [];
    const touched = await lessonsWithHistory(ids, {
      async get<T>(resource: string): Promise<T> {
        calls.push(resource);
        const url = new URL(resource, 'http://fixture/');
        expect(url.searchParams.get('limit')).toBe('1');
        const id = url.searchParams.get('lesson_id')!.slice(3);
        const present = (url.pathname === '/lesson_segment_attempts' && id === 'lesson-0') || (url.pathname === '/lesson_v2_runs' && id === 'lesson-11');
        return (present ? [{ lesson_id: id }] : []) as T;
      },
    });
    expect([...touched].sort()).toEqual(['lesson-0', 'lesson-11']);
    expect(calls).toHaveLength(24);
  });

  it('does not report missing history when either history source is unavailable', async () => {
    await expect(lessonsWithHistory(['lesson'], {
      async get<T>(resource: string): Promise<T> {
        if (resource.startsWith('lesson_v2_runs?')) throw new Error('unavailable');
        return [] as T;
      },
    })).rejects.toThrow('unavailable');
  });

  it('uses the authored semantic version id, not the current-pointer row UUID', () => {
    const current = currentV2Documents(
      [{ lesson_id: 'lesson', locale: 'en-US', document_version_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
      [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', version_id: 'forge-financial-education-2026-10-05', lesson_id: 'lesson', locale: 'en-US', document: { version_id: 'forge-financial-education-2026-10-05' }, answer_keys: {} }],
    );
    expect(current[0]).toMatchObject({ version_id: 'forge-financial-education-2026-10-05', document: { version_id: 'forge-financial-education-2026-10-05' } });
  });

  it('refuses to attest the withdrawn corpus whose visible narratives exceed the player budget', () => {
    const { structure, plans, current, rows } = corpus();
    const result = evaluateV2Release({ structure, graph: loadKcGraph(), plans, current, vaultLessons: rows.lessons, topicTitles: rows.topics.map((topic) => topic.title), orphansWithProgress: [], orphanCount: 0, corePassed: true, coreDetail: 'pass' });
    expect(result.checks).toHaveLength(34);
    expect(result.checks.find((check) => check.gate === 'forge.release.v2-content')).toMatchObject({ ok: false, total: current.length });
    expect(result.checks.find((check) => check.gate === 'forge.release.locales-complete')?.ok).toBe(false);
    expect(result.ok).toBe(false);
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
