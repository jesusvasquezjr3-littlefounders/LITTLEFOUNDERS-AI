import { getLessonDocument, listPendingLessonDocuments, type LessonDocumentRow } from './db/lessonDocumentsRepo.js';
import { extractNarratables } from './narrate/extractNarratables.js';
import { auditSpeechText, isBlocked } from './narrate/speechGuard.js';
import { contentHash } from './narrate/types.js';
import { narrateLesson } from './service/lessonAudio.js';
import { getConfig, voiceFor } from './env.js';
import { spendCeilingRefusal } from './spendGuard.js';
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
 * non-zero exit (narrate:all). The one deliberate stop: an exhausted TTS call
 * budget ends the run — remaining rows are skipped untouched and tallied in
 * `budgetSkippedLessons`. `courseSlug` scopes the batch to one course.
 * `--dry-run` uses the same pending query and document extractor but never
 * calls TTS, Depot, speech_assets, or a PATCH; it is the audio equivalent of
 * Forge's free catalog dry-run.
 *
 * OD-28 (owner review D-03): a paid batch refuses to start without the
 * owner-approved USD ceiling (`maxUsd`, `--max-usd <n>` on narrate:all,
 * AUDIOGEN_RUN_ON_START_MAX_USD for the start-up batch) and a configured
 * per-character price (AUDIOGEN_USD_PER_1K_CHARS) to enforce it with. The
 * refusal happens before the pending query, so a refused run touches nothing.
 */

export interface BatchNarrationOptions {
  dryRun?: boolean;
  /** Test/operator override; production uses AUDIOGEN_MAX_TTS_CALLS_PER_RUN. */
  maxTtsCalls?: number;
  /** OD-28: the owner-approved USD ceiling. Required unless dryRun. */
  maxUsd?: number;
  /** Test/operator override; production uses AUDIOGEN_USD_PER_1K_CHARS. */
  usdPer1kChars?: number;
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
  /** Manifest entries whose hash still matches the current text/voice/model — the live run reuses them for free. */
  manifestEntriesPresent: number;
  /**
   * Upper-bound TTS calls: inspected units minus hash-matching manifest
   * entries and guard blocks. Stale-hash entries (edited document, changed
   * voice map) count as PAID — the live run re-synthesizes them. Only global
   * speech_assets cache hits can bring actual spend below this number.
   */
  estimatedTtsCalls: number;
  /** Units rejected by the deterministic speech guard; these cost zero. */
  guardBlocked: number;
  /** Pending rows never touched (no Vault read, no manifest PATCH) because the TTS call budget ran out first. */
  budgetSkippedLessons: number;
  /** Dry-run: input characters of the estimated TTS calls (what the per-character price applies to). */
  estimatedTtsChars: number;
  /** Paid run: USD reserved against the owner ceiling (reservations are consumed even when the provider then fails). */
  usdReserved: number;
}

/** The refusal for a paid batch that cannot enforce an owner-approved USD ceiling, or null. */
export function narrationSpendRefusal(options: BatchNarrationOptions, configuredUsdPer1kChars: number | undefined): string | null {
  if (options.dryRun === true) return null;
  const refusal = spendCeilingRefusal({ command: 'narrate:all', flag: '--max-usd', dryRun: false, ceilingUsd: options.maxUsd });
  if (refusal) return refusal;
  const price = options.usdPer1kChars ?? configuredUsdPer1kChars;
  if (price === undefined || !Number.isFinite(price) || price <= 0) {
    return (
      'narrate:all: the USD ceiling cannot be enforced without the TTS price. Set AUDIOGEN_USD_PER_1K_CHARS ' +
      "(the provider's current price per 1,000 input characters) in audiogen/.env, or add --dry-run."
    );
  }
  return null;
}

