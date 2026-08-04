import { computeWaitMs, isRateLimitStatus, isRetryableStatus, parseRetryAfterMs, RATE_LIMIT_EXTRA_ATTEMPTS } from './backoff.js';
import { ImageError } from './errors.js';

/*
 * DashScope (Qwen-Image) text-to-image client — the ONE seam every paid image
 * call goes through (swapping providers later = replacing this module, not
 * the service above it). It selects the provider contract from the model:
 * qwen-image-max uses the synchronous multimodal endpoint, while legacy
 * qwen-image/qwen-image-plus use the async submit → poll workflow:
 *
 *   1. SUBMIT  POST {base}/api/v1/services/aigc/text2image/image-synthesis
 *              header X-DashScope-Async: enable
 *              body { model, input:{prompt, negative_prompt?}, parameters:{n:1, size} }
 *              → { output:{ task_id, task_status } }
 *   2. POLL    GET  {base}/api/v1/tasks/{task_id}  (every ~3s)
 *              → { output:{ task_status, results:[{url}] } }  until SUCCEEDED
 *   3. DOWNLOAD the result URL (DashScope's URL is TEMPORARY — we ALWAYS
 *              download the bytes and re-upload to Depot; the temp URL is
 *              never persisted).
 *
 * Retries ONLY on 429/5xx with jittered backoff; everything else fails fast.
 * The whole submit→poll wall clock is bounded by PICTUREGEN_TIMEOUT_MS.
 */

export interface GenerateImageInput {
  prompt: string;
  negativePrompt?: string;
}

export interface QwenImageClientOptions {
  apiBase: string;
  apiKey: string;
  model: string;
  size: string;
  fetchImpl?: typeof fetch;
  /** Overall wall-clock budget for submit + poll. Default 120s. */
  timeoutMs?: number;
  /** Max transport attempts per HTTP call. Default 4. */
  maxAttempts?: number;
  /** Delay between task-status polls. Default 3s. */
  pollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
}

