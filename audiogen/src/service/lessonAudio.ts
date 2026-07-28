import { downloadWav, synthesizeSpeech } from '../tts/dashscopeClient.js';
import { getConfig, defaultVoiceFor, voiceFor, languageTypeFor, type LessonLocale } from '../env.js';
import { uploadFile } from '../filebase/client.js';
import {
  getLessonDocument,
  patchLessonDocumentAudio,
  type AudioUnitEntry,
  type LessonAudioManifest,
} from '../db/lessonDocumentsRepo.js';
import { extractNarratables } from '../narrate/extractNarratables.js';
import { auditSpeechText, describeIssues, isBlocked } from '../narrate/speechGuard.js';
import { findSpeechAsset, insertSpeechAsset, speechAssetHash } from '../db/speechAssetsRepo.js';
import { contentHash } from '../narrate/types.js';
import { encodeMp3 } from '../tts/mp3.js';
import { parseWav } from '../tts/wav.js';
import { runPool } from '../concurrency/pool.js';
import type { LessonDocument } from '../types/lessonDocument.js';

export interface NarrateLessonFailure {
  unit_id: string;
  reason: string;
}

export interface NarrateLessonSummary {
  units_total: number;
  generated: number;
  reused: number;
  /** Served from the GLOBAL speech_assets cache — zero paid TTS calls. */
  cached: number;
  failed: NarrateLessonFailure[];
}

/** Injectable seams for tests — defaults are the real network/DB/codec calls. */
export interface NarrateLessonDeps {
  getLessonDocument: typeof getLessonDocument;
  patchLessonDocumentAudio: typeof patchLessonDocumentAudio;
  synthesizeSpeech: typeof synthesizeSpeech;
  downloadWav: typeof downloadWav;
  uploadFile: typeof uploadFile;
  findSpeechAsset: typeof findSpeechAsset;
  insertSpeechAsset: typeof insertSpeechAsset;
}

const defaultDeps: NarrateLessonDeps = {
  getLessonDocument,
  patchLessonDocumentAudio,
  synthesizeSpeech,
  downloadWav,
  uploadFile,
  findSpeechAsset,
  insertSpeechAsset,
};

/*
 * narrateLesson — LESSON_ENGINE.md §12 / COURSE_ENGINE.md §7. Reads the
 * CLIENT-SAFE document (never answer keys, per the repo's select clause),
 * narrates every unit missing from the manifest OR whose content hash
 * changed, uploads each to filebase (bucket lesson-audio, public), then
 * PATCHes both `audio` (the manifest) and `document` (audio_segment_id
 * stamps) in one write. Idempotent by (lesson, locale, segment, text-hash).
 * Per-unit failures are contained — a failed unit doesn't abort the run;
 * it's reported and the lesson is left "partial" (missing that unit).
 */
