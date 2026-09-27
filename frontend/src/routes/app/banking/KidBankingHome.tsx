import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Field, Icon, IconChip, LoadingOverlay, SectionHeading } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { type WalletBalances, type WireLedgerEntry } from '../tasks/types';
import { CARD_DESIGNS, type CardDesign, type WireBankingAccount, type WirePendingCredit } from './types';
import { SavingsBonusPanel } from './SavingsBonusPanel';
import { AllocationPanel } from '../tasks/AllocationPanel';
import { SavingsGoalsPanel } from '../tasks/SavingsGoalsPanel';
import { UsualSplitPanel } from '../tasks/UsualSplitPanel';
import { CoinAccountPanel } from './CoinAccountPanel';
import { MoneyBridgePanel, MyResearchPanel, tokenSession } from '../family/GovernancePanels';
import { MyDataPracticesPanel } from '../family/DataPracticePanels';

/*
 * The kid's half of BANKING.md §7.1: the account/card, the wallet
 * (unchanged FAMILY_HUB.md Save/Spend/Share, now the primary reference
 * rather than /tasks's echo), goals promoted to first-class, an allowance
 * catch-up banner, a spend-limit meter, and the statement.
 *
 * SCOPE NOTE: the redemption catalog stays on /tasks — it already works
 * well there, and duplicating a full redeem UI here would double the
 * surface to keep in sync for no product benefit. This page links through
 * instead (BANKING.md's own §3 cross-link principle, applied here).
 */

