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

/**
 * A structurally VALID minimal GLB — real container header + one JSON chunk
 * holding the smallest legal glTF 2.0 document. Per /AGENTS.md §1.14 a fixture
 * must satisfy the real format, not merely stand in for it: random bytes with
 * a `model/gltf-binary` label would pass Depot (which is format-agnostic by
 * design) while proving nothing about what a loader would accept.
 */
export function fakeGlb(seedName = 'scene'): Buffer {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, scenes: [{ name: seedName }] }), 'utf8');
  // Every GLB chunk must be 4-byte aligned; the JSON chunk pads with spaces.
  const pad = (4 - (json.length % 4)) % 4;
  const jsonChunk = Buffer.concat([json, Buffer.alloc(pad, 0x20)]);

  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length, 8);

  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(jsonChunk.length, 0);
  chunkHeader.write('JSON', 4, 'ascii');

  return Buffer.concat([header, chunkHeader, jsonChunk]);
}
