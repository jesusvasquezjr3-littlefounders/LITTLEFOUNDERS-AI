/*
 * verify-course.ts — the single acceptance check for a generated course.
 *
 * Run with `npm run verify:course -- [course-slug]` (defaults to first-lemonade-stand).
 *
 * This is what "100% successful" has to MEAN, expressed as things that are either
 * true or false rather than as a feeling. Every check below is deterministic and
 * re-runnable, so the same command answers the question the same way tomorrow.
 */
import { runAllGates } from './pipeline/gates.js';
import { loadCourseCatalog } from './catalog/loader.js';
import { checkProgression } from './catalog/progression.js';
import { inspectIllustrationCoverage } from './pipeline/images.js';
import { FORGE_ILLUSTRATION_STYLE_VERSION } from './pipeline/illustrationStyle.js';

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

async function attestCourseRelease(courseId: string, checks: readonly Check[]): Promise<boolean> {
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
        verified_at: new Date().toISOString(),
        checks: checks.map((check) => ({ name: check.name, ok: check.ok, detail: check.detail })),
      }]),
    });
    return res.ok;
  } catch {
    return false;
  }
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

(async () => {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  // ---- catalog: does the blueprint describe a learnable path at all? ----------
  const load = loadCourseCatalog(`curriculum/${COURSE}`);
  const catalogErrors = load.issues.filter((i) => i.level === 'error');
  add('catalog loads with no errors', catalogErrors.length === 0, `${catalogErrors.length} error(s)`);
  const prog = checkProgression(load.course);
  const progErrors = prog.filter((i) => i.level === 'error');
  add(
    'pedagogical progression has no errors',
    progErrors.length === 0,
    progErrors.length === 0 ? `${prog.length} warning(s)` : progErrors.map((i) => i.code).join(', '),
  );

  // ---- Vault: hierarchy + every published document ----------------------------
  interface DocRow {
    locale: string;
    document: { segments?: Array<{ id: string } & Record<string, unknown>> } & Record<string, unknown>;
    answer_keys: Record<string, unknown> | null;
    audio: { version?: unknown } | null;
    illustration_style_version: string | null;
    lesson_id: string;
  }
  const course = (await q(`courses?select=id,slug,title,status&slug=eq.${COURSE}`)) as { id: string; slug: string }[];
  if (course.length === 0) {
    console.error(`verify: course "${COURSE}" is not in Vault`);
    process.exit(1);
  }
  const adv = (await q(`adventures?select=id&course_id=eq.${course[0]!.id}`)) as { id: string }[];
  const sagas = adv.length
    ? ((await q(`sagas?select=id&adventure_id=in.(${adv.map((a) => a.id).join(',')})`)) as { id: string }[])
    : [];
  const topics = sagas.length
    ? ((await q(`topics?select=id,title&saga_id=in.(${sagas.map((s) => s.id).join(',')})`)) as {
    id: string;
    title: unknown;
    }[])
    : [];
  const lessons = topics.length
    ? await qChunked<{ id: string; slug: string; status: string; topics?: { sagas?: { adventures?: { age_tier?: string } } } }>(
        (batch) =>
          `lessons?select=id,slug,status,topics!inner(sagas!inner(adventures!inner(age_tier)))&topic_id=in.(${batch.join(',')})`,
        topics.map((t) => t.id),
      )
    : [];
  // A human must run the acceptance check BEFORE release, while Forge's
  // lessons are still `review`. Published lessons are included too so the
  // command remains a useful post-release regression check.
  const publishedLessons = lessons.filter((l) => l.status === 'review' || l.status === 'published');
  const docs = publishedLessons.length
    ? await qChunked<DocRow>(
        (batch) =>
          `lesson_documents?select=locale,document,answer_keys,audio,illustration_style_version,lesson_id&lesson_id=in.(${batch.join(',')})`,
        publishedLessons.map((l) => l.id),
      )
    : [];
  const bySlug = new Map(publishedLessons.map((l) => [l.id, l.slug]));
  const tierByLessonId = new Map(
    publishedLessons.map((lesson) => [lesson.id, lesson.topics?.sagas?.adventures?.age_tier]),
  );

  // Expected blueprint count from the catalog, so a MISSING lesson is caught.
  let blueprintCount = 0;
  for (const a of load.course.adventures) {
    for (const sg of a.data.sagas) for (const t of sg.topics) blueprintCount += t.lessons.length;
  }
  add(
    'every blueprint produced a release-ready lesson',
    publishedLessons.length === blueprintCount,
    `${publishedLessons.length} review-or-published / ${blueprintCount} blueprints`,
  );
  add(
    'every release-ready lesson has all 3 locales',
    docs.length === publishedLessons.length * 3,
    `${docs.length} documents / ${publishedLessons.length * 3} expected`,
  );
  const staleIllustrationStyle = docs.filter((d) => d.illustration_style_version !== FORGE_ILLUSTRATION_STYLE_VERSION);
  add(
    'every release-ready document uses the current illustration style',
    staleIllustrationStyle.length === 0,
    `${docs.length - staleIllustrationStyle.length}/${docs.length} documents use ${FORGE_ILLUSTRATION_STYLE_VERSION}`,
  );

  /*
   * DECLARED exceptions. A lesson blueprint may carry `known_exception` naming a
   * decided design conflict; those lessons are reported SEPARATELY rather than counted
   * as failures, so this check can be green without lying. The declaration lives in the
   * catalog next to the blueprint — never as a slug hardcoded here, which is how an
   * exception quietly becomes permanent.
   */
  const exceptions = new Map<string, string>();
  for (const a of load.course.adventures) {
    for (const sg of a.data.sagas) {
      for (const t of sg.topics) {
        for (const l of t.lessons) {
          if (l.known_exception) exceptions.set(l.slug, l.known_exception);
        }
      }
    }
  }

  // ---- gates over every release-ready document --------------------------------
  const gateFailures = new Map<string, string[]>();
  const excepted = new Set<string>();
  let cleanDocs = 0;
  for (const d of docs) {
    const slug = bySlug.get(d.lesson_id) ?? d.lesson_id;
    const keys = d.answer_keys || {};
    const merged = {
      ...d.document,
      segments: (d.document.segments || []).map((s) => (keys[s.id] ? { ...s, answer: keys[s.id] } : s)),
    };
    const problems: string[] = [];
    const tier = tierByLessonId.get(d.lesson_id);
    if (!tier || !load.course.taxonomy || !load.course.facts) {
      problems.push('release context: could not determine the lesson age tier, taxonomy, or facts');
    } else {
      const report = runAllGates(merged, {
        taxonomy: load.course.taxonomy,
        facts: load.course.facts,
        tier,
      });
      problems.push(...report.problems.map((p) => `gate ${p.gate}: ${p.message}`));
    }
    if (problems.length === 0) cleanDocs++;
    else if (exceptions.has(slug)) excepted.add(slug);
    else gateFailures.set(`${slug} [${d.locale}]`, problems);
  }
  add(
    'all release-ready documents pass every gate',
    gateFailures.size === 0,
    `${cleanDocs}/${docs.length} clean${excepted.size > 0 ? `, ${excepted.size} declared exception(s)` : ''}`,
  );

  // ---- visual-first delivery ------------------------------------------------
  // A text-only `--no-images` pilot is useful and intentionally cheap, but it
  // is NOT releasable kid-facing content. Count only the targets declared by
  // images.ts; abstract/icon-first interactions remain valid without an image.
  const visualGaps: string[] = [];
  let requiredVisuals = 0;
  let presentVisuals = 0;
  for (const d of docs) {
    const coverage = inspectIllustrationCoverage(d.document as never);
    requiredVisuals += coverage.required;
    presentVisuals += coverage.present;
    if (coverage.missing.length > 0) {
      const slug = bySlug.get(d.lesson_id) ?? d.lesson_id;
      visualGaps.push(`${slug} [${d.locale}]: ${coverage.missing.length}`);
    }
  }
  add(
    'every planned visual target has an approved illustration',
    visualGaps.length === 0,
    `${presentVisuals}/${requiredVisuals} present${visualGaps.length > 0 ? `; missing in ${visualGaps.slice(0, 5).join(', ')}` : ''}`,
  );

  /*
   * ---- identity migration contract (roadmap.sh pattern, 2026-07-25) ----------
   * A Vault lesson that the catalog no longer names is an ORPHAN. Orphans with
   * learner progress FAIL the acceptance check: a restructure that strands a
   * kid's attempts/streaks must be declared (`renamed_from` in the blueprint —
   * publish renames the row and keeps its UUID) instead of shipping silently.
   * Orphans WITHOUT progress are reported informationally: clutter, not harm.
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
  add(
    'no orphaned lessons carry learner progress (declare renames via renamed_from)',
    orphansWithProgress.length === 0,
    orphansWithProgress.length === 0
      ? `${orphans.length} orphan(s), none with progress`
      : `ORPHANED WITH PROGRESS: ${orphansWithProgress.join(', ')}`,
  );

  // ---- currency really is local (a silent localization failure is invisible) ---
  const WRONG: Record<string, RegExp> = {
    'es-MX': /\bdollars?\b|\breais\b/i,
    'en-US': /\bpesos?\b|\breais\b/i,
    'pt-BR': /\bpesos?\b|\bdollars?\b/i,
  };
  /*
   * Only USER-VISIBLE text counts. Scanning the raw JSON produced false positives on
   * option IDs — a pt-BR lesson whose text correctly read "1 real por copo" was
   * flagged because its id was still `opt-1-peso`. IDs are never shown to a child and
   * are deliberately locale-stable (localize's NON_VISIBLE_KEYS keeps them frozen so
   * answer keys keep matching), so an id must not fail this check.
   */
  const VISIBLE_KEYS = new Set([
    'prompt_md', 'text_md', 'body_md', 'explanation_md', 'recap_md', 'label', 'title',
    'front_md', 'back_md', 'claim_md', 'artifact_md', 'intro_md', 'instruction_md',
    'criterion_md', 'rationale_md', 'fix_md', 'a_md', 'b_md', 'opening_md', 'role_md',
    'unknown_label', 'ask_label', 'hints',
  ]);
  function visibleText(node: unknown, key?: string): string[] {
    if (typeof node === 'string') return key && VISIBLE_KEYS.has(key) ? [node] : [];
    if (Array.isArray(node)) return node.flatMap((v) => visibleText(v, key));
    if (node && typeof node === 'object') {
      return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => visibleText(v, k));
    }
    return [];
  }
  const currencyLeaks: string[] = [];
  for (const d of docs) {
    const text = visibleText(d.document).join(' \n ');
    const slug = bySlug.get(d.lesson_id) ?? '';
    if (WRONG[d.locale]?.test(text) && !exceptions.has(slug)) currencyLeaks.push(`${slug} [${d.locale}]`);
  }
  add('no foreign currency words leaked across locales', currencyLeaks.length === 0, currencyLeaks.slice(0, 5).join(', '));

  // ---- topic titles actually localized ---------------------------------------
  const untranslated = topics.filter((t) => {
    const title = t.title as Record<string, string> | null;
    if (!title) return true;
    const values = ['en-US', 'es-MX', 'pt-BR'].map((l) => (title[l] ?? '').trim());
    return values.some((v) => v.length === 0) || new Set(values).size === 1;
  });
  add(
    'topic titles are present and localized in all 3 locales',
    untranslated.length === 0,
    `${untranslated.length} topic(s) blank or identical across locales`,
  );

  // ---- audio (informational: narration is a separate, deferred stage) ---------
  const withAudio = docs.filter((d) => d.audio?.version).length;

  // ---- release attestation ----------------------------------------------------
  // The release RPC refuses to make content visible unless a successful full
  // verification exists after the latest document update. The attestation is
  // operational metadata only; the later Core release click is the audited
  // human approval for kid-facing content.
  if (checks.every((check) => check.ok)) {
    const attested = await attestCourseRelease(course[0]!.id, checks);
    add('release verification attestation saved', attested, attested ? 'release gate unlocked until a document changes' : 'Vault did not accept the attestation');
  }

  // ---- report ----------------------------------------------------------------
  console.log(`\n══ ACCEPTANCE CHECK — ${COURSE} ══`);
  for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  if (gateFailures.size > 0) {
    console.log(`\n  gate failures:`);
    for (const [where, problems] of [...gateFailures].slice(0, 12)) {
      console.log(`    ✗ ${where}`);
      for (const p of problems.slice(0, 2)) console.log(`        ${p.slice(0, 130)}`);
    }
    if (gateFailures.size > 12) console.log(`    … and ${gateFailures.size - 12} more`);
  }
  if (exceptions.size > 0) {
    console.log(`\n  DECLARED EXCEPTIONS (not counted as failures — each one is a decided design conflict):`);
    for (const [slug, reason] of exceptions) {
      console.log(`    • ${slug}${excepted.has(slug) ? ' (currently failing, as declared)' : ' (currently passing)'}`);
      console.log(`        ${reason.replace(/\s+/g, ' ').slice(0, 300)}…`);
    }
  }
  console.log(`\n  (informational) narrated documents: ${withAudio}/${docs.length}`);
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n  RESULT: ${failed.length === 0 ? 'ALL CHECKS PASS' : `${failed.length} CHECK(S) FAILED`}\n`);
  if (failed.length > 0) process.exit(1);
})();
