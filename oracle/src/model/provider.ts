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

/**
 * The completion budget for one turn, exported so the diagnostic in
 * `scripts/verify-model.ts` asks the SAME question this function asks.
 *
 * It already drifted once: the diagnostic hardcoded 400 while this had moved to
 * 800, so a failing turn reported a budget nobody was using and pointed at the
 * wrong cause. A diagnosis of a different request is worse than no diagnosis.
 */
export const DEFAULT_MAX_TOKENS = 2000;

export class ModelUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}

/**
 * The caller cancelled the completion — a learner interrupted mid-thought.
 *
 * A separate class from `ModelUnavailableError` because the two demand
 * opposite reactions: an unavailable model is worth a scripted apology, an
 * abandoned question is worth nothing at all. Collapsing them would make every
 * interruption read as an outage in the logs and cost a scripted line nobody
 * asked for.
 */
export class CompletionAbortedError extends Error {
  constructor() {
    super('completion aborted by caller');
    this.name = 'CompletionAbortedError';
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
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
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
        signal: opts.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.MODEL_API_KEY}`,
        },
        body: JSON.stringify({
          model: config.MODEL_NAME,
          messages,
          temperature: opts.temperature ?? 0.6,
          /*
           * 2000, and almost none of it is for the answer.
           *
           * EVERY MODEL THIS ACCOUNT OFFERS REASONS. `/models` lists exactly
           * deepseek-v4-flash, deepseek-v4-flash-vision-exp and
           * deepseek-v4-pro, and all of them spend the completion budget
           * THINKING before a single character of content appears. Measured
           * here in production on this exact prompt: 400 tokens of budget, 400
           * tokens of `reasoning_content`, `content` of length ZERO, and
           * `finish_reason: 'length'`. Not an error — a 200, billed, empty.
           *
           * Forge already paid for this lesson and wrote it down. Translating a
           * THREE-WORD title cost it 477 reasoning tokens, budgets of 60 and
           * 300 both came back empty, and that empty string is what shipped
           * nine of ten topics with a blank name in two locales
           * (coursegen/src/pipeline/localize.ts:490). Its structured-JSON call
           * — the same shape as a turn — uses 2000, so this does too.
           *
           * The answer itself needs about 550: the schema's worst case is ~1,650
           * characters (`say` up to 700, plus a segmentRequest carrying skillKey
           * 128, framing 240 and rationale 400, plus keys and punctuation). The
           * other ~1,450 is headroom for thinking, which varies with the
           * question and cannot be predicted per turn.
           *
           * The failure this prevents is silent by construction: the model stops
           * mid-object, the JSON never closes, `parseTurn` discards the turn,
           * and the learner is told the tutor's thoughts got tangled.
           */
          max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
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
    // The signal is the authority on WHY the fetch threw: an aborted fetch
    // rejects with the same DOMException family as several transport faults.
    if (opts.signal?.aborted) throw new CompletionAbortedError();
    throw new ModelUnavailableError(error instanceof Error ? error.message : 'model transport failed');
  }

  if (!response.ok) {
    throw new ModelUnavailableError(`model responded ${response.status}`);
  }

  const body = (await response.json()) as ChatResponse;
  const text = body.choices?.[0]?.message?.content ?? '';
  if (text.trim() === '') {
    /*
     * A billable empty completion is a failure, not an answer. Forge treats it
     * the same way and for the same reason: silently accepting one means
     * paying for nothing and showing nothing.
     *
     * AND IT SAYS WHY. Eighteen of these arrived in three scripted lessons on
     * 2026-08-29 — the retry absorbs every one, so no learner sees them and no
     * gate reports them, while we pay for a second call on a large fraction of
     * turns. "The model sometimes returns nothing" stayed a guess for as long
     * as the throw carried no evidence, and the four causes need different
     * fixes: the budget ran out, a reasoning model ate the completion, we were
     * billed for an empty string, or the provider refused behind a 200. All
     * four are in the response we are about to discard, so they are logged
     * here — counts and reasons only, never content.
     *
     * ANSWERED 2026-08-29, and it was none of the four. `finish_reason=stop`,
     * no reasoning, 41-87 completion tokens generated, and `message.content`
     * holding 45-76 characters — of WHITESPACE. The provider bills a full,
     * normally-terminated completion for a string that trims to nothing. The
     * retry catches it because the second attempt runs at a lower temperature
     * and has never produced one, which is where the first attempt's tuned
     * temperature comes from (see `orchestrator.produce`).
     *
     * The line stays: the rate is worth watching, and the next shape of empty
     * will not be this one.
     */
    const choice = body.choices?.[0] as { finish_reason?: unknown } | undefined;
    const usage = (body as { usage?: Record<string, unknown> }).usage ?? {};
    const message = (body.choices?.[0]?.message ?? {}) as Record<string, unknown>;
    const reasoningChars =
      typeof message.reasoning_content === 'string' ? message.reasoning_content.length : 0;
    /*
     * WHICH FIELD DID THE TOKENS GO TO?
     *
     * The first version of this log answered the four questions it was written
     * for and produced a fifth: `finish_reason=stop`, `reasoning_chars=0`,
     * `completion_tokens` between 41 and 87 — the model generated a normal,
     * complete answer and `content` was still empty. The tokens went somewhere
     * we are not reading. So the message's SHAPE is logged too: key names and
     * value lengths, never values, because this is the one log line a
     * learner's words could reach and they must not.
     */
    const shape = Object.entries(message)
      .map(([k, v]) => `${k}:${typeof v === 'string' ? `${v.length}ch` : typeof v}`)
      .join(' ');
    console.warn(
      `[oracle] empty completion: finish_reason=${String(choice?.finish_reason ?? 'none')} ` +
        `reasoning_chars=${reasoningChars} message={${shape}} usage=${JSON.stringify(usage)}`,
    );
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

/*
 * THE PROBE, because "a key string exists" is not "the model answers".
 *
 * On 2026-08-24 the shared DeepSeek account ran out of balance and the tutor
 * was down in production — but `modelConfigured()` only checks that a key is
 * SET, so preflight said "canStart", Core minted a token, the stage loaded,
 * and every single turn then failed. A learner was invited into a session
 * that could not speak. The probe closes exactly that class: a real (tiny)
 * completion, cached for a minute, whose DEFINITIVE refusals — 401 bad key,
 * 402 no balance, 403 forbidden — turn the start button off honestly.
 *
 * Deliberately biased toward availability everywhere else: a timeout or a 5xx
 * is a transient the next turn may survive, and flapping the whole tutor off
 * for sixty seconds on one slow response would trade a rare honest failure
 * for a common false outage. Cost: at most one ~10-token call per minute per
 * instance, and none at all while nobody asks.
 */
export type ModelProbeResult = 'ok' | 'unconfigured' | 'blocked';

const PROBE_TTL_MS = 60_000;
const PROBE_TIMEOUT_MS = 5_000;
let probeCache: { at: number; result: ModelProbeResult } | null = null;

export async function modelReachable(): Promise<ModelProbeResult> {
  const config = getConfig();
  if (!config.MODEL_API_KEY) return 'unconfigured';
  const now = Date.now();
  if (probeCache && now - probeCache.at < PROBE_TTL_MS) return probeCache.result;

  let result: ModelProbeResult = 'ok';
  try {
    const response = await withTimeout(
      fetch(`${config.MODEL_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.MODEL_API_KEY}`,
        },
        body: JSON.stringify({
          model: config.MODEL_NAME,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
      }),
      PROBE_TIMEOUT_MS,
      'model probe',
    );
    if (response.status === 401 || response.status === 402 || response.status === 403) {
      console.error(`[oracle] model probe refused (${response.status}) — sessions cannot start`);
      result = 'blocked';
    }
  } catch {
    // Transient. See the availability-bias note above.
  }
  probeCache = { at: now, result };
  return result;
}

/** Tests only: the cache would otherwise leak a verdict across test files. */
export function resetModelProbe(): void {
  probeCache = null;
}
