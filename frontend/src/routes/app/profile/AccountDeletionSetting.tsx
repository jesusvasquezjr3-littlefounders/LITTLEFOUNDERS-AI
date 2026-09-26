import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { BASE_URL } from '@/lib/api';
import { AccountDeletion, type AccountDeletionView } from '@/rebuild/account/AccountDeletion';
import { cancelAccountDeletion, getDeletionState, requestAccountDeletion } from '@/rebuild/account/deletionClient';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';

/*
 * Product 10 E.6 in Settings: the legacy page mounts the rebuilt deletion
 * surface as a self-contained block (no restyle of the legacy screen). This
 * wrapper only moves data: Core's GET decides the state, the POST decides
 * the outcome, and a malformed answer is "unavailable", never a guess.
 *
 * After a confirmed request the session is over either way (Core signed a
 * scheduled account out everywhere; an erased account has no session), so
 * the wrapper signs out locally and hands the outcome to /account-deletion,
 * the one public screen that states the date or the deletion.
 */

export function AccountDeletionSetting() {
  const { session } = useAuth();
  return session ? <ScopedAccountDeletion key={session.user.id} /> : null;
}

function ScopedAccountDeletion() {
  const { getToken, logout, refreshMe } = useAuth();
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [view, setView] = useState<AccountDeletionView>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).accountDeletion;

  useEffect(() => {
    const current = ++generation.current;
    setView({ kind: 'loading' });
    void (async () => {
      const token = await getToken();
      const result = token ? await getDeletionState({ baseUrl: BASE_URL, token }) : null;
      if (current !== generation.current) return;
      if (!result || !result.ok) { setView({ kind: 'unavailable' }); return; }
      const { deletion, eligibility } = result.value;
      if (deletion) {
        setView({ kind: 'scheduled', status: deletion.status, scheduledFor: deletion.scheduledFor, signedOut: false, keeping: false, keepFailed: false });
      } else if (!eligibility.allowed) {
        setView({ kind: 'blocked', reason: eligibility.reason });
      } else {
        setView({
          kind: 'ready', step: 'intro', immediate: eligibility.immediate, graceDays: eligibility.graceDays,
          reauth: eligibility.reauth, pausedChildren: eligibility.children.lastTutorOf, submitting: false, error: null,
        });
      }
    })();
    return () => { generation.current += 1; };
  }, [getToken, attempt]);

  const setReady = useCallback((patch: Partial<Extract<AccountDeletionView, { kind: 'ready' }>>) => {
    setView((current) => (current.kind === 'ready' ? { ...current, ...patch } : current));
  }, []);

  const confirm = async ({ password }: { password: string | null }) => {
    if (view.kind !== 'ready' || view.submitting) return;
    const current = generation.current;
    setReady({ submitting: true, error: null });
    const token = await getToken();
    const result = token
      ? await requestAccountDeletion({ baseUrl: BASE_URL, token, ...(password ? { currentPassword: password } : {}) })
      : { ok: false as const, code: 'UNAVAILABLE' };
    if (current !== generation.current) return;
    if (!result.ok) {
      if (result.code === 'DELETION_ALREADY_OPEN') { setAttempt((value) => value + 1); return; }
      setReady({
        submitting: false,
        error: result.code === 'INVALID_CREDENTIALS' ? 'password' : result.code === 'REAUTH_REQUIRED' ? 'reauth' : 'failed',
      });
      return;
    }
    const outcome = result.value;
    if (outcome.status === 'held' || outcome.status === 'processing') {
      // The account still exists (a safety review holds it, or a step is
      // being retried): show Core's own state rather than a guess.
      setAttempt((value) => value + 1);
      return;
    }
    // Leave the protected route first, so the sign-out below cannot bounce
    // the holder to /login before the outcome is on screen.
    navigate('/account-deletion', {
      replace: true,
      state: outcome.status === 'pending'
        ? { deletion: { kind: 'scheduled', scheduledFor: outcome.scheduledFor } }
        : { deletion: { kind: 'deleted', finishing: outcome.status === 'finishing' } },
    });
    await logout();
  };

  const keep = async () => {
    if (view.kind !== 'scheduled' || view.keeping) return;
    const current = generation.current;
    setView({ ...view, keeping: true, keepFailed: false });
    const token = await getToken();
    const result = token ? await cancelAccountDeletion({ baseUrl: BASE_URL, token }) : { ok: false as const, code: 'UNAVAILABLE' };
    if (current !== generation.current) return;
    if (!result.ok) { setView({ ...view, keeping: false, keepFailed: true }); return; }
    setView({ kind: 'kept' });
    await refreshMe();
  };

  const signInAgain = async () => {
    await logout();
    navigate('/login', { replace: true, state: { from: '/profile/settings' } });
  };

  return <AccountDeletion copy={copy} locale={locale} dark={isDark} view={view}
      onStart={() => setReady({ step: 'confirm', error: null })}
      onBack={() => setReady({ step: 'intro', error: null })}
      onConfirm={(input) => void confirm(input)}
      onKeep={() => void keep()}
      onRetry={() => setAttempt((value) => value + 1)}
      onSignIn={() => void signInAgain()} />;
}
