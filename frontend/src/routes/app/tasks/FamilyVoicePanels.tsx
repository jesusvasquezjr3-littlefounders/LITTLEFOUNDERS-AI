import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { ChoreDone } from '@/rebuild/family/ChoreDone';
import { DecisionNotes } from '@/rebuild/family/DecisionNotes';
import { MyLevel } from '@/rebuild/family/MyLevel';
import { RewardAsk } from '@/rebuild/family/RewardAsk';
import {
  askForLevel, askForReward, askToTalk, fetchMyAutonomy, fetchMyDecisions, markChoreDone, stepDown,
  type AutonomyView, type ChildRewardReason, type MyDecision,
} from '@/rebuild/family/familyAutonomyApi';
import { hubSession } from '../family/familyHubSession';
import { familyAutonomyCopy } from '../family/familyAutonomyCopy';

/*
 * S07.5 (D.17, D.18) data planes for the child's side on Tasks: their own
 * level, the notes on their decisions (with "Let's talk"), marking a chore
 * done with their own note, and asking for a reward with their reason.
 * Every answer shown is the server's.
 */

function useAutonomyCopy() {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  return { locale, dark: isDark, copy: familyAutonomyCopy(locale) };
}

export function MyLevelPanel({ token, refreshKey }: { token: string | null; refreshKey: number }) {
  const { locale, dark, copy } = useAutonomyCopy();
  const [view, setView] = useState<AutonomyView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setFailed(false);
    const res = await fetchMyAutonomy(hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setView(res.data);
  }, [token]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function write(run: () => Promise<{ ok: boolean }>, success: string) {
    if (busy) return;
    setBusy(true); setNotice(null);
    const result = await run();
    setBusy(false);
    setNotice(result.ok ? { text: success, error: false } : { text: copy.myLevel.failed, error: true });
    await load();
  }

  if (view && !view.autonomy.inFamily) return null;
  const names = { name1: copy.levels.name1, name2: copy.levels.name2, name3: copy.levels.name3 };
  const nameOf = (level: number) => (level >= 3 ? names.name3 : level === 2 ? names.name2 : names.name1);
  return <MyLevel copy={copy.myLevel} levels={copy.levels} locale={locale} dark={dark} view={view} loading={loading} failed={failed} busy={busy} notice={notice}
    onRetry={() => { setLoading(true); void load(); }}
    onAsk={(note) => void write(() => askForLevel(note, hubSession(token)), copy.myLevel.asked)}
    onStepDown={() => void write(() => stepDown(hubSession(token)), copy.myLevel.steppedDown.replace('{name}', nameOf((view?.autonomy.storedLevel ?? 2) - 1)))} />;
}

export function DecisionNotesPanel({ token, refreshKey }: { token: string | null; refreshKey: number }) {
  const { locale, dark, copy } = useAutonomyCopy();
  const [decisions, setDecisions] = useState<MyDecision[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setFailed(false);
    const res = await fetchMyDecisions(hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setDecisions(res.data.decisions);
  }, [token]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function talk(decision: MyDecision) {
    if (busy) return;
    setBusy(true);
    await askToTalk(decision.id, hubSession(token));
    setBusy(false);
    await load();
  }

  return <DecisionNotes copy={copy.notes} codes={copy.childCodes} locale={locale} dark={dark} decisions={decisions} loading={loading} failed={failed}
    busy={busy} onRetry={() => { setLoading(true); void load(); }} onTalk={(d) => void talk(d)} />;
}

/** The kid's local calendar day, guaranteed YYYY-MM-DD (the chore streak's anchor). */
function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ChoreDonePanel({ token, taskId, title, onMarked }: {
  token: string | null; taskId: string; title: string;
  onMarked: (answer: { task: Record<string, unknown>; selfLogged: boolean; milestone?: unknown }) => void;
}) {
  const { locale, dark, copy } = useAutonomyCopy();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'counted' | 'sent' | 'failed' | null>(null);

  async function done(note: string | null) {
    if (busy) return;
    setBusy(true);
    const res = await markChoreDone(taskId, { localDate: localDay(), note }, hubSession(token));
    setBusy(false);
    if (!res.ok) { setResult('failed'); return; }
    setResult(res.data.selfLogged ? 'counted' : 'sent');
    onMarked(res.data);
  }

  return <ChoreDone copy={copy.choreDone} title={title} locale={locale} dark={dark} busy={busy} result={result} onDone={(note) => void done(note)} />;
}

export function RewardAskPanel({ token, catalogId, title, disabled, onAsked }: {
  token: string | null; catalogId: string; title: string; disabled: boolean;
  onAsked: (answer: { redemption: Record<string, unknown>; preapproved: boolean }) => void;
}) {
  const { locale, dark, copy } = useAutonomyCopy();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'approved' | 'asked' | 'limit' | 'hold' | 'failed' | null>(null);

  async function ask(input: { reasonKind: ChildRewardReason; note: string | null }) {
    if (busy) return;
    setBusy(true);
    const res = await askForReward(catalogId, input, hubSession(token));
    setBusy(false);
    if (!res.ok) {
      setResult(res.code === 'SPEND_LIMIT_REACHED' ? 'limit' : res.code === 'ACCOUNT_FROZEN' ? 'hold' : 'failed');
      return;
    }
    setResult(res.data.preapproved ? 'approved' : 'asked');
    onAsked(res.data);
  }

  return <RewardAsk copy={copy.rewardAsk} title={title} locale={locale} dark={dark} busy={busy} disabled={disabled} result={result} onAsk={(input) => void ask(input)} />;
}
