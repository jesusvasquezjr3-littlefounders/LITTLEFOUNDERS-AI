import request from 'supertest';
import type { Express } from 'express';

export const KEY = () => process.env.INTERNAL_API_KEY as string;

export function upload(
  app: Express,
  opts: { bucket: string; visibility?: 'public' | 'internal'; mime: string; bytes: Buffer; filename?: string },
) {
  const req = request(app).post('/api/v1/files').set('x-internal-api-key', KEY());
  req.field('bucket', opts.bucket);
  req.field('visibility', opts.visibility ?? 'public');
  req.attach('file', opts.bytes, { filename: opts.filename ?? 'asset.bin', contentType: opts.mime });
  return req;
}

/** Deterministic pseudo-random bytes — big enough for meaningful Range slices. */
export function fakeAudio(size = 2048, seed = 7): Buffer {
  const buf = Buffer.alloc(size);
  for (let i = 0; i < size; i++) buf[i] = (i * seed + 13) % 256;
  return buf;
}
