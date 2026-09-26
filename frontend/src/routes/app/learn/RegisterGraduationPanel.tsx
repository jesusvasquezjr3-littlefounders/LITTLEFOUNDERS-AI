import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import type { Locale } from '@/rebuild/design/copyBudget';
import { RegisterGraduationView } from '@/rebuild/learning/RegisterGraduationView';
import { acknowledgeGraduation, fetchLearnerRegister, type RegisterState, type RegisterTransport } from '@/rebuild/learning/learnerRegister';

/*
 * S05.3f host for the B.23 graduation moment on the learning home. Core says
 * whether a graduation is owed (a learner who used a younger register and has
 * now moved up); nothing shows otherwise, and a failed read shows nothing.
 * Once the learner acknowledges it, the card goes and never comes back. The
 * rebuilt surface imports nothing from the legacy app (Bible 02 rule 23).
 */
export function RegisterGraduationPanel() {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const { getToken } = useAuth();
  const [state, setState] = useState<RegisterState>({ status: 'loading' });
  const value = i18n.resolvedLanguage ?? i18n.language;
  const locale: Locale = value === 'es-MX' || value === 'pt-BR' ? value : 'en-US';

  const transport = useCallback<RegisterTransport>(async (path, init) => {
    const token = await getToken();
    if (!token) return { data: null, error: { code: 'UNAUTHORIZED' } };
    return api<unknown>(path, { token, method: init?.method, body: init?.body });
  }, [getToken]);

  useEffect(() => {
    let active = true;
    void fetchLearnerRegister(transport).then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [transport]);

  if (state.status !== 'ready' || !state.value.graduation) return null;
  const into = state.value.graduation.to;
  return <RegisterGraduationView into={into} locale={locale} dark={isDark}
    onAcknowledge={async () => {
      const saved = await acknowledgeGraduation(transport, into);
      if (saved) setState({ status: 'ready', value: { ...state.value, graduation: null } });
      return saved;
    }} />;
}
