import { supabase } from './supabase';
import { API_URL } from '@/config/api';

const BUCKET = 'game-assets';
const TTL_SECONDS = 3600; // 1 hour

// ─── Signed URL cache (path → { url, expiresAt, isPublic }) ─────────────────
const signedUrlCache = new Map<string, { url: string; expiresAt: number; isPublic?: boolean }>();

/** Get a signed URL for a game asset.
 *  For authenticated users: uses Supabase JS client directly.
 *  For guests (no token): falls back to the backend proxy endpoint which uses service_role.
 *  Last resort: public bucket URL (game-assets is public).
 */
export async function getSignedUrl(path: string): Promise<string> {
  const now = Date.now();
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.url;
  }

  // Try Supabase signed URL (works for both authenticated users and anon — RLS allows anon reads)
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL_SECONDS);

  if (!error && data?.signedUrl) {
    signedUrlCache.set(path, { url: data.signedUrl, expiresAt: now + TTL_SECONDS * 1000 });
    return data.signedUrl;
  }

  // Fallback: backend proxy (when Supabase client fails)
  try {
    const res = await fetch(`${API_URL}/assets/signed-url?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      const json = await res.json() as { url: string; expires_in: number };
      signedUrlCache.set(path, { url: json.url, expiresAt: now + (json.expires_in ?? TTL_SECONDS) * 1000 });
      return json.url;
    }
  } catch {
    // proxy unavailable — fall through
  }

  // Public bucket fallback — use the real Supabase project URL (not the custom auth domain)
  const storageBase = import.meta.env.VITE_SUPABASE_STORAGE_URL || import.meta.env.VITE_SUPABASE_URL;
  const publicUrl = `${storageBase}/storage/v1/object/public/${BUCKET}/${path}`;
  signedUrlCache.set(path, { url: publicUrl, expiresAt: now + TTL_SECONDS * 1000, isPublic: true });
  return publicUrl;
}

// ─── Blob URL cache (path → blob:// URL) ─────────────────────────────────────
// Blob URLs are session-scoped and don't expose the Supabase path in the DOM.
const blobCache = new Map<string, string>();

export async function getImageBlobUrl(path: string): Promise<string> {
  const cached = blobCache.get(path);
  if (cached) return cached;

  const signedUrl = await getSignedUrl(path);

  // Public URLs don't need blob conversion — use them directly
  const cacheEntry = signedUrlCache.get(path);
  if (cacheEntry?.isPublic) {
    blobCache.set(path, signedUrl);
    return signedUrl;
  }

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
