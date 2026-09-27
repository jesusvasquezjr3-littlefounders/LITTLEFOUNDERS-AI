import { useCallback, useEffect, useState } from 'react';
import { fetchEnabledProviders, startOAuth } from '@/auth/oauth';
import type { GoogleState } from '@/rebuild/identity/authBlocks';

/*
 * Google sign-in for the rebuilt A1/A2 screens (W2S.2). The button appears only
 * once Core reports the provider enabled, so enabling Google stays a backend
 * step. A start that cannot reach Core's authorize URL re-enables the button
 * and says so (the legacy button re-enabled silently). What happens after the
 * provider returns is /auth/callback and the mandatory age screen (A.3).
 */
export function useGoogleSignIn(): GoogleState {
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetchEnabledProviders().then((providers) => { if (alive) setAvailable(providers.includes('google')); });
    return () => { alive = false; };
  }, []);
  const onStart = useCallback(() => {
    setPending(true);
    setFailed(false);
    void startOAuth('google').then((result) => {
      // On success the browser is leaving for the provider; the button stays busy until it does.
      if (result.error) { setPending(false); setFailed(true); }
    });
  }, []);
  return { available, pending, failed, onStart };
}
