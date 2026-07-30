// Shared OpenAI-compatible chat/completions transport — the ONE fetch
// chokepoint DeepSeek (author) and Qwen (judge, DashScope compatible-mode) both
// go through. Ported from `coursegen/src/providers/openaiChat.ts`; every rule in
// here was paid for by a real Forge run.

import { getConfig } from '../env.js';
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
  /**
   * Completion budget. SIZE IT BY REASONING + ANSWER, never by answer length —
   * see the finish_reason==='length' guard below.
   */
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
   * prefix-stability improvement unmeasurable. gamegen/AGENTS.md makes the
   * prefix-cache hit share a first-class cost metric: a prompt change that
   * tanks it is a cost regression even when quality holds.
   */
  cachedPromptTokens: number;
}

export interface OpenAiCompatibleConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Defaults to ARCADE_CHAT_TIMEOUT_MS (120s). */
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
  // ARCADE_CHAT_TIMEOUT_MS (default 120s). Operator-tunable because the ceiling
  // is REAL: Forge's deliberately-long ordering lesson exceeded 120s of
  // reasoning-model write on every attempt of its first track run — a per-run
  // env bump is the sanctioned mop-up move for known-heavy slots, never a code
  // edit. A game manifest with 80 items is the same shape of heavy.
  const timeoutMs = cfg.timeoutMs ?? getConfig().ARCADE_CHAT_TIMEOUT_MS;

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
       * Forge's translateTitle asked for 60 tokens; the model burned all 60 on
       * reasoning (measured: 477 reasoning tokens are needed for a THREE-WORD title)
       * and returned nothing. That empty string was then trimmed and written into
       * `topics.title`, shipping NINE OF TEN topics with blank names in en-US and
       * pt-BR — silently, because '' was reported as success.
       *
       * Arcade is MORE exposed, not less: a GameDocument is a large JSON object and
       * every paid stage (plan/author/judge/localize) asks for structured output, so
       * an undersized budget here is an empty manifest that would then fail schema
       * parsing far from its cause.
       *
       * Failing here rather than at each call site protects every present and future
       * caller, and names the actual cause so nobody debugs the prompt instead of the
       * budget. SIZE maxTokens BY REASONING + ANSWER, NEVER BY ANSWER LENGTH.
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