export interface GeneratedImage {
  bytes: Buffer;
  contentType: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_POLL_INTERVAL_MS = 3_000;
/** Ceiling for any single HTTP request, so one hung leg can't eat the whole budget. */
const PER_REQUEST_CEILING_MS = 60_000;

interface ResolvedOptions {
  apiBase: string;
  apiKey: string;
  model: string;
  size: string;
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  rand: () => number;
  maxAttempts: number;
  pollIntervalMs: number;
  deadline: number;
}

interface TaskSubmitBody {
  output?: { task_id?: string; task_status?: string };
}

interface TaskStatusBody {
  output?: { task_status?: string; message?: string; results?: { url?: string }[] };
}

interface SyncResponseBody {
  output?: {
    choices?: {
      message?: { content?: { image?: string }[] };
    }[];
  };
  code?: string;
  message?: string;
}

/**
 * DashScope caps `negative_prompt` at 500 characters. The judge layer budgets
 * its merged negative against this same constant so the non-negotiable base
 * terms always arrive intact; the clamp below is the last-resort guard.
 */
export const MAX_NEGATIVE_PROMPT_CHARS = 500;

/**
 * Keeps whole comma-separated terms within `maxChars` — a mid-token slice
 * ("photorea") guides the model toward nothing, so truncation only ever
 * happens at a comma boundary. Returns '' when not even the first term fits.
 */
export function truncateAtCommaBoundary(list: string, maxChars: number): string {
  if (list.length <= maxChars) return list;
  const terms = list.split(',').map((term) => term.trim()).filter((term) => term.length > 0);
  const kept: string[] = [];
  let length = 0;
  for (const term of terms) {
    const nextLength = kept.length === 0 ? term.length : length + 2 + term.length;
    if (nextLength > maxChars) break;
    kept.push(term);
    length = nextLength;
  }
  return kept.join(', ');
}

function clampNegativePrompt(negative: string): string {
  const clamped = truncateAtCommaBoundary(negative, MAX_NEGATIVE_PROMPT_CHARS);
  // A single comma-less over-long term degrades to a hard slice — an imperfect
  // fragment still beats sending nothing under the provider cap.
  return clamped.length > 0 ? clamped : negative.slice(0, MAX_NEGATIVE_PROMPT_CHARS);
}

/*
 * Per DashScope's Qwen-Image API docs (2026-08): the `/multimodal-generation/
 * generation` synchronous endpoint serves qwen-image-max, qwen-image-plus,
 * qwen-image, AND the qwen-image-2.0 family (both the standard and -pro
 * tiers) — the async `/text2image/image-synthesis` submit+poll workflow is
 * ONLY for qwen-image-plus/qwen-image. So max AND the whole 2.0 generation
 * are synchronous; only the two legacy names fall through to async below.
 */
function isSynchronousModel(model: string): boolean {
  return model === 'qwen-image-max' || model.startsWith('qwen-image-max-') || model.startsWith('qwen-image-2.0');
}

export async function generateImage(input: GenerateImageInput, opts: QwenImageClientOptions): Promise<GeneratedImage> {
  const o: ResolvedOptions = {
    apiBase: opts.apiBase,
    apiKey: opts.apiKey,
    model: opts.model,
    size: opts.size,
    fetchImpl: opts.fetchImpl ?? fetch,
    sleep: opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    rand: opts.rand ?? Math.random,
    maxAttempts: opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    pollIntervalMs: opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    deadline: Date.now() + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  };

  if (isSynchronousModel(o.model)) return generateSynchronousImage(input, o);
  const taskId = await submitTask(input, o);
  const url = await pollTask(taskId, o);
  return downloadImage(url, o.fetchImpl);
}

async function generateSynchronousImage(input: GenerateImageInput, o: ResolvedOptions): Promise<GeneratedImage> {
  const body = await requestJson<SyncResponseBody>(
    `${o.apiBase}/api/v1/services/aigc/multimodal-generation/generation`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${o.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: o.model,
        input: { messages: [{ role: 'user', content: [{ text: input.prompt }] }] },
        parameters: {
          ...(input.negativePrompt ? { negative_prompt: clampNegativePrompt(input.negativePrompt) } : {}),
          prompt_extend: false,
          watermark: false,
          n: 1,
          size: o.size,
        },
      }),
    },
    o,
  );
  const url = body.output?.choices?.[0]?.message?.content?.[0]?.image;
  if (!url) {
    throw new ImageError('IMAGE_BAD_RESPONSE', `DashScope sync response had no image URL${body.message ? `: ${body.message}` : ''}`);
  }
  return downloadImage(url, o.fetchImpl);
}

async function submitTask(input: GenerateImageInput, o: ResolvedOptions): Promise<string> {
  const body = await requestJson<TaskSubmitBody>(
    `${o.apiBase}/api/v1/services/aigc/text2image/image-synthesis`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${o.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
        body: JSON.stringify({
          model: o.model,
          input: {
            prompt: input.prompt,
            ...(input.negativePrompt ? { negative_prompt: clampNegativePrompt(input.negativePrompt) } : {}),
          },
        parameters: { n: 1, size: o.size },
      }),
    },
    o,
  );
  const taskId = body.output?.task_id;
  if (!taskId) throw new ImageError('IMAGE_BAD_RESPONSE', 'DashScope submit response had no output.task_id');
  return taskId;
}

