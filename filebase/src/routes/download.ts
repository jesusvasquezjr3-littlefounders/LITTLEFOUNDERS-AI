import crypto from 'crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Router, type Request, type Response } from 'express';
import { getConfig } from '../config.js';
import { objectPath, readMetadata } from '../lib/storage.js';
import { asParam, isValidBucket, parseHashExt } from '../lib/validation.js';

/*
 * Public streaming download — GET/HEAD /files/:bucket/:hash.:ext.
 *
 * This is the documented exception to the envelope rule (/AGENTS.md §1.6):
 * a 200/206 success response streams raw object bytes with binary headers,
 * because it has to work as the `src` of an <audio>/<img> tag. Every ERROR
 * status from this route still uses the standard `{ data, error }` envelope
 * — only the successful payload is non-JSON.
 *
 * `visibility: 'internal'` objects require the same INTERNAL_API_KEY header
 * as the management API; `public` objects are world-readable by design
 * (lesson audio/images carry no PII — /AGENTS.md §1.9).
 */

/**
 * Stream a file to the client without ever being able to kill the process.
 *
 * `createReadStream(...).pipe(res)` on its own is a liveness bug: the stat()
 * above only proves the file existed a moment ago, so any later open/read
 * failure (deleted mid-request, EACCES, EIO on the Railway volume) emits
 * 'error' on a stream with NO listener — an uncaught exception that takes
 * Depot down for every learner, not just this request.
 *
 * Also destroys the source when the client disconnects mid-stream (a paused
 * lesson audio, a closed tab), which otherwise leaks an open fd per abort.
 */
function streamFile(path: string, res: Response, opts?: { start: number; end: number }): void {
  const rs = opts ? createReadStream(path, opts) : createReadStream(path);
  rs.on('error', () => {
    if (res.headersSent) {
      // Bytes already went out; the only honest move is to cut the response
      // so the client sees a truncated transfer rather than a silent success.
      res.destroy();
    } else {
      notFound(res);
    }
  });
  res.on('close', () => rs.destroy());
  rs.pipe(res);
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message } });
}

function notFound(res: Response): void {
  res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Object not found' } });
}

function unauthorized(res: Response): void {
  res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid internal API key' } });
}

async function serve(req: Request, res: Response, sendBody: boolean): Promise<void> {
  const bucket = asParam(req.params.bucket);
  const file = asParam(req.params.file);
  if (!bucket || !file || !isValidBucket(bucket)) return badRequest(res, 'Invalid bucket or object id');

  const parts = parseHashExt(file);
  if (!parts) return badRequest(res, 'Invalid object id');

  const meta = await readMetadata(bucket, parts.hash);
  if (!meta || meta.ext !== parts.ext) return notFound(res);

  if (meta.visibility === 'internal') {
    const config = getConfig();
    const provided = req.get('x-internal-api-key') ?? '';
    const expected = config.INTERNAL_API_KEY;
    if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(provided).digest(), crypto.createHash('sha256').update(expected).digest())) {
      return unauthorized(res);
    }
  }

  const path = objectPath(bucket, parts.hash, parts.ext);
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    // Metadata exists but the blob is missing — an inconsistent store, not
    // a client error. Still surfaced as NOT_FOUND: there is nothing to serve.
    return notFound(res);
  }

  // Note: Content-Type is deliberately NOT set yet. `res.json()` only sets
  // it when it isn't already present, so setting it to `meta.mime` up front
  // would silently break the 416 JSON error response below (the client
  // would receive a JSON body labeled as audio/image). It's set just
  // before each success response instead.
  const etag = `"${meta.hash}"`;
  res.set('ETag', etag);
  res.set('Accept-Ranges', 'bytes');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');

  if (req.get('if-none-match') === etag) {
    res.status(304).end();
    return;
  }

  const range = req.get('range');
  if (range) {
    const match = /^bytes=(\d+)?-(\d+)?$/.exec(range);
    let rangeStart: number;
    let rangeEnd: number;

    if (match && match[1] !== undefined) {
      // "bytes=start-" or "bytes=start-end"
      rangeStart = Number(match[1]);
      rangeEnd = match[2] !== undefined ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else if (match && match[2] !== undefined) {
      // "bytes=-suffixLength" → the last N bytes.
      const suffixLength = Number(match[2]);
      rangeStart = Math.max(size - suffixLength, 0);
      rangeEnd = size - 1;
    } else {
      rangeStart = NaN;
      rangeEnd = NaN;
    }

    if (!match || Number.isNaN(rangeStart) || rangeStart >= size || rangeStart > rangeEnd) {
      res.set('Content-Range', `bytes */${size}`);
      res.status(416).json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Range not satisfiable' } });
      return;
    }

    res.status(206);
    res.set('Content-Type', meta.mime);
    res.set('Content-Range', `bytes ${rangeStart}-${rangeEnd}/${size}`);
    res.set('Content-Length', String(rangeEnd - rangeStart + 1));
    if (!sendBody) {
      res.end();
      return;
    }
    streamFile(path, res, { start: rangeStart, end: rangeEnd });
    return;
  }

  res.set('Content-Type', meta.mime);
  res.set('Content-Length', String(size));
  if (!sendBody) {
    res.end();
    return;
  }
  streamFile(path, res);
}

export function downloadRouter(): Router {
  const router = Router();
  // `void serve(...)` would drop the promise: any rejection inside this async
  // handler becomes an unhandled rejection, which Node 24 turns into a process
  // exit by default — one malformed request could take Depot down. Forward it
  // to Express's error handler instead.
  router.get('/:bucket/:file', (req, res, next) => {
    serve(req, res, true).catch(next);
  });
  router.head('/:bucket/:file', (req, res, next) => {
    serve(req, res, false).catch(next);
  });
  return router;
}
