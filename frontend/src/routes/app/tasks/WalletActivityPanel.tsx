import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { WalletActivity, type RewardLine } from '@/rebuild/family/WalletActivity';
import { fetchAvailableCatalog, fetchOwnLedger, fetchOwnRedemptions, type LedgerEntry } from '@/rebuild/family/familyHubApi';
import { hubSession } from '../family/familyHubSession';
import en from '@/i18n/en-US/familyHub.json';
import es from '@/i18n/es-MX/familyHub.json';
import pt from '@/i18n/pt-BR/familyHub.json';

/*
 * S07.1 consumer for the child: their own coin history with every Tutor
 * reason, and each reward's lifecycle through "You got it" (fulfilled).
 * Loads only when opened.
 */

export function WalletActivityPanel({ token }: { token: string | null }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).walletActivity;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [rewards, setRewards] = useState<RewardLine[]>([]);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function load() {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    const [ledgerRes, redemptionsRes, catalogRes] = await Promise.all([fetchOwnLedger(hubSession(token)), fetchOwnRedemptions(hubSession(token)), fetchAvailableCatalog(hubSession(token))]);
    if (current !== generation.current) return;
    setLoading(false);
    if (!ledgerRes.ok || !redemptionsRes.ok) { setFailed(true); setEntries([]); setRewards([]); return; }
    const titles = new Map(catalogRes.ok ? catalogRes.data.items.map((item) => [item.id, item.title]) : []);
    setEntries(ledgerRes.data.entries.slice(0, 30));
    setRewards(redemptionsRes.data.redemptions.slice(0, 20).map((r) => ({ id: r.id, title: titles.get(r.catalogId) ?? null, status: r.status, at: r.fulfilledAt ?? r.decidedAt ?? r.createdAt })));
  }

  function toggle() {
    generation.current++;
    if (open) { setOpen(false); setEntries([]); setRewards([]); return; }
    setOpen(true); void load();
  }

  return <WalletActivity copy={copy} locale={locale} dark={isDark} open={open} loading={loading} failed={failed}
    entries={entries} rewards={rewards} onToggle={toggle} onRetry={() => void load()} />;
}
