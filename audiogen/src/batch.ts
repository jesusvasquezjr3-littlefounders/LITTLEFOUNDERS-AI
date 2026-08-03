import { getLessonDocument, listPendingLessonDocuments, type LessonDocumentRow } from './db/lessonDocumentsRepo.js';
import { extractNarratables } from './narrate/extractNarratables.js';
import { auditSpeechText, isBlocked } from './narrate/speechGuard.js';
import { narrateLesson } from './service/lessonAudio.js';
import { getConfig } from './env.js';
import { TtsCallBudget } from './ttsBudget.js';

/*
 * Batch narration — OPERATOR-OPT-IN (AUDIOGEN_RUN_ON_START / narrate:all), a
 * paid action per /AGENTS.md BOUNDARIES. Narrates every published
 * lesson_documents row whose audio manifest is missing OR incomplete
 * (partial manifests are unversioned, so they re-enter this batch and only
 * their missing units are retried — succeeded units reuse by content hash).
 *
 * One lesson's failure never aborts the batch, but failures are NEVER
 * silent: the summary tallies them and callers turn a non-zero tally into a
 * non-zero exit (narrate:all). `courseSlug` scopes the batch to one course.
 * `--dry-run` uses the same pending query and document extractor but never
 * calls TTS, Depot, speech_assets, or a PATCH; it is the audio equivalent of
 * Forge's free catalog dry-run.
 */

export interface BatchNarrationOptions {
  dryRun?: boolean;
  /** Test/operator override; production uses AUDIOGEN_MAX_TTS_CALLS_PER_RUN. */
  maxTtsCalls?: number;
}

export interface BatchNarrationDeps {
  listPendingLessonDocuments: typeof listPendingLessonDocuments;
  getLessonDocument: typeof getLessonDocument;
  narrateLesson: typeof narrateLesson;
}

const DEFAULT_DEPS: BatchNarrationDeps = {
  listPendingLessonDocuments,
  getLessonDocument,
  narrateLesson,
};

export interface BatchNarrationSummary {
  lessonsAttempted: number;
  /** Lessons whose narrateLesson call itself threw. */
  lessonErrors: number;
  /** Individual units that failed (guard-refused, TTS/upload error, manifest PATCH failure). */
  unitFailures: number;
  /** Lessons left UNVERSIONED (pending) because some units failed — a re-run retries them. */
  incompleteLessons: number;
  generated: number;
  reused: number;
  cached: number;
  dryRun: boolean;
  /** Narratable units inspected by the free audio preflight. */
  unitsInspected: number;
  /** Existing manifest entries that may be reusable after a live hash/voice check. */
  manifestEntriesPresent: number;
  /** Upper-bound TTS calls after existing manifest entries and guard blocks. */
  estimatedTtsCalls: number;
  /** Units rejected by the deterministic speech guard; these cost zero. */
  guardBlocked: number;
}

