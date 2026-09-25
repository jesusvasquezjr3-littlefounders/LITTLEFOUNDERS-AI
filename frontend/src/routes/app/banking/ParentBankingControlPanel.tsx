import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { Button, Card, Dropdown, Field, Icon, ProgressBar, SectionHeading } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ErrorBanner } from '@/routes/auth/ErrorBanner';
import { CARD_DESIGNS, DAY_OF_WEEK_KEYS, type AllowanceFrequency, type CardDesign, type SpendLimitPeriod, type WireAllowanceRule, type WireBankingAccount, type WireSpendLimitStatus } from './types';
import { SavingsBonusSettingsPanel } from './SavingsBonusSettingsPanel';
import { TutorFreezePanel } from './TutorFreezePanel';
import { DecisionQueuePanel } from '../tasks/DecisionQueuePanel';

/*
 * The parent's half of BANKING.md §7.2: open the account, then
 * configure allowance automation, a spend limit and the savings bonus —
 * each a `.lf-config-row` toggle + fields, exactly the shape AdminRolesPage
 * and PersonalizeInWorld already use for the same grammar — plus the
 * redemption decisions already awaiting a parent's answer.
 *
 * S07.6 (D.7): the freeze switch and the card-number line are replaced by the
 * rebuilt freeze card (what a freeze really holds, who set it, which age view
 * the child reads). The legacy approve/deny buttons are replaced by the
 * rebuilt decision queue: since S07.5 a denial needs an actionable reason
 * (D.18), so the legacy bare "Deny" was a button the server always refused.
 */

interface Kid {
  userId: string;
  displayName: string | null;
  username: string | null;
}

const CARD_GRADIENT: Record<CardDesign, string> = {
  indigo: 'from-primary to-primary-strong',
  emerald: 'from-success to-success-strong',
  violet: 'from-delight to-delight/70',
  amber: 'from-warning to-warning-strong',
  sunrise: 'from-warning to-error/70',
  ocean: 'from-primary to-success/70',
};

type KidDataState =
  | { status: 'loading' }
  | { status: 'error'; code: string }
  | {
      status: 'ready';
      account: WireBankingAccount | null;
      allowance: WireAllowanceRule | null;
      spendLimit: WireSpendLimitStatus;
    };

