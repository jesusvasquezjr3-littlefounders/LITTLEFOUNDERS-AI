// Prism (picturegen/) client — the ONLY way Forge obtains illustrations.
// Prism owns the whole image concern: an art-director judge crafts the final
// prompt (LF visual identity), a cache guarantees an identical request never
// hits the paid image API twice, and the asset is stored in Depot. Forge just
// asks for a picture and embeds the returned public URL.

import { getConfig } from '../env.js';
import { ProviderHttpError, ProviderNotConfiguredError, parseRetryAfter } from './errors.js';
import { withTransportRetry } from './retry.js';

/** Structural role the picture plays — steers Prism's per-purpose art direction. */
export type PicturePurpose =
  | 'item_card'
  | 'option_card'
  | 'scene_anchor'
  | 'memory_card'
  | 'outcome'
  | 'lesson_option'
  | 'scene'
  | 'generic';

export interface PictureRequest {
  /** What the image depicts — an option label, a card side, a scene name. */
  label: string;
  /** Surrounding lesson text that grounds the subject (prompt_md etc.). */
  context?: string;
  purpose?: PicturePurpose;
}

export interface PictureResult {
  url: string;
  fileId: string;
  /** true = served from Prism's cache — no paid generation happened. */
  cached: boolean;
  /** Fresh Qwen images actually created by Prism for this request, CUMULATIVE across transport retries. */
  generatedImages: number;
}

interface PrismEnvelope {
  data: { url: string; file_id: string; cached: boolean; generated_images?: unknown } | null;
  error: { code: string; message: string } | null;
}

/** A terminal Prism response can still represent paid pixels that it rejected. */
export class PicturegenGenerationError extends ProviderHttpError {
  constructor(
    status: number,
    body: string,
    retryAfterMs: number | undefined,
    /** Mutable: requestPicture raises it to the CUMULATIVE billed count across transport retries. */
    public generatedImages: number,
  ) {
    super('picturegen', status, body, retryAfterMs);
    this.name = 'PicturegenGenerationError';
  }
}

function generatedImagesHeader(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 5 ? parsed : 0;
}

/*
 * Billed-count carrier for terminal errors that are NOT PicturegenGenerationError.
 * A billed 502 can be retried into a raw fetch TimeoutError / network TypeError:
 * that terminal error is not our class, so re-attaching the accumulated count only
 * to PicturegenGenerationError silently discarded paid images — they never reached
 * the UsageLedger or the FORGE_MAX_USD kill switch. The count rides as a plain
 * property on the ORIGINAL error object so its class, name and message (and any
 * downstream retry/required classification) stay untouched.
 */
const BILLED_IMAGES_PROP = 'picturegenBilledImages';

function attachBilledImages(err: unknown, count: number): void {
  if (typeof err !== 'object' || err === null) return;
  try {
    (err as Record<string, unknown>)[BILLED_IMAGES_PROP] = count;
  } catch {
    // A frozen/sealed error cannot carry the count — nothing more we can do here.
  }
}

/**
 * Cumulative billed Prism images carried by ANY terminal error thrown from
 * `requestPicture` — its own PicturegenGenerationError or a foreign error
 * (timeout/network) that a billed retry chain ended in. This is the single
 * read path the pipeline's ledger catch must use.
 */
export function billedImagesFromError(err: unknown): number {
  if (err instanceof PicturegenGenerationError) return err.generatedImages;
  if (typeof err === 'object' && err !== null) {
    const value = (err as Record<string, unknown>)[BILLED_IMAGES_PROP];
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  }
  return 0;
}

/**
 * Success-path count. Version skew: a Forge deployed against a not-yet-redeployed
 * Prism receives success envelopes WITHOUT `generated_images`; `Number(undefined)`
 * collapsed that to 0 and fresh paid images ledgered as free. Only an explicit
 * in-range integer is trusted; anything else falls back to the legacy billing
 * rule (a cache hit is free, everything else billed one generation).
 */
function generatedImagesFromEnvelope(data: { cached: boolean; generated_images?: unknown }): number {
  const value = data.generated_images;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5) return value;
  return data.cached ? 0 : 1;
}

