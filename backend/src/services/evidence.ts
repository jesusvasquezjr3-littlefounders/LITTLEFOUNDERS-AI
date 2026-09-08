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

/**
 * Confirms the buffer's own magic bytes match a real jpeg/png/webp, rather
 * than trusting the `Content-Type` multer read off the client's multipart
 * header — a value the client fully controls and can declare as anything
 * regardless of what bytes actually follow. Returns the sniffed mime, or
 * null if the signature matches none of the three formats this feature ever
 * accepts, corrupt/truncated files included.
 */
export function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

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

/**
 * Best-effort delete of a superseded evidence object — called only after the
 * caller has confirmed no other task row still points at the same
 * bucket/hash/ext (Depot is content-addressed, so an identical-bytes replay
 * could theoretically be shared; the route layer checks that first). Never
 * throws: a failed cleanup here is a storage leak, not a correctness bug —
 * the new pointer is already live either way, so this must never be allowed
 * to fail the request that just successfully attached a new photo.
 */
export async function deleteEvidence(bucket: string, hash: string, ext: string): Promise<void> {
  const { FILEBASE_URL, FILEBASE_INTERNAL_KEY } = getConfig();
  try {
    const res = await fetch(`${FILEBASE_URL}/api/v1/files/${bucket}/${hash}.${ext}`, {
      method: 'DELETE',
      headers: { 'x-internal-api-key': FILEBASE_INTERNAL_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.warn(`[evidence] cleanup failed for ${bucket}/${hash}.${ext} (status ${res.status}) — orphaned object left in Depot`);
  } catch (err) {
    console.warn(`[evidence] cleanup failed for ${bucket}/${hash}.${ext} — orphaned object left in Depot`, err);
  }
}
