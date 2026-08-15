import { Router } from 'express';
import { z } from 'zod';
import { generatePicture, type GeneratePictureDeps } from '../service/pictures.js';
import { PICTURE_PURPOSES } from '../judge/promptJudge.js';
import { ImageError } from '../gen/errors.js';

const CreatePictureBody = z.object({
  /*
   * 300, not 120: a tile label is one noun ("Limones") but a SCENE label is a
   * sentence describing the situation to draw. The old 120-char cap was set
   * when every caller sent a noun, and it is part of why scene anchors ended
   * up carrying a truncated exercise instruction instead of a real subject.
   */
  label: z.string().min(1).max(300),
  context: z.string().max(2000).optional(),
  purpose: z.enum(PICTURE_PURPOSES).default('generic'),
  /** Caller-side identity (`<course>/<lesson>`); keys SCENE caching, ignored for tiles. */
  scope: z.string().max(200).optional(),
});

export interface PicturesRouterDeps {
  generatePicture?: Partial<GeneratePictureDeps>;
}

/*
 * Which failures are worth retrying, expressed as the HTTP status the caller
 * reads. Retrying a terminal failure costs a full paid Qwen-Image generation
 * per attempt and can never succeed:
 *   IMAGE_TIMEOUT / IMAGE_RATE_LIMITED / IMAGE_PROVIDER_ERROR — upstream is
 *     briefly unhappy; the same request later may well work.  → 502
 *   IMAGE_DOWNLOAD_FAILED — the image existed but the fetch broke.  → 502
 *   IMAGE_BAD_RESPONSE / IMAGE_VERIFICATION_FAILED — the provider answered and
 *     the answer was unusable or failed the qwen-vl check. Deterministic for
 *     this prompt.  → 422
 */
const RETRYABLE_CODES = new Set(['IMAGE_TIMEOUT', 'IMAGE_RATE_LIMITED', 'IMAGE_PROVIDER_ERROR', 'IMAGE_DOWNLOAD_FAILED']);

function retryable(code: string): boolean {
  return RETRYABLE_CODES.has(code);
}

export function picturesRouter(deps: PicturesRouterDeps = {}): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const parsed = CreatePictureBody.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
    }
    try {
      const result = await generatePicture(parsed.data, deps.generatePicture);
      return res.json({ data: result, error: null });
    } catch (err) {
      // Surface the provider's typed failure code straight through the envelope
      // (e.g. IMAGE_PROVIDER_ERROR); anything else is a generic generation fault.
      const code = err instanceof ImageError ? err.code : 'IMAGE_GENERATION_FAILED';
      // Internal-only accounting signal. A request that generated then rejected
      // pixels is billable even though no URL can be returned; Forge reads this
      // header before propagating the terminal error to its budget ledger.
      res.set('x-picturegen-generated-images', String(err instanceof ImageError ? err.generatedImages : 0));
      // The STATUS is a retry instruction, not decoration: coursegen's
      // withTransportRetry retries 5xx and gives up on 4xx. Answering 502 for
      // everything made Forge re-request terminal failures — up to 12 paid
      // Qwen-Image generations per target for a result that will never differ,
      // none of them metered against the budget. Only genuinely transient
      // faults may keep the retryable status.
      return res.status(retryable(code) ? 502 : 422).json({
        data: null,
        error: { code, message: err instanceof Error ? err.message : 'Image generation failed' },
      });
    }
  });

  return router;
}
