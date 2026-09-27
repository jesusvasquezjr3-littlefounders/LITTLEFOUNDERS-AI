import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { playPlatformSound } from '@/lib/sound';
import { useShellLocale, useShellNavigate } from '@/app-shell/ShellRoot';
import { ResetPasswordScreen, type ResetView } from '@/rebuild/identity/RecoveryScreens';
import { failureCode } from './failureCode';

/*
 * `/reset-password` (A4), the recovery email's link (GoTrue redirect_to, Core
 * POST /auth/recover). GoTrue hands back a short-lived `type=recovery` session
 * in the URL fragment. It is never kept as a sign-in: it authorises the one
 * POST /auth/reset-password below, then the person signs in with the new
 * password. The token leaves the address bar and the history at once.
 *
 * Core refuses a token that is not a recovery session (FORBIDDEN) or no longer
 * valid (UNAUTHORIZED): both mean the link cannot be used, so the screen says
 * the link expired and offers a new one rather than an error to retry.
 */
const LINK_UNUSABLE = new Set(['UNAUTHORIZED', 'FORBIDDEN']);

export function ResetPasswordPage() {
  const locale = useShellLocale();
  const onNavigate = useShellNavigate();
  const ran = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<ResetView>({ kind: 'checking' });

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.search.slice(1);
    const accessToken = new URLSearchParams(raw).get('access_token');
    window.history.replaceState(null, '', window.location.pathname);
    setToken(accessToken);
    setView(accessToken ? { kind: 'form', pending: false, errorCode: null } : { kind: 'expired' });
  }, []);

  async function submit(password: string) {
    if (!token) return;
    setView({ kind: 'form', pending: true, errorCode: null });
    const { error } = await api('/auth/reset-password', { method: 'POST', token, body: { password } });
    if (error) {
      playPlatformSound('auth_error');
      setView(LINK_UNUSABLE.has(error.code) ? { kind: 'expired' } : { kind: 'form', pending: false, errorCode: failureCode(error) });
      return;
    }
    playPlatformSound('auth_success');
    setView({ kind: 'done' });
  }

  return <ResetPasswordScreen locale={locale} view={view} onSubmit={(password) => void submit(password)} onNavigate={onNavigate} />;
}
