// Shared OpenAI-compatible chat/completions transport — the ONE fetch
// chokepoint DeepSeek and Qwen (DashScope compatible-mode) both go through.
// COURSE_ENGINE.md §5: "All clients are raw fetch behind one providers/
// chokepoint with usage logging."

import { getConfig } from '../env.js';
import {
  ProviderCompletionExhaustedError,
  ProviderHttpError,
  ProviderNetworkError,
  ProviderTimeoutError,
  parseRetryAfter,
} from './errors.js';
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

/**
 * `fetch()` resolving only proves that the provider sent response headers. A
 * reasoning provider can still leave the JSON body open indefinitely. Race the
 * body read against the SAME absolute deadline as the connection so a slot
 * cannot park beyond its configured timeout after headers arrive.
 */
function awaitWithinDeadline<T>(
  pending: Promise<T>,
  controller: AbortController,
  deadlineAt: number,
  providerName: string,
  timeoutMs: number,
): Promise<T> {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) throw new ProviderTimeoutError(providerName, timeoutMs);

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(providerName, timeoutMs));
    }, remainingMs);
    void pending.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        if (controller.signal.aborted) reject(new ProviderTimeoutError(providerName, timeoutMs));
        else reject(err);
      },
    );
  });
}

function readResponseTextWithinDeadline(
  response: Response,
  controller: AbortController,
  deadlineAt: number,
  providerName: string,
  timeoutMs: number,
): Promise<string> {
  return awaitWithinDeadline(response.text(), controller, deadlineAt, providerName, timeoutMs);
}

export async function openAiCompatibleComplete(
  cfg: OpenAiCompatibleConfig,
  req: ChatCompleteRequest,
): Promise<ChatCompleteResult> {
  // FORGE_CHAT_TIMEOUT_MS (default 120s). Operator-tunable because the ceiling
  // is REAL: the QA course's deliberately-long ordering lesson
  // (combo-arrange-largo) exceeded 120s of reasoning-model write on every
  // attempt of the first track run — a per-run env bump is the sanctioned
  // mop-up move for known-heavy lessons, never a code edit.
  const timeoutMs = cfg.timeoutMs ?? getConfig().FORGE_CHAT_TIMEOUT_MS;
  // A retry ladder must share the caller's ceiling. Before this deadline, a
  // four-attempt transport retry could turn a configured 300 s write limit
  // into twenty minutes (four full timeouts), parking a single-slot pilot
  // without a checkpoint transition.
  const deadlineAt = Date.now() + timeoutMs;

  return withTransportRetry(async () => {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) throw new ProviderTimeoutError(cfg.providerName, timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);
    try {
      let res: Response;
      try {
        res = await awaitWithinDeadline(
          fetch(`${cfg.baseUrl}/chat/completions`, {
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
          }),
          controller,
          deadlineAt,
          cfg.providerName,
          timeoutMs,
        );
      } catch (err) {
        if (controller.signal.aborted) throw new ProviderTimeoutError(cfg.providerName, timeoutMs);
        throw new ProviderNetworkError(cfg.providerName, err);
      }

      if (!res.ok) {
        let body = '';
        try {
          body = await readResponseTextWithinDeadline(res, controller, deadlineAt, cfg.providerName, timeoutMs);
        } catch (err) {
          if (err instanceof ProviderTimeoutError) throw err;
        }
        // Pass the provider's own Retry-After through: on a 429 it is the only
        // authoritative answer to when the per-minute quota resets.
        throw new ProviderHttpError(cfg.providerName, res.status, body, parseRetryAfter(res.headers.get('retry-after')));
      }

      const body = await readResponseTextWithinDeadline(res, controller, deadlineAt, cfg.providerName, timeoutMs);
      const json = JSON.parse(body) as OpenAiChatResponse;
      const content = json.choices?.[0]?.message?.content ?? '';
      const promptTokens = json.usage?.prompt_tokens ?? 0;
      const completionTokens = json.usage?.completion_tokens ?? 0;
      const cachedPromptTokens = Math.min(
        json.usage?.prompt_cache_hit_tokens ?? json.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        promptTokens,
      );
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
        throw new ProviderCompletionExhaustedError(cfg.providerName, {
          promptTokens,
          completionTokens,
          cachedPromptTokens,
          reasoningTokens: json.usage?.completion_tokens_details?.reasoning_tokens,
        });
      }
      return {
        content,
        promptTokens,
        completionTokens,
        // Clamp to promptTokens: cached tokens are a SUBSET of the prompt on
        // both providers, and the pricing subtraction in usage.ts relies on
        // cached <= prompt holding.
        cachedPromptTokens,
      };
    } finally {
      clearTimeout(timer);
    }
  }, {
    sleep: async (requestedMs) => {
      const remainingMs = deadlineAt - Date.now();
      if (remainingMs <= 0) throw new ProviderTimeoutError(cfg.providerName, timeoutMs);
      await new Promise<void>((resolve) => setTimeout(resolve, Math.min(requestedMs, remainingMs)));
      if (Date.now() >= deadlineAt) throw new ProviderTimeoutError(cfg.providerName, timeoutMs);
    },
  });
}
