import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { Button, Copy, StatusMark } from '@/rebuild/design/controls';
import { SplitChooser } from '@/rebuild/family/SplitChooser';
import { allocateCredit, allocateTask, fetchHabitGoals, fetchUsualSplit, type HabitGoal, type Split } from '@/rebuild/family/moneyHabitsApi';
import { hubSession } from '../family/familyHubSession';
import { moneyHabitsCopy } from '../family/moneyHabitsCopy';
import '@/rebuild/design/tokens.css';
import '@/rebuild/design/system.css';
import '@/rebuild/family/familyHub.css';

/*
 * S07.4 (D.13) data plane for one payout waiting to be split: a chore reward
 * (kind 'task') or an allowance (kind 'credit'). Closed, it is one line with
 * "Split them"; open, it loads the child's usual split and active goals and
 * offers the pre-split payout. The server records the default and the
 * choice. A refusal is shown, never an assumed success.
 */
export function AllocationPanel({ token, kind, id, amount, title, frozen = false, onDone }: {
  token: string | null;
  kind: 'task' | 'credit';
  id: string;
  amount: number;
  /** The chore's title, when it is a chore reward. */
  title?: string;
  frozen?: boolean;
  onDone: (goal: HabitGoal | null) => void;
}) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = moneyHabitsCopy(locale).split;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [usual, setUsual] = useState<Split | null>(null);
  const [goals, setGoals] = useState<HabitGoal[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setState('loading');
    const [splitRes, goalsRes] = await Promise.all([fetchUsualSplit(hubSession(token)), fetchHabitGoals(hubSession(token))]);
    if (current !== generation.current) return;
    if (!splitRes.ok || !goalsRes.ok) { setState('failed'); return; }
    setUsual(splitRes.data.usual);
    setGoals(goalsRes.data.goals);
    setState('ready');
  }, [token]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  async function submit(split: Split, goalId: string | null) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const session = hubSession(token);
    const result = kind === 'task' ? await allocateTask(id, split, goalId, session) : await allocateCredit(id, split, goalId, session);
    setBusy(false);
    if (!result.ok) {
      setNotice({ text: result.code === 'ACCOUNT_FROZEN' ? copy.frozen : result.code === 'CONFLICT' ? copy.mismatch.replace('{count}', String(amount)) : copy.failed, error: true });
      return;
    }
    setNotice({ text: copy.added, error: false });
    onDone((result.data as { goal?: HabitGoal | null }).goal ?? null);
  }

  if (!open) {
    return <section className="lf-rebuild lf-family-hub lf-money-habits" data-money-habits="allocation" data-theme={isDark ? 'dark' : 'light'} lang={locale}
      aria-label={copy.ready.replace('{count}', String(amount))}>
      <div className="lf-family-hub-row">
        <span data-copy-role="data">{title ? <span className="ugc">{title} · </span> : null}{copy.ready.replace('{count}', String(amount))}</span>
        <Button variant="accent" disabled={frozen} onClick={() => setOpen(true)}>{copy.splitNow}</Button>
      </div>
      {frozen && <Copy role="body">{copy.frozen}</Copy>}
    </section>;
  }

  const theme = isDark ? 'dark' : 'light';
  if (state === 'failed') {
    return <section className="lf-rebuild lf-family-hub" data-money-habits="allocation" data-theme={theme} lang={locale}>
      <div className="lf-family-hub-notice" role="alert"><StatusMark correct={false} /><Copy role="body">{copy.failed}</Copy></div>
      <Button onClick={() => void load()}>{copy.retry}</Button>
    </section>;
  }
  if (state === 'loading' || !usual) {
    return <section className="lf-rebuild lf-family-hub" data-money-habits="allocation" data-theme={theme} lang={locale}>
      <div role="status"><Copy role="body">{copy.loading}</Copy></div>
    </section>;
  }
  return <SplitChooser copy={copy} locale={locale} dark={isDark} amount={amount} usual={usual} goals={goals} busy={busy} notice={notice}
    onSubmit={(split, goalId) => void submit(split, goalId)} onCancel={() => { setOpen(false); setNotice(null); }} />;
}
