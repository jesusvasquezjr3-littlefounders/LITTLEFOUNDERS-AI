import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Field, Icon, IconChip, LoadingOverlay, ProgressBar, SectionHeading, StatCard } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { type WalletBalances, type WireLedgerEntry } from '../tasks/types';
import { CARD_DESIGNS, type CardDesign, type WireBankingAccount, type WirePendingCredit, type WireSpendLimitStatus, type WireStatement } from './types';
import { SavingsBonusPanel } from './SavingsBonusPanel';
import { AllocationPanel } from '../tasks/AllocationPanel';
import { SavingsGoalsPanel } from '../tasks/SavingsGoalsPanel';
import { UsualSplitPanel } from '../tasks/UsualSplitPanel';

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
      spendLimit: WireSpendLimitStatus;
    };

export function KidBankingHome() {
  const { t, i18n } = useTranslation();
  const { getToken, session } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [token, setToken] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // S07.4: goals and the allowance split chooser are rebuilt panels; a landed
  // payout bumps them so a goal it reached celebrates at once.
  const [moneyVersion, setMoneyVersion] = useState(0);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [freezeError, setFreezeError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [statement, setStatement] = useState<WireStatement | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementMonth, setStatementMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const liveRegionRef = useRef<HTMLDivElement>(null);

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
      const [balancesRes, ledgerRes, creditsRes, spendLimitRes] = await Promise.all([
        api<{ balances: WalletBalances }>('/tasks/wallet', { token: tok }),
        api<{ entries: WireLedgerEntry[] }>('/tasks/wallet/ledger', { token: tok }),
        api<{ credits: WirePendingCredit[] }>('/banking/wallet/pending-credits', { token: tok }),
        api<{ status: WireSpendLimitStatus }>('/banking/spend-limit', { token: tok }),
      ]);
      if (cancelled) return;
      if (balancesRes.error || ledgerRes.error || creditsRes.error || spendLimitRes.error) {
        const code = (balancesRes.error ?? ledgerRes.error ?? creditsRes.error ?? spendLimitRes.error)?.code ?? 'INTERNAL';
        setState({ status: 'error', code });
        return;
      }
      setState({
        status: 'ready',
        account: accountRes.data.account,
        balances: balancesRes.data.balances,
        ledger: ledgerRes.data.entries,
        credits: creditsRes.data.credits,
        spendLimit: spendLimitRes.data.status,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, reloadKey]);

  function announce(message: string) {
    setLiveMessage(message);
    liveRegionRef.current?.focus();
  }

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

  async function onToggleFreeze(next: boolean) {
    if (!token || freezeBusy) return;
    setFreezeBusy(true);
    setFreezeError(null);
    const res = await api<{ account: WireBankingAccount }>('/banking/account/freeze', { method: 'POST', token, body: { frozen: next } });
    setFreezeBusy(false);
    if (res.error) {
      setFreezeError(res.error.code);
      await refreshAccount();
      return;
    }
    if (res.data) {
      setState((prev) => (prev.status === 'ready' ? { ...prev, account: res.data.account } : prev));
      announce(next ? t('banking.kid.frozenAnnounce') : t('banking.kid.unfrozenAnnounce'));
    }
  }

  async function loadStatement(month: string) {
    if (!token) return;
    const res = await api<{ statement: WireStatement }>(`/banking/statement?month=${month}`, { token });
    if (res.data) setStatement(res.data.statement);
  }

  function stepMonth(delta: number) {
    const parts = statementMonth.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    setStatementMonth(next);
    void loadStatement(next);
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
  const monthFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const isFrozenByMe = account.frozen && account.frozenBy === session?.user.id;
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
      <div ref={liveRegionRef} tabIndex={-1} role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="lf-display-lg text-content">{t('banking.title')}</h1>
          <p className="lf-body text-content-muted">{t('banking.kid.subtitle')}</p>
        </div>
      </header>

      {/* The one surface allowed to look like a literal card (BANKING.md §7.1). */}
      <Card className={cn('overflow-hidden p-0')}>
        <div className={cn('flex min-h-[150px] flex-col justify-between gap-4 bg-gradient-to-br p-6 text-on-accent', CARD_GRADIENT[account.cardDesign])}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="lf-eyebrow text-on-accent/75">{t('banking.kid.accountLabel')}</p>
              <p className="lf-headline">{account.nickname}</p>
            </div>
            <button
              type="button"
              onClick={() => setCardDialogOpen(true)}
              className="lf-press flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 lf-caption font-bold text-on-accent"
            >
              <Icon name="tune" className="text-[16px]" aria-hidden />
              {t('banking.kid.cardDetails')}
            </button>
          </div>
          <div className="flex items-end justify-between">
            <span className="lf-number font-mono text-sm tracking-widest text-on-accent/90">{account.displayNumber}</span>
            {account.frozen && (
              <span className="lf-caption flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 font-bold text-on-accent">
                <Icon name="lock" className="text-[14px]" aria-hidden />
                {t('banking.kid.frozenBadge')}
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={<Icon name="savings" />} value={String(state.balances.save)} label={t('tasks.kid.save')} tone="success" />
        <StatCard icon={<Icon name="shopping_bag" />} value={String(state.balances.spend)} label={t('tasks.kid.spend')} tone="primary" />
        <StatCard icon={<Icon name="volunteer_activism" />} value={String(state.balances.share)} label={t('tasks.kid.share')} tone="delight" />
      </div>

      {account.frozen && <p role="status" className="lf-body rounded-md bg-warning-soft p-4 text-content">{t('banking.kid.frozenHold')}</p>}
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

      {state.spendLimit.configured && (
        <Card className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="lf-label text-content">{t(`banking.kid.spendLimit.${state.spendLimit.period}`)}</span>
            <span className="lf-caption text-content-muted">{t('banking.kid.spendLimitUsed', { used: state.spendLimit.used, cap: state.spendLimit.cap })}</span>
          </div>
          <ProgressBar value={(state.spendLimit.used / state.spendLimit.cap) * 100} label={t('banking.kid.spendLimit.weekly')} tone="accent" />
        </Card>
      )}

      {/* S07.3 (D.11): the child's own bonus, in the framing their age calls for. */}
      <SavingsBonusPanel token={token} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* S07.4 (D.15, D.16): goals with provenance and the next-goal prompt. */}
        <SavingsGoalsPanel token={token} refreshKey={moneyVersion} />

        <div className="flex flex-col gap-6">
          <section aria-labelledby="banking-statement-heading">
            <SectionHeading id="banking-statement-heading" icon="receipt_long" tone="muted">
              {t('banking.statement.title')}
            </SectionHeading>
            <Card className="flex flex-col gap-3 p-4">
              {!statementOpen ? (
                <button type="button" className="lf-press text-left" onClick={() => { setStatementOpen(true); void loadStatement(statementMonth); }}>
                  <span className="lf-caption text-primary">{t('banking.statement.viewCta')}</span>
                </button>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <button type="button" aria-label={t('banking.statement.prevMonth')} onClick={() => stepMonth(-1)} className="lf-press p-1">
                      <Icon name="chevron_left" aria-hidden />
                    </button>
                    <span className="lf-label capitalize text-content">{monthFormatter.format(new Date(`${statementMonth}-01T00:00:00Z`))}</span>
                    <button type="button" aria-label={t('banking.statement.nextMonth')} onClick={() => stepMonth(1)} className="lf-press p-1">
                      <Icon name="chevron_right" aria-hidden />
                    </button>
                  </div>
                  {statement && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="lf-number text-success">+{statement.earned}</p>
                        <p className="lf-caption text-content-muted">{t('banking.statement.earned')}</p>
                      </div>
                      <div>
                        <p className="lf-number text-content">-{statement.spent}</p>
                        <p className="lf-caption text-content-muted">{t('banking.statement.spent')}</p>
                      </div>
                      <div>
                        <p className="lf-number text-success">{statement.saved}</p>
                        <p className="lf-caption text-content-muted">{t('banking.statement.saved')}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </section>

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
          isFrozenByMe={isFrozenByMe}
          onToggleFreeze={onToggleFreeze}
          freezeBusy={freezeBusy}
          freezeError={freezeError}
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
  isFrozenByMe,
  onToggleFreeze,
  freezeBusy,
  freezeError,
  onClose,
  onSaved,
}: {
  account: WireBankingAccount;
  token: string | null;
  isFrozenByMe: boolean;
  onToggleFreeze: (next: boolean) => void;
  freezeBusy: boolean;
  freezeError: string | null;
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
          <div className="lf-config-row flex items-center justify-between gap-3 p-3.5">
            <span className="flex items-center gap-3">
              <span className="lf-tile h-9 w-9 text-warning">
                <Icon name="lock" aria-hidden />
              </span>
              <span>
                <span className="lf-label block text-content">{t('banking.kid.freezeToggle')}</span>
                <span className="lf-caption block text-content-muted">{account.frozen ? (isFrozenByMe ? t('banking.kid.frozenByYou') : t('banking.kid.frozenByGuardian')) : t('banking.kid.freezeHint')}</span>
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-label={t('banking.kid.freezeToggle')}
              aria-checked={account.frozen}
              disabled={freezeBusy || (account.frozen && !isFrozenByMe)}
              onClick={() => onToggleFreeze(!account.frozen)}
              className={cn('lf-switch', account.frozen && 'lf-switch-on')}
            >
              <span className="lf-switch-knob" />
            </button>
          </div>
          {freezeError && <ErrorBanner code={freezeError} />}
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
