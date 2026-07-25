// DeepSeek — the author provider (plan/write/localize), COURSE_ENGINE.md §5.

import { getConfig } from '../env.js';
import { ProviderNotConfiguredError } from './errors.js';
import { openAiCompatibleComplete, type ChatCompleteRequest, type ChatCompleteResult } from './openaiChat.js';
import type { UsageLedger } from './usage.js';

export interface CompleteOptions {
  /** Ledger operation label — 'plan' | 'write' | 'localize' | 'revise' etc. */
  operation: string;
  ledger?: UsageLedger;
}

/** The chokepoint: every DeepSeek call in the pipeline goes through this function. */
export async function completeDeepSeek(req: ChatCompleteRequest, opts: CompleteOptions): Promise<ChatCompleteResult> {
  const c = getConfig();
  if (!c.DEEPSEEK_API_KEY) throw new ProviderNotConfiguredError('deepseek');

  opts.ledger?.checkBudget();

  const result = await openAiCompatibleComplete(
    {
      providerName: 'deepseek',
      baseUrl: c.DEEPSEEK_BASE_URL,
      apiKey: c.DEEPSEEK_API_KEY,
      model: c.DEEPSEEK_MODEL,
      timeoutMs: 120_000,
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
