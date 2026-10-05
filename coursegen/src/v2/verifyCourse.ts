// Vault-backed CLI for the canonical v2 course release attestation.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCatalogStructure, loadKcGraph } from './catalogCheck.js';
import { applyLessonIds } from './hierarchy.js';
import { loadV2Plans } from './plan.js';
import { evaluateV2Release, type CurrentV2Document } from './releaseVerify.js';
import type { ReleaseCheckResult } from '../release/evaluate.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..');
const BATCH = 150;

interface RestClient {
  get<T>(resource: string): Promise<T>;
  rpc<T>(name: string, body: Record<string, unknown>): Promise<T>;
  attest(courseId: string, checks: readonly ReleaseCheckResult[], watermark: string | null): Promise<boolean>;
}

interface CurrentPointerRow { lesson_id: string; locale: string; document_version_id: string }
interface VersionRow {
  id: string;
  version_id: string;
  lesson_id: string;
  locale: CurrentV2Document['locale'];
  document: unknown;
  answer_keys: Record<string, unknown> | null;
}

/** Join the pointer's internal row UUID to the authored semantic version id. */
export function currentV2Documents(pointers: readonly CurrentPointerRow[], versions: readonly VersionRow[]): CurrentV2Document[] {
  const versionsById = new Map(versions.map((row) => [row.id, row]));
  return pointers.map((pointer) => {
    const version = versionsById.get(pointer.document_version_id);
    return {
      lesson_id: pointer.lesson_id,
      locale: pointer.locale as CurrentV2Document['locale'],
      version_id: version?.version_id ?? '',
      document: version?.document ?? {},
      answer_keys: version?.answer_keys ?? null,
    };
  });
}

