import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetConfigCache } from '../env.js';
import { completeDeepSeek } from '../providers/deepseek.js';
import { ProviderCompletionExhaustedError } from '../providers/errors.js';
import { requestPicture, billedImagesFromError, PicturegenGenerationError } from '../providers/picturegen.js';
import { completeQwen } from '../providers/qwen.js';
import { UsageLedger } from '../providers/usage.js';
import { illustrateSegments } from '../pipeline/images.js';
import type { LessonDocumentParsed } from '../contract/schema.js';

const originalEnv = {
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
  QWEN_API_KEY: process.env.QWEN_API_KEY,
  QWEN_BASE_URL: process.env.QWEN_BASE_URL,
  FORGE_CHAT_TIMEOUT_MS: process.env.FORGE_CHAT_TIMEOUT_MS,
  PICTUREGEN_URL: process.env.PICTUREGEN_URL,
  PICTUREGEN_INTERNAL_KEY: process.env.PICTUREGEN_INTERNAL_KEY,
};

function restoreEnv(key: keyof typeof originalEnv): void {
  const value = originalEnv[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const key of Object.keys(originalEnv) as (keyof typeof originalEnv)[]) restoreEnv(key);
  resetConfigCache();
  vi.unstubAllGlobals();
});

async function exhaustedLedger(): Promise<{ ledger: UsageLedger; dir: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-provider-accounting-'));
  const ledger = new UsageLedger(dir);
  await ledger.hydrate({ maxTokens: 1_000_000, maxUsd: 100 });
  return { ledger, dir };
}

function response(cachedTokens: number, cacheShape: 'deepseek' | 'qwen'): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: '' }, finish_reason: 'length' }],
      usage: {
        prompt_tokens: 7,
        completion_tokens: 11,
        completion_tokens_details: { reasoning_tokens: 11 },
        ...(cacheShape === 'deepseek'
          ? { prompt_cache_hit_tokens: cachedTokens }
          : { prompt_tokens_details: { cached_tokens: cachedTokens } }),
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('billable exhausted completions', () => {
  it('records DeepSeek usage before rethrowing a starved completion', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.test/v1';
    resetConfigCache();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(3, 'deepseek')));
    const { ledger, dir } = await exhaustedLedger();

    await expect(
      completeDeepSeek({ messages: [{ role: 'user', content: 'Write one lesson.' }], temperature: 0.2, maxTokens: 4096 }, { operation: 'write', ledger }),
    ).rejects.toBeInstanceOf(ProviderCompletionExhaustedError);

    expect(ledger.tokens).toBe(18);
    expect(ledger.cachedTokens).toBe(3);
    const [record] = (await readFile(path.join(dir, 'ledger.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse) as Array<Record<string, unknown>>;
    expect(record).toMatchObject({ provider: 'deepseek', operation: 'write', prompt_tokens: 7, completion_tokens: 11, cached_prompt_tokens: 3 });
  });

  it('records Qwen-compatible cache usage before rethrowing a starved completion', async () => {
    process.env.QWEN_API_KEY = 'test-qwen-key';
    process.env.QWEN_BASE_URL = 'https://qwen.test/v1';
    resetConfigCache();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(2, 'qwen')));
    const { ledger, dir } = await exhaustedLedger();

    await expect(
      completeQwen({ messages: [{ role: 'user', content: 'Judge one lesson.' }], temperature: 0.2, maxTokens: 4096 }, { operation: 'review', ledger }),
    ).rejects.toBeInstanceOf(ProviderCompletionExhaustedError);

    expect(ledger.tokens).toBe(18);
    expect(ledger.cachedTokens).toBe(2);
    const [record] = (await readFile(path.join(dir, 'ledger.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse) as Array<Record<string, unknown>>;
    expect(record).toMatchObject({ provider: 'qwen', operation: 'review', prompt_tokens: 7, completion_tokens: 11, cached_prompt_tokens: 2 });
  });

  it('uses Qwen only after a retryable DeepSeek transport failure', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.test/v1';
    process.env.QWEN_API_KEY = 'test-qwen-key';
    process.env.QWEN_BASE_URL = 'https://qwen.test/v1';
    process.env.FORGE_CHAT_TIMEOUT_MS = '25';
    resetConfigCache();
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('https://deepseek.test/')) return new Promise<Response>(() => undefined);
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    }));
    const { ledger, dir } = await exhaustedLedger();

    const result = await completeDeepSeek(
      { messages: [{ role: 'user', content: 'Write one lesson.' }], temperature: 0.2, maxTokens: 4096 },
      { operation: 'write', ledger },
    );

    expect(result.content).toBe('{"ok":true}');
    const [record] = (await readFile(path.join(dir, 'ledger.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse) as Array<Record<string, unknown>>;
    expect(record).toMatchObject({ provider: 'qwen', operation: 'write:deepseek-fallback' });
  });

  it('uses Qwen when only DeepSeek has exhausted its account balance', async () => {
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
    process.env.DEEPSEEK_BASE_URL = 'https://deepseek.test/v1';
    process.env.QWEN_API_KEY = 'test-qwen-key';
    process.env.QWEN_BASE_URL = 'https://qwen.test/v1';
    resetConfigCache();
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('https://deepseek.test/')) {
        return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Insufficient Balance' } }), {
          status: 402,
          headers: { 'content-type': 'application/json' },
        }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    }));
    const { ledger, dir } = await exhaustedLedger();

    await expect(
      completeDeepSeek(
        { messages: [{ role: 'user', content: 'Write one lesson.' }], temperature: 0.2, maxTokens: 4096 },
        { operation: 'write', ledger },
      ),
    ).resolves.toMatchObject({ content: '{"ok":true}' });

    const [record] = (await readFile(path.join(dir, 'ledger.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse) as Array<Record<string, unknown>>;
    expect(record).toMatchObject({ provider: 'qwen', operation: 'write:deepseek-fallback' });
  });
});

