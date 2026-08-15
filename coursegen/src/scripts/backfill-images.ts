#!/usr/bin/env node
// images:backfill — an operator CLI that fills in missing illustrations on
// ALREADY-PUBLISHED (or in-review) lessons, without regenerating any content.
//
//   npm run images:backfill -- --course <slug> [--locale <es-MX|en-US|pt-BR>] [--reuse-only] [--dry-run]
//
// For every lesson_document of a published-or-review lesson in the course, it
// runs the EXISTING `illustrateSegments()` (pipeline/images.ts) over the STORED
// client-safe `document`, which fills every target in the shared per-type
// illustration plan that lacks one, and PATCHes ONLY the `document` column
// back via PostgREST.
//
// Invariants (mirrors the images stage — COURSE_ENGINE.md §4, AGENTS.md §8d):
//  - We START from the stored `document` and only ADD `image_url` fields. The
//    sibling `audio` column and any per-segment audio stamps inside the document
//    are never read or rewritten (structuredClone inside illustrateSegments
//    preserves every other field; the PATCH body is `{ document }` and nothing
//    else). `answer_keys` is never read or written.
//  - No Prism configuration → a clean full skip, exit 0. `--reuse-only` never
//    asks Prism at all. Per-target provider failures in the normal mode
//    (rate limit, HTTP, network) are already
//    log-and-continue inside illustrateSegments — icons stay the fallback.
//  - A document that gained ZERO images is NOT patched (no-op write avoidance).
//  - A PAID run (neither --reuse-only nor --dry-run) first verifies Prism's
//    advertised illustration style version against this build (the same
//    GET /health handshake pipeline/run.ts enforces) and hard-fails on a
//    mismatch or an unverifiable probe — BEFORE any paid call.
//  - Exit 0 on any clean run (even all-skipped / quota-exhausted); exit 1 only
//    on an unexpected error (bad slug, Vault HTTP failure, …).
//
// Operator-triggered only — never CI. Reuses illustrateSegments; never
// reimplements it.

import { pathToFileURL } from 'node:url';
import {
  applySceneImages,
  clearSceneImages,
  collectSceneImages,
  illustrateSegments,
  type IllustrateOptions,
  type IllustrateResult,
} from '../pipeline/images.js';
import { buildImageInheritance, type ImageInheritance } from '../pipeline/imageInheritance.js';
import { FORGE_ILLUSTRATION_STYLE_VERSION } from '../pipeline/illustrationStyle.js';
import { fetchPrismStyleVersion, type PrismStyleProbe } from '../providers/picturegen.js';
import { getConfig } from '../env.js';
import { vaultSelect, vaultPatch } from '../vault/restClient.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

// ── Pure orchestration (dependency-injected — see backfillImages.test.ts) ────

export interface BackfillDocRow {
  lessonId: string;
  /** For readable per-document log lines; falls back to lessonId. */
  lessonSlug: string;
  locale: string;
  /** Null/undefined means legacy art and is never eligible as a free donor. */
  illustrationStyleVersion?: string | null;
  /** The STORED client-safe document, passed straight to illustrateSegments (never re-parsed/stripped). */
  document: LessonDocumentParsed;
}

/**
 * The PATCH body — `document` always (§8d / audio-untouched invariant), plus
 * `illustration_style_version` ONLY on a restyle pass. A normal backfill adds
 * missing art to a document whose generation is unchanged and must leave the
 * stamp alone; a restyle deliberately moves the document to the current
 * generation, and without re-stamping it the release check would reject its
 * own repaired output forever.
 */
export interface BackfillWriteBody {
  document: LessonDocumentParsed;
  illustration_style_version?: string;
}

