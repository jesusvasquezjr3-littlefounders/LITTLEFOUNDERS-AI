#!/usr/bin/env node
// images:backfill — an operator CLI that fills in missing illustrations on
// ALREADY-PUBLISHED (or in-review) lessons, without regenerating any content.
//
//   npm run images:backfill -- --course <slug> [--locale <es-MX|en-US|pt-BR>] [--dry-run]
//
// For every lesson_document of a published-or-review lesson in the course, it
// runs the EXISTING `illustrateSegments()` (pipeline/images.ts) over the STORED
// client-safe `document`, which fills `image_url` on picture_choice options and
// memory_flip card sides that lack one, and PATCHes ONLY the `document` column
// back via PostgREST.
//
// Invariants (mirrors the images stage — COURSE_ENGINE.md §4, AGENTS.md §8d):
//  - We START from the stored `document` and only ADD `image_url` fields. The
//    sibling `audio` column and any per-segment audio stamps inside the document
//    are never read or rewritten (structuredClone inside illustrateSegments
//    preserves every other field; the PATCH body is `{ document }` and nothing
//    else). `answer_keys` is never read or written.
//  - No GEMINI_API_KEY → a clean full skip ("GEMINI_API_KEY not configured"),
//    exit 0. Per-option failures (429 limit:0 quota, HTTP, network) are already
//    log-and-continue inside illustrateSegments — icons stay the fallback.
//  - A document that gained ZERO images is NOT patched (no-op write avoidance).
//  - Exit 0 on any clean run (even all-skipped / quota-exhausted); exit 1 only
//    on an unexpected error (bad slug, Vault HTTP failure, …).
//
// Operator-triggered only — never CI. Reuses illustrateSegments; never
// reimplements it.

import { pathToFileURL } from 'node:url';
import { illustrateSegments, type IllustrateResult } from '../pipeline/images.js';
import { vaultSelect, vaultPatch } from '../vault/restClient.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

// ── Pure orchestration (dependency-injected — see backfillImages.test.ts) ────

export interface BackfillDocRow {
  lessonId: string;
  /** For readable per-document log lines; falls back to lessonId. */
  lessonSlug: string;
  locale: string;
  /** The STORED client-safe document, passed straight to illustrateSegments (never re-parsed/stripped). */
  document: LessonDocumentParsed;
}

/** The PATCH body — intentionally ONLY the `document` column (§8d / audio-untouched invariant). */
export interface BackfillWriteBody {
  document: LessonDocumentParsed;
}

export interface BackfillDeps {
  /** Fetch every lesson_document to consider for a course slug. */
  listDocuments: (courseSlug: string) => Promise<BackfillDocRow[]>;
  /** The images stage over one document. In production this is `illustrateSegments`. */
  illustrate: (document: LessonDocumentParsed) => Promise<IllustrateResult>;
  /** Persist the illustrated document — PATCHes ONLY `body.document`. */
  writeDocument: (row: BackfillDocRow, body: BackfillWriteBody) => Promise<void>;
  /** Per-document progress lines. Defaults to a no-op (tests stay quiet). */
  log?: (line: string) => void;
}

export interface BackfillOptions {
  courseSlug: string;
  /** Illustrate only this locale's documents. Consumption discipline: LF
   *  illustrations carry no text, so one image serves every locale — generate
   *  for es-MX only, then copy the URLs to the sibling locales (SQL or the
   *  pipeline's pre-localize illustration for new runs). */
  locale?: string;
  /** Run the full illustration pass but skip every Vault write. */
  dryRun?: boolean;
}

export interface BackfillSummary {
  /** Documents actually processed (excludes the aborting doc on a not-configured run). */
  scanned: number;
  /** Documents that gained ≥1 image (== documents written, unless dry-run). */
  patched: number;
  imagesGenerated: number;
  /** Documents processed that gained no new image (quota exhausted or nothing illustratable). */
  skipped: number;
  /** True when Gemini has no API key — the whole pass is skipped, cleanly. */
  notConfigured: boolean;
}

export async function backfillImages(deps: BackfillDeps, opts: BackfillOptions): Promise<BackfillSummary> {
  const log = deps.log ?? (() => undefined);
  const summary: BackfillSummary = {
    scanned: 0,
    patched: 0,
    imagesGenerated: 0,
    skipped: 0,
    notConfigured: false,
  };

  const allRows = await deps.listDocuments(opts.courseSlug);
  const rows = opts.locale ? allRows.filter((r) => r.locale === opts.locale) : allRows;

  for (const row of rows) {
    const result = await deps.illustrate(row.document);

    // No API key at all: illustrateSegments returns 'not-configured' and the
    // ORIGINAL document untouched. Every remaining doc would do the same, so
    // stop the whole pass here — cleanly, icons stay the fallback.
    if (result.skippedReason === 'not-configured') {
      summary.notConfigured = true;
      log('Prism (PICTUREGEN_URL) not configured — skipping images backfill (icons remain the fallback)');
      break;
    }

    summary.scanned++;
    summary.imagesGenerated += result.generated;

    if (result.generated > 0) {
      summary.patched++;
      if (!opts.dryRun) {
        // ONLY the document column — never `audio`, never `answer_keys`.
        await deps.writeDocument(row, { document: result.document });
      }
      log(`  + ${row.lessonSlug} [${row.locale}]: ${result.generated} image(s)${opts.dryRun ? ' (dry-run, not written)' : ' patched'}`);
    } else {
      // No-op write avoidance: nothing gained → nothing patched.
      summary.skipped++;
      log(`  · ${row.lessonSlug} [${row.locale}]: no new images`);
    }
  }

  return summary;
}

