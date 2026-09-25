import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { WalletCorrections, type DeliverableReward, type Notice } from '@/rebuild/family/WalletCorrections';
import {
  fetchGuardianActions,
  fetchKidGoals,
  fetchKidRedemptions,
  fetchOwnCatalog,
  fulfillRedemption,
  postGoalWithdrawal,
  postWalletAdjustment,
  type Bucket,
  type GuardianAction,
  type KidGoal,
} from '@/rebuild/family/familyHubApi';
import { hubSession } from './familyHubSession';
import en from '@/i18n/en-US/familyHub.json';
import es from '@/i18n/es-MX/familyHub.json';
import pt from '@/i18n/pt-BR/familyHub.json';

/*
 * S07.1 data plane for the guardian money flows (D.5 / OD-21): manual
 * adjustment and goal withdrawal (guardian-only, audited, required reason)
 * and reward delivery (redemption 'fulfilled'). Every write is re-read
 * afterwards so the surface shows what the server holds, not an optimistic
 * guess.
 */

export function WalletCorrectionsPanel(props: { kidUserId: string; kidName: string; token: string | null }) {
  return <ScopedWalletCorrections key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedWalletCorrections({ kidUserId, kidName, token }: { kidUserId: string; kidName: string; token: string | null }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).walletCorrections;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [goals, setGoals] = useState<KidGoal[]>([]);
  const [rewards, setRewards] = useState<DeliverableReward[]>([]);
  const [history, setHistory] = useState<GuardianAction[]>([]);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function load(keepNotice = false) {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    if (!keepNotice) setNotice(null);
    const [goalsRes, redemptionsRes, catalogRes, historyRes] = await Promise.all([
      fetchKidGoals(kidUserId, hubSession(token)),
      fetchKidRedemptions(kidUserId, hubSession(token)),
      fetchOwnCatalog(hubSession(token)),
      fetchGuardianActions(kidUserId, hubSession(token)),
    ]);
    if (current !== generation.current) return;
    setLoading(false);
    if (!goalsRes.ok || !redemptionsRes.ok || !historyRes.ok) { setFailed(true); return; }
    // A co-guardian's reward title is not in this Tutor's own catalog; it
    // falls back to a generic label rather than reading someone else's list.
    const titles = new Map(catalogRes.ok ? catalogRes.data.items.map((item) => [item.id, item.title]) : []);
    setGoals(goalsRes.data.goals);
    setRewards(redemptionsRes.data.redemptions
      .filter((r) => r.status === 'approved')
      .map((r) => ({ id: r.id, title: titles.get(r.catalogId) ?? null, approvedAt: r.decidedAt ?? r.createdAt })));
    setHistory(historyRes.data.actions);
  }

  const refusal: Record<string, string> = {
    INSUFFICIENT_BALANCE: copy.insufficient,
    GOAL_SAVINGS_PROTECTED: copy.protected,
    GOAL_BALANCE_INSUFFICIENT: copy.goalShort,
    VALIDATION_ERROR: copy.amountInvalid,
  };

  async function adjust(input: { bucket: Bucket; amount: number; reason: string }) {
    if (busy) return false;
    setBusy(true); setNotice(null);
    const result = await postWalletAdjustment(kidUserId, input, hubSession(token));
    setBusy(false);
    setNotice(result.ok ? { text: copy.saved, error: false } : { text: refusal[result.code] ?? copy.saveFailed, error: true });
    if (result.ok) void load(true);
    return result.ok;
  }

  async function withdraw(goalId: string, input: { amount: number; destination: 'spend' | 'save'; reason: string }) {
    if (busy) return false;
    setBusy(true); setNotice(null);
    const result = await postGoalWithdrawal(kidUserId, goalId, input, hubSession(token));
    setBusy(false);
    setNotice(result.ok ? { text: copy.moved, error: false } : { text: refusal[result.code] ?? copy.saveFailed, error: true });
    if (result.ok) void load(true);
    return result.ok;
  }

  async function deliver(redemptionId: string) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const result = await fulfillRedemption(redemptionId, hubSession(token));
    setBusy(false);
    setNotice(result.ok ? { text: copy.delivered, error: false } : { text: result.code === 'CONFLICT' ? copy.notApproved : copy.saveFailed, error: true });
    void load(true);
  }

  function toggle() {
    generation.current++;
    if (open) { setOpen(false); setBusy(false); setNotice(null); return; }
    setOpen(true); void load();
  }

  return <WalletCorrections copy={copy} locale={locale} dark={isDark} kidName={kidName} open={open} loading={loading} failed={failed}
    goals={goals} rewards={rewards} history={history} busy={busy} notice={notice}
    onToggle={toggle} onRetry={() => void load()} onAdjust={adjust} onWithdraw={withdraw} onDeliver={(id) => void deliver(id)} />;
}