export function ParentBankingControlPanel() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [kids, setKids] = useState<Kid[] | null>(null);
  const [kidsError, setKidsError] = useState<string | null>(null);
  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [kidData, setKidData] = useState<KidDataState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [liveMessage, setLiveMessage] = useState('');
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tok = await getToken();
      if (!tok || cancelled) return;
      setToken(tok);
      const res = await api<{ kids: Kid[] }>('/family/kids', { token: tok });
      if (cancelled) return;
      if (res.error) {
        setKidsError(res.error.code);
        return;
      }
      setKids(res.data.kids);
      setSelectedKidId((prev) => prev ?? res.data.kids[0]?.userId ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  useEffect(() => {
    if (!token || !selectedKidId) return;
    let cancelled = false;
    setKidData({ status: 'loading' });
    void (async () => {
      const [accountRes, allowanceRes, spendLimitRes] = await Promise.all([
        api<{ account: WireBankingAccount | null }>(`/banking/accounts/${selectedKidId}`, { token }),
        api<{ rule: WireAllowanceRule | null }>(`/banking/allowance/${selectedKidId}`, { token }),
        api<{ status: WireSpendLimitStatus }>(`/banking/spend-limit/${selectedKidId}`, { token }),
      ]);
      if (cancelled) return;
      if (accountRes.error || allowanceRes.error || spendLimitRes.error) {
        const code = (accountRes.error ?? allowanceRes.error ?? spendLimitRes.error)?.code ?? 'INTERNAL';
        setKidData({ status: 'error', code });
        return;
      }
      setKidData({
        status: 'ready',
        account: accountRes.data.account,
        allowance: allowanceRes.data.rule,
        spendLimit: spendLimitRes.data.status,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedKidId, reloadKey]);

  function announce(message: string) {
    setLiveMessage(message);
    liveRegionRef.current?.focus();
  }

  async function onOpenAccount(nickname: string, cardDesign: CardDesign) {
    if (!token || !selectedKidId) return;
    const res = await api<{ account: WireBankingAccount }>(`/banking/accounts/${selectedKidId}`, { method: 'POST', token, body: { nickname, cardDesign } });
    if (res.data) {
      setKidData((prev) => (prev.status === 'ready' ? { ...prev, account: res.data.account } : prev));
      announce(t('banking.parent.accountOpenedAnnounce'));
    }
  }

  if (kidsError) return <ErrorBanner code={kidsError} onRetry={() => window.location.reload()} />;
  if (!kids) return <p className="lf-body p-6 text-content-muted">{t('banking.loading')}</p>;

  if (kids.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="lf-display-lg text-content">{t('banking.title')}</h1>
        <Card className="flex flex-col items-center gap-2 p-8 text-center">
          <Icon name="family_restroom" className="text-[40px] text-content-faint" aria-hidden />
          <h2 className="lf-title text-content">{t('tasks.parent.emptyNoKidsTitle')}</h2>
          <p className="lf-body max-w-md text-content-muted">{t('tasks.parent.emptyNoKidsBody')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      <div ref={liveRegionRef} tabIndex={-1} role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
      <header>
        <h1 className="lf-display-lg text-content">{t('banking.title')}</h1>
        <p className="lf-body text-content-muted">{t('banking.parent.subtitle')}</p>
      </header>

      {kids.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('banking.parent.kidSwitcher')}>
          {kids.map((kid) => (
            <button
              key={kid.userId}
              type="button"
              role="tab"
              aria-selected={selectedKidId === kid.userId}
              onClick={() => setSelectedKidId(kid.userId)}
              className={cn(
                'lf-tactile flex items-center gap-2 rounded-full px-4 py-2 lf-label',
                selectedKidId === kid.userId ? 'bg-accent text-on-accent' : 'bg-surface text-content',
              )}
            >
              {kid.displayName ?? kid.username ?? '?'}
            </button>
          ))}
        </div>
      )}

      {kidData.status === 'loading' && <p className="lf-body p-4 text-content-muted">{t('banking.loading')}</p>}
      {kidData.status === 'error' && <ErrorBanner code={kidData.code} onRetry={() => setReloadKey((k) => k + 1)} />}

      {kidData.status === 'ready' && !kidData.account && (
        <OpenAccountCard onOpen={onOpenAccount} />
      )}

      {kidData.status === 'ready' && kidData.account && selectedKidId && (
        <TutorFreezePanel key={selectedKidId} token={token} kidId={selectedKidId}
          name={kids?.find((k) => k.userId === selectedKidId)?.displayName ?? kids?.find((k) => k.userId === selectedKidId)?.username ?? ''}
          onChanged={() => setReloadKey((k) => k + 1)} />
      )}

      {kidData.status === 'ready' && kidData.account && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-6">
            <AllowanceSection token={token} kidId={selectedKidId as string} rule={kidData.allowance} onSaved={(rule) => setKidData((prev) => (prev.status === 'ready' ? { ...prev, allowance: rule } : prev))} />
            <SpendLimitSection
              token={token}
              kidId={selectedKidId as string}
              status={kidData.spendLimit}
              onSaved={(status) => setKidData((prev) => (prev.status === 'ready' ? { ...prev, spendLimit: status } : prev))}
            />
            {/* S07.3 (D.11): the bonus in the framing the child's age calls for. */}
            <SavingsBonusSettingsPanel kidUserId={selectedKidId as string} kidName={kids?.find((k) => k.userId === selectedKidId)?.displayName ?? kids?.find((k) => k.userId === selectedKidId)?.username ?? ''} token={token} />
          </div>

          <div className="flex flex-col gap-6">
            {kids && kids.length > 0 && <DecisionQueuePanel token={token} kids={kids} refreshKey={reloadKey} onChanged={() => setReloadKey((k) => k + 1)} />}
          </div>
        </div>
      )}
    </div>
  );
}

function OpenAccountCard({ onOpen }: { onOpen: (nickname: string, cardDesign: CardDesign) => Promise<void> }) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState('');
  const [cardDesign, setCardDesign] = useState<CardDesign>('indigo');
  const [submitting, setSubmitting] = useState(false);

  return (
    <Card className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="lf-tile h-11 w-11 text-primary">
          <Icon name="account_balance" aria-hidden />
        </span>
        <h2 className="lf-title text-content">{t('banking.parent.openTitle')}</h2>
        <p className="lf-body text-content-muted">{t('banking.parent.openBody')}</p>
      </div>
      <Field label={t('banking.kid.nicknameLabel')} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t('banking.parent.openNicknamePlaceholder')} maxLength={40} />
      <div>
        <span className="lf-label mb-2 block text-content">{t('banking.kid.designLabel')}</span>
        <div className="flex gap-2">
          {CARD_DESIGNS.map((d) => (
            <button
              key={d}
              type="button"
              aria-label={t(`banking.cardDesigns.${d}`)}
              aria-pressed={cardDesign === d}
              onClick={() => setCardDesign(d)}
              className={cn('h-8 w-8 rounded-full bg-gradient-to-br', CARD_GRADIENT[d], cardDesign === d && 'ring-2 ring-content ring-offset-2 ring-offset-surface')}
            />
          ))}
        </div>
      </div>
      <Button
        type="button"
        variant="primary"
        className="justify-center"
        disabled={submitting}
        onClick={async () => {
          setSubmitting(true);
          await onOpen(nickname.trim() || 'My Account', cardDesign);
          setSubmitting(false);
        }}
      >
        {submitting ? t('banking.parent.opening') : t('banking.parent.openCta')}
      </Button>
    </Card>
  );
}

