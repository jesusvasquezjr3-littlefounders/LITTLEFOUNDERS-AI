import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { SavingsGoals } from '@/rebuild/family/SavingsGoals';
import { archiveHabitGoal, createHabitGoal, declineNextStep, fetchHabitGoals, markNextStepSeen, type HabitGoal } from '@/rebuild/family/moneyHabitsApi';
import { hubSession } from '../family/familyHubSession';
import { moneyHabitsCopy } from '../family/moneyHabitsCopy';

/*
 * S07.4 data plane for a child's savings goals (D.15, D.16), mounted in the
 * Tasks and Banking routes in place of the legacy goal lists. Every write is
 * re-read, so the surface shows what the server holds; `refreshKey` changes
 * after a payout lands so a goal the payout reached celebrates right away.
 */
export function SavingsGoalsPanel({ token, refreshKey }: { token: string | null; refreshKey: number }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = moneyHabitsCopy(locale);
  const [goals, setGoals] = useState<HabitGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [nextNotice, setNextNotice] = useState<{ goalId: string; text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setFailed(false);
    const res = await fetchHabitGoals(hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setGoals(res.data.goals);
  }, [token]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  async function write(run: () => Promise<{ ok: boolean }>, success: string, failure: string, goalId?: string) {
    if (busy) return;
    setBusy(true); setNotice(null); setNextNotice(null);
    const result = await run();
    setBusy(false);
    const next = { text: result.ok ? success : failure, error: !result.ok };
    if (goalId && !result.ok) setNextNotice({ goalId, ...next });
    else setNotice(next);
    if (result.ok) await load();
  }

  return <SavingsGoals copy={copy.goals} progressCopy={copy.goalProgress} nextCopy={copy.nextGoal} locale={locale} dark={isDark}
    goals={goals} loading={loading} failed={failed} busy={busy} notice={notice} nextNotice={nextNotice}
    onRetry={() => { setLoading(true); void load(); }}
    onCreate={(input) => void write(() => createHabitGoal({ ...input, followsGoalId: null }, hubSession(token)), copy.goals.created, copy.goals.failed)}
    onArchive={(goal) => void write(() => archiveHabitGoal(goal.id, hubSession(token)), copy.goals.archived, copy.goals.failed)}
    onSeen={async (goal) => {
      const res = await markNextStepSeen(goal.id, hubSession(token));
      return res.ok && res.data.celebrate;
    }}
    onStartNext={(goal, input) => void write(() => createHabitGoal({ ...input, followsGoalId: goal.id }, hubSession(token)), copy.nextGoal.started, copy.nextGoal.failed, goal.id)}
    onNotNow={(goal) => void write(() => declineNextStep(goal.id, hubSession(token)), copy.nextGoal.later, copy.nextGoal.failed, goal.id)} />;
}
