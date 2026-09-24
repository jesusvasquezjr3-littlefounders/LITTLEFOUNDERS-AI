import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Card, Icon, LoadingOverlay } from '@/components/ui';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { VoiceConsentControl } from '@/tutor/VoiceConsentControl';
import { AddKidCard, type CreatedKid } from './AddKidCard';
import { BadgeSharesPanel } from './BadgeSharesPanel';
import { GuardianInviteJoin, GuardianInvitePanel } from './GuardianInvitePanel';
import { ManageKidPanel } from './ManageKidPanel';
import { SocialGraphPanel } from './SocialGraphPanel';
import { SocialHistoryPanel } from './SocialHistoryPanel';
import { SocialNoticesPanel } from './SocialNoticesPanel';
import { SocialRequestsPanel } from './SocialRequestsPanel';

/*
 * /family — the parent dashboard's front door (parent-role gated in App.tsx;
 * navConfig renders it LOCKED for everyone else). Lists the caller's VERIFIED
 * kids (Core re-checks guardian_links on every request) and opens each kid's
 * territory. Parent visibility is a product invariant (§1.9) — this is that
 * invariant becoming a surface.
 *
 * The usage-insights toggle per kid is the §1.9 parental consent gate made
 * visible (/INSIGHTS.md): OFF means the kid's browser transmits no usage
 * events at all and Core drops anything that slips through. Granting and
 * revoking are both re-guarded server-side by the verified guardian link.
 */

interface Kid {
  userId: string;
  displayName: string | null;
  username: string | null;
  analyticsConsent: boolean;
  pendingApprovalCount: number;
  walletTotal: number | null;
  taskStreakDays: number;
}

type LoadState = { status: 'loading' } | { status: 'error'; code: string } | { status: 'ready'; kids: Kid[] };

