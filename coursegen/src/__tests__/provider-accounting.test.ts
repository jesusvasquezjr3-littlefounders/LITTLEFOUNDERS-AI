import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetConfigCache } from '../env.js';
import { completeDeepSeek } from '../providers/deepseek.js';
import { ProviderCompletionExhaustedError } from '../providers/errors.js';
import { completeQwen } from '../providers/qwen.js';
import { UsageLedger } from '../providers/usage.js';

const originalEnv = {
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
  QWEN_API_KEY: process.env.QWEN_API_KEY,
  QWEN_BASE_URL: process.env.QWEN_BASE_URL,
  FORGE_CHAT_TIMEOUT_MS: process.env.FORGE_CHAT_TIMEOUT_MS,
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
