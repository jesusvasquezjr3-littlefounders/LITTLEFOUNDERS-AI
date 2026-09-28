import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import type { Locale } from '@/rebuild/design/copyBudget';
import { LearningBridges } from '@/rebuild/family/LearningBridges';
import { LearningNarrative } from '@/rebuild/family/LearningNarrative';
import { StreakPauseControl } from '@/rebuild/family/StreakPauseControl';
import { ChildDecisionsPanel } from '@/rebuild/learning/ChildDecisionsPanel';
import type { ChildDecisionsTransport } from '@/rebuild/learning/childDecisions';
import { endKidStreakPause, fetchKidStreak, setKidStreakPause, type KidStreakState, type StreakPauseTransport } from '@/rebuild/family/streakPause';
import { localDate } from '@/rebuild/learning/motivation';
import {
  actOnKidBridge,
  dismissKidBridge,
  fetchKidBridges,
  fetchKidNarrative,
  type BridgesState,
  type FamilyLearningTransport,
  type NarrativeState,
} from '@/rebuild/family/familyLearning';

/*
 * S05.3c's Family Hub data plane for two rebuilt surfaces, per child:
 *   LearningBridgesPanel    B.13's optional "try it for real" prompts, read on
 *                           mount (a prompt nobody sees is no bridge) and
 *                           absent when there is nothing to suggest;
 *   LearningNarrativePanel  B.10's course-learning narrative, read only when
 *                           the guardian opens it.
 *   StreakPausePanel        B.21's holiday pause (S05.3e): the child's streak
 *                           as it reads today and the pause the verified
 *                           parent may set or end.
 *   LearningDecisionsPanel  OD-27 (3) / L-13: which option a parent-created
 *                           child under 13 chose in each story decision.
 *                           Core answers JOURNAL_PRIVATE for a teen and the
 *                           panel then renders nothing (GAP-FIX-R2).
 * Core is the enforcing boundary (verified parent, verified link, one
 * transaction per real goal or task); these hosts only move data. Keyed by
 * child and session, so switching child never shows another child's rows.
 */

function useLocale(): Locale {
  const { i18n } = useTranslation();
  const value = i18n.resolvedLanguage ?? i18n.language;
  return value === 'es-MX' || value === 'pt-BR' ? value : 'en-US';
}

function useTransport(token: string | null): FamilyLearningTransport {
  return useCallback<FamilyLearningTransport>(async (path, init) => {
    if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
    return api<unknown>(path, { token, method: init?.method, body: init?.body });
  }, [token]);
}

export function LearningBridgesPanel(props: { kidUserId: string; token: string | null }) {
  return <ScopedBridges key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedBridges({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const locale = useLocale();
  const { isDark } = useTheme();
  const transport = useTransport(token);
  const [state, setState] = useState<BridgesState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchKidBridges(transport, kidUserId).then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [transport, kidUserId, revision]);
  return <LearningBridges state={state} locale={locale} dark={isDark}
    onAct={(promptId, details) => actOnKidBridge(transport, kidUserId, promptId, details)}
    onDismiss={(promptId) => dismissKidBridge(transport, kidUserId, promptId)}
    onRetry={() => { setState({ status: 'loading' }); setRevision((n) => n + 1); }} />;
}

export function LearningNarrativePanel(props: { kidUserId: string; token: string | null }) {
  return <ScopedNarrative key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedNarrative({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const locale = useLocale();
  const { isDark } = useTheme();
  const transport = useTransport(token);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<NarrativeState>({ status: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);

  async function load() {
    const current = ++generation.current;
    setState({ status: 'loading' });
    const next = await fetchKidNarrative(transport, kidUserId);
    if (current === generation.current) setState(next);
  }

  async function more() {
    if (state.status !== 'ready' || loadingMore) return;
    const current = generation.current;
    setLoadingMore(true);
    const next = await fetchKidNarrative(transport, kidUserId, state.entries.length);
    setLoadingMore(false);
    if (current !== generation.current) return;
    // L-13: Core re-decides on every page whether the Tutor sees the choices; a page that says no drops them all.
    if (next.status === 'ready') setState({ status: 'ready', week: state.week, entries: [...state.entries, ...next.entries], hasMore: next.hasMore,
      ...(next.choices ? { choices: [...(state.choices ?? []), ...next.choices] } : {}) });
  }

  return <LearningNarrative state={state} locale={locale} dark={isDark} open={open} loadingMore={loadingMore}
    onToggle={() => {
      if (open) { generation.current++; setOpen(false); return; }
      setOpen(true);
      void load();
    }}
    onRetry={() => void load()}
    onMore={() => void more()} />;
}

export function StreakPausePanel(props: { kidUserId: string; token: string | null }) {
  return <ScopedStreakPause key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedStreakPause({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const locale = useLocale();
  const { isDark } = useTheme();
  const today = localDate();
  const transport = useCallback<StreakPauseTransport>(async (path, init) => {
    if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
    return api<unknown>(path, { token, method: init?.method, body: init?.body });
  }, [token]);
  const [state, setState] = useState<KidStreakState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchKidStreak(transport, kidUserId, today).then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [transport, kidUserId, today, revision]);
  return <StreakPauseControl key={state.status} state={state} locale={locale} dark={isDark} today={today}
    onPause={(startsOn, endsOn) => setKidStreakPause(transport, kidUserId, startsOn, endsOn, today)}
    onEnd={() => endKidStreakPause(transport, kidUserId, today)}
    onRetry={() => { setState({ status: 'loading' }); setRevision((n) => n + 1); }} />;
}

export function LearningDecisionsPanel(props: { kidUserId: string; token: string | null }) {
  return <ScopedDecisions key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function ScopedDecisions({ kidUserId, token }: { kidUserId: string; token: string | null }) {
  const locale = useLocale();
  const { isDark } = useTheme();
  const transport = useCallback<ChildDecisionsTransport>(async (path, init) => {
    if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
    return api<unknown>(path, { token, method: init?.method });
  }, [token]);
  // Without a session there is nothing to ask Core; the panel mounts once the token is known.
  if (!token) return null;
  return <ChildDecisionsPanel kidId={kidUserId} locale={locale} dark={isDark} transport={transport} />;
}