export async function requestPicture(req: PictureRequest): Promise<PictureResult> {
  const c = getConfig();
  if (!c.PICTUREGEN_URL || !c.PICTUREGEN_INTERNAL_KEY) throw new ProviderNotConfiguredError('picturegen');

  /*
   * Billable pixels must survive transport retries. Prism deliberately 502s
   * IMAGE_TIMEOUT / IMAGE_RATE_LIMITED / IMAGE_PROVIDER_ERROR /
   * IMAGE_DOWNLOAD_FAILED — retryable statuses whose responses CAN carry
   * generated (i.e. billed) images — and withTransportRetry discards the error
   * object of every non-final attempt. Accumulate here so the caller ledgers
   * real spend: on success the retried attempts' count is added to the final
   * result; on a terminal error the error's own count is raised to the total.
   */
  let generatedOnFailedAttempts = 0;
  try {
    const result = await withTransportRetry(async () => {
      // AbortSignal.timeout: image generation is slow but not unbounded. Without it
      // a half-open connection parked a pool worker indefinitely — with
      // FORGE_CONCURRENCY workers, a long run could lose every lane and hang silently.
      const res = await fetch(`${c.PICTUREGEN_URL}/api/v1/pictures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': c.PICTUREGEN_INTERNAL_KEY as string },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(c.FORGE_PICTUREGEN_TIMEOUT_MS),
      });
      const json = (await res.json().catch(() => null)) as PrismEnvelope | null;
      if (!res.ok || !json?.data) {
        const generatedThisAttempt = generatedImagesHeader(res.headers.get('x-picturegen-generated-images'));
        generatedOnFailedAttempts += generatedThisAttempt;
        // ProviderHttpError carries the retryable flag (429/5xx) the transport
        // retry recognizes — a transiently-down Prism is retried, a 4xx is not.
        throw new PicturegenGenerationError(
          res.status,
          json?.error?.message ?? 'malformed response',
          parseRetryAfter(res.headers.get('retry-after')),
          generatedThisAttempt,
        );
      }
      return {
        url: json.data.url,
        fileId: json.data.file_id,
        cached: json.data.cached,
        generatedImages: generatedImagesFromEnvelope(json.data),
      };
    });
    return { ...result, generatedImages: result.generatedImages + generatedOnFailedAttempts };
  } catch (err) {
    // generatedOnFailedAttempts already includes the final attempt's own count.
    if (err instanceof PicturegenGenerationError) {
      err.generatedImages = generatedOnFailedAttempts;
    } else if (generatedOnFailedAttempts > 0) {
      // The terminal error is foreign (fetch TimeoutError, network TypeError, …)
      // but earlier billed attempts already happened — the count must survive it.
      attachBilledImages(err, generatedOnFailedAttempts);
    }
    throw err;
  }
}

export type PrismStyleProbe = { styleVersion: string } | { unavailable: string };

/**
 * Reads the illustration style version Prism advertises on GET /health (the
 * `STYLE_VERSION+OBJECT_TILE_STYLE_VERSION` composite). Free and read-only, so
 * it is safe as a run preflight — but callers must still skip it in dry-run,
 * which stays fully offline by contract. `unavailable` (instead of a version
 * string) keeps "Prism did not answer" distinguishable from a real mismatch
 * (§1.14: failure must be distinguishable from emptiness).
 */
export async function fetchPrismStyleVersion(): Promise<PrismStyleProbe> {
  const c = getConfig();
  if (!c.PICTUREGEN_URL) return { unavailable: 'Prism (PICTUREGEN_URL) is not configured' };
  try {
    // /health answers in milliseconds; a short fixed timeout keeps preflight snappy.
    const res = await fetch(`${c.PICTUREGEN_URL}/health`, { signal: AbortSignal.timeout(10_000) });
    const json = (await res.json().catch(() => null)) as { data?: { style_version?: unknown } | null } | null;
    if (!res.ok) return { unavailable: `Prism /health returned HTTP ${res.status}` };
    const styleVersion = json?.data?.style_version;
    if (typeof styleVersion !== 'string' || styleVersion.length === 0) {
      return { unavailable: 'Prism /health reports no style_version (deployment predates the handshake?)' };
    }
    return { styleVersion };
  } catch (err) {
    return { unavailable: `Prism /health unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }
}
