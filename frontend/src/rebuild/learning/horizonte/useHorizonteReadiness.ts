import { useEffect, useState } from 'react';
import { loadHorizontePacks, missingHorizontePacks, type HorizontePackId } from './contract';

/** `ready`: nothing to wait for (every document without a Horizonte segment is ready at once). `failed`: a pack did not download. */
export type HorizonteReadiness = 'ready' | 'loading' | 'failed';

/**
 * Loads the packs a raw lesson document names and re-renders its host when they arrive. A host that cannot wait calls
 * `loadHorizontePacksFor` first (the lesson route does); a failed download leaves the document to fail closed as an update.
 */
export function useHorizonteReadiness(raw: unknown): HorizonteReadiness {
  const key = missingHorizontePacks(raw).join(',');
  const [outcome, setOutcome] = useState<{ key: string; failed: boolean } | null>(null);
  useEffect(() => {
    if (key === '') return;
    let live = true;
    loadHorizontePacks(key.split(',') as HorizontePackId[]).then(
      () => { if (live) setOutcome({ key, failed: false }); },
      () => { if (live) setOutcome({ key, failed: true }); },
    );
    return () => { live = false; };
  }, [key]);
  if (key === '') return 'ready';
  return outcome?.key === key && outcome.failed ? 'failed' : 'loading';
}
