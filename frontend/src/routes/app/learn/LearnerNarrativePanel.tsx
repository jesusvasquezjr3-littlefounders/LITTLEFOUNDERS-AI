import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import type { Locale } from '@/rebuild/design/copyBudget';
import { LearnerNarrativeShortcut } from '@/rebuild/learning/LearnerNarrativeShortcut';
import { answerSelfBridge, fetchSelfBridges, type NarrativeTransport, type SelfBridge } from '@/rebuild/learning/narrative';
import { decisionJournalPath } from './paths';

/*
 * S05.3c host for the rebuilt learner shortcut on the learning home: reads an
 * independent teen's self prompts (Core returns none to anyone else) and links
 * to the decision journal. A failed read shows the link alone. The rebuilt
 * surface imports nothing from the legacy app (Bible 02 rule 23).
 */
export function LearnerNarrativePanel() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const { getToken } = useAuth();
  const [bridges, setBridges] = useState<SelfBridge[]>([]);
  const value = i18n.resolvedLanguage ?? i18n.language;
  const locale: Locale = value === 'es-MX' || value === 'pt-BR' ? value : 'en-US';

  const transport = useCallback<NarrativeTransport>(async (path, init) => {
    const token = await getToken();
    if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
    return api<unknown>(path, { token, method: init?.method, body: init?.body });
  }, [getToken]);

  useEffect(() => {
    let active = true;
    void fetchSelfBridges(transport).then((next) => { if (active) setBridges(next); });
    return () => { active = false; };
  }, [transport]);

  return <LearnerNarrativeShortcut bridges={bridges} locale={locale} dark={isDark}
    onOpenJournal={() => navigate(decisionJournalPath())}
    onBridge={(id, answer) => answerSelfBridge(transport, id, answer)} />;
}