// ── Production wiring (Vault via service-role PostgREST) ──────────────────────

interface IdRow {
  id: string;
}
interface LessonRow {
  id: string;
  slug: string;
}
interface LessonDocRow {
  lesson_id: string;
  locale: string;
  document: LessonDocumentParsed;
}

/** `in.(a,b,c)` — callers guarantee a non-empty list (never emit `in.()`). */
function inFilter(ids: string[]): string {
  return `in.(${ids.map((id) => encodeURIComponent(id)).join(',')})`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Resolve a course slug to every lesson_document of its published-or-review
 * lessons, walking the hierarchy by id in the same step-by-step `in.(…)` style
 * as backend/src/services/supabaseRest.ts (embedded PostgREST joins are awkward
 * and brittle here). lesson_documents is finally fetched by lesson_id in
 * batches so the GET URL never grows unbounded on a big course.
 */
async function listCourseDocuments(courseSlug: string): Promise<BackfillDocRow[]> {
  const courses = await vaultSelect<IdRow>(`/courses?slug=eq.${encodeURIComponent(courseSlug)}&select=id`);
  const course = courses[0];
  if (!course) throw new Error(`images:backfill — course "${courseSlug}" not found in Vault`);

  const adventures = await vaultSelect<IdRow>(`/adventures?course_id=eq.${encodeURIComponent(course.id)}&select=id`);
  const adventureIds = adventures.map((a) => a.id);
  if (adventureIds.length === 0) return [];

  const sagas = await vaultSelect<IdRow>(`/sagas?adventure_id=${inFilter(adventureIds)}&select=id`);
  const sagaIds = sagas.map((s) => s.id);
  if (sagaIds.length === 0) return [];

  const topics = await vaultSelect<IdRow>(`/topics?saga_id=${inFilter(sagaIds)}&select=id`);
  const topicIds = topics.map((t) => t.id);
  if (topicIds.length === 0) return [];

  const lessons = await vaultSelect<LessonRow>(
    `/lessons?topic_id=${inFilter(topicIds)}&status=in.(published,review)&select=id,slug`,
  );
  if (lessons.length === 0) return [];
  const slugById = new Map(lessons.map((l) => [l.id, l.slug]));
  const lessonIds = lessons.map((l) => l.id);

  const rows: BackfillDocRow[] = [];
  for (const batch of chunk(lessonIds, 100)) {
    const docs = await vaultSelect<LessonDocRow>(
      `/lesson_documents?lesson_id=${inFilter(batch)}&select=lesson_id,locale,document`,
    );
    for (const d of docs) {
      rows.push({
        lessonId: d.lesson_id,
        lessonSlug: slugById.get(d.lesson_id) ?? d.lesson_id,
        locale: d.locale,
        document: d.document,
      });
    }
  }
  return rows;
}

async function patchLessonDocument(row: BackfillDocRow, body: BackfillWriteBody): Promise<void> {
  await vaultPatch(
    `/lesson_documents?lesson_id=eq.${encodeURIComponent(row.lessonId)}&locale=eq.${encodeURIComponent(row.locale)}`,
    body,
  );
}

// ── CLI entry ────────────────────────────────────────────────────────────────

interface CliOptions {
  course?: string;
  locale?: string;
  dryRun?: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--locale':
        opts.locale = argv[++i];
        break;
      case '--course':
        opts.course = argv[++i];
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      default:
        console.error(`images:backfill — unknown argument "${arg}"`);
        process.exit(1);
    }
  }
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.course) {
    console.error('Usage: npm run images:backfill -- --course <slug> [--locale <es-MX|en-US|pt-BR>] [--dry-run]');
    process.exit(1);
  }
  const courseSlug = opts.course;
  const dryRun = opts.dryRun ?? false;

  console.log(`images:backfill — course "${courseSlug}"${opts.locale ? ` [${opts.locale} only]` : ''}${dryRun ? ' (dry-run — no Vault writes)' : ''}`);

  const summary = await backfillImages(
    {
      listDocuments: listCourseDocuments,
      illustrate: (document) => illustrateSegments(document),
      writeDocument: patchLessonDocument,
      log: (line) => console.log(line),
    },
    { courseSlug, locale: opts.locale, dryRun },
  );

  console.log('');
  console.log(`  documents scanned:  ${summary.scanned}`);
  console.log(`  ${dryRun ? 'would patch:       ' : 'patched:           '} ${summary.patched}`);
  console.log(`  images generated:   ${summary.imagesGenerated}`);
  console.log(`  skipped (no image): ${summary.skipped}`);
  if (summary.notConfigured) {
    console.log('  NOTE: Prism (PICTUREGEN_URL) not configured — images stage skipped entirely (icons remain the fallback)');
  }
}

// Run only when executed directly (`tsx src/scripts/backfill-images.ts`), never
// when imported by the test suite.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exit(1);
  });
}
