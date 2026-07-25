/*
 * verify-course.ts — the single acceptance check for a generated course.
 *
 * Run with `npm run verify:course -- [course-slug]` (defaults to first-lemonade-stand).
 *
 * This is what "100% successful" has to MEAN, expressed as things that are either
 * true or false rather than as a feeling. Every check below is deterministic and
 * re-runnable, so the same command answers the question the same way tomorrow.
 */
import { runContractGate, runClarityGate } from './pipeline/gates.js';
import { runGenerationQualityGate } from './pipeline/generationQuality.js';
import { loadCourseCatalog } from './catalog/loader.js';
import { checkProgression } from './catalog/progression.js';

const COURSE = process.argv[2] ?? 'first-lemonade-stand';
const S = process.env.SUPABASE_URL!, K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const q = async (p: string) =>
  (await fetch(`${S}/rest/v1/${p}`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json();

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
  const course: any[] = await q(`courses?select=id,slug,title,status&slug=eq.${COURSE}`);
  if (course.length === 0) {
    console.error(`verify: course "${COURSE}" is not in Vault`);
    process.exit(1);
  }
  const adv: any[] = await q(`adventures?select=id&course_id=eq.${course[0].id}`);
  const sagas: any[] = await q(`sagas?select=id&adventure_id=in.(${adv.map((a) => a.id).join(',')})`);
  const topics: any[] = await q(`topics?select=id,title&saga_id=in.(${sagas.map((s) => s.id).join(',')})`);
  const lessons: any[] = await q(
    `lessons?select=id,slug,status&topic_id=in.(${topics.map((t) => t.id).join(',')})`,
  );
  const publishedLessons = lessons.filter((l) => l.status === 'published');
  const docs: any[] = await q(
    `lesson_documents?select=locale,document,answer_keys,audio,lesson_id&lesson_id=in.(${publishedLessons.map((l) => l.id).join(',')})`,
  );
  const bySlug = new Map(publishedLessons.map((l) => [l.id, l.slug]));

  // Expected blueprint count from the catalog, so a MISSING lesson is caught.
  let blueprintCount = 0;
  for (const a of load.course.adventures) {
    for (const sg of a.data.sagas) for (const t of sg.topics) blueprintCount += t.lessons.length;
  }
  add(
    'every blueprint produced a published lesson',
    publishedLessons.length === blueprintCount,
    `${publishedLessons.length} published / ${blueprintCount} blueprints`,
  );
  add(
    'every published lesson has all 3 locales',
    docs.length === publishedLessons.length * 3,
    `${docs.length} documents / ${publishedLessons.length * 3} expected`,
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

  // ---- gates over every published document ------------------------------------
  const gateFailures = new Map<string, string[]>();
  const excepted = new Set<string>();
  let cleanDocs = 0;
  for (const d of docs) {
    const slug = bySlug.get(d.lesson_id) ?? d.lesson_id;
    const keys = d.answer_keys || {};
    const merged = {
      ...d.document,
      segments: (d.document.segments || []).map((s: any) => (keys[s.id] ? { ...s, answer: keys[s.id] } : s)),
    };
    const contract = runContractGate(merged);
    const problems: string[] = [];
    if (!contract.ok || !contract.document) problems.push(...contract.problems.map((p: any) => `contract: ${p.message}`));
    else {
      problems.push(...runClarityGate(contract.document).map((p: any) => `clarity: ${p.message}`));
      problems.push(...runGenerationQualityGate(contract.document).map((p: any) => `quality: ${p.message}`));
    }
    if (problems.length === 0) cleanDocs++;
    else if (exceptions.has(slug)) excepted.add(slug);
    else gateFailures.set(`${slug} [${d.locale}]`, problems);
  }
  add(
    'all published documents pass every gate',
    gateFailures.size === 0,
    `${cleanDocs}/${docs.length} clean${excepted.size > 0 ? `, ${excepted.size} declared exception(s)` : ''}`,
  );

  // ---- currency really is local (a silent localization failure is invisible) ---
  const CURRENCY: Record<string, RegExp> = {
    'es-MX': /\bpesos?\b/i,
    'en-US': /\bdollars?\b/i,
    'pt-BR': /\breais\b|\breal\b/i,
  };
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