function client(url: string, key: string): RestClient {
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const json = async <T>(resource: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${url}/rest/v1/${resource}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
    if (!response.ok) throw new Error(`${response.status} ${resource}: ${(await response.text()).slice(0, 300)}`);
    return await response.json() as T;
  };
  return {
    get: (resource) => json(resource),
    rpc: (name, body) => json(`rpc/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    attest: async (courseId, checks, watermark) => {
      const response = await fetch(`${url}/rest/v1/course_release_verifications?on_conflict=course_id`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ course_id: courseId, verified_at: new Date().toISOString(), content_watermark: watermark, checks }]),
      });
      return response.ok;
    },
  };
}

async function chunked<T>(ids: string[], resource: (batch: string[]) => string, rest: RestClient): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += BATCH) out.push(...await rest.get<T[]>(resource(ids.slice(i, i + BATCH))));
  return out;
}

export async function verifyV2Course(courseSlug: string, options: { url?: string; key?: string } = {}): Promise<number> {
  const url = options.url ?? process.env.SUPABASE_URL;
  const key = options.key ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('verify v2: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'); return 1; }
  const courseDir = path.join(PACKAGE_ROOT, 'curriculum-v2', courseSlug);
  const structureFile = path.join(courseDir, 'structure.yaml');
  if (!existsSync(structureFile)) { console.error(`verify v2: ${structureFile} does not exist`); return 1; }
  const parsed = parseCatalogStructure(readFileSync(structureFile, 'utf8'));
  if (!parsed.structure) { console.error(`verify v2: ${parsed.problems.join('; ')}`); return 1; }
  const loaded = loadV2Plans(path.join(courseDir, 'plans'));
  const broken = loaded.filter((entry) => entry.errors.length);
  if (broken.length) { console.error(`verify v2: ${broken.map((entry) => `${entry.file}: ${entry.errors.join('; ')}`).join('\n')}`); return 1; }
  const ids = JSON.parse(readFileSync(path.join(courseDir, 'hierarchy', 'ids.json'), 'utf8')) as Record<string, string>;
  const mapped = applyLessonIds(loaded.map((entry) => entry.plan!), ids);
  if (mapped.problems.length) { console.error(`verify v2: ${mapped.problems.join('; ')}`); return 1; }

  const rest = client(url, key);
  try {
    const courses = await rest.get<Array<{ id: string; slug: string }>>(`courses?select=id,slug&slug=eq.${encodeURIComponent(courseSlug)}`);
    if (courses.length !== 1) { console.error(`verify v2: course ${courseSlug} is not uniquely present in Vault`); return 1; }
    const courseId = courses[0]!.id;
    // Capture this before any content read. Vault rejects it if a pointer moves meanwhile.
    const watermark = await rest.rpc<string | null>('forge_release_content_watermark', { p_course_id: courseId });
    const adventures = await rest.get<Array<{ id: string }>>(`adventures?select=id&course_id=eq.${courseId}`);
    const sagas = adventures.length ? await chunked<{ id: string }>(adventures.map((row) => row.id), (batch) => `sagas?select=id&adventure_id=in.(${batch.join(',')})`, rest) : [];
    const topics = sagas.length ? await chunked<{ id: string; title: unknown }>(sagas.map((row) => row.id), (batch) => `topics?select=id,title&saga_id=in.(${batch.join(',')})`, rest) : [];
    const lessons = topics.length ? await chunked<{ id: string; slug: string; status: string }>(topics.map((row) => row.id), (batch) => `lessons?select=id,slug,status&topic_id=in.(${batch.join(',')})`, rest) : [];
    const pointers = lessons.length ? await chunked<CurrentPointerRow>(lessons.map((row) => row.id), (batch) => `lesson_document_version_current?select=lesson_id,locale,document_version_id&lesson_id=in.(${batch.join(',')})`, rest) : [];
    const versions = pointers.length ? await chunked<VersionRow>(pointers.map((row) => row.document_version_id), (batch) => `lesson_document_versions?select=id,version_id,lesson_id,locale,document,answer_keys&id=in.(${batch.join(',')})`, rest) : [];
    const current = currentV2Documents(pointers, versions);

    const planned = new Set(Object.values(ids));
    const orphans = lessons.filter((lesson) => !planned.has(lesson.id));
    const attempts = orphans.length ? await chunked<{ lesson_id: string }>(orphans.map((row) => row.id), (batch) => `lesson_segment_attempts?select=lesson_id&lesson_id=in.(${batch.join(',')})&limit=1000`, rest) : [];
    const touched = new Set(attempts.map((row) => row.lesson_id));

    const runsDir = path.join(PACKAGE_ROOT, 'runs', 'verify-course');
    mkdirSync(runsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const documentsFile = path.join(runsDir, `${courseSlug}-${stamp}-v2-documents.json`);
    writeFileSync(documentsFile, `${JSON.stringify(current.map((row) => ({ lesson_id: row.lesson_id, locale: row.locale, schema_version: 2, version_id: row.version_id, document: row.document, answer_keys: row.answer_keys })), null, 2)}\n`);
    const core = spawnSync('npm', ['--prefix', path.join(REPO_ROOT, 'backend'), 'run', 'forge-v2:check', '--', documentsFile], { encoding: 'utf8', shell: process.platform === 'win32' });
    const coreOutput = `${core.stdout ?? ''}${core.stderr ?? ''}`.trim();
    const evaluation = evaluateV2Release({
      structure: parsed.structure, graph: loadKcGraph(), plans: mapped.plans, current, vaultLessons: lessons,
      topicTitles: topics.map((topic) => topic.title), orphansWithProgress: orphans.filter((row) => touched.has(row.id)).map((row) => row.slug), orphanCount: orphans.length,
      corePassed: core.status === 0, coreDetail: core.status === 0 ? 'Core contract and interactive behaviour pass' : coreOutput.slice(0, 500),
    });
    const attested = evaluation.ok ? await rest.attest(courseId, evaluation.checks, watermark) : false;
    const reportFile = path.join(runsDir, `${courseSlug}-${stamp}.json`);
    writeFileSync(reportFile, `${JSON.stringify({ course: courseSlug, version: 2, generatedAt: new Date().toISOString(), ok: evaluation.ok, attested, checks: evaluation.checks }, null, 2)}\n`);
    console.log(`\n══ V2 ACCEPTANCE CHECK — ${courseSlug} ══`);
    for (const check of evaluation.checks) console.log(`  ${check.ok ? '✓' : '✗'} [${check.gate}] ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
    console.log(`  ${attested ? '✓' : '✗'} release verification attestation ${attested ? 'saved' : 'not saved'}`);
    console.log(`  report: ${path.relative(process.cwd(), reportFile)}`);
    const failed = evaluation.checks.filter((check) => !check.ok).length + (attested ? 0 : 1);
    console.log(`\n  RESULT: ${failed === 0 ? 'ALL CHECKS PASS' : `${failed} CHECK(S) FAILED`}\n`);
    return failed === 0 ? 0 : 1;
  } catch (error) {
    console.error(`verify v2: ${(error as Error).message}`);
    return 1;
  }
}
