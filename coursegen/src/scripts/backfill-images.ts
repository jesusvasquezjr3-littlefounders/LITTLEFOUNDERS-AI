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
  inspectIllustrationCoverage,
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
  /**
   * Restrict the pass to ONE adventure of the course. A 1,208-lesson repair is
   * not something to launch on faith: running a single adventure first puts
   * real repaired lessons in front of a human for a fraction of the cost, and
   * the rest of the catalog is untouched if the result is wrong.
   */
  adventureSlug?: string;
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
  /**
   * Required to let `--restyle-scenes` contact Prism at all. Same shape as
   * `database/scripts/railway-migrate.sh --confirm-production`: an
   * irreversible, billable action against the live catalog must be authorized
   * on the command line, never implied by the absence of `--dry-run`.
   *
   * A restyle is the one mode where a mistake is expensive in BOTH directions
   * — it CLEARS art before redrawing it — so the default has to be the safe
   * one. Without this flag the pass runs measurement-only and says so.
   */
  confirmSpend?: boolean;
  /**
   * Hard ceiling in USD for a confirmed restyle, priced at
   * `COST_QWEN_IMAGE_PER_IMAGE` per image Prism reports as freshly generated.
   * On reaching it the pass STOPS between lessons and returns what it has.
   *
   * Required, not optional, for a paid restyle. `illustrateSegments` takes an
   * OPTIONAL ledger and this path never supplied one, so repairing the
   * financial-education catalog — 3,397 redraws, more with verifier retries —
   * would have run with no kill switch of any kind behind it. AGENTS.md §1.14
   * asks that budget guards actually BIND; an unbounded four-figure loop over a
   * live catalog is the case it was written for.
   *
   * Stopping early is SAFE by construction: each lesson is patched and stamped
   * as a unit, so an interrupted pass leaves finished lessons current and
   * untouched ones stale. Re-running resumes — `lessonsAlreadyCurrent` skips
   * whatever was already repaired.
   */
  maxUsd?: number;
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
  /** Restyle mode: USD spent on freshly generated images, at COST_QWEN_IMAGE_PER_IMAGE. */
  usdSpent: number;
  /** Restyle mode: true when --max-usd stopped the pass before every lesson was repaired. */
  stoppedOnBudget: boolean;
}

/**
 * May this invocation make a PAID Prism request? One predicate, used both by
 * the style-version handshake and by the illustrate calls, so the two can
 * never disagree about whether money is on the table.
 *
 * `--reuse-only` and `--dry-run` block spending in every mode. A restyle
 * additionally requires `--confirm-spend`, because it CLEARS art before
 * redrawing it and is therefore the one mode where the unsafe default would be
 * expensive in both directions.
 */
export function spendAllowed(opts: BackfillOptions): boolean {
  if (opts.reuseOnly || opts.dryRun) return false;
  return opts.restyleScenes ? Boolean(opts.confirmSpend) : true;
}

