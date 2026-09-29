import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { CoopGoalsConsent, type CoopConsentView, type CoopGoalsList } from '@/rebuild/family/CoopGoalsConsent';
import { parseGuardianGoals } from '@/rebuild/family/coopGuardianGoals';
import en from '@/i18n/en-US/rebuild-family.json';
import es from '@/i18n/es-MX/rebuild-family.json';
import pt from '@/i18n/pt-BR/rebuild-family.json';

/*
 * L-04 (OD-27 (1)): the data plane of the Tutor's goals-together opt-in for
 * one child (GET/PUT /family/coop-goals/kids/:kidId). Core re-checks the
 * verified-parent gate and the verified link to this child on every request;
 * a malformed answer is a failure with a retry, never a guessed state. The
 * screen shows only what Core confirmed after a write.
 *
 * E.2 / Law 5 (GAP-FIX-R4): once the card is on (or the child is still in a
 * goal), it also reads GET /family/kids/:kidId/coop-goals, the child's open
 * goals and who is in them. A self-registered teen's goals are its own
 * (ACCOUNT_SELF_MANAGED): nothing is listed, and nothing is guessed.
 */

function parse(raw: unknown): Extract<CoopConsentView, { kind: 'ready' }> | null {
  const value = raw as { ageFits?: unknown; enabled?: unknown; openGoals?: unknown } | null;
  if (!value || typeof value.ageFits !== 'boolean' || typeof value.enabled !== 'boolean' || !Number.isInteger(value.openGoals)) return null;
  return { kind: 'ready', ageFits: value.ageFits, enabled: value.enabled, openGoals: value.openGoals as number };
}

export function CoopGoalsConsentPanel(props: { kidUserId: string; token: string | null; kidName: string }) {
  return <Scoped key={`${props.kidUserId}:${props.token}`} {...props} />;
}

function Scoped({ kidUserId, token, kidName }: { kidUserId: string; token: string | null; kidName: string }) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).familyCoopGoals;
  const [view, setView] = useState<CoopConsentView>({ kind: 'loading' });
  const [goals, setGoals] = useState<CoopGoalsList>({ kind: 'none' });
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const generation = useRef(0);
  const goalsGeneration = useRef(0);
  const path = `/family/coop-goals/kids/${encodeURIComponent(kidUserId)}`;
  const goalsPath = `/family/kids/${encodeURIComponent(kidUserId)}/coop-goals`;

  const readGoals = useCallback(async () => {
    const current = ++goalsGeneration.current;
    if (!token) { setGoals({ kind: 'failed' }); return; }
    setGoals({ kind: 'loading' });
    const result = await api<unknown>(goalsPath, { token });
    if (current !== goalsGeneration.current) return;
    if (result.error?.code === 'ACCOUNT_SELF_MANAGED') { setGoals({ kind: 'none' }); return; }
    const parsed = result.error ? null : parseGuardianGoals(result.data);
    setGoals(parsed ? { kind: 'ready', goals: parsed } : { kind: 'failed' });
  }, [goalsPath, token]);

  const show = useCallback((next: Extract<CoopConsentView, { kind: 'ready' }>) => {
    setView(next);
    if (next.enabled || next.openGoals > 0) void readGoals();
    else { goalsGeneration.current++; setGoals({ kind: 'none' }); }
  }, [readGoals]);

  const read = useCallback(async () => {
    const current = ++generation.current;
    if (!token) { setView({ kind: 'failed' }); return; }
    const result = await api<unknown>(path, { token });
    if (current !== generation.current) return;
    const next = parse(result.error ? null : result.data);
    if (next) show(next); else setView({ kind: 'failed' });
  }, [path, token, show]);

  useEffect(() => {
    void read();
    return () => { generation.current++; goalsGeneration.current++; };
  }, [read]);

  async function change(enabled: boolean) {
    if (!token || saving) return;
    setSaving(true); setSaveFailed(false);
    const result = await api<unknown>(path, { token, method: 'PUT', body: { enabled } });
    setSaving(false);
    const next = parse(result.error ? null : result.data);
    if (next) show(next); else setSaveFailed(true);
  }

  return <CoopGoalsConsent copy={copy} name={kidName} locale={locale} view={view} goals={goals} saving={saving} saveFailed={saveFailed}
    onChange={(enabled) => void change(enabled)} onRetry={() => { setView({ kind: 'loading' }); void read(); }} onRetryGoals={() => void readGoals()} />;
}
