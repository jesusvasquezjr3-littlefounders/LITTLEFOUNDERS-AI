import { Router } from 'express';
import { z } from 'zod';
import { generatePicture, type GeneratePictureDeps } from '../service/pictures.js';
import { PICTURE_PURPOSES } from '../judge/promptJudge.js';
import { ImageError } from '../gen/errors.js';

const CreatePictureBody = z.object({
  label: z.string().min(1).max(120),
  context: z.string().max(2000).optional(),
  purpose: z.enum(PICTURE_PURPOSES).default('generic'),
});

export interface PicturesRouterDeps {
  generatePicture?: Partial<GeneratePictureDeps>;
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
      return res.status(502).json({
        data: null,
        error: { code, message: err instanceof Error ? err.message : 'Image generation failed' },
      });
    }
  });

  return router;
}
