import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describeParamMismatch, isSlotDone, newRunCheckpoint, setSlotState, type RunParams } from '../pipeline/checkpoint.js';
import { UsageLedger } from '../providers/usage.js';
import { withTransportRetry } from '../providers/retry.js';
import { ProviderHttpError, parseRetryAfter, isFatalProviderError } from '../providers/errors.js';

/*
 * Mass-generation resilience. Every case here is a confirmed finding from the
 * 2026-07-25 audit of what a 1000+ lesson, multi-day, multi-invocation run does
 * that a 62-lesson run never did.
 */

const params = (over: Partial<RunParams> = {}): RunParams => ({
  course: 'first-lemonade-stand',
  locales: ['es-MX', 'en-US', 'pt-BR'],
  noImages: false,
  requireImages: false,
  register: 'kid',
  ...over,
});

describe('checkpoint: a resume must be provably compatible', () => {
  it('accepts identical parameters', () => {
    expect(describeParamMismatch(params(), params())).toBeNull();
  });

  it('ignores locale ORDER (a set, not a sequence)', () => {
    expect(describeParamMismatch(params({ locales: ['pt-BR', 'es-MX', 'en-US'] }), params())).toBeNull();
  });

  it('detects a narrowed locale set — the case that locked 1000 lessons to one locale', () => {
    const msg = describeParamMismatch(params({ locales: ['es-MX'] }), params());
    expect(msg).toContain('locales');
  });

  it('detects --no-images → full, which published a visual-first course with no images', () => {
    expect(describeParamMismatch(params({ noImages: true }), params())).toContain('noImages');
  });

  it('detects a register switch, which never creates the adult course', () => {
    expect(describeParamMismatch(params({ register: 'adult' }), params())).toContain('register');
  });

  it('treats a params-less (legacy) checkpoint as unknown, never as a match', () => {
    expect(describeParamMismatch(undefined, params())).toContain('predates');
  });
});

describe('checkpoint: dry-run is not done', () => {
  it('a dry-run slot is NOT treated as published, so the real run still does the work', () => {
    let cp = newRunCheckpoint('r1', 'c1', params());
    cp = setSlotState(cp, 'a/b/c/d', 'dry-run', { data: { dryRun: true } });
    expect(isSlotDone(cp, 'a/b/c/d')).toBe(false);
  });

  it('a published slot IS done', () => {
    let cp = newRunCheckpoint('r1', 'c1', params());
    cp = setSlotState(cp, 'a/b/c/d', 'published');
    expect(isSlotDone(cp, 'a/b/c/d')).toBe(true);
  });
});

describe('ledger: the per-RUN budget survives the resumes a long run requires', () => {
  it('replays ledger.jsonl so totals are cumulative, not per-process', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-ledger-'));
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'ledger.jsonl'),
      [
        JSON.stringify({ provider: 'deepseek', prompt_tokens: 1000, completion_tokens: 500, est_usd: 0.01 }),
        JSON.stringify({ provider: 'qwen', prompt_tokens: 2000, completion_tokens: 1000, est_usd: 0.02 }),
      ].join('\n') + '\n',
      'utf8',
    );
    const ledger = new UsageLedger(dir);
    expect(ledger.tokens).toBe(0); // before hydration
    await ledger.hydrate();
    expect(ledger.tokens).toBe(4500);
    expect(ledger.usd).toBeCloseTo(0.03, 6);
  });

  it('tolerates a truncated final line (process killed mid-append) instead of refusing to resume', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-ledger-'));
    await writeFile(
      path.join(dir, 'ledger.jsonl'),
      JSON.stringify({ prompt_tokens: 100, completion_tokens: 100, est_usd: 0.005 }) + '\n{"prompt_tokens":50,"comple',
      'utf8',
    );
    const ledger = new UsageLedger(dir);
    await ledger.hydrate();
    expect(ledger.tokens).toBe(200);
  });

  it('starts at zero when there is no ledger yet', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-ledger-'));
    const ledger = new UsageLedger(dir);
    await ledger.hydrate();
    expect(ledger.tokens).toBe(0);
  });

  it('enforces the caps it was handed, so a work-scaled budget actually binds', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-ledger-'));
    await writeFile(path.join(dir, 'ledger.jsonl'), JSON.stringify({ prompt_tokens: 900, completion_tokens: 200, est_usd: 1 }) + '\n', 'utf8');
    const ledger = new UsageLedger(dir);
    await ledger.hydrate({ maxTokens: 1000, maxUsd: 999 });
    expect(() => ledger.checkBudget()).toThrow(/tokens/);
    const roomy = new UsageLedger(dir);
    await roomy.hydrate({ maxTokens: 10_000, maxUsd: 999 });
    expect(() => roomy.checkBudget()).not.toThrow();
  });
});