export interface BackfillDeps {
  /** Fetch every lesson_document to consider for a course slug. */
  listDocuments: (courseSlug: string) => Promise<BackfillDocRow[]>;
  /** The images stage over one document. In production this is `illustrateSegments`. */
  illustrate: (
    document: LessonDocumentParsed,
    options: Pick<IllustrateOptions, 'inherit' | 'reuseOnly' | 'scope'>,
  ) => Promise<IllustrateResult>;
  /** Persist the illustrated document — PATCHes ONLY `body.document`. */
  writeDocument: (row: BackfillDocRow, body: BackfillWriteBody) => Promise<void>;
  /**
   * Prism GET /health style probe (production: `fetchPrismStyleVersion`).
   * Undefined means Prism is not configured — the probe is skipped and the
   * pass short-circuits cleanly on the first not-configured illustrate result.
   */
  probeStyleVersion?: () => Promise<PrismStyleProbe>;
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
  /**
   * Reuse only already-approved object art from this course. This makes no
   * request to Prism and therefore incurs no image-generation spend. Targets
   * without an exact normalized-label match, including all scene anchors, are
   * intentionally left for a later paid, fail-closed pass.
   */
  reuseOnly?: boolean;
  /**
   * REPAIR MODE. Clears every scene-purpose image from documents whose
   * `illustration_style_version` is not the current one, then re-illustrates
   * and re-stamps them.
   *
   * Why a separate mode: `illustrateSegments` only ever ADDS — a slot holding
   * a URL is skipped, which is what makes normal re-runs idempotent and free.
   * That makes it structurally incapable of fixing the 2026-08-14 incident,
   * where all 1,208 published lessons HAVE a scene anchor and it is simply the
   * wrong picture. Object tiles are never cleared: their style version did not
   * move, so they are still current art and re-billing them would be waste.
   *
   * Locale handling is automatic here and deliberately not left to the
   * operator: the authoring locale is illustrated once and its scene URLs are
   * copied to the sibling locale documents by segment id (LF illustrations
   * carry no text, so one drawing serves all three). Running this per-locale
   * would pay three times for the same picture.
   */
  restyleScenes?: boolean;
}

export interface BackfillSummary {
  /** Documents actually processed (excludes the aborting doc on a not-configured run). */
  scanned: number;
  /** Documents that gained ≥1 image (== documents written, unless dry-run). */
  patched: number;
  imagesGenerated: number;
  /** Existing object illustrations placed from another stored document, free. */
  imagesInherited: number;
  /** Generated + inherited images; this is what determines whether a document is patched. */
  imagesPlaced: number;
  /** Documents processed that gained no new image (no matching art or nothing illustratable). */
  skipped: number;
  /** True when Prism is not configured — the whole pass is skipped, cleanly. */
  notConfigured: boolean;
  /** Restyle mode: stale scene images removed before re-illustration. */
  scenesCleared: number;
  /** Restyle mode: sibling-locale scene slots filled from the authoring locale, free. */
  scenesCopiedToLocales: number;
  /** Restyle mode: lessons whose documents were already on the current style and left alone. */
  lessonsAlreadyCurrent: number;
}

