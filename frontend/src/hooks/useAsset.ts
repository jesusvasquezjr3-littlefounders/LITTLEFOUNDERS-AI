import { useState, useEffect } from 'react';
import { getImageBlobUrl } from '@/lib/assets';

/**
 * Resolves a Supabase bucket path to a session-scoped blob:// URL.
 * Returns null while loading or on error (use as fallback signal).
 */
export function useAsset(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;

    getImageBlobUrl(path)
      .then((blobUrl) => {
        if (!cancelled) setUrl(blobUrl);
      })
      .catch((err) => {
        console.error('[useAsset] Failed to load:', path, err);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}
