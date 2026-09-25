import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import type { Locale } from '@/rebuild/design/copyBudget';
import { LearningRhythmView } from '@/rebuild/learning/LearningRhythmView';
import { fetchRhythm, savePace, type MotivationTransport, type RhythmState } from '@/rebuild/learning/motivation';

/*
 * /learn/rhythm — the thin transport wrapper around the rebuilt learner rhythm
 * (B.21 habit streak, B.24 autonomy levers; S05.3e). Core decides everything:
 * how the streak reads today, the learner's pace and their Mentor. The rebuilt
 * surface imports nothing from the legacy app (Bible 02 rule 23); wave 2
 * composes it into the finished learner navigation.
 */
export function LearningRhythmRoute() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const { getToken } = useAuth();
  const [state, setState] = useState<RhythmState>({ status: 'loading' });
  const [revision, setRevision] = useState(0);
  const value = i18n.resolvedLanguage ?? i18n.language;
  const locale: Locale = value === 'es-MX' || value === 'pt-BR' ? value : 'en-US';

  const transport = useCallback<MotivationTransport>(async (path, init) => {
    const token = await getToken();
    if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
    return api<unknown>(path, { token, method: init?.method, body: init?.body });
  }, [getToken]);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void fetchRhythm(transport).then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [transport, revision]);

  return <LearningRhythmView state={state} locale={locale} dark={isDark}
    onBack={() => navigate('/learn')}
    onRetry={() => setRevision((n) => n + 1)}
    onSavePace={(goal) => savePace(transport, goal)}
    onOpenPath={() => navigate('/learn')}
    onOpenMentor={() => navigate('/tutor')} />;
}

export default LearningRhythmRoute;
