import { getConfig } from '../env.js';
import { withTimeout } from '../lib/http.js';

/*
 * The pedagogical model, behind one function.
 *
 * DeepSeek over an OpenAI-compatible transport, exactly like Forge — same
 * provider, same shape, so the two services fail the same way and a lesson
 * learned in one applies to the other. Qwen is the independent judge
 * (safety/moderation.ts), never the author, for the reason Forge already
 * records: a model that grades its own work grades it generously.
 *
 * Nothing here knows what a tutor is. It sends messages and returns text.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionResult {
  text: string;
  /** Reported usage, for the per-session cost ledger (/ORACLE.md §15). */
  promptTokens: number;
  completionTokens: number;
}

export class ModelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * One completion.
 *
 * Throws `ModelUnavailableError` rather than returning a fallback string. The
 * caller decides what a child hears when the model is down, and that decision
 * must be a scripted line chosen on purpose — not an empty completion that
 * happens to render as silence (§1.14: failure must stay distinguishable from
 * emptiness).
 */
export async function complete(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<CompletionResult> {
  const config = getConfig();
  if (!config.MODEL_API_KEY) {
    throw new ModelUnavailableError('no MODEL_API_KEY configured');
  }

  let response: Response;
  try {
    response = await withTimeout(
      fetch(`${config.MODEL_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.MODEL_API_KEY}`,
        },
        body: JSON.stringify({
          model: config.MODEL_NAME,
          messages,
          temperature: opts.temperature ?? 0.6,
          max_tokens: opts.maxTokens ?? 400,
          // The turn schema is the contract; asking for JSON at the transport
          // level as well means a malformed turn is rarer, not that parsing
          // can be trusted. parseTurn() still validates.
          response_format: { type: 'json_object' },
        }),
      }),
      config.MODEL_TIMEOUT_MS,
      'pedagogical model',
    );
  } catch (error) {
    throw new ModelUnavailableError(error instanceof Error ? error.message : 'model transport failed');
  }

  if (!response.ok) {
    throw new ModelUnavailableError(`model responded ${response.status}`);
  }

  const body = (await response.json()) as ChatResponse;
  const text = body.choices?.[0]?.message?.content ?? '';
  if (text.trim() === '') {
    // A billable empty completion is a failure, not an answer. Forge treats it
    // the same way and for the same reason: silently accepting one means
    // paying for nothing and showing nothing.
    throw new ModelUnavailableError('model returned an empty completion');
  }

  return {
    text,
    promptTokens: body.usage?.prompt_tokens ?? 0,
    completionTokens: body.usage?.completion_tokens ?? 0,
  };
}

/** Whether a pedagogical model is configured at all. Used by /health and readiness. */
export function modelConfigured(): boolean {
  return Boolean(getConfig().MODEL_API_KEY);
}
