import { computeWaitMs, isRateLimitStatus, isRetryableStatus, parseRetryAfterMs, RATE_LIMIT_EXTRA_ATTEMPTS } from './backoff.js';
import { TtsError } from './errors.js';

export interface SynthesizeInput {
  text: string;
  voice: string;
  languageType: string;
}

export interface DashscopeClientOptions {
  apiUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 4;

/*
 * DashScope (Qwen3-TTS) REST client — POST {model, input:{text, voice,
 * language_type}} → a temporary (24h) WAV URL. Response shape is read
 * defensively: output.audio.url OR output.audio_url (audiogen prompt spec).
 * Retries ONLY on 429/5xx with jittered backoff; everything else fails fast.
 */
export async function synthesizeSpeech(input: SynthesizeInput, opts: DashscopeClientOptions): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: TtsError | null = null;

  // Rate limits get extra attempts on top of the transient budget: quotas are
  // per-minute, and with concurrent workers the short ladder alone burns every
  // attempt inside the same window that rejected the call.
  const rateLimitMaxAttempts = maxAttempts + RATE_LIMIT_EXTRA_ATTEMPTS;

  for (let attempt = 1; attempt <= rateLimitMaxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(opts.apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          input: { text: input.text, voice: input.voice, language_type: input.languageType },
        }),
      });
      clearTimeout(timer);

      if (!res.ok) {
        const rateLimited = isRateLimitStatus(res.status);
        const attemptLimit = rateLimited ? rateLimitMaxAttempts : maxAttempts;
        if (isRetryableStatus(res.status) && attempt < attemptLimit) {
          lastError = new TtsError('TTS_RATE_LIMITED', `DashScope responded ${res.status}`);
          // The provider's own Retry-After (already capped) always wins over our guess.
          const retryAfterMs = rateLimited ? parseRetryAfterMs(res.headers.get('retry-after')) : undefined;
          await sleep(computeWaitMs(attempt, { rateLimited, retryAfterMs, rand: opts.rand }));
          continue;
        }
        throw new TtsError(
          isRetryableStatus(res.status) ? 'TTS_RATE_LIMITED' : 'TTS_PROVIDER_ERROR',
          `DashScope responded ${res.status}`,
        );
      }

      const body = (await res.json()) as unknown;
      const url = extractAudioUrl(body);
      if (!url) throw new TtsError('TTS_BAD_RESPONSE', 'DashScope response had no output.audio.url / output.audio_url');
      return url;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof TtsError) throw err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const ttsErr = new TtsError(isAbort ? 'TTS_TIMEOUT' : 'TTS_PROVIDER_ERROR', isAbort ? 'DashScope request timed out' : String(err));
      if (attempt < maxAttempts) {
        lastError = ttsErr;
        await sleep(computeWaitMs(attempt, { rand: opts.rand }));
        continue;
      }
      throw ttsErr;
    }
  }

  // Unreachable in practice — loop always returns or throws — but keeps TS happy.
  throw lastError ?? new TtsError('TTS_PROVIDER_ERROR', 'DashScope request failed with no error captured');
}

function extractAudioUrl(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const output = (body as Record<string, unknown>).output;
  if (typeof output !== 'object' || output === null) return null;
  const audio = (output as Record<string, unknown>).audio;
  if (typeof audio === 'object' && audio !== null) {
    const url = (audio as Record<string, unknown>).url;
    if (typeof url === 'string' && url.length > 0) return url;
  }
  const audioUrl = (output as Record<string, unknown>).audio_url;
  if (typeof audioUrl === 'string' && audioUrl.length > 0) return audioUrl;
  return null;
}

/** Downloads the temporary WAV URL DashScope returned. */
export async function downloadWav(url: string, fetchImpl: typeof fetch = fetch): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch (err) {
    throw new TtsError('TTS_DOWNLOAD_FAILED', `Failed to download WAV: ${String(err)}`);
  }
  if (!res.ok) throw new TtsError('TTS_DOWNLOAD_FAILED', `WAV download responded ${res.status}`);
  return res.arrayBuffer();
}
