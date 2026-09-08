import { getConfig } from '../config.js';

/*
 * Task evidence photos (0077, FAMILY_HUB.md) — the same "Core decides,
 * Depot stores" split badges.ts already uses, with one difference: a badge
 * is server-composited and always public; a photo of a kid's room or
 * homework is a KID-UPLOADED image and NEVER public (§1.9 — a materially
 * different privacy class). It is stored `visibility: internal` and only
 * ever reaches a browser through fetchEvidenceBytes below, never a raw
 * Depot URL — mirrors verification.ts's "forward the buffer, never persist
 * it ourselves beyond the pointer" shape for the Guardian ID photo.
 */

const EVIDENCE_BUCKET = 'task-evidence';
const MIME_EXT: Readonly<Record<string, string>> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const EVIDENCE_ALLOWED_MIME = new Set(Object.keys(MIME_EXT));

export interface UploadedEvidence {
  bucket: string;
  hash: string;
  ext: string;
}

/** Uploads the buffer to Depot's internal-only bucket. Returns null on ANY failure — the caller must refuse, never invent a pointer to bytes that were never stored (§1.14). */
export async function uploadEvidence(buffer: Buffer, mime: string): Promise<UploadedEvidence | null> {
  const ext = MIME_EXT[mime];
  if (!ext) return null;
  const { FILEBASE_URL, FILEBASE_INTERNAL_KEY } = getConfig();
  const form = new FormData();
  form.set('bucket', EVIDENCE_BUCKET);
  form.set('visibility', 'internal');
  form.set('file', new Blob([new Uint8Array(buffer)], { type: mime }), `evidence.${ext}`);
  try {
    const res = await fetch(`${FILEBASE_URL}/api/v1/files`, {
      method: 'POST',
      headers: { 'x-internal-api-key': FILEBASE_INTERNAL_KEY, 'x-service-name': 'backend' },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: { bucket: string; url: string } | null };
    if (!body.data) return null;
    // The route returns `url` (a /files/:bucket/:hash.:ext path) and `bucket`,
    // not hash/ext split out -- parsed here rather than adding a second shape
    // filebase would have to keep in sync with this one caller.
    const match = /\/files\/([^/]+)\/([0-9a-f]+)\.([a-z0-9]+)$/.exec(body.data.url);
    const [, bucket, hash, matchedExt] = match ?? [];
    if (!bucket || !hash || !matchedExt) return null;
    return { bucket, hash, ext: matchedExt };
  } catch {
    return null;
  }
}

export interface EvidenceBytes {
  buffer: Buffer;
  mime: string;
}

const EXT_MIME: Readonly<Record<string, string>> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Streams an internal-visibility object back from Depot. Returns null on any failure (not found, transport, unreadable) -- the route layer turns that into a 404/502, never a guessed placeholder. */
export async function fetchEvidenceBytes(bucket: string, hash: string, ext: string): Promise<EvidenceBytes | null> {
  const { FILEBASE_URL, FILEBASE_INTERNAL_KEY } = getConfig();
  try {
    const res = await fetch(`${FILEBASE_URL}/files/${bucket}/${hash}.${ext}`, {
      headers: { 'x-internal-api-key': FILEBASE_INTERNAL_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, mime: EXT_MIME[ext] ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}
