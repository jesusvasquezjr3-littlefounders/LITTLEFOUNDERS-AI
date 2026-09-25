import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { ShareGiving } from '@/rebuild/family/ShareGiving';
import {
  archiveOwnDestination, createOwnDestination, fetchShare, pledgeGift, settleOwnGift, type ShareView,
} from '@/rebuild/family/moneyHabitsApi';
import { fetchBalances } from '@/rebuild/wallet/walletApi';
import { hubSession } from '../family/familyHubSession';
import { moneyHabitsCopy } from '../family/moneyHabitsCopy';

/*
 * S07.4 (D.14) data plane for the child's Share destination. `selfDirected`
 * is a self-registered teen (chooses their own places, logs what they did).
 * Every write is re-read with the Share balance; `onChanged` lets the page
 * refresh its own pockets.
 */
export function ShareGivingPanel({ token, refreshKey, selfDirected = false, onChanged }: {
  token: string | null; refreshKey: number; selfDirected?: boolean; onChanged?: () => void;
}) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = moneyHabitsCopy(locale);
  const [view, setView] = useState<ShareView | null>(null);
  const [available, setAvailable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setFailed(false);
    const [shareRes, balanceRes] = await Promise.all([fetchShare(hubSession(token)), fetchBalances(hubSession(token))]);
    if (current !== generation.current) return;
    setLoading(false);
    if (!shareRes.ok || !balanceRes.ok) { setFailed(true); return; }
    setView(shareRes.data);
    setAvailable(balanceRes.data.balances.share);
  }, [token]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const refusals: Record<string, string> = {
    INSUFFICIENT_BALANCE: copy.share.notEnough, ACCOUNT_FROZEN: copy.share.frozen, SHARE_DESTINATION_LIMIT: copy.shareTeen.limit,
    SHARE_GIFT_NOTE_REQUIRED: copy.shareTeen.noteRequired, VALIDATION_ERROR: copy.share.invalid,
  };

  async function write(run: () => Promise<{ ok: true } | { ok: false; code: string }>, success: string) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const result = await run();
    setBusy(false);
    setNotice(result.ok ? { text: success, error: false } : { text: refusals[result.code] ?? copy.share.failed, error: true });
    if (result.ok) { await load(); onChanged?.(); }
  }

  const session = () => hubSession(token);
  return <ShareGiving copy={copy.share} teenCopy={copy.shareTeen} locale={locale} dark={isDark} available={available} view={view}
    loading={loading} failed={failed} busy={busy} notice={notice} selfDirected={selfDirected}
    onRetry={() => { setLoading(true); void load(); }}
    onPledge={(destinationId, amount) => void write(() => pledgeGift(destinationId, amount, session()), copy.share.pledged)}
    onTakeBack={(gift) => void write(() => settleOwnGift(gift.id, 'returned', null, session()), copy.share.takenBack)}
    onAddPlace={(input) => void write(() => createOwnDestination(input, session()), copy.shareTeen.added)}
    onRemovePlace={(destination) => void write(() => archiveOwnDestination(destination.id, session()), copy.shareTeen.removed)}
    onMarkGiven={(gift, note) => void write(() => settleOwnGift(gift.id, 'given', note, session()), copy.shareTeen.givenNotice)} />;
}
