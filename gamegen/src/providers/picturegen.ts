// Prism (picturegen/) client — the ONLY way Arcade obtains sprites and
// backgrounds. Prism owns the whole image concern: an art-director judge crafts
// the final prompt (LF visual identity), a cache guarantees an identical request
// never hits the paid image API twice, and the asset is stored in Depot. Arcade
// just asks for a picture and embeds the returned public URL into
// `skin.sprites` / `skin.background_url`.
//
// Ported from `coursegen/src/providers/picturegen.ts`.

import { getConfig } from '../env.js';
import { ProviderHttpError, ProviderNotConfiguredError, parseRetryAfter } from './errors.js';
import { withTransportRetry } from './retry.js';

/**
 * Structural role the picture plays — steers Prism's per-purpose art direction.
 *
 * VERIFIED 2026-07-30 against `picturegen/src/judge/promptJudge.ts`
 * `PICTURE_PURPOSES`: the service today accepts exactly
 * lesson_option | option_card | item_card | scene_anchor | memory_card | outcome |
 * scene | generic, and `picturegen/src/routes/pictures.ts` rejects anything else
 * with 400 VALIDATION_ERROR.
 *
 * `game_sprite` and `game_background` are the two ADDITIVE purposes GAME_ENGINE.md
 * §2 specifies for Arcade. They are NOT in Prism yet — whoever lands the Prism side
 * must add them to `PICTURE_PURPOSES` (+ PURPOSE_GUIDANCE) in the same change that
 * first uses them here. Purpose is part of Prism's cache hash, so this is
 * cache-safe: do NOT bump STYLE_VERSION.
 */
export type PicturePurpose =
  | 'game_sprite'
  | 'game_background'
  | 'item_card'
  | 'option_card'
  | 'scene_anchor'
  | 'memory_card'
  | 'outcome'
  | 'lesson_option'
  | 'scene'
  | 'generic';

export interface PictureRequest {
  /** What the image depicts — a sprite slot subject, a background scene name. */
  label: string;
  /**
   * Surrounding manifest text that grounds the subject (item label_md, concept
   * recap). §1.9: NEVER any child data — blueprint/concept context and age tier only.
   */
  context?: string;
  purpose?: PicturePurpose;
}

export interface PictureResult {
  url: string;
  fileId: string;
  /** true = served from Prism's cache — no paid generation happened, so `images: 0` in the ledger. */
  cached: boolean;
}

interface PrismEnvelope {
  data: { url: string; file_id: string; cached: boolean } | null;
  error: { code: string; message: string } | null;
}

/**
 * A 4xx from Prism is TERMINAL (picturegen/AGENTS.md): retrying it re-pays a
 * generation that can never differ. ProviderHttpError carries exactly that
 * classification — only 429/5xx are retryable.
 */
export async function requestPicture(req: PictureRequest): Promise<PictureResult> {
  const c = getConfig();
  if (!c.PICTUREGEN_URL || !c.PICTUREGEN_INTERNAL_KEY) throw new ProviderNotConfiguredError('picturegen');

  return withTransportRetry(async () => {
    // AbortSignal.timeout: image generation is slow but not unbounded. Without it
    // a half-open connection parks a pool worker indefinitely — with
    // ARCADE_CONCURRENCY workers, a long run could lose every lane and hang silently.
    const res = await fetch(`${c.PICTUREGEN_URL}/api/v1/pictures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-api-key': c.PICTUREGEN_INTERNAL_KEY as string },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(c.ARCADE_PICTUREGEN_TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => null)) as PrismEnvelope | null;
    if (!res.ok || !json?.data) {
      throw new ProviderHttpError(
        'picturegen',
        res.status,
        json?.error?.message ?? 'malformed response',
        parseRetryAfter(res.headers.get('retry-after')),
      );
    }
    return { url: json.data.url, fileId: json.data.file_id, cached: json.data.cached };
  });
}