function AllowanceSection({ token, kidId, rule, onSaved }: { token: string | null; kidId: string; rule: WireAllowanceRule | null; onSaved: (rule: WireAllowanceRule) => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(rule?.active ?? false);
  const [amount, setAmount] = useState(rule?.amount ?? 10);
  const [frequency, setFrequency] = useState<AllowanceFrequency>(rule?.frequency ?? 'weekly');
  const [anchorDay, setAnchorDay] = useState(rule?.anchorDay ?? 5);
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function onSave() {
    if (!token || saving) return;
    setSaving(true);
    setErrorCode(null);
    const res = await api<{ rule: WireAllowanceRule }>(`/banking/allowance/${kidId}`, { method: 'PUT', token, body: { amount, frequency, anchorDay, active } });
    setSaving(false);
    if (res.error) {
      setErrorCode(res.error.code);
      return;
    }
    onSaved(res.data.rule);
  }

  return (
    <section aria-labelledby="banking-allowance-heading">
      <SectionHeading id="banking-allowance-heading" icon="calendar_month" tone="accent">
        {t('banking.parent.allowanceHeading')}
      </SectionHeading>
      <Card className="flex flex-col gap-4 p-5">
        <div className="lf-config-row flex items-center justify-between gap-3 p-3.5">
          <span className="lf-label text-content">{t('banking.parent.allowanceActive')}</span>
          <button type="button" role="switch" aria-checked={active} onClick={() => setActive(!active)} className={cn('lf-switch', active && 'lf-switch-on')}>
            <span className="lf-switch-knob" />
          </button>
        </div>
        {active && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('banking.parent.allowanceAmount')} type="number" min={1} max={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
              <div className="flex flex-col gap-1.5">
                <span className="lf-label text-content">{t('banking.parent.allowanceFrequency')}</span>
                <Dropdown
                  value={frequency}
                  options={[
                    { value: 'weekly', label: t('banking.parent.frequencyWeekly') },
                    { value: 'biweekly', label: t('banking.parent.frequencyBiweekly') },
                    { value: 'monthly', label: t('banking.parent.frequencyMonthly') },
                  ]}
                  onChange={(v) => {
                    setFrequency(v as AllowanceFrequency);
                    if (v === 'monthly' && anchorDay > 28) setAnchorDay(1);
                    if (v !== 'monthly' && anchorDay > 6) setAnchorDay(0);
                  }}
                  ariaLabel={t('banking.parent.allowanceFrequency')}
                />
              </div>
            </div>
            {frequency === 'monthly' ? (
              <Field label={t('banking.parent.allowanceDayOfMonth')} type="number" min={1} max={28} value={anchorDay} onChange={(e) => setAnchorDay(Number(e.target.value))} />
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="lf-label text-content">{t('banking.parent.allowanceDayOfWeek')}</span>
                <Dropdown value={String(anchorDay)} options={DAY_OF_WEEK_KEYS.map((k, i) => ({ value: String(i), label: t(`banking.days.${k}`) }))} onChange={(v) => setAnchorDay(Number(v))} ariaLabel={t('banking.parent.allowanceDayOfWeek')} />
              </div>
            )}
          </>
        )}
        {errorCode && <ErrorBanner code={errorCode} />}
        <Button type="button" variant="primary" className="self-start" disabled={saving} onClick={() => void onSave()}>
          {saving ? t('banking.parent.saving') : t('banking.parent.save')}
        </Button>
      </Card>
    </section>
  );
}

