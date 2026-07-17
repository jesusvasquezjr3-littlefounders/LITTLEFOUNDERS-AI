import { downloadWav, synthesizeSpeech } from '../tts/dashscopeClient.js';
import { getConfig, defaultVoiceFor, languageTypeFor, type LessonLocale } from '../env.js';
import { uploadFile } from '../filebase/client.js';
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
}

const defaultDeps: NarrateSegmentDeps = { synthesizeSpeech, downloadWav, uploadFile };

/** Ad-hoc utility: narrate one arbitrary piece of text, no lesson/manifest persistence. */
export async function narrateSegment(
  text: string,
  locale: LessonLocale,
  voice: string | undefined,
  overrides: Partial<NarrateSegmentDeps> = {},
): Promise<NarrateSegmentResult> {
  const deps = { ...defaultDeps, ...overrides };
  const config = getConfig();
  const resolvedVoice = voice ?? defaultVoiceFor(locale, config);

  const audioUrl = await deps.synthesizeSpeech(
    { text: stripMarkdown(text), voice: resolvedVoice, languageType: languageTypeFor(locale) },
    { apiUrl: config.TTS_API_URL, apiKey: config.TTS_API_KEY, model: config.TTS_MODEL },
  );
  const wavBuffer = await deps.downloadWav(audioUrl);
  const decoded = parseWav(wavBuffer);
  const mp3 = encodeMp3(decoded, config.AUDIOGEN_MP3_BITRATE_KBPS);

  const upload = await deps.uploadFile(mp3, `adhoc-${Date.now()}.mp3`, 'audio/mpeg', 'lesson-audio', 'public', {
    filebaseUrl: config.FILEBASE_URL,
    internalKey: config.FILEBASE_INTERNAL_KEY,
  });

  return { file_id: upload.id, url: upload.url };
}
