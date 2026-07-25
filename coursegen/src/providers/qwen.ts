// Qwen (DashScope compatible-mode) — the independent judge provider
// (review stage), COURSE_ENGINE.md §5. Deliberately a SEPARATE provider
// from DeepSeek so its blind spots decorrelate from the author's (LF-Brain
// pattern, COURSE_ENGINE.md §1).

import { getConfig } from '../env.js';
import { ProviderNotConfiguredError } from './errors.js';
import { openAiCompatibleComplete, type ChatCompleteRequest, type ChatCompleteResult } from './openaiChat.js';
import type { UsageLedger } from './usage.js';

export interface CompleteOptions {
  operation: string;
  ledger?: UsageLedger;
}

/** The chokepoint: every Qwen call in the pipeline goes through this function. */
export async function completeQwen(req: ChatCompleteRequest, opts: CompleteOptions): Promise<ChatCompleteResult> {
  const c = getConfig();
  if (!c.QWEN_API_KEY) throw new ProviderNotConfiguredError('qwen');

  opts.ledger?.checkBudget();

  const result = await openAiCompatibleComplete(
    {
      providerName: 'qwen',
      baseUrl: c.QWEN_BASE_URL,
      apiKey: c.QWEN_API_KEY,
      model: c.QWEN_JUDGE_MODEL,
      timeoutMs: 120_000,
    },
    req,
  );

  if (opts.ledger) {
    await opts.ledger.record({
      provider: 'qwen',
      model: c.QWEN_JUDGE_MODEL,
      operation: opts.operation,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      cachedPromptTokens: result.cachedPromptTokens,
    });
  }

  return result;
}
