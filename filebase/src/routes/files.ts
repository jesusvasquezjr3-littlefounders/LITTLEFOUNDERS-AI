import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer, { MulterError } from 'multer';
import { z } from 'zod';
import { getConfig } from '../config.js';
import {
  ALLOWED_MIME,
  commitObject,
  deleteObject,
  extForMime,
  hashFile,
  listBucketHashes,
  readMetadata,
  tmpDir,
  writeMetadataAtomic,
  type ObjectMetadata,
} from '../lib/storage.js';
import { asParam, BUCKET_RE, HASH_RE, isValidBucket, parseHashExt } from '../lib/validation.js';
import { unlink } from 'node:fs/promises';

/*
 * Management API — POST/GET/DELETE under /api/v1/files. Mounted behind the
 * INTERNAL_API_KEY gate in app.ts (/AGENTS.md §1.5: internal services are
 * never called directly from the browser). Public reads live in
 * routes/download.ts instead.
 */

function buildUrl(bucket: string, hash: string, ext: string): string {
  const { PUBLIC_BASE_URL } = getConfig();
  const path = `/files/${bucket}/${hash}.${ext}`;
  return PUBLIC_BASE_URL ? new URL(path, PUBLIC_BASE_URL).toString() : path;
}

function toResponse(meta: ObjectMetadata, deduplicated: boolean) {
  return {
    id: meta.id,
    url: buildUrl(meta.bucket, meta.hash, meta.ext),
    bytes: meta.bytes,
    mime: meta.mime,
    visibility: meta.visibility,
    deduplicated,
  };
}

// Lazily constructed so getConfig() is only read once env is guaranteed to
// be settled (module import time is too early in tests).
let uploadMiddleware: ReturnType<typeof multer> | null = null;
function getUpload(): ReturnType<typeof multer> {
  uploadMiddleware ??= multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        mkdir(tmpDir(), { recursive: true })
          .then(() => cb(null, tmpDir()))
          .catch((err: unknown) => cb(err as Error, tmpDir()));
      },
      filename: (_req, _file, cb) => cb(null, `${randomUUID()}.part`),
    }),
    limits: { fileSize: getConfig().FILEBASE_MAX_BYTES, files: 1 },
  });
  return uploadMiddleware;
}

const UploadFields = z.object({
  bucket: z.string().regex(BUCKET_RE, 'bucket must match [a-z0-9-]{3,40}'),
  visibility: z.enum(['public', 'internal']),
});

const ListQuery = z.object({
  bucket: z.string().regex(BUCKET_RE, 'bucket must match [a-z0-9-]{3,40}'),
  cursor: z.string().regex(HASH_RE).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

async function cleanupTmp(path: string | undefined): Promise<void> {
  if (!path) return;
  try {
    await unlink(path);
  } catch {
    // best-effort — an orphaned temp file is a non-fatal cleanup miss, not
    // worth failing the response over.
  }
}

export function filesRouter(): Router {
  const router = Router();

  // Every handler is async: dropping the promise with `void` turns any
  // rejection into an unhandled rejection, which Node 24 escalates to a
  // process exit. Forward to Express's envelope error handler instead.
  router.post('/', (req: Request, res: Response, next: NextFunction) => {
    getUpload().single('file')(req, res, (err: unknown) => {
      handleUpload(req, res, err).catch(next);
    });
  });

  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    handleList(req, res).catch(next);
  });

  router.delete('/:bucket/:file', (req: Request, res: Response, next: NextFunction) => {
    handleDelete(req, res).catch(next);
  });

  return router;
}

async function handleUpload(req: Request, res: Response, uploadErr: unknown): Promise<void> {
  if (uploadErr) {
    await cleanupTmp(req.file?.path);
    const message =
      uploadErr instanceof MulterError && uploadErr.code === 'LIMIT_FILE_SIZE'
        ? `file exceeds the ${getConfig().FILEBASE_MAX_BYTES}-byte limit`
        : uploadErr instanceof Error
          ? uploadErr.message
          : 'Upload failed';
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message } });
    return;
  }

  const parsedFields = UploadFields.safeParse(req.body);
  if (!parsedFields.success) {
    await cleanupTmp(req.file?.path);
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: parsedFields.error.issues[0]?.message ?? 'Invalid fields' },
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'A "file" is required' } });
    return;
  }

  const ext = extForMime(req.file.mimetype);
  if (!ALLOWED_MIME.has(req.file.mimetype) || !ext) {
    await cleanupTmp(req.file.path);
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: `Unsupported mime type: ${req.file.mimetype}` },
    });
    return;
  }

  const { bucket, visibility } = parsedFields.data;

  try {
    const hash = await hashFile(req.file.path);
    const existing = await readMetadata(bucket, hash);
    if (existing) {
      await cleanupTmp(req.file.path);
      res.json({ data: toResponse(existing, true), error: null });
      return;
    }

    await commitObject(req.file.path, bucket, hash, ext);
    const meta: ObjectMetadata = {
      id: `${bucket}/${hash}.${ext}`,
      bucket,
      hash,
      ext,
      mime: req.file.mimetype,
      bytes: req.file.size,
      originalName: req.file.originalname,
      visibility,
      uploaderService: req.get('x-service-name') ?? 'unknown',
      createdAt: new Date().toISOString(),
    };
    await writeMetadataAtomic(bucket, hash, meta);
    res.json({ data: toResponse(meta, false), error: null });
  } catch (err) {
    await cleanupTmp(req.file.path);
    res.status(500).json({
      data: null,
      error: { code: 'INTERNAL', message: err instanceof Error ? err.message : 'Upload failed' },
    });
  }
}

async function handleList(req: Request, res: Response): Promise<void> {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid query' },
    });
    return;
  }
  const { bucket, cursor, limit } = parsed.data;
  const hashes = await listBucketHashes(bucket);
  const filtered = cursor ? hashes.filter((h) => h > cursor) : hashes;
  const page = filtered.slice(0, limit);
  const items = (
    await Promise.all(
      page.map(async (hash) => {
        const meta = await readMetadata(bucket, hash);
        return meta ? toResponse(meta, false) : null;
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  const nextCursor = filtered.length > limit ? (page[page.length - 1] ?? null) : null;
  res.json({ data: { items, nextCursor }, error: null });
}

async function handleDelete(req: Request, res: Response): Promise<void> {
  const bucket = asParam(req.params.bucket);
  const file = asParam(req.params.file);
  if (!bucket || !file || !isValidBucket(bucket)) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid bucket or object id' } });
    return;
  }
  const parts = parseHashExt(file);
  if (!parts) {
    res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid object id' } });
    return;
  }

  const meta = await readMetadata(bucket, parts.hash);
  if (!meta || meta.ext !== parts.ext) {
    res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Object not found' } });
    return;
  }

  await deleteObject(bucket, parts.hash, parts.ext);
  res.json({ data: { deleted: true, id: meta.id }, error: null });
}
