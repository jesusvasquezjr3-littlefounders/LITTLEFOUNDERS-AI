import { ANALYTICS_POLICY_SIGNAL, announceAnalyticsPolicyChange } from '@/lib/analyticsPolicySignal';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { api } from '@/lib/api';
import { configureInsights } from '@/lib/insights';
import { AnalyticsChoice } from '@/rebuild/privacy/AnalyticsChoice';
import en from '@/i18n/en-US/rebuild.json';
import es from '@/i18n/es-MX/rebuild.json';
import pt from '@/i18n/pt-BR/rebuild.json';

interface Preference { canManage: boolean; enabled: boolean; disclosed: boolean }
const valid = (value: Preference | null): value is Preference => !!value && typeof value.canManage === 'boolean' && typeof value.enabled === 'boolean' && typeof value.disclosed === 'boolean';
export function TeenAnalyticsSetting() {
  const { session, isGuest } = useAuth();
  return !session || isGuest ? null : <AccountAnalyticsSetting key={session.user.id} />;
}
function AccountAnalyticsSetting() {
  const { getToken, refreshMe } = useAuth();
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const [preference, setPreference] = useState<Preference | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState<'read' | 'write' | null>(null);
  const [attempt, setAttempt] = useState(0); const generation = useRef(0);
  const writePending = useRef(false); const refreshRequested = useRef(false);
  useEffect(() => {
    const invalidate = (event: StorageEvent) => {
      if (event.key !== ANALYTICS_POLICY_SIGNAL) return;
      if (writePending.current) refreshRequested.current = true;
      else setAttempt(value => value + 1);
    };
    window.addEventListener('storage', invalidate);
    return () => window.removeEventListener('storage', invalidate);
  }, []);
  useEffect(() => {
    const current = ++generation.current; setLoading(true); setSaving(false); setError(null);
    void (async () => {
      const token = await getToken();
      if (current !== generation.current) return;
      const result = token ? await api<Preference>('/auth/analytics-preference', { token }) : null;
      if (current !== generation.current) return;
      setLoading(false);
      if (!valid(result?.data ?? null)) { setError('read'); return; }
      setPreference(result!.data);
    })();
    return () => { generation.current += 1; };
  }, [getToken, attempt]);
  const toggle = async () => {
    if (!preference?.canManage || loading || writePending.current) return;
    const current = generation.current; const enabled = !preference.enabled;
    writePending.current = true;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      if (current !== generation.current) return;
      const result = token ? await api<Preference>('/auth/analytics-preference', { token, method: 'PUT', body: { enabled } }) : null;
      if (current !== generation.current) return;
      // A signal during the write cannot cancel a mutation already sent to Core.
      // Read again after it settles instead of painting an earlier GET response.
      if (refreshRequested.current) {
        announceAnalyticsPolicyChange();
        await refreshMe();
        return;
      }
      if (!valid(result?.data ?? null) || !result!.data?.canManage || result!.data.enabled !== enabled || !result!.data.disclosed) {
        setError('write'); return;
      }
      // Clear queued and token-waiting optional events before reflecting revocation.
      if (!enabled) configureInsights({ enabled: false, getToken });
      setPreference(result!.data);
      announceAnalyticsPolicyChange();
      await refreshMe();
    } finally {
      writePending.current = false;
      if (current === generation.current) {
        if (refreshRequested.current) {
          refreshRequested.current = false;
          setAttempt(value => value + 1);
        } else setSaving(false);
      }
    }
  };
  if (!loading && !error && preference?.canManage === false) return null;
  const locale = i18n.resolvedLanguage ?? 'en-US';
  return <AnalyticsChoice copy={(locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).analyticsChoice}
    locale={locale} dark={isDark} enabled={preference?.enabled ?? false} loading={loading} saving={saving} error={error}
    onToggle={() => void toggle()} onRetry={() => setAttempt(value => value + 1)} />;
}