describe('image spend is metered and capped like every other paid call', () => {
  it('bills only FRESH generations — a Prism cache hit is free', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-img-'));
    const ledger = new UsageLedger(dir);
    await ledger.hydrate({ maxTokens: 1_000_000, maxUsd: 100 });
    await ledger.record({ provider: 'picturegen', model: 'qwen-image-max', operation: 'image:item_card', promptTokens: 0, completionTokens: 0, images: 1 });
    await ledger.record({ provider: 'picturegen', model: 'qwen-image-max', operation: 'image:item_card', promptTokens: 0, completionTokens: 0, images: 1 });
    expect(ledger.images).toBe(2);
    expect(ledger.usd).toBeGreaterThan(0);
  });

  it('image spend can trip the USD kill switch (it used to be invisible to it)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-img-'));
    const ledger = new UsageLedger(dir);
    await ledger.hydrate({ maxTokens: 1_000_000, maxUsd: 0.03 });
    // Default price is $0.02/image, so two images exceed a $0.03 cap.
    await ledger.record({ provider: 'picturegen', model: 'qwen-image-max', operation: 'image:option_card', promptTokens: 0, completionTokens: 0, images: 2 });
    expect(() => ledger.checkBudget()).toThrow(/usd/);
  });

  it('survives a resume: image counts and cost replay from the ledger file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-img-'));
    const first = new UsageLedger(dir);
    await first.hydrate({ maxTokens: 1_000_000, maxUsd: 100 });
    await first.record({ provider: 'picturegen', model: 'qwen-image-max', operation: 'image:scene_anchor', promptTokens: 0, completionTokens: 0, images: 3 });
    const resumed = new UsageLedger(dir);
    await resumed.hydrate({ maxTokens: 1_000_000, maxUsd: 100 });
    expect(resumed.images).toBe(3);
    expect(resumed.usd).toBeCloseTo(first.usd, 6);
  });
});

describe('rate limits get their own ladder, and Retry-After wins', () => {
  it('honours a provider Retry-After instead of guessing', async () => {
    const slept: number[] = [];
    let calls = 0;
    const result = await withTransportRetry(
      async () => {
        calls++;
        if (calls === 1) throw new ProviderHttpError('deepseek', 429, 'slow down', 45_000);
        return 'ok';
      },
      { sleep: async (ms) => { slept.push(ms); }, random: () => 0.5 },
    );
    expect(result).toBe('ok');
    expect(slept).toEqual([45_000]);
  });

  it('caps a hostile Retry-After so a worker cannot be parked forever', async () => {
    const slept: number[] = [];
    let calls = 0;
    await withTransportRetry(
      async () => {
        calls++;
        if (calls === 1) throw new ProviderHttpError('qwen', 429, 'slow down', 9_999_999);
        return 'ok';
      },
      { sleep: async (ms) => { slept.push(ms); }, random: () => 0.5, retryAfterCapMs: 120_000 },
    );
    expect(slept).toEqual([120_000]);
  });

  it('without Retry-After, a 429 uses the LONG ladder (per-minute quotas), not the 3.5s one', async () => {
    const slept: number[] = [];
    let calls = 0;
    await withTransportRetry(
      async () => {
        calls++;
        if (calls < 4) throw new ProviderHttpError('deepseek', 429, 'rate limited');
        return 'ok';
      },
      { sleep: async (ms) => { slept.push(ms); }, random: () => 1 },
    );
    // 1s, 2s, 4s with full jitter — total already exceeds the old ENTIRE budget.
    expect(slept).toEqual([1000, 2000, 4000]);
    expect(slept.reduce((a, b) => a + b, 0)).toBeGreaterThan(3750);
  });

  it('a 5xx keeps the SHORT ladder — those clear in a second', async () => {
    const slept: number[] = [];
    let calls = 0;
    await withTransportRetry(
      async () => {
        calls++;
        if (calls < 3) throw new ProviderHttpError('qwen', 503, 'unavailable');
        return 'ok';
      },
      { sleep: async (ms) => { slept.push(ms); }, random: () => 1 },
    );
    expect(slept).toEqual([500, 1000]);
  });

  it('gives a rate limit MORE attempts than a generic failure', async () => {
    let calls = 0;
    await expect(
      withTransportRetry(async () => { calls++; throw new ProviderHttpError('deepseek', 429, 'nope'); }, { sleep: async () => {}, random: () => 0.5 }),
    ).rejects.toThrow(/429/);
    expect(calls).toBe(6); // rateLimitMaxAttempts, vs 4 for the generic ladder
  });

  it('parseRetryAfter reads both seconds and an HTTP date', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('not-a-date')).toBeUndefined();
    const future = new Date(Date.now() + 20_000).toUTCString();
    const parsed = parseRetryAfter(future) ?? 0;
    expect(parsed).toBeGreaterThan(15_000);
    expect(parsed).toBeLessThanOrEqual(21_000);
  });
});

describe('a dead credential must abort the run, not burn it slot by slot', () => {
  it('classifies 401/402/403 as fatal and 429/5xx as merely transient', () => {
    expect(isFatalProviderError(new ProviderHttpError('deepseek', 402, 'Insufficient Balance'))).toBe(true);
    expect(isFatalProviderError(new ProviderHttpError('deepseek', 401, 'bad key'))).toBe(true);
    expect(isFatalProviderError(new ProviderHttpError('qwen', 403, 'forbidden'))).toBe(true);
    expect(isFatalProviderError(new ProviderHttpError('deepseek', 429, 'rate limited'))).toBe(false);
    expect(isFatalProviderError(new ProviderHttpError('qwen', 503, 'unavailable'))).toBe(false);
    expect(isFatalProviderError(new Error('something else'))).toBe(false);
  });

  it('never wastes retry budget on a fatal error', async () => {
    /*
     * Measured on a real run: DeepSeek returned 402 "Insufficient Balance" partway
     * through, and because the failure was handled per-SLOT the pipeline burned
     * 2.17M tokens / ~$10 failing all 62 slots three times each before exiting with
     * zero lessons published. A fatal error must cost exactly one attempt.
     */
    let calls = 0;
    await expect(
      withTransportRetry(async () => {
        calls++;
        throw new ProviderHttpError('deepseek', 402, 'Insufficient Balance');
      }, { sleep: async () => {}, random: () => 0.5 }),
    ).rejects.toThrow(/402/);
    expect(calls).toBe(1);
  });
});
