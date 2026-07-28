import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, LoadingOverlay } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';

/*
 * /family — the parent dashboard's front door (parent-role gated in App.tsx;
 * navConfig renders it LOCKED for everyone else). Lists the caller's VERIFIED
 * kids (Core re-checks guardian_links on every request) and opens each kid's
 * territory. Parent visibility is a product invariant (§1.9) — this is that
 * invariant becoming a surface.
 */

interface Kid {
  userId: string;
  displayName: string | null;
  username: string | null;
}

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; kids: Kid[] };

export function FamilyPage() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      const { data, error } = await api<{ kids: Kid[] }>('/family/kids', { token });
      if (cancelled) return;
      setState(error ? { status: 'error', code: error.code } : { status: 'ready', kids: data.kids });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  if (state.status === 'loading') return <LoadingOverlay label={t('family.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-6">
      <header>
        <h1 className="lf-display text-content">{t('family.title')}</h1>
        <p className="lf-body text-content-muted">{t('family.subtitle')}</p>
      </header>

      {state.kids.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Icon name="family_restroom" className="text-[40px] text-content-faint" aria-hidden />
          <h2 className="lf-title text-content">{t('family.emptyTitle')}</h2>
          <p className="lf-body max-w-md text-content-muted">{t('family.emptyBody')}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {state.kids.map((kid) => (
            <li key={kid.userId}>
              <Link
                to={`/family/${kid.userId}/territory`}
                className="flex min-h-14 items-center gap-4 rounded-lg border border-outline/70 bg-surface px-4 py-3 shadow-glass-sm transition-[border-color,transform] duration-150 hover:border-primary/60 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft lf-title font-bold text-primary">
                  {(kid.displayName ?? kid.username ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="lf-label block truncate text-content">{kid.displayName ?? kid.username}</span>
                  {kid.username ? <span className="lf-caption text-content-faint">@{kid.username}</span> : null}
                </span>
                <span className="lf-caption flex shrink-0 items-center gap-1 font-bold text-primary">
                  <Icon name="map" className="text-[18px]" aria-hidden />
                  {t('family.viewTerritory')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FamilyPage;
