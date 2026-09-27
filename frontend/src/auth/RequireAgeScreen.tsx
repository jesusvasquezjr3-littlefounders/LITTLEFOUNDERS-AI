import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';
import { useTheme } from '@/theme/useTheme';
import { AgeScreen } from '@/rebuild/identity/AgeScreen';
import en from '@/i18n/en-US/rebuild-site.json';
import es from '@/i18n/es-MX/rebuild-site.json';
import pt from '@/i18n/pt-BR/rebuild-site.json';

interface Screening { required: boolean; ageBand: 'under_13' | '13_to_17' | 'adult' | null; protectedOrigin: boolean }
function validState(value: Screening | null): value is Screening {
  return !!value && typeof value.required === 'boolean' && typeof value.protectedOrigin === 'boolean' &&
    (value.required ? value.ageBand === null : ['under_13', '13_to_17', 'adult'].includes(value.ageBand ?? ''));
}

export function RequireAgeScreen({ children }: { children: ReactNode }) {
  const { session, getToken, logout, refreshMe } = useAuth();
  const { pathname } = useLocation();
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const identity = `${session?.user.id ?? ''}:${pathname}`;
  const currentIdentity = useRef(identity);
  const generation = useRef(0);
  currentIdentity.current = identity;
  const [result, setResult] = useState<{ identity: string; state: Screening | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<'invalid' | 'unavailable' | undefined>();
  useEffect(() => {
    generation.current += 1;
    let cancelled = false;
    setResult(null); setError(undefined); setSaving(false);
    void (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (!token) { setResult({ identity, state: null }); return; }
      const response = await api<Screening>('/auth/age-screen', { token });
      if (!cancelled) setResult({ identity, state: response.data });
    })();
    return () => { cancelled = true; generation.current += 1; };
  }, [identity, attempt, getToken]);
  const current = result?.identity === identity ? result : null;
  if (current && validState(current.state) && !current.state.required) return <>{children}</>;
  const locale = i18n.resolvedLanguage === 'es-MX' ? 'es-MX' : i18n.resolvedLanguage === 'pt-BR' ? 'pt-BR' : 'en-US';
  return <AgeScreen key={identity} locale={locale} dark={isDark} copy={({'en-US': en, 'es-MX': es, 'pt-BR': pt})[locale].ageScreen}
    state={!current ? 'loading' : !validState(current.state) ? 'error' : saving ? 'saving' : 'form'} error={error}
    onRetry={() => setAttempt(n => n + 1)} onExit={() => void logout()}
    onSubmit={(birthDate, birthMonth) => {
      const submissionGeneration = generation.current;
      const stale = () => currentIdentity.current !== identity || generation.current !== submissionGeneration;
      setSaving(true); setError(undefined);
      void (async () => {
        const token = await getToken();
        if (stale()) return;
        if (!token) { setSaving(false); setError('unavailable'); return; }
        // S-04 (OD-28): the month travels only for a 13-17 date, after the screen said why it is kept.
        const response = await api<Screening>('/auth/age-screen', { token, body: birthMonth ? { birthDate, birthMonth } : { birthDate } });
        if (stale()) return;
        setSaving(false);
        if (response.error || !validState(response.data) || response.data.required) {
          setError(response.error?.code === 'VALIDATION_ERROR' ? 'invalid' : 'unavailable'); return;
        }
        await refreshMe();
        if (stale()) return;
        setResult({ identity, state: response.data });
      })();
    }} />;
}
