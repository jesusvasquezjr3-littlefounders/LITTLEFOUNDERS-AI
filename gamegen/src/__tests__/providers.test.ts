// Regression pins for the two MONEY-CRITICAL provider behaviors:
//   1. the UsageLedger's budget arithmetic (the run kill switch), and
//   2. openaiChat's finish_reason==='length' throw (the silent-blank-output bug).
// Both were paid for by real Forge runs; see the comments in the modules.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resetConfigCache } from '../env.js';
import { BudgetExceededError, UsageLedger, estimateCostUsd } from '../providers/usage.js';
import { openAiCompatibleComplete } from '../providers/openaiChat.js';
import {
  ProviderHttpError,
  ProviderNetworkError,
  isFatalProviderError,
  isRetryableError,
  parseRetryAfter,
} from '../providers/errors.js';
import { withTransportRetry } from '../providers/retry.js';

const BUDGET_ENV = [
  'ARCADE_MAX_TOKENS_PER_RUN',
  'ARCADE_MAX_USD_PER_RUN',
  'COST_DEEPSEEK_INPUT_PER_1K',
] as const;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'arcade-ledger-'));
  for (const key of BUDGET_ENV) delete process.env[key];
  resetConfigCache();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  for (const key of BUDGET_ENV) delete process.env[key];
  resetConfigCache();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. Ledger budget arithmetic
// ---------------------------------------------------------------------------

describe('UsageLedger', () => {
  it('accumulates tokens and appends exactly one JSONL line per provider call', async () => {
    const ledger = new UsageLedger(dir);
    await ledger.record({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      operation: 'author',
      promptTokens: 100,
      completionTokens: 50,
    });
    await ledger.record({
      provider: 'qwen',
      model: 'qwen3-max',
      operation: 'judge',
      promptTokens: 200,
      completionTokens: 100,
    });

    expect(ledger.tokens).toBe(450);

    const lines = readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!) as { provider: string; prompt_tokens: number; est_usd: number };
    expect(first.provider).toBe('deepseek');
    expect(first.prompt_tokens).toBe(100);
    expect(first.est_usd).toBeGreaterThan(0);
  });

  it('cached prompt tokens are a SUBSET of the token total, never added on top', async () => {
    const ledger = new UsageLedger(dir);
    await ledger.record({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      operation: 'author',
      promptTokens: 1000,
      completionTokens: 200,
      cachedPromptTokens: 900,
    });
    // 1000 + 200 — the 900 cached tokens must NOT inflate the kill-switch counter.
    expect(ledger.tokens).toBe(1200);
    expect(ledger.cachedTokens).toBe(900);
  });

  it('records a provider-overreported cache count clamped to promptTokens', async () => {
    const ledger = new UsageLedger(dir);
    await ledger.record({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      operation: 'author',
      promptTokens: 100,
      completionTokens: 0,
      cachedPromptTokens: 500,
    });
    expect(ledger.cachedTokens).toBe(100);
    const line = JSON.parse(readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8').trim()) as {
      cached_prompt_tokens: number;
    };
    expect(line.cached_prompt_tokens).toBe(100);
  });

  it('checkBudget throws BudgetExceededError once ARCADE_MAX_TOKENS_PER_RUN is reached', async () => {
    process.env.ARCADE_MAX_TOKENS_PER_RUN = '100';
    resetConfigCache();
    const ledger = new UsageLedger(dir);
    expect(() => ledger.checkBudget()).not.toThrow();
    await ledger.record({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      operation: 'plan',
      promptTokens: 80,
      completionTokens: 30,
    });
    expect(() => ledger.checkBudget()).toThrow(BudgetExceededError);
  });

  it('checkBudget throws on the USD cap independently of the token cap', async () => {
    process.env.ARCADE_MAX_USD_PER_RUN = '0.001';
    resetConfigCache();
    const ledger = new UsageLedger(dir);
    await ledger.record({
      provider: 'qwen',
      model: 'qwen3-max',
      operation: 'judge',
      promptTokens: 10_000,
      completionTokens: 10_000,
    });
    expect(ledger.tokens).toBeLessThan(5_000_000); // token cap NOT the trigger
    expect(() => ledger.checkBudget()).toThrow(/usd/);
  });

  it('checkBudget passes when well under budget', () => {
    expect(() => new UsageLedger(dir).checkBudget()).not.toThrow();
  });

  it('hydrate replays the ledger file so caps are per-RUN, not per-invocation', async () => {
    const first = new UsageLedger(dir);
    await first.record({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      operation: 'author',
      promptTokens: 1000,
      completionTokens: 500,
      cachedPromptTokens: 400,
    });
    await first.record({
      provider: 'picturegen',
      model: 'qwen-image',
      operation: 'illustrate',
      promptTokens: 0,
      completionTokens: 0,
      images: 3,
    });

    // A fresh process resuming the same run must NOT start from zero.
    const resumed = new UsageLedger(dir);
    await resumed.hydrate();
    expect(resumed.tokens).toBe(1500);
    expect(resumed.images).toBe(3);
    expect(resumed.cachedTokens).toBe(400);
    expect(resumed.usd).toBeCloseTo(first.usd, 6);
  });

  it('hydrate tolerates a truncated final line rather than refusing to resume', async () => {
    const complete = JSON.stringify({ prompt_tokens: 100, completion_tokens: 100, est_usd: 0.5, images: 0 });
    // Killed mid-append: the last line is half-written JSON.
    writeFileSync(path.join(dir, 'ledger.jsonl'), `${complete}\n{"prompt_tokens":50,"comple`, 'utf8');
    const ledger = new UsageLedger(dir);
    await expect(ledger.hydrate()).resolves.toBeUndefined();
    expect(ledger.tokens).toBe(200);
    expect(ledger.usd).toBeCloseTo(0.5, 10);
  });

  it('hydrate on a missing ledger file is a clean no-op (fresh run)', async () => {
    const ledger = new UsageLedger(path.join(dir, 'does-not-exist'));
    await expect(ledger.hydrate()).resolves.toBeUndefined();
    expect(ledger.tokens).toBe(0);
    expect(ledger.usd).toBe(0);
  });

  it('hydrate limits override the config caps (work-scaled per-run budget)', async () => {
    const ledger = new UsageLedger(dir);
    await ledger.hydrate({ maxTokens: 100, maxUsd: 1000 });
    await ledger.record({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      operation: 'author',
      promptTokens: 60,
      completionTokens: 60,
    });
    // 120 >= 100 even though the config default is 5,000,000.
    expect(() => ledger.checkBudget()).toThrow(BudgetExceededError);
  });
});

