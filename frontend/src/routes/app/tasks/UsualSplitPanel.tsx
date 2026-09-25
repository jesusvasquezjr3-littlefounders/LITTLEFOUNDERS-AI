import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { UsualSplit } from '@/rebuild/family/UsualSplit';
import { fetchUsualSplit, saveUsualSplit, type Split, type UsualSplit as Usual } from '@/rebuild/family/moneyHabitsApi';
import { hubSession } from '../family/familyHubSession';
import { moneyHabitsInRegister } from '../family/coinAccountCopy';
import { useMoneyRegister } from '../family/useMoneyRegister';
import { DEFAULT_REGISTER } from '@/rebuild/family/moneyRegister';

/*
 * S07.4 (D.13) data plane for the child's own usual split. Loads only when
 * opened; a save is re-read so the surface shows what the server holds.
 * S07.6 (D.12): the count line is in the child's register.
 */
export function UsualSplitPanel({ token, onSaved }: { token: string | null; onSaved?: () => void }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const register = useMoneyRegister(token) ?? DEFAULT_REGISTER;
  const all = moneyHabitsInRegister(locale, register);
  const copy = { ...all.usualSplit, save: all.split.save, spend: all.split.spend, share: all.split.share, more: all.split.more, less: all.split.less };
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [value, setValue] = useState<Usual | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function load() {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    const res = await fetchUsualSplit(hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setValue(res.data);
  }

  async function save(split: Split) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const res = await saveUsualSplit(split, hubSession(token));
    setBusy(false);
    setNotice(res.ok ? { text: copy.saved, error: false } : { text: copy.failed, error: true });
    if (res.ok) { setValue(res.data); setVersion((v) => v + 1); onSaved?.(); }
  }

  return <UsualSplit key={version} register={register} copy={copy} locale={locale} dark={isDark} open={open} loading={loading} failed={failed} value={value} busy={busy} notice={notice}
      onToggle={() => { generation.current++; setNotice(null); if (open) { setOpen(false); } else { setOpen(true); void load(); } }}
      onRetry={() => void load()} onSave={(split) => void save(split)} />;
}
