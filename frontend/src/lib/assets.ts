import { supabase } from './supabase';

const BUCKET = 'game-assets';
const TTL_SECONDS = 3600; // 1 hour

// ─── Signed URL cache (path → { url, expiresAt }) ────────────────────────────
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getSignedUrl(path: string): Promise<string> {
  const now = Date.now();
  const cached = signedUrlCache.get(path);
  // Return cached URL if it won't expire in the next 60 seconds
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw error ?? new Error(`Failed to sign asset: ${path}`);
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: now + TTL_SECONDS * 1000,
  });

  return data.signedUrl;
}

// ─── Blob URL cache (path → blob:// URL) ─────────────────────────────────────
// Blob URLs are session-scoped and don't expose the Supabase path in the DOM.
const blobCache = new Map<string, string>();

export async function getImageBlobUrl(path: string): Promise<string> {
  const cached = blobCache.get(path);
  if (cached) return cached;

  const signedUrl = await getSignedUrl(path);
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Failed to fetch asset: ${path} (${res.status})`);

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  blobCache.set(path, blobUrl);
  return blobUrl;
}

/**
 * Resolves an audio path to a playable URL.
 * Local files (starting with /) or full URLs are returned as-is.
 * Supabase bucket paths are resolved to a signed URL.
 */
export async function resolveAudioSrc(path: string): Promise<string> {
  if (!path) return path;
  if (path.startsWith('/') || path.startsWith('http') || path.startsWith('blob:')) {
    return path;
  }
  return getSignedUrl(path);
}
