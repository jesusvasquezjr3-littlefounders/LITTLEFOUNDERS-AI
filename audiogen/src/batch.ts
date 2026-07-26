import { listPendingLessonDocuments } from './db/lessonDocumentsRepo.js';
import { narrateLesson } from './service/lessonAudio.js';

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
 */

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
}

export async function runBatchNarration(courseSlug?: string): Promise<BatchNarrationSummary> {
  const pending = await listPendingLessonDocuments(courseSlug);
  console.log(
    `[audiogen] batch narration: ${pending.length} lesson_documents pending${courseSlug ? ` (course ${courseSlug})` : ' (ALL courses)'}`,
  );

  const summary: BatchNarrationSummary = {
    lessonsAttempted: pending.length,
    lessonErrors: 0,
    unitFailures: 0,
    incompleteLessons: 0,
    generated: 0,
    reused: 0,
    cached: 0,
  };

  for (const row of pending) {
    try {
      const result = await narrateLesson(row.lesson_id, row.locale);
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

  console.log(
    `[audiogen] batch summary: ${summary.lessonsAttempted} attempted, ` +
      `${summary.generated} generated, ${summary.reused} reused, ${summary.cached} cache hits, ` +
      `${summary.unitFailures} unit failure(s), ${summary.incompleteLessons} lesson(s) left pending, ` +
      `${summary.lessonErrors} lesson error(s)`,
  );
  if (summary.incompleteLessons > 0) {
    console.warn('[audiogen] incomplete lessons stay in the pending set — re-run narrate:all to retry only their missing units.');
  }
  return summary;
}
