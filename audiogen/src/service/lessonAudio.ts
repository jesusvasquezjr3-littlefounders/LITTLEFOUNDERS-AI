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
  failed: NarrateLessonFailure[];
}

/** Injectable seams for tests — defaults are the real network/DB/codec calls. */
export interface NarrateLessonDeps {
  getLessonDocument: typeof getLessonDocument;
  patchLessonDocumentAudio: typeof patchLessonDocumentAudio;
  synthesizeSpeech: typeof synthesizeSpeech;
  downloadWav: typeof downloadWav;
  uploadFile: typeof uploadFile;
}

const defaultDeps: NarrateLessonDeps = {
  getLessonDocument,
  patchLessonDocumentAudio,
  synthesizeSpeech,
  downloadWav,
  uploadFile,
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
  const manifest: LessonAudioManifest = { version: 1, voice_profile: defaultVoiceFor(locale, config), units: finalUnits };
  await deps.patchLessonDocumentAudio(row.lesson_id, row.locale, patchedDocument, manifest);

  return { units_total: units.length, generated, reused, failed };
}

function stampAudioSegmentIds(document: LessonDocument, units: Record<string, AudioUnitEntry>): LessonDocument {
  const clone = structuredClone(document);
  for (const segment of clone.segments) {
    const promptUnitId = `${segment.id}.prompt`;
    if (units[promptUnitId]) segment.audio_segment_id = promptUnitId;
  }
  return clone;
}
