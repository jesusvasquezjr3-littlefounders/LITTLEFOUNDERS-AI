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
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
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
      return {
        content,
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
      };
    } finally {
      clearTimeout(timer);
    }
  });
}
