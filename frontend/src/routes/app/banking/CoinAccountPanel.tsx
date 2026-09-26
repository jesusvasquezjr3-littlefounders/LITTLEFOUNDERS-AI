import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { CoinAccount } from '@/rebuild/banking/CoinAccount';
import { fetchCoinAccount, setOwnFreeze, type CoinAccountView } from '@/rebuild/banking/bankingApi';
import { DEFAULT_REGISTER } from '@/rebuild/family/moneyRegister';
import { hubSession } from '../family/familyHubSession';
import { coinAccountCopy } from '../family/coinAccountCopy';

/*
 * S07.6 (D.7, D.12) data plane for the child's rebuilt coin account, mounted
 * in the Banking route in place of the legacy card, freeze switch, frozen
 * banner, spending-limit meter and statement summary. The register comes with
 * the account from Core; a freeze change is re-read, never assumed, and
 * `onChanged` lets the page refresh what a freeze holds.
 */
export function CoinAccountPanel({ token, refreshKey = 0, onChanged }: { token: string | null; refreshKey?: number; onChanged?: () => void }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const [view, setView] = useState<CoinAccountView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const register = view?.register ?? DEFAULT_REGISTER;
  const copy = coinAccountCopy(locale, register);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setFailed(false);
    const res = await fetchCoinAccount(hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setView(res.data);
  }, [token]);

  useEffect(() => { if (token) void load(); }, [load, token, refreshKey]);

  async function freeze(frozen: boolean) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const res = await setOwnFreeze(frozen, hubSession(token));
    await load();
    setBusy(false);
    setNotice(res.ok ? { text: frozen ? copy.frozenNotice : copy.unfrozenNotice, error: false } : { text: copy.changeFailed, error: true });
    if (res.ok) onChanged?.();
  }

  return <CoinAccount copy={copy} register={register} locale={locale} dark={isDark} view={view} loading={loading} failed={failed} busy={busy} notice={notice}
    onRetry={() => { setLoading(true); void load(); }} onFreeze={(frozen) => void freeze(frozen)} />;
}