export function FamilyPage() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const joinToken = searchParams.get('join');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [busyKid, setBusyKid] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      setToken(token);
      const { data, error } = await api<{ kids: Kid[] }>('/family/kids', { token });
      if (cancelled) return;
      setState(error ? { status: 'error', code: error.code } : { status: 'ready', kids: data.kids });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function toggleConsent(kid: Kid) {
    if (state.status !== 'ready' || busyKid) return;
    setConsentError(null);
    setBusyKid(kid.userId);
    const token = await getToken();
    const { data, error } = await api<{ kidId: string; analyticsConsent: boolean }>(
      `/family/kids/${kid.userId}/analytics-consent`,
      { method: kid.analyticsConsent ? 'DELETE' : 'POST', token },
    );
    setBusyKid(null);
    if (error || !data) {
      setConsentError(error?.code ?? 'INTERNAL');
      return; // Keep the server-confirmed consent state visible.
    }
    setState((prev) =>
      prev.status === 'ready'
        ? { ...prev, kids: prev.kids.map((k) => (k.userId === data.kidId ? { ...k, analyticsConsent: data.analyticsConsent } : k)) }
        : prev,
    );
  }

  function onKidCreated(kid: CreatedKid) {
    // A brand-new kid has no tasks, wallet or streak history yet — these
    // three are known-zero by construction, not fetched.
    const withDefaults: Kid = { ...kid, pendingApprovalCount: 0, walletTotal: 0, taskStreakDays: 0 };
    setState((prev) => (prev.status === 'ready' ? { ...prev, kids: [...prev.kids, withDefaults] } : prev));
  }

  // Both apply the server's outcome to the list in place. A refetch would be a
  // second round trip that can answer before the write has propagated.
  function onKidRenamed(userId: string, displayName: string) {
    setState((prev) =>
      prev.status === 'ready'
        ? { ...prev, kids: prev.kids.map((k) => (k.userId === userId ? { ...k, displayName } : k)) }
        : prev,
    );
  }

  function onKidRemoved(userId: string) {
    setState((prev) =>
      prev.status === 'ready' ? { ...prev, kids: prev.kids.filter((k) => k.userId !== userId) } : prev,
    );
  }

  if (state.status === 'loading') return <LoadingOverlay label={t('family.loading')} />;
  if (state.status === 'error') return <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
    <ErrorBanner code={state.code} />
    {state.code === 'PARENT_VERIFICATION_REQUIRED' && <Link to="/verify-parent" className="lf-label text-primary underline">{t('auth.verify.checkIdentity')}</Link>}
  </div>;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 md:px-6">
      <header>
        <h1 className="lf-display-lg text-content">{t('family.title')}</h1>
        <p className="lf-body text-content-muted">{t('family.subtitle')}</p>
      </header>

      {state.kids.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Icon name="family_restroom" className="text-[40px] text-content-faint" aria-hidden />
          <h2 className="lf-title text-content">{t('family.emptyTitle')}</h2>
          <p className="lf-body max-w-md text-content-muted">{t('family.emptyBody')}</p>
          <AddKidCard onCreated={onKidCreated} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {state.kids.map((kid) => (
            <li key={kid.userId} className="rounded-lg border border-outline/70 bg-surface shadow-glass-sm">
              <Link
                to={`/family/${kid.userId}/territory`}
                className="flex min-h-14 items-center gap-4 rounded-t-lg px-4 py-3 transition-[background-color] duration-150 hover:bg-surface-sunken/50 lf-press focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft lf-title font-bold text-primary">
                  {(kid.displayName ?? kid.username ?? '?').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="lf-label block truncate text-content">{kid.displayName ?? kid.username}</span>
                  {kid.username ? <span className="lf-caption block truncate text-content-faint">@{kid.username}</span> : null}
                </span>
                <span className="lf-caption flex shrink-0 items-center gap-1 font-bold text-primary">
                  <Icon name="map" className="text-[18px]" aria-hidden />
                  {t('family.viewTerritory')}
                </span>
              </Link>

              {/* "What needs my attention" per kid (FAMILY_HUB.md §7) — a
                  wallet total and chore streak are always shown; the
                  awaiting-approval count only appears when it is non-zero,
                  since that is the one fact this row exists to surface. */}
              <div className="flex flex-wrap items-center gap-2 border-t border-outline/50 px-4 py-2.5">
                <Link
                  to="/banking"
                  className="lf-caption lf-press flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-bold text-success-strong hover:bg-success/20"
                >
                  <Icon name="savings" className="text-[15px]" aria-hidden />
                  {kid.walletTotal === null ? t('family.card.walletUnknown') : t('family.card.wallet', { count: kid.walletTotal })}
                </Link>
                {kid.taskStreakDays > 0 && (
                  <span className="lf-caption flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 font-bold text-warning-strong">
                    <Icon name="local_fire_department" fill className="text-[15px]" aria-hidden />
                    {t('family.card.streak', { count: kid.taskStreakDays })}
                  </span>
                )}
                {kid.pendingApprovalCount > 0 && (
                  <Link
                    to="/tasks"
                    className="lf-caption lf-press flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 font-bold text-accent hover:bg-accent/20"
                  >
                    <Icon name="pending_actions" className="text-[15px]" aria-hidden />
                    {t('family.card.pendingApproval', { count: kid.pendingApprovalCount })}
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-outline/50 px-4 py-2.5">
                <Icon name="query_stats" className="shrink-0 text-[18px] text-content-faint" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="lf-caption block text-content">{t('family.insightsConsent.label')}</span>
                  <span className="lf-caption block text-content-faint">{t('family.insightsConsent.hint')}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={kid.analyticsConsent}
                  aria-label={t('family.insightsConsent.label')}
                  disabled={busyKid === kid.userId}
                  onClick={() => void toggleConsent(kid)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
                    kid.analyticsConsent ? 'bg-primary' : 'bg-outline'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-150 ${
                      kid.analyticsConsent ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              {/* The microphone gate (/ORACLE.md §4.3). Deliberately below the
                  analytics switch and deliberately not shaped like it: this
                  one shows the exact wording before it is agreed to. */}
              <VoiceConsentControl
                kidUserId={kid.userId}
                token={token}
                kidName={kid.displayName ?? kid.username ?? ''}
              />
              <SocialRequestsPanel kidUserId={kid.userId} token={token} />
              <SocialGraphPanel kidUserId={kid.userId} token={token} />
              <SocialHistoryPanel kidUserId={kid.userId} token={token} />
              <BadgeSharesPanel kidUserId={kid.userId} token={token} />
              <GuardianInvitePanel kidUserId={kid.userId} token={token} />
              <ManageKidPanel kid={kid} onRenamed={onKidRenamed} onRemoved={onKidRemoved} />
              <Link
                to={`/family/${kid.userId}/tutor`}
                className="lf-caption lf-press flex min-h-11 items-center gap-2 border-t border-outline/50 px-4 py-2.5 font-bold text-primary transition-[background-color] duration-150 hover:bg-surface-sunken/50"
              >
                <Icon name="forum" className="text-[18px]" aria-hidden />
                {t('tutor.guardian.linkFromFamily')}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {state.kids.length > 0 && <SocialNoticesPanel token={token} />}
      {joinToken !== null && <GuardianInviteJoin inviteToken={joinToken} />}
      {consentError && <ErrorBanner code={consentError} />}
      {state.kids.length > 0 && <AddKidCard onCreated={onKidCreated} />}
    </div>
  );
}

export default FamilyPage;
