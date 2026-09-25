import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { SavingsBonusSettings, type BonusNotice } from '@/rebuild/family/SavingsBonusSettings';
import { fetchKidBonus, saveKidBonus, type KidBonus } from '@/rebuild/family/familyMoneyApi';
import { hubSession } from '../family/familyHubSession';
import { familyMoneyCopy } from '../family/familyMoneyCopy';

/*
 * S07.3 (D.11) data plane for the Tutor's savings bonus, replacing the legacy
 * percentage-only section. The framing comes from the server (by the child's
 * age); every save is re-read so the surface shows what the server holds.
 */
export function SavingsBonusSettingsPanel(props: { kidUserId: string; kidName: string; token: string | null }) {
  return <ScopedSettings key={`${props.kidUserId}:${props.token}`} {...props} />;
}

const REFUSAL_COPY: Record<string, 'fixedForAge' | 'noAccount'> = { SAVINGS_BONUS_FIXED_FOR_AGE: 'fixedForAge', CONFLICT: 'noAccount' };

function ScopedSettings({ kidUserId, kidName, token }: { kidUserId: string; kidName: string; token: string | null }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = familyMoneyCopy(locale).bonusSettings;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<BonusNotice>(null);
  const [bonus, setBonus] = useState<KidBonus | null>(null);
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function load(keepNotice = false) {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    if (!keepNotice) setNotice(null);
    const res = await fetchKidBonus(kidUserId, hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setBonus(res.data);
    setVersion((v) => v + 1);
  }

  function toggle() {
    generation.current++;
    if (open) { setOpen(false); setNotice(null); return; }
    setOpen(true); void load();
  }

  async function save(input: { active: boolean; rateBp?: number }) {
    setBusy(true); setNotice(null);
    const res = await saveKidBonus(kidUserId, input, hubSession(token));
    setBusy(false);
    setNotice(res.ok ? { text: copy.saved, error: false } : { text: copy[REFUSAL_COPY[res.code] ?? 'saveFailed'], error: true });
    await load(true);
  }

  return <SavingsBonusSettings key={version} copy={copy} locale={locale} dark={isDark} kidName={kidName} open={open} loading={loading} failed={failed}
    busy={busy} notice={notice} bonus={bonus} onToggle={toggle} onRetry={() => void load()} onSave={(input) => void save(input)} />;
}
