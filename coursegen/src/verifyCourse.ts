/*
 * verify-course.ts — the single acceptance check for a generated course.
 *
 * Run with `npm run verify:course -- [course-slug]` (defaults to first-lemonade-stand).
 *
 * This is what "100% successful" has to MEAN, expressed as things that are either
 * true or false rather than as a feeling. Every check below is deterministic and
 * re-runnable, so the same command answers the question the same way tomorrow.
 *
 * S05.4c: the checks themselves live in release/evaluate.ts (pure, tested) and
 * are keyed by the release-gate manifest (release/gateManifest.ts). The
 * attestation this command writes names every check by its manifest id, and
 * Vault's release_course preflight (shared by Core's staff publish route and
 * the local publish command, Product G.2) refuses a release unless every
 * required id passed. A report is also written under runs/verify-course/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourseCatalog } from './catalog/loader.js';
import { FORGE_ILLUSTRATION_STYLE_VERSION } from './pipeline/illustrationStyle.js';
import { loadCatalogStrings } from './contentGates/sources.js';
import {
  evaluateRelease,
  type ReleaseCheckResult,
  type ReleaseDocumentRow,
  type ReleaseLessonRow,
  type ReleaseV2DocumentRow,
} from './release/evaluate.js';

const COURSE = process.argv[2] ?? 'first-lemonade-stand';
const S = process.env.SUPABASE_URL!, K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const q = async (p: string) =>
  (await fetch(`${S}/rest/v1/${p}`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json();

/**
 * `in.(id,id,...)` filters were fine at pilot-course scale but a real course
 * puts 300+ topic ids or 1000+ lesson ids on one query string — past PostgREST/
 * Kong's request-line limit, failing as an opaque "URI too long" JSON parse
 * error (production incident 2026-08-10, verifying financial-education).
 * Batch the id list and merge instead of growing one unbounded URL.
 */
const ID_BATCH_SIZE = 150; // 150 uuids × 37 chars ≈ 5.5KB — comfortably under an 8KB header limit
async function qChunked<T>(pathForBatch: (ids: string[]) => string, ids: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH_SIZE) {
    const batch = ids.slice(i, i + ID_BATCH_SIZE);
    out.push(...((await q(pathForBatch(batch))) as T[]));
  }
  return out;
}

/**
 * The course's content watermark (latest document change or v2 activation),
 * captured BEFORE anything is read. Vault's release preflight refuses an
 * attestation whose watermark is not the current one, so a change that lands
 * while this command is still reading or evaluating cannot ride on it (S05.4c
 * lane review, Product G.2). The value is kept as Vault's own text so it
 * round-trips at microsecond precision (a JS Date would truncate it).
 */
async function contentWatermark(courseId: string): Promise<{ ok: true; value: string | null } | { ok: false }> {
  try {
    const res = await fetch(`${S}/rest/v1/rpc/forge_release_content_watermark`, {
      method: 'POST',
      headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_course_id: courseId }),
    });
    if (!res.ok) return { ok: false };
    const value = (await res.json()) as unknown;
    if (value !== null && typeof value !== 'string') return { ok: false };
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

