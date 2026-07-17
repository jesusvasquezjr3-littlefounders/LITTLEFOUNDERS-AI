import { describe, expect, it, vi } from 'vitest';
import { narrateLesson } from '../service/lessonAudio.js';
import { contentHash } from '../narrate/types.js';
import { resetConfigCache } from '../env.js';
import type { LessonDocument } from '../types/lessonDocument.js';
import type { LessonDocumentRow, AudioUnitEntry } from '../db/lessonDocumentsRepo.js';

const VOICE = 'Jennifer'; // TTS_VOICE_EN_US default
const MODEL = 'qwen3-tts-flash'; // TTS_MODEL default

function tinyWav(): ArrayBuffer {
  const sampleRate = 8000;
  const samples = new Int16Array(160); // 20ms
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.round(Math.sin(i / 5) * 5000);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) view.setInt16(44 + i * 2, samples[i] ?? 0, true);
  return buffer;
}

function fixtureDocument(promptText = 'Listen up', lineText = 'Hello there'): LessonDocument {
  return {
    schema_version: 1,
    meta: { slug: 'demo', title: 'Demo', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
    scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
    segments: [
      {
        id: 's1',
        type: 'story_dialogue',
        prompt_md: promptText,
        difficulty: 1,
        xp: 0,
        payload: { lines: [{ character: 'dina', text_md: lineText }] },
      },
      {
        id: 's2',
        type: 'quiz_mcq',
        prompt_md: 'Pick one',
        explanation_md: 'Nice work',
        difficulty: 2,
        xp: 10,
        payload: { options: [{ id: 'a', text_md: 'A' }] },
      },
    ],
  };
}

function makeDeps(row: LessonDocumentRow) {
  const getLessonDocument = vi.fn().mockResolvedValue(row);
  const patchLessonDocumentAudio = vi.fn().mockResolvedValue(true);
  const synthesizeSpeech = vi.fn().mockResolvedValue('https://tts.example/audio.wav');
  const downloadWav = vi.fn().mockResolvedValue(tinyWav());
  const uploadFile = vi.fn().mockResolvedValue({
    id: 'lesson-audio/generated.mp3',
    url: 'https://filebase.example/files/lesson-audio/generated.mp3',
    bytes: 321,
    mime: 'audio/mpeg',
    deduplicated: false,
  });
  return { getLessonDocument, patchLessonDocumentAudio, synthesizeSpeech, downloadWav, uploadFile };
}

describe('narrateLesson', () => {
  it('returns null when no lesson_documents row matches', async () => {
    const deps = makeDeps(null as unknown as LessonDocumentRow);
    deps.getLessonDocument.mockResolvedValue(null);
    const result = await narrateLesson('missing', 'en-US', deps);
    expect(result).toBeNull();
    expect(deps.patchLessonDocumentAudio).not.toHaveBeenCalled();
  });

  it('reuses unchanged units and generates the rest, then PATCHes manifest + audio_segment_id stamps', async () => {
    const document = fixtureDocument();
    const priorEntry: AudioUnitEntry = {
      file_id: 'lesson-audio/existing.mp3',
      url: 'https://filebase.example/files/lesson-audio/existing.mp3',
      hash: contentHash('Listen up', VOICE, MODEL),
      bytes: 111,
      duration_ms: 500,
      voice: VOICE,
    };
    const row: LessonDocumentRow = {
      lesson_id: 'lesson-1',
      locale: 'en-US',
      document,
      audio: { version: 1, voice_profile: VOICE, units: { 's1.prompt': priorEntry } },
    };
    const deps = makeDeps(row);

    const summary = await narrateLesson('lesson-1', 'en-US', deps);

    expect(summary).toEqual({ units_total: 4, generated: 3, reused: 1, failed: [] });
    expect(deps.synthesizeSpeech).toHaveBeenCalledTimes(3); // everything except s1.prompt
    expect(deps.patchLessonDocumentAudio).toHaveBeenCalledTimes(1);

    const [patchedLessonId, patchedLocale, patchedDocument, manifest] = deps.patchLessonDocumentAudio.mock.calls[0] as [
      string,
      string,
      LessonDocument,
      { version: 1; voice_profile: string; units: Record<string, AudioUnitEntry> },
    ];
    expect(patchedLessonId).toBe('lesson-1');
    expect(patchedLocale).toBe('en-US');
    expect(manifest.version).toBe(1);
    expect(manifest.voice_profile).toBe(VOICE);
    expect(manifest.units['s1.prompt']).toEqual(priorEntry); // reused, byte-identical
    expect(manifest.units['s1.line.0']?.file_id).toBe('lesson-audio/generated.mp3');
    expect(manifest.units['s2.prompt']?.file_id).toBe('lesson-audio/generated.mp3');
    expect(manifest.units['s2.explanation']?.file_id).toBe('lesson-audio/generated.mp3');

    // audio_segment_id stamped from the PROMPT unit only, on both segments.
    expect(patchedDocument.segments[0]?.audio_segment_id).toBe('s1.prompt');
    expect(patchedDocument.segments[1]?.audio_segment_id).toBe('s2.prompt');
  });

  it('is idempotent: a second run with unchanged text reuses everything', async () => {
    const document = fixtureDocument();
    const hash = (text: string) => contentHash(text, VOICE, MODEL);
    const fullManifestUnits: Record<string, AudioUnitEntry> = {
      's1.prompt': { file_id: 'a', url: 'https://x/a.mp3', hash: hash('Listen up'), bytes: 1, duration_ms: 1, voice: VOICE },
      's1.line.0': { file_id: 'b', url: 'https://x/b.mp3', hash: hash('Hello there'), bytes: 1, duration_ms: 1, voice: VOICE },
      's2.prompt': { file_id: 'c', url: 'https://x/c.mp3', hash: hash('Pick one'), bytes: 1, duration_ms: 1, voice: VOICE },
      's2.explanation': { file_id: 'd', url: 'https://x/d.mp3', hash: hash('Nice work'), bytes: 1, duration_ms: 1, voice: VOICE },
    };
    const row: LessonDocumentRow = {
      lesson_id: 'lesson-1',
      locale: 'en-US',
      document,
      audio: { version: 1, voice_profile: VOICE, units: fullManifestUnits },
    };
    const deps = makeDeps(row);

    const summary = await narrateLesson('lesson-1', 'en-US', deps);

    expect(summary).toEqual({ units_total: 4, generated: 0, reused: 4, failed: [] });
    expect(deps.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it('regenerates only the unit whose text changed', async () => {
    const document = fixtureDocument('Listen up', 'CHANGED LINE');
    const hash = (text: string) => contentHash(text, VOICE, MODEL);
    const row: LessonDocumentRow = {
      lesson_id: 'lesson-1',
      locale: 'en-US',
      document,
      audio: {
        version: 1,
        voice_profile: VOICE,
        units: {
          's1.prompt': { file_id: 'a', url: 'https://x/a.mp3', hash: hash('Listen up'), bytes: 1, duration_ms: 1, voice: VOICE },
          's1.line.0': { file_id: 'b', url: 'https://x/b.mp3', hash: hash('Hello there'), bytes: 1, duration_ms: 1, voice: VOICE }, // stale
          's2.prompt': { file_id: 'c', url: 'https://x/c.mp3', hash: hash('Pick one'), bytes: 1, duration_ms: 1, voice: VOICE },
          's2.explanation': { file_id: 'd', url: 'https://x/d.mp3', hash: hash('Nice work'), bytes: 1, duration_ms: 1, voice: VOICE },
        },
      },
    };
    const deps = makeDeps(row);

    const summary = await narrateLesson('lesson-1', 'en-US', deps);

    expect(summary).toEqual({ units_total: 4, generated: 1, reused: 3, failed: [] });
    expect(deps.synthesizeSpeech).toHaveBeenCalledTimes(1);
  });

  it('contains a per-unit failure: reports it, doesn\'t abort the others', async () => {
    const document = fixtureDocument();
    const row: LessonDocumentRow = {
      lesson_id: 'lesson-1',
      locale: 'en-US',
      document,
      audio: null,
    };
    const deps = makeDeps(row);
    deps.synthesizeSpeech.mockImplementation(async (input: { text: string }) => {
      if (input.text === 'Hello there') throw new Error('provider exploded');
      return 'https://tts.example/audio.wav';
    });

    const summary = await narrateLesson('lesson-1', 'en-US', deps);

    expect(summary?.generated).toBe(3);
    expect(summary?.failed).toEqual([{ unit_id: 's1.line.0', reason: 'provider exploded' }]);
    expect(deps.patchLessonDocumentAudio).toHaveBeenCalledTimes(1);
    const manifest = deps.patchLessonDocumentAudio.mock.calls[0]?.[3] as { units: Record<string, unknown> };
    expect(manifest.units['s1.line.0']).toBeUndefined(); // no prior entry to fall back to
  });

  it('resolves voice PER UNIT by narrator character — a two-speaker dialogue uses two voices', async () => {
    process.env.TTS_VOICE_DINA_EN_US = 'VoiceDina';
    process.env.TTS_VOICE_LIRUF_EN_US = 'VoiceLiruf';
    resetConfigCache();
    try {
      const document: LessonDocument = {
        schema_version: 1,
        meta: { slug: 'demo', title: 'Demo', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina', 'liruf'] },
        scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
        segments: [
          {
            id: 's1',
            type: 'story_dialogue',
            prompt_md: 'A conversation',
            difficulty: 1,
            xp: 0,
            payload: {
              lines: [
                { character: 'dina', text_md: 'Hola!' },
                { character: 'liruf', text_md: 'Hey!' },
              ],
            },
          },
        ],
      };
      const row: LessonDocumentRow = { lesson_id: 'lesson-1', locale: 'en-US', document, audio: null };
      const deps = makeDeps(row);

      await narrateLesson('lesson-1', 'en-US', deps);

      const manifest = deps.patchLessonDocumentAudio.mock.calls[0]?.[3] as { units: Record<string, AudioUnitEntry> };
      expect(manifest.units['s1.line.0']?.voice).toBe('VoiceDina');
      expect(manifest.units['s1.line.1']?.voice).toBe('VoiceLiruf');
    } finally {
      delete process.env.TTS_VOICE_DINA_EN_US;
      delete process.env.TTS_VOICE_LIRUF_EN_US;
      resetConfigCache();
    }
  });
});
