import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { resetConfigCache } from '../env.js';
import { publishLessonSlot, type PublishInput } from '../pipeline/publish.js';
import { buildDocument } from './fixtures.js';
import { FORGE_ILLUSTRATION_STYLE_VERSION } from '../pipeline/illustrationStyle.js';

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
      kind: 'teaching',
      reviewOf: [],
      prerequisites: [{ path: 'archipelago-1/saga-0', strength: 'hard', reason: 'needs counting first' }],
      placementProbe: {
        'es-MX': { prompt: '¿Qué es el dinero?', options: ['Sirve para intercambiar', 'Es un juguete'], correctIndex: 0 },
        'en-US': { prompt: 'What is money?', options: ['Used to trade', 'A toy'], correctIndex: 0 },
        'pt-BR': { prompt: 'O que é dinheiro?', options: ['Serve para trocar', 'É um brinquedo'], correctIndex: 0 },
      },
    },
    lesson: { slug: 'lesson-1', position: 1, difficulty: 1, estimatedMinutes: 5, cast: ['dina'] },
    documents: {
      'en-US': { ...buildDocument(), meta: { ...buildDocument().meta, locale: 'en-US' } },
      'es-MX': buildDocument(),
      'pt-BR': { ...buildDocument(), meta: { ...buildDocument().meta, locale: 'pt-BR' } },
    },
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

  it('records the current illustration style so legacy art cannot be inherited silently', async () => {
    await publishLessonSlot(samplePublishInput());
    const documentsCall = fetchMock.mock.calls[5]!;
    const body = JSON.parse((documentsCall[1] as RequestInit).body as string) as [{ illustration_style_version: string }];
    expect(body[0]!.illustration_style_version).toBe(FORGE_ILLUSTRATION_STYLE_VERSION);
  });

  it('forwards prerequisites and placementProbe into the topics upsert body (0042 competency-graph projection)', async () => {
    const input = samplePublishInput();
    await publishLessonSlot(input);
    const topicsCall = fetchMock.mock.calls[3]!;
    const body = JSON.parse((topicsCall[1] as RequestInit).body as string) as [
      { prerequisites: unknown; placement_probe: unknown },
    ];
    expect(body[0]!.prerequisites).toEqual(input.topic.prerequisites);
    expect(body[0]!.placement_probe).toEqual(input.topic.placementProbe);
  });

  it('writes a null placement_probe for a topic that has none yet (never a crash)', async () => {
    const input = samplePublishInput();
    input.topic.placementProbe = null;
    await publishLessonSlot(input);
    const topicsCall = fetchMock.mock.calls[3]!;
    const body = JSON.parse((topicsCall[1] as RequestInit).body as string) as [{ placement_probe: unknown }];
    expect(body[0]!.placement_probe).toBeNull();
  });

  it('throws when the locale bundle is incomplete before any Vault write', async () => {
    const input = samplePublishInput();
    input.documents = { 'es-MX': buildDocument() };
    await expect(publishLessonSlot(input)).rejects.toThrow(/exactly all supported locales/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('identity migration (renamed_from)', () => {
  it('renames the existing row (same UUID) BEFORE upserting when renamed_from is declared', async () => {
    const calls: { method: string; url: string; body?: string }[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body as string | undefined });
      // Existence probe for the NEW slug: not there yet → rename must run.
      if (method === 'GET') return new Response(JSON.stringify([]), { status: 200 });
      if (method === 'PATCH') return new Response(null, { status: 204 });
      const table = url.split('/rest/v1/')[1]!.split('?')[0]!;
      return new Response(JSON.stringify([{ id: `fake-${table}-id` }]), { status: 201 });
    });

    const input = samplePublishInput();
    input.lesson.renamedFrom = 'lesson-old-name';
    await publishLessonSlot(input);

    const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('/lessons?'));
    expect(patch).toBeDefined();
    expect(patch!.url).toContain('slug=eq.lesson-old-name');
    expect(patch!.url).toContain('topic_id=eq.fake-topics-id');
    expect(JSON.parse(patch!.body!)).toEqual({ slug: 'lesson-1' });
    // ...and the rename lands BEFORE the lesson upsert.
    const patchIdx = calls.indexOf(patch!);
    const upsertIdx = calls.findIndex((c) => c.method === 'POST' && c.url.includes('/lessons?'));
    expect(patchIdx).toBeLessThan(upsertIdx);
  });

  it('skips the rename when the NEW slug already exists (idempotent re-run) — never touches two rows', async () => {
    const calls: { method: string; url: string }[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url });
      // New slug ALREADY present → the earlier run renamed it.
      if (method === 'GET') return new Response(JSON.stringify([{ id: 'already-there' }]), { status: 200 });
      const table = url.split('/rest/v1/')[1]!.split('?')[0]!;
      return new Response(JSON.stringify([{ id: `fake-${table}-id` }]), { status: 201 });
    });

    const input = samplePublishInput();
    input.topic.renamedFrom = 'topic-old';
    await publishLessonSlot(input);

    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('never probes or renames without a declaration (zero extra requests on the hot path)', async () => {
    const calls: { method: string }[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET' });
      const table = url.split('/rest/v1/')[1]!.split('?')[0]!;
      return new Response(JSON.stringify([{ id: `fake-${table}-id` }]), { status: 201 });
    });

    await publishLessonSlot(samplePublishInput());
    expect(calls.every((c) => c.method !== 'PATCH' && c.method !== 'GET')).toBe(true);
  });
});
