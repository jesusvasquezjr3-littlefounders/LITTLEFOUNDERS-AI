import { downloadWav, synthesizeSpeech } from '../tts/dashscopeClient.js';
import { getConfig, defaultVoiceFor, languageTypeFor, type LessonLocale } from '../env.js';
import { uploadFile } from '../filebase/client.js';
import { findSpeechAsset, insertSpeechAsset, speechAssetHash } from '../db/speechAssetsRepo.js';
import { encodeMp3 } from '../tts/mp3.js';
import { parseWav } from '../tts/wav.js';
import { stripMarkdown } from '../narrate/stripMarkdown.js';

export interface NarrateSegmentResult {
  file_id: string;
  url: string;
}

export interface NarrateSegmentDeps {
  synthesizeSpeech: typeof synthesizeSpeech;
  downloadWav: typeof downloadWav;
  uploadFile: typeof uploadFile;
  findSpeechAsset: typeof findSpeechAsset;
  insertSpeechAsset: typeof insertSpeechAsset;
}

const defaultDeps: NarrateSegmentDeps = { synthesizeSpeech, downloadWav, uploadFile, findSpeechAsset, insertSpeechAsset };

/**
 * Ad-hoc utility: narrate one arbitrary piece of text, no lesson/manifest
 * persistence. Before speech_assets (0015) this path paid DashScope on EVERY
 * call — Depot deduplicated the bytes, but the synthesis was already spent.
 * Now the global cache covers it like any lesson unit.
 */
export async function narrateSegment(
  text: string,
  locale: LessonLocale,
  voice: string | undefined,
  overrides: Partial<NarrateSegmentDeps> = {},
): Promise<NarrateSegmentResult> {
  const deps = { ...defaultDeps, ...overrides };
  const config = getConfig();
  const resolvedVoice = voice ?? defaultVoiceFor(locale, config);
  const languageType = languageTypeFor(locale);
  const spoken = stripMarkdown(text);

  // Hash exactly what would be sent to the provider (the stripped text).
  const globalHash = speechAssetHash(spoken, resolvedVoice, config.TTS_MODEL, languageType, config.AUDIOGEN_MP3_BITRATE_KBPS);
  const hit = await deps.findSpeechAsset(globalHash).catch(() => null);
  if (hit) return { file_id: hit.file_id, url: hit.url };

  const audioUrl = await deps.synthesizeSpeech(
    { text: spoken, voice: resolvedVoice, languageType },
    { apiUrl: config.TTS_API_URL, apiKey: config.TTS_API_KEY, model: config.TTS_MODEL },
  );
  const wavBuffer = await deps.downloadWav(audioUrl);
  const decoded = parseWav(wavBuffer);
  const mp3 = encodeMp3(decoded, config.AUDIOGEN_MP3_BITRATE_KBPS);

  const upload = await deps.uploadFile(mp3, `adhoc-${Date.now()}.mp3`, 'audio/mpeg', 'lesson-audio', 'public', {
    filebaseUrl: config.FILEBASE_URL,
    internalKey: config.FILEBASE_INTERNAL_KEY,
  });

  await deps
    .insertSpeechAsset({
      speech_hash: globalHash,
      model: config.TTS_MODEL,
      voice: resolvedVoice,
      language_type: languageType,
      text: spoken,
      url: upload.url,
      file_id: upload.id,
      bytes: upload.bytes,
      duration_ms: decoded.samples.length > 0 ? Math.round((decoded.samples.length / decoded.sampleRate) * 1000) : null,
      mp3_bitrate_kbps: config.AUDIOGEN_MP3_BITRATE_KBPS,
    })
    .catch((err: unknown) => {
      console.warn(`[audiogen] speech_assets write-through failed (adhoc): ${err instanceof Error ? err.message : err}`);
    });

  return { file_id: upload.id, url: upload.url };
}
