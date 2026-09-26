import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { DecisionQueue, type QueueAction } from '@/rebuild/family/DecisionQueue';
import {
  approveChore, closeNudge, decideLevelRequest, decideReward, fetchDecisionQueue, removeChore, reviewSelfDirected, sendBackChore, type Queue,
} from '@/rebuild/family/familyAutonomyApi';
import type { Outcome } from '@/rebuild/family/familyHubApi';
import { hubSession } from '../family/familyHubSession';
import { familyAutonomyCopy, levelNames } from '../family/familyAutonomyCopy';
import { familyGovernanceCopy } from '../family/familyGovernanceCopy';

/*
 * S07.5 (D.17, D.18) data plane for the Tutor's decision queue on Tasks. It
 * replaces the legacy approve, cancel and deny buttons: every decision goes
 * through the reason-carrying routes, and every write is re-read.
 */
export function DecisionQueuePanel({ token, kids, refreshKey, onChanged }: {
  token: string | null;
  kids: { userId: string; displayName: string | null; username: string | null }[];
  refreshKey: number;
  onChanged?: () => void;
}) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = familyAutonomyCopy(locale);
  const governance = familyGovernanceCopy(locale);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setFailed(false);
    const res = await fetchDecisionQueue(hubSession(token));
    if (current !== generation.current) return;
    setLoading(false);
    if (!res.ok) { setFailed(true); return; }
    setQueue(res.data);
  }, [token]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const refusals: Record<string, string> = {
    DECISION_REASON_NOT_ACTIONABLE: copy.notYet.tooVague, DECISION_REASON_REQUIRED: copy.notYet.pickCode, DECISION_REVISIT_INVALID: copy.notYet.revisitInvalid,
    AUTONOMY_NOT_ELIGIBLE: copy.ladder.notReady,
  };
  const names = new Map(kids.map((k) => [k.userId, k.displayName ?? k.username ?? '']));
  const session = () => hubSession(token);

  async function act(action: QueueAction) {
    if (busy) return;
    setBusy(true); setNotice(null);
    let result: Outcome<unknown>;
    switch (action.kind) {
      case 'approveChore': result = await approveChore(action.chore.id, { reflection: action.reflection, note: action.note }, session()); break;
      case 'sendBack': result = await sendBackChore(action.chore.id, { ...action.notYet, reflection: action.reflection }, session()); break;
      case 'remove': result = await removeChore(action.chore.id, { ...action.notYet, reflection: action.reflection }, session()); break;
      case 'approveReward': result = await decideReward(action.reward.id, { approve: true, reflection: action.reflection, ...(action.note ? { note: action.note } : {}) }, session()); break;
      case 'deny': result = await decideReward(action.reward.id, { approve: false, ...action.notYet, reflection: action.reflection }, session()); break;
      case 'confirm': result = await reviewSelfDirected(action.review.id, { outcome: 'confirmed', reflection: action.reflection }, session()); break;
      case 'question': result = await reviewSelfDirected(action.review.id, { outcome: 'questioned', reasonCode: action.notYet.reasonCode, reason: action.notYet.reason, reflection: action.reflection }, session()); break;
      case 'grant': result = await decideLevelRequest(action.requestId, { grant: true, preapprovedLimit: 0, reflection: action.reflection }, session()); break;
      case 'decline': result = await decideLevelRequest(action.requestId, { grant: false, ...action.notYet, reflection: action.reflection }, session()); break;
      case 'closeNudge': result = await closeNudge(action.nudgeId, action.outcome, session()); break;
    }
    setBusy(false);
    setNotice(result.ok ? { text: copy.queue.done, error: false } : { text: refusals[result.code] ?? copy.queue.failed, error: true });
    await load();
    if (result.ok) onChanged?.();
  }

  return <DecisionQueue copy={copy.queue} notYetCopy={copy.notYet} reflectionCopy={governance.reflection} levelNames={levelNames(copy)} kidName={(id) => names.get(id) ?? ''}
    locale={locale} dark={isDark} queue={queue} loading={loading} failed={failed} busy={busy} notice={notice}
    onRetry={() => { setLoading(true); void load(); }} onAction={(action) => void act(action)} />;
}
