import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { renderBadgePng } from '../lib/badge.js';
import { objectPath, readMetadata, shardDir, writeMetadataAtomic, type ObjectMetadata } from '../lib/storage.js';
import { BUCKET_RE } from '../lib/validation.js';
import { getConfig } from '../config.js';

/*
 * POST /api/v1/badges — composite a shareable achievement badge PNG
 * (1080x1920) and store it content-addressed, same shape/response as
 * POST /api/v1/files (0073's badge_shares, backend "badge issuance").
 * Mounted behind the same INTERNAL_API_KEY gate as /api/v1/files (app.ts).
 *
 * Always `visibility: 'public'` — a badge exists to be linked from a
 * stranger's browser, so there is no legitimate 'internal' case, and not
 * exposing the choice removes a footgun rather than adding a branch nobody
 * should take.
 */

const BadgeBody = z.object({
  bucket: z.string().regex(BUCKET_RE, 'bucket must match [a-z0-9-]{3,40}'),
  kind: z.enum(['course_badge', 'streak']),
  label: z.string().min(1).max(80),
  firstName: z.string().min(1).max(40),
  ageBand: z.enum(['6-8', '9-11', '12-14']).optional(),
});

function buildUrl(bucket: string, hash: string, ext: string): string {
  const { PUBLIC_BASE_URL } = getConfig();
  const path = `/files/${bucket}/${hash}.${ext}`;
  return PUBLIC_BASE_URL ? new URL(path, PUBLIC_BASE_URL).toString() : path;
}

export function badgesRouter(): Router {
  const router = Router();

  router.post('/', (req: Request, res: Response, next) => {
    handleCompose(req, res).catch(next);
  });

  return router;
}

async function handleCompose(req: Request, res: Response): Promise<void> {
  const parsed = BadgeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid badge params' },
    });
    return;
  }
  const { bucket, ...badgeParams } = parsed.data;
  const ext = 'png';

  const png = await renderBadgePng(badgeParams);
  const hash = createHash('sha256').update(png).digest('hex');

  const existing = await readMetadata(bucket, hash);
  if (existing) {
    res.json({
      data: { url: buildUrl(bucket, hash, ext), bucket, hash, ext, bytes: existing.bytes, mime: existing.mime, deduplicated: true },
      error: null,
    });
    return;
  }

  const dir = shardDir(bucket, hash);
  await mkdir(dir, { recursive: true });
  await writeFile(objectPath(bucket, hash, ext), png);

  const meta: ObjectMetadata = {
    id: `${bucket}/${hash}.${ext}`,
    bucket,
    hash,
    ext,
    mime: 'image/png',
    bytes: png.byteLength,
    originalName: `badge-${badgeParams.kind}.png`,
    visibility: 'public',
    uploaderService: req.get('x-service-name') ?? 'unknown',
    createdAt: new Date().toISOString(),
  };
  await writeMetadataAtomic(bucket, hash, meta);
  res.json({
    data: { url: buildUrl(bucket, hash, ext), bucket, hash, ext, bytes: meta.bytes, mime: meta.mime, deduplicated: false },
    error: null,
  });
}