async function attestCourseRelease(courseId: string, checks: readonly ReleaseCheckResult[], watermark: string | null): Promise<boolean> {
  try {
    const res = await fetch(`${S}/rest/v1/course_release_verifications?on_conflict=course_id`, {
      method: 'POST',
      headers: {
        apikey: K,
        Authorization: `Bearer ${K}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{
        course_id: courseId,
        // Vault's trigger replaces this with the database clock: an operator
        // clock running ahead must not make a stale verification look fresh.
        verified_at: new Date().toISOString(),
        // What this run verified: the watermark captured before reading.
        content_watermark: watermark,
        checks,
      }]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

(async () => {
  const load = loadCourseCatalog(`curriculum/${COURSE}`);

  // ---- Vault: hierarchy + every release-ready document ------------------------
  const course = (await q(`courses?select=id,slug,title,status&slug=eq.${COURSE}`)) as { id: string; slug: string }[];
  if (course.length === 0) {
    console.error(`verify: course "${COURSE}" is not in Vault`);
    process.exit(1);
  }
  // Captured before the first content read (see contentWatermark).
  const watermark = await contentWatermark(course[0]!.id);
  if (!watermark.ok) {
    console.error('verify: could not read the course content watermark from Vault (forge_release_content_watermark); no attestation can be written');
  }
  const adv = (await q(`adventures?select=id&course_id=eq.${course[0]!.id}`)) as { id: string }[];
  const sagas = adv.length
    ? ((await q(`sagas?select=id&adventure_id=in.(${adv.map((a) => a.id).join(',')})`)) as { id: string }[])
    : [];
  // Batched like the hops below it: a saga list is smaller than a topic list,
  // but "smaller" is not "bounded", and this is the same request-line ceiling
  // that produced the 2026-08-10 incident one level down. The sibling
  // images:backfill hit HTTP 414 on exactly this shape on 2026-08-15.
  const topics = sagas.length
    ? await qChunked<{ id: string; title: unknown }>(
        (batch) => `topics?select=id,title&saga_id=in.(${batch.join(',')})`,
        sagas.map((s) => s.id),
      )
    : [];
  const lessonRows = topics.length
    ? await qChunked<{ id: string; slug: string; status: string; topics?: { sagas?: { adventures?: { age_tier?: string } } } }>(
        (batch) =>
          `lessons?select=id,slug,status,topics!inner(sagas!inner(adventures!inner(age_tier)))&topic_id=in.(${batch.join(',')})`,
        topics.map((t) => t.id),
      )
    : [];
  const lessons: ReleaseLessonRow[] = lessonRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    status: row.status,
    ...(row.topics?.sagas?.adventures?.age_tier ? { tier: row.topics.sagas.adventures.age_tier } : {}),
  }));
  // A human must run the acceptance check BEFORE release, while Forge's
  // lessons are still `review`. Published lessons are included too so the
  // command remains a useful post-release regression check.
  const releaseReady = lessons.filter((l) => l.status === 'review' || l.status === 'published');
  const documents = releaseReady.length
    ? await qChunked<ReleaseDocumentRow>(
        (batch) =>
          `lesson_documents?select=locale,document,answer_keys,audio,illustration_style_version,lesson_id&lesson_id=in.(${batch.join(',')})`,
        releaseReady.map((l) => l.id),
      )
    : [];

  // Activated v2 documents: Vault counts a v2 activation as a content change
  // (forge_release_verification_refusal), so the attestation must cover them.
  const pointers = lessons.length
    ? await qChunked<{ lesson_id: string; locale: string; document_version_id: string }>(
        (batch) => `lesson_document_version_current?select=lesson_id,locale,document_version_id&lesson_id=in.(${batch.join(',')})`,
        lessons.map((l) => l.id),
      )
    : [];
  const versions = pointers.length
    ? await qChunked<{ id: string; lesson_id: string; locale: string; document: unknown }>(
        (batch) => `lesson_document_versions?select=id,lesson_id,locale,document&id=in.(${batch.join(',')})`,
        pointers.map((p) => p.document_version_id),
      )
    : [];
  const versionById = new Map(versions.map((v) => [v.id, v]));
  const v2Documents: ReleaseV2DocumentRow[] = pointers.map((pointer) => ({
    lesson_id: pointer.lesson_id,
    locale: pointer.locale,
    // A pointer whose version cannot be read is checked as an empty document,
    // which fails: an unreadable activation is never attested.
    document: versionById.get(pointer.document_version_id)?.document ?? {},
  }));

  /*
   * ---- identity migration contract (roadmap.sh pattern, 2026-07-25) ----------
   * A Vault lesson that the catalog no longer names is an ORPHAN. Orphans with
   * learner progress FAIL the acceptance check: a restructure that strands a
   * kid's attempts/streaks must be declared (`renamed_from` in the blueprint;
   * publish renames the row and keeps its UUID) instead of shipping silently.
   */
  const catalogLessonSlugs = new Set<string>();
  for (const a of load.course.adventures) {
    for (const sg of a.data.sagas) for (const t of sg.topics) for (const l of t.lessons) catalogLessonSlugs.add(l.slug);
  }
  const orphans = lessons.filter((l) => !catalogLessonSlugs.has(l.slug));
  let orphansWithProgress: string[] = [];
  if (orphans.length > 0) {
    const attempts = await qChunked<{ lesson_id: string }>(
      (batch) => `lesson_segment_attempts?select=lesson_id&lesson_id=in.(${batch.join(',')})&limit=1000`,
      orphans.map((l) => l.id),
    );
    const touched = new Set(attempts.map((a) => a.lesson_id));
    orphansWithProgress = orphans.filter((l) => touched.has(l.id)).map((l) => l.slug);
  }

  const evaluation = evaluateRelease({
    catalog: load.course,
    catalogIssues: load.issues,
    catalogStrings: loadCatalogStrings(`curriculum/${COURSE}`).strings,
    lessons,
    topics,
    documents,
    v2Documents,
    orphansWithProgress,
    orphanCount: orphans.length,
    illustrationStyleVersion: FORGE_ILLUSTRATION_STYLE_VERSION,
  });
  const { checks } = evaluation;

  // ---- release attestation ----------------------------------------------------
  // The release RPC refuses to make content visible unless a successful full
  // verification naming every required gate exists after the latest document
  // update. The attestation is operational metadata only; the later Core
  // release click is the audited human approval for kid-facing content.
  let attested: boolean | undefined;
  if (evaluation.ok) attested = watermark.ok ? await attestCourseRelease(course[0]!.id, checks, watermark.value) : false;

  // ---- report ----------------------------------------------------------------
  const runsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'runs', 'verify-course');
  mkdirSync(runsDir, { recursive: true });
  const reportFile = path.join(runsDir, `${COURSE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(
    reportFile,
    JSON.stringify({ course: COURSE, generatedAt: new Date().toISOString(), ok: evaluation.ok, attested: attested ?? false, checks }, null, 2),
  );

  console.log(`\n══ ACCEPTANCE CHECK — ${COURSE} ══`);
  for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} [${c.gate}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  if (attested !== undefined) {
    console.log(
      `  ${attested ? '✓' : '✗'} release verification attestation saved — ${attested ? 'release gate unlocked until a document changes' : 'Vault did not accept the attestation'}`,
    );
  }
  if (evaluation.gateFailures.size > 0) {
    console.log(`\n  gate failures:`);
    for (const [where, problems] of [...evaluation.gateFailures].slice(0, 12)) {
      console.log(`    ✗ ${where}`);
      for (const p of problems.slice(0, 2)) console.log(`        ${p.slice(0, 130)}`);
    }
    if (evaluation.gateFailures.size > 12) console.log(`    … and ${evaluation.gateFailures.size - 12} more`);
  }
  if (evaluation.exceptions.size > 0) {
    console.log(`\n  DECLARED EXCEPTIONS (excuse legacy gates 1-9 only; content and lesson-policy gates 11-16 are never excused):`);
    for (const [slug, reason] of evaluation.exceptions) {
      console.log(`    • ${slug}${evaluation.excepted.has(slug) ? ' (currently failing only exemptable gates, as declared)' : ''}`);
      console.log(`        ${reason.replace(/\s+/g, ' ').slice(0, 300)}…`);
    }
  }
  console.log(`\n  (informational) narrated documents: ${evaluation.narratedDocuments}/${documents.length}`);
  console.log(`  report: ${path.relative(process.cwd(), reportFile)}`);
  const failed = checks.filter((c) => !c.ok).length + (attested === false ? 1 : 0);
  console.log(`\n  RESULT: ${failed === 0 ? 'ALL CHECKS PASS' : `${failed} CHECK(S) FAILED`}\n`);
  if (failed > 0) process.exit(1);
})();