function SpendLimitSection({ token, kidId, status, onSaved }: { token: string | null; kidId: string; status: WireSpendLimitStatus; onSaved: (status: WireSpendLimitStatus) => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(status.configured);
  const [period, setPeriod] = useState<SpendLimitPeriod>(status.configured ? status.period : 'weekly');
  const [cap, setCap] = useState(status.configured ? status.cap : 50);
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function onSave() {
    if (!token || saving) return;
    setSaving(true);
    setErrorCode(null);
    const res = await api<{ status: WireSpendLimitStatus }>(`/banking/spend-limit/${kidId}`, { method: 'PUT', token, body: { period, cap, active } });
    setSaving(false);
    if (res.error) {
      setErrorCode(res.error.code);
      return;
    }
    onSaved(res.data.status);
  }

  return (
    <section aria-labelledby="banking-spend-limit-heading">
      <SectionHeading id="banking-spend-limit-heading" icon="trending_down" tone="warning">
        {t('banking.parent.spendLimitHeading')}
      </SectionHeading>
      <Card className="flex flex-col gap-4 p-5">
        <div className="lf-config-row flex items-center justify-between gap-3 p-3.5">
          <span className="lf-label text-content">{t('banking.parent.spendLimitActive')}</span>
          <button type="button" role="switch" aria-checked={active} onClick={() => setActive(!active)} className={cn('lf-switch', active && 'lf-switch-on')}>
            <span className="lf-switch-knob" />
          </button>
        </div>
        {active && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="lf-label text-content">{t('banking.parent.spendLimitPeriod')}</span>
              <Dropdown
                value={period}
                options={[
                  // S07.6 (D.7): the database counts a rolling window, it never "resets".
                  { value: 'weekly', label: t('banking.parent.spendLimitWindowWeekly') },
                  { value: 'monthly', label: t('banking.parent.spendLimitWindowMonthly') },
                ]}
                onChange={(v) => setPeriod(v as SpendLimitPeriod)}
                ariaLabel={t('banking.parent.spendLimitPeriod')}
              />
            </div>
            <Field label={t('banking.parent.spendLimitCap')} type="number" min={1} value={cap} onChange={(e) => setCap(Number(e.target.value))} />
          </div>
        )}
        <p className="lf-caption text-content-muted">{t('banking.parent.spendLimitHint')}</p>
        {status.configured && (
          <div className="flex flex-col gap-1.5">
            <span className="lf-caption text-content-muted">{t('banking.kid.spendLimitUsed', { used: status.used, cap: status.cap })}</span>
            <ProgressBar value={(status.used / status.cap) * 100} label={t('banking.parent.spendLimitHeading')} tone="accent" />
          </div>
        )}
        {errorCode && <ErrorBanner code={errorCode} />}
        <Button type="button" variant="primary" className="self-start" disabled={saving} onClick={() => void onSave()}>
          {saving ? t('banking.parent.saving') : t('banking.parent.save')}
        </Button>
      </Card>
    </section>
  );
}

export default ParentBankingControlPanel;
