// S05.4c — the release evaluation behind verify:course, which writes the
// attestation Vault's release_course / release_lesson preflight requires
// (every id in public.forge_release_gates must carry ok: true). Run over the
// real first-lemonade-stand catalog and its committed corpus, plus targeted
// fail-closed cases: an attestation must never claim a gate it did not run.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadCourseCatalog } from '../catalog/loader.js';
import { loadCatalogStrings, parseSeedInserts } from '../contentGates/sources.js';
import { FORGE_ILLUSTRATION_STYLE_VERSION } from '../pipeline/illustrationStyle.js';
import { evaluateRelease, type ReleaseDocumentRow, type ReleaseInput, type ReleaseLessonRow } from '../release/evaluate.js';
import { FORGE_RELEASE_CHECKS, GENERATION_ONLY_GATES, RELEASE_CHECK_IDS } from '../release/gateManifest.js';
import { FIXTURE_EMITTED } from '../v2/cli.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(here, '../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..');
const COURSE_DIR = path.join(PACKAGE_ROOT, 'curriculum/first-lemonade-stand');
const SEED = path.join(REPO_ROOT, 'database/seeds/first-lemonade-stand-fixture.sql');

function realInput(): ReleaseInput {
  const load = loadCourseCatalog(COURSE_DIR);
  const rows = parseSeedInserts(readFileSync(SEED, 'utf8'));
  const table = (name: string) => rows.filter((r) => r.table === name).map((r) => r.row);
  const tierByAdventure = new Map(table('adventures').map((a) => [a.id!, a.age_tier!]));
  const adventureBySaga = new Map(table('sagas').map((s) => [s.id!, s.adventure_id!]));
  const sagaByTopic = new Map(table('topics').map((t) => [t.id!, t.saga_id!]));
  const lessons: ReleaseLessonRow[] = table('lessons').map((l) => ({
    id: l.id!,
    slug: l.slug!,
    // The corpus is live content; verify:course treats review and published alike.
    status: 'review',
    tier: tierByAdventure.get(adventureBySaga.get(sagaByTopic.get(l.topic_id!)!)!)!,
  }));
  const documents: ReleaseDocumentRow[] = table('lesson_documents').map((d) => ({
    lesson_id: d.lesson_id!,
    locale: d.locale!,
    document: JSON.parse(d.document!),
    answer_keys: d.answer_keys ? JSON.parse(d.answer_keys) : null,
    audio: d.audio ? JSON.parse(d.audio) : null,
    illustration_style_version: d.illustration_style_version ?? null,
  }));
  return {
    catalog: load.course,
    catalogIssues: load.issues,
    catalogStrings: loadCatalogStrings(COURSE_DIR).strings,
    lessons,
    topics: table('topics').map((t) => ({ id: t.id!, title: t.title ? JSON.parse(t.title) : null })),
    documents,
    orphansWithProgress: [],
    orphanCount: 0,
    illustrationStyleVersion: FORGE_ILLUSTRATION_STYLE_VERSION,
  };
}

