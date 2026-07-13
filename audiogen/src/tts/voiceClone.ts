import { computeBackoffMs, isRetryableStatus } from './backoff.js';
import { TtsError } from './errors.js';

export interface RegisterVoiceInput {
  /** Reference audio, base64-encoded (no data: prefix). */
  audioBase64: string;
  /** e.g. 'audio/wav'. */
  mimeType: string;
  /** DashScope voice identifier — kebab/underscore, provider constraints unconfirmed; keep it short and simple. */
  preferredName: string;
}

export interface VoiceCloneClientOptions {
  apiUrl: string;
  apiKey: string;
  /** The synthesis model this voice will be bound to (COURSE_ENGINE.md §7 — a cloned voice can ONLY be used with the exact model it was enrolled under). */
  targetModel: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  rand?: () => number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 4;

/*
 * DashScope voice-clone ENROLLMENT ("qwen-voice-enrollment", action=create).
 * Confirmed against https://www.alibabacloud.com/help/en/model-studio/qwen-tts-voice-cloning
 * (2026-07-13) — NOT independently verified against a live call, so the
 * response is parsed defensively (a few plausible field-name variants) and
 * every failure surfaces the raw status/body via TtsError for debugging.
 * Retries ONLY on 429/5xx, same jittered-backoff policy as synthesizeSpeech.
 */
export async function registerVoice(input: RegisterVoiceInput, opts: VoiceCloneClientOptions): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: TtsError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
          model: 'qwen-voice-enrollment',
          input: {
            action: 'create',
            target_model: opts.targetModel,
            preferred_name: input.preferredName,
            audio: { data: `data:${input.mimeType};base64,${input.audioBase64}` },
          },
        }),
      });
      clearTimeout(timer);

      if (!res.ok) {
        const bodyText = await safeText(res);
        if (isRetryableStatus(res.status) && attempt < maxAttempts) {
          lastError = new TtsError('VOICE_CLONE_PROVIDER_ERROR', `DashScope enrollment responded ${res.status}: ${bodyText.slice(0, 300)}`);
          await sleep(computeBackoffMs(attempt, opts.rand));
          continue;
        }
        throw new TtsError('VOICE_CLONE_PROVIDER_ERROR', `DashScope enrollment responded ${res.status}: ${bodyText.slice(0, 300)}`);
      }

      const body = (await res.json()) as unknown;
      const voiceId = extractVoiceId(body);
      if (!voiceId) {
        throw new TtsError(
          'VOICE_CLONE_BAD_RESPONSE',
          `DashScope enrollment response had no recognizable voice id field: ${JSON.stringify(body).slice(0, 300)}`,
        );
      }
      return voiceId;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof TtsError) throw err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const ttsErr = new TtsError(
        'VOICE_CLONE_PROVIDER_ERROR',
        isAbort ? 'DashScope enrollment request timed out' : String(err),
      );
      if (attempt < maxAttempts) {
        lastError = ttsErr;
        await sleep(computeBackoffMs(attempt, opts.rand));
        continue;
      }
      throw ttsErr;
    }
  }

  throw lastError ?? new TtsError('VOICE_CLONE_PROVIDER_ERROR', 'DashScope enrollment failed with no error captured');
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/** Defensive extraction — the exact response schema wasn't independently verified; try every plausible shape. */
function extractVoiceId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const root = body as Record<string, unknown>;

  const direct = root.voice;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  const output = root.output;
  if (typeof output === 'object' && output !== null) {
    const o = output as Record<string, unknown>;
    if (typeof o.voice === 'string' && o.voice.length > 0) return o.voice;
    if (typeof o.voice_id === 'string' && o.voice_id.length > 0) return o.voice_id;
  }
  return null;
}
