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

  it('gemini-image cost does not depend on token counts', () => {
    const a = estimateCostUsd({ provider: 'gemini-image', promptTokens: 0, completionTokens: 0 });
    const b = estimateCostUsd({ provider: 'gemini-image', promptTokens: 999, completionTokens: 999 });
    expect(a).toBe(b);
  });
});
