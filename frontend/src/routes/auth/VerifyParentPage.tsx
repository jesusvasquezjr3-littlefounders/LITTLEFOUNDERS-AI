import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';
import { useShellLocale, useShellNavigate } from '@/app-shell/ShellRoot';
import { api } from '@/lib/api';
import { failureCode } from './failureCode';
import { VERIFICATION_CHECKS, VerifyParentScreen, type VerificationCheck, type VerifyValues, type VerifyView } from '@/rebuild/identity/VerifyParentScreen';

/*
 * `/verify-parent` (A7): universal to Tutor (the `parent` role) through ID
 * verification (the Guardian OCR flow). The photo goes to Core and on to
 * Guardian for an in-memory verdict; it is never stored anywhere.
 *
 * The status is Core's answer (GET /verification/parent), never the `parent`
 * role: a staff grant or a revoked verification must not read as "already a
 * Tutor" (A.5). PARENT_VERIFICATION_REVOKED ends at the support address; a
 * child account (FORBIDDEN) is told who can verify, with no retry that could
 * never succeed; any other failure is a retry, never a verdict.
 */
type Verdict = { verified: boolean; checks?: Record<string, boolean> };

function statusView(code: string): VerifyView {
  if (code === 'PARENT_VERIFICATION_REVOKED') return { kind: 'revoked' };
  if (code === 'FORBIDDEN') return { kind: 'ineligible' };
  return { kind: 'status-error', retrying: false };
}

export function VerifyParentPage() {
  const locale = useShellLocale();
  const onNavigate = useShellNavigate();
  const { getToken, refreshMe } = useAuth();
  const [view, setView] = useState<VerifyView>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      const { data, error } = await api<{ verified: boolean }>('/verification/parent', { token });
      if (cancelled) return;
      if (error || typeof data?.verified !== 'boolean') setView(statusView(error?.code ?? 'INTERNAL'));
      else setView(data.verified ? { kind: 'verified' } : { kind: 'intro' });
    })();
    return () => { cancelled = true; };
  }, [getToken, attempt]);

  async function submit(values: VerifyValues, failedChecks: readonly VerificationCheck[] | null) {
    setView({ kind: 'form', pending: true, errorCode: null, failedChecks });
    const token = await getToken();
    const form = new FormData();
    form.set('givenNames', values.givenNames);
    form.set('surnames', values.surnames);
    form.set('birthDate', values.birthDate);
    // A.5: no document type. It cannot be checked against the image, so it is not collected.
    form.set('document', values.document);
    const { data, error } = await api<Verdict>('/verification/parent', { formData: form, token });
    if (error) {
      if (error.code === 'ALREADY_VERIFIED') { setView({ kind: 'verified' }); return; }
      if (error.code === 'PARENT_VERIFICATION_REVOKED' || error.code === 'FORBIDDEN') { setView(statusView(error.code)); return; }
      setView({ kind: 'form', pending: false, errorCode: failureCode(error), failedChecks });
      return;
    }
    if (data.verified) {
      setView({ kind: 'success' });
      void refreshMe();
      return;
    }
    setView({ kind: 'form', pending: false, errorCode: null, failedChecks: VERIFICATION_CHECKS.filter((check) => data.checks?.[check] === false) });
  }

  return <VerifyParentScreen locale={locale} view={view} homeHref={APP_HOME} familyHref="/family" onNavigate={onNavigate}
    onRetryStatus={() => { setView({ kind: 'status-error', retrying: true }); setAttempt((n) => n + 1); }}
    onStart={() => setView({ kind: 'form', pending: false, errorCode: null, failedChecks: null })}
    onSubmit={(values) => void submit(values, view.kind === 'form' ? view.failedChecks : null)} />;
}