export async function backfillImages(deps: BackfillDeps, opts: BackfillOptions): Promise<BackfillSummary> {
  const log = deps.log ?? (() => undefined);

  /*
   * Style-version handshake — same preflight pipeline/run.ts enforces before a
   * paid generation run. A paid backfill asks Prism for FRESH art and PATCHes
   * it into stored documents WITHOUT touching their illustration_style_version
   * stamp, so drifted deployments would smuggle a different approved visual
   * generation into already-stamped lessons (and poison the inheritance index
   * and Prism's cache). Verify BEFORE any paid call and fail CLOSED on an
   * unverifiable probe — this entry point exists only for deliberate paid
   * repair, so there is no unrequired-images soft path here. Skipped when no
   * drift can land in Vault: --reuse-only never contacts Prism at all, and
   * --dry-run never PATCHes a document.
   */
  if (!opts.reuseOnly && !opts.dryRun && deps.probeStyleVersion) {
    const probe = await deps.probeStyleVersion();
    if ('unavailable' in probe) {
      throw new Error(
        `images:backfill — could not verify Prism's illustration style version (${probe.unavailable}); ` +
          `refusing a paid backfill. Use --reuse-only or --dry-run to proceed without patched paid art.`,
      );
    }
    if (probe.styleVersion !== FORGE_ILLUSTRATION_STYLE_VERSION) {
      throw new Error(
        `images:backfill — illustration style-version mismatch: Prism /health advertises "${probe.styleVersion}" ` +
          `but this Forge build expects "${FORGE_ILLUSTRATION_STYLE_VERSION}". Align the two deployments before a ` +
          `paid backfill: drifted art would be PATCHed into documents whose illustration_style_version stamp is untouched.`,
      );
    }
  }

  /*
   * A restyle is defined by comparing each document's stamp against the
   * CURRENT style, so it must see every locale of a lesson at once. Filtering
   * to one locale would clear that locale's scenes, pay for new ones, and
   * leave the two siblings pointing at the old art — a lesson rendering two
   * different pictures for the same segment depending on language.
   */
  if (opts.restyleScenes && opts.locale) {
    throw new Error('images:backfill — --restyle-scenes covers all locales of a lesson at once; drop --locale.');
  }

  const summary: BackfillSummary = {
    scanned: 0,
    patched: 0,
    imagesGenerated: 0,
    imagesInherited: 0,
    imagesPlaced: 0,
    skipped: 0,
    notConfigured: false,
    scenesCleared: 0,
    scenesCopiedToLocales: 0,
    lessonsAlreadyCurrent: 0,
  };

  const allRows = await deps.listDocuments(opts.courseSlug);
  const rows = opts.locale ? allRows.filter((r) => r.locale === opts.locale) : allRows;
  // Source order is explicit so the first matching object is deterministic.
  // The authoring locale comes first, then stable lesson and locale order.
  const sourceRows = [...allRows].sort((a, b) =>
    (a.locale === 'es-MX' ? 0 : 1) - (b.locale === 'es-MX' ? 0 : 1)
      || a.lessonSlug.localeCompare(b.lessonSlug)
      || a.locale.localeCompare(b.locale),
  );
  const donorRows = sourceRows.filter((row) => row.illustrationStyleVersion === FORGE_ILLUSTRATION_STYLE_VERSION);

  /*
   * Donor scoping — interlingual homographs. A single course-wide, label-only
   * index let an es-MX "Pan" (bread) donate its image to an en-US "pan"
   * (frying pan) tile in a DIFFERENT lesson: label equality across locales is
   * not object equality, and no verifier sits in this path. Two donor scopes
   * remain safe and are kept:
   *   - the SAME lesson, any locale — the deliberate 1-image-per-3-locales
   *     design (illustrations carry no text; the three locale documents of one
   *     lesson depict the same objects);
   *   - the same LOCALE, any lesson — same language, same word, same object.
   * Same-lesson art wins over same-locale art when a label exists in both.
   */
  const toIndexable = (row: BackfillDocRow) => ({ ...row.document, illustration_style_version: row.illustrationStyleVersion });
  const lessonIndexes = new Map<string, ImageInheritance>();
  const localeIndexes = new Map<string, ImageInheritance>();
  const inheritFor = (row: BackfillDocRow): ImageInheritance => {
    let lessonIndex = lessonIndexes.get(row.lessonId);
    if (!lessonIndex) {
      lessonIndex = buildImageInheritance(
        donorRows.filter((r) => r.lessonId === row.lessonId).map(toIndexable),
        FORGE_ILLUSTRATION_STYLE_VERSION,
      );
      lessonIndexes.set(row.lessonId, lessonIndex);
    }
    let localeIndex = localeIndexes.get(row.locale);
    if (!localeIndex) {
      localeIndex = buildImageInheritance(
        donorRows.filter((r) => r.locale === row.locale).map(toIndexable),
        FORGE_ILLUSTRATION_STYLE_VERSION,
      );
      localeIndexes.set(row.locale, localeIndex);
    }
    // Map construction lets later entries win, so lesson-scoped donors override.
    return new Map([...localeIndex, ...lessonIndex]);
  };

  if (opts.restyleScenes) {
    return restyleScenes(deps, opts, { rows, inheritFor, summary, log });
  }

  for (const row of rows) {
    const result = await deps.illustrate(row.document, {
      inherit: inheritFor(row),
      reuseOnly: opts.reuseOnly,
      scope: `${opts.courseSlug}/${row.lessonSlug}`,
    });

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
    summary.imagesInherited += result.inherited ?? 0;
    const placed = result.generated + (result.inherited ?? 0);
    summary.imagesPlaced += placed;

    if (placed > 0) {
      summary.patched++;
      if (!opts.dryRun) {
        // ONLY the document column — never `audio`, never `answer_keys`.
        await deps.writeDocument(row, { document: result.document });
      }
      log(`  + ${row.lessonSlug} [${row.locale}]: ${placed} image(s) (${result.generated} generated, ${result.inherited ?? 0} reused)${opts.dryRun ? ' (dry-run, not written)' : ' patched'}`);
    } else {
      // No-op write avoidance: nothing gained → nothing patched.
      summary.skipped++;
      log(`  · ${row.lessonSlug} [${row.locale}]: no new images`);
    }
  }

  return summary;
}

