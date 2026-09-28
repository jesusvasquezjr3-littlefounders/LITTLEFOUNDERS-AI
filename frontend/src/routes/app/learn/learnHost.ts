import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import { useShellLocale } from '@/app-shell/ShellRoot';
import type { AgeBand } from '@/rebuild/design/copyBudget';
import type { LearnLinks, LearnNavigate } from '@/rebuild/learning/learnCopy';
import type { LearnTransport } from '@/rebuild/learning/learnHome';
import { fetchLearnerRegister, type RegisterState, type RegisterTransport } from '@/rebuild/learning/learnerRegister';
import { coursePath, decisionJournalPath, learningRhythmPath, lessonPath, placementPath, territoryPath, togetherPath } from './paths';

/*
 * W2L: what every rebuilt learner page host needs from the application, in
 * one place: the learner's session transport to Core, the language and mode
 * the shell shows, the route table as links, and Core's register (the Copy
 * Budget band a page reads in; the youngest while it is unknown, the most
 * protective reading). The rebuilt surfaces import nothing from the legacy app
 * (Bible 02 rule 23); these hosts are the bridge.
 */

export const LEARN_LINKS: LearnLinks = {
  home: '/learn',
  course: coursePath,
  lesson: lessonPath,
  placement: placementPath,
  territory: territoryPath,
  rhythm: learningRhythmPath(),
  // Bible 08 §8 (GAP-FIX-R1): the home card's way to the learner's Mentor.
  mentor: '/tutor',
  journal: decisionJournalPath(),
  together: togetherPath(),
};

type Reply = Awaited<ReturnType<LearnTransport>>;

/**
 * Core with the learner's own session. A request that never arrived reads as
 * `NETWORK` (api() reports it as INTERNAL "Network error"), so a page can say
 * "offline" instead of "unavailable".
 */
export function useLearnTransport() {
  const { getToken } = useAuth();
  return useCallback(async (path: string, init?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }): Promise<Reply> => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { data: null, error: { code: 'NETWORK' } };
    const token = await getToken();
    if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
    const { data, error } = await api<unknown>(path, { token, method: init?.method, body: init?.body });
    if (error) return { data: null, error: error.code === 'INTERNAL' && error.message === 'Network error' ? { code: 'NETWORK' } : error };
    return { data, error: null };
  }, [getToken]);
}

export function useLearnHost() {
  const navigate = useNavigate();
  const locale = useShellLocale();
  const { isDark } = useTheme();
  const transport = useLearnTransport();
  const onNavigate = useCallback<LearnNavigate>((href, state) => navigate(href, state ? { state } : undefined), [navigate]);
  return { locale, dark: isDark, transport, links: LEARN_LINKS, onNavigate };
}

/** Core's register for this learner (B.23): the band a page's Copy Budget reads in. */
export function useLearnerRegister(transport: RegisterTransport): [RegisterState, (next: RegisterState) => void] {
  const [state, setState] = useState<RegisterState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    void fetchLearnerRegister(transport).then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [transport]);
  return [state, setState];
}

export function bandOf(register: RegisterState): AgeBand {
  return register.status === 'ready' ? register.value.copy_band : '6-9';
}
