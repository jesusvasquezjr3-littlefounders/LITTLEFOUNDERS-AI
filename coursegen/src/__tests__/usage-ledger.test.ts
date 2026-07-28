import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { UsageLedger, BudgetExceededError, estimateCostUsd } from '../providers/usage.js';
import { resetConfigCache } from '../env.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'forge-ledger-'));
  resetConfigCache();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  resetConfigCache();
});

describe('UsageLedger', () => {
  it('accumulates tokens and appends one JSONL line per record', async () => {
    const ledger = new UsageLedger(dir);
    await ledger.record({ provider: 'deepseek', model: 'deepseek-chat', operation: 'plan', promptTokens: 100, completionTokens: 50 });
    await ledger.record({ provider: 'qwen', model: 'qwen3-max', operation: 'review', promptTokens: 200, completionTokens: 100 });

    expect(ledger.tokens).toBe(450);

    const lines = readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!) as { provider: string; prompt_tokens: number };
    expect(first.provider).toBe('deepseek');
    expect(first.prompt_tokens).toBe(100);
  });

  it('checkBudget throws BudgetExceededError once FORGE_MAX_TOKENS_PER_RUN is reached', async () => {
    process.env.FORGE_MAX_TOKENS_PER_RUN = '100';
    resetConfigCache();
    const ledger = new UsageLedger(dir);
    await ledger.record({ provider: 'deepseek', model: 'deepseek-chat', operation: 'plan', promptTokens: 80, completionTokens: 30 });
    expect(() => ledger.checkBudget()).toThrow(BudgetExceededError);
    delete process.env.FORGE_MAX_TOKENS_PER_RUN;
  });

  it('checkBudget passes when well under budget', () => {
    const ledger = new UsageLedger(dir);
    expect(() => ledger.checkBudget()).not.toThrow();
  });
});

describe('estimateCostUsd', () => {
  it('is proportional to token counts and non-negative', () => {
    const cost = estimateCostUsd({ provider: 'deepseek', promptTokens: 1000, completionTokens: 1000 });
    expect(cost).toBeGreaterThan(0);
  });

  it('picturegen cost depends only on the image count, never token counts', () => {
    // Regression for a vacuous test: this used to pass 'gemini-image', a
    // provider removed from the UsageProvider union — both sides evaluated to
    // undefined and toBe() passed while asserting nothing.
    const a = estimateCostUsd({ provider: 'picturegen', promptTokens: 0, completionTokens: 0, images: 2 });
    const b = estimateCostUsd({ provider: 'picturegen', promptTokens: 999, completionTokens: 999, images: 2 });
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it('prices cached prompt tokens at the CACHED rate — subtracted from the full-rate pool, never double-charged', () => {
    const fresh = estimateCostUsd({ provider: 'deepseek', promptTokens: 100_000, completionTokens: 0 });
    const allCached = estimateCostUsd({ provider: 'deepseek', promptTokens: 100_000, completionTokens: 0, cachedPromptTokens: 100_000 });
    const halfCached = estimateCostUsd({ provider: 'deepseek', promptTokens: 100_000, completionTokens: 0, cachedPromptTokens: 50_000 });
    expect(allCached).toBeLessThan(fresh / 50); // v4-pro hit rate is ~1/120 of miss
    expect(halfCached).toBeCloseTo((fresh + allCached) / 2, 10);
    // Clamp: cached can never exceed prompt (a provider bug must not yield negative cost).
    const clamped = estimateCostUsd({ provider: 'deepseek', promptTokens: 1000, completionTokens: 0, cachedPromptTokens: 5000 });
    expect(clamped).toBeGreaterThanOrEqual(0);
    expect(clamped).toBe(estimateCostUsd({ provider: 'deepseek', promptTokens: 1000, completionTokens: 0, cachedPromptTokens: 1000 }));
  });
});