/** The locale Forge authors in; its document is the one that pays for scene art. */
const AUTHORING_LOCALE = 'es-MX';

interface RestyleContext {
  rows: BackfillDocRow[];
  inheritFor: (row: BackfillDocRow) => ImageInheritance;
  summary: BackfillSummary;
  log: (line: string) => void;
}

/**
 * Repair pass for lessons whose SCENE art belongs to a superseded illustration
 * generation (see BackfillOptions.restyleScenes).
 *
 * Per lesson, in order:
 *   1. skip entirely if every locale document is already on the current style;
 *   2. clear the scene images from the authoring-locale document and
 *      re-illustrate it — this is the only step that can spend money;
 *   3. copy the resulting scene URLs into the sibling locales by segment id,
 *      free, after clearing their stale ones;
 *   4. PATCH each changed document together with the current style stamp.
 *
 * Object tiles are untouched throughout: their style version did not move.
 * Step 2 still runs the ordinary plan, so any tile that was missing gets
 * filled — and Prism serves an already-drawn tile from cache for nothing.
 */
async function restyleScenes(
  deps: BackfillDeps,
  opts: BackfillOptions,
  ctx: RestyleContext,
): Promise<BackfillSummary> {
  const { rows, inheritFor, summary, log } = ctx;

  const byLesson = new Map<string, BackfillDocRow[]>();
  for (const row of rows) {
    const group = byLesson.get(row.lessonId);
    if (group) group.push(row);
    else byLesson.set(row.lessonId, [row]);
  }

  for (const [, group] of byLesson) {
    const stale = group.filter((r) => r.illustrationStyleVersion !== FORGE_ILLUSTRATION_STYLE_VERSION);
    if (stale.length === 0) {
      summary.lessonsAlreadyCurrent++;
      continue;
    }

    /*
     * Prefer the authoring locale as the one that pays. If this lesson has no
     * es-MX row at all (shouldn't happen, but a partial import could), fall
     * back to the first stale row rather than skipping the lesson — a repaired
     * picture in one locale beats leaving all three wrong.
     */
    const payer = group.find((r) => r.locale === AUTHORING_LOCALE) ?? stale[0]!;
    const scope = `${opts.courseSlug}/${payer.lessonSlug}`;

    const cleared = clearSceneImages(payer.document);
    summary.scenesCleared += cleared.cleared;

    const result = await deps.illustrate(cleared.document, {
      inherit: inheritFor(payer),
      reuseOnly: opts.reuseOnly,
      scope,
    });

    if (result.skippedReason === 'not-configured') {
      summary.notConfigured = true;
      log('Prism (PICTUREGEN_URL) not configured — skipping scene restyle (existing art left untouched)');
      break;
    }

    summary.scanned++;
    summary.imagesGenerated += result.generated;
    summary.imagesInherited += result.inherited ?? 0;
    summary.imagesPlaced += result.generated + (result.inherited ?? 0);

    const freshScenes = collectSceneImages(result.document);
    /*
     * Write the payer even when nothing new was drawn. On a --reuse-only or
     * quota-exhausted pass its scenes were cleared and not refilled, and
     * persisting that is CORRECT: an empty anchor renders as no image, which
     * is honest, while the stale one is an actively misleading picture. The
     * stamp is only advanced when the document really is complete, so an
     * emptied lesson stays visible to the release check as missing coverage.
     */
    const payerComplete = freshScenes.size === cleared.cleared;
    const writes: Array<{ row: BackfillDocRow; body: BackfillWriteBody }> = [
      {
        row: payer,
        body: payerComplete
          ? { document: result.document, illustration_style_version: FORGE_ILLUSTRATION_STYLE_VERSION }
          : { document: result.document },
      },
    ];

    for (const sibling of group) {
      if (sibling === payer) continue;
      const siblingCleared = clearSceneImages(sibling.document);
      summary.scenesCleared += siblingCleared.cleared;
      const applied = applySceneImages(siblingCleared.document, freshScenes);
      summary.scenesCopiedToLocales += applied.applied;
      const complete = applied.applied === siblingCleared.cleared && payerComplete;
      writes.push({
        row: sibling,
        body: complete
          ? { document: applied.document, illustration_style_version: FORGE_ILLUSTRATION_STYLE_VERSION }
          : { document: applied.document },
      });
    }

    summary.patched += writes.length;
    if (!opts.dryRun) {
      for (const write of writes) await deps.writeDocument(write.row, write.body);
    }
    log(
      `  ~ ${payer.lessonSlug}: ${cleared.cleared} stale scene(s) → ${result.generated} redrawn, ` +
        `copied to ${writes.length - 1} sibling locale(s)${opts.dryRun ? ' (dry-run, not written)' : ' patched'}`,
    );
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
  illustration_style_version: string | null;
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
      `/lesson_documents?lesson_id=${inFilter(batch)}&select=lesson_id,locale,document,illustration_style_version`,
    );
    for (const d of docs) {
      rows.push({
        lessonId: d.lesson_id,
        lessonSlug: slugById.get(d.lesson_id) ?? d.lesson_id,
        locale: d.locale,
        illustrationStyleVersion: d.illustration_style_version,
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
  reuseOnly?: boolean;
  restyleScenes?: boolean;
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
      case '--reuse-only':
        opts.reuseOnly = true;
        break;
      case '--restyle-scenes':
        opts.restyleScenes = true;
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
    console.error(
      'Usage: npm run images:backfill -- --course <slug> [--locale <es-MX|en-US|pt-BR>] [--restyle-scenes] [--reuse-only] [--dry-run]',
    );
    process.exit(1);
  }
  const courseSlug = opts.course;
  const dryRun = opts.dryRun ?? false;

  console.log(
    `images:backfill — course "${courseSlug}"${opts.locale ? ` [${opts.locale} only]` : ''}` +
      `${opts.restyleScenes ? ' (RESTYLE SCENES — stale scene art is cleared and redrawn)' : ''}` +
      `${opts.reuseOnly ? ' (reuse-only — no Prism calls)' : ''}${dryRun ? ' (dry-run — no Vault writes)' : ''}`,
  );

  // Probe only when Prism is actually configured (same gate as pipeline/run.ts):
  // an unconfigured Prism means zero paid calls, and the pass already
  // short-circuits cleanly on the first not-configured illustrate result.
  const config = getConfig();
  const prismConfigured = Boolean(config.PICTUREGEN_URL && config.PICTUREGEN_INTERNAL_KEY);

  const summary = await backfillImages(
    {
      listDocuments: listCourseDocuments,
      illustrate: (document, options) => illustrateSegments(document, options),
      writeDocument: patchLessonDocument,
      probeStyleVersion: prismConfigured ? fetchPrismStyleVersion : undefined,
      log: (line) => console.log(line),
    },
    { courseSlug, locale: opts.locale, dryRun, reuseOnly: opts.reuseOnly, restyleScenes: opts.restyleScenes },
  );

  console.log('');
  console.log(`  documents scanned:  ${summary.scanned}`);
  console.log(`  ${dryRun ? 'would patch:       ' : 'patched:           '} ${summary.patched}`);
  console.log(`  images generated:   ${summary.imagesGenerated}`);
  console.log(`  images reused:      ${summary.imagesInherited}`);
  console.log(`  images placed:      ${summary.imagesPlaced}`);
  console.log(`  skipped (no image): ${summary.skipped}`);
  if (opts.restyleScenes) {
    console.log(`  stale scenes cleared:      ${summary.scenesCleared}`);
    console.log(`  scenes copied to locales:  ${summary.scenesCopiedToLocales} (free — one drawing serves 3 locales)`);
    console.log(`  lessons already current:   ${summary.lessonsAlreadyCurrent}`);
  }
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