export async function runBatchNarration(
  courseSlug?: string,
  options: BatchNarrationOptions = {},
  deps: BatchNarrationDeps = DEFAULT_DEPS,
): Promise<BatchNarrationSummary> {
  const dryRun = options.dryRun === true;
  // OD-28 (D-03): refuse before the pending query, so a refused run touches nothing.
  const configuredPrice = dryRun || options.usdPer1kChars !== undefined ? undefined : getConfig().AUDIOGEN_USD_PER_1K_CHARS;
  const refusal = narrationSpendRefusal(options, configuredPrice);
  if (refusal) throw new Error(refusal);
  const ttsBudget = dryRun
    ? undefined
    : new TtsCallBudget(options.maxTtsCalls ?? getConfig().AUDIOGEN_MAX_TTS_CALLS_PER_RUN, {
        maxUsd: options.maxUsd as number,
        usdPer1kChars: (options.usdPer1kChars ?? configuredPrice) as number,
      });
  const pending = await deps.listPendingLessonDocuments(courseSlug);
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
    budgetSkippedLessons: 0,
    estimatedTtsChars: 0,
    usdReserved: 0,
  };

  for (const [index, row] of pending.entries()) {
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
    // Budget exhausted → stop the batch entirely instead of grinding through
    // every remaining row (Vault read + manifest PATCH + one noise failure per
    // un-cached unit — thousands of entries against a production set, burying
    // the real failures). Untouched rows stay pending; the skip is tallied
    // once below so it is visible, never silent (§1.12). A row already inside
    // narrateLesson when the budget runs dry keeps the per-unit behavior.
    if (ttsBudget && ttsBudget.exhausted) {
      summary.budgetSkippedLessons = pending.length - index;
      summary.lessonsAttempted -= summary.budgetSkippedLessons;
      console.warn(
        `[audiogen] TTS budget exhausted (call cap or the owner USD ceiling) — leaving ${summary.budgetSkippedLessons} pending lesson(s) untouched (no Vault reads, no manifest writes); re-run narrate:all to continue.`,
      );
      break;
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

  if (ttsBudget) summary.usdReserved = ttsBudget.spentUsd;
  if (dryRun) {
    console.log(
      `[audiogen] preflight summary: ${summary.lessonsAttempted} pending lesson(s), ` +
        `${summary.unitsInspected} units inspected, ${summary.manifestEntriesPresent} reusable manifest entries (hash-checked), ` +
        `${summary.estimatedTtsCalls} estimated TTS call(s) over ${summary.estimatedTtsChars} characters, ${summary.guardBlocked} guard-blocked unit(s), ` +
        `${summary.lessonErrors} lesson error(s) — zero paid calls and zero writes`,
    );
  } else {
    console.log(
      `[audiogen] batch summary: ${summary.lessonsAttempted} attempted, ` +
        `${summary.generated} generated, ${summary.reused} reused, ${summary.cached} cache hits, ` +
        `${summary.unitFailures} unit failure(s), ${summary.incompleteLessons} lesson(s) left pending, ` +
        `${summary.lessonErrors} lesson error(s), ${summary.budgetSkippedLessons} lesson(s) skipped for budget, ` +
        `$${summary.usdReserved.toFixed(2)} reserved of the $${(options.maxUsd ?? 0).toFixed(2)} ceiling`,
    );
  }
  if (summary.incompleteLessons > 0) {
    console.warn('[audiogen] incomplete lessons stay in the pending set — re-run narrate:all to retry only their missing units.');
  }
  return summary;
}

function inspectPendingRow(row: LessonDocumentRow, summary: BatchNarrationSummary): void {
  const config = getConfig();
  const units = extractNarratables(row.document);
  const manifestUnits = row.audio?.units ?? {};
  let reusableEntries = 0;
  let guardBlocked = 0;
  let paidChars = 0;

  for (const unit of units) {
    // Same reuse test as the live path (lessonAudio.ts): a manifest entry is
    // free ONLY while its hash matches contentHash(text, voice, model) under
    // the CURRENT voice map. A stale hash — edited document, re-registered
    // character voice — makes the live run re-synthesize, so it is a paid call
    // here too; merely-present entries used to be credited as free, which made
    // the "upper bound" claim false.
    const { voice, model } = voiceFor(unit.character, row.locale, config);
    const prior = manifestUnits[unit.unit_id];
    if (prior && prior.hash === contentHash(unit.text, voice, model)) {
      reusableEntries++;
      continue;
    }
    if (isBlocked(auditSpeechText(unit.text, row.locale))) guardBlocked++;
    else paidChars += unit.text.length;
  }

  summary.unitsInspected += units.length;
  summary.manifestEntriesPresent += reusableEntries;
  summary.guardBlocked += guardBlocked;
  summary.estimatedTtsCalls += units.length - reusableEntries - guardBlocked;
  summary.estimatedTtsChars += paidChars;
  console.log(
    `[audiogen] preflight lesson=${row.lesson_id} locale=${row.locale} ` +
      `units=${units.length} reusable_manifest_entries=${reusableEntries} ` +
      `guard_blocked=${guardBlocked} estimated_tts=${units.length - reusableEntries - guardBlocked}`,
  );
}
