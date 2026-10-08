import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import type { Locale } from '@/rebuild/design/copyBudget';
import { useRebuildEnvironment } from '@/rebuild/design/layers';
import { clearJournal, fetchJournal, type JournalState, type NarrativeTransport } from '@/rebuild/learning/narrative';
import { DecisionJournalView } from '@/rebuild/learning/DecisionJournalView';

/*
 * /learn/journal — the thin transport wrapper around the rebuilt decision
 * journal. Core decides which entries are the caller's own.
 * The rebuilt surface imports
 * nothing from the legacy app.
 */
export function DecisionJournalRoute() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const { getToken } = useAuth();
  // The band the learner shell resolved once from Core's register; the youngest outside it.
  const ageBand = useRebuildEnvironment().ageBand ?? '6-9';
  const [state, setState] = useState<JournalState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const locale: Locale = i18n.language === 'es-MX' || i18n.language === 'pt-BR' ? i18n.language : 'en-US';

  const transport = useCallback<NarrativeTransport>(async (path, init) => {
    const token = await getToken();
    return api<unknown>(path, { token, method: init?.method, body: init?.body });
  }, [getToken]);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void fetchJournal(transport).then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [transport, revision]);

  async function more() {
    if (state.status !== 'ready' || loadingMore) return;
    setLoadingMore(true);
    const next = await fetchJournal(transport, state.entries.length);
    setLoadingMore(false);
    if (next.status === 'ready') setState({ ...state, entries: [...state.entries, ...next.entries], hasMore: next.hasMore });
  }

  return <DecisionJournalView state={state} locale={locale} dark={isDark} ageBand={ageBand} loadingMore={loadingMore}
    onBack={() => navigate('/learn')}
    onRetry={() => setRevision((n) => n + 1)}
    onMore={() => void more()}
    onClear={() => clearJournal(transport)} />;
}

export default DecisionJournalRoute;