const CARD_GRADIENT: Record<CardDesign, string> = {
  indigo: 'from-primary to-primary-strong',
  emerald: 'from-success to-success-strong',
  violet: 'from-delight to-delight/70',
  amber: 'from-warning to-warning-strong',
  sunrise: 'from-warning to-error/70',
  ocean: 'from-primary to-success/70',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | { status: 'no-account' }
  | {
      status: 'ready';
      account: WireBankingAccount;
      balances: WalletBalances;
      ledger: WireLedgerEntry[];
      credits: WirePendingCredit[];
    };

export function KidBankingHome() {
  const { t, i18n } = useTranslation();
  const { getToken } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  const governanceSession = useMemo(() => (token ? tokenSession(token) : null), [token]);
  const [reloadKey, setReloadKey] = useState(0);
  // S07.4: goals and the allowance split chooser are rebuilt panels; a landed
  // payout bumps them so a goal it reached celebrates at once.
  const [moneyVersion, setMoneyVersion] = useState(0);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => (prev.status === 'error' ? { status: 'loading' } : prev));
    void (async () => {
      const tok = await getToken();
      if (!tok || cancelled) return;
      setToken(tok);
      const accountRes = await api<{ account: WireBankingAccount | null }>('/banking/account', { token: tok });
      if (cancelled) return;
      if (accountRes.error) {
        setState({ status: 'error', code: accountRes.error.code });
        return;
      }
      if (!accountRes.data.account) {
        setState({ status: 'no-account' });
        return;
      }
      const [balancesRes, ledgerRes, creditsRes] = await Promise.all([
        api<{ balances: WalletBalances }>('/tasks/wallet', { token: tok }),
        api<{ entries: WireLedgerEntry[] }>('/tasks/wallet/ledger', { token: tok }),
        api<{ credits: WirePendingCredit[] }>('/banking/wallet/pending-credits', { token: tok }),
      ]);
      if (cancelled) return;
      if (balancesRes.error || ledgerRes.error || creditsRes.error) {
        const code = (balancesRes.error ?? ledgerRes.error ?? creditsRes.error)?.code ?? 'INTERNAL';
        setState({ status: 'error', code });
        return;
      }
      setState({
        status: 'ready',
        account: accountRes.data.account,
        balances: balancesRes.data.balances,
        ledger: ledgerRes.data.entries,
        credits: creditsRes.data.credits,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, reloadKey]);

  async function refreshAccount() {
    if (!token) return;
    const res = await api<{ account: WireBankingAccount | null }>('/banking/account', { token });
    if (res.data?.account) setState((prev) => (prev.status === 'ready' ? { ...prev, account: res.data.account as WireBankingAccount } : prev));
  }

  async function refreshWalletAndCredits() {
    if (!token) return;
    const [balancesRes, ledgerRes, creditsRes] = await Promise.all([
      api<{ balances: WalletBalances }>('/tasks/wallet', { token }),
      api<{ entries: WireLedgerEntry[] }>('/tasks/wallet/ledger', { token }),
      api<{ credits: WirePendingCredit[] }>('/banking/wallet/pending-credits', { token }),
    ]);
    setState((prev) => {
      if (prev.status !== 'ready') return prev;
      return {
        ...prev,
        balances: balancesRes.data?.balances ?? prev.balances,
        ledger: ledgerRes.data?.entries ?? prev.ledger,
        credits: creditsRes.data?.credits ?? prev.credits,
      };
    });
  }

  if (state.status === 'loading') return <LoadingOverlay label={t('banking.loading')} />;
  if (state.status === 'error') return <ErrorBanner code={state.code} onRetry={() => setReloadKey((k) => k + 1)} />;

  if (state.status === 'no-account') {
    return (
      <div className="flex flex-col gap-8 pb-8">
        <header>
          <h1 className="lf-display-lg text-content">{t('banking.title')}</h1>
        </header>
        <Card className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
          <IconChip tone="primary" size="lg">
            <Icon name="account_balance" aria-hidden />
          </IconChip>
          <h2 className="lf-title text-content">{t('banking.kid.emptyTitle')}</h2>
          <p className="lf-body max-w-sm text-content-muted">{t('banking.kid.emptyBody')}</p>
        </Card>
      </div>
    );
  }

  const { account } = state;
  const recentLedger = state.ledger.slice(0, 8);
  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', day: 'numeric' });
  const BUCKET_DOT: Record<WireLedgerEntry['bucket'], string> = { save: 'bg-success', spend: 'bg-primary', share: 'bg-delight' };

  function ledgerReasonLabel(reason: string): string {
    if (reason === 'allowance') return t('banking.kid.reasonAllowance');
    if (reason === 'savings_bonus') return t('banking.kid.reasonSavingsBonus');
    if (reason === 'task_approved') return t('tasks.kid.activityEarnedUntitled');
    if (reason === 'redemption') return t('tasks.kid.activitySpentUntitled');
    // S07.4 (D.14): coins directed to a Share destination are never an "adjustment".
    if (reason === 'share_gift') return t('banking.kid.reasonShareGift');
    if (reason === 'share_gift_returned') return t('banking.kid.reasonShareReturned');
    return t('tasks.kid.activityAdjustment');
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="lf-display-lg text-content">{t('banking.title')}</h1>
          <p className="lf-body text-content-muted">{t('banking.kid.subtitle')}</p>
        </div>
      </header>

      {/*
        S07.6 (D.7, D.12): the rebuilt coin account replaces the legacy card
        (a card number laid out like a real card's), the freeze switch, the
        frozen banner, the pocket tiles, the spending-limit meter and the
        statement summary. It says what a freeze really holds, is shaped by
        the child's age register at Core, and re-reads after every change.
      */}
      <CoinAccountPanel token={token} refreshKey={moneyVersion} onChanged={() => { void refreshAccount(); void refreshWalletAndCredits(); }} />
      {/* S07.7 (D.19, D.22): "Beyond the app" from 15, and the child's own research no. */}
      {governanceSession && <MoneyBridgePanel session={governanceSession} />}
      {governanceSession && <MyResearchPanel session={governanceSession} />}
      {/* S10.3 (OD-9 4.2): the child's own no to a practice the rebuild introduced. */}
      {governanceSession && <MyDataPracticesPanel session={governanceSession} />}
      <button type="button" onClick={() => setCardDialogOpen(true)} className="lf-press flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 lf-caption font-bold text-primary">
        <Icon name="tune" className="text-[16px]" aria-hidden />
        {t('banking.kid.cardDetails')}
      </button>

      {/* S07.4 (D.13): an allowance arrives pre-split by the child's own usual split; keeping it is one tap. */}
      {state.credits.length > 0 && (
        <div className="flex flex-col gap-3">
          {state.credits.map((credit) => (
            <AllocationPanel key={credit.id} token={token} kind="credit" id={credit.id} amount={credit.amount} frozen={account.frozen}
              onDone={() => { setMoneyVersion((v) => v + 1); void refreshWalletAndCredits(); }} />
          ))}
        </div>
      )}
      <UsualSplitPanel token={token} />

      {/* S07.3 (D.11): the child's own bonus, in the framing their age calls for. */}
      <SavingsBonusPanel token={token} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* S07.4 (D.15, D.16): goals with provenance and the next-goal prompt. */}
        <SavingsGoalsPanel token={token} refreshKey={moneyVersion} />

        <div className="flex flex-col gap-6">
          <section aria-labelledby="banking-activity-heading">
            <SectionHeading id="banking-activity-heading" icon="history" tone="muted">
              {t('tasks.kid.activityTitle')}
            </SectionHeading>
            {recentLedger.length === 0 ? (
              <p className="lf-caption text-content-muted">{t('tasks.kid.activityEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {recentLedger.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2.5 rounded-lg border border-outline/50 bg-surface px-3.5 py-2.5">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', BUCKET_DOT[entry.bucket])} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="lf-caption block truncate text-content">{ledgerReasonLabel(entry.reason)}</span>
                      <span className="lf-caption block text-content-faint">{dateFormatter.format(new Date(entry.createdAt))}</span>
                    </span>
                    <span className={cn('lf-label lf-number shrink-0 tabular-nums', entry.amount >= 0 ? 'text-success' : 'text-content-muted')}>
                      {entry.amount >= 0 ? '+' : ''}
                      {entry.amount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/tasks" className="mt-3 inline-block lf-caption text-primary">
              {t('banking.kid.redeemLink')}
            </Link>
          </section>
        </div>
      </div>

      {cardDialogOpen && (
        <CardDialog
          account={account}
          token={token}
          onClose={() => setCardDialogOpen(false)}
          onSaved={async () => {
            await refreshAccount();
          }}
        />
      )}
    </div>
  );
}

function CardDialog({
  account,
  token,
  onClose,
  onSaved,
}: {
  account: WireBankingAccount;
  token: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState(account.nickname);
  const [design, setDesign] = useState<CardDesign>(account.cardDesign);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!token || saving) return;
    setSaving(true);
    await api('/banking/account', { method: 'PATCH', token, body: { nickname: nickname.trim() || account.nickname, cardDesign: design } });
    setSaving(false);
    onSaved();
    onClose();
  }

  // Portalled to document.body — a plain `fixed inset-0` inside the normal
  // app-shell tree is NOT viewport-relative when any ancestor (this route's
  // page-enter transform wrapper, in particular) establishes a containing
  // block, and it silently degrades to flowing inside the page instead of
  // pinning to the screen. Verified live: without the portal, this dialog's
  // "scrim" measured 1520px tall and started 56px down the PAGE rather than
  // the viewport — visible only as a sliver at the very bottom of a short
  // screen. AdminDialog already solves this the same way.
  return createPortal(
    <div
      className="lf-config-scrim pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 md:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/*
        border-2 border-white/25 shadow-2xl is a deliberate, scoped addition
        on top of .lf-config-dialog — verified live (getComputedStyle) that
        --lf-surface (dialog fill) and --lf-inverse (.lf-config-scrim fill)
        are RGB(13,20,38)/RGB(15,23,42) in dark mode: nearly identical, and
        with matching backdrop-blur on both layers there is no edge to see
        over a flat background (this page's account-card band in particular).
        A visible border is the only reliable differentiator that doesn't
        touch the shared system classes other routes (the Tutor) also use.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('banking.kid.cardDetails')}
        className="lf-config-dialog my-auto flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden border-2 border-white/25 shadow-2xl focus-visible:outline-none"
      >
        <div className="lf-config-head flex shrink-0 items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
          <span className="lf-title text-content">{t('banking.kid.cardDetails')}</span>
          <button type="button" onClick={onClose} aria-label={t('tasks.parent.cancel')} className="lf-press flex min-h-9 min-w-9 items-center justify-center rounded-full text-content-muted hover:text-content">
            <Icon name="close" aria-hidden />
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          <Field label={t('banking.kid.nicknameLabel')} value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} />
          <div>
            <span className="lf-label mb-2 block text-content">{t('banking.kid.designLabel')}</span>
            <div className="flex gap-2">
              {CARD_DESIGNS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={t(`banking.cardDesigns.${d}`)}
                  aria-pressed={design === d}
                  onClick={() => setDesign(d)}
                  className={cn('h-8 w-8 rounded-full bg-gradient-to-br', CARD_GRADIENT[d], design === d && 'ring-2 ring-content ring-offset-2 ring-offset-surface')}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="lf-config-foot flex shrink-0 px-5 py-4 sm:px-6">
          <Button type="button" variant="primary" className="w-full justify-center" disabled={saving} onClick={() => void onSave()}>
            {saving ? t('banking.kid.saving') : t('banking.kid.done')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
