import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { SavingsBonusExplainer } from '@/rebuild/family/SavingsBonusExplainer';
import { answerExample, fetchOwnBonus, recordExampleShown, type OwnBonus } from '@/rebuild/family/familyMoneyApi';
import { hubSession } from '../family/familyHubSession';
import { familyMoneyCopy } from '../family/familyMoneyCopy';

/*
 * S07.3 (D.11) data plane for the child's own savings bonus explanation. The
 * worked example (13-17 only) records "shown" once and each answer; the
 * database checks the answer against the child's current rate.
 */
export function SavingsBonusPanel({ token }: { token: string | null }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = familyMoneyCopy(locale);
  const [bonus, setBonus] = useState<OwnBonus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    const res = await fetchOwnBonus(hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setBonus(res.data);
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { generation.current++; }, []);

  return <SavingsBonusExplainer young={copy.bonusYoung} teen={copy.bonusTeen} locale={locale} dark={isDark} bonus={bonus} loading={loading} failed={failed}
    onRetry={() => void load()} onExampleShown={() => void recordExampleShown(hubSession(token))}
    onAnswer={async (input) => {
      const res = await answerExample(input, hubSession(token));
      return res.ok ? res.data.correct : null;
    }} />;
}
