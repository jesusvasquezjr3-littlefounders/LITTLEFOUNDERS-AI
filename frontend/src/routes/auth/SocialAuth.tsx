import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchEnabledProviders, startOAuth, type OAuthProvider } from '@/auth/oauth';

/* Google's official 4-colour "G" brandmark (inline so it needs no network / theme). */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/*
 * Social sign-in options + an "or" divider above the email form. Renders nothing
 * until a provider is enabled server-side, so enabling Google is a pure backend
 * step (add credentials → the button appears) with no frontend change needed.
 */
export function SocialAuth() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchEnabledProviders().then((p) => {
      if (alive) setProviders(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!providers.includes('google')) return null;

  return (
    <div className="mb-5 flex flex-col gap-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void startOAuth('google').then((r) => {
            if (r.error) setBusy(false); // redirect failed → re-enable
          });
        }}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-outline bg-surface lf-label text-content transition-colors duration-150 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon />
        {t('auth.social.continueWithGoogle')}
      </button>
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-outline" />
        <span className="lf-caption uppercase tracking-wide text-content-faint">{t('auth.social.or')}</span>
        <span className="h-px flex-1 bg-outline" />
      </div>
    </div>
  );
}
