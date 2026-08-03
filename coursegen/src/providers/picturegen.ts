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
  /** Fresh Qwen images actually created by Prism for this request. */
  generatedImages: number;
}

interface PrismEnvelope {
  data: { url: string; file_id: string; cached: boolean; generated_images: number } | null;
  error: { code: string; message: string } | null;
}

/** A terminal Prism response can still represent paid pixels that it rejected. */
export class PicturegenGenerationError extends ProviderHttpError {
  constructor(status: number, body: string, retryAfterMs: number | undefined, public readonly generatedImages: number) {
    super('picturegen', status, body, retryAfterMs);
    this.name = 'PicturegenGenerationError';
  }
}

function generatedImagesHeader(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 5 ? parsed : 0;
}

export async function requestPicture(req: PictureRequest): Promise<PictureResult> {
  const c = getConfig();
  if (!c.PICTUREGEN_URL || !c.PICTUREGEN_INTERNAL_KEY) throw new ProviderNotConfiguredError('picturegen');

  return withTransportRetry(async () => {
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
      // ProviderHttpError carries the retryable flag (429/5xx) the transport
      // retry recognizes — a transiently-down Prism is retried, a 4xx is not.
      throw new PicturegenGenerationError(
        res.status,
        json?.error?.message ?? 'malformed response',
        parseRetryAfter(res.headers.get('retry-after')),
        generatedImagesHeader(res.headers.get('x-picturegen-generated-images')),
      );
    }
    return {
      url: json.data.url,
      fileId: json.data.file_id,
      cached: json.data.cached,
      generatedImages: generatedImagesHeader(String(json.data.generated_images)),
    };
  });
}