// ---------------------------------------------------------------------------
// Prism (picturegen) — billable image counts must survive transport retries
// and version skew. Prism deliberately 502s IMAGE_TIMEOUT / IMAGE_RATE_LIMITED
// / IMAGE_PROVIDER_ERROR / IMAGE_DOWNLOAD_FAILED, and those responses CAN
// carry already-billed generations; withTransportRetry discards the error
// object of every non-final attempt.
// ---------------------------------------------------------------------------

function configurePrismEnv(): void {
  process.env.PICTUREGEN_URL = 'https://prism.test:4007';
  process.env.PICTUREGEN_INTERNAL_KEY = 'test-internal-picture-key';
  resetConfigCache();
}

function prismError(status: number, generatedImages: number): Response {
  return new Response(JSON.stringify({ data: null, error: { code: 'IMAGE_DOWNLOAD_FAILED', message: 'download failed' } }), {
    status,
    headers: { 'content-type': 'application/json', 'x-picturegen-generated-images': String(generatedImages) },
  });
}

function prismSuccess(body: { cached: boolean; generated_images?: number }): Response {
  return new Response(
    JSON.stringify({ data: { url: 'http://localhost:4006/files/lesson-images/x.webp', file_id: 'lesson-images/x.webp', ...body }, error: null }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('picturegen billable counts survive transport retries', () => {
  it('ledgers the images billed on a retried 502 PLUS the final successful attempt (2 + 1 = 3)', async () => {
    configurePrismEnv();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(prismError(502, 2))
      .mockResolvedValueOnce(prismSuccess({ cached: false, generated_images: 1 }))
      .mockResolvedValue(prismSuccess({ cached: true, generated_images: 0 }));
    vi.stubGlobal('fetch', fetchMock);
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-prism-accounting-'));
    const ledger = new UsageLedger(dir);
    await ledger.hydrate({ maxTokens: 1_000_000, maxUsd: 100 });

    const document = {
      segments: [{
        id: 'pc1',
        type: 'picture_choice',
        prompt_md: 'Elige.',
        payload: { options: [{ id: 'o1', label: 'Alcancía' }, { id: 'o2', label: 'Helado' }] },
      }],
    } as unknown as LessonDocumentParsed;

    const result = await illustrateSegments(document, { ledger });

    // Option 1: 502 carrying 2 billed images, then a fresh success carrying 1.
    // Option 2: a free cache hit. The kill switch must see all 3 paid images.
    expect(result.billed).toBe(3);
    expect(ledger.images).toBe(3);
  });

  it('carries the cumulative billed count on a terminal error (retried 502 + terminal 422 = 2)', async () => {
    configurePrismEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(prismError(502, 1)).mockResolvedValueOnce(prismError(422, 1)),
    );

    const err = await requestPicture({ label: 'Alcancía', purpose: 'item_card' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PicturegenGenerationError);
    expect((err as PicturegenGenerationError).status).toBe(422);
    expect((err as PicturegenGenerationError).generatedImages).toBe(2);
  });

  it('carries the billed count on a FOREIGN terminal error (retried billed 502 → raw fetch TimeoutError) without changing its identity', async () => {
    configurePrismEnv();
    // A raw fetch timeout is NOT a Provider* class: withTransportRetry rethrows
    // it immediately, and it is what the caller ultimately catches.
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(prismError(502, 2)).mockRejectedValueOnce(timeout));

    const err = await requestPicture({ label: 'Alcancía', purpose: 'item_card' }).catch((e: unknown) => e);
    // Same object, same class — downstream retry/required classification untouched…
    expect(err).toBe(timeout);
    // …but the 2 images billed on the retried 502 still ride along.
    expect(billedImagesFromError(err)).toBe(2);
  });

  it('ledgers the images billed on a retried 502 even when the chain dies on a non-Prism terminal error (2 → ledger)', async () => {
    configurePrismEnv();
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(prismError(502, 2)).mockRejectedValueOnce(timeout));
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-prism-accounting-'));
    const ledger = new UsageLedger(dir);
    await ledger.hydrate({ maxTokens: 1_000_000, maxUsd: 100 });

    const document = {
      segments: [{
        id: 'pc1',
        type: 'picture_choice',
        prompt_md: 'Elige.',
        payload: { options: [{ id: 'o1', label: 'Alcancía' }] },
      }],
    } as unknown as LessonDocumentParsed;

    const result = await illustrateSegments(document, { ledger });

    // The 502 billed 2 paid images before the retry chain terminated in a raw
    // timeout. Those images must reach the UsageLedger (and therefore the
    // FORGE_MAX_USD kill switch) even though no PicturegenGenerationError was
    // the final error.
    expect(result.billed).toBe(2);
    expect(ledger.images).toBe(2);
  });
});

describe('picturegen version skew: generated_images absent is NOT free', () => {
  it('falls back to the legacy cached?0:1 billing when a pre-upgrade Prism omits generated_images', async () => {
    configurePrismEnv();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(prismSuccess({ cached: false })));
    const fresh = await requestPicture({ label: 'Alcancía', purpose: 'item_card' });
    expect(fresh.generatedImages).toBe(1);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(prismSuccess({ cached: true })));
    const cached = await requestPicture({ label: 'Alcancía', purpose: 'item_card' });
    expect(cached.generatedImages).toBe(0);
  });

  it('trusts an explicit in-range generated_images, including an explicit 0', async () => {
    configurePrismEnv();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(prismSuccess({ cached: false, generated_images: 0 })));
    const result = await requestPicture({ label: 'Alcancía', purpose: 'item_card' });
    expect(result.generatedImages).toBe(0);
  });
});
