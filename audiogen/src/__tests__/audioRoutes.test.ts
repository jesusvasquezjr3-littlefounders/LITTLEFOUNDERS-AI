import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import type { LessonDocument } from '../types/lessonDocument.js';
import type { LessonDocumentRow } from '../db/lessonDocumentsRepo.js';

const KEY = 'test-internal-key-0123456789'; // matches test-setup.ts INTERNAL_API_KEY

function tinyWav(): ArrayBuffer {
  const samples = new Int16Array(80);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.round(Math.sin(i / 4) * 4000);
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
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) view.setInt16(44 + i * 2, samples[i] ?? 0, true);
  return buffer;
}

const document: LessonDocument = {
  schema_version: 1,
  meta: { slug: 'demo', title: 'Demo', locale: 'en-US', subject: 'money', estimated_minutes: 5, objectives: ['x'], cast: ['dina'] },
  scoring: { pass_threshold: 70, hint_penalty_pct: 10, max_attempts: 2, hearts: null },
  segments: [{ id: 's1', type: 'story_scene', prompt_md: 'Hi', difficulty: 1, xp: 0, payload: { backdrop: 'band', body_md: 'Body' } }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('internal auth', () => {
  it('rejects requests with no x-internal-api-key', async () => {
    const res = await request(createApp()).post('/internal/v1/audio/lesson').send({ lesson_id: 'x', locale: 'en-US' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: { code: 'UNAUTHORIZED', message: expect.any(String) } });
  });

  it('rejects requests with the wrong key', async () => {
    const res = await request(createApp())
      .post('/internal/v1/audio/lesson')
      .set('x-internal-api-key', 'wrong')
      .send({ lesson_id: 'x', locale: 'en-US' });
    expect(res.status).toBe(401);
  });
});

describe('POST /internal/v1/audio/lesson', () => {
  it('narrates a lesson and returns the summary envelope', async () => {
    const row: LessonDocumentRow = { lesson_id: 'lesson-1', locale: 'en-US', document, audio: null };
    const app = createApp({
      audio: {
        narrateLesson: {
          getLessonDocument: vi.fn().mockResolvedValue(row),
          patchLessonDocumentAudio: vi.fn().mockResolvedValue(true),
          synthesizeSpeech: vi.fn().mockResolvedValue('https://tts.example/a.wav'),
          downloadWav: vi.fn().mockResolvedValue(tinyWav()),
          uploadFile: vi.fn().mockResolvedValue({
            id: 'lesson-audio/x.mp3',
            url: 'https://filebase.example/files/lesson-audio/x.mp3',
            bytes: 10,
            mime: 'audio/mpeg',
            deduplicated: false,
          }),
        },
      },
    });

    const res = await request(app)
      .post('/internal/v1/audio/lesson')
      .set('x-internal-api-key', KEY)
      .send({ lesson_id: 'lesson-1', locale: 'en-US' });

    expect(res.status).toBe(200);
    // fixture has 1 story_scene segment: prompt_md + body_md = 2 narratable units
    expect(res.body).toEqual({ data: { units_total: 2, generated: 2, reused: 0, cached: 0, failed: [] }, error: null });
  });

  it('returns 404 envelope when no lesson_documents row matches', async () => {
    const app = createApp({ audio: { narrateLesson: { getLessonDocument: vi.fn().mockResolvedValue(null) } } });
    const res = await request(app)
      .post('/internal/v1/audio/lesson')
      .set('x-internal-api-key', KEY)
      .send({ lesson_id: 'nope', locale: 'en-US' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR envelope for a bad body', async () => {
    const res = await request(createApp())
      .post('/internal/v1/audio/lesson')
      .set('x-internal-api-key', KEY)
      .send({ lesson_id: '', locale: 'xx-XX' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 502 when the service layer throws', async () => {
    const row: LessonDocumentRow = { lesson_id: 'lesson-1', locale: 'en-US', document, audio: null };
    const app = createApp({
      audio: {
        narrateLesson: {
          getLessonDocument: vi.fn().mockResolvedValue(row),
          patchLessonDocumentAudio: vi.fn().mockRejectedValue(new Error('db unreachable')),
          synthesizeSpeech: vi.fn().mockResolvedValue('https://tts.example/a.wav'),
          downloadWav: vi.fn().mockResolvedValue(tinyWav()),
          uploadFile: vi.fn().mockResolvedValue({ id: 'x', url: 'https://x', bytes: 1, mime: 'audio/mpeg', deduplicated: false }),
        },
      },
    });
    const res = await request(app)
      .post('/internal/v1/audio/lesson')
      .set('x-internal-api-key', KEY)
      .send({ lesson_id: 'lesson-1', locale: 'en-US' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AUDIO_GENERATION_FAILED');
  });
});

describe('POST /internal/v1/audio/segment', () => {
  it('narrates ad-hoc text and returns {file_id, url}', async () => {
    const app = createApp({
      audio: {
        narrateSegment: {
          synthesizeSpeech: vi.fn().mockResolvedValue('https://tts.example/a.wav'),
          downloadWav: vi.fn().mockResolvedValue(tinyWav()),
          uploadFile: vi.fn().mockResolvedValue({
            id: 'lesson-audio/adhoc.mp3',
            url: 'https://filebase.example/files/lesson-audio/adhoc.mp3',
            bytes: 5,
            mime: 'audio/mpeg',
            deduplicated: false,
          }),
          findSpeechAsset: vi.fn().mockResolvedValue(null),
          insertSpeechAsset: vi.fn().mockImplementation(async (r: Record<string, unknown>) => ({ id: 'x', created_at: 'now', ...r })),
        },
      },
    });

    const res = await request(app)
      .post('/internal/v1/audio/segment')
      .set('x-internal-api-key', KEY)
      .send({ text: '**Hi** there', locale: 'en-US' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { file_id: 'lesson-audio/adhoc.mp3', url: 'https://filebase.example/files/lesson-audio/adhoc.mp3' },
      error: null,
    });
  });
});

describe('GET /internal/v1/audio/lesson/:id', () => {
  it('returns the current manifest from lesson_documents', async () => {
    const manifest = { version: 1, voice_profile: 'Jennifer', units: {} };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ lesson_id: 'lesson-1', locale: 'en-US', document, audio: manifest }]), {
          status: 200,
        }),
      ),
    );

    const res = await request(createApp())
      .get('/internal/v1/audio/lesson/lesson-1')
      .query({ locale: 'en-US' })
      .set('x-internal-api-key', KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: manifest, error: null });
  });

  it('returns 404 when the row is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })));
    const res = await request(createApp())
      .get('/internal/v1/audio/lesson/missing')
      .query({ locale: 'en-US' })
      .set('x-internal-api-key', KEY);
    expect(res.status).toBe(404);
  });
});