describe('estimateCostUsd', () => {
  it('is positive and proportional to token counts', () => {
    const one = estimateCostUsd({ provider: 'deepseek', promptTokens: 1000, completionTokens: 1000 });
    const two = estimateCostUsd({ provider: 'deepseek', promptTokens: 2000, completionTokens: 2000 });
    expect(one).toBeGreaterThan(0);
    expect(two).toBeCloseTo(one * 2, 10);
  });

  it('prices cached prompt tokens at the CACHED rate, SUBTRACTED from the full-rate pool', () => {
    const fresh = estimateCostUsd({ provider: 'deepseek', promptTokens: 100_000, completionTokens: 0 });
    const allCached = estimateCostUsd({
      provider: 'deepseek',
      promptTokens: 100_000,
      completionTokens: 0,
      cachedPromptTokens: 100_000,
    });
    const halfCached = estimateCostUsd({
      provider: 'deepseek',
      promptTokens: 100_000,
      completionTokens: 0,
      cachedPromptTokens: 50_000,
    });
    // v4-pro bills a hit at ~1/120 of a miss — a hit must never cost MORE (the
    // double-charge bug this subtraction exists to prevent).
    expect(allCached).toBeLessThan(fresh / 50);
    expect(halfCached).toBeCloseTo((fresh + allCached) / 2, 12);
  });

  it('clamps cached > prompt so a provider bug can never yield a negative cost', () => {
    const clamped = estimateCostUsd({
      provider: 'deepseek',
      promptTokens: 1000,
      completionTokens: 0,
      cachedPromptTokens: 5000,
    });
    expect(clamped).toBeGreaterThanOrEqual(0);
    expect(clamped).toBe(
      estimateCostUsd({ provider: 'deepseek', promptTokens: 1000, completionTokens: 0, cachedPromptTokens: 1000 }),
    );
  });

  it('picturegen cost depends only on the image count, never on token counts', () => {
    const a = estimateCostUsd({ provider: 'picturegen', promptTokens: 0, completionTokens: 0, images: 2 });
    const b = estimateCostUsd({ provider: 'picturegen', promptTokens: 999, completionTokens: 999, images: 2 });
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
    // A Prism cache hit reports images: 0 and must therefore be free.
    expect(estimateCostUsd({ provider: 'picturegen', promptTokens: 0, completionTokens: 0, images: 0 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. openaiChat — the empty-content / finish_reason 'length' throw
// ---------------------------------------------------------------------------

const CFG = {
  providerName: 'deepseek',
  baseUrl: 'https://example.invalid/v1',
  apiKey: 'test-key-not-a-real-credential',
  model: 'deepseek-v4-pro',
  timeoutMs: 5_000,
};

const REQ = { messages: [{ role: 'user' as const, content: 'hi' }], temperature: 0.7 };

function stubJsonResponse(body: unknown, init?: ResponseInit): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
        ...init,
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('openAiCompatibleComplete — reasoning-budget starvation', () => {
  it('THROWS when content is empty and finish_reason is "length", naming the reasoning tokens', async () => {
    stubJsonResponse({
      choices: [{ message: { content: '' }, finish_reason: 'length' }],
      usage: { prompt_tokens: 900, completion_tokens: 477, completion_tokens_details: { reasoning_tokens: 477 } },
    });

    await expect(openAiCompatibleComplete(CFG, { ...REQ, maxTokens: 60 })).rejects.toThrow(
      /returned NO content.*finish_reason=length, 477 reasoning tokens.*raise maxTokens/s,
    );
  });

  it('does not retry the starvation throw — it is a budget bug, not a transport blip', async () => {
    const fetchMock = stubJsonResponse({
      choices: [{ message: { content: '   ' }, finish_reason: 'length' }],
      usage: { prompt_tokens: 10, completion_tokens: 60 },
    });
    // Whitespace-only counts as empty; withTransportRetry must see a plain
    // (non-retryable) Error and rethrow on the first attempt.
    await expect(openAiCompatibleComplete(CFG, REQ)).rejects.toThrow(/returned NO content/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT throw when finish_reason is "length" but content was actually emitted (truncation)', async () => {
    stubJsonResponse({
      choices: [{ message: { content: '{"partial": tr' }, finish_reason: 'length' }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });
    const res = await openAiCompatibleComplete(CFG, REQ);
    expect(res.content).toBe('{"partial": tr');
  });

  it('does NOT throw on an empty content with a normal finish_reason', async () => {
    stubJsonResponse({
      choices: [{ message: { content: '' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 0 },
    });
    const res = await openAiCompatibleComplete(CFG, REQ);
    expect(res.content).toBe('');
  });

  it('POSTs exactly one request to <baseUrl>/chat/completions', async () => {
    const fetchMock = stubJsonResponse({
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    });
    await openAiCompatibleComplete(CFG, { ...REQ, jsonMode: true, maxTokens: 4096 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.invalid/v1/chat/completions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body)) as {
      model: string;
      max_tokens: number;
      response_format: { type: string };
    };
    expect(body.model).toBe('deepseek-v4-pro');
    expect(body.max_tokens).toBe(4096);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});

describe('openAiCompatibleComplete — cached-prompt-token capture', () => {
  it('reads DeepSeek prompt_cache_hit_tokens', async () => {
    stubJsonResponse({
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1000, completion_tokens: 10, prompt_cache_hit_tokens: 768 },
    });
    const res = await openAiCompatibleComplete(CFG, REQ);
    expect(res.cachedPromptTokens).toBe(768);
  });

  it('reads the DashScope prompt_tokens_details.cached_tokens shape', async () => {
    stubJsonResponse({
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1000, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 512 } },
    });
    const res = await openAiCompatibleComplete(CFG, REQ);
    expect(res.cachedPromptTokens).toBe(512);
  });

  it('clamps cached tokens to promptTokens (the pricing subtraction relies on it)', async () => {
    stubJsonResponse({
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 10, prompt_cache_hit_tokens: 9999 },
    });
    const res = await openAiCompatibleComplete(CFG, REQ);
    expect(res.cachedPromptTokens).toBe(100);
  });

  it('defaults to 0 when the provider reports no cache field', async () => {
    stubJsonResponse({
      choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 10 },
    });
    const res = await openAiCompatibleComplete(CFG, REQ);
    expect(res.cachedPromptTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Transport classification + the two retry ladders
// ---------------------------------------------------------------------------

describe('provider error classification', () => {
  it('429 and 5xx are retryable; other 4xx are not', () => {
    expect(new ProviderHttpError('t', 429, '').retryable).toBe(true);
    expect(new ProviderHttpError('t', 500, '').retryable).toBe(true);
    expect(new ProviderHttpError('t', 503, '').retryable).toBe(true);
    expect(new ProviderHttpError('t', 400, '').retryable).toBe(false);
    expect(new ProviderHttpError('t', 404, '').retryable).toBe(false);
    expect(new ProviderNetworkError('t', new Error('boom')).retryable).toBe(true);
    expect(isRetryableError(new Error('plain'))).toBe(false);
  });

  it('401/402/403 are FATAL — a dead credential aborts the run, it is not a slot problem', () => {
    expect(isFatalProviderError(new ProviderHttpError('t', 401, ''))).toBe(true);
    expect(isFatalProviderError(new ProviderHttpError('t', 402, 'Insufficient Balance'))).toBe(true);
    expect(isFatalProviderError(new ProviderHttpError('t', 403, ''))).toBe(true);
    expect(isFatalProviderError(new ProviderHttpError('t', 429, ''))).toBe(false);
    expect(isFatalProviderError(new ProviderHttpError('t', 500, ''))).toBe(false);
    expect(isFatalProviderError(new Error('plain'))).toBe(false);
  });

  it('parseRetryAfter handles seconds and HTTP dates', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('not-a-date')).toBeUndefined();
    const future = new Date(Date.now() + 60_000).toUTCString();
    expect(parseRetryAfter(future)).toBeGreaterThan(0);
  });
});

describe('withTransportRetry — two ladders', () => {
  const noSleep = (): Promise<void> => Promise.resolve();

  it('a 429 gets MORE attempts than a 5xx over the same options', async () => {
    const rateLimited = vi.fn().mockRejectedValue(new ProviderHttpError('t', 429, 'slow down'));
    await expect(
      withTransportRetry(rateLimited, { maxAttempts: 2, rateLimitMaxAttempts: 5, sleep: noSleep, random: () => 0.5 }),
    ).rejects.toThrow();
    expect(rateLimited).toHaveBeenCalledTimes(5);

    const serverError = vi.fn().mockRejectedValue(new ProviderHttpError('t', 500, 'boom'));
    await expect(
      withTransportRetry(serverError, { maxAttempts: 2, rateLimitMaxAttempts: 5, sleep: noSleep, random: () => 0.5 }),
    ).rejects.toThrow();
    expect(serverError).toHaveBeenCalledTimes(2);
  });

  it('a non-retryable 400 throws on the first attempt', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderHttpError('t', 400, 'bad'));
    await expect(withTransportRetry(fn, { sleep: noSleep, random: () => 0.5 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a provider Retry-After wins over our backoff guess, capped', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ProviderHttpError('t', 429, 'x', 30_000))
      .mockRejectedValueOnce(new ProviderHttpError('t', 429, 'x', 999_999))
      .mockResolvedValueOnce('ok');
    await expect(withTransportRetry(fn, { sleep, random: () => 0, retryAfterCapMs: 120_000 })).resolves.toBe('ok');
    expect(sleep.mock.calls[0]![0]).toBe(30_000);
    expect(sleep.mock.calls[1]![0]).toBe(120_000); // hostile value clamped
  });

  it('jittered exponential backoff is bounded by baseMs/maxMs', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new ProviderHttpError('t', 500, 'x'))
      .mockRejectedValueOnce(new ProviderHttpError('t', 500, 'x'))
      .mockResolvedValueOnce('ok');
    await withTransportRetry(fn, { maxAttempts: 4, baseMs: 500, maxMs: 8000, sleep, random: () => 0 });
    expect(sleep).toHaveBeenCalledTimes(2);
    // random()=0 → jitter factor 0.5: attempt1 backoff 500 → 250; attempt2 1000 → 500.
    expect(sleep.mock.calls[0]![0]).toBeCloseTo(250, 5);
    expect(sleep.mock.calls[1]![0]).toBeCloseTo(500, 5);
  });
});