export async function backfillImages(deps: BackfillDeps, opts: BackfillOptions): Promise<BackfillSummary> {
  const log = deps.log ?? (() => undefined);
  const paid = spendAllowed(opts);

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
  if (paid && deps.probeStyleVersion) {
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
  /*
   * A confirmed restyle spends real money in an unattended loop over a live
   * catalog, so it must carry its own ceiling. Refusing here — before the Vault
   * read, before the Prism probe — means the operator states a number they are
   * willing to lose, exactly like FORGE_MAX_USD_PER_RUN does for a generation.
   */
  if (paid && opts.restyleScenes && !(opts.maxUsd && opts.maxUsd > 0)) {
    throw new Error('images:backfill — a confirmed --restyle-scenes needs an explicit --max-usd ceiling (e.g. --max-usd 400).');
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
    usdSpent: 0,
    stoppedOnBudget: false,
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
    return restyleScenes(deps, opts, { rows, inheritFor, summary, log, paid, usdPerImage: getConfig().COST_QWEN_IMAGE_PER_IMAGE });
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

/** Consecutive image-hungry lessons that may produce nothing before the pass aborts. */
const MAX_BARREN_LESSONS = 3;

interface RestyleContext {
  rows: BackfillDocRow[];
  inheritFor: (row: BackfillDocRow) => ImageInheritance;
  summary: BackfillSummary;
  log: (line: string) => void;
  /** `spendAllowed(opts)` — false means measurement-only, Prism is never called. */
  paid: boolean;
  /** COST_QWEN_IMAGE_PER_IMAGE, injected so the orchestration stays testable without env. */
  usdPerImage: number;
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
  if (!ctx.paid) log('  measurement-only: Prism will NOT be called (need --confirm-spend, and neither --dry-run nor --reuse-only)');

  const byLesson = new Map<string, BackfillDocRow[]>();
  for (const row of rows) {
    const group = byLesson.get(row.lessonId);
    if (group) group.push(row);
    else byLesson.set(row.lessonId, [row]);
  }

  /*
   * CIRCUIT BREAKER. On 2026-08-15 a paid repair walked lesson after lesson
   * while EVERY image request failed — the DashScope account was in arrears,
   * so nothing could ever be drawn. Each lesson still got cleared, written and
   * (before the coverage fix above) stamped, so a systemic outage was quietly
   * converting a catalog into a worse one. When a paid pass asks for images and
   * gets none, several lessons in a row, the cause is never that lesson: it is
   * quota, credentials, arrears or an outage. Stop and say so.
   */
  let consecutiveBarrenLessons = 0;

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

    /*
     * A DRY RUN OF THIS MODE MUST NOT SPEND (near-miss 2026-08-15).
     *
     * `--dry-run` historically meant "no Vault writes" and still ran the full
     * paid illustration pass, which is defensible for the ADD-only backfill:
     * you are previewing art that does not exist yet. It is indefensible here.
     * A restyle clears every stale scene first, so "preview" would have meant
     * re-drawing the entire catalog's scenes at full price purely to print a
     * count — an operator typing `--dry-run` to find out what a repair costs
     * would have paid for the repair. Caught before it billed anything.
     *
     * Nothing is lost by refusing: the number a dry run exists to produce is
     * `scenesCleared`, which is known BEFORE any Prism call. So the illustrate
     * pass runs in reuse-only mode, which contacts Prism never.
     */
    const result = await deps.illustrate(cleared.document, {
      inherit: inheritFor(payer),
      reuseOnly: !ctx.paid,
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
    summary.usdSpent = Number((summary.imagesGenerated * ctx.usdPerImage).toFixed(4));

    const freshScenes = collectSceneImages(result.document);
    /*
     * Write the payer even when nothing new was drawn. On a --reuse-only or
     * quota-exhausted pass its scenes were cleared and not refilled, and
     * persisting that is CORRECT: an empty anchor renders as no image, which
     * is honest, while the stale one is an actively misleading picture. The
     * stamp is only advanced when the document really is complete, so an
     * emptied lesson stays visible to the release check as missing coverage.
     *
     * "Complete" is the SHARED coverage definition, not a scene head-count.
     * Comparing `freshScenes.size === cleared.cleared` looked equivalent and
     * was not: a lesson that had NO stored scene art cleared zero and redrew
     * zero, so 0 === 0 stamped it CURRENT while its anchors were still
     * missing. Two published lessons were stamped that way on 2026-08-15
     * before the arrears outage was diagnosed (reverted by hand). Asking
     * inspectIllustrationCoverage instead means the stamp asserts exactly what
     * verify:course will later check.
     */
    const payerComplete = inspectIllustrationCoverage(result.document).missing.length === 0;
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

    /*
     * Check AFTER the writes, never before: this lesson's three documents are
     * already consistent and stamped, so stopping here leaves the catalog in a
     * valid partial state that a later run resumes from. Breaking mid-lesson
     * could leave siblings pointing at art the payer no longer has.
     */
    if (ctx.paid) {
      const wantedImages = cleared.cleared > 0 || inspectIllustrationCoverage(result.document).missing.length > 0;
      consecutiveBarrenLessons = wantedImages && result.generated === 0 ? consecutiveBarrenLessons + 1 : 0;
      if (consecutiveBarrenLessons >= MAX_BARREN_LESSONS) {
        throw new Error(
          `images:backfill — ${MAX_BARREN_LESSONS} lessons in a row needed illustrations and Prism produced none. ` +
            'That is a systemic failure (quota, credentials, account arrears or a provider outage), not a content problem. ' +
            'Stopping so the pass cannot keep clearing art it is unable to replace — check the picturegen logs for the ' +
            "provider's own error message, fix the cause, then re-run to resume.",
        );
      }
    }

    if (ctx.paid && opts.maxUsd && summary.usdSpent >= opts.maxUsd) {
      summary.stoppedOnBudget = true;
      log(`  ! --max-usd ${opts.maxUsd} reached at $${summary.usdSpent} — stopping cleanly; re-run to resume where this left off`);
      break;
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

/*
 * EVERY `in.(…)` list must be batched, not just the last one.
 *
 * A real course puts 300+ topic ids on one query string, past Kong's
 * request-line limit — the same HTTP 414 that verifyCourse.ts hit on
 * 2026-08-10 and fixed there with `qChunked`. This script only batched the
 * final lesson_documents fetch, so `/lessons?topic_id=in.(…300 uuids…)` blew
 * up the moment it was first pointed at the real financial-education catalog
 * (reproduced live 2026-08-15). One helper now covers all of them: the URL is
 * bounded by construction rather than by whichever step someone remembered.
 */
export const ID_BATCH_SIZE = 150; // 150 uuids × 37 chars ≈ 5.5KB — comfortably under an 8KB request line
/*
 * Documents are fetched in SMALLER batches than bare ids. The binding limit
 * there is the RESPONSE, not the request line: each row carries a full lesson
 * document, so 100 lessons already means ~300 documents in one payload.
 */
const DOCUMENT_BATCH_SIZE = 100;

export async function selectByIds<T>(
  pathForBatch: (ids: string[]) => string,
  ids: string[],
  select: (path: string) => Promise<T[]> = (path) => vaultSelect<T>(path),
): Promise<T[]> {
  const out: T[] = [];
  for (const batch of chunk(ids, ID_BATCH_SIZE)) {
    out.push(...(await select(pathForBatch(batch))));
  }
  return out;
}

/**
 * Resolve a course slug to every lesson_document of its published-or-review
 * lessons, walking the hierarchy by id in the same step-by-step `in.(…)` style
 * as backend/src/services/supabaseRest.ts (embedded PostgREST joins are awkward
 * and brittle here). Every hop is batched so the GET URL never grows unbounded
 * on a big course.
 */
async function listCourseDocuments(courseSlug: string, adventureSlug?: string): Promise<BackfillDocRow[]> {
  const courses = await vaultSelect<IdRow>(`/courses?slug=eq.${encodeURIComponent(courseSlug)}&select=id`);
  const course = courses[0];
  if (!course) throw new Error(`images:backfill — course "${courseSlug}" not found in Vault`);

  const adventures = await vaultSelect<IdRow>(
    `/adventures?course_id=eq.${encodeURIComponent(course.id)}&select=id` +
      (adventureSlug ? `&slug=eq.${encodeURIComponent(adventureSlug)}` : ''),
  );
  const adventureIds = adventures.map((a) => a.id);
  if (adventureIds.length === 0) {
    if (adventureSlug) throw new Error(`images:backfill — adventure "${adventureSlug}" not found in course "${courseSlug}"`);
    return [];
  }

  const sagas = await selectByIds<IdRow>((ids) => `/sagas?adventure_id=${inFilter(ids)}&select=id`, adventureIds);
  const sagaIds = sagas.map((s) => s.id);
  if (sagaIds.length === 0) return [];

  const topics = await selectByIds<IdRow>((ids) => `/topics?saga_id=${inFilter(ids)}&select=id`, sagaIds);
  const topicIds = topics.map((t) => t.id);
  if (topicIds.length === 0) return [];

  const lessons = await selectByIds<LessonRow>(
    (ids) => `/lessons?topic_id=${inFilter(ids)}&status=in.(published,review)&select=id,slug`,
    topicIds,
  );
  if (lessons.length === 0) return [];
  const slugById = new Map(lessons.map((l) => [l.id, l.slug]));
  const lessonIds = lessons.map((l) => l.id);

  const rows: BackfillDocRow[] = [];
  for (const batch of chunk(lessonIds, DOCUMENT_BATCH_SIZE)) {
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
  confirmSpend?: boolean;
  maxUsd?: number;
  adventure?: string;
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
      case '--adventure':
        opts.adventure = argv[++i];
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
      case '--confirm-spend':
        opts.confirmSpend = true;
        break;
      case '--max-usd':
        opts.maxUsd = Number(argv[++i]);
        if (!Number.isFinite(opts.maxUsd) || opts.maxUsd <= 0) {
          console.error('images:backfill — --max-usd needs a positive number of dollars');
          process.exit(1);
        }
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
      'Usage: npm run images:backfill -- --course <slug> [--adventure <slug>] [--locale <es-MX|en-US|pt-BR>]\n' +
        '                                    [--restyle-scenes [--confirm-spend --max-usd <n>]] [--reuse-only] [--dry-run]',
    );
    process.exit(1);
  }
  const courseSlug = opts.course;
  const dryRun = opts.dryRun ?? false;

  console.log(
    `images:backfill — course "${courseSlug}"${opts.adventure ? ` / adventure "${opts.adventure}"` : ''}${opts.locale ? ` [${opts.locale} only]` : ''}` +
      `${opts.restyleScenes ? ' (RESTYLE SCENES — stale scene art is cleared and redrawn)' : ''}` +
      `${opts.restyleScenes && !opts.confirmSpend ? ' [MEASUREMENT ONLY — add --confirm-spend to actually redraw]' : ''}` +
      `${opts.reuseOnly ? ' (reuse-only — no Prism calls)' : ''}${dryRun ? ' (dry-run — no Vault writes)' : ''}`,
  );

  // Probe only when Prism is actually configured (same gate as pipeline/run.ts):
  // an unconfigured Prism means zero paid calls, and the pass already
  // short-circuits cleanly on the first not-configured illustrate result.
  const config = getConfig();
  const prismConfigured = Boolean(config.PICTUREGEN_URL && config.PICTUREGEN_INTERNAL_KEY);

  const summary = await backfillImages(
    {
      listDocuments: (slug) => listCourseDocuments(slug, opts.adventure),
      illustrate: (document, options) => illustrateSegments(document, options),
      writeDocument: patchLessonDocument,
      probeStyleVersion: prismConfigured ? fetchPrismStyleVersion : undefined,
      log: (line) => console.log(line),
    },
    {
      courseSlug,
      adventureSlug: opts.adventure,
      locale: opts.locale,
      dryRun,
      reuseOnly: opts.reuseOnly,
      restyleScenes: opts.restyleScenes,
      confirmSpend: opts.confirmSpend,
      maxUsd: opts.maxUsd,
    },
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
    console.log(`  USD spent:                 $${summary.usdSpent.toFixed(2)}${opts.maxUsd ? ` of $${opts.maxUsd.toFixed(2)}` : ''}`);
    if (summary.stoppedOnBudget) {
      console.log('  STOPPED ON BUDGET — repaired lessons are complete and stamped; re-run to resume the rest');
    }
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
