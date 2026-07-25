import { listPendingLessonDocuments } from './db/lessonDocumentsRepo.js';
import { narrateLesson } from './service/lessonAudio.js';

/*
 * Batch narration — OPERATOR-OPT-IN (AUDIOGEN_RUN_ON_START), a paid action
 * per /AGENTS.md BOUNDARIES. Narrates every published lesson_documents row
 * missing an audio manifest. Log-only failures: one lesson's failure never
 * aborts the batch.
 */
export async function runBatchNarration(): Promise<void> {
  const pending = await listPendingLessonDocuments();
  console.log(`[audiogen] batch narration: ${pending.length} lesson_documents pending`);

  for (const row of pending) {
    try {
      const summary = await narrateLesson(row.lesson_id, row.locale);
      console.log(
        `[audiogen] narrated lesson=${row.lesson_id} locale=${row.locale} ` +
          `units=${summary?.units_total ?? 0} generated=${summary?.generated ?? 0} ` +
          `reused=${summary?.reused ?? 0} cached=${summary?.cached ?? 0} failed=${summary?.failed.length ?? 0}`,
      );
    } catch (err) {
      console.error(`[audiogen] batch narration failed for lesson=${row.lesson_id} locale=${row.locale}:`, err);
    }
  }
}