export async function narrateLesson(
  lessonId: string,
  locale: LessonLocale,
  overrides: Partial<NarrateLessonDeps> = {},
): Promise<NarrateLessonSummary | null> {
  const deps = { ...defaultDeps, ...overrides };
  const config = getConfig();

  const row = await deps.getLessonDocument(lessonId, locale);
  if (!row) return null;

  const units = extractNarratables(row.document);
  const languageType = languageTypeFor(locale);
  const existing = row.audio?.units ?? {};

  const failed: NarrateLessonFailure[] = [];
  let generated = 0;
  let reused = 0;
  let cached = 0;
  const finalUnits: Record<string, AudioUnitEntry> = {};

  await runPool(units, config.AUDIOGEN_CONCURRENCY, async (unit) => {
    // Voice AND model = the segment's narrator character (COURSE_ENGINE.md
    // §7), resolved per unit so a lesson can mix narrators; falls back to
    // the locale default + TTS_MODEL when unnarrated or the character has
    // no override yet. A character override always pairs with the clone
    // model — DashScope binds a voice to the exact model it was enrolled under.
    const { voice, model } = voiceFor(unit.character, locale, config);
    const hash = contentHash(unit.text, voice, model);
    const prior = existing[unit.unit_id];

    if (prior && prior.hash === hash) {
      finalUnits[unit.unit_id] = prior;
      reused += 1;
      return;
    }

    // REGULATOR (speechGuard): normalizeForSpeech has already expanded everything
    // it knows how to say; if anything unspeakable survived — a slash
    // abbreviation read letter by letter, a bare "1" before a noun, a residual
    // "$"/"%" — that is a normalization bug, and synthesizing it would burn money
    // to produce audio we already know a child cannot follow. Refuse the call and
    // surface it as a failure so the batch summary makes it impossible to miss.
    const issues = auditSpeechText(unit.text, locale);
    if (isBlocked(issues)) {
      failed.push({ unit_id: unit.unit_id, reason: `unspeakable text refused before TTS — ${describeIssues(issues)}` });
      if (prior) finalUnits[unit.unit_id] = prior;
      return;
    }
    if (issues.length > 0) {
      console.warn(`[audiogen] speech warning lesson=${lessonId} unit=${unit.unit_id} ${describeIssues(issues)}`);
    }

    // GLOBAL cache (speech_assets, 0015) — the same sentence synthesized for
    // ANY lesson/locale/course before is a free hit. Runs after the guard on
    // purpose: unspeakable text is refused even if a pre-guard run cached it.
    // The lookup is best-effort — a Vault hiccup degrades to a paid call,
    // never to a failed unit.
    const globalHash = speechAssetHash(unit.text, voice, model, languageType, config.AUDIOGEN_MP3_BITRATE_KBPS);
    const hit = await deps.findSpeechAsset(globalHash).catch(() => null);
    if (hit) {
      finalUnits[unit.unit_id] = {
        file_id: hit.file_id,
        url: hit.url,
        hash,
        bytes: hit.bytes ?? 0,
        duration_ms: hit.duration_ms,
        voice,
      };
      cached += 1;
      return;
    }

    try {
      const audioUrl = await deps.synthesizeSpeech(
        { text: unit.text, voice, languageType },
        { apiUrl: config.TTS_API_URL, apiKey: config.TTS_API_KEY, model },
      );
      const decoded = parseWav(await deps.downloadWav(audioUrl));
      const mp3 = encodeMp3(decoded, config.AUDIOGEN_MP3_BITRATE_KBPS);
      const durationMs = decoded.samples.length > 0 ? Math.round((decoded.samples.length / decoded.sampleRate) * 1000) : null;

      const upload = await deps.uploadFile(mp3, `${unit.unit_id}.mp3`, 'audio/mpeg', 'lesson-audio', 'public', {
        filebaseUrl: config.FILEBASE_URL,
        internalKey: config.FILEBASE_INTERNAL_KEY,
      });

      finalUnits[unit.unit_id] = {
        file_id: upload.id,
        url: upload.url,
        hash,
        bytes: upload.bytes,
        duration_ms: durationMs,
        voice,
      };
      generated += 1;

      // Write-through, best-effort: losing a cache row costs a future re-synth,
      // failing the unit here would cost the one we JUST paid for.
      await deps
        .insertSpeechAsset({
          speech_hash: globalHash,
          model,
          voice,
          language_type: languageType,
          text: unit.text,
          url: upload.url,
          file_id: upload.id,
          bytes: upload.bytes,
          duration_ms: durationMs,
          mp3_bitrate_kbps: config.AUDIOGEN_MP3_BITRATE_KBPS,
        })
        .catch((err: unknown) => {
          console.warn(`[audiogen] speech_assets write-through failed unit=${unit.unit_id}: ${err instanceof Error ? err.message : err}`);
        });
    } catch (err) {
      failed.push({ unit_id: unit.unit_id, reason: err instanceof Error ? err.message : String(err) });
      // Leave a stale-but-present entry if we had one, so a transient
      // failure doesn't regress a previously-working unit.
      if (prior) finalUnits[unit.unit_id] = prior;
    }
  });

  const patchedDocument = stampAudioSegmentIds(row.document, finalUnits);
  // voice_profile is a lesson-level SUMMARY label (the locale default); the
  // actual voice used per unit — which may differ per narrator character —
  // lives on each AudioUnitEntry.voice.
  //
  // `version` is stamped ONLY on a COMPLETE narration. A partial manifest
  // (failed units) keeps its entries — succeeded units reuse by hash on the
  // retry — but stays UNVERSIONED so the batch selector picks the row up
  // again. Stamping despite failures made partial failures permanent
  // (2026-07-26 fire-and-forget audit).
  const complete = failed.length === 0;
  const manifest: LessonAudioManifest = {
    ...(complete ? { version: 1 as const } : {}),
    voice_profile: defaultVoiceFor(locale, config),
    units: finalUnits,
  };
  const patched = await deps.patchLessonDocumentAudio(row.lesson_id, row.locale, patchedDocument, manifest);
  if (!patched) {
    // The paid clips are safe (speech_assets write-through makes the retry
    // free), but the manifest is NOT in Vault — surface it as a failure so
    // the batch summary and exit code reflect reality, never silence.
    failed.push({ unit_id: '(manifest)', reason: 'lesson_documents audio PATCH failed — row stays pending, retry is free via speech_assets' });
  }

  return { units_total: units.length, generated, reused, cached, failed };
}

function stampAudioSegmentIds(document: LessonDocument, units: Record<string, AudioUnitEntry>): LessonDocument {
  const clone = structuredClone(document);
  for (const segment of clone.segments) {
    const promptUnitId = `${segment.id}.prompt`;
    if (units[promptUnitId]) segment.audio_segment_id = promptUnitId;
  }
  return clone;
}
