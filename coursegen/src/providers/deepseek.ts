// DeepSeek — the author provider (plan/write/localize), COURSE_ENGINE.md §5.

import { getConfig } from '../env.js';
import { ProviderCompletionExhaustedError, ProviderHttpError, ProviderNotConfiguredError, isRetryableError } from './errors.js';
import { openAiCompatibleComplete, type ChatCompleteRequest, type ChatCompleteResult } from './openaiChat.js';
import type { UsageLedger } from './usage.js';
import { completeQwen } from './qwen.js';

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

  let result: ChatCompleteResult;
  try {
    result = await openAiCompatibleComplete(
      {
        providerName: 'deepseek',
        baseUrl: c.DEEPSEEK_BASE_URL,
        apiKey: c.DEEPSEEK_API_KEY,
        model: c.DEEPSEEK_MODEL,
        // FORGE_CHAT_TIMEOUT_MS is intentionally operator-tunable for a known
        // heavy write. Do not pin 120s here: that silently defeats the documented
        // per-run timeout override and turns a slow reasoning response into an
        // expensive three-attempt regeneration loop.
        timeoutMs: c.FORGE_CHAT_TIMEOUT_MS,
      },
      req,
    );
  } catch (err) {
    if (err instanceof ProviderCompletionExhaustedError && opts.ledger) {
      await opts.ledger.record({
        provider: 'deepseek',
        model: c.DEEPSEEK_MODEL,
        operation: opts.operation,
        promptTokens: err.promptTokens,
        completionTokens: err.completionTokens,
        cachedPromptTokens: err.cachedPromptTokens,
      });
    }
    /*
     * Forge already requires Qwen for the independent judge. When DeepSeek's
     * transport is temporarily unavailable, use that configured second
     * provider rather than burning outer slot retries on an identical outage.
     * This does not weaken release posture: the document still clears all
     * deterministic gates, gets a review, lands as `review`, and needs human
     * release. A DeepSeek-only 402 is also safe to route to Qwen: it means
     * that provider's account capacity is exhausted, not that Qwen's separate
     * account or the request is invalid. Credentials (401/403), malformed
     * requests and billable exhausted completions deliberately do NOT fail over.
     */
    const qwenCanCoverDeepSeek = isRetryableError(err) || (err instanceof ProviderHttpError && err.status === 402);
    if (c.FORGE_DEEPSEEK_FALLBACK_TO_QWEN && qwenCanCoverDeepSeek) {
      console.warn(
        `[forge] DeepSeek author unavailable (${err instanceof Error ? err.message : String(err)}); ` +
          `using Qwen fallback for ${opts.operation}.`,
      );
      return completeQwen(req, {
        operation: `${opts.operation}:deepseek-fallback`,
        ledger: opts.ledger,
        timeoutMs: c.FORGE_QWEN_FALLBACK_TIMEOUT_MS,
      });
    }
    throw err;
  }

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
