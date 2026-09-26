import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { SavingsBonusExplainer } from '@/rebuild/family/SavingsBonusExplainer';
import { answerExample, fetchOwnBonus, recordExampleShown, type OwnBonus } from '@/rebuild/family/familyMoneyApi';
import { hubSession } from '../family/familyHubSession';
import { familyMoneyCopy } from '../family/familyMoneyCopy';
import { bonusScaffold } from '../family/coinAccountCopy';
import { useMoneyRegister } from '../family/useMoneyRegister';

/*
 * S07.3 (D.11) data plane for the child's own savings bonus explanation. The
 * worked example (13-17 only) records "shown" once and each answer; the
 * database checks the answer against the child's current rate.
 * S07.6 (D.12): the transition register (10-12) adds the "out of 100" bridge.
 */
export function SavingsBonusPanel({ token }: { token: string | null }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = familyMoneyCopy(locale);
  const register = useMoneyRegister(token);
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

  return <SavingsBonusExplainer scaffold={register ? bonusScaffold(locale, register) : null} young={copy.bonusYoung} teen={copy.bonusTeen} locale={locale} dark={isDark} bonus={bonus} loading={loading} failed={failed}
    onRetry={() => void load()} onExampleShown={() => void recordExampleShown(hubSession(token))}
    onAnswer={async (input) => {
      const res = await answerExample(input, hubSession(token));
      return res.ok ? res.data.correct : null;
    }} />;
}
