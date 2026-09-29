import { ANALYTICS_POLICY_SIGNAL, announceAnalyticsPolicyChange } from '@/lib/analyticsPolicySignal';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { configureInsights } from '@/lib/insights';

/*
 * The data plane of a self-managed teen's optional-analytics choice (H.1),
 * shared by the Settings card and the first-session step (F3-identity-site):
 * GET/PUT /auth/analytics-preference. Core decides who may manage it
 * (`canManage`: a screened 13-17 account that is not a guest, not a kid-role
 * account and not an under-13 origin) and whether a choice is on file
 * (`disclosed`). A write is confirmed against Core's answer before it is
 * shown; a policy signal from another tab re-reads.
 */

// `dialogueExperiment` (M-12, OD-26): this choice is also the consent for the Mentor's hint-style test; absent = not said.
export interface AnalyticsPreference { canManage: boolean; enabled: boolean; disclosed: boolean; dialogueExperiment?: boolean }
const valid = (value: AnalyticsPreference | null): value is AnalyticsPreference => !!value && typeof value.canManage === 'boolean'
  && typeof value.enabled === 'boolean' && typeof value.disclosed === 'boolean';

export function useTeenAnalyticsPreference(active = true) {
  const { getToken, refreshMe } = useAuth();
  const [preference, setPreference] = useState<AnalyticsPreference | null>(null);
  const [loading, setLoading] = useState(active); const [saving, setSaving] = useState(false);
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
    if (!active) return undefined;
    const current = ++generation.current; setLoading(true); setSaving(false); setError(null);
    void (async () => {
      const token = await getToken();
      if (current !== generation.current) return;
      const result = token ? await api<AnalyticsPreference>('/auth/analytics-preference', { token }) : null;
      if (current !== generation.current) return;
      setLoading(false);
      if (!valid(result?.data ?? null)) { setError('read'); return; }
      setPreference(result!.data);
    })();
    return () => { generation.current += 1; };
  }, [getToken, attempt, active]);

  const choose = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (!preference?.canManage || loading || writePending.current) return false;
    const current = generation.current;
    writePending.current = true;
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      if (current !== generation.current) return false;
      const result = token ? await api<AnalyticsPreference>('/auth/analytics-preference', { token, method: 'PUT', body: { enabled } }) : null;
      if (current !== generation.current) return false;
      // A signal during the write cannot cancel a mutation already sent to Core.
      // Read again after it settles instead of painting an earlier GET response.
      if (refreshRequested.current) {
        announceAnalyticsPolicyChange();
        await refreshMe();
        return false;
      }
      if (!valid(result?.data ?? null) || !result!.data?.canManage || result!.data.enabled !== enabled || !result!.data.disclosed) {
        setError('write'); return false;
      }
      // Clear queued and token-waiting optional events before reflecting revocation.
      if (!enabled) configureInsights({ enabled: false, getToken });
      setPreference(result!.data);
      announceAnalyticsPolicyChange();
      await refreshMe();
      return true;
    } finally {
      writePending.current = false;
      if (current === generation.current) {
        if (refreshRequested.current) {
          refreshRequested.current = false;
          setAttempt(value => value + 1);
        } else setSaving(false);
      }
    }
  }, [preference, loading, getToken, refreshMe]);

  return {
    preference, loading, saving, error,
    choose,
    toggle: () => choose(!(preference?.enabled ?? false)),
    retry: () => setAttempt(value => value + 1),
  };
}
