import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { renderBadgePng } from '../lib/badge.js';

/*
 * Achievement images (OD-20, 24 September 2026; Product 10 F.1).
 *
 * POST /api/v1/badges/render renders an achievement PNG (1080x1920) and
 * returns the BYTES in the response. Nothing is written to storage: the
 * image has no Depot object, no content-addressed URL and no metadata row,
 * so there is nothing a stranger could open and nothing a messaging app
 * could fetch for a link preview. Core hands the bytes to the verified
 * guardian who asked, and that parent sends the picture themselves.
 * Mounted behind the same INTERNAL_API_KEY gate as /api/v1/files (app.ts):
 * only Core calls it, never a browser.
 *
 * POST /api/v1/badges (the pre-OD-20 compose-and-store endpoint) is retired.
 * It stored every badge as a world-readable object behind a public share
 * link. It now answers 410 and writes nothing, so even an older Core that
 * still calls it cannot mint a new public image (fail closed). Legacy
 * images issued before the cutover are removed through the ordinary
 * DELETE /api/v1/files/:bucket/:file path when their link is revoked or
 * expires (Core's F.2 purge and sweep).
 */

// F.6 standing constraint: first name, server-derived label, kind and the
// image's own language — nothing else. `.strict()` refuses an age band, a
// surname, a photo reference or any other extra field instead of ignoring it.
const RenderBody = z
  .object({
    kind: z.enum(['course_badge', 'streak', 'goal_reached']),
    label: z.string().min(1).max(80),
    firstName: z.string().min(1).max(40),
    locale: z.enum(['en-US', 'es-MX', 'pt-BR']),
  })
  .strict();

export function badgesRouter(): Router {
  const router = Router();

  router.post('/', (_req: Request, res: Response) => {
    res.status(410).json({
      data: null,
      error: { code: 'GONE', message: 'Stored badge images are retired (OD-20); render the image instead' },
    });
  });

  router.post('/render', (req: Request, res: Response, next) => {
    handleRender(req, res).catch(next);
  });

  return router;
}

async function handleRender(req: Request, res: Response): Promise<void> {
  const parsed = RenderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid badge params' },
    });
    return;
  }

  const png = await renderBadgePng(parsed.data);
  res
    .status(200)
    .set({
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
      // A per-child image: no shared cache, proxy or browser cache may keep it.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    .end(png);
}
