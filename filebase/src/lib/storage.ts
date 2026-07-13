import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfig } from '../config.js';

/*
 * Content-addressed object store — no database, no S3 SDK (/AGENTS.md §1.2:
 * this service keeps deps minimal on purpose). Layout:
 *
 *   <FILEBASE_ROOT>/<bucket>/<sha256[0:2]>/<sha256>.<ext>      the object bytes
 *   <FILEBASE_ROOT>/<bucket>/<sha256[0:2]>/<sha256>.json       metadata sidecar
 *
 * Dedup key is the hash ALONE (per bucket) — the metadata sidecar is looked
 * up by hash before the extension is ever needed, so identical bytes always
 * resolve to the same object regardless of which mimetype triggered the
 * upload. Objects are immutable once written: a second upload of the same
 * bytes never rewrites the file, it just reports `deduplicated: true`.
 */

export const MIME_EXT: Readonly<Record<string, string>> = Object.freeze({
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/json': 'json',
});

export const ALLOWED_MIME: ReadonlySet<string> = new Set(Object.keys(MIME_EXT));

export function extForMime(mime: string): string | undefined {
  return MIME_EXT[mime];
}

export type Visibility = 'public' | 'internal';

export interface ObjectMetadata {
  id: string;
  bucket: string;
  hash: string;
  ext: string;
  mime: string;
  bytes: number;
  originalName: string;
  visibility: Visibility;
  uploaderService: string;
  createdAt: string;
}

function root(): string {
  return getConfig().FILEBASE_ROOT;
}

function shard(hash: string): string {
  return hash.slice(0, 2);
}

export function tmpDir(): string {
  return join(root(), '.tmp');
}

export function shardDir(bucket: string, hash: string): string {
  return join(root(), bucket, shard(hash));
}

export function bucketDir(bucket: string): string {
  return join(root(), bucket);
}

export function objectPath(bucket: string, hash: string, ext: string): string {
  return join(shardDir(bucket, hash), `${hash}.${ext}`);
}

export function metaPath(bucket: string, hash: string): string {
  return join(shardDir(bucket, hash), `${hash}.json`);
}

function isEnoent(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as NodeJS.ErrnoException).code === 'ENOENT';
}

export async function ensureTmpDir(): Promise<string> {
  const dir = tmpDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

export function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export async function readMetadata(bucket: string, hash: string): Promise<ObjectMetadata | null> {
  try {
    const raw = await readFile(metaPath(bucket, hash), 'utf8');
    return JSON.parse(raw) as ObjectMetadata;
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

/** Atomic write-then-rename so a reader never observes a half-written sidecar. */
export async function writeMetadataAtomic(bucket: string, hash: string, meta: ObjectMetadata): Promise<void> {
  const dir = shardDir(bucket, hash);
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `.${hash}-${process.pid}-${Date.now()}.tmp`);
  await writeFile(tmp, JSON.stringify(meta, null, 2), 'utf8');
  await rename(tmp, metaPath(bucket, hash));
}

/** Moves a completed temp upload into its final content-addressed location. */
export async function commitObject(tmpPath: string, bucket: string, hash: string, ext: string): Promise<void> {
  const dir = shardDir(bucket, hash);
  await mkdir(dir, { recursive: true });
  const dest = objectPath(bucket, hash, ext);
  try {
    await rename(tmpPath, dest);
  } catch (err) {
    // EXDEV: temp dir and storage root are on different filesystems/volumes
    // (plausible on Railway volume mounts) — fall back to copy+unlink.
    if (typeof err === 'object' && err !== null && (err as NodeJS.ErrnoException).code === 'EXDEV') {
      await copyFile(tmpPath, dest);
      await rm(tmpPath, { force: true });
    } else {
      throw err;
    }
  }
}

export async function objectSize(bucket: string, hash: string, ext: string): Promise<number> {
  const s = await stat(objectPath(bucket, hash, ext));
  return s.size;
}

export async function deleteObject(bucket: string, hash: string, ext: string): Promise<void> {
  await rm(objectPath(bucket, hash, ext), { force: true });
  await rm(metaPath(bucket, hash), { force: true });
}

/** Lexicographically sorted (fixed-width hex, so sort order is stable). */
export async function listBucketHashes(bucket: string): Promise<string[]> {
  let shards: string[];
  try {
    shards = await readdir(bucketDir(bucket));
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }
  const hashes: string[] = [];
  for (const shardName of shards) {
    if (shardName === '.tmp') continue;
    let files: string[];
    try {
      files = await readdir(join(bucketDir(bucket), shardName));
    } catch (err) {
      if (isEnoent(err)) continue;
      throw err;
    }
    for (const f of files) {
      if (f.endsWith('.json') && !f.startsWith('.')) hashes.push(f.slice(0, -'.json'.length));
    }
  }
  hashes.sort();
  return hashes;
}
