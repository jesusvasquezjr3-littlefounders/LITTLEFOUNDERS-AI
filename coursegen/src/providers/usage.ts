// Usage ledger — one JSONL line per provider call, appended to
// runs/<run-id>/ledger.jsonl, plus an in-memory running total the kill
// switches (FORGE_MAX_TOKENS_PER_RUN / FORGE_MAX_USD_PER_RUN) check before
// every call (COURSE_ENGINE.md §4 "Budget").

import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '../env.js';

export type UsageProvider = 'deepseek' | 'qwen';

export interface UsageRecord {
  provider: UsageProvider;
  model: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
}

/** Small cost table, USD, env-overridable (env.ts COST_* vars, defaults are ballpark public list prices). */
export function estimateCostUsd(record: Pick<UsageRecord, 'provider' | 'promptTokens' | 'completionTokens'>): number {
  const c = getConfig();
  switch (record.provider) {
    case 'deepseek':
      return (record.promptTokens / 1000) * c.COST_DEEPSEEK_INPUT_PER_1K +
        (record.completionTokens / 1000) * c.COST_DEEPSEEK_OUTPUT_PER_1K;
    case 'qwen':
      return (record.promptTokens / 1000) * c.COST_QWEN_INPUT_PER_1K +
        (record.completionTokens / 1000) * c.COST_QWEN_OUTPUT_PER_1K;
  }
}

export class BudgetExceededError extends Error {
  constructor(kind: 'tokens' | 'usd', used: number, limit: number) {
    super(`Forge run budget exceeded (${kind}): used ${used}, limit ${limit}`);
    this.name = 'BudgetExceededError';
  }
}

export class UsageLedger {
  private totalTokens = 0;
  private totalUsd = 0;
  private readonly filePath: string;

  constructor(runDir: string) {
    this.filePath = path.join(runDir, 'ledger.jsonl');
  }

  get tokens(): number {
    return this.totalTokens;
  }

  get usd(): number {
    return this.totalUsd;
  }

  /** Throws BudgetExceededError if the run is already over budget — call BEFORE every provider call. */
  checkBudget(): void {
    const c = getConfig();
    if (this.totalTokens >= c.FORGE_MAX_TOKENS_PER_RUN) {
      throw new BudgetExceededError('tokens', this.totalTokens, c.FORGE_MAX_TOKENS_PER_RUN);
    }
    if (this.totalUsd >= c.FORGE_MAX_USD_PER_RUN) {
      throw new BudgetExceededError('usd', this.totalUsd, c.FORGE_MAX_USD_PER_RUN);
    }
  }

  async record(record: UsageRecord): Promise<void> {
    const estUsd = estimateCostUsd(record);
    this.totalTokens += record.promptTokens + record.completionTokens;
    this.totalUsd += estUsd;

    await mkdir(path.dirname(this.filePath), { recursive: true });
    const line =
      JSON.stringify({
        ts: new Date().toISOString(),
        provider: record.provider,
        model: record.model,
        operation: record.operation,
        prompt_tokens: record.promptTokens,
        completion_tokens: record.completionTokens,
        est_usd: Number(estUsd.toFixed(6)),
      }) + '\n';
    await appendFile(this.filePath, line, 'utf8');
  }
}