async function pollTask(taskId: string, o: ResolvedOptions): Promise<string> {
  for (;;) {
    const body = await requestJson<TaskStatusBody>(
      `${o.apiBase}/api/v1/tasks/${encodeURIComponent(taskId)}`,
      { method: 'GET', headers: { Authorization: `Bearer ${o.apiKey}` } },
      o,
    );
    const status = body.output?.task_status;

    if (status === 'SUCCEEDED') {
      const url = body.output?.results?.[0]?.url;
      if (!url) throw new ImageError('IMAGE_BAD_RESPONSE', 'DashScope SUCCEEDED task had no results[0].url');
      return url;
    }
    if (status === 'FAILED' || status === 'UNKNOWN') {
      throw new ImageError('IMAGE_PROVIDER_ERROR', `DashScope task ${status}: ${body.output?.message ?? 'no message'}`);
    }

    // PENDING / RUNNING — wait, but never sleep past the deadline.
    if (Date.now() + o.pollIntervalMs >= o.deadline) {
      throw new ImageError('IMAGE_TIMEOUT', 'picturegen timed out polling for the image task');
    }
    await o.sleep(o.pollIntervalMs);
  }
}

/** One HTTP call with 429/5xx retry (jittered backoff), bounded by maxAttempts AND the deadline. */
async function requestJson<T>(url: string, init: RequestInit, o: ResolvedOptions): Promise<T> {
  let lastError: ImageError | null = null;

  // Rate limits get extra attempts and their own longer ladder (backoff.ts):
  // quotas are per-minute, so the transient ladder alone expires inside the
  // same window that rejected the call. Everything stays bounded by o.deadline.
  const rateLimitMaxAttempts = o.maxAttempts + RATE_LIMIT_EXTRA_ATTEMPTS;

  for (let attempt = 1; attempt <= rateLimitMaxAttempts; attempt += 1) {
    if (Date.now() >= o.deadline) throw new ImageError('IMAGE_TIMEOUT', 'picturegen deadline exceeded before request');

    const controller = new AbortController();
    const perRequestMs = Math.max(1, Math.min(o.deadline - Date.now(), PER_REQUEST_CEILING_MS));
    const timer = setTimeout(() => controller.abort(), perRequestMs);
    try {
      const res = await o.fetchImpl(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        const rateLimited = isRateLimitStatus(res.status);
        const attemptLimit = rateLimited ? rateLimitMaxAttempts : o.maxAttempts;
        if (isRetryableStatus(res.status) && attempt < attemptLimit) {
          lastError = new ImageError('IMAGE_RATE_LIMITED', `DashScope responded ${res.status}`);
          // The provider's own Retry-After (already capped) always wins over our guess.
          const retryAfterMs = rateLimited ? parseRetryAfterMs(res.headers.get('retry-after')) : undefined;
          await o.sleep(computeWaitMs(attempt, { rateLimited, retryAfterMs, rand: o.rand }));
          continue;
        }
        throw new ImageError(
          isRetryableStatus(res.status) ? 'IMAGE_RATE_LIMITED' : 'IMAGE_PROVIDER_ERROR',
          `DashScope responded ${res.status}`,
        );
      }

      const body = (await res.json().catch(() => null)) as T | null;
      if (body === null) throw new ImageError('IMAGE_BAD_RESPONSE', 'DashScope returned a non-JSON body');
      return body;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ImageError) throw err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const imgErr = new ImageError(
        isAbort ? 'IMAGE_TIMEOUT' : 'IMAGE_PROVIDER_ERROR',
        isAbort ? 'DashScope request timed out' : String(err),
      );
      if (attempt < o.maxAttempts) {
        lastError = imgErr;
        await o.sleep(computeWaitMs(attempt, { rand: o.rand }));
        continue;
      }
      throw imgErr;
    }
  }

  // Unreachable in practice — the loop always returns or throws — but keeps TS happy.
  throw lastError ?? new ImageError('IMAGE_PROVIDER_ERROR', 'DashScope request failed with no error captured');
}

/** Downloads the temporary result URL DashScope returned into raw bytes + its content-type. */
export async function downloadImage(url: string, fetchImpl: typeof fetch = fetch): Promise<GeneratedImage> {
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch (err) {
    throw new ImageError('IMAGE_DOWNLOAD_FAILED', `Failed to download image: ${String(err)}`);
  }
  if (!res.ok) throw new ImageError('IMAGE_DOWNLOAD_FAILED', `Image download responded ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'image/png';
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType };
}
