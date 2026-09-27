import { useCallback, useEffect, useState } from 'react';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';
import {
  answerInvitation, askSomeone, fetchCandidates, fetchTogether, leaveGoal, removeFromGoal, reportFromGoal, startGoal,
  type TogetherOutcome, type TogetherPerson, type TogetherState, type TogetherTransport,
} from '@/rebuild/learning/together';
import { TogetherView } from '@/rebuild/learning/TogetherView';
import { useLearnHost } from './learnHost';

/*
 * /learn/together — the host of goals together (L-04, OD-27 (1)) on the
 * learner shell. It reads GET /coop-goals and, only when the learner opens a
 * form, the people who may be asked; every action re-reads the page, so what
 * the screen shows is always what Core decided after the action. Core refuses
 * everyone who is not a 13-to-17 participant; the page then says it is not open.
 * The report dialog reuses the profile's report copy (E.3), one wording for
 * the one safety queue.
 */
const REPORT_COPY = { 'en-US': en.report, 'es-MX': es.report, 'pt-BR': pt.report } as const;

export function TogetherRoute() {
  const { locale, dark, transport, onNavigate, links } = useLearnHost();
  const request: TogetherTransport = transport;
  const [state, setState] = useState<TogetherState>({ status: 'loading' });
  const [candidates, setCandidates] = useState<TogetherPerson[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchTogether(request).then((next) => {
      if (!active) return;
      setRetrying(false);
      // A failed re-read after an action keeps the page the learner is reading.
      setState((prev) => (next.status === 'ready' || prev.status !== 'ready' ? next : prev));
    });
    return () => { active = false; };
  }, [request, revision]);

  const loadCandidates = useCallback(() => {
    setCandidates(null);
    void fetchCandidates(request).then((people) => setCandidates(people ?? []));
  }, [request]);

  const after = useCallback(async (action: Promise<TogetherOutcome>) => {
    const outcome = await action;
    setRevision((n) => n + 1);
    return outcome;
  }, []);

  return <TogetherView locale={locale} dark={dark} state={state} candidates={candidates} reportCopy={REPORT_COPY[locale]}
    retrying={retrying}
    onBack={() => onNavigate(links.home)}
    onRetry={() => { setRetrying(true); setRevision((n) => n + 1); }}
    onLoadCandidates={loadCandidates}
    onStart={(target, days, usernames) => after(startGoal(request, target, days, usernames))}
    onAsk={(goalId, username) => after(askSomeone(request, goalId, username))}
    onAnswer={(goalId, accept) => after(answerInvitation(request, goalId, accept))}
    onLeave={(goalId) => after(leaveGoal(request, goalId))}
    onRemove={(goalId, username) => after(removeFromGoal(request, goalId, username))}
    onReport={(goalId, username, category, note, leave) => after(reportFromGoal(request, goalId, username, category, note, leave))} />;
}

export default TogetherRoute;
