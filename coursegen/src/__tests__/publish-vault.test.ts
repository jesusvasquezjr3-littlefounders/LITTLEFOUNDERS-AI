import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { resetConfigCache } from '../env.js';
import { publishLessonSlot, type PublishInput } from '../pipeline/publish.js';
import { buildDocument } from './fixtures.js';

const localized = { 'en-US': 'x', 'es-MX': 'x', 'pt-BR': 'x' };

function samplePublishInput(): PublishInput {
  return {
    course: { slug: 'financial-education', subject: 'money', title: localized, description: localized, position: 0 },
    adventure: {
      slug: 'archipelago-1',
      position: 1,
      theme: 'archipelago',
      ageTier: 'tier1',
      title: localized,
      description: localized,
      narrativeArc: 'x',
    },
    saga: { slug: 'saga-1', position: 1, icon: 'auto_stories', title: localized, description: localized },
    topic: {
      slug: 'topic-1',
      position: 1,
      title: localized,
      conceptMd: 'x',
      learningObjective: localized,
      keyVocabulary: ['moneda'],
      priorKnowledge: 'x',
    },
    lesson: { slug: 'lesson-1', position: 1, difficulty: 1, estimatedMinutes: 5, cast: ['dina'] },
    documents: { 'es-MX': buildDocument() },
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://vault.example.com';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'srv-test-key';
  resetConfigCache();

  fetchMock = vi.fn(async (url: string) => {
    const table = url.split('/rest/v1/')[1]!.split('?')[0]!;
    return new Response(JSON.stringify([{ id: `fake-${table}-id` }]), { status: 201 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  resetConfigCache();
});

describe('publishLessonSlot', () => {
  it('upserts the full hierarchy path in order: courses, adventures, sagas, topics, lessons, lesson_documents', async () => {
    await publishLessonSlot(samplePublishInput());

    const calledTables = fetchMock.mock.calls.map((call) => (call[0] as string).split('/rest/v1/')[1]!.split('?')[0]);
    expect(calledTables).toEqual(['courses', 'adventures', 'sagas', 'topics', 'lessons', 'lesson_documents']);
  });

  it('sends on_conflict query params matching each table\'s unique constraint', async () => {
    await publishLessonSlot(samplePublishInput());
    const urls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(urls[0]).toContain('on_conflict=slug');
    expect(urls[1]).toContain('on_conflict=course_id,slug');
    expect(urls[2]).toContain('on_conflict=adventure_id,slug');
    expect(urls[3]).toContain('on_conflict=saga_id,slug');
    expect(urls[4]).toContain('on_conflict=topic_id,slug');
    expect(urls[5]).toContain('on_conflict=lesson_id,locale');
  });

  it('sends the service-role key in both apikey and Authorization headers', async () => {
    await publishLessonSlot(samplePublishInput());
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe('srv-test-key');
    expect(headers.Authorization).toBe('Bearer srv-test-key');
  });

  it('lessons row is inserted with status "review", never "published"', async () => {
    await publishLessonSlot(samplePublishInput());
    const lessonsCall = fetchMock.mock.calls[4]!;
    const body = JSON.parse((lessonsCall[1] as RequestInit).body as string) as [{ status: string }];
    expect(body[0]!.status).toBe('review');
  });

  it('lesson_documents row has document.segments with no `answer` field, and a separate answer_keys', async () => {
    await publishLessonSlot(samplePublishInput());
    const documentsCall = fetchMock.mock.calls[5]!;
    const body = JSON.parse((documentsCall[1] as RequestInit).body as string) as [
      { document: { segments: Record<string, unknown>[] }; answer_keys: Record<string, unknown> },
    ];
    expect(body[0]!.document.segments.every((s) => !('answer' in s))).toBe(true);
    expect(Object.keys(body[0]!.answer_keys).length).toBeGreaterThan(0);
  });

  it('throws when no documents are provided for the slot', async () => {
    const input = samplePublishInput();
    input.documents = {};
    await expect(publishLessonSlot(input)).rejects.toThrow(/no generated documents/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
