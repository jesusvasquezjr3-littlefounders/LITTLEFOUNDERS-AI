// DeepSeek — the AUTHOR provider (plan / author / localize stages).
// Ported from `coursegen/src/providers/deepseek.ts`.

import { getConfig } from '../env.js';
import { ProviderNotConfiguredError } from './errors.js';
import { openAiCompatibleComplete, type ChatCompleteRequest, type ChatCompleteResult } from './openaiChat.js';
import type { UsageLedger } from './usage.js';

export interface CompleteOptions {
  /** Ledger operation label — 'plan' | 'author' | 'localize' | 'revise' etc. */
  operation: string;
  ledger?: UsageLedger;
}

/**
 * The chokepoint: every DeepSeek call in the Arcade pipeline goes through this
 * function, so the budget check and the ledger write can never be bypassed.
 *
 * `checkBudget()` runs BEFORE the paid call and throws BudgetExceededError; that
 * error must PROPAGATE out of every stage loop (gamegen/AGENTS.md) — a kill
 * switch only exists if the error escapes.
 */
export async function completeDeepSeek(req: ChatCompleteRequest, opts: CompleteOptions): Promise<ChatCompleteResult> {
  const c = getConfig();
  if (!c.DEEPSEEK_API_KEY) throw new ProviderNotConfiguredError('deepseek');

  opts.ledger?.checkBudget();

  // No hardcoded timeout: openaiChat falls back to ARCADE_CHAT_TIMEOUT_MS so the
  // documented per-run operator bump actually reaches the fetch.
  const result = await openAiCompatibleComplete(
    {
      providerName: 'deepseek',
      baseUrl: c.DEEPSEEK_BASE_URL,
      apiKey: c.DEEPSEEK_API_KEY,
      model: c.DEEPSEEK_MODEL,
    },
    req,
  );

  if (opts.ledger) {
    await opts.ledger.record({
      provider: 'deepseek',
      model: c.DEEPSEEK_MODEL,
      operation: opts.operation,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      cachedPromptTokens: result.cachedPromptTokens,
    });
  }

  return result;
}