describe('the release-gate manifest', () => {
  it('names every Forge document gate once, except generation-only gates with a stated reason', () => {
    const gates = FORGE_RELEASE_CHECKS.filter((c) => c.gate !== undefined).map((c) => c.gate);
    expect(new Set(gates).size).toBe(gates.length);
    for (let gate = 1; gate <= 16; gate++) {
      const wired = gates.includes(gate as never);
      const generationOnly = GENERATION_ONLY_GATES[gate as keyof typeof GENERATION_ONLY_GATES];
      expect(wired !== !!generationOnly).toBe(true);
    }
    expect(new Set(RELEASE_CHECK_IDS).size).toBe(RELEASE_CHECK_IDS.length);
  });

  it('only lets a declared exception excuse the legacy gates 1-9', () => {
    const exemptable = FORGE_RELEASE_CHECKS.filter((c) => c.exemptable).map((c) => c.gate);
    expect(exemptable).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe.skipIf(!existsSync(SEED))('the release evaluation over the committed lemonade corpus', () => {
  const input = realInput();
  const evaluation = evaluateRelease(input);
  const byId = new Map(evaluation.checks.map((c) => [c.gate, c]));

  it('records exactly one result per manifest id, in manifest order', () => {
    expect(evaluation.checks.map((c) => c.gate)).toEqual([...RELEASE_CHECK_IDS]);
  });

  it('fails the course, so no attestation could unlock its release', () => {
    expect(evaluation.ok).toBe(false);
  });

  it('reports the per-gate document pass counts measured by content:gates (S05.4a/b baseline)', () => {
    expect(byId.get('forge.gate.11.redundancy')).toMatchObject({ ok: false, passed: 0, total: 186 });
    expect(byId.get('forge.gate.12.tone')).toMatchObject({ ok: true, passed: 186, total: 186 });
    expect(byId.get('forge.gate.13.copy-budget')).toMatchObject({ ok: false, passed: 2, total: 186 });
    expect(byId.get('forge.gate.16.regional-adaptation')?.ok).toBe(false);
    expect(byId.get('forge.catalog.mentor-misjudgment')?.ok).toBe(false);
    expect(byId.get('forge.catalog.concept-cap')?.ok).toBe(false);
    expect(byId.get('forge.release.v2-content')).toMatchObject({ ok: true, detail: 'no activated v2 documents' });
  });

  it('never lets a declared exception excuse a content or lesson-policy gate', () => {
    expect(evaluation.exceptions.size).toBeGreaterThan(0);
    for (const id of ['forge.gate.11.redundancy', 'forge.gate.13.copy-budget', 'forge.gate.16.regional-adaptation']) {
      expect(byId.get(id)?.excepted ?? 0).toBe(0);
    }
  });
});

describe('the release evaluation fails closed', () => {
  const input = existsSync(SEED) ? realInput() : undefined;

  it.skipIf(!input)('counts a document that fails the contract as failing every document gate', () => {
    const first = input!.documents[0]!;
    const broken = { ...input!, documents: [{ ...first, document: { segments: [] } }] };
    const checks = evaluateRelease(broken).checks.filter((c) => c.gate.startsWith('forge.gate.'));
    expect(checks.every((c) => !c.ok)).toBe(true);
  });

  it.skipIf(!input)('with a declared exception, excuses gates 1-9 for that lesson but never 11-16', () => {
    const catalog = structuredClone(input!.catalog);
    const first = input!.documents[0]!;
    const slug = input!.lessons.find((l) => l.id === first.lesson_id)!.slug;
    for (const adventure of catalog.adventures) for (const saga of adventure.data.sagas) for (const topic of saga.topics) for (const lesson of topic.lessons) {
      if (lesson.slug === slug) lesson.known_exception = 'A decided design conflict recorded for this test only.';
    }
    const result = evaluateRelease({ ...input!, catalog, documents: [{ ...first, document: { segments: [] } }] });
    const byGate = new Map(result.checks.map((c) => [c.gate, c]));
    expect(byGate.get('forge.gate.04.arithmetic')).toMatchObject({ ok: true, excepted: 1 });
    expect(byGate.get('forge.gate.12.tone')).toMatchObject({ ok: false, excepted: 0 });
  });

  it.skipIf(!input)('fails every document gate when the lesson age tier cannot be determined', () => {
    const result = evaluateRelease({ ...input!, lessons: input!.lessons.map((lesson) => ({ id: lesson.id, slug: lesson.slug, status: lesson.status })) });
    expect(result.checks.filter((c) => c.gate.startsWith('forge.gate.')).every((c) => !c.ok)).toBe(true);
  });

  it.skipIf(!input)('fails the document gates and the locale check when there are no documents at all', () => {
    const result = evaluateRelease({ ...input!, documents: [] });
    const byGate = new Map(result.checks.map((c) => [c.gate, c]));
    expect(byGate.get('forge.gate.12.tone')).toMatchObject({ ok: false, detail: 'no release-ready documents' });
    expect(byGate.get('forge.release.locales-complete')?.ok).toBe(false);
  });

  it.skipIf(!input)('fails the catalog tone and Copy Budget checks when no catalog strings were loaded', () => {
    const result = evaluateRelease({ ...input!, catalogStrings: [] });
    const byGate = new Map(result.checks.map((c) => [c.gate, c]));
    expect(byGate.get('forge.catalog.tone')?.ok).toBe(false);
    expect(byGate.get('forge.catalog.copy-budget')?.ok).toBe(false);
  });

  it.skipIf(!input)('checks every activated v2 document, and refuses an unreadable or mislabelled activation', () => {
    const emitted = JSON.parse(readFileSync(FIXTURE_EMITTED, 'utf8')) as Array<{ lesson_id: string; locale: string; document: Record<string, unknown> }>;
    const clean = emitted.slice(0, 6).map((row) => ({ lesson_id: row.lesson_id, locale: row.locale, document: row.document }));
    const pass = new Map(evaluateRelease({ ...input!, v2Documents: clean }).checks.map((c) => [c.gate, c]));
    expect(pass.get('forge.release.v2-content')).toMatchObject({ ok: true, passed: 6, total: 6 });

    const hype = structuredClone(clean[1]!);
    (hype.document.segments as Array<{ prompt: string }>)[0]!.prompt = 'Hazte rico rápido: reparte 12 monedas.';
    const unreadable = { lesson_id: 'lost', locale: 'es-MX', document: {} };
    const mislabelled = { ...structuredClone(clean[0]!), locale: 'pt-BR' };
    const result = evaluateRelease({ ...input!, v2Documents: [clean[0]!, hype, unreadable, mislabelled] });
    const check = result.checks.find((c) => c.gate === 'forge.release.v2-content')!;
    expect(check).toMatchObject({ ok: false, passed: 1, total: 4 });
  });
});

// verify:course is a script (an IIFE against live Vault), so its ordering is
// pinned by source: the content watermark must be captured BEFORE the first
// content read and sent with the attestation, or a change that lands while the
// command runs could ride on an attestation that never read it (lane review,
// Product G.2). Vault refuses an attestation whose watermark is not current.
describe('verify:course attests the content watermark it captured before reading', () => {
  const source = readFileSync(path.join(PACKAGE_ROOT, 'src/verifyCourse.ts'), 'utf8');

  it('captures the watermark before the first hierarchy or document read', () => {
    const capture = source.indexOf('await contentWatermark(course[0]!.id)');
    expect(capture).toBeGreaterThan(-1);
    for (const read of ['`adventures?select', '`lesson_documents?select', '`lesson_document_version_current?select']) {
      expect(source.indexOf(read)).toBeGreaterThan(capture);
    }
  });

  it('sends that watermark with the attestation and never attests without one', () => {
    expect(source).toMatch(/content_watermark: watermark,/);
    expect(source).toMatch(/attested = watermark\.ok \? await attestCourseRelease\(course\[0\]!\.id, checks, watermark\.value\) : false/);
    expect(source).toMatch(/rpc\/forge_release_content_watermark/);
  });
});
