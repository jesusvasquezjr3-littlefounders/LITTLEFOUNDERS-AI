import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLessonDocument } from '../db/lessonDocumentsRepo.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getLessonDocument', () => {
  it('distinguishes an empty successful result from a missing row', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));

    await expect(getLessonDocument('missing', 'en-US')).resolves.toBeNull();
  });

  it('propagates a Vault failure instead of collapsing it into null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"down"}', { status: 503 })));

    await expect(getLessonDocument('lesson-1', 'en-US')).rejects.toThrow('Vault query failed (HTTP 503)');
  });
});
