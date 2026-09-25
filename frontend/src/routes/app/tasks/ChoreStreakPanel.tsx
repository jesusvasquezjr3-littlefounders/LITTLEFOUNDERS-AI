import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { ChoreStreak } from '@/rebuild/family/ChoreStreak';
import { fetchOwnStreak, type ChoreStreak as Streak, type StreakMilestone } from '@/rebuild/family/familyMoneyApi';
import { hubSession } from '../family/familyHubSession';
import { familyMoneyCopy } from '../family/familyMoneyCopy';

/*
 * S07.3 (D.2) data plane for the child's chore streak. `refreshKey` changes
 * after each completion; `milestone` is the one Core returned for that
 * completion (only 7, 30 or 100, only on the day's first chore).
 */
export function ChoreStreakPanel({ token, refreshKey, milestone }: { token: string | null; refreshKey: number; milestone: StreakMilestone | null }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const [streak, setStreak] = useState<Streak | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setFailed(false);
    const res = await fetchOwnStreak(hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setStreak(res.data.streak);
  }, [token]);

  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => () => { generation.current++; }, []);

  return <ChoreStreak copy={familyMoneyCopy(locale).choreStreak} locale={locale} dark={isDark} streak={streak} loading={loading} failed={failed}
    milestone={milestone} onRetry={() => void load()} />;
}