export async function runBatchNarration(
  courseSlug?: string,
  options: BatchNarrationOptions = {},
  deps: BatchNarrationDeps = DEFAULT_DEPS,
): Promise<BatchNarrationSummary> {
  const pending = await deps.listPendingLessonDocuments(courseSlug);
  const dryRun = options.dryRun === true;
  const ttsBudget = dryRun ? undefined : new TtsCallBudget(options.maxTtsCalls ?? getConfig().AUDIOGEN_MAX_TTS_CALLS_PER_RUN);
  console.log(
    `[audiogen] ${dryRun ? 'audio preflight' : 'batch narration'}: ${pending.length} lesson_documents pending${courseSlug ? ` (course ${courseSlug})` : ' (ALL courses)'}`,
  );

  const summary: BatchNarrationSummary = {
    lessonsAttempted: pending.length,
    lessonErrors: 0,
    unitFailures: 0,
    incompleteLessons: 0,
    generated: 0,
    reused: 0,
    cached: 0,
    dryRun,
    unitsInspected: 0,
    manifestEntriesPresent: 0,
    estimatedTtsCalls: 0,
    guardBlocked: 0,
  };

  for (const row of pending) {
    if (dryRun) {
      try {
        const documentRow = await deps.getLessonDocument(row.lesson_id, row.locale);
        if (!documentRow) {
          summary.lessonErrors += 1;
          console.error(`[audiogen] preflight missing lesson=${row.lesson_id} locale=${row.locale}`);
          continue;
        }
        inspectPendingRow(documentRow, summary);
      } catch (err) {
        summary.lessonErrors += 1;
        console.error(`[audiogen] preflight failed for lesson=${row.lesson_id} locale=${row.locale}:`, err);
      }
      continue;
    }
    try {
      const result = await deps.narrateLesson(row.lesson_id, row.locale, {}, { ttsBudget });
      const failedCount = result?.failed.length ?? 0;
      summary.unitFailures += failedCount;
      if (failedCount > 0) summary.incompleteLessons += 1;
      summary.generated += result?.generated ?? 0;
      summary.reused += result?.reused ?? 0;
      summary.cached += result?.cached ?? 0;
      console.log(
        `[audiogen] narrated lesson=${row.lesson_id} locale=${row.locale} ` +
          `units=${result?.units_total ?? 0} generated=${result?.generated ?? 0} ` +
          `reused=${result?.reused ?? 0} cached=${result?.cached ?? 0} failed=${failedCount}`,
      );
      for (const f of result?.failed ?? []) {
        console.warn(`[audiogen]   failed unit=${f.unit_id}: ${f.reason}`);
      }
    } catch (err) {
      summary.lessonErrors += 1;
      console.error(`[audiogen] batch narration failed for lesson=${row.lesson_id} locale=${row.locale}:`, err);
    }
  }

  if (dryRun) {
    console.log(
      `[audiogen] preflight summary: ${summary.lessonsAttempted} pending lesson(s), ` +
        `${summary.unitsInspected} units inspected, ${summary.manifestEntriesPresent} manifest entries potentially reusable, ` +
        `${summary.estimatedTtsCalls} estimated TTS call(s), ${summary.guardBlocked} guard-blocked unit(s), ` +
        `${summary.lessonErrors} lesson error(s) — zero paid calls and zero writes`,
    );
  } else {
    console.log(
      `[audiogen] batch summary: ${summary.lessonsAttempted} attempted, ` +
        `${summary.generated} generated, ${summary.reused} reused, ${summary.cached} cache hits, ` +
        `${summary.unitFailures} unit failure(s), ${summary.incompleteLessons} lesson(s) left pending, ` +
        `${summary.lessonErrors} lesson error(s)`,
    );
  }
  if (summary.incompleteLessons > 0) {
    console.warn('[audiogen] incomplete lessons stay in the pending set — re-run narrate:all to retry only their missing units.');
  }
  return summary;
}

function inspectPendingRow(row: LessonDocumentRow, summary: BatchNarrationSummary): void {
  const units = extractNarratables(row.document);
  const manifestUnits = row.audio?.units ?? {};
  let manifestEntries = 0;
  let guardBlocked = 0;

  for (const unit of units) {
    if (manifestUnits[unit.unit_id]) {
      manifestEntries++;
      continue;
    }
    if (isBlocked(auditSpeechText(unit.text, row.locale))) guardBlocked++;
  }

  summary.unitsInspected += units.length;
  summary.manifestEntriesPresent += manifestEntries;
  summary.guardBlocked += guardBlocked;
  summary.estimatedTtsCalls += units.length - manifestEntries - guardBlocked;
  console.log(
    `[audiogen] preflight lesson=${row.lesson_id} locale=${row.locale} ` +
      `units=${units.length} manifest_entries=${manifestEntries} ` +
      `guard_blocked=${guardBlocked} estimated_tts=${units.length - manifestEntries - guardBlocked}`,
  );
}
