// Shared OpenAI-compatible chat/completions transport — the ONE fetch
// chokepoint DeepSeek and Qwen (DashScope compatible-mode) both go through.
// COURSE_ENGINE.md §5: "All clients are raw fetch behind one providers/
// chokepoint with usage logging."

import { ProviderHttpError, ProviderNetworkError, ProviderTimeoutError, parseRetryAfter } from './errors.js';
import { withTransportRetry } from './retry.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompleteRequest {
  messages: ChatMessage[];
  temperature: number;
  jsonMode?: boolean;
  maxTokens?: number;
}

export interface ChatCompleteResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  /**
   * The SUBSET of promptTokens served from the provider's automatic context
   * cache (DeepSeek: prompt_cache_hit_tokens; DashScope compatible-mode:
   * prompt_tokens_details.cached_tokens). Billed ~10-20x cheaper than a miss —
   * dropping this field made the ledger overstate real spend and made every
   * prefix-stability improvement unmeasurable.
   */
  cachedPromptTokens: number;
}

export interface OpenAiCompatibleConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Default 120s (COURSE_ENGINE.md §5 deepseek.ts spec). */
  timeoutMs?: number;
}

interface OpenAiChatResponse {
  /** `finish_reason` matters: 'length' with empty content means budget starvation, not an answer. */
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    /** Reasoning models report how much of the budget went to thinking. */
    completion_tokens_details?: { reasoning_tokens?: number };
    /** DeepSeek-native: input tokens served from the automatic prefix cache. */
    prompt_cache_hit_tokens?: number;
    /** OpenAI-compat shape (DashScope reports cache hits here). */
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

export async function openAiCompatibleComplete(
  cfg: OpenAiCompatibleConfig,
  req: ChatCompleteRequest,
): Promise<ChatCompleteResult> {
  const timeoutMs = cfg.timeoutMs ?? 120_000;

  return withTransportRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetch(`${cfg.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: req.messages,
            temperature: req.temperature,
            ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
            ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) throw new ProviderTimeoutError(cfg.providerName, timeoutMs);
        throw new ProviderNetworkError(cfg.providerName, err);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        // Pass the provider's own Retry-After through: on a 429 it is the only
        // authoritative answer to when the per-minute quota resets.
        throw new ProviderHttpError(cfg.providerName, res.status, body, parseRetryAfter(res.headers.get('retry-after')));
      }

      const json = (await res.json()) as OpenAiChatResponse;
      const content = json.choices?.[0]?.message?.content ?? '';
      /*
       * EMPTY CONTENT + finish_reason 'length' IS ALWAYS A BUG, NEVER AN ANSWER.
       *
       * Measured 2026-07-25 against deepseek-v4-pro, which is a REASONING model: it
       * spends its completion budget thinking before emitting anything, so a call
       * capped too low returns `content: ''` with finish_reason 'length' and a 200 OK.
       * translateTitle asked for 60 tokens; the model burned all 60 on reasoning
       * (measured: 477 reasoning tokens are needed for a THREE-WORD title) and
       * returned nothing. That empty string was then trimmed and written into
       * `topics.title`, shipping NINE OF TEN topics with blank names in en-US and
       * pt-BR — silently, because '' was reported as success.
       *
       * Failing here rather than at each call site protects every present and future
       * caller, and names the actual cause so nobody debugs the prompt instead of the
       * budget.
       */
      const finishReason = json.choices?.[0]?.finish_reason;
      if (content.trim().length === 0 && finishReason === 'length') {
        const reasoning = json.usage?.completion_tokens_details?.reasoning_tokens;
        throw new Error(
          `${cfg.providerName} returned NO content: the completion budget was exhausted before any output ` +
            `(finish_reason=length${reasoning ? `, ${reasoning} reasoning tokens` : ''}). ` +
            `This model reasons before answering — raise maxTokens for this call.`,
        );
      }
      const promptTokens = json.usage?.prompt_tokens ?? 0;
      return {
        content,
        promptTokens,
        completionTokens: json.usage?.completion_tokens ?? 0,
        // Clamp to promptTokens: cached tokens are a SUBSET of the prompt on
        // both providers, and the pricing subtraction in usage.ts relies on
        // cached <= prompt holding.
        cachedPromptTokens: Math.min(
          json.usage?.prompt_cache_hit_tokens ?? json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
          promptTokens,
        ),
      };
    } finally {
      clearTimeout(timer);
    }
  });
}
