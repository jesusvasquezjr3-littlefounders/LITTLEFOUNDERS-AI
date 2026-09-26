import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { TutorFreeze } from '@/rebuild/banking/TutorFreeze';
import { fetchTutorFreeze, setTutorFreeze, type TutorFreezeView } from '@/rebuild/banking/bankingApi';
import { hubSession } from '../family/familyHubSession';
import { tutorFreezeCopy } from '../family/coinAccountCopy';

/*
 * S07.6 (D.7) data plane for the Tutor's rebuilt freeze card, mounted in the
 * Banking route in place of the legacy freeze switch. Every change is re-read
 * from Core, and `onChanged` lets the page refresh anything a freeze holds.
 */
export function TutorFreezePanel({ token, kidId, name, onChanged }: { token: string | null; kidId: string; name: string; onChanged?: () => void }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = tutorFreezeCopy(locale);
  const [view, setView] = useState<TutorFreezeView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setFailed(false);
    const res = await fetchTutorFreeze(kidId, hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setView(res.data);
  }, [token, kidId]);

  useEffect(() => { setLoading(true); setView(null); setNotice(null); if (token) void load(); }, [load, token]);

  async function freeze(frozen: boolean) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const res = await setTutorFreeze(kidId, frozen, hubSession(token));
    await load();
    setBusy(false);
    setNotice(res.ok ? { text: frozen ? copy.frozenNotice : copy.unfrozenNotice, error: false } : { text: copy.changeFailed, error: true });
    if (res.ok) onChanged?.();
  }

  return <TutorFreeze copy={copy} name={name} locale={locale} dark={isDark} view={view} loading={loading} failed={failed} busy={busy} notice={notice}
    onRetry={() => { setLoading(true); void load(); }} onFreeze={(frozen) => void freeze(frozen)} />;
}
